import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, type Route, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = process.env.PLAYWRIGHT_E2E_DATA_DIR
    ? path.resolve(process.env.PLAYWRIGHT_E2E_DATA_DIR)
    : path.resolve(process.cwd(), "tmp/e2e/data");
const STATE_CONTRACT_RECORDING_ID = "e2e-source-report-state-contract";
const STATE_CONTRACT_MARKER = "E2E_SOURCE_REPORT_STATE_CONTRACT_MARKER";
const FORCED_FAILURE_MESSAGE = "E2E source report state contract failure";

type SourceReportReadback = {
    availableSections: string[];
    filename: string;
    summaryMarkdown: string | null;
    summaryReady: boolean;
    transcript: { text: string } | null;
    transcriptReady: boolean;
};

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

async function executeWithBusyRetry<T>(
    operation: () => Promise<T>,
): Promise<T> {
    const delays = [50, 100, 200, 400, 800, 1_200];

    for (let attempt = 0; ; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const delay = delays[attempt];
            const message = error instanceof Error ? error.message : String(error);
            if (delay == null || !/SQLITE_BUSY|database is locked/i.test(message)) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}

async function getPlaywrightUserId() {
    const core = createClient({ url: databaseUrl(CORE_DB) });

    try {
        const result = await executeWithBusyRetry(() =>
            core.execute({
                sql: "SELECT id FROM `users` WHERE email = ? LIMIT 1",
                args: ["playwright-admin@example.com"],
            }),
        );
        const userId = result.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Playwright user not found");
        }
        return userId;
    } finally {
        await core.close();
    }
}

async function cleanupStateContractSeed(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM source_artifacts WHERE user_id = ? AND recording_id = ?",
                args: [userId, STATE_CONTRACT_RECORDING_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM transcript_segments WHERE user_id = ? AND recording_id = ?",
                args: [userId, STATE_CONTRACT_RECORDING_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id = ?",
                args: [userId, STATE_CONTRACT_RECORDING_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM transcription_jobs WHERE user_id = ? AND recording_id = ?",
                args: [userId, STATE_CONTRACT_RECORDING_ID],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recordings WHERE user_id = ? AND id = ?",
                args: [userId, STATE_CONTRACT_RECORDING_ID],
            }),
        );
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedStateContractRecording(userId: string) {
    const now = Date.now();
    const start = Date.parse("2026-07-11T08:00:00.000Z");
    const duration = 90_000;
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await executeWithBusyRetry(() =>
            library.execute({
                sql: `
                    INSERT OR REPLACE INTO recordings (
                        id, user_id, source_provider, source_recording_id, source_version,
                        source_metadata, provider_device_id, filename, duration, start_time,
                        end_time, filesize, file_md5, storage_type, storage_path,
                        downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    STATE_CONTRACT_RECORDING_ID,
                    userId,
                    "ticnote",
                    STATE_CONTRACT_RECORDING_ID,
                    "1",
                    JSON.stringify({
                        pageUrl: "https://source.example.test/state-contract",
                    }),
                    "e2e-source-report-state-contract-device",
                    "E2E source report state contract",
                    duration,
                    start,
                    start + duration,
                    1024,
                    "e2e-source-report-state-contract-md5",
                    "local",
                    "",
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO transcriptions (
                        id, recording_id, user_id, text, detected_language,
                        transcription_type, provider, model, provider_job_id,
                        speaker_map, provider_payload, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${STATE_CONTRACT_RECORDING_ID}-local-transcript`,
                    STATE_CONTRACT_RECORDING_ID,
                    userId,
                    "Local transcript shell for source report state contract.",
                    "en",
                    "server",
                    "voice-transcribe",
                    "e2e",
                    `${STATE_CONTRACT_RECORDING_ID}-local-provider-job`,
                    "{}",
                    "{}",
                    now - 120_000,
                ],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${STATE_CONTRACT_RECORDING_ID}-detail`,
                    STATE_CONTRACT_RECORDING_ID,
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
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${STATE_CONTRACT_RECORDING_ID}-transcript`,
                    STATE_CONTRACT_RECORDING_ID,
                    userId,
                    "ticnote",
                    "official-transcript",
                    "Source transcript",
                    `Speaker 1: ${STATE_CONTRACT_MARKER}`,
                    null,
                    JSON.stringify({
                        language: "en",
                        segments: [
                            {
                                speaker: "Speaker 1",
                                startMs: 0,
                                endMs: 30_000,
                                text: STATE_CONTRACT_MARKER,
                            },
                        ],
                    }),
                    now - 110_000,
                    now - 100_000,
                ],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${STATE_CONTRACT_RECORDING_ID}-summary`,
                    STATE_CONTRACT_RECORDING_ID,
                    userId,
                    "ticnote",
                    "official-summary",
                    "Source report",
                    null,
                    `## State contract source report\n\n- ${STATE_CONTRACT_MARKER}`,
                    "{}",
                    now - 100_000,
                    now - 95_000,
                ],
            }),
        );
    } finally {
        await library.close();
        await transcripts.close();
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

function assertRealBackendReadback(readback: SourceReportReadback) {
    expect(readback.filename).toBe("E2E source report state contract");
    expect(readback.availableSections).toEqual([
        "transcript",
        "summary",
        "detail",
    ]);
    expect(readback.transcriptReady).toBe(true);
    expect(readback.summaryReady).toBe(true);
    expect(readback.transcript?.text).toContain(STATE_CONTRACT_MARKER);
    expect(readback.summaryMarkdown).toContain(STATE_CONTRACT_MARKER);
}

async function fulfillWithRealBackend(
    route: Route,
    readbacks: SourceReportReadback[],
) {
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    const readback = (await response.json()) as SourceReportReadback;
    assertRealBackendReadback(readback);
    readbacks.push(readback);
    await route.fulfill({ response });
}

test("recording detail source report state contract covers loading no-data error retry and loaded", async ({
    page,
}) => {
    const sourceReportRoute = `**/api/recordings/${STATE_CONTRACT_RECORDING_ID}/source-report`;
    let userId: string | null = null;
    let routeInstalled = false;
    let requestCount = 0;
    const backendReadbacks: SourceReportReadback[] = [];
    let markInitialRequestStarted: () => void = () => undefined;
    const initialRequestStarted = new Promise<void>((resolve) => {
        markInitialRequestStarted = resolve;
    });
    let releaseInitialResponse: () => void = () => undefined;
    const initialResponseGate = new Promise<void>((resolve) => {
        releaseInitialResponse = resolve;
    });

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await cleanupStateContractSeed(userId);
        await seedStateContractRecording(userId);

        await page.route(sourceReportRoute, async (route) => {
            if (route.request().method() !== "GET") {
                await route.continue();
                return;
            }

            requestCount += 1;
            if (requestCount === 1) {
                markInitialRequestStarted();
                const response = await route.fetch();
                expect(response.status()).toBe(200);
                const readback = (await response.json()) as SourceReportReadback;
                assertRealBackendReadback(readback);
                backendReadbacks.push(readback);
                await initialResponseGate;
                await route.fulfill({ response });
                return;
            }

            if (requestCount === 2) {
                // Deterministic no-data seam: ordinary loaded readback still uses route.fetch().
                await route.fulfill({
                    contentType: "application/json",
                    status: 200,
                    body: "null",
                });
                return;
            }

            if (requestCount === 3) {
                // Deterministic error seam: retry returns to the real app route below.
                await route.fulfill({
                    contentType: "application/json",
                    status: 503,
                    body: JSON.stringify({ error: FORCED_FAILURE_MESSAGE }),
                });
                return;
            }

            if (requestCount === 4) {
                await fulfillWithRealBackend(route, backendReadbacks);
                return;
            }

            await route.continue();
        });
        routeInstalled = true;

        const navigation = page.goto(`/recordings/${STATE_CONTRACT_RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        await initialRequestStarted;

        const panel = sourceReportPanel(page);
        const loadingState = sourceReportInnerState(page, "loading");
        await expect(panel).toHaveAttribute("data-state", "loading");
        await expect(loadingState).toBeVisible();
        await expect(
            loadingState.locator(
                '[data-testid="source-report-card-skeleton"]',
            ),
        ).toHaveCount(4);
        await expect(sourceReportRefreshButton(page)).toHaveAttribute(
            "data-state",
            "loading",
        );
        await expect(sourceReportRefreshButton(page)).toBeDisabled();

        releaseInitialResponse();
        await navigation;

        const loadedState = sourceReportInnerState(page, "loaded");
        await expect(panel).toHaveAttribute("data-state", "loaded");
        await expect(loadedState).toBeVisible();
        await expect(loadedState).toContainText(STATE_CONTRACT_MARKER);
        await expect(
            panel.getByTestId("source-report-copy-source-transcript"),
        ).toHaveAttribute("data-state", "ready");
        await expect(
            panel.getByTestId("source-report-copy-source-report"),
        ).toHaveAttribute("data-state", "ready");
        expect(backendReadbacks).toHaveLength(1);

        await sourceReportRefreshButton(page).click();
        const emptyState = sourceReportInnerState(page, "empty");
        await expect(panel).toHaveAttribute("data-state", "empty");
        await expect(emptyState).toBeVisible();
        await expect(
            emptyState.getByTestId("source-report-empty-title"),
        ).toContainText("这条录音没有关联来源");
        await expect(sourceReportRefreshButton(page)).toHaveAttribute(
            "data-state",
            "empty",
        );
        await expect(sourceReportRefreshButton(page)).toBeEnabled();

        await sourceReportRefreshButton(page).click();
        const errorState = sourceReportInnerState(page, "error");
        const retryButton = errorState.locator(
            'button[data-testid="source-report-refresh"][data-state="error"]',
        );
        await expect(panel).toHaveAttribute("data-state", "error");
        await expect(errorState).toBeVisible();
        await expect(errorState).toContainText("无法读取来源详情");
        await expect(retryButton).toBeVisible();
        await expect(retryButton).toBeEnabled();
        await expect(retryButton).toHaveText("重试");

        await retryButton.click();
        await expect(panel).toHaveAttribute("data-state", "loaded");
        await expect(sourceReportInnerState(page, "error")).toHaveCount(0);
        await expect(loadedState).toBeVisible();
        await expect(loadedState).toContainText(STATE_CONTRACT_MARKER);
        expect(requestCount).toBe(4);
        expect(backendReadbacks).toHaveLength(2);
        assertRealBackendReadback(backendReadbacks[1]);
    } finally {
        releaseInitialResponse();
        if (routeInstalled) {
            await page.unroute(sourceReportRoute);
        }
        if (userId) {
            await cleanupStateContractSeed(userId);
        }
    }
});
