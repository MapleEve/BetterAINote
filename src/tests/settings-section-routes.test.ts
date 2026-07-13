import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/lib/settings/user-settings", () => ({
    getAuthenticatedUserId: vi.fn(),
    getUserSettingsRow: vi.fn(),
    upsertUserSettings: vi.fn(),
}));

vi.mock(
    "@/server/modules/api-credentials/title-generation",
    async (importOriginal) => {
        const actual =
            await importOriginal<
                typeof import("@/server/modules/api-credentials/title-generation")
            >();

        return {
            ...actual,
            hasStoredTitleGenerationCredential: vi.fn(),
            upsertStoredTitleGenerationCredential: vi.fn(),
        };
    },
);

vi.mock("@/server/modules/api-credentials/private-transcription", () => ({
    hasStoredPrivateTranscriptionCredential: vi.fn(),
    syncStoredPrivateTranscriptionBaseUrl: vi.fn(),
    upsertStoredPrivateTranscriptionCredential: vi.fn(),
}));

vi.mock("@/server/modules/data-sources", () => ({
    getResolvedSourceConnectionForUser: vi.fn(),
    hasConfiguredSourceSecrets: vi.fn(),
}));

vi.mock("@/lib/settings/number-normalization", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@/lib/settings/number-normalization")
        >();

    return {
        ...actual,
        normalizeNonNegativeInteger: vi.fn((_: string, value: unknown) => {
            if (
                typeof value !== "number" ||
                !Number.isFinite(value) ||
                !Number.isInteger(value) ||
                value < 0
            ) {
                throw new Error("invalid");
            }

            return value;
        }),
    };
});

vi.mock("@/lib/settings/voscript-settings", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@/lib/settings/voscript-settings")
        >();

    return {
        ...actual,
        normalizeVoScriptDenoiseModel: vi.fn((value: unknown) => {
            if (typeof value !== "string") {
                throw new Error("invalid denoise model");
            }

            return value;
        }),
    };
});

vi.mock("@/lib/encryption", () => ({
    encrypt: vi.fn((value: string) => `encrypted:${value}`),
}));

import {
    GET as getDisplay,
    PUT as putDisplay,
} from "@/app/api/settings/display/route";
import {
    GET as getPlayback,
    PUT as putPlayback,
} from "@/app/api/settings/playback/route";
import { GET as getSync, PUT as putSync } from "@/app/api/settings/sync/route";
import {
    GET as getTitleGeneration,
    PUT as putTitleGeneration,
} from "@/app/api/settings/title-generation/route";
import {
    GET as getTranscription,
    PUT as putTranscription,
} from "@/app/api/settings/transcription/route";
import {
    GET as getVoScript,
    PUT as putVoScript,
} from "@/app/api/settings/voscript/route";
import {
    getAuthenticatedUserId,
    getUserSettingsRow,
    upsertUserSettings,
} from "@/lib/settings/user-settings";
import {
    hasStoredPrivateTranscriptionCredential,
    syncStoredPrivateTranscriptionBaseUrl,
    upsertStoredPrivateTranscriptionCredential,
} from "@/server/modules/api-credentials/private-transcription";
import {
    hasStoredTitleGenerationCredential,
    upsertStoredTitleGenerationCredential,
} from "@/server/modules/api-credentials/title-generation";
import {
    getResolvedSourceConnectionForUser,
    hasConfiguredSourceSecrets,
} from "@/server/modules/data-sources";

function makePutRequest(url: string, body: Record<string, unknown>) {
    return new Request(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("settings section routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getAuthenticatedUserId as Mock).mockResolvedValue("user-1");
        (getUserSettingsRow as Mock).mockResolvedValue(null);
        (upsertUserSettings as Mock).mockResolvedValue(null);
        (hasStoredTitleGenerationCredential as Mock).mockResolvedValue(false);
        (upsertStoredTitleGenerationCredential as Mock).mockResolvedValue(
            undefined,
        );
        (hasStoredPrivateTranscriptionCredential as Mock).mockResolvedValue(
            false,
        );
        (syncStoredPrivateTranscriptionBaseUrl as Mock).mockResolvedValue(
            undefined,
        );
        (upsertStoredPrivateTranscriptionCredential as Mock).mockResolvedValue(
            undefined,
        );
        (getResolvedSourceConnectionForUser as Mock).mockResolvedValue(null);
        (hasConfiguredSourceSecrets as Mock).mockReturnValue(false);
    });

    it("stores uiLanguage through the display route", async () => {
        const response = await putDisplay(
            makePutRequest("http://localhost/api/settings/display", {
                uiLanguage: "en",
                displayDensity: "compact",
            }),
        );

        expect(response.status).toBe(200);
        expect(upsertUserSettings).toHaveBeenCalledWith("user-1", {
            displayDensity: "compact",
            uiLanguage: "en",
        });
    });

    it("rejects invalid display density through the display route", async () => {
        const response = await putDisplay(
            makePutRequest("http://localhost/api/settings/display", {
                displayDensity: "dense",
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "displayDensity must be one of comfy, compact",
        });
        expect(upsertUserSettings).not.toHaveBeenCalled();
    });

    it("stores syncInterval in milliseconds through the sync route", async () => {
        const response = await putSync(
            makePutRequest("http://localhost/api/settings/sync", {
                syncIntervalSeconds: 15,
            }),
        );

        expect(response.status).toBe(200);
        expect(upsertUserSettings).toHaveBeenCalledWith("user-1", {
            syncInterval: 60000,
        });
    });

    it("stores playback preferences through the playback route", async () => {
        const response = await putPlayback(
            makePutRequest("http://localhost/api/settings/playback", {
                defaultPlaybackSpeed: 1.25,
                defaultVolume: 55.8,
                autoPlayNext: true,
            }),
        );

        expect(response.status).toBe(200);
        expect(upsertUserSettings).toHaveBeenCalledWith("user-1", {
            defaultPlaybackSpeed: 1.25,
            defaultVolume: 55,
            autoPlayNext: true,
        });
    });

    it("rejects title generation URLs with query strings through the title-generation route", async () => {
        const response = await putTitleGeneration(
            makePutRequest("http://localhost/api/settings/title-generation", {
                titleGenerationBaseUrl:
                    "https://llm.example.test/v1?model=gpt-4.1",
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "titleGenerationBaseUrl must not include query parameters or fragments",
        });
        expect(upsertUserSettings).not.toHaveBeenCalled();
    });

    it("stores the title generation API key outside user_settings through the title-generation route", async () => {
        const response = await putTitleGeneration(
            makePutRequest("http://localhost/api/settings/title-generation", {
                titleGenerationBaseUrl: "https://llm.example.test/v1",
                titleGenerationModel: "gpt-4.1-mini",
                titleGenerationApiKey: "tg-secret-key",
            }),
        );

        expect(response.status).toBe(200);
        expect(upsertUserSettings).toHaveBeenCalledWith("user-1", {
            titleGenerationBaseUrl: "https://llm.example.test/v1",
            titleGenerationModel: "gpt-4.1-mini",
        });
        expect(upsertStoredTitleGenerationCredential).toHaveBeenCalledWith({
            userId: "user-1",
            apiKey: "encrypted:tg-secret-key",
        });
    });

    it("encrypts the private transcription API key through the voscript route", async () => {
        const response = await putVoScript(
            makePutRequest("http://localhost/api/settings/voscript", {
                privateTranscriptionApiKey: "vt-secret-key",
            }),
        );

        expect(response.status).toBe(200);
        expect(upsertUserSettings).toHaveBeenCalledWith("user-1", {});
        expect(upsertStoredPrivateTranscriptionCredential).toHaveBeenCalledWith(
            {
                userId: "user-1",
                apiKey: "encrypted:vt-secret-key",
                baseUrl: null,
            },
        );
    });

    it("keeps the voscript API key configured flag out of user_settings", async () => {
        (getUserSettingsRow as Mock).mockResolvedValue({
            privateTranscriptionBaseUrl: "https://voscript.example.test",
            privateTranscriptionMinSpeakers: 0,
            privateTranscriptionMaxSpeakers: 0,
            privateTranscriptionDenoiseModel: "none",
            privateTranscriptionSnrThreshold: null,
            privateTranscriptionNoRepeatNgramSize: 0,
            privateTranscriptionMaxInflightJobs: 1,
        });
        (hasStoredPrivateTranscriptionCredential as Mock).mockResolvedValue(
            true,
        );

        const response = await getVoScript(
            new Request("http://localhost/api/settings/voscript"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            privateTranscriptionBaseUrl: "https://voscript.example.test",
            privateTranscriptionApiKeySet: true,
        });
    });

    it("keeps the title generation API key configured flag out of user_settings", async () => {
        (getUserSettingsRow as Mock).mockResolvedValue({
            autoTranscribe: false,
            autoGenerateTitle: true,
            titleGenerationBaseUrl: "https://llm.example.test/v1",
            titleGenerationModel: "gpt-4.1-mini",
            titleGenerationPrompt: null,
        });
        (hasStoredTitleGenerationCredential as Mock).mockResolvedValue(true);

        const response = await getTitleGeneration(
            new Request("http://localhost/api/settings/title-generation"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            autoGenerateTitle: true,
            titleGenerationBaseUrl: "https://llm.example.test/v1",
            titleGenerationModel: "gpt-4.1-mini",
            titleGenerationApiKeySet: true,
        });
    });

    it("returns display defaults when no settings row exists", async () => {
        const response = await getDisplay(
            new Request("http://localhost/api/settings/display"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            uiLanguage: "zh-CN",
            dateTimeFormat: "relative",
            recordingListSortOrder: "newest",
            itemsPerPage: 50,
            displayDensity: "comfy",
            theme: "dark",
        });
    });

    it("returns sync defaults with legacy interval compatibility fields", async () => {
        const response = await getSync(
            new Request("http://localhost/api/settings/sync"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            autoSyncEnabled: true,
            syncInterval: 300000,
            syncIntervalSeconds: 300,
        });
    });

    it("returns playback defaults when no settings row exists", async () => {
        const response = await getPlayback(
            new Request("http://localhost/api/settings/playback"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            defaultPlaybackSpeed: 1.0,
            defaultVolume: 80,
            autoPlayNext: false,
        });
    });

    it("returns transcription defaults without legacy source-sync flags", async () => {
        const response = await getTranscription(
            new Request("http://localhost/api/settings/transcription"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            autoTranscribe: true,
            defaultTranscriptionLanguage: null,
            defaultTranscriptionProvider: null,
        });
    });

    it("respects an explicitly disabled transcription auto-transcribe setting", async () => {
        (getUserSettingsRow as Mock).mockResolvedValue({
            autoTranscribe: false,
            defaultTranscriptionLanguage: null,
            defaultTranscriptionProvider: "ticnote",
        });

        const response = await getTranscription(
            new Request("http://localhost/api/settings/transcription"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            autoTranscribe: false,
            defaultTranscriptionLanguage: null,
            defaultTranscriptionProvider: "ticnote",
        });
    });

    it("stores and reads back a default transcription provider for the current user's configured connection", async () => {
        (getResolvedSourceConnectionForUser as Mock).mockResolvedValue({
            enabled: true,
            authMode: "bearer",
            secrets: { bearerToken: "configured-test-token" },
        });
        (hasConfiguredSourceSecrets as Mock).mockReturnValue(true);

        const saveResponse = await putTranscription(
            makePutRequest("http://localhost/api/settings/transcription", {
                defaultTranscriptionProvider: "ticnote",
            }),
        );

        expect(saveResponse.status).toBe(200);
        expect(getResolvedSourceConnectionForUser).toHaveBeenCalledWith(
            "user-1",
            "ticnote",
        );
        expect(upsertUserSettings).toHaveBeenCalledWith("user-1", {
            defaultTranscriptionProvider: "ticnote",
        });

        (getUserSettingsRow as Mock).mockResolvedValue({
            autoTranscribe: true,
            defaultTranscriptionLanguage: null,
            defaultTranscriptionProvider: "ticnote",
        });
        const readResponse = await getTranscription(
            new Request("http://localhost/api/settings/transcription"),
        );

        expect(readResponse.status).toBe(200);
        await expect(readResponse.json()).resolves.toEqual({
            autoTranscribe: true,
            defaultTranscriptionLanguage: null,
            defaultTranscriptionProvider: "ticnote",
        });
    });

    it("clears the default transcription provider without resolving a source connection", async () => {
        const response = await putTranscription(
            makePutRequest("http://localhost/api/settings/transcription", {
                defaultTranscriptionProvider: null,
            }),
        );

        expect(response.status).toBe(200);
        expect(getResolvedSourceConnectionForUser).not.toHaveBeenCalled();
        expect(upsertUserSettings).toHaveBeenCalledWith("user-1", {
            defaultTranscriptionProvider: null,
        });
    });

    it("leaves the default transcription provider unchanged when the field is omitted", async () => {
        const response = await putTranscription(
            makePutRequest("http://localhost/api/settings/transcription", {
                autoTranscribe: false,
            }),
        );

        expect(response.status).toBe(200);
        expect(getResolvedSourceConnectionForUser).not.toHaveBeenCalled();
        expect(upsertUserSettings).toHaveBeenCalledWith("user-1", {
            autoTranscribe: false,
        });
    });

    it("requires authentication before writing transcription settings", async () => {
        (getAuthenticatedUserId as Mock).mockResolvedValue(null);

        const response = await putTranscription(
            makePutRequest("http://localhost/api/settings/transcription", {
                defaultTranscriptionProvider: null,
            }),
        );

        expect(response.status).toBe(401);
        expect(getResolvedSourceConnectionForUser).not.toHaveBeenCalled();
        expect(upsertUserSettings).not.toHaveBeenCalled();
    });

    it("rejects invalid, disconnected, credentialless, and other-user default transcription providers without writing", async () => {
        const cases: Array<{
            connection: Record<string, unknown> | null;
            hasSecrets?: boolean;
            name: string;
            provider: string;
        }> = [
            {
                name: "unknown provider",
                connection: null,
                provider: "unknown-provider",
            },
            {
                name: "disconnected source",
                connection: {
                    enabled: false,
                    authMode: "bearer",
                    secrets: { bearerToken: "configured-test-token" },
                },
                hasSecrets: true,
                provider: "ticnote",
            },
            {
                name: "source without credentials",
                connection: {
                    enabled: true,
                    authMode: "bearer",
                    secrets: {},
                },
                hasSecrets: false,
                provider: "ticnote",
            },
            {
                name: "other user's source",
                connection: null,
                provider: "feishu-minutes",
            },
        ];

        for (const testCase of cases) {
            vi.clearAllMocks();
            (getAuthenticatedUserId as Mock).mockResolvedValue("user-1");
            (getResolvedSourceConnectionForUser as Mock).mockResolvedValue(
                testCase.connection,
            );
            (hasConfiguredSourceSecrets as Mock).mockReturnValue(
                testCase.hasSecrets ?? false,
            );

            const response = await putTranscription(
                makePutRequest("http://localhost/api/settings/transcription", {
                    defaultTranscriptionProvider: testCase.provider,
                }),
            );

            expect(response.status, testCase.name).toBe(400);
            expect(upsertUserSettings).not.toHaveBeenCalled();
        }
    });

    it("keeps shared diarization fields out of transcription updates", async () => {
        const response = await putTranscription(
            makePutRequest("http://localhost/api/settings/transcription", {
                speakerDiarization: true,
                diarizationSpeakers: 4,
                defaultTranscriptionLanguage: "en",
            }),
        );

        expect(response.status).toBe(200);
        expect(upsertUserSettings).toHaveBeenCalledWith("user-1", {
            defaultTranscriptionLanguage: "en",
        });
    });

    it("stores voscript no-repeat ngram size through the voscript route", async () => {
        const response = await putVoScript(
            makePutRequest("http://localhost/api/settings/voscript", {
                privateTranscriptionNoRepeatNgramSize: 4,
            }),
        );

        expect(response.status).toBe(200);
        expect(upsertUserSettings).toHaveBeenCalledWith("user-1", {
            privateTranscriptionNoRepeatNgramSize: 4,
        });
    });
});
