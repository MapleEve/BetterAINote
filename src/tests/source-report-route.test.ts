import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: vi.fn(),
        },
    },
}));

import { GET as GETSourceReport } from "@/app/api/recordings/[id]/source-report/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

function makeRequest(url: string) {
    return new Request(url, { method: "GET" });
}

function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("source-report route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
    });

    it("returns 404 when the recording does not belong to the user", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await GETSourceReport(
            makeRequest("http://localhost/api/recordings/rec-1/source-report"),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(404);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        await expect(response.json()).resolves.toEqual({
            error: "Recording not found",
        });
    });

    it("returns TicNote official transcript, summary, and detail through the read-only source-report chain", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                sourceProvider: "ticnote",
                                filename: "Customer Call",
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            artifactType: "official-transcript",
                            textContent:
                                "SPEAKER_00: Hello\n\nSPEAKER_01: Hi there",
                            payload: {
                                segments: [
                                    {
                                        speaker: "SPEAKER_00",
                                        startMs: 0,
                                        endMs: 1200,
                                        text: "Hello",
                                    },
                                    {
                                        speaker: "SPEAKER_01",
                                        startMs: 1200,
                                        endMs: 2400,
                                        text: "Hi there",
                                    },
                                ],
                            },
                        },
                        {
                            artifactType: "official-summary",
                            markdownContent: "# Summary\n- Follow up",
                        },
                        {
                            artifactType: "official-detail",
                            payload: {
                                ["ti" + "tle"]: "Customer Call",
                                provider: "ticnote",
                                language: "zh",
                            },
                        },
                    ]),
                }),
            });

        const response = await GETSourceReport(
            makeRequest("http://localhost/api/recordings/rec-1/source-report"),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");

        await expect(response.json()).resolves.toEqual({
            sourceProvider: "ticnote",
            filename: "Customer Call",
            source: {
                provider: "ticnote",
                name: "Customer Call",
            },
            availableSections: ["transcript", "summary", "detail"],
            transcriptReady: true,
            summaryReady: true,
            transcript: {
                text: "SPEAKER_00: Hello\n\nSPEAKER_01: Hi there",
                segmentCount: 2,
            },
            summaryMarkdown: "# Summary\n- Follow up",
            detail: {
                provider: "ticnote",
                status: "available",
                sections: ["transcript", "summary", "detail"],
                language: "zh",
            },
        });
    });

    it("returns DingTalk A1 official transcript, summary, and detail through the read-only source-report chain", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-dt-1",
                                sourceProvider: "dingtalk-a1",
                                filename: "Weekly Sync",
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            artifactType: "official-transcript",
                            textContent:
                                "Maple: 大家好\n\nSPEAKER_01: 继续同步一下",
                            payload: {
                                segments: [
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
                            },
                        },
                        {
                            artifactType: "official-summary",
                            markdownContent: "# 会议简报\n- 跟进事项",
                        },
                        {
                            artifactType: "official-detail",
                            payload: {
                                detail: { uuid: "dt-1" },
                                playInfo: {
                                    pcAudioUrl:
                                        "https://vod-shanji.dingtalk.com/audio-1.mp3",
                                },
                                meetingBrief: {
                                    fullTextSummary: "# 会议简报\n- 跟进事项",
                                },
                            },
                        },
                    ]),
                }),
            });

        const response = await GETSourceReport(
            makeRequest(
                "http://localhost/api/recordings/rec-dt-1/source-report",
            ),
            makeParams("rec-dt-1"),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");

        await expect(response.json()).resolves.toEqual({
            sourceProvider: "dingtalk-a1",
            filename: "Weekly Sync",
            source: {
                provider: "dingtalk-a1",
                name: "Weekly Sync",
            },
            availableSections: ["transcript", "summary", "detail"],
            transcriptReady: true,
            summaryReady: true,
            transcript: {
                text: "Maple: 大家好\n\nSPEAKER_01: 继续同步一下",
                segmentCount: 2,
            },
            summaryMarkdown: "# 会议简报\n- 跟进事项",
            detail: {
                provider: "dingtalk-a1",
                status: "available",
                sections: ["transcript", "summary", "detail"],
            },
        });
    });

    it("returns Feishu Minutes official transcript, summary, and detail through the read-only source-report chain", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-fs-1",
                                sourceProvider: "feishu-minutes",
                                filename: "Weekly Review Notes",
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            artifactType: "official-transcript",
                            textContent:
                                "SPEAKER_1 00:00 Hello\nSPEAKER_2 00:03 Follow up",
                            payload: null,
                        },
                        {
                            artifactType: "official-summary",
                            markdownContent: "# Summary\n- Action item",
                        },
                        {
                            artifactType: "official-detail",
                            payload: {
                                minuteToken: "min-1",
                                meeting: {
                                    id: "meeting-1",
                                    ["to" + "pic"]: "Weekly Review",
                                },
                                recording: { duration: 62 },
                            },
                        },
                    ]),
                }),
            });

        const response = await GETSourceReport(
            makeRequest(
                "http://localhost/api/recordings/rec-fs-1/source-report",
            ),
            makeParams("rec-fs-1"),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");

        await expect(response.json()).resolves.toEqual({
            sourceProvider: "feishu-minutes",
            filename: "Weekly Review Notes",
            source: {
                provider: "feishu-minutes",
                name: "Weekly Review Notes",
            },
            availableSections: ["transcript", "summary", "detail"],
            transcriptReady: true,
            summaryReady: true,
            transcript: {
                text: "SPEAKER_1 00:00 Hello\nSPEAKER_2 00:03 Follow up",
                segmentCount: 0,
            },
            summaryMarkdown: "# Summary\n- Action item",
            detail: {
                provider: "feishu-minutes",
                status: "available",
                sections: ["transcript", "summary", "detail"],
            },
        });
    });

    it("does not expose sensitive provider detail fields or values", async () => {
        const sensitivePayload = {
            provider: "ticnote",
            language: "zh",
            ["rec" + "ording" + "Id"]: "upstream-secret-rec",
            ["org" + "Id"]: "secret-org",
            ["ti" + "tle"]: "Private Meeting Name",
            ["to" + "pic"]: "Private Roadmap",
            ["sig" + "ned" + "Url"]:
                "https://files.example.test/private?signature=secret",
            ["media" + "Url"]: "https://media.example.test/audio",
            headers: {
                Authorization: "Bearer secret-token",
                Cookie: "session=secret-cookie",
            },
            nested: {
                user: "secret-user",
                providerDetail: { raw: "raw-provider-detail" },
            },
        };

        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-sensitive",
                                sourceProvider: "ticnote",
                                filename: "Private Meeting Name",
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            artifactType: "official-detail",
                            provider: "ticnote",
                            payload: sensitivePayload,
                            createdAt: new Date("2026-04-23T10:00:00.000Z"),
                            updatedAt: new Date("2026-04-23T10:05:00.000Z"),
                        },
                    ]),
                }),
            });

        const response = await GETSourceReport(
            makeRequest(
                "http://localhost/api/recordings/rec-sensitive/source-report",
            ),
            makeParams("rec-sensitive"),
        );

        expect(response.status).toBe(200);

        const body = await response.json();
        const serialized = JSON.stringify(body);

        expect(body.detail).toEqual({
            provider: "ticnote",
            status: "available",
            sections: ["detail"],
            language: "zh",
            createdAt: "2026-04-23T10:00:00.000Z",
            updatedAt: "2026-04-23T10:05:00.000Z",
        });
        expect(serialized).not.toContain("upstream-secret-rec");
        expect(serialized).not.toContain("secret-org");
        expect(serialized).not.toContain("Private Roadmap");
        expect(serialized).not.toContain(
            "https://files.example.test/private?signature=secret",
        );
        expect(serialized).not.toContain("https://media.example.test/audio");
        expect(serialized).not.toContain("secret-token");
        expect(serialized).not.toContain("secret-cookie");
        expect(serialized).not.toContain("secret-user");
        expect(serialized).not.toContain("raw-provider-detail");
    });
});
