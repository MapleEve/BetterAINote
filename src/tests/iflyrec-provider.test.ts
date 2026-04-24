import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IflyrecSourceClient } from "@/lib/data-sources/providers/iflyrec";
import type { ResolvedSourceConnection } from "@/lib/data-sources/types";

describe("IflyrecSourceClient", () => {
    const originalFetch = global.fetch;

    const connection: ResolvedSourceConnection = {
        userId: "user-1",
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
        lastSync: null,
    };

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("uses the session header and biz id when testing the connection", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ biz: { hjList: [] } }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new IflyrecSourceClient(connection);
        await expect(client.testConnection()).resolves.toBe(true);

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
    });

    it("treats malformed recent-order payloads as not yet usable", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ biz: { total: 1 } }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new IflyrecSourceClient(connection);
        await expect(client.testConnection()).resolves.toBe(false);
    });

    it("normalizes recent orders into recordings with transcript segments", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    biz: {
                        hjList: [
                            {
                                orderId: "order-1",
                                originAudioId: "audio-1",
                                orderName: "Weekly sync",
                                createTime: 1713530000,
                                audioDurations: 62000,
                                hjSize: 2048,
                                lastOperateTime: 1713530100,
                                fullTextAbstract: "  Summary text  ",
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    biz: {
                        transcriptResult: JSON.stringify({
                            ps: [
                                {
                                    pTime: [0, 1500],
                                    role: "SPEAKER_00",
                                    words: [{ text: "你好" }, { text: "世界" }],
                                },
                                {
                                    pTime: [1500, 3000],
                                    role: "SPEAKER_01",
                                    words: [{ text: "继续" }, { text: "说" }],
                                },
                                {
                                    pTime: [3000, 3000],
                                    role: "SPEAKER_02",
                                    words: [{ text: "   " }],
                                },
                            ],
                        }),
                    },
                }),
            });
        global.fetch = fetchMock as typeof fetch;

        const client = new IflyrecSourceClient(connection);
        const recordings = await client.listRecordings();

        expect(recordings).toHaveLength(1);
        expect(recordings[0]).toMatchObject({
            sourceProvider: "iflyrec",
            sourceRecordingId: "order-1",
            filename: "Weekly sync",
            durationMs: 62000,
            filesize: 2048,
            version: "1713530100",
            audioDownload: null,
            artifacts: {
                transcriptText: "SPEAKER_00: 你好世界\n\nSPEAKER_01: 继续说",
                summaryMarkdown: "Summary text",
                transcriptSegments: [
                    {
                        speaker: "SPEAKER_00",
                        startMs: 0,
                        endMs: 1500,
                        text: "你好世界",
                    },
                    {
                        speaker: "SPEAKER_01",
                        startMs: 1500,
                        endMs: 3000,
                        text: "继续说",
                    },
                ],
            },
        });
    });
});
