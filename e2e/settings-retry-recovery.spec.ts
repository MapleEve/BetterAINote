import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import { chooseShadcnSelectOption } from "./helpers/shadcn-select";

const TITLE_GENERATION_ENDPOINT = "/api/settings/title-generation";
const TITLE_GENERATION_ROUTE = `**${TITLE_GENERATION_ENDPOINT}`;
const E2E_USER_EMAIL = "playwright-admin@example.com";
const FORCED_LOAD_FAILURE = "E2E title generation settings load failed once";

type TitleGenerationSettingsReadback = {
    autoGenerateTitle: boolean;
    titleGenerationApiKeySet: boolean;
    titleGenerationBaseUrl: string | null;
    titleGenerationModel: string | null;
    titleGenerationPrompt: string | null;
};

type CoreDatabaseLock = {
    release: () => Promise<void>;
};

function resolveCoreDatabasePath() {
    const configuredDatabasePath = process.env.DATABASE_PATH?.trim();
    const configuredE2eRoot = process.env.PLAYWRIGHT_E2E_ROOT?.trim();

    if (!configuredDatabasePath || !configuredE2eRoot) {
        throw new Error(
            "settings retry E2E requires DATABASE_PATH and PLAYWRIGHT_E2E_ROOT",
        );
    }

    const databasePath = path.resolve(configuredDatabasePath);
    const e2eRoot = path.resolve(configuredE2eRoot);
    if (!databasePath.startsWith(`${e2eRoot}${path.sep}`)) {
        throw new Error(
            `Refusing to access non-isolated SQLite database: ${databasePath}`,
        );
    }

    return databasePath;
}

function coreDatabaseUrl() {
    return pathToFileURL(resolveCoreDatabasePath()).href;
}

async function withCoreDatabase<T>(
    callback: (client: ReturnType<typeof createClient>) => Promise<T>,
) {
    const client = createClient({ url: coreDatabaseUrl() });
    try {
        return await callback(client);
    } finally {
        client.close();
    }
}

async function lockCoreDatabase(): Promise<CoreDatabaseLock> {
    const client = createClient({ url: coreDatabaseUrl() });
    let released = false;

    try {
        await client.execute("PRAGMA busy_timeout = 5000");
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

function settingsDialog(page: Page) {
    return page.getByRole("dialog", { name: /^(设置|Settings)$/ });
}

function titleGenerationSection(page: Page) {
    return page.getByRole("region", {
        name: /^(AI 重命名服务|AI Rename Service)$/,
    });
}

function titleGenerationGroup(page: Page) {
    return titleGenerationSection(page).getByRole("region", {
        name: /^(标题生成服务|Title Generation Service)$/,
    });
}

function titleSaveButton(page: Page) {
    return titleGenerationGroup(page).getByRole("button", {
        name: /^(保存|保存中|已保存|Save|Saving|Saved)$/,
    });
}

function voscriptSection(page: Page) {
    return page.getByRole("region", {
        name: /^(VoScript 服务|VoScript Service)$/,
    });
}

function voscriptRuntimeGroup(page: Page) {
    return voscriptSection(page).getByRole("region", {
        name: /^(转录运行参数|Transcription Runtime Parameters)$/,
    });
}

function voscriptRuntimeSaveButton(page: Page) {
    return voscriptRuntimeGroup(page).getByRole("button", {
        name: /^(保存转录运行参数|转录运行参数保存中|转录运行参数已保存|Save transcription runtime parameters|Saving transcription runtime parameters|transcription runtime parameters saved)$/i,
    });
}

function isTitleGenerationSettingsReadback(
    payload: unknown,
): payload is TitleGenerationSettingsReadback {
    if (typeof payload !== "object" || payload === null) {
        return false;
    }

    const settings = payload as Record<string, unknown>;
    return (
        typeof settings.autoGenerateTitle === "boolean" &&
        typeof settings.titleGenerationApiKeySet === "boolean" &&
        (typeof settings.titleGenerationBaseUrl === "string" ||
            settings.titleGenerationBaseUrl === null) &&
        (typeof settings.titleGenerationModel === "string" ||
            settings.titleGenerationModel === null) &&
        (typeof settings.titleGenerationPrompt === "string" ||
            settings.titleGenerationPrompt === null)
    );
}

async function readTitleGenerationSettings(page: Page) {
    const response = await page.request.get(TITLE_GENERATION_ENDPOINT);
    expect(response.status()).toBe(200);

    const payload: unknown = await response.json();
    if (!isTitleGenerationSettingsReadback(payload)) {
        throw new Error(
            "Title generation settings API returned an invalid payload.",
        );
    }

    return payload;
}

async function readTitleGenerationModelFromSqlite() {
    return withCoreDatabase(async (client) => {
        const result = await client.execute({
            sql: `SELECT user_settings.title_generation_model AS model
                  FROM user_settings
                  INNER JOIN users ON users.id = user_settings.user_id
                  WHERE users.email = ?
                  LIMIT 1`,
            args: [E2E_USER_EMAIL],
        });
        const model = result.rows[0]?.model;

        if (model !== null && typeof model !== "string") {
            throw new Error(
                "SQLite returned an invalid title generation model value.",
            );
        }

        return model ?? null;
    });
}

async function restoreTitleGenerationSettings(
    page: Page,
    settings: TitleGenerationSettingsReadback,
) {
    const response = await page.request.put(TITLE_GENERATION_ENDPOINT, {
        data: {
            autoGenerateTitle: settings.autoGenerateTitle,
            titleGenerationBaseUrl: settings.titleGenerationBaseUrl,
            titleGenerationModel: settings.titleGenerationModel,
            titleGenerationPrompt: settings.titleGenerationPrompt,
        },
    });
    expect(response.status()).toBe(200);
}

function dataSourcesSection(page: Page) {
    return settingsDialog(page)
        .getByRole("complementary", {
            name: /^(数据源列表|Data source list)$/,
        })
        .locator("..");
}

function sourceDetail(section: Locator, name: RegExp) {
    return section.getByRole("region", { name });
}

test("title generation load retry reaches the real settings API", async ({
    page,
}) => {
    await ensureSignedIn(page);
    const baseline = await readTitleGenerationSettings(page);
    let releaseFailedLoad: (() => void) | null = null;
    const failedLoadGate = new Promise<void>((resolve) => {
        releaseFailedLoad = resolve;
    });
    let getCount = 0;

    try {
        await page.goto("/settings#appearance", {
            waitUntil: "domcontentloaded",
        });
        const dialog = settingsDialog(page);
        await expect(dialog).toBeVisible();

        await page.route(TITLE_GENERATION_ROUTE, async (route) => {
            if (route.request().method() !== "GET") {
                await route.continue();
                return;
            }

            getCount += 1;
            if (getCount === 1) {
                await failedLoadGate;
                await route.fulfill({
                    body: JSON.stringify({ error: FORCED_LOAD_FAILURE }),
                    contentType: "application/json",
                    status: 503,
                });
                return;
            }

            await route.continue();
        });

        await dialog
            .getByRole("button", {
                name: /^(AI 重命名服务|AI Rename Service)$/,
            })
            .click();
        await expect(
            page.getByRole("status", {
                name: /^(正在加载设置|Loading settings)$/,
            }),
        ).toBeVisible();

        releaseFailedLoad?.();
        const loadAlert = dialog
            .getByRole("alert")
            .filter({ hasText: /^(加载失败|Load failed)/ });
        await expect(loadAlert).toContainText(FORCED_LOAD_FAILURE);
        const retryButton = loadAlert.getByRole("button", {
            name: /^(重试|Retry)$/,
        });
        await expect(retryButton).toBeEnabled();

        const recoveredLoadResponse = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname ===
                    TITLE_GENERATION_ENDPOINT &&
                response.request().method() === "GET" &&
                response.status() === 200,
        );
        await retryButton.click();
        const retryPayload: unknown =
            await (await recoveredLoadResponse).json();
        if (!isTitleGenerationSettingsReadback(retryPayload)) {
            throw new Error(
                "Retry did not return title generation settings.",
            );
        }

        expect(getCount).toBe(2);
        expect(retryPayload).toEqual(baseline);
        await expect(titleGenerationSection(page)).toHaveAttribute(
            "aria-busy",
            "false",
        );
        await expect(titleGenerationGroup(page)).toBeVisible();
        await expect(loadAlert).toHaveCount(0);
    } finally {
        releaseFailedLoad?.();
        await page.unroute(TITLE_GENERATION_ROUTE);
    }
});

test("title save failure preserves the draft before API and SQLite readback", async ({
    page,
}) => {
    await ensureSignedIn(page);
    const baseline = await readTitleGenerationSettings(page);
    const targetModel =
        baseline.titleGenerationModel === "e2e-retry-model"
            ? "e2e-retry-model-alt"
            : "e2e-retry-model";
    let activeLock: CoreDatabaseLock | null = null;

    try {
        await page.goto("/settings#title-generation", {
            waitUntil: "domcontentloaded",
        });
        await expect(titleGenerationSection(page)).toHaveAttribute(
            "aria-busy",
            "false",
        );
        await expect(titleGenerationGroup(page)).toBeVisible();

        const modelInput = titleGenerationGroup(page).getByRole("textbox", {
            name: /^(重命名模型|Rename model)$/,
        });
        await modelInput.fill(targetModel);

        activeLock = await lockCoreDatabase();
        const failedSaveResponse = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname ===
                    TITLE_GENERATION_ENDPOINT &&
                response.request().method() === "PUT",
        );
        await titleSaveButton(page).click();
        expect((await failedSaveResponse).status()).toBe(500);

        const saveAlert = titleGenerationGroup(page)
            .getByRole("alert")
            .filter({
                hasText:
                    /Failed to update title generation settings|保存失败|Save failed/,
            });
        await expect(saveAlert).toBeVisible();
        await expect(modelInput).toHaveValue(targetModel);

        await activeLock.release();
        activeLock = null;

        const recoveredSaveResponse = page.waitForResponse(
            (response) =>
                new URL(response.url()).pathname ===
                    TITLE_GENERATION_ENDPOINT &&
                response.request().method() === "PUT",
        );
        await titleSaveButton(page).click();
        expect((await recoveredSaveResponse).status()).toBe(200);
        await expect(titleSaveButton(page)).toHaveAccessibleName(
            /^(已保存|Saved)$/,
        );

        expect((await readTitleGenerationSettings(page)).titleGenerationModel).toBe(
            targetModel,
        );
        expect(await readTitleGenerationModelFromSqlite()).toBe(targetModel);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(titleGenerationSection(page)).toHaveAttribute(
            "aria-busy",
            "false",
        );
        await expect(
            titleGenerationGroup(page).getByRole("textbox", {
                name: /^(重命名模型|Rename model)$/,
            }),
        ).toHaveValue(targetModel);
    } finally {
        await activeLock?.release();
        await restoreTitleGenerationSettings(page, baseline);
        expect((await readTitleGenerationSettings(page)).titleGenerationModel).toBe(
            baseline.titleGenerationModel,
        );
        expect(await readTitleGenerationModelFromSqlite()).toBe(
            baseline.titleGenerationModel,
        );
    }
});

test("Data Source and VoScript validation stay local and do not call providers", async ({
    page,
}) => {
    await ensureSignedIn(page);

    let dataSourceTestRequests = 0;
    let voscriptSettingsPutRequests = 0;
    let voscriptProviderTestRequests = 0;
    page.on("request", (request) => {
        const pathname = new URL(request.url()).pathname;
        if (
            pathname === "/api/data-sources/test" &&
            request.method() === "POST"
        ) {
            dataSourceTestRequests += 1;
        }
        if (
            pathname === "/api/settings/voscript" &&
            request.method() === "PUT"
        ) {
            voscriptSettingsPutRequests += 1;
        }
        if (
            pathname === "/api/settings/voscript/test" &&
            request.method() === "POST"
        ) {
            voscriptProviderTestRequests += 1;
        }
    });

    await page.goto("/settings#data-sources", {
        waitUntil: "domcontentloaded",
    });
    await expect(settingsDialog(page)).toBeVisible();
    const sources = dataSourcesSection(page);
    await expect(sources).toHaveAttribute("aria-busy", "false");
    await sources.getByRole("button", { name: /Plaud/ }).click();

    const plaudDetail = sourceDetail(sources, /Plaud/);
    const siteVersion = plaudDetail.getByRole("combobox", {
        name: /^(站点版本|Site edition)$/,
    });
    const customOption =
        (await siteVersion.getAttribute("aria-label")) === "站点版本"
            ? "自定义"
            : "Custom";
    await chooseShadcnSelectOption(page, siteVersion, customOption);
    await plaudDetail
        .getByRole("textbox", {
            name: /^(自定义服务地址|Custom service address)$/,
        })
        .fill("not-a-url");
    await plaudDetail
        .getByRole("button", { name: /^(测试连接|Test connection)$/ })
        .click();

    const incompleteSourceAlert = plaudDetail
        .getByRole("alert")
        .filter({
            hasText:
                /请先补齐登录信息，再测试连接。|Complete the sign-in details before testing the connection./,
        });
    await expect(incompleteSourceAlert).toBeVisible();
    expect(dataSourceTestRequests).toBe(0);

    await page.goto("/settings#voscript", {
        waitUntil: "domcontentloaded",
    });
    await expect(voscriptSection(page)).toHaveAttribute("aria-busy", "false");
    const noRepeatNgram = voscriptRuntimeGroup(page).getByRole("spinbutton", {
        name: /^(重复抑制 n-gram|No-repeat n-gram)$/,
    });
    await noRepeatNgram.fill("1");
    await expect(noRepeatNgram).toHaveAttribute("aria-invalid", "true");
    await voscriptRuntimeSaveButton(page).click();

    await expect(
        voscriptRuntimeGroup(page)
            .getByRole("group", {
                name: /^(转录运行参数操作|transcription runtime parameters actions)$/i,
            })
            .getByRole("alert")
            .filter({ hasText: "只支持 0 或 ≥ 3" }),
    ).toBeVisible();
    expect(voscriptSettingsPutRequests).toBe(0);
    expect(voscriptProviderTestRequests).toBe(0);
});
