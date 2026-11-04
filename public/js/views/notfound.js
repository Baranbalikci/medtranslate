import { html, icon } from '../ui.js';

export default {
  title: 'Page not found',
  render: () => html`<section class="section"><div class="container narrow center">
    <div class="empty"><div class="empty-icon">${icon('search', 26)}</div><h1 class="h3">Page not found</h1>
    <p>The page you are looking for doesn't exist or has moved.</p>
    <div class="row" style="justify-content:center"><a class="btn btn-primary" href="/">Home</a><a class="btn btn-ghost" href="/courses">Browse courses</a></div></div>
  </div></section>`,
};
