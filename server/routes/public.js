import crypto from 'node:crypto';
import { get, all, run, parseJson, audit } from '../db.js';
import { config } from '../config.js';
import { LANGUAGES, COUNTRIES, PROFESSIONS, LANGUAGE_CODES } from '../languages.js';
import { loadCourseBySlug, loadPublishedCourses, courseCard, courseDetail } from '../catalog.js';
import { licenseFor, territoryAllows, entitlement, accreditationFor, availableTracks } from '../compliance.js';
import { signMediaPath } from '../services/media.js';
import { translationStatus } from '../services/translation.js';
import { paymentMode } from '../services/payments.js';
import { HttpError, notFound, bad, str, email, oneOf, rateLimit } from '../http.js';

const LEVELS = ['foundation', 'intermediate', 'advanced'];

function publishedCourseOr404(slug) {
  const c = loadCourseBySlug(slug);
  if (!c || c.status !== 'published') throw notFound('Course not found.');
  return c;
}

export function registerPublicRoutes(r) {
  r.get('/api/meta', async () => {
    const specialties = all(`SELECT s.slug, s.name, s.description, s.icon,
        (SELECT COUNT(*) FROM courses c WHERE c.status = 'published' AND (c.specialty_id = s.id OR c.secondary_specialty_id = s.id)) AS course_count
        FROM specialties s ORDER BY s.name`);
    const providers = all(`SELECT p.slug, p.name, p.is_demo FROM providers p
        WHERE EXISTS (SELECT 1 FROM courses c WHERE c.provider_id = p.id AND c.status = 'published') ORDER BY p.name`);
    const plans = all('SELECT code, name, interval, price_eur, price_usd, price_gbp, features, highlight FROM plans WHERE active = 1 ORDER BY sort')
      .map((p) => ({ ...p, features: parseJson(p.features, []), highlight: !!p.highlight }));
    // Languages that actually have released content somewhere in the catalogue.
    const live = new Set(['en']);
    for (const c of loadPublishedCourses()) for (const t of availableTracks(c, licenseFor(c.id))) live.add(t.language);
    const ai = await translationStatus();
    return {
      languages: LANGUAGES.map((l) => ({ ...l, live: live.has(l.code) })),
      countries: COUNTRIES.map(([code, name]) => ({ code, name })),
      professions: PROFESSIONS,
      specialties, providers, plans,
      integrations: {
        aiTranslation: ai,
        payments: { mode: paymentMode() },
        tts: config.ttsProvider ? { connected: true, provider: config.ttsProvider } : { connected: false, fallback: 'browser_speech_synthesis' },
      },
      policyVersion: config.policyVersion,
      stats: {
        courses: get("SELECT COUNT(*) AS n FROM courses WHERE status = 'published'").n,
        languages: live.size,
        specialties: specialties.filter((s) => s.course_count > 0).length,
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
