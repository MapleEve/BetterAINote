import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type {
    SelectedFields,
    SQLiteDeleteBase,
    SQLiteInsertBuilder,
    SQLiteSelectBuilder,
    SQLiteTable,
    SQLiteUpdateBuilder,
} from "drizzle-orm/sqlite-core";
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
    speakerProfiles,
    voiceprintsSchema,
} from "@/db/schema/voiceprints";
import { env } from "@/lib/env";
import { isBuildRuntime, isTestRuntime } from "@/lib/platform/runtime";
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
const voiceprintTables = new Set([speakerProfiles, recordingSpeakers]);

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

export const coreDb = layout
    ? drizzle(createClient({ url: resolveDatabaseUrl(layout.core) }), {
          schema: coreSchema,
      })
    : ({} as ReturnType<typeof drizzle<typeof coreSchema>>);

export const libraryDb = layout
    ? drizzle(createClient({ url: resolveDatabaseUrl(layout.library) }), {
          schema: librarySchema,
      })
    : ({} as ReturnType<typeof drizzle<typeof librarySchema>>);

export const transcriptsDb = layout
    ? drizzle(createClient({ url: resolveDatabaseUrl(layout.transcripts) }), {
          schema: transcriptsSchema,
      })
    : ({} as ReturnType<typeof drizzle<typeof transcriptsSchema>>);

export const voiceprintsDb = layout
    ? drizzle(createClient({ url: resolveDatabaseUrl(layout.voiceprints) }), {
          schema: voiceprintsSchema,
      })
    : ({} as ReturnType<typeof drizzle<typeof voiceprintsSchema>>);

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
