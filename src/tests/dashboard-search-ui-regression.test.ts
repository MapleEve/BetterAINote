import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readProductGlobals() {
    const source = readSource("app/globals.css");
    const marker = "BetterAINote · Component Library";
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThan(0);
    return source.slice(0, markerIndex);
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

function extractConstString(source: string, constName: string) {
    const marker = `const ${constName} =`;
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const valueStart = source.indexOf('"', markerIndex);
    expect(valueStart).toBeGreaterThan(markerIndex);

    for (let index = valueStart + 1; index < source.length; index += 1) {
        if (source[index] === '"' && source[index - 1] !== "\\") {
            return source.slice(markerIndex, index + 1);
        }
    }

    throw new Error(`Unclosed string const: ${constName}`);
}

function extractConstObject(source: string, constName: string) {
    const marker = `const ${constName} = {`;
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

const MIGRATED_LIBRARY_SEARCH_INDEXING_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-part="library-search-indexing"]',
    '[data-sot-part="library-search-state-skeleton"]',
    '[data-sot-part="library-search-state-skeleton"]::after',
    '[data-sot-part="library-search-state-copy"]',
];

const MIGRATED_DASHBOARD_SEARCH_DATA_SOT_CSS_SELECTORS = [
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

const MIGRATED_DASHBOARD_ACTIVITY_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-part="dashboard-topbar-actions"]',
    '[data-sot-part="dashboard-activity-anchor"]',
    '[data-sot-control="dashboard-activity"]',
    '[data-sot-part="dashboard-activity-badge"]',
    '[data-sot-panel="dashboard-activity"]',
    '[data-sot-panel="dashboard-activity"][data-open="true"]',
    '[data-sot-part="dashboard-activity-header"]',
    '[data-sot-part="dashboard-activity-heading"]',
    '[data-sot-part="dashboard-activity-title"]',
    '[data-sot-part="dashboard-activity-content"]',
    '[data-sot-part="dashboard-activity-status"]',
    '[data-sot-part="dashboard-activity-status-indicator"]',
    '[data-sot-part="dashboard-activity-status-copy"]',
    '[data-sot-part="dashboard-activity-status-line"]',
    '[data-sot-part="dashboard-activity-status-sub"]',
    '[data-sot-list="dashboard-activity-items"]',
    '[data-sot-item="dashboard-activity-item"]',
    '[data-sot-part="dashboard-activity-item-icon"]',
    '[data-sot-part="dashboard-activity-item-copy"]',
    '[data-sot-part="dashboard-activity-item-actions"]',
    '[data-sot-control="dashboard-activity-dismiss"]:focus-visible',
    '[data-sot-part="dashboard-activity-empty"][hidden]',
    '[data-sot-part="dashboard-activity-item-title"]',
    '[data-sot-part="dashboard-activity-item-body"]',
    '[data-sot-part="dashboard-activity-item-meta"]',
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
        propertyName: "dashboardTopbarActions",
        snippets: ["ml-auto flex items-center gap-2"],
    },
    {
        propertyName: "librarySearchAnchor",
        snippets: [
            "relative inline-flex size-[32px]",
            "items-center",
            "justify-center",
            "p-0",
        ],
    },
    {
        propertyName: "dashboardActivityAnchor",
        snippets: [
            "relative inline-flex size-[32px]",
            "items-center",
            "justify-center",
            "p-0",
        ],
    },
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
            "[&_[data-sot-part=dashboard-activity-badge]]:bg-destructive",
            "[&_[data-sot-part=dashboard-activity-badge]]:text-destructive-foreground",
            "[&_[data-sot-part=dashboard-activity-badge]]:ring-2",
            "[&_[data-sot-part=dashboard-activity-badge]]:ring-card",
        ],
    },
    {
        propertyName: "librarySearchPanel",
        snippets: [
            "absolute right-0 top-[calc(100%+8px)]",
            "z-[var(--z-dropdown)]",
            "w-[460px]",
            "data-[open=true]:pointer-events-auto",
            "border-border",
            "bg-popover",
            "font-sans",
            "text-popover-foreground",
            "shadow-lg",
            "max-[640px]:fixed",
        ],
    },
    {
        propertyName: "dashboardActivityPanel",
        snippets: [
            "border-border",
            "bg-popover",
            "text-popover-foreground",
            "shadow-lg",
        ],
    },
    {
        propertyName: "librarySearchInputRow",
        snippets: [
            "h-[49px] min-h-[49px]",
            "gap-[8px]",
            "px-[12px] py-[8px]",
            "bg-transparent",
            "focus-within:ring-0",
        ],
    },
    {
        propertyName: "librarySearchInput",
        snippets: [
            "h-[32px]",
            "px-[4px] py-0",
            "[font:500_13.5px/1.35_var(--font-sans)]",
            "text-foreground",
            "placeholder:text-muted-foreground",
        ],
    },
    {
        propertyName: "librarySearchScope",
        snippets: [
            "min-h-[39px]",
            "gap-[6px]",
            "px-[12px] py-[8px]",
            "border-b border-border",
            "bg-muted",
        ],
    },
    {
        propertyName: "librarySearchScopeItem",
        snippets: [
            "gap-[4px]",
            "border-transparent bg-transparent",
            "px-[10px]",
            "[font:500_11.5px/1_var(--font-sans)]",
            "text-muted-foreground shadow-none",
            "hover:bg-card hover:text-foreground",
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
            "text-destructive",
            "*:data-[slot=alert-description]:text-destructive",
        ],
    },
    {
        propertyName: "librarySearchErrorTitle",
        snippets: ["line-clamp-none min-h-0", "tracking-normal"],
    },
    {
        propertyName: "librarySearchResult",
        snippets: [
            "h-auto",
            "w-full",
            "flex-col items-start",
            "border-0 bg-transparent",
            "px-[10px] py-[8px]",
            "text-foreground",
            "hover:bg-muted",
            "focus-visible:bg-muted",
            "focus-visible:outline-none",
            "focus-visible:ring-2",
            "focus-visible:ring-ring/50",
        ],
    },
    {
        propertyName: "librarySearchResultTitle",
        snippets: ["[font:600_13px/1.4_var(--font-sans)]", "text-foreground"],
    },
    {
        propertyName: "librarySearchResultMeta",
        snippets: [
            "font-mono",
            "text-[11.5px]",
            "text-muted-foreground",
        ],
    },
    {
        propertyName: "librarySearchTag",
        snippets: [
            "h-[22px] w-fit justify-normal gap-[5px]",
            "rounded-[6px]",
            "border-primary/20",
            "bg-primary/10",
            "text-primary",
            "shadow-xs",
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
        snippets: ["h-6 gap-1", "hover:bg-accent hover:text-accent-foreground"],
    },
    {
        propertyName: "librarySearchScroll",
        snippets: ["min-h-0 flex-1 overflow-y-auto", "pb-[8px]"],
    },
    {
        propertyName: "librarySearchIndexing",
        snippets: [
            "flex items-center gap-[10px]",
            "text-muted-foreground",
        ],
    },
    {
        propertyName: "librarySearchStateSkeleton",
        snippets: [
            "inline-flex h-1",
            "bg-primary/10",
            "after:bg-primary/50",
            "after:animate-[sbn-sweep_1.4s_linear_infinite]",
            "after:content-['']",
        ],
    },
    {
        propertyName: "librarySearchStateCopy",
        snippets: [
            "[font:500_12.5px/1.55_var(--font-sans)]",
            "[&_span]:font-semibold",
        ],
    },
    {
        propertyName: "librarySearchResults",
        snippets: ["flex flex-col"],
    },
    {
        propertyName: "librarySearchResultGroup",
        snippets: [
            "flex flex-col gap-[2px]",
            "px-[4px] py-[6px]",
            "[&+&]:border-t",
            "[&+&]:border-border",
        ],
    },
    {
        propertyName: "librarySearchGroupLabel",
        snippets: [
            "px-[6px] py-[4px]",
            "[font:600_10.5px/1_var(--font-mono)]",
            "uppercase",
            "tracking-[0.08em]",
        ],
    },
    {
        propertyName: "librarySearchHighlight",
        snippets: ["bg-primary/10", "px-[2px]", "text-primary"],
    },
    {
        propertyName: "dashboardActivityClose",
        snippets: [
            "size-[26px]",
            "hover:bg-accent hover:text-accent-foreground",
        ],
    },
    {
        propertyName: "dashboardActivitySync",
        snippets: [
            "data-[action-state=error]:text-destructive",
            "disabled:cursor-not-allowed",
            "has-[>svg]:px-[10px]",
        ],
    },
    {
        propertyName: "dashboardActivityPanel",
        snippets: [
            "absolute right-0 top-[calc(100%+8px)]",
            "z-[var(--z-dropdown)]",
            "w-[380px]",
            "data-[open=true]:pointer-events-auto",
            "max-[640px]:fixed",
        ],
    },
    {
        propertyName: "dashboardActivityHeader",
        snippets: ["flex items-center gap-2.5", "px-3.5 py-3"],
    },
    {
        propertyName: "dashboardActivityHeading",
        snippets: ["flex flex-1 flex-col gap-0.5"],
    },
    {
        propertyName: "dashboardActivityStatus",
        snippets: [
            "flex items-center gap-2.5",
            "bg-muted",
            "data-[state=running]:[&_[data-sot-part=dashboard-activity-status-indicator]]:animate-[bpulse_1.4s_ease-in-out_infinite]",
            "data-[state=running]:[&_[data-sot-part=dashboard-activity-status-indicator]]:bg-primary",
        ],
    },
    {
        propertyName: "dashboardActivityItems",
        snippets: ["max-h-[340px]", "overflow-y-auto", "empty:hidden"],
    },
    {
        propertyName: "dashboardActivityItem",
        snippets: [
            "grid grid-cols-[26px_1fr_auto]",
            "data-[kind=queued]:[&_[data-sot-part=dashboard-activity-item-icon]]:bg-muted",
            "data-[kind=queued]:[&_[data-sot-part=dashboard-activity-item-icon]]:text-muted-foreground",
            "data-[kind=partial-failed]:[&_[data-sot-part=dashboard-activity-item-icon]]:bg-secondary",
            "data-[kind=partial-failed]:[&_[data-sot-part=dashboard-activity-item-icon]]:text-secondary-foreground",
        ],
    },
    {
        propertyName: "dashboardActivityItemIcon",
        snippets: [
            "inline-flex size-[26px]",
            "border border-border",
            "bg-muted",
            "text-muted-foreground",
        ],
    },
    {
        propertyName: "dashboardActivityItemTitle",
        snippets: [
            "[font:600_12.5px/1.35_var(--font-sans)]",
            "text-foreground",
        ],
    },
    {
        propertyName: "dashboardActivityItemMeta",
        snippets: ["[font:500_11px/1.4_var(--font-mono)]", "tracking-[0.02em]"],
    },
    {
        propertyName: "dashboardActivityAction",
        snippets: [
            "data-[action-state=error]:text-destructive",
            "disabled:cursor-not-allowed",
            "has-[>svg]:px-[10px]",
        ],
    },
    {
        propertyName: "dashboardActivityDismiss",
        snippets: [
            "size-[22px]",
            "p-px",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-2",
            "focus-visible:outline-ring",
            "has-[>svg]:p-0",
        ],
    },
    {
        propertyName: "dashboardActivityEmpty",
        snippets: ["p-7 md:p-7", "[&[hidden]]:hidden"],
    },
] as const;

const DASHBOARD_SEARCH_ACTIVITY_SOT_BODY_FORBIDDEN_CLASS_SNIPPETS = [
    {
        propertyName: "librarySearchResultGroup",
        snippets: ["pt-1.5 pb-2 pl-[5px] pr-1"],
    },
    {
        propertyName: "librarySearchGroupLabel",
        snippets: ["pt-[5px] pb-[3px]"],
    },
    {
        propertyName: "librarySearchResult",
        snippets: [
            "min-h-[52px]",
            "pt-[9.5px]",
            "pb-[6.5px]",
            "data-[active=true]:bg-",
            "data-[sot-state=active]:bg-",
        ],
    },
] as const;

const DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_SOURCE_SNIPPETS = [
    "aria-expanded={searchOpen}",
    "aria-expanded={activityOpen}",
    'data-sot-state={searchOpen ? "open" : "idle"}',
    'data-sot-state={activityOpen ? "open" : "idle"}',
    "placeholder={t(",
    '"librarySearch.shortPlaceholder"',
    "dashboardSearchActivityClassNames.librarySearchInput",
] as const;

const DASHBOARD_STATIC_OWNER_STRING_CONSTANTS = [
    "DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME",
    "DASHBOARD_DETAIL_EMPTY_STATE_CLASS_NAME",
    "SOT_DASHBOARD_DETAIL_HEADER_ACTION_ANCHOR_CLASS_NAME",
    "SOT_DASHBOARD_TRANSCRIPT_HEADER_CLASS_NAME",
    "SOT_DASHBOARD_TRANSCRIPT_SEGMENTED_TABS_CLASS_NAME",
    "SOT_DASHBOARD_TRANSCRIPT_BODY_BASE_CLASS_NAME",
] as const;

const DASHBOARD_STATIC_OWNER_OBJECT_CONSTANTS = [
    "dashboardDrawerClassNames",
] as const;

const DASHBOARD_STATIC_OWNER_DEFERRED_TOKEN_AREAS = [
    "dashboardSearchActivityClassNames",
    "dashboardRetranscriptionThemeClassName",
    "dashboardSourceClassNames",
    "sourceFilterStackClassNames",
    "dashboardRecordingRowStyles",
    "dashboardScrollbarClassName",
    "dashboardSyncClassNames",
    "SOT_DASHBOARD_RECORDING_STATUS_BADGE_CLASS",
    "dashboardRetranscriptionClassNames",
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

    it("keeps search indexing progress CSS feature-owned without legacy selectors", () => {
        const productGlobals = readProductGlobals();
        const workstation = readSource("features/dashboard/workstation.tsx");
        const classNames =
            extractDashboardSearchActivityClassNames(workstation);
        const legacySelectorLines = productGlobals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                LIBRARY_SEARCH_INDEXING_LEGACY_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        expect(productGlobals).toContain("@keyframes sbn-sweep");
        for (const selector of MIGRATED_LIBRARY_SEARCH_INDEXING_DATA_SOT_CSS_SELECTORS) {
            expect(productGlobals).not.toContain(selector);
        }
        expect(
            extractObjectStringProperty(
                classNames,
                "librarySearchStateSkeleton",
            ),
        ).toContain("after:animate-[sbn-sweep_1.4s_linear_infinite]");
    });

    it("keeps library search runtime CSS off globals and legacy ls aliases", () => {
        const productGlobals = readProductGlobals();
        const legacySelectorLines = productGlobals
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
            '[data-sot-panel="library-search"] kbd',
        ]) {
            expect(productGlobals).not.toContain(selector);
        }
    });

    it("keeps dashboard search and activity atom CSS out of globals", () => {
        const productGlobals = readProductGlobals();
        const legacySelectorLines = productGlobals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_SEARCH_LEGACY_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of MIGRATED_DASHBOARD_SEARCH_DATA_SOT_CSS_SELECTORS) {
            expect(productGlobals).not.toContain(selector);
        }
        for (const selector of MIGRATED_DASHBOARD_ACTIVITY_DATA_SOT_CSS_SELECTORS) {
            expect(productGlobals).not.toContain(selector);
        }
        for (const selector of DASHBOARD_SEARCH_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(productGlobals).not.toContain(selector);
        }
        for (const selector of DASHBOARD_ACTIVITY_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(productGlobals).not.toContain(selector);
        }
    });

    it("keeps search scoped to backend search and applies result navigation", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain(
            `fetch(\`/api/search?\${params.toString()}\`)`,
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
        const searchResultSlice = extractBoundedSlice(
            workstation,
            'data-sot-control="library-search-result"',
            'data-sot-part="library-search-result-meta"',
        );
        expect(searchResultSlice).toMatch(
            /result\.entityType ===\s*"tag"\s*\?\s*\(\s*<Badge[\s\S]*data-sot-part="library-search-tag-chip"/,
        );
        expect(searchResultSlice).toMatch(
            /\)\s*:\s*\(\s*<span[\s\S]*className=\{\s*dashboardSearchActivityClassNames\.librarySearchResultTitle\s*\}[\s\S]*data-sot-part="library-search-result-title"/,
        );
        expect(searchResultSlice).not.toMatch(
            /<span[\s\S]*data-sot-part="library-search-result-title"[\s\S]*<Badge[\s\S]*data-sot-part="library-search-tag-chip"[\s\S]*<\/span>/,
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
            '<Button\n                            asChild\n                            variant="ghost"',
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
        for (const {
            propertyName,
            snippets,
        } of DASHBOARD_SEARCH_ACTIVITY_SOT_BODY_FORBIDDEN_CLASS_SNIPPETS) {
            const property = extractObjectStringProperty(
                classNames,
                propertyName,
            );

            for (const snippet of snippets) {
                expect(property).not.toContain(snippet);
            }
        }

        for (const snippet of DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_SOURCE_SNIPPETS) {
            expect(workstation).toContain(snippet);
        }
    });

    it("keeps dashboard static-owner surface classes named and token-safe for phase 1", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).not.toContain("text-white");
        expect(workstation).toContain(
            "className={DASHBOARD_DETAIL_EMPTY_STATE_CLASS_NAME}",
        );
        expect(workstation).toContain(
            "className={dashboardDrawerClassNames.scrim}",
        );
        expect(workstation).toContain(
            "className={dashboardDrawerClassNames.menuIcon}",
        );
        expect(workstation).toContain(
            "className={dashboardDrawerClassNames.activeDot}",
        );
        expect(workstation).toContain(
            "className={DASHBOARD_RECORDING_LIST_CARD_CLASS_NAME}",
        );
        expect(workstation).toMatch(
            /className=\{\s*DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME\s*\}/,
        );
        expect(workstation).toContain(
            "SOT_DASHBOARD_DETAIL_HEADER_ACTION_ANCHOR_CLASS_NAME",
        );
        expect(workstation).toMatch(
            /className=\{\s*SOT_DASHBOARD_TRANSCRIPT_HEADER_CLASS_NAME\s*\}/,
        );
        expect(workstation).toContain(
            "SOT_DASHBOARD_TRANSCRIPT_SEGMENTED_TABS_CLASS_NAME",
        );
        expect(workstation).toContain(
            "SOT_DASHBOARD_TRANSCRIPT_BODY_BASE_CLASS_NAME",
        );
        for (const inlineClass of [
            'className="min-h-[280px] p-9 md:p-9"',
            'className="pointer-events-none fixed inset-0 z-[var(--z-drawer-scrim)]',
            'className="pointer-events-none absolute top-1/2 left-1/2 size-4',
            'className="absolute top-1.5 right-1.5 hidden size-1.5',
            'className="flex min-h-0 flex-col p-0"',
            'className="relative inline-flex items-center gap-1.5"',
            'className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1.5 border-b',
            'className="shrink-0"',
        ]) {
            expect(workstation).not.toContain(inlineClass);
        }

        for (const constName of DASHBOARD_STATIC_OWNER_STRING_CONSTANTS) {
            expect(extractConstString(workstation, constName)).not.toMatch(
                /dark:|rgb\(|color-mix\(/,
            );
        }
        for (const constName of DASHBOARD_STATIC_OWNER_OBJECT_CONSTANTS) {
            expect(extractConstObject(workstation, constName)).not.toMatch(
                /dark:|rgb\(|color-mix\(/,
            );
        }
    });

    it("keeps favorite labels and provider display wired through owner helpers", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const favoritesDefinition = extractBoundedSlice(
            workstation,
            "const FAVORITES",
            "const TIMELINE_FILTERS",
        );
        const favoritesNavSlice = extractBoundedSlice(
            workstation,
            "{FAVORITES.map((item) => {",
            "{sourceRows.map((item) => {",
        );
        const sourceRowsSlice = extractBoundedSlice(
            workstation,
            "const sourceRows = useMemo",
            "const selectedSourceRow = useMemo",
        );
        const recordingRowsSlice = extractBoundedSlice(
            workstation,
            "group.entries.map(",
            "<SotDashboardRecordingStatusBadge",
        );

        expect(favoritesDefinition).not.toContain("label:");
        expect(favoritesNavSlice).toContain(
            "{getFavoriteLabel(item.value, t)}",
        );
        expect(favoritesNavSlice).not.toContain("item.label");
        expect(workstation).toContain("function providerLabel(");
        expect(workstation).toContain(
            "getSourceProviderLabel(provider, language)",
        );
        expect(sourceRowsSlice).toContain(
            "label: providerLabel(item.key, language)",
        );
        expect(recordingRowsSlice).toContain("sourceDefinition(");
        expect(recordingRowsSlice).toContain("title={providerLabel(");
        expect(recordingRowsSlice).not.toContain("SOURCE_ORDER.find(");
        expect(recordingRowsSlice).not.toContain("sourceMeta.label");
    });

    it("classifies remaining manual dashboard token areas as deferred owner work", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        for (const ownerName of DASHBOARD_STATIC_OWNER_DEFERRED_TOKEN_AREAS) {
            expect(workstation).toContain(ownerName);
        }
    });

    it("keeps search and activity business tokens out of shadcn primitives", () => {
        const primitiveBusinessTokens = SEARCH_ACTIVITY_PRIMITIVE_FILES.flatMap(
            (file) =>
                (
                    readSource(file).match(SEARCH_ACTIVITY_BUSINESS_TOKEN_RE) ??
                    []
                )
                    .sort()
                    .map((token) => `${file}:${token}`),
        );

        expect(primitiveBusinessTokens).toEqual([]);
    });
});
