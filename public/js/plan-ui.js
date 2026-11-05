// Shared "add to my learning calendar" dialog and calendar helpers.
import { html, icon, esc, fmtDuration, toast } from './ui.js';
import { state } from './store.js';
import { get, post } from './api.js';
import { STATIC } from './nav.js';
import { bridge } from './bridge.js';

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localIso = (d) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const parseLocal = (iso) => { const [d, t] = iso.split('T'); const [y, m, dd] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, dd, h, mi); };
export const addMinutes = (iso, m) => localIso(new Date(parseLocal(iso).getTime() + m * 60000));

/** Link that opens a prefilled event in Google Calendar (works from any page, no download needed). */
export function googleCalendarUrl(item) {
  const c = item.course; const fmt = (iso) => iso.replace(/[-:]/g, '') + '00';
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `MedTranslate: ${c.title}`, dates: `${fmt(item.startAt)}/${fmt(addMinutes(item.startAt, item.minutes))}`,
    details: `${c.provider.name}\n${location.origin}/courses/${c.slug}${item.note ? '\n' + item.note : ''}` });
  return `https://calendar.google.com/calendar/render?${q}`;
}

function nextSlots() {
  const now = new Date(); const out = [];
  const at = (d, h) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x; };
  const tonight = at(now, 20); if (tonight > now) out.push(['Tonight 20:00', tonight]);
  const tom = new Date(now); tom.setDate(tom.getDate() + 1);
  out.push(['Tomorrow 08:00', at(tom, 8)], ['Tomorrow 18:00', at(tom, 18)]);
  const sat = new Date(now); sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7));
  out.push(['Saturday 10:00', at(sat, 10)]);
  return out;
}

export async function openPlanDialog(slug, { onSaved, date } = {}) {
  if (!state.user) { toast('Sign in to plan your learning.'); bridge.navigate(`/login?next=${encodeURIComponent('/planner')}`); return; }
  let c;
  try { c = (await get(`/api/courses/${encodeURIComponent(slug)}`)); } catch (e) { toast(e.message, 'error'); return; }
  const mins = Math.min(240, Math.ceil(c.durationSec / 300) * 5 + 5);
  const slots = nextSlots();
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  const first = slots[0][1];
  const dateVal = date || ymd(first);
  wrap.innerHTML = String(html`<form class="modal plan-modal" role="dialog" aria-modal="true" aria-label="Add to learning calendar">
    <div class="pm-head"><span class="ic">${icon('calendar', 20)}</span><div><h3>Plan this course</h3><p class="small muted">${c.title} · ${fmtDuration(c.durationSec)}</p></div></div>
    <div class="pm-slots">${slots.map(([l, d], i) => html`<button type="button" class="pm-slot ${i === 0 ? 'on' : ''}" data-slot="${localIso(d)}">${l}</button>`)}</div>
    <div class="form-grid" style="margin-top:12px">
      <label class="field"><span>Date</span><input type="date" name="date" required value="${dateVal}"></label>
      <label class="field"><span>Time</span><input type="time" name="time" required value="${pad(first.getHours())}:${pad(first.getMinutes())}"></label>
      <label class="field"><span>Block <small>(minutes)</small></span><input type="number" name="minutes" min="10" max="480" step="5" value="${mins}"></label>
      <label class="field"><span>Note <small>(optional)</small></span><input name="note" maxlength="300" placeholder="e.g. with the team"></label>
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:6px"><button type="button" class="btn btn-ghost btn-sm" data-no>Cancel</button><button class="btn btn-primary btn-sm" type="submit">${icon('check', 15)} Add to calendar</button></div>
    <div class="form-error" hidden></div>
  </form>`);
  document.body.append(wrap);
  const form = wrap.querySelector('form');
  const done = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') done(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-no]')) done();
    const sl = e.target.closest('[data-slot]');
    if (sl) { const [d, t] = sl.dataset.slot.split('T'); form.date.value = d; form.time.value = t; wrap.querySelectorAll('.pm-slot').forEach((x) => x.classList.toggle('on', x === sl)); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.form-error'); err.hidden = true;
    try {
      const item = await post('/api/plan', { slug, startAt: `${form.date.value}T${form.time.value}`, minutes: Number(form.minutes.value), note: form.note.value });
      done();
      toast('Added to your learning calendar.', 'success');
      onSaved?.(item);
      document.dispatchEvent(new CustomEvent('mt-plan-changed'));
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  form.date.focus();
}
export { STATIC, esc };
