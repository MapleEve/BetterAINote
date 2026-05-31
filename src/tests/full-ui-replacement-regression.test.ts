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
        const rootLayout = readSource("app/layout.tsx");
        const appLayout = readSource("app/(app)/layout.tsx");

        expect(globals).toContain("--graphite-100");
        expect(globals).toContain("--steel-500");
        expect(globals).toContain("BetterAINote Graphite Glass design system");
        expect(globals).toContain("--page-background");
        expect(globals).not.toContain("Hardware Design System");
        expect(globals).not.toContain("Graphite, Paper, Brass");
        expect(globals).not.toContain("warm beige");
        for (const forbidden of [
            "--rack-background",
            "--accent-purple",
            "--accent-cyan",
            "--metal-base",
            "--warm-beige",
            "--neomorph-raised",
            "--glow-cyan",
            ".rack-container",
            ".knob",
            ".record-button",
            ".info-card",
            ".circular-progress",
            ".rack-module",
            ".settings-panel",
            ".settings-backdrop",
            ".xy-pad",
            ".cassette-indicator",
            ".tape-deck",
        ]) {
            expect(globals).not.toContain(forbidden);
        }
        expect(rootLayout).not.toContain("next/font");
        expect(rootLayout).toContain("<Toaster />");
        expect(appLayout).not.toContain("<Footer");
        expect(appLayout).not.toContain("<Toaster");
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

        expect(login).toContain("data-auth-form-state");
        expect(login).toContain("aria-busy={isLoading}");
        expect(register).toContain("data-auth-form-state");
        expect(register).toContain("aria-busy={isLoading}");
        expect(authLayout).toContain("dashboard-workstation");
        expect(onboardingPage).toContain("dashboard-workstation");
        expect(onboarding).toContain("data-onboarding-surface");
        expect(onboarding).toContain("glass-nav-item");
        expect(onboarding).toContain("PROVIDER_ICONS");
        expect(onboarding).not.toContain("item.label.slice(0, 1)");
    });

    it("bridges dashboard provider rows to data-source configuration states", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const rows = readSource(
            "features/dashboard/components/source-provider-rows.tsx",
        );
        const translations = readSource("lib/i18n.ts");

        expect(workstation).toContain("useDataSourcesSettings(language)");
        expect(workstation).toContain("getDashboardSourceStatus");
        expect(workstation).toContain("connected-empty");
        expect(workstation).toContain("favoriteScopedProviderCounts");
        expect(workstation).toContain("sync-error");
        expect(workstation).toContain('"expired"');
        expect(workstation).toContain("connectionStatus");
        expect(workstation).toContain(
            "SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY",
        );
        expect(workstation).toContain("no-results");
        expect(workstation).toContain("<SourceFilterStackStrip");
        expect(workstation).not.toContain("connected: count > 0");
        expect(rows).toContain("data-source-status");
        expect(rows).toContain("PROVIDER_ICONS");
        expect(rows).not.toContain("PROVIDER_MARKS");
        expect(rows).toContain('"paused"');
        expect(rows).toContain('"needs-setup"');
        expect(rows).toContain('"expired"');
        expect(rows).toContain('"planned"');
        expect(rows).toContain('"no-results"');
        expect(rows).toContain("PROVIDER_ASSET_CLASSES");
        expect(rows).toContain("/assets/sources/dingtalk.svg");
        expect(rows).toContain("@/components/ui/button");
        expect(rows).toContain("sourceProviderRows.status.syncError");
        expect(rows).toContain("sourceProviderRows.badge.connect");
        expect(rows).not.toContain("同步异常");
        expect(rows).not.toContain("待开放");
        expect(rows).not.toContain("需要重新登录");
        expect(translations).toContain("同步异常");
        expect(translations).toContain("Re-auth required");
    });

    it("keeps the stacked source filter strip wired to real dashboard actions", () => {
        const strip = readSource(
            "features/dashboard/components/source-filter-stack-strip.tsx",
        );
        const workstation = readSource("features/dashboard/workstation.tsx");
        const recordingList = readSource(
            "features/dashboard/components/recording-list.tsx",
        );
        const translations = readSource("lib/i18n.ts");

        expect(strip).toContain('data-testid="dashboard-source-filter-stack"');
        expect(strip).toContain('state === "sync-error"');
        expect(strip).toContain('state === "no-results"');
        expect(strip).toContain('state === "needs-setup"');
        expect(strip).toContain('status === "expired"');
        expect(strip).toContain("onClearSource");
        expect(strip).toContain("onClearAll");
        expect(strip).toContain("onRetrySync");
        expect(strip).toContain("onWidenFilters");
        expect(strip).toContain("onOpenDataSourcesSettings");
        expect(strip).toContain("@/components/ui/button");
        expect(strip).toContain("sourceFilterStack.clearSourceFilter");
        expect(strip).toContain("sourceFilterStack.noResultsMessage");
        expect(strip).not.toContain("放宽筛选");
        expect(strip).not.toContain("前往设置");
        expect(translations).toContain("放宽筛选");
        expect(translations).toContain("Open settings");
        expect(workstation).toContain('writeBrowserHash("data-sources")');
        expect(workstation).toContain("dashboardFavorites.allRecordings");
        expect(recordingList).toContain("filterStack?");
        expect(recordingList).toContain('"loading"');
        expect(recordingList).toContain('"no-match"');
        expect(recordingList).toContain('"timeline-empty"');
        expect(recordingList).toContain('"tag-empty"');
        expect(workstation).toContain("handleClearDashboardFilters");
        expect(workstation).toContain("handleOpenDataSourcesSettings");
        expect(workstation).toContain("writeBrowserStorage");
    });

    it("keeps dashboard responsive drawer and desktop collapse controls wired", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const globals = readSource("app/globals.css");

        expect(workstation).toContain("isSourceDrawerOpen");
        expect(workstation).toContain("setSourceDrawerOpen(false)");
        expect(workstation).toContain("dashboard-source-drawer-trigger");
        expect(workstation).toContain("dashboard-source-drawer-scrim");
        expect(workstation).toContain("dashboard-sidebar-collapse-trigger");
        expect(workstation).toContain("PanelLeftClose");
        expect(workstation).toContain("PanelLeftOpen");
        expect(workstation).toContain("data-source-drawer");
        expect(workstation).toContain("data-sidebar-collapsed");
        expect(globals).toContain(
            '.dashboard-workstation-grid[data-sidebar-collapsed="true"]',
        );
    });

    it("keeps search overlay keyboard activation and active result state wired", () => {
        const search = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        expect(search).toContain("handleInputKeyDown");
        expect(search).toContain('event.key === "ArrowDown"');
        expect(search).toContain('event.key === "ArrowUp"');
        expect(search).toContain('event.key === "Enter"');
        expect(search).toContain('role="combobox"');
        expect(search).toContain('role="listbox"');
        expect(search).toContain("aria-activedescendant");
        expect(search).toContain("scrollIntoView");
        expect(search).toContain("data-active");
        expect(search).toContain("getTargetRecordingId");
        expect(search).toContain("handleRetrySearch");
        expect(search).toContain("data-ls-retry");
    });

    it("keeps dashboard transcript hints on graphite tokens instead of source-blue panels", () => {
        const transcriptionPanel = readSource(
            "features/dashboard/components/transcription-panel.tsx",
        );

        expect(transcriptionPanel).toContain(
            'data-testid="dashboard-local-transcript-hint"',
        );
        expect(transcriptionPanel).toContain("border-primary/20");
        expect(transcriptionPanel).toContain("bg-primary/8");
        expect(transcriptionPanel).not.toContain("border-blue-");
        expect(transcriptionPanel).not.toContain("bg-blue-");
        expect(transcriptionPanel).not.toContain("text-blue-");
        expect(transcriptionPanel).not.toContain("dark:border-blue");
        expect(transcriptionPanel).not.toContain("dark:bg-blue");
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
        expect(sourceReport).toContain("detailEntries.length > 0");
        expect(sourceReport).toContain("startedAt");
        expect(sourceReport).toContain("endedAt");
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
        expect(sharedCard).toContain('data-testid="ai-rename-apply"');
        expect(sharedCard).toContain('data-testid="ai-rename-cancel"');
        expect(sharedCard).toContain('data-testid="ai-rename-regenerate"');
        expect(sharedCard).toContain("ai-rename-card-action");
        expect(sharedCard).toContain('"accepted"');

        expect(dashboard).toContain("handleOpenTitleGenerationSettings");
        expect(detail).toContain("actionHref={");
        expect(detail).toContain("/settings#title-generation");

        for (const source of [dashboard, detail]) {
            expect(source).toContain("autoRenamePreview");
            expect(source).toContain("handleAutoRenamePreviewApply");
            expect(source).toContain("AiRenamePreviewCard");
            expect(source).toContain('JSON.stringify({ mode: "preview" })');
            expect(source).toContain("aiRenameLocalOnlyHint");
            expect(source).toContain("aiRenameWritebackHint");
            expect(source).toContain("aiRenameOpenSettings");
            expect(source).toContain("autoRenameError");
            expect(source).toContain('state="loading"');
            expect(source).toContain('state="review"');
            expect(source).toContain('state="accepted"');
            expect(source).toContain('state="error"');
            expect(source).toContain('state="unavailable"');
            expect(source).toContain("aiRenameAccepted");
        }
    });

    it("keeps system banners and source logo assets in the React surface", () => {
        const systemBanner = readSource(
            "features/dashboard/components/system-banner.tsx",
        );
        const dashboard = readSource("features/dashboard/workstation.tsx");
        const detail = readSource("features/recordings/workstation.tsx");

        for (const state of [
            "offline",
            "permission-denied",
            "db-locked",
            "update-available",
            "import-progress",
            "export-progress",
        ]) {
            expect(systemBanner).toContain(state);
        }

        expect(systemBanner).toContain("data-system-banner-state");
        expect(systemBanner).toContain("betterainote:system-banner");
        expect(dashboard).toContain("<SystemBanner");
        expect(detail).toContain("<SystemBanner");
    });
});
