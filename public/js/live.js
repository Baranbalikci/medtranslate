// Live AI subtitles — server implementation. The server translates the
// transcript in small chunks (starting at the playhead) with Claude and caches
// the result. Unreviewed machine translation; the UI labels it as such.
import { api } from './api.js';

export const liveProvider = 'server';

/**
 * @param {{slug:string, lang:string, source:{idx:number}[], from:number, onCues:(c:{idx:number,text:string}[])=>void, signal:AbortSignal}} o
 */
export async function translateLive({ slug, lang, source, from, onCues, signal }) {
  const order = [...source.filter((q) => q.idx >= from), ...source.filter((q) => q.idx < from)];
  const chunk = 6;
  for (let i = 0; i < order.length; i += chunk) {
    if (signal.aborted) return;
    const start = order[i].idx;
    const res = await api(`/api/courses/${encodeURIComponent(slug)}/live-translate`, { method: 'POST', body: { language: lang, from: start, count: chunk } });
    if (signal.aborted) return;
    onCues(res.cues.map((c) => ({ idx: c.idx, text: c.text })));
  }
}
