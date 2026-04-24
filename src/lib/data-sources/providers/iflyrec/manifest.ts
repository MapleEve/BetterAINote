import type { SourceProviderManifest } from "@/lib/data-sources/types";

export const iflyrecProviderManifest: SourceProviderManifest = {
    provider: "iflyrec",
    metadata: {
        provider: "iflyrec",
        displayName: "iFLYTEK iflyrec",
        authModes: ["session-header"],
        defaultBaseUrl: "https://www.iflyrec.com",
        runtimeStatus: "active",
        maturity: {
            stage: "experimental",
            level: "verifiable",
        },
        capabilities: {
            workerSync: true,
            audioDownload: false,
            officialTranscript: true,
            officialSummary: false,
            localRename: false,
            privateTranscribe: false,
            upstreamTitleWriteback: false,
        },
    },
    defaults: {
        authMode: "session-header",
        config: {
            bizId: "tjzs",
        },
    },
};
