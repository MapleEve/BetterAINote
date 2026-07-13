import { execFileSync } from "node:child_process";
import {
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { getDatabaseLayout } from "@/db/paths";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ROOT = path.resolve(ROOT, "..");

function readProjectFile(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function migrationSqlFiles(shard: string) {
    return readdirSync(path.join(ROOT, "db/migrations", shard))
        .filter((entry) => entry.endsWith(".sql"))
        .sort();
}

function runMigrate(databasePath: string) {
    execFileSync("bun", ["./src/db/migrate.ts"], {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
        env: {
            ...process.env,
            DATABASE_PATH: databasePath,
        },
    });
}

async function readCoreColumnNames(databasePath: string) {
    const client = createClient({ url: pathToFileURL(databasePath).href });
    try {
        const result = await client.execute("PRAGMA table_info(user_settings)");
        return result.rows.map((row) => String(row.name));
    } finally {
        await client.close();
    }
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

        const coreBaseline = readProjectFile(
            "db/migrations/core/0000_core_baseline.sql",
        );
        const coreSchema = readProjectFile("db/schema/core.ts");

        expect(coreBaseline).toContain(
            "`private_transcription_no_repeat_ngram_size` integer",
        );
        expect(coreBaseline).toContain(
            "`display_density` text DEFAULT 'comfy' NOT NULL",
        );
        expect(coreBaseline).toContain(
            "`default_volume` integer DEFAULT 80 NOT NULL",
        );
        expect(coreBaseline).toContain(
            "`auto_transcribe` integer DEFAULT 1 NOT NULL",
        );
        expect(coreBaseline).toContain("`default_transcription_provider` text");
        expect(coreSchema).toContain(
            'defaultVolume: integer("default_volume").notNull().default(80)',
        );
        expect(coreSchema).toContain(
            'autoTranscribe: bool("auto_transcribe").notNull().default(true)',
        );
        expect(coreSchema).toContain(
            'defaultTranscriptionProvider: text("default_transcription_provider")',
        );
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
        expect(migration).not.toContain("content=''");
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
        expect(migrateScript).toContain("PRAGMA table_info(user_settings)");
        expect(migrateScript).toContain(
            "ALTER TABLE user_settings ADD COLUMN default_transcription_provider text",
        );
        expect(e2eSetupScript).toContain("search:");
        expect(e2eSetupScript).toContain("migrations/search");
    });

    it("adds the default provider column to a legacy core database and remains idempotent", async () => {
        const tempDir = mkdtempSync(
            path.join(os.tmpdir(), "betterainote-migration-"),
        );
        const databasePath = path.join(tempDir, "legacy.db");

        try {
            runMigrate(databasePath);

            const legacyClient = createClient({
                url: pathToFileURL(databasePath).href,
            });
            try {
                await legacyClient.execute(
                    "ALTER TABLE user_settings DROP COLUMN default_transcription_provider",
                );
            } finally {
                await legacyClient.close();
            }

            runMigrate(databasePath);
            runMigrate(databasePath);

            expect(await readCoreColumnNames(databasePath)).toContain(
                "default_transcription_provider",
            );
        } finally {
            rmSync(tempDir, { force: true, recursive: true });
        }
    });
});
