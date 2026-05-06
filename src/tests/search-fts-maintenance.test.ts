import { describe, expect, it } from "vitest";
import {
    buildFtsPayloadForStoredChunk,
    isContentlessSearchContentFtsSchema,
    SEARCH_CONTENT_FTS_CREATE_SQL,
} from "@/server/modules/search/index-writer";

describe("search FTS maintenance", () => {
    it("detects legacy contentless FTS schemas that cannot be deleted normally", () => {
        expect(
            isContentlessSearchContentFtsSchema(`
                CREATE VIRTUAL TABLE search_content_fts USING fts5(
                    title,
                    body,
                    content=''
                )
            `),
        ).toBe(true);
        expect(
            isContentlessSearchContentFtsSchema(SEARCH_CONTENT_FTS_CREATE_SQL),
        ).toBe(false);
    });

    it("rebuilds FTS rows from stored chunks without widening public search scope", () => {
        expect(
            buildFtsPayloadForStoredChunk({
                rowid: 1,
                entityType: "recording",
                entityId: "recording-1",
                recordingId: "recording-1",
                title: "Roadmap sync",
                body: "Roadmap sync",
                speaker: "Alice",
                tags: "launch",
                source: "plaud",
            }),
        ).toEqual({
            rowid: 1,
            title: "Roadmap sync",
            body: "Roadmap sync",
            speaker: null,
            tags: null,
            source: null,
            entityType: "recording",
            entityId: "recording-1",
            recordingId: "recording-1",
        });
        expect(
            buildFtsPayloadForStoredChunk({
                rowid: 2,
                entityType: "transcript",
                entityId: "segment-1",
                recordingId: "recording-1",
                title: "Roadmap sync",
                body: "Only transcript text is searchable.",
                speaker: "Alice",
                tags: "launch",
                source: "plaud",
            }),
        ).toEqual({
            rowid: 2,
            title: null,
            body: "Only transcript text is searchable.",
            speaker: null,
            tags: null,
            source: null,
            entityType: "transcript",
            entityId: "segment-1",
            recordingId: "recording-1",
        });
    });
});
