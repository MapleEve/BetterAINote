import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("dashboard search and activity overlay regression", () => {
    it("exposes a dashboard search entrypoint for the four library scopes", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        expect(workstation).toContain("<LibrarySearch");
        expect(searchComponent).toContain("/api/search");
        expect(searchComponent).toContain('method: "GET"');
        expect(searchComponent).toContain('cache: "no-store"');
        expect(searchComponent).toContain('limit: "12"');
        expect(searchComponent).toContain('"recording"');
        expect(searchComponent).toContain('"transcript"');
        expect(searchComponent).toContain('"speaker"');
        expect(searchComponent).toContain('"tag"');
        expect(searchComponent).toContain("setTimeout(() =>");
        expect(searchComponent).toContain("}, 250);");
        expect(searchComponent).toContain("搜索录音、逐字稿、说话人、标签");
    });

    it("keeps search as a controlled topbar overlay with focus-safe close paths", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        const syncActionIndex = workstation.indexOf("onClick={handleSync}");
        const searchIndex = workstation.indexOf("<LibrarySearch");
        const activityIndex = workstation.indexOf("<ActivityOverlay");
        const settingsIndex = workstation.indexOf(
            "onClick={handleOpenSettings}",
        );

        expect(syncActionIndex).toBeGreaterThan(-1);
        expect(searchIndex).toBeGreaterThan(syncActionIndex);
        expect(searchIndex).toBeLessThan(activityIndex);
        expect(activityIndex).toBeLessThan(settingsIndex);
        expect(workstation).toContain('activeTopbarOverlay === "search"');
        expect(workstation).toContain("onOpenChange={setSearchOverlayOpen}");

        expect(searchComponent).toContain("open: boolean");
        expect(searchComponent).toContain(
            "onOpenChange: (open: boolean) => void",
        );
        expect(searchComponent).toContain("ref={inputRef}");
        expect(searchComponent).toContain("inputRef.current?.focus");
        expect(searchComponent).toContain("triggerRef.current?.focus");
        expect(searchComponent).toContain(
            'document.addEventListener("pointerdown"',
        );
        expect(searchComponent).toContain(
            'document.addEventListener("keydown"',
        );
        expect(searchComponent).toContain('event.key === "Escape"');
        expect(searchComponent).toContain("closeAndReturnFocus();");
        expect(searchComponent).toContain(
            "closeAndReturnFocus({ returnFocus: false });",
        );
        expect(searchComponent).toContain("onOpenRecording(recordingId);");
    });

    it("keeps search no-query, loading, results, empty, and error states explicit", () => {
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );

        expect(searchComponent).toContain('"no-query"');
        expect(searchComponent).toContain('"loading"');
        expect(searchComponent).toContain('"results"');
        expect(searchComponent).toContain('"no-results"');
        expect(searchComponent).toContain('"error"');
        expect(searchComponent).toContain(
            'data-testid="library-search-no-query"',
        );
        expect(searchComponent).toContain(
            'data-testid="library-search-loading"',
        );
        expect(searchComponent).toContain(
            'data-testid="library-search-results"',
        );
        expect(searchComponent).toContain(
            'data-testid="library-search-no-results"',
        );
        expect(searchComponent).toContain('data-testid="library-search-error"');
        expect(searchComponent).toContain('setQuery("")');
    });

    it("derives the activity overlay from existing workstation update and transcription state", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const activityOverlay = readSource(
            "features/dashboard/components/activity-overlay.tsx",
        );

        expect(workstation).toContain("<ActivityOverlay");
        expect(workstation).toContain("useAutoSync");
        expect(workstation).toContain("lastSyncResult={lastSyncResult}");
        expect(workstation).toContain("workerStatus={workerStatus}");
        expect(workstation).toContain(
            "transcriptionJobs={liveTranscriptionJobs}",
        );
        expect(workstation).toContain("onSyncNow={handleSync}");

        expect(activityOverlay).toContain("lastSyncResult");
        expect(activityOverlay).toContain("workerStatus");
        expect(activityOverlay).toContain("transcriptionJobs");
        expect(activityOverlay).toContain("isActiveTranscriptionJob");
        expect(activityOverlay).toContain(
            'data-testid="dashboard-activity-trigger"',
        );
        expect(activityOverlay).toContain(
            'data-testid="dashboard-activity-panel"',
        );
        expect(activityOverlay).toContain(
            'data-testid="dashboard-activity-status"',
        );
        expect(activityOverlay).toContain(
            'data-testid="dashboard-activity-empty"',
        );
        expect(activityOverlay).toContain('"dashboard-activity-loading"');
        expect(activityOverlay).toContain('"dashboard-activity-error"');
        expect(activityOverlay).not.toContain("fetch(");
    });

    it("keeps search and activity mutually exclusive and below modal-level surfaces", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );
        const activityOverlay = readSource(
            "features/dashboard/components/activity-overlay.tsx",
        );

        expect(workstation).toContain(
            'type TopbarOverlay = "search" | "activity"',
        );
        expect(workstation).toContain("setSearchOverlayOpen");
        expect(workstation).toContain("setActivityOverlayOpen");
        expect(workstation).toContain('return "search";');
        expect(workstation).toContain('return "activity";');
        expect(workstation).toContain("if (settingsOpen) {");
        expect(workstation).toContain("setActiveTopbarOverlay(null);");
        expect(workstation).toContain("overflow-visible");

        expect(searchComponent).toContain("z-40");
        expect(activityOverlay).toContain("z-40");
        expect(searchComponent).toContain("max-h-[min(calc(100svh-6rem)");
        expect(activityOverlay).toContain("max-h-[min(calc(100svh-6rem)");
        expect(activityOverlay).toContain("triggerRef.current?.focus");
        expect(activityOverlay).toContain('event.key === "Escape"');
        expect(activityOverlay).toContain(
            "closeAndReturnFocus({ returnFocus: false });",
        );
    });

    it("keeps S4/S5 scope from landing later settings, detail, copy, or rename work", () => {
        const searchComponent = readSource(
            "features/dashboard/components/library-search.tsx",
        );
        const activityOverlay = readSource(
            "features/dashboard/components/activity-overlay.tsx",
        );

        for (const forbidden of [
            "source-" + "report",
            "rename/" + "auto",
            "vo" + "script",
            "Vo" + "Script",
            "pay" + "load",
            "cap" + "ability",
            "fall" + "back",
            "SettingsDialog",
        ]) {
            expect(searchComponent).not.toContain(forbidden);
            expect(activityOverlay).not.toContain(forbidden);
        }

        expect(activityOverlay).not.toContain("http://");
        expect(activityOverlay).not.toContain("https://");
        expect(searchComponent).not.toContain("http://");
        expect(searchComponent).not.toContain("https://");
    });
});
