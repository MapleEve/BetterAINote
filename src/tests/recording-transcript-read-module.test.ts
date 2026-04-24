import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/server/modules/recordings/read-model", () => ({
    getRecordingDetailReadModel: vi.fn(),
}));

import { getRecordingDetailReadModel } from "@/server/modules/recordings/read-model";
import {
    getRecordingRawTranscriptReadResponse,
    getRecordingSpeakerTranscriptReadResponse,
} from "@/server/modules/recordings/transcript-read";

const baseRecording = {
    id: "rec-1",
    filename: "Call",
    startTime: new Date("2026-04-18T10:00:00.000Z"),
};

const baseTranscription = {
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
};

const baseJob = {
    status: "completed",
    remoteStatus: "completed",
    lastError: null,
    updatedAt: new Date("2026-04-18T10:06:00.000Z"),
};

describe("recording transcript read module", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns a stable 404 payload when the recording is missing", async () => {
        (getRecordingDetailReadModel as Mock).mockResolvedValue(null);

        await expect(
            getRecordingRawTranscriptReadResponse("user-1", "missing"),
        ).resolves.toEqual({
            status: 404,
            body: { error: "Recording not found" },
        });
    });

    it("returns 202 with pending job metadata when transcription is still processing", async () => {
        (getRecordingDetailReadModel as Mock).mockResolvedValue({
            recording: baseRecording,
            transcription: null,
            transcriptionJob: {
                ...baseJob,
                status: "processing",
                remoteStatus: "running",
            },
        });

        await expect(
            getRecordingRawTranscriptReadResponse("user-1", "rec-1"),
        ).resolves.toEqual({
            status: 202,
            body: {
                recording: {
                    id: "rec-1",
                    filename: "Call",
                    startTime: "2026-04-18T10:00:00.000Z",
                },
                transcript: null,
                speakerMap: null,
                job: {
                    status: "processing",
                    remoteStatus: "running",
                    lastError: null,
                    updatedAt: "2026-04-18T10:06:00.000Z",
                },
            },
        });
    });

    it("returns 409 with sanitized failure details when the transcription job failed", async () => {
        (getRecordingDetailReadModel as Mock).mockResolvedValue({
            recording: baseRecording,
            transcription: null,
            transcriptionJob: {
                ...baseJob,
                status: "failed",
                lastError:
                    "Remote queue lost the transcription job after 3 submission attempts",
            },
        });

        await expect(
            getRecordingRawTranscriptReadResponse("user-1", "rec-1"),
        ).resolves.toEqual({
            status: 409,
            body: {
                error: "Transcription failed. Check server logs for details.",
                job: {
                    status: "failed",
                    remoteStatus: "completed",
                    lastError:
                        "Transcription failed. Check server logs for details.",
                    updatedAt: "2026-04-18T10:06:00.000Z",
                },
            },
        });
    });

    it("builds the raw transcript payload from the shared read model", async () => {
        (getRecordingDetailReadModel as Mock).mockResolvedValue({
            recording: baseRecording,
            transcription: baseTranscription,
            transcriptionJob: baseJob,
        });

        const result = await getRecordingRawTranscriptReadResponse(
            "user-1",
            "rec-1",
        );

        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            recording: {
                id: "rec-1",
                filename: "Call",
                startTime: "2026-04-18T10:00:00.000Z",
            },
            transcript: {
                text: "SPEAKER_01: Hello there",
                detectedLanguage: "en",
                transcriptionType: "private",
                provider: "voice-transcribe",
                model: "vt-1",
                createdAt: "2026-04-18T10:05:00.000Z",
                providerPayload: baseTranscription.providerPayload,
                wordCount: 3,
                characterCount: 23,
                mappedSpeakerCount: 1,
            },
            speakerMap: { SPEAKER_01: "Alex" },
            job: {
                status: "completed",
                lastError: null,
                updatedAt: "2026-04-18T10:06:00.000Z",
            },
        });
    });

    it("builds the speaker transcript payload from the shared read model", async () => {
        (getRecordingDetailReadModel as Mock).mockResolvedValue({
            recording: baseRecording,
            transcription: baseTranscription,
            transcriptionJob: baseJob,
        });

        const result = await getRecordingSpeakerTranscriptReadResponse(
            "user-1",
            "rec-1",
        );

        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            recording: {
                id: "rec-1",
                filename: "Call",
                startTime: "2026-04-18T10:00:00.000Z",
            },
            transcript: {
                rawText: "SPEAKER_01: Hello there",
                displayText: "Alex: Hello there",
                detectedLanguage: "en",
                transcriptionType: "private",
                provider: "voice-transcribe",
                model: "vt-1",
                createdAt: "2026-04-18T10:05:00.000Z",
                providerPayload: baseTranscription.providerPayload,
                segments: [
                    expect.objectContaining({
                        speakerLabel: "SPEAKER_01",
                        displaySpeaker: "Alex",
                    }),
                ],
                wordCount: 3,
                characterCount: 23,
                mappedSpeakerCount: 1,
            },
            speakerMap: { SPEAKER_01: "Alex" },
            job: {
                status: "completed",
                lastError: null,
                updatedAt: "2026-04-18T10:06:00.000Z",
            },
        });
    });
});
