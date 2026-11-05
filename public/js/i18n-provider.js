// Website translation — server implementation (Claude on the server, cached).
import { api } from './api.js';

export async function translateStrings(lang, strings) {
  const r = await api('/api/i18n/translate', { method: 'POST', body: { language: lang, strings } });
  return r.translations;
}
