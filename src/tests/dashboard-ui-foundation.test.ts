import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("dashboard UI foundation", () => {
    it("keeps the web index shell scoped to the three foundation columns", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const globals = readSource("app/globals.css");
        const favoriteSurfaceStart = workstation.indexOf(
            'onClick={() => handleFavoriteSelect("all")}',
        );
        const favoriteSurfaceEnd = workstation.indexOf("<SourceProviderRows");
        const favoriteSurface = workstation.slice(
            favoriteSurfaceStart,
            favoriteSurfaceEnd,
        );

        expect(workstation).toContain("dashboard-workstation-grid");
        expect(workstation).toContain('data-testid="dashboard-workstation"');
        expect(workstation).toContain(
            "lg:grid-cols-[16.5rem_minmax(22rem,24rem)_minmax(0,1fr)]",
        );
        expect(workstation).toContain("lg:col-span-2");
        expect(workstation).toContain("lg:col-start-2 lg:row-start-2");
        expect(workstation).toContain("lg:col-start-3 lg:row-start-2");
        expect(workstation).toContain('data-testid="dashboard-source-rail"');
        expect(workstation).toContain(
            'data-testid="dashboard-source-drawer-trigger"',
        );
        expect(workstation).toContain(
            'data-testid="dashboard-sidebar-collapse-trigger"',
        );
        expect(workstation).toContain("<SourceProviderRows");
        expect(workstation).toContain("<SourceFilterStackStrip");
        expect(workstation).toContain("isSourceDrawerOpen");
        expect(workstation).toContain("isSidebarCollapsed");
        expect(workstation).toContain("filteredRecordings");
        expect(workstation).toContain("recordingListMode");
        expect(favoriteSurfaceStart).toBeGreaterThanOrEqual(0);
        expect(favoriteSurfaceEnd).toBeGreaterThan(favoriteSurfaceStart);
        expect(workstation).not.toContain(
            "data-[active=true]:bg-background/70",
        );
        expect(favoriteSurface).not.toContain("bg-background/50");
        expect(workstation).toContain("data-[active=true]:bg-muted/35");
        expect(workstation).toContain('data-testid="dashboard-favorite-all"');
        expect(workstation).toContain(
            'data-testid="dashboard-favorite-transcribed"',
        );
        expect(workstation).toContain('data-testid="dashboard-favorite-tags"');
        expect(workstation).toContain(
            'data-testid="dashboard-favorite-all-count"',
        );
        expect(workstation).toContain(
            'data-testid="dashboard-favorite-transcribed-count"',
        );
        expect(workstation).toContain(
            'data-testid="dashboard-favorite-tags-count"',
        );
        expect(workstation).toContain("dashboardChrome.privateWorkspace");
        expect(workstation).toContain("dashboardChrome.moreActions");
        expect(workstation).toContain("dashboardChrome.deleteLocalOnly");
        expect(workstation).toContain("@/components/ui/button");
        expect(workstation).not.toContain("私人工作空间");
        expect(workstation).not.toContain("当前录音暂无额外本地操作");
        expect(globals).toContain(".dashboard-workstation");
        expect(globals).toContain(".dashboard-list-panel");
        expect(globals).toContain(
            '.dashboard-workstation-grid[data-sidebar-collapsed="true"]',
        );
    });

    it("keeps dashboard action hover surfaces updated without losing title and favorite interactions", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).not.toContain("hover:bg-background/45");
        expect(workstation).not.toContain("hover:bg-background/50");

        for (const marker of [
            'data-testid="dashboard-favorite-all"',
            'data-testid="dashboard-favorite-transcribed"',
            'data-testid="dashboard-favorite-tags"',
            "handleFavoriteSelect",
            'data-testid="dashboard-ai-rename"',
            'data-testid="dashboard-rename-cancel"',
            "handleAutoRename",
            "handleRenameCancel",
        ]) {
            expect(workstation).toContain(marker);
        }
    });

    it("renders supported source providers as local client rows without remote assets", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const sourceRows = readSource(
            "features/dashboard/components/source-provider-rows.tsx",
        );
        const translations = readSource("lib/i18n.ts");

        for (const provider of [
            "dingtalk-a1",
            "ticnote",
            "plaud",
            "feishu-minutes",
            "iflyrec",
        ]) {
            expect(workstation).toContain(provider);
        }

        expect(sourceRows).toContain('data-testid="source-provider-rows"');
        expect(sourceRows).toContain("data-provider={row.provider}");
        expect(sourceRows).toContain("onSelectProvider(row.provider)");
        expect(sourceRows).toContain("onConnectProvider(row.provider)");
        expect(sourceRows).toContain("aria-pressed={row.active}");
        expect(sourceRows).toContain("focus-visible:ring-[3px]");
        expect(sourceRows).toContain(
            'data-testid="source-provider-row-initial"',
        );
        expect(sourceRows).toContain('data-testid="source-provider-row-badge"');
        expect(sourceRows).toContain("bg-muted/35");
        expect(sourceRows).not.toContain("bg-background/40");
        expect(sourceRows).not.toContain("hover:bg-background/45");
        expect(sourceRows).not.toContain("bg-background/70");
        expect(sourceRows).not.toContain("bg-background/50");
        expect(sourceRows).not.toContain("bg-background/60");
        expect(sourceRows).toContain("compact?: boolean");
        expect(sourceRows).toContain(
            'data-compact={compact ? "true" : "false"}',
        );
        expect(sourceRows).toContain("data-connected");
        expect(sourceRows).toContain("onSelectProvider");
        expect(sourceRows).not.toContain("fetch(");
        expect(sourceRows).not.toContain("process.");
        expect(sourceRows).not.toContain("window.");
        expect(sourceRows).not.toContain("http://");
        expect(sourceRows).not.toContain("https://");
        expect(sourceRows).toContain("@/components/ui/button");
        expect(sourceRows).toContain('variant="outline"');
        expect(sourceRows).toContain('size="sm"');
        expect(sourceRows).toContain("onClick={onClearProvider}");
        expect(sourceRows).toContain("sourceProviderRows.heading");
        expect(sourceRows).toContain("sourceProviderRows.clear");
        expect(sourceRows).not.toContain("待连接");
        expect(sourceRows).not.toContain("需要重新登录");
        expect(translations).toContain("待连接");
        expect(translations).toContain("Re-auth required");
    });

    it("keeps recording list timeline and tag modes controlled by the shell", () => {
        const recordingList = readSource(
            "features/dashboard/components/recording-list.tsx",
        );
        const translations = readSource("lib/i18n.ts");

        expect(recordingList).toContain(
            'export type RecordingListMode = "timeline" | "tags"',
        );
        expect(recordingList).toContain("mode?: RecordingListMode");
        expect(recordingList).toContain("onModeChange?");
        expect(recordingList).toContain("contextLabel?");
        expect(recordingList).toContain("filterStack?");
        expect(recordingList).toContain("libraryTotalCount?");
        expect(recordingList).toContain("isLoading?");
        expect(recordingList).toContain("data-list-state={listState}");
        expect(recordingList).toContain('data-testid="recording-list-loading"');
        expect(recordingList).toContain("recording-list-");
        expect(recordingList).toContain("getSourceProviderLabel");
        expect(recordingList).toContain('data-testid="recording-list-panel"');
        expect(recordingList).toContain("@/components/ui/button");
        expect(recordingList).toContain("recordingList.openDataSources");
        expect(recordingList).toContain("recordingList.pageStatus");
        expect(recordingList).toContain(
            "Math.max(1, Math.floor(itemsPerPage))",
        );
        expect(recordingList).not.toContain("Math.min(itemsPerPage, 8)");
        expect(recordingList).toContain(
            'data-testid="recording-list-first-page"',
        );
        expect(recordingList).toContain(
            'data-testid="recording-list-last-page"',
        );
        expect(recordingList).toContain("recordingList.first");
        expect(recordingList).toContain("recordingList.last");
        expect(recordingList).not.toContain("前往数据源");
        expect(recordingList).not.toContain("清除筛选");
        expect(recordingList).not.toContain("上一页");
        expect(recordingList).not.toContain("下一页");
        expect(recordingList).not.toContain("第一页");
        expect(recordingList).not.toContain("最后一页");
        expect(translations).toContain("前往数据源");
        expect(translations).toContain("Open data sources");
        expect(translations).toContain("第一页");
        expect(translations).toContain("First");
    });
});
