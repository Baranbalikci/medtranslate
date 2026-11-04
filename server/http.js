import { userFromRequest } from './auth.js';

export class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
export const bad = (msg, details) => new HttpError(400, msg, details);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const forbidden = (msg = 'Forbidden') => new HttpError(403, msg);
export const unauthorized = (msg = 'Please sign in.') => new HttpError(401, msg);

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

export async function readBody(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request body too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { throw bad('Invalid JSON body.'); }
}

// ── tiny router ──────────────────────────────────────────────────────────────
export class Router {
  routes = [];
  add(method, pattern, handler, opts = {}) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    this.routes.push({ method, re, keys, handler, opts });
  }
  get(p, h, o) { this.add('GET', p, h, o); }
  post(p, h, o) { this.add('POST', p, h, o); }
  put(p, h, o) { this.add('PUT', p, h, o); }
  patch(p, h, o) { this.add('PATCH', p, h, o); }
  delete(p, h, o) { this.add('DELETE', p, h, o); }

  match(method, pathname) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}

/** Builds a request context; auth guards are declared per route via opts. */
export function context(req, res, url, params) {
  const user = userFromRequest(req);
  return {
    req, res, url, params, user,
    query: Object.fromEntries(url.searchParams),
    ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress,
    json: () => readJson(req),
  };
}

export function guard(ctx, opts) {
  if (opts.auth && !ctx.user) throw unauthorized();
  if (opts.roles && (!ctx.user || !opts.roles.includes(ctx.user.role))) {
    throw ctx.user ? forbidden('You do not have permission for this action.') : unauthorized();
  }
}

// ── rate limiting (in-memory, per process) ──────────────────────────────────
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.count += 1;
  if (b.count > max) throw new HttpError(429, 'Too many requests. Please wait a moment and try again.');
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k); }, 60_000).unref();

// ── validation helpers ──────────────────────────────────────────────────────
export function str(v, { max = 500, required = false, name = 'Field' } = {}) {
  if (v == null || v === '') { if (required) throw bad(`${name} is required.`); return null; }
  if (typeof v !== 'string') throw bad(`${name} must be text.`);
  const s = v.trim();
  if (required && !s) throw bad(`${name} is required.`);
  if (s.length > max) throw bad(`${name} is too long (max ${max} characters).`);
  return s;
}
export function email(v) {
  const s = str(v, { max: 254, required: true, name: 'E-mail' }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad('Please enter a valid e-mail address.');
  return s;
}
export function oneOf(v, allowed, name = 'Value') {
  if (!allowed.includes(v)) throw bad(`${name} is invalid.`);
  return v;
}
export function isoDate(v, name = 'Date') {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad(`${name} must be YYYY-MM-DD.`);
  return v;
}
