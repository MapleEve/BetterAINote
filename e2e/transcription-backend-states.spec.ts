import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const PLAYWRIGHT_USER_EMAIL = "playwright-admin@example.com";
const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const E2E_STORAGE_DIR = process.env.PLAYWRIGHT_E2E_STORAGE_DIR
  ? path.resolve(process.cwd(), process.env.PLAYWRIGHT_E2E_STORAGE_DIR)
  : path.resolve(process.cwd(), "tmp/e2e/storage");
const RECORDING_PREFIX = "e2e-backend-states-";
const DETAIL_RECORDING_ID = `${RECORDING_PREFIX}detail-processing`;
const FAILED_RECORDING_ID = `${RECORDING_PREFIX}detail-failed`;
const READY_RECORDING_ID = `${RECORDING_PREFIX}detail-ready`;
const EMPTY_RECORDING_ID = `${RECORDING_PREFIX}detail-empty`;
const NO_AUDIO_RECORDING_ID = `${RECORDING_PREFIX}no-audio`;

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

async function executeWithBusyRetry<T>(
  operation: () => Promise<T>,
  attempts = 8,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (
        !(error instanceof Error) ||
        !error.message.includes("SQLITE_BUSY") ||
        attempt === attempts - 1
      ) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
    }
  }

  throw lastError;
}

async function getPlaywrightUserId() {
  const client = createClient({ url: databaseUrl(CORE_DB) });
  try {
    const result = await client.execute({
      sql: "SELECT id FROM `users` WHERE email = ? LIMIT 1",
      args: [PLAYWRIGHT_USER_EMAIL],
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

async function setPrivateTranscriptionCapability(
  userId: string,
  baseUrl: string | null,
) {
  const now = Date.now();
  const core = createClient({ url: databaseUrl(CORE_DB) });
  try {
    await executeWithBusyRetry(() =>
      core.execute({
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
                        private_transcription_min_speakers = 0,
                        private_transcription_max_speakers = 0,
                        private_transcription_denoise_model = 'none',
                        private_transcription_no_repeat_ngram_size = 0,
                        private_transcription_max_inflight_jobs = 1,
                        updated_at = excluded.updated_at
                `,
        args: ["e2e-backend-states-user-settings", userId, baseUrl, now, now],
      }),
    );
  } finally {
    await core.close();
  }
}

async function cleanupBackendStateSeeds() {
  const library = createClient({ url: databaseUrl(LIBRARY_DB) });
  const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

  try {
    await executeWithBusyRetry(() =>
      library.execute({
        sql: "DELETE FROM transcription_jobs WHERE recording_id LIKE ?",
        args: [`${RECORDING_PREFIX}%`],
      }),
    );
    await executeWithBusyRetry(() =>
      transcripts.execute({
        sql: "DELETE FROM transcript_segments WHERE recording_id LIKE ?",
        args: [`${RECORDING_PREFIX}%`],
      }),
    );
    await executeWithBusyRetry(() =>
      transcripts.execute({
        sql: "DELETE FROM transcriptions WHERE recording_id LIKE ?",
        args: [`${RECORDING_PREFIX}%`],
      }),
    );
    await executeWithBusyRetry(() =>
      library.execute({
        sql: "DELETE FROM recordings WHERE id LIKE ?",
        args: [`${RECORDING_PREFIX}%`],
      }),
    );
  } finally {
    await library.close();
    await transcripts.close();
  }

  await rm(path.join(E2E_STORAGE_DIR, "e2e/backend-states"), {
    force: true,
    recursive: true,
  });
}

function createSineWaveWavBuffer() {
  const sampleRate = 8_000;
  const sampleCount = sampleRate * 2;
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.sin((index / sampleRate) * 440 * Math.PI * 2);
    buffer.writeInt16LE(Math.round(sample * 12_000), 44 + index * 2);
  }

  return buffer;
}

async function seedBackendStateRecording(
  userId: string,
  options: {
    id: string;
    filename: string;
    hasAudio?: boolean;
    transcriptText?: string | null;
    job?: {
      status: "pending" | "submitted" | "processing" | "succeeded" | "failed";
      remoteStatus?: string | null;
      lastError?: string | null;
      force?: boolean;
    };
  },
) {
  const now = Date.now();
  const start = now - 3_600_000;
  const storagePath =
    options.hasAudio === false ? "" : `e2e/backend-states/${options.id}.wav`;
  const library = createClient({ url: databaseUrl(LIBRARY_DB) });
  const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

  try {
    if (storagePath) {
      const fixturePath = path.join(E2E_STORAGE_DIR, storagePath);
      await mkdir(path.dirname(fixturePath), { recursive: true });
      await writeFile(fixturePath, createSineWaveWavBuffer());
    }

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
          options.id,
          userId,
          "ticnote",
          `${options.id}-source`,
          "1",
          "{}",
          "e2e-backend-states-device",
          options.filename,
          180_000,
          start,
          start + 180_000,
          storagePath ? 1024 : 0,
          `${options.id}-md5`,
          "local",
          storagePath,
          storagePath ? now : null,
          0,
          0,
          now,
          now,
        ],
      }),
    );

    if (options.transcriptText !== null) {
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
            `${options.id}-transcript`,
            options.id,
            userId,
            options.transcriptText ??
              "Speaker 1: 旧版本转写仍应在重新转写排队后可见。",
            "zh",
            "server",
            "voice-transcribe",
            "e2e",
            `${options.id}-old-provider-job`,
            "{}",
            "{}",
            now - 120_000,
          ],
        }),
      );
    }

    if (options.job) {
      const isActive = ["pending", "submitted", "processing"].includes(
        options.job.status,
      );
      await executeWithBusyRetry(() =>
        library.execute({
          sql: `
                        INSERT OR REPLACE INTO transcription_jobs (
                            id, user_id, recording_id, status, force, provider, model,
                            provider_job_id, remote_status, attempts, compression_warning,
                            last_error, requested_at, started_at, submitted_at,
                            last_polled_at, completed_at, next_poll_at,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
          args: [
            `${options.id}-job`,
            userId,
            options.id,
            options.job.status,
            options.job.force ?? true,
            "voice-transcribe",
            "e2e",
            `${options.id}-remote-job`,
            options.job.remoteStatus ?? null,
            1,
            null,
            options.job.lastError ?? null,
            now - 60_000,
            isActive ? now - 45_000 : now - 60_000,
            options.job.status === "pending" ? null : now - 45_000,
            options.job.status === "pending" ? null : now - 30_000,
            isActive ? null : now - 10_000,
            isActive ? now + 3_600_000 : null,
            now - 60_000,
            now,
          ],
        }),
      );
    }
  } finally {
    await library.close();
    await transcripts.close();
  }
}

function recordingWorkstation(page: Page) {
  return page.locator('[data-surface="recording-workstation"]');
}

function localTranscriptionPanel(page: Page) {
  return page.locator('[data-control="recording-transcription"]');
}

async function openLocalTranscription(page: Page, recordingId: string) {
  await page.goto(`/recordings/${recordingId}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(recordingWorkstation(page)).toHaveAttribute("data-state", "ready");
  await page.getByRole("tab", { name: "本地转录", exact: true }).click();
  return localTranscriptionPanel(page);
}

test.afterEach(async () => {
  await cleanupBackendStateSeeds();
});

test("recording detail reads backend processing job state without target API stubbing", async ({
  page,
}) => {
  let userId: string | null = null;

  try {
    await ensureSignedIn(page);
    userId = await getPlaywrightUserId();
    await cleanupBackendStateSeeds();
    await setPrivateTranscriptionCapability(
      userId,
      "https://transcribe.e2e.example",
    );
    await seedBackendStateRecording(userId, {
      id: DETAIL_RECORDING_ID,
      filename: "E2E backend states processing",
      transcriptText: "Speaker 1: 处理中仍然显示旧本地转录。",
      job: {
        status: "processing",
        remoteStatus: "transcribing",
        force: true,
      },
    });

    const readbackResponse = await page.request.get(
      `/api/recordings/${DETAIL_RECORDING_ID}/transcribe`,
    );
    expect(readbackResponse.ok()).toBe(true);
    await expect(readbackResponse.json()).resolves.toMatchObject({
      transcript: {
        text: "Speaker 1: 处理中仍然显示旧本地转录。",
      },
      job: {
        recordingId: DETAIL_RECORDING_ID,
        status: "processing",
        remoteStatus: "transcribing",
      },
    });

    await page.goto(`/recordings/${DETAIL_RECORDING_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(recordingWorkstation(page)).toHaveAttribute(
      "data-state",
      "ready",
    );

    await page.getByRole("tab", { name: "本地转录", exact: true }).click();

    const panel = localTranscriptionPanel(page);
    await expect(panel).toHaveAttribute("data-state", "loading");
    await expect(panel).toContainText("音频转录中");
    await expect(panel).toContainText("处理中仍然显示旧本地转录");
    await expect(
      panel.locator('[data-control="recording-transcript-retranscribe"]'),
    ).toBeDisabled();
  } finally {
    if (userId) {
      await setPrivateTranscriptionCapability(userId, null);
    }
  }
});

test("recording detail preserves a saved transcript beside a failed real job", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const userId = await getPlaywrightUserId();

  await cleanupBackendStateSeeds();
  await seedBackendStateRecording(userId, {
    id: FAILED_RECORDING_ID,
    filename: "E2E backend states failed transcript",
    transcriptText: "Speaker 1: 失败任务不能隐藏这段已经保存的转录。",
    job: {
      status: "failed",
      lastError: "转录服务暂时不可用，请稍后重试。",
      force: true,
    },
  });

  const panel = await openLocalTranscription(page, FAILED_RECORDING_ID);
  await expect(panel).toHaveAttribute("data-state", "failed");
  await expect(panel.getByRole("alert")).toContainText(
    "Transcription failed. Check server logs for details.",
  );
  await expect(panel.locator('[data-state="ready"]')).toContainText(
    "失败任务不能隐藏这段已经保存的转录。",
  );
  await expect(
    panel.getByRole("button", { name: "复制转录", exact: true }),
  ).toBeEnabled();
});

test("recording detail exposes a saved transcript through the ready semantic region", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const userId = await getPlaywrightUserId();

  await cleanupBackendStateSeeds();
  await seedBackendStateRecording(userId, {
    id: READY_RECORDING_ID,
    filename: "E2E backend states ready transcript",
    transcriptText: "Speaker 1: 已保存的转录文本可由读屏和页面读取。",
  });

  const panel = await openLocalTranscription(page, READY_RECORDING_ID);
  await expect(panel).toHaveAttribute("data-state", "ready");
  await expect(panel).toHaveAccessibleName("本地转录");
  await expect(panel.getByRole("heading", { name: "转写", exact: true })).toBeVisible();
  await expect(panel.locator('[data-state="ready"]')).toContainText(
    "已保存的转录文本可由读屏和页面读取。",
  );
  await expect(
    panel.getByRole("button", { name: "复制转录", exact: true }),
  ).toBeEnabled();
});

test("recording detail exposes the empty transcript state with an available action", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const userId = await getPlaywrightUserId();

  await cleanupBackendStateSeeds();
  await seedBackendStateRecording(userId, {
    id: EMPTY_RECORDING_ID,
    filename: "E2E backend states empty transcript",
    transcriptText: null,
  });

  const panel = await openLocalTranscription(page, EMPTY_RECORDING_ID);
  await expect(panel).toHaveAttribute("data-state", "empty");
  await expect(panel.locator('[data-state="empty"]')).toContainText(
    "暂无本地转录结果",
  );
  await expect(
    panel.getByRole("button", { name: "开始转录", exact: true }),
  ).toBeEnabled();
});

test("real transcription route returns negative states for missing audio and missing recording", async ({
  page,
}) => {
  let userId: string | null = null;

  try {
    await ensureSignedIn(page);
    userId = await getPlaywrightUserId();
    await cleanupBackendStateSeeds();
    await setPrivateTranscriptionCapability(
      userId,
      "https://transcribe.e2e.example",
    );
    await seedBackendStateRecording(userId, {
      id: NO_AUDIO_RECORDING_ID,
      filename: "E2E backend states no audio",
      hasAudio: false,
      transcriptText: "Speaker 1: 没有本地音频的旧转写。",
    });

    const noAudioPost = await page.request.post(
      `/api/recordings/${NO_AUDIO_RECORDING_ID}/transcribe`,
      { data: { force: true } },
    );
    expect(noAudioPost.status()).toBe(400);
    await expect(noAudioPost.json()).resolves.toMatchObject({
      error:
        "This source does not have downloadable local audio for private transcription",
    });

    const noAudioGet = await page.request.get(
      `/api/recordings/${NO_AUDIO_RECORDING_ID}/transcribe`,
    );
    expect(noAudioGet.status()).toBe(400);
    await expect(noAudioGet.json()).resolves.toMatchObject({
      error:
        "This source does not have downloadable local audio for private transcription",
    });

    const panel = await openLocalTranscription(page, NO_AUDIO_RECORDING_ID);
    await expect(panel).toHaveAttribute("data-state", "ready");
    await expect(panel).toContainText("这个数据源没有可下载到本地的音频文件");
    await expect(
      panel.locator('[data-control="recording-transcript-retranscribe"]'),
    ).toBeDisabled();
    await expect(
      panel.locator('[data-control="recording-transcript-retranscribe"]'),
    ).toHaveAttribute(
      "title",
      "这个数据源没有可下载到本地的音频文件，当前只能查看来源逐字稿或报告。",
    );

    const missingPost = await page.request.post(
      `/api/recordings/${RECORDING_PREFIX}missing/transcribe`,
      { data: { force: true } },
    );
    expect(missingPost.status()).toBe(404);
    await expect(missingPost.json()).resolves.toMatchObject({
      error: "Recording not found",
    });
  } finally {
    if (userId) {
      await setPrivateTranscriptionCapability(userId, null);
    }
  }
});
