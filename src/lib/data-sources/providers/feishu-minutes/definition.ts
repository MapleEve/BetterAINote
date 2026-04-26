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
    normalizeConfig,
    normalizeSecretValue,
    parsePersistedSecrets,
    persistSecretConfig,
} from "../shared";
import {
    FEISHU_DEFAULT_BASE_URL,
    FEISHU_WEB_DEFAULT_BASE_URL,
    FeishuMinutesClient,
    type FeishuMinutesRecordingSnapshot,
    resolveFeishuApiBase,
    resolveFeishuWebBase,
} from "./client";

async function prepareFeishuMinutesConnectionWrite(params: {
    existing: PersistedSourceConnectionState | null;
    body: {
        enabled?: unknown;
        authMode?: unknown;
        baseUrl?: unknown;
        config?: unknown;
        secrets?: unknown;
    };
}): Promise<PreparedSourceConnectionWrite> {
    const enabled =
        typeof params.body.enabled === "boolean" ? params.body.enabled : false;
    const authMode =
        params.body.authMode === undefined
            ? ((params.existing?.authMode ?? "oauth-device-flow") as
                  | "oauth-device-flow"
                  | "web-reverse")
            : params.body.authMode;

    if (authMode !== "oauth-device-flow" && authMode !== "web-reverse") {
        throw new SourceProviderSettingsError("请选择可用的登录方式。", {
            code: "unsupported-auth-mode",
        });
    }

    const existingSecrets = parsePersistedSecrets(
        params.existing?.secretConfig,
    );
    const nextSecrets = mergeSecrets(existingSecrets, params.body.secrets);
    const baseUrl = normalizeServiceUrl(
        authMode === "web-reverse"
            ? resolveFeishuWebBase(
                  typeof params.body.baseUrl === "string"
                      ? params.body.baseUrl
                      : params.existing?.baseUrl || FEISHU_WEB_DEFAULT_BASE_URL,
              )
            : resolveFeishuApiBase(
                  typeof params.body.baseUrl === "string"
                      ? params.body.baseUrl
                      : params.existing?.baseUrl || FEISHU_DEFAULT_BASE_URL,
              ),
        "baseUrl",
    );
    const inputConfig = normalizeConfig(params.body.config);
    const existingConfig =
        params.existing?.config && typeof params.existing.config === "object"
            ? params.existing.config
            : {};
    const appId =
        typeof inputConfig.appId === "string" && inputConfig.appId.trim()
            ? inputConfig.appId.trim()
            : typeof existingConfig.appId === "string" &&
                existingConfig.appId.trim()
              ? existingConfig.appId.trim()
              : "";
    const spaceName =
        typeof inputConfig.spaceName === "string" &&
        inputConfig.spaceName.trim()
            ? inputConfig.spaceName.trim()
            : typeof existingConfig.spaceName === "string" &&
                existingConfig.spaceName.trim()
              ? existingConfig.spaceName.trim()
              : "cn";
    const userAccessToken = normalizeSecretValue(nextSecrets.userAccessToken);
    const webCookie = normalizeSecretValue(nextSecrets.webCookie);
    const webToken = normalizeSecretValue(nextSecrets.webToken);

    if (enabled && authMode === "oauth-device-flow" && !userAccessToken) {
        throw new SourceProviderSettingsError("请填写 user_access_token。", {
            code: "missing-secret",
        });
    }

    if (enabled && authMode === "web-reverse" && !webCookie) {
        throw new SourceProviderSettingsError("请填写 Cookie。", {
            code: "missing-secret",
        });
    }

    const persistedSecrets: Record<string, string> =
        authMode === "web-reverse"
            ? {
                  ...(webCookie ? { webCookie } : {}),
                  ...(webToken ? { webToken } : {}),
              }
            : userAccessToken
              ? { userAccessToken }
              : {};
    const next: PreparedSourceConnectionWrite = {
        enabled,
        authMode,
        baseUrl,
        config:
            authMode === "web-reverse"
                ? {
                      spaceName,
                  }
                : {
                      appId,
                  },
        secretConfig: persistSecretConfig(persistedSecrets),
    };

    if (!enabled) {
        return next;
    }

    const existingUserAccessToken = normalizeSecretValue(
        existingSecrets.userAccessToken,
    );
    const existingWebCookie = normalizeSecretValue(existingSecrets.webCookie);
    const existingWebToken = normalizeSecretValue(existingSecrets.webToken);
    const shouldValidateConnection =
        !params.existing ||
        params.existing.baseUrl !== baseUrl ||
        params.existing.authMode !== authMode ||
        (authMode === "web-reverse"
            ? existingWebCookie !== webCookie ||
              existingWebToken !== webToken ||
              existingConfig.spaceName !== spaceName
            : existingUserAccessToken !== userAccessToken ||
              existingConfig.appId !== appId);

    if (!shouldValidateConnection) {
        return next;
    }

    const client = new FeishuMinutesSourceClient(
        buildResolvedConnectionForValidation({
            existing: params.existing,
            provider: "feishu-minutes",
            enabled,
            authMode,
            baseUrl,
            config: next.config,
            secrets: persistedSecrets,
        }),
    );
    const isValid = await client.testConnection();
    if (!isValid) {
        const fallbackMessage =
            authMode === "web-reverse"
                ? "飞书妙记连接失败，请重新填写 space_name 和 Cookie。"
                : "飞书妙记连接失败，请重新填写 user_access_token。";
        throw new SourceProviderSettingsError(
            getConnectionValidationMessage(client, fallbackMessage),
            { code: "invalid-connection" },
        );
    }

    return next;
}

export class FeishuMinutesSourceClient implements SourceProviderClient {
    readonly provider = "feishu-minutes" as const;
    private lastConnectionTestResult: SourceConnectionTestResult | null = null;
    private readonly client: FeishuMinutesClient;
    private readonly authMode: ResolvedSourceConnection["authMode"];

    constructor(connection: ResolvedSourceConnection) {
        this.authMode = connection.authMode;
        this.client = new FeishuMinutesClient(connection);
    }

    getLastConnectionTestResult() {
        return this.lastConnectionTestResult;
    }

    private finishConnectionTest(result: SourceConnectionTestResult) {
        this.lastConnectionTestResult = result;
        return result.ok;
    }

    async testConnection() {
        const ok = await this.client.testConnection();
        if (this.authMode === "web-reverse") {
            return this.finishConnectionTest({
                ok,
                code: ok ? "web-reverse-list-only" : "invalid-connection",
                message: ok
                    ? "飞书妙记 space_name + Cookie 已连接。"
                    : "飞书妙记连接失败，请重新填写 space_name 和 Cookie。",
            });
        }

        return this.finishConnectionTest({
            ok,
            code: ok ? "ok" : "invalid-connection",
            message: ok
                ? "飞书妙记 user_access_token 已连接。"
                : "飞书妙记连接失败，请重新填写 user_access_token。",
        });
    }

    async listRecordings(): Promise<SourceRecordingData[]> {
        const snapshots = await this.client.listRecordingSnapshots();
        return snapshots.map((snapshot) => toSourceRecordingData(snapshot));
    }
}

function toSourceRecordingData(
    snapshot: FeishuMinutesRecordingSnapshot,
): SourceRecordingData {
    return {
        sourceProvider: "feishu-minutes",
        sourceRecordingId: snapshot.recordingId,
        filename: snapshot.title,
        durationMs: snapshot.durationMs,
        startTime: snapshot.startTime,
        endTime: new Date(snapshot.startTime.getTime() + snapshot.durationMs),
        filesize: null,
        version: snapshot.version,
        metadata: snapshot.metadata,
        audioDownload: snapshot.audioUrl
            ? {
                  url: snapshot.audioUrl,
                  fileExtension: snapshot.audioExtension,
              }
            : null,
        artifacts: {
            transcriptText: snapshot.transcriptText,
            summaryMarkdown: snapshot.summaryMarkdown,
            detailPayload: snapshot.detailPayload,
        },
    };
}

export const feishuMinutesProviderDefinition: SourceProviderDefinition = {
    provider: "feishu-minutes",
    metadata: SOURCE_PROVIDER_MANIFESTS["feishu-minutes"].metadata,
    defaults: SOURCE_PROVIDER_MANIFESTS["feishu-minutes"].defaults,
    createClient(connection) {
        return new FeishuMinutesSourceClient(connection);
    },
    prepareConnectionWrite: prepareFeishuMinutesConnectionWrite,
    titleWriteback: null,
};
