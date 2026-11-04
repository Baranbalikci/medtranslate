// Supported platform languages. A language listed here is only *offered* for a
// course when a released translation exists AND the licence covers it.
export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', bcp47: 'en-GB', dir: 'ltr' },
  { code: 'de', name: 'German', native: 'Deutsch', bcp47: 'de-DE', dir: 'ltr' },
  { code: 'fr', name: 'French', native: 'Français', bcp47: 'fr-FR', dir: 'ltr' },
  { code: 'es', name: 'Spanish', native: 'Español', bcp47: 'es-ES', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', native: 'العربية', bcp47: 'ar-SA', dir: 'rtl' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', bcp47: 'tr-TR', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', native: 'Português', bcp47: 'pt-BR', dir: 'ltr' },
  { code: 'zh', name: 'Chinese', native: '中文', bcp47: 'zh-CN', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', native: '日本語', bcp47: 'ja-JP', dir: 'ltr' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', bcp47: 'hi-IN', dir: 'ltr' },
  { code: 'it', name: 'Italian', native: 'Italiano', bcp47: 'it-IT', dir: 'ltr' },
  { code: 'pl', name: 'Polish', native: 'Polski', bcp47: 'pl-PL', dir: 'ltr' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', bcp47: 'nl-NL', dir: 'ltr' },
  { code: 'ru', name: 'Russian', native: 'Русский', bcp47: 'ru-RU', dir: 'ltr' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська', bcp47: 'uk-UA', dir: 'ltr' },
  { code: 'ko', name: 'Korean', native: '한국어', bcp47: 'ko-KR', dir: 'ltr' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', bcp47: 'id-ID', dir: 'ltr' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', bcp47: 'vi-VN', dir: 'ltr' },
];

export const LANGUAGE_CODES = new Set(LANGUAGES.map((l) => l.code));
export const languageByCode = (code) => LANGUAGES.find((l) => l.code === code);

// ISO 3166-1 alpha-2 subset used for profile + licence territories.
export const COUNTRIES = [
  ['AT', 'Austria'], ['AU', 'Australia'], ['BE', 'Belgium'], ['BR', 'Brazil'], ['CA', 'Canada'],
  ['CH', 'Switzerland'], ['CN', 'China'], ['CZ', 'Czechia'], ['DE', 'Germany'], ['DK', 'Denmark'],
  ['EG', 'Egypt'], ['ES', 'Spain'], ['FI', 'Finland'], ['FR', 'France'], ['GB', 'United Kingdom'],
  ['GR', 'Greece'], ['IE', 'Ireland'], ['IN', 'India'], ['IT', 'Italy'], ['JP', 'Japan'],
  ['KR', 'South Korea'], ['MA', 'Morocco'], ['MX', 'Mexico'], ['NG', 'Nigeria'], ['NL', 'Netherlands'],
  ['NO', 'Norway'], ['PL', 'Poland'], ['PT', 'Portugal'], ['SA', 'Saudi Arabia'], ['SE', 'Sweden'],
  ['TR', 'Türkiye'], ['UA', 'Ukraine'], ['AE', 'United Arab Emirates'], ['US', 'United States'],
  ['VN', 'Vietnam'], ['ID', 'Indonesia'], ['ZA', 'South Africa'], ['AR', 'Argentina'], ['CO', 'Colombia'],
];
export const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c[0]));

export const PROFESSIONS = [
  'Physician', 'Resident / physician in training', 'Medical student', 'Nurse', 'Advanced practice provider',
  'Pharmacist', 'Paramedic / EMS', 'Allied health professional', 'Researcher', 'Other',
];
