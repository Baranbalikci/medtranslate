// Language names for live translation prompts and menus.
import { state } from './store.js';

export const languageName = (code) => {
  const l = state.meta?.languages.find((x) => x.code === code);
  return l ? `${l.name} (${l.native})` : code;
};
