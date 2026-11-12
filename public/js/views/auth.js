import { html, icon, formData, setBusy, formError, toast } from '../ui.js';
import { state, emit } from '../store.js';
import { post } from '../api.js';

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/account');

// "Welcome" in the launch languages (rotates on the side panel).
const GREET = [['Welcome', 'English'], ['Karibu', 'Kiswahili'], ['Barka da zuwa', 'Hausa'], ['Ẹ káàbọ̀', 'Yorùbá'], ['Nnọọ', 'Igbo'],
  ['Bienvenue', 'Français'], ['أهلاً وسهلاً', 'العربية'], ['Bem-vindo', 'Português'], ['Bienvenido', 'Español'], ['Willkommen', 'Deutsch']];
// One sentence from the free demo course, as released in the sample translations.
const SUBS = [
  ['EN', 'Check capillary glucose immediately, because hypoglycaemia can mimic a stroke.'],
  ['SW', 'Pima sukari ya damu ya kidole mara moja, kwa sababu sukari ya chini inaweza kuiga kiharusi.'],
  ['DE', 'Bestimmen Sie sofort den Kapillarblutzucker, denn eine Hypoglykämie kann einen Schlaganfall imitieren.'],
];

function side(isRegister) {
  return html`<aside class="auth-side" aria-hidden="true">
    <div class="as-grid"></div><div class="as-glow"></div>
    <div class="as-top"><span class="as-live"><i></i> Live · emergency medicine</span></div>
    <div class="as-center">
      <div class="as-greet"><span class="as-word" id="as-word">${GREET[0][0]}</span><span class="as-lang" id="as-lang">${GREET[0][1]}</span></div>
      <h2>${isRegister ? 'Join the clinicians learning emergency medicine in their own language.' : 'Pick up where you left off — in your language.'}</h2>
      <div class="as-player">
        <div class="as-screen">
          <svg class="as-ecg" viewBox="0 0 400 90" preserveAspectRatio="none"><path pathLength="100" d="M0 50 H90 l10 -6 l10 6 H160 l8 10 l12 -52 l14 74 l9 -32 H250 q20 -26 40 0 H400"/></svg>
          <div class="as-sub"><b id="as-code">${SUBS[0][0]}</b><span id="as-text">${SUBS[0][1]}</span></div>
        </div>
        <div class="as-bar"><span class="as-play">${icon('play', 12)}</span><span class="as-track"><i></i></span><span class="as-chips">${SUBS.map(([c], i) => html`<em class="${i === 0 ? 'on' : ''}" data-c="${c}">${c}</em>`)}</span></div>
      </div>
    </div>
    <ul class="as-facts">
      <li>${icon('globe', 16)}<span><b>11</b> languages · Nigeria &amp; Kenya first</span></li>
      <li>${icon('shield', 16)}<span>Licensed courses, transparent AI labels</span></li>
      <li>${icon('lock', 16)}<span>Privacy by design · export or delete anytime</span></li>
    </ul>
  </aside>`;
}

const pwField = (auto, label = 'Password', hint = '') => html`<label class="field fx-field"><span>${label}${hint ? html` <small>${hint}</small>` : ''}</span>
  <span class="input-ic">${icon('lock', 17)}<input name="password" type="password" required ${auto === 'new-password' ? 'minlength="10"' : ''} autocomplete="${auto}">
  <button type="button" class="pw-eye" data-pw aria-label="Show password">${icon('eye', 17)}</button></span>
  ${auto === 'new-password' ? html`<span class="pw-meter" aria-live="polite"><span class="pw-bars"><i></i><i></i><i></i><i></i></span><small id="pw-label">At least 10 characters with letters and numbers</small></span>` : ''}</label>`;

export default function authView(ctx) {
  const isRegister = ctx.path === '/register';
  let timer = null;
  return {
    title: isRegister ? 'Create account' : 'Sign in',
    render(c) {
      if (state.user) { const n = safeNext(c.query.next); setTimeout(() => c.navigate(n, { replace: true })); return html``; }
      const m = state.meta;
      const next = c.query.next || '';
      const nq = next ? `?next=${encodeURIComponent(next)}` : '';
      if (!isRegister) {
        return html`<div class="auth-wrap">${side(false)}<div class="auth-main"><div class="auth-card">
          <div class="ac-badge">${icon('pulse', 20)}</div>
          <h1>Welcome back</h1><p class="muted">Sign in to continue learning.</p>
          <form id="auth" novalidate style="margin-top:24px">
            <label class="field fx-field"><span>E-mail</span><span class="input-ic">${icon('mail', 17)}<input name="email" type="email" required autocomplete="email" autofocus></span></label>
            ${pwField('current-password')}
            <button class="btn btn-primary btn-block btn-lg" type="submit">Sign in ${icon('arrow', 17)}</button>
          </form>
          <div class="ac-sep"><span>New to MedTranslate?</span></div>
          <a class="btn btn-ghost btn-block" href="/register${nq}">Create a free account</a>
          <p class="xs muted center" style="margin-top:16px">Forgot your password? Password reset by e-mail requires a configured mail service — please <a href="/contact">contact support</a>.</p>
        </div></div></div>`;
      }
      const launch = (m.launch?.countries || []).map((x) => x.code);
      const others = m.countries.filter((x) => !launch.includes(x.code));
      const browserLang = (navigator.language || 'en').slice(0, 2);
      return html`<div class="auth-wrap">${side(true)}<div class="auth-main"><div class="auth-card wide">
        <div class="ac-badge">${icon('stethoscope', 20)}</div>
        <h1>Create your account</h1><p class="muted">Free to join. Choose a plan only when you need it.</p>
        <ol class="reg-steps" aria-label="Registration steps"><li class="on" data-step-dot="1"><b>1</b> Account</li><li data-step-dot="2"><b>2</b> Your practice</li></ol>
        <form id="auth" novalidate>
          <div class="step-track"><div class="step-slide">
            <fieldset class="reg-step" data-step="1">
              <div class="form-grid">
                <label class="field fx-field"><span>First name</span><span class="input-ic">${icon('user', 17)}<input name="firstName" type="text" required maxlength="80" autocomplete="given-name"></span></label>
                <label class="field fx-field"><span>Last name</span><input name="lastName" type="text" required maxlength="80" autocomplete="family-name"></label>
                <label class="field fx-field full"><span>E-mail</span><span class="input-ic">${icon('mail', 17)}<input name="email" type="email" required autocomplete="email"></span></label>
                <div class="full">${pwField('new-password', 'Password')}</div>
              </div>
              <button class="btn btn-primary btn-block btn-lg" type="button" data-next>Continue ${icon('arrow', 17)}</button>
            </fieldset>
            <fieldset class="reg-step" data-step="2">
              <label class="field fx-field"><span>Country</span><span class="input-ic">${icon('globe', 17)}<select name="country" required><option value="">Select…</option>
                ${launch.length ? html`<optgroup label="Launch countries">${m.countries.filter((x) => launch.includes(x.code)).map((x) => html`<option value="${x.code}">${x.name}</option>`)}</optgroup><optgroup label="All countries">${others.map((x) => html`<option value="${x.code}">${x.name}</option>`)}</optgroup>`
                  : m.countries.map((x) => html`<option value="${x.code}">${x.name}</option>`)}</select></span></label>
              <div class="field"><span>Preferred language <small>(subtitles, voice and website)</small></span>
                <div class="chips" role="radiogroup" aria-label="Preferred language">${m.languages.map((l) => html`<label class="chip-r"><input type="radio" name="preferredLanguage" value="${l.code}" ${l.code === (m.languages.some((x) => x.code === browserLang) ? browserLang : 'en') ? 'checked' : ''}><span>${l.native}</span></label>`)}</div></div>
              <div class="field"><span>Profession <small>(optional)</small></span>
                <div class="chips" role="radiogroup" aria-label="Profession">${m.professions.map((p) => html`<label class="chip-r"><input type="radio" name="profession" value="${p}"><span>${p}</span></label>`)}</div></div>
              ${m.focus ? '' : html`<label class="field"><span>Specialty <small>(optional)</small></span><select name="specialty"><option value="">—</option>${m.specialties.map((s) => html`<option>${s.name}</option>`)}</select></label>`}
              <label class="check"><input type="checkbox" name="confirmProfessional" required> <span>I am a healthcare professional, in training, or a medical student. The content is intended for professional education.</span></label>
              <label class="check"><input type="checkbox" name="acceptTerms" required> <span>I accept the <a href="/legal/agb" target="_blank">terms of use</a> and have read the <a href="/legal/datenschutz" target="_blank">privacy policy</a>.</span></label>
              <div class="row step-actions"><button class="btn btn-ghost btn-lg" type="button" data-back>${icon('chevronL', 17)} Back</button><button class="btn btn-primary btn-lg" type="submit" style="flex:1">Create account</button></div>
              <p class="xs muted" style="margin-top:12px">We only ask for what we need: name and e-mail for your account, country for licensing and VAT, language for your player defaults. Profession is optional.</p>
            </fieldset>
          </div></div>
        </form>
        <p class="small muted center" style="margin-top:16px">Already registered? <a href="/login${nq}">Sign in</a></p>
      </div></div></div>`;
    },
    mount(root, c) {
      // Side panel: rotating greeting + subtitle that switches language (decorative).
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let g = 0; let s = 0;
      const swap = (el, text) => { if (!el) return; el.classList.add('out'); setTimeout(() => { el.textContent = text; el.classList.remove('out'); }, 260); };
      if (!reduce) timer = setInterval(() => {
        g = (g + 1) % GREET.length; swap(root.querySelector('#as-word'), GREET[g][0]); swap(root.querySelector('#as-lang'), GREET[g][1]);
        if (g % 2 === 0) {
          s = (s + 1) % SUBS.length; swap(root.querySelector('#as-text'), SUBS[s][1]); swap(root.querySelector('#as-code'), SUBS[s][0]);
          root.querySelectorAll('.as-chips em').forEach((e) => e.classList.toggle('on', e.dataset.c === SUBS[s][0]));
        }
      }, 2200);

      const form = root.querySelector('#auth'); if (!form) return () => clearInterval(timer);

      // Show / hide password.
      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pw]'); if (!b) return;
        const i = b.parentElement.querySelector('input'); const show = i.type === 'password';
        i.type = show ? 'text' : 'password'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); b.classList.toggle('on', show);
      });

      // Password strength (same minimum as the server: 10 characters, letters and numbers).
      const pw = form.querySelector('input[name=password][autocomplete=new-password]');
      pw?.addEventListener('input', () => {
        const v = pw.value;
        const ok = v.length >= 10 && /[a-z]/i.test(v) && /\d/.test(v);
        const score = !v ? 0 : !ok ? 1 : 2 + (v.length >= 14 ? 1 : 0) + (/[^a-z0-9]/i.test(v) && /[A-Z]/.test(v) ? 1 : 0);
        const meter = form.querySelector('.pw-meter'); meter.dataset.s = String(Math.min(4, score));
        form.querySelector('#pw-label').textContent = ['At least 10 characters with letters and numbers', 'Too weak — 10+ characters, letters and numbers', 'Good', 'Strong', 'Very strong'][Math.min(4, score)];
      });

      // Two-step registration with a sliding transition.
      const slide = form.querySelector('.step-slide');
      const go = (n) => {
        slide.style.transform = `translateX(${n === 2 ? '-50%' : '0'})`;
        root.querySelectorAll('[data-step-dot]').forEach((d) => d.classList.toggle('on', Number(d.dataset.stepDot) <= n));
        form.querySelectorAll('.reg-step').forEach((f) => { const active = Number(f.dataset.step) === n; f.inert = !active; f.setAttribute('aria-hidden', String(!active)); });
        const track = form.querySelector('.step-track'); const cur = form.querySelector(`.reg-step[data-step="${n}"]`);
        if (track && cur) track.style.height = `${cur.offsetHeight}px`;
        setTimeout(() => form.querySelector(`.reg-step[data-step="${n}"] input, .reg-step[data-step="${n}"] select`)?.focus({ preventScroll: true }), 420);
      };
      if (slide) {
        go(1);
        form.querySelector('[data-next]').addEventListener('click', () => {
          const fields = [...form.querySelectorAll('.reg-step[data-step="1"] input')];
          const bad = fields.find((f) => !f.checkValidity());
          if (bad) { bad.reportValidity(); return; }
          if (!(/[a-z]/i.test(pw.value) && /\d/.test(pw.value))) { formError(form, 'Your password needs letters and numbers.'); return; }
          formError(form, ''); go(2);
        });
        form.querySelector('[data-back]').addEventListener('click', () => go(1));
        form.querySelector('.reg-step[data-step="1"]').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); form.querySelector('[data-next]').click(); } });
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError(form, '');
        const btn = form.querySelector('[type=submit]');
        setBusy(btn, true);
        // inert fieldsets are still submitted: formData reads every named, enabled element.
        try {
          const { user } = await post(isRegister ? '/api/auth/register' : '/api/auth/login', formData(form));
          state.user = user; emit();
          toast(isRegister ? `Welcome, ${user.firstName}!` : 'Signed in.', 'success');
          c.navigate(safeNext(c.query.next), { replace: true });
        } catch (err) {
          formError(form, err.message); setBusy(btn, false);
          if (slide && /name|e-mail|email|password/i.test(err.message)) go(1);
        }
      });
      return () => clearInterval(timer);
    },
  };
}
