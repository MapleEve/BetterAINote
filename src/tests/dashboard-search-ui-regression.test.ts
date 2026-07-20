import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readRepoSource(relativePath: string) {
    return readFileSync(path.join(ROOT, "..", relativePath), "utf8");
}

describe("dashboard search semantic regression", () => {
    it("keeps the search overlay feature-owned and disconnected from retired UI", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const librarySearch = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        expect(workstation).toContain("const [searchOpen, setSearchOpen]");
        expect(workstation).toContain("const [query, setQuery]");
        expect(workstation).toContain("<LibrarySearch");
        expect(workstation).not.toMatch(
            /<ActivityOverlay[\s/>]|<TopbarOverlayPortal[\s/>]|uikit-|glass-surface|glass-control/,
        );
        expect(librarySearch).toContain("const [searchScope, setSearchScope]");
        expect(librarySearch).toContain(
            "const [searchLoading, setSearchLoading]",
        );
        expect(librarySearch).toContain("const [searchError, setSearchError]");
        expect(librarySearch).toContain(
            "const [searchResults, setSearchResults]",
        );
    });

    it("uses semantic shadcn primitives and ARIA relationships for search results", () => {
        const librarySearch = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        for (const primitive of [
            "<Button",
            "<Card",
            "<CardContent",
            "<InputGroup",
            "<InputGroupInput",
            "<ToggleGroup",
            "<ToggleGroupItem",
            "<Alert",
            "<Badge",
        ]) {
            expect(librarySearch).toContain(primitive);
        }
        expect(librarySearch).toContain('role="dialog"');
        expect(librarySearch).toContain('role="combobox"');
        expect(librarySearch).toContain('role="listbox"');
        expect(librarySearch).toContain('role="option"');
        expect(librarySearch).toContain(
            "aria-controls={LIBRARY_SEARCH_RESULTS_ID}",
        );
        expect(librarySearch).toContain("aria-activedescendant={");
        expect(librarySearch).toContain("aria-selected={");
        expect(librarySearch).toContain('aria-live="polite"');
    });

    it("keeps backend query, scope, keyboard, and result actions in the component", () => {
        const librarySearch = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        expect(librarySearch).toMatch(
            /fetch\(`\/api\/search\?\$\{params\.toString\(\)\}`\)/,
        );
        expect(librarySearch).toContain('params.set("type", searchScope)');
        expect(librarySearch).toContain("onQueryChange(event.target.value)");
        expect(librarySearch).toContain("onValueChange={(value) =>");
        expect(librarySearch).toContain(
            "applyLibrarySearchResult(activeResult)",
        );
        expect(librarySearch).toContain("onApplyFilter({");
        expect(librarySearch).toContain("onOpenRecording(result.recordingId)");
        for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
            expect(librarySearch).toContain(`event.key === "${key}"`);
        }
    });

    it("keeps presentation ownership local and avoids global legacy selectors", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const librarySearch = readSource(
            "features/dashboard/components/library-search.tsx",
        );
        const productGlobals = readSource("app/globals.css");

        for (const className of [
            "librarySearchClassNames",
            "librarySearchClassNames.panel",
            "librarySearchClassNames.result",
            "librarySearchClassNames.scroll",
        ]) {
            expect(librarySearch).toContain(className);
        }
        expect(librarySearch).not.toContain('className="ls-item"');
        expect(librarySearch).not.toContain('className="ls-result"');
        expect(librarySearch).not.toContain("[&>svg]:size-[15px]");
        expect(librarySearch).not.toContain("[&>svg]:stroke-[1.8]");
        const lucideNamedImports =
            librarySearch.match(
                /import\s*\{([^}]*)\}\s*from "lucide-react";/,
            )?.[1] ?? "";
        expect(lucideNamedImports).not.toBe("");
        expect(
            lucideNamedImports
                .split(",")
                .map((name) => name.trim())
                .filter(Boolean)
                .sort(),
        ).toEqual(["Columns2", "Search", "X"]);
        expect(librarySearch).not.toContain("createLucideIcon");
        expect(librarySearch).not.toContain("IconNode");
        expect(librarySearch).toMatch(
            /<Search\s+aria-hidden="true"\s+className="!size-\[15px\]"\s+size=\{15\}\s+strokeWidth=\{1\.8\}\s*\/>/,
        );
        expect(librarySearch).not.toContain("[&_svg]:stroke-2");
        expect(librarySearch).toMatch(
            /<Columns2\s+className="!size-\[11px\]"\s+aria-hidden="true"\s+size=\{\s*11\s*\}\s+strokeWidth=\{\s*2\s*\}\s*\/>/,
        );
        expect(workstation).toContain("data-workspace-provider={item.key}");
        for (const source of [workstation, librarySearch]) {
            expect(source).not.toMatch(/\b(?:data-sot|sot-)/i);
        }
        expect(productGlobals).not.toMatch(/\.ls-[a-z0-9-]+(?![\w-])/);
        expect(productGlobals).not.toMatch(/\.search(?![\w-])/);
    });

    it("preserves the complete search state machine and retry path", () => {
        const librarySearch = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        expect(librarySearch).toContain("const searchPanelState =");
        for (const state of [
            '"indexing"',
            '"error"',
            '"loading"',
            '"results"',
            '"no-results"',
            '"no-query"',
        ]) {
            expect(librarySearch).toContain(state);
        }
        expect(librarySearch).toContain(
            "if (!open || query.trim().length === 0)",
        );
        expect(librarySearch).toContain("setSearchResults([]);");
        expect(librarySearch).toContain("data.indexing?.active");
        expect(librarySearch).toContain("setSearchIndexing(data.indexing);");
        expect(librarySearch).toContain('setSearchError("搜索暂时不可用")');
        expect(librarySearch).toMatch(
            /setSearchRetry\(\s*\(\s*value\s*\)\s*=>\s*value\s*\+\s*1\s*,?\s*\);/,
        );
        expect(librarySearch).toContain(
            'params.set("_retry", String(searchRetry))',
        );
    });

    it("keeps loading copy and semantic controls on the live backend contract", () => {
        const librarySearch = readSource(
            "features/dashboard/components/library-search.tsx",
        );
        const i18n = readSource("lib/i18n.ts");
        const librarySearchE2E = readRepoSource(
            "e2e/library-search-backend.spec.ts",
        );

        expect(i18n).toContain('loading: "检索中"');
        expect(librarySearch).toContain('{t("librarySearch.loading")}');
        for (const marker of [
            'data-control="dashboard-search"',
            'data-panel="library-search"',
            'data-control="library-search-input"',
            'data-control="library-search-scope"',
            'data-part="library-search-indexing"',
            'data-control="library-search-result"',
        ]) {
            expect(librarySearch).toContain(marker);
        }
        expect(librarySearchE2E).toContain(
            'test("library search uses the real /api/search route against the seeded local read model",',
        );
        expect(librarySearchE2E).toContain(
            'test("library search shows the real backend indexing state while search index jobs are active",',
        );
        expect(librarySearchE2E).toContain(
            'toHaveAttribute("data-control", "dashboard-search")',
        );
        expect(librarySearchE2E).toContain(
            'toHaveAttribute("data-panel", "library-search")',
        );
        expect(librarySearchE2E).toContain("page.waitForResponse");
        expect(librarySearchE2E).not.toMatch(
            /data-sot|sot-|route\(|fulfill|addInitScript|mock|\.skip\(|\.only\(|mask:|tolerance/,
        );
    });

    it("keeps dashboard source-filter interactions live through semantic controls", () => {
        const dashboardSourceFilterE2E = readRepoSource(
            "e2e/dashboard-source-filter-stack.spec.ts",
        );

        for (const testName of [
            'test("dashboard source filter stack clears and resets in English display language",',
            'test("dashboard source filter stack retries sync errors through the real endpoint and restores active state",',
            'test("dashboard source filter stack widens no-result favorite filters and resets all filters",',
        ]) {
            expect(dashboardSourceFilterE2E).toContain(testName);
        }
        for (const interaction of [
            "await clearSource.click();",
            'sourceFilterAction(page, "source-filter-retry-sync").click();',
            'sourceFilterAction(page, "source-filter-widen").click();',
        ]) {
            expect(dashboardSourceFilterE2E).toContain(interaction);
        }
        expect(dashboardSourceFilterE2E).not.toMatch(
            /data-sot-|addStyleTag|cloneNode|SOT_FIXTURE_PROJECT_ROOT|SOT_SOURCE_ASSET_DIR|route\(|fulfill|addInitScript|mock|\.skip\(|\.only\(|mask:|tolerance/,
        );
    });

    it("keeps search focus management and outside dismissal accessible", () => {
        const librarySearch = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        expect(librarySearch).toContain("searchInputRef.current?.focus({");
        expect(librarySearch).toContain(
            "searchTriggerRef.current?.focus({ preventScroll: true })",
        );
        expect(librarySearch).toContain('event.key !== "Escape"');
        expect(librarySearch).toContain("onOpenChange(false);");
        expect(librarySearch).toContain(
            "!searchOverlayRef.current?.contains(target)",
        );
        expect(librarySearch).toContain(
            'document.addEventListener("pointerdown", handlePointerDown)',
        );
        expect(librarySearch).toContain('aria-haspopup="dialog"');
        expect(librarySearch).toContain(
            "aria-controls={open ? LIBRARY_SEARCH_DIALOG_ID : undefined}",
        );
    });

    it("preserves grouped result semantics for filters and recording navigation", () => {
        const librarySearch = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        expect(librarySearch).toContain("groupedSearchResults");
        expect(librarySearch).toContain("SEARCH_RESULT_TYPES.map");
        expect(librarySearch).toContain("searchResultAction(result)");
        expect(librarySearch).toContain(
            'result.entityType === "tag" || result.entityType === "speaker"',
        );
        expect(librarySearch).toContain("onApplyFilter({");
        expect(librarySearch).toContain("onOpenRecording(result.recordingId);");
        expect(librarySearch).toContain('onQueryChange("");');
        expect(librarySearch).toContain('role="listbox"');
        expect(librarySearch).toContain('role="option"');
        expect(librarySearch).toContain("aria-selected={");
        expect(librarySearch).toMatch(
            /key=\{`\$\{result\.entityType\}:\$\{result\.entityId\}`\}/,
        );
        expect(librarySearch).toContain("aria-disabled={");
    });

    it("coordinates search with the other dashboard overlays", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain(
            "function handleLibrarySearchOpenChange(open: boolean)",
        );
        const callback = workstation.slice(
            workstation.indexOf(
                "function handleLibrarySearchOpenChange(open: boolean)",
            ),
            workstation.indexOf(
                "function applyLibrarySearchFilter",
                workstation.indexOf(
                    "function handleLibrarySearchOpenChange(open: boolean)",
                ),
            ),
        );
        for (const closeState of [
            "setActivityOpen(false);",
            "setMoreOpen(false);",
            "setTagOpen(false);",
            "setAiOpen(false);",
        ]) {
            expect(callback).toContain(closeState);
        }
        expect(callback).toContain("setSearchOpen(open);");
        expect(workstation).toContain("open={searchOpen}");
        expect(workstation).toContain(
            "onOpenChange={handleLibrarySearchOpenChange}",
        );
        expect(workstation).toContain("onOpenRecording={selectRecording}");
    });

    it("keeps activity items derived from sync and transcription state", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain(
            "const activityItems = useMemo<ActivityItem[]>(",
        );
        for (const activityCondition of [
            "isAutoSyncing || workerStatus?.isRunning",
            "workerStatus?.manualTriggerRequestedAt",
            "lastSyncResult?.success === false",
            "workerStatus && !workerStatus.healthy",
            "lastSyncResult?.success",
            "isActiveTranscriptionJob(job)",
            'job.status === "failed"',
        ]) {
            expect(workstation).toContain(activityCondition);
        }
        expect(workstation).toContain(
            "const visibleActivityItems = activityItems.filter",
        );
        expect(workstation).toContain("dismissedActivityIds.has(item.id)");
        expect(workstation).toContain(
            "const activityBadgeCount = visibleActivityItems.filter",
        );
        expect(workstation).toContain(
            'item.tone === "error" || item.tone === "warn" || item.action',
        );
        expect(workstation).toContain(
            "const activityPanelState = visibleActivityItems.some",
        );
    });

    it("keeps activity actions connected to sync, settings, and recordings", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        const actionHandler = workstation.slice(
            workstation.indexOf("async function runActivityAction"),
            workstation.indexOf("function handleActivityItemKeyDown"),
        );
        expect(actionHandler).toContain('item.action === "sync"');
        expect(actionHandler).toContain("runManualSync();");
        expect(actionHandler).toContain('item.action === "settings"');
        expect(actionHandler).toContain('openSettings("data-sources");');
        expect(actionHandler).toContain("selectRecording(item.recordingId);");
        expect(actionHandler).toContain("setActivityOpen(false);");
        expect(workstation).toContain(
            'event.key !== "Enter" && event.key !== " "',
        );
        expect(workstation).toContain("void runActivityAction(item);");
    });

    it("renders activity as a dialog with status, list, and empty-state contracts", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain('role="dialog"');
        expect(workstation).toContain(
            'aria-label={t("activityOverlay.title")}',
        );
        expect(workstation).toContain("<CardHeader");
        expect(workstation).toContain("<CardContent");
        expect(workstation).toContain("<Badge");
        expect(workstation).toContain("activityPanelState");
        expect(workstation).toContain("visibleActivityItems.length > 0");
        expect(workstation).toContain("activityOverlay.emptyTitle");
        expect(workstation).toContain("activityOverlay.emptyBody");
        expect(workstation).toContain("aria-busy={syncButtonBusy}");
        expect(workstation).toContain("disabled={syncButtonBusy}");
        expect(workstation).toContain("aria-label={t(");
        expect(workstation).toContain("activityOverlay.close");
    });

    it("shares Escape and pointer dismissal behavior across dashboard overlays", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain(
            "if (!drawerOpen && !activityOpen) return;",
        );
        expect(workstation).toContain('if (event.key !== "Escape") return;');
        expect(workstation).toContain(
            "closeActivityOverlay({ restoreFocus: true });",
        );
        expect(workstation).toContain("setDrawerOpen(false);");
        expect(workstation).toContain(
            "!activityOverlayRef.current.contains(target)",
        );
        expect(workstation).toContain(
            'document.addEventListener("keydown", handleKeyDown)',
        );
        expect(workstation).toContain(
            'document.addEventListener("pointerdown", handlePointerDown)',
        );
        expect(workstation).toContain(
            'document.removeEventListener("keydown", handleKeyDown)',
        );
        expect(workstation).toContain(
            'document.removeEventListener("pointerdown", handlePointerDown)',
        );
    });
});
