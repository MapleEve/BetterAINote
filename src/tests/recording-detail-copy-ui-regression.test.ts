import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serializeRecordingDetailTranscriptionJob } from "@/server/modules/recordings/serialize";

const ROOT = path.join(process.cwd(), "src");

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

const RECORDING_SOURCE_REPORT_SKELETON_LOCAL_COMPOSITION_TOKENS = [
    "const sourceReportCardSkeletonClassNames",
    "const sourceReportSegmentSkeletonClassNames",
    'count: "inline-block h-[18px] w-12 align-middle rounded-[6px]"',
    'source: "inline-block h-[18px] w-[120px] align-middle rounded-[6px]"',
    '"line-long": "mt-1.5 inline-block h-[13px] w-[92%] align-middle rounded-[4px]"',
    'time: "inline-block h-[12px] w-[96px] align-middle rounded-[4px]"',
] as const;

const EXPECTED_SOURCE_REPORT_METRIC_CARD_CLASS_NAME =
    "gap-[6px] overflow-visible rounded-[10px] border-[var(--source-report-metric-border)] bg-[var(--source-report-metric-bg)] px-[12px] py-[10px] shadow-none backdrop-blur-none";
const SOURCE_REPORT_METRIC_CARD_CLASS_TOKENS =
    EXPECTED_SOURCE_REPORT_METRIC_CARD_CLASS_NAME.split(" ");

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
        snippets: ["w-[min(360px,calc(100vw-32px))]", "gap-0"],
    },
    {
        label: "header",
        snippets: [
            "grid-cols-[1fr_auto]",
            "border-b border-border",
            "[&_[data-slot=card-head-copy]]:min-w-0",
        ],
    },
    {
        label: "body",
        snippets: [
            "min-h-20",
            "px-4 py-4",
            "[&_[data-slot=card-preview-title]]:text-foreground",
        ],
    },
    {
        label: "state",
        snippets: [
            "[&_[data-slot=card-state-label]]:uppercase",
            "[&_[data-slot=card-message]]:break-words",
            "[&_[data-slot=card-hint]]:text-muted-foreground",
        ],
    },
    {
        label: "review",
        snippets: [
            "[&_[data-slot=card-review-row]]:flex",
            "[&_[data-slot=card-review-line]]:rounded-lg",
            "[&_[data-review-tone=old]]:line-through",
            "[&_[data-review-tone=new]]:text-foreground",
        ],
    },
    {
        label: "actions",
        snippets: ["gap-1.5 px-4 py-3"],
    },
    {
        label: "alert",
        snippets: [
            "border-[var(--alert-destructive-soft-border)]",
            "[&_[data-slot=alert-icon]]:size-8",
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
            "h-6 shrink-0 gap-1",
            "bg-primary",
            "text-primary-foreground",
        ],
    },
] as const;

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasExactBusinessToken(source: string, token: string) {
    return new RegExp(`\\b${escapeRegExp(token)}(?![A-Za-z0-9_])`).test(
        source,
    );
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
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(source)) && match.index <= markerIndex) {
        start = match.index;
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
        const copyControl = detailTranscript.slice(
            Math.max(0, copyControlIndex - 280),
            copyControlIndex + 320,
        );
        const retranscribeControl = detailTranscript.slice(
            Math.max(0, retranscribeControlIndex - 280),
            retranscribeControlIndex + 320,
        );
        const startControl = detailTranscript.slice(
            Math.max(0, startControlIndex - 280),
            startControlIndex + 320,
        );
        const jobErrorBanner = detailTranscript.slice(
            Math.max(0, jobErrorBannerIndex - 240),
            jobErrorBannerIndex + 360,
        );
        const metaList = extractBoundedSlice(
            detailTranscript,
            'data-sot-list="recording-transcription-meta"',
            "</div>",
        );
        expect(copyControl).toContain("<Button");
        expect(copyControl).toContain('variant="transcriptionAction"');
        expect(copyControl).toContain('size="transcriptionAction"');
        expect(copyControl).toContain("isCopyingTranscript");
        expect(copyControl).toContain("!displayText.trim()");
        expect(retranscribeControl).toContain("<Button");
        expect(retranscribeControl).toContain(
            'variant="transcriptionDangerAction"',
        );
        expect(retranscribeControl).toContain('size="transcriptionAction"');
        expect(startControl).toContain("<Button");
        expect(startControl).toContain(
            'variant="transcriptionPrimaryAction"',
        );
        expect(startControl).toContain('size="transcriptionAction"');
        expect(jobErrorBanner).toContain("<Alert");
        expect(jobErrorBanner).toContain('variant="statusError"');
        expect(metaList).toContain("<Badge");
        expect(metaList).toContain('variant="transcriptionMeta"');
        expect(metaList).toContain('data-sot-tone="attribute"');
        expect(metaList).toContain('data-sot-tone="measure"');
        for (const genericActionToken of [
            'variant="outline"',
            'variant="destructive"',
            'variant="default"',
            'size="sm"',
        ]) {
            expect(copyControl).not.toContain(genericActionToken);
            expect(retranscribeControl).not.toContain(genericActionToken);
            expect(startControl).not.toContain(genericActionToken);
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
            '[data-sot-part="recording-transcription-title"] h2',
            '[data-sot-part="recording-transcription-description"],',
            '[data-sot-part="recording-transcription-unavailable"] {',
            '[data-sot-part="recording-transcription-body"] [data-sot-banner-title]',
            '[data-sot-list="recording-transcription-meta"] > span',
            '[data-sot-part="recording-transcription-meta-icon"]',
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
        const badgePrimitive = readSource("components/ui/badge.tsx");
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const cardPrimitive = readSource("components/ui/card.tsx");
        const emptyPrimitive = readSource("components/ui/empty.tsx");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const globals = readSource("app/globals.css");
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
            'import { Button, type ButtonProps } from "@/components/ui/button";',
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
        expect(sourceReport).toContain(
            "const SOURCE_REPORT_METRIC_CARD_CLASS_NAME =",
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
                sourceReport,
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
        const sourceReportUsesErrorIconOwnerConstant = sourceReport.includes(
            "SOURCE_REPORT_ERROR_ICON_CLASS_NAME",
        );
        const sourceReportErrorIconOwnerClassTarget =
            sourceReportUsesErrorIconOwnerConstant
                ? sourceReport
                : sourceReportErrorIcon;
        for (const sourceReportErrorIconOwnerClassSnippet of [
            "mb-0",
            "size-10",
            "rounded-full",
            "border border-border",
            "bg-background",
            "text-muted-foreground",
            "[&_svg:not([class*='size-'])]:size-5",
        ] as const) {
            expect(sourceReportErrorIconOwnerClassTarget).toContain(
                sourceReportErrorIconOwnerClassSnippet,
            );
        }
        if (sourceReportUsesErrorIconOwnerConstant) {
            expect(sourceReport).toContain(
                "SOURCE_REPORT_ERROR_ICON_CLASS_NAME",
            );
            expect(sourceReportErrorIcon).toContain(
                "className={SOURCE_REPORT_ERROR_ICON_CLASS_NAME}",
            );
        } else {
            expect(sourceReportErrorIcon).toContain("className=");
        }
        expect(sourceReport).not.toContain('variant="sourceReportErrorIcon"');
        expect(sourceReportErrorState).toContain("<EmptyMedia");
        expect(sourceReportErrorState).toContain('density="sourceReportError"');
        expect(sourceReportErrorState).toContain('layout="sourceReportError"');
        expect(sourceReportErrorState).toContain(
            "data-sot-source-report-empty",
        );
        expect(sourceReportErrorState).toContain('data-sot-tone="err"');
        expect(sourceReportErrorIcon).toContain(
            "data-sot-source-report-empty-icon",
        );
        expect(sourceReportErrorIcon).toContain("aria-hidden=\"true\"");
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
        expect(sourceReport).toContain('variant="sourceReportStatus"');
        expect(alertPrimitive).toContain("sourceReportError:");
        expect(buttonPrimitive).toContain("sourceReportAction:");
        expect(buttonPrimitive).toContain("sourceReportGhostAction:");
        expect(buttonPrimitive).toContain("sourceReportCopyAction:");
        expect(emptyPrimitive).not.toContain("sourceReportErrorIcon");
        expect(emptyPrimitive).not.toContain(
            "SOURCE_REPORT_ERROR_ICON_CLASS_NAME",
        );
        expect(sourceReport).toContain(
            '"sourceReportCopyAction" satisfies ButtonProps["variant"]',
        );
        expect(sourceReport).toContain(
            '"sourceReportCopyAction" satisfies ButtonProps["size"]',
        );
        for (const token of SOURCE_REPORT_SKELETON_SHARED_TOKENS) {
            expect(skeletonPrimitive).not.toContain(token);
        }
        for (const token of RECORDING_SOURCE_REPORT_SKELETON_LOCAL_COMPOSITION_TOKENS) {
            expect(sourceReport).toContain(token);
        }
        const sourceReportCardSkeleton = extractOpeningElement(
            sourceReport,
            'data-sot-part="source-report-card-skeleton"',
            "Skeleton",
        );
        expect(sourceReportCardSkeleton).toContain('variant="default"');
        expect(sourceReportCardSkeleton).toContain('size="default"');
        expect(sourceReportCardSkeleton).toContain(
            "className={sourceReportCardSkeletonClassNames[size]}",
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
            "className={sourceReportSegmentSkeletonClassNames[size]}",
        );
        expect(sourceReportSegmentSkeleton).toContain('aria-hidden="true"');
        expect(sourceReportSegmentSkeleton).toContain("data-sot-size={size}");
        expect(sourceReport).not.toContain('variant="sourceReportCard"');
        expect(sourceReport).not.toContain('variant="sourceReportSegment"');
        expect(sourceReport).not.toContain("sourceReportCardSkeletonSize");
        expect(sourceReport).not.toContain("sourceReportSegmentSkeletonSize");
        expect(transcriptionSkeletons).toContain('variant="default"');
        expect(transcriptionSkeletons).toContain('size="default"');
        expect(transcriptionSkeletons).toContain(
            "className={transcriptionSkeletonClassNames[size]}",
        );
        expect(transcriptionSkeletons).toContain(
            "const transcriptionSkeletonClassNames",
        );
        expect(transcriptionSkeletons).toContain(
            'action: "h-[26px] w-[72px]"',
        );
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
        expect(globals).toContain('[data-sot-part="source-report-copy-label"]');
        expect(badgePrimitive).toContain("sourceReportStatus:");
        expect(badgePrimitive).toContain(
            "[&_[data-sot-part=source-report-status-dot]]:inline-block",
        );
        expect(badgePrimitive).toContain(
            "[&_[data-sot-part=source-report-status-dot]]:size-[5px]",
        );
        expect(badgePrimitive).toContain(
            "[&_[data-sot-part=source-report-status-dot]]:rounded-full",
        );
        expect(badgePrimitive).toContain(
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
            "SOURCE_REPORT_STATUS_BADGE_CLASS",
            "SOURCE_REPORT_STATUS_BADGE_TONE_CLASS",
            "sourceReportStatusBadgeVariant",
        ]) {
            expect(sourceReport).not.toContain(
                legacySourceReportPrimitiveClass,
            );
        }
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
                expect(controlSource).toContain('size="sourceReportAction"');
                expect(controlSource).toMatch(
                    /variant="sourceReport(?:Ghost)?Action"/,
                );
                expect(controlSource).not.toContain('variant="outline"');
                expect(controlSource).not.toContain('variant="ghost"');
                expect(controlSource).not.toContain('size="xs"');
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
            /\bCSSProperties\b|SOURCE_REPORT_LOADING_SKELETON_STYLES|style=\{|sk _is|_is-/,
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
            "<CardHeader",
            headerPanelIndex,
        );
        const headerEnd = detailWorkstation.indexOf(
            "</CardHeader>",
            headerStart,
        );
        const detailHeader = detailWorkstation.slice(
            headerStart,
            headerEnd + "</CardHeader>".length,
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
        expect(button).toContain("recordingDetailBack:");
        expect(detailBackControl).toContain('variant="recordingDetailBack"');
        expect(detailBackControl).toContain('size="recordingDetailBack"');
        expect(detailBackControl).toContain(
            'navigateBrowserRoute(router, "/dashboard")',
        );
        expect(detailBackControl).toContain('data-sot-state="selected"');
        expect(detailBackControl).toContain("<ArrowLeft");
        expect(detailBackControl).toContain('data-icon="inline-start"');
        expect(detailBackControl).toContain(
            '{t("recording.backToDashboard")}',
        );
        expect(detailBackControl).not.toContain('variant="ghost"');
        expect(button).toContain("[&_span]:truncate");
        expect(button).toContain("[&_svg]:stroke-[1.7]");
        expect(button).toContain("[&_svg]:opacity-[0.85]");
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
        expect(headerPanelIndex).toBeGreaterThanOrEqual(0);
        expect(headerStart).toBeGreaterThanOrEqual(0);
        expect(headerEnd).toBeGreaterThan(headerStart);
        expect(detailHeader).toContain("<CardHeader");
        expect(detailHeader).toContain("<CardTitle");
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
        expect(badge).toContain("detailHeaderLocal:");
        expect(badge).toContain("detailHeaderStatus:");
        expect(button).toContain("detailHeaderIconAction:");
        expect(button).toContain("detailHeaderAction:");
        expect(button).toContain('detailHeaderIconAction: "size-[32px]"');
        expect(card).toContain('data-slot="card-header"');
        expect(card).toContain("detailHeader:");
        expect(card).toContain("data-[sot-state=saving]:py-0");
        expect(card).toContain(
            'detailHeaderTitle: "leading-none font-semibold min-w-0 flex-1 truncate"',
        );
        expect(input).toContain('data-slot="input"');
        expect(input).toContain("detailHeaderTitle:");
        expect(input).toContain(
            '"h-8 min-w-0 flex-1 px-3 py-1 text-base md:text-sm"',
        );
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
        const routeLoadingSurfaceClassName = extractBoundedSlice(
            loading,
            "const routeLoadingSurfaceClassName =",
            ";",
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
            'variant="recordingRoutePrimaryAction"',
            "</Button>",
        );
        expect(notFoundPrimaryAction).toContain(
            'size="recordingRouteAction"',
        );
        expect(error).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(error).toContain("<Button");
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
        for (const source of [notFound, error]) {
            expect(source).not.toContain('variant="default"');
            expect(source).not.toContain('variant="ghost"');
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
        expect(globals).toContain('[data-sot-shell="recording-route-loading"]');
        expect(globals).toContain('[data-sot-shell="recording-route-empty"]');
        expect(globals).toContain('[data-sot-shell="recording-route-error"]');
        expect(globals).toContain(
            '[data-sot-panel="recording-route-empty-detail"]',
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
            '<FieldDescription data-sot-part="recording-source-record-hint">',
        );
        expect(sourceRecordSegmentedTabs).toContain('variant="sotSegmented"');
        expect(sourceRecordSegmentedTabs).toContain('size="sotSegmentedSm"');
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
        expect(aiRenamePreview).toContain(
            'data-sot-panel="ai-rename-preview"',
        );
        expect(aiRenamePreview).toContain("data-sot-state={state}");
        expect(aiRenamePreview).toContain('role="dialog"');
        expect(aiRenamePreview).toContain("aria-label={title}");
        expect(aiRenamePreview).toMatch(
            /const\s+aiRenamePreview[A-Za-z0-9_]*ClassNames\s*=\s*{/,
        );
        for (const { snippets } of AI_RENAME_PREVIEW_FEATURE_OWNER_CLASS_SNIPPETS) {
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
        expect(detailWorkstation).toContain("onApply={handleAutoRenamePreviewApply}");
        expect(detailWorkstation).toContain("onCancel={handleAutoRenamePreviewCancel}");
        expect(detailWorkstation).toContain("onRegenerate={handleAutoRename}");
        expect(dashboardWorkstation).toContain("onApply={applyAiRename}");
        expect(dashboardWorkstation).toContain("onRegenerate={previewAutoRename}");
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

        expect(tagManager).toContain('data-sot-control="recording-tag-create"');
        expect(tagManager).toContain("<Button");
        expect(tagManager).toContain('variant="recordingTagInlineCreate"');
        expect(tagManager).toContain('size="recordingTagInlineCreate"');
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
        expect(tagManager).toContain('variant="recordingTagCreateRow"');
        expect(tagManager).toContain('variant="recordingTagNameInput"');
        expect(tagManager).toContain('aria-label="添加"');
        expect(tagManager).not.toContain("tagm-add-btn");
        expect(tagManager).not.toContain('variant="compact"');
    });
});
