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
  if (b) b.textContent = lang.toUpperCase();
}

const GREETINGS = [['en', 'Choose your language'], ['sw', 'Chagua lugha yako'], ['fr', 'Choisissez votre langue'], ['ar', 'اختر لغتك'], ['ha', 'Zaɓi yarenka'], ['es', 'Elige tu idioma'], ['pt', 'Escolha o seu idioma'], ['am', 'ቋንቋዎን ይምረጡ'], ['yo', 'Yan èdè rẹ'], ['hi', 'अपनी भाषा चुनें'], ['zh', '选择您的语言'], ['de', 'Wähle deine Sprache']];

export function openChooser({ firstVisit = false } = {}) {
  document.querySelector('.tx-chooser')?.remove();
  const m = state.meta; if (!m) return;
  const wrap = document.createElement('div');
  wrap.className = 'tx-chooser';
  wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Choose your language');
  wrap.innerHTML = String(html`<div class="txc-card">
    <div class="txc-head">
      <div class="txc-greet" aria-hidden="true">${GREETINGS.map(([c, t], i) => html`<span style="--i:${i}" dir="${c === 'ar' ? 'rtl' : 'ltr'}">${t}</span>`)}</div>
      <h2>Choose your language</h2>
      <p>The whole website — menus, pages and course descriptions — is translated by AI. Courses play with subtitles and, where available, an AI voice in your language.</p>
      <input type="search" class="txc-search" placeholder="Search 53 languages…" aria-label="Search languages">
    </div>
    <div class="txc-list">${m.regions.map((r) => html`<section><h3>${r.name}</h3><div class="txc-grid">
      ${m.languages.filter((l) => l.region === r.code).map((l) => html`<button type="button" data-pick="${l.code}" class="${l.code === lang ? 'on' : ''}" data-search="${`${l.native} ${l.name}`.toLowerCase()}"><b>${l.native}</b><small>${l.name}</small></button>`)}
    </div></section>`)}</div>
    <div class="txc-foot"><span class="xs">Machine translation can contain errors. The original English (and German legal texts) remain authoritative.</span>
      <button type="button" class="btn btn-ghost btn-sm" data-pick="${firstVisit ? 'en' : lang}">${firstVisit ? 'Continue in English' : 'Close'}</button></div></div>`);
  document.body.append(wrap);
  document.body.classList.add('menu-open');
  const close = () => { wrap.remove(); document.body.classList.remove('menu-open'); };
  wrap.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pick]');
    if (b) { close(); await setSiteLanguage(b.dataset.pick); return; }
    if (e.target === wrap && !firstVisit) close();
  });
  wrap.addEventListener('input', (e) => {
    const n = e.target.value.trim().toLowerCase();
    wrap.querySelectorAll('[data-search]').forEach((b) => { b.hidden = !!n && !b.dataset.search.includes(n); });
    wrap.querySelectorAll('section').forEach((s) => { s.hidden = ![...s.querySelectorAll('[data-search]')].some((b) => !b.hidden); });
  });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !firstVisit) close(); });
  setTimeout(() => wrap.querySelector('.txc-search')?.focus(), 50);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tx]');
  if (t?.dataset.tx === 'original') { setSiteLanguage('en'); }
  if (t?.dataset.tx === 'choose' || e.target.closest('[data-action="site-lang"]')) openChooser();
});

export { esc };
