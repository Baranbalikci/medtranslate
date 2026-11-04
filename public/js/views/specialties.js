import { html, icon } from '../ui.js';
import { state } from '../store.js';
import { specIcon } from './home.js';

export default {
  title: 'Medical Specialties',
  description: 'Browse multilingual medical education by specialty.',
  render: () => html`
    <section class="page-head"><div class="container">
      <div class="crumbs"><a href="/">Home</a><span>/</span><span>Specialties</span></div>
      <h1>Medical specialties</h1>
      <p class="lead">From emergency medicine to ophthalmology — explore licensed courses in your field. New specialties are added as partner catalogues grow.</p>
    </div></section>
    <section class="section-sm"><div class="container">
      <div class="grid-3">
        ${state.meta.specialties.map((s) => html`<a class="spec-card reveal" href="/specialties/${s.slug}">
          <span class="ic">${specIcon(s.icon)}</span><h3>${s.name}</h3><p>${s.description}</p>
          <span class="row between small"><span class="muted">${s.course_count ? `${s.course_count} course${s.course_count > 1 ? 's' : ''}` : 'Coming soon'}</span><span>${icon('arrow', 16)}</span></span></a>`)}
      </div>
    </div></section>`,
};
