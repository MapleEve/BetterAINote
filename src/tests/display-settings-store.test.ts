import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    __resetDisplaySettingsStoreForTests,
    ensureDisplaySettingsLoaded,
    getDisplaySettingsStoreSnapshot,
    saveDisplaySettings,
} from "@/features/settings/display-settings-store";

describe("display settings store", () => {
    beforeEach(() => {
        __resetDisplaySettingsStoreForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        __resetDisplaySettingsStoreForTests();
    });

    it("loads display settings once and shares the loaded snapshot", async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    uiLanguage: "en",
                    dateTimeFormat: "absolute",
                    recordingListSortOrder: "oldest",
                    itemsPerPage: 25,
                    theme: "dark",
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        const firstLoad = ensureDisplaySettingsLoaded();
        const secondLoad = ensureDisplaySettingsLoaded();

        expect(firstLoad).toBe(secondLoad);

        await expect(firstLoad).resolves.toEqual({
            uiLanguage: "en",
            dateTimeFormat: "absolute",
            recordingListSortOrder: "oldest",
            itemsPerPage: 25,
            theme: "dark",
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(getDisplaySettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            settings: {
                uiLanguage: "en",
                dateTimeFormat: "absolute",
                recordingListSortOrder: "oldest",
                itemsPerPage: 25,
                theme: "dark",
            },
        });
    });

    it("rolls back optimistic updates when saving fails", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        uiLanguage: "zh-CN",
                        dateTimeFormat: "relative",
                        recordingListSortOrder: "newest",
                        itemsPerPage: 50,
                        theme: "system",
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
                        error: "Failed to update display settings",
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);

        await ensureDisplaySettingsLoaded();

        const savePromise = saveDisplaySettings({
            uiLanguage: "en",
            itemsPerPage: 100,
        });

        expect(getDisplaySettingsStoreSnapshot()).toMatchObject({
            isSaving: true,
            settings: {
                uiLanguage: "en",
                itemsPerPage: 100,
            },
        });

        await expect(savePromise).rejects.toThrow(
            "Failed to update display settings",
        );

        expect(getDisplaySettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isSaving: false,
            settings: {
                uiLanguage: "zh-CN",
                itemsPerPage: 50,
            },
        });
    });
});
