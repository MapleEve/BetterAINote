import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    __resetSyncSettingsStoreForTests,
    ensureSyncSettingsLoaded,
    getSyncSettingsStoreSnapshot,
    saveSyncSettings,
} from "@/features/settings/sync-settings-store";

describe("sync settings store", () => {
    beforeEach(() => {
        __resetSyncSettingsStoreForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        __resetSyncSettingsStoreForTests();
    });

    it("loads sync settings once and normalizes legacy millisecond payloads", async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    autoSyncEnabled: false,
                    syncInterval: 125000,
                }),
                {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        const firstLoad = ensureSyncSettingsLoaded();
        const secondLoad = ensureSyncSettingsLoaded();

        expect(firstLoad).toBe(secondLoad);

        await expect(firstLoad).resolves.toEqual({
            autoSyncEnabled: false,
            syncIntervalSeconds: 125,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(getSyncSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            settings: {
                autoSyncEnabled: false,
                syncIntervalSeconds: 125,
            },
        });
    });

    it("rolls back optimistic sync updates when saving fails", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        autoSyncEnabled: true,
                        syncIntervalSeconds: 300,
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
                        error: "Failed to update sync settings",
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);

        await ensureSyncSettingsLoaded();

        const savePromise = saveSyncSettings({
            autoSyncEnabled: false,
            syncIntervalSeconds: 120,
        });

        expect(getSyncSettingsStoreSnapshot()).toMatchObject({
            isSaving: true,
            settings: {
                autoSyncEnabled: false,
                syncIntervalSeconds: 120,
            },
        });

        await expect(savePromise).rejects.toThrow(
            "Failed to update sync settings",
        );

        expect(getSyncSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isSaving: false,
            settings: {
                autoSyncEnabled: true,
                syncIntervalSeconds: 300,
            },
        });
    });

    it("treats the store as loaded after a successful save following a failed initial load", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        error: "Failed to fetch sync settings",
                    }),
                    {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            )
            .mockResolvedValueOnce(new Response(null, { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await expect(ensureSyncSettingsLoaded()).rejects.toThrow(
            "Failed to fetch sync settings",
        );

        expect(getSyncSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: false,
            isLoading: false,
            isSaving: false,
            settings: {
                autoSyncEnabled: true,
                syncIntervalSeconds: 300,
            },
        });

        await expect(
            saveSyncSettings({
                autoSyncEnabled: false,
            }),
        ).resolves.toBeUndefined();

        expect(getSyncSettingsStoreSnapshot()).toMatchObject({
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            settings: {
                autoSyncEnabled: false,
                syncIntervalSeconds: 300,
            },
        });

        await expect(ensureSyncSettingsLoaded()).resolves.toEqual({
            autoSyncEnabled: false,
            syncIntervalSeconds: 300,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
