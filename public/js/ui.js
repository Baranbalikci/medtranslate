// Safe HTML templating, icons, formatting and shared UI components.

class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const val = (v) => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(val).join('') : v == null || v === false ? '' : esc(v));
/** Tagged template that escapes every interpolation unless it is itself html`` output or raw(). */
export const html = (strings, ...values) => new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? val(values[i]) : ''), ''));
export const raw = (s) => new Safe(String(s));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ── icons (inline SVG, stroke-based) ─────────────────────────────────────────
const P = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  play: '<path d="M7 5v14l11-7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" stroke="none"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  cc: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 10.5a2 2 0 1 0 0 3M16 10.5a2 2 0 1 0 0 3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  bookmarkFill: '<path d="M6 4h12v17l-6-4-6 4z" fill="currentColor"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/>',
  subtitles: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 15h6M15 15h2M7 11h2M11 11h6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5.5 5"/>',
  building: '<path d="M4 21V5l8-2v18M12 7l8 3v11M8 8h1M8 12h1M8 16h1M15 12h1M15 16h1M2 21h20"/>',
  handshake: '<path d="M8 12l3 3a2 2 0 0 0 3-3l-3-3h-3l-4 4M3 11l4-4 3 2M21 11l-4-4-3 2"/><path d="M6 15l2 2M9 18l1 1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h0V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h0V4z"/>',
  pulse: '<path d="M2 12h4l2-6 4 12 2-6h8"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  scan: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M8 12h8"/>',
  scalpel: '<path d="M3 21l9-9M12 12l7-7a2 2 0 0 1 3 3l-7 7z"/>',
  stethoscope: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
  bone: '<path d="M7 7l10 10M5.5 4a2 2 0 0 1 2.5 2.5L6.5 8A2 2 0 1 1 4 5.5zM18.5 20a2 2 0 0 1-2.5-2.5l1.5-1.5a2 2 0 1 1 2.5 2.5z"/>',
  child: '<circle cx="12" cy="6" r="3"/><path d="M8 21v-6l-3-3 3-2h8l3 2-3 3v6"/>',
  mask: '<path d="M4 9c3-2 13-2 16 0v3a8 8 0 0 1-16 0z"/><path d="M4 10H2M20 10h2"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M6 10h3l1.5-3 3 6L15 10h3M9 20h6"/>',
  gut: '<path d="M8 3v4a4 4 0 0 0 4 4h2a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  drop: '<path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  rewind: '<path d="M11 6l-7 6 7 6zM20 6l-7 6 7 6z"/>',
  forward: '<path d="M13 6l7 6-7 6zM4 6l7 6-7 6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  chevronL: '<path d="M15 6l-6 6 6 6"/>',
  chevronR: '<path d="M9 6l6 6-6 6"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
};
export const icon = (name, size = 20, cls = '') => raw(`<svg class="i ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.info}</svg>`);

// ── formatting ───────────────────────────────────────────────────────────────
export const fmtDuration = (sec) => {
  sec = Math.round(sec || 0);
  if (sec < 60) return `${sec} s`;
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
export const fmtTime = (sec) => {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`;
};
export const fmtDate = (d) => (d ? new Date(d.length === 10 ? d + 'T00:00:00' : d.replace(' ', 'T') + (d.includes('T') || d.endsWith('Z') ? '' : 'Z')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtMoney = (cents, currency = 'EUR') => new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format((cents || 0) / 100);
export const levelLabel = { foundation: 'Foundation', intermediate: 'Intermediate', advanced: 'Advanced' };

// ── components ───────────────────────────────────────────────────────────────
export function langChips(codes, languages, max = 5) {
  const names = codes.map((c) => languages.find((l) => l.code === c)).filter(Boolean);
  const shown = names.slice(0, max);
  return html`<div class="lang-chips" aria-label="Available languages">
    ${shown.map((l) => html`<span class="lang-chip" title="${l.name}">${l.code.toUpperCase()}</span>`)}
    ${names.length > max ? html`<span class="lang-chip more" title="${names.slice(max).map((l) => l.name).join(', ')}">+${names.length - max}</span>` : ''}
  </div>`;
}

export function accreditationBadge(acc, compact = false) {
  if (acc.status === 'accredited') return html`<span class="badge badge-ok" title="${acc.label}">${icon('award', 14)} ${compact ? `${acc.credits} ${acc.creditType}` : acc.label}</span>`;
  if (acc.status === 'pending') return html`<span class="badge badge-warn" title="${acc.label}">Accreditation pending</span>`;
  return html`<span class="badge badge-neutral" title="${acc.label}">No CME credits</span>`;
}

const voiceCount = (c) => (c.audioLanguages || []).length;

function cardActions(c) {
  return html`<div class="cc-actions">
    <button type="button" class="cc-btn ${c.saved ? 'on' : ''}" data-save-course="${c.slug}" aria-pressed="${c.saved ? 'true' : 'false'}" aria-label="${c.saved ? 'Remove from saved' : 'Save course'}" title="Save">${icon(c.saved ? 'bookmarkFill' : 'bookmark', 16)}</button>
    <button type="button" class="cc-btn" data-plan-course="${c.slug}" aria-label="Add to my learning calendar" title="Add to calendar">${icon('calendar', 16)}</button>
  </div>`;
}

export function courseCard(c, languages) {
  const v = voiceCount(c);
  return html`<article class="course-card" data-slug="${c.slug}">
    <a href="/courses/${c.slug}" class="course-card-link" aria-label="${c.title}">
      <div class="course-thumb">
        ${c.poster ? html`<img src="${c.poster}" alt="" loading="lazy" decoding="async">` : ''}
        <span class="course-duration">${icon('clock', 13)} ${fmtDuration(c.durationSec)}</span>
        ${c.isDemo ? html`<span class="demo-tag">Demo</span>` : ''}
        <span class="thumb-play">${icon('play', 18)}</span>
      </div>
      <div class="course-body">
        <div class="course-meta-top">
          <span class="eyebrow">${c.specialty?.name || 'General'}</span>
          <span class="level level-${c.level}">${levelLabel[c.level]}</span>
        </div>
        <h3 class="course-title">${c.title}</h3>
        <p class="course-desc">${c.description}</p>
        <div class="course-provider">${c.provider.name}</div>
        <div class="course-foot">
          <div class="cc-langs"><span class="cc-count">${icon('globe', 13)} ${c.languages.length}</span>${v ? html`<span class="cc-count voice">${icon('volume', 13)} ${v}</span>` : ''}</div>
          <div class="course-access">${c.access === 'free' ? html`<span class="price free">Free</span>` : html`<span class="price">Included in plan</span>`}</div>
        </div>
        <div class="course-foot2">
          ${accreditationBadge(c.accreditation, true)}
          ${c.territory[0] !== '*' ? html`<span class="badge badge-neutral" title="Licensed territories">${icon('globe', 13)} ${c.territory.join(', ')}</span>` : ''}
        </div>
      </div>
    </a>
    ${cardActions(c)}
  </article>`;
}

/** Wide row for the list view. */
export function courseRow(c, languages) {
  const v = voiceCount(c);
  return html`<article class="course-row" data-slug="${c.slug}">
    <a href="/courses/${c.slug}" class="cr-link" aria-label="${c.title}">
      <div class="cr-thumb">${c.poster ? html`<img src="${c.poster}" alt="" loading="lazy" decoding="async">` : ''}<span class="course-duration">${icon('clock', 13)} ${fmtDuration(c.durationSec)}</span><span class="thumb-play">${icon('play', 18)}</span></div>
      <div class="cr-main">
        <div class="course-meta-top"><span class="eyebrow">${c.specialty?.name || 'General'}</span><span class="level level-${c.level}">${levelLabel[c.level]}</span>${c.isDemo ? html`<span class="badge badge-warn">Demo</span>` : ''}</div>
        <h3 class="course-title">${c.title}</h3>
        <p class="course-desc">${c.description}</p>
        <div class="cr-meta"><span>${icon('building', 14)} ${c.provider.name}</span><span>${icon('globe', 14)} ${c.languages.length} languages</span>${v ? html`<span class="voice">${icon('volume', 14)} ${v} AI voices</span>` : ''}<span>${icon('calendar', 14)} ${fmtDate(c.releaseDate)}</span></div>
      </div>
      <div class="cr-side">
        ${accreditationBadge(c.accreditation, true)}
        ${c.access === 'free' ? html`<span class="price free">Free</span>` : html`<span class="price">Included in plan</span>`}
        <span class="btn btn-primary btn-sm cr-open">Open ${icon('arrow', 14)}</span>
      </div>
    </a>
    ${cardActions(c)}
  </article>`;
}

export function emptyState(title, text, action = '') {
  return html`<div class="empty"><div class="empty-icon">${icon('search', 26)}</div><h3>${title}</h3><p>${text}</p>${action}</div>`;
}

export function skeletonCards(n = 6) {
  return html`<div class="course-grid">${Array.from({ length: n }, () => html`<div class="course-card skeleton"><div class="course-thumb"></div><div class="course-body"><div class="sk-line w40"></div><div class="sk-line w90"></div><div class="sk-line w70"></div></div></div>`)}</div>`;
}

// ── toast ────────────────────────────────────────────────────────────────────
export function toast(message, type = 'info', ms = 4200) {
  let host = $('#toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.setAttribute('aria-live', 'polite'); document.body.append(host); }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info', 18)}<span>${esc(message)}</span>`;
  host.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

/** Serialise a form into an object (checkbox groups with the same name become arrays). */
export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') {
      const group = form.querySelectorAll(`input[type=checkbox][name="${el.name}"]`);
      if (group.length > 1) { out[el.name] ??= []; if (el.checked) out[el.name].push(el.value); } else out[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; } else if (el.multiple) {
      out[el.name] = [...el.selectedOptions].map((o) => o.value);
    } else out[el.name] = el.value;
  }
  return out;
}

export function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) { button.dataset.label = button.innerHTML; button.disabled = true; button.innerHTML = `<span class="spinner"></span>${label ? esc(label) : ''}`; }
  else { button.disabled = false; if (button.dataset.label) button.innerHTML = button.dataset.label; }
}

export function formError(form, message) {
  let box = form.querySelector('.form-error');
  if (!box) { box = document.createElement('div'); box.className = 'form-error'; box.setAttribute('role', 'alert'); form.prepend(box); }
  box.textContent = message || '';
  box.hidden = !message;
  if (message) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
