import { setSiteLanguage, storedSiteLanguage, openChooser } from './pagetx.js';
import { initFx } from './fx.js';
import { bridge } from './bridge.js';
import { curPath, curSearch, setUrl, STATIC } from './nav.js';
import { html, icon, $, $$, esc, toast } from './ui.js';
import { state, loadSession, onChange, saveConsent } from './store.js';
import { post } from './api.js';

const routes = [
  ['/', () => import('./views/home.js')],
  ['/courses', () => import('./views/catalog.js')],
  ['/planner', () => import('./views/planner.js')],
  ['/courses/:slug', () => import('./views/course.js')],
  ['/specialties', () => import('./views/specialties.js')],
  ['/specialties/:slug', () => import('./views/catalog.js')],
  ['/technology', () => import('./views/technology.js')],
  ['/pricing', () => import('./views/pricing.js')],
  ['/checkout', () => import('./views/checkout.js')],
  ['/partners', () => import('./views/partners.js')],
  ['/about', () => import('./views/about.js')],
  ['/faq', () => import('./views/faq.js')],
  ['/contact', () => import('./views/contact.js')],
  ['/login', () => import('./views/auth.js')],
  ['/register', () => import('./views/auth.js')],
  ['/account', () => import('./views/account.js')],
  ['/account/:tab', () => import('./views/account.js')],
  ['/certificates/:id', () => import('./views/certificate.js')],
  ['/cancel', () => import('./views/cancel.js')],
  ['/legal/:page', () => import('./views/legal.js')],
  ['/admin', () => import('./views/admin.js')],
  ['/admin/:tab', () => import('./views/admin.js')],
  ['/admin/:tab/:id', () => import('./views/admin.js')],
].map(([pattern, load]) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  return { pattern, re, keys, load };
});

bridge.navigate = (to, o) => navigate(to, o);
let cleanup = null;
let navToken = 0;

export function navigate(to, { replace = false, keepScroll = false } = {}) {
  if (to === curPath() + curSearch() && !replace) { render({ keepScroll: true }); return; }
  setUrl(to, replace);
  render({ keepScroll });
}
window.addEventListener('popstate', () => render({ keepScroll: true }));

async function render({ keepScroll = false } = {}) {
  const token = ++navToken;
  const path = curPath();
  const query = Object.fromEntries(new URLSearchParams(curSearch()));
  let match = null; let params = {};
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) { match = r; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; }
  }
  const main = $('#main');
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  closeMobileMenu();
  main.setAttribute('aria-busy', 'true');
  main.classList.add('leaving');
  try {
    const mod = match ? (await match.load()).default : (await import('./views/notfound.js')).default;
    const ctx = { params, query, path, navigate };
    const view = typeof mod === 'function' ? mod(ctx) : mod;
    const out = await view.render(ctx);
    if (token !== navToken) return;
    const title = typeof view.title === 'function' ? view.title(ctx) : view.title;
    document.title = title ? `${title} · MedTranslate` : 'MedTranslate — Medical Knowledge Without Language Barriers';
    const desc = view.description ? (typeof view.description === 'function' ? view.description(ctx) : view.description) : null;
    $('meta[name="description"]').setAttribute('content', desc || 'International medical education (CME/CPD) with AI-powered subtitles and multilingual audio.');
    main.innerHTML = String(out);
    main.classList.remove('leaving');
    main.removeAttribute('aria-busy');
    if (!keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
    if (!STATIC && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    updateNav();
    if (view.mount) cleanup = view.mount(main, ctx) || null;
    const h1 = main.querySelector('h1');
    if (h1 && !keepScroll) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    initFx(main);
  } catch (err) {
    if (token !== navToken) return;
    console.error(err);
    if (err.status === 401) { navigate(`/login?next=${encodeURIComponent(path + curSearch())}`, { replace: true }); return; }
    main.classList.remove('leaving');
    main.removeAttribute('aria-busy');
    main.innerHTML = String(html`<section class="section"><div class="container narrow center">
      <div class="empty"><div class="empty-icon">${icon('alert', 26)}</div><h1 class="h3">${err.status === 404 ? 'Page not found' : err.status === 403 ? 'Access denied' : 'Something went wrong'}</h1>
      <p>${err.message || 'Please try again.'}</p><a class="btn btn-primary" href="/">Back to home</a></div></div></section>`);
  }
}


// ── header / footer ─────────────────────────────────────────────────────────
const NAV = [
  ['/courses', 'Courses'], ['/planner', 'Planner'], ['/specialties', 'Specialties'], ['/technology', 'Technology'], ['/pricing', 'Pricing'], ['/partners', 'Partner With Us'],
];

function logo() {
  return html`<a href="/" class="logo" aria-label="MedTranslate home">
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0EA5E9"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs>
    <rect width="32" height="32" rx="9" fill="#0A1A33"/><path d="M9 21V11l7 6 7-6v10" fill="none" stroke="url(#lg)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="8" r="2.4" fill="#22D3EE"/></svg>
    <span>Med<b>Translate</b></span></a>`;
}

function renderHeader() {
  const u = state.user;
  $('#header').innerHTML = String(html`
    <div class="container header-inner">
      ${logo()}
      <nav class="nav-desktop" aria-label="Main">
        ${NAV.map(([href, label]) => html`<a href="${href}" class="nav-link">${label}</a>`)}
      </nav>
      <div class="header-actions">
        <button type="button" class="lang-switch" data-action="site-lang" aria-label="Website language">${icon('globe', 17)}<span class="code">${state.meta?.languages.find((l) => l.code === (storedSiteLanguage() || 'en'))?.native || 'English'}</span></button>
        ${u ? html`
          ${u.role !== 'user' ? html`<a href="/admin" class="btn btn-ghost btn-sm hide-sm">${icon('shield', 16)} Admin</a>` : ''}
          <a href="/account" class="avatar-btn" aria-label="My account"><span class="avatar">${(u.firstName[0] || '') + (u.lastName[0] || '')}</span></a>`
        : html`<a href="/login" class="btn btn-ghost btn-sm hide-sm">Sign in</a><a href="/register" class="btn btn-primary btn-sm hide-xs">Get started</a>`}
        <button class="icon-btn menu-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">${icon('menu', 22)}</button>
      </div>
    </div>
    `);
  $('#mobile-host').innerHTML = String(html`    <div class="mobile-menu" id="mobile-menu" hidden>
      <nav aria-label="Mobile">
        ${NAV.map(([href, label]) => html`<a href="${href}" class="m-link">${label}${icon('arrow', 18)}</a>`)}
        <a href="/about" class="m-link">About Us${icon('arrow', 18)}</a>
        <a href="/faq" class="m-link">FAQ${icon('arrow', 18)}</a>
        <button type="button" class="m-link" data-action="site-lang">Website language${icon('globe', 18)}</button>
        <div class="m-actions">
          ${u ? html`<a href="/account" class="btn btn-primary btn-block">My account</a>${u.role !== 'user' ? html`<a href="/admin" class="btn btn-ghost btn-block">Admin dashboard</a>` : ''}`
            : html`<a href="/register" class="btn btn-primary btn-block">Create free account</a><a href="/login" class="btn btn-ghost btn-block">Sign in</a>`}
        </div>
      </nav>
    </div>`);
  updateNav();
}

function updateNav() {
  $$('.nav-link').forEach((a) => {
    const active = curPath() === a.getAttribute('href') || curPath().startsWith(a.getAttribute('href') + '/');
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function closeMobileMenu() {
  const m = $('#mobile-menu'); const t = $('.menu-toggle');
  if (!m || m.hidden) return;
  m.hidden = true; document.body.classList.remove('menu-open');
  t?.setAttribute('aria-expanded', 'false'); if (t) t.innerHTML = String(icon('menu', 22));
}

function renderFooter() {
  $('#footer').innerHTML = String(html`
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          ${logo()}
          <p>Licensed medical education, made accessible across languages through AI-generated subtitles and audio — with transparent labelling and medical quality control.</p>
          <p class="footer-note">${icon('info', 14)} Demo build: all courses, providers and translations are sample data.</p>
        </div>
        <div><h4>Platform</h4><a href="/courses">Courses</a><a href="/specialties">Medical Specialties</a><a href="/technology">Technology</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a></div>
        <div><h4>Company</h4><a href="/about">About Us</a><a href="/partners">Partner With Us</a><a href="/contact">Contact</a><a href="/legal/cme-akkreditierung">CME/CPD Accreditation</a><a href="/legal/ki-transparenz">AI Transparency</a></div>
        <div><h4>Legal</h4><a href="/legal/impressum">Impressum</a><a href="/legal/datenschutz">Datenschutz</a><a href="/legal/agb">AGB</a><a href="/legal/widerruf">Widerrufsbelehrung</a><a href="/legal/cookies">Cookie-Richtlinie</a><a href="/legal/urheberrecht">Urheberrechtliche Hinweise</a><a href="/legal/haftungsausschluss">Medizinischer Haftungsausschluss</a><a href="/legal/meldung">Rechtliche Meldungen</a></div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} ${'[Betreibername]'} · Legal texts are drafts pending legal review.</span>
        <div class="footer-bottom-links">
          <button type="button" class="link-btn" data-action="cookie-settings">Cookie-Einstellungen</button>
          <a href="/cancel" class="cancel-link">Verträge hier kündigen</a>
        </div>
      </div>
    </div>`);
}

// ── cookie consent (TTDSG § 25 / GDPR) ──────────────────────────────────────
function showConsent(force = false) {
  if (!force && state.consent) return;
  $('#consent')?.remove();
  const c = state.consent || {};
  const el = document.createElement('div');
  el.id = 'consent';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Privacy settings');
  el.innerHTML = String(html`<div class="consent-card">
    <div class="consent-head">${icon('shield', 20)}<h2>Your privacy choices</h2></div>
    <p>We use strictly necessary storage for sign-in, security and remembering this choice. With your consent we also remember player preferences (language, subtitle size, resume position when signed out). We do not use advertising or third-party tracking. <a href="/legal/cookies">Cookie policy</a> · <a href="/legal/datenschutz">Privacy policy</a></p>
    <details class="consent-details"${force ? ' open' : ''}><summary>Customise</summary>
      <label class="check"><input type="checkbox" checked disabled> <span><b>Strictly necessary</b> — session, security, consent record. Always on.</span></label>
      <label class="check"><input type="checkbox" name="preferences" ${c.preferences ? 'checked' : ''}> <span><b>Preferences</b> — player language, subtitle style, resume position.</span></label>
      <label class="check"><input type="checkbox" name="analytics" ${c.analytics ? 'checked' : ''}> <span><b>Analytics</b> — currently not used. If enabled in the future, only privacy-friendly, self-hosted statistics.</span></label>
    </details>
    <div class="consent-actions">
      <button class="btn btn-ghost" data-c="necessary">Necessary only</button>
      <button class="btn btn-ghost" data-c="save">Save selection</button>
      <button class="btn btn-primary" data-c="all">Accept all</button>
    </div></div>`);
  document.body.append(el);
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const choice = b.dataset.c;
    const sel = { preferences: el.querySelector('[name=preferences]').checked, analytics: el.querySelector('[name=analytics]').checked };
    const v = choice === 'all' ? { preferences: true, analytics: true } : choice === 'necessary' ? { preferences: false, analytics: false } : sel;
    try { await saveConsent(v); el.remove(); toast('Privacy settings saved.', 'success'); } catch (err) { toast(err.message, 'error'); }
  });
}

// ── global events ───────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const sv = e.target.closest('[data-save-course]');
  if (sv) {
    e.preventDefault();
    if (!state.user) { toast('Sign in to save courses.'); return; }
    post(`/api/courses/${sv.dataset.saveCourse}/save`).then(({ saved }) => {
      sv.classList.toggle('on', saved); sv.setAttribute('aria-pressed', String(saved)); sv.innerHTML = String(icon(saved ? 'bookmarkFill' : 'bookmark', 16));
      toast(saved ? 'Saved to your list.' : 'Removed from your list.', 'success');
    }).catch((err) => toast(err.message, 'error'));
    return;
  }
  const pl = e.target.closest('[data-plan-course]');
  if (pl) { e.preventDefault(); import('./plan-ui.js').then((m) => m.openPlanDialog(pl.dataset.planCourse)); return; }
  const a = e.target.closest('a[href]');
  if (a && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !a.target && !a.hasAttribute('download')) {
    const href = a.getAttribute('href');
    if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/api/') && !href.startsWith('/media/')) {
      e.preventDefault();
      const [p, hash] = href.split('#');
      if (hash && p === curPath()) { document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }); return; }
      navigate(href);
      return;
    }
  }
  if (e.target.closest('.menu-toggle')) {
    const m = $('#mobile-menu'); const t = e.target.closest('.menu-toggle');
    const open = m.hidden;
    m.hidden = !open; document.body.classList.toggle('menu-open', open);
    t.setAttribute('aria-expanded', String(open)); t.innerHTML = String(icon(open ? 'close' : 'menu', 22));
  }
  if (e.target.closest('[data-action="cookie-settings"]')) showConsent(true);
  if (e.target.closest('[data-action="logout"]')) {
    post('/api/auth/logout').then(async () => { state.user = null; renderHeader(); toast('You have been signed out.'); navigate('/'); });
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMobileMenu(); });
window.addEventListener('scroll', () => $('#header').classList.toggle('scrolled', window.scrollY > 8), { passive: true });

// Static demo: sandboxed frames may block native form submission. Forms are
// handled in script anyway, so dispatch the submit event ourselves.
if (STATIC) {
  const fire = (form, submitter) => form.dispatchEvent(new SubmitEvent('submit', { cancelable: true, bubbles: true, submitter }));
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !btn.form || (btn.type && btn.type !== 'submit')) return;
    e.preventDefault(); fire(btn.form, btn);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.form || e.target.matches('textarea, button')) return;
    e.preventDefault(); fire(e.target.form, null);
  }, true);
}

onChange(() => renderHeader());

(async function boot() {
  if (STATIC) {
    document.body.classList.add('static');
    const b = document.createElement('div');
    b.className = 'static-banner';
    b.textContent = 'Interactive demo running in your browser — demo data only. Accounts and purchases are stored locally; no payments, no data is sent. The admin dashboard requires the full server version.';
    document.body.prepend(b);
  }
  try { await loadSession(); } catch (e) { console.error(e); toast('Could not reach the server. Some features may not work.', 'error'); }
  renderHeader();
  renderFooter();
  await render({ keepScroll: false });
  const siteLang = storedSiteLanguage();
  if (siteLang) { if (siteLang !== 'en') setSiteLanguage(siteLang, { remember: false }); showConsent(); }
  else {
    // First visit: let people pick their language before anything else.
    openChooser({ firstVisit: true });
    const wait = setInterval(() => { if (!document.querySelector('.tx-chooser')) { clearInterval(wait); showConsent(); } }, 300);
  }
})();

export { esc };
