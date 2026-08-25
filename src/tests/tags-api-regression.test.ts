import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Client, createClient } from "@libsql/client";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    librarySchema,
    recordings,
    recordingTagAssignments,
    recordingTags,
} from "@/db/schema/library";
import {
    searchIndexJobs,
    searchSchema,
    searchTombstones,
} from "@/db/schema/search";

const APP_URL = "http://127.0.0.1:3214";
const AUTH_SECRET =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const testDir = mkdtempSync(
    path.join(tmpdir(), "betterainote-tags-real-sqlite-"),
);
const coreDatabasePath = path.join(testDir, "betterainote.db");
const libraryDatabasePath = path.join(testDir, "betterainote-library.db");
const searchDatabasePath = path.join(testDir, "betterainote-search.db");
const transcriptsDatabasePath = path.join(
    testDir,
    "betterainote-transcripts.db",
);

process.env.APP_URL = APP_URL;
process.env.BETTER_AUTH_SECRET = AUTH_SECRET;
process.env.DATABASE_PATH = coreDatabasePath;

type LibraryDb = ReturnType<typeof drizzle<typeof librarySchema>>;
type SearchDb = ReturnType<typeof drizzle<typeof searchSchema>>;
type LibraryWriteTransaction = typeof import("@/db").runLibraryWriteTransaction;
type Auth = typeof import("@/lib/auth").auth;
type Routes = {
    DELETE_TAG: typeof import("@/app/api/recording-tags/[id]/route").DELETE;
    GET_RECORDING: typeof import("@/app/api/recordings/[id]/route").GET;
    GET_TAGS: typeof import("@/app/api/recording-tags/route").GET;
    PATCH_TAG: typeof import("@/app/api/recording-tags/[id]/route").PATCH;
    POST_TAG: typeof import("@/app/api/recording-tags/route").POST;
    PUT_RECORDING_TAGS: typeof import("@/app/api/recordings/[id]/tags/route").PUT;
};

const USER_EMAIL = "tags-api-real-sqlite@example.com";
const USER_PASSWORD = "TagsApiRealSqlitePassword123!";

let auth: Auth;
let authenticatedHeaders: Headers;
let routes: Routes;
let userId: string;
let coreClient: Client;
let libraryClient: Client;
let searchClient: Client;
let transcriptsClient: Client;
let libraryDb: LibraryDb;
let searchDb: SearchDb;
let runLibraryWriteTransaction: LibraryWriteTransaction;

function databaseUrl(filePath: string) {
    return pathToFileURL(filePath).href;
}

async function applyBaseline(
    client: Client,
    shard: "core" | "library" | "search" | "transcripts",
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

function apiRequest(method: string, pathname: string, body?: unknown) {
    const headers = new Headers(authenticatedHeaders);
    headers.set("Content-Type", "application/json");

    return new Request(`${APP_URL}${pathname}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
}

function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
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
                email: USER_EMAIL,
                name: "Tags API real SQLite",
                password: USER_PASSWORD,
            }),
        }),
    );

    if (!response.ok) {
        throw new Error(
            `Real auth sign-up failed with status ${response.status}`,
        );
    }

    const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
    if (!cookie) {
        throw new Error("Real auth sign-up did not issue a session cookie");
    }

    const payload = (await response.json()) as { user?: { id?: unknown } };
    if (typeof payload.user?.id !== "string") {
        throw new Error("Real auth sign-up did not return a user id");
    }

    const headers = new Headers({ Cookie: cookie });
    const session = await auth.api.getSession({ headers });
    if (session?.user.id !== payload.user.id) {
        throw new Error("Real auth session did not resolve the signed-in user");
    }

    userId = payload.user.id;
    return headers;
}

async function seedRecording(id: string, ownerId = userId) {
    await libraryDb.insert(recordings).values({
        id,
        userId: ownerId,
        sourceProvider: "manual",
        sourceRecordingId: `${ownerId}-${id}`,
        sourceMetadata: null,
        providerDeviceId: "manual-device",
        filename: `${id}.m4a`,
        duration: 60_000,
        startTime: new Date("2026-06-01T10:00:00.000Z"),
        endTime: new Date("2026-06-01T10:01:00.000Z"),
        filesize: 1024,
        fileMd5: `${id}-md5`,
        storageType: "local",
        storagePath: `/recordings/${id}.m4a`,
    });
}

async function seedTag(params: {
    id: string;
    name: string;
    userId?: string;
    color?: "purple" | "blue" | "red" | "orange" | "green" | "slate";
    icon?:
        | "grid"
        | "user"
        | "heart"
        | "clock"
        | "tag"
        | "star"
        | "dialog"
        | "flag"
        | "book"
        | "bulb"
        | "file"
        | "mic";
    createdAt?: Date;
}) {
    await libraryDb.insert(recordingTags).values({
        id: params.id,
        userId: params.userId ?? userId,
        name: params.name,
        color: params.color ?? "purple",
        icon: params.icon ?? "grid",
        createdAt: params.createdAt ?? new Date("2026-06-01T11:00:00.000Z"),
        updatedAt: params.createdAt ?? new Date("2026-06-01T11:00:00.000Z"),
    });
}

async function seedAssignment(recordingId: string, tagId: string) {
    await libraryDb.insert(recordingTagAssignments).values({
        id: `${recordingId}-${tagId}`,
        userId,
        recordingId,
        tagId,
    });
}

async function readAssignments(recordingId: string) {
    return libraryDb
        .select({
            recordingId: recordingTagAssignments.recordingId,
            tagId: recordingTagAssignments.tagId,
            userId: recordingTagAssignments.userId,
        })
        .from(recordingTagAssignments)
        .where(
            and(
                eq(recordingTagAssignments.userId, userId),
                eq(recordingTagAssignments.recordingId, recordingId),
            ),
        );
}

async function readSearchJobs() {
    return searchDb
        .select({
            action: searchIndexJobs.action,
            entityId: searchIndexJobs.entityId,
            entityType: searchIndexJobs.entityType,
            status: searchIndexJobs.status,
            userId: searchIndexJobs.userId,
        })
        .from(searchIndexJobs)
        .where(eq(searchIndexJobs.userId, userId));
}

describe("recording tags API regression", () => {
    beforeAll(async () => {
        coreClient = createClient({ url: databaseUrl(coreDatabasePath) });
        libraryClient = createClient({ url: databaseUrl(libraryDatabasePath) });
        searchClient = createClient({ url: databaseUrl(searchDatabasePath) });
        transcriptsClient = createClient({
            url: databaseUrl(transcriptsDatabasePath),
        });

        await Promise.all([
            applyBaseline(coreClient, "core"),
            applyBaseline(libraryClient, "library"),
            applyBaseline(searchClient, "search"),
            applyBaseline(transcriptsClient, "transcripts"),
        ]);

        libraryDb = drizzle(libraryClient, { schema: librarySchema });
        searchDb = drizzle(searchClient, { schema: searchSchema });

        ({ runLibraryWriteTransaction } = await import("@/db"));
        ({ auth } = await import("@/lib/auth"));
        const recordingTagsRoute = await import(
            "@/app/api/recording-tags/route"
        );
        const recordingTagsByIdRoute = await import(
            "@/app/api/recording-tags/[id]/route"
        );
        const recordingTagAssignmentsRoute = await import(
            "@/app/api/recordings/[id]/tags/route"
        );
        const recordingRoute = await import("@/app/api/recordings/[id]/route");
        routes = {
            DELETE_TAG: recordingTagsByIdRoute.DELETE,
            GET_RECORDING: recordingRoute.GET,
            GET_TAGS: recordingTagsRoute.GET,
            PATCH_TAG: recordingTagsByIdRoute.PATCH,
            POST_TAG: recordingTagsRoute.POST,
            PUT_RECORDING_TAGS: recordingTagAssignmentsRoute.PUT,
        };
        authenticatedHeaders = await createAuthenticatedHeaders();
    });

    afterEach(async () => {
        await libraryDb
            .delete(recordingTagAssignments)
            .where(eq(recordingTagAssignments.userId, userId));
        await libraryDb
            .delete(recordingTags)
            .where(eq(recordingTags.userId, userId));
        await libraryDb.delete(recordings).where(eq(recordings.userId, userId));
        await searchDb
            .delete(searchIndexJobs)
            .where(eq(searchIndexJobs.userId, userId));
        await searchDb
            .delete(searchTombstones)
            .where(eq(searchTombstones.userId, userId));
    });

    afterAll(async () => {
        await Promise.all([
            coreClient.close(),
            libraryClient.close(),
            searchClient.close(),
            transcriptsClient.close(),
        ]);
        rmSync(testDir, { recursive: true });
    });

    it("lists existing recording tags with per-user recording counts from real SQLite storage", async () => {
        await seedRecording("rec-1");
        await seedRecording("rec-2");
        await seedTag({
            id: "tag-launch",
            name: "Launch",
            color: "blue",
            icon: "flag",
            createdAt: new Date("2026-06-01T11:00:00.000Z"),
        });
        await seedTag({
            id: "tag-planning",
            name: "Planning",
            color: "green",
            icon: "book",
            createdAt: new Date("2026-06-01T12:00:00.000Z"),
        });
        await seedTag({
            id: "tag-other-user",
            name: "Private",
            userId: "other-user",
            createdAt: new Date("2026-06-01T13:00:00.000Z"),
        });
        await seedAssignment("rec-1", "tag-launch");
        await seedAssignment("rec-2", "tag-launch");

        const response = await routes.GET_TAGS(
            apiRequest("GET", "/api/recording-tags"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            tags: [
                {
                    id: "tag-planning",
                    name: "Planning",
                    color: "green",
                    icon: "book",
                    recordingCount: 0,
                },
                {
                    id: "tag-launch",
                    name: "Launch",
                    color: "blue",
                    icon: "flag",
                    recordingCount: 2,
                },
            ],
        });
    });

    it("creates a recording tag through real auth and persists its search refresh", async () => {
        const response = await routes.POST_TAG(
            apiRequest("POST", "/api/recording-tags", {
                name: "  Follow-up  ",
                color: "orange",
                icon: "star",
            }),
        );

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.tag).toMatchObject({
            name: "Follow-up",
            color: "orange",
            icon: "star",
        });

        await expect(
            libraryDb
                .select()
                .from(recordingTags)
                .where(eq(recordingTags.id, json.tag.id)),
        ).resolves.toEqual([
            expect.objectContaining({
                userId,
                name: "Follow-up",
                color: "orange",
                icon: "star",
            }),
        ]);
        await expect(readSearchJobs()).resolves.toEqual([
            expect.objectContaining({
                userId,
                entityType: "tag",
                entityId: json.tag.id,
                action: "upsert",
                status: "pending",
            }),
        ]);
    });

    it("returns a conflict for a duplicate recording tag name", async () => {
        await seedTag({ id: "tag-existing", name: "Existing" });

        const response = await routes.POST_TAG(
            apiRequest("POST", "/api/recording-tags", { name: "Existing" }),
        );

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "Tag name already exists",
        });
    });

    it("updates and clears a recording tag association through real storage", async () => {
        await seedRecording("rec-1");
        await seedTag({ id: "tag-launch", name: "Launch", color: "blue" });
        await seedTag({ id: "tag-review", name: "Review", color: "red" });
        await seedAssignment("rec-1", "tag-launch");

        const updateResponse = await routes.PUT_RECORDING_TAGS(
            apiRequest("PUT", "/api/recordings/rec-1/tags", {
                tagIds: ["tag-review", "tag-launch", "tag-review"],
            }),
            makeParams("rec-1"),
        );

        expect(updateResponse.status).toBe(200);
        await expect(updateResponse.json()).resolves.toEqual({
            tags: [
                {
                    id: "tag-review",
                    name: "Review",
                    color: "red",
                    icon: "grid",
                },
                {
                    id: "tag-launch",
                    name: "Launch",
                    color: "blue",
                    icon: "grid",
                },
            ],
        });
        await expect(readAssignments("rec-1")).resolves.toEqual(
            expect.arrayContaining([
                {
                    recordingId: "rec-1",
                    tagId: "tag-review",
                    userId,
                },
                {
                    recordingId: "rec-1",
                    tagId: "tag-launch",
                    userId,
                },
            ]),
        );
        const recordingReadbackResponse = await routes.GET_RECORDING(
            apiRequest("GET", "/api/recordings/rec-1"),
            makeParams("rec-1"),
        );
        expect(recordingReadbackResponse.status).toBe(200);
        const recordingReadback = (await recordingReadbackResponse.json()) as {
            recording?: {
                id?: unknown;
                userId?: unknown;
                tags?: Array<{ id?: unknown; name?: unknown }>;
            };
        };
        expect(recordingReadback.recording?.id).toBe("rec-1");
        expect(recordingReadback.recording?.userId).toBe(userId);
        expect(recordingReadback.recording?.tags).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: "tag-review", name: "Review" }),
                expect.objectContaining({ id: "tag-launch", name: "Launch" }),
            ]),
        );
        await expect(readSearchJobs()).resolves.toEqual([
            expect.objectContaining({
                userId,
                entityType: "recording",
                entityId: "rec-1",
                action: "upsert",
                status: "pending",
            }),
        ]);

        const clearResponse = await routes.PUT_RECORDING_TAGS(
            apiRequest("PUT", "/api/recordings/rec-1/tags", { tagIds: [] }),
            makeParams("rec-1"),
        );

        expect(clearResponse.status).toBe(200);
        await expect(clearResponse.json()).resolves.toEqual({ tags: [] });
        await expect(readAssignments("rec-1")).resolves.toEqual([]);
        await expect(readSearchJobs()).resolves.toHaveLength(2);
    });

    it("maps invalid or foreign tag ids without changing assignments", async () => {
        await seedRecording("rec-1");
        await seedTag({ id: "tag-owned", name: "Owned" });
        await seedTag({
            id: "tag-foreign",
            name: "Foreign",
            userId: "other-user",
        });
        await seedAssignment("rec-1", "tag-owned");

        const malformedResponse = await routes.PUT_RECORDING_TAGS(
            apiRequest("PUT", "/api/recordings/rec-1/tags", {
                tagIds: ["tag-owned", "", 42],
            }),
            makeParams("rec-1"),
        );
        expect(malformedResponse.status).toBe(400);
        await expect(malformedResponse.json()).resolves.toEqual({
            error: "tagIds must contain non-empty string values",
        });

        const nonArrayResponse = await routes.PUT_RECORDING_TAGS(
            apiRequest("PUT", "/api/recordings/rec-1/tags", {
                tagIds: "tag-owned",
            }),
            makeParams("rec-1"),
        );
        expect(nonArrayResponse.status).toBe(400);
        await expect(nonArrayResponse.json()).resolves.toEqual({
            error: "tagIds must be an array",
        });

        const foreignTagResponse = await routes.PUT_RECORDING_TAGS(
            apiRequest("PUT", "/api/recordings/rec-1/tags", {
                tagIds: ["tag-foreign"],
            }),
            makeParams("rec-1"),
        );
        expect(foreignTagResponse.status).toBe(404);
        await expect(foreignTagResponse.json()).resolves.toEqual({
            error: "Tag not found",
        });

        await expect(readAssignments("rec-1")).resolves.toEqual([
            {
                recordingId: "rec-1",
                tagId: "tag-owned",
                userId,
            },
        ]);
    });

    it("commits recording tag writes atomically and closes their owned client", async () => {
        await seedRecording("rec-1");
        await seedTag({ id: "tag-owned", name: "Owned" });

        const committedClient = createClient({
            url: databaseUrl(libraryDatabasePath),
        });
        await runLibraryWriteTransaction(
            committedClient,
            async (transaction) => {
                await transaction.insert(recordingTagAssignments).values({
                    id: "committed-assignment",
                    userId,
                    recordingId: "rec-1",
                    tagId: "tag-owned",
                });
            },
        );
        await expect(committedClient.execute("SELECT 1")).rejects.toMatchObject(
            {
                code: "CLIENT_CLOSED",
            },
        );
        await expect(readAssignments("rec-1")).resolves.toEqual([
            {
                recordingId: "rec-1",
                tagId: "tag-owned",
                userId,
            },
        ]);

        const rolledBackClient = createClient({
            url: databaseUrl(libraryDatabasePath),
        });
        await expect(
            runLibraryWriteTransaction(
                rolledBackClient,
                async (transaction) => {
                    await transaction.run(
                        sql.raw(
                            "INSERT INTO recording_tag_assignments (id, user_id, recording_id, tag_id, created_at) VALUES ('rolled-back-assignment', 'missing-user', 'rec-1', 'tag-owned', 0)",
                        ),
                    );
                    throw new Error("force recording tag assignment rollback");
                },
            ),
        ).rejects.toThrow("force recording tag assignment rollback");
        await expect(
            rolledBackClient.execute("SELECT 1"),
        ).rejects.toMatchObject({
            code: "CLIENT_CLOSED",
        });
        await expect(readAssignments("rec-1")).resolves.toEqual([
            {
                recordingId: "rec-1",
                tagId: "tag-owned",
                userId,
            },
        ]);
    });

    it("renames a recording tag and persists refresh jobs for the tag and its recordings", async () => {
        await seedRecording("rec-1");
        await seedRecording("rec-2");
        await seedTag({
            id: "tag-launch",
            name: "Launch",
            color: "blue",
            icon: "flag",
        });
        await seedAssignment("rec-1", "tag-launch");
        await seedAssignment("rec-2", "tag-launch");

        const response = await routes.PATCH_TAG(
            apiRequest("PATCH", "/api/recording-tags/tag-launch", {
                name: "  Follow-up  ",
                color: "orange",
                icon: "star",
            }),
            makeParams("tag-launch"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            tag: {
                id: "tag-launch",
                name: "Follow-up",
                color: "orange",
                icon: "star",
                recordingCount: 2,
            },
        });
        await expect(
            libraryDb
                .select()
                .from(recordingTags)
                .where(eq(recordingTags.id, "tag-launch")),
        ).resolves.toEqual([
            expect.objectContaining({
                color: "orange",
                icon: "star",
                name: "Follow-up",
            }),
        ]);
        await expect(readSearchJobs()).resolves.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    userId,
                    entityType: "tag",
                    entityId: "tag-launch",
                    action: "upsert",
                    status: "pending",
                }),
                expect.objectContaining({
                    userId,
                    entityType: "recording",
                    entityId: "rec-1",
                    action: "upsert",
                    status: "pending",
                }),
                expect.objectContaining({
                    userId,
                    entityType: "recording",
                    entityId: "rec-2",
                    action: "upsert",
                    status: "pending",
                }),
            ]),
        );
        await expect(readSearchJobs()).resolves.toHaveLength(3);
    });

    it("returns a stable error for a missing recording without writing assignments", async () => {
        await seedTag({ id: "tag-launch", name: "Launch", color: "blue" });

        const response = await routes.PUT_RECORDING_TAGS(
            apiRequest("PUT", "/api/recordings/missing-rec/tags", {
                tagIds: ["tag-launch"],
            }),
            makeParams("missing-rec"),
        );

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "Recording not found",
        });
        await expect(readAssignments("missing-rec")).resolves.toEqual([]);
        await expect(readSearchJobs()).resolves.toEqual([]);
    });

    it("deletes a recording tag, cleans relations, and persists delete and refresh jobs", async () => {
        await seedRecording("rec-1");
        await seedTag({ id: "tag-launch", name: "Launch", color: "blue" });
        await seedAssignment("rec-1", "tag-launch");

        const response = await routes.DELETE_TAG(
            apiRequest("DELETE", "/api/recording-tags/tag-launch"),
            makeParams("tag-launch"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            deleted: true,
            id: "tag-launch",
        });
        await expect(
            libraryDb
                .select()
                .from(recordingTags)
                .where(eq(recordingTags.id, "tag-launch")),
        ).resolves.toEqual([]);
        await expect(readAssignments("rec-1")).resolves.toEqual([]);
        await expect(
            searchDb
                .select({
                    entityId: searchTombstones.entityId,
                    entityType: searchTombstones.entityType,
                    userId: searchTombstones.userId,
                })
                .from(searchTombstones)
                .where(eq(searchTombstones.userId, userId)),
        ).resolves.toEqual([
            { userId, entityType: "tag", entityId: "tag-launch" },
        ]);
        await expect(readSearchJobs()).resolves.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    userId,
                    entityType: "tag",
                    entityId: "tag-launch",
                    action: "delete",
                    status: "pending",
                }),
                expect.objectContaining({
                    userId,
                    entityType: "recording",
                    entityId: "rec-1",
                    action: "upsert",
                    status: "pending",
                }),
            ]),
        );
        await expect(readSearchJobs()).resolves.toHaveLength(2);
    });
});
