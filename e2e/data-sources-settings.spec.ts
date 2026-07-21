import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import { chooseShadcnSelectOption } from "./helpers/shadcn-select";

type SourceState = {
    config: Record<string, unknown>;
    enabled: boolean;
    secretConfig: string | null;
};

type CoreDatabaseLock = {
    release: () => Promise<void>;
};

function resolveDatabasePath() {
    const databasePath = process.env.DATABASE_PATH;
    if (!databasePath) {
        throw new Error("DATABASE_PATH is required for data source E2E");
    }

    return path.resolve(databasePath);
}

function databaseUrl(databasePath: string) {
    const e2eRoot = path.resolve(process.env.PLAYWRIGHT_E2E_ROOT ?? "");
    const resolved = path.resolve(databasePath);

    if (!e2eRoot || !resolved.startsWith(`${e2eRoot}${path.sep}`)) {
        throw new Error(`Refusing to access non-E2E database: ${resolved}`);
    }

    return pathToFileURL(resolved).href;
}

async function withDatabase<T>(callback: (client: ReturnType<typeof createClient>) => Promise<T>) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    try {
        return await callback(client);
    } finally {
        await client.close();
    }
}

async function lockCoreDatabase(): Promise<CoreDatabaseLock> {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    let released = false;

    try {
        await client.execute("PRAGMA busy_timeout = 0");
        await client.execute("BEGIN EXCLUSIVE");
    } catch (error) {
        client.close();
        throw error;
    }

    return {
        async release() {
            if (released) return;
            released = true;
            try {
                await client.execute("COMMIT");
            } finally {
                client.close();
            }
        },
    };
}

async function getE2eUserId() {
    return withDatabase(async (client) => {
        const result = await client.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: ["playwright-admin@example.com"],
        });
        const userId = result.rows[0]?.id;

        if (typeof userId !== "string") {
            throw new Error("Playwright user was not created");
        }

        return userId;
    });
}

async function markDingTalkConnectionExpired(userId: string) {
    await withDatabase(async (client) => {
        const result = await client.execute({
            sql: `UPDATE source_connections
                  SET enabled = 1,
                      config = ?,
                      updated_at = ?
                  WHERE user_id = ? AND provider = 'dingtalk-a1'`,
            args: [
                JSON.stringify({
                    connectionStatus: "expired",
                    syncTitleToSource: false,
                }),
                Date.now(),
                userId,
            ],
        });

        if (result.rowsAffected !== 1) {
            throw new Error("Unable to seed the DingTalk expired state");
        }
    });
}

async function setSourceRuntimeState(
    userId: string,
    provider: string,
    params: {
        config?: Record<string, unknown>;
        lastSyncError?: string | null;
        syncStatus?: "error" | "idle" | "syncing";
    },
) {
    await withDatabase(async (client) => {
        const result = await client.execute({
            sql: `UPDATE source_connections
                  SET config = COALESCE(?, config),
                      sync_status = COALESCE(?, sync_status),
                      last_sync_error = ?,
                      updated_at = ?
                  WHERE user_id = ? AND provider = ?`,
            args: [
                params.config === undefined ? null : JSON.stringify(params.config),
                params.syncStatus ?? null,
                params.lastSyncError ?? null,
                Date.now(),
                userId,
                provider,
            ],
        });

        if (result.rowsAffected !== 1) {
            throw new Error(`Unable to seed the ${provider} runtime state`);
        }
    });
}

async function seedSourceConnection(
    userId: string,
    provider: string,
    params: {
        config?: Record<string, unknown>;
        enabled?: boolean;
        lastSyncError?: string | null;
        syncStatus?: "error" | "idle" | "syncing";
    } = {},
) {
    await withDatabase(async (client) => {
        const now = Date.now();
        await client.execute({
            sql: `INSERT INTO source_connections (
                    id, user_id, provider, enabled, auth_mode, base_url, config,
                    secret_config, sync_status, last_sync_error,
                    last_sync_started_at, last_sync_finished_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?, NULL, NULL, ?, ?)
                ON CONFLICT(user_id, provider) DO UPDATE SET
                    enabled = excluded.enabled,
                    auth_mode = NULL,
                    base_url = NULL,
                    config = excluded.config,
                    secret_config = NULL,
                    sync_status = excluded.sync_status,
                    last_sync_error = excluded.last_sync_error,
                    last_sync_started_at = NULL,
                    last_sync_finished_at = NULL,
                    updated_at = excluded.updated_at`,
            args: [
                `e2e-data-source-${provider}-${now}`,
                userId,
                provider,
                params.enabled ? 1 : 0,
                JSON.stringify(params.config ?? {}),
                params.syncStatus ?? "idle",
                params.lastSyncError ?? null,
                now,
                now,
            ],
        });
    });
}

async function readSourceState(userId: string, provider: string): Promise<SourceState> {
    return withDatabase(async (client) => {
        const result = await client.execute({
            sql: `SELECT enabled, config, secret_config
                  FROM source_connections
                  WHERE user_id = ? AND provider = ? LIMIT 1`,
            args: [userId, provider],
        });
        const row = result.rows[0];

        if (!row) {
            throw new Error(`Missing source connection for ${provider}`);
        }

        if (typeof row.config !== "string") {
            throw new Error(`Unexpected config for ${provider}`);
        }

        if (row.secret_config !== null && typeof row.secret_config !== "string") {
            throw new Error(`Unexpected secret config for ${provider}`);
        }

        return {
            config: JSON.parse(row.config) as Record<string, unknown>,
            enabled: Number(row.enabled) === 1,
            secretConfig: row.secret_config,
        };
    });
}

async function setChineseDisplay(page: Page) {
    const response = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "dark",
            uiLanguage: "zh-CN",
        },
    });

    expect(response.ok()).toBe(true);
}

function settingsDialog(page: Page) {
    return page.getByRole("dialog", { name: /^(设置|Settings)$/ });
}

function dataSourcesSection(page: Page) {
    return settingsDialog(page)
        .getByRole("complementary", { name: /^(数据源列表|Data source list)$/ })
        .locator("..");
}

function sourceButton(section: Locator, name: RegExp) {
    return section
        .getByRole("complementary", { name: /^(数据源列表|Data source list)$/ })
        .getByRole("button", { name });
}

function sourceDetail(section: Locator, name: RegExp) {
    return section.getByRole("region", { name });
}

function sourceStatus(detail: Locator, label: RegExp) {
    return detail.getByRole("status").filter({ hasText: label }).first();
}

async function expectPlaudDraftToRemain(detail: Locator) {
    await expect(detail.locator("#plaud-source-secret")).toHaveValue(
        "local-e2e-credential",
    );
    await expect(detail.locator("#plaud-source-custom-api-base")).toHaveValue(
        "not-a-url",
    );
    await expect(
        detail.getByRole("switch", { name: "启用同步" }),
    ).toHaveAttribute("aria-checked", "true");
}

async function openDataSources(page: Page) {
    const currentUrl = new URL(page.url());
    if (
        currentUrl.pathname === "/settings" &&
        currentUrl.hash === "#data-sources"
    ) {
        await page.reload({ waitUntil: "domcontentloaded" });
    } else {
        await page.goto("/settings#data-sources", {
            waitUntil: "domcontentloaded",
        });
    }
    await expect(settingsDialog(page)).toBeVisible();
    const section = dataSourcesSection(page);
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("aria-busy", "false");
    return section;
}

async function getSourceFromApi(page: Page, provider: string) {
    const response = await page.request.get("/api/data-sources");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as {
        sources: Array<Record<string, unknown>>;
    };
    const source = payload.sources.find((candidate) => candidate.provider === provider);

    if (!source) {
        throw new Error(`Missing API source state for ${provider}`);
    }

    return source;
}

test("Data Sources waits for the real locked core database and preserves failed drafts", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await setChineseDisplay(page);

    const userId = await getE2eUserId();
    await seedSourceConnection(userId, "plaud");

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(settingsDialog(page)).toBeVisible();
    const displayNavigation = settingsDialog(page).getByRole("button", {
        name: "显示设置",
    });
    await displayNavigation.click();
    await expect(displayNavigation).toHaveAttribute("aria-current", "page");

    const databaseLock = await lockCoreDatabase();
    try {
        const loadResponse = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === "/api/data-sources" &&
                response.request().method() === "GET",
        );
        const dataSourcesNavigation = settingsDialog(page).getByRole("button", {
            name: "数据源",
        });
        await dataSourcesNavigation.click();
        const section = dataSourcesSection(page);

        await expect(section).toBeVisible();
        await expect(section).toHaveAttribute("aria-busy", "true");
        await databaseLock.release();
        expect((await loadResponse).status()).toBe(200);
        await expect(section).toHaveAttribute("aria-busy", "false");
    } finally {
        await databaseLock.release();
    }

    const section = dataSourcesSection(page);
    await sourceButton(section, /Plaud/).click();
    const plaudDetail = sourceDetail(section, /Plaud/);
    const plaudServer = plaudDetail.getByRole("combobox", {
        name: "站点版本",
    });

    await chooseShadcnSelectOption(page, plaudServer, "自定义");
    await page.locator("#plaud-source-secret").fill("local-e2e-credential");
    await page.locator("#plaud-source-custom-api-base").fill("not-a-url");

    const enabledDraft = plaudDetail.getByRole("switch", {
        name: "启用同步",
    });
    await enabledDraft.click();
    await expect(sourceStatus(plaudDetail, /已配置|Configured/)).toBeVisible();

    const testRequest = page.waitForRequest(
        (request) =>
            new URL(request.url()).pathname === "/api/data-sources/test" &&
            request.method() === "POST",
    );
    const testResponse = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === "/api/data-sources/test" &&
            response.request().method() === "POST",
    );
    const testButton = plaudDetail.getByRole("button", {
        name: /测试连接|测试中/,
    });
    const testLock = await lockCoreDatabase();
    try {
        await Promise.all([
            testRequest,
            testButton.click(),
            expect(testButton).toBeDisabled({ timeout: 1_000 }),
            expect(testButton).toHaveAttribute("aria-busy", "true", {
                timeout: 1_000,
            }),
        ]);
        await testLock.release();
        expect((await testResponse).status()).toBe(400);
        await expect(
            plaudDetail
                .locator('[data-slot="alert"]')
                .filter({ hasText: "连接测试失败" }),
        ).toBeVisible();
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expect(testButton).toBeEnabled();
        await expect(testButton).toHaveAttribute("aria-busy", "false");
        await expectPlaudDraftToRemain(plaudDetail);
    } finally {
        await testLock.release();
    }
    const testFailureApiState = await getSourceFromApi(page, "plaud");
    expect(testFailureApiState.enabled).toBe(false);

    const saveRequest = page.waitForRequest(
        (request) =>
            new URL(request.url()).pathname === "/api/data-sources" &&
            request.method() === "PUT",
    );
    const saveResponse = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === "/api/data-sources" &&
            response.request().method() === "PUT",
    );
    const saveButton = plaudDetail.getByRole("button", {
        name: /保存|保存中/,
    });
    const saveLock = await lockCoreDatabase();
    try {
        await Promise.all([
            saveRequest,
            saveButton.click(),
            expect(saveButton).toBeDisabled({ timeout: 1_000 }),
            expect(saveButton).toHaveAttribute("aria-busy", "true", {
                timeout: 1_000,
            }),
        ]);
        await saveLock.release();
        expect((await saveResponse).status()).toBe(400);
        await expect(
            plaudDetail
                .locator('[data-slot="alert"]')
                .filter({ hasText: "保存失败" }),
        ).toBeVisible();
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expect(testButton).toBeEnabled();
        await expect(saveButton).toBeEnabled();
        await expect(saveButton).toHaveAttribute("aria-busy", "false");
        await expectPlaudDraftToRemain(plaudDetail);
    } finally {
        await saveLock.release();
    }

    const saveFailureApiState = await getSourceFromApi(page, "plaud");
    expect(saveFailureApiState.enabled).toBe(false);
    const persistedState = await readSourceState(userId, "plaud");
    expect(persistedState.enabled).toBe(false);
    expect(persistedState.secretConfig).toBeNull();
    expect(persistedState.config).not.toHaveProperty("customApiBase");
});

test("Data Sources validates missing Plaud sign-in details locally and clears expired state after disconnect", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await setChineseDisplay(page);
    let section = await openDataSources(page);

    await sourceButton(section, /Plaud/).click();
    const plaudDetail = sourceDetail(section, /Plaud/);
    const plaudServer = plaudDetail.getByRole("combobox", {
        name: "站点版本",
    });

    await chooseShadcnSelectOption(page, plaudServer, "自定义");
    await page.locator("#plaud-source-custom-api-base").fill("not-a-url");

    let testRequests = 0;
    page.on("request", (request) => {
        if (
            new URL(request.url()).pathname === "/api/data-sources/test" &&
            request.method() === "POST"
        ) {
            testRequests += 1;
        }
    });
    await plaudDetail.getByRole("button", { name: "测试连接" }).click();
    const incompletePlaudBanner = plaudDetail
        .locator('[data-slot="alert"]')
        .filter({ hasText: "请先补齐登录信息，再测试连接。" });
    await expect(
        incompletePlaudBanner.getByText("信息不完整", { exact: true }),
    ).toBeVisible();
    await expect(incompletePlaudBanner).toContainText(
        "请先补齐登录信息，再测试连接。",
    );
    expect(testRequests).toBe(0);
    expect((await getSourceFromApi(page, "plaud")).enabled).toBe(false);

    const userId = await getE2eUserId();
    await seedSourceConnection(userId, "dingtalk-a1");
    await markDingTalkConnectionExpired(userId);

    const expiredApiState = await getSourceFromApi(page, "dingtalk-a1");
    expect(expiredApiState.connectionStatus).toBe("expired");

    section = await openDataSources(page);
    await sourceButton(section, /钉钉\s*闪记|DingTalk A1 Flash Notes/).click();
    const dingtalkDetail = sourceDetail(
        section,
        /钉钉\s*闪记|DingTalk A1 Flash Notes/,
    );
    await expect(sourceStatus(dingtalkDetail, /需要重新登录|Re-auth required/)).toBeVisible();

    const disconnectResponse = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === "/api/data-sources/disconnect" &&
            response.request().method() === "POST",
    );
    await dingtalkDetail.getByRole("button", { name: "断开连接" }).click();
    expect((await disconnectResponse).status()).toBe(200);
    await expect(sourceStatus(dingtalkDetail, /待设置|Not configured/)).toBeVisible();

    const disconnectedApiState = await getSourceFromApi(page, "dingtalk-a1");
    expect(disconnectedApiState.connectionStatus).toBe("ready");
    expect(disconnectedApiState.enabled).toBe(false);
    expect(disconnectedApiState.secretsConfigured).toMatchObject({
        deviceCredential: false,
    });

    const disconnectedDatabaseState = await readSourceState(userId, "dingtalk-a1");
    expect(disconnectedDatabaseState.enabled).toBe(false);
    expect(disconnectedDatabaseState.secretConfig).toBeNull();
    expect(disconnectedDatabaseState.config).not.toHaveProperty("connectionStatus");

    section = await openDataSources(page);
    await sourceButton(section, /钉钉\s*闪记|DingTalk A1 Flash Notes/).click();
    await expect(
        sourceStatus(
            sourceDetail(section, /钉钉\s*闪记|DingTalk A1 Flash Notes/),
            /待设置|Not configured/,
        ),
    ).toBeVisible();
});

test("Data Sources renders real persisted runtime states for all supported providers", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await setChineseDisplay(page);

    const userId = await getE2eUserId();
    for (const provider of [
        "dingtalk-a1",
        "ticnote",
        "plaud",
        "feishu-minutes",
        "iflyrec",
    ]) {
        await seedSourceConnection(userId, provider);
    }

    let section = await openDataSources(page);

    for (const provider of [
        /钉钉\s*闪记|DingTalk A1 Flash Notes/,
        /TicNote/,
        /Plaud/,
        /飞书妙记|Feishu Minutes/,
        /讯飞听见|iFLYTEK iflyrec/,
    ]) {
        await sourceButton(section, provider).click();
        await expect(
            sourceStatus(sourceDetail(section, provider), /待设置|Not configured/),
        ).toBeVisible();
    }

    await setSourceRuntimeState(userId, "dingtalk-a1", {
        config: { connectionStatus: "expired" },
        syncStatus: "idle",
    });
    await setSourceRuntimeState(userId, "ticnote", {
        syncStatus: "syncing",
    });
    await setSourceRuntimeState(userId, "plaud", {
        lastSyncError: "Source update did not complete.",
        syncStatus: "error",
    });
    await setSourceRuntimeState(userId, "feishu-minutes", {
        lastSyncError: "permission-denied",
        syncStatus: "error",
    });

    section = await openDataSources(page);

    const expectedStates = [
        {
            provider: /钉钉\s*闪记|DingTalk A1 Flash Notes/,
            status: /需要重新登录|Re-auth required/,
        },
        { provider: /TicNote/, status: /同步中|Syncing/ },
        { provider: /Plaud/, status: /同步失败|Sync failed/ },
        {
            provider: /飞书妙记|Feishu Minutes/,
            status: /需要授权|Permission required/,
        },
        {
            provider: /讯飞听见|iFLYTEK iflyrec/,
            status: /待设置|Not configured/,
        },
    ];

    for (const expected of expectedStates) {
        await sourceButton(section, expected.provider).click();
        await expect(
            sourceStatus(sourceDetail(section, expected.provider), expected.status),
        ).toBeVisible();
    }

    const response = await page.request.get("/api/data-sources");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as {
        sources: Array<{
            enabled: boolean;
            provider: string;
            syncStatus: string;
        }>;
    };
    expect(payload.sources).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                enabled: false,
                provider: "dingtalk-a1",
                syncStatus: "idle",
            }),
            expect.objectContaining({
                enabled: false,
                provider: "ticnote",
                syncStatus: "syncing",
            }),
            expect.objectContaining({
                enabled: false,
                provider: "plaud",
                syncStatus: "error",
            }),
            expect.objectContaining({
                enabled: false,
                provider: "feishu-minutes",
                syncStatus: "error",
            }),
            expect.objectContaining({
                enabled: false,
                provider: "iflyrec",
                syncStatus: "idle",
            }),
        ]),
    );
});
