import { curPath, ask } from './nav.js';
import { translateLive } from './live.js';
// MedTranslate player
// ─────────────────────────────────────────────────────────────────────────────
// • One <video> element for the whole session. Switching subtitle or audio
//   language never touches video.src, so playback is never reloaded.
// • Subtitles are rendered in an overlay (custom size/position/background) from
//   cue JSON that is cached per language and prefetched in the background.
// • Audio tracks:
//     'original'    → the video's own sound
//     'file'        → a separately delivered dubbed track (<audio>), kept in sync
//                     with drift correction
//     'browser_tts' → AI voice synthesised on the device (Web Speech API), one
//                     utterance per cue, time-fitted to the cue so it stays in sync.
//                     Speakers are mapped to distinct voices.
import { api } from './api.js';
import { html, icon, esc, fmtTime } from './ui.js';
import { prefs, state, langInfo } from './store.js';

const CPS = { en: 14, de: 13, fr: 14, es: 15, it: 14, pt: 14, tr: 13, nl: 13, pl: 12, ru: 12, uk: 12, ar: 11, hi: 11, zh: 5, ja: 7, ko: 6, id: 13, vi: 12 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createPlayer(root, { slug, title, chapters = [], liveAi = null, onTime, onCuesChange, onProgress, onError }) {
  const S = {
    data: null, cues: new Map(), subLang: null, audioLang: null, subsOn: true,
    size: prefs.get('subSize', 'm'), position: prefs.get('subPos', 'bottom'), bg: prefs.get('subBg', 0.75),
    rate: 1, spokenIdx: -1, lastTick: 0, watched: 0, lastReport: 0, destroyed: false, voices: [], idleTimer: null,
    lastCueIdx: -2, audioEl: null, previewHit: false, live: null, liveAck: false,
  };

  root.innerHTML = String(html`
    <div class="player" tabindex="0" role="region" aria-label="Video player: ${title}">
      <video playsinline preload="metadata" crossorigin="anonymous"></video>
      <div class="p-subs pos-bottom size-m" aria-live="off"></div>
      <div class="p-top">
        <div class="row" style="gap:6px"><span class="p-tag p-tag-lang" hidden></span></div>
        <span class="p-tag p-tag-demo">DEMO</span>
      </div>
      <div class="p-overlay"><button class="p-bigplay" aria-label="Play">${icon('play', 30)}</button></div>
      <div class="p-loading" hidden><span class="spinner"></span></div>
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
          <button class="p-btn p-lang-btn" data-a="lang" aria-haspopup="true" aria-expanded="false" aria-label="Language">${icon('globe', 17)}<span class="code">EN</span></button>
          <button class="p-btn" data-a="settings" aria-haspopup="true" aria-expanded="false" aria-label="Settings">${icon('settings', 19)}</button>
          <button class="p-btn" data-a="fs" aria-label="Fullscreen (f)">${icon('expand', 19)}</button>
        </div>
      </div>
      <div class="p-menu" data-menu="lang" hidden role="menu"></div>
      <div class="p-menu" data-menu="settings" hidden role="menu"></div>
      <div class="p-toast"></div>
    </div>`);

  const el = root.querySelector('.player');
  const video = el.querySelector('video');
  const q = (s) => el.querySelector(s);
  const subsEl = q('.p-subs'); const tl = q('.p-timeline'); const played = q('.p-played'); const buffer = q('.p-buffer'); const knob = q('.p-knob');
  const hoverT = q('.p-hover-time'); const curEl = q('.cur'); const durEl = q('.dur'); const langMenu = q('[data-menu=lang]'); const setMenu = q('[data-menu=settings]');
  const tts = 'speechSynthesis' in window ? window.speechSynthesis : null;

  const flash = (msg) => { const t = q('.p-toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); };
  const duration = () => (isFinite(video.duration) && video.duration > 0 ? video.duration : S.data?.durationSec || 0);
  const liveTrack = () => S.live && { language: S.live.lang, original: false, live: true, subtitles: true,
    audio: tts && voicesFor(S.live.lang).length ? 'browser_tts' : 'none', aiGenerated: true, review: 'live_unreviewed' };
  const track = (lang) => S.data.tracks.find((t) => t.language === lang) || (S.live?.lang === lang ? liveTrack() : undefined);

  // ── data loading ─────────────────────────────────────────────────────────
  async function loadCues(lang) {
    if (S.cues.has(lang)) return S.cues.get(lang);
    const p = api(`/api/courses/${encodeURIComponent(slug)}/cues?lang=${lang}`).then((d) => d.cues);
    S.cues.set(lang, p);
    try { const cues = await p; S.cues.set(lang, cues); return cues; } catch (e) { S.cues.delete(lang); throw e; }
  }
  const cuesNow = (lang) => { const c = S.cues.get(lang); return Array.isArray(c) ? c : null; };

  async function init() {
    try { S.data = await api(`/api/courses/${encodeURIComponent(slug)}/play`); } catch (e) { showError(e); onError?.(e); return; }
    const d = S.data;
    video.src = d.mediaUrl;
    if (d.poster) video.poster = d.poster;
    durEl.textContent = ` / ${fmtTime(d.durationSec)}`;
    if (d.previewSec) {
      const lim = q('.p-preview-limit'); lim.hidden = false; lim.style.width = `${100 - (d.previewSec / d.durationSec) * 100}%`;
    }
    q('.p-marks').innerHTML = chapters.slice(1).map((c) => `<span class="p-chapter-mark" style="left:${(c.start / d.durationSec) * 100}%"></span>`).join('');
    const available = d.tracks.map((t) => t.language);
    const wanted = prefs.get('lang', null) || d.preferredLanguage || state.user?.preferredLanguage || navigator.language?.slice(0, 2);
    const start = available.includes(wanted) ? wanted : d.tracks[0].language;
    S.subsOn = prefs.get('subsOn', true);
    await setSubtitleLang(start, { silent: true });
    const audioPref = prefs.get('audioMode', 'match'); // 'match' = AI voice in subtitle language when available
    const t = track(start);
    S.audioLang = audioPref === 'match' && t.audio !== 'none' ? start : d.tracks[0].language;
    applyAudio({ silent: true });
    applySubStyle();
    renderMenus();
    // Resume
    const anonResume = !state.user ? prefs.get(`resume:${slug}`, 0) : 0;
    const resume = d.resume || anonResume;
    if (resume > 3) {
      video.addEventListener('loadedmetadata', () => { video.currentTime = resume; flash(`Resuming at ${fmtTime(resume)}`); }, { once: true });
    }
    // Prefetch the remaining languages when the browser is idle, so later switches are instant.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(() => available.forEach((l) => loadCues(l).catch(() => {})));
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

  // ── languages ───────────────────────────────────────────────────────────
  async function setSubtitleLang(lang, { silent = false } = {}) {
    S.subLang = lang;
    q('.p-lang-btn .code').textContent = lang.toUpperCase();
    try { await loadCues(lang); } catch (e) { flash(`Could not load ${langInfo(lang)?.name || lang} subtitles`); return; }
    S.lastCueIdx = -2;
    renderSubs(true);
    updateLangTag();
    onCuesChange?.(lang, cuesNow(lang), track(lang));
    if (!silent) { prefs.set('lang', lang); flash(`Subtitles: ${langInfo(lang)?.native || lang}`); }
    renderMenus();
  }

  function setAudioLang(lang) {
    S.audioLang = lang;
    prefs.set('audioMode', lang === S.data.tracks[0].language ? 'original' : 'match');
    applyAudio({});
    renderMenus();
  }

  function applyAudio({ silent }) {
    const t = track(S.audioLang);
    stopSpeech();
    S.audioToken = (S.audioToken || 0) + 1;
    S.audioEl?.pause(); S.audioEl?.remove(); S.audioEl = null;
    const mode = t.original ? (S.data.mediaHasAudio ? 'original' : 'browser_tts') : t.audio;
    S.audioMode = mode;
    if (mode === 'original') { video.muted = false; }
    else if (mode === 'file' && t.audioUrl) {
      video.muted = true;
      const token = (S.audioToken = (S.audioToken || 0) + 1);
      (window.MT_RESOLVE_MEDIA ? window.MT_RESOLVE_MEDIA(t.audioUrl) : Promise.resolve(t.audioUrl)).then((url) => {
        if (token !== S.audioToken || S.destroyed) return;
        const a = new Audio(url); a.preload = 'auto'; a.volume = video.volume; a.playbackRate = video.playbackRate;
        a.muted = video.dataset.userMuted === '1';
        S.audioEl = a; a.currentTime = video.currentTime; if (!video.paused) a.play().catch(() => {});
      });
    } else if (mode === 'browser_tts') {
      video.muted = true;
      loadCues(S.audioLang).catch(() => {});
      if (!tts) { flash('AI voice is not supported in this browser — subtitles only.'); }
      else if (!voicesFor(S.audioLang).length && S.voices.length) flash(`No ${langInfo(S.audioLang)?.name} voice on this device — subtitles shown instead.`);
      // Mark the cue we are in as spoken unless we are at its very beginning (avoid starting mid-sentence).
      S.spokenIdx = cueIndexAt(cuesNow(S.audioLang), video.currentTime, 0.6);
    } else { video.muted = true; }
    updateLangTag();
    if (!silent) flash(`Audio: ${langInfo(S.audioLang)?.native}${t.original ? ' (original)' : t.live ? ' (live AI, device voice)' : ' (AI voice)'}`);
  }

  function updateLangTag() {
    const tag = q('.p-tag-lang'); if (!S.data) return;
    const sub = track(S.subLang); const aud = track(S.audioLang);
    const ai = (S.subsOn && sub && !sub.original) || (aud && !aud.original);
    tag.hidden = !ai;
    if (ai) {
      const rev = (sub && !sub.original ? sub : aud).review;
      if (rev === 'live_unreviewed') {
        const n = S.live.done.size, total = S.live.total;
        tag.innerHTML = `${icon('zap', 13)} LIVE AI translation · not reviewed${S.live.status === 'translating' ? ` · translating ${n}/${total}` : S.live.status === 'error' ? ' · interrupted' : ''}`;
      } else tag.innerHTML = `${icon('sparkles', 13)} AI translation · ${rev === 'medically_reviewed' ? 'medically reviewed' : rev === 'demo_unreviewed' ? 'demo, not medically reviewed' : 'not reviewed'}`;
    }
    q('.p-tag-demo').hidden = !S.data.tracks.length;
  }

  // ── subtitles ───────────────────────────────────────────────────────────
  function cueIndexAt(cues, t, startTolerance = 0) {
    if (!cues) return -1;
    for (let i = 0; i < cues.length; i++) {
      if (t >= cues[i].start && t < cues[i].end) return t - cues[i].start < startTolerance ? i - 1 : i;
    }
    return -1;
  }
  function renderSubs(force = false) {
    const cues = cuesNow(S.subLang);
    const idx = S.subsOn ? cueIndexAt(cues, video.currentTime) : -1;
    if (idx === S.lastCueIdx && !force) return;
    S.lastCueIdx = idx;
    if (idx < 0) { subsEl.innerHTML = ''; return; }
    const c = cues[idx]; const info = langInfo(S.subLang);
    if (!c.text) { subsEl.innerHTML = S.live?.lang === S.subLang ? '<div><span class="cue cue-pending">· · ·</span></div>' : ''; return; }
    const speakers = new Set(cues.map((x) => x.speaker).filter(Boolean));
    subsEl.innerHTML = `<div dir="${info?.dir || 'ltr'}" lang="${esc(S.subLang)}">${speakers.size > 1 && c.speaker ? `<span class="speaker">${esc(c.speaker)}</span>` : ''}<span class="cue" style="background:rgba(5,15,34,${S.bg})">${esc(c.text)}</span></div>`;
  }
  function applySubStyle() {
    subsEl.className = `p-subs pos-${S.position} size-${S.size}`;
    q('[data-a=cc]').setAttribute('aria-pressed', String(S.subsOn));
    q('[data-a=cc]').classList.toggle('on', S.subsOn);
    renderSubs(true);
  }

  // ── AI voice (Web Speech API) ───────────────────────────────────────────
  function loadVoices() { if (tts) S.voices = tts.getVoices(); }
  loadVoices();
  tts?.addEventListener?.('voiceschanged', loadVoices);
  function voicesFor(lang) {
    const exact = S.voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
    // Prefer higher-quality / natural voices where the platform exposes them.
    return exact.sort((a, b) => (/natural|neural|premium|enhanced|google/i.test(b.name) ? 1 : 0) - (/natural|neural|premium|enhanced|google/i.test(a.name) ? 1 : 0));
  }
  function stopSpeech() { if (tts && (tts.speaking || tts.pending)) tts.cancel(); }
  function speakCue(cues, i, remainingFraction = 1) {
    if (!tts) return;
    const c = cues[i]; const lang = S.audioLang;
    if (!c.text) return;
    const voices = voicesFor(lang);
    if (!voices.length) return;
    const speakers = [...new Set(cues.map((x) => x.speaker || ''))];
    const si = Math.max(0, speakers.indexOf(c.speaker || ''));
    const voice = voices[si % voices.length];
    const u = new SpeechSynthesisUtterance(c.text);
    u.voice = voice; u.lang = voice.lang;
    // Same voice reused for a second speaker → shift the pitch so speakers stay distinguishable.
    u.pitch = si >= voices.length || (voices.length === 1 && si > 0) ? 0.82 : 1;
    const slot = Math.max(0.8, (c.end - c.start) * remainingFraction - 0.25);
    const natural = c.text.length / (CPS[lang] || 13);
    u.rate = clamp((natural / slot) * 1.0, 0.92, 1.75) * clamp(video.playbackRate, 0.5, 2);
    u.volume = video.volume * (video.dataset.userMuted === '1' ? 0 : 1);
    stopSpeech();
    tts.speak(u);
  }
  function ttsTick() {
    if (S.audioMode !== 'browser_tts' || video.paused || !tts) return;
    const cues = cuesNow(S.audioLang); if (!cues) return;
    const i = cueIndexAt(cues, video.currentTime);
    if (i >= 0 && i !== S.spokenIdx) {
      S.spokenIdx = i;
      const into = video.currentTime - cues[i].start;
      const frac = 1 - into / (cues[i].end - cues[i].start);
      if (frac > 0.5) speakCue(cues, i, frac);
    } else if (i < 0 && tts.speaking) {
      // Cue window passed: let the sentence finish briefly, but never bleed into the next cue.
      const next = cues.find((c) => c.start > video.currentTime);
      if (next && next.start - video.currentTime < 0.15) stopSpeech();
    }
  }

  // ── loop & progress ────────────────────────────────────────────────────
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
    ttsTick();
    if (S.audioEl && !video.paused && Math.abs(S.audioEl.currentTime - t) > 0.25) S.audioEl.currentTime = t;
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
    api(`/api/courses/${encodeURIComponent(slug)}/progress`, { method: 'POST', body: { position, language: S.subLang, watchedDelta } })
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

  // ── live AI translation ─────────────────────────────────────────────────
  async function startLive(lang) {
    if (!lang) return;
    if (!S.liveAck) {
      const ok = await ask('Live AI translation creates subtitles in real time with a machine-translation model. They are not reviewed by medical experts and may contain errors. The original-language version is authoritative.', { confirmLabel: 'Start live translation' });
      if (!ok) return;
      S.liveAck = true;
    }
    S.live?.ctl.abort();
    const original = S.data.tracks[0].language;
    let source;
    try { source = (await loadCues(original)).map((c, idx) => ({ ...c, idx })); } catch { flash('Could not load the transcript.'); return; }
    const ctl = new AbortController();
    S.live = { lang, ctl, texts: new Map(), done: new Set(), total: source.length, status: 'translating', error: null };
    const rebuild = () => {
      const list = source.map((c) => ({ start: c.start, end: c.end, speaker: c.speaker, text: S.live.texts.get(c.idx) || '' }));
      S.cues.set(lang, list);
      if (S.subLang === lang) { S.lastCueIdx = -2; renderSubs(true); onCuesChange?.(lang, list, liveTrack()); }
      updateLangTag();
    };
    rebuild();
    S.subsOn = true; applySubStyle();
    S.subLang = lang;
    q('.p-lang-btn .code').textContent = lang.toUpperCase();
    rebuild(); renderMenus(); toggleMenu(null, false);
    flash(`Live AI translation: ${langInfo(lang)?.native || lang}`);
    if (video.paused && video.currentTime < 0.5) video.play().catch(() => {});
    const now = cueIndexAt(S.cues.get(lang), video.currentTime);
    const from = now >= 0 ? now : Math.max(0, source.findIndex((c) => c.start > video.currentTime));
    try {
      await translateLive({ slug, lang, source, from, signal: ctl.signal, courseTitle: title,
        onCues(items) { if (S.live?.ctl !== ctl) return; for (const it of items) { S.live.texts.set(it.idx, it.text); S.live.done.add(it.idx); } rebuild(); } });
      if (S.live?.ctl === ctl) { S.live.status = 'ready'; updateLangTag(); renderMenus(); }
    } catch (e) {
      if (S.live?.ctl !== ctl) return;
      S.live.status = 'error'; S.live.error = e.message || 'Live translation failed.';
      updateLangTag(); renderMenus(); flash(S.live.error);
    }
  }

  // ── menus ───────────────────────────────────────────────────────────────
  function renderMenus() {
    if (!S.data) return;
    const tr = S.live ? [...S.data.tracks, liveTrack()] : S.data.tracks;
    const opt = (checked, label, attrs, meta = '') => `<button class="opt" role="menuitemradio" aria-checked="${checked}" ${attrs}><span class="tick">${checked ? icon('check', 16) : ''}</span><span>${label}</span><span class="meta">${meta}</span></button>`;
    const reviewMini = (t) => t.original ? '<span class="mini">ORIGINAL</span>' : t.live ? '<span class="mini live">LIVE AI</span>' : `<span class="mini ai">AI</span>`;
    const have = new Set(tr.map((t) => t.language));
    const langs = state.meta?.languages || [];
    const optsFor = (list) => list.filter((l) => !have.has(l.code)).map((l) => `<option value="${l.code}">${esc(l.native)} · ${esc(l.name)}</option>`).join('');
    const liveBlock = liveAi?.allowed ? `
      <h4>Live AI translation · any language</h4>
      <div class="live-row"><select data-live-lang aria-label="Language for live translation">
        <optgroup label="Africa">${optsFor(langs.filter((l) => l.region === 'africa'))}</optgroup>
        <optgroup label="More languages">${optsFor(langs.filter((l) => l.region !== 'africa'))}</optgroup>
      </select><button class="live-go" data-live-start>${icon('zap', 14)} Translate live</button></div>
      <p class="note">Translates what is said, starting where you are now, while the video plays. Unreviewed machine translation — may contain errors.${S.live?.error ? ` <b style="color:#FCA5A5">${esc(S.live.error)}</b>` : ''}</p>` : '';
    langMenu.innerHTML = `
      <h4>Audio</h4>
      ${tr.filter((t) => t.audio !== 'none').map((t) => opt(S.audioLang === t.language, esc(langInfo(t.language)?.native || t.language) + (t.original ? '' : ` <span style="color:#8FA1BA">· ${t.audio === 'file' ? 'AI voice' : 'device voice'}</span>`), `data-audio="${t.language}"`, reviewMini(t))).join('')}
      ${S.audioMode === 'browser_tts' ? `<p class="note">This voice is synthesised by your device. If you hear nothing, your browser has no voice for this language — subtitles stay on.</p>` : S.audioMode === 'file' ? `<p class="note">AI voice track, time-synchronised to the original speakers.</p>` : ''}
      <h4>Subtitles</h4>
      ${opt(!S.subsOn, 'Off', 'data-sub="off"')}
      ${tr.map((t) => opt(S.subsOn && S.subLang === t.language, esc(langInfo(t.language)?.native || t.language), `data-sub="${t.language}"`, reviewMini(t))).join('')}
      <p class="note">AI translations preserve the original content but may contain errors. Check the review status shown for each course.</p>${liveBlock}`;
    const seg = (name, cur, items) => `<div class="seg" role="group">${items.map(([v, l]) => `<button data-set="${name}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
    setMenu.innerHTML = `
      <h4>Playback speed</h4>${seg('rate', S.rate, [[0.75, '0.75×'], [1, '1×'], [1.25, '1.25×'], [1.5, '1.5×'], [2, '2×']])}
      <h4>Subtitle size</h4>${seg('size', S.size, [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']])}
      <h4>Subtitle position</h4>${seg('position', S.position, [['bottom', 'Bottom'], ['top', 'Top']])}
      <h4>Subtitle background</h4>${seg('bg', S.bg, [[0, 'None'], [0.45, 'Light'], [0.75, 'Medium'], [0.95, 'Solid']])}
      <p class="note">Shortcuts: Space/K play · J/L ±10 s · ←/→ ±5 s · M mute · C subtitles · F fullscreen</p>`;
  }
  function toggleMenu(name, open) {
    for (const m of [langMenu, setMenu]) {
      const isIt = m.dataset.menu === name;
      const show = isIt && (open ?? m.hidden);
      m.hidden = !show;
      q(`[data-a=${m.dataset.menu}]`).setAttribute('aria-expanded', String(show));
    }
  }

  // ── controls ────────────────────────────────────────────────────────────
  const togglePlay = () => (video.paused ? video.play().catch(() => {}) : video.pause());
  const seekBy = (s) => { video.currentTime = clamp(video.currentTime + s, 0, duration()); };
  function setMuted(m) {
    video.dataset.userMuted = m ? '1' : '0';
    if (S.audioMode === 'original') video.muted = m;
    if (S.audioEl) S.audioEl.muted = m;
    if (m) stopSpeech();
    q('[data-a=mute]').innerHTML = String(icon(m ? 'mute' : 'volume', 20));
  }
  function toggleFs() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a],[data-sub],[data-audio],[data-set],[data-live-start]');
    if (!b) {
      if (e.target === video || e.target.closest('.p-overlay') || e.target.closest('.p-subs')) {
        // First tap on a playing, idle player (touch) only reveals the controls.
        if (S.wasIdle && e.pointerType !== 'mouse') return;
        toggleMenu(null, false); togglePlay();
      }
      return;
    }
    const a = b.dataset.a;
    if (a === 'play') togglePlay();
    else if (a === 'back') seekBy(-10);
    else if (a === 'fwd') seekBy(10);
    else if (a === 'mute') setMuted(video.dataset.userMuted !== '1');
    else if (a === 'fs') toggleFs();
    else if (a === 'cc') { S.subsOn = !S.subsOn; prefs.set('subsOn', S.subsOn); applySubStyle(); updateLangTag(); renderMenus(); flash(S.subsOn ? 'Subtitles on' : 'Subtitles off'); }
    else if (a === 'lang' || a === 'settings') toggleMenu(a);
    else if (b.dataset.sub) {
      if (b.dataset.sub === 'off') { S.subsOn = false; applySubStyle(); updateLangTag(); renderMenus(); }
      else { S.subsOn = true; applySubStyle(); setSubtitleLang(b.dataset.sub); }
      prefs.set('subsOn', S.subsOn);
    } else if (b.dataset.audio) setAudioLang(b.dataset.audio);
    else if (b.hasAttribute('data-live-start')) startLive(langMenu.querySelector('[data-live-lang]').value);
    else if (b.dataset.set) {
      const k = b.dataset.set; const v = b.dataset.v;
      if (k === 'rate') { S.rate = Number(v); video.playbackRate = S.rate; if (S.audioEl) S.audioEl.playbackRate = S.rate; flash(`Speed ${v}×`); }
      if (k === 'size') { S.size = v; prefs.set('subSize', v); }
      if (k === 'position') { S.position = v; prefs.set('subPos', v); }
      if (k === 'bg') { S.bg = Number(v); prefs.set('subBg', S.bg); }
      applySubStyle(); renderMenus();
    }
  });
  q('.p-vol input').addEventListener('input', (e) => {
    video.volume = Number(e.target.value); if (S.audioEl) S.audioEl.volume = video.volume;
    setMuted(video.volume === 0);
  });

  // timeline (pointer + keyboard)
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
    const map = { ' ': togglePlay, k: togglePlay, j: () => seekBy(-10), l: () => seekBy(10), arrowleft: () => seekBy(-5), arrowright: () => seekBy(5),
      m: () => setMuted(video.dataset.userMuted !== '1'), f: toggleFs, c: () => q('[data-a=cc]').click(), escape: () => toggleMenu(null, false),
      arrowup: () => { video.volume = clamp(video.volume + 0.1, 0, 1); q('.p-vol input').value = video.volume; flash(`Volume ${Math.round(video.volume * 100)}%`); },
      arrowdown: () => { video.volume = clamp(video.volume - 0.1, 0, 1); q('.p-vol input').value = video.volume; flash(`Volume ${Math.round(video.volume * 100)}%`); } };
    if (/^[0-9]$/.test(k)) { video.currentTime = (Number(k) / 10) * duration(); e.preventDefault(); return; }
    if (map[k]) { e.preventDefault(); map[k](); wake(); }
  });

  // idle UI
  const wake = () => { el.classList.remove('idle'); clearTimeout(S.idleTimer); S.idleTimer = setTimeout(() => { if (!video.paused && langMenu.hidden && setMenu.hidden) el.classList.add('idle'); }, 2600); };
  el.addEventListener('pointermove', wake);
  el.addEventListener('pointerdown', () => { S.wasIdle = el.classList.contains('idle'); wake(); });

  // video events
  video.addEventListener('play', () => {
    el.classList.add('playing'); q('.p-overlay').hidden = true;
    q('[data-a=play]').innerHTML = String(icon('pause', 20)); q('[data-a=play]').setAttribute('aria-label', 'Pause (k)');
    S.audioEl?.play().catch(() => {});
    // Resume speech for the current cue if we are early enough in it.
    if (S.audioMode === 'browser_tts') S.spokenIdx = -1;
    wake();
  });
  video.addEventListener('pause', () => {
    el.classList.remove('playing'); el.classList.remove('idle'); q('.p-overlay').hidden = false;
    q('[data-a=play]').innerHTML = String(icon('play', 20)); q('[data-a=play]').setAttribute('aria-label', 'Play (k)');
    S.audioEl?.pause(); stopSpeech(); report();
  });
  video.addEventListener('seeking', () => {
    stopSpeech();
    if (S.audioEl) S.audioEl.currentTime = video.currentTime;
    S.spokenIdx = cueIndexAt(cuesNow(S.audioLang), video.currentTime, 0.6);
  });
  video.addEventListener('ratechange', () => { if (S.audioEl) S.audioEl.playbackRate = video.playbackRate; });
  video.addEventListener('waiting', () => { q('.p-loading').hidden = false; S.audioEl?.pause(); stopSpeech(); });
  video.addEventListener('playing', () => { q('.p-loading').hidden = true; if (S.audioEl && !video.paused) S.audioEl.play().catch(() => {}); });
  video.addEventListener('canplay', () => { q('.p-loading').hidden = true; });
  video.addEventListener('progress', () => { const d = duration(); if (d && video.buffered.length) buffer.style.width = `${(video.buffered.end(video.buffered.length - 1) / d) * 100}%`; });
  video.addEventListener('ended', () => { report(); stopSpeech(); });
  video.addEventListener('error', () => {
    if (S.destroyed || !S.data) return;
    showError({ status: video.error?.code === 4 ? 0 : 0, message: 'The video could not be loaded. The secure link may have expired — please try again.' });
  });
  document.addEventListener('fullscreenchange', onFs);
  function onFs() { const b = q('[data-a=fs]'); if (b) b.innerHTML = String(icon(document.fullscreenElement === el ? 'shrink' : 'expand', 19)); }
  const onHide = () => { if (document.visibilityState === 'hidden' && S.data) report(); };
  document.addEventListener('visibilitychange', onHide);
  el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) toggleMenu(null, false); });

  init();
  requestAnimationFrame(frame);

  return {
    seek(t) { video.currentTime = t; if (video.paused) video.play().catch(() => {}); el.focus({ preventScroll: true }); },
    get video() { return video; },
    destroy() {
      S.destroyed = true;
      if (S.data && video.currentTime > 0) report();
      stopSpeech(); S.audioEl?.pause(); S.live?.ctl.abort();
      video.pause(); video.removeAttribute('src'); video.load();
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('visibilitychange', onHide);
    },
  };
}
