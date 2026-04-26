import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

const REQUIRED_GUARD = "BETTERAINOTE_E2E_RESET";
const PRESERVED_CORE_TABLES = ["source_connections", "api_credentials"];

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required for E2E reset`);
    }

    return value;
}

function resolveLocalPath(targetPath) {
    if (/^(libsql:|https?:)/.test(targetPath)) {
        throw new Error(`UnsafeE2EResetPath: remote database URL ${targetPath}`);
    }

    if (targetPath.startsWith("file:")) {
        return new URL(targetPath).pathname;
    }

    return targetPath;
}

function resolveDatabaseUrl(targetPath) {
    return pathToFileURL(path.resolve(resolveLocalPath(targetPath))).href;
}

function deriveSiblingDatabasePath(targetPath, suffix) {
    const localPath = resolveLocalPath(targetPath);
    const parsed = path.parse(localPath);
    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-${suffix}${parsed.ext || ".db"}`,
    );
}

function assertGuardedPath(targetPath, rootPath) {
    const resolvedTarget = path.resolve(resolveLocalPath(targetPath));
    const resolvedRoot = path.resolve(rootPath);
    const isInsideRoot =
        resolvedTarget === resolvedRoot ||
        resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);

    if (!isInsideRoot) {
        throw new Error(
            `UnsafeE2EResetPath: ${resolvedTarget} is outside ${resolvedRoot}`,
        );
    }
}

function getLayout(databasePath) {
    return {
        core: databasePath,
        library: deriveSiblingDatabasePath(databasePath, "library"),
        transcripts: deriveSiblingDatabasePath(databasePath, "transcripts"),
        voiceprints: deriveSiblingDatabasePath(databasePath, "voiceprints"),
        search: deriveSiblingDatabasePath(databasePath, "search"),
    };
}

async function executeStatements(databasePath, statements) {
    const localPath = resolveLocalPath(databasePath);
    if (!existsSync(localPath)) {
        return;
    }

    const client = createClient({ url: resolveDatabaseUrl(databasePath) });
    try {
        for (const statement of statements) {
            try {
                await client.execute(statement);
            } catch (error) {
                if (
                    error instanceof Error &&
                    /no such table/i.test(error.message)
                ) {
                    continue;
                }

                throw error;
            }
        }
    } finally {
        await client.close();
    }
}

function clearDirectory(targetPath, rootPath) {
    assertGuardedPath(targetPath, rootPath);
    rmSync(targetPath, { force: true, recursive: true });
    mkdirSync(targetPath, { recursive: true });
}

if (process.env[REQUIRED_GUARD] !== "1") {
    throw new Error(`${REQUIRED_GUARD}=1 is required for E2E reset`);
}

const e2eRoot = requireEnv("PLAYWRIGHT_E2E_ROOT");
const databasePath = requireEnv("DATABASE_PATH");
const storageDir = process.env.PLAYWRIGHT_E2E_STORAGE_DIR;
const layout = getLayout(databasePath);

for (const dbPath of Object.values(layout)) {
    assertGuardedPath(dbPath, e2eRoot);
}

console.log("BetterAINote E2E reset DB layout", layout);
console.log("Preserving core provider config tables", PRESERVED_CORE_TABLES);

await executeStatements(layout.core, [
    "DELETE FROM `sync_worker_state`",
    "DELETE FROM `verifications`",
    "UPDATE `user_settings` SET auto_sync_enabled = 0, auto_transcribe = 0, updated_at = cast((julianday('now') - 2440587.5)*86400000 as integer)",
    "UPDATE `source_connections` SET `last_sync` = NULL, `updated_at` = cast((julianday('now') - 2440587.5)*86400000 as integer)",
]);

await executeStatements(layout.library, [
    "DELETE FROM `transcription_jobs`",
    "DELETE FROM `recording_tag_assignments`",
    "DELETE FROM `recording_tags`",
    "DELETE FROM `recordings`",
    "DELETE FROM `source_devices`",
]);

await executeStatements(layout.transcripts, [
    "DELETE FROM `source_artifact_segments`",
    "DELETE FROM `transcript_segments`",
    "DELETE FROM `source_artifacts`",
    "DELETE FROM `transcriptions`",
]);

await executeStatements(layout.voiceprints, [
    "DELETE FROM `recording_speakers`",
    "DELETE FROM `speaker_profiles`",
]);

await executeStatements(layout.search, [
    "INSERT INTO search_content_fts(search_content_fts) VALUES('delete-all')",
    "DELETE FROM `search_index_jobs`",
    "DELETE FROM `search_tombstones`",
    "DELETE FROM `search_index_ranges`",
    "DELETE FROM `search_chunks`",
    "DELETE FROM `search_documents`",
    "DELETE FROM `search_name2id`",
]);

if (storageDir) {
    clearDirectory(storageDir, e2eRoot);
}
