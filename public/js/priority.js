// Live subtitles must never wait behind background work (e.g. website
// translation): both share the viewer's small number of concurrent AI calls.
let live = 0;
const waiters = new Set();
export function liveStart() { live++; }
export function liveEnd() { live = Math.max(0, live - 1); if (!live) { for (const w of waiters) w(); waiters.clear(); } }
/** Resolves when no live translation is running. */
export function whenIdle() { return live ? new Promise((r) => waiters.add(r)) : Promise.resolve(); }
