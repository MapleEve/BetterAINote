import { encrypt } from "@/lib/encryption";
import {
    normalizeFiniteNumber,
    normalizeNonNegativeInteger,
} from "@/lib/settings/number-normalization";
import { SettingsValidationError } from "@/lib/settings/validation";

export interface NormalizedVoScriptProviderInput {
    privateTranscriptionBaseUrl?: string | null;
    privateTranscriptionMinSpeakers?: number;
    privateTranscriptionMaxSpeakers?: number;
    privateTranscriptionDenoiseModel?: string;
    privateTranscriptionSnrThreshold?: number | null;
    privateTranscriptionNoRepeatNgramSize?: number;
    privateTranscriptionMaxInflightJobs?: number;
}

interface StoredVoScriptSpeakerSettings {
    speakerDiarization?: boolean | null;
    diarizationSpeakers?: number | null;
    privateTranscriptionMinSpeakers?: number | null;
    privateTranscriptionMaxSpeakers?: number | null;
}

function normalizePositiveStoredInteger(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : undefined;
}

export function normalizeVoScriptDenoiseModel(value: unknown) {
    if (typeof value !== "string") {
        throw new SettingsValidationError(
            "privateTranscriptionDenoiseModel must be one of none, deepfilternet, or noisereduce",
        );
    }

    const normalized = value.trim().toLowerCase();
    if (
        normalized !== "none" &&
        normalized !== "deepfilternet" &&
        normalized !== "noisereduce"
    ) {
        throw new SettingsValidationError(
            "privateTranscriptionDenoiseModel must be one of none, deepfilternet, or noisereduce",
        );
    }

    return normalized;
}

export function normalizePrivateTranscriptionApiKey(value: unknown) {
    if (value === null || value === "") {
        return null;
    }

    if (typeof value !== "string") {
        throw new SettingsValidationError(
            "privateTranscriptionApiKey must be a string or null",
        );
    }

    const trimmed = value.trim();
    return trimmed ? encrypt(trimmed) : null;
}

export function resolveVoScriptSpeakerBounds(params: {
    bodyMinSpeakers: unknown;
    bodyMaxSpeakers: unknown;
    existingMinSpeakers: number | null | undefined;
    existingMaxSpeakers: number | null | undefined;
}) {
    const nextMinSpeakers =
        params.bodyMinSpeakers !== undefined
            ? normalizeNonNegativeInteger(
                  "privateTranscriptionMinSpeakers",
                  params.bodyMinSpeakers,
              )
            : (params.existingMinSpeakers ?? 0);
    const nextMaxSpeakers =
        params.bodyMaxSpeakers !== undefined
            ? normalizeNonNegativeInteger(
                  "privateTranscriptionMaxSpeakers",
                  params.bodyMaxSpeakers,
              )
            : (params.existingMaxSpeakers ?? 0);

    if (
        nextMinSpeakers > 0 &&
        nextMaxSpeakers > 0 &&
        nextMaxSpeakers < nextMinSpeakers
    ) {
        throw new SettingsValidationError(
            "privateTranscriptionMaxSpeakers must be greater than or equal to privateTranscriptionMinSpeakers, or 0 for auto",
        );
    }

    return {
        nextMinSpeakers,
        nextMaxSpeakers,
    };
}

export function resolveVoScriptSpeakerBoundsFromStoredSettings(
    settings: StoredVoScriptSpeakerSettings | null | undefined,
) {
    const minSpeakers = normalizePositiveStoredInteger(
        settings?.privateTranscriptionMinSpeakers,
    );
    const maxSpeakers = normalizePositiveStoredInteger(
        settings?.privateTranscriptionMaxSpeakers,
    );

    if (minSpeakers !== undefined || maxSpeakers !== undefined) {
        return {
            minSpeakers,
            maxSpeakers,
            usesLegacySharedDiarization: false,
        };
    }

    const legacySpeakerCount =
        settings?.speakerDiarization === true
            ? normalizePositiveStoredInteger(settings.diarizationSpeakers)
            : undefined;

    if (legacySpeakerCount !== undefined) {
        return {
            minSpeakers: legacySpeakerCount,
            maxSpeakers: legacySpeakerCount,
            usesLegacySharedDiarization: true,
        };
    }

    return {
        minSpeakers: undefined,
        maxSpeakers: undefined,
        usesLegacySharedDiarization: false,
    };
}

export function normalizePrivateTranscriptionSnrThreshold(value: unknown) {
    return value === null
        ? null
        : normalizeFiniteNumber("privateTranscriptionSnrThreshold", value);
}

export function normalizePrivateTranscriptionNoRepeatNgramSize(value: unknown) {
    const normalized = normalizeNonNegativeInteger(
        "privateTranscriptionNoRepeatNgramSize",
        value,
    );

    if (normalized !== 0 && normalized < 3) {
        throw new SettingsValidationError(
            "privateTranscriptionNoRepeatNgramSize must be 0 or an integer greater than or equal to 3",
        );
    }

    return normalized;
}

export function normalizePrivateTranscriptionMaxInflightJobs(value: unknown) {
    return normalizeNonNegativeInteger(
        "privateTranscriptionMaxInflightJobs",
        value,
    );
}

export function buildVoScriptProviderUpdates(
    input: NormalizedVoScriptProviderInput,
) {
    const updates: Record<string, unknown> = {};

    if (input.privateTranscriptionBaseUrl !== undefined) {
        updates.privateTranscriptionBaseUrl = input.privateTranscriptionBaseUrl;
    }

    if (input.privateTranscriptionMinSpeakers !== undefined) {
        updates.privateTranscriptionMinSpeakers =
            input.privateTranscriptionMinSpeakers;
    }

    if (input.privateTranscriptionMaxSpeakers !== undefined) {
        updates.privateTranscriptionMaxSpeakers =
            input.privateTranscriptionMaxSpeakers;
    }

    if (input.privateTranscriptionDenoiseModel !== undefined) {
        updates.privateTranscriptionDenoiseModel =
            input.privateTranscriptionDenoiseModel;
    }

    if (input.privateTranscriptionSnrThreshold !== undefined) {
        updates.privateTranscriptionSnrThreshold =
            input.privateTranscriptionSnrThreshold;
    }

    if (input.privateTranscriptionNoRepeatNgramSize !== undefined) {
        updates.privateTranscriptionNoRepeatNgramSize =
            input.privateTranscriptionNoRepeatNgramSize;
    }

    if (input.privateTranscriptionMaxInflightJobs !== undefined) {
        updates.privateTranscriptionMaxInflightJobs =
            input.privateTranscriptionMaxInflightJobs;
    }

    return updates;
}
