import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const LIST_RECORDING_PREFIX = "e2e-list-state-";

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
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");

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

async function cleanupListSeeds(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM source_artifact_segments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcript_segments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM recording_tag_assignments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${LIST_RECORDING_PREFIX}%`],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function cleanupAllUserRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM source_artifact_segments WHERE user_id = ?",
            args: [userId],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcript_segments WHERE user_id = ?",
            args: [userId],
        });
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE user_id = ?",
            args: [userId],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM recording_tag_assignments WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ?",
            args: [userId],
        });
        await library.execute({
            sql: "DELETE FROM source_devices WHERE user_id = ?",
            args: [userId],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedListRecordings(userId: string, count = 10) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();

    try {
        await cleanupListSeeds(userId);
        for (let index = 0; index < count; index += 1) {
            const suffix = String(index + 1).padStart(2, "0");
            const recordingId = `${LIST_RECORDING_PREFIX}${suffix}`;
            const start = now - index * 90_000;

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
                    recordingId,
                    userId,
                    "ticnote",
                    `${recordingId}-source`,
                    "1",
                    "{}",
                    "e2e-list-device",
                    `E2E list pagination ${suffix}`,
                    120_000 + index * 1000,
                    start,
                    start + 120_000,
                    2048 + index,
                    recordingId,
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

async function seedTimelineFilterRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    const todayStart = now - 30 * 60_000;
    const earlierStart = now - 12 * 86_400_000;

    try {
        await cleanupListSeeds(userId);
        for (const recording of [
            {
                id: `${LIST_RECORDING_PREFIX}today-ticnote`,
                filename: "E2E timeline today TicNote",
                sourceProvider: "ticnote",
                start: todayStart,
            },
            {
                id: `${LIST_RECORDING_PREFIX}earlier-plaud`,
                filename: "E2E timeline earlier Plaud",
                sourceProvider: "plaud",
                start: earlierStart,
            },
        ]) {
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
                    recording.id,
                    userId,
                    recording.sourceProvider,
                    `${recording.id}-source`,
                    "1",
                    "{}",
                    "e2e-list-device",
                    recording.filename,
                    120_000,
                    recording.start,
                    recording.start + 120_000,
                    2048,
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

async function resetDisplay(
    page: Page,
    options: {
        theme?: "system" | "light" | "dark";
        uiLanguage?: "zh-CN" | "en";
    } = {},
) {
    const resetResponse = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: options.theme ?? "system",
            uiLanguage: options.uiLanguage ?? "zh-CN",
        },
    });
    expect(resetResponse.ok()).toBe(true);
}

async function mockConnectedDataSources(page: Page) {
    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        const capabilities = {
            audioDownload: true,
            localRename: true,
            officialSummary: true,
            officialTranscript: true,
            privateTranscribe: true,
            upstreamTitleWriteback: false,
            workerSync: true,
        };
        const labels: Record<string, string> = {
            "dingtalk-a1": "钉钉",
            "feishu-minutes": "飞书妙记",
            iflyrec: "讯飞听见",
            plaud: "Plaud",
            ticnote: "TicNote",
        };
        const connectedProviders = new Set(["ticnote", "plaud"]);

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                sources: [
                    "dingtalk-a1",
                    "ticnote",
                    "plaud",
                    "feishu-minutes",
                    "iflyrec",
                ].map((provider) => ({
                    authMode: "bearer",
                    authModes: ["bearer"],
                    baseUrl: "https://example.invalid",
                    capabilities,
                    config: {},
                    connected: connectedProviders.has(provider),
                    connectionStatus: "ready",
                    displayName: labels[provider] ?? provider,
                    enabled: connectedProviders.has(provider),
                    lastSync: null,
                    provider,
                    runtimeStatus: "active",
                    secretsConfigured: connectedProviders.has(provider)
                        ? { bearerToken: true }
                        : {},
                })),
            }),
        });
    });
}

async function expectNoHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(2);
}

test("recording list paginates without leaking tweak controls across dark, light, and mobile states", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { theme: "dark" });

    const userId = await getPlaywrightUserId();
    await seedListRecordings(userId);

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = page.getByRole("main").getByTestId("recording-list-panel");
    await expect(panel).toHaveAttribute("data-list-state", "ready");
    await expect(panel).toHaveAttribute("data-current-page", "1");
    await expect(panel).toHaveAttribute("data-total-pages", "2");
    await expect(panel).toHaveAttribute("data-visible-count", "8");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByText("Tweaks", { exact: true })).toHaveCount(0);
    await expect(page.getByText("调试", { exact: true })).toHaveCount(0);

    await expect(page.getByTestId("recording-list-prev-page")).toBeDisabled();
    await expect(page.getByTestId("recording-list-next-page")).toBeEnabled();
    await expect(page.getByTestId("recording-list-page-status")).toContainText(
        "1 / 2 页",
    );
    await expect(page.getByTestId("recording-list-item")).toHaveCount(8);
    await expect(
        page.locator('[data-recording-id="e2e-list-state-01"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-recording-id="e2e-list-state-09"]'),
    ).toHaveCount(0);

    await page.getByTestId("recording-list-next-page").click();
    await expect(panel).toHaveAttribute("data-current-page", "2");
    await expect(panel).toHaveAttribute("data-visible-count", "2");
    await expect(page.getByTestId("recording-list-prev-page")).toBeEnabled();
    await expect(page.getByTestId("recording-list-next-page")).toBeDisabled();
    await expect(page.getByTestId("recording-list-page-status")).toContainText(
        "2 / 2 页",
    );
    await expect(
        page.locator('[data-recording-id="e2e-list-state-09"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-recording-id="e2e-list-state-10"]'),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("dashboard-source-drawer-trigger")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await resetDisplay(page, { theme: "light" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(panel).toHaveAttribute("data-list-state", "ready");
    await expectNoHorizontalOverflow(page);

    await cleanupListSeeds(userId);
});

test("recording list recovers from stale inner timeline filters after source changes", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    await seedTimelineFilterRecordings(userId);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = page.getByRole("main").getByTestId("recording-list-panel");
    const todayRecording = page.locator(
        '[data-recording-id="e2e-list-state-today-ticnote"]',
    );
    const earlierRecording = page.locator(
        '[data-recording-id="e2e-list-state-earlier-plaud"]',
    );
    await expect(panel).toHaveAttribute("data-list-state", "ready");
    await expect(todayRecording).toBeVisible();
    await expect(earlierRecording).toBeVisible();

    await page.getByRole("button", { name: /今天 1/ }).click();
    await expect(todayRecording).toBeVisible();
    await expect(earlierRecording).toHaveCount(0);

    const plaudRow = page.locator('[data-provider="plaud"]');
    await expect(plaudRow).toHaveAttribute("data-source-status", "connected");
    await plaudRow.click();
    await expect(panel).toHaveAttribute("data-list-state", "timeline-empty");
    await expect(page.getByTestId("recording-list-timeline-empty")).toBeVisible();

    await page.getByRole("button", { name: "清除时间筛选" }).click();
    await expect(panel).toHaveAttribute("data-list-state", "ready");
    await expect(earlierRecording).toBeVisible();
    await expect(todayRecording).toHaveCount(0);

    await cleanupListSeeds(userId);
});

test("recording list exposes empty setup and no-match recovery states", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page);

    const userId = await getPlaywrightUserId();
    await cleanupAllUserRecordings(userId);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = page.getByRole("main").getByTestId("recording-list-panel");
    await expect(panel).toHaveAttribute("data-list-state", "empty");
    await expect(page.getByTestId("recording-list-empty")).toBeVisible();
    await page.getByRole("button", { name: "前往数据源" }).click();
    await expect(page.locator("[data-settings-shell]")).toBeVisible();
    await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
        "data-settings-active-section",
        "data-sources",
    );
    await page.getByTestId("settings-close").click();

    await seedListRecordings(userId);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(panel).toHaveAttribute("data-list-state", "ready");

    const plaudRow = page.locator('[data-provider="plaud"]');
    await expect(plaudRow).toHaveAttribute(
        "data-source-status",
        "connected-empty",
    );
    await plaudRow.click();
    await expect(plaudRow).toHaveAttribute("data-active", "true");
    await expect(panel).toHaveAttribute("data-list-state", "no-match");
    await expect(page.getByTestId("recording-list-no-match")).toBeVisible();

    await page.getByRole("button", { name: "清除筛选" }).click();
    await expect(panel).toHaveAttribute("data-list-state", "ready");
    await expect(plaudRow).toHaveAttribute("data-active", "false");

    await cleanupListSeeds(userId);
});

test("recording list follows display language for empty and pagination copy", async ({
    page,
}) => {
    await mockConnectedDataSources(page);
    await ensureSignedIn(page);
    await resetDisplay(page, { uiLanguage: "en" });

    const userId = await getPlaywrightUserId();
    try {
        await seedListRecordings(userId);
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        await expect(page.getByText("Timeline", { exact: true })).toBeVisible();
        await expect(page.getByTestId("recording-list-next-page")).toHaveText(
            "Next",
        );
        await expect(page.getByTestId("recording-list-page-status")).toContainText(
            "Page 1 of 2",
        );

        await cleanupAllUserRecordings(userId);
        await page.reload({ waitUntil: "domcontentloaded" });

        await expect(page.getByTestId("recording-list-empty")).toContainText(
            "No recordings yet",
        );
        await expect(
            page.getByRole("button", { name: "Open data sources" }),
        ).toBeVisible();
    } finally {
        await resetDisplay(page);
        await cleanupListSeeds(userId);
    }
});
