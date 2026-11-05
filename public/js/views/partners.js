import { html, icon, formData, setBusy, formError } from '../ui.js';
import { state } from '../store.js';
import { post } from '../api.js';

export default {
  title: 'Partner With Us',
  description: 'License your CME courses for AI translation, subtitles, dubbing and international distribution.',
  render(ctx) {
    const m = state.meta;
    return html`
    <section class="hero" style="padding-bottom:80px">
      <div class="container hero-grid">
        <div>
          <span class="eyebrow">Partner With Us</span>
          <h1 style="margin-top:12px">Your courses. <span class="grad-text">Every language.</span></h1>
          <p class="lead">Medical education providers, universities and specialist societies: make your existing video courses accessible to clinicians worldwide — without re-recording a single lecture. We are building our first catalogue in <b>emergency medicine</b>.</p>
          <div class="hero-actions"><a href="#inquiry" class="btn btn-accent btn-lg">Start a conversation</a><a href="#how" class="btn btn-glass btn-lg">How it works</a></div>
        </div>
        <div class="grid-2" style="gap:14px">
          ${[['1 video', 'becomes many language versions'], ['QC', 'documented medical review'], ['0', 're-recording needed'], ['100%', 'transparent reporting']].map(([a, b]) => html`<div class="feature" style="padding:22px"><b style="font-size:1.8rem;color:#fff;letter-spacing:-.03em">${a}</b><p>${b}</p></div>`)}
        </div>
      </div>
    </section>

    <section class="section" id="how">
      <div class="container">
        <div class="section-head"><span class="eyebrow">Cooperation models</span><h2>Flexible ways to work together</h2></div>
        <div class="grid-3">
          ${[
            ['file', 'Licensing of existing CME videos', 'Grant us a defined licence (territories, languages, term). We handle hosting, delivery and customer service.'],
            ['sparkles', 'AI-assisted translation', 'Glossary-driven translation of your transcripts, with your own experts optionally acting as reviewers.'],
            ['subtitles', 'Multilingual subtitles', 'Time-synchronised subtitles in many languages, exportable as WebVTT for your own platform.'],
            ['wave', 'AI audio dubbing', 'Speaker-aware AI voices in the target language, synchronised with your original video.'],
            ['globe', 'International distribution', 'Reach clinicians in new markets via our subscription catalogue and institutional licences.'],
            ['chart', 'Revenue sharing', 'Transparent, contract-based revenue share with usage reporting per course, language and country.'],
            ['layers', 'Technical integration', 'Embed translated tracks into your existing LMS or platform via API and standard formats.'],
            ['award', 'Accreditation support', 'We help you understand where accreditation for translated versions may be possible — the decision always rests with the accrediting body.'],
            ['shield', 'Rights & compliance', 'Licence register, territory enforcement, takedown process and audit trail built into the platform.'],
          ].map(([i, t, d]) => html`<div class="feature"><div class="ic">${icon(i, 22)}</div><h3>${t}</h3><p>${d}</p></div>`)}
        </div>
      </div>
    </section>

    <section class="section alt">
      <div class="container grid-2" style="gap:48px;align-items:start">
        <div>
          <span class="eyebrow">Process</span><h2>From first call to first launch</h2>
          <div class="stack" style="margin-top:24px">
            ${[['Discovery', 'We review your catalogue, target markets and accreditation landscape together.'], ['Licence agreement', 'We document exactly which rights you grant — usage, translation, subtitles, AI audio, commercial use, territories, term.'],
              ['Pilot', 'Selected courses are translated, reviewed and released in a first set of languages.'], ['Scale & report', 'More languages and courses, with regular reporting and revenue share.']]
              .map(([t, d], i) => html`<div class="step"><span class="step-n">${i + 1}</span><div><h3 style="font-size:1.05rem;margin-bottom:4px">${t}</h3><p class="muted" style="margin:0">${d}</p></div></div>`)}
          </div>
          <div class="notice" style="margin-top:28px">${icon('info', 18)}<span>We never publish content without a signed licence that covers translation and distribution. Existing accreditation of your courses is not transferred to translated versions automatically.</span></div>
        </div>
        <form class="panel" id="inquiry" novalidate>
          <h2 class="h3" style="font-size:1.25rem">Partner inquiry</h2>
          <p class="small muted">Tell us about your organisation — we'll respond within a few working days.</p>
          <div class="form-grid">
            <label class="field full"><span>Organisation</span><input name="organisation" required maxlength="200" autocomplete="organization"></label>
            <label class="field"><span>Contact name</span><input name="contactName" required maxlength="120" autocomplete="name"></label>
            <label class="field"><span>Work e-mail</span><input name="email" type="email" required autocomplete="email"></label>
            <label class="field"><span>Organisation type</span><select name="orgType">
              ${['CME provider', 'University / medical school', 'Specialist society', 'Hospital / clinic group', 'Publisher', 'Other'].map((t) => html`<option ${ctx.query.type === 'institution' && t.startsWith('Hospital') ? 'selected' : ''}>${t}</option>`)}</select></label>
            <label class="field"><span>Country</span><select name="country"><option value="">—</option>${m.countries.map((c) => html`<option value="${c.code}">${c.name}</option>`)}</select></label>
            <label class="field"><span>Catalogue size</span><select name="catalogueSize"><option>1–10 courses</option><option>11–50 courses</option><option>51–200 courses</option><option>200+ courses</option></select></label>
            <label class="field"><span>Target languages <small>(optional)</small></span><input name="targetLanguages" placeholder="e.g. Spanish, Arabic, Japanese"></label>
            <div class="field full"><span class="field-label">Interested in</span>
              ${['Licensing', 'AI translation', 'Subtitles', 'AI audio', 'Distribution', 'Revenue share', 'Technical integration', 'Institutional licence'].map((x) => html`<label class="check" style="display:inline-flex;margin-right:14px"><input type="checkbox" name="interests" value="${x}"> <span>${x}</span></label>`)}
            </div>
            <label class="field full"><span>Message</span><textarea name="message" maxlength="4000" rows="4" placeholder="Tell us about your content, rights situation and goals."></textarea></label>
          </div>
          <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <label class="check"><input type="checkbox" name="privacyAccepted" required> <span>I have read the <a href="/legal/datenschutz" target="_blank">privacy policy</a> and agree to be contacted about this inquiry.</span></label>
          <button class="btn btn-primary btn-block" type="submit">Send inquiry</button>
        </form>
      </div>
    </section>`;
  },
  mount(root) {
    const form = root.querySelector('#inquiry');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formError(form, '');
      const btn = form.querySelector('[type=submit]');
      setBusy(btn, true, 'Sending…');
      try {
        await post('/api/partners/inquiry', formData(form));
        form.innerHTML = String(html`<div class="center" style="padding:24px 0"><div class="empty-icon" style="background:var(--ok-bg);color:var(--ok)">${icon('check', 26)}</div><h3>Thank you!</h3><p class="muted">We have received your inquiry and will be in touch shortly.</p></div>`);
      } catch (err) { formError(form, err.message); setBusy(btn, false); }
    });
  },
};
