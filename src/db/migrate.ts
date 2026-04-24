import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getDatabaseLayout, resolveDatabaseUrl } from "./paths";

// Migration boundary:
// - The shard baseline folders in `src/db/migrations/{core,library,transcripts,voiceprints}`
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

const runMigrate = async () => {
    const databasePath = process.env.DATABASE_PATH;
    if (!databasePath) {
        throw new Error("DATABASE_PATH is not defined");
    }

    const layout = getDatabaseLayout(databasePath);
    const start = Date.now();

    console.log("⏳ Running BetterAINote shard migrations...");

    await migrateDatabase(layout.core, "./src/db/migrations/core");
    await migrateDatabase(layout.library, "./src/db/migrations/library");
    await migrateDatabase(
        layout.transcripts,
        "./src/db/migrations/transcripts",
    );
    await migrateDatabase(
        layout.voiceprints,
        "./src/db/migrations/voiceprints",
    );

    console.log("✅ Migrations completed in", Date.now() - start, "ms");
    process.exit(0);
};

runMigrate().catch((err) => {
    console.error("❌ Migration failed");
    console.error(err);
    process.exit(1);
});
