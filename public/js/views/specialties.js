import { html, icon, $ } from '../ui.js';
import { state } from '../store.js';
import { get } from '../api.js';
import { specIcon } from './home.js';

export default {
  title: () => (state.meta.focus ? 'Emergency medicine topics' : 'Medical Specialties'),
  description: 'Browse multilingual emergency medicine education by topic.',
  render() {
    const m = state.meta; const focus = m.focus;
    const list = focus ? m.specialties.filter((s) => s.course_count && s.slug !== focus.slug) : m.specialties;
    return html`
    <section class="page-head"><div class="container">
      <div class="crumbs"><a href="/">Home</a><span>/</span><span>${focus ? 'Topics' : 'Specialties'}</span></div>
      <h1>${focus ? 'Emergency medicine topics' : 'Medical specialties'}</h1>
      <p class="lead">${focus ? 'Every course is filed under emergency medicine and tagged with the field it draws on. More specialties follow once the launch focus widens.' : 'From emergency medicine to ophthalmology — explore licensed courses in your field. New specialties are added as partner catalogues grow.'}</p>
    </div></section>
    <section class="section-sm"><div class="container">
      <div class="grid-3">
        ${list.map((s) => html`<a class="spec-card" href="/specialties/${s.slug}" data-topic="${s.slug}">
          <span class="ic">${specIcon(s.icon)}</span><h3>${s.name}</h3><p>${s.description}</p>
          <span class="topic-thumbs" aria-hidden="true"></span>
          <span class="row between small"><span class="muted">${s.course_count ? `${s.course_count} course${s.course_count > 1 ? 's' : ''}` : 'Coming soon'}</span><span>${icon('arrow', 16)}</span></span></a>`)}
      </div>
    </div></section>`;
  },
  mount(root) {
    // Poster thumbnails for each topic card.
    get('/api/courses').then(({ courses }) => {
      root.querySelectorAll('[data-topic]').forEach((card) => {
        const slug = card.dataset.topic;
        const posters = courses.filter((c) => c.specialty?.slug === slug || c.secondarySpecialty?.slug === slug).slice(0, 3).map((c) => c.poster).filter(Boolean);
        card.querySelector('.topic-thumbs').innerHTML = String(html`${posters.map((p) => html`<img src="${p}" alt="" loading="lazy">`)}`);
      });
    }).catch(() => {});
  },
};
