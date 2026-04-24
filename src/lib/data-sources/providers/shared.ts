import { decrypt, encrypt } from "@/lib/encryption";
import type {
    GenericSourceConfig,
    GenericSourceSecrets,
    PersistedSourceConnectionState,
    ResolvedSourceConnection,
    SourceConnectionTestResult,
    SourceProvider,
    SourceProviderClient,
} from "../types";

export function normalizeConfig(value: unknown): GenericSourceConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as GenericSourceConfig;
}

export function parsePersistedSecrets(
    value: string | null | undefined,
): GenericSourceSecrets {
    if (!value) {
        return {};
    }

    try {
        const parsed = JSON.parse(decrypt(value)) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }

        return Object.fromEntries(
            Object.entries(parsed).filter(
                (entry): entry is [string, string] =>
                    typeof entry[0] === "string" &&
                    typeof entry[1] === "string" &&
                    entry[1].trim().length > 0,
            ),
        );
    } catch {
        return {};
    }
}

export function mergeSecrets(
    existing: GenericSourceSecrets,
    incoming: unknown,
): GenericSourceSecrets {
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
        return existing;
    }

    const next = { ...existing };
    for (const [key, value] of Object.entries(
        incoming as Record<string, unknown>,
    )) {
        if (typeof value === "string" && value.trim()) {
            next[key] = value.trim();
        }
    }

    return next;
}

export function normalizeBearerToken(value: string | undefined) {
    if (!value) {
        return "";
    }

    return value
        .replace(/^bearer[\s:]+/i, "")
        .replace(/\s+/g, "")
        .trim();
}

export function normalizeSecretValue(value: string | undefined) {
    return value?.trim() ?? "";
}

export function persistSecretConfig(secrets: GenericSourceSecrets) {
    return Object.keys(secrets).length > 0
        ? encrypt(JSON.stringify(secrets))
        : null;
}

export function buildResolvedConnectionForValidation(params: {
    existing: PersistedSourceConnectionState | null;
    provider: SourceProvider;
    enabled: boolean;
    authMode: ResolvedSourceConnection["authMode"];
    baseUrl: string | null;
    config: GenericSourceConfig;
    secrets: GenericSourceSecrets;
}): ResolvedSourceConnection {
    return {
        userId: params.existing?.userId ?? "",
        provider: params.provider,
        enabled: params.enabled,
        authMode: params.authMode,
        baseUrl: params.baseUrl,
        config: params.config,
        secrets: params.secrets,
        lastSync: params.existing?.lastSync ?? null,
    };
}

export function getConnectionValidationMessage(
    client: SourceProviderClient,
    fallback: string,
) {
    const result: SourceConnectionTestResult | null | undefined =
        client.getLastConnectionTestResult?.();
    const message = result?.message;
    return typeof message === "string" && message.trim() ? message : fallback;
}
