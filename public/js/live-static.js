// Live AI subtitles — static demo implementation. Inside the Claude artifact
// viewer the page can ask Claude directly (runtime capability "sample", on the
// viewer's own Claude account after they allow it). Each translated cue is
// streamed back as one JSON line and shown as soon as it arrives.
import { languageName } from './live-langs.js';
import { liveStart, liveEnd } from './priority.js';

export const liveProvider = 'claude-viewer';

const RULES = `You are a medical translator and clinician-editor. You translate subtitle cues of a medical education video (emergency medicine) for physicians, nurses and paramedics. The text is also read aloud by a synthetic voice, so it must sound like something a colleague would actually say.
Translate MEANING, not words:
- Understand the whole passage first (surrounding cues are given as context), then say each idea the way a fluent native clinician would. Never translate word by word and never copy English sentence structure or idioms; use the natural equivalent in the target language.
- A cue can be part of a longer sentence: keep it natural on its own and let it connect smoothly with the neighbouring cues.
- Professional but plain register. If the language has no established term for a concept, use the clearest short description and keep the English/Latin term in brackets; never invent terminology.
- Clinical accuracy is non-negotiable: never add, omit, soften or strengthen a statement. Numbers, doses, thresholds, units, time windows, negations ("do not", "never", "unless") must keep exactly the same meaning. Re-check every number and negation.
- Keep ECG leads (V1–V9), units and customary abbreviations (ECG, CT, STEMI, MAP). Similar length to the source (up to ~20% longer is fine).
Output: one JSON object per line, exactly {"i": <cue index>, "t": "<translation>"}, only for the cues under "Cues", in the given order, and nothing else.`;

let samplePromise = null;
const getSample = () => (samplePromise ||= (window.claude?.use ? window.claude.use('sample') : Promise.resolve(null)));

export async function translateLive({ lang, source, from, onCues, signal, courseTitle }) {
  const sample = await getSample();
  if (!sample) {
    const e = new Error('Live AI translation works when this page is opened inside Claude (claude.ai). It is not available in this view.');
    e.code = 'unavailable'; throw e;
  }
  const order = [...source.filter((q) => q.idx >= from), ...source.filter((q) => q.idx < from)];
  // Live means speed: the fast model (no thinking pause) in small packages starting at the
  // playhead, so each sentence is ready before it is spoken. Website translation waits meanwhile.
  const parts = [order.slice(0, 2), ...Array.from({ length: Math.ceil(Math.max(0, order.length - 2) / 5) }, (_, k) => order.slice(2 + k * 5, 7 + k * 5))];
  liveStart();
  try { await runParts(parts); } finally { liveEnd(); }

  async function runParts(list) {
  for (const part of list) {
    if (signal.aborted) return;
    if (!part.length) continue;
    const first = part[0].idx; const last = part[part.length - 1].idx;
    const before = source.filter((q) => q.idx < first).slice(-3).map((q) => `- ${q.text}`).join('\n');
    const after = source.filter((q) => q.idx > last).slice(0, 2).map((q) => `- ${q.text}`).join('\n');
    const prompt = `${RULES}\n\nCourse: ${courseTitle}\nTranslate from English into ${languageName(lang)} (language code "${lang}").${before ? `\n\nContext before (do not translate):\n${before}` : ''}${after ? `\n\nContext after (do not translate):\n${after}` : ''}\n\nCues:\n${part.map((q) => JSON.stringify({ i: q.idx, speaker: q.speaker || null, text: q.text })).join('\n')}`;
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
      await sample(prompt, { signal, modelTier: 'quick', cache: { gcTime: 24 * 3600 * 1000 }, onText: ({ delta }) => eat(delta) });
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
}
