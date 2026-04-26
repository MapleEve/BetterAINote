"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import type * as React from "react";
import { useEffect } from "react";
import { useDisplaySettingsStore } from "@/features/settings/display-settings-store";

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

export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    return (
        <NextThemesProvider {...props}>
            <DisplayThemeSync />
            {children}
        </NextThemesProvider>
    );
}
