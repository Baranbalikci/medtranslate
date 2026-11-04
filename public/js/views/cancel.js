// § 312k BGB "Kündigungsbutton": contracts concluded online must be cancellable
// via a clearly labelled button without login. Two-step flow: form → confirm button.
import { html, icon, formData, setBusy, formError, fmtDate } from '../ui.js';
import { state } from '../store.js';
import { post } from '../api.js';

export default {
  title: 'Verträge hier kündigen',
  render: () => {
    const u = state.user;
    return html`
    <section class="page-head"><div class="container narrow"><span class="eyebrow">Kündigung</span><h1>Verträge hier kündigen</h1>
      <p class="lead">Cancel your subscription here — no login required. You will receive a confirmation with date and time.</p></div></section>
    <section class="section-sm"><div class="container narrow">
      <form class="panel" id="cancel" novalidate>
        <div class="form-grid">
          <label class="field"><span>Name *</span><input name="name" required maxlength="160" autocomplete="name" value="${u ? `${u.firstName} ${u.lastName}` : ''}"></label>
          <label class="field"><span>E-mail used for the contract *</span><input name="email" type="email" required autocomplete="email" value="${u?.email || ''}"></label>
          <label class="field full"><span>Contract / customer number <small>(optional)</small></span><input name="contract" maxlength="200"></label>
          <div class="field full"><span class="field-label">Type of cancellation *</span>
            <label class="check"><input type="radio" name="kind" value="ordinary" checked> <span>Ordinary cancellation (ordentliche Kündigung)</span></label>
            <label class="check"><input type="radio" name="kind" value="extraordinary"> <span>Extraordinary cancellation for good cause (außerordentliche Kündigung)</span></label></div>
          <label class="field full" data-reason hidden><span>Reason for extraordinary cancellation *</span><textarea name="reason" maxlength="2000" rows="3"></textarea></label>
          <div class="field full"><span class="field-label">Effective date *</span>
            <label class="check"><input type="radio" name="effective" value="earliest" checked> <span>At the earliest possible date</span></label>
            <label class="check"><input type="radio" name="effective" value="date"> <span>On a specific date:</span> <input type="date" name="date" style="max-width:200px;height:36px;margin-left:8px"></label></div>
        </div>
        <div class="step-confirm" hidden>
          <div class="notice warn" style="margin-bottom:16px">${icon('info', 18)}<span>Please check your details. Clicking the button below submits your cancellation.</span></div>
        </div>
        <button class="btn btn-primary btn-lg" type="submit" data-step="1">Continue</button>
      </form>
      <p class="xs muted" style="margin-top:14px">Your cancellation is stored together with the time of receipt. Please keep the confirmation shown after submission (you can print it). Our e-mail confirmation requires a configured mail service <span class="ph">[Mail-Integration einrichten]</span>.</p>
    </div></section>`;
  },
  mount(root) {
    const form = root.querySelector('#cancel');
    form.addEventListener('change', () => { form.querySelector('[data-reason]').hidden = form.kind.value !== 'extraordinary'; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formError(form, '');
      const btn = form.querySelector('[type=submit]');
      if (btn.dataset.step === '1') {
        if (!form.name.value.trim() || !form.email.value.trim()) { formError(form, 'Please enter your name and e-mail.'); return; }
        form.querySelector('.step-confirm').hidden = false;
        btn.dataset.step = '2'; btn.textContent = 'Jetzt kündigen'; btn.classList.add('btn-danger'); btn.classList.remove('btn-primary');
        return;
      }
      setBusy(btn, true);
      try {
        const r = await post('/api/contracts/cancel', formData(form));
        form.innerHTML = String(html`<div class="notice ok">${icon('check', 18)}<div><b>Your cancellation has been received.</b><br>
          Reference: <b class="mono">${r.reference}</b><br>Received: ${fmtDate(r.receivedAt)} ${new Date(r.receivedAt).toLocaleTimeString()}<br>
          ${r.processedAutomatically ? 'Your subscription has been cancelled effective at the end of the current billing period.' : 'We will process your cancellation and confirm it to you.'}</div></div>
          <button class="btn btn-ghost print-btn" style="margin-top:16px" onclick="window.print()">${icon('download', 15)} Print confirmation</button>`);
      } catch (err) { formError(form, err.message); setBusy(btn, false); }
    });
  },
};
