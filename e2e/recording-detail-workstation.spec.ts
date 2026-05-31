import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const DETAIL_RECORDING_ID = "e2e-detail-recording";
const DETAIL_TRANSCRIPT_ID = "e2e-detail-transcript";
const SPEAKER_REVIEW_PROFILE_ZH_ID = "e2e-speaker-profile-zh";
const SPEAKER_REVIEW_PROFILE_LATIN_ID = "e2e-speaker-profile-latin";
const SPEAKER_REVIEW_PROFILE_ZH_NAME = "张三丰产品评审会议长名字 Alpha";
const SPEAKER_REVIEW_PROFILE_LATIN_NAME = "Long Latin Reviewer Name Example";
const SPEAKER_REVIEW_CREATED_NAME = "新建说话人 Alpha Beta 超长名字";

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
const VOICEPRINTS_DB = deriveSiblingDatabasePath(CORE_DB, "voiceprints");

function assertE2EDatabasePath(filePath: string) {
    const e2eRoot = path.resolve(process.cwd(), "tmp/e2e");
    const resolved = path.resolve(filePath);

    if (!resolved.startsWith(`${e2eRoot}${path.sep}`)) {
        throw new Error(`Refusing to mutate non-E2E database path: ${resolved}`);
    }
}

for (const databasePath of [CORE_DB, LIBRARY_DB, TRANSCRIPTS_DB, VOICEPRINTS_DB]) {
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

async function cleanupRecordingDetailSeed() {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });

    try {
        await voiceprints.execute({
            sql: "DELETE FROM recording_speakers WHERE recording_id = ?",
            args: [DETAIL_RECORDING_ID],
        });
        await voiceprints.execute({
            sql: `
                DELETE FROM speaker_profiles
                WHERE id IN (?, ?) OR display_name = ?
            `,
            args: [
                SPEAKER_REVIEW_PROFILE_ZH_ID,
                SPEAKER_REVIEW_PROFILE_LATIN_ID,
                SPEAKER_REVIEW_CREATED_NAME,
            ],
        });
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
        await voiceprints.close();
    }
}

type RecordingDetailSeedOptions = {
    includeSourceTranscript?: boolean;
    includeSourceSummary?: boolean;
    includeSourceDetail?: boolean;
    storagePath?: string;
    includeSpeakerReview?: boolean;
};

async function seedRecordingDetail(
    userId: string,
    options: RecordingDetailSeedOptions = {},
) {
    const {
        includeSourceDetail = true,
        includeSourceSummary = true,
        includeSourceTranscript = true,
        includeSpeakerReview = false,
        storagePath = "",
    } = options;
    const now = Date.now();
    const start = now - 7_200_000;
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });
    const speakerReviewTranscript =
        "SPEAKER_ALPHA_00: 第一段中文说话人内容需要在窄屏保持可读。\nSPEAKER_BETA_01: Latin speaker review content for mapping.";
    const speakerReviewPayload = {
        id: "e2e-speaker-review-job",
        status: "completed",
        filename: "speaker-review.wav",
        createdAt: new Date(now - 120_000).toISOString(),
        language: "zh",
        segments: [
            {
                id: 1,
                start: 0,
                end: 3.2,
                text: "第一段中文说话人内容需要在窄屏保持可读。",
                speakerLabel: "SPEAKER_ALPHA_00",
                speakerId: SPEAKER_REVIEW_PROFILE_ZH_ID,
                speakerName: SPEAKER_REVIEW_PROFILE_ZH_NAME,
                similarity: 0.96,
                hasOverlap: false,
            },
            {
                id: 2,
                start: 4,
                end: 8,
                text: "Latin speaker review content for mapping.",
                speakerLabel: "SPEAKER_BETA_01",
                speakerId: null,
                speakerName: null,
                similarity: null,
                hasOverlap: false,
            },
        ],
        speakerMap: {
            SPEAKER_ALPHA_00: {
                matchedId: SPEAKER_REVIEW_PROFILE_ZH_ID,
                matchedName: SPEAKER_REVIEW_PROFILE_ZH_NAME,
                similarity: 0.96,
                embeddingKey: "e2e-embedding-alpha",
            },
        },
        uniqueSpeakers: ["SPEAKER_ALPHA_00", "SPEAKER_BETA_01"],
        params: null,
    };

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
                includeSpeakerReview
                    ? speakerReviewTranscript
                    : "Speaker 1: 本地转写复制内容。\nSpeaker 2: UI 验收必须保留。",
                "zh",
                "server",
                includeSpeakerReview ? "server" : "voice-transcribe",
                "e2e",
                includeSpeakerReview ? null : "remote-e2e-detail",
                includeSpeakerReview
                    ? JSON.stringify({
                          SPEAKER_ALPHA_00: SPEAKER_REVIEW_PROFILE_ZH_NAME,
                      })
                    : "{}",
                includeSpeakerReview
                    ? JSON.stringify(speakerReviewPayload)
                    : "{}",
                now - 120_000,
            ],
        });
        if (includeSpeakerReview) {
            await voiceprints.execute({
                sql: `
                    INSERT OR REPLACE INTO speaker_profiles (
                        id, user_id, display_name, voiceprint_ref, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)
                `,
                args: [
                    SPEAKER_REVIEW_PROFILE_ZH_ID,
                    userId,
                    SPEAKER_REVIEW_PROFILE_ZH_NAME,
                    "vp-e2e-speaker-zh",
                    now,
                    now,
                    SPEAKER_REVIEW_PROFILE_LATIN_ID,
                    userId,
                    SPEAKER_REVIEW_PROFILE_LATIN_NAME,
                    null,
                    now,
                    now,
                ],
            });
            await voiceprints.execute({
                sql: `
                    INSERT OR REPLACE INTO recording_speakers (
                        id, user_id, recording_id, raw_label, matched_profile_id,
                        sample_segments, segment_count, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    "e2e-speaker-alpha-row",
                    userId,
                    DETAIL_RECORDING_ID,
                    "SPEAKER_ALPHA_00",
                    SPEAKER_REVIEW_PROFILE_ZH_ID,
                    JSON.stringify([
                        {
                            startMs: 0,
                            endMs: 3200,
                            text: "第一段中文说话人内容需要在窄屏保持可读。",
                        },
                    ]),
                    2,
                    now,
                    now,
                    "e2e-speaker-beta-row",
                    userId,
                    DETAIL_RECORDING_ID,
                    "SPEAKER_BETA_01",
                    null,
                    JSON.stringify([
                        {
                            startMs: null,
                            endMs: null,
                            text: "Latin speaker review content for mapping.",
                        },
                    ]),
                    1,
                    now,
                    now,
                ],
            });
        }
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
        await voiceprints.close();
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

test("recording detail speaker review maps labels and stays stable on narrow screens", async ({
    page,
}) => {
    await installClipboardCapture(page);

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const recordingId = await seedRecordingDetail(userId, {
            includeSpeakerReview: true,
        });

        await page.goto(`/recordings/${recordingId}`, {
            waitUntil: "domcontentloaded",
        });

        await expect(
            page.getByTestId("recording-detail-workstation"),
        ).toBeVisible();
        await expect(page.getByTestId("source-report-loaded")).toBeVisible();
        await page
            .getByRole("button", { name: "说话人标签", exact: true })
            .click();

        const panel = page.getByTestId("speaker-review-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByTestId("speaker-review-card")).toHaveCount(2);
        await expect(
            panel.getByTestId("speaker-review-metadata"),
        ).toContainText("语言");
        await expect(
            panel.getByTestId("speaker-review-transcript-preview"),
        ).toContainText(SPEAKER_REVIEW_PROFILE_ZH_NAME);

        const mappedCard = panel.locator(
            '[data-testid="speaker-review-card"][data-speaker-label="SPEAKER_ALPHA_00"]',
        );
        const unmappedCard = panel.locator(
            '[data-testid="speaker-review-card"][data-speaker-label="SPEAKER_BETA_01"]',
        );
        await expect(mappedCard).toHaveAttribute("data-speaker-mapped", "true");
        await expect(mappedCard).toHaveAttribute(
            "data-speaker-has-voiceprint",
            "true",
        );
        await expect(
            mappedCard.getByTestId("speaker-review-card-status"),
        ).toContainText("已关联声纹");
        await expect(unmappedCard).toHaveAttribute(
            "data-speaker-mapped",
            "false",
        );
        await expect(
            unmappedCard.getByTestId("speaker-review-no-playable-sample"),
        ).toBeVisible();

        await panel.getByTestId("speaker-review-mode-raw").click();
        await expect(
            panel.getByTestId("speaker-review-transcript-preview"),
        ).toContainText("SPEAKER_BETA_01");

        await panel.getByTestId("speaker-review-copy-raw").click();
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
            .toContain("SPEAKER_ALPHA_00");

        await unmappedCard
            .getByTestId("speaker-review-mapping-input")
            .fill(SPEAKER_REVIEW_CREATED_NAME);
        await expect(
            unmappedCard.getByTestId("speaker-review-create-option"),
        ).toContainText(SPEAKER_REVIEW_CREATED_NAME);
        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/speakers`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            unmappedCard.getByTestId("speaker-review-create-option").click(),
        ]);
        await expect(unmappedCard).toHaveAttribute(
            "data-speaker-mapped",
            "true",
        );
        await expect(
            unmappedCard.getByTestId("speaker-review-card-status"),
        ).toContainText(SPEAKER_REVIEW_CREATED_NAME);

        await panel.getByTestId("speaker-review-mode-speaker").click();
        await expect(
            panel.getByTestId("speaker-review-transcript-preview"),
        ).toContainText(SPEAKER_REVIEW_CREATED_NAME);

        await Promise.all([
            page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/recordings/${recordingId}/speakers`) &&
                    response.request().method() === "PATCH" &&
                    response.ok(),
            ),
            unmappedCard.getByTestId("speaker-review-unlink").click(),
        ]);
        await expect(unmappedCard).toHaveAttribute(
            "data-speaker-mapped",
            "false",
        );
        await expect(
            unmappedCard.getByTestId("speaker-review-card-status"),
        ).toContainText("尚未匹配");

        await page.setViewportSize({ width: 390, height: 844 });
        await panel.scrollIntoViewIfNeeded();
        await page.mouse.wheel(0, 600);

        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <=
                        document.documentElement.clientWidth + 1,
                ),
            )
            .toBe(true);

        const mappedBox = await mappedCard.boundingBox();
        const inputBox = await unmappedCard
            .getByTestId("speaker-review-mapping-input")
            .boundingBox();

        expect(mappedBox?.width ?? 0).toBeGreaterThan(300);
        expect(inputBox?.width ?? 0).toBeGreaterThan(240);
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
