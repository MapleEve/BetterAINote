import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sourceDevices } from "@/db/schema/library";
import type {
    PersistedSourceConnectionState,
    PreparedSourceConnectionWrite,
    ResolvedSourceConnection,
    SourceLinkedRecording,
    SourceProviderClient,
    SourceProviderDefinition,
    SourceRecordingData,
    SourceTitleWritebackTarget,
} from "@/lib/data-sources/types";
import { SourceProviderSettingsError } from "@/lib/data-sources/types";
import { SOURCE_PROVIDER_MANIFESTS } from "../manifest";
import {
    mergeSecrets,
    parsePersistedSecrets,
    persistSecretConfig,
} from "../shared";
import { normalizePlaudBearerToken, PlaudClient } from "./client";
import {
    DEFAULT_SERVER_KEY,
    type PlaudServerKey,
    resolveApiBase,
    serverKeyFromApiBase,
} from "./servers";

function resolvePlaudSourceConfig(
    baseUrl: string | null | undefined,
    config: Record<string, unknown> | null | undefined,
) {
    const effectiveBaseUrl = baseUrl ?? "https://api.plaud.ai";
    const derivedServerKey = serverKeyFromApiBase(effectiveBaseUrl);

    return {
        server:
            typeof config?.server === "string" && config.server
                ? config.server
                : derivedServerKey,
        customApiBase:
            typeof config?.customApiBase === "string"
                ? config.customApiBase
                : derivedServerKey === "custom" && effectiveBaseUrl
                  ? effectiveBaseUrl
                  : "",
        syncTitleToSource:
            typeof config?.syncTitleToSource === "boolean"
                ? config.syncTitleToSource
                : false,
    };
}

async function upsertPlaudDevices(userId: string, client: PlaudClient) {
    const deviceList = await client.listDevices();

    for (const device of deviceList.data_devices) {
        const [existingDevice] = await db
            .select()
            .from(sourceDevices)
            .where(
                and(
                    eq(sourceDevices.userId, userId),
                    eq(sourceDevices.provider, "plaud"),
                    eq(sourceDevices.providerDeviceId, device.sn),
                ),
            )
            .limit(1);

        if (existingDevice) {
            await db
                .update(sourceDevices)
                .set({
                    name: device.name,
                    model: device.model,
                    versionNumber: device.version_number,
                    updatedAt: new Date(),
                })
                .where(eq(sourceDevices.id, existingDevice.id));
        } else {
            await db.insert(sourceDevices).values({
                userId,
                provider: "plaud",
                providerDeviceId: device.sn,
                name: device.name,
                model: device.model,
                versionNumber: device.version_number,
            });
        }
    }
}

async function preparePlaudConnectionWrite(params: {
    userId: string;
    existing: PersistedSourceConnectionState | null;
    body: {
        enabled?: unknown;
        config?: unknown;
        secrets?: unknown;
    };
}): Promise<PreparedSourceConnectionWrite> {
    const enabled =
        typeof params.body.enabled === "boolean" ? params.body.enabled : true;
    const existingSecrets = parsePersistedSecrets(
        params.existing?.secretConfig,
    );
    const nextSecrets = mergeSecrets(existingSecrets, params.body.secrets);
    const inputConfig =
        params.body.config &&
        typeof params.body.config === "object" &&
        !Array.isArray(params.body.config)
            ? (params.body.config as Record<string, unknown>)
            : {};
    const normalizedExistingConfig = resolvePlaudSourceConfig(
        params.existing?.baseUrl ?? null,
        params.existing?.config ?? null,
    );
    const resolvedKey = (
        typeof inputConfig.server === "string" && inputConfig.server
            ? inputConfig.server
            : normalizedExistingConfig.server || DEFAULT_SERVER_KEY
    ) as PlaudServerKey;
    const customApiBase =
        typeof inputConfig.customApiBase === "string"
            ? inputConfig.customApiBase
            : normalizedExistingConfig.customApiBase;
    const baseUrl = resolveApiBase(resolvedKey, customApiBase);

    if (!baseUrl) {
        throw new SourceProviderSettingsError(
            resolvedKey === "custom"
                ? "Please enter a valid Plaud service address."
                : `Unknown server: ${resolvedKey}`,
            { code: "invalid-base-url" },
        );
    }

    const normalizedBearerToken =
        typeof nextSecrets.bearerToken === "string"
            ? normalizePlaudBearerToken(nextSecrets.bearerToken)
            : "";

    if (!normalizedBearerToken) {
        throw new SourceProviderSettingsError("请填写登录令牌。", {
            code: "missing-secret",
        });
    }

    const syncTitleToSource =
        typeof inputConfig.syncTitleToSource === "boolean"
            ? inputConfig.syncTitleToSource
            : normalizedExistingConfig.syncTitleToSource;

    const existingBearerToken =
        typeof existingSecrets.bearerToken === "string"
            ? normalizePlaudBearerToken(existingSecrets.bearerToken)
            : "";
    const shouldValidateConnection =
        !params.existing ||
        params.existing.baseUrl !== baseUrl ||
        existingBearerToken !== normalizedBearerToken;

    if (shouldValidateConnection) {
        const client = new PlaudClient(normalizedBearerToken, baseUrl);
        const isValid = await client.testConnection();
        if (!isValid) {
            throw new SourceProviderSettingsError(
                "连接失败，请重新填写登录令牌。",
                {
                    code: "invalid-connection",
                },
            );
        }

        await upsertPlaudDevices(params.userId, client);
    }

    nextSecrets.bearerToken = normalizedBearerToken;

    return {
        enabled,
        authMode: "bearer",
        baseUrl,
        config: {
            server: resolvedKey,
            customApiBase: resolvedKey === "custom" ? customApiBase : "",
            syncTitleToSource,
        },
        secretConfig: persistSecretConfig(nextSecrets),
    };
}

type PlaudTitleWritebackTarget = SourceTitleWritebackTarget;

const plaudTitleWriteback = {
    resolveTarget(
        recording: SourceLinkedRecording,
    ): PlaudTitleWritebackTarget | null {
        const remoteRecordingId = recording.sourceRecordingId || null;

        return remoteRecordingId
            ? {
                  provider: "plaud",
                  remoteRecordingId,
              }
            : null;
    },
    async writeTitle(params: {
        connection: ResolvedSourceConnection;
        target: PlaudTitleWritebackTarget;
        title: string;
    }) {
        if (!params.connection.secrets.bearerToken) {
            throw new Error(
                "This source connection is missing the credentials required for upstream title write-back",
            );
        }

        const client = new PlaudClient(
            params.connection.secrets.bearerToken,
            params.connection.baseUrl ?? undefined,
        );
        await client.updateFilename(
            params.target.remoteRecordingId,
            params.title,
        );
    },
};

export class PlaudSourceClient implements SourceProviderClient {
    readonly provider = "plaud" as const;
    private readonly client: PlaudClient;

    constructor(connection: ResolvedSourceConnection) {
        this.client = new PlaudClient(
            connection.secrets.bearerToken,
            connection.baseUrl ?? undefined,
        );
    }

    async testConnection() {
        return this.client.testConnection();
    }

    async listRecordings(): Promise<SourceRecordingData[]> {
        const response = await this.client.getRecordings(0, 99999, 0);
        const items = response.data_file_list ?? [];

        return await Promise.all(
            items.map(async (item) => {
                const artifacts = await this.client.fetchOfficialArtifacts(
                    item.id,
                );
                const tempUrl = await this.client
                    .getTempUrl(item.id, true)
                    .catch(() => null);
                const downloadUrl =
                    tempUrl?.temp_url_opus ?? tempUrl?.temp_url ?? null;

                return {
                    sourceProvider: "plaud",
                    sourceRecordingId: item.id,
                    filename: item.filename,
                    durationMs: item.duration,
                    startTime: new Date(item.start_time),
                    endTime: new Date(item.end_time),
                    filesize: item.filesize,
                    md5: item.file_md5,
                    version: item.version_ms.toString(),
                    providerDeviceId: item.serial_number,
                    upstreamTrashed: Boolean(item.is_trash),
                    metadata: {
                        timezone: item.timezone,
                        zonemins: item.zonemins,
                        scene: item.scene,
                        plaud: item,
                    },
                    audioDownload: downloadUrl
                        ? {
                              url: downloadUrl,
                              fileExtension: tempUrl?.temp_url_opus
                                  ? "opus"
                                  : "mp3",
                          }
                        : null,
                    artifacts: {
                        transcriptText: artifacts.transcript?.text ?? null,
                        transcriptSegments:
                            artifacts.transcript?.segments ?? null,
                        summaryMarkdown: artifacts.summaryMarkdown,
                        detailPayload: artifacts.detail as Record<
                            string,
                            unknown
                        > | null,
                    },
                } satisfies SourceRecordingData;
            }),
        );
    }
}

export const plaudProviderDefinition: SourceProviderDefinition = {
    provider: "plaud",
    metadata: SOURCE_PROVIDER_MANIFESTS.plaud.metadata,
    defaults: SOURCE_PROVIDER_MANIFESTS.plaud.defaults,
    createClient(connection) {
        return new PlaudSourceClient(connection);
    },
    resolveConnectionConfig(params) {
        return resolvePlaudSourceConfig(params.baseUrl, params.config);
    },
    prepareConnectionWrite: preparePlaudConnectionWrite,
    titleWriteback: plaudTitleWriteback,
};
