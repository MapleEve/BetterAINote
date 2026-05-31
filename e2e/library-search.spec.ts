import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

async function openLibrarySearch(page: Page) {
    const trigger = page.getByTestId("library-search-trigger");
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
        await page.waitForTimeout(250);
    }

    return panel;
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

    const input = panel.getByRole("textbox", {
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
    const resetDisplay = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "system",
            uiLanguage: "zh-CN",
        },
    });
    expect(resetDisplay.ok()).toBe(true);

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

    const input = panel.getByRole("textbox", {
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
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const searchTrigger = page.getByTestId("library-search-trigger");
    const searchPanel = page.getByTestId("library-search-panel");
    const activityTrigger = page.getByTestId("dashboard-activity-trigger");
    const activityPanel = page.getByTestId("dashboard-activity-panel");
    const settingsTrigger = page.getByTestId("dashboard-settings-trigger");

    await openLibrarySearch(page);
    await expect(searchPanel).toBeVisible();
    await expect(searchPanel).toHaveCSS("z-index", "220");

    await page.mouse.click(16, 220);
    await expect(searchPanel).toBeHidden();

    await openLibrarySearch(page);
    await expect(searchPanel).toBeVisible();
    await activityTrigger.click();
    await expect(searchPanel).toBeHidden();
    await expect(activityPanel).toBeVisible();
    await expect(activityPanel).toHaveCSS("z-index", "220");
    await expect(activityTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(searchTrigger).toHaveAttribute("aria-expanded", "false");

    await openLibrarySearch(page);
    await expect(activityPanel).toBeHidden();
    await expect(searchPanel).toBeVisible();
    await expect(searchTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(activityTrigger).toHaveAttribute("aria-expanded", "false");

    await settingsTrigger.click();
    await expect(searchPanel).toBeHidden();
    await expect(activityPanel).toBeHidden();
    await expect(page.locator("[data-settings-shell]")).toBeVisible();

    await page.getByTestId("settings-close").click();
    await expect(page.locator("[data-settings-shell]")).toBeHidden();

    await activityTrigger.click();
    await expect(activityPanel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(activityPanel).toBeHidden();
    await expect(activityTrigger).toBeFocused();
});
