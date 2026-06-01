import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

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

test("display settings language switches copy immediately via the shared store", async ({
    page,
}) => {
    await ensureSignedIn(page);

    await resetDisplaySettings(page);

    let resolvePendingUpdate = () => {};
    let notifyUpdateStarted = () => {};
    const updateStarted = new Promise<void>((resolve) => {
        notifyUpdateStarted = resolve;
    });
    const pendingUpdate = new Promise<void>((resolve) => {
        resolvePendingUpdate = resolve;
    });

    await page.route("**/api/settings/display", async (route) => {
        if (route.request().method() !== "PUT") {
            await route.continue();
            return;
        }

        notifyUpdateStarted();
        await pendingUpdate;
        await route.continue();
    });

    await page.goto("/settings#display", { waitUntil: "domcontentloaded" });

    await expect(
        page.getByRole("heading", { name: "外观", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("显示设置", { exact: true })).toBeVisible();
    await expect(page.locator("#ui-language")).toContainText("中文");
    await expect(page).toHaveURL(/\/settings#appearance$/);

    await page.locator("#ui-language").click();
    await page.getByRole("option", { name: "英文", exact: true }).click();

    await updateStarted;

    await expect(
        page.getByRole("heading", { name: "Appearance", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText("Display Settings", { exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText("UI language", { exact: true }).first(),
    ).toBeVisible();
    await expect(
        page.getByText(
            "Switch the interface between Chinese and English. Default is Chinese.",
            {
                exact: true,
            },
        ),
    ).toBeVisible();

    resolvePendingUpdate();

    await page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.ok(),
    );
    await expect(page.locator("#ui-language")).toContainText("English");
});

test("display settings theme switches light and dark without waiting for persistence", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetDisplaySettings(page, { theme: "light" });

    const updatePayloads: Record<string, unknown>[] = [];
    let resolveFirstUpdate = () => {};
    let notifyFirstUpdateStarted = () => {};
    const firstUpdateStarted = new Promise<void>((resolve) => {
        notifyFirstUpdateStarted = resolve;
    });
    const firstUpdatePending = new Promise<void>((resolve) => {
        resolveFirstUpdate = resolve;
    });

    await page.route("**/api/settings/display", async (route) => {
        if (route.request().method() !== "PUT") {
            await route.continue();
            return;
        }

        updatePayloads.push(route.request().postDataJSON());
        if (updatePayloads.length === 1) {
            notifyFirstUpdateStarted();
            await firstUpdatePending;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await page.goto("/settings#display", { waitUntil: "domcontentloaded" });

    const html = page.locator("html");
    await expect(page.locator("#theme")).toContainText("浅色");
    await expect(html).not.toHaveClass(/dark/);

    await page.locator("#theme").click();
    const themeLayer = page.locator('[data-slot="select-content"]');
    await expect(themeLayer).toHaveCSS("z-index", "650");
    await page.getByRole("option", { name: /深色/ }).click();

    await firstUpdateStarted;
    await expect(html).toHaveClass(/dark/);
    expect(updatePayloads[0]).toMatchObject({ theme: "dark" });

    resolveFirstUpdate();
    await page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.ok(),
    );
    await expect(page.locator("#theme")).toContainText("深色");

    await page.locator("#theme").click();
    await page.getByRole("option", { name: /浅色/ }).click();

    await expect(html).not.toHaveClass(/dark/);
    await expect
        .poll(() => updatePayloads.at(-1))
        .toMatchObject({ theme: "light" });
    await expect(page.locator("#theme")).toContainText("浅色");
});

test("display settings secondary controls show pending state and normalize page size", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetDisplaySettings(page, {
        dateTimeFormat: "relative",
        itemsPerPage: 50,
        recordingListSortOrder: "newest",
    });

    let releasePendingUpdate = () => {};
    let notifyUpdateStarted = () => {};
    const updateStarted = new Promise<void>((resolve) => {
        notifyUpdateStarted = resolve;
    });
    const pendingUpdate = new Promise<void>((resolve) => {
        releasePendingUpdate = resolve;
    });
    let delayDateFormatUpdate = true;

    await page.route("**/api/settings/display", async (route) => {
        if (
            route.request().method() !== "PUT" ||
            !delayDateFormatUpdate ||
            route.request().postDataJSON()?.dateTimeFormat !== "absolute"
        ) {
            await route.continue();
            return;
        }

        delayDateFormatUpdate = false;
        notifyUpdateStarted();
        await pendingUpdate;
        await route.continue();
    });

    await page.goto("/settings#display", { waitUntil: "domcontentloaded" });

    const displaySection = page.locator('[data-settings-section="display"]');
    await expect(displaySection).toBeVisible();
    await expect(displaySection).toHaveAttribute(
        "data-display-save-state",
        "ready",
    );

    await page.locator("#date-time-format").click();
    await page.getByRole("option", { name: /绝对时间/ }).click();

    await updateStarted;
    await expect(displaySection).toHaveAttribute(
        "data-display-save-state",
        "saving",
    );
    await expect(page.getByTestId("display-save-state")).toContainText(
        "保存中",
    );
    await expect(page.locator("#sort-order")).toBeDisabled();
    await expect(page.locator("#items-per-page")).toBeDisabled();

    releasePendingUpdate();

    await page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.dateTimeFormat === "absolute",
    );
    await expect(displaySection).toHaveAttribute(
        "data-display-save-state",
        "ready",
    );

    await page.locator("#sort-order").click();
    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/display") &&
                response.request().method() === "PUT" &&
                response.ok() &&
                response.request().postDataJSON()?.recordingListSortOrder ===
                    "oldest",
        ),
        page.getByRole("option", { name: "最早优先", exact: true }).click(),
    ]);
    await expect(page.locator("#sort-order")).toContainText("最早优先");

    const pageSizeResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.itemsPerPage === 10,
    );
    await page.locator("#items-per-page").fill("3");
    await page.getByText("显示设置", { exact: true }).click();
    await pageSizeResponse;
    await expect(page.locator("#items-per-page")).toHaveValue("10");
});
