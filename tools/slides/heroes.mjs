// Line-art illustrations for the demo lecture slides (SVG, viewBox 0 0 600 600).
// Each hero draws a recognisable subject in glowing strokes; `overlay` adds slide-specific
// annotations (a clock ring, a highlighted ST segment, review areas …).
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const defs = (a) => `<defs>
  <linearGradient id="ga" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#A5F3FC"/></linearGradient>
  <radialGradient id="gf" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${a}" stop-opacity=".4"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

const rings = (a) => `<circle cx="300" cy="300" r="285" fill="url(#gf)"/>
  <circle cx="300" cy="300" r="270" fill="none" stroke="${a}" stroke-opacity=".16" stroke-dasharray="2 10"/>
  <circle cx="300" cy="300" r="225" fill="none" stroke="#fff" stroke-opacity=".05"/>`;

const ecg = (a, i) => {
  const heart = 'M300 478 C110 352 112 196 224 188 C268 185 296 214 300 236 C304 214 332 185 376 188 C488 196 490 352 300 478Z';
  const trace = 'M20 318 H118 q14 -30 30 0 H190 l9 16 l15 -168 l17 208 l9 -56 H318 q34 -66 68 0 H580';
  const o = {
    1: `<g transform="translate(468 150)"><circle r="62" fill="#0B1D3A" stroke="#fff" stroke-opacity=".15"/><circle r="52" fill="none" stroke="${a}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 52 * 0.17} 999" transform="rotate(-90)" filter="url(#glow)"/><text y="9" text-anchor="middle" fill="#fff" font-size="26" font-weight="800">10′</text></g>`,
    2: `<rect x="236" y="262" width="92" height="116" rx="14" fill="${a}" fill-opacity=".14" stroke="${a}" stroke-dasharray="7 5"/><text x="282" y="250" text-anchor="middle" fill="${a}" font-size="22" font-weight="800">ST ↑</text><path d="M400 330 v-52 M388 292 l12 -14 l12 14" stroke="#fff" stroke-width="3" fill="none"/><text x="400" y="360" text-anchor="middle" fill="#fff" font-size="20" font-weight="700">1 mm</text>`,
    4: `<g transform="translate(300 540)"><path d="M-70 0 a70 70 0 1 1 20 -50" fill="none" stroke="${a}" stroke-width="6" stroke-linecap="round" filter="url(#glow)"/><path d="M-62 -58 l12 8 l-16 8" fill="none" stroke="${a}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>`,
    5: ['V7', 'V8', 'V9'].map((l, k) => `<g transform="translate(${420 + k * 54} ${470 - k * 14})"><circle r="21" fill="#0B1D3A" stroke="${a}" stroke-width="2"/><text y="6" text-anchor="middle" fill="#fff" font-size="15" font-weight="800">${l}</text></g>`).join(''),
  };
  return `${rings(a)}<path d="${heart}" fill="${a}" fill-opacity=".09" stroke="${a}" stroke-width="3" filter="url(#glow)"/>
  <path d="${trace}" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>${o[i] || ''}`;
};

const brain = (a, i) => {
  const r = rng(7); const pts = [];
  const inside = (x, y) => ((x - 235) / 135) ** 2 + ((y - 255) / 150) ** 2 < 1 || ((x - 365) / 135) ** 2 + ((y - 255) / 150) ** 2 < 1 || ((x - 300) / 74) ** 2 + ((y - 432) / 40) ** 2 < 1;
  while (pts.length < 78) { const x = 90 + r() * 420; const y = 90 + r() * 400; if (inside(x, y)) pts.push([x, y, 1.6 + r() * 3.2]); }
  let edges = '';
  pts.forEach(([x, y], k) => pts.slice(k + 1).forEach(([x2, y2]) => { if (Math.hypot(x - x2, y - y2) < 74) edges += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}"/>`; }));
  const vessel = i >= 4 ? `<path d="M40 505 C 190 470 250 395 340 372 S 500 300 565 285" fill="none" stroke="#FB7185" stroke-width="9" stroke-linecap="round" opacity=".9"/><circle cx="338" cy="373" r="15" fill="#FB7185" filter="url(#glow)"/><circle cx="338" cy="373" r="27" fill="none" stroke="#FB7185" stroke-dasharray="4 5"/>` : '';
  const clock = i === 1 ? `<g transform="translate(486 128)"><circle r="46" fill="#0B1D3A" stroke="#fff" stroke-opacity=".15"/><path d="M0 -26 V0 L18 12" stroke="${a}" stroke-width="5" fill="none" stroke-linecap="round"/></g>` : '';
  const sug = i === 2 ? `<g transform="translate(470 470)"><path d="M0 -44 C 26 -10 30 14 0 26 C -30 14 -26 -10 0 -44Z" fill="${a}" fill-opacity=".25" stroke="${a}" stroke-width="3"/></g>` : '';
  return `${rings(a)}<g stroke="${a}" stroke-opacity=".28" stroke-width="1.1">${edges}</g>
  <g fill="${a}" filter="url(#glow)">${pts.map(([x, y, rr]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}"/>`).join('')}</g>${vessel}${clock}${sug}`;
};

const sepsis = (a, i) => {
  const r = rng(11); let cells = '';
  for (let k = 0; k < 12; k++) { const x = 40 + k * 48 + r() * 14; const y = 262 + Math.sin(k * 0.7) * 38 + r() * 40 - 10; cells += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><circle r="${20 + r() * 6}" fill="#FB7185" fill-opacity=".16" stroke="#FB7185" stroke-width="2.2"/><circle r="8" fill="none" stroke="#FB7185" stroke-opacity=".6"/></g>`; }
  let bact = '';
  for (let k = 0; k < 10; k++) { const x = 70 + r() * 460; const y = 215 + r() * 170; bact += `<rect x="-17" y="-7" width="34" height="14" rx="7" fill="${a}" fill-opacity=".35" stroke="${a}" stroke-width="2" transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${(r() * 180).toFixed(0)})"/>`; }
  const t = i === 2 ? `<g transform="translate(470 130)"><rect x="-22" y="-60" width="44" height="120" rx="22" fill="#0B1D3A" stroke="#fff" stroke-opacity=".25" stroke-width="2"/><rect x="-16" y="0" width="32" height="54" rx="16" fill="${a}" fill-opacity=".65"/></g>` : '';
  const drip = i === 4 ? `<g transform="translate(300 120)"><path d="M0 -60 C 34 -14 40 24 0 40 C -40 24 -34 -14 0 -60Z" fill="#38BDF8" fill-opacity=".3" stroke="#38BDF8" stroke-width="3"/></g>` : '';
  return `${rings(a)}<path d="M0 205 C150 140 300 290 600 190 L600 410 C 300 510 150 360 0 430Z" fill="#FB7185" fill-opacity=".05"/>
  <path d="M0 205 C150 140 300 290 600 190" fill="none" stroke="${a}" stroke-width="3" filter="url(#glow)"/><path d="M0 430 C150 360 300 510 600 410" fill="none" stroke="${a}" stroke-width="3" filter="url(#glow)"/>${cells}${bact}${t}${drip}`;
};

const airway = (a, i) => {
  const L = 'M272 232 C190 200 112 262 100 388 C94 458 132 496 194 474 C254 452 274 402 274 336Z';
  const R = 'M328 232 C410 200 488 262 500 388 C506 458 468 496 406 474 C346 452 326 402 326 336Z';
  let br = ''; for (let k = 0; k < 5; k++) br += `<path d="M${268 - k * 4} ${300 + k * 24} L ${180 - k * 8} ${330 + k * 28}" /><path d="M${332 + k * 4} ${300 + k * 24} L ${420 + k * 8} ${330 + k * 28}" />`;
  const o2 = i === 2 ? [[170, 380], [210, 430], [150, 440], [430, 380], [390, 430], [450, 440]].map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${10 + (k % 3) * 3}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>`).join('') : '';
  const tube = i === 1 || i === 3 ? `<path d="M300 60 V300" stroke="#FB7185" stroke-width="8" stroke-linecap="round" stroke-dasharray="${i === 3 ? '10 8' : '0'}"/>` : '';
  return `${rings(a)}<g fill="${a}" fill-opacity=".1" stroke="${a}" stroke-width="3" filter="url(#glow)"><path d="${L}"/><path d="${R}"/></g>
  <path d="M300 96 V250 M300 250 L248 336 M300 250 L352 336" stroke="${a}" stroke-width="20" stroke-linecap="round" fill="none" opacity=".32"/>
  <path d="M300 96 V250 M300 250 L248 336 M300 250 L352 336" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" filter="url(#glow)"/>
  <g stroke="${a}" stroke-width="2" fill="none" opacity=".7">${br}</g>${o2}${tube}`;
};

const gut = (a, i) => {
  const path = 'M110 150 C 290 80 490 112 478 212 C 466 312 134 262 134 366 C 134 466 478 402 478 476 C 478 530 340 532 300 508';
  const drops = [[134, 366], [150, 410], [118, 420]].map(([x, y], k) => `<path d="M${x} ${y - 26 + k * 4} c 14 18 18 30 0 40 c -18 -10 -14 -22 0 -40Z" fill="#FB7185" fill-opacity=".85"/>`).join('');
  const clock = i === 3 ? `<g transform="translate(486 112)"><circle r="46" fill="#0B1D3A" stroke="#fff" stroke-opacity=".15"/><path d="M0 -26 V0 L18 12" stroke="${a}" stroke-width="5" fill="none" stroke-linecap="round"/></g>` : '';
  return `${rings(a)}<path d="${path}" fill="none" stroke="${a}" stroke-opacity=".22" stroke-width="46" stroke-linecap="round"/>
  <path d="${path}" fill="none" stroke="${a}" stroke-width="5" stroke-linecap="round" filter="url(#glow)"/>
  <path d="${path}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" stroke-dasharray="3 12" stroke-linecap="round"/>${drops}${clock}`;
};

const eye = (a, i) => {
  const r = rng(5); let veins = '';
  for (let k = 0; k < 14; k++) { const left = k % 2 === 0; const x0 = left ? 70 + r() * 40 : 530 - r() * 40; const y0 = 280 + r() * 50; const x1 = left ? 200 + r() * 40 : 400 - r() * 40; const y1 = 270 + r() * 60; veins += `<path d="M${x0.toFixed(0)} ${y0.toFixed(0)} Q ${((x0 + x1) / 2).toFixed(0)} ${(y0 - 30 + r() * 50).toFixed(0)} ${x1.toFixed(0)} ${y1.toFixed(0)}"/>`; }
  const ring = i === 1 || i === 3 ? `<circle cx="300" cy="300" r="62" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 6" opacity=".7"/>` : '';
  return `${rings(a)}<path d="M40 300 C150 170 450 170 560 300 C450 430 150 430 40 300Z" fill="${a}" fill-opacity=".08" stroke="${a}" stroke-width="3.5" filter="url(#glow)"/>
  <g stroke="#FB7185" stroke-opacity=".7" stroke-width="2" fill="none">${veins}</g>
  <circle cx="300" cy="300" r="96" fill="url(#ga)" fill-opacity=".28" stroke="${a}" stroke-width="3"/>
  <g stroke="${a}" stroke-opacity=".4">${Array.from({ length: 22 }, (_, k) => { const t = (k / 22) * Math.PI * 2; return `<line x1="${(300 + Math.cos(t) * 40).toFixed(0)}" y1="${(300 + Math.sin(t) * 40).toFixed(0)}" x2="${(300 + Math.cos(t) * 94).toFixed(0)}" y2="${(300 + Math.sin(t) * 94).toFixed(0)}"/>`; }).join('')}</g>
  <circle cx="300" cy="300" r="38" fill="#050D1E"/><circle cx="282" cy="282" r="9" fill="#fff" opacity=".85"/>${ring}`;
};

const xray = (a, i) => {
  let ribs = '';
  for (let k = 0; k < 7; k++) { const y0 = 150 + k * 44; ribs += `<path d="M298 ${y0} Q 190 ${y0 - 44} ${92 - k * 2} ${y0 + 96}"/><path d="M302 ${y0} Q 410 ${y0 - 44} ${508 + k * 2} ${y0 + 96}"/>`; }
  const Lf = 'M282 150 C200 140 132 222 130 362 C128 450 200 482 272 452 C294 402 292 250 282 150Z';
  const Rf = 'M318 150 C400 140 468 222 470 362 C472 450 400 482 328 452 C306 402 308 250 318 150Z';
  const review = i === 3 ? `<g fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 6"><circle cx="196" cy="178" r="40"/><circle cx="404" cy="178" r="40"/><ellipse cx="350" cy="400" rx="46" ry="62"/><path d="M110 476 H490"/></g>` : '';
  const frame = i === 1 ? `<rect x="60" y="100" width="480" height="420" rx="14" fill="none" stroke="#fff" stroke-opacity=".6" stroke-dasharray="8 6" stroke-width="2.5"/>` : '';
  return `${rings(a)}<g fill="none" stroke="${a}" stroke-opacity=".55" stroke-width="3" stroke-linecap="round">${ribs}</g>
  <g fill="#fff" fill-opacity=".06" stroke="${a}" stroke-width="3" filter="url(#glow)"><path d="${Lf}"/><path d="${Rf}"/></g>
  <ellipse cx="338" cy="396" rx="60" ry="82" fill="${a}" fill-opacity=".14"/>
  <path d="M300 100 V520" stroke="#fff" stroke-opacity=".3" stroke-dasharray="3 9" stroke-width="3"/><path d="M110 130 L292 168 M490 130 L308 168" stroke="${a}" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>${review}${frame}`;
};

const child = (a, i) => `${rings(a)}<g filter="url(#glow)" stroke="${a}" stroke-width="4" fill="none">
  <rect x="268" y="96" width="64" height="322" rx="32" fill="${a}" fill-opacity=".08"/><circle cx="300" cy="462" r="64" fill="${a}" fill-opacity=".14"/></g>
  <rect x="283" y="${i === 1 ? 190 : 250}" width="34" height="${i === 1 ? 250 : 190}" rx="17" fill="${a}"/><circle cx="300" cy="462" r="50" fill="${a}"/>
  <g stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round">${Array.from({ length: 7 }, (_, k) => `<line x1="350" y1="${130 + k * 44}" x2="${k % 2 ? 372 : 388}" y2="${130 + k * 44}"/>`).join('')}</g>
  <g fill="${a}" opacity=".7"><circle cx="440" cy="190" r="5"/><circle cx="170" cy="300" r="4"/><circle cx="470" cy="360" r="6"/><circle cx="130" cy="420" r="5"/></g>
  ${[[450, 250], [150, 190]].map(([x, y]) => `<path d="M${x} ${y - 24} L${x + 6} ${y - 6} L${x + 24} ${y} L${x + 6} ${y + 6} L${x} ${y + 24} L${x - 6} ${y + 6} L${x - 24} ${y} L${x - 6} ${y - 6}Z" fill="#fff" opacity=".75"/>`).join('')}`;

const generic = (a) => `${rings(a)}<g fill="none" stroke="${a}" stroke-width="3" filter="url(#glow)"><circle cx="300" cy="300" r="120"/><circle cx="300" cy="300" r="190" stroke-opacity=".5"/></g>
  <g fill="${a}">${Array.from({ length: 14 }, (_, k) => { const t = (k / 14) * Math.PI * 2; return `<circle cx="${(300 + Math.cos(t) * 190).toFixed(0)}" cy="${(300 + Math.sin(t) * 190).toFixed(0)}" r="6"/>`; }).join('')}</g>`;

export const HEROES = { ecg, brain, sepsis, airway, gut, eye, xray, child, generic };
