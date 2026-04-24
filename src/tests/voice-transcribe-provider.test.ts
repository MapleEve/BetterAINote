import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    getVoiceTranscribeResult,
    normalizeVoiceTranscribeJobError,
    pollVoiceTranscribeJob,
    submitVoiceTranscribeJob,
} from "@/lib/transcription/providers/voice-transcribe-provider";

describe("voice-transcribe-provider helpers", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("submits a job with auth headers and current voscript config", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ id: "job-1", status: "queued" }),
        });
        global.fetch = fetchMock as typeof fetch;

        const result = await submitVoiceTranscribeJob({
            baseURL: "http://transcribe.internal:8780/",
            audioBuffer: Buffer.from("RIFFxxxxWAVEfmt "),
            filename: "call.mp3",
            options: {
                language: "en",
                model: "voice-transcribe:whisper-large-v3+pyannote-3.1",
                minSpeakers: 2,
                maxSpeakers: 4,
                denoiseModel: "deepfilternet",
                snrThreshold: 12.5,
                noRepeatNgramSize: 5,
            },
            apiKey: "secret-key",
        });

        expect(result).toEqual({
            jobId: "job-1",
            status: "queued",
        });
        const [, init] = fetchMock.mock.calls[0];
        expect(fetchMock.mock.calls[0][0]).toBe(
            "http://transcribe.internal:8780/api/transcribe",
        );
        expect(init?.headers).toMatchObject({
            Authorization: "Bearer secret-key",
            "X-API-Key": "secret-key",
        });
        const formData = init?.body as FormData;
        expect(formData.get("language")).toBe("en");
        expect(formData.get("min_speakers")).toBe("2");
        expect(formData.get("max_speakers")).toBe("4");
        expect(formData.get("denoise_model")).toBe("deepfilternet");
        expect(formData.get("snr_threshold")).toBe("12.5");
        expect(formData.get("no_repeat_ngram_size")).toBe("5");
    });

    it("does not send language when auto-detect is used", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ id: "job-1", status: "queued" }),
        });
        global.fetch = fetchMock as typeof fetch;

        await submitVoiceTranscribeJob({
            baseURL: "http://transcribe.internal:8780/",
            audioBuffer: Buffer.from("RIFFxxxxWAVEfmt "),
            filename: "call.mp3",
            options: {
                model: "voice-transcribe:whisper-large-v3+pyannote-3.1",
                denoiseModel: "none",
            },
        });

        const [, init] = fetchMock.mock.calls[0];
        const formData = init?.body as FormData;
        expect(formData.get("language")).toBeNull();
        expect(formData.get("min_speakers")).toBeNull();
        expect(formData.get("max_speakers")).toBeNull();
        expect(formData.get("no_repeat_ngram_size")).toBeNull();
    });

    it("polls a remote job and normalizes completed results", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                id: "job-1",
                status: "completed",
                result: {
                    id: "remote-1",
                    language: "zh",
                    params: {
                        language: "zh",
                        denoise_model: "none",
                        snr_threshold: 10,
                        voiceprint_threshold: 0.75,
                        min_speakers: 0,
                        max_speakers: 0,
                        no_repeat_ngram_size: 3,
                    },
                    speaker_map: {
                        SPEAKER_01: {
                            matched_id: "spk-1",
                            matched_name: "Alex",
                            similarity: 0.91,
                            embedding_key: "SPEAKER_01",
                        },
                    },
                    unique_speakers: ["SPEAKER_01"],
                    segments: [
                        {
                            id: 1,
                            start: 0,
                            end: 1.2,
                            text: "你好",
                            speaker_label: "SPEAKER_01",
                            speaker_id: "spk-1",
                            speaker_name: "Alex",
                            similarity: 0.91,
                            has_overlap: false,
                            words: [
                                {
                                    word: "你好",
                                    start: 0,
                                    end: 0.4,
                                    score: 0.98,
                                },
                            ],
                        },
                        {
                            id: 2,
                            start: 1.2,
                            end: 2.5,
                            text: "继续",
                            speaker_label: "SPEAKER_01",
                            speaker_id: "spk-1",
                            speaker_name: "Alex",
                            similarity: 0.92,
                            has_overlap: true,
                        },
                    ],
                },
            }),
        });
        global.fetch = fetchMock as typeof fetch;

        const remoteJob = await pollVoiceTranscribeJob({
            baseURL: "http://transcribe.internal:8780",
            jobId: "job-1",
            apiKey: "secret-key",
        });

        expect(fetchMock.mock.calls[0][0]).toBe(
            "http://transcribe.internal:8780/api/jobs/job-1",
        );
        expect(getVoiceTranscribeResult(remoteJob)).toEqual({
            text: "SPEAKER_01: 你好 继续",
            detectedLanguage: "zh",
            providerJobId: "remote-1",
            speakerSegments: [
                {
                    speaker: "SPEAKER_01",
                    startMs: 0,
                    endMs: 1200,
                    text: "你好",
                },
                {
                    speaker: "SPEAKER_01",
                    startMs: 1200,
                    endMs: 2500,
                    text: "继续",
                },
            ],
            providerPayload: {
                id: "remote-1",
                status: "completed",
                filename: null,
                createdAt: null,
                language: "zh",
                speakerMap: {
                    SPEAKER_01: {
                        matchedId: "spk-1",
                        matchedName: "Alex",
                        similarity: 0.91,
                        embeddingKey: "SPEAKER_01",
                    },
                },
                uniqueSpeakers: ["SPEAKER_01"],
                params: {
                    language: "zh",
                    denoiseModel: "none",
                    snrThreshold: 10,
                    voiceprintThreshold: 0.75,
                    minSpeakers: 0,
                    maxSpeakers: 0,
                    noRepeatNgramSize: 3,
                },
                segments: [
                    {
                        id: 1,
                        start: 0,
                        end: 1.2,
                        text: "你好",
                        speakerLabel: "SPEAKER_01",
                        speakerId: "spk-1",
                        speakerName: "Alex",
                        similarity: 0.91,
                        hasOverlap: false,
                        words: [
                            {
                                word: "你好",
                                start: 0,
                                end: 0.4,
                                score: 0.98,
                            },
                        ],
                    },
                    {
                        id: 2,
                        start: 1.2,
                        end: 2.5,
                        text: "继续",
                        speakerLabel: "SPEAKER_01",
                        speakerId: "spk-1",
                        speakerName: "Alex",
                        similarity: 0.92,
                        hasOverlap: true,
                        words: null,
                    },
                ],
            },
        });
    });

    it("normalizes the known NumPy 2.x remote failure", () => {
        expect(
            normalizeVoiceTranscribeJobError({
                id: "job-1",
                status: "failed",
                error: "`np.NaN` was removed in the NumPy 2.0 release",
            }),
        ).toContain("numpy<2.0");
    });
});
