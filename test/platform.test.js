// Integration tests: start the real server on a temporary database and exercise
// the compliance gates, entitlement and account flows over HTTP.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-test-'));
let server;

before(async () => {
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/server.js'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, ADMIN_PASSWORD: 'TestAdmin12345', ANTHROPIC_API_KEY: '', STRIPE_SECRET_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/api/meta`)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
after(() => { server?.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

function client() {
  let cookie = '';
  return async (method, p, body) => {
    const res = await fetch(BASE + p, {
      method,
      headers: { 'X-Requested-With': 'medtranslate', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) if (c.startsWith('mt_session=')) cookie = c.split(';')[0];
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data };
  };
}

test('catalogue only lists published courses and released, licensed languages', async () => {
  const c = client();
  const { data } = await c('GET', '/api/courses');
  assert.equal(data.total, 7, 'launch focus: emergency medicine only');
  assert.ok(data.courses.every((x) => x.specialty.slug === 'emergency-medicine'));
  assert.ok(!data.courses.some((x) => x.slug === 'pediatric-fever-without-source'), 'draft must not be listed');
  const stroke = data.courses.find((x) => x.slug === 'stroke-first-60-minutes');
  assert.equal(stroke.languages.length, 45, 'showcase course: original + 44 sample translations');
  assert.ok(['sw', 'ha', 'am'].every((l) => stroke.languages.includes(l)), 'African sample languages are released');
  assert.equal(stroke.accreditation.status, 'not_accredited');
  const de = await c('GET', '/api/courses?language=tr');
  assert.ok(de.data.courses.every((x) => x.languages.includes('tr')));
});

test('state-changing requests require the CSRF header', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 403);
});

test('regional licence is enforced at playback (HTTP 451)', async () => {
  const c = client();
  const r = await c('GET', '/api/courses/rapid-sequence-induction-checklist/play');
  assert.equal(r.status, 451);
});

test('paid course: anonymous users get preview-only transcript', async () => {
  const c = client();
  const r = await c('GET', '/api/courses/sepsis-hour-one/cues?lang=de');
  assert.equal(r.status, 200);
  assert.equal(r.data.truncated, true);
  assert.ok(r.data.cues.length < 6);
  const unknown = await c('GET', '/api/courses/sepsis-hour-one/cues?lang=it');
  assert.equal(unknown.status, 404, 'unreleased language must not be served');
});

test('register → demo checkout → full access → GDPR export → delete', async () => {
  const c = client();
  const reg = await c('POST', '/api/auth/register', { firstName: 'Ada', lastName: 'Test', email: 'ada@example.org', password: 'Password12345', country: 'DE', preferredLanguage: 'de', acceptTerms: true, confirmProfessional: true });
  assert.equal(reg.status, 200);
  const noWaiver = await c('POST', '/api/checkout', { plan: 'monthly', currency: 'EUR', acceptTerms: true });
  assert.equal(noWaiver.status, 400, 'withdrawal waiver (§ 356 (5) BGB) is required');
  const ok = await c('POST', '/api/checkout', { plan: 'monthly', currency: 'EUR', acceptTerms: true, waiveWithdrawal: true });
  assert.equal(ok.data.mode, 'demo');
  const play = await c('GET', '/api/courses/sepsis-hour-one/play');
  assert.equal(play.data.entitlement.full, true);
  assert.equal(play.data.previewSec, null);
  const dash = await c('GET', '/api/account/dashboard');
  assert.equal(dash.data.invoices.length, 1);
  assert.equal(dash.data.invoices[0].tax_rate, 19);
  assert.ok(dash.data.invoices[0].number.startsWith('DEMO-'));
  const exp = await c('GET', '/api/account/export');
  assert.equal(exp.data.profile.email, 'ada@example.org');
  const delBad = await c('DELETE', '/api/account', { password: 'wrong' });
  assert.equal(delBad.status, 400);
  const delOk = await c('DELETE', '/api/account', { password: 'Password12345' });
  assert.equal(delOk.status, 200);
  const me = await c('GET', '/api/auth/me');
  assert.equal(me.data.user, null);
});

test('anonymous cancellation request does not cancel third-party contracts', async () => {
  const owner = client();
  await owner('POST', '/api/auth/register', { firstName: 'Bo', lastName: 'Owner', email: 'bo@example.org', password: 'Password12345', country: 'AT', acceptTerms: true, confirmProfessional: true });
  const co = await owner('POST', '/api/checkout', { plan: 'monthly', currency: 'EUR', acceptTerms: true, waiveWithdrawal: true });
  assert.equal(co.status, 200, JSON.stringify(co.data));
  const stranger = client();
  const r = await stranger('POST', '/api/contracts/cancel', { name: 'Someone', email: 'bo@example.org', kind: 'ordinary' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.processedAutomatically, false);
  const dash = await owner('GET', '/api/account/dashboard');
  assert.equal(dash.data.subscription.status, 'active');
  const self = await owner('POST', '/api/contracts/cancel', { name: 'Bo Owner', email: 'bo@example.org', kind: 'ordinary' });
  assert.equal(self.data.processedAutomatically, true);
});

test('admin: publication gate, QC-gated release and automatic suspension', async () => {
  const a = client();
  assert.equal((await a('POST', '/api/auth/login', { email: 'admin@medtranslate.local', password: 'TestAdmin12345' })).status, 200);
  const courses = (await a('GET', '/api/admin/courses')).data;
  const ped = courses.find((x) => x.slug === 'pediatric-fever-without-source');
  const blocked = await a('POST', `/api/admin/courses/${ped.id}/status`, { status: 'published' });
  assert.equal(blocked.status, 409);
  assert.ok(blocked.data.details.blockers.some((b) => b.includes('commercial')));

  const course = (await a('GET', `/api/admin/courses/${ped.id}`)).data;
  const lic = { ...course.license, right_commercial: true };
  await a('PUT', `/api/admin/courses/${ped.id}/license`, lic);
  assert.equal((await a('POST', `/api/admin/courses/${ped.id}/status`, { status: 'published' })).status, 200);

  // AI provider not configured → 503, never a fake translation
  assert.equal((await a('POST', `/api/admin/courses/${ped.id}/translations`, { language: 'de', mode: 'ai' })).status, 503);
  const vtt = course.cues.map((q, i) => `${i + 1}\n00:00:${String(Math.floor(q.start_sec)).padStart(2, '0')}.000 --> 00:00:${String(Math.floor(q.end_sec)).padStart(2, '0')}.000\nDE ${i}`).join('\n\n');
  const tr = await a('POST', `/api/admin/courses/${ped.id}/translations`, { language: 'de', mode: 'import', vtt: `WEBVTT\n\n${vtt}\n` });
  const tid = tr.data.translation.id;
  assert.equal((await a('POST', `/api/admin/translations/${tid}/release`, {})).status, 409, 'release requires QC approval');
  assert.equal((await a('POST', `/api/admin/translations/${tid}/review`, { decision: 'approved', qualification: 'Paediatrician' })).status, 400);
  await a('POST', `/api/admin/translations/${tid}/review`, { decision: 'approved', qualification: 'Paediatrician', terminology_ok: true, meaning_preserved: true, sync_ok: true });
  assert.equal((await a('POST', `/api/admin/translations/${tid}/release`, {})).status, 200);
  const pub = await client()('GET', '/api/courses/pediatric-fever-without-source');
  assert.deepEqual(pub.data.languages.sort(), ['de', 'en']);

  // Editing a released translation hides it again until re-reviewed.
  await a('PUT', `/api/admin/translations/${tid}/cues`, { texts: course.cues.map((_, i) => `DE edited ${i}`) });
  const pub2 = await client()('GET', '/api/courses/pediatric-fever-without-source');
  assert.deepEqual(pub2.data.languages, ['en']);

  // Removing a required right suspends the published course automatically.
  await a('PUT', `/api/admin/courses/${ped.id}/license`, { ...lic, right_use: false });
  assert.equal((await a('GET', `/api/admin/courses/${ped.id}`)).data.status, 'suspended');
  assert.equal((await client()('GET', '/api/courses/pediatric-fever-without-source')).status, 404);
});

test('accredited status requires evidence before it can be published', async () => {
  const a = client();
  await a('POST', '/api/auth/login', { email: 'admin@medtranslate.local', password: 'TestAdmin12345' });
  const ecg = (await a('GET', '/api/admin/courses')).data.find((x) => x.slug === 'acs-early-ecg-recognition');
  await a('PUT', `/api/admin/courses/${ecg.id}/accreditation`, { status: 'accredited', credit_amount: 2 });
  const d = (await a('GET', `/api/admin/courses/${ecg.id}`)).data;
  assert.ok(d.accreditationBlockers.length >= 3);
  assert.equal(d.status, 'suspended');
  await a('PUT', `/api/admin/courses/${ecg.id}/accreditation`, { status: 'not_accredited' });
});

test('non-staff users cannot reach admin endpoints', async () => {
  const c = client();
  assert.equal((await c('GET', '/api/admin/overview')).status, 401);
  await c('POST', '/api/auth/register', { firstName: 'Cy', lastName: 'User', email: 'cy@example.org', password: 'Password12345', country: 'FR', acceptTerms: true, confirmProfessional: true });
  assert.equal((await c('GET', '/api/admin/overview')).status, 403);
});

test('media requires a valid signature', async () => {
  assert.equal((await fetch(`${BASE}/media/videos/sepsis-hour-one.mp4`)).status, 403);
  const { data } = await client()('GET', '/api/courses/stroke-first-60-minutes/play');
  const res = await fetch(BASE + data.mediaUrl, { headers: { Range: 'bytes=0-99' } });
  assert.equal(res.status, 206);
  assert.equal((await res.arrayBuffer()).byteLength, 100);
});

test('dubbed audio tracks are served as signed files; original video has sound', async () => {
  const { data } = await client()('GET', '/api/courses/stroke-first-60-minutes/play');
  assert.equal(data.mediaHasAudio, true);
  const sw = data.tracks.find((t) => t.language === 'sw');
  assert.equal(sw.audio, 'file');
  const res = await fetch(BASE + sw.audioUrl, { headers: { Range: 'bytes=0-15' } });
  assert.equal(res.status, 206);
  assert.equal(data.tracks.find((t) => t.language === 'ha').audio, 'browser_tts', 'no voice engine for Hausa → device voice fallback');
});

test('live AI translation: permission gate and honest "not connected" state', async () => {
  const c = client();
  const detail = await c('GET', '/api/courses/stroke-first-60-minutes');
  assert.equal(detail.data.liveAi.allowed, true);
  const r = await c('POST', '/api/courses/stroke-first-60-minutes/live-translate', { language: 'yo', from: 0, count: 4 });
  assert.equal(r.status, 503, 'without ANTHROPIC_API_KEY the server must not fake a translation');
  const bad = await c('POST', '/api/courses/stroke-first-60-minutes/live-translate', { language: 'en' });
  assert.equal(bad.status, 400);
});

test('website translation endpoint is honest when AI is not connected', async () => {
  const c = client();
  const r = await c('POST', '/api/i18n/translate', { language: 'sw', strings: ['Explore Courses'] });
  assert.equal(r.status, 503);
  assert.equal((await c('POST', '/api/i18n/translate', { language: 'xx', strings: ['a'] })).status, 400);
});

test('meta lists 53 languages in five regions incl. Africa and the Americas', async () => {
  const { data } = await client()('GET', '/api/meta');
  assert.equal(data.languages.length, 53);
  assert.deepEqual(data.regions.map((r) => r.code), ['africa', 'americas', 'mena', 'asia', 'europe']);
  assert.ok(data.languages.filter((l) => l.region === 'africa').length >= 15);
  assert.ok(['qu', 'gn', 'ay', 'ht'].every((c) => data.languages.some((l) => l.code === c)));
});

test('learning calendar: plan, move, complete, export, and stay private', async () => {
  const a = client();
  await a('POST', '/api/auth/register', { firstName: 'Pia', lastName: 'Plan', email: 'pia@example.org', password: 'Password12345', country: 'DE', acceptTerms: true, confirmProfessional: true });
  assert.equal((await client()('GET', '/api/plan')).status, 401);
  const bad = await a('POST', '/api/plan', { slug: 'stroke-first-60-minutes', startAt: 'tomorrow' });
  assert.equal(bad.status, 400);
  assert.equal((await a('POST', '/api/plan', { slug: 'no-such-course', startAt: '2030-01-05T18:00' })).status, 404);
  assert.equal((await a('POST', '/api/plan', { slug: 'pediatric-fever-without-source', startAt: '2030-01-05T18:00' })).status, 404, 'unpublished courses cannot be planned');
  const made = await a('POST', '/api/plan', { slug: 'stroke-first-60-minutes', startAt: '2030-01-05T18:00', note: 'with team' });
  assert.equal(made.status, 200);
  assert.equal(made.data.minutes, 10);
  const id = made.data.id;
  assert.equal((await a('PATCH', `/api/plan/${id}`, { startAt: '2030-01-06T07:30' })).data.startAt, '2030-01-06T07:30');
  assert.equal((await a('PATCH', `/api/plan/${id}`, { done: true })).data.done, true);
  const ics = await fetch(`${BASE}/api/plan/export.ics`, { headers: { Cookie: (await (async () => { const r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'medtranslate' }, body: JSON.stringify({ email: 'pia@example.org', password: 'Password12345' }) }); return r.headers.getSetCookie()[0].split(';')[0]; })()) } });
  assert.match(ics.headers.get('content-type'), /text\/calendar/);
  assert.equal((await ics.text()).includes('BEGIN:VEVENT'), false, 'completed sessions are not exported');
  // another user cannot see or change it
  const o = client();
  await o('POST', '/api/auth/register', { firstName: 'Otto', lastName: 'Other', email: 'otto@example.org', password: 'Password12345', country: 'DE', acceptTerms: true, confirmProfessional: true });
  assert.equal((await o('GET', '/api/plan')).data.items.length, 0);
  assert.equal((await o('PATCH', `/api/plan/${id}`, { done: false })).status, 404);
  assert.equal((await o('DELETE', `/api/plan/${id}`)).status, 200);
  assert.equal((await a('GET', '/api/plan')).data.items.length, 1, "other user's delete had no effect");
  assert.equal((await a('DELETE', `/api/plan/${id}`)).status, 200);
});

test('course cards tell signed-in users which courses they saved', async () => {
  const a = client();
  await a('POST', '/api/auth/register', { firstName: 'Sam', lastName: 'Save', email: 'sam@example.org', password: 'Password12345', country: 'DE', acceptTerms: true, confirmProfessional: true });
  await a('POST', '/api/courses/stroke-first-60-minutes/save');
  const { data } = await a('GET', '/api/courses?q=stroke');
  assert.equal(data.courses[0].saved, true);
  assert.equal((await client()('GET', '/api/courses?q=stroke')).data.courses[0].saved, false);
});

test('launch focus: only emergency medicine is public; admin can widen the catalogue', async () => {
  const pub = client();
  assert.equal((await pub('GET', '/api/courses/dermoscopy-pigmented-lesions')).status, 404, 'non-emergency course is not reachable by direct link');
  const meta = (await pub('GET', '/api/meta')).data;
  assert.equal(meta.focus.slug, 'emergency-medicine');
  assert.deepEqual(meta.specialties, [], 'no other specialty is visible in focus mode');
  assert.ok(meta.topics.some((t) => t.slug === 'neurological-emergencies' && t.course_count === 1), 'emergency topics are listed');
  assert.equal((await pub('GET', '/api/courses?topic=sepsis-shock')).data.courses.length, 1);
  assert.ok(meta.countries.find((c) => c.code === 'KE').languages.includes('sw'), 'countries list the languages spoken there');
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.ok(sitemap.includes('stroke-first-60-minutes') && !sitemap.includes('dermoscopy'));

  const a = client();
  await a('POST', '/api/auth/login', { email: 'admin@medtranslate.local', password: 'TestAdmin12345' });
  assert.ok((await a('GET', '/api/admin/courses')).data.some((c) => c.slug === 'dermoscopy-pigmented-lesions'), 'staff still see every course');
  assert.equal((await a('PUT', '/api/admin/focus', { specialty: 'no-such' })).status, 400);
  assert.equal((await a('PUT', '/api/admin/focus', { specialty: '' })).status, 200);
  assert.equal((await pub('GET', '/api/courses/dermoscopy-pigmented-lesions')).status, 200, 'widened: course is public');
  assert.equal((await pub('GET', '/api/meta')).data.focus, null);
  await a('PUT', '/api/admin/focus', { specialty: 'emergency-medicine' });
  assert.equal((await pub('GET', '/api/courses/dermoscopy-pigmented-lesions')).status, 404);
});

test('planner e-mail reminders: windows, de-duplication, skipped past windows', async () => {
  process.env.DATA_DIR = dataDir; // the modules below open the same database as the server under test
  const { processReminders, zonedToEpoch } = await import('../server/services/reminders.js');
  const { run, get, all } = await import('../server/db.js');
  assert.equal(zonedToEpoch('2026-06-01T09:00', 'Europe/Berlin'), Date.parse('2026-06-01T07:00:00Z'));
  assert.equal(zonedToEpoch('2026-01-15T09:00', 'Africa/Nairobi'), Date.parse('2026-01-15T06:00:00Z'));
  const u = client();
  await u('POST', '/api/auth/register', { email: 'plan-mail@example.test', password: 'Password12345', firstName: 'Mia', lastName: 'Test', country: 'DE', acceptTerms: true, confirmProfessional: true });
  const pre = (await u('GET', '/api/plan/prefs')).data;
  assert.equal(pre.enabled, false);
  assert.equal((await u('PUT', '/api/plan/prefs', { enabled: true, offsets: [], tz: 'UTC' })).status, 400);
  assert.equal((await u('PUT', '/api/plan/prefs', { enabled: true, offsets: [1440, 60], tz: 'Europe/Berlin' })).data.enabled, true);
  const start = new Date(Date.now() + 26 * 3600e3 + 2 * 60e3).toISOString().slice(0, 16); // UTC wall clock; tz is Berlin → real start is ~2 h earlier
  const item = (await u('POST', '/api/plan', { slug: 'sepsis-hour-one', startAt: start })).data;
  const me = get("SELECT id FROM users WHERE email = 'plan-mail@example.test'");
  // Planned "just now" → no reminder is sent for windows that had already begun when it was created.
  assert.equal(await processReminders(Date.now()), 0);
  // Pretend the item was created long ago, then move the clock to the 24 h window.
  run("UPDATE plan_items SET created_at = datetime('now','-3 days') WHERE id = ?", item.id);
  const startMs = (await import('../server/services/reminders.js')).zonedToEpoch(start, 'Europe/Berlin');
  assert.equal(await processReminders(startMs - 1440 * 60e3 + 30e3), 1);
  assert.equal(await processReminders(startMs - 1440 * 60e3 + 90e3), 0, 'sent only once');
  assert.equal(await processReminders(startMs - 60 * 60e3 + 10e3), 1);
  assert.equal(await processReminders(startMs + 1000), 0, 'nothing after the start');
  const mails = all('SELECT * FROM outbox WHERE user_id = ? ORDER BY id', me.id);
  assert.equal(mails.length, 2);
  assert.ok(/Tomorrow/i.test(mails[0].subject) && /In 1 hour/i.test(mails[1].subject));
  assert.equal(mails[0].status, 'not_configured', 'no mail provider configured → stored, not delivered');
  assert.ok(mails[0].body_text.includes('/courses/sepsis-hour-one') && mails[0].body_text.includes('unsubscribe?u='));
  const link = mails[0].body_text.match(/http\S+unsubscribe\?\S+/)[0];
  assert.equal((await fetch(link.replace(/^https?:\/\/[^/]+/, BASE))).status, 200);
  assert.equal((await u('GET', '/api/plan/prefs')).data.enabled, false, 'unsubscribe link switches reminders off');
  assert.equal((await fetch(`${BASE}/api/plan/unsubscribe?u=${me.id}&t=bad`)).status, 400);
});
