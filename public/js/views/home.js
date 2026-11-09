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
  description: 'Emergency medicine education in every language: licensed courses with AI subtitles and AI voice, for teams who cannot wait for a translation.',
  async render() {
    const m = state.meta;
    const focus = m.focus;
    const topics = (m.topics || []).filter((t) => t.course_count);
    const live = m.languages.filter((l) => l.live);
    const africa = m.languages.filter((l) => l.region === 'africa');
    const row = (list) => html`${[...list, ...list].map((l) => html`<span class="lang-pill ${l.live ? 'live' : ''}" aria-hidden="true">${l.live ? html`<span class="live-dot"></span>` : html`<span class="soon-dot"></span>`}${l.native} <small>${l.name}</small></span>`)}`;
    return html`
    <section class="hero" data-fx-scroll="hero">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="container hero-grid">
        <div class="hero-copy">
          <span class="pill reveal" data-fx="drop"><span class="dot">${focus ? focus.name.toUpperCase() : 'NEW'}</span> Launch focus · live AI subtitles in any language</span>
          <h1 data-fx="words">${focus ? 'Emergency medicine' : 'Medical knowledge'}<br><span class="grad-text">without language barriers.</span></h1>
          <p class="lead reveal" data-fx="blur" style="--d:.35s">${focus ? 'When minutes count, language should not. Licensed emergency medicine education with AI subtitles and voice in the language your team speaks.' : 'Access high-quality medical education worldwide through AI-powered translation, subtitles and multilingual audio — from licensed providers, with transparent quality control.'}</p>
          <div class="hero-actions reveal" style="--d:.5s">
            <a href="/courses" class="btn btn-accent btn-lg magnetic">Explore Courses ${icon('arrow', 18)}</a>
            <a href="/technology" class="btn btn-glass btn-lg">Discover the Technology</a>
          </div>
          <div class="hero-stats reveal" style="--d:.65s">
            <div><b data-count="${m.stats.courses}">0</b><span>${focus ? 'emergency courses' : 'demo courses'}</span></div>
            <div><b data-count="${m.stats.languages}">0</b><span>languages ready to play</span></div>
            <div><b data-count="${m.languages.length}">0</b><span>languages via live AI</span></div>
          </div>
        </div>
        <div class="hero-visual reveal" data-fx="rise3d">
          <div class="globe-wrap"><canvas id="hero-globe" role="img" aria-label="Globe with connections from Europe to Africa, the Americas and Asia"></canvas></div>
          <div class="tv tv-mini" aria-hidden="true">
            <div class="tv-screen">
              <img src="/media/posters/acs-early-ecg-recognition.jpg" alt="">
              <span class="tv-badge">${icon('sparkles', 13)} AI translation · live switch</span>
              <div class="tv-sub" id="tv-sub"><span>${HERO_LINES[0][1]}</span></div>
              <div class="tv-scan"></div>
            </div>
            <div class="tv-bar">
              <span style="color:#fff">${icon('pause', 16)}</span>
              <div class="tv-progress"><i></i></div>
              <div class="tv-langs">${HERO_LINES.slice(0, 5).map(([c], i) => html`<span class="tv-lang ${i === 0 ? 'on' : ''}" data-l="${c}">${c}</span>`)}</div>
            </div>
          </div>
          <div class="float-card fc-2"><span class="ic"><span class="wave-bars"><i></i><i></i><i></i><i></i><i></i></span></span><div><b>AI voice · Kiswahili</b><small>Time-synchronised dubbing</small></div></div>
        </div>
      </div>
      <a href="#platform" class="scroll-cue" aria-label="Scroll down"><span></span></a>
    </section>

    ${focus ? html`<section class="section why" id="why">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow reveal">Why emergency medicine first</span>
          <h2 data-fx="words">When time is the treatment, language is a delay.</h2>
          <p class="reveal" data-fx="blur">We start where a misunderstood sentence costs the most, and where the teaching travels best across borders.</p>
        </div>
        <div class="stack" data-fx-scroll="stack">
          ${[
            ['01', 'clock', 'Minutes matter', 'Recognition and first-hour care decide outcomes in stroke, sepsis, cardiac and airway emergencies. Teams need to understand the lesson the first time.', '#FB7185', 'ring'],
            ['02', 'globe', 'Protocols travel', 'Emergency pathways are built on shared evidence and checklists, so a well-translated lesson is useful in Nairobi, Lima and Berlin alike.', '#22D3EE', 'orbit'],
            ['03', 'layers', 'Short and focused', 'Compact modules fit between shifts and are quick to translate, review and release one language at a time.', '#FBBF24', 'bars'],
          ].map(([n, i, t, d, ac, art], k) => html`<article class="stack-card" style="--i:${k};--ac:${ac}">
            <div class="sc-copy"><span class="sc-num">${n}</span><div class="ic">${icon(i, 24)}</div><h3>${t}</h3><p>${d}</p></div>
            <div class="sc-art" aria-hidden="true" data-parallax="0.06">${art === 'ring'
              ? html`<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="78" class="r0"/><circle cx="100" cy="100" r="78" class="r1" pathLength="100"/><path d="M100 54v48l30 18" class="hand"/></svg>`
              : art === 'orbit'
                ? html`<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="30" class="r1"/><ellipse cx="100" cy="100" rx="86" ry="34" class="r0"/><ellipse cx="100" cy="100" rx="86" ry="34" class="r0" transform="rotate(60 100 100)"/><ellipse cx="100" cy="100" rx="86" ry="34" class="r0" transform="rotate(120 100 100)"/><circle cx="186" cy="100" r="6" class="dot"/><circle cx="57" cy="25" r="6" class="dot"/><circle cx="57" cy="175" r="6" class="dot"/></svg>`
                : html`<svg viewBox="0 0 200 200"><rect x="30" y="118" width="26" height="54" rx="7" class="bar"/><rect x="66" y="92" width="26" height="80" rx="7" class="bar"/><rect x="102" y="62" width="26" height="110" rx="7" class="bar"/><rect x="138" y="34" width="26" height="138" rx="7" class="bar hi"/></svg>`}</div>
          </article>`)}
        </div>
      </div>
    </section>

    <section class="section pulse" id="evidence" data-fx-scroll="draw">
      <svg class="pulse-line" viewBox="0 0 1200 160" preserveAspectRatio="none" aria-hidden="true"><path pathLength="100" d="M0 90 H300 l14 -6 l14 6 H420 l10 12 l16 -86 l18 120 l12 -46 H640 q28 -42 56 0 H1200"/></svg>
      <div class="container">
        <div class="section-head center">
          <span class="eyebrow reveal">The scale of the problem</span>
          <h2 data-fx="words">Minutes and misread signs decide who goes home.</h2>
          <p class="reveal" data-fx="blur">Missed or late recognition is not a rare accident. Published studies put numbers on it.</p>
        </div>
        <div class="evi-grid" data-stagger>
          ${[
            ['1.9', 1.9, 1, ' M', 'million neurons lost every minute', 'An untreated large-vessel stroke can destroy about 1.9 million neurons per minute. Faster recognition means more brain saved.', 'Saver JL. Time is brain – quantified. Stroke 2006;37:263–266.', '#A78BFA'],
            ['7.6', 7.6, 1, ' %', 'less survival per hour of delay', 'In septic shock, each hour of delay in starting effective antimicrobial treatment was linked to an average 7.6 % lower survival.', 'Kumar A et al. Crit Care Med 2006;34:1589–1596.', '#FBBF24'],
            ['795', 795, 0, ',000', 'harmed by diagnostic error – every year', 'A US estimate of people who die or are permanently disabled each year because of diagnostic error across care settings.', 'Newman-Toker DE et al. BMJ Qual Saf 2024;33:109–120.', '#FB7185'],
          ].map(([txt, v, dec, suf, cap, body, src, ac]) => html`<article class="evi-card" style="--ac:${ac}">
            <div class="evi-num"><span data-count="${v}" data-dec="${dec}" data-suffix="${suf}">${txt}${suf}</span></div>
            <h3>${cap}</h3><p>${body}</p><small>${src}</small></article>`)}
        </div>
        <h3 class="cases-h reveal">Public cases that changed practice</h3>
        <div class="cases" data-stagger>
          ${[
            ['2012 · USA', 'Rory Staunton, 12', 'Sepsis missed in the emergency department', 'Rory died of sepsis a few days after being sent home from an emergency department. According to public reports, abnormal blood results were not acted on in time. His family’s campaign led to “Rory’s Regulations” in New York State (2013), which require hospitals to follow sepsis protocols.', '#FBBF24'],
            ['2005 · UK', 'Elaine Bromiley, 37', 'A failed airway during a routine operation', 'Elaine died after the team could not secure her airway during a routine operation. The independent review pointed to human factors such as task fixation and communication under stress. Her husband, an airline pilot, founded the Clinical Human Factors Group, which has shaped airway-emergency training and checklists since.', '#38BDF8'],
            ['1984 · USA', 'Libby Zion, 18', 'Hours after arriving at a hospital', 'Libby died within hours of being admitted through the emergency department of a New York hospital. The cause is still debated, but the case triggered a state inquiry (the Bell Commission) and a lasting reform of supervision and working hours for junior doctors.', '#FB7185'],
          ].map(([meta, who, what, body, ac]) => html`<article class="case-card" style="--ac:${ac}">
            <span class="cc-meta">${meta}</span><h4>${who}</h4><b>${what}</b><p>${body}</p></article>`)}
        </div>
        <p class="cases-line reveal">These are not isolated tragedies. They are the cases that became public because families and clinicians insisted that something must change.</p>
        <p class="evi-note reveal">${icon('info', 14)} Published estimates, mostly from high-income health systems: they show the scale of the problem, not a forecast for any single clinic. Case summaries are based on public reports; their wording is pending editorial and legal review before launch.</p>
      </div>
    </section>` : ''}

    <section class="section curtain" id="platform" data-fx-scroll="curtain">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow reveal">The platform</span>
          <h2 data-fx="words">${focus ? 'Great emergency teaching already exists. Language shouldn\'t lock it away.' : 'Great medical education already exists. Language shouldn\'t lock it away.'}</h2>
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

    <section class="story" id="how">
      <div class="container">
        <div class="section-head">
          <span class="eyebrow reveal">How AI translation works</span>
          <h2 data-fx="words">From one lecture to a global classroom</h2>
          <p class="reveal" data-fx="blur">Scroll through the pipeline. Every step is logged, and every language is released on its own.</p>
        </div>
        <div class="story-grid">
          <ol class="story-steps">
            ${[
              ['Licensed source', 'The provider’s original video and its time-coded transcript are the single source of truth. Rights are checked before anything else happens.', 'file'],
              ['Medical AI translation', 'Each sentence is translated in context, with a medical glossary enforcing terminology. Numbers, doses and thresholds are never changed.', 'sparkles'],
              ['Speaker-aware AI voice', 'Every language gets its own voice track: a distinct voice per speaker, each sentence fitted into its original time slot.', 'wave'],
              ['Medical quality control', 'A qualified reviewer checks terminology, meaning and timing side by side with the original, and the decision is documented.', 'shield'],
              ['Release — or live, on demand', 'Approved languages go live instantly. Any other language can be translated live while the lecture plays.', 'zap'],
            ].map(([t, d, ic], k) => html`<li class="story-step" data-step="${k}"><span class="sn">${String(k + 1).padStart(2, '0')}</span><div><h3>${icon(ic, 18)} ${t}</h3><p>${d}</p></div></li>`)}
          </ol>
          <div class="story-visual" aria-hidden="true">
            <div class="sv-frame" data-active="0">
              <div class="sv-screen">
                <img src="/media/posters/stroke-first-60-minutes.jpg" alt="">
                <div class="sv-layer l0"><div class="sv-lines">
                  <span>Start by establishing the exact time</span><span>the patient was last known well.</span><span class="dim">Check capillary glucose immediately…</span></div>
                  <span class="sv-chip">${icon('file', 13)} Transcript · English</span></div>
                <div class="sv-layer l1"><div class="sv-tx">
                  ${[['DE', 'Ermitteln Sie zuerst den genauen Zeitpunkt …'], ['SW', 'Anza kwa kubaini muda kamili …'], ['FR', 'Commencez par établir l’heure exacte …'], ['AR', 'ابدأ بتحديد الوقت الدقيق …'], ['QU', 'Qallariy yachaspa hayk’aqmi …']].map(([c, t], i) => html`<span style="--i:${i}"><b>${c}</b>${t}</span>`)}
                </div><span class="sv-chip">${icon('sparkles', 13)} Glossary · STEMI, hs-troponin, LVO</span></div>
                <div class="sv-layer l2"><div class="sv-wave">${Array.from({ length: 36 }, (_, i) => html`<i style="--i:${i}"></i>`)}</div>
                  <div class="sv-speakers"><span>${icon('user', 13)} Host · voice A</span><span>${icon('user', 13)} Expert · voice B</span></div></div>
                <div class="sv-layer l3"><ul class="sv-checks">
                  ${['Terminology matches glossary', 'Meaning, numbers and doses preserved', 'Readable and in sync'].map((t, i) => html`<li style="--i:${i}">${icon('check', 15)} ${t}</li>`)}
                </ul><span class="sv-stamp">Approved · reviewer</span></div>
                <div class="sv-layer l4"><div class="sv-langs">
                  ${['English', 'Deutsch', 'Kiswahili', 'Français', 'العربية', 'Español', 'አማርኛ', 'Runa Simi', 'हिन्दी', '中文', 'Yorùbá', 'Kreyòl'].map((t, i) => html`<span style="--i:${i}" class="${i > 9 ? 'live' : ''}">${t}${i > 9 ? html` <b>LIVE</b>` : ''}</span>`)}
                </div></div>
              </div>
              <div class="sv-dots">${[0, 1, 2, 3, 4].map((k) => html`<i data-dot="${k}"></i>`)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section languages-band curtain" data-fx-scroll="curtain">
      <div class="container center">
        <div class="section-head center">
          <span class="eyebrow reveal">Languages</span>
          <h2 data-fx="words">Switch language mid-lecture. No reload.</h2>
          <p class="reveal" data-fx="blur">Pick one language and both subtitles and voice follow. Ready languages play instantly; every other language below is translated live while you watch.</p>
        </div>
      </div>
      <div class="marquee reveal" data-fx="blur"><div class="marquee-track">${row(m.languages.filter((l) => l.region === 'europe' || l.region === 'asia'))}</div></div>
      <div class="marquee reverse reveal" data-fx="blur"><div class="marquee-track">${row(m.languages.filter((l) => l.region === 'africa' || l.region === 'americas' || l.region === 'mena'))}</div></div>
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
            <li>${icon('wave', 18)}<span><b>AI voice tracks</b> — the free Stroke course already speaks Kiswahili, Amharic, Afrikaans, Afaan Oromoo, Setswana and Tigrinya, plus French, Arabic and Portuguese.</span></li>
            <li>${icon('download', 18)}<span><b>Made for slow connections</b> — subtitles need about 1 KB per minute; switch to audio-only or subtitles when bandwidth is short.</span></li>
          </ul>
          <a class="btn btn-accent btn-lg magnetic reveal" style="margin-top:12px" href="/courses/stroke-first-60-minutes">Try Kiswahili in the player ${icon('play', 16)}</a>
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

    <section class="section picker-sec">
      <div class="container">
        <div class="row between" style="margin-bottom:28px;align-items:flex-end">
          <div class="section-head" style="margin:0"><span class="eyebrow reveal">${focus ? 'Emergency medicine' : 'Medical specialties'}</span><h2 data-fx="words">${focus ? 'Pick the emergency your team faces' : 'Learn across the full breadth of medicine'}</h2></div>
          <a href="${focus ? '/topics' : '/specialties'}" class="btn btn-ghost reveal">${focus ? 'All topics' : 'All specialties'} ${icon('arrow', 16)}</a>
        </div>
        <div class="picker" data-stagger>
          ${(focus ? topics : m.specialties).map((s) => html`<a class="pick-tile" href="/${focus ? 'topics' : 'specialties'}/${s.slug}" style="--ac:${s.accent || '#22D3EE'}">
            <span class="pk-ic">${icon(s.icon || 'stethoscope', 28)}</span>
            <b>${s.name}</b>
            <small>${s.course_count ? `${s.course_count} course${s.course_count > 1 ? 's' : ''}` : 'Coming soon'}</small>
            <span class="pk-go">${icon('arrow', 16)}</span></a>`)}
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
    // Scroll story: the step nearest the middle of the screen drives the sticky visual.
    const frame = root.querySelector('.sv-frame');
    const steps = [...root.querySelectorAll('.story-step')];
    const storyIo = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) {
        const k = e.target.dataset.step;
        frame?.setAttribute('data-active', k);
        steps.forEach((s2) => s2.classList.toggle('active', s2.dataset.step === k));
      }
    }, { rootMargin: '-45% 0px -45% 0px' }) : null;
    steps.forEach((s2) => storyIo?.observe(s2));
    if (steps[0]) steps[0].classList.add('active');
    get('/api/courses?featured=1').then(({ courses }) => {
      const host = $('#featured', root); if (!host) return;
      host.innerHTML = String(html`<div class="course-grid">${courses.slice(0, 3).map((c) => courseCard(c, state.meta.languages))}</div>`);
    }).catch(() => { const h = $('#featured', root); if (h) h.innerHTML = '<p class="muted">Courses could not be loaded.</p>'; });
    let globe = null;
    import('../globe.js').then(({ createGlobe }) => { const c = $('#hero-globe', root); if (c) globe = createGlobe(c, { size: 0.43 }); });
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
    return () => { clearInterval(timer); storyIo?.disconnect(); globe?.destroy(); };
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
