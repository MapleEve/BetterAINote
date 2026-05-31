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

        for (const source of [detailTranscript, dashboardTranscript]) {
            expect(source).toContain("handleCopyTranscript");
            expect(source).toContain("writeBrowserClipboardText(displayText)");
            expect(source).toContain("isCopyingTranscript");
            expect(source).toContain("!displayText.trim()");
            expect(source).toContain("transcription.copyTranscript");
            expect(source).toContain("transcription.copyTranscriptFailed");
        }
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
        expect(sourceReport).toContain('data-source-report-state="loading"');
        expect(sourceReport).toContain('data-source-report-state="empty"');
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
        expect(detailWorkstation).toContain(
            'data-testid="recording-copy-source-transcript"',
        );
        expect(detailWorkstation).toContain(
            'data-testid="recording-copy-source-report"',
        );
        expect(detailWorkstation).toContain("handleCopySourceMaterial");
        expect(detailWorkstation).toContain("buildSourceTranscriptCopyText");
        expect(detailWorkstation).toContain("localTranscriptCopyText");
        expect(detailWorkstation).toContain("applySpeakerMap");
        expect(detailWorkstation).toContain("<SourceReportPanel");
        expect(detailWorkstation).toContain("autoLoad");
        expect(detailWorkstation).not.toContain("container mx-auto max-w-4xl");
        expect(detailWorkstation).not.toContain(">←<");
    });

    it("keeps standalone recording route fallback states in the new shell", () => {
        const loading = readSource("app/(app)/recordings/[id]/loading.tsx");
        const notFound = readSource("app/(app)/recordings/[id]/not-found.tsx");
        const error = readSource("app/(app)/recordings/[id]/error.tsx");

        for (const source of [loading, notFound, error]) {
            expect(source).toContain("dashboard-workstation");
            expect(source).toContain("glass-surface");
        }
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
        expect(dashboardTranscript).toContain("data-retx-dismiss");
    });
});
