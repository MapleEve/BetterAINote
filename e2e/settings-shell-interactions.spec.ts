import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

async function resetDisplayToChinese(page: Page) {
    const resetResponse = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "system",
            uiLanguage: "zh-CN",
        },
    });
    expect(resetResponse.ok()).toBe(true);
}

async function clearSettingsPersistence(page: Page) {
    await page.evaluate(() => {
        localStorage.removeItem("settings-data-source-provider");
        localStorage.removeItem("settings-last-section");
    });
}

async function waitForDashboardHydration(page: Page) {
    await page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/recording-tags") &&
                response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
}

async function openPanelWithRetry(
    trigger: ReturnType<Page["getByTestId"]>,
    panel: ReturnType<Page["getByTestId"]>,
) {
    await expect(trigger).toBeVisible();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await trigger.click();
        if (
            await panel
                .isVisible({ timeout: 1_000 })
                .catch(() => false)
        ) {
            return;
        }
        await trigger.page().waitForTimeout(250);
    }
}

async function settingsShellHeight(page: Page) {
    return page
        .locator("[data-settings-shell]")
        .evaluate((node) => node.getBoundingClientRect().height);
}

async function expectShellHeightStable(page: Page, baseline: number) {
    const current = await settingsShellHeight(page);
    expect(Math.abs(current - baseline)).toBeLessThan(2);
}

async function elementScrollTop(locator: ReturnType<Page["locator"]>) {
    return locator.evaluate((node) => node.scrollTop);
}

async function elementCanScroll(locator: ReturnType<Page["locator"]>) {
    return locator.evaluate((node) => node.scrollHeight > node.clientHeight + 1);
}

async function scrollElementToEnd(locator: ReturnType<Page["locator"]>) {
    await locator.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
    });
}

test("settings shell closes sibling overlays, locks height, bounds wheel scroll, and returns focus", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 640 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    const dashboardHydrated = waitForDashboardHydration(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await dashboardHydrated;
    await clearSettingsPersistence(page);

    const searchTrigger = page.getByTestId("library-search-trigger").first();
    const activityTrigger = page.getByTestId("dashboard-activity-trigger");
    const settingsTrigger = page.getByTestId("dashboard-settings-trigger");

    const searchPanel = page.getByTestId("library-search-panel");
    const activityPanel = page.getByTestId("dashboard-activity-panel");

    await openPanelWithRetry(searchTrigger, searchPanel);
    await expect(searchPanel).toBeVisible();

    await openPanelWithRetry(activityTrigger, activityPanel);
    await expect(searchPanel).toBeHidden();
    await expect(activityPanel).toBeVisible();

    await settingsTrigger.click();
    await expect(activityPanel).toBeHidden();
    await expect(page.locator("[data-settings-shell]")).toBeVisible();
    await expect(page.getByTestId("settings-user-summary")).toContainText(
        "playwright-admin@example.com",
    );
    await expect(page.getByTestId("dashboard-settings-avatar")).toHaveText("P");

    const baselineHeight = await settingsShellHeight(page);
    expect(baselineHeight).toBeGreaterThan(590);
    expect(baselineHeight).toBeLessThanOrEqual(640);
    await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
        "data-settings-active-section",
        "transcription",
    );
    await expect(page.getByTestId("settings-close")).toHaveAccessibleName(
        "关闭设置",
    );

    await page.locator('[data-settings-nav-item="voscript"]').click();
    await expectShellHeightStable(page, baselineHeight);
    await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
        "data-settings-active-section",
        "voscript",
    );
    const settingsScrollBody = page.locator("[data-settings-scroll-body]");
    await settingsScrollBody.hover();
    await page.mouse.wheel(0, 900);
    await expect.poll(() => elementScrollTop(settingsScrollBody)).toBeGreaterThan(0);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(0);

    await page.locator('[data-settings-nav-item="appearance"]').click();
    await expectShellHeightStable(page, baselineHeight);
    await expect.poll(() => elementScrollTop(settingsScrollBody)).toBe(0);
    await expect(page.locator('[data-settings-section="data-sources"]')).toBeHidden();

    await page.locator('[data-settings-nav-item="data-sources"]').click();
    await expectShellHeightStable(page, baselineHeight);
    await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
        "data-settings-active-section",
        "data-sources",
    );
    const dataSourceDetailScroll = page.locator("[data-ds-scroll]").last();
    await dataSourceDetailScroll.hover();
    await page.mouse.wheel(0, 900);
    await expect
        .poll(() => elementScrollTop(dataSourceDetailScroll))
        .toBeGreaterThan(0);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(0);
    await expectShellHeightStable(page, baselineHeight);
    await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
        "data-settings-active-section",
        "data-sources",
    );

    await page.locator('[data-settings-nav-item="appearance"]').click();
    await page.locator('[data-settings-nav-item="data-sources"]').click();
    await expect
        .poll(() => elementScrollTop(page.locator("[data-ds-scroll]").last()))
        .toBe(0);
    await expectShellHeightStable(page, baselineHeight);

    await page.getByTestId("settings-close").focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[data-settings-shell]")).toBeHidden();
    await expect(settingsTrigger).toBeFocused();
});

test("settings data source nested scroll containers reset without freezing", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await clearSettingsPersistence(page);
    await page.goto("/settings#data-sources", { waitUntil: "domcontentloaded" });

    const shell = page.locator("[data-settings-shell]");
    const section = page.locator('[data-settings-section="data-sources"]');
    await expect(shell).toHaveAttribute(
        "data-settings-active-section",
        "data-sources",
    );
    await expect(section).toBeVisible();
    const baselineHeight = await settingsShellHeight(page);

    const providerListScroll = section.locator(
        "[data-ds-provider-list-scroll]",
    );
    await expect.poll(() => elementCanScroll(providerListScroll)).toBe(true);
    await scrollElementToEnd(providerListScroll);
    await expect.poll(() => elementScrollTop(providerListScroll)).toBeGreaterThan(0);

    const providerDetailScroll = section.locator("[data-ds-scroll]").last();
    await expect.poll(() => elementCanScroll(providerDetailScroll)).toBe(true);
    await scrollElementToEnd(providerDetailScroll);
    await expect.poll(() => elementScrollTop(providerDetailScroll)).toBeGreaterThan(0);

    const selectedProvider = await section.getAttribute(
        "data-ds-selected-provider",
    );
    const nextProvider = selectedProvider === "ticnote" ? "plaud" : "ticnote";
    await section.locator(`[data-provider="${nextProvider}"]`).click();
    await expect(section).toHaveAttribute(
        "data-ds-selected-provider",
        nextProvider,
    );
    await expect.poll(() => elementScrollTop(providerDetailScroll)).toBe(0);
    await expectShellHeightStable(page, baselineHeight);

    await page.locator('[data-settings-nav-item="appearance"]').click();
    await page.locator('[data-settings-nav-item="data-sources"]').click();
    await expect.poll(() => elementScrollTop(providerListScroll)).toBe(0);
    await expect.poll(() => elementScrollTop(providerDetailScroll)).toBe(0);
    await expectShellHeightStable(page, baselineHeight);
});

test("settings route aliases and mobile selector keep the shell fixed", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#playback", { waitUntil: "domcontentloaded" });

    const shell = page.locator("[data-settings-shell]");
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute("data-settings-active-section", "misc");
    await expect(page).toHaveURL(/\/settings#misc$/);

    const baselineHeight = await settingsShellHeight(page);
    expect(baselineHeight).toBeGreaterThan(820);
    expect(baselineHeight).toBeLessThanOrEqual(844);

    const sectionSelector = shell.getByRole("combobox", { name: "设置" });
    await sectionSelector.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("option", { name: "VoScript" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(shell).toBeVisible();
    await expect(page.getByRole("option", { name: "VoScript" })).toBeHidden();
    await sectionSelector.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "VoScript" }).click();
    await expect(shell).toHaveAttribute("data-settings-active-section", "voscript");
    await expectShellHeightStable(page, baselineHeight);

    await page.mouse.wheel(0, 900);
    await expectShellHeightStable(page, baselineHeight);

    await sectionSelector.click();
    await page.getByRole("option", { name: "数据源" }).click();
    await expect(shell).toHaveAttribute(
        "data-settings-active-section",
        "data-sources",
    );
    await expect(page.locator('[data-settings-section="data-sources"]')).toBeVisible();
    await expectShellHeightStable(page, baselineHeight);

    await page.getByTestId("settings-close").click();
    await expect(shell).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard$/);
});

test("settings shell restores the last section and supports keyboard section selection", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    const dashboardHydrated = waitForDashboardHydration(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await dashboardHydrated;
    await clearSettingsPersistence(page);
    await page.evaluate(() => {
        localStorage.setItem("settings-last-section", "title-generation");
    });

    const settingsTrigger = page.getByTestId("dashboard-settings-trigger");
    await settingsTrigger.click();

    const shell = page.locator("[data-settings-shell]");
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute(
        "data-settings-active-section",
        "title-generation",
    );
    await expect(
        page.locator('[data-settings-nav-item="title-generation"]'),
    ).toHaveAttribute("data-keyboard-selected", "true");

    await page.keyboard.press("ArrowDown");
    await expect(
        page.locator('[data-settings-nav-item="voscript"]'),
    ).toHaveAttribute("data-keyboard-selected", "true");
    await expect(shell).toHaveAttribute(
        "data-settings-active-section",
        "title-generation",
    );

    await page.keyboard.press("Enter");
    await expect(shell).toHaveAttribute(
        "data-settings-active-section",
        "voscript",
    );
    await expect
        .poll(() =>
            page.evaluate(() => localStorage.getItem("settings-last-section")),
        )
        .toBe("voscript");

    await page.keyboard.press("ArrowDown");
    await expect(
        page.locator('[data-settings-nav-item="data-sources"]'),
    ).toHaveAttribute("data-keyboard-selected", "true");
    await page.keyboard.press("Space");
    await expect(shell).toHaveAttribute(
        "data-settings-active-section",
        "data-sources",
    );

    await page.keyboard.press("ArrowUp");
    await expect(
        page.locator('[data-settings-nav-item="voscript"]'),
    ).toHaveAttribute("data-keyboard-selected", "true");
    await page.keyboard.press("Enter");
    await expect(shell).toHaveAttribute(
        "data-settings-active-section",
        "voscript",
    );

    await page.keyboard.press("Escape");
    await expect(shell).toBeHidden();
    await expect(settingsTrigger).toBeFocused();
});
