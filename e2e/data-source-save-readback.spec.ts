import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Page, Response } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_PROVIDER = "dingtalk-a1";
const E2E_PROVIDER_BASE_URL = "https://meeting-ai-tingji.dingtalk.com";
const PLAYWRIGHT_EMAIL = "playwright-admin@example.com";

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

async function executeWithBusyRetry<T>(
    operation: () => Promise<T>,
    attempts = 8,
) {
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

            await new Promise((resolve) =>
                setTimeout(resolve, 80 * (attempt + 1)),
            );
        }
    }

    throw lastError;
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

function readProvider(value: unknown) {
    if (value !== E2E_PROVIDER) {
        throw new Error("Unexpected source connection provider");
    }

    return value;
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
        createdAt: readRequiredNumber(row.created_at, "source_connections.created_at"),
        updatedAt: readRequiredNumber(row.updated_at, "source_connections.updated_at"),
    };
}

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });

    try {
        const result = await executeWithBusyRetry(() =>
            client.execute({
                sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
                args: [PLAYWRIGHT_EMAIL],
            }),
        );
        return readRequiredString(result.rows[0]?.id, "users.id");
    } finally {
        await client.close();
    }
}

async function snapshotProviderConnection(userId: string) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });

    try {
        const result = await executeWithBusyRetry(() =>
            client.execute({
                sql: `SELECT id, user_id, provider, enabled, auth_mode, base_url,
                            config, secret_config, last_sync, sync_status,
                            last_sync_error, last_sync_started_at,
                            last_sync_finished_at, created_at, updated_at
                    FROM source_connections
                    WHERE user_id = ? AND provider = ?`,
                args: [userId, E2E_PROVIDER],
            }),
        );

        return result.rows.map((row) => readSnapshotRow(row));
    } finally {
        await client.close();
    }
}

async function restoreProviderConnection(
    userId: string,
    snapshot: SourceConnectionSnapshotRow[],
) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });

    try {
        await executeWithBusyRetry(() =>
            client.batch(
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
            ),
        );
    } finally {
        await client.close();
    }
}

async function seedDisabledFallbackConnection(userId: string) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    const now = Date.now();

    try {
        await executeWithBusyRetry(() =>
            client.batch(
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
                            `e2e-data-source-save-readback-${now}`,
                            userId,
                            E2E_PROVIDER,
                            0,
                            "device-signin",
                            E2E_PROVIDER_BASE_URL,
                            JSON.stringify({ syncTitleToSource: true }),
                            null,
                            null,
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
            ),
        );
    } finally {
        await client.close();
    }
}

function getDataSourceReadback(payload: unknown) {
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

    return readRecord(source, "data source API readback");
}

async function readDataSourceState(page: Page) {
    const response = await page.request.get("/api/data-sources");
    expect(response.status()).toBe(200);
    return getDataSourceReadback(await response.json());
}

async function openFallbackProvider(page: Page) {
    await page.goto("/settings#data-sources", { waitUntil: "domcontentloaded" });

    const section = page.locator('[data-sot-surface="settings-data-sources"]');
    const providerCard = section.locator(
        `[data-sot-control="source-provider"][data-sot-provider="${E2E_PROVIDER}"]`,
    );
    const detail = section.locator(
        `[data-sot-panel="source-provider-detail"][data-sot-provider="${E2E_PROVIDER}"]`,
    );

    await expect(section).toHaveAttribute("data-sot-load-state", "ready");
    await expect(providerCard).toHaveAttribute("data-sot-status", "needs-setup");
    await providerCard.click();
    await expect(detail).toHaveAttribute("data-sot-status", "needs-setup");

    return { detail, providerCard, section };
}

function waitForSaveResponse(page: Page) {
    return page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            url.pathname === "/api/data-sources" &&
            response.request().method() === "PUT"
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

test.describe("Data Sources enable save readback", () => {
    test.skip(
        !hasGuardedPlaywrightFallback(),
        "Requires the guarded local Playwright data-sources fallback.",
    );

    test("enables a visible fallback source, saves through the real API, and restores its fixture", async ({
        page,
    }) => {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const originalSnapshot = await snapshotProviderConnection(userId);
        let primaryFlowError: unknown;
        let releaseSaveResponse: (() => void) | null = null;
        let saveRouteInstalled = false;

        try {
            await seedDisabledFallbackConnection(userId);
            const beforeSave = await snapshotProviderConnection(userId);
            expect(beforeSave).toHaveLength(1);
            expect(beforeSave[0]?.enabled).toBe(0);
            expect(beforeSave[0]?.secretConfig).toBeNull();

            const { detail, providerCard } = await openFallbackProvider(page);
            const enableSync = detail.locator(
                `[data-sot-control="source-enable-sync"][data-sot-provider="${E2E_PROVIDER}"]`,
            );
            const save = detail.locator(
                `[data-sot-control="source-save"][data-sot-provider="${E2E_PROVIDER}"]`,
            );

            await expect(providerCard).toBeVisible();
            await expect(enableSync).toHaveAttribute("aria-checked", "false");
            await expect(enableSync).toHaveAttribute("data-sot-enabled", "false");
            await expect(save).toBeEnabled();

            await enableSync.click();
            await expect(enableSync).toHaveAttribute("aria-checked", "true");
            await expect(enableSync).toHaveAttribute("data-sot-enabled", "true");

            let forwardedSaveRequest = false;
            let releaseForwardedResponse!: () => void;
            const forwardedResponseGate = new Promise<void>((resolve) => {
                releaseForwardedResponse = resolve;
            });
            await page.route("**/api/data-sources", async (route) => {
                if (route.request().method() !== "PUT") {
                    await route.continue();
                    return;
                }

                forwardedSaveRequest = true;
                const response = await route.fetch();
                await forwardedResponseGate;
                await route.fulfill({ response });
            });
            saveRouteInstalled = true;
            releaseSaveResponse = releaseForwardedResponse;

            const saveResponse = waitForSaveResponse(page);
            const refreshResponse = waitForDataSourcesReload(page);
            await save.click();
            await expect.poll(() => forwardedSaveRequest).toBe(true);
            await expect(detail).toHaveAttribute("data-sot-action-state", "saving");
            await expect(enableSync).toBeDisabled();
            await expect(save).toBeDisabled();

            releaseSaveResponse();
            releaseSaveResponse = null;
            const [response, refresh] = await Promise.all([
                saveResponse,
                refreshResponse,
            ]);
            expect(response.status()).toBe(200);
            await expect(response.json()).resolves.toEqual({ success: true });
            expect(refresh.status()).toBe(200);

            const payload = readRecord(
                response.request().postDataJSON(),
                "data source save payload",
            );
            expect(payload.provider).toBe(E2E_PROVIDER);
            expect(payload.enabled).toBe(true);

            const persisted = await snapshotProviderConnection(userId);
            expect(persisted).toHaveLength(1);
            expect(persisted[0]).toMatchObject({
                authMode: "device-signin",
                baseUrl: E2E_PROVIDER_BASE_URL,
                enabled: 1,
                secretConfig: null,
            });

            const apiReadback = await readDataSourceState(page);
            expect(apiReadback.enabled).toBe(true);
            expect(apiReadback.connected).toBe(false);
            expect(apiReadback.authMode).toBe("device-signin");
            expect(apiReadback.baseUrl).toBe(E2E_PROVIDER_BASE_URL);

            const pageReload = waitForDataSourcesReload(page);
            await page.reload({ waitUntil: "domcontentloaded" });
            expect((await pageReload).status()).toBe(200);

            const reloaded = await openFallbackProvider(page);
            const reloadedEnableSync = reloaded.detail.locator(
                `[data-sot-control="source-enable-sync"][data-sot-provider="${E2E_PROVIDER}"]`,
            );
            await expect(reloaded.providerCard).toHaveAttribute(
                "data-sot-status",
                "needs-setup",
            );
            await expect(reloadedEnableSync).toHaveAttribute(
                "aria-checked",
                "true",
            );
            await expect(reloadedEnableSync).toHaveAttribute(
                "data-sot-enabled",
                "true",
            );
        } catch (error) {
            primaryFlowError = error;
            throw error;
        } finally {
            try {
                releaseSaveResponse?.();
                if (saveRouteInstalled) {
                    await page.unroute("**/api/data-sources");
                }
                await restoreProviderConnection(userId, originalSnapshot);
                expect(await snapshotProviderConnection(userId)).toEqual(
                    originalSnapshot,
                );
            } catch (cleanupError) {
                if (primaryFlowError) {
                    throw new AggregateError(
                        [primaryFlowError, cleanupError],
                        "Data source save test and cleanup both failed.",
                    );
                }

                throw cleanupError;
            }
        }
    });
});
