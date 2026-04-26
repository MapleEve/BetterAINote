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

    it("full search rebuild subsumes stale pending index jobs for the rebuilt user", () => {
        const source = readFileSync(
            path.join(process.cwd(), "src/server/modules/search/rebuild.ts"),
            "utf8",
        );

        expect(source).toContain("searchIndexJobs");
        expect(source).toContain("delete(searchIndexJobs)");
        expect(source).toContain("eq(searchIndexJobs.userId, userId)");
    });
});
