import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("@/lib/env", () => ({
    env: {
        ENCRYPTION_KEY:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
}));

vi.mock("@/lib/storage/factory", () => ({
    createUserStorageProvider: vi.fn().mockResolvedValue({
        downloadFile: vi.fn().mockResolvedValue(Buffer.from("audio-data")),
    }),
}));

vi.mock("@/lib/encryption", () => ({
    decrypt: vi.fn((value: string) => `decrypted:${value}`),
}));

vi.mock("openai", () => {
    const MockOpenAI = vi.fn(function MockOpenAI() {
        return {
            audio: {
                transcriptions: {
                    create: vi.fn().mockRejectedValue(new Error("API Error")),
                },
            },
        };
    });
    const toFile = vi.fn(
        async (buffer: unknown, name: string, opts: unknown) =>
            new File([buffer as BlobPart], name, opts as FilePropertyBag),
    );
    return { OpenAI: MockOpenAI, toFile };
});

vi.mock("@/lib/transcription/providers", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/lib/transcription/providers")>();

    return {
        ...actual,
        createTranscriptionProvider: vi.fn(() => ({
            transcribe: vi.fn().mockRejectedValue(new Error("API Error")),
        })),
    };
});

import { db } from "@/db";
import { createTranscriptionProvider } from "@/lib/transcription/providers";
import {
    buildPrivateTranscriptionOptions,
    transcribeRecording,
} from "@/lib/transcription/transcribe-recording";

describe("Transcription", () => {
    const mockUserId = "user-123";
    const mockRecordingId = "rec-456";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("transcribeRecording", () => {
        it("builds full voscript request config from user settings", () => {
            expect(
                buildPrivateTranscriptionOptions({
                    settings: {
                        defaultTranscriptionLanguage: "en",
                        privateTranscriptionMinSpeakers: 1,
                        privateTranscriptionMaxSpeakers: 4,
                        privateTranscriptionDenoiseModel: "deepfilternet",
                        privateTranscriptionSnrThreshold: 9.5,
                        privateTranscriptionNoRepeatNgramSize: 4,
                    } as never,
                    model: "voice-transcribe:whisper-large-v3+pyannote-3.1",
                    audioPath: "/tmp/audio.wav",
                }),
            ).toEqual({
                language: "en",
                model: "voice-transcribe:whisper-large-v3+pyannote-3.1",
                minSpeakers: 1,
                maxSpeakers: 4,
                denoiseModel: "deepfilternet",
                snrThreshold: 9.5,
                noRepeatNgramSize: 4,
                audioPath: "/tmp/audio.wav",
            });
        });

        it("omits language when auto-detect is selected", () => {
            expect(
                buildPrivateTranscriptionOptions({
                    settings: {
                        defaultTranscriptionLanguage: null,
                        privateTranscriptionMinSpeakers: 0,
                        privateTranscriptionMaxSpeakers: 0,
                        privateTranscriptionDenoiseModel: "none",
                        privateTranscriptionSnrThreshold: null,
                        privateTranscriptionNoRepeatNgramSize: 0,
                    } as never,
                    model: "voice-transcribe:whisper-large-v3+pyannote-3.1",
                }),
            ).toMatchObject({
                language: undefined,
                model: "voice-transcribe:whisper-large-v3+pyannote-3.1",
                minSpeakers: undefined,
                maxSpeakers: undefined,
                noRepeatNgramSize: undefined,
            });
        });

        it("falls back to legacy shared diarization when dedicated voscript bounds are unset", () => {
            expect(
                buildPrivateTranscriptionOptions({
                    settings: {
                        defaultTranscriptionLanguage: "en",
                        speakerDiarization: true,
                        diarizationSpeakers: 3,
                        privateTranscriptionMinSpeakers: 0,
                        privateTranscriptionMaxSpeakers: 0,
                        privateTranscriptionDenoiseModel: "none",
                        privateTranscriptionSnrThreshold: null,
                        privateTranscriptionNoRepeatNgramSize: 0,
                    } as never,
                    model: "voice-transcribe:whisper-large-v3+pyannote-3.1",
                }),
            ).toMatchObject({
                minSpeakers: 3,
                maxSpeakers: 3,
            });
        });

        it("should return error when recording not found", async () => {
            (db.select as Mock).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            });

            const result = await transcribeRecording(
                mockUserId,
                mockRecordingId,
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe("Recording not found");
        });

        it("should return success when transcription already exists", async () => {
            (db.select as Mock)
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([
                                {
                                    id: mockRecordingId,
                                    filename: "test.mp3",
                                },
                            ]),
                        }),
                    }),
                })
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi
                                .fn()
                                .mockResolvedValue([
                                    { id: "trans-1", text: "Existing text" },
                                ]),
                        }),
                    }),
                });

            const result = await transcribeRecording(
                mockUserId,
                mockRecordingId,
            );

            expect(result.success).toBe(true);
        });

        it("should return error when no API credentials configured", async () => {
            (db.select as Mock)
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([
                                {
                                    id: mockRecordingId,
                                    filename: "test.mp3",
                                    storagePath: "test.mp3",
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

            const result = await transcribeRecording(
                mockUserId,
                mockRecordingId,
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe("No transcription API configured");
        });

        it("uses the VoScript credential stored in api_credentials", async () => {
            (db.select as Mock)
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([
                                {
                                    id: mockRecordingId,
                                    filename: "test.mp3",
                                    storagePath: "test.mp3",
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
                                    id: "settings-1",
                                    privateTranscriptionBaseUrl:
                                        "http://transcribe.internal:8780",
                                    defaultTranscriptionLanguage: null,
                                    speakerDiarization: false,
                                    diarizationSpeakers: null,
                                    privateTranscriptionMinSpeakers: 0,
                                    privateTranscriptionMaxSpeakers: 0,
                                    privateTranscriptionDenoiseModel: "none",
                                    privateTranscriptionSnrThreshold: null,
                                },
                            ]),
                        }),
                    }),
                })
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([
                            {
                                apiKey: "encrypted:voscript-key",
                                baseUrl: "http://transcribe.internal:8780",
                                provider: "private-transcription",
                                defaultModel: null,
                                isDefaultTranscription: false,
                                id: "cred-1",
                            },
                        ]),
                    }),
                });

            const result = await transcribeRecording(
                mockUserId,
                mockRecordingId,
            );

            expect(result.success).toBe(false);
            expect(createTranscriptionProvider).toHaveBeenCalledWith(
                "voice-transcribe",
                "decrypted:encrypted:voscript-key",
                "http://transcribe.internal:8780",
            );
        });

        it("should return error when API call fails", async () => {
            (db.select as Mock)
                .mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([
                                {
                                    id: mockRecordingId,
                                    filename: "test.mp3",
                                    storagePath: "test.mp3",
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
                                    id: "settings-1",
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
                                    id: "creds-1",
                                    provider: "openai",
                                    apiKey: "mock-encrypted-openai-key-for-error-path",
                                    defaultModel: "whisper-1",
                                },
                            ]),
                        }),
                    }),
                });

            const result = await transcribeRecording(
                mockUserId,
                mockRecordingId,
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe("API Error");
        });
    });
});
