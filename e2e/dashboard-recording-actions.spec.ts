import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const ACTION_RECORDING_ID = "e2e-dashboard-actions-recording";
const ACTION_TRANSCRIPT_ID = "e2e-dashboard-actions-transcript";
const ACTION_RECORDING_TITLE = "E2E dashboard actions source";
const ACTION_RENAMED_TITLE = "E2E dashboard actions renamed";
const ACTION_KEYBOARD_RENAMED_TITLE = "E2E dashboard keyboard renamed";
const ACTION_AI_RENAMED_TITLE = "E2E dashboard AI renamed";
const ACTION_TAG_NAME = "E2E操作标签";

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
            theme: "system",
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
    options: { includeTranscript?: boolean } = {},
) {
    const { includeTranscript = false } = options;
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
                "ticnote",
                "e2e-dashboard-actions-source",
                "1",
                "{}",
                "e2e-dashboard-actions-device",
                ACTION_RECORDING_TITLE,
                180_000,
                start,
                start + 180_000,
                1024,
                "e2e-dashboard-actions",
                "local",
                "",
                now,
                0,
                1,
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
    const renameTrigger = page.getByTestId("dashboard-rename-recording");
    const renameInput = page.getByTestId("dashboard-rename-input");

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

test("dashboard renames, tags, and deletes a local-only recording through the new UI", async ({
    page,
}) => {
    let userId: string | null = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        await openDashboardRenameEditor(page);
        await page
            .getByTestId("dashboard-rename-input")
            .fill(ACTION_RENAMED_TITLE);
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${ACTION_RECORDING_ID}/rename`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            page.getByTestId("dashboard-rename-save").click(),
        ]);
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            ACTION_RENAMED_TITLE,
        );
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_RENAMED_TITLE);

        await page.getByTestId("recording-tag-manager-trigger").click();
        await expect(page.getByTestId("recording-tag-manager")).toBeVisible();
        await page.getByTestId("recording-tag-create-input").fill(ACTION_TAG_NAME);
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
            page.getByTestId("recording-tag-create-submit").click(),
        ]);

        const selectedTag = page
            .locator('[data-testid="recording-tag-toggle"][aria-pressed="true"]')
            .filter({ hasText: ACTION_TAG_NAME });
        await expect(selectedTag).toBeVisible();
        await expect(page.getByTestId("recording-tag-manager-trigger"))
            .toContainText(ACTION_TAG_NAME);
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
        await expect(
            page.locator(
                '[data-testid="recording-tag-toggle"][aria-pressed="false"]',
            ).filter({ hasText: ACTION_TAG_NAME }),
        ).toBeVisible();
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).tags)
            .toEqual([]);

        await page
            .getByTestId("dashboard-detail-more-actions")
            .getByRole("button")
            .click();
        await expect(page.getByTestId("dashboard-detail-more-menu"))
            .toHaveAttribute("data-local-delete-available", "true");
        await page.getByTestId("dashboard-delete-local-recording").click();
        await expect(page.getByRole("dialog")).toContainText(
            ACTION_RENAMED_TITLE,
        );
        await page.getByRole("dialog").getByRole("button", { name: "取消" })
            .click();
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            ACTION_RENAMED_TITLE,
        );
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_RENAMED_TITLE);

        await page
            .getByTestId("dashboard-detail-more-actions")
            .getByRole("button")
            .click();
        await page.getByTestId("dashboard-delete-local-recording").click();
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${ACTION_RECORDING_ID}`) &&
                    response.request().method() === "DELETE" &&
                    response.ok(),
            ),
            page.getByRole("dialog").getByRole("button", { name: "确认" })
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

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        await openDashboardRenameEditor(page);
        await page
            .getByTestId("dashboard-rename-input")
            .fill("E2E dashboard escape should not save");
        await page.getByTestId("dashboard-rename-input").press("Escape");
        await expect(page.getByTestId("dashboard-rename-input")).toHaveCount(0);
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            ACTION_RECORDING_TITLE,
        );
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_RECORDING_TITLE);
        expect(patchPayloads).toEqual([]);

        await openDashboardRenameEditor(page);
        await page
            .getByTestId("dashboard-rename-input")
            .fill(ACTION_KEYBOARD_RENAMED_TITLE);
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${ACTION_RECORDING_ID}/rename`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            page.getByTestId("dashboard-rename-input").press("Enter"),
        ]);
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            ACTION_KEYBOARD_RENAMED_TITLE,
        );
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_KEYBOARD_RENAMED_TITLE);

        await expect(page.getByTestId("dashboard-ai-rename")).toBeEnabled();
        await page.getByTestId("dashboard-ai-rename").click();
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "review");
        await expect(page.getByText("E2E dashboard AI preview discarded"))
            .toBeVisible();
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            ACTION_KEYBOARD_RENAMED_TITLE,
        );
        await page.getByTestId("ai-rename-cancel").click();
        await expect(page.getByText("E2E dashboard AI preview discarded"))
            .toBeHidden();
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_KEYBOARD_RENAMED_TITLE);

        await page.getByTestId("dashboard-ai-rename").click();
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "review");
        await expect(page.getByText(ACTION_AI_RENAMED_TITLE)).toBeVisible();
        await page.getByTestId("ai-rename-apply").click();
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            ACTION_AI_RENAMED_TITLE,
        );
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "accepted");
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

test("dashboard AI rename exposes loading, retry, and apply failure states", async ({
    page,
}) => {
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

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        await page.getByTestId("dashboard-ai-rename").click();
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "loading");
        await expect(page.getByText("正在根据当前转写生成可预览的标题。"))
            .toBeVisible();

        resolveFirstPreview({
            status: 503,
            body: { error: "Dashboard AI rename service unavailable" },
        });
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "error");
        await expect(
            page
                .getByTestId("ai-rename-preview-card")
                .getByText("Dashboard AI rename service unavailable"),
        ).toBeVisible();
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            ACTION_RECORDING_TITLE,
        );

        await page.getByTestId("ai-rename-regenerate").click();
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "review");
        await expect(page.getByText(retryTitle)).toBeVisible();

        await page.getByTestId("ai-rename-apply").click();
        await expect(
            page
                .getByLabel("Notifications alt+T")
                .getByText("Dashboard title writeback is unavailable"),
        ).toBeVisible();
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "review");
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            ACTION_RECORDING_TITLE,
        );
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(ACTION_RECORDING_TITLE);

        await page.getByTestId("ai-rename-apply").click();
        await expect(page.getByTestId("dashboard-recording-title")).toHaveText(
            retryTitle,
        );
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "accepted");
        await expect
            .poll(async () => (await getRecordingSnapshot(userId ?? "")).filename)
            .toBe(retryTitle);
        expect(previewAttempts).toBe(2);
        expect(applyAttempts).toBe(2);
    } finally {
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});

test("dashboard AI rename unavailable service opens title generation settings", async ({
    page,
}) => {
    let userId: string | null = null;

    await mockTitleGenerationSettings(page, false);

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await resetDisplayToChinese(page);
        await seedDashboardActionRecording(userId, {
            includeTranscript: true,
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();

        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "unavailable");
        await page.getByTestId("ai-rename-open-settings").click();
        await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
            "data-settings-active-section",
            "title-generation",
        );
        await expect(page).toHaveURL(/\/dashboard#title-generation$/);
    } finally {
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

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: new RegExp(ACTION_RECORDING_TITLE) })
            .click();

        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "unavailable");
        await expect(
            page
                .getByTestId("ai-rename-preview-card")
                .getByText("需要先生成本地转录"),
        ).toBeVisible();
        await expect(page.getByTestId("ai-rename-open-settings")).toHaveCount(
            0,
        );
        await expect(page.getByTestId("dashboard-ai-rename")).toBeDisabled();
    } finally {
        await cleanupDashboardActionSeed(userId ?? undefined);
    }
});
