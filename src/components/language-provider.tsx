"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { translate, type UiLanguage } from "@/lib/i18n";

interface LanguageContextValue {
    language: UiLanguage;
    setLanguage: (language: UiLanguage) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const fallbackLanguageValue: LanguageContextValue = {
    language: "zh-CN",
    setLanguage: () => {},
    t: (key, replacements) => translate("zh-CN", key, replacements),
};

export function LanguageProvider({
    children,
    language = "zh-CN",
    onLanguageChange,
}: {
    children: React.ReactNode;
    language?: UiLanguage;
    onLanguageChange?: (language: UiLanguage) => void;
}) {
    const setLanguage = useCallback(
        (nextLanguage: UiLanguage) => {
            onLanguageChange?.(nextLanguage);
        },
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
    const context = useContext(LanguageContext);
    return context ?? fallbackLanguageValue;
}
