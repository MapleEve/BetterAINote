import path from "node:path";
import {
    isSourceAuthMode,
    type SourceAuthMode,
} from "@/lib/data-sources/catalog";
import { getSourceProviderDefinition } from "@/lib/data-sources/providers";
import {
    DINGTALK_DEVICE_CREDENTIAL_KEY,
    DINGTALK_LEGACY_DEVICE_CREDENTIAL_KEY,
} from "@/lib/data-sources/providers/dingtalk-a1/constants";
import {
    DATA_SOURCE_PROVIDERS,
    type DataSourcesRequestBody,
    type GenericSourceConfig,
    type GenericSourceSecrets,
    type PersistedSourceConnectionState,
    type PreparedSourceConnectionWrite,
    type SourceConnectionStateDefaults,
    type SourceProvider,
    SourceProviderSettingsError,
    type SourceSyncStatus,
} from "@/lib/data-sources/types";
import { ServiceUrlValidationError } from "@/lib/service-url";

export type {
    DataSourcesRequestBody,
    GenericSourceConfig,
    GenericSourceSecrets,
};

type SourceConnectionRowLike = PersistedSourceConnectionState | null;

type PrepareSourceConnectionWriteParams = {
    userId: string;
    provider: SourceProvider;
    existing: {
        userId: string;
        provider: string;
        enabled: boolean;
        authMode: string | null;
        baseUrl: string | null;
        config: Record<string, unknown> | null;
        secretConfig: string | null;
        lastSync?: Date | null;
        syncStatus?: string | null;
        lastSyncError?: string | null;
        lastSyncStartedAt?: Date | null;
        lastSyncFinishedAt?: Date | null;
    } | null;
    body: DataSourcesRequestBody;
    forceValidate?: boolean;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isPlaywrightE2eDataSourcesFallbackEnabled() {
    if (
        process.env.PLAYWRIGHT_E2E_DATA_SOURCES_FALLBACK !== "1" ||
        process.env.NODE_ENV !== "development"
    ) {
        return false;
    }

    const root = process.env.PLAYWRIGHT_E2E_ROOT;
    const databasePath = process.env.DATABASE_PATH;
    if (!root || !databasePath) {
        return false;
    }

    const dataDirectory = path.resolve(root, "data");
    const resolvedDatabasePath = path.resolve(databasePath);
    const relativeDatabasePath = path.relative(
        dataDirectory,
        resolvedDatabasePath,
    );

    return (
        relativeDatabasePath.length > 0 &&
        relativeDatabasePath !== ".." &&
        !relativeDatabasePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativeDatabasePath)
    );
}

function preparePlaywrightE2eDataSourcesFallback(
    params: PrepareSourceConnectionWriteParams,
): PreparedSourceConnectionWrite | null {
    if (!isPlaywrightE2eDataSourcesFallbackEnabled()) {
        return null;
    }

    const { body, existing, provider, userId } = params;
    if (
        !isPlainObject(body) ||
        !existing ||
        existing.userId !== userId ||
        existing.provider !== provider ||
        typeof existing.enabled !== "boolean" ||
        !isSourceAuthMode(existing.authMode) ||
        (existing.baseUrl !== null && typeof existing.baseUrl !== "string") ||
        (existing.config !== null && !isPlainObject(existing.config)) ||
        (existing.secretConfig !== null &&
            typeof existing.secretConfig !== "string")
    ) {
        return null;
    }

    if (
        (body.provider !== undefined && body.provider !== provider) ||
        (body.enabled !== undefined && typeof body.enabled !== "boolean") ||
        (body.authMode !== undefined && !isSourceAuthMode(body.authMode)) ||
        (body.baseUrl !== undefined &&
            body.baseUrl !== null &&
            typeof body.baseUrl !== "string") ||
        (body.config !== undefined && !isPlainObject(body.config))
    ) {
        return null;
    }

    const enabled = body.enabled ?? existing.enabled;
    const authMode = body.authMode ?? existing.authMode;
    const baseUrl =
        body.baseUrl === undefined ? existing.baseUrl : body.baseUrl;

    if (
        typeof enabled !== "boolean" ||
        !isSourceAuthMode(authMode) ||
        (baseUrl !== null && typeof baseUrl !== "string")
    ) {
        return null;
    }

    return {
        enabled,
        authMode,
        baseUrl,
        config: {
            ...(existing.config ?? {}),
            ...(isPlainObject(body.config) ? body.config : {}),
        },
        secretConfig: existing.secretConfig,
    };
}

function cloneDefaultSourceConfig(provider: SourceProvider) {
    return {
        ...getSourceProviderDefinition(provider).defaults.config,
    };
}

function getDefaultSourceAuthMode(provider: SourceProvider) {
    return getSourceProviderDefinition(provider).defaults.authMode;
}

export const DEFAULT_SOURCE_STATE: Record<
    SourceProvider,
    SourceConnectionStateDefaults
> = Object.fromEntries(
    DATA_SOURCE_PROVIDERS.map((provider) => {
        const defaults = getSourceProviderDefinition(provider).defaults;
        return [
            provider,
            {
                authMode: defaults.authMode,
                config: cloneDefaultSourceConfig(provider),
            },
        ];
    }),
) as Record<SourceProvider, SourceConnectionStateDefaults>;

const AUTH_MODE_SECRET_KEYS: Record<SourceAuthMode, string[]> = {
    bearer: ["bearerToken"],
    cookie: ["cookie"],
    "oauth-device-flow": ["userAccessToken"],
    "web-reverse": ["webCookie"],
    "session-header": ["sessionId"],
    "device-signin": [
        DINGTALK_DEVICE_CREDENTIAL_KEY,
        DINGTALK_LEGACY_DEVICE_CREDENTIAL_KEY,
    ],
};

export function getSourceConnectionDefaults(
    provider: SourceProvider,
): SourceConnectionStateDefaults {
    return {
        authMode: getDefaultSourceAuthMode(provider),
        config: cloneDefaultSourceConfig(provider),
    };
}

export function getSourceDefaultBaseUrl(provider: SourceProvider) {
    return (
        getSourceProviderDefinition(provider).metadata.defaultBaseUrl ?? null
    );
}

export function hasConfiguredSourceSecrets(params: {
    authMode: string | null | undefined;
    secrets: GenericSourceSecrets;
}) {
    if (!isSourceAuthMode(params.authMode)) {
        return false;
    }

    return AUTH_MODE_SECRET_KEYS[params.authMode].some((key) => {
        const value = params.secrets[key];
        return typeof value === "string" && value.trim().length > 0;
    });
}

function resolveSourceSyncStatus(
    status: string | null | undefined,
): SourceSyncStatus {
    if (status === "syncing" || status === "error") {
        return status;
    }

    return "idle";
}

function toPersistedSourceConnectionState(
    existing: {
        userId: string;
        provider: string;
        enabled: boolean;
        authMode: string | null;
        baseUrl: string | null;
        config: Record<string, unknown> | null;
        secretConfig: string | null;
        lastSync?: Date | null;
        syncStatus?: string | null;
        lastSyncError?: string | null;
        lastSyncStartedAt?: Date | null;
        lastSyncFinishedAt?: Date | null;
    } | null,
): SourceConnectionRowLike {
    if (!existing) {
        return null;
    }

    return {
        userId: existing.userId,
        provider: existing.provider as SourceProvider,
        enabled: existing.enabled,
        authMode: existing.authMode,
        baseUrl: existing.baseUrl,
        config: existing.config,
        secretConfig: existing.secretConfig,
        lastSync: existing.lastSync ?? null,
        syncStatus: resolveSourceSyncStatus(existing.syncStatus),
        lastSyncError: existing.lastSyncError ?? null,
        lastSyncStartedAt: existing.lastSyncStartedAt ?? null,
        lastSyncFinishedAt: existing.lastSyncFinishedAt ?? null,
    };
}

export async function prepareSourceConnectionWrite(
    params: PrepareSourceConnectionWriteParams,
) {
    const playwrightFallback = preparePlaywrightE2eDataSourcesFallback(params);
    if (playwrightFallback) {
        return playwrightFallback;
    }

    const definition = getSourceProviderDefinition(params.provider);
    if (!definition.prepareConnectionWrite) {
        throw new Error(
            `Provider ${params.provider} does not implement connection settings`,
        );
    }

    return definition.prepareConnectionWrite({
        userId: params.userId,
        existing: toPersistedSourceConnectionState(params.existing),
        body: params.body,
        forceValidate: params.forceValidate,
    });
}

export function getDataSourceSettingsErrorStatus(error: unknown) {
    if (error instanceof SourceProviderSettingsError) {
        return error.status;
    }

    if (error instanceof ServiceUrlValidationError) {
        return 400;
    }

    return null;
}
