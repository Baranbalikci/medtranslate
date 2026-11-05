// Scroll & pointer effects. Progressive enhancement only: content is in the DOM
// and readable without it, and everything is disabled for reduced motion.
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let bar = null;
const tracked = new Set();
let ticking = false;

const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('in');
    if (e.target.dataset.count != null) countUp(e.target);
    io.unobserve(e.target);
  }
}, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }) : null;

/** Wrap every word of a heading in spans so they can rise in one after another. */
function splitWords(el) {
  if (el.dataset.split) return;
  el.dataset.split = '1';
  let i = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const p of parts) {
          if (!p) continue;
          if (/^\s+$/.test(p)) { frag.append(document.createTextNode(p)); continue; }
          const w = document.createElement('span');
          w.className = 'w';
          const inner = document.createElement('span');
          inner.textContent = p;
          inner.style.setProperty('--i', i++);
          w.append(inner);
          frag.append(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
    }
  };
  walk(el);
}

function countUp(el) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target) || reduce()) { el.textContent = el.dataset.count + (el.dataset.suffix || ''); return; }
  const t0 = performance.now(); const dur = 1400;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.round(target * eased) + (el.dataset.suffix || '');
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    if (reduce()) return;
    const vh = innerHeight;
    for (const el of tracked) {
      if (!el.isConnected) { tracked.delete(el); continue; }
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      if (el.dataset.fxScroll === 'hero') {
        // 0 at rest → 1 when the hero has scrolled away
        el.style.setProperty('--hp', Math.min(1, Math.max(0, -r.top / Math.max(1, r.height))).toFixed(3));
      } else {
        // 0 when the element enters at the bottom → 1 when its centre reaches the upper third
        const p = (vh - r.top) / (vh * 0.75 + r.height * 0.5);
        el.style.setProperty('--sp', Math.min(1, Math.max(0, p)).toFixed(3));
      }
    }
  });
}

function onPointer(e) {
  if (reduce() || e.pointerType === 'touch') return;
  const card = e.target.closest('[data-tilt]');
  if (!card) return;
  const r = card.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
  const max = Number(card.dataset.tilt) || 6;
  card.style.setProperty('--rx', `${((0.5 - y) * max).toFixed(2)}deg`);
  card.style.setProperty('--ry', `${((x - 0.5) * max).toFixed(2)}deg`);
  card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
  card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  card.classList.add('tilting');
}
function onPointerOut(e) {
  const card = e.target.closest('[data-tilt]');
  if (card && !card.contains(e.relatedTarget)) { card.classList.remove('tilting'); card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); }
}

let started = false;
function start() {
  if (started) return;
  started = true;
  bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  (document.getElementById('header') || document.body).append(bar); // part of the header, never floating
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  document.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('pointerout', onPointerOut, { passive: true });
  // Content rendered asynchronously (course grids, dashboards) gets the same effects.
  const main = document.getElementById('main');
  let pending = 0;
  if (main && 'MutationObserver' in window) new MutationObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => initFx(main));
  }).observe(main, { childList: true, subtree: true });
}

/** Call after every page render. */
export function initFx(root) {
  start();
  root.querySelectorAll('[data-fx="words"]').forEach(splitWords);
  root.querySelectorAll('[data-stagger], .course-grid').forEach((g) => {
    [...g.children].forEach((c, i) => { c.classList.add('reveal'); c.style.setProperty('--i', i); });
  });
  root.querySelectorAll('.course-card, .feature, .plan, .spec-card').forEach((c) => { if (!c.dataset.tilt) c.dataset.tilt = c.classList.contains('feature') ? '4' : '6'; });
  const targets = root.querySelectorAll('.reveal:not(.in), [data-fx]:not(.in), [data-count]:not(.in)');
  targets.forEach((el) => (io && !reduce() ? io.observe(el) : (el.classList.add('in'), el.dataset.count != null && countUp(el))));
  root.querySelectorAll('[data-fx-scroll]').forEach((el) => tracked.add(el));
  onScroll();
}

/** Re-observe content inserted after the initial render (e.g. async course grids). */
export function refreshFx(root) { initFx(root); }
