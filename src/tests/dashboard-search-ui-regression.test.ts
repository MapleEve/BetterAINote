import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const OLD_UI_RE =
    /<LibrarySearch[\s/>]|<ActivityOverlay[\s/>]|<TopbarOverlayPortal[\s/>]|\.\/components\/library-search|\.\/components\/activity-overlay|\.\/components\/topbar-overlay-portal|uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|border-border/;

describe("dashboard SOT search and activity interactions", () => {
    it("keeps search inline in the SOT topbar with all query states", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).not.toMatch(OLD_UI_RE);
        expect(workstation).toContain("const [searchOpen, setSearchOpen]");
        expect(workstation).toContain("const [query, setQuery]");
        expect(workstation).toContain("const [searchScope, setSearchScope]");
        expect(workstation).toContain(
            "const [searchLoading, setSearchLoading]",
        );
        expect(workstation).toContain("const [searchError, setSearchError]");
        expect(workstation).toContain('data-sot-control="dashboard-search"');
        expect(workstation).toContain('data-sot-panel="library-search"');
        expect(workstation).toContain('role="dialog"');
        expect(workstation).toContain(
            'aria-label={t("librarySearch.dialogLabel")}',
        );
        expect(workstation).toContain("data-sot-state={");
        expect(workstation).toContain('"no-query"');
        expect(workstation).toContain('"loading"');
        expect(workstation).toContain('"results"');
        expect(workstation).toContain('"no-results"');
        expect(workstation).toContain('"error"');
        expect(workstation).toContain(
            'data-sot-control="library-search-input"',
        );
        expect(workstation).toContain(
            'data-sot-control="library-search-clear"',
        );
        expect(workstation).toContain('data-sot-part="library-search-loading"');
        expect(workstation).toContain('data-sot-part="library-search-error"');
        expect(workstation).toContain("ls-state ls-state-loading");
        expect(workstation).toContain("ls-state ls-state-error");
        expect(workstation).toContain("ls-state ls-state-results");
        expect(workstation).toContain("ls-state ls-state-no-query");
        expect(workstation).toContain("ls-state ls-state-no-results");
        expect(workstation).toContain('className="ls-scope"');
        expect(workstation).toContain('role="tablist"');
        expect(workstation).toContain('data-sot-canonical="web-index-runtime"');
        expect(workstation).toContain("data-sot-scope-count={String(");
        expect(workstation).toContain("SEARCH_SCOPES.length");
        expect(workstation).toContain('{ value: "all", label: "全部" }');
        expect(workstation).toContain('{ value: "recording", label: "录音" }');
        expect(workstation).toContain(
            '{ value: "transcript", label: "逐字稿" }',
        );
        expect(workstation).toContain('{ value: "speaker", label: "说话人" }');
        expect(workstation).toContain('{ value: "tag", label: "标签" }');
        expect(workstation).not.toContain("SEARCH_SCOPES.filter");
        expect(workstation).not.toContain("SEARCH_SCOPES.slice");
        expect(workstation).toContain(
            'data-sot-control="library-search-retry"',
        );
        expect(workstation).toContain('data-sot-part="library-search-empty"');
        expect(workstation).toContain('No content found for "');
        expect(workstation).toContain("没有找到与「");
        expect(workstation).toContain("<span>");
        expect(workstation).toContain("librarySearch.noQuery");
    });

    it("keeps search scoped to backend search and applies result navigation", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain(
            "fetch(`/api/search?${params.toString()}`)",
        );
        expect(workstation).toContain('params.set("type", searchScope)');
        expect(workstation).toContain("SEARCH_SCOPES.map");
        expect(workstation).toContain("data-search-scope={item.value}");
        expect(workstation).toContain("setSearchScope(item.value)");
        expect(workstation).toContain("groupedSearchResults.map");
        expect(workstation).toContain("group.results.map");
        expect(workstation).toContain("data-result-type=");
        expect(workstation).toContain('className="ls-item"');
        expect(workstation).toContain('className="ls-item-title"');
        expect(workstation).toContain('className="ls-item-meta"');
        expect(workstation).toContain('className="utag c-violet"');
        expect(workstation).not.toContain('className="ls-result"');
        expect(workstation).not.toContain('className="ls-section"');
        expect(workstation).not.toContain('className="ls-tail"');
        expect(workstation).toContain(
            'data-sot-control="library-search-result"',
        );
        expect(workstation).toContain("data-sot-result-index={String(");
        expect(workstation).toContain("data-sot-result-type=");
        expect(workstation).toContain("selectRecording(");
        expect(workstation).toContain("setSearchOpen(");
    });

    it("keeps Escape and outside-click dismissal shared across drawer, search, and activity overlays", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain('event.key !== "Escape"');
        expect(workstation).toContain("if (activityOpen) {");
        expect(workstation).toContain("setActivityOpen(false);");
        expect(workstation).toContain("if (searchOpen) {");
        expect(workstation).toContain("setSearchOpen(false);");
        expect(workstation).toContain("if (drawerOpen) {");
        expect(workstation).toContain(
            'document.addEventListener("keydown", handleKeyDown)',
        );
        expect(workstation).toContain(
            'document.addEventListener("pointerdown", handlePointerDown)',
        );
        expect(workstation).toContain(
            "!searchOverlayRef.current.contains(target)",
        );
        expect(workstation).toContain(
            "!activityOverlayRef.current.contains(target)",
        );
    });

    it("keeps activity center inline with sync, settings, recording, dismiss, and empty states", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain("const [activityOpen, setActivityOpen]");
        expect(workstation).toContain("const [dismissedActivityIds");
        expect(workstation).toContain("const activityItems = useMemo");
        expect(workstation).toContain("const visibleActivityItems");
        expect(workstation).toContain("const activityBadgeCount");
        expect(workstation).toContain('data-sot-control="dashboard-activity"');
        expect(workstation).toContain('data-sot-panel="dashboard-activity"');
        expect(workstation).toContain("data-sot-item-count={String(");
        expect(workstation).toContain('role="dialog"');
        expect(workstation).toContain(
            'aria-label={t("activityOverlay.title")}',
        );
        expect(workstation).toContain('className="notif-head-l"');
        expect(workstation).toContain('className="notif-count"');
        expect(workstation).toContain('className="notif-close icon-btn"');
        expect(workstation).toContain('data-sot-control="dashboard-settings"');
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-status"',
        );
        expect(workstation).toContain('className="notif-status-line"');
        expect(workstation).toContain('className="notif-status-sub mono"');
        expect(workstation).toContain(
            'data-sot-control="dashboard-activity-sync"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-activity-action"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-activity-dismiss"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-activity-empty"',
        );
        expect(workstation).toContain(
            'data-sot-list="dashboard-activity-items"',
        );
        expect(workstation).toContain(
            'data-sot-item="dashboard-activity-item"',
        );
        expect(workstation).toContain("data-kind={activityItemKind(");
        expect(workstation).toContain('className="notif-item-title"');
        expect(workstation).toContain('className="notif-item-body"');
        expect(workstation).toContain('className="notif-item-meta"');
        expect(workstation).toContain('className="notif-empty-ico"');
        expect(workstation).toContain('className="notif-empty-msg"');
        expect(workstation).toContain('className="notif-empty-sub"');
        expect(workstation).not.toContain('<h2 className="notif-title"');
        expect(workstation).not.toContain('className="notif-msg"');
        expect(workstation).not.toContain('className="notif-time"');
        expect(workstation).toContain('item.action === "sync"');
        expect(workstation).toContain('item.action === "settings"');
        expect(workstation).toContain('openSettings("data-sources")');
        expect(workstation).toContain("selectRecording(item.recordingId)");
    });
});
