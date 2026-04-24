import {
    isSourceAuthMode,
    type SourceAuthMode,
} from "@/lib/data-sources/catalog";
import { getSourceProviderDefinition } from "@/lib/data-sources/providers";
import {
    DATA_SOURCE_PROVIDERS,
    type DataSourcesRequestBody,
    type GenericSourceConfig,
    type GenericSourceSecrets,
    type PersistedSourceConnectionState,
    type SourceConnectionStateDefaults,
    type SourceProvider,
    SourceProviderSettingsError,
} from "@/lib/data-sources/types";
import { ServiceUrlValidationError } from "@/lib/service-url";

export type {
    DataSourcesRequestBody,
    GenericSourceConfig,
    GenericSourceSecrets,
};

type SourceConnectionRowLike = PersistedSourceConnectionState | null;

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
    "agent-token": ["agentToken"],
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
    };
}

export async function prepareSourceConnectionWrite(params: {
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
    } | null;
    body: DataSourcesRequestBody;
}) {
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
