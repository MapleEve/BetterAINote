import path from "node:path";
import { createCipheriv, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import { chooseShadcnSelectOption } from "./helpers/shadcn-select";

const E2E_EMAIL = "playwright-admin@example.com";
const E2E_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const E2E_DINGTALK_CREDENTIAL = "settings-responsive-dingtalk-credential";
const DINGTALK_PROVIDER = "dingtalk-a1";
const DINGTALK_BASE_URL = "https://meeting-ai-tingji.dingtalk.com";
const SECTION_LABELS = [
    "转录设置",
    "AI 重命名服务",
    "VoScript 服务",
    "数据源",
    "显示设置",
    "杂项",
] as const;

const FRAMES = [
    { height: 844, mode: "mobile", width: 390 },
    { height: 1024, mode: "tablet", width: 768 },
    { height: 900, mode: "desktop", width: 1440 },
] as const;

function resolveDatabasePath() {
    const databasePath = process.env.DATABASE_PATH?.trim();
    const e2eRoot = process.env.PLAYWRIGHT_E2E_ROOT?.trim();
    if (!databasePath || !e2eRoot) {
        throw new Error(
            "Responsive settings E2E requires DATABASE_PATH and PLAYWRIGHT_E2E_ROOT.",
        );
    }

    const resolvedDatabasePath = path.resolve(databasePath);
    const resolvedE2eRoot = path.resolve(e2eRoot);
    if (!resolvedDatabasePath.startsWith(`${resolvedE2eRoot}${path.sep}`)) {
        throw new Error(
            `Refusing to access non-isolated SQLite database: ${resolvedDatabasePath}`,
        );
    }

    return resolvedDatabasePath;
}

async function withDatabase<T>(
    callback: (client: ReturnType<typeof createClient>) => Promise<T>,
) {
    const client = createClient({
        url: pathToFileURL(resolveDatabasePath()).href,
    });
    try {
        return await callback(client);
    } finally {
        await client.close();
    }
}

function encryptWithE2EKey(plaintext: string) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(
        "aes-256-gcm",
        Buffer.from(
            process.env.ENCRYPTION_KEY || E2E_ENCRYPTION_KEY,
            "hex",
        ),
        iv,
    );
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);

    return [
        iv.toString("hex"),
        cipher.getAuthTag().toString("hex"),
        encrypted.toString("hex"),
    ].join(":");
}

async function getUserId() {
    return withDatabase(async (client) => {
        const result = await client.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: [E2E_EMAIL],
        });
        const userId = result.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Playwright user was not created.");
        }
        return userId;
    });
}

async function readThemeFromSqlite() {
    return withDatabase(async (client) => {
        const result = await client.execute({
            sql: `SELECT user_settings.theme AS theme
                  FROM user_settings
                  INNER JOIN users ON users.id = user_settings.user_id
                  WHERE users.email = ?
                  LIMIT 1`,
            args: [E2E_EMAIL],
        });
        const theme = result.rows[0]?.theme;
        if (typeof theme !== "string") {
            throw new Error("SQLite did not return the display theme.");
        }
        return theme;
    });
}

async function seedDisabledDingTalk(userId: string) {
    await withDatabase(async (client) => {
        const now = Date.now();
        await client.execute({
            sql: `INSERT INTO source_connections (
                    id, user_id, provider, enabled, auth_mode, base_url, config,
                    secret_config, sync_status, last_sync_error,
                    last_sync_started_at, last_sync_finished_at, created_at, updated_at
                ) VALUES (?, ?, ?, 0, 'device-signin', ?, ?, ?, 'idle', NULL, NULL, NULL, ?, ?)
                ON CONFLICT(user_id, provider) DO UPDATE SET
                    enabled = 0,
                    auth_mode = excluded.auth_mode,
                    base_url = excluded.base_url,
                    config = excluded.config,
                    secret_config = excluded.secret_config,
                    sync_status = 'idle',
                    last_sync_error = NULL,
                    last_sync_started_at = NULL,
                    last_sync_finished_at = NULL,
                    updated_at = excluded.updated_at`,
            args: [
                `settings-responsive-${now}`,
                userId,
                DINGTALK_PROVIDER,
                DINGTALK_BASE_URL,
                JSON.stringify({ syncTitleToSource: false }),
                encryptWithE2EKey(
                    JSON.stringify({
                        deviceCredential: E2E_DINGTALK_CREDENTIAL,
                    }),
                ),
                now,
                now,
            ],
        });
    });
}

async function readDingTalkEnabledFromSqlite(userId: string) {
    return withDatabase(async (client) => {
        const result = await client.execute({
            sql: `SELECT enabled
                  FROM source_connections
                  WHERE user_id = ? AND provider = ?
                  LIMIT 1`,
            args: [userId, DINGTALK_PROVIDER],
        });
        return Number(result.rows[0]?.enabled) === 1;
    });
}

async function setDisplayTheme(page: Page, theme: "light" | "dark") {
    const response = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme,
            uiLanguage: "zh-CN",
        },
    });
    expect(response.ok()).toBe(true);

    const readback = await page.request.get("/api/settings/display");
    expect(readback.ok()).toBe(true);
    expect(await readback.json()).toMatchObject({ theme, uiLanguage: "zh-CN" });
    expect(await readThemeFromSqlite()).toBe(theme);
    await page.goto("about:blank");
}

function settingsDialog(page: Page) {
    return page.getByRole("dialog", { name: "设置", exact: true });
}

function settingsSelector(page: Page) {
    return settingsDialog(page).getByRole("combobox", {
        name: "设置",
        exact: true,
    });
}

function providerSelector(page: Page) {
    return settingsDialog(page).getByRole("combobox", {
        name: "选择数据源",
        exact: true,
    });
}

function dataSourceList(page: Page) {
    return settingsDialog(page).getByRole("complementary", {
        name: "数据源列表",
        exact: true,
    });
}

function dingTalkDetail(page: Page) {
    return settingsDialog(page).getByRole("region", {
        name: "钉钉 闪记",
        exact: true,
    });
}

async function expectInsideViewport(
    locator: Locator,
    viewport: { height: number; width: number },
) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectNoHorizontalOverflow(page: Page) {
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    document.documentElement.scrollWidth <= window.innerWidth,
            ),
        )
        .toBe(true);
}

async function openSettings(
    page: Page,
    viewport: { height: number; width: number },
    section = "transcription",
) {
    await page.setViewportSize(viewport);
    await page.goto(`/settings#${section}`, {
        waitUntil: "domcontentloaded",
    });
    const dialog = settingsDialog(page);
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(250);
    await expectInsideViewport(dialog, viewport);
    await expectNoHorizontalOverflow(page);
    return dialog;
}

async function expectCompactSectionsWork(page: Page) {
    const selector = settingsSelector(page);
    await expect(selector).toBeVisible();
    await expect(selector).toBeFocused();

    await selector.click();
    const options = page.getByRole("option");
    await expect(options).toHaveCount(SECTION_LABELS.length);
    for (const label of SECTION_LABELS) {
        await expect(
            page.getByRole("option", { name: label, exact: true }),
        ).toBeVisible();
    }
    await page.keyboard.press("Escape");

    for (const label of SECTION_LABELS) {
        await chooseShadcnSelectOption(page, selector, label);
        await expect(selector).toContainText(label);
        await expectNoHorizontalOverflow(page);
    }
}

async function expectDesktopSectionsWork(page: Page) {
    const dialog = settingsDialog(page);
    await expect(settingsSelector(page)).toBeHidden();
    const nav = dialog.getByRole("navigation", {
        name: "设置",
        exact: true,
    });
    const buttons = nav.getByRole("button");
    await expect(buttons).toHaveCount(SECTION_LABELS.length);
    await expect(buttons.first()).toHaveAttribute("tabindex", "0");
    await buttons.first().focus();
    await expect(buttons.first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(buttons.nth(1)).toBeFocused();

    for (const label of SECTION_LABELS) {
        const button = nav.getByRole("button", { name: label, exact: true });
        await button.click();
        await expect(button).toHaveAttribute("aria-current", "page");
        await expectNoHorizontalOverflow(page);
    }
}

test("settings responsive shell keeps six sections, focus, themes, and SOT pane geometry", async ({
    page,
}, testInfo) => {
    await ensureSignedIn(page);

    for (const theme of ["light", "dark"] as const) {
        await setDisplayTheme(page, theme);

        for (const frame of FRAMES) {
            await test.step(`${theme} ${frame.mode}`, async () => {
                const dialog = await openSettings(page, frame);
                await expect(page.locator("html")).toHaveAttribute(
                    "data-theme",
                    theme,
                );

                if (frame.width < 900) {
                    await expectCompactSectionsWork(page);
                } else {
                    await expectDesktopSectionsWork(page);
                }

                await page.goto("/settings#data-sources", {
                    waitUntil: "domcontentloaded",
                });
                await expect(dialog).toBeVisible();

                if (frame.width < 640) {
                    await expect(providerSelector(page)).toBeVisible();
                    await expect(dataSourceList(page)).toBeHidden();
                    const box = await dialog.boundingBox();
                    expect(box?.x).toBeCloseTo(0, 0);
                    expect(box?.y).toBeCloseTo(0, 0);
                    expect(box?.width).toBeCloseTo(frame.width, 0);
                    expect(box?.height).toBeCloseTo(frame.height, 0);
                } else {
                    const list = dataSourceList(page);
                    await expect(list).toBeVisible();
                    await expect(providerSelector(page)).toBeHidden();
                    const listBox = await list.boundingBox();
                    expect(listBox?.width).toBeCloseTo(
                        frame.width < 900 ? 220 : 280,
                        0,
                    );
                    const detailBox = await dingTalkDetail(page).boundingBox();
                    expect(listBox).not.toBeNull();
                    expect(detailBox).not.toBeNull();
                    if (listBox && detailBox) {
                        expect(listBox.x + listBox.width).toBeLessThanOrEqual(
                            detailBox.x + 1,
                        );
                    }
                }

                await expectInsideViewport(dialog, frame);
                await expectNoHorizontalOverflow(page);
                const screenshot = await page.screenshot();
                await testInfo.attach(
                    `settings-${theme}-${frame.mode}.png`,
                    {
                        body: screenshot,
                        contentType: "image/png",
                    },
                );
            });
        }
    }
});

test("mobile Data Sources save holds busy state and persists through API, SQLite, and reload", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await setDisplayTheme(page, "light");
    const userId = await getUserId();
    await seedDisabledDingTalk(userId);
    expect(await readDingTalkEnabledFromSqlite(userId)).toBe(false);

    await openSettings(page, FRAMES[0], "data-sources");
    const provider = providerSelector(page);
    await expect(provider).toBeVisible();
    await chooseShadcnSelectOption(page, provider, "钉钉 闪记");

    const detail = dingTalkDetail(page);
    await expect(detail).toHaveAttribute("aria-busy", "false");
    const enableSync = detail.getByRole("switch", {
        name: "启用同步",
        exact: true,
    });
    const save = detail.getByRole("button", {
        name: "保存",
        exact: true,
    });
    await expect(enableSync).toHaveAttribute("aria-checked", "false");
    await enableSync.click();
    await expect(enableSync).toHaveAttribute("aria-checked", "true");

    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
        releaseResponse = resolve;
    });
    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() !== "PUT") {
            await route.continue();
            return;
        }
        const response = await route.fetch();
        await responseGate;
        await route.fulfill({ response });
    });

    const saveResponse = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === "/api/data-sources" &&
            response.request().method() === "PUT",
    );
    await save.click();
    await expect(detail).toHaveAttribute("aria-busy", "true");
    await expect(enableSync).toBeDisabled();
    await expect(
        detail.getByRole("button", { name: "保存中", exact: true }),
    ).toBeDisabled();

    releaseResponse();
    const response = await saveResponse;
    expect(response.status()).toBe(200);
    await page.unroute("**/api/data-sources");

    const apiResponse = await page.request.get("/api/data-sources");
    expect(apiResponse.ok()).toBe(true);
    const payload = (await apiResponse.json()) as {
        sources: Array<{ enabled?: boolean; provider?: string }>;
    };
    expect(
        payload.sources.find(
            (source) => source.provider === DINGTALK_PROVIDER,
        )?.enabled,
    ).toBe(true);
    expect(await readDingTalkEnabledFromSqlite(userId)).toBe(true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(providerSelector(page)).toBeVisible();
    await chooseShadcnSelectOption(page, providerSelector(page), "钉钉 闪记");
    await expect(
        dingTalkDetail(page).getByRole("switch", {
            name: "启用同步",
            exact: true,
        }),
    ).toHaveAttribute("aria-checked", "true");
    await expectNoHorizontalOverflow(page);
});
