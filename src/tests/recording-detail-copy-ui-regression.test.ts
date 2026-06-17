import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serializeRecordingDetailTranscriptionJob } from "@/server/modules/recordings/serialize";

const ROOT = path.join(process.cwd(), "src");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|CardContent|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE =
    /className=["']btn(?:\s+(?:ghost|primary|glass))?\b|track-fill|track-thumb|sk _is|_is-/;

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
            'import { Button } from "@/components/ui/button";',
        );
        expect(sourceReport).toContain(
            'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
        );
        expect(sourceReport).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(sourceReport).toContain(
            'data-sot-part="source-report-segment-skeleton"',
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
        for (const control of sourceReportButtonControls) {
            const controlIndex = sourceReport.indexOf(control);
            expect(controlIndex).toBeGreaterThanOrEqual(0);
            const controlSource = sourceReport.slice(
                Math.max(0, controlIndex - 700),
                controlIndex + 320,
            );
            expect(controlSource).toContain("<Button");
            expect(controlSource).toContain('variant="ghost"');
            expect(controlSource).toContain('size="sm"');
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

        expect(detailWorkstation).toContain(
            'data-sot-surface="recording-workstation"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-state={hydrated ? "ready" : "loading"}',
        );
        expect(detailWorkstation).toContain(
            'className="sidebar glass glass-strong"',
        );
        expect(detailWorkstation).toContain('className="topbar"');
        expect(detailWorkstation).toContain('className="workspace"');
        expect(detailWorkstation).toContain('className="rec-head"');
        expect(detailWorkstation).toContain('className="rec-h2"');
        expect(detailWorkstation).toContain('className="rec-h2-input"');
        expect(detailWorkstation).toContain('className="rec-h2-status"');
        expect(detailWorkstation).toContain(
            'className="ai-rename-anchor rh-norm"',
        );
        expect(detailWorkstation).toContain("data-rh-ai-anchor");
        expect(detailWorkstation).toContain("data-rh-ai-trigger");
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
        expect(detailWorkstation).toContain('className="t-actions"');
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
            "data-local-only={String(recording.upstreamDeleted)}",
        );
        expect(detailWorkstation).toContain('className="more-anchor rh-norm"');
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

        expect(dashboardTranscript).toContain(
            'data-sot-panel="dashboard-retranscription"',
        );
        expect(dashboardTranscript).toContain(
            "data-retx-state={dashboardRetxState}",
        );
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
        expect(dashboardTranscript).toContain('className="turn skel-turn"');
        expect(dashboardTranscript).toContain('className="empty-state"');
        expect(dashboardTranscript).toContain('className="empty-ico"');
        expect(dashboardTranscript).toContain('className="empty-msg"');
        expect(dashboardTranscript).toContain('className="empty-sub"');
        expect(dashboardTranscript).toContain('className="ts mono"');
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
        expect(dashboardTranscript).not.toMatch(
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

        for (const source of [loading, notFound, error]) {
            expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
        }
        for (const source of [notFound, error]) {
            expect(source).toContain("BetterAINote");
            expect(source).toContain('href="/dashboard"');
            expect(source).toContain("返回工作台");
            expect(source).toContain(
                'import { Button } from "@/components/ui/button";',
            );
            expect(source).not.toContain('className="btn primary"');
            expect(source).not.toContain('className="btn ghost"');
        }

        expect(notFound).toContain('<Button asChild variant="primary">');
        expect(error).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(error).toContain("<Button");
        expect(error).toContain('variant="primary"');
        expect(error).toContain('<Button asChild variant="ghost">');
        expect(error).toContain("onClick={reset}");
        expect(error).toContain("重试");
        expect(loading).toContain('aria-busy="true"');
        expect(loading).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(loading).toContain("<Skeleton");
        expect(loading).toContain('data-sot-panel="recording-detail-loading"');
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

        expect(detailWorkstation).toContain("SegmentedTabs");
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
            /disabled=\{\s*isAutoRenaming \|\| isApplyingAutoRename\s*\}/,
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
        expect(dashboardTranscript).not.toMatch(
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
        expect(tagManager).toContain('variant="primary"');
        expect(tagManager).toContain('size="icon-sm"');
        expect(tagManager).toContain('aria-label="添加"');
        expect(tagManager).not.toContain("tagm-add-btn");
    });
});
