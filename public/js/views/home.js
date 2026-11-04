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
    const upcoming = m.languages.filter((l) => !l.live);
    return html`
    <section class="hero">
      <div class="container hero-grid">
        <div class="reveal">
          <span class="pill"><span class="dot">NEW</span> AI subtitles & AI voice in ${live.length} languages</span>
          <h1>Medical knowledge<br><span class="grad-text">without language barriers.</span></h1>
          <p class="lead">Access high-quality medical education worldwide through AI-powered translation, subtitles and multilingual audio — from licensed providers, with transparent quality control.</p>
          <div class="hero-actions">
            <a href="/courses" class="btn btn-accent btn-lg">Explore Courses ${icon('arrow', 18)}</a>
            <a href="/technology" class="btn btn-glass btn-lg">Discover the Technology</a>
          </div>
          <div class="hero-stats">
            <div><b>${m.stats.courses}</b><span>demo courses</span></div>
            <div><b>${m.stats.languages}</b><span>languages live</span></div>
            <div><b>${m.stats.specialties}</b><span>specialties covered</span></div>
          </div>
        </div>
        <div class="reveal" style="position:relative">
          <div class="tv" aria-hidden="true">
            <div class="tv-screen">
              <img src="/media/posters/acs-early-ecg-recognition.jpg" alt="">
              <span class="tv-badge">${icon('sparkles', 13)} AI translation · live switch</span>
              <div class="tv-sub" id="tv-sub"><span>${HERO_LINES[0][1]}</span></div>
            </div>
            <div class="tv-bar">
              <span style="color:#fff">${icon('pause', 16)}</span>
              <div class="tv-progress"><i></i></div>
              <div class="tv-langs">${HERO_LINES.slice(0, 5).map(([c], i) => html`<span class="tv-lang ${i === 0 ? 'on' : ''}" data-l="${c}">${c}</span>`)}</div>
            </div>
          </div>
          <div class="float-card fc-1"><span class="ic">${icon('subtitles', 18)}</span><div><b>Subtitles synced</b><small>Medical terminology glossary</small></div></div>
          <div class="float-card fc-2"><span class="ic"><span class="wave-bars"><i></i><i></i><i></i><i></i><i></i></span></span><div><b>AI voice · Deutsch</b><small>Speaker-aware dubbing</small></div></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head reveal">
          <span class="eyebrow">The platform</span>
          <h2>Great medical education already exists. Language shouldn't lock it away.</h2>
          <p>MedTranslate licenses existing CME/CPD video courses and makes them accessible in many languages — the medical content stays exactly as the original faculty presented it. Only the language changes.</p>
        </div>
        <div class="grid-3">
          ${[
            ['shield', 'Licensed content only', 'Every course is published only after the rights to use, translate, subtitle, dub and distribute it are documented in our licence register.'],
            ['sparkles', 'AI translation, human control', 'AI drafts subtitles and audio with an enforced medical glossary. Translations are labelled and pass a documented quality-control step before release.'],
            ['award', 'Honest accreditation', 'We show the real CME/CPD status of every course. A translation never implies credits in another country — and we never invent points.'],
          ].map(([i, t, d]) => html`<div class="feature reveal"><div class="ic">${icon(i, 22)}</div><h3>${t}</h3><p>${d}</p></div>`)}
        </div>
      </div>
    </section>

    <section class="section dark">
      <div class="container">
        <div class="section-head reveal">
          <span class="eyebrow">How AI translation works</span>
          <h2>From one lecture to a global classroom</h2>
          <p>A transparent pipeline where every step is logged and every language is released individually.</p>
        </div>
        <div class="pipeline reveal">
          <div class="pipe"><h3>Licensed source</h3><p>Original video and transcript from the provider, with rights verified.</p></div>
          <div class="pipe"><h3>Medical AI translation</h3><p>Cue-by-cue translation with glossary-enforced terminology and timing constraints.</p></div>
          <div class="pipe"><h3>Speaker-aware voice</h3><p>AI audio per language, with distinct voices for each speaker, time-fitted to the original.</p></div>
          <div class="pipe"><h3>Medical QC</h3><p>Qualified reviewers check terminology, meaning and sync. Decisions are documented.</p></div>
          <div class="pipe"><h3>Release & stream</h3><p>Only approved, licensed languages go live — switchable instantly in the player.</p></div>
        </div>
        <div class="row reveal" style="margin-top:36px"><a href="/technology" class="btn btn-glass">Read about the technology ${icon('arrow', 16)}</a></div>
      </div>
    </section>

    <section class="section">
      <div class="container center">
        <div class="section-head center reveal">
          <span class="eyebrow">Languages</span>
          <h2>Switch language mid-lecture. No reload.</h2>
          <p>Choose subtitles and AI audio independently. Languages appear per course only when the translation is released and licensed.</p>
        </div>
        <div class="lang-cloud reveal">
          ${live.map((l) => html`<span class="lang-pill live" title="Available now"><span class="live-dot"></span>${l.native} <small>${l.name}</small></span>`)}
          ${upcoming.map((l) => html`<span class="lang-pill" title="Planned"><span class="soon-dot"></span>${l.native} <small>planned</small></span>`)}
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="container">
        <div class="row between reveal" style="margin-bottom:32px;align-items:flex-end">
          <div class="section-head" style="margin:0"><span class="eyebrow">Course preview</span><h2>Featured courses</h2><p>Sample courses to explore the player and language switching.</p></div>
          <a href="/courses" class="btn btn-ghost">All courses ${icon('arrow', 16)}</a>
        </div>
        <div id="featured">${skeletonCards(3)}</div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="row between reveal" style="margin-bottom:32px;align-items:flex-end">
          <div class="section-head" style="margin:0"><span class="eyebrow">Medical specialties</span><h2>Learn across the full breadth of medicine</h2></div>
          <a href="/specialties" class="btn btn-ghost">All specialties ${icon('arrow', 16)}</a>
        </div>
        <div class="spec-grid reveal">
          ${m.specialties.map((s) => html`<a class="spec" href="/specialties/${s.slug}"><span class="ic">${specIcon(s.icon)}</span><span><b>${s.name}</b><small>${s.course_count ? `${s.course_count} course${s.course_count > 1 ? 's' : ''}` : 'Coming soon'}</small></span></a>`)}
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="container grid-2" style="align-items:center;gap:56px">
        <div class="reveal">
          <span class="eyebrow">For physicians & healthcare professionals</span>
          <h2>Built around how clinicians actually learn</h2>
          <p class="lead">Short, focused modules from respected providers — in the language you think in.</p>
          <a href="/register" class="btn btn-primary" style="margin-top:12px">Create a free account</a>
        </div>
        <div class="grid-2 reveal">
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
        <div class="cta-band reveal">
          <div>
            <span class="eyebrow">For CME providers & partners</span>
            <h2 style="margin-top:8px">Take your courses international — without re-recording.</h2>
            <p>License your existing video catalogue to MedTranslate. We translate, subtitle and dub with medical QC, and distribute worldwide under transparent revenue sharing. You keep your rights and your accreditation relationships.</p>
          </div>
          <div class="actions"><a href="/partners" class="btn btn-accent btn-lg">Partner With Us</a><a href="/partners#how" class="btn btn-glass btn-lg">How it works</a></div>
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="container grid-2" style="align-items:center;gap:56px">
        <div class="world reveal">
          <svg class="dots" viewBox="0 0 400 220" aria-hidden="true">${worldDots()}</svg>
          ${[[22, 30], [48, 26], [52, 44], [70, 38], [80, 64], [30, 60], [60, 70]].map(([x, y], i) => html`<span class="ping" style="left:${x}%;top:${y}%;animation-delay:${-i * 0.35}s"></span>`)}
          <div style="position:relative;max-width:300px"><span class="eyebrow">Availability</span><h3 style="color:#fff;font-size:1.5rem;margin-top:8px">Licensed territory by territory</h3>
          <p>Courses are offered in the countries and languages the licence covers. Your profile country determines what you can access.</p></div>
        </div>
        <div class="reveal">
          <span class="eyebrow">International availability</span>
          <h2>Global access, local compliance</h2>
          <ul class="checklist light">
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
        <div class="section-head center reveal"><span class="eyebrow">FAQ</span><h2>Frequently asked questions</h2></div>
        <div class="reveal">${faqList(FAQ.slice(0, 6))}</div>
        <p class="center" style="margin-top:24px"><a href="/faq">See all questions ${icon('arrow', 14)}</a></p>
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
