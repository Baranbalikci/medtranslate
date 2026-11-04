import { html, icon } from '../ui.js';
import { state } from '../store.js';

export default {
  title: 'Technology',
  description: 'How MedTranslate translates, subtitles and dubs medical education with AI — and keeps humans in control.',
  render() {
    const i = state.meta.integrations;
    const conn = (ok, label) => html`<span class="badge ${ok ? 'badge-ok' : 'badge-warn'}">${ok ? 'Connected' : label || 'Not connected'}</span>`;
    return html`
    <section class="hero" style="padding-bottom:72px">
      <div class="container narrow center">
        <span class="eyebrow">Technology</span>
        <h1 style="margin-top:12px">AI that translates the language — <span class="grad-text">never the medicine.</span></h1>
        <p class="lead" style="margin:0 auto 28px">A translation, subtitle and voice pipeline designed for clinical education: terminology-aware, time-synchronised, transparently labelled and quality-controlled.</p>
        <a class="btn btn-accent btn-lg" href="/courses/stroke-first-60-minutes">Try it in the player ${icon('play', 16)}</a>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head"><span class="eyebrow">Pipeline</span><h2>Five stages, every one auditable</h2></div>
        <div class="grid-2" style="gap:20px">
          ${[
            ['file', '1 · Source & transcript', 'The licensed original video and a time-coded transcript (cues with speaker labels) are the single source of truth. If the source changes, every translation automatically returns to review.'],
            ['sparkles', '2 · Medical machine translation', 'Cues are translated in context with a large language model (Anthropic Claude). The prompt enforces meaning preservation — no added, omitted or softened statements, numbers, thresholds or doses — plus a curated medical glossary per language. Uncertain cues are flagged for the reviewer.'],
            ['wave', '3 · Speaker-aware AI audio', 'Each translated cue becomes speech fitted to the original time slot. Different speakers get different voices. In this demo, voices are synthesised in the browser (Web Speech API); the production interface accepts server-rendered neural audio tracks that the player keeps in sync with drift correction.'],
            ['shield', '4 · Medical quality control', 'A qualified reviewer post-edits the translation side-by-side with the original and records a decision with checks for terminology, preserved meaning and timing. Only an approval unlocks release.'],
            ['zap', '5 · Release & streaming', 'Each language is released individually, and only if the licence covers it. Media is delivered via expiring signed URLs with HTTP range streaming (CDN-ready); subtitles are lightweight JSON cues, prefetched so switching is instant.'],
            ['globe', 'Instant language switching', 'The video element is never reloaded when you change language. Subtitles and audio are independent layers on top of one continuous playback session.'],
          ].map(([ic, t, d]) => html`<div class="feature"><div class="ic">${icon(ic, 22)}</div><h3>${t}</h3><p>${d}</p></div>`)}
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="container grid-2" style="gap:48px;align-items:start">
        <div>
          <span class="eyebrow">Transparency</span>
          <h2>Clearly labelled, never overstated</h2>
          <p class="muted">In line with the transparency obligations of the EU AI Act, every AI-generated subtitle and voice is marked as such in the player and on the course page, together with its review status. We do not claim that machine translation is error-free, and the original-language version remains authoritative.</p>
          <a href="/legal/ki-transparenz">Read our AI transparency statement ${icon('arrow', 14)}</a>
        </div>
        <div class="panel">
          <h3>Integration status of this deployment</h3>
          <dl class="kv" style="grid-template-columns:1fr auto;margin-top:12px">
            <dt>AI translation (Claude API)</dt><dd>${conn(i.aiTranslation.connected)}</dd>
            <dt>Server-side neural TTS</dt><dd>${conn(i.tts.connected, 'Browser voice fallback')}</dd>
            <dt>Payments</dt><dd>${conn(i.payments.mode === 'stripe', 'Demo mode')}</dd>
            <dt>Media delivery</dt><dd><span class="badge badge-ok">Signed URLs · range streaming</span></dd>
          </dl>
          <p class="xs muted" style="margin:14px 0 0">Integrations without credentials stay disconnected and are labelled — the platform never simulates a real translation or payment.</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head"><span class="eyebrow">Architecture</span><h2>Secure, fast and built to scale</h2></div>
        <div class="grid-3">
          ${[
            ['lock', 'Security', 'scrypt password hashing, HttpOnly session cookies, CSRF protection, strict Content-Security-Policy, rate limiting and audit logging of all administrative actions.'],
            ['zap', 'Performance', 'No framework overhead, lazy-loaded views, gzip, HTTP caching, range requests and progressive video start (fast-start MP4; HLS/CMAF-ready via CDN).'],
            ['users', 'Accessibility', 'Keyboard-operable player, adjustable subtitle size, position and background, reduced-motion support, semantic markup and visible focus states.'],
          ].map(([ic, t, d]) => html`<div class="feature"><div class="ic">${icon(ic, 22)}</div><h3>${t}</h3><p>${d}</p></div>`)}
        </div>
      </div>
    </section>`;
  },
};
