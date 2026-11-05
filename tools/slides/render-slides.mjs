// Renders the DEMO lecture videos + posters: designed slides (HTML → PNG via Playwright),
// assembled with ffmpeg crossfades. Slide timings follow the subtitle cues, so the dubbed
// audio tracks stay in sync.   npm run media [slug…]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { COURSES, TOPICS, COURSE_TOPIC, PROVIDERS } from '../../server/seed-data.js';
import { HEROES, defs } from './heroes.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_V = path.join(ROOT, 'media', 'videos'); const OUT_P = path.join(ROOT, 'media', 'posters');
fs.mkdirSync(OUT_V, { recursive: true }); fs.mkdirSync(OUT_P, { recursive: true });

const HERO = { 'acs-early-ecg-recognition': 'ecg', 'stroke-first-60-minutes': 'brain', 'sepsis-hour-one': 'sepsis', 'rapid-sequence-induction-checklist': 'airway',
  'upper-gi-bleeding-initial-management': 'gut', 'red-eye-when-to-refer': 'eye', 'chest-xray-systematic-reading': 'xray', 'pediatric-fever-without-source': 'child' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

function slideHtml({ c, topic, accent, hero, k, total, heading, isTitle, duration }) {
  const svg = `<svg viewBox="0 0 600 600" width="560" height="560">${defs(accent)}${(HEROES[hero] || HEROES.generic)(accent, k)}</svg>`;
  const rail = Array.from({ length: total }, (_, i) => `<i class="${i < k ? 'done' : i === k ? 'now' : ''}"></i>`).join('');
  return `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1280px;height:720px;overflow:hidden;font-family:Inter,'DejaVu Sans',sans-serif;color:#fff;--a:${accent};
    background:radial-gradient(900px 600px at 82% 40%,${accent}2e,transparent 62%),radial-gradient(700px 500px at 0% 100%,#0EA5E91f,transparent 60%),linear-gradient(135deg,#0B1D3A,#050D1E)}
  .grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at 70% 40%,#000,transparent 75%)}
  .hero{position:absolute;right:30px;top:80px}
  .left{position:absolute;left:72px;top:0;bottom:0;width:640px;display:flex;flex-direction:column;justify-content:center;padding-bottom:30px}
  .brand{position:absolute;left:72px;top:52px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px;letter-spacing:-.01em}
  .brand b{color:#22D3EE;font-weight:700}
  .logo{width:32px;height:32px;border-radius:9px;background:#0A1A33;border:1px solid #ffffff22;display:grid;place-items:center}
  .tag{display:inline-flex;align-self:flex-start;align-items:center;gap:10px;padding:8px 16px;border-radius:999px;border:1px solid ${accent}77;background:${accent}1c;color:${accent};font-weight:600;font-size:17px;letter-spacing:.06em;text-transform:uppercase}
  .tag:before{content:"";width:8px;height:8px;border-radius:50%;background:${accent};box-shadow:0 0 12px ${accent}}
  .num{margin-top:34px;font-size:22px;font-weight:600;color:${accent};letter-spacing:.14em}
  h1{margin-top:12px;font-weight:800;letter-spacing:-.03em;line-height:1.04;font-size:${isTitle ? (heading.length > 40 ? 58 : 70) : 76}px;max-width:620px}
  .sub{margin-top:26px;font-size:24px;color:#B6C4D8;font-weight:500}
  .sub span{color:#fff}
  .rail{position:absolute;left:72px;bottom:96px;width:560px;display:flex;gap:8px}
  .rail i{flex:1;height:5px;border-radius:3px;background:#ffffff1f}.rail i.done{background:${accent}99}.rail i.now{background:${accent};box-shadow:0 0 14px ${accent}}
  .foot{position:absolute;left:72px;right:72px;bottom:42px;display:flex;justify-content:space-between;font-size:15px;color:#7C8DA6}
  .demo{display:inline-flex;gap:8px;align-items:center}.demo b{padding:2px 9px;border-radius:6px;background:#FBBF2426;color:#FBBF24;font-weight:700;letter-spacing:.08em;font-size:13px}
  </style><div class="grid"></div><div class="hero">${svg}</div>
  <div class="brand"><span class="logo"><svg width="20" height="20" viewBox="0 0 32 32"><path d="M9 21V11l7 6 7-6v10" fill="none" stroke="#22D3EE" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Med<b>Translate</b></div>
  <div class="left"><span class="tag">${esc(topic)}</span>
  ${isTitle ? '' : `<div class="num">${String(k).padStart(2, '0')} / ${String(total - 1).padStart(2, '0')}</div>`}
  <h1>${esc(heading)}</h1>
  <div class="sub">${isTitle ? `<span>${esc(c.providerName)}</span> · ${total - 1} chapters · ${mmss(duration)} min` : esc(c.title)}</div></div>
  ${isTitle ? '' : `<div class="rail">${rail}</div>`}
  <div class="foot"><span class="demo"><b>DEMO</b> Synthetic lecture for platform testing · not clinical guidance</span><span>${esc(c.title)}</span></div>`;
}

const only = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
for (const c of COURSES) {
  if (only.length && !only.includes(c.slug)) continue;
  const tslug = COURSE_TOPIC[c.slug]; const t = TOPICS.find((x) => x[0] === tslug);
  const topic = t ? t[1] : 'Medical education'; const accent = t ? t[4] : '#22D3EE';
  const hero = HERO[c.slug] || 'generic';
  const duration = Math.ceil(c.cues.at(-1)[1] + 3);
  const cc = { title: c.title, providerName: (PROVIDERS.find((p) => p[0] === c.provider)?.[1] || 'Demo provider').replace(' (Demo)', '') };
  const slides = [{ heading: c.title, isTitle: true, at: 0 }, ...c.cues.map((q, k) => ({ heading: q[4], at: k === 0 ? q[0] : q[0] }))];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-slides-'));
  const files = [];
  for (const [k, s] of slides.entries()) {
    await page.setContent(slideHtml({ c: cc, topic, accent, hero, k, total: slides.length, heading: s.heading, isTitle: !!s.isTitle, duration }));
    await page.waitForTimeout(40);
    const f = path.join(tmp, `s${k}.png`); await page.screenshot({ path: f }); files.push(f);
  }
  // Poster: the title slide.
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', files[0], '-vf', 'scale=800:-2', '-q:v', '3', path.join(OUT_P, `${c.slug}.jpg`)]);
  // Video: crossfaded slides; boundaries follow the cue starts.
  const X = 0.5; const starts = slides.map((s) => s.at); starts[0] = 0;
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  files.forEach((f, k) => { const len = (k + 1 < files.length ? starts[k + 1] - starts[k] + X : duration - starts[k]); args.push('-loop', '1', '-framerate', '10', '-t', String(len.toFixed(2)), '-i', f); });
  let chain = ''; let last = '[0:v]';
  for (let k = 1; k < files.length; k++) { const out = k === files.length - 1 ? '[vx]' : `[x${k}]`; chain += `${last}[${k}:v]xfade=transition=fade:duration=${X}:offset=${(starts[k] - X).toFixed(2)}${out};`; last = out; }
  chain += `[vx]drawbox=x=0:y=ih-6:w=iw*t/${duration}:h=6:color=${accent.replace('#', '0x')}@0.95:t=fill,format=yuv420p[v]`;
  args.push('-filter_complex', chain, '-map', '[v]', '-t', String(duration), '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-crf', '26', '-g', '20', '-movflags', '+faststart', '-an', path.join(OUT_V, `${c.slug}.mp4`));
  execFileSync('ffmpeg', args);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${c.slug} (${duration}s)`);
}
await browser.close();
