// Replaces the admin dashboard in the static demo build (no server available).
import { html, icon } from '../ui.js';

export default {
  title: 'Admin',
  render: () => html`<section class="section"><div class="container narrow center">
    <div class="empty"><div class="empty-icon">${icon('shield', 26)}</div><h1 class="h3">Admin dashboard</h1>
    <p>Course, licence, accreditation and translation-QC management needs the MedTranslate server. Run the full version locally with <code>npm start</code> to use it.</p>
    <a class="btn btn-primary" href="/">Back to home</a></div></div></section>`,
};
