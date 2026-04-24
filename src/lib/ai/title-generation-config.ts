import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema/core";
import {
    getStoredTitleGenerationCredential,
    hasStoredTitleGenerationCredential,
    TITLE_GENERATION_CREDENTIAL_PROVIDER,
    upsertStoredTitleGenerationCredential,
} from "@/lib/api-credentials/title-generation";
import { decrypt } from "@/lib/encryption";

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

export const STORED_TITLE_GENERATION_PROVIDER =
    TITLE_GENERATION_CREDENTIAL_PROVIDER;

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

export async function hasStoredTitleGenerationApiKey(userId: string) {
    return hasStoredTitleGenerationCredential(userId);
}

export async function upsertStoredTitleGenerationApiKey(params: {
    userId: string;
    apiKey: string | null;
}) {
    return upsertStoredTitleGenerationCredential(params);
}

export async function getDecryptedTitleGenerationProviderConfig(
    userId: string,
) {
    const [settings, credential] = await Promise.all([
        db
            .select({
                titleGenerationBaseUrl: userSettings.titleGenerationBaseUrl,
                titleGenerationModel: userSettings.titleGenerationModel,
            })
            .from(userSettings)
            .where(eq(userSettings.userId, userId))
            .limit(1)
            .then((rows) => rows[0] ?? null),
        getStoredTitleGenerationCredential(userId),
    ]);

    const config = readTitleGenerationProviderConfig(settings);

    return {
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: credential?.apiKey ? decrypt(credential.apiKey) : null,
    };
}
