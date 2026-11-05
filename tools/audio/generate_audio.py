"""Generate time-synchronised AI voice tracks for the demo courses.

For every published course and every released language this renders each
subtitle cue with a text-to-speech engine, fits it into the cue's time slot
(time-stretching when necessary) and assembles one audio track per language:

    media/audio/<slug>/<lang>.m4a        dubbed tracks (served as separate audio)
    media/videos/<slug>.mp4              original-language narration muxed in
    media/audio/manifest.json            what exists (read by the server at start)

Engines (both run fully offline):
  * Piper (neural)   – en, de, fr, es, pt, zh      voices: tools/audio/voices/*.onnx
  * eSpeak NG        – ar, tr, hi, sw, am           via the espeakng-loader wheel
Languages without a usable engine (e.g. ja, ha) stay subtitle-only.

Usage (see tools/audio/README.md):
    python tools/audio/generate_audio.py --db data/medtranslate.db --voices <dir>
"""
import argparse
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
from array import array

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SR = 22050

PIPER = {  # language -> {speaker: (voice file, pitch factor)}
    "en": {"Host": ("en-us-lessac-medium", 1.0), "Expert": ("en-us-ryan-medium", 1.0)},
    "de": {"Host": ("de-eva_k-x-low", 1.0), "Expert": ("de-thorsten-low", 1.0)},
    "es": {"Host": ("es-mls_10246-low", 1.0), "Expert": ("es-carlfm-x-low", 1.0)},
    "fr": {"Host": ("fr-siwis-medium", 1.0), "Expert": ("fr-siwis-medium", 0.86)},
    "pt": {"Host": ("pt-br-edresson-low", 1.12), "Expert": ("pt-br-edresson-low", 1.0)},
    "zh": {"Host": ("zh-cn-huayan-x-low", 1.0), "Expert": ("zh-cn-huayan-x-low", 0.86)},
}
ESPEAK = {  # language -> {speaker: espeak voice}
    "ar": {"Host": "ar+f3", "Expert": "ar+m3"},
    "tr": {"Host": "tr+f3", "Expert": "tr+m3"},
    "hi": {"Host": "hi+f3", "Expert": "hi+m3"},
    "sw": {"Host": "sw+f3", "Expert": "sw+m3"},
    "am": {"Host": "am+f3", "Expert": "am+m3"},
}


def ffmpeg_pcm(pcm, sr, filters):
    """Run raw mono s16 PCM through ffmpeg filters, return PCM at SR."""
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "pipe:0",
         "-af", filters + f",aresample={SR}", "-f", "s16le", "-ac", "1", "pipe:1"],
        input=pcm, capture_output=True, check=True)
    return p.stdout


class Engines:
    def __init__(self, voices_dir):
        self.voices_dir = voices_dir
        self.piper = {}
        self.espeak = None

    def synth(self, lang, speaker, text):
        """Return (pcm bytes, sample rate, pitch factor) or None if unsupported."""
        if lang in PIPER:
            spk = PIPER[lang].get(speaker) or next(iter(PIPER[lang].values()))
            name, pitch = spk
            if name not in self.piper:
                from piper import PiperVoice
                self.piper[name] = PiperVoice.load(os.path.join(self.voices_dir, name + ".onnx"))
            chunks = list(self.piper[name].synthesize(text))
            return b"".join(c.audio_int16_bytes for c in chunks), chunks[0].sample_rate, pitch
        if lang in ESPEAK:
            if self.espeak is None:
                sys.path.insert(0, os.path.dirname(__file__))
                import espeak  # noqa: E402
                self.espeak = espeak
            voice = ESPEAK[lang].get(speaker) or next(iter(ESPEAK[lang].values()))
            pcm, sr = self.espeak.synth(text, voice, rate_wpm=160)
            return pcm, sr, 1.0
        return None


def fit(pcm, sr, pitch, slot):
    """Pitch-shift (optional) and time-stretch so the clip fits `slot` seconds."""
    dur = len(pcm) / 2 / sr
    filters = ["anull"]
    if pitch != 1.0:
        filters += [f"asetrate={int(sr * pitch)}", f"aresample={sr}", f"atempo={1 / pitch:.4f}"]
    if dur > slot:
        tempo = min(dur / slot, 1.7)
        while tempo > 2.0:
            filters.append("atempo=2.0"); tempo /= 2.0
        filters.append(f"atempo={tempo:.4f}")
    return ffmpeg_pcm(pcm, sr, ",".join(filters))


def render_track(engines, lang, cues, texts, total):
    out = array("h", bytes(int(total * SR) * 2))
    for i, cue in enumerate(cues):
        text = texts[i]
        if not text.strip():
            continue
        res = engines.synth(lang, cue["speaker"] or "Expert", text)
        if res is None:
            return None
        pcm, sr, pitch = res
        next_start = cues[i + 1]["start"] if i + 1 < len(cues) else total
        slot = max(0.6, min(cue["end"], next_start) - cue["start"] - 0.12)
        clip = array("h"); clip.frombytes(fit(pcm, sr, pitch, slot))
        start = int((cue["start"] + 0.05) * SR)
        end_limit = int(next_start * SR) - 1
        n = min(len(clip), end_limit - start, len(out) - start)
        fade = min(int(0.02 * SR), n)
        for k in range(n):
            v = clip[k]
            if k >= n - fade:
                v = int(v * (n - k) / fade)
            out[start + k] = v
    return out.tobytes()


def encode(pcm, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
                    "-af", "highpass=f=70,dynaudnorm=f=200:g=11", "-c:a", "aac", "-b:a", "40k", "-movflags", "+faststart", path],
                   input=pcm, check=True)


def mux_original(video, pcm):
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "a.m4a")
        encode(pcm, wav)
        silent = os.path.join(tmp, "v.mp4")
        # Re-mux from the video stream only, so repeated runs replace (not stack) audio.
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-map", "0:v:0", "-c", "copy", silent], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", silent, "-i", wav, "-map", "0:v:0", "-map", "1:a:0",
                        "-c", "copy", "-shortest", "-movflags", "+faststart", video], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.path.join(ROOT, "data", "medtranslate.db"))
    ap.add_argument("--voices", default=os.path.join(os.path.dirname(__file__), "voices"))
    ap.add_argument("--only", nargs="*", help="limit to these course slugs")
    args = ap.parse_args()

    db = sqlite3.connect(args.db)
    db.row_factory = sqlite3.Row
    engines = Engines(args.voices)
    manifest = {}
    courses = db.execute("SELECT id, slug, duration_sec, original_language, media_file FROM courses WHERE is_demo = 1").fetchall()
    for c in courses:
        if args.only and c["slug"] not in args.only:
            continue
        cues = [dict(r) | {"start": r["start_sec"], "end": r["end_sec"]} for r in
                db.execute("SELECT idx, start_sec, end_sec, speaker, text FROM cues WHERE course_id = ? ORDER BY idx", (c["id"],))]
        entry = manifest.setdefault(c["slug"], {"original": False, "languages": []})
        total = c["duration_sec"]
        pcm = render_track(engines, c["original_language"], cues, [q["text"] for q in cues], total)
        if pcm:
            mux_original(os.path.join(ROOT, "media", c["media_file"]), pcm)
            entry["original"] = True
        langs = db.execute("SELECT id, language FROM translations WHERE course_id = ? AND status = 'released'", (c["id"],)).fetchall()
        for t in langs:
            texts = {r["idx"]: r["text"] for r in db.execute("SELECT idx, text FROM translation_cues WHERE translation_id = ?", (t["id"],))}
            pcm = render_track(engines, t["language"], cues, [texts.get(q["idx"], "") for q in cues], total)
            if pcm is None:
                continue
            encode(pcm, os.path.join(ROOT, "media", "audio", c["slug"], f"{t['language']}.m4a"))
            entry["languages"].append(t["language"])
        print(f"✓ {c['slug']}: original={'yes' if entry['original'] else 'no'} dubbed={','.join(sorted(entry['languages'])) or '-'}", flush=True)
    path = os.path.join(ROOT, "media", "audio", "manifest.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    old = {}
    if os.path.exists(path):
        with open(path) as f:
            old = json.load(f)
    old.update(manifest)
    with open(path, "w") as f:
        json.dump(old, f, indent=2, sort_keys=True)


if __name__ == "__main__":
    main()
