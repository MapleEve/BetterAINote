import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { makeSignature } from "better-auth/crypto";
import { expect, type Browser, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

type SpeakerProfile = {
    assignmentCount: number;
    createdAt: string;
    displayName: string;
    id: string;
    updatedAt: string;
    voiceprintRef: string | null;
};

type SpeakerProfilesResponse = {
    profiles: SpeakerProfile[];
};

const SPEAKER_PROFILES_ENDPOINT = "/api/speakers/profiles";
const RETRY_ENDPOINT = `${SPEAKER_PROFILES_ENDPOINT}/retry`;
const E2E_ROOT = path.resolve(
    process.env.PLAYWRIGHT_E2E_ROOT ?? path.join(process.cwd(), "tmp/e2e"),
);
const E2E_DATA_DIR = process.env.PLAYWRIGHT_E2E_DATA_DIR
    ? path.resolve(process.env.PLAYWRIGHT_E2E_DATA_DIR)
    : path.join(E2E_ROOT, "data");
const CORE_DB = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(E2E_DATA_DIR, "betterainote-e2e.db");

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.join(
        parsed.dir,
        `${parsed.name}-${suffix}${parsed.ext || ".db"}`,
    );
}

const VOICEPRINTS_DB = deriveSiblingDatabasePath(CORE_DB, "voiceprints");
const SEARCH_DB = deriveSiblingDatabasePath(CORE_DB, "search");
const SPEAKER_SETTINGS_LABEL = /^(Speaker settings|说话人设置)$/;
const SAVED_SPEAKERS_LABEL = /^(Saved speakers|已保存的说话人)$/;
const SPEAKER_NAME_LABEL = /^(Speaker name|说话人名称)$/;
const ADD_SPEAKER_LABEL = /^(Add Speaker|添加说话人)$/;
const RETRY_LABEL = /^(Retry|重试)$/;
const RETRY_SPEAKER_UPDATE_LABEL =
    /^(Retry speaker profile update|重试说话人档案更新)$/;
const SAVE_LABEL = /^(Save|保存)$/;
const DELETE_LABEL = /^(Delete|删除)$/;
const CONFIRM_ACTION_LABEL = /^(Confirm action|确认操作)$/;
const CONFIRM_LABEL = /^(Confirm|确认)$/;
const COMMITTED_FOLLOWUP_ALERT =
    /^(The speaker profile was saved, but it still needs to finish updating\.|说话人档案已保存，但仍需完成更新。)$/;
const INVALID_RETRY_ERROR = "Invalid speaker profile retry operation";

function assertIsolatedDatabase(filePath: string) {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(`${E2E_ROOT}${path.sep}`)) {
        throw new Error(`Refusing non-isolated E2E database: ${resolved}`);
    }
    if (!existsSync(path.join(E2E_ROOT, ".betterainote-e2e-root"))) {
        throw new Error(`Missing isolated E2E marker under ${E2E_ROOT}`);
    }
}

function databaseUrl(filePath: string) {
    assertIsolatedDatabase(filePath);
    return pathToFileURL(filePath).href;
}

async function getPlaywrightUserId() {
    assertIsolatedDatabase(CORE_DB);
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await core.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: ["playwright-admin@example.com"],
        });
        const userId = result.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Playwright user not found");
        }
        return userId;
    } finally {
        await core.close();
    }
}

async function getSpeakerProfiles(page: Page): Promise<SpeakerProfile[]> {
    const response = await page.request.get(SPEAKER_PROFILES_ENDPOINT);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as SpeakerProfilesResponse;
    expect(Array.isArray(body.profiles)).toBe(true);
    return body.profiles;
}

async function readSpeakerProfiles(userId: string, profileId: string) {
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });
    try {
        const result = await voiceprints.execute({
            sql: `
                SELECT id, display_name
                FROM speaker_profiles
                WHERE user_id = ? AND id = ?
            `,
            args: [userId, profileId],
        });
        return result.rows;
    } finally {
        await voiceprints.close();
    }
}

async function readSpeakerProfilesByName(userId: string, displayName: string) {
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });
    try {
        const result = await voiceprints.execute({
            sql: `
                SELECT id, display_name
                FROM speaker_profiles
                WHERE user_id = ? AND display_name = ?
                ORDER BY id ASC
            `,
            args: [userId, displayName],
        });
        return result.rows;
    } finally {
        await voiceprints.close();
    }
}

async function readSearchFollowups(userId: string, profileId: string) {
    const search = createClient({ url: databaseUrl(SEARCH_DB) });
    try {
        const [jobs, tombstones] = await Promise.all([
            search.execute({
                sql: `
                    SELECT action
                    FROM search_index_jobs
                    WHERE user_id = ? AND entity_type = 'speaker' AND entity_id = ?
                    ORDER BY created_at ASC
                `,
                args: [userId, profileId],
            }),
            search.execute({
                sql: `
                    SELECT entity_id
                    FROM search_tombstones
                    WHERE user_id = ? AND entity_type = 'speaker' AND entity_id = ?
                `,
                args: [userId, profileId],
            }),
        ]);
        return { jobs: jobs.rows, tombstones: tombstones.rows };
    } finally {
        await search.close();
    }
}

async function readSearchIdempotencyKeys(userId: string, profileId: string) {
    const search = createClient({ url: databaseUrl(SEARCH_DB) });
    try {
        const result = await search.execute({
            sql: `
                SELECT idempotency_key
                FROM search_index_jobs
                WHERE user_id = ? AND entity_type = 'speaker' AND entity_id = ?
                ORDER BY created_at ASC
            `,
            args: [userId, profileId],
        });
        return result.rows;
    } finally {
        await search.close();
    }
}

async function expireRetryAuthorization(
    userId: string,
    mutation: "create" | "update" | "delete",
    profileId: string,
) {
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });
    try {
        await voiceprints.execute({
            sql: `
                UPDATE speaker_profile_retry_authorizations
                SET expires_at = ?
                WHERE user_id = ? AND mutation = ? AND profile_id = ?
                  AND consumed_at IS NULL
            `,
            args: [Date.now() - 1, userId, mutation, profileId],
        });
    } finally {
        await voiceprints.close();
    }
}

async function acquireExclusiveLock(filePath: string): Promise<Client> {
    const lock = createClient({ url: databaseUrl(filePath) });
    await lock.execute("PRAGMA busy_timeout = 0");
    await lock.execute("BEGIN EXCLUSIVE");
    return lock;
}

async function releaseExclusiveLock(lock: Client | null) {
    if (!lock) {
        return;
    }

    try {
        await lock.execute("COMMIT");
    } finally {
        await lock.close();
    }
}

async function installSearchIndexFailure() {
    const search = createClient({ url: databaseUrl(SEARCH_DB) });
    const triggerName = `e2e_speaker_index_failure_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;

    await search.execute(`
        CREATE TRIGGER ${triggerName}
        BEFORE INSERT ON search_index_jobs
        WHEN NEW.entity_type = 'speaker'
        BEGIN
            SELECT RAISE(ABORT, 'E2E search index failure');
        END
    `);

    return async () => {
        try {
            await search.execute(`DROP TRIGGER IF EXISTS ${triggerName}`);
        } finally {
            await search.close();
        }
    };
}

function savedSpeakersList(page: Page) {
    return page.getByRole("list", { name: SAVED_SPEAKERS_LABEL });
}

function speakerProfileRow(page: Page, name: string) {
    return savedSpeakersList(page).getByRole("listitem").filter({
        has: page.getByLabel(
            new RegExp(`^(Speaker profile name: |说话人名称：)${name}$`),
        ),
    });
}

function speakerSettings(page: Page) {
    return page.getByLabel(SPEAKER_SETTINGS_LABEL);
}

function speakerProfileNameInput(page: Page, name: string) {
    return speakerProfileRow(page, name).getByLabel(
        new RegExp(`^(Speaker profile name: |说话人名称：)${name}$`),
    );
}

async function waitForSpeakerResponse(
    page: Page,
    method: string,
    pathname: string,
    status: number,
) {
    return page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            response.request().method() === method &&
            url.pathname === pathname &&
            response.status() === status
        );
    });
}

async function retryCommittedFollowup(page: Page) {
    const alert = page.getByRole("alert").filter({
        has: page.getByText(COMMITTED_FOLLOWUP_ALERT, { exact: true }),
    });
    const retry = alert.getByRole("button", {
        name: RETRY_SPEAKER_UPDATE_LABEL,
        exact: true,
    });

    await expect(alert).toBeVisible();
    await expect(retry).toBeVisible();

    const retryResponse = waitForSpeakerResponse(
        page,
        "POST",
        RETRY_ENDPOINT,
        200,
    );
    await retry.click();
    const response = await retryResponse;
    expect(await response.json()).toEqual({ success: true });
    await expect(alert).toHaveCount(0);
}

async function expectInvalidRetryDescriptor(
    page: Page,
    retry: { mutation: "create" | "update" | "delete"; profileId: string },
) {
    const response = await page.request.post(RETRY_ENDPOINT, { data: retry });
    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({
        error: INVALID_RETRY_ERROR,
    });
}

async function createCrossUserPage(browser: Browser, suffix: string) {
    const userId = `e2e-speaker-retry-${suffix}`;
    const sessionToken = randomBytes(32).toString("base64url");
    const now = Date.now();
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) {
        throw new Error("BETTER_AUTH_SECRET is required for cross-user E2E");
    }

    try {
        await core.batch(
            [
                {
                    sql: `
                        INSERT INTO users (
                            id, email, email_verified, is_anonymous, name,
                            created_at, updated_at
                        )
                        VALUES (?, ?, 0, 0, ?, ?, ?)
                    `,
                    args: [
                        userId,
                        `speaker-retry-${suffix}@example.com`,
                        "Speaker Retry Other User",
                        now,
                        now,
                    ],
                },
                {
                    sql: `
                        INSERT INTO sessions (
                            id, expires_at, token, user_id, created_at, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?)
                    `,
                    args: [
                        `e2e-session-${suffix}`,
                        now + 5 * 60 * 1000,
                        sessionToken,
                        userId,
                        now,
                        now,
                    ],
                },
            ],
            "write",
        );
    } finally {
        await core.close();
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    const baseUrl =
        process.env.PLAYWRIGHT_BASE_URL?.trim() ||
        process.env.APP_URL?.trim() ||
        `http://127.0.0.1:${process.env.PLAYWRIGHT_E2E_PORT?.trim() || "3201"}`;
    await context.addCookies([
        {
            name: "better-auth.session_token",
            value: `${sessionToken}.${await makeSignature(sessionToken, secret)}`,
            url: baseUrl,
        },
    ]);
    const readback = await page.request.get(
        new URL(SPEAKER_PROFILES_ENDPOINT, baseUrl).toString(),
    );
    expect(readback.status()).toBe(200);
    await expect(readback.json()).resolves.toEqual({ profiles: [] });

    return { context, page };
}

test("speaker profile follow-up retry is idempotent across create, update, and delete", async ({
    browser,
    page,
}) => {
    let userId: string | null = null;
    let profileId: string | null = null;
    let retryToken: string | null = null;
    let lock: Client | null = null;
    let removeSearchIndexFailure: (() => Promise<void>) | null = null;
    let profileReadFailures = 0;
    const deleteStatuses: number[] = [];
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const originalName = `E2E Speaker ${suffix}`;
    const updatedName = `E2E Speaker Updated ${suffix}`;

    page.on("response", (response) => {
        const url = new URL(response.url());
        if (
            response.request().method() === "GET" &&
            url.pathname === SPEAKER_PROFILES_ENDPOINT &&
            response.status() === 500
        ) {
            profileReadFailures += 1;
        }

        if (!profileId) {
            return;
        }

        if (
            response.request().method() === "DELETE" &&
            url.pathname === `${SPEAKER_PROFILES_ENDPOINT}/${profileId}`
        ) {
            deleteStatuses.push(response.status());
        }
    });

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();

        lock = await acquireExclusiveLock(VOICEPRINTS_DB);
        const getFailure = waitForSpeakerResponse(
            page,
            "GET",
            SPEAKER_PROFILES_ENDPOINT,
            500,
        );
        await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });
        await getFailure;
        await expect.poll(() => profileReadFailures).toBe(2);

        const panel = speakerSettings(page);
        const getFailureAlert = panel.getByRole("alert").filter({
            hasText: "Failed to fetch speaker profiles",
        });
        const getRetry = getFailureAlert.getByRole("button", {
            name: RETRY_LABEL,
            exact: true,
        });
        await expect(getFailureAlert).toBeVisible();
        await expect(getRetry).toBeVisible();

        await releaseExclusiveLock(lock);
        lock = null;
        const getRecovery = waitForSpeakerResponse(
            page,
            "GET",
            SPEAKER_PROFILES_ENDPOINT,
            200,
        );
        await getRetry.click();
        await getRecovery;
        await expect(getFailureAlert).toHaveCount(0);

        const newSpeakerName = panel.getByRole("textbox", {
            name: SPEAKER_NAME_LABEL,
            exact: true,
        });
        const addSpeaker = panel.getByRole("button", {
            name: ADD_SPEAKER_LABEL,
            exact: true,
        });
        await expect(panel).toBeVisible();

        removeSearchIndexFailure = await installSearchIndexFailure();
        await newSpeakerName.fill(originalName);
        const createFailure = waitForSpeakerResponse(
            page,
            "POST",
            SPEAKER_PROFILES_ENDPOINT,
            503,
        );
        await addSpeaker.click();
        const createResponse = await createFailure;
        const createBody = (await createResponse.json()) as {
            code?: string;
            retry?: { mutation?: string; profileId?: string };
        };
        expect(createBody).toMatchObject({
            code: "SPEAKER_PROFILE_WRITE_COMMITTED_INDEX_FOLLOWUP_FAILED",
            retry: { mutation: "create", profileId: expect.any(String) },
        });
        retryToken = createBody.retry?.profileId ?? null;
        expect(retryToken).toEqual(expect.any(String));
        if (!retryToken) {
            throw new Error("Create failure did not include a retry token");
        }

        const uncertainRetryResponse = await page.request.post(RETRY_ENDPOINT, {
            data: { mutation: "create", profileId: retryToken },
        });
        expect(uncertainRetryResponse.status()).toBe(503);
        await expect(uncertainRetryResponse.json()).resolves.toMatchObject({
            code: "SPEAKER_PROFILE_WRITE_COMMITTED_INDEX_FOLLOWUP_FAILED",
            retry: { mutation: "create", profileId: retryToken },
        });

        await expectInvalidRetryDescriptor(page, {
            mutation: "create",
            profileId: `${retryToken}forged`,
        });
        const crossUser = await createCrossUserPage(browser, suffix);
        try {
            await expectInvalidRetryDescriptor(crossUser.page, {
                mutation: "create",
                profileId: retryToken,
            });
        } finally {
            await crossUser.context.close();
        }

        await expect(speakerProfileRow(page, originalName)).toBeVisible();
        const createdProfiles = (await getSpeakerProfiles(page)).filter(
            (profile) => profile.displayName === originalName,
        );
        expect(createdProfiles).toHaveLength(1);
        profileId = createdProfiles[0]?.id ?? null;
        expect(profileId).toEqual(expect.any(String));
        if (!profileId) {
            throw new Error("Create readback did not include a profile id");
        }
        expect(await readSpeakerProfiles(userId, profileId)).toEqual([
            { id: profileId, display_name: originalName },
        ]);
        expect(await readSpeakerProfilesByName(userId, originalName)).toEqual([
            { id: profileId, display_name: originalName },
        ]);
        expect(createdProfiles).toEqual([
            expect.objectContaining({ id: profileId, displayName: originalName }),
        ]);

        await removeSearchIndexFailure();
        removeSearchIndexFailure = null;
        await retryCommittedFollowup(page);
        expect(await readSpeakerProfilesByName(userId, originalName)).toEqual([
            { id: profileId, display_name: originalName },
        ]);
        expect((await readSearchFollowups(userId, profileId)).jobs).toEqual([
            { action: "upsert" },
        ]);
        expect(await readSearchIdempotencyKeys(userId, profileId)).toEqual([
            { idempotency_key: expect.any(String) },
        ]);
        await expectInvalidRetryDescriptor(page, {
            mutation: "create",
            profileId: retryToken,
        });
        expect((await readSearchFollowups(userId, profileId)).jobs).toEqual([
            { action: "upsert" },
        ]);

        const originalRow = speakerProfileRow(page, originalName);
        const profileName = speakerProfileNameInput(page, originalName);
        await expect(profileName).toBeVisible();

        removeSearchIndexFailure = await installSearchIndexFailure();
        await profileName.fill(updatedName);
        const updateFailure = waitForSpeakerResponse(
            page,
            "PATCH",
            `${SPEAKER_PROFILES_ENDPOINT}/${profileId}`,
            503,
        );
        await speakerProfileRow(page, updatedName)
            .getByRole("button", { name: SAVE_LABEL, exact: true })
            .click();
        const updateResponse = await updateFailure;
        expect(await updateResponse.json()).toMatchObject({
            code: "SPEAKER_PROFILE_WRITE_COMMITTED_INDEX_FOLLOWUP_FAILED",
            retry: { mutation: "update", profileId: expect.any(String) },
        });

        await expect(speakerProfileRow(page, updatedName)).toBeVisible();
        expect(await readSpeakerProfiles(userId, profileId)).toEqual([
            { id: profileId, display_name: updatedName },
        ]);
        expect(await readSpeakerProfilesByName(userId, originalName)).toEqual([]);
        expect(await readSpeakerProfilesByName(userId, updatedName)).toEqual([
            { id: profileId, display_name: updatedName },
        ]);
        expect(
            (await getSpeakerProfiles(page)).filter(
                (profile) => profile.id === profileId,
            ),
        ).toEqual([
            expect.objectContaining({ id: profileId, displayName: updatedName }),
        ]);

        await removeSearchIndexFailure();
        removeSearchIndexFailure = null;
        await retryCommittedFollowup(page);
        expect(await readSpeakerProfiles(userId, profileId)).toEqual([
            { id: profileId, display_name: updatedName },
        ]);
        expect((await readSearchFollowups(userId, profileId)).jobs).toEqual([
            { action: "upsert" },
            { action: "upsert" },
        ]);

        const updatedRow = speakerProfileRow(page, updatedName);
        removeSearchIndexFailure = await installSearchIndexFailure();
        await updatedRow
            .getByRole("button", { name: DELETE_LABEL, exact: true })
            .click();
        const confirmDialog = page.getByRole("dialog", {
            name: CONFIRM_ACTION_LABEL,
            exact: true,
        });
        await expect(confirmDialog).toContainText(updatedName);
        const deleteFailure = waitForSpeakerResponse(
            page,
            "DELETE",
            `${SPEAKER_PROFILES_ENDPOINT}/${profileId}`,
            503,
        );
        await confirmDialog
            .getByRole("button", { name: CONFIRM_LABEL, exact: true })
            .click();
        const deleteResponse = await deleteFailure;
        expect(await deleteResponse.json()).toMatchObject({
            code: "SPEAKER_PROFILE_WRITE_COMMITTED_INDEX_FOLLOWUP_FAILED",
            retry: { mutation: "delete", profileId: expect.any(String) },
        });

        await expect(speakerProfileRow(page, updatedName)).toHaveCount(0);
        expect(await readSpeakerProfiles(userId, profileId)).toEqual([]);
        expect(
            (await getSpeakerProfiles(page)).filter(
                (profile) => profile.id === profileId,
            ),
        ).toEqual([]);

        await removeSearchIndexFailure();
        removeSearchIndexFailure = null;
        await retryCommittedFollowup(page);
        expect(deleteStatuses).toEqual([503]);
        expect(await readSearchFollowups(userId, profileId)).toEqual({
            jobs: [{ action: "upsert" }, { action: "upsert" }, { action: "delete" }],
            tombstones: [{ entity_id: profileId }],
        });
    } finally {
        if (removeSearchIndexFailure) {
            await removeSearchIndexFailure();
        }
        await releaseExclusiveLock(lock);
        if (profileId) {
            const remaining = await readSpeakerProfiles(userId ?? "", profileId);
            if (remaining.length > 0) {
                const cleanupResponse = await page.request.delete(
                    `${SPEAKER_PROFILES_ENDPOINT}/${profileId}`,
                );
                expect(cleanupResponse.status()).toBe(200);
            }
        }
    }
});

test("speaker profile retry rejects a durably expired authorization", async ({
    page,
}) => {
    let userId: string | null = null;
    let profileId: string | null = null;
    let removeSearchIndexFailure: (() => Promise<void>) | null = null;
    const profileName = `E2E Expired Speaker ${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

        const panel = speakerSettings(page);
        const newSpeakerName = panel.getByRole("textbox", {
            name: SPEAKER_NAME_LABEL,
            exact: true,
        });
        const addSpeaker = panel.getByRole("button", {
            name: ADD_SPEAKER_LABEL,
            exact: true,
        });

        removeSearchIndexFailure = await installSearchIndexFailure();
        await newSpeakerName.fill(profileName);
        const createFailure = waitForSpeakerResponse(
            page,
            "POST",
            SPEAKER_PROFILES_ENDPOINT,
            503,
        );
        await addSpeaker.click();
        const failure = await createFailure;
        const body = (await failure.json()) as {
            retry?: { mutation?: string; profileId?: string };
        };
        const retry = body.retry;
        if (
            retry?.mutation !== "create" ||
            typeof retry.profileId !== "string" ||
            !retry.profileId
        ) {
            throw new Error("Create failure did not include a retry token");
        }

        const profiles = (await getSpeakerProfiles(page)).filter(
            (profile) => profile.displayName === profileName,
        );
        expect(profiles).toHaveLength(1);
        profileId = profiles[0]?.id ?? null;
        if (!profileId || !userId) {
            throw new Error("Create failure did not persist its profile");
        }

        await expireRetryAuthorization(userId, "create", profileId);
        await expectInvalidRetryDescriptor(page, {
            mutation: "create",
            profileId: retry.profileId,
        });
    } finally {
        if (removeSearchIndexFailure) {
            await removeSearchIndexFailure();
        }
        if (profileId) {
            const cleanupResponse = await page.request.delete(
                `${SPEAKER_PROFILES_ENDPOINT}/${profileId}`,
            );
            expect(cleanupResponse.status()).toBe(200);
        }
    }
});
