import { buildCoreTranscriptionSettingsUpdates } from "@/lib/settings/transcription-settings-body";

export function buildTranscriptionSettingsUpdates(
    body: Record<string, unknown>,
) {
    return buildCoreTranscriptionSettingsUpdates(body);
}
