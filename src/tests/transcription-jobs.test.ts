import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("@/lib/encryption", () => ({
    decrypt: vi.fn((value: string) => `decrypted:${value}`),
}));

vi.mock("@/lib/storage/factory", () => ({
    createUserStorageProvider: vi.fn().mockResolvedValue({
        downloadFile: vi.fn().mockResolvedValue(Buffer.from("audio-bytes")),
    }),
}));

vi.mock("@/lib/transcription/transcribe-recording", () => ({
    PRIVATE_TRANSCRIPTION_MODEL:
        "voice-transcribe:whisper-large-v3+pyannote-3.1",
    normalizeTranscriptionError: vi.fn((error: Error) => error.message),
    persistTranscriptionResult: vi.fn(),
    transcribeRecording: vi.fn(),
}));

vi.mock("@/lib/transcription/providers/voice-transcribe-provider", () => ({
    getVoiceTranscribeResult: vi.fn(),
    normalizeVoiceTranscribeJobError: vi.fn(
        (job: { error?: string }) => job.error || "remote failed",
    ),
    pollVoiceTranscribeJob: vi.fn().mockResolvedValue({
        status: "queued",
    }),
    submitVoiceTranscribeJob: vi.fn(),
}));

import { db } from "@/db";
import {
    enqueueTranscriptionJobs,
    hasTranscriptionCapability,
    processDueTranscriptionJobs,
    serializeTranscriptionJob,
} from "@/lib/transcription/jobs";
import {
    pollVoiceTranscribeJob,
    submitVoiceTranscribeJob,
} from "@/lib/transcription/providers/voice-transcribe-provider";
import { transcribeRecording } from "@/lib/transcription/transcribe-recording";

function mockOrderedSelect(value: unknown) {
    return {
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(value),
                }),
            }),
        }),
    };
}

function mockWhereLimitSelect(value: unknown) {
    return {
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(value),
            }),
        }),
    };
}

function mockWhereSelect(value: unknown) {
    return {
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(value),
        }),
    };
}

describe("transcription jobs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("serializes job dates for the API", () => {
        expect(
            serializeTranscriptionJob({
                id: "job-1",
                recordingId: "rec-1",
                status: "pending",
                force: false,
                provider: null,
                model: null,
                providerJobId: null,
                remoteStatus: null,
                attempts: 0,
                compressionWarning: null,
                lastError: null,
                requestedAt: new Date("2026-04-18T10:00:00.000Z"),
                startedAt: null,
                submittedAt: null,
                lastPolledAt: null,
                completedAt: null,
                nextPollAt: null,
                updatedAt: new Date("2026-04-18T10:00:00.000Z"),
                userId: "user-1",
            } as never),
        ).toMatchObject({
            id: "job-1",
            status: "pending",
            requestedAt: "2026-04-18T10:00:00.000Z",
        });
    });

    it("detects transcription capability from either private URL or stored credentials", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                privateTranscriptionBaseUrl:
                                    "http://transcribe.internal:8780",
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce(mockWhereSelect([]));

        await expect(hasTranscriptionCapability("user-1")).resolves.toBe(true);
    });

    it("does not treat title-generation credentials as transcription capability", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                privateTranscriptionBaseUrl: null,
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        id: "cred-title",
                        provider: "title-generation",
                        apiKey: "encrypted:title-key",
                        baseUrl: null,
                        defaultModel: null,
                        isDefaultTranscription: false,
                    },
                ]),
            );

        await expect(hasTranscriptionCapability("user-1")).resolves.toBe(false);
    });

    it("enqueues unique jobs and resets their state", async () => {
        const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
        const values = vi.fn().mockReturnValue({
            onConflictDoUpdate,
        });
        (db.insert as Mock).mockReturnValue({
            values,
        });

        const result = await enqueueTranscriptionJobs(
            "user-1",
            ["rec-1", "rec-1", "rec-2"],
            { force: true },
        );

        expect(result).toEqual({ queued: 2 });
        expect(values).toHaveBeenCalledTimes(2);
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
    });

    it("processes due fallback jobs and counts successes", async () => {
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn().mockReturnValue({
            where: updateWhere,
        });

        (db.update as Mock).mockReturnValue({
            set: updateSet,
        });

        (db.select as Mock)
            .mockReturnValueOnce(mockOrderedSelect([]))
            .mockReturnValueOnce(
                mockOrderedSelect([
                    {
                        id: "job-1",
                        userId: "user-1",
                        recordingId: "rec-1",
                        status: "pending",
                        force: false,
                        provider: null,
                        model: null,
                        providerJobId: null,
                        attempts: 0,
                        submittedAt: null,
                        startedAt: null,
                        nextPollAt: null,
                    },
                ]),
            )
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        userId: "user-1",
                        privateTranscriptionBaseUrl: null,
                        privateTranscriptionMaxInflightJobs: 1,
                    },
                ]),
            )
            .mockReturnValueOnce(mockWhereSelect([]))
            .mockReturnValueOnce(
                mockWhereLimitSelect([
                    {
                        privateTranscriptionBaseUrl: null,
                    },
                ]),
            )
            .mockReturnValueOnce(
                mockWhereLimitSelect([
                    {
                        provider: "openai",
                        model: "whisper-1",
                        providerJobId: null,
                    },
                ]),
            )
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        id: "job-1",
                        status: "succeeded",
                    },
                ]),
            );

        (transcribeRecording as unknown as Mock).mockResolvedValue({
            success: true,
            compressionWarning: null,
        });

        await expect(processDueTranscriptionJobs(5)).resolves.toEqual({
            processed: 1,
            succeeded: 1,
            failed: 0,
        });
        expect(transcribeRecording).toHaveBeenCalledWith("user-1", "rec-1", {
            force: false,
        });
    });

    it("prioritizes submitted private jobs before new pending jobs", async () => {
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn().mockReturnValue({
            where: updateWhere,
        });
        (db.update as Mock).mockReturnValue({
            set: updateSet,
        });

        (db.select as Mock)
            .mockReturnValueOnce(
                mockOrderedSelect([
                    {
                        id: "job-submitted",
                        userId: "user-1",
                        recordingId: "rec-submitted",
                        status: "submitted",
                        force: false,
                        provider: "voice-transcribe",
                        model: "voice-transcribe:whisper",
                        providerJobId: "job-remote-1",
                        remoteStatus: "queued",
                        attempts: 1,
                        submittedAt: new Date("2026-04-18T10:00:00.000Z"),
                        startedAt: new Date("2026-04-18T10:00:00.000Z"),
                        nextPollAt: new Date("2026-04-18T10:00:01.000Z"),
                    },
                ]),
            )
            .mockReturnValueOnce(
                mockWhereLimitSelect([
                    {
                        privateTranscriptionBaseUrl:
                            "http://transcribe.internal:8780",
                    },
                ]),
            )
            .mockReturnValueOnce(mockWhereSelect([]))
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        id: "job-submitted",
                        status: "submitted",
                    },
                ]),
            );

        await expect(processDueTranscriptionJobs(1)).resolves.toEqual({
            processed: 1,
            succeeded: 0,
            failed: 0,
        });
        expect(transcribeRecording).not.toHaveBeenCalled();
        expect(updateSet).toHaveBeenCalled();
    });

    it("requeues lost remote jobs instead of failing immediately", async () => {
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn().mockReturnValue({
            where: updateWhere,
        });
        (db.update as Mock).mockReturnValue({
            set: updateSet,
        });

        (db.select as Mock)
            .mockReturnValueOnce(
                mockOrderedSelect([
                    {
                        id: "job-submitted",
                        userId: "user-1",
                        recordingId: "rec-submitted",
                        status: "submitted",
                        force: false,
                        provider: "voice-transcribe",
                        model: "voice-transcribe:whisper",
                        providerJobId: "job-remote-1",
                        remoteStatus: "queued",
                        attempts: 1,
                        submittedAt: new Date("2026-04-18T10:00:00.000Z"),
                        startedAt: new Date("2026-04-18T10:00:00.000Z"),
                        nextPollAt: new Date("2026-04-18T10:00:01.000Z"),
                    },
                ]),
            )
            .mockReturnValueOnce(
                mockWhereLimitSelect([
                    {
                        privateTranscriptionBaseUrl:
                            "http://transcribe.internal:8780",
                    },
                ]),
            )
            .mockReturnValueOnce(mockWhereSelect([]))
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        id: "job-submitted",
                        status: "pending",
                    },
                ]),
            );

        (pollVoiceTranscribeJob as unknown as Mock).mockRejectedValueOnce(
            new Error(
                'Voice-transcribe job polling failed (404): {"detail":"Job not found"}',
            ),
        );

        await expect(processDueTranscriptionJobs(1)).resolves.toEqual({
            processed: 1,
            succeeded: 0,
            failed: 0,
        });
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "pending",
                providerJobId: null,
                remoteStatus: null,
                lastError: null,
            }),
        );
    });

    it("keeps extra pending private jobs local while another remote job is active", async () => {
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn().mockReturnValue({
            where: updateWhere,
        });
        (db.update as Mock).mockReturnValue({
            set: updateSet,
        });

        (db.select as Mock)
            .mockReturnValueOnce(mockOrderedSelect([]))
            .mockReturnValueOnce(
                mockOrderedSelect([
                    {
                        id: "job-pending",
                        userId: "user-1",
                        recordingId: "rec-pending",
                        status: "pending",
                        force: false,
                        provider: null,
                        model: null,
                        providerJobId: null,
                        remoteStatus: null,
                        attempts: 0,
                        submittedAt: null,
                        startedAt: null,
                        nextPollAt: null,
                    },
                ]),
            )
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        userId: "user-1",
                        privateTranscriptionBaseUrl:
                            "http://transcribe.internal:8780",
                        privateTranscriptionMaxInflightJobs: 1,
                    },
                ]),
            )
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        userId: "user-1",
                    },
                ]),
            );

        await expect(processDueTranscriptionJobs(5)).resolves.toEqual({
            processed: 0,
            succeeded: 0,
            failed: 0,
        });
        expect(submitVoiceTranscribeJob).not.toHaveBeenCalled();
        expect(updateSet).not.toHaveBeenCalled();
    });

    it("treats denoising as an in-progress remote status", async () => {
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn().mockReturnValue({
            where: updateWhere,
        });
        (db.update as Mock).mockReturnValue({
            set: updateSet,
        });

        (db.select as Mock)
            .mockReturnValueOnce(
                mockOrderedSelect([
                    {
                        id: "job-submitted",
                        userId: "user-1",
                        recordingId: "rec-submitted",
                        status: "submitted",
                        force: false,
                        provider: "voice-transcribe",
                        model: "voice-transcribe:whisper",
                        providerJobId: "job-remote-1",
                        remoteStatus: "queued",
                        attempts: 1,
                        submittedAt: new Date("2026-04-18T10:00:00.000Z"),
                        startedAt: new Date("2026-04-18T10:00:00.000Z"),
                        nextPollAt: new Date("2026-04-18T10:00:01.000Z"),
                    },
                ]),
            )
            .mockReturnValueOnce(
                mockWhereLimitSelect([
                    {
                        privateTranscriptionBaseUrl:
                            "http://transcribe.internal:8780",
                    },
                ]),
            )
            .mockReturnValueOnce(mockWhereSelect([]))
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        id: "job-submitted",
                        status: "processing",
                    },
                ]),
            );

        (pollVoiceTranscribeJob as unknown as Mock).mockResolvedValueOnce({
            status: "denoising",
        });

        await expect(processDueTranscriptionJobs(1)).resolves.toEqual({
            processed: 1,
            succeeded: 0,
            failed: 0,
        });
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "processing",
                remoteStatus: "denoising",
            }),
        );
    });
});
