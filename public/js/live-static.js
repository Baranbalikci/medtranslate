// Live AI subtitles — static demo implementation. Inside the Claude artifact
// viewer the page can ask Claude directly (runtime capability "sample", on the
// viewer's own Claude account after they allow it). Each translated cue is
// streamed back as one JSON line and shown as soon as it arrives.
import { languageName } from './live-langs.js';

export const liveProvider = 'claude-viewer';

const RULES = `You translate subtitle cues of a medical education video for physicians and other healthcare professionals.
Rules:
- Preserve the medical meaning exactly. Never add, omit, soften or strengthen a clinical statement, number, threshold, dose, unit or time window.
- Use the professional terminology clinicians in the target language actually use. Keep ECG lead names (V1–V9), units and abbreviations such as ECG, CT, STEMI.
- One subtitle per cue, similar length to the source.
Output: one JSON object per line, exactly {"i": <cue index>, "t": "<translation>"}, in the given order, and nothing else.`;

let samplePromise = null;
const getSample = () => (samplePromise ||= (window.claude?.use ? window.claude.use('sample') : Promise.resolve(null)));

export async function translateLive({ lang, source, from, onCues, signal, courseTitle }) {
  const sample = await getSample();
  if (!sample) {
    const e = new Error('Live AI translation works when this page is opened inside Claude (claude.ai). It is not available in this view.');
    e.code = 'unavailable'; throw e;
  }
  const order = [...source.filter((q) => q.idx >= from), ...source.filter((q) => q.idx < from)];
  // First the sentences at the playhead with the fastest model (subtitles appear within seconds),
  // then the rest of the lecture with the default model for higher quality.
  const parts = [order.slice(0, 3), ...Array.from({ length: Math.ceil(Math.max(0, order.length - 3) / 8) }, (_, k) => order.slice(3 + k * 8, 11 + k * 8))];
  for (const [n, part] of parts.entries()) {
    if (signal.aborted) return;
    if (!part.length) continue;
    const prompt = `${RULES}\n\nCourse: ${courseTitle}\nTranslate from English into ${languageName(lang)} (language code "${lang}").\n\nCues:\n${part.map((q) => JSON.stringify({ i: q.idx, speaker: q.speaker || null, text: q.text })).join('\n')}`;
    let pending = '';
    const eat = (s) => {
      const lines = (pending + s).split('\n');
      pending = lines.pop();
      const got = [];
      for (const line of lines) {
        const m = line.trim().replace(/^```\w*|```$/g, '');
        if (!m.startsWith('{')) continue;
        try { const o = JSON.parse(m); if (Number.isInteger(o.i) && typeof o.t === 'string') got.push({ idx: o.i, text: o.t.trim() }); } catch { /* partial line */ }
      }
      if (got.length) onCues(got);
    };
    try {
      await sample(prompt, { signal, modelTier: n === 0 ? 'quick' : 'default', onText: ({ delta }) => eat(delta) });
      eat('\n');
    } catch (e) {
      if (e?.code === 'cancelled') return;
      const err = new Error({
        not_granted: 'Live translation needs your permission to use Claude. Allow it when asked, or reload the page to be asked again.',
        rate_limited: 'Too many translation requests right now. Please try again in a moment.',
        sampling_disabled: 'Claude is not available for this account.',
      }[e?.code] || 'Live translation was interrupted. Please try again.');
      err.code = e?.code; throw err;
    }
  }
}
