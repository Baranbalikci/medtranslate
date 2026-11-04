import { html, icon, courseCard, skeletonCards, emptyState, $, $$ } from '../ui.js';
import { state } from '../store.js';
import { get } from '../api.js';

const FILTERS = ['q', 'specialty', 'language', 'provider', 'duration', 'accreditation', 'level', 'since', 'access', 'sort'];

export default {
  title: (ctx) => (ctx.params.slug ? state.meta.specialties.find((s) => s.slug === ctx.params.slug)?.name || 'Courses' : 'Courses'),
  description: 'Browse multilingual CME/CPD courses by specialty, language, provider, duration and accreditation.',
  render(ctx) {
    const m = state.meta;
    const spec = ctx.params.slug ? m.specialties.find((s) => s.slug === ctx.params.slug) : null;
    const f = { ...ctx.query, ...(spec ? { specialty: spec.slug } : {}) };
    const opt = (v, label, cur) => html`<option value="${v}" ${String(cur ?? '') === String(v) ? 'selected' : ''}>${label}</option>`;
    const radios = (name, items) => html`<div class="radio-row">${items.map(([v, l]) => html`<label class="radio-chip"><input type="radio" name="${name}" value="${v}" ${String(f[name] ?? '') === v ? 'checked' : ''}><span>${l}</span></label>`)}</div>`;
    return html`
      <section class="page-head"><div class="container">
        <div class="crumbs"><a href="/">Home</a><span>/</span>${spec ? html`<a href="/specialties">Specialties</a><span>/</span><span>${spec.name}</span>` : html`<span>Courses</span>`}</div>
        <h1>${spec ? spec.name : 'Course catalogue'}</h1>
        <p class="lead">${spec ? spec.description : 'Licensed medical education with AI subtitles and AI audio. Filter by specialty, language, provider and more.'}</p>
      </div></section>
      <div class="container">
        <div class="catalog">
          <form class="filters" id="filters" role="search" aria-label="Course filters">
            <div class="search-box">${icon('search', 18)}<input type="search" name="q" placeholder="Search courses…" value="${f.q || ''}" aria-label="Search courses"></div>
            <div class="filter-group"><h4>Specialty</h4>
              <select name="specialty" class="input-sm" aria-label="Specialty">${opt('', 'All specialties', f.specialty)}${m.specialties.map((s) => opt(s.slug, `${s.name}${s.course_count ? ` (${s.course_count})` : ''}`, f.specialty))}</select></div>
            <div class="filter-group"><h4>Language</h4>
              <select name="language" class="input-sm" aria-label="Language">${opt('', 'Any language', f.language)}${m.languages.filter((l) => l.live).map((l) => opt(l.code, `${l.native} · ${l.name}`, f.language))}</select></div>
            <div class="filter-group"><h4>Original provider</h4>
              <select name="provider" class="input-sm" aria-label="Provider">${opt('', 'All providers', f.provider)}${m.providers.map((p) => opt(p.slug, p.name, f.provider))}</select></div>
            <div class="filter-group"><h4>Duration</h4>${radios('duration', [['', 'Any'], ['short', '< 15 min'], ['medium', '15–45 min'], ['long', '> 45 min']])}</div>
            <div class="filter-group"><h4>CME / CPD</h4>${radios('accreditation', [['', 'Any'], ['accredited', 'Accredited'], ['not_accredited', 'Not accredited']])}</div>
            <div class="filter-group"><h4>Level</h4>${radios('level', [['', 'Any'], ['foundation', 'Foundation'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']])}</div>
            <div class="filter-group"><h4>Published</h4>
              <select name="since" class="input-sm" aria-label="Published since">${opt('', 'Any time', f.since)}${[[30, 'Last 30 days'], [90, 'Last 3 months'], [365, 'Last 12 months']].map(([d, l]) => opt(new Date(Date.now() - d * 864e5).toISOString().slice(0, 10), l, f.since))}</select></div>
            <div class="filter-group"><h4>Access</h4>${radios('access', [['', 'All'], ['free', 'Free only']])}</div>
            <button type="button" class="btn btn-ghost btn-sm" data-reset>Reset filters</button>
          </form>
          <div>
            <div class="toolbar">
              <button type="button" class="btn btn-ghost btn-sm filter-toggle" aria-expanded="false" aria-controls="filters">${icon('settings', 16)} Filters</button>
              <span class="count" id="count" aria-live="polite"></span>
              <label class="row" style="gap:8px;margin-left:auto"><span class="small muted">Sort</span>
                <select name="sort" form="filters" class="input-sm" style="width:auto">
                  ${opt('newest', 'Newest', f.sort || 'newest')}${opt('oldest', 'Oldest', f.sort)}${opt('title', 'Title A–Z', f.sort)}${opt('languages', 'Most languages', f.sort)}${opt('duration', 'Shortest', f.sort)}
                </select></label>
            </div>
            <div class="active-filters" id="active"></div>
            <div id="results">${skeletonCards(6)}</div>
          </div>
        </div>
      </div>`;
  },
  mount(root, ctx) {
    const form = $('#filters', root);
    const spec = ctx.params.slug;
    let timer; let token = 0;

    const values = () => {
      const fd = new FormData(form);
      const v = {};
      for (const k of FILTERS) { const x = fd.get(k) ?? root.querySelector(`[name=${k}]`)?.value; if (x) v[k] = String(x); }
      return v;
    };
    async function load() {
      const v = values();
      const params = new URLSearchParams(v);
      const urlParams = new URLSearchParams(v);
      let base = '/courses';
      if (spec && v.specialty === spec) { base = `/specialties/${spec}`; urlParams.delete('specialty'); }
      const qs = urlParams.toString();
      history.replaceState({}, '', base + (qs ? `?${qs}` : ''));
      const my = ++token;
      const res = $('#results', root);
      res.style.opacity = '.6';
      try {
        const { courses, total } = await get(`/api/courses?${params}`);
        if (my !== token) return;
        $('#count', root).textContent = `${total} course${total === 1 ? '' : 's'}`;
        res.innerHTML = String(courses.length
          ? html`<div class="course-grid">${courses.map((c) => courseCard(c, state.meta.languages))}</div>`
          : emptyState('No courses match these filters', 'Try removing a filter or searching for a broader term. New languages and specialties are added regularly.', html`<button class="btn btn-ghost" data-reset>Reset filters</button>`));
        renderActive(v);
      } catch (e) {
        res.innerHTML = String(emptyState('Could not load courses', e.message, html`<button class="btn btn-ghost" data-retry>Try again</button>`));
      } finally { res.style.opacity = ''; }
    }
    const labels = {
      specialty: (v) => state.meta.specialties.find((s) => s.slug === v)?.name, language: (v) => state.meta.languages.find((l) => l.code === v)?.name,
      provider: (v) => state.meta.providers.find((p) => p.slug === v)?.name, duration: (v) => ({ short: '< 15 min', medium: '15–45 min', long: '> 45 min' })[v],
      accreditation: (v) => ({ accredited: 'Accredited', not_accredited: 'Not accredited' })[v], level: (v) => v[0].toUpperCase() + v.slice(1),
      since: (v) => `Since ${v}`, access: () => 'Free only', q: (v) => `“${v}”`,
    };
    function renderActive(v) {
      $('#active', root).innerHTML = String(html`${Object.entries(v).filter(([k]) => k !== 'sort').map(([k, x]) => html`<button class="chip-x" data-clear="${k}" aria-label="Remove filter">${labels[k]?.(x) || x} ${icon('close', 14)}</button>`)}`);
    }
    form.addEventListener('submit', (e) => { e.preventDefault(); load(); });
    form.addEventListener('change', load);
    root.querySelector('[name=sort]').addEventListener('change', load);
    form.addEventListener('input', (e) => { if (e.target.name === 'q') { clearTimeout(timer); timer = setTimeout(load, 280); } });
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-reset]')) { form.reset(); $$('input[type=radio][value=""]', form).forEach((r) => { r.checked = true; }); $$('select', form).forEach((s) => { s.value = ''; }); form.q.value = ''; load(); }
      if (e.target.closest('[data-retry]')) load();
      const c = e.target.closest('[data-clear]');
      if (c) {
        const k = c.dataset.clear; const field = form.elements[k];
        if (field instanceof RadioNodeList) { [...field].forEach((r) => { r.checked = r.value === ''; }); } else if (field) field.value = '';
        load();
      }
      const t = e.target.closest('.filter-toggle');
      if (t) { const open = form.classList.toggle('open'); t.setAttribute('aria-expanded', String(open)); }
    });
    load();
    return () => clearTimeout(timer);
  },
};
