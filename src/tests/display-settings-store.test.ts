import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    __resetDisplaySettingsStoreForTests,
    ensureDisplaySettingsLoaded,
    getDisplaySettingsStoreSnapshot,
    saveDisplaySettings,
    useDisplaySettingsStore,
} from "@/features/settings/display-settings-store";

function DisplaySettingsProbe() {
    const {
        hasLoaded,
        settings: { displayDensity, itemsPerPage, recordingListSortOrder },
    } = useDisplaySettingsStore();

    return React.createElement("output", {
        "data-has-loaded": String(hasLoaded),
        "data-density": displayDensity,
        "data-items-per-page": String(itemsPerPage),
        "data-sort-order": recordingListSortOrder,
    });
}

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
                    displayDensity: "compact",
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
            displayDensity: "compact",
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
                displayDensity: "compact",
                theme: "dark",
            },
        });
    });

    it("uses default settings for server and hydration snapshots even after client cache is loaded", async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    uiLanguage: "en",
                    dateTimeFormat: "absolute",
                    recordingListSortOrder: "oldest",
                    itemsPerPage: 25,
                    displayDensity: "compact",
                    theme: "dark",
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        await ensureDisplaySettingsLoaded();

        expect(getDisplaySettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            settings: {
                recordingListSortOrder: "oldest",
                itemsPerPage: 25,
            },
        });

        const html = renderToStaticMarkup(
            React.createElement(DisplaySettingsProbe),
        );

        expect(html).toContain('data-has-loaded="false"');
        expect(html).toContain('data-density="comfy"');
        expect(html).toContain('data-items-per-page="50"');
        expect(html).toContain('data-sort-order="newest"');
    });

    it("maps legacy ISO display settings to absolute time", async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    uiLanguage: "zh-CN",
                    dateTimeFormat: "iso",
                    recordingListSortOrder: "newest",
                    itemsPerPage: 50,
                    displayDensity: "comfy",
                    theme: "dark",
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        await expect(ensureDisplaySettingsLoaded()).resolves.toMatchObject({
            dateTimeFormat: "absolute",
        });

        expect(getDisplaySettingsStoreSnapshot().settings).toMatchObject({
            dateTimeFormat: "absolute",
        });
    });

    it("keeps a load error until display settings load successfully", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        error: "Display settings unavailable",
                    }),
                    {
                        status: 503,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        uiLanguage: "en",
                        dateTimeFormat: "absolute",
                        recordingListSortOrder: "oldest",
                        itemsPerPage: 25,
                        displayDensity: "compact",
                        theme: "dark",
                    }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);

        await expect(ensureDisplaySettingsLoaded()).rejects.toThrow(
            "Display settings unavailable",
        );

        expect(getDisplaySettingsStoreSnapshot()).toMatchObject({
            hasLoaded: false,
            isLoading: false,
            loadError: "Display settings unavailable",
        });

        await expect(ensureDisplaySettingsLoaded()).resolves.toMatchObject({
            uiLanguage: "en",
            theme: "dark",
        });

        expect(getDisplaySettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            loadError: null,
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
                    displayDensity: "comfy",
                    theme: "dark",
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
            displayDensity: "compact",
            uiLanguage: "en",
            itemsPerPage: 100,
        });

        expect(getDisplaySettingsStoreSnapshot()).toMatchObject({
            isSaving: true,
            settings: {
                uiLanguage: "en",
                displayDensity: "compact",
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
                displayDensity: "comfy",
                itemsPerPage: 50,
            },
        });
    });
});
