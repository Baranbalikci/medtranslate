import { ask, STATIC } from '../nav.js';
import { html, icon, fmtDate, fmtMoney, fmtDuration, courseCard, emptyState, formData, setBusy, formError, toast } from '../ui.js';
import { state, emit, langInfo } from '../store.js';
import { get, post, patch, del } from '../api.js';

const TABS = [
  ['', 'Overview', 'chart'], ['courses', 'My courses', 'play'], ['saved', 'Saved', 'bookmark'], ['history', 'Watch history', 'clock'],
  ['certificates', 'Certificates', 'award'], ['subscription', 'Subscription', 'layers'], ['invoices', 'Invoices', 'file'], ['settings', 'Settings', 'settings'],
];

const progressRow = (p) => html`<div class="list-item">
  <a href="/courses/${p.course.slug}"><img src="${p.course.poster}" alt="" loading="lazy"></a>
  <div><h4><a href="/courses/${p.course.slug}" style="color:inherit">${p.course.title}</a></h4>
    <div class="small muted">${p.course.topic?.name || p.course.specialty?.name} · ${p.lastLanguage ? `last watched in ${langInfo(p.lastLanguage)?.name}` : ''} · ${fmtDate(p.updatedAt)}</div>
    <div class="progress" style="margin-top:10px;max-width:360px"><i style="width:${Math.round(p.percent * 100)}%"></i></div></div>
  <div class="row">${p.completedAt ? html`<span class="badge badge-ok">${icon('check', 13)} Completed</span>` : html`<span class="small muted">${Math.round(p.percent * 100)}%</span>`}
    ${p.available ? html`<a class="btn btn-ghost btn-sm" href="/courses/${p.course.slug}">${p.completedAt ? 'Rewatch' : 'Continue'}</a>` : html`<span class="badge badge-neutral">No longer available</span>`}</div>
</div>`;

export default function accountView() {
  let d = null;
  return {
    title: 'My account',
    async render(ctx) {
      if (!state.user) { const e = new Error('Please sign in.'); e.status = 401; throw e; }
      d = await get('/api/account/dashboard');
      const tab = ctx.params.tab || '';
      const u = d.user;
      return html`
      <section class="page-head" style="padding-bottom:24px"><div class="container"><span class="eyebrow">My account</span>
        <h1 style="font-size:2rem">Hello, ${u.firstName}</h1>
        ${ctx.query.checkout === 'success' ? html`<div class="notice ok" style="margin-top:12px">${icon('check', 18)}<span>Thank you — your payment was received.</span></div>` : ''}
      </div></section>
      <div class="container dash">
        <nav class="dash-nav" aria-label="Account">
          ${TABS.map(([k, l, i]) => html`<a href="/account${k ? '/' + k : ''}" class="${tab === k ? 'active' : ''}" ${tab === k ? html`aria-current="page"` : ''}>${icon(i, 17)} ${l}</a>`)}
          <span class="sep"></span>
          <button data-action="logout">${icon('logout', 17)} Sign out</button>
        </nav>
        <div>${this.tab(tab)}</div>
      </div>`;
    },
    tab(tab) {
      const u = d.user; const m = state.meta;
      switch (tab) {
        case '': return html`
          <div class="stat-grid">
            <div class="stat"><div class="label">${icon('play', 14)} Courses started</div><div class="value">${d.stats.started}</div></div>
            <div class="stat"><div class="label">${icon('award', 14)} Completed</div><div class="value">${d.stats.completed}</div></div>
            <div class="stat"><div class="label">${icon('clock', 14)} Time watched</div><div class="value">${fmtDuration(d.stats.watchedSec)}</div></div>
            <div class="stat"><div class="label">${icon('layers', 14)} Plan</div><div class="value" style="font-size:1.15rem;margin-top:12px">${d.subscription && d.subscription.status !== 'expired' ? d.subscription.plan_name : 'Free account'}</div>
              <div class="hint">${d.subscription?.status === 'canceled' ? `Ends ${fmtDate(d.subscription.current_period_end)}` : d.subscription?.status === 'active' ? `Renews ${fmtDate(d.subscription.current_period_end)}` : html`<a href="/pricing">See plans</a>`}</div></div>
          </div>
          <div class="panel"><div class="panel-head"><h2>Continue learning</h2><a href="/account/courses" class="small">All courses</a></div>
            ${d.inProgress.length ? d.inProgress.slice(0, 3).map(progressRow) : emptyState('Nothing in progress', 'Start a course — your progress is saved automatically.', html`<a class="btn btn-primary" href="/courses">Browse courses</a>`)}</div>
          <div class="panel"><div class="panel-head"><h2>Saved for later</h2><a href="/account/saved" class="small">View all</a></div>
            ${d.saved.length ? html`<div class="course-grid">${d.saved.slice(0, 3).map((c) => courseCard(c, m.languages))}</div>` : html`<p class="muted small">Use “Save” on a course page to keep it here.</p>`}</div>`;
        case 'courses': return html`<div class="panel"><div class="panel-head"><h2>In progress</h2></div>${d.inProgress.length ? d.inProgress.map(progressRow) : html`<p class="muted">No courses in progress.</p>`}</div>
          <div class="panel"><div class="panel-head"><h2>Completed</h2></div>${d.completed.length ? d.completed.map(progressRow) : html`<p class="muted">No completed courses yet.</p>`}</div>`;
        case 'saved': return d.saved.length ? html`<div class="course-grid">${d.saved.map((c) => courseCard(c, m.languages))}</div>` : emptyState('No saved courses', 'Save courses to build your personal learning list.', html`<a class="btn btn-primary" href="/courses">Browse courses</a>`);
        case 'history': return html`<div class="panel"><div class="panel-head"><h2>Watch history</h2></div>
          ${d.history.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Course</th><th>Started</th><th>Last watched</th><th>Language</th><th>Progress</th></tr></thead><tbody>
            ${d.history.map((p) => html`<tr><td><a href="/courses/${p.course.slug}">${p.course.title}</a></td><td>${fmtDate(p.startedAt)}</td><td>${fmtDate(p.updatedAt)}</td><td>${langInfo(p.lastLanguage)?.name || '—'}</td><td>${Math.round(p.percent * 100)}%${p.completedAt ? ' ✓' : ''}</td></tr>`)}
          </tbody></table></div>` : html`<p class="muted">You haven't watched anything yet.</p>`}</div>`;
        case 'certificates': return html`<div class="notice" style="margin-bottom:20px">${icon('info', 18)}<span>Completion records confirm that you watched a course. CME/CPD certificates are only issued for courses with a valid, verified accreditation — the demo courses award no credits.</span></div>
          ${d.certificates.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Course</th><th>Type</th><th>Issued</th><th></th></tr></thead><tbody>
            ${d.certificates.map((c) => html`<tr><td>${c.title}</td><td>${c.kind === 'cme' ? html`<span class="badge badge-ok">CME · ${c.credit_amount} ${c.credit_type}</span>` : html`<span class="badge badge-neutral">Completion record</span>`}</td><td>${fmtDate(c.issued_at)}</td><td><a class="btn btn-ghost btn-xs" href="/certificates/${c.id}">View</a></td></tr>`)}
          </tbody></table></div>` : emptyState('No certificates yet', 'Complete at least 90% of a course to receive a completion record.')}`;
        case 'subscription': {
          const s = d.subscription;
          return html`<div class="panel"><div class="panel-head"><h2>Subscription</h2>${s ? html`<span class="status st-${s.status}">${s.status}</span>` : ''}</div>
            ${s && s.status !== 'expired' ? html`<dl class="kv" style="max-width:480px">
                <dt>Plan</dt><dd>${s.plan_name}</dd><dt>Price</dt><dd>${fmtMoney(s.amount_cents, s.currency)} / ${s.interval}</dd>
                <dt>Started</dt><dd>${fmtDate(s.started_at)}</dd><dt>${s.status === 'canceled' ? 'Access until' : 'Next renewal'}</dt><dd>${fmtDate(s.current_period_end)}</dd>
                <dt>Payment</dt><dd>${s.provider === 'demo' ? 'Demo (no charge)' : s.provider}</dd></dl>
              ${s.status === 'active' ? html`<hr class="sep"><h3>Cancel subscription</h3><p class="small muted">Your access continues until ${fmtDate(s.current_period_end)}. You can resubscribe at any time.</p>
                <button class="btn btn-ghost" data-cancel-sub>Cancel subscription</button>` : html`<div class="notice warn" style="margin-top:16px">${icon('info', 18)}<span>Cancelled on ${fmtDate(s.canceled_at)}. Access ends ${fmtDate(s.current_period_end)}.</span></div>`}`
              : emptyState('No active subscription', 'Subscribe to access the full multilingual catalogue.', html`<a class="btn btn-primary" href="/pricing">See plans</a>`)}
          </div>
          ${d.purchases.length ? html`<div class="panel"><div class="panel-head"><h2>Purchased courses</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Course</th><th>Date</th><th>Amount</th></tr></thead><tbody>
            ${d.purchases.map((p) => html`<tr><td><a href="/courses/${p.slug}">${p.title}</a></td><td>${fmtDate(p.created_at)}</td><td>${fmtMoney(p.amount_cents, p.currency)}${p.provider === 'demo' ? ' (demo)' : ''}</td></tr>`)}</tbody></table></div></div>` : ''}`;
        }
        case 'invoices': return html`<div class="panel"><div class="panel-head"><h2>Invoices</h2></div>
          ${d.invoices.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Number</th><th>Date</th><th>Description</th><th>Net</th><th>VAT</th><th>Total</th></tr></thead><tbody>
            ${d.invoices.map((i) => html`<tr><td class="mono">${i.number}</td><td>${fmtDate(i.created_at)}</td><td>${i.description}${i.is_demo ? html` <span class="badge badge-warn">DEMO</span>` : ''}</td>
              <td>${fmtMoney(i.net_cents, i.currency)}</td><td>${fmtMoney(i.tax_cents, i.currency)} (${i.tax_rate}%)</td><td><b>${fmtMoney(i.gross_cents, i.currency)}</b></td></tr>`)}
          </tbody></table></div><p class="xs muted" style="margin-top:12px">Invoices are retained for the statutory retention period (§ 147 AO, § 257 HGB), even if you delete your account.</p>` : html`<p class="muted">No invoices yet.</p>`}</div>`;
        case 'settings': return html`
          <form class="panel" id="profile" novalidate><div class="panel-head"><h2>Profile</h2></div>
            <div class="form-grid">
              <label class="field"><span>First name</span><input name="firstName" value="${u.firstName}" required maxlength="80"></label>
              <label class="field"><span>Last name</span><input name="lastName" value="${u.lastName}" required maxlength="80"></label>
              <label class="field"><span>E-mail</span><input value="${u.email}" disabled></label>
              <label class="field"><span>Country <small>(licensing & VAT)</small></span><select name="country"><option value="">—</option>${m.countries.map((c) => html`<option value="${c.code}" ${u.country === c.code ? 'selected' : ''}>${c.name}</option>`)}</select></label>
              <label class="field"><span>Preferred language</span><select name="preferredLanguage">${m.languages.map((l) => html`<option value="${l.code}" ${u.preferredLanguage === l.code ? 'selected' : ''}>${l.native}</option>`)}</select></label>
              <label class="field"><span>Profession</span><select name="profession"><option value="">—</option>${m.professions.map((p) => html`<option ${u.profession === p ? 'selected' : ''}>${p}</option>`)}</select></label>
              ${m.focus ? '' : html`<label class="field"><span>Specialty</span><select name="specialty"><option value="">—</option>${m.specialties.map((s) => html`<option ${u.specialty === s.name ? 'selected' : ''}>${s.name}</option>`)}</select></label>`}
            </div><button class="btn btn-primary" type="submit">Save profile</button></form>
          <form class="panel" id="password" novalidate><div class="panel-head"><h2>Password</h2></div>
            <div class="form-grid">
              <label class="field"><span>Current password</span><input type="password" name="currentPassword" required autocomplete="current-password"></label>
              <label class="field"><span>New password</span><input type="password" name="newPassword" required minlength="10" autocomplete="new-password"></label>
            </div><button class="btn btn-ghost" type="submit">Change password</button></form>
          <div class="panel"><div class="panel-head"><h2>Privacy & your data</h2></div>
            <p class="small muted">Under the GDPR you have the right to access, rectify, export and delete your personal data (Art. 15–20 GDPR) and to withdraw consent at any time.</p>
            <div class="row">${STATIC ? '' : html`<a class="btn btn-ghost" href="/api/account/export" download>${icon('download', 16)} Export my data (JSON)</a>`}
              <button class="btn btn-ghost" data-action="cookie-settings">${icon('shield', 16)} Cookie settings</button></div>
            <hr class="sep">
            <form id="delete" novalidate><h3 style="color:var(--err)">Delete account</h3>
              <p class="small muted">This permanently deletes your profile, learning progress, saved courses and certificates and cancels an active subscription. Invoices are kept in anonymised form where the law requires it.</p>
              <label class="field" style="max-width:340px"><span>Confirm with your password</span><input type="password" name="password" required autocomplete="current-password"></label>
              <button class="btn btn-danger" type="submit">Delete my account</button></form>
          </div>`;
        default: return emptyState('Not found', 'This section does not exist.');
      }
    },
    mount(root, ctx) {
      const on = (sel, fn) => { const f = root.querySelector(sel); if (f) f.addEventListener('submit', async (e) => { e.preventDefault(); const b = f.querySelector('[type=submit]'); formError(f, ''); setBusy(b, true); try { await fn(f); } catch (err) { formError(f, err.message); } finally { setBusy(b, false); } }); };
      on('#profile', async (f) => { const r = await patch('/api/account/profile', formData(f)); state.user = r.user; emit(); toast('Profile saved.', 'success'); });
      on('#password', async (f) => { await post('/api/account/password', formData(f)); f.reset(); toast('Password changed.', 'success'); });
      on('#delete', async (f) => {
        if (!(await ask('Delete your account permanently? This cannot be undone.', { confirmLabel: 'Delete account', danger: true }))) return;
        await del('/api/account', formData(f));
        state.user = null; emit(); toast('Your account has been deleted.'); ctx.navigate('/');
      });
      root.querySelector('[data-cancel-sub]')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        if (!(await ask('Cancel your subscription at the end of the current period?', { confirmLabel: 'Cancel subscription' }))) return;
        setBusy(btn, true);
        try { const r = await post('/api/subscription/cancel'); toast(`Cancelled. Access until ${fmtDate(r.accessUntil)}.`, 'success'); ctx.navigate('/account/subscription', { replace: true }); }
        catch (err) { toast(err.message, 'error'); setBusy(btn, false); }
      });
    },
  };
}
