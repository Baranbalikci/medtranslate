// Whole-website translation. Every visible text node and a few attributes are
// translated by AI into the visitor's language, batched and cached, and kept up
// to date as pages change. Subtitles, transcripts and language names are left
// alone (they have their own handling). "Show original" restores English.
import { translateStrings } from './i18n-provider.js';
import { whenIdle } from './priority.js';
import { prefs, state } from './store.js';
import { html, icon, esc } from './ui.js';

const SKIP = 'script,style,noscript,code,pre,.mono,[data-notranslate],select,.p-tag,.p-toast,.p-time,#tp-status,#tp-note,.p-subs,.tp-body,.lname,.lm-search,.tv-sub,.tv-langs,.marquee,.africa-langs,.lchip,.lang-pill,.lang-chip,#tx-pill,.tx-chooser,.logo';
const ATTRS = ['placeholder', 'aria-label', 'title'];
const LETTER = /\p{L}{2,}/u;

let lang = 'en';
let dict = new Map();
const original = new WeakMap();          // Text node → English source
const originalAttr = new WeakMap();      // Element → {attr: source}
let applying = false;
let pending = 0;
let busy = 0;
let failed = null;
let failedAt = 0;
let running = false;
let rerun = false;
const inflight = new Set();
let observer = null;

const cacheKey = (l) => `tx:${l}`;
function loadDict(l) { dict = new Map(Object.entries(prefs.get(cacheKey(l), {}) || {})); }
let saveTimer = 0;
function saveDict() { clearTimeout(saveTimer); saveTimer = setTimeout(() => prefs.set(cacheKey(lang), Object.fromEntries([...dict].slice(-4000))), 800); }

function roots() { return ['#header', '#mobile-host', '#main', '#footer', '#consent', '.modal-backdrop', '#toasts'].flatMap((s) => [...document.querySelectorAll(s)]); }

function collect() {
  const nodes = []; const attrs = [];
  for (const r of roots()) {
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || p.closest(SKIP)) return NodeFilter.FILTER_REJECT;
        const src = original.get(n) ?? n.nodeValue;
        return LETTER.test(src) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    while (w.nextNode()) nodes.push(w.currentNode);
    r.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(',')).forEach((e) => { if (!e.closest(SKIP)) attrs.push(e); });
  }
  return { nodes, attrs };
}

function apply({ nodes, attrs }) {
  applying = true;
  for (const n of nodes) {
    if (!original.has(n)) original.set(n, n.nodeValue);
    const src = original.get(n); const key = src.trim();
    const t = lang === 'en' ? null : dict.get(key);
    const want = t ? src.replace(key, t) : src;
    if (n.nodeValue !== want) n.nodeValue = want;
  }
  for (const e of attrs) {
    let o = originalAttr.get(e); if (!o) { o = {}; originalAttr.set(e, o); }
    for (const a of ATTRS) {
      if (!e.hasAttribute(a)) continue;
      if (!(a in o)) o[a] = e.getAttribute(a);
      const t = lang === 'en' ? null : dict.get(o[a].trim());
      const want = t || o[a];
      if (e.getAttribute(a) !== want) e.setAttribute(a, want);
    }
  }
  applying = false;
}

async function run() {
  // One pass at a time; changes during a pass trigger exactly one follow-up pass.
  if (running) { rerun = true; return; }
  running = true;
  try { await pass(); } finally {
    running = false;
    if (rerun) { rerun = false; schedule(); }
  }
}

async function pass() {
  const found = collect();
  apply(found);
  if (lang === 'en') { renderPill(); return; }
  const need = new Set();
  for (const n of found.nodes) { const k = original.get(n).trim(); if (!dict.has(k)) need.add(k); }
  for (const e of found.attrs) { const o = originalAttr.get(e); for (const a of ATTRS) if (o?.[a] && LETTER.test(o[a]) && !dict.has(o[a].trim())) need.add(o[a].trim()); }
  // Never ask twice for the same text, and back off for a minute after an error.
  if (failed && Date.now() - failedAt < 60000) { renderPill(); return; }
  const list = [...need].filter((s) => s.length <= 2000 && !inflight.has(s));
  if (!list.length) { renderPill(); return; }
  const batches = [];
  let cur = []; let size = 0;
  for (const s of list) { if (cur.length >= 60 || size + s.length > 6000) { batches.push(cur); cur = []; size = 0; } cur.push(s); size += s.length; inflight.add(s); }
  if (cur.length) batches.push(cur);
  const myLang = lang;
  busy += batches.length; failed = null; renderPill();
  // Visible text first: batches follow document order, which starts at the top of the page.
  const worker = async () => {
    while (batches.length) {
      const b = batches.shift();
      try {
        await whenIdle(); // live subtitles first
        const out = await translateStrings(myLang, b);
        if (myLang !== lang) return;
        b.forEach((s, i) => { if (out[i]) dict.set(s, out[i]); });
        saveDict();
        apply(collect());
      } catch (e) {
        failed = e.message; failedAt = Date.now();
        busy = Math.max(0, busy - batches.length);
        for (const r of batches) for (const s of r) inflight.delete(s);
        batches.length = 0;
      } finally { for (const s of b) inflight.delete(s); busy = Math.max(0, busy - 1); renderPill(); }
    }
  };
  await Promise.all([worker(), worker()]);
}

function schedule() {
  if (applying) return;
  clearTimeout(pending);
  pending = setTimeout(run, 600);
}

export function siteLanguage() { return lang; }

// The chosen site language is remembered as part of the service the visitor asked for.
export const storedSiteLanguage = () => { try { return localStorage.getItem('mt_site_lang'); } catch { return null; } };

export async function setSiteLanguage(code, { remember = true } = {}) {
  lang = code || 'en';
  failed = null;
  if (remember) { try { localStorage.setItem('mt_site_lang', lang); } catch { /* storage unavailable */ } prefs.set('siteLang', lang); }
  if (!prefs.get('lang', null) && lang !== 'en') prefs.set('lang', lang); // the player starts in this language too
  document.documentElement.lang = lang;
  loadDict(lang);
  if (!observer) {
    observer = new MutationObserver((muts) => {
      if (applying || lang === 'en') return;
      // Ignore churn without words (timers, progress) and areas we never translate.
      const relevant = muts.some((m) => {
        const n = m.type === 'characterData' ? m.target.parentElement : m.target;
        if (!n || n.closest?.(SKIP) || n.closest?.('.p-time,.p-toast')) return false;
        return m.type === 'childList' ? [...m.addedNodes].some((x) => LETTER.test(x.textContent || '')) : LETTER.test(m.target.nodeValue || '');
      });
      if (relevant) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  updateHeaderButton();
  await run();
}

// ── UI: status pill + chooser ────────────────────────────────────────────────
function langMeta(code) { return state.meta?.languages.find((l) => l.code === code); }

function renderPill() {
  let pill = document.getElementById('tx-pill');
  if (lang === 'en' && !failed) { pill?.remove(); return; }
  if (!pill) { pill = document.createElement('div'); pill.id = 'tx-pill'; pill.setAttribute('role', 'status'); document.body.append(pill); }
  const l = langMeta(lang);
  pill.className = `tx-pill ${busy ? 'busy' : ''} ${failed ? 'err' : ''}`;
  pill.innerHTML = String(html`${failed ? icon('alert', 15) : busy ? html`<span class="spinner"></span>` : icon('sparkles', 15)}
    <span>${failed ? failed : busy ? `Translating into ${l?.native || lang}…` : `Translated by AI · ${l?.native || lang}`}${location.pathname.startsWith('/legal') || document.querySelector('.prose[lang="de"]') ? ' · German legal text is binding' : ''}</span>
    <button type="button" data-tx="original">${failed ? 'Use English' : 'Show original'}</button><button type="button" data-tx="choose">${icon('globe', 14)}</button>`);
}

function updateHeaderButton() {
  const b = document.querySelector('[data-action="site-lang"] .code');
  if (b) b.textContent = langMeta(lang)?.native || lang.toUpperCase();
  // Layout stays left-to-right (full mirroring is not implemented); text blocks of right-to-left
  // languages flow and align correctly via unicode-bidi (see CSS).
  document.documentElement.toggleAttribute('data-rtl', langMeta(lang)?.dir === 'rtl');
}

const GREETINGS = [['en', 'Medicine speaks every language'], ['sw', 'Tiba inazungumza kila lugha'], ['fr', 'La médecine parle toutes les langues'], ['ar', 'الطب يتحدث كل اللغات'], ['ha', 'Likitanci yana magana da kowane harshe'], ['es', 'La medicina habla todos los idiomas'], ['pt', 'A medicina fala todas as línguas'], ['de', 'Medizin spricht jede Sprache']];

const REGION_LABEL = { africa: 'Africa', americas: 'Americas', mena: 'Middle East & N. Africa', asia: 'Asia', europe: 'Europe' };

function recommended() {
  const m = state.meta; const seen = new Set(); const out = [];
  for (const tag of navigator.languages || [navigator.language]) {
    const code = String(tag || '').slice(0, 2).toLowerCase();
    const l = m.languages.find((x) => x.code === code);
    if (l && !seen.has(code)) { seen.add(code); out.push(l); }
  }
  for (const code of ['en', 'sw', 'ha', 'yo']) { const l = m.languages.find((x) => x.code === code); if (l && !seen.has(code) && out.length < 4) { seen.add(code); out.push(l); } }
  return out.slice(0, 4);
}

export function openChooser({ firstVisit = false } = {}) {
  document.querySelector('.tx-chooser')?.remove();
  const m = state.meta; if (!m) return;
  const wrap = document.createElement('div');
  wrap.className = 'tx-chooser';
  wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Choose your language');
  const tile = (l, big = false) => html`<button type="button" data-pick="${l.code}" class="lt ${l.code === lang ? 'on' : ''} ${big ? 'big' : ''} ${l.live ? 'ready' : ''}" data-region="${l.region}" data-search="${`${l.native} ${l.name} ${l.code}`.toLowerCase()}" dir="${l.dir}">
      <b>${l.native}</b><small>${l.name}</small><i class="dot" title="${l.live ? 'Subtitles and voice ready' : 'Live AI translation'}"></i></button>`;
  const rec = recommended();
  wrap.innerHTML = String(html`
    <div class="txc-aurora" aria-hidden="true"></div>
    <div class="txc-stage">
      <section class="txc-left" aria-hidden="true">
        <div class="txc-brand"><svg width="28" height="28" viewBox="0 0 32 32"><defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0EA5E9"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="#0A1A33" stroke="rgba(255,255,255,.18)"/><path d="M9 21V11l7 6 7-6v10" fill="none" stroke="url(#cg)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="8" r="2.4" fill="#22D3EE"/></svg><span>Med<b>Translate</b></span></div>
        <div class="txc-globe"><canvas id="txc-canvas"></canvas></div>
        <div class="txc-greet">${GREETINGS.map(([c, t], i) => html`<span style="--i:${i}" dir="${c === 'ar' ? 'rtl' : 'ltr'}">${t}</span>`)}</div>
        <div class="txc-facts"><span><b>${m.languages.length}</b> languages</span><span><b>Nigeria</b> &amp; <b>Kenya</b> first</span><span><b>AI</b> subtitles · voice · website</span></div>
      </section>
      <section class="txc-right">
        <header>
          <span class="txc-kicker">Welcome · Karibu · Bienvenue · مرحبا · Bem-vindo</span>
          <h2>Choose your language</h2>
          <p>Menus, pages and course texts are translated by AI. Lectures play with subtitles and, where available, an AI voice.</p>
          <label class="txc-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" placeholder="Search ${m.languages.length} languages…" aria-label="Search languages" autocomplete="off"><kbd>↵</kbd></label>
          <div class="txc-tabs" role="tablist">
            <button type="button" role="tab" aria-selected="true" data-tab="all">All</button>
            ${m.regions.map((r) => html`<button type="button" role="tab" aria-selected="false" data-tab="${r.code}">${REGION_LABEL[r.code] || r.name}</button>`)}
          </div>
        </header>
        <div class="txc-list">
          <div class="txc-block" data-block="rec"><h3>Recommended for you</h3><div class="txc-rec">${rec.map((l) => tile(l, true))}</div></div>
          <div class="txc-block" data-block="all"><div class="txc-grid">${m.languages.map((l) => tile(l))}</div></div>
          <p class="txc-empty" hidden>No language found. Try another spelling.</p>
        </div>
        <footer>
          <span class="txc-legend"><i class="dot ok"></i> subtitles + voice ready &nbsp; <i class="dot"></i> live AI translation</span>
          <button type="button" class="txc-skip" data-pick="${firstVisit ? 'en' : lang}">${firstVisit ? 'Continue in English' : 'Close'} →</button>
        </footer>
      </section>
    </div>`);
  document.body.append(wrap);
  document.body.classList.add('menu-open');
  let globe = null;
  import('./globe.js').then(({ createGlobe }) => { const c = wrap.querySelector('#txc-canvas'); if (c && wrap.isConnected) globe = createGlobe(c, { size: 0.42, labels: true }); });
  const close = () => { globe?.destroy(); wrap.remove(); document.body.classList.remove('menu-open'); };
  const input = wrap.querySelector('input');
  let tab = 'all';
  const apply = () => {
    const n = input.value.trim().toLowerCase();
    let any = 0;
    wrap.querySelectorAll('.txc-grid .lt').forEach((b) => { const show = (tab === 'all' || b.dataset.region === tab) && (!n || b.dataset.search.includes(n)); b.hidden = !show; if (show) any++; });
    wrap.querySelector('[data-block="rec"]').hidden = !!n || tab !== 'all';
    wrap.querySelector('.txc-empty').hidden = any > 0;
  };
  wrap.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; wrap.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === t))); apply(); if (tab !== 'all') globe?.focus(tab); return; }
    const b = e.target.closest('[data-pick]');
    if (b) { close(); await setSiteLanguage(b.dataset.pick); return; }
    if (e.target === wrap && !firstVisit) close();
  });
  wrap.addEventListener('pointerover', (e) => { const b = e.target.closest('.lt'); if (b && b.dataset.region) globe?.focus(b.dataset.region); });
  input.addEventListener('input', apply);
  wrap.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape' && !firstVisit) close();
    if (e.key === 'Enter' && e.target === input) { const first = wrap.querySelector('.txc-grid .lt:not([hidden])'); if (first) { close(); await setSiteLanguage(first.dataset.pick); } }
  });
  setTimeout(() => input.focus(), 80);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tx]');
  if (t?.dataset.tx === 'original') { setSiteLanguage('en'); }
  if (t?.dataset.tx === 'choose' || e.target.closest('[data-action="site-lang"]')) openChooser();
});

export { esc };
