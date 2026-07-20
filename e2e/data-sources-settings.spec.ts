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

test("Data Sources persists disabled state, renders a real test error, and clears expired state after disconnect", async ({
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
    await page.locator("#plaud-source-secret").fill("e2e-test-credential");
    await page.locator("#plaud-source-custom-api-base").fill("not-a-url");

    const testResponse = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === "/api/data-sources/test" &&
            response.request().method() === "POST",
    );
    await plaudDetail.getByRole("button", { name: "测试连接" }).click();
    expect((await testResponse).status()).toBe(400);
    await expect(
        plaudDetail
            .locator('[data-slot="alert"]')
            .filter({ hasText: "连接测试失败" }),
    ).toBeVisible();
    expect((await getSourceFromApi(page, "plaud")).enabled).toBe(false);

    await sourceButton(section, /讯飞听见|iFLYTEK iflyrec/).click();
    const iflyrecDetail = sourceDetail(section, /讯飞听见|iFLYTEK iflyrec/);
    await page.locator("#iflyrec-source-secret").fill("e2e-session-id");

    const saveResponse = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === "/api/data-sources" &&
            response.request().method() === "PUT",
    );
    await iflyrecDetail.getByRole("button", { name: "保存" }).click();
    expect((await saveResponse).status()).toBe(200);
    await expect(sourceStatus(iflyrecDetail, /同步已暂停/)).toBeVisible();

    const iflyrecApiState = await getSourceFromApi(page, "iflyrec");
    expect(iflyrecApiState.enabled).toBe(false);
    expect(iflyrecApiState.secretsConfigured).toMatchObject({ sessionId: true });

    const userId = await getE2eUserId();
    const persistedIflyrec = await readSourceState(userId, "iflyrec");
    expect(persistedIflyrec.enabled).toBe(false);
    expect(persistedIflyrec.secretConfig).not.toBeNull();

    const seedResponse = await page.request.put("/api/data-sources", {
        data: {
            authMode: "device-signin",
            baseUrl: "https://meeting-ai-tingji.dingtalk.com",
            config: { syncTitleToSource: false },
            enabled: false,
            provider: "dingtalk-a1",
            secrets: { deviceCredential: "e2e-device-credential" },
        },
    });
    expect(seedResponse.ok()).toBe(true);
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
    await sourceButton(section, /讯飞听见|iFLYTEK iflyrec/).click();
    await expect(
        sourceStatus(
            sourceDetail(section, /讯飞听见|iFLYTEK iflyrec/),
            /同步已暂停|Paused/,
        ),
    ).toBeVisible();

    await sourceButton(section, /钉钉\s*闪记|DingTalk A1 Flash Notes/).click();
    await expect(
        sourceStatus(
            sourceDetail(section, /钉钉\s*闪记|DingTalk A1 Flash Notes/),
            /待设置|Not configured/,
        ),
    ).toBeVisible();
});
