// Supported platform languages. A language listed here is only *offered* for a
// course when a released translation exists AND the licence covers it.
export const LANGUAGES = [
  // Europe
  { code: 'en', name: 'English', native: 'English', bcp47: 'en-GB', dir: 'ltr', region: 'europe' },
  { code: 'de', name: 'German', native: 'Deutsch', bcp47: 'de-DE', dir: 'ltr', region: 'europe' },
  { code: 'fr', name: 'French', native: 'Français', bcp47: 'fr-FR', dir: 'ltr', region: 'europe' },
  { code: 'es', name: 'Spanish', native: 'Español', bcp47: 'es-ES', dir: 'ltr', region: 'europe' },
  { code: 'pt', name: 'Portuguese', native: 'Português', bcp47: 'pt-BR', dir: 'ltr', region: 'europe' },
  { code: 'it', name: 'Italian', native: 'Italiano', bcp47: 'it-IT', dir: 'ltr', region: 'europe' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', bcp47: 'nl-NL', dir: 'ltr', region: 'europe' },
  { code: 'pl', name: 'Polish', native: 'Polski', bcp47: 'pl-PL', dir: 'ltr', region: 'europe' },
  { code: 'ro', name: 'Romanian', native: 'Română', bcp47: 'ro-RO', dir: 'ltr', region: 'europe' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά', bcp47: 'el-GR', dir: 'ltr', region: 'europe' },
  { code: 'ru', name: 'Russian', native: 'Русский', bcp47: 'ru-RU', dir: 'ltr', region: 'europe' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська', bcp47: 'uk-UA', dir: 'ltr', region: 'europe' },
  // Africa (priority region; French, Arabic, Portuguese and English also serve large parts of it)
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', bcp47: 'sw-KE', dir: 'ltr', region: 'africa' },
  { code: 'ha', name: 'Hausa', native: 'Hausa', bcp47: 'ha-NG', dir: 'ltr', region: 'africa' },
  { code: 'am', name: 'Amharic', native: 'አማርኛ', bcp47: 'am-ET', dir: 'ltr', region: 'africa' },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá', bcp47: 'yo-NG', dir: 'ltr', region: 'africa' },
  { code: 'ig', name: 'Igbo', native: 'Igbo', bcp47: 'ig-NG', dir: 'ltr', region: 'africa' },
  { code: 'zu', name: 'Zulu', native: 'isiZulu', bcp47: 'zu-ZA', dir: 'ltr', region: 'africa' },
  { code: 'xh', name: 'Xhosa', native: 'isiXhosa', bcp47: 'xh-ZA', dir: 'ltr', region: 'africa' },
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans', bcp47: 'af-ZA', dir: 'ltr', region: 'africa' },
  { code: 'so', name: 'Somali', native: 'Soomaali', bcp47: 'so-SO', dir: 'ltr', region: 'africa' },
  { code: 'rw', name: 'Kinyarwanda', native: 'Ikinyarwanda', bcp47: 'rw-RW', dir: 'ltr', region: 'africa' },
  { code: 'om', name: 'Oromo', native: 'Afaan Oromoo', bcp47: 'om-ET', dir: 'ltr', region: 'africa' },
  { code: 'ti', name: 'Tigrinya', native: 'ትግርኛ', bcp47: 'ti-ER', dir: 'ltr', region: 'africa' },
  { code: 'ln', name: 'Lingala', native: 'Lingála', bcp47: 'ln-CD', dir: 'ltr', region: 'africa' },
  { code: 'wo', name: 'Wolof', native: 'Wolof', bcp47: 'wo-SN', dir: 'ltr', region: 'africa' },
  { code: 'ak', name: 'Akan (Twi)', native: 'Akan', bcp47: 'ak-GH', dir: 'ltr', region: 'africa' },
  { code: 'sn', name: 'Shona', native: 'chiShona', bcp47: 'sn-ZW', dir: 'ltr', region: 'africa' },
  { code: 'ny', name: 'Chichewa', native: 'Chichewa', bcp47: 'ny-MW', dir: 'ltr', region: 'africa' },
  { code: 'mg', name: 'Malagasy', native: 'Malagasy', bcp47: 'mg-MG', dir: 'ltr', region: 'africa' },
  { code: 'tn', name: 'Setswana', native: 'Setswana', bcp47: 'tn-BW', dir: 'ltr', region: 'africa' },
  // Americas (Spanish and Portuguese above cover most of South America)
  { code: 'qu', name: 'Quechua', native: 'Runa Simi', bcp47: 'qu-PE', dir: 'ltr', region: 'americas' },
  { code: 'gn', name: 'Guarani', native: 'Avañeʼẽ', bcp47: 'gn-PY', dir: 'ltr', region: 'americas' },
  { code: 'ay', name: 'Aymara', native: 'Aymar aru', bcp47: 'ay-BO', dir: 'ltr', region: 'americas' },
  { code: 'ht', name: 'Haitian Creole', native: 'Kreyòl ayisyen', bcp47: 'ht-HT', dir: 'ltr', region: 'americas' },
  // Middle East & North Africa
  { code: 'ar', name: 'Arabic', native: 'العربية', bcp47: 'ar-SA', dir: 'rtl', region: 'mena' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', bcp47: 'tr-TR', dir: 'ltr', region: 'mena' },
  { code: 'fa', name: 'Persian', native: 'فارسی', bcp47: 'fa-IR', dir: 'rtl', region: 'mena' },
  { code: 'ku', name: 'Kurdish', native: 'Kurdî', bcp47: 'ku-TR', dir: 'ltr', region: 'mena' },
  // Asia
  { code: 'zh', name: 'Chinese', native: '中文', bcp47: 'zh-CN', dir: 'ltr', region: 'asia' },
  { code: 'ja', name: 'Japanese', native: '日本語', bcp47: 'ja-JP', dir: 'ltr', region: 'asia' },
  { code: 'ko', name: 'Korean', native: '한국어', bcp47: 'ko-KR', dir: 'ltr', region: 'asia' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', bcp47: 'hi-IN', dir: 'ltr', region: 'asia' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', bcp47: 'bn-BD', dir: 'ltr', region: 'asia' },
  { code: 'ur', name: 'Urdu', native: 'اردو', bcp47: 'ur-PK', dir: 'rtl', region: 'asia' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', bcp47: 'ne-NP', dir: 'ltr', region: 'asia' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', bcp47: 'ta-IN', dir: 'ltr', region: 'asia' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', bcp47: 'id-ID', dir: 'ltr', region: 'asia' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu', bcp47: 'ms-MY', dir: 'ltr', region: 'asia' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', bcp47: 'vi-VN', dir: 'ltr', region: 'asia' },
  { code: 'th', name: 'Thai', native: 'ไทย', bcp47: 'th-TH', dir: 'ltr', region: 'asia' },
  { code: 'tl', name: 'Filipino', native: 'Filipino', bcp47: 'fil-PH', dir: 'ltr', region: 'asia' },
  { code: 'my', name: 'Burmese', native: 'မြန်မာ', bcp47: 'my-MM', dir: 'ltr', region: 'asia' },
];

export const REGIONS = [
  ['africa', 'Africa'], ['americas', 'Americas'], ['mena', 'Middle East & North Africa'], ['asia', 'Asia'], ['europe', 'Europe'],
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
  ['KE', 'Kenya'], ['TZ', 'Tanzania'], ['UG', 'Uganda'], ['ET', 'Ethiopia'], ['GH', 'Ghana'], ['RW', 'Rwanda'],
  ['SN', 'Senegal'], ['CM', 'Cameroon'], ['CI', "Côte d'Ivoire"], ['CD', 'DR Congo'], ['MZ', 'Mozambique'], ['AO', 'Angola'],
  ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'], ['MW', 'Malawi'], ['SO', 'Somalia'], ['SD', 'Sudan'], ['TN', 'Tunisia'], ['DZ', 'Algeria'],
  ['PE', 'Peru'], ['BO', 'Bolivia'], ['PY', 'Paraguay'], ['HT', 'Haiti'], ['PK', 'Pakistan'], ['BD', 'Bangladesh'], ['NP', 'Nepal'], ['MM', 'Myanmar'],
  ['PH', 'Philippines'], ['TH', 'Thailand'], ['MY', 'Malaysia'], ['IR', 'Iran'], ['RO', 'Romania'], ['RU', 'Russia'], ['MG', 'Madagascar'], ['BW', 'Botswana'], ['ER', 'Eritrea'],
];
export const COUNTRY_CODES = new Set(COUNTRIES.map((c) => c[0]));

// Languages people actually speak in each country (first = most widespread). Drives the
// "spoken in your country" shortcut in the player's language picker.
export const COUNTRY_LANGS = {
  KE: ['sw', 'en'], TZ: ['sw', 'en'], UG: ['sw', 'en'], RW: ['rw', 'sw', 'fr', 'en'], ET: ['am', 'om', 'ti', 'so', 'en'], ER: ['ti', 'ar', 'en'], SO: ['so', 'ar'],
  NG: ['ha', 'yo', 'ig', 'en'], GH: ['ak', 'en'], SN: ['wo', 'fr'], CI: ['fr'], CM: ['fr', 'en'], CD: ['ln', 'sw', 'fr'], AO: ['pt'], MZ: ['pt', 'sw'],
  ZM: ['ny', 'en'], ZW: ['sn', 'en'], MW: ['ny', 'en'], MG: ['mg', 'fr'], BW: ['tn', 'en'], ZA: ['zu', 'xh', 'af', 'tn', 'en'],
  EG: ['ar'], SD: ['ar', 'en'], TN: ['ar', 'fr'], DZ: ['ar', 'fr'], MA: ['ar', 'fr'], SA: ['ar'], AE: ['ar', 'en'], TR: ['tr', 'ku'], IR: ['fa', 'ku'],
  PE: ['qu', 'ay', 'es'], BO: ['qu', 'ay', 'gn', 'es'], PY: ['gn', 'es'], HT: ['ht', 'fr'], BR: ['pt'], MX: ['es'], CO: ['es'], AR: ['es'],
  IN: ['hi', 'bn', 'ta', 'ur', 'en'], PK: ['ur', 'en'], BD: ['bn'], NP: ['ne', 'en'], MM: ['my'], TH: ['th'], VN: ['vi'], ID: ['id'], MY: ['ms', 'en'], PH: ['tl', 'en'],
  CN: ['zh'], JP: ['ja'], KR: ['ko'],
  DE: ['de'], AT: ['de'], CH: ['de', 'fr', 'it'], FR: ['fr'], ES: ['es'], IT: ['it'], PT: ['pt'], NL: ['nl'], BE: ['nl', 'fr'], PL: ['pl'], RO: ['ro'], GR: ['el'],
  UA: ['uk', 'ru'], RU: ['ru'], GB: ['en'], IE: ['en'], US: ['en', 'es'], CA: ['en', 'fr'], AU: ['en'], SE: ['en'], NO: ['en'], DK: ['en'], FI: ['en'], CZ: ['en'],
};

export const PROFESSIONS = [
  'Physician', 'Resident / physician in training', 'Medical student', 'Nurse', 'Advanced practice provider',
  'Pharmacist', 'Paramedic / EMS', 'Allied health professional', 'Researcher', 'Other',
];
