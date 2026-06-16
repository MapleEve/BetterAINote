"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { DEFAULT_UI_LANGUAGE, translate, type UiLanguage } from "@/lib/i18n";

interface LanguageContextValue {
    language: UiLanguage;
    setLanguage: (language: UiLanguage) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
}

const fallbackLanguageValue: LanguageContextValue = {
    language: DEFAULT_UI_LANGUAGE,
    setLanguage: () => {},
    t: (key, replacements) => translate(DEFAULT_UI_LANGUAGE, key, replacements),
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
    children,
    language = DEFAULT_UI_LANGUAGE,
    onLanguageChange,
}: {
    children: React.ReactNode;
    language?: UiLanguage;
    onLanguageChange?: (language: UiLanguage) => void;
}) {
    const setLanguage = useCallback(
        (nextLanguage: UiLanguage) => onLanguageChange?.(nextLanguage),
        [onLanguageChange],
    );
    const value = useMemo<LanguageContextValue>(
        () => ({
            language,
            setLanguage,
            t: (key, replacements) => translate(language, key, replacements),
        }),
        [language, setLanguage],
    );

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext) ?? fallbackLanguageValue;
}
