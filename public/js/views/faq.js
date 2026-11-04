import { html, icon } from '../ui.js';

export const FAQ = [
  ['How are courses translated?', 'An AI model translates the original transcript cue by cue, using a medical glossary to keep terminology consistent. The result is labelled as AI-generated and goes through a documented quality-control step by a qualified reviewer before the language is released.'],
  ['Does a translated course give me CME/CPD credits in my country?', 'Not automatically. Credits are granted by accrediting bodies (e.g. German Landesärztekammern, ACCME/AMA PRA in the US, CPD schemes in the UK) for a specific activity, often in specific languages and countries. Each course page shows the actual accreditation status. The demo courses on this site are not accredited and award no credits.'],
  ['Is the medical content changed by the translation?', 'No. We translate only the language. The clinical statements, numbers and recommendations remain those of the original faculty. If you notice a translation error, please report it from the course page — we review every report.'],
  ['Can I switch language while watching?', 'Yes. Subtitles and audio can be changed independently at any time. The video keeps playing — nothing is reloaded.'],
  ['How does the AI voice work?', 'Each translated cue is spoken in the selected language and time-fitted to the original timing, with different voices for different speakers. In this demo build the voice is synthesised by your browser; the production pipeline uses server-generated neural audio tracks.'],
  ['Which languages are available?', 'It depends on the course: a language is shown only when its translation is released and our licence covers it. You can filter the catalogue by language.'],
  ['What does a subscription include?', 'All courses in the catalogue that are marked as included, in every language released for them, plus progress tracking and completion records. You can cancel at any time to the end of the billing period.'],
  ['Can institutions license the platform?', 'Yes. Clinics, hospitals and universities can obtain institutional licences with seat management. Please contact us via the Partner page.'],
  ['How do you handle my data?', 'We collect only what is needed to run your account and learning records, use no advertising trackers, and you can export or delete your data at any time from your account settings. See the privacy policy for details.'],
  ['I am a CME provider. How can we work together?', 'We license existing video courses, translate and dub them with medical QC, and distribute them internationally with revenue sharing. Start with the Partner With Us form.'],
];

export const faqList = (items) => html`<div class="faq">${items.map(([q, a]) => html`<details><summary>${q}${icon('chevron', 18)}</summary><div>${a}</div></details>`)}</div>`;

export default {
  title: 'FAQ',
  description: 'Answers about AI translation, CME/CPD accreditation, subscriptions and privacy at MedTranslate.',
  render: () => html`
    <section class="page-head"><div class="container narrow"><span class="eyebrow">Help centre</span><h1>Frequently asked questions</h1>
      <p class="lead">Everything about translations, accreditation, subscriptions and data protection.</p></div></section>
    <section class="section-sm"><div class="container narrow">${faqList(FAQ)}
      <div class="notice" style="margin-top:32px">${icon('mail', 18)}<span>Didn't find an answer? <a href="/contact">Contact us</a> — or, for legal and copyright matters, use the <a href="/legal/meldung">legal reporting form</a>.</span></div>
    </div></section>`,
};
