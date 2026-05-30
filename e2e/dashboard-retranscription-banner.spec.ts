import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");

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

async function seedRunningRetranscription(userId: string) {
    const now = Date.now();
    const start = now - 3_600_000;
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await cleanupRunningRetranscriptionSeed();
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
                "E2E retranscription running",
                180_000,
                start,
                start + 180_000,
                1024,
                "e2e",
                "local",
                "e2e/retx.mp3",
                now,
                0,
                0,
                now,
                now,
            ],
        });
        await library.execute({
            sql: `
                INSERT OR REPLACE INTO transcription_jobs (
                    id, user_id, recording_id, status, force, provider, model,
                    provider_job_id, remote_status, attempts, last_error,
                    requested_at, started_at, next_poll_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                RETX_JOB_ID,
                userId,
                RETX_RECORDING_ID,
                "processing",
                1,
                "voice-transcribe",
                "e2e",
                "remote-e2e-retx",
                "transcribing",
                1,
                null,
                now - 60_000,
                now - 45_000,
                now + 3_600_000,
                now - 60_000,
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
                RETX_TRANSCRIPT_ID,
                RETX_RECORDING_ID,
                userId,
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
    } finally {
        await library.close();
        await transcripts.close();
    }

    return RETX_RECORDING_ID;
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
