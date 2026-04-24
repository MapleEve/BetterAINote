# Data Sources

`Data Sources` is where BetterAINote connects recording platforms such as DingTalk, TicNote, Plaud, Feishu Minutes, and iFLYTEK iflyrec. Each provider keeps its own account settings while the rest of the app uses a shared local library, transcription, and rename workflow.

BetterAINote is a preview self-hosted app. Source capabilities depend on the selected provider, the account, and what the source makes available.

## Credential Safety

- Store provider credentials only in your self-hosted BetterAINote settings or deployment environment.
- Do not paste private cookies, bearer strings, session values, or service keys into GitHub issues, pull requests, screenshots, logs, or public docs.
- When reporting a problem, share sanitized request shape, field names, HTTP status, and redacted response samples.
- Rotate any credential that may have been exposed outside your own deployment.

## Capability Overview

| Source | Connect | Import or sync records | Audio handling | Title write-back |
| --- | --- | --- | --- | --- |
| DingTalk / A1 / Flash Notes | Yes, with account credentials available to the operator | Available where the account exposes supported records | Available when the source returns usable audio information | Not advertised as a default capability |
| TicNote | Yes, China and international site modes | Yes | Available when source audio can be fetched | Supported |
| Plaud | Yes | Yes | Available when source audio can be fetched | Supported |
| Feishu Minutes | Yes, with available user credentials | Metadata and source details where available | Depends on account and source access | Not advertised as a default capability |
| iFLYTEK iflyrec | Import or inspect transcript-oriented records | Available for supported records | Source-dependent | Not advertised as a default capability |

This table is a user-facing setup guide, not a promise that every provider exposes the same fields or workflow.

## TicNote

TicNote can be configured for either site mode:

- China: `https://voice-api.ticnote.cn`
- International: `https://prd-backend-api.ticnote.com/api`

Setup notes:

- Choose the site mode in `Data Sources > TicNote`.
- Paste the credential requested by the settings page.
- Leave `Org ID` empty unless the app asks for it. BetterAINote can try to detect the organization for many accounts.
- If multiple organizations are detected, enter the one you want BetterAINote to use.

Title write-back:

- Enable `Write renamed title back to source` in `Data Sources > TicNote`.
- When enabled, local rename or AI Rename can try to update the title in TicNote.
- If the source rejects the update, the local title remains the source of truth inside BetterAINote.

## Plaud

Plaud is one recording source in BetterAINote's provider model.

Setup notes:

- Configure Plaud in `Data Sources > Plaud`.
- Sync brings supported records into the local library.
- Available audio can be archived to local storage and sent to private transcription.

Title write-back:

- Plaud supports the same public rename-back concept as TicNote when the account and source response allow it.
- Failed write-back should not prevent the local BetterAINote title from being saved.

## DingTalk / A1 / Flash Notes

DingTalk can be configured from `Data Sources > DingTalk`.

Setup notes:

- Use the credential mode shown in the settings page for your account.
- Save and test the connection before relying on scheduled sync.
- BetterAINote can import supported records and show source details when the account exposes them.

Audio and detail availability depends on the account and the source response. Keep screenshots and logs redacted when asking for help.

## Feishu Minutes

Feishu Minutes setup is intended for users who can provide the credentials requested by the settings page.

Setup notes:

- Configure the available user credential mode in `Data Sources > Feishu Minutes`.
- BetterAINote can show source metadata and details where access allows.
- Keep source credentials separate from transcription and title-generation service credentials.

## iFLYTEK iflyrec

iFLYTEK iflyrec is treated as a transcript-oriented source.

Setup notes:

- Use it for supported record import or detail inspection.
- Audio and title write-back behavior may differ from sources that expose downloadable recording files.

## Provider Settings Are Separate From Services

`Data Sources` only manages recording platforms. Other settings live elsewhere:

- `VoScript`: private transcription service.
- `Transcription`: shared transcription behavior.
- `AI Rename`: title generation and rename behavior.
- `Sync`: automatic sync interval and worker behavior.

Keeping these areas separate helps BetterAINote support DingTalk, TicNote, Plaud, and future sources without making the app feel tied to any single vendor.
