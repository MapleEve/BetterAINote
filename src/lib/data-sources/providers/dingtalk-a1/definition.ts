import type {
    PersistedSourceConnectionState,
    PreparedSourceConnectionWrite,
    ResolvedSourceConnection,
    SourceConnectionTestResult,
    SourceProviderClient,
    SourceProviderDefinition,
    SourceRecordingData,
} from "@/lib/data-sources/types";
import { SourceProviderSettingsError } from "@/lib/data-sources/types";
import { normalizeServiceUrl } from "@/lib/service-url";
import { SOURCE_PROVIDER_MANIFESTS } from "../manifest";
import {
    buildResolvedConnectionForValidation,
    getConnectionValidationMessage,
    mergeSecrets,
    normalizeSecretValue,
    parsePersistedSecrets,
    persistSecretConfig,
} from "../shared";
import { buildMissingDingTalkSecretMessage, DingTalkA1Client } from "./client";
import {
    DINGTALK_DEVICE_CREDENTIAL_KEY,
    DINGTALK_DEVICE_SIGNIN_AUTH_MODE,
    getDingTalkDeviceCredential,
    normalizeDingTalkAuthMode,
} from "./constants";

const DINGTALK_DEFAULT_BASE_URL = "https://meeting-ai-tingji.dingtalk.com";

async function prepareDingTalkConnectionWrite(params: {
    existing: PersistedSourceConnectionState | null;
    body: {
        enabled?: unknown;
        authMode?: unknown;
        baseUrl?: unknown;
        secrets?: unknown;
    };
}): Promise<PreparedSourceConnectionWrite> {
    const enabled =
        typeof params.body.enabled === "boolean" ? params.body.enabled : false;
    const authMode =
        params.body.authMode === undefined
            ? normalizeDingTalkAuthMode(
                  params.existing?.authMode ?? DINGTALK_DEVICE_SIGNIN_AUTH_MODE,
              )
            : normalizeDingTalkAuthMode(params.body.authMode);

    if (authMode !== DINGTALK_DEVICE_SIGNIN_AUTH_MODE) {
        throw new SourceProviderSettingsError("请选择可用的登录方式。", {
            code: "unsupported-auth-mode",
        });
    }

    const existingSecrets = parsePersistedSecrets(
        params.existing?.secretConfig,
    );
    const nextSecrets = mergeSecrets(existingSecrets, params.body.secrets);
    const baseUrl = normalizeServiceUrl(
        typeof params.body.baseUrl === "string"
            ? params.body.baseUrl
            : params.existing?.baseUrl || DINGTALK_DEFAULT_BASE_URL,
        "baseUrl",
    );

    const deviceCredential = normalizeSecretValue(
        getDingTalkDeviceCredential(nextSecrets),
    );
    const activeSecret = deviceCredential;

    if (enabled && !activeSecret) {
        throw new SourceProviderSettingsError(
            buildMissingDingTalkSecretMessage(),
            { code: "missing-secret" },
        );
    }

    const persistedSecrets: Record<string, string> = deviceCredential
        ? { [DINGTALK_DEVICE_CREDENTIAL_KEY]: deviceCredential }
        : {};

    const next: PreparedSourceConnectionWrite = {
        enabled,
        authMode,
        baseUrl,
        config: {},
        secretConfig: persistSecretConfig(persistedSecrets),
    };

    if (!enabled) {
        return next;
    }

    const existingActiveSecret = normalizeSecretValue(
        getDingTalkDeviceCredential(existingSecrets),
    );
    const shouldValidateConnection =
        !params.existing ||
        params.existing.baseUrl !== baseUrl ||
        normalizeDingTalkAuthMode(params.existing.authMode) !== authMode ||
        existingActiveSecret !== activeSecret;

    if (!shouldValidateConnection) {
        return next;
    }

    const client = new DingTalkA1SourceClient(
        buildResolvedConnectionForValidation({
            existing: params.existing,
            provider: "dingtalk-a1",
            enabled,
            authMode,
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
                "连接失败，请重新填写 dt-meeting-agent-token。",
            ),
            { code: "invalid-connection" },
        );
    }

    return next;
}

export class DingTalkA1SourceClient implements SourceProviderClient {
    readonly provider = "dingtalk-a1" as const;
    private lastConnectionTestResult: SourceConnectionTestResult | null = null;
    private readonly client: DingTalkA1Client;

    constructor(connection: ResolvedSourceConnection) {
        this.client = new DingTalkA1Client(connection);
    }

    getLastConnectionTestResult() {
        return this.lastConnectionTestResult;
    }

    private finishConnectionTest(result: SourceConnectionTestResult) {
        this.lastConnectionTestResult = result;
        return result.ok;
    }

    async testConnection() {
        return this.finishConnectionTest(await this.client.testConnection());
    }

    async listRecordings(): Promise<SourceRecordingData[]> {
        return this.client.listRecordings();
    }
}

export const dingtalkA1ProviderDefinition: SourceProviderDefinition = {
    provider: "dingtalk-a1",
    metadata: SOURCE_PROVIDER_MANIFESTS["dingtalk-a1"].metadata,
    defaults: SOURCE_PROVIDER_MANIFESTS["dingtalk-a1"].defaults,
    createClient(connection) {
        return new DingTalkA1SourceClient(connection);
    },
    prepareConnectionWrite: prepareDingTalkConnectionWrite,
    titleWriteback: null,
};
