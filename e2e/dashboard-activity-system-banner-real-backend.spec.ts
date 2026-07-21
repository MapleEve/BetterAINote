import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test, type Page, type Response } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_ROOT = path.resolve(
    process.env.PLAYWRIGHT_E2E_ROOT ?? path.join(process.cwd(), "tmp/e2e"),
);
const CORE_DB = path.join(E2E_ROOT, "data", "betterainote-e2e.db");
const LIBRARY_DB = path.join(E2E_ROOT, "data", "betterainote-e2e-library.db");
const PLAYWRIGHT_USER_EMAIL = "playwright-admin@example.com";
const ACTIVITY_RECORDING_ID = "e2e-activity-system-banner-recording";
const ACTIVITY_JOB_ID = "e2e-activity-system-banner-job";

type WorkerStateSnapshot = {
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

function databaseUrl(databasePath: string) {
    const resolved = path.resolve(databasePath);
    if (resolved !== E2E_ROOT && !resolved.startsWith(`${E2E_ROOT}${path.sep}`)) {
        throw new Error(`Refusing to access database outside E2E root: ${resolved}`);
    }
    return pathToFileURL(resolved).href;
}

async function getPlaywrightUserId() {
    const core = createClient({ url: databaseUrl(CORE_DB) });
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

async function snapshotWorkerState(userId: string): Promise<WorkerStateSnapshot> {
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
                row.last_started_at === null ? null : Number(row.last_started_at),
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
        };
    } finally {
        await core.close();
    }
}

async function restoreWorkerState(userId: string, snapshot: WorkerStateSnapshot) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        await core.execute({
            sql: "DELETE FROM sync_worker_state WHERE user_id = ?",
            args: [userId],
        });
        if (!snapshot) return;
        await core.execute({
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
        });
    } finally {
        await core.close();
    }
}

async function seedWorkerState(
    userId: string,
    options: {
        lastError?: string | null;
        lastSummary?: {
            errorCount: number;
            newRecordings: number;
            removedRecordings: number;
            updatedRecordings: number;
        } | null;
        manualTriggerRequested?: boolean;
        running?: boolean;
        stale?: boolean;
    },
) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const now = Date.now();
    const heartbeatAt = options.stale ? now - 180_000 : now;
    const running = options.running ?? false;
    try {
        await core.execute({
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
                "e2e-activity-system-banner-worker",
                userId,
                heartbeatAt,
                running ? now : now - 1_000,
                running ? null : now,
                now + 300_000,
                options.manualTriggerRequested ? now : null,
                running ? 1 : 0,
                options.lastError ?? null,
                options.lastSummary ? JSON.stringify(options.lastSummary) : null,
                now,
                now,
            ],
        });
    } finally {
        await core.close();
    }
}

async function seedActiveRecording(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    try {
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE id = ? OR recording_id = ?",
            args: [ACTIVITY_JOB_ID, ACTIVITY_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE id = ?",
            args: [ACTIVITY_RECORDING_ID],
        });
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
                ACTIVITY_RECORDING_ID,
                userId,
                "ticnote",
                `${ACTIVITY_RECORDING_ID}-source`,
                "1",
                "{}",
                "e2e-activity-device",
                "E2E Activity progress",
                120_000,
                now - 120_000,
                now,
                2_048,
                ACTIVITY_RECORDING_ID,
                "local",
                "",
                null,
                0,
                0,
                now,
                now,
            ],
        });
        await library.execute({
            sql: `
                INSERT INTO transcription_jobs (
                    id, user_id, recording_id, status, force, provider,
                    model, provider_job_id, remote_status, attempts,
                    last_error, requested_at, started_at, completed_at,
                    next_poll_at, created_at, updated_at
                ) VALUES (?, ?, ?, 'processing', 0, 'voice-transcribe',
                    'e2e', 'e2e-activity-remote-job', 'transcribing', 1,
                    NULL, ?, ?, NULL, ?, ?, ?)
            `,
            args: [
                ACTIVITY_JOB_ID,
                userId,
                ACTIVITY_RECORDING_ID,
                now - 60_000,
                now - 45_000,
                now + 60_000,
                now - 60_000,
                now,
            ],
        });
    } finally {
        await library.close();
    }
}

async function clearActiveRecording() {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE id = ? OR recording_id = ?",
            args: [ACTIVITY_JOB_ID, ACTIVITY_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE id = ?",
            args: [ACTIVITY_RECORDING_ID],
        });
    } finally {
        await library.close();
    }
}

function systemBanner(page: Page, state: string) {
    return page.locator(`[data-control="system-banner"][data-state="${state}"]`);
}

function activityItem(page: Page, id: string) {
    return page.locator(
        `[data-item="dashboard-activity-item"][data-activity-id="${id}"]`,
    );
}

async function openDashboard(page: Page) {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-state", "ready");
}

async function openActivity(page: Page) {
    await page.locator('[data-control="dashboard-activity"]').click();
    await expect(page.locator('[data-panel="dashboard-activity"]')).toBeVisible();
}

function isManualSyncPost(response: Response) {
    return (
        new URL(response.url()).pathname === "/api/data-sources/sync" &&
        response.request().method() === "POST"
    );
}

function waitForManualSyncPost(page: Page) {
    return page.waitForResponse(
        (response) =>
            isManualSyncPost(response) && response.request().postData() === null,
    );
}

test("Activity and system banner render real SQLite worker states", async ({
    page,
}) => {
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    const workerState = await snapshotWorkerState(userId);

    try {
        await seedWorkerState(userId, {
            lastError: "Worker runtime unavailable while starting source sync",
        });
        await openDashboard(page);
        await expect(systemBanner(page, "runtime-unavailable")).toBeVisible();

        await seedWorkerState(userId, { lastError: "database is locked" });
        await openDashboard(page);
        await expect(systemBanner(page, "db-locked")).toBeVisible();

        await seedWorkerState(userId, { manualTriggerRequested: true });
        await openDashboard(page);
        await openActivity(page);
        await expect(activityItem(page, "source-sync-queued")).toBeVisible();
        await expect(activityItem(page, "source-sync-running")).toHaveCount(0);

        await seedWorkerState(userId, { running: true });
        await openDashboard(page);
        await openActivity(page);
        await expect(activityItem(page, "source-sync-running")).toBeVisible();

        await seedWorkerState(userId, {
            lastSummary: {
                errorCount: 0,
                newRecordings: 2,
                removedRecordings: 1,
                updatedRecordings: 3,
            },
        });
        await openDashboard(page);
        await openActivity(page);
        await expect(activityItem(page, "source-sync-summary")).toContainText(
            "新增 2，更新 3，移除 1。",
        );

        await page.context().setOffline(true);
        await expect(systemBanner(page, "offline")).toBeVisible();
        await page.context().setOffline(false);
        await expect(systemBanner(page, "offline")).toHaveCount(0);
    } finally {
        await page.context().setOffline(false);
        await restoreWorkerState(userId, workerState);
    }
});

test("Activity actions and banner actions use real dashboard manual-sync POSTs", async ({
    page,
}) => {
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    const workerState = await snapshotWorkerState(userId);
    const manualSyncResponses: Response[] = [];
    const captureManualSyncPost = (response: Response) => {
        if (isManualSyncPost(response)) {
            manualSyncResponses.push(response);
        }
    };
    page.on("response", captureManualSyncPost);

    try {
        await seedActiveRecording(userId);
        await seedWorkerState(userId, {
            lastError: "Worker runtime unavailable while starting source sync",
        });
        await openDashboard(page);
        await expect(
            page.locator('[data-surface="dashboard-recording-player"]'),
        ).toHaveAttribute("data-no-audio", "true");
        await expect(systemBanner(page, "runtime-unavailable")).toBeVisible();

        const retrySyncResponse = waitForManualSyncPost(page);
        await systemBanner(page, "runtime-unavailable")
            .getByRole("button", { name: "重试同步", exact: true })
            .click();
        expect((await retrySyncResponse).status()).toBe(400);

        await openActivity(page);
        const retryItem = activityItem(page, "source-sync-error");
        await expect(retryItem).toBeVisible();
        const immediateUpdateButton = page.locator(
            '[data-control="dashboard-activity-sync"]',
        );
        await expect(immediateUpdateButton).toBeVisible();
        await expect(immediateUpdateButton).toHaveText("更新");
        const immediateUpdateResponse = waitForManualSyncPost(page);
        await immediateUpdateButton.click();
        expect((await immediateUpdateResponse).status()).toBe(400);

        const noAudioPlayer = page.locator(
            '[data-surface="dashboard-recording-player"][data-no-audio="true"]',
        );
        const retryButton = retryItem.getByRole("button", {
            name: "重试",
            exact: true,
        });
        await expect(noAudioPlayer).toBeVisible();
        await expect(retryButton).toBeVisible();
        const [playerBox, retryButtonBox] = await Promise.all([
            noAudioPlayer.boundingBox(),
            retryButton.boundingBox(),
        ]);
        if (!playerBox || !retryButtonBox) {
            throw new Error(
                `Expected visible Activity retry and no-audio player boxes; player=${JSON.stringify(playerBox)}, retry=${JSON.stringify(retryButtonBox)}`,
            );
        }
        const intersectionLeft = Math.max(playerBox.x, retryButtonBox.x);
        const intersectionTop = Math.max(playerBox.y, retryButtonBox.y);
        const intersectionRight = Math.min(
            playerBox.x + playerBox.width,
            retryButtonBox.x + retryButtonBox.width,
        );
        const intersectionBottom = Math.min(
            playerBox.y + playerBox.height,
            retryButtonBox.y + retryButtonBox.height,
        );
        if (
            intersectionRight <= intersectionLeft ||
            intersectionBottom <= intersectionTop
        ) {
            throw new Error(
                `Expected Activity retry to overlap the no-audio player in both axes; player=${JSON.stringify(playerBox)}, retry=${JSON.stringify(retryButtonBox)}`,
            );
        }
        const retryResponse = waitForManualSyncPost(page);
        await retryButton.click({
            position: {
                x: (intersectionLeft + intersectionRight) / 2 - retryButtonBox.x,
                y: (intersectionTop + intersectionBottom) / 2 - retryButtonBox.y,
            },
        });
        expect((await retryResponse).status()).toBe(400);

        await seedWorkerState(userId, { lastError: "database is locked" });
        await openDashboard(page);
        const reconnectResponse = waitForManualSyncPost(page);
        await systemBanner(page, "db-locked")
            .getByRole("button", { name: "重新连接", exact: true })
            .click();
        expect((await reconnectResponse).status()).toBe(400);
        expect(manualSyncResponses).toHaveLength(4);
        for (const response of manualSyncResponses) {
            expect(response.request().postData()).toBeNull();
            expect(response.status()).toBe(400);
        }

        await openActivity(page);
        const progressItem = activityItem(
            page,
            `transcription-active-${ACTIVITY_RECORDING_ID}`,
        );
        await expect(progressItem).toBeVisible();
        await progressItem
            .getByRole("button", { name: "查看", exact: true })
            .click();
        await expect(page.locator('[data-panel="dashboard-activity"]')).toHaveCount(0);
        await expect(
            page.getByRole("heading", { name: "E2E Activity progress" }),
        ).toBeVisible();

        await seedWorkerState(userId, { stale: true });
        await openDashboard(page);
        await openActivity(page);
        const settingsItem = activityItem(page, "worker-unavailable");
        await expect(settingsItem).toBeVisible();
        await settingsItem
            .getByRole("button", { name: "前往数据源设置", exact: true })
            .click();
        await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible();
        await expect(
            page.getByRole("button", { name: "数据源", exact: true }),
        ).toHaveAttribute("aria-current", "page");

        await seedWorkerState(userId, {
            lastError: "Worker runtime unavailable while starting source sync",
        });
        await openDashboard(page);
        await page.context().setOffline(true);
        await expect(systemBanner(page, "runtime-unavailable")).toBeVisible();
        await expect(systemBanner(page, "offline")).toBeVisible();
        await systemBanner(page, "runtime-unavailable")
            .getByRole("button", { name: "收起", exact: true })
            .click();
        await expect(systemBanner(page, "runtime-unavailable")).toHaveCount(0);
        await expect(systemBanner(page, "offline")).toBeVisible();
    } finally {
        page.off("response", captureManualSyncPost);
        await page.context().setOffline(false);
        await clearActiveRecording();
        await restoreWorkerState(userId, workerState);
    }
});
