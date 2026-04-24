# Development

BetterAINote is a preview self-hosted recording workspace. Development should preserve its public identity as an independent multi-source product for DingTalk, TicNote, Plaud, and similar recording platforms.

## Local Setup

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

Defaults:

- Web URL: `http://localhost:3001`
- `pnpm dev` starts the web app and worker together.
- `pnpm dev:web` starts only the web app.
- `pnpm worker` starts only the worker.

## Product Boundaries

- The current runtime is `web app + worker + SQLite`.
- The project is preview-stage and not published as a release yet.
- Self-hosting comes before packaged distribution.
- Recording sources and transcription services are separate layers.
- Plaud-specific naming, fields, or assumptions should not leak into shared UI or docs.

## Settings IA

The settings sidebar is grouped by capability:

| Group | Sections |
| --- | --- |
| Transcription & Services | `Transcription`, `AI Rename`, `VoScript` |
| Data Sources & Connections | `Data Sources`, `Sync` |
| App & Interface | `Playback`, `Display` |

Section responsibilities:

- `Data Sources`: provider connections for DingTalk, TicNote, Plaud, Feishu Minutes, iflyrec, and future sources.
- `Sync`: worker sync interval and manual sync behavior.
- `VoScript`: private transcription service endpoint and credential status.
- `Transcription`: shared transcription defaults.
- `AI Rename`: title generation and rename settings.
- `Playback`: audio playback behavior.
- `Display`: local UI preferences.

Keep section ids and runtime behavior stable unless a migration is intentionally planned.

## Data Layout

The main database path is configured through:

```env
DATABASE_PATH=./data/betterainote.db
```

Related SQLite files are derived next to it:

- `betterainote.db`: auth, settings, source connections, and service credential metadata.
- `betterainote-library.db`: recording library and job state.
- `betterainote-transcripts.db`: transcript text and source-side details.
- `betterainote-voiceprints.db`: speaker profiles and speaker review state.
- `betterainote-words.db`: optional word-level timing sidecar.

Local audio files are stored under `LOCAL_STORAGE_PATH`.

## Credential Ownership

- Recording-source credentials belong to provider connection settings.
- Private transcription and title-generation credentials belong to service settings.
- Non-secret preferences belong to user settings.
- Public docs, fixtures, and issue templates must use redacted placeholders.

Do not commit `.env.local`, database files, local audio archives, screenshots containing private sessions, or provider credentials.

## Source Development Guidelines

When adding or changing a provider:

- Keep provider-specific parsing and credential handling inside the provider layer.
- Return safe capability flags to the UI rather than hard-coding one provider as the default mental model.
- Treat title write-back as a provider capability. TicNote and Plaud support it; other sources should advertise it only when implemented and safe for users.
- Keep source-side detail views sanitized so they help users debug without exposing private credentials.
- Avoid public wording that implies all sources have identical audio, transcript, or rename behavior.

## Core Scripts

```bash
pnpm type-check
pnpm test
pnpm db:migrate
pnpm dev
pnpm dev:web
pnpm worker
```

Run the relevant checks before opening a pull request. For documentation-only changes, at minimum run markdown-safe diff checks and the repository's secret/string scans requested by the task.

## Public Documentation Rules

- Public docs should describe BetterAINote as an independent multi-source recording workspace.
- Use `preview`, `not published`, and `self-hosting first` for the current release state.
- License wording should say `custom license based on Apache License 2.0` or refer readers to `LICENSE`.
- Do not include private deployment values, provider credentials, local research notes, or unpublished execution plans.
