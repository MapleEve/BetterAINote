"use client";

import { useTheme } from "next-themes";
import type * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { UI_LANGUAGE_STORAGE_KEY, type UiLanguage } from "@/lib/i18n";
import {
    writeBrowserDocumentLanguage,
    writeBrowserStorage,
} from "@/lib/platform/browser-shell";
import { useDisplaySettingsStore } from "../display-settings-store";

function DisplayThemeSync() {
    const { setTheme } = useTheme();
    const {
        settings: { theme },
    } = useDisplaySettingsStore();

    useEffect(() => {
        setTheme(theme);
    }, [setTheme, theme]);

    return null;
}

function DisplayLanguageSync({ children }: { children: React.ReactNode }) {
    const [hasHydrated, setHasHydrated] = useState(false);
    const {
        settings: { uiLanguage },
        hasLoaded,
        updateDisplaySettings,
    } = useDisplaySettingsStore();

    useEffect(() => {
        setHasHydrated(true);
    }, []);

    useEffect(() => {
        if (!hasLoaded) {
            return;
        }

        writeBrowserStorage(UI_LANGUAGE_STORAGE_KEY, uiLanguage);
        writeBrowserDocumentLanguage(uiLanguage);
    }, [hasLoaded, uiLanguage]);

    const handleLanguageChange = useCallback(
        (nextLanguage: UiLanguage) => {
            void updateDisplaySettings({ uiLanguage: nextLanguage }).catch(
                () => {},
            );
        },
        [updateDisplaySettings],
    );

    return (
        <LanguageProvider
            language={hasHydrated ? uiLanguage : "zh-CN"}
            onLanguageChange={handleLanguageChange}
        >
            {children}
        </LanguageProvider>
    );
}

export function DisplayPreferencesProvider({
    children,
    ...themeProps
}: React.ComponentProps<typeof ThemeProvider>) {
    return (
        <ThemeProvider {...themeProps}>
            <DisplayThemeSync />
            <DisplayLanguageSync>{children}</DisplayLanguageSync>
        </ThemeProvider>
    );
}
