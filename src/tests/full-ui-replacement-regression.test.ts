import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(process.cwd(), "src");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("full UI replacement regression coverage", () => {
    it("keeps global tokens on the graphite glass system instead of the old warm chrome", () => {
        const globals = readSource("app/globals.css");

        expect(globals).toContain("--graphite-100");
        expect(globals).toContain("--steel-500");
        expect(globals).toContain("BetterAINote Graphite Glass design system");
        expect(globals).toContain("Graphite Glass compatibility utilities");
        expect(globals).not.toContain("Hardware Design System");
        expect(globals).not.toContain("Graphite, Paper, Brass");
        expect(globals).not.toContain("warm beige");
    });

    it("keeps auth and onboarding on shared graphite primitives without product MetalButton usage", () => {
        const login = readSource("features/auth/components/login-form.tsx");
        const register = readSource(
            "features/auth/components/register-form.tsx",
        );
        const onboarding = readSource(
            "features/onboarding/components/onboarding-form.tsx",
        );
        const authLayout = readSource("app/(auth)/layout.tsx");
        const onboardingPage = readSource("app/(app)/onboarding/page.tsx");

        for (const source of [login, register, onboarding]) {
            expect(source).toContain("@/components/ui/button");
            expect(source).toContain("@/components/ui/card");
            expect(source).not.toContain("@/components/metal-button");
            expect(source).not.toContain('variant="cyan"');
            expect(source).not.toContain("text-accent-cyan");
        }

        expect(authLayout).toContain("dashboard-workstation");
        expect(onboardingPage).toContain("dashboard-workstation");
        expect(onboarding).toContain("data-onboarding-surface");
        expect(onboarding).toContain("glass-nav-item");
    });

    it("bridges dashboard provider rows to data-source configuration states", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const rows = readSource(
            "features/dashboard/components/source-provider-rows.tsx",
        );

        expect(workstation).toContain("useDataSourcesSettings(language)");
        expect(workstation).toContain("getDashboardSourceStatus");
        expect(workstation).toContain("connected-empty");
        expect(workstation).toContain("sync-error");
        expect(workstation).not.toContain("connected: count > 0");
        expect(rows).toContain("data-source-status");
        expect(rows).toContain('"paused"');
        expect(rows).toContain('"needs-setup"');
        expect(rows).toContain('"planned"');
    });

    it("keeps search overlay keyboard activation and active result state wired", () => {
        const search = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        expect(search).toContain("handleInputKeyDown");
        expect(search).toContain('event.key === "ArrowDown"');
        expect(search).toContain('event.key === "ArrowUp"');
        expect(search).toContain('event.key === "Enter"');
        expect(search).toContain("aria-activedescendant");
        expect(search).toContain("data-active");
        expect(search).toContain("getTargetRecordingId");
    });

    it("keeps source detail public-field filtered before rendering nested values", () => {
        const sourceReport = readSource(
            "features/recordings/components/source-report-panel.tsx",
        );

        expect(sourceReport).toContain("SAFE_SOURCE_DETAIL_KEYS");
        expect(sourceReport).toContain("SENSITIVE_SOURCE_DETAIL_FIELD_PATTERN");
        expect(sourceReport).toContain("isSafeSourceDetailField");
        expect(sourceReport).toContain(
            ".filter(([key]) => isSafeSourceDetailField(key))",
        );
        expect(sourceReport).not.toContain("JSON.stringify(data.detail");
    });

    it("keeps AI rename as a preview/apply flow instead of direct apply only", () => {
        const route = readSource(
            "app/api/recordings/[id]/rename/auto/route.ts",
        );
        const sharedCard = readSource(
            "features/recordings/components/ai-rename-preview-card.tsx",
        );
        const dashboard = readSource("features/dashboard/workstation.tsx");
        const detail = readSource("features/recordings/workstation.tsx");

        expect(route).toContain("readAutoRenameMode");
        expect(route).toContain('body?.mode === "preview"');
        expect(sharedCard).toContain("data-ai-rename-preview");

        for (const source of [dashboard, detail]) {
            expect(source).toContain("autoRenamePreview");
            expect(source).toContain("handleAutoRenamePreviewApply");
            expect(source).toContain("AiRenamePreviewCard");
            expect(source).toContain('JSON.stringify({ mode: "preview" })');
        }
    });
});
