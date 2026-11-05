# From demo to a working product — steps

The demo runs without any external service. These are the steps to make the AI features real.
Estimated effort for 1–3 is one afternoon; 4–6 are separate projects.

## 1. Host the server (≈ 1 hour)
The app is one Node.js process plus a SQLite file. Any small VPS or container host works
(Hetzner, Fly.io, Render, Railway …). Needs Node ≥ 22.13, HTTPS, and a persistent disk.

```bash
git clone <repo> && cd medtranslate
npm ci --omit=dev
PUBLIC_URL=https://your-domain.tld ADMIN_PASSWORD=<strong> ANTHROPIC_API_KEY=sk-ant-… npm start
```
Put it behind a TLS reverse proxy (Caddy/nginx). Back up `data/` (database + secrets) daily.

## 2. Connect the translation AI (≈ 10 minutes + testing)
Create an API key in the Anthropic Console and set `ANTHROPIC_API_KEY`. Without further code:
- admin “Generate with AI” translates a whole course into a language (glossary enforced),
- viewers get **live AI subtitles** (`/api/courses/:slug/live-translate`, cached per sentence),
- the website translation (`/api/i18n/translate`) works for every language.
Set a monthly spend limit in the Console. The code path has not yet been run against the real API
in this repository's tests — run one course end-to-end before launch.

## 3. Translate in advance instead of live (recommended)
Live translation is the fallback. For the languages you care about, translate each course **once**,
review it, release it — viewers then get it instantly, at no per-view cost. Rough cost (estimate):
a one-hour lecture ≈ 10 000 words ≈ 25 000 output tokens per language ≈ US$0.50 with the large model,
about 1 cent with the small model, plus reviewer time.

## 4. Real voices (≈ 1–2 weeks)
The demo uses free offline voices (natural in 6 languages, robotic in the rest). For production use a
commercial neural TTS (Azure, Google, ElevenLabs …) in a worker that, per released language, renders
`tools/audio/generate_audio.py`-style tracks and stores them as HLS audio renditions. Check per language
that a voice really exists (coverage for e.g. Wolof, Lingala, Quechua is thin).
For *live* languages a voice requires a low-latency streaming TTS service called from the server.

## 5. Videos without a transcript (≈ 1 week)
Add speech-to-text (e.g. Whisper) in an upload worker that produces the time-coded transcript with
speaker labels; a human checks it. Everything downstream already works from that transcript.

## 6. Before real users
Signed licence contracts · lawyer review of all legal texts · real operator details (env `OPERATOR_*`) ·
Stripe keys + tax adviser · mail service (password reset, cancellation confirmations) · native medical
reviewers per language · real CDN/HLS video · monitoring and backups · 2FA for admins.
