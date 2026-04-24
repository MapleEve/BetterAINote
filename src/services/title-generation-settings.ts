const TITLE_GENERATION_SETTINGS_ENDPOINT = "/api/settings/title-generation";

const DEFAULT_TITLE_GENERATION_SETTINGS = {
    autoGenerateTitle: true,
    titleGenerationBaseUrl: null,
    titleGenerationModel: null,
    titleGenerationApiKeySet: false,
    titleGenerationPrompt: null,
} as const;

export interface TitleGenerationSettings {
    autoGenerateTitle: boolean;
    titleGenerationBaseUrl: string | null;
    titleGenerationModel: string | null;
    titleGenerationApiKeySet: boolean;
    titleGenerationPrompt: string | null;
}

export interface TitleGenerationSettingsUpdate {
    autoGenerateTitle?: boolean;
    titleGenerationBaseUrl?: string | null;
    titleGenerationModel?: string | null;
    titleGenerationApiKey?: string | null;
    titleGenerationPrompt?: string | null;
}

function normalizeNullableString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeTitleGenerationSettingsResponse(
    payload: unknown,
): TitleGenerationSettings {
    const data =
        typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>)
            : {};

    return {
        autoGenerateTitle:
            typeof data.autoGenerateTitle === "boolean"
                ? data.autoGenerateTitle
                : DEFAULT_TITLE_GENERATION_SETTINGS.autoGenerateTitle,
        titleGenerationBaseUrl: normalizeNullableString(
            data.titleGenerationBaseUrl,
        ),
        titleGenerationModel: normalizeNullableString(
            data.titleGenerationModel,
        ),
        titleGenerationApiKeySet:
            typeof data.titleGenerationApiKeySet === "boolean"
                ? data.titleGenerationApiKeySet
                : DEFAULT_TITLE_GENERATION_SETTINGS.titleGenerationApiKeySet,
        titleGenerationPrompt: normalizeNullableString(
            data.titleGenerationPrompt,
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

export function getDefaultTitleGenerationSettings(): TitleGenerationSettings {
    return { ...DEFAULT_TITLE_GENERATION_SETTINGS };
}

export async function fetchTitleGenerationSettings() {
    const response = await fetch(TITLE_GENERATION_SETTINGS_ENDPOINT, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to fetch title generation settings",
        );
    }

    return normalizeTitleGenerationSettingsResponse(await response.json());
}

export async function updateTitleGenerationSettings(
    updates: TitleGenerationSettingsUpdate,
): Promise<void> {
    if (Object.keys(updates).length === 0) {
        return;
    }

    const response = await fetch(TITLE_GENERATION_SETTINGS_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to update title generation settings",
        );
    }
}
