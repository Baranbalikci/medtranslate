// Generates the synthetic DEMO lecture videos + posters with ffmpeg.
// The videos are simple slide decks rendered from the demo transcript, so the
// repository contains no third-party video content.
//
//   npm run media            (requires ffmpeg with libx264 + drawtext)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { COURSES, SPECIALTIES } from '../server/seed-data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_V = path.join(ROOT, 'media', 'videos');
const OUT_P = path.join(ROOT, 'media', 'posters');
fs.mkdirSync(OUT_V, { recursive: true });
fs.mkdirSync(OUT_P, { recursive: true });

const FONT_DIRS = ['/usr/share/fonts/opentype/inter', '/usr/share/fonts/truetype/dejavu'];
const font = (names) => {
  for (const d of FONT_DIRS) for (const n of names) { const f = path.join(d, n); if (fs.existsSync(f)) return f; }
  throw new Error(`Font not found: ${names.join(', ')}`);
};
const FONT_BOLD = font(['Inter-SemiBold.otf', 'DejaVuSans-Bold.ttf']);
const FONT_REG = font(['Inter-Regular.otf', 'DejaVuSans.ttf']);
const FONT_MED = font(['Inter-Medium.otf', 'DejaVuSans.ttf']);

const ACCENTS = ['0x22D3EE', '0x38BDF8', '0x2DD4BF', '0x60A5FA'];
const wrap = (text, width) => {
  const words = text.split(' '); const lines = []; let line = '';
  for (const w of words) { if ((line + ' ' + w).trim().length > width) { lines.push(line.trim()); line = w; } else line += ' ' + w; }
  if (line.trim()) lines.push(line.trim());
  return lines.join('\n');
};

const only = process.argv.slice(2);
for (const [i, c] of COURSES.entries()) {
  if (only.length && !only.includes(c.slug)) continue;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-media-'));
  const tf = (name, text) => { const p = path.join(tmp, name); fs.writeFileSync(p, text); return p.replace(/:/g, '\\:'); };
  const duration = Math.ceil(c.cues.at(-1)[1] + 3);
  const accent = ACCENTS[i % ACCENTS.length];
  const specialty = SPECIALTIES.find((s) => s[0] === c.specialty)[1].toUpperCase();

  const f = [];
  // Background, accent glow and frame.
  f.push(`drawbox=x=0:y=0:w=iw:h=ih:color=0x0A1A33@1:t=fill`);
  f.push(`drawbox=x=0:y=ih-6:w=iw*t/${duration}:h=6:color=${accent}@0.9:t=fill`);
  f.push(`drawbox=x=80:y=96:w=56:h=4:color=${accent}@1:t=fill`);
  f.push(`drawtext=fontfile=${FONT_MED}:textfile='${tf('spec.txt', specialty)}':x=80:y=60:fontsize=22:fontcolor=${accent}`);
  f.push(`drawtext=fontfile=${FONT_REG}:textfile='${tf('course.txt', c.title)}':x=80:y=118:fontsize=24:fontcolor=0xCBD5E1`);
  f.push(`drawtext=fontfile=${FONT_REG}:textfile='${tf('demo.txt', 'DEMO CONTENT  ·  Synthetic lecture video for platform testing  ·  Not clinical guidance')}':x=80:y=h-56:fontsize=18:fontcolor=0x94A3B8`);

  // Title slide.
  const first = c.cues[0][0];
  f.push(`drawtext=fontfile=${FONT_BOLD}:textfile='${tf('title.txt', wrap(c.title, 26))}':x=80:y=(h-text_h)/2:fontsize=64:line_spacing=14:fontcolor=white:enable='lt(t,${first})'`);
  // One slide per cue.
  c.cues.forEach(([start, , speaker, , slide], k) => {
    const until = k + 1 < c.cues.length ? c.cues[k + 1][0] : duration;
    const en = `enable='between(t,${start},${until})'`;
    f.push(`drawtext=fontfile=${FONT_BOLD}:textfile='${tf(`s${k}.txt`, wrap(slide, 28))}':x=80:y=(h-text_h)/2-10:fontsize=60:line_spacing=14:fontcolor=white:${en}`);
    f.push(`drawtext=fontfile=${FONT_MED}:textfile='${tf(`n${k}.txt`, `${String(k + 1).padStart(2, '0')} / ${String(c.cues.length).padStart(2, '0')}`)}':x=w-tw-80:y=60:fontsize=22:fontcolor=0x94A3B8:${en}`);
    f.push(`drawtext=fontfile=${FONT_MED}:textfile='${tf(`sp${k}.txt`, `●  ${speaker}`)}':x=w-tw-80:y=h-56:fontsize=18:fontcolor=${accent}:${en}`);
  });

  const video = path.join(OUT_V, `${c.slug}.mp4`);
  const poster = path.join(OUT_P, `${c.slug}.jpg`);
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x0A1A33:s=1280x720:r=10:d=${duration}`,
    '-vf', f.join(','), '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-crf', '30', '-pix_fmt', 'yuv420p',
    '-g', '20', '-movflags', '+faststart', '-an', video]);
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', '1', '-i', video, '-frames:v', '1', '-vf', 'scale=800:-2', '-q:v', '4', poster]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`✓ ${c.slug}  (${duration}s, ${(fs.statSync(video).size / 1024).toFixed(0)} KB)`);
}
