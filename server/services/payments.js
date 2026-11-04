// Payment provider abstraction.
//
// • Stripe (when STRIPE_SECRET_KEY is set): creates hosted Checkout Sessions;
//   card data never touches this server (PCI-DSS SAQ A scope). Fulfilment
//   happens in the signed webhook handler.
// • Demo mode (default): no money moves. Orders are fulfilled immediately and
//   every record is flagged is_demo so it can never be confused with real revenue.
import crypto from 'node:crypto';
import { config } from '../config.js';

export const paymentMode = () => (config.stripeSecretKey ? 'stripe' : 'demo');

// Indicative VAT rates for B2C digital services (OSS: rate of the customer's
// country). Must be verified by a tax adviser and kept up to date.
const VAT = { DE: 19, AT: 20, BE: 21, CZ: 21, DK: 25, ES: 21, FI: 25.5, FR: 20, GR: 24, IE: 23, IT: 22, NL: 21, PL: 23, PT: 23, SE: 25 };
export function taxFor(country, grossCents) {
  const rate = VAT[country] ?? 0;
  const net = Math.round(grossCents / (1 + rate / 100));
  return { rate, net, tax: grossCents - net, note: VAT[country] != null ? 'EU VAT (OSS) — indicative' : 'No VAT calculated for this country — requires tax review' };
}

async function stripe(pathname, params) {
  const body = new URLSearchParams();
  const flat = (obj, prefix = '') => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v && typeof v === 'object') flat(v, key); else if (v != null) body.append(key, String(v));
    }
  };
  flat(params);
  const r = await fetch(`https://api.stripe.com/v1/${pathname}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.stripeSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Stripe request failed');
  return data;
}

/**
 * @param {{kind:'subscription'|'course', name:string, amountCents:number, currency:string, interval?:'month'|'year', user:object, metadata:object}} order
 */
export async function createCheckout(order) {
  if (paymentMode() === 'demo') return { mode: 'demo' };
  const lineItem = {
    quantity: 1,
    price_data: {
      currency: order.currency.toLowerCase(),
      unit_amount: order.amountCents,
      product_data: { name: order.name },
      ...(order.kind === 'subscription' ? { recurring: { interval: order.interval } } : {}),
    },
  };
  const session = await stripe('checkout/sessions', {
    mode: order.kind === 'subscription' ? 'subscription' : 'payment',
    customer_email: order.user.email,
    line_items: { 0: lineItem },
    automatic_tax: { enabled: 'true' },
    success_url: `${config.publicUrl}/account?checkout=success`,
    cancel_url: `${config.publicUrl}/pricing?checkout=cancelled`,
    metadata: order.metadata,
    ...(order.kind === 'subscription' ? { subscription_data: { metadata: order.metadata } } : {}),
  });
  return { mode: 'stripe', url: session.url, id: session.id };
}

export function verifyStripeSignature(rawBody, header) {
  if (!config.stripeWebhookSecret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', config.stripeWebhookSecret).update(`${parts.t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function cancelProviderSubscription(sub) {
  if (sub.provider !== 'stripe' || !sub.provider_ref) return;
  await stripe(`subscriptions/${sub.provider_ref}`, { cancel_at_period_end: 'true' });
}
