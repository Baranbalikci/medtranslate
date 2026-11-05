import { html, icon, formData, setBusy, formError, toast } from '../ui.js';
import { state, emit } from '../store.js';
import { post } from '../api.js';

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/account');

function side() {
  return html`<div class="auth-side">
    <span class="eyebrow">MedTranslate</span>
    <h2 style="margin-top:10px">Medical knowledge without language barriers.</h2>
    <ul class="checklist">
      <li>${icon('check', 18)}<span>Licensed courses with AI subtitles and AI audio</span></li>
      <li>${icon('check', 18)}<span>Switch language at any moment — no reload</span></li>
      <li>${icon('check', 18)}<span>Progress tracking and completion records</span></li>
      <li>${icon('check', 18)}<span>Privacy by design: export or delete your data at any time</span></li>
    </ul></div>`;
}

export default function authView(ctx) {
  const isRegister = ctx.path === '/register';
  return {
    title: isRegister ? 'Create account' : 'Sign in',
    render(c) {
      if (state.user) { const n = safeNext(c.query.next); setTimeout(() => c.navigate(n, { replace: true })); return html``; }
      const m = state.meta;
      const next = c.query.next || '';
      if (!isRegister) {
        return html`<div class="auth-wrap">${side()}<div class="auth-main"><div class="auth-card">
          <h1>Welcome back</h1><p class="muted">Sign in to continue learning.</p>
          <form id="auth" novalidate style="margin-top:24px">
            <label class="field"><span>E-mail</span><input name="email" type="email" required autocomplete="email" autofocus></label>
            <label class="field"><span>Password</span><input name="password" type="password" required autocomplete="current-password"></label>
            <button class="btn btn-primary btn-block btn-lg" type="submit">Sign in</button>
          </form>
          <p class="small muted center" style="margin-top:20px">New here? <a href="/register${next ? `?next=${encodeURIComponent(next)}` : ''}">Create a free account</a></p>
          <p class="xs muted center">Forgot your password? Password reset by e-mail requires a configured mail service — please <a href="/contact">contact support</a>.</p>
        </div></div></div>`;
      }
      return html`<div class="auth-wrap">${side()}<div class="auth-main"><div class="auth-card">
        <h1>Create your account</h1><p class="muted">Free to join. Choose a plan only when you need it.</p>
        <form id="auth" novalidate style="margin-top:24px">
          <div class="form-grid">
            <label class="field"><span>First name</span><input name="firstName" required maxlength="80" autocomplete="given-name"></label>
            <label class="field"><span>Last name</span><input name="lastName" required maxlength="80" autocomplete="family-name"></label>
            <label class="field full"><span>E-mail</span><input name="email" type="email" required autocomplete="email"></label>
            <label class="field full"><span>Password <small>(min. 10 characters, letters and numbers)</small></span><input name="password" type="password" required minlength="10" autocomplete="new-password"></label>
            <label class="field"><span>Country</span><select name="country" required><option value="">Select…</option>${m.countries.map((x) => html`<option value="${x.code}">${x.name}</option>`)}</select></label>
            <label class="field"><span>Preferred language</span><select name="preferredLanguage">${m.languages.map((l) => html`<option value="${l.code}" ${navigator.language?.startsWith(l.code) ? 'selected' : ''}>${l.native}</option>`)}</select></label>
            <label class="field"><span>Profession <small>(optional)</small></span><select name="profession"><option value="">—</option>${m.professions.map((p) => html`<option>${p}</option>`)}</select></label>
            ${m.focus ? '' : html`<label class="field"><span>Specialty <small>(optional)</small></span><select name="specialty"><option value="">—</option>${m.specialties.map((s) => html`<option>${s.name}</option>`)}</select></label>`}
          </div>
          <label class="check"><input type="checkbox" name="confirmProfessional" required> <span>I am a healthcare professional, in training, or a medical student. The content is intended for professional education.</span></label>
          <label class="check"><input type="checkbox" name="acceptTerms" required> <span>I accept the <a href="/legal/agb" target="_blank">terms of use</a> and have read the <a href="/legal/datenschutz" target="_blank">privacy policy</a>.</span></label>
          <button class="btn btn-primary btn-block btn-lg" type="submit">Create account</button>
          <p class="xs muted" style="margin-top:12px">We only ask for what we need: name and e-mail for your account, country for licensing and VAT, language for your player defaults. Profession and specialty are optional.</p>
        </form>
        <p class="small muted center" style="margin-top:16px">Already registered? <a href="/login${next ? `?next=${encodeURIComponent(next)}` : ''}">Sign in</a></p>
      </div></div></div>`;
    },
    mount(root, c) {
      const form = root.querySelector('#auth'); if (!form) return;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError(form, '');
        const btn = form.querySelector('[type=submit]');
        setBusy(btn, true);
        try {
          const { user } = await post(isRegister ? '/api/auth/register' : '/api/auth/login', formData(form));
          state.user = user; emit();
          toast(isRegister ? `Welcome, ${user.firstName}!` : 'Signed in.', 'success');
          c.navigate(safeNext(c.query.next), { replace: true });
        } catch (err) { formError(form, err.message); setBusy(btn, false); }
      });
    },
  };
}
