"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDisplaySettingsStore } from "../display-settings-store";

export function AppThemeToggle() {
    const [mounted, setMounted] = useState(false);
    const [saveError, setSaveError] = useState(false);
    const { resolvedTheme } = useTheme();
    const { ensureDisplaySettingsLoaded, isSaving, updateDisplaySettings } =
        useDisplaySettingsStore();
    const isDark = mounted && resolvedTheme === "dark";

    useEffect(() => {
        setMounted(true);
    }, []);

    const toggleTheme = async () => {
        setSaveError(false);

        try {
            const settings = await ensureDisplaySettingsLoaded();
            const currentTheme =
                settings.theme === "system" ? resolvedTheme : settings.theme;
            const nextTheme = currentTheme === "dark" ? "light" : "dark";

            await updateDisplaySettings({ theme: nextTheme });
        } catch {
            // The store rolls an optimistic save back; leave next-themes under its store sync.
            setSaveError(true);
        }
    };

    return (
        <Button
            aria-label={isDark ? "切换到浅色主题" : "切换到深色主题"}
            aria-pressed={isDark}
            aria-invalid={saveError || undefined}
            data-control="app-theme-toggle"
            data-state={
                isSaving
                    ? "saving"
                    : saveError
                      ? "error"
                      : isDark
                        ? "dark"
                        : "light"
            }
            disabled={!mounted || isSaving}
            onClick={() => void toggleTheme()}
            size="icon"
            title={isDark ? "切换到浅色主题" : "切换到深色主题"}
            variant="ghost"
        >
            {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
    );
}
