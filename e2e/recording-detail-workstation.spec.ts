import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const DETAIL_RECORDING_ID = "e2e-detail-recording";
const DETAIL_TRANSCRIPT_ID = "e2e-detail-transcript";

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

async function cleanupRecordingDetailSeed() {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE recording_id = ?",
            args: [DETAIL_RECORDING_ID],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE id = ? OR recording_id = ?",
            args: [DETAIL_TRANSCRIPT_ID, DETAIL_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE recording_id = ?",
            args: [DETAIL_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE id = ?",
            args: [DETAIL_RECORDING_ID],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

type RecordingDetailSeedOptions = {
    includeSourceTranscript?: boolean;
    includeSourceSummary?: boolean;
    includeSourceDetail?: boolean;
    storagePath?: string;
};

async function seedRecordingDetail(
    userId: string,
    options: RecordingDetailSeedOptions = {},
) {
    const {
        includeSourceDetail = true,
        includeSourceSummary = true,
        includeSourceTranscript = true,
        storagePath = "",
    } = options;
    const now = Date.now();
    const start = now - 7_200_000;
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await cleanupRecordingDetailSeed();
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
                DETAIL_RECORDING_ID,
                userId,
                "ticnote",
                "e2e-detail-source",
                "1",
                "{}",
                "e2e-device",
                "E2E source detail review",
                240_000,
                start,
                start + 240_000,
                4096,
                "e2e-detail",
                "local",
                storagePath,
                now,
                0,
                0,
                now,
                now,
            ],
        });
        await transcripts.execute({
            sql: `
                INSERT OR REPLACE INTO transcriptions (
                    id, recording_id, user_id, text, detected_language,
                    transcription_type, provider, model, provider_job_id,
                    speaker_map, provider_payload, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                DETAIL_TRANSCRIPT_ID,
                DETAIL_RECORDING_ID,
                userId,
                "Speaker 1: 本地转写复制内容。\nSpeaker 2: UI 验收必须保留。",
                "zh",
                "server",
                "voice-transcribe",
                "e2e",
                "remote-e2e-detail",
                "{}",
                "{}",
                now - 120_000,
            ],
        });
        if (includeSourceTranscript) {
            await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    "e2e-detail-source-transcript",
                    DETAIL_RECORDING_ID,
                    userId,
                    "ticnote",
                    "official-transcript",
                    "来源逐字稿",
                    "Speaker 1: 来源逐字稿复制内容。",
                    null,
                    JSON.stringify({
                        language: "zh-CN",
                        segments: [
                            {
                                speaker: "Speaker 1",
                                startMs: 0,
                                endMs: 15_000,
                                text: "来源逐字稿复制内容。",
                            },
                        ],
                    }),
                    now - 90_000,
                    now - 90_000,
                ],
            });
        }
        if (includeSourceSummary) {
            await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    "e2e-detail-source-summary",
                    DETAIL_RECORDING_ID,
                    userId,
                    "ticnote",
                    "official-summary",
                    "来源报告",
                    null,
                    "## E2E 源报告摘要\n\n- 录音详情页自动加载来源报告。",
                    "{}",
                    now - 80_000,
                    now - 80_000,
                ],
            });
        }
        if (includeSourceDetail) {
            await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    "e2e-detail-source-detail",
                    DETAIL_RECORDING_ID,
                    userId,
                    "ticnote",
                    "official-detail",
                    "来源详情",
                    null,
                    null,
                    JSON.stringify({ language: "zh-CN" }),
                    now - 70_000,
                    now - 70_000,
                ],
            });
        }
    } finally {
        await library.close();
        await transcripts.close();
    }

    return DETAIL_RECORDING_ID;
}

async function installClipboardCapture(page: Page) {
    await page.addInitScript(() => {
        const copiedTexts: string[] = [];
        Object.defineProperty(window, "__betterainoteCopiedTexts", {
            value: copiedTexts,
            configurable: true,
        });
        Object.defineProperty(navigator, "clipboard", {
            value: {
                writeText: async (text: string) => {
                    copiedTexts.push(String(text));
                },
            },
            configurable: true,
        });
    });
}

async function readCopiedTexts(page: Page) {
    return page.evaluate(
        () =>
            (
                window as unknown as {
                    __betterainoteCopiedTexts: string[];
                }
            ).__betterainoteCopiedTexts,
    );
}

test("recording detail uses the new workstation shell and keeps all copy actions live", async ({
    page,
}) => {
    await installClipboardCapture(page);

    let recordingId = DETAIL_RECORDING_ID;

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        recordingId = await seedRecordingDetail(userId);

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });

        await expect(
            page.getByTestId("recording-detail-workstation"),
        ).toBeVisible();
        await expect(
            page.getByTestId("recording-detail-copy-strip"),
        ).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "E2E source detail review" }),
        ).toBeVisible();
        await expect(page.getByText("E2E 源报告摘要")).toBeVisible();
        await expect(
            page.getByTestId("source-report-segment-timestamp"),
        ).toContainText("0:00 - 0:15");

        await page.getByTestId("recording-copy-local-transcript").click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("本地转写复制内容");

        await page.getByTestId("recording-copy-source-transcript").click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("来源逐字稿复制内容");
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("0:00 - 0:15 · Speaker 1");

        await page.getByTestId("recording-copy-source-report").click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (
                            window as unknown as {
                                __betterainoteCopiedTexts: string[];
                            }
                        ).__betterainoteCopiedTexts.at(-1) ?? "",
                ),
            )
            .toContain("E2E 源报告摘要");
    } finally {
        await cleanupRecordingDetailSeed();
    }
});

test("recording detail source copy guards missing artifacts without writing empty clipboard", async ({
    page,
}) => {
    await installClipboardCapture(page);

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSourceDetail: false,
            includeSourceSummary: false,
            includeSourceTranscript: false,
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });

        await expect(
            page.getByTestId("source-report-loaded"),
        ).toHaveAttribute("data-source-report-state", "missing");
        await expect(
            page.getByTestId("source-report-no-audio-warning"),
        ).toBeVisible();
        await expect(
            page.getByTestId("source-report-transcript-status"),
        ).toHaveText("缺失");
        await expect(
            page.getByTestId("source-report-summary-status"),
        ).toHaveText("缺失");
        await expect(
            page.getByTestId("source-report-missing-transcript"),
        ).toBeVisible();
        await expect(
            page.getByTestId("source-report-missing-report"),
        ).toBeVisible();
        await expect(
            page.getByTestId("source-report-copy-transcript"),
        ).toBeDisabled();
        await expect(
            page.getByTestId("source-report-copy-report"),
        ).toBeDisabled();

        await page.getByTestId("recording-copy-source-transcript").click();
        await expect(
            page
                .getByLabel("Notifications alt+T")
                .getByText("这个来源暂时没有可复制的原始转录。"),
        ).toBeVisible();
        expect(await readCopiedTexts(page)).toEqual([]);

        await page.getByTestId("recording-copy-source-report").click();
        await expect(
            page
                .getByLabel("Notifications alt+T")
                .getByText("这个来源暂时没有可复制的原始报告。"),
        ).toBeVisible();
        expect(await readCopiedTexts(page)).toEqual([]);

        await expect(
            page.getByTestId("source-report-upstream-open"),
        ).toHaveCount(0);
        await expect(page.getByTestId("source-report-repull")).toHaveCount(0);
    } finally {
        await cleanupRecordingDetailSeed();
    }
});
