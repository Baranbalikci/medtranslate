import { html, icon, fmtDate, fmtDuration } from '../ui.js';
import { get } from '../api.js';
import { langInfo } from '../store.js';

export default {
  title: 'Certificate',
  async render(ctx) {
    const c = await get(`/api/certificates/${encodeURIComponent(ctx.params.id)}`);
    const cme = c.kind === 'cme';
    return html`<section class="section-sm"><div class="container narrow">
      <div class="row between no-print" style="margin-bottom:20px"><a href="/account/certificates">${icon('arrow', 14)} Back to certificates</a><button class="btn btn-ghost btn-sm print-btn" onclick="window.print()">${icon('download', 15)} Print / save as PDF</button></div>
      <div class="certificate">
        <span class="eyebrow">${cme ? 'CME/CPD certificate' : 'Record of completion'}</span>
        <h1 style="margin-top:12px">${c.holder}</h1>
        <p class="lead">has completed the online course</p>
        <h2 class="h3" style="font-size:1.6rem">${c.course}</h2>
        <dl class="kv" style="max-width:520px;margin-top:28px">
          <dt>Original provider</dt><dd>${c.provider}</dd>
          <dt>Duration</dt><dd>${fmtDuration(c.durationSec)}</dd>
          <dt>Language used</dt><dd>${langInfo(c.language)?.name || '—'}</dd>
          <dt>Date</dt><dd>${fmtDate(c.issuedAt)}</dd>
          <dt>Certificate ID</dt><dd class="mono">${c.id}</dd>
          ${cme ? html`<dt>Credits</dt><dd>${c.credits} ${c.creditType}</dd><dt>Accrediting body</dt><dd>${c.body}</dd>` : ''}
        </dl>
        <p class="small muted" style="margin-top:28px">${cme
          ? 'Credits are awarded under the accreditation stated above. Recognition in other jurisdictions depends on the rules of the respective body.'
          : 'This record confirms completion only. It is not a CME/CPD certificate and does not award credits.'}
          ${c.language ? ' The course may have been viewed with AI-generated subtitles or audio.' : ''}</p>
        <p class="xs muted">Issued by MedTranslate · Verify at ${location.origin}/certificates/${c.id}</p>
      </div></div></section>`;
  },
};
