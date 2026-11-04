import { html, icon } from '../ui.js';

export default {
  title: 'About Us',
  render: () => html`
    <section class="page-head"><div class="container narrow"><span class="eyebrow">About us</span><h1>Infrastructure for multilingual medical education</h1>
      <p class="lead">We believe that where a clinician trained, or which language they speak, should not decide which expert teaching they can learn from.</p></div></section>
    <section class="section-sm"><div class="container narrow prose">
      <h2>Our mission</h2>
      <p>High-quality continuing medical education is produced every day by universities, specialist societies and education providers — but mostly in a handful of languages. MedTranslate partners with these providers to make their existing video courses accessible in many more languages, using AI for translation, subtitles and voice, and human experts for quality control.</p>
      <h2>What we stand for</h2>
      <div class="grid-2" style="margin-top:16px">
        ${[
          ['shield', 'Rights first', 'We only publish content whose rights holders have licensed it for translation and international distribution.'],
          ['award', 'Accuracy over hype', 'We label every AI output, document reviews and never invent accreditation or CME points.'],
          ['lock', 'Privacy by design', 'Minimal data collection, EU privacy standards and full user control over personal data.'],
          ['globe', 'Global, but local', 'Licences, accreditation and consumer law differ by country — our platform is built to respect that.'],
        ].map(([i, t, d]) => html`<div class="trust-item"><span class="ic">${icon(i, 20)}</span><div><h3>${t}</h3><p>${d}</p></div></div>`)}
      </div>
      <h2>Company</h2>
      <p>Company details are listed in the <a href="/legal/impressum">Impressum</a>. <span class="ph">[Founding story, team and advisory board to be added by the operator.]</span></p>
      <div class="row" style="margin-top:28px"><a class="btn btn-primary" href="/courses">Explore courses</a><a class="btn btn-ghost" href="/contact">Contact us</a></div>
    </div></section>`,
};
