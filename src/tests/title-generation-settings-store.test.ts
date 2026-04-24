import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    __resetTitleGenerationSettingsStoreForTests,
    ensureTitleGenerationSettingsLoaded,
    getTitleGenerationSettingsStoreSnapshot,
    saveTitleGenerationSettings,
} from "@/features/settings/title-generation-settings-store";

describe("title generation settings store", () => {
    beforeEach(() => {
        __resetTitleGenerationSettingsStoreForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        __resetTitleGenerationSettingsStoreForTests();
    });

    it("loads title generation settings once and shares the loaded snapshot", async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    autoGenerateTitle: false,
                    titleGenerationBaseUrl: "https://llm.internal/v1",
                    titleGenerationModel: "gpt-4.1-mini",
                    titleGenerationApiKeySet: true,
                    titleGenerationPrompt: "Rename this transcript",
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        const firstLoad = ensureTitleGenerationSettingsLoaded();
        const secondLoad = ensureTitleGenerationSettingsLoaded();

        expect(firstLoad).toBe(secondLoad);

        await expect(firstLoad).resolves.toEqual({
            autoGenerateTitle: false,
            titleGenerationBaseUrl: "https://llm.internal/v1",
            titleGenerationModel: "gpt-4.1-mini",
            titleGenerationApiKeySet: true,
            titleGenerationPrompt: "Rename this transcript",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(getTitleGenerationSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            settings: {
                autoGenerateTitle: false,
                titleGenerationBaseUrl: "https://llm.internal/v1",
                titleGenerationModel: "gpt-4.1-mini",
                titleGenerationApiKeySet: true,
                titleGenerationPrompt: "Rename this transcript",
            },
        });
    });

    it("rolls back optimistic title generation updates when saving fails", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        autoGenerateTitle: true,
                        titleGenerationBaseUrl: "https://llm.internal/v1",
                        titleGenerationModel: "gpt-4.1-mini",
                        titleGenerationApiKeySet: false,
                        titleGenerationPrompt: null,
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
                        error: "Failed to update title generation settings",
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);

        await ensureTitleGenerationSettingsLoaded();

        const savePromise = saveTitleGenerationSettings({
            autoGenerateTitle: false,
            titleGenerationModel: "gpt-5-mini",
            titleGenerationApiKey: "tg-secret-key",
        });

        expect(getTitleGenerationSettingsStoreSnapshot()).toMatchObject({
            isSaving: true,
            settings: {
                autoGenerateTitle: false,
                titleGenerationModel: "gpt-5-mini",
                titleGenerationApiKeySet: true,
            },
        });

        await expect(savePromise).rejects.toThrow(
            "Failed to update title generation settings",
        );

        expect(getTitleGenerationSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isSaving: false,
            settings: {
                autoGenerateTitle: true,
                titleGenerationModel: "gpt-4.1-mini",
                titleGenerationApiKeySet: false,
            },
        });
    });

    it("treats a saved api key as configured after a failed initial load", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        error: "Failed to fetch title generation settings",
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            )
            .mockResolvedValueOnce(new Response(null, { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(ensureTitleGenerationSettingsLoaded()).rejects.toThrow(
            "Failed to fetch title generation settings",
        );

        expect(getTitleGenerationSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: false,
            isLoading: false,
            isSaving: false,
            settings: {
                autoGenerateTitle: true,
                titleGenerationBaseUrl: null,
                titleGenerationModel: null,
                titleGenerationApiKeySet: false,
                titleGenerationPrompt: null,
            },
        });

        await expect(
            saveTitleGenerationSettings({
                titleGenerationBaseUrl: "https://llm.internal/v1",
                titleGenerationModel: "gpt-4.1-mini",
                titleGenerationApiKey: "tg-secret-key",
            }),
        ).resolves.toBeUndefined();

        expect(getTitleGenerationSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            settings: {
                autoGenerateTitle: true,
                titleGenerationBaseUrl: "https://llm.internal/v1",
                titleGenerationModel: "gpt-4.1-mini",
                titleGenerationApiKeySet: true,
                titleGenerationPrompt: null,
            },
        });

        await expect(ensureTitleGenerationSettingsLoaded()).resolves.toEqual({
            autoGenerateTitle: true,
            titleGenerationBaseUrl: "https://llm.internal/v1",
            titleGenerationModel: "gpt-4.1-mini",
            titleGenerationApiKeySet: true,
            titleGenerationPrompt: null,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
