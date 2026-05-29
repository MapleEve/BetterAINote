import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
    return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("search writeback integration", () => {
    it("records deleted recordings as search tombstones and delete jobs", () => {
        const source = readProjectFile(
            "src/server/modules/recordings/delete-recording.ts",
        );

        expect(source).toContain("enqueueSearchDeleteJob");
        expect(source).toContain('entityType: "recording"');
        expect(source).toContain("recordingId");
    });

    it("queues recording and tag reindexing after tag writes change search-visible data", () => {
        const source = readProjectFile(
            "src/server/modules/recording-tags/index.ts",
        );

        expect(source).toContain("enqueueSearchIndexJob");
        expect(source).toContain('entityType: "tag"');
        expect(source).toContain('entityType: "recording"');
    });

    it("queues speaker profile upserts and tombstones after speaker writes", () => {
        const source = readProjectFile("src/server/modules/speakers/index.ts");

        expect(source).toContain("enqueueSearchIndexJob");
        expect(source).toContain("enqueueSearchDeleteJob");
        expect(source).toContain('entityType: "speaker"');
    });

    it("runs queued search indexing from the background worker", () => {
        const source = readProjectFile("src/server/modules/sync/worker.ts");

        expect(source).toContain("processPendingSearchIndexJobs");
        expect(source).toContain("searchJobs=");
    });

    it("deletes stored FTS sidecar rows by rowid so tokenizer upgrades do not corrupt deletes", () => {
        const source = readProjectFile(
            "src/server/modules/search/index-writer.ts",
        );

        expect(source).toContain("DELETE FROM search_content_fts");
        expect(source).toContain("WHERE rowid IN");
        expect(source).toContain("ensureWritableSearchContentFtsTable");
        expect(source).toContain("isContentlessSearchContentFtsSchema");
        expect(source).not.toContain("'delete'");
        expect(source).not.toContain("search_content_fts,");
        expect(source).not.toContain("VALUES ${sql.join");
        expect(source).not.toContain("db.delete(searchContentFts)");
    });

    it("writes upserted chunks through an explicit FTS virtual-table insert", () => {
        const source = readProjectFile(
            "src/server/modules/search/index-writer.ts",
        );

        expect(source).toContain("async function insertFtsRow");
        expect(source).toContain("await searchDb.run(sql`");
        expect(source).not.toContain("db.insert(searchContentFts)");
    });

    it("marks rebuild-owned jobs through the search job processor instead of the read-model rebuild", () => {
        const processorSource = readProjectFile(
            "src/server/modules/search/job-processor.ts",
        );
        const rebuildSource = readProjectFile(
            "src/server/modules/search/rebuild.ts",
        );

        expect(processorSource).toContain("processTranscriptRebuildGroups");
        expect(processorSource).toContain("markJobCompleted");
        expect(processorSource).toContain("rebuildUser");
        expect(rebuildSource).not.toContain("searchIndexJobs");
        expect(rebuildSource).not.toContain("db.delete(searchIndexJobs)");
    });
});
