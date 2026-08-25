import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(import.meta.dirname, "..");

function readSource(path: string) {
    return readFileSync(resolve(sourceRoot, path), "utf8");
}

describe("app route shell", () => {
    it("uses Radix dialog, semantic navigation, and token-driven responsive classes", () => {
        const shell = readSource("components/app-route-shell.tsx");

        expect(shell).toContain(
            'import * as Dialog from "@radix-ui/react-dialog";',
        );
        expect(shell).toContain('aria-label="主导航"');
        expect(shell).toContain('aria-current={active ? "page" : undefined}');
        expect(shell).toContain(
            '"min-h-svh bg-background text-foreground lg:grid"',
        );
        expect(shell).toContain("hidden min-h-svh flex-col");
        expect(shell).toContain("lg:flex");
        expect(shell).toContain('className="lg:hidden"');
        expect(shell).toContain("<Dialog.Trigger asChild>");
        expect(shell).toContain('data-control="app-mobile-navigation-sheet"');
        expect(shell).not.toContain("onCloseAutoFocus");
        expect(shell).not.toContain("document.querySelector");
        expect(shell).not.toContain("@/features/");
        expect(shell).not.toMatch(/data-sot|\bsot\b/i);
        expect(shell).not.toMatch(/style=/i);
        expect(shell).not.toContain("<style");
    });

    it("injects the feature-owned theme action from the app boundary", () => {
        const layout = readSource("app/(app)/layout.tsx");

        expect(layout).toContain('"use client"');
        expect(layout).toContain(
            'import { AppThemeToggle } from "@/features/settings/components/app-theme-toggle";',
        );
        expect(layout).toContain("ThemeAction={AppThemeToggle}");
    });

    it("waits for the display store before saving a theme and leaves failure rollback to that store", () => {
        const themeToggle = readSource(
            "features/settings/components/app-theme-toggle.tsx",
        );

        expect(themeToggle).toContain("useDisplaySettingsStore");
        expect(themeToggle).toContain("await ensureDisplaySettingsLoaded()");
        expect(themeToggle).toContain(
            "await updateDisplaySettings({ theme: nextTheme })",
        );
        expect(themeToggle).toContain("disabled={!mounted || isSaving}");
        expect(themeToggle).not.toContain("disabled={!mounted || isLoading");
        expect(themeToggle).not.toContain("setTheme(nextTheme)");
        expect(themeToggle).toContain("setSaveError(true)");
        expect(themeToggle).toContain('data-control="app-theme-toggle"');
        expect(themeToggle).not.toContain("ThemeProvider");
        expect(themeToggle).not.toMatch(/data-sot|\bsot\b/i);
    });

    it("keeps the real-browser shell coverage isolated and free of request interception", () => {
        const e2e = readSource("../e2e/app-route-shell-navigation.spec.ts");

        expect(e2e).toContain('page.on("request", onRequest)');
        expect(e2e).toContain('events.push("theme click")');
        expect(e2e).toContain("await writePersistedTheme(page, originalTheme)");
        expect(e2e).toContain('sheet.locator(":focus")');
        expect(e2e).toContain('page.keyboard.press("Tab")');
        expect(e2e).not.toMatch(
            /\.route\(|\.fulfill\(|addInitScript|page\.evaluate|\.skip\(|\.only\(|force:\s*true/,
        );
        expect(e2e).not.toMatch(/data-sot|\bsot\b/i);
        expect(e2e).not.toMatch(/style=/i);
    });
});
