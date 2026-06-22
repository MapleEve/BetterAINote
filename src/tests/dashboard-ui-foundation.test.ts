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

function extractOpeningElement(source: string, marker: string, tagName: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf(`<${tagName}`, markerIndex);
    const end = source.indexOf(">", markerIndex);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(markerIndex);
    return source.slice(start, end + 1);
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
    "dashboardRecordingRow",
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
    "dashboardRecordingRow",
    "recordingListChipClear",
    "sourceFilterClear",
    "sourceFilterAction",
    "sourceFilterClearAll",
    "recordingListTagFilterTrigger",
    "recordingListTagFilterOption",
    "recordingListStateAction",
    "recordingListPagination",
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

const OLD_UI_RE =
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

const DASHBOARD_RECORDING_LIST_BATCH_LEGACY_CLASS_NAMES = [
    'className="tag-filter"',
    'className="tag-filter-trigger"',
    'className="tag-filter-label"',
    'className="tag-filter-count"',
    'className="tag-filter-caret"',
    'className="tag-filter-list"',
    'className="tag-filter-option"',
    'className="tag-filter-option-label"',
    'className="tag-filter-option-count"',
    'className="list-scroll"',
    'className="ls-group"',
    'className="day"',
    'className="d"',
    'className="c"',
    'className="line"',
    'className="list-state-block"',
    'className="list-state-block list-state-pagination"',
    'className="lsb-ico"',
    'className="lsb-t"',
    'className="lsb-h"',
    'className="lsb-page-divider"',
    'className="lsb-page-nav"',
    'className="lsb-page-num mono"',
];

const DASHBOARD_RECORDING_LIST_BATCH_SOT_HOOKS = [
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
    'data-sot-part="recording-list-state-icon"',
    'data-sot-part="recording-list-state-title"',
    'data-sot-part="recording-list-state-description"',
    'data-sot-part="recording-list-page-divider"',
    'data-sot-part="recording-list-page-nav"',
    'data-sot-part="recording-list-page-number"',
];

const DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_SELECTORS = [
    '[data-sot-surface="dashboard-recording-list"][data-slot="card"]',
    '[data-sot-part="dashboard-recording-list-content"][data-slot="card-content"]',
    '[data-sot-panel="dashboard-recording-time-filter"][data-slot="toggle-group"]',
    '[data-sot-control="dashboard-recording-time-filter"][data-slot="toggle-group-item"]',
    '[data-sot-control="dashboard-recording-time-filter"][data-slot="toggle-group-item"]:hover',
    '[data-sot-control="dashboard-recording-time-filter"][data-slot="toggle-group-item"][data-sot-state="selected"]',
    '[data-sot-control="source-filter-clear"][data-slot="button"]',
    '[data-sot-control="source-filter-clear-all"][data-slot="button"]',
    '[data-sot-control="library-search-filter-clear"][data-slot="button"]',
    '[data-sot-control="recording-list-tag-filter-trigger"][data-slot="button"]',
    '[data-sot-control="recording-list-tag-filter"][data-slot="button"]',
    '[data-sot-panel="recording-list-pagination"] [data-slot="button"]',
] as const;

const DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_RE =
    /\[data-sot-surface="dashboard-recording-list"\]\[data-slot="card"\]|\[data-sot-part="dashboard-recording-list-content"\]\[data-slot="card-content"\]|\[data-sot-panel="dashboard-recording-time-filter"\]\[data-slot="toggle-group"\]|\[data-sot-control="dashboard-recording-time-filter"\]\[data-slot="toggle-group-item"\]|\[data-sot-control="(?:source-filter-clear|source-filter-clear-all|library-search-filter-clear|recording-list-tag-filter-trigger|recording-list-tag-filter)"\]\[data-slot="button"\]|\[data-sot-panel="recording-list-pagination"\][\s\S]{0,80}\[data-slot="button"\]/;

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

describe("dashboard SOT foundation", () => {
    it("keeps dashboard route loading skeleton on the shadcn primitive contract", () => {
        const loading = readSource("app/(app)/dashboard/loading.tsx");
        const globals = readSource("app/globals.css");

        expect(loading).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(loading).toContain('aria-busy="true"');
        expect(loading).toContain("<Skeleton");
        expect(loading).toContain('data-sot-shell="dashboard-loading"');
        expect(loading).toContain('data-sot-panel="route-sidebar"');
        expect(loading).toContain('data-sot-panel="route-main"');
        expect(loading).toContain('data-sot-panel="route-topbar"');
        expect(loading).toContain('data-sot-panel="route-workspace"');
        expect(loading).toContain('data-sot-part="route-brand"');
        expect(loading).toContain('data-sot-part="route-brand-name"');
        expect(loading).toContain('data-sot-part="route-brand-subtitle"');
        expect(loading).toContain('data-sot-part="route-crumbs"');
        expect(loading).toContain('data-sot-part="route-crumb-current"');
        expect(loading).toContain('data-sot-panel="dashboard-loading-list"');
        expect(loading).toContain('data-sot-panel="dashboard-loading-detail"');
        expect(loading).toContain('data-sot-panel="recording-list-loading"');
        expect(loading).toContain('data-sot-panel="recording-detail-loading"');
        expect(globals).toContain('[data-sot-shell="dashboard-loading"]');
        expect(globals).toContain('[data-sot-panel="route-sidebar"]');
        expect(globals).toContain('[data-sot-panel="route-main"]');
        expect(globals).toContain('[data-sot-panel="route-topbar"]');
        expect(globals).toContain('[data-sot-panel="route-workspace"]');
        expect(loading).not.toContain('className="app"');
        expect(loading).not.toContain('className="sidebar glass glass-strong"');
        expect(loading).not.toContain('className="main"');
        expect(loading).not.toContain('className="topbar"');
        expect(loading).not.toContain('className="workspace"');
        expect(loading).not.toContain('className="brand"');
        expect(loading).not.toContain('className="brand-text"');
        expect(loading).not.toContain('className="brand-name"');
        expect(loading).not.toContain('className="brand-sub"');
        expect(loading).not.toContain('className="crumbs"');
        expect(loading).not.toContain('className="crumb-current"');
        expect(loading).not.toContain('className="panel"');
        expect(loading).not.toContain('className="detail panel"');
        expect(loading).not.toContain('className="skel-list"');
        expect(loading).not.toContain('className="skel-detail"');
        expect(loading).not.toContain('className="sk sk-title"');
        expect(loading).not.toContain('className="sk sk-bar"');
    });

    it("keeps shadcn foundation primitives real without reintroducing dashboard compatibility surfaces", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const badge = readSource("components/ui/badge.tsx");
        const button = readSource("components/ui/button.tsx");
        const card = readSource("components/ui/card.tsx");
        const input = readSource("components/ui/input.tsx");
        const breadcrumb = readSource("components/ui/breadcrumb.tsx");
        const sidebar = readSource("components/ui/sidebar.tsx");

        for (const primitiveSource of [card, breadcrumb, sidebar]) {
            expect(primitiveSource.trim()).not.toBe("export {};");
        }

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
        expect(card).toContain("detailHeader:");
        expect(card).toContain("data-[sot-state=saving]:py-0");
        expect(card).toContain(
            'detailHeaderTitle: "leading-none font-semibold min-w-0 flex-1 truncate"',
        );
        expect(badge).toContain("detailHeaderLocal:");
        expect(badge).toContain("detailHeaderStatus:");
        expect(badge).toContain("ml-1 shrink-0");
        expect(button).toContain("detailHeaderIconAction:");
        expect(button).toContain("detailHeaderAction:");
        expect(button).toContain('detailHeaderIconAction: "size-[32px]"');
        expect(input).toContain("detailHeaderTitle:");
        expect(input).toContain(
            '"h-8 min-w-0 flex-1 px-3 py-1 text-base md:text-sm"',
        );

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

        expect(workstation).toContain("@/components/ui/card");
        expect(workstation).not.toContain("@/components/ui/breadcrumb");
        expect(workstation).not.toContain("@/components/ui/sidebar");
    });

    it("keeps the dashboard recording player composed through shadcn slots instead of CSS primitive repaints", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const alert = readSource("components/ui/alert.tsx");
        const badge = readSource("components/ui/badge.tsx");
        const button = readSource("components/ui/button.tsx");
        const globals = readSource("app/globals.css");
        const playerSurfaceIndex = workstation.indexOf(
            'data-sot-surface="dashboard-recording-player"',
        );
        const playerStart = workstation.lastIndexOf(
            "<Card",
            playerSurfaceIndex,
        );
        const transcriptShellIndex = workstation.indexOf(
            'data-sot-panel="dashboard-transcript-shell"',
            playerSurfaceIndex,
        );
        expect(playerSurfaceIndex).toBeGreaterThanOrEqual(0);
        expect(playerStart).toBeGreaterThanOrEqual(0);
        expect(transcriptShellIndex).toBeGreaterThan(playerSurfaceIndex);
        const player = workstation.slice(playerStart, transcriptShellIndex);
        const statusBadge = extractOpeningElement(
            player,
            'data-sot-control="player-status"',
            "Badge",
        );
        const noAudioAlert = extractOpeningElement(
            player,
            'data-sot-part="dashboard-recording-player-no-audio"',
            "Alert",
        );
        const noAudioTitle = extractOpeningElement(
            player,
            'data-sot-part="dashboard-recording-player-no-audio-title"',
            "AlertTitle",
        );
        const noAudioDescription = extractOpeningElement(
            player,
            'data-sot-part="dashboard-recording-player-no-audio-description"',
            "AlertDescription",
        );
        const volumeMuteControl = extractOpeningElement(
            player,
            'data-sot-control="dashboard-player-volume-mute"',
            "Button",
        );

        expect(player).toContain("<Card");
        expect(player).toContain(
            'className="min-h-[114px] gap-0 overflow-visible rounded-[16px] border-[var(--glass-border-soft)] bg-[rgb(255_255_255_/_0.025)] px-[18px] py-[16px] shadow-none backdrop-blur-none"',
        );
        expect(player).toContain("<Alert");
        expect(alert).toContain("playerNoAudio:");
        expect(noAudioAlert).toContain('variant="playerNoAudio"');
        expect(noAudioAlert).toContain('density="playerNoAudio"');
        expect(noAudioAlert).toContain('layout="playerNoAudio"');
        expect(noAudioAlert).not.toContain("className=");
        expect(alert).toContain("data-player-no-audio-text");
        expect(alert).not.toContain("dashboard-recording-player-no-audio-text");
        expect(alert).not.toContain("recording-player-no-audio-text");
        expect(player).toContain("<SotPlayerNoAudioIcon");
        expect(player).not.toContain(
            '<SotPlayerNoAudioIcon className="size-3.5" />',
        );
        expect(player).toContain("data-player-no-audio-text");
        expect(player).toContain(
            'data-sot-part="dashboard-recording-player-no-audio-text"',
        );
        expect(noAudioTitle).toContain('density="playerNoAudio"');
        expect(noAudioDescription).toContain('density="playerNoAudio"');
        expect(player).toContain("<CardHeader");
        expect(player).toContain(
            'className="mb-[12px] flex flex-row flex-wrap items-center gap-[10px] p-0"',
        );
        expect(player).toContain("<CardContent");
        expect(player).toContain(
            'className="flex min-w-0 items-center gap-[12px] overflow-visible p-0"',
        );
        expect(button).toContain("playerControl:");
        expect(button).toContain("playerPrimary:");
        expect(button).toContain("playerSpeed:");
        expect(button).toContain("playerControlSm:");
        expect(button).toContain("playerControlLg:");
        expect(button).toContain("size-[36px]");
        expect(button).toContain("size-[30px]");
        expect(button).toContain("size-[44px]");
        expect(button).toContain("min-w-[50px]");
        expect(button).toContain("data-player-control-icon");
        expect(button).not.toContain("dashboard-player-volume-icon");
        expect(button).not.toContain("recording-player-volume-icon");
        expect(player).toContain('variant="playerControl"');
        expect(player).toContain('size="playerControl"');
        expect(player).toContain('variant="playerPrimary"');
        expect(player).toContain('size="playerControlLg"');
        expect(player).toContain('variant="playerSpeed"');
        expect(player).toContain('size="playerSpeed"');
        expect(player).toContain('size="playerControlSm"');
        expect(volumeMuteControl).toContain('variant="playerControl"');
        expect(volumeMuteControl).toContain('size="playerControlSm"');
        expect(volumeMuteControl).not.toContain("className=");
        expect(player).toContain("data-player-control-icon");
        expect(player).not.toContain("SOT_PLAYER_BUTTON_CLASS");
        expect(player).not.toContain("SOT_PLAYER_PRIMARY_BUTTON_CLASS");
        expect(player).not.toContain("SOT_PLAYER_BUTTON_SM_CLASS");
        expect(player).not.toContain("SOT_PLAYER_SPEED_BUTTON_CLASS");
        expect(player).not.toContain('variant="ghost"');
        expect(player).not.toContain('variant="outline"');
        expect(player).not.toContain('variant="default"');
        expect(player).not.toContain('size="icon-sm"');
        expect(player).not.toContain('size="icon-xs"');
        expect(player).not.toContain('size="sm"');
        expect(player).not.toContain('variant="player"');
        expect(player).not.toContain('variant="player-primary"');
        expect(player).not.toContain('size="player"');
        expect(player).not.toContain('size="player-lg"');
        expect(player).not.toContain('size="player-sm"');
        expect(badge).toContain("playerSource:");
        expect(badge).toContain("playerStatus:");
        expect(badge).toContain("playerTagChip:");
        expect(badge).toContain("playerTagOverflow:");
        expect(player).toContain("<Badge");
        expect(statusBadge).toContain('variant="playerStatus"');
        expect(statusBadge).toContain('className="ml-auto"');
        expect(statusBadge).toContain('data-sot-control="player-status"');
        expect(statusBadge).toMatch(
            /data-sot-tone=\{\s*selectedPlayerStatus\.tone\s*\}/,
        );
        expect(player).not.toContain("SOT_PLAYER_STATUS_BADGE_CLASS");
        expect(player).toContain('data-sot-part="status-dot"');
        expect(player).toContain(
            'data-sot-panel="dashboard-recording-player-controls"',
        );
        expect(player).toContain('data-sot-control="dashboard-player-seek"');
        expect(player).toContain('variant="playerSeek"');
        expect(player).toContain('className="flex-none"');
        expect(player).not.toContain("SOT_PLAYER_SEEK_SLIDER_CLASS");
        expect(player).not.toContain("SOT_PLAYER_SEEK_RANGE_CLASS");
        expect(player).not.toContain("SOT_PLAYER_SEEK_THUMB_CLASS");
        expect(player).not.toContain("dashboardSeekSliderRootStyle");
        expect(player).not.toContain("sotPlayerSeekRangeStyle");
        expect(player).not.toContain("sotPlayerSeekThumbStyle");
        expect(player).not.toContain("className: SOT_PLAYER");
        expect(player).not.toContain("style: sotPlayer");
        expect(player).not.toContain("style: dashboardSeekSliderRootStyle");
        expect(player).toContain('data-sot-control="dashboard-player-volume"');
        expect(player).toContain("<Popover");
        expect(player).toContain("<PopoverTrigger asChild>");
        expect(player).toContain("<PopoverContent");
        expect(player).toContain('variant="playerVolume"');
        expect(player).not.toContain(
            'className="w-[200px] min-w-[200px] gap-0 overflow-visible px-2.5 py-2"',
        );
        expect(player).not.toContain("SOT_PLAYER_VOLUME_SLIDER_CLASS");
        expect(player).toContain('side="top"');
        expect(player).toContain('align="end"');

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
        for (const selector of [
            '[data-sot-part="dashboard-recording-player-no-audio"][data-slot="alert"]',
            '[data-sot-part="dashboard-recording-player-no-audio-title"][data-slot="alert-title"]',
            '[data-sot-part="dashboard-recording-player-no-audio-description"][data-slot="alert-description"]',
            '[data-sot-panel="dashboard-player-volume-popover"][data-slot="popover-content"]',
            '[data-sot-control="player-source-tag"][data-slot="badge"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
        for (const [surface, selector] of [
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
        ] as const) {
            expect(
                collectCssRuleBlocks(globals, selector).filter(({ prelude }) =>
                    prelude.includes(surface),
                ),
            ).toEqual([]);
        }
        expect(globals).toContain(
            '[data-sot-part="dashboard-player-seek-shell"]',
        );
        expect(player).not.toContain(
            'data-sot-part="dashboard-player-seek-thumb"',
        );
        const dashboardPlayerSliderPrimitiveBlocks = [
            "dashboard-player-seek",
            "dashboard-player-volume-slider",
        ].flatMap((control) =>
            ["slider", "slider-track", "slider-range", "slider-thumb"].flatMap(
                (slot) =>
                    collectCssRuleBlocks(
                        globals,
                        `[data-slot="${slot}"]`,
                    ).filter(({ prelude }) =>
                        prelude.includes(`[data-sot-control="${control}"]`),
                    ),
            ),
        );
        expect(dashboardPlayerSliderPrimitiveBlocks).toEqual([]);
    });

    it("renders the dashboard from the SOT workstation shell instead of compatibility components", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const button = readSource("components/ui/button.tsx");
        const globals = readSource("app/globals.css");
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

        for (const variant of [
            "dashboardNav",
            "dashboardSource",
            "dashboardSync",
            "dashboardSourceAction",
            "dashboardCopy",
            "dashboardCompactAction",
            "dashboardDrawerTrigger",
            "dashboardSidebarCollapse",
            "dashboardSettingsAvatar",
        ]) {
            expect(buttonVariantBlock).toContain(`${variant}:`);
        }
        for (const size of [
            "dashboardNav",
            "dashboardSource",
            "dashboardSync",
            "dashboardSourceAction",
            "dashboardCopy",
            "dashboardCompactAction",
            "dashboardDrawerTrigger",
            "dashboardSidebarCollapse",
            "dashboardSettingsAvatar",
        ]) {
            expect(buttonSizeBlock).toContain(`${size}:`);
        }
        for (const copyStateClass of [
            "data-[copy-state=ok]:border-[var(--button-copy-success-border)]",
            "data-[copy-state=ok]:bg-[var(--button-copy-success-bg)]",
            "data-[copy-state=ok]:text-[var(--signal-success)]",
            "data-[copy-state=err]:border-[var(--button-copy-danger-border)]",
            "data-[copy-state=err]:text-[var(--signal-danger)]",
            "data-[copy-state=err]:hover:bg-transparent",
        ]) {
            expect(buttonVariantBlock).toContain(copyStateClass);
        }
        for (const removedConstant of DASHBOARD_SHELL_SOURCE_BUTTON_CONSTANTS) {
            expect(workstation).not.toContain(removedConstant);
        }
        for (const variant of DASHBOARD_RECORDING_LIST_BUTTON_VARIANTS) {
            expect(buttonVariantBlock).toContain(`${variant}:`);
        }
        for (const size of DASHBOARD_RECORDING_LIST_BUTTON_SIZES) {
            expect(buttonSizeBlock).toContain(`${size}:`);
        }
        for (const variant of [
            "playerTagAdd",
            "playerTagChip",
            "playerTagOverflow",
        ]) {
            expect(buttonVariantBlock).toContain(`${variant}:`);
            expect(buttonSizeBlock).toContain(`${variant}:`);
        }

        for (const removed of [
            "ActivityOverlay",
            "LibrarySearch",
            "RecordingList",
            "SourceFilterStackStrip",
            "SourceProviderRows",
            "SyncStatus",
            "TranscriptionPanel",
        ]) {
            expect(workstation).not.toMatch(new RegExp(`<${removed}[\\s/>]`));
            expect(workstation).not.toContain(
                `./components/${removed
                    .replace(
                        /[A-Z]/g,
                        (match, index) =>
                            `${index ? "-" : ""}${match.toLowerCase()}`,
                    )
                    .replace("source-provider-rows", "source-provider-rows")}`,
            );
        }

        expect(workstation).toContain(
            'data-sot-surface="dashboard-workstation"',
        );
        expect(workstation).toContain(
            'data-sot-state={hydrated ? "ready" : "loading"}',
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
        expect(workstation).toContain('data-sot-control="dashboard-search"');
        expect(workstation).toContain('data-sot-control="dashboard-activity"');
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
        const dashboardFavoriteButton = extractBoundedSlice(
            workstation,
            'variant="dashboardNav"',
            'data-sot-part="dashboard-favorite-label"',
        );
        const dashboardFavoriteButtonOpening = extractBoundedSlice(
            workstation,
            'variant="dashboardNav"',
            ">",
        );
        expect(dashboardFavoriteButton).toContain('variant="dashboardNav"');
        expect(dashboardFavoriteButton).toContain('size="dashboardNav"');
        expect(dashboardFavoriteButtonOpening).not.toContain("className=");
        expect(dashboardFavoriteButton).toContain(
            '<Icon data-icon="inline-start" />',
        );
        const dashboardActivityDismissButton = extractBoundedSlice(
            workstation,
            'data-sot-control="dashboard-activity-dismiss"',
            "</Button>",
        );
        expect(dashboardActivityDismissButton).toContain(
            '<X data-icon="inline-start" />',
        );
        expect(workstation).toMatch(
            /<div\s+data-sot-format="mono"\s+data-sot-part="dashboard-activity-status-sub"\s*>/,
        );
        expect(globals).toContain(
            '[data-sot-part="dashboard-activity-status-sub"]',
        );
        expect(workstation).toContain('data-sot-control="dashboard-settings"');
        expect(workstation).toContain('data-sot-part="dashboard-user-avatar"');
        expect(workstation).toMatch(
            /<Button\s+asChild\s+variant="dashboardSettingsAvatar"\s+size="dashboardSettingsAvatar"[\s\S]*>\s*<button[\s\S]*data-sot-control="dashboard-settings"[\s\S]*data-sot-part="dashboard-user-avatar"/,
        );
        expect(globals).not.toContain(
            '[data-sot-control="dashboard-settings"][data-sot-part="dashboard-user-avatar"]',
        );
        for (const primitiveSelector of [
            '[data-sot-control="sidebar-collapse"][data-slot="button"]',
            '[data-sot-control="dashboard-favorite"][data-slot="button"]',
            '[data-sot-control="dashboard-source-provider"][data-slot="button"]',
            '[data-sot-control="dashboard-sync"][data-slot="button"]',
            '[data-sot-control="dashboard-settings"][data-slot="button"]',
        ]) {
            expect(globals).not.toContain(primitiveSelector);
        }
        expect(workstation).not.toMatch(
            /className\s*=\s*(?:["'](?:mono|avatar)["']|\{["'](?:mono|avatar)["']\})/,
        );
        expect(workstation).toContain(
            'data-empty={selectedRecording ? "false" : "true"}',
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
        expect(workstation).toContain('aria-label="详情标签"');
        expect(workstation).toContain(
            'aria-label={isPlaying ? "暂停" : "播放"}',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-player-play"',
        );
        expect(workstation).toContain('data-sot-part="dashboard-copy-label"');
        expect(workstation).not.toContain('className="copy-label"');
        expect(workstation).not.toContain('className="play rounded-full"');
        expect(workstation).toContain("<SettingsDialog");
        expect(workstation).not.toMatch(OLD_UI_RE);
        expect(workstation).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps source rows, stacked filters, list modes, and detail tabs wired in the workstation", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const badgePrimitive = readSource("components/ui/badge.tsx");
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const cardPrimitive = readSource("components/ui/card.tsx");
        const globals = readSource("app/globals.css");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const toggleGroupPrimitive = readSource(
            "components/ui/toggle-group.tsx",
        );

        for (const provider of [
            "dingtalk-a1",
            "ticnote",
            "plaud",
            "feishu-minutes",
            "iflyrec",
        ]) {
            expect(workstation).toContain(provider);
        }

        expect(workstation).not.toContain('className="panel list-panel"');
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
        for (const selector of DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(workstation).toContain('data-sot-list="dashboard-sources"');
        expect(workstation).toContain(
            'data-sot-control="dashboard-source-provider"',
        );
        expect(workstation).toContain('variant="dashboardSource"');
        expect(workstation).toContain('size="dashboardSource"');
        expect(workstation).toContain('data-sot-part="source-provider-label"');
        expect(workstation).toContain('data-sot-part="source-provider-status"');
        expect(workstation).toContain("sourceRowDisabled(");
        expect(workstation).toContain("sourceActionKind(");
        expect(workstation).toContain("disabled={disabledSourceRow}");
        expect(workstation).toContain('data-sot-part="source-provider-action"');
        expect(workstation).toContain("data-sot-action={actionKind}");
        expect(workstation).toContain('? "retry-sync"');
        expect(workstation).not.toContain('className="src-action is-busy"');
        expect(workstation).toContain("data-sot-status={item.status}");
        expect(workstation).toContain("sourceNeedsSettings(");
        expect(workstation).toContain('openSettings("data-sources")');
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
        expect(buttonPrimitive).toContain("sourceFilterClear:");
        expect(workstation).toMatch(
            /<Button\s+variant="sourceFilterClear"\s+size="sourceFilterClear"[\s\S]*data-sot-control="source-filter-clear"/,
        );
        expect(workstation).toMatch(
            /<Button\s+variant="recordingListChipClear"\s+size="recordingListChipClear"[\s\S]*data-sot-control="library-search-filter-clear"/,
        );
        for (const control of [
            "source-filter-retry-sync",
            "source-filter-widen",
            "source-filter-open-settings",
        ]) {
            expect(workstation).toMatch(
                new RegExp(
                    `<Button\\s+variant="sourceFilterAction"\\s+size="sourceFilterAction"[\\s\\S]*data-sot-control="${control}"[\\s\\S]*data-sot-part="source-filter-action"`,
                ),
            );
        }
        expect(workstation).toMatch(
            /<Button\s+variant="sourceFilterClearAll"\s+size="sourceFilterClearAll"[\s\S]*data-sot-control="source-filter-clear-all"/,
        );
        expect(workstation).toContain("<ToggleGroup");
        expect(workstation).toContain("<ToggleGroupItem");
        expect(workstation).toContain(
            'data-sot-panel="dashboard-recording-time-filter"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-recording-time-filter"',
        );
        const recordingTimeFilter = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-recording-time-filter"',
            "ToggleGroup",
        );
        for (const semanticToken of [
            'spacing="dashboardRecordingTimeFilter"',
            'layout="dashboardRecordingTimeFilter"',
            'variant="dashboardRecordingTimeFilter"',
            'size="dashboardRecordingTimeFilter"',
        ]) {
            expect(recordingTimeFilter).toContain(semanticToken);
        }
        expect(recordingTimeFilter).not.toContain('variant="outline"');
        expect(recordingTimeFilter).not.toContain('size="sm"');
        expect(recordingTimeFilter).not.toContain("className=");
        expect(toggleGroupPrimitive).toContain("dashboardRecordingTimeFilter");
        expect(workstation).toContain("data-tag-filter-trigger");
        expect(workstation).toContain("data-tag-filter-list");
        expect(workstation).toContain('role="listbox"');
        expect(workstation).toContain('role="option"');
        expect(workstation).toMatch(
            /<Button\s+variant="recordingListTagFilterTrigger"\s+size="recordingListTagFilterTrigger"[\s\S]*data-sot-control="recording-list-tag-filter-trigger"/,
        );
        expect(workstation).toMatch(
            /<Button\s+variant="recordingListTagFilterOption"\s+size="recordingListTagFilterOption"[\s\S]*role="option"[\s\S]*data-sot-control="recording-list-tag-filter"[\s\S]*data-sot-state=\{\s*active\s*\?\s*"selected"\s*:\s*"idle"\s*\}/,
        );
        expect(workstation).not.toMatch(
            /variant=\{\s*active\s*\?\s*"secondary"\s*:\s*"ghost"\s*\}/,
        );
        expect(workstation).toMatch(/data-tag-value=\{\s*option\.value\s*\}/);
        for (const hook of DASHBOARD_RECORDING_LIST_BATCH_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const legacyClassName of DASHBOARD_RECORDING_LIST_BATCH_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toContain(legacyClassName);
        }
        expect(workstation).toContain("tagFilterValue(tag.id)");
        expect(workstation).toContain('"untagged"');
        expect(workstation).toContain("displayTag?: RecordingTag");
        expect(workstation).toContain("displayTag: tag");
        expect(workstation).toContain("entry.displayTag ??");
        expect(workstation).toContain("<Badge");
        expect(workstation).toContain("data-recording-tag-chip");
        const dashboardRecordingTagChip = extractOpeningElement(
            workstation,
            "data-recording-tag-chip",
            "Badge",
        );
        expect(dashboardRecordingTagChip).toContain(
            'variant="recordingTagChip"',
        );
        expect(dashboardRecordingTagChip).not.toContain('variant="outline"');
        expect(badgePrimitive).toContain("recordingTagChip:");
        expect(globals).not.toContain(
            '[data-recording-tag-chip][data-variant="recordingTagChip"]',
        );
        expect(globals).toContain(
            '[data-recording-tag-chip][data-variant="outline"]',
        );
        expect(workstation).toContain("<RecordingTagIconGlyph");
        expect(workstation).toContain("data-rec={");
        expect(workstation).not.toContain("function tagClass(");
        expect(workstation).toContain("function SotRecordingListSkeleton()");
        expect(workstation).toContain("<Skeleton");
        expect(workstation).toContain(
            'data-sot-panel="recording-list-loading"',
        );
        expect(workstation).toContain('data-sot-part="skeleton-row"');
        expect(workstation).toContain('data-sot-part="skeleton-title"');
        expect(workstation).not.toContain('className="skel-list"');
        expect(workstation).not.toContain('className="day skel-day"');
        expect(workstation).not.toContain('className="row skel-row"');
        expect(workstation).not.toContain('className="sk sk-title"');
        expect(workstation).not.toContain('className="filter-row"');
        expect(workstation).not.toContain('"chip-f"');
        expect(workstation).not.toContain('"chip-f active"');
        expect(workstation).not.toContain('className="chip-c"');
        expect(workstation).not.toContain('className="row"');
        expect(workstation).not.toContain('className="real-list"');
        expect(workstation).not.toContain('"row active"');
        expect(workstation).not.toContain('className="body"');
        expect(workstation).not.toContain('className="title"');
        expect(workstation).not.toContain('className="meta"');
        expect(workstation).not.toContain('className="dur"');
        expect(workstation).not.toContain('className="right"');
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-body"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-title"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-meta"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-duration"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-actions"',
        );
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
        expect(workstation).toContain("aria-current={");
        expect(workstation).not.toContain("data-selected=");
        expect(workstation).toContain('listState === "loading"');
        expect(workstation).toContain("<SotRecordingListSkeleton />");
        expect(workstation).toContain("function getRecordingListStatus(");
        expect(workstation).toContain(
            'data-sot-list="dashboard-recording-rows"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-status"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-status-dot"',
        );
        expect(workstation).toContain('tone: "err"');
        expect(workstation).toContain('tone: "warn"');
        expect(workstation).toContain('tone: "ok"');
        expect(workstation).toContain('tone: "info"');
        expect(workstation).toContain('tone: "neu"');
        expect(workstation).not.toContain('className: "b err"');
        expect(workstation).not.toContain("dotClassName");
        expect(workstation).toContain("recordingList.status.failed");
        expect(workstation).toContain("recordingList.status.pending");
        expect(workstation).not.toContain(
            'className="filter-row"\n                                    data-sot-panel="recording-list-tag-filter"',
        );
        expect(workstation).toContain('aria-label="列表模式"');
        expect(workstation).toContain("<SegmentedTabs");
        const listModeSegmentedTabs = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-mode-segmented"',
            "SegmentedTabs",
        );
        expect(listModeSegmentedTabs).toContain('variant="sotSegmented"');
        expect(listModeSegmentedTabs).toContain('size="sotSegmentedSm"');
        expect(listModeSegmentedTabs).toContain(
            'data-sot-control="segmented-tabs"',
        );
        expect(listModeSegmentedTabs).toContain('data-sot-size="sm"');
        expect(workstation).toContain('value: "timeline"');
        expect(workstation).toContain("recordingList.timeTab");
        expect(workstation).toContain('value: "tags"');
        expect(workstation).toContain("recordingList.tagsTab");
        expect(workstation).toContain('value: "source"');
        expect(workstation).toContain('label: "来源详情"');
        expect(workstation).toContain('tabKey: "source-report"');
        expect(workstation).toContain('value: "transcript"');
        expect(workstation).toContain('label: "转写"');
        expect(workstation).toContain('value: "speakers"');
        expect(workstation).toContain('label: "说话人"');
        const detailSegmentedTabs = extractOpeningElement(
            workstation,
            'aria-label="详情标签"',
            "SegmentedTabs",
        );
        expect(detailSegmentedTabs).toContain('variant="sotSegmented"');
        expect(detailSegmentedTabs).toContain('size="sotSegmentedSm"');
        expect(detailSegmentedTabs).toContain(
            'data-sot-control="segmented-tabs"',
        );
        expect(detailSegmentedTabs).toContain('data-sot-size="sm"');
        expect(workstation).toContain('hidden={detailTab !== "transcript"}');
        expect(workstation).toContain(
            'className="min-h-0 flex-1 gap-0 rounded-2xl"',
        );
        expect(workstation).toContain(
            'className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3.5 py-3"',
        );
        expect(workstation).toContain(
            'className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5"',
        );
        for (const hook of DASHBOARD_DETAIL_PANE_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const hook of DASHBOARD_TRANSCRIPT_TURN_EMPTY_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
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
        expect(badgePrimitive).toContain("dashboardTranscriptLanguage:");
        for (const legacyClassName of DASHBOARD_DETAIL_PANE_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toContain(legacyClassName);
        }
        for (const legacyClassName of DASHBOARD_TRANSCRIPT_TURN_EMPTY_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toContain(legacyClassName);
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
        const sourceReportLoaded = extractBoundedSlice(
            workstation,
            'state="loaded"\n                                            subState={sourceReportSubState}',
            "data-sot-source-report-actions",
        );
        for (const hook of DASHBOARD_SOURCE_REPORT_LOADED_SOT_HOOKS) {
            expect(sourceReportLoaded).toContain(hook);
        }
        expect(sourceReportLoaded).toContain('variant="sourceReportStatus"');
        for (const genericToken of [
            'variant="outline"',
            'variant="ghost"',
            'variant="default"',
            'size="sm"',
        ]) {
            expect(sourceReportLoaded).not.toContain(genericToken);
        }
        const sourceReportOpenAction = extractOpeningElement(
            workstation,
            'data-sot-control="open-source-record"',
            "Button",
        );
        const sourceReportRepullAction = extractOpeningElement(
            workstation,
            'data-sot-control="repull-source"',
            "Button",
        );
        expect(sourceReportOpenAction).toContain(
            'variant="sourceReportAction"',
        );
        expect(sourceReportOpenAction).toContain('size="sourceReportAction"');
        expect(sourceReportRepullAction).toContain(
            'variant="sourceReportGhostAction"',
        );
        expect(sourceReportRepullAction).toContain('size="sourceReportAction"');
        for (const action of [
            sourceReportOpenAction,
            sourceReportRepullAction,
        ]) {
            expect(action).not.toContain('variant="ghost"');
            expect(action).not.toContain('variant="outline"');
            expect(action).not.toContain('size="sm"');
        }
        for (const hook of DASHBOARD_SOURCE_REPORT_META_VALUE_HELPER_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const legacyClassName of DASHBOARD_SOURCE_REPORT_LOADED_LEGACY_CLASS_NAMES) {
            expect(sourceReportLoaded).not.toContain(legacyClassName);
        }
        expect(workstation).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(workstation).not.toContain("type ButtonProps");
        expect(workstation).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(workstation).toContain(
            'import { Slider } from "@/components/ui/slider";',
        );
        expect(workstation).toContain("<Button");
        expect(workstation).toContain("<Skeleton");
        expect(workstation).toContain("<Slider");
        expect(cardPrimitive).toContain("sourceReportMetric:");
        expect(cardPrimitive).toContain(
            "border-[var(--source-report-metric-border)]",
        );
        expect(badgePrimitive).toContain("sourceReportStatus:");
        expect(badgePrimitive).toContain("data-[sot-tone=ok]");
        expect(badgePrimitive).toContain("data-[sot-tone=warn]");
        expect(badgePrimitive).toContain("data-[sot-tone=err]");
        expect(skeletonPrimitive).toContain("dashboardTranscript:");
        for (const size of DASHBOARD_TRANSCRIPT_SKELETON_PRIMITIVE_SIZES) {
            expect(skeletonPrimitive).toContain(size);
        }
        expect(skeletonPrimitive).toContain("sourceReportCard:");
        expect(skeletonPrimitive).toContain("sourceReportSegment:");
        expect(skeletonPrimitive).toContain("sourceReportCardSource");
        expect(skeletonPrimitive).toContain("sourceReportSegmentLineLong");
        expect(workstation).toContain('variant="sourceReportMetric"');
        expect(workstation).toContain('variant="sourceReportStatus"');
        expect(workstation).toContain('variant="dashboardTranscript"');
        expect(workstation).toContain(
            "size={dashboardTranscriptSkeletonSize(size)}",
        );
        expect(workstation).toContain('variant="sourceReportCard"');
        expect(workstation).toContain('variant="sourceReportSegment"');
        expect(workstation).toContain(
            "size={sourceReportCardSkeletonSize(size)}",
        );
        expect(workstation).toContain(
            "size={sourceReportSegmentSkeletonSize(size)}",
        );
        expect(workstation).not.toContain("SOURCE_REPORT_METRIC_CARD_CLASS");
        expect(workstation).not.toContain("SOURCE_REPORT_STATUS_BADGE_CLASS");
        expect(workstation).not.toContain(
            "SOURCE_REPORT_STATUS_BADGE_TONE_CLASS",
        );
        expect(workstation).not.toContain(
            "const dashboardTranscriptSkeletonClassNames",
        );
        expect(workstation).not.toContain(
            "className={dashboardTranscriptSkeletonClassNames[size]}",
        );
        expect(workstation).not.toContain(
            "const sotSourceReportCardSkeletonClassNames",
        );
        expect(workstation).not.toContain(
            "const sotSourceReportSegmentSkeletonClassNames",
        );
        expect(workstation).not.toContain(
            "className={SOURCE_REPORT_METRIC_CARD_CLASS}",
        );
        expect(workstation).not.toContain(
            "className={sotSourceReportCardSkeletonClassNames[size]}",
        );
        expect(workstation).not.toContain(
            "className={sotSourceReportSegmentSkeletonClassNames[size]}",
        );
        expect(workstation).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps PR20 manual sync refresh and SOT sync states on real controls", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain("useBrowserRouteController");
        expect(workstation).toContain("async function runManualSync()");
        expect(workstation).toContain("await manualSync()");
        expect(workstation).toContain(
            "await Promise.all([refreshStatus(), loadDataSources()])",
        );
        expect(workstation).toContain("refreshBrowserRoute(router)");
        expect(workstation).toContain('data-sot-panel="dashboard-sync"');
        expect(workstation).toContain(
            'data-sot-part="dashboard-sync-indicator"',
        );
        expect(workstation).toContain('data-sot-control="dashboard-sync"');
        expect(workstation).toContain('variant="dashboardSync"');
        expect(workstation).toContain('size="dashboardSync"');
        expect(workstation).toContain("data-sync-state={syncButtonState}");
        expect(workstation).toContain("aria-busy={syncButtonBusy}");
        expect(workstation).toContain("disabled={syncButtonBusy}");
        expect(workstation).not.toContain('className="sync-dot"');
        expect(workstation).toContain(
            'data-sot-control="dashboard-activity-sync"',
        );
    });

    it("keeps SOT global tokens and system banner state semantics available", () => {
        const globals = readSource("app/globals.css");
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const progressPrimitive = readSource("components/ui/progress.tsx");
        const segmentedTabs = readSource("components/ui/segmented-tabs.tsx");
        const toggleGroupPrimitive = readSource(
            "components/ui/toggle-group.tsx",
        );
        const banner = readSource(
            "features/dashboard/components/system-banner.tsx",
        );

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

        expect(segmentedTabs).not.toContain(
            'data-sot-control="segmented-tabs"',
        );
        expect(segmentedTabs).not.toContain("data-sot-size={size}");
        expect(segmentedTabs).toContain("data-tabs={items.length}");
        expect(segmentedTabs).toContain("data-active={activeIndex}");
        expect(segmentedTabs).toContain("getItemProps");
        expect(segmentedTabs).not.toContain('data-sot-control="segmented-tab"');
        expect(segmentedTabs).not.toContain("data-sot-state={");
        expect(segmentedTabs).toContain(
            'import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";',
        );
        expect(segmentedTabs).toContain("<ToggleGroup");
        expect(segmentedTabs).toContain("<ToggleGroupItem");
        expect(segmentedTabs).toContain('variant = "sotSegmented"');
        expect(segmentedTabs).toContain('size = "sotSegmentedSm"');
        expect(segmentedTabs).toContain("variant={variant}");
        expect(segmentedTabs).toContain("size={size}");
        expect(segmentedTabs).not.toContain('variant="outline"');
        expect(toggleGroupPrimitive).toContain("sotSegmented:");
        expect(toggleGroupPrimitive).toContain("sotSegmentedSm:");
        expect(segmentedTabs).toContain("spacing={1}");
        expect(segmentedTabs).toContain('type="single"');
        expect(segmentedTabs).toContain("value={value}");
        expect(segmentedTabs).toContain("if (!nextValue) return;");
        expect(segmentedTabs).toContain("onValueChange(nextValue as T)");
        expect(segmentedTabs).toContain(
            "data-tab-key={item.tabKey ?? item.value}",
        );
        expect(segmentedTabs).toContain(
            "aria-disabled={item.disabled || undefined}",
        );
        expect(segmentedTabs).toContain("aria-selected={active}");
        expect(segmentedTabs).toContain("disabled={item.disabled}");
        expect(segmentedTabs).not.toContain("<button");
        expect(segmentedTabs).not.toContain('data-slot="segmented-tabs"');
        expect(segmentedTabs).not.toContain(
            'data-slot="toggle-group-indicator"',
        );
        expect(segmentedTabs).not.toContain(
            'data-sot-part="liquid-tabs-indicator"',
        );
        expect(segmentedTabs).not.toContain('data-sot-control="liquid-tabs"');
        expect(segmentedTabs).not.toContain('data-sot-control="liquid-tab"');
        expect(segmentedTabs).not.toContain("data-idx");
        expect(segmentedTabs).not.toContain('className={cn("liquid-tabs"');
        expect(segmentedTabs).not.toContain('className="liquid-tabs"');
        expect(segmentedTabs).not.toContain('className="lt-ind"');
        expect(segmentedTabs).not.toContain('className={cn("lt-tab"');
        expect(segmentedTabs).not.toContain('className="lt-tab"');

        expect(banner).toContain(
            'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
        );
        expect(banner).toContain(
            'import { Progress } from "@/components/ui/progress";',
        );
        expect(banner).toMatch(/<Alert\s/);
        expect(banner).toContain('variant="systemBanner"');
        expect(banner).toContain('density="systemBanner"');
        expect(banner).toContain('layout="systemBanner"');
        expect(banner).toContain("<AlertTitle");
        expect(banner).toContain("density=\"systemBanner\"");
        expect(banner).toContain("<AlertDescription");
        expect(banner).toContain("</Alert>");
        expect(banner).not.toMatch(/<section[\s>]/);
        expect(banner).toContain('data-sot-panel="system-banner"');
        expect(banner).not.toContain('data-slot="system-banner"');
        expect(banner).toContain('data-sot-part="system-banner-icon"');
        expect(banner).toContain('data-sot-part="system-banner-body"');
        expect(banner).toContain('data-sot-part="system-banner-title"');
        expect(banner).toContain('data-sot-part="system-banner-description"');
        expect(progressPrimitive).toContain(
            '"system-banner-progress"',
        );
        expect(progressPrimitive).toContain(
            '"system-banner-progress-bar"',
        );
        expect(banner).toContain('data-sot-part="system-banner-actions"');
        expect(banner).toContain('data-sot-format={hasProgress ? "mono"');
        expect(banner).toContain("<Progress");
        expect(banner).toContain('variant="systemBanner"');
        expect(banner).toContain("value={progress ?? 0}");
        expect(banner).not.toMatch(
            /<div[\s\S]*data-sot-part="system-banner-progress"/,
        );
        expect(banner).not.toContain(
            '<span data-sot-part="system-banner-progress-bar" />',
        );
        expect(banner).not.toContain('className={cn("sys-banner", className)}');
        expect(banner).not.toContain('className="sys-banner"');
        expect(banner).not.toContain(
            'className={cn("flex items-center gap-3 px-3.5 py-2.5", className)}',
        );
        expect(banner).not.toContain('"sbn-progress"');
        expect(banner).not.toContain('"sbn-bar"');
        expect(banner).not.toContain("sbn-");
        expect(banner).not.toContain('className="mono"');
        expect(banner).toContain("getBannerA11y(banner.state)");
        expect(banner).toContain("data-kind={banner.state}");
        expect(banner).toContain("data-pct={progress ?? undefined}");
        expect(banner).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(banner).toContain("<Button");
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
        expect(banner).toMatch(
            /data-sot-control="system-banner-dismiss-action"[\s\S]*<CloseIcon\s+data-icon="inline-start"\s+aria-hidden="true"\s*\/>/,
        );
        expect(banner).not.toContain("btn ghost btn-sm");
        expect(banner).toContain("<SystemBannerIcon");
        expect(banner).toContain("visibleBanners.length === 0");
        expect(banner).toContain('banner.state === "update-available"');
        expect(banner).toContain("window.location.reload()");
        expect(banner).not.toContain("lucide-react");
        expect(banner).not.toContain("data-system-banner");
        expect(banner).not.toMatch(OLD_UI_RE);
        expect(alertPrimitive).toContain('"systemBanner"');
        expect(alertPrimitive).toContain("data-[kind=offline]");
        expect(buttonPrimitive).toContain("systemBannerAction");
        expect(buttonPrimitive).toContain("systemBannerPrimaryAction");
        expect(buttonPrimitive).toContain("systemBannerDismissAction");
        expect(progressPrimitive).toContain(
            'import { Progress as ProgressPrimitive } from "radix-ui";',
        );
        expect(progressPrimitive).toContain('variant?: ProgressVariant');
        expect(progressPrimitive).toContain('"systemBanner"');
        expect(progressPrimitive).toContain("sbn-sweep");
    });
});
