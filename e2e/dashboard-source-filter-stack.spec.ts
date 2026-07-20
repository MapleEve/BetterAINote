import { createCipheriv, randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ensureSignedIn, putJsonWithRetry } from "./helpers/auth";
import {
    assertCanonicalSotReferenceMatchesRecovery,
    assertCanonicalSotReferenceUnchanged,
    resolveVerifiedCanonicalSotReference,
    snapshotCanonicalSotReference,
} from "./helpers/canonical-sot-reference";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const E2E_STORAGE_DIR = process.env.PLAYWRIGHT_E2E_STORAGE_DIR
    ? path.resolve(process.cwd(), process.env.PLAYWRIGHT_E2E_STORAGE_DIR)
    : path.resolve(process.cwd(), "tmp/e2e/storage");
const STACK_RECORDING_PREFIX = "e2e-source-stack-";
const STACK_AUDIO_DIR = "e2e-source-stack-audio";
const STACK_AUDIO_PREFIX = `${STACK_AUDIO_DIR}/`;
const STACK_RECORDING_TITLE = "E2E source filter stack iflyrec";
const STACK_SOURCE_CONNECTION_ID = `${STACK_RECORDING_PREFIX}iflyrec`;
const E2E_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const EXACT_SOT_VISUAL_ACCEPTANCE = {
    maxChannelDelta: 0,
    maxDifferingPixels: 0,
} as const;

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

function assertE2EDatabasePath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ??
            path.join(process.cwd(), "tmp/e2e"),
    );
    const resolvedPath = path.resolve(filePath);

    if (
        resolvedPath !== e2eRoot &&
        !resolvedPath.startsWith(`${e2eRoot}${path.sep}`)
    ) {
        throw new Error(
            `Refusing to touch non-E2E database path: ${resolvedPath}`,
        );
    }
}

function assertE2EStoragePath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ??
            path.join(process.cwd(), "tmp/e2e"),
    );
    const resolvedPath = path.resolve(filePath);

    if (
        resolvedPath !== e2eRoot &&
        !resolvedPath.startsWith(`${e2eRoot}${path.sep}`)
    ) {
        throw new Error(
            `Refusing to touch non-E2E storage path: ${resolvedPath}`,
        );
    }
}

function databaseUrl(filePath: string) {
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");
const SQLITE_BUSY_RETRY_DELAYS_MS = [50, 100, 200, 400, 800, 1_200];

async function executeWithBusyRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const delayMs = SQLITE_BUSY_RETRY_DELAYS_MS[attempt];
            const message = error instanceof Error ? error.message : String(error);
            if (
                delayMs == null ||
                !/SQLITE_BUSY|database is locked/i.test(message)
            ) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}

function encryptWithPlaywrightE2EKey(plaintext: string) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(
        "aes-256-gcm",
        Buffer.from(E2E_ENCRYPTION_KEY, "hex"),
        iv,
    );
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);

    return [
        iv.toString("hex"),
        cipher.getAuthTag().toString("hex"),
        encrypted.toString("hex"),
    ].join(":");
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

async function cleanupStackSeeds(userId: string) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await executeWithBusyRetry(() =>
            core.execute({
                sql: "DELETE FROM sync_worker_state WHERE user_id = ? AND id LIKE ?",
                args: [userId, `${STACK_RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            core.execute({
                sql: "DELETE FROM source_connections WHERE user_id = ? AND id LIKE ?",
                args: [userId, `${STACK_RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM source_artifact_segments WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${STACK_RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM transcript_segments WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${STACK_RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM source_artifacts WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${STACK_RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            transcripts.execute({
                sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${STACK_RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM transcription_jobs WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${STACK_RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recording_tag_assignments WHERE user_id = ? AND recording_id LIKE ?",
                args: [userId, `${STACK_RECORDING_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
                args: [userId, `${STACK_RECORDING_PREFIX}%`],
            }),
        );
    } finally {
        await core.close();
        await library.close();
        await transcripts.close();
        await removeStackAudioFixtures();
    }
}

type SeedSourceOptions = {
    baseUrl?: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
    syncStatus?: "idle" | "syncing" | "error";
};

async function seedSourceConnection(
    userId: string,
    provider: "iflyrec" | "ticnote" | "plaud",
    options: SeedSourceOptions = {},
) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const now = Date.now();
    const bearer = provider === "iflyrec" ? null : "e2e-source-stack-token";
    const authMode = provider === "iflyrec" ? "session-header" : "bearer";
    const baseUrl =
        options.baseUrl ??
        (provider === "iflyrec"
            ? "https://www.iflyrec.com"
            : provider === "ticnote"
              ? "https://voice-api.ticnote.cn"
              : "https://api.plaud.ai");
    const secretConfig = encryptWithPlaywrightE2EKey(
        JSON.stringify(
            provider === "iflyrec"
                ? { sessionId: "e2e-source-stack-session" }
                : { bearerToken: bearer },
        ),
    );

    try {
        await core.execute({
            sql: `
                INSERT INTO source_connections (
                    id, user_id, provider, enabled, auth_mode, base_url,
                    config, secret_config, last_sync, sync_status,
                    last_sync_error, last_sync_started_at, last_sync_finished_at,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, provider) DO UPDATE SET
                    id = excluded.id,
                    enabled = excluded.enabled,
                    auth_mode = excluded.auth_mode,
                    base_url = excluded.base_url,
                    config = excluded.config,
                    secret_config = excluded.secret_config,
                    last_sync = excluded.last_sync,
                    sync_status = excluded.sync_status,
                    last_sync_error = excluded.last_sync_error,
                    last_sync_started_at = excluded.last_sync_started_at,
                    last_sync_finished_at = excluded.last_sync_finished_at,
                    updated_at = excluded.updated_at
            `,
            args: [
                `${STACK_RECORDING_PREFIX}${provider}`,
                userId,
                provider,
                options.enabled === false ? 0 : 1,
                authMode,
                baseUrl,
                JSON.stringify(options.config ?? {}),
                secretConfig,
                now - 60_000,
                options.syncStatus ?? "idle",
                options.syncStatus === "error" ? "E2E sync error" : null,
                null,
                null,
                now,
                now,
            ],
        });
    } finally {
        await core.close();
    }
}

async function readSourceConnectionSyncState(userId: string) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await core.execute({
            sql: `
                SELECT sync_status, last_sync_error, last_sync_started_at,
                       last_sync_finished_at
                FROM source_connections
                WHERE user_id = ? AND provider = 'iflyrec'
                LIMIT 1
            `,
            args: [userId],
        });
        const row = result.rows[0];
        if (!row) {
            throw new Error("Seeded iflyrec source connection was not found");
        }
        return {
            lastSyncError: row.last_sync_error,
            lastSyncFinishedAt: row.last_sync_finished_at,
            lastSyncStartedAt: row.last_sync_started_at,
            syncStatus: row.sync_status,
        };
    } finally {
        await core.close();
    }
}

async function seedSyncWorkerState(
    userId: string,
    state: "healthy" | "running" | "error",
) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const now = Date.now();
    const isRunning = state === "running";
    const lastError = state === "error" ? "E2E temporary sync failure" : null;
    const lastSummary = JSON.stringify({
        newRecordings: 0,
        updatedRecordings: 0,
        removedRecordings: 0,
        errorCount: state === "error" ? 1 : 0,
    });
    try {
        await core.execute({
            sql: `
                INSERT INTO sync_worker_state (
                    id, user_id, last_heartbeat_at, last_started_at,
                    last_finished_at, next_run_at, manual_trigger_requested_at,
                    is_running, last_error, last_summary, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    last_heartbeat_at = excluded.last_heartbeat_at,
                    last_started_at = excluded.last_started_at,
                    last_finished_at = excluded.last_finished_at,
                    next_run_at = excluded.next_run_at,
                    manual_trigger_requested_at = NULL,
                    is_running = excluded.is_running,
                    last_error = excluded.last_error,
                    last_summary = excluded.last_summary,
                    updated_at = excluded.updated_at
            `,
            args: [
                `${STACK_RECORDING_PREFIX}worker`,
                userId,
                now,
                now - 1_000,
                isRunning ? null : now,
                now + 300_000,
                isRunning ? 1 : 0,
                lastError,
                lastSummary,
                now,
                now,
            ],
        });
    } finally {
        await core.close();
    }
}

async function seedStackSourceConnection(userId: string) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const now = Date.now();
    const secretConfig = encryptWithPlaywrightE2EKey(
        JSON.stringify({ sessionId: "e2e-source-stack-session" }),
    );

    try {
        await core.execute({
            sql: `
                INSERT INTO source_connections (
                    id, user_id, provider, enabled, auth_mode, base_url,
                    config, secret_config, last_sync, sync_status,
                    last_sync_error, last_sync_started_at, last_sync_finished_at,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, provider) DO UPDATE SET
                    id = excluded.id,
                    enabled = excluded.enabled,
                    auth_mode = excluded.auth_mode,
                    base_url = excluded.base_url,
                    config = excluded.config,
                    secret_config = excluded.secret_config,
                    last_sync = excluded.last_sync,
                    sync_status = excluded.sync_status,
                    last_sync_error = excluded.last_sync_error,
                    last_sync_started_at = excluded.last_sync_started_at,
                    last_sync_finished_at = excluded.last_sync_finished_at,
                    updated_at = excluded.updated_at
            `,
            args: [
                STACK_SOURCE_CONNECTION_ID,
                userId,
                "iflyrec",
                1,
                "session-header",
                "https://www.iflyrec.com",
                JSON.stringify({ bizId: "tjzs" }),
                secretConfig,
                now - 60_000,
                "idle",
                null,
                null,
                null,
                now,
                now,
            ],
        });
    } finally {
        await core.close();
    }
}

async function seedStackRecording(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    const recordingId = `${STACK_RECORDING_PREFIX}iflyrec`;
    const audioKey = `${STACK_AUDIO_PREFIX}${recordingId}.wav`;

    try {
        await cleanupStackSeeds(userId);
        await writeStackAudioFixture(audioKey);
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
                recordingId,
                userId,
                "iflyrec",
                `${recordingId}-source`,
                "1",
                "{}",
                `${STACK_RECORDING_PREFIX}device`,
                STACK_RECORDING_TITLE,
                90_000,
                now - 90_000,
                now,
                2048,
                recordingId,
                "local",
                audioKey,
                now,
                0,
                0,
                now,
                now,
            ],
        });
    } finally {
        await library.close();
    }
}

function createSineWaveWavBuffer() {
    const sampleRate = 8_000;
    const sampleCount = sampleRate;
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

async function writeStackAudioFixture(audioKey: string) {
    const audioPath = path.join(E2E_STORAGE_DIR, audioKey);
    assertE2EStoragePath(audioPath);
    await mkdir(path.dirname(audioPath), { recursive: true });
    await writeFile(audioPath, createSineWaveWavBuffer());
}

async function removeStackAudioFixtures() {
    const audioDirectory = path.join(E2E_STORAGE_DIR, STACK_AUDIO_DIR);
    assertE2EStoragePath(audioDirectory);
    await rm(audioDirectory, { recursive: true, force: true });
}

async function seedAutoNextStackRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now() + 7 * 86_400_000;
    const recordings = [
        {
            id: `${STACK_RECORDING_PREFIX}autonext-ticnote-newer`,
            filename: "E2E auto next TicNote newer",
            provider: "ticnote",
            startTime: now,
        },
        {
            id: `${STACK_RECORDING_PREFIX}autonext-plaud-middle`,
            filename: "E2E auto next Plaud middle",
            provider: "plaud",
            startTime: now - 60_000,
        },
        {
            id: `${STACK_RECORDING_PREFIX}autonext-ticnote-older`,
            filename: "E2E auto next TicNote older",
            provider: "ticnote",
            startTime: now - 120_000,
        },
    ];

    try {
        await cleanupStackSeeds(userId);
        for (const recording of recordings) {
            const audioKey = `${STACK_AUDIO_PREFIX}${recording.id}.wav`;
            await writeStackAudioFixture(audioKey);
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
                    recording.id,
                    userId,
                    recording.provider,
                    `${recording.id}-source`,
                    "1",
                    "{}",
                    `${STACK_RECORDING_PREFIX}autonext-device`,
                    recording.filename,
                    60_000,
                    recording.startTime,
                    recording.startTime + 60_000,
                    2_048,
                    recording.id,
                    "local",
                    audioKey,
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            });
        }
    } finally {
        await library.close();
    }
}

async function openRealDashboard(page: Page) {
    const displayResponse = await putJsonWithRetry(
        page,
        "/api/settings/display",
        {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "dark",
            uiLanguage: "en",
        },
    );
    expect(displayResponse.ok()).toBe(true);

    await page.goto("about:blank");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(recordingRow(page, STACK_SOURCE_CONNECTION_ID)).toBeVisible();
    await expect(
        page.getByRole("heading", { name: STACK_RECORDING_TITLE }),
    ).toHaveCount(1);
    await expect(page.locator('[data-list="dashboard-sources"]')).toHaveAttribute(
        "data-state",
        "ready",
    );
}

function dashboardWorkstation(page: Page) {
    return page.locator('[data-surface="dashboard-workstation"]');
}

function sourceProvider(page: Page, provider: string) {
    return page.locator(
        `[data-control="dashboard-source-provider"][data-provider="${provider}"]`,
    );
}

function sourceFilterStack(page: Page) {
    return page.locator('[data-panel="dashboard-source-filter-stack"]');
}

function sourceProviderDetail(page: Page, provider: string) {
    return page
        .getByRole("dialog")
        .locator(
            `[data-panel="source-provider-detail"][aria-labelledby="data-source-${provider}-title"]`,
        );
}

function sourceFilterAction(page: Page, control: string) {
    return page.locator(`[data-control="${control}"]`);
}

function favoriteControl(page: Page, favorite: string) {
    return page.locator(
        `[data-control="dashboard-favorite"][data-filter="${favorite}"]`,
    );
}

function recordingRow(page: Page, recordingId: string) {
    return page.locator(
        `[data-control="dashboard-recording-row"][data-recording-id="${recordingId}"]`,
    );
}

function sourceRow(page: Page) {
    return page
        .getByRole("button", { name: /iflyrec|讯飞听见/i })
        .first();
}

function screenshotRegion(region: Locator) {
    return region.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
}

async function requireVerifiedCanonicalSotReference() {
    const canonicalSotAudit = await resolveVerifiedCanonicalSotReference();
    if (!canonicalSotAudit.available) {
        throw new Error(canonicalSotAudit.reason);
    }

    assertCanonicalSotReferenceMatchesRecovery(canonicalSotAudit.snapshot);
    return canonicalSotAudit;
}

async function auditPixelParity(
    page: Page,
    expected: Buffer,
    actual: Buffer,
) {
    return page.evaluate(
        async ({ actualSource, expectedSource }) => {
            const loadImage = (source: string) =>
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = () =>
                        reject(new Error("Unable to decode dashboard screenshot"));
                    image.src = source;
                });
            const [expectedImage, actualImage] = await Promise.all([
                loadImage(expectedSource),
                loadImage(actualSource),
            ]);
            const dimensionsMatch =
                expectedImage.naturalWidth === actualImage.naturalWidth &&
                expectedImage.naturalHeight === actualImage.naturalHeight;

            if (!dimensionsMatch) {
                return {
                    actual: {
                        height: actualImage.naturalHeight,
                        width: actualImage.naturalWidth,
                    },
                    differingPixels: Number.POSITIVE_INFINITY,
                    expected: {
                        height: expectedImage.naturalHeight,
                        width: expectedImage.naturalWidth,
                    },
                    maxChannelDelta: Number.POSITIVE_INFINITY,
                };
            }

            const expectedCanvas = document.createElement("canvas");
            expectedCanvas.width = expectedImage.naturalWidth;
            expectedCanvas.height = expectedImage.naturalHeight;
            const actualCanvas = document.createElement("canvas");
            actualCanvas.width = actualImage.naturalWidth;
            actualCanvas.height = actualImage.naturalHeight;
            const expectedContext = expectedCanvas.getContext("2d");
            const actualContext = actualCanvas.getContext("2d");
            if (!expectedContext || !actualContext) {
                throw new Error("Canvas 2D context is unavailable");
            }

            expectedContext.drawImage(expectedImage, 0, 0);
            actualContext.drawImage(actualImage, 0, 0);
            const expectedPixels = expectedContext.getImageData(
                0,
                0,
                expectedCanvas.width,
                expectedCanvas.height,
            ).data;
            const actualPixels = actualContext.getImageData(
                0,
                0,
                actualCanvas.width,
                actualCanvas.height,
            ).data;
            let differingPixels = 0;
            let maxChannelDelta = 0;

            for (let index = 0; index < expectedPixels.length; index += 4) {
                const channelDelta = Math.max(
                    Math.abs(expectedPixels[index] - actualPixels[index]),
                    Math.abs(
                        expectedPixels[index + 1] - actualPixels[index + 1],
                    ),
                    Math.abs(
                        expectedPixels[index + 2] - actualPixels[index + 2],
                    ),
                    Math.abs(
                        expectedPixels[index + 3] - actualPixels[index + 3],
                    ),
                );
                maxChannelDelta = Math.max(maxChannelDelta, channelDelta);
                if (channelDelta !== 0) {
                    differingPixels += 1;
                }
            }

            return {
                actual: {
                    height: actualImage.naturalHeight,
                    width: actualImage.naturalWidth,
                },
                differingPixels,
                expected: {
                    height: expectedImage.naturalHeight,
                    width: expectedImage.naturalWidth,
                },
                maxChannelDelta,
            };
        },
        {
            actualSource: `data:image/png;base64,${actual.toString("base64")}`,
            expectedSource: `data:image/png;base64,${expected.toString("base64")}`,
        },
    );
}

async function expectExactAuditedSotVisualParity(
    page: Page,
    expected: Buffer,
    actual: Buffer,
    region: string,
) {
    const audit = await auditPixelParity(page, expected, actual);
    const label = `${region} ${JSON.stringify(audit)}`;

    expect(audit.actual).toEqual(audit.expected);
    expect(audit.differingPixels, label).toBe(
        EXACT_SOT_VISUAL_ACCEPTANCE.maxDifferingPixels,
    );
    expect(audit.maxChannelDelta, label).toBe(
        EXACT_SOT_VISUAL_ACCEPTANCE.maxChannelDelta,
    );
}

test("canonical SOT dashboard reference manifest remains verified and unchanged", async () => {
    const canonicalSotAudit = await requireVerifiedCanonicalSotReference();
    const canonicalSotReferenceAfter = await snapshotCanonicalSotReference(
        canonicalSotAudit.reference,
    );

    assertCanonicalSotReferenceMatchesRecovery(canonicalSotReferenceAfter);
    assertCanonicalSotReferenceUnchanged(
        canonicalSotAudit.snapshot,
        canonicalSotReferenceAfter,
    );
});

test("strict dashboard SourceRow needs-setup active state matches SOT source row pixels", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    const canonicalSotAudit = await requireVerifiedCanonicalSotReference();
    const sotPage = await page.context().newPage();
    await sotPage.setViewportSize({ width: 1280, height: 760 });

    try {
        await sotPage.goto(canonicalSotAudit.reference.webIndexUrl, {
            waitUntil: "load",
        });
        const canonicalSourceRow = sourceRow(sotPage);
        await expect(canonicalSourceRow).toBeVisible();
        await canonicalSourceRow.click();
        await expect(canonicalSourceRow).toHaveClass(/is-active-filter/);
        const canonicalCapture = await screenshotRegion(canonicalSourceRow);

        await seedStackRecording(userId);
        await openRealDashboard(page);

        const iflyrecRow = sourceProvider(page, "iflyrec");
        await expect(iflyrecRow).toBeVisible();
        await expect(iflyrecRow).toHaveAttribute("data-status", "needs-setup");
        await expect(iflyrecRow).toHaveAttribute("data-state", "needs-setup");
        await iflyrecRow.click();
        await expect(iflyrecRow).toHaveAttribute("aria-pressed", "true");
        await expect(iflyrecRow).toHaveAttribute("data-state", "needs-setup");
        await expect(iflyrecRow).toHaveAttribute("data-status", "needs-setup");

        const productCapture = await screenshotRegion(iflyrecRow);
        const connectAction = iflyrecRow.locator(
            '[data-part="source-provider-action"][data-action="connect"]',
        );
        await expect(connectAction).toBeVisible();
        await connectAction.click();
        await expect(sourceProviderDetail(page, "iflyrec")).toBeVisible();
        await expectExactAuditedSotVisualParity(
            page,
            canonicalCapture,
            productCapture,
            "dashboard sidebar iFlyrec source row",
        );
    } finally {
        await sotPage.close();
        await cleanupStackSeeds(userId);
        const canonicalSotReferenceAfter = await snapshotCanonicalSotReference(
            canonicalSotAudit.reference,
        );
        assertCanonicalSotReferenceMatchesRecovery(canonicalSotReferenceAfter);
        assertCanonicalSotReferenceUnchanged(
            canonicalSotAudit.snapshot,
            canonicalSotReferenceAfter,
        );
    }
});

test("dashboard source filter stack clears and resets in English display language", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedStackRecording(userId);
        await seedStackSourceConnection(userId);
        await openRealDashboard(page);

        const iflyrecRow = sourceProvider(page, "iflyrec");
        await expect(iflyrecRow).toBeVisible();
        await expect(iflyrecRow).toHaveAttribute("data-status", "connected");
        await expect(iflyrecRow).toHaveAttribute(
            "data-state",
            "connected-idle",
        );
        await iflyrecRow.click();
        await expect(iflyrecRow).toHaveAttribute("aria-pressed", "true");
        await expect(iflyrecRow).toHaveAttribute(
            "data-state",
            "connected-active",
        );

        const stack = sourceFilterStack(page);
        await expect(stack).toBeVisible();
        await expect(stack).toContainText("Filter");
        await expect(stack).toContainText("All recordings");
        await expect(stack).toContainText("Showing");
        await expect(
            stack.getByRole("button", { name: "Clear source filter" }),
        ).toBeVisible();

        const clearSource = page.locator('[data-control="dashboard-source-clear"]');
        await expect(clearSource).toBeVisible();
        await clearSource.click();
        await expect(stack).toBeHidden();
        await expect(iflyrecRow).toHaveAttribute("aria-pressed", "false");

        await iflyrecRow.click();
        await expect(stack).toBeVisible();
        const clearAll = sourceFilterAction(page, "source-filter-clear-all");
        await expect(clearAll).toHaveAccessibleName("Clear all");
        await clearAll.click();
        await expect(stack).toBeHidden();

        await iflyrecRow.click();
        const clearChip = sourceFilterAction(page, "source-filter-clear");
        await expect(clearChip).toHaveAccessibleName("Clear source filter");
        await clearChip.click();
        await expect(stack).toBeHidden();
    } finally {
        await cleanupStackSeeds(userId);
    }
});

test("dashboard source setup rows open Data Sources provider detail", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedStackRecording(userId);
        await openRealDashboard(page);

        const iflyrecRow = sourceProvider(page, "iflyrec");
        await expect(iflyrecRow).toHaveAttribute("data-status", "needs-setup");
        const connectAction = iflyrecRow.locator(
            '[data-part="source-provider-action"][data-action="connect"]',
        );
        await expect(connectAction).toBeVisible();
        await connectAction.click();

        await expect(sourceProviderDetail(page, "iflyrec")).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(() =>
                    window.localStorage.getItem(
                        "settings-data-source-provider",
                    ),
                ),
            )
            .toBe("iflyrec");
    } finally {
        await cleanupStackSeeds(userId);
    }
});

test("dashboard source rows reflect expired paused and syncing backend states", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedStackRecording(userId);
        await seedSourceConnection(userId, "ticnote", {
            config: { connectionStatus: "expired" },
        });
        await seedSourceConnection(userId, "plaud", { enabled: false });
        await seedSourceConnection(userId, "iflyrec");
        await seedSyncWorkerState(userId, "running");
        await openRealDashboard(page);

        const expiredRow = sourceProvider(page, "ticnote");
        await expect(expiredRow).toHaveAttribute("data-status", "expired");
        await expect(expiredRow).toHaveAttribute("data-state", "expired");

        const pausedRow = sourceProvider(page, "plaud");
        await expect(pausedRow).toHaveAttribute("data-status", "paused");
        await expect(pausedRow).toHaveAttribute("data-state", "disabled");
        await expect(pausedRow).toBeDisabled();

        const syncingRow = sourceProvider(page, "iflyrec");
        await expect(syncingRow).toHaveAttribute("data-status", "syncing");
        await expect(syncingRow).toHaveAttribute("data-state", "syncing");
        await syncingRow.click();
        await expect(sourceFilterStack(page)).toHaveAttribute(
            "data-status",
            "syncing",
        );

        const reauthAction = expiredRow.locator(
            '[data-part="source-provider-action"][data-action="reauth"]',
        );
        await expect(reauthAction).toBeVisible();
        await reauthAction.click();
        await expect(sourceProviderDetail(page, "ticnote")).toBeVisible();
        await expect
            .poll(() =>
                page.evaluate(() =>
                    window.localStorage.getItem(
                        "settings-data-source-provider",
                    ),
                ),
            )
            .toBe("ticnote");
    } finally {
        await cleanupStackSeeds(userId);
    }
});

test("dashboard auto-play next stays inside the active source filter", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedAutoNextStackRecordings(userId);
        await seedSourceConnection(userId, "ticnote");
        await seedSourceConnection(userId, "plaud");
        await seedSyncWorkerState(userId, "healthy");
        const playbackResponse = await page.request.put(
            "/api/settings/playback",
            {
                data: {
                    autoPlayNext: true,
                    defaultPlaybackSpeed: 1,
                    defaultVolume: 75,
                },
            },
        );
        expect(playbackResponse.ok()).toBe(true);

        const displayResponse = await putJsonWithRetry(
            page,
            "/api/settings/display",
            {
                dateTimeFormat: "relative",
                itemsPerPage: 50,
                recordingListSortOrder: "newest",
                theme: "dark",
                uiLanguage: "en",
            },
        );
        expect(displayResponse.ok()).toBe(true);
        await page.goto("about:blank");
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        const workstation = dashboardWorkstation(page);
        await expect(workstation).toHaveAttribute(
            "data-playback-settings-loaded",
            "true",
        );
        await expect(workstation).toHaveAttribute(
            "data-playback-auto-next",
            "true",
        );

        const ticnoteRow = sourceProvider(page, "ticnote");
        await expect(ticnoteRow).toHaveAttribute("data-status", "connected");
        await ticnoteRow.click();

        const newerItem = recordingRow(
            page,
            `${STACK_RECORDING_PREFIX}autonext-ticnote-newer`,
        );
        await newerItem.click();
        await expect(newerItem).toHaveAttribute("data-state", "selected");
        await page.locator("audio").dispatchEvent("ended");

        const olderItem = recordingRow(
            page,
            `${STACK_RECORDING_PREFIX}autonext-ticnote-older`,
        );
        await expect(olderItem).toHaveAttribute("data-state", "selected");
        await expect(
            recordingRow(
                page,
                `${STACK_RECORDING_PREFIX}autonext-plaud-middle`,
            ),
        ).toHaveCount(0);
        await expect(workstation).toHaveAttribute(
            "data-source-filter-provider",
            "ticnote",
        );
    } finally {
        await removeStackAudioFixtures();
        await cleanupStackSeeds(userId);
    }
});

test("dashboard responsive source rail opens as a mobile drawer and collapses on desktop", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedStackRecording(userId);
        await seedStackSourceConnection(userId);
        await page.evaluate(() =>
            window.localStorage.removeItem("dashboard-sidebar-collapsed"),
        );
        await openRealDashboard(page);

        const workstation = dashboardWorkstation(page);
        const drawerTrigger = sourceFilterAction(
            page,
            "dashboard-drawer-trigger",
        );
        await expect(workstation).toHaveAttribute("data-drawer-state", "closed");
        await expect(drawerTrigger).toBeVisible();
        await drawerTrigger.click();
        await expect(workstation).toHaveAttribute("data-drawer-state", "open");
        await expect(page.locator('[data-panel="dashboard-sidebar"]')).toBeVisible();

        await sourceProvider(page, "iflyrec").click();
        await expect(workstation).toHaveAttribute("data-drawer-state", "closed");
        await expect(workstation).toHaveAttribute(
            "data-source-filter-provider",
            "iflyrec",
        );

        await drawerTrigger.click();
        await page.keyboard.press("Escape");
        await expect(workstation).toHaveAttribute("data-drawer-state", "closed");
        await expect(drawerTrigger).toBeFocused();

        await page.setViewportSize({ width: 1440, height: 900 });
        const collapse = sourceFilterAction(page, "sidebar-collapse");
        await expect(collapse).toBeVisible();
        await collapse.click();
        await expect(workstation).toHaveAttribute(
            "data-sidebar-collapsed",
            "true",
        );
        await expect(page.locator('[data-list="dashboard-sources"]')).toHaveAttribute(
            "data-compact",
            "true",
        );
    } finally {
        await cleanupStackSeeds(userId);
    }
});

test("dashboard source filter stack retries sync errors through the real endpoint and restores active state", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedStackRecording(userId);
        await seedSourceConnection(userId, "iflyrec", { syncStatus: "error" });
        await seedSyncWorkerState(userId, "error");
        const errorState = await readSourceConnectionSyncState(userId);
        expect(errorState.syncStatus).toBe("error");
        expect(errorState.lastSyncError).toBe("E2E sync error");
        const initialStatusResponse = await page.request.get(
            "/api/data-sources/sync",
        );
        expect(initialStatusResponse.ok()).toBe(true);
        expect(await initialStatusResponse.json()).toMatchObject({
            configured: true,
            workerStatus: {
                healthy: true,
                isRunning: false,
                lastError: expect.any(String),
            },
        });
        await openRealDashboard(page);

        const iflyrecRow = sourceProvider(page, "iflyrec");
        await expect(iflyrecRow).toHaveAttribute("data-status", "sync-error");
        await iflyrecRow.click();
        const stack = sourceFilterStack(page);
        await expect(stack).toHaveAttribute("data-state", "sync-error");

        await seedSourceConnection(userId, "iflyrec", {
            enabled: false,
            syncStatus: "error",
        });
        const disabledState = await readSourceConnectionSyncState(userId);
        expect(disabledState.syncStatus).toBe("error");
        expect(disabledState.lastSyncError).toBe("E2E sync error");

        const syncResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources/sync") &&
                response.request().method() === "POST",
        );
        await sourceFilterAction(page, "source-filter-retry-sync").click();
        const response = await syncResponse;
        expect(response.status()).toBe(400);

        const rejectedStatusResponse = await page.request.get(
            "/api/data-sources/sync",
        );
        expect(rejectedStatusResponse.ok()).toBe(true);
        expect(await rejectedStatusResponse.json()).toMatchObject({
            configured: false,
            workerStatus: {
                healthy: true,
                isRunning: false,
                lastError: expect.any(String),
            },
        });

        await seedSourceConnection(userId, "iflyrec", { syncStatus: "idle" });
        await seedSyncWorkerState(userId, "healthy");

        const recoveredState = await readSourceConnectionSyncState(userId);
        expect(recoveredState.syncStatus).toBe("idle");
        expect(recoveredState.lastSyncError).toBeNull();
        const recoveredStatusResponse = await page.request.get(
            "/api/data-sources/sync",
        );
        expect(recoveredStatusResponse.ok()).toBe(true);
        expect(await recoveredStatusResponse.json()).toMatchObject({
            configured: true,
            workerStatus: {
                healthy: true,
                isRunning: false,
                lastError: null,
            },
        });

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(iflyrecRow).toBeVisible();
        await expect(iflyrecRow).toHaveAttribute("data-status", "connected");
        await iflyrecRow.click();
        await expect(stack).toHaveAttribute("data-state", "active");
        await expect(iflyrecRow).toHaveAttribute(
            "data-state",
            "connected-active",
        );
    } finally {
        await cleanupStackSeeds(userId);
    }
});

test("dashboard source filter stack widens no-result favorite filters and resets all filters", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedStackRecording(userId);
        await seedStackSourceConnection(userId);
        await seedSyncWorkerState(userId, "healthy");
        await openRealDashboard(page);

        const iflyrecRow = sourceProvider(page, "iflyrec");
        await iflyrecRow.click();
        const transcribed = favoriteControl(page, "transcribed");
        await transcribed.click();
        await expect(transcribed).toHaveAttribute("data-state", "selected");

        const stack = sourceFilterStack(page);
        await expect(stack).toHaveAttribute("data-state", "no-results");
        await expect(iflyrecRow).toHaveAttribute("data-state", "no-results");
        await expect(stack).toContainText(/no matches/i);

        await sourceFilterAction(page, "source-filter-widen").click();
        await expect(stack).toHaveAttribute("data-state", "active");
        await expect(favoriteControl(page, "all")).toHaveAttribute(
            "data-state",
            "selected",
        );
        await expect(iflyrecRow).toHaveAttribute(
            "data-state",
            "connected-active",
        );

        await sourceFilterAction(page, "source-filter-clear-all").click();
        await expect(stack).toBeHidden();
        await expect(dashboardWorkstation(page)).toHaveAttribute(
            "data-source-filter-active",
            "false",
        );
    } finally {
        await cleanupStackSeeds(userId);
    }
});
