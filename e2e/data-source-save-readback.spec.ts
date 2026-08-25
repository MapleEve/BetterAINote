import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import type { Page, Response } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_PROVIDER = "dingtalk-a1";
const E2E_PROVIDER_DRAFT = "e2e-data-source-save-draft";
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

async function startDingTalkSaveUpstream() {
    let requestCount = 0;
    let lastRequest: {
        method: string | undefined;
        path: string | undefined;
        credentialMatched: boolean;
    } | null = null;
    const server = createServer((request, response) => {
        lastRequest = {
            method: request.method,
            path: request.url,
            credentialMatched:
                request.headers["dt-meeting-agent-token"] ===
                E2E_PROVIDER_DRAFT,
        };
        if (
            request.method !== "POST" ||
            request.url !== "/ai/tingji/getConversationList"
        ) {
            response.writeHead(404).end();
            return;
        }

        requestCount += 1;
        if (request.headers["dt-meeting-agent-token"] !== E2E_PROVIDER_DRAFT) {
            response.writeHead(401).end();
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
        getLastRequest: () => lastRequest,
        getRequestCount: () => requestCount,
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

async function seedDisabledFallbackConnection(userId: string, baseUrl: string) {
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
                            baseUrl,
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

async function acquireExclusiveDatabaseLock() {
    const client = createClient({ url: databaseUrl(resolveDatabasePath()) });
    let active = false;

    try {
        await client.execute("PRAGMA busy_timeout = 10000");
        await client.execute("BEGIN EXCLUSIVE");
        active = true;
    } catch (error) {
        await client.close();
        throw error;
    }

    return async () => {
        if (!active) {
            return;
        }

        active = false;
        try {
            await client.execute("COMMIT");
        } finally {
            await client.close();
        }
    };
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

async function openFallbackProvider(
    page: Page,
    expectedStatus: RegExp = /待设置|Not configured/,
) {
    await page.goto("/settings#data-sources", { waitUntil: "domcontentloaded" });

    const dialog = page.getByRole("dialog", { name: /^(设置|Settings)$/ });
    const sourceList = dialog.getByRole("complementary", {
        name: /^(数据源列表|Data source list)$/,
    });
    const providerName = /钉钉\s*闪记|DingTalk A1 Flash Notes/;
    const providerCard = sourceList.getByRole("button", { name: providerName });
    const providerStatusName = new RegExp(
        `^(钉钉\\s*闪记|DingTalk A1 Flash Notes): (${expectedStatus.source})$`,
        expectedStatus.flags.replace("g", ""),
    );

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

function waitForSaveRequest(page: Page) {
    return page.waitForRequest((request) => {
        const url = new URL(request.url());
        return (
            url.pathname === "/api/data-sources" && request.method() === "PUT"
        );
    });
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
    test.beforeEach(() => {
        if (!hasGuardedPlaywrightFallback()) {
            throw new Error(
                "This spec requires the guarded local Playwright data-sources fallback.",
            );
        }
    });

    test("preserves a locked-database draft, retries the real save, and reads enabled and disabled states back", async ({
        page,
    }) => {
        await ensureSignedIn(page);
        const userId = await getPlaywrightUserId();
        const originalSnapshot = await snapshotProviderConnection(userId);
        const upstream = await startDingTalkSaveUpstream();
        let primaryFlowError: unknown;
        let releaseDatabaseLock: (() => Promise<void>) | null = null;

        try {
            await seedDisabledFallbackConnection(userId, upstream.baseUrl);
            const beforeSave = await snapshotProviderConnection(userId);
            expect(beforeSave).toHaveLength(1);
            expect(beforeSave[0]?.enabled).toBe(0);
            expect(beforeSave[0]?.secretConfig).toBeNull();

            const { detail, providerCard } = await openFallbackProvider(page);
            const enableSync = detail.getByRole("switch", {
                name: /^(启用同步|Enable sync)$/,
            });
            const titleWriteback = detail.getByRole("switch", {
                name: /^(标题更新回来源|Title updates to source)$/,
            });
            const deviceIdentifier = detail.getByRole("textbox", {
                name: /^(设备标识|Device identifier)$/,
            });
            const save = detail.getByRole("button", {
                name: /^(保存|保存中|已保存|Save|Saving|Saved)$/,
            });

            await expect(providerCard).toBeVisible();
            await expect(enableSync).toHaveAttribute("aria-checked", "false");
            await expect(titleWriteback).toHaveAttribute("aria-checked", "true");
            await deviceIdentifier.fill(E2E_PROVIDER_DRAFT);
            await titleWriteback.click();
            await expect(titleWriteback).toHaveAttribute("aria-checked", "false");
            await expect(save).toBeEnabled();

            await enableSync.click();
            await expect(enableSync).toHaveAttribute("aria-checked", "true");

            releaseDatabaseLock = await acquireExclusiveDatabaseLock();
            const failedSaveRequest = waitForSaveRequest(page);
            const failedSaveResponse = waitForSaveResponse(page);
            await save.click();
            const failedRequest = await failedSaveRequest;
            await expect(detail).toHaveAttribute("aria-busy", "true");
            await expect(save).toHaveAttribute("aria-busy", "true");
            await expect(enableSync).toBeDisabled();
            await expect(save).toBeDisabled();

            expect(failedRequest.postDataJSON()).toMatchObject({
                provider: E2E_PROVIDER,
                enabled: true,
                authMode: "device-signin",
                baseUrl: upstream.baseUrl,
                config: { syncTitleToSource: false },
                secrets: { deviceCredential: E2E_PROVIDER_DRAFT },
            });

            const failedResponse = await failedSaveResponse;
            expect(failedResponse.status()).toBe(500);
            await expect(failedResponse.json()).resolves.toEqual({
                error: "Failed to save data sources",
            });
            await expect(
                detail.getByRole("alert", {
                    name: /^(保存失败|Save failed)$/,
                }),
            ).toBeVisible();
            await expect(detail).toHaveAttribute("aria-busy", "false");
            await expect(deviceIdentifier).toHaveValue(E2E_PROVIDER_DRAFT);
            await expect(enableSync).toHaveAttribute("aria-checked", "true");
            await expect(titleWriteback).toHaveAttribute("aria-checked", "false");
            await expect(save).toBeEnabled();
            expect(upstream.getRequestCount()).toBe(0);

            await releaseDatabaseLock();
            releaseDatabaseLock = null;
            expect(await snapshotProviderConnection(userId)).toEqual(beforeSave);

            const saveRequest = waitForSaveRequest(page);
            const saveResponse = waitForSaveResponse(page);
            const refreshResponse = waitForDataSourcesReload(page);
            await save.click();
            const [response, refresh] = await Promise.all([
                saveResponse,
                refreshResponse,
            ]);
            const request = await saveRequest;
            expect(response.status()).toBe(200);
            await expect(response.json()).resolves.toEqual({ success: true });
            expect(refresh.status()).toBe(200);

            const payload = readRecord(request.postDataJSON(), "data source save payload");
            expect(payload.provider).toBe(E2E_PROVIDER);
            expect(payload.enabled).toBe(true);
            expect(payload.config).toEqual({ syncTitleToSource: false });
            expect(payload.secrets).toEqual({
                deviceCredential: E2E_PROVIDER_DRAFT,
            });

            const persisted = await snapshotProviderConnection(userId);
            expect(persisted).toHaveLength(1);
            expect(persisted[0]).toMatchObject({
                authMode: "device-signin",
                baseUrl: upstream.baseUrl,
                enabled: 1,
            });
            expect(persisted[0]?.config).toBe(
                JSON.stringify({ syncTitleToSource: false }),
            );
            expect(persisted[0]?.secretConfig).not.toBeNull();
            expect(persisted[0]?.secretConfig).not.toContain(E2E_PROVIDER_DRAFT);

            const apiReadback = await readDataSourceState(page);
            expect(apiReadback.enabled).toBe(true);
            expect(apiReadback.connected).toBe(true);
            expect(apiReadback.authMode).toBe("device-signin");
            expect(apiReadback.baseUrl).toBe(upstream.baseUrl);
            expect(apiReadback.config).toEqual({ syncTitleToSource: false });
            expect(apiReadback.secretsConfigured).toMatchObject({
                deviceCredential: true,
            });
            expect(upstream.getRequestCount()).toBe(1);
            expect(upstream.getLastRequest()).toEqual({
                method: "POST",
                path: "/ai/tingji/getConversationList",
                credentialMatched: true,
            });

            const pageReload = waitForDataSourcesReload(page);
            await page.reload({ waitUntil: "domcontentloaded" });
            expect((await pageReload).status()).toBe(200);

            const reloaded = await openFallbackProvider(page, /已连接|Connected/);
            const reloadedEnableSync = reloaded.detail.getByRole("switch", {
                name: /^(启用同步|Enable sync)$/,
            });
            await expect(reloadedEnableSync).toHaveAttribute("aria-checked", "true");

            const disabledSaveRequest = waitForSaveRequest(page);
            const disabledSaveResponse = waitForSaveResponse(page);
            const disabledRefreshResponse = waitForDataSourcesReload(page);
            await reloadedEnableSync.click();
            await expect(reloadedEnableSync).toHaveAttribute(
                "aria-checked",
                "false",
            );
            await reloaded.detail
                .getByRole("button", {
                    name: /^(保存|保存中|已保存|Save|Saving|Saved)$/,
                })
                .click();
            const [disabledRequest, disabledResponse, disabledRefresh] =
                await Promise.all([
                    disabledSaveRequest,
                    disabledSaveResponse,
                    disabledRefreshResponse,
                ]);
            expect(disabledResponse.status()).toBe(200);
            expect(disabledRefresh.status()).toBe(200);
            expect(disabledRequest.postDataJSON()).toMatchObject({
                provider: E2E_PROVIDER,
                enabled: false,
                config: { syncTitleToSource: false },
            });

            const disabledPersisted = await snapshotProviderConnection(userId);
            expect(disabledPersisted).toHaveLength(1);
            expect(disabledPersisted[0]).toMatchObject({
                enabled: 0,
                config: JSON.stringify({ syncTitleToSource: false }),
            });
            expect(disabledPersisted[0]?.secretConfig).not.toBeNull();
            expect(disabledPersisted[0]?.secretConfig).not.toContain(
                E2E_PROVIDER_DRAFT,
            );
            const disabledApiReadback = await readDataSourceState(page);
            expect(disabledApiReadback.enabled).toBe(false);
            expect(disabledApiReadback.connected).toBe(false);
            expect(disabledApiReadback.config).toEqual({
                syncTitleToSource: false,
            });
            expect(disabledApiReadback.secretsConfigured).toMatchObject({
                deviceCredential: true,
            });
            expect(upstream.getRequestCount()).toBe(1);

            const disabledPageReload = waitForDataSourcesReload(page);
            await page.reload({ waitUntil: "domcontentloaded" });
            expect((await disabledPageReload).status()).toBe(200);
            const disabledReloaded = await openFallbackProvider(
                page,
                /同步已暂停|Paused/,
            );
            await expect(
                disabledReloaded.detail.getByRole("switch", {
                    name: /^(启用同步|Enable sync)$/,
                }),
            ).toHaveAttribute("aria-checked", "false");
        } catch (error) {
            primaryFlowError = error;
            throw error;
        } finally {
            try {
                try {
                    await releaseDatabaseLock?.();
                    await restoreProviderConnection(userId, originalSnapshot);
                    expect(await snapshotProviderConnection(userId)).toEqual(
                        originalSnapshot,
                    );
                } finally {
                    await upstream.close();
                }
            } catch (cleanupError) {
                if (primaryFlowError) {
                    const primaryMessage =
                        primaryFlowError instanceof Error
                            ? primaryFlowError.message
                            : String(primaryFlowError);
                    const cleanupMessage =
                        cleanupError instanceof Error
                            ? cleanupError.message
                            : String(cleanupError);
                    throw new AggregateError(
                        [primaryFlowError, cleanupError],
                        `Data source save test and cleanup both failed: primary=${primaryMessage}; cleanup=${cleanupMessage}`,
                    );
                }

                throw cleanupError;
            }
        }
    });
});
