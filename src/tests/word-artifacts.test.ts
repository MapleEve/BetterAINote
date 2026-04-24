import { describe, expect, it } from "vitest";
import {
    deriveTranscriptWordsDatabasePath,
    splitVoiceTranscribePayloadWords,
} from "@/lib/transcription/word-artifacts";

describe("transcription word artifacts", () => {
    it("derives a sidecar words database path next to the main SQLite database", () => {
        expect(
            deriveTranscriptWordsDatabasePath("./data/betterainote.db", null),
        ).toBe(`${process.cwd()}/data/betterainote-words.db`);
    });

    it("disables the words sidecar for remote libsql/http databases", () => {
        expect(
            deriveTranscriptWordsDatabasePath(
                "https://example-db.turso.io",
                null,
            ),
        ).toBeNull();
        expect(
            deriveTranscriptWordsDatabasePath(
                "libsql://example-db.turso.io",
                null,
            ),
        ).toBeNull();
    });

    it("moves per-word timing data out of the provider payload", () => {
        const result = splitVoiceTranscribePayloadWords({
            id: "job-1",
            status: "completed",
            filename: "call.mp3",
            createdAt: "2026-04-20T00:00:00.000Z",
            language: "zh",
            uniqueSpeakers: ["SPEAKER_01"],
            speakerMap: {
                SPEAKER_01: {
                    matchedId: "spk-1",
                    matchedName: "Maple",
                    similarity: 0.92,
                    embeddingKey: "SPEAKER_01",
                },
            },
            params: {
                language: "zh",
                denoiseModel: "none",
                snrThreshold: 10,
                voiceprintThreshold: 0.75,
                minSpeakers: 0,
                maxSpeakers: 0,
                noRepeatNgramSize: 0,
            },
            segments: [
                {
                    id: 1,
                    start: 0,
                    end: 1.5,
                    text: "你好 世界",
                    speakerLabel: "SPEAKER_01",
                    speakerId: "spk-1",
                    speakerName: "Maple",
                    similarity: 0.92,
                    hasOverlap: false,
                    words: [
                        {
                            word: "你好",
                            start: 0,
                            end: 0.5,
                            score: 0.98,
                        },
                        {
                            word: "世界",
                            start: 0.5,
                            end: 1.1,
                            score: 0.97,
                        },
                    ],
                },
                {
                    id: 2,
                    start: 1.5,
                    end: 2.1,
                    text: "继续",
                    speakerLabel: "SPEAKER_01",
                    speakerId: "spk-1",
                    speakerName: "Maple",
                    similarity: 0.94,
                    hasOverlap: false,
                    words: null,
                },
            ],
        });

        expect(result.sanitizedPayload?.segments[0]?.words).toBeNull();
        expect(result.sanitizedPayload?.segments[1]?.words).toBeNull();
        expect(result.wordsArtifact).toEqual({
            payloadId: "job-1",
            language: "zh",
            segments: [
                {
                    id: 1,
                    speakerLabel: "SPEAKER_01",
                    start: 0,
                    end: 1.5,
                    text: "你好 世界",
                    words: [
                        {
                            word: "你好",
                            start: 0,
                            end: 0.5,
                            score: 0.98,
                        },
                        {
                            word: "世界",
                            start: 0.5,
                            end: 1.1,
                            score: 0.97,
                        },
                    ],
                },
            ],
        });
    });
});
