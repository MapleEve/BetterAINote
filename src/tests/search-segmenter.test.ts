import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const segmenterPath = path.join(
    process.cwd(),
    "src/server/modules/search/segmenter.ts",
);

async function loadSegmenter() {
    const exists = existsSync(segmenterPath);
    expect(exists).toBe(true);
    if (!exists) {
        return null;
    }

    return import("@/server/modules/search/segmenter");
}

describe("preview search segmenter", () => {
    it("normalizes private transcription provider segments into stable transcript rows", async () => {
        const segmenter = await loadSegmenter();
        if (!segmenter) return;

        const rows = segmenter.buildTranscriptSegmentRows({
            userId: "user-1",
            recordingId: "recording-1",
            transcriptionId: "transcription-1",
            transcriptOrigin: "local",
            text: "fallback text",
            providerPayload: {
                text: "fallback text",
                segments: [
                    {
                        id: 7,
                        start: 1.24,
                        end: 3.56,
                        text: " 第一段 ",
                        speakerLabel: "SPEAKER_01",
                    },
                    {
                        id: "seg-8",
                        start: 3.56,
                        end: 4.01,
                        text: "第二段",
                        speakerName: "Alice",
                    },
                ],
            },
        });

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            id: "transcription-1:local:7",
            userId: "user-1",
            recordingId: "recording-1",
            transcriptionId: "transcription-1",
            transcriptOrigin: "local",
            providerSegmentId: "7",
            rawSpeakerLabel: "SPEAKER_01",
            startMs: 1240,
            endMs: 3560,
            sortSeqMs: 1240,
            text: "第一段",
        });
        expect(rows[0].contentHash).toHaveLength(64);
        expect(rows[1]).toMatchObject({
            id: "transcription-1:local:seg-8",
            providerSegmentId: "seg-8",
            rawSpeakerLabel: "Alice",
            startMs: 3560,
            endMs: 4010,
        });
    });

    it("falls back to line based transcript segments when provider segments are missing", async () => {
        const segmenter = await loadSegmenter();
        if (!segmenter) return;

        const rows = segmenter.buildTranscriptSegmentRows({
            userId: "user-1",
            recordingId: "recording-1",
            transcriptionId: "transcription-1",
            transcriptOrigin: "local",
            text: "SPEAKER_01: 你好\n\nSPEAKER_02: 收到",
            providerPayload: null,
        });

        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            id: "transcription-1:local:line-0",
            rawSpeakerLabel: "SPEAKER_01",
            sortSeqMs: 0,
            text: "你好",
        });
        expect(rows[1]).toMatchObject({
            id: "transcription-1:local:line-1",
            rawSpeakerLabel: "SPEAKER_02",
            sortSeqMs: 1000,
            text: "收到",
        });
    });

    it("normalizes source transcript artifacts into segment rows", async () => {
        const segmenter = await loadSegmenter();
        if (!segmenter) return;

        const rows = segmenter.buildSourceArtifactSegmentRows({
            sourceArtifactId: "artifact-1",
            recordingId: "recording-1",
            userId: "user-1",
            artifactType: "official-transcript",
            textContent: "fallback",
            markdownContent: null,
            payload: {
                segments: [
                    {
                        speaker: "Alice",
                        startMs: 120,
                        endMs: 990,
                        text: "来源逐字稿",
                    },
                ],
            },
        });

        expect(rows).toEqual([
            expect.objectContaining({
                id: "artifact-1:segment-0",
                sourceArtifactId: "artifact-1",
                recordingId: "recording-1",
                userId: "user-1",
                segmentType: "transcript",
                heading: "Alice",
                sortOrder: 0,
                text: "来源逐字稿",
            }),
        ]);
        expect(rows[0].contentHash).toHaveLength(64);
    });

    it("chunks long searchable text without empty chunks", async () => {
        const segmenter = await loadSegmenter();
        if (!segmenter) return;

        const chunks = segmenter.chunkSearchText(
            "第一段内容，用于搜索。\n\n第二段内容也应该进入搜索。第三段比较长，需要继续拆分。",
            24,
        );

        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.every((chunk) => chunk.text.trim().length > 0)).toBe(
            true,
        );
        expect(chunks.every((chunk) => chunk.text.length <= 24)).toBe(true);
    });
});
