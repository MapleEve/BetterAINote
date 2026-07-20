import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = process.env.PLAYWRIGHT_E2E_DATA_DIR
    ? path.resolve(process.env.PLAYWRIGHT_E2E_DATA_DIR)
    : path.resolve(process.cwd(), "tmp/e2e/data");
const RECOVERY_RECORDING_ID = "e2e-source-report-recovery";
const RECOVERY_REPORT_MARKER = "E2E_SOURCE_REPORT_RECOVERY_MARKER";

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.env.DATABASE_PATH)
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
    const core = createClient({ url: databaseUrl(CORE_DB) });

    try {
        const result = await core.execute({
            sql: "SELECT id FROM `users` WHERE email = ? LIMIT 1",
            args: ["playwright-admin@example.com"],
        });
        const userId = result.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Playwright user not found");
        }
        return userId;
    } finally {
        await core.close();
    }
}

async function cleanupRecoverySeed(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE user_id = ? AND recording_id = ?",
            args: [userId, RECOVERY_RECORDING_ID],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcript_segments WHERE user_id = ? AND recording_id = ?",
            args: [userId, RECOVERY_RECORDING_ID],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id = ?",
            args: [userId, RECOVERY_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE user_id = ? AND recording_id = ?",
            args: [userId, RECOVERY_RECORDING_ID],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ? AND id = ?",
            args: [userId, RECOVERY_RECORDING_ID],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedRecoveryRecording(userId: string) {
    const now = Date.now();
    const start = Date.parse("2026-07-11T08:00:00.000Z");
    const duration = 90_000;
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
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
                    RECOVERY_RECORDING_ID,
                    userId,
                    "ticnote",
                    RECOVERY_RECORDING_ID,
                    "1",
                    JSON.stringify({
                        pageUrl: "https://source.example.test/recovery",
                    }),
                    "e2e-source-report-recovery-device",
                    "E2E source report recovery",
                    duration,
                    start,
                    start + duration,
                    1024,
                    "e2e-source-report-recovery-md5",
                    "local",
                    "",
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
                    `${RECOVERY_RECORDING_ID}-local-transcript`,
                    RECOVERY_RECORDING_ID,
                    userId,
                    "Local transcript shell for source report recovery.",
                    "en",
                    "server",
                    "voice-transcribe",
                    "e2e",
                    `${RECOVERY_RECORDING_ID}-local-provider-job`,
                    "{}",
                    "{}",
                    now - 120_000,
                ],
        });
        await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${RECOVERY_RECORDING_ID}-detail`,
                    RECOVERY_RECORDING_ID,
                    userId,
                    "ticnote",
                    "official-detail",
                    "Source detail",
                    null,
                    null,
                    JSON.stringify({ language: "en" }),
                    now - 90_000,
                    now - 60_000,
                ],
        });
        await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${RECOVERY_RECORDING_ID}-transcript`,
                    RECOVERY_RECORDING_ID,
                    userId,
                    "ticnote",
                    "official-transcript",
                    "Source transcript",
                    `Speaker 1: ${RECOVERY_REPORT_MARKER}`,
                    null,
                    JSON.stringify({
                        language: "en",
                        segments: [
                            {
                                speaker: "Speaker 1",
                                startMs: 0,
                                endMs: 30_000,
                                text: RECOVERY_REPORT_MARKER,
                            },
                        ],
                    }),
                    now - 110_000,
                    now - 100_000,
                ],
        });
        await transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${RECOVERY_RECORDING_ID}-summary`,
                    RECOVERY_RECORDING_ID,
                    userId,
                    "ticnote",
                    "official-summary",
                    "Source report",
                    null,
                    `## Recovery source report\n\n- ${RECOVERY_REPORT_MARKER}`,
                    "{}",
                    now - 100_000,
                    now - 95_000,
                ],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function acquireSourceArtifactsLock(): Promise<Client> {
    const lock = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    await lock.execute("PRAGMA busy_timeout = 0");
    await lock.execute("BEGIN EXCLUSIVE");
    return lock;
}

async function releaseSourceArtifactsLock(lock: Client | null) {
    if (!lock) {
        return;
    }

    try {
        await lock.execute("COMMIT");
    } finally {
        await lock.close();
    }
}

function sourceReportPanel(page: Page) {
    return page.getByTestId("recording-source-report");
}

function sourceReportInnerState(page: Page, state: string) {
    return sourceReportPanel(page).locator(
        `[data-testid="recording-source-report-state"][data-state="${state}"]`,
    );
}

function sourceReportRefreshButton(page: Page) {
    return sourceReportPanel(page)
        .getByTestId("source-report-header-actions")
        .getByTestId("source-report-refresh");
}

async function waitForSourceReportResponse(
    page: Page,
    expectedStatus: number,
) {
    return page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            url.pathname ===
                `/api/recordings/${RECOVERY_RECORDING_ID}/source-report` &&
            response.request().method() === "GET" &&
            response.status() === expectedStatus
        );
    });
}

test("recording detail source report refresh failure clears stale content before recovery", async ({
    page,
}) => {
    let userId: string | null = null;
    let lock: Client | null = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await cleanupRecoverySeed(userId);
        await seedRecoveryRecording(userId);

        const initialResponsePromise = waitForSourceReportResponse(page, 200);
        await page.goto(`/recordings/${RECOVERY_RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        const initialResponse = await initialResponsePromise;
        const initialBody = (await initialResponse.json()) as {
            summaryMarkdown?: string | null;
            transcript?: { text?: string | null } | null;
        };
        expect(initialBody.summaryMarkdown).toContain(RECOVERY_REPORT_MARKER);
        expect(initialBody.transcript?.text).toContain(RECOVERY_REPORT_MARKER);

        const panel = sourceReportPanel(page);
        const loadedState = sourceReportInnerState(page, "loaded");
        await expect(panel).toHaveAttribute("data-state", "loaded");
        await expect(loadedState).toBeVisible();
        await expect(loadedState).toContainText(RECOVERY_REPORT_MARKER);

        lock = await acquireSourceArtifactsLock();
        const failureResponsePromise = waitForSourceReportResponse(page, 500);
        await sourceReportRefreshButton(page).click();
        const loadingState = sourceReportInnerState(page, "loading");
        await expect(panel).toHaveAttribute("data-state", "loading");
        await expect(loadingState).toBeVisible();
        await expect(
            loadingState.getByTestId("source-report-card-skeleton").first(),
        ).toBeVisible();
        await expect(sourceReportRefreshButton(page)).toBeDisabled();
        await expect(sourceReportRefreshButton(page)).toContainText("加载中...");
        await failureResponsePromise;

        const errorState = sourceReportInnerState(page, "error");
        await expect(errorState).toBeVisible();
        await expect(errorState).toContainText("无法读取来源详情");

        await expect(panel).toHaveAttribute("data-state", "error");
        await expect(loadedState).toHaveCount(0);
        await expect(panel).not.toContainText(RECOVERY_REPORT_MARKER);
        await expect(
            panel.getByTestId("source-report-copy-source-report"),
        ).toHaveCount(0);

        await releaseSourceArtifactsLock(lock);
        lock = null;
        const recoveryResponsePromise = waitForSourceReportResponse(page, 200);
        await errorState
            .getByTestId("source-report-refresh")
            .click();
        const recoveryResponse = await recoveryResponsePromise;
        const recoveryBody = (await recoveryResponse.json()) as {
            summaryMarkdown?: string | null;
            transcript?: { text?: string | null } | null;
        };
        expect(recoveryBody.summaryMarkdown).toContain(RECOVERY_REPORT_MARKER);
        expect(recoveryBody.transcript?.text).toContain(RECOVERY_REPORT_MARKER);

        await expect(panel).toHaveAttribute("data-state", "loaded");
        await expect(sourceReportInnerState(page, "error")).toHaveCount(0);
        await expect(sourceReportRefreshButton(page)).toBeEnabled();
        await expect(sourceReportRefreshButton(page)).toContainText("刷新");
        await expect(loadedState).toBeVisible();
        await expect(loadedState).toContainText(RECOVERY_REPORT_MARKER);
    } finally {
        await releaseSourceArtifactsLock(lock);
        if (userId) {
            await cleanupRecoverySeed(userId);
        }
    }
});
