import { createCipheriv, randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_PROVIDER = "dingtalk-a1";
const E2E_PROVIDER_BASE_URL = "https://meeting-ai-tingji.dingtalk.com";
const E2E_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

type SourceConnectionSnapshotRow = {
    id: string;
    userId: string;
    provider: typeof E2E_PROVIDER;
    enabled: number;
    authMode: string | null;
    baseUrl: string | null;
    config: string | null;
    secretConfig: string | null;
    lastSync: number | null;
    syncStatus: string;
    lastSyncError: string | null;
    lastSyncStartedAt: number | null;
    lastSyncFinishedAt: number | null;
    createdAt: number;
    updatedAt: number;
};

function resolveE2ERoot() {
    return path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ?? path.join(process.cwd(), "tmp/e2e"),
    );
}

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(resolveE2ERoot(), "data", "betterainote-e2e.db");
}

function isE2EDataPath(filePath: string) {
    const dataDirectory = path.resolve(resolveE2ERoot(), "data");
    const relativePath = path.relative(dataDirectory, path.resolve(filePath));

    return (
        relativePath.length > 0 &&
        relativePath !== ".." &&
        !relativePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativePath)
    );
}

function assertE2EDataPath(filePath: string) {
    if (!isE2EDataPath(filePath)) {
        throw new Error(`Refusing to touch non-E2E database path: ${filePath}`);
    }
}

function databaseUrl(filePath: string) {
    assertE2EDataPath(filePath);
    return pathToFileURL(filePath).href;
}

function isLoopbackPlaywrightBaseUrl() {
    try {
        const baseUrl = new URL(
            process.env.PLAYWRIGHT_BASE_URL ??
                process.env.APP_URL ??
                "http://127.0.0.1:3201",
        );

        return ["127.0.0.1", "localhost", "::1"].includes(
            baseUrl.hostname,
        );
    } catch {
        return false;
    }
}

function hasGuardedPlaywrightFallback() {
    return (
        process.env.NODE_ENV === "development" &&
        process.env.PLAYWRIGHT_E2E_DATA_SOURCES_FALLBACK === "1" &&
        process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1" &&
        isLoopbackPlaywrightBaseUrl() &&
        isE2EDataPath(resolveDatabasePath())
    );
}

function readRequiredString(value: unknown, field: string) {
    if (typeof value !== "string") {
        throw new Error(`Unexpected ${field} value`);
    }

    return value;
}

function readNullableString(value: unknown, field: string) {
    if (value === null || typeof value === "string") {
        return value;
    }

    throw new Error(`Unexpected ${field} value`);
}

function readRequiredNumber(value: unknown, field: string) {
    if (typeof value !== "number" && typeof value !== "bigint") {
        throw new Error(`Unexpected ${field} value`);
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        throw new Error(`Unexpected ${field} value`);
    }

    return numericValue;
}

function readNullableNumber(value: unknown, field: string) {
    return value === null ? null : readRequiredNumber(value, field);
}

function readRecord(value: unknown, field: string) {
    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ) {
        throw new Error(`Unexpected ${field} value`);
    }

    return value as Record<string, unknown>;
}

function readProvider(value: unknown) {
    if (value === E2E_PROVIDER) {
        return value;
    }

    throw new Error("Unexpected source connection provider");
}

function readSnapshotRow(row: Record<string, unknown>): SourceConnectionSnapshotRow {
    return {
        id: readRequiredString(row.id, "source_connections.id"),
        userId: readRequiredString(row.user_id, "source_connections.user_id"),
        provider: readProvider(row.provider),
        enabled: readRequiredNumber(row.enabled, "source_connections.enabled"),
        authMode: readNullableString(
            row.auth_mode,
            "source_connections.auth_mode",
        ),
        baseUrl: readNullableString(row.base_url, "source_connections.base_url"),
        config: readNullableString(row.config, "source_connections.config"),
        secretConfig: readNullableString(
            row.secret_config,
            "source_connections.secret_config",
        ),
        lastSync: readNullableNumber(row.last_sync, "source_connections.last_sync"),
        syncStatus: readRequiredString(
            row.sync_status,
            "source_connections.sync_status",
        ),
        lastSyncError: readNullableString(
            row.last_sync_error,
            "source_connections.last_sync_error",
        ),
        lastSyncStartedAt: readNullableNumber(
            row.last_sync_started_at,
            "source_connections.last_sync_started_at",
        ),
        lastSyncFinishedAt: readNullableNumber(
            row.last_sync_finished_at,
            "source_connections.last_sync_finished_at",
        ),
        createdAt: readRequiredNumber(
            row.created_at,
            "source_connections.created_at",
        ),
        updatedAt: readRequiredNumber(
            row.updated_at,
            "source_connections.updated_at",
        ),
    };
}

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });

    try {
        const result = await client.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: ["playwright-admin@example.com"],
        });

        return readRequiredString(result.rows[0]?.id, "users.id");
    } finally {
        await client.close();
    }
}

async function snapshotDingTalkConnection(userId: string) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });

    try {
        const result = await client.execute({
            sql: `SELECT id, user_id, provider, enabled, auth_mode, base_url,
                        config, secret_config, last_sync, sync_status,
                        last_sync_error, last_sync_started_at,
                        last_sync_finished_at, created_at, updated_at
                    FROM source_connections
                    WHERE user_id = ? AND provider = ?`,
            args: [userId, E2E_PROVIDER],
        });

        return result.rows.map((row) => readSnapshotRow(row));
    } finally {
        await client.close();
    }
}

async function restoreDingTalkConnection(
    userId: string,
    snapshot: SourceConnectionSnapshotRow[],
) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });

    try {
        await client.batch(
            [
                {
                    sql: "DELETE FROM source_connections WHERE user_id = ? AND provider = ?",
                    args: [userId, E2E_PROVIDER],
                },
                ...snapshot.map((row) => ({
                    sql: `INSERT INTO source_connections (
                            id, user_id, provider, enabled, auth_mode, base_url,
                            config, secret_config, last_sync, sync_status,
                            last_sync_error, last_sync_started_at,
                            last_sync_finished_at, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        row.id,
                        row.userId,
                        row.provider,
                        row.enabled,
                        row.authMode,
                        row.baseUrl,
                        row.config,
                        row.secretConfig,
                        row.lastSync,
                        row.syncStatus,
                        row.lastSyncError,
                        row.lastSyncStartedAt,
                        row.lastSyncFinishedAt,
                        row.createdAt,
                        row.updatedAt,
                    ],
                })),
            ],
            "write",
        );
    } finally {
        await client.close();
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

async function seedConnectedDingTalkConnection(userId: string) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    const now = Date.now();
    const secretConfig = encryptWithPlaywrightE2EKey(
        JSON.stringify({
            deviceCredential: "e2e-provider-lifecycle-secret-sentinel",
        }),
    );

    try {
        await client.batch(
            [
                {
                    sql: "DELETE FROM source_connections WHERE user_id = ? AND provider = ?",
                    args: [userId, E2E_PROVIDER],
                },
                {
                    sql: `INSERT INTO source_connections (
                            id, user_id, provider, enabled, auth_mode, base_url,
                            config, secret_config, last_sync, sync_status,
                            last_sync_error, last_sync_started_at,
                            last_sync_finished_at, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        `e2e-provider-lifecycle-${now}`,
                        userId,
                        E2E_PROVIDER,
                        1,
                        "device-signin",
                        E2E_PROVIDER_BASE_URL,
                        JSON.stringify({ syncTitleToSource: true }),
                        secretConfig,
                        now - 60_000,
                        "idle",
                        null,
                        null,
                        null,
                        now,
                        now,
                    ],
                },
            ],
            "write",
        );
    } finally {
        await client.close();
    }
}

async function openDingTalkProvider(page: Page) {
    await page.goto("/settings#data-sources", { waitUntil: "domcontentloaded" });

    const section = page.locator('[data-sot-surface="settings-data-sources"]');
    const providerCard = section.locator(
        `[data-sot-control="source-provider"][data-sot-provider="${E2E_PROVIDER}"]`,
    );
    const detail = section.locator(
        `[data-sot-panel="source-provider-detail"][data-sot-provider="${E2E_PROVIDER}"]`,
    );

    await expect(section).toHaveAttribute("data-sot-load-state", "ready");
    await expect(providerCard).toHaveAttribute("data-sot-status", "connected");
    await providerCard.click();
    await expect(detail).toHaveAttribute("data-sot-status", "connected");

    return { detail, providerCard, section };
}

function waitForDataSourcesTestResponse(page: Page) {
    return page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            url.pathname === "/api/data-sources/test" &&
            response.request().method() === "POST"
        );
    });
}

function waitForDataSourcesReload(page: Page) {
    return page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            url.pathname === "/api/data-sources" &&
            response.request().method() === "GET"
        );
    });
}

function getDingTalkApiReadback(payload: unknown) {
    const response = readRecord(payload, "data sources response");
    if (!Array.isArray(response.sources)) {
        throw new Error("Expected data sources response to contain sources");
    }

    const source = response.sources.find((candidate) => {
        if (
            typeof candidate !== "object" ||
            candidate === null ||
            Array.isArray(candidate)
        ) {
            return false;
        }

        return candidate.provider === E2E_PROVIDER;
    });

    return readRecord(source, "DingTalk API source state");
}

test.describe("Data Sources provider Test lifecycle", () => {
    test.beforeEach(() => {
        if (!hasGuardedPlaywrightFallback()) {
            throw new Error(
                "This spec requires the guarded local Playwright data-sources fallback.",
            );
        }
    });

    test("Test forwards to the live API, disables peer controls in flight, and preserves the connected source", async ({
        page,
    }) => {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const originalSnapshot = await snapshotDingTalkConnection(userId);
        let releaseTestResponse: (() => void) | null = null;
        let testRouteInstalled = false;

        try {
            await seedConnectedDingTalkConnection(userId);
            const beforeTest = await snapshotDingTalkConnection(userId);
            expect(beforeTest).toHaveLength(1);

            const { detail, providerCard, section } =
                await openDingTalkProvider(page);
            const sourceTest = detail.locator(
                '[data-sot-control="source-test"]',
            );
            const reconnect = detail.locator(
                '[data-sot-control="source-reconnect"]',
            );
            const disconnect = detail.locator(
                '[data-sot-control="source-disconnect"]',
            );
            await expect(sourceTest).toBeEnabled();
            await expect(reconnect).toBeEnabled();
            await expect(disconnect).toBeEnabled();

            let resolveTestResponse!: () => void;
            const testResponseGate = new Promise<void>((resolve) => {
                resolveTestResponse = resolve;
            });
            let forwardedTestRequest = false;

            await page.route("**/api/data-sources/test", async (route) => {
                if (route.request().method() !== "POST") {
                    await route.continue();
                    return;
                }

                // Keep the UI in its real in-flight state after the route has
                // already received the product API response.
                forwardedTestRequest = true;
                const response = await route.fetch();
                await testResponseGate;
                await route.fulfill({ response });
            });
            testRouteInstalled = true;
            releaseTestResponse = resolveTestResponse;

            const testResponse = waitForDataSourcesTestResponse(page);
            await sourceTest.click();
            await expect.poll(() => forwardedTestRequest).toBe(true);
            await expect(detail).toHaveAttribute(
                "data-sot-action-state",
                "testing",
            );
            await expect(sourceTest).toBeDisabled();
            await expect(reconnect).toBeDisabled();
            await expect(disconnect).toBeDisabled();

            releaseTestResponse();
            releaseTestResponse = null;
            const response = await testResponse;
            expect(response.status()).toBe(200);
            await expect(response.json()).resolves.toEqual({ success: true });
            expect(
                readRecord(
                    response.request().postDataJSON(),
                    "data source test request",
                ).provider,
            ).toBe(E2E_PROVIDER);

            await expect(detail).toHaveAttribute(
                "data-sot-action-state",
                "test-success",
            );
            await expect(sourceTest).toHaveAttribute("data-sot-state", "success");
            await expect(reconnect).toBeEnabled();
            await expect(disconnect).toBeEnabled();

            const apiReadback = await page.request.get("/api/data-sources");
            expect(apiReadback.status()).toBe(200);
            const sourceReadback = getDingTalkApiReadback(
                await apiReadback.json(),
            );
            expect(sourceReadback.enabled).toBe(true);
            expect(sourceReadback.connected).toBe(true);
            expect(sourceReadback.authMode).toBe("device-signin");

            const afterTest = await snapshotDingTalkConnection(userId);
            expect(afterTest).toEqual(beforeTest);

            await page.unroute("**/api/data-sources/test");
            testRouteInstalled = false;
            const reloadResponse = waitForDataSourcesReload(page);
            await page.reload({ waitUntil: "domcontentloaded" });
            expect((await reloadResponse).status()).toBe(200);

            await expect(section).toHaveAttribute("data-sot-load-state", "ready");
            await expect(providerCard).toHaveAttribute(
                "data-sot-status",
                "connected",
            );
            await providerCard.click();
            await expect(detail).toHaveAttribute(
                "data-sot-status",
                "connected",
            );
            await expect(sourceTest).toHaveAttribute("data-sot-state", "idle");
        } finally {
            releaseTestResponse?.();
            if (testRouteInstalled) {
                await page.unroute("**/api/data-sources/test");
            }
            await restoreDingTalkConnection(userId, originalSnapshot);
        }
    });
});
