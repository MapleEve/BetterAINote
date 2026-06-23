import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(process.cwd(), "src");
const SPEAKER_REVIEW_MERGE_POPOVER_PLACEMENT =
    "absolute right-0 top-[calc(100%+0.5rem)] z-[var(--z-popover-inline)] w-[320px] min-w-[280px]";
const ONBOARDING_DEFAULT_SOURCE_ROOT_REPAINT_SELECTORS = [
    '[data-sot-control="onboarding-default-source"]',
    '[data-sot-control="onboarding-default-source"][data-sot-state="selected"]',
    '[data-sot-control="onboarding-default-source"][data-sot-state="disabled"]',
] as const;

const REMOVED_AUTH_ONBOARDING_CARD_GLOBAL_SELECTORS = [
    '[data-sot-card]:not([data-sot-card="source-report-metric"])',
    '[data-sot-card]:not([data-sot-card="source-report-metric"])\n    + [data-sot-card]:not([data-sot-card="source-report-metric"])',
    '[data-sot-part="card-heading"]',
    '[data-sot-part="card-heading"] + [data-sot-part="card-sub"]',
    '[data-sot-card="auth"]',
    '[data-sot-card="onboarding"]',
] as const;

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

function extractVariantDefinition(source: string, variantName: string) {
    const marker = `${variantName}:\n`;
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.indexOf('"', markerIndex);
    expect(start).toBeGreaterThan(markerIndex);

    for (let index = start + 1; index < source.length; index += 1) {
        if (source[index] === '"' && source[index - 1] !== "\\") {
            return source.slice(markerIndex, index + 1);
        }
    }

    throw new Error(`Unclosed variant definition: ${variantName}`);
}

function extractElementSlice(source: string, marker: string, tagName: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf(`<${tagName}`, markerIndex);
    const end = source.indexOf(`</${tagName}>`, markerIndex);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + tagName.length + 3);
}

function extractOpeningElement(source: string, marker: string, tagName: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    return extractOpeningElementAt(source, markerIndex, tagName);
}

function extractOpeningElementAt(
    source: string,
    markerIndex: number,
    tagName: string,
) {
    const start = source.lastIndexOf(`<${tagName}`, markerIndex);
    const end = source.indexOf(">", markerIndex);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(markerIndex);
    return source.slice(start, end + 1);
}

function collectOpeningElements(source: string, tagName: string) {
    const openings: string[] = [];
    let searchFrom = 0;

    while (searchFrom < source.length) {
        const start = source.indexOf(`<${tagName}`, searchFrom);
        if (start < 0) break;

        let braceDepth = 0;
        let quote: '"' | "'" | "`" | null = null;
        let end = -1;

        for (let index = start + tagName.length + 1; index < source.length; index += 1) {
            const character = source[index];
            const previous = source[index - 1];

            if (quote) {
                if (character === quote && previous !== "\\") {
                    quote = null;
                }
                continue;
            }

            if (
                character === '"' ||
                character === "'" ||
                character === "`"
            ) {
                quote = character;
                continue;
            }

            if (character === "{") {
                braceDepth += 1;
                continue;
            }

            if (character === "}") {
                braceDepth = Math.max(0, braceDepth - 1);
                continue;
            }

            if (character === ">" && braceDepth === 0) {
                end = index;
                break;
            }
        }

        expect(end).toBeGreaterThan(start);
        openings.push(source.slice(start, end + 1));
        searchFrom = end + 1;
    }

    return openings;
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
    /(^|[,\s>{(:])\.(?!(?:dark|toggle-group-swatch(?:-tone-(?:blue|green|orange|purple|red|slate))?)(?:[\s,:[>{]|$))[A-Za-z][\w-]*(?![\w-])/m;

const MODAL_SHELL_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-overlay="settings-shell"]',
    '[data-sot-overlay="confirm-dialog"]',
    '[data-sot-panel="confirm-dialog"]',
    '[data-sot-overlay="settings-shell"][data-state="open"]',
    '[data-sot-overlay="confirm-dialog"][data-state="closed"]',
    '[data-sot-surface="settings-shell"],',
    '[data-sot-content="confirm-dialog"]',
    '[data-sot-surface="settings-shell"][data-state="closed"]',
    '[data-sot-content="confirm-dialog"][data-state="closed"]',
    '[data-sot-part="dialog-icon"]',
    '[data-sot-part="confirm-head"]',
    '[data-sot-part="confirm-body"]',
    '[data-sot-part="confirm-foot"]',
] as const;

const REMOVED_SETTINGS_NAV_GLOBAL_REPAINT_SELECTORS = [
    '[data-sot-control="settings-nav"]',
    '[data-sot-control="settings-nav"]:hover',
    '[data-sot-control="settings-nav"][data-state="active"]',
    '[data-theme="dark"] [data-sot-control="settings-nav"][data-state="active"]',
    '[data-sot-control="settings-nav"] svg',
    '[data-sot-control="settings-nav"]:focus-visible',
    '[data-sot-panel="settings-rail"] [data-sot-control="settings-nav"]',
    '[data-sot-panel="settings-rail"] [data-sot-control="settings-nav"] svg',
] as const;

const REMOVED_SETTINGS_DEAD_TENANT_GLOBAL_SELECTORS = [
    '[data-tenant="single"]',
    "[data-tenant-single]",
    "[data-tenant-multi]",
    '[data-sot-control="settings-nav"][data-sot-section="account"]',
] as const;

const DIALOG_SLOT_GLOBAL_SELECTORS = [
    '[data-slot="dialog-header"]',
    '[data-slot="dialog-title"]',
    '[data-slot="dialog-description"]',
    '[data-slot="dialog-footer"]',
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
    '[data-sot-part="dashboard-sidebar-footer"]',
    "[data-sot-frame]",
    '[data-sot-frame="auth"]',
    '[data-sot-frame="onboarding"]',
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
    '[data-sot-part="source-filter-action"]',
    '[data-sot-part="source-filter-action"]:focus-visible',
    '[data-sot-part="source-filter-action"][disabled]',
    '[data-sot-control="source-filter-clear-all"][data-slot="button"]',
    '[data-sot-control="library-search-filter-clear"][data-slot="button"]',
    '[data-sot-control="recording-list-tag-filter-trigger"][data-slot="button"]',
    '[data-sot-control="recording-list-tag-filter"][data-slot="button"]',
    '[data-sot-panel="recording-list-pagination"] [data-slot="button"]',
    '[data-sot-panel="recording-list-pagination"] [data-slot="button"]:disabled',
] as const;

const DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_RE =
    /\[data-sot-surface="dashboard-recording-list"\]\[data-slot="card"\]|\[data-sot-part="dashboard-recording-list-content"\]\[data-slot="card-content"\]|\[data-sot-part="source-filter-action"\]|\[data-sot-control="(?:source-filter-clear|source-filter-clear-all|library-search-filter-clear|recording-list-tag-filter-trigger|recording-list-tag-filter)"\]\[data-slot="button"\]|\[data-sot-panel="recording-list-pagination"\][\s\S]{0,80}\[data-slot="button"\]/;

const DASHBOARD_RECORDING_ROW_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-list="dashboard-recording-rows"]',
    '[data-sot-part="dashboard-recording-list-group"]',
    '[data-sot-part="dashboard-recording-list-group-heading"]',
    '[data-sot-part="dashboard-recording-list-group-label"]',
    '[data-sot-part="dashboard-recording-list-group-count"]',
    '[data-sot-part="dashboard-recording-list-group-divider"]',
    '[data-sot-control="dashboard-recording-row"]',
    '[data-sot-control="dashboard-recording-row"]:focus-visible',
    '[data-sot-control="dashboard-recording-row"].is-hover-demo',
    '[data-sot-control="dashboard-recording-row"].is-focus-demo',
    '[data-sot-part="dashboard-recording-row-body"]',
    '[data-sot-part="dashboard-recording-row-title"]',
    '[data-sot-part="dashboard-recording-row-meta"]',
    '[data-sot-part="dashboard-recording-row-secondary"]',
    '[data-sot-part="dashboard-recording-row-actions"]',
] as const;

const DASHBOARD_RECORDING_ROW_META_MIGRATED_GLOBAL_SELECTOR_FRAGMENTS = [
    '[data-sot-part="dashboard-recording-duration"]',
    '[data-sot-part="dashboard-recording-timestamp"]',
    '[data-sot-part="dashboard-recording-timestamp-absolute"]',
    '[data-sot-part="dashboard-recording-timestamp-relative"]',
    'body[data-time-style="abs"]',
    '[data-sot-part="dashboard-recording-source-mark"]',
    '[data-sot-part="dashboard-recording-source-mark"] img',
    '[data-sot-part="dashboard-recording-source-mark"][data-sot-provider-cover="true"]',
    '[data-sot-part="dashboard-recording-source-mark"][data-sot-variant="letter"]',
    '[data-theme="dark"] [data-sot-part="dashboard-recording-source-mark"]',
    '[data-theme="dark"] [data-sot-part="dashboard-recording-source-mark"] img',
    '[data-theme="dark"]\n    [data-sot-part="dashboard-recording-source-mark"][data-sot-variant="letter"]',
] as const;

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

const DASHBOARD_SOURCE_PROVIDER_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-control="dashboard-source-provider"]',
    '[data-sot-part="source-provider-mark"]',
    '[data-sot-part="source-provider-status"]',
    '[data-sot-part="source-provider-count"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="syncing"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="sync-error"]',
];

const SOURCE_PROVIDER_REPAIRED_RAW_DARK_RGB_RE =
    /dark:[^"']*rgb\(|(?:bg|border)-\[rgb/;

const DASHBOARD_SHELL_NAV_PRIMITIVE_REPAINT_SELECTORS = [
    '[data-sot-control="sidebar-collapse"][data-slot="button"]',
    '[data-sot-control="dashboard-favorite"][data-slot="button"]',
    '[data-sot-control="dashboard-source-provider"][data-slot="button"]',
    '[data-sot-control="dashboard-sync"][data-slot="button"]',
    '[data-sot-control="dashboard-settings"][data-slot="button"]',
    '[data-sot-control="dashboard-settings"][data-sot-part="dashboard-user-avatar"]',
] as const;

const DASHBOARD_SHELL_SOURCE_BUTTON_CONSTANTS = [
    "NAV",
    "SOURCE",
    "SYNC",
    "SOURCE_ACTION",
    "DRAWER_TRIGGER",
    "SIDEBAR_COLLAPSE",
    "SETTINGS_AVATAR",
].map((buttonName) => `DASHBOARD_${buttonName}_BUTTON_CLASS`);

const DASHBOARD_RECORDING_LIST_BUTTON_VARIANTS = [
    "recordingListChipClear",
    "sourceFilterClear",
    "sourceFilterAction",
    "sourceFilterClearAll",
    "recordingListTagFilterTrigger",
    "recordingListTagFilterOption",
    "recordingListStatePrimary",
    "recordingListStateAction",
    "recordingListPagination",
] as const;

const DASHBOARD_RECORDING_LIST_BUTTON_SIZES = [
    "recordingListChipClear",
    "sourceFilterClear",
    "sourceFilterAction",
    "sourceFilterClearAll",
    "recordingListTagFilterTrigger",
    "recordingListTagFilterOption",
    "recordingListStateAction",
    "recordingListPagination",
] as const;

const SOURCE_FILTER_ACTION_BUTTON_PRIMITIVE_TOKENS = [
    "sourceFilterAction:",
    "cursor-pointer",
    "border-[var(--line-hairline)]",
    "bg-[var(--bg-elevated)]",
    "hover:text-[var(--fg-primary)]",
    "focus-visible:outline-[var(--accent)]",
    "focus-visible:ring-0",
    "disabled:cursor-not-allowed",
    "data-[sot-action=retry]:bg-[var(--alert-destructive-soft-bg)]",
    "data-[sot-action=retry]:hover:bg-[var(--alert-destructive-soft-strong-bg)]",
    "data-[sot-action=widen]:bg-[var(--accent-soft)]",
    "data-[sot-action=open-settings]:bg-[var(--accent-soft)]",
    "dark:bg-[rgb(255_255_255_/_0.05)]",
    "[&_svg]:stroke-current",
    "font-sans",
    "h-[22px]",
    "ml-[6px]",
    "[&_svg:not([class*='size-'])]:size-[11px]",
] as const;

const DASHBOARD_SOURCE_PROVIDER_ACTION_BUTTON_PRIMITIVE_TOKENS = [
    "dashboardSourceAction:",
    "group/source-provider",
    "ml-[6px]",
    "flex-none",
    "cursor-pointer",
    "border-[var(--line-hairline)]",
    "bg-[var(--bg-elevated)]",
    "font-sans",
    "text-[var(--fg-secondary)]",
    "hover:bg-[var(--bg-elevated)]",
    "hover:text-[var(--fg-primary)]",
    "focus-visible:outline-[var(--accent)]",
    "focus-visible:ring-0",
    "disabled:cursor-not-allowed",
    "data-[sot-action=retry]:hidden",
    "data-[sot-action=retry]:border-[var(--source-provider-status-danger-border)]",
    "data-[sot-action=retry]:bg-[var(--source-provider-status-danger-bg)]",
    "data-[sot-action=retry]:hover:bg-[var(--alert-destructive-soft-strong-bg)]",
    "data-[sot-action=connect]:border-[var(--source-provider-primary-border)]",
    "data-[sot-action=connect]:bg-[var(--accent-soft)]",
    "group-hover/source-provider:data-[sot-action=retry]:inline-flex",
    "group-focus-within/source-provider:data-[sot-action=retry]:inline-flex",
    "group-data-[sidebar-collapsed=true]/dashboard-workstation:hidden",
    "dark:bg-[rgb(255_255_255_/_0.05)]",
    "[&_svg]:stroke-current",
    "leading-none",
    "whitespace-nowrap",
    "[&_svg:not([class*='size-'])]:size-[11px]",
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

const RETIRED_LIQUID_TABS_CSS_SELECTORS = [
    '[data-sot-control="liquid-tabs"][data-slot="segmented-tabs"]',
    '[data-sot-control="liquid-tabs"][data-slot="segmented-tabs"][data-sot-size="sm"]',
    '[data-sot-part="liquid-tabs-indicator"]',
    '[data-sot-control="liquid-tab"]',
    '[data-sot-control="liquid-tab"][data-sot-state="active"]',
    '[data-sot-control="liquid-tabs"]',
    '[data-sot-control="liquid-tabs"][data-tabs="3"]',
    '[data-sot-control="liquid-tabs"][data-idx="2"]',
];

const SYSTEM_BANNER_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:sys-banner|sbn-(?:ico|body|title|sub|actions|progress|bar))(?![\w-])/;

const RETIRED_SYSTEM_BANNER_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-icon"]',
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-body"]',
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-title"]',
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-description"]',
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-actions"]',
    '[data-sot-panel="system-banner"] [data-sot-control^="system-banner-"]',
    '[data-sot-panel="system-banner"][data-kind="offline"]',
    '[data-sot-panel="system-banner"][data-kind="permission-denied"]',
    '[data-sot-panel="system-banner"][data-kind="db-locked"]',
    '[data-sot-panel="system-banner"][data-kind="update-available"]',
    '[data-sot-panel="system-banner"][data-kind="import-progress"]',
    '[data-sot-panel="system-banner"][data-kind="export-progress"]',
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-progress"]',
    '[data-sot-panel="system-banner"][data-pct="0"]',
    '[data-sot-panel="system-banner"][data-pct="10"]',
    '[data-sot-panel="system-banner"][data-pct="20"]',
    '[data-sot-panel="system-banner"][data-pct="30"]',
    '[data-sot-panel="system-banner"][data-pct="40"]',
    '[data-sot-panel="system-banner"][data-pct="50"]',
    '[data-sot-panel="system-banner"][data-pct="60"]',
    '[data-sot-panel="system-banner"][data-pct="70"]',
    '[data-sot-panel="system-banner"][data-pct="80"]',
    '[data-sot-panel="system-banner"][data-pct="90"]',
    '[data-sot-panel="system-banner"][data-pct="100"]',
];

const SYSTEM_BANNER_ALERT_PRIMITIVE_TOKENS = [
    "systemBanner",
    "data-[kind=offline]",
    "data-[kind=permission-denied]",
    "data-[kind=db-locked]",
    "data-[kind=update-available]",
    "data-[kind=import-progress]",
    "data-[kind=export-progress]",
    "[&_[data-sot-part=system-banner-icon]]",
    "[&_[data-sot-part=system-banner-body]]",
    "[&_[data-sot-part=system-banner-actions]]",
];

const SYSTEM_BANNER_BUTTON_PRIMITIVE_TOKENS = [
    "systemBannerAction",
    "systemBannerPrimaryAction",
    "systemBannerDismissAction",
    "systemBannerAction:",
    "systemBannerDismissAction:",
];

const SYSTEM_BANNER_PROGRESS_PRIMITIVE_TOKENS = [
    'import { Progress as ProgressPrimitive } from "radix-ui";',
    "systemBanner",
    '"system-banner-progress"',
    '"system-banner-progress-bar"',
    "data-sot-state={dataSotState}",
    "sbn-sweep",
];

const MORE_ACTIONS_MENU_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:more-anchor|more-head|more-action(?:-[\w-]+)?|more-menu(?:-(?:item(?:-shortcut)?|sep|label|hint))?)(?![\w-])/;

const MORE_ACTIONS_MENU_RETIRED_DATA_SOT_CSS_SELECTORS = [
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

const MORE_ACTIONS_MENU_PRIMITIVE_TOKENS = [
    "dropdownMenuContentVariants",
    "glass:",
    "dropdownMenuItemDensities",
    "compact:",
    "dropdownMenuSeparatorDensities",
    "dropdownMenuShortcutVariants",
    "hint:",
    "data-[variant=destructive]",
];

const MORE_ACTIONS_MENU_COMPOSITION_TOKENS = [
    'variant="glass"',
    'density="compact"',
    'variant="destructive"',
    "<DropdownMenuShortcut",
    'variant="hint"',
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
];

const DASHBOARD_TIME_FILTER_RETIRED_GLOBAL_SELECTORS = [
    "--dashboard-recording-time-filter-count-bg",
    "--dashboard-recording-time-filter-count-selected-bg",
    '[data-sot-part="dashboard-recording-time-filter-count"]',
    '[data-sot-control="dashboard-recording-time-filter"][data-sot-state="selected"]',
    '[data-sot-control="dashboard-recording-time-filter"].is-hover-demo',
    '[data-sot-control="dashboard-recording-time-filter"].is-focus-demo',
] as const;

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
    "[data-detail-empty]",
    '[data-sot-panel="recording-route-empty"]',
    '[data-sot-panel="dashboard-detail"][data-empty="true"] [data-detail-empty]',
    '[data-sot-panel="recording-route-empty-detail"][data-empty="true"]\n    [data-detail-empty]',
    '[data-sot-part="recording-route-empty-icon"]',
    '[data-sot-part="recording-route-empty-title"]',
    '[data-sot-part="recording-route-empty-description"]',
];

const DASHBOARD_EMPTY_PRIMITIVE_CSS_SELECTORS = [
    '[data-sot-panel="dashboard-detail-empty"]',
    '[data-sot-part="dashboard-detail-empty-icon"]',
    '[data-sot-part="dashboard-detail-empty-icon"] svg',
    '[data-sot-part="dashboard-detail-empty-title"]',
    '[data-sot-part="dashboard-detail-empty-description"]',
    '[data-sot-part="dashboard-activity-empty"]',
    '[data-sot-part="dashboard-activity-empty-icon"]',
    '[data-sot-part="dashboard-activity-empty-icon"] svg',
    '[data-sot-part="dashboard-activity-empty-title"]',
    '[data-sot-part="dashboard-activity-empty-body"]',
];

const DASHBOARD_TRANSCRIPT_EMPTY_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-panel="dashboard-transcript-empty"]',
    '[data-sot-panel="dashboard-transcript-empty"] > :first-child',
    '[data-sot-part="dashboard-transcript-empty-icon"]',
    '[data-sot-part="dashboard-transcript-empty-icon"] svg',
    '[data-sot-part="dashboard-transcript-empty-message"]',
    '[data-sot-part="dashboard-transcript-empty-sub"]',
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

const DASHBOARD_TRANSCRIPT_SKELETON_PRIMITIVE_SIZES = [
    "dashboardTranscriptAvatar",
    "dashboardTranscriptLine60",
    "dashboardTranscriptLine70",
    "dashboardTranscriptLine78",
    "dashboardTranscriptLine82",
    "dashboardTranscriptLine88",
    "dashboardTranscriptLine92",
    "dashboardTranscriptLine94",
    "dashboardTranscriptLine96",
    "dashboardTranscriptSpeaker120",
    "dashboardTranscriptSpeaker130",
    "dashboardTranscriptSpeaker140",
    "dashboardTranscriptTime",
] as const;

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
    "[data-sot-source-report-empty]",
    '[data-sot-source-report-empty][data-sot-tone="err"]',
    "[data-sot-source-report-empty-icon]",
    '[data-sot-source-report-empty][data-sot-tone="err"]\n    [data-sot-source-report-empty-icon]',
    "[data-sot-source-report-empty-icon] svg",
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
];

const SOURCE_REPORT_METRIC_GENERIC_CARD_SELECTORS = [
    "[data-sot-card]",
    "[data-sot-card] + [data-sot-card]",
];

const SOURCE_REPORT_METRIC_REMOVED_CARD_SELECTORS = [
    '[data-sot-card="source-report-metric"]',
    '[data-sot-card="source-report-metric"][data-sot-metric]',
    '[data-theme="dark"] [data-sot-card="source-report-metric"][data-sot-metric]',
];

const SOURCE_REPORT_METRIC_GLOBAL_REPAINT_SELECTOR_FRAGMENTS = [
    '[data-sot-badge="source-report-status"]',
    '[data-sot-part="source-report-status-dot"]',
    '[data-sot-part="dashboard-source-report-status-dot"]',
];

const SOURCE_REPORT_METRIC_REMOVED_PRIMITIVE_SELECTORS = [
    '[data-sot-badge="source-report-status"][data-sot-tone]',
    '[data-sot-badge="source-report-status"][data-sot-tone="ok"]',
    '[data-sot-badge="source-report-status"][data-sot-tone="warn"]',
    '[data-sot-badge="source-report-status"][data-sot-tone="err"]',
    '[data-sot-badge="source-report-status"][data-sot-tone]\n    [data-sot-part="source-report-status-dot"]',
    '[data-sot-badge="source-report-status"][data-sot-tone]\n    [data-sot-part="dashboard-source-report-status-dot"]',
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

const PLAYER_ALERT_CARD_BADGE_PRIMITIVE_REPAINT_SELECTORS = [
    '[data-sot-part="dashboard-recording-player-no-audio"][data-slot="alert"]',
    '[data-sot-part="dashboard-recording-player-no-audio-title"][data-slot="alert-title"]',
    '[data-sot-part="dashboard-recording-player-no-audio-description"][data-slot="alert-description"]',
    '[data-sot-part="recording-player-no-audio"][data-slot="alert"]',
    '[data-sot-part="recording-player-no-audio-title"][data-slot="alert-title"]',
    '[data-sot-part="recording-player-no-audio-description"][data-slot="alert-description"]',
    '[data-sot-panel="dashboard-player-volume-popover"][data-slot="popover-content"]',
    '[data-sot-panel="recording-player-volume-popover"][data-slot="popover-content"]',
    '[data-sot-control="player-source-tag"][data-slot="badge"]',
] as const;

const PLAYER_PORTAL_VOLUME_SCOPED_SELECTORS = [
    [
        '[data-sot-surface="dashboard-recording-player"]',
        '[data-sot-panel="dashboard-player-volume-popover"]',
    ],
    [
        '[data-sot-surface="dashboard-recording-player"]',
        '[data-sot-panel="dashboard-player-volume-popover"][hidden]',
    ],
    [
        '[data-sot-surface="dashboard-recording-player"]',
        '[data-sot-panel="dashboard-player-volume-popover"][data-open="true"]',
    ],
    [
        '[data-sot-surface="dashboard-recording-player"]',
        '[data-sot-part="dashboard-player-volume-row"]',
    ],
    [
        '[data-sot-surface="dashboard-recording-player"]',
        '[data-sot-part="dashboard-player-volume-icon"]',
    ],
    [
        '[data-sot-surface="dashboard-recording-player"]',
        '[data-sot-part="dashboard-player-volume-value"]',
    ],
    [
        '[data-sot-surface="recording-player"]',
        '[data-sot-panel="recording-player-volume-popover"]',
    ],
    [
        '[data-sot-surface="recording-player"]',
        '[data-sot-panel="recording-player-volume-popover"][hidden]',
    ],
    [
        '[data-sot-surface="recording-player"]',
        '[data-sot-panel="recording-player-volume-popover"][data-open="true"]',
    ],
    [
        '[data-sot-surface="recording-player"]',
        '[data-sot-part="recording-player-volume-row"]',
    ],
    [
        '[data-sot-surface="recording-player"]',
        '[data-sot-part="recording-player-volume-icon"]',
    ],
    [
        '[data-sot-surface="recording-player"]',
        '[data-sot-part="recording-player-volume-value"]',
    ],
] as const;

const PLAYER_SLIDER_CONTROL_HOOKS = [
    "dashboard-player-seek",
    "dashboard-player-volume-slider",
    "recording-player-seek",
    "recording-player-volume-slider",
] as const;

const PLAYER_SLIDER_PRIMITIVE_SLOTS = [
    "slider",
    "slider-track",
    "slider-range",
    "slider-thumb",
] as const;

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

const SOURCE_AUTH_MODE_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-list="source-auth-modes"]',
    '[data-sot-control="source-auth-mode"][data-sot-auth-mode]',
    '[data-theme="dark"] [data-sot-control="source-auth-mode"][data-sot-auth-mode]',
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
    /(^|[^\w-])\.(?:activity-pixel-stage|notif-panel|notif-empty|turn|transcript|transcript-head|transcript-body|speaker|speaker-name|sr-pane|list-empty|empty-state|empty-ico|empty-msg|empty-sub|retx-banner|retx-banner-ico|retx-spinner|retx-disabled-hint|retx-refresh-marker|retx-banner-body|retx-banner-title|retx-banner-sub|retx-banner-actions|retx-ico-warn|retx-ico-ok|t-actions)(?![\w-])/;

const DASHBOARD_TRANSCRIPT_SOURCE_REPORT_RETX_ACTIVITY_SOT_CSS_SELECTORS = [
    '[data-sot-part="dashboard-transcript-body"]',
    '[data-sot-item="dashboard-transcript-turn"]',
    '[data-sot-part="dashboard-transcript-speaker-row"]',
    '[data-sot-part="dashboard-transcript-speaker-name"]',
    '[data-sot-part="dashboard-transcript-speaker-time"]',
    "[data-sot-source-report-pane]",
    '[data-sot-panel="dashboard-retranscription"]',
    '[data-sot-part="dashboard-retranscription-icon"]',
    '[data-sot-part="dashboard-retranscription-spinner"]',
    '[data-sot-part="dashboard-retranscription-refresh-marker"]',
];

const RECORDING_LOADING_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-panel="recording-route-loading-detail"]',
    '[data-sot-panel="recording-list-loading"]',
    '[data-sot-panel="recording-detail-loading"]',
] as const;

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

const DASHBOARD_TRANSCRIPT_COPY_CONTROLS = [
    "copy-source-transcript",
    "copy-source-report",
] as const;

const DASHBOARD_TRANSCRIPT_COMPACT_ACTION_CONTROLS = [
    "refresh-source-report",
] as const;

const DASHBOARD_TRANSCRIPT_GENERIC_COPY_CONTROLS = [
    "copy-local-transcript",
] as const;

const DASHBOARD_TRANSCRIPT_GENERIC_COMPACT_ACTION_CONTROLS = [
    "retranscribe-recording",
    "retry-retranscription",
    "dismiss-retranscription-failed",
    "dismiss-retranscription-complete",
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
    '[data-sot-meta="language"][data-slot="badge"]',
    '[data-sot-meta="source"][data-slot="badge"]',
    '[data-sot-meta="words"][data-slot="badge"]',
    '[data-sot-meta="characters"][data-slot="badge"]',
    '[data-sot-part="recording-transcription-empty"][data-slot="empty"]',
    '[data-sot-part="recording-transcription-empty-title"][data-slot="empty-title"]',
    '[data-sot-part="recording-transcription-empty-description"][data-slot="empty-description"]',
    '[data-sot-control="copy-local-transcript"][data-slot="button"]',
    '[data-sot-control="retranscribe-local"][data-slot="button"]',
    '[data-sot-control="start-local-transcription"][data-slot="button"]',
] as const;

const RECORDING_TRANSCRIPTION_EMPTY_REPAINT_SELECTORS = [
    '[data-sot-part="recording-transcription-empty"]',
    '[data-sot-part="recording-transcription-empty-icon"]',
    '[data-sot-part="recording-transcription-empty-title"]',
    '[data-sot-part="recording-transcription-empty-description"]',
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

const RECORDING_DETAIL_NAV_AND_ROW_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-list="recording-detail-nav"]',
    '[data-sot-part="recording-detail-nav-label"]',
    '[data-sot-control="recording-detail-back"] svg',
    '[data-sot-control="recording-detail-back"] > span',
    '[data-sot-list="recording-detail-list-rows"]',
    '[data-sot-item="recording-detail-list-row"]',
    '[data-sot-item="recording-detail-list-row"]:hover',
    '[data-sot-item="recording-detail-list-row"][data-sot-state="selected"]',
    '[data-sot-part="recording-detail-list-row-body"]',
    '[data-sot-part="recording-detail-list-row-title"]',
    '[data-sot-part="recording-detail-list-row-meta"]',
    '[data-sot-part="recording-detail-list-row-duration"]',
] as const;

const AI_RENAME_PREVIEW_FUNCTIONAL_CSS_SELECTORS = [
    '[data-sot-panel="ai-rename-preview"]',
    '[data-sot-panel="ai-rename-preview"][data-open="true"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="state"][hidden]',
    '.cl-pop-host > [data-sot-panel="ai-rename-preview"]',
] as const;

const AI_RENAME_PREVIEW_VISUAL_REPAINT_CSS_SELECTORS = [
    '[data-sot-panel="ai-rename-preview"][role="dialog"]',
    '[data-theme="dark"] [data-sot-panel="ai-rename-preview"][role="dialog"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="head"]',
    '[data-theme="dark"] [data-sot-panel="ai-rename-preview"] [data-sot-part="head"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="head-copy"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="eyebrow"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="subtitle"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-control="ai-rename-close"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-control="ai-rename-close"] svg',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="body"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="message"]',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-part="state"][data-sot-state="error"]',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-part="state"][data-sot-state="error"]\n    [data-sot-part="state-description"]',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-part="state"][data-sot-state="error"]\n    [data-sot-part="message"]',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-part="state"][data-sot-state="unavailable"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="error-icon"]',
    '[data-sot-panel="ai-rename-preview"][data-sot-state="unavailable"]\n    [data-sot-part="error-icon"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="error-icon"] svg',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="label"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="title"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="hint"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="review-row"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="review-line"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="review-tag"]',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-part="review-tag"][data-sot-review-field="new"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="review-old"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="review-new"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="actions"]',
    '[data-theme="dark"] [data-sot-panel="ai-rename-preview"] [data-sot-part="actions"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="actions-spacer"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-control^="ai-rename-"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-control^="ai-rename-"] svg',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-control^="ai-rename-"]:disabled',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-control^="ai-rename-"][aria-disabled="true"]',
] as const;

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
        const popover = readSource("components/ui/popover.tsx");
        const select = readSource("components/ui/select.tsx");
        const sidebar = readSource("components/ui/sidebar.tsx");
        const switchPrimitive = readSource("components/ui/switch.tsx");
        const textarea = readSource("components/ui/textarea.tsx");
        const toggleGroup = readSource("components/ui/toggle-group.tsx");
        const toaster = readSource("components/ui/sonner.tsx");
        const confirmDialog = readSource("components/ui/confirm-dialog.tsx");
        const layout = readSource("app/layout.tsx");

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
        for (const token of [
            "--button-primary-bg:",
            "--button-primary-hover-bg:",
            "--button-primary-border:",
            "--button-primary-fg:",
            "--button-primary-shadow:",
            "--button-destructive-bg:",
            "--button-destructive-hover-bg:",
            "--button-destructive-border:",
            "--button-destructive-fg:",
            "--button-destructive-shadow:",
        ]) {
            expect(globals).toContain(token);
        }
        expect(globals).toContain(
            "color-mix(in srgb, var(--accent) 92%, white 18%)",
        );
        expect(globals).toContain("oklch(0.62 0.18 25)");
        expect(globals).toContain("@supports not (color: oklch(");
        expect(globals).not.toMatch(/(^|[{\s,])\.panel(?![\w-])/m);
        expect(globals).not.toMatch(/(^|\n|,)\s*\.storage-bar\b/);
        const globalSlotSelectors = globals
            .split("\n")
            .filter((line) => line.includes('[data-slot="'));
        expect(globalSlotSelectors).toEqual([]);
        expect(globals).not.toContain(
            '[data-slot="toggle-group-item"][data-variant="swatch"]',
        );
        expect(globals).not.toContain("--toggle-swatch-");
        expect(toggleGroup).not.toContain("[--toggle-swatch");
        expect(toggleGroup).not.toMatch(
            /--tag-(blue|green|amber|violet|rose|slate)/,
        );
        expect(toggleGroup).toContain("toggle-group-swatch group/swatch");
        expect(toggleGroup).toContain("[display:grid]");
        expect(toggleGroup).toContain("place-items-center");
        expect(toggleGroup).toContain("rounded-[50%]");
        expect(toggleGroup).toContain("text-[13.3333px]");
        expect(toggleGroup).toContain("font-normal");
        expect(toggleGroup).toContain("leading-[0]");
        const swatchBlock = extractCssBlock(globals, ".toggle-group-swatch");
        expect(swatchBlock).toContain("color: var(--fg-primary);");
        expect(swatchBlock).toContain("background: var(--tag-slate);");
        expect(
            collectCssRuleBlocks(
                globals,
                '.toggle-group-swatch[data-state="on"]',
            ).some(({ declarations }) =>
                declarations.includes("border-color: var(--fg-primary);") &&
                declarations.includes(
                    "box-shadow: inset 0 0 0 2px var(--bg-elevated);",
                ),
            ),
        ).toBe(true);
        expect(
            collectCssRuleBlocks(globals, ".toggle-group-swatch").every(
                ({ prelude }) =>
                    !prelude.includes("[data-slot=") &&
                    !prelude.includes("[data-sot-"),
            ),
        ).toBe(true);
        for (const [tone, token] of [
            ["blue", "--tag-blue"],
            ["green", "--tag-green"],
            ["orange", "--tag-amber"],
            ["purple", "--tag-violet"],
            ["red", "--tag-rose"],
            ["slate", "--tag-slate"],
        ]) {
            const toneClass = `toggle-group-swatch-tone-${tone}`;
            expect(toggleGroup).toContain(toneClass);
            expect(
                collectCssRuleBlocks(globals, `.${toneClass}`).some(
                    ({ declarations, prelude }) =>
                        !prelude.includes("[data-sot-") &&
                        declarations.includes(`background: var(${token});`),
                ),
            ).toBe(true);
        }
        const allowedSwatchToneNames = new Set([
            "blue",
            "green",
            "orange",
            "purple",
            "red",
            "slate",
        ]);
        const unexpectedSwatchToneSelectors = Array.from(
            stripCssComments(globals).matchAll(
                /\.toggle-group-swatch-tone-([A-Za-z][\w-]*)/g,
            ),
            ([selector, tone]) => ({ selector, tone }),
        ).filter(({ tone }) => !allowedSwatchToneNames.has(tone));
        expect(unexpectedSwatchToneSelectors).toEqual([]);
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-slot="toggle-group-item"][data-variant="swatch"]',
            ),
        ).toEqual([]);
        expect(
            collectCssRuleBlocks(globals, ".toggle-group-swatch").some(
                ({ declarations }) => declarations.includes("--toggle-swatch-"),
            ),
        ).toBe(false);
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
        expect(globals).not.toContain("[data-sot-shell] *:focus");
        expect(globals).not.toContain('[data-slot="button"]:focus-visible');
        expect(globals).toContain("button:not([data-slot])");
        expect(globals).not.toContain(
            ':where([data-slot="button"], [data-slot="popover-trigger"])',
        );
        expect(globals).not.toContain(
            '[data-sot-control="dashboard-recording-row"]:focus-visible',
        );
        expect(productCss).not.toMatch(
            LEGACY_MODAL_SHELL_PRODUCT_CSS_SELECTOR_RE,
        );
        for (const selector of MODAL_SHELL_DATA_SOT_CSS_SELECTORS) {
            expect(productCss).toContain(selector);
        }
        expect(
            extractCssBlock(productCss, '[data-sot-panel="confirm-dialog"]'),
        ).toContain("z-index: calc(var(--z-modal) + 2);");
        for (const selector of DIALOG_SLOT_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
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
        ).filter(({ prelude }) =>
            /\bbutton\b|\[data-slot="button"\]/.test(prelude),
        );
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
        expect(card).toContain("authSurface:");
        expect(card).toContain("onboardingSurface:");
        expect(card).toContain("onboardingSpeakerDraft:");
        expect(card).toContain("authHeader:");
        expect(card).toContain("onboardingHeader:");
        expect(card).toContain("onboardingStepHeader:");
        expect(card).toContain("onboardingProviderMeta:");
        expect(card).toContain("authHeaderTitle:");
        expect(card).toContain("onboardingHeading:");
        expect(card).toContain("onboardingStepTitle:");
        expect(card).toContain("onboardingProviderName:");
        expect(card).toContain("authHeaderDescription:");
        expect(card).toContain("onboardingSub:");
        expect(card).toContain("onboardingStepDescription:");
        expect(card).toContain("onboardingProviderHint:");
        expect(card).toContain("authFrame:");
        expect(card).toContain("onboardingStepBody:");
        expect(card).toContain("authFrameTitle:");
        expect(card).toContain("authFrameDescription:");
        expect(card).toContain("detailHeader:");
        expect(card).toContain("data-[sot-state=saving]:py-0");
        expect(card).toContain(
            'detailHeaderTitle: "leading-none font-semibold min-w-0 flex-1 truncate"',
        );
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
        const buttonVariantBlock = extractBoundedSlice(
            button,
            "variant: {",
            "size: {",
        );
        const buttonSizeBlock = extractBoundedSlice(
            button,
            "size: {",
            "defaultVariants:",
        );
        for (const focusClass of [
            "outline-none",
            "focus-visible:border-ring",
            "focus-visible:ring-[3px]",
            "focus-visible:ring-ring/50",
        ]) {
            expect(button).toContain(focusClass);
        }
        for (const variant of [
            "default",
            "destructive",
            "actionPrimary",
            "actionDestructive",
            "outline",
            "secondary",
            "ghost",
            "accent",
            "authSubmit",
            "quietOutline",
            "accentLink",
            "authInlineLink",
            "settingsClose",
            "settingsNav",
            "dashboardNav",
            "dashboardSource",
            "dashboardSync",
            "dashboardSourceAction",
            "dashboardCopy",
            "dashboardCompactAction",
            "dashboardDrawerTrigger",
            "detailHeaderIconAction",
            "detailHeaderAction",
            "dashboardSidebarCollapse",
            "dashboardSettingsAvatar",
            "playerControl",
            "playerPrimary",
            "playerSpeed",
            "onboardingProviderCard",
            "onboardingDefaultSource",
            "onboardingSecondaryAction",
            "onboardingPrimaryAction",
            "link",
        ]) {
            expect(button).toContain(`${variant}:`);
        }
        for (const variant of DASHBOARD_RECORDING_LIST_BUTTON_VARIANTS) {
            expect(buttonVariantBlock).toContain(`${variant}:`);
        }
        for (const settingsButtonSize of ["settingsClose", "settingsNav"]) {
            expect(buttonSizeBlock).toContain(`${settingsButtonSize}:`);
        }
        for (const size of DASHBOARD_RECORDING_LIST_BUTTON_SIZES) {
            expect(buttonSizeBlock).toContain(`${size}:`);
        }
        expect(button).toContain(
            'default:\n                    "bg-primary text-primary-foreground hover:bg-primary/90"',
        );
        expect(button).toContain(
            'destructive:\n                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"',
        );
        for (const actionButtonClass of [
            "border-[var(--button-primary-border)]",
            "bg-[image:var(--button-primary-bg)]",
            "text-[var(--button-primary-fg)]",
            "shadow-[var(--button-primary-shadow)]",
            "hover:bg-[image:var(--button-primary-hover-bg)]",
            "border-[var(--button-destructive-border)]",
            "bg-[image:var(--button-destructive-bg)]",
            "text-[var(--button-destructive-fg)]",
            "shadow-[var(--button-destructive-shadow)]",
            "hover:bg-[image:var(--button-destructive-hover-bg)]",
        ]) {
            expect(button).toContain(actionButtonClass);
        }
        expect(button).toContain("actionPrimary:");
        expect(button).toContain("actionDestructive:");
        expect(button).toContain("accentIcon:");
        for (const recordingTagButtonVariant of [
            "recordingTagErrorRetry",
            "recordingTagToggle",
            "recordingTagInlineCreate",
            "recordingTagCancel",
            "recordingTagCreate",
            "recordingTagDelete",
            "recordingTagChipRemove",
            "recordingTagPanelClose",
        ]) {
            expect(buttonVariantBlock).toContain(`${recordingTagButtonVariant}:`);
        }
        for (const recordingTagButtonSize of [
            "recordingTagAction",
            "recordingTagToggle",
            "recordingTagInlineCreate",
            "recordingTagChipRemove",
            "recordingTagPanelClose",
        ]) {
            expect(buttonSizeBlock).toContain(`${recordingTagButtonSize}:`);
        }
        expect(button).toContain("text-[var(--accent)]");
        expect(button).toContain('"control-xs":');
        expect(buttonSizeBlock).toContain("onboardingProviderCard:");
        expect(buttonSizeBlock).toContain("onboardingDefaultSource:");
        expect(buttonSizeBlock).toContain("onboardingAction:");
        expect(button).toContain('"form-submit":');
        expect(button).toContain("authSubmit:");
        expect(button).toContain('"inline-link":');
        expect(button).toContain("authInlineLink:");
        expect(button).toContain("playerControlSm:");
        expect(button).toContain("playerControlLg:");
        for (const dashboardSize of [
            "dashboardNav",
            "dashboardSource",
            "dashboardSync",
            "dashboardSourceAction",
            "dashboardCopy",
            "dashboardCompactAction",
            "dashboardDrawerTrigger",
            "detailHeaderIconAction",
            "detailHeaderAction",
            "dashboardSidebarCollapse",
            "dashboardSettingsAvatar",
        ]) {
            expect(buttonSizeBlock).toContain(`${dashboardSize}:`);
        }
        for (const transcriptionVariant of [
            "transcriptionAction",
            "transcriptionPrimaryAction",
            "transcriptionDangerAction",
        ]) {
            expect(buttonVariantBlock).toContain(`${transcriptionVariant}:`);
        }
        expect(buttonSizeBlock).toContain("transcriptionAction:");
        for (const recordingRouteButtonVariant of [
            "recordingRoutePrimaryAction",
            "recordingRouteGhostAction",
        ]) {
            expect(buttonVariantBlock).toContain(
                `${recordingRouteButtonVariant}:`,
            );
        }
        expect(buttonSizeBlock).toContain("recordingRouteAction:");
        for (const dashboardTranscriptActionClass of [
            "data-[copy-state=ok]:border-[var(--button-copy-success-border)]",
            "data-[copy-state=ok]:bg-[var(--button-copy-success-bg)]",
            "data-[copy-state=ok]:text-[var(--signal-success)]",
            "data-[copy-state=err]:border-[var(--button-copy-danger-border)]",
            "data-[copy-state=err]:text-[var(--signal-danger)]",
            "data-[copy-state=err]:hover:bg-transparent",
            "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        ]) {
            expect(button).toContain(dashboardTranscriptActionClass);
        }
        expect(button).toContain("size-[36px]");
        expect(button).toContain("size-[30px]");
        expect(button).toContain("size-[44px]");
        expect(button).toContain("min-w-[50px]");
        expect(button).toContain("chipRemove:");
        expect(button).toContain("[&_svg]:invisible");
        expect(button).not.toContain("accentSelf");
        expect(button).not.toContain('"icon-chip-hidden-glyph":');
        for (const size of [
            "primary:",
            "danger:",
            "player:",
            '"player-primary":',
            '"player-speed-compact":',
            '"compact-ghost":',
            "copy:",
            '"copy-success":',
            '"copy-danger":',
            '"player-sm":',
            '"player-lg":',
            '"player-speed":',
            "compact:",
        ]) {
            expect(button).not.toContain(size);
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
        expect(popover).toContain(
            'import * as PopoverPrimitive from "@radix-ui/react-popover";',
        );
        for (const primitive of [
            "Root",
            "Trigger",
            "Anchor",
            "Portal",
            "Close",
            "Content",
            "Arrow",
        ]) {
            expect(popover).toContain(`PopoverPrimitive.${primitive}`);
        }
        for (const primitive of [
            "Popover",
            "PopoverTrigger",
            "PopoverContent",
            "PopoverAnchor",
            "PopoverPortal",
            "PopoverClose",
            "PopoverArrow",
        ]) {
            expect(popover).toMatch(new RegExp(`function ${primitive}\\(`));
            expect(popover).toContain(`    ${primitive},`);
        }
        for (const slot of [
            "popover",
            "popover-trigger",
            "popover-anchor",
            "popover-portal",
            "popover-close",
            "popover-content",
            "popover-arrow",
        ]) {
            expect(popover).toContain(`data-slot="${slot}"`);
        }
        expect(popover).toContain("bg-popover");
        expect(popover).toContain("text-popover-foreground");
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
        expect(input).toContain(
            'import { cva, type VariantProps } from "class-variance-authority";',
        );
        expect(input).toContain("const inputVariants = cva(");
        expect(input).toContain("VariantProps<typeof inputVariants>");
        expect(input).toContain('data-slot="input"');
        expect(input).toContain("data-variant={variant}");
        expect(input).toContain("data-size={controlSize}");
        expect(input).toContain("controlSize:");
        expect(input).toContain("accent:");
        expect(input).toContain("authEmail:");
        expect(input).toContain("compact:");
        expect(input).toContain("detailHeaderTitle:");
        expect(input).toContain("onboardingSourceField:");
        expect(input).toContain("onboardingSourceUrl:");
        expect(input).toContain(
            '"h-8 min-w-0 flex-1 px-3 py-1 text-base md:text-sm"',
        );
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
        expect(toggleGroup).toContain("data-tone={itemTone}");
        expect(toggleGroup).toContain("data-size={size}");
        expect(toggleGroup).toContain("recordingTagColorPicker:");
        expect(toggleGroup).toContain("recordingTagQuickColorPicker:");
        expect(toggleGroup).toContain("recordingTagIconPicker:");
        expect(toggleGroup).toContain("recordingTagIconOption:");
        expect(toggleGroup).toContain("onboardingSourceAuthMode:");
        expect(toggleGroup).toContain("onboardingSourceAuthModeOption:");
        expect(toggleGroup).toContain("settingsSourceAuthMode:");
        expect(toggleGroup).toContain("settingsSourceAuthModeOption:");
        expect(toggleGroup).toContain('swatch:');
        expect(toggleGroup).toContain("toggle-group-swatch group/swatch");
        expect(toggleGroup).toContain("toggle-group-swatch-tone-blue");
        expect(toggleGroup).toContain("toggle-group-swatch-tone-green");
        expect(toggleGroup).toContain("toggle-group-swatch-tone-orange");
        expect(toggleGroup).toContain("toggle-group-swatch-tone-purple");
        expect(toggleGroup).toContain("toggle-group-swatch-tone-red");
        expect(toggleGroup).toContain("toggle-group-swatch-tone-slate");
        expect(toggleGroup).toContain("[display:grid]");
        expect(toggleGroup).toContain("rounded-[50%]");
        expect(toggleGroup).toContain("text-[13.3333px]");
        expect(toggleGroup).toContain("font-normal");
        expect(toggleGroup).toContain("leading-[0]");
        expect(toggleGroup).not.toContain("[--toggle-swatch");
        expect(toggleGroup).not.toMatch(
            /--tag-(blue|green|amber|violet|rose|slate)/,
        );
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
        expect(confirmDialog).toContain("ConfirmDialogSlotProps");
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
        expect(confirmDialog).toContain("slotProps?: ConfirmDialogSlotProps");
        expect(confirmDialog).toContain("contentSlotProps");
        expect(confirmDialog).not.toContain(
            '"data-sot-panel": "confirm-dialog"',
        );
        expect(confirmDialog).not.toContain(
            'data-sot-content="confirm-dialog"',
        );
        expect(confirmDialog).not.toContain('data-sot-part="confirm-head"');
        expect(confirmDialog).not.toContain('data-sot-part="confirm-body"');
        expect(confirmDialog).not.toContain('data-sot-part="confirm-foot"');
        expect(layout).toContain("confirmDialogSotSlotProps");
        expect(layout).toContain('"data-sot-panel": "confirm-dialog"');
        expect(layout).toContain('"data-sot-content": "confirm-dialog"');
        expect(layout).toContain('"data-sot-part": "confirm-head"');
        expect(layout).toContain('"data-sot-part": "confirm-body"');
        expect(layout).toContain('"data-sot-part": "confirm-foot"');
        expect(confirmDialog).toMatch(
            /<DialogHeader[\s\S]*\{\.\.\.headerSlotProps\}[\s\S]*className=\{cn\(\s*"gap-2 text-left"/,
        );
        expect(confirmDialog).toMatch(
            /<DialogTitle[\s\S]*\{\.\.\.titleSlotProps\}[\s\S]*"m-0 text-base leading-snug font-semibold tracking-normal"/,
        );
        expect(confirmDialog).toMatch(
            /<DialogDescription[\s\S]*\{\.\.\.descriptionSlotProps\}[\s\S]*"m-0 text-sm leading-relaxed text-muted-foreground"/,
        );
        expect(confirmDialog).toMatch(
            /<DialogFooter[\s\S]*\{\.\.\.footerSlotProps\}[\s\S]*"gap-\[8px\] sm:justify-end"/,
        );
        expect(confirmDialog).toContain(
            'confirmVariant?: "default" | "destructive"',
        );
        expect(confirmDialog).toContain(
            'state?.confirmVariant ?? "destructive"',
        );
        expect(confirmDialog).toContain('variant="outline"');
        expect(confirmDialog).toContain("variant={confirmButtonVariant}");
        expect(confirmDialog).toContain('size="sm"');
        expect(confirmDialog).toContain("detailsListSlotProps");
        expect(layout).toContain('"data-sot-list": "confirm-dialog-details"');
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

    it("keeps standalone recording route fallback actions on route Button variants", () => {
        const notFound = readSource("app/(app)/recordings/[id]/not-found.tsx");
        const error = readSource("app/(app)/recordings/[id]/error.tsx");

        const notFoundPrimaryAction = extractBoundedSlice(
            notFound,
            'variant="recordingRoutePrimaryAction"',
            "</Button>",
        );
        expect(notFoundPrimaryAction).toContain(
            'size="recordingRouteAction"',
        );

        const errorPrimaryAction = extractBoundedSlice(
            error,
            'variant="recordingRoutePrimaryAction"',
            "</Button>",
        );
        const errorGhostAction = extractBoundedSlice(
            error,
            'variant="recordingRouteGhostAction"',
            "</Button>",
        );
        expect(errorPrimaryAction).toContain('size="recordingRouteAction"');
        expect(errorGhostAction).toContain('size="recordingRouteAction"');
        expect(error).toContain("onClick={reset}");
        for (const source of [notFound, error]) {
            expect(source).not.toContain('variant="default"');
            expect(source).not.toContain('variant="ghost"');
        }
    });

    it("keeps recording route loading skeleton styling on Card and Skeleton primitives", () => {
        const dashboardLoading = readSource("app/(app)/dashboard/loading.tsx");
        const recordingLoading = readSource(
            "app/(app)/recordings/[id]/loading.tsx",
        );
        const cardPrimitive = readSource("components/ui/card.tsx");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const globals = readSource("app/globals.css");

        for (const loading of [dashboardLoading, recordingLoading]) {
            expect(loading).toContain(
                'import { Card } from "@/components/ui/card";',
            );
            expect(loading).toContain(
                'import { Skeleton } from "@/components/ui/skeleton";',
            );
            expect(loading).toContain('variant="routeLoadingSurface"');
            expect(loading).toContain("<Skeleton");
            expect(loading).toContain(
                'data-sot-panel="recording-detail-loading"',
            );
            expect(loading).toContain('data-sot-part="detail-player-meta"');
            expect(loading).toContain('data-sot-part="detail-player-controls"');
            expect(loading).toContain('data-sot-part="detail-transcript-head"');
            expect(loading).toContain('data-sot-part="detail-transcript"');
            expect(loading).toContain('size="recordingDetailLoadingAvatar"');
            expect(loading).toContain('size="recordingDetailLoadingBar"');
            expect(loading).toContain('size="recordingDetailLoadingBar60"');
            expect(loading).toContain('size="recordingDetailLoadingBar90"');
        }
        expect(dashboardLoading).toContain(
            'data-sot-panel="recording-list-loading"',
        );
        expect(dashboardLoading).toContain(
            'size="recordingListLoadingDayLabel"',
        );
        expect(dashboardLoading).toContain('size="recordingListLoadingTitle"');
        expect(dashboardLoading).toContain('size="recordingListLoadingTitle80"');
        expect(dashboardLoading).toContain(
            'size="recordingListLoadingMetaTime"',
        );
        expect(dashboardLoading).toContain(
            'size="recordingListLoadingMetaTag"',
        );
        expect(dashboardLoading).toContain(
            'size="recordingListLoadingMetaPill"',
        );
        expect(dashboardLoading).toContain('size="recordingListLoadingTag"');
        expect(recordingLoading).toContain(
            'data-sot-panel="recording-route-loading-detail"',
        );
        expect(cardPrimitive).toContain("routeLoadingSurface:");
        for (const sizeToken of [
            "recordingListLoadingDayLabel",
            "recordingListLoadingTitle",
            "recordingListLoadingTitle80",
            "recordingListLoadingMetaTime",
            "recordingListLoadingMetaTag",
            "recordingListLoadingMetaPill",
            "recordingListLoadingTag",
            "recordingDetailLoadingAvatar",
            "recordingDetailLoadingBar",
            "recordingDetailLoadingBar60",
            "recordingDetailLoadingBar90",
        ]) {
            expect(skeletonPrimitive).toContain(`${sizeToken}:`);
        }
        for (const selector of RECORDING_LOADING_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
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
            .filter((line) =>
                DASHBOARD_TRANSCRIPT_SOURCE_REPORT_RETX_ACTIVITY_LEGACY_CSS_SELECTOR_RE.test(
                    line,
                ),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DASHBOARD_TRANSCRIPT_SOURCE_REPORT_RETX_ACTIVITY_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        for (const selector of RECORDING_LOADING_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
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
        for (const migratedSelector of DASHBOARD_RECORDING_ROW_MIGRATED_GLOBAL_SELECTORS) {
            expect(
                collectCssRuleBlocks(globals, migratedSelector),
            ).toEqual([]);
        }
        expect([
            ...DASHBOARD_RECORDING_ROW_MIGRATED_GLOBAL_SELECTORS,
        ]).not.toContain('[data-sot-part="dashboard-recording-source-mark"]');
        for (const migratedSelectorFragment of DASHBOARD_RECORDING_ROW_META_MIGRATED_GLOBAL_SELECTOR_FRAGMENTS) {
            expect(globals).not.toContain(migratedSelectorFragment);
        }
        expect(globals).not.toMatch(
            DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_RE,
        );
        for (const selector of DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
    });

    it("keeps dashboard sidebar collapse on the runtime root without the body bridge", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const globals = readSource("app/globals.css");
        const productCss = readProductCss(globals);
        const bodyDatasetKeys = [
            ...new Set(
                [...workstation.matchAll(/document\.body\.dataset\.([A-Za-z0-9_]+)/g)]
                    .map(([, key]) => key)
                    .sort(),
            ),
        ];
        const bodySidebarBridgeBlocks = collectCssRuleBlocks(
            productCss,
            'body[data-sidebar="collapsed"]',
        ).filter(({ prelude }) =>
            /dashboard-(?:workstation|sidebar|brand|sync)|sidebar-collapse/.test(
                prelude,
            ),
        );

        expect(workstation).toContain(
            'data-sidebar-collapsed={collapsed ? "true" : "false"}',
        );
        expect(bodyDatasetKeys).toEqual([
            "drawer",
            "sourceFilter",
            "sourceStatus",
            "timeStyle",
        ]);
        expect(workstation).not.toMatch(
            /document\.body\.dataset\.(?:sidebar|collapsed)\b/,
        );
        expect(productCss).toContain(
            '[data-sot-shell="dashboard-workstation"][data-sidebar-collapsed="true"]',
        );
        expect(productCss).toContain(
            '[data-sot-shell="dashboard-workstation"][data-sidebar-collapsed="true"]\n    [data-sot-panel="dashboard-sidebar"]',
        );
        expect(productCss).toContain(
            '[data-sidebar="collapsed"]\n    [data-sot-panel="dashboard-sidebar"]\n    [data-sot-part="dashboard-nav-section-label"]',
        );
        expect(productCss).not.toContain(
            'Desktop sidebar-collapsed — bridge body[data-sidebar="collapsed"]',
        );
        expect(bodySidebarBridgeBlocks).toEqual([]);
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

    it("keeps dashboard topbar globals while source-provider atoms are primitive-owned", () => {
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
        for (const selector of DASHBOARD_SOURCE_PROVIDER_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
    });

    it("does not keep the retired liquid tabs CSS framework", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                LIQUID_TABS_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of RETIRED_LIQUID_TABS_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(globals).not.toContain('[data-tabs="');
        expect(globals).not.toContain('[data-idx="');
    });

    it("moves system banner surface styling into shadcn primitives", () => {
        const globals = readSource("app/globals.css");
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const progressPrimitive = readSource("components/ui/progress.tsx");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                SYSTEM_BANNER_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of RETIRED_SYSTEM_BANNER_DATA_SOT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(globals).toContain(
            '[data-sot-panel="system-banner"] + [data-sot-panel="system-banner"]',
        );
        expect(globals).toContain("@keyframes sbn-sweep");
        expect(
            collectCssRuleBlocks(globals, '[data-sot-panel="system-banner"]')
                .map(({ prelude }) => prelude.trim())
                .filter(
                    (prelude) =>
                        prelude === '[data-sot-panel="system-banner"]',
                ),
        ).toEqual([]);
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-panel="system-banner"]',
            ).filter(({ prelude }) => prelude.includes('[data-slot="button"]')),
        ).toEqual([]);
        expect(globals).not.toContain(
            "[data-sot-panel=\"system-banner\"] [data-slot=\"button\"]",
        );
        for (const token of SYSTEM_BANNER_ALERT_PRIMITIVE_TOKENS) {
            expect(alertPrimitive).toContain(token);
        }
        for (const token of SYSTEM_BANNER_BUTTON_PRIMITIVE_TOKENS) {
            expect(buttonPrimitive).toContain(token);
        }
        for (const token of SYSTEM_BANNER_PROGRESS_PRIMITIVE_TOKENS) {
            expect(progressPrimitive).toContain(token);
        }
    });

    it("composes system banners with shadcn Alert, Button, and Progress primitives", () => {
        const banner = readSource(
            "features/dashboard/components/system-banner.tsx",
        );

        expect(banner).toContain(
            'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
        );
        expect(banner).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(banner).toContain(
            'import { Progress } from "@/components/ui/progress";',
        );
        expect(banner).toMatch(/<Alert[\s\S]*data-sot-panel="system-banner"/);
        expect(banner).toContain('variant="systemBanner"');
        expect(banner).toContain('density="systemBanner"');
        expect(banner).toContain('layout="systemBanner"');
        expect(banner).toContain("<AlertTitle");
        expect(banner).toContain("<AlertDescription");
        expect(banner).toContain("</Alert>");
        expect(banner).toContain("<Button");
        expect(banner).toContain("<Progress");
        expect(banner).toContain("value={progress ?? 0}");
        expect(banner).toContain('size="systemBannerAction"');
        expect(banner).toContain('size="systemBannerDismissAction"');
        expect(banner).toContain('variant="systemBannerAction"');
        expect(banner).toContain('variant="systemBannerDismissAction"');
        expect(banner).toContain("variant={primaryActionVariant}");
        expect(banner).toContain('"systemBannerPrimaryAction"');
        expect(banner).not.toContain('size="sm"');
        expect(banner).not.toContain('size="icon-sm"');
        expect(banner).not.toContain('variant="ghost"');
        expect(banner).not.toContain('variant="outline"');
        expect(banner).not.toMatch(
            /<div[\s\S]*data-sot-part="system-banner-progress"/,
        );
        expect(banner).not.toContain(
            '<span data-sot-part="system-banner-progress-bar" />',
        );
        expect(banner).not.toContain(
            'className={cn("flex items-center gap-3 px-3.5 py-2.5", className)}',
        );
        expect(banner).not.toContain("systemBannerButtonVariants");
        expect(banner).not.toMatch(/<section[\s>]/);
        expect(banner).not.toContain('data-slot="system-banner"');
        expect(banner).toMatch(
            /<CloseIcon\s+data-icon="inline-start"\s+aria-hidden="true"\s*\/>/,
        );
    });

    it("keeps more actions menu styling owned by DropdownMenu primitives", () => {
        const globals = readSource("app/globals.css");
        const dropdownMenu = readSource("components/ui/dropdown-menu.tsx");
        const dashboardWorkstation = readSource(
            "features/dashboard/workstation.tsx",
        );
        const recordingDetailWorkstation = readSource(
            "features/recordings/workstation.tsx",
        );
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                MORE_ACTIONS_MENU_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of MORE_ACTIONS_MENU_RETIRED_DATA_SOT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const primitiveToken of MORE_ACTIONS_MENU_PRIMITIVE_TOKENS) {
            expect(dropdownMenu).toContain(primitiveToken);
        }
        for (const compositionToken of MORE_ACTIONS_MENU_COMPOSITION_TOKENS) {
            expect(dashboardWorkstation).toContain(compositionToken);
            expect(recordingDetailWorkstation).toContain(compositionToken);
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

    it("keeps dashboard time filter presentation out of product globals", () => {
        const globals = readSource("app/globals.css");
        const workstation = readSource("features/dashboard/workstation.tsx");
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
        for (const selector of DASHBOARD_TIME_FILTER_RETIRED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of DASHBOARD_TIME_FILTER_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(workstation).toContain(
            "const dashboardRecordingTimeFilterStyles = {",
        );
        expect(workstation).toContain(
            "function dashboardRecordingTimeFilterCountClassName(active: boolean)",
        );
        expect(workstation).toContain(
            'hidden={listMode !== "timeline"}',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-time-filter-count"',
        );
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

    it("uses shadcn Empty for dashboard empty states without product repaint CSS", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const globals = readSource("app/globals.css");

        expect(workstation).toContain('from "@/components/ui/empty";');
        for (const primitive of [
            "Empty,",
            "EmptyDescription,",
            "EmptyHeader,",
            "EmptyMedia,",
            "EmptyTitle,",
        ]) {
            expect(workstation).toContain(primitive);
        }

        const detailEmpty = extractElementSlice(
            workstation,
            'data-sot-panel="dashboard-detail-empty"',
            "Empty",
        );
        const activityEmpty = extractElementSlice(
            workstation,
            'data-sot-part="dashboard-activity-empty"',
            "Empty",
        );
        const transcriptEmpty = extractElementSlice(
            workstation,
            'data-sot-panel="dashboard-transcript-empty"',
            "Empty",
        );

        expect(detailEmpty).toContain("<Empty");
        expect(detailEmpty).toContain('data-detail-empty=""');
        expect(detailEmpty).toContain(
            'data-sot-panel="dashboard-detail-empty"',
        );
        expect(detailEmpty).toContain("<EmptyHeader>");
        expect(detailEmpty).toContain("<EmptyMedia");
        expect(detailEmpty).toContain('variant="icon"');
        expect(detailEmpty).toContain(
            'data-sot-part="dashboard-detail-empty-icon"',
        );
        expect(detailEmpty).toContain("<SotDetailEmptyIcon />");
        expect(detailEmpty).toContain(
            '<EmptyTitle data-sot-part="dashboard-detail-empty-title">',
        );
        expect(detailEmpty).toContain(
            '<EmptyDescription data-sot-part="dashboard-detail-empty-description">',
        );
        expect(detailEmpty).not.toContain("<div");
        expect(detailEmpty).not.toContain("<p");

        expect(activityEmpty).toContain("<Empty");
        expect(activityEmpty).toContain(
            'data-sot-part="dashboard-activity-empty"',
        );
        expect(activityEmpty).toContain("<EmptyHeader>");
        expect(activityEmpty).toContain("<EmptyMedia");
        expect(activityEmpty).toContain('variant="icon"');
        expect(activityEmpty).toContain(
            'data-sot-part="dashboard-activity-empty-icon"',
        );
        expect(activityEmpty).toContain("<CheckCircle />");
        expect(activityEmpty).toContain(
            '<EmptyTitle data-sot-part="dashboard-activity-empty-title">',
        );
        expect(activityEmpty).toContain(
            '<EmptyDescription data-sot-part="dashboard-activity-empty-body">',
        );
        expect(activityEmpty).not.toContain("<div");
        expect(activityEmpty).not.toContain("<p");

        expect(transcriptEmpty).toContain("<Empty");
        expect(transcriptEmpty).toContain(
            'data-sot-panel="dashboard-transcript-empty"',
        );
        expect(transcriptEmpty).toContain("<EmptyHeader>");
        expect(transcriptEmpty).toContain("<EmptyMedia");
        expect(transcriptEmpty).toContain('variant="icon"');
        expect(transcriptEmpty).toContain(
            'data-sot-part="dashboard-transcript-empty-icon"',
        );
        expect(transcriptEmpty).toContain("<SotTranscriptEmptyIcon />");
        expect(transcriptEmpty).toContain(
            '<EmptyTitle data-sot-part="dashboard-transcript-empty-message">',
        );
        expect(transcriptEmpty).toContain(
            '<EmptyDescription data-sot-part="dashboard-transcript-empty-sub">',
        );
        expect(transcriptEmpty).not.toContain("<div");
        expect(transcriptEmpty).not.toContain("<p");

        for (const selector of DASHBOARD_EMPTY_PRIMITIVE_CSS_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_TRANSCRIPT_EMPTY_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        expect(globals).toContain("[data-detail-empty]");
        expect(globals).toContain("[data-detail-empty][hidden]");
        expect(globals).toContain(
            '[data-sot-part="dashboard-activity-empty"][hidden]',
        );
        expect(globals).toContain(
            '[data-sot-panel="dashboard-detail"][data-empty="true"] [data-detail-empty]',
        );
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

        for (const selector of AI_RENAME_PREVIEW_FUNCTIONAL_CSS_SELECTORS) {
            const retainedBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(({ prelude }) =>
                stripCssComments(prelude)
                    .split(",")
                    .map((selectorPart) => selectorPart.trim())
                    .includes(selector),
            );

            expect(retainedBlocks.length).toBeGreaterThanOrEqual(1);
        }

        for (const selector of AI_RENAME_PREVIEW_VISUAL_REPAINT_CSS_SELECTORS) {
            const retainedBlocks = collectCssRuleBlocks(globals, selector);

            expect(retainedBlocks).toEqual([]);
        }
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
                        /\.ai-rename-panel|\.airp-|airp-|data-airp-|\bAI_RENAME_[A-Z0-9_]+_CLASS\b|--ai-rename-[\w-]+/.test(
                            text,
                        ),
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
        expect(login).toMatch(
            /import\s*\{[\s\S]*Card,[\s\S]*CardContent,[\s\S]*CardDescription,[\s\S]*CardHeader,[\s\S]*CardTitle[\s\S]*\}\s*from "@\/components\/ui\/card";/,
        );
        expect(login).toContain("<Card");
        expect(login).toContain('variant="authSurface"');
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
        expect(login).toMatch(
            /import\s*\{[\s\S]*Field,[\s\S]*FieldDescription,[\s\S]*FieldError,[\s\S]*FieldGroup,[\s\S]*FieldLabel[\s\S]*\}\s*from "@\/components\/ui\/field";/,
        );
        expect(login).toContain("<FieldGroup");
        expect(login).toContain("<Field");
        expect(login).toContain("<FieldLabel");
        expect(login).toContain("<FieldError");
        expect(login).toContain("<FieldDescription");
        expect(login).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(login).toContain("<Button");
        expect(login).toContain('data-sot-control="send-login-link"');
        expect(login).toContain('data-sot-control="auth-email"');
        expect(login).toContain('data-sot-control="local-only"');
        expect(login).toMatch(
            /<CardHeader\s+variant="authHeader">[\s\S]*<CardTitle(?=[^>]*\bvariant="authHeaderTitle")(?=[^>]*\bdata-sot-part="card-heading")[^>]*>[\s\S]*<CardDescription(?=[^>]*\bvariant="authHeaderDescription")(?=[^>]*\bdata-sot-part="card-sub")[^>]*>/,
        );
        expect(login).toMatch(
            /<CardContent(?=[^>]*\bvariant="authFrame")(?=[^>]*\bdata-sot-frame="auth")[^>]*>[\s\S]*<CardTitle(?=[^>]*\bvariant="authFrameTitle")(?=[^>]*\bdata-sot-part="auth-heading")[^>]*>[\s\S]*<CardDescription(?=[^>]*\bvariant="authFrameDescription")(?=[^>]*\bdata-sot-part="auth-description")[^>]*>/,
        );
        expect(login).toContain('<FieldGroup variant="authCompact">');
        const authEmailInput = extractOpeningElement(
            login,
            'data-sot-control="auth-email"',
            "Input",
        );
        const authSubmitButton = extractOpeningElement(
            login,
            'data-sot-control="send-login-link"',
            "Button",
        );
        const authLocalButton = extractOpeningElement(
            login,
            'data-sot-control="local-only"',
            "Button",
        );
        expect(authEmailInput).toContain('variant="authEmail"');
        expect(authEmailInput).toContain('controlSize="authEmail"');
        expect(authEmailInput).not.toContain("className=");
        expect(authSubmitButton).toContain('variant="authSubmit"');
        expect(authSubmitButton).toContain('size="authSubmit"');
        expect(authSubmitButton).not.toContain("className=");
        expect(authLocalButton).toContain('variant="authInlineLink"');
        expect(authLocalButton).toContain('size="authInlineLink"');
        expect(authLocalButton).not.toContain("className=");
        expect(login).not.toContain("hasNoPadding");
        expect(login).not.toContain('variant="accent"');
        expect(login).not.toContain('variant="accentLink"');
        expect(login).not.toContain('controlSize="compact"');
        expect(login).not.toContain('size="form-submit"');
        expect(login).not.toContain('size="inline-link"');
        for (const removedAuthPrimitiveRepaintClass of [
            "h-[36px]",
            "h-[38px]",
            "rounded-[9px]",
            "!text-[13px]",
            "md:!text-[13px]",
            "!border",
            "!bg-[var(--accent)]",
            "hover:!bg-[var(--accent)]",
            "!text-white",
            "!font-normal",
            "!leading-[normal]",
            "!text-[var(--accent)]",
            "!underline-offset-auto",
        ]) {
            expect(login).not.toContain(removedAuthPrimitiveRepaintClass);
        }
        expect(login).toContain("aria-invalid={invalid}");
        expect(login).toContain("aria-busy={isLoading}");
        expect(login).toContain("aria-busy={isLocalLoading}");
        expect(login).toContain("disabled={!isMounted || isLoading}");
        expect(login).toContain("disabled={!isMounted || isLocalLoading}");
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
        ]) {
            expect(globals).toContain(authDataSotSelector);
        }
        for (const removedAuthPrimitiveRepaintSelector of [
            '[data-sot-control="auth-email"][data-slot="input"]',
            '[data-sot-control="send-login-link"][data-slot="button"]',
            '[data-sot-control="local-only"][data-slot="button"]',
        ]) {
            expect(globals).not.toContain(removedAuthPrimitiveRepaintSelector);
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
            /<CardHeader(?=[^>]*\bvariant="onboardingHeader")(?=[^>]*\bdata-sot-part="onboarding-card-header")[^>]*>[\s\S]*<CardTitle(?=[^>]*\bvariant="onboardingHeading")(?=[^>]*\bdata-sot-part="card-heading")[^>]*>[\s\S]*<CardDescription(?=[^>]*\bvariant="onboardingSub")(?=[^>]*\bdata-sot-part="card-sub")[^>]*>/,
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
            /<CardHeader(?=[^>]*\bvariant="onboardingStepHeader")(?=[^>]*\bdata-sot-part="onboarding-step-header")[^>]*>[\s\S]*<CardTitle(?=[^>]*\bvariant="onboardingStepTitle")(?=[^>]*\bdata-sot-part="onboarding-step-title")[^>]*>[\s\S]*<CardDescription(?=[^>]*\bvariant="onboardingStepDescription")(?=[^>]*\bdata-sot-part="onboarding-step-description")[^>]*>/,
        );
        expect(onboarding).toMatch(
            /<CardContent(?=[^>]*\bvariant="onboardingStepBody")(?=[^>]*\bdata-sot-part="onboarding-step-body")[^>]*>/,
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
        const defaultSourceButton = extractOpeningElement(
            onboarding,
            'data-sot-control="onboarding-default-source"',
            "Button",
        );
        expect(defaultSourceButton).toContain(
            'variant="onboardingDefaultSource"',
        );
        expect(defaultSourceButton).toContain('size="onboardingDefaultSource"');
        expect(defaultSourceButton).toContain(
            "disabled={isSaving || !option.connected}",
        );
        expect(onboarding).toContain(
            'data-sot-control="speaker-profile-draft"',
        );
        expect(onboarding).toMatch(
            /data-sot-control="speaker-profile-draft"[\s\S]*<CardHeader(?=[^>]*\bvariant="onboardingProviderMeta")(?=[^>]*\bdata-sot-part="provider-meta")[^>]*>[\s\S]*<CardTitle(?=[^>]*\bvariant="onboardingProviderName")(?=[^>]*\bdata-sot-part="provider-name")[^>]*>[\s\S]*<CardDescription(?=[^>]*\bvariant="onboardingProviderHint")(?=[^>]*\bdata-sot-part="provider-hint")[^>]*>/,
        );
        expect(onboarding).toContain('data-sot-list="speaker-profiles"');
        expect(onboarding).toContain('data-sot-list="finish-summary"');
        expect(onboarding).toContain('data-sot-part="provider-icon"');
        expect(onboarding).toContain('data-sot-part="provider-meta"');
        expect(onboarding).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(onboarding).toContain('layout="onboardingSourceAuthMode"');
        expect(onboarding).toContain('variant="onboardingSourceAuthModeOption"');
        expect(onboarding).toContain('size="onboardingSourceAuthModeOption"');
        expect(onboarding).toContain('spacing="onboardingSourceAuthMode"');
        expect(onboarding).toContain('data-sot-control="source-base-url"');
        expect(onboarding).toContain('variant="onboardingSourceUrl"');
        expect(onboarding).toContain('controlSize="onboardingSourceUrl"');
        expect(onboarding).toContain('variant="onboarding"');
        expect(onboarding).toContain('variant="onboardingSurface"');
        expect(onboarding).toContain('variant="onboardingProviderCard"');
        expect(onboarding).toContain('size="onboardingProviderCard"');
        expect(onboarding).toContain('variant="onboardingDefaultSource"');
        expect(onboarding).toContain('size="onboardingDefaultSource"');
        expect(onboarding).toContain('variant="onboardingSecondaryAction"');
        expect(onboarding).toContain('variant="onboardingPrimaryAction"');
        expect(onboarding).toContain('size="onboardingAction"');
        expect(onboarding).not.toContain('variant="accent"');
        expect(onboarding).not.toContain('variant="quietOutline"');
        expect(onboarding).not.toContain('size="control-xs"');
        expect(onboarding).not.toContain(
            'variant={isActive ? "secondary" : "outline"}',
        );
        const onboardingSkipButton = extractOpeningElement(
            onboarding,
            'data-sot-control="onboarding-skip"',
            "Button",
        );
        const onboardingNextButtons = [
            ...onboarding.matchAll(/data-sot-control="onboarding-next"/g),
        ].map((match) =>
            extractOpeningElementAt(onboarding, match.index, "Button"),
        );
        expect(onboardingSkipButton).toContain(
            'variant="onboardingSecondaryAction"',
        );
        expect(onboardingSkipButton).toContain('size="onboardingAction"');
        expect(onboardingSkipButton).not.toContain("className=");
        expect(onboardingNextButtons.length).toBeGreaterThan(0);
        for (const onboardingNextButton of onboardingNextButtons) {
            expect(onboardingNextButton).toContain(
                'variant="onboardingPrimaryAction"',
            );
            expect(onboardingNextButton).toContain('size="onboardingAction"');
            expect(onboardingNextButton).not.toContain("className=");
        }
        for (const removedOnboardingPrimitiveRepaintClass of [
            "!h-[26px]",
            "!gap-[6px]",
            "!rounded-[8px]",
            "!border",
            "!bg-[var(--accent)]",
            "!px-[10px]",
            "!text-[11px]",
            "!font-semibold",
            "!leading-[normal]",
            "!text-[var(--fg-secondary)]",
            "!text-white",
            "!shadow-none",
        ]) {
            expect(onboarding).not.toContain(
                removedOnboardingPrimitiveRepaintClass,
            );
        }
        const providerCardButton = extractOpeningElement(
            onboarding,
            'data-sot-control="provider-card"',
            "Button",
        );
        expect(providerCardButton).toContain(
            'variant="onboardingProviderCard"',
        );
        expect(providerCardButton).toContain('size="onboardingProviderCard"');
        expect(providerCardButton).not.toContain("className=");
        expect(onboarding).not.toContain(
            '"grid h-auto w-full grid-cols-[36px_1fr_auto_auto] items-center justify-start gap-3 px-3.5 py-3 text-left"',
        );
        expect(onboarding).not.toContain(
            'className="grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 border-primary/50 bg-primary/10 p-3.5"',
        );
        expect(onboarding).toContain('variant="onboardingSpeakerDraft"');
        expect(onboarding).toContain("CardContent,");
        expect(onboarding).toContain("CardDescription,");
        expect(onboarding).toContain("CardHeader,");
        expect(onboarding).toContain("CardTitle,");
        expect(onboarding).toContain(
            'import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";',
        );
        expect(onboarding).toContain("<ToggleGroup");
        expect(onboarding).toContain("<ToggleGroupItem");
        expect(onboarding).toContain('type="single"');
        expect(onboarding).toContain("value={currentDraft.authMode}");
        expect(onboarding).toContain("setAuthMode(mode)");
        expect(onboarding).toContain('data-sot-list="source-auth-modes"');
        expect(onboarding).toContain('data-sot-control="source-auth-mode"');
        expect(onboarding).toContain("data-sot-auth-mode={mode}");
        expect(onboarding).toContain(
            'data-sot-state={\n                                        active ? "selected" : "idle"\n                                    }',
        );
        expect(onboarding).toContain('data-sot-part="source-auth-mode-title"');
        expect(onboarding).toContain(
            'data-sot-part="source-auth-mode-description"',
        );
        const sourceAuthModeControl =
            onboarding.match(
                /currentProviderCatalog\.authModes\.length > 1[\s\S]*?<MatrixRow/,
            )?.[0] ?? "";
        expect(sourceAuthModeControl).toContain("<ToggleGroup");
        expect(sourceAuthModeControl).toContain("<ToggleGroupItem");
        expect(sourceAuthModeControl).not.toContain('variant="outline"');
        expect(sourceAuthModeControl).not.toContain('size="lg"');
        expect(sourceAuthModeControl).not.toContain("spacing={2}");
        expect(sourceAuthModeControl).not.toContain(
            'className="grid w-full grid-cols-2 items-stretch"',
        );
        const onboardingDataSourceFieldControl =
            onboarding.match(/\{providerFields\.map\(\(field\) => \([\s\S]*?\)\)\}/)?.[0] ??
            "";
        expect(onboardingDataSourceFieldControl).toContain(
            "<DataSourceFieldControl",
        );
        expect(onboardingDataSourceFieldControl).toContain(
            'variant="onboarding"',
        );
        expect(onboardingDataSourceFieldControl).not.toContain(
            'variant="settings"',
        );
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
        expect(onboarding).not.toContain('className="gap-0 p-0"');
        expect(onboarding).not.toContain("hasNoPadding");
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
        expect(onboarding).not.toContain("role=\"button\"");
        expect(onboarding).not.toContain("onKeyDown={(event) =>");
        expect(globals).toContain('[data-sot-layout="onboarding-workstation"]');
        expect(globals).toContain('[data-sot-panel="onboarding-steps"]');
        expect(globals).toContain('[data-sot-control="onboarding-step"]');
        expect(globals).toContain(
            '[data-sot-control="onboarding-step"][data-sot-state="active"]',
        );
        expect(globals).toContain('[data-sot-part="onboarding-actions"]');
        expect(globals).not.toContain(
            '[data-sot-card="onboarding"] > [data-slot="card-header"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="onboarding-step-header"][data-slot="card-header"]',
        );
        expect(globals).not.toContain(
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
        for (const selector of ONBOARDING_DEFAULT_SOURCE_ROOT_REPAINT_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
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
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const button = readSource("components/ui/button.tsx");
        const sourceReportPanel = readSource(
            "features/recordings/components/source-report-panel.tsx",
        );
        const sourceReportBadgePrimitive = readSource(
            "components/ui/badge.tsx",
        );
        const sourceReportButtonPrimitive = readSource(
            "components/ui/button.tsx",
        );
        const sourceReportCardPrimitive = readSource("components/ui/card.tsx");
        const sourceReportSkeletonPrimitive = readSource(
            "components/ui/skeleton.tsx",
        );
        const toggleGroupPrimitive = readSource(
            "components/ui/toggle-group.tsx",
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
        expect(workstation).toMatch(
            /<Button\s+variant="dashboardDrawerTrigger"\s+size="dashboardDrawerTrigger"[\s\S]*data-sot-control="dashboard-drawer-trigger"[\s\S]*<Menu[\s\S]*data-icon="inline-start"/,
        );
        expect(workstation).not.toMatch(
            /<button[\s\S]{0,240}data-sot-control="dashboard-drawer-trigger"/,
        );
        expect(workstation).toContain('id="drawer-scrim"');
        expect(workstation).toContain('id="drawer-trigger"');
        expect(workstation).not.toContain("data-drawer-open=");
        expect(workstation).not.toContain(
            'data-sot-surface="dashboard-source-rail"',
        );
        expect(workstation).toContain('data-sot-list="dashboard-sources"');
        expect(workstation).toContain(
            'data-sot-control="dashboard-source-clear"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-source-provider"',
        );
        expect(workstation).toContain(
            'className="group/dashboard-workstation"',
        );
        for (const removedConstant of DASHBOARD_SHELL_SOURCE_BUTTON_CONSTANTS) {
            expect(workstation).not.toContain(removedConstant);
        }
        expect(workstation).toContain('variant="dashboardNav"');
        expect(workstation).toContain('variant="dashboardSource"');
        expect(workstation).toContain('variant="dashboardSourceClear"');
        expect(workstation).toContain('variant="dashboardSourceAction"');
        expect(workstation).toContain('variant="dashboardSync"');
        expect(workstation).toContain('variant="dashboardSidebarCollapse"');
        expect(workstation).toContain('variant="dashboardSettingsAvatar"');
        expect(button).toContain("dashboardSourceClear:");
        expect(button).toContain("dashboardSpeakersMerge:");
        expect(workstation).toMatch(
            /<Button\s+variant="dashboardNav"\s+size="dashboardNav"[\s\S]*data-sot-control="dashboard-favorite"/,
        );
        expect(workstation).toMatch(
            /<Button\s+variant="dashboardSourceClear"\s+size="dashboardSourceClear"[\s\S]*data-sot-control="dashboard-source-clear"[\s\S]*onClick=\{\(\) => setSource\("all"\)\}/,
        );
        expect(workstation).toMatch(
            /<Button\s+variant="dashboardSync"\s+size="dashboardSync"[\s\S]*data-sot-control="dashboard-sync"/,
        );
        expect(workstation).toMatch(
            /<Button\s+variant="dashboardSidebarCollapse"\s+size="dashboardSidebarCollapse"[\s\S]*data-sot-control="sidebar-collapse"/,
        );
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
        expect(sourceProviderRows).toContain('variant="dashboardSource"');
        expect(sourceProviderRows).toContain('size="dashboardSource"');
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
        const sourceProviderStatusBadge = extractOpeningElement(
            sourceProviderRows,
            'data-sot-part="source-provider-status"',
            "Badge",
        );
        const sourceProviderCountBadge = extractOpeningElement(
            sourceProviderRows,
            'data-sot-part="source-provider-count"',
            "Badge",
        );
        const dashboardSourceButtonVariant = extractVariantDefinition(
            button,
            "dashboardSource",
        );
        const dashboardSourceStatusVariant = extractVariantDefinition(
            sourceReportBadgePrimitive,
            "dashboardSourceStatus",
        );
        const dashboardSourceCountVariant = extractVariantDefinition(
            sourceReportBadgePrimitive,
            "dashboardSourceCount",
        );
        expect(sourceProviderRows).toContain("sourceProviderStatusTone(");
        expect(sourceProviderRows).toContain("sourceProviderCountTone(");
        expect(sourceProviderRows).toContain("sourceRowCollapsed");
        expect(sourceProviderRows).toContain(
            '"justify-center gap-0 px-0 py-2"',
        );
        expect(sourceProviderRows).toContain('"absolute bottom-1 right-1"');
        expect(sourceProviderStatusBadge).toContain(
            'variant="dashboardSourceStatus"',
        );
        expect(sourceProviderStatusBadge).toContain(
            "data-sot-tone={sourceStatusTone}",
        );
        expect(sourceProviderCountBadge).toContain(
            'variant="dashboardSourceCount"',
        );
        expect(sourceProviderCountBadge).toContain(
            "data-sot-tone={sourceCountTone}",
        );
        expect(sourceProviderRows).toContain(
            'data-sot-part="source-provider-action"',
        );
        expect(sourceProviderRows).toMatch(
            /<Button\s+asChild\s+variant="dashboardSourceAction"\s+size="dashboardSourceAction"[\s\S]*data-sot-part="source-provider-action"/,
        );
        for (const token of DASHBOARD_SOURCE_PROVIDER_ACTION_BUTTON_PRIMITIVE_TOKENS) {
            expect(button).toContain(token);
        }
        for (const dashboardSourceMarkToken of [
            "[&_[data-sot-part=source-provider-mark]]:size-[18px]",
            "[&_[data-sot-part=source-provider-mark]]:rounded-[4px]",
            "[&_[data-sot-part=source-provider-mark]]:border-[var(--line-hairline)]",
            "[&_[data-sot-part=source-provider-mark][data-sot-variant=letter]]:[font:700_9px_var(--font-sans)]",
            "[&_[data-sot-part=source-provider-mark]_img]:object-contain",
            "[&_[data-sot-part=source-provider-mark][data-sot-provider-cover=true]_img]:object-cover",
            "dark:[&_[data-sot-part=source-provider-mark]]:bg-[var(--glass-tint-subtle)]",
            "data-[sot-state=no-results]:[&_[data-sot-part=source-provider-mark]]:opacity-[0.65]",
            "data-[sot-state=needs-setup]:[&_[data-sot-part=source-provider-mark]]:grayscale",
            "data-[sot-state=disabled]:[&_[data-sot-part=source-provider-mark]]:grayscale-[0.7]",
        ]) {
            expect(button).toContain(dashboardSourceMarkToken);
        }
        for (const dashboardSourceBadgeToken of [
            "dashboardSourceStatus:",
            "data-[sot-tone=ok]:bg-[var(--signal-success)]",
            "data-[sot-tone=syncing]:animate-[bpulse_1.2s_ease-in-out_infinite]",
            "data-[sot-tone=err]:shadow-[0_0_0_2px_var(--source-provider-status-danger-bg)]",
            "dashboardSourceCount:",
            "dark:bg-[var(--glass-tint-subtle)]",
            "data-[sot-tone=active]:bg-[var(--bg-elevated)]",
            "data-[sot-tone=empty]:line-through",
            "data-[sot-tone=err]:text-[var(--signal-danger)]",
        ]) {
            expect(sourceReportBadgePrimitive).toContain(
                dashboardSourceBadgeToken,
            );
        }
        for (const repairedVariant of [
            dashboardSourceButtonVariant,
            dashboardSourceStatusVariant,
            dashboardSourceCountVariant,
        ]) {
            expect(repairedVariant).not.toMatch(
                SOURCE_PROVIDER_REPAIRED_RAW_DARK_RGB_RE,
            );
        }
        expect(sourceProviderRows).not.toContain(
            "SOT defines source row action as span[role=button]",
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
        expect(button).toContain("sourceFilterClear:");
        expect(sourceFilterStack).toMatch(
            /<Button\s+variant="sourceFilterClear"\s+size="sourceFilterClear"[\s\S]*data-sot-control="source-filter-clear"/,
        );
        for (const control of [
            "source-filter-retry-sync",
            "source-filter-widen",
            "source-filter-open-settings",
        ]) {
            expect(sourceFilterStack).toMatch(
                new RegExp(
                    `<Button\\s+variant="sourceFilterAction"\\s+size="sourceFilterAction"[\\s\\S]*data-sot-control="${control}"[\\s\\S]*data-sot-part="source-filter-action"`,
                ),
            );
        }
        for (const token of SOURCE_FILTER_ACTION_BUTTON_PRIMITIVE_TOKENS) {
            expect(button).toContain(token);
        }
        expect(globals).not.toContain('[data-sot-action="source-filter-action"]');
        expect(
            collectCssRuleBlocks(globals, '[data-sot-part="source-filter-action"]'),
        ).toEqual([]);
        expect(sourceFilterStack).toMatch(
            /<Button\s+variant="sourceFilterClearAll"\s+size="sourceFilterClearAll"[\s\S]*data-sot-control="source-filter-clear-all"/,
        );
        expect(workstation).toMatch(
            /<Button\s+variant="recordingListChipClear"\s+size="recordingListChipClear"[\s\S]*data-sot-control="library-search-filter-clear"/,
        );
        expect(sourceFilterStack).not.toMatch(
            legacySourceFilterActionClassNamePattern,
        );
        expect(sourceFilterStack).not.toMatch(legacySourceAttributePattern);
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
        for (const selector of DASHBOARD_SOURCE_PROVIDER_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).not.toContain("source-provider-action");
        expect(
            collectCssRuleBlocks(globals, '[data-sot-part="source-filter-action"]'),
        ).toEqual([]);
        expect(workstation).toContain('data-sot-control="dashboard-search"');
        expect(workstation).toContain('data-sot-panel="library-search"');
        expect(workstation).toContain('data-sot-list="library-search-results"');
        expect(workstation).toContain("groupedSearchResults.map");
        expect(workstation).toContain("group.results.map");
        const dashboardSearchSlice = extractBoundedSlice(
            workstation,
            'data-sot-part="library-search-anchor"',
            'data-sot-part="dashboard-activity-anchor"',
        );
        for (const semanticToken of [
            'variant="dashboardSearchTrigger"',
            'size="dashboardSearchTrigger"',
            'variant="librarySearchPanel"',
            'variant="librarySearchInputRow"',
            'variant="librarySearchClear"',
            'layout="librarySearchScope"',
            'variant="librarySearchScopeItem"',
            'variant="librarySearchRetry"',
            'variant="librarySearchResult"',
            'variant="librarySearchTag"',
        ]) {
            expect(dashboardSearchSlice).toContain(semanticToken);
        }
        for (const oldToken of [
            'variant="ghost"',
            'variant="outline"',
            'variant="secondary"',
            'size="icon-sm"',
            'size="icon-xs"',
            'size="xs"',
            'size="sm"',
        ]) {
            expect(dashboardSearchSlice).not.toContain(oldToken);
        }
        expect(workstation).toContain('data-sot-control="dashboard-activity"');
        expect(workstation).toContain('data-sot-panel="dashboard-activity"');
        expect(workstation).toMatch(
            /<div\s+data-sot-format="mono"\s+data-sot-part="dashboard-activity-status-sub"\s*>/,
        );
        expect(globals).toContain(
            '[data-sot-part="dashboard-activity-status-sub"]',
        );
        expect(workstation).toContain("visibleActivityItems.map");
        const dashboardActivitySlice = extractBoundedSlice(
            workstation,
            'data-sot-part="dashboard-activity-anchor"',
            '<Button\n                            asChild\n                            variant="dashboardSettingsAvatar"',
        );
        for (const semanticToken of [
            'variant="dashboardActivityTrigger"',
            'size="dashboardActivityTrigger"',
            'variant="dashboardActivityPanel"',
            'variant="dashboardActivityCount"',
            'variant="dashboardActivityClose"',
            'variant="dashboardActivitySync"',
            'variant="dashboardActivityAction"',
            'variant="dashboardActivityDismiss"',
        ]) {
            expect(dashboardActivitySlice).toContain(semanticToken);
        }
        for (const oldToken of [
            'variant="ghost"',
            'variant="outline"',
            'variant="secondary"',
            'size="icon-sm"',
            'size="icon-xs"',
            'size="xs"',
            'size="sm"',
        ]) {
            expect(dashboardActivitySlice).not.toContain(oldToken);
        }
        expect(workstation).toContain('data-sot-control="dashboard-settings"');
        expect(workstation).toContain('data-sot-part="dashboard-user-avatar"');
        expect(workstation).toMatch(
            /<Button\s+asChild\s+variant="dashboardSettingsAvatar"\s+size="dashboardSettingsAvatar"[\s\S]*>\s*<button[\s\S]*data-sot-control="dashboard-settings"[\s\S]*data-sot-part="dashboard-user-avatar"/,
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
        const dashboardRecordingRows = extractOpeningElement(
            workstation,
            'data-sot-list="dashboard-recording-rows"',
            "div",
        );
        const dashboardRecordingListGroup = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group"',
            "div",
        );
        const dashboardRecordingListGroupSeparator = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group-separator"',
            "Separator",
        );
        const dashboardRecordingListHeading = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group-heading"',
            "div",
        );
        const dashboardRecordingListLabel = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group-label"',
            "span",
        );
        const dashboardRecordingListCount = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group-count"',
            "span",
        );
        const dashboardRecordingListDivider = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group-divider"',
            "Separator",
        );
        const dashboardRecordingRowStyleHelper = extractBoundedSlice(
            workstation,
            "const dashboardRecordingRowStyles = {",
            "function tagFilterValue",
        );
        for (const rowStyleSlot of [
            "rows:",
            "group:",
            "groupSeparator:",
            "groupHeading:",
            "groupLabel:",
            "groupCount:",
            "groupDivider:",
            "row:",
            "body:",
            "title:",
            "meta:",
            "sourceMark:",
            "sourceMarkImage:",
            "sourceMarkImageCover:",
            "sourceMarkLetter:",
            "duration:",
            "secondary:",
            "timestamp:",
            "timestampAbsolute:",
            "timestampRelative:",
            "actions:",
        ]) {
            expect(dashboardRecordingRowStyleHelper).toContain(rowStyleSlot);
        }
        for (const rowStateToken of [
            "data-[sot-state=selected]:",
            "[&.is-hover-demo]:",
            "[&.is-focus-demo]:",
        ]) {
            expect(dashboardRecordingRowStyleHelper).toContain(rowStateToken);
        }
        expect(dashboardRecordingRows).toContain(
            "dashboardRecordingRowStyles.rows",
        );
        expect(dashboardRecordingListGroup).toContain(
            "dashboardRecordingRowStyles.group",
        );
        expect(workstation).not.toContain("border-t border-border");
        expect(dashboardRecordingListGroup).not.toContain("border-t");
        expect(dashboardRecordingListGroup).not.toContain("border-border");
        expect(workstation).toContain("groupIndex > 0 ? (");
        expect(dashboardRecordingListGroupSeparator).toContain(
            "dashboardRecordingRowStyles.groupSeparator",
        );
        expect(dashboardRecordingListHeading).toContain(
            "dashboardRecordingRowStyles.groupHeading",
        );
        expect(dashboardRecordingListLabel).toContain(
            "dashboardRecordingRowStyles.groupLabel",
        );
        expect(dashboardRecordingListCount).toContain(
            "dashboardRecordingRowStyles.groupCount",
        );
        expect(dashboardRecordingListDivider).toContain(
            "dashboardRecordingRowStyles.groupDivider",
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-status"',
        );
        expect(workstation).toMatch(
            /<Badge\s+variant="dashboardRecordingStatus"[\s\S]*data-sot-part="dashboard-recording-status"[\s\S]*data-sot-tone=\{\s*rowStatus\.tone\s*\}/,
        );
        expect(workstation).not.toMatch(
            /<span\s+data-sot-part="dashboard-recording-status"/,
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-status-dot"',
        );
        expect(sourceReportBadgePrimitive).toContain(
            "dashboardRecordingStatus:",
        );
        for (const dashboardStatusToken of [
            "data-[sot-tone=ok]:border-[var(--source-provider-status-success-border)]",
            "data-[sot-tone=ok]:bg-[var(--source-provider-status-success-bg)]",
            "data-[sot-tone=ok]:text-[var(--signal-success)]",
            "data-[sot-tone=warn]:border-[var(--source-provider-status-warning-border)]",
            "data-[sot-tone=warn]:bg-[var(--source-provider-status-warning-bg)]",
            "data-[sot-tone=warn]:text-[var(--signal-warning-strong)]",
            "data-[sot-tone=err]:border-[var(--source-provider-status-danger-border)]",
            "data-[sot-tone=err]:bg-[var(--source-provider-status-danger-bg)]",
            "data-[sot-tone=err]:text-[var(--signal-danger)]",
            "data-[sot-tone=info]:border-[var(--source-provider-status-info-border)]",
            "data-[sot-tone=info]:bg-[var(--source-provider-status-info-bg)]",
            "data-[sot-tone=info]:text-[var(--signal-info)]",
            "data-[sot-tone=neu]:border-[var(--line-hairline)]",
            "data-[sot-tone=neu]:bg-[var(--bg-recessed)]",
            "data-[sot-tone=neu]:text-[var(--fg-secondary)]",
            "data-[sot-tone=neu]:[&_[data-sot-part=dashboard-recording-status-dot]]:bg-[var(--fg-tertiary)]",
            "[&_[data-sot-part=dashboard-recording-status-dot]]:size-[5px]",
            "[&_[data-sot-part=dashboard-recording-status-dot]]:rounded-full",
            "[&_[data-sot-part=dashboard-recording-status-dot]]:bg-current",
            "data-[sot-tone=warn]:[&_[data-sot-part=dashboard-recording-status-dot]]:animate-[bpulse_1.4s_ease-in-out_infinite]",
        ]) {
            expect(sourceReportBadgePrimitive).toContain(dashboardStatusToken);
        }
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-part="dashboard-recording-status"]',
            ),
        ).toEqual([]);
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
        for (const migratedSelector of DASHBOARD_RECORDING_ROW_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, migratedSelector)).toEqual(
                [],
            );
        }
        expect([
            ...DASHBOARD_RECORDING_ROW_MIGRATED_GLOBAL_SELECTORS,
        ]).not.toContain('[data-sot-part="dashboard-recording-source-mark"]');
        for (const migratedSelectorFragment of DASHBOARD_RECORDING_ROW_META_MIGRATED_GLOBAL_SELECTOR_FRAGMENTS) {
            expect(globals).not.toContain(migratedSelectorFragment);
        }
        for (const migratedSelector of [
            '[data-sot-part="dashboard-recording-duration"]',
            '[data-sot-part="dashboard-recording-timestamp"]',
            '[data-sot-part="dashboard-recording-timestamp-absolute"]',
            '[data-sot-part="dashboard-recording-timestamp-relative"]',
            '[data-sot-part="dashboard-recording-source-mark"]',
        ]) {
            expect(collectCssRuleBlocks(globals, migratedSelector)).toEqual(
                [],
            );
        }
        for (const rowMetaOwnershipToken of [
            "font-mono",
            "text-[11.5px]",
            "tracking-[0.02em]",
            "tracking-[0.015em]",
            "[body[data-time-style=abs]_&]:inline",
            "[body[data-time-style=abs]_&]:hidden",
            "grayscale",
            "contrast-[0.85]",
            "dark:brightness-[1.4]",
            "object-cover",
            "dark:opacity-60",
            "dark:bg-[rgb(255_255_255_/_0.06)]",
            "dark:border-[var(--glass-border)]",
        ]) {
            expect(dashboardRecordingRowStyleHelper).toContain(
                rowMetaOwnershipToken,
            );
        }
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
        expect(recordingRowSourceMark).toContain(
            "dashboardRecordingRowStyles.sourceMark",
        );
        expect(recordingRowSourceMark).toContain(
            "dashboardRecordingRowStyles.sourceMarkImage",
        );
        expect(recordingRowSourceMark).toContain(
            "dashboardRecordingRowStyles.sourceMarkImageCover",
        );
        expect(recordingRowSourceMark).toContain(
            "dashboardRecordingRowStyles.sourceMarkLetter",
        );
        expect(recordingRowSourceMark).toContain(
            "dashboardRecordingRowStyles.duration",
        );
        expect(
            recordingRowSourceMark.match(
                /dashboardRecordingRowStyles\.sourceMark\b/g,
            ) ?? [],
        ).toHaveLength(2);
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
            "const dashboardRecordingTimeFilterStyles = {",
        );
        expect(workstation).toContain(
            "function dashboardRecordingTimeFilterCountClassName(active: boolean)",
        );
        const recordingTimeFilter = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-recording-time-filter"',
            "ToggleGroup",
        );
        expect(recordingTimeFilter).toContain("value={timelineFilter}");
        expect(recordingTimeFilter).toContain("spacing={1}");
        expect(recordingTimeFilter).toContain('variant="outline"');
        expect(recordingTimeFilter).toContain('size="sm"');
        expect(recordingTimeFilter).toContain(
            "dashboardRecordingTimeFilterStyles.root",
        );
        expect(recordingTimeFilter).toContain(
            'hidden={listMode !== "timeline"}',
        );
        expect(recordingTimeFilter).toContain(
            "listMode !== \"timeline\"\n                                            ? true",
        );
        expect(workstation).toContain("setTimelineFilter(");
        expect(recordingTimeFilter).not.toContain("layout=");
        expect(recordingTimeFilter).not.toContain(
            "dashboardRecordingTimeFilter\"",
        );
        const recordingTimeFilterItem = extractOpeningElement(
            workstation,
            'data-sot-control="dashboard-recording-time-filter"',
            "ToggleGroupItem",
        );
        expect(recordingTimeFilterItem).toContain("aria-pressed={active}");
        expect(recordingTimeFilterItem).toContain("data-tf={item.value}");
        expect(recordingTimeFilterItem).toContain(
            "data-sot-filter={item.value}",
        );
        expect(recordingTimeFilterItem).toContain(
            "dashboardRecordingTimeFilterStyles.item",
        );
        const recordingTimeFilterCount = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-time-filter-count"',
            "span",
        );
        expect(recordingTimeFilterCount).toContain(
            "dashboardRecordingTimeFilterCountClassName(",
        );
        expect(workstation).toContain("{timelineCounts[item.value]}");
        expect(workstation).toContain(
            "dashboardRecordingTimeFilterStyles.countSelected",
        );
        expect(toggleGroupPrimitive).not.toContain(
            "dashboardRecordingTimeFilter",
        );
        expect(toggleGroupPrimitive).not.toContain(
            "data-sot-part=dashboard-recording-time-filter-count",
        );
        expect(toggleGroupPrimitive).not.toContain(
            "dashboard-recording-time-filter-count",
        );
        expect(globals).not.toContain(
            "--dashboard-recording-time-filter-count-bg",
        );
        expect(globals).not.toContain(
            "--dashboard-recording-time-filter-count-selected-bg",
        );
        expect(globals).toContain(
            '[data-sot-panel="dashboard-recording-time-filter"][hidden]',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-body"',
        );
        const dashboardRecordingRowBody = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-body"',
            "div",
        );
        expect(dashboardRecordingRowBody).toContain(
            "dashboardRecordingRowStyles.body",
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-title"',
        );
        const dashboardRecordingRowTitle = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-title"',
            "div",
        );
        expect(dashboardRecordingRowTitle).toContain(
            "dashboardRecordingRowStyles.title",
        );
        const dashboardRecordingRowMeta = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-meta"',
            "div",
        );
        expect(dashboardRecordingRowMeta).toContain(
            "dashboardRecordingRowStyles.meta",
        );
        const dashboardRecordingRowSecondary = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-secondary"',
            "div",
        );
        expect(dashboardRecordingRowSecondary).toContain(
            "dashboardRecordingRowStyles.secondary",
        );
        expect(workstation).toContain("dashboardRecordingRowStyles.timestamp");
        expect(workstation).toContain(
            "dashboardRecordingRowStyles.timestampAbsolute",
        );
        expect(workstation).toContain(
            "dashboardRecordingRowStyles.timestampRelative",
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-actions"',
        );
        const dashboardRecordingRowActions = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-actions"',
            "div",
        );
        expect(dashboardRecordingRowActions).toContain(
            "dashboardRecordingRowStyles.actions",
        );
        const dashboardRecordingTagChip = extractOpeningElement(
            workstation,
            "data-recording-tag-chip",
            "Badge",
        );
        expect(dashboardRecordingTagChip).toContain(
            'variant="recordingTagChip"',
        );
        expect(dashboardRecordingTagChip).not.toContain('variant="outline"');
        expect(sourceReportBadgePrimitive).toContain("recordingTagChip:");
        for (const tagColorRule of [
            "data-[sot-tag-color=blue]:[--tag-c:var(--tag-blue)]",
            "data-[sot-tag-color=purple]:[--tag-c:var(--tag-violet)]",
            "data-[sot-tag-color=red]:[--tag-c:var(--tag-rose)]",
            "data-[sot-tag-color=orange]:[--tag-c:var(--tag-amber)]",
            "data-[sot-tag-color=green]:[--tag-c:var(--tag-green)]",
            "data-[sot-tag-color=slate]:[--tag-c:var(--tag-slate)]",
        ]) {
            expect(sourceReportBadgePrimitive).toContain(tagColorRule);
        }
        expect(sourceReportBadgePrimitive).toContain("[&>svg]:stroke-current");
        expect(globals).not.toContain(
            '[data-recording-tag-chip][data-variant="recordingTagChip"]',
        );
        expect(globals).not.toContain(
            '[data-recording-tag-chip][data-variant="outline"]',
        );
        expect(workstation).not.toContain("DASHBOARD_RECORDING_ROW_BUTTON_CLASS");
        expect(workstation).toMatch(
            /<Button\s+variant="ghostNeutral"\s+size="default"[\s\S]*className=\{\s*dashboardRecordingRowStyles\.row\s*\}[\s\S]*data-sot-control="dashboard-recording-row"/,
        );
        for (const rowPrimitiveLeak of [
            "dashboardRecordingRow",
            "dashboard-recording-row",
            "dashboard-recording-list-group",
            "is-hover-demo",
            "is-focus-demo",
        ]) {
            expect(button).not.toContain(rowPrimitiveLeak);
        }
        for (const sourceMarkPrimitiveLeak of [
            "dashboardRecordingSourceMark",
            "dashboard-recording-source-mark",
            "dashboardRecordingRowStyles",
            "sourceMarkImageCover",
        ]) {
            expect(button).not.toContain(sourceMarkPrimitiveLeak);
            expect(sourceReportBadgePrimitive).not.toContain(
                sourceMarkPrimitiveLeak,
            );
        }
        expect(workstation).not.toMatch(
            /<button[\s\S]{0,260}data-sot-control="dashboard-recording-row"/,
        );
        expect(workstation).toMatch(
            /<Button\s+variant="recordingListTagFilterTrigger"\s+size="recordingListTagFilterTrigger"[\s\S]*data-sot-control="recording-list-tag-filter-trigger"/,
        );
        expect(workstation).toMatch(
            /<Button\s+variant="recordingListTagFilterOption"\s+size="recordingListTagFilterOption"[\s\S]*role="option"[\s\S]*data-sot-control="recording-list-tag-filter"[\s\S]*data-sot-state=\{\s*active\s*\?\s*"selected"\s*:\s*"idle"\s*\}/,
        );
        expect(workstation).not.toMatch(
            /variant=\{\s*active\s*\?\s*"secondary"\s*:\s*"ghost"\s*\}/,
        );
        expect(workstation).toMatch(
            /<Button\s+variant="recordingListStatePrimary"\s+size="recordingListStateAction"[\s\S]*data-sot-control="recording-list-open-data-sources"/,
        );
        for (const control of [
            "recording-list-clear-filters",
            "recording-list-clear-timeline",
            "recording-list-clear-tag",
        ]) {
            expect(workstation).toMatch(
                new RegExp(
                    `<Button\\s+variant="recordingListStateAction"\\s+size="recordingListStateAction"[\\s\\S]*data-sot-control="${control}"`,
                ),
            );
        }
        for (const control of [
            "recording-list-prev-page",
            "recording-list-next-page",
            "recording-list-load-more",
        ]) {
            expect(workstation).toMatch(
                new RegExp(
                    `<Button\\s+variant="recordingListPagination"\\s+size="recordingListPagination"[\\s\\S]*data-sot-control="${control}"`,
                ),
            );
        }
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
        for (const migratedSelectorFragment of DASHBOARD_RECORDING_ROW_META_MIGRATED_GLOBAL_SELECTOR_FRAGMENTS.filter(
            (selector) => selector.includes("dashboard-recording-source-mark"),
        )) {
            expect(globals).not.toContain(migratedSelectorFragment);
        }
        expect(workstation).toContain("<Button");
        expect(workstation).toContain('variant="dashboardSearchTrigger"');
        expect(workstation).toContain('size="dashboardSearchTrigger"');
        expect(workstation).toContain('variant="dashboardActivityTrigger"');
        expect(workstation).toContain('size="dashboardActivityTrigger"');
        expect(workstation).toContain('variant="playerControl"');
        expect(workstation).toContain('size="playerControl"');
        expect(workstation).toContain('variant="playerPrimary"');
        expect(workstation).toContain('size="playerControlLg"');
        expect(workstation).toContain('variant="playerSpeed"');
        expect(workstation).toContain('size="playerSpeed"');
        expect(workstation).toContain('size="playerControlSm"');
        expect(workstation).not.toContain("SOT_PLAYER_BUTTON_CLASS");
        expect(workstation).not.toContain("SOT_PLAYER_PRIMARY_BUTTON_CLASS");
        expect(workstation).not.toContain("SOT_PLAYER_BUTTON_SM_CLASS");
        expect(workstation).not.toContain("SOT_PLAYER_SPEED_BUTTON_CLASS");
        expect(workstation).not.toContain("SOT_PLAYER_SEEK_SLIDER_CLASS");
        expect(workstation).not.toContain("SOT_PLAYER_SEEK_RANGE_CLASS");
        expect(workstation).not.toContain("SOT_PLAYER_SEEK_THUMB_CLASS");
        expect(workstation).not.toContain("SOT_PLAYER_VOLUME_SLIDER_CLASS");
        expect(workstation).not.toContain("dashboardSeekSliderRootStyle");
        expect(workstation).not.toContain("sotPlayerSeekRangeStyle");
        expect(workstation).not.toContain("sotPlayerSeekThumbStyle");
        expect(workstation).not.toContain("SotPlayerSliderTrackStyle");
        const transcriptLanguageBadge = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-language"',
            "Badge",
        );
        expect(transcriptLanguageBadge).toContain(
            'variant="dashboardTranscriptLanguage"',
        );
        expect(transcriptLanguageBadge).not.toContain('variant="outline"');
        expect(transcriptLanguageBadge).not.toContain("className=");
        expect(sourceReportBadgePrimitive).toContain(
            "dashboardTranscriptLanguage:",
        );
        for (const control of DASHBOARD_TRANSCRIPT_GENERIC_COPY_CONTROLS) {
            const buttonOpening = extractOpeningElement(
                workstation,
                `data-sot-control="${control}"`,
                "Button",
            );
            expect(buttonOpening).toContain('variant="dashboardCopy"');
            expect(buttonOpening).toContain('size="dashboardCopy"');
            expect(buttonOpening).not.toContain("className=");
        }
        for (const control of DASHBOARD_TRANSCRIPT_COPY_CONTROLS) {
            const buttonOpening = extractOpeningElement(
                workstation,
                `data-sot-control="${control}"`,
                "Button",
            );
            expect(buttonOpening).toContain(
                'variant="sourceReportCopyAction"',
            );
            expect(buttonOpening).toContain('size="sourceReportCopyAction"');
            expect(buttonOpening).not.toContain('variant="ghost"');
            expect(buttonOpening).not.toContain('variant="secondary"');
            expect(buttonOpening).not.toContain('variant="destructive"');
            expect(buttonOpening).not.toContain('size="sm"');
            expect(buttonOpening).not.toContain("className=");
        }
        for (const control of DASHBOARD_TRANSCRIPT_GENERIC_COMPACT_ACTION_CONTROLS) {
            const buttonOpening = extractOpeningElement(
                workstation,
                `data-sot-control="${control}"`,
                "Button",
            );
            expect(buttonOpening).toContain(
                'variant="dashboardCompactAction"',
            );
            expect(buttonOpening).toContain('size="dashboardCompactAction"');
            expect(buttonOpening).not.toContain("className=");
        }
        for (const control of DASHBOARD_TRANSCRIPT_COMPACT_ACTION_CONTROLS) {
            const buttonOpening = extractOpeningElement(
                workstation,
                `data-sot-control="${control}"`,
                "Button",
            );
            expect(buttonOpening).toContain('variant="sourceReportAction"');
            expect(buttonOpening).toContain('size="sourceReportAction"');
            expect(buttonOpening).not.toContain('variant="ghost"');
            expect(buttonOpening).not.toContain('variant="default"');
            expect(buttonOpening).not.toContain('size="sm"');
            expect(buttonOpening).not.toContain("className=");
        }
        for (const removed of [
            "SOT_COPY_BUTTON_BASE_CLASS",
            "SOT_COPY_SUCCESS_BUTTON_CLASS",
            "SOT_COPY_DANGER_BUTTON_CLASS",
            "SOT_COMPACT_GHOST_BUTTON_CLASS",
            "getSotCopyButtonClass",
        ]) {
            expect(workstation).not.toContain(removed);
        }
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
        const dashboardPlayerStatusBadge = extractOpeningElement(
            dashboardPlayer,
            'data-sot-control="player-status"',
            "Badge",
        );
        const dashboardNoAudioAlert = extractOpeningElement(
            dashboardPlayer,
            'data-sot-part="dashboard-recording-player-no-audio"',
            "Alert",
        );
        const dashboardNoAudioTitle = extractOpeningElement(
            dashboardPlayer,
            'data-sot-part="dashboard-recording-player-no-audio-title"',
            "AlertTitle",
        );
        const dashboardNoAudioDescription = extractOpeningElement(
            dashboardPlayer,
            'data-sot-part="dashboard-recording-player-no-audio-description"',
            "AlertDescription",
        );
        const dashboardVolumeMuteControl = extractOpeningElement(
            dashboardPlayer,
            'data-sot-control="dashboard-player-volume-mute"',
            "Button",
        );
        const dashboardSeekShell = extractOpeningElement(
            dashboardPlayer,
            'data-sot-part="dashboard-player-seek-shell"',
            "span",
        );
        const dashboardVolumeAnchor = extractOpeningElement(
            dashboardPlayer,
            'data-sot-part="dashboard-player-volume-anchor"',
            "div",
        );
        expect(dashboardPlayer).toContain("<Card");
        expect(dashboardPlayer).toContain("hasNoPadding");
        expect(dashboardPlayer).toContain(
            'variant="dashboardRecordingPlayer"',
        );
        expect(sourceReportCardPrimitive).toContain(
            "dashboardRecordingPlayer:",
        );
        expect(sourceReportCardPrimitive).toContain('data-variant={variant}');
        expect(sourceReportCardPrimitive).toContain("cardVariants[variant]");
        for (const token of [
            "min-h-[114px]",
            "overflow-visible",
            "rounded-[16px]",
            "border-[var(--glass-border-soft)]",
            "shadow-none",
            "backdrop-blur-none",
        ]) {
            expect(sourceReportCardPrimitive).toContain(token);
        }
        expect(dashboardPlayer).not.toContain(
            'className="min-h-[114px] gap-0 overflow-visible rounded-[16px] border-[var(--glass-border-soft)] bg-[rgb(255_255_255_/_0.025)] px-[18px] py-[16px] shadow-none backdrop-blur-none"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-surface="dashboard-recording-player"',
        );
        expect(dashboardPlayer).toContain("<Alert");
        expect(alertPrimitive).toContain("playerNoAudio:");
        expect(dashboardNoAudioAlert).toContain('variant="playerNoAudio"');
        expect(dashboardNoAudioAlert).toContain('density="playerNoAudio"');
        expect(dashboardNoAudioAlert).toContain('layout="playerNoAudio"');
        expect(dashboardNoAudioAlert).not.toContain("className=");
        expect(alertPrimitive).toContain("data-player-no-audio-text");
        expect(alertPrimitive).not.toContain(
            "dashboard-recording-player-no-audio-text",
        );
        expect(alertPrimitive).not.toContain("recording-player-no-audio-text");
        expect(dashboardPlayer).toContain("<SotPlayerNoAudioIcon");
        expect(dashboardPlayer).not.toContain(
            '<SotPlayerNoAudioIcon className="size-3.5" />',
        );
        expect(dashboardPlayer).toContain("data-player-no-audio-text");
        expect(dashboardPlayer).toContain("<AlertTitle");
        expect(dashboardNoAudioTitle).toContain('density="playerNoAudio"');
        expect(dashboardPlayer).toContain("<AlertDescription");
        expect(dashboardNoAudioDescription).toContain(
            'density="playerNoAudio"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-part="dashboard-recording-player-no-audio"',
        );
        expect(dashboardPlayer).toContain("<CardHeader");
        expect(dashboardPlayer).toContain(
            'className="mb-[12px] flex flex-row flex-wrap items-center gap-[10px] p-0"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-part="dashboard-recording-player-meta"',
        );
        expect(dashboardPlayer).toContain("<CardContent");
        expect(dashboardPlayer).toContain(
            'className="flex min-w-0 items-center gap-[12px] overflow-visible p-0"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-panel="dashboard-recording-player-controls"',
        );
        expect(dashboardPlayer).toContain("<Badge");
        expect(dashboardPlayerStatusBadge).toContain(
            'variant="playerStatus"',
        );
        expect(dashboardPlayerStatusBadge).toContain('className="ml-auto"');
        expect(dashboardPlayerStatusBadge).toContain(
            'data-sot-control="player-status"',
        );
        expect(dashboardPlayerStatusBadge).toMatch(
            /data-sot-tone=\{\s*selectedPlayerStatus\.tone\s*\}/,
        );
        expect(dashboardPlayer).not.toContain("SOT_PLAYER_STATUS_BADGE_CLASS");
        expect(dashboardPlayer).toContain("<Button");
        expect(dashboardPlayer).toContain(
            'data-sot-control="dashboard-player-play"',
        );
        expect(dashboardPlayer).toContain('variant="playerControl"');
        expect(dashboardPlayer).toContain('size="playerControl"');
        expect(dashboardPlayer).toContain('variant="playerPrimary"');
        expect(dashboardPlayer).toContain('size="playerControlLg"');
        expect(dashboardPlayer).toContain('variant="playerSpeed"');
        expect(dashboardPlayer).toContain('size="playerSpeed"');
        expect(dashboardPlayer).toContain('size="playerControlSm"');
        expect(dashboardVolumeMuteControl).toContain('variant="playerControl"');
        expect(dashboardVolumeMuteControl).toContain('size="playerControlSm"');
        expect(dashboardVolumeMuteControl).not.toContain("className=");
        expect(button).toContain("data-player-control-icon");
        expect(button).not.toContain("dashboard-player-volume-icon");
        expect(button).not.toContain("recording-player-volume-icon");
        expect(dashboardPlayer).toContain("data-player-control-icon");
        expect(dashboardPlayer).not.toContain("SOT_PLAYER_BUTTON_CLASS");
        expect(dashboardPlayer).not.toContain(
            "SOT_PLAYER_PRIMARY_BUTTON_CLASS",
        );
        expect(dashboardPlayer).not.toContain("SOT_PLAYER_BUTTON_SM_CLASS");
        expect(dashboardPlayer).not.toContain("SOT_PLAYER_SPEED_BUTTON_CLASS");
        expect(dashboardPlayer).not.toContain('variant="ghost"');
        expect(dashboardPlayer).not.toContain('variant="outline"');
        expect(dashboardPlayer).not.toContain('variant="default"');
        expect(dashboardPlayer).not.toContain('size="icon-sm"');
        expect(dashboardPlayer).not.toContain('size="icon-xs"');
        expect(dashboardPlayer).not.toContain('size="sm"');
        expect(dashboardPlayer).not.toContain('variant="player"');
        expect(dashboardPlayer).not.toContain('variant="player-primary"');
        expect(dashboardPlayer).not.toContain('size="player"');
        expect(dashboardPlayer).not.toContain('size="player-lg"');
        expect(dashboardPlayer).not.toContain('size="player-sm"');
        expect(
            extractCssBlock(
                globals,
                '[data-sot-control="dashboard-player-play"]',
            ),
        ).not.toContain("background:");
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
        expect(dashboardSeekShell).toContain(
            'className="relative block h-[14px] w-[168px] min-w-[168px] grow-0 shrink-0 basis-[168px]"',
        );
        expect(dashboardPlayer).toContain('variant="playerSeek"');
        expect(dashboardPlayer).toContain('className="flex-none"');
        expect(dashboardPlayer).not.toContain("SOT_PLAYER_SEEK_SLIDER_CLASS");
        expect(dashboardPlayer).not.toContain("SOT_PLAYER_SEEK_RANGE_CLASS");
        expect(dashboardPlayer).not.toContain("SOT_PLAYER_SEEK_THUMB_CLASS");
        expect(dashboardPlayer).not.toContain("dashboardSeekSliderRootStyle");
        expect(dashboardPlayer).not.toContain("sotPlayerSeekRangeStyle");
        expect(dashboardPlayer).not.toContain("sotPlayerSeekThumbStyle");
        expect(dashboardPlayer).not.toContain("className: SOT_PLAYER");
        expect(dashboardPlayer).not.toContain("style: sotPlayer");
        expect(dashboardPlayer).not.toContain(
            "style: dashboardSeekSliderRootStyle",
        );
        expect(dashboardPlayer).toContain(
            'data-sot-part="dashboard-player-volume-anchor"',
        );
        expect(dashboardVolumeAnchor).toContain(
            'className="relative ml-0 inline-flex"',
        );
        expect(dashboardPlayer).toContain(
            'data-sot-panel="dashboard-player-volume-popover"',
        );
        expect(dashboardPlayer).toContain('variant="playerVolume"');
        expect(dashboardPlayer).not.toContain(
            'className="w-[200px] min-w-[200px] gap-0 overflow-visible px-2.5 py-2"',
        );
        expect(dashboardPlayer).not.toContain("SOT_PLAYER_VOLUME_SLIDER_CLASS");
        expect(dashboardPlayer).toContain("<Popover");
        expect(dashboardPlayer).toContain("<PopoverTrigger asChild>");
        expect(dashboardPlayer).toContain("<PopoverContent");
        expect(dashboardPlayer).toContain('side="top"');
        expect(dashboardPlayer).toContain('align="end"');
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
        expect(
            collectCssRuleBlocks(globals, '[data-sot-control="player-status"]'),
        ).toEqual([]);
        for (const selector of PLAYER_ALERT_CARD_BADGE_PRIMITIVE_REPAINT_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
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
            '[data-sot-part="dashboard-player-seek-shell"]',
            '[data-sot-part="dashboard-player-volume-anchor"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
        expect(globals).toContain(
            '[data-sot-part="recording-player-volume-anchor"]',
        );
        for (const [
            surface,
            selector,
        ] of PLAYER_PORTAL_VOLUME_SCOPED_SELECTORS) {
            expect(
                collectCssRuleBlocks(globals, selector).filter(({ prelude }) =>
                    prelude.includes(surface),
                ),
            ).toEqual([]);
        }
        const playerSliderPrimitiveBlocks = PLAYER_SLIDER_CONTROL_HOOKS.flatMap(
            (control) =>
                PLAYER_SLIDER_PRIMITIVE_SLOTS.flatMap((slot) =>
                    collectCssRuleBlocks(
                        globals,
                        `[data-slot="${slot}"]`,
                    ).filter(({ prelude }) =>
                        prelude.includes(`[data-sot-control="${control}"]`),
                    ),
                ),
        );
        expect(playerSliderPrimitiveBlocks).toEqual([]);
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
        const dashboardFavoriteButton = extractElementSlice(
            workstation,
            'data-sot-control="dashboard-favorite"',
            "Button",
        );
        expect(dashboardFavoriteButton).toContain(
            '<Icon data-icon="inline-start" />',
        );
        const dashboardActivityDismissButton = extractElementSlice(
            workstation,
            'data-sot-control="dashboard-activity-dismiss"',
            "Button",
        );
        expect(dashboardActivityDismissButton).toContain(
            'variant="dashboardActivityDismiss"',
        );
        expect(dashboardActivityDismissButton).toContain(
            'size="dashboardActivityDismiss"',
        );
        expect(dashboardActivityDismissButton).toContain(
            '<X data-icon="inline-start" />',
        );
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
        expect(sourceReportSkeletonPrimitive).toContain("sourceReportCard:");
        expect(sourceReportSkeletonPrimitive).toContain(
            "sourceReportSegment:",
        );
        expect(sourceReportSkeletonPrimitive).toContain(
            "sourceReportCardSource",
        );
        expect(sourceReportSkeletonPrimitive).toContain(
            "sourceReportSegmentLineLong",
        );
        expect(workstation).toContain('variant="sourceReportCard"');
        expect(workstation).toContain('variant="sourceReportSegment"');
        expect(workstation).toContain(
            "size={sourceReportCardSkeletonSize(size)}",
        );
        expect(workstation).toContain(
            "size={sourceReportSegmentSkeletonSize(size)}",
        );
        expect(workstation).not.toContain(
            "const sotSourceReportCardSkeletonClassNames",
        );
        expect(workstation).not.toContain(
            "const sotSourceReportSegmentSkeletonClassNames",
        );
        expect(workstation).not.toContain(
            "className={sotSourceReportCardSkeletonClassNames[size]}",
        );
        expect(workstation).not.toContain(
            "className={sotSourceReportSegmentSkeletonClassNames[size]}",
        );
        const sourceReportEmptyPrimitive = readSource(
            "components/ui/empty.tsx",
        );
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
        for (const selector of SOURCE_REPORT_EMPTY_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        for (const selector of [
            "[data-sot-source-report-empty-actions] button",
            "[data-sot-source-report-empty-actions] button:focus-visible",
            '[data-sot-source-report-empty-actions] [data-variant="default"]',
            '[data-sot-source-report-empty-actions] [data-variant="ghost"]',
        ]) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        const sourceReportEmptyActionStateButtonBlocks = collectCssRuleBlocks(
            globals,
            "[data-sot-source-report-empty-actions]",
        ).filter(({ declarations, prelude }) => {
            const normalizedPrelude = prelude.replace(/\s+/g, " ");
            return (
                normalizedPrelude.includes(
                    '[data-sot-state="loading"]',
                ) ||
                normalizedPrelude.includes('[aria-busy="true"]') ||
                normalizedPrelude.includes(":disabled") ||
                normalizedPrelude.includes('[aria-disabled="true"]') ||
                /\bcursor\s*:/.test(declarations)
            );
        });
        expect(sourceReportEmptyActionStateButtonBlocks).toEqual([]);
        const sourceReportNoSourceEmpty = extractBoundedSlice(
            sourceReportPanel,
            '<Empty\n                        className="px-4 py-8"',
            "</Empty>",
        );
        expect(sourceReportNoSourceEmpty).toContain(
            "data-sot-source-report-empty",
        );
        expect(sourceReportNoSourceEmpty).toContain(
            "<EmptyHeader data-sot-source-report-empty-header>",
        );
        expect(sourceReportNoSourceEmpty).toContain("<EmptyMedia");
        expect(sourceReportNoSourceEmpty).toContain('variant="icon"');
        expect(sourceReportNoSourceEmpty).toContain(
            "data-sot-source-report-empty-icon",
        );
        expect(sourceReportNoSourceEmpty).toContain(
            "<EmptyTitle data-sot-source-report-empty-title>",
        );
        expect(sourceReportNoSourceEmpty).toMatch(
            /<EmptyDescription\s+data-sot-source-report-empty-description\s*>/,
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
        for (const selector of SOURCE_REPORT_METRIC_GENERIC_CARD_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of REMOVED_AUTH_ONBOARDING_CARD_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of SOURCE_REPORT_METRIC_REMOVED_CARD_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of SOURCE_REPORT_METRIC_GLOBAL_REPAINT_SELECTOR_FRAGMENTS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of SOURCE_REPORT_METRIC_REMOVED_PRIMITIVE_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of SOURCE_REPORT_METRIC_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
        expect(sourceReportCardPrimitive).toContain("sourceReportMetric:");
        expect(sourceReportCardPrimitive).toContain(
            "border-[var(--source-report-metric-border)]",
        );
        expect(sourceReportBadgePrimitive).toContain("sourceReportStatus:");
        expect(sourceReportBadgePrimitive).toContain("data-[sot-tone=ok]");
        expect(sourceReportBadgePrimitive).toContain("data-[sot-tone=warn]");
        expect(sourceReportBadgePrimitive).toContain("data-[sot-tone=err]");
        for (const sourceReportStatusDotPrimitiveClass of [
            "[&_[data-sot-part=source-report-status-dot]]:inline-block",
            "[&_[data-sot-part=source-report-status-dot]]:size-[5px]",
            "[&_[data-sot-part=source-report-status-dot]]:rounded-full",
            "[&_[data-sot-part=source-report-status-dot]]:bg-current",
            "[&_[data-sot-part=dashboard-source-report-status-dot]]:inline-block",
            "[&_[data-sot-part=dashboard-source-report-status-dot]]:size-[5px]",
            "[&_[data-sot-part=dashboard-source-report-status-dot]]:rounded-full",
            "[&_[data-sot-part=dashboard-source-report-status-dot]]:bg-current",
        ]) {
            expect(sourceReportBadgePrimitive).toContain(
                sourceReportStatusDotPrimitiveClass,
            );
        }
        expect(workstation).toContain('variant="sourceReportMetric"');
        expect(workstation).toContain('variant="sourceReportStatus"');
        expect(workstation).toMatch(/data-sot-tone=\{\s*tone\s*\}/);
        expect(workstation).not.toContain("SOURCE_REPORT_METRIC_CARD_CLASS");
        expect(workstation).not.toContain("SOURCE_REPORT_STATUS_BADGE_CLASS");
        expect(workstation).not.toContain(
            "SOURCE_REPORT_STATUS_BADGE_TONE_CLASS",
        );
        expect(workstation).not.toContain(
            "className={SOURCE_REPORT_METRIC_CARD_CLASS}",
        );
        expect(sourceReportPanel).toContain(
            "<div data-sot-source-report-actions>",
        );
        expect(sourceReportPanel).not.toContain(
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
        ].filter(({ prelude, declarations }) => {
            const normalizedPrelude = prelude.replace(/\s+/g, " ");
            const targetsSourceReportButton =
                /\[data-sot-source-report(?:-empty)?-actions\][^{,]*(?:\bbutton\b|\[data-slot="button"\])(?::(?:hover|focus-visible))?/.test(
                    normalizedPrelude,
                );
            const targetsSourceReportActionStateCursor =
                /\[data-sot-source-report-actions\][^{,]*\[data-sot-control="(?:open-source-record|repull-source)"\][^{,]*(?:\[data-sot-state="(?:loading|unavailable)"\]|\[aria-busy="true"\]|:disabled|\[aria-disabled="true"\])/.test(
                    normalizedPrelude,
                ) && /\bcursor\s*:\s*(?:progress|not-allowed)\b/.test(declarations);

            return (
                targetsSourceReportButton || targetsSourceReportActionStateCursor
            );
        });

        expect(sourceReportActionButtonCssBlocks).toEqual([]);
        const sourceReportActions = extractBoundedSlice(
            sourceReportPanel,
            "const sourceActionControls = data ? (",
            ") : null;",
        );
        expect(sourceReportActions).toContain(
            "<div data-sot-source-report-actions>",
        );
        expect(sourceReportButtonPrimitive).toContain("sourceReportAction:");
        expect(sourceReportButtonPrimitive).toContain(
            "sourceReportPrimaryAction:",
        );
        expect(sourceReportButtonPrimitive).toContain(
            "sourceReportGhostAction:",
        );
        expect(sourceReportButtonPrimitive).toContain(
            "sourceReportCopyAction:",
        );
        expect(sourceReportActions).toContain('variant="sourceReportAction"');
        expect(sourceReportActions).toContain(
            'variant="sourceReportGhostAction"',
        );
        expect(sourceReportActions).toContain('size="sourceReportAction"');
        expect(sourceReportActions).not.toContain('variant="outline"');
        expect(sourceReportActions).not.toContain('variant="ghost"');
        expect(sourceReportActions).not.toContain('size="xs"');
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
        expect(sourceReportEmptyActions).toContain(
            'variant="sourceReportPrimaryAction"',
        );
        expect(sourceReportEmptyActions).toContain(
            'variant="sourceReportGhostAction"',
        );
        expect(sourceReportEmptyActions).toContain(
            'size="sourceReportAction"',
        );
        expect(sourceReportEmptyActions).not.toContain('variant="default"');
        expect(sourceReportEmptyActions).not.toContain('variant="ghost"');
        expect(sourceReportEmptyActions).not.toContain('size="sm"');
        expect(sourceReportEmptyActions).not.toContain('size="xs"');
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
        expect(dashboardSourceReportLoaded).toContain(
            'variant="sourceReportStatus"',
        );
        for (const genericToken of [
            'variant="outline"',
            'variant="ghost"',
            'variant="default"',
            'size="sm"',
        ]) {
            expect(dashboardSourceReportLoaded).not.toContain(genericToken);
        }
        const dashboardSourceReportOpenAction = extractOpeningElement(
            workstation,
            'data-sot-control="open-source-record"',
            "Button",
        );
        const dashboardSourceReportRepullAction = extractOpeningElement(
            workstation,
            'data-sot-control="repull-source"',
            "Button",
        );
        expect(dashboardSourceReportOpenAction).toContain(
            'variant="sourceReportAction"',
        );
        expect(dashboardSourceReportOpenAction).toContain(
            'size="sourceReportAction"',
        );
        expect(dashboardSourceReportRepullAction).toContain(
            'variant="sourceReportGhostAction"',
        );
        expect(dashboardSourceReportRepullAction).toContain(
            'size="sourceReportAction"',
        );
        for (const action of [
            dashboardSourceReportOpenAction,
            dashboardSourceReportRepullAction,
        ]) {
            expect(action).not.toContain('variant="ghost"');
            expect(action).not.toContain('variant="outline"');
            expect(action).not.toContain('size="sm"');
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
        const alert = readSource("components/ui/alert.tsx");
        const badge = readSource("components/ui/badge.tsx");
        const button = readSource("components/ui/button.tsx");
        const card = readSource("components/ui/card.tsx");
        const input = readSource("components/ui/input.tsx");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const spinnerPrimitive = readSource("components/ui/spinner.tsx");
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
        expect(badge).toContain("detailHeaderLocal:");
        expect(badge).toContain("detailHeaderStatus:");
        expect(badge).toContain("ml-1 shrink-0");
        expect(button).toContain('data-slot="button"');
        expect(button).toContain("data-variant={variant}");
        expect(button).toContain("data-size={size}");
        expect(card).toContain('data-slot="card-header"');
        expect(input).toContain('data-slot="input"');
        expect(card).toContain("detailHeader:");
        expect(card).toContain("data-[sot-state=saving]:py-0");
        expect(card).toContain(
            'detailHeaderTitle: "leading-none font-semibold min-w-0 flex-1 truncate"',
        );
        expect(badge).toContain("detailHeaderLocal:");
        expect(badge).toContain("detailHeaderStatus:");
        expect(button).toContain("detailHeaderIconAction:");
        expect(button).toContain("detailHeaderAction:");
        expect(button).toContain(
            "detailHeaderIconAction:\n                    \"border border-transparent bg-transparent p-0 text-[var(--fg-secondary)] shadow-none",
        );
        expect(button).toContain(
            "detailHeaderAction:\n                    \"border border-[var(--line-hairline)] bg-[var(--glass-tint-base)] font-sans font-semibold text-[var(--fg-primary)] shadow-[var(--shadow-xs)]",
        );
        expect(button).toContain('detailHeaderIconAction: "size-[32px]"');
        expect(button).toContain(
            'detailHeaderAction:\n                    "h-8 gap-[7px] rounded-[9px] px-3 text-[12.5px] leading-normal',
        );
        expect(button).toContain("has-[>svg]:px-3");
        expect(button).toContain("[&_svg:not([class*='size-'])]:size-4");
        expect(input).toContain("detailHeaderTitle:");
        expect(input).toContain(
            '"h-8 min-w-0 flex-1 px-3 py-1 text-base md:text-sm"',
        );
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
        expect(dashboardDetailHeader).toContain('variant="detailHeader"');
        expect(dashboardDetailHeader).toContain(
            'variant="detailHeaderTitle"',
        );
        expect(dashboardDetailHeader).toContain(
            'variant="detailHeaderLocal"',
        );
        expect(dashboardDetailHeader).toContain(
            'variant="detailHeaderStatus"',
        );
        expect(dashboardDetailHeader).toContain(
            'variant="detailHeaderIconAction"',
        );
        expect(dashboardDetailHeader).toContain(
            'size="detailHeaderIconAction"',
        );
        expect(dashboardDetailHeader).toContain(
            'variant="detailHeaderAction"',
        );
        expect(dashboardDetailHeader).toContain(
            'size="detailHeaderAction"',
        );
        expect(dashboardDetailHeader).toContain(
            'controlSize="detailHeaderTitle"',
        );
        expect(dashboardDetailHeader).not.toContain('variant="ghost"');
        expect(dashboardDetailHeader).not.toContain('variant="outline"');
        expect(dashboardDetailHeader).not.toContain('size="icon-sm"');
        expect(dashboardDetailHeader).not.toContain('size="sm"');
        expect(workstation).toContain(
            "const dashboardDetailHeaderState = renaming",
        );
        expect(workstation).toContain(
            "const dashboardDetailHeaderMode = editingTitle",
        );
        expect(dashboardDetailHeader).not.toContain(
            '"relative flex flex-row items-center gap-2.5 px-1 pt-1 pb-0"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'className="min-w-0 flex-1 truncate"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'className="h-8 min-w-0 flex-1"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'className="ml-1 shrink-0"',
        );
        expect(dashboardDetailHeader).toContain(
            'className="relative inline-flex items-center gap-1.5"',
        );
        expect(dashboardDetailHeader).toContain(
            'dashboardDetailHeaderState === "normal"',
        );
        expect(dashboardDetailHeader).toContain(
            'dashboardDetailHeaderState === "editing"',
        );
        expect(dashboardDetailHeader).toContain(
            'dashboardDetailHeaderState === "saving"',
        );
        expect(dashboardDetailHeader).toContain('data-sot-state="saving"');
        expect(dashboardDetailHeader).toContain("localDeleteAvailable ? (");
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
        for (const selector of [
            'data-sot-control="rename-recording-title"',
            'data-sot-control="recording-more-actions"',
            'data-sot-control="ai-rename"',
        ]) {
            expect(globals).not.toContain(selector);
        }
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
            '[data-sot-panel="recording-detail-header"]',
            '[data-sot-part="detail-header-title-input"][data-slot="input"]',
            '[data-sot-part="detail-header-title-status"]',
            '[data-sot-part="detail-header-local-badge"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of [
            '[data-sot-panel="dashboard-detail-header"]',
            '[data-sot-panel="dashboard-detail-header"] [data-sot-part="detail-header-title"]',
        ]) {
            expect(globals).toContain(selector);
        }
        expect(globals).not.toContain(
            '[data-sot-part="detail-header-action-anchor"]',
        );
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
        const dashboardSpeakersMerge = extractOpeningElement(
            workstation,
            'data-sot-control="dashboard-speakers-merge"',
            "Button",
        );
        expect(dashboardSpeakersMerge).toContain(
            'variant="dashboardSpeakersMerge"',
        );
        expect(dashboardSpeakersMerge).toContain(
            'size="dashboardSpeakersMerge"',
        );
        expect(dashboardSpeakersMerge).not.toContain('variant="ghost"');
        expect(dashboardSpeakersMerge).not.toContain('size="sm"');
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
        expect(workstation).not.toContain(
            "const dashboardTranscriptSkeletonClassNames",
        );
        expect(workstation).toContain("function DashboardTranscriptSkeleton");
        expect(dashboardTranscriptLoadingTurn).toContain(
            "<DashboardTranscriptSkeleton",
        );
        expect(dashboardTranscriptLoadingTurn).not.toContain("<Skeleton");
        expect(skeletonPrimitive).toContain("dashboardTranscript:");
        for (const size of DASHBOARD_TRANSCRIPT_SKELETON_PRIMITIVE_SIZES) {
            expect(skeletonPrimitive).toContain(size);
        }
        expect(workstation).toContain('variant="dashboardTranscript"');
        expect(workstation).toContain(
            "size={dashboardTranscriptSkeletonSize(size)}",
        );
        expect(workstation).not.toContain(
            "className={dashboardTranscriptSkeletonClassNames[size]}",
        );
        expect(workstation).toContain('data-sot-size={size}');
        expect(globals).not.toContain(
            '[data-sot-part="dashboard-transcript-skeleton"][data-slot="skeleton"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="dashboard-transcript-skeleton"][data-sot-size="avatar"]',
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
        expect(aiRenamePreview).toContain(
            'from "@/components/ui/separator";',
        );
        expect(aiRenamePreview).toContain("<Card");
        expect(aiRenamePreview).toContain("<CardHeader");
        expect(aiRenamePreview).toContain("<CardContent");
        expect(aiRenamePreview).toContain("<CardFooter");
        expect(aiRenamePreview).toContain("<Separator");
        expect(aiRenamePreview).toContain("<Alert");
        expect(aiRenamePreview).toContain("<Badge");
        expect(aiRenamePreview).toContain("<Button");
        expect(aiRenamePreview).toContain('data-sot-part="head"');
        expect(aiRenamePreview).toContain('data-sot-part="body"');
        expect(aiRenamePreview).toContain('data-sot-part="actions"');
        expect(aiRenamePreview).toContain('data-sot-part="review-row"');
        expect(aiRenamePreview).toContain('data-sot-part="review-old"');
        expect(aiRenamePreview).toContain('data-sot-part="review-new"');
        expect(aiRenamePreview).toContain(
            'import { Spinner } from "@/components/ui/spinner";',
        );
        expect(aiRenamePreview).toContain('variant="aiRenamePreview"');
        expect(aiRenamePreview).toContain('variant="aiRenamePreviewClose"');
        expect(aiRenamePreview).toContain('size="aiRenamePreviewClose"');
        expect(aiRenamePreview).toContain('variant="aiRenamePreviewAction"');
        expect(aiRenamePreview).toContain(
            'variant="aiRenamePreviewPrimaryAction"',
        );
        expect(aiRenamePreview).toContain('size="aiRenamePreviewAction"');
        expect(aiRenamePreview).toContain('variant="aiRenamePreviewOldTag"');
        expect(aiRenamePreview).toContain('variant="aiRenamePreviewNewTag"');
        expect(aiRenamePreview).toContain('placement="centeredBlock"');
        expect(aiRenamePreview).toContain('density="aiRenamePreview"');
        expect(aiRenamePreview).toContain('layout="aiRenamePreview"');
        expect(aiRenamePreview).toContain('"aiRenamePreviewError"');
        expect(aiRenamePreview).toContain('"aiRenamePreviewUnavailable"');
        expect(aiRenamePreview).toContain('data-slot="card-review-value"');
        expect(aiRenamePreview).toContain('data-review-tone="old"');
        expect(aiRenamePreview).toContain('data-review-tone="new"');
        expect(aiRenamePreview).toContain('data-slot="alert-icon"');
        expect(card).toContain("aiRenamePreview:");
        expect(button).toContain("aiRenamePreviewClose:");
        expect(button).toContain("aiRenamePreviewAction:");
        expect(button).toContain("aiRenamePreviewPrimaryAction:");
        expect(badge).toContain("aiRenamePreviewOldTag:");
        expect(badge).toContain("aiRenamePreviewNewTag:");
        expect(alert).toContain("aiRenamePreviewError:");
        expect(alert).toContain("aiRenamePreviewUnavailable:");
        expect(spinnerPrimitive).toContain("centeredBlock:");
        for (const retiredAiRenameToken of [
            'size="icon-xs"',
            'size="xs"',
            'variant="ghost"',
            'variant="outline"',
            'variant="secondary"',
            'variant="default"',
            'variant={state === "error" ? "destructive" : "default"}',
            'className="grid-cols-[1fr_auto] items-start gap-x-2 gap-y-1 border-b border-border px-4 py-3"',
            'className="flex min-h-20 flex-col px-4 py-4"',
            'className="mx-auto mb-1 size-4 animate-spin rounded-full border-2 border-border border-t-current"',
            'className="flex min-w-0 items-baseline gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-2"',
            'className="flex items-center gap-1.5 px-4 py-3"',
            "animate-spin rounded-full border-2 border-border border-t-current",
            'import { cn } from "@/lib/utils";',
        ]) {
            expect(aiRenamePreview).not.toContain(retiredAiRenameToken);
        }
        expect(aiRenamePreview).not.toContain("!bg-");
        expect(aiRenamePreview).not.toContain("!text-");
        expect(aiRenamePreview).not.toContain("!font-");
        expect(aiRenamePreview).not.toContain("!size-");
        expect(aiRenamePreview).not.toContain("![box-shadow:");
        expect(aiRenamePreview).not.toMatch(/\bAI_RENAME_[A-Z0-9_]+_CLASS\b/);
        expect(aiRenamePreview).not.toMatch(/--ai-rename-[\w-]+/);
        expect(aiRenamePreview).not.toMatch(
            /(^|[\s"'`])ai-rename-panel($|[\s"'`])/,
        );
        expect(aiRenamePreview).not.toMatch(
            /(^|[\s"'`])airp-[a-z0-9-]+($|[\s"'`])/i,
        );
        expect(aiRenamePreview).not.toContain("data-airp-");
        expect(aiRenamePreview).not.toContain("mergeAiRenameClassName");
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
        for (const compositionToken of MORE_ACTIONS_MENU_COMPOSITION_TOKENS) {
            expect(workstation).toContain(compositionToken);
        }
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
        const settingFieldControl = readSource(
            "features/settings/components/setting-field-control.tsx",
        );
        const settingsDialog = readSource(
            "features/settings/components/settings-dialog.tsx",
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
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const avatarPrimitive = readSource("components/ui/avatar.tsx");
        const button = readSource("components/ui/button.tsx");
        const cardPrimitive = readSource("components/ui/card.tsx");
        const badge = readSource("components/ui/badge.tsx");
        const emptyPrimitive = readSource("components/ui/empty.tsx");
        const fieldPrimitive = readSource("components/ui/field.tsx");
        const inputGroupPrimitive = readSource("components/ui/input-group.tsx");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const toggleGroupPrimitive = readSource(
            "components/ui/toggle-group.tsx",
        );
        const globals = readSource("app/globals.css");
        const settingsCloseButton = extractElementSlice(
            settingsDialog,
            'variant="settingsClose"',
            "Button",
        );
        const settingsNavButton = extractElementSlice(
            settingsDialog,
            'variant="settingsNav"',
            "Button",
        );

        expect(settings).toContain('data-sot-surface="settings-data-sources"');
        expect(settingsCloseButton).toContain(
            'data-sot-control="settings-close"',
        );
        expect(settingsCloseButton).toContain('variant="settingsClose"');
        expect(settingsCloseButton).toContain('size="settingsClose"');
        expect(settingsNavButton).toContain('data-sot-control="settings-nav"');
        expect(settingsNavButton).toContain('variant="settingsNav"');
        expect(settingsNavButton).toContain('size="settingsNav"');
        expect(button).toContain(
            'settingsNav:\n                    "cursor-pointer border border-transparent bg-transparent',
        );
        expect(button).toContain(
            "hover:bg-[var(--bg-recessed)]",
        );
        expect(button).toContain(
            "focus-visible:outline-[var(--accent)]",
        );
        expect(button).toContain(
            "data-[state=active]:bg-[var(--bg-elevated)]",
        );
        expect(button).toContain(
            "dark:data-[state=active]:bg-[rgb(255_255_255_/_0.07)]",
        );
        expect(button).toContain(
            "h-auto w-full min-w-0 justify-start gap-[10px] truncate",
        );
        expect(button).toContain(
            "[&_svg:not([class*='size-'])]:size-[14px]",
        );
        for (const selector of REMOVED_SETTINGS_NAV_GLOBAL_REPAINT_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of REMOVED_SETTINGS_DEAD_TENANT_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const settingsControlButton of [
            settingsCloseButton,
            settingsNavButton,
        ]) {
            expect(settingsControlButton).not.toContain('variant="ghost"');
            expect(settingsControlButton).not.toContain('size="icon-sm"');
            expect(settingsControlButton).not.toContain('size="sm"');
        }
        const detailBackButton = extractElementSlice(
            detail,
            'data-sot-control="recording-detail-back"',
            "Button",
        );
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
        expect(button).toContain("recordingDetailBack:");
        expect(detailBackButton).toContain('variant="recordingDetailBack"');
        expect(detailBackButton).toContain('size="recordingDetailBack"');
        expect(detailBackButton).toContain(
            'navigateBrowserRoute(router, "/dashboard")',
        );
        expect(detailBackButton).toContain('data-sot-state="selected"');
        expect(detailBackButton).toContain("<ArrowLeft");
        expect(detailBackButton).toContain('data-icon="inline-start"');
        expect(detailBackButton).toContain(
            '{t("recording.backToDashboard")}',
        );
        expect(detailBackButton).not.toContain('variant="ghost"');
        expect(button).toContain("[&_span]:truncate");
        expect(button).toContain("[&_svg]:stroke-[1.7]");
        expect(button).toContain("[&_svg]:opacity-[0.85]");
        expect(detail).toContain(
            'className="flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3"',
        );
        expect(detail).toContain(
            'className="px-2.5 pb-1.5 pt-3.5 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-tertiary)]"',
        );
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
        const settingsSourceAuthModeControl = extractElementSlice(
            settings,
            'data-sot-list="source-auth-modes"',
            "ToggleGroup",
        );
        expect(settingsSourceAuthModeControl).toContain(
            'layout="settingsSourceAuthMode"',
        );
        expect(settingsSourceAuthModeControl).toContain(
            'variant="settingsSourceAuthModeOption"',
        );
        expect(settingsSourceAuthModeControl).toContain(
            'size="settingsSourceAuthModeOption"',
        );
        expect(settingsSourceAuthModeControl).toContain(
            'spacing="settingsSourceAuthMode"',
        );
        expect(settingsSourceAuthModeControl).toContain(
            'variant="sourceAuthModeBadge"',
        );
        expect(settingsSourceAuthModeControl).not.toContain('variant="outline"');
        expect(settingsSourceAuthModeControl).not.toContain(
            'variant="secondary"',
        );
        expect(settingsSourceAuthModeControl).not.toContain('size="lg"');
        expect(settingsSourceAuthModeControl).not.toContain("spacing={2}");
        expect(settingsSourceAuthModeControl).not.toContain(
            'className="mb-4 grid w-full grid-cols-2 items-stretch"',
        );
        expect(settingsSourceAuthModeControl).not.toContain(
            'className="h-auto flex-col items-start justify-start whitespace-normal px-3.5 py-3 text-left"',
        );
        const settingsSourceActionStatus = extractElementSlice(
            settings,
            'data-sot-part="source-action-status"',
            "Badge",
        );
        expect(settingsSourceActionStatus).toContain(
            'variant="sourceActionStatus"',
        );
        expect(settingsSourceActionStatus).not.toContain('variant="secondary"');
        expect(settingsSourceActionStatus).not.toContain("className=");
        expect(settingsSourceActionStatus).toContain(
            'data-sot-part="source-action-status-indicator"',
        );
        const settingsRow =
            settings.match(
                /function SettingsRow[\s\S]*?function SelectControl/,
            )?.[0] ?? "";
        const settingsSegmentControl =
            settings.match(
                /function SegmentControl[\s\S]*?function SaveActions/,
            )?.[0] ?? "";
        const settingsSaveStatus = extractElementSlice(
            settings,
            'data-sot-part="settings-save-status"',
            "Badge",
        );
        const settingsSaveAction = extractElementSlice(
            settings,
            'data-sot-control="settings-save"',
            "Button",
        );
        const settingsVoScriptTestAction = extractElementSlice(
            settings,
            'data-sot-control="voscript-test"',
            "Button",
        );
        expect(settingsRow).toContain('variant="settingsRow"');
        expect(settingsRow).toContain('variant="settingsContent"');
        expect(settingsRow).toContain('variant="settingsControl"');
        expect(settingsRow).not.toContain("SETTINGS_FIELD_CLASS");
        expect(settingsRow).not.toContain("SETTINGS_FIELD_CONTENT_CLASS");
        expect(settingsRow).not.toContain("SETTINGS_CONTROL_CLASS");
        expect(settings).not.toContain("SETTINGS_FIELD_CLASS");
        expect(settingFieldControl).toContain('"settingsRow"');
        expect(settingFieldControl).toContain('"settingsContent"');
        expect(settingFieldControl).toContain('"settingsControl"');
        expect(settingFieldControl).not.toContain(
            '"border-b border-border py-3 last:border-b-0"',
        );
        expect(settingsSegmentControl).toContain('layout="settingsSegment"');
        expect(settingsSegmentControl).toContain(
            'variant="settingsSegmentOption"',
        );
        expect(settingsSegmentControl).toContain(
            'size="settingsSegmentOption"',
        );
        expect(settingsSegmentControl).toContain(
            'spacing="settingsSegmentSpacing"',
        );
        expect(settingsSegmentControl).not.toContain('variant="outline"');
        expect(settingsSegmentControl).not.toContain('size="sm"');
        expect(settingsSegmentControl).not.toContain("spacing={1}");
        expect(settingsSaveStatus).toContain('variant="settingsSaveStatus"');
        expect(settingsSaveStatus).not.toContain('variant="ghost"');
        expect(settingsSaveAction).toContain('variant="settingsSave"');
        expect(settingsSaveAction).toContain('size="settingsSave"');
        expect(settingsSaveAction).not.toContain('variant="default"');
        expect(settingsVoScriptTestAction).toContain(
            'variant="settingsTestAction"',
        );
        expect(settingsVoScriptTestAction).toContain(
            'size="settingsTestAction"',
        );
        expect(settingsVoScriptTestAction).not.toContain('variant="ghost"');
        expect(badge).toContain('data-slot="badge"');
        expect(badge).toContain("data-variant={variant}");
        expect(badge).toContain("settingsSaveStatus:");
        expect(badge).toContain(
            "[&_[data-sot-part=settings-save-status-indicator]]",
        );
        expect(badge).toContain("sourceAuthModeBadge:");
        expect(badge).toContain("sourceActionStatus:");
        expect(badge).toContain("data-[sot-tone=recommended]");
        expect(badge).toContain("data-[sot-tone=personal]");
        expect(badge).toContain(
            "[&_[data-sot-part=source-action-status-indicator]]",
        );
        expect(badge).not.toContain("source:");
        expect(badge).toContain("playerSource:");
        expect(badge).toContain("playerStatus:");
        for (const playerStatusToken of [
            "data-[sot-tone=ok]:border-[var(--source-provider-status-success-border)]",
            "data-[sot-tone=ok]:bg-[var(--source-provider-status-success-bg)]",
            "data-[sot-tone=ok]:text-[var(--signal-success)]",
            "data-[sot-tone=warn]:border-[var(--source-provider-status-warning-border)]",
            "data-[sot-tone=warn]:bg-[var(--source-provider-status-warning-bg)]",
            "data-[sot-tone=warn]:text-[var(--signal-warning-strong)]",
            "data-[sot-tone=err]:border-[var(--source-provider-status-danger-border)]",
            "data-[sot-tone=err]:bg-[var(--source-provider-status-danger-bg)]",
            "data-[sot-tone=err]:text-[var(--signal-danger)]",
            "data-[sot-tone=info]:border-[var(--source-provider-status-info-border)]",
            "data-[sot-tone=info]:bg-[var(--source-provider-status-info-bg)]",
            "data-[sot-tone=info]:text-[var(--signal-info)]",
            "data-[sot-tone=neu]:border-[var(--line-hairline)]",
            "data-[sot-tone=neu]:bg-[var(--bg-recessed)]",
            "data-[sot-tone=neu]:text-[var(--fg-secondary)]",
            "[&_[data-sot-part=status-dot]]:size-[5px]",
            "[&_[data-sot-part=status-dot]]:rounded-full",
            "[&_[data-sot-part=status-dot]]:bg-current",
            "data-[sot-tone=warn]:[&_[data-sot-part=status-dot]]:animate-[bpulse_1.4s_ease-in-out_infinite]",
            "[&_[data-sot-part=status-label]]:ml-[4px]",
        ]) {
            expect(badge).toContain(playerStatusToken);
        }
        expect(badge).toContain("playerTagChip:");
        expect(badge).toContain("playerTagOverflow:");
        expect(badge).not.toContain('"player-status":');
        expect(badge).toContain("sourceReportStatus:");
        expect(badge).toContain("transcriptionMeta:");
        expect(badge).toContain("data-[sot-tone=attribute]");
        expect(badge).toContain("data-[sot-tone=measure]");
        expect(badge).toContain("speakerReviewVoiceprint:");
        expect(badge).toContain("data-[sot-tone=ready]");
        expect(badge).toContain("data-[sot-tone=missing]");
        expect(badge).toContain("data-[sot-tone=selected]");
        expect(alertPrimitive).toContain("statusError:");
        expect(alertPrimitive).toContain("speakerReviewError:");
        for (const settingsAlertPrimitiveToken of [
            "settingsBanner:",
            "settingsBannerError:",
            "settingsLoadError:",
            "settingsVoScriptWarning:",
            "settingsBannerAction:",
        ]) {
            expect(alertPrimitive).toContain(settingsAlertPrimitiveToken);
        }
        expect(fieldPrimitive).toContain("settingsRowFieldClassName");
        expect(fieldPrimitive).toContain("settingsContent:");
        expect(fieldPrimitive).toContain("settingsControl:");
        expect(button).toContain("settingsSave:");
        expect(button).toContain("settingsTestAction:");
        expect(button).toContain("settingsSourceRetry:");
        expect(button).toContain("settingsSectionRetry:");
        expect(toggleGroupPrimitive).toContain("settingsSegment");
        expect(toggleGroupPrimitive).toContain("settingsSegmentOption:");
        expect(toggleGroupPrimitive).toContain("settingsSegmentSpacing");
        const settingsSourceStateAlert = extractOpeningElement(
            settings,
            'data-sot-banner="source-state"',
            "Alert",
        );
        const settingsSourceLoadErrorAlert = extractOpeningElement(
            settings,
            'data-sot-banner="source-load-error"',
            "Alert",
        );
        const settingsSectionLoadErrorAlert = extractOpeningElement(
            settings,
            'data-sot-banner="settings-section-load-error"',
            "Alert",
        );
        const settingsSourceLoadRetry = extractElementSlice(
            settings,
            'data-sot-control="source-load-retry"',
            "Button",
        );
        const settingsSectionLoadRetry = extractElementSlice(
            settings,
            'data-sot-control="settings-section-load-retry"',
            "Button",
        );
        const settingsVoScriptUnavailableAlert = extractOpeningElement(
            settings,
            'data-sot-banner="voscript-unavailable"',
            "Alert",
        );
        expect(settingsSourceStateAlert).toContain('density="settingsBanner"');
        expect(settingsSourceStateAlert).toContain('layout="settingsBanner"');
        expect(settingsSourceStateAlert).toContain('"settingsBannerError"');
        expect(settingsSourceStateAlert).toContain('"settingsBanner"');
        for (const settingsLoadErrorAlert of [
            settingsSourceLoadErrorAlert,
            settingsSectionLoadErrorAlert,
        ]) {
            expect(settingsLoadErrorAlert).toContain(
                'variant="settingsLoadError"',
            );
            expect(settingsLoadErrorAlert).toContain('density="settingsBanner"');
            expect(settingsLoadErrorAlert).toContain(
                'layout="settingsBannerAction"',
            );
        }
        expect(settingsSourceLoadRetry).toContain(
            'variant="settingsSourceRetry"',
        );
        expect(settingsSourceLoadRetry).toContain(
            'size="settingsSourceRetry"',
        );
        expect(settingsSourceLoadRetry).toContain(
            "onClick={() => void refreshSources()}",
        );
        expect(settingsSourceLoadRetry).not.toContain('variant="default"');
        expect(settingsSourceLoadRetry).not.toContain('size="sm"');
        expect(settingsSectionLoadRetry).toContain(
            'variant="settingsSectionRetry"',
        );
        expect(settingsSectionLoadRetry).toContain(
            'size="settingsSectionRetry"',
        );
        expect(settingsSectionLoadRetry).toContain("onClick={onRetry}");
        expect(settingsSectionLoadRetry).toContain(
            "data-sot-section={section}",
        );
        expect(settingsSectionLoadRetry).not.toContain('variant="default"');
        expect(settingsSectionLoadRetry).not.toContain('size="sm"');
        expect(settingsVoScriptUnavailableAlert).toContain(
            'variant="settingsVoScriptWarning"',
        );
        expect(settingsVoScriptUnavailableAlert).toContain(
            'density="settingsBanner"',
        );
        expect(settingsVoScriptUnavailableAlert).toContain(
            'layout="settingsBanner"',
        );
        for (const settingsBannerAlert of [
            settingsSourceStateAlert,
            settingsSourceLoadErrorAlert,
            settingsSectionLoadErrorAlert,
            settingsVoScriptUnavailableAlert,
        ]) {
            expect(settingsBannerAlert).not.toContain(
                "getSettingsBannerClassName",
            );
            expect(settingsBannerAlert).not.toContain('variant="destructive"');
            expect(settingsBannerAlert).not.toContain("grid-cols-[auto_1fr");
            expect(settingsBannerAlert).not.toContain(
                "border-destructive/30 bg-destructive/10",
            );
        }
        for (const speakerReviewButtonVariant of [
            "speakerReviewAction",
            "speakerReviewPrimaryAction",
            "speakerReviewGhostAction",
            "speakerReviewDangerAction",
            "speakerReviewSuggestion",
            "speakerReviewIconAction",
        ]) {
            expect(button).toContain(`${speakerReviewButtonVariant}:`);
        }
        expect(button).toContain("speakerReviewIcon:");
        for (const speakerReviewCardVariant of [
            "speakerReviewTranscript",
            "speakerReviewRow",
            "speakerReviewMergePopover",
            "speakerReviewConfirm",
            "speakerReviewTitle",
            "speakerReviewMergeTitle",
            "speakerReviewDescription",
            "speakerReviewActions",
        ]) {
            expect(cardPrimitive).toContain(`${speakerReviewCardVariant}:`);
        }
        expect(toggleGroupPrimitive).toContain("speakerReviewMode:");
        expect(toggleGroupPrimitive).toContain("speakerReviewModeItem:");
        expect(inputGroupPrimitive).toContain("speakerReviewMappingClear:");
        for (const speakerReviewEmptyVariant of [
            "speakerReviewMerge",
            "speakerReviewDetected",
            "speakerReviewInline",
            "speakerReviewState",
            "speakerReviewMergeIcon",
        ]) {
            expect(emptyPrimitive).toContain(`${speakerReviewEmptyVariant}:`);
        }
        expect(badge).toContain("h-[22px]");
        const providerPrimitiveRepaintSelectors = [
            '[data-sot-provider-card][data-slot="button"]',
            '[data-sot-provider-status][data-slot="badge"]',
        ];
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
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
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
        for (const selector of SOURCE_AUTH_MODE_REMOVED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }

        expect(speakerReview).toContain('data-sot-panel="speaker-review"');
        expect(speakerReview).toContain("data-sot-state=");
        expect(speakerReview).toContain("<CardHeader");
        expect(speakerReview).toContain("<ToggleGroup");
        expect(speakerReview).toContain("<Badge");
        expect(speakerReview).toContain("<Alert");
        expect(speakerReview).toContain('from "@/components/ui/input-group";');
        expect(speakerReview).toContain('from "@/components/ui/empty";');
        expect(speakerReview).toContain('from "@/components/ui/field";');
        for (const primitive of [
            "InputGroup,",
            "InputGroupAddon,",
            "InputGroupButton,",
            "InputGroupInput,",
            "Empty,",
            "EmptyDescription,",
            "EmptyHeader,",
            "EmptyMedia,",
            "EmptyTitle,",
            "<Field",
            "<FieldContent>",
            "<FieldLabel",
        ]) {
            expect(speakerReview).toContain(primitive);
        }
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
        const speakerReviewModeToggle = extractElementSlice(
            speakerReview,
            'data-sot-control="speaker-review-mode"',
            "ToggleGroup",
        );
        expect(speakerReviewModeToggle).toContain(
            'variant="speakerReviewMode"',
        );
        expect(speakerReviewModeToggle).toContain(
            'size="speakerReviewModeItem"',
        );
        expect(speakerReviewModeToggle).toContain(
            'layout="speakerReviewMode"',
        );
        expect(speakerReviewModeToggle).toContain(
            'spacing="speakerReviewMode"',
        );
        expect(speakerReviewModeToggle).not.toContain('size="sm"');
        expect(speakerReviewModeToggle).not.toContain("spacing={1}");
        expect(speakerReviewModeToggle).not.toContain(
            'className="flex-nowrap"',
        );
        const speakerReviewModeOptions = collectOpeningElements(
            speakerReview,
            "ToggleGroupItem",
        ).filter((opening) =>
            opening.includes(
                'data-sot-control="speaker-review-mode-option"',
            ),
        );
        expect(speakerReviewModeOptions).toHaveLength(2);
        for (const opening of speakerReviewModeOptions) {
            expect(opening).not.toContain('className="px-2.5"');
        }
        const speakerReviewMappingInputIndex = speakerReview.indexOf(
            'data-sot-control="speaker-review-mapping-input"',
        );
        expect(speakerReviewMappingInputIndex).toBeGreaterThan(-1);
        const speakerReviewMappingInput = speakerReview.slice(
            speakerReviewMappingInputIndex - 520,
            speakerReviewMappingInputIndex + 7_000,
        );
        expect(speakerReviewMappingInput).toContain("<InputGroup");
        expect(speakerReviewMappingInput).toContain("<InputGroupInput");
        expect(speakerReviewMappingInput).toContain("<InputGroupAddon");
        expect(speakerReviewMappingInput).toContain("<InputGroupButton");
        expect(speakerReviewMappingInput).toContain(
            'data-sot-control="speaker-review-mapping-clear"',
        );
        const speakerReviewMappingClear = collectOpeningElements(
            speakerReview,
            "InputGroupButton",
        ).find((opening) =>
            opening.includes(
                'data-sot-control="speaker-review-mapping-clear"',
            ),
        );
        expect(speakerReviewMappingClear).toBeDefined();
        expect(speakerReviewMappingClear).toContain(
            'size="speakerReviewMappingClear"',
        );
        expect(speakerReviewMappingClear).toContain(
            'variant="speakerReviewMappingClear"',
        );
        expect(speakerReviewMappingClear).not.toContain('size="icon-xs"');
        expect(speakerReviewMappingClear).not.toContain('variant="ghost"');
        expect(speakerReviewMappingInput).toContain("aria-busy={");
        expect(speakerReviewMappingInput).toContain("onFocus={() =>");
        expect(speakerReviewMappingInput).toContain("onBlur={() =>");
        expect(speakerReviewMappingInput).toContain("onChange={(event) =>");
        const speakerReviewInlineRenameInput = speakerReview.slice(
            speakerReview.indexOf(
                'data-sot-control="speaker-review-inline-name"',
            ) - 1_200,
            speakerReview.indexOf(
                'data-sot-control="speaker-review-inline-name"',
            ) + 3_200,
        );
        expect(speakerReviewInlineRenameInput).toContain("<Field");
        expect(speakerReviewInlineRenameInput).toContain("<FieldContent>");
        expect(speakerReviewInlineRenameInput).toContain("<Input");
        expect(speakerReviewInlineRenameInput).toContain("data-spk-input");
        expect(speakerReviewInlineRenameInput).toContain("autoFocus");
        expect(speakerReviewInlineRenameInput).toContain("aria-busy={");
        const speakerReviewMergeEmpty = extractElementSlice(
            speakerReview,
            'data-sot-part="speaker-review-merge-empty"',
            "Empty",
        );
        expect(speakerReviewMergeEmpty).toMatch(
            /<Empty\s+variant="speakerReviewMerge"[\s\S]*?data-sot-part="speaker-review-merge-empty"/,
        );
        expect(speakerReviewMergeEmpty).toContain(
            '<EmptyHeader variant="speakerReviewMerge">',
        );
        expect(speakerReviewMergeEmpty).toContain("<EmptyMedia");
        expect(speakerReviewMergeEmpty).toContain(
            'variant="speakerReviewMergeIcon"',
        );
        expect(speakerReviewMergeEmpty).toContain(
            "<Check strokeWidth={1.8} />",
        );
        expect(speakerReviewMergeEmpty).toMatch(
            /<EmptyTitle\s+variant="speakerReviewMerge"\s+data-sot-part="speaker-review-merge-empty-title"\s*>/,
        );
        expect(speakerReviewMergeEmpty).toMatch(
            /<EmptyDescription\s+variant="speakerReviewMerge"\s+data-sot-part="speaker-review-merge-empty-description"\s*>/,
        );
        const speakerReviewNoSamplesEmpty = extractElementSlice(
            speakerReview,
            'data-sot-state="no-samples"',
            "Empty",
        );
        expect(speakerReviewNoSamplesEmpty).toContain(
            'data-sot-part="speaker-review-empty"',
        );
        expect(speakerReviewNoSamplesEmpty).toContain(
            'variant="speakerReviewInline"',
        );
        expect(speakerReviewNoSamplesEmpty).toContain(
            '<EmptyHeader variant="speakerReviewState">',
        );
        expect(speakerReviewNoSamplesEmpty).toContain(
            '<EmptyTitle variant="speakerReviewState">',
        );
        for (const state of [
            "no-detected-speakers",
            "no-saved-speakers",
            "no-matching-speakers",
        ]) {
            const emptyState = extractElementSlice(
                speakerReview,
                `data-sot-state="${state}"`,
                "Empty",
            );
            expect(emptyState).toContain(
                state === "no-detected-speakers"
                    ? 'variant="speakerReviewDetected"'
                    : 'variant="speakerReviewInline"',
            );
            expect(emptyState).toContain(
                '<EmptyHeader variant="speakerReviewState">',
            );
            expect(emptyState).toContain(
                '<EmptyTitle variant="speakerReviewState">',
            );
        }
        for (const selector of [
            '[data-sot-control="speaker-review-inline-name"][data-slot="input"]',
            '[data-sot-control="speaker-review-mapping-input"][data-slot="input"]',
            '[data-sot-panel="speaker-review"] [data-slot="card"]',
            '[data-sot-control="speaker-review-mode"]',
            '[data-sot-control="speaker-review-mode-option"]',
            '[data-sot-panel="speaker-review-merge"][data-slot="card"]',
            '[data-sot-part="speaker-review-merge-empty"]',
            '[data-sot-part="speaker-review-merge-empty-icon"]',
            '[data-sot-part="speaker-review-merge-empty-title"]',
            '[data-sot-part="speaker-review-merge-empty-description"]',
            '[data-sot-control="speaker-review-suggestion"]',
            '[data-sot-part="speaker-review-empty"]',
            '[data-sot-part="speaker-review-voiceprint-pill"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
        expect(speakerReview).toContain(
            'data-sot-control="speaker-review-suggestion"',
        );
        const speakerReviewButtonOpenings = collectOpeningElements(
            speakerReview,
            "Button",
        ).filter(
            (opening) =>
                opening.includes("speaker-review") ||
                opening.includes("data-sot-confirm-action") ||
                opening.includes("data-spk-merge-close"),
        );
        expect(speakerReviewButtonOpenings.length).toBeGreaterThan(0);
        for (const opening of speakerReviewButtonOpenings) {
            expect(opening).not.toContain('variant="ghost"');
            expect(opening).not.toContain('variant="default"');
            expect(opening).not.toContain('variant="destructive"');
            expect(opening).not.toContain('variant="outline"');
            expect(opening).not.toContain('size="sm"');
        }
        expect(speakerReview).toContain('variant="speakerReviewSuggestion"');
        expect(speakerReview).toContain('size="speakerReviewSuggestion"');
        expect(speakerReview).toContain(
            'variant="speakerReviewPrimaryAction"',
        );
        expect(speakerReview).toContain('variant="speakerReviewGhostAction"');
        expect(speakerReview).toContain('variant="speakerReviewDangerAction"');
        expect(speakerReview).toContain('size="speakerReviewAction"');
        const speakerReviewCardOpenings = collectOpeningElements(
            speakerReview,
            "Card",
        ).filter((opening) => /speaker-review|speaker-unlink/.test(opening));
        for (const opening of speakerReviewCardOpenings) {
            expect(opening).not.toContain('variant="elevated"');
            expect(opening).not.toContain('variant="popover"');
        }
        expect(speakerReview).toContain('variant="speakerReviewTranscript"');
        expect(speakerReview).toContain('variant="speakerReviewRow"');
        expect(speakerReview).toContain(
            'variant="speakerReviewMergePopover"',
        );
        expect(cardPrimitive).toContain(
            SPEAKER_REVIEW_MERGE_POPOVER_PLACEMENT,
        );
        expect(speakerReview).not.toContain(
            `className="${SPEAKER_REVIEW_MERGE_POPOVER_PLACEMENT}"`,
        );
        const speakerReviewMergeAnchor = collectOpeningElements(
            speakerReview,
            "div",
        ).find((opening) =>
            opening.includes(
                'data-sot-part="speaker-review-merge-anchor"',
            ),
        );
        expect(speakerReviewMergeAnchor).toContain(
            'className="relative inline-flex"',
        );
        expect(speakerReview).toContain('variant="speakerReviewConfirm"');
        for (const opening of collectOpeningElements(
            speakerReview,
            "Alert",
        ).filter((element) =>
            element.includes('data-sot-part="speaker-review-state"'),
        )) {
            expect(opening).toContain('variant="speakerReviewError"');
            expect(opening).toContain('density="speakerReviewError"');
            expect(opening).toContain('layout="speakerReviewError"');
            expect(opening).not.toContain('variant="destructive"');
        }
        const speakerReviewBadgeOpenings = collectOpeningElements(
            speakerReview,
            "Badge",
        ).filter((opening) =>
            opening.includes('data-sot-part="speaker-review-voiceprint-pill"'),
        );
        expect(speakerReviewBadgeOpenings.length).toBeGreaterThan(0);
        for (const opening of speakerReviewBadgeOpenings) {
            expect(opening).toContain('variant="speakerReviewVoiceprint"');
            expect(opening).not.toContain('variant="outline"');
        }
        expect(speakerReview).toContain("hidden={!isMergePopoverOpen}");
        expect(speakerReview).toContain(
            "data-open={String(isMergePopoverOpen)}",
        );
        expect(speakerReview).not.toContain(
            'className="grid items-center gap-[10px] overflow-visible p-[10px_12px]"',
        );
        expect(speakerReview).not.toContain(
            'className="grid h-auto min-h-8 w-full grid-cols-[minmax(0,1fr)_auto] justify-stretch px-2 py-1.5 text-left"',
        );
        expect(speakerReview).not.toContain(
            'className="h-auto min-h-8 w-full justify-start px-2 py-1.5"',
        );
        for (const retiredSpeakerReviewSliceToken of [
            'size="sm"',
            "spacing={1}",
            'className="flex-nowrap"',
            'className="px-2.5"',
            'size="icon-xs"',
            'variant="ghost"',
            'variant="compact"',
            'variant="subtleIcon"',
            'className="max-w-none gap-0"',
            'className="py-6"',
            'className="py-4 md:p-4"',
        ]) {
            expect(speakerReview).not.toContain(
                retiredSpeakerReviewSliceToken,
            );
        }
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
        expect(transcriptionSection).toContain('from "@/components/ui/empty";');
        for (const primitive of [
            "Empty,",
            "EmptyContent,",
            "EmptyDescription,",
            "EmptyHeader,",
            "EmptyMedia,",
            "EmptyTitle,",
        ]) {
            expect(transcriptionSection).toContain(primitive);
        }
        const transcriptionEmpty = extractElementSlice(
            transcriptionSection,
            'data-sot-part="recording-transcription-empty"',
            "Empty",
        );
        expect(transcriptionEmpty).toContain("<Empty");
        expect(transcriptionEmpty).toContain(
            'data-sot-part="recording-transcription-empty"',
        );
        expect(transcriptionEmpty).toContain('data-sot-state="empty"');
        expect(transcriptionEmpty).toContain('className="mt-4"');
        expect(transcriptionEmpty).toContain("<EmptyHeader>");
        expect(transcriptionEmpty).toContain("<EmptyMedia");
        expect(transcriptionEmpty).toContain('variant="icon"');
        expect(transcriptionEmpty).toContain("<FileText");
        expect(transcriptionEmpty).toContain(
            'data-sot-part="recording-transcription-empty-icon"',
        );
        expect(transcriptionEmpty).toContain(
            '<EmptyTitle data-sot-part="recording-transcription-empty-title">',
        );
        expect(transcriptionEmpty).toContain(
            '<EmptyDescription data-sot-part="recording-transcription-empty-description">',
        );
        expect(transcriptionEmpty).toContain("<EmptyContent>");
        expect(transcriptionEmpty).toContain("<Button");
        expect(transcriptionEmpty).toContain(
            'data-sot-control="start-local-transcription"',
        );
        expect(transcriptionEmpty).toContain("handleTranscribe(false)");
        expect(transcriptionEmpty).toContain("transcribeUnavailableReason ??");
        expect(transcriptionEmpty).not.toContain("<section");
        expect(transcriptionEmpty).not.toContain("<h3");
        expect(transcriptionEmpty).not.toContain("<p");
        expect(transcriptionSection).toContain(
            'data-sot-control="copy-local-transcript"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-control="retranscribe-local"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-control="start-local-transcription"',
        );
        const transcriptionJobErrorAlert = extractOpeningElement(
            transcriptionSection,
            'data-sot-state="error"',
            "Alert",
        );
        expect(transcriptionJobErrorAlert).toContain('variant="statusError"');
        expect(transcriptionJobErrorAlert).not.toContain(
            'variant="destructive"',
        );
        const transcriptionActionExpectations = [
            {
                control: 'data-sot-control="copy-local-transcript"',
                variant: 'variant="transcriptionAction"',
            },
            {
                control: 'data-sot-control="retranscribe-local"',
                variant: 'variant="transcriptionDangerAction"',
            },
            {
                control: 'data-sot-control="start-local-transcription"',
                variant: 'variant="transcriptionPrimaryAction"',
            },
        ];
        for (const { control, variant } of transcriptionActionExpectations) {
            const actionOpening = extractOpeningElement(
                transcriptionSection,
                control,
                "Button",
            );
            expect(actionOpening).toContain(variant);
            expect(actionOpening).toContain('size="transcriptionAction"');
            for (const genericActionToken of [
                'variant="outline"',
                'variant="destructive"',
                'variant="default"',
                'size="sm"',
            ]) {
                expect(actionOpening).not.toContain(genericActionToken);
            }
        }
        for (const { meta, tone } of [
            { meta: "language", tone: "attribute" },
            { meta: "source", tone: "attribute" },
            { meta: "words", tone: "measure" },
            { meta: "characters", tone: "measure" },
        ]) {
            const metaOpening = extractOpeningElement(
                transcriptionSection,
                `data-sot-meta="${meta}"`,
                "Badge",
            );
            expect(metaOpening).toContain('variant="transcriptionMeta"');
            expect(metaOpening).toContain(`data-sot-tone="${tone}"`);
            expect(metaOpening).not.toContain('variant="outline"');
            expect(metaOpening).not.toContain('variant="secondary"');
        }
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
        for (const selector of RECORDING_TRANSCRIPTION_EMPTY_REPAINT_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
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
        expect(transcriptionSkeletons).toContain(
            'variant="recordingTranscription"',
        );
        expect(transcriptionSkeletons).toContain(
            "size={transcriptionPlaceholderSizes[size]}",
        );
        expect(skeletonPrimitive).toContain("recordingTranscription:");
        expect(skeletonPrimitive).toContain(
            "recordingTranscriptionAction:",
        );
        expect(skeletonPrimitive).toContain(
            "recordingTranscriptionDescription:",
        );
        expect(skeletonPrimitive).toContain(
            "recordingTranscriptionLineLong:",
        );
        expect(transcriptionSkeletons).toContain(
            "const transcriptionPlaceholderSizes",
        );
        expect(transcriptionSkeletons).not.toContain(
            "type SkeletonLineSize",
        );
        expect(transcriptionSkeletons).not.toContain(
            "const skeletonLineClassNames",
        );
        expect(transcriptionSkeletons).not.toContain(
            "className={skeletonLineClassNames[size]}",
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
        expect(skeletonPrimitive).toContain(
            '"animate-pulse rounded-md bg-accent"',
        );
        expect(skeletonPrimitive).not.toContain("data-sot");
        expect(globals).not.toContain('[data-slot="skeleton"]');
        expect(globals).not.toContain("skshimmer");
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
        expect(listPanel).toContain(
            'className="flex flex-col gap-0.5 p-1"',
        );
        expect(listPanel).toContain(
            "grid w-full cursor-pointer grid-cols-[1fr_auto]",
        );
        expect(listPanel).toContain(
            "data-[sot-state=selected]:border-primary/40",
        );
        expect(listPanel).toContain(
            'className="flex min-w-0 flex-col gap-[5px]"',
        );
        expect(listPanel).toContain(
            'className="truncate font-sans text-[13.5px] font-semibold tracking-normal text-[var(--fg-primary)]"',
        );
        expect(listPanel).toContain(
            'className="flex flex-wrap items-center gap-2"',
        );
        expect(listPanel).toContain(
            'className="font-mono text-[11.5px] font-medium tracking-[0.02em] text-[var(--fg-secondary)]"',
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
        expect(detailHeader).toContain('variant="detailHeader"');
        expect(detailHeader).toContain('variant="detailHeaderTitle"');
        expect(detailHeader).toContain('variant="detailHeaderLocal"');
        expect(detailHeader).toContain('variant="detailHeaderStatus"');
        expect(detailHeader).toContain('variant="detailHeaderIconAction"');
        expect(detailHeader).toContain('size="detailHeaderIconAction"');
        expect(detailHeader).toContain('variant="detailHeaderAction"');
        expect(detailHeader).toContain('size="detailHeaderAction"');
        expect(detailHeader).toContain('controlSize="detailHeaderTitle"');
        expect(detailHeader).not.toContain('variant="ghost"');
        expect(detailHeader).not.toContain('variant="outline"');
        expect(detailHeader).not.toContain('size="icon-sm"');
        expect(detailHeader).not.toContain('size="sm"');
        expect(detail).toContain(
            "const recordingDetailHeaderState = isSavingRename",
        );
        expect(detailHeader).not.toContain(
            '"relative flex flex-row items-center gap-2.5 px-1 pt-1 pb-0"',
        );
        expect(detailHeader).not.toContain(
            'className="min-w-0 flex-1 truncate"',
        );
        expect(detailHeader).not.toContain('className="h-8 min-w-0 flex-1"');
        expect(detailHeader).not.toContain('className="ml-1 shrink-0"');
        expect(detailHeader).toContain(
            'recordingDetailHeaderState === "normal"',
        );
        expect(detailHeader).toContain(
            'recordingDetailHeaderState === "editing"',
        );
        expect(detailHeader).toContain(
            'recordingDetailHeaderState === "saving"',
        );
        expect(detailHeader).toContain('data-sot-state="saving"');
        expect(detailHeader).toContain("localDeleteAvailable ? (");
        expect(detailHeader).not.toMatch(legacyDetailHeaderClassNamePattern);
        expect(globals).not.toContain(
            '[data-sot-panel="recording-detail-header"]',
        );
        for (const selector of [
            '[data-sot-part="detail-header-title-input"][data-slot="input"]',
            '[data-sot-part="detail-header-title-status"]',
            '[data-sot-part="detail-header-local-badge"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
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
                Math.max(0, markerIndex - 520),
                markerIndex + 1200,
            );

            expect(copyButtonSource).toContain("<Button");
            expect(copyButtonSource).toContain(
                'variant="sourceRecordCopyAction"',
            );
            expect(copyButtonSource).toContain('size="sourceRecordCopyAction"');
            expect(copyButtonSource).not.toContain('variant="outline"');
            expect(copyButtonSource).not.toContain('size="sm"');
            expect(copyButtonSource).toContain(
                '<Copy data-icon="inline-start" />',
            );
        }
        expect(detail).toContain(
            'data-sot-panel="recording-source-record-empty"',
        );
        expect(detail).toContain('from "@/components/ui/empty";');
        for (const primitive of [
            "Empty,",
            "EmptyContent,",
            "EmptyDescription,",
            "EmptyHeader,",
            "EmptyMedia,",
            "EmptyTitle,",
        ]) {
            expect(detail).toContain(primitive);
        }
        const sourceRecordEmpty = extractElementSlice(
            detail,
            'data-sot-panel="recording-source-record-empty"',
            "Empty",
        );
        expect(sourceRecordEmpty).toContain("<Empty");
        expect(sourceRecordEmpty).toContain(
            'data-sot-panel="recording-source-record-empty"',
        );
        expect(sourceRecordEmpty).toContain("<EmptyHeader>");
        expect(sourceRecordEmpty).toContain("<EmptyMedia");
        expect(sourceRecordEmpty).toContain('variant="icon"');
        expect(sourceRecordEmpty).toContain("<FileText />");
        expect(sourceRecordEmpty).toContain(
            '<EmptyTitle data-sot-part="recording-source-record-empty-title">',
        );
        expect(sourceRecordEmpty).toContain(
            '<EmptyDescription data-sot-part="recording-source-record-empty-description">',
        );
        expect(sourceRecordEmpty).toContain(
            '<EmptyContent data-sot-part="recording-source-record-empty-content">',
        );
        expect(sourceRecordEmpty).not.toContain("<div");
        expect(globals).not.toContain(
            '[data-sot-panel="recording-source-record-empty"]',
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
            '[data-sot-part="recording-source-record-actions"]',
            '[data-sot-part="recording-source-record-tabs"]',
            '[data-sot-part="recording-source-record-hint"]',
        ]) {
            expect(globals).toContain(selector);
        }
        for (const selector of RECORDING_DETAIL_NAV_AND_ROW_REMOVED_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
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
        for (const compositionToken of MORE_ACTIONS_MENU_COMPOSITION_TOKENS) {
            expect(detail).toContain(compositionToken);
        }
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
        const playerNoAudioAlert = extractOpeningElement(
            player,
            'data-sot-part="recording-player-no-audio"',
            "Alert",
        );
        const playerNoAudioTitle = extractOpeningElement(
            player,
            'data-sot-part="recording-player-no-audio-title"',
            "AlertTitle",
        );
        const playerNoAudioDescription = extractOpeningElement(
            player,
            'data-sot-part="recording-player-no-audio-description"',
            "AlertDescription",
        );
        const playerBackControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-back"',
            "Button",
        );
        const playerPlayControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-play"',
            "Button",
        );
        const playerForwardControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-forward"',
            "Button",
        );
        const playerSpeedControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-speed"',
            "Button",
        );
        const playerVolumeControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-volume"',
            "Button",
        );
        const playerVolumeMuteControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-volume-mute"',
            "Button",
        );
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
        for (const control of [playerBackControl, playerForwardControl]) {
            expect(control).toContain('variant="playerControl"');
            expect(control).toContain('size="playerControl"');
            expect(control).not.toContain("className=");
        }
        expect(playerPlayControl).toContain('variant="playerPrimary"');
        expect(playerPlayControl).toContain('size="playerControlLg"');
        expect(playerPlayControl).not.toContain("className=");
        expect(playerSpeedControl).toContain('variant="playerSpeed"');
        expect(playerSpeedControl).toContain('size="playerSpeed"');
        expect(playerSpeedControl).not.toContain("className=");
        for (const control of [playerVolumeControl, playerVolumeMuteControl]) {
            expect(control).toContain('variant="playerControl"');
            expect(control).toContain('size="playerControlSm"');
            expect(control).not.toContain("className=");
        }
        for (const legacyControlToken of [
            'variant="outline"',
            'variant="default"',
            'variant="ghost"',
            'size="icon"',
            'size="icon-sm"',
            'size="icon-lg"',
            'size="sm"',
            'size="icon-xs"',
            'className="size-11 shrink rounded-full shadow-sm"',
            'className="shrink rounded-full"',
        ]) {
            expect(player).not.toContain(legacyControlToken);
        }
        expect(player).toContain('data-sot-part="recording-player-no-audio"');
        expect(alertPrimitive).toContain("playerNoAudio:");
        expect(playerNoAudioAlert).toContain('variant="playerNoAudio"');
        expect(playerNoAudioAlert).toContain('density="playerNoAudio"');
        expect(playerNoAudioAlert).toContain('layout="playerNoAudio"');
        expect(playerNoAudioAlert).not.toContain("className=");
        expect(alertPrimitive).toContain("data-player-no-audio-text");
        expect(alertPrimitive).not.toContain(
            "dashboard-recording-player-no-audio-text",
        );
        expect(alertPrimitive).not.toContain("recording-player-no-audio-text");
        expect(player).toContain("<SotPlayerNoAudioIcon");
        expect(player).not.toContain(
            '<SotPlayerNoAudioIcon className="size-3.5" />',
        );
        expect(playerNoAudioTitle).toContain('density="playerNoAudio"');
        expect(playerNoAudioDescription).toContain('density="playerNoAudio"');
        expect(player).toContain('data-sot-part="recording-player-meta"');
        expect(player).toContain('data-sot-panel="recording-player-controls"');
        expect(player).toContain(
            'data-sot-panel="recording-player-volume-popover"',
        );
        expect(button).toContain("data-player-control-icon");
        expect(button).not.toContain("dashboard-player-volume-icon");
        expect(button).not.toContain("recording-player-volume-icon");
        expect(player).toContain("data-player-control-icon");
        expect(player).toContain('variant="playerVolume"');
        expect(player).not.toContain(
            'className="w-[200px] min-w-[200px] gap-0 overflow-visible px-2.5 py-2"',
        );
        expect(player).toContain("<Popover");
        expect(player).toContain("<PopoverTrigger asChild>");
        expect(player).toContain("<PopoverContent");
        expect(player).toContain('side="top"');
        expect(player).toContain('align="end"');
        expect(player).toContain(
            'data-sot-control="recording-player-volume-slider"',
        );
        expect(player).toContain('variant="playerSeek"');
        for (const hook of RECORDING_PLAYER_BUTTON_CONTROL_HOOKS) {
            expect(player).toContain(`data-sot-control="${hook}"`);
        }
        for (const selector of RECORDING_PLAYER_CARD_PRIMITIVE_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of PLAYER_ALERT_CARD_BADGE_PRIMITIVE_REPAINT_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(
            collectCssRuleBlocks(globals, '[data-sot-control="player-status"]'),
        ).toEqual([]);
        for (const [
            surface,
            selector,
        ] of PLAYER_PORTAL_VOLUME_SCOPED_SELECTORS) {
            expect(
                collectCssRuleBlocks(globals, selector).filter(({ prelude }) =>
                    prelude.includes(surface),
                ),
            ).toEqual([]);
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
        const tagManagerToggleNote = extractElementSlice(
            tagManager,
            'data-sot-part="toggle-note"',
            "CardDescription",
        );
        expect(tagManagerToggleNote).toContain(
            'variant="recordingTagToggleNote"',
        );
        expect(tagManagerToggleNote).toContain('data-sot-part="toggle-note"');
        expect(tagManagerToggleNote).not.toContain('className="sr-only"');
        for (const anchor of [
            'data-open="true"',
            'data-state={visibleError ? "error" : undefined}',
            "data-sot-state={panelState}",
            "data-sot-toggle-state={",
            'data-sot-create-state={isCreating ? "saving" : "idle"}',
            'data-sot-control="recording-tag-manager-close"',
            'data-sot-control="recording-tag-error-retry"',
            'data-sot-control="recording-tag-delete-open"',
            'data-sot-control="recording-tag-delete-confirm"',
            'data-sot-control="recording-tag-create-cancel"',
            'data-sot-part="create-field"',
            'data-sot-part="picker-frame"',
            'data-sot-part="tag-loading-icon"',
            'data-sot-part="tag-check"',
            'data-sot-state={saving ? "saving" : selected ? "selected" : "idle"}',
            'data-sot-state={color === item ? "selected" : "idle"}',
            'data-sot-state={icon === item ? "selected" : "idle"}',
            'data-sot-state={\n                        deletingTagId === deleteTarget.id ? "saving" : "ready"',
            "SOT_TAG_MANAGER_ERROR_TEXT",
            "renderErrorAlert",
            "setDeleteTarget(catalogTag)",
        ]) {
            expect(tagManager).toContain(anchor);
        }
        expect(tagManager).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(tagManager).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(tagManager).toContain('from "@/components/ui/alert";');
        expect(tagManager).toContain('from "@/components/ui/card";');
        expect(tagManager).toContain('from "@/components/ui/empty";');
        expect(tagManager).toContain('from "@/components/ui/field";');
        expect(tagManager).toContain('from "@/components/ui/input-group";');
        expect(tagManager).toContain('from "@/components/ui/spinner";');
        expect(tagManager).toContain('from "@/components/ui/toggle-group";');
        expect(tagManager).toContain("<Card");
        expect(tagManager).toContain("<CardDescription");
        expect(tagManager).toContain("<CardHeader");
        expect(tagManager).toContain("<CardContent");
        expect(tagManager).toContain("<CardFooter");
        expect(tagManager).toContain("<Alert");
        expect(tagManager).toContain("<Empty");
        expect(tagManager).toContain("<EmptyHeader");
        expect(tagManager).toContain("<EmptyTitle");
        expect(tagManager).toContain("<EmptyDescription");
        expect(tagManager).toContain("<Badge");
        expect(tagManager).toContain("<Button");
        expect(tagManager).toContain("<Field");
        expect(tagManager).toContain("<FieldGroup");
        expect(tagManager).toContain("<FieldSet");
        expect(tagManager).toContain("<FieldLegend");
        expect(tagManager).toContain("<InputGroup");
        expect(tagManager).toContain("<InputGroupInput");
        expect(tagManager).not.toContain("<InputGroupButton");
        expect(tagManager).toContain("<ToggleGroup");
        expect(tagManager).toContain("<ToggleGroupItem");
        const tagManagerColorPicker = extractElementSlice(
            tagManager,
            'data-sot-part="color-swatches"',
            "ToggleGroup",
        );
        const tagManagerIconPicker = extractElementSlice(
            tagManager,
            'data-sot-part="icon-grid"',
            "ToggleGroup",
        );
        expect(tagManagerColorPicker).toContain(
            'variant="recordingTagColorPicker"',
        );
        expect(tagManagerColorPicker).toContain(
            'size="recordingTagColorPicker"',
        );
        expect(tagManagerColorPicker).toContain(
            'layout="recordingTagColorPicker"',
        );
        expect(tagManagerColorPicker).toContain(
            '"recordingTagQuickColorPicker"',
        );
        expect(tagManagerColorPicker).toContain('"recordingTagColorPicker"');
        expect(tagManagerColorPicker).toContain('variant="swatch"');
        expect(tagManagerColorPicker).toContain('size="swatch"');
        expect(tagManagerColorPicker).not.toContain('variant="outline"');
        expect(tagManagerIconPicker).toContain(
            'variant="recordingTagIconPicker"',
        );
        expect(tagManagerIconPicker).toContain(
            'size="recordingTagIconPicker"',
        );
        expect(tagManagerIconPicker).toContain(
            'layout="recordingTagIconPicker"',
        );
        expect(tagManagerIconPicker).toContain(
            'spacing="recordingTagIconPicker"',
        );
        expect(tagManagerIconPicker).toContain(
            'variant="recordingTagIconOption"',
        );
        expect(tagManagerIconPicker).toContain(
            'size="recordingTagIconOption"',
        );
        expect(tagManagerIconPicker).not.toContain('variant="outline"');
        for (const primitiveImport of [
            "Field,",
            "FieldGroup,",
            "FieldLegend,",
            "FieldSet,",
            "InputGroup,",
            "ToggleGroup,",
            "Badge",
            "Button",
            "Card,",
            "CardDescription,",
            "Alert,",
            "Empty,",
            "Spinner",
        ]) {
            expect(tagManager).toContain(primitiveImport);
        }
        expect(tagManager).toContain('data-sot-control="recording-tag-create"');
        expect(tagManager).toContain('variant="recordingTagManagerPanel"');
        expect(tagManager).toContain('variant="recordingTagManagerHeader"');
        expect(tagManager).toContain('variant="recordingTagManagerTitle"');
        expect(tagManager).toContain('"recordingTagManagerCreate"');
        expect(tagManager).toContain('"recordingTagManagerDelete"');
        expect(tagManager).toContain('"recordingTagManagerDefault"');
        expect(tagManager).toContain('"recordingTagManagerEmpty"');
        expect(tagManager).toContain('"recordingTagManagerSaving"');
        expect(tagManager).toContain('"recordingTagManagerTight"');
        expect(tagManager).toContain('"recordingTagManagerCompact"');
        expect(tagManager).toContain("variant={contentVariant}");
        expect(tagManager).toContain('variant="recordingTagToggleNote"');
        for (const recordingTagButtonVariant of [
            'variant="recordingTagErrorRetry"',
            'variant="recordingTagToggle"',
            'variant="recordingTagInlineCreate"',
            'variant="recordingTagCancel"',
            'variant="recordingTagCreate"',
            'variant="recordingTagDelete"',
            'variant="recordingTagChipRemove"',
            'variant="recordingTagPanelClose"',
        ]) {
            expect(tagManager).toContain(recordingTagButtonVariant);
        }
        expect(tagManager).toContain('variant="recordingTagPickerFrame"');
        expect(tagManager).toContain('variant="recordingTagPickerLabel"');
        expect(tagManager).toContain('variant="recordingTagSection"');
        expect(tagManager).toContain('variant="recordingTagSectionLabel"');
        expect(tagManager).toContain('variant="pill"');
        expect(tagManager).toContain('variant="swatch"');
        expect(tagManager).toContain('variant="recordingTagError"');
        expect(tagManager).toContain('variant="recordingTagDeleteConfirm"');
        expect(tagManager).toContain('density="recordingTagError"');
        expect(tagManager).toContain('density="recordingTagDeleteConfirm"');
        expect(tagManager).toContain('layout="recordingTagInline"');
        expect(tagManager).toContain('size="recordingTagColorPicker"');
        expect(tagManager).toContain('size="recordingTagIconPicker"');
        for (const recordingTagButtonSize of [
            'size="recordingTagAction"',
            'size="recordingTagToggle"',
            'size="recordingTagInlineCreate"',
            'size="recordingTagChipRemove"',
            'size="recordingTagPanelClose"',
        ]) {
            expect(tagManager).toContain(recordingTagButtonSize);
        }
        expect(tagManager).toContain('size="swatch"');
        for (const retiredRecordingTagButtonToken of [
            'variant="ghostNeutral"',
            'variant="actionPrimary"',
            'variant="actionDestructive"',
            'variant="accentIcon"',
            'variant="chipRemove"',
            'variant="ghostIconCompact"',
            'size="icon-compact"',
            'size="control-sm"',
            'size="pill-sm"',
            'size="icon-2xs"',
            'size="icon-chip"',
        ]) {
            expect(tagManager).not.toContain(retiredRecordingTagButtonToken);
        }
        expect(tagManager).toContain('placement="inlineStart"');
        expect(tagManager).toContain('"relative whitespace-nowrap"');
        expect(tagManager).toContain('saving && "pointer-events-none"');
        expect(tagManager).toContain("<Spinner");
        expect(tagManager).toContain('variant="checkDot"');
        expect(tagManager).not.toContain("<LoaderCircle");
        expect(tagManager).not.toContain('className="animate-spin"');
        expect(tagManager).not.toContain("recordingTagSwatchStyle");
        expect(tagManager).not.toContain("--recording-tag-swatch-color");
        expect(tagManager).not.toContain("--toggle-swatch-color");
        expect(tagManager).not.toContain("bg-white");
        expect(cardPrimitive).toContain("recordingTagManagerPanel:");
        expect(cardPrimitive).toContain(
            "max-h-[460px] w-[320px] max-w-[calc(100vw-2rem)] gap-0",
        );
        expect(cardPrimitive).toContain("recordingTagToggleNote:");
        expect(emptyPrimitive).toContain("recordingTagEmptyState:");
        expect(inputGroupPrimitive).toContain("recordingTagCreateRow:");
        expect(inputGroupPrimitive).toContain("recordingTagNameInput:");
        expect(fieldPrimitive).toContain("recordingTagPickerFrame:");
        expect(fieldPrimitive).toContain("recordingTagPickerLabel:");
        expect(fieldPrimitive).toContain("recordingTagSectionLabel:");
        expect(alertPrimitive).toContain("recordingTagError:");
        expect(alertPrimitive).toContain("recordingTagDeleteConfirm:");
        expect(tagManager).not.toContain(
            'className="max-h-[460px] w-[320px] max-w-[calc(100vw-2rem)] gap-0 max-md:max-w-none"',
        );
        expect(tagManager).toMatch(
            /<InputGroup[\s\S]*variant="recordingTagCreateRow"[\s\S]*data-sot-part="create-row"/,
        );
        expect(tagManager).toMatch(
            /<InputGroupInput[\s\S]*variant="recordingTagNameInput"[\s\S]*data-sot-control="recording-tag-name"/,
        );
        for (const retiredRecordingTagShellToken of [
            'variant="popover"',
            'variant="popoverCompact"',
            '"popoverCreate"',
            '"popoverDelete"',
            '"popoverDefault"',
            '"popoverEmpty"',
            '"popoverSaving"',
            '"popoverTight"',
            '"popoverCompact"',
            'variant="popoverNote"',
            'variant="pickerFrame"',
            'variant="picker"',
            'variant="section"',
            'variant="sectionLabel"',
            'variant="destructiveSoft"',
            'variant="destructiveSoftNeutral"',
            'variant="compact"',
            'density="compact"',
            'density="comfortable"',
            'layout="inline"',
            'size="colorPicker"',
            'size="iconPicker"',
        ]) {
            expect(tagManager).not.toContain(retiredRecordingTagShellToken);
        }
        const tagManagerInlineCreateButton = extractElementSlice(
            tagManager,
            'aria-label="添加"',
            "Button",
        );
        expect(tagManagerInlineCreateButton).toContain(
            'variant="recordingTagInlineCreate"',
        );
        expect(tagManagerInlineCreateButton).toContain(
            'size="recordingTagInlineCreate"',
        );
        expect(tagManagerInlineCreateButton).toContain(
            'data-sot-control="recording-tag-create"',
        );
        expect(tagManagerInlineCreateButton).toContain("disabled={!canCreate}");
        const tagManagerFooterCreateButton = extractElementSlice(
            tagManager,
            'variant="recordingTagCreate"',
            "Button",
        );
        expect(tagManagerFooterCreateButton).toContain(
            'variant="recordingTagCreate"',
        );
        expect(tagManagerFooterCreateButton).toContain(
            'size="recordingTagAction"',
        );
        expect(tagManagerFooterCreateButton).toContain(
            'data-sot-control="recording-tag-create"',
        );
        expect(tagManager).toContain('className="min-w-0 max-w-full"');
        expect(tagManager).toContain('className="gap-3.5"');
        expect(tagManager).toContain('className="gap-2"');
        expect(tagManager).toContain("disabled={!canCreate}");
        expect(tagManager).toContain("onClick={() => void handleCreateTag()}");
        for (const shadcnRegression of [
            "accentSelf",
            "icon-chip-hidden-glyph",
            "aria-disabled={!canCreate}",
            "mr-[6px] align-[-2px]",
            "flex min-h-[59px] flex-col gap-2.5 rounded-md border bg-muted/40 p-3",
            "flex min-h-[103px] flex-col gap-2.5 rounded-md border bg-muted/40 p-3",
            "m-0 p-0 font-mono text-[11px] leading-none font-semibold uppercase tracking-[0.06em] text-muted-foreground",
            "mb-2 flex items-center gap-1.5 font-mono text-[10.5px] leading-none font-semibold uppercase tracking-[0.08em] text-muted-foreground",
            "[display:grid] grid-cols-6",
            "size-7 min-w-0 shrink-0 p-0",
            'className="m-0 contents min-w-0 border-0 p-0"',
            "[&>[data-slot=field-legend]]:mb-4",
        ]) {
            expect(tagManager).not.toContain(shadcnRegression);
        }
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

        const tagManagerEmpty = extractElementSlice(
            tagManager,
            'data-sot-panel="recording-tag-empty"',
            "Empty",
        );
        expect(tagManagerEmpty).toContain("<Empty");
        expect(tagManagerEmpty).toContain(
            'data-sot-panel="recording-tag-empty"',
        );
        expect(tagManagerEmpty).toContain('data-sot-part="empty"');
        expect(tagManagerEmpty).toContain('data-sot-state="empty"');
        expect(tagManagerEmpty).toContain('variant="recordingTagEmptyState"');
        expect(tagManagerEmpty).toContain(
            '<EmptyHeader variant="recordingTagEmptyState">',
        );
        expect(tagManagerEmpty).toContain(
            '<EmptyTitle\n                                variant="recordingTagEmptyState"\n                                data-sot-part="empty-message"',
        );
        expect(tagManagerEmpty).toContain("还没有任何标签");
        expect(tagManagerEmpty).toContain(
            '<EmptyDescription\n                                variant="recordingTagEmptyState"\n                                data-sot-part="empty-description"',
        );
        expect(tagManagerEmpty).toContain("在下方为这条录音创建第一个标签。");
        expect(tagManagerEmpty).not.toContain(
            '<div data-sot-part="empty-message">',
        );
        expect(tagManagerEmpty).not.toContain(
            '<div data-sot-part="empty-description">',
        );

        const removedTagManagerPrimitiveSelectors = [
            '[data-sot-control="recording-tag-icon"][data-slot="toggle-group-item"]',
            '[data-sot-control="recording-tag-icon"][data-sot-state="selected"]',
            '[data-sot-panel="recording-tag-error"][data-slot="alert"]',
            '[data-sot-panel="recording-tag-delete-confirm"][data-slot="alert"]',
            '[data-sot-panel="recording-tag-empty"] [data-sot-part="empty-message"]',
            '[data-sot-panel="recording-tag-empty"] [data-sot-part="empty-description"]',
            '[data-sot-control="recording-tag-error-retry"][data-slot="button"]',
            '[data-sot-part="footer"]\n    [data-slot="button"]',
            '[data-sot-panel="recording-tag-manager"][data-slot="card"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="head"][data-slot="card-header"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="body"][data-slot="card-content"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="create"][data-slot="field-group"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="picker"][data-slot="field-set"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="picker-label"][data-slot="field-legend"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="selected-chip"][data-slot="badge"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="tag-loading-icon"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="tag-check"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="tag-check"] svg',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="create-row"][data-slot="input-group"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="create-meta"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="picker-frame"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="toggle-note"]',
            '[data-theme="dark"] [data-sot-panel="recording-tag-manager"]',
        ];

        for (const selector of removedTagManagerPrimitiveSelectors) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }

        const tagManagerPrimitiveButtonBlocks = collectCssRuleBlocks(
            globals,
            '[data-sot-panel="recording-tag-manager"]',
        ).filter(({ prelude }) => prelude.includes('[data-slot="button"]'));
        expect(tagManagerPrimitiveButtonBlocks).toEqual([]);

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
        const tagManagerGlobalPanelBlocks = collectCssRuleBlocks(
            globals,
            '[data-sot-panel="recording-tag-manager"]',
        ).filter(({ prelude }) => !prelude.includes(".cl-pop-host"));
        const allowedTagManagerFunctionalProperties = new Set([
            "left",
            "max-width",
            "pointer-events",
            "position",
            "right",
            "top",
            "width",
            "z-index",
        ]);

        expect(tagManagerGlobalPanelBlocks.length).toBeGreaterThanOrEqual(4);
        for (const block of tagManagerGlobalPanelBlocks) {
            const declarationProperties = block.declarations
                .split("\n")
                .map((line) => line.match(/^\s*([\w-]+)\s*:/)?.[1])
                .filter((property): property is string => Boolean(property));

            for (const property of declarationProperties) {
                expect(
                    allowedTagManagerFunctionalProperties.has(property),
                    `${block.prelude.trim()} should only keep functional placement/open declarations`,
                ).toBe(true);
            }
        }
        expect(globals).toContain(
            '.cl-pop-host > [data-sot-panel="recording-tag-manager"],',
        );

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
        expect(sourceReport).toContain('from "@/components/ui/empty";');
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
        expect(cardPrimitive).toContain("sourceReportMetric:");
        expect(sourceReport).toContain('variant="sourceReportMetric"');
        expect(sourceReport).toContain('data-sot-badge="source-report-status"');
        expect(badge).toContain("sourceReportStatus:");
        expect(sourceReport).toContain('variant="sourceReportStatus"');
        expect(sourceReport).toContain('variant="sourceReportError"');
        expect(alertPrimitive).toContain("sourceReportError:");
        expect(emptyPrimitive).toContain("sourceReportErrorIcon:");
        expect(sourceReport).toContain('density="sourceReportError"');
        expect(sourceReport).toContain('layout="sourceReportError"');
        expect(sourceReport).toContain('variant="sourceReportErrorIcon"');
        expect(sourceReport).toContain(
            "data-sot-source-report-empty-icon",
        );
        expect(sourceReport).toContain("aria-hidden=\"true\"");
        expect(sourceReport).toContain("<SourceReportAlertGlyph />");
        expect(sourceReport).not.toContain(
            'className="flex flex-col items-center gap-2 px-4 py-8 text-center"',
        );
        expect(sourceReport).not.toContain(
            'className="flex size-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"',
        );
        expect(sourceReport).toContain(
            '"sourceReportCopyAction" satisfies ButtonProps["variant"]',
        );
        expect(sourceReport).toContain(
            '"sourceReportCopyAction" satisfies ButtonProps["size"]',
        );
        expect(skeletonPrimitive).toContain("sourceReportCard:");
        expect(skeletonPrimitive).toContain("sourceReportSegment:");
        expect(skeletonPrimitive).toContain("sourceReportCardCount:");
        expect(skeletonPrimitive).toContain("sourceReportCardSource:");
        expect(skeletonPrimitive).toContain("sourceReportCardStatus:");
        expect(skeletonPrimitive).toContain("sourceReportSegmentLineLong:");
        expect(skeletonPrimitive).toContain("sourceReportSegmentLineMedium:");
        expect(skeletonPrimitive).toContain("sourceReportSegmentLineShort:");
        expect(skeletonPrimitive).toContain("sourceReportSegmentLineWide:");
        expect(skeletonPrimitive).toContain("sourceReportSegmentSpeaker:");
        expect(skeletonPrimitive).toContain("sourceReportSegmentTime:");
        expect(sourceReport).toContain('variant="sourceReportCard"');
        expect(sourceReport).toContain('variant="sourceReportSegment"');
        expect(sourceReport).toContain(
            "size={sourceReportCardSkeletonSize(size)}",
        );
        expect(sourceReport).toContain(
            "size={sourceReportSegmentSkeletonSize(size)}",
        );
        expect(sourceReport).toContain("data-sot-source-report-header-actions");
        for (const control of [
            'data-sot-control="copy-source-transcript"',
            'data-sot-control="copy-source-report"',
        ]) {
            const copyControl = extractOpeningElement(
                sourceReport,
                control,
                "Button",
            );
            expect(copyControl).toContain(
                "variant={SOURCE_REPORT_COPY_BUTTON_VARIANT}",
            );
            expect(copyControl).toContain(
                "size={SOURCE_REPORT_COPY_BUTTON_SIZE}",
            );
            expect(copyControl).not.toContain('variant="ghost"');
            expect(copyControl).not.toContain('variant="secondary"');
            expect(copyControl).not.toContain('variant="destructive"');
            expect(copyControl).not.toContain('size="sm"');
        }
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
        expect(badge).toContain(
            "[&_[data-sot-part=source-report-status-dot]]:bg-current",
        );
        expect(badge).toContain(
            "[&_[data-sot-part=dashboard-source-report-status-dot]]:bg-current",
        );
        for (const selector of SOURCE_REPORT_METRIC_GLOBAL_REPAINT_SELECTOR_FRAGMENTS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
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
        for (const legacySourceReportPrimitiveClass of [
            "SOURCE_REPORT_METRIC_CARD_CLASS",
            "SOURCE_REPORT_STATUS_BADGE_CLASS",
            "SOURCE_REPORT_STATUS_BADGE_TONE_CLASS",
            "sourceReportCardSkeletonClassNames",
            "sourceReportSegmentSkeletonClassNames",
            "sourceReportStatusBadgeVariant",
        ]) {
            expect(sourceReport).not.toContain(
                legacySourceReportPrimitiveClass,
            );
        }
        expect(sourceReport).not.toMatch(
            /\bCSSProperties\b|SOURCE_REPORT_LOADING_SKELETON_STYLES|style=\{|sk _is|_is-/,
        );
        expect(sourceReport).not.toMatch(SOURCE_REPORT_LEGACY_SURFACE_RE);
        const sotPlayerTagChip = extractBoundedSlice(
            sotPlayerPrimitives,
            "export function SotPlayerTagChip",
            "export type SotPlayerStatusTone",
        );
        expect(sotPlayerPrimitives).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(sotPlayerPrimitives).toContain(
            'import { cn } from "@/lib/utils";',
        );
        expect(sotPlayerPrimitives).toContain("data-recording-tag-chip");
        expect(sotPlayerPrimitives).toContain("data-recording-tag-add");
        expect(button).toContain("playerTagAdd:");
        expect(button).toContain("playerTagChip:");
        expect(button).toContain("playerTagOverflow:");
        expect(badge).toContain("playerTagChip:");
        expect(badge).toContain("playerTagOverflow:");
        expect(sotPlayerTagChip).toContain('variant="playerTagAdd"');
        expect(sotPlayerTagChip).toContain('size="playerTagAdd"');
        expect(sotPlayerTagChip).toContain('variant="playerTagChip"');
        expect(sotPlayerTagChip).toContain('size="playerTagChip"');
        expect(sotPlayerTagChip).toContain('variant="playerTagOverflow"');
        expect(sotPlayerTagChip).toContain('size="playerTagOverflow"');
        expect(sotPlayerTagChip).not.toContain('variant="outline"');
        expect(sotPlayerTagChip).not.toContain('size="xs"');
        expect(sotPlayerPrimitives).toMatch(
            /<Plus\s+data-icon="inline-start"\s+aria-hidden="true"\s*\/>/,
        );
        expect(sotPlayerPrimitives).toMatch(
            /<Button[\s\S]*data-recording-tag-chip[\s\S]*<span\s+data-icon="inline-start">\s*<RecordingTagIconGlyph\s+icon=\{tag\.icon\}\s*\/>\s*<\/span>/,
        );
        expect(sotPlayerPrimitives).toContain(
            'data-sot-part="recording-tag-overflow"',
        );
        expect(sotPlayerPrimitives).not.toContain("tag-chip-action");
        expect(sotPlayerPrimitives).not.toContain("tag-chip-trigger");
        expect(sotPlayerPrimitives).not.toContain("tag-chip-inline");
        expect(sotPlayerPrimitives).not.toContain("utag-add");
        expect(sotPlayerPrimitives).not.toContain("utag-plus");
        expect(sotPlayerPrimitives).not.toContain("data-tagm-trigger");
        expect(sotPlayerPrimitives).not.toContain("recordingTagColorClassName");
        expect(recordingTagVisuals).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(recordingTagVisuals).toContain("<Badge");
        expect(recordingTagVisuals).toContain("data-recording-tag-chip");
        const sharedRecordingTagChip = extractOpeningElement(
            recordingTagVisuals,
            "data-recording-tag-chip",
            "Badge",
        );
        expect(sharedRecordingTagChip).toContain(
            'variant="recordingTagChip"',
        );
        expect(sharedRecordingTagChip).toContain(
            "data-sot-tag-color={tag.color}",
        );
        expect(sharedRecordingTagChip).toContain(
            "data-sot-tag-icon={tag.icon}",
        );
        expect(sharedRecordingTagChip).not.toContain('variant="outline"');
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
        expect(sotPlayerPrimitives).not.toContain(
            "SOT_PLAYER_SOURCE_BADGE_CLASS",
        );
        expect(sotPlayerPrimitives).not.toContain(
            "SOT_PLAYER_STATUS_BADGE_CLASS",
        );
        expect(sotPlayerPrimitives).toContain('variant="playerSource"');
        expect(sotPlayerPrimitives).toContain('variant="playerStatus"');
        expect(sotPlayerPrimitives).not.toContain('variant="source"');
        expect(sotPlayerPrimitives).not.toContain('variant="player-status"');
        expect(sotPlayerPrimitives).toContain(
            'className="inline-flex size-[16px] shrink-0 items-center justify-center overflow-hidden rounded-[4px]"',
        );
        expect(sotPlayerPrimitives).toContain(
            'className="block size-[16px] max-w-none object-contain"',
        );
        expect(sotPlayerPrimitives).toContain(
            'className={cn("size-4", className)}',
        );
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-control="player-source-tag"][data-slot="badge"]',
            ),
        ).toEqual([]);
        expect(sotPlayerPrimitives).not.toContain("status-badge-ready");
        expect(sotPlayerPrimitives).not.toContain("_is-");
        const speakerProfiles = readSource(
            "features/settings/components/sections/speaker-profiles-panel.tsx",
        );
        const speakerProfileButtons =
            speakerProfiles.match(/<Button\b[\s\S]*?<\/Button>/g) ?? [];
        const findSpeakerProfileButton = (control: string) =>
            speakerProfileButtons.find((button) =>
                button.includes(`data-sot-control="${control}"`),
            ) ?? "";
        const speakerAvatarFallbacks =
            speakerProfiles.match(/<AvatarFallback\b[^>]*>/g) ?? [];
        expect(speakerProfiles).toContain(
            'import { Avatar, AvatarFallback } from "@/components/ui/avatar";',
        );
        expect(speakerProfiles).toContain("<Avatar");
        expect(speakerProfiles).toContain("<AvatarFallback");
        expect(speakerAvatarFallbacks).toHaveLength(2);
        for (const fallback of speakerAvatarFallbacks) {
            expect(fallback).toContain('variant="speakerSettings"');
            expect(fallback).not.toContain("className=");
            expect(fallback).not.toContain("speakerAvatarFallbackClassName");
        }
        expect(speakerProfiles).not.toContain("speakerAvatarFallbackClassName");
        expect(speakerProfiles).not.toContain("bg-accent text-primary");
        expect(speakerProfiles).not.toContain("text-[11px] font-bold");
        expect(avatarPrimitive).toContain("speakerSettings:");
        expect(avatarPrimitive).toContain("bg-accent");
        expect(avatarPrimitive).toContain("text-primary");
        expect(avatarPrimitive).toContain("text-[11px]");
        expect(avatarPrimitive).toContain("font-bold");
        expect(speakerProfiles).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(speakerProfiles).toContain("<Badge");
        expect(speakerProfiles).toContain('variant="speakerState"');
        expect(speakerProfiles).not.toContain('variant="outline"');
        expect(speakerProfiles).toContain('data-sot-badge="speaker-state"');
        expect(speakerProfiles).toContain("data-sot-tone={tone}");
        expect(badge).toContain("speakerState:");
        expect(speakerProfiles).toContain('variant="speakerSettingsRow"');
        expect(speakerProfiles).not.toContain(
            'className="border-b border-border py-3"',
        );
        expect(fieldPrimitive).toContain('"speakerSettingsRow"');
        expect(fieldPrimitive).toContain("speakerSettingsRowFieldClassName");
        for (const control of [
            "speaker-profiles-refresh",
            "speaker-profile-create",
            "speaker-profiles-retry",
            "speaker-profile-save",
            "speaker-voiceprints-refresh",
            "speaker-voiceprints-retry",
            "speaker-voiceprint-rename",
        ]) {
            const opening = findSpeakerProfileButton(control);

            expect(opening).toContain(`data-sot-control="${control}"`);
            expect(opening).toContain('variant="speakerSettingsAction"');
            expect(opening).toContain('size="speakerSettingsAction"');
            expect(opening).not.toContain('variant="secondary"');
            expect(opening).not.toContain('variant="destructive"');
            expect(opening).not.toContain('size="sm"');
        }
        for (const control of [
            "speaker-profile-delete",
            "speaker-voiceprint-delete",
        ]) {
            const opening = findSpeakerProfileButton(control);

            expect(opening).toContain(`data-sot-control="${control}"`);
            expect(opening).toContain('variant="speakerSettingsDangerAction"');
            expect(opening).toContain('size="speakerSettingsAction"');
            expect(opening).not.toContain('variant="secondary"');
            expect(opening).not.toContain('variant="destructive"');
            expect(opening).not.toContain('size="sm"');
        }
        expect(speakerProfiles).not.toContain('variant="secondary"');
        expect(speakerProfiles).not.toContain('variant="destructive"');
        expect(speakerProfiles).not.toContain('size="sm"');
        expect(button).toContain("speakerSettingsAction:");
        expect(button).toContain("speakerSettingsDangerAction:");
        expect(speakerProfiles).not.toContain("sot-speaker-pill");
        expect(globals).not.toContain(
            '[data-sot-part="speaker-profile-avatar"] [data-slot="avatar-fallback"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="speaker-voiceprint-avatar"] [data-slot="avatar-fallback"]',
        );
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
