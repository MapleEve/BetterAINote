import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const E2E_STORAGE_DIR = process.env.PLAYWRIGHT_E2E_STORAGE_DIR
    ? path.resolve(process.cwd(), process.env.PLAYWRIGHT_E2E_STORAGE_DIR)
    : path.resolve(process.cwd(), "tmp/e2e/storage");

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

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");
const RETX_RECORDING_ID = "e2e-retx-recording";
const RETX_JOB_ID = "e2e-retx-job";
const RETX_TRANSCRIPT_ID = "e2e-retx-transcript";

type RetranscriptionSeedStatus =
    | "processing"
    | "failed"
    | "succeeded"
    | null;

function databaseUrl(filePath: string) {
    return pathToFileURL(filePath).href;
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

async function enablePrivateTranscriptionCapability(userId: string) {
    const now = Date.now();
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        await core.execute({
            sql: `
                INSERT INTO user_settings (
                    id, user_id, private_transcription_base_url,
                    private_transcription_min_speakers,
                    private_transcription_max_speakers,
                    private_transcription_denoise_model,
                    private_transcription_no_repeat_ngram_size,
                    private_transcription_max_inflight_jobs,
                    created_at, updated_at
                ) VALUES (?, ?, ?, 0, 0, 'none', 0, 1, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    private_transcription_base_url = excluded.private_transcription_base_url,
                    updated_at = excluded.updated_at
            `,
            args: [
                "e2e-retx-user-settings",
                userId,
                "https://transcribe.e2e.example",
                now,
                now,
            ],
        });
    } finally {
        await core.close();
    }
}

async function resetPrivateTranscriptionCapability(userId: string) {
    const now = Date.now();
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        await core.execute({
            sql: `
                UPDATE user_settings
                SET private_transcription_base_url = NULL,
                    updated_at = ?
                WHERE user_id = ?
            `,
            args: [now, userId],
        });
    } finally {
        await core.close();
    }
}

async function seedRetranscriptionScenario(
    userId: string,
    options: {
        filename: string;
        hasAudio?: boolean;
        status: RetranscriptionSeedStatus;
        remoteStatus?: string | null;
        lastError?: string | null;
        oldText?: string | null;
    },
) {
    const now = Date.now();
    const start = now - 3_600_000;
    const storagePath =
        options.hasAudio === false ? "" : "e2e/retx-fixture.mp3";
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await cleanupRunningRetranscriptionSeed();
        if (storagePath) {
            const fixturePath = path.join(E2E_STORAGE_DIR, storagePath);
            await mkdir(path.dirname(fixturePath), { recursive: true });
            await writeFile(fixturePath, Buffer.from("ID3"));
        }
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
                RETX_RECORDING_ID,
                userId,
                "ticnote",
                "e2e-retx-source",
                "1",
                "{}",
                "e2e-device",
                options.filename,
                180_000,
                start,
                start + 180_000,
                1024,
                "e2e",
                "local",
                storagePath,
                now,
                0,
                0,
                now,
                now,
            ],
        });
        if (options.status) {
            await library.execute({
                sql: `
                    INSERT OR REPLACE INTO transcription_jobs (
                        id, user_id, recording_id, status, force, provider, model,
                        provider_job_id, remote_status, attempts, last_error,
                        requested_at, started_at, completed_at, next_poll_at,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    RETX_JOB_ID,
                    userId,
                    RETX_RECORDING_ID,
                    options.status,
                    1,
                    "voice-transcribe",
                    "e2e",
                    "remote-e2e-retx",
                    options.remoteStatus ??
                        (options.status === "processing"
                            ? "transcribing"
                            : options.status === "succeeded"
                              ? "completed"
                              : null),
                    1,
                    options.lastError ?? null,
                    now - 60_000,
                    now - 45_000,
                    options.status === "processing" ? null : now - 10_000,
                    options.status === "processing"
                        ? now + 3_600_000
                        : null,
                    now - 60_000,
                    now,
                ],
            });
        }
        if (options.oldText !== null) {
            await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO transcriptions (
                        id, recording_id, user_id, text, detected_language,
                        transcription_type, provider, model, provider_job_id,
                        speaker_map, provider_payload, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    RETX_TRANSCRIPT_ID,
                    RETX_RECORDING_ID,
                    userId,
                    options.oldText ??
                        "Speaker 1: 这是一段旧版本转写。重新转写运行时不能隐藏它。",
                    "zh",
                    "server",
                    "voice-transcribe",
                    "e2e",
                    "remote-e2e-retx-old",
                    "{}",
                    "{}",
                    now - 120_000,
                ],
            });
        }
    } finally {
        await library.close();
        await transcripts.close();
    }

    return RETX_RECORDING_ID;
}

async function seedRunningRetranscription(userId: string) {
    return seedRetranscriptionScenario(userId, {
        filename: "E2E retranscription running",
        status: "processing",
    });
}

async function markRetranscriptionSucceeded(userId: string) {
    const now = Date.now();
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    try {
        await transcripts.execute({
            sql: `
                UPDATE transcriptions
                SET text = ?,
                    provider_job_id = ?,
                    created_at = ?
                WHERE id = ? AND recording_id = ? AND user_id = ?
            `,
            args: [
                "Speaker 1: 这是一段新版本转写。完成横幅应该可以被收起。",
                "remote-e2e-retx-new",
                now,
                RETX_TRANSCRIPT_ID,
                RETX_RECORDING_ID,
                userId,
            ],
        });
        await library.execute({
            sql: `
                UPDATE transcription_jobs
                SET status = 'succeeded',
                    remote_status = 'completed',
                    last_error = NULL,
                    completed_at = ?,
                    next_poll_at = NULL,
                    updated_at = ?
                WHERE id = ?
            `,
            args: [now, now, RETX_JOB_ID],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function cleanupRunningRetranscriptionSeed() {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE id = ? OR recording_id = ?",
            args: [RETX_JOB_ID, RETX_RECORDING_ID],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE id = ? OR recording_id = ?",
            args: [RETX_TRANSCRIPT_ID, RETX_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE id = ?",
            args: [RETX_RECORDING_ID],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

test("dashboard keeps the old transcript visible while retranscription is running", async ({
    page,
}) => {
    let recordingId = RETX_RECORDING_ID;

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        recordingId = await seedRunningRetranscription(userId);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        await page
            .getByRole("button", { name: /E2E retranscription running/ })
            .click();
        const panel = page.getByTestId("dashboard-transcription-panel");
        await expect(panel).toHaveAttribute(
            "data-transcription-panel-state",
            "running",
        );
        await expect(
            page.getByTestId("dashboard-retranscription-banner"),
        ).toHaveAttribute("data-retx-state", "running");
        await expect(panel).toContainText("旧版本转写");
        await expect(
            page.locator(`[data-retx-state="running"][aria-busy="true"]`),
        ).toBeVisible();

        const stateResponse = await page.request.get(
            `/api/recordings/${recordingId}/transcribe`,
        );
        expect(stateResponse.ok()).toBe(true);
    } finally {
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard queues initial private transcription from the empty transcript state", async ({
    page,
}) => {
    let userId: string | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await enablePrivateTranscriptionCapability(userId);
        await seedRetranscriptionScenario(userId, {
            filename: "E2E initial transcription queued",
            oldText: null,
            status: null,
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E initial transcription queued/ })
            .click();

        const panel = page.getByTestId("dashboard-transcription-panel");
        await expect(panel).toHaveAttribute(
            "data-transcription-panel-state",
            "idle",
        );
        await expect(panel).toContainText("暂无转录结果");

        const postRequest = page.waitForRequest(
            (request) =>
                request
                    .url()
                    .includes(`/api/recordings/${RETX_RECORDING_ID}/transcribe`) &&
                request.method() === "POST",
        );
        const postResponse = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(`/api/recordings/${RETX_RECORDING_ID}/transcribe`) &&
                response.request().method() === "POST",
        );
        await page.getByTestId("dashboard-generate-transcription").click();

        const request = await postRequest;
        expect(request.postData()).toBeNull();
        const response = await postResponse;
        expect(response.status()).toBe(202);
        expect(response.ok()).toBe(true);

        await expect(panel).toHaveAttribute(
            "data-transcription-panel-state",
            "queued",
        );
        await expect(
            page.getByTestId("dashboard-retranscription-banner"),
        ).toHaveAttribute("data-retx-state", "queued");
        await expect(panel).toContainText("转写任务已加入队列");
        await expect(panel).toContainText("已在本地排队");
    } finally {
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard shows failed retranscription state and retries from the banner", async ({
    page,
}) => {
    let userId: string | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await enablePrivateTranscriptionCapability(userId);
        await seedRetranscriptionScenario(userId, {
            filename: "E2E retranscription failed",
            status: "failed",
            lastError: "E2E transcription failed safely",
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E retranscription failed/ })
            .click();

        const banner = page.getByTestId("dashboard-retranscription-banner");
        await expect(banner).toHaveAttribute("data-retx-state", "failed");
        await expect(banner).toContainText("E2E transcription failed safely");

        const retryResponse = page.waitForResponse(
            (response) =>
                response
                    .url()
                    .includes(`/api/recordings/${RETX_RECORDING_ID}/transcribe`) &&
                response.request().method() === "POST",
        );
        await banner.locator("[data-retx-retry]").click();
        expect((await retryResponse).ok()).toBe(true);
        await expect(banner).toHaveAttribute("data-retx-state", "queued");
    } finally {
        await cleanupRunningRetranscriptionSeed();
        if (userId) {
            await resetPrivateTranscriptionCapability(userId);
        }
    }
});

test("dashboard shows and dismisses completed retranscription state", async ({
    page,
}) => {
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        await seedRunningRetranscription(userId);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E retranscription running/ })
            .click();

        await expect(
            page.getByTestId("dashboard-retranscription-banner"),
        ).toHaveAttribute("data-retx-state", "running");

        await markRetranscriptionSucceeded(userId);
        const panel = page.getByTestId("dashboard-transcription-panel");
        await expect(panel).toHaveAttribute(
            "data-transcription-panel-state",
            "completed",
            { timeout: 15_000 },
        );
        await expect(panel).toContainText("新版本转写");

        const banner = page.getByTestId("dashboard-retranscription-banner");
        await expect(banner).toHaveAttribute("data-retx-state", "completed");
        await banner.locator("[data-retx-dismiss]").click();
        await expect(banner).toBeHidden();
        await expect(panel).toHaveAttribute(
            "data-transcription-panel-state",
            "idle",
        );
    } finally {
        await cleanupRunningRetranscriptionSeed();
    }
});

test("dashboard exposes unavailable retranscription state for sources without local audio", async ({
    page,
}) => {
    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        await seedRetranscriptionScenario(userId, {
            filename: "E2E retranscription unavailable",
            hasAudio: false,
            status: null,
            oldText: "Speaker 1: 这条录音只有来源侧文本，没有本地音频。",
        });

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page
            .getByRole("button", { name: /E2E retranscription unavailable/ })
            .click();

        const panel = page.getByTestId("dashboard-transcription-panel");
        await expect(panel).toHaveAttribute(
            "data-transcription-panel-state",
            "unavailable",
        );
        await expect(panel).toContainText("只有来源侧文本");
        await expect(
            page.getByTestId("dashboard-retranscription-banner"),
        ).toHaveAttribute("data-retx-state", "unavailable");
        await expect(
            page.locator('button[data-retx-state="unavailable"]'),
        ).toBeDisabled();
    } finally {
        await cleanupRunningRetranscriptionSeed();
    }
});
