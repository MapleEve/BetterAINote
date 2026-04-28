import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("preview search write path contract", () => {
    it("persists private transcription segments and queues transcript search indexing", () => {
        const source = readFileSync(
            path.join(
                process.cwd(),
                "src/lib/transcription/transcribe-recording.ts",
            ),
            "utf8",
        );

        expect(source).toContain("replaceTranscriptSegmentsForTranscription");
        expect(source).toContain('transcriptOrigin: "local"');
        expect(source).toContain("providerPayload: sanitizedPayload");
    });

    it("persists source artifact segments and queues source transcript search indexing", () => {
        const source = readFileSync(
            path.join(process.cwd(), "src/lib/sync/sync-recordings.ts"),
            "utf8",
        );

        expect(source).toContain("replaceSourceArtifactSegmentsForArtifact");
        expect(source).toContain('artifactType: "official-transcript"');
        expect(source).toContain("sourceArtifacts.artifactType");
    });

    it("keeps read-model rebuild separate from search job ownership", () => {
        const rebuildSource = readFileSync(
            path.join(process.cwd(), "src/server/modules/search/rebuild.ts"),
            "utf8",
        );
        const processorSource = readFileSync(
            path.join(
                process.cwd(),
                "src/server/modules/search/job-processor.ts",
            ),
            "utf8",
        );

        expect(rebuildSource).not.toContain("searchIndexJobs");
        expect(rebuildSource).not.toContain("delete(searchIndexJobs)");
        expect(processorSource).toContain("processTranscriptRebuildGroups");
        expect(processorSource).toContain("markJobCompleted");
    });
});
