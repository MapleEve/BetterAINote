# API

BetterAINote exposes local API routes for the web app, worker, and self-hosted integrations. The API is preview-stage and intended for private deployments first. Endpoint names may still change before the first published release.

## Authentication Model

API access is tied to the same self-hosted BetterAINote instance and account boundary as the web app.

- Browser requests use the session established by the local web app.
- Server-to-server access should use a deployment-controlled secret or integration key when that mode is enabled by the operator.
- Provider credentials for DingTalk, TicNote, Plaud, and other sources are never returned in full by public API responses.
- Service credentials for transcription or title generation should be configured through settings or environment-managed deployment flows, not embedded in client code.

Example authenticated request shape:

```http
GET /api/recordings/query HTTP/1.1
Host: localhost:3001
Authorization: Bearer <redacted-session-or-integration-key>
Accept: application/json
```

## Common Endpoints

| Area | Endpoint | Purpose |
| --- | --- | --- |
| Sync | `GET /api/data-sources/sync` | Read sync status for enabled sources. |
| Sync | `POST /api/data-sources/sync` | Request a sync run. |
| Data sources | `GET /api/data-sources` | Read configured source status and safe metadata. |
| Data sources | `PUT /api/data-sources` | Save source settings for the current deployment. |
| Recordings | `GET /api/recordings/query` | Query local recording library entries. |
| Recordings | `GET /api/recordings/:id` | Read one local recording entry. |
| Recordings | `GET /api/recordings/:id/audio` | Stream or download local audio when available. |
| Recordings | `GET /api/recordings/:id/source-report` | Read safe source-side details cached locally. |
| Transcription | `POST /api/recordings/:id/transcribe` | Submit a local transcription job. |
| Transcription | `GET /api/recordings/:id/transcribe` | Read transcription job status. |
| Transcription | `GET /api/recordings/:id/transcript/raw` | Read raw transcript text and metadata. |
| Speakers | `GET /api/recordings/:id/speakers` | Read speaker review data. |
| Speakers | `PATCH /api/recordings/:id/speakers` | Save speaker review edits. |
| Speakers | `GET /api/speakers/profiles` | List saved speaker profiles. |
| Rename | `PATCH /api/recordings/:id/rename` | Rename a local recording entry. |
| Rename | `POST /api/recordings/:id/rename/auto` | Generate a title from transcript context. |

## Request Examples

Query recordings:

```http
GET /api/recordings/query?limit=20&source=ticnote HTTP/1.1
Host: localhost:3001
Authorization: Bearer <redacted>
Accept: application/json
```

Rename a recording locally:

```http
PATCH /api/recordings/rec_123/rename HTTP/1.1
Host: localhost:3001
Authorization: Bearer <redacted>
Content-Type: application/json

{
  "title": "Weekly product review"
}
```

Start private transcription:

```http
POST /api/recordings/rec_123/transcribe HTTP/1.1
Host: localhost:3001
Authorization: Bearer <redacted>
Content-Type: application/json

{
  "service": "voscript",
  "language": "auto"
}
```

## Response Examples

Recording query response:

```json
{
  "items": [
    {
      "id": "rec_123",
      "source": "ticnote",
      "title": "Weekly product review",
      "startedAt": "2026-04-24T09:30:00.000Z",
      "durationSeconds": 1840,
      "audio": {
        "available": true,
        "localPath": null
      },
      "transcript": {
        "status": "ready"
      }
    }
  ],
  "nextCursor": null
}
```

Sync response:

```json
{
  "status": "queued",
  "sources": ["plaud", "ticnote", "dingtalk"],
  "requestedAt": "2026-04-24T10:00:00.000Z"
}
```

Error response:

```json
{
  "error": {
    "code": "SOURCE_AUTH_FAILED",
    "message": "The selected source credentials need attention.",
    "requestId": "req_preview_123"
  }
}
```

## Error Semantics

| HTTP status | Meaning |
| --- | --- |
| `400` | The request payload is invalid or missing required fields. |
| `401` | Authentication is missing or expired. |
| `403` | The current account or integration key cannot perform the action. |
| `404` | The local resource does not exist. |
| `409` | The resource is in a conflicting state, such as a transcription job already running. |
| `422` | The request is valid JSON but cannot be processed for the selected source or recording. |
| `429` | The instance is applying a local rate or concurrency limit. |
| `500` | The instance failed unexpectedly. Check sanitized server logs. |
| `502` | A configured source or service returned an upstream error. |
| `503` | A worker, source, or transcription service is temporarily unavailable. |

Error codes are stable enough for UI handling, but preview integrations should still keep a fallback for unknown codes.

## Sensitive Field Redaction

Public API responses should redact or omit sensitive fields:

- Provider cookies, bearer strings, refresh credentials, and source-specific session fields.
- Transcription, title-generation, or storage service secrets.
- Local filesystem paths unless the endpoint explicitly needs to expose a user-facing file action.
- Raw upstream headers and request bodies from third-party services.

Use placeholders such as `<redacted>` in examples, issues, logs, and screenshots. When reporting bugs, include endpoint names, HTTP status, safe field names, and sanitized response shapes only.
