import { NextResponse } from "next/server";
import type { sourceConnections } from "@/db/schema/core";
import {
    DATA_SOURCE_CATALOG,
    DATA_SOURCE_PROVIDERS,
    getSourceCapabilitiesForAuthMode,
    type SourceAuthMode,
    type SourceProvider,
} from "@/lib/data-sources/catalog";
import {
    getPublicDataSourceErrorMessage,
    PUBLIC_DATA_SOURCE_CONNECTION_ERROR,
} from "@/lib/data-sources/public-errors";
import type {
    GenericSourceConfig,
    GenericSourceSecrets,
} from "@/lib/data-sources/types";
import {
    parseSourceSecretConfig,
    resolveSourceConnectionConfig,
} from "./connections";
import {
    getDataSourceSettingsErrorStatus,
    getSourceConnectionDefaults,
    getSourceDefaultBaseUrl,
    hasConfiguredSourceSecrets,
} from "./settings";

export type SerializedSourceState = {
    provider: SourceProvider;
    displayName: string;
    runtimeStatus: (typeof DATA_SOURCE_CATALOG)[SourceProvider]["runtimeStatus"];
    authModes: (typeof DATA_SOURCE_CATALOG)[SourceProvider]["authModes"];
    capabilities: (typeof DATA_SOURCE_CATALOG)[SourceProvider]["capabilities"];
    enabled: boolean;
    connected: boolean;
    authMode: SourceAuthMode;
    baseUrl: string | null;
    config: GenericSourceConfig;
    secretsConfigured: Record<string, boolean>;
    lastSync: string | null;
};

type SourceConnectionRow = typeof sourceConnections.$inferSelect;

function buildSecretPresence(secrets: GenericSourceSecrets) {
    return Object.fromEntries(
        Object.entries(secrets).map(([key, value]) => [key, Boolean(value)]),
    );
}

function getSerializedDefaults(provider: SourceProvider) {
    const defaults = getSourceConnectionDefaults(provider);

    return {
        authMode: defaults.authMode,
        config: { ...defaults.config },
        baseUrl: getSourceDefaultBaseUrl(provider),
    };
}

function serializeSourceState(
    provider: SourceProvider,
    row: SourceConnectionRow | null,
): SerializedSourceState {
    const catalog = DATA_SOURCE_CATALOG[provider];
    const defaults = getSerializedDefaults(provider);
    const authMode = (row?.authMode ?? defaults.authMode) as SourceAuthMode;
    const baseUrl = row?.baseUrl ?? defaults.baseUrl;
    const secrets = row ? parseSourceSecretConfig(row.secretConfig) : {};
    const persistedConfig =
        (row?.config as Record<string, unknown> | null | undefined) ?? {};

    return {
        provider,
        displayName: catalog.displayName,
        runtimeStatus: catalog.runtimeStatus,
        authModes: catalog.authModes,
        capabilities: getSourceCapabilitiesForAuthMode(provider, authMode),
        enabled: row?.enabled ?? false,
        connected:
            (row?.enabled ?? false) &&
            hasConfiguredSourceSecrets({
                authMode,
                secrets,
            }),
        authMode,
        baseUrl,
        config: {
            ...defaults.config,
            ...persistedConfig,
            ...resolveSourceConnectionConfig(
                provider,
                baseUrl,
                persistedConfig,
            ),
        },
        secretsConfigured: buildSecretPresence(secrets),
        lastSync: row?.lastSync?.toISOString() ?? null,
    };
}

export function serializeDataSources(
    rows: SourceConnectionRow[],
): SerializedSourceState[] {
    const rowMap = new Map(rows.map((row) => [row.provider, row]));

    return DATA_SOURCE_PROVIDERS.map((provider) =>
        serializeSourceState(provider, rowMap.get(provider) ?? null),
    );
}

export function buildDataSourcesRouteErrorResponse(error: unknown) {
    const status = getDataSourceSettingsErrorStatus(error);
    if (status && error instanceof Error) {
        return NextResponse.json(
            {
                error: getPublicDataSourceErrorMessage(
                    error,
                    PUBLIC_DATA_SOURCE_CONNECTION_ERROR,
                ),
            },
            { status },
        );
    }

    return NextResponse.json(
        { error: "Failed to save data sources" },
        { status: 500 },
    );
}
