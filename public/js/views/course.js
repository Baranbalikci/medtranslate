import { html, icon, esc, fmtDuration, fmtTime, fmtDate, fmtMoney, levelLabel, courseCard, accreditationBadge, toast, $, $$ } from '../ui.js';
import { state, langInfo, prefs } from '../store.js';
import { get, post } from '../api.js';
import { createPlayer } from '../player.js';

const reviewLabel = { source: 'Original', medically_reviewed: 'AI · medically reviewed', demo_unreviewed: 'AI · demo, not reviewed', unreviewed: 'AI · not reviewed', live_unreviewed: 'LIVE AI · not reviewed' };

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
      const voiced = c.tracks.filter((t) => t.audio === 'file' || t.original).length;
      return html`
      <section class="course-hero">
        <div class="container wide">
          <div class="crumbs"><a href="/courses">Courses</a><span>/</span>${c.topic ? html`<a href="/topics/${c.topic.slug}">${c.topic.name}</a>` : c.specialty ? html`<a href="/specialties/${c.specialty.slug}">${c.specialty.name}</a>` : ''}</div>
          <div class="watch">
            <div class="watch-main" id="player-host"><div class="player"><div class="p-loading"><span class="spinner"></span></div></div></div>
            <aside class="transcript-panel" aria-label="Transcript">
              <div class="tp-head">
                <div class="tp-title">${icon('file', 16)} <b>Transcript</b><span class="tp-status" id="tp-status"></span></div>
                <div class="tp-controls">
                  <select id="tp-lang" aria-label="Transcript language"><option>Loading…</option></select>
                  <label class="tp-switch" title="Show the original sentence under each translated line"><input type="checkbox" id="tp-bi"> <span>Bilingual</span></label>
                </div>
              </div>
              <div class="tp-body" id="transcript" tabindex="0" aria-live="off"><p class="muted small" style="padding:16px">Loading transcript…</p></div>
              <div class="tp-foot"><label class="tp-switch"><input type="checkbox" id="tp-follow" checked> <span>Follow video</span></label><span class="xs" id="tp-note"></span></div>
            </aside>
          </div>
          <div class="watch-info">
            <h1>${c.title}</h1>
            <p class="course-sub">${c.description}</p>
            <div class="meta-row">
              <span>${icon('building', 15)} ${c.provider.name}</span>
              <span>${icon('clock', 15)} ${fmtDuration(c.durationSec)}</span>
              <span>${icon('layers', 15)} ${levelLabel[c.level]}</span>
              <span>${icon('volume', 15)} ${voiced} voices</span>
              <span>${icon('globe', 15)} ${c.liveAi?.allowed ? `${state.meta.languages.length} languages (incl. live AI)` : `${c.languages.length} languages`}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="section-sm">
        <div class="container wide course-layout">
          <div>
            <div class="tabs" role="tablist">
              <button class="tab active" role="tab" aria-selected="true" data-tab="overview">Overview</button>
              <button class="tab" role="tab" aria-selected="false" data-tab="chapters">Chapters <span class="n">${c.chapters.length}</span></button>
            </div>
            <div data-panel="overview">
              <h2 class="h3">What you'll learn</h2>
              <ul class="objectives">${c.objectives.map((o) => html`<li>${icon('check', 18)}<span>${o}</span></li>`)}</ul>
              ${c.speakers.length ? html`<h2 class="h3" style="margin-top:32px">Speakers</h2><p class="muted">${c.speakers.join(' · ')} <span class="xs">(generic roles in demo content)</span></p>` : ''}
              <div class="notice" style="margin-top:28px">${icon('info', 18)}<span>Educational content for healthcare professionals. It does not replace clinical judgement, local protocols or current guidelines. See the <a href="/legal/haftungsausschluss">medical disclaimer</a>.</span></div>
            </div>
            <div data-panel="chapters" hidden>
              <ul class="chapters" id="chapters">${c.chapters.map((ch) => html`<li><button data-seek="${ch.start}"><span class="t">${fmtTime(ch.start)}</span>${ch.title}</button></li>`)}</ul>
            </div>
            ${c.related.length ? html`<h3 style="font-size:1rem;margin-top:40px">Related courses</h3><div class="course-grid">${c.related.slice(0, 3).map((r) => courseCard(r, state.meta.languages))}</div>` : ''}
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
              <p class="small muted" style="margin-top:-4px">${voiced} with AI voice · ${c.tracks.length} with reviewed-workflow subtitles${c.liveAi?.allowed ? ' · every other language via live AI' : ''}.</p>
              <div class="lang-cloud-sm">${c.tracks.map((t) => html`<span class="lchip ${t.original ? 'orig' : t.audio === 'file' ? 'voice' : ''}" title="${reviewLabel[t.review]}">${t.audio === 'file' || t.original ? icon('volume', 11) : ''}${langInfo(t.language)?.native || t.language}</span>`)}</div>
              <div class="ai-note warn" style="margin-top:14px">${icon('sparkles', 16)}<span>Translations and AI voices are machine-generated (EU AI Act transparency). ${c.isDemo ? 'Demo translations have not been reviewed by a medical professional.' : ''} The original ${langInfo(original.language)?.name} version is authoritative. <a href="/legal/ki-transparenz">Learn more</a></span></div>
            </div>
            <div class="side-card">
              <h3>CME / CPD</h3>
              ${accreditationBadge(c.accreditation)}
              <p class="small muted" style="margin:12px 0 0">${c.accreditation.status === 'accredited'
                ? html`Accredited by ${c.accreditation.body} (ref. ${c.accreditation.reference}), valid until ${fmtDate(c.accreditation.validUntil)}. Credit recognition in other countries is not implied.`
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
      </section>`;
    },
    mount(root) {
      const c = course;
      const T = { lang: null, manual: false, cues: [], orig: [], current: -1, unsub: null, unsubOrig: null, follow: true, bilingual: prefs.get('tpBilingual', false) };
      const body = $('#transcript', root); const sel = $('#tp-lang', root); const statusEl = $('#tp-status', root);
      $('#tp-bi', root).checked = T.bilingual;

      function fillSelect() {
        const langs = state.meta.languages;
        const st = (code) => player.langStatus(code);
        const ready = langs.filter((l) => st(l.code) && st(l.code).kind !== 'live');
        const live = langs.filter((l) => st(l.code)?.kind === 'live');
        const you = player.quickLanguages().map((c) => langs.find((l) => l.code === c)).filter(Boolean);
        sel.innerHTML = String(html`${you.length ? html`<optgroup label="For you">${you.map((l) => html`<option value="${l.code}">${l.native} · ${l.name}</option>`)}</optgroup>` : ''}<optgroup label="Ready">${ready.map((l) => html`<option value="${l.code}">${l.native} · ${l.name}</option>`)}</optgroup>
          ${state.meta.regions.map((r) => { const list = live.filter((l) => l.region === r.code); return list.length ? html`<optgroup label="${r.name} · live AI">${list.map((l) => html`<option value="${l.code}">${l.native} · ${l.name} ⚡</option>`)}</optgroup>` : ''; })}`);
        sel.value = T.lang;
      }

      function draw() {
        const info = langInfo(T.lang); const showOrig = T.bilingual && T.lang !== player.originalLanguage;
        body.dir = 'ltr';
        body.innerHTML = T.cues.length ? String(html`${T.cues.map((q, i) => html`<button class="tl" data-seek="${q.start}" data-i="${i}">
            <span class="t">${fmtTime(q.start)}</span>
            <span class="tx">${q.speaker ? html`<span class="who">${q.speaker}</span>` : ''}
              <span class="line ${q.text ? '' : 'pending'}" dir="${info?.dir || 'ltr'}" lang="${T.lang}">${q.text || 'Translating…'}</span>
              ${showOrig && T.orig[i] ? html`<span class="orig" lang="${player.originalLanguage}">${T.orig[i].text}</span>` : ''}</span></button>`)}
          ${T.truncated ? html`<p class="tp-more">${icon('lock', 14)} The rest of the transcript is available with full access.</p>` : ''}`)
          : '<p class="muted small" style="padding:16px">No transcript available.</p>';
        T.current = -1;
        highlight(player.video?.currentTime || 0);
      }

      async function setTranscriptLang(lang, manual) {
        if (manual) T.manual = true;
        T.unsub?.(); T.unsub = null;
        const prev = T.lang;
        T.lang = lang; sel.value = lang;
        try {
          T.unsub = await player.getCues(lang, (cues, e) => {
            T.cues = cues; T.truncated = c.entitlement && !c.entitlement.full;
            statusEl.textContent = e.live ? (e.status === 'translating' ? ` · live AI ${e.done}/${e.total}` : e.status === 'error' ? ' · interrupted' : ' · live AI') : '';
            $('#tp-note', root).textContent = e.live ? 'Live AI translation · not reviewed' : (reviewLabel[player.langStatus(lang)?.review] || '');
            if (e.error) $('#tp-note', root).textContent = e.error;
            draw();
          });
        } catch (err) {
          if (err.code === 'cancelled') { T.lang = prev; sel.value = prev; return; }
          toast(err.message, 'error');
        }
      }

      function highlight(t) {
        const i = T.cues.findIndex((q) => t >= q.start && t < q.end);
        if (i === T.current) return;
        T.current = i;
        $$('.tl', body).forEach((b) => b.classList.toggle('current', Number(b.dataset.i) === i));
        const cur = body.querySelector('.tl.current');
        if (cur && T.follow) body.scrollTo({ top: cur.offsetTop - body.clientHeight / 3, behavior: 'smooth' });
        let ci = -1; c.chapters.forEach((ch, k) => { if (t >= ch.start) ci = k; });
        $$('#chapters button', root).forEach((b, k) => b.classList.toggle('current', k === ci));
      }

      player = createPlayer($('#player-host', root), {
        slug: c.slug, title: c.title, chapters: c.chapters, liveAi: c.liveAi,
        async onLanguage(lang) {
          if (!T.lang) {
            // First call: player is ready.
            fillSelect();
            T.unsubOrig = await player.getCues(player.originalLanguage, (cues) => { T.orig = cues; if (T.bilingual) draw(); });
          }
          if (!T.manual || !T.lang) await setTranscriptLang(lang, false);
          fillSelect();
        },
        onTime: highlight,
        onProgress(r) { if (r.certificate && !c._certShown) { c._certShown = true; toast('Course completed — your completion record is in your account.', 'success', 6000); } },
      });

      sel.addEventListener('change', () => setTranscriptLang(sel.value, true));
      $('#tp-bi', root).addEventListener('change', (e) => { T.bilingual = e.target.checked; prefs.set('tpBilingual', T.bilingual); draw(); });
      $('#tp-follow', root).addEventListener('change', (e) => { T.follow = e.target.checked; });

      root.addEventListener('click', async (e) => {
        const seek = e.target.closest('[data-seek]');
        if (seek) { player.seek(Number(seek.dataset.seek)); if (!seek.closest('.transcript-panel')) window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
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
      return () => { T.unsub?.(); T.unsubOrig?.(); player?.destroy(); };
    },
  };
}

export { esc };
