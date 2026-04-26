import { SOURCE_PROVIDER_MANIFESTS } from "./providers/manifest";
import {
    DATA_SOURCE_PROVIDERS,
    SOURCE_CAPABILITY_ORDER,
    type SourceAuthMode,
    type SourceCapability,
    type SourceCapabilitySet,
    type SourceCatalogEntry,
    type SourceMaturity,
    type SourceMaturityLevel,
    type SourceMaturityStage,
    type SourceProvider,
} from "./types";

export { DATA_SOURCE_PROVIDERS, SOURCE_CAPABILITY_ORDER };

export type {
    SourceAuthMode,
    SourceCapability,
    SourceCapabilitySet,
    SourceCatalogEntry,
    SourceMaturity,
    SourceMaturityLevel,
    SourceMaturityStage,
    SourceProvider,
};

export interface RecordingCapabilityState {
    provider: SourceProvider | null;
    hasAudio: boolean;
    providerSupportsAudioDownload: boolean;
    providerSupportsPrivateTranscribe: boolean;
    providerSupportsLocalRename: boolean;
    providerSupportsUpstreamTitleWriteback: boolean;
    canPrivateTranscribe: boolean;
    canRenameLocally: boolean;
    canSyncTitleUpstream: boolean;
}

export const DATA_SOURCE_CATALOG: Record<SourceProvider, SourceCatalogEntry> =
    Object.fromEntries(
        DATA_SOURCE_PROVIDERS.map((provider) => [
            provider,
            SOURCE_PROVIDER_MANIFESTS[provider].metadata,
        ]),
    ) as Record<SourceProvider, SourceCatalogEntry>;

const NO_RUNTIME_CAPABILITIES: SourceCapabilitySet = {
    workerSync: false,
    audioDownload: false,
    officialTranscript: false,
    officialSummary: false,
    localRename: false,
    privateTranscribe: false,
    upstreamTitleWriteback: false,
};

export function getSourceCapabilitiesForAuthMode(
    provider: SourceProvider,
    authMode: string | null | undefined,
): SourceCapabilitySet {
    if (provider === "feishu-minutes" && authMode === "web-reverse") {
        return { ...NO_RUNTIME_CAPABILITIES };
    }

    return { ...DATA_SOURCE_CATALOG[provider].capabilities };
}

export function sourceConnectionSupportsWorkerSync(connection: {
    provider: SourceProvider;
    authMode: string | null | undefined;
}) {
    return getSourceCapabilitiesForAuthMode(
        connection.provider,
        connection.authMode,
    ).workerSync;
}

export function sourceProviderSupportsCapability(
    provider: SourceProvider,
    capability: SourceCapability,
) {
    return DATA_SOURCE_CATALOG[provider].capabilities[capability];
}

export function getSourceProviderMaturity(provider: SourceProvider) {
    return DATA_SOURCE_CATALOG[provider].maturity;
}

function getKnownSourceProvider(
    provider: string | null | undefined,
): SourceProvider | null {
    return isSourceProvider(provider) ? provider : null;
}

export function getRecordingCapabilityState(params: {
    sourceProvider: string | null | undefined;
    hasAudio: boolean;
}): RecordingCapabilityState {
    const provider = getKnownSourceProvider(params.sourceProvider);
    const capabilities = provider
        ? DATA_SOURCE_CATALOG[provider].capabilities
        : null;

    const providerSupportsAudioDownload = capabilities?.audioDownload ?? true;
    const providerSupportsPrivateTranscribe =
        capabilities?.privateTranscribe ?? true;
    const providerSupportsLocalRename = capabilities?.localRename ?? true;
    const providerSupportsUpstreamTitleWriteback =
        capabilities?.upstreamTitleWriteback ?? false;

    return {
        provider,
        hasAudio: params.hasAudio,
        providerSupportsAudioDownload,
        providerSupportsPrivateTranscribe,
        providerSupportsLocalRename,
        providerSupportsUpstreamTitleWriteback,
        canPrivateTranscribe:
            params.hasAudio && providerSupportsPrivateTranscribe,
        canRenameLocally: providerSupportsLocalRename,
        canSyncTitleUpstream: providerSupportsUpstreamTitleWriteback,
    };
}

export function canRecordingUsePrivateTranscribe(params: {
    sourceProvider: string | null | undefined;
    hasAudio: boolean;
}) {
    return getRecordingCapabilityState(params).canPrivateTranscribe;
}

export function canRecordingRenameLocally(
    sourceProvider: string | null | undefined,
) {
    return getRecordingCapabilityState({
        sourceProvider,
        hasAudio: false,
    }).canRenameLocally;
}

export function canRecordingSyncTitleUpstream(
    sourceProvider: string | null | undefined,
) {
    return getRecordingCapabilityState({
        sourceProvider,
        hasAudio: false,
    }).canSyncTitleUpstream;
}

export function isSourceProvider(value: unknown): value is SourceProvider {
    return (
        typeof value === "string" &&
        (DATA_SOURCE_PROVIDERS as readonly string[]).includes(value)
    );
}

export function isSourceAuthMode(value: unknown): value is SourceAuthMode {
    return (
        typeof value === "string" &&
        [
            "bearer",
            "cookie",
            "oauth-device-flow",
            "web-reverse",
            "session-header",
            "device-signin",
        ].includes(value)
    );
}
