import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const SEARCH_RECORDING_ID = "e2e-library-search-target";
const SEARCH_OTHER_RECORDING_ID = "e2e-library-search-other";

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

async function seedLibrarySearchRecording(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    const seeds = [
        {
            id: SEARCH_OTHER_RECORDING_ID,
            filename: "E2E library search other",
            start: now - 60_000,
        },
        {
            id: SEARCH_RECORDING_ID,
            filename: "E2E library search target",
            start: now - 180_000,
        },
    ];

    try {
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ? AND id IN (?, ?)",
            args: [userId, SEARCH_RECORDING_ID, SEARCH_OTHER_RECORDING_ID],
        });

        for (const seed of seeds) {
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
                    seed.id,
                    userId,
                    "ticnote",
                    `${seed.id}-source`,
                    "1",
                    "{}",
                    "e2e-library-search-device",
                    seed.filename,
                    180_000,
                    seed.start,
                    seed.start + 180_000,
                    4096,
                    seed.id,
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

function buildSearchResult(overrides: Record<string, unknown>) {
    return {
        entityType: "tag",
        entityId: "tag-alpha",
        recordingId: null,
        title: "Alpha tag",
        body: "Alpha search result",
        speaker: null,
        tags: ["Alpha"],
        source: null,
        startMs: null,
        endMs: null,
        ...overrides,
    };
}

async function mockLibrarySearchResults(
    page: Page,
    results: Array<Record<string, unknown>>,
    onRequest?: (url: URL) => void,
) {
    await page.route("**/api/search?**", async (route) => {
        onRequest?.(new URL(route.request().url()));
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ results }),
        });
    });
}

async function mockSyncEndpoint(page: Page) {
    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(healthySyncStatus()),
        });
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

async function openLibrarySearch(page: Page) {
    const trigger = page.getByTestId("library-search-trigger").first();
    const panel = page.getByTestId("library-search-panel");

    await expect(trigger).toBeVisible();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await trigger.click();
        if (
            await panel
                .isVisible({ timeout: 1_000 })
                .catch(() => false)
        ) {
            return panel;
        }
        await trigger.press("Enter");
        if (
            await panel
                .isVisible({ timeout: 1_000 })
                .catch(() => false)
        ) {
            return panel;
        }
        await page.waitForTimeout(250);
    }

    await expect(panel).toBeVisible();
    return panel;
}

async function openDashboardMoreMenu(page: Page) {
    const trigger = page
        .getByTestId("dashboard-detail-more-actions")
        .getByRole("button");
    const menu = page.getByTestId("dashboard-detail-more-menu");

    await expect(trigger).toBeVisible();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await trigger.click();
        if (
            await menu
                .isVisible({ timeout: 1_000 })
                .catch(() => false)
        ) {
            return menu;
        }
        await page.waitForTimeout(250);
    }

    await expect(menu).toBeVisible();
    return menu;
}

async function expectOverlayHitTarget(
    page: Page,
    testId: "dashboard-activity-panel" | "library-search-panel",
) {
    const panel = page.getByTestId(testId);
    await expect(panel).toBeVisible();

    const result = await panel.evaluate((node, panelTestId) => {
        const rect = node.getBoundingClientRect();
        const topPoint = {
            x: rect.left + rect.width / 2,
            y: rect.top + Math.min(48, Math.max(8, rect.height / 2)),
        };
        const bottomPoint = {
            x: rect.left + rect.width / 2,
            y: rect.bottom - Math.min(12, Math.max(8, rect.height / 3)),
        };
        const topHit = document.elementFromPoint(topPoint.x, topPoint.y);
        const bottomHit = document.elementFromPoint(
            bottomPoint.x,
            bottomPoint.y,
        );

        return {
            containsBottomHit: Boolean(
                bottomHit?.closest(`[data-testid="${panelTestId}"]`) === node,
            ),
            containsTopHit: Boolean(
                topHit?.closest(`[data-testid="${panelTestId}"]`) === node,
            ),
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
        };
    }, testId);

    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.left).toBeGreaterThanOrEqual(0);
    expect(result.right).toBeLessThanOrEqual(result.viewportWidth);
    expect(result.top).toBeGreaterThanOrEqual(0);
    expect(result.bottom).toBeLessThanOrEqual(result.viewportHeight);
    expect(result.containsTopHit).toBe(true);
    expect(result.containsBottomHit).toBe(true);

    await page.mouse.click(
        (result.left + result.right) / 2,
        result.top + Math.min(48, Math.max(8, result.height / 2)),
    );
    await expect(panel).toBeVisible();
}

function healthySyncStatus() {
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

test("library search keeps error retry and keyboard focus paths live", async ({
    page,
}) => {
    let searchCalls = 0;
    await page.route("**/api/search?**", async (route) => {
        searchCalls += 1;
        if (searchCalls === 1) {
            await route.fulfill({
                contentType: "application/json",
                status: 503,
                body: JSON.stringify({ error: "Search temporarily unavailable" }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ results: [] }),
        });
    });

    await ensureSignedIn(page);
    const dashboardHydrated = page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/recording-tags") &&
                response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await dashboardHydrated;

    const panel = await openLibrarySearch(page);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS("z-index", "220");

    const input = panel.getByRole("combobox", {
        name: "搜索录音、逐字稿、说话人、标签",
    });
    await input.fill("retry-check");
    await expect(page.getByTestId("library-search-error")).toBeVisible();

    await page.locator("[data-ls-retry]").click();
    await expect(page.getByTestId("library-search-no-results")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page.getByTestId("library-search-trigger")).toBeFocused();
});

test("library search groups highlights and applies global speaker tag filters", async ({
    page,
}) => {
    await page.route("**/api/search?**", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                results: [
                    {
                        entityType: "recording",
                        entityId: "rec-alpha",
                        recordingId: "rec-alpha",
                        title: "Alpha recording",
                        body: "Alpha body",
                        speaker: null,
                        tags: ["Alpha"],
                        source: "ticnote",
                        startMs: null,
                        endMs: null,
                    },
                    {
                        entityType: "tag",
                        entityId: "tag-alpha",
                        recordingId: null,
                        title: "Alpha tag",
                        body: "Alpha tag filter",
                        speaker: null,
                        tags: ["Alpha tag"],
                        source: null,
                        startMs: null,
                        endMs: null,
                    },
                    {
                        entityType: "transcript",
                        entityId: "seg-alpha",
                        recordingId: "rec-alpha",
                        title: "Alpha recording",
                        body: "Alpha transcript hit",
                        speaker: "Speaker Alpha",
                        tags: [],
                        source: "ticnote",
                        startMs: 1000,
                        endMs: 3000,
                    },
                    {
                        entityType: "speaker",
                        entityId: "speaker-alpha",
                        recordingId: null,
                        title: "Alpha speaker",
                        body: "Alpha speaker filter",
                        speaker: "Alpha speaker",
                        tags: [],
                        source: null,
                        startMs: null,
                        endMs: null,
                    },
                ],
            }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplaySettings(page);

    const dashboardHydrated = page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/recording-tags") &&
                response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await dashboardHydrated;

    const panel = await openLibrarySearch(page);
    await expect(panel).toBeVisible();

    const input = panel.getByRole("combobox", {
        name: "搜索录音、逐字稿、说话人、标签",
    });
    await input.fill("Alpha");

    await expect(page.getByTestId("library-search-results")).toBeVisible();
    await expect(page.getByTestId("library-search-group-recording")).toBeVisible();
    await expect(page.getByTestId("library-search-group-transcript")).toBeVisible();
    await expect(page.getByTestId("library-search-group-speaker")).toBeVisible();
    await expect(page.getByTestId("library-search-group-tag")).toBeVisible();
    await expect(page.getByTestId("library-search-highlight").first()).toBeVisible();

    const speakerResult = page.locator(
        '[data-testid^="library-search-result-speaker-"]',
    );
    await expect(speakerResult).toHaveAttribute("data-result-mode", "filter");

    const tagResult = page.locator(
        '[data-testid^="library-search-result-tag-"]',
    );
    await expect(tagResult).toHaveAttribute("data-result-mode", "filter");
    await tagResult.click();

    await expect(panel).toBeHidden();
    const searchFilter = page.getByTestId("dashboard-library-search-filter");
    await expect(searchFilter).toBeVisible();
    await expect(searchFilter).toHaveAttribute("data-library-search-filter", "tag");
    await expect(searchFilter).toContainText("Alpha tag");

    await searchFilter.getByRole("button", { name: "清除" }).click();
    await expect(searchFilter).toBeHidden();
});

test("library search keeps keyboard active results visible before Enter actions", async ({
    page,
}) => {
    await mockLibrarySearchResults(
        page,
        Array.from({ length: 12 }, (_, index) => {
            const suffix = String(index + 1).padStart(2, "0");
            return buildSearchResult({
                entityId: `tag-alpha-${suffix}`,
                title: `Alpha tag ${suffix}`,
                body: `Alpha keyboard result ${suffix}`,
                tags: [`Alpha tag ${suffix}`],
            });
        }),
    );

    await ensureSignedIn(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = await openLibrarySearch(page);
    await expect(panel.getByRole("combobox")).toHaveAttribute(
        "aria-controls",
        "library-search-results-listbox",
    );
    const input = panel.getByRole("combobox", {
        name: "搜索录音、逐字稿、说话人、标签",
    });
    await input.fill("Alpha");
    await expect(page.getByTestId("library-search-results")).toHaveAttribute(
        "role",
        "listbox",
    );

    for (let index = 0; index < 11; index += 1) {
        await page.keyboard.press("ArrowDown");
    }

    const activeResult = page.getByTestId("library-search-result-tag-11");
    await expect(activeResult).toHaveAttribute("data-active", "true");
    await expect(activeResult).toBeInViewport();

    const activeResultIsInsideScroller = await activeResult.evaluate((node) => {
        const scrollRegion = node.closest(
            '[data-testid="library-search-scroll-region"]',
        );
        if (!scrollRegion) {
            return false;
        }
        const itemRect = node.getBoundingClientRect();
        const scrollRect = scrollRegion.getBoundingClientRect();

        return (
            itemRect.top >= scrollRect.top - 1 &&
            itemRect.bottom <= scrollRect.bottom + 1
        );
    });
    expect(activeResultIsInsideScroller).toBe(true);

    await page.keyboard.press("Enter");

    await expect(panel).toBeHidden();
    const searchFilter = page.getByTestId("dashboard-library-search-filter");
    await expect(searchFilter).toBeVisible();
    await expect(searchFilter).toHaveAttribute("data-library-search-filter", "tag");
    await expect(searchFilter).toContainText("Alpha tag 12");
});

test("library search sends scoped requests and opens transcript hits", async ({
    page,
}) => {
    const requestedTypes: string[] = [];
    let releaseTranscriptSearch = () => {};
    let notifyTranscriptSearchStarted = () => {};
    const transcriptSearchStarted = new Promise<void>((resolve) => {
        notifyTranscriptSearchStarted = resolve;
    });
    const pendingTranscriptSearch = new Promise<void>((resolve) => {
        releaseTranscriptSearch = resolve;
    });
    await page.route("**/api/search?**", async (route) => {
        const url = new URL(route.request().url());
        const type = url.searchParams.get("type") ?? "all";
        requestedTypes.push(type);
        const results =
            type === "transcript"
                ? [
                      buildSearchResult({
                          entityType: "transcript",
                          entityId: "segment-other",
                          recordingId: SEARCH_OTHER_RECORDING_ID,
                          title: "E2E library search other",
                          body: "Alpha transcript first result",
                          speaker: "Speaker Alpha",
                          source: "ticnote",
                          startMs: 1000,
                          endMs: 3000,
                      }),
                      buildSearchResult({
                          entityType: "transcript",
                          entityId: "segment-alpha",
                          recordingId: SEARCH_RECORDING_ID,
                          title: "E2E library search target",
                          body: "Alpha transcript keyboard target",
                          speaker: "Speaker Alpha",
                          source: "ticnote",
                          startMs: 4000,
                          endMs: 6000,
                      }),
                  ]
                : [
                      buildSearchResult({
                          entityType: "recording",
                          entityId: SEARCH_OTHER_RECORDING_ID,
                          recordingId: SEARCH_OTHER_RECORDING_ID,
                          title: "E2E library search other",
                          body: "Alpha recording hit",
                          source: "ticnote",
                      }),
                  ];

        if (type === "transcript") {
            notifyTranscriptSearchStarted();
            await pendingTranscriptSearch;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ results }),
        });
    });
    await mockSyncEndpoint(page);

    await ensureSignedIn(page);
    await resetDisplaySettings(page);
    const userId = await getPlaywrightUserId();
    await seedLibrarySearchRecording(userId);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const otherRecording = page.locator(
        `[data-recording-id="${SEARCH_OTHER_RECORDING_ID}"]`,
    );
    const targetRecording = page.locator(
        `[data-recording-id="${SEARCH_RECORDING_ID}"]`,
    );
    await expect(otherRecording).toHaveAttribute("data-selected", "true");
    await expect(targetRecording).toHaveAttribute("data-selected", "false");

    const panel = await openLibrarySearch(page);
    const input = panel.getByRole("combobox", {
        name: "搜索录音、逐字稿、说话人、标签",
    });
    await input.fill("Alpha");
    await expect(page.getByTestId("library-search-results")).toBeVisible();

    await panel.getByRole("button", { name: "逐字稿" }).click();
    await transcriptSearchStarted;
    await expect(input).toBeFocused();
    await expect(page.getByTestId("library-search-loading")).toBeVisible();
    releaseTranscriptSearch();
    await expect
        .poll(() => requestedTypes)
        .toContain("transcript");
    await expect(page.getByTestId("library-search-result-transcript-1")).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("library-search-result-transcript-1")).toHaveAttribute(
        "data-active",
        "true",
    );
    await page.keyboard.press("Enter");

    await expect(panel).toBeHidden();
    await expect(targetRecording).toHaveAttribute("data-selected", "true");
    await expect(otherRecording).toHaveAttribute("data-selected", "false");
});

test("topbar overlays stay layered, mutually exclusive, and close across outside click and settings", async ({
    page,
}) => {
    await page.route("**/api/search?**", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ results: [] }),
        });
    });
    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(healthySyncStatus()),
            });
            return;
        }

        await route.continue();
    });

    await ensureSignedIn(page);
    await resetDisplaySettings(page);
    const userId = await getPlaywrightUserId();
    await seedLibrarySearchRecording(userId);
    const dashboardHydrated = page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/recording-tags") &&
                response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await dashboardHydrated;

    const searchTrigger = page.getByTestId("library-search-trigger");
    const searchPanel = page.getByTestId("library-search-panel");
    const activityTrigger = page.getByTestId("dashboard-activity-trigger");
    const activityPanel = page.getByTestId("dashboard-activity-panel");
    const settingsTrigger = page.getByTestId("dashboard-settings-trigger");
    const moreMenu = page.getByTestId("dashboard-detail-more-menu");
    const tagManagerTrigger = page.getByTestId("recording-tag-manager-trigger");
    const tagManager = page.getByTestId("recording-tag-manager");

    await openDashboardMoreMenu(page);

    await openLibrarySearch(page);
    await expect(moreMenu).toBeHidden();
    await expect(searchPanel).toBeVisible();
    await expect(searchPanel).toHaveCSS("z-index", "220");
    await expectOverlayHitTarget(page, "library-search-panel");

    await page.mouse.click(16, 220);
    await expect(searchPanel).toBeHidden();

    await tagManagerTrigger.click();
    await expect(tagManager).toBeVisible();
    await openLibrarySearch(page);
    await expect(tagManager).toBeHidden();
    await expect(searchPanel).toBeVisible();
    await activityTrigger.click();
    await expect(searchPanel).toBeHidden();
    await expect(activityPanel).toBeVisible();
    await expect(activityPanel).toHaveCSS("z-index", "220");
    await expectOverlayHitTarget(page, "dashboard-activity-panel");
    await expect(activityTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(searchTrigger).toHaveAttribute("aria-expanded", "false");

    await page.mouse.click(16, 220);
    await expect(activityPanel).toBeHidden();
    await openDashboardMoreMenu(page);
    await activityTrigger.click();
    await expect(moreMenu).toBeHidden();
    await expect(activityPanel).toBeVisible();

    await openLibrarySearch(page);
    await expect(activityPanel).toBeHidden();
    await expect(searchPanel).toBeVisible();
    await expect(searchTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(activityTrigger).toHaveAttribute("aria-expanded", "false");

    await page
        .getByTestId("dashboard-detail-more-actions")
        .getByRole("button")
        .focus();
    await page.keyboard.press("Enter");
    await expect(searchPanel).toBeHidden();
    await expect(moreMenu).toBeVisible();

    await openLibrarySearch(page);
    await expect(moreMenu).toBeHidden();
    await tagManagerTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(searchPanel).toBeHidden();
    await expect(tagManager).toBeVisible();

    await settingsTrigger.click();
    await expect(tagManager).toBeHidden();
    await expect(searchPanel).toBeHidden();
    await expect(activityPanel).toBeHidden();
    await expect(page.locator("[data-settings-shell]")).toBeVisible();

    await page.getByTestId("settings-close").click();
    await expect(page.locator("[data-settings-shell]")).toBeHidden();

    await tagManagerTrigger.click();
    await expect(tagManager).toBeVisible();
    await settingsTrigger.click();
    await expect(tagManager).toBeHidden();
    await expect(page.locator("[data-settings-shell]")).toBeVisible();

    await page.getByTestId("settings-close").click();
    await expect(page.locator("[data-settings-shell]")).toBeHidden();

    await activityTrigger.click();
    await expect(activityPanel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(activityPanel).toBeHidden();
    await expect(activityTrigger).toBeFocused();

    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await openLibrarySearch(page);
    await expect(searchPanel).toBeVisible();
    await expectOverlayHitTarget(page, "library-search-panel");

    await activityTrigger.click();
    await expect(searchPanel).toBeHidden();
    await expect(activityPanel).toBeVisible();
    await expectOverlayHitTarget(page, "dashboard-activity-panel");
});

test("library search follows display language across visible copy and aria labels", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetDisplaySettings(page, { uiLanguage: "en" });
    await mockLibrarySearchResults(page, []);

    try {
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        await expect(
            page.getByRole("button", { name: "Open search" }),
        ).toBeVisible();

        const panel = await openLibrarySearch(page);
        await expect(panel).toHaveAttribute("aria-label", "Search library");

        const input = panel.getByRole("combobox", {
            name: "Search recordings, transcripts, speakers, tags",
        });
        await expect(input).toHaveAttribute(
            "placeholder",
            "Search recordings, transcripts, speakers, tags",
        );
        await expect(panel.getByText("All", { exact: true })).toBeVisible();
        await expect(
            panel.getByText("Recordings", { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByTestId("library-search-no-query"),
        ).toContainText(
            "Search recordings, transcript segments, speakers, or tags",
        );

        await input.fill("Alpha");
        await expect(page.getByTestId("library-search-no-results")).toContainText(
            'No content found for "Alpha"',
        );
    } finally {
        await resetDisplaySettings(page);
    }
});
