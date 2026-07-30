import { createCipheriv, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn, putJsonWithRetry } from "./helpers/auth";

const E2E_ROOT_MARKER = ".betterainote-e2e-root";
const E2E_ROOT_MARKER_CONTENTS = "BetterAINote E2E disposable root v1\n";
const SOURCE_FILTER_STORAGE_KEY = "dashboard-source-filter-provider";
const FIXTURE_PREFIX = "e2e-source-filter-runtime-";
const E2E_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function requireIsolatedE2ERoot() {
    const configuredRoot = process.env.PLAYWRIGHT_E2E_ROOT?.trim();
    if (!configuredRoot) {
        throw new Error("PLAYWRIGHT_E2E_ROOT is required");
    }

    return path.resolve(configuredRoot);
}

const E2E_ROOT = requireIsolatedE2ERoot();
const CORE_DB = path.resolve(
    process.env.DATABASE_PATH ??
        path.join(E2E_ROOT, "data", "betterainote-e2e.db"),
);

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.resolve(
        parsed.dir,
        `${parsed.name}-${suffix}${parsed.ext || ".db"}`,
    );
}

const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");

function assertIsolatedPath(targetPath: string) {
    const resolved = path.resolve(targetPath);
    if (resolved !== E2E_ROOT && !resolved.startsWith(`${E2E_ROOT}${path.sep}`)) {
        throw new Error(`Refusing non-E2E path: ${resolved}`);
    }
}

function databaseUrl(targetPath: string) {
    assertIsolatedPath(targetPath);
    return pathToFileURL(targetPath).href;
}

function assertPreparedE2ERoot() {
    const markerPath = path.join(E2E_ROOT, E2E_ROOT_MARKER);
    expect(existsSync(markerPath)).toBe(true);
    expect(readFileSync(markerPath, "utf8")).toBe(E2E_ROOT_MARKER_CONTENTS);
}

function encryptFixtureSecrets(secrets: Record<string, string>) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(
        "aes-256-gcm",
        Buffer.from(E2E_ENCRYPTION_KEY, "hex"),
        iv,
    );
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(secrets), "utf8"),
        cipher.final(),
    ]);

    return [
        iv.toString("hex"),
        cipher.getAuthTag().toString("hex"),
        encrypted.toString("hex"),
    ].join(":");
}

async function getPlaywrightUserId() {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await core.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: ["playwright-admin@example.com"],
        });
        const userId = result.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Playwright user was not created");
        }
        return userId;
    } finally {
        await core.close();
    }
}

async function cleanupFixture(userId: string) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    try {
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${FIXTURE_PREFIX}%`],
        });
        await core.execute({
            sql: `
                DELETE FROM source_connections
                WHERE user_id = ? AND provider IN ('iflyrec', 'plaud')
            `,
            args: [userId],
        });
    } finally {
        await core.close();
        await library.close();
    }
}

async function seedFixture(userId: string) {
    const core = createClient({ url: databaseUrl(CORE_DB) });
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();

    try {
        await cleanupFixture(userId);
        for (const connection of [
            {
                authMode: "session-header",
                baseUrl: "https://www.iflyrec.com",
                provider: "iflyrec",
                secretConfig: encryptFixtureSecrets({
                    sessionId: "synthetic-e2e-session",
                }),
            },
            {
                authMode: "bearer",
                baseUrl: "https://api.plaud.ai",
                provider: "plaud",
                secretConfig: encryptFixtureSecrets({
                    bearerToken: "synthetic-e2e-credential",
                }),
            },
        ]) {
            await core.execute({
                sql: `
                    INSERT INTO source_connections (
                        id, user_id, provider, enabled, auth_mode, base_url,
                        config, secret_config, last_sync, sync_status,
                        last_sync_error, last_sync_started_at,
                        last_sync_finished_at, created_at, updated_at
                    ) VALUES (?, ?, ?, 1, ?, ?, '{}', ?, ?, 'idle', NULL, NULL, ?, ?, ?)
                `,
                args: [
                    `${FIXTURE_PREFIX}${connection.provider}`,
                    userId,
                    connection.provider,
                    connection.authMode,
                    connection.baseUrl,
                    connection.secretConfig,
                    now - 60_000,
                    now - 60_000,
                    now,
                    now,
                ],
            });
        }

        await library.execute({
            sql: `
                INSERT INTO recordings (
                    id, user_id, source_provider, source_recording_id,
                    source_version, source_metadata, provider_device_id,
                    filename, duration, start_time, end_time, filesize,
                    file_md5, storage_type, storage_path, downloaded_at,
                    upstream_trashed, upstream_deleted, created_at, updated_at
                ) VALUES (?, ?, 'iflyrec', ?, '1', '{}', ?, ?, 60000, ?, ?, 0, ?, 'local', '', ?, 0, 0, ?, ?)
            `,
            args: [
                `${FIXTURE_PREFIX}iflyrec-recording`,
                userId,
                `${FIXTURE_PREFIX}source-recording`,
                `${FIXTURE_PREFIX}device`,
                "Source filter runtime recording",
                now - 60_000,
                now,
                `${FIXTURE_PREFIX}md5`,
                now,
                now,
                now,
            ],
        });
    } finally {
        await core.close();
        await library.close();
    }
}

async function openDashboardInEnglish(page: Page) {
    const response = await putJsonWithRetry(page, "/api/settings/display", {
        dateTimeFormat: "relative",
        itemsPerPage: 50,
        recordingListSortOrder: "newest",
        theme: "dark",
        uiLanguage: "en",
    });
    expect(response.ok()).toBe(true);

    await page.evaluate((storageKey) => {
        window.localStorage.removeItem(storageKey);
    }, SOURCE_FILTER_STORAGE_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
        page.getByRole("heading", { name: "Source filter runtime recording" }),
    ).toBeVisible();
}

test("source rail keeps pressed/current selection, reconciles no-results, and persists clearing", async ({
    page,
}) => {
    assertPreparedE2ERoot();
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedFixture(userId);
        await openDashboardInEnglish(page);

        const dataSourcesResponse = await page.request.get("/api/data-sources");
        expect(dataSourcesResponse.ok()).toBe(true);
        const dataSources = (await dataSourcesResponse.json()) as {
            sources: Array<{
                connected: boolean;
                provider: string;
            }>;
        };
        expect(
            dataSources.sources.find((source) => source.provider === "iflyrec"),
        ).toMatchObject({ connected: true, provider: "iflyrec" });
        expect(
            dataSources.sources.find((source) => source.provider === "plaud"),
        ).toMatchObject({ connected: true, provider: "plaud" });

        const library = createClient({ url: databaseUrl(LIBRARY_DB) });
        try {
            const seededRecording = await library.execute({
                sql: `
                    SELECT source_provider
                    FROM recordings
                    WHERE user_id = ? AND id = ?
                `,
                args: [userId, `${FIXTURE_PREFIX}iflyrec-recording`],
            });
            expect(seededRecording.rows).toHaveLength(1);
            expect(seededRecording.rows[0]?.source_provider).toBe("iflyrec");
        } finally {
            await library.close();
        }

        const plaud = page.getByRole("button", {
            name: /^Plaud ·/,
        });
        const iflyrec = page.getByRole("button", {
            name: /^iFLYTEK iflyrec ·/,
        });
        await expect(plaud).toHaveAttribute("aria-pressed", "false");
        await expect(plaud).not.toHaveAttribute("aria-current");

        const sourceQuery = page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
                url.pathname === "/api/recordings/query" &&
                url.searchParams.get("source") === "iflyrec" &&
                url.searchParams.get("favorite") === null
            );
        });
        await iflyrec.click();
        expect((await sourceQuery).ok()).toBe(true);
        await expect(iflyrec).toHaveAttribute("aria-pressed", "true");
        await expect(iflyrec).toHaveAttribute("aria-current", "true");
        await expect(plaud).toHaveAttribute("aria-pressed", "false");

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(iflyrec).toHaveAttribute("aria-pressed", "true");
        await expect(iflyrec).toHaveAttribute("aria-current", "true");
        await expect
            .poll(() =>
                page.evaluate((storageKey) => {
                    return window.localStorage.getItem(storageKey);
                }, SOURCE_FILTER_STORAGE_KEY),
            )
            .toBe("iflyrec");

        const transcribed = page.getByRole("button", {
            name: /^Transcribed\b/,
        });
        await transcribed.click();
        await expect(transcribed).toHaveAttribute("aria-pressed", "true");
        await expect(iflyrec).toHaveAttribute("aria-pressed", "true");
        await expect(iflyrec).toHaveAttribute("aria-current", "true");
        await expect(
            page.getByRole("status").filter({ hasText: /no matches/i }),
        ).toBeVisible();

        const allRecordings = page.getByRole("button", {
            name: /^All recordings\b/,
        });
        await allRecordings.click();
        await expect(allRecordings).toHaveAttribute("aria-pressed", "true");
        await expect(iflyrec).toHaveAttribute("aria-pressed", "false");
        await expect(iflyrec).not.toHaveAttribute("aria-current");
        await expect(
            page.getByRole("status").filter({ hasText: /no matches/i }),
        ).toHaveCount(0);
        await expect
            .poll(() =>
                page.evaluate((storageKey) => {
                    return window.localStorage.getItem(storageKey);
                }, SOURCE_FILTER_STORAGE_KEY),
            )
            .toBe("all");

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(iflyrec).toHaveAttribute("aria-pressed", "false");
        await expect(iflyrec).not.toHaveAttribute("aria-current");
    } finally {
        await cleanupFixture(userId);
    }
});
