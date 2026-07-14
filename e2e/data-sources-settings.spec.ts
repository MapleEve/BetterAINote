import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    assertCanonicalSotReferenceMatchesRecovery,
    assertCanonicalSotReferenceUnchanged,
    resolveVerifiedCanonicalSotReference,
    snapshotCanonicalSotReference,
} from "./helpers/canonical-sot-reference";
import {
    chooseShadcnSelectOption,
    expectShadcnSelectTrigger,
} from "./helpers/shadcn-select";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");

const capabilities = {
    audioDownload: true,
    localRename: true,
    officialSummary: true,
    officialTranscript: true,
    privateTranscribe: true,
    upstreamTitleWriteback: true,
    workerSync: true,
};
const REAL_BACKEND_FORCED_PROVIDERS = [
    "dingtalk-a1",
    "ticnote",
    "iflyrec",
] as const;
const REAL_BACKEND_FORCED_PROVIDER_PLACEHOLDERS =
    REAL_BACKEND_FORCED_PROVIDERS.map(() => "?").join(", ");

type RealBackendForcedProvider =
    (typeof REAL_BACKEND_FORCED_PROVIDERS)[number];

type SourceConnectionSnapshotRow = {
    id: string;
    userId: string;
    provider: RealBackendForcedProvider;
    enabled: number;
    authMode: string | null;
    baseUrl: string | null;
    config: string | null;
    secretConfig: string | null;
    lastSync: number | null;
    createdAt: number;
    updatedAt: number;
};

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
}

function assertE2EPath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ?? path.join(process.cwd(), "tmp/e2e"),
    );
    const resolved = path.resolve(filePath);
    if (resolved !== e2eRoot && !resolved.startsWith(`${e2eRoot}${path.sep}`)) {
        throw new Error(`Refusing to touch non-E2E path: ${resolved}`);
    }
}

function databaseUrl(filePath: string) {
    assertE2EPath(filePath);
    return pathToFileURL(filePath).href;
}

async function executeWithBusyRetry<T>(operation: () => Promise<T>, attempts = 8) {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (
                !(error instanceof Error) ||
                !error.message.includes("SQLITE_BUSY") ||
                attempt === attempts - 1
            ) {
                throw error;
            }
            await new Promise((resolve) =>
                setTimeout(resolve, 80 * (attempt + 1)),
            );
        }
    }
    throw lastError;
}

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    try {
        const result = await client.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
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

function readRequiredString(value: unknown, field: string) {
    if (typeof value === "string") {
        return value;
    }
    throw new Error(`Unexpected source_connections.${field} value`);
}

function readNullableString(value: unknown, field: string) {
    if (value === null || typeof value === "string") {
        return value;
    }
    throw new Error(`Unexpected source_connections.${field} value`);
}

function readRequiredNumber(value: unknown, field: string) {
    if (typeof value !== "number" && typeof value !== "bigint") {
        throw new Error(`Unexpected source_connections.${field} value`);
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        throw new Error(`Unexpected source_connections.${field} value`);
    }
    return numericValue;
}

function readNullableNumber(value: unknown, field: string) {
    if (value === null) {
        return null;
    }
    return readRequiredNumber(value, field);
}

function readForcedProvider(value: unknown) {
    if (
        typeof value === "string" &&
        REAL_BACKEND_FORCED_PROVIDERS.includes(
            value as RealBackendForcedProvider,
        )
    ) {
        return value as RealBackendForcedProvider;
    }
    throw new Error("Unexpected source_connections.provider value");
}

async function snapshotForcedDataSourceConnections(userId: string) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    try {
        const result = await executeWithBusyRetry(() =>
            client.execute({
                sql: `SELECT id, user_id, provider, enabled, auth_mode, base_url,
                        config, secret_config, last_sync, created_at, updated_at
                    FROM source_connections
                    WHERE user_id = ?
                        AND provider IN (${REAL_BACKEND_FORCED_PROVIDER_PLACEHOLDERS})
                    ORDER BY provider`,
                args: [userId, ...REAL_BACKEND_FORCED_PROVIDERS],
            }),
        );

        return result.rows.map(
            (row): SourceConnectionSnapshotRow => ({
                id: readRequiredString(row.id, "id"),
                userId: readRequiredString(row.user_id, "user_id"),
                provider: readForcedProvider(row.provider),
                enabled: readRequiredNumber(row.enabled, "enabled"),
                authMode: readNullableString(row.auth_mode, "auth_mode"),
                baseUrl: readNullableString(row.base_url, "base_url"),
                config: readNullableString(row.config, "config"),
                secretConfig: readNullableString(
                    row.secret_config,
                    "secret_config",
                ),
                lastSync: readNullableNumber(row.last_sync, "last_sync"),
                createdAt: readRequiredNumber(row.created_at, "created_at"),
                updatedAt: readRequiredNumber(row.updated_at, "updated_at"),
            }),
        );
    } finally {
        await client.close();
    }
}

async function cleanupForcedDataSourceConnections(userId: string) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    try {
        await executeWithBusyRetry(() =>
            client.execute({
                sql: `DELETE FROM source_connections
                    WHERE user_id = ?
                        AND provider IN (${REAL_BACKEND_FORCED_PROVIDER_PLACEHOLDERS})`,
                args: [userId, ...REAL_BACKEND_FORCED_PROVIDERS],
            }),
        );
    } finally {
        await client.close();
    }
}

async function restoreForcedDataSourceConnections(
    userId: string,
    snapshot: readonly SourceConnectionSnapshotRow[],
) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    try {
        await executeWithBusyRetry(() =>
            client.batch(
                [
                    {
                        sql: `DELETE FROM source_connections
                            WHERE user_id = ?
                                AND provider IN (${REAL_BACKEND_FORCED_PROVIDER_PLACEHOLDERS})`,
                        args: [userId, ...REAL_BACKEND_FORCED_PROVIDERS],
                    },
                    ...snapshot.map((row) => ({
                        sql: `INSERT INTO source_connections (
                                id, user_id, provider, enabled, auth_mode, base_url,
                                config, secret_config, last_sync, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        args: [
                            row.id,
                            row.userId,
                            row.provider,
                            row.enabled,
                            row.authMode,
                            row.baseUrl,
                            row.config,
                            row.secretConfig,
                            row.lastSync,
                            row.createdAt,
                            row.updatedAt,
                        ],
                    })),
                ],
                "write",
            ),
        );
    } finally {
        await client.close();
    }
}

async function seedExpiredDingTalkConnection(userId: string) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    const now = Date.now();
    try {
        await executeWithBusyRetry(() =>
            client.execute({
                sql: `
                    INSERT INTO source_connections (
                        id, user_id, provider, enabled, auth_mode, base_url,
                        config, secret_config, last_sync, created_at, updated_at
                    ) VALUES (?, ?, 'dingtalk-a1', 1, 'device-signin', ?, ?, NULL, NULL, ?, ?)
                    ON CONFLICT(user_id, provider) DO UPDATE SET
                        enabled = 1,
                        auth_mode = 'device-signin',
                        base_url = excluded.base_url,
                        config = excluded.config,
                        secret_config = NULL,
                        last_sync = NULL,
                        updated_at = excluded.updated_at
                `,
                args: [
                    `e2e-ds-expired-${now}`,
                    userId,
                    "https://meeting-ai-tingji.dingtalk.com",
                    JSON.stringify({ connectionStatus: "expired" }),
                    now,
                    now,
                ],
            }),
        );
    } finally {
        await client.close();
    }
}

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
            theme: "dark",
            uiLanguage: "zh-CN",
        },
    });
    expect(resetResponse.ok()).toBe(true);
}

async function openDataSourcesSettings(page: Page) {
    await page.addInitScript(() => {
        const settingsWindow = window as Window & {
            __settingsLastSectionWrites?: string[];
        };
        const storagePrototype = Storage.prototype as Storage & {
            __settingsLastSectionSetItemPatched?: true;
        };

        settingsWindow.__settingsLastSectionWrites = [];
        if (storagePrototype.__settingsLastSectionSetItemPatched) {
            return;
        }

        const setItem = storagePrototype.setItem;
        storagePrototype.setItem = function patchedSetItem(key, value) {
            if (key === "settings-last-section") {
                settingsWindow.__settingsLastSectionWrites?.push(String(value));
            }

            return setItem.call(this, key, value);
        };
        storagePrototype.__settingsLastSectionSetItemPatched = true;
    });
    await page.evaluate(() => {
        localStorage.removeItem("settings-data-source-provider");
        localStorage.removeItem("settings-last-section");
    });
    await page.goto("/settings#data-sources", { waitUntil: "domcontentloaded" });
    const shell = settingsShell(page);
    await expect(shell).toBeVisible();
    await expect(settingsNavigation(page, "data-sources")).toHaveAttribute(
        "aria-current",
        "page",
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const section = dataSourcesSection(page);
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("aria-busy", "false");
    await expect
        .poll(() =>
            page.evaluate(() => localStorage.getItem("settings-last-section")),
        )
        .toBe("data-sources");
    const sectionWrites = await page.evaluate(() => {
        const settingsWindow = window as Window & {
            __settingsLastSectionWrites?: string[];
        };

        return settingsWindow.__settingsLastSectionWrites ?? [];
    });
    expect(sectionWrites).not.toContain("transcription");
    return section;
}

const sourceProviderNames: Record<string, RegExp> = {
    "dingtalk-a1": /钉钉\s*闪记|DingTalk A1 Flash Notes/,
    "feishu-minutes": /飞书妙记|Feishu Minutes/,
    iflyrec: /讯飞听见|iFLYTEK iflyrec/,
    plaud: /Plaud\s*(云端|Cloud)?/,
    ticnote: /TicNote/,
};

const settingsSectionNames: Record<string, RegExp> = {
    appearance: /^(显示设置|Display Settings)$/,
    "data-sources": /^(数据源|Data Sources)$/,
    misc: /^(杂项|Misc)$/,
};

function settingsShell(page: Page) {
    return page.getByRole("dialog", { name: /^(设置|Settings)$/ });
}

function settingsNavigation(page: Page, section: string) {
    return settingsShell(page).getByRole("button", {
        exact: true,
        name: settingsSectionNames[section] ?? section,
    });
}

function dataSourcesRail(section: Locator) {
    return section.getByRole("complementary", {
        name: /^(数据源列表|Data source list)$/,
    });
}

function dataSourcesSection(page: Page) {
    return dataSourcesRail(settingsShell(page)).locator("..");
}

function sourceProviderButton(section: Locator, provider: string) {
    const name = sourceProviderNames[provider];
    if (!name) {
        throw new Error(`Unknown data source provider: ${provider}`);
    }

    return dataSourcesRail(section).getByRole("button", { name });
}

function sourceProviderDetail(section: Locator, provider: string) {
    const name = sourceProviderNames[provider];
    if (!name) {
        throw new Error(`Unknown data source provider: ${provider}`);
    }

    return section.getByRole("region", { name });
}

function sourceAuthModeControl(root: Locator, name: string | RegExp) {
    return root.getByRole("radio", { name });
}

function sourceProviderStatus(root: Locator, status: string) {
    return root
        .getByRole("status")
        .filter({ hasText: new RegExp(status) })
        .first();
}

function sourceStateMessage(root: Locator, message: string | RegExp) {
    return root.getByText(message, { exact: typeof message === "string" });
}

function sourceEnableSyncControl(root: Locator) {
    return root.getByRole("switch", { name: /^(启用同步|Enable sync)$/ });
}

function sourceActionFooter(root: Locator) {
    return root.locator("footer");
}

function sourceTestControl(root: Locator) {
    return root.getByRole("button", {
        name: /^(测试连接|测试中|连接正常|Test|Testing|Ready)$/,
    });
}

function sourceSaveControl(root: Locator) {
    return root.getByRole("button", {
        name: /^(保存|保存中|已保存|Save|Saving|Saved)$/,
    });
}

async function expectSwitchChecked(locator: Locator) {
    await expect(locator).toHaveAttribute("aria-checked", "true");
    await expect(locator).toBeEnabled();
}

async function pasteTextIntoInput(
    locator: ReturnType<Page["locator"]>,
    text: string,
) {
    await locator.evaluate((element, pastedText) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData("text", pastedText);
        clipboardData.setData("text/plain", pastedText);
        const event = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData,
        });
        element.dispatchEvent(event);
    }, text);
}

test("canonical handoff data-sources ready state renders read-only reference evidence", async ({
    page,
}, testInfo) => {
    const canonicalSotAudit = await resolveVerifiedCanonicalSotReference();
    if (!canonicalSotAudit.available) {
        test.skip(true, canonicalSotAudit.reason);
        return;
    }

    const {
        reference: canonicalSotReference,
        snapshot: canonicalSotReferenceBefore,
    } = canonicalSotAudit;
    assertCanonicalSotReferenceMatchesRecovery(canonicalSotReferenceBefore);

    try {
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto(canonicalSotReference.webIndexUrl, {
            waitUntil: "load",
        });

        await page.getByRole("button", { name: "打开设置" }).click();
        await page.locator('.sr-item[data-section="data-sources"]').click();

        const dataSources = page.locator(
            '.settings-main.three-pane[data-section="data-sources"]',
        );
        const providers = dataSources.locator("#ds-providers .sp-card");
        const detail = dataSources.locator("#ds-detail");

        await expect(dataSources).toBeVisible();
        await expect(dataSources).not.toHaveAttribute("aria-hidden", "true");
        await expect(providers).toHaveCount(5);
        await providers.filter({ hasText: "TicNote" }).click();
        await expect(
            detail.getByRole("heading", { name: "TicNote" }),
        ).toBeVisible();
        await expect(detail.locator("[data-ds-enable]")).toBeVisible();
        await expect(detail.locator("[data-save-test]")).toBeVisible();
        await expect(detail.locator("[data-save-action]")).toBeVisible();

        const [providerBox, detailBox] = await Promise.all([
            page.locator("#ds-providers").boundingBox(),
            detail.boundingBox(),
        ]);
        expect(providerBox).not.toBeNull();
        expect(detailBox).not.toBeNull();
        expect(providerBox?.width).toBeGreaterThanOrEqual(280);
        expect(detailBox?.x).toBeGreaterThan(providerBox?.x ?? 0);

        const screenshot = await dataSources.screenshot();
        await testInfo.attach("canonical-data-sources-ready.png", {
            body: screenshot,
            contentType: "image/png",
        });
        await testInfo.attach("canonical-data-sources-ready.json", {
            body: Buffer.from(
                JSON.stringify({
                    manifestSha256: canonicalSotReferenceBefore.manifestSha256,
                    providerCardCount: await providers.count(),
                    selectedProvider: "TicNote",
                    viewport: { height: 720, width: 1280 },
                }),
            ),
            contentType: "application/json",
        });
    } finally {
        const canonicalSotReferenceAfter =
            await snapshotCanonicalSotReference(canonicalSotReference);
        assertCanonicalSotReferenceMatchesRecovery(canonicalSotReferenceAfter);
        assertCanonicalSotReferenceUnchanged(
            canonicalSotReferenceBefore,
            canonicalSotReferenceAfter,
        );
    }
});

test("data sources settings shows section-level load failure and retries", async ({
    page,
}) => {
    let failNextLoad = false;
    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        if (failNextLoad && page.url().includes("/settings")) {
            failNextLoad = false;
            await route.fulfill({
                contentType: "application/json",
                status: 503,
                body: JSON.stringify({ error: "数据源服务暂不可用" }),
            });
            return;
        }

        await route.continue();
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);

    failNextLoad = true;
    const section = await openDataSourcesSettings(page);
    await expect(section.getByRole("alert")).toContainText("数据源服务暂不可用");

    const retry = section.getByRole("button", { name: "重试" });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(section).toHaveAttribute("aria-busy", "false");
    await expect(sourceProviderButton(section, "dingtalk-a1")).toBeVisible();
});

test("data sources settings drives real backend forced save and expired states", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    const userId = await getPlaywrightUserId();
    const sourceConnectionSnapshot =
        await snapshotForcedDataSourceConnections(userId);

    try {
        await cleanupForcedDataSourceConnections(userId);
        await seedExpiredDingTalkConnection(userId);

        const section = await openDataSourcesSettings(page);
        const dingtalkRow = sourceProviderButton(section, "dingtalk-a1");
        await expect(
            sourceProviderStatus(dingtalkRow, "需要重新登录"),
        ).toBeVisible();
        await dingtalkRow.click();

        const dingtalkDetail = sourceProviderDetail(section, "dingtalk-a1");
        await expect(
            sourceStateMessage(
                dingtalkDetail,
                "上游登录状态已过期，请更新登录信息后保存。",
            ),
        ).toBeVisible();

        await sourceProviderButton(section, "ticnote").click();
        const ticnoteDetail = sourceProviderDetail(section, "ticnote");
        await page
            .locator("#ticnote-source-secret")
            .fill("fake-real-backend-e2e-token");

        const ticnoteSave = sourceSaveControl(ticnoteDetail);
        const saveSuccessResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources") &&
                response.request().method() === "PUT" &&
                response.ok(),
        );
        await ticnoteSave.click();
        await saveSuccessResponse;
        await expect(sourceStateMessage(ticnoteDetail, "已保存").first()).toBeVisible();
        await expect(ticnoteSave).toHaveAttribute("aria-busy", "false");
        await expect(
            sourceStateMessage(
                ticnoteDetail,
                "连接信息已保存，稍后导入会使用最新设置。",
            ),
        ).toBeVisible();
        await expect(sourceActionFooter(ticnoteDetail)).toBeVisible();

        await sourceProviderButton(section, "iflyrec").click();
        const iflyrecDetail = sourceProviderDetail(section, "iflyrec");
        await sourceEnableSyncControl(iflyrecDetail).click();
        const iflyrecSave = sourceSaveControl(iflyrecDetail);
        const saveErrorResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources") &&
                response.request().method() === "PUT" &&
                response.status() === 400,
        );
        await iflyrecSave.click();
        await saveErrorResponse;
        await expect(iflyrecSave).toHaveAttribute("aria-busy", "false");
        await expect(
            sourceStateMessage(iflyrecDetail, "保存失败").first(),
        ).toBeVisible();
        await expect(
            sourceStateMessage(
                iflyrecDetail,
                "保存失败，请检查连接信息后重试。",
            ),
        ).toBeVisible();
    } finally {
        await restoreForcedDataSourceConnections(
            userId,
            sourceConnectionSnapshot,
        );
    }
});

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

    const ticnoteRow = sourceProviderButton(section, "ticnote");
    await ticnoteRow.click();
    await expect(ticnoteRow).toHaveAttribute("aria-pressed", "true");

    const detail = sourceProviderDetail(section, "ticnote");
    const sourceTest = sourceTestControl(detail);
    const sourceSave = sourceSaveControl(detail);
    const actionFooter = sourceActionFooter(detail);
    const ticnoteEnable = sourceEnableSyncControl(detail);
    await expect(detail).toBeVisible();
    await expect(sourceProviderStatus(detail, "待设置")).toBeVisible();
    await expect(detail.getByRole("heading", { name: "TicNote" })).toBeVisible();
    const ticnoteProviderFields = detail;
    await expect(ticnoteProviderFields).toBeVisible();
    await expect(ticnoteProviderFields).toContainText(
        /站点版本[\s\S]*TicNote 访问凭证/,
    );
    await expect(
        ticnoteProviderFields
            .locator("label")
            .filter({ hasText: /^站点版本$/ }),
    ).toBeVisible();
    const ticnoteSiteEdition = ticnoteProviderFields.getByRole("combobox", {
        name: "站点版本",
    });
    await expect(ticnoteSiteEdition).toBeVisible();
    await expect(ticnoteSiteEdition).toBeEnabled();
    await expect(
        ticnoteProviderFields
            .locator("label")
            .filter({ hasText: /^TicNote 访问凭证$/ }),
    ).toBeVisible();
    const ticnoteCredential =
        ticnoteProviderFields.getByLabel("TicNote 访问凭证");
    await expect(ticnoteCredential).toBeVisible();
    await expect(ticnoteCredential).toBeEnabled();
    await expect(actionFooter).toBeVisible();
    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(sourceSave).toHaveAttribute("aria-busy", "false");

    await sourceTest.click();
    await expect(
        sourceStateMessage(detail, "信息不完整").first(),
    ).toBeVisible();
    await expect(
        sourceStateMessage(detail, "请先补齐登录信息，再测试连接。"),
    ).toBeVisible();
    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(sourceSave).toHaveAttribute("aria-busy", "false");

    await page.locator("#ticnote-source-secret").fill("fake-ticnote-token");
    await sourceTest.click();
    await testStarted;
    const shell = settingsShell(page);
    await expect(sourceProviderStatus(ticnoteRow, "测试中")).toBeVisible();
    await expect(sourceProviderStatus(detail, "测试中")).toBeVisible();
    await expect(sourceTest).toHaveAttribute("aria-busy", "true");
    await expect(sourceSave).toHaveAttribute("aria-busy", "false");
    await expect(sourceStateMessage(detail, "测试中").first()).toBeVisible();
    await expect(shell).toHaveAttribute("aria-busy", "true");
    await expect(detail).toHaveAttribute("aria-busy", "true");
    const plaudProvider = sourceProviderButton(section, "plaud");
    await expect(plaudProvider).toBeDisabled();
    await expect(
        settingsNavigation(page, "appearance"),
    ).toBeDisabled();
    await expect(
        shell.getByRole("button", { name: /^(关闭设置|Close settings)$/ }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(shell).toBeVisible();
    await expect(ticnoteRow).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#ticnote-source-secret")).toBeDisabled();
    await expect(ticnoteEnable).toBeDisabled();
    await expect(sourceTest).toBeDisabled();
    await expect(sourceSave).toBeDisabled();
    expect(savePayload).toBeNull();
    releaseTest();
    await expect(sourceProviderStatus(ticnoteRow, "连接正常")).toBeVisible();
    await expect(sourceProviderStatus(detail, "连接正常")).toBeVisible();
    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(sourceSave).toHaveAttribute("aria-busy", "false");
    await expect(
        sourceStateMessage(detail, "连接测试通过").first(),
    ).toBeVisible();
    await expect(shell).toHaveAttribute("aria-busy", "false");
    await expect(detail).toHaveAttribute("aria-busy", "false");
    await expect(plaudProvider).toBeEnabled();
    await expect(
        settingsNavigation(page, "appearance"),
    ).toBeEnabled();
    await expect(
        shell.getByRole("button", { name: /^(关闭设置|Close settings)$/ }),
    ).toBeEnabled();
    await expect(page.locator("#ticnote-source-secret")).toBeEnabled();
    await expect(ticnoteEnable).toBeEnabled();
    await expect(
        sourceStateMessage(
            detail,
            "连接测试通过。测试不会保存当前连接信息。",
        ),
    ).toBeVisible();
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

    await ticnoteEnable.click();
    await expectSwitchChecked(ticnoteEnable);

    await sourceSave.click();
    await saveStarted;
    await expect(sourceProviderStatus(ticnoteRow, "保存中")).toBeVisible();
    await expect(sourceProviderStatus(detail, "保存中")).toBeVisible();
    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(sourceSave).toHaveAttribute("aria-busy", "true");
    await expect(sourceStateMessage(detail, "保存中").first()).toBeVisible();
    await expect(shell).toHaveAttribute("aria-busy", "true");
    await expect(detail).toHaveAttribute("aria-busy", "true");
    await expect(plaudProvider).toBeDisabled();
    await expect(ticnoteRow).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#ticnote-source-secret")).toBeDisabled();
    await expect(ticnoteEnable).toBeDisabled();
    await expect(sourceTest).toBeDisabled();
    await expect(sourceSave).toBeDisabled();
    releaseSave();

    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(sourceSave).toHaveAttribute("aria-busy", "false");
    await expect(sourceStateMessage(detail, "已保存").first()).toBeVisible();
    await expect(shell).toHaveAttribute("aria-busy", "false");
    await expect(detail).toHaveAttribute("aria-busy", "false");
    await expect(plaudProvider).toBeEnabled();
    await expect(sourceProviderStatus(detail, "连接正常")).toBeVisible();
    await expect(sourceProviderStatus(ticnoteRow, "已连接")).toBeVisible({
        timeout: 4_000,
    });
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

test("data sources settings keeps Plaud non-JSON test failures visible in the SOT error state", async ({
    page,
}) => {
    const sources = [
        makeSource("plaud", {
            displayName: "Plaud",
            config: { server: "global" },
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
    await page.route("**/api/data-sources/test", async (route) => {
        await route.fulfill({
            contentType: "text/html",
            status: 403,
            body: "<!doctype html><title>Forbidden</title><h1>Forbidden</h1>",
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    const section = await openDataSourcesSettings(page);

    await sourceProviderButton(section, "plaud").click();
    const plaudDetail = sourceProviderDetail(section, "plaud");
    const sourceTest = sourceTestControl(plaudDetail);

    await page.locator("#plaud-source-secret").fill("Bearer e2e-plaud-token");
    await sourceTest.click();

    await expect(
        sourceStateMessage(plaudDetail, "测试数据源连接失败"),
    ).toBeVisible();
    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("#plaud-source-secret")).toBeEnabled();
});

test("data sources settings keeps save failures scoped and editable", async ({
    page,
}) => {
    const sources = [
        makeSource("ticnote", {
            baseUrl: "https://voice-api.ticnote.cn",
            config: { region: "cn" },
            displayName: "TicNote",
        }),
    ];
    let savePayload: Record<string, unknown> | null = null;

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
            status: 503,
            body: JSON.stringify({ error: "保存服务暂不可用" }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    const section = await openDataSourcesSettings(page);
    const detail = sourceProviderDetail(section, "ticnote");
    const sourceSave = sourceSaveControl(detail);
    const sourceTest = sourceTestControl(detail);
    const actionFooter = sourceActionFooter(detail);
    const ticnoteRow = sourceProviderButton(section, "ticnote");
    const ticnoteEnable = sourceEnableSyncControl(detail);

    await page.locator("#ticnote-source-secret").fill("failed-save-token");
    await ticnoteEnable.click();
    await sourceSave.click();

    await expect(sourceSave).toHaveAttribute("aria-busy", "false");
    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(
        sourceStateMessage(detail, "保存失败").first(),
    ).toBeVisible();
    await expect(
        sourceStateMessage(detail, "保存失败，请检查连接信息后重试。"),
    ).toBeVisible();
    await expect(actionFooter).toBeVisible();
    await expect(sourceProviderStatus(ticnoteRow, "需要处理")).toBeVisible();
    await expect(detail).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("#ticnote-source-secret")).toBeEnabled();
    await expect(page.locator("#ticnote-source-secret")).toHaveValue(
        "failed-save-token",
    );
    await expect(ticnoteEnable).toBeEnabled();
    await expectSwitchChecked(ticnoteEnable);
    expect(savePayload).toMatchObject({
        enabled: true,
        provider: "ticnote",
        secrets: { bearerToken: "failed-save-token" },
    });
});

test("data sources settings masks sensitive fields and preserves pasted sign-in details", async ({
    page,
}) => {
    const sources = [
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
        }),
    ];
    const testPayloads: Record<string, unknown>[] = [];

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

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    const section = await openDataSourcesSettings(page);

    await sourceProviderButton(section, "ticnote").click();
    const ticnoteDetail = sourceProviderDetail(section, "ticnote");
    const ticnoteSecret = page.locator("#ticnote-source-secret");
    await expect(ticnoteSecret).toHaveAttribute("type", "password");
    await ticnoteSecret.fill("stale-token");
    await pasteTextIntoInput(ticnoteSecret, "Bearer pasted-data-source-token");
    await expect(ticnoteSecret).toHaveValue("Bearer pasted-data-source-token");

    await sourceTestControl(ticnoteDetail).click();
    await expect(
        sourceStateMessage(ticnoteDetail, "连接测试通过").first(),
    ).toBeVisible();
    expect(testPayloads.at(-1)).toMatchObject({
        provider: "ticnote",
        secrets: { bearerToken: "pasted-data-source-token" },
    });

    await sourceProviderButton(section, "feishu-minutes").click();
    const feishuDetail = sourceProviderDetail(section, "feishu-minutes");
    await sourceAuthModeControl(feishuDetail, /网页登录信息/).click();

    const webCookieInput = page.locator("#feishu-minutes-source-web-cookie");
    const webTokenInput = page.locator("#feishu-minutes-source-web-token");
    await expect(webCookieInput).toHaveAttribute("type", "password");
    await expect(webTokenInput).toHaveAttribute("type", "password");

    await page.locator("#feishu-minutes-source-space-name").fill("cn");
    await webCookieInput.fill("stale-cookie");
    await pasteTextIntoInput(
        webCookieInput,
        "minutes_csrf_token=e2e; session=e2e",
    );
    await pasteTextIntoInput(webTokenInput, "x-minutes-pasted-token");
    await expect(webCookieInput).toHaveValue(
        "minutes_csrf_token=e2e; session=e2e",
    );
    await expect(webTokenInput).toHaveValue("x-minutes-pasted-token");

    await sourceTestControl(feishuDetail).click();
    await expect(
        sourceStateMessage(feishuDetail, "连接测试通过").first(),
    ).toBeVisible();
    expect(testPayloads.at(-1)).toMatchObject({
        authMode: "web-reverse",
        provider: "feishu-minutes",
        secrets: {
            webCookie: "minutes_csrf_token=e2e; session=e2e",
            webToken: "x-minutes-pasted-token",
        },
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
    const shell = settingsShell(page);
    await expect(shell).toBeVisible();
    await expect(settingsNavigation(page, "appearance")).toHaveAttribute(
        "aria-current",
        "page",
    );

    await settingsNavigation(page, "data-sources").click();
    await expect(page).toHaveURL(/\/settings#data-sources$/);
    const section = dataSourcesSection(page);
    await expect(section).toBeVisible();
    await expect(settingsNavigation(page, "data-sources")).toHaveAttribute(
        "aria-current",
        "page",
    );

    const shellHeight = await shell.evaluate(
        (node) => node.getBoundingClientRect().height,
    );
    const expiredProvider = sourceProviderButton(section, "dingtalk-a1");
    await expiredProvider.click();
    const expiredDetail = sourceProviderDetail(section, "dingtalk-a1");
    await expiredDetail.hover();
    await page.mouse.wheel(0, 900);
    await expect(settingsNavigation(page, "data-sources")).toHaveAttribute(
        "aria-current",
        "page",
    );
    const shellHeightAfterScroll = await shell.evaluate(
        (node) => node.getBoundingClientRect().height,
    );
    expect(Math.abs(shellHeightAfterScroll - shellHeight)).toBeLessThan(2);

    await expect(
        sourceProviderStatus(expiredProvider, "需要重新登录"),
    ).toBeVisible();
    await expect(
        sourceStateMessage(
            expiredDetail,
            "上游登录状态已过期，请更新登录信息后保存。",
        ),
    ).toBeVisible();

    await sourceProviderButton(section, "plaud").click();
    await expect(
        sourceProviderStatus(sourceProviderDetail(section, "plaud"), "同步已暂停"),
    ).toBeVisible();

    await sourceProviderButton(section, "feishu-minutes").click();
    const plannedDetail = sourceProviderDetail(section, "feishu-minutes");
    await expect(sourceProviderStatus(plannedDetail, "即将支持")).toBeVisible();
    await expect(sourceTestControl(plannedDetail)).toBeDisabled();
    await expect(sourceSaveControl(plannedDetail)).toBeDisabled();
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

    const feishuProvider = sourceProviderButton(section, "feishu-minutes");
    await feishuProvider.click();
    await expect(feishuProvider).toHaveAttribute("aria-pressed", "true");

    const detail = sourceProviderDetail(section, "feishu-minutes");
    const authModeGroup = detail.getByRole("radiogroup", {
        name: "选择登录方式",
    });
    const oauthModeControl = sourceAuthModeControl(detail, /开放平台授权/);
    const webReverseModeControl = sourceAuthModeControl(
        detail,
        /网页登录信息/,
    );
    await expect(detail).toBeVisible();
    await expect(authModeGroup).toBeVisible();
    await expect(oauthModeControl).toBeChecked();
    await expect(webReverseModeControl).not.toBeChecked();
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
    await sourceTestControl(detail).click();
    await expect(
        sourceStateMessage(detail, "连接测试通过").first(),
    ).toBeVisible();
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

    await webReverseModeControl.click();
    await expect(oauthModeControl).not.toBeChecked();
    await expect(webReverseModeControl).toBeChecked();
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
    await sourceTestControl(detail).click();
    await expect(
        sourceStateMessage(detail, "连接测试通过").first(),
    ).toBeVisible();
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

test("data sources settings saves pause and reconnect lifecycle states", async ({
    page,
}) => {
    let sources = [
        makeSource("plaud", {
            connected: true,
            displayName: "Plaud",
            enabled: true,
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
    const savePayloads: Record<string, unknown>[] = [];

    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ sources }),
            });
            return;
        }

        const payload = route.request().postDataJSON();
        savePayloads.push(payload);
        sources = sources.map((source) =>
            source.provider === payload.provider
                ? {
                      ...source,
                      authMode: payload.authMode ?? source.authMode,
                      baseUrl: payload.baseUrl ?? source.baseUrl,
                      config: {
                          ...source.config,
                          ...((payload.config as Record<string, unknown>) ??
                              {}),
                      },
                      connected: true,
                      connectionStatus: "ready",
                      enabled: Boolean(payload.enabled),
                      secretsConfigured: Object.fromEntries(
                          Object.entries(
                              (payload.secrets as Record<string, string>) ?? {},
                          ).map(([key, value]) => [
                              key,
                              Boolean(String(value).trim()) ||
                                  Boolean(source.secretsConfigured[key]),
                          ]),
                      ),
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

    await sourceProviderButton(section, "plaud").click();
    const plaudDetail = sourceProviderDetail(section, "plaud");
    await expect(sourceProviderStatus(plaudDetail, "已连接")).toBeVisible();
    await sourceEnableSyncControl(plaudDetail).click();
    await expect(sourceActionFooter(plaudDetail)).toBeVisible();
    await sourceSaveControl(plaudDetail).click();
    await expect
        .poll(() => savePayloads.at(-1)?.provider)
        .toBe("plaud");
    expect(savePayloads.at(-1)).toMatchObject({
        enabled: false,
        provider: "plaud",
    });
    await expect(
        sourceProviderStatus(plaudDetail, "同步已暂停"),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
        sourceProviderStatus(
            sourceProviderButton(section, "plaud"),
            "同步已暂停",
        ),
    ).toBeVisible();

    await sourceProviderButton(section, "dingtalk-a1").click();
    const dingtalkDetail = sourceProviderDetail(section, "dingtalk-a1");
    await expect(
        sourceProviderStatus(dingtalkDetail, "需要重新登录"),
    ).toBeVisible();
    await page
        .locator("#dingtalk-a1-source-secret")
        .fill("dt-meeting-agent-token-e2e");
    await expect(sourceActionFooter(dingtalkDetail)).toBeVisible();
    await sourceSaveControl(dingtalkDetail).click();
    await expect
        .poll(() => savePayloads.at(-1)?.provider)
        .toBe("dingtalk-a1");
    expect(savePayloads.at(-1)).toMatchObject({
        authMode: "device-signin",
        baseUrl: "https://meeting-ai-tingji.dingtalk.com",
        enabled: true,
        provider: "dingtalk-a1",
        secrets: { deviceCredential: "dt-meeting-agent-token-e2e" },
    });
    await expect(
        sourceProviderStatus(dingtalkDetail, "已连接"),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
        sourceProviderStatus(
            sourceProviderButton(section, "dingtalk-a1"),
            "已连接",
        ),
    ).toBeVisible();
});

test("data sources settings keeps provider selector usable and private fields scoped", async ({
    page,
}) => {
    const sources = [
        makeSource("plaud", {
            connected: true,
            displayName: "Plaud",
            enabled: true,
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
    await page.setViewportSize({ width: 1280, height: 720 });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    const section = await openDataSourcesSettings(page);

    await sourceProviderButton(section, "plaud").click();
    const plaudDetail = sourceProviderDetail(section, "plaud");
    await expect(plaudDetail).toBeVisible();
    const plaudServerSelect = plaudDetail.getByRole("combobox", {
        name: "站点版本",
    });
    await chooseShadcnSelectOption(page, plaudServerSelect, "自定义");
    const selectedPlaudServer = plaudDetail.getByRole("combobox", {
        name: "站点版本",
    });
    await expectShadcnSelectTrigger(selectedPlaudServer, {
        label: "站点版本",
        text: "自定义",
    });
    await expect(page.locator("#plaud-source-custom-api-base")).toBeVisible();

    await sourceProviderButton(section, "feishu-minutes").click();
    const feishuDetail = sourceProviderDetail(section, "feishu-minutes");
    await sourceAuthModeControl(feishuDetail, /网页登录信息/).click();
    await expect(page.locator("#feishu-minutes-source-web-cookie")).toBeVisible();
    await expect(page.locator("#feishu-minutes-source-web-token")).toBeVisible();

    await settingsNavigation(page, "appearance").click();
    await expect(settingsNavigation(page, "appearance")).toHaveAttribute(
        "aria-current",
        "page",
    );
    await expect(dataSourcesSection(page)).toBeHidden();
    await expect(page.getByText("飞书妙记")).toHaveCount(0);
    await expect(page.getByText("Cookie")).toHaveCount(0);
    await expect(page.getByText("user_access_token")).toHaveCount(0);
    await expect(page.getByText("X-Feishu-Minutes-Token")).toHaveCount(0);

    await settingsNavigation(page, "misc").click();
    await expect(settingsNavigation(page, "misc")).toHaveAttribute(
        "aria-current",
        "page",
    );
    await expect(dataSourcesSection(page)).toBeHidden();
    await expect(page.getByText("飞书妙记")).toHaveCount(0);
    await expect(page.getByText("Cookie")).toHaveCount(0);
    await expect(page.getByText("user_access_token")).toHaveCount(0);
    await expect(page.getByText("X-Feishu-Minutes-Token")).toHaveCount(0);
});

test("data sources settings restores external provider selection and shows test backend failures", async ({
    page,
}) => {
    const sources = [
        makeSource("plaud", {
            connected: true,
            displayName: "Plaud",
            enabled: true,
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

    await page.route("**/api/data-sources/test", async (route) => {
        await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "连接服务暂不可用" }),
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

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.evaluate(() => {
        localStorage.removeItem("settings-last-section");
        localStorage.setItem("settings-data-source-provider", "iflyrec");
    });
    await page.goto("/settings#data-sources", { waitUntil: "domcontentloaded" });

    const section = dataSourcesSection(page);
    await expect(section).toBeVisible();
    await expect(sourceProviderButton(section, "iflyrec")).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await expect
        .poll(() =>
            page.evaluate(() =>
                localStorage.getItem("settings-data-source-provider"),
            ),
        )
        .toBe("iflyrec");

    const detail = sourceProviderDetail(section, "iflyrec");
    await expect(sourceProviderStatus(detail, "待设置")).toBeVisible();
    await page.locator("#iflyrec-source-secret").fill("iflyrec-session-e2e");
    const sourceTest = sourceTestControl(detail);
    await sourceTest.click();
    await expect(
        sourceStateMessage(detail, "连接服务暂不可用"),
    ).toBeVisible();
});

test("UNPROVEN: canonical Data Sources visual equivalence for backend states", () => {
    test.skip(
        true,
        "UNPROVEN: the immutable canonical handoff has only a ready-state Data Sources render. It has no API-derived reference for load failure/retry, testing, save success/failure, expired, planned, or paused backend states. This remains an explicit visual-evidence gap, not a parity pass; any representable product-versus-SOT mismatch must still fail.",
    );
});
