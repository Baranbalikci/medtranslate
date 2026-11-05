import { html, icon, $, $$ } from '../ui.js';
import { state } from '../store.js';

// One real sentence from the free demo course, followed through every stage.
const SENT = {
  start: '00:22.0', end: '00:29.5', speaker: 'Expert',
  en: 'Check capillary glucose immediately, because hypoglycaemia can mimic a stroke and is easily corrected.',
  tr: [
    ['de', 'Deutsch', 'Bestimmen Sie sofort den Kapillarblutzucker, denn eine Hypoglykämie kann einen Schlaganfall imitieren und ist leicht zu korrigieren.'],
    ['sw', 'Kiswahili', 'Pima sukari ya damu ya kidole mara moja, kwa sababu sukari ya chini inaweza kuiga kiharusi na hurekebishwa kwa urahisi.'],
    ['qu', 'Runa Simi', 'Chaylla rukana yawarpi azúcarta tupuy, pisi azúcarqa strokman rikch’akunmanmi, hinaspa mana sasachu allichanapaq.'],
  ],
};

const STAGES = [
  ['Source', 'Licensed video and a time-coded transcript are the single source of truth.', 'file'],
  ['Translate', 'Context-aware AI translation under medical rules and a glossary.', 'sparkles'],
  ['Voice', 'One voice per speaker, every sentence fitted to its time slot.', 'wave'],
  ['Review', 'A qualified person approves terminology, meaning and timing.', 'shield'],
  ['Release', 'Only licensed, approved languages go live. Switching never reloads.', 'zap'],
];

const pipelineSvg = () => html`<svg class="tech-pipe" viewBox="0 0 560 300" role="img" aria-label="Pipeline: source, translate, voice, review, release">
  <defs>
    <linearGradient id="tp-line" x1="0" x2="1"><stop offset="0" stop-color="#22D3EE" stop-opacity=".1"/><stop offset=".5" stop-color="#22D3EE"/><stop offset="1" stop-color="#A7F3D0" stop-opacity=".9"/></linearGradient>
    <filter id="tp-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g class="tp-grid" stroke="rgba(255,255,255,.05)">${Array.from({ length: 14 }, (_, i) => html`<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="300"/>`)}${Array.from({ length: 8 }, (_, i) => html`<line x1="0" y1="${i * 40}" x2="560" y2="${i * 40}"/>`)}</g>
  <path class="tp-rail" d="M40 120 H440" stroke="rgba(255,255,255,.12)" stroke-width="2" fill="none"/>
  <path class="tp-flow" d="M40 120 H440" stroke="url(#tp-line)" stroke-width="2.5" fill="none" stroke-dasharray="6 14"/>
  ${STAGES.map(([t], i) => html`<g class="tp-node" style="--i:${i}" transform="translate(${40 + i * 100} 120)">
      <circle r="22" fill="#0B1D3A" stroke="rgba(103,232,249,.5)" stroke-width="1.5"/>
      <circle class="tp-pulse" r="22" fill="none" stroke="#22D3EE" stroke-width="1.5"/>
      <text y="4" text-anchor="middle" fill="#CFFAFE" font-size="12" font-weight="700">${String(i + 1).padStart(2, '0')}</text>
      <text y="48" text-anchor="middle" fill="#E2E8F0" font-size="12.5" font-weight="600">${t}</text></g>`)}
  <g class="tp-fan" transform="translate(440 120)">
    ${[['DE', -78], ['SW', -50], ['AR', -22], ['QU', 6], ['HI', 34], ['AM', 62]].map(([l, y], i) => html`<g style="--i:${i}"><path d="M0 0 C 30 0, 30 ${y + 100} 56 ${y + 100}" stroke="rgba(167,243,208,.45)" fill="none" stroke-width="1.2"/><rect x="56" y="${y + 90}" width="38" height="20" rx="10" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.2)"/><text x="75" y="${y + 104}" text-anchor="middle" fill="#E2E8F0" font-size="10.5" font-weight="700">${l}</text></g>`)}
  </g>
  <g transform="translate(40 250)" fill="#8FA1BA" font-size="11"><text>one licensed source</text><text x="480" text-anchor="end">every language released on its own</text></g>
</svg>`;

export default {
  title: 'Technology',
  description: 'How MedTranslate translates, subtitles and dubs medical education with AI — and keeps humans in control.',
  render() {
    const i = state.meta.integrations;
    const st = (ok, off) => html`<span class="tech-state ${ok ? 'on' : 'off'}">${ok ? 'connected' : off}</span>`;
    return html`
    <section class="tech-hero">
      <div class="container tech-hero-grid">
        <div>
          <span class="eyebrow reveal" data-fx="drop">Technology</span>
          <h1 data-fx="words" style="margin-top:12px">AI that translates the language. <span class="grad-text">Never the medicine.</span></h1>
          <p class="lead reveal" data-fx="blur" style="--d:.3s">A translation, subtitle and voice pipeline built for clinical education: terminology-aware, time-synchronised, openly labelled and quality-controlled.</p>
          <div class="row reveal" style="margin-top:28px;--d:.45s"><a class="btn btn-accent btn-lg" href="/courses/stroke-first-60-minutes">Try it in the player ${icon('play', 16)}</a><a class="btn btn-glass btn-lg" href="#sentence">Follow one sentence</a></div>
        </div>
        <div class="tech-visual reveal" data-fx="rise3d">${pipelineSvg()}</div>
      </div>
    </section>

    <section class="section" id="sentence">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow reveal">How it works</span>
          <h2 data-fx="words">One sentence, five stages</h2>
          <p class="reveal" data-fx="blur">A real line from the free demo course, followed from the licensed source to the learner's screen. The panel shows what each stage actually produces.</p>
        </div>
        <div class="tech-flow reveal" data-fx="blur">
          <ol class="tf-steps" role="tablist" aria-label="Pipeline stages">
            ${STAGES.map(([t, d, ic], k) => html`<li><button type="button" role="tab" class="tf-step ${k === 0 ? 'on' : ''}" data-step="${k}" aria-selected="${k === 0}"><span class="tf-n">${icon(ic, 17)}</span><span><b>${t}</b><small>${d}</small></span><i class="tf-bar"></i></button></li>`)}
          </ol>
          <div class="tf-console" aria-live="polite">
            <div class="tf-bar-top"><i></i><i></i><i></i><span id="tf-title">source.cue</span><span class="tf-live"><i></i> demo data</span></div>
            <div class="tf-body" id="tf-body"></div>
          </div>
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="container">
        <div class="section-head"><span class="eyebrow reveal">Measured on this build</span><h2 data-fx="words">Numbers you can check</h2></div>
        <div class="tech-facts" data-stagger>
          ${[
            ['≈ 1.2', 'KB / min', 'Subtitles as JSON cues. Switching language downloads kilobytes, not video.'],
            ['40', 'kbps', 'Voice tracks (AAC). A dubbed lecture costs about 300 KB per minute.'],
            ['0', 'reloads', 'The video element is never replaced when you change language.'],
            ['< 0.1', 's drift', 'Typical offset between voice track and video during playback (demo measurement).'],
          ].map(([n, u, d]) => html`<div class="tf-fact"><div class="n"><b>${n}</b><span>${u}</span></div><p>${d}</p></div>`)}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head"><span class="eyebrow reveal">Architecture</span><h2 data-fx="words">Small surface, clear boundaries</h2>
          <p class="reveal" data-fx="blur">One Node.js process, one database, plain HTTP. Every outside service sits behind a thin interface and says honestly whether it is connected.</p></div>
        <div class="arch reveal" data-fx="blur">
          <div class="arch-col"><h3>Browser</h3>
            <div class="arch-box"><b>Site &amp; player</b><span>Vanilla JS, no build step. One video element, subtitle overlay, synced voice track.</span></div>
            <div class="arch-box"><b>Planner</b><span>Learning calendar with .ics export.</span></div></div>
          <div class="arch-link" aria-hidden="true"><i></i></div>
          <div class="arch-col core"><h3>Server</h3>
            <div class="arch-box hot"><b>Compliance gate</b><span>Licence, territory, QC approval and accreditation checked on every read and publish.</span></div>
            <div class="arch-box"><b>API</b><span>Signed media URLs, range streaming, CSRF protection, rate limits, audit log.</span></div></div>
          <div class="arch-link" aria-hidden="true"><i></i></div>
          <div class="arch-col"><h3>Services</h3>
            <div class="arch-box"><b>Translation · Claude</b>${st(i.aiTranslation.connected, 'not connected')}</div>
            <div class="arch-box"><b>Voice · TTS</b>${st(i.tts.connected, 'demo voices')}</div>
            <div class="arch-box"><b>Payments · Stripe</b>${st(i.payments.mode === 'stripe', 'demo mode')}</div></div>
          <div class="arch-link" aria-hidden="true"><i></i></div>
          <div class="arch-col"><h3>Data</h3>
            <div class="arch-box"><b>SQLite</b><span>Courses, licences, translations, reviews. Swap for PostgreSQL to scale out.</span></div>
            <div class="arch-box"><b>Media files</b><span>CDN-ready; HLS renditions in production.</span></div></div>
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="container">
        <div class="grid-3" data-stagger>
          ${[
            ['shield', 'Rights before reach', 'A language cannot go live unless the licence covers it. Remove a right and the course suspends itself.'],
            ['sparkles', 'AI is always labelled', 'Subtitles and voices say they are AI-generated and show their review status. The original stays authoritative.'],
            ['users', 'Humans decide', 'Reviewers sign off terminology, meaning and timing. Changing the source sends every translation back to review.'],
          ].map(([ic, t, d]) => html`<div class="feature"><div class="ic">${icon(ic, 22)}</div><h3>${t}</h3><p>${d}</p></div>`)}
        </div>
        <p class="small muted center" style="margin-top:28px"><a href="/legal/ki-transparenz">Read the AI transparency statement</a></p>
      </div>
    </section>`;
  },

  mount(root) {
    const body = $('#tf-body', root); const title = $('#tf-title', root);
    const steps = $$('.tf-step', root);
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    const hl = (t) => esc(t).replace(/(hypoglycaemia|capillary glucose)/g, '<mark>$1</mark>');
    const views = [
      () => `<pre class="code"><span class="c">// cue 03 · transcript from the licensed provider</span>
{
  <span class="k">"start"</span>: <span class="s">"${SENT.start}"</span>, <span class="k">"end"</span>: <span class="s">"${SENT.end}"</span>,
  <span class="k">"speaker"</span>: <span class="s">"${SENT.speaker}"</span>,
  <span class="k">"lang"</span>: <span class="s">"en"</span>,
  <span class="k">"text"</span>: <span class="s">"${hl(SENT.en)}"</span>
}</pre><p class="note">Rights are checked here first: use, translation, subtitles, AI audio, territory and term.</p>`,
      () => `<div class="tr-list">${SENT.tr.map(([c, n, t], k) => `<div class="tr-row" style="--k:${k}"><span class="tr-l">${c.toUpperCase()}<small>${n}</small></span><p>${esc(t)}</p></div>`).join('')}</div>
        <div class="rules"><span>meaning, numbers and doses unchanged</span><span>glossary terms locked</span><span>similar length to the source</span></div>`,
      () => `<div class="slot"><span>time slot ${SENT.start} → ${SENT.end} · 7.5 s</span><div class="wave">${Array.from({ length: 46 }, (_, k) => `<i style="--k:${k}"></i>`).join('')}</div></div>
        <div class="voices"><span><b>Host</b> → voice A</span><span><b>Expert</b> → voice B</span><span>fitted: time-stretch up to 1.7×</span></div>
        <p class="note">Natural neural voices exist for six languages in this demo; others use synthetic voices. Languages without a voice keep the original audio.</p>`,
      () => `<ul class="checks">${['Terminology matches glossary and clinical usage', 'Meaning, numbers and doses preserved', 'Readable within the time slot, in sync'].map((t, k) => `<li style="--k:${k}">${'✓'} ${t}</li>`).join('')}</ul>
        <div class="flow-chips"><span>machine</span><i></i><span>in review</span><i></i><span class="on">approved</span><i></i><span>released</span></div>
        <p class="note">The decision is stored with the reviewer's qualification. Demo translations have no medical review yet.</p>`,
      () => `<ul class="checks gate">${['Licence covers this language', 'Territory allows the viewer’s country', 'Translation approved by a reviewer', 'Accreditation status shown honestly'].map((t, k) => `<li style="--k:${k}">${'✓'} ${t}</li>`).join('')}</ul>
        <div class="stream"><span><b>≈ 1.2 KB</b> subtitles / min</span><span><b>40 kbps</b> voice</span><span><b>0</b> reloads on switch</span></div>`,
    ];
    const titles = ['source.cue', 'translate · 3 of 53 languages', 'voice · slot fitting', 'review.decision', 'release.gate'];
    let cur = 0; let timer = 0; let paused = false;
    function show(k) {
      cur = k;
      steps.forEach((s, i) => { s.classList.toggle('on', i === k); s.setAttribute('aria-selected', String(i === k)); });
      title.textContent = titles[k];
      body.classList.remove('in'); body.innerHTML = views[k](); void body.offsetWidth; body.classList.add('in');
    }
    const tick = () => { if (!paused && !document.hidden) show((cur + 1) % views.length); };
    const restart = () => { clearInterval(timer); timer = setInterval(tick, 6500); };
    steps.forEach((s) => s.addEventListener('click', () => { show(Number(s.dataset.step)); restart(); }));
    const flow = $('.tech-flow', root);
    flow.addEventListener('pointerenter', () => { paused = true; }); flow.addEventListener('pointerleave', () => { paused = false; });
    flow.addEventListener('focusin', () => { paused = true; }); flow.addEventListener('focusout', () => { paused = false; });
    show(0); restart();
    return () => clearInterval(timer);
  },
};
