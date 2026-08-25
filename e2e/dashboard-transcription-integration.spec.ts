import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const USER_EMAIL = "playwright-admin@example.com";
const RECORDING_PREFIX = "e2e-dashboard-transcription-";
const MERGE_RECORDING_ID = `${RECORDING_PREFIX}merge`;
const QUEUE_RECORDING_ID = `${RECORDING_PREFIX}queue`;
const MERGE_TITLE = "E2E dashboard transcription merge";
const QUEUE_TITLE = "E2E dashboard transcription queue";
const E2E_ROOT_MARKER = ".betterainote-e2e-root";

function requireIsolatedE2ERoot() {
    const configuredRoot = process.env.PLAYWRIGHT_E2E_ROOT?.trim();
    if (!configuredRoot) {
        throw new Error("PLAYWRIGHT_E2E_ROOT is required");
    }
    const root = path.resolve(configuredRoot);
    if (root === path.resolve(process.cwd())) {
        throw new Error("Dashboard transcription E2E requires a disposable root");
    }
    return root;
}

const E2E_ROOT = requireIsolatedE2ERoot();
const E2E_DATA_DIR = path.join(E2E_ROOT, "data");
const E2E_STORAGE_DIR = path.join(E2E_ROOT, "storage");
const CORE_DB = path.resolve(process.env.DATABASE_PATH ?? "");

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.resolve(
        parsed.dir,
        `${parsed.name}-${suffix}${parsed.ext || ".db"}`,
    );
}

const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");
const VOICEPRINTS_DB = deriveSiblingDatabasePath(CORE_DB, "voiceprints");

function assertDisposableDatabase(filePath: string) {
    const relative = path.relative(E2E_DATA_DIR, path.resolve(filePath));
    if (
        !relative ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
    ) {
        throw new Error(`Refusing non-E2E database path: ${filePath}`);
    }
}

function databaseUrl(filePath: string) {
    assertDisposableDatabase(filePath);
    return pathToFileURL(filePath).href;
}

async function withBusyRetry<T>(operation: () => Promise<T>) {
    const delays = [50, 100, 200, 400, 800];
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const delay = delays[attempt];
            const message =
                error instanceof Error ? error.message : String(error);
            if (
                delay == null ||
                !/SQLITE_BUSY|database is locked/i.test(message)
            ) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}

async function getUserId() {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await withBusyRetry(() =>
            core.execute({
                sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
                args: [USER_EMAIL],
            }),
        );
        const userId = result.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Playwright user was not created");
        }
        return userId;
    } finally {
        await core.close();
    }
}

async function setPrivateTranscriptionCapability(
    userId: string,
    enabled: boolean,
) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const now = Date.now();
    try {
        if (!enabled) {
            await withBusyRetry(() =>
                core.execute({
                    sql: `
                        UPDATE user_settings
                        SET private_transcription_base_url = NULL, updated_at = ?
                        WHERE user_id = ?
                    `,
                    args: [now, userId],
                }),
            );
            return;
        }

        await withBusyRetry(() =>
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
                        updated_at = excluded.updated_at
                `,
                args: [
                    `${RECORDING_PREFIX}settings`,
                    userId,
                    "https://transcribe.e2e.example",
                    now,
                    now,
                ],
            }),
        );
    } finally {
        await core.close();
    }
}

async function cleanupSeeds(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });
    try {
        await withBusyRetry(() =>
            voiceprints.execute({
                sql: "DELETE FROM recording_speakers WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${RECORDING_PREFIX}%`],
            }),
        );
        await withBusyRetry(() =>
            voiceprints.execute({
                sql: "DELETE FROM speaker_profiles WHERE user_id = ? AND display_name IN ('Speaker 1', 'Speaker 2')",
                args: [userId],
            }),
        );
        await withBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM transcript_segments WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${RECORDING_PREFIX}%`],
            }),
        );
        await withBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${RECORDING_PREFIX}%`],
            }),
        );
        await withBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM transcription_jobs WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${RECORDING_PREFIX}%`],
            }),
        );
        await withBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
                args: [userId, `${RECORDING_PREFIX}%`],
            }),
        );
    } finally {
        await library.close();
        await transcripts.close();
        await voiceprints.close();
    }
}

async function seedRecording(
    userId: string,
    input: {
        id: string;
        title: string;
        withTranscript: boolean;
    },
) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });
    const voiceprints = createClient({ url: databaseUrl(VOICEPRINTS_DB) });
    const now = Date.now();
    const storagePath = `${RECORDING_PREFIX}${input.id}.mp3`;
    const transcriptId = `${input.id}-transcript`;
    const segments = [
        {
            id: 1,
            start: 0,
            end: 1.5,
            text: "First dashboard statement.",
            speakerLabel: "Speaker 1",
            speakerId: null,
            speakerName: null,
            similarity: null,
            hasOverlap: false,
            words: null,
        },
        {
            id: 2,
            start: 2,
            end: 3.5,
            text: "Second dashboard statement.",
            speakerLabel: "Speaker 2",
            speakerId: null,
            speakerName: null,
            similarity: null,
            hasOverlap: false,
            words: null,
        },
    ];

    await mkdir(path.dirname(path.join(E2E_STORAGE_DIR, storagePath)), {
        recursive: true,
    });
    await writeFile(path.join(E2E_STORAGE_DIR, storagePath), Buffer.from("ID3"));

    try {
        await withBusyRetry(() =>
            library.execute({
                sql: `
                    INSERT INTO recordings (
                        id, user_id, source_provider, source_recording_id, source_version,
                        source_metadata, provider_device_id, filename, duration, start_time,
                        end_time, filesize, file_md5, storage_type, storage_path,
                        downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, 'ticnote', ?, '1', '{}', ?, ?, 60000, ?, ?, 3, ?, 'local', ?, ?, 0, 0, ?, ?)
                `,
                args: [
                    input.id,
                    userId,
                    `${input.id}-source`,
                    `${RECORDING_PREFIX}device`,
                    input.title,
                    now - 60_000,
                    now,
                    `${input.id}-md5`,
                    storagePath,
                    now,
                    now,
                    now,
                ],
            }),
        );
        if (!input.withTranscript) {
            return;
        }

        await withBusyRetry(() =>
            transcripts.execute({
                sql: `
                    INSERT INTO transcriptions (
                        id, recording_id, user_id, text, detected_language,
                        transcription_type, provider, model, provider_job_id,
                        speaker_map, provider_payload, created_at
                    ) VALUES (?, ?, ?, ?, 'en', 'private', 'voice-transcribe', 'e2e', NULL, '{}', ?, ?)
                `,
                args: [
                    transcriptId,
                    input.id,
                    userId,
                    "Speaker 1: First dashboard statement.\nSpeaker 2: Second dashboard statement.",
                    JSON.stringify({
                        id: `${input.id}-provider`,
                        status: "completed",
                        language: "en",
                        speakerMap: {},
                        uniqueSpeakers: ["Speaker 1", "Speaker 2"],
                        segments,
                    }),
                    now,
                ],
            }),
        );
        for (const [index, segment] of segments.entries()) {
            await withBusyRetry(() =>
                voiceprints.execute({
                    sql: `
                        INSERT INTO recording_speakers (
                            id, user_id, recording_id, raw_label,
                            matched_profile_id, sample_segments, segment_count,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, NULL, ?, 1, ?, ?)
                    `,
                    args: [
                        `${input.id}-speaker-${index + 1}`,
                        userId,
                        input.id,
                        segment.speakerLabel,
                        JSON.stringify([
                            {
                                startMs: segment.start * 1000,
                                endMs: segment.end * 1000,
                                text: segment.text,
                            },
                        ]),
                        now,
                        now,
                    ],
                }),
            );
        }
    } finally {
        await library.close();
        await transcripts.close();
        await voiceprints.close();
    }
}

async function selectRecording(page: Page, title: string) {
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await expect(page.getByRole("heading", { name: new RegExp(title) })).toBeVisible();
}

function captureReactLoopErrors(page: Page) {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") {
            errors.push(message.text());
        }
    });
    return errors;
}

test.beforeEach(() => {
    if (!existsSync(path.join(E2E_ROOT, E2E_ROOT_MARKER))) {
        throw new Error("Missing marked disposable E2E root");
    }
    for (const databasePath of [
        CORE_DB,
        LIBRARY_DB,
        TRANSCRIPTS_DB,
        VOICEPRINTS_DB,
    ]) {
        assertDisposableDatabase(databasePath);
        if (!existsSync(databasePath)) {
            throw new Error(`Missing initialized E2E database: ${databasePath}`);
        }
    }
});

test("dashboard merges speakers through real APIs and SQLite without an update loop", async ({
    page,
}) => {
    const reactErrors = captureReactLoopErrors(page);
    await ensureSignedIn(page);
    const userId = await getUserId();

    try {
        await cleanupSeeds(userId);
        await seedRecording(userId, {
            id: MERGE_RECORDING_ID,
            title: MERGE_TITLE,
            withTranscript: true,
        });
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await selectRecording(page, MERGE_TITLE);
        await page.getByRole("tab", { name: "说话人", exact: true }).click();

        await expect(page.getByLabel("选择Speaker 1")).toBeVisible();
        await page.getByLabel("选择Speaker 1").check();
        await page.getByLabel("选择Speaker 2").check();

        const patchResponses: number[] = [];
        page.on("response", (response) => {
            const url = new URL(response.url());
            if (
                url.pathname ===
                    `/api/recordings/${MERGE_RECORDING_ID}/speakers` &&
                response.request().method() === "PATCH"
            ) {
                patchResponses.push(response.status());
            }
        });
        await page
            .locator('[data-control="dashboard-speakers-merge"]')
            .click();
        await expect(
            page.locator(
                '[data-panel="dashboard-speaker-merge-status"][data-state="success"]',
            ),
        ).toBeVisible();
        await expect.poll(() => patchResponses).toEqual([200, 200]);

        const voiceprints = createClient({
            url: databaseUrl(VOICEPRINTS_DB),
        });
        const transcripts = createClient({
            url: databaseUrl(TRANSCRIPTS_DB),
        });
        try {
            const assignments = await withBusyRetry(() =>
                voiceprints.execute({
                    sql: `
                        SELECT raw_label, matched_profile_id
                        FROM recording_speakers
                        WHERE user_id = ? AND recording_id = ?
                        ORDER BY raw_label
                    `,
                    args: [userId, MERGE_RECORDING_ID],
                }),
            );
            const profileIds = assignments.rows.map(
                (row) => row.matched_profile_id,
            );
            expect(profileIds).toHaveLength(2);
            expect(typeof profileIds[0]).toBe("string");
            expect(profileIds[1]).toBe(profileIds[0]);

            const transcript = await withBusyRetry(() =>
                transcripts.execute({
                    sql: `
                        SELECT speaker_map
                        FROM transcriptions
                        WHERE user_id = ? AND recording_id = ?
                        LIMIT 1
                    `,
                    args: [userId, MERGE_RECORDING_ID],
                }),
            );
            expect(
                JSON.parse(String(transcript.rows[0]?.speaker_map ?? "{}")),
            ).toEqual({
                "Speaker 1": "Speaker 1",
                "Speaker 2": "Speaker 1",
            });
        } finally {
            await voiceprints.close();
            await transcripts.close();
        }

        expect(
            reactErrors.filter((message) =>
                /Maximum update depth|Too many re-renders/i.test(message),
            ),
        ).toEqual([]);
    } finally {
        await cleanupSeeds(userId);
    }
});

test("dashboard queues private retranscription through the real POST 202 flow", async ({
    page,
}) => {
    const reactErrors = captureReactLoopErrors(page);
    await ensureSignedIn(page);
    const userId = await getUserId();

    try {
        await cleanupSeeds(userId);
        await setPrivateTranscriptionCapability(userId, true);
        await seedRecording(userId, {
            id: QUEUE_RECORDING_ID,
            title: QUEUE_TITLE,
            withTranscript: false,
        });
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await selectRecording(page, QUEUE_TITLE);
        await expect(page.getByText("还没有逐字稿")).toBeVisible();

        const responsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
                url.pathname ===
                    `/api/recordings/${QUEUE_RECORDING_ID}/transcribe` &&
                response.request().method() === "POST"
            );
        });
        await page
            .locator('[data-control="retranscribe-recording"]')
            .click();
        await page
            .getByRole("dialog")
            .getByRole("button", { name: "确认重新转写", exact: true })
            .click();
        const response = await responsePromise;
        expect(response.status()).toBe(202);
        expect(response.request().postDataJSON()).toEqual({ force: true });
        await expect(
            page.locator(
                '[data-panel="dashboard-retranscription"][data-retx-state="queued"]',
            ),
        ).toContainText("转写任务已加入队列");

        const library = createClient({ url: databaseUrl(LIBRARY_DB) });
        try {
            const jobs = await withBusyRetry(() =>
                library.execute({
                    sql: `
                        SELECT status, force
                        FROM transcription_jobs
                        WHERE user_id = ? AND recording_id = ?
                        ORDER BY created_at DESC
                        LIMIT 1
                    `,
                    args: [userId, QUEUE_RECORDING_ID],
                }),
            );
            expect(jobs.rows[0]?.status).toBe("pending");
            expect(Number(jobs.rows[0]?.force)).toBe(1);
        } finally {
            await library.close();
        }

        expect(
            reactErrors.filter((message) =>
                /Maximum update depth|Too many re-renders/i.test(message),
            ),
        ).toEqual([]);
    } finally {
        await cleanupSeeds(userId);
        await setPrivateTranscriptionCapability(userId, false);
    }
});
