import { html, icon, fmtMoney, formData, setBusy, formError, toast } from '../ui.js';
import { state, refreshUser } from '../store.js';
import { get, post } from '../api.js';

export default function checkoutView() {
  let quote = null;
  return {
    title: 'Checkout',
    async render(ctx) {
      if (!state.user) { const e = new Error('Please sign in.'); e.status = 401; throw e; }
      const currency = ['EUR', 'USD', 'GBP'].includes(ctx.query.currency) ? ctx.query.currency : 'EUR';
      const qs = new URLSearchParams({ currency, ...(ctx.query.plan ? { plan: ctx.query.plan } : {}), ...(ctx.query.course ? { course: ctx.query.course } : {}) });
      quote = await get(`/api/checkout/quote?${qs}`);
      const q = quote; const u = state.user;
      const demo = q.mode === 'demo';
      return html`
      <section class="page-head"><div class="container narrow"><div class="crumbs"><a href="/pricing">Pricing</a><span>/</span><span>Checkout</span></div><h1>Checkout</h1></div></section>
      <section class="section-sm"><div class="container narrow">
        ${demo ? html`<div class="notice warn" style="margin-bottom:20px">${icon('info', 18)}<span><b>Demo mode.</b> No payment provider is connected. Completing this order grants access and creates an invoice marked “DEMO”. No money is charged.</span></div>` : ''}
        <div class="grid-2" style="gap:28px;align-items:start">
          <form class="panel" id="checkout" novalidate>
            <h2 class="h3" style="font-size:1.15rem">Billing details</h2>
            <dl class="kv" style="margin-bottom:20px"><dt>Name</dt><dd>${u.firstName} ${u.lastName}</dd><dt>E-mail</dt><dd>${u.email}</dd>
              <dt>Country (VAT)</dt><dd>${u.country ? state.meta.countries.find((c) => c.code === u.country)?.name : html`<a href="/account/settings">Set country</a>`}</dd></dl>
            <input type="hidden" name="currency" value="${q.currency}">
            <label class="check"><input type="checkbox" name="acceptTerms" required> <span>I accept the <a href="/legal/agb" target="_blank">Terms and Conditions (AGB)</a> and have read the <a href="/legal/datenschutz" target="_blank">privacy policy</a>.</span></label>
            <label class="check"><input type="checkbox" name="waiveWithdrawal" required> <span>I expressly request that access to the digital content begins immediately, before the end of the withdrawal period, and I acknowledge that I thereby lose my <a href="/legal/widerruf" target="_blank">right of withdrawal</a> (§ 356 (5) BGB).</span></label>
            ${q.kind === 'subscription' ? html`<p class="form-note">The subscription renews automatically every ${q.interval} until cancelled. You can cancel at any time effective at the end of the current period — in your account or via “Verträge hier kündigen”.</p>` : ''}
            <button class="btn btn-primary btn-block btn-lg" type="submit" ${u.country ? '' : 'disabled'}>${icon('lock', 16)} ${q.kind === 'subscription' ? 'Subscribe — pay now' : 'Buy now — pay now'}</button>
            <p class="xs muted center" style="margin-top:10px">${demo ? 'Demo: no charge will be made.' : 'You will be redirected to our payment provider. Card data never reaches our servers.'}</p>
          </form>
          <div class="panel">
            <span class="eyebrow">${q.kind === 'subscription' ? 'Subscription' : 'Single course'}</span>
            <h2 class="h3" style="font-size:1.2rem;margin-top:6px">${q.name}</h2>
            ${q.features ? html`<ul class="objectives" style="margin:14px 0">${q.features.map((f) => html`<li>${icon('check', 16)}<span class="small">${f}</span></li>`)}</ul>` : ''}
            <hr class="sep" style="margin:18px 0">
            <dl class="kv">
              <dt>Net</dt><dd>${fmtMoney(q.tax.net, q.currency)}</dd>
              <dt>VAT ${q.tax.rate ? `(${q.tax.rate} %)` : ''}</dt><dd>${fmtMoney(q.tax.tax, q.currency)}</dd>
              <dt><b>Total${q.kind === 'subscription' ? ` per ${q.interval}` : ''}</b></dt><dd><b style="font-size:1.2rem">${fmtMoney(q.amount, q.currency)}</b></dd>
            </dl>
            <p class="xs muted" style="margin-top:12px">${q.tax.note}.</p>
          </div>
        </div>
      </div></section>`;
    },
    mount(root, ctx) {
      const form = root.querySelector('#checkout');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError(form, '');
        const btn = form.querySelector('[type=submit]');
        setBusy(btn, true, 'Processing…');
        const body = { ...formData(form), ...(quote.kind === 'subscription' ? { plan: quote.ref } : { course: quote.ref }) };
        try {
          const r = await post('/api/checkout', body);
          if (r.redirect) { location.href = r.redirect; return; }
          await refreshUser();
          toast(quote.kind === 'subscription' ? 'Subscription active (demo).' : 'Course unlocked (demo).', 'success');
          ctx.navigate(quote.kind === 'course' ? `/courses/${quote.ref}` : '/account/subscription');
        } catch (err) { formError(form, err.message); setBusy(btn, false); }
      });
    },
  };
}
