import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    __resetVoScriptSettingsStoreForTests,
    ensureVoScriptSettingsLoaded,
    getVoScriptSettingsStoreSnapshot,
    saveVoScriptSettings,
} from "@/features/settings/voscript-settings-store";

describe("voscript settings store", () => {
    beforeEach(() => {
        __resetVoScriptSettingsStoreForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        __resetVoScriptSettingsStoreForTests();
    });

    it("loads voscript settings once and normalizes the loaded snapshot", async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    privateTranscriptionBaseUrl: " https://voscript.internal ",
                    privateTranscriptionApiKeySet: true,
                    privateTranscriptionMinSpeakers: 2,
                    privateTranscriptionMaxSpeakers: 4,
                    privateTranscriptionDenoiseModel: "deepfilternet",
                    privateTranscriptionSnrThreshold: 9.5,
                    privateTranscriptionNoRepeatNgramSize: 4,
                    privateTranscriptionMaxInflightJobs: 3,
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        const firstLoad = ensureVoScriptSettingsLoaded();
        const secondLoad = ensureVoScriptSettingsLoaded();

        expect(firstLoad).toBe(secondLoad);

        await expect(firstLoad).resolves.toEqual({
            privateTranscriptionBaseUrl: "https://voscript.internal",
            privateTranscriptionApiKeySet: true,
            privateTranscriptionMinSpeakers: 2,
            privateTranscriptionMaxSpeakers: 4,
            privateTranscriptionDenoiseModel: "deepfilternet",
            privateTranscriptionSnrThreshold: 9.5,
            privateTranscriptionNoRepeatNgramSize: 4,
            privateTranscriptionMaxInflightJobs: 3,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(getVoScriptSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            settings: {
                privateTranscriptionBaseUrl: "https://voscript.internal",
                privateTranscriptionApiKeySet: true,
                privateTranscriptionMinSpeakers: 2,
                privateTranscriptionMaxSpeakers: 4,
                privateTranscriptionDenoiseModel: "deepfilternet",
                privateTranscriptionSnrThreshold: 9.5,
                privateTranscriptionNoRepeatNgramSize: 4,
                privateTranscriptionMaxInflightJobs: 3,
            },
        });
    });

    it("rolls back optimistic voscript updates when saving fails", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        privateTranscriptionBaseUrl:
                            "https://voscript.internal",
                        privateTranscriptionApiKeySet: false,
                        privateTranscriptionMinSpeakers: 0,
                        privateTranscriptionMaxSpeakers: 0,
                        privateTranscriptionDenoiseModel: "none",
                        privateTranscriptionSnrThreshold: null,
                        privateTranscriptionNoRepeatNgramSize: 0,
                        privateTranscriptionMaxInflightJobs: 1,
                    }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        error: "Failed to update VoScript settings",
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);

        await ensureVoScriptSettingsLoaded();

        const savePromise = saveVoScriptSettings({
            privateTranscriptionBaseUrl: "https://next.internal",
            privateTranscriptionApiKey: "vt-secret-key",
            privateTranscriptionMinSpeakers: 1,
            privateTranscriptionMaxSpeakers: 4,
            privateTranscriptionDenoiseModel: "deepfilternet",
            privateTranscriptionSnrThreshold: 8.5,
            privateTranscriptionNoRepeatNgramSize: 4,
            privateTranscriptionMaxInflightJobs: 2,
        });

        expect(getVoScriptSettingsStoreSnapshot()).toMatchObject({
            isSaving: true,
            settings: {
                privateTranscriptionBaseUrl: "https://next.internal",
                privateTranscriptionApiKeySet: true,
                privateTranscriptionMinSpeakers: 1,
                privateTranscriptionMaxSpeakers: 4,
                privateTranscriptionDenoiseModel: "deepfilternet",
                privateTranscriptionSnrThreshold: 8.5,
                privateTranscriptionNoRepeatNgramSize: 4,
                privateTranscriptionMaxInflightJobs: 2,
            },
        });

        await expect(savePromise).rejects.toThrow(
            "Failed to update VoScript settings",
        );

        expect(getVoScriptSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isSaving: false,
            settings: {
                privateTranscriptionBaseUrl: "https://voscript.internal",
                privateTranscriptionApiKeySet: false,
                privateTranscriptionMinSpeakers: 0,
                privateTranscriptionMaxSpeakers: 0,
                privateTranscriptionDenoiseModel: "none",
                privateTranscriptionSnrThreshold: null,
                privateTranscriptionNoRepeatNgramSize: 0,
                privateTranscriptionMaxInflightJobs: 1,
            },
        });
    });

    it("treats the store as loaded after a successful save following a failed initial load", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        error: "Failed to fetch VoScript settings",
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            )
            .mockResolvedValueOnce(new Response(null, { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(ensureVoScriptSettingsLoaded()).rejects.toThrow(
            "Failed to fetch VoScript settings",
        );

        expect(getVoScriptSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: false,
            isLoading: false,
            isSaving: false,
            settings: {
                privateTranscriptionBaseUrl: null,
                privateTranscriptionApiKeySet: false,
                privateTranscriptionMinSpeakers: 0,
                privateTranscriptionMaxSpeakers: 0,
                privateTranscriptionDenoiseModel: "none",
                privateTranscriptionSnrThreshold: null,
                privateTranscriptionNoRepeatNgramSize: 0,
                privateTranscriptionMaxInflightJobs: 1,
            },
        });

        await expect(
            saveVoScriptSettings({
                privateTranscriptionBaseUrl: "https://voscript.internal",
                privateTranscriptionApiKey: "vt-secret-key",
                privateTranscriptionMinSpeakers: 2,
                privateTranscriptionMaxSpeakers: 4,
            }),
        ).resolves.toBeUndefined();

        expect(getVoScriptSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            settings: {
                privateTranscriptionBaseUrl: "https://voscript.internal",
                privateTranscriptionApiKeySet: true,
                privateTranscriptionMinSpeakers: 2,
                privateTranscriptionMaxSpeakers: 4,
                privateTranscriptionDenoiseModel: "none",
                privateTranscriptionSnrThreshold: null,
                privateTranscriptionNoRepeatNgramSize: 0,
                privateTranscriptionMaxInflightJobs: 1,
            },
        });

        await expect(ensureVoScriptSettingsLoaded()).resolves.toEqual({
            privateTranscriptionBaseUrl: "https://voscript.internal",
            privateTranscriptionApiKeySet: true,
            privateTranscriptionMinSpeakers: 2,
            privateTranscriptionMaxSpeakers: 4,
            privateTranscriptionDenoiseModel: "none",
            privateTranscriptionSnrThreshold: null,
            privateTranscriptionNoRepeatNgramSize: 0,
            privateTranscriptionMaxInflightJobs: 1,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
