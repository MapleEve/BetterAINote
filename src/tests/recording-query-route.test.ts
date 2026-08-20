import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Client, createClient } from "@libsql/client";
import { Sqlite3Client } from "@libsql/client/sqlite3";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import NativeDatabase from "libsql";
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    expectTypeOf,
    it,
    vi,
} from "vitest";
import type { LibraryReadDb } from "@/db";
import {
    librarySchema,
    recordings,
    recordingTagAssignments,
    recordingTags,
} from "@/db/schema/library";
import { transcriptions, transcriptsSchema } from "@/db/schema/transcripts";

const APP_URL = "http://127.0.0.1:3218";
const TEST_AUTH_SECRET = "isolated-recording-query-route-auth-secret-2026";
const testRoot = mkdtempSync(
    path.join(tmpdir(), "betterainote-recording-query-"),
);
const coreDatabasePath = path.join(testRoot, "betterainote.db");
const libraryDatabasePath = path.join(testRoot, "betterainote-library.db");
const transcriptsDatabasePath = path.join(
    testRoot,
    "betterainote-transcripts.db",
);

process.env.APP_URL = APP_URL;
process.env.BETTER_AUTH_SECRET = TEST_AUTH_SECRET;
process.env.DATABASE_PATH = coreDatabasePath;
process.env.PLAYWRIGHT_E2E_ROOT = testRoot;
process.env.BETTERAINOTE_LIBRARY_BUSY_TIMEOUT_MS = "300";
writeFileSync(path.join(testRoot, ".betterainote-e2e-root"), "managed\n");

type Auth = typeof import("@/lib/auth").auth;
type QueryRoute = typeof import("@/app/api/recordings/query/route").GET;
type LibraryDb = ReturnType<typeof drizzle<typeof librarySchema>>;
type TranscriptsDb = ReturnType<typeof drizzle<typeof transcriptsSchema>>;

type QueryResponse = {
    facets: {
        timeline: {
            all: number;
            today: number;
            yesterday: number;
            last7: number;
            earlier: number;
        };
        tags: {
            all: number;
            untagged: number;
            items: Array<{
                id: string;
                name: string;
                color: string;
                icon: string;
                count: number;
            }>;
        };
    };
    pagination: { page: number; pageSize: number; total: number };
    recordings: Array<{ id: string; filename: string }>;
};

let auth: Auth;
let GETQuery: QueryRoute;
let authenticatedHeaders: Headers;
let userId: string;
let coreClient: Client;
let libraryClient: Client;
let transcriptsClient: Client;
let libraryDb: LibraryDb;
let transcriptsDb: TranscriptsDb;
let runtimeLibraryClient: Client;
let runtimeLibraryDb: typeof import("@/db").libraryDb;
let runtimeOtherClients: Client[] = [];
let runLibraryReadSnapshot: typeof import("@/db").runLibraryReadSnapshot;
let withLibraryReadSnapshotAtUrl: typeof import("@/db").withLibraryReadSnapshotAtUrl;

function databaseUrl(filePath: string) {
    return pathToFileURL(filePath).href;
}

async function applyBaseline(
    client: Client,
    shard: "core" | "library" | "transcripts",
) {
    const migration = readFileSync(
        path.join(
            process.cwd(),
            `src/db/migrations/${shard}/0000_${shard}_baseline.sql`,
        ),
        "utf8",
    );
    const statements = migration
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

    await client.execute("PRAGMA foreign_keys = ON");
    for (const statement of statements) {
        await client.execute(statement);
    }
}

function startOfToday() {
    const result = new Date();
    result.setHours(0, 0, 0, 0);
    return result;
}

function localDaysAgo(days: number, hour = 10) {
    const result = startOfToday();
    result.setDate(result.getDate() - days);
    result.setHours(hour, 0, 0, 0);
    return result;
}

function localDateParam(value: Date) {
    return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, "0"),
        String(value.getDate()).padStart(2, "0"),
    ].join("-");
}

async function createAuthenticatedHeaders() {
    const response = await auth.handler(
        new Request(`${APP_URL}/api/auth/sign-up/email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Origin: APP_URL,
            },
            body: JSON.stringify({
                email: "recording-query-route@example.test",
                name: "Recording Query Route",
                password: "RecordingQueryRoutePassword123!",
            }),
        }),
    );
    if (!response.ok) {
        throw new Error(`Test sign-up failed with status ${response.status}`);
    }

    const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
    const payload = (await response.json()) as { user?: { id?: unknown } };
    if (!cookie || typeof payload.user?.id !== "string") {
        throw new Error("Test sign-up did not establish a session");
    }

    userId = payload.user.id;
    return new Headers({ Cookie: cookie });
}

function request(pathname: string, authenticated = true) {
    return new Request(`${APP_URL}${pathname}`, {
        headers: authenticated ? authenticatedHeaders : undefined,
    });
}

async function query(pathname: string) {
    const response = await GETQuery(request(pathname));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    return (await response.json()) as QueryResponse;
}

async function holdLibraryWriteLock(holdMs: number) {
    const clientModuleUrl = import.meta.resolve("@libsql/client");
    const script = `
        import { createClient } from ${JSON.stringify(clientModuleUrl)};
        const client = createClient({ url: ${JSON.stringify(databaseUrl(libraryDatabasePath))} });
        await client.execute("PRAGMA busy_timeout = 1000");
        await client.execute("PRAGMA locking_mode = EXCLUSIVE");
        await client.execute("BEGIN EXCLUSIVE");
        await client.execute("UPDATE recordings SET filename = filename WHERE id = (SELECT id FROM recordings LIMIT 1)");
        process.stdout.write("LOCKED\\n");
        await new Promise((resolve) => setTimeout(resolve, ${holdMs}));
        await client.execute("ROLLBACK");
        client.close();
    `;
    const child = spawn(
        process.execPath,
        ["--input-type=module", "-e", script],
        {
            cwd: process.cwd(),
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
    });
    const exited = new Promise<void>((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(
                new Error(
                    `Library lock child failed (code=${code}, signal=${signal}): ${stderr}`,
                ),
            );
        });
    });
    await new Promise<void>((resolve, reject) => {
        let stdout = "";
        child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
            if (stdout.includes("LOCKED\n")) {
                resolve();
            }
        });
        exited.catch(reject);
    });
    return { exited };
}

function flattenedErrors(error: unknown) {
    return error instanceof AggregateError ? error.errors : [error];
}

function statementText(statement: unknown) {
    if (typeof statement === "string") {
        return statement;
    }
    if (
        typeof statement === "object" &&
        statement !== null &&
        "sql" in statement &&
        typeof statement.sql === "string"
    ) {
        return statement.sql;
    }
    return String(statement);
}

async function insertRecording(input: {
    id: string;
    filename: string;
    startTime: Date;
    ownerId?: string;
    trashed?: boolean;
}) {
    const ownerId = input.ownerId ?? userId;
    await libraryDb.insert(recordings).values({
        id: input.id,
        userId: ownerId,
        sourceProvider: input.id.endsWith("0") ? "plaud" : "manual",
        sourceRecordingId: `${ownerId}-${input.id}`,
        providerDeviceId: "fixture-device",
        filename: input.filename,
        duration: 60_000,
        startTime: input.startTime,
        endTime: new Date(input.startTime.getTime() + 60_000),
        filesize: 1024,
        fileMd5: `${input.id}-checksum`,
        storageType: "local",
        storagePath: `/fixtures/${input.id}.m4a`,
        upstreamTrashed: input.trashed ?? false,
    });
}

async function insertTag(input: {
    id: string;
    name: string;
    ownerId?: string;
}) {
    await libraryDb.insert(recordingTags).values({
        id: input.id,
        userId: input.ownerId ?? userId,
        name: input.name,
        color: input.id.endsWith("alpha") ? "blue" : "green",
        icon: input.id.endsWith("alpha") ? "flag" : "book",
    });
}

async function assignTag(recordingId: string, tagId: string, ownerId = userId) {
    await libraryDb.insert(recordingTagAssignments).values({
        id: `${ownerId}-${recordingId}-${tagId}`,
        userId: ownerId,
        recordingId,
        tagId,
    });
}

async function seedFixture() {
    const sharedStartTime = localDaysAgo(0, 10);
    for (let index = 0; index < 23; index += 1) {
        const suffix = String(index).padStart(2, "0");
        await insertRecording({
            id: `rec-${suffix}`,
            filename: `Batch ${suffix}`,
            startTime: sharedStartTime,
        });
    }
    await insertRecording({
        id: "rec-yesterday",
        filename: "Yesterday note",
        startTime: localDaysAgo(1),
    });
    await insertRecording({
        id: "rec-last7-edge",
        filename: "Seven day edge",
        startTime: localDaysAgo(7),
    });
    await insertRecording({
        id: "rec-last7-middle",
        filename: "Two day note",
        startTime: localDaysAgo(2),
    });
    await insertRecording({
        id: "rec-earlier",
        filename: "A much earlier note",
        startTime: localDaysAgo(8),
    });
    await insertRecording({
        id: "rec-trashed",
        filename: "Trashed note",
        startTime: sharedStartTime,
        trashed: true,
    });
    await insertRecording({
        id: "rec-other-user",
        filename: "Another tenant note",
        startTime: sharedStartTime,
        ownerId: "other-user",
    });

    await insertTag({ id: "tag-alpha", name: "Alpha" });
    await insertTag({ id: "tag-beta", name: "Beta" });
    await insertTag({
        id: "tag-other-user",
        name: "Private tenant tag",
        ownerId: "other-user",
    });
    await assignTag("rec-00", "tag-alpha");
    await assignTag("rec-01", "tag-alpha");
    await assignTag("rec-01", "tag-beta");
    await assignTag("rec-02", "tag-beta");
    await assignTag("rec-trashed", "tag-alpha");
    await assignTag("rec-other-user", "tag-other-user", "other-user");

    await transcriptsDb.insert(transcriptions).values({
        id: "transcription-rec-00",
        recordingId: "rec-00",
        userId,
        text: "Launch discussion",
        detectedLanguage: "en",
        provider: "local",
        model: "fixture-model",
        speakerMap: { SPEAKER_00: "Alice" },
    });
    await transcriptsDb.insert(transcriptions).values({
        id: "transcription-other-user",
        recordingId: "rec-other-user",
        userId: "other-user",
        text: "Private tenant transcript",
        detectedLanguage: "en",
        provider: "local",
        model: "fixture-model",
        speakerMap: { SPEAKER_00: "Alice" },
    });
}

describe("recording query route with real isolated SQLite", () => {
    beforeAll(async () => {
        coreClient = createClient({ url: databaseUrl(coreDatabasePath) });
        libraryClient = createClient({ url: databaseUrl(libraryDatabasePath) });
        transcriptsClient = createClient({
            url: databaseUrl(transcriptsDatabasePath),
        });
        await Promise.all([
            applyBaseline(coreClient, "core"),
            applyBaseline(libraryClient, "library"),
            applyBaseline(transcriptsClient, "transcripts"),
        ]);
        libraryDb = drizzle(libraryClient, { schema: librarySchema });
        transcriptsDb = drizzle(transcriptsClient, {
            schema: transcriptsSchema,
        });
        await libraryClient.execute("PRAGMA journal_mode = DELETE");

        const databaseModule = await import("@/db");
        runtimeLibraryDb = databaseModule.libraryDb;
        runtimeLibraryClient = runtimeLibraryDb.$client;
        runLibraryReadSnapshot = databaseModule.runLibraryReadSnapshot;
        withLibraryReadSnapshotAtUrl =
            databaseModule.withLibraryReadSnapshotAtUrl;
        runtimeOtherClients = [
            databaseModule.coreDb.$client,
            databaseModule.transcriptsDb.$client,
            databaseModule.searchDb.$client,
            databaseModule.voiceprintsDb.$client,
        ];
        ({ auth } = await import("@/lib/auth"));
        ({ GET: GETQuery } = await import("@/app/api/recordings/query/route"));
        authenticatedHeaders = await createAuthenticatedHeaders();
    });

    beforeEach(async () => {
        await seedFixture();
    });

    afterEach(async () => {
        await transcriptsDb.delete(transcriptions);
        await libraryDb.delete(recordingTagAssignments);
        await libraryDb.delete(recordingTags);
        await libraryDb.delete(recordings);
    });

    afterAll(async () => {
        runtimeLibraryClient.close();
        for (const client of runtimeOtherClients) {
            client.close();
        }
        await Promise.all([
            coreClient.close(),
            libraryClient.close(),
            transcriptsClient.close(),
        ]);
        rmSync(testRoot, { recursive: true });
    });

    it("keeps 23 equal timestamps stable across pages and supports all sort modes", async () => {
        const firstPage = await query(
            "/api/recordings/query?page=1&pageSize=10&sort=newest",
        );
        const secondPage = await query(
            "/api/recordings/query?page=2&pageSize=10&sort=newest",
        );
        const thirdPage = await query(
            "/api/recordings/query?page=3&pageSize=10&sort=newest",
        );
        const pagedIds = [firstPage, secondPage, thirdPage].flatMap((payload) =>
            payload.recordings.map((recording) => recording.id),
        );

        expect(firstPage.pagination).toEqual({
            page: 1,
            pageSize: 10,
            total: 27,
        });
        expect(new Set(pagedIds).size).toBe(27);
        expect(pagedIds).not.toContain("rec-trashed");
        expect(pagedIds).not.toContain("rec-other-user");
        expect(firstPage.recordings.slice(0, 3).map((row) => row.id)).toEqual([
            "rec-00",
            "rec-01",
            "rec-02",
        ]);

        const oldest = await query(
            "/api/recordings/query?pageSize=50&sort=oldest",
        );
        expect(oldest.recordings[0]?.id).toBe("rec-earlier");
        expect(oldest.recordings.slice(-23).map((row) => row.id)).toEqual(
            Array.from(
                { length: 23 },
                (_, index) => `rec-${String(index).padStart(2, "0")}`,
            ),
        );

        await insertRecording({
            id: "name-case-a",
            filename: "alpha",
            startTime: localDaysAgo(5),
        });
        await insertRecording({
            id: "name-case-b",
            filename: "Alpha",
            startTime: localDaysAgo(5),
        });
        await insertRecording({
            id: "name-num-10",
            filename: "Item 10",
            startTime: localDaysAgo(5),
        });
        await insertRecording({
            id: "name-num-2",
            filename: "Item 2",
            startTime: localDaysAgo(5),
        });

        const byName = await query(
            "/api/recordings/query?pageSize=50&sort=name",
        );
        expect(
            byName.recordings
                .filter((recording) => recording.id.startsWith("name-"))
                .map((recording) => recording.id),
        ).toEqual(["name-case-a", "name-case-b", "name-num-10", "name-num-2"]);
    });

    it("returns global timeline and multi-tag facets with self-filter semantics", async () => {
        const all = await query("/api/recordings/query?pageSize=10");
        expect(all.facets).toEqual({
            timeline: {
                all: 27,
                today: 23,
                yesterday: 1,
                last7: 2,
                earlier: 1,
            },
            tags: {
                all: 27,
                untagged: 24,
                items: [
                    {
                        id: "tag-alpha",
                        name: "Alpha",
                        color: "blue",
                        icon: "flag",
                        count: 2,
                    },
                    {
                        id: "tag-beta",
                        name: "Beta",
                        color: "green",
                        icon: "book",
                        count: 2,
                    },
                ],
            },
        });

        const selectedTag = await query(
            "/api/recordings/query?tagId=tag-alpha&pageSize=10",
        );
        expect(selectedTag.pagination.total).toBe(2);
        expect(selectedTag.facets.timeline.all).toBe(2);
        expect(selectedTag.facets.tags).toEqual(all.facets.tags);

        const favoriteTags = await query(
            "/api/recordings/query?favorite=tags&pageSize=10",
        );
        expect(favoriteTags.pagination.total).toBe(3);
        expect(favoriteTags.facets.tags).toEqual(all.facets.tags);
        const impossibleUntaggedFavorite = await query(
            "/api/recordings/query?favorite=tags&untagged=1&pageSize=10",
        );
        expect(impossibleUntaggedFavorite.pagination.total).toBe(0);
        expect(impossibleUntaggedFavorite.facets.tags).toEqual(all.facets.tags);

        const selectedTimeline = await query(
            "/api/recordings/query?timeline=last7&pageSize=10",
        );
        expect(selectedTimeline.pagination.total).toBe(2);
        expect(selectedTimeline.facets.timeline).toEqual(all.facets.timeline);
        expect(selectedTimeline.facets.tags).toEqual({
            all: 2,
            untagged: 2,
            items: [],
        });
    });

    it("applies query, transcript, speaker, tenant, and trashed boundaries to totals and facets", async () => {
        const matchingNames = await query(
            "/api/recordings/query?query=Batch&pageSize=50",
        );
        expect(matchingNames.pagination.total).toBe(23);
        expect(matchingNames.facets.timeline).toMatchObject({
            all: 23,
            today: 23,
        });
        expect(matchingNames.facets.tags).toMatchObject({
            all: 23,
            untagged: 20,
        });

        const source = await query(
            "/api/recordings/query?source=plaud&pageSize=10",
        );
        expect(source.pagination.total).toBe(3);
        expect(source.facets.timeline.today).toBe(3);
        expect(source.facets.tags).toMatchObject({ all: 3, untagged: 2 });

        const fromToday = await query(
            `/api/recordings/query?from=${localDateParam(startOfToday())}&pageSize=50`,
        );
        expect(fromToday.pagination.total).toBe(23);

        const throughYesterday = await query(
            `/api/recordings/query?to=${localDateParam(localDaysAgo(1))}&pageSize=50`,
        );
        expect(throughYesterday.pagination.total).toBe(4);

        const transcribed = await query(
            "/api/recordings/query?favorite=transcribed&pageSize=10",
        );
        expect(transcribed.pagination.total).toBe(1);
        expect(transcribed.recordings[0]?.id).toBe("rec-00");

        const speaker = await query(
            "/api/recordings/query?speaker=Alice&pageSize=10",
        );
        expect(speaker.pagination.total).toBe(1);
        expect(speaker.recordings[0]?.id).toBe("rec-00");
    });

    it("uses one JSON bind beyond SQLite's variable limit", async () => {
        await transcriptsClient.execute({
            sql: `WITH RECURSIVE sequence(value) AS (
                    SELECT 0
                    UNION ALL
                    SELECT value + 1 FROM sequence WHERE value < 1099
                )
                INSERT INTO transcriptions (
                    id, recording_id, user_id, text, provider, model
                )
                SELECT
                    'bulk-' || value,
                    'rec-00',
                    ?,
                    'Bulk transcript candidate',
                    'local',
                    'fixture-model'
                FROM sequence`,
            args: [userId],
        });
        const response = await query(
            "/api/recordings/query?favorite=transcribed&pageSize=10",
        );
        expect(response.pagination.total).toBe(1);
        expect(response.recordings.map((recording) => recording.id)).toEqual([
            "rec-00",
        ]);
    });

    it("rejects ambiguous library locations before creating a client", async () => {
        const clientFactory = vi.fn((databasePath: string) =>
            createClient({ url: databaseUrl(databasePath) }),
        );
        const invalidLocations = [
            null,
            "relative-library.db",
            "file:relative-library.db",
            "https://database.example.test/library.db",
            `${databaseUrl(libraryDatabasePath)}?mode=ro`,
            databaseUrl(path.join(testRoot, "missing-library.db")),
            databaseUrl(testRoot),
        ];

        for (const location of invalidLocations) {
            await expect(
                withLibraryReadSnapshotAtUrl(
                    location,
                    async () => undefined,
                    clientFactory,
                ),
            ).rejects.toBeInstanceOf(Error);
        }
        expect(clientFactory).not.toHaveBeenCalled();
    });

    it("pins the private sqlite wrapper compatibility seam", () => {
        const packageJson = JSON.parse(
            readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
        ) as { dependencies?: Record<string, unknown> };

        expect(packageJson.dependencies?.["@libsql/client"]).toBe("0.17.3");
        expect(packageJson.dependencies?.libsql).toBe("0.5.29");
        expect(Sqlite3Client.length).toBe(4);
        expect(NativeDatabase.length).toBe(2);
    });

    it("runs one owned read lifecycle in order and closes its client", async () => {
        const client = createClient({ url: databaseUrl(libraryDatabasePath) });
        const events: string[] = [];
        const execute = client.execute.bind(client);
        const close = client.close.bind(client);
        vi.spyOn(client, "execute").mockImplementation(async (statement) => {
            events.push(statementText(statement));
            return execute(statement);
        });
        vi.spyOn(client, "close").mockImplementation(() => {
            events.push("CLOSE");
            close();
        });

        const total = await runLibraryReadSnapshot(
            client,
            100,
            async (database) => {
                events.push("CALLBACK");
                const [row] = await database
                    .select({ total: count() })
                    .from(recordings);
                return Number(row?.total ?? 0);
            },
        );

        expect(total).toBe(29);
        const lifecycle = events.filter(
            (event) =>
                event.startsWith("PRAGMA") ||
                event.startsWith("BEGIN") ||
                event.startsWith("SELECT 1") ||
                event === "CALLBACK" ||
                event === "COMMIT" ||
                event === "CLOSE",
        );
        expect(lifecycle).toEqual([
            "PRAGMA busy_timeout = 100",
            "PRAGMA query_only = ON",
            "BEGIN DEFERRED",
            "SELECT 1 FROM recordings LIMIT 1",
            "CALLBACK",
            "COMMIT",
            "CLOSE",
        ]);
    });

    it("preserves primary, rollback, and close failures in order", async () => {
        const client = createClient({ url: databaseUrl(libraryDatabasePath) });
        const primary = new Error("callback failed");
        const rollback = new Error("rollback failed");
        const closeFailure = new Error("close failed");
        const execute = client.execute.bind(client);
        const close = client.close.bind(client);
        vi.spyOn(client, "execute").mockImplementation(async (statement) => {
            const sqlText = statementText(statement);
            if (sqlText === "ROLLBACK") {
                await execute(statement);
                throw rollback;
            }
            return execute(statement);
        });
        vi.spyOn(client, "close").mockImplementation(() => {
            close();
            throw closeFailure;
        });

        const failure = await runLibraryReadSnapshot(client, 100, async () => {
            throw primary;
        }).catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(AggregateError);
        expect(flattenedErrors(failure)).toEqual([
            primary,
            rollback,
            closeFailure,
        ]);
    });

    it.each([
        ["setup", "PRAGMA query_only = ON"],
        ["anchor", "SELECT 1 FROM recordings LIMIT 1"],
        ["commit", "COMMIT"],
    ])("closes after a %s failure and rolls back only an open transaction", async (_, failingSql) => {
        const client = createClient({ url: databaseUrl(libraryDatabasePath) });
        const failure = new Error(`${failingSql} failed`);
        const events: string[] = [];
        const execute = client.execute.bind(client);
        const close = client.close.bind(client);
        vi.spyOn(client, "execute").mockImplementation(async (statement) => {
            const sqlText = statementText(statement);
            events.push(sqlText);
            if (sqlText === failingSql) {
                throw failure;
            }
            return execute(statement);
        });
        vi.spyOn(client, "close").mockImplementation(() => {
            events.push("CLOSE");
            close();
        });

        await expect(
            runLibraryReadSnapshot(client, 100, async () => "done"),
        ).rejects.toBe(failure);
        expect(events.at(-1)).toBe("CLOSE");
        expect(events.includes("ROLLBACK")).toBe(
            failingSql !== "PRAGMA query_only = ON",
        );
    });

    it("exposes only select at compile time and blocks DML and DDL at runtime", async () => {
        const client = createClient({ url: databaseUrl(libraryDatabasePath) });
        expectTypeOf<LibraryReadDb>().toHaveProperty("select");
        expectTypeOf<LibraryReadDb>().not.toHaveProperty("insert");
        expectTypeOf<LibraryReadDb>().not.toHaveProperty("update");
        expectTypeOf<LibraryReadDb>().not.toHaveProperty("delete");

        await runLibraryReadSnapshot(client, 100, async (database) => {
            await expect(
                client.execute("DELETE FROM recordings"),
            ).rejects.toThrow();
            await expect(
                client.execute("CREATE TABLE forbidden_read_write (id TEXT)"),
            ).rejects.toThrow();
            const [row] = await database
                .select({ total: count() })
                .from(recordings);
            expect(Number(row?.total)).toBe(29);
        });
    });

    it("waits through a short lock, bounds open-time blocking, and retries cleanly", async () => {
        const shortLock = await holdLibraryWriteLock(60);
        const waited = await query("/api/recordings/query?pageSize=10");
        expect(waited.pagination.total).toBe(27);
        await shortLock.exited;

        const rawClose = vi.spyOn(NativeDatabase.prototype, "close");
        const clientClose = vi.spyOn(Sqlite3Client.prototype, "close");
        const rawCloseBefore = rawClose.mock.calls.length;
        const clientCloseBefore = clientClose.mock.calls.length;
        try {
            const longLock = await holdLibraryWriteLock(2_500);
            const startedAt = performance.now();
            try {
                const failed = await GETQuery(request("/api/recordings/query"));
                const elapsedMs = performance.now() - startedAt;
                expect(failed.status).toBe(500);
                expect(failed.headers.get("Cache-Control")).toBe(
                    "private, no-store",
                );
                const payload = await failed.json();
                expect(payload).toEqual({
                    error: "Failed to query recordings",
                });
                const publicFailure = JSON.stringify(payload);
                expect(publicFailure).not.toContain("SQLITE");
                expect(publicFailure).not.toContain(libraryDatabasePath);
                expect(elapsedMs).toBeGreaterThanOrEqual(200);
                expect(elapsedMs).toBeLessThan(1_500);
                expect(rawClose.mock.calls.length).toBe(rawCloseBefore + 1);
                expect(clientClose.mock.calls.length).toBe(
                    clientCloseBefore + 1,
                );
            } finally {
                await longLock.exited;
            }

            const recovered = await query("/api/recordings/query?pageSize=10");
            expect(recovered.pagination.total).toBe(27);
            expect(clientClose.mock.calls.length).toBe(clientCloseBefore + 2);
            expect(rawClose.mock.calls.length).toBe(rawCloseBefore + 2);
        } finally {
            rawClose.mockRestore();
            clientClose.mockRestore();
        }
    });

    it("keeps repeated reads on one WAL snapshot while a writer commits", async () => {
        await libraryClient.execute("PRAGMA journal_mode = WAL");
        const client = createClient({ url: databaseUrl(libraryDatabasePath) });

        const totals = await runLibraryReadSnapshot(
            client,
            100,
            async (database) => {
                const [before] = await database
                    .select({ total: count() })
                    .from(recordings);
                await insertRecording({
                    id: "rec-concurrent-writer",
                    filename: "Concurrent writer",
                    startTime: localDaysAgo(3),
                });
                const [after] = await database
                    .select({ total: count() })
                    .from(recordings);
                return [Number(before?.total), Number(after?.total)];
            },
        );

        expect(totals).toEqual([29, 29]);
        const committed = await libraryClient.execute(
            "SELECT count(*) AS total FROM recordings",
        );
        expect(Number(committed.rows[0]?.total)).toBe(30);
    });

    it("allows concurrent requests to keep independent owned snapshots", async () => {
        const ownedClients: Client[] = [];
        const clientFactory = (databasePath: string) => {
            const client = createClient({ url: databaseUrl(databasePath) });
            ownedClients.push(client);
            return client;
        };
        let releaseReads: () => void = () => undefined;
        const readsReleased = new Promise<void>((resolve) => {
            releaseReads = resolve;
        });
        let markFirstAnchored: () => void = () => undefined;
        const firstAnchored = new Promise<void>((resolve) => {
            markFirstAnchored = resolve;
        });
        let markSecondAnchored: () => void = () => undefined;
        const secondAnchored = new Promise<void>((resolve) => {
            markSecondAnchored = resolve;
        });
        const snapshotRead = (markAnchored: () => void) =>
            withLibraryReadSnapshotAtUrl(
                databaseUrl(libraryDatabasePath),
                async (database) => {
                    const [before] = await database
                        .select({ total: count() })
                        .from(recordings);
                    markAnchored();
                    await readsReleased;
                    const [after] = await database
                        .select({ total: count() })
                        .from(recordings);
                    return [Number(before?.total), Number(after?.total)];
                },
                clientFactory,
            );

        const firstRead = snapshotRead(markFirstAnchored);
        await firstAnchored;
        await insertRecording({
            id: "rec-between-snapshots",
            filename: "Between snapshots",
            startTime: localDaysAgo(4),
        });
        const secondRead = snapshotRead(markSecondAnchored);
        await secondAnchored;
        await insertRecording({
            id: "rec-after-snapshots",
            filename: "After snapshots",
            startTime: localDaysAgo(4),
        });
        releaseReads();

        await expect(Promise.all([firstRead, secondRead])).resolves.toEqual([
            [29, 29],
            [30, 30],
        ]);
        const committed = await libraryClient.execute(
            "SELECT count(*) AS total FROM recordings",
        );
        expect(Number(committed.rows[0]?.total)).toBe(31);
        expect(ownedClients).toHaveLength(2);
        expect(ownedClients.every((client) => client.closed)).toBe(true);
    });

    it("uses the tenant/start-time index for the bounded list scan", async () => {
        const plan = await libraryClient.execute({
            sql: `EXPLAIN QUERY PLAN
                SELECT id FROM recordings
                WHERE user_id = ? AND upstream_trashed = 0
                ORDER BY start_time DESC, id ASC
                LIMIT 10`,
            args: [userId],
        });
        const details = plan.rows.map((row) => String(row.detail)).join("\n");

        expect(details).toContain("recordings_user_id_start_time_idx");
        expect(details).not.toContain("SCAN recordings");

        const tagFacetPlan = await libraryClient.execute({
            sql: `EXPLAIN QUERY PLAN
                SELECT count(DISTINCT recordings.id)
                FROM recordings
                LEFT JOIN recording_tag_assignments
                  ON recording_tag_assignments.user_id = ?
                 AND recording_tag_assignments.recording_id = recordings.id
                WHERE recordings.user_id = ?
                  AND recordings.upstream_trashed = 0`,
            args: [userId, userId],
        });
        const tagFacetDetails = tagFacetPlan.rows
            .map((row) => String(row.detail))
            .join("\n");
        expect(tagFacetDetails).toContain("recordings_user_id_start_time_idx");
        expect(tagFacetDetails).toContain(
            "recording_tag_assignments_recording_idx",
        );
    });

    it("rejects unauthenticated and malformed requests without cacheable responses", async () => {
        const unauthorized = await GETQuery(
            request("/api/recordings/query", false),
        );
        expect(unauthorized.status).toBe(401);
        expect(unauthorized.headers.get("Cache-Control")).toBe(
            "private, no-store",
        );

        const malformedPaths = [
            "/api/recordings/query?sort=updated",
            "/api/recordings/query?timeline=week",
            "/api/recordings/query?page=0",
            "/api/recordings/query?pageSize=201",
            "/api/recordings/query?from=2026-02-30",
            "/api/recordings/query?from=2026-08-14&to=2026-08-13",
            "/api/recordings/query?includeTranscript=yes",
            "/api/recordings/query?untagged=yes",
        ];
        for (const pathname of malformedPaths) {
            const response = await GETQuery(request(pathname));
            expect(response.status, pathname).toBe(400);
            expect(response.headers.get("Cache-Control"), pathname).toBe(
                "private, no-store",
            );
        }
    });
});
