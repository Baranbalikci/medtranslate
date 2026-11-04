import { get, run, tx, audit, parseJson } from '../db.js';
import { loadCourseBySlug } from '../catalog.js';
import { createCheckout, paymentMode, taxFor, verifyStripeSignature, cancelProviderSubscription } from '../services/payments.js';
import { readBody, bad, str, email, oneOf, rateLimit, HttpError } from '../http.js';

const CURRENCIES = ['EUR', 'USD', 'GBP'];
const addPeriod = (interval) => {
  const d = new Date();
  if (interval === 'year') d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
};

function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  // Consecutive numbering per year across real and demo invoices (demo ones carry a DEMO- prefix).
  const n = get("SELECT COUNT(*) AS n FROM invoices WHERE number LIKE ? OR number LIKE ?", `MT-${year}-%`, `DEMO-MT-${year}-%`).n + 1;
  return `MT-${year}-${String(n).padStart(6, '0')}`;
}

function createInvoice(user, description, currency, grossCents, isDemo) {
  const t = taxFor(user.country, grossCents);
  run(`INSERT INTO invoices (number, user_id, description, currency, net_cents, tax_cents, gross_cents, tax_rate, tax_country, billing_name, billing_email, is_demo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, (isDemo ? 'DEMO-' : '') + nextInvoiceNumber(), user.id, description, currency,
    t.net, t.tax, grossCents, t.rate, user.country, `${user.first_name} ${user.last_name}`, user.email, isDemo ? 1 : 0);
}

function fulfilSubscription(user, plan, currency, amount, provider, providerRef, waiverAt) {
  tx(() => {
    run("UPDATE subscriptions SET status = 'expired' WHERE user_id = ? AND status IN ('active','canceled')", user.id);
    run(`INSERT INTO subscriptions (user_id, plan_id, status, currency, amount_cents, current_period_end, provider, provider_ref, withdrawal_waiver_at)
         VALUES (?,?, 'active', ?,?,?,?,?,?)`, user.id, plan.id, currency, amount, addPeriod(plan.interval), provider, providerRef, waiverAt);
    createInvoice(user, `${plan.name} (${plan.interval === 'year' ? '12 months' : '1 month'})`, currency, amount, provider === 'demo');
  });
  audit(user.id, 'subscription.started', 'plan', plan.code, { provider, currency, amount });
}

function fulfilPurchase(user, course, currency, amount, provider, providerRef, waiverAt) {
  tx(() => {
    run(`INSERT OR IGNORE INTO purchases (user_id, course_id, currency, amount_cents, provider, provider_ref, withdrawal_waiver_at) VALUES (?,?,?,?,?,?,?)`,
      user.id, course.id, currency, amount, provider, providerRef, waiverAt);
    createInvoice(user, `Course: ${course.title}`, currency, amount, provider === 'demo');
  });
  audit(user.id, 'course.purchased', 'course', course.id, { provider, currency, amount });
}

export function registerCommerceRoutes(r) {
  r.get('/api/checkout/quote', (ctx) => {
    const currency = CURRENCIES.includes(ctx.query.currency) ? ctx.query.currency : 'EUR';
    const item = resolveItem(ctx.query, currency);
    const tax = taxFor(ctx.user?.country, item.amount);
    return { ...item, currency, tax, mode: paymentMode() };
  }, { auth: true });

  r.post('/api/checkout', async (ctx) => {
    rateLimit(`checkout:${ctx.user.id}`, 20, 3600_000);
    const b = await ctx.json();
    const currency = oneOf(b.currency || 'EUR', CURRENCIES, 'Currency');
    const item = resolveItem(b, currency);
    if (!b.acceptTerms) throw bad('Please accept the terms and conditions.');
    // § 356 (5) BGB: express consent to immediate performance + acknowledgement of losing the right of withdrawal.
    if (!b.waiveWithdrawal) throw bad('To start immediately, please consent to immediate access and acknowledge the loss of your right of withdrawal.');
    if (!ctx.user.country) throw bad('Please set your country in your profile first (needed for correct VAT).');
    const waiverAt = new Date().toISOString();

    const user = ctx.user;
    const order = {
      kind: item.kind, name: item.name, amountCents: item.amount, currency, interval: item.interval, user,
      metadata: { user_id: String(user.id), kind: item.kind, ref: item.ref, waiver_at: waiverAt },
    };
    const session = await createCheckout(order);
    if (session.mode === 'stripe') return { redirect: session.url };

    // Demo mode: fulfil immediately, flagged as demo everywhere.
    if (item.kind === 'subscription') fulfilSubscription(user, item.plan, currency, item.amount, 'demo', null, waiverAt);
    else fulfilPurchase(user, item.course, currency, item.amount, 'demo', null, waiverAt);
    return { ok: true, mode: 'demo' };
  }, { auth: true });

  // Cancel own subscription (logged-in). Access remains until period end.
  r.post('/api/subscription/cancel', async (ctx) => {
    const sub = get("SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", ctx.user.id);
    if (!sub) throw bad('No active subscription found.');
    await cancelProviderSubscription(sub);
    run("UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = 1, canceled_at = datetime('now') WHERE id = ?", sub.id);
    audit(ctx.user.id, 'subscription.canceled', 'subscription', sub.id);
    return { ok: true, accessUntil: sub.current_period_end };
  }, { auth: true });

  // § 312k BGB "Kündigungsbutton": cancellation without login. Stored and confirmed with a reference.
  r.post('/api/contracts/cancel', async (ctx) => {
    rateLimit(`cancel:${ctx.ip}`, 10, 3600_000);
    const b = await ctx.json();
    const name = str(b.name, { required: true, max: 160, name: 'Name' });
    const mail = email(b.email);
    const kind = oneOf(b.kind || 'ordinary', ['ordinary', 'extraordinary'], 'Type of cancellation');
    const reason = kind === 'extraordinary' ? str(b.reason, { required: true, max: 2000, name: 'Reason' }) : str(b.reason, { max: 2000 });
    const contract = str(b.contract, { max: 200 });
    const when = b.effective === 'date' ? str(b.date, { max: 10 }) : 'earliest possible date';
    const res = run(`INSERT INTO complaints (type, name, email, description, user_id) VALUES ('contract_cancellation', ?,?,?,?)`,
      name, mail, JSON.stringify({ kind, contract, effective: when, reason }), ctx.user?.id ?? null);

    // Cancel right away only when the signed-in user is the contract holder. Requests from
    // anonymous senders are recorded and verified by staff (prevents cancelling third-party contracts).
    const u = ctx.user && ctx.user.email.toLowerCase() === mail ? ctx.user : null;
    let canceled = false;
    if (u) {
      const sub = get("SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", u.id);
      if (sub && kind === 'ordinary') {
        await cancelProviderSubscription(sub).catch(() => {});
        run("UPDATE subscriptions SET status = 'canceled', cancel_at_period_end = 1, canceled_at = datetime('now') WHERE id = ?", sub.id);
        canceled = true;
      }
    }
    const reference = `CXL-${String(res.lastInsertRowid).padStart(6, '0')}`;
    audit(u?.id ?? null, 'contract.cancel_request', 'complaint', res.lastInsertRowid, { kind, canceled });
    return { ok: true, reference, receivedAt: new Date().toISOString(), processedAutomatically: canceled };
  });

  // Stripe webhook (only active when Stripe is configured).
  r.post('/api/webhooks/stripe', async (ctx) => {
    const raw = (await readBody(ctx.req, 1_000_000)).toString('utf8');
    if (!verifyStripeSignature(raw, ctx.req.headers['stripe-signature'])) throw new HttpError(400, 'Invalid signature');
    const event = JSON.parse(raw);
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const md = s.metadata || {};
      const user = get('SELECT * FROM users WHERE id = ?', Number(md.user_id));
      if (user) {
        const currency = String(s.currency || 'eur').toUpperCase();
        if (md.kind === 'subscription') {
          const plan = get('SELECT * FROM plans WHERE code = ?', md.ref);
          if (plan) fulfilSubscription(user, plan, currency, s.amount_total, 'stripe', s.subscription, md.waiver_at);
        } else {
          const course = get('SELECT * FROM courses WHERE slug = ?', md.ref);
          if (course) fulfilPurchase(user, course, currency, s.amount_total, 'stripe', s.payment_intent, md.waiver_at);
        }
      }
    }
    if (event.type === 'customer.subscription.deleted') {
      run("UPDATE subscriptions SET status = 'expired' WHERE provider = 'stripe' AND provider_ref = ?", event.data.object.id);
    }
    return { received: true };
  }, { skipCsrf: true });
}

function resolveItem(q, currency) {
  const col = { EUR: 'price_eur', USD: 'price_usd', GBP: 'price_gbp' }[currency];
  if (q.plan) {
    const plan = get('SELECT * FROM plans WHERE code = ? AND active = 1', String(q.plan));
    if (!plan || plan.interval === 'custom') throw bad('This plan cannot be purchased online. Please contact us.');
    return { kind: 'subscription', ref: plan.code, name: plan.name, amount: plan[col], interval: plan.interval, plan,
      features: parseJson(plan.features, []) };
  }
  if (q.course) {
    const course = loadCourseBySlug(String(q.course));
    if (!course || course.status !== 'published' || course.access === 'free' || !course.price_cents) throw bad('This course cannot be purchased individually.');
    // Single-course prices are stored in EUR; other currencies use a fixed, admin-visible conversion.
    const rate = { EUR: 1, USD: 1.1, GBP: 0.87 }[currency];
    return { kind: 'course', ref: course.slug, name: course.title, amount: currency === 'EUR' ? course.price_cents : Math.round((course.price_cents * rate) / 100) * 100 - 1, course };
  }
  throw bad('Nothing to purchase.');
}

