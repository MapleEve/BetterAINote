import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function extractBoundedSlice(
    source: string,
    startMarker: string,
    endMarker: string,
) {
    const start = source.indexOf(startMarker);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf(endMarker, start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
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
    '[data-sot-part="library-search-anchor"]',
    '[data-sot-panel="library-search"]',
    '[data-sot-panel="library-search"][data-open="true"]',
    '[data-sot-panel="library-search"] kbd',
    '[data-sot-region="library-search-scroll"]',
    '[data-sot-part="library-search-indexing"]',
    '[data-sot-part="library-search-loading"]',
    '[data-sot-part="library-search-empty"]',
    '[data-sot-list="library-search-results"]',
    '[data-sot-group="library-search-results"]',
    '[data-sot-part="library-search-group-label"]',
    '[data-sot-control="library-search-result"] mark',
];

const DASHBOARD_SEARCH_PRIMITIVE_REPAINT_CSS_SELECTORS = [
    '[data-sot-control="dashboard-search"][data-slot="button"]',
    '[data-sot-control="dashboard-search"][data-slot="button"] svg',
    '[data-sot-part="library-search-input-row"] [data-slot="input-group-addon"]',
    '[data-sot-control="library-search-input"][data-slot="input-group-control"]',
    '[data-sot-control="library-search-clear"]',
    '[data-sot-control="library-search-scope"]',
    '[data-sot-part="library-search-error"] [data-slot="alert-title"]',
    '[data-sot-part="library-search-error"] [data-slot="button"]',
    '[data-sot-control="library-search-result"] {',
    '[data-sot-control="library-search-result"]:hover',
    '[data-sot-control="library-search-result"]:focus-visible',
    '[data-sot-part="library-search-tag-chip"] {',
];

const DASHBOARD_ACTIVITY_PRIMITIVE_REPAINT_CSS_SELECTORS = [
    '[data-sot-control="dashboard-activity-close"] {',
    '[data-sot-control="dashboard-activity-close"] svg',
    '[data-sot-control="dashboard-activity-dismiss"] {',
    '[data-sot-control="dashboard-activity-dismiss"]:hover',
    '[data-sot-control="dashboard-activity-dismiss"] svg',
];

const SEARCH_ACTIVITY_OLD_GENERIC_TOKENS = [
    'variant="ghost"',
    'variant="outline"',
    'variant="secondary"',
    'size="icon-sm"',
    'size="icon-xs"',
    'size="xs"',
    'size="sm"',
] as const;

const SEARCH_ACTIVITY_OLD_VISUAL_CLASS_SNIPPETS = [
    "border border-transparent text-muted-foreground data-[sot-state=open]",
    "rounded-xl border-border bg-card text-card-foreground shadow-2xl",
    "h-auto min-h-12 gap-2 rounded-none border-x-0 border-t-0 border-b border-border",
    "p-0 text-muted-foreground",
    "h-8 px-1 text-sm font-medium",
    "text-muted-foreground hover:text-foreground",
    "w-full flex-wrap rounded-none border-b border-border bg-muted/40 p-2",
    "h-6 rounded-full px-2.5 text-xs data-[state=on]",
    "flex flex-col items-center gap-2 border-0 bg-transparent px-4 py-4 text-center",
    "line-clamp-none min-h-0 text-center text-sm font-medium",
    "h-auto min-h-[52px] w-full flex-col items-start justify-start",
    "w-fit gap-1.5 border-primary/25 bg-primary/10 text-primary",
    "text-sm font-semibold leading-snug text-foreground",
    "font-mono text-[11.5px] font-medium leading-snug tracking-[0.02em] text-muted-foreground",
] as const;

describe("dashboard SOT search and activity interactions", () => {
    it("keeps search inline in the SOT topbar with all query states", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const searchSlice = extractBoundedSlice(
            workstation,
            'data-sot-part="library-search-anchor"',
            'data-sot-part="dashboard-activity-anchor"',
        );

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
        for (const semanticToken of [
            'variant="dashboardSearchTrigger"',
            'size="dashboardSearchTrigger"',
            'variant="librarySearchPanel"',
            'variant="librarySearchInputRow"',
            'variant="librarySearchClear"',
            'size="librarySearchClear"',
            'layout="librarySearchScope"',
            'variant="librarySearchScopeItem"',
            'size="librarySearchScopeItem"',
            'variant="librarySearchError"',
            'density="librarySearchError"',
            'layout="librarySearchError"',
            'variant="librarySearchRetry"',
            'size="librarySearchRetry"',
            'variant="librarySearchResult"',
            'size="librarySearchResult"',
            'variant="librarySearchTag"',
        ]) {
            expect(searchSlice).toContain(semanticToken);
        }
        for (const oldToken of SEARCH_ACTIVITY_OLD_GENERIC_TOKENS) {
            expect(searchSlice).not.toContain(oldToken);
        }
        for (const oldClass of SEARCH_ACTIVITY_OLD_VISUAL_CLASS_SNIPPETS) {
            expect(searchSlice).not.toContain(oldClass);
        }
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
            '[data-sot-region="library-search-scroll"]',
            '[data-sot-list="library-search-results"]',
            '[data-sot-control="library-search-result"] mark',
        ]) {
            expect(globals).toContain(selector);
        }
    });

    it("keeps dashboard search atom CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_SEARCH_LEGACY_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DASHBOARD_SEARCH_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        for (const selector of DASHBOARD_SEARCH_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of DASHBOARD_ACTIVITY_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
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
        const activitySlice = extractBoundedSlice(
            workstation,
            'data-sot-part="dashboard-activity-anchor"',
            '<Button\n                            asChild\n                            variant="dashboardSettingsAvatar"',
        );

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
        for (const semanticToken of [
            'variant="dashboardActivityTrigger"',
            'size="dashboardActivityTrigger"',
            'variant="dashboardActivityPanel"',
            'variant="dashboardActivityCount"',
            'variant="dashboardActivityClose"',
            'size="dashboardActivityClose"',
            'variant="dashboardActivitySync"',
            'size="dashboardActivitySync"',
            'variant="dashboardActivityAction"',
            'size="dashboardActivityAction"',
            'variant="dashboardActivityDismiss"',
            'size="dashboardActivityDismiss"',
        ]) {
            expect(activitySlice).toContain(semanticToken);
        }
        for (const oldToken of SEARCH_ACTIVITY_OLD_GENERIC_TOKENS) {
            expect(activitySlice).not.toContain(oldToken);
        }
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

    it("defines search and activity semantic primitives in the shadcn layer", () => {
        const button = readSource("components/ui/button.tsx");
        const badge = readSource("components/ui/badge.tsx");
        const card = readSource("components/ui/card.tsx");
        const inputGroup = readSource("components/ui/input-group.tsx");
        const toggleGroup = readSource("components/ui/toggle-group.tsx");
        const alert = readSource("components/ui/alert.tsx");

        for (const token of [
            "dashboardSearchTrigger:",
            "librarySearchClear:",
            "librarySearchRetry:",
            "librarySearchResult:",
            "dashboardActivityTrigger:",
            "dashboardActivityClose:",
            "dashboardActivitySync:",
            "dashboardActivityAction:",
            "dashboardActivityDismiss:",
        ]) {
            expect(button).toContain(token);
        }
        expect(badge).toContain("librarySearchTag:");
        expect(badge).toContain("dashboardActivityCount:");
        expect(card).toContain("librarySearchPanel:");
        expect(card).toContain("dashboardActivityPanel:");
        expect(inputGroup).toContain("librarySearchInputRow:");
        expect(inputGroup).toContain('"librarySearchClear"');
        expect(toggleGroup).toContain('"librarySearchScope"');
        expect(toggleGroup).toContain("librarySearchScopeItem:");
        expect(alert).toContain('"librarySearchError"');
    });
});
