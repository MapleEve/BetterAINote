# Deployment

BetterAINote is currently a preview project for private self-hosting. The first public commit is not published as a release, and the recommended deployment target is a personal machine, home server, or private server you control.

## Runtime Shape

The supported preview runtime is:

- `app`: Next.js web UI and API.
- `worker`: background sync checks, transcription scheduling, and queued work.
- `SQLite`: local split databases for core settings, library records, transcripts, speaker data, and word timing.
- `storage`: local recording archive path.

Desktop packaging is not part of the current deployment target.

## Docker

```bash
docker compose up -d --build app worker
```

Recommended mounts:

- `/app/data`: SQLite database directory.
- `/app/audio`: local recording archive directory.

Example environment shape:

```env
DATABASE_PATH=/app/data/betterainote.db
APP_URL=http://localhost:3001
LOCAL_STORAGE_PATH=/app/audio
BETTER_AUTH_SECRET=<generate-a-strong-secret>
ENCRYPTION_KEY=<generate-a-strong-key>
```

Use deployment-specific values. Do not bake private credentials into images.

## Local Self-Hosting

```bash
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

The default local URL is `http://localhost:3001`.

## Storage Layout

`DATABASE_PATH` points to the core database. BetterAINote derives related SQLite files next to it:

- `betterainote.db`: auth, settings, source connections, and service credential metadata.
- `betterainote-library.db`: recording library and job state.
- `betterainote-transcripts.db`: transcript text and source-side details.
- `betterainote-voiceprints.db`: speaker profiles and speaker review state.
- `betterainote-words.db`: optional word-level timing sidecar.

Keep the database directory and audio archive backed up together if you want portable restores.

## Configuration Areas

The settings UI is grouped by capability:

| Group | Sections |
| --- | --- |
| Transcription & Services | `Transcription`, `AI Rename`, `VoScript` |
| Data Sources & Connections | `Data Sources`, `Sync` |
| App & Interface | `Playback`, `Display` |

Deployment should keep these responsibilities separate:

- `Data Sources` stores DingTalk, TicNote, Plaud, and other recording-source connection settings.
- `VoScript` stores private transcription service settings.
- `Transcription` controls shared transcription behavior.
- `AI Rename` controls title generation and rename behavior.
- `Sync` controls worker-driven automatic checks.

## Source Positioning

BetterAINote is a multi-source recording workspace. Plaud is one provider; DingTalk and TicNote are first-class setup targets for users with those accounts; Feishu Minutes and iflyrec can be connected or imported where supported.

Do not deploy BetterAINote as a Plaud-only service unless that is your own local choice. The public project direction is multi-source and self-hosting first.

## Security Checklist

- Generate strong values for auth and encryption secrets.
- Keep `.env.local`, database files, audio archives, and provider credentials out of git.
- Put the app behind your own network boundary or reverse proxy if exposing it beyond localhost.
- Review [Privacy](./PRIVACY.md) and [Security](../SECURITY.md) before sharing logs or issue reports.
