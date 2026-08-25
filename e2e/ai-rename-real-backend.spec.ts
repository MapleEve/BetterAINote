import path from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { ensureSignedIn, putJsonWithRetry } from "./helpers/auth";

const PLAYWRIGHT_USER_EMAIL = "playwright-admin@example.com";
const RECORDING_PREFIX = "e2e-ai-rename-real-";
const UNAVAILABLE_RECORDING_ID = `${RECORDING_PREFIX}unavailable`;
const PROVIDER_ERROR_RECORDING_ID = `${RECORDING_PREFIX}provider-error`;
const E2E_ROOT_MARKER = ".betterainote-e2e-root";

function requireIsolatedE2ERoot() {
    const configuredRoot = process.env.PLAYWRIGHT_E2E_ROOT?.trim();
    if (!configuredRoot) {
        throw new Error(
            "AI rename E2E requires PLAYWRIGHT_E2E_ROOT from scripts/e2e-setup.mjs",
        );
    }

    const root = path.resolve(configuredRoot);
    const worktree = path.resolve(process.cwd());
    if (root === worktree) {
        throw new Error(
            "AI rename E2E requires a disposable root outside the worktree",
        );
    }

    return root;
}

const E2E_ROOT = requireIsolatedE2ERoot();

function assertMarkedDisposableE2ERoot() {
    if (!existsSync(path.join(E2E_ROOT, E2E_ROOT_MARKER))) {
        throw new Error(
            "AI rename E2E requires scripts/e2e-setup.mjs to initialize its marked root",
        );
    }
}

function assertE2EDataPath(filePath: string) {
    const dataDirectory = path.join(E2E_ROOT, "data");
    const relativePath = path.relative(dataDirectory, path.resolve(filePath));
    if (
        relativePath.length === 0 ||
        relativePath === ".." ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
    ) {
        throw new Error(`Refusing non-E2E database path: ${filePath}`);
    }
}

function resolveDatabasePath() {
    const configuredDatabasePath = process.env.DATABASE_PATH?.trim();
    if (!configuredDatabasePath) {
        throw new Error(
            "AI rename E2E requires DATABASE_PATH from scripts/e2e-setup.mjs",
        );
    }

    const databasePath = path.resolve(configuredDatabasePath);
    assertE2EDataPath(databasePath);
    return databasePath;
}

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.resolve(
        parsed.dir,
        `${parsed.name}-${suffix}${parsed.ext || ".db"}`,
    );
}

function databaseUrl(filePath: string) {
    assertE2EDataPath(filePath);
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");

for (const databasePath of [CORE_DB, LIBRARY_DB, TRANSCRIPTS_DB]) {
    assertE2EDataPath(databasePath);
}

function reportIsolatedDatabasePaths(testInfo: TestInfo) {
    console.info(
        [
            "AI rename E2E isolated SQLite",
            `worker=${testInfo.workerIndex}`,
            `root=${E2E_ROOT}`,
            `core=${CORE_DB}`,
            `library=${LIBRARY_DB}`,
            `transcripts=${TRANSCRIPTS_DB}`,
        ].join(" | "),
    );
}

function assertInitializedE2EDatabaseLayout() {
    for (const databasePath of [CORE_DB, LIBRARY_DB, TRANSCRIPTS_DB]) {
        if (!existsSync(databasePath)) {
            throw new Error(
                `AI rename E2E database was not initialized: ${databasePath}`,
            );
        }
    }
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

async function cleanupAiRenameSeeds() {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
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
}

async function seedRecording(userId: string, id: string, filename: string) {
    const now = Date.now();
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
                    id,
                    userId,
                    "ticnote",
                    `${id}-source`,
                    "1",
                    "{}",
                    "e2e-ai-rename-device",
                    filename,
                    60_000,
                    now - 60_000,
                    now,
                    0,
                    `${id}-md5`,
                    "local",
                    "",
                    null,
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
                    `${id}-transcript`,
                    id,
                    userId,
                    "Speaker 1: AI rename failure states must preserve real API feedback.",
                    "en",
                    "server",
                    "voice-transcribe",
                    "e2e",
                    `${id}-job`,
                    "{}",
                    "{}",
                    now,
                ],
            }),
        );
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function clearTitleGenerationProvider(page: Page) {
    const response = await putJsonWithRetry(page, "/api/settings/title-generation", {
        titleGenerationApiKey: null,
        titleGenerationBaseUrl: null,
        titleGenerationModel: null,
    });
    expect(response.ok()).toBe(true);
}

async function saveUnreachableTitleGenerationProvider(page: Page) {
    const response = await putJsonWithRetry(page, "/api/settings/title-generation", {
        titleGenerationApiKey: "e2e-invalid-title-provider-key",
        titleGenerationBaseUrl: "http://127.0.0.1:9/v1",
        titleGenerationModel: "e2e-unreachable-model",
    });
    expect(response.ok()).toBe(true);
}

function aiRenameTrigger(page: Page) {
    return page.getByRole("button", { name: "AI 重命名", exact: true });
}

function aiRenamePanel(page: Page) {
    return page.locator('[data-control="ai-rename-preview"]');
}

async function openRecording(page: Page, recordingId: string) {
    await page.goto(`/recordings/${recordingId}`, { waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-surface="recording-workstation"]'),
    ).toHaveAttribute("data-state", "ready");
}

test.beforeEach(async ({}, testInfo) => {
    assertMarkedDisposableE2ERoot();
    assertInitializedE2EDatabaseLayout();
    reportIsolatedDatabasePaths(testInfo);
});

test.afterEach(async ({ page }) => {
    await clearTitleGenerationProvider(page);
    await cleanupAiRenameSeeds();
});

test("AI rename exposes a keyboard-dismissible unavailable panel without a configured provider", async ({
    page,
}) => {
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    await clearTitleGenerationProvider(page);
    await cleanupAiRenameSeeds();
    await seedRecording(userId, UNAVAILABLE_RECORDING_ID, "E2E unavailable AI rename");

    await openRecording(page, UNAVAILABLE_RECORDING_ID);
    const trigger = aiRenameTrigger(page);
    await expect(trigger).toHaveAttribute("data-state", "unavailable");
    await trigger.focus();
    await page.keyboard.press("Enter");

    const panel = aiRenamePanel(page);
    await expect(panel).toHaveAttribute("data-state", "unavailable");
    await expect(panel.getByRole("alert")).toContainText(
        "AI 重命名服务尚未配置或暂时不可用。",
    );
    await expect(panel.getByRole("button", { name: "应用", exact: true })).toBeDisabled();
    await expect(
        panel.getByRole("button", { name: "重新生成", exact: true }),
    ).toBeDisabled();

    await panel.getByRole("button", { name: "关闭预览", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
});

test("AI rename surfaces a real unreachable-provider error and retries through the API", async ({
    page,
}) => {
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    await clearTitleGenerationProvider(page);
    await cleanupAiRenameSeeds();
    await saveUnreachableTitleGenerationProvider(page);
    await seedRecording(
        userId,
        PROVIDER_ERROR_RECORDING_ID,
        "E2E unreachable AI rename provider",
    );

    await openRecording(page, PROVIDER_ERROR_RECORDING_ID);
    const trigger = aiRenameTrigger(page);
    await expect(trigger).toHaveAttribute("data-state", "idle");

    let autoRenameRequestCount = 0;
    page.on("request", (request) => {
        if (
            new URL(request.url()).pathname ===
                `/api/recordings/${PROVIDER_ERROR_RECORDING_ID}/rename/auto` &&
            request.method() === "POST"
        ) {
            autoRenameRequestCount += 1;
        }
    });

    const firstResponse = page.waitForResponse((response) => {
        const request = response.request();
        return (
            new URL(response.url()).pathname ===
                `/api/recordings/${PROVIDER_ERROR_RECORDING_ID}/rename/auto` &&
            request.method() === "POST"
        );
    });
    await trigger.click();
    expect((await firstResponse).status()).toBe(500);

    const panel = aiRenamePanel(page);
    await expect(panel).toHaveAttribute("data-state", "error");
    await expect(panel.getByRole("alert")).toContainText(
        "Failed to generate filename",
    );
    await expect(
        panel.getByRole("button", { name: "应用", exact: true }),
    ).toBeDisabled();
    await expect(panel.getByRole("button", { name: "重试", exact: true })).toBeEnabled();

    const retryResponse = page.waitForResponse((response) => {
        const request = response.request();
        return (
            new URL(response.url()).pathname ===
                `/api/recordings/${PROVIDER_ERROR_RECORDING_ID}/rename/auto` &&
            request.method() === "POST"
        );
    });
    await panel.getByRole("button", { name: "重试", exact: true }).click();
    expect((await retryResponse).status()).toBe(500);
    await expect(panel).toHaveAttribute("data-state", "error");
    expect(autoRenameRequestCount).toBe(2);
});
