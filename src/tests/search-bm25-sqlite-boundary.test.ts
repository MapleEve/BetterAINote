import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, describe, expect, it } from "vitest";
import { buildSearchRowsQuery } from "@/server/modules/search/queries";
import { SEARCH_ENTITY_TYPES } from "@/server/modules/search/search-repository";

let tempDirs: string[] = [];

type SearchSqlRow = {
    entityType: string;
    entityId: string;
    rank: number;
};

async function applySearchBaseline(client: Client) {
    const migration = readFileSync(
        path.join(
            process.cwd(),
            "src/db/migrations/search/0000_search_baseline.sql",
        ),
        "utf8",
    );
    const statements = migration
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

    for (const statement of statements) {
        await client.execute(statement);
    }
}

async function createSearchDatabase() {
    const dir = mkdtempSync(path.join(tmpdir(), "betterainote-search-"));
    tempDirs.push(dir);
    const client = createClient({
        url: pathToFileURL(path.join(dir, "search.db")).href,
    });
    await applySearchBaseline(client);
    return { client, db: drizzle(client) };
}

async function seedSearchRows(client: Client) {
    await client.execute(`
        INSERT INTO search_documents(
            rowid,
            id,
            user_id,
            entity_type,
            entity_id,
            recording_id,
            title,
            content_hash,
            sort_seq_ms,
            deleted_at
        ) VALUES
            (1, 'doc-recording', 'user-1', 'recording', 'recording-1', 'recording-1', 'Alpha project', 'h1', 300, NULL),
            (2, 'doc-transcript', 'user-1', 'transcript', 'transcript-1', 'recording-1', 'Alpha transcript', 'h2', 200, NULL),
            (3, 'doc-speaker', 'user-1', 'speaker', 'speaker-1', NULL, 'Alice', 'h3', 100, NULL),
            (4, 'doc-tag', 'user-1', 'tag', 'tag-1', NULL, 'Alpha tag', 'h4', 50, NULL),
            (5, 'doc-other-user', 'user-2', 'recording', 'recording-2', 'recording-2', 'Alpha other', 'h5', 400, NULL),
            (6, 'doc-deleted', 'user-1', 'recording', 'recording-deleted', 'recording-deleted', 'Alpha deleted', 'h6', 500, 1770000000000)
    `);
    await client.execute(`
        INSERT INTO search_chunks(
            rowid,
            document_rowid,
            user_id,
            entity_type,
            entity_id,
            recording_id,
            chunk_index,
            body,
            body_hash,
            sort_seq_ms
        ) VALUES
            (1, 1, 'user-1', 'recording', 'recording-1', 'recording-1', 0, 'alpha alpha alpha meeting', 'c1', 300),
            (2, 2, 'user-1', 'transcript', 'transcript-1', 'recording-1', 0, 'alpha meeting transcript', 'c2', 200),
            (3, 3, 'user-1', 'speaker', 'speaker-1', NULL, 0, 'alice speaker alpha', 'c3', 100),
            (4, 4, 'user-1', 'tag', 'tag-1', NULL, 0, 'alpha tag label', 'c4', 50),
            (5, 5, 'user-2', 'recording', 'recording-2', 'recording-2', 0, 'alpha other user', 'c5', 400),
            (6, 6, 'user-1', 'recording', 'recording-deleted', 'recording-deleted', 0, 'alpha alpha alpha alpha deleted', 'c6', 500)
    `);
    await client.execute(`
        INSERT INTO search_content_fts(
            rowid,
            title,
            body,
            speaker,
            tags,
            source,
            entity_type,
            entity_id,
            recording_id
        ) VALUES
            (1, 'Alpha project', 'alpha alpha alpha meeting', '', '', '', 'recording', 'recording-1', 'recording-1'),
            (2, 'Alpha transcript', 'alpha meeting transcript', '', '', '', 'transcript', 'transcript-1', 'recording-1'),
            (3, 'Alice', 'alice speaker alpha', 'Alice', '', '', 'speaker', 'speaker-1', NULL),
            (4, 'Alpha tag', 'alpha tag label', '', 'alpha', '', 'tag', 'tag-1', NULL),
            (5, 'Alpha other', 'alpha other user', '', '', '', 'recording', 'recording-2', 'recording-2'),
            (6, 'Alpha deleted', 'alpha alpha alpha alpha deleted', '', '', '', 'recording', 'recording-deleted', 'recording-deleted')
    `);
}

describe("SQLite BM25 search boundary", () => {
    afterEach(() => {
        for (const dir of tempDirs) {
            rmSync(dir, { recursive: true, force: true });
        }
        tempDirs = [];
    });

    it("executes FTS5 MATCH with BM25 ranking over the four public search scopes", async () => {
        const { client, db } = await createSearchDatabase();
        await seedSearchRows(client);

        const rows = (await db.all(
            buildSearchRowsQuery({
                userId: "user-1",
                matchQuery: "alpha",
                entityTypes: [...SEARCH_ENTITY_TYPES],
                limit: 10,
            }),
        )) as SearchSqlRow[];

        expect(rows).toHaveLength(4);
        expect(rows.map((row) => row.entityId)).not.toContain("recording-2");
        expect(rows.map((row) => row.entityId)).not.toContain(
            "recording-deleted",
        );
        expect(new Set(rows.map((row) => row.entityType))).toEqual(
            new Set(["recording", "transcript", "speaker", "tag"]),
        );
        expect(rows.every((row) => typeof row.rank === "number")).toBe(true);
        expect(rows[0].rank).toBeLessThan(rows.at(-1)?.rank as number);
    });

    it("applies entity filters before returning BM25-ranked rows", async () => {
        const { client, db } = await createSearchDatabase();
        await seedSearchRows(client);

        const rows = (await db.all(
            buildSearchRowsQuery({
                userId: "user-1",
                matchQuery: "alpha",
                entityTypes: ["speaker", "tag"],
                limit: 10,
            }),
        )) as SearchSqlRow[];

        expect(rows.map((row) => row.entityType).sort()).toEqual([
            "speaker",
            "tag",
        ]);
    });
});
