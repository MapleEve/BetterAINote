import {
    normalizeBooleanSetting,
    normalizeStringOrNullSetting,
} from "@/lib/settings/value-normalization";

function buildTranscriptionBehaviorUpdates(body: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};

    if (body.autoTranscribe !== undefined) {
        updates.autoTranscribe = normalizeBooleanSetting(
            "autoTranscribe",
            body.autoTranscribe,
        );
    }

    if (body.defaultTranscriptionLanguage !== undefined) {
        updates.defaultTranscriptionLanguage = normalizeStringOrNullSetting(
            "defaultTranscriptionLanguage",
            body.defaultTranscriptionLanguage,
        );
    }

    return updates;
}

export function buildCoreTranscriptionSettingsUpdates(
    body: Record<string, unknown>,
) {
    return buildTranscriptionBehaviorUpdates(body);
}
