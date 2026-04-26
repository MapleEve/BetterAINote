export const DATA_SOURCE_PROVIDERS = [
    "plaud",
    "ticnote",
    "feishu-minutes",
    "dingtalk-a1",
    "iflyrec",
] as const;

export type SourceProvider = (typeof DATA_SOURCE_PROVIDERS)[number];

export type SourceAuthMode =
    | "bearer"
    | "cookie"
    | "oauth-device-flow"
    | "web-reverse"
    | "session-header"
    | "device-signin";

export interface SourceCapabilitySet {
    workerSync: boolean;
    audioDownload: boolean;
    officialTranscript: boolean;
    officialSummary: boolean;
    localRename: boolean;
    privateTranscribe: boolean;
    upstreamTitleWriteback: boolean;
}

export const SOURCE_CAPABILITY_ORDER = [
    "workerSync",
    "audioDownload",
    "officialTranscript",
    "officialSummary",
    "privateTranscribe",
    "localRename",
    "upstreamTitleWriteback",
] as const;

export type SourceCapability = keyof SourceCapabilitySet;

export type SourceMaturityStage = "mainline" | "experimental";

export type SourceMaturityLevel =
    | "validated"
    | "near-usable"
    | "partial"
    | "verifiable";

export interface SourceMaturity {
    stage: SourceMaturityStage;
    level: SourceMaturityLevel;
}

export interface SourceCatalogEntry {
    provider: SourceProvider;
    displayName: string;
    authModes: SourceAuthMode[];
    defaultBaseUrl: string | null;
    runtimeStatus: "active" | "planned";
    maturity: SourceMaturity;
    capabilities: SourceCapabilitySet;
}

export type GenericSourceSecrets = Record<string, string>;
export type GenericSourceConfig = Record<string, unknown>;

export type DataSourcesRequestBody = {
    provider?: unknown;
    enabled?: unknown;
    authMode?: unknown;
    baseUrl?: unknown;
    config?: unknown;
    secrets?: unknown;
};

export interface SourceConnectionStateDefaults {
    authMode: SourceAuthMode;
    config: GenericSourceConfig;
}

export interface PersistedSourceConnectionState {
    userId: string;
    provider: SourceProvider;
    enabled: boolean;
    authMode: string | null;
    baseUrl: string | null;
    config: Record<string, unknown> | null;
    secretConfig: string | null;
    lastSync: Date | null;
}

export type PreparedSourceConnectionWrite = {
    enabled: boolean;
    authMode: SourceAuthMode;
    baseUrl: string | null;
    config: GenericSourceConfig;
    secretConfig: string | null;
};

export class SourceProviderSettingsError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(message: string, options?: { status?: number; code?: string }) {
        super(message);
        this.name = "SourceProviderSettingsError";
        this.status = options?.status ?? 400;
        this.code = options?.code ?? "invalid-source-settings";
    }
}

export interface SourceTranscriptSegment {
    speaker: string;
    startMs: number;
    endMs: number;
    text: string;
}

export interface SourceArtifacts {
    transcriptText?: string | null;
    transcriptSegments?: SourceTranscriptSegment[] | null;
    summaryMarkdown?: string | null;
    detailPayload?: Record<string, unknown> | null;
}

export interface SourceAudioDownload {
    url: string;
    headers?: Record<string, string>;
    fileExtension?: string | null;
}

export interface SourceAudioArchivePlan {
    url: string;
    headers?: Record<string, string>;
    archiveBaseName: string;
    fileExtension: string;
    contentType: string;
}

export interface SourceRecordingData {
    sourceProvider: SourceProvider;
    sourceRecordingId: string;
    filename: string;
    durationMs: number;
    startTime: Date;
    endTime: Date;
    filesize?: number | null;
    md5?: string | null;
    version?: string | null;
    providerDeviceId?: string | null;
    upstreamTrashed?: boolean;
    upstreamDeleted?: boolean;
    metadata?: Record<string, unknown> | null;
    audioDownload?: SourceAudioDownload | null;
    artifacts?: SourceArtifacts | null;
}

export interface ResolvedSourceConnection {
    userId: string;
    provider: SourceProvider;
    enabled: boolean;
    authMode: SourceAuthMode;
    baseUrl: string | null;
    config: Record<string, unknown>;
    secrets: Record<string, string>;
    lastSync: Date | null;
}

export interface SourceConnectionTestResult {
    ok: boolean;
    code: string;
    message: string;
}

export interface SourceProviderClient {
    provider: SourceProvider;
    testConnection(): Promise<boolean>;
    getLastConnectionTestResult?(): SourceConnectionTestResult | null;
    listRecordings(): Promise<SourceRecordingData[]>;
}

export type SourceLinkedRecording = {
    sourceProvider: string;
    sourceRecordingId: string;
};

export type SourceTitleWritebackTarget = {
    provider: SourceProvider;
    remoteRecordingId: string;
};

export type SourceTitleWritebackDriver = {
    resolveTarget(
        recording: SourceLinkedRecording,
    ): SourceTitleWritebackTarget | null;
    writeTitle(params: {
        connection: ResolvedSourceConnection;
        target: SourceTitleWritebackTarget;
        title: string;
    }): Promise<void>;
};

export interface SourceProviderDefinition {
    provider: SourceProvider;
    metadata: SourceCatalogEntry;
    defaults: SourceConnectionStateDefaults;
    createClient(connection: ResolvedSourceConnection): SourceProviderClient;
    resolveConnectionConfig?(params: {
        baseUrl: string | null | undefined;
        config: Record<string, unknown> | null | undefined;
    }): GenericSourceConfig;
    prepareConnectionWrite?(params: {
        userId: string;
        existing: PersistedSourceConnectionState | null;
        body: DataSourcesRequestBody;
    }): Promise<PreparedSourceConnectionWrite>;
    titleWriteback?: SourceTitleWritebackDriver | null;
}

export type SourceProviderManifest = Pick<
    SourceProviderDefinition,
    "provider" | "metadata" | "defaults"
>;
