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

import { GET as GETRecording } from "@/app/api/recordings/[id]/route";
import { GET as GETRawTranscript } from "@/app/api/recordings/[id]/transcript/raw/route";
import { GET as GETSpeakerTranscript } from "@/app/api/recordings/[id]/transcript/speakers/route";
import { GET as GETQuery } from "@/app/api/recordings/query/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";

vi.spyOn(console, "error").mockImplementation(() => undefined);

function makeRequest(url: string) {
    return new Request(url, { method: "GET" });
}

function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("Read-only transcript routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
    });

    it("returns transcript metrics and no-store headers for the raw transcript route", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                filename: "Call",
                                startTime: new Date("2026-04-18T10:00:00.000Z"),
                                sourceProvider: "ticnote",
                                sourceRecordingId: "source-rec-1",
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                text: "SPEAKER_01: Hello there",
                                detectedLanguage: "en",
                                transcriptionType: "private",
                                provider: "voice-transcribe",
                                model: "vt-1",
                                createdAt: new Date("2026-04-18T10:05:00.000Z"),
                                speakerMap: { SPEAKER_01: "Alex" },
                                providerPayload: {
                                    id: "remote-1",
                                    status: "completed",
                                    filename: null,
                                    createdAt: null,
                                    language: "en",
                                    speakerMap: {
                                        SPEAKER_01: {
                                            matchedId: "spk-1",
                                            matchedName: "Alex",
                                            similarity: 0.9,
                                            embeddingKey: "SPEAKER_01",
                                        },
                                    },
                                    uniqueSpeakers: ["SPEAKER_01"],
                                    params: {
                                        language: "en",
                                        denoiseModel: "none",
                                        snrThreshold: 10,
                                        voiceprintThreshold: 0.75,
                                        minSpeakers: 0,
                                        maxSpeakers: 0,
                                    },
                                    segments: [],
                                },
                            },
                        ]),
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

        const response = await GETRawTranscript(
            makeRequest("http://localhost/api/recordings/rec-1/transcript/raw"),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");

        const json = await response.json();
        expect(json.transcript.wordCount).toBe(3);
        expect(json.transcript.characterCount).toBe(23);
        expect(json.transcript.mappedSpeakerCount).toBe(1);
        expect(json.speakerMap).toEqual({ SPEAKER_01: "Alex" });
        expect(
            json.transcript.providerPayload.speakerMap.SPEAKER_01.matchedName,
        ).toBe("Alex");
    });

    it("returns speaker-applied transcript review data for the speaker transcript route", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                filename: "Call",
                                startTime: new Date("2026-04-18T10:00:00.000Z"),
                                sourceProvider: "ticnote",
                                sourceRecordingId: "source-rec-1",
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                text: "SPEAKER_01: Hello there",
                                detectedLanguage: "en",
                                transcriptionType: "private",
                                provider: "voice-transcribe",
                                model: "vt-1",
                                createdAt: new Date("2026-04-18T10:05:00.000Z"),
                                speakerMap: { SPEAKER_01: "Alex" },
                                providerPayload: {
                                    id: "remote-1",
                                    status: "completed",
                                    filename: null,
                                    createdAt: null,
                                    language: "en",
                                    speakerMap: {
                                        SPEAKER_01: {
                                            matchedId: "spk-1",
                                            matchedName: "Alex",
                                            similarity: 0.9,
                                            embeddingKey: "SPEAKER_01",
                                        },
                                    },
                                    uniqueSpeakers: ["SPEAKER_01"],
                                    params: {
                                        language: "en",
                                        denoiseModel: "none",
                                        snrThreshold: 10,
                                        voiceprintThreshold: 0.75,
                                        minSpeakers: 0,
                                        maxSpeakers: 0,
                                    },
                                    segments: [
                                        {
                                            id: 1,
                                            start: 0,
                                            end: 1.5,
                                            text: "Hello there",
                                            speakerLabel: "SPEAKER_01",
                                            speakerId: "spk-1",
                                            speakerName: "Alex",
                                            similarity: 0.9,
                                            hasOverlap: false,
                                            words: null,
                                        },
                                    ],
                                },
                            },
                        ]),
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

        const response = await GETSpeakerTranscript(
            makeRequest(
                "http://localhost/api/recordings/rec-1/transcript/speakers",
            ),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");

        const json = await response.json();
        expect(json.transcript.displayText).toBe("Alex: Hello there");
        expect(json.transcript.wordCount).toBe(3);
        expect(json.transcript.characterCount).toBe(23);
        expect(json.transcript.mappedSpeakerCount).toBe(1);
        expect(json.transcript.segments).toEqual([
            expect.objectContaining({
                speakerLabel: "SPEAKER_01",
                displaySpeaker: "Alex",
            }),
        ]);
    });

    it("rejects invalid date filters as a 400 instead of a server error", async () => {
        const response = await GETQuery(
            makeRequest(
                "http://localhost/api/recordings/query?from=not-a-date",
            ),
        );

        expect(response.status).toBe(400);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");

        const json = await response.json();
        expect(json.error).toBe("Invalid from");
    });

    it("returns inline transcript review data from the query route when requested", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([
                                {
                                    id: "rec-1",
                                    filename: "Call",
                                    startTime: new Date(
                                        "2026-04-18T10:00:00.000Z",
                                    ),
                                    duration: 120000,
                                    filesize: 1234,
                                    sourceProvider: "ticnote",
                                    sourceRecordingId: "source-rec-1",
                                    providerDeviceId: "device-1",
                                    upstreamDeleted: false,
                                    storagePath: "user-1/recordings/rec-1.mp3",
                                },
                            ]),
                        }),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            recordingId: "rec-1",
                            text: "SPEAKER_01: Hello there",
                            detectedLanguage: "en",
                            transcriptionType: "private",
                            provider: "voice-transcribe",
                            model: "vt-1",
                            createdAt: new Date("2026-04-18T10:05:00.000Z"),
                            speakerMap: { SPEAKER_01: "Alex" },
                            providerPayload: null,
                        },
                    ]),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([
                        {
                            recordingId: "rec-1",
                            status: "completed",
                            remoteStatus: "completed",
                            lastError: null,
                            updatedAt: new Date("2026-04-18T10:06:00.000Z"),
                        },
                    ]),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    innerJoin: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([]),
                    }),
                }),
            });

        const response = await GETQuery(
            makeRequest(
                "http://localhost/api/recordings/query?includeTranscript=1",
            ),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");

        const json = await response.json();
        expect(json.recordings).toHaveLength(1);
        expect(json.recordings[0].rawTranscriptUrl).toBe(
            "/api/recordings/rec-1/transcript/raw",
        );
        expect(json.recordings[0].speakerTranscriptUrl).toBe(
            "/api/recordings/rec-1/transcript/speakers",
        );
        expect(json.recordings[0].transcript.wordCount).toBe(3);
        expect(json.recordings[0].transcript.characterCount).toBe(23);
        expect(json.recordings[0].transcript.mappedSpeakerCount).toBe(1);
        expect(json.recordings[0].transcript.displayText).toBe(
            "Alex: Hello there",
        );
        expect(json.recordings[0].transcriptionJob).toEqual({
            status: "completed",
            remoteStatus: "completed",
            lastError: null,
            updatedAt: "2026-04-18T10:06:00.000Z",
        });
    });

    it("returns the recording detail read contract with recording and transcription", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                userId: "user-1",
                                sourceProvider: "ticnote",
                                sourceRecordingId: "source-rec-1",
                                sourceVersion: null,
                                sourceMetadata: null,
                                providerDeviceId: "device-1",
                                filename: "Call",
                                duration: 120000,
                                startTime: new Date("2026-04-18T10:00:00.000Z"),
                                endTime: new Date("2026-04-18T10:02:00.000Z"),
                                filesize: 1234,
                                fileMd5: "abc",
                                storageType: "local",
                                storagePath: "user-1/recordings/rec-1.mp3",
                                downloadedAt: null,
                                upstreamTrashed: false,
                                upstreamDeleted: false,
                                createdAt: new Date("2026-04-18T10:00:00.000Z"),
                                updatedAt: new Date("2026-04-18T10:00:00.000Z"),
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "tx-1",
                                recordingId: "rec-1",
                                userId: "user-1",
                                text: "hello",
                                detectedLanguage: "en",
                                transcriptionType: "private",
                                provider: "voice-transcribe",
                                model: "vt-1",
                                providerJobId: null,
                                speakerMap: { SPEAKER_01: "Alex" },
                                providerPayload: null,
                                createdAt: new Date("2026-04-18T10:05:00.000Z"),
                            },
                        ]),
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

        const response = await GETRecording(
            makeRequest("http://localhost/api/recordings/rec-1"),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(200);

        const json = await response.json();
        expect(json.recording.id).toBe("rec-1");
        expect(json.recording.startTime).toBe("2026-04-18T10:00:00.000Z");
        expect(json.transcription).toEqual({
            id: "tx-1",
            recordingId: "rec-1",
            userId: "user-1",
            text: "hello",
            detectedLanguage: "en",
            transcriptionType: "private",
            provider: "voice-transcribe",
            model: "vt-1",
            providerJobId: null,
            speakerMap: { SPEAKER_01: "Alex" },
            providerPayload: null,
            createdAt: "2026-04-18T10:05:00.000Z",
        });
        expect(json.enhancement).toBeNull();
    });

    it("returns 404 from the recording detail route when the recording is not owned by the user", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        const response = await GETRecording(
            makeRequest("http://localhost/api/recordings/missing"),
            makeParams("missing"),
        );

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "Recording not found",
        });
    });

    it("redacts raw transcription failure details from transcript review responses", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                filename: "Call",
                                startTime: new Date("2026-04-18T10:00:00.000Z"),
                                sourceProvider: "ticnote",
                                sourceRecordingId: "source-rec-1",
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                status: "failed",
                                remoteStatus: "failed",
                                lastError:
                                    "Remote queue lost the transcription job after 3 submission attempts",
                                updatedAt: new Date("2026-04-18T10:06:00.000Z"),
                            },
                        ]),
                    }),
                }),
            });

        const response = await GETRawTranscript(
            makeRequest("http://localhost/api/recordings/rec-1/transcript/raw"),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(409);
        const json = await response.json();
        expect(json.error).toBe(
            "Transcription failed. Check server logs for details.",
        );
        expect(json.job).toEqual({
            status: "failed",
            remoteStatus: "failed",
            lastError: "Transcription failed. Check server logs for details.",
            updatedAt: "2026-04-18T10:06:00.000Z",
        });
    });
});
