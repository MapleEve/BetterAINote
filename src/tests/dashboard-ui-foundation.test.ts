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
        expect(globals).toContain(".dashboard-workstation");
        expect(globals).toContain(".dashboard-list-panel");
        expect(globals).toContain(
            '.dashboard-workstation-grid[data-sidebar-collapsed="true"]',
        );
    });

    it("renders supported source providers as local client rows without remote assets", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const sourceRows = readSource(
            "features/dashboard/components/source-provider-rows.tsx",
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

        expect(sourceRows).toContain('data-testid="source-provider-rows"');
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
        expect(recordingList).not.toContain("前往数据源");
        expect(recordingList).not.toContain("清除筛选");
        expect(recordingList).not.toContain("上一页");
        expect(recordingList).not.toContain("下一页");
        expect(translations).toContain("前往数据源");
        expect(translations).toContain("Open data sources");
    });
});
