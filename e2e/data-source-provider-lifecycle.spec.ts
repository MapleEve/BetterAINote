import { createCipheriv, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_PROVIDER = "dingtalk-a1";
const E2E_PROVIDER_CREDENTIAL = "e2e-provider-lifecycle-secret-sentinel";
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

async function startDingTalkTestUpstream() {
    let requestCount = 0;
    let lastRequest: {
        method: string | undefined;
        path: string | undefined;
        credentialMatched: boolean;
    } | null = null;
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
        releaseResponse = resolve;
    });
    let markRequestReceived!: () => void;
    const requestReceived = new Promise<void>((resolve) => {
        markRequestReceived = resolve;
    });
    const server = createServer((request, response) => {
        lastRequest = {
            method: request.method,
            path: request.url,
            credentialMatched:
                request.headers["dt-meeting-agent-token"] ===
                E2E_PROVIDER_CREDENTIAL,
        };
        if (
            request.method !== "POST" ||
            request.url !== "/ai/tingji/getConversationList"
        ) {
            response.writeHead(404).end();
            return;
        }

        requestCount += 1;
        if (request.headers["dt-meeting-agent-token"] !== E2E_PROVIDER_CREDENTIAL) {
            response.writeHead(401).end();
            return;
        }

        markRequestReceived();
        void responseGate.then(() => {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ data: { items: [] } }));
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });
    const address = server.address() as AddressInfo;

    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => {
            releaseResponse();
            return new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
                server.closeAllConnections();
            });
        },
        getLastRequest: () => lastRequest,
        getRequestCount: () => requestCount,
        releaseResponse,
        waitForRequest: () => requestReceived,
    };
}

async function startDingTalkRetryUpstream() {
    const requests: Array<{
        method: string | undefined;
        path: string | undefined;
        credentialMatched: boolean;
        responseStatus: number;
    }> = [];
    const server = createServer((request, response) => {
        if (
            request.method !== "POST" ||
            request.url !== "/ai/tingji/getConversationList"
        ) {
            response.writeHead(404).end();
            return;
        }

        const credentialMatched =
            request.headers["dt-meeting-agent-token"] ===
            E2E_PROVIDER_CREDENTIAL;
        const responseStatus = !credentialMatched
            ? 401
            : requests.length === 0
              ? 403
              : 200;
        requests.push({
            method: request.method,
            path: request.url,
            credentialMatched,
            responseStatus,
        });

        if (responseStatus !== 200) {
            response.writeHead(responseStatus).end();
            return;
        }

        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ data: { items: [] } }));
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });
    const address = server.address() as AddressInfo;

    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
                server.closeAllConnections();
            }),
        getRequests: () => [...requests],
    };
}

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

function resolveLibraryDatabasePath() {
    const parsed = path.parse(resolveDatabasePath());
    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-library${parsed.ext || ".db"}`,
    );
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

async function snapshotDingTalkTestPersistence(userId: string) {
    const core = createClient({ url: databaseUrl(resolveDatabasePath()) });
    const library = createClient({
        url: databaseUrl(resolveLibraryDatabasePath()),
    });

    try {
        const [connections, workerState, devices] = await Promise.all([
            snapshotDingTalkConnection(userId),
            core.execute({
                sql: `SELECT id, user_id, last_heartbeat_at, last_started_at,
                             last_finished_at, next_run_at,
                             manual_trigger_requested_at, is_running,
                             last_error, last_summary, created_at, updated_at
                      FROM sync_worker_state
                      WHERE user_id = ?
                      ORDER BY id`,
                args: [userId],
            }),
            library.execute({
                sql: `SELECT id, user_id, provider, provider_device_id,
                             name, model, version_number, created_at, updated_at
                      FROM source_devices
                      WHERE user_id = ? AND provider = ?
                      ORDER BY id`,
                args: [userId, E2E_PROVIDER],
            }),
        ]);

        return {
            connections,
            devices: devices.rows.map((row) => ({ ...row })),
            workerState: workerState.rows.map((row) => ({ ...row })),
        };
    } finally {
        await Promise.all([core.close(), library.close()]);
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

async function seedConnectedDingTalkConnection(userId: string, baseUrl: string) {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    const now = Date.now();
    const secretConfig = encryptWithPlaywrightE2EKey(
        JSON.stringify({
            deviceCredential: E2E_PROVIDER_CREDENTIAL,
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
                        baseUrl,
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

    const dialog = page.getByRole("dialog", { name: /^(设置|Settings)$/ });
    const sourceList = dialog.getByRole("complementary", {
        name: /^(数据源列表|Data source list)$/,
    });
    const providerName = /钉钉\s*闪记|DingTalk A1 Flash Notes/;
    const providerCard = sourceList.getByRole("button", { name: providerName });
    const providerStatusName =
        /^(钉钉\s*闪记|DingTalk A1 Flash Notes): (已连接|Connected)$/;

    await expect(dialog).toBeVisible();
    await expect(
        providerCard.getByRole("status", { name: providerStatusName }),
    ).toBeVisible();
    await providerCard.click();
    const detail = dialog.getByRole("region", { name: providerName });
    await expect(detail).toBeVisible();
    await expect(
        detail.getByRole("status", { name: providerStatusName }),
    ).toBeVisible();

    return { detail, providerCard };
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
        const upstream = await startDingTalkTestUpstream();

        try {
            await seedConnectedDingTalkConnection(userId, upstream.baseUrl);
            const beforeTest = await snapshotDingTalkTestPersistence(userId);
            expect(beforeTest.connections).toHaveLength(1);
            expect(beforeTest.connections[0]).toMatchObject({
                enabled: 1,
                authMode: "device-signin",
                baseUrl: upstream.baseUrl,
            });
            expect(beforeTest.connections[0]?.secretConfig).not.toContain(
                E2E_PROVIDER_CREDENTIAL,
            );

            const { detail } = await openDingTalkProvider(page);
            const sourceTest = detail.getByRole("button", {
                name: /^(测试连接|测试中|连接正常|Test|Testing|Ready)$/,
            });
            const reconnect = detail.getByRole("button", {
                name: /^(重新连接|Reconnect)$/,
            });
            const disconnect = detail.getByRole("button", {
                name: /^(断开连接|Disconnect)$/,
            });
            await expect(sourceTest).toBeEnabled();
            await expect(reconnect).toBeEnabled();
            await expect(disconnect).toBeEnabled();

            const testResponse = waitForDataSourcesTestResponse(page);
            await sourceTest.click();
            await upstream.waitForRequest();
            await expect(detail).toHaveAttribute("aria-busy", "true");
            await expect(sourceTest).toHaveAttribute("aria-busy", "true");
            await expect(sourceTest).toBeDisabled();
            await expect(reconnect).toBeDisabled();
            await expect(disconnect).toBeDisabled();

            upstream.releaseResponse();
            const response = await testResponse;
            expect(upstream.getLastRequest()).toEqual({
                method: "POST",
                path: "/ai/tingji/getConversationList",
                credentialMatched: true,
            });
            expect(upstream.getRequestCount()).toBe(1);
            expect(response.status()).toBe(200);
            await expect(response.json()).resolves.toEqual({ success: true });
            expect(
                response.request().postDataJSON(),
            ).toMatchObject({
                provider: E2E_PROVIDER,
                authMode: "device-signin",
                baseUrl: upstream.baseUrl,
            });

            await expect(detail).toHaveAttribute("aria-busy", "false");
            await expect(
                detail.getByRole("status", {
                    name: /^(连接测试通过|Connection test passed)$/,
                }),
            ).toBeVisible();
            await expect(sourceTest).toHaveText(/连接正常|Ready/);
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
            expect(sourceReadback.baseUrl).toBe(upstream.baseUrl);

            const afterTest = await snapshotDingTalkTestPersistence(userId);
            expect(afterTest).toEqual(beforeTest);

            const reloadResponse = waitForDataSourcesReload(page);
            await page.reload({ waitUntil: "domcontentloaded" });
            expect((await reloadResponse).status()).toBe(200);

            const reloaded = await openDingTalkProvider(page);
            await expect(
                reloaded.detail.getByRole("button", {
                    name: /^(测试连接|Test)$/,
                }),
            ).toBeVisible();
        } finally {
            try {
                await restoreDingTalkConnection(userId, originalSnapshot);
            } finally {
                await upstream.close();
            }
        }
    });

    test("Test surfaces a real permission error, retries successfully, and leaves all persistence unchanged", async ({
        page,
    }) => {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const originalSnapshot = await snapshotDingTalkConnection(userId);
        const upstream = await startDingTalkRetryUpstream();

        try {
            await seedConnectedDingTalkConnection(userId, upstream.baseUrl);
            const beforeTest = await snapshotDingTalkTestPersistence(userId);
            const { detail } = await openDingTalkProvider(page);
            const sourceTest = detail.getByRole("button", {
                name: /^(测试连接|连接正常|Test|Ready)$/,
            });

            const failedTestResponse = waitForDataSourcesTestResponse(page);
            await sourceTest.click();
            const failedResponse = await failedTestResponse;
            expect(failedResponse.status()).toBe(400);
            await expect(failedResponse.json()).resolves.toEqual({
                error: "未能连接数据源",
            });
            await expect(
                detail.getByRole("alert", {
                    name: /^(连接测试失败|Connection test failed)$/,
                }),
            ).toBeVisible();
            await expect(detail).toHaveAttribute("aria-busy", "false");
            await expect(sourceTest).toBeEnabled();
            expect(await snapshotDingTalkTestPersistence(userId)).toEqual(
                beforeTest,
            );

            const retryResponse = waitForDataSourcesTestResponse(page);
            await sourceTest.click();
            const recoveredResponse = await retryResponse;
            expect(recoveredResponse.status()).toBe(200);
            await expect(recoveredResponse.json()).resolves.toEqual({
                success: true,
            });
            await expect(
                detail.getByRole("status", {
                    name: /^(连接测试通过|Connection test passed)$/,
                }),
            ).toBeVisible();
            expect(upstream.getRequests()).toEqual([
                {
                    method: "POST",
                    path: "/ai/tingji/getConversationList",
                    credentialMatched: true,
                    responseStatus: 403,
                },
                {
                    method: "POST",
                    path: "/ai/tingji/getConversationList",
                    credentialMatched: true,
                    responseStatus: 200,
                },
            ]);
            expect(await snapshotDingTalkTestPersistence(userId)).toEqual(
                beforeTest,
            );
        } finally {
            try {
                await restoreDingTalkConnection(userId, originalSnapshot);
            } finally {
                await upstream.close();
            }
        }
    });
});
