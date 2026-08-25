import { expect, type Page, test, type TestInfo } from "@playwright/test";
import { ensureSignedIn, putJsonWithRetry } from "./helpers/auth";
import {
    cleanupDashboardTagTriggerSeed,
    expectedDashboardTagTriggerDatabaseState,
    readDashboardTagTriggerApiTags,
    readDashboardTagTriggerDatabaseState,
    seedDashboardTagTriggerData,
} from "./helpers/dashboard-tag-filter-state-seed";

const DASHBOARD_FILTER_STATE_STORAGE_KEY =
    "dashboard-recording-filter-state";
const DASHBOARD_SOURCE_FILTER_STORAGE_KEY =
    "dashboard-source-filter-provider";

function favorite(page: Page, value: "all" | "tags" | "transcribed") {
    return page.locator(`[data-favorite="${value}"]`);
}

function listMode(page: Page, value: "tags" | "timeline") {
    return page
        .getByRole("tablist", { name: "列表模式" })
        .getByRole("tab", {
            exact: true,
            name: value === "tags" ? "标签" : "时间",
        });
}

function tagTrigger(page: Page) {
    return page.locator(
        '[data-control="recording-list-tag-filter-trigger"]',
    );
}

async function expectTagTrigger(
    page: Page,
    { count, label }: { count: number; label: string },
) {
    const trigger = tagTrigger(page);
    await expect(trigger).toBeVisible();
    await expect(
        trigger.locator('[data-part="recording-list-tag-filter-label"]'),
    ).toHaveText(label);
    await expect(
        trigger.locator('[data-part="recording-list-tag-filter-count"]'),
    ).toHaveText(String(count));
    return trigger;
}

function waitForRecordingQuery(
    page: Page,
    expected: {
        favorite?: "tags" | "transcribed" | null;
        source?: string | null;
        tagId?: string | null;
    },
) {
    return page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            url.pathname === "/api/recordings/query" &&
            url.searchParams.get("favorite") ===
                (expected.favorite ?? null) &&
            url.searchParams.get("source") === (expected.source ?? null) &&
            url.searchParams.get("tagId") === (expected.tagId ?? null)
        );
    });
}

async function selectTag(page: Page, tagId: string, label: string) {
    const trigger = tagTrigger(page);
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const option = page.locator(`[data-tag-value="tag:${tagId}"]`);
    await expect(option).toContainText(label);
    await option.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
}

async function setChineseDisplay(page: Page) {
    const response = await putJsonWithRetry(page, "/api/settings/display", {
        dateTimeFormat: "relative",
        itemsPerPage: 50,
        recordingListSortOrder: "newest",
        theme: "dark",
        uiLanguage: "zh-CN",
    });
    expect(response.status()).toBe(200);
}

async function readStoredFilterState(page: Page) {
    return page.evaluate((storageKey) => {
        const value = window.localStorage.getItem(storageKey);
        return value ? JSON.parse(value) : null;
    }, DASHBOARD_FILTER_STATE_STORAGE_KEY);
}

async function attachCurrentGeometry(page: Page, testInfo: TestInfo) {
    const box = await tagTrigger(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBe(354);
    expect(box?.height).toBe(32);
    await testInfo.attach("tag-trigger-current-geometry.json", {
        body: Buffer.from(
            JSON.stringify(
                {
                    current: box,
                    previousRealProduct: { height: 32, width: 354 },
                    previousSot: { height: 31, width: 276 },
                    previousSotDifferingPixels: 11_324,
                    previousSotMaxChannelDelta: 255,
                },
                null,
                2,
            ),
        ),
        contentType: "application/json",
    });
}

test("tag mode, Favorites, source and explicit tag state compose deterministically", async ({
    page,
}, testInfo) => {
    await ensureSignedIn(page);
    const { tags, userId } = await seedDashboardTagTriggerData(page);
    const productTag = tags.find((tag) => tag.name === "产品周会");
    const customerTag = tags.find((tag) => tag.name === "客户访谈");
    expect(productTag).toBeDefined();
    expect(customerTag).toBeDefined();

    try {
        await setChineseDisplay(page);
        await page.evaluate(
            ({ filterKey, sourceKey }) => {
                window.localStorage.removeItem(filterKey);
                window.localStorage.setItem(sourceKey, "ticnote");
            },
            {
                filterKey: DASHBOARD_FILTER_STATE_STORAGE_KEY,
                sourceKey: DASHBOARD_SOURCE_FILTER_STORAGE_KEY,
            },
        );

        const initialQuery = waitForRecordingQuery(page, {
            source: "ticnote",
        });
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        expect((await initialQuery).ok()).toBe(true);
        await expect(favorite(page, "all")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        await expect(listMode(page, "timeline")).toHaveAttribute(
            "aria-selected",
            "true",
        );

        const tagModeQuery = waitForRecordingQuery(page, {
            source: "ticnote",
        });
        await listMode(page, "tags").click();
        expect((await tagModeQuery).ok()).toBe(true);
        await expect(listMode(page, "tags")).toHaveAttribute(
            "aria-selected",
            "true",
        );
        await expect(favorite(page, "all")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        await expectTagTrigger(page, { count: 6, label: "全部" });

        const explicitFavoriteQuery = waitForRecordingQuery(page, {
            favorite: "tags",
            source: "ticnote",
        });
        await favorite(page, "tags").click();
        expect((await explicitFavoriteQuery).ok()).toBe(true);
        await expect(favorite(page, "tags")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        await expectTagTrigger(page, { count: 3, label: "全部" });

        const clearFavoriteQuery = waitForRecordingQuery(page, {
            source: "ticnote",
        });
        await favorite(page, "all").click();
        expect((await clearFavoriteQuery).ok()).toBe(true);
        await expect(listMode(page, "tags")).toHaveAttribute(
            "aria-selected",
            "true",
        );
        await expectTagTrigger(page, { count: 6, label: "全部" });
        await expect
            .poll(() =>
                page.evaluate(
                    (storageKey) => window.localStorage.getItem(storageKey),
                    DASHBOARD_SOURCE_FILTER_STORAGE_KEY,
                ),
            )
            .toBe("ticnote");

        const productQuery = waitForRecordingQuery(page, {
            source: "ticnote",
            tagId: productTag?.id,
        });
        await selectTag(page, productTag?.id ?? "", "产品周会");
        expect((await productQuery).ok()).toBe(true);
        await expectTagTrigger(page, { count: 2, label: "产品周会" });

        await expect.poll(() => readStoredFilterState(page)).toEqual({
            favorite: "all",
            listMode: "tags",
            selectedTagFilter: `tag:${productTag?.id}`,
        });
        expect(new URL(page.url()).searchParams.get("mode")).toBe("tags");
        expect(new URL(page.url()).searchParams.get("tagId")).toBe(
            productTag?.id,
        );

        const reloadQuery = waitForRecordingQuery(page, {
            source: "ticnote",
            tagId: productTag?.id,
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        expect((await reloadQuery).ok()).toBe(true);
        await expectTagTrigger(page, { count: 2, label: "产品周会" });
        await expect(listMode(page, "tags")).toHaveAttribute(
            "aria-selected",
            "true",
        );

        const composedFavoriteQuery = waitForRecordingQuery(page, {
            favorite: "tags",
            source: "ticnote",
            tagId: productTag?.id,
        });
        await favorite(page, "tags").click();
        expect((await composedFavoriteQuery).ok()).toBe(true);
        await expectTagTrigger(page, { count: 2, label: "产品周会" });

        const allQuery = waitForRecordingQuery(page, {
            source: "ticnote",
        });
        await favorite(page, "all").click();
        expect((await allQuery).ok()).toBe(true);
        await expectTagTrigger(page, { count: 6, label: "全部" });
        await expect(listMode(page, "tags")).toHaveAttribute(
            "aria-selected",
            "true",
        );
        expect(new URL(page.url()).searchParams.get("favorite")).toBeNull();
        expect(new URL(page.url()).searchParams.get("tagId")).toBeNull();
        expect(new URL(page.url()).searchParams.get("mode")).toBe("tags");

        const urlOverrideQuery = waitForRecordingQuery(page, {
            favorite: "tags",
            source: "ticnote",
            tagId: customerTag?.id,
        });
        await page.goto(
            `/dashboard?mode=tags&favorite=tags&tagId=${encodeURIComponent(customerTag?.id ?? "")}`,
            { waitUntil: "domcontentloaded" },
        );
        expect((await urlOverrideQuery).ok()).toBe(true);
        await expectTagTrigger(page, { count: 1, label: "客户访谈" });
        await expect(favorite(page, "tags")).toHaveAttribute(
            "aria-pressed",
            "true",
        );
        await expect(listMode(page, "tags")).toHaveAttribute(
            "aria-selected",
            "true",
        );

        expect(await readDashboardTagTriggerDatabaseState(userId)).toEqual(
            expectedDashboardTagTriggerDatabaseState(),
        );
        expect(await readDashboardTagTriggerApiTags(page)).toHaveLength(6);
        await attachCurrentGeometry(page, testInfo);
    } finally {
        await cleanupDashboardTagTriggerSeed(userId);
    }
});
