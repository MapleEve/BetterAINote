import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Client, createClient } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    searchIndexJobs,
    searchSchema,
    searchTombstones,
} from "@/db/schema/search";
import {
    speakerProfileRetryAuthorizations,
    speakerProfiles,
    voiceprintsSchema,
} from "@/db/schema/voiceprints";

const APP_URL = "http://127.0.0.1:3213";
const AUTH_SECRET =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const testDir = mkdtempSync(
    path.join(tmpdir(), "betterainote-speaker-profiles-real-sqlite-"),
);
const coreDatabasePath = path.join(testDir, "betterainote.db");
const voiceprintsDatabasePath = path.join(
    testDir,
    "betterainote-voiceprints.db",
);
const searchDatabasePath = path.join(testDir, "betterainote-search.db");

process.env.APP_URL = APP_URL;
process.env.BETTER_AUTH_SECRET = AUTH_SECRET;
process.env.DATABASE_PATH = coreDatabasePath;

type Auth = typeof import("@/lib/auth").auth;
type RetryDescriptor = {
    mutation: "create" | "update" | "delete";
    profileId: string;
};
type Routes = {
    DELETE: typeof import("@/app/api/speakers/profiles/[id]/route").DELETE;
    GET: typeof import("@/app/api/speakers/profiles/route").GET;
    PATCH: typeof import("@/app/api/speakers/profiles/[id]/route").PATCH;
    POST: typeof import("@/app/api/speakers/profiles/route").POST;
    RETRY: typeof import("@/app/api/speakers/profiles/retry/route").POST;
};

type VoiceprintsDb = ReturnType<typeof drizzle<typeof voiceprintsSchema>>;
type SearchDb = ReturnType<typeof drizzle<typeof searchSchema>>;

let auth: Auth;
let routes: Routes;
let coreClient: Client;
let voiceprintsClient: Client;
let searchClient: Client;
let voiceprintsDb: VoiceprintsDb;
let searchDb: SearchDb;
let primaryUser: { headers: Headers; id: string };
let secondaryUser: { headers: Headers; id: string };

function databaseUrl(filePath: string) {
    return pathToFileURL(filePath).href;
}

async function applyMigrations(
    client: Client,
    shard: "core" | "search" | "voiceprints",
) {
    await client.execute("PRAGMA foreign_keys = ON");
    const migrationsDir = path.join(process.cwd(), "src/db/migrations", shard);
    const migrations = readdirSync(migrationsDir)
        .filter((entry) => entry.endsWith(".sql"))
        .sort();

    for (const migrationName of migrations) {
        const statements = readFileSync(
            path.join(migrationsDir, migrationName),
            "utf8",
        )
            .split("--> statement-breakpoint")
            .map((statement) => statement.trim())
            .filter(Boolean);
        for (const statement of statements) {
            await client.execute(statement);
        }
    }
}

function apiRequest(
    headers: Headers,
    method: string,
    pathname: string,
    body?: unknown,
) {
    const requestHeaders = new Headers(headers);
    requestHeaders.set("Content-Type", "application/json");
    return new Request(`${APP_URL}${pathname}`, {
        method,
        headers: requestHeaders,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
}

function params(id: string) {
    return { params: Promise.resolve({ id }) };
}

async function signUp(email: string, name: string) {
    const response = await auth.handler(
        new Request(`${APP_URL}/api/auth/sign-up/email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Origin: APP_URL,
            },
            body: JSON.stringify({
                email,
                name,
                password: "SpeakerProfilesRealSqlitePassword123!",
            }),
        }),
    );
    expect(response.status).toBe(200);

    const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
    const body = (await response.json()) as { user?: { id?: unknown } };
    if (!cookie || typeof body.user?.id !== "string") {
        throw new Error("Real sign-up did not return a session and user id");
    }

    return { headers: new Headers({ Cookie: cookie }), id: body.user.id };
}

async function installSearchIndexFailure() {
    const name = `speaker_profile_search_failure_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
    await searchClient.execute(`
        CREATE TRIGGER ${name}
        BEFORE INSERT ON search_index_jobs
        WHEN NEW.entity_type = 'speaker'
        BEGIN
            SELECT RAISE(ABORT, 'speaker profile test search failure');
        END
    `);
    return async () => searchClient.execute(`DROP TRIGGER IF EXISTS ${name}`);
}

async function installAuthorizationPersistenceFailure() {
    const name = `speaker_profile_authorization_failure_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
    await voiceprintsClient.execute(`
        CREATE TRIGGER ${name}
        BEFORE INSERT ON speaker_profile_retry_authorizations
        BEGIN
            SELECT RAISE(ABORT, 'speaker profile test authorization failure');
        END
    `);
    return async () =>
        voiceprintsClient.execute(`DROP TRIGGER IF EXISTS ${name}`);
}

async function createProfile(name: string) {
    const response = await routes.POST(
        apiRequest(primaryUser.headers, "POST", "/api/speakers/profiles", {
            displayName: name,
        }),
    );
    const body = (await response.json()) as {
        profile?: { id?: string };
    };
    if (response.status !== 200 || typeof body.profile?.id !== "string") {
        throw new Error(
            `Expected profile creation to succeed, got ${response.status}`,
        );
    }
    return body.profile.id;
}

async function retryDescriptor(
    response: Response,
    expectedMutation: RetryDescriptor["mutation"],
) {
    expect(response.status).toBe(503);
    const body = (await response.json()) as {
        code?: unknown;
        retry?: Partial<RetryDescriptor>;
    };
    expect(body.code).toBe(
        "SPEAKER_PROFILE_WRITE_COMMITTED_INDEX_FOLLOWUP_FAILED",
    );
    expect(body.retry).toMatchObject({
        mutation: expectedMutation,
        profileId: expect.any(String),
    });
    return body.retry as RetryDescriptor;
}

describe("speaker profiles routes with real SQLite shards", () => {
    beforeAll(async () => {
        coreClient = createClient({ url: databaseUrl(coreDatabasePath) });
        voiceprintsClient = createClient({
            url: databaseUrl(voiceprintsDatabasePath),
        });
        searchClient = createClient({ url: databaseUrl(searchDatabasePath) });
        await Promise.all([
            applyMigrations(coreClient, "core"),
            applyMigrations(voiceprintsClient, "voiceprints"),
            applyMigrations(searchClient, "search"),
        ]);

        voiceprintsDb = drizzle(voiceprintsClient, {
            schema: voiceprintsSchema,
        });
        searchDb = drizzle(searchClient, { schema: searchSchema });
        ({ auth } = await import("@/lib/auth"));
        const profilesRoute = await import("@/app/api/speakers/profiles/route");
        const profileRoute = await import(
            "@/app/api/speakers/profiles/[id]/route"
        );
        const retryRoute = await import(
            "@/app/api/speakers/profiles/retry/route"
        );
        routes = {
            DELETE: profileRoute.DELETE,
            GET: profilesRoute.GET,
            PATCH: profileRoute.PATCH,
            POST: profilesRoute.POST,
            RETRY: retryRoute.POST,
        };
        primaryUser = await signUp(
            "speaker-profiles-primary@example.com",
            "Speaker Profiles Primary",
        );
        secondaryUser = await signUp(
            "speaker-profiles-secondary@example.com",
            "Speaker Profiles Secondary",
        );
    });

    afterEach(async () => {
        await Promise.all([
            searchDb
                .delete(searchIndexJobs)
                .where(eq(searchIndexJobs.userId, primaryUser.id)),
            searchDb
                .delete(searchTombstones)
                .where(eq(searchTombstones.userId, primaryUser.id)),
            voiceprintsDb
                .delete(speakerProfileRetryAuthorizations)
                .where(
                    eq(
                        speakerProfileRetryAuthorizations.userId,
                        primaryUser.id,
                    ),
                ),
            voiceprintsDb
                .delete(speakerProfiles)
                .where(eq(speakerProfiles.userId, primaryUser.id)),
        ]);
    });

    afterAll(async () => {
        await Promise.all([
            coreClient.close(),
            voiceprintsClient.close(),
            searchClient.close(),
        ]);
        rmSync(testDir, { force: true, recursive: true });
    });

    it("rolls back a primary write when retry authorization persistence fails", async () => {
        const removeFailure = await installAuthorizationPersistenceFailure();
        try {
            const response = await routes.POST(
                apiRequest(
                    primaryUser.headers,
                    "POST",
                    "/api/speakers/profiles",
                    { displayName: "Atomic create" },
                ),
            );
            expect(response.status).toBe(500);
            expect(
                await voiceprintsDb
                    .select({ id: speakerProfiles.id })
                    .from(speakerProfiles)
                    .where(
                        and(
                            eq(speakerProfiles.userId, primaryUser.id),
                            eq(speakerProfiles.displayName, "Atomic create"),
                        ),
                    ),
            ).toEqual([]);
        } finally {
            await removeFailure();
        }
    });

    it("keeps a pending descriptor recoverable, consumes it only after enqueue, and rejects replay or another user", async () => {
        const removeFailure = await installSearchIndexFailure();
        let retry: RetryDescriptor | null = null;
        try {
            retry = await retryDescriptor(
                await routes.POST(
                    apiRequest(
                        primaryUser.headers,
                        "POST",
                        "/api/speakers/profiles",
                        { displayName: "Recoverable create" },
                    ),
                ),
                "create",
            );

            const uncertainRetry = await routes.RETRY(
                apiRequest(
                    primaryUser.headers,
                    "POST",
                    "/api/speakers/profiles/retry",
                    retry,
                ),
            );
            expect(await retryDescriptor(uncertainRetry, "create")).toEqual(
                retry,
            );
        } finally {
            await removeFailure();
        }
        if (!retry) {
            throw new Error("Expected recoverable retry descriptor");
        }

        await expect(
            routes.RETRY(
                apiRequest(
                    secondaryUser.headers,
                    "POST",
                    "/api/speakers/profiles/retry",
                    retry,
                ),
            ),
        ).resolves.toMatchObject({ status: 400 });
        await expect(
            routes.RETRY(
                apiRequest(
                    primaryUser.headers,
                    "POST",
                    "/api/speakers/profiles/retry",
                    { ...retry, profileId: `${retry.profileId}forged` },
                ),
            ),
        ).resolves.toMatchObject({ status: 400 });

        const success = await routes.RETRY(
            apiRequest(
                primaryUser.headers,
                "POST",
                "/api/speakers/profiles/retry",
                retry,
            ),
        );
        expect(success.status).toBe(200);
        await expect(success.json()).resolves.toEqual({ success: true });

        const replay = await routes.RETRY(
            apiRequest(
                primaryUser.headers,
                "POST",
                "/api/speakers/profiles/retry",
                retry,
            ),
        );
        expect(replay.status).toBe(400);
        const authorizations = await voiceprintsDb
            .select({
                consumedAt: speakerProfileRetryAuthorizations.consumedAt,
            })
            .from(speakerProfileRetryAuthorizations)
            .where(
                eq(speakerProfileRetryAuthorizations.userId, primaryUser.id),
            );
        expect(authorizations).toHaveLength(1);
        expect(authorizations[0]?.consumedAt).toBeInstanceOf(Date);
        const jobs = await searchDb
            .select({ idempotencyKey: searchIndexJobs.idempotencyKey })
            .from(searchIndexJobs)
            .where(eq(searchIndexJobs.userId, primaryUser.id));
        expect(jobs).toHaveLength(1);
        expect(jobs[0]?.idempotencyKey).toBeTruthy();
    });

    it("allows only one concurrent retry for the same persisted descriptor", async () => {
        const removeFailure = await installSearchIndexFailure();
        let retry: RetryDescriptor | null = null;
        try {
            retry = await retryDescriptor(
                await routes.POST(
                    apiRequest(
                        primaryUser.headers,
                        "POST",
                        "/api/speakers/profiles",
                        { displayName: "Concurrent retry" },
                    ),
                ),
                "create",
            );
        } finally {
            await removeFailure();
        }
        if (!retry) {
            throw new Error("Expected concurrent retry descriptor");
        }

        const responses = await Promise.all([
            routes.RETRY(
                apiRequest(
                    primaryUser.headers,
                    "POST",
                    "/api/speakers/profiles/retry",
                    retry,
                ),
            ),
            routes.RETRY(
                apiRequest(
                    primaryUser.headers,
                    "POST",
                    "/api/speakers/profiles/retry",
                    retry,
                ),
            ),
        ]);
        const statuses = responses.map((response) => response.status).sort();
        expect(statuses).toEqual([200, 400]);

        const jobs = await searchDb
            .select({ idempotencyKey: searchIndexJobs.idempotencyKey })
            .from(searchIndexJobs)
            .where(eq(searchIndexJobs.userId, primaryUser.id));
        expect(jobs).toHaveLength(1);
        expect(jobs[0]?.idempotencyKey).toBeTruthy();
    });

    it("persists and recovers update and delete follow-ups with real API and SQLite readback", async () => {
        const profileId = await createProfile("Lifecycle profile");

        let removeFailure = await installSearchIndexFailure();
        let updateRetry: RetryDescriptor | null = null;
        try {
            updateRetry = await retryDescriptor(
                await routes.PATCH(
                    apiRequest(
                        primaryUser.headers,
                        "PATCH",
                        `/api/speakers/profiles/${profileId}`,
                        { displayName: "Lifecycle profile updated" },
                    ),
                    params(profileId),
                ),
                "update",
            );
        } finally {
            await removeFailure();
        }
        if (!updateRetry) {
            throw new Error("Expected recoverable update retry descriptor");
        }
        expect(
            await voiceprintsDb
                .select({ displayName: speakerProfiles.displayName })
                .from(speakerProfiles)
                .where(eq(speakerProfiles.id, profileId)),
        ).toEqual([{ displayName: "Lifecycle profile updated" }]);
        expect(
            (
                await routes.RETRY(
                    apiRequest(
                        primaryUser.headers,
                        "POST",
                        "/api/speakers/profiles/retry",
                        updateRetry,
                    ),
                )
            ).status,
        ).toBe(200);

        removeFailure = await installSearchIndexFailure();
        let deleteRetry: RetryDescriptor | null = null;
        try {
            deleteRetry = await retryDescriptor(
                await routes.DELETE(
                    apiRequest(
                        primaryUser.headers,
                        "DELETE",
                        `/api/speakers/profiles/${profileId}`,
                    ),
                    params(profileId),
                ),
                "delete",
            );
        } finally {
            await removeFailure();
        }
        if (!deleteRetry) {
            throw new Error("Expected recoverable delete retry descriptor");
        }
        expect(
            await voiceprintsDb
                .select({ id: speakerProfiles.id })
                .from(speakerProfiles)
                .where(eq(speakerProfiles.id, profileId)),
        ).toEqual([]);
        expect(
            (
                await routes.RETRY(
                    apiRequest(
                        primaryUser.headers,
                        "POST",
                        "/api/speakers/profiles/retry",
                        deleteRetry,
                    ),
                )
            ).status,
        ).toBe(200);
        expect(
            await searchDb
                .select({ action: searchIndexJobs.action })
                .from(searchIndexJobs)
                .where(eq(searchIndexJobs.userId, primaryUser.id)),
        ).toHaveLength(3);
    });

    it("rejects an authorization after its durable expiry", async () => {
        const removeFailure = await installSearchIndexFailure();
        let retry: RetryDescriptor | null = null;
        try {
            retry = await retryDescriptor(
                await routes.POST(
                    apiRequest(
                        primaryUser.headers,
                        "POST",
                        "/api/speakers/profiles",
                        { displayName: "Expired retry" },
                    ),
                ),
                "create",
            );
        } finally {
            await removeFailure();
        }
        if (!retry) {
            throw new Error("Expected expired retry descriptor");
        }
        await voiceprintsDb
            .update(speakerProfileRetryAuthorizations)
            .set({ expiresAt: new Date(Date.now() - 1) })
            .where(
                eq(speakerProfileRetryAuthorizations.userId, primaryUser.id),
            );
        expect(
            (
                await routes.RETRY(
                    apiRequest(
                        primaryUser.headers,
                        "POST",
                        "/api/speakers/profiles/retry",
                        retry,
                    ),
                )
            ).status,
        ).toBe(400);
    });
});
