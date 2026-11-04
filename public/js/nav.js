// URL abstraction. On the real server the router uses the History API.
// In the self-contained static demo (window.MT_STATIC) the page runs in a
// sandboxed frame without path routing, so the current route lives in memory.
import { html, icon, esc } from './ui.js';

export const STATIC = typeof window !== 'undefined' && !!window.MT_STATIC;
let memUrl = '/';

export const curPath = () => (STATIC ? memUrl.split('?')[0].split('#')[0] : location.pathname);
export const curSearch = () => {
  if (!STATIC) return location.search;
  const q = memUrl.split('#')[0].split('?')[1];
  return q ? `?${q}` : '';
};
export function setUrl(to, replace = false) {
  if (STATIC) { memUrl = to; return; }
  try { history[replace ? 'replaceState' : 'pushState']({}, '', to); } catch { /* ignore */ }
}

/** In-page confirmation dialog (browser confirm() is unavailable in some embeds). */
export function ask(message, { confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = String(html`<div class="modal" role="alertdialog" aria-modal="true" aria-label="Confirmation">
      <div class="row" style="gap:10px;align-items:flex-start">${icon('info', 20)}<p style="margin:0">${message}</p></div>
      <div class="row" style="justify-content:flex-end;margin-top:20px">
        <button class="btn btn-ghost btn-sm" data-no>Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm" data-yes>${confirmLabel}</button></div></div>`);
    const done = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('[data-yes]')) done(true);
      else if (e.target.closest('[data-no]') || e.target === wrap) done(false);
    });
    document.addEventListener('keydown', onKey);
    document.body.append(wrap);
    wrap.querySelector('[data-yes]').focus();
  });
}
export { esc };
