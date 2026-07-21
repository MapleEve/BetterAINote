import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_ROOT = path.resolve(
    process.env.PLAYWRIGHT_E2E_ROOT ?? path.join(process.cwd(), "tmp/e2e"),
);
const E2E_DATA_DIR = process.env.PLAYWRIGHT_E2E_DATA_DIR
    ? path.resolve(process.env.PLAYWRIGHT_E2E_DATA_DIR)
    : path.join(E2E_ROOT, "data");
const CORE_DB = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
const LIBRARY_DB = path.join(
    path.dirname(CORE_DB),
    `${path.basename(CORE_DB, path.extname(CORE_DB))}-library${path.extname(CORE_DB) || ".db"}`,
);
const RECORDING_ID = "e2e-recording-tags-real";
const TAG_PREFIX = "TG-E2E-";

function databaseUrl(filePath: string) {
    return pathToFileURL(filePath).href;
}

function assertIsolatedDatabase(filePath: string) {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(`${E2E_ROOT}${path.sep}`)) {
        throw new Error(`Refusing non-isolated E2E database: ${resolved}`);
    }
    if (!existsSync(path.join(E2E_ROOT, ".betterainote-e2e-root"))) {
        throw new Error(`Missing isolated E2E marker under ${E2E_ROOT}`);
    }
}

async function executeWithBusyRetry<T>(operation: () => Promise<T>) {
    const delays = [50, 100, 200, 400, 800];
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
    assertIsolatedDatabase(CORE_DB);
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await executeWithBusyRetry(() =>
            core.execute({
                sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
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

async function cleanupSeed(userId: string) {
    assertIsolatedDatabase(LIBRARY_DB);
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recording_tag_assignments WHERE user_id = ? AND (recording_id = ? OR tag_id IN (SELECT id FROM recording_tags WHERE user_id = ? AND name LIKE ?))",
                args: [userId, RECORDING_ID, userId, `${TAG_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recording_tags WHERE user_id = ? AND name LIKE ?",
                args: [userId, `${TAG_PREFIX}%`],
            }),
        );
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recordings WHERE user_id = ? AND id = ?",
                args: [userId, RECORDING_ID],
            }),
        );
    } finally {
        await library.close();
    }
}

async function seedRecordingAndTags(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    try {
        await executeWithBusyRetry(() =>
            library.execute({
                sql: `
                    INSERT INTO recordings (
                        id, user_id, source_provider, source_recording_id, source_version,
                        source_metadata, provider_device_id, filename, duration, start_time,
                        end_time, filesize, file_md5, storage_type, storage_path,
                        downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    RECORDING_ID,
                    userId,
                    "manual",
                    RECORDING_ID,
                    "1",
                    "{}",
                    "e2e-tags-device",
                    "E2E tag management recording",
                    60_000,
                    now - 60_000,
                    now,
                    1024,
                    "e2e-tags-md5",
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
        for (const name of ["TG-E2E-One", "TG-E2E-Err"]) {
            await executeWithBusyRetry(() =>
                library.execute({
                    sql: "INSERT INTO recording_tags (id, user_id, name, color, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    args: [
                        `${RECORDING_ID}-${name.replaceAll(" ", "-").toLowerCase()}`,
                        userId,
                        name,
                        "blue",
                        "tag",
                        now,
                        now,
                    ],
                }),
            );
        }
    } finally {
        await library.close();
    }
}

async function assignmentCount(userId: string, tagName: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        const result = await executeWithBusyRetry(() =>
            library.execute({
                sql: "SELECT COUNT(*) AS count FROM recording_tag_assignments assignments JOIN recording_tags tags ON tags.id = assignments.tag_id WHERE assignments.user_id = ? AND assignments.recording_id = ? AND tags.name = ?",
                args: [userId, RECORDING_ID, tagName],
            }),
        );
        return Number(result.rows[0]?.count ?? 0);
    } finally {
        await library.close();
    }
}

async function tagCount(userId: string, tagName: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        const result = await executeWithBusyRetry(() =>
            library.execute({
                sql: "SELECT COUNT(*) AS count FROM recording_tags WHERE user_id = ? AND name = ?",
                args: [userId, tagName],
            }),
        );
        return Number(result.rows[0]?.count ?? 0);
    } finally {
        await library.close();
    }
}

async function deleteTagByName(userId: string, tagName: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        await executeWithBusyRetry(() =>
            library.execute({
                sql: "DELETE FROM recording_tags WHERE user_id = ? AND name = ?",
                args: [userId, tagName],
            }),
        );
    } finally {
        await library.close();
    }
}

async function holdLibraryWriteLock() {
    assertIsolatedDatabase(LIBRARY_DB);
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    await library.execute("BEGIN IMMEDIATE");

    return async () => {
        try {
            await library.execute("ROLLBACK");
        } finally {
            await library.close();
        }
    };
}

function tagManager(page: Page) {
    return page.locator('[data-panel="recording-player-tag-manager-slot"]');
}

async function openTagManager(page: Page) {
    await expect(
        page.locator('[data-shell="recording-workstation"]'),
    ).toHaveAttribute("data-hydrated", "true");
    await page.locator('[data-control="recording-tag-manager"]').first().click();
    await expect(tagManager(page)).toBeVisible();
}

async function openCreateTagDialog(page: Page) {
    await tagManager(page)
        .getByRole("button", { name: "新建标签", exact: true })
        .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "新建标签" })).toBeVisible();
    return dialog;
}

test("recording tag creation uses the dialog and survives a browser reload", async ({
    page,
}) => {
    let userId: string | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await cleanupSeed(userId);
        await seedRecordingAndTags(userId);

        await page.goto(`/recordings/${RECORDING_ID}`, { waitUntil: "domcontentloaded" });
        await openTagManager(page);

        const cancelledDialog = await openCreateTagDialog(page);
        await cancelledDialog
            .getByRole("textbox", { name: "标签名称" })
            .fill("TG-E2E-Cancel");
        await cancelledDialog.getByRole("button", { name: "取消", exact: true }).click();
        await expect(cancelledDialog).toHaveCount(0);
        await expect.poll(() => tagCount(userId!, "TG-E2E-Cancel")).toBe(0);

        const createResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname === "/api/recording-tags" &&
            response.request().method() === "POST" &&
            response.status() === 200,
        );
        const dialog = await openCreateTagDialog(page);
        const input = dialog.getByRole("textbox", { name: "标签名称" });
        await input.fill("TG-E2E-New");
        await input.press("Enter");
        await createResponse;
        await expect(dialog).toHaveCount(0);
        await expect.poll(() => tagCount(userId!, "TG-E2E-New")).toBe(1);
        await expect.poll(() => assignmentCount(userId!, "TG-E2E-New")).toBe(1);

        await page.reload({ waitUntil: "domcontentloaded" });
        await openTagManager(page);
        await expect(
            tagManager(page).getByRole("button", {
                name: "TG-E2E-New",
                exact: true,
            }),
        ).toHaveAttribute("aria-pressed", "true");
    } finally {
        if (userId) {
            await cleanupSeed(userId);
        }
    }
});

test("recording tag deletion persists through a browser reload", async ({ page }) => {
    let userId: string | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await cleanupSeed(userId);
        await seedRecordingAndTags(userId);

        await page.goto(`/recordings/${RECORDING_ID}`, { waitUntil: "domcontentloaded" });
        await openTagManager(page);
        const panel = tagManager(page);

        await panel.getByRole("button", { name: "删除 TG-E2E-One" }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText("TG-E2E-One");
        const deleteResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname.includes("/api/recording-tags/") &&
            response.request().method() === "DELETE" &&
            response.status() === 200,
        );
        await dialog.getByRole("button", { name: "删除标签", exact: true }).click();
        await deleteResponse;
        await expect.poll(() => tagCount(userId!, "TG-E2E-One")).toBe(0);
        await expect.poll(() => assignmentCount(userId!, "TG-E2E-One")).toBe(0);

        await page.reload({ waitUntil: "domcontentloaded" });
        await openTagManager(page);
        await expect(
            tagManager(page).getByRole("button", {
                name: "TG-E2E-One",
                exact: true,
            }),
        ).toHaveCount(0);
    } finally {
        if (userId) {
            await cleanupSeed(userId);
        }
    }
});

test("recording tag creation shows a real API error and retries after the backend state recovers", async ({
    page,
}) => {
    let userId: string | null = null;
    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await cleanupSeed(userId);
        await seedRecordingAndTags(userId);

        await page.goto(`/recordings/${RECORDING_ID}`, { waitUntil: "domcontentloaded" });
        await openTagManager(page);
        const dialog = await openCreateTagDialog(page);
        const input = dialog.getByRole("textbox", { name: "标签名称" });
        await input.fill("TG-E2E-Err");
        const failureResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname === "/api/recording-tags" &&
            response.request().method() === "POST" &&
            response.status() === 409,
        );
        await input.press("Enter");
        await failureResponse;
        await expect(dialog.getByRole("alert")).toContainText("Tag name already exists");
        await expect(input).toHaveValue("TG-E2E-Err");

        await deleteTagByName(userId, "TG-E2E-Err");
        const retryResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname === "/api/recording-tags" &&
            response.request().method() === "POST" &&
            response.status() === 200,
        );
        await dialog.getByRole("button", { name: "重试", exact: true }).click();
        await retryResponse;
        await expect(dialog).toHaveCount(0);
        await expect.poll(() => tagCount(userId!, "TG-E2E-Err")).toBe(1);
        await expect.poll(() => assignmentCount(userId!, "TG-E2E-Err")).toBe(1);

        await page.reload({ waitUntil: "domcontentloaded" });
        await openTagManager(page);
        await expect(
            tagManager(page).getByRole("button", {
                name: "TG-E2E-Err",
                exact: true,
            }),
        ).toHaveAttribute("aria-pressed", "true");
    } finally {
        if (userId) {
            await cleanupSeed(userId);
        }
    }
});

test("recording tag assignment retry durably survives a real SQLite write lock", async ({
    page,
}) => {
    let userId: string | null = null;
    let releaseWriteLock: (() => Promise<void>) | null = null;

    try {
        await ensureSignedIn(page);
        userId = await getPlaywrightUserId();
        await cleanupSeed(userId);
        await seedRecordingAndTags(userId);

        await page.goto(`/recordings/${RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        await openTagManager(page);
        const panel = tagManager(page);
        const tagToggle = panel.getByRole("button", {
            name: "TG-E2E-One",
            exact: true,
        });

        releaseWriteLock = await holdLibraryWriteLock();
        const failedSave = page.waitForResponse((response) =>
            new URL(response.url()).pathname ===
                `/api/recordings/${RECORDING_ID}/tags` &&
            response.request().method() === "PUT" &&
            response.status() === 500,
        );
        await tagToggle.click();
        await failedSave;
        await expect(panel.getByRole("alert")).toBeVisible();
        await expect(tagToggle).toHaveAttribute("aria-pressed", "false");

        await releaseWriteLock();
        releaseWriteLock = null;
        const recoveredSave = page.waitForResponse((response) =>
            new URL(response.url()).pathname ===
                `/api/recordings/${RECORDING_ID}/tags` &&
            response.request().method() === "PUT" &&
            response.status() === 200,
        );
        await panel.getByRole("button", { name: "重试", exact: true }).click();
        await recoveredSave;
        await expect(panel.getByRole("alert")).toHaveCount(0);
        await expect(tagToggle).toHaveAttribute("aria-pressed", "true");
        await expect.poll(() => assignmentCount(userId!, "TG-E2E-One")).toBe(1);

        const readbackResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname ===
                `/api/recordings/${RECORDING_ID}` &&
            response.request().method() === "GET" &&
            response.status() === 200,
        );
        await page.goto(`/api/recordings/${RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        const readback = (await (await readbackResponse).json()) as {
            recording?: { tags?: Array<{ id?: unknown }> };
        };
        expect(readback.recording?.tags).toEqual(
            expect.arrayContaining([expect.objectContaining({
                id: `${RECORDING_ID}-tg-e2e-one`,
            })]),
        );

        await page.goto(`/recordings/${RECORDING_ID}`, {
            waitUntil: "domcontentloaded",
        });
        await openTagManager(page);
        await expect(
            tagManager(page).getByRole("button", {
                name: "TG-E2E-One",
                exact: true,
            }),
        ).toHaveAttribute("aria-pressed", "true");
    } finally {
        if (releaseWriteLock) {
            await releaseWriteLock();
        }
        if (userId) {
            await cleanupSeed(userId);
        }
    }
});
