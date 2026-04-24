## Agent Guidance

This repository is a public BetterAINote codebase. Automated coding agents and
human contributors should keep changes small, reviewable, and safe for a
self-hosted recording workspace.

### Working Rules

- Inspect the existing implementation before changing behavior.
- Do not commit secrets, tokens, cookies, private IDs, environment files,
  personal meeting content, screenshots with private data, or local filesystem
  paths.
- Prefer focused changes that match the current architecture and documented
  product scope.
- Keep user-facing documentation accurate and avoid overstating license,
  release, or provider support.
- Run the most relevant tests and checks before reporting work as complete.
- Do not publish packages, push branches, add remotes, or change repository
  history unless explicitly requested by a maintainer.

### Product Priorities

- Privacy-first self-hosting defaults.
- Clear setup and recovery paths for local deployments.
- Fast, low-friction recording import, sync, transcription, and review flows.
- Conservative handling of credentials and upstream provider data.
