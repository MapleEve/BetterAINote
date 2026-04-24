import { encrypt } from "@/lib/encryption";
import { normalizeTitleGenerationBaseUrlSetting } from "@/lib/settings/service-url-settings";
import { normalizeBooleanSetting } from "@/lib/settings/value-normalization";

interface TitleGenerationProviderConfigInput {
    baseUrl?: string | null;
    model?: string | null;
}

function normalizeTitleGenerationConfigValue(value: unknown) {
    if (value === null) {
        return null;
    }

    if (typeof value !== "string") {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function buildTitleGenerationProviderConfigUpdate(
    input: TitleGenerationProviderConfigInput,
) {
    return {
        titleGenerationBaseUrl: normalizeTitleGenerationConfigValue(
            input.baseUrl,
        ),
        titleGenerationModel: normalizeTitleGenerationConfigValue(input.model),
    };
}

function normalizeOptionalTitleGenerationBaseUrl(value: unknown) {
    if (value === undefined) {
        return undefined;
    }

    return normalizeTitleGenerationBaseUrlSetting(value);
}

function shouldUpdateTitleGenerationProvider(body: Record<string, unknown>) {
    return (
        body.titleGenerationBaseUrl !== undefined ||
        body.titleGenerationModel !== undefined
    );
}

function buildTitleGenerationProviderInput(body: Record<string, unknown>) {
    const input: TitleGenerationProviderConfigInput = {};

    const baseUrl = normalizeOptionalTitleGenerationBaseUrl(
        body.titleGenerationBaseUrl,
    );

    if (baseUrl !== undefined) {
        input.baseUrl = baseUrl;
    }

    if (
        typeof body.titleGenerationModel === "string" ||
        body.titleGenerationModel === null
    ) {
        input.model = body.titleGenerationModel;
    }

    return input;
}

function buildTitleGenerationBehaviorUpdates(body: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};

    if (body.autoGenerateTitle !== undefined) {
        updates.autoGenerateTitle = normalizeBooleanSetting(
            "autoGenerateTitle",
            body.autoGenerateTitle,
        );
    }

    if (body.titleGenerationPrompt !== undefined) {
        updates.titleGenerationPrompt = body.titleGenerationPrompt;
    }

    return updates;
}

export function buildTitleGenerationSettingsUpdates(
    body: Record<string, unknown>,
) {
    return {
        ...buildTitleGenerationBehaviorUpdates(body),
        ...(shouldUpdateTitleGenerationProvider(body)
            ? buildTitleGenerationProviderConfigUpdate(
                  buildTitleGenerationProviderInput(body),
              )
            : {}),
    };
}

function normalizeTitleGenerationApiKeyUpdate(value: unknown) {
    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    if (typeof value !== "string") {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? encrypt(trimmed) : null;
}

export function buildTitleGenerationApiKeyUpdate(
    body: Record<string, unknown>,
) {
    return normalizeTitleGenerationApiKeyUpdate(body.titleGenerationApiKey);
}
