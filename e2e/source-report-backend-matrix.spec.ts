import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Locator, type Page, test } from "@playwright/test";
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
const MATRIX_RECORDING_PREFIX = "e2e-source-report-backend-matrix-";
const SOURCE_REPORT_SECTION_TITLES = [
  "来源转写",
  "来源原始报告",
  "来源信息",
] as const;

type SourceReportMatrixCase = {
  id: string;
  title: string;
  subState:
    | "complete"
    | "transcript-missing"
    | "summary-missing"
    | "both-missing";
  includeSummary: boolean;
  includeTranscript: boolean;
  summaryMarker: string;
  transcriptMarker: string;
};

type SourceReportReadback = {
  availableSections: string[];
  filename: string;
  sourceActions?: {
    openSource?: {
      available?: boolean;
      reason?: string | null;
      url?: string | null;
    };
    repullSource?: {
      available?: boolean;
      reason?: string | null;
    };
  };
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

const MATRIX_CASES: SourceReportMatrixCase[] = [
  {
    id: `${MATRIX_RECORDING_PREFIX}complete`,
    title: "E2E backend source report complete",
    subState: "complete",
    includeSummary: true,
    includeTranscript: true,
    summaryMarker: "BACKEND_MATRIX_SUMMARY_COMPLETE",
    transcriptMarker: "BACKEND_MATRIX_TRANSCRIPT_COMPLETE",
  },
  {
    id: `${MATRIX_RECORDING_PREFIX}transcript-missing`,
    title: "E2E backend source report transcript missing",
    subState: "transcript-missing",
    includeSummary: true,
    includeTranscript: false,
    summaryMarker: "BACKEND_MATRIX_SUMMARY_ONLY",
    transcriptMarker: "BACKEND_MATRIX_TRANSCRIPT_ABSENT",
  },
  {
    id: `${MATRIX_RECORDING_PREFIX}summary-missing`,
    title: "E2E backend source report summary missing",
    subState: "summary-missing",
    includeSummary: false,
    includeTranscript: true,
    summaryMarker: "BACKEND_MATRIX_SUMMARY_ABSENT",
    transcriptMarker: "BACKEND_MATRIX_TRANSCRIPT_ONLY",
  },
  {
    id: `${MATRIX_RECORDING_PREFIX}both-missing`,
    title: "E2E backend source report both missing",
    subState: "both-missing",
    includeSummary: false,
    includeTranscript: false,
    summaryMarker: "BACKEND_MATRIX_SUMMARY_ABSENT_BOTH",
    transcriptMarker: "BACKEND_MATRIX_TRANSCRIPT_ABSENT_BOTH",
  },
];

function databaseUrl(filePath: string) {
  return pathToFileURL(filePath).href;
}

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
  const client = createClient({ url: databaseUrl(CORE_DB) });
  try {
    const result = await executeWithBusyRetry(() =>
      client.execute({
        sql: "SELECT id FROM `users` WHERE email = ? LIMIT 1",
        args: ["playwright-admin@example.com"],
      }),
    );
    const id = result.rows[0]?.id;
    if (typeof id !== "string") {
      throw new Error("Playwright user not found");
    }
    return id;
  } finally {
    await client.close();
  }
}

async function cleanupSourceReportMatrixSeeds(userId: string) {
  const library = createClient({ url: databaseUrl(LIBRARY_DB) });
  const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

  try {
    await executeWithBusyRetry(() =>
      transcripts.execute({
        sql: "DELETE FROM source_artifacts WHERE user_id = ? AND recording_id LIKE ?",
        args: [userId, `${MATRIX_RECORDING_PREFIX}%`],
      }),
    );
    await executeWithBusyRetry(() =>
      transcripts.execute({
        sql: "DELETE FROM transcript_segments WHERE user_id = ? AND recording_id LIKE ?",
        args: [userId, `${MATRIX_RECORDING_PREFIX}%`],
      }),
    );
    await executeWithBusyRetry(() =>
      transcripts.execute({
        sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id LIKE ?",
        args: [userId, `${MATRIX_RECORDING_PREFIX}%`],
      }),
    );
    await executeWithBusyRetry(() =>
      library.execute({
        sql: "DELETE FROM transcription_jobs WHERE user_id = ? AND recording_id LIKE ?",
        args: [userId, `${MATRIX_RECORDING_PREFIX}%`],
      }),
    );
    await executeWithBusyRetry(() =>
      library.execute({
        sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
        args: [userId, `${MATRIX_RECORDING_PREFIX}%`],
      }),
    );
  } finally {
    await library.close();
    await transcripts.close();
  }
}

async function seedSourceReportMatrixCase(
  userId: string,
  matrixCase: SourceReportMatrixCase,
) {
  const now = Date.now();
  const start = Date.parse("2026-04-22T06:00:00.000Z");
  const duration = 32 * 60_000 + 18_000;
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
          matrixCase.id,
          userId,
          "ticnote",
          matrixCase.id,
          "1",
          JSON.stringify({
            pageUrl: `https://source.example.test/source-report-backend-matrix/${matrixCase.subState}?view=e2e#readback`,
          }),
          "e2e-source-report-matrix-device",
          matrixCase.title,
          duration,
          start,
          start + duration,
          1024,
          `${matrixCase.id}-md5`,
          "local",
          path.relative(
            E2E_STORAGE_DIR,
            path.join(E2E_STORAGE_DIR, "source-report-matrix.mp3"),
          ),
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
          `${matrixCase.id}-local-transcript`,
          matrixCase.id,
          userId,
          `Speaker 1: ${matrixCase.title} local transcript shell.`,
          "zh",
          "server",
          "voice-transcribe",
          "e2e",
          `${matrixCase.id}-local-provider-job`,
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
          `${matrixCase.id}-detail`,
          matrixCase.id,
          userId,
          "ticnote",
          "official-detail",
          "来源详情",
          null,
          null,
          JSON.stringify({ language: "zh-CN" }),
          now - 90_000,
          now - 60_000,
        ],
      }),
    );

    if (matrixCase.includeTranscript) {
      await executeWithBusyRetry(() =>
        transcripts.execute({
          sql: `
                        INSERT OR REPLACE INTO source_artifacts (
                            id, recording_id, user_id, provider, artifact_type, title,
                            text_content, markdown_content, payload, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
          args: [
            `${matrixCase.id}-transcript`,
            matrixCase.id,
            userId,
            "ticnote",
            "official-transcript",
            "来源逐字稿",
            `Speaker 1: stale text for ${matrixCase.transcriptMarker}`,
            null,
            JSON.stringify({
              language: "zh-CN",
              segments: [
                {
                  speaker: "Speaker 1",
                  startMs: 0,
                  endMs: 1_200,
                  text: `${matrixCase.transcriptMarker} source transcript from seeded artifact.`,
                },
                {
                  speaker: "Speaker 2",
                  startMs: 1_200,
                  endMs: 2_400,
                  text: `${matrixCase.title} follow-up source segment.`,
                },
              ],
            }),
            now - 110_000,
            now - 100_000,
          ],
        }),
      );
    }

    if (matrixCase.includeSummary) {
      await executeWithBusyRetry(() =>
        transcripts.execute({
          sql: `
                        INSERT OR REPLACE INTO source_artifacts (
                            id, recording_id, user_id, provider, artifact_type, title,
                            text_content, markdown_content, payload, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
          args: [
            `${matrixCase.id}-summary`,
            matrixCase.id,
            userId,
            "ticnote",
            "official-summary",
            "来源报告",
            null,
            `## ${matrixCase.title} source summary\n\n- ${matrixCase.summaryMarker} from seeded source artifact.`,
            "{}",
            now - 100_000,
            now - 95_000,
          ],
        }),
      );
    }
  } finally {
    await library.close();
    await transcripts.close();
  }
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

async function readLastCopiedText(page: Page) {
  return ((await readCopiedTexts(page)).at(-1) ?? "").trim();
}

function recordingSourceReport(page: Page, state?: string) {
  const selector = '[data-sot-panel="recording-source-report"]';
  return page.locator(
    state ? `${selector}[data-sot-state="${state}"]` : selector,
  );
}

function recordingSourceReportLoaded(page: Page) {
  return recordingSourceReport(page, "loaded")
    .locator(
      '[data-sot-panel="recording-source-report-state"][data-sot-state="loaded"]',
    )
    .first();
}

function dashboardSourceReport(page: Page, state?: string) {
  return page.locator(
    state
      ? `[data-sot-panel="dashboard-source-report"][data-sot-tab-pane="source-report"][data-sot-state="${state}"]`
      : '[data-sot-panel="dashboard-source-report"][data-sot-tab-pane="source-report"]',
  );
}

function dashboardSourceReportLoaded(page: Page) {
  return dashboardSourceReport(page, "loaded")
    .locator('[data-sot-source-report-state][data-state="loaded"]')
    .first();
}

function sourceTranscriptCopyButton(page: Page) {
  return page.locator('[data-sot-control="copy-source-transcript"]');
}

function sourceReportCopyButton(page: Page) {
  return page.locator('[data-sot-control="copy-source-report"]');
}

function recordingSourceTranscriptCopyButton(page: Page) {
  return recordingSourceReport(page).locator(
    'button[data-sot-control="copy-source-transcript"]',
  );
}

function recordingSourceReportCopyButton(page: Page) {
  return recordingSourceReport(page).locator(
    'button[data-sot-control="copy-source-report"]',
  );
}

function sourceReportRefreshButton(page: Page) {
  return page.getByRole("button", { name: /^(刷新|加载中\.\.\.)$/ }).first();
}

function sourceReportOpenSourceControl(page: Page) {
  return page.locator('[data-sot-control="open-source-record"]');
}

function sourceReportRepullButton(page: Page) {
  return page.locator('button[data-sot-control="repull-source"]');
}

async function waitForSourceReportResponse(
  page: Page,
  recordingId: string,
  action: () => Promise<void>,
) {
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === `/api/recordings/${recordingId}/source-report` &&
      response.request().method() === "GET"
    );
  });

  await action();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  return (await response.json()) as SourceReportReadback;
}

async function fetchSourceReportReadback(page: Page, recordingId: string) {
  const response = await page.request.get(
    `/api/recordings/${recordingId}/source-report`,
  );
  expect(response.status()).toBe(200);
  return (await response.json()) as SourceReportReadback;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expectedSections(matrixCase: SourceReportMatrixCase) {
  return [
    ...(matrixCase.includeTranscript ? ["transcript"] : []),
    ...(matrixCase.includeSummary ? ["summary"] : []),
    "detail",
  ];
}

function assertReadback(
  readback: SourceReportReadback,
  matrixCase: SourceReportMatrixCase,
) {
  expect(readback.filename).toBe(matrixCase.title);
  expect(readback.sourceProvider).toBe("ticnote");
  expect(readback.availableSections).toEqual(expectedSections(matrixCase));
  expect(readback.transcriptReady).toBe(matrixCase.includeTranscript);
  expect(readback.summaryReady).toBe(matrixCase.includeSummary);
  expect(readback.sourceActions?.openSource).toMatchObject({
    available: true,
    reason: null,
    url: `https://source.example.test/source-report-backend-matrix/${matrixCase.subState}`,
  });
  expect(readback.sourceActions?.repullSource).toMatchObject({
    available: true,
    reason: null,
  });

  if (matrixCase.includeTranscript) {
    expect(readback.transcript?.segmentCount).toBe(2);
    expect(readback.transcript?.segments[0]?.text).toContain(
      matrixCase.transcriptMarker,
    );
    expect(readback.transcript?.text).toContain(matrixCase.transcriptMarker);
    expect(readback.transcript?.text).not.toContain("stale text");
  } else {
    expect(readback.transcript).toBeNull();
  }

  if (matrixCase.includeSummary) {
    expect(readback.summaryMarkdown).toContain(matrixCase.summaryMarker);
  } else {
    expect(readback.summaryMarkdown).toBeNull();
  }
}

async function expectLoadedSourceReportState(
  loaded: Locator,
  matrixCase: SourceReportMatrixCase,
) {
  await expect(loaded).toBeVisible();
  await expect(loaded).toHaveAttribute("data-sub-state", matrixCase.subState);
  await expect(
    loaded.locator('[data-sot-metric="transcript-status"]'),
  ).toContainText(matrixCase.includeTranscript ? "已就绪" : "未生成");
  await expect(
    loaded.locator('[data-sot-metric="summary-status"]'),
  ).toContainText(matrixCase.includeSummary ? "已就绪" : "未生成");
  await expect(
    loaded.locator('[data-sot-metric="segment-count"]'),
  ).toContainText(matrixCase.includeTranscript ? "2" : "0");
  await expect(
    loaded.locator("[data-sot-source-report-section-title]"),
  ).toHaveText(
    matrixCase.includeSummary
      ? SOURCE_REPORT_SECTION_TITLES
      : ["来源转写", "来源信息"],
  );

  if (matrixCase.includeTranscript) {
    await expect(loaded).toContainText(matrixCase.transcriptMarker);
  } else {
    await expect(
      loaded.locator(
        '[data-sot-source-report-missing-notice][data-sot-missing="transcript-missing"]',
      ),
    ).toContainText("来源未提供逐字稿。可以稍后再来，或运行私有转写。");
  }

  if (matrixCase.includeSummary) {
    await expect(loaded).toContainText(matrixCase.summaryMarker);
  } else {
    await expect(
      loaded.locator(
        '[data-sot-source-report-missing-notice][data-sot-missing="summary-missing"]',
      ),
    ).toContainText("来源未提供官方摘要。");
  }
}

async function openRecordingDetailSourceReport(
  page: Page,
  matrixCase: SourceReportMatrixCase,
) {
  const responseBody = await waitForSourceReportResponse(
    page,
    matrixCase.id,
    async () => {
      await page.goto(`/recordings/${matrixCase.id}`, {
        waitUntil: "domcontentloaded",
      });
    },
  );
  assertReadback(responseBody, matrixCase);
  await expect(
    page.locator('[data-sot-surface="recording-workstation"]'),
  ).toHaveAttribute("data-sot-state", "ready");
  const loaded = recordingSourceReportLoaded(page);
  await expectLoadedSourceReportState(loaded, matrixCase);
  return loaded;
}

async function openDashboardSourceReport(
  page: Page,
  matrixCase: SourceReportMatrixCase,
) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: new RegExp(escapeRegExp(matrixCase.title)) })
    .click();
  await expect(
    page.getByRole("heading", {
      name: new RegExp(escapeRegExp(matrixCase.title)),
    }),
  ).toBeVisible();

  const responseBody = await waitForSourceReportResponse(
    page,
    matrixCase.id,
    async () => {
      await page.getByRole("tab", { name: "来源详情" }).click();
    },
  );
  assertReadback(responseBody, matrixCase);
  const loaded = dashboardSourceReportLoaded(page);
  await expectLoadedSourceReportState(loaded, matrixCase);
  return loaded;
}

async function expectRecordingCopyGuards(
  page: Page,
  matrixCase: SourceReportMatrixCase,
) {
  const transcriptButton = recordingSourceTranscriptCopyButton(page);
  const reportButton = recordingSourceReportCopyButton(page);

  await expect(transcriptButton).toHaveAttribute(
    "data-sot-state",
    matrixCase.includeTranscript ? "ready" : "missing",
  );
  await expect(reportButton).toHaveAttribute(
    "data-sot-state",
    matrixCase.includeSummary ? "ready" : "missing",
  );

  if (matrixCase.includeTranscript) {
    await expect(transcriptButton).toBeEnabled();
    await transcriptButton.click();
    await expect
      .poll(() => readLastCopiedText(page))
      .toContain(matrixCase.transcriptMarker);
    await expect
      .poll(() => readLastCopiedText(page))
      .toContain("00:00 – 00:01");
  } else {
    await expect(transcriptButton).toBeDisabled();
  }

  if (matrixCase.includeSummary) {
    await expect(reportButton).toBeEnabled();
    await reportButton.click();
    await expect
      .poll(() => readLastCopiedText(page))
      .toContain(matrixCase.summaryMarker);
  } else {
    await expect(reportButton).toBeDisabled();
  }
}

async function expectDashboardCopyGuards(
  page: Page,
  matrixCase: SourceReportMatrixCase,
) {
  const transcriptButton = sourceTranscriptCopyButton(page);
  const reportButton = sourceReportCopyButton(page);

  await expect(transcriptButton).toHaveAttribute(
    "data-sot-state",
    matrixCase.includeTranscript ? "ready" : "missing",
  );
  await expect(reportButton).toHaveAttribute("data-sot-state", "ready");

  if (matrixCase.includeTranscript) {
    await expect(transcriptButton).toBeEnabled();
    await transcriptButton.click();
    await expect
      .poll(() => readLastCopiedText(page))
      .toContain(matrixCase.transcriptMarker);
    await expect
      .poll(() => readLastCopiedText(page))
      .toContain("0:00 - 0:01 · Speaker 1");
  } else {
    await expect(transcriptButton).toBeDisabled();
  }

  await expect(reportButton).toBeEnabled();
  await reportButton.click();
  await expect
    .poll(() => readLastCopiedText(page))
    .toContain(`来源标题：${matrixCase.title}`);
  await expect
    .poll(() => readLastCopiedText(page))
    .toContain(`分段数：${matrixCase.includeTranscript ? 2 : 0}`);

  if (matrixCase.includeSummary) {
    await expect
      .poll(() => readLastCopiedText(page))
      .toContain(matrixCase.summaryMarker);
  } else {
    await expect
      .poll(() => readLastCopiedText(page))
      .toContain("摘要状态：未生成");
  }
}

test("source report backend-connected matrix drives detail and dashboard readback", async ({
  page,
}) => {
  let userId: string | null = null;

  await installClipboardCapture(page);

  try {
    await ensureSignedIn(page);
    userId = await getPlaywrightUserId();
    await cleanupSourceReportMatrixSeeds(userId);
    for (const matrixCase of MATRIX_CASES) {
      await seedSourceReportMatrixCase(userId, matrixCase);
    }

    for (const matrixCase of MATRIX_CASES) {
      const readback = await fetchSourceReportReadback(page, matrixCase.id);
      assertReadback(readback, matrixCase);

      await openRecordingDetailSourceReport(page, matrixCase);
      await expectRecordingCopyGuards(page, matrixCase);

      const detailRefreshReadback = await waitForSourceReportResponse(
        page,
        matrixCase.id,
        async () => {
          await sourceReportRefreshButton(page).click();
        },
      );
      assertReadback(detailRefreshReadback, matrixCase);
      await expectLoadedSourceReportState(
        recordingSourceReportLoaded(page),
        matrixCase,
      );

      await openDashboardSourceReport(page, matrixCase);
      await expectDashboardCopyGuards(page, matrixCase);
      await expect(sourceReportOpenSourceControl(page)).toHaveAttribute(
        "data-sot-state",
        "ready",
      );
      await expect(sourceReportRepullButton(page)).toHaveAttribute(
        "data-sot-state",
        "ready",
      );

      const dashboardRefreshReadback = await waitForSourceReportResponse(
        page,
        matrixCase.id,
        async () => {
          await sourceReportRefreshButton(page).click();
        },
      );
      assertReadback(dashboardRefreshReadback, matrixCase);
      await expectLoadedSourceReportState(
        dashboardSourceReportLoaded(page),
        matrixCase,
      );
    }
  } finally {
    if (userId) {
      await cleanupSourceReportMatrixSeeds(userId);
    }
  }
});
