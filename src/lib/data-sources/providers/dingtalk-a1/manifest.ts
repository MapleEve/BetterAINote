import type { SourceProviderManifest } from "@/lib/data-sources/types";

export const dingtalkA1ProviderManifest: SourceProviderManifest = {
    provider: "dingtalk-a1",
    metadata: {
        provider: "dingtalk-a1",
        displayName: "DingTalk A1",
        authModes: ["device-signin"],
        defaultBaseUrl: "https://meeting-ai-tingji.dingtalk.com",
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
        authMode: "device-signin",
        config: {},
    },
};
