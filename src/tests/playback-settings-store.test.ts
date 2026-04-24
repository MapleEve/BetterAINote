import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    __resetPlaybackSettingsStoreForTests,
    ensurePlaybackSettingsLoaded,
    getPlaybackSettingsStoreSnapshot,
    savePlaybackSettings,
} from "@/features/settings/playback-settings-store";

describe("playback settings store", () => {
    beforeEach(() => {
        __resetPlaybackSettingsStoreForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        __resetPlaybackSettingsStoreForTests();
    });

    it("loads playback settings once and shares the loaded snapshot", async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    defaultPlaybackSpeed: 1.25,
                    defaultVolume: 55,
                    autoPlayNext: true,
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        const firstLoad = ensurePlaybackSettingsLoaded();
        const secondLoad = ensurePlaybackSettingsLoaded();

        expect(firstLoad).toBe(secondLoad);

        await expect(firstLoad).resolves.toEqual({
            defaultPlaybackSpeed: 1.25,
            defaultVolume: 55,
            autoPlayNext: true,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(getPlaybackSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            settings: {
                defaultPlaybackSpeed: 1.25,
                defaultVolume: 55,
                autoPlayNext: true,
            },
        });
    });

    it("rolls back optimistic playback updates when saving fails", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        defaultPlaybackSpeed: 1.0,
                        defaultVolume: 75,
                        autoPlayNext: false,
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
                        error: "Failed to update playback settings",
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);

        await ensurePlaybackSettingsLoaded();

        const savePromise = savePlaybackSettings({
            defaultPlaybackSpeed: 1.5,
            autoPlayNext: true,
        });

        expect(getPlaybackSettingsStoreSnapshot()).toMatchObject({
            isSaving: true,
            settings: {
                defaultPlaybackSpeed: 1.5,
                defaultVolume: 75,
                autoPlayNext: true,
            },
        });

        await expect(savePromise).rejects.toThrow(
            "Failed to update playback settings",
        );

        expect(getPlaybackSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isSaving: false,
            settings: {
                defaultPlaybackSpeed: 1.0,
                defaultVolume: 75,
                autoPlayNext: false,
            },
        });
    });

    it("treats the store as loaded after a successful save following a failed initial load", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        error: "Failed to fetch playback settings",
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            )
            .mockResolvedValueOnce(new Response(null, { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(ensurePlaybackSettingsLoaded()).rejects.toThrow(
            "Failed to fetch playback settings",
        );

        expect(getPlaybackSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: false,
            isLoading: false,
            isSaving: false,
            settings: {
                defaultPlaybackSpeed: 1.0,
                defaultVolume: 75,
                autoPlayNext: false,
            },
        });

        await expect(
            savePlaybackSettings({
                defaultPlaybackSpeed: 1.5,
            }),
        ).resolves.toBeUndefined();

        expect(getPlaybackSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            settings: {
                defaultPlaybackSpeed: 1.5,
                defaultVolume: 75,
                autoPlayNext: false,
            },
        });

        await expect(ensurePlaybackSettingsLoaded()).resolves.toEqual({
            defaultPlaybackSpeed: 1.5,
            defaultVolume: 75,
            autoPlayNext: false,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
