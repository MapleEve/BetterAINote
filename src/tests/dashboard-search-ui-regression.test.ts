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

function extractDashboardSearchActivityClassNames(source: string) {
    const marker = "const dashboardSearchActivityClassNames = {";
    const start = source.indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf("} as const;", start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + "} as const;".length);
}

function extractObjectStringProperty(source: string, propertyName: string) {
    const marker = `${propertyName}:`;
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const valueStart = source.indexOf('"', markerIndex);
    expect(valueStart).toBeGreaterThan(markerIndex);

    for (let index = valueStart + 1; index < source.length; index += 1) {
        if (source[index] === '"' && source[index - 1] !== "\\") {
            return source.slice(markerIndex, index + 1);
        }
    }

    throw new Error(`Unclosed string property: ${propertyName}`);
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

const SEARCH_ACTIVITY_PRIMITIVE_FILES = [
    "components/ui/button.tsx",
    "components/ui/badge.tsx",
    "components/ui/card.tsx",
    "components/ui/input-group.tsx",
    "components/ui/toggle-group.tsx",
    "components/ui/alert.tsx",
] as const;

const SEARCH_ACTIVITY_BUSINESS_TOKEN_RE =
    /\b(?:dashboardSearch|librarySearch|dashboardActivity)[A-Za-z0-9_]*/g;

const DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_CLASS_SNIPPETS = [
    {
        propertyName: "dashboardSearchTrigger",
        snippets: [
            "relative size-[32px]",
            "data-[sot-state=open]:border-border",
            "data-[sot-state=open]:bg-accent",
            "data-[sot-state=open]:text-accent-foreground",
        ],
    },
    {
        propertyName: "dashboardActivityTrigger",
        snippets: [
            "relative size-[32px]",
            "data-[sot-state=open]:border-border",
            "data-[sot-state=open]:bg-accent",
            "data-[sot-state=open]:text-accent-foreground",
            "[&_[data-sot-part=dashboard-activity-badge]]:absolute",
            "[&_[data-sot-part=dashboard-activity-badge]]:right-0.5",
            "[&_[data-sot-part=dashboard-activity-badge]]:top-0.5",
            "[&_[data-sot-part=dashboard-activity-badge]]:h-4",
            "[&_[data-sot-part=dashboard-activity-badge]]:min-w-4",
            "[&_[data-sot-part=dashboard-activity-badge]]:bg-[var(--signal-danger)]",
            "[&_[data-sot-part=dashboard-activity-badge]]:shadow-[0_0_0_1.5px_var(--bg-elevated)]",
        ],
    },
    {
        propertyName: "librarySearchPanel",
        snippets: [
            "border-border",
            "bg-card",
            "text-card-foreground",
            "shadow-2xl",
        ],
    },
    {
        propertyName: "dashboardActivityPanel",
        snippets: [
            "border-[var(--line-hairline)]",
            "bg-[var(--bg-elevated)]",
            "shadow-[var(--shadow-lg)]",
            "dark:border-[var(--glass-border)]",
            "dark:bg-[var(--graphite-900)]",
        ],
    },
    {
        propertyName: "librarySearchInputRow",
        snippets: ["bg-transparent", "focus-within:ring-0"],
    },
    {
        propertyName: "librarySearchInput",
        snippets: ["h-8 px-1 text-sm font-medium md:text-sm"],
    },
    {
        propertyName: "librarySearchScopeItem",
        snippets: [
            "data-[state=on]:border-primary/30",
            "data-[state=on]:bg-primary/10",
            "data-[state=on]:text-primary",
        ],
    },
    {
        propertyName: "librarySearchError",
        snippets: [
            "flex w-full flex-col items-center gap-2",
            "px-4 py-4",
            "*:data-[slot=alert-description]:text-[var(--signal-danger)]",
        ],
    },
    {
        propertyName: "librarySearchErrorTitle",
        snippets: ["line-clamp-none min-h-0", "tracking-normal"],
    },
    {
        propertyName: "librarySearchResult",
        snippets: [
            "data-[active=true]:bg-accent",
            "[&_[data-sot-part=library-search-result-meta]]:font-mono",
            "[&_[data-sot-part=library-search-result-meta]]:text-[11.5px]",
            "[&_[data-sot-part=library-search-result-title]]:font-semibold",
            "[&_[data-sot-part=library-search-result-title]]:text-foreground",
        ],
    },
    {
        propertyName: "librarySearchTag",
        snippets: [
            "w-fit justify-normal gap-1.5",
            "border-primary/25",
            "bg-primary/10",
            "[&>svg]:size-3",
        ],
    },
    {
        propertyName: "dashboardActivityCount",
        snippets: ["border-0 bg-transparent p-0", "font-mono text-[11px]"],
    },
    {
        propertyName: "librarySearchClear",
        snippets: ["size-6", "hover:bg-transparent", "hover:text-foreground"],
    },
    {
        propertyName: "librarySearchRetry",
        snippets: [
            "h-6 gap-1",
            "hover:bg-accent hover:text-accent-foreground",
        ],
    },
    {
        propertyName: "dashboardActivityClose",
        snippets: [
            "size-[26px]",
            "hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
        ],
    },
    {
        propertyName: "dashboardActivitySync",
        snippets: [
            "data-[action-state=error]:text-[var(--signal-danger)]",
            "disabled:cursor-not-allowed",
            "has-[>svg]:px-[10px]",
        ],
    },
    {
        propertyName: "dashboardActivityAction",
        snippets: [
            "data-[action-state=error]:text-[var(--signal-danger)]",
            "disabled:cursor-not-allowed",
            "has-[>svg]:px-[10px]",
        ],
    },
    {
        propertyName: "dashboardActivityDismiss",
        snippets: [
            "size-[22px]",
            "p-px",
            "hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]",
            "[&_svg:not([class*='size-'])]:size-[11px]",
        ],
    },
] as const;

const DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_SOURCE_SNIPPETS = [
    'aria-expanded={searchOpen}',
    'aria-expanded={activityOpen}',
    'data-sot-state={searchOpen ? "open" : "idle"}',
    'data-sot-state={activityOpen ? "open" : "idle"}',
    "placeholder={t(",
    '"librarySearch.shortPlaceholder"',
    "dashboardSearchActivityClassNames.librarySearchInput",
] as const;

describe("dashboard SOT search and activity interactions", () => {
    it("keeps search inline in the SOT topbar with feature-owned hooks and all query states", () => {
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
        for (const compositionToken of [
            "<Button",
            "<Card",
            "<CardContent",
            "<InputGroup",
            "<InputGroupAddon",
            "<InputGroupInput",
            "<InputGroupButton",
            "<ToggleGroup",
            "<ToggleGroupItem",
            "<Alert",
            "<AlertTitle",
            "<Badge",
        ]) {
            expect(searchSlice).toContain(compositionToken);
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

    it("keeps activity center inline with feature-owned hooks for sync, settings, recording, dismiss, and empty states", () => {
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
        for (const compositionToken of [
            "<Button",
            "<Card",
            "<CardHeader",
            "<CardTitle",
            "<CardContent",
            "<CardAction",
            "<Badge",
        ]) {
            expect(activitySlice).toContain(compositionToken);
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

    it("keeps migrated search and activity visual state snippets owned by the workstation", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const classNames =
            extractDashboardSearchActivityClassNames(workstation);

        for (const {
            propertyName,
            snippets,
        } of DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_CLASS_SNIPPETS) {
            const property = extractObjectStringProperty(
                classNames,
                propertyName,
            );

            for (const snippet of snippets) {
                expect(property).toContain(snippet);
            }
        }

        for (const snippet of DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_SOURCE_SNIPPETS) {
            expect(workstation).toContain(snippet);
        }
    });

    it("keeps search and activity business tokens out of shadcn primitives", () => {
        const primitiveBusinessTokens = SEARCH_ACTIVITY_PRIMITIVE_FILES.flatMap(
            (file) =>
                (readSource(file).match(SEARCH_ACTIVITY_BUSINESS_TOKEN_RE) ?? [])
                    .sort()
                    .map((token) => `${file}:${token}`),
        );

        expect(primitiveBusinessTokens).toEqual([]);
    });
});
