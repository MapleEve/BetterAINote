import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    DISPLAY_PREFERENCES_FALLBACK_THEME,
    DISPLAY_PREFERENCES_THEME_STORAGE_KEY,
    DisplayPreferencesProvider,
    synchronizeDisplayTheme,
} from "@/features/settings/components/display-preferences-provider";
import {
    __resetDisplaySettingsStoreForTests,
    ensureDisplaySettingsLoaded,
    getDisplaySettingsStoreSnapshot,
} from "@/features/settings/display-settings-store";

function renderThemeBootstrapScript() {
    const markup = renderToStaticMarkup(
        React.createElement(
            DisplayPreferencesProvider,
            {
                attribute: "data-theme",
                enableColorScheme: false,
                enableSystem: true,
            },
            React.createElement("main"),
        ),
    );
    const script = markup.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];

    if (!script) {
        throw new Error(
            "Display preferences provider did not render a theme script",
        );
    }

    return script;
}

function runThemeBootstrap(
    initialStorage: Record<string, string>,
    prefersDark = false,
) {
    const storage = new Map(Object.entries(initialStorage));
    const attributes = new Map<string, string>();

    runInNewContext(renderThemeBootstrapScript(), {
        document: {
            documentElement: {
                classList: {
                    add: () => {},
                    remove: () => {},
                },
                setAttribute: (name: string, value: string) => {
                    attributes.set(name, value);
                },
                style: {},
            },
        },
        localStorage: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => {
                storage.set(key, value);
            },
        },
        window: {
            matchMedia: () => ({ matches: prefersDark }),
        },
    });

    return {
        storage,
        theme: attributes.get("data-theme"),
    };
}

describe("display preferences provider", () => {
    beforeEach(() => {
        __resetDisplaySettingsStoreForTests();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        __resetDisplaySettingsStoreForTests();
    });

    it("uses the system preference on a first visit and ignores the legacy theme key", () => {
        expect(runThemeBootstrap({}).theme).toBe("light");

        const bootstrap = runThemeBootstrap({ theme: "dark" });

        expect(bootstrap.theme).toBe("light");
        expect(bootstrap.storage.get("theme")).toBe("dark");
        expect(
            bootstrap.storage.get(DISPLAY_PREFERENCES_THEME_STORAGE_KEY),
        ).toBeUndefined();
        expect(DISPLAY_PREFERENCES_FALLBACK_THEME).toBe("system");
    });

    it.each([
        ["light", "light"],
        ["dark", "dark"],
        ["system", "light"],
    ] as const)("uses the persisted %s display preference before remote settings resolve", (preference, expectedTheme) => {
        const bootstrap = runThemeBootstrap({
            [DISPLAY_PREFERENCES_THEME_STORAGE_KEY]: preference,
        });

        expect(bootstrap.theme).toBe(expectedTheme);
    });

    it("overrides the cached preference after remote display settings load", async () => {
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    uiLanguage: "zh-CN",
                    dateTimeFormat: "relative",
                    recordingListSortOrder: "newest",
                    itemsPerPage: 50,
                    displayDensity: "comfy",
                    theme: "light",
                }),
                {
                    headers: { "Content-Type": "application/json" },
                    status: 200,
                },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        expect(
            runThemeBootstrap({
                [DISPLAY_PREFERENCES_THEME_STORAGE_KEY]: "dark",
            }).theme,
        ).toBe("dark");

        await ensureDisplaySettingsLoaded();

        const snapshot = getDisplaySettingsStoreSnapshot();
        const persistedThemes = new Map([
            [DISPLAY_PREFERENCES_THEME_STORAGE_KEY, "dark"],
        ]);
        const setTheme = vi.fn((theme: string) => {
            persistedThemes.set(DISPLAY_PREFERENCES_THEME_STORAGE_KEY, theme);
        });

        synchronizeDisplayTheme(
            snapshot.hasLoaded,
            snapshot.settings.theme,
            setTheme,
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(setTheme).toHaveBeenCalledWith("light");
        expect(persistedThemes.get(DISPLAY_PREFERENCES_THEME_STORAGE_KEY)).toBe(
            "light",
        );
    });

    it("uses the safe system fallback when the display settings fetch rejects", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn<typeof fetch>()
                .mockRejectedValueOnce(
                    new Error("Display settings unavailable"),
                ),
        );

        await expect(ensureDisplaySettingsLoaded()).rejects.toThrow(
            "Display settings unavailable",
        );

        const snapshot = getDisplaySettingsStoreSnapshot();
        const setTheme = vi.fn();

        synchronizeDisplayTheme(
            snapshot.hasLoaded,
            snapshot.settings.theme,
            setTheme,
        );

        expect(snapshot.hasLoaded).toBe(false);
        expect(setTheme).not.toHaveBeenCalled();
        expect(runThemeBootstrap({ theme: "dark" }).theme).toBe("light");
    });

    it("preserves a last known display preference when the fetch rejects", async () => {
        vi.stubGlobal(
            "fetch",
            vi
                .fn<typeof fetch>()
                .mockRejectedValueOnce(
                    new Error("Display settings unavailable"),
                ),
        );

        await expect(ensureDisplaySettingsLoaded()).rejects.toThrow(
            "Display settings unavailable",
        );

        const bootstrap = runThemeBootstrap({
            [DISPLAY_PREFERENCES_THEME_STORAGE_KEY]: "dark",
            theme: "light",
        });

        expect(bootstrap.theme).toBe("dark");
    });
});
