import { ask, curPath, curSearch } from '../nav.js';
import { html, icon, fmtDate, fmtMoney, fmtTime, formData, setBusy, formError, toast, emptyState, esc } from '../ui.js';
import { state, langInfo } from '../store.js';
import { api, get, post, put, patch, del } from '../api.js';

const TABS = [
  ['', 'Overview', 'chart', ['admin', 'reviewer']], ['courses', 'Courses', 'play', ['admin', 'reviewer']], ['reviews', 'Translation QC', 'sparkles', ['admin', 'reviewer']],
  ['glossary', 'Glossary', 'file', ['admin', 'reviewer']], ['users', 'Users', 'users', ['admin']], ['subscriptions', 'Subscriptions', 'layers', ['admin']],
  ['plans', 'Prices & plans', 'chart', ['admin']], ['partners', 'Partners', 'handshake', ['admin']], ['complaints', 'Complaints', 'alert', ['admin']],
  ['taxonomy', 'Specialties & providers', 'stethoscope', ['admin']], ['outbox', 'E-mail outbox', 'file', ['admin']], ['audit', 'Audit log', 'shield', ['admin']],
];
const st = (s) => html`<span class="status st-${s}">${String(s).replace(/_/g, ' ')}</span>`;
const RIGHTS = [['right_use', 'Use of original video'], ['right_translate', 'AI-assisted translation'], ['right_subtitle', 'Subtitles'], ['right_ai_audio', 'AI audio tracks'],
  ['right_commercial', 'Commercial exploitation'], ['right_worldwide', 'Worldwide publication'], ['right_storage', 'Storage & processing']];
const blockersList = (b, okText) => (b.length ? html`<ul class="blockers">${b.map((x) => html`<li>${icon('alert', 16)}<span>${x}</span></li>`)}</ul>` : html`<div class="clear-ok">${icon('check', 18)} ${okText}</div>`);
const isAdmin = () => state.user?.role === 'admin';

export default function adminView() {
  let data = null;
  return {
    title: 'Admin',
    async render(ctx) {
      const u = state.user;
      if (!u) { const e = new Error('Please sign in.'); e.status = 401; throw e; }
      if (u.role === 'user') { const e = new Error('The admin area is only available to staff accounts.'); e.status = 403; throw e; }
      const tab = ctx.params.tab || ''; const id = ctx.params.id;
      const loaders = {
        '': () => get('/api/admin/overview'), courses: () => (id ? get(`/api/admin/courses/${id}`) : get('/api/admin/courses')),
        reviews: () => (id ? get(`/api/admin/translations/${id}`) : get('/api/admin/review-queue')), glossary: () => get('/api/admin/glossary'),
        users: () => get(`/api/admin/users?q=${encodeURIComponent(ctx.query.q || '')}`), subscriptions: () => get('/api/admin/subscriptions'),
        plans: () => get('/api/admin/plans'), partners: () => get('/api/admin/partners'), complaints: () => get('/api/admin/complaints'),
        taxonomy: () => get('/api/admin/taxonomy'), outbox: () => get('/api/admin/outbox'), audit: () => get('/api/admin/audit'),
      };
      if (!loaders[tab]) { const e = new Error('Unknown admin section.'); e.status = 404; throw e; }
      data = await loaders[tab]();
      if (tab === 'courses' && id) data._tax = await get('/api/admin/taxonomy');
      const body = this.section(tab, id, ctx);
      return html`
      <section class="page-head" style="padding:28px 0 20px"><div class="container wide row between">
        <div><span class="eyebrow">${icon('shield', 14)} Administration · ${u.role}</span><h1 style="font-size:1.8rem;margin:6px 0 0">Platform control</h1></div>
        <span class="small muted">Every change is recorded in the audit log.</span></div></section>
      <div class="container wide dash" style="grid-template-columns:230px 1fr">
        <nav class="dash-nav" aria-label="Admin">${TABS.filter((t) => t[3].includes(u.role)).map(([k, l, i]) => html`<a href="/admin${k ? '/' + k : ''}" class="${tab === k ? 'active' : ''}">${icon(i, 17)} ${l}</a>`)}</nav>
        <div>${body}</div>
      </div>`;
    },

    section(tab, id, ctx) {
      const d = data;
      switch (tab) {
        case '': {
          const ai = d.integrations.aiTranslation;
          const maxLang = Math.max(1, ...d.learning.byLanguage.map((x) => x.n));
          return html`
          ${!ai.connected ? html`<div class="notice warn" style="margin-bottom:20px">${icon('info', 18)}<span><b>AI translation not connected.</b> ${ai.reason} Translations can still be imported as WebVTT/SRT and edited manually.</span></div>` : ''}
          ${state.meta.integrations.payments.mode === 'demo' ? html`<div class="notice" style="margin-bottom:20px">${icon('info', 18)}<span><b>Payments in demo mode.</b> Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to process real payments. Demo records are flagged.</span></div>` : ''}
          <div class="stat-grid">
            <div class="stat"><div class="label">Published courses</div><div class="value">${d.courses.published}</div><div class="hint">${d.courses.draft} draft · ${d.courses.suspended} suspended</div></div>
            <div class="stat"><div class="label">Pending QC</div><div class="value">${d.pendingReviews}</div><div class="hint"><a href="/admin/reviews">Open review queue</a></div></div>
            <div class="stat"><div class="label">Users</div><div class="value">${d.users.total}</div><div class="hint">+${d.users.new30d} in 30 days</div></div>
            <div class="stat"><div class="label">Active subscriptions</div><div class="value">${d.subscriptions.active}</div><div class="hint">${d.subscriptions.demo} demo</div></div>
            <div class="stat"><div class="label">Open complaints</div><div class="value" style="color:${d.openComplaints ? 'var(--err)' : 'inherit'}">${d.openComplaints}</div><div class="hint"><a href="/admin/complaints">View</a></div></div>
            <div class="stat"><div class="label">New partner leads</div><div class="value">${d.newPartnerInquiries}</div><div class="hint"><a href="/admin/partners">View</a></div></div>
          </div>
          <div class="grid-2">
            <div class="panel"><div class="panel-head"><h3>Learning activity</h3><span class="small muted">${d.learning.enrolments} enrolments · ${d.learning.completions} completions</span></div>
              ${d.learning.byLanguage.length ? d.learning.byLanguage.map((x) => html`<div class="bar-row"><span>${langInfo(x.language)?.name || x.language}</span><span class="bar"><i style="width:${(x.n / maxLang) * 100}%"></i></span><span>${x.n}</span></div>`) : html`<p class="muted small">No activity yet.</p>`}</div>
            <div class="panel"><div class="panel-head"><h3>Revenue (invoiced)</h3></div>
              ${d.revenue.length ? html`<dl class="kv">${d.revenue.map((r) => html`<dt>${r.currency} · ${r.n} invoices${r.demo_count ? ` (${r.demo_count} demo)` : ''}</dt><dd>${fmtMoney(r.gross, r.currency)}</dd>`)}</dl>` : html`<p class="muted small">No invoices yet.</p>`}
              <h3 style="margin-top:20px;font-size:1rem">Licences expiring within 90 days</h3>
              ${d.expiringLicenses.length ? html`<ul class="small">${d.expiringLicenses.map((l) => html`<li><a href="/admin/courses/${l.course_id}">${l.title}</a> — ${fmtDate(l.term_end)}</li>`)}</ul>` : html`<p class="muted small">None.</p>`}
            </div>
          </div>`;
        }

        case 'courses': return id ? this.courseEditor() : html`
          <div class="panel"><div class="panel-head"><h2>Courses</h2>
            ${isAdmin() ? html`<form id="new-course" class="row"><input name="title" class="input-sm" placeholder="New course title" required style="width:260px"><button class="btn btn-primary btn-sm">${icon('plus', 15)} Create draft</button></form>` : ''}</div>
            <div class="table-wrap"><table class="table"><thead><tr><th>Course</th><th>Status</th><th>Languages</th><th>Accreditation</th><th>Licence ends</th><th>Publish gate</th></tr></thead><tbody>
            ${d.map((c) => html`<tr class="clickable" data-href="/admin/courses/${c.id}"><td><b>${c.title}</b><div class="xs muted">${c.specialty || '—'} · ${c.provider || '—'}${c.is_demo ? ' · demo' : ''}</div></td>
              <td>${st(c.status)}</td><td>${c.released_languages} released${c.pending_languages ? html`<div class="xs muted">${c.pending_languages} in workflow</div>` : ''}</td>
              <td>${st(c.accreditation_status || 'not_accredited')}</td><td>${c.term_end ? fmtDate(c.term_end) : '—'}</td>
              <td>${c.blockers ? html`<span class="badge badge-err">${c.blockers} blocker${c.blockers > 1 ? 's' : ''}</span>` : html`<span class="badge badge-ok">Clear</span>`}</td></tr>`)}
            </tbody></table></div></div>`;

        case 'reviews': return id ? this.translationEditor() : html`
          <div class="panel"><div class="panel-head"><h2>Translation review queue</h2></div>
            ${d.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Course</th><th>Language</th><th>Status</th><th>Source</th><th>Updated</th></tr></thead><tbody>
              ${d.map((t) => html`<tr class="clickable" data-href="/admin/reviews/${t.id}"><td>${t.title}</td><td>${langInfo(t.language)?.name}</td><td>${st(t.status)}</td><td class="xs mono">${t.provider}</td><td>${fmtDate(t.updated_at)}</td></tr>`)}
            </tbody></table></div>` : emptyState('Queue is empty', 'All translations are reviewed. Generate or import a translation from a course page.')}</div>`;

        case 'glossary': return html`
          <div class="panel"><div class="panel-head"><h2>Medical glossary</h2><span class="small muted">Enforced in AI translation prompts</span></div>
            <form id="gloss" class="form-grid" style="grid-template-columns:1fr 120px 1fr 1fr auto;align-items:end;gap:10px">
              <label class="field"><span>Source term (EN)</span><input name="term" required class="input-sm"></label>
              <label class="field"><span>Language</span><select name="language" class="input-sm">${state.meta.languages.filter((l) => l.code !== 'en').map((l) => html`<option value="${l.code}">${l.code.toUpperCase()}</option>`)}</select></label>
              <label class="field"><span>Translation</span><input name="translation" required class="input-sm"></label>
              <label class="field"><span>Note</span><input name="note" class="input-sm"></label>
              <button class="btn btn-primary btn-sm" style="margin-bottom:16px">Add</button></form>
            <div class="table-wrap"><table class="table"><thead><tr><th>Term</th><th>Lang</th><th>Translation</th><th>Note</th><th></th></tr></thead><tbody>
              ${d.map((g) => html`<tr><td>${g.term}</td><td>${g.language.toUpperCase()}</td><td>${g.translation}</td><td class="small muted">${g.note}</td><td><button class="btn btn-ghost btn-xs" data-del-gloss="${g.id}">Remove</button></td></tr>`)}
            </tbody></table></div></div>`;

        case 'users': return html`
          <div class="panel"><div class="panel-head"><h2>Users</h2><form class="row" id="user-search"><input name="q" class="input-sm" placeholder="Search name or e-mail" value="${ctx.query.q || ''}" style="width:240px"><button class="btn btn-ghost btn-sm">Search</button></form></div>
            <div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Country</th><th>Profession</th><th>Subscription</th><th>Courses</th><th>Joined</th><th>Role</th><th>Status</th></tr></thead><tbody>
            ${d.map((u) => html`<tr data-user="${u.id}"><td><b>${u.first_name} ${u.last_name}</b><div class="xs muted">${u.email}</div></td><td>${u.country || '—'}</td><td class="small">${u.profession || '—'}</td>
              <td>${u.subscription_status ? st(u.subscription_status) : '—'}</td><td>${u.courses_started}</td><td class="small">${fmtDate(u.created_at)}</td>
              <td><select class="input-sm" data-role style="width:auto">${['user', 'reviewer', 'admin'].map((r) => html`<option ${u.role === r ? 'selected' : ''}>${r}</option>`)}</select></td>
              <td><label class="check" style="margin:0"><input type="checkbox" data-disabled ${u.disabled ? 'checked' : ''}> <span class="small">Disabled</span></label></td></tr>`)}
            </tbody></table></div></div>`;

        case 'subscriptions': return html`
          <div class="panel"><div class="panel-head"><h2>Subscriptions</h2></div>
            ${d.subscriptions.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Plan</th><th>Status</th><th>Amount</th><th>Period end</th><th>Provider</th><th></th></tr></thead><tbody>
              ${d.subscriptions.map((s) => html`<tr><td>${s.email}</td><td>${s.plan_name}</td><td>${st(s.status)}</td><td>${fmtMoney(s.amount_cents, s.currency)}</td><td>${fmtDate(s.current_period_end)}</td><td>${s.provider}</td>
                <td>${s.status === 'active' ? html`<button class="btn btn-ghost btn-xs" data-cancel-sub="${s.id}">Cancel</button>` : ''}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">No subscriptions yet.</p>`}</div>
          <div class="panel"><div class="panel-head"><h2>Single-course purchases</h2></div>
            ${d.purchases.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Course</th><th>Amount</th><th>Date</th><th>Provider</th></tr></thead><tbody>
              ${d.purchases.map((p) => html`<tr><td>${p.email}</td><td>${p.title}</td><td>${fmtMoney(p.amount_cents, p.currency)}</td><td>${fmtDate(p.created_at)}</td><td>${p.provider}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">No purchases yet.</p>`}</div>
          <div class="panel"><div class="panel-head"><h2>Invoices</h2></div>
            ${d.invoices.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Number</th><th>Customer</th><th>Description</th><th>Net</th><th>VAT</th><th>Gross</th><th>Date</th></tr></thead><tbody>
              ${d.invoices.map((i) => html`<tr><td class="mono">${i.number}</td><td>${i.billing_name}<div class="xs muted">${i.billing_email} · ${i.tax_country || '—'}</div></td><td>${i.description}</td><td>${fmtMoney(i.net_cents, i.currency)}</td><td>${fmtMoney(i.tax_cents, i.currency)} (${i.tax_rate}%)</td><td>${fmtMoney(i.gross_cents, i.currency)}</td><td>${fmtDate(i.created_at)}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">No invoices yet.</p>`}</div>`;

        case 'plans': return html`<div class="notice" style="margin-bottom:20px">${icon('info', 18)}<span>Prices are gross amounts in minor units (cents). Changes apply to new purchases only; existing subscriptions keep their price. Price changes for existing customers require notice under consumer law.</span></div>
          ${d.map((p) => html`<form class="panel" data-plan="${p.id}"><div class="panel-head"><h3>${p.code}</h3>${p.interval === 'custom' ? html`<span class="badge badge-neutral">Custom / on request</span>` : html`<span class="badge badge-info">per ${p.interval}</span>`}</div>
            <div class="form-grid" style="grid-template-columns:2fr 1fr 1fr 1fr">
              <label class="field"><span>Name</span><input name="name" value="${p.name}" required></label>
              <label class="field"><span>EUR (cents)</span><input name="price_eur" type="number" min="0" value="${p.price_eur}"></label>
              <label class="field"><span>USD (cents)</span><input name="price_usd" type="number" min="0" value="${p.price_usd}"></label>
              <label class="field"><span>GBP (cents)</span><input name="price_gbp" type="number" min="0" value="${p.price_gbp}"></label>
              <label class="field full"><span>Features (one per line)</span><textarea name="features" rows="4">${p.features.join('\n')}</textarea></label></div>
            <div class="row"><label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> <span>Active</span></label><label class="check"><input type="checkbox" name="highlight" ${p.highlight ? 'checked' : ''}> <span>Highlight</span></label>
              <button class="btn btn-primary btn-sm" style="margin-left:auto">Save plan</button></div></form>`)}`;

        case 'partners': return html`<div class="panel"><div class="panel-head"><h2>Partner inquiries</h2></div>
          ${d.length ? d.map((p) => html`<form class="card flat pad-sm" style="margin-bottom:12px" data-partner="${p.id}">
            <div class="row between"><div><b>${p.organisation}</b> <span class="small muted">· ${p.org_type || ''} · ${p.country || ''} · ${fmtDate(p.created_at)}</span></div>${st(p.status)}</div>
            <p class="small" style="margin:8px 0">${p.contact_name} — <a href="mailto:${p.email}">${p.email}</a><br>Catalogue: ${p.catalogue_size || '—'} · Languages: ${p.target_languages || '—'} · Interests: ${p.interests || '—'}</p>
            ${p.message ? html`<p class="small muted" style="white-space:pre-wrap">${p.message}</p>` : ''}
            <div class="row"><select name="status" class="input-sm" style="width:auto">${['new', 'contacted', 'negotiating', 'signed', 'declined'].map((s) => html`<option ${p.status === s ? 'selected' : ''}>${s}</option>`)}</select>
              <input name="internal_notes" class="input-sm" placeholder="Internal notes" value="${p.internal_notes || ''}" style="flex:1;min-width:200px"><button class="btn btn-ghost btn-sm">Save</button></div></form>`)
            : html`<p class="muted">No inquiries yet.</p>`}</div>`;

        case 'complaints': return html`<div class="panel"><div class="panel-head"><h2>Complaints, legal requests & cancellations</h2></div>
          ${d.length ? d.map((k) => html`<form class="card flat pad-sm" style="margin-bottom:12px" data-complaint="${k.id}">
            <div class="row between"><div><span class="badge ${k.type === 'copyright' ? 'badge-err' : 'badge-info'}">${k.type.replace(/_/g, ' ')}</span> <b>${k.name}</b> <span class="small muted">· ${k.email} · ${fmtDate(k.created_at)} · #${k.id}</span></div>${st(k.status)}</div>
            ${k.course_title ? html`<p class="small" style="margin:8px 0 0">Course: <a href="/admin/courses/${k.course_ref}">${k.course_title}</a></p>` : ''}
            ${k.reference_url ? html`<p class="small" style="margin:4px 0 0">URL: ${k.reference_url}</p>` : ''}
            <p class="small" style="white-space:pre-wrap;margin:8px 0">${k.type === 'contract_cancellation' ? formatCancellation(k.description) : k.description}</p>
            ${k.type === 'copyright' ? html`<p class="xs muted">Good-faith statement: ${k.good_faith ? 'confirmed' : 'missing'}</p>` : ''}
            <div class="row"><select name="status" class="input-sm" style="width:auto">${['open', 'in_progress', 'resolved', 'rejected'].map((s) => html`<option ${k.status === s ? 'selected' : ''}>${s}</option>`)}</select>
              <input name="resolution" class="input-sm" placeholder="Resolution / notes" value="${k.resolution || ''}" style="flex:1;min-width:200px">
              ${k.course_ref ? html`<label class="check" style="margin:0"><input type="checkbox" name="suspendCourse"> <span class="small">Suspend course (takedown)</span></label>` : ''}
              <button class="btn btn-ghost btn-sm">Save</button></div></form>`) : html`<p class="muted">No complaints.</p>`}</div>`;

        case 'taxonomy': return html`
          <div class="panel" style="margin-bottom:20px"><div class="panel-head"><h3>Launch focus</h3><span class="small muted">What the public catalogue shows</span></div>
            <p class="small muted" style="margin-top:0">While a focus is set, only courses filed under that specialty are visible on the website, in search, in the sitemap and by direct link. Staff still see everything here. Clear it to open the whole catalogue.</p>
            <form id="focus" class="row"><select name="specialty" class="input-sm" style="width:auto" ${d.focusLocked ? 'disabled' : ''}><option value="">None — all specialties</option>${d.specialties.map((s) => html`<option value="${s.slug}" ${d.focus === s.slug ? 'selected' : ''}>${s.name}</option>`)}</select>
              <button class="btn btn-primary btn-sm" ${d.focusLocked ? 'disabled' : ''}>Apply</button>${d.focusLocked ? html`<span class="xs muted">Fixed by the LAUNCH_FOCUS environment variable.</span>` : ''}</form></div>
          <div class="panel" style="margin-bottom:20px"><div class="panel-head"><h3>Launch languages</h3><span class="small muted">Which languages the public can use</span></div>
            <p class="small muted" style="margin-top:0">Launch set: established languages with mature AI translation, plus the languages of the launch countries Nigeria and Kenya. All other languages stay hidden (no subtitles, voice, live or website translation) until you add them here.</p>
            <form id="langs">
              <label class="check"><input type="checkbox" name="all" ${d.launchLanguages === '*' ? 'checked' : ''} ${d.launchLanguagesLocked ? 'disabled' : ''}> <span class="small">All languages (no launch restriction)</span></label>
              <div class="lang-checks">${d.allLanguages.map((l) => html`<label class="check"><input type="checkbox" name="lang" value="${l.code}" ${d.launchLanguages === '*' || d.launchLanguages.includes(l.code) ? 'checked' : ''} ${d.launchLanguagesLocked || l.code === 'en' ? 'disabled' : ''}> <span class="small">${l.native} <span class="muted">· ${l.name}${d.defaultLaunchLanguages.includes(l.code) ? ' ★' : ''}</span></span></label>`)}</div>
              <div class="row" style="margin-top:12px"><button class="btn btn-primary btn-sm" ${d.launchLanguagesLocked ? 'disabled' : ''}>Apply</button><span class="xs muted">★ = default launch set${d.launchLanguagesLocked ? ' · fixed by the LAUNCH_LANGUAGES environment variable' : ''}</span></div>
            </form></div>
          <div class="grid-2">
          <div class="panel"><div class="panel-head"><h3>Medical specialties</h3></div>
            <form id="new-spec" class="row" style="margin-bottom:16px"><input name="name" class="input-sm" placeholder="New specialty" required style="flex:1"><input name="description" class="input-sm" placeholder="Short description" style="flex:1"><button class="btn btn-primary btn-sm">Add</button></form>
            <ul class="small">${d.specialties.map((s) => html`<li>${s.name}</li>`)}</ul></div>
          <div class="panel"><div class="panel-head"><h3>Original providers</h3></div>
            <form id="new-prov" class="row" style="margin-bottom:16px"><input name="name" class="input-sm" placeholder="Provider name" required style="flex:1"><input name="country" class="input-sm" placeholder="CC" maxlength="2" style="width:60px"><button class="btn btn-primary btn-sm">Add</button></form>
            <ul class="small">${d.providers.map((p) => html`<li>${p.name}${p.is_demo ? ' (demo)' : ''}</li>`)}</ul></div></div>`;

        case 'outbox': return html`<div class="panel"><div class="panel-head"><h2>E-mail outbox</h2><span class="small muted">${state.meta.integrations.mail?.connected ? 'Mail provider connected' : 'No mail provider connected — messages are stored, not delivered'}</span></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Time (UTC)</th><th>To</th><th>Subject</th><th>Kind</th><th>Status</th></tr></thead><tbody>
          ${d.map((m) => html`<tr><td class="small mono">${m.created_at}</td><td class="small">${m.to_email}</td><td class="small" title="${m.body_text}">${m.subject}</td><td class="small">${m.kind}</td><td>${st(m.status)}${m.error ? html` <span class="xs muted">${m.error}</span>` : ''}</td></tr>`)}
          </tbody></table></div></div>`;
        case 'audit': return html`<div class="panel"><div class="panel-head"><h2>Audit log</h2><span class="small muted">Latest 300 entries</span></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Time (UTC)</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>
          ${d.map((a) => html`<tr><td class="small mono">${a.created_at}</td><td class="small">${a.email || '—'}</td><td><span class="mono small">${a.action}</span></td><td class="small">${a.entity || ''} ${a.entity_id || ''}</td><td class="xs muted mono" style="max-width:340px;word-break:break-word">${a.details || ''}</td></tr>`)}
          </tbody></table></div></div>`;
        default: return '';
      }
    },

    courseEditor() {
      const c = data; const tax = data._tax; const L = c.license; const A = c.accreditation; const admin = isAdmin();
      const langs = state.meta.languages;
      const dis = admin ? '' : 'disabled';
      const covered = new Set(L?.languages || []);
      return html`
      <div class="row between" style="margin-bottom:16px"><a href="/admin/courses">← All courses</a>
        <div class="row">${st(c.status)}${c.status === 'published' ? html`<a class="btn btn-ghost btn-sm" href="/courses/${c.slug}">View live</a>` : ''}</div></div>
      <div class="panel"><div class="panel-head"><h2>${c.title}</h2>
        ${admin ? html`<div class="row">
          ${c.status !== 'published' ? html`<button class="btn btn-primary btn-sm" data-status="published" ${c.blockers.length ? 'disabled' : ''}>Publish</button>` : html`<button class="btn btn-ghost btn-sm" data-status="suspended">Suspend</button>`}
          ${c.status !== 'draft' ? html`<button class="btn btn-ghost btn-sm" data-status="draft">Move to draft</button>` : ''}
          ${c.status !== 'archived' ? html`<button class="btn btn-ghost btn-sm" data-status="archived">Archive</button>` : ''}</div>` : ''}</div>
        <h3 style="font-size:.95rem">Publication gate</h3>
        ${blockersList(c.blockers, 'All clearances present — this course may be published.')}
        <p class="xs muted" style="margin:10px 0 0">A published course is suspended automatically if a later change (licence, accreditation, details) breaks the gate.</p>
      </div>

      <form class="panel" id="details"><div class="panel-head"><h3>Course details</h3></div>
        <div class="form-grid">
          <label class="field full"><span>Title</span><input name="title" value="${c.title}" required ${dis}></label>
          <label class="field full"><span>Description</span><textarea name="description" rows="3" ${dis}>${c.description}</textarea></label>
          <label class="field full"><span>Learning objectives (one per line)</span><textarea name="objectives" rows="3" ${dis}>${c.objectives.join('\n')}</textarea></label>
          <label class="field"><span>Specialty</span><select name="specialty" ${dis}><option value="">—</option>${tax.specialties.map((s) => html`<option value="${s.slug}" ${s.id === c.specialty_id ? 'selected' : ''}>${s.name}</option>`)}</select></label>
          <label class="field"><span>Secondary specialty</span><select name="secondarySpecialty" ${dis}><option value="">—</option>${tax.specialties.map((s) => html`<option value="${s.slug}" ${s.id === c.secondary_specialty_id ? 'selected' : ''}>${s.name}</option>`)}</select></label>
          <label class="field"><span>Original provider</span><select name="provider" ${dis}><option value="">—</option>${tax.providers.map((p) => html`<option value="${p.slug}" ${p.id === c.provider_id ? 'selected' : ''}>${p.name}</option>`)}</select></label>
          <label class="field"><span>Original language</span><select name="originalLanguage" ${dis}>${langs.map((l) => html`<option value="${l.code}" ${c.original_language === l.code ? 'selected' : ''}>${l.name}</option>`)}</select></label>
          <label class="field"><span>Level</span><select name="level" ${dis}>${['foundation', 'intermediate', 'advanced'].map((l) => html`<option ${c.level === l ? 'selected' : ''}>${l}</option>`)}</select></label>
          <label class="field"><span>Access</span><select name="access" ${dis}><option value="subscription" ${c.access === 'subscription' ? 'selected' : ''}>Subscription / purchase</option><option value="free" ${c.access === 'free' ? 'selected' : ''}>Free</option></select></label>
          <label class="field"><span>Single purchase price (EUR cents, 0 = not for sale)</span><input name="priceCents" type="number" min="0" value="${c.price_cents}" ${dis}></label>
          <label class="field"><span>Release date</span><input name="releaseDate" type="date" value="${c.release_date || ''}" ${dis}></label>
          <label class="field"><span>Duration (seconds)</span><input name="durationSec" type="number" min="0" value="${c.duration_sec}" ${dis}></label>
          <div class="field"><label class="check"><input type="checkbox" name="featured" ${c.featured ? 'checked' : ''} ${dis}> <span>Featured on homepage</span></label>
            <label class="check"><input type="checkbox" name="mediaHasAudio" ${c.media_has_audio ? 'checked' : ''} ${dis}> <span>Video contains original audio</span></label></div>
        </div>${admin ? html`<button class="btn btn-primary btn-sm">Save details</button>` : ''}</form>

      <div class="panel"><div class="panel-head"><h3>Video</h3><span class="small muted mono">${c.media_file || 'no file'}</span></div>
        ${admin ? html`<form id="media" class="row"><input type="file" name="file" accept="video/mp4,video/webm" required><button class="btn btn-ghost btn-sm">${icon('download', 15)} Upload</button></form>
          <p class="xs muted" style="margin-top:8px">Production: upload to object storage, transcode to HLS/CMAF with multiple bitrates and deliver via CDN with signed URLs.</p>` : ''}</div>

      <form class="panel" id="license"><div class="panel-head"><h3>Licence & rights</h3>${L?.is_demo ? html`<span class="badge badge-warn">Demo record</span>` : ''}</div>
        ${blockersList(c.licenseBlockers, 'Licence complete and valid.')}
        <div class="form-grid" style="margin-top:16px">
          <label class="field"><span>Licensor</span><input name="licensor" value="${L?.licensor || ''}" required ${dis}></label>
          <label class="field"><span>Contract reference</span><input name="contract_ref" value="${L?.contract_ref || ''}" ${dis}></label>
          <label class="field"><span>Term start</span><input type="date" name="term_start" value="${L?.term_start || ''}" ${dis}></label>
          <label class="field"><span>Term end</span><input type="date" name="term_end" value="${L?.term_end || ''}" ${dis}></label>
          <div class="field full"><span class="field-label">Granted rights</span><div class="rights">${RIGHTS.map(([k, l]) => html`<label class="check"><input type="checkbox" name="${k}" ${L?.[k] ? 'checked' : ''} ${dis}> <span>${l}</span></label>`)}</div></div>
          <div class="field full"><label class="check"><input type="checkbox" name="allow_live_ai" ${L?.allow_live_ai ? 'checked' : ''} ${dis}> <span><b>Allow live AI subtitles</b> — viewers may request on-the-fly machine translation into any language. Shown as unreviewed; requires translation and subtitle rights.</span></label></div>
          <label class="field"><span>Territories <small>(ISO codes, comma-separated, or * )</small></span><input name="territories" value="${(L?.territories || []).join(', ')}" ${dis}></label>
          <label class="field"><span>Licensed languages <small>(codes, comma-separated, or * )</small></span><input name="languages" value="${(L?.languages || []).join(', ')}" ${dis}></label>
          <label class="field"><span>Revenue share</span><input name="revenue_share" value="${L?.revenue_share || ''}" ${dis}></label>
          <label class="field"><span>Contract document reference</span><input name="document_ref" value="${L?.document_ref || ''}" placeholder="e.g. DMS path" ${dis}></label>
          <label class="field full"><span>Notes</span><textarea name="notes" rows="2" ${dis}>${L?.notes || ''}</textarea></label>
        </div>${admin ? html`<button class="btn btn-primary btn-sm">Save licence</button>` : ''}</form>

      <form class="panel" id="accreditation"><div class="panel-head"><h3>CME / CPD accreditation</h3>${st(A?.status || 'not_accredited')}</div>
        ${blockersList(c.accreditationBlockers, 'Accreditation status is declared consistently.')}
        <div class="form-grid" style="margin-top:16px">
          <label class="field"><span>Status</span><select name="status" ${dis}>${['not_accredited', 'pending', 'accredited', 'expired'].map((s) => html`<option value="${s}" ${A?.status === s ? 'selected' : ''}>${s.replace('_', ' ')}</option>`)}</select></label>
          <label class="field"><span>Accrediting body</span><input name="body" value="${A?.body || ''}" placeholder="e.g. Landesärztekammer …" ${dis}></label>
          <label class="field"><span>Credits</span><input name="credit_amount" type="number" step="0.25" min="0" value="${A?.credit_amount ?? ''}" ${dis}></label>
          <label class="field"><span>Credit type</span><input name="credit_type" value="${A?.credit_type || ''}" placeholder="e.g. CME points" ${dis}></label>
          <label class="field"><span>Reference / event number</span><input name="reference" value="${A?.reference || ''}" ${dis}></label>
          <label class="field"><span>Applies to languages <small>(codes, empty = all)</small></span><input name="applies_to_languages" value="${(A?.applies_to_languages || []).join(', ')}" ${dis}></label>
          <label class="field"><span>Valid from</span><input type="date" name="valid_from" value="${A?.valid_from || ''}" ${dis}></label>
          <label class="field"><span>Valid until</span><input type="date" name="valid_until" value="${A?.valid_until || ''}" ${dis}></label>
          <label class="field full"><span>Evidence (document reference)</span><input name="evidence_ref" value="${A?.evidence_ref || ''}" ${dis}></label>
          <label class="field full"><span>Notes</span><textarea name="notes" rows="2" ${dis}>${A?.notes || ''}</textarea></label>
          <label class="check full"><input type="checkbox" name="verified" ${A?.verified_at ? 'checked' : ''} ${dis}> <span>I have verified the accreditation evidence (recorded with my name and time)${A?.verified_at ? ` — last verified ${fmtDate(A.verified_at)}` : ''}.</span></label>
        </div>${admin ? html`<button class="btn btn-primary btn-sm">Save accreditation</button>` : ''}
        <p class="xs muted" style="margin-top:10px">Never enter credits that have not been granted by the accrediting body.</p></form>

      <div class="panel"><div class="panel-head"><h3>Translations</h3><span class="small muted">Licensed languages: ${[...covered].join(', ') || 'none'}</span></div>
        ${c.translations.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Language</th><th>Status</th><th>Audio</th><th>Source</th><th>Last review</th><th>Release check</th><th></th></tr></thead><tbody>
          ${c.translations.map((t) => html`<tr><td><b>${langInfo(t.language)?.name}</b></td><td>${st(t.status)}</td><td class="small">${t.audio_mode}</td><td class="xs mono">${t.provider}</td>
            <td class="small">${t.reviews[0] ? html`${t.reviews[0].decision} · ${t.reviews[0].reviewer_label}${t.reviews[0].is_demo ? ' (demo)' : ''}` : '—'}</td>
            <td>${t.releaseBlockers.length ? html`<span class="badge badge-err" title="${t.releaseBlockers.join(' · ')}">${t.releaseBlockers.length} blocker(s)</span>` : html`<span class="badge badge-ok">OK</span>`}</td>
            <td><a class="btn btn-ghost btn-xs" href="/admin/reviews/${t.id}">Open</a></td></tr>`)}
        </tbody></table></div>` : html`<p class="muted small">No translations yet.</p>`}
        ${admin ? html`<form id="gen" class="panel" style="margin-top:16px;background:var(--surface-2);border:0">
          <h3 style="font-size:.95rem">Add a language</h3>
          <div class="row"><select name="language" class="input-sm" style="width:auto">${langs.filter((l) => l.code !== c.original_language).map((l) => html`<option value="${l.code}">${l.name}${covered.has(l.code) || covered.has('*') ? '' : ' (not licensed)'}</option>`)}</select>
            <label class="radio-chip"><input type="radio" name="mode" value="ai" checked><span>${icon('sparkles', 13)} Generate with AI</span></label>
            <label class="radio-chip"><input type="radio" name="mode" value="import"><span>Import WebVTT / SRT</span></label></div>
          <label class="field" data-vtt hidden style="margin-top:12px"><span>Subtitle file content (cue count must match the original)</span><textarea name="vtt" rows="5" placeholder="WEBVTT…"></textarea><input type="file" accept=".vtt,.srt,text/vtt" data-vtt-file style="margin-top:8px"></label>
          <button class="btn btn-primary btn-sm" style="margin-top:12px">Create translation</button>
          <p class="xs muted" style="margin:8px 0 0">New translations start as “machine” and must pass QC before release. Re-generating an existing language replaces its text and resets the status.</p></form>` : ''}
      </div>

      <form class="panel" id="cues"><div class="panel-head"><h3>Original transcript (${c.cues.length} cues)</h3><span class="small muted">Editing resets all translations to review</span></div>
        <div class="table-wrap" style="max-height:360px;overflow:auto"><table class="table"><thead><tr><th>#</th><th>Start</th><th>End</th><th>Speaker</th><th>Text</th><th>Chapter</th></tr></thead><tbody>
          ${c.cues.map((q) => html`<tr><td>${q.idx + 1}</td><td class="mono small">${fmtTime(q.start_sec)}</td><td class="mono small">${fmtTime(q.end_sec)}</td><td class="small">${q.speaker || ''}</td><td class="small">${q.text}</td><td class="small muted">${q.slide || ''}</td></tr>`)}</tbody></table></div>
        ${admin ? html`<label class="field" style="margin-top:14px"><span>Replace transcript from WebVTT / SRT</span><textarea name="vtt" rows="4" placeholder="WEBVTT…"></textarea></label><button class="btn btn-ghost btn-sm">Replace transcript</button>` : ''}
      </form>`;
    },

    translationEditor() {
      const t = data; const info = langInfo(t.language);
      return html`
      <div class="row between" style="margin-bottom:16px"><a href="/admin/courses/${t.course_id}">← ${t.course.title}</a>
        <a class="btn btn-ghost btn-sm" href="/api/admin/translations/${t.id}/vtt" download>${icon('download', 15)} Export WebVTT</a></div>
      <div class="panel"><div class="panel-head"><h2>${info?.name} translation</h2>${st(t.status)}</div>
        <p class="small muted">Source: <span class="mono">${t.provider}</span> · updated ${fmtDate(t.updated_at)}</p>
        <h3 style="font-size:.95rem">Release check</h3>${blockersList(t.releaseBlockers, 'Ready for release.')}
        ${isAdmin() ? html`<div class="row" style="margin-top:14px">
          ${t.status !== 'released' ? html`<select id="audio-mode" class="input-sm" style="width:auto"><option value="browser_tts">AI voice: browser synthesis (demo)</option><option value="none">Subtitles only</option><option value="file" ${t.audio_file ? '' : 'disabled'}>Dubbed audio file</option></select>
            <button class="btn btn-primary btn-sm" data-release ${t.releaseBlockers.length ? 'disabled' : ''}>Release to users</button>`
          : html`<button class="btn btn-ghost btn-sm" data-withdraw>Withdraw from users</button>`}</div>` : ''}
      </div>
      <form class="panel" id="post-edit"><div class="panel-head"><h3>Side-by-side post-editing</h3><span class="small muted">Saving returns the translation to “in review”</span></div>
        <div class="cue-editor">${t.cues.map((q, i) => html`<div class="cue-row"><div class="mono small">${fmtTime(q.start_sec)}–${fmtTime(q.end_sec)}<div class="xs muted">${q.speaker || ''}</div></div>
          <div class="src">${q.text}</div><textarea name="t${i}" dir="${info?.dir || 'ltr'}" lang="${t.language}" aria-label="Translation of cue ${i + 1}">${q.translation}</textarea></div>`)}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:14px">Save edits</button></form>
      <form class="panel" id="review"><div class="panel-head"><h3>Medical quality review</h3></div>
        <div class="form-grid">
          <label class="field"><span>Decision</span><select name="decision"><option value="approved">Approve</option><option value="changes_requested">Changes requested</option><option value="rejected">Reject</option></select></label>
          <label class="field"><span>Reviewer qualification</span><input name="qualification" required placeholder="e.g. Specialist in cardiology, native ${info?.name} speaker"></label>
          <div class="field full"><label class="check"><input type="checkbox" name="terminology_ok"> <span>Medical terminology is correct and consistent with the glossary</span></label>
            <label class="check"><input type="checkbox" name="meaning_preserved"> <span>Clinical meaning, numbers, thresholds and doses are preserved exactly</span></label>
            <label class="check"><input type="checkbox" name="sync_ok"> <span>Subtitles are readable within their timing; audio fits the slots</span></label></div>
          <label class="field full"><span>Notes</span><textarea name="notes" rows="3"></textarea></label>
        </div><button class="btn btn-primary btn-sm">Record review</button></form>
      <div class="panel"><div class="panel-head"><h3>Review history</h3></div>
        ${t.reviews.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Reviewer</th><th>Qualification</th><th>Decision</th><th>Checks</th><th>Notes</th></tr></thead><tbody>
          ${t.reviews.map((r) => html`<tr><td class="small">${fmtDate(r.created_at)}</td><td class="small">${r.reviewer_label}${r.is_demo ? html` <span class="badge badge-warn">demo</span>` : ''}</td><td class="small">${r.qualification}</td><td>${st(r.decision)}</td>
            <td class="xs">${r.terminology_ok ? '✓' : '✗'} terms · ${r.meaning_preserved ? '✓' : '✗'} meaning · ${r.sync_ok ? '✓' : '✗'} sync</td><td class="small muted">${r.notes || ''}</td></tr>`)}
        </tbody></table></div>` : html`<p class="muted small">No reviews yet.</p>`}</div>`;
    },

    mount(root, ctx) {
      const reload = () => ctx.navigate(curPath() + curSearch(), { replace: true, keepScroll: true });
      const list = (s) => String(s || '').split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
      const handle = (sel, fn) => root.querySelectorAll(sel).forEach((f) => f.addEventListener('submit', async (e) => {
        e.preventDefault(); const b = f.querySelector('button:not([type=button])') || f.querySelector('button'); formError(f, ''); setBusy(b, true);
        try { await fn(f, formData(f)); } catch (err) { formError(f, err.message + (err.details?.blockers ? ' ' + err.details.blockers.join(' ') : '')); setBusy(b, false); }
      }));
      root.addEventListener('click', async (e) => {
        const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a,button,select,input')) ctx.navigate(tr.dataset.href);
        const sb = e.target.closest('[data-status]');
        if (sb) {
          setBusy(sb, true);
          try { await post(`/api/admin/courses/${ctx.params.id}/status`, { status: sb.dataset.status }); toast(`Course ${sb.dataset.status}.`, 'success'); reload(); }
          catch (err) { toast(err.message + (err.details?.blockers ? ` (${err.details.blockers.length} blockers)` : ''), 'error'); setBusy(sb, false); }
        }
        if (e.target.closest('[data-release]')) {
          try { await post(`/api/admin/translations/${ctx.params.id}/release`, { audioMode: root.querySelector('#audio-mode')?.value }); toast('Language released.', 'success'); reload(); } catch (err) { toast(err.message + (err.details?.blockers ? ': ' + err.details.blockers.join(' ') : ''), 'error'); }
        }
        if (e.target.closest('[data-withdraw]')) {
          if (!(await ask('Withdraw this language from users?'))) return;
          try { await post(`/api/admin/translations/${ctx.params.id}/release`, { action: 'withdraw' }); toast('Withdrawn.', 'success'); reload(); } catch (err) { toast(err.message, 'error'); }
        }
        const dg = e.target.closest('[data-del-gloss]');
        if (dg) { await del(`/api/admin/glossary/${dg.dataset.delGloss}`); reload(); }
        const cs = e.target.closest('[data-cancel-sub]');
        if (cs && await ask('Cancel this subscription at period end?')) { await post(`/api/admin/subscriptions/${cs.dataset.cancelSub}/cancel`); toast('Cancelled.', 'success'); reload(); }
      });
      root.addEventListener('change', async (e) => {
        const row = e.target.closest('tr[data-user]');
        if (row && (e.target.matches('[data-role]') || e.target.matches('[data-disabled]'))) {
          try { await patch(`/api/admin/users/${row.dataset.user}`, { role: row.querySelector('[data-role]').value, disabled: row.querySelector('[data-disabled]').checked }); toast('User updated.', 'success'); }
          catch (err) { toast(err.message, 'error'); reload(); }
        }
        if (e.target.name === 'mode') root.querySelector('[data-vtt]').hidden = e.target.value !== 'import';
        if (e.target.matches('[data-vtt-file]') && e.target.files[0]) e.target.closest('form').vtt.value = await e.target.files[0].text();
      });

      const id = ctx.params.id;
      handle('#new-course', async (f, v) => { const c = await post('/api/admin/courses', v); toast('Draft created.', 'success'); ctx.navigate(`/admin/courses/${c.id}`); });
      handle('#details', async (f, v) => { await patch(`/api/admin/courses/${id}`, { ...v, objectives: v.objectives.split('\n').map((x) => x.trim()).filter(Boolean) }); toast('Details saved.', 'success'); reload(); });
      handle('#license', async (f, v) => { await put(`/api/admin/courses/${id}/license`, { ...v, territories: list(v.territories).map((x) => x.toUpperCase()), languages: list(v.languages) }); toast('Licence saved.', 'success'); reload(); });
      handle('#accreditation', async (f, v) => { await put(`/api/admin/courses/${id}/accreditation`, { ...v, applies_to_languages: list(v.applies_to_languages) }); toast('Accreditation saved.', 'success'); reload(); });
      handle('#cues', async (f, v) => { if (!v.vtt.trim()) throw new Error('Paste a WebVTT/SRT file first.'); if (!(await ask('Replace transcript? All translations go back to review.'))) return; await put(`/api/admin/courses/${id}/cues`, { vtt: v.vtt }); toast('Transcript replaced.', 'success'); reload(); });
      handle('#media', async (f) => {
        const file = f.file.files[0]; if (!file) throw new Error('Choose a file.');
        await api(`/api/admin/courses/${id}/media`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } }); toast('Video uploaded.', 'success'); reload();
      });
      handle('#gen', async (f, v) => {
        const r = await post(`/api/admin/courses/${id}/translations`, v);
        toast(r.uncertain?.length ? `Translation created — ${r.uncertain.length} cue(s) flagged as uncertain.` : 'Translation created — awaiting QC.', 'success');
        ctx.navigate(`/admin/reviews/${r.translation.id}`);
      });
      handle('#post-edit', async (f) => { const texts = [...f.querySelectorAll('textarea')].map((t) => t.value); await put(`/api/admin/translations/${id}/cues`, { texts }); toast('Edits saved — translation is in review.', 'success'); reload(); });
      handle('#review', async (f, v) => { const r = await post(`/api/admin/translations/${id}/review`, v); toast(`Review recorded (${r.status}).`, 'success'); reload(); });
      handle('#gloss', async (f, v) => { await post('/api/admin/glossary', v); reload(); });
      handle('#user-search', async (f, v) => ctx.navigate(`/admin/users?q=${encodeURIComponent(v.q)}`));
      handle('[data-plan]', async (f, v) => { await put(`/api/admin/plans/${f.dataset.plan}`, { ...v, features: v.features.split('\n') }); toast('Plan saved.', 'success'); });
      handle('[data-partner]', async (f, v) => { await patch(`/api/admin/partners/${f.dataset.partner}`, v); toast('Saved.', 'success'); reload(); });
      handle('[data-complaint]', async (f, v) => {
        if (v.suspendCourse && !(await ask('Suspend the affected course immediately?'))) return;
        await patch(`/api/admin/complaints/${f.dataset.complaint}`, v); toast('Saved.', 'success'); reload();
      });
      root.querySelector('#langs')?.addEventListener('submit', async (e) => {
        e.preventDefault(); const f = e.target;
        try {
          await put('/api/admin/launch-languages', { all: f.elements.all.checked, languages: [...f.querySelectorAll('[name=lang]:checked')].map((x) => x.value) });
          toast('Launch languages updated.', 'success'); const { loadSession } = await import('../store.js'); await loadSession(); reload();
        } catch (err) { toast(err.message, 'error'); }
      });
      handle('#focus', async (f, v) => { await put('/api/admin/focus', { specialty: v.specialty }); toast(v.specialty ? 'Launch focus applied.' : 'Whole catalogue is public now.', 'success'); const { loadSession } = await import('../store.js'); await loadSession(); reload(); });
      handle('#new-spec', async (f, v) => { await post('/api/admin/specialties', v); toast('Specialty added.', 'success'); reload(); });
      handle('#new-prov', async (f, v) => { await post('/api/admin/providers', v); toast('Provider added.', 'success'); reload(); });
    },
  };
}

function formatCancellation(json) {
  try { const x = JSON.parse(json); return `Type: ${x.kind} · Contract: ${x.contract || '—'} · Effective: ${x.effective}${x.reason ? `\nReason: ${x.reason}` : ''}`; } catch { return json; }
}
export { esc };
