import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// Secrets: taken from env in production; generated once and persisted locally for development.
function localSecret(name) {
  const file = path.join(DATA_DIR, '.secrets.json');
  let secrets = {};
  try { secrets = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first run */ }
  if (!secrets[name]) {
    secrets[name] = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  }
  return secrets[name];
}

const env = process.env;
export const config = {
  env: env.NODE_ENV || 'development',
  port: Number(env.PORT || 3000),
  host: env.HOST || '0.0.0.0',
  publicUrl: env.PUBLIC_URL || `http://localhost:${env.PORT || 3000}`,
  dataDir: DATA_DIR,
  dbPath: env.DB_PATH || path.join(DATA_DIR, 'medtranslate.db'),
  publicDir: path.join(ROOT, 'public'),
  mediaDir: env.MEDIA_DIR || path.join(ROOT, 'media'),
  uploadDir: path.join(DATA_DIR, 'uploads'),
  mediaSigningSecret: env.MEDIA_SIGNING_SECRET || localSecret('mediaSigningSecret'),
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : (env.PUBLIC_URL || '').startsWith('https://'),
  sessionDays: 30,
  maxUploadBytes: Number(env.MAX_UPLOAD_MB || 500) * 1024 * 1024,
  adminEmail: env.ADMIN_EMAIL || 'admin@medtranslate.local',
  adminPassword: env.ADMIN_PASSWORD || null,

  // AI translation (Anthropic Claude). Not connected unless a key is configured.
  anthropicApiKey: env.ANTHROPIC_API_KEY || null,
  translationModel: env.TRANSLATION_MODEL || 'claude-opus-5-5',

  // Payments (Stripe). Without a key the platform runs in clearly-labelled demo mode.
  stripeSecretKey: env.STRIPE_SECRET_KEY || null,
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || null,

  // Server-side neural TTS for dubbed audio tracks. Not connected by default.
  ttsProvider: env.TTS_PROVIDER || null,

  // Operator details are deliberately placeholders until real data is supplied.
  operator: {
    name: env.OPERATOR_NAME || '[Firmenname / Rechtsform]',
    address: env.OPERATOR_ADDRESS || '[Straße Hausnummer, PLZ Ort, Land]',
    representative: env.OPERATOR_REPRESENTATIVE || '[Vertretungsberechtigte Person(en)]',
    email: env.OPERATOR_EMAIL || '[kontakt@ihre-domain.tld]',
    phone: env.OPERATOR_PHONE || '[Telefonnummer]',
    register: env.OPERATOR_REGISTER || '[Registergericht, Registernummer]',
    vatId: env.OPERATOR_VAT_ID || '[USt-IdNr. gemäß § 27a UStG]',
    dpo: env.OPERATOR_DPO || '[Datenschutzbeauftragte/r, Kontakt]',
  },
  policyVersion: '2026-11-draft-1',
};
