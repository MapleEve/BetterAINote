import { expect, type Page, type Response, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    getPaginationTestUserId,
    PAGINATION_FILTER_TERM,
    PAGINATION_RECORDING_COUNT,
    PAGINATION_RECORDING_ID_PREFIX,
    readPaginationDatabaseState,
    resetPaginationTestDatabase,
    seedPaginationRecordings,
} from "./helpers/recording-pagination-database";

type PaginationPayload = {
    pagination: { page: number; pageSize: number; total: number };
    recordings: Array<{ id: string }>;
};

async function readPaginationPayload(response: Response) {
    expect(response.ok()).toBe(true);
    return (await response.json()) as PaginationPayload;
}

function paginationPreviousButton(page: Page) {
    return page.getByRole("button", { name: /^(上一页|Previous page)$/ });
}

function paginationNextButton(page: Page) {
    return page.getByRole("button", { name: /^(下一页|Next page)$/ });
}

function paginationPageNumber(page: Page, pageNumber: number) {
    return page.getByText(`${pageNumber} / 3`, { exact: true });
}

function recordingRow(page: Page, index: number) {
    const title =
        index <= 2
            ? `E2E ${PAGINATION_FILTER_TERM} ${index}`
            : `E2E pagination recording ${index}`;
    return page.getByRole("button", { name: new RegExp(`^${title}\\b`) });
}

test.describe("recording pagination with the real query API", () => {
    test.beforeEach(async ({ page }) => {
        await ensureSignedIn(page);
        const userId = await getPaginationTestUserId();
        await resetPaginationTestDatabase(userId);
        await seedPaginationRecordings(userId);
        await expect
            .poll(() => readPaginationDatabaseState(userId))
            .toHaveLength(PAGINATION_RECORDING_COUNT);

        const settingsResponse = await page.request.put("/api/settings/display", {
            data: { itemsPerPage: 10 },
        });
        expect(settingsResponse.ok()).toBe(true);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "全部录音" })).toBeVisible();
        await expect(paginationPageNumber(page, 1)).toBeVisible();
    });

    test.afterEach(async () => {
        const userId = await getPaginationTestUserId();
        await resetPaginationTestDatabase(userId);
        await expect
            .poll(() => readPaginationDatabaseState(userId))
            .toEqual([]);
    });

    test("moves between real API pages, disables boundaries, and resets on search", async ({
        page,
    }) => {
        const pagination = page.locator('[data-panel="recording-list-pagination"]');
        const previous = paginationPreviousButton(page);
        const next = paginationNextButton(page);

        await expect(pagination).toHaveAttribute("data-state", "paginated-first");
        await expect(previous).toBeDisabled();
        await expect(recordingRow(page, 1)).toBeVisible();

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
        const pageTwo = await readPaginationPayload(await pageTwoResponse);
        expect(pageTwo.pagination).toEqual({
            page: 2,
            pageSize: 10,
            total: PAGINATION_RECORDING_COUNT,
        });
        await expect(paginationPageNumber(page, 2)).toBeVisible();
        await expect(recordingRow(page, 11)).toBeVisible();

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
        const pageThree = await readPaginationPayload(await pageThreeResponse);
        expect(pageThree.pagination).toEqual({
            page: 3,
            pageSize: 10,
            total: PAGINATION_RECORDING_COUNT,
        });
        await expect(pagination).toHaveAttribute("data-state", "paginated-last");
        await expect(next).toBeDisabled();
        await expect(recordingRow(page, 21)).toBeVisible();

        await page.getByRole("button", { name: /^(搜索|Search)$/ }).click();
        const searchDialog = page.getByRole("dialog", {
            name: /^(搜索库|Search library)$/,
        });
        const searchInput = searchDialog.getByRole("combobox");
        const filteredPageResponse = page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
                url.pathname === "/api/recordings/query" &&
                url.searchParams.get("page") === "1" &&
                url.searchParams.get("query") === PAGINATION_FILTER_TERM &&
                response.request().method() === "GET" &&
                response.status() === 200
            );
        });
        await searchInput.fill(PAGINATION_FILTER_TERM);
        const filteredPage = await readPaginationPayload(
            await filteredPageResponse,
        );
        expect(filteredPage.pagination).toEqual({
            page: 1,
            pageSize: 10,
            total: 2,
        });
        await expect(recordingRow(page, 1)).toBeVisible();
        await expect(recordingRow(page, 2)).toBeVisible();
        await expect(recordingRow(page, 21)).toHaveCount(0);
    });

    test("shows a retryable list error and recovers through the real query API", async ({
        page,
    }) => {
        const list = page.locator('[data-surface="dashboard-recording-list"]');
        const next = paginationNextButton(page);

        await expect(list).toHaveAttribute("data-list-state", "ready");
        await expect(next).toBeEnabled();

        await page.context().setOffline(true);
        await next.click();

        await expect(list).toHaveAttribute("data-list-state", "error");
        await expect(list.getByText("无法读取录音列表")).toBeVisible();
        await expect(
            list.getByRole("button", { name: "清除筛选" }),
        ).toHaveCount(0);
        const retry = list.getByRole("button", { name: "重试" });
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
        const recoveredPage = await readPaginationPayload(
            await recoveredPageResponse,
        );
        expect(recoveredPage.pagination).toEqual({
            page: 2,
            pageSize: 10,
            total: PAGINATION_RECORDING_COUNT,
        });

        await expect(list).toHaveAttribute("data-list-state", "ready");
        await expect(recordingRow(page, 11)).toBeVisible();
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
        expect(body.pagination).toEqual({
            page: 3,
            pageSize: 10,
            total: PAGINATION_RECORDING_COUNT,
        });
        expect(body.recordings.map((recording) => recording.id)).toEqual([
            `${PAGINATION_RECORDING_ID_PREFIX}${PAGINATION_RECORDING_COUNT}`,
        ]);

        const userId = await getPaginationTestUserId();
        expect(await readPaginationDatabaseState(userId)).toHaveLength(
            PAGINATION_RECORDING_COUNT,
        );
    });
});
