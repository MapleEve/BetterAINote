import type {
    PersistedSourceConnectionState,
    PreparedSourceConnectionWrite,
    ResolvedSourceConnection,
    SourceProviderClient,
    SourceProviderDefinition,
} from "@/lib/data-sources/types";
import { SourceProviderSettingsError } from "@/lib/data-sources/types";
import { normalizeServiceUrl } from "@/lib/service-url";
import { SOURCE_PROVIDER_MANIFESTS } from "../manifest";
import {
    buildResolvedConnectionForValidation,
    getConnectionValidationMessage,
    mergeSecrets,
    normalizeConfig,
    normalizeSecretValue,
    parsePersistedSecrets,
    persistSecretConfig,
} from "../shared";
import { IFLYREC_DEFAULT_BASE_URL, IflyrecClient } from "./client";

async function prepareIflyrecConnectionWrite(params: {
    existing: PersistedSourceConnectionState | null;
    body: {
        enabled?: unknown;
        baseUrl?: unknown;
        config?: unknown;
        secrets?: unknown;
    };
}): Promise<PreparedSourceConnectionWrite> {
    const enabled =
        typeof params.body.enabled === "boolean" ? params.body.enabled : false;
    const existingSecrets = parsePersistedSecrets(
        params.existing?.secretConfig,
    );
    const nextSecrets = mergeSecrets(existingSecrets, params.body.secrets);
    const baseUrl = normalizeServiceUrl(
        typeof params.body.baseUrl === "string"
            ? params.body.baseUrl
            : params.existing?.baseUrl || IFLYREC_DEFAULT_BASE_URL,
        "baseUrl",
    );
    const inputConfig = normalizeConfig(params.body.config);
    const existingConfig =
        params.existing?.config && typeof params.existing.config === "object"
            ? params.existing.config
            : {};
    const bizId =
        typeof inputConfig.bizId === "string" && inputConfig.bizId.trim()
            ? inputConfig.bizId.trim()
            : typeof existingConfig.bizId === "string" &&
                existingConfig.bizId.trim()
              ? existingConfig.bizId.trim()
              : "tjzs";
    const sessionId = normalizeSecretValue(nextSecrets.sessionId);

    if (enabled && !sessionId) {
        throw new SourceProviderSettingsError("请填写登录会话信息。", {
            code: "missing-secret",
        });
    }

    const persistedSecrets: Record<string, string> = sessionId
        ? { sessionId }
        : {};
    const next: PreparedSourceConnectionWrite = {
        enabled,
        authMode: "session-header",
        baseUrl,
        config: {
            bizId,
        },
        secretConfig: persistSecretConfig(persistedSecrets),
    };

    if (!enabled) {
        return next;
    }

    const existingSessionId = normalizeSecretValue(existingSecrets.sessionId);
    const shouldValidateConnection =
        !params.existing ||
        params.existing.baseUrl !== baseUrl ||
        existingSessionId !== sessionId ||
        existingConfig.bizId !== bizId;

    if (!shouldValidateConnection) {
        return next;
    }

    const client = new IflyrecSourceClient(
        buildResolvedConnectionForValidation({
            existing: params.existing,
            provider: "iflyrec",
            enabled,
            authMode: "session-header",
            baseUrl,
            config: next.config,
            secrets: persistedSecrets,
        }),
    );
    const isValid = await client.testConnection();
    if (!isValid) {
        throw new SourceProviderSettingsError(
            getConnectionValidationMessage(
                client,
                "Invalid iFLYTEK iflyrec connection",
            ),
            { code: "invalid-connection" },
        );
    }

    return next;
}

export class IflyrecSourceClient implements SourceProviderClient {
    readonly provider = "iflyrec" as const;
    private readonly client: IflyrecClient;

    constructor(connection: ResolvedSourceConnection) {
        this.client = new IflyrecClient(connection);
    }

    async testConnection() {
        return this.client.testConnection();
    }

    async listRecordings() {
        return this.client.listRecordings();
    }
}

export const iflyrecProviderDefinition: SourceProviderDefinition = {
    provider: "iflyrec",
    metadata: SOURCE_PROVIDER_MANIFESTS.iflyrec.metadata,
    defaults: SOURCE_PROVIDER_MANIFESTS.iflyrec.defaults,
    createClient(connection) {
        return new IflyrecSourceClient(connection);
    },
    prepareConnectionWrite: prepareIflyrecConnectionWrite,
    titleWriteback: null,
};
