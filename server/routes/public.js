import { get, all, run, parseJson, audit } from '../db.js';
import { config } from '../config.js';
import { LANGUAGES, COUNTRIES, PROFESSIONS, LANGUAGE_CODES, REGIONS, COUNTRY_LANGS } from '../languages.js';
import { loadCourseBySlug, loadPublishedCourses, courseCard, courseDetail, launchFocus, isPubliclyVisible } from '../catalog.js';
import { licenseFor, territoryAllows, entitlement, accreditationFor, availableTracks } from '../compliance.js';
import { signMediaPath } from '../services/media.js';
import { translationStatus, translateCues, translateStrings, ProviderNotConnectedError } from '../services/translation.js';
import crypto from 'node:crypto';
import { paymentMode } from '../services/payments.js';
import { HttpError, notFound, bad, str, email, oneOf, rateLimit } from '../http.js';

const LEVELS = ['foundation', 'intermediate', 'advanced'];

function publishedCourseOr404(slug) {
  const c = loadCourseBySlug(slug);
  if (!isPubliclyVisible(c)) throw notFound('Course not found.');
  return c;
}

export function registerPublicRoutes(r) {
  r.get('/api/meta', async () => {
    const visible = loadPublishedCourses();
    const focus = launchFocus();
    const count = (slug) => visible.filter((c) => c.specialty_slug === slug || c.specialty2_slug === slug).length;
    const specialties = all('SELECT slug, name, description, icon FROM specialties ORDER BY name')
      .map((x) => ({ ...x, course_count: count(x.slug) }))
      .filter((x) => !focus || x.course_count > 0);
    const focusInfo = focus ? (all('SELECT slug, name, description FROM specialties WHERE slug = ?', focus)[0] || null) : null;
    const usedProviders = new Set(visible.map((c) => c.provider_slug));
    const providers = all('SELECT p.slug, p.name, p.is_demo FROM providers p ORDER BY p.name').filter((x) => usedProviders.has(x.slug));
    const plans = all('SELECT code, name, interval, price_eur, price_usd, price_gbp, features, highlight FROM plans WHERE active = 1 ORDER BY sort')
      .map((p) => ({ ...p, features: parseJson(p.features, []), highlight: !!p.highlight }));
    // Languages that actually have released content somewhere in the catalogue.
    const live = new Set(['en']);
    for (const c of visible) for (const t of availableTracks(c, licenseFor(c.id))) live.add(t.language);
    const ai = await translationStatus();
    return {
      languages: LANGUAGES.map((l) => ({ ...l, live: live.has(l.code) })),
      regions: REGIONS.map(([code, name]) => ({ code, name })),
      countries: COUNTRIES.map(([code, name]) => ({ code, name, languages: COUNTRY_LANGS[code] || [] })).sort((a, b) => a.name.localeCompare(b.name)),
      professions: PROFESSIONS,
      specialties, providers, plans, focus: focusInfo,
      integrations: {
        aiTranslation: ai,
        payments: { mode: paymentMode() },
        tts: config.ttsProvider ? { connected: true, provider: config.ttsProvider } : { connected: false, fallback: 'browser_speech_synthesis' },
      },
      policyVersion: config.policyVersion,
      stats: {
        courses: visible.length,
        languages: live.size,
        specialties: specialties.filter((x) => x.course_count > 0 && x.slug !== focus).length,
      },
    };
  });

  r.get('/api/courses', (ctx) => {
    const q = ctx.query;
    let list = loadPublishedCourses().map((c) => courseCard(c, ctx.user));
    if (q.specialty) list = list.filter((c) => c.specialty?.slug === q.specialty || c.secondarySpecialty?.slug === q.specialty);
    if (q.language) list = list.filter((c) => c.languages.includes(q.language));
    if (q.provider) list = list.filter((c) => c.provider.slug === q.provider);
    if (q.level && LEVELS.includes(q.level)) list = list.filter((c) => c.level === q.level);
    if (q.accreditation === 'accredited') list = list.filter((c) => c.accreditation.status === 'accredited');
    if (q.accreditation === 'not_accredited') list = list.filter((c) => c.accreditation.status !== 'accredited');
    if (q.access === 'free') list = list.filter((c) => c.access === 'free');
    if (q.duration === 'short') list = list.filter((c) => c.durationSec < 15 * 60);
    if (q.duration === 'medium') list = list.filter((c) => c.durationSec >= 15 * 60 && c.durationSec <= 45 * 60);
    if (q.duration === 'long') list = list.filter((c) => c.durationSec > 45 * 60);
    if (q.since) list = list.filter((c) => (c.releaseDate || '') >= q.since);
    if (q.q) {
      const needle = String(q.q).toLowerCase().slice(0, 100);
      list = list.filter((c) => [c.title, c.description, c.specialty?.name, c.provider.name].join(' ').toLowerCase().includes(needle));
    }
    if (q.featured) list = list.filter((c) => c.featured);
    const sorters = {
      newest: (a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''),
      oldest: (a, b) => (a.releaseDate || '').localeCompare(b.releaseDate || ''),
      title: (a, b) => a.title.localeCompare(b.title),
      languages: (a, b) => b.languages.length - a.languages.length,
      duration: (a, b) => a.durationSec - b.durationSec,
    };
    list.sort(sorters[q.sort] || sorters.newest);
    return { courses: list, total: list.length };
  });

  r.get('/api/courses/:slug', (ctx) => {
    const c = publishedCourseOr404(ctx.params.slug);
    const detail = courseDetail(c, ctx.user);
    if (ctx.user) {
      detail.saved = !!get('SELECT 1 FROM saved_courses WHERE user_id = ? AND course_id = ?', ctx.user.id, c.id);
      const p = get('SELECT position_sec, percent, completed_at, last_language FROM progress WHERE user_id = ? AND course_id = ?', ctx.user.id, c.id);
      detail.progress = p ? { position: p.position_sec, percent: p.percent, completedAt: p.completed_at, lastLanguage: p.last_language } : null;
    }
    const related = loadPublishedCourses().filter((x) => x.id !== c.id && x.specialty_id === c.specialty_id).slice(0, 3);
    detail.related = (related.length ? related : loadPublishedCourses().filter((x) => x.id !== c.id).slice(0, 3)).map((x) => courseCard(x, ctx.user));
    return detail;
  });

  // Playback session: territory check, entitlement, signed media URL, tracks, resume point.
  r.get('/api/courses/:slug/play', (ctx) => {
    const c = publishedCourseOr404(ctx.params.slug);
    const license = licenseFor(c.id);
    if (!territoryAllows(license, ctx.user?.country)) {
      throw new HttpError(451, ctx.user?.country
        ? 'This course is not licensed for your country.'
        : 'This course is licensed for selected countries only. Please sign in and set your country in your profile.', { territories: license?.territories });
    }
    const ent = entitlement(ctx.user, c);
    const previewSec = ent.full ? null : Math.min(Math.round(c.duration_sec * 0.3), 120);
    let resume = 0;
    if (ctx.user) {
      const p = get('SELECT position_sec, last_language FROM progress WHERE user_id = ? AND course_id = ?', ctx.user.id, c.id);
      if (p && p.position_sec < c.duration_sec - 5) resume = p.position_sec;
    }
    const tracks = availableTracks(c, license).map((t) => ({ ...t, audioUrl: t.audioFile ? signMediaPath(t.audioFile) : null, audioFile: undefined }));
    return {
      mediaUrl: signMediaPath(c.media_file),
      poster: c.poster_file ? `/media/${c.poster_file}` : null,
      durationSec: c.duration_sec,
      mediaHasAudio: !!c.media_has_audio,
      tracks, entitlement: ent, previewSec, resume,
      preferredLanguage: ctx.user?.preferred_language || null,
    };
  });

  // Cues for one language. Only languages returned by availableTracks are served.
  r.get('/api/courses/:slug/cues', (ctx) => {
    const c = publishedCourseOr404(ctx.params.slug);
    const lang = ctx.query.lang || c.original_language;
    const license = licenseFor(c.id);
    if (!territoryAllows(license, ctx.user?.country)) throw new HttpError(451, 'Not licensed for your country.');
    const track = availableTracks(c, license).find((t) => t.language === lang);
    if (!track) throw notFound('This language is not available for this course.');
    const original = all('SELECT idx, start_sec, end_sec, speaker, text FROM cues WHERE course_id = ? ORDER BY idx', c.id);
    let texts = original.map((q) => q.text);
    if (!track.original) {
      const t = get("SELECT id FROM translations WHERE course_id = ? AND language = ? AND status = 'released'", c.id, lang);
      const rows = all('SELECT idx, text FROM translation_cues WHERE translation_id = ? ORDER BY idx', t.id);
      const byIdx = new Map(rows.map((x) => [x.idx, x.text]));
      texts = original.map((q) => byIdx.get(q.idx) ?? '');
    }
    // Without entitlement only the preview part of the transcript is delivered.
    const ent = entitlement(ctx.user, c);
    const limit = ent.full ? Infinity : Math.min(Math.round(c.duration_sec * 0.3), 120);
    return {
      language: lang, aiGenerated: track.aiGenerated, review: track.review, truncated: !ent.full,
      cues: original.map((q, i) => ({ start: q.start_sec, end: q.end_sec, speaker: q.speaker, text: texts[i] })).filter((q) => q.start < limit),
    };
  });

  // Live AI subtitles: translate the transcript into any platform language on demand,
  // starting at the viewer's playhead. Unreviewed machine translation, clearly labelled.
  // Allowed only where the licence permits translation, subtitles and live AI use.
  r.post('/api/courses/:slug/live-translate', async (ctx) => {
    rateLimit(`live:${ctx.user?.id || ctx.ip}`, 60, 3600_000);
    const c = publishedCourseOr404(ctx.params.slug);
    const b = await ctx.json();
    if (!LANGUAGE_CODES.has(b.language) || b.language === c.original_language) throw bad('Choose a target language.');
    const license = licenseFor(c.id);
    if (!territoryAllows(license, ctx.user?.country)) throw new HttpError(451, 'Not licensed for your country.');
    if (!liveAllowed(license)) throw new HttpError(403, 'Live AI translation is not permitted for this course.');
    const ent = entitlement(ctx.user, c);
    const limit = ent.full ? Infinity : Math.min(Math.round(c.duration_sec * 0.3), 120);
    const from = Math.max(0, Number(b.from) || 0);
    const count = Math.min(20, Math.max(1, Number(b.count) || 8));
    const cues = all('SELECT idx, start_sec, end_sec, speaker, text FROM cues WHERE course_id = ? AND idx >= ? ORDER BY idx LIMIT ?', c.id, from, count)
      .filter((q) => q.start_sec < limit);
    if (!cues.length) return { cues: [], done: true };
    const hash = (t) => crypto.createHash('sha1').update(t).digest('hex').slice(0, 16);
    const cached = new Map(all('SELECT idx, text, source_hash FROM live_translation_cache WHERE course_id = ? AND language = ?', c.id, b.language)
      .map((x) => [x.idx, x]));
    const missing = cues.filter((q) => cached.get(q.idx)?.source_hash !== hash(q.text));
    if (missing.length) {
      let out;
      try {
        out = await translateCues({ cues: missing.map((q) => ({ text: q.text, speaker: q.speaker })), source: c.original_language, target: b.language, courseTitle: c.title });
      } catch (e) {
        if (e instanceof ProviderNotConnectedError) throw new HttpError(503, 'Live AI translation is not connected on this server (ANTHROPIC_API_KEY missing).');
        throw new HttpError(502, `Live translation failed: ${e.message}`);
      }
      missing.forEach((q, i) => {
        run(`INSERT INTO live_translation_cache (course_id, language, idx, source_hash, text, model) VALUES (?,?,?,?,?,?)
             ON CONFLICT(course_id, language, idx) DO UPDATE SET text = excluded.text, source_hash = excluded.source_hash, model = excluded.model, created_at = datetime('now')`,
          c.id, b.language, q.idx, hash(q.text), out.texts[i], out.model);
        cached.set(q.idx, { text: out.texts[i] });
      });
    }
    return {
      language: b.language, review: 'live_unreviewed', done: cues.length < count,
      cues: cues.map((q) => ({ idx: q.idx, start: q.start_sec, end: q.end_sec, speaker: q.speaker, text: cached.get(q.idx).text })),
    };
  });

  r.post('/api/courses/:slug/progress', async (ctx) => {
    if (!ctx.user) return { saved: false };
    const c = publishedCourseOr404(ctx.params.slug);
    const body = await ctx.json();
    const lang = LANGUAGE_CODES.has(body.language) ? body.language : null;
    const ent = entitlement(ctx.user, c);
    let position = Math.max(0, Math.min(Number(body.position) || 0, c.duration_sec));
    if (!ent.full) position = Math.min(position, Math.min(Math.round(c.duration_sec * 0.3), 120));
    const existing = get('SELECT * FROM progress WHERE user_id = ? AND course_id = ?', ctx.user.id, c.id);
    // Only count genuinely watched time: max position can grow by at most the elapsed wall-clock interval (+ tolerance).
    const prevMax = existing?.max_position_sec || 0;
    const watchedDelta = Math.max(0, Math.min(Number(body.watchedDelta) || 0, 60));
    const maxPos = Math.max(prevMax, Math.min(position, prevMax + watchedDelta * 2.2 + 3));
    const percent = Math.min(1, maxPos / Math.max(1, c.duration_sec));
    const completed = percent >= 0.9 && ent.full;
    if (existing) {
      run(`UPDATE progress SET position_sec = ?, max_position_sec = ?, percent = ?, last_language = COALESCE(?, last_language), updated_at = datetime('now'),
           completed_at = COALESCE(completed_at, CASE WHEN ? THEN datetime('now') END) WHERE user_id = ? AND course_id = ?`,
        position, maxPos, percent, lang, completed ? 1 : 0, ctx.user.id, c.id);
    } else {
      run(`INSERT INTO progress (user_id, course_id, position_sec, max_position_sec, percent, last_language, completed_at)
           VALUES (?,?,?,?,?,?, CASE WHEN ? THEN datetime('now') END)`, ctx.user.id, c.id, position, maxPos, percent, lang, completed ? 1 : 0);
    }
    let certificate = null;
    if (completed) certificate = issueCertificate(ctx.user, c, lang);
    return { saved: true, percent, completed, certificate };
  });

  r.post('/api/courses/:slug/save', async (ctx) => {
    if (!ctx.user) throw new HttpError(401, 'Sign in to save courses.');
    const c = publishedCourseOr404(ctx.params.slug);
    const exists = get('SELECT 1 FROM saved_courses WHERE user_id = ? AND course_id = ?', ctx.user.id, c.id);
    if (exists) run('DELETE FROM saved_courses WHERE user_id = ? AND course_id = ?', ctx.user.id, c.id);
    else run('INSERT INTO saved_courses (user_id, course_id) VALUES (?,?)', ctx.user.id, c.id);
    return { saved: !exists };
  });

  r.get('/api/certificates/:id', (ctx) => {
    const cert = get(`SELECT ce.*, c.title, c.duration_sec, c.slug, p.name AS provider_name, u.first_name, u.last_name
        FROM certificates ce JOIN courses c ON c.id = ce.course_id JOIN users u ON u.id = ce.user_id
        LEFT JOIN providers p ON p.id = c.provider_id WHERE ce.id = ?`, ctx.params.id);
    if (!cert) throw notFound('Certificate not found.');
    return {
      id: cert.id, kind: cert.kind, issuedAt: cert.issued_at, language: cert.language,
      holder: `${cert.first_name} ${cert.last_name}`, course: cert.title, courseSlug: cert.slug, provider: cert.provider_name,
      durationSec: cert.duration_sec, credits: cert.credit_amount, creditType: cert.credit_type, body: cert.accreditation_body,
    };
  });

  r.post('/api/partners/inquiry', async (ctx) => {
    rateLimit(`partner:${ctx.ip}`, 5, 3600_000);
    const b = await ctx.json();
    if (b.website) return { ok: true }; // honeypot
    if (!b.privacyAccepted) throw bad('Please confirm that you have read the privacy policy.');
    run(`INSERT INTO partner_inquiries (organisation, contact_name, email, country, org_type, catalogue_size, target_languages, interests, message)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      str(b.organisation, { required: true, max: 200, name: 'Organisation' }), str(b.contactName, { required: true, max: 120, name: 'Name' }),
      email(b.email), str(b.country, { max: 2 }), str(b.orgType, { max: 80 }), str(b.catalogueSize, { max: 80 }),
      str(Array.isArray(b.targetLanguages) ? b.targetLanguages.join(',') : b.targetLanguages, { max: 200 }),
      str(Array.isArray(b.interests) ? b.interests.join(',') : b.interests, { max: 300 }), str(b.message, { max: 4000 }));
    return { ok: true };
  });

  r.post('/api/complaints', async (ctx) => {
    rateLimit(`complaint:${ctx.ip}`, 8, 3600_000);
    const b = await ctx.json();
    if (b.website) return { ok: true };
    const type = oneOf(b.type, ['copyright', 'privacy', 'medical_content', 'translation_error', 'legal', 'general'], 'Request type');
    if (!b.privacyAccepted) throw bad('Please confirm that you have read the privacy policy.');
    if (type === 'copyright' && !b.goodFaith) throw bad('Please confirm the good-faith statement for copyright notices.');
    let courseId = null;
    if (b.courseSlug) courseId = get('SELECT id FROM courses WHERE slug = ?', String(b.courseSlug))?.id ?? null;
    const r2 = run(`INSERT INTO complaints (type, name, email, organisation, course_id, reference_url, description, good_faith, user_id)
         VALUES (?,?,?,?,?,?,?,?,?)`, type, str(b.name, { required: true, max: 120, name: 'Name' }), email(b.email),
      str(b.organisation, { max: 200 }), courseId, str(b.referenceUrl, { max: 500 }),
      str(b.description, { required: true, max: 6000, name: 'Description' }), b.goodFaith ? 1 : 0, ctx.user?.id ?? null);
    return { ok: true, reference: `REQ-${String(r2.lastInsertRowid).padStart(5, '0')}` };
  });

  // Whole-website translation: UI strings are machine-translated on demand and cached.
  r.post('/api/i18n/translate', async (ctx) => {
    rateLimit(`i18n:${ctx.ip}`, 120, 3600_000);
    const b = await ctx.json();
    if (!LANGUAGE_CODES.has(b.language) || b.language === 'en') throw bad('Choose a target language.');
    const strings = (Array.isArray(b.strings) ? b.strings : []).slice(0, 80).map((x) => String(x).slice(0, 2000));
    if (!strings.length) return { translations: [] };
    const hash = (t) => crypto.createHash('sha1').update(t).digest('hex');
    const out = strings.map((s) => get('SELECT text FROM ui_translation_cache WHERE language = ? AND source_hash = ?', b.language, hash(s))?.text ?? null);
    const missing = strings.filter((_, i) => out[i] == null);
    if (missing.length) {
      let res;
      try { res = await translateStrings({ strings: missing, target: b.language }); } catch (e) {
        if (e instanceof ProviderNotConnectedError) throw new HttpError(503, 'Website translation is not connected on this server (ANTHROPIC_API_KEY missing).');
        throw new HttpError(502, `Translation failed: ${e.message}`);
      }
      let k = 0;
      strings.forEach((s, i) => {
        if (out[i] != null) return;
        out[i] = res[k++];
        run('INSERT OR REPLACE INTO ui_translation_cache (language, source_hash, text) VALUES (?,?,?)', b.language, hash(s), out[i]);
      });
    }
    return { translations: out };
  });

  r.post('/api/consent', async (ctx) => {
    const b = await ctx.json();
    const categories = { necessary: true, preferences: !!b.preferences, analytics: !!b.analytics };
    const consentId = typeof b.consentId === 'string' && /^[\w-]{8,64}$/.test(b.consentId) ? b.consentId : crypto.randomUUID();
    run('INSERT INTO consent_log (consent_id, user_id, categories, policy_version) VALUES (?,?,?,?)',
      consentId, ctx.user?.id ?? null, JSON.stringify(categories), config.policyVersion);
    return { consentId, categories, policyVersion: config.policyVersion };
  });

  r.get('/api/legal/operator', () => ({ operator: config.operator, policyVersion: config.policyVersion }));
}

export const liveAllowed = (license) => !!(license?.allow_live_ai && license.right_translate && license.right_subtitle);

export function issueCertificate(user, course, language) {
  const existing = get('SELECT id FROM certificates WHERE user_id = ? AND course_id = ?', user.id, course.id);
  if (existing) return existing.id;
  const acc = accreditationFor(course.id);
  // A CME certificate is only issued for a verified, valid accreditation that covers the language used.
  const cmeValid = acc?.status === 'accredited' && acc.verified_at && acc.valid_until >= new Date().toISOString().slice(0, 10)
    && (acc.applies_to_languages.length === 0 || acc.applies_to_languages.includes(language));
  const id = crypto.randomBytes(9).toString('base64url');
  run(`INSERT INTO certificates (id, user_id, course_id, kind, credit_amount, credit_type, accreditation_body, language) VALUES (?,?,?,?,?,?,?,?)`,
    id, user.id, course.id, cmeValid ? 'cme' : 'completion', cmeValid ? acc.credit_amount : null, cmeValid ? acc.credit_type : null,
    cmeValid ? acc.body : null, language);
  audit(user.id, 'certificate.issued', 'course', course.id, { kind: cmeValid ? 'cme' : 'completion' });
  return id;
}
