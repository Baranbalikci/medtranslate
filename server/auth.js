import crypto from 'node:crypto';
import { get, run } from './db.js';
import { config } from './config.js';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const SESSION_COOKIE = 'mt_session';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [algo, N, r, p, saltB64, hashB64] = stored.split('$');
    if (algo !== 'scrypt') return false;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(expected, actual);
  } catch { return false; }
}

// Dummy hash so failed logins for unknown e-mails take the same time as wrong passwords.
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));
export const verifyAgainstDummy = (password) => verifyPassword(password, DUMMY_HASH);

export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Password must be at least 10 characters.';
  if (pw.length > 200) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain letters and numbers.';
  return null;
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 864e5);
  run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)', sha256(token), userId, expires.toISOString());
  run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", userId);
  setCookie(res, SESSION_COOKIE, token, { maxAge: config.sessionDays * 86400 });
}

export function destroySession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  setCookie(res, SESSION_COOKIE, '', { maxAge: 0 });
}

export function userFromRequest(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const row = get(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                   WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0`, sha256(token), new Date().toISOString());
  return row || null;
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name, country: u.country,
    preferredLanguage: u.preferred_language, profession: u.profession, specialty: u.specialty, role: u.role,
    createdAt: u.created_at,
  };
}

export function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore malformed */ }
  }
  return out;
}

export function setCookie(res, name, value, { maxAge, httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (httpOnly) parts.push('HttpOnly');
  if (config.cookieSecure) parts.push('Secure');
  if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [prev] : []), parts.join('; ')]);
}

export function purgeExpiredSessions() {
  run('DELETE FROM sessions WHERE expires_at <= ?', new Date().toISOString());
}
