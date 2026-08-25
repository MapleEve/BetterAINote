import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(process.cwd(), "src");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("dashboard transcription panel integration", () => {
    it("mounts the dashboard TranscriptionPanel from the workstation", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toContain(
            'from "@/features/dashboard/components/transcription-panel"',
        );
        expect(workstation).toMatch(/<TranscriptionPanel[\s\S]*activeTab=/);
    });

    it("uses direct shadcn primitives without a private visual token layer", () => {
        const panel = readSource(
            "features/dashboard/components/transcription-panel.tsx",
        );

        expect(panel).not.toMatch(
            /\b(?:ClassNames|_CLASS_NAME|Styles|data-sot|style=)\b/,
        );
        expect(panel).toContain('from "@/components/ui/button"');
        expect(panel).toContain('from "@/components/ui/card"');
        expect(panel).toContain('from "@/components/ui/segmented-tabs"');
    });

    it("keeps transcript, copy, retranscription, and speaker merge states in the mounted panel", () => {
        const panel = readSource(
            "features/dashboard/components/transcription-panel.tsx",
        );

        for (const hook of [
            'data-control="copy-local-transcript"',
            'data-control="retranscribe-recording"',
            'data-control="dashboard-speakers-merge"',
            'data-control="retry-speaker-merge"',
            'data-panel="dashboard-speaker-merge-status"',
            'data-panel="dashboard-transcript-empty"',
        ]) {
            expect(panel).toContain(hook);
        }
    });

    it("reads back speaker merge persistence through both dashboard speaker APIs", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).toMatch(
            /fetch\([\s\S]*?\/api\/recordings\/\$\{selectedRecordingId\}\/speakers/,
        );
        expect(workstation).toMatch(
            /\/api\/recordings\/\$\{selectedRecordingId\}\/transcript\/speakers/,
        );
        expect(workstation).toContain("mergedRows.length !== 2");
        expect(workstation).toContain("setLiveTranscriptions((previous)");
    });

    it("stabilizes derived speaker props and prop reconciliation to prevent update loops", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const panel = readSource(
            "features/dashboard/components/transcription-panel.tsx",
        );

        expect(workstation).toContain(
            "if (areTranscriptionsEqual(current, merged))",
        );
        expect(workstation).toContain("const turns = useMemo(");
        expect(workstation).toContain("const speakers = useMemo(");
        expect(panel).toContain("const availableSpeakerLabels = useMemo(");
        expect(panel).toContain("}, [availableSpeakerLabels]);");
    });
});
