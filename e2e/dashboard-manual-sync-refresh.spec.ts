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

function dashboardSyncButton(page: Page) {
    return page.getByRole("button", { name: "同步", exact: true });
}

function dashboardRecordingRow(page: Page, recordingId: string) {
    return page.locator(
        `button[data-control="dashboard-recording-row"][data-recording-id="${recordingId}"]`,
    );
}

async function expectNewRecordingBeforeOld(page: Page) {
    const newRecording = dashboardRecordingRow(page, NEW_RECORDING_ID);
    const oldRecording = dashboardRecordingRow(page, OLD_RECORDING_ID);

    await expect(newRecording).toBeVisible();
    await expect(newRecording).toContainText(NEW_RECORDING_TITLE);
    await expect(oldRecording).toBeVisible();
    await expect(oldRecording).toContainText(OLD_RECORDING_TITLE);

    await expect.poll(async () => {
        const [newBox, oldBox] = await Promise.all([
            newRecording.boundingBox(),
            oldRecording.boundingBox(),
        ]);
        return Boolean(newBox && oldBox && newBox.y < oldBox.y);
    }).toBe(true);
}

type SyncWorkerStateMode =
    | "error"
    | "permission-denied"
    | "queued"
    | "running"
    | "success";

type SyncWorkerStateSnapshot = {
    createdAt: number;
    id: string;
    isRunning: number;
    lastError: string | null;
    lastFinishedAt: number | null;
    lastHeartbeatAt: number | null;
    lastStartedAt: number | null;
    lastSummary: string | null;
    manualTriggerRequestedAt: number | null;
    nextRunAt: number | null;
    updatedAt: number;
    userId: string;
} | null;

async function snapshotSyncWorkerState(userId: string) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await core.execute({
            sql: `
                SELECT id, user_id, last_heartbeat_at, last_started_at,
                    last_finished_at, next_run_at, manual_trigger_requested_at,
                    is_running, last_error, last_summary, created_at, updated_at
                FROM sync_worker_state
                WHERE user_id = ?
                LIMIT 1
            `,
            args: [userId],
        });
        const row = result.rows[0];
        if (!row) return null;
        return {
            createdAt: Number(row.created_at),
            id: String(row.id),
            isRunning: Number(row.is_running),
            lastError: row.last_error === null ? null : String(row.last_error),
            lastFinishedAt:
                row.last_finished_at === null
                    ? null
                    : Number(row.last_finished_at),
            lastHeartbeatAt:
                row.last_heartbeat_at === null
                    ? null
                    : Number(row.last_heartbeat_at),
            lastStartedAt:
                row.last_started_at === null
                    ? null
                    : Number(row.last_started_at),
            lastSummary:
                row.last_summary === null ? null : String(row.last_summary),
            manualTriggerRequestedAt:
                row.manual_trigger_requested_at === null
                    ? null
                    : Number(row.manual_trigger_requested_at),
            nextRunAt:
                row.next_run_at === null ? null : Number(row.next_run_at),
            updatedAt: Number(row.updated_at),
            userId: String(row.user_id),
        } satisfies Exclude<SyncWorkerStateSnapshot, null>;
    } finally {
        await core.close();
    }
}

async function restoreSyncWorkerState(
    userId: string,
    snapshot: SyncWorkerStateSnapshot,
) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        await executeWithBusyRetry(() =>
            core.execute({
                sql: "DELETE FROM sync_worker_state WHERE user_id = ?",
                args: [userId],
            }),
        );
        if (!snapshot) return;
        await executeWithBusyRetry(() =>
            core.execute({
                sql: `
                    INSERT INTO sync_worker_state (
                        id, user_id, last_heartbeat_at, last_started_at,
                        last_finished_at, next_run_at, manual_trigger_requested_at,
                        is_running, last_error, last_summary, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    snapshot.id,
                    snapshot.userId,
                    snapshot.lastHeartbeatAt,
                    snapshot.lastStartedAt,
                    snapshot.lastFinishedAt,
                    snapshot.nextRunAt,
                    snapshot.manualTriggerRequestedAt,
                    snapshot.isRunning,
                    snapshot.lastError,
                    snapshot.lastSummary,
                    snapshot.createdAt,
                    snapshot.updatedAt,
                ],
            }),
        );
    } finally {
        await core.close();
    }
}

async function seedSyncWorkerState(
    userId: string,
    mode: SyncWorkerStateMode,
) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const now = Date.now();
    const isRunning = mode === "running";
    const isQueued = mode === "queued";
    const lastError =
        mode === "error"
            ? "E2E real manual sync failure"
            : mode === "permission-denied"
              ? "EACCES: permission denied, scandir source cache"
              : null;

    try {
        await executeWithBusyRetry(() =>
            core.execute({
                sql: `
                    INSERT INTO sync_worker_state (
                        id, user_id, last_heartbeat_at, last_started_at,
                        last_finished_at, next_run_at, manual_trigger_requested_at,
                        is_running, last_error, last_summary, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        last_heartbeat_at = excluded.last_heartbeat_at,
                        last_started_at = excluded.last_started_at,
                        last_finished_at = excluded.last_finished_at,
                        next_run_at = excluded.next_run_at,
                        manual_trigger_requested_at = excluded.manual_trigger_requested_at,
                        is_running = excluded.is_running,
                        last_error = excluded.last_error,
                        last_summary = excluded.last_summary,
                        updated_at = excluded.updated_at
                `,
                args: [
                    `${SYNC_RECORDING_PREFIX}worker`,
                    userId,
                    now,
                    isRunning ? now : now - 1_000,
                    isRunning ? null : now,
                    now + 300_000,
                    isQueued ? now : null,
                    isRunning ? 1 : 0,
                    lastError,
                    JSON.stringify({
                        newRecordings: 0,
                        updatedRecordings: 0,
                        removedRecordings: 0,
                        errorCount: mode === "error" ? 1 : 0,
                    }),
                    now,
                    now,
                ],
            }),
        );

        if (mode === "success") {
            await executeWithBusyRetry(() =>
                core.execute({
                    sql: "UPDATE sync_worker_state SET last_heartbeat_at = ? WHERE user_id = ?",
                    args: [now, userId],
                }),
            );
        }
    } finally {
        await core.close();
    }
}

async function reloadDashboardWithRealSyncStatus(page: Page) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-state", "ready");
    const response = await page.request.get("/api/data-sources/sync");
    expect(response.ok()).toBe(true);
    return response.json();
}

test("manual dashboard sync refreshes real dashboard data through the real status API", async ({
    page,
}) => {
    let userId: string | null = null;
    let workerState: SyncWorkerStateSnapshot = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        workerState = await snapshotSyncWorkerState(userId);
        await resetDisplayToNewestChinese(page);
        await cleanupManualSyncSeeds(userId);
        await seedManualSyncRecording({
            id: OLD_RECORDING_ID,
            userId,
            title: OLD_RECORDING_TITLE,
            startTime: Date.now() - 10 * 60_000,
        });
        await seedSyncWorkerState(userId, "success");

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(
            page.locator('[data-surface="dashboard-workstation"]'),
        ).toHaveAttribute("data-state", "ready");
        await expect(
            dashboardRecordingRow(page, OLD_RECORDING_ID),
        ).toBeVisible();
        await expect(
            dashboardRecordingRow(page, NEW_RECORDING_ID),
        ).toHaveCount(0);

        await seedManualSyncRecording({
            id: NEW_RECORDING_ID,
            userId,
            title: NEW_RECORDING_TITLE,
            startTime: Date.now() + 60_000,
        });
        const status = await reloadDashboardWithRealSyncStatus(page);
        expect(status).toMatchObject({
            workerStatus: { healthy: true, isRunning: false },
        });

        await expectNewRecordingBeforeOld(page);
    } finally {
        await cleanupManualSyncSeeds(userId ?? undefined);
        if (userId) {
            await restoreSyncWorkerState(userId, workerState);
        }
    }
});

test("manual dashboard sync uses the real POST and renders real failed, queued, and running states", async ({
    page,
}) => {
    let userId: string | null = null;
    let workerState: SyncWorkerStateSnapshot = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        workerState = await snapshotSyncWorkerState(userId);
        await resetDisplayToNewestChinese(page);
        await seedSyncWorkerState(userId, "success");

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await expect(
            page.locator('[data-surface="dashboard-workstation"]'),
        ).toHaveAttribute("data-state", "ready");

        const syncButton = dashboardSyncButton(page);
        await expect(syncButton).toHaveAccessibleDescription(
            /更新 · BetterAINote/,
        );
        await expect(syncButton).toBeEnabled();
        await expect(syncButton).toHaveAttribute("aria-busy", "false");

        const postResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources/sync") &&
                response.request().method() === "POST",
        );
        await syncButton.click();
        const response = await postResponse;
        expect(response.status()).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            code: "INVALID_INPUT",
            error: "No data source configured",
        });
        await expect(syncButton).toHaveAccessibleDescription(
            /重试 · BetterAINote/,
        );
        await expect(syncButton).toBeEnabled();
        await expect(syncButton).toHaveAttribute("aria-busy", "false");

        await seedSyncWorkerState(userId, "error");
        const failedStatus = await reloadDashboardWithRealSyncStatus(page);
        expect(failedStatus).toMatchObject({
            workerStatus: {
                healthy: true,
                isRunning: false,
                lastError: expect.any(String),
                lastSummary: { errorCount: 1 },
            },
        });
        await expect(syncButton).toHaveAccessibleDescription(
            /重试 · BetterAINote/,
        );
        await expect(syncButton).toBeEnabled();
        await expect(syncButton).toHaveAttribute("aria-busy", "false");

        await seedSyncWorkerState(userId, "queued");
        expect(await snapshotSyncWorkerState(userId)).toMatchObject({
            isRunning: 0,
            manualTriggerRequestedAt: expect.any(Number),
        });
        const queuedStatus = await reloadDashboardWithRealSyncStatus(page);
        expect(queuedStatus).toMatchObject({
            workerStatus: {
                healthy: true,
                isRunning: false,
                manualTriggerRequestedAt: expect.any(String),
            },
        });
        await expect(syncButton).toHaveAccessibleDescription(
            /已加入更新 · BetterAINote/,
        );
        await expect(syncButton).toBeDisabled();
        await expect(syncButton).toHaveAttribute("aria-busy", "true");

        await reloadDashboardWithRealSyncStatus(page);
        await expect(syncButton).toHaveAccessibleDescription(
            /已加入更新 · BetterAINote/,
        );
        await expect(syncButton).toBeDisabled();
        await expect(syncButton).toHaveAttribute("aria-busy", "true");

        await seedSyncWorkerState(userId, "running");
        expect(await snapshotSyncWorkerState(userId)).toMatchObject({
            isRunning: 1,
            manualTriggerRequestedAt: null,
        });
        const runningStatus = await reloadDashboardWithRealSyncStatus(page);
        expect(runningStatus).toMatchObject({
            workerStatus: {
                healthy: true,
                isRunning: true,
                manualTriggerRequestedAt: null,
            },
        });
        await expect(syncButton).toHaveAccessibleDescription(
            /更新中 · BetterAINote/,
        );
        await expect(syncButton).toBeDisabled();
        await expect(syncButton).toHaveAttribute("aria-busy", "true");

        await seedSyncWorkerState(userId, "success");
        expect(await snapshotSyncWorkerState(userId)).toMatchObject({
            isRunning: 0,
            manualTriggerRequestedAt: null,
        });
        const completedStatus =
            await reloadDashboardWithRealSyncStatus(page);
        expect(completedStatus).toMatchObject({
            workerStatus: {
                isRunning: false,
                manualTriggerRequestedAt: null,
                lastError: null,
                lastSummary: { errorCount: 0 },
            },
        });
        await expect(syncButton).toHaveAccessibleDescription(
            /更新 · BetterAINote/,
        );
        await expect(syncButton).toBeEnabled();
        await expect(syncButton).toHaveAttribute("aria-busy", "false");
    } finally {
        if (userId) {
            await restoreSyncWorkerState(userId, workerState);
        }
    }
});
