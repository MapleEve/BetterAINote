import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { recordings } from "@/db/schema/library";
import { sourceArtifacts } from "@/db/schema/transcripts";

const { uploadFileMock, downloadSourceAudioBufferMock } = vi.hoisted(() => ({
    uploadFileMock: vi.fn().mockResolvedValue(undefined),
    downloadSourceAudioBufferMock: vi
        .fn()
        .mockResolvedValue(Buffer.from("audio")),
}));

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("@/lib/data-sources", () => ({
    getEnabledSourceConnectionsForUser: vi.fn(),
    createSourceProviderClient: vi.fn(),
    sourceConnectionSupportsWorkerSync: vi.fn(
        (connection: { provider: string; authMode?: string | null }) =>
            !(
                connection.provider === "feishu-minutes" &&
                connection.authMode === "web-reverse"
            ),
    ),
    canRecordingUsePrivateTranscribe: vi.fn(
        ({
            sourceProvider,
            hasAudio,
        }: {
            sourceProvider: string | null | undefined;
            hasAudio: boolean;
        }) => sourceProvider !== "iflyrec" && hasAudio,
    ),
}));

vi.mock("@/lib/storage/factory", () => ({
    createUserStorageProvider: vi.fn().mockResolvedValue({
        uploadFile: uploadFileMock,
    }),
}));

vi.mock("@/lib/transcription/jobs", () => ({
    enqueueTranscriptionJobs: vi.fn().mockResolvedValue({ queued: 0 }),
}));

vi.mock("@/lib/data-sources/utils", async () => {
    const actual = await vi.importActual<
        typeof import("@/lib/data-sources/utils")
    >("@/lib/data-sources/utils");
    return {
        ...actual,
        downloadSourceAudioBuffer: downloadSourceAudioBufferMock,
    };
});

import { db } from "@/db";
import {
    createSourceProviderClient,
    getEnabledSourceConnectionsForUser,
} from "@/lib/data-sources";
import { syncRecordingsForUser } from "@/lib/sync/sync-recordings";
import { enqueueTranscriptionJobs } from "@/lib/transcription/jobs";

describe("Sync", () => {
    const mockUserId = "user-123";

    beforeEach(() => {
        vi.clearAllMocks();
        uploadFileMock.mockResolvedValue(undefined);
        downloadSourceAudioBufferMock.mockResolvedValue(Buffer.from("audio"));
        (db.select as Mock).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.update as Mock).mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (db.insert as Mock).mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: "rec-1" }]),
                onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            }),
        });
    });

    it("returns an error when no data source connection is configured", async () => {
        (db.select as Mock).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });
        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([]);

        const result = await syncRecordingsForUser(mockUserId);

        expect(result.errors).toContain("No data source connection found");
        expect(result.newRecordings).toBe(0);
    });

    it("does not run worker sync for Feishu Minutes browser sign-in connections", async () => {
        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            {
                provider: "feishu-minutes",
                authMode: "web-reverse",
                userId: mockUserId,
            },
        ]);

        const result = await syncRecordingsForUser(mockUserId);

        expect(createSourceProviderClient).not.toHaveBeenCalled();
        expect(result.errors).toContain("No sync-capable data source found");
        expect(result.newRecordings).toBe(0);
        expect(result.updatedRecordings).toBe(0);
    });

    it("skips already synced recordings with the same source version", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([{ autoTranscribe: false }]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                sourceVersion: "1000",
                                storagePath: "user-123/recordings/file.mp3",
                                duration: 60000,
                                startTime: new Date("2024-01-01T10:00:00Z"),
                                endTime: new Date("2024-01-01T10:01:00Z"),
                            },
                        ]),
                    }),
                }),
            });

        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            { provider: "ticnote", userId: mockUserId },
        ]);
        (createSourceProviderClient as Mock).mockReturnValue({
            listRecordings: vi.fn().mockResolvedValue([
                {
                    sourceProvider: "ticnote",
                    sourceRecordingId: "source-rec-1",
                    filename: "Recording 1.mp3",
                    durationMs: 60000,
                    startTime: new Date("2024-01-01T10:00:00Z"),
                    endTime: new Date("2024-01-01T10:01:00Z"),
                    version: "1000",
                    audioDownload: null,
                },
            ]),
        });

        const result = await syncRecordingsForUser(mockUserId);

        expect(result.newRecordings).toBe(0);
        expect(result.updatedRecordings).toBe(0);
    });

    it("updates same-version recordings when normalized source timing changes", async () => {
        const updateReturning = vi.fn().mockResolvedValue([]);
        const updateWhere = vi.fn().mockReturnValue({
            returning: updateReturning,
        });
        const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
        (db.update as Mock).mockReturnValue({ set: updateSet });
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([{ autoTranscribe: false }]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                sourceVersion: "1000",
                                storagePath: "",
                                duration: 60000,
                                startTime: new Date("2026-04-26T16:52:23Z"),
                                endTime: new Date("2026-04-26T16:53:23Z"),
                            },
                        ]),
                    }),
                }),
            });

        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            { provider: "ticnote", userId: mockUserId },
        ]);
        (createSourceProviderClient as Mock).mockReturnValue({
            listRecordings: vi.fn().mockResolvedValue([
                {
                    sourceProvider: "ticnote",
                    sourceRecordingId: "source-rec-1",
                    filename: "Recording 1.mp3",
                    durationMs: 60000,
                    startTime: new Date("2026-04-20T15:12:09Z"),
                    endTime: new Date("2026-04-20T15:13:09Z"),
                    version: "1000",
                    audioDownload: null,
                },
            ]),
        });

        const result = await syncRecordingsForUser(mockUserId);

        expect(result.newRecordings).toBe(0);
        expect(result.updatedRecordings).toBe(1);
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({
                startTime: new Date("2026-04-20T15:12:09Z"),
                endTime: new Date("2026-04-20T15:13:09Z"),
            }),
        );
    });

    it("updates recordings with a newer source version", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([{ autoTranscribe: false }]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                sourceVersion: "500",
                                storagePath: "user-123/recordings/file.mp3",
                            },
                        ]),
                    }),
                }),
            });

        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            { provider: "ticnote", userId: mockUserId },
        ]);
        (createSourceProviderClient as Mock).mockReturnValue({
            listRecordings: vi.fn().mockResolvedValue([
                {
                    sourceProvider: "ticnote",
                    sourceRecordingId: "source-rec-1",
                    filename: "Recording 1.mp3",
                    durationMs: 60000,
                    startTime: new Date("2024-01-01T10:00:00Z"),
                    endTime: new Date("2024-01-01T10:01:00Z"),
                    version: "2000",
                    audioDownload: null,
                },
            ]),
        });

        const result = await syncRecordingsForUser(mockUserId);

        expect(result.newRecordings).toBe(0);
        expect(result.updatedRecordings).toBe(1);
    });

    it("returns an error when provider sync fails", async () => {
        (db.select as Mock).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi
                        .fn()
                        .mockResolvedValue([{ autoTranscribe: false }]),
                }),
            }),
        });
        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            { provider: "ticnote", userId: mockUserId },
        ]);
        (createSourceProviderClient as Mock).mockReturnValue({
            listRecordings: vi
                .fn()
                .mockRejectedValue(new Error("Connection failed")),
        });

        const result = await syncRecordingsForUser(mockUserId);

        expect(result.errors).toEqual(["导入失败，请稍后重试"]);
    });

    it("persists TicNote recordings, source artifacts, and downloaded audio", async () => {
        const recordingValues = vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "rec-tic-1" }]),
        });
        const artifactValues = vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        });

        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([{ autoTranscribe: false }]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            });

        (db.insert as Mock).mockImplementation((table) => {
            if (table === recordings) {
                return { values: recordingValues };
            }

            if (table === sourceArtifacts) {
                return { values: artifactValues };
            }

            return {
                values: vi.fn().mockResolvedValue(undefined),
            };
        });

        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            {
                provider: "ticnote",
                userId: mockUserId,
                enabled: true,
                authMode: "bearer",
            },
        ]);
        (createSourceProviderClient as Mock).mockReturnValue({
            listRecordings: vi.fn().mockResolvedValue([
                {
                    sourceProvider: "ticnote",
                    sourceRecordingId: "tic-1",
                    filename: "Call 1.wav",
                    durationMs: 61000,
                    startTime: new Date("2024-01-01T10:00:00Z"),
                    endTime: new Date("2024-01-01T10:01:01Z"),
                    version: "1713530200",
                    filesize: 2048,
                    metadata: { title: "Call 1" },
                    audioDownload: {
                        url: "https://cdn.ticnote.cn/audio/call-1.wav",
                        headers: {
                            Authorization: "Bearer tic-temp-token",
                        },
                        fileExtension: "wav",
                    },
                    artifacts: {
                        transcriptText: "SPEAKER_00: 你好",
                        transcriptSegments: [
                            {
                                speaker: "SPEAKER_00",
                                startMs: 0,
                                endMs: 2200,
                                text: "你好",
                            },
                        ],
                        summaryMarkdown: "# Summary",
                        detailPayload: { title: "Call 1", provider: "ticnote" },
                    },
                },
            ]),
        });

        const result = await syncRecordingsForUser(mockUserId);

        expect(result.errors).toEqual([]);
        expect(result.newRecordings).toBe(1);
        expect(downloadSourceAudioBufferMock).toHaveBeenCalledWith(
            "ticnote",
            expect.objectContaining({
                url: "https://cdn.ticnote.cn/audio/call-1.wav",
                headers: {
                    Authorization: "Bearer tic-temp-token",
                },
                archiveBaseName: "Call 1",
                fileExtension: "wav",
                contentType: "audio/wav",
            }),
        );
        expect(uploadFileMock).toHaveBeenCalledWith(
            expect.stringMatching(/\/ticnote\/Call 1\.wav$/),
            expect.any(Buffer),
            "audio/wav",
        );
        expect(recordingValues).toHaveBeenCalledWith(
            expect.objectContaining({
                sourceProvider: "ticnote",
                sourceRecordingId: "tic-1",
                filename: "Call 1.wav",
                storagePath: expect.stringContaining("/ticnote/"),
                sourceVersion: "1713530200",
                sourceMetadata: { title: "Call 1" },
            }),
        );
        expect(artifactValues).toHaveBeenCalledTimes(3);
        expect(
            artifactValues.mock.calls.map(([row]) => row.artifactType).sort(),
        ).toEqual([
            "official-detail",
            "official-summary",
            "official-transcript",
        ]);
    });

    it("persists DingTalk A1 recordings, source artifacts, and downloaded audio", async () => {
        const recordingValues = vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "rec-dt-1" }]),
        });
        const artifactValues = vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        });

        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([{ autoTranscribe: false }]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            });

        (db.insert as Mock).mockImplementation((table) => {
            if (table === recordings) {
                return { values: recordingValues };
            }

            if (table === sourceArtifacts) {
                return { values: artifactValues };
            }

            return {
                values: vi.fn().mockResolvedValue(undefined),
            };
        });

        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            {
                provider: "dingtalk-a1",
                userId: mockUserId,
                enabled: true,
                authMode: "device-signin",
            },
        ]);
        (createSourceProviderClient as Mock).mockReturnValue({
            listRecordings: vi.fn().mockResolvedValue([
                {
                    sourceProvider: "dingtalk-a1",
                    sourceRecordingId: "dt-1",
                    filename: "Weekly Sync.mp3",
                    durationMs: 61000,
                    startTime: new Date("2024-01-01T10:00:00Z"),
                    endTime: new Date("2024-01-01T10:01:01Z"),
                    version: "1713530200",
                    filesize: 4096,
                    metadata: { title: "Weekly Sync" },
                    audioDownload: {
                        url: "https://vod-shanji.dingtalk.com/audio-1.mp3?auth_key=1",
                        fileExtension: "mp3",
                    },
                    artifacts: {
                        transcriptText: "Maple: 大家好",
                        transcriptSegments: [
                            {
                                speaker: "Maple",
                                startMs: 0,
                                endMs: 1800,
                                text: "大家好",
                            },
                        ],
                        summaryMarkdown: "# 会议简报",
                        detailPayload: {
                            detail: { uuid: "dt-1" },
                            playInfo: {
                                pcAudioUrl:
                                    "https://vod-shanji.dingtalk.com/audio-1.mp3?auth_key=1",
                            },
                            meetingBrief: { fullTextSummary: "# 会议简报" },
                        },
                    },
                },
            ]),
        });

        const result = await syncRecordingsForUser(mockUserId);

        expect(result.errors).toEqual([]);
        expect(result.newRecordings).toBe(1);
        expect(downloadSourceAudioBufferMock).toHaveBeenCalledWith(
            "dingtalk-a1",
            expect.objectContaining({
                url: "https://vod-shanji.dingtalk.com/audio-1.mp3?auth_key=1",
                headers: undefined,
                archiveBaseName: "Weekly Sync",
                fileExtension: "mp3",
                contentType: "audio/mpeg",
            }),
        );
        expect(uploadFileMock).toHaveBeenCalledWith(
            expect.stringContaining("/dingtalk-a1/"),
            expect.any(Buffer),
            "audio/mpeg",
        );
        expect(recordingValues).toHaveBeenCalledWith(
            expect.objectContaining({
                sourceProvider: "dingtalk-a1",
                sourceRecordingId: "dt-1",
                filename: "Weekly Sync.mp3",
                storagePath: expect.stringContaining("/dingtalk-a1/"),
                sourceVersion: "1713530200",
                sourceMetadata: { title: "Weekly Sync" },
            }),
        );
        expect(artifactValues).toHaveBeenCalledTimes(3);
        expect(
            artifactValues.mock.calls.map(([row]) => row.artifactType).sort(),
        ).toEqual([
            "official-detail",
            "official-summary",
            "official-transcript",
        ]);
    });

    it("surfaces audio download failures without leaking query tokens", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([{ autoTranscribe: false }]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            });

        downloadSourceAudioBufferMock.mockRejectedValueOnce(
            new Error(
                "[dingtalk-a1] Failed to download source audio from https://vod-shanji.dingtalk.com/audio-1.mp3 (403 Forbidden)",
            ),
        );
        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            {
                provider: "dingtalk-a1",
                userId: mockUserId,
                enabled: true,
                authMode: "device-signin",
            },
        ]);
        (createSourceProviderClient as Mock).mockReturnValue({
            listRecordings: vi.fn().mockResolvedValue([
                {
                    sourceProvider: "dingtalk-a1",
                    sourceRecordingId: "dt-err-1",
                    filename: "Weekly Sync.mp3",
                    durationMs: 61000,
                    startTime: new Date("2024-01-01T10:00:00Z"),
                    endTime: new Date("2024-01-01T10:01:01Z"),
                    version: "1713530200",
                    audioDownload: {
                        url: "https://vod-shanji.dingtalk.com/audio-1.mp3?auth_key=secret-token",
                        fileExtension: "mp3",
                    },
                    artifacts: null,
                },
            ]),
        });

        const result = await syncRecordingsForUser(mockUserId);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe("导入失败，请稍后重试");
        expect(result.errors[0]).not.toContain("Weekly Sync.mp3");
        expect(result.errors[0]).not.toContain(
            "https://vod-shanji.dingtalk.com",
        );
        expect(result.errors[0]).not.toContain("auth_key=secret-token");
    });

    it("persists legacy Plaud timing metadata inside sourceMetadata instead of top-level recording columns", async () => {
        const recordingValues = vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "rec-plaud-1" }]),
        });

        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([{ autoTranscribe: false }]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            });

        (db.insert as Mock).mockImplementation((table) => {
            if (table === recordings) {
                return { values: recordingValues };
            }

            if (table === sourceArtifacts) {
                return {
                    values: vi.fn().mockReturnValue({
                        onConflictDoUpdate: vi
                            .fn()
                            .mockResolvedValue(undefined),
                    }),
                };
            }

            return {
                values: vi.fn().mockResolvedValue(undefined),
            };
        });

        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            {
                provider: "plaud",
                userId: mockUserId,
                enabled: true,
                authMode: "bearer",
            },
        ]);
        (createSourceProviderClient as Mock).mockReturnValue({
            listRecordings: vi.fn().mockResolvedValue([
                {
                    sourceProvider: "plaud",
                    sourceRecordingId: "plaud-1",
                    filename: "Plaud 1.mp3",
                    durationMs: 45000,
                    startTime: new Date("2024-01-01T10:00:00Z"),
                    endTime: new Date("2024-01-01T10:00:45Z"),
                    version: "1713530200",
                    filesize: 1024,
                    providerDeviceId: "SN-1",
                    metadata: {
                        timezone: 8,
                        zonemins: 480,
                        scene: 1,
                        plaud: { id: "plaud-1" },
                    },
                    audioDownload: null,
                    artifacts: null,
                },
            ]),
        });

        const result = await syncRecordingsForUser(mockUserId);

        expect(result.errors).toEqual([]);
        expect(result.newRecordings).toBe(1);
        expect(recordingValues).toHaveBeenCalledWith(
            expect.objectContaining({
                sourceProvider: "plaud",
                sourceRecordingId: "plaud-1",
                sourceMetadata: {
                    timezone: 8,
                    zonemins: 480,
                    scene: 1,
                    plaud: { id: "plaud-1" },
                },
            }),
        );
        expect(recordingValues.mock.calls[0]?.[0]).not.toHaveProperty(
            "timezone",
        );
        expect(recordingValues.mock.calls[0]?.[0]).not.toHaveProperty(
            "zonemins",
        );
        expect(recordingValues.mock.calls[0]?.[0]).not.toHaveProperty("scene");
    });

    it("does not auto-enqueue transcription for providers without private transcription capability", async () => {
        const recordingValues = vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "rec-ifly-1" }]),
        });
        const artifactValues = vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        });

        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([{ autoTranscribe: true }]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            });

        (db.insert as Mock).mockImplementation((table) => {
            if (table === recordings) {
                return { values: recordingValues };
            }

            if (table === sourceArtifacts) {
                return { values: artifactValues };
            }

            return {
                values: vi.fn().mockResolvedValue(undefined),
            };
        });

        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            {
                provider: "iflyrec",
                userId: mockUserId,
                enabled: true,
                authMode: "session-header",
            },
        ]);
        (createSourceProviderClient as Mock).mockReturnValue({
            listRecordings: vi.fn().mockResolvedValue([
                {
                    sourceProvider: "iflyrec",
                    sourceRecordingId: "ifly-1",
                    filename: "Iflyrec Note.txt",
                    durationMs: 30000,
                    startTime: new Date("2024-01-01T10:00:00Z"),
                    endTime: new Date("2024-01-01T10:00:30Z"),
                    version: "1713530200",
                    filesize: 1024,
                    metadata: { title: "Iflyrec Note" },
                    audioDownload: null,
                    artifacts: {
                        transcriptText: "Speaker 1: Hello",
                        transcriptSegments: [
                            {
                                speaker: "Speaker 1",
                                startMs: 0,
                                endMs: 1200,
                                text: "Hello",
                            },
                        ],
                    },
                },
            ]),
        });

        const result = await syncRecordingsForUser(mockUserId);

        expect(result.errors).toEqual([]);
        expect(result.newRecordings).toBe(1);
        expect(result.pendingTranscriptionIds).toEqual([]);
        expect(enqueueTranscriptionJobs).not.toHaveBeenCalled();
        expect(downloadSourceAudioBufferMock).not.toHaveBeenCalled();
        expect(uploadFileMock).not.toHaveBeenCalled();
    });
});
