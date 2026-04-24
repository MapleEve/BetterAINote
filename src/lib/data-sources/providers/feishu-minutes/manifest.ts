import type { SourceProviderManifest } from "@/lib/data-sources/types";

export const feishuMinutesProviderManifest: SourceProviderManifest = {
    provider: "feishu-minutes",
    metadata: {
        provider: "feishu-minutes",
        displayName: "Feishu Minutes",
        authModes: ["oauth-device-flow", "web-reverse"],
        defaultBaseUrl: "https://open.feishu.cn",
        runtimeStatus: "active",
        maturity: {
            stage: "experimental",
            level: "partial",
        },
        capabilities: {
            workerSync: true,
            audioDownload: true,
            officialTranscript: true,
            officialSummary: true,
            localRename: true,
            privateTranscribe: true,
            upstreamTitleWriteback: false,
        },
    },
    defaults: {
        authMode: "oauth-device-flow",
        config: {
            appId: "",
            spaceName: "cn",
        },
    },
};
