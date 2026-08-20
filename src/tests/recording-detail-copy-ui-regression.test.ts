import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type {
    TranscriptionPanelProps,
    TranscriptionPanelTab,
} from "@/features/dashboard/components/transcription-panel";
import { translate, type UiLanguage } from "@/lib/i18n";
import type { RecordingTag } from "@/lib/recording-tags";
import { serializeRecordingDetailTranscriptionJob } from "@/server/modules/recordings/serialize";

const ROOT = path.join(process.cwd(), "src");

type CapturedButtonProps = ComponentProps<"button"> & {
    "data-control"?: string;
    "data-state"?: string;
    "data-tag-id"?: string;
    "data-testid"?: string;
};

type CapturedSegmentedTabsProps = {
    items: readonly { label: ReactNode; value: string }[];
    onValueChange: (value: string) => void;
    value: string;
};

let capturedButtons: CapturedButtonProps[] = [];
let capturedSegmentedTabs: CapturedSegmentedTabsProps[] = [];

async function installRenderedControlCapture() {
    capturedButtons = [];
    capturedSegmentedTabs = [];
    const React = await import("react");

    vi.doMock("@/components/ui/button", async (importOriginal) => {
        const actual =
            await importOriginal<typeof import("@/components/ui/button")>();

        return {
            ...actual,
            Button: (props: ComponentProps<typeof actual.Button>) => {
                capturedButtons.push(props as CapturedButtonProps);
                return React.createElement(actual.Button, props);
            },
        };
    });
    vi.doMock("@/components/ui/segmented-tabs", async (importOriginal) => {
        const actual =
            await importOriginal<
                typeof import("@/components/ui/segmented-tabs")
            >();

        return {
            ...actual,
            SegmentedTabs: (
                props: ComponentProps<typeof actual.SegmentedTabs>,
            ) => {
                capturedSegmentedTabs.push(props as CapturedSegmentedTabsProps);
                return React.createElement(actual.SegmentedTabs, props);
            },
        };
    });
    vi.doMock("@/components/ui/popover", async (importOriginal) => {
        const actual =
            await importOriginal<typeof import("@/components/ui/popover")>();

        return {
            ...actual,
            PopoverContent: ({
                align: _align,
                alignOffset: _alignOffset,
                avoidCollisions: _avoidCollisions,
                children,
                onEscapeKeyDown: _onEscapeKeyDown,
                onOpenAutoFocus: _onOpenAutoFocus,
                side: _side,
                sideOffset: _sideOffset,
                ...props
            }: ComponentProps<typeof actual.PopoverContent>) =>
                React.createElement("div", props, children),
        };
    });

    return React;
}

async function loadRenderedRuntime() {
    const React = await installRenderedControlCapture();
    const [
        { renderToStaticMarkup },
        { LanguageProvider },
        { ConfirmDialogProvider },
        { AiRenamePreviewCard },
        { DashboardRecordingPlayerControls },
        { TranscriptionPanel },
        { PlayerNoAudioAlert, PlayerStatusBadge, PlayerTagChip },
        { TranscriptionSection },
        { SourceReportPanel },
        { SourceReportCopyButton },
        { default: RecordingLoading },
        { default: RecordingNotFound },
        { default: RecordingError },
        { RecordingTagManager },
    ] = await Promise.all([
        import("react-dom/server"),
        import("@/components/language-provider"),
        import("@/components/ui/confirm-dialog"),
        import("@/features/recordings/components/ai-rename-preview-card"),
        import(
            "@/features/dashboard/components/dashboard-recording-player-controls"
        ),
        import("@/features/dashboard/components/transcription-panel"),
        import("@/features/recordings/components/player-primitives"),
        import("@/features/recordings/components/transcription-section"),
        import("@/features/recordings/components/source-report-panel"),
        import("@/features/source-report/primitives"),
        import("@/app/(app)/recordings/[id]/loading"),
        import("@/app/(app)/recordings/[id]/not-found"),
        import("@/app/(app)/recordings/[id]/error"),
        import("@/features/recordings/components/recording-tag-manager"),
    ]);

    return {
        AiRenamePreviewCard,
        ConfirmDialogProvider,
        DashboardRecordingPlayerControls,
        LanguageProvider,
        PlayerNoAudioAlert,
        PlayerStatusBadge,
        PlayerTagChip,
        React,
        RecordingError,
        RecordingLoading,
        RecordingNotFound,
        RecordingTagManager,
        SourceReportCopyButton,
        SourceReportPanel,
        TranscriptionPanel,
        TranscriptionSection,
        renderToStaticMarkup,
    };
}

let renderedRuntime: Awaited<ReturnType<typeof loadRenderedRuntime>>;

beforeAll(async () => {
    renderedRuntime = await loadRenderedRuntime();
});

function transcriptionPanelProps(
    overrides: Partial<TranscriptionPanelProps> = {},
): TranscriptionPanelProps {
    return {
        activeTab: "transcript",
        isTranscriptLoading: false,
        localCopyFeedback: null,
        localCopyState: "ready",
        onActiveTabChange: vi.fn(),
        onCopyLocal: vi.fn(),
        onRetryTranscript: vi.fn(),
        recording: {
            audioUrl: "/api/recordings/recording-1/audio",
            id: "recording-1",
        },
        retranscription: {
            description: "新任务会保持当前转写可见，完成后替换结果。",
            onDismiss: vi.fn(),
            onRequest: vi.fn(),
            onRetry: vi.fn(),
            state: "idle",
            title: "重新转写",
        },
        sourceActions: null,
        sourcePane: null,
        speakerMerge: {
            onMerge: vi.fn(),
            onRetry: vi.fn(),
            state: "idle",
        },
        speakers: [],
        turns: [
            {
                id: "turn-1",
                speakerName: "Maple",
                startMs: 0,
                endMs: 3_000,
                text: "现有逐字稿保持可见。",
            },
        ],
        ...overrides,
    };
}

afterEach(() => {
    capturedButtons = [];
    capturedSegmentedTabs = [];
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function recordingDetailSourceFiles(relativeDirectory: string): string[] {
    return readdirSync(path.join(ROOT, relativeDirectory), {
        withFileTypes: true,
    }).flatMap((entry) => {
        const relativePath = path.join(relativeDirectory, entry.name);
        if (entry.isDirectory()) {
            return recordingDetailSourceFiles(relativePath);
        }
        return /\.(?:ts|tsx)$/.test(entry.name) ? [relativePath] : [];
    });
}

const RECORDING_DETAIL_SOT_GUARD_SOURCE_FILES = recordingDetailSourceFiles(
    "features/recordings",
);

const EXPECTED_DASHBOARD_WORKSPACE_CLASS_NAME =
    "grid flex-1 min-h-0 grid-cols-[380px_1fr] gap-4 px-5 pt-4 pb-5 max-[1439px]:grid-cols-[minmax(0,1fr)] min-[1024px]:max-[1439px]:group-data-[detail-state=open]/dashboard-workstation:grid-cols-[320px_minmax(0,1fr)] max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const EXPECTED_DASHBOARD_DETAIL_PANEL_CLASS_NAME =
    "flex min-h-0 min-w-0 flex-col gap-4 max-[1439px]:hidden min-[1024px]:max-[1439px]:group-data-[detail-state=open]/dashboard-workstation:flex max-[1024px]:fixed max-[1024px]:inset-2 max-[1024px]:z-[330] max-[1024px]:overflow-y-auto max-[1024px]:rounded-lg max-[1024px]:bg-background max-[1024px]:p-4 max-[1024px]:shadow-lg max-[1024px]:group-data-[detail-state=open]/dashboard-workstation:flex";
const EXPECTED_DASHBOARD_DETAIL_SCRIM_CLASS_NAME =
    "pointer-events-none fixed inset-0 z-[320] hidden bg-background/60 backdrop-blur-sm max-[1024px]:group-data-[detail-state=open]/dashboard-workstation:pointer-events-auto max-[1024px]:group-data-[detail-state=open]/dashboard-workstation:block";
const EXPECTED_RECORDING_WORKSTATION_WORKSPACE_CLASS_NAME =
    "grid flex-1 min-h-0 grid-cols-[380px_1fr] gap-4 px-5 pt-4 pb-5 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border max-[860px]:grid-cols-[minmax(0,1fr)]";
const EXPECTED_DETAIL_PANEL_CLASS_NAME = "flex min-h-0 min-w-0 flex-col gap-4";
const EXPECTED_RECORDING_WORKSTATION_DETAIL_PANEL_CLASS_NAME =
    "flex min-h-0 min-w-0 flex-col gap-4 max-[860px]:max-w-full max-[860px]:box-border";
const EXPECTED_RECORDING_DETAIL_LIST_CARD_CLASS_NAME =
    "min-h-0 gap-0 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const RECORDING_WORKSTATION_SIDEBAR_REQUIRED_CLASS_TOKENS = [
    "relative",
    "flex",
    "flex-col",
    "border-r",
    "border-border",
    "bg-card",
    "px-3",
    "pt-4",
    "pb-3",
    "text-card-foreground",
    "max-[860px]:hidden",
] as const;
const DASHBOARD_SIDEBAR_REQUIRED_CLASS_TOKENS = [
    "relative",
    "flex",
    "flex-col",
    "rounded-none",
    "border-r",
    "border-sidebar-border",
    "bg-sidebar",
    "px-3",
    "pt-4",
    "pb-3",
    "text-sidebar-foreground",
] as const;
const DASHBOARD_SIDEBAR_VISUAL_GLOBAL_SELECTORS = [
    '[data-panel="dashboard-sidebar"]',
    '[data-theme="dark"] [data-panel="dashboard-sidebar"]',
    '.dark [data-panel="dashboard-sidebar"]',
] as const;
const DASHBOARD_SIDEBAR_FORBIDDEN_CLASS_PATTERN =
    /\bspace-[xy]-|\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;
const RECORDING_WORKSTATION_MAIN_REQUIRED_CLASS_TOKENS = [
    "flex",
    "h-screen",
    "min-w-0",
    "flex-col",
    "max-[860px]:min-w-0",
    "max-[860px]:max-w-full",
    "max-[860px]:box-border",
] as const;
const DASHBOARD_MAIN_REQUIRED_CLASS_TOKENS = [
    "flex",
    "h-screen",
    "min-w-0",
    "flex-col",
    "max-[860px]:min-w-0",
    "max-[860px]:max-w-full",
    "max-[860px]:box-border",
] as const;
const DASHBOARD_TOPBAR_REQUIRED_CLASS_TOKENS = [
    "relative",
    "z-[60]",
    "flex",
    "h-14",
    "flex-none",
    "flex-row",
    "items-center",
    "gap-3.5",
    "border-b",
    "border-border",
    "bg-background/80",
    "px-5",
    "py-3",
    "supports-[backdrop-filter]:bg-background/60",
    "max-[860px]:min-w-0",
    "max-[860px]:max-w-full",
    "max-[860px]:box-border",
] as const;
const RECORDING_WORKSTATION_TOPBAR_REQUIRED_CLASS_TOKENS = [
    "relative",
    "flex",
    "h-14",
    "flex-none",
    "flex-row",
    "items-center",
    "gap-3.5",
    "border-b",
    "border-border",
    "bg-background/80",
    "px-5",
    "py-3",
    "shadow-none",
    "supports-[backdrop-filter]:bg-background/60",
    "max-[860px]:min-w-0",
    "max-[860px]:max-w-full",
    "max-[860px]:box-border",
] as const;
const RECORDING_WORKSTATION_SIDEBAR_FORBIDDEN_CLASS_PATTERN =
    /\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;
const DASHBOARD_MAIN_FORBIDDEN_CLASS_PATTERN =
    /\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;
const DASHBOARD_TOPBAR_FORBIDDEN_CLASS_PATTERN =
    DASHBOARD_MAIN_FORBIDDEN_CLASS_PATTERN;
const OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN =
    /\bspace-[xy]-|\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;
const WORKSTATION_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS = [
    '[data-panel="workstation-topbar"]',
    '[data-theme="dark"] [data-panel="workstation-topbar"]',
    '[data-part="workstation-crumbs"]',
    '[data-part="workstation-crumb"]',
    '[data-part="workstation-crumb-separator"]',
    '[data-part="workstation-crumb-current"]',
] as const;
const DASHBOARD_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS = [
    '[data-panel="dashboard-topbar"]',
    '[data-theme="dark"] [data-panel="dashboard-topbar"]',
    '[data-part="dashboard-crumbs"]',
    '[data-part="dashboard-crumb"]',
    '[data-part="dashboard-crumb-separator"]',
    '[data-part="dashboard-crumb-current"]',
] as const;
const MOBILE_OWNER_LAYOUT_MIGRATED_GLOBAL_SELECTORS = [
    '[data-shell="dashboard-workstation"]',
    '[data-shell="recording-workstation"]',
    '[data-panel="dashboard-main"]',
    '[data-surface="dashboard-recording-list"]',
    '[data-panel="recording-detail-list"]',
    '[data-panel="recording-workstation-detail"]',
    '[data-panel="workstation-sidebar"]',
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
            "w-[min(360px,calc(100vw-32px))]",
            "gap-0",
            "p-0",
            "overflow-hidden",
        ],
    },
    {
        label: "header",
        snippets: [
            "grid-cols-[1fr_auto]",
            "gap-x-2.5 gap-y-0.5",
            "border-b border-border",
            "px-3.5 pt-3 !pb-[7px]",
        ],
    },
    {
        label: "body",
        snippets: [
            "flex flex-col p-3.5",
            "min-h-20",
            "text-[12.5px] leading-[1.5] font-medium text-muted-foreground",
        ],
    },
    {
        label: "state",
        snippets: [
            "text-[10.5px] leading-none font-semibold text-muted-foreground",
            "border border-border bg-muted",
            "text-primary",
        ],
    },
    {
        label: "review",
        snippets: [
            "mt-1.5 mb-0.5 flex flex-col gap-1.5",
            "rounded-lg border border-border bg-muted",
            "text-muted-foreground line-through decoration-muted-foreground",
            "text-foreground",
        ],
    },
    {
        label: "actions",
        snippets: [
            "min-h-12 gap-1.5 border-t border-border bg-muted",
            "px-3.5 py-2.5 !pt-2.5",
            'variant="outline"',
        ],
    },
    {
        label: "alert",
        snippets: [
            'density="spacious"',
            'layout="centered"',
            'density="comfortable"',
        ],
    },
    {
        label: "badge",
        snippets: ["min-w-14", "justify-start"],
    },
    {
        label: "button",
        snippets: ['size="icon-xs"', 'size="xs"', 'aria-hidden="true"'],
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

function expectClassNameConstReference(
    openingElement: string,
    constName: string,
) {
    const escapedConstName = constName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(openingElement).toMatch(
        new RegExp(`className=\\{\\s*${escapedConstName}\\s*\\}`),
    );
    expect(openingElement).not.toContain('className="');
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

function collectOpeningElements(source: string, tagName: string) {
    const openings: string[] = [];
    let searchFrom = 0;

    while (searchFrom < source.length) {
        const start = source.indexOf(`<${tagName}`, searchFrom);
        if (start < 0) break;

        let braceDepth = 0;
        let quote: '"' | "'" | "`" | null = null;
        let end = -1;

        for (
            let index = start + tagName.length + 1;
            index < source.length;
            index += 1
        ) {
            const character = source[index];
            const previous = source[index - 1];

            if (quote) {
                if (character === quote && previous !== "\\") {
                    quote = null;
                }
                continue;
            }

            if (character === '"' || character === "'" || character === "`") {
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

function expectAiRenameGenericPrimitiveCall(
    source: string,
    marker: string,
    tagName: "Alert" | "Badge" | "Button" | "Card" | "PopoverContent",
) {
    const openingElement = collectOpeningElements(source, tagName).find(
        (candidate) => candidate.includes(marker),
    );

    expect(openingElement).toBeDefined();
    expect(openingElement ?? "").toContain("className=");
    expect(openingElement ?? "").not.toMatch(
        /\b(?:variant|size|density|layout)="aiRenamePreview[A-Za-z0-9_]*"/,
    );
    return openingElement ?? "";
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
    /uikit-|glass-surface|glass-control|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const MORE_ACTIONS_MENU_RETIRED_GLOBALS_SELECTORS = [
    '[data-menu="recording-more-actions"]',
    '[data-menu="recording-more-actions"][data-open="true"]',
    '[data-menu="recording-more-actions"][data-state="open"]',
    '[data-menu="recording-more-actions"] svg',
    "[data-menu-item]",
    "[data-menu-item]:hover",
    "[data-menu-item]:focus-visible",
    "[data-menu-item]:active",
    "[data-menu-item] svg",
    '[data-menu-item][data-tone="danger"]',
    '[data-menu-item][data-tone="success"]',
    "[data-menu-item] [data-menu-hint]",
    "[data-menu-separator]",
    "[data-menu-label]",
] as const;

const MORE_ACTIONS_MENU_COMPOSITION_TOKENS = [
    'variant="glass"',
    'density="compact"',
    'variant="destructive"',
    "<DropdownMenuShortcut",
    'variant="hint"',
] as const;

const MORE_ACTIONS_MENU_PRIMITIVE_FORBIDDEN_PATTERNS = [
    /\b(?:text|bg|border|shadow)-\[var\([^\]]+\)\]/,
    /\[&_svg\]:\[(?:height|width):[^\]]+\]/,
    /\[&_svg\]:stroke-\[/,
    /\[stroke-line(?:cap|join):/,
    /<(?:CheckIcon|ChevronRightIcon|CircleIcon)\b(?=[^>]*\bclassName=["'][^"']*(?:size-|[wh]-|stroke-|\[(?:height|width|stroke)))/,
] as const;

const RECORDING_DETAIL_CARD_PRIMITIVE_SELECTORS = [
    '[data-panel="recording-detail-list"][data-slot="card"]',
    '[data-panel="recording-detail-metadata"][data-slot="card"]',
    '[data-panel="recording-source-record"][data-slot="card"]',
    '[data-panel="recording-transcription-skeleton"][data-slot="card"]',
    '[data-panel="recording-transcription-speaker-review-skeleton"][data-slot="card"]',
    '[data-part="recording-detail-list-header"][data-slot="card-header"]',
    '[data-part="recording-detail-metadata-header"]',
    '[data-part="recording-source-record-header"]',
    '[data-part="recording-transcription-skeleton-header"][data-slot="card-header"]',
    '[data-part="recording-detail-list-title"][data-slot="card-title"]',
    '[data-part="recording-detail-metadata-title"][data-slot="card-title"]',
    '[data-part="recording-source-record-title"][data-slot="card-title"]',
    '[data-part="recording-detail-list-content"][data-slot="card-content"]',
    '[data-part="recording-detail-metadata-body"]',
    '[data-part="recording-source-record-body"]',
    '[data-part="recording-transcription-skeleton-body"][data-slot="card-content"]',
    '[data-list="recording-transcription-speaker-cards"][data-slot="card-content"]',
] as const;

const RECORDING_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|line-height|padding|transition|width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;
const RECORDING_DETAIL_CARD_OWNER_FORBIDDEN_CLASS_PATTERN =
    /(?:^|\s)!\S+|\bdark:|\b(?:text|bg|border|shadow|ring|fill|stroke)-\[var\(|\[(?:font|font-size|line-height|letter-spacing):[^\]]+\]|(?:^|\s)(?:text-(?:xs|sm|base|lg|xl|[2-9]xl)|font-(?:sans|serif|mono|thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|leading-(?:none|tight|snug|normal|relaxed|loose|\[[^\]]+\]|\d+(?:\.\d+)?)|tracking-(?:normal|tight|wide|wider|widest|\[[^\]]+\]))(?=$|\s)/;

const RECORDING_DETAIL_NAV_BACK_REMOVED_GLOBAL_SELECTORS = [
    '[data-list="recording-detail-nav"]',
    '[data-part="recording-detail-nav-label"]',
    '[data-control="recording-detail-back"] svg',
    '[data-control="recording-detail-back"] > span',
] as const;

const RECORDING_DETAIL_ROW_REMOVED_GLOBAL_SELECTORS = [
    '[data-list="recording-detail-list-rows"]',
    '[data-item="recording-detail-list-row"]',
    '[data-item="recording-detail-list-row"]:hover',
    '[data-item="recording-detail-list-row"][data-state="selected"]',
    '[data-part="recording-detail-list-row-body"]',
    '[data-part="recording-detail-list-row-title"]',
    '[data-part="recording-detail-list-row-meta"]',
    '[data-part="recording-detail-list-row-duration"]',
] as const;

const RECORDING_WORKSTATION_NAV_OWNER_CLASS_INITIALIZERS = [
    {
        property: "list",
        expected: "flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3",
    },
    {
        property: "label",
        expected:
            "px-2.5 pb-1.5 pt-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
    },
] as const;
const RECORDING_WORKSTATION_TOPBAR_OWNER_CLASS_INITIALIZERS = [
    {
        property: "topbar",
        expectedTokens: RECORDING_WORKSTATION_TOPBAR_REQUIRED_CLASS_TOKENS,
    },
    {
        property: "crumbs",
        expected:
            "flex items-center gap-2 text-sm font-medium text-muted-foreground",
    },
    {
        property: "crumb",
        expected: "text-muted-foreground",
    },
    {
        property: "separator",
        expected: "text-muted-foreground/60",
    },
    {
        property: "current",
        expected: "font-semibold text-foreground",
    },
] as const;
const DASHBOARD_TOPBAR_OWNER_CLASS_INITIALIZERS = [
    {
        property: "topbar",
        expectedTokens: DASHBOARD_TOPBAR_REQUIRED_CLASS_TOKENS,
    },
    {
        property: "crumbs",
        expected:
            "flex items-center gap-2 text-sm font-medium text-muted-foreground",
    },
    {
        property: "crumb",
        expected: "text-muted-foreground",
    },
    {
        property: "separator",
        expected: "text-muted-foreground/60 max-[860px]:hidden",
    },
    {
        property: "current",
        expected: "font-semibold text-foreground max-[860px]:hidden",
    },
] as const;

const RECORDING_SOURCE_RECORD_LAYOUT_REMOVED_GLOBAL_SELECTORS = [
    '[data-part="recording-source-record-shell"]',
    '[data-part="recording-source-record-actions"]',
    '[data-part="recording-source-record-tabs"]',
    '[data-part="recording-source-record-hint"]',
    '[data-part="recording-source-record-pane"]',
] as const;
const RECORDING_DETAIL_LIST_OWNER_CLASS_INITIALIZERS = [
    {
        constName: "RECORDING_DETAIL_LIST_HEADER_CLASS_NAME",
        expected: "gap-0 border-b px-3 py-3",
        marker: 'data-part="recording-detail-list-header"',
        tagName: "CardHeader",
    },
    {
        constName: "RECORDING_DETAIL_LIST_TITLE_CLASS_NAME",
        expected: "text-sm",
        marker: 'data-part="recording-detail-list-title"',
        tagName: "CardTitle",
    },
    {
        constName: "RECORDING_DETAIL_LIST_CONTENT_CLASS_NAME",
        expected: "flex min-h-0 flex-col px-0",
        marker: 'data-part="recording-detail-list-content"',
        tagName: "CardContent",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROWS_CLASS_NAME",
        expected: "flex flex-col gap-0.5 p-1",
        marker: 'data-list="recording-detail-list-rows"',
        tagName: "div",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROW_CLASS_NAME",
        expected:
            "grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-border bg-secondary px-3 py-2 text-left transition-colors",
        marker: 'data-item="recording-detail-list-row"',
        tagName: "div",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROW_BODY_CLASS_NAME",
        expected: "flex min-w-0 flex-col gap-1",
        marker: 'data-part="recording-detail-list-row-body"',
        tagName: "div",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROW_TITLE_CLASS_NAME",
        expected: "truncate text-sm font-semibold text-foreground",
        marker: 'data-part="recording-detail-list-row-title"',
        tagName: "div",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROW_META_CLASS_NAME",
        expected: "flex flex-wrap items-center gap-2",
        marker: 'data-part="recording-detail-list-row-meta"',
        tagName: "div",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROW_DURATION_CLASS_NAME",
        expected: "font-mono text-xs font-medium text-muted-foreground",
        marker: 'data-part="recording-detail-list-row-duration"',
        tagName: "span",
    },
] as const;
const RECORDING_DETAIL_METADATA_OWNER_CLASS_INITIALIZERS = [
    {
        constName: "RECORDING_DETAIL_METADATA_CARD_CLASS_NAME",
        expected: "min-h-0 gap-0",
        marker: 'data-panel="recording-detail-metadata"',
        tagName: "Card",
    },
    {
        constName: "RECORDING_DETAIL_METADATA_HEADER_CLASS_NAME",
        expected: "flex items-center gap-3 border-b px-4 py-3",
        marker: 'data-part="recording-detail-metadata-header"',
        tagName: "CardHeader",
    },
    {
        constName: "RECORDING_DETAIL_METADATA_TITLE_CLASS_NAME",
        expected: "min-w-0 flex-1 truncate",
        marker: 'data-part="recording-detail-metadata-title"',
        tagName: "CardTitle",
    },
    {
        constName: "RECORDING_DETAIL_METADATA_BODY_CLASS_NAME",
        expected:
            "flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 pt-4 pb-6",
        marker: 'data-part="recording-detail-metadata-body"',
        tagName: "CardContent",
    },
] as const;
const RECORDING_SOURCE_RECORD_OWNER_CLASS_INITIALIZERS = [
    {
        constName: "RECORDING_SOURCE_RECORD_SHELL_CLASS_NAME",
        expected: "flex min-h-0 flex-col gap-4",
        marker: 'data-part="recording-source-record-shell"',
        tagName: "section",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_CARD_CLASS_NAME",
        expected: "min-h-0 gap-0",
        marker: 'data-panel="recording-source-record"',
        tagName: "Card",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_HEADER_CLASS_NAME",
        expected: "flex items-center gap-3 border-b px-4 py-3",
        marker: 'data-part="recording-source-record-header"',
        tagName: "CardHeader",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_TITLE_CLASS_NAME",
        expected: "min-w-0 flex-1 truncate",
        marker: 'data-part="recording-source-record-title"',
        tagName: "CardTitle",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_ACTIONS_CLASS_NAME",
        expected:
            "ml-auto flex max-w-full grow-0 shrink basis-auto flex-wrap items-center gap-2",
        marker: 'data-part="recording-source-record-actions"',
        tagName: "div",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_BODY_CLASS_NAME",
        expected:
            "flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 pt-4 pb-6",
        marker: 'data-part="recording-source-record-body"',
        tagName: "CardContent",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_TABS_CLASS_NAME",
        expected: "flex min-w-0",
        marker: 'data-part="recording-source-record-tabs"',
        tagName: "div",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_HINT_CLASS_NAME",
        expected: "m-0",
        marker: 'data-part="recording-source-record-hint"',
        tagName: "FieldDescription",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_PANE_CLASS_NAME",
        expected: "min-h-0",
        marker: 'data-part="recording-source-record-pane"',
        tagName: "div",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_EMPTY_CLASS_NAME",
        expected: "min-h-[280px] flex-1",
        marker: 'data-panel="recording-source-record-empty"',
        tagName: "Empty",
    },
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

    it("keeps transcript copy actions disabled when no display text is available", async () => {
        const {
            ConfirmDialogProvider,
            LanguageProvider,
            React,
            TranscriptionPanel,
            TranscriptionSection,
            renderToStaticMarkup,
        } = renderedRuntime;
        const onCopyLocal = vi.fn();

        const detailHtml = renderToStaticMarkup(
            React.createElement(
                LanguageProvider,
                null,
                React.createElement(
                    ConfirmDialogProvider,
                    null,
                    React.createElement(TranscriptionSection, {
                        recordingId: "recording-empty",
                        showSpeakerReview: false,
                    }),
                ),
            ),
        );
        const dashboardEmptyHtml = renderToStaticMarkup(
            React.createElement(
                LanguageProvider,
                null,
                React.createElement(
                    TranscriptionPanel,
                    transcriptionPanelProps({
                        localCopyState: "missing",
                        onCopyLocal,
                        turns: [],
                    }),
                ),
            ),
        );

        expect(detailHtml).toContain('data-control="recording-transcription"');
        expect(detailHtml).toContain('data-state="empty"');
        expect(detailHtml).not.toContain(
            'data-control="recording-transcript-copy"',
        );
        expect(dashboardEmptyHtml).toMatch(
            /<div[^>]*role="region"[^>]*aria-label="转写与说话人"/,
        );
        expect(dashboardEmptyHtml).toMatch(
            /<button(?=[^>]*data-control="copy-local-transcript")(?=[^>]*data-state="missing")(?=[^>]*disabled="")(?=[^>]*aria-busy="false")[^>]*>/,
        );
        expect(dashboardEmptyHtml).toMatch(
            /<section(?=[^>]*role="tabpanel")(?=[^>]*data-tab-pane="transcript")(?=[^>]*data-state="empty")[^>]*>/,
        );

        const disabledCopyButton = capturedButtons.find(
            (button) => button["data-control"] === "copy-local-transcript",
        );
        expect(disabledCopyButton?.disabled).toBe(true);
        expect(onCopyLocal).not.toHaveBeenCalled();

        renderToStaticMarkup(
            React.createElement(
                LanguageProvider,
                null,
                React.createElement(
                    TranscriptionPanel,
                    transcriptionPanelProps({ onCopyLocal }),
                ),
            ),
        );
        const readyCopyButton = capturedButtons
            .filter(
                (button) => button["data-control"] === "copy-local-transcript",
            )
            .at(-1);
        expect(readyCopyButton?.disabled).toBe(false);
        expect(readyCopyButton?.onClick).toBeTypeOf("function");
        (readyCopyButton?.onClick as (() => void) | undefined)?.();
        expect(onCopyLocal).toHaveBeenCalledOnce();
    });

    it("keeps source report copy states explicit without dumping raw detail payloads", async () => {
        const {
            LanguageProvider,
            React,
            SourceReportCopyButton,
            SourceReportPanel,
            renderToStaticMarkup,
        } = renderedRuntime;
        const copyTranscript = vi.fn();
        const copyReport = vi.fn();

        const html = renderToStaticMarkup(
            React.createElement(
                LanguageProvider,
                null,
                React.createElement(
                    "section",
                    null,
                    React.createElement(SourceReportPanel, {
                        autoLoad: false,
                        recordingId: "source-report-empty",
                        sourceProvider: "ticnote",
                    }),
                    React.createElement(SourceReportCopyButton, {
                        "aria-label": "复制不可用来源逐字稿",
                        children: "复制来源逐字稿",
                        copy: "source-transcript",
                        copyState: "missing",
                        disabled: true,
                        onClick: copyTranscript,
                    }),
                    React.createElement(SourceReportCopyButton, {
                        "aria-label": "复制来源逐字稿",
                        children: "复制来源逐字稿",
                        copy: "source-transcript",
                        copyState: "ready",
                        onClick: copyTranscript,
                    }),
                    React.createElement(SourceReportCopyButton, {
                        "aria-label": "来源报告已复制",
                        children: "已复制",
                        copy: "source-report",
                        copyState: "ready",
                        feedbackState: "ok",
                        onClick: copyReport,
                    }),
                    React.createElement(SourceReportCopyButton, {
                        "aria-label": "来源报告复制失败",
                        children: "复制失败",
                        copy: "source-report",
                        copyState: "ready",
                        feedbackState: "err",
                        onClick: copyReport,
                    }),
                ),
            ),
        );

        expect(html).toMatch(
            /<div(?=[^>]*data-control="recording-source-report")(?=[^>]*data-state="empty")[^>]*>/,
        );
        expect(html).toContain('data-testid="source-report-empty-surface"');
        expect(html).not.toMatch(/<(?:pre|code)\b/);
        expect(html).toMatch(
            /<button(?=[^>]*data-testid="source-report-copy-source-transcript")(?=[^>]*data-state="missing")(?=[^>]*aria-label="复制不可用来源逐字稿")(?=[^>]*disabled="")[^>]*>/,
        );
        expect(html).toMatch(
            /<button(?=[^>]*data-testid="source-report-copy-source-transcript")(?=[^>]*data-state="ready")(?=[^>]*aria-label="复制来源逐字稿")[^>]*>/,
        );
        expect(html).toMatch(
            /<button(?=[^>]*data-testid="source-report-copy-source-report")(?=[^>]*data-state="ok")(?=[^>]*aria-label="来源报告已复制")[^>]*>/,
        );
        expect(html).toMatch(
            /<button(?=[^>]*data-testid="source-report-copy-source-report")(?=[^>]*data-state="err")(?=[^>]*aria-label="来源报告复制失败")[^>]*>/,
        );

        const readyTranscriptCopy = capturedButtons.find(
            (button) =>
                button["data-testid"] ===
                    "source-report-copy-source-transcript" &&
                button["data-state"] === "ready",
        );
        const readyReportCopy = capturedButtons.find(
            (button) =>
                button["data-testid"] === "source-report-copy-source-report" &&
                button["data-state"] === "ok",
        );
        expect(readyTranscriptCopy?.onClick).toBeTypeOf("function");
        expect(readyReportCopy?.onClick).toBeTypeOf("function");
        (readyTranscriptCopy?.onClick as (() => void) | undefined)?.();
        (readyReportCopy?.onClick as (() => void) | undefined)?.();
        expect(copyTranscript).toHaveBeenCalledOnce();
        expect(copyReport).toHaveBeenCalledOnce();
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
            'data-panel="recording-detail-list"',
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
            'data-panel="recording-detail-header"',
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
            'data-control="recording-detail-back"',
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
            'data-surface="recording-workstation"',
        );
        expect(detailWorkstation).toContain(
            'data-shell="recording-workstation"',
        );
        expect(detailWorkstation).toContain(
            'data-state={hydrated ? "ready" : "loading"}',
        );
        expect(detailWorkstation).toContain('data-panel="workstation-sidebar"');
        const workstationSidebarAside = extractElementSlice(
            detailWorkstation,
            'data-panel="workstation-sidebar"',
            "aside",
        );
        const recordingWorkstationSidebarClassName = extractBoundedSlice(
            detailWorkstation,
            "const RECORDING_WORKSTATION_SIDEBAR_CLASS_NAME =",
            ";",
        );
        for (const classToken of RECORDING_WORKSTATION_SIDEBAR_REQUIRED_CLASS_TOKENS) {
            expect(recordingWorkstationSidebarClassName).toContain(classToken);
        }
        expect(recordingWorkstationSidebarClassName).not.toMatch(
            RECORDING_WORKSTATION_SIDEBAR_FORBIDDEN_CLASS_PATTERN,
        );
        expect(workstationSidebarAside).toContain(
            "className={RECORDING_WORKSTATION_SIDEBAR_CLASS_NAME}",
        );
        expect(detailWorkstation).toContain('data-panel="workstation-main"');
        const workstationMain = extractElementSlice(
            detailWorkstation,
            'data-panel="workstation-main"',
            "main",
        );
        const recordingWorkstationMainClassName = extractBoundedSlice(
            detailWorkstation,
            "const RECORDING_WORKSTATION_MAIN_CLASS_NAME =",
            ";",
        );
        for (const classToken of RECORDING_WORKSTATION_MAIN_REQUIRED_CLASS_TOKENS) {
            expect(recordingWorkstationMainClassName).toContain(classToken);
        }
        expect(workstationMain).toContain(
            "className={RECORDING_WORKSTATION_MAIN_CLASS_NAME}",
        );
        expect(detailWorkstation).toContain('data-panel="workstation-topbar"');
        const workstationTopbar = extractElementSlice(
            detailWorkstation,
            'data-panel="workstation-topbar"',
            "header",
        );
        const recordingWorkstationTopbarClassNames = extractBoundedSlice(
            detailWorkstation,
            "const recordingWorkstationTopbarClassNames = {",
            "} as const;",
        );
        for (const item of RECORDING_WORKSTATION_TOPBAR_OWNER_CLASS_INITIALIZERS) {
            expect(recordingWorkstationTopbarClassNames).toContain(
                `${item.property}:`,
            );
            if ("expected" in item) {
                expect(recordingWorkstationTopbarClassNames).toContain(
                    `"${item.expected}"`,
                );
            } else {
                for (const token of item.expectedTokens) {
                    expect(recordingWorkstationTopbarClassNames).toContain(
                        token,
                    );
                }
            }
            expect(detailWorkstation).toMatch(
                new RegExp(
                    `className=\\{\\s*recordingWorkstationTopbarClassNames\\.${item.property}\\s*\\}`,
                ),
            );
        }
        for (const classToken of RECORDING_WORKSTATION_TOPBAR_REQUIRED_CLASS_TOKENS) {
            expect(recordingWorkstationTopbarClassNames).toContain(classToken);
        }
        expect(recordingWorkstationTopbarClassNames).not.toMatch(
            RECORDING_WORKSTATION_SIDEBAR_FORBIDDEN_CLASS_PATTERN,
        );
        expect(workstationTopbar).toContain(
            "className={recordingWorkstationTopbarClassNames.topbar}",
        );
        expect(detailWorkstation).toContain(
            'data-panel="workstation-workspace"',
        );
        const workstationWorkspace = extractOpeningElement(
            detailWorkstation,
            'data-panel="workstation-workspace"',
            "div",
        );
        const recordingWorkstationWorkspaceClassName =
            expectExactStringConstInitializer(
                detailWorkstation,
                "RECORDING_WORKSTATION_WORKSPACE_CLASS_NAME",
                EXPECTED_RECORDING_WORKSTATION_WORKSPACE_CLASS_NAME,
            );
        expect(workstationWorkspace).toContain(
            "className={RECORDING_WORKSTATION_WORKSPACE_CLASS_NAME}",
        );
        expect(recordingWorkstationWorkspaceClassName).not.toMatch(
            OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
        );
        const recordingDetailPanel = extractOpeningElement(
            detailWorkstation,
            'data-panel="recording-workstation-detail"',
            "section",
        );
        const recordingDetailBodyPanel = extractOpeningElement(
            detailWorkstation,
            'data-panel="recording-workstation-detail-body"',
            "section",
        );
        for (const { expected, openingElement, constName } of [
            {
                expected:
                    EXPECTED_RECORDING_WORKSTATION_DETAIL_PANEL_CLASS_NAME,
                openingElement: recordingDetailPanel,
                constName: "RECORDING_WORKSTATION_DETAIL_PANEL_CLASS_NAME",
            },
            {
                expected: EXPECTED_DETAIL_PANEL_CLASS_NAME,
                openingElement: recordingDetailBodyPanel,
                constName: "RECORDING_WORKSTATION_DETAIL_BODY_CLASS_NAME",
            },
        ]) {
            const ownerClassName = expectExactStringConstInitializer(
                detailWorkstation,
                constName,
                expected,
            );
            expect(openingElement).toMatch(
                new RegExp(`className=\\{\\s*${constName}\\s*\\}`),
            );
            expect(ownerClassName).not.toMatch(
                OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
            );
        }
        expect(detailWorkstation).toContain(
            "const recordingWorkstationBrandClassNames = {",
        );
        expect(detailWorkstation).toContain(
            'wrapper: "flex items-center gap-2.5 px-2 pt-1 pb-4"',
        );
        expect(detailWorkstation).toContain('image: "size-9 rounded-md"');
        expect(detailWorkstation).toContain(
            'name: "text-sm font-semibold text-foreground"',
        );
        expect(detailWorkstation).toMatch(
            /subtitle:\s*"mt-px text-xs font-medium text-muted-foreground"/,
        );
        expect(detailWorkstation).toContain(
            "className={recordingWorkstationBrandClassNames.wrapper}",
        );
        expect(detailWorkstation).toContain(
            "className={recordingWorkstationBrandClassNames.image}",
        );
        expect(detailWorkstation).toContain(
            "className={recordingWorkstationBrandClassNames.name}",
        );
        expect(detailWorkstation).toContain(
            "recordingWorkstationBrandClassNames.subtitle",
        );
        expect(detailWorkstation).toContain('data-part="workstation-brand"');
        expect(detailWorkstation).toContain(
            'data-part="workstation-brand-name"',
        );
        expect(detailWorkstation).toContain(
            'data-part="workstation-brand-subtitle"',
        );
        const recordingWorkstationNavClassNames = extractBoundedSlice(
            detailWorkstation,
            "const recordingWorkstationNavClassNames = {",
            "} as const;",
        );
        for (const {
            expected,
            property,
        } of RECORDING_WORKSTATION_NAV_OWNER_CLASS_INITIALIZERS) {
            expect(recordingWorkstationNavClassNames).toContain(
                `${property}: "${expected}"`,
            );
            expect(detailWorkstation).toContain(
                `className={recordingWorkstationNavClassNames.${property}}`,
            );
        }
        expect(detailWorkstation).toContain('data-list="recording-detail-nav"');
        expect(detailWorkstation).toContain(
            'data-control="recording-detail-back"',
        );
        expect(detailBackControlIndex).toBeGreaterThanOrEqual(0);
        expect(detailBackControlStart).toBeGreaterThanOrEqual(0);
        expect(detailBackControlEnd).toBeGreaterThan(detailBackControlStart);
        expect(button).not.toContain("recordingDetailBack:");
        expect(detailBackControl).toContain('variant="secondary"');
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
        expect(detailBackControl).toContain('data-state="selected"');
        expect(detailBackControl).toContain("<ArrowLeft");
        expect(detailBackControl).toContain('data-icon="inline-start"');
        expect(detailBackControl).toContain('{t("recording.backToDashboard")}');
        expect(detailBackControl).not.toContain(
            'variant="recordingDetailBack"',
        );
        expect(detailBackControl).toContain(
            'className="min-w-0 flex-1 truncate"',
        );
        expect(detailWorkstation).not.toContain("[&_svg]:stroke-[");
        expect(detailWorkstation).not.toContain("[&_svg]:opacity-[");
        expect(detailWorkstation).not.toContain("[&_svg]:[stroke-linecap");
        expect(detailWorkstation).not.toContain("[&_svg]:[stroke-linejoin");
        expect(detailWorkstation).not.toContain("data-[state=selected]:bg-[");
        expect(detailWorkstation).not.toContain(
            "data-[state=selected]:border-[",
        );
        expect(detailWorkstation).not.toContain("data-[state=selected]:text-[");
        expect(detailWorkstation).not.toContain(
            'className="flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3"',
        );
        expect(detailWorkstation).not.toContain(
            'className="px-2.5 pb-1.5 pt-3.5 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-tertiary)]"',
        );
        expect(detailWorkstation).toContain('data-state="selected"');
        for (const selector of MOBILE_OWNER_LAYOUT_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_SIDEBAR_VISUAL_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).not.toContain(
            '[data-theme="dark"] [data-panel="dashboard-sidebar"],\n.dark [data-panel="dashboard-sidebar"]',
        );
        const dashboardSidebarGlobalBlocks = collectCssRuleBlocks(
            globals,
            '[data-panel="dashboard-sidebar"]',
        );
        expect(dashboardSidebarGlobalBlocks).toEqual([]);
        expect(globals).not.toContain(
            '[data-panel="dashboard-sidebar"],\n[data-panel="workstation-sidebar"]',
        );
        expect(globals).not.toContain(
            '[data-panel="workstation-sidebar"] {\n    background:',
        );
        expect(globals).not.toContain(
            '[data-theme="dark"] [data-panel="workstation-sidebar"]',
        );
        expect(globals).not.toContain(
            '.dark [data-panel="workstation-sidebar"]',
        );
        expect(globals).not.toContain('[data-panel="workstation-main"]');
        expect(
            collectCssRuleBlocks(globals, '[data-panel="workstation-main"]'),
        ).toEqual([]);
        const dashboardWorkstation = readSource(
            "features/dashboard/workstation.tsx",
        );
        const dashboardSidebarClassNames = extractBoundedSlice(
            dashboardWorkstation,
            "const dashboardSidebarCollapseClassNames = {",
            "} as const;",
        );
        for (const classToken of DASHBOARD_SIDEBAR_REQUIRED_CLASS_TOKENS) {
            expect(dashboardSidebarClassNames).toContain(classToken);
        }
        expect(dashboardSidebarClassNames).not.toMatch(
            DASHBOARD_SIDEBAR_FORBIDDEN_CLASS_PATTERN,
        );
        expect(dashboardWorkstation).toContain(
            "className={dashboardSidebarCollapseClassNames.sidebar}",
        );
        const dashboardMain = extractElementSlice(
            dashboardWorkstation,
            'data-panel="dashboard-main"',
            "main",
        );
        const dashboardMainClassName = extractBoundedSlice(
            dashboardWorkstation,
            "const DASHBOARD_MAIN_CLASS_NAME =",
            ";",
        );
        for (const classToken of DASHBOARD_MAIN_REQUIRED_CLASS_TOKENS) {
            expect(dashboardMainClassName).toContain(classToken);
        }
        expect(dashboardMainClassName).not.toMatch(
            DASHBOARD_MAIN_FORBIDDEN_CLASS_PATTERN,
        );
        expect(dashboardMain).toContain(
            "className={DASHBOARD_MAIN_CLASS_NAME}",
        );
        const dashboardTopbar = extractElementSlice(
            dashboardWorkstation,
            'data-panel="dashboard-topbar"',
            "header",
        );
        const dashboardTopbarClassNames = extractBoundedSlice(
            dashboardWorkstation,
            "const dashboardTopbarClassNames = {",
            "} as const;",
        );
        for (const item of DASHBOARD_TOPBAR_OWNER_CLASS_INITIALIZERS) {
            expect(dashboardTopbarClassNames).toContain(`${item.property}:`);
            if ("expected" in item) {
                expect(dashboardTopbarClassNames).toContain(
                    `"${item.expected}"`,
                );
            } else {
                for (const token of item.expectedTokens) {
                    expect(dashboardTopbarClassNames).toContain(token);
                }
            }
            expect(dashboardWorkstation).toContain(
                `className={dashboardTopbarClassNames.${item.property}}`,
            );
        }
        for (const classToken of DASHBOARD_TOPBAR_REQUIRED_CLASS_TOKENS) {
            expect(dashboardTopbarClassNames).toContain(classToken);
        }
        expect(dashboardTopbarClassNames).not.toMatch(
            DASHBOARD_TOPBAR_FORBIDDEN_CLASS_PATTERN,
        );
        expect(dashboardTopbar).toContain(
            "className={dashboardTopbarClassNames.topbar}",
        );
        const dashboardMainGlobalBlocks = collectCssRuleBlocks(
            globals,
            '[data-panel="dashboard-main"]',
        );
        expect(dashboardMainGlobalBlocks).toEqual([]);
        expect(globals).not.toContain(
            '[data-panel="dashboard-main"] {\n    display: flex;\n    flex-direction: column;\n    min-width: 0;\n    height: 100vh;\n}',
        );
        expect(globals).toContain("--z-topbar: 200;");
        for (const selector of DASHBOARD_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of WORKSTATION_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of [
            '[data-panel="dashboard-workspace"]',
            '[data-panel="workstation-workspace"]',
        ]) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).not.toContain(
            '[data-panel="dashboard-workspace"]\n        > [data-panel="dashboard-detail"]',
        );
        const dashboardWorkspaceClassName = expectExactStringConstInitializer(
            dashboardWorkstation,
            "DASHBOARD_WORKSPACE_CLASS_NAME",
            EXPECTED_DASHBOARD_WORKSPACE_CLASS_NAME,
        );
        expect(dashboardWorkspaceClassName).not.toMatch(
            OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
        );
        expect(dashboardWorkspaceClassName).toContain("grid-cols-[380px_1fr]");
        expect(dashboardWorkspaceClassName).toContain(
            "max-[1439px]:grid-cols-[minmax(0,1fr)]",
        );
        expect(dashboardWorkspaceClassName).toContain(
            "min-[1024px]:max-[1439px]:group-data-[detail-state=open]/dashboard-workstation:grid-cols-[320px_minmax(0,1fr)]",
        );
        const dashboardDetailPanelClassName = expectExactStringConstInitializer(
            dashboardWorkstation,
            "DASHBOARD_DETAIL_PANEL_CLASS_NAME",
            EXPECTED_DASHBOARD_DETAIL_PANEL_CLASS_NAME,
        );
        const dashboardDetailScrimClassName = expectExactStringConstInitializer(
            dashboardWorkstation,
            "DASHBOARD_DETAIL_SCRIM_CLASS_NAME",
            EXPECTED_DASHBOARD_DETAIL_SCRIM_CLASS_NAME,
        );
        expect(dashboardDetailPanelClassName).toContain(
            "min-[1024px]:max-[1439px]:group-data-[detail-state=open]/dashboard-workstation:flex",
        );
        expect(dashboardDetailPanelClassName).toContain(
            "max-[1024px]:fixed max-[1024px]:inset-2",
        );
        expect(dashboardDetailScrimClassName).toContain(
            "max-[1024px]:group-data-[detail-state=open]/dashboard-workstation:block",
        );
        expect(dashboardWorkstation).toContain(
            'className="hidden min-[1024px]:max-[1439px]:inline-flex"',
        );
        expect(dashboardWorkstation).toContain(
            'className="hidden max-[1024px]:inline-flex"',
        );
        expect(dashboardWorkstation).toContain(
            'window.matchMedia("(max-width: 1023px)")',
        );
        expect(dashboardWorkstation).not.toContain("max-[1023px]");
        expect(dashboardWorkstation).not.toContain("max-width: 1022px");
        expect(
            dashboardWorkstation.match(
                /if \(!hydrated \|\| !displaySettingsLoaded\) return;/g,
            ),
        ).toHaveLength(2);
        const recordingPropsEffectStart = dashboardWorkstation.indexOf(
            "setLiveRecordings(recordings);",
        );
        const recordingPropsEffectEnd = dashboardWorkstation.indexOf(
            "setLiveTranscriptions((current)",
            recordingPropsEffectStart,
        );
        expect(recordingPropsEffectStart).toBeGreaterThanOrEqual(0);
        expect(recordingPropsEffectEnd).toBeGreaterThan(
            recordingPropsEffectStart,
        );
        expect(
            dashboardWorkstation.slice(
                recordingPropsEffectStart,
                recordingPropsEffectEnd,
            ),
        ).not.toContain("requestedRecordingIdRef.current = null");
        expect(
            dashboardWorkstation.match(
                /requestedRecordingIdRef\.current = null/g,
            ),
        ).toHaveLength(1);
        expect(dashboardWorkstation).toMatch(
            /const payload =[\s\S]{0,2500}const requestedIdFound = Boolean\([\s\S]{0,300}if \(requestedId && requestedIdFound\) \{\s*updateRequestedRecordingId\(null\);\s*\} else if \(requestedId && payload\.anchorPage === null\) \{\s*settleMissingRequestedRecordingId\(requestedId\);/,
        );
        expect(dashboardWorkstation).toContain(
            "anchorRecordingId: requestedRecordingId",
        );
        expect(dashboardWorkstation).toContain(
            "missingRequestedRecordingId ||",
        );
        expect(dashboardWorkstation).toMatch(
            /function selectRecording\(recordingId: string\) \{\s*updateRequestedRecordingId\(null\);/,
        );
        expect(dashboardWorkstation).not.toContain(
            "requestedRecordingIsLoaded",
        );
        expect(dashboardWorkstation).toMatch(
            /!displaySettingsLoaded \|\|\s*recordingListLoading \|\|\s*recordingListError \|\|/,
        );
        expect(dashboardWorkstation).toContain(
            "className={DASHBOARD_WORKSPACE_CLASS_NAME}",
        );
        expect(globals).not.toContain(
            '[data-panel="dashboard-detail"],\n[data-panel="recording-workstation-detail"],\n[data-panel="recording-workstation-detail-body"]',
        );
        expect(globals).not.toContain(
            '[data-control="dashboard-sync"][disabled]',
        );
        expect(button).toContain("disabled:pointer-events-none");
        expect(dashboardWorkstation).toContain("disabled={syncButtonBusy}");
        expect(globals).not.toContain('[data-part="workstation-brand"]');
        expect(globals).not.toContain('[data-part="workstation-brand"] img');
        expect(globals).not.toContain('[data-part="workstation-brand-name"]');
        expect(globals).not.toContain(
            '[data-part="workstation-brand-subtitle"]',
        );
        expect(globals).not.toContain(
            '[data-control="recording-detail-back"][data-slot="button"]',
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
        expect(listPanel).toContain('data-panel="recording-detail-list"');
        const recordingDetailListCardClassName =
            expectExactStringConstInitializer(
                detailWorkstation,
                "RECORDING_DETAIL_LIST_CARD_CLASS_NAME",
                EXPECTED_RECORDING_DETAIL_LIST_CARD_CLASS_NAME,
            );
        expect(listPanel).toContain(
            "className={RECORDING_DETAIL_LIST_CARD_CLASS_NAME}",
        );
        expect(recordingDetailListCardClassName).not.toMatch(
            OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
        );
        expect(listPanel).toContain('data-part="recording-detail-list-header"');
        expect(listPanel).toContain('data-part="recording-detail-list-title"');
        expect(listPanel).toContain(
            'data-part="recording-detail-list-content"',
        );
        expect(listPanel).toContain('data-list="recording-detail-list-rows"');
        expect(listPanel).toContain('data-item="recording-detail-list-row"');
        expect(listPanel).toContain('data-state="selected"');
        expect(listPanel).toContain(
            'data-part="recording-detail-list-row-body"',
        );
        expect(listPanel).toContain(
            'data-part="recording-detail-list-row-title"',
        );
        expect(listPanel).toContain(
            'data-part="recording-detail-list-row-meta"',
        );
        expect(listPanel).toContain(
            'data-part="recording-detail-list-row-duration"',
        );
        for (const {
            constName,
            expected,
            marker,
            tagName,
        } of RECORDING_DETAIL_LIST_OWNER_CLASS_INITIALIZERS) {
            const ownerClassName = expectExactStringConstInitializer(
                detailWorkstation,
                constName,
                expected,
            );
            const openingElement = extractOpeningElement(
                detailWorkstation,
                marker,
                tagName,
            );

            expect(openingElement).toContain(marker);
            expectClassNameConstReference(openingElement, constName);
            expect(ownerClassName).not.toMatch(
                OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
            );
            expect(ownerClassName).not.toMatch(
                /(?:text|bg|border)-\[var\(|duration-\[|ease-\[|gap-\[|rounded-\[|py-\[|text-\[|tracking-\[/,
            );
        }
        expect(listPanel).toContain("<PlayerSourceTag");
        expect(listPanel).toContain("<PlayerStatusBadge");
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
        for (const selector of RECORDING_DETAIL_NAV_BACK_REMOVED_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of RECORDING_DETAIL_ROW_REMOVED_GLOBAL_SELECTORS) {
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
        expect(detailHeader).toContain('data-panel="recording-detail-header"');
        expect(detailHeader).toContain('data-part="detail-header-title"');
        expect(detailHeader).toContain('data-part="detail-header-title-input"');
        expect(detailHeader).toContain(
            'data-part="detail-header-title-status"',
        );
        expect(detailHeader).toContain('data-part="detail-header-action"');
        expect(detailHeader).toContain("data-rh-title");
        expect(detailHeader).toContain("data-rh-input");
        expect(detailHeader).toContain("data-rh-status");
        expect(detailHeader).toContain("data-rh-edit-start");
        expect(detailHeader).toContain("data-rh-edit-save");
        expect(detailHeader).toContain("data-rh-edit-cancel");
        expect(detailHeader).toContain("data-rh-ai-anchor");
        expect(detailHeader).toContain("data-rh-ai-trigger");
        expect(detailHeader).toContain('data-control="ai-rename"');
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
            "const RECORDING_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME",
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
        const detailHeaderClassName = expectExactStringConstInitializer(
            detailWorkstation,
            "RECORDING_DETAIL_HEADER_CLASS_NAME",
            "flex flex-row items-center gap-2.5 px-1 pt-1 pb-0 data-[state=saving]:pb-px",
        );
        const detailHeaderTitleClassName = expectExactStringConstInitializer(
            detailWorkstation,
            "RECORDING_DETAIL_HEADER_TITLE_CLASS_NAME",
            "min-w-0 flex-1 truncate text-xl text-foreground",
        );
        const detailHeaderTitleInputClassName =
            expectExactStringConstInitializer(
                detailWorkstation,
                "RECORDING_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME",
                "h-8 min-w-0 flex-1",
            );
        const detailHeaderLocalBadgeClassName =
            expectExactStringConstInitializer(
                detailWorkstation,
                "RECORDING_DETAIL_HEADER_LOCAL_BADGE_CLASS_NAME",
                "ml-1 shrink-0",
            );
        const detailHeaderStatusBadgeClassName =
            expectExactStringConstInitializer(
                detailWorkstation,
                "RECORDING_DETAIL_HEADER_STATUS_BADGE_CLASS_NAME",
                "ml-1 shrink-0",
            );
        for (const headerClassName of [
            detailHeaderClassName,
            detailHeaderTitleClassName,
            detailHeaderTitleInputClassName,
            detailHeaderLocalBadgeClassName,
            detailHeaderStatusBadgeClassName,
        ]) {
            expect(headerClassName).not.toMatch(
                /\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status)\b/,
            );
            expect(headerClassName).not.toMatch(
                /!\b(?:border|bg)|\[font:|text-\[var\(--|bg-\[var\(--|border-\[var\(--|tracking-\[/,
            );
        }
        const recordingHeaderButtonClassNames = extractBoundedSlice(
            detailWorkstation,
            "const recordingWorkstationButtonClassNames = {",
            "} as const;",
        );
        expect(recordingHeaderButtonClassNames).toContain(
            'headerIconButton: "rounded-[8px] text-[var(--fg-secondary)]"',
        );
        expect(recordingHeaderButtonClassNames).toContain(
            'headerActionButton: "w-[102.375px] min-w-[102.375px]"',
        );
        const headerButtonClassResidualPattern =
            /header(?:Icon|Action)Button:[\s\S]*?(?:data-sot|sot-|data-variant|rec-head|--recording-detail)/;
        expect(recordingHeaderButtonClassNames).not.toMatch(
            headerButtonClassResidualPattern,
        );
        for (const sourceFile of RECORDING_DETAIL_SOT_GUARD_SOURCE_FILES) {
            expect(readSource(sourceFile)).not.toMatch(/data-sot|sot-/i);
        }
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
        expect(detailHeader).toContain('variant="secondary"');
        expect(detailHeader).toContain('variant="outline"');
        expect(detailHeader).toContain('size="sm"');
        for (const icon of [
            "Pen",
            "Sparkle",
            "Check",
            "X",
            "EllipsisVertical",
        ]) {
            expect(detailHeader).toMatch(
                new RegExp(`<${icon}\\s+[\\s\\S]*?size=\\{16\\}`),
            );
        }
        expect(detailHeader).toContain(
            "recordingWorkstationButtonClassNames.headerIconButton",
        );
        expect(detailHeader).toContain(
            "recordingWorkstationButtonClassNames.headerActionButton",
        );
        expect(detailWorkstation).not.toContain(
            "dark:data-[state=selected]:border",
        );
        expect(detailWorkstation).not.toContain(
            "dark:data-[state=selected]:bg-[rgb(",
        );
        expect(detailWorkstation).not.toContain(
            "dark:data-[state=selected]:shadow-none",
        );
        expect(detailWorkstation).not.toContain("dark:hover:bg-accent/50");
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
        expect(detailHeader).toContain('data-state="saving"');
        expect(detailHeader).toContain("localDeleteAvailable ? (");
        expect(detailHeader).not.toMatch(legacyHeaderClassNamePattern);
        expect(globals).not.toContain('[data-panel="recording-detail-header"]');
        for (const selector of [
            '[data-part="detail-header-title"][data-slot="card-title"]',
            '[data-part="detail-header-title-input"][data-slot="input"]',
            '[data-part="detail-header-title-status"]',
            '[data-part="detail-header-local-badge"]',
            '[data-part="detail-header-action"]',
            '[data-part="detail-header-action-anchor"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
        const metadataPanelIndex = detailWorkstation.indexOf(
            'data-panel="recording-detail-metadata"',
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
            'data-panel="recording-source-record"',
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
            'data-panel="recording-detail-metadata"',
        );
        expect(metadataPanel).toContain(
            'data-part="recording-detail-metadata-header"',
        );
        expect(metadataPanel).toContain(
            'data-part="recording-detail-metadata-title"',
        );
        expect(metadataPanel).toContain(
            'data-part="recording-detail-metadata-body"',
        );
        for (const {
            constName,
            expected,
            marker,
            tagName,
        } of RECORDING_DETAIL_METADATA_OWNER_CLASS_INITIALIZERS) {
            const ownerClassName = expectExactStringConstInitializer(
                detailWorkstation,
                constName,
                expected,
            );
            const openingElement = extractOpeningElement(
                detailWorkstation,
                marker,
                tagName,
            );

            expect(openingElement).toContain(marker);
            expectClassNameConstReference(openingElement, constName);
            expect(ownerClassName).not.toMatch(
                OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
            );
            expect(ownerClassName).not.toMatch(
                RECORDING_DETAIL_CARD_OWNER_FORBIDDEN_CLASS_PATTERN,
            );
        }
        expect(metadataPanel.match(/<Field\b/g)).toHaveLength(5);
        expect(metadataPanel.match(/<FieldContent\b/g)).toHaveLength(5);
        expect(metadataPanel.match(/<FieldTitle\b/g)).toHaveLength(5);
        expect(metadataPanel.match(/<FieldDescription\b/g)).toHaveLength(5);
        expect(sourceRecordPanelIndex).toBeGreaterThanOrEqual(0);
        expect(sourceRecordStart).toBeGreaterThanOrEqual(0);
        expect(sourceRecordEnd).toBeGreaterThan(sourceRecordStart);
        expect(sourceRecordPanel).toContain("<Card");
        expect(sourceRecordPanel).toContain("<CardHeader");
        expect(sourceRecordPanel).toContain("<CardTitle");
        expect(sourceRecordPanel).toContain("<CardContent");
        expect(sourceRecordPanel).toContain(
            'data-panel="recording-source-record"',
        );
        for (const {
            constName,
            expected,
            marker,
            tagName,
        } of RECORDING_SOURCE_RECORD_OWNER_CLASS_INITIALIZERS) {
            const ownerClassName = expectExactStringConstInitializer(
                detailWorkstation,
                constName,
                expected,
            );
            const openingElement = extractOpeningElement(
                detailWorkstation,
                marker,
                tagName,
            );

            expect(openingElement).toContain(marker);
            expectClassNameConstReference(openingElement, constName);
            expect(ownerClassName).not.toMatch(
                OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
            );
            expect(ownerClassName).not.toMatch(
                RECORDING_DETAIL_CARD_OWNER_FORBIDDEN_CLASS_PATTERN,
            );
        }
        expect(sourceRecordPanel.match(/<Field\b/g)).toHaveLength(2);
        expect(sourceRecordPanel.match(/<FieldContent\b/g)).toHaveLength(2);
        expect(sourceRecordPanel.match(/<FieldTitle\b/g)).toHaveLength(2);
        expect(sourceRecordPanel.match(/<FieldDescription\b/g)).toHaveLength(3);
        for (const part of [
            "recording-source-record-header",
            "recording-source-record-title",
            "recording-source-record-actions",
            "recording-source-record-body",
            "recording-source-record-tabs",
            "recording-source-record-hint",
        ]) {
            expect(sourceRecordPanel).toContain(`data-part="${part}"`);
        }
        expect(detailWorkstation).toContain(
            'data-panel="recording-source-record-empty"',
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
            'data-part="recording-source-record-actions"',
        );
        expect(detailWorkstation).not.toContain('className="t-actions"');
        expect(sourceRecordPanel).toContain("handleCopyLocalTranscript");
        expect(sourceRecordPanel).toContain("handleCopyRawTranscript");
        expect(sourceRecordPanel).toContain("!localTranscriptCopyText.trim()");
        expect(sourceRecordPanel).toContain("!transcription?.text?.trim()");
        expect(sourceRecordPanel).toMatch(
            /disabled=\{\s*copyingAction === "local"\s*\|\|\s*!localTranscriptCopyText\.trim\(\)\s*\}/,
        );
        expect(sourceRecordPanel).toMatch(
            /disabled=\{\s*copyingAction ===\s*"raw-transcript"\s*\|\|\s*!transcription\?\.text\?\.trim\(\)\s*\}/,
        );
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
            'data-menu="recording-more-actions"',
        );
        expect(detailWorkstation).toContain('data-menu-item="rename"');
        expect(detailWorkstation).toContain('data-menu-item="ai-rename"');
        expect(detailWorkstation).toContain('data-menu-item="retranscribe"');
        expect(detailWorkstation).toContain('data-menu-item="delete-local"');
        expect(detailWorkstation).toContain('data-tone="danger"');
        expect(detailWorkstation).toContain("<DropdownMenuSeparator");
        expect(detailWorkstation).toContain('data-menu-separator="delete"');
        expect(detailWorkstation).toContain("data-menu-hint");
        for (const selector of MORE_ACTIONS_MENU_RETIRED_GLOBALS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const compositionToken of MORE_ACTIONS_MENU_COMPOSITION_TOKENS) {
            expect(detailWorkstation).toContain(compositionToken);
        }
        for (const primitivePattern of MORE_ACTIONS_MENU_PRIMITIVE_FORBIDDEN_PATTERNS) {
            expect(dropdownMenuPrimitive).not.toMatch(primitivePattern);
        }
        expect(detailWorkstation).not.toContain('className="more-menu"');
        expect(detailWorkstation).not.toContain('className="more-menu-item"');
        expect(detailWorkstation).not.toContain('className="more-menu-sep"');
        expect(detailWorkstation).not.toContain('className="more-menu-hint"');
        expect(detailWorkstation).toContain("handleMoreRetranscribe");
        expect(detailWorkstation).toContain("handleDeleteLocalRecording");
        expect(detailWorkstation).toContain("PlayerSourceTag");
        expect(detailWorkstation).toContain("PlayerStatusBadge");
        expect(detailWorkstation).toContain("<PlayerSourceTag");
        expect(detailWorkstation).toContain("<PlayerStatusBadge");
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

    it("keeps dashboard transcription panel on SOT retx and detail tabs", async () => {
        const {
            LanguageProvider,
            React,
            TranscriptionPanel,
            renderToStaticMarkup,
        } = renderedRuntime;
        const onActiveTabChange = vi.fn();
        const sourcePane = React.createElement(
            "div",
            { "data-testid": "rendered-source-pane" },
            "来源报告内容",
        );

        const transcriptHtml = renderToStaticMarkup(
            React.createElement(
                LanguageProvider,
                null,
                React.createElement(
                    TranscriptionPanel,
                    transcriptionPanelProps({
                        activeTab: "transcript",
                        onActiveTabChange,
                        sourcePane,
                    }),
                ),
            ),
        );
        const sourceHtml = renderToStaticMarkup(
            React.createElement(
                LanguageProvider,
                null,
                React.createElement(
                    TranscriptionPanel,
                    transcriptionPanelProps({
                        activeTab: "source",
                        onActiveTabChange,
                        sourcePane,
                    }),
                ),
            ),
        );

        expect(transcriptHtml).toMatch(
            /<div(?=[^>]*aria-label="详情标签")(?=[^>]*data-slot="toggle-group")[^>]*>/,
        );
        for (const label of ["转写", "说话人", "来源详情"]) {
            expect(transcriptHtml).toContain(label);
        }
        expect(transcriptHtml).toMatch(
            /<section(?=[^>]*role="tabpanel")(?=[^>]*data-tab-pane="transcript")(?![^>]*hidden="")[^>]*>/,
        );
        expect(transcriptHtml).toContain("现有逐字稿保持可见。");
        expect(sourceHtml).toMatch(
            /<section(?=[^>]*role="tabpanel")(?=[^>]*data-tab-pane="transcript")(?=[^>]*hidden="")[^>]*>/,
        );
        expect(sourceHtml).toMatch(
            /<section(?=[^>]*role="tabpanel")(?=[^>]*data-tab-pane="source")(?![^>]*hidden="")[^>]*>[\s\S]*data-testid="rendered-source-pane"/,
        );

        const tabs = capturedSegmentedTabs.at(-1);
        expect(tabs?.items.map((item) => item.value)).toEqual([
            "transcript",
            "speakers",
            "source",
        ]);
        tabs?.onValueChange("source");
        expect(onActiveTabChange).toHaveBeenCalledWith(
            "source" satisfies TranscriptionPanelTab,
        );

        const englishHtml = renderToStaticMarkup(
            React.createElement(
                LanguageProvider,
                { children: undefined, language: "en" },
                React.createElement(
                    TranscriptionPanel,
                    transcriptionPanelProps({
                        activeTab: "transcript",
                        onActiveTabChange,
                        sourcePane,
                        turns: [
                            {
                                id: "turn-en",
                                speakerName: "Maple",
                                text: "User transcript data remains unchanged.",
                            },
                        ],
                        retranscription: {
                            description: translate(
                                "en",
                                "recordingDetail.retx.idleDescription",
                            ),
                            onDismiss: vi.fn(),
                            onRequest: vi.fn(),
                            onRetry: vi.fn(),
                            state: "idle",
                            title: translate(
                                "en",
                                "recordingDetail.retx.idleTitle",
                            ),
                        },
                    }),
                ),
            ),
        );
        expect(englishHtml).toContain('aria-label="Transcript and speakers"');
        expect(englishHtml).toContain('aria-label="Detail tabs"');
        for (const label of ["Transcript", "Speakers", "Source details"]) {
            expect(englishHtml).toContain(label);
        }
        for (const appOwnedChinese of [
            "转写与说话人",
            "详情标签",
            "来源详情",
            "重新转写",
        ]) {
            expect(englishHtml).not.toContain(appOwnedChinese);
        }
    });

    it("renders transcript, retranscription, and speaker states in both UI languages", async () => {
        const {
            LanguageProvider,
            React,
            TranscriptionPanel,
            renderToStaticMarkup,
        } = renderedRuntime;

        const renderPanel = (
            language: UiLanguage,
            overrides: Partial<TranscriptionPanelProps>,
        ) =>
            renderToStaticMarkup(
                React.createElement(
                    LanguageProvider,
                    { children: undefined, language },
                    React.createElement(
                        TranscriptionPanel,
                        transcriptionPanelProps({
                            turns: [],
                            ...overrides,
                        }),
                    ),
                ),
            );

        for (const language of ["zh-CN", "en"] satisfies UiLanguage[]) {
            const idleHtml = renderPanel(language, {
                retranscription: {
                    description: translate(
                        language,
                        "recordingDetail.retx.idleDescription",
                    ),
                    onDismiss: vi.fn(),
                    onRequest: vi.fn(),
                    onRetry: vi.fn(),
                    state: "idle",
                    title: translate(
                        language,
                        "recordingDetail.retx.idleTitle",
                    ),
                },
            });
            expect(idleHtml).toContain(
                translate(language, "transcriptionPanel.transcriptEmptyTitle"),
            );
            expect(idleHtml).toContain(
                translate(
                    language,
                    "transcriptionPanel.transcriptEmptyDescription",
                ),
            );

            const unavailableHtml = renderPanel(language, {
                retranscription: {
                    description: translate(
                        language,
                        "recordingDetail.retx.idleDescription",
                    ),
                    disabled: true,
                    onDismiss: vi.fn(),
                    onRequest: vi.fn(),
                    onRetry: vi.fn(),
                    state: "unavailable",
                    title: translate(
                        language,
                        "recordingDetail.retx.idleTitle",
                    ),
                },
            });
            expect(unavailableHtml).toContain(
                translate(language, "recordingDetail.retx.unavailable"),
            );

            for (const state of [
                "queued",
                "running",
                "failed",
                "completed",
            ] as const) {
                const html = renderPanel(language, {
                    retranscription: {
                        description: translate(
                            language,
                            `recordingDetail.retx.${state}Description`,
                        ),
                        onDismiss: vi.fn(),
                        onRequest: vi.fn(),
                        onRetry: vi.fn(),
                        state,
                        title: translate(
                            language,
                            `recordingDetail.retx.${state}Title`,
                        ),
                    },
                });
                expect(html).toContain(`data-state="${state}"`);
                expect(html).toContain(
                    translate(language, `recordingDetail.retx.${state}Title`),
                );
            }

            const speakerEmptyHtml = renderPanel(language, {
                activeTab: "speakers",
            });
            expect(speakerEmptyHtml).toContain(
                translate(language, "transcriptionPanel.speakerEmptyTitle"),
            );

            for (const state of ["pending", "error", "success"] as const) {
                const speakerHtml = renderPanel(language, {
                    activeTab: "speakers",
                    speakerMerge: {
                        error:
                            state === "error"
                                ? translate(
                                      language,
                                      "recordingDetail.speaker.mergeRetry",
                                  )
                                : null,
                        onMerge: vi.fn(),
                        onRetry: vi.fn(),
                        state,
                    },
                    speakers: [
                        {
                            id: "speaker-1",
                            rawLabel: "speaker-1",
                            speakerName: "Maple",
                            text: "data",
                        },
                    ],
                });
                expect(speakerHtml).toContain(`data-state="${state}"`);
                expect(speakerHtml).toContain(
                    translate(
                        language,
                        state === "pending"
                            ? "transcriptionPanel.mergePending"
                            : state === "error"
                              ? "transcriptionPanel.mergeFailed"
                              : "transcriptionPanel.mergeSuccess",
                    ),
                );
            }
        }
    });

    it("localizes the dashboard player controls and no-audio presentation", () => {
        const {
            DashboardRecordingPlayerControls,
            LanguageProvider,
            PlayerNoAudioAlert,
            PlayerStatusBadge,
            PlayerTagChip,
            React,
            renderToStaticMarkup,
        } = renderedRuntime;

        const renderPlayerPresentation = (language: UiLanguage) =>
            renderToStaticMarkup(
                React.createElement(
                    LanguageProvider,
                    { children: undefined, language },
                    React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(PlayerNoAudioAlert, {
                            descriptionPart: "test-no-audio-description",
                            iconPart: "test-no-audio-icon",
                            part: "test-no-audio",
                            playbackDisabled: true,
                            textPart: "test-no-audio-text",
                            titlePart: "test-no-audio-title",
                        }),
                        React.createElement(PlayerTagChip, {
                            tag: null,
                            trigger: true,
                        }),
                        React.createElement(PlayerStatusBadge, {}),
                        React.createElement(DashboardRecordingPlayerControls, {
                            currentTime: 0,
                            duration: 60,
                            isPlaying: false,
                            onCyclePlaybackSpeed: vi.fn(),
                            onSeekBySeconds: vi.fn(),
                            onSeekToPercent: vi.fn(),
                            onTogglePlayPause: vi.fn(),
                            onVolumeChange: vi.fn(),
                            onVolumeOpenChange: vi.fn(),
                            playbackDisabled: false,
                            playbackSpeedLabel: "1.0×",
                            progress: 0,
                            volume: 80,
                            volumePopoverOpen: false,
                        }),
                    ),
                ),
            );

        const chineseHtml = renderPlayerPresentation("zh-CN");
        expect(chineseHtml).toContain("来源仅同步转写与报告");
        expect(chineseHtml).toContain(
            "这条录音没有本地音频，无法播放或运行私有重转写。",
        );
        expect(chineseHtml).toContain(">标签<");
        expect(chineseHtml).toContain(">已更新<");
        for (const label of [
            "播放进度",
            "后退 5 秒",
            "播放",
            "前进 5 秒",
            "切换播放倍速",
            "音量 80",
        ]) {
            expect(chineseHtml).toContain(`aria-label="${label}"`);
        }

        const englishHtml = renderPlayerPresentation("en");
        expect(englishHtml).toContain(
            "Only transcripts and reports sync from the source",
        );
        expect(englishHtml).toContain(
            "This recording has no local audio, so it cannot be played or privately re-transcribed.",
        );
        expect(englishHtml).toContain(">Tags<");
        expect(englishHtml).toContain(">Updated<");
        for (const label of [
            "Playback progress",
            "Back 5 seconds",
            "Play",
            "Forward 5 seconds",
            "Cycle playback speed",
            "Volume 80",
        ]) {
            expect(englishHtml).toContain(`aria-label="${label}"`);
        }
        for (const appOwnedChinese of [
            "来源仅同步转写与报告",
            "这条录音没有本地音频",
            "播放进度",
            "后退 5 秒",
            "播放",
            "前进 5 秒",
            "切换播放倍速",
            "音量 80",
            ">标签<",
            ">已更新<",
        ]) {
            expect(englishHtml).not.toContain(appOwnedChinese);
        }
    });

    it("keeps dashboard detail and source presentation on translated semantic states", () => {
        const dashboardWorkstation = readSource(
            "features/dashboard/workstation.tsx",
        );
        const transcriptionPanel = readSource(
            "features/dashboard/components/transcription-panel.tsx",
        );

        for (const key of [
            "recordingDetail.emptyTitle",
            "recordingDetail.shell.closeDetail",
            "recordingDetail.shell.moreActions",
            "recordingDetail.ai.reviewHint",
            "recordingDetail.delete.title",
            "recordingDetail.retx.completedDescription",
            "sourceReport.errorTitle",
            "sourceReport.transcriptMissing",
            "sourceReport.readOnlySummary",
            "sourceReport.publicMetadata",
            "sourceReport.noLinkedSourceTitle",
        ]) {
            expect(dashboardWorkstation).toMatch(
                new RegExp(`t\\(\\s*"${key.replaceAll(".", "\\.")}"`),
            );
            expect(translate("zh-CN", key)).not.toBe(key);
            expect(translate("en", key)).not.toBe(key);
        }
        for (const key of [
            "transcriptionPanel.regionLabel",
            "transcriptionPanel.tabsLabel",
            "transcriptionPanel.tabs.transcript",
            "transcriptionPanel.tabs.speakers",
            "transcriptionPanel.tabs.source",
            "transcriptionPanel.mergePending",
            "transcriptionPanel.speakerEmptyTitle",
        ]) {
            expect(transcriptionPanel).toMatch(
                new RegExp(`t\\(\\s*"${key.replaceAll(".", "\\.")}"`),
            );
            expect(translate("zh-CN", key)).not.toBe(key);
            expect(translate("en", key)).not.toBe(key);
        }
        expect(dashboardWorkstation).toMatch(
            /sourceReportReadinessTone\(\s*sourceTranscriptStatus,?\s*\)/,
        );
        expect(dashboardWorkstation).toMatch(
            /sourceReportSyncTone\(\s*sourceReportSyncStatus,?\s*\)/,
        );
        expect(dashboardWorkstation).not.toMatch(
            /sourceReportReadinessTone\(\s*sourceTranscriptStatusLabel/,
        );
        expect(dashboardWorkstation).not.toMatch(
            /sourceReportSyncTone\(\s*sourceReportSyncStatusLabel/,
        );
    });

    it("keeps standalone recording route fallback states in the new shell", async () => {
        const {
            React,
            RecordingError,
            RecordingLoading,
            RecordingNotFound,
            renderToStaticMarkup,
        } = renderedRuntime;
        const reset = vi.fn();

        const loadingHtml = renderToStaticMarkup(
            React.createElement(RecordingLoading),
        );
        const notFoundHtml = renderToStaticMarkup(
            React.createElement(RecordingNotFound),
        );
        const errorHtml = renderToStaticMarkup(
            React.createElement(RecordingError, { reset }),
        );

        expect(loadingHtml).toMatch(
            /<section(?=[^>]*aria-label="正在加载录音详情")(?=[^>]*aria-busy="true")[^>]*>/,
        );
        expect(loadingHtml).toContain('aria-label="应用导航"');
        expect(loadingHtml).toContain('aria-label="当前页面"');
        expect(loadingHtml).toContain('data-slot="skeleton"');

        expect(notFoundHtml).toContain('data-shell="recording-route-empty"');
        expect(notFoundHtml).toContain("录音不存在");
        expect(notFoundHtml).toMatch(
            /<a[^>]*href="[/]dashboard"[^>]*>返回工作台<[/]a>/,
        );

        expect(errorHtml).toContain('data-shell="recording-route-error"');
        expect(errorHtml).toContain("加载失败");
        expect(errorHtml).toMatch(
            /<button[^>]*type="button"[^>]*>重试<[/]button>/,
        );
        expect(errorHtml).toMatch(
            /<a[^>]*href="[/]dashboard"[^>]*>返回工作台<[/]a>/,
        );

        const retryButton = capturedButtons.find(
            (button) => button.onClick === reset,
        );
        expect(retryButton?.disabled).not.toBe(true);
        expect(retryButton?.onClick).toBeTypeOf("function");
        (retryButton?.onClick as (() => void) | undefined)?.();
        expect(reset).toHaveBeenCalledOnce();
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
            'data-part="recording-source-record-tabs"',
            'data-part="recording-source-record-hint"',
        );
        expect(sourceRecordSegmentedTabs).toContain('variant="segmented"');
        expect(sourceRecordSegmentedTabs).toContain('size="segmentedSm"');
        expect(sourceRecordSegmentedTabs).toContain(
            'data-control="segmented-tabs"',
        );
        expect(sourceRecordSegmentedTabs).toContain('data-size="sm"');
        expect(detailWorkstation).toContain('"source" | "local" | "speakers"');
        expect(detailWorkstation).toContain("showSpeakerReview={false}");
        expect(detailWorkstation).toContain("<SpeakerLabelEditor");
        expect(detailWorkstation).toContain("/rename/auto");
        const detailWorkstationWithoutOwnerChromeClassNames = detailWorkstation
            .replace(
                extractBoundedSlice(
                    detailWorkstation,
                    "const RECORDING_WORKSTATION_SIDEBAR_CLASS_NAME =",
                    ";",
                ),
                "",
            )
            .replace(
                extractBoundedSlice(
                    detailWorkstation,
                    "const recordingWorkstationTopbarClassNames = {",
                    "} as const;",
                ),
                "",
            );
        expect(detailWorkstationWithoutOwnerChromeClassNames).toContain(
            "bg-muted",
        );
        expect(detailWorkstationWithoutOwnerChromeClassNames).toContain(
            "bg-[var(--glass-tint-base)]",
        );
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
            /data-state=\{\s*autoRenameDisabledReason/,
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
        expect(aiRenamePreview).toContain("<Popover open modal={false}>");
        expect(aiRenamePreview).toContain("aria-labelledby={titleId}");
        expect(aiRenamePreview).toContain(
            "aria-describedby={subtitle ? descriptionId : undefined}",
        );
        expect(aiRenamePreview).not.toContain('role="dialog"');
        expect(aiRenamePreview).not.toContain("aria-label={title}");
        for (const {
            snippets,
        } of AI_RENAME_PREVIEW_FEATURE_OWNER_CLASS_SNIPPETS) {
            for (const snippet of snippets) {
                expect(aiRenamePreview).toContain(snippet);
            }
        }
        expectAiRenameGenericPrimitiveCall(
            aiRenamePreview,
            "aria-labelledby={titleId}",
            "PopoverContent",
        );
        for (const primitiveCall of [
            {
                marker: "aria-label={closeLabel ?? cancelLabel}",
                tagName: "Button" as const,
            },
            {
                marker: "aria-label={regenerateLabel}",
                tagName: "Button" as const,
            },
            {
                marker: "aria-label={cancelLabel}",
                tagName: "Button" as const,
            },
            {
                marker: "aria-label={applyLabel}",
                tagName: "Button" as const,
            },
            {
                marker: 'variant="ghost"',
                tagName: "Badge" as const,
            },
        ]) {
            expectAiRenameGenericPrimitiveCall(
                aiRenamePreview,
                primitiveCall.marker,
                primitiveCall.tagName,
            );
        }
        expect(aiRenamePreview).toContain('density="spacious"');
        expect(aiRenamePreview).toContain('layout="centered"');
        expect(aiRenamePreview).toContain('density="comfortable"');
        for (const primitiveSurface of [
            "<CardHeader",
            "<CardContent",
            "<CardFooter",
            "<Alert",
            "<Badge",
        ]) {
            expect(aiRenamePreview).toContain(primitiveSurface);
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
        expect(dashboardWorkstation).toMatch(
            /onRegenerate=\{\s*previewAutoRename\s*\}/,
        );
        for (const retiredAiRenameToken of [
            "animate-spin rounded-full border-2 border-border border-t-current",
        ]) {
            expect(aiRenamePreview).not.toContain(retiredAiRenameToken);
        }
        expect(dashboardWorkstation).toContain("aria-busy={");
        expect(dashboardWorkstation).toMatch(
            /aria-label=\{t\(\s*"recordingDetail\.shell\.moreActions",?\s*\)\}/,
        );
        expect(dashboardWorkstation).toContain(
            'from "@/components/ui/dropdown-menu"',
        );
        expect(dashboardWorkstation).toContain("<DropdownMenu");
        expect(dashboardWorkstation).toContain("open={moreOpen}");
        expect(dashboardWorkstation).toContain("onOpenChange={(open) =>");
        expect(dashboardWorkstation).toContain("<DropdownMenuTrigger asChild>");
        expect(dashboardWorkstation).toContain("<DropdownMenuContent");
        expect(dashboardWorkstation).toContain(
            'data-menu="recording-more-actions"',
        );
        expect(dashboardWorkstation).toContain('data-menu-item="rename"');
        expect(dashboardWorkstation).toContain('data-menu-item="ai-rename"');
        expect(dashboardWorkstation).toContain('data-menu-item="retranscribe"');
        expect(dashboardWorkstation).toContain('data-menu-item="delete-local"');
        expect(dashboardWorkstation).toContain('data-tone="danger"');
        expect(dashboardWorkstation).toContain("<DropdownMenuSeparator");
        expect(dashboardWorkstation).toContain('data-menu-separator="delete"');
        expect(dashboardWorkstation).toContain("data-menu-hint");
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
        expect(dashboardWorkstation).toMatch(
            /t\(\s*"recordingDetail\.shell\.aiRename",?\s*\)/,
        );
        expect(dashboardWorkstation).toMatch(
            /t\(\s*"recordingDetail\.shell\.retranscribe",?\s*\)/,
        );
        expect(dashboardWorkstation).toMatch(
            /t\(\s*"recordingDetail\.shell\.sourceOwnsOriginal",?\s*\)/,
        );
        expect(dashboardWorkstation).not.toContain('className="more-action"');
        expect(dashboardWorkstation).not.toContain("more-action-l");
        expect(dashboardWorkstation).not.toContain("more-action-meta");
        expect(dashboardWorkstation).toContain("void deleteRecording()");
        expect(dashboardWorkstation).toMatch(
            /t\(\s*"recordingDetail\.shell\.deleteLocal",?\s*\)/,
        );
        expect(dashboardWorkstation).not.toContain("仅删除本地副本");
        expect(dashboardWorkstation).toContain(
            "!selectedRecording.sourceProvider ||",
        );
        expect(dashboardWorkstation).toContain(
            "selectedRecording.upstreamDeleted",
        );
    });

    it("keeps dashboard retranscription states inline without hiding the existing transcript", async () => {
        const {
            LanguageProvider,
            React,
            TranscriptionPanel,
            renderToStaticMarkup,
        } = renderedRuntime;
        const onRequest = vi.fn();
        const onRetry = vi.fn();

        const runningHtml = renderToStaticMarkup(
            React.createElement(
                LanguageProvider,
                null,
                React.createElement(
                    TranscriptionPanel,
                    transcriptionPanelProps({
                        retranscription: {
                            description: "正在等待工作器领取，期间可继续浏览。",
                            onDismiss: vi.fn(),
                            onRequest,
                            onRetry,
                            state: "running",
                            title: "正在重新转写",
                        },
                    }),
                ),
            ),
        );
        const requestButton = capturedButtons
            .filter(
                (button) => button["data-control"] === "retranscribe-recording",
            )
            .at(-1);
        (requestButton?.onClick as (() => void) | undefined)?.();

        const failedHtml = renderToStaticMarkup(
            React.createElement(
                LanguageProvider,
                null,
                React.createElement(
                    TranscriptionPanel,
                    transcriptionPanelProps({
                        retranscription: {
                            description: "原稿未被覆盖，可以重试。",
                            onDismiss: vi.fn(),
                            onRequest,
                            onRetry,
                            state: "failed",
                            title: "本次重新转写失败",
                        },
                    }),
                ),
            ),
        );
        const retryButton = capturedButtons
            .filter(
                (button) => button["data-control"] === "retry-retranscription",
            )
            .at(-1);
        (retryButton?.onClick as (() => void) | undefined)?.();

        expect(runningHtml).toMatch(
            /<div(?=[^>]*role="status")(?=[^>]*aria-live="polite")(?=[^>]*data-panel="dashboard-retranscription")(?=[^>]*data-state="running")[^>]*>/,
        );
        expect(runningHtml).toContain("正在重新转写");
        expect(runningHtml).toContain("现有逐字稿保持可见。");
        expect(failedHtml).toMatch(
            /<div(?=[^>]*role="alert")(?=[^>]*aria-live="assertive")(?=[^>]*data-panel="dashboard-retranscription")(?=[^>]*data-state="failed")[^>]*>/,
        );
        expect(failedHtml).toContain("本次重新转写失败");
        expect(failedHtml).toContain("现有逐字稿保持可见。");
        expect(failedHtml).toMatch(
            /<button[^>]*data-control="retry-retranscription"[^>]*>[\s\S]*重试转写[\s\S]*<[/]button>/,
        );
        expect(onRequest).toHaveBeenCalledOnce();
        expect(onRetry).toHaveBeenCalledOnce();
    });

    it("keeps recording tag creation controls on shadcn buttons", async () => {
        const { React, RecordingTagManager, renderToStaticMarkup } =
            renderedRuntime;

        const html = renderToStaticMarkup(
            React.createElement(RecordingTagManager, {
                availableTags: [],
                onAvailableTagsChange: vi.fn(),
                onRecordingTagsChange: vi.fn(),
                recording: {
                    id: "recording-tag-create",
                    tags: [],
                } as unknown as Parameters<
                    typeof RecordingTagManager
                >[0]["recording"],
            }),
        );

        expect(html).toMatch(
            /<div(?=[^>]*data-slot="card")(?=[^>]*data-control="recording-tag-manager")(?=[^>]*data-state="ready")[^>]*>/,
        );
        expect(html).toContain("尚未创建标签");
        expect(html).toMatch(
            /<button(?=[^>]*data-control="recording-tag-create")(?=[^>]*aria-haspopup="dialog")[^>]*>[\s\S]*新建标签[\s\S]*<[/]button>/,
        );
        expect(html).not.toContain('id="recording-tag-create-name"');

        const createButton = capturedButtons.find(
            (button) => button["data-control"] === "recording-tag-create",
        );
        expect(createButton?.disabled).not.toBe(true);
        expect(createButton?.type).toBe("button");
    });

    it("keeps recording tag manager on shadcn primitives and semantic tokens", async () => {
        const { React, RecordingTagManager, renderToStaticMarkup } =
            renderedRuntime;
        const tag: RecordingTag = {
            color: "blue",
            icon: "grid",
            id: "tag-review",
            name: "Review",
        };
        const onAvailableTagsChange = vi.fn();
        const onClose = vi.fn();
        const onRecordingTagsChange = vi.fn();
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ tags: [] }), {
                headers: { "Content-Type": "application/json" },
                status: 200,
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        const html = renderToStaticMarkup(
            React.createElement(RecordingTagManager, {
                availableTags: [tag],
                loadError: "标签目录暂时不可用",
                onAvailableTagsChange,
                onClose,
                onRecordingTagsChange,
                recording: {
                    id: "recording-tag-manager",
                    tags: [tag],
                } as unknown as Parameters<
                    typeof RecordingTagManager
                >[0]["recording"],
            }),
        );

        expect(html).toMatch(
            /<div(?=[^>]*data-control="recording-tag-manager")(?=[^>]*data-state="error")[^>]*>/,
        );
        expect(html).toMatch(
            /<div[^>]*role="alert"[^>]*>[\s\S]*标签操作失败[\s\S]*标签目录暂时不可用/,
        );
        expect(html).toMatch(
            /<button(?=[^>]*data-control="recording-tag-toggle")(?=[^>]*data-tag-id="tag-review")(?=[^>]*aria-pressed="true")[^>]*>[\s\S]*Review[\s\S]*<[/]button>/,
        );
        expect(html).toContain('aria-label="编辑 Review"');
        expect(html).toContain('aria-label="删除 Review"');
        expect(html).toContain('aria-label="关闭标签管理"');

        const closeButton = capturedButtons.find(
            (button) => button["aria-label"] === "关闭标签管理",
        );
        (closeButton?.onClick as (() => void) | undefined)?.();
        expect(onClose).toHaveBeenCalledOnce();

        const toggleButton = capturedButtons.find(
            (button) =>
                button["data-control"] === "recording-tag-toggle" &&
                button["data-tag-id"] === "tag-review",
        );
        expect(toggleButton?.onClick).toBeTypeOf("function");
        (toggleButton?.onClick as (() => void) | undefined)?.();

        await vi.waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                "/api/recordings/recording-tag-manager/tags",
                expect.objectContaining({
                    body: JSON.stringify({ tagIds: [] }),
                    method: "PUT",
                }),
            );
            expect(onRecordingTagsChange).toHaveBeenCalledWith(
                "recording-tag-manager",
                [],
            );
        });
        expect(onAvailableTagsChange).not.toHaveBeenCalled();
    });

    it("localizes tag management and AI rename review without translating user content", () => {
        const {
            AiRenamePreviewCard,
            LanguageProvider,
            React,
            RecordingTagManager,
            renderToStaticMarkup,
        } = renderedRuntime;
        const tag: RecordingTag = {
            color: "blue",
            icon: "grid",
            id: "tag-review",
            name: "Review",
        };
        const renderTagManager = (language: UiLanguage) =>
            renderToStaticMarkup(
                React.createElement(
                    LanguageProvider,
                    { children: undefined, language },
                    React.createElement(RecordingTagManager, {
                        availableTags: [tag],
                        onAvailableTagsChange: vi.fn(),
                        onClose: vi.fn(),
                        onRecordingTagsChange: vi.fn(),
                        recording: {
                            id: "recording-tag-i18n",
                            tags: [tag],
                        } as unknown as Parameters<
                            typeof RecordingTagManager
                        >[0]["recording"],
                    }),
                ),
            );
        const renderAiReview = (language: UiLanguage) =>
            renderToStaticMarkup(
                React.createElement(
                    LanguageProvider,
                    { children: undefined, language },
                    React.createElement(AiRenamePreviewCard, {
                        applyLabel: translate(language, "common.confirm"),
                        cancelLabel: translate(language, "common.cancel"),
                        filename: "Generated user title",
                        isApplying: false,
                        isRegenerating: false,
                        originalFilename: "Original user title",
                        state: "review",
                        title: "AI rename",
                    }),
                ),
            );

        const chineseTagHtml = renderTagManager("zh-CN");
        expect(chineseTagHtml).toContain("管理标签");
        expect(chineseTagHtml).toContain("这条录音的标签");
        expect(chineseTagHtml).toContain('aria-label="编辑 Review"');
        expect(chineseTagHtml).toContain('aria-label="删除 Review"');
        expect(chineseTagHtml).toContain('aria-label="关闭标签管理"');
        const chineseAiHtml = renderAiReview("zh-CN");
        expect(chineseAiHtml).toContain("复核确认");
        expect(chineseAiHtml).toContain("原标题");
        expect(chineseAiHtml).toContain("新标题");

        const englishTagHtml = renderTagManager("en");
        expect(englishTagHtml).toContain("Manage tags");
        expect(englishTagHtml).toContain("Tags on this recording");
        expect(englishTagHtml).toContain('aria-label="Edit Review"');
        expect(englishTagHtml).toContain('aria-label="Delete Review"');
        expect(englishTagHtml).toContain('aria-label="Close tag manager"');
        expect(englishTagHtml).toContain("Review");
        expect(englishTagHtml).not.toMatch(/[\p{Script=Han}]/u);

        const englishAiHtml = renderAiReview("en");
        expect(englishAiHtml).toContain("Review and confirm");
        expect(englishAiHtml).toContain("Original title");
        expect(englishAiHtml).toContain("New title");
        expect(englishAiHtml).toContain("Original user title");
        expect(englishAiHtml).toContain("Generated user title");
        expect(englishAiHtml).not.toMatch(/[\p{Script=Han}]/u);

        const tagManagerSource = readSource(
            "features/recordings/components/recording-tag-manager.tsx",
        );
        const aiRenameSource = readSource(
            "features/recordings/components/ai-rename-preview-card.tsx",
        );
        expect(tagManagerSource).not.toMatch(/[\p{Script=Han}]/u);
        expect(aiRenameSource).not.toMatch(/[\p{Script=Han}]/u);
        for (const key of [
            "recordingTagManager.assignmentFailed",
            "recordingTagManager.createFailed",
            "recordingTagManager.updateFailed",
            "recordingTagManager.deleteFailed",
            "recordingTagManager.operationFailed",
            "recordingTagManager.color",
            "recordingTagManager.icon",
            "recordingTagManager.newTagDescription",
            "recordingTagManager.deleteDescription",
            "recordingTagManager.colors.blue",
            "recordingTagManager.icons.grid",
            "recordingDetail.ai.reviewState",
            "recordingDetail.ai.originalTitle",
            "recordingDetail.ai.newTitle",
        ]) {
            expect(translate("zh-CN", key)).not.toBe(key);
            expect(translate("en", key)).not.toBe(key);
        }
    });
});
