# Changelog

## 2026-04 Preview

BetterAINote is in preview and has not been published as a release yet. The first public baseline focuses on private self-hosting, safe documentation, and the multi-source recording workspace direction.

### Added

- Public product positioning for DingTalk, TicNote, Plaud, and other recording-platform users.
- Web app plus worker runtime for local sync, transcription scheduling, and recording-library management.
- Split SQLite storage for core settings, library records, transcripts, speaker data, and optional word timing.
- `Data Sources`, `Sync`, `VoScript`, `Transcription`, `AI Rename`, `Playback`, and `Display` settings areas.
- Source-side detail views and local transcript views for supported recording records.

### Changed

- Public docs now describe BetterAINote as an independent multi-source recording workspace rather than a Plaud-centered project.
- Deployment guidance now emphasizes preview status, private self-hosting first, and local credential ownership.
- Source wording now avoids promising identical behavior across every provider.

### Notes

- TicNote and Plaud support title write-back when enabled and accepted by the source.
- DingTalk, Feishu Minutes, and iflyrec capabilities depend on account access and the data each source makes available.
- Packaged releases and broader distribution are intentionally outside this preview baseline.
