import { html, raw, icon, courseCard, skeletonCards, $ } from '../ui.js';
import { state } from '../store.js';
import { get } from '../api.js';
import { faqList, FAQ } from './faq.js';

const HERO_LINES = [
  ['EN', 'Every patient with suspected ACS should have a 12-lead ECG within ten minutes of first medical contact.'],
  ['DE', 'Bei Verdacht auf ein akutes Koronarsyndrom sollte innerhalb von zehn Minuten ein 12-Kanal-EKG geschrieben werden.'],
  ['ES', 'Todo paciente con sospecha de SCA debe tener un ECG de doce derivaciones en los primeros diez minutos.'],
  ['TR', 'Akut koroner sendrom şüphesi olan her hastada on dakika içinde on iki derivasyonlu EKG çekilmelidir.'],
  ['AR', 'يجب إجراء تخطيط قلب من اثني عشر اتجاهًا خلال عشر دقائق لكل مريض يُشتبه في إصابته بمتلازمة تاجية حادة.'],
  ['SW', 'Kila mgonjwa anayeshukiwa kuwa na ACS anapaswa kupimwa ECG ya mikondo kumi na miwili ndani ya dakika kumi.'],
  ['JA', '急性冠症候群が疑われる患者では、10分以内に12誘導心電図を記録する必要があります。'],
  ['FR', 'Tout patient suspect de SCA doit bénéficier d’un ECG 12 dérivations dans les dix minutes.'],
];

export const specIcon = (name) => icon(name || 'stethoscope', 20);

export default {
  title: '',
  description: 'Access high-quality medical education worldwide through AI-powered translation, subtitles and multilingual audio.',
  async render() {
    const m = state.meta;
    const live = m.languages.filter((l) => l.live);
    const africa = m.languages.filter((l) => l.region === 'africa');
    const row = (list) => html`${[...list, ...list].map((l) => html`<span class="lang-pill ${l.live ? 'live' : ''}" aria-hidden="true">${l.live ? html`<span class="live-dot"></span>` : html`<span class="soon-dot"></span>`}${l.native} <small>${l.name}</small></span>`)}`;
    return html`
    <section class="hero" data-fx-scroll="hero">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="container hero-grid">
        <div class="hero-copy">
          <span class="pill reveal" data-fx="drop"><span class="dot">NEW</span> Live AI subtitles in any language · Africa first</span>
          <h1 data-fx="words">Medical knowledge<br><span class="grad-text">without language barriers.</span></h1>
          <p class="lead reveal" data-fx="blur" style="--d:.35s">Access high-quality medical education worldwide through AI-powered translation, subtitles and multilingual audio — from licensed providers, with transparent quality control.</p>
          <div class="hero-actions reveal" style="--d:.5s">
            <a href="/courses" class="btn btn-accent btn-lg magnetic">Explore Courses ${icon('arrow', 18)}</a>
            <a href="/technology" class="btn btn-glass btn-lg">Discover the Technology</a>
          </div>
          <div class="hero-stats reveal" style="--d:.65s">
            <div><b data-count="${m.stats.courses}">0</b><span>demo courses</span></div>
            <div><b data-count="${m.stats.languages}">0</b><span>languages with released tracks</span></div>
            <div><b data-count="${m.languages.length}">0</b><span>languages via live AI</span></div>
          </div>
        </div>
        <div class="hero-visual reveal" data-fx="rise3d">
          <div class="tv" aria-hidden="true">
            <div class="tv-screen">
              <img src="/media/posters/acs-early-ecg-recognition.jpg" alt="">
              <span class="tv-badge">${icon('sparkles', 13)} AI translation · live switch</span>
              <div class="tv-sub" id="tv-sub"><span>${HERO_LINES[0][1]}</span></div>
              <div class="tv-scan"></div>
            </div>
            <div class="tv-bar">
              <span style="color:#fff">${icon('pause', 16)}</span>
              <div class="tv-progress"><i></i></div>
              <div class="tv-langs">${HERO_LINES.slice(0, 6).map(([c], i) => html`<span class="tv-lang ${i === 0 ? 'on' : ''}" data-l="${c}">${c}</span>`)}</div>
            </div>
          </div>
          <div class="float-card fc-1"><span class="ic">${icon('subtitles', 18)}</span><div><b>Subtitles synced</b><small>Medical terminology glossary</small></div></div>
          <div class="float-card fc-2"><span class="ic"><span class="wave-bars"><i></i><i></i><i></i><i></i><i></i></span></span><div><b>AI voice · Kiswahili</b><small>Time-synchronised dubbing</small></div></div>
        </div>
      </div>
      <a href="#platform" class="scroll-cue" aria-label="Scroll down"><span></span></a>
    </section>

    <section class="section" id="platform">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow reveal">The platform</span>
          <h2 data-fx="words">Great medical education already exists. Language shouldn't lock it away.</h2>
          <p class="reveal" data-fx="blur">MedTranslate licenses existing CME/CPD video courses and makes them accessible in many languages — the medical content stays exactly as the original faculty presented it. Only the language changes.</p>
        </div>
        <div class="grid-3" data-stagger>
          ${[
            ['shield', 'Licensed content only', 'Every course is published only after the rights to use, translate, subtitle, dub and distribute it are documented in our licence register.'],
            ['sparkles', 'AI translation, human control', 'AI drafts subtitles and audio with an enforced medical glossary. Translations are labelled and pass a documented quality-control step before release.'],
            ['award', 'Honest accreditation', 'We show the real CME/CPD status of every course. A translation never implies credits in another country — and we never invent points.'],
          ].map(([i, t, d]) => html`<div class="feature"><div class="ic">${icon(i, 22)}</div><h3>${t}</h3><p>${d}</p></div>`)}
        </div>
      </div>
    </section>

    <section class="section dark morph" data-fx-scroll>
      <div class="container">
        <div class="section-head">
          <span class="eyebrow reveal">How AI translation works</span>
          <h2 data-fx="words">From one lecture to a global classroom</h2>
          <p class="reveal" data-fx="blur">A transparent pipeline where every step is logged and every language is released individually.</p>
        </div>
        <div class="pipeline" data-fx-scroll>
          <div class="pipe-line" aria-hidden="true"><i></i></div>
          ${[
            ['Licensed source', 'Original video and transcript from the provider, with rights verified.'],
            ['Medical AI translation', 'Cue-by-cue translation with glossary-enforced terminology and timing constraints.'],
            ['Speaker-aware voice', 'AI audio per language, a distinct voice per speaker, time-fitted to the original.'],
            ['Medical QC', 'Qualified reviewers check terminology, meaning and sync. Decisions are documented.'],
            ['Release & stream', 'Only approved, licensed languages go live — switchable instantly in the player.'],
          ].map(([t, d], k) => html`<div class="pipe" style="--k:${k}"><h3>${t}</h3><p>${d}</p></div>`)}
        </div>
        <div class="row reveal" style="margin-top:36px"><a href="/technology" class="btn btn-glass">Read about the technology ${icon('arrow', 16)}</a></div>
      </div>
    </section>

    <section class="section languages-band">
      <div class="container center">
        <div class="section-head center">
          <span class="eyebrow reveal">Languages</span>
          <h2 data-fx="words">Switch language mid-lecture. No reload.</h2>
          <p class="reveal" data-fx="blur">Choose subtitles and AI audio independently. Released languages are reviewed per course — and live AI translation covers every language below.</p>
        </div>
      </div>
      <div class="marquee reveal" data-fx="blur"><div class="marquee-track">${row(m.languages.filter((l) => !l.region))}</div></div>
      <div class="marquee reverse reveal" data-fx="blur"><div class="marquee-track">${row([...africa, ...live.filter((l) => !l.region).slice(0, 4)])}</div></div>
    </section>

    <section class="section africa" data-fx-scroll>
      <div class="africa-bg" aria-hidden="true"></div>
      <div class="container grid-2 africa-grid">
        <div>
          <span class="eyebrow reveal">Africa first</span>
          <h2 data-fx="words">Built for where the need is greatest.</h2>
          <p class="lead reveal" data-fx="blur">Clinicians in low- and middle-income countries carry the heaviest disease burden with the least access to current continuing education in their own language. That is who we build for first.</p>
          <ul class="checklist reveal" data-fx="blur">
            <li>${icon('zap', 18)}<span><b>Live AI subtitles in any language</b> — Kiswahili, Hausa, Yorùbá, Igbo, isiZulu, Amharic, Somali, Kinyarwanda, Afaan Oromoo — generated while the lecture plays.</span></li>
            <li>${icon('wave', 18)}<span><b>AI voice tracks</b> already available in Kiswahili and Amharic for featured courses, plus French, Arabic and Portuguese.</span></li>
            <li>${icon('download', 18)}<span><b>Made for slow connections</b> — subtitles need about 1 KB per minute; switch to audio-only or subtitles when bandwidth is short.</span></li>
          </ul>
          <a class="btn btn-accent btn-lg magnetic reveal" style="margin-top:12px" href="/courses/sepsis-hour-one">Try Kiswahili in the player ${icon('play', 16)}</a>
        </div>
        <div class="bandwidth reveal" data-fx="rise3d">
          <h3>Data per minute of lecture</h3>
          ${[['Subtitles (any language)', 1, '≈ 1 KB'], ['AI voice track (40 kbps)', 300, '≈ 300 KB'], ['Video, low quality (≈ 500 kbps)', 3750, '≈ 3.7 MB']].map(([l, v, t]) => html`
            <div class="bw-row"><span>${l}</span><span class="bw-bar"><i style="--w:${Math.max(1.2, Math.log10(v + 1) / Math.log10(3751) * 100)}%"></i></span><b>${t}</b></div>`)}
          <p class="xs">Logarithmic scale. Subtitle size measured from the demo transcripts; audio and video sizes follow from their bitrates.</p>
          <div class="africa-langs">${africa.map((l, i) => html`<span style="--i:${i}">${l.native}</span>`)}</div>
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="container">
        <div class="row between" style="margin-bottom:32px;align-items:flex-end">
          <div class="section-head" style="margin:0"><span class="eyebrow reveal">Course preview</span><h2 data-fx="words">Featured courses</h2><p class="reveal" data-fx="blur">Sample courses to explore the player, AI voices and live translation.</p></div>
          <a href="/courses" class="btn btn-ghost reveal">All courses ${icon('arrow', 16)}</a>
        </div>
        <div id="featured">${skeletonCards(3)}</div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="row between" style="margin-bottom:32px;align-items:flex-end">
          <div class="section-head" style="margin:0"><span class="eyebrow reveal">Medical specialties</span><h2 data-fx="words">Learn across the full breadth of medicine</h2></div>
          <a href="/specialties" class="btn btn-ghost reveal">All specialties ${icon('arrow', 16)}</a>
        </div>
        <div class="spec-grid" data-stagger>
          ${m.specialties.map((s) => html`<a class="spec" href="/specialties/${s.slug}"><span class="ic">${specIcon(s.icon)}</span><span><b>${s.name}</b><small>${s.course_count ? `${s.course_count} course${s.course_count > 1 ? 's' : ''}` : 'Coming soon'}</small></span></a>`)}
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="container grid-2" style="align-items:center;gap:56px">
        <div>
          <span class="eyebrow reveal">For physicians & healthcare professionals</span>
          <h2 data-fx="words">Built around how clinicians actually learn</h2>
          <p class="lead reveal" data-fx="blur">Short, focused modules from respected providers — in the language you think in.</p>
          <a href="/register" class="btn btn-primary reveal" style="margin-top:12px">Create a free account</a>
        </div>
        <div class="grid-2" data-stagger>
          ${[
            ['globe', 'Your language, your pace', 'Original audio, AI voice or subtitles — switch at any time.'],
            ['clock', 'Resume anywhere', 'Progress is saved; continue exactly where you stopped on any device.'],
            ['file', 'Clear records', 'Track what you started and completed; download completion records.'],
            ['lock', 'Privacy by design', 'Minimal data, EU-grade privacy controls, export or delete any time.'],
          ].map(([i, t, d]) => html`<div class="trust-item"><span class="ic">${icon(i, 20)}</span><div><h3>${t}</h3><p>${d}</p></div></div>`)}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="cta-band reveal" data-fx="zoom">
          <div>
            <span class="eyebrow">For CME providers & partners</span>
            <h2 style="margin-top:8px">Take your courses international — without re-recording.</h2>
            <p>License your existing video catalogue to MedTranslate. We translate, subtitle and dub with medical QC, and distribute worldwide under transparent revenue sharing. You keep your rights and your accreditation relationships.</p>
          </div>
          <div class="actions"><a href="/partners" class="btn btn-accent btn-lg magnetic">Partner With Us</a><a href="/partners#how" class="btn btn-glass btn-lg">How it works</a></div>
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="container grid-2" style="align-items:center;gap:56px">
        <div class="world reveal" data-fx="rise3d">
          <svg class="dots" viewBox="0 0 400 220" aria-hidden="true">${worldDots()}</svg>
          ${[[22, 30], [48, 26], [52, 44], [55, 62], [62, 70], [30, 60], [70, 38]].map(([x, y], i) => html`<span class="ping" style="left:${x}%;top:${y}%;animation-delay:${-i * 0.35}s"></span>`)}
          <div style="position:relative;max-width:300px"><span class="eyebrow">Availability</span><h3 style="color:#fff;font-size:1.5rem;margin-top:8px">Licensed territory by territory</h3>
          <p>Courses are offered in the countries and languages the licence covers. Your profile country determines what you can access.</p></div>
        </div>
        <div>
          <span class="eyebrow reveal">International availability</span>
          <h2 data-fx="words">Global access, local compliance</h2>
          <ul class="checklist light" data-stagger>
            <li>${icon('check', 18)}<span><b>Territory-aware licensing</b> — regional rights are enforced at playback, not just in the catalogue.</span></li>
            <li>${icon('check', 18)}<span><b>Multi-currency pricing</b> — EUR, USD and GBP with VAT shown up front.</span></li>
            <li>${icon('check', 18)}<span><b>GDPR-first infrastructure</b> — data minimisation, consent management and data export/deletion built in.</span></li>
            <li>${icon('check', 18)}<span><b>Accreditation by country</b> — credit status is shown per course and never extended by translation.</span></li>
          </ul>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container narrow">
        <div class="section-head center"><span class="eyebrow reveal">FAQ</span><h2 data-fx="words">Frequently asked questions</h2></div>
        <div class="reveal" data-fx="blur">${faqList(FAQ.slice(0, 6))}</div>
        <p class="center reveal" style="margin-top:24px"><a href="/faq">See all questions ${icon('arrow', 14)}</a></p>
      </div>
    </section>`;
  },
  mount(root) {
    get('/api/courses?featured=1').then(({ courses }) => {
      const host = $('#featured', root); if (!host) return;
      host.innerHTML = String(html`<div class="course-grid">${courses.slice(0, 3).map((c) => courseCard(c, state.meta.languages))}</div>`);
    }).catch(() => { const h = $('#featured', root); if (h) h.innerHTML = '<p class="muted">Courses could not be loaded.</p>'; });
    // Hero subtitle language cycle
    let i = 0;
    const sub = $('#tv-sub', root);
    const timer = setInterval(() => {
      if (!sub || document.hidden) return;
      i = (i + 1) % HERO_LINES.length;
      sub.classList.add('fade');
      setTimeout(() => {
        sub.innerHTML = `<span>${HERO_LINES[i][1].replace(/[<>&]/g, '')}</span>`;
        sub.dir = HERO_LINES[i][0] === 'AR' ? 'rtl' : 'ltr';
        sub.classList.remove('fade');
        root.querySelectorAll('.tv-lang').forEach((x) => x.classList.toggle('on', x.dataset.l === HERO_LINES[i][0]));
      }, 350);
    }, 3200);
    return () => clearInterval(timer);
  },
};

function worldDots() {
  // Abstract dotted globe band (decorative).
  let s = '';
  for (let y = 10; y < 220; y += 12) for (let x = 6; x < 400; x += 12) {
    const n = Math.sin(x * 0.045) * Math.cos(y * 0.06) + Math.sin((x + y) * 0.02);
    if (n > 0.35) s += `<circle cx="${x}" cy="${y}" r="1.6" fill="#67E8F9"/>`;
  }
  return raw(s);
}
