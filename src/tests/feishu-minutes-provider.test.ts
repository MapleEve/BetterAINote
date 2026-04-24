import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeishuMinutesSourceClient } from "@/lib/data-sources/providers/feishu-minutes";
import type { ResolvedSourceConnection } from "@/lib/data-sources/types";

describe("FeishuMinutesSourceClient", () => {
    const originalFetch = global.fetch;

    const connection: ResolvedSourceConnection = {
        userId: "user-1",
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
        lastSync: null,
    };

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("uses the user access token when testing the connection", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ code: 0, data: { items: [] } }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new FeishuMinutesSourceClient(connection);
        await expect(client.testConnection()).resolves.toBe(true);

        expect(fetchMock).toHaveBeenCalledWith(
            "https://open.feishu.cn/open-apis/vc/v1/meetings/search?page_size=1",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer u-123",
                    Accept: "application/json",
                }),
            }),
        );
    });

    it("uses Feishu Minutes browser sign-in details only against the China web endpoint", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { list: [] } }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new FeishuMinutesSourceClient({
            ...connection,
            authMode: "web-reverse",
            baseUrl: "https://meetings.feishu.cn",
            config: {
                spaceName: "cn",
            },
            secrets: {
                webCookie: "minutes_csrf_token=csrf-value; session=redacted",
                webToken: "web-token-redacted",
            },
        });
        await expect(client.testConnection()).resolves.toBe(true);

        expect(fetchMock).toHaveBeenCalledWith(
            "https://meetings.feishu.cn/list?size=1&space_name=cn",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Cookie: "minutes_csrf_token=csrf-value; session=redacted",
                    "X-CSRFToken": "csrf-value",
                    "X-Feishu-Minutes-Token": "web-token-redacted",
                    Accept: "application/json",
                }),
            }),
        );
    });

    it("ignores caller-provided browser sign-in base URLs before sending browser credentials", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { list: [] } }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new FeishuMinutesSourceClient({
            ...connection,
            authMode: "web-reverse",
            baseUrl: "https://attacker.example",
            config: {
                spaceName: "cn",
            },
            secrets: {
                webCookie: "minutes_csrf_token=csrf-value; session=redacted",
                webToken: "web-token-redacted",
            },
        });
        await expect(client.testConnection()).resolves.toBe(true);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://meetings.feishu.cn/list?size=1&space_name=cn",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Cookie: "minutes_csrf_token=csrf-value; session=redacted",
                    "X-Feishu-Minutes-Token": "web-token-redacted",
                }),
            }),
        );
    });

    it("shows a user-facing message when browser sign-in cannot read recordings", async () => {
        const client = new FeishuMinutesSourceClient({
            ...connection,
            authMode: "web-reverse",
            baseUrl: "https://meetings.feishu.cn",
            config: {
                spaceName: "cn",
            },
            secrets: {
                webCookie: "minutes_csrf_token=csrf-value; session=redacted",
            },
        });

        await expect(client.listRecordings()).rejects.toThrow(
            "飞书妙记连接方式暂不可读取录音，请改用应用访问令牌。",
        );
    });

    it("treats malformed meeting-search payloads as not yet usable", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ code: 0, data: { total: 1 } }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new FeishuMinutesSourceClient(connection);
        await expect(client.testConnection()).resolves.toBe(false);
    });

    it("normalizes meetings, minutes artifacts, transcript, and media download", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    code: 0,
                    data: {
                        items: [{ id: "meeting-1" }],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    code: 0,
                    data: {
                        id: "meeting-1",
                        topic: "Weekly Review",
                        start_time: "2026-04-21T10:00:00Z",
                        update_time: "2026-04-21T11:00:00Z",
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    code: 0,
                    data: {
                        minute_url: "https://meetings.feishu.cn/minutes/min-1",
                        duration: 62,
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    code: 0,
                    data: {
                        title: "Weekly Review Notes",
                        create_time: "2026-04-21T10:00:00Z",
                        duration: 62,
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    code: 0,
                    data: {
                        summary: "  # Summary\n- Action item  ",
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                text: async () =>
                    "  SPEAKER_1 00:00 Hello\nSPEAKER_2 00:03 Follow up  ",
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    code: 0,
                    data: {
                        download_url: "https://cdn.feishu.cn/minutes/min-1.mp4",
                    },
                }),
            });
        global.fetch = fetchMock as typeof fetch;

        const client = new FeishuMinutesSourceClient(connection);
        const recordings = await client.listRecordings();

        expect(recordings).toHaveLength(1);
        expect(recordings[0]).toMatchObject({
            sourceProvider: "feishu-minutes",
            sourceRecordingId: "meeting-1",
            filename: "Weekly Review Notes",
            durationMs: 62000,
            version: "2026-04-21T11:00:00Z",
            audioDownload: {
                url: "https://cdn.feishu.cn/minutes/min-1.mp4",
                fileExtension: "mp4",
            },
            artifacts: {
                transcriptText:
                    "SPEAKER_1 00:00 Hello\nSPEAKER_2 00:03 Follow up",
                summaryMarkdown: "# Summary\n- Action item",
                detailPayload: expect.objectContaining({
                    minuteToken: "min-1",
                }),
            },
        });
    });
});
