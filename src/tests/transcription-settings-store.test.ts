import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    __resetTranscriptionSettingsStoreForTests,
    ensureTranscriptionSettingsLoaded,
    getTranscriptionSettingsStoreSnapshot,
    saveTranscriptionSettings,
} from "@/features/settings/transcription-settings-store";

describe("transcription settings store", () => {
    beforeEach(() => {
        __resetTranscriptionSettingsStoreForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        __resetTranscriptionSettingsStoreForTests();
    });

    it("loads transcription settings once and shares the loaded snapshot", async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    autoTranscribe: true,
                    defaultTranscriptionLanguage: "en",
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        const firstLoad = ensureTranscriptionSettingsLoaded();
        const secondLoad = ensureTranscriptionSettingsLoaded();

        expect(firstLoad).toBe(secondLoad);

        await expect(firstLoad).resolves.toEqual({
            autoTranscribe: true,
            defaultTranscriptionLanguage: "en",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(getTranscriptionSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            settings: {
                autoTranscribe: true,
                defaultTranscriptionLanguage: "en",
            },
        });
    });

    it("rolls back optimistic transcription updates when saving fails", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        autoTranscribe: false,
                        defaultTranscriptionLanguage: null,
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
                        error: "Failed to update transcription settings",
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);

        await ensureTranscriptionSettingsLoaded();

        const savePromise = saveTranscriptionSettings({
            autoTranscribe: true,
            defaultTranscriptionLanguage: "zh",
        });

        expect(getTranscriptionSettingsStoreSnapshot()).toMatchObject({
            isSaving: true,
            settings: {
                autoTranscribe: true,
                defaultTranscriptionLanguage: "zh",
            },
        });

        await expect(savePromise).rejects.toThrow(
            "Failed to update transcription settings",
        );

        expect(getTranscriptionSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isSaving: false,
            settings: {
                autoTranscribe: false,
                defaultTranscriptionLanguage: null,
            },
        });
    });

    it("treats the store as loaded after a successful save following a failed initial load", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        error: "Failed to fetch transcription settings",
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            )
            .mockResolvedValueOnce(new Response(null, { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(ensureTranscriptionSettingsLoaded()).rejects.toThrow(
            "Failed to fetch transcription settings",
        );

        expect(getTranscriptionSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: false,
            isLoading: false,
            isSaving: false,
            settings: {
                autoTranscribe: false,
                defaultTranscriptionLanguage: null,
            },
        });

        await expect(
            saveTranscriptionSettings({
                autoTranscribe: true,
            }),
        ).resolves.toBeUndefined();

        expect(getTranscriptionSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            settings: {
                autoTranscribe: true,
                defaultTranscriptionLanguage: null,
            },
        });

        await expect(ensureTranscriptionSettingsLoaded()).resolves.toEqual({
            autoTranscribe: true,
            defaultTranscriptionLanguage: null,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
