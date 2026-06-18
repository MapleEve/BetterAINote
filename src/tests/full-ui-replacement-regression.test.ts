import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(process.cwd(), "src");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function extractCardSlice(source: string, marker: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf("<Card", markerIndex);
    const end = source.indexOf("</Card>", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + "</Card>".length);
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

function collectSourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectSourceFiles(entryPath);
        return /\.(css|ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    });
}

function readProductCss(source: string) {
    const componentLibraryIndex = source.indexOf(
        "BetterAINote · Component Library",
    );
    expect(componentLibraryIndex).toBeGreaterThan(0);
    return source.slice(0, componentLibraryIndex);
}

function stripCssComments(source: string) {
    return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractCssBlock(source: string, marker: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const openBraceIndex = source.indexOf("{", markerIndex);
    expect(openBraceIndex).toBeGreaterThan(markerIndex);

    let depth = 0;
    for (let index = openBraceIndex; index < source.length; index += 1) {
        const character = source[index];
        if (character === "{") {
            depth += 1;
        } else if (character === "}") {
            depth -= 1;
            if (depth === 0) {
                return source.slice(openBraceIndex + 1, index);
            }
        }
    }

    throw new Error(`Unclosed CSS block: ${marker}`);
}

function collectCssRuleBlocks(source: string, selectorFragment: string) {
    const blocks: Array<{ prelude: string; declarations: string }> = [];
    let searchFrom = 0;

    while (searchFrom < source.length) {
        const selectorIndex = source.indexOf(selectorFragment, searchFrom);
        if (selectorIndex < 0) break;

        const openBraceIndex = source.indexOf("{", selectorIndex);
        if (openBraceIndex < 0) break;

        const previousCloseBraceIndex = source.lastIndexOf("}", selectorIndex);
        const previousOpenBraceIndex = source.lastIndexOf("{", selectorIndex);
        const preludeStart =
            previousOpenBraceIndex > previousCloseBraceIndex
                ? previousOpenBraceIndex + 1
                : previousCloseBraceIndex + 1;
        const prelude = source.slice(preludeStart, openBraceIndex);

        if (prelude.includes(selectorFragment)) {
            blocks.push({
                prelude,
                declarations: extractCssBlock(
                    source.slice(selectorIndex),
                    selectorFragment,
                ),
            });
        }

        searchFrom = openBraceIndex + 1;
    }

    return blocks;
}

function collectExactCssRuleBlocks(source: string, selector: string) {
    return collectCssRuleBlocks(source, selector).filter(({ prelude }) =>
        prelude
            .split(",")
            .map((selectorPart) => selectorPart.trim())
            .includes(selector),
    );
}

function extractCssBlockRange(source: string, marker: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const openBraceIndex = source.indexOf("{", markerIndex);
    expect(openBraceIndex).toBeGreaterThan(markerIndex);

    let depth = 0;
    for (let index = openBraceIndex; index < source.length; index += 1) {
        const character = source[index];
        if (character === "{") {
            depth += 1;
        } else if (character === "}") {
            depth -= 1;
            if (depth === 0) {
                return {
                    startLine: source.slice(0, markerIndex).split("\n").length,
                    endLine: source.slice(0, index).split("\n").length,
                };
            }
        }
    }

    throw new Error(`Unclosed CSS block: ${marker}`);
}

function cssLineProperty(lines: string[], index: number) {
    for (let cursor = index; cursor >= 0; cursor -= 1) {
        const line = lines[cursor];
        const declaration = line.match(/^\s*([\w-]+|--[\w-]+)\s*:/);
        if (declaration) return declaration[1];
        if (/^\s*[.#:@[]?[\w-]/.test(line) && line.includes("{")) break;
    }
    return null;
}

function isLineInside(
    line: number,
    range: { startLine: number; endLine: number },
) {
    return line >= range.startLine && line <= range.endLine;
}

function expectTokenOklchFallbackOrder(source: string, marker: string) {
    const block = extractCssBlock(source, marker);
    const lines = block.split("\n");
    const missingFallbacks: string[] = [];

    for (const [index, line] of lines.entries()) {
        const match = line.match(/^\s*(--[\w-]+):\s*(oklch\(|color-mix\()/);
        if (!match) continue;

        const fallback = lines[index - 1]?.trim() ?? "";
        const hasSameTokenFallback = fallback.startsWith(`${match[1]}:`);
        const hasRgbFallback =
            /\brgba?\(/.test(fallback) || /\brgb\(/.test(fallback);

        if (!hasSameTokenFallback || !hasRgbFallback) {
            missingFallbacks.push(
                `${marker} ${match[1]} lacks immediate rgb/rgba fallback`,
            );
        }
    }

    expect(missingFallbacks).toEqual([]);
}

type ColorDeclarationFinding = {
    line: number;
    property: string | null;
    text: string;
};

const MODERN_COLOR_RE = /\b(oklch|color-mix)\(/;

const CSS_SUPPORTED_PATH_COLOR_PROPERTIES = new Set([
    "background",
    "border",
    "border-bottom",
    "border-bottom-color",
    "border-color",
    "box-shadow",
    "color",
    "outline",
    "scrollbar-color",
    "text-decoration-color",
]);

const LEGACY_MODAL_SHELL_PRODUCT_CSS_SELECTOR_RE =
    /(^|[,\s>{])\.(?:scrim|modal|modal-head|modal-icon|modal-title|modal-desc|modal-body|modal-foot)(?![\w-])/m;

const LEGACY_MONO_PRODUCT_CSS_SELECTOR_RE = /(^|[,\s>{])\.mono(?![\w-])/m;

const LEGACY_DESIGN_TWEAKS_PRODUCT_CSS_SELECTOR_RE =
    /#tweaks-(?:panel|close)|--(?:ds-only-accent|todo-marker-bg|z-tweaks)\b|(^|[,\s>{])\.(?:design-todo|ds-only-(?:badge|mark|note)|ds-trigger-chip|tw-[\w-]+|src-item|src-hint(?:-email)?|cl-tweaks-mock|cl-tm-[\w-]+)(?![\w-])/m;

const UNAPPROVED_PRODUCT_CSS_CLASS_SELECTOR_RE =
    /(^|[,\s>{(:])\.(?!dark(?:[\s,:[>{]|$))[A-Za-z][\w-]*(?![\w-])/m;

const MODAL_SHELL_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-overlay="settings-shell"]',
    '[data-sot-overlay="confirm-dialog"]',
    '[data-sot-overlay="settings-shell"][data-state="open"]',
    '[data-sot-overlay="confirm-dialog"][data-state="closed"]',
    '[data-sot-surface="settings-shell"],',
    '[data-sot-content="confirm-dialog"]',
    '[data-sot-surface="settings-shell"][data-state="closed"]',
    '[data-sot-content="confirm-dialog"][data-state="closed"]',
    '[data-sot-surface="settings-shell"] [data-slot="dialog-header"]',
    '[data-sot-content="confirm-dialog"] [data-slot="dialog-header"]',
    '[data-sot-part="dialog-icon"]',
    '[data-sot-surface="settings-shell"] [data-slot="dialog-title"]',
    '[data-sot-content="confirm-dialog"] [data-slot="dialog-description"]',
    '[data-sot-surface="settings-shell"] [data-slot="dialog-footer"]',
    '[data-sot-part="confirm-head"]',
    '[data-sot-part="confirm-body"]',
    '[data-sot-part="confirm-foot"]',
] as const;

const DELETE_CONFIRM_MODAL_EXTRAS_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /(^|[,\s>{])\.(?:del-modal-icon|del-modal-name)(?![\w-])/m;

const DELETE_CONFIRM_MODAL_EXTRAS_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-content="confirm-dialog"] [data-sot-part="dialog-icon"]',
    '[data-sot-part="confirm-extra"]',
    '[data-sot-item="confirm-dialog-detail"]',
    '[data-sot-part="confirm-warning"]',
] as const;

const CONFIRM_DIALOG_BUTTON_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|letter-spacing|line-height|padding|transition)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

const DASHBOARD_RECORDING_LIST_REPLACED_LEGACY_CLASSES = [
    "day-label",
    "rec-row",
    "rec-thumb",
    "rec-body",
    "rec-title",
    "rec-meta",
    "tag",
    "tag-filter",
    "tag-filter-trigger",
    "tag-filter-label",
    "tag-filter-count",
    "tag-filter-caret",
    "tag-filter-list",
    "tag-filter-option",
    "tag-filter-option-label",
    "tag-filter-option-count",
    "list-scroll",
    "ls-group",
    "day",
    "d",
    "c",
    "line",
    "list-state-block",
    "list-state-pagination",
    "lsb-ico",
    "lsb-t",
    "lsb-h",
    "lsb-page-divider",
    "lsb-page-nav",
    "lsb-page-num",
];

const DASHBOARD_RECORDING_LIST_REPLACEMENT_HOOKS = [
    'data-sot-surface="dashboard-recording-list"',
    'data-sot-part="dashboard-recording-list-content"',
    'data-sot-part="dashboard-recording-list-header"',
    'data-sot-part="dashboard-recording-list-titlebar"',
    'data-sot-part="dashboard-recording-list-title"',
    'data-sot-part="dashboard-recording-list-count"',
    'data-sot-control="recording-list-tag-filter-trigger"',
    'data-sot-part="recording-list-tag-filter-label"',
    'data-sot-part="recording-list-tag-filter-count"',
    'data-sot-part="recording-list-tag-filter-caret"',
    'data-sot-list="recording-list-tag-filter-list"',
    'data-sot-part="recording-list-tag-filter-option-label"',
    'data-sot-part="recording-list-tag-filter-option-count"',
    'data-sot-list="dashboard-recording-list-scroll"',
    'data-sot-part="dashboard-recording-list-group"',
    'data-sot-part="dashboard-recording-list-group-heading"',
    'data-sot-part="dashboard-recording-list-group-label"',
    'data-sot-part="dashboard-recording-list-group-count"',
    'data-sot-part="dashboard-recording-list-group-divider"',
    'data-sot-control="dashboard-recording-row"',
    'data-sot-part="dashboard-recording-source-mark"',
    'data-sot-part="dashboard-recording-row-body"',
    'data-sot-part="dashboard-recording-row-title"',
    'data-sot-part="dashboard-recording-row-meta"',
    "data-recording-tag-chip",
    'data-sot-part="recording-list-state-icon"',
    'data-sot-part="recording-list-state-title"',
    'data-sot-part="recording-list-state-description"',
    'data-sot-part="recording-list-page-divider"',
    'data-sot-part="recording-list-page-nav"',
    'data-sot-part="recording-list-page-number"',
];

const DASHBOARD_RECORDING_LIST_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:day-label|rec-row|rec-thumb|rec-body|rec-title|rec-meta|tag|sidebar-footer|card|card-h|card-sub|frame|list-state-block|lsb-ico|lsb-t|lsb-h|lsb-page-divider|lsb-page-nav|lsb-page-num)(?![\w-])/;

const DASHBOARD_RECORDING_LIST_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-surface="dashboard-recording-list"]',
    '[data-sot-part="dashboard-recording-list-header"]',
    '[data-sot-part="dashboard-recording-list-titlebar"]',
    '[data-sot-part="dashboard-recording-list-title"]',
    '[data-sot-part="dashboard-recording-list-count"]',
    '[data-sot-list="dashboard-recording-list-scroll"]',
    '[data-sot-list="dashboard-recording-rows"]',
    '[data-sot-part="dashboard-recording-list-group"]',
    '[data-sot-part="dashboard-recording-list-group-heading"]',
    '[data-sot-part="dashboard-recording-list-group-label"]',
    '[data-sot-part="dashboard-recording-list-group-count"]',
    '[data-sot-part="dashboard-recording-list-group-divider"]',
    '[data-sot-control="dashboard-recording-row"]',
    '[data-sot-control="dashboard-recording-row"]:hover',
    '[data-sot-control="dashboard-recording-row"][data-sot-state="selected"]',
    '[data-sot-part="dashboard-recording-source-mark"]',
    '[data-sot-part="dashboard-recording-row-body"]',
    '[data-sot-part="dashboard-recording-row-title"]',
    '[data-sot-part="dashboard-recording-row-meta"]',
    "[data-recording-tag-chip]",
    '[data-sot-part="dashboard-sidebar-footer"]',
    "[data-sot-card]",
    '[data-sot-card="auth"]',
    '[data-sot-card="onboarding"]',
    "[data-sot-frame]",
    '[data-sot-frame="auth"]',
    '[data-sot-frame="onboarding"]',
    '[data-sot-part="card-heading"]',
    '[data-sot-part="card-sub"]',
    '[data-sot-part="recording-list-state"]',
    '[data-sot-panel="recording-list-pagination"]',
    '[data-sot-part="recording-list-state-icon"]',
    '[data-sot-part="recording-list-state-icon"] svg',
    '[data-sot-part="recording-list-state-title"]',
    '[data-sot-part="recording-list-state-description"]',
    '[data-sot-part="recording-list-page-divider"]',
    '[data-sot-part="recording-list-page-status"]',
    '[data-sot-part="recording-list-page-nav"]',
    '[data-sot-part="recording-list-page-number"]',
];

const DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_SELECTORS = [
    '[data-sot-surface="dashboard-recording-list"][data-slot="card"]',
    '[data-sot-part="dashboard-recording-list-content"][data-slot="card-content"]',
    '[data-sot-control="source-filter-clear"][data-slot="button"]',
    '[data-sot-control="source-filter-clear-all"][data-slot="button"]',
    '[data-sot-control="library-search-filter-clear"][data-slot="button"]',
    '[data-sot-control="recording-list-tag-filter-trigger"][data-slot="button"]',
    '[data-sot-control="recording-list-tag-filter"][data-slot="button"]',
    '[data-sot-panel="recording-list-pagination"] [data-slot="button"]',
    '[data-sot-panel="recording-list-pagination"] [data-slot="button"]:disabled',
] as const;

const DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_RE =
    /\[data-sot-surface="dashboard-recording-list"\]\[data-slot="card"\]|\[data-sot-part="dashboard-recording-list-content"\]\[data-slot="card-content"\]|\[data-sot-control="(?:source-filter-clear|source-filter-clear-all|library-search-filter-clear|recording-list-tag-filter-trigger|recording-list-tag-filter)"\]\[data-slot="button"\]|\[data-sot-panel="recording-list-pagination"\][\s\S]{0,80}\[data-slot="button"\]/;

const LIBRARY_SEARCH_LEGACY_PRODUCT_CSS_CLASSES = [
    "ls-anchor",
    "ls-panel",
    "ls-trigger",
    "ls-input",
    "ls-input-row",
    "ls-clear",
    "ls-scope",
    "ls-chip",
    "ls-body",
    "ls-section",
    "ls-section-label",
    "ls-result",
    "ls-group",
    "ls-group-label",
    "ls-item",
    "ls-item-title",
    "ls-item-meta",
    "ls-hint",
    "ls-empty",
    "ls-loading",
    "ls-state",
    "ls-error",
    "ls-tail",
    "inline-progress",
    "ls-state-indexing",
];

const LIBRARY_SEARCH_LEGACY_PRODUCT_CSS_SELECTOR_RE = new RegExp(
    `\\.(${LIBRARY_SEARCH_LEGACY_PRODUCT_CSS_CLASSES.join("|")})(?![\\w-])`,
);

const LIBRARY_SEARCH_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-part="library-search-anchor"]',
    '[data-sot-panel="library-search"]',
    '[data-sot-panel="library-search"][data-open="true"]',
    '[data-sot-panel="library-search"] kbd',
    '[data-sot-region="library-search-scroll"]',
    '[data-sot-part="library-search-indexing"]',
    '[data-sot-part="library-search-loading"]',
    '[data-sot-part="library-search-empty"]',
    '[data-sot-part="library-search-state-skeleton"]',
    '[data-sot-part="library-search-state-copy"]',
    '[data-sot-list="library-search-results"]',
    '[data-sot-group="library-search-results"]',
    '[data-sot-part="library-search-group-label"]',
    '[data-sot-control="library-search-result"] mark',
];

const LIBRARY_SEARCH_PRIMITIVE_REPAINT_CSS_SELECTORS = [
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

const DASHBOARD_TOPBAR_SOURCE_STATUS_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:src-dot|dot-success|dot-warning|dot-info|dot-muted|dot|search|avatar)(?![\w-])/;

const TOPBAR_LEGACY_PRODUCT_CSS_SELECTOR_RE = /(^|[,\s>])\.topbar(?![\w-])/m;

const DASHBOARD_DETAIL_HEADER_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:detail|rec-head|rec-h2|rec-h2-status|rec-h2-local|rec-h2-input|rh-edit|rh-norm|real-detail|ai-rename-anchor)(?![\w-])/;

const TOPBAR_DATA_SOT_PRODUCT_CSS_SELECTORS = [
    '[data-sot-panel="dashboard-topbar"]',
    '[data-sot-panel="route-topbar"]',
    '[data-sot-panel="workstation-topbar"]',
    '[data-sot-panel="library-search"]',
] as const;

const DASHBOARD_TOPBAR_SOURCE_STATUS_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-control="dashboard-source-provider"]',
    '[data-sot-part="source-provider-mark"]',
    '[data-sot-part="source-provider-status"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="syncing"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="sync-error"]',
];

const DASHBOARD_SHELL_NAV_PRIMITIVE_REPAINT_SELECTORS = [
    '[data-sot-control="sidebar-collapse"][data-slot="button"]',
    '[data-sot-control="dashboard-favorite"][data-slot="button"]',
    '[data-sot-control="dashboard-source-provider"][data-slot="button"]',
    '[data-sot-control="dashboard-sync"][data-slot="button"]',
    '[data-sot-control="dashboard-settings"][data-slot="button"]',
    '[data-sot-control="dashboard-settings"][data-sot-part="dashboard-user-avatar"]',
] as const;

const DASHBOARD_SOURCE_PROVIDER_DIRECT_STATE_SELECTORS = [
    '[data-sot-control="dashboard-source-provider"][data-sot-state="connected-active"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="connected-idle"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="syncing"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="expired"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="sync-error"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="no-results"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="needs-setup"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="disabled"]',
] as const;

const AUTH_ONBOARDING_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:field-help|auth-sot-canvas|onboarding-sot-canvas|auth-mark|auth-title|auth-sub|auth-local-row|auth-local-link|onboarding-progress|onboarding-progress-segment|onboarding-actions)(?![\w-])/;

const LIQUID_TABS_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:liquid-tabs|lt-ind|lt-tab)(?![\w-])/;

const LIQUID_TABS_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-control="liquid-tabs"][data-slot="segmented-tabs"]',
    '[data-sot-control="liquid-tabs"][data-slot="segmented-tabs"][data-sot-size="sm"]',
    '[data-sot-part="liquid-tabs-indicator"]',
    '[data-sot-control="liquid-tab"]',
    '[data-sot-control="liquid-tab"][data-sot-state="active"]',
    '[data-sot-control="liquid-tabs"][data-tabs="3"]',
    '[data-sot-control="liquid-tabs"][data-idx="2"]',
];

const SYSTEM_BANNER_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:sys-banner|sbn-(?:ico|body|title|sub|actions|progress|bar))(?![\w-])/;

const SYSTEM_BANNER_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-panel="system-banner"]',
    '[data-sot-panel="system-banner"] + [data-sot-panel="system-banner"]',
    '[data-sot-part="system-banner-icon"]',
    '[data-sot-part="system-banner-body"]',
    '[data-sot-part="system-banner-title"]',
    '[data-sot-part="system-banner-description"]',
    '[data-sot-part="system-banner-description"][data-sot-format="mono"]',
    '[data-sot-part="system-banner-actions"]',
    '[data-sot-panel="system-banner"][data-kind="offline"]',
    '[data-sot-panel="system-banner"][data-kind="permission-denied"]',
    '[data-sot-panel="system-banner"][data-kind="db-locked"]',
    '[data-sot-panel="system-banner"][data-kind="update-available"]',
    '[data-sot-panel="system-banner"][data-kind="import-progress"]',
    '[data-sot-panel="system-banner"][data-kind="export-progress"]',
    '[data-sot-part="system-banner-progress"]',
    '[data-sot-part="system-banner-progress-bar"]',
    '[data-sot-part="system-banner-progress"][data-sot-state="indeterminate"]',
];

const MORE_ACTIONS_MENU_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:more-anchor|more-head|more-action(?:-[\w-]+)?|more-menu(?:-(?:item(?:-shortcut)?|sep|label|hint))?)(?![\w-])/;

const MORE_ACTIONS_MENU_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-menu="recording-more-actions"]',
    '[data-sot-menu="recording-more-actions"][data-open="true"]',
    '[data-sot-menu="recording-more-actions"][data-state="open"]',
    '[data-sot-menu="recording-more-actions"] svg',
    "[data-sot-menu-item]",
    "[data-sot-menu-item]:hover",
    "[data-sot-menu-item]:focus-visible",
    "[data-sot-menu-item]:active",
    "[data-sot-menu-item] svg",
    '[data-sot-menu-item][data-sot-tone="danger"]',
    '[data-sot-menu-item][data-sot-tone="success"]',
    "[data-sot-menu-item] [data-sot-menu-hint]",
    "[data-sot-menu-separator]",
    "[data-sot-menu-label]",
];

const SOT_SCROLLBAR_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:tx-body|shortcuts-list)(?![\w-])/;

const SOT_SCROLLBAR_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-list="dashboard-recording-list-scroll"]',
    '[data-sot-part="dashboard-transcript-body"]',
    '[data-sot-part="recording-transcription-body"]',
    '[data-sot-panel="settings-body"]',
    '[data-sot-list="dashboard-recording-list-scroll"]::-webkit-scrollbar',
    '[data-sot-part="dashboard-transcript-body"]::-webkit-scrollbar',
    '[data-sot-part="recording-transcription-body"]::-webkit-scrollbar',
    '[data-sot-panel="settings-body"]::-webkit-scrollbar',
    '[data-sot-list="dashboard-recording-list-scroll"]::-webkit-scrollbar-thumb:hover',
    '[data-sot-panel="settings-body"]::-webkit-scrollbar-thumb:hover',
];

const TAB_PANE_HIDDEN_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /(^|\n|,)\s*\.t-pane\[hidden\]/;

const TAB_PANE_HIDDEN_DATA_SOT_CSS_SELECTORS = [
    "[data-sot-tab-pane][hidden]",
] as const;

const DASHBOARD_TIME_FILTER_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:filter-row|chip|chip-f|chip-c)(?![\w-])/;

const DASHBOARD_TIME_FILTER_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-panel="dashboard-recording-time-filter"][hidden]',
    '[data-sot-part="dashboard-recording-time-filter-count"]',
    '[data-sot-control="dashboard-recording-time-filter"][data-sot-state="selected"]',
];

const DASHBOARD_TIME_FILTER_PRIMITIVE_REPAINT_CSS_SELECTORS = [
    '[data-sot-panel="dashboard-recording-time-filter"][data-slot="toggle-group"]',
    '[data-sot-control="dashboard-recording-time-filter"][data-slot="toggle-group-item"]',
    '[data-sot-control="dashboard-recording-time-filter"][data-slot="toggle-group-item"]:hover',
    '[data-sot-control="dashboard-recording-time-filter"][data-slot="toggle-group-item"][data-sot-state="selected"]',
    '[data-sot-control="dashboard-recording-time-filter"]:focus-visible',
    '[data-sot-control="dashboard-recording-time-filter"][disabled]',
] as const;

const COPY_ICON_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:copy-ico|copy-ico-default|copy-ico-ok)(?![\w-])/;

const COPY_ICON_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-part="source-report-copy-icon"]',
    '[data-sot-part="dashboard-copy-icon"]',
    '[data-sot-control="copy-local-transcript"][hidden]',
    '[data-sot-control="copy-source-transcript"][hidden]',
    '[data-sot-control="copy-source-report"][hidden]',
];

const COPY_BUTTON_GLOBAL_APPEARANCE_PROPERTIES = [
    "background",
    "border-color",
    "color",
    "cursor",
    "opacity",
];

const DASHBOARD_TRANSCRIPT_ACTIONS_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.lang-pill(?![\w-])/;

const DASHBOARD_TRANSCRIPT_ACTIONS_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-part="dashboard-transcript-actions"]',
    '[data-sot-part="dashboard-copy-label"]',
    '[data-sot-part="dashboard-copy-icon"]',
];

const DASHBOARD_TRANSCRIPT_ACTIONS_DATA_SOT_HOOKS = [
    'data-sot-part="dashboard-transcript-actions"',
    'data-sot-part="dashboard-transcript-language"',
    'data-sot-part="dashboard-copy-label"',
    'data-sot-part="dashboard-copy-icon"',
];

const DETAIL_EMPTY_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:detail-empty(?:-(?:ico|title|sub))?)(?![\w-])/;

const DETAIL_EMPTY_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-panel="dashboard-detail-empty"]',
    '[data-sot-panel="recording-source-record-empty"]',
    '[data-sot-panel="recording-route-empty"]',
    '[data-sot-panel="dashboard-detail"][data-empty="true"] [data-detail-empty]',
    '[data-sot-panel="recording-route-empty-detail"][data-empty="true"]\n    [data-detail-empty]',
    '[data-sot-part="dashboard-detail-empty-icon"]',
    '[data-sot-part="recording-route-empty-icon"]',
    '[data-sot-part="dashboard-detail-empty-title"]',
    '[data-sot-part="recording-route-empty-title"]',
    '[data-sot-part="dashboard-detail-empty-description"]',
    '[data-sot-part="recording-route-empty-description"]',
];

function splitVarArguments(content: string) {
    let depth = 0;
    for (let index = 0; index < content.length; index += 1) {
        const character = content[index];
        if (character === "(") depth += 1;
        if (character === ")") depth -= 1;
        if (character === "," && depth === 0) {
            return [
                content.slice(0, index).trim(),
                content.slice(index + 1).trim(),
            ];
        }
    }
    return [content.trim()];
}

function collectVarFallbackArguments(line: string) {
    const fallbacks: string[] = [];
    let searchFrom = 0;

    while (searchFrom < line.length) {
        const varIndex = line.indexOf("var(", searchFrom);
        if (varIndex < 0) break;

        let depth = 1;
        let cursor = varIndex + "var(".length;
        for (; cursor < line.length; cursor += 1) {
            const character = line[cursor];
            if (character === "(") depth += 1;
            if (character === ")") {
                depth -= 1;
                if (depth === 0) break;
            }
        }

        if (depth !== 0) break;

        const [, fallback] = splitVarArguments(
            line.slice(varIndex + "var(".length, cursor),
        );
        if (fallback) fallbacks.push(fallback);
        searchFrom = cursor + 1;
    }

    return fallbacks;
}

function isSafeColorFallbackArgument(argument: string) {
    return /^(#[\da-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|transparent|white|black)$/i.test(
        argument.trim(),
    );
}

function collectGlobalColorFallbackFindings(source: string) {
    const lines = source.split("\n");
    const rootRange = extractCssBlockRange(source, ":root");
    const darkRange = extractCssBlockRange(
        source,
        '.dark,\n[data-theme="dark"]',
    );
    const fallbackOnlyRange = extractCssBlockRange(
        source,
        "@supports not (color: oklch(",
    );
    const tokenModernColorDeclarations: ColorDeclarationFinding[] = [];
    const fallbackOnlyModernColorDeclarations: ColorDeclarationFinding[] = [];
    const nonTokenSupportedPathDeclarations: ColorDeclarationFinding[] = [];
    const unexpectedSupportedPathDeclarations: ColorDeclarationFinding[] = [];
    const unsafeVarFallbackArguments: Array<
        ColorDeclarationFinding & { fallback: string }
    > = [];

    for (const [index, line] of lines.entries()) {
        if (!MODERN_COLOR_RE.test(line)) continue;

        const lineNumber = index + 1;
        if (/^\s*@supports\s+not\s+\(color:\s*oklch\(/.test(line)) {
            continue;
        }

        const property = cssLineProperty(lines, index);
        const finding = { line: lineNumber, property, text: line.trim() };
        const isTokenDeclaration =
            property?.startsWith("--") &&
            (isLineInside(lineNumber, rootRange) ||
                isLineInside(lineNumber, darkRange));

        if (isTokenDeclaration) {
            tokenModernColorDeclarations.push(finding);
        } else if (isLineInside(lineNumber, fallbackOnlyRange)) {
            fallbackOnlyModernColorDeclarations.push(finding);
        } else {
            nonTokenSupportedPathDeclarations.push(finding);
            if (
                !property ||
                !CSS_SUPPORTED_PATH_COLOR_PROPERTIES.has(property)
            ) {
                unexpectedSupportedPathDeclarations.push(finding);
            }
        }

        for (const fallback of collectVarFallbackArguments(line)) {
            if (
                MODERN_COLOR_RE.test(fallback) ||
                !isSafeColorFallbackArgument(fallback)
            ) {
                unsafeVarFallbackArguments.push({ ...finding, fallback });
            }
        }
    }

    return {
        tokenModernColorDeclarations,
        fallbackOnlyModernColorDeclarations,
        nonTokenSupportedPathDeclarations,
        unexpectedSupportedPathDeclarations,
        unsafeVarFallbackArguments,
    };
}

function listSourceFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...listSourceFiles(fullPath));
        } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

function collectInlineModernColorFindings() {
    const tagVisualsPath =
        "features/recordings/components/recording-tag-visuals.tsx";
    const catalogSwatches: string[] = [];
    const unexpectedModernColorLines: Array<{
        file: string;
        line: number;
        text: string;
    }> = [];
    const unexpectedTagSwatchCalls: Array<{ line: number; text: string }> = [];

    for (const filePath of listSourceFiles(ROOT)) {
        const relativePath = path
            .relative(ROOT, filePath)
            .split(path.sep)
            .join("/");
        if (relativePath.startsWith("tests/")) continue;

        const lines = readFileSync(filePath, "utf8").split("\n");
        for (const [index, line] of lines.entries()) {
            if (!MODERN_COLOR_RE.test(line)) continue;

            const catalogMatch = line.match(
                /^\s*(red|orange|green|blue|purple|slate): tagSwatchStyle\("oklch\([^)]+\)"\),$/,
            );
            if (relativePath === tagVisualsPath && catalogMatch) {
                catalogSwatches.push(catalogMatch[1]);
            } else {
                unexpectedModernColorLines.push({
                    file: `src/${relativePath}`,
                    line: index + 1,
                    text: line.trim(),
                });
            }
        }
    }

    const tagVisualLines = readSource(tagVisualsPath).split("\n");
    for (const [index, line] of tagVisualLines.entries()) {
        if (!line.includes("tagSwatchStyle(")) continue;
        if (/^\s*function tagSwatchStyle\(/.test(line)) continue;
        if (
            !/^\s*(red|orange|green|blue|purple|slate): tagSwatchStyle\("oklch\([^)]+\)"\),$/.test(
                line,
            )
        ) {
            unexpectedTagSwatchCalls.push({
                line: index + 1,
                text: line.trim(),
            });
        }
    }

    return {
        catalogSwatches,
        unexpectedModernColorLines,
        unexpectedTagSwatchCalls,
    };
}

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const SOURCE_REPORT_LEGACY_SURFACE_RE =
    /uikit-|glass-surface|glass-control|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE =
    /className=["']btn(?:\s+(?:ghost|primary|glass))?\b|track-fill|track-thumb|sk _is|_is-/;

const DASHBOARD_DETAIL_PANE_SOT_HOOKS = [
    'data-sot-panel="dashboard-transcript-pane"',
    'data-sot-tab-pane="transcript"',
    'data-sot-tab-pane="source-report"',
    'data-sot-tab-pane="speakers"',
    'data-sot-part="dashboard-transcript-actions"',
    'data-sot-part="dashboard-copy-label"',
    'data-sot-part="dashboard-transcript-avatar"',
    'data-sot-list="dashboard-speaker-rows"',
    'data-sot-item="dashboard-speaker-row"',
    'data-sot-part="dashboard-speaker-avatar"',
    'data-sot-part="dashboard-speaker-row-meta"',
    'data-sot-part="dashboard-speaker-name"',
    'data-sot-part="dashboard-speaker-sub"',
    'data-sot-part="dashboard-speaker-bar"',
    'data-sot-part="dashboard-speaker-bar-fill"',
];

const DASHBOARD_TRANSCRIPT_TURN_EMPTY_SOT_HOOKS = [
    'data-sot-item="dashboard-transcript-turn"',
    'data-sot-state="loading"',
    'data-sot-state="ready"',
    'data-sot-part="dashboard-transcript-speaker-time"',
    'data-sot-format="mono"',
    'data-sot-panel="dashboard-transcript-empty"',
    'data-sot-part="dashboard-transcript-empty-icon"',
    'data-sot-part="dashboard-transcript-empty-message"',
    'data-sot-part="dashboard-transcript-empty-sub"',
];

const DASHBOARD_SOURCE_REPORT_LOADED_SOT_HOOKS = [
    'data-sot-part="dashboard-source-report-status-dot"',
    "data-sot-source-report-segment-time",
    'data-sot-format="mono"',
    'valueFormat="mono"',
];

const DASHBOARD_SOURCE_REPORT_META_VALUE_HELPER_HOOKS = [
    "data-sot-source-report-meta-value",
    "data-sot-format={valueFormat}",
];

const DASHBOARD_SOURCE_REPORT_LOADED_LEGACY_CLASS_NAMES = [
    'className="dot"',
    'className="mono"',
];

const SOURCE_REPORT_SKELETON_LEGACY_CSS_SELECTOR_RE =
    /\.(?:sr-seg-time-skeleton|sr-seg-speaker-skeleton|sr-seg-line-skeleton|sr-seg-line-skeleton-long|sr-seg-line-skeleton-medium|sr-seg-line-skeleton-wide|sr-seg-line-skeleton-short)(?![\w-])/;

const SOURCE_REPORT_SKELETON_PRIMITIVE_SELECTORS = [
    '[data-sot-part="source-report-card-skeleton"]',
    '[data-sot-part="source-report-card-skeleton"][data-sot-size="source"]',
    '[data-sot-part="source-report-card-skeleton"][data-sot-size="status"]',
    '[data-sot-part="source-report-card-skeleton"][data-sot-size="count"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="time"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="speaker"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size^="line-"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="line-long"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="line-medium"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="line-wide"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="line-short"]',
];

const SOURCE_REPORT_EMPTY_LEGACY_CSS_SELECTOR_RE =
    /\.(?:sr-empty(?:-(?:ico|title|sub|actions))?)(?![\w-])/;

const SOURCE_REPORT_EMPTY_DATA_SOT_CSS_SELECTORS = [
    "[data-sot-source-report-empty-actions]",
    '[data-sot-source-report-empty-actions]\n    [data-sot-control="refresh-source-report"][data-sot-state="loading"]',
    '[data-sot-source-report-empty-actions]\n    [data-sot-control="refresh-source-report"]:disabled',
];

const SOURCE_REPORT_EMPTY_PRIMITIVE_SELECTORS = [
    "[data-sot-source-report-empty]",
    '[data-sot-source-report-empty][data-sot-tone="err"]',
    "[data-sot-source-report-empty-title]",
    "[data-sot-source-report-empty-description]",
];

const SOURCE_REPORT_METRIC_LEGACY_CSS_SELECTOR_RE =
    /\.(?:sr-card|sr-card-label|sr-card-value|sr-card-source|sr-card-source-fallback|sr-card-num|sr-pill)(?![\w-])/;

const SOURCE_REPORT_METRIC_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-list="source-report-cards"]',
    '[data-sot-part="source-report-card-label"]',
    '[data-sot-part="source-report-card-value"]',
    '[data-sot-part="source-report-card-value"][data-sot-value="source"]',
    '[data-sot-part="source-report-card-source-fallback"]',
    '[data-sot-part="source-report-card-value"][data-sot-value="number"]',
    '[data-sot-badge="source-report-status"][data-sot-tone]\n    [data-sot-part="source-report-status-dot"]',
    '[data-sot-badge="source-report-status"][data-sot-tone="ok"]\n    [data-sot-part="source-report-status-dot"]',
    '[data-sot-badge="source-report-status"][data-sot-tone="warn"]\n    [data-sot-part="source-report-status-dot"]',
    '[data-sot-badge="source-report-status"][data-sot-tone="err"]\n    [data-sot-part="source-report-status-dot"]',
];

const SOURCE_REPORT_METRIC_PRIMITIVE_SELECTORS = [
    '[data-sot-card="source-report-metric"][data-sot-metric]',
    '[data-theme="dark"] [data-sot-card="source-report-metric"][data-sot-metric]',
    '[data-sot-badge="source-report-status"][data-sot-tone]',
    '[data-sot-badge="source-report-status"][data-sot-tone][data-sot-tone="ok"]',
    '[data-sot-badge="source-report-status"][data-sot-tone][data-sot-tone="warn"]',
    '[data-sot-badge="source-report-status"][data-sot-tone][data-sot-tone="err"]',
];

const SOURCE_REPORT_SECTION_LEGACY_CSS_SELECTOR_RE =
    /\.(?:sr-pane|list-empty|sr-state|sr-cards|sr-section(?:-(?:head|sub))?|sr-summary-body|sr-segments|sr-seg(?:-(?:ts|speaker|text))?|sr-meta(?:-row)?|sr-actions)(?![\w-])/;

const SOURCE_REPORT_SECTION_DATA_SOT_CSS_SELECTORS = [
    "[data-sot-source-report-pane]",
    "[data-sot-source-report-state]",
    "[data-sot-source-report-state][hidden]",
    "[data-sot-source-report-section]",
    "[data-sot-source-report-section-header]",
    "[data-sot-source-report-section-title]",
    "[data-sot-source-report-description]",
    "[data-sot-source-report-summary-body]",
    "[data-sot-source-report-segments]",
    "[data-sot-source-report-segment]",
    "[data-sot-source-report-segment-time]",
    "[data-sot-source-report-segment-speaker]",
    "[data-sot-source-report-segment-text]",
    "[data-sot-source-report-meta]",
    "[data-sot-source-report-meta-row]",
    "[data-sot-source-report-actions]",
    '[data-sot-source-report-state][data-state="loaded"][data-sub-state="transcript-missing"]',
    '[data-sot-source-report-section][data-sot-section="metadata"]::before',
];

const SOURCE_REPORT_CARD_PRIMITIVE_SELECTORS = [
    '[data-sot-source-report-pane][data-slot="card"]',
    '[data-sot-source-report-header][data-slot="card-header"]',
    '[data-sot-source-report-title][data-slot="card-title"]',
    '[data-sot-source-report-header-actions][data-slot="card-action"]',
];

const SOURCE_REPORT_CARD_PRIMITIVE_REPAINT_DECLARATION_RE =
    /\b(?:background|border(?:-color|-radius)?|box-shadow|color|fill|font|letter-spacing|margin|padding|stroke)\s*:/;

const RECORDING_PLAYER_CARD_PRIMITIVE_SELECTORS = [
    '[data-sot-surface="recording-player"][data-slot="card"]',
    '[data-sot-part="recording-player-meta"][data-slot="card-header"]',
    '[data-sot-panel="recording-player-controls"][data-slot="card-content"]',
];

const RECORDING_PLAYER_BUTTON_CONTROL_HOOKS = [
    "recording-player-back",
    "recording-player-forward",
    "recording-player-play",
    "recording-player-speed",
    "recording-player-volume",
    "recording-player-volume-mute",
] as const;

const RECORDING_PLAYER_BUTTON_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-[\w-]+)?|border(?:-[\w-]+)?|box-shadow|color|font(?:-[\w-]+)?|padding(?:-[\w-]+)?)\s*:|\b(?:linear-gradient|oklch)\(/m;

const SOURCE_AUTH_MODE_LEGACY_CSS_SELECTOR_RE =
    /\.(?:path-picker|path-card|pc-t|pc-h|pc-badge)(?![\w-])/;

const SOURCE_AUTH_MODE_DATA_SOT_SOURCE_HOOKS = [
    'data-sot-list="source-auth-modes"',
    'data-sot-control="source-auth-mode"',
    'data-sot-part="source-auth-mode-title"',
    'data-sot-part="source-auth-mode-description"',
    'data-sot-badge="source-auth-mode"',
    "data-sot-tone={",
    'tone: "recommended"',
] as const;

const SOURCE_AUTH_MODE_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-list="source-auth-modes"]',
    '[data-sot-control="source-auth-mode"][data-sot-auth-mode]',
    '[data-sot-control="source-auth-mode"][data-sot-state="selected"]',
    '[data-sot-part="source-auth-mode-title"]',
    '[data-sot-part="source-auth-mode-description"]',
] as const;

const DASHBOARD_DETAIL_PANE_LEGACY_CLASS_NAMES = [
    'className="t-actions"',
    'className="copy-label"',
    'className="t-pane"',
    'className="avatar-sm"',
    'className="sp-rows"',
    'className="sp-row"',
    'className="sp-row-meta"',
    'className="sp-row-name"',
    'className="sp-row-sub"',
    'className="sp-bar"',
];

const DASHBOARD_TRANSCRIPT_TURN_EMPTY_LEGACY_CLASS_NAMES = [
    'className="turn skel-turn"',
    'className="turn"',
    'className="ts mono"',
    'className="empty-state"',
    'className="empty-ico"',
    'className="empty-msg"',
    'className="empty-sub"',
];

const DASHBOARD_RETRANSCRIPTION_SOT_HOOKS = [
    'data-sot-panel="dashboard-retranscription"',
    'data-sot-part="dashboard-retranscription-disabled-hint"',
    'data-sot-part="dashboard-retranscription-icon"',
    'data-sot-part="dashboard-retranscription-spinner"',
    'data-sot-part="dashboard-retranscription-icon-warn"',
    'data-sot-part="dashboard-retranscription-icon-ok"',
    'data-sot-part="dashboard-retranscription-body"',
    'data-sot-part="dashboard-retranscription-title"',
    'data-sot-part="dashboard-retranscription-sub"',
    'data-sot-part="dashboard-retranscription-actions"',
    'data-sot-part="dashboard-retranscription-refresh-marker"',
];

const DASHBOARD_RETRANSCRIPTION_LEGACY_CLASS_NAMES = [
    "retx-disabled-hint",
    "retx-banner",
    "retx-banner-ico",
    "retx-spinner",
    "retx-banner-body",
    "retx-banner-title",
    "retx-banner-sub",
    "retx-banner-actions",
    "retx-refresh-marker",
    "retx-ico-warn",
    "retx-ico-ok",
];

const DASHBOARD_TRANSCRIPT_SOURCE_REPORT_RETX_ACTIVITY_LEGACY_CSS_SELECTOR_RE =
    /(^|[^\w-])\.(?:activity-pixel-stage|notif-empty|turn|transcript|transcript-head|transcript-body|speaker|speaker-name|sr-pane|list-empty|empty-state|empty-ico|empty-msg|empty-sub|retx-banner|retx-banner-ico|retx-spinner|retx-disabled-hint|retx-refresh-marker|retx-banner-body|retx-banner-title|retx-banner-sub|retx-banner-actions|retx-ico-warn|retx-ico-ok|t-actions)(?![\w-])/;

const DASHBOARD_TRANSCRIPT_SOURCE_REPORT_RETX_ACTIVITY_SOT_CSS_SELECTORS = [
    '[data-sot-part="dashboard-transcript-body"]',
    '[data-sot-item="dashboard-transcript-turn"]',
    '[data-sot-part="dashboard-transcript-speaker-row"]',
    '[data-sot-part="dashboard-transcript-speaker-name"]',
    '[data-sot-part="dashboard-transcript-speaker-time"]',
    "[data-sot-source-report-pane]",
    '[data-sot-panel="dashboard-transcript-empty"]',
    '[data-sot-part="dashboard-transcript-empty-icon"]',
    '[data-sot-part="dashboard-transcript-empty-message"]',
    '[data-sot-part="dashboard-transcript-empty-sub"]',
    '[data-sot-panel="dashboard-retranscription"]',
    '[data-sot-part="dashboard-retranscription-icon"]',
    '[data-sot-part="dashboard-retranscription-spinner"]',
    '[data-sot-part="dashboard-retranscription-refresh-marker"]',
    '[data-sot-part="dashboard-activity-empty"]',
    '[data-sot-panel="recording-detail-loading"]',
];

const DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_SELECTORS = [
    '[data-sot-panel="dashboard-transcript-shell"][data-slot="card"]',
    '[data-sot-part="dashboard-transcript-header"][data-slot="card-header"]',
    '[data-sot-part="dashboard-transcript-language"][data-slot="badge"]',
    '[data-sot-part="dashboard-transcript-body"][data-slot="card-content"]',
    '[data-sot-control="copy-local-transcript"][data-slot="button"]',
    '[data-sot-control="copy-source-transcript"][data-slot="button"]',
    '[data-sot-control="copy-source-report"][data-slot="button"]',
    '[data-sot-control="refresh-source-report"][data-slot="button"]',
    '[data-sot-control="retranscribe-recording"][data-slot="button"]',
    '[data-sot-control="retry-retranscription"][data-slot="button"]',
    '[data-sot-control="dismiss-retranscription-failed"][data-slot="button"]',
    '[data-sot-control="dismiss-retranscription-complete"][data-slot="button"]',
] as const;

const DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|line-height|padding|transition|width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

const RECORDING_TRANSCRIPTION_PRIMITIVE_SELECTORS = [
    '[data-sot-panel="recording-transcription"][data-slot="card"]',
    '[data-sot-part="recording-transcription-header"][data-slot="card-header"]',
    '[data-sot-part="recording-transcription-title"][data-slot="card-title"]',
    '[data-sot-part="recording-transcription-description"][data-slot="card-description"]',
    '[data-sot-part="recording-transcription-unavailable"][data-slot="field-description"]',
    '[data-sot-part="recording-transcription-body"][data-slot="card-content"]',
    '[data-sot-banner="transcription-job"][data-slot="alert"]',
    '[data-sot-banner-title][data-slot="alert-title"]',
    '[data-sot-control="copy-local-transcript"][data-slot="button"]',
    '[data-sot-control="retranscribe-local"][data-slot="button"]',
    '[data-sot-control="start-local-transcription"][data-slot="button"]',
] as const;

const RECORDING_TRANSCRIPTION_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|line-height|padding|transition|width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

const RECORDING_DETAIL_CARD_PRIMITIVE_SELECTORS = [
    '[data-sot-panel="recording-detail-list"][data-slot="card"]',
    '[data-sot-panel="recording-detail-metadata"][data-slot="card"]',
    '[data-sot-panel="recording-source-record"][data-slot="card"]',
    '[data-sot-panel="recording-transcription-skeleton"][data-slot="card"]',
    '[data-sot-panel="recording-transcription-speaker-review-skeleton"][data-slot="card"]',
    '[data-sot-part="recording-detail-list-header"][data-slot="card-header"]',
    '[data-sot-part="recording-detail-metadata-header"]',
    '[data-sot-part="recording-source-record-header"]',
    '[data-sot-part="recording-transcription-skeleton-header"][data-slot="card-header"]',
    '[data-sot-part="recording-detail-list-title"][data-slot="card-title"]',
    '[data-sot-part="recording-detail-metadata-title"][data-slot="card-title"]',
    '[data-sot-part="recording-source-record-title"][data-slot="card-title"]',
    '[data-sot-part="recording-detail-list-content"][data-slot="card-content"]',
    '[data-sot-part="recording-detail-metadata-body"]',
    '[data-sot-part="recording-source-record-body"]',
    '[data-sot-part="recording-transcription-skeleton-body"][data-slot="card-content"]',
    '[data-sot-list="recording-transcription-speaker-cards"][data-slot="card-content"]',
] as const;

const RECORDING_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|line-height|padding|transition|width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

describe("full UI replacement regression coverage", () => {
    it("keeps global SOT tokens, foundation primitives, and OKLCH fallbacks", () => {
        const globals = readSource("app/globals.css");
        const panel = readSource("components/panel.tsx");
        const breadcrumb = readSource("components/ui/breadcrumb.tsx");
        const card = readSource("components/ui/card.tsx");
        const button = readSource("components/ui/button.tsx");
        const dialog = readSource("components/ui/dialog.tsx");
        const input = readSource("components/ui/input.tsx");
        const label = readSource("components/ui/label.tsx");
        const select = readSource("components/ui/select.tsx");
        const sidebar = readSource("components/ui/sidebar.tsx");
        const switchPrimitive = readSource("components/ui/switch.tsx");
        const textarea = readSource("components/ui/textarea.tsx");
        const toggleGroup = readSource("components/ui/toggle-group.tsx");
        const toaster = readSource("components/ui/sonner.tsx");
        const confirmDialog = readSource("components/ui/confirm-dialog.tsx");

        expect(globals).toContain(
            "BetterAINote · Graphite Glass Design System",
        );
        expect(globals).toContain("--graphite-100: rgb(");
        expect(globals).toContain("--graphite-100: oklch(");
        expect(globals).toContain("--steel-500: rgb(");
        expect(globals).toContain("--steel-500: oklch(");
        expect(globals).toContain("--bg-canvas:");
        expect(globals).toContain("--bg-elevated:");
        expect(globals).toContain("--fg-primary:");
        expect(globals).toContain("@supports not (color: oklch(");
        expect(globals).not.toMatch(/(^|[{\s,])\.panel(?![\w-])/m);
        expect(globals).not.toMatch(/(^|\n|,)\s*\.storage-bar\b/);
        expectTokenOklchFallbackOrder(globals, ":root");
        expectTokenOklchFallbackOrder(globals, '.dark,\n[data-theme="dark"]');
        expect(
            extractCssBlock(globals, "@supports not (color: oklch("),
        ).not.toMatch(/\b(oklch|color-mix)\(/);
        for (const token of [
            "BetterAINote · Graphite Glass Design System",
            "--bg-canvas:",
            "--bg-elevated:",
            "--fg-primary:",
            "--z-modal:",
            "@supports not (color: oklch(",
        ]) {
            expect(globals).toContain(token);
        }
        const productCss = readProductCss(globals);
        expect(productCss).not.toMatch(LEGACY_MONO_PRODUCT_CSS_SELECTOR_RE);
        expect(productCss).not.toMatch(
            LEGACY_DESIGN_TWEAKS_PRODUCT_CSS_SELECTOR_RE,
        );
        expect(stripCssComments(productCss)).not.toMatch(
            UNAPPROVED_PRODUCT_CSS_CLASS_SELECTOR_RE,
        );
        expect(productCss).toContain(
            '[data-sot-part="dashboard-transcript-speaker-time"][data-sot-format="mono"]',
        );
        expect(productCss).not.toMatch(
            LEGACY_MODAL_SHELL_PRODUCT_CSS_SELECTOR_RE,
        );
        for (const selector of MODAL_SHELL_DATA_SOT_CSS_SELECTORS) {
            expect(productCss).toContain(selector);
        }
        expect(productCss).not.toMatch(
            DELETE_CONFIRM_MODAL_EXTRAS_LEGACY_PRODUCT_CSS_SELECTOR_RE,
        );
        for (const selector of DELETE_CONFIRM_MODAL_EXTRAS_DATA_SOT_CSS_SELECTORS) {
            expect(productCss).toContain(selector);
        }
        const confirmFooterButtonRules = collectCssRuleBlocks(
            productCss,
            '[data-sot-part="confirm-foot"]',
        ).filter(({ prelude }) => prelude.includes('[data-slot="button"]'));
        expect(confirmFooterButtonRules).toEqual([]);
        const destructiveButtonRules = collectCssRuleBlocks(
            productCss,
            '[data-slot="button"][data-variant="destructive"]',
        );
        for (const block of destructiveButtonRules) {
            expect(block.declarations).not.toMatch(
                CONFIRM_DIALOG_BUTTON_PRIMITIVE_REPAINT_DECLARATION_RE,
            );
        }
        expect(
            extractCssBlock(
                productCss,
                '[data-sot-content="confirm-dialog"] [data-sot-part="dialog-icon"]',
            ),
        ).toContain("var(--signal-danger)");
        expect(
            extractCssBlock(productCss, '[data-sot-part="confirm-extra"]'),
        ).toContain("display: flex;");
        expect(
            extractCssBlock(
                productCss,
                '[data-sot-item="confirm-dialog-detail"]',
            ),
        ).toContain("font: 500 12.5px / 1.55 var(--font-sans);");
        expect(
            extractCssBlock(productCss, '[data-sot-part="confirm-warning"]'),
        ).toContain("var(--signal-danger)");

        expect(card.trim()).not.toBe("export {};");
        for (const primitive of [
            "Card",
            "CardHeader",
            "CardTitle",
            "CardDescription",
            "CardAction",
            "CardContent",
            "CardFooter",
        ]) {
            expect(card).toMatch(new RegExp(`function ${primitive}\\(`));
            expect(card).toContain(`    ${primitive},`);
        }
        for (const slot of [
            "card",
            "card-header",
            "card-title",
            "card-description",
            "card-action",
            "card-content",
            "card-footer",
        ]) {
            expect(card).toContain(`data-slot="${slot}"`);
        }
        expect(card).toContain("bg-card text-card-foreground");
        expect(panel).toContain('data-slot="card"');
        expect(panel).toContain("bg-card text-card-foreground");
        expect(panel).toContain("data-variant={variant}");
        expect(panel).not.toContain('cn("panel"');
        expect(panel).not.toContain('className="panel"');

        expect(breadcrumb.trim()).not.toBe("export {};");
        for (const primitive of [
            "Breadcrumb",
            "BreadcrumbList",
            "BreadcrumbItem",
            "BreadcrumbLink",
            "BreadcrumbPage",
            "BreadcrumbSeparator",
            "BreadcrumbEllipsis",
        ]) {
            expect(breadcrumb).toMatch(new RegExp(`function ${primitive}\\(`));
            expect(breadcrumb).toContain(`    ${primitive},`);
        }
        for (const slot of [
            "breadcrumb",
            "breadcrumb-list",
            "breadcrumb-item",
            "breadcrumb-link",
            "breadcrumb-page",
            "breadcrumb-separator",
            "breadcrumb-ellipsis",
        ]) {
            expect(breadcrumb).toContain(`data-slot="${slot}"`);
        }
        expect(breadcrumb).toContain('aria-label="breadcrumb"');
        expect(breadcrumb).toContain('aria-current="page"');

        expect(sidebar.trim()).not.toBe("export {};");
        for (const primitive of [
            "Sidebar",
            "SidebarProvider",
            "SidebarContent",
            "SidebarGroup",
            "SidebarMenu",
            "SidebarMenuButton",
            "SidebarMenuItem",
            "SidebarTrigger",
            "useSidebar",
        ]) {
            expect(sidebar).toContain(`    ${primitive},`);
        }
        for (const slot of [
            "sidebar-wrapper",
            "sidebar",
            "sidebar-content",
            "sidebar-group",
            "sidebar-menu",
            "sidebar-menu-button",
            "sidebar-trigger",
        ]) {
            expect(sidebar).toContain(`data-slot="${slot}"`);
        }
        for (const contract of [
            'data-sidebar="sidebar"',
            'data-sidebar="content"',
            'data-sidebar="group"',
            'data-sidebar="menu"',
            'data-sidebar="menu-button"',
            'data-sidebar="trigger"',
            "data-state={state}",
            'data-collapsible={collapsed ? collapsible : ""}',
        ]) {
            expect(sidebar).toContain(contract);
        }
        expect(sidebar).toContain("const SidebarContext = React.createContext");
        expect(sidebar).toContain("--sidebar-width");
        expect(button).toContain(
            'import { Slot } from "@radix-ui/react-slot";',
        );
        expect(button).toContain(
            'import { cva, type VariantProps } from "class-variance-authority";',
        );
        expect(button).toContain("const buttonVariants = cva(");
        expect(button).toContain("VariantProps<typeof buttonVariants>");
        expect(button).toContain("asChild?: boolean;");
        expect(button).toContain('const Comp = asChild ? Slot : "button";');
        expect(button).toContain('data-slot="button"');
        expect(button).toContain("data-variant={variant}");
        expect(button).toContain("data-size={size}");
        for (const variant of [
            "default",
            "destructive",
            "outline",
            "secondary",
            "ghost",
            "link",
            "primary",
            "danger",
        ]) {
            expect(button).toContain(`${variant}:`);
        }
        expect(button).not.toContain("glass:");
        expect(button).toContain(
            "export { Button, IconButton, buttonVariants };",
        );
        expect(button).not.toContain("type ButtonVariant =");
        expect(button).not.toContain("type ButtonSize =");
        expect(button).not.toContain("React.cloneElement");
        expect(dialog).toContain(
            'import * as DialogPrimitive from "@radix-ui/react-dialog";',
        );
        for (const primitive of [
            "Root",
            "Trigger",
            "Portal",
            "Close",
            "Overlay",
            "Content",
            "Title",
            "Description",
        ]) {
            expect(dialog).toContain(`DialogPrimitive.${primitive}`);
        }
        expect(dialog).toContain("showCloseButton");
        expect(dialog).toContain("<XIcon />");
        for (const primitive of [
            "DialogHeader",
            "DialogFooter",
            "DialogTitle",
            "DialogDescription",
        ]) {
            expect(dialog).toMatch(new RegExp(`function ${primitive}\\(`));
        }
        for (const slot of [
            "dialog-trigger",
            "dialog-close",
            "dialog-portal",
            "dialog-overlay",
            "dialog-content",
            "dialog-header",
            "dialog-footer",
            "dialog-title",
            "dialog-description",
        ]) {
            expect(dialog).toContain(`data-slot="${slot}"`);
        }
        expect(dialog).toContain("function DialogPortal(");
        expect(dialog).not.toContain("DialogContext");
        expect(label).toContain(
            'import * as LabelPrimitive from "@radix-ui/react-label";',
        );
        expect(label).toContain(
            "React.ComponentProps<typeof LabelPrimitive.Root>",
        );
        expect(label).toContain("<LabelPrimitive.Root");
        expect(label).toContain('data-slot="label"');
        expect(label).not.toContain('className={cn("field-name"');
        expect(input).toContain('React.ComponentProps<"input">');
        expect(input).toContain('data-slot="input"');
        for (const className of [
            "border-input",
            "focus-visible:ring-ring/50",
            "aria-invalid:border-destructive",
        ]) {
            expect(input).toContain(className);
        }
        expect(input).not.toContain("field-input");
        expect(textarea).toContain('React.ComponentProps<"textarea">');
        expect(textarea).toContain('data-slot="textarea"');
        for (const className of [
            "border-input",
            "focus-visible:ring-ring/50",
            "aria-invalid:border-destructive",
        ]) {
            expect(textarea).toContain(className);
        }
        expect(textarea).not.toContain("field-input");
        expect(select).toContain(
            'import * as SelectPrimitive from "@radix-ui/react-select";',
        );
        for (const primitive of [
            "Root",
            "Trigger",
            "Portal",
            "Content",
            "Value",
            "Group",
            "Item",
        ]) {
            expect(select).toContain(`SelectPrimitive.${primitive}`);
        }
        for (const primitive of [
            "SelectTrigger",
            "SelectContent",
            "SelectItem",
            "SelectValue",
            "SelectGroup",
        ]) {
            expect(select).toContain(`    ${primitive},`);
        }
        for (const slot of [
            "select",
            "select-trigger",
            "select-content",
            "select-item",
            "select-value",
            "select-group",
        ]) {
            expect(select).toContain(`data-slot="${slot}"`);
        }
        expect(select).not.toContain("<select");
        expect(select).not.toContain("<option");
        expect(select).not.toContain('className={cn("select"');
        expect(switchPrimitive).toContain(
            'import * as SwitchPrimitive from "@radix-ui/react-switch";',
        );
        expect(switchPrimitive).toContain(
            "React.ComponentProps<typeof SwitchPrimitive.Root>",
        );
        expect(switchPrimitive).toContain("<SwitchPrimitive.Root");
        expect(switchPrimitive).toContain("<SwitchPrimitive.Thumb");
        expect(switchPrimitive).toContain('data-slot="switch"');
        expect(switchPrimitive).toContain('data-slot="switch-thumb"');
        expect(switchPrimitive).toContain("data-[state=checked]:bg-primary");
        expect(switchPrimitive).toContain("data-[state=unchecked]:bg-input");
        expect(switchPrimitive).not.toContain('className={cn("toggle"');
        expect(switchPrimitive).not.toContain('className="t-knob"');
        expect(toggleGroup).toContain(
            'import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";',
        );
        expect(toggleGroup).toContain(
            'import { cva, type VariantProps } from "class-variance-authority";',
        );
        expect(toggleGroup).toContain("const toggleGroupItemVariants = cva(");
        expect(toggleGroup).toContain(
            "React.ComponentProps<typeof ToggleGroupPrimitive.Root>",
        );
        expect(toggleGroup).toContain(
            "React.ComponentProps<\n    typeof ToggleGroupPrimitive.Item\n>",
        );
        expect(toggleGroup).toContain('data-slot="toggle-group"');
        expect(toggleGroup).toContain('data-slot="toggle-group-item"');
        expect(toggleGroup).toContain("data-variant={variant}");
        expect(toggleGroup).toContain("data-size={size}");
        expect(toaster).toContain(
            'import { Toaster as Sonner, type ToasterProps } from "sonner";',
        );
        expect(toaster).toContain("<Sonner");
        expect(toaster).toContain('theme={theme as ToasterProps["theme"]}');
        expect(toaster).toContain('"--normal-bg": "var(--popover)"');
        expect(toaster).toContain(
            '"--normal-text": "var(--popover-foreground)"',
        );
        expect(toaster).toContain('"--normal-border": "var(--border)"');
        expect(toaster).not.toContain("useSonner");
        expect(toaster).not.toContain("toast-stack");
        expect(toaster).not.toContain("toast toast-ok");
        expect(toaster).not.toContain("toast toast-err");
        expect(toaster).not.toContain("toast-ico");
        expect(toaster).not.toContain("DEFAULT_TOAST_DURATION_MS");
        expect(confirmDialog).toContain("ConfirmDialogContext");
        expect(confirmDialog).toContain("ConfirmDialogProvider");
        expect(confirmDialog).toContain("useConfirmDialog");
        expect(confirmDialog).toMatch(/<Dialog(?:\s|>)/);
        for (const primitive of [
            "DialogContent",
            "DialogHeader",
            "DialogTitle",
            "DialogDescription",
            "DialogFooter",
            "Button",
        ]) {
            expect(confirmDialog).toContain(`<${primitive}`);
        }
        expect(confirmDialog).toContain("portalWrapperProps");
        expect(confirmDialog).toContain('"data-sot-panel": "confirm-dialog"');
        expect(confirmDialog).toContain('data-sot-content="confirm-dialog"');
        expect(confirmDialog).toContain('data-sot-part="confirm-head"');
        expect(confirmDialog).toContain('data-sot-part="confirm-body"');
        expect(confirmDialog).toContain('data-sot-part="confirm-foot"');
        expect(confirmDialog).toContain(
            'confirmVariant?: "default" | "destructive"',
        );
        expect(confirmDialog).toContain(
            'state?.confirmVariant ?? "destructive"',
        );
        expect(confirmDialog).toContain('variant="outline"');
        expect(confirmDialog).toContain("variant={confirmButtonVariant}");
        expect(confirmDialog).toContain('size="sm"');
        expect(confirmDialog).toContain(
            'data-sot-list="confirm-dialog-details"',
        );
        expect(confirmDialog).toContain("state.details.map");
        expect(confirmDialog).toContain("state.warning");
        expect(confirmDialog).not.toContain('className="scrim"');
        expect(confirmDialog).not.toContain('className="confirm-dialog"');
        expect(confirmDialog).not.toContain('role="dialog"');
        expect(confirmDialog).not.toContain('aria-modal="true"');
        expect(confirmDialog).not.toContain('<h3 id="confirm-title">');
        expect(confirmDialog).not.toContain('className="btn danger btn-sm"');
        expect(confirmDialog).not.toContain('className="btn ghost btn-sm"');
        expect(confirmDialog).not.toMatch(
            /document\.(?:add|remove)EventListener\(\s*["']keydown["']/,
        );
        expect(confirmDialog).not.toContain("ConfirmVariant");
        expect(confirmDialog).not.toContain("btn primary btn-sm");
        expect(confirmDialog).not.toContain("<dialog");
        expect(globals).not.toContain(".confirm-head h2");
        expect(globals).not.toContain("--z-confirm-modal");
        expect(globals).not.toContain("Hardware Design System");
        expect(globals).not.toContain("warm beige");
    });

    it("classifies non-token modern CSS colors without fallback-only leakage", () => {
        const globals = readSource("app/globals.css");
        const findings = collectGlobalColorFallbackFindings(globals);

        expect(findings.tokenModernColorDeclarations.length).toBeGreaterThan(0);
        expect(
            findings.nonTokenSupportedPathDeclarations.length,
        ).toBeGreaterThan(0);
        expect(findings.fallbackOnlyModernColorDeclarations).toEqual([]);
        expect(findings.unexpectedSupportedPathDeclarations).toEqual([]);
        expect(findings.unsafeVarFallbackArguments).toEqual([]);
    });

    it("keeps recording tag manager legacy selectors out of product CSS", () => {
        const globals = readSource("app/globals.css");
        const recordingTagVisuals = readSource(
            "features/recordings/components/recording-tag-visuals.tsx",
        );
        const legacyTagManagerSelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                /^\s*\.(?:tagm-|tag-chip-)|,\s*\.(?:tagm-|tag-chip-)|^\s*\.tg-pick|,\s*\.tg-pick/.test(
                    text,
                ),
            );

        expect(legacyTagManagerSelectorLines).toEqual([]);
        expect(recordingTagVisuals).not.toContain(
            "recordingTagSotColorClassName",
        );
        expect(recordingTagVisuals).not.toMatch(
            /\bc-(?:rose|amber|emerald|blue|violet|slate)\b/,
        );
        expect(recordingTagVisuals).not.toContain('"tg-ico"');
    });

    it("keeps dashboard transcript, source report, retx, and activity legacy selectors out of product CSS", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .filter(
                (line) =>
                    !line.includes(".cl-pop-host .notif-empty") &&
                    DASHBOARD_TRANSCRIPT_SOURCE_REPORT_RETX_ACTIVITY_LEGACY_CSS_SELECTOR_RE.test(
                        line,
                    ),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DASHBOARD_TRANSCRIPT_SOURCE_REPORT_RETX_ACTIVITY_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        for (const selector of DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_SELECTORS) {
            const repaintBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(({ declarations }) =>
                DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE.test(
                    declarations,
                ),
            );

            expect(repaintBlocks).toEqual([]);
        }
    });

    it("keeps dashboard recording-list replacement hooks out of legacy JSX className selectors", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        for (const hook of DASHBOARD_RECORDING_LIST_REPLACEMENT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const className of DASHBOARD_RECORDING_LIST_REPLACED_LEGACY_CLASSES) {
            expect(workstation).not.toMatch(
                new RegExp(`className=\\{?["']${className}["']\\}?`),
            );
        }
        expect(workstation).toContain("<Button");
        expect(workstation).toContain("data-tag-filter-trigger");
        expect(workstation).toContain("data-tag-filter-list");
        expect(workstation).toContain("data-page-prev");
        expect(workstation).toContain("data-page-next");
        expect(workstation).toContain("data-list-state-block");
    });

    it("keeps dashboard sidebar footer and recording-list states on data-sot product CSS selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_RECORDING_LIST_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(
                    text,
                ),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DASHBOARD_RECORDING_LIST_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        expect(globals).not.toMatch(
            DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_RE,
        );
        for (const selector of DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
    });

    it("keeps library search product CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                LIBRARY_SEARCH_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of LIBRARY_SEARCH_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        for (const selector of LIBRARY_SEARCH_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
    });

    it("keeps dashboard topbar source/status atoms on data-sot product CSS selectors", () => {
        const globals = readSource("app/globals.css");
        const productCss = readProductCss(globals);
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_TOPBAR_SOURCE_STATUS_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(
                    text,
                ),
            );

        expect(legacySelectorLines).toEqual([]);
        expect(productCss).not.toMatch(TOPBAR_LEGACY_PRODUCT_CSS_SELECTOR_RE);
        for (const selector of TOPBAR_DATA_SOT_PRODUCT_CSS_SELECTORS) {
            expect(productCss).toContain(selector);
        }
        for (const selector of DASHBOARD_TOPBAR_SOURCE_STATUS_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
    });

    it("keeps liquid tabs product CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                LIQUID_TABS_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of LIQUID_TABS_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
    });

    it("keeps system banners product CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                SYSTEM_BANNER_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of SYSTEM_BANNER_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        expect(globals).toMatch(/\[data-sot-part="system-banner-icon"\]\s+svg/);
    });

    it("keeps more actions menus product CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                MORE_ACTIONS_MENU_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of MORE_ACTIONS_MENU_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
    });

    it("keeps shared scrollbars product CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                SOT_SCROLLBAR_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of SOT_SCROLLBAR_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
    });

    it("keeps tab pane hidden product CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                TAB_PANE_HIDDEN_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of TAB_PANE_HIDDEN_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
    });

    it("keeps dashboard time filters product CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_TIME_FILTER_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DASHBOARD_TIME_FILTER_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        for (const selector of DASHBOARD_TIME_FILTER_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
    });

    it("keeps copy icon product CSS scoped to data-sot hooks", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                COPY_ICON_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of COPY_ICON_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }

        const globalCopyButtonAppearanceRules = collectCssRuleBlocks(
            stripCssComments(globals),
            '[data-slot="button"][data-copy]',
        ).filter(({ declarations }) =>
            COPY_BUTTON_GLOBAL_APPEARANCE_PROPERTIES.some((property) =>
                new RegExp(`(^|;)\\s*${property}\\s*:`, "m").test(declarations),
            ),
        );

        expect(globalCopyButtonAppearanceRules).toEqual([]);
    });

    it("keeps dashboard transcript actions off lang-pill CSS selectors", () => {
        const globals = readSource("app/globals.css");
        const workstation = readSource("features/dashboard/workstation.tsx");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_TRANSCRIPT_ACTIONS_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(
                    text,
                ),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DASHBOARD_TRANSCRIPT_ACTIONS_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        for (const hook of DASHBOARD_TRANSCRIPT_ACTIONS_DATA_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        expect(workstation).not.toContain('className="lang-pill"');
    });

    it("keeps detail empty product CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DETAIL_EMPTY_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DETAIL_EMPTY_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
    });

    it("keeps AI rename preview legacy selectors out of product CSS", () => {
        const globals = readSource("app/globals.css");
        const legacyAiRenameSelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                /^\s*\.ai-rename-panel|,\s*\.ai-rename-panel|^\s*\.airp-|,\s*\.airp-/.test(
                    text,
                ),
            );

        expect(legacyAiRenameSelectorLines).toEqual([]);
    });

    it("keeps AI rename legacy tokens out of product source", () => {
        const productRoots = ["app", "components", "features", "lib"];
        const findings = productRoots.flatMap((root) =>
            collectSourceFiles(path.join(ROOT, root)).flatMap((filePath) => {
                const source = readFileSync(filePath, "utf8");
                const relativePath = path.relative(ROOT, filePath);
                return source
                    .split("\n")
                    .map((text, index) => ({
                        line: index + 1,
                        path: relativePath,
                        text,
                    }))
                    .filter(({ text }) =>
                        /\.ai-rename-panel|\.airp-|airp-|data-airp-/.test(text),
                    );
            }),
        );

        expect(findings).toEqual([]);
    });

    it("keeps inline OKLCH tag swatches limited to the SOT catalog", () => {
        const findings = collectInlineModernColorFindings();

        expect(findings.catalogSwatches).toEqual([
            "red",
            "orange",
            "green",
            "blue",
            "purple",
            "slate",
        ]);
        expect(findings.unexpectedModernColorLines).toEqual([]);
        expect(findings.unexpectedTagSwatchCalls).toEqual([]);
    });

    it("keeps auth and onboarding on the SOT card/frame structure", () => {
        const login = readSource("features/auth/components/login-form.tsx");
        const register = readSource(
            "features/auth/components/register-form.tsx",
        );
        const onboarding = readSource(
            "features/onboarding/components/onboarding-form.tsx",
        );
        const globals = readSource("app/globals.css");

        expect(login).toContain('data-sot-layout="auth-workstation"');
        expect(login).toContain('import { Card } from "@/components/ui/card";');
        expect(login).toContain("<Card");
        expect(login).toContain('data-sot-card="auth"');
        expect(login).toContain("data-sot-surface={surfaceName}");
        expect(login).toContain("data-sot-state={surfaceState}");
        expect(login).toContain('data-sot-frame="auth"');
        expect(login).toContain('data-sot-part="card-heading"');
        expect(login).toContain('data-sot-part="auth-logo-mark"');
        expect(login).toContain('data-sot-part="auth-heading"');
        expect(login).toContain('data-sot-part="auth-description"');
        expect(login).toContain('data-sot-part="auth-form-message"');
        expect(login).toContain('data-sot-part="auth-local-choice"');
        expect(login).not.toContain('className="auth-sot-canvas"');
        expect(login).not.toContain('className="card"');
        expect(login).not.toContain('className="frame"');
        for (const legacyAuthClassName of [
            "auth-mark",
            "auth-title",
            "auth-sub",
            "field-help",
            "auth-local-link",
        ]) {
            expect(login).not.toContain(legacyAuthClassName);
        }
        expect(login).toContain(
            'import { Input } from "@/components/ui/input";',
        );
        expect(login).toContain("<Input");
        expect(login).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(login).toContain("<Button");
        expect(login).toContain('variant="primary"');
        expect(login).toContain('data-sot-control="send-login-link"');
        expect(login).toContain('data-sot-control="auth-email"');
        expect(login).toContain('data-sot-control="local-only"');
        expect(login).toContain('variant="link"');
        expect(login).toContain("data-sot-state={formState.kind}");
        expect(login).toContain("data-auth-form-state");
        expect(login).not.toContain('"inp"');
        expect(login).not.toContain('className="btn primary"');
        expect(login).not.toContain('"btn primary"');
        expect(login).not.toContain('className="app"');
        expect(login).not.toContain('className="panel"');
        expect(login).not.toContain('className="modal-foot"');
        for (const authDataSotSelector of [
            '[data-sot-layout="auth-workstation"]',
            '[data-sot-part="auth-logo-mark"]',
            '[data-sot-part="auth-heading"]',
            '[data-sot-part="auth-description"]',
            '[data-sot-part="auth-form-message"]',
            '[data-sot-part="auth-form-message"][data-sot-state="error"]',
            '[data-sot-part="auth-form-message"][data-sot-state="success"]',
            '[data-sot-part="auth-local-choice"]',
            '[data-sot-control="local-only"][data-slot="button"]',
        ]) {
            expect(globals).toContain(authDataSotSelector);
        }
        const authOnboardingLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                AUTH_ONBOARDING_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(authOnboardingLegacySelectorLines).toEqual([]);
        expect(register).toContain("<LoginForm");
        expect(register).toContain('intent="setup"');
        for (const source of [login, register]) {
            expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
        }

        expect(onboarding).toContain(
            'data-sot-layout="onboarding-workstation"',
        );
        expect(onboarding).toContain('data-sot-surface="onboarding"');
        expect(onboarding).toContain("<Card");
        expect(onboarding).toContain('data-sot-card="onboarding"');
        expect(onboarding).toContain('data-sot-frame="onboarding"');
        expect(onboarding).toContain('data-sot-part="card-heading"');
        expect(onboarding).toMatch(
            /<CardHeader\s+data-sot-part="onboarding-card-header">[\s\S]*<CardTitle\s+data-sot-part="card-heading">[\s\S]*<CardDescription\s+data-sot-part="card-sub">/,
        );
        expect(onboarding).not.toContain('className="onboarding-sot-canvas"');
        expect(onboarding).not.toContain('className="card"');
        expect(onboarding).not.toContain('className="frame"');
        expect(onboarding).toContain('data-sot-panel="onboarding-steps"');
        expect(onboarding).toContain("data-sot-progress={visibleStep}");
        expect(onboarding).toContain('data-sot-panel="onboarding-current"');
        expect(onboarding).toContain('data-sot-control="onboarding-step"');
        expect(onboarding).toContain("data-sot-step={step.id}");
        expect(onboarding).toContain("data-sot-state={status}");
        expect(onboarding).toContain('data-sot-part="onboarding-step-header"');
        expect(onboarding).toContain('data-sot-part="onboarding-step-title"');
        expect(onboarding).toContain(
            'data-sot-part="onboarding-step-description"',
        );
        expect(onboarding).toContain('data-sot-part="onboarding-step-body"');
        expect(onboarding).toMatch(
            /<CardHeader\s+data-sot-part="onboarding-step-header">[\s\S]*<CardTitle\s+data-sot-part="onboarding-step-title">[\s\S]*<CardDescription\s+data-sot-part="onboarding-step-description">/,
        );
        expect(onboarding).toContain(
            '<CardContent data-sot-part="onboarding-step-body">',
        );
        expect(onboarding).toContain('data-sot-part="onboarding-error"');
        expect(onboarding).toContain('data-sot-part="onboarding-actions"');
        expect(onboarding).toContain('data-sot-control="onboarding-skip"');
        expect(onboarding).toContain('data-sot-control="provider-card"');
        expect(onboarding).toContain('data-sot-list="provider-cards"');
        expect(onboarding).toContain(
            'data-sot-panel="onboarding-default-source-step"',
        );
        expect(onboarding).toContain(
            'data-sot-list="onboarding-default-sources"',
        );
        expect(onboarding).toContain(
            'data-sot-control="onboarding-default-source"',
        );
        expect(onboarding).toContain(
            'data-sot-part="onboarding-default-source-swatch"',
        );
        expect(onboarding).toContain(
            'data-sot-control="speaker-profile-draft"',
        );
        expect(onboarding).toMatch(
            /data-sot-control="speaker-profile-draft"[\s\S]*<CardHeader\s+data-sot-part="provider-meta">[\s\S]*<CardTitle\s+data-sot-part="provider-name">[\s\S]*<CardDescription\s+data-sot-part="provider-hint">/,
        );
        expect(onboarding).toContain('data-sot-list="speaker-profiles"');
        expect(onboarding).toContain('data-sot-list="finish-summary"');
        expect(onboarding).toContain('data-sot-part="provider-icon"');
        expect(onboarding).toContain('data-sot-part="provider-meta"');
        expect(onboarding).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(onboarding).toContain('variant="outline"');
        expect(onboarding).toContain('variant="primary"');
        expect(onboarding).toContain('size="xs"');
        expect(onboarding).toContain('size="lg"');
        expect(onboarding).toContain("className={cn(");
        expect(onboarding).toContain("border-primary/50 bg-primary/10");
        expect(onboarding).toContain(
            '"grid h-auto w-full grid-cols-[36px_1fr_auto_auto] items-center justify-start gap-3 px-3.5 py-3 text-left"',
        );
        expect(onboarding).toContain(
            'className="grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 border-primary/50 bg-primary/10 p-3.5"',
        );
        expect(onboarding).toContain("CardContent,");
        expect(onboarding).toContain("CardDescription,");
        expect(onboarding).toContain("CardHeader,");
        expect(onboarding).toContain("CardTitle,");
        expect(onboarding).toContain('data-sot-control="source-auth-mode"');
        expect(onboarding).toContain('data-sot-control="save-enter"');
        expect(onboarding).not.toContain("src-item");
        expect(onboarding).not.toContain("sp-ico");
        expect(onboarding).not.toContain("src-meta");
        expect(onboarding).not.toContain('className="app"');
        expect(onboarding).not.toContain('className="panel"');
        expect(onboarding).not.toContain('className="onboarding-progress"');
        expect(onboarding).not.toContain('className="onboarding-step-head"');
        expect(onboarding).not.toContain('className="onboarding-step-title"');
        expect(onboarding).not.toContain('className="onboarding-step-sub"');
        expect(onboarding).not.toContain('className="onboarding-step-body"');
        expect(onboarding).not.toContain('className="src-list"');
        expect(onboarding).not.toContain(
            'className="onboarding-progress-segment"',
        );
        expect(onboarding).not.toMatch(
            /className="onboarding-default-source-(step|list|row|swatch)"/,
        );
        expect(onboarding).not.toContain('className="field-help err"');
        expect(onboarding).not.toContain('className="onboarding-actions"');
        expect(onboarding).not.toContain('className="sr-meta-row"');
        expect(onboarding).not.toContain('className="sm"');
        expect(globals).toContain('[data-sot-layout="onboarding-workstation"]');
        expect(globals).toContain('[data-sot-panel="onboarding-steps"]');
        expect(globals).toContain('[data-sot-control="onboarding-step"]');
        expect(globals).toContain(
            '[data-sot-control="onboarding-step"][data-sot-state="active"]',
        );
        expect(globals).toContain('[data-sot-part="onboarding-actions"]');
        expect(globals).toContain(
            '[data-sot-card="onboarding"] > [data-slot="card-header"]',
        );
        expect(globals).toContain(
            '[data-sot-part="onboarding-step-header"][data-slot="card-header"]',
        );
        expect(globals).toContain(
            '[data-sot-part="onboarding-step-body"][data-slot="card-content"]',
        );
        expect(globals).toContain('[data-sot-part="provider-meta"]');
        expect(globals).not.toContain(
            '[data-sot-part="provider-meta"][data-slot="card-header"]',
        );
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-part="onboarding-actions"] [data-slot="button"]',
            ),
        ).toEqual([]);
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-control="provider-card"][data-slot="button"]',
            ),
        ).toEqual([]);
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-control="speaker-profile-draft"][data-slot="card"]',
            ),
        ).toEqual([]);
        expect(globals).toContain(
            '[data-sot-list="onboarding-default-sources"]',
        );
        expect(globals).toContain(
            '[data-sot-control="onboarding-default-source"]',
        );
        expect(globals).toContain(
            '[data-sot-part="onboarding-default-source-swatch"]',
        );
        expect(globals).not.toMatch(
            /\.onboarding-default-source-(list|row|swatch)\b/,
        );
        expect(onboarding).not.toMatch(OLD_UI_CONTRACT_RE);
    });

    it("keeps dashboard source, search, activity, list, and settings SOT entries", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const sourceReportPanel = readSource(
            "features/recordings/components/source-report-panel.tsx",
        );
        const globals = readSource("app/globals.css");

        expect(workstation).toContain(
            'data-sot-surface="dashboard-workstation"',
        );
        expect(workstation).toContain('data-sot-shell="dashboard-workstation"');
        expect(workstation).toContain('data-sot-panel="dashboard-sidebar"');
        expect(workstation).toContain('data-sot-list="dashboard-nav"');
        expect(workstation).toContain('data-sot-panel="dashboard-main"');
        expect(workstation).toContain('data-sot-panel="dashboard-topbar"');
        expect(workstation).toContain('data-sot-panel="dashboard-workspace"');
        expect(workstation).toContain('data-sot-panel="dashboard-detail"');
        expect(workstation).toContain(
            'data-sot-control="dashboard-drawer-trigger"',
        );
        expect(workstation).toContain('id="drawer-scrim"');
        expect(workstation).toContain('id="drawer-trigger"');
        expect(workstation).not.toContain("data-drawer-open=");
        expect(workstation).not.toContain(
            'data-sot-surface="dashboard-source-rail"',
        );
        expect(workstation).toContain('data-sot-list="dashboard-sources"');
        expect(workstation).toContain(
            'data-sot-control="dashboard-source-provider"',
        );
        expect(workstation).toContain("DASHBOARD_NAV_BUTTON_CLASS");
        expect(workstation).toContain("DASHBOARD_SOURCE_BUTTON_CLASS");
        expect(workstation).toContain("DASHBOARD_SYNC_BUTTON_CLASS");
        expect(workstation).toContain(
            "DASHBOARD_SIDEBAR_COLLAPSE_BUTTON_CLASS",
        );
        expect(workstation).toContain("DASHBOARD_SETTINGS_AVATAR_BUTTON_CLASS");
        expect(workstation).toContain(
            'data-sot-panel="dashboard-source-filter-stack"',
        );
        for (const removedListHeaderClass of [
            'className="list-header"',
            'className="lh-titlebar"',
            'className="lh-title"',
            'className="lh-count"',
            'className="stack-strip"',
            'className="xref-strip"',
            'className="list-mode-bar"',
            'className="list-mode-seg"',
        ]) {
            expect(workstation).not.toContain(removedListHeaderClass);
        }
        expect(workstation).toContain('data-sot-control="source-filter-widen"');
        const sourceProviderRows = extractBoundedSlice(
            workstation,
            "{sourceRows.map((item) => {",
            'data-sot-panel="dashboard-sync"',
        );
        const sourceFilterStackStart = workstation.indexOf(
            'data-sot-panel="dashboard-source-filter-stack"',
        );
        const sourceFilterStackEnd = workstation.indexOf(
            "</output>",
            sourceFilterStackStart,
        );
        expect(sourceFilterStackStart).toBeGreaterThanOrEqual(0);
        expect(sourceFilterStackEnd).toBeGreaterThan(sourceFilterStackStart);
        const sourceFilterStack = workstation.slice(
            sourceFilterStackStart,
            sourceFilterStackEnd,
        );
        const legacySourceRowClassNamePattern =
            /className=(?:"[^"]*\b(?:nav-source|is-active-filter|is-connected-idle|is-syncing|is-sync-error|is-no-results|is-needs-setup|is-not-connected|is-expired|is-disabled|src-ico|src-status|src-action)\b[^"]*"|\{[^}]*\b(?:nav-source|is-active-filter|is-connected-idle|is-syncing|is-sync-error|is-no-results|is-needs-setup|is-not-connected|is-expired|is-disabled|src-ico|src-status|src-action)\b[^}]*\})/;
        const legacySourceFilterActionClassNamePattern =
            /className=(?:"[^"]*\b(?:src-action|is-retry|is-connect|is-reauth)\b[^"]*"|\{[^}]*\b(?:src-action|is-retry|is-connect|is-reauth)\b[^}]*\})/;
        const legacySourceAttributePattern =
            /\bdata-(?:connected|provider|source|source-status|source-action-state)=/;

        expect(sourceProviderRows).not.toContain('className="nav-item"');
        expect(sourceProviderRows).toContain(
            'data-sot-control="dashboard-source-provider"',
        );
        expect(sourceProviderRows).toContain('variant="ghost"');
        expect(sourceProviderRows).toContain('size="sm"');
        expect(sourceProviderRows).toContain(
            'data-sot-part="source-provider-mark"',
        );
        expect(sourceProviderRows).toContain('data-sot-variant="image"');
        expect(sourceProviderRows).toContain('data-sot-variant="letter"');
        expect(sourceProviderRows).toContain("data-sot-provider-cover={");
        expect(sourceProviderRows).toContain(
            'data-sot-part="source-provider-status"',
        );
        expect(sourceProviderRows).toContain(
            'data-sot-part="source-provider-label"',
        );
        expect(sourceProviderRows).toContain(
            'data-sot-part="source-provider-action"',
        );
        expect(sourceProviderRows).toContain("data-sot-action={actionKind}");
        expect(sourceProviderRows).toContain("data-state={sourceRowState}");
        expect(sourceProviderRows).not.toMatch(legacySourceRowClassNamePattern);
        expect(sourceProviderRows).not.toMatch(legacySourceAttributePattern);
        expect(sourceFilterStack).toContain(
            "data-state={sourceFilterStackState}",
        );
        expect(sourceFilterStack).toContain(
            'data-sot-part="source-filter-action"',
        );
        expect(sourceFilterStack).toContain('data-sot-action="retry"');
        expect(sourceFilterStack).toContain('data-sot-action="widen"');
        expect(sourceFilterStack).toContain('data-sot-action="open-settings"');
        expect(sourceFilterStack).not.toMatch(
            legacySourceFilterActionClassNamePattern,
        );
        expect(sourceFilterStack).not.toMatch(legacySourceAttributePattern);
        expect(globals).toContain(
            '[data-sot-control="dashboard-source-provider"][data-sot-state="sync-error"]',
        );
        for (const selector of DASHBOARD_SHELL_NAV_PRIMITIVE_REPAINT_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_SOURCE_PROVIDER_DIRECT_STATE_SELECTORS) {
            const directStateBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(({ prelude }) => !prelude.includes("[data-sot-part="));

            expect(directStateBlocks).toEqual([]);
        }
        expect(globals).toContain(
            '[data-sot-part="source-provider-mark"][data-sot-variant="letter"]',
        );
        expect(globals).toContain(
            '[data-sot-part="source-provider-action"][data-sot-action="retry"]',
        );
        expect(globals).toMatch(
            /\[data-sot-panel="dashboard-source-filter-stack"\]\s+\[data-sot-part="source-filter-action"\]\[data-sot-action="widen"\]/,
        );
        expect(workstation).toContain('data-sot-control="dashboard-search"');
        expect(workstation).toContain('data-sot-panel="library-search"');
        expect(workstation).toContain('data-sot-list="library-search-results"');
        expect(workstation).toContain("groupedSearchResults.map");
        expect(workstation).toContain("group.results.map");
        expect(workstation).toContain('data-sot-control="dashboard-activity"');
        expect(workstation).toContain('data-sot-panel="dashboard-activity"');
        expect(workstation).toMatch(
            /<div\s+data-sot-format="mono"\s+data-sot-part="dashboard-activity-status-sub"\s*>/,
        );
        expect(globals).toContain(
            '[data-sot-part="dashboard-activity-status-sub"]',
        );
        expect(workstation).toContain("visibleActivityItems.map");
        expect(workstation).toContain('data-sot-control="dashboard-settings"');
        expect(workstation).toContain('data-sot-part="dashboard-user-avatar"');
        expect(workstation).toContain("DASHBOARD_SETTINGS_AVATAR_BUTTON_CLASS");
        expect(workstation).toMatch(
            /<Button\s+asChild\s+variant="ghost"\s+size="icon-sm"[\s\S]*className=\{DASHBOARD_SETTINGS_AVATAR_BUTTON_CLASS\}[\s\S]*>\s*<button[\s\S]*data-sot-control="dashboard-settings"[\s\S]*data-sot-part="dashboard-user-avatar"/,
        );
        expect(globals).not.toContain(
            '[data-sot-control="dashboard-settings"][data-sot-part="dashboard-user-avatar"]',
        );
        expect(workstation).not.toMatch(
            /className\s*=\s*(?:["'](?:mono|avatar)["']|\{["'](?:mono|avatar)["']\})/,
        );
        expect(workstation).not.toContain('className="panel list-panel"');
        expect(workstation).not.toContain('className="real-list"');
        const recordingListCard = extractBoundedSlice(
            workstation,
            "<Card\n                        hasNoPadding",
            'data-sot-part="dashboard-recording-list-header"',
        );
        expect(recordingListCard).toContain(
            'className="min-h-0 gap-0 rounded-2xl"',
        );
        expect(recordingListCard).toContain(
            'data-sot-surface="dashboard-recording-list"',
        );
        expect(recordingListCard).toContain(
            'className="flex min-h-0 flex-col p-0"',
        );
        expect(recordingListCard).toContain(
            'data-sot-part="dashboard-recording-list-content"',
        );
        expect(globals).not.toMatch(
            DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_RE,
        );
        expect(workstation).toContain(
            'data-sot-list="dashboard-recording-rows"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-status"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-status-dot"',
        );
        expect(workstation).not.toContain("rowStatus.className");
        expect(workstation).not.toContain("rowStatus.dotClassName");
        expect(workstation).not.toContain("data-selected=");
        expect(workstation).toContain(
            'data-sot-panel="dashboard-detail-empty"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-detail-empty-title"',
        );
        expect(workstation).not.toContain('className="detail-empty"');
        expect(workstation).not.toContain('className="detail-empty-ico"');
        expect(workstation).not.toContain('className="detail-empty-title"');
        expect(workstation).not.toContain('className="detail-empty-sub"');
        expect(globals).toContain('[data-sot-list="dashboard-recording-rows"]');
        const recordingRowIndex = workstation.indexOf(
            'data-sot-control="dashboard-recording-row"',
        );
        const recordingRowMetaIndex = workstation.indexOf(
            'data-sot-part="dashboard-recording-row-meta"',
            recordingRowIndex,
        );
        const recordingRowDurationIndex = workstation.indexOf(
            'data-sot-part="dashboard-recording-duration"',
            recordingRowMetaIndex,
        );
        const recordingRowSourceMark = workstation.slice(
            recordingRowMetaIndex,
            recordingRowDurationIndex,
        );
        const legacySourceMiniClassNamePattern =
            /className=(?:"[^"]*\bsrc-mini\b[^"]*"|\{[^}]*\bsrc-mini\b[^}]*\})/;

        expect(recordingRowIndex).toBeGreaterThanOrEqual(0);
        expect(recordingRowMetaIndex).toBeGreaterThanOrEqual(0);
        expect(recordingRowDurationIndex).toBeGreaterThan(
            recordingRowMetaIndex,
        );
        expect(recordingRowSourceMark).toContain(
            'data-sot-part="dashboard-recording-source-mark"',
        );
        expect(recordingRowSourceMark).toContain('data-sot-variant="image"');
        expect(recordingRowSourceMark).toContain('data-sot-variant="letter"');
        expect(recordingRowSourceMark).toContain("data-sot-provider-cover={");
        expect(recordingRowSourceMark).not.toMatch(
            legacySourceMiniClassNamePattern,
        );
        expect(workstation).toContain(
            'data-sot-panel="dashboard-recording-time-filter"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-recording-time-filter"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-time-filter-count"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-body"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-title"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-actions"',
        );
        expect(workstation).toContain("aria-current={");
        expect(workstation).not.toContain('className="filter-row"');
        expect(workstation).not.toContain('"chip-f"');
        expect(workstation).not.toContain('"chip-f active"');
        expect(workstation).not.toContain('className="chip-c"');
        expect(workstation).not.toContain('className="row"');
        expect(workstation).not.toContain('"row active"');
        expect(workstation).not.toContain('className="body"');
        expect(workstation).not.toContain('className="title"');
        expect(workstation).not.toContain('className="meta"');
        expect(workstation).not.toContain('className="dur"');
        expect(workstation).not.toContain('className="right"');
        expect(globals).toContain(
            '[data-sot-part="dashboard-recording-source-mark"]',
        );
        expect(globals).toContain(
            '[data-sot-part="dashboard-recording-source-mark"][data-sot-provider-cover="true"]',
        );
        expect(globals).toContain(
            '[data-sot-part="dashboard-recording-source-mark"][data-sot-variant="letter"]',
        );
        expect(workstation).toContain("<Button");
        expect(workstation).toContain('variant="ghost"');
        expect(workstation).toContain('size="icon-sm"');
        expect(workstation).toContain('size="icon-lg"');
        expect(workstation).toContain(
            'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
        );
        expect(workstation).toContain(
            'import { Separator } from "@/components/ui/separator";',
        );
        const dashboardPlayerSurfaceIndex = workstation.indexOf(
            'data-sot-surface="dashboard-recording-player"',
        );
        const dashboardPlayerStart = workstation.lastIndexOf(
            "<Card",
            dashboardPlayerSurfaceIndex,
        );
        const dashboardTranscriptShellIndex = workstation.indexOf(
            'data-sot-panel="dashboard-transcript-shell"',
            dashboardPlayerSurfaceIndex,
        );
        const dashboardPlayerEnd = workstation.lastIndexOf(
            "<Card",
            dashboardTranscriptShellIndex,
        );
        expect(dashboardPlayerSurfaceIndex).toBeGreaterThanOrEqual(0);
        expect(dashboardPlayerStart).toBeGreaterThanOrEqual(0);
        expect(dashboardTranscriptShellIndex).toBeGreaterThan(
            dashboardPlayerSurfaceIndex,
        );
        expect(dashboardPlayerEnd).toBeGreaterThan(dashboardPlayerStart);
        const dashboardPlayer = workstation.slice(
            dashboardPlayerStart,
            dashboardPlayerEnd,
        );
        expect(dashboardPlayer).toContain("<Card");
        expect(dashboardPlayer).toContain("hasNoPadding");
        expect(dashboardPlayer).toContain(
            'className="gap-0 overflow-visible p-4"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-surface="dashboard-recording-player"',
        );
        expect(dashboardPlayer).toContain("<Alert");
        expect(dashboardPlayer).toContain("<AlertTitle");
        expect(dashboardPlayer).toContain("<AlertDescription");
        expect(dashboardPlayer).toContain(
            'data-sot-part="dashboard-recording-player-no-audio"',
        );
        expect(dashboardPlayer).toContain("<CardHeader");
        expect(dashboardPlayer).toContain(
            'className="mb-3 flex flex-row flex-wrap items-center gap-2.5 p-0"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-part="dashboard-recording-player-meta"',
        );
        expect(dashboardPlayer).toContain("<CardContent");
        expect(dashboardPlayer).toContain(
            'className="flex min-w-0 items-center gap-3 overflow-visible p-0"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-panel="dashboard-recording-player-controls"',
        );
        expect(dashboardPlayer).toContain("<Badge");
        expect(dashboardPlayer).toContain('variant="outline"');
        expect(dashboardPlayer).toContain('className="ml-auto"');
        expect(dashboardPlayer).toContain('data-sot-control="player-status"');
        expect(dashboardPlayer).toContain(
            "data-sot-tone={selectedPlayerStatus.tone}",
        );
        expect(dashboardPlayer).toContain("<Button");
        expect(dashboardPlayer).toContain(
            'data-sot-control="dashboard-player-play"',
        );
        expect(dashboardPlayer).toContain("<Slider");
        expect(dashboardPlayer).toContain(
            'data-sot-part="dashboard-player-current-time"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-part="dashboard-player-duration"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-control="dashboard-player-seek"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-part="dashboard-player-volume-anchor"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-panel="dashboard-player-volume-popover"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-control="dashboard-player-volume-mute"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-control="dashboard-player-volume-slider"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-part="dashboard-player-volume-value"',
        );
        expect(globals).not.toContain(
            '[data-sot-surface="dashboard-recording-player"][data-slot="card"]',
        );
        expect(globals).not.toMatch(
            /\[data-sot-surface="dashboard-recording-player"\]\s+\[data-sot-part="dashboard-recording-player-meta"\]\[data-slot="card-header"\]/,
        );
        expect(globals).not.toMatch(
            /\[data-sot-surface="dashboard-recording-player"\]\s+\[data-sot-panel="dashboard-recording-player-controls"\]\[data-slot="card-content"\]/,
        );
        expect(globals).not.toContain(
            '[data-sot-control="player-status"][data-slot="badge"]',
        );
        expect(globals).toContain(
            '[data-sot-panel="dashboard-player-volume-popover"][data-slot="card"]',
        );
        const volumeLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                /\.(?:vol-anchor|vol-pop|vol-row|vol-mute|vol-ico|vol-range|vol-num)(?![\w-])/.test(
                    text,
                ),
            );

        expect(volumeLegacySelectorLines).toEqual([]);
        for (const selector of [
            '[data-sot-part="dashboard-player-volume-anchor"]',
            '[data-sot-panel="dashboard-player-volume-popover"][data-slot="card"]',
            '[data-sot-part="dashboard-player-volume-row"]',
            '[data-sot-part="dashboard-player-volume-icon"]',
            '[data-sot-control="dashboard-player-volume-slider"][data-slot="slider"]',
            '[data-sot-part="recording-player-volume-anchor"]',
            '[data-sot-panel="recording-player-volume-popover"][data-slot="card"]',
            '[data-sot-part="recording-player-volume-row"]',
            '[data-sot-part="recording-player-volume-icon"]',
            '[data-sot-control="recording-player-volume-slider"][data-slot="slider"]',
        ]) {
            expect(globals).toContain(selector);
        }
        for (const legacyPlayerHook of [
            'className="player"',
            'className="play rounded-full"',
            'className="player-meta"',
            'className="player-controls"',
            'className="player-controls is-disabled"',
            'className="time mono"',
            'className="player-seek"',
            'className="no-audio-banner"',
            'className="no-audio-ico"',
            'className="no-audio-text"',
            'className="no-audio-title"',
            'className="no-audio-sub"',
            'className="vol-anchor"',
            'className="vol-pop"',
            'className="vol-row"',
            'className="vol-mute"',
            'className="vol-ico"',
            'className="vol-range"',
            'className="vol-num mono"',
        ]) {
            expect(dashboardPlayer).not.toContain(legacyPlayerHook);
        }
        expect(dashboardPlayer).not.toMatch(/<input[\s\S]*type="range"/);
        expect(workstation).toContain('data-icon="inline-start"');
        expect(workstation).toContain(
            'data-sot-part="dashboard-sync-indicator"',
        );
        expect(workstation).not.toContain('className="sync-dot"');
        expect(workstation).toContain('openSettings("data-sources")');
        expect(workstation).toContain("listMode");
        expect(workstation).toContain("detailTab");
        expect(workstation).toContain("data-sot-source-report-pane");
        expect(workstation).toContain("data-sot-source-report-state");
        expect(workstation).toContain("data-sot-source-report-empty");
        expect(workstation).toContain("data-sot-source-report-section");
        expect(workstation).toContain("data-sot-source-report-segment");
        expect(workstation).toContain("data-sot-source-report-meta");
        expect(workstation).toContain("data-sot-source-report-actions");
        const sourceReportSkeletonLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                SOURCE_REPORT_SKELETON_LEGACY_CSS_SELECTOR_RE.test(text),
            );

        expect(sourceReportSkeletonLegacySelectorLines).toEqual([]);
        for (const selector of SOURCE_REPORT_SKELETON_PRIMITIVE_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(sourceReportPanel).toContain(
            "const sourceReportCardSkeletonClassNames",
        );
        expect(sourceReportPanel).toContain(
            "const sourceReportSegmentSkeletonClassNames",
        );
        expect(sourceReportPanel).toContain(
            "className={sourceReportCardSkeletonClassNames[size]}",
        );
        expect(sourceReportPanel).toContain(
            "className={sourceReportSegmentSkeletonClassNames[size]}",
        );
        const sourceReportEmptyPrimitive = readSource("components/ui/empty.tsx");
        for (const slot of [
            'data-slot="empty"',
            'data-slot="empty-header"',
            'data-slot="empty-icon"',
            'data-slot="empty-title"',
            'data-slot="empty-description"',
            'data-slot="empty-content"',
        ]) {
            expect(sourceReportEmptyPrimitive).toContain(slot);
        }
        expect(sourceReportEmptyPrimitive).toContain("emptyMediaVariants");
        expect(sourceReportEmptyPrimitive).toContain(
            "VariantProps<typeof emptyMediaVariants>",
        );
        expect(sourceReportPanel).toContain(
            'import {\n    Empty,\n    EmptyDescription,\n    EmptyHeader,\n    EmptyMedia,\n    EmptyTitle,\n} from "@/components/ui/empty";',
        );

        const sourceReportEmptyLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                SOURCE_REPORT_EMPTY_LEGACY_CSS_SELECTOR_RE.test(text),
            );

        expect(sourceReportEmptyLegacySelectorLines).toEqual([]);
        for (const selector of SOURCE_REPORT_EMPTY_PRIMITIVE_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of SOURCE_REPORT_EMPTY_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        const sourceReportNoSourceEmpty = extractBoundedSlice(
            sourceReportPanel,
            '<Empty\n                        className="px-4 py-8"',
            "</Empty>",
        );
        expect(sourceReportNoSourceEmpty).toContain(
            "data-sot-source-report-empty",
        );
        expect(sourceReportNoSourceEmpty).toContain("<EmptyHeader>");
        expect(sourceReportNoSourceEmpty).toContain("<EmptyMedia");
        expect(sourceReportNoSourceEmpty).toContain('variant="icon"');
        expect(sourceReportNoSourceEmpty).toContain(
            "data-sot-source-report-empty-icon",
        );
        expect(sourceReportNoSourceEmpty).toContain(
            "<EmptyTitle data-sot-source-report-empty-title>",
        );
        expect(sourceReportNoSourceEmpty).toContain(
            "<EmptyDescription data-sot-source-report-empty-description>",
        );
        expect(sourceReportNoSourceEmpty).not.toContain("<Alert");
        expect(sourceReportNoSourceEmpty).not.toContain("<AlertTitle");
        expect(sourceReportNoSourceEmpty).not.toContain("<AlertDescription");

        const sourceReportMetricLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                SOURCE_REPORT_METRIC_LEGACY_CSS_SELECTOR_RE.test(text),
            );

        expect(sourceReportMetricLegacySelectorLines).toEqual([]);
        for (const selector of SOURCE_REPORT_METRIC_PRIMITIVE_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of SOURCE_REPORT_METRIC_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        expect(sourceReportPanel).toContain(
            'className="gap-1.5 p-3"',
        );
        expect(sourceReportPanel).toContain(
            "function sourceReportStatusBadgeVariant",
        );
        expect(sourceReportPanel).toContain(
            "variant={sourceReportStatusBadgeVariant(tone)}",
        );
        expect(sourceReportPanel).toContain(
            'className="justify-start whitespace-normal"',
        );

        const sourceReportSectionLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                SOURCE_REPORT_SECTION_LEGACY_CSS_SELECTOR_RE.test(text),
            );

        expect(sourceReportSectionLegacySelectorLines).toEqual([]);
        for (const selector of SOURCE_REPORT_SECTION_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        for (const selector of SOURCE_REPORT_CARD_PRIMITIVE_SELECTORS) {
            const repaintBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(({ declarations }) =>
                SOURCE_REPORT_CARD_PRIMITIVE_REPAINT_DECLARATION_RE.test(
                    declarations,
                ),
            );

            expect(repaintBlocks).toEqual([]);
        }
        expect(sourceReportPanel).toContain("<CardContent");
        expect(sourceReportPanel).toContain(
            '"min-h-0 gap-3.5 overflow-hidden px-5 pt-4 pb-6"',
        );
        expect(sourceReportPanel).toContain(
            'className="flex flex-col gap-3 px-0 sm:flex-row sm:items-start sm:justify-between"',
        );
        expect(sourceReportPanel).toContain(
            'className="inline-flex min-w-0 items-center gap-1.5"',
        );
        const sourceReportActionButtonCssBlocks = [
            ...collectCssRuleBlocks(
                globals,
                "[data-sot-source-report-actions]",
            ),
            ...collectCssRuleBlocks(
                globals,
                "[data-sot-source-report-empty-actions]",
            ),
        ].filter(({ prelude }) => prelude.includes('[data-slot="button"]'));

        expect(sourceReportActionButtonCssBlocks).toEqual([]);
        const sourceReportActions = extractBoundedSlice(
            sourceReportPanel,
            "const sourceActionControls = data ? (",
            ") : null;",
        );
        expect(sourceReportActions).toContain(
            "<div data-sot-source-report-actions>",
        );
        expect(sourceReportActions).toContain('variant="outline"');
        expect(sourceReportActions).toContain('variant="ghost"');
        expect(sourceReportActions).toContain('size="xs"');
        expect(sourceReportActions).toContain(
            'data-sot-control="open-source-record"',
        );
        expect(sourceReportActions).toContain(
            "data-sot-state={openSourceControlState}",
        );
        expect(sourceReportActions).toContain(
            'data-sot-control="repull-source"',
        );
        expect(sourceReportActions).toContain(
            "data-sot-state={repullControlState}",
        );
        expect(sourceReportActions).toContain(
            'aria-busy={repullState === "loading"}',
        );
        const sourceReportEmptyActions = extractBoundedSlice(
            sourceReportPanel,
            "data-sot-source-report-empty-actions",
            "</div>\n                    </Alert>",
        );
        expect(sourceReportEmptyActions).toContain(
            "data-sot-source-report-empty-actions",
        );
        expect(sourceReportEmptyActions).toContain(
            'className="justify-center"',
        );
        expect(sourceReportEmptyActions).toContain('variant="primary"');
        expect(sourceReportEmptyActions).toContain('variant="ghost"');
        expect(sourceReportEmptyActions).toContain('size="xs"');
        expect(sourceReportEmptyActions).toContain(
            'data-sot-control="refresh-source-report"',
        );
        expect(sourceReportEmptyActions).toContain('data-sot-state="error"');
        expect(sourceReportEmptyActions).toContain("disabled={isLoading}");

        const dashboardSourceReportLoaded = extractBoundedSlice(
            workstation,
            'state="loaded"\n                                            subState={sourceReportSubState}',
            "data-sot-source-report-actions",
        );
        for (const hook of DASHBOARD_SOURCE_REPORT_LOADED_SOT_HOOKS) {
            expect(dashboardSourceReportLoaded).toContain(hook);
        }
        for (const hook of DASHBOARD_SOURCE_REPORT_META_VALUE_HELPER_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const legacyClassName of DASHBOARD_SOURCE_REPORT_LOADED_LEGACY_CLASS_NAMES) {
            expect(dashboardSourceReportLoaded).not.toContain(legacyClassName);
        }
        expect(workstation).toContain("<Alert");
        expect(workstation).toContain("<Card");
        expect(workstation).toContain("<Separator");
        expect(workstation).not.toContain('className="t-pane sr-pane"');
        expect(workstation).not.toContain('className="sr-state"');
        expect(workstation).not.toContain('className="sr-empty"');
        expect(workstation).not.toContain('className="sr-section"');
        expect(workstation).not.toContain('className="sr-seg"');
        expect(workstation).not.toContain('className="sr-meta"');
        expect(workstation).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps dashboard detail actions, AI rename, and retx states inline in SOT", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const aiRenamePreview = readSource(
            "features/recordings/components/ai-rename-preview-card.tsx",
        );
        const badge = readSource("components/ui/badge.tsx");
        const button = readSource("components/ui/button.tsx");
        const card = readSource("components/ui/card.tsx");
        const input = readSource("components/ui/input.tsx");
        const globals = readSource("app/globals.css");
        const dashboardTranscriptShell = extractCardSlice(
            workstation,
            'data-sot-panel="dashboard-transcript-shell"',
        );
        const dashboardTranscriptLoadingTurn = extractBoundedSlice(
            workstation,
            "key={`transcript-skeleton:",
            ") : turns.length ? (",
        );
        const dashboardTranscriptReadyTurn = extractBoundedSlice(
            workstation,
            "turns.map((turn, index) => {",
            ") : (",
        );
        const headerPanelIndex = workstation.indexOf(
            'data-sot-panel="dashboard-detail-header"',
        );
        const headerStart = workstation.lastIndexOf(
            "<CardHeader",
            headerPanelIndex,
        );
        const headerEnd = workstation.indexOf("</CardHeader>", headerStart);
        const dashboardDetailHeader = workstation.slice(
            headerStart,
            headerEnd + "</CardHeader>".length,
        );
        const legacyHeaderClassNamePattern =
            /className=(?:"[^"]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^"]*"|\{[^}]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^}]*\})/;

        expect(headerPanelIndex).toBeGreaterThanOrEqual(0);
        expect(headerStart).toBeGreaterThanOrEqual(0);
        expect(headerEnd).toBeGreaterThan(headerStart);
        expect(workstation).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(workstation).toContain(
            'import { Input } from "@/components/ui/input";',
        );
        expect(badge).toContain('data-slot="badge"');
        expect(button).toContain('data-slot="button"');
        expect(button).toContain("data-variant={variant}");
        expect(button).toContain("data-size={size}");
        expect(card).toContain('data-slot="card-header"');
        expect(input).toContain('data-slot="input"');
        expect(dashboardDetailHeader).toContain("<CardHeader");
        expect(dashboardDetailHeader).toContain("<CardTitle");
        expect(dashboardDetailHeader).toContain("<Badge");
        expect(dashboardDetailHeader).toContain("<Button");
        expect(dashboardDetailHeader).toContain("<Input");
        expect(dashboardDetailHeader).toContain(
            'data-sot-panel="dashboard-detail-header"',
        );
        expect(dashboardDetailHeader).toContain("data-rename-mode");
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-title"',
        );
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-title-input"',
        );
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-title-status"',
        );
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-action"',
        );
        expect(dashboardDetailHeader).toContain("data-rh-title");
        expect(dashboardDetailHeader).toContain("data-rh-input");
        expect(dashboardDetailHeader).toContain("data-rh-status");
        expect(dashboardDetailHeader).toContain("data-rh-edit-start");
        expect(dashboardDetailHeader).toContain("data-rh-edit-save");
        expect(dashboardDetailHeader).toContain("data-rh-edit-cancel");
        expect(dashboardDetailHeader).toContain("data-rh-ai-anchor");
        expect(dashboardDetailHeader).toContain("data-rh-ai-trigger");
        expect(dashboardDetailHeader).toContain('data-sot-control="ai-rename"');
        expect(dashboardDetailHeader).toContain('variant="ghost"');
        expect(dashboardDetailHeader).toContain('variant="outline"');
        expect(dashboardDetailHeader).toContain('size="icon-sm"');
        expect(dashboardDetailHeader).toContain('size="sm"');
        expect(dashboardDetailHeader).toContain('className="h-8 flex-1"');
        expect(dashboardDetailHeader).not.toMatch(legacyHeaderClassNamePattern);
        expect(globals).not.toMatch(
            /\[data-sot-panel="dashboard-detail-header"\]\s*\[data-slot="button"\]/,
        );
        expect(globals).not.toMatch(
            /:is\(\s*\[data-sot-panel="dashboard-detail-header"\],\s*\[data-sot-panel="recording-detail-header"\]\s*\)\s*\[data-slot="button"\]/,
        );
        expect(globals).not.toMatch(
            /\[data-sot-part="detail-header-title-input"\]\[data-slot="input"\]\s*{[^}]*\b(?:height|padding|border-radius|background|border|font|color|box-shadow)\s*:/,
        );
        const dashboardDetailHeaderLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_DETAIL_HEADER_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(
                    text,
                ),
            );

        expect(dashboardDetailHeaderLegacySelectorLines).toEqual([]);
        for (const selector of [
            '[data-sot-panel="dashboard-detail"]',
            '[data-sot-panel="dashboard-detail-header"],',
            '[data-sot-panel="recording-detail-header"]',
            '[data-slot="card-header"]',
            '[data-sot-part="detail-header-title"][data-slot="card-title"]',
            '[data-sot-part="detail-header-title-input"]',
            '[data-sot-part="detail-header-title-status"]',
            '[data-sot-part="detail-header-local-badge"]',
            '[data-sot-part="detail-header-action"]',
            '[data-sot-part="detail-header-action-anchor"]',
        ]) {
            expect(globals).toContain(selector);
        }
        expect(workstation).toContain(
            'data-sot-panel="dashboard-retranscription"',
        );
        expect(workstation).toContain("data-retx-state={dashboardRetxState}");
        for (const hook of DASHBOARD_RETRANSCRIPTION_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const className of DASHBOARD_RETRANSCRIPTION_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toMatch(
                new RegExp(`className=\\{?["']${className}["']\\}?`),
            );
        }
        expect(dashboardTranscriptShell).toContain("<Card");
        expect(dashboardTranscriptShell).toContain("hasNoPadding");
        expect(dashboardTranscriptShell).toContain(
            'className="min-h-0 flex-1 gap-0 rounded-2xl"',
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-panel="dashboard-transcript-shell"',
        );
        expect(dashboardTranscriptShell).toContain("<CardHeader");
        expect(dashboardTranscriptShell).toContain(
            'className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3.5 py-3"',
        );
        expect(dashboardTranscriptShell).toContain("<CardContent");
        expect(dashboardTranscriptShell).toContain(
            'className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5"',
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-header"',
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-actions"',
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-body"',
        );
        for (const hook of DASHBOARD_DETAIL_PANE_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const hook of DASHBOARD_TRANSCRIPT_TURN_EMPTY_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const legacyClassName of DASHBOARD_DETAIL_PANE_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toContain(legacyClassName);
        }
        for (const legacyClassName of DASHBOARD_TRANSCRIPT_TURN_EMPTY_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toContain(legacyClassName);
        }
        for (const legacyClass of [
            'className="transcript"',
            'className="transcript-head"',
            'className="transcript-body"',
        ]) {
            expect(dashboardTranscriptShell).not.toContain(legacyClass);
        }
        for (const selector of DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_SELECTORS) {
            const repaintBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(({ declarations }) =>
                DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE.test(
                    declarations,
                ),
            );

            expect(repaintBlocks).toEqual([]);
        }
        expect(dashboardTranscriptLoadingTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-row"',
        );
        expect(dashboardTranscriptLoadingTurn).toContain(
            'data-sot-state="loading"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-row"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-state="ready"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-name"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-time"',
        );
        for (const localTurnSlice of [
            dashboardTranscriptLoadingTurn,
            dashboardTranscriptReadyTurn,
        ]) {
            expect(localTurnSlice).not.toContain('className="speaker"');
            expect(localTurnSlice).not.toContain('className="speaker-name"');
        }
        expect(workstation).toContain('aria-label="详情标签"');
        expect(workstation).toContain(
            'aria-label={isPlaying ? "暂停" : "播放"}',
        );
        expect(workstation).toContain("previewAutoRename");
        expect(workstation).toContain("applyAiRename");
        expect(workstation).toContain("<AiRenamePreview");
        expect(workstation).toContain("state={aiState}");
        expect(workstation).toContain('title="AI 标题预览"');
        expect(aiRenamePreview).toContain('data-sot-panel="ai-rename-preview"');
        expect(aiRenamePreview).toContain("data-sot-state={state}");
        expect(aiRenamePreview).toContain("aria-label={title}");
        expect(aiRenamePreview).toContain('from "@/components/ui/alert";');
        expect(aiRenamePreview).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(aiRenamePreview).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(aiRenamePreview).toContain('from "@/components/ui/card";');
        expect(aiRenamePreview).toContain("<Card");
        expect(aiRenamePreview).toContain("<CardHeader");
        expect(aiRenamePreview).toContain("<CardContent");
        expect(aiRenamePreview).toContain("<CardFooter");
        expect(aiRenamePreview).toContain("<Alert");
        expect(aiRenamePreview).toContain("<Badge");
        expect(aiRenamePreview).toContain("<Button");
        expect(aiRenamePreview).toContain('data-sot-part="head"');
        expect(aiRenamePreview).toContain('data-sot-part="body"');
        expect(aiRenamePreview).toContain('data-sot-part="actions"');
        expect(aiRenamePreview).toContain('data-sot-part="review-row"');
        expect(aiRenamePreview).toContain('data-sot-part="review-old"');
        expect(aiRenamePreview).toContain('data-sot-part="review-new"');
        for (const rawClass of [
            "ai-rename-panel",
            "airp-head",
            "airp-head-l",
            "airp-eyebrow",
            "airp-sub",
            "airp-close",
            "airp-body",
            "airp-state",
            "airp-spinner",
            "airp-msg",
            "airp-label",
            "airp-title",
            "airp-hint",
            "airp-error-icon",
            "airp-actions",
            "airp-spacer",
            "airp-review-row",
            "airp-review-line",
            "airp-review-tag",
            "airp-review-old",
            "airp-review-new",
            "data-airp-",
            "mergeAiRenameClassName",
        ]) {
            expect(aiRenamePreview).not.toContain(rawClass);
        }
        expect(workstation).toContain("onApply={applyAiRename}");
        expect(workstation).toContain('aria-label="更多操作"');
        expect(workstation).toContain('from "@/components/ui/dropdown-menu"');
        expect(workstation).toContain("<DropdownMenu");
        expect(workstation).toContain("open={moreOpen}");
        expect(workstation).toContain("onOpenChange={(open) =>");
        expect(workstation).toContain("<DropdownMenuTrigger asChild>");
        expect(workstation).toContain("<DropdownMenuContent");
        expect(workstation).toContain('data-sot-menu="recording-more-actions"');
        expect(workstation).toContain('data-sot-menu-item="rename"');
        expect(workstation).toContain('data-sot-menu-item="ai-rename"');
        expect(workstation).toContain('data-sot-menu-item="retranscribe"');
        expect(workstation).toContain('data-sot-menu-item="delete-local"');
        expect(workstation).toContain('data-sot-tone="danger"');
        expect(workstation).toContain("<DropdownMenuSeparator");
        expect(workstation).toContain('data-sot-menu-separator="delete"');
        expect(workstation).toContain("data-sot-menu-hint");
        expect(workstation).not.toContain('className="more-menu"');
        expect(workstation).not.toContain('className="more-menu-item"');
        expect(workstation).not.toContain('className="more-menu-sep"');
        expect(workstation).not.toContain('className="more-menu-hint"');
        expect(workstation).toContain("AI 重命名");
        expect(workstation).toContain("重新转写");
        expect(workstation).toContain("重新转写这条录音？");
        expect(workstation).toContain("确认重新转写");
        expect(workstation).toContain("逐字稿将重新生成 · 估计 1 ~ 3 分钟");
        expect(workstation).toContain("来源持有正本");
        expect(workstation).toContain("永久删除");
        expect(workstation).toContain("删除后转写、标签与 AI 标题都会一并清除");
        expect(workstation).toContain('data-copy="source-transcript"');
        expect(workstation).toContain('data-copy="source-report"');
        expect(workstation).toContain(
            'data-sot-control="copy-source-transcript"',
        );
        expect(workstation).toContain('data-sot-control="copy-source-report"');
        expect(workstation).toContain('data-sot-control="open-source-record"');
        expect(workstation).toContain('data-sot-control="repull-source"');
        expect(workstation).not.toContain('className="more-action"');
        expect(workstation).not.toContain("more-action-l");
        expect(workstation).not.toContain("more-action-meta");
        expect(workstation).toContain("void deleteRecording()");
        expect(workstation).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps settings and recording detail surfaces on SOT state contracts", () => {
        const settings = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const detail = readSource("features/recordings/workstation.tsx");
        const player = readSource(
            "features/recordings/components/recording-player.tsx",
        );
        const sotPlayerPrimitives = readSource(
            "features/recordings/components/sot-player-primitives.tsx",
        );
        const recordingTagVisuals = readSource(
            "features/recordings/components/recording-tag-visuals.tsx",
        );
        const tagManager = readSource(
            "features/recordings/components/recording-tag-manager.tsx",
        );
        const sourceReport = readSource(
            "features/recordings/components/source-report-panel.tsx",
        );
        const transcriptionSection = readSource(
            "features/recordings/components/transcription-section.tsx",
        );
        const transcriptionSkeletons = readSource(
            "features/recordings/components/transcription-skeletons.tsx",
        );
        const speakerReview = readSource(
            "features/recordings/components/speaker-label-editor.tsx",
        );
        const badge = readSource("components/ui/badge.tsx");
        const globals = readSource("app/globals.css");

        expect(settings).toContain('data-sot-surface="settings-data-sources"');
        expect(settings).toContain('data-sot-panel="source-provider-detail"');
        expect(detail).toContain('data-sot-shell="recording-workstation"');
        expect(detail).toContain('data-sot-panel="workstation-sidebar"');
        expect(detail).toContain('data-sot-panel="workstation-main"');
        expect(detail).toContain('data-sot-panel="workstation-topbar"');
        expect(detail).toContain('data-sot-panel="workstation-workspace"');
        expect(detail).toContain(
            'data-sot-panel="recording-workstation-detail"',
        );
        expect(detail).toContain('data-sot-control="recording-detail-back"');
        expect(detail).not.toContain('className="app"');
        expect(detail).not.toContain('className="sidebar glass glass-strong"');
        expect(detail).not.toContain('className="workspace"');
        expect(detail).not.toContain('className="detail"');
        expect(settings).toContain("data-sot-provider-card");
        expect(settings).toContain("data-sot-provider-icon");
        expect(settings).toContain("data-sot-provider-meta");
        expect(settings).toContain("data-sot-provider-status");
        expect(settings).not.toContain("sp-card");
        expect(settings).not.toContain("sp-ico");
        expect(settings).not.toContain("sp-meta");
        expect(settings).not.toContain("sp-status");
        for (const hook of SOURCE_AUTH_MODE_DATA_SOT_SOURCE_HOOKS) {
            expect(settings).toContain(hook);
        }
        expect(settings).toContain('tone: "personal"');
        expect(settings).toContain("<ToggleGroup");
        expect(settings).toContain("<ToggleGroupItem");
        expect(settings).toContain("<Badge");
        expect(settings).toContain("variant={");
        expect(badge).toContain('data-slot="badge"');
        expect(badge).toContain("data-variant={variant}");
        const providerPrimitiveRepaintSelectors = [
            '[data-sot-provider-card][data-slot="button"]',
            '[data-sot-provider-status][data-slot="badge"]',
        ];
        const forbiddenProviderPrimitiveRepaintDeclaration =
            /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|letter-spacing|line-height|padding|transition)\s*:|\b(?:color-mix|oklch|linear-gradient)\(/m;
        const settingsDataSourcePrimitiveRepaintTargets = [
            {
                label: "provider detail field",
                preludeIncludes: ['[data-sot-panel="source-provider-detail"]'],
                selectorFragment: '[data-slot="field"]',
            },
            {
                label: "provider detail input",
                preludeIncludes: ['[data-sot-panel="source-provider-detail"]'],
                selectorFragment: '[data-slot="input"]',
            },
            {
                label: "settings field",
                preludeIncludes: ['[data-sot-panel="settings-scroll-body"]'],
                selectorFragment: '[data-slot="field"]',
            },
            {
                label: "settings save button",
                preludeIncludes: ['[data-sot-panel="settings-save-actions"]'],
                selectorFragment: '[data-slot="button"]',
            },
            {
                label: "source action button",
                preludeIncludes: ['[data-sot-panel="source-actions"]'],
                selectorFragment: '[data-slot="button"]',
            },
            {
                label: "provider meta card header",
                preludeIncludes: ['[data-sot-part="provider-meta"]'],
                selectorFragment: '[data-slot="card-header"]',
            },
        ];
        const forbiddenSettingsDataSourcePrimitiveRepaintDeclaration =
            /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|letter-spacing|line-height|padding|transition|width)\s*:|\b(?:color-mix|oklch|linear-gradient)\(/m;
        for (const selector of providerPrimitiveRepaintSelectors) {
            const blocks = collectCssRuleBlocks(globals, selector);
            expect(blocks.length).toBeGreaterThan(0);
            for (const block of blocks) {
                expect(block.declarations).not.toMatch(
                    forbiddenProviderPrimitiveRepaintDeclaration,
                );
            }
        }
        for (const target of settingsDataSourcePrimitiveRepaintTargets) {
            const repaintBlocks = collectCssRuleBlocks(
                globals,
                target.selectorFragment,
            ).filter(
                ({ prelude, declarations }) =>
                    target.preludeIncludes.every((fragment) =>
                        prelude.includes(fragment),
                    ) &&
                    forbiddenSettingsDataSourcePrimitiveRepaintDeclaration.test(
                        declarations,
                    ),
            );

            expect(
                repaintBlocks,
                `${target.label} should not repaint shadcn primitives from globals.css`,
            ).toEqual([]);
        }
        expect(settings).not.toContain("path-card");
        expect(settings).not.toContain("pc-badge");
        expect(settings).toContain('data-sot-control="source-test"');
        expect(settings).toContain('data-sot-control="source-save"');
        const sourceAuthModeLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                SOURCE_AUTH_MODE_LEGACY_CSS_SELECTOR_RE.test(text),
            );

        expect(sourceAuthModeLegacySelectorLines).toEqual([]);
        for (const selector of SOURCE_AUTH_MODE_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }

        expect(speakerReview).toContain('data-sot-panel="speaker-review"');
        expect(speakerReview).toContain("data-sot-state=");
        expect(speakerReview).toContain("<CardHeader");
        expect(speakerReview).toContain("<ToggleGroup");
        expect(speakerReview).toContain("<Badge");
        expect(speakerReview).toContain("<Alert");
        expect(speakerReview).toContain('data-sot-list="speaker-review-rows"');
        expect(speakerReview).toContain('data-sot-item="speaker-review-row"');
        expect(speakerReview).toContain('data-sot-list="speaker-review-meta"');
        expect(speakerReview).toContain(
            'data-sot-part="speaker-review-transcript-section"',
        );
        expect(speakerReview).toContain(
            'data-sot-list="speaker-review-sample-segments"',
        );
        expect(speakerReview).toContain(
            'data-sot-item="speaker-review-sample-segment"',
        );
        expect(speakerReview).toContain("<section");
        expect(speakerReview).toContain(
            "data-sot-speaker-label={speaker.rawLabel}",
        );
        expect(speakerReview).not.toContain('className="sp-head"');
        expect(speakerReview).not.toContain(
            'className="sp-rows sp-rows-review"',
        );
        expect(speakerReview).not.toContain('className="sp-row"');
        expect(speakerReview).not.toContain('className="sp-row-meta"');
        expect(speakerReview).not.toContain('className="sp-edit-actions"');
        expect(speakerReview).not.toContain('className="sp-suggest-row"');
        expect(speakerReview).not.toContain('className="sr-meta"');
        expect(speakerReview).not.toContain('className="sr-section"');
        expect(speakerReview).not.toContain('className="sr-section-head"');
        expect(speakerReview).not.toContain('className="sr-section-sub"');
        expect(speakerReview).not.toContain('className="sr-segments"');
        expect(speakerReview).not.toContain('className="sr-seg"');
        expect(speakerReview).not.toContain('className="sr-seg-speaker"');
        expect(speakerReview).not.toContain('className="sr-seg-text"');
        expect(transcriptionSection).toContain(
            'data-sot-panel="recording-transcription"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-banner="transcription-job"',
        );
        expect(transcriptionSection).toContain('from "@/components/ui/card";');
        expect(transcriptionSection).toContain("<Card");
        expect(transcriptionSection).toContain("<CardHeader");
        expect(transcriptionSection).toContain("<CardContent");
        expect(transcriptionSection).toContain("<Alert");
        expect(transcriptionSection).toContain("<AlertTitle");
        expect(transcriptionSection).toContain("<Button");
        expect(transcriptionSection).toContain(
            'data-sot-section="recording-transcription-output"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-section="recording-transcription-speaker-review"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-part="recording-transcription-empty"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-control="copy-local-transcript"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-control="retranscribe-local"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-control="start-local-transcription"',
        );
        const transcriptionJobLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                /(^|\n|,)\s*\.tx-(?:banner|banner-ico|banner-text|banner-title|banner-detail|spin|row-chip|row-chip-ico)\b/.test(
                    text,
                ),
            );

        expect(transcriptionJobLegacySelectorLines).toEqual([]);
        for (const selector of RECORDING_TRANSCRIPTION_PRIMITIVE_SELECTORS) {
            const repaintBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(({ declarations }) =>
                RECORDING_TRANSCRIPTION_PRIMITIVE_REPAINT_DECLARATION_RE.test(
                    declarations,
                ),
            );

            expect(repaintBlocks).toEqual([]);
        }
        for (const selector of [
            "[data-sot-banner]",
            "[data-sot-banner-icon]",
            "[data-sot-banner-title]",
            "[data-sot-banner-spinner]",
            "[data-sot-banner-body]",
        ]) {
            const unscopedBannerRepaintBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(
                ({ prelude, declarations }) =>
                    !prelude.includes(
                        ':not([data-sot-banner="transcription-job"])',
                    ) &&
                    !prelude.includes('[data-sot-banner="source-state"]') &&
                    RECORDING_TRANSCRIPTION_PRIMITIVE_REPAINT_DECLARATION_RE.test(
                        declarations,
                    ),
            );

            expect(unscopedBannerRepaintBlocks).toEqual([]);
        }
        expect(transcriptionSection).toContain("<Badge");
        for (const legacyClass of [
            'className="transcript t-pane"',
            'className="transcript-head"',
            'className="transcript-body"',
            'className="sr-section"',
            'className="sr-section-head"',
            'className="sr-section-sub"',
            'className="empty-hint"',
            'className="eh-t"',
            'className="eh-h"',
            'className="turn"',
            'className="speaker"',
            'className="ts"',
        ]) {
            expect(transcriptionSection).not.toContain(legacyClass);
        }
        expect(transcriptionSkeletons).toContain(
            'from "@/components/ui/card";',
        );
        expect(transcriptionSkeletons).toContain(
            'from "@/components/ui/skeleton";',
        );
        expect(transcriptionSkeletons).toContain(
            'data-sot-panel="recording-transcription-skeleton"',
        );
        expect(transcriptionSkeletons).toContain(
            'data-sot-panel="recording-transcription-speaker-review-skeleton"',
        );
        expect(transcriptionSkeletons).toContain(
            'data-sot-panel="recording-transcription-review-skeleton"',
        );
        expect(transcriptionSkeletons).toContain(
            'data-sot-part="recording-transcription-skeleton-line"',
        );
        expect(transcriptionSkeletons).not.toContain(
            "sanitizeSkeletonClassName",
        );
        expect(transcriptionSkeletons).not.toContain(
            "LEGACY_SKELETON_CLASS_NAMES",
        );
        expect(transcriptionSkeletons).not.toContain("mergeSkeletonClassName");
        for (const legacyClass of [
            'className="transcript t-pane"',
            'className="transcript-head"',
            'className="transcript-body"',
            'className="sr-section"',
            'className="sr-segments"',
            'className="sp-row"',
            'className="sp-row-meta"',
            'className="sp-rows"',
            'className="turn"',
            'className="speaker"',
        ]) {
            expect(transcriptionSkeletons).not.toContain(legacyClass);
        }
        const listPanelIndex = detail.indexOf(
            'data-sot-panel="recording-detail-list"',
        );
        const listPanelStart = detail.lastIndexOf("<Card", listPanelIndex);
        const listPanelEnd = detail.indexOf("</Card>", listPanelStart);
        const listPanel = detail.slice(
            listPanelStart,
            listPanelEnd + "</Card>".length,
        );
        const detailHeaderPanelIndex = detail.indexOf(
            'data-sot-panel="recording-detail-header"',
        );
        const detailHeaderStart = detail.lastIndexOf(
            "<CardHeader",
            detailHeaderPanelIndex,
        );
        const detailHeaderEnd = detail.indexOf(
            "</CardHeader>",
            detailHeaderStart,
        );
        const detailHeader = detail.slice(
            detailHeaderStart,
            detailHeaderEnd + "</CardHeader>".length,
        );
        const legacyDetailHeaderClassNamePattern =
            /className=(?:"[^"]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^"]*"|\{[^}]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^}]*\})/;

        expect(detail).toContain('data-sot-surface="recording-workstation"');
        expect(listPanelIndex).toBeGreaterThanOrEqual(0);
        expect(listPanelStart).toBeGreaterThanOrEqual(0);
        expect(listPanelEnd).toBeGreaterThan(listPanelStart);
        expect(listPanel).toContain("<Card");
        expect(listPanel).toContain("hasNoPadding");
        expect(listPanel).toContain("<CardHeader");
        expect(listPanel).toContain("<CardTitle");
        expect(listPanel).toContain("<CardContent");
        expect(listPanel).toContain('data-sot-panel="recording-detail-list"');
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-header"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-title"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-content"',
        );
        expect(listPanel).toContain(
            'data-sot-list="recording-detail-list-rows"',
        );
        expect(listPanel).toContain(
            'data-sot-item="recording-detail-list-row"',
        );
        expect(listPanel).toContain('data-sot-state="selected"');
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-body"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-title"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-meta"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-duration"',
        );
        expect(listPanel).toContain("<SotPlayerSourceTag");
        expect(listPanel).toContain("<SotPlayerStatusBadge");
        for (const legacyClass of [
            'className="panel"',
            'className="list-header"',
            'className="lh-titlebar"',
            'className="lh-title"',
            'className="real-list"',
            'className="row active"',
            'className="body"',
            'className="title"',
            'className="meta"',
            'className="dur mono"',
        ]) {
            expect(listPanel).not.toContain(legacyClass);
        }
        expect(detailHeaderPanelIndex).toBeGreaterThanOrEqual(0);
        expect(detailHeaderStart).toBeGreaterThanOrEqual(0);
        expect(detailHeaderEnd).toBeGreaterThan(detailHeaderStart);
        expect(detail).toContain('data-sot-panel="recording-detail-header"');
        expect(detailHeader).toContain("<CardHeader");
        expect(detailHeader).toContain("<CardTitle");
        expect(detailHeader).toContain("<Badge");
        expect(detailHeader).toContain('data-sot-part="detail-header-title"');
        expect(detailHeader).toContain(
            'data-sot-part="detail-header-title-input"',
        );
        expect(detailHeader).toContain(
            'data-sot-part="detail-header-title-status"',
        );
        expect(detailHeader).toContain('data-sot-part="detail-header-action"');
        expect(detailHeader).toContain("data-rh-edit-start");
        expect(detailHeader).toContain("data-rh-edit-save");
        expect(detailHeader).toContain("data-rh-edit-cancel");
        expect(detailHeader).toContain("<Button");
        expect(detailHeader).toContain("<Input");
        expect(detailHeader).toContain('variant="ghost"');
        expect(detailHeader).toContain('variant="outline"');
        expect(detailHeader).toContain('size="icon-sm"');
        expect(detailHeader).toContain('size="sm"');
        expect(detailHeader).toContain('className="h-8 flex-1"');
        expect(detailHeader).not.toMatch(legacyDetailHeaderClassNamePattern);
        const metadataPanelIndex = detail.indexOf(
            'data-sot-panel="recording-detail-metadata"',
        );
        const metadataStart = detail.lastIndexOf("<Card", metadataPanelIndex);
        const metadataEnd = detail.indexOf("</Card>", metadataStart);
        const metadataPanel = detail.slice(
            metadataStart,
            metadataEnd + "</Card>".length,
        );
        const sourceRecordPanelIndex = detail.indexOf(
            'data-sot-panel="recording-source-record"',
        );
        const sourceRecordStart = detail.lastIndexOf(
            "<Card",
            sourceRecordPanelIndex,
        );
        const sourceRecordEnd = detail.indexOf("</Card>", sourceRecordStart);
        const sourceRecordPanel = detail.slice(
            sourceRecordStart,
            sourceRecordEnd + "</Card>".length,
        );

        expect(detail).toContain(
            'import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";',
        );
        expect(metadataPanelIndex).toBeGreaterThanOrEqual(0);
        expect(metadataStart).toBeGreaterThanOrEqual(0);
        expect(metadataEnd).toBeGreaterThan(metadataStart);
        expect(metadataPanel).toContain("<Card");
        expect(metadataPanel).toContain("<CardHeader");
        expect(metadataPanel).toContain("<CardTitle");
        expect(metadataPanel).toContain("<CardContent");
        expect(metadataPanel).toContain(
            'data-sot-panel="recording-detail-metadata"',
        );
        expect(metadataPanel).toContain(
            'data-sot-part="recording-detail-metadata-header"',
        );
        expect(metadataPanel).toContain(
            'data-sot-part="recording-detail-metadata-title"',
        );
        expect(metadataPanel).toContain(
            'data-sot-part="recording-detail-metadata-body"',
        );
        expect(sourceRecordPanelIndex).toBeGreaterThanOrEqual(0);
        expect(sourceRecordStart).toBeGreaterThanOrEqual(0);
        expect(sourceRecordEnd).toBeGreaterThan(sourceRecordStart);
        expect(sourceRecordPanel).toContain("<Card");
        expect(sourceRecordPanel).toContain("<CardHeader");
        expect(sourceRecordPanel).toContain("<CardTitle");
        expect(sourceRecordPanel).toContain("<CardContent");
        expect(sourceRecordPanel).toContain(
            'data-sot-panel="recording-source-record"',
        );
        for (const part of [
            "recording-source-record-header",
            "recording-source-record-title",
            "recording-source-record-actions",
            "recording-source-record-body",
            "recording-source-record-tabs",
            "recording-source-record-hint",
        ]) {
            expect(sourceRecordPanel).toContain(`data-sot-part="${part}"`);
        }
        for (const marker of [
            "handleCopyLocalTranscript",
            "handleCopyRawTranscript",
        ]) {
            const markerIndex = sourceRecordPanel.indexOf(marker);
            expect(markerIndex).toBeGreaterThanOrEqual(0);
            const copyButtonSource = sourceRecordPanel.slice(
                Math.max(0, markerIndex - 320),
                markerIndex + 1200,
            );

            expect(copyButtonSource).toContain("<Button");
            expect(copyButtonSource).toContain('variant="outline"');
            expect(copyButtonSource).toContain('size="sm"');
            expect(copyButtonSource).toContain(
                '<Copy data-icon="inline-start" />',
            );
        }
        expect(detail).toContain(
            'data-sot-panel="recording-source-record-empty"',
        );
        for (const legacyClass of [
            'className="panel"',
            'className="transcript"',
            'className="transcript-head"',
            'className="rec-h2"',
            'className="transcript-body"',
            'className="detail-empty"',
        ]) {
            expect(metadataPanel).not.toContain(legacyClass);
            expect(sourceRecordPanel).not.toContain(legacyClass);
        }
        expect(detail).not.toContain('className="detail-empty"');
        for (const selector of RECORDING_DETAIL_CARD_PRIMITIVE_SELECTORS) {
            const repaintBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(({ declarations }) =>
                RECORDING_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE.test(
                    declarations,
                ),
            );

            expect(repaintBlocks).toEqual([]);
        }
        for (const selector of [
            '[data-sot-list="recording-detail-list-rows"]',
            '[data-sot-part="recording-source-record-actions"]',
            '[data-sot-part="recording-source-record-tabs"]',
            '[data-sot-part="recording-source-record-hint"]',
        ]) {
            expect(globals).toContain(selector);
        }
        expect(detail).toContain("data-rename-mode=");
        expect(detail).toContain('localDeleteAvailable ? "true" : "false"');
        expect(detail).toContain("data-more-anchor");
        expect(detail).toContain("data-more-trigger");
        expect(detail).toContain('from "@/components/ui/dropdown-menu"');
        expect(detail).toContain("<DropdownMenu");
        expect(detail).toContain("open={moreOpen}");
        expect(detail).toContain("<DropdownMenuTrigger asChild>");
        expect(detail).toContain("<DropdownMenuContent");
        expect(detail).toContain("data-more-menu");
        expect(detail).toContain('data-sot-menu="recording-more-actions"');
        expect(detail).toContain('data-sot-menu-item="rename"');
        expect(detail).toContain('data-sot-menu-item="ai-rename"');
        expect(detail).toContain('data-sot-menu-item="retranscribe"');
        expect(detail).toContain('data-sot-menu-item="delete-local"');
        expect(detail).toContain('data-sot-tone="danger"');
        expect(detail).toContain("<DropdownMenuSeparator");
        expect(detail).toContain('data-sot-menu-separator="delete"');
        expect(detail).toContain("data-sot-menu-hint");
        expect(detail).not.toContain('className="more-menu"');
        expect(detail).not.toContain('className="more-menu-item"');
        expect(detail).not.toContain('className="more-menu-sep"');
        expect(detail).not.toContain('className="more-menu-hint"');
        expect(detail).toContain("handleMoreRetranscribe");
        expect(detail).toContain("SotPlayerSourceTag");
        expect(detail).toContain("SotPlayerStatusBadge");
        expect(detail).toContain("<SotPlayerSourceTag");
        expect(detail).toContain("<SotPlayerStatusBadge");
        expect(detail).not.toContain('className="src-tag"');
        expect(detail).not.toContain('className="b ok"');
        expect(player).toContain('data-sot-surface="recording-player"');
        expect(player).toContain("data-sot-state=");
        expect(player).toContain("aria-label={");
        expect(player).toContain('title="Click to cycle playback speed"');
        expect(player).toContain(
            'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
        );
        expect(player).toContain(
            'import { Card, CardContent, CardHeader } from "@/components/ui/card";',
        );
        expect(player).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(player).toContain("<Alert");
        expect(player).toContain("<AlertTitle");
        expect(player).toContain("<AlertDescription");
        expect(player).toContain("<Card");
        expect(player).toContain("hasNoPadding");
        expect(player).toContain("<CardHeader");
        expect(player).toContain("<CardContent");
        expect(player).toContain("<Button");
        expect(player).toContain('variant="outline"');
        expect(player).toContain('variant="primary"');
        expect(player).toContain('size="icon-lg"');
        expect(player).toContain('data-sot-part="recording-player-no-audio"');
        expect(player).toContain('data-sot-part="recording-player-meta"');
        expect(player).toContain('data-sot-panel="recording-player-controls"');
        expect(player).toContain(
            'data-sot-panel="recording-player-volume-popover"',
        );
        expect(player).toContain(
            'data-sot-control="recording-player-volume-slider"',
        );
        for (const hook of RECORDING_PLAYER_BUTTON_CONTROL_HOOKS) {
            expect(player).toContain(`data-sot-control="${hook}"`);
        }
        for (const selector of RECORDING_PLAYER_CARD_PRIMITIVE_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const hook of RECORDING_PLAYER_BUTTON_CONTROL_HOOKS) {
            const directBlocks = collectCssRuleBlocks(
                globals,
                `[data-sot-control="${hook}"]`,
            );
            const primitiveBlocks = collectCssRuleBlocks(
                globals,
                `[data-sot-control="${hook}"][data-slot="button"]`,
            );

            for (const block of [...directBlocks, ...primitiveBlocks]) {
                expect(block.declarations).not.toMatch(
                    RECORDING_PLAYER_BUTTON_PRIMITIVE_REPAINT_DECLARATION_RE,
                );
            }
        }
        expect(globals).toContain(
            '[data-sot-surface="recording-player"] [data-sot-part="recording-player-meta"]',
        );
        expect(globals).toContain(
            '[data-sot-panel="recording-player-controls"]',
        );
        for (const legacyClass of [
            'className="player"',
            'className="player-meta"',
            'className="player-controls"',
            'className="player-controls is-disabled"',
            'className="time mono"',
            'className="no-audio-banner"',
            'className="no-audio-ico"',
            'className="no-audio-text"',
            'className="no-audio-title"',
            'className="no-audio-sub"',
            'className="vol-anchor"',
            'className="vol-pop"',
            'className="vol-row"',
            'className="vol-mute"',
            'className="vol-ico"',
            'className="vol-range-control"',
            'inputClassName="vol-range"',
            'className="vol-num mono"',
        ]) {
            expect(player).not.toContain(legacyClass);
        }
        expect(tagManager).toContain('data-sot-panel="recording-tag-manager"');
        expect(tagManager).toContain('data-sot-control="recording-tag-toggle"');
        expect(tagManager).toContain('data-sot-part="head"');
        expect(tagManager).toContain('data-sot-part="body"');
        expect(tagManager).toContain('data-sot-part="footer"');
        expect(tagManager).toContain('data-sot-part="picker"');
        expect(tagManager).toContain('data-sot-part="selected-chip"');
        expect(tagManager).toContain('data-sot-part="tag-option"');
        expect(tagManager).toContain('data-sot-part="color-swatch"');
        expect(tagManager).toContain('data-sot-part="icon-option"');
        expect(tagManager).toContain('data-sot-part="toggle-note"');
        expect(tagManager).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(tagManager).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(tagManager).toContain('from "@/components/ui/alert";');
        expect(tagManager).toContain('from "@/components/ui/card";');
        expect(tagManager).toContain('from "@/components/ui/field";');
        expect(tagManager).toContain('from "@/components/ui/input-group";');
        expect(tagManager).toContain('from "@/components/ui/toggle-group";');
        expect(tagManager).toContain("<Card");
        expect(tagManager).toContain("<CardHeader");
        expect(tagManager).toContain("<CardContent");
        expect(tagManager).toContain("<CardFooter");
        expect(tagManager).toContain("<Alert");
        expect(tagManager).toContain("<Badge");
        expect(tagManager).toContain("<Button");
        expect(tagManager).toContain("<Field");
        expect(tagManager).toContain("<InputGroup");
        expect(tagManager).toContain("<InputGroupInput");
        expect(tagManager).toContain("<InputGroupButton");
        expect(tagManager).toContain("<ToggleGroup");
        expect(tagManager).toContain("<ToggleGroupItem");
        expect(tagManager).toContain('data-sot-control="recording-tag-create"');
        expect(tagManager).toContain('variant="primary"');
        expect(tagManager).toContain('size="icon-sm"');
        expect(tagManager).toContain('variant="secondary"');
        expect(tagManager).toContain('className="h-6"');
        expect(tagManager).toContain(
            'className="w-80 max-w-[calc(100vw-2rem)] max-h-[460px] gap-0"',
        );
        expect(tagManager).toContain(
            '<InputGroup className="h-8" data-sot-part="create-row">',
        );
        expect(tagManager).toContain("disabled={!canCreate}");
        expect(tagManager).toContain("onClick={() => void handleCreateTag()}");
        for (const rawClass of [
            "tagm-panel",
            "tagm-head",
            "tagm-title",
            "tagm-close",
            "tagm-body",
            "tagm-opts",
            "tagm-opt",
            "tagm-delete-confirm",
            "tagm-delete-msg",
            "tagm-create",
            "tagm-create-row",
            "tagm-picker",
            "tagm-swatches",
            "tagm-swatch",
            "tagm-icon-grid",
            "tg-pick",
            "tagm-empty",
            "tagm-sec",
            "tagm-chips",
            "tagm-sel-chip",
            "tagm-error",
            "tagm-add-btn",
        ]) {
            expect(tagManager).not.toContain(rawClass);
        }
        expect(tagManager).not.toContain("mergeTagManagerClassName");
        expect(tagManager).not.toContain("transcript t-pane");
        expect(tagManager).not.toContain("className?: string");
        expect(tagManager).not.toContain("cl-note");

        const tagManagerRepaintSelectors = [
            '[data-sot-panel="recording-tag-manager"][data-slot="card"]',
            '[data-sot-part="selected-chip"][data-slot="badge"]',
            '[data-sot-control="recording-tag-manager-close"][data-slot="button"]',
            '[data-sot-control="recording-tag-delete-open"][data-slot="button"]',
            '[data-sot-control="recording-tag-toggle"][data-slot="button"]',
            '[data-sot-control="recording-tag-create"][data-slot="button"]',
            '[data-sot-control="recording-tag-error-retry"][data-slot="button"]',
            '[data-sot-part="footer"]\n    [data-slot="button"]',
            '[data-sot-part="create-row"]\n    [data-slot="input-group-control"]',
        ];
        const forbiddenPrimitiveRepaintDeclaration =
            /^\s*(?:-webkit-backdrop-filter|backdrop-filter|background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|outline|padding|transition|width)\s*:|\b(?:linear-gradient|oklch)\(/m;

        for (const selector of tagManagerRepaintSelectors) {
            const blocks = collectCssRuleBlocks(globals, selector);
            for (const block of blocks) {
                expect(block.declarations).not.toMatch(
                    forbiddenPrimitiveRepaintDeclaration,
                );
            }
        }

        expect(sourceReport).toContain("SAFE_SOURCE_DETAIL_KEYS");
        expect(sourceReport).toContain(
            'data-sot-panel="recording-source-report"',
        );
        expect(sourceReport).toContain(
            'data-sot-panel="recording-source-report-state"',
        );
        expect(sourceReport).toContain("data-sot-state={sourceReportState}");
        expect(sourceReport).toContain(
            'import { Button, type ButtonProps } from "@/components/ui/button";',
        );
        expect(sourceReport).toContain(
            'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
        );
        expect(sourceReport).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(sourceReport).toContain("CardHeader");
        expect(sourceReport).toContain("CardTitle");
        expect(sourceReport).toContain("CardAction");
        expect(sourceReport).toContain("CardDescription");
        expect(sourceReport).toContain(
            'import { Separator } from "@/components/ui/separator";',
        );
        expect(sourceReport).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(sourceReport).toContain(
            'from "@/components/ui/empty";',
        );
        expect(sourceReport).toContain("<Alert");
        expect(sourceReport).toContain("<Empty");
        expect(sourceReport).toContain("<EmptyHeader");
        expect(sourceReport).toContain("<EmptyMedia");
        expect(sourceReport).toContain("<EmptyTitle");
        expect(sourceReport).toContain("<EmptyDescription");
        expect(sourceReport).toContain("<Badge");
        expect(sourceReport).toContain("<Card");
        expect(sourceReport).toContain("<CardHeader");
        expect(sourceReport).toContain("<CardTitle");
        expect(sourceReport).toContain("<CardAction");
        expect(sourceReport).toContain("<CardDescription");
        expect(sourceReport).toContain("<Separator");
        expect(sourceReport).toContain("Copy");
        expect(sourceReport).toContain("Check");
        expect(sourceReport).toContain('data-sot-list="source-report-cards"');
        expect(sourceReport).toContain('data-sot-card="source-report-metric"');
        expect(sourceReport).toContain('data-sot-badge="source-report-status"');
        expect(sourceReport).toContain("data-sot-source-report-header-actions");
        expect(sourceReport).toContain(
            'data-sot-part="source-report-segment-skeleton"',
        );
        expect(sourceReport).toContain(
            'data-sot-part="source-report-copy-label"',
        );
        expect(sourceReport).toContain(
            'data-sot-part="source-report-status-dot"',
        );
        expect(sourceReport).toContain("data-sot-source-report-segment-time");
        expect(sourceReport).toContain('data-sot-format="mono"');
        expect(sourceReport).toContain("data-sot-source-report-meta-value");
        expect(globals).toContain('[data-sot-part="source-report-copy-label"]');
        expect(globals).toContain('[data-sot-part="source-report-status-dot"]');
        expect(globals).toContain(
            '[data-sot-source-report-segment-time][data-sot-format="mono"]',
        );
        expect(globals).toContain(
            '[data-sot-source-report-meta-value][data-sot-format="mono"]',
        );
        expect(sourceReport).toContain("data-sot-source-report-state");
        expect(sourceReport).toContain("data-sot-source-report-empty");
        expect(sourceReport).toContain("data-sot-source-report-section");
        expect(sourceReport).toContain("data-sot-source-report-segment");
        expect(sourceReport).toContain("data-sot-source-report-meta");
        expect(sourceReport).toContain("<Button");
        expect(sourceReport).not.toContain('className="sr-state"');
        expect(sourceReport).not.toContain('className="sr-empty"');
        expect(sourceReport).not.toContain('className="sr-section"');
        expect(sourceReport).not.toContain('className="sr-seg"');
        expect(sourceReport).not.toContain('className="sr-meta"');
        expect(sourceReport).not.toContain('className="sr-card"');
        expect(sourceReport).not.toContain('className="sr-cards"');
        expect(sourceReport).not.toContain('className="sr-pill warn"');
        expect(sourceReport).not.toContain('className="rec-h2"');
        expect(sourceReport).not.toContain('className="t-actions"');
        expect(sourceReport).not.toContain('className="copy-label"');
        expect(sourceReport).not.toContain('className="dot"');
        expect(sourceReport).not.toContain('className="mono"');
        expect(sourceReport).not.toContain('data-sot-panel="source-actions"');
        expect(sourceReport).not.toContain('className="copy-ico"');
        expect(sourceReport).not.toContain("copy-ico-default");
        expect(sourceReport).not.toContain("copy-ico-ok");
        expect(sourceReport).not.toContain("className={className ? `panel");
        expect(sourceReport).not.toContain("sourceReportReadinessPillClass");
        expect(sourceReport).not.toContain("sourceReportSyncPillClass");
        expect(sourceReport).not.toMatch(
            /\bCSSProperties\b|SOURCE_REPORT_LOADING_SKELETON_STYLES|style=\{|sk _is|_is-/,
        );
        expect(sourceReport).not.toMatch(SOURCE_REPORT_LEGACY_SURFACE_RE);
        expect(sotPlayerPrimitives).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(sotPlayerPrimitives).toContain("data-recording-tag-chip");
        expect(sotPlayerPrimitives).toContain("data-recording-tag-add");
        expect(sotPlayerPrimitives).toContain(
            'data-sot-part="recording-tag-overflow"',
        );
        expect(sotPlayerPrimitives).not.toContain("tag-chip-action");
        expect(sotPlayerPrimitives).not.toContain("tag-chip-trigger");
        expect(sotPlayerPrimitives).not.toContain("tag-chip-inline");
        expect(sotPlayerPrimitives).not.toContain("utag-add");
        expect(sotPlayerPrimitives).not.toContain("utag-plus");
        expect(sotPlayerPrimitives).not.toContain("recordingTagColorClassName");
        expect(recordingTagVisuals).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(recordingTagVisuals).toContain("<Badge");
        expect(recordingTagVisuals).toContain("data-recording-tag-chip");
        expect(recordingTagVisuals).not.toContain("utag c-");
        expect(recordingTagVisuals).not.toContain("mergeUserTagClassName");
        expect(sotPlayerPrimitives).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(sotPlayerPrimitives).toContain(
            'data-sot-control="player-source-tag"',
        );
        expect(sotPlayerPrimitives).toContain(
            'data-sot-control="player-status"',
        );
        expect(sotPlayerPrimitives).toContain("<Badge");
        expect(sotPlayerPrimitives).toContain('variant="outline"');
        expect(sotPlayerPrimitives).not.toContain("status-badge-ready");
        expect(sotPlayerPrimitives).not.toContain("_is-");
        const speakerProfiles = readSource(
            "features/settings/components/sections/speaker-profiles-panel.tsx",
        );
        expect(speakerProfiles).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(speakerProfiles).toContain("<Badge");
        expect(speakerProfiles).toContain('data-sot-badge="speaker-state"');
        expect(speakerProfiles).toContain("data-sot-tone={tone}");
        expect(speakerProfiles).not.toContain("sot-speaker-pill");
        for (const source of [player, tagManager, sourceReport]) {
            expect(source).not.toContain('className="btn ghost btn-sm"');
            expect(source).not.toContain('className="btn primary btn-sm"');
            expect(source).not.toContain('className="btn danger btn-sm"');
            expect(source).not.toContain('className="field-input"');
        }
        for (const source of [
            settings,
            detail,
            player,
            tagManager,
            speakerReview,
        ]) {
            expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
        }
    });
});
