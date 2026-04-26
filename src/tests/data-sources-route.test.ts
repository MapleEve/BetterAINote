import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
        update: vi.fn(),
        insert: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: vi.fn(),
        },
    },
}));

vi.mock("@/lib/encryption", () => ({
    decrypt: vi.fn((value: string) => value),
    encrypt: vi.fn((value: string) => `encrypted:${value}`),
}));

vi.mock("@/lib/data-sources/providers/plaud/client", () => ({
    PlaudClient: vi.fn(),
    normalizePlaudBearerToken: vi.fn((value: string) => value.trim()),
}));

import { GET, PUT } from "@/app/api/data-sources/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { PlaudClient } from "@/lib/data-sources/providers/plaud/client";

describe("data sources route", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = originalFetch;
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
    });

    it("returns provider-scoped source title writeback config inside the Plaud config", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                    {
                        id: "source-connection-1",
                        userId: "user-1",
                        provider: "plaud",
                        enabled: true,
                        authMode: "bearer",
                        baseUrl: "https://api.plaud.ai",
                        config: {
                            server: "global",
                            customApiBase: "",
                            syncTitleToSource: true,
                        },
                        secretConfig: JSON.stringify({
                            bearerToken: "encrypted-token",
                        }),
                        lastSync: null,
                    },
                ]),
            }),
        });

        const response = await GET(
            new Request("http://localhost/api/data-sources"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            sources: expect.arrayContaining([
                expect.objectContaining({
                    provider: "plaud",
                    enabled: true,
                    connected: true,
                    capabilities: expect.objectContaining({
                        upstreamTitleWriteback: true,
                    }),
                    config: expect.objectContaining({
                        syncTitleToSource: true,
                    }),
                }),
            ]),
        });
    });

    it("does not leak Plaud-only source title writeback config into other providers", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                    {
                        id: "source-connection-iflyrec",
                        userId: "user-1",
                        provider: "iflyrec",
                        enabled: true,
                        authMode: "session-header",
                        baseUrl: "https://www.iflyrec.com",
                        config: {
                            bizId: "tjzs",
                        },
                        secretConfig: JSON.stringify({
                            sessionId: "session-123",
                        }),
                        lastSync: null,
                    },
                ]),
            }),
        });

        const response = await GET(
            new Request("http://localhost/api/data-sources"),
        );

        expect(response.status).toBe(200);
        const payload = (await response.json()) as {
            sources: Array<{
                provider: string;
                config: Record<string, unknown>;
            }>;
        };

        expect(payload).toMatchObject({
            sources: expect.arrayContaining([
                expect.objectContaining({
                    provider: "iflyrec",
                    capabilities: expect.objectContaining({
                        upstreamTitleWriteback: false,
                    }),
                    config: expect.objectContaining({
                        bizId: "tjzs",
                    }),
                }),
            ]),
        });

        const iflyrecSource = payload.sources.find(
            (source) => source.provider === "iflyrec",
        );

        expect(iflyrecSource?.config).not.toHaveProperty("syncTitleToSource");
    });

    it("does not mark iFLYTEK iflyrec connected without a usable session id", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                    {
                        id: "source-connection-iflyrec",
                        userId: "user-1",
                        provider: "iflyrec",
                        enabled: true,
                        authMode: "session-header",
                        baseUrl: "https://www.iflyrec.com",
                        config: {
                            bizId: "tjzs",
                        },
                        secretConfig: JSON.stringify({
                            cookie: "legacy-cookie",
                        }),
                        lastSync: null,
                    },
                ]),
            }),
        });

        const response = await GET(
            new Request("http://localhost/api/data-sources"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            sources: expect.arrayContaining([
                expect.objectContaining({
                    provider: "iflyrec",
                    authMode: "session-header",
                    connected: false,
                }),
            ]),
        });
    });

    it("does not mark DingTalk A1 connected when the active auth secret is missing for the selected mode", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                    {
                        id: "source-connection-dingtalk",
                        userId: "user-1",
                        provider: "dingtalk-a1",
                        enabled: true,
                        authMode: "agent-token",
                        baseUrl: "https://meeting-ai-tingji.dingtalk.com",
                        config: {},
                        secretConfig: JSON.stringify({
                            cookie: "dt_cookie=abc123;",
                        }),
                        lastSync: null,
                    },
                ]),
            }),
        });

        const response = await GET(
            new Request("http://localhost/api/data-sources"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            sources: expect.arrayContaining([
                expect.objectContaining({
                    provider: "dingtalk-a1",
                    authMode: "agent-token",
                    connected: false,
                }),
            ]),
        });
    });

    it("serializes Feishu Minutes browser sign-in without recording import capabilities", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                    {
                        id: "source-connection-feishu",
                        userId: "user-1",
                        provider: "feishu-minutes",
                        enabled: true,
                        authMode: "web-reverse",
                        baseUrl: "https://meetings.feishu.cn",
                        config: {
                            spaceName: "cn",
                        },
                        secretConfig: JSON.stringify({
                            webCookie:
                                "minutes_csrf_token=csrf-value; session=redacted",
                        }),
                        lastSync: null,
                    },
                ]),
            }),
        });

        const response = await GET(
            new Request("http://localhost/api/data-sources"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            sources: expect.arrayContaining([
                expect.objectContaining({
                    provider: "feishu-minutes",
                    authMode: "web-reverse",
                    connected: true,
                    capabilities: expect.objectContaining({
                        workerSync: false,
                        audioDownload: false,
                        officialTranscript: false,
                        officialSummary: false,
                        privateTranscribe: false,
                    }),
                }),
            ]),
        });
    });

    it("updates the Plaud source title writeback toggle through provider config in /api/data-sources", async () => {
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: "source-connection-1",
                            userId: "user-1",
                            provider: "plaud",
                            enabled: true,
                            authMode: "bearer",
                            baseUrl: "https://api.plaud.ai",
                            config: {
                                server: "global",
                                customApiBase: "",
                                syncTitleToSource: false,
                            },
                            secretConfig: JSON.stringify({
                                bearerToken: "encrypted-token",
                            }),
                        },
                    ]),
                }),
            }),
        });
        (db.update as Mock).mockReturnValueOnce({ set: updateSet });
        (PlaudClient as unknown as Mock).mockImplementation(() => ({
            testConnection: vi.fn().mockResolvedValue(true),
            listDevices: vi.fn().mockResolvedValue({ data_devices: [] }),
        }));

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "plaud",
                    enabled: true,
                    authMode: "bearer",
                    config: {
                        server: "global",
                        customApiBase: "",
                        syncTitleToSource: true,
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({
                config: expect.objectContaining({
                    syncTitleToSource: true,
                }),
            }),
        );
    });

    it("rejects an invalid Plaud service address with user-facing copy", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "plaud",
                    enabled: true,
                    authMode: "bearer",
                    config: {
                        server: "custom",
                        customApiBase: "https://example.com",
                    },
                    secrets: {
                        bearerToken: "bearer-token",
                    },
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "Please enter a valid Plaud service address.",
        });
    });

    it("saves TicNote connection details through /api/data-sources", async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.insert as Mock).mockReturnValueOnce({ values: insertValues });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    baseUrl: "https://voice-api.ticnote.cn",
                    config: {
                        region: "cn",
                        orgId: "org_123",
                        timezone: "Asia/Shanghai",
                        language: "zh",
                    },
                    secrets: {
                        bearerToken: "Bearer \n tic-token-123 ",
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://voice-api.ticnote.cn/api/v2/file-index/chats",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer tic-token-123",
                    "X-Tic-Org-Id": "org_123",
                    "X-Tic-Lang": "zh",
                    Timezone: "Asia/Shanghai",
                }),
            }),
        );
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "ticnote",
                enabled: true,
                authMode: "bearer",
                baseUrl: "https://voice-api.ticnote.cn",
                config: expect.objectContaining({
                    region: "cn",
                    orgId: "org_123",
                    timezone: "Asia/Shanghai",
                    language: "zh",
                }),
                secretConfig: 'encrypted:{"bearerToken":"tic-token-123"}',
            }),
        );
    });

    it("maps TicNote international region to the fixed international API host", async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.insert as Mock).mockReturnValueOnce({ values: insertValues });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    baseUrl: "https://voice-api.ticnote.cn",
                    config: {
                        region: "intl",
                        orgId: "org_456",
                        timezone: "Asia/Shanghai",
                        language: "en",
                    },
                    secrets: {
                        bearerToken: "tic-token-456",
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://prd-backend-api.ticnote.com/api/v2/file-index/chats",
            expect.any(Object),
        );
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                baseUrl: "https://prd-backend-api.ticnote.com/api",
                config: expect.objectContaining({
                    region: "intl",
                    orgId: "org_456",
                    language: "en",
                }),
            }),
        );
    });

    it("rejects enabling TicNote without sign-in details", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    config: {},
                    secrets: {},
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "请填写登录令牌。",
        });
    });

    it("auto-detects the TicNote org id before saving when sign-in details are present", async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    chats: [
                        {
                            id: "chat-fixture-route",
                            organizationId: "org-fixture-route",
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ chats: [] }),
            });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.insert as Mock).mockReturnValueOnce({ values: insertValues });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    baseUrl: "https://voice-api.ticnote.cn",
                    config: {
                        region: "cn",
                        orgId: "",
                        timezone: "Asia/Shanghai",
                        language: "zh",
                    },
                    secrets: {
                        bearerToken: "tic-token-route",
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            "https://voice-api.ticnote.cn/api/v2/file-index/chats",
        );
        expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty(
            "X-Tic-Org-Id",
        );
        expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
            "X-Tic-Org-Id": "org-fixture-route",
        });
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "ticnote",
                enabled: true,
                config: expect.objectContaining({
                    orgId: "org-fixture-route",
                }),
                secretConfig: 'encrypted:{"bearerToken":"tic-token-route"}',
            }),
        );
    });

    it("rejects saving TicNote with an invalid timezone", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    baseUrl: "https://voice-api.ticnote.cn",
                    config: {
                        region: "cn",
                        orgId: "org_123",
                        timezone: "Mars/Olympus",
                        language: "zh",
                    },
                    secrets: {
                        bearerToken: "tic-token-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "TicNote timezone is invalid",
        });
    });

    it("rejects saving TicNote with an unsupported language tag", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    baseUrl: "https://voice-api.ticnote.cn",
                    config: {
                        region: "cn",
                        orgId: "org_123",
                        timezone: "Asia/Shanghai",
                        language: "zh-CN",
                    },
                    secrets: {
                        bearerToken: "tic-token-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "TicNote language must be one of zh, en, ja",
        });
    });

    it("validates TicNote credentials with a real testConnection before saving", async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.insert as Mock).mockReturnValueOnce({ values: insertValues });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    baseUrl: "https://voice-api.ticnote.cn",
                    config: {
                        region: "cn",
                        orgId: "org_123",
                        timezone: "Asia/Shanghai",
                        language: "zh",
                    },
                    secrets: {
                        bearerToken: "tic-token-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://voice-api.ticnote.cn/api/v2/file-index/chats",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer tic-token-123",
                    "X-Tic-Org-Id": "org_123",
                    "X-Tic-Lang": "zh",
                    Timezone: "Asia/Shanghai",
                }),
            }),
        );
    });

    it("rejects saving TicNote with a sanitized validation failure reason", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: async () =>
                JSON.stringify({
                    message: "session expired",
                    Authorization: "Bearer leaked-token",
                    cookie: "session=leaked-cookie",
                    orgId: "org_123",
                }),
        });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "ticnote",
                    enabled: true,
                    authMode: "bearer",
                    baseUrl: "https://voice-api.ticnote.cn",
                    config: {
                        region: "cn",
                        orgId: "org_123",
                        timezone: "Asia/Shanghai",
                        language: "zh",
                    },
                    secrets: {
                        bearerToken: "tic-token-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(400);
        const payload = (await response.json()) as { error: string };
        expect(payload.error).toBe("未能连接数据源");
        expect(payload.error).not.toContain("HTTP 401");
        expect(payload.error).not.toContain("session expired");
        expect(payload.error).not.toContain("leaked-token");
        expect(payload.error).not.toContain("leaked-cookie");
        expect(payload.error).not.toContain("org_123");
        expect(payload.error).not.toContain("Authorization");
        expect(payload.error).not.toContain("cookie");
        expect(payload.error).not.toContain("orgId");
    });

    it("saves Feishu Minutes connection details through /api/data-sources", async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                code: 0,
                data: {
                    items: [],
                },
            }),
        });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.insert as Mock).mockReturnValueOnce({ values: insertValues });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "feishu-minutes",
                    enabled: true,
                    authMode: "oauth-device-flow",
                    baseUrl: "https://open.feishu.cn",
                    config: {
                        appId: "cli_xxx",
                    },
                    secrets: {
                        userAccessToken: "u-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://open.feishu.cn/open-apis/vc/v1/meetings/search?page_size=1",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer u-123",
                    Accept: "application/json",
                }),
            }),
        );
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "feishu-minutes",
                enabled: true,
                authMode: "oauth-device-flow",
                baseUrl: "https://open.feishu.cn",
                config: expect.objectContaining({
                    appId: "cli_xxx",
                }),
                secretConfig: 'encrypted:{"userAccessToken":"u-123"}',
            }),
        );
    });

    it("rejects enabling Feishu Minutes without a user access token", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "feishu-minutes",
                    enabled: true,
                    authMode: "oauth-device-flow",
                    baseUrl: "https://open.feishu.cn",
                    config: {
                        appId: "cli_xxx",
                    },
                    secrets: {},
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "Feishu user access token is required",
        });
    });

    it("saves Feishu Minutes browser sign-in credentials through /api/data-sources", async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    list: [],
                },
            }),
        });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.insert as Mock).mockReturnValueOnce({ values: insertValues });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "feishu-minutes",
                    enabled: true,
                    authMode: "web-reverse",
                    baseUrl: "https://attacker.example",
                    config: {
                        spaceName: "cn",
                    },
                    secrets: {
                        webCookie:
                            "minutes_csrf_token=csrf-value; session=redacted",
                        webToken: "web-token-redacted",
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://meetings.feishu.cn/list?size=1&space_name=cn",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Cookie: "minutes_csrf_token=csrf-value; session=redacted",
                    "X-Feishu-Minutes-Token": "web-token-redacted",
                }),
            }),
        );
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "feishu-minutes",
                enabled: true,
                authMode: "web-reverse",
                baseUrl: "https://meetings.feishu.cn",
                config: {
                    spaceName: "cn",
                },
                secretConfig:
                    'encrypted:{"webCookie":"minutes_csrf_token=csrf-value; session=redacted","webToken":"web-token-redacted"}',
            }),
        );
    });

    it("rejects an unavailable Feishu Minutes sign-in choice with user-facing copy", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "feishu-minutes",
                    enabled: true,
                    authMode: "temporary-code",
                    baseUrl: "https://open.feishu.cn",
                    config: {},
                    secrets: {},
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "请选择可用的登录方式。",
        });
    });

    it("rejects saving Feishu Minutes when testConnection fails", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                code: 0,
                data: {
                    total: 1,
                },
            }),
        });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "feishu-minutes",
                    enabled: true,
                    authMode: "oauth-device-flow",
                    baseUrl: "https://open.feishu.cn",
                    config: {
                        appId: "cli_xxx",
                    },
                    secrets: {
                        userAccessToken: "u-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "未能连接数据源",
        });
    });

    it("validates iFLYTEK iflyrec connections before saving", async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                biz: {
                    hjList: [],
                },
            }),
        });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.insert as Mock).mockReturnValueOnce({ values: insertValues });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "iflyrec",
                    enabled: true,
                    authMode: "session-header",
                    baseUrl: "https://www.iflyrec.com",
                    config: {
                        bizId: "tjzs",
                    },
                    secrets: {
                        sessionId: "session-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://www.iflyrec.com/XFTJWebAdaptService/v2/hjProcess/recentOperationFiles",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "X-Biz-Id": "tjzs",
                    "X-Session-Id": "session-123",
                }),
                body: "{}",
            }),
        );
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "iflyrec",
                enabled: true,
                authMode: "session-header",
                baseUrl: "https://www.iflyrec.com",
                config: expect.objectContaining({
                    bizId: "tjzs",
                }),
                secretConfig: 'encrypted:{"sessionId":"session-123"}',
            }),
        );
    });

    it("rejects enabling iFLYTEK iflyrec without sign-in session details", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "iflyrec",
                    enabled: true,
                    authMode: "session-header",
                    config: {
                        bizId: "tjzs",
                    },
                    secrets: {},
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "请填写登录会话信息。",
        });
    });

    it("rejects saving iFLYTEK iflyrec when testConnection fails", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                invalid: true,
            }),
        });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "iflyrec",
                    enabled: true,
                    authMode: "session-header",
                    baseUrl: "https://www.iflyrec.com",
                    config: {
                        bizId: "tjzs",
                    },
                    secrets: {
                        sessionId: "session-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "未能连接数据源",
        });
    });

    it("validates DingTalk A1 agent-token connections before saving", async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { items: [] } }),
        });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.insert as Mock).mockReturnValueOnce({ values: insertValues });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "dingtalk-a1",
                    enabled: true,
                    authMode: "agent-token",
                    baseUrl: "https://meeting-ai-tingji.dingtalk.com",
                    config: {},
                    secrets: {
                        agentToken: "agent-token-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://meeting-ai-tingji.dingtalk.com/ai/tingji/getConversationList",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "dt-meeting-agent-token": "agent-token-123",
                }),
            }),
        );
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "dingtalk-a1",
                enabled: true,
                authMode: "agent-token",
                baseUrl: "https://meeting-ai-tingji.dingtalk.com",
                secretConfig: 'encrypted:{"agentToken":"agent-token-123"}',
            }),
        );
    });

    it("validates DingTalk A1 cookie connections before saving", async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { items: [] } }),
        });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.insert as Mock).mockReturnValueOnce({ values: insertValues });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "dingtalk-a1",
                    enabled: true,
                    authMode: "cookie",
                    baseUrl: "https://meeting-ai-tingji.dingtalk.com",
                    config: {},
                    secrets: {
                        cookie: "dt_cookie=abc123;",
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://meeting-ai-tingji.dingtalk.com/ai/tingji/getConversationList",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    Cookie: "dt_cookie=abc123;",
                }),
            }),
        );
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "dingtalk-a1",
                enabled: true,
                authMode: "cookie",
                secretConfig: 'encrypted:{"cookie":"dt_cookie=abc123;"}',
            }),
        );
    });

    it("rejects enabling DingTalk A1 without the active auth secret", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "dingtalk-a1",
                    enabled: true,
                    authMode: "agent-token",
                    config: {},
                    secrets: {},
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "请填写钉钉闪记登录信息。",
        });
    });

    it("rejects an unavailable DingTalk A1 sign-in choice with user-facing copy", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "dingtalk-a1",
                    enabled: true,
                    authMode: "temporary-code",
                    config: {},
                    secrets: {},
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "请选择可用的登录方式。",
        });
    });

    it("rejects saving DingTalk A1 when testConnection fails", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({}),
        });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "dingtalk-a1",
                    enabled: true,
                    authMode: "agent-token",
                    baseUrl: "https://meeting-ai-tingji.dingtalk.com",
                    config: {},
                    secrets: {
                        agentToken: "agent-token-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "未能连接数据源",
        });
    });

    it("rejects saving DingTalk A1 when the connection payload is structurally incomplete", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { total: 1 } }),
        });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "dingtalk-a1",
                    enabled: true,
                    authMode: "agent-token",
                    baseUrl: "https://meeting-ai-tingji.dingtalk.com",
                    config: {},
                    secrets: {
                        agentToken: "agent-token-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "未能连接数据源",
        });
    });

    it("saves DingTalk A1 when conversation access works but minutesDetailV2 evidence is still missing", async () => {
        const insertValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        items: [{ uuid: "dt-1" }],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({}),
            });

        global.fetch = fetchMock as typeof fetch;
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.insert as Mock).mockReturnValueOnce({ values: insertValues });

        const response = await PUT(
            new Request("http://localhost/api/data-sources", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider: "dingtalk-a1",
                    enabled: true,
                    authMode: "agent-token",
                    baseUrl: "https://meeting-ai-tingji.dingtalk.com",
                    config: {},
                    secrets: {
                        agentToken: "agent-token-123",
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                provider: "dingtalk-a1",
                enabled: true,
                authMode: "agent-token",
                secretConfig: 'encrypted:{"agentToken":"agent-token-123"}',
            }),
        );
    });
});
