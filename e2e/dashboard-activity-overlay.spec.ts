import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const ACTIVITY_RECORDING_ID = "e2e-activity-transcription";
const ACTIVITY_JOB_ID = "e2e-activity-transcription-job";

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

function databaseUrl(filePath: string) {
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");

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

async function cleanupActivityRecording() {
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

async function seedActivityRecording(userId: string) {
    const now = Date.now();
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        await cleanupActivityRecording();
        await library.execute({
            sql: `
                INSERT OR REPLACE INTO recordings (
                    id, user_id, source_provider, source_recording_id, source_version,
                    source_metadata, provider_device_id, filename, duration, start_time,
                    end_time, filesize, file_md5, storage_type, storage_path,
                    downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                ACTIVITY_RECORDING_ID,
                userId,
                "ticnote",
                "e2e-activity-source",
                "1",
                "{}",
                "e2e-activity-device",
                "E2E activity transcription",
                120_000,
                now - 120_000,
                now,
                2048,
                "e2e-activity",
                "local",
                "e2e/activity.mp3",
                now,
                0,
                0,
                now,
                now,
            ],
        });
        await library.execute({
            sql: `
                INSERT OR REPLACE INTO transcription_jobs (
                    id, user_id, recording_id, status, force, provider, model,
                    provider_job_id, remote_status, attempts, last_error,
                    requested_at, started_at, completed_at, next_poll_at,
                    created_at, updated_at
                ) VALUES (?, ?, ?, 'processing', 0, 'voice-transcribe', 'e2e',
                    'remote-e2e-activity', 'transcribing', 1, NULL,
                    ?, ?, NULL, ?, ?, ?)
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

function unhealthyWorkerStatus() {
    const now = new Date();

    return {
        autoSyncEnabled: true,
        lastSyncTime: now.toISOString(),
        nextSyncTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        workerStatus: {
            healthy: false,
            isRunning: false,
            lastHeartbeatAt: new Date(
                now.getTime() - 2 * 60 * 1000,
            ).toISOString(),
            lastStartedAt: null,
            lastFinishedAt: null,
            nextRunAt: null,
            manualTriggerRequestedAt: null,
            lastError: "本地更新服务未响应。",
            lastSummary: null,
        },
    };
}

function healthyWorkerStatus(options: { running?: boolean } = {}) {
    const now = new Date();

    return {
        autoSyncEnabled: true,
        lastSyncTime: now.toISOString(),
        nextSyncTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        workerStatus: {
            healthy: true,
            isRunning: options.running ?? false,
            lastHeartbeatAt: now.toISOString(),
            lastStartedAt: options.running ? now.toISOString() : null,
            lastFinishedAt: options.running ? null : now.toISOString(),
            nextRunAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
            manualTriggerRequestedAt: null,
            lastError: null,
            lastSummary: {
                newRecordings: 0,
                updatedRecordings: 0,
                removedRecordings: 0,
                errorCount: 0,
            },
        },
    };
}

async function mockSyncEndpoint(page: Page, releasePost: Promise<void>) {
    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() === "POST") {
            await releasePost;
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    success: true,
                    queued: true,
                    newRecordings: 0,
                }),
            });
            return;
        }

        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(unhealthyWorkerStatus()),
            });
            return;
        }

        await route.continue();
    });
}

async function resetDisplaySettings(
    page: Page,
    overrides: Record<string, unknown> = {},
) {
    const resetResponse = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "system",
            uiLanguage: "zh-CN",
            ...overrides,
        },
    });
    expect(resetResponse.ok()).toBe(true);
}

test("activity overlay opens data source settings for worker-down notifications", async ({
    page,
}) => {
    await mockSyncEndpoint(page, Promise.resolve());

    await ensureSignedIn(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const trigger = page.getByTestId("dashboard-activity-trigger");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-label", /1 项待处理/);

    await trigger.click();
    const panel = page.getByTestId("dashboard-activity-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS("z-index", "220");

    const item = panel.locator('[data-activity-id="worker-unavailable"]');
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute("data-action-state", "idle");

    const action = item.getByTestId("dashboard-activity-action");
    await expect(item).toHaveAttribute("data-activity-action", "settings");
    await expect(action).toContainText("前往数据源设置");
    await action.click();

    const settingsShell = page.locator("[data-settings-shell]");
    await expect(panel).toBeHidden();
    await expect(settingsShell).toBeVisible();
    await expect(settingsShell).toHaveAttribute(
        "data-settings-active-section",
        "data-sources",
    );

    await page.getByTestId("settings-close").click();
    await expect(settingsShell).toBeHidden();
    await expect(page.getByTestId("dashboard-settings-trigger")).toBeFocused();
});

test("activity overlay dismisses actionable notifications into an empty state", async ({
    page,
}) => {
    await mockSyncEndpoint(page, Promise.resolve());

    await ensureSignedIn(page);
    await resetDisplaySettings(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const trigger = page.getByTestId("dashboard-activity-trigger");
    await expect(trigger).toHaveAttribute("aria-label", /1 项待处理/);

    await trigger.click();
    const panel = page.getByTestId("dashboard-activity-panel");
    await expect(panel).toHaveAttribute("data-state", "error");
    await expect(panel).toContainText("1 项待处理");

    const item = panel.locator('[data-activity-id="worker-unavailable"]');
    await expect(item).toBeVisible();
    await item.getByTestId("dashboard-activity-dismiss").click();

    await expect(item).toHaveCount(0);
    await expect(panel).toHaveAttribute("data-state", "empty");
    await expect(panel).toContainText("全部已处理");
    await expect(page.getByTestId("dashboard-activity-empty")).toBeVisible();
    await expect(page.getByTestId("dashboard-activity-list")).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-label", "打开最近动态");
    await expect(
        trigger.locator(".absolute.rounded-full"),
    ).toHaveCount(0);
});

test("activity overlay exposes default empty and syncing states without layout jumps", async ({
    page,
}) => {
    let statusMode: "empty" | "syncing" = "empty";
    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(
                healthyWorkerStatus({ running: statusMode === "syncing" }),
            ),
        });
    });

    await ensureSignedIn(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const trigger = page.getByTestId("dashboard-activity-trigger");
    const panel = page.getByTestId("dashboard-activity-panel");

    await trigger.click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-state", "empty");
    const emptyBox = page.getByTestId("dashboard-activity-empty");
    await expect(emptyBox).toBeVisible();
    const emptyBoxHeight = await emptyBox.evaluate((node) =>
        node.getBoundingClientRect().height,
    );
    expect(emptyBoxHeight).toBeGreaterThan(120);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();

    statusMode = "syncing";
    await page.reload({ waitUntil: "domcontentloaded" });

    const syncingTrigger = page.getByTestId("dashboard-activity-trigger");
    await syncingTrigger.click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-state", "loading");
    await expect(page.getByTestId("dashboard-activity-status")).toHaveAttribute(
        "data-state",
        "loading",
    );
    await expect(page.getByTestId("dashboard-activity-loading")).toContainText(
        "正在更新来源",
    );
    await expect(panel).toHaveCSS("z-index", "220");
});

test("activity overlay opens transcription items and runs the status sync action", async ({
    page,
}) => {
    let releasePost = () => {};
    const pendingPost = new Promise<void>((resolve) => {
        releasePost = resolve;
    });
    await mockSyncEndpoint(page, pendingPost);

    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    try {
        await seedActivityRecording(userId);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        const trigger = page.getByTestId("dashboard-activity-trigger");
        await trigger.click();
        const panel = page.getByTestId("dashboard-activity-panel");
        await expect(panel).toBeVisible();

        const item = panel.locator(
            `[data-activity-id="transcription-active-${ACTIVITY_RECORDING_ID}"]`,
        );
        await expect(item).toBeVisible();
        await expect(item).toHaveAttribute("data-clickable", "true");
        await item.getByTestId("dashboard-activity-action").click();
        await expect(panel).toBeHidden();
        await expect(page.getByTestId("dashboard-recording-title")).toContainText(
            "E2E activity transcription",
        );

        await trigger.click();
        await expect(panel).toBeVisible();
        const statusAction = page.getByTestId("dashboard-activity-sync-action");
        const syncPostRequest = page.waitForRequest(
            (request) =>
                request.url().includes("/api/data-sources/sync") &&
                request.method() === "POST",
        );
        await statusAction.click();
        await syncPostRequest;
        await expect(statusAction).toHaveAttribute("data-action-state", "busy");
        releasePost();
        await expect(statusAction).toHaveAttribute("data-action-state", "done");
        await expect(page.getByTestId("dashboard-activity-status")).toContainText(
            "已加入更新",
        );
    } finally {
        await cleanupActivityRecording();
    }
});

test("activity overlay follows display language for panel and status copy", async ({
    page,
}) => {
    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(healthyWorkerStatus()),
        });
    });

    await ensureSignedIn(page);
    await resetDisplaySettings(page, { uiLanguage: "en" });

    try {
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        const trigger = page.getByRole("button", {
            name: "Open recent activity",
        });
        await expect(trigger).toBeVisible();
        await trigger.click();

        const panel = page.getByTestId("dashboard-activity-panel");
        await expect(panel).toHaveAttribute("aria-label", "Recent activity");
        await expect(
            panel.getByRole("heading", { name: "Recent activity" }),
        ).toBeVisible();
        await expect(panel).toContainText("All handled");
        await expect(page.getByTestId("dashboard-activity-status")).toContainText(
            "Last updated",
        );
        await expect(page.getByTestId("dashboard-activity-sync-action")).toHaveText(
            "Update",
        );
        await expect(page.getByTestId("dashboard-activity-empty")).toContainText(
            "No new activity",
        );
    } finally {
        await resetDisplaySettings(page);
    }
});
