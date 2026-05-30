import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(process.cwd(), "src");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("recording detail copy and title action UI regressions", () => {
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

        expect(dashboardWorkstation).toContain("handleAutoRename");
        expect(dashboardWorkstation).toContain("/rename/auto");
        expect(dashboardWorkstation).toContain("canAutoRenameCurrentRecording");
        expect(dashboardWorkstation).toContain("aria-busy={");
    });
});
