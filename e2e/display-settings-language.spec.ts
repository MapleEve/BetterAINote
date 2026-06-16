import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

async function resetDisplaySettings(
    page: Page,
    overrides: Record<string, unknown> = {},
) {
    const resetResponse = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            displayDensity: "comfy",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "dark",
            uiLanguage: "zh-CN",
            ...overrides,
        },
    });
    expect(resetResponse.ok()).toBe(true);
}

function displaySection(page: Page) {
    return page.locator(
        '[data-sot-surface="settings-section"][data-sot-section="appearance"]',
    );
}

function displayFooter(page: Page) {
    return displaySection(page).locator(".sm-actions");
}

function displaySaveActions(page: Page) {
    return page.locator(
        '[data-sot-surface="settings-section"][data-sot-section="appearance"] [data-sot-control="settings-save"], [data-sot-surface="settings-section"][data-sot-section="appearance"] [data-save-action]',
    );
}

async function expectNoDisplaySaveFooter(page: Page) {
    await expect(displayFooter(page)).toHaveCount(0);
    await expect(displaySaveActions(page)).toHaveCount(0);
}

function settingsShell(page: Page) {
    return page.locator('[data-sot-surface="settings-shell"]');
}

function displayCombobox(page: Page, label: string) {
    return displaySection(page).getByRole("combobox", { name: label });
}

function displaySegment(page: Page, control: string, value: string) {
    return displaySection(page).locator(
        `[data-sot-control="${control}"][data-sot-value="${value}"]`,
    );
}

function displaySpinbutton(page: Page, label: string) {
    if (
        label === "每页录音数" ||
        label === "每页条数" ||
        label === "Recordings per page" ||
        label === "Items per page"
    ) {
        return displaySection(page).locator("#display-items-per-page");
    }

    return displaySection(page).getByRole("spinbutton", { name: label });
}

async function selectSettingsSection(page: Page, section: string) {
    const shell = settingsShell(page);
    const nav = page.locator(
        `[data-sot-control="settings-nav"][data-sot-section="${section}"]`,
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(shell).toHaveAttribute("data-sot-state", "idle");
        await expect(nav).toBeEnabled();
        await nav.click();

        if ((await shell.getAttribute("data-sot-section")) === section) {
            return;
        }

        await page.waitForTimeout(250);
    }

    await expect(shell).toHaveAttribute("data-sot-section", section);
}

test("display settings language changes persist immediately through the shared store", async ({
    page,
}) => {
    await ensureSignedIn(page);

    await resetDisplaySettings(page);

    const updatePayloads: Record<string, unknown>[] = [];
    let resolvePendingUpdate = () => {};
    let notifyUpdateStarted = () => {};
    let delayedFirstLanguageUpdate = false;
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

        const payload = route.request().postDataJSON();
        updatePayloads.push(payload);
        if (payload?.uiLanguage === "en" && !delayedFirstLanguageUpdate) {
            delayedFirstLanguageUpdate = true;
            notifyUpdateStarted();
            await pendingUpdate;
        }
        await route.continue();
    });

    await page.goto("/settings#appearance", { waitUntil: "domcontentloaded" });

    const section = displaySection(page);
    const languageSelect = displayCombobox(page, "界面语言");
    await expect(
        page.getByRole("heading", { name: "显示设置", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("heading", { name: "主题与外观", exact: true }),
    ).toBeVisible();
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(languageSelect).toHaveValue("zh-CN");
    await expectNoDisplaySaveFooter(page);
    await expect(page).toHaveURL(/\/settings#appearance$/);

    await languageSelect.selectOption("en");
    await updateStarted;
    expect(updatePayloads[0]).toMatchObject({ uiLanguage: "en" });
    expect(Object.keys(updatePayloads[0])).toEqual(["uiLanguage"]);
    await expect(section).toHaveAttribute("data-sot-state", "busy");
    await expectNoDisplaySaveFooter(page);

    await expect(displayCombobox(page, "Interface language")).toHaveValue("en");
    await expect(
        page.getByRole("heading", { name: "Display Settings", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText("Interface language", { exact: true }).first(),
    ).toBeVisible();

    const savedResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.request().postDataJSON()?.uiLanguage === "en" &&
            response.ok(),
    );
    resolvePendingUpdate();
    await savedResponse;
    await expect(
        page.getByRole("heading", { name: "Display Settings", exact: true }),
    ).toBeVisible();
    await expect(displayCombobox(page, "Interface language")).toHaveValue("en");
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expectNoDisplaySaveFooter(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await selectSettingsSection(page, "appearance");
    await expect(displayCombobox(page, "Interface language")).toHaveValue("en");
    await expectNoDisplaySaveFooter(page);
});

test("display settings language immediate failure rolls back visible copy", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetDisplaySettings(page);

    let failedPayload: Record<string, unknown> | null = null;
    let releaseFailedUpdate = () => {};
    let notifyFailedUpdateStarted = () => {};
    const failedUpdateStarted = new Promise<void>((resolve) => {
        notifyFailedUpdateStarted = resolve;
    });
    const failedUpdatePending = new Promise<void>((resolve) => {
        releaseFailedUpdate = resolve;
    });

    await page.route("**/api/settings/display", async (route) => {
        const request = route.request();
        if (
            request.method() !== "PUT" ||
            request.postDataJSON()?.uiLanguage !== "en"
        ) {
            await route.continue();
            return;
        }

        failedPayload = request.postDataJSON();
        notifyFailedUpdateStarted();
        await failedUpdatePending;
        await route.fulfill({
            contentType: "application/json",
            status: 503,
            body: JSON.stringify({ error: "Display settings unavailable" }),
        });
    });

    await page.goto("/settings#appearance", { waitUntil: "domcontentloaded" });

    const section = displaySection(page);
    const languageSelect = displayCombobox(page, "界面语言");
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(languageSelect).toHaveValue("zh-CN");
    await expectNoDisplaySaveFooter(page);
    await expect(
        page.getByRole("heading", { name: "显示设置", exact: true }),
    ).toBeVisible();

    await languageSelect.selectOption("en");
    await failedUpdateStarted;
    expect(failedPayload).toMatchObject({ uiLanguage: "en" });
    expect(Object.keys(failedPayload ?? {})).toEqual(["uiLanguage"]);
    await expect(section).toHaveAttribute("data-sot-state", "busy");
    await expectNoDisplaySaveFooter(page);
    await expect(displayCombobox(page, "Interface language")).toHaveValue("en");
    await expect(
        page.getByRole("heading", { name: "Display Settings", exact: true }),
    ).toBeVisible();
    await expect(displaySegment(page, "theme", "dark")).toBeDisabled();

    const failedResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.status() === 503 &&
            response.request().postDataJSON()?.uiLanguage === "en",
    );
    releaseFailedUpdate();
    await failedResponse;

    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expectNoDisplaySaveFooter(page);
    await expect(displaySegment(page, "theme", "dark")).toBeEnabled();
    await expect(displayCombobox(page, "界面语言")).toHaveValue("zh-CN");
    await expect(
        page.getByRole("heading", { name: "显示设置", exact: true }),
    ).toBeVisible();
    await expect(
        page.locator('.toast.toast-ok'),
    ).toHaveCount(0);
});

test("display settings theme switches light and dark with immediate persistence", async ({
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

    await page.goto("/settings#appearance", { waitUntil: "domcontentloaded" });

    const html = page.locator("html");
    const section = displaySection(page);
    const lightThemeButton = displaySegment(page, "theme", "light");
    const darkThemeButton = displaySegment(page, "theme", "dark");
    await expect(lightThemeButton).toHaveAttribute("aria-pressed", "true");
    await expect(html).toHaveAttribute("data-theme", "light");
    await expectNoDisplaySaveFooter(page);

    await darkThemeButton.click();
    await firstUpdateStarted;
    await expect(section).toHaveAttribute("data-sot-state", "busy");
    await expectNoDisplaySaveFooter(page);
    await expect(darkThemeButton).toHaveAttribute("aria-pressed", "true");
    await expect(html).toHaveAttribute("data-theme", "dark");
    expect(updatePayloads[0]).toMatchObject({ theme: "dark" });
    expect(Object.keys(updatePayloads[0])).toEqual(["theme"]);

    const firstSavedResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.request().postDataJSON()?.theme === "dark" &&
            response.ok(),
    );
    resolveFirstUpdate();
    await firstSavedResponse;
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(darkThemeButton).toHaveAttribute("aria-pressed", "true");
    await expectNoDisplaySaveFooter(page);

    await lightThemeButton.click();
    await expect(lightThemeButton).toHaveAttribute("aria-pressed", "true");

    await expect(html).toHaveAttribute("data-theme", "light");
    await expect
        .poll(() => updatePayloads.find((payload) => payload.theme === "light"))
        .toMatchObject({ theme: "light" });
    await expect(lightThemeButton).toHaveAttribute("aria-pressed", "true");
});

test("display settings secondary controls persist immediately and normalize page size", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetDisplaySettings(page, {
        dateTimeFormat: "relative",
        displayDensity: "comfy",
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

    await page.goto("/settings#appearance", { waitUntil: "domcontentloaded" });

    const section = displaySection(page);
    const compactDensityButton = displaySegment(page, "density", "compact");
    const absoluteTimeButton = displaySegment(page, "time-style", "absolute");
    const sortSelect = displayCombobox(page, "列表排序");
    const pageSizeInput = displaySpinbutton(page, "每页录音数");
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expectNoDisplaySaveFooter(page);

    const densityResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.displayDensity === "compact",
    );
    await compactDensityButton.click();
    await expect(compactDensityButton).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    const densityPut = await densityResponse;
    expect(densityPut.request().postDataJSON()).toEqual({
        displayDensity: "compact",
    });

    await absoluteTimeButton.click();
    await updateStarted;
    await expect(section).toHaveAttribute("data-sot-state", "busy");
    await expectNoDisplaySaveFooter(page);
    await expect(absoluteTimeButton).toHaveAttribute("aria-pressed", "true");
    await expect(compactDensityButton).toBeDisabled();
    await expect(absoluteTimeButton).toBeDisabled();
    await expect(sortSelect).toBeDisabled();
    await expect(pageSizeInput).toBeDisabled();

    const dateTimeResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.dateTimeFormat === "absolute",
    );
    releasePendingUpdate();
    const dateTimePut = await dateTimeResponse;
    expect(dateTimePut.request().postDataJSON()).toEqual({
        dateTimeFormat: "absolute",
    });
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expectNoDisplaySaveFooter(page);

    const sortResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.recordingListSortOrder ===
                "oldest",
    );
    await sortSelect.selectOption("oldest");
    const sortPut = await sortResponse;
    expect(sortPut.request().postDataJSON()).toEqual({
        recordingListSortOrder: "oldest",
    });
    await expect(sortSelect).toHaveValue("oldest");

    const pageSizeResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.itemsPerPage === 10,
    );
    await pageSizeInput.fill("3");
    const pageSizePut = await pageSizeResponse;
    expect(pageSizePut.request().postDataJSON()).toEqual({
        itemsPerPage: 10,
    });
    await expect(pageSizeInput).toHaveValue("10");

    const flushedPageSizeResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.itemsPerPage === 42,
    );
    await pageSizeInput.fill("42");
    const flushedPageSizePut = await flushedPageSizeResponse;
    expect(flushedPageSizePut.request().postDataJSON()).toEqual({
        itemsPerPage: 42,
    });
    await page
        .locator('[data-sot-control="settings-nav"][data-sot-section="misc"]')
        .click();
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toHaveAttribute(
        "data-sot-section",
        "misc",
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await selectSettingsSection(page, "appearance");
    await expect(displaySection(page)).toHaveAttribute("data-sot-state", "ready");
    await expect(displaySegment(page, "density", "compact")).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await expect(displaySpinbutton(page, "每页录音数")).toHaveValue("42");
});
