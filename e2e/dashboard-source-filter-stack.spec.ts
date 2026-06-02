import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const E2E_STORAGE_DIR = process.env.PLAYWRIGHT_E2E_STORAGE_DIR
    ? path.resolve(process.cwd(), process.env.PLAYWRIGHT_E2E_STORAGE_DIR)
    : path.resolve(process.cwd(), "tmp/e2e/storage");
const STACK_RECORDING_PREFIX = "e2e-source-stack-";
const STACK_AUDIO_DIR = "e2e-source-stack-audio";
const STACK_AUDIO_PREFIX = `${STACK_AUDIO_DIR}/`;

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

function assertE2EStoragePath(filePath: string) {
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
            `Refusing to touch non-E2E storage path: ${resolvedPath}`,
        );
    }
}

function databaseUrl(filePath: string) {
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");

function createSineWaveWavBuffer() {
    const sampleRate = 8000;
    const durationSeconds = 1;
    const sampleCount = sampleRate * durationSeconds;
    const bytesPerSample = 2;
    const dataSize = sampleCount * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
    buffer.writeUInt16LE(bytesPerSample, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let index = 0; index < sampleCount; index += 1) {
        const sample = Math.sin((index / sampleRate) * 440 * Math.PI * 2);
        buffer.writeInt16LE(Math.round(sample * 12_000), 44 + index * 2);
    }

    return buffer;
}

async function writeStackAudioFixture(audioKey: string) {
    const audioPath = path.join(E2E_STORAGE_DIR, audioKey);
    assertE2EStoragePath(audioPath);
    await mkdir(path.dirname(audioPath), { recursive: true });
    await writeFile(audioPath, createSineWaveWavBuffer());
}

async function removeStackAudioFixtures() {
    const audioDirectory = path.join(E2E_STORAGE_DIR, STACK_AUDIO_DIR);
    assertE2EStoragePath(audioDirectory);
    await rm(audioDirectory, { recursive: true, force: true });
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

async function cleanupStackSeeds(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM source_artifact_segments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcript_segments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM recording_tag_assignments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedStackRecording(
    userId: string,
    options: { provider?: string } = {},
) {
    const provider = options.provider ?? "iflyrec";
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    const recordingId = `${STACK_RECORDING_PREFIX}${provider}`;

    try {
        await cleanupStackSeeds(userId);
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
                provider,
                `${recordingId}-source`,
                "1",
                "{}",
                `${STACK_RECORDING_PREFIX}device`,
                `E2E source filter stack ${provider}`,
                90_000,
                now - 90_000,
                now,
                2048,
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
    } finally {
        await library.close();
    }
}

async function seedAutoNextStackRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now() + 7 * 86_400_000;
    const recordings = [
        {
            id: `${STACK_RECORDING_PREFIX}autonext-ticnote-newer`,
            filename: "E2E auto next TicNote newer",
            provider: "ticnote",
            startTime: now,
        },
        {
            id: `${STACK_RECORDING_PREFIX}autonext-plaud-middle`,
            filename: "E2E auto next Plaud middle",
            provider: "plaud",
            startTime: now - 60_000,
        },
        {
            id: `${STACK_RECORDING_PREFIX}autonext-ticnote-older`,
            filename: "E2E auto next TicNote older",
            provider: "ticnote",
            startTime: now - 120_000,
        },
    ];

    try {
        await cleanupStackSeeds(userId);
        await removeStackAudioFixtures();
        for (const recording of recordings) {
            const audioKey = `${STACK_AUDIO_PREFIX}${recording.id}.wav`;
            await writeStackAudioFixture(audioKey);
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
                    recording.provider,
                    `${recording.id}-source`,
                    "1",
                    "{}",
                    `${STACK_RECORDING_PREFIX}autonext-device`,
                    recording.filename,
                    60_000,
                    recording.startTime,
                    recording.startTime + 60_000,
                    2048,
                    recording.id,
                    "local",
                    audioKey,
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

function healthyWorkerStatus() {
    const now = new Date();

    return {
        autoSyncEnabled: true,
        lastSyncTime: now.toISOString(),
        nextSyncTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        workerStatus: {
            healthy: true,
            isRunning: false,
            lastHeartbeatAt: now.toISOString(),
            lastStartedAt: null,
            lastFinishedAt: now.toISOString(),
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

function unhealthyWorkerStatus() {
    const now = new Date();
    const healthyStatus = healthyWorkerStatus();

    return {
        ...healthyStatus,
        workerStatus: {
            ...healthyStatus.workerStatus,
            healthy: false,
            lastHeartbeatAt: new Date(
                now.getTime() - 2 * 60 * 1000,
            ).toISOString(),
            lastFinishedAt: null,
            lastError: "E2E source sync failed.",
            lastSummary: {
                newRecordings: 0,
                updatedRecordings: 0,
                removedRecordings: 0,
                errorCount: 1,
            },
        },
    };
}

async function mockSyncEndpoint(
    page: Page,
    options: { initialStatus?: "healthy" | "unhealthy" } = {},
) {
    let status = options.initialStatus ?? "healthy";

    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() === "POST") {
            status = "healthy";
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    success: true,
                    queued: false,
                    newRecordings: 0,
                }),
            });
            return;
        }

        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(
                    status === "unhealthy"
                        ? unhealthyWorkerStatus()
                        : healthyWorkerStatus(),
                ),
            });
            return;
        }

        await route.continue();
    });
}

async function mockConnectedDataSources(page: Page, providers: string[]) {
    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        const capabilities = {
            audioDownload: false,
            localRename: true,
            officialSummary: true,
            officialTranscript: true,
            privateTranscribe: false,
            upstreamTitleWriteback: false,
            workerSync: true,
        };
        const connectedProviders = new Set(providers);

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                sources: [
                    "plaud",
                    "ticnote",
                    "feishu-minutes",
                    "dingtalk-a1",
                    "iflyrec",
                ].map((provider) => ({
                    authMode:
                        provider === "iflyrec" ? "session-header" : "bearer",
                    authModes:
                        provider === "iflyrec" ? ["session-header"] : ["bearer"],
                    baseUrl: "https://example.invalid",
                    capabilities,
                    config: {},
                    connected: connectedProviders.has(provider),
                    connectionStatus: "ready",
                    displayName: provider === "iflyrec" ? "讯飞听见" : provider,
                    enabled: connectedProviders.has(provider),
                    lastSync: null,
                    provider,
                    runtimeStatus: "active",
                    secretsConfigured: connectedProviders.has(provider)
                        ? provider === "iflyrec"
                            ? { sessionId: true }
                            : { bearerToken: true }
                        : {},
                })),
            }),
        });
    });
}

async function openDashboard(
    page: Parameters<typeof ensureSignedIn>[0],
    options: { connectIflyrec?: boolean; uiLanguage?: "zh-CN" | "en" } = {},
) {
    await ensureSignedIn(page);

    if (options.connectIflyrec) {
        await mockConnectedDataSources(page, ["iflyrec"]);
    } else {
        await mockConnectedDataSources(page, []);
    }

    const resetDisplay = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "system",
            uiLanguage: options.uiLanguage ?? "zh-CN",
        },
    });
    expect(resetDisplay.ok()).toBe(true);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources") && response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
    await page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/recording-tags") && response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
}

async function activeElementIsInsideSourceDrawer(page: Page) {
    return page.getByTestId("dashboard-source-rail").evaluate((node) => {
        return node.contains(document.activeElement);
    });
}

test("dashboard source filter stack exposes clear and setup actions", async ({
    page,
}) => {
    await openDashboard(page, { connectIflyrec: true });

    const iflyrecRow = page.locator('[data-provider="iflyrec"]');
    await expect(iflyrecRow).toBeVisible();
    await expect(iflyrecRow).toHaveAttribute(
        "data-source-status",
        /needs-setup|planned|paused|expired|connected-empty|no-results|connected|sync-error/,
    );
    await iflyrecRow.click();
    await expect(iflyrecRow).toHaveAttribute("data-active", "true");

    const stack = page.getByTestId("dashboard-source-filter-stack");
    await expect(stack).toBeVisible();
    await expect(stack).toHaveAttribute(
        "data-source-status",
        /needs-setup|planned|paused|expired|connected-empty|no-results|connected|sync-error/,
    );
    await expect(stack).toContainText("讯飞听见");

    const clearSource = stack.getByRole("button", { name: "清除来源筛选" });
    await expect(clearSource).toBeVisible();
    await clearSource.click();
    await expect(stack).toBeHidden();

    await iflyrecRow.click();
    await expect(stack).toBeVisible();

    const settingsAction = stack.getByRole("button", { name: "前往设置" });
    if (await settingsAction.isVisible()) {
        await settingsAction.click();
        await expect(page.locator("[data-settings-shell]")).toBeVisible();
        await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
            "data-settings-active-section",
            "data-sources",
        );
    }
});

test("dashboard source filter stack follows English display language", async ({
    page,
}) => {
    await openDashboard(page, { connectIflyrec: true, uiLanguage: "en" });

    const sourceRows = page.getByTestId("source-provider-rows");
    await expect(sourceRows).toContainText("Sources");

    const iflyrecRow = page.locator('[data-provider="iflyrec"]');
    await expect(iflyrecRow).toBeVisible();
    await iflyrecRow.click();

    const stack = page.getByTestId("dashboard-source-filter-stack");
    await expect(stack).toBeVisible();
    await expect(stack).toContainText("Filter");
    await expect(stack).toContainText("All recordings");
    await expect(stack).toContainText("Showing");
    await expect(
        stack.getByRole("button", { name: "Clear source filter" }),
    ).toBeVisible();
    await expect(
        stack.getByRole("button", { name: "Clear all" }),
    ).toBeVisible();
    await expect(sourceRows.getByRole("button", { name: "Clear" })).toBeVisible();
});

test("dashboard source setup rows open Data Sources settings", async ({ page }) => {
    await openDashboard(page);

    const iflyrecRow = page.locator('[data-provider="iflyrec"]');
    await expect(iflyrecRow).toBeVisible();
    await iflyrecRow.click();
    await expect(page.locator("[data-settings-shell]")).toBeVisible();
    await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
        "data-settings-active-section",
        "data-sources",
    );
    await expect(
        page.locator('[data-provider-detail="iflyrec"]'),
    ).toBeVisible();
});

test("dashboard auto-play next stays inside the active source filter", async ({
    page,
}) => {
    await mockSyncEndpoint(page);
    await mockConnectedDataSources(page, ["ticnote", "plaud"]);
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedAutoNextStackRecordings(userId);
        const playbackResponse = await page.request.put("/api/settings/playback", {
            data: {
                autoPlayNext: true,
                defaultPlaybackSpeed: 1,
                defaultVolume: 75,
            },
        });
        expect(playbackResponse.ok()).toBe(true);

        const playbackSettingsLoaded = page
            .waitForResponse(
                (response) =>
                    response.url().includes("/api/settings/playback") &&
                    response.request().method() === "GET" &&
                    response.ok(),
            )
            .catch(() => null);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await playbackSettingsLoaded;

        const ticnoteRow = page.locator('[data-provider="ticnote"]');
        await expect(ticnoteRow).toBeVisible();
        await expect(ticnoteRow).toHaveAttribute(
            "data-source-status",
            "connected",
        );
        await ticnoteRow.click();

        const newerItem = page.locator(
            '[data-recording-id="e2e-source-stack-autonext-ticnote-newer"]',
        );
        await expect(newerItem).toBeVisible();
        await newerItem.click();
        await expect(newerItem).toHaveAttribute("data-selected", "true");
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            "E2E auto next TicNote newer",
        );

        await page.getByTestId("recording-player-audio").evaluate((node) => {
            node.dispatchEvent(new Event("ended"));
        });

        const olderItem = page.locator(
            '[data-recording-id="e2e-source-stack-autonext-ticnote-older"]',
        );
        await expect(olderItem).toHaveAttribute("data-selected", "true");
        await expect(
            page.locator(
                '[data-recording-id="e2e-source-stack-autonext-plaud-middle"][data-selected="true"]',
            ),
        ).toHaveCount(0);
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            "E2E auto next TicNote older",
        );
    } finally {
        await removeStackAudioFixtures();
        await cleanupStackSeeds(userId);
    }
});

test("dashboard responsive source rail opens as a mobile drawer and collapses on desktop", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDashboard(page, { connectIflyrec: true });

    const workstation = page.getByTestId("dashboard-workstation");
    await expect(workstation).toHaveAttribute("data-source-drawer", "closed");

    await page.getByTestId("dashboard-source-drawer-trigger").click();
    await expect(workstation).toHaveAttribute("data-source-drawer", "open");
    await expect(page.getByTestId("dashboard-source-rail")).toHaveAttribute(
        "data-drawer-open",
        "true",
    );
    await expect
        .poll(() => activeElementIsInsideSourceDrawer(page))
        .toBe(true);
    for (let index = 0; index < 12; index += 1) {
        await page.keyboard.press("Tab");
        await expect
            .poll(() => activeElementIsInsideSourceDrawer(page))
            .toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    await expect
        .poll(() => activeElementIsInsideSourceDrawer(page))
        .toBe(true);

    await page.mouse.click(374, 760);
    await expect(workstation).toHaveAttribute("data-source-drawer", "closed");
    await expect(page.getByTestId("dashboard-source-drawer-trigger")).toBeFocused();

    await page.getByTestId("dashboard-source-drawer-trigger").click();
    await expect(workstation).toHaveAttribute("data-source-drawer", "open");
    await page.keyboard.press("Escape");
    await expect(workstation).toHaveAttribute("data-source-drawer", "closed");
    await expect(page.getByTestId("dashboard-source-drawer-trigger")).toBeFocused();

    await page.getByTestId("dashboard-source-drawer-trigger").click();
    await expect(workstation).toHaveAttribute("data-source-drawer", "open");
    await page.getByTestId("library-search-trigger").first().click();
    await expect(workstation).toHaveAttribute("data-source-drawer", "closed");
    await expect(page.getByTestId("library-search-panel")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("library-search-panel")).toBeHidden();

    await page.getByTestId("dashboard-source-drawer-trigger").click();
    await expect(workstation).toHaveAttribute("data-source-drawer", "open");

    const iflyrecRow = page.locator('[data-provider="iflyrec"]');
    await expect(iflyrecRow).toBeVisible();
    await iflyrecRow.click();
    await expect(workstation).toHaveAttribute("data-source-drawer", "closed");
    await expect(page.getByTestId("dashboard-source-filter-stack")).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByTestId("dashboard-sidebar-collapse-trigger").click();
    await expect(workstation).toHaveAttribute(
        "data-sidebar-collapsed",
        "true",
    );
    await expect(page.getByTestId("source-provider-rows")).toHaveAttribute(
        "data-compact",
        "true",
    );
});

test("dashboard source filter stack retries sync errors and restores active state", async ({
    page,
}) => {
    await mockSyncEndpoint(page, { initialStatus: "unhealthy" });
    await mockConnectedDataSources(page, ["iflyrec"]);
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    try {
        await seedStackRecording(userId);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        const iflyrecRow = page.locator('[data-provider="iflyrec"]');
        await expect(iflyrecRow).toBeVisible();
        await expect(iflyrecRow).toHaveAttribute(
            "data-source-status",
            "sync-error",
        );
        await iflyrecRow.click();

        const stack = page.getByTestId("dashboard-source-filter-stack");
        await expect(stack).toBeVisible();
        await expect(stack).toHaveAttribute("data-state", "sync-error");
        await expect(stack).toContainText("同步异常");

        const syncPostRequest = page.waitForRequest(
            (request) =>
                request.url().includes("/api/data-sources/sync") &&
                request.method() === "POST",
        );
        await stack.getByRole("button", { name: "重试同步" }).click();
        await syncPostRequest;

        await expect(stack).toHaveAttribute("data-state", "active");
        await expect(iflyrecRow).toHaveAttribute(
            "data-source-status",
            "connected",
        );
    } finally {
        await cleanupStackSeeds(userId);
    }
});

test("dashboard source filter stack widens no-result favorite filters", async ({
    page,
}) => {
    await mockSyncEndpoint(page);
    await mockConnectedDataSources(page, ["iflyrec"]);
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    try {
        await seedStackRecording(userId);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        const iflyrecRow = page.locator('[data-provider="iflyrec"]');
        await expect(iflyrecRow).toBeVisible();
        await expect(iflyrecRow).toHaveAttribute(
            "data-source-status",
            "connected",
        );
        await iflyrecRow.click();
        await page.getByRole("button", { name: "转写记录" }).click();

        const stack = page.getByTestId("dashboard-source-filter-stack");
        await expect(stack).toBeVisible();
        await expect(stack).toHaveAttribute("data-state", "no-results");
        await expect(stack).toContainText("在当前筛选下没有匹配项");

        await stack.getByRole("button", { name: "放宽筛选" }).click();
        await expect(stack).toHaveAttribute("data-state", "active");
        await expect(
            page.getByRole("button", { name: "全部录音" }),
        ).toHaveAttribute("data-active", "true");
    } finally {
        await cleanupStackSeeds(userId);
    }
});
