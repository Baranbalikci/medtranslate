// Launch scope for languages and countries.
//
// The platform knows ~50 languages, but at launch only a curated set is offered publicly:
//   • established languages with mature, well-tested AI translation (en, fr, es, pt, de, ar)
//   • the main languages of the two launch countries, Nigeria and Kenya
//     (Hausa, Yorùbá, Igbo, Nigerian Pidgin · Kiswahili; English is official in both).
// Every other language stays in the system but is hidden and refused by the translation
// endpoints until an admin widens the set (Admin → Specialties & providers → Launch languages)
// or the LAUNCH_LANGUAGES environment variable overrides it ("*" = all languages).
import { getSetting } from './db.js';
import { LANGUAGE_CODES } from './languages.js';

export const ESTABLISHED_LANGUAGES = ['en', 'fr', 'es', 'pt', 'de', 'ar'];
export const LAUNCH_COUNTRIES = [
  { code: 'NG', name: 'Nigeria', languages: ['en', 'ha', 'yo', 'ig', 'pcm'] },
  { code: 'KE', name: 'Kenya', languages: ['sw', 'en'] },
];
export const DEFAULT_LAUNCH_LANGUAGES = [...new Set([...ESTABLISHED_LANGUAGES, ...LAUNCH_COUNTRIES.flatMap((c) => c.languages)])];

const parse = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '*') return '*';
  try { const a = JSON.parse(s); if (Array.isArray(a)) return a; } catch { /* comma list */ }
  return s.split(',').map((x) => x.trim()).filter(Boolean);
};

/** '*' (all languages) or the array of public language codes. English is always included. */
export function launchLanguages() {
  const raw = parse(process.env.LAUNCH_LANGUAGES) ?? parse(getSetting('launch_languages', null)) ?? DEFAULT_LAUNCH_LANGUAGES;
  if (raw === '*') return '*';
  return [...new Set(['en', ...raw.filter((c) => LANGUAGE_CODES.has(c))])];
}
export const launchLanguagesLocked = () => process.env.LAUNCH_LANGUAGES !== undefined;
export function isLaunchLanguage(code) {
  const l = launchLanguages();
  return l === '*' || l.includes(code);
}
