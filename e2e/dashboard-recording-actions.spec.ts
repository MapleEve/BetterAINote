import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    SOT_COMPONENT_LIBRARY_URL,
    SOT_WORKSTATION_URL,
} from "./helpers/sot-fixtures";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const ACTION_RECORDING_ID = "e2e-dashboard-actions-recording";
const ACTION_TRANSCRIPT_ID = "e2e-dashboard-actions-transcript";
const ACTION_RECORDING_TITLE = "E2E dashboard actions source";
const ACTION_RENAMED_TITLE = "E2E dashboard actions renamed";
const ACTION_KEYBOARD_RENAMED_TITLE = "E2E dashboard keyboard renamed";
const ACTION_AI_RENAMED_TITLE = "E2E dashboard AI renamed";
const ACTION_TAG_NAME = "E2E操作标签";
const MORE_MENU_SOT_STATES = [
    "local-only",
    "upstream",
    "upstream-deleted",
] as const;

type MoreMenuSotState = (typeof MORE_MENU_SOT_STATES)[number];
type AiRenameSotState = "loading" | "review" | "error" | "unavailable";

const MORE_MENU_CARD_LABELS: Record<MoreMenuSotState, string> = {
    "local-only": "Local-only recording",
    upstream: "Upstream recording",
    "upstream-deleted": "Upstream deleted",
};
const CONFIRM_DIALOG_SOT_STATES = [
    "re-transcribe",
    "delete-local",
] as const;

type ConfirmDialogSotState = (typeof CONFIRM_DIALOG_SOT_STATES)[number];

const CONFIRM_DIALOG_CARD_LABELS: Record<ConfirmDialogSotState, string> = {
    "delete-local": "Delete local · upstream deleted",
    "re-transcribe": "Re-transcribe",
};

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

const MORE_MENU_PIXEL_FRAMES = [
    {
        name: "desktop",
        stage: { height: 280, width: 300 },
        viewport: { height: 900, width: 1366 },
    },
    {
        name: "mobile",
        stage: { height: 844, width: 390 },
        viewport: { height: 844, width: 390 },
    },
] as const satisfies readonly SotPixelFrame[];

const CONFIRM_DIALOG_PIXEL_FRAMES = [
    {
        name: "desktop",
        stage: { height: 420, width: 560 },
        viewport: { height: 900, width: 1366 },
    },
    {
        name: "mobile",
        stage: { height: 844, width: 390 },
        viewport: { height: 844, width: 390 },
    },
] as const satisfies readonly SotPixelFrame[];

type MoreMenuPixelDiff = {
    bounds: {
        maxX: number;
        maxY: number;
        minX: number;
        minY: number;
    } | null;
    differingPixels: number;
    dimensionsMatch: boolean;
    expectedHeight: number;
    expectedWidth: number;
    maxChannelDelta: number;
    productHeight: number;
    productWidth: number;
};

type AiRenamePixelMatchOptions = {
    edgeAntialiasTolerance?: {
        differingPixels: number;
        maxChannelDelta: number;
    };
    newTitle?: string;
    oldTitle?: string;
};

const MORE_MENU_SURFACE_STYLE_PROPS = [
    "display",
    "box-sizing",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "border-radius",
    "background-color",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "box-shadow",
] as const;
const MORE_MENU_ITEM_STYLE_PROPS = [
    "display",
    "align-items",
    "gap",
    "min-height",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-radius",
    "text-align",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "color",
    "background-color",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "cursor",
] as const;
const MORE_MENU_SEP_STYLE_PROPS = [
    "height",
    "background-color",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
] as const;
const MORE_MENU_HINT_STYLE_PROPS = [
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "color",
    "letter-spacing",
] as const;
const CONFIRM_SCRIM_STYLE_PROPS = [
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "z-index",
    "background-color",
    "backdrop-filter",
    "display",
    "align-items",
    "justify-content",
] as const;
const CONFIRM_SURFACE_STYLE_PROPS = [
    "display",
    "box-sizing",
    "width",
    "max-width",
    "margin-top",
    "margin-bottom",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "border-right-width",
    "border-right-style",
    "border-right-color",
    "border-bottom-width",
    "border-bottom-style",
    "border-bottom-color",
    "border-left-width",
    "border-left-style",
    "border-left-color",
    "border-radius",
    "background-color",
    "color",
    "font-family",
    "box-shadow",
    "overflow",
] as const;
const CONFIRM_STACK_STYLE_PROPS = [
    "display",
    "box-sizing",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "background-color",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "justify-content",
    "gap",
    "flex-direction",
    "list-style-type",
    "align-items",
] as const;
const CONFIRM_BUTTON_STYLE_PROPS = [
    "display",
    "box-sizing",
    "height",
    "min-width",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-top-width",
    "border-top-style",
    "border-top-color",
    "border-right-width",
    "border-right-style",
    "border-right-color",
    "border-bottom-width",
    "border-bottom-style",
    "border-bottom-color",
    "border-left-width",
    "border-left-style",
    "border-left-color",
    "border-radius",
    "background-color",
    "background-image",
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "box-shadow",
] as const;

type StyleProp =
    | (typeof MORE_MENU_SURFACE_STYLE_PROPS)[number]
    | (typeof MORE_MENU_ITEM_STYLE_PROPS)[number]
    | (typeof MORE_MENU_SEP_STYLE_PROPS)[number]
    | (typeof MORE_MENU_HINT_STYLE_PROPS)[number]
    | (typeof CONFIRM_SCRIM_STYLE_PROPS)[number]
    | (typeof CONFIRM_SURFACE_STYLE_PROPS)[number]
    | (typeof CONFIRM_STACK_STYLE_PROPS)[number]
    | (typeof CONFIRM_BUTTON_STYLE_PROPS)[number];

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
}

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-${suffix}${parsed.ext || ".db"}`,
    );
}

function assertE2EDatabasePath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ??
            path.join(process.cwd(), "tmp/e2e"),
    );
    const resolved = path.resolve(filePath);

    if (resolved !== e2eRoot && !resolved.startsWith(`${e2eRoot}${path.sep}`)) {
        throw new Error(`Refusing to touch non-E2E database path: ${resolved}`);
    }
}

function databaseUrl(filePath: string) {
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

async function executeWithBusyRetry<T>(
    operation: () => Promise<T>,
    attempts = 5,
): Promise<T> {
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
                setTimeout(resolve, 75 * (attempt + 1)),
            );
        }
    }

    throw lastError;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");

for (const databasePath of [CORE_DB, LIBRARY_DB, TRANSCRIPTS_DB]) {
    assertE2EDatabasePath(databasePath);
}

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await client.execute({
            sql: "SELECT id FROM `users` WHERE email = ? LIMIT 1",
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

async function cleanupDashboardActionSeed(userId?: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM transcriptions WHERE recording_id = ?",
                args: [ACTION_RECORDING_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM transcription_jobs WHERE recording_id = ?",
                args: [ACTION_RECORDING_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recording_tag_assignments WHERE recording_id = ?",
                args: [ACTION_RECORDING_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recordings WHERE id = ?",
                args: [ACTION_RECORDING_ID],
            }),
        );
        if (userId) {
            await executeWithBusyRetry(() =>
                library.execute({
                    sql: "DELETE FROM recording_tags WHERE user_id = ? AND name = ?",
                    args: [userId, ACTION_TAG_NAME],
                }),
            );
        }
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedDashboardActionRecording(
    userId: string,
    options: {
        filename?: string;
        includeTranscript?: boolean;
        sourceProvider?: string;
        upstreamDeleted?: boolean;
    } = {},
) {
    const {
        filename = ACTION_RECORDING_TITLE,
        includeTranscript = false,
        sourceProvider = "ticnote",
        upstreamDeleted = true,
    } = options;
    const now = Date.now();
    const start = now - 1_800_000;
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await cleanupDashboardActionSeed(userId);
        await library.execute({
            sql: `
                INSERT OR REPLACE INTO recordings (
                    id, user_id, source_provider, source_recording_id, source_version,
                    source_metadata, provider_device_id, filename, duration, start_time,
                    end_time, filesize, file_md5, storage_type, storage_path,
                    downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                ACTION_RECORDING_ID,
                userId,
                sourceProvider,
                sourceProvider ? "e2e-dashboard-actions-source" : "",
                sourceProvider ? "1" : null,
                "{}",
                sourceProvider ? "e2e-dashboard-actions-device" : "",
                filename,
                180_000,
                start,
                start + 180_000,
                1024,
                "e2e-dashboard-actions",
                "local",
                "",
                now,
                0,
                upstreamDeleted ? 1 : 0,
                now,
                now,
            ],
        });
        if (includeTranscript) {
            await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO transcriptions (
                        id, recording_id, user_id, text, detected_language,
                        transcription_type, provider, model, provider_job_id,
                        speaker_map, provider_payload, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    ACTION_TRANSCRIPT_ID,
                    ACTION_RECORDING_ID,
                    userId,
                    "Speaker 1: Dashboard AI rename review must wait for user confirmation.",
                    "en",
                    "server",
                    "voice-transcribe",
                    "e2e",
                    "remote-e2e-dashboard-actions",
                    "{}",
                    "{}",
                    now - 60_000,
                ],
            });
        }
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function getRecordingSnapshot(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        const recordingResult = await library.execute({
            sql: "SELECT filename FROM recordings WHERE user_id = ? AND id = ? LIMIT 1",
            args: [userId, ACTION_RECORDING_ID],
        });
        const tagsResult = await library.execute({
            sql: `
                SELECT t.name
                FROM recording_tags t
                INNER JOIN recording_tag_assignments a ON a.tag_id = t.id
                WHERE a.user_id = ? AND a.recording_id = ?
                ORDER BY t.name
            `,
            args: [userId, ACTION_RECORDING_ID],
        });

        return {
            filename: recordingResult.rows[0]?.filename ?? null,
            tags: tagsResult.rows
                .map((row) => row.name)
                .filter((name): name is string => typeof name === "string"),
        };
    } finally {
        await library.close();
    }
}

async function openDashboardRenameEditor(page: Page) {
    const renameTrigger = page.getByRole("button", {
        name: "重命名",
        exact: true,
    });
    const renameInput = page.getByLabel("录音标题");

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await renameTrigger.click();
        if (
            await renameInput
                .isVisible({ timeout: 1_000 })
                .catch(() => false)
        ) {
            return;
        }
        await page.waitForTimeout(250);
    }

    await expect(renameInput).toBeVisible();
}

async function gotoHydratedDashboard(page: Page) {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-sot-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-sot-state", "ready");
}

function selectedRecordingTitle(page: Page, title: string | RegExp) {
    return page.getByRole("heading", { name: title });
}

function dashboardRecordingHeader(page: Page) {
    return page.locator(".detail .rec-head").first();
}

function tagDialog(page: Page) {
    return page.getByRole("dialog", { name: "标签" });
}

function tagDialogCreateInput(page: Page) {
    return tagDialog(page).locator('[data-sot-control="recording-tag-name"]');
}

function tagDialogToggle(page: Page, name: string) {
    return tagDialog(page).locator(
        `[data-sot-control="recording-tag-toggle"][data-sot-tag-name="${name}"]`,
    );
}

function aiRenameDialog(page: Page) {
    return page.getByRole("dialog", { name: "AI 标题预览" });
}

function dashboardAiRenamePanel(page: Page) {
    return page.locator('[data-sot-panel="ai-rename-preview"]');
}

function dashboardAiRenameReviewRow(page: Page) {
    return dashboardAiRenamePanel(page).locator(".airp-review-row");
}

function dashboardAiRenameControl(page: Page, control: string) {
    return dashboardAiRenamePanel(page).locator(
        `[data-sot-control="${control}"]`,
    );
}

function dashboardAiRenameAction(page: Page, name: string) {
    return dashboardAiRenamePanel(page).getByRole("button", {
        name,
        exact: true,
    });
}

async function openSotAiRenamePanel(
    page: Page,
    state: AiRenameSotState,
    options: { newTitle?: string; oldTitle?: string } = {},
) {
    await page.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
    await page.evaluate(
        ({ newTitle, oldTitle, state: nextState }) => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
            const panel = document.querySelector<HTMLElement>(
                "[data-rh-ai-panel]",
            );
            if (!panel) {
                throw new Error("SOT AI rename panel not found");
            }

            const recHead = panel.closest<HTMLElement>(".rec-head");
            const trigger = recHead?.querySelector<HTMLButtonElement>(
                "[data-rh-ai-trigger]",
            );
            if (recHead) {
                recHead.dataset.renameMode = "normal";
            }
            if (trigger) {
                trigger.setAttribute("aria-expanded", "true");
            }
            panel.hidden = false;
            panel.dataset.open = "true";
            panel.removeAttribute("aria-hidden");
            panel.removeAttribute("inert");
            panel.querySelectorAll<HTMLElement>("[data-airp-state]").forEach(
                (node) => {
                    node.hidden =
                        node.getAttribute("data-airp-state") !== nextState;
                },
            );

            const isLoading = nextState === "loading";
            const isError = nextState === "error";
            const isUnavailable = nextState === "unavailable";
            const apply = panel.querySelector<HTMLButtonElement>(
                "[data-rh-ai-apply]",
            );
            const regenerate = panel.querySelector<HTMLButtonElement>(
                "[data-rh-ai-regen]",
            );
            const regenerateLabel = panel.querySelector<HTMLElement>(
                "[data-rh-ai-regen-label]",
            );

            if (apply) {
                apply.disabled = isLoading || isError || isUnavailable;
                apply.setAttribute(
                    "aria-disabled",
                    String(isLoading || isError || isUnavailable),
                );
            }
            if (regenerate) {
                regenerate.hidden = isUnavailable;
                regenerate.disabled = isLoading || isUnavailable;
                regenerate.setAttribute(
                    "aria-disabled",
                    String(isLoading || isUnavailable),
                );
            }
            if (regenerateLabel) {
                regenerateLabel.textContent = isError
                    ? "重试"
                    : isLoading
                      ? "生成中…"
                      : "重新生成";
            }

            if (nextState === "review") {
                const oldNode = panel.querySelector<HTMLElement>(
                    '[data-airp-state="review"] [data-airp-old]',
                );
                const newNode = panel.querySelector<HTMLElement>(
                    '[data-airp-state="review"] [data-airp-title]',
                );
                if (oldNode) oldNode.textContent = oldTitle || "—";
                if (newNode) newNode.textContent = newTitle || "—";
            }
        },
        { newTitle: options.newTitle, oldTitle: options.oldTitle, state },
    );
}

async function readFixtureOuterHtml(locator: Locator) {
    return locator.evaluate((element) => {
        const clone = element.cloneNode(true) as Element;
        const sourceFields = element.querySelectorAll("input, textarea, select");
        const cloneFields = clone.querySelectorAll("input, textarea, select");

        sourceFields.forEach((source, index) => {
            const target = cloneFields[index];
            if (!target) {
                return;
            }

            if (source instanceof HTMLInputElement) {
                const targetInput = target as HTMLInputElement;
                targetInput.setAttribute("value", source.value);
                if (source.checked) {
                    targetInput.setAttribute("checked", "");
                } else {
                    targetInput.removeAttribute("checked");
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
                    if (!targetOption) {
                        return;
                    }
                    if (option.selected) {
                        targetOption.setAttribute("selected", "");
                    } else {
                        targetOption.removeAttribute("selected");
                    }
                });
            }
        });

        return clone.outerHTML;
    });
}

async function captureHeaderPlacementFixture(
    page: Page,
    html: string,
    width: number,
) {
    const fixtureId = `dashboard-header-placement-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ fixtureHtml, fixtureId: id, fixtureWidth }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
            document.querySelectorAll("nextjs-portal").forEach((element) => {
                element.remove();
            });

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "var(--bg-canvas)";

            const stage = document.createElement("div");
            stage.className = "dashboard-header-placement-stage";
            stage.style.background = "var(--bg-canvas)";
            stage.style.boxSizing = "border-box";
            stage.style.display = "block";
            stage.style.height = "380px";
            stage.style.overflow = "hidden";
            stage.style.position = "relative";
            stage.style.width = `${fixtureWidth}px`;
            stage.innerHTML = `<section class="detail">${fixtureHtml}</section>`;

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { fixtureHtml: html, fixtureId, fixtureWidth: width },
    );

    const stage = page
        .locator(`#${fixtureId} > .dashboard-header-placement-stage`)
        .first();
    await expect(stage).toBeVisible();
    await page.waitForTimeout(250);
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function expectDashboardHeaderPlacementPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    label: string,
    widths?: readonly number[],
) {
    const sotHeader = sotPage.locator(".detail .rec-head").first();
    const productHeader = dashboardRecordingHeader(page);
    const defaultWidth = await sotHeader.evaluate((element) =>
        Math.round(element.getBoundingClientRect().width),
    );
    const [sotHtml, productHtml] = await Promise.all([
        readFixtureOuterHtml(sotHeader),
        readFixtureOuterHtml(productHeader),
    ]);
    const targetWidths = widths ?? [defaultWidth];

    for (const width of targetWidths) {
        const [sotCapture, productCapture] = await Promise.all([
            captureHeaderPlacementFixture(sotPage, sotHtml, width),
            captureHeaderPlacementFixture(page, productHtml, width),
        ]);
        const diff = await compareMoreMenuPixels(
            page,
            sotCapture.dataUrl,
            productCapture.dataUrl,
        );

        if (
            !diff.dimensionsMatch ||
            diff.differingPixels > 0 ||
            diff.maxChannelDelta > 0
        ) {
            const attachmentName = `${label}-${width}px`
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
        }

        const diffLabel = `${label} ${width}px ${JSON.stringify(diff)}`;
        expect(diff.dimensionsMatch, diffLabel).toBe(true);
        expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
        expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
        expect(diff.maxChannelDelta, diffLabel).toBe(0);
        expect(diff.differingPixels, diffLabel).toBe(0);
    }
}

async function captureAiRenamePanelFixture(page: Page, locator: Locator) {
    await expect(locator).toBeVisible();
    const html = await locator.evaluate((element) => element.outerHTML);
    const fixtureId = `dashboard-ai-rename-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ fixtureId: id, html: fixtureHtml }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className = "ai-rename-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.height = "320px";
            stage.style.overflow = "visible";
            stage.style.padding = "20px";
            stage.style.width = "420px";
            stage.innerHTML = fixtureHtml;

            const panel = stage.querySelector<HTMLElement>(".ai-rename-panel");
            if (!panel) {
                throw new Error("AI rename fixture panel not found");
            }
            panel.hidden = false;
            panel.dataset.open = "true";
            panel.style.display = "flex";
            panel.style.inset = "auto";
            panel.style.left = "auto";
            panel.style.opacity = "1";
            panel.style.pointerEvents = "auto";
            panel.style.position = "static";
            panel.style.right = "auto";
            panel.style.top = "auto";
            panel.style.transform = "none";

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { fixtureId, html },
    );

    const stage = page.locator(`#${fixtureId} > .ai-rename-pixel-stage`).first();
    const root = page.locator(`#${fixtureId} .ai-rename-panel`).first();
    await expect(root).toBeVisible();
    await page.waitForTimeout(100);

    const metrics = await root.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            height: Math.round(rect.height * 1000) / 1000,
            state:
                element.getAttribute("data-sot-state") ||
                element
                    .querySelector<HTMLElement>("[data-airp-state]:not([hidden])")
                    ?.getAttribute("data-airp-state") ||
                null,
            width: Math.round(rect.width * 1000) / 1000,
        };
    });
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
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

async function expectDashboardAiRenamePixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: AiRenameSotState,
    options: AiRenamePixelMatchOptions = {},
) {
    if (options.edgeAntialiasTolerance && state !== "unavailable") {
        throw new Error("AI rename edge antialias tolerance is unavailable-only");
    }
    await openSotAiRenamePanel(sotPage, state, options);
    const [sotCapture, productCapture] = await Promise.all([
        captureAiRenamePanelFixture(
            sotPage,
            sotPage.locator("[data-rh-ai-panel]").first(),
        ),
        captureAiRenamePanelFixture(page, dashboardAiRenamePanel(page).first()),
    ]);
    const diff = await compareMoreMenuPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        const name = `dashboard-ai-rename-${state}`;
        await testInfo.attach(`${name}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
        await testInfo.attach(`${name}-metrics.json`, {
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
        const debugDir = path.resolve(process.cwd(), "tmp/sot-pixel-debug");
        await mkdir(debugDir, { recursive: true });
        await Promise.all([
            writeFile(path.join(debugDir, `${name}-sot.png`), sotCapture.screenshot),
            writeFile(
                path.join(debugDir, `${name}-product.png`),
                productCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${name}-diff.json`),
                JSON.stringify(diff, null, 2),
            ),
            writeFile(
                path.join(debugDir, `${name}-metrics.json`),
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

    const diffLabel = `dashboard AI rename ${state} ${JSON.stringify(diff)}`;
    const tolerance = options.edgeAntialiasTolerance ?? {
        differingPixels: 0,
        maxChannelDelta: 0,
    };
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.maxChannelDelta, diffLabel).toBeLessThanOrEqual(
        tolerance.maxChannelDelta,
    );
    expect(diff.differingPixels, diffLabel).toBeLessThanOrEqual(
        tolerance.differingPixels,
    );
}

function moreActionsMenu(page: Page) {
    return page.getByRole("menu", { name: "更多操作" });
}

async function openSotComponentLibrary(page: Page) {
    await page.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.dataset.theme = "dark";
    });
}

async function openSotWorkstation(page: Page) {
    await page.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.dataset.theme = "dark";
        const scrim = document.getElementById("del-scrim");
        if (scrim) {
            scrim.hidden = false;
            scrim.dataset.open = "true";
            scrim.removeAttribute("aria-hidden");
            scrim.removeAttribute("inert");
        }
    });
}

async function readSotMoreMenuHtml(page: Page) {
    const entries = await Promise.all(
        MORE_MENU_SOT_STATES.map(async (state) => {
            const card = page.locator("#more .cl-card").filter({
                hasText: MORE_MENU_CARD_LABELS[state],
            });
            const html = await card
                .locator(".more-menu")
                .first()
                .evaluate((element) => element.outerHTML);
            return [state, html] as const;
        }),
    );

    return Object.fromEntries(entries) as Record<MoreMenuSotState, string>;
}

async function captureMoreMenuFixture(
    page: Page,
    html: string,
    frame?: SotPixelFrame,
) {
    const fixtureId = `sot-more-menu-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    if (frame) {
        await page.setViewportSize(frame.viewport);
        await page.mouse.move(0, 0);
    }

    await page.evaluate(
        ({ fixtureFrame, fixtureId: id, html: fixtureHtml }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
            document.querySelectorAll("nextjs-portal").forEach((element) => {
                element.remove();
            });

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = fixtureFrame ? "0" : "32px";
            host.style.top = fixtureFrame ? "0" : "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className = "more-menu-pixel-stage cl-stage cl-pop-host";
            stage.style.alignItems = "flex-start";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.display = "block";
            stage.style.height = `${fixtureFrame?.stage.height ?? 280}px`;
            stage.style.justifyContent = "flex-start";
            stage.style.overflow = "visible";
            stage.style.padding = "20px";
            stage.style.width = `${fixtureFrame?.stage.width ?? 300}px`;
            stage.innerHTML = fixtureHtml;

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { fixtureFrame: frame ?? null, fixtureId, html },
    );

    const stage = page.locator(`#${fixtureId} > .more-menu-pixel-stage`).first();
    const root = page.locator(`#${fixtureId} .more-menu`).first();
    await expect(root).toBeVisible();
    await page.waitForTimeout(250);

    const metrics = await root.evaluate((element) => {
        const readStyle = (node: Element | null) => {
            if (!node) return null;
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return {
                backgroundColor: style.backgroundColor,
                borderColor: style.borderColor,
                boxShadow: style.boxShadow,
                color: style.color,
                display: style.display,
                font: style.font,
                gap: style.gap,
                height: Math.round(rect.height * 1000) / 1000,
                opacity: style.opacity,
                padding: style.padding,
                width: Math.round(rect.width * 1000) / 1000,
            };
        };

        return {
            dangerItem: readStyle(element.querySelector(".more-menu-item.is-danger")),
            firstItem: readStyle(element.querySelector(".more-menu-item")),
            hint: readStyle(element.querySelector(".more-menu-hint")),
            root: readStyle(element),
            separator: readStyle(element.querySelector(".more-menu-sep")),
            svgCount: element.querySelectorAll("svg").length,
            svgPaths: Array.from(element.querySelectorAll("svg path")).map(
                (path) => path.getAttribute("d"),
            ),
        };
    });
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
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

async function compareMoreMenuPixels(
    page: Page,
    expected: string,
    actual: string,
): Promise<MoreMenuPixelDiff> {
    return page.evaluate(
        async ({ actual: actualSrc, expected: expectedSrc }) => {
            const loadImage = (src: string) =>
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = () =>
                        reject(new Error(`Failed to decode screenshot ${src}`));
                    image.src = src;
                });
            const [expectedImage, actualImage] = await Promise.all([
                loadImage(expectedSrc),
                loadImage(actualSrc),
            ]);

            if (
                expectedImage.naturalWidth !== actualImage.naturalWidth ||
                expectedImage.naturalHeight !== actualImage.naturalHeight
            ) {
                return {
                    bounds: null,
                    differingPixels: -1,
                    dimensionsMatch: false,
                    expectedHeight: expectedImage.naturalHeight,
                    expectedWidth: expectedImage.naturalWidth,
                    maxChannelDelta: -1,
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
            let minX = Number.POSITIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            let maxX = -1;
            let maxY = -1;
            for (let index = 0; index < expectedData.length; index += 4) {
                const pixelDelta = Math.max(
                    Math.abs(expectedData[index] - actualData[index]),
                    Math.abs(expectedData[index + 1] - actualData[index + 1]),
                    Math.abs(expectedData[index + 2] - actualData[index + 2]),
                    Math.abs(expectedData[index + 3] - actualData[index + 3]),
                );
                if (pixelDelta > 0) {
                    const pixelIndex = index / 4;
                    const x = pixelIndex % canvas.width;
                    const y = Math.floor(pixelIndex / canvas.width);
                    differingPixels += 1;
                    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }

            return {
                bounds:
                    differingPixels > 0
                        ? { maxX, maxY, minX, minY }
                        : null,
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

async function expectMoreMenuPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: MoreMenuSotState,
    html: string,
    frame?: SotPixelFrame,
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureMoreMenuFixture(sotPage, html, frame),
        captureMoreMenuFixture(page, html, frame),
    ]);
    const diff = await compareMoreMenuPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        const name = `more-menu-${state}-${frame?.name ?? "default"}`
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();
        await testInfo.attach(`${name}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
        await testInfo.attach(`${name}-metrics.json`, {
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
        const debugDir = path.resolve(process.cwd(), "tmp/sot-pixel-debug");
        await mkdir(debugDir, { recursive: true });
        await Promise.all([
            writeFile(path.join(debugDir, `${name}-sot.png`), sotCapture.screenshot),
            writeFile(
                path.join(debugDir, `${name}-product.png`),
                productCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${name}-diff.json`),
                JSON.stringify(diff, null, 2),
            ),
            writeFile(
                path.join(debugDir, `${name}-metrics.json`),
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

    const diffLabel = `more-menu ${state} ${frame?.name ?? "default"} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
    expect(diff.differingPixels, diffLabel).toBe(0);
}

async function expectMoreMenuResponsivePixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: MoreMenuSotState,
    html: string,
) {
    const originalProductViewport = page.viewportSize();
    const originalSotViewport = sotPage.viewportSize();

    try {
        for (const frame of MORE_MENU_PIXEL_FRAMES) {
            await expectMoreMenuPixelMatch(
                page,
                testInfo,
                sotPage,
                state,
                html,
                frame,
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

async function readSotConfirmDialogHtml(page: Page) {
    const entries = await Promise.all(
        CONFIRM_DIALOG_SOT_STATES.map(async (state) => {
            const card = page.locator("#confirm .cl-card").filter({
                hasText: CONFIRM_DIALOG_CARD_LABELS[state],
            });
            const html = await card
                .locator(".confirm-dialog")
                .first()
                .evaluate((element) => element.outerHTML);
            return [state, html] as const;
        }),
    );

    return Object.fromEntries(entries) as Record<ConfirmDialogSotState, string>;
}

async function captureConfirmDialogFixture(
    page: Page,
    html: string,
    frame?: SotPixelFrame,
) {
    const fixtureId = `sot-confirm-dialog-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    if (frame) {
        await page.setViewportSize(frame.viewport);
        await page.mouse.move(0, 0);
    }

    await page.evaluate(
        ({ fixtureFrame, fixtureId: id, html: fixtureHtml }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
            document.querySelectorAll("nextjs-portal").forEach((element) => {
                element.remove();
            });

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = fixtureFrame ? "0" : "32px";
            host.style.top = fixtureFrame ? "0" : "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "var(--bg-canvas)";

            const stage = document.createElement("div");
            stage.className =
                "confirm-dialog-pixel-stage cl-stage cl-stage-canvas";
            stage.style.alignItems = "center";
            stage.style.background = "var(--bg-canvas)";
            stage.style.boxSizing = "border-box";
            stage.style.display = "flex";
            stage.style.height = `${fixtureFrame?.stage.height ?? 420}px`;
            stage.style.justifyContent = "center";
            stage.style.overflow = "visible";
            stage.style.padding = "20px";
            stage.style.width = `${fixtureFrame?.stage.width ?? 560}px`;
            stage.innerHTML = fixtureHtml;

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { fixtureFrame: frame ?? null, fixtureId, html },
    );

    const stage = page
        .locator(`#${fixtureId} > .confirm-dialog-pixel-stage`)
        .first();
    const root = page.locator(`#${fixtureId} .confirm-dialog`).first();
    await expect(root).toBeVisible();
    await page.waitForTimeout(250);

    const metrics = await root.evaluate((element) => {
        const readStyle = (node: Element | null) => {
            if (!node) return null;
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return {
                backgroundColor: style.backgroundColor,
                borderColor: style.borderColor,
                boxShadow: style.boxShadow,
                color: style.color,
                display: style.display,
                font: style.font,
                height: Math.round(rect.height * 1000) / 1000,
                padding: style.padding,
                width: Math.round(rect.width * 1000) / 1000,
            };
        };

        return {
            body: readStyle(element.querySelector(".confirm-body")),
            dangerButton: readStyle(
                element.querySelector(".confirm-foot button:nth-child(2)"),
            ),
            ghostButton: readStyle(
                element.querySelector(".confirm-foot button:nth-child(1)"),
            ),
            head: readStyle(element.querySelector(".confirm-head")),
            root: readStyle(element),
            warn: readStyle(element.querySelector(".confirm-warn")),
        };
    });
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
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

async function expectConfirmDialogPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: ConfirmDialogSotState,
    html: string,
    frame?: SotPixelFrame,
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureConfirmDialogFixture(sotPage, html, frame),
        captureConfirmDialogFixture(page, html, frame),
    ]);
    const diff = await compareMoreMenuPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels > 0 ||
        diff.maxChannelDelta > 0
    ) {
        const name = `confirm-dialog-${state}-${frame?.name ?? "default"}`
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();
        await testInfo.attach(`${name}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${name}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
        await testInfo.attach(`${name}-metrics.json`, {
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
    }

    const diffLabel = `confirm-dialog ${state} ${frame?.name ?? "default"} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, diffLabel).toBe(true);
    expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
    expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
    expect(diff.maxChannelDelta, diffLabel).toBe(0);
    expect(diff.differingPixels, diffLabel).toBe(0);
}

async function expectConfirmDialogResponsivePixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: ConfirmDialogSotState,
    html: string,
) {
    const originalProductViewport = page.viewportSize();
    const originalSotViewport = sotPage.viewportSize();

    try {
        for (const frame of CONFIRM_DIALOG_PIXEL_FRAMES) {
            await expectConfirmDialogPixelMatch(
                page,
                testInfo,
                sotPage,
                state,
                html,
                frame,
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
            if (entries["border-top-width"] === "0px") {
                entries["border-top-style"] = "none";
            }
            if (entries["border-right-width"] === "0px") {
                entries["border-right-style"] = "none";
            }
            if (entries["border-bottom-width"] === "0px") {
                entries["border-bottom-style"] = "none";
            }
            if (entries["border-left-width"] === "0px") {
                entries["border-left-style"] = "none";
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

    expect(product).toEqual(sot);
}

async function readConfirmDialogSignature(locator: Locator) {
    return locator.first().evaluate((root) => {
        function nodeSignature(element: Element): unknown {
            return {
                tag: element.tagName.toLowerCase(),
                className: element.getAttribute("class") ?? "",
                role: element.getAttribute("role"),
                ariaModal: element.getAttribute("aria-modal"),
                text: Array.from(element.childNodes)
                    .filter((node) => node.nodeType === Node.TEXT_NODE)
                    .map((node) => node.textContent?.trim() ?? "")
                    .filter(Boolean)
                    .join(" "),
                children: Array.from(element.children).map(nodeSignature),
            };
        }

        return nodeSignature(root);
    });
}

async function expectDeleteConfirmDialogMatchesSot(
    sotLibraryPage: Page,
    sotWorkstationPage: Page,
    productPage: Page,
) {
    const sotRoot = sotLibraryPage.locator("#confirm .confirm-dialog").nth(1);
    const productScrim = productPage.locator('[data-sot-panel="confirm-dialog"]');
    const productRoot = productScrim.locator(".confirm-dialog");

    await expect(productScrim).toBeVisible();
    await expect(productRoot).toBeVisible();
    await expect(await readConfirmDialogSignature(productRoot)).toEqual(
        await readConfirmDialogSignature(sotRoot),
    );
    await expectComputedStyleMatch(
        sotWorkstationPage.locator("#del-scrim"),
        productScrim,
        CONFIRM_SCRIM_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotRoot,
        productRoot,
        CONFIRM_SURFACE_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotRoot.locator(".confirm-head"),
        productRoot.locator(".confirm-head"),
        CONFIRM_STACK_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotRoot.locator(".confirm-head h3"),
        productRoot.locator(".confirm-head h3"),
        CONFIRM_STACK_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotRoot.locator(".confirm-body"),
        productRoot.locator(".confirm-body"),
        CONFIRM_STACK_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotRoot.locator(".confirm-warn"),
        productRoot.locator(".confirm-warn"),
        CONFIRM_STACK_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotRoot.locator(".confirm-foot"),
        productRoot.locator(".confirm-foot"),
        CONFIRM_STACK_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotRoot.locator(".confirm-foot button").nth(0),
        productRoot.locator(
            '[data-slot="dialog-footer"] [data-slot="button"][data-variant="outline"]',
        ),
        CONFIRM_BUTTON_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotRoot.locator(".confirm-foot button").nth(1),
        productRoot.locator(
            '[data-slot="dialog-footer"] [data-slot="button"][data-variant="destructive"]',
        ),
        CONFIRM_BUTTON_STYLE_PROPS,
    );
}

async function readRightInset(container: Locator, child: Locator) {
    return Promise.all([
        container.first().boundingBox(),
        child.first().boundingBox(),
    ]).then(([containerBox, childBox]) => {
        if (!containerBox || !childBox) {
            throw new Error("Unable to read right inset for hidden element");
        }
        return Math.round(
            containerBox.x + containerBox.width - childBox.x - childBox.width,
        );
    });
}

async function expectRightInsetMatch(
    sotContainer: Locator,
    sotChild: Locator,
    productContainer: Locator,
    productChild: Locator,
) {
    const [sotInset, productInset] = await Promise.all([
        readRightInset(sotContainer, sotChild),
        readRightInset(productContainer, productChild),
    ]);

    expect(productInset).toBe(sotInset);
}

function settingsShell(page: Page) {
    return page.locator('[data-sot-surface="settings-shell"]');
}

async function mockTitleGenerationSettings(page: Page, configured: boolean) {
    await page.route("**/api/settings/title-generation", async (route) => {
        if (route.request().method() !== "GET") {
            await route.fallback();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                autoGenerateTitle: true,
                titleGenerationBaseUrl: configured
                    ? "https://llm.example.invalid/v1"
                    : null,
                titleGenerationModel: configured ? "e2e-title-model" : null,
                titleGenerationApiKeySet: configured,
                titleGenerationPrompt: null,
            }),
        });
    });
}

test("dashboard MoreActionsMenu states match SOT component-library pixels", async ({
    page,
}, testInfo) => {
    test.setTimeout(120_000);
    const sotPage = await page.context().newPage();

    try {
        await page.setViewportSize({ width: 1280, height: 760 });
        await ensureSignedIn(page);
        await resetDisplayToChinese(page);
        await gotoHydratedDashboard(page);
        await openSotComponentLibrary(sotPage);
        const sotMenus = await readSotMoreMenuHtml(sotPage);

        for (const state of MORE_MENU_SOT_STATES) {
            await expectMoreMenuResponsivePixelMatch(
                page,
                testInfo,
                sotPage,
                state,
                sotMenus[state],
            );
        }
    } finally {
        await sotPage.close();
    }
});

test("dashboard ConfirmDialog states match SOT component-library pixels", async ({
    page,
}, testInfo) => {
    test.setTimeout(120_000);
    const sotPage = await page.context().newPage();

    try {
        await page.setViewportSize({ width: 1280, height: 760 });
        await ensureSignedIn(page);
        await resetDisplayToChinese(page);
        await gotoHydratedDashboard(page);
        await openSotComponentLibrary(sotPage);
        const sotDialogs = await readSotConfirmDialogHtml(sotPage);

        for (const state of CONFIRM_DIALOG_SOT_STATES) {
            await expectConfirmDialogResponsivePixelMatch(
                page,
                testInfo,
                sotPage,
                state,
                sotDialogs[state],
            );
        }
    } finally {
        await sotPage.close();
    }
});

test("dashboard renames, tags, and deletes an upstream-deleted local copy through the new UI", async ({
    page,
}) => {
    let userId: string | null = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId);

        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await expect(selectedRecordingTitle(page, ACTION_RECORDING_TITLE)).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        await openDashboardRenameEditor(page);
        await page.getByLabel("录音标题").fill(ACTION_RENAMED_TITLE);
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${ACTION_RECORDING_ID}/rename`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            page.getByRole("button", { name: "保存新标题" }).click(),
        ]);
        await expect(selectedRecordingTitle(page, ACTION_RENAMED_TITLE)).toHaveText(
            ACTION_RENAMED_TITLE,
        );
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_RENAMED_TITLE);

        await page.getByRole("button", { name: "标签", exact: true }).click();
        await expect(tagDialog(page)).toBeVisible();
        await expect(tagDialog(page)).toHaveAttribute(
            "data-sot-panel",
            "recording-tag-manager",
        );
        await tagDialogCreateInput(page).fill(ACTION_TAG_NAME);
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response.url().includes("/api/recording-tags") &&
                    response.request().method() === "POST" &&
                    response.ok(),
            ),
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${ACTION_RECORDING_ID}/tags`) &&
                    response.request().method() === "PUT" &&
                    response.ok(),
            ),
            tagDialogCreateInput(page).press("Enter"),
        ]);

        const selectedTag = tagDialogToggle(page, ACTION_TAG_NAME);
        await expect(selectedTag).toBeVisible();
        await expect(selectedTag).toHaveAttribute("aria-pressed", "true");
        await expect(selectedTag).toHaveAttribute(
            "data-sot-state",
            "selected",
        );
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).tags)
            .toEqual([ACTION_TAG_NAME]);

        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${ACTION_RECORDING_ID}/tags`) &&
                    response.request().method() === "PUT" &&
                    response.ok(),
            ),
            selectedTag.click(),
        ]);
        await expect(selectedTag).toHaveAttribute("aria-pressed", "false");
        await expect(selectedTag).toHaveAttribute("data-sot-state", "idle");
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).tags)
            .toEqual([]);

        await page.getByRole("button", { name: "更多操作" }).click();
        await expect(moreActionsMenu(page))
            .toHaveAttribute("data-sot-local-delete-available", "true");
        await moreActionsMenu(page)
            .getByRole("menuitem", { name: /删除本地副本/ })
            .click();
        const cancelDeleteDialog = page.getByRole("dialog", {
            name: /删除本地副本/,
        });
        await expect(cancelDeleteDialog).toContainText(
            "这条录音在来源系统中已被删除，本地仅留存缓存副本。",
        );
        await expect(cancelDeleteDialog.locator(".confirm-warn")).toHaveText(
            "删除后转写、标签与 AI 标题都会一并清除，且无法恢复。",
        );
        await cancelDeleteDialog
            .getByRole("button", { name: "取消", exact: true })
            .click();
        await expect(selectedRecordingTitle(page, ACTION_RENAMED_TITLE)).toHaveText(
            ACTION_RENAMED_TITLE,
        );
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_RENAMED_TITLE);

        await page.getByRole("button", { name: "更多操作" }).click();
        await moreActionsMenu(page)
            .getByRole("menuitem", { name: /删除本地副本/ })
            .click();
        const confirmDeleteDialog = page.getByRole("dialog", {
            name: /删除本地副本/,
        });
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${ACTION_RECORDING_ID}`) &&
                    response.request().method() === "DELETE" &&
                    response.ok(),
            ),
            confirmDeleteDialog
                .getByRole("button", { name: "永久删除", exact: true })
                .click(),
        ]);

        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBeNull();
        await expect(page.getByText(ACTION_RENAMED_TITLE)).toBeHidden();
    } finally {
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});

test("dashboard local delete confirmation matches SOT and cancels with Escape or backdrop", async ({
    page,
}) => {
    let userId: string | null = null;
    let deleteAttempts = 0;
    const sotLibraryPage = await page.context().newPage();
    const sotWorkstationPage = await page.context().newPage();

    await page.route(
        `**/api/recordings/${ACTION_RECORDING_ID}`,
        async (route) => {
            if (route.request().method() === "DELETE") {
                deleteAttempts += 1;
            }
            await route.fallback();
        },
    );

    async function openDeleteDialog() {
        const moreButton = page.getByRole("button", { name: "更多操作" });
        await moreButton.click();
        await moreActionsMenu(page)
            .getByRole("menuitem", { name: /删除本地副本/ })
            .click();
        const dialog = page.getByRole("dialog", { name: /删除本地副本/ });
        await expect(dialog).toBeVisible();
        await expect(
            dialog.getByRole("heading", { name: "删除本地副本？" }),
        ).toBeVisible();
        await expect(
            dialog.getByRole("button", { name: "取消", exact: true }),
        ).toBeFocused();
        await expectDeleteConfirmDialogMatchesSot(
            sotLibraryPage,
            sotWorkstationPage,
            page,
        );
        return { dialog, moreButton };
    }

    try {
        await openSotComponentLibrary(sotLibraryPage);
        await openSotWorkstation(sotWorkstationPage);
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId);

        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await expect(selectedRecordingTitle(page, ACTION_RECORDING_TITLE)).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        const escapeFlow = await openDeleteDialog();
        await page.keyboard.press("Escape");
        await expect(escapeFlow.dialog).not.toBeVisible();
        await expect(escapeFlow.moreButton).toBeFocused();
        expect(deleteAttempts).toBe(0);
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_RECORDING_TITLE);

        const backdropFlow = await openDeleteDialog();
        await page
            .locator('[data-sot-panel="confirm-dialog"]')
            .click({ position: { x: 8, y: 8 } });
        await expect(backdropFlow.dialog).not.toBeVisible();
        await expect(backdropFlow.moreButton).toBeFocused();
        expect(deleteAttempts).toBe(0);
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_RECORDING_TITLE);
    } finally {
        await sotLibraryPage.close();
        await sotWorkstationPage.close();
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});

test("dashboard deletes a source-less local recording through the SOT confirmation flow", async ({
    page,
}) => {
    let userId: string | null = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId, {
            sourceProvider: "",
            upstreamDeleted: false,
        });

        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await expect(selectedRecordingTitle(page, ACTION_RECORDING_TITLE)).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        await page.getByRole("button", { name: "更多操作" }).click();
        const localOnlyMenu = moreActionsMenu(page);
        await expect(localOnlyMenu).toHaveAttribute("data-sot-state", "local-only");
        await expect(localOnlyMenu)
            .toHaveAttribute("data-sot-local-delete-available", "true");
        await expect(
            localOnlyMenu.getByRole("menuitem", { name: "重新转写" }),
        ).toBeVisible();
        await expect(localOnlyMenu.locator(".more-menu-item svg")).toHaveCount(
            4,
        );
        const deleteButton = localOnlyMenu.getByRole("menuitem", {
            name: /删除本地副本/,
        });
        await expect(deleteButton).toBeEnabled();
        await expect(deleteButton.locator(".more-menu-hint")).toHaveCount(0);
        await deleteButton.click();

        const dialog = page.getByRole("dialog", { name: /删除本地副本/ });
        await expect(dialog).toBeVisible();
        await expect(
            dialog.getByRole("heading", { name: "删除本地副本？" }),
        ).toBeVisible();
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${ACTION_RECORDING_ID}`) &&
                    response.request().method() === "DELETE" &&
                    response.ok(),
            ),
            dialog
                .getByRole("button", { name: "永久删除", exact: true })
                .click(),
        ]);

        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBeNull();
        await expect(page.getByText(ACTION_RECORDING_TITLE)).toBeHidden();
    } finally {
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});

test("dashboard keeps local delete unavailable for synced source recordings", async ({
    page,
}) => {
    let userId: string | null = null;
    let deleteAttempts = 0;

    await page.route(
        `**/api/recordings/${ACTION_RECORDING_ID}`,
        async (route) => {
            if (route.request().method() === "DELETE") {
                deleteAttempts += 1;
                await route.fulfill({
                    contentType: "application/json",
                    status: 500,
                    body: JSON.stringify({ error: "DELETE should not fire" }),
                });
                return;
            }

            await route.fallback();
        },
    );

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId, {
            upstreamDeleted: false,
        });

        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await expect(selectedRecordingTitle(page, ACTION_RECORDING_TITLE)).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        await page.getByRole("button", { name: "更多操作" }).click();
        await expect(moreActionsMenu(page))
            .toHaveAttribute("data-sot-local-delete-available", "false");
        const deleteButton = moreActionsMenu(page).getByRole("menuitem", {
            name: /删除本地副本/,
        });
        await expect(deleteButton).toBeDisabled();
        await expect(deleteButton).toHaveAttribute("aria-disabled", "true");
        await expect(deleteButton).toContainText("来源持有正本");

        await deleteButton.evaluate((button) =>
            (button as HTMLButtonElement).click(),
        );
        await expect(page.getByRole("dialog")).toHaveCount(0);
        expect(deleteAttempts).toBe(0);
    } finally {
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});

test("dashboard more actions primitives match SOT component library styles", async ({
    page,
}) => {
    let userId: string | null = null;
    const sotPage = await page.context().newPage();

    try {
        await openSotComponentLibrary(sotPage);
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);

        await seedDashboardActionRecording(userId, {
            upstreamDeleted: true,
        });
        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await page.getByRole("button", { name: "更多操作" }).click();

        const upstreamDeletedMenu = moreActionsMenu(page);
        const sotUpstreamDeleted = sotPage.locator("#more .cl-card").nth(2);
        await expect(upstreamDeletedMenu).toHaveAttribute(
            "data-sot-state",
            "upstream-deleted",
        );
        await expect(upstreamDeletedMenu.getByRole("menuitem")).toHaveCount(3);
        await expect(
            upstreamDeletedMenu.getByRole("menuitem", { name: "重新转写" }),
        ).toHaveCount(0);
        await expect(
            upstreamDeletedMenu
                .locator(".more-menu-item")
                .nth(0)
                .locator("svg"),
        ).toHaveCount(0);
        await expect(
            upstreamDeletedMenu
                .locator(".more-menu-item")
                .nth(1)
                .locator("svg"),
        ).toHaveCount(0);
        await expect(
            upstreamDeletedMenu.locator(".more-menu-item.is-danger svg path"),
        ).toHaveAttribute("d", "M3 6h18");
        await expect(upstreamDeletedMenu.locator(".more-menu-sep")).toHaveCount(
            1,
        );
        await expectComputedStyleMatch(
            sotUpstreamDeleted.locator(".more-menu"),
            upstreamDeletedMenu,
            MORE_MENU_SURFACE_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotUpstreamDeleted.locator(".more-menu-item").first(),
            upstreamDeletedMenu.locator(".more-menu-item").first(),
            MORE_MENU_ITEM_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotUpstreamDeleted.locator(".more-menu-item.is-danger"),
            upstreamDeletedMenu.locator(".more-menu-item.is-danger"),
            MORE_MENU_ITEM_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotUpstreamDeleted.locator(".more-menu-sep"),
            upstreamDeletedMenu.locator(".more-menu-sep"),
            MORE_MENU_SEP_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotUpstreamDeleted.locator(".more-menu-hint"),
            upstreamDeletedMenu.locator(".more-menu-hint"),
            MORE_MENU_HINT_STYLE_PROPS,
        );
        await expectRightInsetMatch(
            sotUpstreamDeleted.locator(".more-menu"),
            sotUpstreamDeleted.locator(".more-menu-hint"),
            upstreamDeletedMenu,
            upstreamDeletedMenu.locator(".more-menu-hint"),
        );

        await seedDashboardActionRecording(userId, {
            upstreamDeleted: false,
        });
        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await page.getByRole("button", { name: "更多操作" }).click();

        const upstreamMenu = moreActionsMenu(page);
        const sotUpstream = sotPage.locator("#more .cl-card").nth(1);
        await expect(upstreamMenu).toHaveAttribute("data-sot-state", "upstream");
        await expect(upstreamMenu.getByRole("menuitem")).toHaveCount(4);
        await expect(upstreamMenu.locator(".more-menu-sep")).toHaveCount(0);
        const disabledDelete = upstreamMenu.getByRole("menuitem", {
            name: /删除本地副本/,
        });
        await expect(disabledDelete).toBeDisabled();
        await expect(disabledDelete).toContainText("来源持有正本");
        await expect(upstreamMenu.locator("svg")).toHaveCount(0);
        await expectComputedStyleMatch(
            sotUpstream.locator(".more-menu"),
            upstreamMenu,
            MORE_MENU_SURFACE_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotUpstream.locator(".more-menu-item").first(),
            upstreamMenu.locator(".more-menu-item").first(),
            MORE_MENU_ITEM_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotUpstream.locator(".more-menu-item[disabled]"),
            upstreamMenu.locator(".more-menu-item[disabled]"),
            MORE_MENU_ITEM_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotUpstream.locator(".more-menu-hint"),
            upstreamMenu.locator(".more-menu-hint"),
            MORE_MENU_HINT_STYLE_PROPS,
        );
        await expectRightInsetMatch(
            sotUpstream.locator(".more-menu"),
            sotUpstream.locator(".more-menu-hint"),
            upstreamMenu,
            upstreamMenu.locator(".more-menu-hint"),
        );
    } finally {
        await sotPage.close();
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});

test("dashboard preserves an upstream-deleted local copy after local delete failure", async ({
    page,
}) => {
    let userId: string | null = null;
    let deleteAttempts = 0;

    await page.route(
        `**/api/recordings/${ACTION_RECORDING_ID}`,
        async (route) => {
            if (route.request().method() === "DELETE") {
                deleteAttempts += 1;
                await route.fulfill({
                    contentType: "application/json",
                    status: 500,
                    body: JSON.stringify({ error: "本地删除失败" }),
                });
                return;
            }

            await route.fallback();
        },
    );

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId);

        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await expect(selectedRecordingTitle(page, ACTION_RECORDING_TITLE)).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        await page.getByRole("button", { name: "更多操作" }).click();
        await moreActionsMenu(page)
            .getByRole("menuitem", { name: /删除本地副本/ })
            .click();
        const failedDeleteDialog = page.getByRole("dialog", {
            name: /删除本地副本/,
        });
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${ACTION_RECORDING_ID}`) &&
                    response.request().method() === "DELETE" &&
                    response.status() === 500,
            ),
            failedDeleteDialog
                .getByRole("button", { name: "永久删除", exact: true })
                .click(),
        ]);

        await expect(
            page
                .locator('.toast.toast-err')
                .filter({ hasText: "本地删除失败" }),
        ).toBeVisible();
        await expect(selectedRecordingTitle(page, ACTION_RECORDING_TITLE)).toHaveText(
            ACTION_RECORDING_TITLE,
        );
        await expect(
            page.getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) }),
        ).toBeVisible();
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_RECORDING_TITLE);
        expect(deleteAttempts).toBe(1);
    } finally {
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});

test("dashboard rename keyboard paths and AI rename review states stay explicit", async ({
    page,
}) => {
    let userId: string | null = null;
    const previewPayloads: unknown[] = [];
    const patchPayloads: unknown[] = [];
    let previewAttempts = 0;

    page.on("request", (request) => {
        const requestPath = new URL(request.url()).pathname;
        if (
            request.method() === "PATCH" &&
            requestPath.endsWith(`/api/recordings/${ACTION_RECORDING_ID}/rename`)
        ) {
            patchPayloads.push(request.postDataJSON());
        }
    });

    await mockTitleGenerationSettings(page, true);
    await page.route(
        `**/api/recordings/${ACTION_RECORDING_ID}/rename/auto`,
        async (route) => {
            expect(route.request().method()).toBe("POST");
            previewPayloads.push(route.request().postDataJSON());
            previewAttempts += 1;
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    applied: false,
                    filename:
                        previewAttempts === 1
                            ? "E2E dashboard AI preview discarded"
                            : ACTION_AI_RENAMED_TITLE,
                }),
            });
        },
    );

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId, {
            includeTranscript: true,
        });

        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await expect(selectedRecordingTitle(page, ACTION_RECORDING_TITLE)).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        await openDashboardRenameEditor(page);
        await page
            .getByLabel("录音标题")
            .fill("E2E dashboard escape should not save");
        await page.getByLabel("录音标题").press("Escape");
        await expect(page.getByLabel("录音标题")).toHaveCount(0);
        await expect(selectedRecordingTitle(page, ACTION_RECORDING_TITLE)).toHaveText(
            ACTION_RECORDING_TITLE,
        );
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_RECORDING_TITLE);
        expect(patchPayloads).toEqual([]);

        await openDashboardRenameEditor(page);
        await page.getByLabel("录音标题").fill(ACTION_KEYBOARD_RENAMED_TITLE);
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${ACTION_RECORDING_ID}/rename`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            page.getByLabel("录音标题").press("Enter"),
        ]);
        await expect(
            selectedRecordingTitle(page, ACTION_KEYBOARD_RENAMED_TITLE),
        ).toHaveText(
            ACTION_KEYBOARD_RENAMED_TITLE,
        );
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_KEYBOARD_RENAMED_TITLE);

        await expect(page.getByRole("button", { name: "AI 重命名" })).toBeEnabled();
        await page.getByRole("button", { name: "AI 重命名" }).click();
        await expect(aiRenameDialog(page)).toBeVisible();
        await expect(dashboardAiRenamePanel(page))
            .toHaveAttribute("data-sot-state", "review");
        await expect(dashboardAiRenamePanel(page).locator(".airp-sub"))
            .toHaveText("仅本次预览，不会写回来源");
        await expect(dashboardAiRenamePanel(page).locator(".airp-label"))
            .toHaveText("复核确认");
        await expect(dashboardAiRenameReviewRow(page)).toBeVisible();
        await expect(
            dashboardAiRenameReviewRow(page).locator(".airp-review-line"),
        ).toHaveCount(2);
        await expect(
            dashboardAiRenameReviewRow(page).locator(".airp-review-tag"),
        ).toHaveText(["原标题", "新标题"]);
        await expect(
            dashboardAiRenameReviewRow(page).locator(".airp-review-old"),
        ).toHaveText(ACTION_KEYBOARD_RENAMED_TITLE);
        await expect(
            dashboardAiRenameReviewRow(page).locator(".airp-review-new"),
        ).toHaveText(
            "E2E dashboard AI preview discarded",
        );
        await expect(dashboardAiRenamePanel(page).locator(".airp-title"))
            .toHaveCount(0);
        await expect(
            selectedRecordingTitle(page, ACTION_KEYBOARD_RENAMED_TITLE),
        ).toHaveText(
            ACTION_KEYBOARD_RENAMED_TITLE,
        );
        await dashboardAiRenameAction(page, "取消").click();
        await expect(page.getByText("E2E dashboard AI preview discarded"))
            .toBeHidden();
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_KEYBOARD_RENAMED_TITLE);

        await page.getByRole("button", { name: "AI 重命名" }).click();
        await expect(aiRenameDialog(page)).toBeVisible();
        await expect(dashboardAiRenamePanel(page))
            .toHaveAttribute("data-sot-state", "review");
        await expect(
            dashboardAiRenameReviewRow(page).locator(".airp-review-old"),
        ).toHaveText(ACTION_KEYBOARD_RENAMED_TITLE);
        await expect(
            dashboardAiRenameReviewRow(page).locator(".airp-review-new"),
        ).toHaveText(ACTION_AI_RENAMED_TITLE);
        await dashboardAiRenameAction(page, "应用").click();
        await expect(selectedRecordingTitle(page, ACTION_AI_RENAMED_TITLE)).toHaveText(
            ACTION_AI_RENAMED_TITLE,
        );
        await expect(dashboardAiRenamePanel(page)).toHaveCount(0);
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_AI_RENAMED_TITLE);
        expect(previewPayloads).toEqual([
            { mode: "preview" },
            { mode: "preview" },
        ]);
        expect(patchPayloads).toEqual([
            { filename: ACTION_KEYBOARD_RENAMED_TITLE },
            { filename: ACTION_AI_RENAMED_TITLE },
        ]);
    } finally {
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});

test("dashboard AI rename header placement matches SOT pixels", async (
    { page },
    testInfo,
) => {
    let userId: string | null = null;
    let sotPage: Page | null = null;
    const placementTitle = "产品周会 · Q2 priorities review";
    const placementAiTitle = "产品周会 · 重点优先级与责任人";

    await mockTitleGenerationSettings(page, true);
    await page.route(
        `**/api/recordings/${ACTION_RECORDING_ID}/rename/auto`,
        async (route) => {
            expect(route.request().method()).toBe("POST");
            expect(route.request().postDataJSON()).toEqual({ mode: "preview" });
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    applied: false,
                    filename: placementAiTitle,
                }),
            });
        },
    );

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId, {
            filename: placementTitle,
            includeTranscript: true,
            upstreamDeleted: false,
        });

        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(placementTitle) })
            .click();
        await expect(selectedRecordingTitle(page, placementTitle)).toHaveText(
            placementTitle,
        );

        sotPage = await page.context().newPage();
        await openSotAiRenamePanel(sotPage, "review", {
            newTitle: placementAiTitle,
            oldTitle: placementTitle,
        });

        await dashboardRecordingHeader(page)
            .getByRole("button", { name: "AI 重命名", exact: true })
            .click();
        await expect(dashboardAiRenamePanel(page))
            .toHaveAttribute("data-sot-state", "review");
        await expect(
            dashboardAiRenameReviewRow(page).locator(".airp-review-old"),
        ).toHaveText(placementTitle);
        await expect(
            dashboardAiRenameReviewRow(page).locator(".airp-review-new"),
        ).toHaveText(placementAiTitle);

        await expectDashboardHeaderPlacementPixelMatch(
            page,
            testInfo,
            sotPage,
            "Dashboard AI rename review header placement",
            [580, 390],
        );
    } finally {
        await sotPage?.close();
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});

test("dashboard AI rename exposes loading, retry, and apply failure states", async ({
    page,
}, testInfo) => {
    type DeferredAutoRenameResponse = {
        body: { error: string };
        status: number;
    };
    let userId: string | null = null;
    let resolveFirstPreview: (response: DeferredAutoRenameResponse) => void =
        () => {};
    const firstPreviewResponse = new Promise<DeferredAutoRenameResponse>(
        (resolve) => {
            resolveFirstPreview = resolve;
        },
    );
    let previewAttempts = 0;
    let applyAttempts = 0;
    const retryTitle = "E2E dashboard AI retry title";
    const sotPage = await page.context().newPage();

    await mockTitleGenerationSettings(page, true);
    await page.route(
        `**/api/recordings/${ACTION_RECORDING_ID}/rename/auto`,
        async (route) => {
            expect(route.request().method()).toBe("POST");
            previewAttempts += 1;

            if (route.request().postDataJSON()?.mode !== "preview") {
                await route.fulfill({
                    contentType: "application/json",
                    status: 400,
                    body: JSON.stringify({ error: "preview mode required" }),
                });
                return;
            }

            if (previewAttempts === 1) {
                const response = await firstPreviewResponse;
                await route.fulfill({
                    contentType: "application/json",
                    status: response.status,
                    body: JSON.stringify(response.body),
                });
                return;
            }

            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ filename: retryTitle, applied: false }),
            });
        },
    );
    await page.route(
        `**/api/recordings/${ACTION_RECORDING_ID}/rename`,
        async (route) => {
            if (route.request().method() !== "PATCH") {
                await route.fallback();
                return;
            }

            applyAttempts += 1;
            if (applyAttempts === 1) {
                await route.fulfill({
                    contentType: "application/json",
                    status: 500,
                    body: JSON.stringify({
                        error: "Dashboard title writeback is unavailable",
                    }),
                });
                return;
            }

            await route.fallback();
        },
    );

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId, {
            includeTranscript: true,
        });

        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await expect(selectedRecordingTitle(page, ACTION_RECORDING_TITLE)).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        await page.getByRole("button", { name: "AI 重命名" }).click();
        await expect(aiRenameDialog(page)).toBeVisible();
        await expect(dashboardAiRenamePanel(page))
            .toHaveAttribute("data-sot-state", "loading");
        await expect(dashboardAiRenamePanel(page).locator(".airp-sub"))
            .toHaveText("仅本次预览，不会写回来源");
        await expect(aiRenameDialog(page)).toContainText(
            "正在根据转写生成标题…",
        );
        await expectDashboardAiRenamePixelMatch(
            page,
            testInfo,
            sotPage,
            "loading",
        );

        resolveFirstPreview({
            status: 503,
            body: { error: "Dashboard AI rename service unavailable" },
        });
        await expect(dashboardAiRenamePanel(page))
            .toHaveAttribute("data-sot-state", "error");
        await expect(
            aiRenameDialog(page).getByText(
                "这次没拿到结果，可能是转写太短或模型暂时不可用。",
            ),
        ).toBeVisible();
        await expect(
            aiRenameDialog(page).getByText(
                "Dashboard AI rename service unavailable",
            ),
        ).toHaveCount(0);
        await expectDashboardAiRenamePixelMatch(
            page,
            testInfo,
            sotPage,
            "error",
        );
        await expect(selectedRecordingTitle(page, ACTION_RECORDING_TITLE)).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        await dashboardAiRenameAction(page, "重试").click();
        await expect(dashboardAiRenamePanel(page))
            .toHaveAttribute("data-sot-state", "review");
        await expect(dashboardAiRenamePanel(page).locator(".airp-label"))
            .toHaveText("复核确认");
        await expect(
            dashboardAiRenameReviewRow(page).locator(".airp-review-new"),
        ).toHaveText(retryTitle);
        await expectDashboardAiRenamePixelMatch(page, testInfo, sotPage, "review", {
            newTitle: retryTitle,
            oldTitle: ACTION_RECORDING_TITLE,
        });

        await dashboardAiRenameAction(page, "应用").click();
        await expect(
            page
                .locator('.toast.toast-err')
                .filter({
                    hasText: "Dashboard title writeback is unavailable",
                }),
        ).toBeVisible();
        await expect(dashboardAiRenamePanel(page))
            .toHaveAttribute("data-sot-state", "review");
        await expect(
            dashboardAiRenameReviewRow(page).locator(".airp-review-new"),
        ).toHaveText(retryTitle);
        await expect(selectedRecordingTitle(page, ACTION_RECORDING_TITLE)).toHaveText(
            ACTION_RECORDING_TITLE,
        );
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_RECORDING_TITLE);

        await dashboardAiRenameAction(page, "应用").click();
        await expect(selectedRecordingTitle(page, retryTitle)).toHaveText(
            retryTitle,
        );
        await expect(dashboardAiRenamePanel(page)).toHaveCount(0);
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(retryTitle);
        expect(previewAttempts).toBe(2);
        expect(applyAttempts).toBe(2);
    } finally {
        await sotPage.close();
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});

test("dashboard AI rename unavailable service matches the SOT panel", async ({
    page,
}, testInfo) => {
    let userId: string | null = null;
    const sotPage = await page.context().newPage();

    await mockTitleGenerationSettings(page, false);

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId, {
            includeTranscript: true,
        });

        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();

        await page.getByRole("button", { name: "AI 重命名" }).click();
        await expect(aiRenameDialog(page)).toBeVisible();
        await expect(dashboardAiRenamePanel(page))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expect(aiRenameDialog(page))
            .toContainText("AI 重命名服务尚未配置或暂时不可用。");
        await expect(aiRenameDialog(page))
            .toContainText("前往设置 → AI 重命名服务以启用。");
        await expectDashboardAiRenamePixelMatch(
            page,
            testInfo,
            sotPage,
            "unavailable",
            {
                // Bottom rounded edge antialiasing can drift by one channel.
                edgeAntialiasTolerance: {
                    differingPixels: 4,
                    maxChannelDelta: 1,
                },
            },
        );
        await expect(dashboardAiRenameControl(page, "ai-rename-regenerate"))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expect(
            dashboardAiRenameControl(page, "ai-rename-regenerate"),
        ).toBeDisabled();
        await expect(dashboardAiRenameControl(page, "ai-rename-cancel"))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expect(dashboardAiRenameControl(page, "ai-rename-apply"))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expect(
            dashboardAiRenameControl(page, "ai-rename-apply"),
        ).toBeDisabled();
    } finally {
        await sotPage.close();
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});

test("dashboard AI rename configured service blocks recordings without transcripts", async ({
    page,
}) => {
    let userId: string | null = null;

    await mockTitleGenerationSettings(page, true);

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId, {
            includeTranscript: false,
        });

        await gotoHydratedDashboard(page);
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();

        await expect(
            page.locator('[data-sot-control="ai-rename"]'),
        ).toHaveAttribute("data-sot-state", "unavailable");
        await page.getByRole("button", { name: "AI 重命名" }).click();
        await expect(aiRenameDialog(page)).toBeVisible();
        await expect(aiRenameDialog(page)).toContainText("需要先生成本地转录");
        await expect(
            aiRenameDialog(page).getByRole("button", { name: "重新生成" }),
        ).toBeDisabled();
        await expect(
            aiRenameDialog(page).getByRole("button", { name: "应用" }),
        ).toBeDisabled();
    } finally {
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});
