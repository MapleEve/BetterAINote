import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const AI_RENAME_RECORDING_ID = "e2e-ai-rename-recording";
const AI_RENAME_TRANSCRIPT_ID = "e2e-ai-rename-transcript";
const ORIGINAL_TITLE = "E2E AI rename source title";

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
            theme: "system",
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
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();

        await expect(page.getByTestId("recording-ai-rename")).toBeEnabled();
        await page.getByTestId("recording-ai-rename").click();
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "review");
        await expect(page.getByText(generatedTitles[0])).toBeVisible();
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();
        expect(previewPayloads).toEqual([{ mode: "preview" }]);
        expect(patchPayloads).toEqual([]);

        await page.getByTestId("ai-rename-regenerate").click();
        await expect(page.getByText(generatedTitles[1])).toBeVisible();
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();
        expect(previewPayloads).toEqual([
            { mode: "preview" },
            { mode: "preview" },
        ]);
        expect(patchPayloads).toEqual([]);

        await page.getByTestId("ai-rename-cancel").click();
        await expect(page.getByText(generatedTitles[1])).toBeHidden();
        expect(patchPayloads).toEqual([]);

        await page.getByTestId("recording-ai-rename").click();
        await expect(page.getByText(generatedTitles[2])).toBeVisible();
        await page.getByTestId("ai-rename-apply").click();
        await expect(page.getByRole("heading", { name: generatedTitles[2] }))
            .toBeVisible();
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
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();

        await page.getByTestId("recording-ai-rename").click();
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "loading");
        await expect(page.getByText("正在根据当前转写生成可预览的标题。"))
            .toBeVisible();

        resolveFirstPreview({
            status: 503,
            body: { error: "AI rename service temporarily unavailable" },
        });
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "error");
        await expect(
            page
                .getByTestId("ai-rename-preview-card")
                .getByText("AI rename service temporarily unavailable"),
        ).toBeVisible();
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();

        await page.getByTestId("ai-rename-regenerate").click();
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "review");
        await expect(page.getByText(retryTitle)).toBeVisible();
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();

        await page.getByTestId("ai-rename-apply").click();
        await expect(
            page
                .getByLabel("Notifications alt+T")
                .getByText("Title writeback is temporarily unavailable"),
        ).toBeVisible();
        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "review");
        await expect(page.getByRole("heading", { name: ORIGINAL_TITLE }))
            .toBeVisible();

        await page.getByTestId("ai-rename-apply").click();
        await expect(page.getByRole("heading", { name: retryTitle }))
            .toBeVisible();
        expect(applyAttempts).toBe(2);
    } finally {
        await cleanupAiRenameSeed();
    }
});

test("AI rename unavailable service state opens title generation settings", async ({
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

        await expect(page.getByTestId("ai-rename-preview-card"))
            .toHaveAttribute("data-ai-rename-state", "unavailable");
        await page.getByTestId("ai-rename-open-settings").click();
        await expect(page.locator("[data-settings-shell]")).toHaveAttribute(
            "data-settings-active-section",
            "title-generation",
        );
        await expect(page).toHaveURL(/\/settings#title-generation$/);
    } finally {
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
        await expect(page.getByTestId("recording-ai-rename")).toBeDisabled();
    } finally {
        await cleanupAiRenameSeed();
    }
});
