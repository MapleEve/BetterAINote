import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serializeRecordingDetailTranscriptionJob } from "@/server/modules/recordings/serialize";

const ROOT = path.join(process.cwd(), "src");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

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
            "features/dashboard/components/transcription-panel.tsx",
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

        expect(dashboardTranscript).toContain("handleCopyTranscript");
        expect(dashboardTranscript).toContain(
            "writeBrowserClipboardText(displayText)",
        );
        expect(dashboardTranscript).toContain('copyingAction === "local"');
        expect(dashboardTranscript).toContain(
            'data-testid="dashboard-copy-local-transcript"',
        );
        expect(dashboardTranscript).toContain("!displayText.trim()");
        expect(dashboardTranscript).toContain("transcription.copyTranscript");
        expect(dashboardTranscript).toContain(
            "transcription.copyTranscriptFailed",
        );
    });

    it("keeps source report copy states explicit without dumping raw detail payloads", () => {
        const sourceReport = readSource(
            "features/recordings/components/source-report-panel.tsx",
        );

        expect(sourceReport).toContain("handleCopySourceTranscript");
        expect(sourceReport).toContain("handleCopySourceReport");
        expect(sourceReport).toContain("sourceReport.copySourceTranscript");
        expect(sourceReport).toContain("sourceReport.copySourceReport");
        expect(sourceReport).toContain("sourceReport.missingSourceTranscript");
        expect(sourceReport).toContain("sourceReport.missingSourceReport");
        expect(sourceReport).toContain("SourceReportAvailabilitySnapshot");
        expect(sourceReport).toContain("onAvailabilityChange");
        expect(sourceReport).toContain("transcriptAvailable");
        expect(sourceReport).toContain("reportAvailable");
        expect(sourceReport).toContain('data-source-report-state="loading"');
        expect(sourceReport).toContain('data-source-report-state="empty"');
        expect(sourceReport).toContain("activeReportRequestRef");
        expect(sourceReport).toContain("AbortController");
        expect(sourceReport).toContain("reportRequestIdRef");
        expect(sourceReport).toContain("renderDetailEntries");
        expect(sourceReport).not.toContain("JSON.stringify(data.detail");
    });

    it("keeps standalone recording detail on the full Graphite Glass shell with top-level copy actions", () => {
        const detailWorkstation = readSource(
            "features/recordings/workstation.tsx",
        );

        expect(detailWorkstation).toContain(
            'data-testid="recording-detail-workstation"',
        );
        expect(detailWorkstation).toContain(
            'data-testid="recording-detail-copy-strip"',
        );
        expect(detailWorkstation).toContain(
            'data-testid="recording-copy-local-transcript"',
        );
        expect(detailWorkstation).toContain("handleCopyRawTranscript");
        expect(detailWorkstation).toContain(
            'data-testid="recording-copy-raw-transcript"',
        );
        expect(detailWorkstation).toContain("/transcript/raw");
        expect(detailWorkstation).toContain("RawTranscriptCopyPayload");
        expect(detailWorkstation).toContain(
            'data-testid="recording-copy-source-transcript"',
        );
        expect(detailWorkstation).toContain(
            'data-testid="recording-copy-source-report"',
        );
        expect(detailWorkstation).toContain("handleCopySourceMaterial");
        expect(detailWorkstation).toContain("buildSourceTranscriptCopyText");
        expect(detailWorkstation).toContain("localTranscriptCopyText");
        expect(detailWorkstation).toContain("sourceReportAvailability");
        expect(detailWorkstation).toContain("data-source-copy-state");
        expect(detailWorkstation).toContain("sourceTranscriptCopyDisabled");
        expect(detailWorkstation).toContain("sourceReportCopyDisabled");
        expect(detailWorkstation).toContain("applySpeakerMap");
        expect(detailWorkstation).toContain("<SourceReportPanel");
        expect(detailWorkstation).toContain("onAvailabilityChange");
        expect(detailWorkstation).toContain("autoLoad");
        expect(detailWorkstation).not.toContain("container mx-auto max-w-4xl");
        expect(detailWorkstation).not.toContain(">←<");

        const sourceLabelMarker = "<span>{sourceLabel}</span>";
        const sourceLabelMarkerIndex =
            detailWorkstation.indexOf(sourceLabelMarker);
        const headerSourcePillStart = detailWorkstation.lastIndexOf(
            '<div className="hidden shrink-0 items-center gap-2 rounded-full',
            sourceLabelMarkerIndex,
        );
        const headerSourcePillEnd =
            detailWorkstation.indexOf("</div>", sourceLabelMarkerIndex) +
            "</div>".length;
        const headerSourcePill = detailWorkstation.slice(
            headerSourcePillStart,
            headerSourcePillEnd,
        );

        expect(headerSourcePill).toContain('<Database className="h-3.5 w-3.5"');
        expect(headerSourcePill).toContain(sourceLabelMarker);
        expect(headerSourcePill).not.toContain("bg-background/30");
        expect(headerSourcePill).toContain("bg-muted/20");

        const deviceLabelMarker = '{t("recording.device")}';
        const deviceValueMarker = "{recording.providerDeviceId}";
        const deviceLabelMarkerIndex =
            detailWorkstation.indexOf(deviceLabelMarker);
        const deviceValueMarkerIndex = detailWorkstation.indexOf(
            deviceValueMarker,
            deviceLabelMarkerIndex,
        );
        const deviceCalloutStart = detailWorkstation.lastIndexOf(
            '<div className="mt-3 rounded-xl border border-border/55',
            deviceLabelMarkerIndex,
        );
        const deviceCalloutEnd =
            detailWorkstation.indexOf("</div>", deviceValueMarkerIndex) +
            "</div>".length;
        const deviceCallout = detailWorkstation.slice(
            deviceCalloutStart,
            deviceCalloutEnd,
        );

        expect(deviceCallout).toContain(deviceLabelMarker);
        expect(deviceCallout).toContain(deviceValueMarker);
        expect(deviceCallout).not.toContain("bg-background/30");
        expect(deviceCallout).toContain("bg-muted/20");
    });

    it("keeps dashboard transcription panel on the same three-way copy contract", () => {
        const dashboardTranscript = readSource(
            "features/dashboard/components/transcription-panel.tsx",
        );

        expect(dashboardTranscript).toContain(
            'data-testid="dashboard-retranscription-banner"',
        );
        expect(dashboardTranscript).toContain("data-retx-retry");
        expect(dashboardTranscript).toContain("data-retx-dismiss");
        expect(dashboardTranscript).toContain(
            'data-testid="dashboard-transcription-copy-strip"',
        );
        expect(dashboardTranscript).toContain(
            'data-testid="dashboard-copy-local-transcript"',
        );
        expect(dashboardTranscript).toContain(
            'data-testid="dashboard-copy-source-transcript"',
        );
        expect(dashboardTranscript).toContain(
            'data-testid="dashboard-copy-source-report"',
        );
        expect(dashboardTranscript).toContain("handleCopySourceMaterial");
        expect(dashboardTranscript).toContain("buildSourceTranscriptCopyText");
        expect(dashboardTranscript).toContain("sourceReportAvailability");
        expect(dashboardTranscript).toContain("data-source-copy-state");
        expect(dashboardTranscript).toContain("onAvailabilityChange");
        expect(dashboardTranscript).toContain(
            "sourceReport.copySourceTranscript",
        );
        expect(dashboardTranscript).toContain("sourceReport.copySourceReport");
        expect(dashboardTranscript).toContain(
            "sourceReport.missingSourceTranscript",
        );
        expect(dashboardTranscript).toContain(
            "sourceReport.missingSourceReport",
        );
        expect(dashboardTranscript).toContain("sourceTranscriptCopyState");
        expect(dashboardTranscript).toContain("sourceReportCopyState");
        expect(dashboardTranscript).toContain('"transcript"');
        expect(dashboardTranscript).toContain('"source"');
        expect(dashboardTranscript).toContain('"speakers"');
        expect(dashboardTranscript).not.toContain("bg-background/45");
        expect(dashboardTranscript).not.toContain("bg-background/35");
        expect(dashboardTranscript).toContain("bg-muted/35");
        expect(dashboardTranscript).toContain("shadow-xs");
    });

    it("keeps standalone recording route fallback states in the new shell", () => {
        const loading = readSource("app/(app)/recordings/[id]/loading.tsx");
        const notFound = readSource("app/(app)/recordings/[id]/not-found.tsx");
        const error = readSource("app/(app)/recordings/[id]/error.tsx");

        for (const source of [loading, notFound, error]) {
            expect(source).toContain("dashboard-workstation");
            expect(source).toContain("glass-surface");
        }

        expect(error).not.toContain("hover:bg-background/70");
        expect(error).toContain("asChild");
        expect(error).toContain('variant="outline"');
        expect(error).toContain('href="/dashboard"');
        expect(error).toContain("返回录音列表");

        const loadingSourceMarker = '<Skeleton className="h-3 w-20" />';
        const loadingSourceMarkerIndex = loading.indexOf(loadingSourceMarker);
        const loadingSourcePillStart = loading.lastIndexOf(
            '<span className="hidden shrink-0 items-center gap-2 rounded-full',
            loadingSourceMarkerIndex,
        );
        const loadingSourcePillEnd =
            loading.indexOf("</span>", loadingSourceMarkerIndex) +
            "</span>".length;
        const loadingSourcePill = loading.slice(
            loadingSourcePillStart,
            loadingSourcePillEnd,
        );

        expect(loadingSourcePill).toContain(
            '<Database className="h-3.5 w-3.5" />',
        );
        expect(loadingSourcePill).toContain(loadingSourceMarker);
        expect(loadingSourcePill).not.toContain("bg-background/30");
        expect(loadingSourcePill).toContain("bg-muted/20");
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
        expect(detailWorkstation).not.toContain("hover:bg-background/50");
        expect(detailWorkstation).toContain("handleAutoRename");
        expect(detailWorkstation).toContain("handleRenameCancel");
        expect(detailWorkstation).toContain(
            'data-testid="recording-ai-rename"',
        );
        expect(detailWorkstation).toContain(
            'data-testid="recording-rename-cancel"',
        );
        const firstAiRenameMarker = detailWorkstation.indexOf(
            'data-testid="recording-ai-rename"',
        );
        const cancelRenameMarker = detailWorkstation.indexOf(
            'data-testid="recording-rename-cancel"',
            firstAiRenameMarker,
        );
        const secondAiRenameMarker = detailWorkstation.indexOf(
            'data-testid="recording-ai-rename"',
            cancelRenameMarker,
        );
        const titleActionStart = detailWorkstation.lastIndexOf(
            "<Button",
            firstAiRenameMarker,
        );
        const titleActionEnd =
            detailWorkstation.indexOf("</Button>", secondAiRenameMarker) +
            "</Button>".length;
        const titleActionButtons = detailWorkstation.slice(
            titleActionStart,
            titleActionEnd,
        );

        expect(titleActionButtons).toContain("handleAutoRename");
        expect(titleActionButtons).toContain("handleRenameCancel");
        expect(
            titleActionButtons.match(/data-testid="recording-ai-rename"/g),
        ).toHaveLength(2);
        expect(titleActionButtons).toContain(
            'data-testid="recording-rename-cancel"',
        );
        expect(titleActionButtons).not.toContain("bg-background/30");
        expect(titleActionButtons.match(/bg-muted\/20/g)).toHaveLength(3);
        expect(detailWorkstation).toContain(
            'data-testid="recording-copy-source-report"',
        );

        expect(dashboardWorkstation).toContain("handleAutoRename");
        expect(dashboardWorkstation).toContain("/rename/auto");
        expect(dashboardWorkstation).toContain("canAutoRenameCurrentRecording");
        expect(dashboardWorkstation).toContain("aria-busy={");
        expect(dashboardWorkstation).toContain("dashboard-detail-more-actions");
        expect(dashboardWorkstation).toContain("dashboard-detail-more-menu");
        expect(dashboardWorkstation).toContain(
            "dashboard-delete-local-recording",
        );
        expect(dashboardWorkstation).toContain("dashboardChrome.moreActions");
        expect(dashboardWorkstation).toContain(
            "dashboardChrome.deleteLocalOnly",
        );
        expect(dashboardWorkstation).not.toContain("更多操作");
        expect(dashboardWorkstation).not.toContain("仅删除本地副本");
        expect(dashboardWorkstation).toContain(
            "currentRecording.upstreamDeleted",
        );
    });

    it("keeps dashboard retranscription states inline without hiding the existing transcript", () => {
        const dashboardTranscript = readSource(
            "features/dashboard/components/transcription-panel.tsx",
        );

        expect(dashboardTranscript).toContain("RetranscriptionBanner");
        expect(dashboardTranscript).toContain(
            'data-testid="dashboard-retranscription-banner"',
        );
        expect(dashboardTranscript).toContain("data-retx-state={retxState}");
        expect(dashboardTranscript).toContain("completedRetxAt");
        expect(dashboardTranscript).toContain("previousJobDisplayStateRef");
        expect(dashboardTranscript).toContain("!canReadExistingTranscript");
        expect(dashboardTranscript).toContain("data-retx-retry");
        expect(dashboardTranscript).toContain(
            "void handleConfirmRetranscribe()",
        );
        expect(dashboardTranscript).not.toContain("onRetry={onRetranscribe}");
        expect(dashboardTranscript).toContain("data-retx-dismiss");
        expect(dashboardTranscript).toContain(
            'aria-label={language === "zh-CN" ? "收起" : "Dismiss"}',
        );
        expect(dashboardTranscript).toContain("onClick={onDismiss}");
        expect(dashboardTranscript).not.toContain("hover:bg-background/50");
    });
});
