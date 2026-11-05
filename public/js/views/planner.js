import { html, icon, esc, fmtDuration, emptyState, toast, $, $$ } from '../ui.js';
import { state } from '../store.js';
import { get, post, put, patch, del } from '../api.js';
import { STATIC, ask } from '../nav.js';
import { ymd, parseLocal, localIso, googleCalendarUrl, openPlanDialog } from '../plan-ui.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');
const timeOf = (iso) => iso.slice(11, 16);
const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export default function plannerView() {
  let items = []; let dash = null;
  return {
    title: 'Learning calendar',
    description: 'Plan your medical education: schedule courses in your calendar and keep a learning streak.',
    async render(ctx) {
      if (!state.user) { const e = new Error('Please sign in.'); e.status = 401; throw e; }
      [{ items }, dash] = await Promise.all([get('/api/plan'), get('/api/account/dashboard')]);
      return html`
      <section class="pl-hero"><div class="container">
        <div class="crumbs"><a href="/">Home</a><span>/</span><span>Learning calendar</span></div>
        <div class="pl-head">
          <div><h1>Your learning calendar</h1><p class="lead">Block time for the courses that matter. Add sessions to Google, Apple or Outlook calendar, and see your streak grow.</p></div>
          <div class="pl-stats" id="pl-stats"></div>
        </div>
      </div></section>
      <div class="container" data-planner>
        <div class="pl-layout">
          <section class="pl-cal" aria-label="Calendar">
            <div class="pl-cal-head">
              <div class="row" style="gap:6px"><button class="icon-btn" data-nav="-1" aria-label="Previous month">${icon('chevronL', 20)}</button><button class="icon-btn" data-nav="1" aria-label="Next month">${icon('chevronR', 20)}</button></div>
              <h2 id="pl-month"></h2>
              <button class="btn btn-ghost btn-sm" data-today>Today</button>
            </div>
            <div class="pl-dow">${DAYS.map((d) => html`<span>${d}</span>`)}</div>
            <div class="pl-grid" id="pl-grid"></div>
            <div class="pl-legend"><span><i class="lg pl-planned"></i> Planned</span><span><i class="lg done"></i> Done</span><span><i class="lg act"></i> You studied</span></div>
          </section>
          <aside class="pl-side">
            <div class="panel" id="pl-day"></div>
            <div class="panel" id="pl-suggest"></div>
            <div class="panel pl-mail" id="pl-mail"></div>
            <div class="panel pl-sync" id="pl-sync"></div>
          </aside>
        </div>
      </div>`;
    },
    mount(root) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
      let selected = ymd(today);
      const activity = new Set((dash.history || []).map((h) => (h.updatedAt || '').slice(0, 10)).filter(Boolean));
      for (const h of dash.history || []) if (h.completedAt) activity.add(h.completedAt.slice(0, 10));

      const byDay = () => { const m = new Map(); for (const it of items) { const k = it.startAt.slice(0, 10); (m.get(k) || m.set(k, []).get(k)).push(it); } return m; };

      function stats() {
        const ws = startOfWeek(today); const we = new Date(ws); we.setDate(we.getDate() + 7);
        const week = items.filter((i) => { const d = parseLocal(i.startAt); return d >= ws && d < we; });
        const mins = week.reduce((n, i) => n + i.minutes, 0);
        const doneWeek = week.filter((i) => i.done).length;
        let streak = 0; const d = new Date(today);
        if (!activity.has(ymd(d))) d.setDate(d.getDate() - 1);
        while (activity.has(ymd(d))) { streak++; d.setDate(d.getDate() - 1); }
        $('#pl-stats', root).innerHTML = String(html`
          <div class="plstat"><b>${week.length}</b><span>${week.length === 1 ? 'session' : 'sessions'} this week</span></div>
          <div class="plstat"><b>${(mins / 60).toFixed(1)}<small>h</small></b><span>planned this week</span></div>
          <div class="plstat"><b>${doneWeek}/${week.length || 0}</b><span>done</span></div>
          <div class="plstat hot"><b>${streak}<small>d</small></b><span>learning streak</span></div>`);
      }

      function grid() {
        $('#pl-month', root).textContent = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
        const first = startOfWeek(cursor); const map = byDay(); const cells = [];
        for (let i = 0; i < 42; i++) {
          const d = new Date(first); d.setDate(first.getDate() + i); const k = ymd(d);
          const list = map.get(k) || [];
          const out = d.getMonth() !== cursor.getMonth();
          cells.push(html`<button type="button" class="pl-day ${out ? 'out' : ''} ${k === ymd(today) ? 'today' : ''} ${k === selected ? 'sel' : ''} ${activity.has(k) ? 'act' : ''}" data-day="${k}" aria-label="${d.toDateString()}, ${list.length} sessions" aria-pressed="${k === selected}">
            <span class="dn">${d.getDate()}</span>
            <span class="evs">${list.slice(0, 2).map((i) => html`<span class="ev ${i.done ? 'done' : ''}" title="${i.course.title}">${timeOf(i.startAt)} ${i.course.title}</span>`)}${list.length > 2 ? html`<span class="more">+${list.length - 2}</span>` : ''}</span>
            ${list.length ? html`<span class="dots">${list.slice(0, 4).map((i) => html`<i class="${i.done ? 'done' : ''}"></i>`)}</span>` : ''}</button>`);
        }
        $('#pl-grid', root).innerHTML = String(html`${cells}`);
      }

      function day() {
        const list = (byDay().get(selected) || []).sort((a, b) => a.startAt.localeCompare(b.startAt));
        const d = parseLocal(`${selected}T12:00`);
        $('#pl-day', root).innerHTML = String(html`
          <div class="panel-head"><h3>${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h3></div>
          ${list.length ? list.map((i) => html`<div class="pl-item ${i.done ? 'done' : ''}">
            <a class="pi-thumb" href="/courses/${i.course.slug}"><img src="${i.course.poster}" alt="" loading="lazy"></a>
            <div class="pi-main"><div class="pi-time">${timeOf(i.startAt)} · ${i.minutes} min</div><a class="pi-title" href="/courses/${i.course.slug}">${i.course.title}</a>${i.note ? html`<div class="xs muted">${i.note}</div>` : ''}
              <div class="pi-actions">
                <button class="chip-btn" data-done="${i.id}" aria-pressed="${i.done}">${icon('check', 13)} ${i.done ? 'Done' : 'Mark done'}</button>
                <a class="chip-btn" target="_blank" rel="noopener" href="${googleCalendarUrl(i)}">${icon('calendar', 13)} Google</a>
                <label class="chip-btn">${icon('clock', 13)} Move<input type="datetime-local" value="${i.startAt}" data-move="${i.id}"></label>
                <button class="chip-btn danger" data-remove="${i.id}" aria-label="Remove">${icon('trash', 13)}</button>
              </div></div></div>`)
            : html`<p class="muted small" style="margin:0 0 14px">Nothing planned. Pick a course and give it a time slot.</p>`}
          <button class="btn btn-primary btn-sm btn-block" data-add>${icon('plus', 15)} Plan a course for this day</button>`);
      }

      function suggest() {
        const planned = new Set(items.filter((i) => !i.done).map((i) => i.course.slug));
        const cont = (dash.inProgress || []).filter((p) => p.available && !planned.has(p.course.slug)).slice(0, 3);
        const saved = (dash.saved || []).filter((c) => !planned.has(c.slug) && !cont.some((p) => p.course.slug === c.slug)).slice(0, 3);
        const row = (c, label) => html`<div class="sg-row"><img src="${c.poster}" alt="" loading="lazy"><div><b>${c.title}</b><small>${label}</small></div><button class="chip-btn" data-plan-course="${c.slug}">${icon('plus', 13)} Plan</button></div>`;
        $('#pl-suggest', root).innerHTML = String(html`<div class="panel-head"><h3>Plan next</h3></div>
          ${cont.length || saved.length ? html`${cont.map((p) => row(p.course, `Continue · ${Math.round(p.percent * 100)}% watched`))}${saved.map((c) => row(c, 'Saved course'))}`
            : html`<p class="muted small" style="margin:0 0 12px">Save courses or start watching — they show up here for quick planning.</p><a class="btn btn-ghost btn-sm" href="/courses">Browse courses</a>`}`);
      }

      function sync() {
        $('#pl-sync', root).innerHTML = String(html`<div class="panel-head"><h3>Take it with you</h3></div>
          <p class="small muted" style="margin:0 0 12px">Every session has an “add to Google Calendar” link. ${STATIC ? '' : 'The .ics file works with Apple Calendar and Outlook.'}</p>
          ${STATIC ? '' : html`<a class="btn btn-ghost btn-sm" href="/api/plan/export.ics" download>${icon('download', 15)} Download all (.ics)</a>`}`);
      }

      // ── e-mail reminders ──────────────────────────────────────────────
      const OFF = { 10: '10 min before', 30: '30 min before', 60: '1 hour before', 180: '3 hours before', 1440: '1 day before', 2880: '2 days before' };
      const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
      let prefs = null;
      async function mail() {
        const box = $('#pl-mail', root);
        if (STATIC) { box.innerHTML = String(html`<div class="panel-head"><h3>${icon('bell', 16)} E-mail reminders</h3></div><p class="small muted" style="margin:0">Reminder e-mails (“Tomorrow: … at 09:00”) are part of the full server version. This browser-only demo cannot send e-mail.</p>`); return; }
        try { prefs = await get('/api/plan/prefs'); } catch { box.innerHTML = ''; return; }
        const p = prefs;
        box.innerHTML = String(html`<div class="panel-head"><h3>${icon('bell', 16)} E-mail reminders</h3>
          <label class="switch"><input type="checkbox" id="mail-on" ${p.enabled ? 'checked' : ''} aria-label="Send reminder e-mails"><span></span></label></div>
          <p class="small muted" style="margin:0 0 10px">We e-mail <b>${p.email}</b> before each planned session: “Tomorrow: … at 09:00 — don’t forget.”</p>
          <div class="mail-offsets ${p.enabled ? '' : 'off'}">${p.offsetChoices.map((o) => html`<label class="mo ${p.offsets.includes(o) ? 'on' : ''}"><input type="checkbox" value="${o}" ${p.offsets.includes(o) ? 'checked' : ''}> ${OFF[o]}</label>`)}</div>
          <p class="xs muted" style="margin:10px 0">Time zone: <b>${p.tz}</b> · <button type="button" class="link-btn xs" data-tzset>use this device’s (${deviceTz()})</button></p>
          <div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-ghost btn-sm" id="mail-test">${icon('mail', 15)} Send test e-mail</button></div>
          ${p.mailConnected ? '' : html`<p class="xs mail-warn" style="margin:10px 0 0">${icon('info', 13)} E-mail delivery is not connected on this server yet (no mail provider key). Reminders are prepared and stored in the admin outbox, but nothing is sent.</p>`}`);
      }
      async function savePrefs(change) {
        const next = { enabled: prefs.enabled, offsets: prefs.offsets, tz: prefs.tz, ...change };
        try { await put('/api/plan/prefs', next); } catch (err) { toast(err.message, 'error'); }
        mail();
      }
      root.addEventListener('change', (e) => {
        if (e.target.id === 'mail-on') savePrefs({ enabled: e.target.checked, tz: deviceTz() });
        else if (e.target.closest('.mail-offsets')) savePrefs({ offsets: $$('.mail-offsets input:checked', root).map((i) => Number(i.value)) });
      });
      root.addEventListener('click', async (e) => {
        if (e.target.closest('[data-tzset]')) { savePrefs({ tz: deviceTz() }); return; }
        if (e.target.closest('#mail-test')) {
          try {
            const r = await post('/api/plan/test-email', {});
            toast(r.status === 'sent' ? `Test e-mail sent to ${r.to}.` : r.status === 'failed' ? 'Sending failed — see the admin outbox.' : 'No mail provider connected: the test e-mail was only stored in the outbox, not sent.', r.status === 'sent' ? 'success' : 'error');
          } catch (err) { toast(err.message, 'error'); }
        }
      });
      mail();

      const refresh = async () => { ({ items } = await get('/api/plan')); stats(); grid(); day(); suggest(); };
      stats(); grid(); day(); suggest(); sync();

      root.addEventListener('click', async (e) => {
        const nav = e.target.closest('[data-nav]');
        if (nav) { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + Number(nav.dataset.nav), 1); grid(); return; }
        if (e.target.closest('[data-today]')) { cursor = new Date(today.getFullYear(), today.getMonth(), 1); selected = ymd(today); grid(); day(); return; }
        const dy = e.target.closest('[data-day]');
        if (dy) { selected = dy.dataset.day; const dd = parseLocal(`${selected}T12:00`); if (dd.getMonth() !== cursor.getMonth()) cursor = new Date(dd.getFullYear(), dd.getMonth(), 1); grid(); day(); return; }
        const dn = e.target.closest('[data-done]');
        if (dn) { const it = items.find((x) => x.id === Number(dn.dataset.done)); try { await patch(`/api/plan/${it.id}`, { done: !it.done }); await refresh(); } catch (err) { toast(err.message, 'error'); } return; }
        const rm = e.target.closest('[data-remove]');
        if (rm) { if (await ask('Remove this session from your calendar?', { confirmLabel: 'Remove', danger: true })) { await del(`/api/plan/${rm.dataset.remove}`); await refresh(); toast('Removed.'); } return; }
        if (e.target.closest('[data-add]')) {
          // choose a course, then open the dialog prefilled for the selected day
          const { courses } = await get('/api/courses');
          const wrap = document.createElement('div'); wrap.className = 'modal-backdrop';
          wrap.innerHTML = String(html`<div class="modal plan-modal"><div class="pm-head"><span class="ic">${icon('calendar', 20)}</span><div><h3>Choose a course</h3><p class="small muted">for ${parseLocal(`${selected}T12:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div></div>
            <div class="pm-courses">${courses.map((c) => html`<button type="button" class="sg-row pick" data-pick="${c.slug}"><img src="${c.poster}" alt=""><div><b>${c.title}</b><small>${c.topic?.name || c.specialty?.name} · ${fmtDuration(c.durationSec)}</small></div></button>`)}</div>
            <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn btn-ghost btn-sm" data-no>Cancel</button></div></div>`);
          document.body.append(wrap);
          wrap.addEventListener('click', (ev) => {
            if (ev.target === wrap || ev.target.closest('[data-no]')) wrap.remove();
            const pk = ev.target.closest('[data-pick]');
            if (pk) { wrap.remove(); openPlanDialog(pk.dataset.pick, { date: selected }); }
          });
        }
      });
      root.addEventListener('change', async (e) => {
        const mv = e.target.closest('[data-move]');
        if (mv && mv.value) { try { await patch(`/api/plan/${mv.dataset.move}`, { startAt: mv.value }); selected = mv.value.slice(0, 10); await refresh(); toast('Moved.', 'success'); } catch (err) { toast(err.message, 'error'); } }
      });
      // sessions added through the shared dialog (e.g. from "Plan next") refresh this page
      const onChanged = () => refresh().catch(() => {});
      document.addEventListener('mt-plan-changed', onChanged);
      return () => document.removeEventListener('mt-plan-changed', onChanged);
    },
  };
}

export { esc, localIso };
