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
    /uikit-|glass-surface|glass-control|border-border|rounded-2xl|shadow-2xl|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

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
        const card = readSource("components/ui/card.tsx");
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

    it("renders the dashboard from the SOT workstation shell instead of compatibility components", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const globals = readSource("app/globals.css");

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
        expect(workstation).toMatch(
            /<div\s+data-sot-format="mono"\s+data-sot-part="dashboard-activity-status-sub"\s*>/,
        );
        expect(globals).toContain(
            '[data-sot-part="dashboard-activity-status-sub"]',
        );
        expect(workstation).toContain('data-sot-control="dashboard-settings"');
        expect(workstation).toContain('data-sot-part="dashboard-user-avatar"');
        expect(workstation).toMatch(
            /<Button\s+asChild\s+variant="ghost"\s+size="icon-sm"\s*>\s*<button[\s\S]*data-sot-control="dashboard-settings"[\s\S]*data-sot-part="dashboard-user-avatar"/,
        );
        expect(globals).toContain(
            '[data-sot-control="dashboard-settings"][data-sot-part="dashboard-user-avatar"]',
        );
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
        const globals = readSource("app/globals.css");

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
        expect(workstation).toMatch(
            /<Card\s+hasNoPadding[\s\S]*data-sot-surface="dashboard-recording-list"[\s\S]*<CardContent\s+data-sot-part="dashboard-recording-list-content">/,
        );
        expect(globals).toContain(
            '[data-sot-surface="dashboard-recording-list"][data-slot="card"]',
        );
        expect(globals).toMatch(
            /\[data-sot-surface="dashboard-recording-list"\]\s+\[data-sot-part="dashboard-recording-list-content"\]\[data-slot="card-content"\]/,
        );
        expect(workstation).toContain('data-sot-list="dashboard-sources"');
        expect(workstation).toContain(
            'data-sot-control="dashboard-source-provider"',
        );
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
        expect(workstation).toContain("<ToggleGroup");
        expect(workstation).toContain("<ToggleGroupItem");
        expect(workstation).toContain(
            'data-sot-panel="dashboard-recording-time-filter"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-recording-time-filter"',
        );
        expect(workstation).toContain("data-tag-filter-trigger");
        expect(workstation).toContain("data-tag-filter-list");
        expect(workstation).toContain('role="listbox"');
        expect(workstation).toContain('role="option"');
        expect(workstation).toContain("data-tag-value={option.value}");
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
        expect(workstation).toContain('hidden={detailTab !== "transcript"}');
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
        const sourceReportLoaded = extractBoundedSlice(
            workstation,
            'state="loaded"\n                                            subState={sourceReportSubState}',
            "data-sot-source-report-actions",
        );
        for (const hook of DASHBOARD_SOURCE_REPORT_LOADED_SOT_HOOKS) {
            expect(sourceReportLoaded).toContain(hook);
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
        expect(workstation).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(workstation).toContain(
            'import { Slider } from "@/components/ui/slider";',
        );
        expect(workstation).toContain("<Button");
        expect(workstation).toContain("<Skeleton");
        expect(workstation).toContain("<Slider");
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

        expect(banner).toContain('className={cn("sys-banner", className)}');
        expect(banner).toContain("getBannerA11y(banner.state)");
        expect(banner).toContain("data-kind={banner.state}");
        expect(banner).toContain("data-pct={progress ?? undefined}");
        expect(banner).toContain('"sbn-progress"');
        expect(banner).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(banner).toContain("<Button");
        expect(banner).toContain('size="sm"');
        expect(banner).toContain('size="icon-sm"');
        expect(banner).toContain('variant="ghost"');
        expect(banner).toContain("variant={");
        expect(banner).not.toContain("btn ghost btn-sm");
        expect(banner).toContain("<SystemBannerIcon");
        expect(banner).toContain("visibleBanners.length === 0");
        expect(banner).toContain('banner.state === "update-available"');
        expect(banner).toContain("window.location.reload()");
        expect(banner).not.toContain("lucide-react");
        expect(banner).not.toContain("data-system-banner");
        expect(banner).not.toContain("data-sot-panel");
        expect(banner).not.toContain("data-sot-state");
        expect(banner).not.toMatch(OLD_UI_RE);
    });
});
