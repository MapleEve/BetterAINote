import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required for E2E setup`);
    }

    return value;
}

const cwd = process.cwd();
const e2eRoot = requireEnv("PLAYWRIGHT_E2E_ROOT");
const appDir = requireEnv("PLAYWRIGHT_E2E_APP_DIR");
const dataDir = requireEnv("PLAYWRIGHT_E2E_DATA_DIR");
const storageDir = requireEnv("PLAYWRIGHT_E2E_STORAGE_DIR");
const databasePath = requireEnv("DATABASE_PATH");

rmSync(e2eRoot, { force: true, recursive: true });
mkdirSync(dataDir, { recursive: true });
mkdirSync(storageDir, { recursive: true });
mkdirSync(appDir, { recursive: true });

function prepareIsolatedAppDir() {
    const entriesToCopy = [
        ".env.test.local",
        ".env.local",
        ".env.development.local",
        "components.json",
        "loader.ts",
        "next-env.d.ts",
        "next.config.ts",
        "package.json",
        "pnpm-lock.yaml",
        "postcss.config.mjs",
        "public",
        "src",
        "tsconfig.json",
    ];

    for (const entry of entriesToCopy) {
        const sourcePath = path.resolve(cwd, entry);
        if (!existsSync(sourcePath)) {
            continue;
        }

        const targetPath = path.resolve(appDir, entry);
        cpSync(sourcePath, targetPath, {
            dereference: true,
            recursive: true,
        });
    }

    symlinkSync(
        path.resolve(cwd, "node_modules"),
        path.resolve(appDir, "node_modules"),
        "dir",
    );
}

function resolveDatabaseUrl(targetPath) {
    return pathToFileURL(path.resolve(targetPath)).href;
}

function deriveSiblingDatabasePath(targetPath, suffix) {
    const parsed = path.parse(targetPath);
    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-${suffix}${parsed.ext || ".db"}`,
    );
}

async function migrateDatabase(targetPath, migrationsFolder) {
    mkdirSync(path.dirname(targetPath), { recursive: true });

    const client = createClient({ url: resolveDatabaseUrl(targetPath) });
    try {
        await migrate(drizzle(client), { migrationsFolder });
    } finally {
        await client.close();
    }
}

async function applySqlFile(targetPath, sqlFilePath) {
    const client = createClient({ url: resolveDatabaseUrl(targetPath) });
    const sql = readFileSync(sqlFilePath, "utf8");
    const statements = sql
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

    try {
        for (const statement of statements) {
            await client.execute(statement);
        }
    } finally {
        await client.close();
    }
}

const layout = {
    core: databasePath,
    library: deriveSiblingDatabasePath(databasePath, "library"),
    transcripts: deriveSiblingDatabasePath(databasePath, "transcripts"),
    voiceprints: deriveSiblingDatabasePath(databasePath, "voiceprints"),
};

prepareIsolatedAppDir();

await applySqlFile(
    layout.core,
    path.resolve(cwd, "src/db/migrations/core/0000_core_baseline.sql"),
);
await migrateDatabase(
    layout.library,
    path.resolve(cwd, "src/db/migrations/library"),
);
await migrateDatabase(
    layout.transcripts,
    path.resolve(cwd, "src/db/migrations/transcripts"),
);
await migrateDatabase(
    layout.voiceprints,
    path.resolve(cwd, "src/db/migrations/voiceprints"),
);
