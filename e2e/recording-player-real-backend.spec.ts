import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_ROOT = path.resolve(
    process.env.PLAYWRIGHT_E2E_ROOT ?? path.join(process.cwd(), "tmp/e2e"),
);
const E2E_STORAGE_DIR = process.env.PLAYWRIGHT_E2E_STORAGE_DIR
    ? path.resolve(process.cwd(), process.env.PLAYWRIGHT_E2E_STORAGE_DIR)
    : path.join(E2E_ROOT, "storage");
const RECORDING_ID = "e2e-recording-player-real-backend";
const RECORDING_PREFIX = "e2e-recording-player-real-%";
const AUDIO_STORAGE_PATH = "e2e/recording-player-real-backend.wav";
const PLAYWRIGHT_USER_EMAIL = "playwright-admin@example.com";

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(E2E_ROOT, "data", "betterainote-e2e.db");
}

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.resolve(
        parsed.dir,
        `${parsed.name}-${suffix}${parsed.ext || ".db"}`,
    );
}

function databaseUrl(filePath: string) {
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");

function assertE2EPath(filePath: string) {
    const resolved = path.resolve(filePath);
    if (resolved !== E2E_ROOT && !resolved.startsWith(`${E2E_ROOT}${path.sep}`)) {
        throw new Error(`Refusing to mutate non-E2E path: ${resolved}`);
    }
}

for (const filePath of [CORE_DB, LIBRARY_DB, E2E_STORAGE_DIR]) {
    assertE2EPath(filePath);
}

async function executeWithBusyRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (
                !(error instanceof Error) ||
                !error.message.includes("SQLITE_BUSY") ||
                attempt === 7
            ) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
        }
    }

    throw lastError;
}

function createWavFixture() {
    const sampleRate = 8_000;
    const durationSeconds = 12;
    const sampleCount = sampleRate * durationSeconds;
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

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await client.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: [PLAYWRIGHT_USER_EMAIL],
        });
        const userId = result.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Playwright user not found");
        }
        return userId;
    } finally {
        await client.close();
    }
}

async function cleanupRecordingPlayerSeed() {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const audioPath = path.join(E2E_STORAGE_DIR, AUDIO_STORAGE_PATH);
    assertE2EPath(audioPath);

    try {
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM transcription_jobs WHERE recording_id LIKE ?",
                args: [RECORDING_PREFIX],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recordings WHERE id LIKE ?",
                args: [RECORDING_PREFIX],
            }),
        );
    } finally {
        await library.close();
    }

    await rm(audioPath, { force: true });
}

async function seedRecordingPlayer(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const audioPath = path.join(E2E_STORAGE_DIR, AUDIO_STORAGE_PATH);
    const now = Date.now();
    assertE2EPath(audioPath);

    try {
        await mkdir(path.dirname(audioPath), { recursive: true });
        await writeFile(audioPath, createWavFixture());
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
                    RECORDING_ID,
                    userId,
                    "ticnote",
                    `${RECORDING_ID}-source`,
                    "1",
                    "{}",
                    "e2e-recording-player-device",
                    "E2E recording player backend WAV",
                    12_000,
                    now - 12_000,
                    now,
                    createWavFixture().byteLength,
                    "e2e-recording-player-wav",
                    "local",
                    AUDIO_STORAGE_PATH,
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            }),
        );
    } finally {
        await library.close();
    }
}

function player(page: Page) {
    return page.locator('[data-control="recording-player"]');
}

function seekControl(page: Page) {
    return page.locator('[data-control="recording-player-seek"]');
}

function seekThumb(page: Page) {
    return seekControl(page).getByRole("slider", { name: "播放进度" });
}

function volumeControl(page: Page) {
    return page.locator('[data-control="recording-player-volume-slider"]');
}

function volumeThumb(page: Page) {
    return volumeControl(page).getByRole("slider", { name: "音量" });
}

test.afterEach(async () => {
    await cleanupRecordingPlayerSeed();
});

test("recording player uses the isolated SQLite audio record through real browser controls", async ({
    page,
}) => {
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    await cleanupRecordingPlayerSeed();
    await seedRecordingPlayer(userId);

    const audioResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            url.pathname === `/api/recordings/${RECORDING_ID}/audio` &&
            response.request().resourceType() === "media"
        );
    });
    await page.goto(`/recordings/${RECORDING_ID}`, {
        waitUntil: "domcontentloaded",
    });
    const audioResponse = await audioResponsePromise;

    expect(audioResponse.ok()).toBe(true);
    expect(audioResponse.headers()["content-type"]).toContain("audio/wav");
    await expect(player(page)).toBeVisible();

    const playPause = page.getByRole("button", { name: "播放", exact: true });
    await expect(playPause).toBeEnabled();
    await expect(seekThumb(page)).toHaveAttribute("aria-valuenow", "0");

    await playPause.click();
    await expect(player(page)).toHaveAttribute("data-playing", "true");
    await expect(
        page.getByRole("button", { name: "暂停", exact: true }),
    ).toBeVisible();

    await page.keyboard.press("Space");
    await expect(player(page)).not.toHaveAttribute("data-playing", "true");
    await expect(playPause).toBeVisible();

    const seekBox = await seekControl(page).boundingBox();
    if (!seekBox) {
        throw new Error("Playback seek control has no visible layout box");
    }
    await seekControl(page).click({
        position: { x: seekBox.width * 0.7, y: seekBox.height / 2 },
    });
    await expect(seekControl(page)).toHaveAttribute("data-pct", "70");

    await page.getByRole("button", { name: /^(音量 \d+)$/ }).click();
    await expect(volumeControl(page)).toBeVisible();
    await volumeThumb(page).focus();
    await page.keyboard.press("End");
    await expect(volumeThumb(page)).toHaveAttribute("aria-valuenow", "100");
    await expect(
        page.getByRole("button", { name: "静音切换", exact: true }),
    ).toHaveAttribute("data-state", "audible");

    const toggleMute = page.getByRole("button", {
        name: "静音切换",
        exact: true,
    });
    await toggleMute.click();
    await expect(toggleMute).toHaveAttribute("data-state", "muted");
    await expect(volumeThumb(page)).toHaveAttribute("aria-valuenow", "0");

    await toggleMute.click();
    await expect(toggleMute).toHaveAttribute("data-state", "audible");
    await expect(volumeThumb(page)).toHaveAttribute("aria-valuenow", "70");
});
