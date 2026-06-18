import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import {
    expect,
    type Locator,
    type Page,
    test,
    type TestInfo,
} from "@playwright/test";
import { ensureSignedIn, putJsonWithRetry } from "./helpers/auth";
import {
    SOT_COMPONENT_LIBRARY_URL,
    SOT_WORKSTATION_URL,
} from "./helpers/sot-fixtures";

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

type LibrarySearchPixelTarget = "panel" | "body";
type WebIndexSearchState =
    | "no-query"
    | "loading"
    | "results"
    | "no-results"
    | "error";

const CANONICAL_SEARCH_SCOPE_LABELS = [
    "全部",
    "录音",
    "逐字稿",
    "说话人",
    "标签",
] as const;

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
    const nextSettings = {
        dateTimeFormat: "relative",
        itemsPerPage: 50,
        recordingListSortOrder: "newest",
        theme: "dark",
        uiLanguage: "zh-CN",
        ...overrides,
    };
    const resetResponse = await putJsonWithRetry(page, "/api/settings/display", {
        ...nextSettings,
    });
    expect(resetResponse.ok()).toBe(true);
    await expect
        .poll(async () => {
            const response = await page.request.get("/api/settings/display");
            if (!response.ok()) {
                return null;
            }

            const payload = (await response.json()) as Record<string, unknown>;
            return payload.uiLanguage;
        })
        .toBe(nextSettings.uiLanguage);
}

async function openSotComponentLibrary(page: Page) {
    await page.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
        document.body.dataset.theme = "light";
    });
}

async function openSotWebIndexSearch(page: Page) {
    await page.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
        document.body.dataset.theme = "light";
    });
    await page.locator("#ls-trigger").click();
    const panel = page.locator("#ls-panel");
    await expect(panel).toHaveAttribute("data-open", "true");
    await expect(panel).toBeVisible();
    return panel;
}

async function setSotWebIndexSearchState(
    page: Page,
    state: WebIndexSearchState,
) {
    const panel = page.locator("#ls-panel");
    await page.evaluate((nextState) => {
        (
            window as Window & {
                __lsSetState?: (state: string) => void;
            }
        ).__lsSetState?.(nextState);
    }, state);
    await expect(panel).toHaveAttribute("data-state", state);
    return panel;
}

async function expectCanonicalSearchScopeChips(panel: Locator) {
    const chips = panel.locator(
        '.ls-scope .ls-chip, [data-sot-control="library-search-scope"]',
    );
    await expect(chips).toHaveCount(CANONICAL_SEARCH_SCOPE_LABELS.length);
    await expect(chips).toHaveText([...CANONICAL_SEARCH_SCOPE_LABELS]);
}

async function prepareSearchDashboard(
    page: Page,
    routeHandler?: Parameters<Page["route"]>[1],
) {
    await page.unroute("**/api/search?**").catch(() => undefined);
    if (routeHandler) {
        await page.route("**/api/search?**", routeHandler);
    }
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    if (new URL(page.url()).pathname.endsWith("/login")) {
        await ensureSignedIn(page);
    }

    return openLibrarySearch(page);
}

function sotSearchPanel(page: Page, state: string) {
    return page.locator(`#search .ls-panel[data-state="${state}"]`).first();
}

function searchPixelLocator(
    panel: Locator,
    target: LibrarySearchPixelTarget,
) {
    return target === "panel"
        ? panel
        : panel
              .locator(
                  '.ls-body, [data-sot-region="library-search-scroll"]',
              )
              .first();
}

async function captureSearchPixelDataUrl(
    page: Page,
    locator: Locator,
    target: LibrarySearchPixelTarget,
) {
    const fixtureId = `sot-search-pixel-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
    await locator.first().evaluate(
        (element, params) => {
            document.getElementById(params.fixtureId)?.remove();

            const host = document.createElement("div");
            host.id = params.fixtureId;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.style.width = "560px";
            stage.style.height = params.target === "panel" ? "620px" : "420px";
            stage.style.padding = "40px";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";

            const clone = element.cloneNode(true) as HTMLElement;
            clone.removeAttribute("hidden");
            clone.removeAttribute("aria-hidden");
            clone.removeAttribute("inert");
            clone.style.position = "relative";
            clone.style.inset = "auto";
            clone.style.top = "auto";
            clone.style.right = "auto";
            clone.style.bottom = "auto";
            clone.style.left = "auto";
            clone.style.margin = "0";
            clone.style.opacity = "1";
            clone.style.transform = "translateY(0) scale(1)";
            clone.style.pointerEvents = "auto";
            if (params.target === "body") {
                clone.style.width = "460px";
            } else {
                clone.dataset.open = "true";
            }

            for (const input of clone.querySelectorAll("input")) {
                input.setAttribute("value", input.value);
            }

            stage.appendChild(clone);
            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { fixtureId, target },
    );

    const screenshotTarget = page.locator(`#${fixtureId} > div`).first();
    await expect(screenshotTarget).toBeVisible();
    await page.waitForTimeout(250);
    const screenshot = await screenshotTarget.screenshot({
        animations: "disabled",
        omitBackground: true,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function expectSearchPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: string,
    productPanel: Locator,
    target: LibrarySearchPixelTarget,
    options: {
        maxChannelDelta?: number;
        maxDifferingPixels?: number;
    } = {},
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureSearchPixelDataUrl(
            sotPage,
            searchPixelLocator(sotSearchPanel(sotPage, state), target),
            target,
        ),
        captureSearchPixelDataUrl(
            page,
            searchPixelLocator(productPanel, target),
            target,
        ),
    ]);
    const diff = await page.evaluate(
        async ({ expected, actual }) => {
            const loadImage = (src: string) =>
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = () =>
                        reject(new Error(`Failed to decode screenshot ${src}`));
                    image.src = src;
                });
            const [expectedImage, actualImage] = await Promise.all([
                loadImage(expected),
                loadImage(actual),
            ]);

            if (
                expectedImage.naturalWidth !== actualImage.naturalWidth ||
                expectedImage.naturalHeight !== actualImage.naturalHeight
            ) {
                return {
                    dimensionsMatch: false,
                    differingPixels: -1,
                    expectedHeight: expectedImage.naturalHeight,
                    expectedWidth: expectedImage.naturalWidth,
                    maxChannelDelta: -1,
                    productHeight: actualImage.naturalHeight,
                    productWidth: actualImage.naturalWidth,
                };
            }

            const canvas = document.createElement("canvas");
            canvas.width = expectedImage.naturalWidth;
            canvas.height = expectedImage.naturalHeight;
            const context = canvas.getContext("2d", {
                willReadFrequently: true,
            });
            if (!context) {
                throw new Error("Canvas 2D context unavailable");
            }

            context.drawImage(expectedImage, 0, 0);
            const expectedData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(actualImage, 0, 0);
            const actualData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;

            let differingPixels = 0;
            let maxChannelDelta = 0;
            for (let index = 0; index < expectedData.length; index += 4) {
                const pixelDelta = Math.max(
                    Math.abs(expectedData[index] - actualData[index]),
                    Math.abs(expectedData[index + 1] - actualData[index + 1]),
                    Math.abs(expectedData[index + 2] - actualData[index + 2]),
                    Math.abs(expectedData[index + 3] - actualData[index + 3]),
                );
                if (pixelDelta > 0) {
                    differingPixels += 1;
                    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
                }
            }

            return {
                dimensionsMatch: true,
                differingPixels,
                expectedHeight: expectedImage.naturalHeight,
                expectedWidth: expectedImage.naturalWidth,
                maxChannelDelta,
                productHeight: actualImage.naturalHeight,
                productWidth: actualImage.naturalWidth,
            };
        },
        { actual: productCapture.dataUrl, expected: sotCapture.dataUrl },
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels !== 0 ||
        diff.maxChannelDelta !== 0
    ) {
        const name = `library-search-${state}-${target}`
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();
        await testInfo.attach(`${name}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    expect(diff.dimensionsMatch, `${state}/${target}`).toBe(true);
    expect(diff.productHeight, `${state}/${target}`).toBe(diff.expectedHeight);
    expect(diff.productWidth, `${state}/${target}`).toBe(diff.expectedWidth);
    expect(diff.differingPixels, `${state}/${target}`).toBeLessThanOrEqual(
        options.maxDifferingPixels ?? 0,
    );
    expect(diff.maxChannelDelta, `${state}/${target}`).toBeLessThanOrEqual(
        options.maxChannelDelta ?? 0,
    );
}

async function openLibrarySearch(page: Page) {
    const trigger = sotControl(page, "dashboard-search").first();
    const panel = sotPanel(page, "library-search");

    await expect(
        page.locator('[data-sot-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-sot-state", "ready");
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

function sotControl(page: Page, name: string) {
    return page.locator(`[data-sot-control="${name}"]`);
}

function sotPanel(page: Page, name: string) {
    return page.locator(`[data-sot-panel="${name}"]`);
}

function sotList(page: Page, name: string) {
    return page.locator(`[data-sot-list="${name}"]`);
}

function sotSearchResult(page: Page, type: string, index?: number) {
    const indexSelector =
        typeof index === "number" ? `[data-sot-result-index="${index}"]` : "";
    return page.locator(
        `[data-sot-control="library-search-result"][data-sot-result-type="${type}"]${indexSelector}`,
    );
}

async function selectDashboardRecordingForTagManager(
    page: Page,
    recordingId: string,
) {
    const allRecordingsFilter = page.locator(
        '[data-sot-control="dashboard-favorite"][data-sot-filter="all"]',
    );
    const recordingList = page.locator(
        '[data-sot-surface="dashboard-recording-list"]',
    );
    const recordingRow = page.locator(
        `[data-sot-control="dashboard-recording-row"][data-sot-recording-id="${recordingId}"]`,
    );

    await expect(allRecordingsFilter).toBeVisible();
    if (
        (await allRecordingsFilter.getAttribute("data-sot-state")) !==
        "selected"
    ) {
        await allRecordingsFilter.click();
    }
    await expect(recordingList).toHaveAttribute(
        "data-sot-list-mode",
        "timeline",
    );
    await expect(recordingList).toHaveAttribute("data-sot-state", "ready");
    await expect(recordingRow).toBeVisible();
    await recordingRow.click();
    await expect(recordingRow).toHaveAttribute("data-sot-state", "selected");
    await expect(dashboardPlayerTagManagerTrigger(page)).toBeVisible();
}

function dashboardPlayerTagManagerTrigger(page: Page) {
    return page
        .locator('[data-sot-surface="dashboard-recording-player"]')
        .locator('[data-sot-control="recording-tag-manager"]');
}

async function clickDashboardChromeOutsideTopbarOverlays(page: Page) {
    const outsideChromeTarget = page
        .locator(
            '[data-sot-surface="dashboard-workstation"] main [data-sot-part="dashboard-crumb-current"]',
        )
        .first();

    await expect(outsideChromeTarget).toBeVisible();
    const clickPoint = await outsideChromeTarget.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const x = rect.left + Math.min(8, Math.max(1, rect.width / 2));
        const y = rect.top + Math.min(8, Math.max(1, rect.height / 2));
        const hit = document.elementFromPoint(x, y);
        const unsafeTarget = hit?.closest(
            [
                "a",
                "button",
                "input",
                "select",
                "textarea",
                "nav",
                '[role="button"]',
                '[data-sot-control]',
            ].join(","),
        );

        return {
            hitTag: hit?.tagName ?? null,
            unsafeTarget: Boolean(unsafeTarget),
            x,
            y,
        };
    });

    expect(clickPoint.unsafeTarget, clickPoint.hitTag ?? "missing hit target").toBe(
        false,
    );
    await page.mouse.click(clickPoint.x, clickPoint.y);
}

async function openDashboardMoreMenu(page: Page) {
    const trigger = page.getByRole("button", { name: "更多操作" });
    const menu = page.getByRole("menu", { name: "更多操作" });

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
    panelName: "dashboard-activity" | "library-search",
) {
    const panel = sotPanel(page, panelName);
    await expect(panel).toBeVisible();

    const result = await panel.evaluate((node) => {
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
                bottomHit?.closest("[data-sot-panel]") === node,
            ),
            containsTopHit: Boolean(
                topHit?.closest("[data-sot-panel]") === node,
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
    });

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

async function expectOverlayAnchoredToTrigger(
    page: Page,
    panelName: "dashboard-activity" | "library-search",
    triggerName: "dashboard-activity" | "dashboard-search",
) {
    const panel = sotPanel(page, panelName);
    const trigger = sotControl(page, triggerName);
    await expect(panel).toBeVisible();
    await expect(trigger).toBeVisible();

    const metrics = await panel.evaluate((node, triggerId) => {
        const panelRect = node.getBoundingClientRect();
        const triggerNode = document.querySelector(
            `[data-sot-control="${triggerId}"]`,
        );
        if (!triggerNode) {
            throw new Error(`Missing trigger: ${triggerId}`);
        }
        const triggerRect = triggerNode.getBoundingClientRect();
        const expectedRight = Math.max(
            12,
            Math.round(window.innerWidth - triggerRect.right),
        );

        return {
            expectedRight,
            panelRightOffset: window.innerWidth - panelRect.right,
            panelTop: panelRect.top,
            triggerBottom: triggerRect.bottom,
        };
    }, triggerName);

    expect(Math.abs(metrics.panelTop - (metrics.triggerBottom + 8))).toBeLessThanOrEqual(16);
    expect(Math.abs(metrics.panelRightOffset - metrics.expectedRight)).toBeLessThanOrEqual(16);
}

async function expectViewportBoundOverlayLayout(
    page: Page,
    panelName: "dashboard-activity" | "library-search",
) {
    const panel = sotPanel(page, panelName);
    await expect(panel).toBeVisible();

    const metrics = await panel.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            width: rect.width,
        };
    });

    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
    expect(metrics.width).toBeGreaterThan(0);
    expect(metrics.width).toBeLessThanOrEqual(metrics.viewportWidth);
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

test("library search keeps Web/index five-chip scope canonical while matching component-library body primitives", async ({
    page,
}, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    await resetDisplaySettings(page, { theme: "light", uiLanguage: "zh-CN" });

    const sotPage = await page.context().newPage();
    const sotIndexPage = await page.context().newPage();
    try {
        await openSotComponentLibrary(sotPage);
        await openSotWebIndexSearch(sotIndexPage);

        let panel = await prepareSearchDashboard(page);
        await expect(panel).toHaveAttribute("data-state", "no-query");
        await expectCanonicalSearchScopeChips(
            await setSotWebIndexSearchState(sotIndexPage, "no-query"),
        );
        await expectCanonicalSearchScopeChips(panel);
        await expectSearchPixelMatch(
            page,
            testInfo,
            sotPage,
            "no-query",
            panel,
            "panel",
            { maxChannelDelta: 128, maxDifferingPixels: 1_000 },
        );

        let releaseLoading = () => {};
        const loadingGate = new Promise<void>((resolve) => {
            releaseLoading = resolve;
        });
        panel = await prepareSearchDashboard(page, async (route) => {
            await loadingGate;
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ results: [] }),
            });
        });
        await panel.locator('[data-sot-control="library-search-input"]').fill("周会");
        await expect(panel).toHaveAttribute("data-state", "loading");
        await expectCanonicalSearchScopeChips(
            await setSotWebIndexSearchState(sotIndexPage, "loading"),
        );
        await expectCanonicalSearchScopeChips(panel);
        await expectSearchPixelMatch(
            page,
            testInfo,
            sotPage,
            "loading",
            panel,
            "body",
            { maxChannelDelta: 128, maxDifferingPixels: 500 },
        );
        releaseLoading();
        await expect(panel).toHaveAttribute("data-state", "no-results");

        panel = await prepareSearchDashboard(page, async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    results: [
                        buildSearchResult({
                            entityType: "recording",
                            entityId: "sot-recording-alpha",
                            recordingId: "sot-recording-alpha",
                            title: "产品周会 · Q2 priorities review",
                            body: "产品周会",
                            source: "钉钉 · 今天 14:00 · 47:18",
                        }),
                        buildSearchResult({
                            entityType: "recording",
                            entityId: "sot-recording-beta",
                            recordingId: "sot-recording-beta",
                            title: "客服培训复盘 — 含周会跟进",
                            body: "客服培训复盘",
                            source: "TicNote · 昨天 15:00 · 33:42",
                        }),
                        buildSearchResult({
                            entityType: "transcript",
                            entityId: "sot-transcript-alpha",
                            recordingId: "sot-recording-alpha",
                            title: "产品周会",
                            body: "「这次周会主要对齐 Q2 priorities…」",
                            source: "dingtalk",
                            startMs: 192_000,
                            endMs: 210_000,
                        }),
                        buildSearchResult({
                            entityType: "tag",
                            entityId: "sot-tag-alpha",
                            recordingId: null,
                            title: "产品周会",
                            body: "2 条录音",
                            tags: ["产品周会"],
                            source: null,
                        }),
                    ],
                }),
            });
        });
        await panel.locator('[data-sot-control="library-search-input"]').fill("周会");
        await expect(panel).toHaveAttribute("data-state", "results");
        await expectCanonicalSearchScopeChips(
            await setSotWebIndexSearchState(sotIndexPage, "results"),
        );
        await expectCanonicalSearchScopeChips(panel);
        await expectSearchPixelMatch(
            page,
            testInfo,
            sotPage,
            "results",
            panel,
            "body",
            { maxChannelDelta: 256, maxDifferingPixels: 4_000 },
        );

        panel = await prepareSearchDashboard(page, async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ results: [] }),
            });
        });
        await panel.locator('[data-sot-control="library-search-input"]').fill("xyzqq");
        await expect(panel).toHaveAttribute("data-state", "no-results");
        await expectCanonicalSearchScopeChips(
            await setSotWebIndexSearchState(sotIndexPage, "no-results"),
        );
        await expectCanonicalSearchScopeChips(panel);
        await expectSearchPixelMatch(
            page,
            testInfo,
            sotPage,
            "no-results",
            panel,
            "body",
            { maxChannelDelta: 1, maxDifferingPixels: 8 },
        );

        panel = await prepareSearchDashboard(page, async (route) => {
            await route.fulfill({
                contentType: "application/json",
                status: 503,
                body: JSON.stringify({ error: "Search failed" }),
            });
        });
        await panel.locator('[data-sot-control="library-search-input"]').fill("周会");
        await expect(panel).toHaveAttribute("data-state", "error");
        await expectCanonicalSearchScopeChips(
            await setSotWebIndexSearchState(sotIndexPage, "error"),
        );
        await expectCanonicalSearchScopeChips(panel);
        await expectSearchPixelMatch(
            page,
            testInfo,
            sotPage,
            "error",
            panel,
            "body",
            { maxChannelDelta: 256, maxDifferingPixels: 3_000 },
        );

        panel = await prepareSearchDashboard(page, async (route) => {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    results: [],
                    indexing: {
                        active: true,
                        pendingJobs: 3,
                        indexingJobs: 2,
                        completedJobs: 2,
                        totalJobs: 5,
                    },
                }),
            });
        });
        await panel.locator('[data-sot-control="library-search-input"]').fill("周会");
        await expect(panel).toHaveAttribute("data-state", "indexing");
        await expectCanonicalSearchScopeChips(sotSearchPanel(sotPage, "indexing"));
        await expectCanonicalSearchScopeChips(panel);
        await expectSearchPixelMatch(
            page,
            testInfo,
            sotPage,
            "indexing",
            panel,
            "panel",
            { maxChannelDelta: 128, maxDifferingPixels: 2_000 },
        );
    } finally {
        await page.unroute("**/api/search?**").catch(() => undefined);
        await sotPage.close();
        await sotIndexPage.close();
    }
});

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
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = await openLibrarySearch(page);
    await expect(panel).toBeVisible();

    const input = panel.locator('[data-sot-control="library-search-input"]');
    await input.fill("retry-check");
    const errorState = panel.locator('[data-sot-part="library-search-error"]');
    await expect(errorState).toHaveAttribute("data-sot-state", "error");
    await expect(
        errorState.locator('[data-sot-part="library-search-state-title"]'),
    ).toHaveText("检索失败 · 请稍后再试");
    await expect(
        errorState.locator('[data-sot-part="library-search-state-copy"]'),
    ).toHaveCount(0);

    await sotControl(page, "library-search-retry").click();
    await expect(panel).toHaveAttribute("data-sot-state", "no-results");

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(sotControl(page, "dashboard-search")).toBeFocused();
});

test("library search restores the SOT indexing state while the local index rebuilds", async ({
    page,
}) => {
    await page.route("**/api/search?**", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                results: [],
                indexing: {
                    active: true,
                    pendingJobs: 3,
                    indexingJobs: 2,
                    completedJobs: 0,
                    totalJobs: 5,
                },
            }),
        });
    });

    await ensureSignedIn(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = await openLibrarySearch(page);
    const input = panel.locator('[data-sot-control="library-search-input"]');

    await input.fill("周会");
    await expect(panel).toHaveAttribute("data-state", "indexing");
    await expect(panel).toHaveAttribute("data-sot-state", "indexing");
    await expect(input).toHaveAttribute("aria-disabled", "true");
    await expect(input).toHaveJSProperty("readOnly", true);
    await expect(
        panel.locator('[data-sot-part="library-search-indexing"]'),
    ).toContainText("正在重建本地搜索索引 · 0 / 5 来源完成");
    await expect(
        panel.locator('[data-sot-part="library-search-indexing"]'),
    ).toHaveAttribute("data-sot-state", "indexing");
    await expect(
        panel.locator('[data-sot-part="library-search-state-skeleton"]'),
    ).toBeVisible();
    await expect(sotControl(page, "library-search-scope")).toHaveCount(5);
    await expect(
        sotControl(page, "library-search-scope").filter({ hasText: "全部" }),
    ).toBeDisabled();
    await expect(
        sotControl(page, "library-search-scope").filter({ hasText: "录音" }),
    ).toBeDisabled();
    await expect(
        sotControl(page, "library-search-scope").filter({ hasText: "逐字稿" }),
    ).toBeDisabled();
    await expect(
        sotControl(page, "library-search-scope").filter({ hasText: "说话人" }),
    ).toBeDisabled();
    await expect(
        sotControl(page, "library-search-scope").filter({ hasText: "标签" }),
    ).toBeDisabled();
    await expect(sotList(page, "library-search-results")).toHaveCount(0);
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

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = await openLibrarySearch(page);
    await expect(panel).toBeVisible();

    const input = panel.locator('[data-sot-control="library-search-input"]');
    await expect(input).not.toHaveAttribute("role", "combobox");
    await expect(input).toHaveAttribute("placeholder", "搜索录音、转写、说话人、标签");
    await input.fill("Alpha");

    await expect(sotList(page, "library-search-results")).toBeVisible();
    await expect(sotList(page, "library-search-results")).toHaveAttribute(
        "data-sot-state",
        "results",
    );
    await expect(panel.locator(".ls-result")).toHaveCount(0);
    await expect(sotControl(page, "library-search-result")).toHaveCount(4);
    await expect(
        panel
            .locator('[data-sot-part="library-search-result-title"]')
            .first(),
    ).toBeVisible();
    await expect(
        panel.locator('[data-sot-part="library-search-result-meta"]').first(),
    ).toBeVisible();
    await expect(
        page.locator('[data-sot-group="library-search-results"][data-sot-result-type="recording"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-sot-group="library-search-results"][data-sot-result-type="transcript"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-sot-group="library-search-results"][data-sot-result-type="speaker"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-sot-group="library-search-results"][data-sot-result-type="tag"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-sot-part="library-search-highlight"]').first(),
    ).toBeVisible();

    const speakerResult = sotSearchResult(page, "speaker");
    await expect(speakerResult).toHaveAttribute("data-sot-result-mode", "filter");

    const tagResult = sotSearchResult(page, "tag");
    await expect(tagResult).toHaveAttribute("data-sot-result-mode", "filter");
    await tagResult.click();

    await expect(panel).toBeHidden();
    const searchFilter = sotPanel(page, "dashboard-library-search-filter");
    await expect(searchFilter).toBeVisible();
    await expect(searchFilter).toHaveAttribute("data-sot-filter", "tag");
    await expect(searchFilter).toContainText("Alpha tag");
    const searchFilterChip = searchFilter.locator(
        '[data-sot-part="library-search-filter-chip"]',
    );
    await expect(searchFilterChip).toBeVisible();

    await sotControl(page, "library-search-filter-clear").click();
    await expect(searchFilter).toBeHidden();
});

test("library search clear button resets query results and focus", async ({
    page,
}) => {
    const requestedQueries: string[] = [];
    await mockLibrarySearchResults(
        page,
        [
            buildSearchResult({
                entityId: "tag-alpha-clear",
                title: "Alpha clear tag",
                body: "Alpha clear search result",
                tags: ["Alpha clear"],
            }),
        ],
        (url) => requestedQueries.push(url.searchParams.get("q") ?? ""),
    );

    await ensureSignedIn(page);
    await resetDisplaySettings(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const panel = await openLibrarySearch(page);
    const input = panel.locator('[data-sot-control="library-search-input"]');
    await input.fill("Alpha");

    await expect(sotList(page, "library-search-results")).toBeVisible();
    await expect(
        page.locator('[data-sot-part="library-search-highlight"]').first(),
    ).toBeVisible();
    await expect(sotSearchResult(page, "tag", 0)).toContainText("Alpha clear tag");

    const clearButton = panel.locator(
        '[data-sot-control="library-search-clear"]',
    );
    await expect(clearButton).toBeVisible();
    await expect(clearButton).toHaveAccessibleName("清空");
    await clearButton.click();

    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(panel).toHaveAttribute("data-sot-state", "no-query");
    await expect(
        panel.locator('[data-sot-part="library-search-empty"]'),
    ).toBeVisible();
    await expect(sotList(page, "library-search-results")).toHaveCount(0);
    await expect(
        page.locator('[data-sot-part="library-search-highlight"]'),
    ).toHaveCount(0);
    await expect(sotSearchResult(page, "tag", 0)).toHaveCount(0);
    await expect(page.getByText("没有找到与「Alpha」相关的内容")).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(requestedQueries).not.toContain("");
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
    const input = panel.locator('[data-sot-control="library-search-input"]');
    await input.fill("Alpha");
    await expect(sotList(page, "library-search-results")).toHaveAttribute(
        "data-sot-state",
        "results",
    );

    for (let index = 0; index < 11; index += 1) {
        await page.keyboard.press("ArrowDown");
    }

    const activeResult = sotSearchResult(page, "tag", 11);
    await expect(activeResult).toHaveAttribute("data-sot-state", "active");
    await expect(activeResult).toBeInViewport();

    const activeResultIsInsideScroller = await activeResult.evaluate((node) => {
        const scrollRegion = node.closest(
            '[data-sot-region="library-search-scroll"]',
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
    const searchFilter = sotPanel(page, "dashboard-library-search-filter");
    await expect(searchFilter).toBeVisible();
    await expect(searchFilter).toHaveAttribute("data-sot-filter", "tag");
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
        `[data-sot-recording-id="${SEARCH_OTHER_RECORDING_ID}"]`,
    );
    const targetRecording = page.locator(
        `[data-sot-recording-id="${SEARCH_RECORDING_ID}"]`,
    );
    await expect(otherRecording).toHaveAttribute("data-sot-state", "selected");
    await expect(targetRecording).toHaveAttribute("data-sot-state", "idle");

    const panel = await openLibrarySearch(page);
    const input = panel.locator('[data-sot-control="library-search-input"]');
    await input.fill("Alpha");
    await expect(sotList(page, "library-search-results")).toBeVisible();

    await sotControl(page, "library-search-scope")
        .filter({ hasText: "逐字稿" })
        .click();
    await transcriptSearchStarted;
    await expect(input).toBeFocused();
    await expect(
        panel.locator('[data-sot-part="library-search-loading"]'),
    ).toBeVisible();
    releaseTranscriptSearch();
    await expect
        .poll(() => requestedTypes)
        .toContain("transcript");
    await expect(sotSearchResult(page, "transcript", 1)).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(sotSearchResult(page, "transcript", 1)).toHaveAttribute(
        "data-sot-state",
        "active",
    );
    await page.keyboard.press("Enter");

    await expect(panel).toBeHidden();
    await expect(targetRecording).toHaveAttribute("data-sot-state", "selected");
    await expect(otherRecording).toHaveAttribute("data-sot-state", "idle");
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
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await selectDashboardRecordingForTagManager(
        page,
        SEARCH_OTHER_RECORDING_ID,
    );

    const searchTrigger = sotControl(page, "dashboard-search");
    const searchPanel = sotPanel(page, "library-search");
    const activityTrigger = sotControl(page, "dashboard-activity");
    const activityPanel = sotPanel(page, "dashboard-activity");
    const settingsTrigger = sotControl(page, "dashboard-settings");
    const moreMenu = page.getByRole("menu", { name: "更多操作" });
    const tagManagerTrigger = dashboardPlayerTagManagerTrigger(page);
    const tagManager = sotPanel(page, "recording-tag-manager");

    await openDashboardMoreMenu(page);

    await openLibrarySearch(page);
    await expect(moreMenu).toBeHidden();
    await expect(searchPanel).toBeVisible();
    await expectOverlayAnchoredToTrigger(
        page,
        "library-search",
        "dashboard-search",
    );
    await expectOverlayHitTarget(page, "library-search");

    await clickDashboardChromeOutsideTopbarOverlays(page);
    await expect(searchPanel).toHaveCount(0);

    await tagManagerTrigger.click();
    await expect(tagManager).toBeVisible();
    await openLibrarySearch(page);
    await expect(tagManager).toBeHidden();
    await expect(searchPanel).toBeVisible();
    await activityTrigger.click();
    await expect(searchPanel).toHaveCount(0);
    await expect(activityPanel).toBeVisible();
    await expectOverlayAnchoredToTrigger(
        page,
        "dashboard-activity",
        "dashboard-activity",
    );
    await expectOverlayHitTarget(page, "dashboard-activity");
    await expect(activityTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(searchTrigger).toHaveAttribute("aria-expanded", "false");

    await clickDashboardChromeOutsideTopbarOverlays(page);
    await expect(activityPanel).toHaveCount(0);
    await openDashboardMoreMenu(page);
    await activityTrigger.click();
    await expect(moreMenu).toBeHidden();
    await expect(activityPanel).toBeVisible();

    await openLibrarySearch(page);
    await expect(activityPanel).toHaveCount(0);
    await expect(searchPanel).toBeVisible();
    await expect(searchTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(activityTrigger).toHaveAttribute("aria-expanded", "false");

    await page.getByRole("button", { name: "更多操作" }).focus();
    await page.keyboard.press("Enter");
    await expect(searchPanel).toHaveCount(0);
    await expect(moreMenu).toBeVisible();

    await openLibrarySearch(page);
    await expect(moreMenu).toBeHidden();
    await tagManagerTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(searchPanel).toHaveCount(0);
    await expect(tagManager).toBeVisible();

    await settingsTrigger.click();
    await expect(tagManager).toBeHidden();
    await expect(searchPanel).toHaveCount(0);
    await expect(activityPanel).toHaveCount(0);
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toBeVisible();

    await sotControl(page, "settings-close").click();
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toBeHidden();

    await tagManagerTrigger.click();
    await expect(tagManager).toBeVisible();
    await settingsTrigger.click();
    await expect(tagManager).toBeHidden();
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toBeVisible();

    await sotControl(page, "settings-close").click();
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toBeHidden();

    await activityTrigger.click();
    await expect(activityPanel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(activityPanel).toHaveCount(0);
    await expect(activityTrigger).toBeFocused();

    await page.setViewportSize({ width: 820, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await openLibrarySearch(page);
    await expect(searchPanel).toBeVisible();
    await expectViewportBoundOverlayLayout(page, "library-search");
    await expectOverlayHitTarget(page, "library-search");

    await page.setViewportSize({ width: 390, height: 740 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await openLibrarySearch(page);
    await expect(searchPanel).toBeVisible();
    await expectViewportBoundOverlayLayout(page, "library-search");
    await expectOverlayHitTarget(page, "library-search");

    await activityTrigger.click();
    await expect(searchPanel).toHaveCount(0);
    await expect(activityPanel).toBeVisible();
    await expectViewportBoundOverlayLayout(page, "dashboard-activity");
    await expectOverlayHitTarget(page, "dashboard-activity");
});

test("library search follows display language across visible copy and aria labels", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetDisplaySettings(page, { uiLanguage: "en" });
    await mockLibrarySearchResults(page, []);

    try {
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        await expect(sotControl(page, "dashboard-search").first()).toHaveAttribute(
            "aria-label",
            "Search",
        );

        const panel = await openLibrarySearch(page);
        await expect(panel).toHaveAttribute("aria-label", "Search library");

        const input = panel.locator('[data-sot-control="library-search-input"]');
        await expect(input).toHaveAttribute(
            "placeholder",
            "Search recordings, transcripts, speakers, tags",
        );
        await expect(panel.getByText("All", { exact: true })).toBeVisible();
        await expect(
            panel.getByText("Recordings", { exact: true }),
        ).toBeVisible();
        await expect(
            panel.locator('[data-sot-part="library-search-empty"]'),
        ).toContainText(
            "Search recordings, transcript segments, speakers, or tags",
        );

        await input.fill("Alpha");
        await expect(
            panel.locator('[data-sot-part="library-search-empty"]'),
        ).toContainText('No content found for "Alpha"');
    } finally {
        await resetDisplaySettings(page);
    }
});
