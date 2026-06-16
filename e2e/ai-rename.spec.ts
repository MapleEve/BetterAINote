import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import { SOT_WORKSTATION_URL } from "./helpers/sot-fixtures";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const AI_RENAME_RECORDING_ID = "e2e-ai-rename-recording";
const AI_RENAME_TRANSCRIPT_ID = "e2e-ai-rename-transcript";
const ORIGINAL_TITLE = "E2E AI rename source title";

type AiRenameSotState = "loading" | "review" | "error" | "unavailable";

type AiRenamePixelDiff = {
    bounds: { maxX: number; maxY: number; minX: number; minY: number } | null;
    differingPixels: number;
    dimensionsMatch: boolean;
    expectedHeight: number;
    expectedWidth: number;
    maxChannelDelta: number;
    productHeight: number;
    productWidth: number;
};

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

function databaseUrl(filePath: string) {
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");

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

async function cleanupAiRenameSeed() {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE id = ? OR recording_id = ?",
            args: [AI_RENAME_TRANSCRIPT_ID, AI_RENAME_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE recording_id = ?",
            args: [AI_RENAME_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE id = ?",
            args: [AI_RENAME_RECORDING_ID],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedAiRenameRecording(
    userId: string,
    options: { includeTranscript?: boolean } = {},
) {
    const { includeTranscript = true } = options;
    const now = Date.now();
    const start = now - 3_600_000;
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await cleanupAiRenameSeed();
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
                AI_RENAME_RECORDING_ID,
                userId,
                "ticnote",
                "e2e-ai-rename-source",
                "1",
                "{}",
                "e2e-device",
                ORIGINAL_TITLE,
                180_000,
                start,
                start + 180_000,
                2048,
                "e2e-ai-rename",
                "local",
                "",
                now,
                0,
                0,
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
                    AI_RENAME_TRANSCRIPT_ID,
                    AI_RENAME_RECORDING_ID,
                    userId,
                    "Speaker 1: AI rename review gate must not overwrite before confirmation.",
                    "en",
                    "server",
                    "voice-transcribe",
                    "e2e",
                    "remote-e2e-ai-rename",
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

function recordingWorkstation(page: Page) {
    return page.locator('[data-sot-surface="recording-workstation"]');
}

async function waitForRecordingWorkstationReady(page: Page) {
    await expect(recordingWorkstation(page)).toHaveAttribute(
        "data-sot-state",
        "ready",
    );
}

function aiRenameTrigger(page: Page) {
    return recordingWorkstation(page)
        .getByRole("button", { name: "AI 重命名", exact: true })
        .first();
}

function aiRenamePreview(page: Page) {
    return page.locator('[data-sot-panel="ai-rename-preview"]');
}

function aiRenameReviewRow(page: Page) {
    return aiRenamePreview(page).locator(".airp-review-row");
}

function aiRenameControl(page: Page, control: string) {
    return aiRenamePreview(page).locator(`[data-sot-control="${control}"]`);
}

function aiRenameAction(page: Page, name: string) {
    return aiRenamePreview(page).getByRole("button", { name, exact: true });
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

async function captureAiRenamePanel(locator: Locator) {
    await expect(locator).toBeVisible();
    const html = await locator.evaluate((element) => element.outerHTML);
    const page = locator.page();
    const fixtureId = `ai-rename-pixel-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ fixtureHtml, fixtureId: id }) => {
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

            const stableAnimationStyle = document.createElement("style");
            stableAnimationStyle.textContent =
                ".ai-rename-pixel-stage .airp-spinner{animation:none!important;transform:rotate(0deg)!important}";
            host.appendChild(stableAnimationStyle);

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
        { fixtureHtml: html, fixtureId },
    );

    const stage = page.locator(`#${fixtureId} > .ai-rename-pixel-stage`).first();
    const root = page.locator(`#${fixtureId} .ai-rename-panel`).first();
    await expect(root).toBeVisible();
    await page.waitForTimeout(100);
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
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
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        metrics,
        screenshot,
    };
}

async function compareAiRenamePixels(
    page: Page,
    expected: string,
    actual: string,
): Promise<AiRenamePixelDiff> {
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

async function expectAiRenamePixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: AiRenameSotState,
    options: { newTitle?: string; oldTitle?: string } = {},
) {
    await openSotAiRenamePanel(sotPage, state, options);
    const sotPanel = sotPage.locator("[data-rh-ai-panel]").first();
    const productPanel = aiRenamePreview(page).first();
    const [sotCapture, productCapture] = await Promise.all([
        captureAiRenamePanel(sotPanel),
        captureAiRenamePanel(productPanel),
    ]);
    const diff = await compareAiRenamePixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels !== 0 ||
        diff.maxChannelDelta !== 0
    ) {
        await testInfo.attach(`ai-rename-${state}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`ai-rename-${state}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`ai-rename-${state}-diff.json`, {
            body: Buffer.from(
                JSON.stringify(
                    {
                        diff,
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

    const label = `AI rename ${state} ${JSON.stringify(diff)}`;
    expect(diff.dimensionsMatch, label).toBe(true);
    expect(diff.productHeight, label).toBe(diff.expectedHeight);
    expect(diff.productWidth, label).toBe(diff.expectedWidth);
    expect(diff.differingPixels, label).toBe(0);
    expect(diff.maxChannelDelta, label).toBe(0);
}

test("AI rename keeps generated titles behind review, cancel, regenerate, and apply", async ({
    page,
}) => {
    const previewPayloads: unknown[] = [];
    const patchPayloads: unknown[] = [];
    const generatedTitles = [
        "2026-05-31 1015 Design Review Draft",
        "2026-05-31 1015 Design Review Regenerated",
        "2026-05-31 1015 Design Review Final",
    ];
    let generatedIndex = 0;

    await mockTitleGenerationSettings(page, true);
    await page.route(
        `**/api/recordings/${AI_RENAME_RECORDING_ID}/rename/auto`,
        async (route) => {
            expect(route.request().method()).toBe("POST");
            previewPayloads.push(route.request().postDataJSON());
            const filename =
                generatedTitles[
                    Math.min(generatedIndex, generatedTitles.length - 1)
                ];
            generatedIndex += 1;
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ filename, applied: false }),
            });
        },
    );
    await page.route(
        `**/api/recordings/${AI_RENAME_RECORDING_ID}/rename`,
        async (route) => {
            expect(route.request().method()).toBe("PATCH");
            const payload = route.request().postDataJSON();
            patchPayloads.push(payload);
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    recording: {
                        id: AI_RENAME_RECORDING_ID,
                        filename:
                            typeof payload?.filename === "string"
                                ? payload.filename
                                : ORIGINAL_TITLE,
                    },
                }),
            });
        },
    );

    try {
        await ensureSignedIn(page);
        await resetDisplayToChinese(page);
        await seedAiRenameRecording(await getPlaywrightUserId());

        await page.goto(`/recordings/${AI_RENAME_RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingWorkstationReady(page);
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();

        await expect(aiRenameTrigger(page)).toBeEnabled();
        await aiRenameTrigger(page).click();
        await expect(aiRenamePreview(page))
            .toHaveAttribute("data-sot-state", "review");
        await expect(aiRenameControl(page, "ai-rename-close"))
            .toHaveAttribute("data-sot-state", "review");
        await expect(aiRenameControl(page, "ai-rename-regenerate"))
            .toHaveAttribute("data-sot-state", "review");
        await expect(aiRenameControl(page, "ai-rename-cancel"))
            .toHaveAttribute("data-sot-state", "review");
        await expect(aiRenameControl(page, "ai-rename-apply"))
            .toHaveAttribute("data-sot-state", "review");
        await expect(aiRenamePreview(page).locator(".airp-sub"))
            .toHaveText("仅本次预览，不会写回来源");
        await expect(aiRenamePreview(page).locator(".airp-label"))
            .toHaveText("复核确认");
        await expect(aiRenameReviewRow(page)).toBeVisible();
        await expect(
            aiRenameReviewRow(page).locator(".airp-review-line"),
        ).toHaveCount(2);
        await expect(
            aiRenameReviewRow(page).locator(".airp-review-tag"),
        ).toHaveText(["原标题", "新标题"]);
        await expect(
            aiRenameReviewRow(page).locator(".airp-review-tag.is-new"),
        ).toHaveText("新标题");
        await expect(
            aiRenameReviewRow(page).locator(".airp-review-old"),
        ).toHaveText(ORIGINAL_TITLE);
        await expect(
            aiRenameReviewRow(page).locator(".airp-review-new"),
        ).toHaveText(generatedTitles[0]);
        await expect(aiRenamePreview(page).locator(".airp-title"))
            .toHaveCount(0);
        await expect(
            aiRenamePreview(page).getByText(
                "确认无误后点击「应用」，将替换录音标题且不可一键撤销。",
            ),
        ).toBeVisible();
        await expect(aiRenameAction(page, "取消")).toBeVisible();
        await expect(aiRenameAction(page, "应用")).toBeVisible();
        await expect(page.getByText(generatedTitles[0])).toBeVisible();
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();
        expect(previewPayloads).toEqual([{ mode: "preview" }]);
        expect(patchPayloads).toEqual([]);

        await aiRenameAction(page, "重新生成").click();
        await expect(page.getByText(generatedTitles[1])).toBeVisible();
        await expect(aiRenameControl(page, "ai-rename-regenerate"))
            .toHaveAttribute("data-sot-state", "review");
        await expect(aiRenameControl(page, "ai-rename-apply"))
            .toHaveAttribute("data-sot-state", "review");
        await expect(
            aiRenameReviewRow(page).locator(".airp-review-old"),
        ).toHaveText(ORIGINAL_TITLE);
        await expect(
            aiRenameReviewRow(page).locator(".airp-review-new"),
        ).toHaveText(generatedTitles[1]);
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();
        expect(previewPayloads).toEqual([
            { mode: "preview" },
            { mode: "preview" },
        ]);
        expect(patchPayloads).toEqual([]);

        await aiRenameAction(page, "取消").click();
        await expect(aiRenamePreview(page)).toHaveCount(0);
        await expect(page.getByText(generatedTitles[1])).toBeHidden();
        expect(patchPayloads).toEqual([]);

        await aiRenameTrigger(page).click();
        await expect(page.getByText(generatedTitles[2])).toBeVisible();
        await expect(aiRenameControl(page, "ai-rename-apply"))
            .toHaveAttribute("data-sot-state", "review");
        await aiRenameAction(page, "应用").click();
        await expect(page.getByRole("heading", { name: generatedTitles[2] }))
            .toBeVisible();
        await expect(aiRenamePreview(page)).toHaveCount(0);
        expect(previewPayloads).toEqual([
            { mode: "preview" },
            { mode: "preview" },
            { mode: "preview" },
        ]);
        expect(patchPayloads).toEqual([{ filename: generatedTitles[2] }]);
    } finally {
        await cleanupAiRenameSeed();
    }
});

test("AI rename exposes loading, error, retry, and apply failure states", async ({
    page,
}) => {
    type DeferredAutoRenameResponse = {
        body: { error: string };
        status: number;
    };
    let resolveFirstPreview: (response: DeferredAutoRenameResponse) => void =
        () => {};
    const firstPreviewResponse = new Promise<DeferredAutoRenameResponse>(
        (resolve) => {
            resolveFirstPreview = resolve;
        },
    );
    let previewAttempts = 0;
    let applyAttempts = 0;
    const retryTitle = "2026-05-31 1200 Retry Generated Title";

    await mockTitleGenerationSettings(page, true);
    await page.route(
        `**/api/recordings/${AI_RENAME_RECORDING_ID}/rename/auto`,
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
        `**/api/recordings/${AI_RENAME_RECORDING_ID}/rename`,
        async (route) => {
            expect(route.request().method()).toBe("PATCH");
            applyAttempts += 1;

            if (applyAttempts === 1) {
                await route.fulfill({
                    contentType: "application/json",
                    status: 500,
                    body: JSON.stringify({
                        error: "Title writeback is temporarily unavailable",
                    }),
                });
                return;
            }

            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    recording: {
                        id: AI_RENAME_RECORDING_ID,
                        filename: retryTitle,
                    },
                }),
            });
        },
    );

    try {
        await ensureSignedIn(page);
        await resetDisplayToChinese(page);
        await seedAiRenameRecording(await getPlaywrightUserId());

        await page.goto(`/recordings/${AI_RENAME_RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingWorkstationReady(page);
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();

        await aiRenameTrigger(page).click();
        await expect(aiRenamePreview(page))
            .toHaveAttribute("data-sot-state", "loading");
        await expect(aiRenameControl(page, "ai-rename-close"))
            .toHaveAttribute("data-sot-state", "loading");
        await expect(aiRenamePreview(page).locator(".airp-sub"))
            .toHaveText("仅本次预览，不会写回来源");
        await expect(page.getByText("正在根据转写生成标题…"))
            .toBeVisible();

        resolveFirstPreview({
            status: 503,
            body: { error: "AI rename service temporarily unavailable" },
        });
        await expect(aiRenamePreview(page))
            .toHaveAttribute("data-sot-state", "error");
        await expect(aiRenameControl(page, "ai-rename-regenerate"))
            .toHaveAttribute("data-sot-state", "error");
        await expect(
            aiRenamePreview(page).getByText(
                "这次没拿到结果，可能是转写太短或模型暂时不可用。",
            ),
        ).toBeVisible();
        await expect(aiRenameAction(page, "重试")).toBeVisible();
        await expect(
            aiRenamePreview(page).getByText(
                "AI rename service temporarily unavailable",
            ),
        ).toHaveCount(0);
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();

        await aiRenameAction(page, "重试").click();
        await expect(aiRenamePreview(page))
            .toHaveAttribute("data-sot-state", "review");
        await expect(aiRenameControl(page, "ai-rename-regenerate"))
            .toHaveAttribute("data-sot-state", "review");
        await expect(aiRenameControl(page, "ai-rename-apply"))
            .toHaveAttribute("data-sot-state", "review");
        await expect(page.getByText(retryTitle)).toBeVisible();
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();

        await aiRenameAction(page, "应用").click();
        await expect(
            page
                .locator('.toast.toast-err')
                .filter({
                    hasText: "Title writeback is temporarily unavailable",
                }),
        ).toBeVisible();
        await expect(aiRenamePreview(page))
            .toHaveAttribute("data-sot-state", "review");
        await expect(aiRenameControl(page, "ai-rename-apply"))
            .toHaveAttribute("data-sot-state", "review");
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();

        await aiRenameAction(page, "应用").click();
        await expect(page.getByRole("heading", { name: retryTitle }))
            .toBeVisible();
        await expect(aiRenamePreview(page)).toHaveCount(0);
        expect(applyAttempts).toBe(2);
    } finally {
        await cleanupAiRenameSeed();
    }
});

test("AI rename detail loading, error, and review states match SOT runtime pixels", async ({
    page,
}, testInfo) => {
    type DeferredAutoRenameResponse = {
        body: { error: string };
        status: number;
    };
    let resolveFirstPreview: (response: DeferredAutoRenameResponse) => void =
        () => {};
    const firstPreviewResponse = new Promise<DeferredAutoRenameResponse>(
        (resolve) => {
            resolveFirstPreview = resolve;
        },
    );
    let previewAttempts = 0;
    const retryTitle = "E2E AI rename pixel retry title";
    const sotPage = await page.context().newPage();

    await mockTitleGenerationSettings(page, true);
    await page.route(
        `**/api/recordings/${AI_RENAME_RECORDING_ID}/rename/auto`,
        async (route) => {
            previewAttempts += 1;
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

    try {
        await ensureSignedIn(page);
        await resetDisplayToChinese(page);
        await seedAiRenameRecording(await getPlaywrightUserId());

        await page.goto(`/recordings/${AI_RENAME_RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingWorkstationReady(page);
        await aiRenameTrigger(page).click();
        await expect(aiRenamePreview(page))
            .toHaveAttribute("data-sot-state", "loading");
        await expectAiRenamePixelMatch(page, testInfo, sotPage, "loading");

        resolveFirstPreview({
            status: 503,
            body: { error: "AI rename service temporarily unavailable" },
        });
        await expect(aiRenamePreview(page))
            .toHaveAttribute("data-sot-state", "error");
        await expectAiRenamePixelMatch(page, testInfo, sotPage, "error");

        await aiRenameAction(page, "重试").click();
        await expect(aiRenamePreview(page))
            .toHaveAttribute("data-sot-state", "review");
        await expectAiRenamePixelMatch(page, testInfo, sotPage, "review", {
            newTitle: retryTitle,
            oldTitle: ORIGINAL_TITLE,
        });
    } finally {
        await sotPage.close();
        await cleanupAiRenameSeed();
    }
});

test("AI rename unavailable service state matches the SOT panel", async ({
    page,
}) => {
    await mockTitleGenerationSettings(page, false);

    try {
        await ensureSignedIn(page);
        await resetDisplayToChinese(page);
        await seedAiRenameRecording(await getPlaywrightUserId());

        await page.goto(`/recordings/${AI_RENAME_RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingWorkstationReady(page);

        await expect(aiRenameTrigger(page))
            .toHaveAttribute("data-sot-state", "unavailable");
        await aiRenameTrigger(page).click();
        await expect(aiRenamePreview(page))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expect(aiRenameControl(page, "ai-rename-close"))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expect(aiRenamePreview(page))
            .toContainText("AI 重命名服务尚未配置或暂时不可用。");
        await expect(aiRenamePreview(page))
            .toContainText("前往设置 → AI 重命名服务以启用。");
        await expect(aiRenameControl(page, "ai-rename-regenerate"))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expect(aiRenameControl(page, "ai-rename-regenerate"))
            .toBeDisabled();
        await expect(aiRenameControl(page, "ai-rename-cancel"))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expect(aiRenameControl(page, "ai-rename-apply"))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expect(aiRenameControl(page, "ai-rename-apply")).toBeDisabled();
    } finally {
        await cleanupAiRenameSeed();
    }
});

test("AI rename unavailable service state matches SOT runtime pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();

    await mockTitleGenerationSettings(page, false);

    try {
        await ensureSignedIn(page);
        await resetDisplayToChinese(page);
        await seedAiRenameRecording(await getPlaywrightUserId());

        await page.goto(`/recordings/${AI_RENAME_RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingWorkstationReady(page);
        await aiRenameTrigger(page).click();
        await expect(aiRenamePreview(page))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expectAiRenamePixelMatch(page, testInfo, sotPage, "unavailable");
    } finally {
        await sotPage.close();
        await cleanupAiRenameSeed();
    }
});

test("AI rename configured service still blocks recordings without transcripts", async ({
    page,
}) => {
    await mockTitleGenerationSettings(page, true);

    try {
        await ensureSignedIn(page);
        await resetDisplayToChinese(page);
        await seedAiRenameRecording(await getPlaywrightUserId(), {
            includeTranscript: false,
        });

        await page.goto(`/recordings/${AI_RENAME_RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        await waitForRecordingWorkstationReady(page);

        await expect(aiRenameTrigger(page))
            .toHaveAttribute("data-sot-state", "unavailable");
        await aiRenameTrigger(page).click();
        await expect(aiRenamePreview(page))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expect(
            aiRenamePreview(page).getByText("需要先生成本地转录"),
        ).toBeVisible();
        await expect(aiRenameControl(page, "ai-rename-regenerate"))
            .toHaveAttribute("data-sot-state", "unavailable");
        await expect(aiRenameControl(page, "ai-rename-regenerate"))
            .toBeDisabled();
        await expect(aiRenameControl(page, "ai-rename-apply")).toBeDisabled();
    } finally {
        await cleanupAiRenameSeed();
    }
});
