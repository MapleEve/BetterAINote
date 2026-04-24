import type { SourceProviderManifest } from "@/lib/data-sources/types";
import { DEFAULT_SERVER_KEY } from "./servers";

export const plaudProviderManifest: SourceProviderManifest = {
    provider: "plaud",
    metadata: {
        provider: "plaud",
        displayName: "Plaud",
        authModes: ["bearer"],
        defaultBaseUrl: "https://api.plaud.ai",
        runtimeStatus: "active",
        maturity: {
            stage: "mainline",
            level: "validated",
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
            server: DEFAULT_SERVER_KEY,
            customApiBase: "",
            syncTitleToSource: false,
        },
    },
};
