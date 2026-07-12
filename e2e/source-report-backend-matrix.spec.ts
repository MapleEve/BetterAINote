import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import {
  expect,
  type Locator,
  type Page,
  test,
  type TestInfo,
} from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import { SOT_WORKSTATION_URL } from "./helpers/sot-fixtures";

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
const LONG_SOURCE_REPORT_TOKEN = "source-report-responsive-long-token-".repeat(12);
const SOURCE_REPORT_CANONICAL_FRAMES = [
  { name: "desktop", height: 900, width: 1366 },
  { name: "tablet", height: 900, width: 1024 },
  { name: "mobile", height: 844, width: 390 },
] as const;
const SOURCE_REPORT_THEMES = ["light", "dark"] as const;

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
                  text: `${matrixCase.transcriptMarker} source transcript from seeded artifact. ${
                    matrixCase.subState === "complete"
                      ? LONG_SOURCE_REPORT_TOKEN
                      : ""
                  }`,
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
            `## ${matrixCase.title} source summary\n\n- ${matrixCase.summaryMarker} from seeded source artifact.${
              matrixCase.subState === "complete"
                ? `\n\n${LONG_SOURCE_REPORT_TOKEN}`
                : ""
            }`,
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

async function applySourceReportTheme(
  page: Page,
  theme: (typeof SOURCE_REPORT_THEMES)[number],
) {
  await page.evaluate((nextTheme) => {
    document.documentElement.dataset.theme = nextTheme;
    document.body.dataset.theme = nextTheme;
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, theme);
}

async function sourceReportGridColumns(grid: Locator) {
  return grid.evaluate((element) =>
    getComputedStyle(element)
      .gridTemplateColumns.split(/\s+/)
      .filter(Boolean).length,
  );
}

async function expectNoHorizontalOverflow(root: Locator) {
  const overflow = await root.evaluate((element) => {
    const nodes = [element, ...Array.from(element.querySelectorAll("*"))];
    return nodes
      .filter((node) => node.scrollWidth > node.clientWidth)
      .map((node) => ({
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        testId: node.getAttribute("data-testid"),
        tagName: node.tagName,
      }));
  });

  expect(overflow).toEqual([]);
}

async function sourceReportThemeSignature(card: Locator) {
  return card.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.backgroundColor, style.borderColor, style.color].join("|");
  });
}

async function prepareCanonicalSourceReport(page: Page) {
  await page.goto(SOT_WORKSTATION_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>(".sr-pane");
    if (!pane) throw new Error("Canonical Source Report pane is missing");
    pane.hidden = false;
    for (const state of pane.querySelectorAll<HTMLElement>(".sr-state")) {
      state.hidden = state.dataset.state !== "loaded";
    }
    document.body.replaceChildren(pane);
  });
  await page.addStyleTag({
    content:
      "html,body{min-width:0!important;width:100%!important;overflow-x:hidden!important}.sr-pane{display:flex!important;width:100%!important;min-width:0!important;box-sizing:border-box}",
  });

  return page.locator('.sr-pane .sr-state[data-state="loaded"]');
}

async function expectCanonicalResponsiveThemeMatrix(
  productPage: Page,
  canonicalPage: Page,
  productLoaded: Locator,
  testInfo: TestInfo,
) {
  const canonicalLoaded = await prepareCanonicalSourceReport(canonicalPage);
  const productPanel = recordingSourceReport(productPage, "loaded");
  const productThemeSignatures = new Map<string, string>();
  const canonicalThemeSignatures = new Map<string, string>();

  await expect(canonicalLoaded.locator(".sr-card")).toHaveCount(4);
  await expect(productLoaded.locator('[data-testid^="source-report-metric-"]')).toHaveCount(
    4,
  );

  for (const frame of SOURCE_REPORT_CANONICAL_FRAMES) {
    await productPage.setViewportSize({ width: frame.width, height: frame.height });
    await canonicalPage.setViewportSize({ width: frame.width, height: frame.height });

    for (const theme of SOURCE_REPORT_THEMES) {
      await applySourceReportTheme(productPage, theme);
      await applySourceReportTheme(canonicalPage, theme);

      const productMetrics = productLoaded.getByTestId("source-report-metrics");
      const canonicalMetrics = canonicalLoaded.locator(".sr-cards");
      expect(await sourceReportGridColumns(productMetrics)).toBe(
        await sourceReportGridColumns(canonicalMetrics),
      );
      expect(await sourceReportGridColumns(productLoaded.getByTestId("source-report-meta"))).toBe(
        await sourceReportGridColumns(canonicalLoaded.locator(".sr-meta")),
      );

      await expectNoHorizontalOverflow(productPanel);
      await expectNoHorizontalOverflow(productLoaded);
      await expect(productLoaded).toContainText(LONG_SOURCE_REPORT_TOKEN);

      productThemeSignatures.set(
        theme,
        await sourceReportThemeSignature(
          productLoaded.getByTestId("source-report-metric-source"),
        ),
      );
      canonicalThemeSignatures.set(
        theme,
        await sourceReportThemeSignature(canonicalLoaded.locator(".sr-card").first()),
      );

      await testInfo.attach(`source-report-product-${frame.name}-${theme}`, {
        body: await productPanel.screenshot(),
        contentType: "image/png",
      });
      await testInfo.attach(`source-report-canonical-${frame.name}-${theme}`, {
        body: await canonicalLoaded.screenshot(),
        contentType: "image/png",
      });
    }
  }

  expect(productThemeSignatures.get("light")).not.toBe(
    productThemeSignatures.get("dark"),
  );
  expect(canonicalThemeSignatures.get("light")).not.toBe(
    canonicalThemeSignatures.get("dark"),
  );
}

function recordingSourceReport(page: Page, state?: string) {
  const selector = '[data-testid="recording-source-report"]';
  return page.locator(
    state ? `${selector}[data-state="${state}"]` : selector,
  );
}

function recordingSourceReportLoaded(page: Page) {
  return recordingSourceReport(page, "loaded")
    .locator(
      '[data-testid="recording-source-report-state"][data-state="loaded"]',
    )
    .first();
}

function dashboardSourceReport(page: Page, state?: string) {
  const selector = '[data-testid="dashboard-source-report"]';
  return page.locator(state ? `${selector}[data-state="${state}"]` : selector);
}

function dashboardSourceReportLoaded(page: Page) {
  return dashboardSourceReport(page, "loaded")
    .locator('[data-testid="dashboard-source-report-state"][data-state="loaded"]')
    .first();
}

function sourceTranscriptCopyButton(page: Page) {
  return page.getByTestId("source-report-copy-source-transcript");
}

function sourceReportCopyButton(page: Page) {
  return page.getByTestId("source-report-copy-source-report");
}

function recordingSourceTranscriptCopyButton(page: Page) {
  return recordingSourceReport(page).locator(
    'button[data-testid="source-report-copy-source-transcript"]',
  );
}

function recordingSourceReportCopyButton(page: Page) {
  return recordingSourceReport(page).locator(
    'button[data-testid="source-report-copy-source-report"]',
  );
}

function sourceReportRefreshButton(page: Page) {
  return page.getByRole("button", { name: /^(刷新|加载中\.\.\.)$/ }).first();
}

function sourceReportOpenSourceControl(page: Page) {
  return page.getByTestId("source-report-open-source");
}

function sourceReportRepullButton(page: Page) {
  return page.getByTestId("source-report-repull");
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
  await expect(loaded).toHaveAttribute("data-substate", matrixCase.subState);
  await expect(
    loaded.getByTestId("source-report-metric-transcript-status"),
  ).toContainText(matrixCase.includeTranscript ? "已就绪" : "未生成");
  await expect(
    loaded.getByTestId("source-report-metric-summary-status"),
  ).toContainText(matrixCase.includeSummary ? "已就绪" : "未生成");
  await expect(
    loaded.getByTestId("source-report-metric-segment-count"),
  ).toContainText(matrixCase.includeTranscript ? "2" : "0");
  await expect(
    loaded.getByTestId("source-report-section-title"),
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
        '[data-testid="source-report-missing-transcript-missing"][data-state="transcript-missing"]',
      ),
    ).toContainText("来源未提供逐字稿。可以稍后再来，或运行私有转写。");
  }

  if (matrixCase.includeSummary) {
    await expect(loaded).toContainText(matrixCase.summaryMarker);
  } else {
    await expect(
      loaded.locator(
        '[data-testid="source-report-missing-summary-missing"][data-state="summary-missing"]',
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
    "data-state",
    matrixCase.includeTranscript ? "ready" : "missing",
  );
  await expect(reportButton).toHaveAttribute(
    "data-state",
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
    "data-state",
    matrixCase.includeTranscript ? "ready" : "missing",
  );
  await expect(reportButton).toHaveAttribute("data-state", "ready");

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

test("source report backend-connected matrix drives detail and dashboard readback", async (
  { page },
  testInfo,
) => {
  let userId: string | null = null;
  let canonicalPage: Page | null = null;

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
        "data-state",
        "ready",
      );
      await expect(sourceReportRepullButton(page)).toHaveAttribute(
        "data-state",
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

    const completeCase = MATRIX_CASES[0];
    const completeLoaded = await openRecordingDetailSourceReport(page, completeCase);
    canonicalPage = await page.context().newPage();
    await expectCanonicalResponsiveThemeMatrix(
      page,
      canonicalPage,
      completeLoaded,
      testInfo,
    );
  } finally {
    await canonicalPage?.close();
    if (userId) {
      await cleanupSourceReportMatrixSeeds(userId);
    }
  }
});
