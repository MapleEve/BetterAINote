import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client, type Row } from "@libsql/client";
import type { BrowserContext } from "@playwright/test";

const E2E_MARKER = ".betterainote-e2e-root";
const EXPECTED_MARKER = "BetterAINote E2E disposable root v1\n";

type BrowserStateSnapshot = {
    cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
    storage: Record<string, string>;
};

type CompletionSnapshot = {
    browser: BrowserStateSnapshot | null;
    settingsRows: Row[];
};

export type CompletionSeed = {
    expectedNameOrder: string[];
    expectedNewestOrder: string[];
    expectedOldestOrder: string[];
    ids: string[];
    sharedTimestampIds: string[];
    tags: {
        alpha: { id: string; name: string };
        beta: { id: string; name: string };
    };
};

export type RecordingListCompletionFixture = {
    captureBrowserState: (state: BrowserStateSnapshot) => void;
    clearSeed: () => Promise<void>;
    dispose: () => Promise<void>;
    getUserId: () => Promise<string>;
    holdLibraryWriteLock: () => Promise<() => Promise<void>>;
    readOwnedState: () => Promise<{ recordings: string[]; tags: string[] }>;
    restoreBrowserState: () => BrowserStateSnapshot | null;
    runId: string;
    seed: (userId: string) => Promise<CompletionSeed>;
    withLibrarySchemaOutage: <T>(operation: () => Promise<T>) => Promise<T>;
};

function requiredPath(name: string) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is required for recording-list completion E2E`);
    }
    return path.resolve(process.cwd(), value);
}

function assertManagedRoot(root: string) {
    const marker = path.join(root, E2E_MARKER);
    if (
        !existsSync(marker) ||
        readFileSync(marker, "utf8") !== EXPECTED_MARKER
    ) {
        throw new Error("Recording-list completion requires a managed E2E root");
    }
}

function assertInside(root: string, filePath: string) {
    const relative = path.relative(root, filePath);
    if (
        relative === "" ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
    ) {
        throw new Error("Recording-list completion database escaped its E2E root");
    }
}

function siblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext || ".db"}`);
}

function client(filePath: string) {
    return createClient({ url: pathToFileURL(filePath).href });
}

async function rowsForRun(database: Client, table: string, runId: string) {
    return database.execute({
        sql: `SELECT id FROM ${table} WHERE id LIKE ? ORDER BY id`,
        args: [`${runId}-%`],
    });
}

type SchemaToken = {
    end: number;
    kind: "backtick" | "bracket" | "double" | "symbol" | "word";
    start: number;
    text: string;
};

function schemaTokens(sql: string) {
    const tokens: SchemaToken[] = [];
    let index = 0;
    while (index < sql.length) {
        const current = sql[index];
        const next = sql[index + 1];
        if (/\s/.test(current)) {
            index += 1;
            continue;
        }
        if (current === "-" && next === "-") {
            const end = sql.indexOf("\n", index + 2);
            index = end < 0 ? sql.length : end + 1;
            continue;
        }
        if (current === "/" && next === "*") {
            const end = sql.indexOf("*/", index + 2);
            index = end < 0 ? sql.length : end + 2;
            continue;
        }
        if (current === "'") {
            index += 1;
            while (index < sql.length) {
                if (sql[index] === "'" && sql[index + 1] === "'") {
                    index += 2;
                    continue;
                }
                const done = sql[index] === "'";
                index += 1;
                if (done) break;
            }
            continue;
        }
        if (current === '"' || current === "`" || current === "[") {
            const start = index;
            const delimiter = current === "[" ? "]" : current;
            index += 1;
            while (index < sql.length) {
                if (sql[index] === delimiter && sql[index + 1] === delimiter) {
                    index += 2;
                    continue;
                }
                const done = sql[index] === delimiter;
                index += 1;
                if (done) break;
            }
            tokens.push({
                end: index,
                kind:
                    current === '"'
                        ? "double"
                        : current === "`"
                          ? "backtick"
                          : "bracket",
                start,
                text: sql.slice(start, index),
            });
            continue;
        }
        if (/[A-Za-z_]/.test(current)) {
            const start = index;
            index += 1;
            while (/[A-Za-z0-9_$]/.test(sql[index] ?? "")) index += 1;
            tokens.push({
                end: index,
                kind: "word",
                start,
                text: sql.slice(start, index),
            });
            continue;
        }
        tokens.push({
            end: index + 1,
            kind: "symbol",
            start: index,
            text: current,
        });
        index += 1;
    }
    return tokens;
}

function isKeyword(token: SchemaToken | undefined, keyword: string) {
    return token?.kind === "word" && token.text.toUpperCase() === keyword;
}

function afterIfNotExists(tokens: readonly SchemaToken[], start: number) {
    return isKeyword(tokens[start], "IF") &&
        isKeyword(tokens[start + 1], "NOT") &&
        isKeyword(tokens[start + 2], "EXISTS")
        ? start + 3
        : start;
}

function qualifiedTargetIndex(tokens: readonly SchemaToken[], start: number) {
    return tokens[start + 1]?.text === "." ? start + 2 : start;
}

function isExactRecordingsTarget(token: SchemaToken | undefined) {
    return (
        token?.text === "recordings" ||
        token?.text === '"recordings"' ||
        token?.text === "`recordings`"
    );
}

export function normalizeRecordingSchemaSql(sql: string) {
    const tokens = schemaTokens(sql);
    const targetIndexes = new Set<number>();
    for (let index = 0; index < tokens.length; index += 1) {
        if (isKeyword(tokens[index], "REFERENCES")) {
            targetIndexes.add(qualifiedTargetIndex(tokens, index + 1));
            continue;
        }
        if (!isKeyword(tokens[index], "CREATE")) continue;
        let cursor = index + 1;
        if (
            isKeyword(tokens[cursor], "TEMP") ||
            isKeyword(tokens[cursor], "TEMPORARY")
        ) {
            cursor += 1;
        }
        if (isKeyword(tokens[cursor], "TABLE")) {
            cursor = afterIfNotExists(tokens, cursor + 1);
            targetIndexes.add(qualifiedTargetIndex(tokens, cursor));
            continue;
        }
        if (isKeyword(tokens[cursor], "UNIQUE")) cursor += 1;
        if (!isKeyword(tokens[cursor], "INDEX")) continue;
        cursor = afterIfNotExists(tokens, cursor + 1);
        while (
            cursor < tokens.length &&
            tokens[cursor]?.text !== "(" &&
            !isKeyword(tokens[cursor], "ON")
        ) {
            cursor += 1;
        }
        if (isKeyword(tokens[cursor], "ON")) {
            targetIndexes.add(qualifiedTargetIndex(tokens, cursor + 1));
        }
    }

    const replacements = [...targetIndexes]
        .map((index) => tokens[index])
        .filter(isExactRecordingsTarget)
        .filter(
            (token): token is SchemaToken =>
                token !== undefined && token.text !== "recordings",
        )
        .sort((left, right) => right.start - left.start);
    let normalized = sql;
    for (const token of replacements) {
        normalized = `${normalized.slice(0, token.start)}recordings${normalized.slice(token.end)}`;
    }
    return normalized;
}

export function assertRecordingSchemaNormalizationMatrix() {
    for (const variants of [
        [
            "CREATE TABLE recordings (id TEXT)",
            'CREATE TABLE "recordings" (id TEXT)',
            "CREATE TABLE `recordings` (id TEXT)",
        ],
        [
            "CREATE INDEX recording_idx ON recordings (id)",
            'CREATE INDEX recording_idx ON "recordings" (id)',
            "CREATE INDEX recording_idx ON `recordings` (id)",
        ],
        [
            "CREATE TABLE child (recording_id TEXT REFERENCES recordings(id))",
            'CREATE TABLE child (recording_id TEXT REFERENCES "recordings"(id))',
            "CREATE TABLE child (recording_id TEXT REFERENCES `recordings`(id))",
        ],
    ]) {
        if (new Set(variants.map(normalizeRecordingSchemaSql)).size !== 1) {
            throw new Error(
                "Recording-list completion schema target normalization failed",
            );
        }
    }
    for (const preserved of [
        'CREATE TABLE other ("recordings" TEXT)',
        "CREATE TABLE other (note TEXT DEFAULT 'recordings')",
        "CREATE TABLE other (id TEXT) -- recordings",
        "CREATE TABLE other (id TEXT) /* recordings */",
        "CREATE TABLE [recordings] (id TEXT)",
        "CREATE TABLE Recordings (id TEXT)",
        "CREATE TABLE recordings_archive (id TEXT)",
    ]) {
        if (normalizeRecordingSchemaSql(preserved) !== preserved) {
            throw new Error(
                "Recording-list completion schema normalization widened scope",
            );
        }
    }
    const canonicalTable = normalizeRecordingSchemaSql(
        "CREATE TABLE recordings (id TEXT)",
    );
    for (const distinctTarget of [
        "CREATE TABLE [recordings] (id TEXT)",
        "CREATE TABLE Recordings (id TEXT)",
        "CREATE TABLE recordings_archive (id TEXT)",
    ]) {
        if (normalizeRecordingSchemaSql(distinctTarget) === canonicalTable) {
            throw new Error(
                "Recording-list completion schema normalization merged distinct targets",
            );
        }
    }
}

assertRecordingSchemaNormalizationMatrix();

async function librarySchemaSignature(database: Client) {
    const result = await database.execute(`
        SELECT type, name, tbl_name, sql
        FROM sqlite_schema
        WHERE tbl_name = 'recordings'
           OR sql LIKE '%recordings%'
        ORDER BY type, name
    `);
    return result.rows.map((row) => ({
        ...row,
        sql:
            typeof row.sql === "string"
                ? normalizeRecordingSchemaSql(row.sql)
                : row.sql,
    }));
}

async function libraryOwnedRows(database: Client, runId: string) {
    const tables = [
        "recordings",
        "recording_tags",
        "recording_tag_assignments",
        "transcription_jobs",
    ] as const;
    const rows = await Promise.all(
        tables.map(async (table) => {
            const result = await database.execute({
                sql: `SELECT * FROM ${table} WHERE id LIKE ? ORDER BY id`,
                args: [`${runId}-%`],
            });
            return [table, result.rows.map((row) => ({ ...row }))] as const;
        }),
    );
    return Object.fromEntries(rows);
}

function toMilliseconds(date: Date) {
    return date.getTime();
}

function localDate(now: Date, dayOffset: number, hour: number) {
    const value = new Date(now);
    value.setHours(hour, 0, 0, 0);
    value.setDate(value.getDate() + dayOffset);
    return value;
}

export async function createRecordingListCompletionFixture(): Promise<RecordingListCompletionFixture> {
    const root = requiredPath("PLAYWRIGHT_E2E_ROOT");
    const corePath = requiredPath("DATABASE_PATH");
    assertManagedRoot(root);
    assertInside(root, corePath);
    const libraryPath = siblingDatabasePath(corePath, "library");
    const transcriptsPath = siblingDatabasePath(corePath, "transcripts");
    const runId = `recording-list-${randomUUID()}`;
    const core = client(corePath);
    const library = client(libraryPath);
    const transcripts = client(transcriptsPath);
    const snapshot: CompletionSnapshot = { browser: null, settingsRows: [] };
    let fixtureUserId: string | null = null;
    let settingsSnapshotCaptured = false;
    let disposed = false;
    let cleanupPromise: Promise<void> | null = null;
    let seedCleanupPromise: Promise<void> | null = null;
    let activeOutage:
        | {
              outageTable: string;
              ownedBefore: Awaited<ReturnType<typeof libraryOwnedRows>>;
              restorationPromise: Promise<void> | null;
              signature: Awaited<ReturnType<typeof librarySchemaSignature>>;
          }
        | null = null;

    async function restoreActiveOutage() {
        const outage = activeOutage;
        if (!outage) return;
        if (outage.restorationPromise) {
            await outage.restorationPromise;
            return;
        }

        const attempt = (async () => {
            const management = client(libraryPath);
            try {
                const tables = await management.execute({
                    sql: `SELECT name
                        FROM sqlite_schema
                        WHERE type = 'table' AND name IN (?, ?)
                        ORDER BY name`,
                    args: ["recordings", outage.outageTable],
                });
                const names = tables.rows.map((row) => String(row.name));
                const hasRecordings = names.includes("recordings");
                const hasOutageTable = names.includes(outage.outageTable);
                if (hasRecordings === hasOutageTable) {
                    throw new Error(
                        "Recording-list completion outage table state is ambiguous",
                    );
                }
                if (hasOutageTable) {
                    await management.execute(
                        `ALTER TABLE ${outage.outageTable} RENAME TO recordings`,
                    );
                }

                const restoredSignature =
                    await librarySchemaSignature(management);
                const ownedAfter = await libraryOwnedRows(
                    management,
                    runId,
                );
                if (
                    JSON.stringify(restoredSignature) !==
                        JSON.stringify(outage.signature) ||
                    JSON.stringify(ownedAfter) !==
                        JSON.stringify(outage.ownedBefore)
                ) {
                    throw new Error(
                        "Recording-list completion schema restore readback failed",
                    );
                }
            } finally {
                management.close();
            }
        })();
        outage.restorationPromise = attempt;
        try {
            await attempt;
            if (activeOutage === outage) activeOutage = null;
        } catch (error) {
            if (outage.restorationPromise === attempt) {
                outage.restorationPromise = null;
            }
            throw error;
        }
    }

    async function getUserId() {
        const result = await core.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: ["playwright-admin@example.com"],
        });
        const userId = result.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Managed E2E login user is unavailable");
        }
        fixtureUserId = userId;
        if (!settingsSnapshotCaptured) {
            const settings = await core.execute({
                sql: "SELECT * FROM user_settings WHERE user_id = ?",
                args: [userId],
            });
            snapshot.settingsRows = [...settings.rows];
            settingsSnapshotCaptured = true;
        }
        return userId;
    }

    async function seed(userId: string): Promise<CompletionSeed> {
        fixtureUserId = userId;
        const now = new Date();
        const alpha = {
            id: `${runId}-tag-alpha`,
            name: `Alpha ${runId.slice(-8)}`,
        };
        const beta = {
            id: `${runId}-tag-beta`,
            name: `Beta ${runId.slice(-8)}`,
        };
        const ids = Array.from({ length: 24 }, (_, index) =>
            `${runId}-recording-${String(index + 1).padStart(2, "0")}`,
        );
        const sameTimestamp = localDate(now, 0, 9);
        const starts = ids.map((_id, index) => {
            if (index < 3) return sameTimestamp;
            if (index < 8) return localDate(now, 0, 8 - index);
            if (index < 12) return localDate(now, -1, 16 - index);
            if (index < 18) return localDate(now, -(index - 10), 10);
            return localDate(now, -(index + 1), 10);
        });
        const names = ids.map((_id, index) =>
            index === 0
                ? `2 review ${runId.slice(-8)}`
                : index === 1
                  ? `10 Review ${runId.slice(-8)}`
                  : `Recording ${String(index + 1).padStart(2, "0")} ${runId.slice(-8)}`,
        );

        await library.batch([
            ...[alpha, beta].map((tag, index) => ({
                sql: `INSERT INTO recording_tags
                    (id, user_id, name, color, icon, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    tag.id,
                    userId,
                    tag.name,
                    index === 0 ? "blue" : "purple",
                    index === 0 ? "grid" : "star",
                    toMilliseconds(now),
                    toMilliseconds(now),
                ],
            })),
            ...ids.map((id, index) => ({
                sql: `INSERT INTO recordings (
                    id, user_id, source_provider, source_recording_id,
                    source_version, source_metadata, provider_device_id,
                    filename, duration, start_time, end_time, filesize,
                    file_md5, storage_type, storage_path, downloaded_at,
                    upstream_trashed, upstream_deleted, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    id,
                    userId,
                    index % 2 === 0 ? "ticnote" : "plaud",
                    `${id}-source`,
                    "1",
                    "{}",
                    `${runId}-device`,
                    names[index],
                    60_000 + index * 1_000,
                    toMilliseconds(starts[index]),
                    toMilliseconds(starts[index]) + 60_000,
                    1_024 + index,
                    id,
                    "local",
                    "",
                    toMilliseconds(now),
                    0,
                    index === 4 ? 1 : 0,
                    toMilliseconds(now),
                    toMilliseconds(now),
                ],
            })),
            ...ids.flatMap((id, index) => {
                const tagIds =
                    index === 0
                        ? [alpha.id, beta.id]
                        : index < 5
                          ? [alpha.id]
                          : index < 8
                            ? [beta.id]
                            : [];
                return tagIds.map((tagId) => ({
                    sql: `INSERT INTO recording_tag_assignments
                        (id, user_id, recording_id, tag_id, created_at)
                        VALUES (?, ?, ?, ?, ?)`,
                    args: [
                        `${runId}-assignment-${index}-${tagId.endsWith("alpha") ? "a" : "b"}`,
                        userId,
                        id,
                        tagId,
                        toMilliseconds(now),
                    ],
                }));
            }),
            ...[
                { index: 1, status: "pending" },
                { index: 2, status: "running" },
                { index: 3, status: "failed" },
            ].map(({ index, status }) => ({
                sql: `INSERT INTO transcription_jobs
                    (id, user_id, recording_id, status, force, attempts,
                     requested_at, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?)`,
                args: [
                    `${runId}-job-${index}`,
                    userId,
                    ids[index],
                    status,
                    toMilliseconds(now),
                    toMilliseconds(now),
                    toMilliseconds(now),
                ],
            })),
        ]);
        await transcripts.execute({
            sql: `INSERT INTO transcriptions
                (id, recording_id, user_id, text, detected_language,
                 transcription_type, provider, model, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                `${runId}-transcription`,
                ids[0],
                userId,
                "Synthetic completion fixture transcript",
                "en",
                "server",
                "fixture",
                "fixture",
                toMilliseconds(now),
            ],
        });

        const newest = ids
            .map((id, index) => ({ id, start: starts[index].getTime() }))
            .sort(
                (left, right) =>
                    right.start - left.start ||
                    left.id.localeCompare(right.id),
            )
            .map((entry) => entry.id);
        const oldest = ids
            .map((id, index) => ({ id, start: starts[index].getTime() }))
            .sort(
                (left, right) =>
                    left.start - right.start ||
                    left.id.localeCompare(right.id),
            )
            .map((entry) => entry.id);
        const byName = ids
            .map((id, index) => ({ id, name: names[index] }))
            .sort(
                (left, right) => {
                    const leftName = left.name.replace(
                        /[A-Z]/g,
                        (character) => character.toLowerCase(),
                    );
                    const rightName = right.name.replace(
                        /[A-Z]/g,
                        (character) => character.toLowerCase(),
                    );
                    return (
                        (leftName < rightName
                            ? -1
                            : leftName > rightName
                              ? 1
                              : 0) || left.id.localeCompare(right.id)
                    );
                },
            )
            .map((entry) => entry.id);
        return {
            expectedNameOrder: byName,
            expectedNewestOrder: newest,
            expectedOldestOrder: oldest,
            ids,
            sharedTimestampIds: ids.slice(0, 3),
            tags: { alpha, beta },
        };
    }

    async function readOwnedState() {
        const [recordings, tags] = await Promise.all([
            rowsForRun(library, "recordings", runId),
            rowsForRun(library, "recording_tags", runId),
        ]);
        return {
            recordings: recordings.rows.map((row) => String(row.id)),
            tags: tags.rows.map((row) => String(row.id)),
        };
    }

    async function deleteSeedRows() {
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE id LIKE ?",
            args: [`${runId}-%`],
        });
        await library.batch([
            {
                sql: "DELETE FROM transcription_jobs WHERE id LIKE ?",
                args: [`${runId}-%`],
            },
            {
                sql: "DELETE FROM recording_tag_assignments WHERE id LIKE ?",
                args: [`${runId}-%`],
            },
            {
                sql: "DELETE FROM recordings WHERE id LIKE ?",
                args: [`${runId}-%`],
            },
            {
                sql: "DELETE FROM recording_tags WHERE id LIKE ?",
                args: [`${runId}-%`],
            },
        ]);
    }

    async function clearSeed() {
        if (seedCleanupPromise) {
            await seedCleanupPromise;
            return;
        }
        const attempt = (async () => {
            await restoreActiveOutage();
            await deleteSeedRows();
        })();
        seedCleanupPromise = attempt;
        try {
            await attempt;
        } catch (error) {
            if (seedCleanupPromise === attempt) seedCleanupPromise = null;
            throw error;
        }
    }

    async function cleanup() {
        if (disposed) return;
        if (cleanupPromise) {
            await cleanupPromise;
            return;
        }
        const attempt = (async () => {
            await clearSeed();
            const errors: unknown[] = [];
            if (fixtureUserId) {
                try {
                    await core.execute({
                        sql: "DELETE FROM user_settings WHERE user_id = ?",
                        args: [fixtureUserId],
                    });
                    if (snapshot.settingsRows[0]) {
                        const row = snapshot.settingsRows[0];
                        const columns = Object.keys(row);
                        await core.execute({
                            sql: `INSERT INTO user_settings (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
                            args: columns.map((column) => row[column]),
                        });
                    }
                    const restored = await core.execute({
                        sql: "SELECT * FROM user_settings WHERE user_id = ?",
                        args: [fixtureUserId],
                    });
                    if (
                        JSON.stringify(restored.rows) !==
                        JSON.stringify(snapshot.settingsRows)
                    ) {
                        throw new Error(
                            "Recording-list completion settings restore readback failed",
                        );
                    }
                } catch (error) {
                    errors.push(error);
                }
            }
            try {
                const remaining = await readOwnedState();
                if (remaining.recordings.length || remaining.tags.length) {
                    throw new Error(
                        "Recording-list completion cleanup readback failed",
                    );
                }
            } catch (error) {
                errors.push(error);
            }
            for (const database of [core, library, transcripts]) {
                try {
                    database.close();
                } catch (error) {
                    errors.push(error);
                }
            }
            if (errors.length > 0) {
                throw new AggregateError(
                    errors,
                    "Recording-list completion cleanup failed",
                );
            }
            disposed = true;
        })();
        cleanupPromise = attempt;
        try {
            await attempt;
        } catch (error) {
            if (cleanupPromise === attempt) cleanupPromise = null;
            throw error;
        }
    }

    return {
        captureBrowserState(state) {
            snapshot.browser = state;
        },
        clearSeed,
        dispose: cleanup,
        getUserId,
        async holdLibraryWriteLock() {
            const lock = client(libraryPath);
            await lock.execute("PRAGMA busy_timeout = 50");
            await lock.execute("BEGIN EXCLUSIVE");
            let released = false;
            return async () => {
                if (released) return;
                released = true;
                try {
                    await lock.execute("ROLLBACK");
                } finally {
                    lock.close();
                }
            };
        },
        readOwnedState,
        restoreBrowserState: () => snapshot.browser,
        runId,
        seed,
        async withLibrarySchemaOutage<T>(
            operation: () => Promise<T>,
        ): Promise<T> {
            if (activeOutage) {
                throw new Error(
                    "Recording-list completion schema outage is already active",
                );
            }
            const signature = await librarySchemaSignature(library);
            const ownedBefore = await libraryOwnedRows(library, runId);
            const outageTable = `${runId.replaceAll("-", "_")}_recordings`;
            if (!/^[A-Za-z0-9_]+$/.test(outageTable)) {
                throw new Error(
                    "Recording-list completion generated an unsafe outage table",
                );
            }
            await library.execute(
                `ALTER TABLE recordings RENAME TO ${outageTable}`,
            );
            activeOutage = {
                outageTable,
                ownedBefore,
                restorationPromise: null,
                signature,
            };

            let restoreError: unknown;
            let outcome:
                | { status: "error"; error: unknown }
                | { status: "success"; value: T };
            try {
                try {
                    outcome = {
                        status: "success",
                        value: await operation(),
                    };
                } catch (error) {
                    outcome = { error, status: "error" };
                }
            } finally {
                try {
                    await restoreActiveOutage();
                } catch (error) {
                    restoreError = error;
                }
            }

            if (outcome.status === "error" && restoreError !== undefined) {
                throw new AggregateError(
                    [outcome.error, restoreError],
                    "Recording-list completion outage and restore both failed",
                );
            }
            if (restoreError !== undefined) throw restoreError;
            if (outcome.status === "error") throw outcome.error;
            return outcome.value;
        },
    };
}
