const VOSCRIPT_SETTINGS_ENDPOINT = "/api/settings/voscript";
const VOSCRIPT_DENOISE_MODELS = [
    "none",
    "deepfilternet",
    "noisereduce",
] as const;

export type VoScriptDenoiseModel = (typeof VOSCRIPT_DENOISE_MODELS)[number];

export interface VoScriptSettings {
    privateTranscriptionBaseUrl: string | null;
    privateTranscriptionApiKeySet: boolean;
    privateTranscriptionMinSpeakers: number;
    privateTranscriptionMaxSpeakers: number;
    privateTranscriptionDenoiseModel: VoScriptDenoiseModel;
    privateTranscriptionSnrThreshold: number | null;
    privateTranscriptionNoRepeatNgramSize: number;
    privateTranscriptionMaxInflightJobs: number;
}

export interface VoScriptSettingsUpdate {
    privateTranscriptionBaseUrl?: string | null;
    privateTranscriptionApiKey?: string | null;
    privateTranscriptionMinSpeakers?: number;
    privateTranscriptionMaxSpeakers?: number;
    privateTranscriptionDenoiseModel?: VoScriptDenoiseModel;
    privateTranscriptionSnrThreshold?: number | null;
    privateTranscriptionNoRepeatNgramSize?: number;
    privateTranscriptionMaxInflightJobs?: number;
}

const DEFAULT_VOSCRIPT_SETTINGS: VoScriptSettings = {
    privateTranscriptionBaseUrl: null,
    privateTranscriptionApiKeySet: false,
    privateTranscriptionMinSpeakers: 0,
    privateTranscriptionMaxSpeakers: 0,
    privateTranscriptionDenoiseModel: "none",
    privateTranscriptionSnrThreshold: null,
    privateTranscriptionNoRepeatNgramSize: 0,
    privateTranscriptionMaxInflightJobs: 1,
};

function normalizeNullableString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeNonNegativeInteger(value: unknown, fallbackValue: number) {
    return typeof value === "number" &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= 0
        ? value
        : fallbackValue;
}

function normalizeNullableFiniteNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeDenoiseModel(value: unknown): VoScriptDenoiseModel {
    return typeof value === "string" &&
        VOSCRIPT_DENOISE_MODELS.includes(value as VoScriptDenoiseModel)
        ? (value as VoScriptDenoiseModel)
        : DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionDenoiseModel;
}

function normalizeVoScriptSettingsResponse(payload: unknown): VoScriptSettings {
    const data =
        typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>)
            : {};

    return {
        privateTranscriptionBaseUrl: normalizeNullableString(
            data.privateTranscriptionBaseUrl,
        ),
        privateTranscriptionApiKeySet:
            typeof data.privateTranscriptionApiKeySet === "boolean"
                ? data.privateTranscriptionApiKeySet
                : DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionApiKeySet,
        privateTranscriptionMinSpeakers: normalizeNonNegativeInteger(
            data.privateTranscriptionMinSpeakers,
            DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionMinSpeakers,
        ),
        privateTranscriptionMaxSpeakers: normalizeNonNegativeInteger(
            data.privateTranscriptionMaxSpeakers,
            DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionMaxSpeakers,
        ),
        privateTranscriptionDenoiseModel: normalizeDenoiseModel(
            data.privateTranscriptionDenoiseModel,
        ),
        privateTranscriptionSnrThreshold: normalizeNullableFiniteNumber(
            data.privateTranscriptionSnrThreshold,
        ),
        privateTranscriptionNoRepeatNgramSize: normalizeNonNegativeInteger(
            data.privateTranscriptionNoRepeatNgramSize,
            DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionNoRepeatNgramSize,
        ),
        privateTranscriptionMaxInflightJobs: normalizeNonNegativeInteger(
            data.privateTranscriptionMaxInflightJobs,
            DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionMaxInflightJobs,
        ),
    };
}

async function createResponseError(
    response: Response,
    fallbackMessage: string,
) {
    try {
        const data = (await response.json()) as { error?: string };
        return new Error(data.error || fallbackMessage);
    } catch {
        return new Error(fallbackMessage);
    }
}

export function getDefaultVoScriptSettings(): VoScriptSettings {
    return { ...DEFAULT_VOSCRIPT_SETTINGS };
}

export async function fetchVoScriptSettings() {
    const response = await fetch(VOSCRIPT_SETTINGS_ENDPOINT, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to fetch VoScript settings",
        );
    }

    return normalizeVoScriptSettingsResponse(await response.json());
}

export async function updateVoScriptSettings(
    updates: VoScriptSettingsUpdate,
): Promise<void> {
    if (Object.keys(updates).length === 0) {
        return;
    }

    const response = await fetch(VOSCRIPT_SETTINGS_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to update VoScript settings",
        );
    }
}
