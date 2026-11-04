import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  country TEXT,
  preferred_language TEXT DEFAULT 'en',
  profession TEXT,
  specialty TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','reviewer','admin')),
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS specialties (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT
);
CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT,
  notes TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '[]',
  specialty_id INTEGER REFERENCES specialties(id),
  secondary_specialty_id INTEGER REFERENCES specialties(id),
  provider_id INTEGER REFERENCES providers(id),
  level TEXT NOT NULL DEFAULT 'intermediate' CHECK (level IN ('foundation','intermediate','advanced')),
  original_language TEXT NOT NULL DEFAULT 'en',
  duration_sec INTEGER NOT NULL DEFAULT 0,
  access TEXT NOT NULL DEFAULT 'subscription' CHECK (access IN ('free','subscription')),
  price_cents INTEGER NOT NULL DEFAULT 0,
  media_file TEXT,
  poster_file TEXT,
  media_has_audio INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','suspended','archived')),
  featured INTEGER NOT NULL DEFAULT 0,
  release_date TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cues (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  start_sec REAL NOT NULL,
  end_sec REAL NOT NULL,
  speaker TEXT,
  text TEXT NOT NULL,
  slide TEXT,
  UNIQUE(course_id, idx)
);
CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
  licensor TEXT NOT NULL,
  contract_ref TEXT,
  right_use INTEGER NOT NULL DEFAULT 0,
  right_translate INTEGER NOT NULL DEFAULT 0,
  right_subtitle INTEGER NOT NULL DEFAULT 0,
  right_ai_audio INTEGER NOT NULL DEFAULT 0,
  right_commercial INTEGER NOT NULL DEFAULT 0,
  right_worldwide INTEGER NOT NULL DEFAULT 0,
  right_storage INTEGER NOT NULL DEFAULT 0,
  territories TEXT NOT NULL DEFAULT '[]',
  languages TEXT NOT NULL DEFAULT '[]',
  term_start TEXT,
  term_end TEXT,
  revenue_share TEXT,
  document_ref TEXT,
  notes TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS accreditations (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_accredited' CHECK (status IN ('not_accredited','pending','accredited','expired')),
  body TEXT,
  credit_amount REAL,
  credit_type TEXT,
  reference TEXT,
  valid_from TEXT,
  valid_until TEXT,
  applies_to_languages TEXT NOT NULL DEFAULT '[]',
  evidence_ref TEXT,
  notes TEXT,
  verified_by INTEGER REFERENCES users(id),
  verified_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS translations (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'machine' CHECK (status IN ('machine','in_review','approved','released','rejected','withdrawn')),
  provider TEXT,
  audio_mode TEXT NOT NULL DEFAULT 'browser_tts' CHECK (audio_mode IN ('none','browser_tts','file')),
  audio_file TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  released_at TEXT,
  UNIQUE(course_id, language)
);
CREATE TABLE IF NOT EXISTS translation_cues (
  translation_id INTEGER NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (translation_id, idx)
);
CREATE TABLE IF NOT EXISTS qc_reviews (
  id INTEGER PRIMARY KEY,
  translation_id INTEGER NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  reviewer_id INTEGER REFERENCES users(id),
  reviewer_label TEXT,
  qualification TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('approved','changes_requested','rejected')),
  terminology_ok INTEGER NOT NULL DEFAULT 0,
  meaning_preserved INTEGER NOT NULL DEFAULT 0,
  sync_ok INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS glossary (
  id INTEGER PRIMARY KEY,
  term TEXT NOT NULL,
  language TEXT NOT NULL,
  translation TEXT NOT NULL,
  note TEXT,
  UNIQUE(term, language)
);
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position_sec REAL NOT NULL DEFAULT 0,
  max_position_sec REAL NOT NULL DEFAULT 0,
  percent REAL NOT NULL DEFAULT 0,
  last_language TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  PRIMARY KEY (user_id, course_id)
);
CREATE TABLE IF NOT EXISTS saved_courses (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, course_id)
);
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'completion' CHECK (kind IN ('completion','cme')),
  credit_amount REAL,
  credit_type TEXT,
  accreditation_body TEXT,
  language TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  interval TEXT NOT NULL CHECK (interval IN ('month','year','custom')),
  price_eur INTEGER NOT NULL DEFAULT 0,
  price_usd INTEGER NOT NULL DEFAULT 0,
  price_gbp INTEGER NOT NULL DEFAULT 0,
  features TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  highlight INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL CHECK (status IN ('active','canceled','expired','pending')),
  currency TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  canceled_at TEXT,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  withdrawal_waiver_at TEXT
);
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  currency TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  provider TEXT NOT NULL,
  provider_ref TEXT,
  withdrawal_waiver_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  currency TEXT NOT NULL,
  net_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  gross_cents INTEGER NOT NULL,
  tax_rate REAL NOT NULL,
  tax_country TEXT,
  billing_name TEXT,
  billing_email TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS partner_inquiries (
  id INTEGER PRIMARY KEY,
  organisation TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT,
  org_type TEXT,
  catalogue_size TEXT,
  target_languages TEXT,
  interests TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','negotiating','signed','declined')),
  internal_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('copyright','privacy','medical_content','translation_error','legal','contract_cancellation','general')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organisation TEXT,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  reference_url TEXT,
  description TEXT NOT NULL,
  good_faith INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','rejected')),
  resolution TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS consent_log (
  id INTEGER PRIMARY KEY,
  consent_id TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  categories TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_translations_course ON translations(course_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;
db.exec(SCHEMA);

// ── small helpers ────────────────────────────────────────────────────────────
const cache = new Map();
function stmt(sql) {
  let s = cache.get(sql);
  if (!s) { s = db.prepare(sql); cache.set(sql, s); }
  return s;
}
export const get = (sql, ...p) => stmt(sql).get(...p);
export const all = (sql, ...p) => stmt(sql).all(...p);
export const run = (sql, ...p) => stmt(sql).run(...p);

export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

export const parseJson = (v, fallback) => { try { return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };

export function audit(userId, action, entity, entityId, details) {
  run('INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES (?,?,?,?,?)',
    userId ?? null, action, entity ?? null, entityId == null ? null : String(entityId),
    details == null ? null : JSON.stringify(details));
}

export function getSetting(key, fallback = null) {
  const r = get('SELECT value FROM settings WHERE key = ?', key);
  return r ? parseJson(r.value, fallback) : fallback;
}
export function setSetting(key, value) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
}
