import { describe, expect, it, vi } from "vitest";
import { createSearchRepository } from "@/server/modules/search/search-repository";

describe("search repository", () => {
    it("searches only the requested user's recordings, transcripts, speakers, and tags", async () => {
        const storage = {
            search: vi.fn().mockResolvedValue([
                {
                    documentRowid: 7,
                    chunkRowid: 11,
                    entityType: "transcript",
                    entityId: "segment-1",
                    recordingId: "recording-1",
                    title: "04-24 讨论",
                    body: "动画 音频 交付",
                    speaker: "Alice",
                    tags: "会议 交付",
                    source: "ticnote",
                    startMs: 1000,
                    endMs: 3500,
                    sortSeqMs: 1000,
                    rank: -2.5,
                },
            ]),
        };

        const repository = createSearchRepository(storage);
        const results = await repository.search({
            userId: "user-1",
            query: "动画 OR payload",
            entityTypes: ["recording", "transcript", "speaker", "tag"],
            limit: 10,
        });

        expect(storage.search).toHaveBeenCalledWith({
            userId: "user-1",
            matchQuery: "动画 payload",
            entityTypes: ["recording", "transcript", "speaker", "tag"],
            limit: 10,
        });
        expect(results).toEqual([
            {
                entityType: "transcript",
                entityId: "segment-1",
                recordingId: "recording-1",
                title: "04-24 讨论",
                body: "动画 音频 交付",
                speaker: "Alice",
                tags: ["会议", "交付"],
                source: "ticnote",
                startMs: 1000,
                endMs: 3500,
                sortSeqMs: 1000,
                rank: -2.5,
            },
        ]);
    });

    it("returns no results for empty queries and never touches storage", async () => {
        const storage = {
            search: vi.fn(),
        };

        const repository = createSearchRepository(storage);

        await expect(
            repository.search({ userId: "user-1", query: " OR NEAR " }),
        ).resolves.toEqual([]);
        expect(storage.search).not.toHaveBeenCalled();
    });
});
