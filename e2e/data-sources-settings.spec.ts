import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const capabilities = {
    audioDownload: true,
    localRename: true,
    officialSummary: true,
    officialTranscript: true,
    privateTranscribe: true,
    upstreamTitleWriteback: true,
    workerSync: true,
};

function makeSource(
    provider: string,
    overrides: Record<string, unknown> = {},
) {
    return {
        authMode: "bearer",
        authModes: ["bearer"],
        baseUrl: "https://example.invalid",
        capabilities,
        config: {},
        connected: false,
        connectionStatus: "ready",
        displayName: provider,
        enabled: false,
        lastSync: null,
        provider,
        runtimeStatus: "active",
        secretsConfigured: {},
        ...overrides,
    };
}

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

async function openDataSourcesSettings(page: Page) {
    await page.evaluate(() => {
        localStorage.removeItem("settings-data-source-provider");
        localStorage.removeItem("settings-last-section");
    });
    await page.goto("/settings#data-sources", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
        "data-settings-active-section",
        "data-sources",
    );
    const section = page.locator('[data-settings-section="data-sources"]');
    await expect(section).toBeVisible();
    return section;
}

test("data sources settings tests missing details then saves a provider through the real form", async ({
    page,
}) => {
    let sources = [
        makeSource("plaud", {
            displayName: "Plaud",
            config: { server: "cn" },
        }),
        makeSource("ticnote", {
            baseUrl: "https://voice-api.ticnote.cn",
            config: { region: "cn" },
            displayName: "TicNote",
        }),
        makeSource("feishu-minutes", {
            authMode: "oauth-device-flow",
            authModes: ["oauth-device-flow", "web-reverse"],
            displayName: "飞书妙记",
        }),
        makeSource("dingtalk-a1", {
            authMode: "device-signin",
            authModes: ["device-signin"],
            displayName: "钉钉闪记",
        }),
        makeSource("iflyrec", {
            authMode: "session-header",
            authModes: ["session-header"],
            config: { bizId: "tjzs" },
            displayName: "讯飞听见",
        }),
    ];
    let testPayload: Record<string, unknown> | null = null;
    let savePayload: Record<string, unknown> | null = null;
    let releaseTest = () => {};
    let notifyTestStarted = () => {};
    let releaseSave = () => {};
    let notifySaveStarted = () => {};
    const testStarted = new Promise<void>((resolve) => {
        notifyTestStarted = resolve;
    });
    const pendingTest = new Promise<void>((resolve) => {
        releaseTest = resolve;
    });
    const saveStarted = new Promise<void>((resolve) => {
        notifySaveStarted = resolve;
    });
    const pendingSave = new Promise<void>((resolve) => {
        releaseSave = resolve;
    });

    await page.route("**/api/data-sources/test", async (route) => {
        testPayload = route.request().postDataJSON();
        notifyTestStarted();
        await pendingTest;
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ sources }),
            });
            return;
        }

        savePayload = route.request().postDataJSON();
        notifySaveStarted();
        await pendingSave;
        sources = sources.map((source) =>
            source.provider === "ticnote"
                ? {
                      ...source,
                      connected: true,
                      enabled: true,
                      secretsConfigured: { bearerToken: true },
                  }
                : source,
        );
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    const section = await openDataSourcesSettings(page);

    await section.locator('[data-provider="ticnote"]').click();
    await expect(section).toHaveAttribute("data-ds-selected-provider", "ticnote");

    const detail = section.locator('[data-provider-detail="ticnote"]');
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute("data-provider-status", "needs-setup");

    await detail.getByTestId("data-source-test-connection").click();
    await expect(detail).toHaveAttribute(
        "data-provider-action-state",
        "test-error",
    );
    await expect(
        detail.getByTestId("data-source-provider-state-banner"),
    ).toContainText("信息不完整");

    await page.locator("#ticnote-source-secret").fill("fake-ticnote-token");
    await detail.getByTestId("data-source-test-connection").click();
    await testStarted;
    await expect(detail).toHaveAttribute(
        "data-provider-action-state",
        "testing",
    );
    releaseTest();
    await expect(detail).toHaveAttribute(
        "data-provider-action-state",
        "test-success",
    );
    await expect(
        detail.getByTestId("data-source-provider-state-banner"),
    ).toContainText("连接测试通过");
    expect(testPayload).toMatchObject({
        authMode: "bearer",
        baseUrl: "https://voice-api.ticnote.cn",
        enabled: true,
        provider: "ticnote",
        secrets: { bearerToken: "fake-ticnote-token" },
    });
    expect(testPayload?.config).toMatchObject({
        region: "cn",
    });
    expect(savePayload).toBeNull();

    await page.locator("#ticnote-enabled").click();
    await expect(page.locator("#ticnote-enabled")).toHaveAttribute(
        "data-state",
        "checked",
    );

    await detail.getByTestId("data-source-save").click();
    await saveStarted;
    await expect(detail).toHaveAttribute(
        "data-provider-action-state",
        "saving",
    );
    releaseSave();

    await expect(detail).toHaveAttribute("data-provider-action-state", "saved");
    await expect(detail).toHaveAttribute("data-provider-status", "saved");
    const ticnoteRow = section.locator('[data-provider="ticnote"]');
    await expect(ticnoteRow).toHaveAttribute("data-provider-status", "saved");
    await expect(ticnoteRow).toHaveAttribute(
        "data-provider-status",
        "connected",
        { timeout: 4_000 },
    );
    expect(savePayload).toMatchObject({
        authMode: "bearer",
        baseUrl: "https://voice-api.ticnote.cn",
        enabled: true,
        provider: "ticnote",
        secrets: { bearerToken: "fake-ticnote-token" },
    });
    expect(savePayload?.config).toMatchObject({
        region: "cn",
    });
});

test("data sources settings keeps responsive provider states and disabled actions stable", async ({
    page,
}) => {
    const sources = [
        makeSource("plaud", {
            connected: true,
            displayName: "Plaud",
            enabled: false,
            secretsConfigured: { bearerToken: true },
        }),
        makeSource("ticnote", {
            baseUrl: "https://voice-api.ticnote.cn",
            config: { region: "cn" },
            displayName: "TicNote",
        }),
        makeSource("feishu-minutes", {
            authMode: "oauth-device-flow",
            authModes: ["oauth-device-flow", "web-reverse"],
            displayName: "飞书妙记",
            runtimeStatus: "planned",
        }),
        makeSource("dingtalk-a1", {
            authMode: "device-signin",
            authModes: ["device-signin"],
            connected: true,
            connectionStatus: "expired",
            displayName: "钉钉闪记",
            enabled: true,
            secretsConfigured: { deviceToken: true },
        }),
        makeSource("iflyrec", {
            authMode: "session-header",
            authModes: ["session-header"],
            config: { bizId: "tjzs" },
            displayName: "讯飞听见",
        }),
    ];

    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ sources }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });
    await page.setViewportSize({ width: 390, height: 844 });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#appearance", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
        "data-settings-active-section",
        "appearance",
    );

    await page
        .locator("[data-settings-shell]")
        .getByRole("combobox", { name: "设置" })
        .click();
    await page.getByRole("option", { name: "数据源" }).click();
    await expect(page).toHaveURL(/\/settings#data-sources$/);
    const section = page.locator('[data-settings-section="data-sources"]');
    await expect(section).toBeVisible();

    const shellHeight = await page
        .locator("[data-settings-shell]")
        .evaluate((node) => node.getBoundingClientRect().height);
    await section.locator("[data-ds-scroll]").last().hover();
    await page.mouse.wheel(0, 900);
    await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
        "data-settings-active-section",
        "data-sources",
    );
    const shellHeightAfterScroll = await page
        .locator("[data-settings-shell]")
        .evaluate((node) => node.getBoundingClientRect().height);
    expect(Math.abs(shellHeightAfterScroll - shellHeight)).toBeLessThan(2);

    await section.locator('[data-provider="dingtalk-a1"]').click();
    const expiredDetail = section.locator('[data-provider-detail="dingtalk-a1"]');
    await expect(expiredDetail).toHaveAttribute(
        "data-provider-status",
        "expired",
    );
    await expect(
        expiredDetail.getByTestId("data-source-provider-state-banner"),
    ).toContainText("登录已过期");

    await section.locator('[data-provider="plaud"]').click();
    await expect(section.locator('[data-provider-detail="plaud"]')).toHaveAttribute(
        "data-provider-status",
        "paused",
    );

    await section.locator('[data-provider="feishu-minutes"]').click();
    const plannedDetail = section.locator(
        '[data-provider-detail="feishu-minutes"]',
    );
    await expect(plannedDetail).toHaveAttribute("data-provider-status", "planned");
    await expect(plannedDetail).toHaveAttribute(
        "data-provider-interaction-disabled",
        "true",
    );
    await expect(
        plannedDetail.getByTestId("data-source-test-connection"),
    ).toBeDisabled();
    await expect(plannedDetail.getByTestId("data-source-save")).toBeDisabled();
});

test("data sources settings switches Feishu sign-in methods without saving test payloads", async ({
    page,
}) => {
    const sources = [
        makeSource("plaud", {
            displayName: "Plaud",
            config: { server: "cn" },
        }),
        makeSource("ticnote", {
            baseUrl: "https://voice-api.ticnote.cn",
            config: { region: "cn" },
            displayName: "TicNote",
        }),
        makeSource("feishu-minutes", {
            authMode: "oauth-device-flow",
            authModes: ["oauth-device-flow", "web-reverse"],
            baseUrl: "https://open.feishu.cn",
            config: { appId: "" },
            displayName: "飞书妙记",
            runtimeStatus: "active",
        }),
        makeSource("dingtalk-a1", {
            authMode: "device-signin",
            authModes: ["device-signin"],
            displayName: "钉钉闪记",
        }),
        makeSource("iflyrec", {
            authMode: "session-header",
            authModes: ["session-header"],
            config: { bizId: "tjzs" },
            displayName: "讯飞听见",
        }),
    ];
    const testPayloads: Record<string, unknown>[] = [];
    let savePayload: Record<string, unknown> | null = null;

    await page.route("**/api/data-sources/test", async (route) => {
        testPayloads.push(route.request().postDataJSON());
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ sources }),
            });
            return;
        }

        savePayload = route.request().postDataJSON();
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    const section = await openDataSourcesSettings(page);

    await section.locator('[data-provider="feishu-minutes"]').click();
    await expect(section).toHaveAttribute(
        "data-ds-selected-provider",
        "feishu-minutes",
    );

    const detail = section.locator('[data-provider-detail="feishu-minutes"]');
    await expect(detail).toBeVisible();
    await expect(
        detail.locator('[data-auth-mode="oauth-device-flow"]'),
    ).toHaveAttribute("data-active", "true");
    await expect(
        detail.locator('[data-auth-mode="web-reverse"]'),
    ).toHaveAttribute("data-active", "false");
    await expect(page.locator("#feishu-minutes-base-url")).toHaveValue(
        "https://open.feishu.cn",
    );
    await expect(page.locator("#feishu-minutes-source-app-id")).toBeVisible();
    await expect(page.locator("#feishu-minutes-source-secret")).toBeVisible();
    await expect(page.locator("#feishu-minutes-source-web-cookie")).toHaveCount(
        0,
    );
    await expect(page.locator("#feishu-minutes-source-web-token")).toHaveCount(
        0,
    );

    await page
        .locator("#feishu-minutes-source-app-id")
        .fill("cli_e2e_feishu_app");
    await page
        .locator("#feishu-minutes-source-secret")
        .fill("u-e2e-open-platform-token");
    await detail.getByTestId("data-source-test-connection").click();
    await expect(detail).toHaveAttribute(
        "data-provider-action-state",
        "test-success",
    );
    expect(testPayloads).toHaveLength(1);
    expect(testPayloads[0]).toMatchObject({
        authMode: "oauth-device-flow",
        baseUrl: "https://open.feishu.cn",
        enabled: true,
        provider: "feishu-minutes",
        config: { appId: "cli_e2e_feishu_app" },
        secrets: { userAccessToken: "u-e2e-open-platform-token" },
    });
    expect(savePayload).toBeNull();

    await detail.locator('[data-auth-mode="web-reverse"]').click();
    await expect(
        detail.locator('[data-auth-mode="oauth-device-flow"]'),
    ).toHaveAttribute("data-active", "false");
    await expect(
        detail.locator('[data-auth-mode="web-reverse"]'),
    ).toHaveAttribute("data-active", "true");
    await expect(page.locator("#feishu-minutes-base-url")).toHaveValue(
        "https://meetings.feishu.cn",
    );
    await expect(page.locator("#feishu-minutes-source-app-id")).toHaveCount(0);
    await expect(page.locator("#feishu-minutes-source-secret")).toHaveCount(0);
    await expect(page.locator("#feishu-minutes-source-web-cookie")).toBeVisible();
    await expect(page.locator("#feishu-minutes-source-web-token")).toBeVisible();

    await page.locator("#feishu-minutes-source-space-name").fill("cn");
    await page
        .locator("#feishu-minutes-source-web-cookie")
        .fill("minutes_csrf_token=e2e; session=e2e");
    await page
        .locator("#feishu-minutes-source-web-token")
        .fill("x-minutes-e2e-token");
    await detail.getByTestId("data-source-test-connection").click();
    await expect(detail).toHaveAttribute(
        "data-provider-action-state",
        "test-success",
    );
    expect(testPayloads).toHaveLength(2);
    expect(testPayloads[1]).toMatchObject({
        authMode: "web-reverse",
        baseUrl: "https://meetings.feishu.cn",
        enabled: true,
        provider: "feishu-minutes",
        config: { spaceName: "cn" },
        secrets: {
            webCookie: "minutes_csrf_token=e2e; session=e2e",
            webToken: "x-minutes-e2e-token",
        },
    });
    expect(savePayload).toBeNull();
});
