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

test("recording tags use real SQLite APIs for add remove create rename and confirmed delete", async ({
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
        const panel = tagManager(page);

        const addResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname === `/api/recordings/${RECORDING_ID}/tags` &&
            response.request().method() === "PUT" &&
            response.status() === 200,
        );
        await panel
            .getByRole("button", { name: "TG-E2E-One", exact: true })
            .click();
        await addResponse;
        await expect.poll(() => assignmentCount(userId!, "TG-E2E-One")).toBe(1);

        const removeResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname === `/api/recordings/${RECORDING_ID}/tags` &&
            response.request().method() === "PUT" &&
            response.status() === 200,
        );
        await panel
            .getByRole("button", { name: "TG-E2E-One", exact: true })
            .click();
        await removeResponse;
        await expect.poll(() => assignmentCount(userId!, "TG-E2E-One")).toBe(0);

        const createResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname === "/api/recording-tags" &&
            response.request().method() === "POST" &&
            response.status() === 200,
        );
        await panel.locator("#recording-tag-create-name").fill("TG-E2E-New");
        await panel.getByRole("button", { name: "新建", exact: true }).click();
        await createResponse;
        await expect.poll(() => assignmentCount(userId!, "TG-E2E-New")).toBe(1);

        await panel.getByRole("button", { name: "编辑 TG-E2E-New" }).click();
        await panel.getByRole("textbox", { name: "重命名标签" }).fill("TG-E2E-Ren");
        const renameResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname.includes("/api/recording-tags/") &&
            response.request().method() === "PATCH" &&
            response.status() === 200,
        );
        await panel.getByRole("button", { name: "保存", exact: true }).click();
        await renameResponse;
        await expect.poll(() => assignmentCount(userId!, "TG-E2E-Ren")).toBe(1);

        await panel.getByRole("button", { name: "删除 TG-E2E-Ren" }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText("TG-E2E-Ren");
        const deleteResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname.includes("/api/recording-tags/") &&
            response.request().method() === "DELETE" &&
            response.status() === 200,
        );
        await dialog.getByRole("button", { name: "删除标签", exact: true }).click();
        await deleteResponse;
        await expect.poll(() => tagCount(userId!, "TG-E2E-Ren")).toBe(0);
        await expect.poll(() => assignmentCount(userId!, "TG-E2E-Ren")).toBe(0);
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
        const panel = tagManager(page);
        await panel.locator("#recording-tag-create-name").fill("TG-E2E-Err");
        const failureResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname === "/api/recording-tags" &&
            response.request().method() === "POST" &&
            response.status() === 409,
        );
        await panel.getByRole("button", { name: "新建", exact: true }).click();
        await failureResponse;
        await expect(panel.getByRole("alert")).toContainText("Tag name already exists");

        await deleteTagByName(userId, "TG-E2E-Err");
        const retryResponse = page.waitForResponse((response) =>
            new URL(response.url()).pathname === "/api/recording-tags" &&
            response.request().method() === "POST" &&
            response.status() === 200,
        );
        await panel.getByRole("button", { name: "重试", exact: true }).click();
        await retryResponse;
        await expect(panel.getByRole("alert")).toHaveCount(0);
        await expect.poll(() => assignmentCount(userId!, "TG-E2E-Err")).toBe(1);
    } finally {
        if (userId) {
            await cleanupSeed(userId);
        }
    }
});
