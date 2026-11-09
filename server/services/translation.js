// AI translation service.
//
// Provider: Anthropic Claude via the official SDK (`@anthropic-ai/sdk`, an
// optional dependency). When ANTHROPIC_API_KEY is not set or the SDK is not
// installed, the service reports itself as "not connected" and the admin UI
// offers manual import instead. It never fabricates a translation.
import { config } from '../config.js';
import { all } from '../db.js';
import { languageByCode } from '../languages.js';

let clientPromise = null;
async function getClient() {
  if (!config.anthropicApiKey) return null;
  if (!clientPromise) {
    clientPromise = import('@anthropic-ai/sdk')
      .then(({ default: Anthropic }) => new Anthropic({ apiKey: config.anthropicApiKey }))
      .catch(() => null);
  }
  return clientPromise;
}

export async function translationStatus() {
  if (!config.anthropicApiKey) return { connected: false, provider: 'anthropic', reason: 'ANTHROPIC_API_KEY is not configured.' };
  const client = await getClient();
  if (!client) return { connected: false, provider: 'anthropic', reason: 'Optional dependency @anthropic-ai/sdk is not installed (run npm install).' };
  return { connected: true, provider: 'anthropic', model: config.translationModel };
}

export class ProviderNotConnectedError extends Error {}

export const SYSTEM_PROMPT = `You are a medical translator and clinician-editor. You translate subtitle cues of medical education videos (mostly emergency medicine) for physicians, nurses and paramedics. The translation is also read aloud by a synthetic voice, so it must sound like something a colleague would actually say.

Translate MEANING, not words:
- First understand the whole passage (surrounding cues are given for context), then express each idea the way a fluent native clinician would say it. Never translate word by word; never copy English sentence structure, idioms or phrasal verbs ("rule out", "work up", "bail out") — find the natural equivalent in the target language.
- A cue may be a fragment of a longer sentence. Keep it grammatical on its own where possible, but let it join smoothly with the previous and next cue.
- Use the register of a professional clinical lecture: clear, direct, no slang, no over-formal bureaucratic phrasing.
- If the target language has no established term for a concept, use the clearest short description and keep the English or Latin term in parentheses at first mention. Never invent terminology and never guess.

Clinical accuracy (non-negotiable):
- Preserve every clinical statement exactly: no added, omitted, softened or strengthened claim. Numbers, doses, thresholds, units, time windows, negations ("do not", "never", "unless") and conditionals must be identical in meaning. Double-check every number and every negation before answering.
- Drug names: international non-proprietary names in the form used in the target language. Keep ECG leads (V1–V9), units and customary abbreviations (ECG, CT, STEMI, MAP, INR, mmol/L) unless the glossary says otherwise; use the local abbreviation only when it is the one clinicians in that language use.
- Follow the glossary whenever it has the term.
- Do not explain, comment, moralise or add safety advice that is not in the source.

Format:
- Return exactly one translated string per input cue, in the same order, similar in length to the source so it fits the same time slot (up to ~20% longer is fine if the language needs it).
- If you are not confident a cue is translated correctly (ambiguous source, missing term), still give your best natural translation and list its index in "uncertain_cues".`;

const REVIEW_PROMPT = `You are a second, independent medical reviewer (a bilingual emergency physician). You receive source cues and a draft translation. Check every cue for:
1. Meaning errors, omissions, additions, wrong negation or changed numbers, doses, units, thresholds or time windows.
2. Literal / word-for-word renderings that sound unnatural or are not what clinicians in the target language would say.
3. Wrong or invented terminology, or terms that disagree with the glossary.
4. Fluency: grammar, agreement, script and punctuation.
Fix every problem you find by rewriting the cue; leave correct cues unchanged. Return the complete corrected list (same count, same order) plus the indices of cues whose meaning you still cannot guarantee in "uncertain_cues".`;

const DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9,
  '०': 0, '१': 1, '२': 2, '३': 3, '४': 4, '५': 5, '६': 6, '७': 7, '८': 8, '९': 9, '০': 0, '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5, '৬': 6, '৭': 7, '৮': 8, '৯': 9 };
const numberTokens = (t) => (String(t).replace(/[٠-٩۰-۹०-९০-৯]/g, (d) => DIGITS[d]).match(/\d+(?:[.,]\d+)?/g) || []).map((x) => x.replace(',', '.')).sort();

/** Deterministic safety net: every number in the source must still be present in the translation. */
export function numberMismatches(sources, targets) {
  const bad = [];
  sources.forEach((src, i) => {
    const want = numberTokens(src); if (!want.length) return;
    const have = numberTokens(targets[i] || '');
    const pool = [...have];
    for (const n of want) { const k = pool.indexOf(n); if (k < 0) { bad.push(i); return; } pool.splice(k, 1); }
  });
  return bad;
}

const schemaFor = () => ({
  type: 'object',
  properties: { translations: { type: 'array', items: { type: 'string' } }, uncertain_cues: { type: 'array', items: { type: 'integer' } } },
  required: ['translations', 'uncertain_cues'], additionalProperties: false,
});

async function callJson(client, { system, user, effort }) {
  const stream = client.beta.messages.stream({
    model: config.translationModel, max_tokens: 64000, thinking: { type: 'adaptive' },
    output_config: { effort, format: { type: 'json_schema', schema: schemaFor() } },
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    system, messages: [{ role: 'user', content: user }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error('The model declined to translate this content.');
  if (message.stop_reason === 'max_tokens') throw new Error('Translation output was truncated; try a shorter transcript.');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Translation provider returned invalid JSON.'); }
  return { parsed, model: message.model };
}

/**
 * Translate a course's cues into `target`. Returns { texts, uncertain, model }.
 * - `context` ({before, after}: source texts) gives the model the surrounding sentences when only part of a lecture is translated.
 * - `review` (default true) adds an independent second pass that fixes meaning errors and unnatural wording.
 * Cues whose numbers changed are always flagged as uncertain.
 * Throws ProviderNotConnectedError when no provider is configured.
 */
export async function translateCues({ cues, source, target, courseTitle, context = null, review = true }) {
  const client = await getClient();
  if (!client) throw new ProviderNotConnectedError('AI translation provider is not connected.');

  const glossary = all('SELECT term, translation, note FROM glossary WHERE language = ?', target);
  const src = languageByCode(source)?.name || source;
  const tgt = languageByCode(target)?.name || target;
  const gl = glossary.length ? `Glossary (${tgt}):\n${glossary.map((g) => `- ${g.term} → ${g.translation}${g.note ? ` (${g.note})` : ''}`).join('\n')}` : 'Glossary: none for this language.';
  const head = [`Course: ${courseTitle}`, `Translate from ${src} to ${tgt}.`, gl];
  if (context?.before?.length) head.push(`Context before (do NOT translate):\n${context.before.map((t) => `- ${t}`).join('\n')}`);
  const cueJson = `Cues (JSON):\n${JSON.stringify(cues.map((c, i) => ({ index: i, speaker: c.speaker || null, text: c.text })))}`;
  const tail = context?.after?.length ? `\n\nContext after (do NOT translate):\n${context.after.map((t) => `- ${t}`).join('\n')}` : '';

  const draft = await callJson(client, { system: SYSTEM_PROMPT, user: `${head.join('\n\n')}\n\n${cueJson}${tail}`, effort: 'high' });
  if (!Array.isArray(draft.parsed.translations) || draft.parsed.translations.length !== cues.length) {
    throw new Error(`Expected ${cues.length} translated cues, received ${draft.parsed.translations?.length ?? 0}.`);
  }
  let texts = draft.parsed.translations.map((t) => String(t).trim());
  let uncertain = new Set(draft.parsed.uncertain_cues || []);
  let model = draft.model;

  if (review) {
    try {
      const pairs = JSON.stringify(cues.map((c, i) => ({ index: i, source: c.text, draft: texts[i] })));
      const rev = await callJson(client, { system: REVIEW_PROMPT, user: `${head.join('\n\n')}\n\nSource and draft (JSON):\n${pairs}${tail}`, effort: 'high' });
      if (Array.isArray(rev.parsed.translations) && rev.parsed.translations.length === cues.length) {
        texts = rev.parsed.translations.map((t, i) => String(t).trim() || texts[i]);
        uncertain = new Set([...uncertain, ...(rev.parsed.uncertain_cues || [])]);
        model = rev.model;
      }
    } catch { /* the draft is still safe to use: it is flagged below if numbers differ */ }
  }
  for (const i of numberMismatches(cues.map((c) => c.text), texts)) uncertain.add(i);
  return { texts, uncertain: [...uncertain].sort((a, b) => a - b), model };
}

const UI_PROMPT = `You translate the user interface and page text of a medical education website (MedTranslate) for healthcare professionals.
Rules:
- Translate the MEANING of each string, not word by word: write what a native speaker would naturally say in that place on a website. No calques of English phrasing or idioms. Keep it concise like UI text.
- Keep the brand "MedTranslate", product codes, URLs, e-mail addresses, numbers, currencies and units unchanged.
- Keep medical terms accurate; keep abbreviations such as CME, CPD, ECG, CT, AI where they are customary.
- Legal text: translate the meaning precisely; do not add or drop obligations.
- Return exactly one translation per input string, in the same order.`;

/** Translate short UI strings. Returns string[] of equal length. */
export async function translateStrings({ strings, target }) {
  const client = await getClient();
  if (!client) throw new ProviderNotConnectedError('AI translation provider is not connected.');
  const tgt = languageByCode(target)?.name || target;
  const schema = { type: 'object', properties: { t: { type: 'array', items: { type: 'string' } } }, required: ['t'], additionalProperties: false };
  const stream = client.beta.messages.stream({
    model: config.translationModel,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: UI_PROMPT,
    messages: [{ role: 'user', content: `Target language: ${tgt} (${target}).\nStrings (JSON array):\n${JSON.stringify(strings)}` }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error('The model declined this translation.');
  const parsed = JSON.parse(message.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
  if (!Array.isArray(parsed.t) || parsed.t.length !== strings.length) throw new Error('Translation returned the wrong number of strings.');
  return parsed.t.map(String);
}
