import { describe, expect, it } from "vitest";
import {
    buildRecordingSearchDocument,
    buildSpeakerSearchDocument,
    buildTagSearchDocument,
    buildTranscriptSearchDocument,
} from "@/server/modules/recordings/search-read-model";

describe("recording search read model", () => {
    it("maps recordings into provider-neutral search documents", () => {
        const document = buildRecordingSearchDocument(
            {
                id: "recording-1",
                userId: "user-1",
                filename: "04-24 工作进度沟通",
                sourceProvider: "ticnote",
                sourceRecordingId: "source-1",
                startTime: new Date("2026-04-24T10:00:00.000Z"),
            },
            {
                tags: ["交付", "测试"],
                speakers: ["Alice", "Bob"],
            },
        );

        expect(document).toMatchObject({
            userId: "user-1",
            entityType: "recording",
            entityId: "recording-1",
            recordingId: "recording-1",
            title: "04-24 工作进度沟通",
            tags: ["交付", "测试"],
            source: "ticnote",
            sourceProvider: "ticnote",
            sortSeqMs: Date.parse("2026-04-24T10:00:00.000Z"),
        });
        expect(document.body).toContain("04-24 工作进度沟通");
        expect(document.body).toContain("source-1");
        expect(document.body).toContain("Alice");
        expect(document.body).not.toContain("provider_payload");
    });

    it("maps transcript segments into timestamped transcript documents", () => {
        const document = buildTranscriptSearchDocument(
            {
                id: "segment-1",
                userId: "user-1",
                recordingId: "recording-1",
                transcriptOrigin: "source",
                rawSpeakerLabel: "SPEAKER_01",
                text: "来源逐字稿内容",
                startMs: 1200,
                endMs: 3500,
                sortSeqMs: 1200,
            },
            {
                recording: {
                    filename: "Source meeting",
                    sourceProvider: "plaud",
                },
                tags: ["来源"],
            },
        );

        expect(document).toEqual({
            userId: "user-1",
            entityType: "transcript",
            entityId: "segment-1",
            recordingId: "recording-1",
            title: "Source meeting",
            body: "来源逐字稿内容",
            speaker: "SPEAKER_01",
            tags: ["来源"],
            source: "plaud",
            sourceProvider: "plaud",
            transcriptOrigin: "source",
            startMs: 1200,
            endMs: 3500,
            sortSeqMs: 1200,
        });
    });

    it("maps speakers and tags as first-class search entities", () => {
        expect(
            buildSpeakerSearchDocument({
                id: "speaker-1",
                userId: "user-1",
                displayName: "Alice",
            }),
        ).toMatchObject({
            entityType: "speaker",
            entityId: "speaker-1",
            speaker: "Alice",
        });

        expect(
            buildTagSearchDocument({
                id: "tag-1",
                userId: "user-1",
                name: "交付",
            }),
        ).toMatchObject({
            entityType: "tag",
            entityId: "tag-1",
            tags: ["交付"],
        });
    });
});
