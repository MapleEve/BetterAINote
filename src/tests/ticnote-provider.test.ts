import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/encryption", () => ({
    decrypt: (value: string) => value.replace(/^encrypted:/, ""),
    encrypt: (value: string) => `encrypted:${value}`,
}));

import {
    resolveTicNoteConnectionConfig,
    TicNoteClient,
    TicNoteSourceClient,
    ticnoteProviderDefinition,
} from "@/lib/data-sources/providers/ticnote";
import type { ResolvedSourceConnection } from "@/lib/data-sources/types";
import { SourceProviderSettingsError } from "@/lib/data-sources/types";

describe("TicNoteSourceClient", () => {
    const originalFetch = global.fetch;

    const connection: ResolvedSourceConnection = {
        userId: "user-1",
        provider: "ticnote",
        enabled: true,
        authMode: "bearer",
        baseUrl: "https://voice-api.ticnote.cn",
        config: {
            orgId: "org_123",
            timezone: "Asia/Shanghai",
            language: "zh",
        },
        secrets: {
            bearerToken: "tic-token-123",
        },
        lastSync: null,
    };

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("uses TicNote bearer and org headers when testing the connection", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: [] }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new TicNoteSourceClient(connection);
        await expect(client.testConnection()).resolves.toBe(true);

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

    it("accepts the real TicNote chats payload when testing the connection", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ chats: [] }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new TicNoteSourceClient(connection);
        await expect(client.testConnection()).resolves.toBe(true);
    });

    it("does not duplicate /api when the TicNote base URL already points at the international API root", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: [] }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new TicNoteSourceClient({
            ...connection,
            baseUrl: "https://prd-backend-api.ticnote.com/api",
            config: {
                ...connection.config,
                region: "intl",
                language: "en",
            },
        });
        await expect(client.testConnection()).resolves.toBe(true);

        expect(fetchMock).toHaveBeenCalledWith(
            "https://prd-backend-api.ticnote.com/api/v2/file-index/chats",
            expect.any(Object),
        );
    });

    it("writes TicNote titles through the knowledge edit endpoint with only a title body", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                code: 200,
                data: {
                    path: "/sanitized/path",
                    absolutePath: "/sanitized/absolute/path",
                },
            }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new TicNoteClient({
            ...connection,
            baseUrl: "https://prd-backend-api.ticnote.com/api",
            config: {
                ...connection.config,
                region: "intl",
                language: "en",
            },
        });
        await client.updateTitle("remote-recording-1", "Synthetic title");

        expect(fetchMock).toHaveBeenCalledWith(
            "https://prd-backend-api.ticnote.com/api/v1/knowledge/edit/remote-recording-1",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    Authorization: "Bearer tic-token-123",
                    "X-Tic-Org-Id": "org_123",
                    "X-Tic-Lang": "en",
                    "X-Tic-Client-Info": "web",
                    Timezone: "Asia/Shanghai",
                }),
                body: JSON.stringify({ title: "Synthetic title" }),
            }),
        );
        expect(
            Object.keys(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body)),
        ).toEqual(["title"]);
    });

    it("treats malformed connection payloads as not yet usable", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new TicNoteSourceClient(connection);
        await expect(client.testConnection()).resolves.toBe(false);
    });

    it("keeps sanitized TicNote validation failure details for settings errors", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            text: async () =>
                JSON.stringify({
                    message: "token expired",
                    Authorization: "Bearer leaked-token",
                    cookie: "session=leaked-cookie",
                    orgId: "org_123",
                }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new TicNoteSourceClient(connection);
        await expect(client.testConnection()).resolves.toBe(false);

        const result = client.getLastConnectionTestResult();
        expect(result).toEqual({
            ok: false,
            code: "http-error",
            message: expect.stringContaining("HTTP 403"),
        });
        expect(result?.message).toContain("token expired");
        expect(result?.message).not.toContain("leaked-token");
        expect(result?.message).not.toContain("leaked-cookie");
        expect(result?.message).not.toContain("org_123");
        expect(result?.message).not.toContain("Authorization");
        expect(result?.message).not.toContain("cookie");
        expect(result?.message).not.toContain("orgId");
    });

    it("normalizes chats, detail payloads, transcript segments, summary, and audio download", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [
                        {
                            id: "chat-1",
                            name: "Recordings",
                            project_id: "project-1",
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [
                        {
                            id: "record-1",
                            fileId: "file-1",
                            name: "Call 1",
                            createTime: 1713530000,
                            updateTime: 1713530100,
                            subRemark: { duration: 61.2 },
                            voiceInfo: {
                                url: "https://cdn.ticnote.cn/audio/call-1.wav",
                            },
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        title: "Customer Call",
                        fileName: "Call 1",
                        createTime: 1713530000,
                        updateTime: 1713530200,
                        duration: 61.2,
                        fileSize: 2048,
                        summaryJson: JSON.stringify({
                            title: "Summary",
                            md2: "# Summary\n- Action item",
                        }),
                        transcribeJson: [
                            {
                                speaker: "SPEAKER_00",
                                start: 0,
                                end: 2.2,
                                text: "你好",
                            },
                            {
                                speaker: "SPEAKER_01",
                                start: 2.2,
                                end: 5.8,
                                text: "继续说",
                            },
                            {
                                speaker: "SPEAKER_02",
                                start: 5.8,
                                end: 5.8,
                                text: "   ",
                            },
                        ],
                        formatUrl: "https://cdn.ticnote.cn/audio/call-1.wav",
                    },
                }),
            });
        global.fetch = fetchMock as typeof fetch;

        const client = new TicNoteSourceClient(connection);
        const recordings = await client.listRecordings();

        expect(recordings).toHaveLength(1);
        expect(recordings[0]).toMatchObject({
            sourceProvider: "ticnote",
            sourceRecordingId: "record-1",
            filename: "Customer Call",
            durationMs: 61200,
            filesize: 2048,
            version: "1713530200",
            audioDownload: {
                url: "https://cdn.ticnote.cn/audio/call-1.wav",
                fileExtension: "wav",
            },
            artifacts: {
                transcriptText: "SPEAKER_00: 你好\n\nSPEAKER_01: 继续说",
                summaryMarkdown: "# Summary\n- Action item",
                transcriptSegments: [
                    {
                        speaker: "SPEAKER_00",
                        startMs: 0,
                        endMs: 2200,
                        text: "你好",
                    },
                    {
                        speaker: "SPEAKER_01",
                        startMs: 2200,
                        endMs: 5800,
                        text: "继续说",
                    },
                ],
            },
        });
    });

    it("normalizes recordings from the real TicNote chats and file-tree payload shape", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    chats: [
                        {
                            id: "chat-1",
                            name: "Recordings",
                            project_id: "project-1",
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    fileTree: [
                        {
                            id: "record-1",
                            fileId: "file-1",
                            name: "Call 1",
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    code: 0,
                    data: {
                        title: "Customer Call",
                        duration: 12,
                        transcribeJson: [],
                    },
                }),
            });
        global.fetch = fetchMock as typeof fetch;

        const client = new TicNoteSourceClient(connection);
        const recordings = await client.listRecordings();

        expect(recordings).toHaveLength(1);
        expect(recordings[0]).toMatchObject({
            sourceProvider: "ticnote",
            sourceRecordingId: "record-1",
            filename: "Customer Call",
            durationMs: 12000,
        });
    });

    it("uses TicNote recordTime as the recording start time when available", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    chats: [
                        {
                            id: "chat-1",
                            name: "Recordings",
                            project_id: "project-1",
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    fileTree: [
                        {
                            id: "record-1",
                            name: "Call 1",
                            createTime: 1777222343955,
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        title: "Customer Call",
                        duration: 12,
                        subRemark: {
                            recordTime: 1776697929129,
                        },
                        transcribeJson: [],
                    },
                }),
            });
        global.fetch = fetchMock as typeof fetch;

        const client = new TicNoteSourceClient(connection);
        const recordings = await client.listRecordings();

        expect(recordings[0]?.startTime.toISOString()).toBe(
            "2026-04-20T15:12:09.129Z",
        );
    });

    it("auto-detects a single TicNote org when saving an enabled connection without an org id", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    chats: [
                        {
                            id: "chat-fixture",
                            name: "Recordings",
                            organizationId: "org-fixture-single",
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ chats: [] }),
            });
        global.fetch = fetchMock as typeof fetch;

        const prepared =
            await ticnoteProviderDefinition.prepareConnectionWrite?.({
                userId: "user-fixture",
                existing: null,
                body: {
                    enabled: true,
                    config: {
                        region: "cn",
                        orgId: "",
                    },
                    secrets: {
                        bearerToken: "Bearer token-fixture",
                    },
                },
            });

        expect(prepared?.config).toMatchObject({
            orgId: "org-fixture-single",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty(
            "X-Tic-Org-Id",
        );
        expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
            "X-Tic-Org-Id": "org-fixture-single",
        });
    });

    it("auto-detects a single TicNote org through the international save-time endpoint", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    chats: [
                        {
                            id: "chat-fixture-intl",
                            organizationId: "org-fixture-intl",
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ chats: [] }),
            });
        global.fetch = fetchMock as typeof fetch;

        const prepared =
            await ticnoteProviderDefinition.prepareConnectionWrite?.({
                userId: "user-fixture",
                existing: null,
                body: {
                    enabled: true,
                    baseUrl: "https://voice-api.ticnote.cn",
                    config: {
                        region: "intl",
                        orgId: "",
                        language: "en",
                    },
                    secrets: {
                        bearerToken: "token-fixture",
                    },
                },
            });

        expect(prepared).toMatchObject({
            baseUrl: "https://prd-backend-api.ticnote.com/api",
            config: expect.objectContaining({
                region: "intl",
                orgId: "org-fixture-intl",
            }),
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            "https://prd-backend-api.ticnote.com/api/v2/file-index/chats",
        );
        expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty(
            "X-Tic-Org-Id",
        );
        expect(fetchMock.mock.calls[1]?.[0]).toBe(
            "https://prd-backend-api.ticnote.com/api/v2/file-index/chats",
        );
        expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
            "X-Tic-Org-Id": "org-fixture-intl",
            "X-Tic-Lang": "en",
        });
    });

    it("fails auto-detection when multiple TicNote org candidates are found without leaking them", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                chats: [
                    {
                        id: "chat-fixture-a",
                        organizationId: "org-fixture-a",
                    },
                    {
                        id: "chat-fixture-b",
                        organizationId: "org-fixture-b",
                    },
                ],
            }),
        });
        global.fetch = fetchMock as typeof fetch;

        let error: unknown;
        try {
            await ticnoteProviderDefinition.prepareConnectionWrite?.({
                userId: "user-fixture",
                existing: null,
                body: {
                    enabled: true,
                    config: {
                        region: "cn",
                        orgId: "",
                    },
                    secrets: {
                        bearerToken: "token-fixture",
                    },
                },
            });
        } catch (caught) {
            error = caught;
        }

        expect(error).toMatchObject({
            name: SourceProviderSettingsError.name,
            code: "multiple-org-candidates",
            message: expect.not.stringContaining("org-fixture-a"),
        });
        expect(error).toMatchObject({
            message: expect.not.stringContaining("org-fixture-b"),
        });
    });

    it("fails auto-detection when no TicNote org candidate is found", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                chats: [
                    {
                        id: "chat-fixture",
                        name: "Recordings",
                    },
                ],
            }),
        });
        global.fetch = fetchMock as typeof fetch;

        await expect(
            ticnoteProviderDefinition.prepareConnectionWrite?.({
                userId: "user-fixture",
                existing: null,
                body: {
                    enabled: true,
                    config: {
                        region: "cn",
                        orgId: "",
                    },
                    secrets: {
                        bearerToken: "token-fixture",
                    },
                },
            }),
        ).rejects.toMatchObject({
            code: "missing-org-candidates",
            message: expect.stringContaining("manual"),
        });
    });

    it("keeps a manually supplied TicNote org id and does not run auto-detection", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                chats: [
                    {
                        id: "chat-fixture",
                        organizationId: "org-fixture-other",
                    },
                ],
            }),
        });
        global.fetch = fetchMock as typeof fetch;

        const prepared =
            await ticnoteProviderDefinition.prepareConnectionWrite?.({
                userId: "user-fixture",
                existing: null,
                body: {
                    enabled: true,
                    config: {
                        region: "cn",
                        orgId: "org-fixture-manual",
                    },
                    secrets: {
                        bearerToken: "token-fixture",
                    },
                },
            });

        expect(prepared?.config).toMatchObject({
            orgId: "org-fixture-manual",
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
            "X-Tic-Org-Id": "org-fixture-manual",
        });
    });

    it("preserves normalized TicNote runtime config without carrying secrets", () => {
        expect(
            resolveTicNoteConnectionConfig("https://voice-api.ticnote.cn", {
                region: "cn",
                orgId: " org_fake_123 ",
                timezone: " Asia/Tokyo ",
                language: " en ",
                bearerToken: "tic-token-fake",
            }),
        ).toEqual({
            region: "cn",
            orgId: "org_fake_123",
            timezone: "Asia/Tokyo",
            language: "en",
            syncTitleToSource: false,
        });
    });
});
