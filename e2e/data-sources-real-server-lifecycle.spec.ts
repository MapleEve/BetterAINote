import { createCipheriv, randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Page, Response } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const E2E_PROVIDER = "dingtalk-a1";
const E2E_PROVIDER_BASE_URL = "https://meeting-ai-tingji.dingtalk.com";
const PLAYWRIGHT_E2E_ENCRYPTION_KEY =
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

type SourceDeviceSnapshotRow = {
    id: string;
    userId: string;
    provider: typeof E2E_PROVIDER;
    providerDeviceId: string;
    name: string;
    model: string | null;
    versionNumber: number | null;
    createdAt: number;
    updatedAt: number;
};

type ProviderDatabaseSnapshot = {
    connections: SourceConnectionSnapshotRow[];
    devices: SourceDeviceSnapshotRow[];
};

type SeededProviderState = {
    config: Record<string, unknown>;
    secretConfig: string;
};

function resolveE2ERoot() {
    return path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ?? path.join(process.cwd(), "tmp/e2e"),
    );
}

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
}

function resolveLibraryDatabasePath() {
    const coreDatabasePath = resolveDatabasePath();
    const parsed = path.parse(coreDatabasePath);
    const libraryDatabasePath = path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-library${parsed.ext || ".db"}`,
    );
    assertE2EPath(libraryDatabasePath);
    return libraryDatabasePath;
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

function assertE2EPath(filePath: string) {
    if (!isE2EDataPath(filePath)) {
        throw new Error(`Refusing to touch non-E2E database path: ${filePath}`);
    }
}

function databaseUrl(filePath: string) {
    assertE2EPath(filePath);
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
    if (value === E2E_PROVIDER) {
        return value;
    }

    throw new Error("Unexpected data source provider");
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

function parseStoredConfig(config: string | null) {
    if (config === null) {
        throw new Error("Expected seeded source connection config");
    }

    try {
        return readRecord(JSON.parse(config), "source_connections.config");
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }

        throw new Error("Unable to parse source_connections.config");
    }
}

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });

    try {
        const result = await executeWithBusyRetry(() =>
            client.execute({
                sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
                args: ["playwright-admin@example.com"],
            }),
        );
        return readRequiredString(result.rows[0]?.id, "users.id");
    } finally {
        await client.close();
    }
}

async function snapshotProviderDatabaseState(
    userId: string,
): Promise<ProviderDatabaseSnapshot> {
    const core = createClient({ url: databaseUrl(resolveDatabasePath()) });
    const library = createClient({
        url: databaseUrl(resolveLibraryDatabasePath()),
    });

    try {
        const [connectionResult, deviceResult] = await Promise.all([
            executeWithBusyRetry(() =>
                core.execute({
                    sql: `SELECT id, user_id, provider, enabled, auth_mode, base_url,
                            config, secret_config, last_sync, sync_status,
                            last_sync_error, last_sync_started_at,
                            last_sync_finished_at, created_at, updated_at
                        FROM source_connections
                        WHERE user_id = ? AND provider = ?`,
                    args: [userId, E2E_PROVIDER],
                }),
            ),
            executeWithBusyRetry(() =>
                library.execute({
                    sql: `SELECT id, user_id, provider, provider_device_id, name,
                            model, version_number, created_at, updated_at
                        FROM source_devices
                        WHERE user_id = ? AND provider = ?
                        ORDER BY provider_device_id`,
                    args: [userId, E2E_PROVIDER],
                }),
            ),
        ]);

        return {
            connections: connectionResult.rows.map(
                (row): SourceConnectionSnapshotRow => ({
                    id: readRequiredString(row.id, "source_connections.id"),
                    userId: readRequiredString(
                        row.user_id,
                        "source_connections.user_id",
                    ),
                    provider: readProvider(row.provider),
                    enabled: readRequiredNumber(
                        row.enabled,
                        "source_connections.enabled",
                    ),
                    authMode: readNullableString(
                        row.auth_mode,
                        "source_connections.auth_mode",
                    ),
                    baseUrl: readNullableString(
                        row.base_url,
                        "source_connections.base_url",
                    ),
                    config: readNullableString(
                        row.config,
                        "source_connections.config",
                    ),
                    secretConfig: readNullableString(
                        row.secret_config,
                        "source_connections.secret_config",
                    ),
                    lastSync: readNullableNumber(
                        row.last_sync,
                        "source_connections.last_sync",
                    ),
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
                }),
            ),
            devices: deviceResult.rows.map(
                (row): SourceDeviceSnapshotRow => ({
                    id: readRequiredString(row.id, "source_devices.id"),
                    userId: readRequiredString(
                        row.user_id,
                        "source_devices.user_id",
                    ),
                    provider: readProvider(row.provider),
                    providerDeviceId: readRequiredString(
                        row.provider_device_id,
                        "source_devices.provider_device_id",
                    ),
                    name: readRequiredString(row.name, "source_devices.name"),
                    model: readNullableString(row.model, "source_devices.model"),
                    versionNumber: readNullableNumber(
                        row.version_number,
                        "source_devices.version_number",
                    ),
                    createdAt: readRequiredNumber(
                        row.created_at,
                        "source_devices.created_at",
                    ),
                    updatedAt: readRequiredNumber(
                        row.updated_at,
                        "source_devices.updated_at",
                    ),
                }),
            ),
        };
    } finally {
        await Promise.all([core.close(), library.close()]);
    }
}

async function restoreProviderDatabaseState(
    userId: string,
    snapshot: ProviderDatabaseSnapshot,
) {
    const core = createClient({ url: databaseUrl(resolveDatabasePath()) });
    const library = createClient({
        url: databaseUrl(resolveLibraryDatabasePath()),
    });
    const connectionStatements = [
        {
            sql: "DELETE FROM source_connections WHERE user_id = ? AND provider = ?",
            args: [userId, E2E_PROVIDER],
        },
        ...snapshot.connections.map((row) => ({
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
    ];
    const sourceDeviceStatements = [
        {
            sql: "DELETE FROM source_devices WHERE user_id = ? AND provider = ?",
            args: [userId, E2E_PROVIDER],
        },
        ...snapshot.devices.map((row) => ({
            sql: `INSERT INTO source_devices (
                    id, user_id, provider, provider_device_id, name,
                    model, version_number, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                row.id,
                row.userId,
                row.provider,
                row.providerDeviceId,
                row.name,
                row.model,
                row.versionNumber,
                row.createdAt,
                row.updatedAt,
            ],
        })),
    ];

    try {
        const results = await Promise.allSettled([
            executeWithBusyRetry(() => core.batch(connectionStatements, "write")),
            executeWithBusyRetry(() =>
                library.batch(sourceDeviceStatements, "write"),
            ),
        ]);
        const failure = results.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") {
            throw failure.reason;
        }
    } finally {
        await Promise.all([core.close(), library.close()]);
    }
}

function encryptWithPlaywrightE2EKey(plaintext: string) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(
        "aes-256-gcm",
        Buffer.from(PLAYWRIGHT_E2E_ENCRYPTION_KEY, "hex"),
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

async function seedExistingProviderConnection(
    userId: string,
    enabled: boolean,
): Promise<SeededProviderState> {
    const core = createClient({ url: databaseUrl(resolveDatabasePath()) });
    const library = createClient({
        url: databaseUrl(resolveLibraryDatabasePath()),
    });
    const now = Date.now();
    const config = { syncTitleToSource: true };
    const secretConfig = encryptWithPlaywrightE2EKey(
        JSON.stringify({
            deviceCredential: "e2e-data-sources-lifecycle-secret-sentinel",
        }),
    );

    try {
        const results = await Promise.allSettled([
            executeWithBusyRetry(() =>
                core.batch(
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
                                `e2e-data-sources-lifecycle-connection-${now}`,
                                userId,
                                E2E_PROVIDER,
                                enabled ? 1 : 0,
                                "device-signin",
                                E2E_PROVIDER_BASE_URL,
                                JSON.stringify(config),
                                secretConfig,
                                now - 60_000,
                                "error",
                                "e2e-lifecycle-sync-error",
                                now - 30_000,
                                now - 20_000,
                                now,
                                now,
                            ],
                        },
                    ],
                    "write",
                ),
            ),
            executeWithBusyRetry(() =>
                library.batch(
                    [
                        {
                            sql: "DELETE FROM source_devices WHERE user_id = ? AND provider = ?",
                            args: [userId, E2E_PROVIDER],
                        },
                        {
                            sql: `INSERT INTO source_devices (
                                    id, user_id, provider, provider_device_id, name,
                                    model, version_number, created_at, updated_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            args: [
                                `e2e-data-sources-lifecycle-device-${now}`,
                                userId,
                                E2E_PROVIDER,
                                "e2e-data-sources-lifecycle-device",
                                "E2E lifecycle device",
                                "E2E device model",
                                1,
                                now,
                                now,
                            ],
                        },
                    ],
                    "write",
                ),
            ),
        ]);
        const failure = results.find((result) => result.status === "rejected");
        if (failure?.status === "rejected") {
            throw failure.reason;
        }
    } finally {
        await Promise.all([core.close(), library.close()]);
    }

    return { config, secretConfig };
}

function getOnlyConnection(snapshot: ProviderDatabaseSnapshot) {
    if (snapshot.connections.length !== 1) {
        throw new Error("Expected exactly one seeded data source connection");
    }

    return snapshot.connections[0];
}

async function openDataSourcesSettings(page: Page) {
    await page.goto("/settings#data-sources", { waitUntil: "domcontentloaded" });
    const section = page.locator('[data-sot-surface="settings-data-sources"]');
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("data-sot-load-state", "ready");
    return section;
}

async function selectSeededProvider(page: Page) {
    const section = await openDataSourcesSettings(page);
    const providerCard = section.locator(
        `[data-sot-control="source-provider"][data-sot-provider="${E2E_PROVIDER}"]`,
    );
    await expect(providerCard).toBeVisible();
    await providerCard.click();

    const detail = section.locator(
        `[data-sot-panel="source-provider-detail"][data-sot-provider="${E2E_PROVIDER}"]`,
    );
    await expect(detail).toBeVisible();

    return { detail, providerCard, section };
}

function sourceEnableSyncControl(page: Page) {
    return page.locator(
        `[data-sot-control="source-enable-sync"][data-sot-provider="${E2E_PROVIDER}"]`,
    );
}

function waitForPostResponse(page: Page, pathname: string) {
    return page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
            url.pathname === pathname && response.request().method() === "POST"
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

async function expectSuccess(response: Response) {
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
}

test.describe("Data Sources real server lifecycle actions", () => {
    test.skip(
        !hasGuardedPlaywrightFallback(),
        "Requires the guarded local Playwright data-sources fallback.",
    );

    test("Reconnect posts to the real route and restores the seeded connection", async ({
        page,
    }) => {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const originalSnapshot = await snapshotProviderDatabaseState(userId);

        try {
            const seeded = await seedExistingProviderConnection(userId, false);
            const seededSnapshot = await snapshotProviderDatabaseState(userId);
            const seededConnection = getOnlyConnection(seededSnapshot);
            const { detail, providerCard } = await selectSeededProvider(page);
            const reconnect = detail.locator(
                '[data-sot-control="source-reconnect"]',
            );

            await expect(reconnect).toBeEnabled();
            const reconnectResponse = waitForPostResponse(
                page,
                "/api/data-sources/reconnect",
            );
            const reloadResponse = waitForDataSourcesReload(page);
            await reconnect.click();
            const [postResponse, getResponse] = await Promise.all([
                reconnectResponse,
                reloadResponse,
            ]);

            await expectSuccess(postResponse);
            expect(getResponse.status()).toBe(200);

            const payload = readRecord(
                postResponse.request().postDataJSON(),
                "reconnect request payload",
            );
            expect(payload.provider).toBe(E2E_PROVIDER);
            expect(payload.enabled).toBe(true);
            const payloadConfig = readRecord(payload.config, "reconnect config");

            const persistedSnapshot =
                await snapshotProviderDatabaseState(userId);
            const persistedConnection = getOnlyConnection(persistedSnapshot);
            expect(persistedConnection.enabled).toBe(1);
            expect(persistedConnection.authMode).toBe(payload.authMode);
            expect(persistedConnection.baseUrl).toBe(payload.baseUrl);
            expect(parseStoredConfig(persistedConnection.config)).toEqual({
                ...seeded.config,
                ...payloadConfig,
            });
            expect(persistedConnection.secretConfig).toBe(seeded.secretConfig);
            expect(persistedConnection.lastSync).toBe(seededConnection.lastSync);
            expect(persistedConnection.syncStatus).toBe("idle");
            expect(persistedConnection.lastSyncError).toBeNull();
            expect(persistedConnection.lastSyncStartedAt).toBeNull();
            expect(persistedConnection.lastSyncFinishedAt).toBeNull();
            expect(persistedSnapshot.devices).toEqual(seededSnapshot.devices);

            await expect(detail).toHaveAttribute(
                "data-sot-action-state",
                "reconnected",
            );
            await expect(reconnect).toHaveAttribute(
                "data-sot-state",
                "reconnected",
            );
            await expect(sourceEnableSyncControl(page)).toHaveAttribute(
                "aria-checked",
                "true",
            );

            const pageReloadResponse = waitForDataSourcesReload(page);
            await page.reload({ waitUntil: "domcontentloaded" });
            expect((await pageReloadResponse).status()).toBe(200);

            const reloaded = await selectSeededProvider(page);
            await expect(reloaded.providerCard).toHaveAttribute(
                "data-sot-status",
                "connected",
            );
            await expect(reloaded.detail).toHaveAttribute(
                "data-sot-status",
                "connected",
            );
            await expect(sourceEnableSyncControl(page)).toHaveAttribute(
                "data-sot-enabled",
                "true",
            );
        } finally {
            await restoreProviderDatabaseState(userId, originalSnapshot);
        }
    });

    test("Disconnect posts to the real route and clears the connection without removing devices", async ({
        page,
    }) => {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const originalSnapshot = await snapshotProviderDatabaseState(userId);

        try {
            const seeded = await seedExistingProviderConnection(userId, true);
            const seededSnapshot = await snapshotProviderDatabaseState(userId);
            const seededConnection = getOnlyConnection(seededSnapshot);
            const { detail } = await selectSeededProvider(page);
            const disconnect = detail.locator(
                '[data-sot-control="source-disconnect"]',
            );

            await expect(disconnect).toBeEnabled();
            const disconnectResponse = waitForPostResponse(
                page,
                "/api/data-sources/disconnect",
            );
            const reloadResponse = waitForDataSourcesReload(page);
            await disconnect.click();
            const [postResponse, getResponse] = await Promise.all([
                disconnectResponse,
                reloadResponse,
            ]);

            await expectSuccess(postResponse);
            expect(getResponse.status()).toBe(200);
            expect(
                readRecord(
                    postResponse.request().postDataJSON(),
                    "disconnect request payload",
                ),
            ).toEqual({ provider: E2E_PROVIDER });

            const persistedSnapshot =
                await snapshotProviderDatabaseState(userId);
            const persistedConnection = getOnlyConnection(persistedSnapshot);
            expect(persistedConnection.enabled).toBe(0);
            expect(persistedConnection.authMode).toBe(
                seededConnection.authMode,
            );
            expect(persistedConnection.baseUrl).toBe(seededConnection.baseUrl);
            expect(parseStoredConfig(persistedConnection.config)).toEqual(
                parseStoredConfig(seededConnection.config),
            );
            expect(persistedConnection.secretConfig).toBeNull();
            expect(persistedConnection.lastSync).toBe(seededConnection.lastSync);
            expect(persistedConnection.syncStatus).toBe("idle");
            expect(persistedConnection.lastSyncError).toBeNull();
            expect(persistedConnection.lastSyncStartedAt).toBeNull();
            expect(persistedConnection.lastSyncFinishedAt).toBeNull();
            expect(persistedSnapshot.devices).toEqual(seededSnapshot.devices);
            expect(seeded.secretConfig).toBe(seededConnection.secretConfig);

            await expect(detail).toHaveAttribute(
                "data-sot-action-state",
                "disconnected",
            );
            await expect(disconnect).toHaveAttribute(
                "data-sot-state",
                "disconnected",
            );
            await expect(sourceEnableSyncControl(page)).toHaveAttribute(
                "aria-checked",
                "false",
            );

            const pageReloadResponse = waitForDataSourcesReload(page);
            await page.reload({ waitUntil: "domcontentloaded" });
            expect((await pageReloadResponse).status()).toBe(200);

            const reloaded = await selectSeededProvider(page);
            await expect(reloaded.providerCard).toHaveAttribute(
                "data-sot-status",
                "needs-setup",
            );
            await expect(reloaded.detail).toHaveAttribute(
                "data-sot-status",
                "needs-setup",
            );
            await expect(sourceEnableSyncControl(page)).toHaveAttribute(
                "data-sot-enabled",
                "false",
            );
        } finally {
            await restoreProviderDatabaseState(userId, originalSnapshot);
        }
    });
});
