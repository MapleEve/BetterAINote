export interface TitleGenerationProviderConfig {
    baseUrl: string | null;
    model: string | null;
}

export interface TitleGenerationProviderSettingsResponse {
    titleGenerationBaseUrl: string | null;
    titleGenerationModel: string | null;
    titleGenerationApiKeySet: boolean;
}

interface TitleGenerationSettingsSource {
    titleGenerationBaseUrl?: unknown;
    titleGenerationModel?: unknown;
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function readTitleGenerationProviderConfig(
    value: TitleGenerationSettingsSource | null | undefined,
): TitleGenerationProviderConfig {
    return {
        baseUrl: normalizeString(value?.titleGenerationBaseUrl),
        model: normalizeString(value?.titleGenerationModel),
    };
}

export function getTitleGenerationProviderSettingsResponse(
    settings: TitleGenerationSettingsSource | null | undefined,
    titleGenerationApiKeySet = false,
) {
    const config = readTitleGenerationProviderConfig(settings);

    return {
        titleGenerationBaseUrl: config.baseUrl,
        titleGenerationModel: config.model,
        titleGenerationApiKeySet,
    } satisfies TitleGenerationProviderSettingsResponse;
}
