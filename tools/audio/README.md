# AI voice tracks (demo)

`generate_audio.py` renders one time-synchronised voice track per course and released language, and muxes the original-language narration into the demo videos. Every sentence is fitted into its subtitle time slot (time-stretched if needed), so audio and video stay in sync.

| Engine | Languages | Notes |
|---|---|---|
| [Piper](https://github.com/rhasspy/piper) (neural, offline) | en, de, fr, es, pt, zh | Voices from the Piper v0.0.2 release (`voice-<name>.tar.gz`) |
| eSpeak NG (formant, offline) | ar, tr, hi, sw, am | Via the `espeakng-loader` wheel — intelligible but synthetic |
| none yet | ja, ha | Player falls back to the device voice or subtitles |

```bash
python3 -m venv .venv && .venv/bin/pip install piper-tts espeakng-loader
mkdir -p tools/audio/voices && cd tools/audio/voices
for v in en-us-lessac-medium en-us-ryan-medium de-thorsten-low de-eva_k-x-low fr-siwis-medium \
         es-carlfm-x-low es-mls_10246-low pt-br-edresson-low zh-cn-huayan-x-low; do
  curl -sSL https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-$v.tar.gz | tar xz
done
cd -
npm start            # once, so the database is seeded
.venv/bin/python tools/audio/generate_audio.py
```

The server reads `media/audio/manifest.json` on start and switches the demo translations to these tracks. Production would use a commercial neural TTS / dubbing service with speaker cloning behind the same interface (`translations.audio_mode = 'file'`).
