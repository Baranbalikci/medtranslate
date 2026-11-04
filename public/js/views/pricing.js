import { html, icon, fmtMoney, $$ } from '../ui.js';
import { state, prefs } from '../store.js';
import { faqList } from './faq.js';

const SYMBOL_COL = { EUR: 'price_eur', USD: 'price_usd', GBP: 'price_gbp' };

function plansHtml(currency) {
  const col = SYMBOL_COL[currency];
  return html`${state.meta.plans.map((p) => html`
    <div class="plan ${p.highlight ? 'highlight' : ''}">
      ${p.highlight ? html`<span class="tagline">BEST VALUE</span>` : ''}
      <h3>${p.name}</h3>
      ${p.interval === 'custom'
        ? html`<div class="amount" style="font-size:2rem">Custom</div><div class="per">Per institution · volume-based</div>`
        : html`<div><span class="amount">${fmtMoney(p[col], currency)}</span> <span class="per">/ ${p.interval}</span></div>
               <div class="vat">${currency === 'EUR' ? 'Incl. VAT for EU consumers (rate of your country).' : 'Prices plus applicable taxes where required.'}</div>`}
      <ul>${p.features.map((f) => html`<li>${icon('check', 16)}<span>${f}</span></li>`)}</ul>
      ${p.interval === 'custom'
        ? html`<a class="btn ${p.highlight ? 'btn-accent' : 'btn-ghost'} btn-block" href="/partners?type=institution">Contact sales</a>`
        : html`<a class="btn ${p.highlight ? 'btn-accent' : 'btn-primary'} btn-block" href="${state.user ? `/checkout?plan=${p.code}&currency=${currency}` : `/register?next=${encodeURIComponent(`/checkout?plan=${p.code}&currency=${currency}`)}`}">Choose ${p.name.split(' ').pop()}</a>`}
    </div>`)}`;
}

export default {
  title: 'Pricing',
  description: 'Transparent pricing for multilingual medical education: monthly, yearly and institutional licences.',
  render(ctx) {
    const currency = ['EUR', 'USD', 'GBP'].includes(ctx.query.currency) ? ctx.query.currency : prefs.get('currency', 'EUR');
    return html`
    <section class="page-head"><div class="container center">
      <span class="eyebrow">Pricing</span><h1>Simple, transparent pricing</h1>
      <p class="lead" style="margin:0 auto 24px">One subscription for the whole multilingual catalogue. Free courses stay free. Cancel any time.</p>
      <div class="seg-control" role="group" aria-label="Currency">${['EUR', 'USD', 'GBP'].map((c) => html`<button data-cur="${c}" aria-pressed="${c === currency}">${c}</button>`)}</div>
      ${state.meta.integrations.payments.mode === 'demo' ? html`<p class="small" style="margin-top:16px;color:var(--warn)">${icon('info', 14)} Demo mode: no payment provider is connected — checkout completes without any charge.</p>` : ''}
    </div></section>
    <section class="section-sm"><div class="container"><div class="plans" id="plans">${plansHtml(currency)}</div>
      <div class="grid-3" style="margin-top:40px">
        <div class="card flat pad-sm"><h3 style="font-size:1rem">${icon('file', 16)} Single courses</h3><p class="small muted">Many courses can also be bought individually from their course page — lifetime access to that course.</p></div>
        <div class="card flat pad-sm"><h3 style="font-size:1rem">${icon('award', 16)} About CME credits</h3><p class="small muted">A subscription does not award CME/CPD credits by itself. Credits depend on each course's real accreditation status.</p></div>
        <div class="card flat pad-sm"><h3 style="font-size:1rem">${icon('shield', 16)} Fair terms</h3><p class="small muted">Monthly plans renew monthly; yearly plans yearly. Cancel online any time, effective at the end of the period.</p></div>
      </div>
    </div></section>
    <section class="section-sm"><div class="container narrow">
      <h2 class="h3 center" style="margin-bottom:24px">Billing questions</h2>
      ${faqList([
        ['Which payment methods are supported?', 'Credit and debit cards plus common local methods offered by our payment provider (e.g. SEPA, Apple Pay, Google Pay), depending on your country. Card data is processed exclusively by the payment provider.'],
        ['Is VAT included?', 'For consumers in the EU, prices include VAT at the rate of your country of residence (EU One-Stop-Shop). Your invoice shows the VAT amount. Businesses may be able to apply reverse charge.'],
        ['Can I withdraw from my purchase?', 'Consumers in the EU have a 14-day right of withdrawal. For immediate access to digital content you can expressly agree that access starts before the withdrawal period ends; the right of withdrawal then expires. See the Widerrufsbelehrung.'],
        ['How do I cancel?', 'In your account under Subscription, or without login via “Verträge hier kündigen” in the footer. Access continues until the end of the paid period.'],
      ])}
    </div></section>`;
  },
  mount(root) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cur]'); if (!b) return;
      prefs.set('currency', b.dataset.cur);
      $$('[data-cur]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      root.querySelector('#plans').innerHTML = String(plansHtml(b.dataset.cur));
    });
  },
};
