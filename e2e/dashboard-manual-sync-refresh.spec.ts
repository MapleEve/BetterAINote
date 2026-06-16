import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const SYNC_RECORDING_PREFIX = "e2e-manual-sync-refresh-";
const OLD_RECORDING_ID = `${SYNC_RECORDING_PREFIX}old`;
const NEW_RECORDING_ID = `${SYNC_RECORDING_PREFIX}new`;
const OLD_RECORDING_TITLE = "E2E manual sync older recording";
const NEW_RECORDING_TITLE = "E2E manual sync newest recording";

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
    const resolved = path.resolve(filePath);

    if (resolved !== e2eRoot && !resolved.startsWith(`${e2eRoot}${path.sep}`)) {
        throw new Error(`Refusing to touch non-E2E database path: ${resolved}`);
    }
}

function databaseUrl(filePath: string) {
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

async function executeWithBusyRetry<T>(
    operation: () => Promise<T>,
    attempts = 5,
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (
                !(error instanceof Error) ||
                !error.message.includes("SQLITE_BUSY") ||
                attempt === attempts - 1
            ) {
                throw error;
            }

            await new Promise((resolve) =>
                setTimeout(resolve, 75 * (attempt + 1)),
            );
        }
    }

    throw lastError;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");

for (const databasePath of [CORE_DB, LIBRARY_DB]) {
    assertE2EDatabasePath(databasePath);
}

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await client.execute({
            sql: "SELECT id FROM `users` WHERE email = ? LIMIT 1",
            args: ["playwright-admin@example.com"],
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

async function resetDisplayToNewestChinese(page: Page) {
    const response = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "dark",
            uiLanguage: "zh-CN",
        },
    });
    expect(response.ok()).toBe(true);
}

async function cleanupManualSyncSeeds(userId?: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM transcription_jobs WHERE recording_id LIKE ?",
                args: [`${SYNC_RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recording_tag_assignments WHERE recording_id LIKE ?",
                args: [`${SYNC_RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: userId
                    ? "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?"
                    : "DELETE FROM recordings WHERE id LIKE ?",
                args: userId
                    ? [userId, `${SYNC_RECORDING_PREFIX}%`]
                    : [`${SYNC_RECORDING_PREFIX}%`],
            }),
        );
    } finally {
        await library.close();
    }
}

async function seedManualSyncRecording(input: {
    id: string;
    userId: string;
    title: string;
    startTime: number;
}) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();

    try {
        await executeWithBusyRetry(() =>
            library.execute({
                sql: `
                    INSERT OR REPLACE INTO recordings (
                        id, user_id, source_provider, source_recording_id, source_version,
                        source_metadata, provider_device_id, filename, duration, start_time,
                        end_time, filesize, file_md5, storage_type, storage_path,
                        downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    input.id,
                    input.userId,
                    "ticnote",
                    `${input.id}-source`,
                    "1",
                    "{}",
                    "e2e-manual-sync-device",
                    input.title,
                    120_000,
                    input.startTime,
                    input.startTime + 120_000,
                    2048,
                    input.id,
                    "local",
                    "",
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            }),
        );
    } finally {
        await library.close();
    }
}

function healthySyncStatus() {
    const now = new Date();

    return {
        mode: "local",
        schedule: {
            autoSyncEnabled: true,
            syncInterval: 300000,
            lastSyncAt: now.toISOString(),
            nextEligibleSyncAt: new Date(
                now.getTime() + 5 * 60 * 1000,
            ).toISOString(),
            due: false,
        },
        workerStatus: {
            healthy: true,
            isRunning: false,
            lastHeartbeatAt: now.toISOString(),
            lastStartedAt: now.toISOString(),
            lastFinishedAt: now.toISOString(),
            nextRunAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
            manualTriggerRequestedAt: null,
            lastError: null,
            lastSummary: {
                newRecordings: 1,
                updatedRecordings: 0,
                removedRecordings: 0,
                errorCount: 0,
            },
        },
    };
}

async function mockManualSyncEndpoint(page: Page, userId: string) {
    let postCount = 0;

    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() === "POST") {
            postCount += 1;
            await seedManualSyncRecording({
                id: NEW_RECORDING_ID,
                userId,
                title: NEW_RECORDING_TITLE,
                startTime: Date.now() + 60_000,
            });
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    success: true,
                    queued: false,
                    newRecordings: 1,
                    updatedRecordings: 0,
                    removedRecordings: 0,
                    errors: [],
                }),
            });
            return;
        }

        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(healthySyncStatus()),
            });
            return;
        }

        await route.fallback();
    });

    return () => postCount;
}

async function mockFailingManualSyncEndpoint(
    page: Page,
    postGate: Promise<void>,
) {
    let postCount = 0;

    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() === "POST") {
            postCount += 1;
            await postGate;
            await route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({
                    error: "PR20 manual sync failed",
                }),
            });
            return;
        }

        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(healthySyncStatus()),
            });
            return;
        }

        await route.fallback();
    });

    return () => postCount;
}

function dashboardSyncPanel(page: Page) {
    return page.locator('[data-sot-panel="dashboard-sync"]');
}

function dashboardSyncButton(page: Page) {
    return dashboardSyncPanel(page).locator(
        'button[data-sot-control="dashboard-sync"]',
    );
}

async function expectNewRecordingBeforeOld(page: Page) {
    const newRecording = page.locator(
        `[data-sot-recording-id="${NEW_RECORDING_ID}"]`,
    );
    const oldRecording = page.locator(
        `[data-sot-recording-id="${OLD_RECORDING_ID}"]`,
    );

    await expect(newRecording).toBeVisible();
    await expect(newRecording).toContainText(NEW_RECORDING_TITLE);
    await expect(oldRecording).toBeVisible();
    await expect(oldRecording).toContainText(OLD_RECORDING_TITLE);

    await expect
        .poll(async () =>
            newRecording.evaluate((newRow, oldId) => {
                const oldRow = document.querySelector(
                    `[data-sot-recording-id="${oldId}"]`,
                );
                return oldRow
                    ? Boolean(
                          newRow.compareDocumentPosition(oldRow) &
                              Node.DOCUMENT_POSITION_FOLLOWING,
                      )
                    : false;
            }, OLD_RECORDING_ID),
        )
        .toBe(true);
}

test("manual dashboard sync posts, refreshes dashboard data, and prepends the newest recording", async ({
    page,
}) => {
    let userId: string | null = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToNewestChinese(page);
        await cleanupManualSyncSeeds(userId);
        await seedManualSyncRecording({
            id: OLD_RECORDING_ID,
            userId,
            title: OLD_RECORDING_TITLE,
            startTime: Date.now() - 10 * 60_000,
        });
        const getPostCount = await mockManualSyncEndpoint(page, userId);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(
            page.locator('[data-sot-surface="dashboard-workstation"]'),
        ).toHaveAttribute("data-sot-state", "ready");
        await expect(
            page.locator(`[data-sot-recording-id="${OLD_RECORDING_ID}"]`),
        ).toBeVisible();
        await expect(
            page.locator(`[data-sot-recording-id="${NEW_RECORDING_ID}"]`),
        ).toHaveCount(0);

        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response.url().includes("/api/data-sources/sync") &&
                    response.request().method() === "POST" &&
                    response.ok(),
            ),
            dashboardSyncButton(page).click(),
        ]);

        await expect(page.locator("[data-sonner-toaster]")).toHaveCount(0);
        const successToast = page
            .locator('.toast.toast-ok')
            .filter({ hasText: "同步完成" });
        await expect(successToast).toBeVisible();
        await expect(successToast).toHaveAttribute("data-open", "true");
        await expect(successToast.locator(".toast-ico svg")).toHaveCount(1);

        await expectNewRecordingBeforeOld(page);
        expect(getPostCount()).toBe(1);
    } finally {
        await cleanupManualSyncSeeds(userId ?? undefined);
    }
});

test("manual dashboard sync exposes SOT busy and error states without duplicate posts", async ({
    page,
}) => {
    let releasePost = () => {};
    const postGate = new Promise<void>((resolve) => {
        releasePost = resolve;
    });
    const getPostCount = await mockFailingManualSyncEndpoint(page, postGate);

    await ensureSignedIn(page);
    await resetDisplayToNewestChinese(page);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-sot-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-sot-state", "ready");

    const syncPanel = dashboardSyncPanel(page);
    const syncButton = dashboardSyncButton(page);
    await expect(syncPanel).toHaveAttribute("data-sot-state", "idle");
    await expect(syncButton).toBeEnabled();

    const syncRequest = page.waitForRequest(
        (request) =>
            request.url().includes("/api/data-sources/sync") &&
            request.method() === "POST",
    );
    await syncButton.click();
    await syncRequest;

    await expect(syncPanel).toHaveAttribute("data-sot-state", "running");
    await expect(syncButton).toBeDisabled();
    await expect(syncButton).toHaveAttribute("aria-busy", "true");

    await page.evaluate(() => {
        const button = document.querySelector<HTMLButtonElement>(
            'button[data-sot-control="dashboard-sync"]',
        );
        button?.click();
        button?.click();
    });
    expect(getPostCount()).toBe(1);

    const failedResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/data-sources/sync") &&
            response.request().method() === "POST" &&
            response.status() === 503,
    );
    releasePost();
    await failedResponse;

    await expect(syncPanel).toHaveAttribute("data-sot-state", "error");
    await expect(syncPanel).toContainText("PR20 manual sync failed");
    await expect(syncButton).toBeEnabled();
    await expect(syncButton).toHaveAttribute("aria-busy", "false");

    await page.locator('[data-sot-control="dashboard-activity"]').click();
    const activitySync = page.locator(
        '[data-sot-control="dashboard-activity-sync"]',
    );
    await expect(activitySync).toHaveAttribute("data-action-state", "error");
    await expect(activitySync).toHaveAttribute("data-sot-state", "error");
    expect(getPostCount()).toBe(1);
});
