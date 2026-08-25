import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getDatabaseLayout, resolveDatabaseUrl } from "./paths";

// Migration boundary:
// - The shard baseline folders in `src/db/migrations/{core,library,transcripts,voiceprints,search}`
//   are the only migration source-of-truth.
// - There is no legacy unified migration chain to keep in sync anymore.
// - If schema changes, update the matching shard schema in `src/db/schema/*`
//   and the matching shard baseline here.

async function migrateDatabase(databasePath: string, migrationsFolder: string) {
    mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });

    const client = createClient({ url: resolveDatabaseUrl(databasePath) });

    try {
        await migrate(drizzle(client), { migrationsFolder });
    } finally {
        await client.close();
    }
}

async function ensureCoreCompatibilityColumns(databasePath: string) {
    const client = createClient({ url: resolveDatabaseUrl(databasePath) });

    try {
        const usersColumns = await client.execute("PRAGMA table_info(users)");
        const hasAnonymousColumn = usersColumns.rows.some(
            (row) => row.name === "is_anonymous",
        );

        if (!hasAnonymousColumn) {
            await client.execute(
                "ALTER TABLE users ADD COLUMN is_anonymous integer DEFAULT 0 NOT NULL",
            );
        }

        const userSettingsColumns = await client.execute(
            "PRAGMA table_info(user_settings)",
        );
        const userSettingsColumnNames = new Set(
            userSettingsColumns.rows.map((row) => row.name),
        );

        if (!userSettingsColumnNames.has("display_density")) {
            await client.execute(
                "ALTER TABLE user_settings ADD COLUMN display_density text DEFAULT 'comfy' NOT NULL",
            );
        }

        if (!userSettingsColumnNames.has("default_transcription_provider")) {
            await client.execute(
                "ALTER TABLE user_settings ADD COLUMN default_transcription_provider text",
            );
        }

        const sourceConnectionColumns = await client.execute(
            "PRAGMA table_info(source_connections)",
        );
        const sourceConnectionColumnNames = new Set(
            sourceConnectionColumns.rows.map((row) => row.name),
        );

        if (!sourceConnectionColumnNames.has("sync_status")) {
            await client.execute(
                "ALTER TABLE source_connections ADD COLUMN sync_status text DEFAULT 'idle' NOT NULL",
            );
        }

        if (!sourceConnectionColumnNames.has("last_sync_error")) {
            await client.execute(
                "ALTER TABLE source_connections ADD COLUMN last_sync_error text",
            );
        }

        if (!sourceConnectionColumnNames.has("last_sync_started_at")) {
            await client.execute(
                "ALTER TABLE source_connections ADD COLUMN last_sync_started_at integer",
            );
        }

        if (!sourceConnectionColumnNames.has("last_sync_finished_at")) {
            await client.execute(
                "ALTER TABLE source_connections ADD COLUMN last_sync_finished_at integer",
            );
        }
    } finally {
        await client.close();
    }
}

async function ensureVoiceprintsCompatibility(databasePath: string) {
    const client = createClient({ url: resolveDatabaseUrl(databasePath) });

    try {
        await client.execute(`
            CREATE TABLE IF NOT EXISTS speaker_profile_retry_authorizations (
                id text PRIMARY KEY NOT NULL,
                user_id text NOT NULL,
                mutation text NOT NULL,
                profile_id text NOT NULL,
                nonce text NOT NULL,
                expires_at integer NOT NULL,
                consumed_at integer,
                created_at integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
                updated_at integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
            )
        `);
        await client.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS speaker_profile_retry_authorizations_nonce_unique ON speaker_profile_retry_authorizations (nonce)",
        );
        await client.execute(
            "CREATE INDEX IF NOT EXISTS speaker_profile_retry_authorizations_user_expiry_idx ON speaker_profile_retry_authorizations (user_id, expires_at)",
        );
    } finally {
        await client.close();
    }
}

async function ensureSearchCompatibility(databasePath: string) {
    const client = createClient({ url: resolveDatabaseUrl(databasePath) });

    try {
        const columns = await client.execute(
            "PRAGMA table_info(search_index_jobs)",
        );
        const columnNames = new Set(columns.rows.map((row) => row.name));

        if (!columnNames.has("idempotency_key")) {
            await client.execute(
                "ALTER TABLE search_index_jobs ADD COLUMN idempotency_key text",
            );
        }

        await client.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS search_index_jobs_idempotency_key_unique ON search_index_jobs (idempotency_key)",
        );
    } finally {
        await client.close();
    }
}

const runMigrate = async () => {
    const databasePath = process.env.DATABASE_PATH;
    if (!databasePath) {
        throw new Error("DATABASE_PATH is not defined");
    }

    const layout = getDatabaseLayout(databasePath);
    const start = Date.now();

    console.log("⏳ Running BetterAINote shard migrations...");

    await migrateDatabase(layout.core, "./src/db/migrations/core");
    await ensureCoreCompatibilityColumns(layout.core);
    await migrateDatabase(layout.library, "./src/db/migrations/library");
    await migrateDatabase(
        layout.transcripts,
        "./src/db/migrations/transcripts",
    );
    await migrateDatabase(
        layout.voiceprints,
        "./src/db/migrations/voiceprints",
    );
    await ensureVoiceprintsCompatibility(layout.voiceprints);
    await migrateDatabase(layout.search, "./src/db/migrations/search");
    await ensureSearchCompatibility(layout.search);

    console.log("✅ Migrations completed in", Date.now() - start, "ms");
    process.exit(0);
};

runMigrate().catch((err) => {
    console.error("❌ Migration failed");
    console.error(err);
    process.exit(1);
});
