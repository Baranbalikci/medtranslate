// MedTranslate player
// ─────────────────────────────────────────────────────────────────────────────
// One <video> element for the whole session. Changing language never touches
// video.src, so playback is never interrupted.
//
// ONE language choice drives subtitles AND voice:
//   original language  → original audio (+ original subtitles if on)
//   released language  → its AI voice track (if it has one) + its subtitles
//   any other language → live AI subtitles (if the licence allows); original
//                        audio keeps playing unless the viewer opts into the
//                        device voice
// The viewer can additionally switch subtitles off or keep the original voice.
//
// Dubbed tracks are fetched completely before they take over (they are small),
// then kept in sync gently: small drift is corrected by nudging the playback
// rate, only large drift (after a seek or stall) triggers one re-seek. This is
// what keeps the voice fluent.
import { api } from './api.js';
import { html, icon, esc, fmtTime } from './ui.js';
import { prefs, state, langInfo } from './store.js';
import { curPath, ask } from './nav.js';
import { translateLive } from './live.js';
import { storedSiteLanguage } from './pagetx.js';

const CPS = { en: 14, de: 13, fr: 14, es: 15, it: 14, pt: 14, tr: 13, nl: 13, pl: 12, ru: 12, uk: 12, ar: 11, hi: 11, zh: 5, ja: 7, ko: 6, id: 13, vi: 12 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const blobCache = new Map();
function fetchBlobUrl(url) {
  if (!url) return Promise.reject(new Error('no url'));
  if (!blobCache.has(url)) {
    const resolver = window.MT_RESOLVE_MEDIA ? window.MT_RESOLVE_MEDIA(url) : fetch(url).then((r) => { if (!r.ok) throw new Error('audio'); return r.blob(); }).then((b) => URL.createObjectURL(b));
    blobCache.set(url, resolver.catch((e) => { blobCache.delete(url); throw e; }));
  }
  return blobCache.get(url);
}

export function createPlayer(root, { slug, title, chapters = [], liveAi = null, onTime, onLanguage, onProgress, onError }) {
  const S = {
    data: null, lang: null, subsOn: prefs.get('subsOn', true), voice: prefs.get('voice', 'translated'), deviceVoice: prefs.get('deviceVoice', false),
    size: prefs.get('subSize', 'm'), position: prefs.get('subPos', 'bottom'), bg: prefs.get('subBg', 0.75), rate: 1,
    store: new Map(), // lang → { cues, live, status, ctl, listeners:Set }
    audio: { mode: 'original', el: null, token: 0, lastSeek: 0 },
    spokenIdx: -1, lastCueIdx: -2, watched: 0, lastTick: 0, lastReport: 0, destroyed: false, voices: [], idleTimer: null,
    previewHit: false, liveAck: false, search: '', tab: null, country: null,
  };

  root.innerHTML = String(html`
    <div class="player" tabindex="0" role="region" aria-label="Video player: ${title}">
      <video playsinline preload="auto"></video>
      <div class="p-subs pos-bottom size-m" aria-live="off"></div>
      <div class="p-top"><span class="p-tag p-tag-lang" hidden></span><span class="p-tag p-tag-demo">DEMO</span></div>
      <div class="p-overlay"><button class="p-bigplay" aria-label="Play">${icon('play', 30)}</button></div>
      <div class="p-loading" hidden><span class="spinner"></span></div>
      <div class="p-hold" hidden><span class="spinner"></span><span>Translating live… playback continues in a moment</span></div>
      <div class="p-controls">
        <div class="p-timeline" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
          <div class="p-track"><div class="p-buffer"></div><div class="p-preview-limit" hidden></div><div class="p-played"></div><div class="p-marks"></div><div class="p-knob"></div></div>
          <div class="p-hover-time"></div>
        </div>
        <div class="p-row">
          <button class="p-btn" data-a="play" aria-label="Play (k)">${icon('play', 20)}</button>
          <button class="p-btn p-hide-xs" data-a="back" aria-label="Back 10 seconds (j)">${icon('rewind', 18)}</button>
          <button class="p-btn p-hide-xs" data-a="fwd" aria-label="Forward 10 seconds (l)">${icon('forward', 18)}</button>
          <div class="p-vol"><button class="p-btn" data-a="mute" aria-label="Mute (m)">${icon('volume', 20)}</button><input type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume"></div>
          <span class="p-time"><span class="cur">0:00</span><span class="dur"> / 0:00</span></span>
          <span class="p-spacer"></span>
          <button class="p-btn" data-a="cc" aria-label="Subtitles (c)" aria-pressed="true">${icon('cc', 20)}</button>
          <button class="p-btn p-lang-btn" data-a="lang" aria-haspopup="true" aria-expanded="false" aria-label="Language">${icon('globe', 17)}<span class="code">EN</span><span class="p-lang-name p-hide-xs"></span></button>
          <button class="p-btn" data-a="settings" aria-haspopup="true" aria-expanded="false" aria-label="Settings">${icon('settings', 19)}</button>
          <button class="p-btn" data-a="fs" aria-label="Fullscreen (f)">${icon('expand', 19)}</button>
        </div>
      </div>
      <div class="p-menu p-langmenu" data-menu="lang" hidden></div>
      <div class="p-menu" data-menu="settings" hidden></div>
      <div class="p-toast"></div>
    </div>
    <div class="p-langbar" aria-label="Language"></div>`);

  const el = root.querySelector('.player');
  const video = el.querySelector('video');
  const q = (s) => el.querySelector(s);
  const subsEl = q('.p-subs'); const tl = q('.p-timeline'); const played = q('.p-played'); const buffer = q('.p-buffer'); const knob = q('.p-knob');
  const hoverT = q('.p-hover-time'); const curEl = q('.cur'); const durEl = q('.dur'); const langMenu = q('[data-menu=lang]'); const setMenu = q('[data-menu=settings]');
  const bar = root.querySelector('.p-langbar');
  const tts = 'speechSynthesis' in window ? window.speechSynthesis : null;

  const flash = (msg) => { const t = q('.p-toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); };
  const duration = () => (isFinite(video.duration) && video.duration > 0 ? video.duration : S.data?.durationSec || 0);
  const originalLang = () => S.data.tracks[0].language;
  const userMuted = () => video.dataset.userMuted === '1';

  // ── language model ──────────────────────────────────────────────────────
  /** What the platform can offer for a language in this course. */
  function langStatus(code) {
    const t = S.data?.tracks.find((x) => x.language === code);
    if (t?.original) return { code, kind: 'original', voice: S.data.mediaHasAudio ? 'original' : 'none', review: 'source', track: t };
    if (t) return { code, kind: 'released', voice: t.audio === 'file' && t.audioUrl ? 'file' : 'none', review: t.review, track: t };
    if (liveAi?.allowed) return { code, kind: 'live', voice: 'none', review: 'live_unreviewed' };
    return null;
  }

  // ── cue store (released, original or live-translated) ───────────────────
  function entry(lang) {
    let e = S.store.get(lang);
    if (!e) { e = { cues: null, live: false, status: 'idle', listeners: new Set(), promise: null }; S.store.set(lang, e); }
    return e;
  }
  const emit = (lang) => {
    const e = entry(lang);
    for (const fn of e.listeners) fn(e.cues || [], e);
    if (lang === S.lang) { S.lastCueIdx = -2; renderSubs(true); updateTag(); releaseHold(); }
  };

  // Like buffering: if the sentence being spoken is not translated yet, wait for it
  // instead of running on without subtitles. Resumes automatically.
  function shouldHold() {
    const e = S.store.get(S.lang);
    if (!e?.live || e.status !== 'translating') return false;
    const i = cueIndexAt(e.cues, video.currentTime);
    return i >= 0 && !e.cues[i].text && i !== S.holdSkip;
  }
  function holdIfNeeded() {
    if (S.held || video.paused || !shouldHold()) return;
    S.held = true; q('.p-hold').hidden = false; video.pause();
  }
  function releaseHold() {
    if (!S.held || shouldHold()) return;
    S.held = false; q('.p-hold').hidden = true; video.play().catch(() => {});
  }

  async function loadReleased(lang) {
    const e = entry(lang);
    if (e.cues && !e.live) return e.cues;
    e.promise ||= api(`/api/courses/${encodeURIComponent(slug)}/cues?lang=${lang}`).then((d) => { e.cues = d.cues; e.status = 'ready'; emit(lang); return d.cues; })
      .catch((err) => { e.promise = null; throw err; });
    return e.promise;
  }

  async function startLive(lang) {
    const e = entry(lang);
    if (e.live && (e.status === 'translating' || e.status === 'ready')) return e.cues;
    const source = (await loadReleased(originalLang())).map((c, idx) => ({ ...c, idx }));
    e.live = true; e.status = 'translating'; e.error = null; e.done = 0; e.total = source.length;
    e.cues = source.map((c) => ({ start: c.start, end: c.end, speaker: c.speaker, text: '' }));
    e.ctl?.abort(); const ctl = (e.ctl = new AbortController());
    emit(lang);
    const now = cueIndexAt(source, video.currentTime);
    const from = now >= 0 ? now : Math.max(0, source.findIndex((c) => c.start > video.currentTime));
    try {
      await translateLive({ slug, lang, source, from, signal: ctl.signal, courseTitle: title,
        onCues(items) {
          if (e.ctl !== ctl) return;
          const next = e.cues.slice();
          for (const it of items) if (next[it.idx] && !next[it.idx].text) { next[it.idx] = { ...next[it.idx], text: it.text }; e.done++; }
          e.cues = next; emit(lang);
        } });
      if (e.ctl === ctl) { e.status = 'ready'; emit(lang); }
    } catch (err) {
      if (e.ctl !== ctl) return;
      e.status = 'error'; e.error = err.message || 'Live translation failed.';
      if (S.held && lang === S.lang) { S.held = false; q('.p-hold').hidden = true; video.play().catch(() => {}); }
      emit(lang);
      if (lang === S.lang) flash(e.error);
    }
    return e.cues;
  }

  async function confirmLive() {
    if (S.liveAck) return true;
    const ok = await ask('Languages marked LIVE are translated by AI in real time, while you watch. They are not reviewed by medical experts and may contain errors. The original-language version is authoritative.', { confirmLabel: 'Start live translation' });
    S.liveAck = ok;
    return ok;
  }

  /** Public: cues for any language (released instantly, others live-translated). Returns an unsubscribe function. */
  async function getCues(lang, onUpdate) {
    const st = langStatus(lang);
    if (!st) throw new Error('This language is not available for this course.');
    const e = entry(lang);
    if (st.kind === 'live') {
      if (!(await confirmLive())) throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
      if (onUpdate) e.listeners.add(onUpdate);
      startLive(lang);
    } else {
      if (onUpdate) e.listeners.add(onUpdate);
      await loadReleased(lang);
    }
    onUpdate?.(e.cues || [], e);
    return () => e.listeners.delete(onUpdate);
  }

  // ── init ────────────────────────────────────────────────────────────────
  async function init() {
    try { S.data = await api(`/api/courses/${encodeURIComponent(slug)}/play`); } catch (e) { showError(e); onError?.(e); return; }
    const d = S.data;
    video.src = d.mediaUrl;
    if (d.poster) video.poster = d.poster;
    durEl.textContent = ` / ${fmtTime(d.durationSec)}`;
    if (d.previewSec) { const lim = q('.p-preview-limit'); lim.hidden = false; lim.style.width = `${100 - (d.previewSec / d.durationSec) * 100}%`; }
    q('.p-marks').innerHTML = chapters.slice(1).map((c) => `<span class="p-chapter-mark" style="left:${(c.start / d.durationSec) * 100}%"></span>`).join('');
    const wanted = prefs.get('lang', null) || storedSiteLanguage() || d.preferredLanguage || state.user?.preferredLanguage;
    S.country = pickCountry();
    const st = wanted && langStatus(wanted);
    // Start in the wanted language if it is ready; live languages start only after the viewer confirms.
    const start = st && st.kind !== 'live' ? wanted : originalLang();
    await setLanguage(start, { silent: true });
    applySubStyle();
    const anonResume = !state.user ? prefs.get(`resume:${slug}`, 0) : 0;
    const resume = d.resume || anonResume;
    if (resume > 3) video.addEventListener('loadedmetadata', () => { video.currentTime = resume; flash(`Resuming at ${fmtTime(resume)}`); }, { once: true });
    // Prefetch released subtitles and a few voice tracks so switching is instant.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(() => {
      for (const t of d.tracks) loadReleased(t.language).catch(() => {});
      for (const t of d.tracks.filter((x) => x.audio === 'file' && x.audioUrl).slice(0, 3)) fetchBlobUrl(t.audioUrl).catch(() => {});
    });
    if (st?.kind === 'live') flash(`${langInfo(wanted)?.native}: open the language menu to start live AI subtitles`);
  }

  function showError(e) {
    const box = document.createElement('div');
    box.className = 'p-error';
    const legal = e.status === 451;
    box.innerHTML = String(html`<div><div style="display:grid;place-items:center;margin-bottom:12px">${icon(legal ? 'globe' : 'alert', 34)}</div>
      <h3>${legal ? 'Not available in your region' : 'Playback unavailable'}</h3><p>${e.message}</p>
      ${legal && !state.user ? html`<a class="btn btn-accent btn-sm" href="/login?next=${encodeURIComponent(curPath())}">Sign in</a>` : ''}
      ${legal && state.user ? html`<a class="btn btn-accent btn-sm" href="/account/settings">Update your country</a>` : ''}
      ${!legal ? html`<button class="btn btn-glass btn-sm" data-retry>Try again</button>` : ''}</div>`);
    el.append(box);
    box.querySelector('[data-retry]')?.addEventListener('click', () => { box.remove(); init(); });
  }

  // ── choosing a language ─────────────────────────────────────────────────
  async function setLanguage(code, { silent = false } = {}) {
    const st = langStatus(code);
    if (!st) return;
    if (st.kind === 'live' && !(await confirmLive())) return;
    S.lang = code;
    if (!silent) prefs.set('lang', code);
    const info = langInfo(code);
    q('.p-lang-btn .code').textContent = code.toUpperCase();
    q('.p-lang-name').textContent = info?.native || code;
    S.lastCueIdx = -2;
    if (st.kind === 'live') startLive(code); else loadReleased(code).catch(() => flash('Could not load subtitles.'));
    renderSubs(true);
    await applyAudio();
    updateTag(); renderMenus();
    onLanguage?.(code, st);
    if (!silent) {
      const voice = S.audio.mode === 'file' ? 'AI voice' : S.audio.mode === 'device' ? 'device voice' : st.kind === 'original' ? 'original audio' : 'original audio (no AI voice for this language yet)';
      flash(`${info?.native || code} · ${st.kind === 'live' ? 'live AI subtitles' : 'subtitles'} · ${voice}`);
    }
  }

  // ── audio engine ────────────────────────────────────────────────────────
  function wantedAudio() {
    const st = langStatus(S.lang);
    if (!st || st.kind === 'original' || S.voice === 'original') {
      if (!S.data.mediaHasAudio && canDeviceSpeak(S.lang)) return { mode: 'device' };
      return { mode: 'original' };
    }
    if (st.voice === 'file') return { mode: 'file', url: st.track.audioUrl };
    if (S.deviceVoice && canDeviceSpeak(S.lang)) return { mode: 'device' };
    return { mode: 'original' };
  }

  async function applyAudio() {
    const want = wantedAudio();
    const token = ++S.audio.token;
    stopSpeech();
    if (want.mode === 'file') {
      let url;
      try { url = await fetchBlobUrl(want.url); } catch { if (token === S.audio.token) { flash('Voice track could not be loaded — playing original audio.'); setMode('original'); } return; }
      if (token !== S.audio.token || S.destroyed) return;
      const a = new Audio(url);
      a.preload = 'auto'; a.preservesPitch = true; a.volume = video.volume; a.muted = userMuted(); a.playbackRate = video.playbackRate;
      await new Promise((res) => { if (a.readyState >= 3) res(); else { a.addEventListener('canplaythrough', res, { once: true }); a.addEventListener('error', res, { once: true }); setTimeout(res, 3000); } });
      if (token !== S.audio.token || S.destroyed) { a.src = ''; return; }
      const old = S.audio.el;
      a.currentTime = video.currentTime;
      S.audio.el = a; S.audio.mode = 'file';
      video.muted = true;
      if (!video.paused) a.play().catch(() => {});
      if (old) { old.pause(); old.src = ''; }
      return;
    }
    setMode(want.mode);
  }
  function setMode(mode) {
    if (S.audio.el) { S.audio.el.pause(); S.audio.el.src = ''; S.audio.el = null; }
    S.audio.mode = mode;
    video.muted = mode !== 'original' || userMuted();
    if (mode === 'device') S.spokenIdx = cueIndexAt(currentCues(), video.currentTime, 0.6);
  }

  // Gentle synchronisation, 4× per second — never per frame.
  const syncTimer = setInterval(() => {
    const a = S.audio.el;
    if (!a || S.audio.mode !== 'file') return;
    if (video.paused || video.seeking || video.readyState < 3) { if (!a.paused) a.pause(); return; }
    if (a.paused) { a.currentTime = video.currentTime; a.play().catch(() => {}); return; }
    const drift = a.currentTime - video.currentTime;
    const now = performance.now();
    if (Math.abs(drift) > 0.6 && now - S.audio.lastSeek > 1500) { a.currentTime = video.currentTime; S.audio.lastSeek = now; a.playbackRate = video.playbackRate; return; }
    a.playbackRate = Math.abs(drift) > 0.05 ? video.playbackRate * (1 - clamp(drift, -0.5, 0.5) * 0.15) : video.playbackRate;
  }, 250);

  // ── device voice (Web Speech, opt-in fallback) ──────────────────────────
  function loadVoices() { if (tts) S.voices = tts.getVoices(); }
  loadVoices();
  tts?.addEventListener?.('voiceschanged', loadVoices);
  function voicesFor(lang) {
    const list = S.voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith(lang));
    return list.sort((a, b) => (/natural|neural|premium|enhanced|google/i.test(b.name) ? 1 : 0) - (/natural|neural|premium|enhanced|google/i.test(a.name) ? 1 : 0));
  }
  const canDeviceSpeak = (lang) => !!tts && voicesFor(lang).length > 0;
  function stopSpeech() { if (tts && (tts.speaking || tts.pending)) tts.cancel(); }
  function speakCue(cues, i, remaining = 1) {
    const c = cues[i]; if (!c?.text) return;
    const voices = voicesFor(S.lang); if (!voices.length) return;
    const speakers = [...new Set(cues.map((x) => x.speaker || ''))];
    const si = Math.max(0, speakers.indexOf(c.speaker || ''));
    const u = new SpeechSynthesisUtterance(c.text);
    u.voice = voices[si % voices.length]; u.lang = u.voice.lang;
    u.pitch = voices.length === 1 && si > 0 ? 0.85 : 1;
    const slot = Math.max(1, (c.end - c.start) * remaining);
    u.rate = clamp((c.text.length / (CPS[S.lang] || 13)) / slot, 0.95, 1.6) * clamp(video.playbackRate, 0.5, 2);
    u.volume = userMuted() ? 0 : video.volume;
    tts.cancel(); tts.speak(u);
  }
  function deviceTick() {
    if (S.audio.mode !== 'device' || video.paused || !tts) return;
    const cues = currentCues(); if (!cues) return;
    const i = cueIndexAt(cues, video.currentTime);
    if (i >= 0 && i !== S.spokenIdx && cues[i].text) {
      S.spokenIdx = i;
      const frac = 1 - (video.currentTime - cues[i].start) / (cues[i].end - cues[i].start);
      if (frac > 0.5) speakCue(cues, i, frac);
    }
  }

  // ── subtitles ───────────────────────────────────────────────────────────
  const currentCues = () => S.store.get(S.lang)?.cues || null;
  function cueIndexAt(cues, t, startTolerance = 0) {
    if (!cues) return -1;
    for (let i = 0; i < cues.length; i++) if (t >= cues[i].start && t < cues[i].end) return t - cues[i].start < startTolerance ? i - 1 : i;
    return -1;
  }
  function renderSubs(force = false) {
    const cues = currentCues();
    const idx = S.subsOn ? cueIndexAt(cues, video.currentTime) : -1;
    if (idx === S.lastCueIdx && !force) return;
    S.lastCueIdx = idx;
    if (idx < 0) { subsEl.innerHTML = ''; return; }
    const c = cues[idx]; const info = langInfo(S.lang);
    if (!c.text) { subsEl.innerHTML = entry(S.lang).live ? '<div><span class="cue cue-pending">· · ·</span></div>' : ''; return; }
    const speakers = new Set(cues.map((x) => x.speaker).filter(Boolean));
    subsEl.innerHTML = `<div dir="${info?.dir || 'ltr'}" lang="${esc(S.lang)}">${speakers.size > 1 && c.speaker ? `<span class="speaker">${esc(c.speaker)}</span>` : ''}<span class="cue" style="background:rgba(5,15,34,${S.bg})">${esc(c.text)}</span></div>`;
  }
  function applySubStyle() {
    subsEl.className = `p-subs pos-${S.position} size-${S.size}`;
    q('[data-a=cc]').setAttribute('aria-pressed', String(S.subsOn));
    q('[data-a=cc]').classList.toggle('on', S.subsOn);
    renderSubs(true);
  }
  function updateTag() {
    const tag = q('.p-tag-lang'); if (!S.data) return;
    const st = langStatus(S.lang);
    const e = S.store.get(S.lang);
    if (!st || st.kind === 'original') { tag.hidden = true; return; }
    tag.hidden = false;
    if (st.kind === 'live') {
      tag.className = 'p-tag p-tag-lang live';
      tag.innerHTML = `${icon('zap', 13)} LIVE AI · not reviewed${e?.status === 'translating' ? ` · translating ${e.done}/${e.total}` : e?.status === 'error' ? ' · interrupted' : ''}`;
    } else {
      tag.className = 'p-tag p-tag-lang';
      tag.innerHTML = `${icon('sparkles', 13)} AI translation · ${st.review === 'medically_reviewed' ? 'medically reviewed' : st.review === 'demo_unreviewed' ? 'demo, not medically reviewed' : 'not reviewed'}`;
    }
  }

  // ── loop & progress ─────────────────────────────────────────────────────
  function frame() {
    if (S.destroyed) return;
    const t = video.currentTime; const d = duration();
    if (d) {
      const pct = (t / d) * 100;
      played.style.width = `${pct}%`; knob.style.left = `${pct}%`;
      tl.setAttribute('aria-valuenow', String(Math.round(t))); tl.setAttribute('aria-valuemax', String(Math.round(d)));
      tl.setAttribute('aria-valuetext', `${fmtTime(t)} of ${fmtTime(d)}`);
    }
    curEl.textContent = fmtTime(t);
    renderSubs();
    holdIfNeeded();
    deviceTick();
    if (!video.paused) {
      const now = performance.now();
      if (S.lastTick) S.watched += Math.min(1, (now - S.lastTick) / 1000) * video.playbackRate;
      S.lastTick = now;
      if (S.data?.previewSec && t >= S.data.previewSec && !S.previewHit) { S.previewHit = true; video.pause(); showPaywall(); }
      if (now - S.lastReport > 10000) report();
    } else S.lastTick = 0;
    onTime?.(t);
    requestAnimationFrame(frame);
  }
  function report() {
    S.lastReport = performance.now();
    const position = video.currentTime;
    if (!state.user) { prefs.set(`resume:${slug}`, position); return; }
    const watchedDelta = S.watched; S.watched = 0;
    api(`/api/courses/${encodeURIComponent(slug)}/progress`, { method: 'POST', body: { position, language: S.lang, watchedDelta } })
      .then((r) => onProgress?.(r)).catch(() => {});
  }
  function showPaywall() {
    if (q('.p-paywall')) return;
    const box = document.createElement('div');
    box.className = 'p-paywall';
    const needLogin = S.data.entitlement.reason === 'login_required';
    box.innerHTML = String(html`<div style="max-width:420px">${icon('lock', 30)}<h3 style="margin-top:12px">Preview ended</h3>
      <p>${needLogin ? 'Create a free account and choose a plan to watch the full course in every available language.' : 'This course is included in the Professional plan, or can be purchased individually.'}</p>
      <div class="row" style="justify-content:center">
        ${needLogin ? html`<a class="btn btn-accent" href="/register?next=${encodeURIComponent(curPath())}">Create account</a><a class="btn btn-glass" href="/login?next=${encodeURIComponent(curPath())}">Sign in</a>`
          : html`<a class="btn btn-accent" href="/pricing">See plans</a>`}
      </div><button class="link-btn xs" style="margin-top:14px;color:#8FA1BA" data-replay>Replay preview</button></div>`);
    box.querySelector('[data-replay]').addEventListener('click', () => { box.remove(); S.previewHit = false; video.currentTime = 0; video.play(); });
    el.append(box);
  }

  // ── choosing a language: quick picks, country shortcut, regions ──────────
  const countriesWithLangs = () => (state.meta?.countries || []).filter((c) => c.languages?.length);
  function pickCountry() {
    const valid = (c) => c && countriesWithLangs().some((x) => x.code === c);
    const loc = (/-([A-Za-z]{2})\b/.exec(navigator.languages?.[0] || navigator.language || '') || [])[1]?.toUpperCase();
    return [prefs.get('country', null), state.user?.country, loc].find(valid) || null;
  }
  const countryLangs = () => (countriesWithLangs().find((c) => c.code === S.country)?.languages || []).filter((c) => langStatus(c));
  /** The few languages this viewer most likely wants: original, site language, local languages, browser languages. */
  function quickPicks(max = 6) {
    const out = [];
    const add = (c) => { if (c && !out.includes(c) && langStatus(c)) out.push(c); };
    add(originalLang()); add(S.lang); add(storedSiteLanguage());
    countryLangs().slice(0, 3).forEach(add);
    (navigator.languages || []).forEach((t) => add(String(t).slice(0, 2).toLowerCase()));
    // Nothing personal to go on yet: offer widely used languages that have an AI voice in this course.
    for (const c of ['sw', 'fr', 'es', 'ar', 'pt', 'hi', 'zh', 'de']) if (out.length < 5 && langStatus(c)?.voice === 'file') add(c);
    return out.slice(0, max);
  }
  const regionOf = (code) => (state.meta?.languages || []).find((l) => l.code === code)?.region;

  function badgesFor(st) {
    if (st.kind === 'original') return '<span class="mini">ORIGINAL</span>';
    if (st.kind === 'released') return `${st.voice === 'file' ? `<span class="mini voice">${icon('volume', 11)} VOICE</span>` : ''}<span class="mini ai">CC</span>`;
    return `<span class="mini live">${icon('zap', 11)} LIVE</span>`;
  }
  function chip(code) {
    const l = langInfo(code); const st = langStatus(code); if (!l || !st) return '';
    return `<button type="button" class="lm-chip ${S.lang === code ? 'on' : ''}" data-lang="${code}" aria-pressed="${S.lang === code}"><b>${esc(l.native)}</b>${badgesFor(st)}</button>`;
  }
  function tile(l) {
    const st = langStatus(l.code); if (!st) return '';
    return `<button type="button" class="lm-tile ${S.lang === l.code ? 'on' : ''}" role="menuitemradio" aria-checked="${S.lang === l.code}" data-lang="${l.code}">
      <span class="lname"><b>${esc(l.native)}</b><small>${esc(l.name)}</small></span><span class="meta">${badgesFor(st)}</span></button>`;
  }

  /** Language bar under the video: one tap for the likely languages. */
  function renderBar() {
    if (!S.data || !bar) return;
    const picks = quickPicks(6);
    const cur = langStatus(S.lang);
    const how = !cur ? '' : cur.kind === 'original' ? 'Original audio' : cur.kind === 'live' ? 'Live AI subtitles · original audio' : cur.voice === 'file' ? 'Subtitles + AI voice' : 'Subtitles · original audio';
    const mini = (c) => { const st = langStatus(c); return st.kind === 'original' ? '' : st.voice === 'file' ? `<i class="b voice" title="AI voice">${icon('volume', 11)}</i>` : st.kind === 'live' ? `<i class="b live" title="Live AI subtitles">${icon('zap', 11)}</i>` : '<i class="b cc" title="AI subtitles">CC</i>'; };
    bar.innerHTML = `<span class="plb-label">${icon('globe', 15)} Language</span>
      <div class="plb-chips">${picks.map((c) => `<button type="button" class="plb-chip ${S.lang === c ? 'on' : ''}" data-lang="${c}" aria-pressed="${S.lang === c}"><span>${esc(langInfo(c)?.native || c)}</span>${mini(c)}</button>`).join('')}</div>
      <button type="button" class="plb-more" data-more>${icon('plus', 14)} All ${state.meta?.languages.length || ''} languages</button>
      <span class="plb-how">${esc(how)}</span>`;
  }

  function paintGrid() {
    const langs = state.meta?.languages || [];
    const n = S.search.trim().toLowerCase();
    const voiced = (c) => (langStatus(c)?.voice || 'none') !== 'none';
    const rank = (l) => ((langStatus(l.code)?.kind === 'original') ? 0 : voiced(l.code) ? 1 : langStatus(l.code)?.kind === 'released' ? 2 : 3);
    const list = langs.filter((l) => langStatus(l.code) && (n ? `${l.native} ${l.name} ${l.code}`.toLowerCase().includes(n) : l.region === S.tab))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    langMenu.querySelector('.lm-grid').innerHTML = list.length ? list.map(tile).join('') : '<p class="note" style="grid-column:1/-1">No language found. Try another spelling.</p>';
    langMenu.classList.toggle('searching', !!n);
  }

  function renderMenus() {
    if (!S.data) return;
    renderBar();
    const langs = state.meta?.languages || [];
    const regions = state.meta?.regions || [];
    S.tab ||= regionOf(S.lang) || regionOf(countryLangs()[0]) || 'africa';
    const e = S.store.get(S.lang);
    const keepScroll = langMenu.querySelector('.lm-scroll')?.scrollTop || 0;
    const quick = quickPicks(8);
    const cl = countryLangs();
    const regionCount = (r) => langs.filter((l) => l.region === r && langStatus(l.code)).length;
    langMenu.innerHTML = `
      <div class="lm-head">
        <div class="lm-title">${icon('globe', 16)} <b>Language</b><span class="lm-count">${langs.length} languages</span></div>
        <div class="lm-toggles">
          <button data-toggle="subs" aria-pressed="${S.subsOn}">${icon('cc', 14)} Subtitles ${S.subsOn ? 'on' : 'off'}</button>
          <div class="seg-mini" role="group" aria-label="Voice">
            <button data-voice="translated" aria-pressed="${S.voice === 'translated'}">${icon('volume', 13)} Translated</button>
            <button data-voice="original" aria-pressed="${S.voice === 'original'}">Original voice</button>
          </div>
        </div>
        ${e?.live && e.status === 'error' ? `<p class="note err">${esc(e.error)}</p>` : ''}
      </div>
      <div class="lm-scroll">
        <section class="lm-sec lm-quick"><h4>Quick pick</h4><div class="lm-chips">${quick.map(chip).join('')}</div></section>
        <section class="lm-sec lm-country"><h4>Spoken in
          <select data-country aria-label="Your country"><option value="">choose your country…</option>${countriesWithLangs().map((c) => `<option value="${c.code}" ${S.country === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></h4>
          ${cl.length ? `<div class="lm-chips">${cl.map(chip).join('')}</div>` : '<p class="note">Pick a country to see the languages people speak there.</p>'}</section>
        <section class="lm-sec lm-browse"><div class="lm-bh"><h4>Browse by region</h4>
          <label class="lm-s">${icon('search', 14)}<input class="lm-search" type="search" placeholder="Search all languages" value="${esc(S.search)}" aria-label="Search languages"></label></div>
          <div class="lm-tabs" role="tablist">${regions.map((r) => `<button type="button" role="tab" data-region="${r.code}" aria-selected="${S.tab === r.code}">${esc(r.name.replace('Middle East & North Africa', 'Middle East'))}<i>${regionCount(r.code)}</i></button>`).join('')}</div>
          <div class="lm-grid"></div></section>
        <p class="note">${icon('volume', 11)} VOICE: AI voice track in sync with the speakers · CC: AI subtitles · ${icon('zap', 11)} LIVE: translated in real time while you watch (not reviewed) — the original audio keeps playing unless you switch on the device voice in settings.</p>
      </div>`;
    paintGrid();
    const sc = langMenu.querySelector('.lm-scroll'); if (sc) sc.scrollTop = keepScroll;
    const seg = (name, cur, items) => `<div class="seg" role="group">${items.map(([v, l]) => `<button data-set="${name}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
    setMenu.innerHTML = `
      <h4>Playback speed</h4>${seg('rate', S.rate, [[0.75, '0.75×'], [1, '1×'], [1.25, '1.25×'], [1.5, '1.5×'], [2, '2×']])}
      <h4>Subtitle size</h4>${seg('size', S.size, [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']])}
      <h4>Subtitle position</h4>${seg('position', S.position, [['bottom', 'Bottom'], ['top', 'Top']])}
      <h4>Subtitle background</h4>${seg('bg', S.bg, [[0, 'None'], [0.45, 'Light'], [0.75, 'Medium'], [0.95, 'Solid']])}
      <h4>Device voice (experimental)</h4>${seg('device', S.deviceVoice ? 1 : 0, [[0, 'Off'], [1, 'On']])}
      <p class="note">Reads subtitles aloud with your device's own voice when a language has no AI voice track. Availability and quality depend on your device.</p>
      <p class="note">Shortcuts: Space/K play · J/L ±10 s · ←/→ ±5 s · M mute · C subtitles · F fullscreen</p>`;
  }
  function toggleMenu(name, open) {
    for (const m of [langMenu, setMenu]) {
      const show = m.dataset.menu === name && (open ?? m.hidden);
      m.hidden = !show;
      q(`[data-a=${m.dataset.menu}]`).setAttribute('aria-expanded', String(show));
      if (show && m === langMenu) { S.search = ''; S.tab = regionOf(S.lang) || S.tab; renderMenus(); }
    }
  }

  // ── controls ────────────────────────────────────────────────────────────
  const togglePlay = () => (video.paused ? video.play().catch(() => {}) : video.pause());
  const seekBy = (s) => { video.currentTime = clamp(video.currentTime + s, 0, duration()); };
  function setMuted(m) {
    video.dataset.userMuted = m ? '1' : '0';
    video.muted = S.audio.mode !== 'original' || m;
    if (S.audio.el) S.audio.el.muted = m;
    if (m) stopSpeech();
    q('[data-a=mute]').innerHTML = String(icon(m ? 'mute' : 'volume', 20));
  }
  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
  }

  el.addEventListener('input', (e) => { if (e.target.matches('.lm-search')) { S.search = e.target.value; paintGrid(); } });
  el.addEventListener('change', (e) => { if (e.target.matches('[data-country]')) { S.country = e.target.value || null; prefs.set('country', S.country); renderMenus(); } });
  bar?.addEventListener('click', async (e) => {
    const l = e.target.closest('[data-lang]');
    if (l) { await setLanguage(l.dataset.lang); return; }
    if (e.target.closest('[data-more]')) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus({ preventScroll: true }); toggleMenu('lang', true); }
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a],[data-lang],[data-set],[data-toggle],[data-voice],[data-region]');
    if (!b) {
      if (e.target.closest('.p-menu')) return;
      if (e.target === video || e.target.closest('.p-overlay') || e.target.closest('.p-subs')) {
        if (S.wasIdle && e.pointerType !== 'mouse') return;
        toggleMenu(null, false); togglePlay();
      }
      return;
    }
    const a = b.dataset.a;
    if (a === 'play') togglePlay();
    else if (a === 'back') seekBy(-10);
    else if (a === 'fwd') seekBy(10);
    else if (a === 'mute') setMuted(!userMuted());
    else if (a === 'fs') toggleFs();
    else if (a === 'cc') { S.subsOn = !S.subsOn; prefs.set('subsOn', S.subsOn); applySubStyle(); renderMenus(); flash(S.subsOn ? 'Subtitles on' : 'Subtitles off'); }
    else if (a === 'lang' || a === 'settings') toggleMenu(a);
    else if (b.dataset.region) { S.tab = b.dataset.region; S.search = ''; renderMenus(); }
    else if (b.dataset.lang) { toggleMenu(null, false); await setLanguage(b.dataset.lang); }
    else if (b.dataset.toggle === 'subs') { S.subsOn = !S.subsOn; prefs.set('subsOn', S.subsOn); applySubStyle(); renderMenus(); }
    else if (b.dataset.voice) {
      S.voice = b.dataset.voice; prefs.set('voice', S.voice); await applyAudio(); renderMenus();
      flash(S.voice === 'original' ? 'Original voice' : S.audio.mode === 'file' ? 'Translated AI voice' : 'No AI voice for this language yet — original audio');
    } else if (b.dataset.set) {
      const k = b.dataset.set; const v = b.dataset.v;
      if (k === 'rate') { S.rate = Number(v); video.playbackRate = S.rate; flash(`Speed ${v}×`); }
      if (k === 'size') { S.size = v; prefs.set('subSize', v); }
      if (k === 'position') { S.position = v; prefs.set('subPos', v); }
      if (k === 'bg') { S.bg = Number(v); prefs.set('subBg', S.bg); }
      if (k === 'device') {
        S.deviceVoice = v === '1'; prefs.set('deviceVoice', S.deviceVoice); await applyAudio();
        if (S.deviceVoice && !canDeviceSpeak(S.lang)) flash(`Your device has no ${langInfo(S.lang)?.name} voice.`);
      }
      applySubStyle(); renderMenus();
    }
  });
  q('.p-vol input').addEventListener('input', (e) => {
    video.volume = Number(e.target.value); if (S.audio.el) S.audio.el.volume = video.volume;
    setMuted(video.volume === 0);
  });

  // timeline
  const timeFromX = (x) => { const r = tl.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * duration(); };
  let dragging = false;
  tl.addEventListener('pointerdown', (e) => { dragging = true; tl.classList.add('drag'); tl.setPointerCapture(e.pointerId); video.currentTime = timeFromX(e.clientX); });
  tl.addEventListener('pointermove', (e) => {
    const t = timeFromX(e.clientX); const r = tl.getBoundingClientRect();
    const ch = [...chapters].reverse().find((c) => c.start <= t);
    hoverT.textContent = `${fmtTime(t)}${ch ? ' · ' + ch.title : ''}`;
    hoverT.style.left = `${clamp(e.clientX - r.left, 40, r.width - 40)}px`;
    if (dragging) video.currentTime = t;
  });
  tl.addEventListener('pointerup', () => { dragging = false; tl.classList.remove('drag'); });
  tl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { seekBy(5); e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'ArrowLeft') { seekBy(-5); e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'Home') { video.currentTime = 0; e.preventDefault(); }
    if (e.key === 'End') { video.currentTime = duration() - 1; e.preventDefault(); }
  });
  el.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const vol = (d) => { video.volume = clamp(video.volume + d, 0, 1); q('.p-vol input').value = video.volume; if (S.audio.el) S.audio.el.volume = video.volume; flash(`Volume ${Math.round(video.volume * 100)}%`); };
    const map = { ' ': togglePlay, k: togglePlay, j: () => seekBy(-10), l: () => seekBy(10), arrowleft: () => seekBy(-5), arrowright: () => seekBy(5),
      m: () => setMuted(!userMuted()), f: toggleFs, c: () => q('[data-a=cc]').click(), escape: () => toggleMenu(null, false), arrowup: () => vol(0.1), arrowdown: () => vol(-0.1) };
    if (/^[0-9]$/.test(k)) { video.currentTime = (Number(k) / 10) * duration(); e.preventDefault(); return; }
    if (map[k]) { e.preventDefault(); map[k](); wake(); }
  });

  const wake = () => { el.classList.remove('idle'); clearTimeout(S.idleTimer); S.idleTimer = setTimeout(() => { if (!video.paused && langMenu.hidden && setMenu.hidden) el.classList.add('idle'); }, 2600); };
  el.addEventListener('pointermove', wake);
  el.addEventListener('pointerdown', () => { S.wasIdle = el.classList.contains('idle'); wake(); });

  // video events — the dubbed track follows the video
  const audioEl = () => (S.audio.mode === 'file' ? S.audio.el : null);
  video.addEventListener('play', () => {
    // A manual play while waiting for a translation skips the wait for this sentence.
    if (S.held) { S.held = false; q('.p-hold').hidden = true; const e = S.store.get(S.lang); S.holdSkip = e ? cueIndexAt(e.cues, video.currentTime) : -1; }
    el.classList.add('playing'); q('.p-overlay').hidden = true;
    q('[data-a=play]').innerHTML = String(icon('pause', 20)); q('[data-a=play]').setAttribute('aria-label', 'Pause (k)');
    const a = audioEl(); if (a) { a.currentTime = video.currentTime; a.play().catch(() => {}); }
    if (S.audio.mode === 'device') S.spokenIdx = cueIndexAt(currentCues(), video.currentTime, 0.6);
    wake();
  });
  video.addEventListener('pause', () => {
    el.classList.remove('playing'); el.classList.remove('idle'); q('.p-overlay').hidden = S.held;
    q('[data-a=play]').innerHTML = String(icon('play', 20)); q('[data-a=play]').setAttribute('aria-label', 'Play (k)');
    audioEl()?.pause(); stopSpeech(); report();
  });
  video.addEventListener('seeking', () => { stopSpeech(); audioEl()?.pause(); });
  video.addEventListener('seeked', () => {
    const a = audioEl(); if (a) { a.currentTime = video.currentTime; S.audio.lastSeek = performance.now(); if (!video.paused) a.play().catch(() => {}); }
    S.spokenIdx = cueIndexAt(currentCues(), video.currentTime, 0.6);
  });
  video.addEventListener('ratechange', () => { const a = audioEl(); if (a) a.playbackRate = video.playbackRate; });
  video.addEventListener('waiting', () => { q('.p-loading').hidden = false; audioEl()?.pause(); stopSpeech(); });
  video.addEventListener('playing', () => { q('.p-loading').hidden = true; const a = audioEl(); if (a) { a.currentTime = video.currentTime; a.play().catch(() => {}); } });
  video.addEventListener('canplay', () => { q('.p-loading').hidden = true; });
  video.addEventListener('progress', () => { const d = duration(); if (d && video.buffered.length) buffer.style.width = `${(video.buffered.end(video.buffered.length - 1) / d) * 100}%`; });
  video.addEventListener('ended', () => { report(); stopSpeech(); audioEl()?.pause(); });
  video.addEventListener('error', () => {
    if (S.destroyed || !S.data) return;
    showError({ status: 0, message: 'The video could not be loaded. The secure link may have expired — please try again.' });
  });
  const onFs = () => { const b = q('[data-a=fs]'); if (b) b.innerHTML = String(icon(document.fullscreenElement === el ? 'shrink' : 'expand', 19)); };
  document.addEventListener('fullscreenchange', onFs);
  const onHide = () => { if (document.visibilityState === 'hidden' && S.data) report(); };
  document.addEventListener('visibilitychange', onHide);
  el.addEventListener('focusout', (e) => { if (e.relatedTarget && !el.contains(e.relatedTarget) && !e.relatedTarget.closest('.modal')) toggleMenu(null, false); });

  init();
  requestAnimationFrame(frame);

  return {
    seek(t) { video.currentTime = t; if (video.paused) video.play().catch(() => {}); el.focus({ preventScroll: true }); },
    setLanguage: (code) => setLanguage(code),
    getCues,
    quickLanguages: () => (S.data ? quickPicks(6) : []),
    langStatus: (code) => (S.data ? langStatus(code) : null),
    get language() { return S.lang; },
    get originalLanguage() { return S.data ? originalLang() : null; },
    get video() { return video; },
    destroy() {
      S.destroyed = true;
      clearInterval(syncTimer);
      if (S.data && video.currentTime > 0) report();
      stopSpeech();
      if (S.audio.el) { S.audio.el.pause(); S.audio.el.src = ''; }
      for (const e of S.store.values()) e.ctl?.abort();
      video.pause(); video.removeAttribute('src'); video.load();
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('visibilitychange', onHide);
    },
  };
}
