import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getDatabaseLayout } from "@/db/paths";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readProjectFile(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function migrationSqlFiles(shard: string) {
    return readdirSync(path.join(ROOT, "db/migrations", shard))
        .filter((entry) => entry.endsWith(".sql"))
        .sort();
}

describe("preview database foundation", () => {
    it("derives a rebuildable search sidecar next to the business databases", () => {
        expect(getDatabaseLayout("/tmp/betterainote.db")).toMatchObject({
            core: "/tmp/betterainote.db",
            library: "/tmp/betterainote-library.db",
            transcripts: "/tmp/betterainote-transcripts.db",
            voiceprints: "/tmp/betterainote-voiceprints.db",
            search: "/tmp/betterainote-search.db",
        });
    });

    it("adds normalized transcript segment tables for local and source transcripts", () => {
        const migrationPath = path.join(
            ROOT,
            "db/migrations/transcripts/0000_transcripts_baseline.sql",
        );

        expect(existsSync(migrationPath)).toBe(true);

        const migration = readFileSync(migrationPath, "utf8");

        expect(migration).toContain("CREATE TABLE `transcript_segments`");
        expect(migration).toContain("`transcript_origin` text NOT NULL");
        expect(migration).toContain("`source_artifact_id` text");
        expect(migration).toContain("`sort_seq_ms` integer NOT NULL");
        expect(migration).toContain(
            "CREATE INDEX `transcript_segments_user_recording_sort_idx`",
        );
        expect(migration).toContain("CREATE TABLE `source_artifact_segments`");
    });

    it("keeps the preview database contract as shard baselines instead of development migration fragments", () => {
        expect(migrationSqlFiles("core")).toEqual(["0000_core_baseline.sql"]);
        expect(migrationSqlFiles("library")).toEqual([
            "0000_library_baseline.sql",
        ]);
        expect(migrationSqlFiles("transcripts")).toEqual([
            "0000_transcripts_baseline.sql",
        ]);
        expect(migrationSqlFiles("voiceprints")).toEqual([
            "0000_voiceprints_baseline.sql",
        ]);
        expect(migrationSqlFiles("search")).toEqual([
            "0000_search_baseline.sql",
        ]);

        expect(
            readProjectFile("db/migrations/core/0000_core_baseline.sql"),
        ).toContain("`private_transcription_no_repeat_ngram_size` integer");
        expect(
            readProjectFile("db/migrations/library/0000_library_baseline.sql"),
        ).toContain("CREATE TABLE `recording_tags`");
    });

    it("defines the search sidecar as a rebuildable recordings/transcripts/speakers/tags index", () => {
        const migrationPath = path.join(
            ROOT,
            "db/migrations/search/0000_search_baseline.sql",
        );

        expect(existsSync(migrationPath)).toBe(true);

        const migration = readFileSync(migrationPath, "utf8");

        expect(migration).toContain("CREATE TABLE `search_documents`");
        expect(migration).toContain("CREATE TABLE `search_chunks`");
        expect(migration).toContain(
            "CREATE VIRTUAL TABLE `search_content_fts`",
        );
        expect(migration).toContain("CREATE TABLE `search_index_jobs`");
        expect(migration).toContain("CREATE TABLE `search_tombstones`");
        expect(migration).toContain("`index_version` integer");
        expect(migration).toContain("`content_hash` text NOT NULL");
        expect(migration).toContain(
            "CHECK (`entity_type` IN ('recording','transcript','speaker','tag'))",
        );
        expect(migration).not.toContain("provider_payload");
        expect(migration).not.toContain("source_report");
    });

    it("wires the search shard through runtime migration and E2E setup", () => {
        const migrateScript = readProjectFile("db/migrate.ts");
        const e2eSetupScript = readProjectFile("../scripts/e2e-setup.mjs");

        expect(migrateScript).toContain("layout.search");
        expect(migrateScript).toContain("migrations/search");
        expect(e2eSetupScript).toContain("search:");
        expect(e2eSetupScript).toContain("migrations/search");
    });
});
