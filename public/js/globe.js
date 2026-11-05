// Dotted, rotating globe with glowing connection arcs (canvas 2D, no dependencies).
// Land dots come from a real 2° land mask. Africa and the Americas are lit up in
// warm amber (the regions this platform is built for); arcs fly from the hub to
// them, each ending in a pulsing node that carries a greeting in the local language.
import { LAND } from './landmask.js';

const rad = (d) => (d * Math.PI) / 180;
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function decodeMask() {
  const bin = atob(LAND.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return (x, y) => { const k = y * LAND.w + x; return (bytes[k >> 3] >> (7 - (k & 7))) & 1; };
}

export const HUB = { lat: 52.5, lon: 13.4 }; // Berlin
export const NODES = [
  { name: 'Nairobi', lat: -1.3, lon: 36.8, text: 'Karibu', warm: 1 },
  { name: 'Lagos', lat: 6.5, lon: 3.4, text: 'Ẹ káàbọ̀', warm: 1 },
  { name: 'Addis Ababa', lat: 9.0, lon: 38.7, text: 'እንኳን ደህና መጡ', warm: 1 },
  { name: 'Johannesburg', lat: -26.2, lon: 28.0, text: 'Siyakwamukela', warm: 1 },
  { name: 'Dakar', lat: 14.7, lon: -17.4, text: 'Bienvenue', warm: 1 },
  { name: 'Kinshasa', lat: -4.3, lon: 15.3, text: 'Boyei malamu', warm: 1 },
  { name: 'Lima', lat: -12.0, lon: -77.0, text: 'Allin hamusqayki', warm: 1 },
  { name: 'São Paulo', lat: -23.5, lon: -46.6, text: 'Bem-vindo', warm: 1 },
  { name: 'Port-au-Prince', lat: 18.5, lon: -72.3, text: 'Byenvini', warm: 1 },
  { name: 'Cairo', lat: 30.0, lon: 31.2, text: 'أهلاً وسهلاً', warm: 0 },
  { name: 'Delhi', lat: 28.6, lon: 77.2, text: 'स्वागत है', warm: 0 },
  { name: 'Dhaka', lat: 23.8, lon: 90.4, text: 'স্বাগতম', warm: 0 },
  { name: 'Jakarta', lat: -6.2, lon: 106.8, text: 'Selamat datang', warm: 0 },
  { name: 'Manila', lat: 14.6, lon: 121.0, text: 'Maligayang pagdating', warm: 0 },
];

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ size?: number, labels?: boolean, speed?: number, tilt?: number, interactive?: boolean }} opts
 */
export function createGlobe(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const isLand = decodeMask();
  const tilt = rad(opts.tilt ?? 18);
  const speed = opts.speed ?? 0.0045;
  const showLabels = opts.labels !== false;
  let w = 0; let h = 0; let r = 0; let dpr = 1;
  let rot = rad(-15);          // longitude at the centre of the view
  let target = null;           // eased rotation target
  let drag = null; let vel = 0;
  let raf = 0; let visible = true; let t0 = performance.now();
  let focusRegion = null;

  // Land points on the sphere (lon/lat), thinned so dots look even.
  const pts = [];
  for (let y = 0; y < LAND.h; y++) {
    const lat = 90 - (y + 0.5) * (180 / LAND.h);
    const step = Math.max(1, Math.round(1 / Math.max(0.12, Math.cos(rad(lat)))));
    for (let x = 0; x < LAND.w; x += step) {
      if (!isLand(x, y)) continue;
      const lon = -180 + (x + 0.5) * (360 / LAND.w);
      // Africa and Latin America glow warm.
      const africa = lon > -20 && lon < 52 && lat > -36 && lat < 38;
      const latam = lon > -82 && lon < -34 && lat > -56 && lat < 14;
      pts.push({ lat: rad(lat), lon: rad(lon), warm: africa || latam ? 1 : 0, tw: Math.random() * 6.28 });
    }
  }

  function project(lat, lon, rr = r) {
    const cl = Math.cos(lat);
    const x0 = cl * Math.sin(lon - rot);
    const y0 = Math.sin(lat);
    const z0 = cl * Math.cos(lon - rot);
    const y1 = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
    const z1 = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);
    return { x: w / 2 + x0 * rr, y: h / 2 - y1 * rr, z: z1 };
  }

  function resize() {
    const b = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.max(10, b.width); h = Math.max(10, b.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    r = Math.min(w, h) * (opts.size ?? 0.44);
  }

  // A great-circle arc lifted off the surface.
  function arcPoint(a, b, k, lift) {
    const la1 = rad(a.lat), lo1 = rad(a.lon), la2 = rad(b.lat), lo2 = rad(b.lon);
    const d = Math.acos(Math.min(1, Math.max(-1, Math.sin(la1) * Math.sin(la2) + Math.cos(la1) * Math.cos(la2) * Math.cos(lo2 - lo1))));
    if (d < 1e-4) return project(la1, lo1);
    const A = Math.sin((1 - k) * d) / Math.sin(d); const B = Math.sin(k * d) / Math.sin(d);
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
    const z = A * Math.sin(la1) + B * Math.sin(la2);
    const lat = Math.atan2(z, Math.hypot(x, y)); const lon = Math.atan2(y, x);
    return project(lat, lon, r * (1 + lift * Math.sin(Math.PI * k)));
  }

  const labelEls = [];
  const host = canvas.parentElement;
  if (showLabels && host) {
    for (const n of NODES) {
      const el = document.createElement('span');
      el.className = `globe-label${n.warm ? ' warm' : ''}`;
      el.textContent = n.text;
      el.setAttribute('aria-hidden', 'true');
      host.append(el); labelEls.push(el);
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const t = (now - t0) / 1000;
    if (drag) { /* rotation follows the pointer */ }
    else if (target != null) {
      let d = ((target - rot + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      rot += d * 0.06;
      if (Math.abs(d) < 0.002) target = null;
    } else rot += (vel || speed);
    vel *= 0.95; if (Math.abs(vel) < speed) vel = 0;
    draw(t);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    // atmosphere
    const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.82, w / 2, h / 2, r * 1.35);
    g.addColorStop(0, 'rgba(34,211,238,.20)'); g.addColorStop(0.5, 'rgba(14,165,233,.06)'); g.addColorStop(1, 'rgba(14,165,233,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w / 2, h / 2, r * 1.35, 0, 7); ctx.fill();
    // body
    const body = ctx.createRadialGradient(w / 2 - r * 0.35, h / 2 - r * 0.4, r * 0.1, w / 2, h / 2, r);
    body.addColorStop(0, 'rgba(24,52,98,.85)'); body.addColorStop(1, 'rgba(6,16,36,.92)');
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(103,232,249,.35)'; ctx.lineWidth = 1; ctx.stroke();

    // graticule
    ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(103,232,249,.07)';
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath(); let started = false;
      for (let lon = -180; lon <= 180; lon += 6) { const p = project(rad(lat), rad(lon)); if (p.z < 0) { started = false; continue; } if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y); }
      ctx.stroke();
    }

    // land dots
    const dot = Math.max(1.1, r / 150);
    for (const p of pts) {
      const q = project(p.lat, p.lon);
      if (q.z < 0.02) continue;
      const a = 0.28 + 0.72 * q.z;
      const tw = 0.75 + 0.25 * Math.sin(t * 1.6 + p.tw);
      ctx.fillStyle = p.warm ? `rgba(251,191,36,${(a * tw * 0.95).toFixed(3)})` : `rgba(103,232,249,${(a * tw * 0.7).toFixed(3)})`;
      ctx.fillRect(q.x - dot / 2, q.y - dot / 2, dot, dot);
    }

    // arcs + nodes
    const hub = project(rad(HUB.lat), rad(HUB.lon));
    NODES.forEach((n, i) => {
      const warm = n.warm;
      const phase = (t * 0.35 + i * 0.37) % 1.6;
      const head = Math.min(1, phase);
      const fade = phase > 1 ? 1 - (phase - 1) / 0.6 : 1;
      ctx.lineWidth = 1.2;
      let prev = null;
      for (let s = 0; s <= 28; s++) {
        const k = (s / 28) * head;
        const p = arcPoint(HUB, n, k, 0.22);
        if (prev && p.z > 0 && prev.z > 0) {
          ctx.strokeStyle = warm ? `rgba(251,191,36,${(0.65 * fade * (s / 28)).toFixed(3)})` : `rgba(103,232,249,${(0.55 * fade * (s / 28)).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
        prev = p;
      }
      if (prev && prev.z > 0 && head < 1) { ctx.fillStyle = warm ? '#FDE68A' : '#CFFAFE'; ctx.beginPath(); ctx.arc(prev.x, prev.y, 2.2, 0, 7); ctx.fill(); }
      const np = project(rad(n.lat), rad(n.lon));
      const el = labelEls[i];
      if (np.z > 0.12) {
        const pulse = (t * 0.9 + i * 0.5) % 1.6;
        ctx.strokeStyle = warm ? `rgba(251,191,36,${Math.max(0, 0.6 - pulse * 0.4).toFixed(3)})` : `rgba(103,232,249,${Math.max(0, 0.5 - pulse * 0.35).toFixed(3)})`;
        ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(np.x, np.y, 3 + pulse * 11, 0, 7); ctx.stroke();
        ctx.fillStyle = warm ? '#FBBF24' : '#67E8F9'; ctx.beginPath(); ctx.arc(np.x, np.y, 3, 0, 7); ctx.fill();
        if (el) { el.style.transform = `translate(${np.x.toFixed(1)}px, ${np.y.toFixed(1)}px)`; el.style.opacity = String(Math.min(1, (np.z - 0.12) * 3)); el.style.display = ''; }
      } else if (el) el.style.display = 'none';
    });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hub.x, hub.y, hub.z > 0 ? 3.4 : 0, 0, 7); ctx.fill();
    // rim light
    const rim = ctx.createRadialGradient(w / 2, h / 2, r * 0.9, w / 2, h / 2, r * 1.02);
    rim.addColorStop(0, 'rgba(103,232,249,0)'); rim.addColorStop(1, 'rgba(103,232,249,.28)');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(w / 2, h / 2, r * 1.02, 0, 7); ctx.fill();
  }

  // pointer drag to spin
  const down = (e) => { drag = { x: e.clientX, rot }; canvas.setPointerCapture?.(e.pointerId); vel = 0; target = null; };
  const move = (e) => { if (!drag) return; const nr = drag.rot - ((e.clientX - drag.x) / r) * 0.9; vel = (nr - rot) * 0.6; rot = nr; };
  const up = () => { drag = null; };
  if (opts.interactive !== false) {
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.style.cursor = 'grab'; canvas.style.touchAction = 'pan-y';
  }
  const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  ro?.observe(canvas); resize();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }) : null;
  io?.observe(canvas);

  if (reduce()) { draw(2); } else raf = requestAnimationFrame(frame);

  return {
    /** Smoothly turn the globe so a region faces the viewer. */
    focus(region) {
      const REG = { africa: 20, americas: -62, mena: 40, asia: 95, europe: 12 };
      focusRegion = region; if (REG[region] != null) target = rad(REG[region]);
      if (reduce()) { rot = target ?? rot; target = null; draw(2); }
    },
    get region() { return focusRegion; },
    destroy() { cancelAnimationFrame(raf); ro?.disconnect(); io?.disconnect(); labelEls.forEach((e) => e.remove()); },
  };
}
