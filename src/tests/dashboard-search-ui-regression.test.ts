import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const OLD_UI_RE =
    /<LibrarySearch[\s/>]|<ActivityOverlay[\s/>]|<TopbarOverlayPortal[\s/>]|\.\/components\/library-search|\.\/components\/activity-overlay|\.\/components\/topbar-overlay-portal|uikit-|glass-surface|glass-control/;

const LIBRARY_SEARCH_INDEXING_LEGACY_CSS_SELECTOR_RE =
    /\.(?:inline-progress|ls-state-indexing)(?![\w-])/;

const LIBRARY_SEARCH_LEGACY_CSS_SELECTOR_RE = /\.ls-[a-z0-9-]+(?![\w-])/;

const DASHBOARD_SEARCH_LEGACY_CSS_SELECTOR_RE = /\.search(?![\w-])/;

const LIBRARY_SEARCH_INDEXING_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-part="library-search-indexing"]',
    '[data-sot-part="library-search-state-skeleton"]',
    '[data-sot-part="library-search-state-skeleton"]::after',
    '[data-sot-part="library-search-state-copy"]',
];

const DASHBOARD_SEARCH_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-control="dashboard-search"][data-slot="button"]',
    '[data-sot-control="dashboard-search"][data-slot="button"] svg',
    '[data-sot-part="library-search-input-row"]',
    '[data-sot-control="library-search-input"][data-slot="input-group-control"]',
    '[data-sot-part="library-search-input-row"] [data-slot="input-group-addon"] svg',
    '[data-sot-panel="library-search"] kbd',
];

describe("dashboard SOT search and activity interactions", () => {
    it("keeps search inline in the SOT topbar with all query states", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).not.toMatch(OLD_UI_RE);
        expect(workstation).toContain("const [searchOpen, setSearchOpen]");
        expect(workstation).toContain("const [query, setQuery]");
        expect(workstation).toContain("const [searchScope, setSearchScope]");
        expect(workstation).toContain(
            "const [searchLoading, setSearchLoading]",
        );
        expect(workstation).toContain("const [searchError, setSearchError]");
        expect(workstation).toContain('data-sot-control="dashboard-search"');
        expect(workstation).toContain('data-sot-panel="library-search"');
        expect(workstation).toContain('role="dialog"');
        expect(workstation).toContain(
            'aria-label={t("librarySearch.dialogLabel")}',
        );
        expect(workstation).toContain("data-sot-state={");
        expect(workstation).toContain('"no-query"');
        expect(workstation).toContain('"loading"');
        expect(workstation).toContain('"results"');
        expect(workstation).toContain('"no-results"');
        expect(workstation).toContain('"error"');
        expect(workstation).toContain(
            'data-sot-control="library-search-input"',
        );
        expect(workstation).toContain(
            'data-sot-control="library-search-clear"',
        );
        expect(workstation).toContain("<InputGroup");
        expect(workstation).toContain("<InputGroupInput");
        expect(workstation).toContain("<InputGroupButton");
        expect(workstation).toContain("<ToggleGroup");
        expect(workstation).toContain("<ToggleGroupItem");
        expect(workstation).toContain('data-sot-panel="library-search"');
        expect(workstation).toContain(
            'data-sot-part="library-search-input-row"',
        );
        expect(workstation).toContain('data-sot-part="library-search-scope"');
        expect(workstation).toContain('data-sot-part="library-search-loading"');
        expect(workstation).toContain('data-sot-part="library-search-error"');
        expect(workstation).toContain('data-sot-state="loading"');
        expect(workstation).toContain('data-sot-state="results"');
        expect(workstation).toContain('data-sot-state="indexing"');
        expect(workstation).toContain('data-sot-state="error"');
        expect(workstation).toContain("data-sot-state={");
        expect(workstation).toContain('data-sot-canonical="web-index-runtime"');
        expect(workstation).toContain("data-sot-scope-count={String(");
        expect(workstation).toContain("SEARCH_SCOPES.length");
        expect(workstation).toContain('{ value: "all", label: "全部" }');
        expect(workstation).toContain('{ value: "recording", label: "录音" }');
        expect(workstation).toContain(
            '{ value: "transcript", label: "逐字稿" }',
        );
        expect(workstation).toContain('{ value: "speaker", label: "说话人" }');
        expect(workstation).toContain('{ value: "tag", label: "标签" }');
        expect(workstation).not.toContain("SEARCH_SCOPES.filter");
        expect(workstation).not.toContain("SEARCH_SCOPES.slice");
        expect(workstation).toContain(
            'data-sot-control="library-search-retry"',
        );
        expect(workstation).toContain('data-sot-part="library-search-empty"');
        expect(workstation).toContain(
            'data-sot-part="library-search-state-copy"',
        );
        expect(workstation).toContain('No content found for "');
        expect(workstation).toContain("没有找到与「");
        expect(workstation).toContain("<span>");
        expect(workstation).toContain("librarySearch.noQuery");
        expect(workstation).not.toContain("ls-state ls-state-");
        expect(workstation).not.toContain('className="ls-scope"');
        expect(workstation).not.toContain("data-ls-retry");
    });

    it("keeps search indexing progress CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                LIBRARY_SEARCH_INDEXING_LEGACY_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of LIBRARY_SEARCH_INDEXING_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
    });

    it("keeps library search runtime CSS off legacy ls aliases", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                LIBRARY_SEARCH_LEGACY_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of [
            '[data-sot-part="library-search-anchor"]',
            '[data-sot-panel="library-search"]',
            '[data-sot-part="library-search-input-row"]',
            '[data-sot-part="library-search-scope"]',
            '[data-sot-control="library-search-scope"]',
            '[data-sot-region="library-search-scroll"]',
            '[data-sot-list="library-search-results"]',
            '[data-sot-control="library-search-result"]',
        ]) {
            expect(globals).toContain(selector);
        }
    });

    it("keeps dashboard search atom CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) => DASHBOARD_SEARCH_LEGACY_CSS_SELECTOR_RE.test(text));

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DASHBOARD_SEARCH_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
    });

    it("keeps search scoped to backend search and applies result navigation", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain(
            "fetch(`/api/search?${params.toString()}`)",
        );
        expect(workstation).toContain('params.set("type", searchScope)');
        expect(workstation).toContain("SEARCH_SCOPES.map");
        expect(workstation).toContain("data-search-scope={item.value}");
        expect(workstation).toContain("setSearchScope(");
        expect(workstation).toContain("value as SearchScope");
        expect(workstation).toContain("groupedSearchResults.map");
        expect(workstation).toContain("group.results.map");
        expect(workstation).toContain("data-result-type=");
        expect(workstation).toContain(
            'data-sot-control="library-search-result"',
        );
        expect(workstation).toContain(
            'data-sot-part="library-search-result-title"',
        );
        expect(workstation).toContain(
            'data-sot-part="library-search-result-meta"',
        );
        expect(workstation).toContain(
            'data-sot-part="library-search-tag-chip"',
        );
        expect(workstation).not.toContain('className="ls-item"');
        expect(workstation).not.toContain('className="ls-item-title"');
        expect(workstation).not.toContain('className="ls-item-meta"');
        expect(workstation).not.toContain('className="utag c-violet"');
        expect(workstation).not.toContain('className="ls-result"');
        expect(workstation).not.toContain('className="ls-section"');
        expect(workstation).not.toContain('className="ls-tail"');
        expect(workstation).toContain("data-sot-result-index={String(");
        expect(workstation).toContain("data-sot-result-type=");
        expect(workstation).toContain("selectRecording(");
        expect(workstation).toContain("setSearchOpen(");
    });

    it("keeps Escape and outside-click dismissal shared across drawer, search, and activity overlays", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain('event.key !== "Escape"');
        expect(workstation).toContain("if (activityOpen) {");
        expect(workstation).toContain("setActivityOpen(false);");
        expect(workstation).toContain("if (searchOpen) {");
        expect(workstation).toContain("setSearchOpen(false);");
        expect(workstation).toContain("if (drawerOpen) {");
        expect(workstation).toContain(
            'document.addEventListener("keydown", handleKeyDown)',
        );
        expect(workstation).toContain(
            'document.addEventListener("pointerdown", handlePointerDown)',
        );
        expect(workstation).toContain(
            "!searchOverlayRef.current.contains(target)",
        );
        expect(workstation).toContain(
            "!activityOverlayRef.current.contains(target)",
        );
    });

    it("keeps activity center inline with sync, settings, recording, dismiss, and empty states", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain("const [activityOpen, setActivityOpen]");
        expect(workstation).toContain("const [dismissedActivityIds");
        expect(workstation).toContain("const activityItems = useMemo");
        expect(workstation).toContain("const visibleActivityItems");
        expect(workstation).toContain("const activityBadgeCount");
        expect(workstation).toContain('data-sot-control="dashboard-activity"');
        expect(workstation).toContain('data-sot-panel="dashboard-activity"');
        expect(workstation).toContain("data-sot-item-count={String(");
        expect(workstation).toContain('role="dialog"');
        expect(workstation).toContain(
            'aria-label={t("activityOverlay.title")}',
        );
        expect(workstation).toContain("<CardHeader");
        expect(workstation).toContain("<CardTitle");
        expect(workstation).toContain("<CardContent");
        expect(workstation).toContain("<CardAction");
        expect(workstation).toContain("<Badge");
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-heading"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-count"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-activity-close"',
        );
        expect(workstation).toContain('size="icon-sm"');
        expect(workstation).toContain('variant="ghost"');
        expect(workstation).toContain('data-sot-control="dashboard-settings"');
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-status"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-status-line"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-status-sub"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-activity-sync"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-activity-action"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-activity-dismiss"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-empty"',
        );
        expect(workstation).toContain(
            'data-sot-list="dashboard-activity-items"',
        );
        expect(workstation).toContain(
            'data-sot-item="dashboard-activity-item"',
        );
        expect(workstation).toContain("data-kind={activityItemKind(");
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-item-title"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-item-body"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-item-meta"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-empty-icon"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-empty-title"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-empty-body"',
        );
        expect(workstation).not.toMatch(/\bclassName="notif-/);
        expect(workstation).not.toContain('<h2 className="notif-title"');
        expect(workstation).not.toContain('className="notif-msg"');
        expect(workstation).not.toContain('className="notif-time"');
        expect(workstation).toContain('item.action === "sync"');
        expect(workstation).toContain('item.action === "settings"');
        expect(workstation).toContain('openSettings("data-sources")');
        expect(workstation).toContain("selectRecording(item.recordingId)");
    });
});
