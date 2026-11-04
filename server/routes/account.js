import { get, all, run, tx, audit, parseJson } from '../db.js';
import { hashPassword, verifyPassword, verifyAgainstDummy, validatePassword, createSession, destroySession, publicUser } from '../auth.js';
import { LANGUAGE_CODES, COUNTRY_CODES, PROFESSIONS } from '../languages.js';
import { courseCard, loadCourseById } from '../catalog.js';
import { cancelProviderSubscription } from '../services/payments.js';
import { HttpError, bad, str, email, rateLimit } from '../http.js';

function profileFields(b, { requireNames }) {
  const out = {
    first_name: str(b.firstName, { required: requireNames, max: 80, name: 'First name' }),
    last_name: str(b.lastName, { required: requireNames, max: 80, name: 'Last name' }),
    country: b.country ? String(b.country).toUpperCase() : null,
    preferred_language: b.preferredLanguage || 'en',
    profession: b.profession || null,
    specialty: str(b.specialty, { max: 80 }),
  };
  if (out.country && !COUNTRY_CODES.has(out.country)) throw bad('Unknown country.');
  if (!LANGUAGE_CODES.has(out.preferred_language)) throw bad('Unknown language.');
  if (out.profession && !PROFESSIONS.includes(out.profession)) throw bad('Unknown profession.');
  return out;
}

export function registerAccountRoutes(r) {
  r.post('/api/auth/register', async (ctx) => {
    rateLimit(`register:${ctx.ip}`, 10, 3600_000);
    const b = await ctx.json();
    const mail = email(b.email);
    const pwErr = validatePassword(b.password);
    if (pwErr) throw bad(pwErr);
    if (!b.acceptTerms) throw bad('Please accept the terms of use and acknowledge the privacy policy.');
    if (!b.confirmProfessional) throw bad('Please confirm that you are a healthcare professional or student.');
    const f = profileFields(b, { requireNames: true });
    if (get('SELECT 1 FROM users WHERE email = ?', mail)) throw bad('An account with this e-mail already exists.');
    const res = run(`INSERT INTO users (email, password_hash, first_name, last_name, country, preferred_language, profession, specialty)
        VALUES (?,?,?,?,?,?,?,?)`, mail, hashPassword(b.password), f.first_name, f.last_name, f.country, f.preferred_language, f.profession, f.specialty);
    const id = Number(res.lastInsertRowid);
    audit(id, 'user.registered', 'user', id);
    createSession(ctx.res, id);
    return { user: publicUser(get('SELECT * FROM users WHERE id = ?', id)) };
  });

  r.post('/api/auth/login', async (ctx) => {
    rateLimit(`login:${ctx.ip}`, 20, 15 * 60_000);
    const b = await ctx.json();
    const mail = String(b.email || '').trim().toLowerCase();
    rateLimit(`login-acct:${mail}`, 10, 15 * 60_000);
    const u = get('SELECT * FROM users WHERE email = ?', mail);
    const ok = u ? verifyPassword(String(b.password || ''), u.password_hash) : verifyAgainstDummy(String(b.password || ''));
    if (!u || !ok || u.disabled) throw new HttpError(401, 'E-mail or password is incorrect.');
    createSession(ctx.res, u.id);
    audit(u.id, 'user.login', 'user', u.id);
    return { user: publicUser(u) };
  });

  r.post('/api/auth/logout', (ctx) => { destroySession(ctx.req, ctx.res); return { ok: true }; });
  r.get('/api/auth/me', (ctx) => ({ user: publicUser(ctx.user) }));

  r.patch('/api/account/profile', async (ctx) => {
    const b = await ctx.json();
    const f = profileFields(b, { requireNames: true });
    run(`UPDATE users SET first_name = ?, last_name = ?, country = ?, preferred_language = ?, profession = ?, specialty = ? WHERE id = ?`,
      f.first_name, f.last_name, f.country, f.preferred_language, f.profession, f.specialty, ctx.user.id);
    return { user: publicUser(get('SELECT * FROM users WHERE id = ?', ctx.user.id)) };
  }, { auth: true });

  r.post('/api/account/password', async (ctx) => {
    rateLimit(`pw:${ctx.user.id}`, 10, 3600_000);
    const b = await ctx.json();
    if (!verifyPassword(String(b.currentPassword || ''), ctx.user.password_hash)) throw bad('Current password is incorrect.');
    const pwErr = validatePassword(b.newPassword);
    if (pwErr) throw bad(pwErr);
    run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(b.newPassword), ctx.user.id);
    run('DELETE FROM sessions WHERE user_id = ?', ctx.user.id);
    createSession(ctx.res, ctx.user.id);
    audit(ctx.user.id, 'user.password_changed', 'user', ctx.user.id);
    return { ok: true };
  }, { auth: true });

  r.get('/api/account/dashboard', (ctx) => {
    const uid = ctx.user.id;
    const progress = all(`SELECT p.*, c.id AS cid FROM progress p JOIN courses c ON c.id = p.course_id WHERE p.user_id = ? ORDER BY p.updated_at DESC`, uid)
      .map((p) => {
        const c = loadCourseById(p.course_id);
        return { course: courseCard(c, ctx.user), percent: p.percent, position: p.position_sec, startedAt: p.started_at,
          updatedAt: p.updated_at, completedAt: p.completed_at, lastLanguage: p.last_language, available: c.status === 'published' };
      });
    const saved = all('SELECT course_id FROM saved_courses WHERE user_id = ? ORDER BY created_at DESC', uid)
      .map((s) => loadCourseById(s.course_id)).filter((c) => c && c.status === 'published').map((c) => courseCard(c, ctx.user));
    const certificates = all(`SELECT ce.id, ce.kind, ce.issued_at, ce.credit_amount, ce.credit_type, ce.language, c.title, c.slug
        FROM certificates ce JOIN courses c ON c.id = ce.course_id WHERE ce.user_id = ? ORDER BY ce.issued_at DESC`, uid);
    const subscription = get(`SELECT s.*, p.name AS plan_name, p.code AS plan_code, p.interval FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.user_id = ? ORDER BY s.id DESC LIMIT 1`, uid);
    const purchases = all(`SELECT pu.*, c.title, c.slug FROM purchases pu JOIN courses c ON c.id = pu.course_id WHERE pu.user_id = ? ORDER BY pu.created_at DESC`, uid);
    const invoices = all('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC', uid);
    return {
      user: publicUser(ctx.user),
      inProgress: progress.filter((p) => !p.completedAt),
      completed: progress.filter((p) => p.completedAt),
      history: progress,
      saved, certificates, subscription, purchases, invoices,
      stats: {
        started: progress.length,
        completed: progress.filter((p) => p.completedAt).length,
        watchedSec: Math.round(all('SELECT max_position_sec FROM progress WHERE user_id = ?', uid).reduce((s, x) => s + x.max_position_sec, 0)),
      },
    };
  }, { auth: true });

  // GDPR Art. 15 / 20 — machine-readable export of all personal data.
  r.get('/api/account/export', (ctx) => {
    const uid = ctx.user.id;
    const data = {
      exportedAt: new Date().toISOString(),
      notice: 'Personal data export pursuant to Art. 15 and Art. 20 GDPR.',
      profile: publicUser(ctx.user),
      progress: all('SELECT c.slug, p.position_sec, p.percent, p.last_language, p.started_at, p.updated_at, p.completed_at FROM progress p JOIN courses c ON c.id = p.course_id WHERE p.user_id = ?', uid),
      savedCourses: all('SELECT c.slug, s.created_at FROM saved_courses s JOIN courses c ON c.id = s.course_id WHERE s.user_id = ?', uid),
      certificates: all('SELECT id, kind, issued_at, language FROM certificates WHERE user_id = ?', uid),
      subscriptions: all('SELECT status, currency, amount_cents, started_at, current_period_end, canceled_at, provider FROM subscriptions WHERE user_id = ?', uid),
      purchases: all('SELECT course_id, currency, amount_cents, status, created_at FROM purchases WHERE user_id = ?', uid),
      invoices: all('SELECT number, description, currency, gross_cents, created_at FROM invoices WHERE user_id = ?', uid),
      consents: all('SELECT categories, policy_version, created_at FROM consent_log WHERE user_id = ?', uid).map((c) => ({ ...c, categories: parseJson(c.categories, {}) })),
      requests: all('SELECT type, status, created_at FROM complaints WHERE user_id = ?', uid),
    };
    ctx.res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="medtranslate-data-export.json"',
      'Cache-Control': 'no-store',
    });
    ctx.res.end(JSON.stringify(data, null, 2));
    audit(uid, 'user.data_exported', 'user', uid);
    return undefined;
  }, { auth: true });

  // GDPR Art. 17 — account deletion. Invoices are retained (anonymised link) for statutory retention (§ 147 AO / § 257 HGB).
  r.delete('/api/account', async (ctx) => {
    const b = await ctx.json();
    if (!verifyPassword(String(b.password || ''), ctx.user.password_hash)) throw bad('Password is incorrect.');
    if (ctx.user.role === 'admin' && get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").n <= 1) {
      throw bad('The last administrator account cannot be deleted.');
    }
    const uid = ctx.user.id;
    tx(() => {
      for (const s of all("SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active'", uid)) {
        cancelProviderSubscription(s).catch(() => {});
      }
      run('UPDATE invoices SET user_id = NULL WHERE user_id = ?', uid);
      run('UPDATE complaints SET user_id = NULL WHERE user_id = ?', uid);
      run('DELETE FROM users WHERE id = ?', uid);
    });
    audit(null, 'user.deleted', 'user', uid);
    destroySession(ctx.req, ctx.res);
    return { ok: true };
  }, { auth: true });
}
