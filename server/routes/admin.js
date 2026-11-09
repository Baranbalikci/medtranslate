import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { get, all, run, tx, audit, parseJson, setSetting } from '../db.js';
import { config } from '../config.js';
import { LANGUAGE_CODES, COUNTRY_CODES } from '../languages.js';
import { launchFocus } from '../catalog.js';
import { launchLanguages, launchLanguagesLocked, DEFAULT_LAUNCH_LANGUAGES } from '../launch.js';
import { LANGUAGES } from '../languages.js';
import { loadCourseById } from '../catalog.js';
import {
  RIGHTS, licenseFor, accreditationFor, publishBlockers, translationReleaseBlockers, licenseBlockers, accreditationBlockers,
} from '../compliance.js';
import { translateCues, translationStatus, ProviderNotConnectedError } from '../services/translation.js';
import { parseSubtitles, toVtt } from '../services/vtt.js';
import { bad, notFound, str, oneOf, isoDate, HttpError } from '../http.js';

const ADMIN = { roles: ['admin'] };
const STAFF = { roles: ['admin', 'reviewer'] };
const LEVELS = ['foundation', 'intermediate', 'advanced'];
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);

function courseOr404(id) {
  const c = loadCourseById(Number(id));
  if (!c) throw notFound('Course not found.');
  return c;
}

function translationSummary(t) {
  const reviews = all('SELECT q.*, u.first_name, u.last_name FROM qc_reviews q LEFT JOIN users u ON u.id = q.reviewer_id WHERE q.translation_id = ? ORDER BY q.id DESC', t.id);
  return { ...t, reviews, cueCount: get('SELECT COUNT(*) AS n FROM translation_cues WHERE translation_id = ?', t.id).n };
}

function adminCourse(c) {
  const license = licenseFor(c.id);
  const accreditation = accreditationFor(c.id);
  const translations = all('SELECT * FROM translations WHERE course_id = ? ORDER BY language', c.id).map((t) => ({
    ...translationSummary(t), releaseBlockers: translationReleaseBlockers(t, license),
  }));
  return {
    ...c, objectives: parseJson(c.objectives, []),
    cues: all('SELECT idx, start_sec, end_sec, speaker, text, slide FROM cues WHERE course_id = ? ORDER BY idx', c.id),
    license, accreditation, translations,
    blockers: publishBlockers(c.id),
    licenseBlockers: licenseBlockers(license), accreditationBlockers: accreditationBlockers(accreditation),
  };
}

export function registerAdminRoutes(r) {
  r.get('/api/admin/overview', async () => {
    const count = (sql, ...p) => get(sql, ...p).n;
    const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
    return {
      courses: {
        published: count("SELECT COUNT(*) AS n FROM courses WHERE status = 'published'"),
        draft: count("SELECT COUNT(*) AS n FROM courses WHERE status = 'draft'"),
        suspended: count("SELECT COUNT(*) AS n FROM courses WHERE status = 'suspended'"),
      },
      translations: Object.fromEntries(all('SELECT status, COUNT(*) AS n FROM translations GROUP BY status').map((x) => [x.status, x.n])),
      users: { total: count('SELECT COUNT(*) AS n FROM users'), new30d: count('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', since30.replace('T', ' ').slice(0, 19)) },
      subscriptions: {
        active: count("SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'active'"),
        demo: count("SELECT COUNT(*) AS n FROM subscriptions WHERE provider = 'demo'"),
      },
      revenue: all('SELECT currency, SUM(gross_cents) AS gross, SUM(is_demo) AS demo_count, COUNT(*) AS n FROM invoices GROUP BY currency'),
      learning: {
        enrolments: count('SELECT COUNT(*) AS n FROM progress'),
        completions: count('SELECT COUNT(*) AS n FROM progress WHERE completed_at IS NOT NULL'),
        byLanguage: all('SELECT COALESCE(last_language, ?) AS language, COUNT(*) AS n FROM progress GROUP BY 1 ORDER BY n DESC', 'unknown'),
      },
      openComplaints: count("SELECT COUNT(*) AS n FROM complaints WHERE status IN ('open','in_progress')"),
      newPartnerInquiries: count("SELECT COUNT(*) AS n FROM partner_inquiries WHERE status = 'new'"),
      expiringLicenses: all(`SELECT l.course_id, l.term_end, c.title FROM licenses l JOIN courses c ON c.id = l.course_id
          WHERE l.term_end <= date('now', '+90 day') ORDER BY l.term_end`),
      pendingReviews: count("SELECT COUNT(*) AS n FROM translations WHERE status IN ('machine','in_review')"),
      integrations: { aiTranslation: await translationStatus() },
    };
  }, STAFF);

  // ── courses ───────────────────────────────────────────────────────────────
  r.get('/api/admin/courses', () => all(`SELECT c.id, c.slug, c.title, c.status, c.release_date, c.is_demo, s.name AS specialty, p.name AS provider,
      (SELECT COUNT(*) FROM translations t WHERE t.course_id = c.id AND t.status = 'released') AS released_languages,
      (SELECT COUNT(*) FROM translations t WHERE t.course_id = c.id AND t.status IN ('machine','in_review','approved')) AS pending_languages,
      a.status AS accreditation_status, l.term_end
      FROM courses c LEFT JOIN specialties s ON s.id = c.specialty_id LEFT JOIN providers p ON p.id = c.provider_id
      LEFT JOIN accreditations a ON a.course_id = c.id LEFT JOIN licenses l ON l.course_id = c.id ORDER BY c.updated_at DESC`)
    .map((c) => ({ ...c, blockers: publishBlockers(c.id).length })), STAFF);

  r.get('/api/admin/courses/:id', (ctx) => adminCourse(courseOr404(ctx.params.id)), STAFF);

  r.post('/api/admin/courses', async (ctx) => {
    const b = await ctx.json();
    const title = str(b.title, { required: true, max: 200, name: 'Title' });
    let slug = slugify(b.slug || title);
    if (!slug) throw bad('Invalid slug.');
    if (get('SELECT 1 FROM courses WHERE slug = ?', slug)) slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
    const res = run(`INSERT INTO courses (slug, title, description, status, original_language) VALUES (?,?,?, 'draft', ?)`,
      slug, title, str(b.description, { max: 4000 }) || '', LANGUAGE_CODES.has(b.originalLanguage) ? b.originalLanguage : 'en');
    const id = Number(res.lastInsertRowid);
    run("INSERT INTO accreditations (course_id, status) VALUES (?, 'not_accredited')", id);
    audit(ctx.user.id, 'course.created', 'course', id);
    return adminCourse(loadCourseById(id));
  }, ADMIN);

  r.patch('/api/admin/courses/:id', async (ctx) => {
    const c = courseOr404(ctx.params.id);
    const b = await ctx.json();
    const specialtyId = b.specialty ? get('SELECT id FROM specialties WHERE slug = ?', b.specialty)?.id : null;
    const specialty2Id = b.secondarySpecialty ? get('SELECT id FROM specialties WHERE slug = ?', b.secondarySpecialty)?.id : null;
    const providerId = b.provider ? get('SELECT id FROM providers WHERE slug = ?', b.provider)?.id : null;
    const topicId = b.topic ? get('SELECT id FROM topics WHERE slug = ?', b.topic)?.id : null;
    run(`UPDATE courses SET title = ?, description = ?, objectives = ?, specialty_id = ?, secondary_specialty_id = ?, provider_id = ?, topic_id = ?, level = ?,
         original_language = ?, access = ?, price_cents = ?, featured = ?, release_date = ?, media_has_audio = ?, duration_sec = ?, updated_at = datetime('now') WHERE id = ?`,
      str(b.title, { required: true, max: 200, name: 'Title' }), str(b.description, { max: 4000 }) || '',
      JSON.stringify((Array.isArray(b.objectives) ? b.objectives : []).map((o) => String(o).slice(0, 300)).filter(Boolean).slice(0, 12)),
      specialtyId ?? null, specialty2Id ?? null, providerId ?? null, topicId ?? null, oneOf(b.level || c.level, LEVELS, 'Level'),
      LANGUAGE_CODES.has(b.originalLanguage) ? b.originalLanguage : c.original_language, oneOf(b.access || c.access, ['free', 'subscription'], 'Access'),
      Math.max(0, Math.round(Number(b.priceCents) || 0)), b.featured ? 1 : 0, isoDate(b.releaseDate, 'Release date'), b.mediaHasAudio ? 1 : 0,
      Math.max(0, Math.round(Number(b.durationSec) || c.duration_sec)), c.id);
    audit(ctx.user.id, 'course.updated', 'course', c.id);
    // Editing a published course re-checks the gate; if it now fails, the course is suspended automatically.
    if (c.status === 'published' && publishBlockers(c.id).length) run("UPDATE courses SET status = 'suspended' WHERE id = ?", c.id);
    return adminCourse(loadCourseById(c.id));
  }, ADMIN);

  r.post('/api/admin/courses/:id/status', async (ctx) => {
    const c = courseOr404(ctx.params.id);
    const { status } = await ctx.json();
    oneOf(status, ['published', 'draft', 'suspended', 'archived'], 'Status');
    if (status === 'published') {
      const blockers = publishBlockers(c.id);
      if (blockers.length) throw new HttpError(409, 'Publication blocked: required clearances are missing.', { blockers });
    }
    run("UPDATE courses SET status = ?, updated_at = datetime('now') WHERE id = ?", status, c.id);
    audit(ctx.user.id, `course.${status}`, 'course', c.id);
    return adminCourse(loadCourseById(c.id));
  }, ADMIN);

  // Original transcript (cues). Accepts JSON cues or a WebVTT/SRT file.
  r.put('/api/admin/courses/:id/cues', async (ctx) => {
    const c = courseOr404(ctx.params.id);
    const b = await ctx.json();
    const cues = b.vtt ? parseSubtitles(b.vtt) : (b.cues || []).map((q) => ({ start: +q.start, end: +q.end, speaker: q.speaker || null, text: String(q.text || ''), slide: q.slide || null }));
    if (!cues.length) throw bad('No cues found.');
    for (const q of cues) if (!(q.end > q.start) || !q.text.trim()) throw bad('Every cue needs text and an end time after its start time.');
    tx(() => {
      run('DELETE FROM cues WHERE course_id = ?', c.id);
      cues.forEach((q, i) => run('INSERT INTO cues (course_id, idx, start_sec, end_sec, speaker, text, slide) VALUES (?,?,?,?,?,?,?)',
        c.id, i, q.start, q.end, q.speaker, q.text.trim().slice(0, 1000), q.slide ? String(q.slide).slice(0, 120) : null));
      // Source changed → every translation must be re-reviewed before it can be shown again.
      run("UPDATE translations SET status = 'in_review', updated_at = datetime('now') WHERE course_id = ? AND status IN ('approved','released')", c.id);
    });
    audit(ctx.user.id, 'course.transcript_updated', 'course', c.id, { cues: cues.length });
    return adminCourse(loadCourseById(c.id));
  }, ADMIN);

  // Video upload (raw body). In production, upload to object storage + CDN and transcode to HLS/CMAF.
  r.post('/api/admin/courses/:id/media', async (ctx) => {
    const c = courseOr404(ctx.params.id);
    const type = ctx.req.headers['content-type'] || '';
    const ext = { 'video/mp4': '.mp4', 'video/webm': '.webm' }[type.split(';')[0]];
    if (!ext) throw bad('Only MP4 or WebM video can be uploaded.');
    const len = Number(ctx.req.headers['content-length'] || 0);
    if (len > config.maxUploadBytes) throw new HttpError(413, 'File too large.');
    fs.mkdirSync(config.uploadDir, { recursive: true });
    const name = `${c.slug}-${Date.now()}${ext}`;
    const dest = path.join(config.uploadDir, name);
    let size = 0;
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(dest);
      ctx.req.on('data', (chunk) => { size += chunk.length; if (size > config.maxUploadBytes) { ctx.req.destroy(); reject(new HttpError(413, 'File too large.')); } });
      ctx.req.pipe(out);
      out.on('finish', resolve); out.on('error', reject);
    }).catch((e) => { fs.rmSync(dest, { force: true }); throw e; });
    run("UPDATE courses SET media_file = ?, updated_at = datetime('now') WHERE id = ?", `uploads/${name}`, c.id);
    audit(ctx.user.id, 'course.media_uploaded', 'course', c.id, { size });
    return adminCourse(loadCourseById(c.id));
  }, ADMIN);

  // ── licence ───────────────────────────────────────────────────────────────
  r.put('/api/admin/courses/:id/license', async (ctx) => {
    const c = courseOr404(ctx.params.id);
    const b = await ctx.json();
    const territories = (Array.isArray(b.territories) ? b.territories : []).map((t) => String(t).toUpperCase()).filter((t) => t === '*' || COUNTRY_CODES.has(t));
    const languages = (Array.isArray(b.languages) ? b.languages : []).filter((l) => l === '*' || LANGUAGE_CODES.has(l));
    const rights = Object.fromEntries(RIGHTS.map((x) => [x.key, b[x.key] ? 1 : 0]));
    const values = [str(b.licensor, { required: true, max: 200, name: 'Licensor' }), str(b.contract_ref, { max: 120 }),
      ...RIGHTS.map((x) => rights[x.key]), JSON.stringify(territories), JSON.stringify(languages),
      isoDate(b.term_start, 'Term start'), isoDate(b.term_end, 'Term end'), str(b.revenue_share, { max: 200 }), str(b.document_ref, { max: 300 }), str(b.notes, { max: 2000 })];
    if (get('SELECT 1 FROM licenses WHERE course_id = ?', c.id)) {
      run(`UPDATE licenses SET licensor=?, contract_ref=?, ${RIGHTS.map((x) => `${x.key}=?`).join(', ')}, territories=?, languages=?, term_start=?, term_end=?,
           revenue_share=?, document_ref=?, notes=?, is_demo = 0, updated_at = datetime('now') WHERE course_id = ?`, ...values, c.id);
    } else {
      run(`INSERT INTO licenses (licensor, contract_ref, ${RIGHTS.map((x) => x.key).join(', ')}, territories, languages, term_start, term_end, revenue_share, document_ref, notes, course_id)
           VALUES (${Array(values.length + 1).fill('?').join(',')})`, ...values, c.id);
    }
    run('UPDATE licenses SET allow_live_ai = ? WHERE course_id = ?', b.allow_live_ai ? 1 : 0, c.id);
    audit(ctx.user.id, 'license.updated', 'course', c.id, { rights, territories, languages, allowLiveAi: !!b.allow_live_ai });
    if (c.status === 'published' && publishBlockers(c.id).length) {
      run("UPDATE courses SET status = 'suspended' WHERE id = ?", c.id);
      audit(ctx.user.id, 'course.auto_suspended', 'course', c.id, { reason: 'licence no longer sufficient' });
    }
    return adminCourse(loadCourseById(c.id));
  }, ADMIN);

  // ── accreditation ─────────────────────────────────────────────────────────
  r.put('/api/admin/courses/:id/accreditation', async (ctx) => {
    const c = courseOr404(ctx.params.id);
    const b = await ctx.json();
    const status = oneOf(b.status, ['not_accredited', 'pending', 'accredited', 'expired'], 'Status');
    const langs = (Array.isArray(b.applies_to_languages) ? b.applies_to_languages : []).filter((l) => LANGUAGE_CODES.has(l));
    run(`UPDATE accreditations SET status = ?, body = ?, credit_amount = ?, credit_type = ?, reference = ?, valid_from = ?, valid_until = ?,
         applies_to_languages = ?, evidence_ref = ?, notes = ?, verified_by = ?, verified_at = ?, updated_at = datetime('now') WHERE course_id = ?`,
      status, str(b.body, { max: 200 }), b.credit_amount === '' || b.credit_amount == null ? null : Number(b.credit_amount),
      str(b.credit_type, { max: 80 }), str(b.reference, { max: 120 }), isoDate(b.valid_from), isoDate(b.valid_until),
      JSON.stringify(langs), str(b.evidence_ref, { max: 300 }), str(b.notes, { max: 2000 }),
      b.verified ? ctx.user.id : null, b.verified ? new Date().toISOString() : null, c.id);
    if (!get('SELECT 1 FROM accreditations WHERE course_id = ?', c.id)) run("INSERT INTO accreditations (course_id, status) VALUES (?, ?)", c.id, status);
    audit(ctx.user.id, 'accreditation.updated', 'course', c.id, { status, verified: !!b.verified });
    if (c.status === 'published' && publishBlockers(c.id).length) run("UPDATE courses SET status = 'suspended' WHERE id = ?", c.id);
    return adminCourse(loadCourseById(c.id));
  }, ADMIN);

  // ── translations & QC ─────────────────────────────────────────────────────
  r.post('/api/admin/courses/:id/translations', async (ctx) => {
    const c = courseOr404(ctx.params.id);
    const b = await ctx.json();
    const lang = b.language;
    if (!LANGUAGE_CODES.has(lang) || lang === c.original_language) throw bad('Choose a target language different from the original.');
    const license = licenseFor(c.id);
    if (!license?.right_translate) throw new HttpError(409, 'The licence does not grant translation rights for this course.');
    const cues = all('SELECT * FROM cues WHERE course_id = ? ORDER BY idx', c.id);
    if (!cues.length) throw bad('The course has no original transcript yet.');

    let texts, provider;
    if (b.mode === 'import') {
      const imported = parseSubtitles(String(b.vtt || ''));
      if (imported.length !== cues.length) throw bad(`Imported file has ${imported.length} cues; the original has ${cues.length}. Cue counts must match.`);
      texts = imported.map((q) => q.text); provider = 'manual-import';
    } else {
      try {
        const out = await translateCues({ cues: cues.map((q) => ({ text: q.text, speaker: q.speaker })), source: c.original_language, target: lang, courseTitle: c.title });
        texts = out.texts; provider = `anthropic:${out.model}`;
        if (out.uncertain.length) b.uncertain = out.uncertain;
      } catch (e) {
        if (e instanceof ProviderNotConnectedError) throw new HttpError(503, 'AI translation is not connected. Configure ANTHROPIC_API_KEY or import a subtitle file instead.');
        throw new HttpError(502, `Translation failed: ${e.message}`);
      }
    }
    const tid = tx(() => {
      const existing = get('SELECT id FROM translations WHERE course_id = ? AND language = ?', c.id, lang);
      let id = existing?.id;
      if (id) {
        run("UPDATE translations SET status = 'machine', provider = ?, updated_at = datetime('now'), released_at = NULL WHERE id = ?", provider, id);
        run('DELETE FROM translation_cues WHERE translation_id = ?', id);
      } else {
        id = Number(run("INSERT INTO translations (course_id, language, status, provider) VALUES (?,?, 'machine', ?)", c.id, lang, provider).lastInsertRowid);
      }
      texts.forEach((t, i) => run('INSERT INTO translation_cues (translation_id, idx, text) VALUES (?,?,?)', id, i, t.slice(0, 1000)));
      return id;
    });
    audit(ctx.user.id, 'translation.generated', 'translation', tid, { language: lang, provider, uncertain: b.uncertain || [] });
    return { translation: translationSummary(get('SELECT * FROM translations WHERE id = ?', tid)), uncertain: b.uncertain || [] };
  }, ADMIN);

  r.get('/api/admin/translations/:id', (ctx) => {
    const t = get('SELECT * FROM translations WHERE id = ?', Number(ctx.params.id));
    if (!t) throw notFound();
    const original = all('SELECT idx, start_sec, end_sec, speaker, text FROM cues WHERE course_id = ? ORDER BY idx', t.course_id);
    const translated = new Map(all('SELECT idx, text FROM translation_cues WHERE translation_id = ?', t.id).map((x) => [x.idx, x.text]));
    return {
      ...translationSummary(t), course: { id: t.course_id, title: loadCourseById(t.course_id).title },
      releaseBlockers: translationReleaseBlockers(t, licenseFor(t.course_id)),
      cues: original.map((q) => ({ ...q, translation: translated.get(q.idx) ?? '' })),
    };
  }, STAFF);

  // Human post-editing. Any edit returns the translation to review.
  r.put('/api/admin/translations/:id/cues', async (ctx) => {
    const t = get('SELECT * FROM translations WHERE id = ?', Number(ctx.params.id));
    if (!t) throw notFound();
    const { texts } = await ctx.json();
    const n = get('SELECT COUNT(*) AS n FROM cues WHERE course_id = ?', t.course_id).n;
    if (!Array.isArray(texts) || texts.length !== n) throw bad(`Expected ${n} cue texts.`);
    tx(() => {
      run('DELETE FROM translation_cues WHERE translation_id = ?', t.id);
      texts.forEach((x, i) => run('INSERT INTO translation_cues (translation_id, idx, text) VALUES (?,?,?)', t.id, i, String(x).trim().slice(0, 1000)));
      run("UPDATE translations SET status = 'in_review', released_at = NULL, updated_at = datetime('now') WHERE id = ?", t.id);
    });
    audit(ctx.user.id, 'translation.edited', 'translation', t.id);
    return { ok: true };
  }, STAFF);

  r.post('/api/admin/translations/:id/review', async (ctx) => {
    const t = get('SELECT * FROM translations WHERE id = ?', Number(ctx.params.id));
    if (!t) throw notFound();
    const b = await ctx.json();
    const decision = oneOf(b.decision, ['approved', 'changes_requested', 'rejected'], 'Decision');
    const qualification = str(b.qualification, { required: true, max: 200, name: 'Reviewer qualification' });
    if (decision === 'approved' && !(b.terminology_ok && b.meaning_preserved && b.sync_ok)) {
      throw bad('Approval requires confirming terminology, preserved meaning and timing.');
    }
    run(`INSERT INTO qc_reviews (translation_id, reviewer_id, reviewer_label, qualification, decision, terminology_ok, meaning_preserved, sync_ok, notes)
         VALUES (?,?,?,?,?,?,?,?,?)`, t.id, ctx.user.id, `${ctx.user.first_name} ${ctx.user.last_name}`, qualification, decision,
      b.terminology_ok ? 1 : 0, b.meaning_preserved ? 1 : 0, b.sync_ok ? 1 : 0, str(b.notes, { max: 4000 }));
    const status = { approved: 'approved', changes_requested: 'in_review', rejected: 'rejected' }[decision];
    run("UPDATE translations SET status = ?, released_at = NULL, updated_at = datetime('now') WHERE id = ?", status, t.id);
    audit(ctx.user.id, `translation.review_${decision}`, 'translation', t.id);
    return { ok: true, status };
  }, STAFF);

  r.post('/api/admin/translations/:id/release', async (ctx) => {
    const t = get('SELECT * FROM translations WHERE id = ?', Number(ctx.params.id));
    if (!t) throw notFound();
    const { action, audioMode } = await ctx.json();
    if (action === 'withdraw') {
      run("UPDATE translations SET status = 'withdrawn', released_at = NULL, updated_at = datetime('now') WHERE id = ?", t.id);
      audit(ctx.user.id, 'translation.withdrawn', 'translation', t.id);
      return { ok: true };
    }
    const blockers = translationReleaseBlockers(t, licenseFor(t.course_id));
    if (blockers.length) throw new HttpError(409, 'Release blocked.', { blockers });
    const mode = ['none', 'browser_tts', 'file'].includes(audioMode) ? audioMode : t.audio_mode;
    if (mode === 'file' && !t.audio_file) throw bad('No dubbed audio file attached for this language.');
    run("UPDATE translations SET status = 'released', audio_mode = ?, released_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", mode, t.id);
    audit(ctx.user.id, 'translation.released', 'translation', t.id, { audioMode: mode });
    return { ok: true };
  }, ADMIN);

  r.get('/api/admin/translations/:id/vtt', (ctx) => {
    const t = get('SELECT * FROM translations WHERE id = ?', Number(ctx.params.id));
    if (!t) throw notFound();
    const original = all('SELECT idx, start_sec, end_sec, speaker FROM cues WHERE course_id = ? ORDER BY idx', t.course_id);
    const tr = new Map(all('SELECT idx, text FROM translation_cues WHERE translation_id = ?', t.id).map((x) => [x.idx, x.text]));
    ctx.res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Content-Disposition': `attachment; filename="course-${t.course_id}-${t.language}.vtt"` });
    ctx.res.end(toVtt(original.map((q) => ({ start: q.start_sec, end: q.end_sec, speaker: q.speaker, text: tr.get(q.idx) || '' }))));
  }, STAFF);

  r.get('/api/admin/review-queue', () => all(`SELECT t.id, t.language, t.status, t.provider, t.updated_at, c.title, c.id AS course_id
      FROM translations t JOIN courses c ON c.id = t.course_id WHERE t.status IN ('machine','in_review','approved') ORDER BY t.updated_at`), STAFF);

  // ── glossary ──────────────────────────────────────────────────────────────
  r.get('/api/admin/glossary', () => all('SELECT * FROM glossary ORDER BY term, language'), STAFF);
  r.post('/api/admin/glossary', async (ctx) => {
    const b = await ctx.json();
    if (!LANGUAGE_CODES.has(b.language)) throw bad('Unknown language.');
    run(`INSERT INTO glossary (term, language, translation, note) VALUES (?,?,?,?)
         ON CONFLICT(term, language) DO UPDATE SET translation = excluded.translation, note = excluded.note`,
      str(b.term, { required: true, max: 120, name: 'Term' }), b.language, str(b.translation, { required: true, max: 200, name: 'Translation' }), str(b.note, { max: 300 }));
    return { ok: true };
  }, STAFF);
  r.delete('/api/admin/glossary/:id', (ctx) => { run('DELETE FROM glossary WHERE id = ?', Number(ctx.params.id)); return { ok: true }; }, STAFF);

  // ── taxonomy ──────────────────────────────────────────────────────────────
  r.get('/api/admin/taxonomy', () => ({
    specialties: all('SELECT * FROM specialties ORDER BY name'),
    providers: all('SELECT * FROM providers ORDER BY name'),
    topics: all('SELECT t.*, s.slug AS specialty FROM topics t LEFT JOIN specialties s ON s.id = t.specialty_id ORDER BY t.sort, t.name'),
    focus: launchFocus(),
    launchLanguages: launchLanguages(), launchLanguagesLocked: launchLanguagesLocked(), defaultLaunchLanguages: DEFAULT_LAUNCH_LANGUAGES,
    allLanguages: LANGUAGES.map((l) => ({ code: l.code, name: l.name, native: l.native, region: l.region })),
    focusLocked: process.env.LAUNCH_FOCUS !== undefined,
  }), STAFF);
  // Launch languages: which languages the public can use ('*' = all).
  r.put('/api/admin/launch-languages', async (ctx) => {
    if (launchLanguagesLocked()) throw bad('The launch languages are fixed by the LAUNCH_LANGUAGES environment variable.');
    const b = await ctx.json();
    const value = b.all ? '*' : JSON.stringify((Array.isArray(b.languages) ? b.languages : []).filter((c) => LANGUAGE_CODES.has(c)));
    setSetting('launch_languages', value);
    audit(ctx.user.id, 'catalogue.launch_languages_changed', 'setting', 'launch_languages', { value });
    return { ok: true, launchLanguages: launchLanguages() };
  }, ADMIN);

  // Launch focus: which specialty is public. Empty = the whole catalogue.
  r.put('/api/admin/focus', async (ctx) => {
    if (process.env.LAUNCH_FOCUS !== undefined) throw bad('The launch focus is fixed by the LAUNCH_FOCUS environment variable.');
    const b = await ctx.json();
    const slug = b.specialty ? String(b.specialty) : '';
    if (slug && !get('SELECT 1 FROM specialties WHERE slug = ?', slug)) throw bad('Unknown specialty.');
    setSetting('launch_focus', slug);
    audit(ctx.user.id, 'catalogue.focus_changed', 'setting', 'launch_focus', { specialty: slug || null });
    return { ok: true, focus: slug || null };
  }, ADMIN);
  r.post('/api/admin/specialties', async (ctx) => {
    const b = await ctx.json();
    const name = str(b.name, { required: true, max: 80, name: 'Name' });
    run('INSERT INTO specialties (slug, name, description, icon) VALUES (?,?,?,?)', slugify(name), name, str(b.description, { max: 300 }), 'stethoscope');
    audit(ctx.user.id, 'specialty.created', 'specialty', slugify(name));
    return { ok: true };
  }, ADMIN);
  r.post('/api/admin/topics', async (ctx) => {
    const b = await ctx.json();
    const name = str(b.name, { required: true, max: 80, name: 'Name' });
    const spec = get('SELECT id FROM specialties WHERE slug = ?', String(b.specialty || launchFocus() || 'emergency-medicine'));
    if (!spec) throw bad('Unknown specialty.');
    const accent = /^#[0-9a-fA-F]{6}$/.test(b.accent || '') ? b.accent : '#22D3EE';
    run('INSERT INTO topics (slug, name, description, icon, accent, specialty_id, sort) VALUES (?,?,?,?,?,?,?)', slugify(name), name, str(b.description, { max: 300 }), 'stethoscope', accent, spec.id, get('SELECT COALESCE(MAX(sort),0)+1 AS n FROM topics').n);
    audit(ctx.user.id, 'topic.created', 'topic', slugify(name));
    return { ok: true };
  }, ADMIN);
  r.post('/api/admin/providers', async (ctx) => {
    const b = await ctx.json();
    const name = str(b.name, { required: true, max: 160, name: 'Name' });
    run('INSERT INTO providers (slug, name, country, notes) VALUES (?,?,?,?)', slugify(name), name, str(b.country, { max: 2 }), str(b.notes, { max: 500 }));
    audit(ctx.user.id, 'provider.created', 'provider', slugify(name));
    return { ok: true };
  }, ADMIN);

  // ── users ─────────────────────────────────────────────────────────────────
  r.get('/api/admin/users', (ctx) => {
    const q = `%${(ctx.query.q || '').slice(0, 80)}%`;
    return all(`SELECT u.id, u.email, u.first_name, u.last_name, u.country, u.profession, u.role, u.disabled, u.created_at, u.last_login_at,
        (SELECT status FROM subscriptions s WHERE s.user_id = u.id ORDER BY s.id DESC LIMIT 1) AS subscription_status,
        (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id) AS courses_started
        FROM users u WHERE u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? ORDER BY u.created_at DESC LIMIT 200`, q, q, q);
  }, ADMIN);
  r.patch('/api/admin/users/:id', async (ctx) => {
    const id = Number(ctx.params.id);
    const b = await ctx.json();
    const u = get('SELECT * FROM users WHERE id = ?', id);
    if (!u) throw notFound();
    if (id === ctx.user.id && (b.role !== 'admin' || b.disabled)) throw bad('You cannot remove your own admin access.');
    run('UPDATE users SET role = ?, disabled = ? WHERE id = ?', oneOf(b.role, ['user', 'reviewer', 'admin'], 'Role'), b.disabled ? 1 : 0, id);
    if (b.disabled) run('DELETE FROM sessions WHERE user_id = ?', id);
    audit(ctx.user.id, 'user.updated', 'user', id, { role: b.role, disabled: !!b.disabled });
    return { ok: true };
  }, ADMIN);

  // ── subscriptions & plans ─────────────────────────────────────────────────
  r.get('/api/admin/subscriptions', () => ({
    subscriptions: all(`SELECT s.*, u.email, p.name AS plan_name FROM subscriptions s JOIN users u ON u.id = s.user_id JOIN plans p ON p.id = s.plan_id ORDER BY s.id DESC LIMIT 300`),
    purchases: all(`SELECT pu.*, u.email, c.title FROM purchases pu JOIN users u ON u.id = pu.user_id JOIN courses c ON c.id = pu.course_id ORDER BY pu.id DESC LIMIT 300`),
    invoices: all('SELECT * FROM invoices ORDER BY id DESC LIMIT 300'),
  }), ADMIN);
  r.post('/api/admin/subscriptions/:id/cancel', (ctx) => {
    run("UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = 1, canceled_at = datetime('now') WHERE id = ?", Number(ctx.params.id));
    audit(ctx.user.id, 'subscription.canceled_by_admin', 'subscription', ctx.params.id);
    return { ok: true };
  }, ADMIN);
  r.get('/api/admin/plans', () => all('SELECT * FROM plans ORDER BY sort').map((p) => ({ ...p, features: parseJson(p.features, []) })), ADMIN);
  r.put('/api/admin/plans/:id', async (ctx) => {
    const b = await ctx.json();
    const cents = (v) => { const n = Math.round(Number(v)); if (!(n >= 0) || n > 10_000_000) throw bad('Invalid price.'); return n; };
    run('UPDATE plans SET name = ?, price_eur = ?, price_usd = ?, price_gbp = ?, features = ?, active = ?, highlight = ? WHERE id = ?',
      str(b.name, { required: true, max: 80, name: 'Name' }), cents(b.price_eur), cents(b.price_usd), cents(b.price_gbp),
      JSON.stringify((b.features || []).map((f) => String(f).slice(0, 120)).filter(Boolean).slice(0, 10)), b.active ? 1 : 0, b.highlight ? 1 : 0, Number(ctx.params.id));
    audit(ctx.user.id, 'plan.updated', 'plan', ctx.params.id, b);
    return { ok: true };
  }, ADMIN);

  // ── partners & complaints ────────────────────────────────────────────────
  r.get('/api/admin/partners', () => all('SELECT * FROM partner_inquiries ORDER BY created_at DESC'), ADMIN);
  r.patch('/api/admin/partners/:id', async (ctx) => {
    const b = await ctx.json();
    run('UPDATE partner_inquiries SET status = ?, internal_notes = ? WHERE id = ?',
      oneOf(b.status, ['new', 'contacted', 'negotiating', 'signed', 'declined'], 'Status'), str(b.internal_notes, { max: 4000 }), Number(ctx.params.id));
    audit(ctx.user.id, 'partner.updated', 'partner_inquiry', ctx.params.id, { status: b.status });
    return { ok: true };
  }, ADMIN);
  r.get('/api/admin/complaints', () => all(`SELECT k.*, c.title AS course_title, c.id AS course_ref FROM complaints k LEFT JOIN courses c ON c.id = k.course_id ORDER BY
      CASE k.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, k.created_at DESC`), ADMIN);
  r.patch('/api/admin/complaints/:id', async (ctx) => {
    const b = await ctx.json();
    const k = get('SELECT * FROM complaints WHERE id = ?', Number(ctx.params.id));
    if (!k) throw notFound();
    run("UPDATE complaints SET status = ?, resolution = ?, updated_at = datetime('now') WHERE id = ?",
      oneOf(b.status, ['open', 'in_progress', 'resolved', 'rejected'], 'Status'), str(b.resolution, { max: 4000 }), k.id);
    // Notice-and-takedown: suspend the affected course immediately while a copyright claim is examined.
    if (b.suspendCourse && k.course_id) {
      run("UPDATE courses SET status = 'suspended', updated_at = datetime('now') WHERE id = ?", k.course_id);
      audit(ctx.user.id, 'course.suspended_due_to_complaint', 'course', k.course_id, { complaint: k.id });
    }
    audit(ctx.user.id, 'complaint.updated', 'complaint', k.id, { status: b.status });
    return { ok: true };
  }, ADMIN);

  r.get('/api/admin/outbox', () => all('SELECT id, to_email, subject, kind, status, error, created_at, body_text FROM outbox ORDER BY id DESC LIMIT 200'), ADMIN);
  r.get('/api/admin/audit', () => all(`SELECT a.*, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300`), ADMIN);
}
