import type { userSettings } from "@/db/schema/core";
import { normalizePrivateTranscriptionApiKey } from "@/lib/settings/voscript-provider-settings";
import { buildVoScriptSettingsBodyUpdates } from "@/lib/settings/voscript-settings-body";

type UserSettingsRow = typeof userSettings.$inferSelect | null;

export { normalizeVoScriptDenoiseModel } from "@/lib/settings/voscript-provider-settings";

export function buildVoScriptSettingsUpdates(
    body: Record<string, unknown>,
    existing: UserSettingsRow,
) {
    return buildVoScriptSettingsBodyUpdates(body, {
        privateTranscriptionMinSpeakers:
            existing?.privateTranscriptionMinSpeakers,
        privateTranscriptionMaxSpeakers:
            existing?.privateTranscriptionMaxSpeakers,
    });
}

export function buildVoScriptApiKeyUpdate(body: Record<string, unknown>) {
    if (body.privateTranscriptionApiKey === undefined) {
        return undefined;
    }

    return normalizePrivateTranscriptionApiKey(body.privateTranscriptionApiKey);
}
