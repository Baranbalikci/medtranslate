import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, get, run, tx, getSetting, setSetting } from './db.js';
import { config } from './config.js';
import { hashPassword } from './auth.js';
import { SPECIALTIES, PROVIDERS, PLANS, COURSES, GLOSSARY, TOPICS, COURSE_TOPIC } from './seed-data.js';
import { AFRICAN_TRANSLATIONS } from './seed-africa.js';
import { SHOWCASE_TRANSLATIONS } from './seed-showcase.js';

export function seedIfEmpty() {
  const hasData = get('SELECT COUNT(*) AS n FROM specialties').n > 0;
  migrate();
  if (!hasData) seedCatalog();
  ensureDemoAfricanTranslations();
  applyAudioManifest();
  ensureAdmin();
}

function seedCatalog() {
  tx(() => {
    for (const [slug, name, description, icon] of SPECIALTIES) {
      run('INSERT INTO specialties (slug, name, description, icon) VALUES (?,?,?,?)', slug, name, description, icon);
    }
    const emergencyId = get("SELECT id FROM specialties WHERE slug = 'emergency-medicine'").id;
    TOPICS.forEach(([slug, name, description, icon, accent], i) => run('INSERT INTO topics (slug, name, description, icon, accent, specialty_id, sort) VALUES (?,?,?,?,?,?,?)', slug, name, description, icon, accent, emergencyId, i));
    for (const [slug, name, country, notes] of PROVIDERS) {
      run('INSERT INTO providers (slug, name, country, notes, is_demo) VALUES (?,?,?,?,1)', slug, name, country, notes);
    }
    for (const p of PLANS) {
      run('INSERT INTO plans (code, name, interval, price_eur, price_usd, price_gbp, features, highlight, sort) VALUES (?,?,?,?,?,?,?,?,?)',
        p.code, p.name, p.interval, p.eur, p.usd, p.gbp, JSON.stringify(p.features), p.highlight ? 1 : 0, p.sort);
    }
    for (const [term, language, translation, note] of GLOSSARY) {
      run('INSERT INTO glossary (term, language, translation, note) VALUES (?,?,?,?)', term, language, translation, note);
    }

    const spec = (slug) => get('SELECT id FROM specialties WHERE slug = ?', slug)?.id ?? null;
    const prov = (slug) => get('SELECT id FROM providers WHERE slug = ?', slug).id;

    for (const c of COURSES) {
      const duration = Math.ceil(c.cues.at(-1)[1] + 3);
      const r = run(`INSERT INTO courses (slug, title, description, objectives, specialty_id, secondary_specialty_id, provider_id, level,
          original_language, duration_sec, access, price_cents, media_file, poster_file, media_has_audio, status, featured, release_date, is_demo)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,1)`,
        c.slug, c.title, c.description, JSON.stringify(c.objectives), spec(c.specialty), c.extraSpecialty ? spec(c.extraSpecialty) : null,
        prov(c.provider), c.level, 'en', duration, c.access, c.price, `videos/${c.slug}.mp4`, `posters/${c.slug}.jpg`,
        c.draft ? 'draft' : 'published', c.featured ? 1 : 0, c.published);
      const courseId = Number(r.lastInsertRowid);
      if (COURSE_TOPIC[c.slug]) run('UPDATE courses SET topic_id = (SELECT id FROM topics WHERE slug = ?) WHERE id = ?', COURSE_TOPIC[c.slug], courseId);

      c.cues.forEach(([start, end, speaker, text, slide], idx) => {
        run('INSERT INTO cues (course_id, idx, start_sec, end_sec, speaker, text, slide) VALUES (?,?,?,?,?,?,?)',
          courseId, idx, start, end, speaker, text, slide);
      });

      const langs = Object.keys(c.translations);
      run(`INSERT INTO licenses (course_id, licensor, contract_ref, right_use, right_translate, right_subtitle, right_ai_audio,
          right_commercial, right_worldwide, right_storage, territories, languages, term_start, term_end, revenue_share, document_ref, notes, is_demo)
          VALUES (?,?,?,1,1,1,1,?,?,1,?,?,?,?,?,?,?,1)`,
        courseId, get('SELECT name FROM providers WHERE id = ?', prov(c.provider)).name, `DEMO-${String(courseId).padStart(4, '0')}`,
        c.incompleteLicense ? 0 : 1, c.territory.includes('*') ? 1 : 0, JSON.stringify(c.territory), JSON.stringify(['en', ...langs, ...(c.incompleteLicense ? ['de', 'fr'] : [])]),
        '2026-01-01', '2028-12-31', 'DEMO – no real agreement', null,
        'Demo record. No real licence agreement exists for this content.');

      run(`INSERT INTO accreditations (course_id, status, notes) VALUES (?, 'not_accredited', ?)`, courseId,
        'Demo course. No CME/CPD accreditation has been applied for or granted.');

      for (const lang of langs) {
        const t = run(`INSERT INTO translations (course_id, language, status, provider, audio_mode, released_at)
            VALUES (?,?,?,?, 'browser_tts', datetime('now'))`, courseId, lang, 'released', 'seed-sample');
        const tid = Number(t.lastInsertRowid);
        c.translations[lang].forEach((text, idx) => run('INSERT INTO translation_cues (translation_id, idx, text) VALUES (?,?,?)', tid, idx, text));
        run(`INSERT INTO qc_reviews (translation_id, reviewer_label, qualification, decision, terminology_ok, meaning_preserved, sync_ok, notes, is_demo)
            VALUES (?, 'Demo seed (no reviewer)', 'n/a', 'approved', 1, 1, 1, ?, 1)`, tid,
          'Placeholder QC record created by seed script. This translation has NOT been reviewed by a medical professional.');
      }
    }
  });
  console.log('[seed] Demo catalogue created.');
}

// Schema migrations for databases created by earlier versions.
function migrate() {
  const cols = db.prepare('PRAGMA table_info(licenses)').all().map((c) => c.name);
  if (!cols.includes('allow_live_ai')) db.exec('ALTER TABLE licenses ADD COLUMN allow_live_ai INTEGER NOT NULL DEFAULT 0');
  const ccols = db.prepare('PRAGMA table_info(courses)').all().map((c) => c.name);
  if (!ccols.includes('topic_id')) db.exec('ALTER TABLE courses ADD COLUMN topic_id INTEGER REFERENCES topics(id)');
  if (!get("SELECT 1 FROM settings WHERE key = 'demo_topics_v1'") && get("SELECT 1 FROM specialties WHERE slug = 'emergency-medicine'")) {
    const emergencyId = get("SELECT id FROM specialties WHERE slug = 'emergency-medicine'").id;
    TOPICS.forEach(([slug, name, description, icon, accent], i) => run('INSERT OR IGNORE INTO topics (slug, name, description, icon, accent, specialty_id, sort) VALUES (?,?,?,?,?,?,?)', slug, name, description, icon, accent, emergencyId, i));
    for (const [slug, topic] of Object.entries(COURSE_TOPIC)) run('UPDATE courses SET topic_id = (SELECT id FROM topics WHERE slug = ?) WHERE slug = ? AND is_demo = 1', topic, slug);
    setSetting('demo_topics_v1', true);
  }
  // One-time: launch with emergency medicine only, and file the emergency-relevant demo courses under it.
  if (!get("SELECT 1 FROM settings WHERE key = 'launch_focus'")) setSetting('launch_focus', 'emergency-medicine');
  if (!get("SELECT 1 FROM settings WHERE key = 'demo_mapping_emergency_v1'") && get('SELECT 1 FROM specialties LIMIT 1')) {
    const map = { 'acs-early-ecg-recognition': 'cardiology', 'stroke-first-60-minutes': 'neurology', 'sepsis-hour-one': 'intensive-care',
      'rapid-sequence-induction-checklist': 'anesthesiology', 'upper-gi-bleeding-initial-management': 'gastroenterology',
      'red-eye-when-to-refer': 'ophthalmology', 'chest-xray-systematic-reading': 'radiology', 'pediatric-fever-without-source': 'pediatrics' };
    const id = (slug) => get('SELECT id FROM specialties WHERE slug = ?', slug)?.id ?? null;
    for (const [slug, sec] of Object.entries(map)) {
      run('UPDATE courses SET specialty_id = ?, secondary_specialty_id = ? WHERE slug = ? AND is_demo = 1', id('emergency-medicine'), id(sec), slug);
    }
    setSetting('demo_mapping_emergency_v1', true);
  }
}

// Adds the sample Kiswahili / Hausa / Amharic translations to demo courses (idempotent).
function ensureDemoAfricanTranslations() {
  tx(() => {
    for (const [slug, langs] of [...Object.entries(AFRICAN_TRANSLATIONS), ...Object.entries(SHOWCASE_TRANSLATIONS)]) {
      const course = get('SELECT id FROM courses WHERE slug = ? AND is_demo = 1', slug);
      if (!course) continue;
      const lic = get('SELECT id, languages, is_demo FROM licenses WHERE course_id = ?', course.id);
      if (lic?.is_demo) {
        const set = new Set(JSON.parse(lic.languages));
        Object.keys(langs).forEach((l) => set.add(l));
        run('UPDATE licenses SET languages = ?, allow_live_ai = 1 WHERE id = ?', JSON.stringify([...set]), lic.id);
      }
      for (const [lang, texts] of Object.entries(langs)) {
        if (get('SELECT 1 FROM translations WHERE course_id = ? AND language = ?', course.id, lang)) continue;
        const tid = Number(run(`INSERT INTO translations (course_id, language, status, provider, audio_mode, released_at)
            VALUES (?,?, 'released', 'seed-sample', 'browser_tts', datetime('now'))`, course.id, lang).lastInsertRowid);
        texts.forEach((text, idx) => run('INSERT INTO translation_cues (translation_id, idx, text) VALUES (?,?,?)', tid, idx, text));
        run(`INSERT INTO qc_reviews (translation_id, reviewer_label, qualification, decision, terminology_ok, meaning_preserved, sync_ok, notes, is_demo)
            VALUES (?, 'Demo seed (no reviewer)', 'n/a', 'approved', 1, 1, 1, ?, 1)`, tid,
          'Placeholder QC record created by seed script. This translation has NOT been reviewed by a medical professional.');
      }
    }
    // Demo licences allow live AI subtitles so the feature can be tried.
    run('UPDATE licenses SET allow_live_ai = 1 WHERE is_demo = 1');
  });
}

// Uses the generated AI voice tracks (tools/audio/generate_audio.py) for demo courses.
function applyAudioManifest() {
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(config.mediaDir, 'audio', 'manifest.json'), 'utf8')); } catch { return; }
  tx(() => {
    for (const [slug, m] of Object.entries(manifest)) {
      const course = get('SELECT id FROM courses WHERE slug = ? AND is_demo = 1', slug);
      if (!course) continue;
      if (m.original) run('UPDATE courses SET media_has_audio = 1 WHERE id = ?', course.id);
      for (const lang of m.languages || []) {
        const file = `audio/${slug}/${lang}.m4a`;
        if (!fs.existsSync(path.join(config.mediaDir, file))) continue;
        run("UPDATE translations SET audio_mode = 'file', audio_file = ? WHERE course_id = ? AND language = ?", file, course.id, lang);
      }
    }
  });
}

function ensureAdmin() {
  if (get("SELECT id FROM users WHERE role = 'admin'")) return;
  const password = config.adminPassword || crypto.randomBytes(9).toString('base64url');
  run(`INSERT INTO users (email, password_hash, first_name, last_name, country, role) VALUES (?,?,?,?,?, 'admin')`,
    config.adminEmail, hashPassword(password), 'Platform', 'Admin', 'DE');
  console.log('\n┌──────────────────────────────────────────────────────────────');
  console.log('│ Admin account created');
  console.log(`│   E-mail:   ${config.adminEmail}`);
  console.log(`│   Password: ${config.adminPassword ? '(from ADMIN_PASSWORD)' : password}`);
  console.log('│ Change it after first login (Account → Settings).');
  console.log('└──────────────────────────────────────────────────────────────\n');
}

export { db };
