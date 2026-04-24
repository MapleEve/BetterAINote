"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
} from "react";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";
import {
    translate,
    UI_LANGUAGE_STORAGE_KEY,
    type UiLanguage,
} from "@/lib/i18n";
import {
    writeBrowserDocumentLanguage,
    writeBrowserStorage,
} from "@/lib/platform/browser-shell";

interface LanguageContextValue {
    language: UiLanguage;
    setLanguage: (language: UiLanguage) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function useSharedLanguageValue(): LanguageContextValue {
    const {
        settings: { uiLanguage },
        hasLoaded,
        updateDisplaySettings,
    } = useDisplaySettingsStore();

    useEffect(() => {
        if (!hasLoaded) {
            return;
        }

        writeBrowserStorage(UI_LANGUAGE_STORAGE_KEY, uiLanguage);
        writeBrowserDocumentLanguage(uiLanguage);
    }, [hasLoaded, uiLanguage]);

    const setLanguage = useCallback(
        (nextLanguage: UiLanguage) => {
            void updateDisplaySettings({ uiLanguage: nextLanguage }).catch(
                () => {},
            );
        },
        [updateDisplaySettings],
    );

    return useMemo<LanguageContextValue>(
        () => ({
            language: uiLanguage,
            setLanguage,
            t: (key, replacements) => translate(uiLanguage, key, replacements),
        }),
        [setLanguage, uiLanguage],
    );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const value = useSharedLanguageValue();

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    const sharedValue = useSharedLanguageValue();
    return context ?? sharedValue;
}
