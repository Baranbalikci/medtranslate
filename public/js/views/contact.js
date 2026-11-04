import { html, icon, formData, setBusy, formError, toast } from '../ui.js';
import { state } from '../store.js';
import { post } from '../api.js';

export default {
  title: 'Contact',
  render: () => {
    const u = state.user;
    return html`
    <section class="page-head"><div class="container"><span class="eyebrow">Contact</span><h1>Get in touch</h1>
      <p class="lead">Questions about courses, your account or our platform? We usually reply within two working days.</p></div></section>
    <section class="section-sm"><div class="container grid-2" style="gap:40px;align-items:start">
      <form class="panel" id="contact-form" novalidate>
        <div class="form-grid">
          <label class="field"><span>Name</span><input name="name" required maxlength="120" autocomplete="name" value="${u ? `${u.firstName} ${u.lastName}` : ''}"></label>
          <label class="field"><span>E-mail</span><input name="email" type="email" required autocomplete="email" value="${u?.email || ''}"></label>
          <label class="field full"><span>Topic</span><select name="type"><option value="general">General question</option><option value="medical_content">Medical content</option><option value="translation_error">Translation error</option><option value="privacy">Privacy / data protection request</option></select></label>
          <label class="field full"><span>Message</span><textarea name="description" required maxlength="6000" rows="6"></textarea></label>
        </div>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <label class="check"><input type="checkbox" name="privacyAccepted" required> <span>I have read the <a href="/legal/datenschutz" target="_blank">privacy policy</a>. My data will be used only to answer this request.</span></label>
        <button class="btn btn-primary" type="submit">Send message</button>
      </form>
      <div class="stack">
        <div class="trust-item"><span class="ic">${icon('handshake', 20)}</span><div><h3>Partnerships & licensing</h3><p>CME providers, universities and clinics: please use the <a href="/partners">partner form</a>.</p></div></div>
        <div class="trust-item"><span class="ic">${icon('shield', 20)}</span><div><h3>Legal & copyright</h3><p>Copyright notices and legal requests: <a href="/legal/meldung">legal reporting form</a>.</p></div></div>
        <div class="trust-item"><span class="ic">${icon('file', 20)}</span><div><h3>Cancel a contract</h3><p>Use <a href="/cancel">Verträge hier kündigen</a> — no login required.</p></div></div>
        <div class="trust-item"><span class="ic">${icon('mail', 20)}</span><div><h3>Postal address</h3><p>See <a href="/legal/impressum">Impressum</a>.</p></div></div>
      </div>
    </div></section>`;
  },
  mount(root) {
    const form = root.querySelector('#contact-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]');
      formError(form, '');
      setBusy(btn, true, 'Sending…');
      try {
        const r = await post('/api/complaints', formData(form));
        form.innerHTML = String(html`<div class="notice ok">${icon('check', 18)}<span>Thank you — your message has been received${r.reference ? html` (reference <b>${r.reference}</b>)` : ''}. We'll get back to you by e-mail.</span></div>`);
        toast('Message sent.', 'success');
      } catch (err) { formError(form, err.message); setBusy(btn, false); }
    });
  },
};
