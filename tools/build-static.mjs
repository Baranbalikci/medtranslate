// Builds a self-contained static demo of MedTranslate (no server needed), e.g.
// for previewing inside Claude as an Artifact or on any static host.
//
//   npm run build:static        → dist/static/index.html + media/
//
// 1. Starts the real server on a temporary database and exports a snapshot of the
//    published catalogue (courses, released tracks, subtitle cues) via the API.
// 2. Bundles the SPA with the in-browser API (public/js/static-api.js) into one
//    inline script; CSS is inlined as well. Media files are copied next to it.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist', 'static');
const PORT = 3990;
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'StaticBuild12345';

async function snapshot() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-static-'));
  const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/server.js'], {
    cwd: ROOT, env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, ADMIN_PASSWORD: PW, ANTHROPIC_API_KEY: '', STRIPE_SECRET_KEY: '' }, stdio: 'ignore',
  });
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/api/meta`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
    const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'medtranslate' }, body: JSON.stringify({ email: 'admin@medtranslate.local', password: PW }) });
    const cookie = login.headers.getSetCookie().find((c) => c.startsWith('mt_session=')).split(';')[0];
    const get = (p) => fetch(BASE + p, { headers: { Cookie: cookie } }).then((r) => r.json());
    const rel = (u) => (u ? u.replace(/^\/media\//, 'media/') : u);

    const meta = await get('/api/meta');
    meta.integrations = { aiTranslation: { connected: false, reason: 'Static demo.' }, payments: { mode: 'demo' }, tts: { connected: false, fallback: 'browser_speech_synthesis' } };
    const { courses } = await get('/api/courses');
    const out = {};
    for (const c of courses) {
      const d = await get(`/api/courses/${c.slug}`);
      const play = await get(`/api/courses/${c.slug}/play`);
      const cues = {};
      for (const t of d.tracks) cues[t.language] = (await get(`/api/courses/${c.slug}/cues?lang=${t.language}`)).cues;
      const { entitlement, saved, progress, related, ...rest } = d;
      out[c.slug] = { ...rest, poster: rel(d.poster), media: rel(play.mediaUrl.split('?')[0]), mediaHasAudio: play.mediaHasAudio,
        // Audio-only MP4 (.m4a) is published as .mp4 so static hosts serve it with a media type.
        tracks: play.tracks.map((t) => ({ ...t, audioUrl: t.audioUrl ? rel(t.audioUrl.split('?')[0]).replace(/\.m4a$/, '.mp4') : null })), cues };
    }
    return { meta, courses: out, operator: await get('/api/legal/operator') };
  } finally {
    srv.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

const snap = await snapshot();
console.log(`Snapshot: ${Object.keys(snap.courses).length} courses`);

const result = await esbuild.build({
  entryPoints: [path.join(ROOT, 'public/js/app.js')],
  bundle: true, format: 'iife', minify: true, write: false, target: 'es2022', legalComments: 'none',
  define: { MT_SNAPSHOT: JSON.stringify(snap) },
  plugins: [{
    name: 'static-api',
    setup(b) {
      b.onResolve({ filter: /(^|\/)live\.js$/ }, (args) => ({ path: path.join(path.dirname(args.importer), 'live-static.js') }));
      b.onResolve({ filter: /views\/admin\.js$/ }, (args) => ({ path: path.join(path.dirname(args.importer), 'views/admin-static.js') }));
      b.onResolve({ filter: /(^|\/)api\.js$/ }, (args) => ({ path: path.join(path.dirname(args.importer), args.path.replace(/api\.js$/, 'static-api.js')) }));
    },
  }],
});
let js = result.outputFiles[0].text.replaceAll('"/media/posters/', '"media/posters/').replaceAll('/media/posters/', 'media/posters/');
js = js.replace(/<\/script/gi, '<\\/script');
// Downloads are unavailable in sandboxed viewers; the export link is not rendered in the demo anyway.
js = js.replaceAll('href="/api/account/export" download>', 'href="/api/account/export">');
const css = fs.readFileSync(path.join(ROOT, 'public/css/app.css'), 'utf8');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'media/videos'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'media/posters'), { recursive: true });
for (const c of Object.values(snap.courses)) {
  fs.copyFileSync(path.join(ROOT, c.media), path.join(OUT, c.media));
  fs.copyFileSync(path.join(ROOT, c.poster), path.join(OUT, c.poster));
  for (const t of c.tracks) {
    if (!t.audioUrl) continue;
    fs.mkdirSync(path.dirname(path.join(OUT, t.audioUrl)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, t.audioUrl.replace(/\.mp4$/, '.m4a')), path.join(OUT, t.audioUrl));
  }
}
const page = `<title>MedTranslate</title>
<meta name="description" content="Medical knowledge without language barriers — interactive demo">
<style>${css}</style>
<a class="skip-link" href="#main">Skip to content</a>
<header id="header" class="site-header"></header>
<div id="mobile-host"></div>
<main id="main" tabindex="-1"><div class="page-loader" aria-hidden="true"><span class="spinner"></span></div></main>
<footer id="footer" class="site-footer"></footer>
<script>window.MT_STATIC = true;</script>
<script>${js}</script>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), page);
console.log(`Wrote ${path.relative(ROOT, OUT)}/index.html (${(page.length / 1024).toFixed(0)} KB) + media`);
