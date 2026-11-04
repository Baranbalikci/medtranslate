import { html, icon, esc, fmtDuration, fmtTime, fmtDate, fmtMoney, levelLabel, courseCard, accreditationBadge, toast, $, $$ } from '../ui.js';
import { state, langInfo } from '../store.js';
import { get, post } from '../api.js';
import { createPlayer } from '../player.js';

const reviewLabel = { source: 'Original', medically_reviewed: 'AI · medically reviewed', demo_unreviewed: 'AI · demo, not reviewed', unreviewed: 'AI · not reviewed' };

export default function courseView() {
  let course = null; let player = null;
  return {
    title: () => course?.title || 'Course',
    description: () => course?.description,
    async render(ctx) {
      course = await get(`/api/courses/${encodeURIComponent(ctx.params.slug)}`);
      const c = course; const u = state.user;
      const ent = c.entitlement;
      const original = c.tracks.find((t) => t.original);
      return html`
      <section class="course-hero">
        <div class="container">
          <div class="crumbs"><a href="/courses">Courses</a><span>/</span>${c.specialty ? html`<a href="/specialties/${c.specialty.slug}">${c.specialty.name}</a>` : ''}</div>
          <div class="course-layout">
            <div>
              <div id="player-host"><div class="player"><div class="p-loading"><span class="spinner"></span></div></div></div>
              <h1>${c.title}</h1>
              <p class="course-sub">${c.description}</p>
              <div class="meta-row">
                <span>${icon('building', 15)} ${c.provider.name}</span>
                <span>${icon('clock', 15)} ${fmtDuration(c.durationSec)}</span>
                <span>${icon('layers', 15)} ${levelLabel[c.level]}</span>
                <span>${icon('globe', 15)} ${c.languages.length} language${c.languages.length > 1 ? 's' : ''}</span>
                <span>Published ${fmtDate(c.releaseDate)}</span>
              </div>
            </div>
            <aside class="course-side">
              <div class="side-card">
                ${ent.full ? html`<div class="row between"><span class="badge badge-ok">${icon('check', 14)} ${ent.reason === 'free' ? 'Free course' : ent.reason === 'purchase' ? 'Purchased' : ent.reason === 'staff' ? 'Staff access' : 'Included in your plan'}</span>
                    ${c.progress ? html`<span class="small muted">${Math.round(c.progress.percent * 100)}% watched</span>` : ''}</div>
                    ${c.progress ? html`<div class="progress" style="margin-top:12px"><i style="width:${Math.round(c.progress.percent * 100)}%"></i></div>` : ''}
                    ${c.progress?.completedAt ? html`<p class="small" style="margin:12px 0 0;color:var(--ok)">${icon('award', 14)} Completed on ${fmtDate(c.progress.completedAt)}</p>` : ''}`
                  : html`<h3>Watch the full course</h3><p class="small muted">You're watching a preview. ${ent.reason === 'login_required' ? 'Sign in and choose a plan to continue.' : 'Subscribe or buy this course to continue.'}</p>
                    ${u ? html`<a class="btn btn-primary btn-block" href="/pricing">Subscribe — all courses</a>
                      ${c.priceCents ? html`<a class="btn btn-ghost btn-block" style="margin-top:8px" href="/checkout?course=${c.slug}">Buy this course · ${fmtMoney(c.priceCents)}</a>` : ''}`
                    : html`<a class="btn btn-primary btn-block" href="/register?next=/courses/${c.slug}">Create free account</a><a class="btn btn-ghost btn-block" style="margin-top:8px" href="/login?next=/courses/${c.slug}">Sign in</a>`}`}
                <div class="row" style="margin-top:14px;gap:8px">
                  <button class="btn btn-ghost btn-sm" data-save aria-pressed="${!!c.saved}">${icon(c.saved ? 'bookmarkFill' : 'bookmark', 16)} <span>${c.saved ? 'Saved' : 'Save'}</span></button>
                  <a class="btn btn-ghost btn-sm" href="/legal/meldung?type=translation_error&course=${c.slug}">${icon('alert', 16)} Report an error</a>
                </div>
              </div>
              <div class="side-card">
                <h3>Languages</h3>
                <dl class="kv" style="grid-template-columns:1fr auto">
                  ${c.tracks.map((t) => html`<dt>${langInfo(t.language)?.native || t.language}${t.audio !== 'none' ? html` <span title="Audio available" style="color:var(--cyan-600)">${icon('volume', 13)}</span>` : ''}</dt>
                    <dd><span class="badge ${t.original ? 'badge-neutral' : t.review === 'medically_reviewed' ? 'badge-ok' : 'badge-warn'}">${reviewLabel[t.review]}</span></dd>`)}
                </dl>
                <div class="ai-note warn" style="margin-top:14px">${icon('sparkles', 16)}<span>Translations and AI voices are machine-generated (EU AI Act transparency). ${c.isDemo ? 'Demo translations have not been reviewed by a medical professional.' : ''} The original ${langInfo(original.language)?.name} version is authoritative. <a href="/legal/ki-transparenz">Learn more</a></span></div>
              </div>
              <div class="side-card">
                <h3>CME / CPD</h3>
                ${accreditationBadge(c.accreditation)}
                <p class="small muted" style="margin:12px 0 0">${c.accreditation.status === 'accredited'
                  ? html`Accredited by ${c.accreditation.body} (ref. ${c.accreditation.reference}), valid until ${fmtDate(c.accreditation.validUntil)}${c.accreditation.languages?.length ? html` for: ${c.accreditation.languages.map((l) => langInfo(l)?.name).join(', ')}` : ''}. Credit recognition in other countries is not implied.`
                  : 'This course does not award CME/CPD credits. Completing it gives you a completion record only.'} <a href="/legal/cme-akkreditierung">How accreditation works</a></p>
              </div>
              <div class="side-card">
                <h3>Source & licence</h3>
                <dl class="kv">
                  <dt>Original provider</dt><dd>${c.provider.name}</dd>
                  <dt>Original language</dt><dd>${langInfo(c.originalLanguage)?.name}</dd>
                  <dt>Territory</dt><dd>${c.territory[0] === '*' ? 'Worldwide' : c.territory.join(', ')}</dd>
                  <dt>Licence</dt><dd>${c.licenseSummary?.isDemo ? 'Demo record' : 'On file'}</dd>
                </dl>
                ${c.isDemo ? html`<p class="xs muted" style="margin:12px 0 0">Demo content: fictional provider, synthetic video, no real licence agreement.</p>` : ''}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section class="section-sm">
        <div class="container course-layout">
          <div>
            <div class="tabs" role="tablist">
              <button class="tab active" role="tab" aria-selected="true" data-tab="overview">Overview</button>
              <button class="tab" role="tab" aria-selected="false" data-tab="transcript">Transcript</button>
              <button class="tab" role="tab" aria-selected="false" data-tab="chapters">Chapters <span class="n">${c.chapters.length}</span></button>
            </div>
            <div data-panel="overview">
              <h2 class="h3">What you'll learn</h2>
              <ul class="objectives">${c.objectives.map((o) => html`<li>${icon('check', 18)}<span>${o}</span></li>`)}</ul>
              ${c.speakers.length ? html`<h2 class="h3" style="margin-top:32px">Speakers</h2><p class="muted">${c.speakers.join(' · ')} <span class="xs">(generic roles in demo content)</span></p>` : ''}
              <div class="notice" style="margin-top:28px">${icon('info', 18)}<span>Educational content for healthcare professionals. It does not replace clinical judgement, local protocols or current guidelines. See the <a href="/legal/haftungsausschluss">medical disclaimer</a>.</span></div>
            </div>
            <div data-panel="transcript" hidden>
              <p class="small muted" id="transcript-note"></p>
              <div class="transcript" id="transcript"></div>
            </div>
            <div data-panel="chapters" hidden>
              <ul class="chapters" id="chapters">${c.chapters.map((ch) => html`<li><button data-seek="${ch.start}"><span class="t">${fmtTime(ch.start)}</span>${ch.title}</button></li>`)}</ul>
            </div>
          </div>
          <aside>
            ${c.related.length ? html`<h3 style="font-size:1rem">Related courses</h3><div class="course-grid" style="grid-template-columns:1fr">${c.related.slice(0, 2).map((r) => courseCard(r, state.meta.languages))}</div>` : ''}
          </aside>
        </div>
      </section>`;
    },
    mount(root) {
      const c = course;
      let cues = [];
      let currentIdx = -1;
      const transcript = $('#transcript', root);
      player = createPlayer($('#player-host', root), {
        slug: c.slug, title: c.title, chapters: c.chapters,
        onCuesChange(lang, list, track) {
          cues = list || [];
          const info = langInfo(lang);
          $('#transcript-note', root).textContent = `${info?.name || lang} · ${reviewLabel[track?.review] || ''}`;
          transcript.dir = info?.dir || 'ltr';
          transcript.innerHTML = String(html`${cues.map((q, i) => html`<button data-seek="${q.start}" data-i="${i}"><span class="t">${fmtTime(q.start)}</span><span>${q.speaker ? html`<span class="who">${q.speaker}</span>` : ''}${q.text}</span></button>`)}`);
          currentIdx = -1;
        },
        onTime(t) {
          const i = cues.findIndex((q) => t >= q.start && t < q.end);
          if (i !== currentIdx) {
            currentIdx = i;
            $$('#transcript button', root).forEach((b) => b.classList.toggle('current', Number(b.dataset.i) === i));
            const chs = $$('#chapters button', root);
            let ci = -1; c.chapters.forEach((ch, k) => { if (t >= ch.start) ci = k; });
            chs.forEach((b, k) => b.classList.toggle('current', k === ci));
          }
        },
        onProgress(r) { if (r.certificate && !c._certShown) { c._certShown = true; toast('Course completed — your completion record is in your account.', 'success', 6000); } },
      });

      root.addEventListener('click', async (e) => {
        const seek = e.target.closest('[data-seek]');
        if (seek) { player.seek(Number(seek.dataset.seek)); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        const tab = e.target.closest('[data-tab]');
        if (tab) {
          $$('[data-tab]', root).forEach((t) => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', String(t === tab)); });
          $$('[data-panel]', root).forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
        }
        const save = e.target.closest('[data-save]');
        if (save) {
          if (!state.user) { toast('Sign in to save courses.'); return; }
          try {
            const { saved } = await post(`/api/courses/${c.slug}/save`);
            save.setAttribute('aria-pressed', String(saved));
            save.innerHTML = `${icon(saved ? 'bookmarkFill' : 'bookmark', 16)} <span>${saved ? 'Saved' : 'Save'}</span>`;
            toast(saved ? 'Saved to your list.' : 'Removed from your list.', 'success');
          } catch (err) { toast(err.message, 'error'); }
        }
      });
      return () => player?.destroy();
    },
  };
}

export { esc };
