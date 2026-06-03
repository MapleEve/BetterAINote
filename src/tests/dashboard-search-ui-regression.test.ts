import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function sourceAround(source: string, marker: string, radius = 500) {
    const markerIndex = source.indexOf(marker);

    expect(markerIndex).toBeGreaterThanOrEqual(0);

    return source.slice(
        Math.max(0, markerIndex - radius),
        markerIndex + marker.length + radius,
    );
}

describe("dashboard search and activity overlay regression", () => {
    it("exposes a dashboard search entrypoint for the four library scopes", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );
        const translations = readSource("lib/i18n.ts");

        expect(workstation).toContain("<LibrarySearch");
        expect(searchComponent).toContain("/api/search");
        expect(searchComponent).toContain('method: "GET"');
        expect(searchComponent).toContain('cache: "no-store"');
        expect(searchComponent).toContain('limit: "12"');
        expect(searchComponent).toContain('"recording"');
        expect(searchComponent).toContain('"transcript"');
        expect(searchComponent).toContain('"speaker"');
        expect(searchComponent).toContain('"tag"');
        expect(searchComponent).toContain("setTimeout(() =>");
        expect(searchComponent).toContain("}, 250);");
        expect(searchComponent).toContain("useLanguage");
        expect(searchComponent).toContain("librarySearch.placeholder");
        expect(searchComponent).not.toContain("搜索录音、逐字稿、说话人、标签");
        expect(translations).toContain("搜索录音、逐字稿、说话人、标签");
        expect(translations).toContain(
            "Search recordings, transcripts, speakers, tags",
        );
    });

    it("keeps search as a controlled topbar overlay with focus-safe close paths", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        const syncActionIndex = workstation.indexOf("onClick={handleSync}");
        const searchIndex = workstation.indexOf("<LibrarySearch\n");
        const activityIndex = workstation.indexOf("<ActivityOverlay");
        const settingsIndex = workstation.indexOf(
            'data-testid="dashboard-settings-trigger"',
        );

        expect(syncActionIndex).toBeGreaterThan(-1);
        expect(searchIndex).toBeGreaterThan(syncActionIndex);
        expect(searchIndex).toBeLessThan(activityIndex);
        expect(activityIndex).toBeLessThan(settingsIndex);
        expect(workstation).toContain('activeTopbarOverlay === "search"');
        expect(workstation).toContain("onOpenChange={setSearchOverlayOpen}");

        expect(searchComponent).toContain("open: boolean");
        expect(searchComponent).toContain(
            "onOpenChange: (open: boolean) => void",
        );
        expect(searchComponent).toContain("ref={inputRef}");
        expect(searchComponent).toContain("inputRef.current?.focus");
        expect(searchComponent).toContain("triggerRef.current?.focus");
        expect(searchComponent).toContain(
            'document.addEventListener("pointerdown"',
        );
        expect(searchComponent).toContain(
            'document.addEventListener("keydown"',
        );
        expect(searchComponent).toContain('event.key === "Escape"');
        expect(searchComponent).toContain("closeAndReturnFocus();");
        expect(searchComponent).toContain(
            "closeAndReturnFocus({ returnFocus: false });",
        );
        expect(searchComponent).toContain(
            "onOpenRecording(targetRecordingId);",
        );
    });

    it("keeps search no-query, loading, results, empty, and error states explicit", () => {
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        expect(searchComponent).toContain('"no-query"');
        expect(searchComponent).toContain('"loading"');
        expect(searchComponent).toContain('"results"');
        expect(searchComponent).toContain('"no-results"');
        expect(searchComponent).toContain('"error"');
        expect(searchComponent).toContain(
            'data-testid="library-search-no-query"',
        );
        expect(searchComponent).toContain(
            'data-testid="library-search-loading"',
        );
        expect(searchComponent).toContain(
            'data-testid="library-search-results"',
        );
        expect(searchComponent).toContain(
            'data-testid="library-search-no-results"',
        );
        expect(searchComponent).toContain('data-testid="library-search-error"');
        expect(searchComponent).toContain("handleRetrySearch");
        expect(searchComponent).toContain("data-ls-retry");
        expect(searchComponent).toContain("retryCount");
        expect(searchComponent).toContain('setQuery("")');
    });

    it("keeps search results grouped, highlighted, and filter-capable for global speaker/tag hits", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        expect(searchComponent).toContain("SEARCH_RESULT_GROUPS");
        expect(searchComponent).toContain("displayResults");
        expect(searchComponent).toContain("activeResultIndex");
        expect(searchComponent).toContain("scrollIntoView");
        expect(searchComponent).toContain(
            'data-testid="library-search-scroll-region"',
        );
        expect(searchComponent).toContain('role="combobox"');
        expect(searchComponent).toContain('role="listbox"');
        expect(searchComponent).toContain("aria-autocomplete");
        expect(searchComponent).toContain("renderHighlightedText");
        expect(searchComponent).toContain(
            'data-testid="library-search-highlight"',
        );
        expect(searchComponent).toContain("interface LibrarySearchFilter");
        expect(searchComponent).toContain("onApplyLibraryFilter");
        expect(searchComponent).toContain("data-result-mode=");
        expect(searchComponent).toContain('"filter"');
        expect(searchComponent).toContain('"inert"');
        expect(searchComponent).toContain("library-search-group-");
        expect(searchComponent).toContain("group.value");

        expect(workstation).toContain("librarySearchFilter");
        expect(workstation).toContain("librarySearchFilterLabel");
        expect(workstation).toContain("recordingMatchesLibrarySearchFilter");
        expect(workstation).toContain(
            'data-testid="dashboard-library-search-filter"',
        );
        expect(workstation).toContain("data-library-search-filter");
        expect(workstation).toContain("onApplyLibraryFilter={");
    });

    it("keeps library search chrome on shared muted and accent surfaces", () => {
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );
        const triggerSurface = sourceAround(
            searchComponent,
            'data-testid="library-search-trigger"',
        );
        const scopeSurface = sourceAround(
            searchComponent,
            "data-active={scope === item.value}",
            700,
        );
        const resultsGroupSurface = sourceAround(
            searchComponent,
            ["data-testid={`library-search-group-", "{group.value}`}"].join(
                "$",
            ),
        );

        expect(searchComponent).not.toContain("bg-background/35");
        expect(searchComponent).not.toContain("bg-background/45");
        expect(searchComponent).not.toContain("hover:bg-background/80");

        expect(triggerSurface).toContain('variant="outline"');
        expect(triggerSurface).toContain('className="h-9 w-9 rounded-xl"');
        expect(scopeSurface).toContain("hover:bg-accent/45");
        expect(scopeSurface).toContain("data-[active=true]:bg-muted/35");
        expect(scopeSurface).toContain("setActiveResultIndex(0);");
        expect(scopeSurface).toContain("focusSearchInput();");
        expect(resultsGroupSurface).toContain("bg-muted/35");
        expect(resultsGroupSurface).toContain("shadow-xs");
    });

    it("derives the activity overlay from existing workstation update and transcription state", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const activityOverlay = readSource(
            "features/dashboard/components/activity-overlay.tsx",
        );

        expect(workstation).toContain("<ActivityOverlay");
        expect(workstation).toContain("useAutoSync");
        expect(workstation).toContain("lastSyncResult={lastSyncResult}");
        expect(workstation).toContain("workerStatus={workerStatus}");
        expect(workstation).toContain(
            "transcriptionJobs={liveTranscriptionJobs}",
        );
        expect(workstation).toContain("onSyncNow={handleSync}");
        expect(workstation).toContain("onOpenDataSourcesSettings={() =>");
        expect(workstation).toContain("handleOpenDataSourcesSettings()");

        expect(activityOverlay).toContain("lastSyncResult");
        expect(activityOverlay).toContain("workerStatus");
        expect(activityOverlay).toContain("transcriptionJobs");
        expect(activityOverlay).toContain('"sync" | "recording" | "settings"');
        expect(activityOverlay).toContain("onOpenDataSourcesSettings");
        expect(activityOverlay).toContain(
            "activityOverlay.actions.openDataSources",
        );
        expect(activityOverlay).toContain("isActiveTranscriptionJob");
        expect(activityOverlay).toContain(
            'data-testid="dashboard-activity-trigger"',
        );
        expect(activityOverlay).toContain(
            'data-testid="dashboard-activity-panel"',
        );
        expect(activityOverlay).toContain(
            'data-testid="dashboard-activity-status"',
        );
        expect(activityOverlay).toContain(
            'data-testid="dashboard-activity-empty"',
        );
        expect(activityOverlay).toContain(
            'data-testid="dashboard-activity-dismiss"',
        );
        expect(activityOverlay).toContain(
            'data-testid="dashboard-activity-action"',
        );
        expect(activityOverlay).toContain("data-activity-id");
        expect(activityOverlay).toContain("data-action-state");
        expect(activityOverlay).toContain('"dashboard-activity-loading"');
        expect(activityOverlay).toContain('"dashboard-activity-error"');
        expect(activityOverlay).not.toContain("fetch(");
    });

    it("keeps the activity trigger on the shared outline primitive surface", () => {
        const activityOverlay = readSource(
            "features/dashboard/components/activity-overlay.tsx",
        );
        const triggerSurface = sourceAround(
            activityOverlay,
            'data-testid="dashboard-activity-trigger"',
            700,
        );

        expect(activityOverlay).not.toContain("bg-background/45");
        expect(triggerSurface).toContain('variant="outline"');
        expect(triggerSurface).toContain('size="icon"');
        expect(triggerSurface).toContain(
            'className="relative h-9 w-9 rounded-xl"',
        );
        expect(triggerSurface).toContain(
            'data-testid="dashboard-activity-trigger"',
        );
        expect(triggerSurface).toContain("disabled={!isInteractive}");
        expect(triggerSurface).toContain(
            'aria-controls="dashboard-activity-panel"',
        );
        expect(triggerSurface).toContain("if (open) {");
        expect(triggerSurface).toContain("closeAndReturnFocus();");
        expect(triggerSurface).toContain("onOpenChange(true);");
        expect(triggerSurface).toContain("actionableCount > 0");
        expect(triggerSurface).toContain('aria-hidden="true"');

        expect(activityOverlay).toContain("triggerRef.current?.focus");
        expect(activityOverlay).toContain("TopbarOverlayPortal");
        expect(activityOverlay).toContain("anchorRef={triggerRef}");
        expect(activityOverlay).toContain('id="dashboard-activity-panel"');
    });

    it("keeps activity dismiss, retry, and keyboard states explicit", () => {
        const activityOverlay = readSource(
            "features/dashboard/components/activity-overlay.tsx",
        );
        const translations = readSource("lib/i18n.ts");

        expect(activityOverlay).toContain("dismissedItemIds");
        expect(activityOverlay).toContain("setDismissedItemIds");
        expect(activityOverlay).toContain('"busy" | "done" | "failed"');
        expect(activityOverlay).toContain("aria-busy={actionIsBusy}");
        expect(activityOverlay).toContain("useLanguage");
        expect(activityOverlay).toContain("activityOverlay.actions.queued");
        expect(activityOverlay).toContain("activityOverlay.allHandled");
        expect(activityOverlay).toContain("activityOverlay.emptyTitle");
        expect(activityOverlay).not.toContain("已加入更新");
        expect(activityOverlay).not.toContain("全部已处理");
        expect(activityOverlay).not.toContain("没有新的动态");
        expect(translations).toContain("已加入更新");
        expect(translations).toContain("All handled");
        expect(translations).toContain("No new activity");
        expect(translations).toContain("前往数据源设置");
        expect(translations).toContain("Open data source settings");
        expect(activityOverlay).toContain("role={isRecordingAction");
        expect(activityOverlay).toContain("tabIndex={isRecordingAction");
        expect(activityOverlay).toContain('event.key !== "Enter"');
        expect(activityOverlay).toContain('event.key !== " "');
        expect(activityOverlay).toContain("onSyncNow");
        expect(activityOverlay).toContain('item.action === "settings"');
    });

    it("keeps search and activity mutually exclusive and below modal-level surfaces", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );
        const activityOverlay = readSource(
            "features/dashboard/components/activity-overlay.tsx",
        );
        const topbarOverlayPortal = readSource(
            "features/dashboard/components/topbar-overlay-portal.tsx",
        );

        expect(workstation).toContain(
            'type TopbarOverlay = "search" | "activity"',
        );
        expect(workstation).toContain("setSearchOverlayOpen");
        expect(workstation).toContain("setActivityOverlayOpen");
        expect(workstation).toContain("handleToggleMoreActions");
        expect(workstation).toContain("handleToggleTagManager");
        expect(workstation).toContain('setActiveTopbarOverlay("search");');
        expect(workstation).toContain('setActiveTopbarOverlay("activity");');
        expect(workstation).toContain("setMoreActionsOpen(false);");
        expect(workstation).toContain("setTagManagerOpen(false);");
        expect(workstation).toContain("setSourceDrawerOpen(false);");
        expect(workstation).toContain("if (settingsOpen) {");
        expect(workstation).toContain("setActiveTopbarOverlay(null);");
        expect(workstation).toContain("overflow-visible");

        expect(topbarOverlayPortal).toContain(
            'import { createPortal } from "react-dom"',
        );
        expect(topbarOverlayPortal).toContain(
            "return createPortal(children({ style }), document.body);",
        );
        expect(searchComponent).toContain("TopbarOverlayPortal");
        expect(activityOverlay).toContain("TopbarOverlayPortal");
        expect(searchComponent).toContain("z-[520]");
        expect(activityOverlay).toContain("z-[520]");
        expect(searchComponent).toContain('data-topbar-overlay-portal="true"');
        expect(activityOverlay).toContain('data-topbar-overlay-portal="true"');
        expect(searchComponent).not.toContain(
            "fixed top-[4.75rem] right-3 left-3",
        );
        expect(activityOverlay).not.toContain(
            "fixed top-[4.75rem] right-3 left-3",
        );
        expect(searchComponent).not.toContain(
            "sm:absolute sm:top-11 sm:right-0 sm:left-auto",
        );
        expect(activityOverlay).not.toContain(
            "sm:absolute sm:top-11 sm:right-0 sm:left-auto",
        );
        expect(searchComponent).toContain("max-h-[min(calc(100svh-5.5rem)");
        expect(activityOverlay).toContain("max-h-[min(calc(100svh-5.5rem)");
        expect(searchComponent).not.toContain(
            "sm:max-h-[min(calc(100svh-6rem)",
        );
        expect(activityOverlay).not.toContain(
            "sm:max-h-[min(calc(100svh-6rem)",
        );
        expect(activityOverlay).toContain("triggerRef.current?.focus");
        expect(activityOverlay).toContain('event.key === "Escape"');
        expect(activityOverlay).toContain(
            "closeAndReturnFocus({ returnFocus: false });",
        );
    });

    it("keeps S4/S5 scope from landing later settings, detail, copy, or rename work", () => {
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );
        const activityOverlay = readSource(
            "features/dashboard/components/activity-overlay.tsx",
        );

        for (const forbidden of [
            "source-" + "report",
            "rename/" + "auto",
            "vo" + "script",
            "Vo" + "Script",
            "pay" + "load",
            "cap" + "ability",
            "fall" + "back",
            "SettingsDialog",
        ]) {
            expect(searchComponent).not.toContain(forbidden);
            expect(activityOverlay).not.toContain(forbidden);
        }

        expect(activityOverlay).not.toContain("http://");
        expect(activityOverlay).not.toContain("https://");
        expect(searchComponent).not.toContain("http://");
        expect(searchComponent).not.toContain("https://");
    });
});
