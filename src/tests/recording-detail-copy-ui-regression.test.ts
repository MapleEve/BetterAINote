import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serializeRecordingDetailTranscriptionJob } from "@/server/modules/recordings/serialize";

const ROOT = path.join(process.cwd(), "src");

const EXPECTED_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME =
    "ml-auto inline-flex max-w-full flex-[0_1_auto] flex-wrap items-center gap-2";
const EXPECTED_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME =
    "flex min-h-0 flex-1 flex-col gap-0 rounded-[16px] border border-[var(--line-hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] backdrop-blur-none dark:border-[var(--glass-border-soft)] dark:bg-[rgb(255_255_255_/_0.025)] dark:shadow-none";

const DASHBOARD_COPY_ACTION_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-part="dashboard-copy-label"]',
    '[data-sot-part="dashboard-copy-icon"]',
    '[data-sot-part="dashboard-transcript-actions"]',
    '[data-sot-control="copy-local-transcript"][hidden]',
    '[data-sot-control="copy-source-transcript"][hidden]',
    '[data-sot-control="copy-source-report"][hidden]',
] as const;

const SOURCE_REPORT_SKELETON_SHARED_TOKENS = [
    "sourceReportCard:",
    "sourceReportSegment:",
    "sourceReportCardCount",
    "sourceReportCardSource",
    "sourceReportCardStatus",
    "sourceReportSegmentLineLong",
    "sourceReportSegmentLineMedium",
    "sourceReportSegmentLineShort",
    "sourceReportSegmentLineWide",
    "sourceReportSegmentSpeaker",
    "sourceReportSegmentTime",
] as const;

const SOURCE_REPORT_SKELETON_OWNER_TOKENS = [
    "SOURCE_REPORT_SKELETON_CLASS_NAME",
    "SOURCE_REPORT_CARD_SKELETON_CLASS_NAMES",
    "SOURCE_REPORT_SEGMENT_SKELETON_CLASS_NAMES",
    "count: `${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[18px] w-[48px] align-middle rounded-[6px]`",
    "status: `${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[18px] w-[80px] align-middle rounded-[6px]`",
    "source: `${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[18px] w-[120px] align-middle rounded-[6px]`",
    '"line-long": `${SOURCE_REPORT_SKELETON_CLASS_NAME} mt-1.5 inline-block h-[13px] w-[92%] align-middle rounded-[4px]`',
    '"line-wide": `${SOURCE_REPORT_SKELETON_CLASS_NAME} mt-[7px] inline-block h-[13px] w-[88%] align-middle rounded-[4px]`',
    "speaker: `${SOURCE_REPORT_SKELETON_CLASS_NAME} ml-[5px] inline-block h-[12px] w-[54px] align-middle rounded-[4px]`",
    "time: `${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[12px] w-[96px] align-middle rounded-[4px]`",
] as const;

const EXPECTED_SOURCE_REPORT_METRIC_CARD_CLASS_NAME =
    "gap-[6px] overflow-visible rounded-[10px] border-[var(--source-report-metric-border)] bg-[var(--source-report-metric-bg)] px-[12px] py-[10px] shadow-none backdrop-blur-none";
const SOURCE_REPORT_METRIC_CARD_CLASS_TOKENS =
    EXPECTED_SOURCE_REPORT_METRIC_CARD_CLASS_NAME.split(" ");
const SOURCE_REPORT_STYLE_OWNER_SNIPPETS = [
    "type SourceReportStyleVariables = CSSProperties & {",
    "export const SOURCE_REPORT_STYLE_VARIABLES = {",
    '"--source-report-metric-bg": "var(--card-popover-footer-bg)"',
    '"--source-report-metric-border": "var(--card-elevated-border)"',
    '"--source-report-status-ok-fg": "oklch(0.62 0.13 158)"',
    '"--source-report-status-warn-fg": "oklch(0.55 0.16 70)"',
    '"--source-report-skeleton-bg":',
    "linear-gradient(90deg, color-mix(in srgb, var(--fg-primary) 5%, transparent)",
    "export const SOURCE_REPORT_SKELETON_CLASS_NAME =",
    "export type SourceReportTone =",
    "export type SourceReportCardSkeletonSize =",
    "export type SourceReportSegmentSkeletonSize =",
    "export const SOURCE_REPORT_CARD_SKELETON_CLASS_NAMES =",
    "export const SOURCE_REPORT_SEGMENT_SKELETON_CLASS_NAMES =",
    "![background-color:transparent]",
    "dark:[background-image:linear-gradient(90deg,rgb(255_255_255_/_0.05)_0%,rgb(255_255_255_/_0.12)_50%,rgb(255_255_255_/_0.05)_100%)]",
    "export const SOURCE_REPORT_PANE_CLASS_NAME =",
    "export const SOURCE_REPORT_METRIC_CARD_CLASS_NAME =",
    "export const SOURCE_REPORT_EMPTY_SURFACE_CLASS_NAME =",
    "export const SOURCE_REPORT_EMPTY_ICON_CLASS_NAME =",
    "export const SOURCE_REPORT_ACTION_BUTTON_CLASS_NAME =",
    "export const SOURCE_REPORT_PRIMARY_ACTION_BUTTON_CLASS_NAME =",
    "export const SOURCE_REPORT_GHOST_ACTION_BUTTON_CLASS_NAME =",
    "export const SOURCE_REPORT_COPY_BUTTON_VARIANT =",
    "export const SOURCE_REPORT_COPY_BUTTON_SIZE =",
    "export const SOURCE_REPORT_COPY_BUTTON_CLASS_NAME =",
    "[&[hidden]]:hidden",
    "export const SOURCE_REPORT_ERROR_ALERT_CLASS_NAME =",
    "export const SOURCE_REPORT_STATUS_BADGE_CLASS_NAME =",
    "satisfies SourceReportStyleVariables",
] as const;

const RECORDING_SOURCE_REPORT_LOADING_METRIC_CARDS = [
    {
        metric: "source",
        value: "skeleton",
        snippets: ['<SourceReportCardSkeleton size="source" />'],
    },
    {
        metric: "transcript-status",
        value: "skeleton",
        snippets: ['<SourceReportCardSkeleton size="status" />'],
    },
    {
        metric: "summary-status",
        value: "skeleton",
        snippets: ['<SourceReportCardSkeleton size="status" />'],
    },
    {
        metric: "segment-count",
        value: "skeleton",
        snippets: ['<SourceReportCardSkeleton size="count" />'],
    },
] as const;

const RECORDING_SOURCE_REPORT_LOADED_METRIC_CARDS = [
    {
        metric: "source",
        value: "source",
        snippets: ["sourceProviderLabel"],
    },
    {
        metric: "transcript-status",
        snippets: ["<SourceReportStatusBadge", "sourceTranscriptStatusLabel"],
    },
    {
        metric: "summary-status",
        snippets: ["<SourceReportStatusBadge", "sourceSummaryStatusLabel"],
    },
    {
        metric: "segment-count",
        value: "number",
        snippets: ["sourceReportSegmentCount"],
    },
] as const;

const ROUTE_LOADING_SURFACE_CLASS_VALUE =
    "min-h-0 gap-0 overflow-hidden rounded-[16px] border-[var(--line-hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] backdrop-blur-none dark:border-[var(--glass-border)]";
const ROUTE_LOADING_SURFACE_CLASS_TOKENS =
    ROUTE_LOADING_SURFACE_CLASS_VALUE.split(" ");
const RECORDING_ROUTE_FALLBACK_SHELL_CLASS_VALUE =
    "grid h-screen min-h-[720px] grid-cols-[264px_1fr] transition-[grid-template-columns] duration-[320ms] ease-[var(--ease-out)]";
const RECORDING_ROUTE_EMPTY_DETAIL_CLASS_VALUE =
    "flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden rounded-[16px] border border-[var(--line-hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] dark:border-[var(--glass-border)]";
const RECORDING_ROUTE_EMPTY_PANEL_CLASS_VALUE =
    "flex min-h-[280px] flex-1 flex-col items-center justify-center gap-2 rounded-[16px] border border-[var(--line-hairline)] bg-[var(--bg-elevated)] px-6 py-9 text-center shadow-[var(--shadow-sm)] dark:border-[var(--glass-border-soft)] dark:bg-[rgb(255_255_255_/_0.025)] dark:shadow-none";
const RECORDING_ROUTE_EMPTY_ICON_CLASS_VALUE =
    "mb-1 inline-grid size-12 place-items-center rounded-full border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-tertiary)] [&_svg]:size-[22px] [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.6] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]";
const RECORDING_ROUTE_EMPTY_TITLE_CLASS_VALUE =
    "[font:600_14px_var(--font-sans)] text-[var(--fg-primary)]";
const RECORDING_ROUTE_EMPTY_DESCRIPTION_CLASS_VALUE =
    "max-w-[320px] [font:500_12.5px/1.55_var(--font-sans)] text-[var(--fg-tertiary)]";
const RECORDING_ROUTE_FALLBACK_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-shell="recording-route-loading"]',
    '[data-sot-shell="recording-route-empty"]',
    '[data-sot-shell="recording-route-error"]',
    '[data-sot-panel="recording-route-empty-detail"]',
    '[data-sot-panel="recording-route-empty"]',
    '[data-sot-part="recording-route-empty-icon"]',
    '[data-sot-part="recording-route-empty-title"]',
    '[data-sot-part="recording-route-empty-description"]',
] as const;
const ROUTE_CHROME_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-panel="route-sidebar"]',
    '[data-sot-part="route-brand"]',
    '[data-sot-part="route-brand"] img',
    '[data-sot-part="route-brand-name"]',
    '[data-sot-part="route-brand-subtitle"]',
    '[data-sot-panel="route-main"]',
    '[data-sot-panel="route-topbar"]',
    '[data-sot-part="route-crumbs"]',
    '[data-sot-part="route-crumb-current"]',
    '[data-sot-panel="route-workspace"]',
] as const;

const AI_RENAME_PREVIEW_SHARED_PRIMITIVE_FILES = [
    "components/ui/alert.tsx",
    "components/ui/badge.tsx",
    "components/ui/button.tsx",
    "components/ui/card.tsx",
] as const;

const AI_RENAME_PREVIEW_BUSINESS_TOKENS = [
    "aiRenamePreview",
    "aiRenamePreviewClose",
    "aiRenamePreviewAction",
    "aiRenamePreviewPrimaryAction",
    "aiRenamePreviewOldTag",
    "aiRenamePreviewNewTag",
    "aiRenamePreviewError",
    "aiRenamePreviewUnavailable",
] as const;

const AI_RENAME_PREVIEW_FEATURE_OWNER_CLASS_SNIPPETS = [
    {
        label: "panel",
        snippets: [
            "pointer-events-none",
            "absolute",
            "top-[calc(100%+8px)]",
            "right-0",
            "z-[var(--z-popover-inline)]",
            "w-[min(360px,calc(100vw-32px))]",
            "gap-0",
            "data-[open=true]:pointer-events-auto",
            "[&_[data-sot-part=state][hidden]]:!hidden",
        ],
    },
    {
        label: "header",
        snippets: [
            "h-[55px]",
            "grid-cols-[1fr_auto]",
            "border-b border-border",
            "px-[14px] pt-3 pb-2",
            "[&_[data-slot=card-head-copy]]:min-w-0",
        ],
    },
    {
        label: "body",
        snippets: [
            "p-[14px]",
            "loadingContent: \"h-[78px]\"",
            "font-display text-[15px] font-semibold leading-[1.4]",
        ],
    },
    {
        label: "state",
        snippets: [
            "font-mono text-[10.5px] font-semibold leading-none",
            "m-0 break-words font-sans text-[12.5px] font-medium leading-[1.5]",
            "m-0 max-w-full break-words font-sans text-[11.5px] font-medium leading-[1.5]",
        ],
    },
    {
        label: "review",
        snippets: [
            "my-1.5 flex flex-col gap-1.5",
            "rounded-lg border border-border bg-[var(--bg-recessed)]",
            "text-[var(--fg-secondary)] line-through",
            "text-[var(--fg-primary)]",
        ],
    },
    {
        label: "actions",
        snippets: [
            "h-[48px] gap-1.5 bg-[var(--bg-recessed)] px-[14px] py-0",
            "bg-[var(--glass-tint-base)]",
        ],
    },
    {
        label: "alert",
        snippets: [
            "border-0 bg-transparent text-center",
            "[&_[data-slot=alert-icon]]:size-7",
            "[&_[data-slot=alert-message]]:break-words",
        ],
    },
    {
        label: "badge",
        snippets: ["min-w-[56px]", "uppercase tracking-[0.04em]"],
    },
    {
        label: "button",
        snippets: [
            "size-6 rounded-md",
            "p-0",
            "h-[26px] shrink-0 gap-[7px]",
            "bg-[var(--glass-tint-base)]",
            "text-[var(--fg-primary)]",
        ],
    },
] as const;

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function variantAttr(value: string) {
    return `variant=${JSON.stringify(value)}`;
}

function hasExactBusinessToken(source: string, token: string) {
    return new RegExp(`\\b${escapeRegExp(token)}(?![A-Za-z0-9_])`).test(source);
}

function collectAiRenamePrimitiveBusinessTokens() {
    return AI_RENAME_PREVIEW_SHARED_PRIMITIVE_FILES.flatMap((file) => {
        const source = readSource(file);
        return AI_RENAME_PREVIEW_BUSINESS_TOKENS.filter((token) =>
            hasExactBusinessToken(source, token),
        ).map((token) => `${file}:${token}`);
    });
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

function extractElementSlice(source: string, marker: string, tagName: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf(`<${tagName}`, markerIndex);
    const end = source.indexOf(`</${tagName}>`, markerIndex);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + tagName.length + 3);
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

function expectExactStringConstInitializer(
    source: string,
    constName: string,
    expected: string,
) {
    const escapedConstName = constName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(
        new RegExp(
            `\\bconst\\s+${escapedConstName}\\s*=\\s*"((?:\\\\.|[^"\\\\])*)"\\s*;`,
        ),
    );

    expect(match).not.toBeNull();
    expect(match?.[1]).toBe(expected);
    return match?.[1] ?? "";
}

function expectSourceReportMetricCallsites(
    source: string,
    cardComponentName: string,
    expectations: readonly {
        metric: string;
        snippets: readonly string[];
        value?: string;
    }[],
) {
    const metricCardCallsites =
        source.match(new RegExp(`<${cardComponentName}(?=\\s|>)`, "g")) ?? [];
    const expectedMetricCallsiteProps = [
        'metric="source"',
        'metric="transcript-status"',
        'metric="summary-status"',
        'metric="segment-count"',
    ];
    expect(metricCardCallsites).toHaveLength(4);
    expect(expectations.map(({ metric }) => `metric="${metric}"`)).toEqual(
        expectedMetricCallsiteProps,
    );

    for (const expectation of expectations) {
        const metricCard = extractElementSlice(
            source,
            `metric="${expectation.metric}"`,
            cardComponentName,
        );

        expect(metricCard).toContain(`<${cardComponentName}`);
        expect(metricCard).toContain(`metric="${expectation.metric}"`);
        if (expectation.value) {
            expect(metricCard).toContain(`value="${expectation.value}"`);
        }
        for (const snippet of expectation.snippets) {
            expect(metricCard).toContain(snippet);
        }
    }
}

function extractOpeningElement(
    source: string,
    marker: string,
    tagName: string,
) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf(`<${tagName}`, markerIndex);
    const end = source.indexOf(">", markerIndex);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(markerIndex);
    return source.slice(start, end + 1);
}

function extractExactOpeningElement(
    source: string,
    marker: string,
    tagName: string,
) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const tagPattern = new RegExp(`<${tagName}(?=\\s|>)`, "g");
    let start = -1;
    let match = tagPattern.exec(source);

    while (match && match.index <= markerIndex) {
        start = match.index;
        match = tagPattern.exec(source);
    }

    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf(">", start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + 1);
}

function expectAiRenameGenericPrimitiveCall(
    source: string,
    marker: string,
    tagName: "Alert" | "Badge" | "Button" | "Card",
) {
    const openingElement = extractExactOpeningElement(source, marker, tagName);

    expect(openingElement).toContain("className=");
    expect(openingElement).not.toMatch(
        /\b(?:variant|size|density|layout)="aiRenamePreview[A-Za-z0-9_]*"/,
    );
    return openingElement;
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

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE =
    /className=["']btn(?:\s+(?:ghost|primary|glass))?\b|track-fill|track-thumb|sk _is|_is-/;

const MORE_ACTIONS_MENU_RETIRED_GLOBALS_SELECTORS = [
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
] as const;

const MORE_ACTIONS_MENU_COMPOSITION_TOKENS = [
    'variant="glass"',
    'density="compact"',
    'variant="destructive"',
    "<DropdownMenuShortcut",
    'variant="hint"',
] as const;

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

const RECORDING_SOURCE_RECORD_LAYOUT_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-part="recording-source-record-shell"]',
    '[data-sot-part="recording-source-record-actions"]',
    '[data-sot-part="recording-source-record-tabs"]',
    '[data-sot-part="recording-source-record-hint"]',
    '[data-sot-part="recording-source-record-pane"]',
] as const;

describe("recording detail copy and title action UI regressions", () => {
    it("redacts failed transcription job errors before they reach recording detail UI", () => {
        expect(
            serializeRecordingDetailTranscriptionJob({
                recordingId: "rec-1",
                status: "failed",
                remoteStatus: "failed",
                lastError:
                    "upstream 500 token=secret-token cookie=session recording id rec-raw",
                updatedAt: new Date("2026-05-31T00:00:00.000Z"),
            }),
        ).toEqual({
            status: "failed",
            remoteStatus: "failed",
            lastError: "Transcription failed. Check server logs for details.",
        });
    });

    it("keeps browser clipboard writes behind the platform helper with a non-secure fallback", () => {
        const clipboard = readSource("lib/platform/clipboard.ts");

        expect(clipboard).toContain("navigator.clipboard?.writeText");
        expect(clipboard).toContain('document.execCommand("copy")');
        expect(clipboard).toContain("Clipboard text is empty");
    });

    it("keeps transcript copy actions disabled when no display text is available", () => {
        const detailTranscript = readSource(
            "features/recordings/components/transcription-section.tsx",
        );
        const dashboardTranscript = readSource(
            "features/dashboard/workstation.tsx",
        );
        const globals = readSource("app/globals.css");

        expect(detailTranscript).toContain("handleCopyTranscript");
        expect(detailTranscript).toContain(
            "writeBrowserClipboardText(displayText)",
        );
        expect(detailTranscript).toContain("isCopyingTranscript");
        expect(detailTranscript).toContain("!displayText.trim()");
        expect(detailTranscript).toContain("transcription.copyTranscript");
        expect(detailTranscript).toContain(
            "transcription.copyTranscriptFailed",
        );
        expect(detailTranscript).toContain(
            'data-sot-panel="recording-transcription"',
        );
        expect(detailTranscript).toContain(
            'data-sot-control="copy-local-transcript"',
        );
        expect(detailTranscript).toContain(
            'data-sot-control="retranscribe-local"',
        );
        expect(detailTranscript).toContain(
            'data-sot-control="start-local-transcription"',
        );
        expect(detailTranscript).toContain('data-icon="inline-start"');
        expect(detailTranscript).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(detailTranscript).toContain("<Badge");
        expect(detailTranscript).toContain(
            "const RECORDING_TRANSCRIPTION_META_BADGE_CLASS_NAME",
        );
        expect(detailTranscript).toContain(
            "const recordingTranscriptionClassNames = {",
        );
        const recordingTranscriptionClassNamesBlock = extractBoundedSlice(
            detailTranscript,
            "const recordingTranscriptionClassNames = {",
            "} as const;",
        );
        for (const ownerClassSnippet of [
            'card: "min-h-0 flex-1 gap-0"',
            'header: "flex flex-row items-center gap-3 border-b px-3.5 py-3"',
            'heading: "flex min-w-0 items-center gap-3"',
            'icon: "size-4 flex-none text-[var(--fg-secondary)]"',
            'headerCopy: "flex min-w-0 flex-col gap-[3px]"',
            'body: "min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6',
            "[scrollbar-width:thin]",
            "[&::-webkit-scrollbar]:size-[10px]",
            "[&::-webkit-scrollbar-thumb]:bg-[var(--fg-tertiary)]",
            "[&::-webkit-scrollbar-thumb:hover]:bg-[var(--fg-secondary)]",
            'speakerReviewSection:\n        "flex flex-col gap-2 border-t border-[var(--line-hairline)] pt-2 dark:border-[var(--glass-border-soft)]"',
            'sectionHead: "flex items-start justify-between gap-3 max-[860px]:flex-col"',
            'sectionTitle:\n        "m-0 font-sans text-[12.5px] font-semibold text-[var(--fg-primary)]"',
            'sectionDescription:\n        "mt-0.5 mb-0 font-sans text-[11.5px] font-medium leading-[1.45] text-[var(--fg-tertiary)] max-[860px]:[overflow-wrap:anywhere]"',
            'actions:\n        "inline-flex min-w-0 flex-wrap items-center justify-end gap-2 max-[860px]:justify-start"',
            'turn: "border-b border-dashed border-[var(--line-hairline)] pt-[10px] pb-4 dark:border-[var(--glass-border)]"',
            'metaList: "mb-1.5 flex flex-wrap items-center gap-2.5"',
        ]) {
            expect(recordingTranscriptionClassNamesBlock).toContain(
                ownerClassSnippet,
            );
        }
        expect(recordingTranscriptionClassNamesBlock).not.toMatch(
            /\b(?:rgb|rgba|color-mix|oklch)\(/,
        );
        expect(recordingTranscriptionClassNamesBlock).not.toMatch(
            /#[0-9a-fA-F]{3,8}\b/,
        );
        expect(detailTranscript).toContain(
            'outputSection:\n        "flex flex-col gap-2 border-t border-[var(--line-hairline)] pt-2 dark:border-[var(--glass-border-soft)]"',
        );
        expect(detailTranscript).toContain(
            'outputText:\n        "m-0 font-sans text-[14.5px] leading-[1.65] text-[var(--fg-primary)] [text-wrap:pretty] max-[860px]:[overflow-wrap:anywhere]"',
        );
        expect(detailTranscript).toContain(
            "function RecordingTranscriptionMetaBadge",
        );
        for (const metaHook of [
            'data-sot-meta="language"',
            'data-sot-meta="source"',
            'data-sot-meta="words"',
            'data-sot-meta="characters"',
        ]) {
            expect(detailTranscript).toContain(metaHook);
        }
        const copyControlIndex = detailTranscript.indexOf(
            'data-sot-control="copy-local-transcript"',
        );
        const retranscribeControlIndex = detailTranscript.indexOf(
            'data-sot-control="retranscribe-local"',
        );
        const startControlIndex = detailTranscript.indexOf(
            'data-sot-control="start-local-transcription"',
        );
        const jobErrorBannerIndex = detailTranscript.indexOf(
            'data-sot-state="error"',
        );
        expect(copyControlIndex).toBeGreaterThanOrEqual(0);
        expect(retranscribeControlIndex).toBeGreaterThanOrEqual(0);
        expect(startControlIndex).toBeGreaterThanOrEqual(0);
        expect(jobErrorBannerIndex).toBeGreaterThanOrEqual(0);
        const copyControl = extractOpeningElement(
            detailTranscript,
            'data-sot-control="copy-local-transcript"',
            "Button",
        );
        const retranscribeControl = extractOpeningElement(
            detailTranscript,
            'data-sot-control="retranscribe-local"',
            "Button",
        );
        const startControl = extractOpeningElement(
            detailTranscript,
            'data-sot-control="start-local-transcription"',
            "Button",
        );
        const jobErrorBanner = detailTranscript.slice(
            Math.max(0, jobErrorBannerIndex - 240),
            jobErrorBannerIndex + 360,
        );
        const outputSection = extractOpeningElement(
            detailTranscript,
            'data-sot-section="recording-transcription-output"',
            "section",
        );
        const transcriptionCard = extractOpeningElement(
            detailTranscript,
            'data-sot-panel="recording-transcription"',
            "Card",
        );
        const transcriptionHeader = extractOpeningElement(
            detailTranscript,
            'data-sot-part="recording-transcription-header"',
            "CardHeader",
        );
        const transcriptionHeading = extractOpeningElement(
            detailTranscript,
            'data-sot-part="recording-transcription-heading"',
            "div",
        );
        const transcriptionIcon = extractOpeningElement(
            detailTranscript,
            'data-sot-part="recording-transcription-icon"',
            "FileText",
        );
        const transcriptionHeaderCopy = extractOpeningElement(
            detailTranscript,
            'data-sot-part="recording-transcription-header-copy"',
            "div",
        );
        const transcriptionBody = extractOpeningElement(
            detailTranscript,
            'data-sot-part="recording-transcription-body"',
            "CardContent",
        );
        const sectionHead = extractOpeningElement(
            detailTranscript,
            'data-sot-part="recording-transcription-section-head"',
            "header",
        );
        const sectionTitle = extractOpeningElement(
            detailTranscript,
            'data-sot-part="recording-transcription-section-title"',
            "h3",
        );
        const sectionDescription = extractOpeningElement(
            detailTranscript,
            'data-sot-part="recording-transcription-section-description"',
            "p",
        );
        const sectionActions = extractOpeningElement(
            detailTranscript,
            'data-sot-part="recording-transcription-actions"',
            "div",
        );
        const transcriptionTurn = extractOpeningElement(
            detailTranscript,
            'data-sot-part="recording-transcription-turn"',
            "div",
        );
        const speakerReviewSection = extractOpeningElement(
            detailTranscript,
            'data-sot-section="recording-transcription-speaker-review"',
            "section",
        );
        const outputText = extractOpeningElement(
            detailTranscript,
            'data-sot-part="recording-transcription-text"',
            "p",
        );
        const metaList = extractBoundedSlice(
            detailTranscript,
            'data-sot-list="recording-transcription-meta"',
            "</div>",
        );
        const transcriptionMetaList = extractOpeningElement(
            detailTranscript,
            'data-sot-list="recording-transcription-meta"',
            "div",
        );
        expect(outputSection).toContain(
            "recordingTranscriptionClassNames.outputSection",
        );
        expect(transcriptionCard).toContain(
            "recordingTranscriptionClassNames.card",
        );
        expect(transcriptionHeader).toContain(
            "recordingTranscriptionClassNames.header",
        );
        expect(transcriptionHeading).toContain(
            "recordingTranscriptionClassNames.heading",
        );
        expect(transcriptionIcon).toContain(
            "recordingTranscriptionClassNames.icon",
        );
        expect(transcriptionHeaderCopy).toContain(
            "recordingTranscriptionClassNames.headerCopy",
        );
        expect(transcriptionBody).toContain(
            "recordingTranscriptionClassNames.body",
        );
        expect(sectionHead).toContain(
            "recordingTranscriptionClassNames.sectionHead",
        );
        expect(sectionTitle).toContain(
            "recordingTranscriptionClassNames.sectionTitle",
        );
        expect(sectionDescription).toContain(
            "recordingTranscriptionClassNames.sectionDescription",
        );
        expect(sectionActions).toContain(
            "recordingTranscriptionClassNames.actions",
        );
        expect(transcriptionTurn).toContain(
            "recordingTranscriptionClassNames.turn",
        );
        expect(transcriptionMetaList).toContain(
            "recordingTranscriptionClassNames.metaList",
        );
        expect(speakerReviewSection).toContain(
            "recordingTranscriptionClassNames.speakerReviewSection",
        );
        expect(outputText).toContain(
            "recordingTranscriptionClassNames.outputText",
        );
        expect(copyControl).toContain('variant="outline"');
        expect(copyControl).toContain('size="sm"');
        expect(copyControl).toContain(
            "recordingTranscriptionButtonClassNames.action",
        );
        expect(copyControl).toContain("isCopyingTranscript");
        expect(copyControl).toContain("!displayText.trim()");
        expect(retranscribeControl).toContain('variant="destructive"');
        expect(retranscribeControl).toContain('size="sm"');
        expect(retranscribeControl).toContain(
            "recordingTranscriptionButtonClassNames.danger",
        );
        expect(startControl).toContain('variant="default"');
        expect(startControl).toContain('size="sm"');
        expect(startControl).toContain(
            "recordingTranscriptionButtonClassNames.primary",
        );
        expect(jobErrorBanner).toContain("<Alert");
        expect(jobErrorBanner).toContain('variant="statusError"');
        expect(metaList).toContain("<RecordingTranscriptionMetaBadge");
        expect(metaList).not.toContain(variantAttr("transcriptionMeta"));
        expect(metaList).toContain('data-sot-tone="attribute"');
        expect(metaList).toContain('data-sot-tone="measure"');
        for (const removedActionToken of [
            'variant="transcriptionAction"',
            'variant="transcriptionDangerAction"',
            'variant="transcriptionPrimaryAction"',
            'size="transcriptionAction"',
        ]) {
            expect(copyControl).not.toContain(removedActionToken);
            expect(retranscribeControl).not.toContain(removedActionToken);
            expect(startControl).not.toContain(removedActionToken);
        }
        expect(jobErrorBanner).not.toContain('variant="destructive"');
        for (const genericMetaToken of [
            'variant="outline"',
            'variant="secondary"',
        ]) {
            expect(metaList).not.toContain(genericMetaToken);
        }
        for (const removedSelector of [
            '[data-sot-panel="recording-transcription"][data-slot="card"]',
            '[data-sot-part="recording-transcription-header"] {',
            '[data-sot-part="recording-transcription-heading"]',
            '[data-sot-part="recording-transcription-icon"]',
            '[data-sot-part="recording-transcription-header-copy"]',
            '[data-sot-part="recording-transcription-title"] h2',
            '[data-sot-part="recording-transcription-description"],',
            '[data-sot-part="recording-transcription-unavailable"] {',
            '[data-sot-part="recording-transcription-body"]',
            '[data-sot-section="recording-transcription-speaker-review"]',
            '[data-sot-part="recording-transcription-section-head"]',
            '[data-sot-part="recording-transcription-section-title"]',
            '[data-sot-part="recording-transcription-section-description"]',
            '[data-sot-part="recording-transcription-actions"]',
            '[data-sot-part="recording-transcription-turn"]',
            '[data-sot-part="recording-transcription-body"] [data-sot-banner-title]',
            '[data-sot-list="recording-transcription-meta"]',
            '[data-sot-list="recording-transcription-meta"] > span',
            '[data-sot-part="recording-transcription-meta-icon"]',
            '[data-sot-section="recording-transcription-output"]',
            '[data-theme="dark"] [data-sot-section="recording-transcription-output"]',
            '[data-sot-part="recording-transcription-text"]',
        ]) {
            expect(globals).not.toContain(removedSelector);
        }
        expect(globals).not.toContain("\n[data-sot-banner] {\n");
        expect(globals).not.toContain("\n[data-sot-banner-icon] {\n");
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
            expect(detailTranscript).not.toContain(legacyClass);
        }

        expect(dashboardTranscript).toContain(
            'data-sot-panel="dashboard-retranscription"',
        );
        expect(dashboardTranscript).toContain(
            "data-retx-state={dashboardRetxState}",
        );
        expect(dashboardTranscript).toContain('aria-label="详情标签"');
        expect(dashboardTranscript).toContain(
            'hidden={detailTab !== "transcript"}',
        );
        expect(dashboardTranscript).toContain(
            '{ value: "transcript", label: "转写" }',
        );
        expect(dashboardTranscript).toContain('tabKey: "source-report"');
    });

    it("keeps source report copy states explicit without dumping raw detail payloads", () => {
        const sourceReport = readSource(
            "features/recordings/components/source-report-panel.tsx",
        );
        const transcriptionSkeletons = readSource(
            "features/recordings/components/transcription-skeletons.tsx",
        );
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const cardPrimitive = readSource("components/ui/card.tsx");
        const emptyPrimitive = readSource("components/ui/empty.tsx");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const globals = readSource("app/globals.css");
        const sourceReportStyles = readSource(
            "features/source-report/styles.ts",
        );
        const sourceReportButtonControls = [
            'data-sot-control="copy-source-transcript"',
            'data-sot-control="copy-source-report"',
            'data-sot-control="open-source-record"',
            'data-sot-control="repull-source"',
        ];
        const sourceReportCopyControls = [
            'data-sot-control="copy-source-transcript"',
            'data-sot-control="copy-source-report"',
        ];
        const sourceReportPrimitiveSources = [
            alertPrimitive,
            buttonPrimitive,
            cardPrimitive,
            emptyPrimitive,
            skeletonPrimitive,
            globals,
        ];

        expect(sourceReport).toContain("handleCopySourceTranscript");
        expect(sourceReport).toContain("handleCopySourceReport");
        expect(sourceReport).toContain("sourceReport.copySourceTranscript");
        expect(sourceReport).toContain("sourceReport.copySourceReport");
        expect(sourceReport).toContain("sourceReport.missingSourceTranscript");
        expect(sourceReport).toContain("sourceReport.missingSourceReport");
        expect(sourceReport).toContain("buildSourceTranscriptCopyText");
        expect(sourceReport).toContain("SourceReportAvailabilitySnapshot");
        expect(sourceReport).toContain("onAvailabilityChange");
        expect(sourceReport).toContain("transcriptAvailable");
        expect(sourceReport).toContain("reportAvailable");
        expect(sourceReport).toContain(
            'data-sot-panel="recording-source-report"',
        );
        for (const snippet of SOURCE_REPORT_STYLE_OWNER_SNIPPETS) {
            expect(sourceReportStyles).toContain(snippet);
        }
        expect(globals).not.toMatch(/--source-report-[a-z-]+/);
        expect(
            collectExactCssRuleBlocks(
                globals,
                "[data-sot-source-report-state]",
            ),
        ).toEqual([]);
        expect(sourceReportStyles).toContain("SOURCE_REPORT_STATE_CLASS_NAME");
        expect(sourceReport).toContain("@/features/source-report/styles");
        expect(sourceReportStyles).toContain("SOURCE_REPORT_SKELETON_CLASS_NAME");
        expect(sourceReport).toContain("SOURCE_REPORT_CARD_SKELETON_CLASS_NAMES");
        expect(sourceReport).toContain(
            "SOURCE_REPORT_SEGMENT_SKELETON_CLASS_NAMES",
        );
        expect(sourceReport).toContain("SOURCE_REPORT_STYLE_VARIABLES");
        expect(
            sourceReport.match(/style=\{SOURCE_REPORT_STYLE_VARIABLES\}/g) ??
                [],
        ).toHaveLength(3);
        expect(sourceReport).toContain(
            'data-sot-panel="recording-source-report-state"',
        );
        expect(sourceReport).toContain('sotState="loading"');
        expect(sourceReport).toContain('state="loaded"');
        expect(sourceReport).toContain("subState={sourceReportSubState}");
        expect(sourceReport).toContain("data-sot-source-report-section-title");
        expect(sourceReport).toContain('title="来源转写"');
        expect(sourceReport).toContain('title="来源信息"');
        expect(sourceReport).toContain(
            'data-sot-control="copy-source-transcript"',
        );
        expect(sourceReport).toContain('data-sot-control="copy-source-report"');
        expect(sourceReport).toContain(
            'aria-busy={copyingKey === "source-transcript"}',
        );
        expect(sourceReport).toContain(
            'aria-busy={copyingKey === "source-report"}',
        );
        expect(sourceReport).toContain("activeReportRequestRef");
        expect(sourceReport).toContain("AbortController");
        expect(sourceReport).toContain("reportRequestIdRef");
        expect(sourceReport).toContain("sourceReportDetailText");
        expect(sourceReport).toContain("sourceReportDisplaySegments");
        expect(sourceReport).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(sourceReport).toContain(
            'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
        );
        expect(sourceReport).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        const sourceReportLoadingMetrics = extractBoundedSlice(
            sourceReport,
            "isLoading && !data && !error ? (",
            "</SourceReportMetricCards>\n                    <SourceReportSection",
        );
        expectSourceReportMetricCallsites(
            sourceReportLoadingMetrics,
            "SourceReportMetricCard",
            RECORDING_SOURCE_REPORT_LOADING_METRIC_CARDS,
        );
        const sourceReportLoadedMetrics = extractBoundedSlice(
            sourceReport,
            "{data && (",
            "</SourceReportMetricCards>\n\n                    <SourceReportSection",
        );
        expectSourceReportMetricCallsites(
            sourceReportLoadedMetrics,
            "SourceReportMetricCard",
            RECORDING_SOURCE_REPORT_LOADED_METRIC_CARDS,
        );
        expect(cardPrimitive).not.toContain("sourceReportMetric:");
        expect(sourceReportStyles).toContain(
            "export const SOURCE_REPORT_METRIC_CARD_CLASS_NAME =",
        );
        const sourceReportMetricCard = extractOpeningElement(
            sourceReport,
            'data-sot-card="source-report-metric"',
            "Card",
        );
        const sourceReportMetricCardBlock = extractCardSlice(
            sourceReport,
            'data-sot-card="source-report-metric"',
        );
        expect(sourceReportMetricCard).toContain("hasNoPadding");
        expect(sourceReportMetricCard).toContain(
            "className={SOURCE_REPORT_METRIC_CARD_CLASS_NAME}",
        );
        expect(sourceReportMetricCard).toContain(
            'data-sot-card="source-report-metric"',
        );
        expect(sourceReportMetricCard).toContain("data-sot-metric={metric}");
        expect(sourceReportMetricCardBlock).not.toContain(
            'variant="sourceReportMetric"',
        );
        const sourceReportMetricCardClassName =
            expectExactStringConstInitializer(
                sourceReportStyles,
                "SOURCE_REPORT_METRIC_CARD_CLASS_NAME",
                EXPECTED_SOURCE_REPORT_METRIC_CARD_CLASS_NAME,
            );
        for (const token of SOURCE_REPORT_METRIC_CARD_CLASS_TOKENS) {
            expect(sourceReportMetricCardClassName).toContain(token);
        }
        expect(sourceReport).not.toContain('variant="sourceReportMetric"');
        const sourceReportErrorState = extractBoundedSlice(
            sourceReport,
            '<SourceReportState sotState="error" state="error" error={error}>',
            "</SourceReportState>",
        );
        const sourceReportErrorIcon = extractOpeningElement(
            sourceReportErrorState,
            "data-sot-source-report-empty-icon",
            "EmptyMedia",
        );
        for (const sourceReportErrorIconOwnerClassSnippet of [
            "SOURCE_REPORT_EMPTY_ICON_CLASS_NAME",
            "SOURCE_REPORT_EMPTY_ERROR_ICON_CLASS_NAME",
        ] as const) {
            expect(sourceReportErrorIcon).toContain(
                sourceReportErrorIconOwnerClassSnippet,
            );
        }
        for (const sourceReportEmptyIconStyleSnippet of [
            "mb-1",
            "inline-grid",
            "size-10",
            "place-items-center",
            "border-[var(--line-hairline)]",
            "text-[var(--fg-tertiary)]",
            "[&_svg:not([class*='size-'])]:size-4",
            "border-[color-mix(in_srgb,var(--signal-danger)_28%,transparent)]",
            "bg-[color-mix(in_srgb,var(--signal-danger)_14%,transparent)]",
            "text-[var(--signal-danger)]",
        ] as const) {
            expect(sourceReportStyles).toContain(
                sourceReportEmptyIconStyleSnippet,
            );
        }
        expect(sourceReport).not.toContain(
            "SOURCE_REPORT_ERROR_ICON_CLASS_NAME",
        );
        expect(sourceReport).not.toContain('variant="sourceReportErrorIcon"');
        expect(sourceReportErrorState).toContain("<EmptyMedia");
        expect(sourceReportErrorState).toContain('variant="statusError"');
        expect(sourceReportErrorState).toContain(
            "SOURCE_REPORT_ERROR_ALERT_CLASS_NAME",
        );
        expect(sourceReportErrorState).toContain(
            "SOURCE_REPORT_EMPTY_SURFACE_CLASS_NAME",
        );
        expect(sourceReport).toContain("SOURCE_REPORT_ERROR_ALERT_CLASS_NAME");
        expect(sourceReport).not.toContain('variant="sourceReportError"');
        expect(sourceReport).not.toContain('density="sourceReportError"');
        expect(sourceReport).not.toContain('layout="sourceReportError"');
        expect(sourceReportErrorState).toContain(
            "data-sot-source-report-empty",
        );
        expect(sourceReportErrorState).toContain('data-sot-tone="err"');
        expect(sourceReportErrorIcon).toContain(
            "data-sot-source-report-empty-icon",
        );
        expect(sourceReportErrorIcon).toContain('aria-hidden="true"');
        expect(sourceReportErrorState).toContain("<SourceReportAlertGlyph />");
        expect(sourceReportErrorState).toContain("无法读取来源详情");
        expect(sourceReportErrorState).toContain("sourceProviderSentenceName");
        expect(sourceReportErrorState).toContain(
            "返回了一个错误，可能是网络抖动或来源临时不可用。",
        );
        expect(sourceReportErrorState).toContain("重试");
        expect(sourceReportErrorState).toContain("查看同步日志");
        expect(sourceReport).not.toContain(
            'className="flex flex-col items-center gap-2 px-4 py-8 text-center"',
        );
        expect(sourceReport).not.toContain(
            'className="flex size-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"',
        );
        expect(sourceReport).toContain("SOURCE_REPORT_STATUS_BADGE_CLASS_NAME");
        expect(sourceReport).not.toContain(variantAttr("sourceReportStatus"));
        for (const primitiveSource of sourceReportPrimitiveSources) {
            expect(primitiveSource).not.toMatch(
                /\bsourceReport[A-Za-z0-9_]*\b/,
            );
        }
        expect(emptyPrimitive).not.toContain("sourceReportErrorIcon");
        expect(emptyPrimitive).not.toContain(
            "SOURCE_REPORT_ERROR_ICON_CLASS_NAME",
        );
        expect(sourceReportStyles).toContain(
            '"ghost" satisfies ButtonProps["variant"]',
        );
        expect(sourceReportStyles).toContain('"sm" satisfies ButtonProps["size"]');
        for (const token of SOURCE_REPORT_SKELETON_SHARED_TOKENS) {
            expect(skeletonPrimitive).not.toContain(token);
        }
        for (const token of SOURCE_REPORT_SKELETON_OWNER_TOKENS) {
            expect(sourceReportStyles).toContain(token);
        }
        expect(sourceReport).not.toContain(
            "const sourceReportCardSkeletonClassNames",
        );
        expect(sourceReport).not.toContain(
            "const sourceReportSegmentSkeletonClassNames",
        );
        const sourceReportCardSkeleton = extractOpeningElement(
            sourceReport,
            'data-sot-part="source-report-card-skeleton"',
            "Skeleton",
        );
        expect(sourceReportCardSkeleton).toContain('variant="default"');
        expect(sourceReportCardSkeleton).toContain('size="default"');
        expect(sourceReportCardSkeleton).toContain(
            "className={SOURCE_REPORT_CARD_SKELETON_CLASS_NAMES[size]}",
        );
        expect(sourceReportCardSkeleton).toContain('aria-hidden="true"');
        expect(sourceReportCardSkeleton).toContain("data-sot-size={size}");
        const sourceReportSegmentSkeleton = extractOpeningElement(
            sourceReport,
            'data-sot-part="source-report-segment-skeleton"',
            "Skeleton",
        );
        expect(sourceReportSegmentSkeleton).toContain('variant="default"');
        expect(sourceReportSegmentSkeleton).toContain('size="default"');
        expect(sourceReportSegmentSkeleton).toContain(
            "className={SOURCE_REPORT_SEGMENT_SKELETON_CLASS_NAMES[size]}",
        );
        expect(sourceReportSegmentSkeleton).toContain('aria-hidden="true"');
        expect(sourceReportSegmentSkeleton).toContain("data-sot-size={size}");
        expect(sourceReport).not.toContain('variant="sourceReportCard"');
        expect(sourceReport).not.toContain('variant="sourceReportSegment"');
        expect(sourceReport).not.toContain("sourceReportCardSkeletonSize");
        expect(sourceReport).not.toContain("sourceReportSegmentSkeletonSize");
        expect(sourceReport).not.toContain("SOURCE_REPORT_STATUS_BADGE_STYLE");
        expect(transcriptionSkeletons).toContain('variant="default"');
        expect(transcriptionSkeletons).toContain('size="default"');
        expect(transcriptionSkeletons).toContain(
            "className={transcriptionSkeletonClassNames[size]}",
        );
        expect(transcriptionSkeletons).toContain(
            "const transcriptionSkeletonClassNames",
        );
        expect(transcriptionSkeletons).toContain('action: "h-[26px] w-[72px]"');
        expect(transcriptionSkeletons).toContain(
            'description: "h-[13px] w-full max-w-[220px]"',
        );
        expect(transcriptionSkeletons).toContain(
            '"line-long": "h-[13px] w-[92%]"',
        );
        expect(transcriptionSkeletons).toContain(
            '"field-control": "h-[13px] w-[132px]"',
        );
        expect(skeletonPrimitive).toContain(
            '"animate-pulse rounded-md bg-accent"',
        );
        for (const removedRecordingTranscriptionPrimitiveToken of [
            "recordingTranscription:",
            "recordingTranscriptionAction",
            "recordingTranscriptionDescription",
            "recordingTranscriptionFieldControl",
            "recordingTranscriptionFieldLabel",
            "recordingTranscriptionLineLong",
            "recordingTranscriptionLineMedium",
            "recordingTranscriptionLineShort",
            "recordingTranscriptionSpeaker",
            "recordingTranscriptionStatus",
            "recordingTranscriptionTime",
            "recordingTranscriptionTitle",
        ]) {
            expect(skeletonPrimitive).not.toContain(
                removedRecordingTranscriptionPrimitiveToken,
            );
        }
        expect(transcriptionSkeletons).not.toContain("type SkeletonLineSize");
        expect(transcriptionSkeletons).not.toContain(
            "const skeletonLineClassNames",
        );
        expect(transcriptionSkeletons).not.toContain(
            "className={skeletonLineClassNames[size]}",
        );
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
        expect(sourceReportStyles).toContain(
            "SOURCE_REPORT_COPY_LABEL_CLASS_NAME",
        );
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-part="source-report-copy-label"]',
            ),
        ).toEqual([]);
        expect(sourceReportStyles).toContain(
            "[&_[data-sot-part=source-report-status-dot]]:inline-block",
        );
        expect(sourceReportStyles).toContain(
            "[&_[data-sot-part=source-report-status-dot]]:size-[5px]",
        );
        expect(sourceReportStyles).toContain(
            "[&_[data-sot-part=source-report-status-dot]]:rounded-full",
        );
        expect(sourceReportStyles).toContain(
            "[&_[data-sot-part=source-report-status-dot]]:bg-current",
        );
        for (const removedSourceReportStatusGlobalSelector of [
            '[data-sot-badge="source-report-status"]',
            '[data-sot-part="source-report-status-dot"]',
            '[data-sot-part="dashboard-source-report-status-dot"]',
        ]) {
            expect(
                collectCssRuleBlocks(
                    globals,
                    removedSourceReportStatusGlobalSelector,
                ),
            ).toEqual([]);
        }
        expect(sourceReportStyles).toContain(
            "SOURCE_REPORT_SEGMENT_TIME_CLASS_NAME",
        );
        expect(sourceReportStyles).toContain(
            "SOURCE_REPORT_META_MONO_VALUE_CLASS_NAME",
        );
        expect(sourceReport).toContain("data-sot-source-report-state");
        expect(sourceReport).toContain("data-sot-source-report-empty");
        expect(sourceReport).toContain("data-sot-source-report-section");
        expect(sourceReport).toContain("data-sot-source-report-segment");
        expect(sourceReport).toContain("data-sot-source-report-meta");
        expect(sourceReport).not.toContain('className="sr-state"');
        expect(sourceReport).not.toContain('className="sr-empty"');
        expect(sourceReport).not.toContain('className="sr-section"');
        expect(sourceReport).not.toContain('className="sr-seg"');
        expect(sourceReport).not.toContain('className="sr-meta"');
        expect(sourceReport).not.toContain('className="copy-label"');
        expect(sourceReport).not.toContain('className="dot"');
        expect(sourceReport).not.toContain('className="mono"');
        expect(sourceReport).not.toContain('data-sot-panel="source-actions"');
        expect(sourceReport).not.toMatch(/\bSOURCE_REPORT_METRIC_CARD_CLASS\b/);
        for (const legacySourceReportPrimitiveClass of [
            "SOURCE_REPORT_STATUS_BADGE_TONE_CLASS",
            "sourceReportStatusBadgeVariant",
        ]) {
            expect(sourceReport).not.toContain(
                legacySourceReportPrimitiveClass,
            );
        }
        expect(sourceReport).not.toMatch(/\bSOURCE_REPORT_STATUS_BADGE_CLASS\s*=/);
        for (const control of sourceReportButtonControls) {
            const controlIndex = sourceReport.indexOf(control);
            expect(controlIndex).toBeGreaterThanOrEqual(0);
            const controlSource = sourceReport.slice(
                Math.max(0, controlIndex - 900),
                controlIndex + 320,
            );
            expect(controlSource).toContain("<Button");
            if (sourceReportCopyControls.includes(control)) {
                expect(controlSource).toContain(
                    "variant={SOURCE_REPORT_COPY_BUTTON_VARIANT}",
                );
                expect(controlSource).toContain(
                    "size={SOURCE_REPORT_COPY_BUTTON_SIZE}",
                );
                expect(controlSource).not.toContain('variant="ghost"');
                expect(controlSource).not.toContain('variant="secondary"');
                expect(controlSource).not.toContain('variant="destructive"');
                expect(controlSource).not.toContain('size="sm"');
            } else {
                expect(controlSource).toContain('size="xs"');
                expect(controlSource).toMatch(/variant="(?:outline|ghost)"/);
                expect(controlSource).toMatch(
                    /SOURCE_REPORT_(?:ACTION|GHOST_ACTION)_BUTTON_CLASS_NAME/,
                );
                expect(controlSource).not.toMatch(
                    /variant="sourceReport(?:Ghost)?Action"/,
                );
                expect(controlSource).not.toContain(
                    'size="sourceReportAction"',
                );
            }
            expect(controlSource).toContain("data-sot-control=");
            expect(controlSource).not.toContain("copy-btn");
        }
        for (const control of sourceReportCopyControls) {
            const controlIndex = sourceReport.indexOf(control);
            expect(controlIndex).toBeGreaterThanOrEqual(0);
            const controlSource = sourceReport.slice(
                Math.max(0, controlIndex - 320),
                controlIndex + 320,
            );
            expect(controlSource).toContain("data-copy=");
            expect(controlSource).toContain("data-copy-state=");
        }
        expect(sourceReport).not.toContain('className="btn ghost btn-sm"');
        expect(sourceReport).not.toContain(
            'className="btn ghost btn-sm copy-btn"',
        );
        expect(sourceReport).not.toContain('className="copy-btn"');
        expect(sourceReport).toContain('data-icon="inline-start"');
        expect(sourceReport).not.toMatch(
            /\bCSSProperties\b|SOURCE_REPORT_LOADING_SKELETON_STYLES|style=\{(?!SOURCE_REPORT_STYLE_VARIABLES\})|sk _is|_is-/,
        );
        expect(sourceReport).not.toContain("JSON.stringify(data.detail");
    });

    it("keeps standalone recording detail on the SOT shell with panel-scoped copy actions", () => {
        const detailWorkstation = readSource(
            "features/recordings/workstation.tsx",
        );
        const globals = readSource("app/globals.css");
        const badge = readSource("components/ui/badge.tsx");
        const button = readSource("components/ui/button.tsx");
        const card = readSource("components/ui/card.tsx");
        const dropdownMenuPrimitive = readSource(
            "components/ui/dropdown-menu.tsx",
        );
        const input = readSource("components/ui/input.tsx");
        const listPanelIndex = detailWorkstation.indexOf(
            'data-sot-panel="recording-detail-list"',
        );
        const listPanelStart = detailWorkstation.lastIndexOf(
            "<Card",
            listPanelIndex,
        );
        const listPanelEnd = detailWorkstation.indexOf(
            "</Card>",
            listPanelStart,
        );
        const listPanel = detailWorkstation.slice(
            listPanelStart,
            listPanelEnd + "</Card>".length,
        );
        const headerPanelIndex = detailWorkstation.indexOf(
            'data-sot-panel="recording-detail-header"',
        );
        const headerStart = detailWorkstation.lastIndexOf(
            "<RecordingDetailCardHeader",
            headerPanelIndex,
        );
        const headerEnd = detailWorkstation.indexOf(
            "</RecordingDetailCardHeader>",
            headerStart,
        );
        const detailHeader = detailWorkstation.slice(
            headerStart,
            headerEnd + "</RecordingDetailCardHeader>".length,
        );
        const legacyHeaderClassNamePattern =
            /className=(?:"[^"]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^"]*"|\{[^}]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^}]*\})/;
        const detailBackControlIndex = detailWorkstation.indexOf(
            'data-sot-control="recording-detail-back"',
        );
        const detailBackControlStart = detailWorkstation.lastIndexOf(
            "<Button",
            detailBackControlIndex,
        );
        const detailBackControlEnd = detailWorkstation.indexOf(
            "</Button>",
            detailBackControlIndex,
        );
        const detailBackControl = detailWorkstation.slice(
            detailBackControlStart,
            detailBackControlEnd + "</Button>".length,
        );

        expect(detailWorkstation).toContain(
            'data-sot-surface="recording-workstation"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-shell="recording-workstation"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-state={hydrated ? "ready" : "loading"}',
        );
        expect(detailWorkstation).toContain(
            'data-sot-panel="workstation-sidebar"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-panel="workstation-main"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-panel="workstation-topbar"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-panel="workstation-workspace"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-panel="recording-workstation-detail"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-panel="recording-workstation-detail-body"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-list="recording-detail-nav"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-control="recording-detail-back"',
        );
        expect(detailBackControlIndex).toBeGreaterThanOrEqual(0);
        expect(detailBackControlStart).toBeGreaterThanOrEqual(0);
        expect(detailBackControlEnd).toBeGreaterThan(detailBackControlStart);
        expect(button).not.toContain("recordingDetailBack:");
        expect(detailBackControl).toContain('variant="ghost"');
        expect(detailBackControl).toContain('size="default"');
        expect(detailBackControl).toContain(
            "recordingWorkstationButtonClassNames.detailBack",
        );
        expect(detailBackControl).not.toContain(
            'variant="recordingDetailBack"',
        );
        expect(detailBackControl).not.toContain('size="recordingDetailBack"');
        expect(detailBackControl).toContain(
            'navigateBrowserRoute(router, "/dashboard")',
        );
        expect(detailBackControl).toContain('data-sot-state="selected"');
        expect(detailBackControl).toContain("<ArrowLeft");
        expect(detailBackControl).toContain('data-icon="inline-start"');
        expect(detailBackControl).toContain('{t("recording.backToDashboard")}');
        expect(detailBackControl).not.toContain(
            'variant="recordingDetailBack"',
        );
        expect(detailWorkstation).toContain("[&_span]:truncate");
        expect(detailWorkstation).toContain("[&_svg]:stroke-[1.7]");
        expect(detailWorkstation).toContain("[&_svg]:opacity-[0.85]");
        expect(detailWorkstation).toContain(
            'className="flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3"',
        );
        expect(detailWorkstation).toContain(
            'className="px-2.5 pb-1.5 pt-3.5 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-tertiary)]"',
        );
        expect(detailWorkstation).toContain('data-sot-state="selected"');
        expect(globals).toContain('[data-sot-shell="recording-workstation"]');
        expect(globals).toContain('[data-sot-panel="workstation-sidebar"]');
        expect(globals).toContain('[data-sot-panel="workstation-main"]');
        expect(globals).toContain('[data-sot-panel="workstation-topbar"]');
        expect(globals).toContain('[data-sot-panel="workstation-workspace"]');
        expect(globals).toContain(
            '[data-sot-panel="recording-workstation-detail"]',
        );
        expect(globals).not.toContain(
            '[data-sot-control="recording-detail-back"][data-slot="button"]',
        );
        expect(detailWorkstation).not.toContain('className="app"');
        expect(detailWorkstation).not.toContain(
            'className="sidebar glass glass-strong"',
        );
        expect(detailWorkstation).not.toContain('className="topbar"');
        expect(detailWorkstation).not.toContain('className="workspace"');
        expect(detailWorkstation).not.toContain('className="detail"');
        expect(detailWorkstation).not.toContain('className="brand"');
        expect(detailWorkstation).not.toContain('className="brand-text"');
        expect(detailWorkstation).not.toContain('className="brand-name"');
        expect(detailWorkstation).not.toContain('className="brand-sub"');
        expect(detailWorkstation).not.toContain('className="nav"');
        expect(detailWorkstation).not.toContain(
            'className="nav-section-label"',
        );
        expect(detailWorkstation).not.toContain(
            'className="nav-item is-selected"',
        );
        expect(detailWorkstation).not.toContain('className="crumbs"');
        expect(detailWorkstation).not.toContain('className="crumb"');
        expect(detailWorkstation).not.toContain('className="crumb-sep"');
        expect(detailWorkstation).not.toContain('className="crumb-current"');
        expect(detailWorkstation).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(detailWorkstation).toContain(
            'import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";',
        );
        expect(detailWorkstation).toContain(
            'import { Input } from "@/components/ui/input";',
        );
        expect(badge).toContain('data-slot="badge"');
        expect(card).toContain('data-slot="card-header"');
        expect(card).toContain('data-slot="card-title"');
        expect(input).toContain('data-slot="input"');
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
        expect(listPanel).toContain('className="flex flex-col gap-0.5 p-1"');
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
        for (const selector of RECORDING_DETAIL_NAV_AND_ROW_REMOVED_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of RECORDING_SOURCE_RECORD_LAYOUT_REMOVED_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(headerPanelIndex).toBeGreaterThanOrEqual(0);
        expect(headerStart).toBeGreaterThanOrEqual(0);
        expect(headerEnd).toBeGreaterThan(headerStart);
        expect(detailHeader).toContain("<RecordingDetailCardHeader");
        expect(detailHeader).toContain("<RecordingDetailCardTitle");
        expect(detailHeader).toContain("<Badge");
        expect(detailHeader).toContain(
            'data-sot-panel="recording-detail-header"',
        );
        expect(detailHeader).toContain('data-sot-part="detail-header-title"');
        expect(detailHeader).toContain(
            'data-sot-part="detail-header-title-input"',
        );
        expect(detailHeader).toContain(
            'data-sot-part="detail-header-title-status"',
        );
        expect(detailHeader).toContain('data-sot-part="detail-header-action"');
        expect(detailHeader).toContain("data-rh-title");
        expect(detailHeader).toContain("data-rh-input");
        expect(detailHeader).toContain("data-rh-status");
        expect(detailHeader).toContain("data-rh-edit-start");
        expect(detailHeader).toContain("data-rh-edit-save");
        expect(detailHeader).toContain("data-rh-edit-cancel");
        expect(detailHeader).toContain("data-rh-ai-anchor");
        expect(detailHeader).toContain("data-rh-ai-trigger");
        expect(detailHeader).toContain('data-sot-control="ai-rename"');
        expect(detailWorkstation).toContain(
            "const recordingDetailHeaderState = isSavingRename",
        );
        expect(detailWorkstation).toContain(
            "const RECORDING_DETAIL_HEADER_CLASS_NAME",
        );
        expect(detailWorkstation).toContain(
            "const RECORDING_DETAIL_HEADER_TITLE_CLASS_NAME",
        );
        expect(detailWorkstation).toContain(
            "const RECORDING_DETAIL_HEADER_LOCAL_BADGE_CLASS_NAME",
        );
        expect(detailWorkstation).toContain(
            "const RECORDING_DETAIL_HEADER_STATUS_BADGE_CLASS_NAME",
        );
        expect(detailWorkstation).toContain(
            "function RecordingDetailCardHeader",
        );
        expect(detailWorkstation).toContain(
            "function RecordingDetailCardTitle",
        );
        expect(detailWorkstation).toContain(
            "cn(RECORDING_DETAIL_HEADER_CLASS_NAME",
        );
        expect(detailWorkstation).toContain(
            "cn(RECORDING_DETAIL_HEADER_TITLE_CLASS_NAME",
        );
        expect(detailHeader).toContain(
            "RECORDING_DETAIL_HEADER_LOCAL_BADGE_CLASS_NAME",
        );
        expect(detailHeader).toContain(
            "RECORDING_DETAIL_HEADER_STATUS_BADGE_CLASS_NAME",
        );
        for (const removedRecordingDetailVariant of [
            "detailHeader",
            "detailHeaderTitle",
            "detailHeaderLocal",
            "detailHeaderStatus",
        ]) {
            expect(detailHeader).not.toContain(
                variantAttr(removedRecordingDetailVariant),
            );
        }
        expect(detailHeader).toContain('variant="ghost"');
        expect(detailHeader).toContain('size="icon-sm"');
        expect(detailHeader).toContain('variant="outline"');
        expect(detailHeader).toContain('size="sm"');
        expect(detailHeader).toContain(
            "recordingWorkstationButtonClassNames.headerIconButton",
        );
        expect(detailHeader).toContain(
            "recordingWorkstationButtonClassNames.headerActionButton",
        );
        expect(detailHeader).not.toContain('variant="detailHeaderIconAction"');
        expect(detailHeader).not.toContain('size="detailHeaderIconAction"');
        expect(detailHeader).not.toContain('variant="detailHeaderAction"');
        expect(detailHeader).not.toContain('size="detailHeaderAction"');
        expect(detailHeader).not.toContain('controlSize="detailHeaderTitle"');
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
        expect(detailHeader).not.toMatch(legacyHeaderClassNamePattern);
        expect(globals).not.toContain(
            '[data-sot-panel="recording-detail-header"]',
        );
        for (const selector of [
            '[data-sot-part="detail-header-title"][data-slot="card-title"]',
            '[data-sot-part="detail-header-title-input"][data-slot="input"]',
            '[data-sot-part="detail-header-title-status"]',
            '[data-sot-part="detail-header-local-badge"]',
            '[data-sot-part="detail-header-action"]',
            '[data-sot-part="detail-header-action-anchor"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
        const metadataPanelIndex = detailWorkstation.indexOf(
            'data-sot-panel="recording-detail-metadata"',
        );
        const metadataStart = detailWorkstation.lastIndexOf(
            "<Card",
            metadataPanelIndex,
        );
        const metadataEnd = detailWorkstation.indexOf("</Card>", metadataStart);
        const metadataPanel = detailWorkstation.slice(
            metadataStart,
            metadataEnd + "</Card>".length,
        );
        const sourceRecordPanelIndex = detailWorkstation.indexOf(
            'data-sot-panel="recording-source-record"',
        );
        const sourceRecordStart = detailWorkstation.lastIndexOf(
            "<Card",
            sourceRecordPanelIndex,
        );
        const sourceRecordEnd = detailWorkstation.indexOf(
            "</Card>",
            sourceRecordStart,
        );
        const sourceRecordPanel = detailWorkstation.slice(
            sourceRecordStart,
            sourceRecordEnd + "</Card>".length,
        );
        const sourceRecordShellOpening = extractOpeningElement(
            detailWorkstation,
            'data-sot-part="recording-source-record-shell"',
            "section",
        );
        const sourceRecordActionsOpening = extractOpeningElement(
            sourceRecordPanel,
            'data-sot-part="recording-source-record-actions"',
            "div",
        );
        const sourceRecordTabsOpening = extractOpeningElement(
            sourceRecordPanel,
            'data-sot-part="recording-source-record-tabs"',
            "div",
        );
        const sourceRecordHintOpening = extractOpeningElement(
            sourceRecordPanel,
            'data-sot-part="recording-source-record-hint"',
            "FieldDescription",
        );
        const sourceRecordPaneOpening = extractOpeningElement(
            detailWorkstation,
            'data-sot-part="recording-source-record-pane"',
            "div",
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
        expect(sourceRecordShellOpening).toContain(
            'className="flex min-h-0 flex-col gap-4"',
        );
        expect(sourceRecordActionsOpening).toContain(
            'className="ml-auto flex max-w-full grow-0 shrink basis-auto flex-wrap items-center gap-2"',
        );
        expect(sourceRecordTabsOpening).toContain('className="flex min-w-0"');
        expect(sourceRecordHintOpening).toContain('className="m-0"');
        expect(sourceRecordPaneOpening).toContain('className="min-h-0"');
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
        expect(detailWorkstation).toContain(
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
        expect(detailWorkstation).not.toContain('className="detail-empty"');
        expect(detailWorkstation).toContain("handleCopyLocalTranscript");
        expect(detailWorkstation).toContain("handleCopyRawTranscript");
        expect(detailWorkstation).toContain("/transcript/raw");
        expect(detailWorkstation).toContain("RawTranscriptCopyPayload");
        expect(detailWorkstation).toContain("localTranscriptCopyText");
        expect(detailWorkstation).toContain("setSourceReportAvailability");
        expect(detailWorkstation).toContain("applySpeakerMap");
        expect(detailWorkstation).toContain("<SourceReportPanel");
        expect(detailWorkstation).toContain("onAvailabilityChange");
        expect(detailWorkstation).toContain("autoLoad");
        expect(button).not.toContain("sourceRecordCopyAction:");
        expect(button).not.toContain('variant="sourceRecordCopyAction"');
        expect(button).not.toContain('size="sourceRecordCopyAction"');
        expect(detailWorkstation).toContain(
            'data-sot-part="recording-source-record-actions"',
        );
        expect(detailWorkstation).not.toContain('className="t-actions"');
        expect(sourceRecordPanel).toContain("handleCopyLocalTranscript");
        expect(sourceRecordPanel).toContain("handleCopyRawTranscript");
        expect(sourceRecordPanel).toContain("!localTranscriptCopyText.trim()");
        expect(sourceRecordPanel).toContain("!transcription?.text?.trim()");
        expect(sourceRecordPanel).toContain('t("common.copying")');
        expect(sourceRecordPanel).toMatch(
            /t\(\s*"transcription\.copyTranscript",?\s*\)/,
        );
        expect(sourceRecordPanel).toMatch(
            /t\(\s*"speakerReview\.copyRawTranscript",?\s*\)/,
        );
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
            expect(copyButtonSource).toContain('variant="outline"');
            expect(copyButtonSource).toContain('size="sm"');
            expect(copyButtonSource).not.toContain(
                'variant="sourceRecordCopyAction"',
            );
            expect(copyButtonSource).not.toContain(
                'size="sourceRecordCopyAction"',
            );
            expect(copyButtonSource).toContain(
                '<Copy data-icon="inline-start" />',
            );
        }
        expect(detailWorkstation).toMatch(
            /aria-busy=\{\s*copyingAction ===\s*"local"\s*\}/,
        );
        expect(detailWorkstation).toMatch(
            /aria-busy=\{\s*copyingAction ===\s*"raw-transcript"\s*\}/,
        );
        expect(detailWorkstation).not.toContain("handleCopySourceMaterial");
        expect(detailWorkstation).not.toContain(
            "buildSourceTranscriptCopyText",
        );
        expect(detailWorkstation).not.toContain("sourceTranscriptCopyDisabled");
        expect(detailWorkstation).not.toContain("sourceReportCopyDisabled");
        expect(detailWorkstation).not.toContain(
            'aria-busy={copyingAction === "source-transcript"}',
        );
        expect(detailWorkstation).not.toContain(
            'aria-busy={copyingAction === "source-report"}',
        );
        expect(detailWorkstation).not.toContain("container mx-auto max-w-4xl");
        expect(detailWorkstation).not.toContain("recording-detail-actions");
        expect(detailWorkstation).not.toContain(">←<");
        expect(detailWorkstation).toContain("data-rename-mode=");
        expect(detailWorkstation).toContain(
            'localDeleteAvailable ? "true" : "false"',
        );
        expect(detailWorkstation).toContain("data-more-anchor");
        expect(detailWorkstation).toContain("data-more-trigger");
        expect(detailWorkstation).toContain(
            'from "@/components/ui/dropdown-menu"',
        );
        expect(detailWorkstation).toContain("<DropdownMenu");
        expect(detailWorkstation).toContain("open={moreOpen}");
        expect(detailWorkstation).toContain("<DropdownMenuTrigger asChild>");
        expect(detailWorkstation).toContain("<DropdownMenuContent");
        expect(detailWorkstation).toContain("data-more-menu");
        expect(detailWorkstation).toContain(
            'data-sot-menu="recording-more-actions"',
        );
        expect(detailWorkstation).toContain('data-sot-menu-item="rename"');
        expect(detailWorkstation).toContain('data-sot-menu-item="ai-rename"');
        expect(detailWorkstation).toContain(
            'data-sot-menu-item="retranscribe"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-menu-item="delete-local"',
        );
        expect(detailWorkstation).toContain('data-sot-tone="danger"');
        expect(detailWorkstation).toContain("<DropdownMenuSeparator");
        expect(detailWorkstation).toContain('data-sot-menu-separator="delete"');
        expect(detailWorkstation).toContain("data-sot-menu-hint");
        for (const selector of MORE_ACTIONS_MENU_RETIRED_GLOBALS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const compositionToken of MORE_ACTIONS_MENU_COMPOSITION_TOKENS) {
            expect(detailWorkstation).toContain(compositionToken);
        }
        expect(dropdownMenuPrimitive).toContain("dropdownMenuContentVariants");
        expect(dropdownMenuPrimitive).toContain("dropdownMenuItemDensities");
        expect(dropdownMenuPrimitive).toContain("dropdownMenuShortcutVariants");
        expect(detailWorkstation).not.toContain('className="more-menu"');
        expect(detailWorkstation).not.toContain('className="more-menu-item"');
        expect(detailWorkstation).not.toContain('className="more-menu-sep"');
        expect(detailWorkstation).not.toContain('className="more-menu-hint"');
        expect(detailWorkstation).toContain("handleMoreRetranscribe");
        expect(detailWorkstation).toContain("handleDeleteLocalRecording");
        expect(detailWorkstation).toContain("SotPlayerSourceTag");
        expect(detailWorkstation).toContain("SotPlayerStatusBadge");
        expect(detailWorkstation).toContain("<SotPlayerSourceTag");
        expect(detailWorkstation).toContain("<SotPlayerStatusBadge");
        expect(detailWorkstation).not.toContain('className="src-tag"');
        expect(detailWorkstation).not.toContain('className="b ok"');
        expect(detailWorkstation).not.toMatch(OLD_UI_CONTRACT_RE);

        const sourceLabelMarker = "{sourceLabel}";
        const sourceBlockMarker = '{t("recording.source")}';
        const sourceBlockMarkerIndex =
            detailWorkstation.indexOf(sourceBlockMarker);
        const sourceLabelMarkerIndex = detailWorkstation.indexOf(
            sourceLabelMarker,
            sourceBlockMarkerIndex,
        );
        expect(sourceBlockMarkerIndex).toBeGreaterThan(-1);
        expect(sourceLabelMarkerIndex).toBeGreaterThan(sourceBlockMarkerIndex);
        expect(detailWorkstation).toContain("getSourceProviderLabel(");
        expect(detailWorkstation).toContain(sourceLabelMarker);

        const deviceLabelMarker = '{t("recording.device")}';
        const deviceValueMarker = "{recording.providerDeviceId}";
        expect(detailWorkstation).toContain(deviceLabelMarker);
        expect(detailWorkstation).toContain(deviceValueMarker);
    });

    it("keeps dashboard transcription panel on SOT retx and detail tabs", () => {
        const dashboardTranscript = readSource(
            "features/dashboard/workstation.tsx",
        );
        const badge = readSource("components/ui/badge.tsx");
        const button = readSource("components/ui/button.tsx");
        const card = readSource("components/ui/card.tsx");
        const input = readSource("components/ui/input.tsx");
        const globals = readSource("app/globals.css");
        const sourceReportStyles = readSource(
            "features/source-report/styles.ts",
        );
        const dashboardTranscriptShell = extractCardSlice(
            dashboardTranscript,
            'data-sot-panel="dashboard-transcript-shell"',
        );
        const dashboardTranscriptLoadingTurn = extractBoundedSlice(
            dashboardTranscript,
            "TRANSCRIPT_LOADING_SKELETON_ROWS.map",
            ") : turns.length ? (",
        );
        const dashboardTranscriptReadyTurn = extractBoundedSlice(
            dashboardTranscript,
            "turns.map((turn, index) => {",
            ") : (",
        );
        const headerPanelIndex = dashboardTranscript.indexOf(
            'data-sot-panel="dashboard-detail-header"',
        );
        const headerStart = dashboardTranscript.lastIndexOf(
            "<CardHeader",
            headerPanelIndex,
        );
        const headerEnd = dashboardTranscript.indexOf(
            "</CardHeader>",
            headerStart,
        );
        const dashboardDetailHeader = dashboardTranscript.slice(
            headerStart,
            headerEnd + "</CardHeader>".length,
        );
        const legacyHeaderClassNamePattern =
            /className=(?:"[^"]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^"]*"|\{[^}]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^}]*\})/;

        expect(headerPanelIndex).toBeGreaterThanOrEqual(0);
        expect(headerStart).toBeGreaterThanOrEqual(0);
        expect(headerEnd).toBeGreaterThan(headerStart);
        expect(dashboardTranscript).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(dashboardTranscript).toContain(
            'import { Input } from "@/components/ui/input";',
        );
        expect(badge).toContain('data-slot="badge"');
        expect(button).not.toContain("detailHeaderIconAction:");
        expect(button).not.toContain("detailHeaderAction:");
        expect(dashboardTranscript).toContain("headerIconButton:");
        expect(dashboardTranscript).toContain("headerActionButton:");
        expect(dashboardTranscript).toContain("size-[32px]");
        expect(card).toContain('data-slot="card-header"');
        expect(card).toContain('data-slot="card-title"');
        expect(input).toContain('data-slot="input"');
        expect(dashboardDetailHeader).toContain(
            'data-sot-panel="dashboard-detail-header"',
        );
        expect(dashboardDetailHeader).toContain("<CardHeader");
        expect(dashboardDetailHeader).toContain("<CardTitle");
        expect(dashboardDetailHeader).toContain("<Badge");
        expect(dashboardDetailHeader).toContain("data-rename-mode");
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-title-input"',
        );
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-action"',
        );
        expect(dashboardDetailHeader).toContain("data-rh-edit-start");
        expect(dashboardDetailHeader).toContain("data-rh-edit-save");
        expect(dashboardDetailHeader).toContain("data-rh-edit-cancel");
        expect(dashboardDetailHeader).toContain("data-rh-ai-anchor");
        expect(dashboardDetailHeader).toContain("data-rh-ai-trigger");
        expect(dashboardTranscript).toContain(
            "const dashboardDetailHeaderState = renaming",
        );
        expect(dashboardTranscript).toContain(
            "const dashboardDetailHeaderMode = editingTitle",
        );
        expect(dashboardTranscript).toContain(
            "const SOT_DASHBOARD_DETAIL_HEADER_CLASS_NAME",
        );
        expect(dashboardTranscript).toContain(
            "const SOT_DASHBOARD_DETAIL_HEADER_TITLE_CLASS_NAME",
        );
        expect(dashboardTranscript).toContain(
            "const SOT_DASHBOARD_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME",
        );
        expect(dashboardTranscript).toContain(
            "const SOT_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME",
        );
        expect(dashboardDetailHeader).toContain(
            "className={SOT_DASHBOARD_DETAIL_HEADER_CLASS_NAME}",
        );
        expect(dashboardDetailHeader).toContain(
            "SOT_DASHBOARD_DETAIL_HEADER_TITLE_CLASS_NAME",
        );
        expect(dashboardDetailHeader).toContain(
            "SOT_DASHBOARD_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME",
        );
        expect(dashboardDetailHeader).toContain(
            "SOT_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME",
        );
        for (const retiredDashboardDetailVariant of [
            "detailHeader",
            "detailHeaderTitle",
            "detailHeaderLocal",
            "detailHeaderStatus",
        ]) {
            expect(dashboardDetailHeader).not.toContain(
                variantAttr(retiredDashboardDetailVariant),
            );
        }
        expect(dashboardDetailHeader).toContain('variant="ghost"');
        expect(dashboardDetailHeader).toContain('size="icon-sm"');
        expect(dashboardDetailHeader).toContain('variant="outline"');
        expect(dashboardDetailHeader).toContain('size="sm"');
        expect(dashboardDetailHeader).toContain(
            "dashboardButtonClassNames.headerIconButton",
        );
        expect(dashboardDetailHeader).toContain(
            "dashboardButtonClassNames.headerActionButton",
        );
        expect(dashboardDetailHeader).not.toContain(
            'variant="detailHeaderIconAction"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'size="detailHeaderIconAction"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'variant="detailHeaderAction"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'size="detailHeaderAction"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'controlSize="detailHeaderTitle"',
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
        expect(dashboardTranscript).toContain(
            'data-sot-panel="dashboard-retranscription"',
        );
        expect(dashboardTranscript).toContain(
            "data-retx-state={dashboardRetxState}",
        );
        expect(dashboardTranscriptShell).toContain("<Card");
        expect(dashboardTranscriptShell).toContain("hasNoPadding");
        expect(dashboardTranscript).toContain(
            "const SOT_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME",
        );
        expectExactStringConstInitializer(
            dashboardTranscript,
            "SOT_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME",
            EXPECTED_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME,
        );
        expect(dashboardTranscriptShell).toContain(
            "SOT_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME",
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-panel="dashboard-transcript-shell"',
        );
        expect(dashboardTranscriptShell).toContain("<CardHeader");
        expect(dashboardTranscriptShell).toContain("<CardContent");
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-header"',
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-actions"',
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-body"',
        );
        for (const legacyClass of [
            'className="transcript"',
            'className="transcript-head"',
            'className="transcript-body"',
        ]) {
            expect(dashboardTranscriptShell).not.toContain(legacyClass);
        }
        expect(dashboardTranscript).toContain("void retranscribe()");
        expect(dashboardTranscript).toContain('"transcript"');
        expect(dashboardTranscript).toContain('"source"');
        expect(dashboardTranscript).toContain('"speakers"');
        expect(dashboardTranscript).toContain('aria-label="详情标签"');
        expect(dashboardTranscript).toContain(
            '{ value: "transcript", label: "转写" }',
        );
        expect(dashboardTranscript).toContain('tabKey: "source-report"');
        expect(dashboardTranscript).toContain("function SotCopyIcon({ state }");
        expect(dashboardTranscript).toContain(
            'data-sot-part="dashboard-copy-icon"',
        );
        expectExactStringConstInitializer(
            dashboardTranscript,
            "SOT_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME",
            EXPECTED_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME,
        );
        const dashboardTranscriptActions = extractOpeningElement(
            dashboardTranscript,
            'data-sot-part="dashboard-transcript-actions"',
            "div",
        );
        expect(dashboardTranscriptActions).toMatch(
            /className=\{\s*SOT_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME\s*\}/,
        );
        const dashboardCopyIcon = extractOpeningElement(
            dashboardTranscript,
            'data-sot-part="dashboard-copy-icon"',
            "Icon",
        );
        expect(dashboardCopyIcon).toMatch(
            /className=\{\s*SOURCE_REPORT_COPY_ICON_CLASS_NAME\s*\}/,
        );
        const dashboardCopyLabel = extractOpeningElement(
            dashboardTranscript,
            'data-sot-part="dashboard-copy-label"',
            "span",
        );
        expect(dashboardCopyLabel).toMatch(
            /className=\{\s*SOURCE_REPORT_COPY_LABEL_CLASS_NAME\s*\}/,
        );
        expect(sourceReportStyles).toContain(
            "SOURCE_REPORT_COPY_LABEL_CLASS_NAME",
        );
        expect(sourceReportStyles).toContain(
            "SOURCE_REPORT_COPY_ICON_CLASS_NAME",
        );
        const dashboardButtonClassNames = extractBoundedSlice(
            dashboardTranscript,
            "const dashboardButtonClassNames = {",
            "} as const;",
        );
        expect(dashboardButtonClassNames).toMatch(
            /copy:\s*"[^"]*\[&\[hidden\]\]:hidden[^"]*"/,
        );
        expect(sourceReportStyles).toMatch(
            /export const SOURCE_REPORT_COPY_BUTTON_CLASS_NAME\s*=\s*"[^"]*\[&\[hidden\]\]:hidden[^"]*";/,
        );
        expect(dashboardTranscript).not.toContain(
            "const SOT_SOURCE_REPORT_COPY_BUTTON_CLASS_NAME",
        );
        for (const selector of DASHBOARD_COPY_ACTION_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(dashboardTranscript).not.toContain('className="copy-ico"');
        expect(dashboardTranscript).not.toContain("copy-ico-default");
        expect(dashboardTranscript).not.toContain("copy-ico-ok");
        expect(dashboardTranscript).toContain('data-copy="transcript"');
        expect(dashboardTranscript).toContain('data-copy="source-transcript"');
        expect(dashboardTranscript).toContain('data-copy="source-report"');
        expect(dashboardTranscript).toContain(
            'data-sot-control="copy-source-transcript"',
        );
        expect(dashboardTranscript).toContain(
            'data-sot-control="copy-source-report"',
        );
        expect(dashboardTranscript).toContain(
            'data-sot-control="open-source-record"',
        );
        expect(dashboardTranscript).toContain(
            'data-sot-control="repull-source"',
        );
        expect(dashboardTranscript).toContain('data-tab-pane="transcript"');
        expect(dashboardTranscript).toContain('data-tab-pane="speakers"');
        expect(dashboardTranscript).toContain('data-tab-pane="source-report"');
        expect(dashboardTranscriptLoadingTurn).toContain(
            'data-sot-item="dashboard-transcript-turn"',
        );
        expect(dashboardTranscriptLoadingTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-row"',
        );
        expect(dashboardTranscriptLoadingTurn).toContain(
            'data-sot-state="loading"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-item="dashboard-transcript-turn"',
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
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-format="mono"',
        );
        for (const localTurnSlice of [
            dashboardTranscriptLoadingTurn,
            dashboardTranscriptReadyTurn,
        ]) {
            expect(localTurnSlice).not.toContain('className="speaker"');
            expect(localTurnSlice).not.toContain('className="speaker-name"');
        }
        expect(dashboardTranscript).toContain(
            'data-sot-panel="dashboard-transcript-empty"',
        );
        expect(dashboardTranscript).toContain(
            'data-sot-part="dashboard-transcript-empty-icon"',
        );
        expect(dashboardTranscript).toContain(
            'data-sot-part="dashboard-transcript-empty-message"',
        );
        expect(dashboardTranscript).toContain(
            'data-sot-part="dashboard-transcript-empty-sub"',
        );
        for (const legacyClass of [
            'className="turn skel-turn"',
            'className="turn"',
            'className="ts mono"',
            'className="empty-state"',
            'className="empty-ico"',
            'className="empty-msg"',
            'className="empty-sub"',
        ]) {
            expect(dashboardTranscript).not.toContain(legacyClass);
        }
        expect(dashboardTranscript).not.toContain('className="empty-hint"');
        expect(dashboardTranscript).not.toContain('className="eh-t"');
        expect(dashboardTranscript).not.toContain('className="eh-h"');
        expect(dashboardTranscript).toContain('data-tab-scope="source-report"');
        expect(dashboardTranscript).toContain(
            'hidden={detailTab !== "source"}',
        );
        expect(dashboardTranscript).toContain(
            'hidden={detailTab !== "transcript"}',
        );
        expect(dashboardTranscript).not.toContain("<Copy />");
        expect(dashboardTranscriptShell).not.toMatch(
            /\bbg-(background|card|muted)\b/,
        );
        expect(dashboardTranscript).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps standalone recording route fallback states in the new shell", () => {
        const loading = readSource("app/(app)/recordings/[id]/loading.tsx");
        const notFound = readSource("app/(app)/recordings/[id]/not-found.tsx");
        const error = readSource("app/(app)/recordings/[id]/error.tsx");
        const cardPrimitive = readSource("components/ui/card.tsx");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const globals = readSource("app/globals.css");
        const routeChromeModule = readSource(
            "app/(app)/route-chrome.module.css",
        );
        const routeLoadingSurfaceClassName = extractBoundedSlice(
            loading,
            "const routeLoadingSurfaceClassName =",
            ";",
        );
        const recordingRouteFallbackShellClassName = extractBoundedSlice(
            loading,
            "const recordingRouteFallbackShellClassName =",
            ";",
        );
        const notFoundRouteFallbackClassNames = extractBoundedSlice(
            notFound,
            "const recordingRouteFallbackClassNames =",
            "} as const;",
        );
        const errorRouteFallbackClassNames = extractBoundedSlice(
            error,
            "const recordingRouteFallbackClassNames =",
            "} as const;",
        );
        const recordingRouteLoadingDetailCard = extractCardSlice(
            loading,
            'data-sot-panel="recording-route-loading-detail"',
        );
        const recordingRouteLoadingDetailCardOpening = extractOpeningElement(
            loading,
            'data-sot-panel="recording-route-loading-detail"',
            "Card",
        );

        for (const source of [loading, notFound, error]) {
            expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
            expect(source).toContain('data-sot-panel="route-sidebar"');
            expect(source).toContain('data-sot-panel="route-main"');
            expect(source).toContain('data-sot-panel="route-topbar"');
            expect(source).toContain('data-sot-part="route-crumbs"');
            expect(source).toContain('data-sot-part="route-crumb-current"');
            expect(source).toContain(
                'import routeChromeStyles from "../../route-chrome.module.css";',
            );
            expect(source).toContain("className={routeChromeStyles.sidebar}");
            expect(source).toContain("className={routeChromeStyles.main}");
            expect(source).toContain("className={routeChromeStyles.topbar}");
            expect(source).toContain("className={routeChromeStyles.crumbs}");
            expect(source).toContain(
                "className={routeChromeStyles.crumbCurrent}",
            );
            expect(source).not.toContain('className="app"');
            expect(source).not.toContain(
                'className="sidebar glass glass-strong"',
            );
            expect(source).not.toContain('className="main"');
            expect(source).not.toContain('className="topbar"');
            expect(source).not.toContain('className="brand"');
            expect(source).not.toContain('className="brand-name"');
            expect(source).not.toContain('className="brand-sub"');
            expect(source).not.toContain('className="crumbs"');
            expect(source).not.toContain('className="crumb-current"');
        }
        for (const source of [notFound, error]) {
            expect(source).toContain("BetterAINote");
            expect(source).toContain('href="/dashboard"');
            expect(source).toContain("返回工作台");
            expect(source).toContain('data-sot-panel="route-workspace"');
            expect(source).toContain("className={routeChromeStyles.brand}");
            expect(source).toContain("className={routeChromeStyles.brandName}");
            expect(source).toContain(
                "className={routeChromeStyles.brandSubtitle}",
            );
            expect(source).toContain("className={routeChromeStyles.workspace}");
            expect(source).toContain(
                'data-sot-panel="recording-route-empty-detail"',
            );
            expect(source).toContain('data-sot-panel="recording-route-empty"');
            expect(source).toContain(
                'data-sot-part="recording-route-empty-title"',
            );
            expect(source).toContain(
                'import { Button } from "@/components/ui/button";',
            );
            expect(source).toContain(
                "const recordingRouteFallbackClassNames =",
            );
            expect(source).toContain(
                "className={recordingRouteFallbackClassNames.shell}",
            );
            expect(source).toContain(
                "className={recordingRouteFallbackClassNames.emptyDetail}",
            );
            expect(source).toContain(
                "recordingRouteFallbackClassNames.emptyPanel",
            );
            expect(source).toContain(
                "recordingRouteFallbackClassNames.emptyIcon",
            );
            expect(source).toContain(
                "recordingRouteFallbackClassNames.emptyTitle",
            );
            expect(source).toContain(
                "recordingRouteFallbackClassNames.emptyDescription",
            );
            expect(source).not.toContain('data-detail-empty=""');
            expect(source).not.toContain('className="btn primary"');
            expect(source).not.toContain('className="btn ghost"');
            expect(source).not.toContain('className="detail-empty"');
            expect(source).not.toContain('className="detail-empty-ico"');
            expect(source).not.toContain('className="detail-empty-title"');
            expect(source).not.toContain('className="detail-empty-sub"');
            expect(source).not.toContain('className="workspace"');
            expect(source).not.toContain('className="detail"');
        }

        const notFoundPrimaryAction = extractBoundedSlice(
            notFound,
            'variant="default"',
            "</Button>",
        );
        expect(notFoundPrimaryAction).toContain('size="default"');
        expect(error).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(error).toContain("<Button");
        const errorPrimaryAction = extractBoundedSlice(
            error,
            'variant="default"',
            "</Button>",
        );
        const errorGhostAction = extractBoundedSlice(
            error,
            'variant="ghost"',
            "</Button>",
        );
        expect(errorPrimaryAction).toContain('size="default"');
        expect(errorGhostAction).toContain('size="default"');
        for (const source of [notFound, error]) {
            expect(source).not.toContain(
                'variant="recordingRoutePrimaryAction"',
            );
            expect(source).not.toContain('variant="recordingRouteGhostAction"');
            expect(source).not.toContain('size="recordingRouteAction"');
        }
        expect(error).toContain("onClick={reset}");
        expect(error).toContain("重试");
        expect(loading).toContain('aria-busy="true"');
        expect(loading).toContain(
            'import { Card } from "@/components/ui/card";',
        );
        expect(loading).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(loading).toContain("<Card");
        expect(routeLoadingSurfaceClassName).toContain(
            `"${ROUTE_LOADING_SURFACE_CLASS_VALUE}"`,
        );
        for (const token of ROUTE_LOADING_SURFACE_CLASS_TOKENS) {
            expect(routeLoadingSurfaceClassName).toContain(token);
        }
        expect(recordingRouteFallbackShellClassName).toContain(
            `"${RECORDING_ROUTE_FALLBACK_SHELL_CLASS_VALUE}"`,
        );
        expect(loading).toContain(
            "className={recordingRouteFallbackShellClassName}",
        );
        expect(recordingRouteLoadingDetailCard).toContain('variant="default"');
        expect(recordingRouteLoadingDetailCard).toContain("hasNoPadding");
        expect(recordingRouteLoadingDetailCard).not.toContain(
            'variant="routeLoadingSurface"',
        );
        expect(recordingRouteLoadingDetailCardOpening).toContain(
            "className={cn(",
        );
        expect(recordingRouteLoadingDetailCardOpening).toContain(
            "routeLoadingSurfaceClassName,",
        );
        expect(recordingRouteLoadingDetailCardOpening).toContain(
            '"flex min-h-0 flex-col gap-4"',
        );
        expect(loading).not.toContain('variant="routeLoadingSurface"');
        expect(cardPrimitive).not.toContain("routeLoadingSurface");
        for (const detailLoadingSize of [
            "recordingDetailLoadingAvatar",
            "recordingDetailLoadingBar",
            "recordingDetailLoadingBar60",
            "recordingDetailLoadingBar90",
        ]) {
            expect(skeletonPrimitive).not.toContain(detailLoadingSize);
            expect(loading).toContain(`${detailLoadingSize}:`);
            expect(loading).toContain(
                `recordingDetailLoadingSkeletonClassNames.${detailLoadingSize}`,
            );
            expect(loading).not.toContain(`size="${detailLoadingSize}"`);
        }
        expect(loading).toContain("<Skeleton");
        expect(loading).toContain('aria-hidden="true"');
        expect(loading).toContain(
            "const recordingDetailLoadingSkeletonClassNames",
        );
        expect(loading).toContain('variant="default"');
        expect(loading).toContain('size="default"');
        expect(loading).toContain("className={");
        expect(loading).toContain('data-sot-shell="recording-route-loading"');
        expect(loading).toContain(
            'data-sot-panel="recording-route-loading-detail"',
        );
        expect(loading).toContain('data-sot-panel="recording-detail-loading"');
        expect(notFound).toContain('data-sot-shell="recording-route-empty"');
        expect(error).toContain('data-sot-shell="recording-route-error"');
        for (const routeFallbackClassNames of [
            notFoundRouteFallbackClassNames,
            errorRouteFallbackClassNames,
        ]) {
            expect(routeFallbackClassNames).toContain(
                `shell: "${RECORDING_ROUTE_FALLBACK_SHELL_CLASS_VALUE}"`,
            );
            expect(routeFallbackClassNames).toContain(
                `emptyDetail:\n        "${RECORDING_ROUTE_EMPTY_DETAIL_CLASS_VALUE}"`,
            );
            expect(routeFallbackClassNames).toContain(
                `emptyPanel:\n        "${RECORDING_ROUTE_EMPTY_PANEL_CLASS_VALUE}"`,
            );
            expect(routeFallbackClassNames).toContain(
                `emptyIcon:\n        "${RECORDING_ROUTE_EMPTY_ICON_CLASS_VALUE}"`,
            );
            expect(routeFallbackClassNames).toContain(
                `emptyTitle: "${RECORDING_ROUTE_EMPTY_TITLE_CLASS_VALUE}"`,
            );
            expect(routeFallbackClassNames).toContain(
                `emptyDescription:\n        "${RECORDING_ROUTE_EMPTY_DESCRIPTION_CLASS_VALUE}"`,
            );
        }
        for (const selector of RECORDING_ROUTE_FALLBACK_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of ROUTE_CHROME_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(routeChromeModule).toContain(".sidebar");
        expect(routeChromeModule).toContain(".brand");
        expect(routeChromeModule).toContain(".main");
        expect(routeChromeModule).toContain(".workspace");
        expect(globals).toContain("[data-detail-empty]");
        expect(globals).toContain(
            '[data-sot-panel="dashboard-detail"][data-empty="true"] [data-detail-empty]',
        );
        for (const removedLoadingSelector of [
            '[data-sot-panel="recording-route-loading-detail"]',
            '[data-sot-panel="recording-list-loading"]',
            '[data-sot-panel="recording-detail-loading"]',
        ]) {
            expect(globals).not.toContain(removedLoadingSelector);
        }
        expect(loading).not.toContain('className="detail panel"');
        expect(loading).not.toContain('className="skel-detail"');
        expect(loading).not.toContain('className="sk sk-bar"');
    });

    it("keeps speaker review raw transcript copy available from the review toolbar", () => {
        const speakerReview = readSource(
            "features/recordings/components/speaker-label-editor.tsx",
        );

        expect(speakerReview).toContain("handleCopyRawTranscript");
        expect(speakerReview).toContain("speakerReview.copyRawTranscript");
        expect(speakerReview).toContain("speakerReview.rawTranscriptCopied");
        expect(speakerReview).toContain(
            "speakerReview.copyRawTranscriptFailed",
        );
        expect(speakerReview).toContain("!canCopyRawTranscript");
    });

    it("keeps standalone detail tabs and dashboard title actions wired to existing flows", () => {
        const detailWorkstation = readSource(
            "features/recordings/workstation.tsx",
        );
        const dashboardWorkstation = readSource(
            "features/dashboard/workstation.tsx",
        );
        const aiRenamePreview = readSource(
            "features/recordings/components/ai-rename-preview-card.tsx",
        );

        expect(detailWorkstation).toContain("SegmentedTabs");
        const sourceRecordSegmentedTabs = extractBoundedSlice(
            detailWorkstation,
            'data-sot-part="recording-source-record-tabs"',
            'data-sot-part="recording-source-record-hint"',
        );
        expect(sourceRecordSegmentedTabs).toContain('variant="segmented"');
        expect(sourceRecordSegmentedTabs).toContain('size="segmentedSm"');
        expect(sourceRecordSegmentedTabs).toContain(
            'data-sot-control="segmented-tabs"',
        );
        expect(sourceRecordSegmentedTabs).toContain('data-sot-size="sm"');
        expect(detailWorkstation).toContain('"source" | "local" | "speakers"');
        expect(detailWorkstation).toContain("showSpeakerReview={false}");
        expect(detailWorkstation).toContain("<SpeakerLabelEditor");
        expect(detailWorkstation).toContain("/rename/auto");
        expect(detailWorkstation).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(detailWorkstation).not.toMatch(OLD_UI_CONTRACT_RE);
        expect(detailWorkstation).toContain("handleAutoRename");
        expect(detailWorkstation).toContain("handleAutoRenamePreviewApply");
        expect(detailWorkstation).toContain("handleAutoRenamePreviewCancel");
        expect(detailWorkstation).toContain("handleRenameStart");
        expect(detailWorkstation).toContain("handleRenameSave");
        expect(detailWorkstation).toContain("handleRenameCancel");
        expect(detailWorkstation).toMatch(
            /disabled=\{\s*isAutoRenaming\s*\|\|\s*isApplyingAutoRename\s*\}/,
        );
        expect(detailWorkstation).toMatch(
            /data-sot-state=\{\s*autoRenameDisabledReason/,
        );
        expect(detailWorkstation).toContain("autoRenameUnavailableOpen");
        expect(detailWorkstation).toContain('state="unavailable"');
        expect(detailWorkstation).toContain("aria-busy={isAutoRenaming}");
        expect(detailWorkstation).toContain("aria-busy={isSavingRename}");
        expect(detailWorkstation).toContain('aria-label="保存新标题"');
        expect(detailWorkstation).toContain('title="保存（Enter）"');
        expect(detailWorkstation).toContain(
            'aria-label={t("recording.cancelRename")}',
        );
        expect(detailWorkstation).toContain('aria-label="重命名"');
        expect(detailWorkstation).toContain('title="重命名"');

        expect(dashboardWorkstation).toContain("previewAutoRename");
        expect(dashboardWorkstation).toContain("applyAiRename");
        expect(dashboardWorkstation).toContain("/rename/auto");
        expect(collectAiRenamePrimitiveBusinessTokens()).toEqual([]);
        expect(aiRenamePreview).toContain('data-sot-panel="ai-rename-preview"');
        expect(aiRenamePreview).toContain('data-open="true"');
        expect(aiRenamePreview).toContain("data-sot-state={state}");
        expect(aiRenamePreview).toContain('role="dialog"');
        expect(aiRenamePreview).toContain("aria-label={title}");
        expect(aiRenamePreview).toMatch(
            /const\s+aiRenamePreview[A-Za-z0-9_]*ClassNames\s*=\s*{/,
        );
        for (const {
            snippets,
        } of AI_RENAME_PREVIEW_FEATURE_OWNER_CLASS_SNIPPETS) {
            for (const snippet of snippets) {
                expect(aiRenamePreview).toContain(snippet);
            }
        }
        expectAiRenameGenericPrimitiveCall(
            aiRenamePreview,
            'data-sot-panel="ai-rename-preview"',
            "Card",
        );
        for (const primitiveCall of [
            {
                marker: 'data-sot-control="ai-rename-close"',
                tagName: "Button" as const,
            },
            {
                marker: 'data-sot-control="ai-rename-regenerate"',
                tagName: "Button" as const,
            },
            {
                marker: 'data-sot-control="ai-rename-cancel"',
                tagName: "Button" as const,
            },
            {
                marker: 'data-sot-control="ai-rename-apply"',
                tagName: "Button" as const,
            },
            {
                marker: 'data-sot-review-field="old"',
                tagName: "Badge" as const,
            },
            {
                marker: 'data-sot-review-field="new"',
                tagName: "Badge" as const,
            },
            {
                marker: 'data-sot-part="state-description"',
                tagName: "Alert" as const,
            },
        ]) {
            expectAiRenameGenericPrimitiveCall(
                aiRenamePreview,
                primitiveCall.marker,
                primitiveCall.tagName,
            );
        }
        for (const dataSotToken of [
            'data-sot-part="head"',
            'data-sot-part="body"',
            'data-sot-part="state"',
            'data-sot-part="review-row"',
            'data-sot-part="review-line"',
            'data-sot-part="review-tag"',
            'data-sot-part="review-old"',
            'data-sot-part="review-new"',
            'data-sot-part="actions"',
            'data-sot-control="ai-rename-close"',
            'data-sot-control="ai-rename-regenerate"',
            'data-sot-control="ai-rename-cancel"',
            'data-sot-control="ai-rename-apply"',
        ]) {
            expect(aiRenamePreview).toContain(dataSotToken);
        }
        expect(aiRenamePreview).toContain("onClick={onCancel}");
        expect(aiRenamePreview).toContain("onClick={onRegenerate}");
        expect(aiRenamePreview).toContain("onClick={onApply}");
        expect(aiRenamePreview).toContain("aria-busy={isRegenerating}");
        expect(aiRenamePreview).toContain("aria-busy={isApplying}");
        expect(aiRenamePreview).toContain("disabled={isApplying}");
        expect(aiRenamePreview).toContain("disabled={isBusy || !canAct}");
        expect(detailWorkstation).toContain(
            "onApply={handleAutoRenamePreviewApply}",
        );
        expect(detailWorkstation).toContain(
            "onCancel={handleAutoRenamePreviewCancel}",
        );
        expect(detailWorkstation).toContain("onRegenerate={handleAutoRename}");
        expect(dashboardWorkstation).toContain("onApply={applyAiRename}");
        expect(dashboardWorkstation).toContain(
            "onRegenerate={previewAutoRename}",
        );
        for (const retiredAiRenameToken of [
            "animate-spin rounded-full border-2 border-border border-t-current",
        ]) {
            expect(aiRenamePreview).not.toContain(retiredAiRenameToken);
        }
        expect(dashboardWorkstation).toContain("aria-busy={");
        expect(dashboardWorkstation).toContain('aria-label="更多操作"');
        expect(dashboardWorkstation).toContain(
            'from "@/components/ui/dropdown-menu"',
        );
        expect(dashboardWorkstation).toContain("<DropdownMenu");
        expect(dashboardWorkstation).toContain("open={moreOpen}");
        expect(dashboardWorkstation).toContain("onOpenChange={(open) =>");
        expect(dashboardWorkstation).toContain("<DropdownMenuTrigger asChild>");
        expect(dashboardWorkstation).toContain("<DropdownMenuContent");
        expect(dashboardWorkstation).toContain(
            'data-sot-menu="recording-more-actions"',
        );
        expect(dashboardWorkstation).toContain('data-sot-menu-item="rename"');
        expect(dashboardWorkstation).toContain(
            'data-sot-menu-item="ai-rename"',
        );
        expect(dashboardWorkstation).toContain(
            'data-sot-menu-item="retranscribe"',
        );
        expect(dashboardWorkstation).toContain(
            'data-sot-menu-item="delete-local"',
        );
        expect(dashboardWorkstation).toContain('data-sot-tone="danger"');
        expect(dashboardWorkstation).toContain("<DropdownMenuSeparator");
        expect(dashboardWorkstation).toContain(
            'data-sot-menu-separator="delete"',
        );
        expect(dashboardWorkstation).toContain("data-sot-menu-hint");
        for (const compositionToken of MORE_ACTIONS_MENU_COMPOSITION_TOKENS) {
            expect(detailWorkstation).toContain(compositionToken);
            expect(dashboardWorkstation).toContain(compositionToken);
        }
        expect(dashboardWorkstation).not.toContain('className="more-menu"');
        expect(dashboardWorkstation).not.toContain(
            'className="more-menu-item"',
        );
        expect(dashboardWorkstation).not.toContain('className="more-menu-sep"');
        expect(dashboardWorkstation).not.toContain(
            'className="more-menu-hint"',
        );
        expect(dashboardWorkstation).toContain("AI 重命名");
        expect(dashboardWorkstation).toContain("重新转写");
        expect(dashboardWorkstation).toContain("来源持有正本");
        expect(dashboardWorkstation).not.toContain('className="more-action"');
        expect(dashboardWorkstation).not.toContain("more-action-l");
        expect(dashboardWorkstation).not.toContain("more-action-meta");
        expect(dashboardWorkstation).toContain("void deleteRecording()");
        expect(dashboardWorkstation).toContain("删除本地副本");
        expect(dashboardWorkstation).not.toContain("仅删除本地副本");
        expect(dashboardWorkstation).toContain(
            "!selectedRecording.sourceProvider ||",
        );
        expect(dashboardWorkstation).toContain(
            "selectedRecording.upstreamDeleted",
        );
    });

    it("keeps dashboard retranscription states inline without hiding the existing transcript", () => {
        const dashboardTranscript = readSource(
            "features/dashboard/workstation.tsx",
        );
        const dashboardTranscriptShell = extractCardSlice(
            dashboardTranscript,
            'data-sot-panel="dashboard-transcript-shell"',
        );

        expect(dashboardTranscript).toContain(
            'data-sot-panel="dashboard-retranscription"',
        );
        expect(dashboardTranscript).toContain(
            "data-retx-state={dashboardRetxState}",
        );
        expect(dashboardTranscript).toContain(
            'dashboardRetxState === "failed"',
        );
        expect(dashboardTranscript).toContain(
            'dashboardRetxState === "running"',
        );
        expect(dashboardTranscript).toContain("void retranscribe()");
        expect(dashboardTranscript).toContain("转写任务已加入队列");
        expect(dashboardTranscript).toContain(
            "新任务会保持当前转写可见，完成后替换结果。",
        );
        expect(dashboardTranscriptShell).not.toMatch(
            /\bbg-(background|card|muted)\b/,
        );
        expect(dashboardTranscript).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps recording tag creation controls on shadcn buttons", () => {
        const tagManager = readSource(
            "features/recordings/components/recording-tag-manager.tsx",
        );
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const inputGroupPrimitive = readSource("components/ui/input-group.tsx");

        expect(tagManager).toContain('data-sot-control="recording-tag-create"');
        expect(tagManager).toContain("<Button");
        expect(buttonPrimitive).not.toMatch(/\brecordingTag[A-Za-z0-9_]*\b/);
        expect(inputGroupPrimitive).not.toMatch(
            /\brecordingTag[A-Za-z0-9_]*\b/,
        );
        const inlineCreateButton = extractOpeningElement(
            tagManager,
            'data-sot-control="recording-tag-create"',
            "Button",
        );
        for (const ownerOwnedCreateToken of [
            "RECORDING_TAG_INLINE_CREATE_BUTTON_CLASS_NAME",
            'data-sot-control="recording-tag-create"',
            'aria-label="添加"',
        ]) {
            expect(inlineCreateButton).toContain(ownerOwnedCreateToken);
        }
        expect(inlineCreateButton).toContain("className={cn(");
        expect(tagManager).not.toContain('variant="recordingTagInlineCreate"');
        expect(tagManager).not.toContain('size="recordingTagInlineCreate"');
        expect(tagManager).not.toContain('variant="recordingTagCreateRow"');
        expect(tagManager).not.toContain('variant="recordingTagNameInput"');
    });

    it("keeps recording tag manager card and badge business classes owner-local", () => {
        const tagManager = readSource(
            "features/recordings/components/recording-tag-manager.tsx",
        );
        const tagVisuals = readSource(
            "features/recordings/components/recording-tag-visuals.tsx",
        );
        const cardPrimitive = readSource("components/ui/card.tsx");
        const badgePrimitive = readSource("components/ui/badge.tsx");

        expect(tagManager).toContain("const recordingTagManagerCardClassNames");
        expect(tagManager).toContain(
            "const recordingTagManagerContentClassNames",
        );
        expect(tagManager).toContain(
            "const recordingTagManagerBadgeClassNames",
        );
        expect(tagManager).toContain(
            "contentVariant: RecordingTagManagerContentVariant",
        );
        expect(tagManager).toContain(
            "recordingTagManagerContentClassNames[contentVariant]",
        );
        expect(tagManager).toContain("<RecordingTagManagerPanelCard");
        expect(tagManager).toContain("<RecordingTagManagerHeader");
        expect(tagManager).toContain("<RecordingTagManagerTitle");
        expect(tagManager).toContain("<RecordingTagManagerContent");
        expect(tagManager).toContain("<RecordingTagManagerFooter");
        expect(tagManager).toContain("<RecordingTagManagerToggleNote");
        expect(tagManager).toContain("<RecordingTagManagerBadge");

        for (const retiredCardVariant of [
            "recordingTagManagerPanel",
            "recordingTagManagerHeader",
            "recordingTagManagerTitle",
            "recordingTagManagerFooter",
            "recordingTagToggleNote",
        ]) {
            expect(tagManager).not.toContain(variantAttr(retiredCardVariant));
        }

        for (const primitiveSource of [cardPrimitive, badgePrimitive]) {
            expect(primitiveSource).not.toMatch(
                /\brecordingTag[A-Za-z0-9_]*\b/,
            );
        }
        expect(tagManager).toContain(
            "appearance: RecordingTagManagerBadgeAppearance",
        );
        expect(tagManager).toContain(
            "recordingTagManagerBadgeClassNames[appearance]",
        );
        expect(tagManager).not.toContain(variantAttr("recordingTagChip"));

        expect(tagVisuals).toContain("const recordingTagChipClassName");
        expect(tagVisuals).toContain("className={recordingTagChipClassName}");
        expect(tagVisuals).toContain("recordingTagChipVariablesClassName");
        for (const recordingTagChipToken of [
            "--sot-player-tag-chip-bg",
            "--sot-player-tag-chip-border",
            "--sot-player-tag-chip-fg",
        ]) {
            expect(tagVisuals).toContain(recordingTagChipToken);
        }
        expect(tagVisuals).not.toContain(variantAttr("recordingTagChip"));
    });
});
