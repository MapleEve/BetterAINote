import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Client, createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    librarySchema,
    recordings,
    recordingTagAssignments,
    recordingTags,
} from "@/db/schema/library";

const mockState = vi.hoisted(() => ({
    db: undefined as unknown,
    getSession: vi.fn(),
    enqueueSearchDeleteJob: vi.fn(),
    enqueueSearchIndexJob: vi.fn(),
}));

vi.mock("@/db", () => ({
    get db() {
        return mockState.db;
    },
}));

vi.mock("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: mockState.getSession,
        },
    },
}));

vi.mock("@/server/modules/search/indexer", () => ({
    enqueueSearchDeleteJob: mockState.enqueueSearchDeleteJob,
    enqueueSearchIndexJob: mockState.enqueueSearchIndexJob,
}));

vi.spyOn(console, "error").mockImplementation(() => undefined);

type TestDb = ReturnType<typeof drizzle<typeof librarySchema>>;

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";

let tempDirs: string[] = [];
let testClient: Client | null = null;
let testDb: TestDb;

async function applyLibraryBaseline(client: Client) {
    const migration = readFileSync(
        path.join(
            process.cwd(),
            "src/db/migrations/library/0000_library_baseline.sql",
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

async function createLibraryDatabase() {
    const dir = mkdtempSync(path.join(tmpdir(), "betterainote-tags-"));
    tempDirs.push(dir);
    const client = createClient({
        url: pathToFileURL(path.join(dir, "library.db")).href,
    });
    await applyLibraryBaseline(client);
    testClient = client;
    testDb = drizzle(client, { schema: librarySchema });
    mockState.db = testDb;
}

function makeRequest(method: string, url: string, body?: unknown) {
    return new Request(url, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
}

function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
}

async function loadRoutes() {
    const recordingTagsRoute = await import("@/app/api/recording-tags/route");
    const recordingTagsByIdRoute = await import(
        "@/app/api/recording-tags/[id]/route"
    );
    const recordingTagAssignmentsRoute = await import(
        "@/app/api/recordings/[id]/tags/route"
    );

    return {
        DELETE_TAG: recordingTagsByIdRoute.DELETE,
        GET_TAGS: recordingTagsRoute.GET,
        POST_TAG: recordingTagsRoute.POST,
        PUT_RECORDING_TAGS: recordingTagAssignmentsRoute.PUT,
    };
}

async function seedRecording(id: string, userId = USER_ID) {
    await testDb.insert(recordings).values({
        id,
        userId,
        sourceProvider: "manual",
        sourceRecordingId: `${userId}-${id}`,
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
    await testDb.insert(recordingTags).values({
        id: params.id,
        userId: params.userId ?? USER_ID,
        name: params.name,
        color: params.color ?? "purple",
        icon: params.icon ?? "grid",
        createdAt: params.createdAt ?? new Date("2026-06-01T11:00:00.000Z"),
        updatedAt: params.createdAt ?? new Date("2026-06-01T11:00:00.000Z"),
    });
}

async function seedAssignment(recordingId: string, tagId: string) {
    await testDb.insert(recordingTagAssignments).values({
        id: `${recordingId}-${tagId}`,
        userId: USER_ID,
        recordingId,
        tagId,
    });
}

async function readAssignments(recordingId: string) {
    return testDb
        .select({
            recordingId: recordingTagAssignments.recordingId,
            tagId: recordingTagAssignments.tagId,
            userId: recordingTagAssignments.userId,
        })
        .from(recordingTagAssignments)
        .where(
            and(
                eq(recordingTagAssignments.userId, USER_ID),
                eq(recordingTagAssignments.recordingId, recordingId),
            ),
        );
}

describe("recording tags API regression", () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        await createLibraryDatabase();
        mockState.getSession.mockResolvedValue({ user: { id: USER_ID } });
    });

    afterEach(async () => {
        testClient?.close();
        testClient = null;
        mockState.db = undefined;
        for (const dir of tempDirs) {
            rmSync(dir, { recursive: true, force: true });
        }
        tempDirs = [];
    });

    it("lists existing recording tags with per-user recording counts from the database", async () => {
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
            userId: OTHER_USER_ID,
            createdAt: new Date("2026-06-01T13:00:00.000Z"),
        });
        await seedAssignment("rec-1", "tag-launch");
        await seedAssignment("rec-2", "tag-launch");

        const { GET_TAGS } = await loadRoutes();
        const response = await GET_TAGS(
            makeRequest("GET", "http://localhost/api/recording-tags"),
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

    it("creates a recording tag through the route and persists the normalized row", async () => {
        const { POST_TAG } = await loadRoutes();
        const response = await POST_TAG(
            makeRequest("POST", "http://localhost/api/recording-tags", {
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

        const persistedRows = await testDb
            .select()
            .from(recordingTags)
            .where(eq(recordingTags.id, json.tag.id));
        expect(persistedRows).toHaveLength(1);
        expect(persistedRows[0]).toMatchObject({
            userId: USER_ID,
            name: "Follow-up",
            color: "orange",
            icon: "star",
        });
        expect(mockState.enqueueSearchIndexJob).toHaveBeenCalledWith({
            userId: USER_ID,
            entityType: "tag",
            entityId: json.tag.id,
        });
    });

    it("updates and clears a recording tag association through the route and persists both states", async () => {
        await seedRecording("rec-1");
        await seedTag({ id: "tag-launch", name: "Launch", color: "blue" });
        await seedTag({ id: "tag-review", name: "Review", color: "red" });
        await seedAssignment("rec-1", "tag-launch");

        const { PUT_RECORDING_TAGS } = await loadRoutes();
        const updateResponse = await PUT_RECORDING_TAGS(
            makeRequest("PUT", "http://localhost/api/recordings/rec-1/tags", {
                tagIds: ["tag-review", "tag-launch", "tag-review", "", 42],
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
                    userId: USER_ID,
                },
                {
                    recordingId: "rec-1",
                    tagId: "tag-launch",
                    userId: USER_ID,
                },
            ]),
        );
        await expect(readAssignments("rec-1")).resolves.toHaveLength(2);

        const clearResponse = await PUT_RECORDING_TAGS(
            makeRequest("PUT", "http://localhost/api/recordings/rec-1/tags", {
                tagIds: [],
            }),
            makeParams("rec-1"),
        );

        expect(clearResponse.status).toBe(200);
        await expect(clearResponse.json()).resolves.toEqual({ tags: [] });
        await expect(readAssignments("rec-1")).resolves.toEqual([]);
        expect(mockState.enqueueSearchIndexJob).toHaveBeenCalledWith({
            userId: USER_ID,
            entityType: "recording",
            entityId: "rec-1",
        });
    });

    it("returns a stable error for a missing recording without writing assignments", async () => {
        await seedTag({ id: "tag-launch", name: "Launch", color: "blue" });

        const { PUT_RECORDING_TAGS } = await loadRoutes();
        const response = await PUT_RECORDING_TAGS(
            makeRequest(
                "PUT",
                "http://localhost/api/recordings/missing-rec/tags",
                { tagIds: ["tag-launch"] },
            ),
            makeParams("missing-rec"),
        );

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "Recording not found",
        });
        await expect(readAssignments("missing-rec")).resolves.toEqual([]);
    });

    it("deletes a recording tag through the route and removes persisted assignments", async () => {
        await seedRecording("rec-1");
        await seedTag({ id: "tag-launch", name: "Launch", color: "blue" });
        await seedAssignment("rec-1", "tag-launch");

        const { DELETE_TAG } = await loadRoutes();
        const response = await DELETE_TAG(
            makeRequest(
                "DELETE",
                "http://localhost/api/recording-tags/tag-launch",
            ),
            makeParams("tag-launch"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            deleted: true,
            id: "tag-launch",
        });

        await expect(
            testDb
                .select()
                .from(recordingTags)
                .where(eq(recordingTags.id, "tag-launch")),
        ).resolves.toEqual([]);
        await expect(readAssignments("rec-1")).resolves.toEqual([]);
        expect(mockState.enqueueSearchDeleteJob).toHaveBeenCalledWith({
            userId: USER_ID,
            entityType: "tag",
            entityId: "tag-launch",
        });
        expect(mockState.enqueueSearchIndexJob).toHaveBeenCalledWith({
            userId: USER_ID,
            entityType: "recording",
            entityId: "rec-1",
        });
    });
});
