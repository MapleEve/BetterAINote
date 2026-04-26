import type {
    PersistedSourceConnectionState,
    PreparedSourceConnectionWrite,
    ResolvedSourceConnection,
    SourceConnectionTestResult,
    SourceLinkedRecording,
    SourceProviderClient,
    SourceProviderDefinition,
    SourceRecordingData,
    SourceTitleWritebackTarget,
} from "@/lib/data-sources/types";
import { SourceProviderSettingsError } from "@/lib/data-sources/types";
import { SOURCE_PROVIDER_MANIFESTS } from "../manifest";
import {
    buildResolvedConnectionForValidation,
    getConnectionValidationMessage,
    mergeSecrets,
    normalizeBearerToken,
    normalizeConfig,
    parsePersistedSecrets,
    persistSecretConfig,
} from "../shared";
import {
    normalizeTicNoteLanguage,
    normalizeTicNoteTimezone,
    resolveTicNoteConnectionConfig,
    resolveTicNoteRegion,
    TICNOTE_DEFAULT_BASE_URL,
    TICNOTE_REGION_BASE_URLS,
    TicNoteClient,
    type TicNoteRecordingSnapshot,
} from "./client";

async function prepareTicNoteConnectionWrite(params: {
    existing: PersistedSourceConnectionState | null;
    body: {
        enabled?: unknown;
        config?: unknown;
        baseUrl?: unknown;
        secrets?: unknown;
    };
}): Promise<PreparedSourceConnectionWrite> {
    const enabled =
        typeof params.body.enabled === "boolean" ? params.body.enabled : false;
    const existingSecrets = parsePersistedSecrets(
        params.existing?.secretConfig,
    );
    const nextSecrets = mergeSecrets(existingSecrets, params.body.secrets);
    const inputConfig = normalizeConfig(params.body.config);
    const existingConfig =
        params.existing?.config && typeof params.existing.config === "object"
            ? params.existing.config
            : {};
    const fallbackBaseUrl =
        (typeof params.body.baseUrl === "string" && params.body.baseUrl.trim()
            ? params.body.baseUrl
            : params.existing?.baseUrl || TICNOTE_DEFAULT_BASE_URL) || null;
    const region = resolveTicNoteRegion(inputConfig.region, fallbackBaseUrl);
    const baseUrl = TICNOTE_REGION_BASE_URLS[region];

    let orgId =
        typeof inputConfig.orgId === "string" && inputConfig.orgId.trim()
            ? inputConfig.orgId.trim()
            : typeof existingConfig.orgId === "string" &&
                existingConfig.orgId.trim()
              ? existingConfig.orgId.trim()
              : "";

    let timezone: string;
    try {
        timezone = normalizeTicNoteTimezone(
            inputConfig.timezone,
            typeof existingConfig.timezone === "string" &&
                existingConfig.timezone.trim()
                ? existingConfig.timezone.trim()
                : "Asia/Shanghai",
        );
    } catch (error) {
        throw new SourceProviderSettingsError(
            error instanceof Error
                ? error.message
                : "TicNote timezone is invalid",
            { code: "invalid-timezone" },
        );
    }

    let language: string;
    try {
        language = normalizeTicNoteLanguage(
            inputConfig.language,
            typeof existingConfig.language === "string" &&
                existingConfig.language.trim()
                ? existingConfig.language.trim()
                : "zh",
        );
    } catch (error) {
        throw new SourceProviderSettingsError(
            error instanceof Error
                ? error.message
                : "TicNote language must be one of zh, en, ja",
            { code: "invalid-language" },
        );
    }

    const bearerToken = normalizeBearerToken(nextSecrets.bearerToken);
    const normalizedExistingConfig = resolveTicNoteConnectionConfig(
        params.existing?.baseUrl ?? TICNOTE_DEFAULT_BASE_URL,
        existingConfig,
    );
    const syncTitleToSource =
        typeof inputConfig.syncTitleToSource === "boolean"
            ? inputConfig.syncTitleToSource
            : normalizedExistingConfig.syncTitleToSource;

    if (enabled && !bearerToken) {
        throw new SourceProviderSettingsError(
            "请填写 TicNote Authorization / tic_token。",
            {
                code: "missing-secret",
            },
        );
    }

    if (bearerToken) {
        nextSecrets.bearerToken = bearerToken;
    }

    if (enabled && !orgId) {
        orgId = await autoDetectTicNoteOrgId({
            existing: params.existing,
            baseUrl,
            region,
            timezone,
            language,
            syncTitleToSource,
            bearerToken,
        });
    }

    const next: PreparedSourceConnectionWrite = {
        enabled,
        authMode: "bearer",
        baseUrl,
        config: {
            region,
            orgId,
            timezone,
            language,
            syncTitleToSource,
        },
        secretConfig: persistSecretConfig(nextSecrets),
    };

    if (!enabled) {
        return next;
    }

    const existingBearerToken = normalizeBearerToken(
        existingSecrets.bearerToken,
    );
    const existingRegion = resolveTicNoteRegion(
        existingConfig.region,
        params.existing?.baseUrl ?? TICNOTE_DEFAULT_BASE_URL,
    );
    const shouldValidateConnection =
        !params.existing ||
        params.existing.baseUrl !== baseUrl ||
        existingBearerToken !== bearerToken ||
        existingRegion !== region ||
        existingConfig.orgId !== orgId ||
        existingConfig.timezone !== timezone ||
        existingConfig.language !== language ||
        normalizedExistingConfig.syncTitleToSource !== syncTitleToSource;

    if (!shouldValidateConnection) {
        return next;
    }

    const client = new TicNoteSourceClient(
        buildResolvedConnectionForValidation({
            existing: params.existing,
            provider: "ticnote",
            enabled,
            authMode: "bearer",
            baseUrl,
            config: next.config,
            secrets: {
                bearerToken,
            },
        }),
    );
    const isValid = await client.testConnection();
    if (!isValid) {
        throw new SourceProviderSettingsError(
            getConnectionValidationMessage(
                client,
                "连接失败，请重新填写 TicNote Authorization / tic_token。",
            ),
            { code: "invalid-connection" },
        );
    }

    return next;
}

async function autoDetectTicNoteOrgId(params: {
    existing: PersistedSourceConnectionState | null;
    baseUrl: string;
    region: string;
    timezone: string;
    language: string;
    syncTitleToSource: boolean;
    bearerToken: string;
}) {
    const client = new TicNoteClient(
        buildResolvedConnectionForValidation({
            existing: params.existing,
            provider: "ticnote",
            enabled: true,
            authMode: "bearer",
            baseUrl: params.baseUrl,
            config: {
                region: params.region,
                orgId: "",
                timezone: params.timezone,
                language: params.language,
                syncTitleToSource: params.syncTitleToSource,
            },
            secrets: {
                bearerToken: params.bearerToken,
            },
        }),
    );

    let organizationIds: string[];
    try {
        organizationIds = await client.discoverOrganizationIds();
    } catch {
        throw new SourceProviderSettingsError(
            "无法自动识别组织信息，请检查站点版本和 TicNote Authorization / tic_token，或手动填写组织 ID。",
            { code: "org-auto-detect-failed" },
        );
    }

    if (organizationIds.length === 1) {
        return organizationIds[0] ?? "";
    }

    if (organizationIds.length > 1) {
        throw new SourceProviderSettingsError(
            "TicNote found multiple possible org IDs. Enter the org ID manually for now; org selection is not available yet.",
            { code: "multiple-org-candidates" },
        );
    }

    throw new SourceProviderSettingsError(
        "TicNote could not find an org ID automatically. Enter the org ID manually.",
        { code: "missing-org-candidates" },
    );
}

type TicNoteTitleWritebackTarget = SourceTitleWritebackTarget;

const ticnoteTitleWriteback = {
    resolveTarget(
        recording: SourceLinkedRecording,
    ): TicNoteTitleWritebackTarget | null {
        const remoteRecordingId = recording.sourceRecordingId || null;

        return remoteRecordingId
            ? {
                  provider: "ticnote",
                  remoteRecordingId,
              }
            : null;
    },
    async writeTitle(params: {
        connection: ResolvedSourceConnection;
        target: TicNoteTitleWritebackTarget;
        title: string;
    }) {
        if (!params.connection.secrets.bearerToken) {
            throw new Error(
                "This source connection is missing the credentials required for upstream title write-back",
            );
        }

        const client = new TicNoteClient(params.connection);
        await client.updateTitle(params.target.remoteRecordingId, params.title);
    },
};

export class TicNoteSourceClient implements SourceProviderClient {
    readonly provider = "ticnote" as const;
    private lastConnectionTestResult: SourceConnectionTestResult | null = null;
    private readonly client: TicNoteClient;

    constructor(connection: ResolvedSourceConnection) {
        this.client = new TicNoteClient(connection);
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
        const snapshots = await this.client.listRecordingSnapshots();
        return snapshots.map((snapshot) => toSourceRecordingData(snapshot));
    }
}

function toSourceRecordingData(
    snapshot: TicNoteRecordingSnapshot,
): SourceRecordingData {
    return {
        sourceProvider: "ticnote",
        sourceRecordingId: snapshot.recordingId,
        filename: snapshot.title,
        durationMs: snapshot.durationMs,
        startTime: snapshot.startTime,
        endTime: new Date(snapshot.startTime.getTime() + snapshot.durationMs),
        filesize: snapshot.filesize,
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
            transcriptSegments: snapshot.transcriptSegments,
            summaryMarkdown: snapshot.summaryMarkdown,
            detailPayload: snapshot.metadata,
        },
    };
}

export const ticnoteProviderDefinition: SourceProviderDefinition = {
    provider: "ticnote",
    metadata: SOURCE_PROVIDER_MANIFESTS.ticnote.metadata,
    defaults: SOURCE_PROVIDER_MANIFESTS.ticnote.defaults,
    resolveConnectionConfig(params) {
        return resolveTicNoteConnectionConfig(params.baseUrl, params.config);
    },
    createClient(connection) {
        return new TicNoteSourceClient(connection);
    },
    prepareConnectionWrite: prepareTicNoteConnectionWrite,
    titleWriteback: ticnoteTitleWriteback,
};
