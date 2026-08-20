import {
    existsSync,
    lstatSync,
    mkdirSync,
    realpathSync,
    statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Client, createClient } from "@libsql/client";
import { Sqlite3Client } from "@libsql/client/sqlite3";
import { drizzle } from "drizzle-orm/libsql";
import type {
    SelectedFields,
    SQLiteDeleteBase,
    SQLiteInsertBuilder,
    SQLiteSelectBuilder,
    SQLiteTable,
    SQLiteUpdateBuilder,
} from "drizzle-orm/sqlite-core";
import NativeDatabase from "libsql";
import {
    accounts,
    apiCredentials,
    coreSchema,
    sessions,
    sourceConnections,
    syncWorkerState,
    userSettings,
    users,
    verifications,
} from "@/db/schema/core";
import {
    librarySchema,
    recordings,
    recordingTagAssignments,
    recordingTags,
    sourceDevices,
    transcriptionJobs,
} from "@/db/schema/library";
import {
    searchChunks,
    searchContentFts,
    searchDocuments,
    searchIndexJobs,
    searchIndexRanges,
    searchName2Id,
    searchSchema,
    searchTombstones,
} from "@/db/schema/search";
import {
    sourceArtifactSegments,
    sourceArtifacts,
    transcriptions,
    transcriptSegments,
    transcriptsSchema,
} from "@/db/schema/transcripts";
import {
    recordingSpeakers,
    speakerProfileRetryAuthorizations,
    speakerProfiles,
    voiceprintsSchema,
} from "@/db/schema/voiceprints";
import { env } from "@/lib/env";
import { isBuildRuntime, isTestRuntime } from "@/lib/platform/runtime";
import { configureCoreDatabaseReadiness } from "./core-ready";
import { getDatabaseLayout, resolveDatabaseUrl } from "./paths";

// Boundary note:
// - The shard schema imports below are the runtime source-of-truth.
// - `@/db/schema` remains a compatibility/tooling barrel only. Runtime table
//   routing in this file no longer reads through that barrel.
// - If a maintainer needs to understand "which schema is real", point them to
//   `src/db/schema/*` and the shard baselines under `src/db/migrations/*`.

if (!env.DATABASE_PATH && !isBuildRuntime() && !isTestRuntime()) {
    throw new Error(
        "DATABASE_PATH must be set in non-build runtime (dev/prod server)",
    );
}

const coreTables = new Set([
    users,
    sessions,
    accounts,
    verifications,
    apiCredentials,
    sourceConnections,
    userSettings,
    syncWorkerState,
]);
const libraryTables = new Set([
    sourceDevices,
    recordings,
    recordingTags,
    recordingTagAssignments,
    transcriptionJobs,
]);
const transcriptTables = new Set([
    transcriptions,
    sourceArtifacts,
    transcriptSegments,
    sourceArtifactSegments,
]);
const searchTables = new Set([
    searchName2Id,
    searchDocuments,
    searchChunks,
    searchContentFts,
    searchIndexRanges,
    searchTombstones,
    searchIndexJobs,
]);
const voiceprintTables = new Set([
    speakerProfiles,
    speakerProfileRetryAuthorizations,
    recordingSpeakers,
]);

function ensureParentDir(databasePath: string) {
    if (/^(file:|libsql:|https?:)/.test(databasePath)) {
        if (!databasePath.startsWith("file:")) {
            return;
        }

        const filePath = new URL(databasePath).pathname;
        mkdirSync(path.dirname(filePath), { recursive: true });
        return;
    }

    mkdirSync(path.dirname(path.resolve(databasePath)), {
        recursive: true,
    });
}

const layout = env.DATABASE_PATH ? getDatabaseLayout(env.DATABASE_PATH) : null;

if (layout) {
    ensureParentDir(layout.core);
    ensureParentDir(layout.library);
    ensureParentDir(layout.transcripts);
    ensureParentDir(layout.voiceprints);
    ensureParentDir(layout.search);
}

const coreClient = layout
    ? createClient({ url: resolveDatabaseUrl(layout.core) })
    : null;
configureCoreDatabaseReadiness(coreClient);

export const coreDb = coreClient
    ? drizzle(coreClient, {
          schema: coreSchema,
      })
    : ({} as ReturnType<typeof drizzle<typeof coreSchema>>);

const libraryDatabaseUrl = layout ? resolveDatabaseUrl(layout.library) : null;

export const libraryDb = libraryDatabaseUrl
    ? drizzle(createClient({ url: libraryDatabaseUrl }), {
          schema: librarySchema,
      })
    : ({} as ReturnType<typeof drizzle<typeof librarySchema>>);

type LibraryDb = ReturnType<typeof drizzle<typeof librarySchema>>;
export type LibraryReadDb = Readonly<Pick<LibraryDb, "select">>;

const DEFAULT_LIBRARY_DATABASE_BUSY_TIMEOUT_MS = 2_000;
const MIN_LIBRARY_DATABASE_BUSY_TIMEOUT_MS = 25;
const MAX_LIBRARY_DATABASE_BUSY_TIMEOUT_MS = 5_000;

type LibraryReadClientFactory = (
    databasePath: string,
    busyTimeoutMs: number,
) => Client;

function isPathInside(parent: string, candidate: string) {
    const relative = path.relative(parent, candidate);
    return (
        relative === "" ||
        (!relative.startsWith("..") && !path.isAbsolute(relative))
    );
}

function resolveLocalLibraryDatabase(databaseUrlOrPath: string | null) {
    if (!databaseUrlOrPath) {
        throw new Error("Library database is unavailable");
    }

    let databasePath: string;
    if (databaseUrlOrPath.startsWith("file:")) {
        if (!databaseUrlOrPath.startsWith("file://")) {
            throw new Error("Library database file URL must be absolute");
        }
        const databaseUrl = new URL(databaseUrlOrPath);
        if (
            databaseUrl.protocol !== "file:" ||
            databaseUrl.hostname !== "" ||
            databaseUrl.username !== "" ||
            databaseUrl.password !== "" ||
            databaseUrl.search !== "" ||
            databaseUrl.hash !== ""
        ) {
            throw new Error(
                "Library database must be an unqualified local file",
            );
        }
        databasePath = fileURLToPath(databaseUrl);
    } else {
        if (
            !path.isAbsolute(databaseUrlOrPath) ||
            databaseUrlOrPath.includes("?") ||
            databaseUrlOrPath.includes("#")
        ) {
            throw new Error("Library database path must be absolute");
        }
        databasePath = databaseUrlOrPath;
    }

    const resolvedPath = path.resolve(databasePath);
    let physicalPath: string;
    try {
        const pathEntry = lstatSync(resolvedPath);
        if (pathEntry.isSymbolicLink() || !pathEntry.isFile()) {
            throw new Error("Invalid library database path entry");
        }
        physicalPath = realpathSync.native(resolvedPath);
        if (!statSync(physicalPath).isFile()) {
            throw new Error("Invalid library database target");
        }
    } catch {
        throw new Error("Library database must be an existing regular file");
    }

    return {
        path: physicalPath,
    };
}

function resolveLibraryDatabaseBusyTimeoutMs(libraryPath: string) {
    const override = process.env.BETTERAINOTE_LIBRARY_BUSY_TIMEOUT_MS;
    if (override === undefined) {
        return DEFAULT_LIBRARY_DATABASE_BUSY_TIMEOUT_MS;
    }

    const e2eRootValue = process.env.PLAYWRIGHT_E2E_ROOT;
    if (!e2eRootValue || !path.isAbsolute(e2eRootValue)) {
        throw new Error(
            "Library database busy-timeout override requires an absolute managed E2E root",
        );
    }

    let e2eRoot: string;
    try {
        e2eRoot = realpathSync.native(path.resolve(e2eRootValue));
    } catch {
        throw new Error(
            "Library database busy-timeout override requires a managed E2E database path",
        );
    }
    const markerPath = path.join(e2eRoot, ".betterainote-e2e-root");
    let markerIsRegularFile = false;
    try {
        markerIsRegularFile =
            existsSync(markerPath) && statSync(markerPath).isFile();
    } catch {
        markerIsRegularFile = false;
    }
    if (!markerIsRegularFile || !isPathInside(e2eRoot, libraryPath)) {
        throw new Error(
            "Library database busy-timeout override requires a managed E2E database path",
        );
    }

    if (!/^\d+$/.test(override)) {
        throw new Error("Library database busy timeout must be an integer");
    }
    const parsed = Number(override);
    if (
        !Number.isSafeInteger(parsed) ||
        parsed < MIN_LIBRARY_DATABASE_BUSY_TIMEOUT_MS ||
        parsed > MAX_LIBRARY_DATABASE_BUSY_TIMEOUT_MS
    ) {
        throw new Error(
            `Library database busy timeout must be from ${MIN_LIBRARY_DATABASE_BUSY_TIMEOUT_MS} to ${MAX_LIBRARY_DATABASE_BUSY_TIMEOUT_MS} milliseconds`,
        );
    }

    return parsed;
}

function throwLibraryReadFailures(failures: unknown[]): never {
    if (failures.length === 1) {
        throw failures[0];
    }
    throw new AggregateError(failures, "Library read snapshot failed");
}

/**
 * Compatibility boundary for the exact pinned pair
 * `@libsql/client@0.17.3` + `libsql@0.5.29`. The exported sqlite3 subpath is
 * stable, but this constructor is marked private upstream. Keeping the raw
 * handle makes the timeout effective before the first synchronous SQLite
 * statement instead of setting it after a public factory's opening probe.
 * Any upgrade of either package must rerun the open-time timeout, Drizzle,
 * query-only, and deterministic-close regression tests.
 */
function createTimedLibraryReadClient(
    databasePath: string,
    busyTimeoutMs: number,
): Client {
    const options: NativeDatabase.Options = { timeout: busyTimeoutMs };
    let nativeDatabase: NativeDatabase.Database | null = null;

    try {
        nativeDatabase = new NativeDatabase(databasePath, options);
        return new Sqlite3Client(
            databasePath,
            options,
            nativeDatabase,
            "number",
        );
    } catch (cause) {
        if (nativeDatabase?.open) {
            try {
                nativeDatabase.close();
            } catch (closeCause) {
                throw new AggregateError(
                    [cause, closeCause],
                    "Library read client creation failed",
                );
            }
        }
        throw cause;
    }
}

/**
 * Consumes one explicitly-owned local client and keeps every library read on
 * its single SQLite snapshot. The callback receives only Drizzle's select
 * surface; PRAGMA query_only also rejects runtime DML and DDL on the handle.
 */
export async function runLibraryReadSnapshot<T>(
    client: Client,
    busyTimeoutMs: number,
    callback: (database: LibraryReadDb) => Promise<T>,
) {
    const failures: unknown[] = [];
    let transactionOpen = false;
    let completed = false;
    let result!: T;

    try {
        try {
            if (client.protocol !== "file") {
                throw new Error(
                    "Library read snapshots require a local file client",
                );
            }
            if (
                !Number.isSafeInteger(busyTimeoutMs) ||
                busyTimeoutMs < MIN_LIBRARY_DATABASE_BUSY_TIMEOUT_MS ||
                busyTimeoutMs > MAX_LIBRARY_DATABASE_BUSY_TIMEOUT_MS
            ) {
                throw new Error("Invalid library database busy timeout");
            }

            await client.execute(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
            await client.execute("PRAGMA query_only = ON");
            await client.execute("BEGIN DEFERRED");
            transactionOpen = true;
            await client.execute("SELECT 1 FROM recordings LIMIT 1");

            const database: LibraryReadDb = drizzle(client, {
                schema: librarySchema,
            });
            result = await callback(database);

            await client.execute("COMMIT");
            transactionOpen = false;
            completed = true;
        } catch (error) {
            failures.push(error);
            if (transactionOpen) {
                try {
                    await client.execute("ROLLBACK");
                    transactionOpen = false;
                } catch (rollbackError) {
                    failures.push(rollbackError);
                }
            }
        }
    } finally {
        try {
            client.close();
        } catch (closeError) {
            failures.push(closeError);
        }
    }

    if (failures.length > 0) {
        throwLibraryReadFailures(failures);
    }
    if (!completed) {
        throw new Error("Library read snapshot did not complete");
    }
    return result;
}

export async function withLibraryReadSnapshotAtUrl<T>(
    databaseUrlOrPath: string | null,
    callback: (database: LibraryReadDb) => Promise<T>,
    clientFactory: LibraryReadClientFactory = createTimedLibraryReadClient,
) {
    const localDatabase = resolveLocalLibraryDatabase(databaseUrlOrPath);
    const busyTimeoutMs = resolveLibraryDatabaseBusyTimeoutMs(
        localDatabase.path,
    );
    const client = clientFactory(localDatabase.path, busyTimeoutMs);

    return runLibraryReadSnapshot(client, busyTimeoutMs, callback);
}

export async function withLibraryReadSnapshot<T>(
    callback: (database: LibraryReadDb) => Promise<T>,
) {
    return withLibraryReadSnapshotAtUrl(libraryDatabaseUrl, callback);
}

/**
 * Runs one library write transaction on an owned client and closes it after
 * commit or rollback. The callback must not retain the transaction object.
 */
export async function runLibraryWriteTransaction<T>(
    client: Client,
    callback: (transaction: LibraryDb) => Promise<T>,
) {
    let transactionOpen = false;

    try {
        // Keep the native SQLite handle attached so finally can close it.
        await client.execute("BEGIN IMMEDIATE");
        transactionOpen = true;

        const transaction = drizzle(client, { schema: librarySchema });
        const result = await callback(transaction);

        await client.execute("COMMIT");
        transactionOpen = false;
        return result;
    } catch (error) {
        if (transactionOpen) {
            try {
                await client.execute("ROLLBACK");
            } catch (rollbackError) {
                throw new AggregateError(
                    [error, rollbackError],
                    "Library write transaction and rollback failed",
                );
            }
        }

        throw error;
    } finally {
        client.close();
    }
}

export async function withLibraryWriteTransaction<T>(
    callback: (transaction: LibraryDb) => Promise<T>,
) {
    if (!libraryDatabaseUrl) {
        throw new Error("Library database is unavailable");
    }

    return runLibraryWriteTransaction(
        createClient({ url: libraryDatabaseUrl }),
        callback,
    );
}

export const transcriptsDb = layout
    ? drizzle(createClient({ url: resolveDatabaseUrl(layout.transcripts) }), {
          schema: transcriptsSchema,
      })
    : ({} as ReturnType<typeof drizzle<typeof transcriptsSchema>>);

const voiceprintsDatabaseUrl = layout
    ? resolveDatabaseUrl(layout.voiceprints)
    : null;
const voiceprintsClient = voiceprintsDatabaseUrl
    ? createClient({ url: voiceprintsDatabaseUrl })
    : null;

export const voiceprintsDb = voiceprintsClient
    ? drizzle(voiceprintsClient, {
          schema: voiceprintsSchema,
      })
    : ({} as ReturnType<typeof drizzle<typeof voiceprintsSchema>>);

type VoiceprintsDb = ReturnType<typeof drizzle<typeof voiceprintsSchema>>;

/**
 * Runs a callback on one explicitly-owned SQLite client, then always closes
 * that client. Do not pass a process-wide client: this helper consumes it.
 */
export async function runVoiceprintsWriteTransaction<T>(
    client: Client,
    callback: (transaction: VoiceprintsDb) => Promise<T>,
) {
    let transactionOpen = false;

    try {
        // Do not use client.transaction(): libsql detaches its native SQLite
        // handle there, which prevents client.close() from releasing it.
        await client.execute("BEGIN IMMEDIATE");
        transactionOpen = true;

        const transaction = drizzle(client, { schema: voiceprintsSchema });
        const result = await callback(transaction);

        await client.execute("COMMIT");
        transactionOpen = false;
        return result;
    } catch (error) {
        if (transactionOpen) {
            try {
                await client.execute("ROLLBACK");
            } catch (rollbackError) {
                throw new AggregateError(
                    [error, rollbackError],
                    "Voiceprints write transaction and rollback failed",
                );
            }
        }

        throw error;
    } finally {
        client.close();
    }
}

export async function withVoiceprintsWriteTransaction<T>(
    callback: (transaction: VoiceprintsDb) => Promise<T>,
) {
    if (!voiceprintsDatabaseUrl) {
        throw new Error("Voiceprints database is unavailable");
    }

    return runVoiceprintsWriteTransaction(
        createClient({ url: voiceprintsDatabaseUrl }),
        callback,
    );
}

export const searchDb = layout
    ? drizzle(createClient({ url: resolveDatabaseUrl(layout.search) }), {
          schema: searchSchema,
      })
    : ({} as ReturnType<typeof drizzle<typeof searchSchema>>);

function resolveDbForTable(table: unknown) {
    if (coreTables.has(table as never)) {
        return coreDb;
    }

    if (libraryTables.has(table as never)) {
        return libraryDb;
    }

    if (transcriptTables.has(table as never)) {
        return transcriptsDb;
    }

    if (searchTables.has(table as never)) {
        return searchDb;
    }

    if (voiceprintTables.has(table as never)) {
        return voiceprintsDb;
    }

    throw new Error("Unknown table: cannot resolve database shard");
}

function createSelectFacade(fields?: Record<string, unknown>) {
    return {
        from(table: unknown) {
            const targetDb = resolveDbForTable(table);
            if (fields === undefined) {
                return targetDb.select().from(table as SQLiteTable);
            }

            return targetDb
                .select(fields as SelectedFields)
                .from(table as SQLiteTable);
        },
    };
}

interface DbFacade {
    select(): SQLiteSelectBuilder<undefined, "async", unknown>;
    select<TSelection extends SelectedFields>(
        fields: TSelection,
    ): SQLiteSelectBuilder<TSelection, "async", unknown>;
    insert<TTable extends SQLiteTable>(
        table: TTable,
    ): SQLiteInsertBuilder<TTable, "async", unknown>;
    update<TTable extends SQLiteTable>(
        table: TTable,
    ): SQLiteUpdateBuilder<TTable, "async", unknown>;
    delete<TTable extends SQLiteTable>(
        table: TTable,
    ): SQLiteDeleteBase<TTable, "async", unknown>;
}

function select(): SQLiteSelectBuilder<undefined, "async", unknown>;
function select<TSelection extends SelectedFields>(
    fields: TSelection,
): SQLiteSelectBuilder<TSelection, "async", unknown>;
function select(fields?: SelectedFields) {
    return createSelectFacade(fields) as unknown as SQLiteSelectBuilder<
        typeof fields,
        "async",
        unknown
    >;
}

export const db: DbFacade = {
    select,
    insert(table) {
        return resolveDbForTable(table).insert(table);
    },
    update(table) {
        return resolveDbForTable(table).update(table);
    },
    delete(table) {
        return resolveDbForTable(table).delete(table);
    },
};

const toolingSchema = {
    ...coreSchema,
    ...librarySchema,
    ...transcriptsSchema,
    ...voiceprintsSchema,
    ...searchSchema,
};

// Compatibility alias only. Runtime DB routing uses the shard imports above,
// not this aggregate object.
export const schema = toolingSchema;
export { toolingSchema };

export { layout as databaseLayout };
