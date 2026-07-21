import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const PLAYWRIGHT_USER_EMAIL = "playwright-admin@example.com";
const RECORDING_ID_PREFIX = "e2e-recording-pagination-";
const FILTER_TERM = "pagination-filter-target";

function resolveDatabasePath() {
    const configuredPath = process.env.DATABASE_PATH;
    if (!configuredPath) {
        throw new Error("DATABASE_PATH is required for pagination E2E");
    }
    return path.resolve(process.cwd(), configuredPath);
}

function resolveE2ERoot() {
    const configuredRoot = process.env.PLAYWRIGHT_E2E_ROOT;
    if (!configuredRoot) {
        throw new Error("PLAYWRIGHT_E2E_ROOT is required for pagination E2E");
    }
    return path.resolve(configuredRoot);
}

function assertE2EPath(filePath: string) {
    const root = resolveE2ERoot();
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(`${root}${path.sep}`)) {
        throw new Error(`Refusing non-E2E database path: ${resolvedPath}`);
    }
}

function databaseUrl(filePath: string) {
    assertE2EPath(filePath);
    return pathToFileURL(filePath).href;
}

function siblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext || ".db"}`);
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = siblingDatabasePath(CORE_DB, "library");

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

async function seedRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    try {
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${RECORDING_ID_PREFIX}%`],
        });

        for (let index = 1; index <= 21; index += 1) {
            const id = `${RECORDING_ID_PREFIX}${index}`;
            const filename =
                index <= 2
                    ? `E2E ${FILTER_TERM} ${index}`
                    : `E2E pagination recording ${index}`;
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
                    id,
                    userId,
                    "ticnote",
                    `${id}-source`,
                    "1",
                    "{}",
                    "e2e-pagination-device",
                    filename,
                    60_000,
                    now - index * 60_000,
                    now - index * 60_000 + 60_000,
                    1024,
                    id,
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

test.describe("recording pagination with the real query API", () => {
    test.beforeEach(async ({ page }) => {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        await seedRecordings(userId);

        const settingsResponse = await page.request.put("/api/settings/display", {
            data: { itemsPerPage: 10 },
        });
        expect(settingsResponse.ok()).toBe(true);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator('[data-list="dashboard-recording-rows"]')).toBeVisible();
    });

    test("moves between real API pages, disables boundaries, and resets on search", async ({
        page,
    }) => {
        const pagination = page.locator('[data-panel="recording-list-pagination"]');
        const previous = page.locator('[data-control="recording-list-prev-page"]');
        const next = page.locator('[data-control="recording-list-next-page"]');

        await expect(pagination).toHaveAttribute("data-state", "paginated-first");
        await expect(previous).toBeDisabled();
        await expect(page.locator('[data-recording-id="e2e-recording-pagination-1"]')).toBeVisible();

        const pageTwoResponse = page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
                url.pathname === "/api/recordings/query" &&
                url.searchParams.get("page") === "2" &&
                response.request().method() === "GET" &&
                response.status() === 200
            );
        });
        await next.click();
        await pageTwoResponse;
        await expect(pagination.locator('[data-part="recording-list-page-number"]')).toHaveText(
            "2 / 3",
        );
        await expect(page.locator('[data-recording-id="e2e-recording-pagination-11"]')).toBeVisible();

        const pageThreeResponse = page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
                url.pathname === "/api/recordings/query" &&
                url.searchParams.get("page") === "3" &&
                response.request().method() === "GET" &&
                response.status() === 200
            );
        });
        await next.click();
        await pageThreeResponse;
        await expect(pagination).toHaveAttribute("data-state", "paginated-last");
        await expect(next).toBeDisabled();
        await expect(page.locator('[data-recording-id="e2e-recording-pagination-21"]')).toBeVisible();

        await page.locator('[data-control="dashboard-search"]').click();
        const searchInput = page.locator('[data-control="library-search-input"]');
        const filteredPageResponse = page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
                url.pathname === "/api/recordings/query" &&
                url.searchParams.get("page") === "1" &&
                url.searchParams.get("query") === FILTER_TERM &&
                response.request().method() === "GET" &&
                response.status() === 200
            );
        });
        await searchInput.fill(FILTER_TERM);
        await filteredPageResponse;
        await expect(page.locator('[data-recording-id="e2e-recording-pagination-1"]')).toBeVisible();
        await expect(page.locator('[data-recording-id="e2e-recording-pagination-2"]')).toBeVisible();
        await expect(page.locator('[data-recording-id="e2e-recording-pagination-21"]')).toHaveCount(0);
    });

    test("shows a retryable list error and recovers through the real query API", async ({
        page,
    }) => {
        const list = page.locator('[data-surface="dashboard-recording-list"]');
        const next = page.locator('[data-control="recording-list-next-page"]');

        await expect(list).toHaveAttribute("data-list-state", "ready");
        await expect(next).toBeEnabled();

        await page.context().setOffline(true);
        await next.click();

        await expect(list).toHaveAttribute("data-list-state", "error");
        await expect(list.getByText("无法读取录音列表")).toBeVisible();
        await expect(
            page.locator('[data-control="recording-list-clear-filters"]'),
        ).toHaveCount(0);
        const retry = page.locator('[data-control="recording-list-retry"]');
        await expect(retry).toBeVisible();
        await retry.focus();
        await expect(retry).toBeFocused();

        await page.context().setOffline(false);
        const recoveredPageResponse = page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
                url.pathname === "/api/recordings/query" &&
                url.searchParams.get("page") === "2" &&
                response.request().method() === "GET" &&
                response.status() === 200
            );
        });
        await retry.press("Enter");
        await recoveredPageResponse;

        await expect(list).toHaveAttribute("data-list-state", "ready");
        await expect(
            page.locator('[data-recording-id="e2e-recording-pagination-11"]'),
        ).toBeVisible();
    });

    test("clamps a stale overlarge page through the authenticated query API", async ({
        page,
    }) => {
        const response = await page.request.get(
            "/api/recordings/query?includeTranscript=1&page=99&pageSize=10",
        );
        expect(response.ok()).toBe(true);
        const body = (await response.json()) as {
            pagination: { page: number; pageSize: number; total: number };
            recordings: Array<{ id: string }>;
        };
        expect(body.pagination).toEqual({ page: 3, pageSize: 10, total: 21 });
        expect(body.recordings.map((recording) => recording.id)).toEqual([
            "e2e-recording-pagination-21",
        ]);
    });
});
