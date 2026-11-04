# MedTranslate

An AI-powered medical education (CME/CPD) platform that makes licensed video courses accessible worldwide through multilingual subtitles, AI-generated voice tracks and compliance-gated publishing.

> **Demo build.** All courses, providers, licences and translations are sample data and labelled as such. The providers are fictional, the videos are synthetic slide lectures, no course is accredited, and the demo translations have **not** been medically reviewed. Legal texts are drafts that must be reviewed by a lawyer before commercial launch.

## Quick start

Requirements: Node.js ≥ 22.13 (uses the built-in `node:sqlite`). No other dependencies are needed to run the demo.

```bash
npm start                     # http://localhost:3000
ADMIN_PASSWORD='choose-one' npm start   # optional: fixed admin password
npm test                      # integration tests (starts a server on a temp DB)
npm run reset-db              # wipe local DB → demo data is re-seeded on next start
npm run media                 # regenerate demo videos/posters (needs ffmpeg)
```

On first start the database is seeded and an admin account is printed to the console (`admin@medtranslate.local`). See `.env.example` for all settings.

## What's included

| Area | Highlights |
|---|---|
| **Website** | Home (10 sections), course catalogue with 8 filters + sort, specialties, technology, pricing, partner programme, about, FAQ, contact |
| **Player** | One continuous `<video>` session — subtitles and audio switch language **without reloading**; overlay subtitles (size, position, background), RTL support, speaker labels, chapters, transcript, speed, keyboard shortcuts, fullscreen, resume, preview limit/paywall |
| **AI audio** | Per-cue, time-fitted speech with distinct voices per speaker (browser Web Speech API in the demo); interface for server-rendered dubbed tracks kept in sync with drift correction |
| **AI translation** | Claude via the official SDK with glossary enforcement and meaning-preservation rules, structured JSON output, flagged uncertain cues. Not connected without `ANTHROPIC_API_KEY` — then WebVTT/SRT import + manual post-editing |
| **Accounts** | Registration (data-minimal), my courses, progress, saved, history, completion records/certificates, subscription, invoices, settings, GDPR export & deletion |
| **Payments** | Monthly / yearly / institutional plans, EUR/USD/GBP, single-course purchase, VAT (OSS, indicative), § 356 (5) BGB withdrawal waiver, cancellation, invoices. Stripe Checkout + signed webhook when configured, otherwise clearly flagged demo mode |
| **Compliance** | Licence register (7 rights, territories, languages, term) · publication gate · per-language release gate (licence + QC approval) · automatic suspension when clearances break · territory enforcement at playback (HTTP 451) · honest accreditation states (credits only with verified evidence) · AI labelling · notice-and-takedown · § 312k “Verträge hier kündigen” · cookie consent with logged consent records · audit log |
| **Admin** | Overview stats, courses (details, video upload, licence, accreditation, transcript), translation QC queue with side-by-side editor and documented reviews, glossary, users/roles, subscriptions & invoices, prices & plans, partner leads, complaints, specialties/providers, audit log |
| **Legal pages (DE, drafts)** | Impressum, Datenschutz, AGB, Widerrufsbelehrung, Cookie-Richtlinie, Urheberrecht, KI-Transparenz, Medizinischer Haftungsausschluss, CME/CPD-Akkreditierung, Meldeformular |

## Architecture

```
server/
  server.js          HTTP server: security headers (CSP, …), CSRF check, static files, SPA fallback, sitemap/robots
  db.js / seed.js    SQLite schema + demo seed (seed-data.js holds all demo content)
  auth.js            scrypt passwords, hashed session tokens, HttpOnly cookies
  compliance.js      licence/accreditation/translation gates, territory + entitlement rules
  catalog.js         course serialisation
  routes/            public, account (incl. GDPR), commerce (checkout, cancellation, Stripe webhook), admin
  services/          translation (Claude), payments (Stripe/demo), media (signed URLs, range streaming), vtt
public/              Vanilla-JS SPA (ES modules, no build step): app.js router, player.js, views/*, css/app.css
media/               Demo videos (signed access) and posters
tools/               generate-media.mjs, reset-db.mjs
test/                Integration tests (node:test)
```

### Production notes
- Run behind HTTPS (`PUBLIC_URL=https://…`) for Secure cookies and HSTS.
- Move media to object storage + CDN with HLS/CMAF renditions and CDN-signed URLs (`services/media.js` mirrors that pattern); add per-language dubbed audio as HLS alternate audio renditions.
- Replace SQLite with PostgreSQL for multi-instance deployments; move the in-memory rate limiter to Redis.
- Configure a mail service (password reset, cancellation confirmations) — currently marked as not connected.
- Sign data processing agreements (Art. 28 GDPR) with hosting, payment, AI and mail providers; complete the placeholders in the legal texts and have them reviewed by a lawyer.
- Only publish content with signed licences; never enter CME credits that an accrediting body has not granted.
