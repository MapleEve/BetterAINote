import { SettingsValidationError } from "@/lib/settings/validation";
import {
    normalizeBooleanSetting,
    normalizeStringOrNullSetting,
} from "@/lib/settings/value-normalization";

export const DEFAULT_TRANSCRIPTION_PROVIDERS = [
    "dingtalk-a1",
    "ticnote",
    "feishu-minutes",
] as const;

export type DefaultTranscriptionProvider =
    (typeof DEFAULT_TRANSCRIPTION_PROVIDERS)[number];

export function isDefaultTranscriptionProvider(
    value: unknown,
): value is DefaultTranscriptionProvider {
    return (
        typeof value === "string" &&
        (DEFAULT_TRANSCRIPTION_PROVIDERS as readonly string[]).includes(value)
    );
}

function normalizeDefaultTranscriptionProvider(value: unknown) {
    if (value === null) {
        return null;
    }

    if (!isDefaultTranscriptionProvider(value)) {
        throw new SettingsValidationError(
            `defaultTranscriptionProvider must be one of ${DEFAULT_TRANSCRIPTION_PROVIDERS.join(", ")} or null`,
        );
    }

    return value;
}

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

    if (body.defaultTranscriptionProvider !== undefined) {
        updates.defaultTranscriptionProvider =
            normalizeDefaultTranscriptionProvider(
                body.defaultTranscriptionProvider,
            );
    }

    return updates;
}

export function buildCoreTranscriptionSettingsUpdates(
    body: Record<string, unknown>,
) {
    return buildTranscriptionBehaviorUpdates(body);
}
