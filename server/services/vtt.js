// WebVTT parsing / generation for import, export and admin editing.
const ts = (sec) => {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
};

export function toVtt(cues) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return 'WEBVTT\n\n' + cues.map((c, i) =>
    `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.speaker ? `<v ${c.speaker.replace(/>/g, '')}>` : ''}${esc(c.text)}\n`).join('\n');
}

const parseTs = (s) => {
  const p = s.trim().replace(',', '.').split(':').map(Number);
  if (p.some(isNaN)) return NaN;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};

/** Accepts WebVTT or SRT. Returns [{start, end, speaker, text}]. */
export function parseSubtitles(input) {
  const text = String(input).replace(/\r/g, '').replace(/^﻿/, '');
  const blocks = text.split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split('-->');
    const start = parseTs(a), end = parseTs(b.trim().split(/\s+/)[0]);
    if (isNaN(start) || isNaN(end)) continue;
    let body = lines.slice(ti + 1).join(' ');
    let speaker = null;
    const v = /^<v\s+([^>]+)>/.exec(body);
    if (v) { speaker = v[1].trim(); body = body.slice(v[0].length); }
    body = body.replace(/<\/?[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
    if (body) cues.push({ start, end, speaker, text: body });
  }
  return cues;
}
