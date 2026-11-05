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

const SYSTEM_PROMPT = `You translate subtitle cues of accredited-quality medical education videos for physicians and other healthcare professionals.

Requirements:
- Preserve the medical meaning exactly. Do not add, omit, soften or strengthen any clinical statement, number, threshold, dose, unit or time window.
- Use the standard professional terminology that clinicians in the target language actually use. Keep drug names as INN in the target-language form.
- Follow the glossary when it provides a term for the target language.
- Keep each cue as one subtitle: similar length to the source so it can be read and spoken within the same time slot.
- Keep abbreviations (ECG lead names such as V1, units such as mmol/L) unless the glossary says otherwise.
- Return exactly one translated string per input cue, in the same order. If a cue contains something you cannot translate safely, translate it as literally as possible and list its index in "uncertain_cues".`;

/**
 * Translate a course's cues into `target`. Returns { texts, uncertain, model }.
 * Throws ProviderNotConnectedError when no provider is configured.
 */
export async function translateCues({ cues, source, target, courseTitle }) {
  const client = await getClient();
  if (!client) throw new ProviderNotConnectedError('AI translation provider is not connected.');

  const glossary = all('SELECT term, translation, note FROM glossary WHERE language = ?', target);
  const src = languageByCode(source)?.name || source;
  const tgt = languageByCode(target)?.name || target;

  const userContent = [
    `Course: ${courseTitle}`,
    `Translate from ${src} to ${tgt}.`,
    glossary.length ? `Glossary (${tgt}):\n${glossary.map((g) => `- ${g.term} → ${g.translation}${g.note ? ` (${g.note})` : ''}`).join('\n')}` : 'Glossary: none for this language.',
    `Cues (JSON):\n${JSON.stringify(cues.map((c, i) => ({ index: i, speaker: c.speaker || null, text: c.text })))}`,
  ].join('\n\n');

  const schema = {
    type: 'object',
    properties: {
      translations: { type: 'array', items: { type: 'string' } },
      uncertain_cues: { type: 'array', items: { type: 'integer' } },
    },
    required: ['translations', 'uncertain_cues'],
    additionalProperties: false,
  };

  const stream = client.beta.messages.stream({
    model: config.translationModel,
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') throw new Error('The model declined to translate this content.');
  if (message.stop_reason === 'max_tokens') throw new Error('Translation output was truncated; try a shorter transcript.');

  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Translation provider returned invalid JSON.'); }
  if (!Array.isArray(parsed.translations) || parsed.translations.length !== cues.length) {
    throw new Error(`Expected ${cues.length} translated cues, received ${parsed.translations?.length ?? 0}.`);
  }
  return { texts: parsed.translations.map((t) => String(t).trim()), uncertain: parsed.uncertain_cues || [], model: message.model };
}

const UI_PROMPT = `You translate the user interface and page text of a medical education website (MedTranslate) for healthcare professionals.
Rules:
- Translate each string faithfully and naturally for native speakers; keep it concise like UI text.
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
