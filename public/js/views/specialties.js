import { html, icon } from '../ui.js';
import { state } from '../store.js';
import { get } from '../api.js';
import { specIcon } from './home.js';

// Emergency-focus mode shows TOPICS only (accent bento); the full specialty list stays hidden until
// the launch focus is widened in the admin area.
export default {
  title: () => (state.meta.focus ? 'Emergency medicine topics' : 'Medical Specialties'),
  description: 'Browse multilingual emergency medicine education by topic.',
  render() {
    const m = state.meta; const focus = m.focus;
    const list = focus ? (m.topics || []) : m.specialties;
    const base = focus ? '/topics' : '/specialties';
    const live = list.filter((s) => s.course_count);
    const soon = list.filter((s) => !s.course_count);
    const card = (s, i) => html`<a class="topic-tile ${i === 0 ? 'big' : ''}" data-spot href="${base}/${s.slug}" data-topic="${s.slug}" style="--ac:${s.accent || '#22D3EE'}">
      <span class="tt-glow" aria-hidden="true"></span>
      <span class="tt-ic">${specIcon(s.icon)}</span>
      <h3>${s.name}</h3><p>${s.description || ''}</p>
      <span class="tt-titles"></span>
      <span class="tt-foot"><b>${s.course_count} course${s.course_count > 1 ? 's' : ''}</b><span class="tt-go">${icon('arrow', 16)}</span></span></a>`;
    return html`
    <section class="page-head topics-head"><div class="container">
      <div class="crumbs"><a href="/">Home</a><span>/</span><span>${focus ? 'Topics' : 'Specialties'}</span></div>
      <h1>${focus ? 'Emergency medicine, topic by topic' : 'Medical specialties'}</h1>
      <p class="lead">${focus ? 'Pick the situation your team faces. Every course plays in your language with AI subtitles and AI voice.' : 'Explore licensed courses in your field.'}</p>
    </div></section>
    <section class="section-sm"><div class="container">
      <div class="topic-bento">${live.map(card)}</div>
      ${soon.length ? html`<h2 class="soon-h">In preparation</h2><div class="soon-row">${soon.map((s) => html`<span class="soon-chip" style="--ac:${s.accent || '#22D3EE'}">${specIcon(s.icon)} ${s.name}</span>`)}</div>` : ''}
    </div></section>`;
  },
  mount(root) {
    get('/api/courses').then(({ courses }) => {
      root.querySelectorAll('[data-topic]').forEach((card) => {
        const slug = card.dataset.topic;
        const hit = courses.filter((c) => c.topic?.slug === slug || c.specialty?.slug === slug).slice(0, 2);
        card.querySelector('.tt-titles').innerHTML = String(html`${hit.map((c) => html`<span class="tt-course">${c.poster ? html`<img src="${c.poster}" alt="" loading="lazy">` : ''}<span>${c.title}</span></span>`)}`);
      });
    }).catch(() => {});
  },
};
