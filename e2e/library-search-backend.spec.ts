import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const PLAYWRIGHT_USER_EMAIL = "playwright-admin@example.com";
const SEARCH_TARGET_RECORDING_ID = "e2e-library-search-backend-target";
const SEARCH_OTHER_RECORDING_ID = "e2e-library-search-backend-other";
const SEARCH_TRANSCRIPT_ENTITY_ID =
    "e2e-library-search-backend-transcript-segment";
const SEARCH_INDEXING_JOB_ID = "e2e-library-search-backend-indexing-job";
const SEARCH_INDEXING_ENTITY_ID = "e2e-library-search-backend-indexing";
const SEARCH_INDEXING_QUERY = "indexinggateproof";
const SEARCH_INDEXING_TIMESTAMP_MS = 1_800_000_000_000;
const SEARCH_QUERY = "backendrouteproof";
const SEARCH_TARGET_TITLE = "E2E backend search target";
const SEARCH_BODY =
    "backendrouteproof transcript content from the local search read model";

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
}

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-${suffix}${parsed.ext || ".db"}`,
    );
}

function assertE2EDatabasePath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ??
            path.join(process.cwd(), "tmp/e2e"),
    );
    const resolvedPath = path.resolve(filePath);

    if (
        resolvedPath !== e2eRoot &&
        !resolvedPath.startsWith(`${e2eRoot}${path.sep}`)
    ) {
        throw new Error(
            `Refusing to touch non-E2E database path: ${resolvedPath}`,
        );
    }
}

function databaseUrl(filePath: string) {
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

function hashSearchContent(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const SEARCH_DB = deriveSiblingDatabasePath(CORE_DB, "search");

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await client.execute({
            sql: "SELECT id FROM `users` WHERE email = ? LIMIT 1",
            args: [PLAYWRIGHT_USER_EMAIL],
        });
        const id = result.rows[0]?.id;
        if (typeof id !== "string") {
            throw new Error("Playwright user not found");
        }
        return id;
    } finally {
        await client.close();
    }
}

async function seedDashboardRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    const recordings = [
        {
            id: SEARCH_OTHER_RECORDING_ID,
            filename: "E2E backend search other",
            startTime: now - 60_000,
        },
        {
            id: SEARCH_TARGET_RECORDING_ID,
            filename: SEARCH_TARGET_TITLE,
            startTime: now - 180_000,
        },
    ];

    try {
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ? AND id IN (?, ?)",
            args: [userId, SEARCH_TARGET_RECORDING_ID, SEARCH_OTHER_RECORDING_ID],
        });

        for (const recording of recordings) {
            await library.execute({
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
                    recording.id,
                    userId,
                    "ticnote",
                    `${recording.id}-source`,
                    "1",
                    "{}",
                    "e2e-library-search-backend-device",
                    recording.filename,
                    180_000,
                    recording.startTime,
                    recording.startTime + 180_000,
                    4096,
                    recording.id,
                    "local",
                    "",
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            });
        }
    } finally {
        await library.close();
    }
}

async function seedSearchReadModel(userId: string) {
    const search = createClient({ url: databaseUrl(SEARCH_DB) });
    const now = Date.now();
    try {
        await search.execute({
            sql: `
                DELETE FROM search_content_fts
                WHERE recording_id IN (?, ?) OR entity_id = ?
            `,
            args: [
                SEARCH_TARGET_RECORDING_ID,
                SEARCH_OTHER_RECORDING_ID,
                SEARCH_TRANSCRIPT_ENTITY_ID,
            ],
        });
        await search.execute({
            sql: `
                DELETE FROM search_chunks
                WHERE recording_id IN (?, ?) OR entity_id = ?
            `,
            args: [
                SEARCH_TARGET_RECORDING_ID,
                SEARCH_OTHER_RECORDING_ID,
                SEARCH_TRANSCRIPT_ENTITY_ID,
            ],
        });
        await search.execute({
            sql: `
                DELETE FROM search_documents
                WHERE user_id = ?
                    AND (recording_id IN (?, ?) OR entity_id = ?)
            `,
            args: [
                userId,
                SEARCH_TARGET_RECORDING_ID,
                SEARCH_OTHER_RECORDING_ID,
                SEARCH_TRANSCRIPT_ENTITY_ID,
            ],
        });
        await search.execute({
            sql: "DELETE FROM search_index_jobs WHERE user_id = ?",
            args: [userId],
        });

        await search.execute({
            sql: `
                INSERT INTO search_documents (
                    id, user_id, entity_type, entity_id, recording_id,
                    transcript_origin, source_provider, title, start_ms,
                    end_ms, sort_seq_ms, content_hash, index_version,
                    indexed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                `${SEARCH_TRANSCRIPT_ENTITY_ID}-document`,
                userId,
                "transcript",
                SEARCH_TRANSCRIPT_ENTITY_ID,
                SEARCH_TARGET_RECORDING_ID,
                "local",
                "ticnote",
                SEARCH_TARGET_TITLE,
                4_000,
                7_000,
                now - 180_000,
                hashSearchContent(
                    [SEARCH_TARGET_TITLE, SEARCH_BODY, "ticnote"].join("\n"),
                ),
                1,
                now,
                now,
                now,
            ],
        });

        const documentResult = await search.execute({
            sql: `
                SELECT rowid
                FROM search_documents
                WHERE user_id = ? AND entity_type = ? AND entity_id = ?
                LIMIT 1
            `,
            args: [userId, "transcript", SEARCH_TRANSCRIPT_ENTITY_ID],
        });
        const documentRowid = Number(documentResult.rows[0]?.rowid);
        if (!Number.isFinite(documentRowid)) {
            throw new Error("Search document seed failed");
        }

        await search.execute({
            sql: `
                INSERT INTO search_chunks (
                    document_rowid, user_id, entity_type, entity_id,
                    recording_id, segment_id, chunk_index, start_ms, end_ms,
                    sort_seq_ms, body, body_hash, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                documentRowid,
                userId,
                "transcript",
                SEARCH_TRANSCRIPT_ENTITY_ID,
                SEARCH_TARGET_RECORDING_ID,
                SEARCH_TRANSCRIPT_ENTITY_ID,
                0,
                4_000,
                7_000,
                now - 180_000,
                SEARCH_BODY,
                hashSearchContent(SEARCH_BODY),
                now,
                now,
            ],
        });

        const chunkResult = await search.execute({
            sql: `
                SELECT rowid
                FROM search_chunks
                WHERE document_rowid = ? AND chunk_index = 0
                LIMIT 1
            `,
            args: [documentRowid],
        });
        const chunkRowid = Number(chunkResult.rows[0]?.rowid);
        if (!Number.isFinite(chunkRowid)) {
            throw new Error("Search chunk seed failed");
        }

        await search.execute({
            sql: `
                INSERT INTO search_content_fts (
                    rowid, title, body, speaker, tags, source,
                    entity_type, entity_id, recording_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                chunkRowid,
                null,
                SEARCH_BODY,
                null,
                null,
                null,
                "transcript",
                SEARCH_TRANSCRIPT_ENTITY_ID,
                SEARCH_TARGET_RECORDING_ID,
            ],
        });
    } finally {
        await search.close();
    }
}

async function seedActiveSearchIndexJob(userId: string) {
    const search = createClient({ url: databaseUrl(SEARCH_DB) });
    try {
        await search.execute({
            sql: `
                DELETE FROM search_index_jobs
                WHERE user_id = ? AND id = ?
            `,
            args: [userId, SEARCH_INDEXING_JOB_ID],
        });
        await search.execute({
            sql: `
                INSERT INTO search_index_jobs (
                    id, user_id, entity_type, entity_id, action, status,
                    attempts, last_error, scheduled_at, started_at,
                    completed_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                SEARCH_INDEXING_JOB_ID,
                userId,
                "recording",
                SEARCH_INDEXING_ENTITY_ID,
                "rebuild",
                "indexing",
                0,
                null,
                SEARCH_INDEXING_TIMESTAMP_MS,
                SEARCH_INDEXING_TIMESTAMP_MS,
                null,
                SEARCH_INDEXING_TIMESTAMP_MS,
                SEARCH_INDEXING_TIMESTAMP_MS,
            ],
        });
    } finally {
        await search.close();
    }
}

async function cleanupActiveSearchIndexJob(userId: string) {
    const search = createClient({ url: databaseUrl(SEARCH_DB) });
    try {
        await search.execute({
            sql: `
                DELETE FROM search_index_jobs
                WHERE user_id = ? AND id = ?
            `,
            args: [userId, SEARCH_INDEXING_JOB_ID],
        });
    } finally {
        await search.close();
    }
}

async function countActiveSearchIndexJob(userId: string) {
    const search = createClient({ url: databaseUrl(SEARCH_DB) });
    try {
        const result = await search.execute({
            sql: `
                SELECT count(*) AS count
                FROM search_index_jobs
                WHERE user_id = ? AND id = ?
            `,
            args: [userId, SEARCH_INDEXING_JOB_ID],
        });
        return Number(result.rows[0]?.count ?? 0);
    } finally {
        await search.close();
    }
}

async function openLibrarySearch(page: Page) {
    const trigger = page.getByRole("button", { name: /^(搜索|Search)$/ });
    const panel = page.getByRole("dialog", {
        name: /^(搜索库|Search library)$/,
    });

    await expect(page.locator('[data-surface="dashboard-workstation"]')).toHaveAttribute(
        "data-state",
        "ready",
    );
    await expect(trigger).toHaveAttribute("data-control", "dashboard-search");
    await expect(trigger).toBeVisible();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await trigger.click();
        if (
            await panel
                .isVisible({ timeout: 3_000 })
                .catch(() => false)
        ) {
            return panel;
        }
        await trigger.press("Enter");
        if (
            await panel
                .isVisible({ timeout: 3_000 })
                .catch(() => false)
        ) {
            return panel;
        }
        await page.waitForTimeout(250);
    }

    await expect(panel).toBeVisible();
    return panel;
}

function librarySearchResult(page: Page, type: string, index = 0) {
    return page.locator(
        `[data-control="library-search-result"][data-result-type="${type}"]`,
    ).nth(index);
}

test("library search uses the real /api/search route against the seeded local read model", async ({
    page,
}) => {
    test.setTimeout(180_000);

    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    await seedDashboardRecordings(userId);
    await seedSearchReadModel(userId);

    const searchRequests: string[] = [];
    page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.pathname === "/api/search") {
            searchRequests.push(url.toString());
        }
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const otherRecording = page.locator(
        `[data-control="dashboard-recording-row"][data-recording-id="${SEARCH_OTHER_RECORDING_ID}"]`,
    );
    const targetRecording = page.locator(
        `[data-control="dashboard-recording-row"][data-recording-id="${SEARCH_TARGET_RECORDING_ID}"]`,
    );
    await expect(otherRecording).toBeVisible();
    await expect(targetRecording).toBeVisible();
    await otherRecording.click();
    await expect(otherRecording).toHaveAttribute("data-state", "selected");
    await expect(targetRecording).toHaveAttribute("data-state", "idle");

    const panel = await openLibrarySearch(page);
    await expect(panel).toHaveAttribute("data-panel", "library-search");
    const input = panel.getByRole("combobox");
    const searchResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            url.pathname === "/api/search" &&
            url.searchParams.get("q") === SEARCH_QUERY
        );
    });

    await input.fill(SEARCH_QUERY);
    const searchResponse = await searchResponsePromise;
    const responsePayload = (await searchResponse.json()) as {
        results?: Array<{
            body?: string;
            entityId?: string;
            entityType?: string;
            recordingId?: string | null;
            title?: string | null;
        }>;
        indexing?: { active?: boolean };
    };

    expect(searchResponse.status()).toBe(200);
    expect(searchResponse.headers()["cache-control"]).toContain(
        "private, no-store",
    );
    expect(responsePayload.indexing?.active).not.toBe(true);
    expect(responsePayload.results).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                body: SEARCH_BODY,
                entityId: SEARCH_TRANSCRIPT_ENTITY_ID,
                entityType: "transcript",
                recordingId: SEARCH_TARGET_RECORDING_ID,
                title: SEARCH_TARGET_TITLE,
            }),
        ]),
    );
    expect(searchRequests).toEqual(
        expect.arrayContaining([
            expect.stringContaining(`/api/search?q=${SEARCH_QUERY}&limit=8`),
        ]),
    );

    const transcriptResult = librarySearchResult(page, "transcript", 0);
    await expect(transcriptResult).toBeVisible();
    await expect(transcriptResult).toHaveAttribute(
        "data-control",
        "library-search-result",
    );
    await expect(transcriptResult).toContainText(SEARCH_TARGET_TITLE);
    await expect(transcriptResult).toContainText(SEARCH_BODY);

    await transcriptResult.click();
    await expect(panel).toBeHidden();
    await expect(targetRecording).toHaveAttribute("data-state", "selected");
    await expect(otherRecording).toHaveAttribute("data-state", "idle");
});

test("library search shows the real backend indexing state while search index jobs are active", async ({
    page,
}) => {
    test.setTimeout(180_000);

    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    await seedDashboardRecordings(userId);
    await seedActiveSearchIndexJob(userId);

    try {
        const searchResponse = await page.request.get("/api/search", {
            params: {
                q: SEARCH_INDEXING_QUERY,
                type: "transcript",
                limit: "8",
            },
        });
        const searchPayload = (await searchResponse.json()) as {
            results?: unknown[];
            indexing?: {
                active?: boolean;
                pendingJobs?: number;
                indexingJobs?: number;
                completedJobs?: number;
                totalJobs?: number;
            };
        };

        expect(searchResponse.ok()).toBe(true);
        expect(searchPayload.results).toEqual([]);
        expect(searchPayload.indexing).toEqual({
            active: true,
            pendingJobs: 0,
            indexingJobs: 1,
            completedJobs: 0,
            totalJobs: 1,
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        const panel = await openLibrarySearch(page);
        const input = panel.getByRole("combobox");

        await input.fill(SEARCH_INDEXING_QUERY);
        await expect(panel).toHaveAttribute("data-state", "indexing");
        await expect(input).toHaveAttribute("data-state", "indexing");
        await expect(input).toHaveAttribute("aria-disabled", "true");
        await expect(input).toHaveJSProperty("readOnly", true);

        const indexingState = panel.locator(
            '[data-part="library-search-indexing"][data-state="indexing"]',
        );
        await expect(indexingState).toBeVisible();
        await expect(indexingState).toContainText("正在重建本地搜索索引");
        await expect(indexingState).toContainText("0 / 1");
        await expect(panel.getByRole("progressbar")).toBeVisible();

        const scopeControls = panel
            .getByRole("radiogroup", { name: /^(检索范围|Search scope)$/ })
            .getByRole("radio");
        await expect(scopeControls).toHaveCount(5);
        for (const scopeControl of await scopeControls.all()) {
            await expect(scopeControl).toBeDisabled();
        }
    } finally {
        await cleanupActiveSearchIndexJob(userId);
        expect(await countActiveSearchIndexJob(userId)).toBe(0);
    }
});
