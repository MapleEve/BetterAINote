import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

async function openDashboard(
    page: Parameters<typeof ensureSignedIn>[0],
    options: { connectIflyrec?: boolean } = {},
) {
    await ensureSignedIn(page);

    if (options.connectIflyrec) {
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
                            provider === "iflyrec"
                                ? ["session-header"]
                                : ["bearer"],
                        baseUrl: "https://example.invalid",
                        capabilities,
                        config: {},
                        connected: provider === "iflyrec",
                        connectionStatus: "ready",
                        displayName:
                            provider === "iflyrec" ? "讯飞听见" : provider,
                        enabled: provider === "iflyrec",
                        lastSync: null,
                        provider,
                        runtimeStatus: "active",
                        secretsConfigured:
                            provider === "iflyrec" ? { sessionId: true } : {},
                    })),
                }),
            });
        });
    }

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
