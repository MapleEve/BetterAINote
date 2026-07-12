import { describe, expect, it } from "vitest";
import {
    buildRecordingSearchDocument,
    buildSpeakerSearchDocument,
    buildTagSearchDocument,
    buildTranscriptSearchDocument,
} from "@/server/modules/recordings/search-read-model";
import {
    buildFtsPayloadForChunk,
    buildFtsPayloadForStoredChunk,
    isContentlessSearchContentFtsSchema,
} from "@/server/modules/search/index-writer";

describe("search index writer", () => {
    it("indexes only the primary searchable fields for each search result type", () => {
        const recording = buildRecordingSearchDocument(
            {
                id: "recording-1",
                userId: "user-1",
                filename: "Q2 roadmap meeting",
                sourceProvider: "plaud",
                sourceRecordingId: "provider-hidden-id",
                startTime: new Date("2026-05-01T00:00:00.000Z"),
            },
            {
                tags: ["launch"],
                speakers: ["Alice"],
            },
        );
        expect(buildFtsPayloadForChunk(recording, recording.body)).toEqual({
            title: "Q2 roadmap meeting",
            body: "Q2 roadmap meeting",
            speaker: null,
            tags: null,
            source: null,
        });

        const transcript = buildTranscriptSearchDocument(
            {
                id: "segment-1",
                userId: "user-1",
                recordingId: "recording-1",
                transcriptOrigin: "source",
                rawSpeakerLabel: "Alice",
                text: "The transcript body is the searchable content.",
                sortSeqMs: 1000,
            },
            {
                recording: {
                    filename: "Q2 roadmap meeting",
                    sourceProvider: "plaud",
                },
                tags: ["launch"],
            },
        );
        expect(buildFtsPayloadForChunk(transcript, transcript.body)).toEqual({
            title: null,
            body: "The transcript body is the searchable content.",
            speaker: null,
            tags: null,
            source: null,
        });

        const speaker = buildSpeakerSearchDocument({
            id: "speaker-1",
            userId: "user-1",
            displayName: "Alice",
        });
        expect(buildFtsPayloadForChunk(speaker, speaker.body)).toEqual({
            title: "Alice",
            body: "Alice",
            speaker: "Alice",
            tags: null,
            source: null,
        });

        const tag = buildTagSearchDocument({
            id: "tag-1",
            userId: "user-1",
            name: "launch",
        });
        expect(buildFtsPayloadForChunk(tag, tag.body)).toEqual({
            title: "launch",
            body: "launch",
            speaker: null,
            tags: "launch",
            source: null,
        });
    });

    it("detects legacy contentless FTS schemas before writeback", () => {
        expect(
            isContentlessSearchContentFtsSchema(
                "CREATE VIRTUAL TABLE search_content_fts USING fts5(body, content='')",
            ),
        ).toBe(true);
        expect(
            isContentlessSearchContentFtsSchema(
                'CREATE VIRTUAL TABLE search_content_fts USING fts5(body, content="")',
            ),
        ).toBe(true);
        expect(
            isContentlessSearchContentFtsSchema(
                "CREATE VIRTUAL TABLE search_content_fts USING fts5(body)",
            ),
        ).toBe(false);
        expect(isContentlessSearchContentFtsSchema(null)).toBe(false);
    });

    it("rebuilds FTS rows from stored chunks without reintroducing hidden provider ids", () => {
        expect(
            buildFtsPayloadForStoredChunk({
                rowid: 7,
                entityType: "speaker",
                entityId: "speaker-1",
                recordingId: null,
                title: "Alice",
                body: "Alice",
                speaker: "Alice",
                tags: null,
                source: "plaud-example-id",
            }),
        ).toEqual({
            rowid: 7,
            title: "Alice",
            body: "Alice",
            speaker: "Alice",
            tags: null,
            source: null,
            entityType: "speaker",
            entityId: "speaker-1",
            recordingId: null,
        });

        expect(
            buildFtsPayloadForStoredChunk({
                rowid: 8,
                entityType: "tag",
                entityId: "tag-1",
                recordingId: null,
                title: "Launch",
                body: "Launch",
                speaker: null,
                tags: "Launch",
                source: null,
            }),
        ).toMatchObject({
            rowid: 8,
            title: "Launch",
            body: "Launch",
            tags: "Launch",
            entityType: "tag",
        });
    });
});
