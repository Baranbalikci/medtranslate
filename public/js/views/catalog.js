import { html, icon, courseCard, courseRow, emptyState, toast, $, $$ } from '../ui.js';
import { state, prefs } from '../store.js';
import { get } from '../api.js';
import { setUrl } from '../nav.js';
import { specIcon } from './home.js';

const FILTERS = ['q', 'specialty', 'language', 'provider', 'duration', 'accreditation', 'level', 'since', 'access', 'sort'];
const sinceOpts = [[30, 'Last 30 days'], [90, 'Last 3 months'], [365, 'Last 12 months']];

export default {
  title: (ctx) => (ctx.params.slug ? state.meta.specialties.find((s) => s.slug === ctx.params.slug)?.name || 'Courses' : 'Courses'),
  description: 'Browse multilingual CME/CPD courses by specialty, language, provider, duration and accreditation.',
  render(ctx) {
    const m = state.meta;
    const f = { ...ctx.query, ...(ctx.params.slug ? { specialty: ctx.params.slug } : {}) };
    const spec = m.specialties.find((s) => s.slug === f.specialty);
    const total = m.specialties.reduce((n, s) => n + s.course_count, 0);
    const opt = (v, label, cur) => html`<option value="${v}" ${String(cur ?? '') === String(v) ? 'selected' : ''}>${label}</option>`;
    const pill = (name, label, ic, options, cur) => html`<label class="fpill ${cur ? 'set' : ''}"><span class="fp-l">${icon(ic, 14)} ${label}</span>
      <select name="${name}" aria-label="${label}">${options.map(([v, t]) => opt(v, t, cur))}</select>${icon('chevron', 14)}</label>`;
    return html`
      <section class="cat-hero">
        <div class="cat-aurora" aria-hidden="true"></div>
        <div class="container">
          <div class="crumbs"><a href="/">Home</a><span>/</span><a href="/specialties">Specialties</a>${spec ? html`<span>/</span><span>${spec.name}</span>` : ''}</div>
          <div class="cat-title">
            <div>
              <h1 id="cat-h1">${spec ? spec.name : 'Course catalogue'}</h1>
              <p class="lead" id="cat-lead">${spec ? spec.description : 'Licensed medical education with AI subtitles and AI voice. Find the right course by specialty, language and level.'}</p>
            </div>
            <label class="cat-search">${icon('search', 18)}<input type="search" name="q" form="filters" placeholder="Search title, topic, provider…" value="${f.q || ''}" aria-label="Search courses" autocomplete="off"><kbd>/</kbd></label>
          </div>
          <div class="spec-rail" role="tablist" aria-label="Medical specialty">
            <button type="button" role="tab" class="sr-chip ${!spec ? 'on' : ''}" data-spec="" aria-selected="${!spec}">${icon('layers', 16)}<b>All</b><i>${total}</i></button>
            ${m.specialties.filter((s) => s.course_count).map((s) => html`<button type="button" role="tab" class="sr-chip ${spec?.slug === s.slug ? 'on' : ''}" data-spec="${s.slug}" aria-selected="${spec?.slug === s.slug}">${specIcon(s.icon)}<b>${s.name}</b><i>${s.course_count}</i></button>`)}
          </div>
        </div>
      </section>
      <div class="container">
        <form id="filters" class="cat-bar" role="search" aria-label="Course filters">
          <input type="hidden" name="specialty" value="${f.specialty || ''}">
          ${pill('language', 'Language', 'globe', [['', 'Any'], ...m.languages.filter((l) => l.live).map((l) => [l.code, l.native])], f.language)}
          ${pill('duration', 'Length', 'clock', [['', 'Any'], ['short', 'Under 15 min'], ['medium', '15–45 min'], ['long', 'Over 45 min']], f.duration)}
          ${pill('level', 'Level', 'layers', [['', 'Any'], ['foundation', 'Foundation'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']], f.level)}
          ${pill('accreditation', 'CME / CPD', 'award', [['', 'Any'], ['accredited', 'Accredited'], ['not_accredited', 'Not accredited']], f.accreditation)}
          ${pill('provider', 'Provider', 'building', [['', 'Any'], ...m.providers.map((p) => [p.slug, p.name.replace(' (Demo)', '')])], f.provider)}
          ${pill('since', 'Published', 'calendar', [['', 'Any time'], ...sinceOpts.map(([d, l]) => [new Date(Date.now() - d * 864e5).toISOString().slice(0, 10), l])], f.since)}
          <label class="fpill toggle ${f.access === 'free' ? 'set' : ''}"><input type="checkbox" name="access" value="free" ${f.access === 'free' ? 'checked' : ''}><span class="fp-l">${icon('check', 14)} Free only</span></label>
          <button type="button" class="link-btn xs" data-reset hidden>Reset all</button>
        </form>
        <div class="cat-tools">
          <span class="count" id="count" aria-live="polite"></span>
          <div class="row" style="gap:10px">
            <label class="sortbox"><span class="sr-only">Sort</span>
              <select name="sort" form="filters" aria-label="Sort by">${opt('newest', 'Newest first', f.sort || 'newest')}${opt('oldest', 'Oldest first', f.sort)}${opt('title', 'Title A–Z', f.sort)}${opt('languages', 'Most languages', f.sort)}${opt('duration', 'Shortest first', f.sort)}</select></label>
            <div class="viewtoggle" role="group" aria-label="View">
              <button type="button" data-view="grid" aria-pressed="true" aria-label="Grid view">${icon('grid', 17)}</button>
              <button type="button" data-view="list" aria-pressed="false" aria-label="List view">${icon('list', 17)}</button>
            </div>
          </div>
        </div>
        <div class="active-filters" id="active"></div>
        <div id="results" class="cat-results" data-view="grid"><div class="course-grid">${Array.from({ length: 6 }, () => html`<div class="course-card skeleton"><div class="course-thumb"></div><div class="course-body"><div class="sk-line w40"></div><div class="sk-line w90"></div><div class="sk-line w70"></div></div></div>`)}</div></div>
      </div>`;
  },
  mount(root, ctx) {
    const m = state.meta;
    const form = $('#filters', root);
    const results = $('#results', root);
    let timer; let token = 0;
    let view = prefs.get('catView', 'grid');
    const setView = (v) => {
      view = v; prefs.set('catView', v);
      $$('[data-view]', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
      results.dataset.view = v;
    };

    const values = () => {
      const v = {};
      for (const k of FILTERS) {
        const el = k === 'q' ? $('[name=q]', root) : k === 'sort' ? $('[name=sort]', root) : form.elements[k];
        if (!el) continue;
        const x = el.type === 'checkbox' ? (el.checked ? el.value : '') : el.value;
        if (x) v[k] = String(x);
      }
      return v;
    };

    const labels = {
      language: (v) => m.languages.find((l) => l.code === v)?.native, provider: (v) => m.providers.find((p) => p.slug === v)?.name.replace(' (Demo)', ''),
      duration: (v) => ({ short: 'Under 15 min', medium: '15–45 min', long: 'Over 45 min' })[v], accreditation: (v) => ({ accredited: 'Accredited', not_accredited: 'Not accredited' })[v],
      level: (v) => v[0].toUpperCase() + v.slice(1), since: (v) => `Since ${v}`, access: () => 'Free only', q: (v) => `“${v}”`,
    };

    function paintHero(slug) {
      const s = m.specialties.find((x) => x.slug === slug);
      $('#cat-h1', root).textContent = s ? s.name : 'Course catalogue';
      $('#cat-lead', root).textContent = s ? s.description : 'Licensed medical education with AI subtitles and AI voice. Find the right course by specialty, language and level.';
      $$('.sr-chip', root).forEach((c) => { const on = (c.dataset.spec || '') === (slug || ''); c.classList.toggle('on', on); c.setAttribute('aria-selected', String(on)); });
      document.title = `${s ? s.name : 'Courses'} · MedTranslate`;
    }

    async function load() {
      const v = values();
      const base = v.specialty ? `/specialties/${v.specialty}` : '/courses';
      const urlQ = new URLSearchParams(v); urlQ.delete('specialty');
      setUrl(base + (urlQ.toString() ? `?${urlQ}` : ''), true);
      const my = ++token;
      results.style.opacity = '.55';
      try {
        const { courses, total } = await get(`/api/courses?${new URLSearchParams(v)}`);
        if (my !== token) return;
        $('#count', root).innerHTML = `<b>${total}</b> course${total === 1 ? '' : 's'}${v.q ? ` for “${v.q.replace(/[<>&]/g, '')}”` : ''}`;
        results.innerHTML = String(courses.length
          ? (view === 'list' ? html`<div class="course-rows">${courses.map((c) => courseRow(c, m.languages))}</div>` : html`<div class="course-grid">${courses.map((c) => courseCard(c, m.languages))}</div>`)
          : emptyState('No courses match these filters', 'Try removing a filter or searching for a broader term. New languages and specialties are added regularly.', html`<button class="btn btn-ghost" data-reset>Reset filters</button>`));
        const active = Object.entries(v).filter(([k]) => !['sort', 'specialty'].includes(k));
        $('#active', root).innerHTML = String(html`${active.map(([k, x]) => html`<button class="chip-x" data-clear="${k}" aria-label="Remove filter">${labels[k]?.(x) || x} ${icon('close', 14)}</button>`)}`);
        $('[data-reset]', form).hidden = !active.length;
        $$('.fpill', form).forEach((p) => { const el = p.querySelector('select,input'); p.classList.toggle('set', el.type === 'checkbox' ? el.checked : !!el.value); });
      } catch (e) {
        results.innerHTML = String(emptyState('Could not load courses', e.message, html`<button class="btn btn-ghost" data-retry>Try again</button>`));
      } finally { results.style.opacity = ''; }
    }

    setView(view);
    form.addEventListener('submit', (e) => { e.preventDefault(); load(); });
    form.addEventListener('change', load);
    $('[name=sort]', root).addEventListener('change', load);
    $('[name=q]', root).addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 260); });
    const slash = (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); $('[name=q]', root).focus(); } };
    document.addEventListener('keydown', slash);

    root.addEventListener('click', (e) => {
      const sp = e.target.closest('[data-spec]');
      if (sp) { form.elements.specialty.value = sp.dataset.spec; paintHero(sp.dataset.spec); load(); sp.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); return; }
      const vw = e.target.closest('[data-view]');
      if (vw) { setView(vw.dataset.view); load(); return; }
      if (e.target.closest('[data-reset]')) {
        $$('select', form).forEach((s) => { s.value = ''; }); form.elements.access.checked = false; $('[name=q]', root).value = ''; load(); return;
      }
      if (e.target.closest('[data-retry]')) { load(); return; }
      const c = e.target.closest('[data-clear]');
      if (c) {
        const k = c.dataset.clear;
        if (k === 'q') $('[name=q]', root).value = ''; else if (k === 'access') form.elements.access.checked = false; else if (form.elements[k]) form.elements[k].value = '';
        load();
      }
    });
    load();
    return () => { clearTimeout(timer); document.removeEventListener('keydown', slash); };
  },
};
