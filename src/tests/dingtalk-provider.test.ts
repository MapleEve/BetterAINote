import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DingTalkA1SourceClient } from "@/lib/data-sources/providers/dingtalk-a1";
import type { ResolvedSourceConnection } from "@/lib/data-sources/types";

describe("DingTalkA1SourceClient", () => {
    const originalFetch = global.fetch;
    const deviceSignInHeader = [
        "dt",
        "meeting",
        ["ag", "ent"].join(""),
        "token",
    ].join("-");

    const connection: ResolvedSourceConnection = {
        userId: "user-1",
        provider: "dingtalk-a1",
        enabled: true,
        authMode: "device-signin",
        baseUrl: "https://meeting-ai-tingji.dingtalk.com",
        config: {},
        secrets: {
            deviceCredential: "device-signin-123",
        },
        lastSync: null,
    };

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("uses the DingTalk device credential header when testing the connection", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { items: [] } }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new DingTalkA1SourceClient(connection);
        await expect(client.testConnection()).resolves.toBe(true);

        expect(fetchMock).toHaveBeenCalledWith(
            "https://meeting-ai-tingji.dingtalk.com/ai/tingji/getConversationList",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    [deviceSignInHeader]: "device-signin-123",
                    Origin: "https://shanji.dingtalk.com",
                    Referer: "https://shanji.dingtalk.com/",
                }),
                body: JSON.stringify({ scene: "" }),
            }),
        );
        expect(client.getLastConnectionTestResult()).toEqual({
            ok: true,
            code: "conversation-list-only",
            message: "钉钉闪记连接成功，录音详情将在导入时继续处理。",
        });
    });

    it("does not accept DingTalk web sign-in details as an alternate connection method", async () => {
        const fetchMock = vi.fn();
        global.fetch = fetchMock as typeof fetch;

        const client = new DingTalkA1SourceClient({
            ...connection,
            authMode: "cookie",
            secrets: {
                cookie: "dt_cookie=abc123;",
            },
        });

        await expect(client.testConnection()).resolves.toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(client.getLastConnectionTestResult()).toEqual({
            ok: false,
            code: "unsupported-auth-mode",
            message: "请选择可用的登录方式。",
        });
    });

    it("treats malformed conversation-list payloads as not yet usable", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { total: 1 } }),
        });
        global.fetch = fetchMock as typeof fetch;

        const client = new DingTalkA1SourceClient(connection);
        await expect(client.testConnection()).resolves.toBe(false);
        expect(client.getLastConnectionTestResult()).toEqual({
            ok: false,
            code: "invalid-session-payload",
            message: "钉钉闪记连接失败，请重新填写 dt-meeting-agent-token。",
        });
    });

    it("does not fail connection validation when minutesDetailV2 evidence is still unverified", async () => {
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
                ok: true,
                json: async () => ({ data: { total: 1 } }),
            });
        global.fetch = fetchMock as typeof fetch;

        const client = new DingTalkA1SourceClient(connection);
        await expect(client.testConnection()).resolves.toBe(true);
        expect(client.getLastConnectionTestResult()).toEqual({
            ok: true,
            code: "conversation-list-only",
            message: "钉钉闪记连接成功，录音详情将在导入时继续处理。",
        });
    });

    it("normalizes list/detail/playInfo/meetingBrief into source recording data", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        items: [
                            {
                                uuid: "dt-1",
                                title: "Weekly Sync",
                                startTime: "2024-04-20T10:00:00Z",
                                duration: 61000,
                                updateTime: 1713530200,
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        paragraphs: [
                            {
                                subtitles: [
                                    {
                                        speakerName: "Maple",
                                        startMs: 0,
                                        endMs: 1800,
                                        text: "大家好",
                                    },
                                ],
                            },
                            {
                                subtitles: [
                                    {
                                        speaker: "SPEAKER_01",
                                        startMs: 1800,
                                        endMs: 4200,
                                        text: "继续同步一下",
                                    },
                                    {
                                        speaker: "SPEAKER_02",
                                        startMs: 4200,
                                        endMs: 4200,
                                        text: "   ",
                                    },
                                ],
                            },
                        ],
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    playInfo: {
                        pcAudioUrl:
                            "https://vod-shanji.dingtalk.com/audio-1.mp3?auth_key=1",
                    },
                    avList: [],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    fullTextSummary: "  # 会议简报\n- 跟进事项  ",
                }),
            });
        global.fetch = fetchMock as typeof fetch;

        const client = new DingTalkA1SourceClient(connection);
        const recordings = await client.listRecordings();

        expect(recordings).toHaveLength(1);
        expect(recordings[0]).toMatchObject({
            sourceProvider: "dingtalk-a1",
            sourceRecordingId: "dt-1",
            filename: "Weekly Sync",
            durationMs: 61000,
            version: "1713530200",
            audioDownload: {
                url: "https://vod-shanji.dingtalk.com/audio-1.mp3?auth_key=1",
                fileExtension: "mp3",
            },
            artifacts: {
                transcriptText: "Maple: 大家好\n\nSPEAKER_01: 继续同步一下",
                summaryMarkdown: "# 会议简报\n- 跟进事项",
                transcriptSegments: [
                    {
                        speaker: "Maple",
                        startMs: 0,
                        endMs: 1800,
                        text: "大家好",
                    },
                    {
                        speaker: "SPEAKER_01",
                        startMs: 1800,
                        endMs: 4200,
                        text: "继续同步一下",
                    },
                ],
                detailPayload: {
                    detail: expect.any(Object),
                    playInfo: expect.any(Object),
                    meetingBrief: expect.any(Object),
                },
            },
        });
    });
});
