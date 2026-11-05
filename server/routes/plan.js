// Personal learning calendar: scheduled study sessions per user, with .ics export.
import { get, all, run, audit } from '../db.js';
import { config } from '../config.js';
import { loadCourseById, loadCourseBySlug, courseCard } from '../catalog.js';
import { bad, notFound, str } from '../http.js';

const AUTH = { auth: true };
const WHEN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const mins = (c) => Math.min(240, Math.max(10, Math.ceil(c.duration_sec / 60 / 5) * 5 + 5)); // lecture + a little time for notes

function view(row, user) {
  const c = loadCourseById(row.course_id);
  return {
    id: row.id, startAt: row.start_at, minutes: row.minutes, note: row.note, done: !!row.done,
    course: c ? courseCard(c, user) : null,
  };
}
const pad = (n) => String(n).padStart(2, '0');
const icsTime = (iso) => iso.replace(/[-:]/g, '') + '00';
const addMin = (iso, m) => { const d = new Date(iso + ':00Z'); d.setUTCMinutes(d.getUTCMinutes() + m); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function registerPlanRoutes(r) {
  r.get('/api/plan', (ctx) => ({
    items: all('SELECT * FROM plan_items WHERE user_id = ? ORDER BY start_at', ctx.user.id).map((x) => view(x, ctx.user)).filter((x) => x.course),
  }), AUTH);

  r.post('/api/plan', async (ctx) => {
    const b = await ctx.json();
    const c = loadCourseBySlug(String(b.slug || ''));
    if (!c || c.status !== 'published') throw notFound('Course not found.');
    if (!WHEN.test(b.startAt || '')) throw bad('Please choose a date and time.');
    const count = get('SELECT COUNT(*) AS n FROM plan_items WHERE user_id = ?', ctx.user.id).n;
    if (count >= 500) throw bad('Your calendar is full. Remove old sessions first.');
    const res = run('INSERT INTO plan_items (user_id, course_id, start_at, minutes, note) VALUES (?,?,?,?,?)',
      ctx.user.id, c.id, b.startAt, Math.min(480, Math.max(10, Math.round(Number(b.minutes)) || mins(c))), str(b.note, { max: 300 }));
    audit(ctx.user.id, 'plan.added', 'course', c.id);
    return view(get('SELECT * FROM plan_items WHERE id = ?', Number(res.lastInsertRowid)), ctx.user);
  }, AUTH);

  r.patch('/api/plan/:id', async (ctx) => {
    const row = get('SELECT * FROM plan_items WHERE id = ? AND user_id = ?', Number(ctx.params.id), ctx.user.id);
    if (!row) throw notFound();
    const b = await ctx.json();
    const start = b.startAt != null ? b.startAt : row.start_at;
    if (!WHEN.test(start)) throw bad('Please choose a date and time.');
    run('UPDATE plan_items SET start_at = ?, done = ?, note = ? WHERE id = ?', start, b.done != null ? (b.done ? 1 : 0) : row.done,
      b.note !== undefined ? str(b.note, { max: 300 }) : row.note, row.id);
    return view(get('SELECT * FROM plan_items WHERE id = ?', row.id), ctx.user);
  }, AUTH);

  r.delete('/api/plan/:id', (ctx) => { run('DELETE FROM plan_items WHERE id = ? AND user_id = ?', Number(ctx.params.id), ctx.user.id); return { ok: true }; }, AUTH);

  // iCalendar feed of upcoming sessions (import into Google / Apple / Outlook calendar).
  r.get('/api/plan/export.ics', (ctx) => {
    const rows = all('SELECT * FROM plan_items WHERE user_id = ? AND done = 0 ORDER BY start_at', ctx.user.id);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const events = rows.map((x) => {
      const c = loadCourseById(x.course_id); if (!c) return '';
      return ['BEGIN:VEVENT', `UID:plan-${x.id}@medtranslate`, `DTSTAMP:${stamp}`, `DTSTART:${icsTime(x.start_at)}`, `DTEND:${icsTime(addMin(x.start_at, x.minutes))}`,
        `SUMMARY:${esc('MedTranslate: ' + c.title)}`, `DESCRIPTION:${esc(`${c.provider_name}\n${config.publicUrl}/courses/${c.slug}${x.note ? '\n' + x.note : ''}`)}`,
        `URL:${config.publicUrl}/courses/${c.slug}`, 'END:VEVENT'].join('\r\n');
    }).filter(Boolean);
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MedTranslate//Learning plan//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:MedTranslate learning plan', ...events, 'END:VCALENDAR'].join('\r\n') + '\r\n';
    ctx.res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="medtranslate-plan.ics"', 'Cache-Control': 'no-store' });
    ctx.res.end(body);
  }, AUTH);
}
