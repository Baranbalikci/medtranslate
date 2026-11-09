// Website translation — static demo: the viewer's Claude (artifact capability "sample").
import { languageName } from './live-langs.js';

let samplePromise = null;
const getSample = () => (samplePromise ||= (window.claude?.use ? window.claude.use('sample') : Promise.resolve(null)));

export async function translateStrings(lang, strings) {
  const sample = await getSample();
  if (!sample) throw Object.assign(new Error('Website translation works when this page is opened inside Claude (claude.ai).'), { code: 'unavailable' });
  const prompt = `Translate the following user-interface strings of a medical education website for healthcare professionals into ${languageName(lang)}.
Rules: translate the MEANING, not word by word — write what a native speaker would naturally say in that place on a website (no calques of English phrasing or idioms); concise UI language; keep "MedTranslate", URLs, e-mail addresses, numbers, currencies and units unchanged; keep medical terms accurate and customary abbreviations (CME, CPD, ECG, CT, AI); translate legal text precisely.
Reply with only a JSON array of exactly ${strings.length} strings, in the same order.

${JSON.stringify(strings)}`;
  try {
    const out = await sample.json(prompt, { modelTier: 'quick', cache: { gcTime: 24 * 3600 * 1000 } });
    if (!Array.isArray(out) || out.length !== strings.length) throw Object.assign(new Error('bad'), { code: 'invalid_json' });
    return out.map(String);
  } catch (e) {
    throw Object.assign(new Error({
      not_granted: 'Website translation needs your permission to use Claude. Allow it when asked.',
      rate_limited: 'Too many translation requests right now — please try again shortly.',
      invalid_json: 'Part of the page could not be translated. Please try again.',
    }[e?.code] || 'The page could not be translated right now.'), { code: e?.code });
  }
}
