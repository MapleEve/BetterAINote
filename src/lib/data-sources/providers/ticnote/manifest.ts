import type { SourceProviderManifest } from "@/lib/data-sources/types";

export const ticnoteProviderManifest: SourceProviderManifest = {
    provider: "ticnote",
    metadata: {
        provider: "ticnote",
        displayName: "TicNote",
        authModes: ["bearer"],
        defaultBaseUrl: "https://voice-api.ticnote.cn",
        runtimeStatus: "active",
        maturity: {
            stage: "experimental",
            level: "near-usable",
        },
        capabilities: {
            workerSync: true,
            audioDownload: true,
            officialTranscript: true,
            officialSummary: true,
            localRename: true,
            privateTranscribe: true,
            upstreamTitleWriteback: true,
        },
    },
    defaults: {
        authMode: "bearer",
        config: {
            region: "cn",
            orgId: "",
            timezone: "Asia/Shanghai",
            language: "zh",
            syncTitleToSource: false,
        },
    },
};
