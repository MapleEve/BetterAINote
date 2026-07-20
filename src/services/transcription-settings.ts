import type { DefaultTranscriptionProvider } from "@/lib/settings/transcription-settings-body";

const TRANSCRIPTION_SETTINGS_ENDPOINT = "/api/settings/transcription";

const DEFAULT_TRANSCRIPTION_SETTINGS = {
    autoTranscribe: true,
    defaultTranscriptionLanguage: null,
    defaultTranscriptionProvider: null,
} as const;

export interface TranscriptionSettings {
    autoTranscribe: boolean;
    defaultTranscriptionLanguage: string | null;
    defaultTranscriptionProvider: DefaultTranscriptionProvider | null;
}

export type TranscriptionSettingsUpdate = Partial<TranscriptionSettings>;

function normalizeNullableString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeDefaultTranscriptionProvider(
    value: unknown,
): DefaultTranscriptionProvider | null {
    if (
        value === "dingtalk-a1" ||
        value === "ticnote" ||
        value === "feishu-minutes"
    ) {
        return value;
    }

    return null;
}

function normalizeTranscriptionSettingsResponse(
    payload: unknown,
): TranscriptionSettings {
    const data =
        typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>)
            : {};

    return {
        autoTranscribe:
            typeof data.autoTranscribe === "boolean"
                ? data.autoTranscribe
                : DEFAULT_TRANSCRIPTION_SETTINGS.autoTranscribe,
        defaultTranscriptionLanguage: normalizeNullableString(
            data.defaultTranscriptionLanguage,
        ),
        defaultTranscriptionProvider: normalizeDefaultTranscriptionProvider(
            data.defaultTranscriptionProvider,
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

export function getDefaultTranscriptionSettings(): TranscriptionSettings {
    return { ...DEFAULT_TRANSCRIPTION_SETTINGS };
}

export async function fetchTranscriptionSettings() {
    const response = await fetch(TRANSCRIPTION_SETTINGS_ENDPOINT, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to fetch transcription settings",
        );
    }

    return normalizeTranscriptionSettingsResponse(await response.json());
}

export async function updateTranscriptionSettings(
    updates: TranscriptionSettingsUpdate,
): Promise<void> {
    if (Object.keys(updates).length === 0) {
        return;
    }

    const response = await fetch(TRANSCRIPTION_SETTINGS_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to update transcription settings",
        );
    }
}
