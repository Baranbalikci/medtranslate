// App state + consent-aware storage.
import { get, post } from './api.js';

export const state = { user: null, meta: null, consent: null };
const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const emit = () => listeners.forEach((fn) => fn(state));

// Consent record lives in localStorage (strictly necessary to remember the choice itself).
const CONSENT_KEY = 'mt_consent';
const safeLS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export function loadConsent() {
  try { state.consent = JSON.parse(safeLS.get(CONSENT_KEY)); } catch { state.consent = null; }
  if (state.consent && state.meta && state.consent.policyVersion !== state.meta.policyVersion) state.consent = null;
  return state.consent;
}

export async function saveConsent({ preferences, analytics }) {
  const res = await post('/api/consent', { preferences, analytics, consentId: state.consent?.consentId });
  state.consent = { ...res.categories, consentId: res.consentId, policyVersion: res.policyVersion, at: new Date().toISOString() };
  safeLS.set(CONSENT_KEY, JSON.stringify(state.consent));
  if (!preferences) for (const k of Object.keys(localStorage)) if (k.startsWith('mt_pref_')) safeLS.del(k);
  emit();
}

/** Preference storage: persisted only with "preferences" consent, otherwise kept for this page session. */
const memory = new Map();
export const prefs = {
  get(key, fallback) {
    if (memory.has(key)) return memory.get(key);
    if (state.consent?.preferences) { const v = safeLS.get('mt_pref_' + key); if (v != null) try { return JSON.parse(v); } catch { /* ignore */ } }
    return fallback;
  },
  set(key, value) {
    memory.set(key, value);
    if (state.consent?.preferences) safeLS.set('mt_pref_' + key, JSON.stringify(value));
  },
};

export async function loadSession() {
  const [me, meta] = await Promise.all([get('/api/auth/me'), get('/api/meta')]);
  state.user = me.user;
  state.meta = meta;
  loadConsent();
  emit();
}

export async function refreshUser() {
  state.user = (await get('/api/auth/me')).user;
  emit();
}

export const langName = (code) => state.meta?.languages.find((l) => l.code === code)?.name || code;
export const langInfo = (code) => state.meta?.languages.find((l) => l.code === code);
