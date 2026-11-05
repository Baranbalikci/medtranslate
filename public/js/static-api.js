// In-browser stand-in for the MedTranslate API, used only by the self-contained
// static demo (see tools/build-static.mjs). Catalogue data is a snapshot of the
// real server; accounts, progress and demo purchases live in this browser only.
// Admin and server-side integrations are not available here.
/* global MT_SNAPSHOT */
export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

const SNAP = MT_SNAPSHOT;
const KEY = 'mt_static_demo_v1';
let mem = null;
function load() {
  if (mem) return mem;
  try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { mem = null; }
  mem ||= { users: [], session: null, progress: {}, saved: {}, subs: {}, purchases: {}, invoices: {}, certs: {}, seq: 1 };
  return mem;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* storage unavailable: keep in memory */ } }

const err = (status, msg, details) => { throw new ApiError(status, msg, details); };
const now = () => new Date().toISOString();
const me = () => { const s = load(); return s.users.find((u) => u.id === s.session) || null; };
const pub = (u) => u && ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, country: u.country, preferredLanguage: u.preferredLanguage, profession: u.profession, specialty: u.specialty, role: 'user', createdAt: u.createdAt });
const course = (slug) => SNAP.courses[slug] || err(404, 'Course not found.');
const VAT = { DE: 19, AT: 20, BE: 21, CZ: 21, DK: 25, ES: 21, FI: 25.5, FR: 20, GR: 24, IE: 23, IT: 22, NL: 21, PL: 23, PT: 23, SE: 25 };

function territoryOk(c, u) { return c.territory[0] === '*' || (!!u?.country && c.territory.includes(u.country)); }
function entitlement(c, u) {
  if (c.access === 'free') return { full: true, reason: 'free' };
  if (!u) return { full: false, reason: 'login_required' };
  const s = load(); const sub = s.subs[u.id];
  if (sub && sub.current_period_end > now()) return { full: true, reason: 'subscription' };
  if ((s.purchases[u.id] || []).some((p) => p.slug === c.slug)) return { full: true, reason: 'purchase' };
  return { full: false, reason: 'subscription_required' };
}
const previewLimit = (c) => Math.min(Math.round(c.durationSec * 0.3), 120);
function card(c, u) { const { cues, tracks, objectives, chapters, speakers, licenseSummary, ...rest } = c; return { ...rest, availableInYourCountry: territoryOk(c, u) }; }

const videoBlobs = new Map();
async function mediaUrl(path) {
  // Same-origin fetch → blob URL works inside sandboxed frames.
  if (!videoBlobs.has(path)) videoBlobs.set(path, fetch(path).then((r) => { if (!r.ok) throw new Error(); return r.blob(); }).then((b) => URL.createObjectURL(b)));
  try { return await videoBlobs.get(path); } catch { videoBlobs.delete(path); return path; }
}

// The player resolves separately delivered audio tracks through this hook (blob URLs work in sandboxed frames).
window.MT_RESOLVE_MEDIA = mediaUrl;

function invoice(u, description, currency, gross) {
  const s = load(); const rate = VAT[u.country] ?? 0; const net = Math.round(gross / (1 + rate / 100));
  const list = (s.invoices[u.id] ||= []);
  const all = Object.values(s.invoices).flat().length;
  list.unshift({ number: `DEMO-MT-${new Date().getFullYear()}-${String(all + 1).padStart(6, '0')}`, description, currency, net_cents: net, tax_cents: gross - net, gross_cents: gross, tax_rate: rate, created_at: now(), is_demo: 1 });
}
const addPeriod = (interval) => { const d = new Date(); if (interval === 'year') d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1); return d.toISOString(); };

function quote(q, u) {
  const currency = ['EUR', 'USD', 'GBP'].includes(q.currency) ? q.currency : 'EUR';
  const col = { EUR: 'price_eur', USD: 'price_usd', GBP: 'price_gbp' }[currency];
  let item;
  if (q.plan) {
    const p = SNAP.meta.plans.find((x) => x.code === q.plan);
    if (!p || p.interval === 'custom') err(400, 'This plan cannot be purchased online. Please contact us.');
    item = { kind: 'subscription', ref: p.code, name: p.name, amount: p[col], interval: p.interval, features: p.features };
  } else if (q.course) {
    const c = course(q.course);
    if (c.access === 'free' || !c.priceCents) err(400, 'This course cannot be purchased individually.');
    const rate = { EUR: 1, USD: 1.1, GBP: 0.87 }[currency];
    item = { kind: 'course', ref: c.slug, name: c.title, amount: currency === 'EUR' ? c.priceCents : Math.round((c.priceCents * rate) / 100) * 100 - 1 };
  } else err(400, 'Nothing to purchase.');
  const rate = VAT[u?.country] ?? 0; const net = Math.round(item.amount / (1 + rate / 100));
  return { ...item, currency, mode: 'demo', tax: { rate, net, tax: item.amount - net, note: VAT[u?.country] != null ? 'EU VAT (OSS) — indicative' : 'No VAT calculated for this country — requires tax review' } };
}

function dashboard(u) {
  const s = load();
  const prog = Object.entries(s.progress[u.id] || {}).map(([slug, p]) => ({ course: card(course(slug), u), percent: p.percent, position: p.position, startedAt: p.startedAt, updatedAt: p.updatedAt, completedAt: p.completedAt, lastLanguage: p.lastLanguage, available: true }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sub = s.subs[u.id];
  const plan = sub && SNAP.meta.plans.find((p) => p.code === sub.plan);
  return {
    user: pub(u), inProgress: prog.filter((p) => !p.completedAt), completed: prog.filter((p) => p.completedAt), history: prog,
    saved: (s.saved[u.id] || []).map((slug) => card(course(slug), u)),
    certificates: Object.values(s.certs).filter((c) => c.userId === u.id).map((c) => ({ id: c.id, kind: 'completion', issued_at: c.issuedAt, language: c.language, title: course(c.slug).title, slug: c.slug })),
    subscription: sub ? { ...sub, plan_name: plan?.name, interval: plan?.interval } : null,
    purchases: (s.purchases[u.id] || []).map((p) => ({ ...p, title: course(p.slug).title })),
    invoices: s.invoices[u.id] || [],
    stats: { started: prog.length, completed: prog.filter((p) => p.completedAt).length, watchedSec: Math.round(prog.reduce((a, p) => a + (p.max || 0), 0)) },
  };
}

function validPw(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Password must be at least 10 characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain letters and numbers.';
  return null;
}
// Demo only: a simple digest so passwords are not stored in clear text in localStorage.
async function digest(s) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mt-demo:' + s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  catch { return 'plain:' + s; }
}

async function handle(method, path, body) {
  const url = new URL(path, 'http://x');
  const p = url.pathname; const q = Object.fromEntries(url.searchParams);
  const u = me(); const s = load();
  let m;
  if (p.startsWith('/api/admin')) err(403, 'The admin dashboard is only available in the full server version of MedTranslate.');
  if (method === 'GET' && p === '/api/meta') return SNAP.meta;
  if (method === 'GET' && p === '/api/auth/me') return { user: pub(u) };
  if (method === 'GET' && p === '/api/legal/operator') return SNAP.operator;

  if (method === 'GET' && p === '/api/courses') {
    let list = Object.values(SNAP.courses).map((c) => card(c, u));
    if (q.specialty) list = list.filter((c) => c.specialty?.slug === q.specialty || c.secondarySpecialty?.slug === q.specialty);
    if (q.language) list = list.filter((c) => c.languages.includes(q.language));
    if (q.provider) list = list.filter((c) => c.provider.slug === q.provider);
    if (q.level) list = list.filter((c) => c.level === q.level);
    if (q.accreditation === 'accredited') list = list.filter((c) => c.accreditation.status === 'accredited');
    if (q.accreditation === 'not_accredited') list = list.filter((c) => c.accreditation.status !== 'accredited');
    if (q.access === 'free') list = list.filter((c) => c.access === 'free');
    if (q.duration === 'short') list = list.filter((c) => c.durationSec < 900);
    if (q.duration === 'medium') list = list.filter((c) => c.durationSec >= 900 && c.durationSec <= 2700);
    if (q.duration === 'long') list = list.filter((c) => c.durationSec > 2700);
    if (q.since) list = list.filter((c) => (c.releaseDate || '') >= q.since);
    if (q.featured) list = list.filter((c) => c.featured);
    if (q.q) { const n = q.q.toLowerCase(); list = list.filter((c) => [c.title, c.description, c.specialty?.name, c.provider.name].join(' ').toLowerCase().includes(n)); }
    const sorters = { newest: (a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''), oldest: (a, b) => (a.releaseDate || '').localeCompare(b.releaseDate || ''),
      title: (a, b) => a.title.localeCompare(b.title), languages: (a, b) => b.languages.length - a.languages.length, duration: (a, b) => a.durationSec - b.durationSec };
    list.sort(sorters[q.sort] || sorters.newest);
    return { courses: list, total: list.length };
  }
  if ((m = p.match(/^\/api\/courses\/([^/]+)$/)) && method === 'GET') {
    const c = course(decodeURIComponent(m[1]));
    const { cues, ...detail } = c;
    const pr = u && s.progress[u.id]?.[c.slug];
    const related = Object.values(SNAP.courses).filter((x) => x.slug !== c.slug && x.specialty?.slug === c.specialty?.slug);
    return { ...detail, availableInYourCountry: territoryOk(c, u), entitlement: entitlement(c, u), saved: !!u && (s.saved[u.id] || []).includes(c.slug),
      progress: pr ? { position: pr.position, percent: pr.percent, completedAt: pr.completedAt, lastLanguage: pr.lastLanguage } : null,
      related: (related.length ? related : Object.values(SNAP.courses).filter((x) => x.slug !== c.slug)).slice(0, 3).map((x) => card(x, u)) };
  }
  if ((m = p.match(/^\/api\/courses\/([^/]+)\/play$/))) {
    const c = course(decodeURIComponent(m[1]));
    if (!territoryOk(c, u)) err(451, u?.country ? 'This course is not licensed for your country.' : 'This course is licensed for selected countries only. Please sign in and set your country in your profile.');
    const ent = entitlement(c, u);
    const pr = u && s.progress[u.id]?.[c.slug];
    return { mediaUrl: await mediaUrl(c.media), poster: c.poster, durationSec: c.durationSec, mediaHasAudio: !!c.mediaHasAudio, tracks: c.tracks, entitlement: ent,
      previewSec: ent.full ? null : previewLimit(c), resume: pr && pr.position < c.durationSec - 5 ? pr.position : 0, preferredLanguage: u?.preferredLanguage || null };
  }
  if ((m = p.match(/^\/api\/courses\/([^/]+)\/cues$/))) {
    const c = course(decodeURIComponent(m[1]));
    const lang = q.lang || c.originalLanguage;
    const track = c.tracks.find((t) => t.language === lang) || err(404, 'This language is not available for this course.');
    const ent = entitlement(c, u); const limit = ent.full ? Infinity : previewLimit(c);
    return { language: lang, aiGenerated: track.aiGenerated, review: track.review, truncated: !ent.full, cues: c.cues[lang].filter((x) => x.start < limit) };
  }
  if ((m = p.match(/^\/api\/courses\/([^/]+)\/progress$/))) {
    if (!u) return { saved: false };
    const c = course(decodeURIComponent(m[1])); const ent = entitlement(c, u);
    let pos = Math.max(0, Math.min(Number(body.position) || 0, c.durationSec));
    if (!ent.full) pos = Math.min(pos, previewLimit(c));
    const all = (s.progress[u.id] ||= {});
    const e = (all[c.slug] ||= { position: 0, max: 0, percent: 0, startedAt: now(), updatedAt: now(), completedAt: null, lastLanguage: null });
    e.max = Math.max(e.max, Math.min(pos, e.max + Math.min(Number(body.watchedDelta) || 0, 60) * 2.2 + 3));
    e.position = pos; e.percent = Math.min(1, e.max / c.durationSec); e.updatedAt = now(); e.lastLanguage = body.language || e.lastLanguage;
    let certificate = null;
    if (e.percent >= 0.9 && ent.full) {
      e.completedAt ||= now();
      certificate = Object.values(s.certs).find((x) => x.userId === u.id && x.slug === c.slug)?.id;
      if (!certificate) { certificate = Math.random().toString(36).slice(2, 12); s.certs[certificate] = { id: certificate, userId: u.id, slug: c.slug, language: e.lastLanguage, issuedAt: now() }; }
    }
    save();
    return { saved: true, percent: e.percent, completed: !!e.completedAt, certificate };
  }
  if ((m = p.match(/^\/api\/courses\/([^/]+)\/save$/))) {
    if (!u) err(401, 'Sign in to save courses.');
    const slug = decodeURIComponent(m[1]); const list = (s.saved[u.id] ||= []);
    const i = list.indexOf(slug); if (i >= 0) list.splice(i, 1); else list.unshift(slug);
    save(); return { saved: i < 0 };
  }
  if ((m = p.match(/^\/api\/certificates\/([^/]+)$/))) {
    const cert = s.certs[decodeURIComponent(m[1])] || err(404, 'Certificate not found.');
    const owner = s.users.find((x) => x.id === cert.userId); const c = course(cert.slug);
    return { id: cert.id, kind: 'completion', issuedAt: cert.issuedAt, language: cert.language, holder: `${owner.firstName} ${owner.lastName}`, course: c.title, courseSlug: c.slug, provider: c.provider.name, durationSec: c.durationSec };
  }

  if (p === '/api/auth/register') {
    const mail = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) err(400, 'Please enter a valid e-mail address.');
    const pe = validPw(body.password); if (pe) err(400, pe);
    if (!body.firstName?.trim() || !body.lastName?.trim()) err(400, 'First name and last name are required.');
    if (!body.acceptTerms) err(400, 'Please accept the terms of use and acknowledge the privacy policy.');
    if (!body.confirmProfessional) err(400, 'Please confirm that you are a healthcare professional or student.');
    if (s.users.some((x) => x.email === mail)) err(400, 'An account with this e-mail already exists (in this browser).');
    const nu = { id: s.seq++, email: mail, pw: await digest(body.password), firstName: body.firstName.trim(), lastName: body.lastName.trim(), country: body.country || null,
      preferredLanguage: body.preferredLanguage || 'en', profession: body.profession || null, specialty: body.specialty || null, createdAt: now() };
    s.users.push(nu); s.session = nu.id; save();
    return { user: pub(nu) };
  }
  if (p === '/api/auth/login') {
    const mail = String(body.email || '').trim().toLowerCase();
    const x = s.users.find((y) => y.email === mail);
    if (!x || x.pw !== await digest(String(body.password || ''))) err(401, 'E-mail or password is incorrect. (Demo accounts exist only in the browser where they were created.)');
    s.session = x.id; save(); return { user: pub(x) };
  }
  if (p === '/api/auth/logout') { s.session = null; save(); return { ok: true }; }

  if (!u && (p.startsWith('/api/account') || p.startsWith('/api/checkout') || p.startsWith('/api/subscription'))) err(401, 'Please sign in.');
  if (p === '/api/account/profile') {
    if (!body.firstName?.trim() || !body.lastName?.trim()) err(400, 'First name and last name are required.');
    Object.assign(u, { firstName: body.firstName.trim(), lastName: body.lastName.trim(), country: body.country || null, preferredLanguage: body.preferredLanguage || 'en', profession: body.profession || null, specialty: body.specialty || null });
    save(); return { user: pub(u) };
  }
  if (p === '/api/account/password') {
    if (u.pw !== await digest(String(body.currentPassword || ''))) err(400, 'Current password is incorrect.');
    const pe = validPw(body.newPassword); if (pe) err(400, pe);
    u.pw = await digest(body.newPassword); save(); return { ok: true };
  }
  if (p === '/api/account/dashboard') return dashboard(u);
  if (p === '/api/account' && method === 'DELETE') {
    if (u.pw !== await digest(String(body.password || ''))) err(400, 'Password is incorrect.');
    s.users = s.users.filter((x) => x.id !== u.id);
    for (const k of ['progress', 'saved', 'subs', 'purchases', 'invoices']) delete s[k][u.id];
    for (const [id, c] of Object.entries(s.certs)) if (c.userId === u.id) delete s.certs[id];
    s.session = null; save(); return { ok: true };
  }
  if (p === '/api/checkout/quote') return quote(q, u);
  if (p === '/api/checkout') {
    const item = quote(body, u);
    if (!body.acceptTerms) err(400, 'Please accept the terms and conditions.');
    if (!body.waiveWithdrawal) err(400, 'To start immediately, please consent to immediate access and acknowledge the loss of your right of withdrawal.');
    if (!u.country) err(400, 'Please set your country in your profile first (needed for correct VAT).');
    if (item.kind === 'subscription') {
      s.subs[u.id] = { plan: item.ref, status: 'active', currency: item.currency, amount_cents: item.amount, started_at: now(), current_period_end: addPeriod(item.interval), provider: 'demo', canceled_at: null };
      invoice(u, `${item.name} (${item.interval === 'year' ? '12 months' : '1 month'})`, item.currency, item.amount);
    } else {
      (s.purchases[u.id] ||= []).unshift({ slug: item.ref, currency: item.currency, amount_cents: item.amount, provider: 'demo', created_at: now() });
      invoice(u, `Course: ${item.name}`, item.currency, item.amount);
    }
    save(); return { ok: true, mode: 'demo' };
  }
  if (p === '/api/subscription/cancel') {
    const sub = s.subs[u.id]; if (!sub || sub.status !== 'active') err(400, 'No active subscription found.');
    sub.status = 'canceled'; sub.canceled_at = now(); save(); return { ok: true, accessUntil: sub.current_period_end };
  }
  if (p === '/api/contracts/cancel') {
    if (!body.name?.trim() || !body.email?.trim()) err(400, 'Please enter your name and e-mail.');
    let auto = false;
    if (u && u.email === String(body.email).trim().toLowerCase() && body.kind !== 'extraordinary' && s.subs[u.id]?.status === 'active') { s.subs[u.id].status = 'canceled'; s.subs[u.id].canceled_at = now(); auto = true; save(); }
    return { ok: true, reference: `CXL-DEMO-${Date.now().toString().slice(-6)}`, receivedAt: now(), processedAutomatically: auto };
  }
  if (p === '/api/partners/inquiry' || p === '/api/complaints') {
    if (!body.privacyAccepted) err(400, 'Please confirm that you have read the privacy policy.');
    return { ok: true, reference: `REQ-DEMO-${Date.now().toString().slice(-5)}`, note: 'Static demo: not transmitted.' };
  }
  if (p === '/api/consent') return { consentId: 'static-demo', categories: { necessary: true, preferences: !!body.preferences, analytics: !!body.analytics }, policyVersion: SNAP.meta.policyVersion };
  if (p === '/api/account/export') return { note: 'Static demo export', profile: pub(u), ...dashboard(u) };
  err(404, 'This function requires the full server version.');
}

export async function api(path, { method = 'GET', body } = {}) {
  await new Promise((r) => setTimeout(r, 60)); // keep loading states realistic
  return handle(method, path, body ?? {});
}
export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: 'POST', body: body ?? {} });
export const put = (p, body) => api(p, { method: 'PUT', body });
export const patch = (p, body) => api(p, { method: 'PATCH', body });
export const del = (p, body) => api(p, { method: 'DELETE', body: body ?? {} });
