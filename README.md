<div align="center">

# BetterAINote

> A private recording workspace for people who use DingTalk, TicNote, Plaud, and other recording platforms.

![Status](https://img.shields.io/badge/status-preview-lightgrey?style=flat-square)
![Runtime](https://img.shields.io/badge/runtime-web%20app%20%2B%20worker-blue?style=flat-square)
![Storage](https://img.shields.io/badge/storage-SQLite-green?style=flat-square)
[![License](https://img.shields.io/badge/license-custom%20based%20on%20Apache%202.0-orange?style=flat-square)](./LICENSE)

[API](./docs/API.md) · [Data Sources](./docs/DATA_SOURCES.md) · [Deployment](./docs/DEPLOYMENT.md) · [Development](./docs/DEVELOPMENT.md) · [Security](./SECURITY.md) · [Privacy](./docs/PRIVACY.md)

</div>

---

BetterAINote is a self-hosted consumer recording desk for people who already have recordings across DingTalk, TicNote, Plaud, and similar platforms. It brings source records, local audio files, private transcription, speaker review, and AI-assisted titles into one local workspace.

This repository is in **preview**. The first public commit is **not published as a release** yet. The current priority is self-hosted use, clear documentation, and a safe public baseline before packaged releases.

BetterAINote is an independent product. Plaud is one supported recording source, not the center of the product or the project identity.

## Who It Is For

- Individuals who want a private recording library instead of scattered vendor portals.
- Users who want to keep recordings, SQLite data, and service credentials on their own machine or server.
- People combining source-side records with private transcription services such as VoScript.
- Builders who want a local-first recording workflow that can later connect to other tools.

## What It Does

- Connects multiple recording sources from a unified `Data Sources` settings area.
- Stores library records, transcripts, speaker data, and configuration in local SQLite databases.
- Archives available audio files to local storage that can be mapped to a disk or NAS path.
- Runs a web app plus a worker for sync checks, transcription dispatch, and background tasks.
- Keeps recording providers separate from transcription services and AI title generation.
- Supports speaker review, transcript viewing, and local rename workflows.

## Source Support

BetterAINote uses a provider model so each recording source can expose the capabilities it actually supports.

| Source | Public positioning |
| --- | --- |
| DingTalk / A1 / Flash Notes | Connect account credentials, sync available records, and inspect source details where supported by the account. |
| TicNote | Connect China or international accounts, sync recordings, and optionally write renamed titles back to the source. |
| Plaud | Connect Plaud as one recording source, sync records, download available audio, and optionally write renamed titles back to the source. |
| Feishu Minutes | Connect with available user credentials and view supported source metadata. |
| iFLYTEK iflyrec | Import or inspect transcript-oriented records where supported. |

See [Data Sources](./docs/DATA_SOURCES.md) for setup notes and safety guidance.

## Quick Start

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3001`, create the first admin account, then configure:

- `Data Sources` for DingTalk, TicNote, Plaud, or another recording source.
- `VoScript` for private transcription service access.
- `Transcription` for shared transcription behavior.
- `AI Rename` for title generation and rename settings.
- `Sync`, `Playback`, and `Display` for app behavior.

Use strong local secrets in `.env.local`. Do not commit private credentials or production configuration.

## Deployment Shape

The preview runtime is:

- `app`: Next.js web UI and API routes.
- `worker`: background sync and transcription scheduling.
- `SQLite`: split local databases for core settings, library records, transcripts, voiceprints, and word timing.
- `storage`: local audio/archive directory.

Docker and local self-hosting are the intended first deployment modes. Desktop packaging is not part of the current release boundary.

## Documentation

| Topic | Link |
| --- | --- |
| API reference | [docs/API.md](./docs/API.md) |
| Data source setup | [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) |
| Deployment | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) |
| Development | [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) |
| Auto sync | [docs/AUTO_SYNC.md](./docs/AUTO_SYNC.md) |
| Privacy | [docs/PRIVACY.md](./docs/PRIVACY.md) |
| Security | [SECURITY.md](./SECURITY.md) |
| Contributing | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Changelog | [CHANGELOG.md](./CHANGELOG.md) |

## License

BetterAINote uses a custom license based on Apache License 2.0. See [LICENSE](./LICENSE) for the exact terms.
