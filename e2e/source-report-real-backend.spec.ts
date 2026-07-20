import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const PLAYWRIGHT_USER_EMAIL = "playwright-admin@example.com";
const RECORDING_PREFIX = "e2e-source-report-real-";
const TRUE_EMPTY_RECORDING_ID = `${RECORDING_PREFIX}true-empty`;
const TRANSCRIPT_MISSING_RECORDING_ID = `${RECORDING_PREFIX}transcript-missing`;
const SUMMARY_MISSING_RECORDING_ID = `${RECORDING_PREFIX}summary-missing`;
const RETRY_RECORDING_ID = `${RECORDING_PREFIX}retry`;
const TRANSCRIPT_MARKER = "E2E_SOURCE_REPORT_REAL_TRANSCRIPT_MARKER";
const SUMMARY_MARKER = "E2E_SOURCE_REPORT_REAL_SUMMARY_MARKER";
const E2E_DATA_DIR = process.env.PLAYWRIGHT_E2E_DATA_DIR
    ? path.resolve(process.env.PLAYWRIGHT_E2E_DATA_DIR)
    : path.resolve(process.cwd(), "tmp/e2e/data");

type SourceReportReadback = {
    availableSections: string[];
    filename: string;
    sourceProvider: string;
    summaryMarkdown: string | null;
    summaryReady: boolean;
    transcript: {
        segmentCount: number;
        segments: Array<{
            speaker: string;
            startMs: number | null;
            endMs: number | null;
            text: string;
        }>;
        text: string;
    } | null;
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

const CORE_DATABASE_PATH = resolveDatabasePath();
const LIBRARY_DATABASE_PATH = deriveSiblingDatabasePath(
    CORE_DATABASE_PATH,
    "library",
);
const TRANSCRIPTS_DATABASE_PATH = deriveSiblingDatabasePath(
    CORE_DATABASE_PATH,
    "transcripts",
);

async function executeWithBusyRetry<T>(operation: () => Promise<T>) {
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
    const core = createClient({ url: databaseUrl(CORE_DATABASE_PATH) });
    try {
        const result = await executeWithBusyRetry(() =>
            core.execute({
                sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
                args: [PLAYWRIGHT_USER_EMAIL],
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

async function cleanupSourceReportSeeds(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DATABASE_PATH) });
    const transcripts = createClient({
        url: databaseUrl(TRANSCRIPTS_DATABASE_PATH),
    });

    try {
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM source_artifacts WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
                args: [userId, `${RECORDING_PREFIX}%`],
            }),
        );
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedSourceReportRecording(params: {
    includeDetail?: boolean;
    includeSummary?: boolean;
    includeTranscript?: boolean;
    recordingId: string;
    sourceProvider?: string;
    title: string;
    userId: string;
}) {
    const now = Date.now();
    const sourceProvider = params.sourceProvider ?? "ticnote";
    const library = createClient({ url: databaseUrl(LIBRARY_DATABASE_PATH) });
    const transcripts = createClient({
        url: databaseUrl(TRANSCRIPTS_DATABASE_PATH),
    });

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
                    params.recordingId,
                    params.userId,
                    sourceProvider,
                    sourceProvider
                        ? `${params.recordingId}-source`
                        : `${params.recordingId}-local`,
                    sourceProvider ? "1" : null,
                    sourceProvider
                        ? JSON.stringify({
                              pageUrl:
                                  "https://source.example.test/e2e-source-report",
                          })
                        : "{}",
                    sourceProvider
                        ? "e2e-source-report-device"
                        : "e2e-local-recording-device",
                    params.title,
                    120_000,
                    now - 120_000,
                    now,
                    1024,
                    `${params.recordingId}-md5`,
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

        const artifactStatements = [];

        if (params.includeDetail) {
            artifactStatements.push({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${params.recordingId}-detail`,
                    params.recordingId,
                    params.userId,
                    sourceProvider,
                    "official-detail",
                    "E2E source report detail",
                    null,
                    null,
                    JSON.stringify({ language: "en" }),
                    now,
                    now,
                ],
            });
        }

        if (params.includeTranscript) {
            artifactStatements.push({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${params.recordingId}-transcript`,
                    params.recordingId,
                    params.userId,
                    sourceProvider,
                    "official-transcript",
                    "E2E source transcript",
                    `Speaker 1: ${TRANSCRIPT_MARKER}`,
                    null,
                    JSON.stringify({
                        language: "en",
                        segments: [
                            {
                                speaker: "Speaker 1",
                                startMs: 0,
                                endMs: 60_000,
                                text: TRANSCRIPT_MARKER,
                            },
                        ],
                    }),
                    now,
                    now,
                ],
            });
        }

        if (params.includeSummary) {
            artifactStatements.push({
                sql: `
                    INSERT OR REPLACE INTO source_artifacts (
                        id, recording_id, user_id, provider, artifact_type, title,
                        text_content, markdown_content, payload, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    `${params.recordingId}-summary`,
                    params.recordingId,
                    params.userId,
                    sourceProvider,
                    "official-summary",
                    "E2E source summary",
                    null,
                    `## Source report\n\n${SUMMARY_MARKER}`,
                    "{}",
                    now,
                    now,
                ],
            });
        }

        if (artifactStatements.length > 0) {
            await executeWithBusyRetry(() =>
                transcripts.batch(artifactStatements),
            );
        }
    } finally {
        await library.close();
        await transcripts.close();
    }
}

function sourceReportPanel(page: Page) {
    return page.getByTestId("recording-source-report");
}

function sourceReportState(page: Page, state: string) {
    return sourceReportPanel(page).locator(
        `[data-testid="recording-source-report-state"][data-state="${state}"]`,
    );
}

async function waitForSourceReportResponse(
    page: Page,
    recordingId: string,
    status: number,
) {
    return page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            url.pathname === `/api/recordings/${recordingId}/source-report` &&
            response.request().method() === "GET" &&
            response.status() === status
        );
    });
}

async function readSourceReportResponse(
    page: Page,
    recordingId: string,
): Promise<SourceReportReadback> {
    const response = await page.request.get(
        `/api/recordings/${recordingId}/source-report`,
    );
    expect(response.status()).toBe(200);
    return (await response.json()) as SourceReportReadback;
}

async function openSourceReport(page: Page, recordingId: string) {
    const response = waitForSourceReportResponse(page, recordingId, 200);
    await page.goto(`/recordings/${recordingId}`, {
        waitUntil: "domcontentloaded",
    });
    const apiResponse = await response;
    return {
        panel: sourceReportPanel(page),
        readback: (await apiResponse.json()) as SourceReportReadback,
    };
}

async function acquireSourceArtifactsLock(): Promise<Client> {
    const lock = createClient({
        url: databaseUrl(TRANSCRIPTS_DATABASE_PATH),
    });
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

test.afterEach(async () => {
    const core = createClient({ url: databaseUrl(CORE_DATABASE_PATH) });
    try {
        const result = await core.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: [PLAYWRIGHT_USER_EMAIL],
        });
        const userId = result.rows[0]?.id;
        if (typeof userId === "string") {
            await cleanupSourceReportSeeds(userId);
        }
    } finally {
        await core.close();
    }
});

test("recording source report renders true empty state for a local recording", async ({
    page,
}) => {
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    await cleanupSourceReportSeeds(userId);
    await seedSourceReportRecording({
        recordingId: TRUE_EMPTY_RECORDING_ID,
        sourceProvider: "",
        title: "E2E true empty source report",
        userId,
    });

    const unexpectedSourceReportResponse = page
        .waitForResponse((response) => {
            const url = new URL(response.url());
            return (
                url.pathname ===
                    `/api/recordings/${TRUE_EMPTY_RECORDING_ID}/source-report` &&
                response.request().method() === "GET"
            );
        }, { timeout: 750 })
        .then(() => true)
        .catch(() => false);

    await page.goto(`/recordings/${TRUE_EMPTY_RECORDING_ID}`, {
        waitUntil: "domcontentloaded",
    });

    const panel = sourceReportPanel(page);
    await expect(panel).toHaveAttribute("data-state", "empty");
    await expect(sourceReportState(page, "empty")).toContainText(
        "这条录音没有关联来源",
    );
    await expect(sourceReportState(page, "loaded")).toHaveCount(0);
    expect(await unexpectedSourceReportResponse).toBe(false);

    const readback = await readSourceReportResponse(
        page,
        TRUE_EMPTY_RECORDING_ID,
    );
    expect(readback.sourceProvider).toBe("");
    expect(readback.transcript).toBeNull();
    expect(readback.summaryMarkdown).toBeNull();
    expect(readback.transcriptReady).toBe(false);
    expect(readback.summaryReady).toBe(false);
});

test("recording source report renders transcript-missing from real source artifacts", async ({
    page,
}) => {
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    await cleanupSourceReportSeeds(userId);
    await seedSourceReportRecording({
        includeDetail: true,
        includeSummary: true,
        includeTranscript: false,
        recordingId: TRANSCRIPT_MISSING_RECORDING_ID,
        title: "E2E transcript missing source report",
        userId,
    });

    const { panel, readback } = await openSourceReport(
        page,
        TRANSCRIPT_MISSING_RECORDING_ID,
    );
    const loadedState = sourceReportState(page, "loaded");
    await expect(panel).toHaveAttribute("data-state", "loaded");
    await expect(loadedState).toHaveAttribute(
        "data-sub-state",
        "transcript-missing",
    );
    await expect(loadedState).toContainText("来源未提供逐字稿");
    await expect(panel).toContainText(SUMMARY_MARKER);
    await expect(panel).not.toContainText(TRANSCRIPT_MARKER);
    expect(readback.sourceProvider).toBe("ticnote");
    expect(readback.transcript).toBeNull();
    expect(readback.transcriptReady).toBe(false);
    expect(readback.summaryMarkdown).toContain(SUMMARY_MARKER);
    expect(readback.summaryReady).toBe(true);
});

test("recording source report renders summary-missing from real source artifacts", async ({
    page,
}) => {
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    await cleanupSourceReportSeeds(userId);
    await seedSourceReportRecording({
        includeDetail: true,
        includeSummary: false,
        includeTranscript: true,
        recordingId: SUMMARY_MISSING_RECORDING_ID,
        title: "E2E summary missing source report",
        userId,
    });

    const { panel, readback } = await openSourceReport(
        page,
        SUMMARY_MISSING_RECORDING_ID,
    );
    const loadedState = sourceReportState(page, "loaded");
    await expect(panel).toHaveAttribute("data-state", "loaded");
    await expect(loadedState).toHaveAttribute(
        "data-sub-state",
        "summary-missing",
    );
    await expect(loadedState).toContainText("来源未提供官方摘要");
    await expect(loadedState).toContainText(TRANSCRIPT_MARKER);
    await expect(panel).not.toContainText(SUMMARY_MARKER);
    expect(readback.sourceProvider).toBe("ticnote");
    expect(readback.transcript?.text).toContain(TRANSCRIPT_MARKER);
    expect(readback.transcriptReady).toBe(true);
    expect(readback.summaryMarkdown).toBeNull();
    expect(readback.summaryReady).toBe(false);
});

test("recording source report exposes an accessible real database failure and recovers on retry", async ({
    page,
}) => {
    let lock: Client | null = null;

    try {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        await cleanupSourceReportSeeds(userId);
        await seedSourceReportRecording({
            includeDetail: true,
            includeSummary: true,
            includeTranscript: true,
            recordingId: RETRY_RECORDING_ID,
            title: "E2E retry source report",
            userId,
        });

        const { panel } = await openSourceReport(page, RETRY_RECORDING_ID);
        await expect(sourceReportState(page, "loaded")).toContainText(
            TRANSCRIPT_MARKER,
        );
        await expect(panel.getByRole("button", { name: "刷新" })).toHaveAttribute(
            "data-control",
            "source-report-refresh",
        );

        lock = await acquireSourceArtifactsLock();
        const failure = waitForSourceReportResponse(
            page,
            RETRY_RECORDING_ID,
            500,
        );
        await panel.getByRole("button", { name: "刷新" }).click();
        await failure;

        const errorState = sourceReportState(page, "error");
        await expect(panel).toHaveAttribute("data-state", "error");
        await expect(errorState).toHaveAttribute("aria-live", "assertive");
        await expect(errorState.getByRole("alert")).toContainText(
            "无法读取来源详情",
        );
        const retry = errorState.getByRole("button", { name: "重试" });
        await expect(retry).toHaveAttribute("data-control", "source-report-retry");

        await releaseSourceArtifactsLock(lock);
        lock = null;
        const recovered = waitForSourceReportResponse(
            page,
            RETRY_RECORDING_ID,
            200,
        );
        await retry.click();
        await recovered;

        await expect(panel).toHaveAttribute("data-state", "loaded");
        await expect(sourceReportState(page, "error")).toHaveCount(0);
        await expect(sourceReportState(page, "loaded")).toContainText(
            TRANSCRIPT_MARKER,
        );
    } finally {
        await releaseSourceArtifactsLock(lock);
    }
});
