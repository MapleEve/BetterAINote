import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";

const PLAYWRIGHT_USER_EMAIL = "playwright-admin@example.com";

export const PAGINATION_RECORDING_COUNT = 21;
export const PAGINATION_RECORDING_ID_PREFIX = "e2e-recording-pagination-";
export const PAGINATION_FILTER_TERM = "pagination-filter-target";

function requireResolvedEnvPath(name: string) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is required for pagination E2E`);
    }
    return path.resolve(process.cwd(), value);
}

const E2E_ROOT = requireResolvedEnvPath("PLAYWRIGHT_E2E_ROOT");
const CORE_DB = requireResolvedEnvPath("DATABASE_PATH");

function assertE2EPath(filePath: string) {
    const resolvedPath = path.resolve(filePath);
    if (
        resolvedPath !== E2E_ROOT &&
        !resolvedPath.startsWith(`${E2E_ROOT}${path.sep}`)
    ) {
        throw new Error(`Refusing non-E2E database path: ${resolvedPath}`);
    }
}

function siblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext || ".db"}`);
}

const LIBRARY_DB = siblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = siblingDatabasePath(CORE_DB, "transcripts");
const VOICEPRINTS_DB = siblingDatabasePath(CORE_DB, "voiceprints");
const SEARCH_DB = siblingDatabasePath(CORE_DB, "search");

function createDatabaseClient(filePath: string) {
    assertE2EPath(filePath);
    return createClient({ url: pathToFileURL(filePath).href });
}

async function withClients<T>(
    callback: (clients: {
        library: Client;
        search: Client;
        transcripts: Client;
        voiceprints: Client;
    }) => Promise<T>,
) {
    const clients = {
        library: createDatabaseClient(LIBRARY_DB),
        search: createDatabaseClient(SEARCH_DB),
        transcripts: createDatabaseClient(TRANSCRIPTS_DB),
        voiceprints: createDatabaseClient(VOICEPRINTS_DB),
    };

    try {
        return await callback(clients);
    } finally {
        await Promise.all(Object.values(clients).map((client) => client.close()));
    }
}

export async function getPaginationTestUserId() {
    const core = createDatabaseClient(CORE_DB);
    try {
        const result = await core.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: [PLAYWRIGHT_USER_EMAIL],
        });
        const userId = result.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Playwright user was not created");
        }
        return userId;
    } finally {
        await core.close();
    }
}

export async function resetPaginationTestDatabase(userId: string) {
    await withClients(async ({ library, search, transcripts, voiceprints }) => {
        await voiceprints.execute({
            sql: "DELETE FROM recording_speakers WHERE user_id = ?",
            args: [userId],
        });

        await transcripts.batch([
            {
                sql: "DELETE FROM source_artifact_segments WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM transcript_segments WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM source_artifacts WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM transcriptions WHERE user_id = ?",
                args: [userId],
            },
        ]);

        await library.batch([
            {
                sql: "DELETE FROM transcription_jobs WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM recording_tag_assignments WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM recording_tags WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM recordings WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM source_devices WHERE user_id = ?",
                args: [userId],
            },
        ]);

        await search.execute({
            sql: `
                DELETE FROM search_content_fts
                WHERE rowid IN (
                    SELECT rowid FROM search_chunks WHERE user_id = ?
                )
            `,
            args: [userId],
        });
        await search.batch([
            {
                sql: "DELETE FROM search_chunks WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM search_documents WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM search_name2id WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM search_index_ranges WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM search_tombstones WHERE user_id = ?",
                args: [userId],
            },
            {
                sql: "DELETE FROM search_index_jobs WHERE user_id = ?",
                args: [userId],
            },
        ]);
    });
}

export async function seedPaginationRecordings(userId: string) {
    const library = createDatabaseClient(LIBRARY_DB);
    const now = Date.now();

    try {
        const statements = Array.from(
            { length: PAGINATION_RECORDING_COUNT },
            (_, offset) => {
                const index = offset + 1;
                const id = `${PAGINATION_RECORDING_ID_PREFIX}${index}`;
                const filename =
                    index <= 2
                        ? `E2E ${PAGINATION_FILTER_TERM} ${index}`
                        : `E2E pagination recording ${index}`;

                return {
                    sql: `
                        INSERT INTO recordings (
                            id, user_id, source_provider, source_recording_id,
                            source_version, source_metadata, provider_device_id,
                            filename, duration, start_time, end_time, filesize,
                            file_md5, storage_type, storage_path, downloaded_at,
                            upstream_trashed, upstream_deleted, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    args: [
                        id,
                        userId,
                        "ticnote",
                        `${id}-source`,
                        "1",
                        "{}",
                        "e2e-pagination-device",
                        filename,
                        60_000,
                        now - index * 60_000,
                        now - index * 60_000 + 60_000,
                        1024,
                        id,
                        "local",
                        "",
                        now,
                        0,
                        0,
                        now,
                        now,
                    ],
                };
            },
        );
        await library.batch(statements);
    } finally {
        await library.close();
    }
}

export async function readPaginationDatabaseState(userId: string) {
    const library = createDatabaseClient(LIBRARY_DB);
    try {
        const result = await library.execute({
            sql: `
                SELECT id
                FROM recordings
                WHERE user_id = ?
                ORDER BY start_time DESC, id ASC
            `,
            args: [userId],
        });
        return result.rows.map((row) => String(row.id));
    } finally {
        await library.close();
    }
}
