import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    SOT_COMPONENT_LIBRARY_URL,
    SOT_SOURCE_ASSET_DIR,
    SOT_WORKSTATION_URL as SOT_WEB_INDEX_URL,
} from "./helpers/sot-fixtures";

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
const SETTINGS_RAIL_STYLE_PROPS = [
    "display",
    "flex-direction",
    "gap",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-right-width",
    "border-right-style",
    "border-right-color",
    "background-color",
    "overflow-y",
    "min-height",
] as const;
const SETTINGS_RAIL_ITEM_STYLE_PROPS = [
    "display",
    "align-items",
    "gap",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-radius",
    "background-color",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "text-align",
    "cursor",
    "box-shadow",
] as const;
const PROVIDER_CARD_STYLE_PROPS = [
    "display",
    "align-items",
    "gap",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-radius",
    "background-color",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "text-align",
    "cursor",
    "box-shadow",
    "opacity",
] as const;
const PROVIDER_STATUS_STYLE_PROPS = [
    "display",
    "align-items",
    "gap",
    "height",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-radius",
    "background-color",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "color",
    "font-family",
    "font-size",
    "font-weight",
] as const;
const DETAIL_STYLE_PROPS = [
    "overflow-y",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "min-height",
] as const;
const DETAIL_ROW_STYLE_PROPS = [
    "display",
    "gap",
    "align-items",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-bottom-width",
    "border-bottom-style",
    "border-bottom-color",
] as const;
const DETAIL_ROW_CONTROL_STYLE_PROPS = [
    "display",
    "align-items",
    "gap",
    "flex",
] as const;
const DETAIL_INPUT_STYLE_PROPS = [
    "height",
    "min-width",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-radius",
    "background-color",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "color",
    "font-family",
    "font-size",
    "font-weight",
] as const;
const SWITCH_STYLE_PROPS = [
    "position",
    "width",
    "height",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-radius",
    "background-color",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "cursor",
] as const;
const SWITCH_KNOB_STYLE_PROPS = [
    "position",
    "left",
    "top",
    "width",
    "height",
    "border-radius",
    "background-color",
    "box-shadow",
    "transform",
] as const;

type StyleProp =
    | (typeof SETTINGS_RAIL_STYLE_PROPS)[number]
    | (typeof SETTINGS_RAIL_ITEM_STYLE_PROPS)[number]
    | (typeof PROVIDER_CARD_STYLE_PROPS)[number]
    | (typeof PROVIDER_STATUS_STYLE_PROPS)[number]
    | (typeof DETAIL_STYLE_PROPS)[number]
    | (typeof DETAIL_ROW_STYLE_PROPS)[number]
    | (typeof DETAIL_ROW_CONTROL_STYLE_PROPS)[number]
    | (typeof DETAIL_INPUT_STYLE_PROPS)[number]
    | (typeof SWITCH_STYLE_PROPS)[number]
    | (typeof SWITCH_KNOB_STYLE_PROPS)[number];

interface SotPixelDiff {
    differingPixels: number;
    dimensionsMatch: boolean;
    expectedHeight: number;
    expectedWidth: number;
    maxChannelDelta: number;
    productHeight: number;
    productWidth: number;
}

interface SotPixelTolerance {
    differingPixels: number;
    maxChannelDelta: number;
}

type SotPixelTolerancesByFrame = Partial<Record<string, SotPixelTolerance>>;

type SotPixelFrame = {
    name: string;
    stage: {
        height: number;
        width: number;
    };
    viewport: {
        height: number;
        width: number;
    };
};

const DATA_SOURCE_DETAIL_PIXEL_FRAMES = [
    {
        name: "desktop",
        stage: { height: 820, width: 580 },
        viewport: { height: 900, width: 1366 },
    },
    {
        name: "mobile",
        stage: { height: 844, width: 390 },
        viewport: { height: 844, width: 390 },
    },
] as const satisfies readonly SotPixelFrame[];
const ZERO_SOT_PIXEL_TOLERANCE = {
    differingPixels: 0,
    maxChannelDelta: 0,
} as const satisfies SotPixelTolerance;
// Base TicNote detail can rasterize the status pill with 7 max-delta-1 pixels
// while dimensions and computed styles still match; framed captures stay exact.
const TICNOTE_PROVIDER_DETAIL_PIXEL_TOLERANCES = {
    default: {
        differingPixels: 7,
        maxChannelDelta: 1,
    },
} as const satisfies SotPixelTolerancesByFrame;
// The dark settings rail can rasterize a few text/icon edge pixels differently
// between identical SOT/product fixture captures while dimensions and computed
// metrics stay equal.
const SETTINGS_RAIL_PIXEL_TOLERANCES = {
    default: {
        differingPixels: 24,
        maxChannelDelta: 12,
    },
} as const satisfies SotPixelTolerancesByFrame;
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
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const section = page.locator(
        '[data-sot-surface="settings-data-sources"]',
    );
    await expect(section).toBeVisible();
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

async function openSotComponentLibrary(page: Page) {
    await page.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.dataset.theme = "dark";
    });
    await expect(page.locator("#srail .settings-rail")).toBeVisible();
    await expect(page.locator("#pcard .sp-card.active")).toBeVisible();
    await expect(page.locator("#pdetail .sm-detail").first()).toBeVisible();
}

async function openSotDataSourcesIndex(page: Page) {
    await page.goto(SOT_WEB_INDEX_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.dataset.theme = "dark";
        window.dispatchEvent(new CustomEvent("settings:open"));
        document.getElementById("avatar-btn")?.click();
        document.querySelector<HTMLElement>('.sr-item[data-section="data-sources"]')
            ?.click();
        (
            window as Window & {
                __setDsProvider?: (provider: string) => void;
            }
        ).__setDsProvider?.("dingtalk-a1");
    });
    await expect(page.locator("#ds-providers .sp-card")).toHaveCount(5);
    await expect(page.locator("#ds-detail .sd-head")).toBeVisible();
}

async function selectSotDataSourceProvider(page: Page, provider: string) {
    await page.evaluate((providerId) => {
        (
            window as Window & {
                __setDsProvider?: (provider: string) => void;
            }
        ).__setDsProvider?.(providerId);
    }, provider);
    await expect(page.locator(`#ds-providers .sp-card[data-provider="${provider}"]`))
        .toHaveClass(/active/);
    await expect(page.locator("#ds-detail .sd-head")).toBeVisible();
}

async function readSotSourceAssetDataUrls() {
    const files = [
        { file: "dingtalk.svg", mime: "image/svg+xml" },
        { file: "feishu.jpeg", mime: "image/jpeg" },
        { file: "plaud.png", mime: "image/png" },
        { file: "ticnote.png", mime: "image/png" },
    ] as const;
    const entries = await Promise.all(
        files.map(async ({ file, mime }) => {
            const data = await readFile(path.join(SOT_SOURCE_ASSET_DIR, file));
            const dataUrl = `data:${mime};base64,${data.toString("base64")}`;
            return [
                [`../../assets/sources/${file}`, dataUrl],
                [`/assets/sources/${file}`, dataUrl],
            ] as const;
        }),
    );

    return Object.fromEntries(entries.flat()) as Record<string, string>;
}

async function readSotFragment(locator: Locator) {
    return locator.first().evaluate((element) => {
        const clone = element.cloneNode(true) as Element;
        const sourceFields = element.querySelectorAll("input, textarea, select");
        const cloneFields = clone.querySelectorAll("input, textarea, select");

        sourceFields.forEach((source, index) => {
            const target = cloneFields[index];
            if (!target) return;

            if (source instanceof HTMLInputElement) {
                const input = target as HTMLInputElement;
                input.setAttribute("value", source.value);
                if (source.checked) {
                    input.setAttribute("checked", "");
                } else {
                    input.removeAttribute("checked");
                }
                return;
            }

            if (source instanceof HTMLTextAreaElement) {
                target.textContent = source.value;
                return;
            }

            if (source instanceof HTMLSelectElement) {
                const sourceOptions = source.querySelectorAll("option");
                const targetOptions = target.querySelectorAll("option");
                sourceOptions.forEach((option, optionIndex) => {
                    const targetOption = targetOptions[optionIndex];
                    if (!targetOption) return;
                    if (option.selected) {
                        targetOption.setAttribute("selected", "");
                    } else {
                        targetOption.removeAttribute("selected");
                    }
                });
            }
        });

        const rect = element.getBoundingClientRect();
        return {
            height: Math.ceil(rect.height),
            html: clone.outerHTML,
            width: Math.ceil(rect.width),
        };
    });
}

async function waitForSotFixtureImages(page: Page, fixtureId: string) {
    await page.locator(`#${fixtureId} img`).evaluateAll((images) =>
        Promise.all(
            images.map(
                (image) =>
                    new Promise<void>((resolve, reject) => {
                        if (!(image instanceof HTMLImageElement)) {
                            resolve();
                            return;
                        }
                        if (image.complete) {
                            if (image.naturalWidth > 0) {
                                resolve();
                                return;
                            }
                            reject(
                                new Error(
                                    `Failed to load SOT fixture image ${
                                        image.getAttribute("src") ?? ""
                                    }`,
                                ),
                            );
                            return;
                        }
                        const timeout = window.setTimeout(() => {
                            reject(
                                new Error(
                                    `Timed out loading SOT fixture image ${
                                        image.getAttribute("src") ?? ""
                                    }`,
                                ),
                            );
                        }, 3000);
                        image.addEventListener(
                            "load",
                            () => {
                                window.clearTimeout(timeout);
                                resolve();
                            },
                            { once: true },
                        );
                        image.addEventListener(
                            "error",
                            () => {
                                window.clearTimeout(timeout);
                                reject(
                                    new Error(
                                        `Failed to load SOT fixture image ${
                                            image.getAttribute("src") ?? ""
                                        }`,
                                    ),
                                );
                            },
                            { once: true },
                        );
                    }),
            ),
        ),
    );
}

async function captureSotFragmentFixture(
    page: Page,
    fragment: { height: number; html: string; width: number },
    sourceAssetDataUrls: Record<string, string>,
    frame?: SotPixelFrame,
) {
    const fixtureId = `data-sources-sot-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    if (frame) {
        await page.setViewportSize(frame.viewport);
    }
    await page.mouse.move(0, 0);
    await page.evaluate(
        ({ fixture, fixtureFrame, fixtureId: id, sourceAssets }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = fixtureFrame ? "0" : "32px";
            host.style.top = fixtureFrame ? "0" : "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";

            const stage = document.createElement("div");
            stage.className = "data-sources-sot-stage";
            stage.style.boxSizing = "border-box";
            stage.style.display = "flow-root";
            stage.style.overflow = "hidden";
            stage.style.background = "var(--bg-canvas)";
            stage.style.fontFamily = "var(--font-sans)";
            stage.style.fontSize = "var(--text-body)";
            stage.style.lineHeight = "var(--lh-body)";
            stage.style.letterSpacing = "var(--ls-body)";
            stage.style.webkitFontSmoothing = "antialiased";
            stage.style.textRendering = "optimizeLegibility";
            stage.style.fontFeatureSettings = '"ss01", "cv11", "rlig", "calt"';
            stage.style.width = `${fixtureFrame?.stage.width ?? fixture.width}px`;
            if (fixtureFrame) {
                stage.style.height = `${fixtureFrame.stage.height}px`;
            }
            stage.innerHTML = fixture.html;

            for (const image of stage.querySelectorAll("img")) {
                const src = image.getAttribute("src");
                if (src && sourceAssets[src]) {
                    image.setAttribute("src", sourceAssets[src]);
                }
            }

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            fixture: fragment,
            fixtureFrame: frame ?? null,
            fixtureId,
            sourceAssets: sourceAssetDataUrls,
        },
    );

    await waitForSotFixtureImages(page, fixtureId);
    const target = frame
        ? page.locator(`#${fixtureId} > .data-sources-sot-stage`).first()
        : page
              .locator(`#${fixtureId} > .data-sources-sot-stage > :first-child`)
              .first();
    await expect(target).toBeVisible();
    await page.waitForTimeout(250);
    const screenshot = await target.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    const metrics = await target.evaluate((element) => {
        const readStyle = (targetElement: Element | null) => {
            if (!targetElement) return null;
            const style = window.getComputedStyle(targetElement);
            return {
                backgroundColor: style.backgroundColor,
                color: style.color,
                fontFamily: style.fontFamily,
                fontFeatureSettings: style.fontFeatureSettings,
                fontSize: style.fontSize,
                fontSynthesisWeight: style.fontSynthesisWeight,
                fontWeight: style.fontWeight,
                letterSpacing: style.letterSpacing,
                lineHeight: style.lineHeight,
                opacity: style.opacity,
                textRendering: style.textRendering,
                webkitFontSmoothing: style.webkitFontSmoothing,
            };
        };
        const rect = element.getBoundingClientRect();
        return {
            body: readStyle(document.body),
            button: readStyle(element),
            height: Math.ceil(rect.height),
            icon: readStyle(element.querySelector(".sp-ico")),
            iconText: readStyle(element.querySelector(".sp-ico span")),
            width: Math.ceil(rect.width),
        };
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        metrics,
        screenshot,
    };
}

async function compareSotPixels(
    page: Page,
    expected: string,
    actual: string,
) {
    return page.evaluate(
        async ({ actual, expected }): Promise<SotPixelDiff> => {
            async function loadImage(src: string) {
                const image = new Image();
                image.decoding = "sync";
                image.src = src;
                await image.decode();
                return image;
            }

            const [expectedImage, actualImage] = await Promise.all([
                loadImage(expected),
                loadImage(actual),
            ]);

            if (
                expectedImage.naturalHeight !== actualImage.naturalHeight ||
                expectedImage.naturalWidth !== actualImage.naturalWidth
            ) {
                return {
                    differingPixels: Number.POSITIVE_INFINITY,
                    dimensionsMatch: false,
                    expectedHeight: expectedImage.naturalHeight,
                    expectedWidth: expectedImage.naturalWidth,
                    maxChannelDelta: Number.POSITIVE_INFINITY,
                    productHeight: actualImage.naturalHeight,
                    productWidth: actualImage.naturalWidth,
                };
            }

            const canvas = document.createElement("canvas");
            canvas.width = expectedImage.naturalWidth;
            canvas.height = expectedImage.naturalHeight;
            const context = canvas.getContext("2d", {
                willReadFrequently: true,
            });
            if (!context) {
                throw new Error("Canvas 2D context unavailable");
            }

            context.drawImage(expectedImage, 0, 0);
            const expectedData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(actualImage, 0, 0);
            const actualData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;

            let differingPixels = 0;
            let maxChannelDelta = 0;
            for (let index = 0; index < expectedData.length; index += 4) {
                const pixelDelta = Math.max(
                    Math.abs(expectedData[index] - actualData[index]),
                    Math.abs(expectedData[index + 1] - actualData[index + 1]),
                    Math.abs(expectedData[index + 2] - actualData[index + 2]),
                    Math.abs(expectedData[index + 3] - actualData[index + 3]),
                );
                if (pixelDelta > 0) {
                    differingPixels += 1;
                    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
                }
            }

            return {
                differingPixels,
                dimensionsMatch: true,
                expectedHeight: expectedImage.naturalHeight,
                expectedWidth: expectedImage.naturalWidth,
                maxChannelDelta,
                productHeight: actualImage.naturalHeight,
                productWidth: actualImage.naturalWidth,
            };
        },
        { actual, expected },
    );
}

async function expectSotFragmentPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    label: string,
    locator: Locator,
    sourceAssetDataUrls: Record<string, string>,
    frames: readonly SotPixelFrame[] = [],
    tolerances: SotPixelTolerancesByFrame = {},
) {
    const originalProductViewport = page.viewportSize();
    const originalSotViewport = sotPage.viewportSize();
    const fragment = await readSotFragment(locator);

    try {
        for (const frame of [undefined, ...frames] as const) {
            const frameLabel = frame ? `${label} ${frame.name}` : label;
            const [sotCapture, productCapture] = await Promise.all([
                captureSotFragmentFixture(
                    sotPage,
                    fragment,
                    sourceAssetDataUrls,
                    frame,
                ),
                captureSotFragmentFixture(
                    page,
                    fragment,
                    sourceAssetDataUrls,
                    frame,
                ),
            ]);
            const diff = await compareSotPixels(
                page,
                sotCapture.dataUrl,
                productCapture.dataUrl,
            );
            const tolerance =
                tolerances[frame?.name ?? "default"] ??
                ZERO_SOT_PIXEL_TOLERANCE;

            if (
                !diff.dimensionsMatch ||
                diff.differingPixels > tolerance.differingPixels ||
                diff.maxChannelDelta > tolerance.maxChannelDelta
            ) {
                const attachmentName = frameLabel
                    .replace(/[^a-z0-9]+/gi, "-")
                    .replace(/^-|-$/g, "")
                    .toLowerCase();
                await testInfo.attach(`${attachmentName}-sot.png`, {
                    body: sotCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${attachmentName}-product.png`, {
                    body: productCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${attachmentName}-diff.json`, {
                    body: Buffer.from(JSON.stringify(diff, null, 2)),
                    contentType: "application/json",
                });
                await testInfo.attach(`${attachmentName}-metrics.json`, {
                    body: Buffer.from(
                        JSON.stringify(
                            {
                                product: productCapture.metrics,
                                sot: sotCapture.metrics,
                            },
                            null,
                            2,
                        ),
                    ),
                    contentType: "application/json",
                });

                const debugDir = path.resolve(
                    process.cwd(),
                    "tmp/sot-pixel-debug",
                );
                await mkdir(debugDir, { recursive: true });
                await Promise.all([
                    writeFile(
                        path.join(debugDir, `${attachmentName}-sot.png`),
                        sotCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${attachmentName}-product.png`),
                        productCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${attachmentName}-diff.json`),
                        JSON.stringify(diff, null, 2),
                    ),
                    writeFile(
                        path.join(debugDir, `${attachmentName}-metrics.json`),
                        JSON.stringify(
                            {
                                product: productCapture.metrics,
                                sot: sotCapture.metrics,
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            const diffLabel = `${frameLabel} ${JSON.stringify({
                ...diff,
                tolerance,
            })}`;
            expect(diff.dimensionsMatch, diffLabel).toBe(true);
            expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
            expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
            expect(diff.differingPixels, diffLabel).toBeLessThanOrEqual(
                tolerance.differingPixels,
            );
            expect(diff.maxChannelDelta, diffLabel).toBeLessThanOrEqual(
                tolerance.maxChannelDelta,
            );
        }
    } finally {
        if (originalProductViewport) {
            await page.setViewportSize(originalProductViewport);
        }
        if (originalSotViewport) {
            await sotPage.setViewportSize(originalSotViewport);
        }
    }
}

async function readComputedStyle(
    locator: Locator,
    props: readonly StyleProp[],
) {
    return locator.first().evaluate(
        (element, propNames) => {
            const style = window.getComputedStyle(element);
            const entries = Object.fromEntries(
                propNames.map((prop) => [prop, style.getPropertyValue(prop)]),
            );

            for (const side of [
                "top",
                "right",
                "bottom",
                "left",
            ] as const) {
                const width = `border-${side}-width`;
                const styleName = `border-${side}-style`;
                const color = `border-${side}-color`;
                if (entries[width] === "0px") {
                    entries[styleName] = "none";
                    entries[color] = "transparent";
                }
            }

            return entries;
        },
        props,
    );
}

async function expectComputedStyleMatch(
    sotLocator: Locator,
    productLocator: Locator,
    props: readonly StyleProp[],
) {
    const [sot, product] = await Promise.all([
        readComputedStyle(sotLocator, props),
        readComputedStyle(productLocator, props),
    ]);

    expect(product, `${productLocator} ~= ${sotLocator}`).toEqual(sot);
}

function sourceEnableSyncControl(page: Page, provider: string) {
    return page.locator(
        `[data-ds-enable][data-sot-control="source-enable-sync"][data-sot-provider="${provider}"]`,
    );
}

async function expectSotSwitchChecked(locator: Locator) {
    await expect(locator).toHaveAttribute("role", "switch");
    await expect(locator).toHaveAttribute("aria-checked", "true");
    await expect(locator).toHaveAttribute("data-sot-state", "checked");
    await expect(locator).toHaveAttribute("data-sot-enabled", "true");
    await expect(locator).toHaveAttribute("data-sot-disabled", "false");
    await expect(locator).toHaveClass(/\btoggle\b/);
    await expect(locator).toHaveClass(/\bon\b/);
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

test("data sources settings rail and provider primitives match SOT computed styles", async ({
    browser,
    page,
}) => {
    const sources = [
        makeSource("dingtalk-a1", {
            authMode: "device-signin",
            authModes: ["device-signin"],
            connected: true,
            displayName: "钉钉闪记",
            enabled: true,
            secretsConfigured: { deviceCredential: true },
        }),
        makeSource("ticnote", {
            baseUrl: "https://voice-api.ticnote.cn",
            config: { region: "cn" },
            displayName: "TicNote",
            enabled: true,
            secretsConfigured: { bearerToken: true },
        }),
        makeSource("feishu-minutes", {
            authMode: "oauth-device-flow",
            authModes: ["oauth-device-flow", "web-reverse"],
            displayName: "飞书妙记",
        }),
        makeSource("iflyrec", {
            authMode: "session-header",
            authModes: ["session-header"],
            connected: true,
            connectionStatus: "expired",
            config: { bizId: "tjzs" },
            displayName: "讯飞听见",
            enabled: true,
            secretsConfigured: { sessionHeader: true },
        }),
        makeSource("plaud", {
            displayName: "Plaud",
        }),
    ];

    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ sources }),
        });
    });

    const sotPage = await browser.newPage();
    try {
        await openSotComponentLibrary(sotPage);
        await ensureSignedIn(page);
        await resetDisplayToChinese(page);
        const section = await openDataSourcesSettings(page);

        const settingsRail = page.locator(".settings-rail");
        const dataSourcesNav = page.locator(
            '[data-sot-control="settings-nav"][data-sot-section="data-sources"]',
        );
        await expect(settingsRail).toBeVisible();
        await expect(dataSourcesNav).toHaveClass(/\bactive\b/);
        await expectComputedStyleMatch(
            sotPage.locator("#srail .settings-rail"),
            settingsRail,
            SETTINGS_RAIL_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage.locator("#srail .sr-item.active"),
            dataSourcesNav,
            SETTINGS_RAIL_ITEM_STYLE_PROPS,
        );

        const dingtalkTile = section.locator(
            '[data-sot-control="source-provider"][data-sot-provider="dingtalk-a1"]',
        );
        const ticnoteTile = section.locator(
            '[data-sot-control="source-provider"][data-sot-provider="ticnote"]',
        );
        const feishuTile = section.locator(
            '[data-sot-control="source-provider"][data-sot-provider="feishu-minutes"]',
        );
        const iflyrecTile = section.locator(
            '[data-sot-control="source-provider"][data-sot-provider="iflyrec"]',
        );
        await dingtalkTile.click();
        await expect(dingtalkTile).toHaveClass(/\bactive\b/);
        await expect(dingtalkTile).not.toHaveClass(/\bdim\b/);
        await expect(ticnoteTile).not.toHaveClass(/\bdim\b/);
        await expect(feishuTile).toHaveClass(/\bdim\b/);
        await expect(iflyrecTile).toHaveClass(/\bdim\b/);

        await expectComputedStyleMatch(
            sotPage.locator("#pcard .sp-card.active"),
            dingtalkTile,
            PROVIDER_CARD_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage.locator("#pcard .sp-card.dim").first(),
            feishuTile,
            PROVIDER_CARD_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage.locator("#pcard .sp-status.ok").first(),
            dingtalkTile.locator(".sp-status.ok"),
            PROVIDER_STATUS_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage.locator("#pcard .sp-status.info").first(),
            ticnoteTile.locator(".sp-status.info"),
            PROVIDER_STATUS_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage.locator("#pcard .sp-card.dim .sp-status.neu").first(),
            feishuTile.locator(".sp-status.neu"),
            PROVIDER_STATUS_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage.locator("#pcard .sp-card.dim .sp-status.warn").first(),
            iflyrecTile.locator(".sp-status.warn"),
            PROVIDER_STATUS_STYLE_PROPS,
        );

        const detail = section.locator(
            '[data-sot-panel="source-provider-detail"][data-sot-provider="dingtalk-a1"]',
        );
        await expect(detail).toBeVisible();
        const actionFooter = detail.locator(
            '[data-save-id="ds-dingtalk-a1"][data-save-state]',
        );
        await expect(actionFooter).toBeVisible();
        await expect(
            actionFooter.locator(
                '[data-sot-control="source-test"][data-save-test]',
            ),
        ).toBeVisible();
        await expect(
            actionFooter.locator(
                '[data-sot-control="source-save"][data-save-action]',
            ),
        ).toBeVisible();
        const sotIndexPage = await browser.newPage();
        try {
            await openSotDataSourcesIndex(sotIndexPage);
            await selectSotDataSourceProvider(sotIndexPage, "dingtalk-a1");
            const sotDetail = sotIndexPage.locator("#ds-detail");
            await expect(sotDetail.locator(".sd-head")).toBeVisible();
            await expect(detail.locator(".sd-head")).toBeVisible();
            await expect(detail.locator(".sm-detail-head")).toHaveCount(0);
            await expectComputedStyleMatch(
                sotDetail,
                detail,
                DETAIL_STYLE_PROPS,
            );
            await expectComputedStyleMatch(
                sotDetail.locator(".field-row").first(),
                detail.locator('[data-field-id="source-browser-authorization"]'),
                DETAIL_ROW_STYLE_PROPS,
            );
            await expectComputedStyleMatch(
                sotDetail.locator(".field-row .sm-row-ctrl").first(),
                detail.locator(
                    '[data-field-id="source-browser-authorization"] .sm-row-ctrl',
                ),
                DETAIL_ROW_CONTROL_STYLE_PROPS,
            );
            await expectComputedStyleMatch(
                sotDetail.locator(".field-input").first(),
                page.locator("#dingtalk-a1-source-browser-authorization"),
                DETAIL_INPUT_STYLE_PROPS,
            );
        } finally {
            await sotIndexPage.close();
        }
        await expectComputedStyleMatch(
            sotPage.locator("#input .toggle.on").first(),
            sourceEnableSyncControl(page, "dingtalk-a1"),
            SWITCH_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage.locator("#input .toggle.on .t-knob").first(),
            sourceEnableSyncControl(page, "dingtalk-a1").locator(".t-knob"),
            SWITCH_KNOB_STYLE_PROPS,
        );
    } finally {
        await sotPage.close();
    }
});

test("data sources settings primitives match SOT component library pixels", async ({
    browser,
    page,
}, testInfo) => {
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#data-sources", { waitUntil: "domcontentloaded" });
    const sourceAssetDataUrls = await readSotSourceAssetDataUrls();

    const sotPage = await browser.newPage();
    try {
        await openSotComponentLibrary(sotPage);

        await expectSotFragmentPixelsMatch(
            page,
            testInfo,
            sotPage,
            "data sources settings rail",
            sotPage.locator("#srail .settings-rail"),
            sourceAssetDataUrls,
            [],
            SETTINGS_RAIL_PIXEL_TOLERANCES,
        );

        const providerCards = sotPage.locator("#pcard .sp-card");
        const providerCardCount = await providerCards.count();
        for (let index = 0; index < providerCardCount; index += 1) {
            const cardLabel = await sotPage
                .locator("#pcard .cl-card-head span:first-child")
                .nth(index)
                .innerText();
            await expectSotFragmentPixelsMatch(
                page,
                testInfo,
                sotPage,
                `data sources provider card ${cardLabel}`,
                providerCards.nth(index),
                sourceAssetDataUrls,
            );
        }

        const actionStates = sotPage.locator(
            "#pdetail .cl-stage-col .sm-actions-state",
        );
        const actionStateCount = await actionStates.count();
        for (let index = 0; index < actionStateCount; index += 1) {
            const actionLabel = await actionStates
                .nth(index)
                .locator(".cl-state")
                .innerText();
            await expectSotFragmentPixelsMatch(
                page,
                testInfo,
                sotPage,
                `data sources action state ${actionLabel}`,
                actionStates.nth(index),
                sourceAssetDataUrls,
            );
        }
    } finally {
        await sotPage.close();
    }

    const sotIndexPage = await browser.newPage();
    try {
        await openSotDataSourcesIndex(sotIndexPage);
        const detailProviders = [
            ["dingtalk-a1", "dingtalk-a1"],
            ["ticnote", "ticnote"],
            ["plaud", "plaud"],
            ["feishu-minutes", "feishu-minutes"],
            ["iflyrec", "iflyrec"],
        ] as const;

        for (const [provider, label] of detailProviders) {
            await selectSotDataSourceProvider(sotIndexPage, provider);
            await expectSotFragmentPixelsMatch(
                page,
                testInfo,
                sotIndexPage,
                `data sources provider detail ${label}`,
                sotIndexPage.locator("#ds-detail"),
                sourceAssetDataUrls,
                DATA_SOURCE_DETAIL_PIXEL_FRAMES,
                provider === "ticnote"
                    ? TICNOTE_PROVIDER_DETAIL_PIXEL_TOLERANCES
                    : undefined,
            );
        }
    } finally {
        await sotIndexPage.close();
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
    await expect(section).toHaveAttribute("data-sot-load-state", "error");
    await expect(page.locator("[data-sot-panel=\"source-load-error\"]")).toContainText(
        "数据源服务暂不可用",
    );

    const retry = page.locator('[data-sot-control="source-load-retry"]');
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(section).toHaveAttribute("data-sot-load-state", "ready");
    await expect(page.locator('[data-sot-control="source-provider"][data-sot-provider="dingtalk-a1"]')).toBeVisible();
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
        const dingtalkRow = section.locator(
            '[data-sot-control="source-provider"][data-sot-provider="dingtalk-a1"]',
        );
        await expect(dingtalkRow).toHaveAttribute(
            "data-sot-status",
            "expired",
        );
        await dingtalkRow.click();

        const dingtalkDetail = section.locator(
            '[data-sot-panel="source-provider-detail"][data-sot-provider="dingtalk-a1"]',
        );
        await expect(dingtalkDetail).toHaveAttribute(
            "data-sot-status",
            "expired",
        );
        await expect(
            dingtalkDetail.locator('[data-sot-panel="source-state-banner"]'),
        ).toHaveAttribute("data-sot-tone", "warn");

        await section
            .locator('[data-sot-control="source-provider"][data-sot-provider="ticnote"]')
            .click();
        const ticnoteDetail = section.locator(
            '[data-sot-panel="source-provider-detail"][data-sot-provider="ticnote"]',
        );
        await page
            .locator("#ticnote-source-secret")
            .fill("fake-real-backend-e2e-token");

        const ticnoteSave = ticnoteDetail.locator(
            '[data-sot-control="source-save"][data-save-action]',
        );
        const saveSuccessResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources") &&
                response.request().method() === "PUT" &&
                response.ok(),
        );
        await ticnoteSave.click();
        await saveSuccessResponse;
        await expect(ticnoteDetail).toHaveAttribute(
            "data-sot-action-state",
            "saved",
        );
        await expect(ticnoteSave).toHaveAttribute("data-sot-state", "saved");
        await expect(ticnoteSave).toHaveAttribute("aria-busy", "false");
        await expect(
            ticnoteDetail.locator('[data-sot-panel="source-state-banner"]'),
        ).toHaveAttribute("data-sot-tone", "ok");
        await expect(
            ticnoteDetail.locator('[data-save-id="ds-ticnote"][data-save-state]'),
        ).toHaveAttribute("data-save-state", "saved");
        await expect(ticnoteDetail.locator("[data-save-status]")).toContainText(
            "已保存",
        );

        await section
            .locator('[data-sot-control="source-provider"][data-sot-provider="iflyrec"]')
            .click();
        const iflyrecDetail = section.locator(
            '[data-sot-panel="source-provider-detail"][data-sot-provider="iflyrec"]',
        );
        await sourceEnableSyncControl(page, "iflyrec").click();
        const iflyrecSave = iflyrecDetail.locator(
            '[data-sot-control="source-save"][data-save-action]',
        );
        const saveErrorResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources") &&
                response.request().method() === "PUT" &&
                response.status() === 400,
        );
        await iflyrecSave.click();
        await saveErrorResponse;
        await expect(iflyrecDetail).toHaveAttribute(
            "data-sot-action-state",
            "save-error",
        );
        await expect(iflyrecSave).toHaveAttribute("data-sot-state", "error");
        await expect(iflyrecSave).toHaveAttribute("aria-busy", "false");
        await expect(
            iflyrecDetail.locator('[data-sot-panel="source-state-banner"]'),
        ).toHaveAttribute("data-sot-tone", "err");
        await expect(
            iflyrecDetail.locator('[data-save-id="ds-iflyrec"][data-save-state]'),
        ).toHaveAttribute("data-save-state", "error");
        await expect(iflyrecDetail.locator("[data-save-status]")).toContainText(
            "保存失败",
        );
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

    const ticnoteRow = section.locator('[data-sot-control="source-provider"][data-sot-provider="ticnote"]');
    await ticnoteRow.click();
    await expect(section).toHaveAttribute("data-sot-selected-provider", "ticnote");
    await expect(ticnoteRow).toHaveAttribute("aria-pressed", "true");
    await expect(ticnoteRow).toHaveAttribute("data-sot-state", "selected");
    await expect(
        ticnoteRow.locator('[data-sot-part="source-provider-mark"]'),
    ).toBeVisible();

    const detail = section.locator('[data-sot-panel="source-provider-detail"][data-sot-provider="ticnote"]');
    const sourceTest = detail.locator(
        '[data-sot-control="source-test"][data-save-test]',
    );
    const sourceSave = detail.locator(
        '[data-sot-control="source-save"][data-save-action]',
    );
    const actionStatus = detail.locator("[data-save-status]");
    const actionFooter = detail.locator(
        '[data-save-id="ds-ticnote"][data-save-state]',
    );
    const stateBanner = detail.locator('[data-sot-panel="source-state-banner"]');
    const ticnoteEnable = sourceEnableSyncControl(page, "ticnote");
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute("data-sot-status", "needs-setup");
    await expect(detail.locator(".sd-head")).toBeVisible();
    await expect(detail.locator(".sd-title")).toContainText("TicNote");
    await expect(detail.locator(".sd-pill")).toHaveAttribute(
        "class",
        /needs-setup|warn|neu/,
    );
    await expect(detail.locator(".sm-section").first()).toBeVisible();
    await expect(detail.locator(".field-row").first()).toBeVisible();
    await expect(detail.locator(".sm-row-ctrl").first()).toBeVisible();
    await expect(detail.locator(".field-input").first()).toBeVisible();
    await expect(detail.locator(".sm-actions-state")).toBeVisible();
    await expect(detail.locator(".sm-detail-head")).toHaveCount(0);
    await expect(detail.locator(".modal-foot")).toHaveCount(0);
    await expect(sourceTest).toHaveAttribute("data-sot-state", "idle");
    await expect(sourceSave).toHaveAttribute("data-sot-state", "idle");
    await expect(actionFooter).toHaveAttribute("data-save-state", "idle");

    await sourceTest.click();
    await expect(detail).toHaveAttribute(
        "data-sot-action-state",
        "test-error",
    );
    await expect(ticnoteRow).toHaveAttribute("data-sot-status", "test-error");
    await expect(stateBanner).toHaveAttribute("data-sot-tone", "err");
    await expect(sourceTest).toHaveAttribute("data-sot-state", "error");
    await expect(actionFooter).toHaveAttribute("data-save-state", "idle");
    await expect(
        stateBanner,
    ).toContainText("信息不完整");
    await expect(actionStatus).toContainText("信息不完整");
    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(sourceSave).toHaveAttribute("aria-busy", "false");

    await page.locator("#ticnote-source-secret").fill("fake-ticnote-token");
    await sourceTest.click();
    await testStarted;
    const shell = page.locator('[data-sot-surface="settings-shell"]');
    await expect(detail).toHaveAttribute(
        "data-sot-action-state",
        "testing",
    );
    await expect(ticnoteRow).toHaveAttribute("data-sot-status", "testing");
    await expect(stateBanner).toHaveAttribute("data-sot-tone", "syncing");
    await expect(sourceTest).toHaveAttribute("data-sot-state", "testing");
    await expect(sourceTest).toHaveAttribute("aria-busy", "true");
    await expect(sourceSave).toHaveAttribute("data-sot-state", "disabled");
    await expect(sourceSave).toHaveAttribute("aria-busy", "false");
    await expect(actionFooter).toHaveAttribute("data-save-state", "disabled");
    await expect(actionStatus).toContainText("测试中");
    await expect(shell).toHaveAttribute("data-sot-busy", "true");
    await expect(detail).toHaveAttribute(
        "data-sot-interaction-disabled",
        "true",
    );
    await expect(section.locator('[data-sot-control="source-provider"][data-sot-provider="plaud"]')).toBeDisabled();
    await expect(
        page.locator(
            '[data-sot-control="settings-nav"][data-sot-section="appearance"]',
        ),
    ).toBeDisabled();
    await expect(page.locator('[data-sot-control="settings-close"]')).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(shell).toBeVisible();
    await section
        .locator('[data-sot-control="source-provider"][data-sot-provider="plaud"]')
        .evaluate((node) => (node as HTMLButtonElement).click());
    await expect(section).toHaveAttribute("data-sot-selected-provider", "ticnote");
    await expect(page.locator("#ticnote-source-secret")).toBeDisabled();
    await expect(ticnoteEnable).toBeDisabled();
    await expect(ticnoteEnable).toHaveAttribute("data-sot-disabled", "true");
    await expect(sourceTest).toBeDisabled();
    await expect(sourceSave).toBeDisabled();
    expect(savePayload).toBeNull();
    releaseTest();
    await expect(detail).toHaveAttribute(
        "data-sot-action-state",
        "test-success",
    );
    await expect(ticnoteRow).toHaveAttribute(
        "data-sot-status",
        "test-success",
    );
    await expect(stateBanner).toHaveAttribute("data-sot-tone", "ok");
    await expect(sourceTest).toHaveAttribute("data-sot-state", "success");
    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(sourceSave).toHaveAttribute("data-sot-state", "idle");
    await expect(sourceSave).toHaveAttribute("aria-busy", "false");
    await expect(actionFooter).toHaveAttribute("data-save-state", "idle");
    await expect(actionStatus).toContainText("连接测试通过");
    await expect(detail).toHaveAttribute(
        "data-sot-interaction-disabled",
        "false",
    );
    await expect(shell).toHaveAttribute("data-sot-busy", "false");
    await expect(section.locator('[data-sot-control="source-provider"][data-sot-provider="plaud"]')).toBeEnabled();
    await expect(
        page.locator(
            '[data-sot-control="settings-nav"][data-sot-section="appearance"]',
        ),
    ).toBeEnabled();
    await expect(page.locator('[data-sot-control="settings-close"]')).toBeEnabled();
    await expect(page.locator("#ticnote-source-secret")).toBeEnabled();
    await expect(ticnoteEnable).toBeEnabled();
    await expect(ticnoteEnable).toHaveAttribute("data-sot-disabled", "false");
    await expect(
        detail.locator("[data-sot-panel=\"source-state-banner\"]"),
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

    await ticnoteEnable.click();
    await expectSotSwitchChecked(ticnoteEnable);

    await sourceSave.click();
    await saveStarted;
    await expect(detail).toHaveAttribute(
        "data-sot-action-state",
        "saving",
    );
    await expect(ticnoteRow).toHaveAttribute("data-sot-status", "saving");
    await expect(stateBanner).toHaveAttribute("data-sot-tone", "syncing");
    await expect(sourceTest).toHaveAttribute("data-sot-state", "disabled");
    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(sourceSave).toHaveAttribute("data-sot-state", "saving");
    await expect(sourceSave).toHaveAttribute("aria-busy", "true");
    await expect(actionFooter).toHaveAttribute("data-save-state", "saving");
    await expect(actionStatus).toContainText("保存中");
    await expect(shell).toHaveAttribute("data-sot-busy", "true");
    await expect(detail).toHaveAttribute(
        "data-sot-interaction-disabled",
        "true",
    );
    await expect(section.locator('[data-sot-control="source-provider"][data-sot-provider="plaud"]')).toBeDisabled();
    await section
        .locator('[data-sot-control="source-provider"][data-sot-provider="plaud"]')
        .evaluate((node) => (node as HTMLButtonElement).click());
    await expect(section).toHaveAttribute("data-sot-selected-provider", "ticnote");
    await expect(page.locator("#ticnote-source-secret")).toBeDisabled();
    await expect(ticnoteEnable).toBeDisabled();
    await expect(ticnoteEnable).toHaveAttribute("data-sot-disabled", "true");
    await expect(sourceTest).toBeDisabled();
    await expect(sourceSave).toBeDisabled();
    releaseSave();

    await expect(detail).toHaveAttribute("data-sot-action-state", "saved");
    await expect(sourceTest).toHaveAttribute("data-sot-state", "idle");
    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(sourceSave).toHaveAttribute("data-sot-state", "saved");
    await expect(sourceSave).toHaveAttribute("aria-busy", "false");
    await expect(actionFooter).toHaveAttribute("data-save-state", "saved");
    await expect(stateBanner).toHaveAttribute("data-sot-tone", "ok");
    await expect(actionStatus).toContainText("已保存");
    await expect(detail).toHaveAttribute(
        "data-sot-interaction-disabled",
        "false",
    );
    await expect(shell).toHaveAttribute("data-sot-busy", "false");
    await expect(section.locator('[data-sot-control="source-provider"][data-sot-provider="plaud"]')).toBeEnabled();
    await expect(detail).toHaveAttribute("data-sot-status", "saved");
    await expect(ticnoteRow).toHaveAttribute("data-sot-status", "saved");
    await expect(ticnoteRow).toHaveAttribute(
        "data-sot-status",
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

    await section
        .locator('[data-sot-control="source-provider"][data-sot-provider="plaud"]')
        .click();
    const plaudDetail = section.locator(
        '[data-sot-panel="source-provider-detail"][data-sot-provider="plaud"]',
    );
    const sourceTest = plaudDetail.locator('[data-sot-control="source-test"]');

    await page.locator("#plaud-source-secret").fill("Bearer e2e-plaud-token");
    await sourceTest.click();

    await expect(plaudDetail).toHaveAttribute(
        "data-sot-action-state",
        "test-error",
    );
    await expect(sourceTest).toHaveAttribute("data-sot-state", "error");
    await expect(
        plaudDetail.locator('[data-sot-panel="source-state-banner"]'),
    ).toContainText("测试数据源连接失败");
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
    const detail = section.locator('[data-sot-panel="source-provider-detail"][data-sot-provider="ticnote"]');
    const sourceSave = detail.locator(
        '[data-sot-control="source-save"][data-save-action]',
    );
    const sourceTest = detail.locator(
        '[data-sot-control="source-test"][data-save-test]',
    );
    const actionStatus = detail.locator("[data-save-status]");
    const actionFooter = detail.locator(
        '[data-save-id="ds-ticnote"][data-save-state]',
    );
    const stateBanner = detail.locator('[data-sot-panel="source-state-banner"]');
    const ticnoteRow = section.locator('[data-sot-control="source-provider"][data-sot-provider="ticnote"]');
    const ticnoteEnable = sourceEnableSyncControl(page, "ticnote");

    await page.locator("#ticnote-source-secret").fill("failed-save-token");
    await ticnoteEnable.click();
    await sourceSave.click();

    await expect(detail).toHaveAttribute(
        "data-sot-action-state",
        "save-error",
    );
    await expect(sourceSave).toHaveAttribute("data-sot-state", "error");
    await expect(actionFooter).toHaveAttribute("data-save-state", "error");
    await expect(ticnoteRow).toHaveAttribute("data-sot-status", "save-error");
    await expect(stateBanner).toHaveAttribute("data-sot-tone", "err");
    await expect(sourceSave).toHaveAttribute("aria-busy", "false");
    await expect(sourceTest).toHaveAttribute("data-sot-state", "idle");
    await expect(sourceTest).toHaveAttribute("aria-busy", "false");
    await expect(actionStatus).toContainText("保存失败");
    await expect(detail).toHaveAttribute(
        "data-sot-interaction-disabled",
        "false",
    );
    await expect(
        stateBanner,
    ).toContainText("保存失败");
    await expect(page.locator("#ticnote-source-secret")).toBeEnabled();
    await expect(page.locator("#ticnote-source-secret")).toHaveValue(
        "failed-save-token",
    );
    await expect(ticnoteEnable).toBeEnabled();
    await expectSotSwitchChecked(ticnoteEnable);
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

    await section.locator('[data-sot-control="source-provider"][data-sot-provider="ticnote"]').click();
    const ticnoteDetail = section.locator('[data-sot-panel="source-provider-detail"][data-sot-provider="ticnote"]');
    const ticnoteSecret = page.locator("#ticnote-source-secret");
    await expect(ticnoteSecret).toHaveAttribute("type", "password");
    await ticnoteSecret.fill("stale-token");
    await pasteTextIntoInput(ticnoteSecret, "Bearer pasted-data-source-token");
    await expect(ticnoteSecret).toHaveValue("Bearer pasted-data-source-token");

    await ticnoteDetail.locator("[data-sot-control=\"source-test\"]").click();
    await expect(ticnoteDetail).toHaveAttribute(
        "data-sot-action-state",
        "test-success",
    );
    expect(testPayloads.at(-1)).toMatchObject({
        provider: "ticnote",
        secrets: { bearerToken: "pasted-data-source-token" },
    });

    await section.locator('[data-sot-control="source-provider"][data-sot-provider="feishu-minutes"]').click();
    const feishuDetail = section.locator(
        '[data-sot-panel="source-provider-detail"][data-sot-provider="feishu-minutes"]',
    );
    await expect(
        feishuDetail.locator('[data-sot-list="source-auth-modes"]'),
    ).toBeVisible();
    await feishuDetail.locator('[data-sot-control="source-auth-mode"][data-sot-auth-mode="web-reverse"]').click();

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

    await feishuDetail.locator("[data-sot-control=\"source-test\"]").click();
    await expect(feishuDetail).toHaveAttribute(
        "data-sot-action-state",
        "test-success",
    );
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
    const shell = page.locator('[data-sot-surface="settings-shell"]');
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "appearance",
    );

    await page
        .locator(
            '[data-sot-control="settings-nav"][data-sot-section="data-sources"]',
        )
        .click();
    await expect(page).toHaveURL(/\/settings#data-sources$/);
    const section = page.locator(
        '[data-sot-surface="settings-data-sources"]',
    );
    await expect(section).toBeVisible();

    const shellHeight = await page
        .locator('[data-sot-surface="settings-shell"]')
        .evaluate((node) => node.getBoundingClientRect().height);
    await section
        .locator('[data-sot-panel="source-provider-detail"]')
        .last()
        .hover();
    await page.mouse.wheel(0, 900);
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );
    const shellHeightAfterScroll = await page
        .locator('[data-sot-surface="settings-shell"]')
        .evaluate((node) => node.getBoundingClientRect().height);
    expect(Math.abs(shellHeightAfterScroll - shellHeight)).toBeLessThan(2);

    const expiredProvider = section.locator('[data-sot-control="source-provider"][data-sot-provider="dingtalk-a1"]');
    await expect(expiredProvider).toHaveAttribute("data-sot-status", "expired");
    await expiredProvider.click();
    const expiredDetail = section.locator('[data-sot-panel="source-provider-detail"][data-sot-provider="dingtalk-a1"]');
    await expect(expiredDetail).toHaveAttribute(
        "data-sot-status",
        "expired",
    );
    await expect(
        expiredDetail.locator("[data-sot-panel=\"source-state-banner\"]"),
    ).toContainText("需要重新登录");

    await section.locator('[data-sot-control="source-provider"][data-sot-provider="plaud"]').click();
    await expect(section.locator('[data-sot-panel="source-provider-detail"][data-sot-provider="plaud"]')).toHaveAttribute(
        "data-sot-status",
        "paused",
    );

    await section.locator('[data-sot-control="source-provider"][data-sot-provider="feishu-minutes"]').click();
    const plannedDetail = section.locator(
        '[data-sot-panel="source-provider-detail"][data-sot-provider="feishu-minutes"]',
    );
    await expect(plannedDetail).toHaveAttribute("data-sot-status", "planned");
    await expect(plannedDetail).toHaveAttribute(
        "data-sot-interaction-disabled",
        "true",
    );
    await expect(
        plannedDetail.locator("[data-sot-control=\"source-test\"]"),
    ).toBeDisabled();
    await expect(
        plannedDetail.locator('[data-sot-control="source-test"][data-save-test]'),
    ).toHaveAttribute("data-sot-state", "disabled");
    await expect(
        plannedDetail.locator("[data-sot-control=\"source-save\"][data-save-action]"),
    ).toBeDisabled();
    await expect(
        plannedDetail.locator('[data-sot-control="source-save"][data-save-action]'),
    ).toHaveAttribute("data-sot-state", "disabled");
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

    await section.locator('[data-sot-control="source-provider"][data-sot-provider="feishu-minutes"]').click();
    await expect(section).toHaveAttribute(
        "data-sot-selected-provider",
        "feishu-minutes",
    );

    const detail = section.locator('[data-sot-panel="source-provider-detail"][data-sot-provider="feishu-minutes"]');
    await expect(
        detail.locator('[data-sot-list="source-auth-modes"]'),
    ).toBeVisible();
    const oauthModeButton = detail.locator(
        '[data-sot-control="source-auth-mode"][data-sot-auth-mode="oauth-device-flow"]',
    );
    const webReverseModeButton = detail.locator(
        '[data-sot-control="source-auth-mode"][data-sot-auth-mode="web-reverse"]',
    );
    await expect(detail).toBeVisible();
    await expect(oauthModeButton).toHaveAttribute("data-sot-state", "selected");
    await expect(webReverseModeButton).toHaveAttribute("data-sot-state", "idle");
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
    await detail.locator("[data-sot-control=\"source-test\"]").click();
    await expect(detail).toHaveAttribute(
        "data-sot-action-state",
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

    await webReverseModeButton.click();
    await expect(oauthModeButton).toHaveAttribute("data-sot-state", "idle");
    await expect(webReverseModeButton).toHaveAttribute(
        "data-sot-state",
        "selected",
    );
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
    await detail.locator("[data-sot-control=\"source-test\"]").click();
    await expect(detail).toHaveAttribute(
        "data-sot-action-state",
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

    await section.locator('[data-sot-control="source-provider"][data-sot-provider="plaud"]').click();
    const plaudDetail = section.locator('[data-sot-panel="source-provider-detail"][data-sot-provider="plaud"]');
    await expect(plaudDetail).toHaveAttribute(
        "data-sot-status",
        "connected",
    );
    await sourceEnableSyncControl(page, "plaud").click();
    await expect(
        plaudDetail.locator('[data-save-id="ds-plaud"][data-save-state]'),
    ).toBeVisible();
    await plaudDetail.locator("[data-sot-control=\"source-save\"][data-save-action]").click();
    await expect
        .poll(() => savePayloads.at(-1)?.provider)
        .toBe("plaud");
    expect(savePayloads.at(-1)).toMatchObject({
        enabled: false,
        provider: "plaud",
    });
    await expect(plaudDetail).toHaveAttribute(
        "data-sot-status",
        "paused",
        { timeout: 5_000 },
    );
    await expect(section.locator('[data-sot-control="source-provider"][data-sot-provider="plaud"]')).toHaveAttribute(
        "data-sot-status",
        "paused",
    );

    await section.locator('[data-sot-control="source-provider"][data-sot-provider="dingtalk-a1"]').click();
    const dingtalkDetail = section.locator(
        '[data-sot-panel="source-provider-detail"][data-sot-provider="dingtalk-a1"]',
    );
    await expect(dingtalkDetail).toHaveAttribute(
        "data-sot-status",
        "expired",
    );
    await page
        .locator("#dingtalk-a1-source-secret")
        .fill("dt-meeting-agent-token-e2e");
    await expect(
        dingtalkDetail.locator('[data-save-id="ds-dingtalk-a1"][data-save-state]'),
    ).toBeVisible();
    await dingtalkDetail.locator("[data-sot-control=\"source-save\"][data-save-action]").click();
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
    await expect(dingtalkDetail).toHaveAttribute(
        "data-sot-status",
        "connected",
        { timeout: 5_000 },
    );
    await expect(
        section.locator('[data-sot-control="source-provider"][data-sot-provider="dingtalk-a1"]'),
    ).toHaveAttribute("data-sot-status", "connected");
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

    await section.locator('[data-sot-control="source-provider"][data-sot-provider="plaud"]').click();
    const plaudDetail = section.locator('[data-sot-panel="source-provider-detail"][data-sot-provider="plaud"]');
    await expect(plaudDetail).toBeVisible();
    const plaudServerSelect = plaudDetail.getByRole("combobox", {
        name: "站点版本",
    });
    await plaudServerSelect.selectOption("custom");
    const selectedPlaudServer = plaudDetail.getByRole("combobox", {
        name: "站点版本",
    });
    await expect(selectedPlaudServer).toHaveValue("custom");
    await expect(page.locator("#plaud-source-custom-api-base")).toBeVisible();

    await section.locator('[data-sot-control="source-provider"][data-sot-provider="feishu-minutes"]').click();
    const feishuDetail = section.locator(
        '[data-sot-panel="source-provider-detail"][data-sot-provider="feishu-minutes"]',
    );
    await feishuDetail.locator('[data-sot-control="source-auth-mode"][data-sot-auth-mode="web-reverse"]').click();
    await expect(page.locator("#feishu-minutes-source-web-cookie")).toBeVisible();
    await expect(page.locator("#feishu-minutes-source-web-token")).toBeVisible();

    await page
        .locator(
            '[data-sot-control="settings-nav"][data-sot-section="appearance"]',
        )
        .click();
    await expect(
        page.locator('[data-sot-surface="settings-data-sources"]'),
    ).toHaveCount(0);
    await expect(page.getByText("飞书妙记")).toHaveCount(0);
    await expect(page.getByText("Cookie")).toHaveCount(0);
    await expect(page.getByText("user_access_token")).toHaveCount(0);
    await expect(page.getByText("X-Feishu-Minutes-Token")).toHaveCount(0);

    await page
        .locator('[data-sot-control="settings-nav"][data-sot-section="misc"]')
        .click();
    await expect(
        page.locator('[data-sot-surface="settings-data-sources"]'),
    ).toHaveCount(0);
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

    const section = page.locator(
        '[data-sot-surface="settings-data-sources"]',
    );
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("data-sot-selected-provider", "iflyrec");
    await expect
        .poll(() =>
            page.evaluate(() =>
                localStorage.getItem("settings-data-source-provider"),
            ),
        )
        .toBe("iflyrec");

    const detail = section.locator('[data-sot-panel="source-provider-detail"][data-sot-provider="iflyrec"]');
    await expect(detail).toHaveAttribute("data-sot-status", "needs-setup");
    await page.locator("#iflyrec-source-secret").fill("iflyrec-session-e2e");
    const sourceTest = detail.locator('[data-sot-control="source-test"]');
    await sourceTest.click();
    await expect(detail).toHaveAttribute(
        "data-sot-action-state",
        "test-error",
    );
    await expect(sourceTest).toHaveAttribute("data-sot-state", "error");
    await expect(
        detail.locator("[data-sot-panel=\"source-state-banner\"]"),
    ).toContainText("连接服务暂不可用");
});
