import { detectAudioFormat } from "@/lib/audio/detect-format";
import type {
    TranscriptionOptions,
    TranscriptionProvider,
    TranscriptionResult,
    VoiceTranscribePayload,
    VoiceTranscribeWord,
} from "./types";

interface VoiceTranscribeJobResponse {
    id: string;
    status:
        | "queued"
        | "converting"
        | "denoising"
        | "transcribing"
        | "identifying"
        | "completed"
        | "failed";
    filename?: string;
    created_at?: string;
    error?: string;
    result?: {
        id: string;
        language?: string | null;
        created_at?: string;
        segments?: Array<{
            id: number;
            start: number;
            end: number;
            text: string;
            speaker_label: string;
            speaker_id?: string | null;
            speaker_name?: string | null;
            similarity?: number;
            has_overlap?: boolean;
            words?: Array<{
                word: string;
                start?: number | null;
                end?: number | null;
                score?: number | null;
            }>;
        }>;
        speaker_map?: Record<
            string,
            {
                matched_id?: string | null;
                matched_name?: string | null;
                similarity?: number | null;
                embedding_key?: string | null;
            }
        >;
        unique_speakers?: string[];
        params?: {
            language?: string | null;
            denoise_model?: string | null;
            snr_threshold?: number | null;
            voiceprint_threshold?: number | null;
            min_speakers?: number;
            max_speakers?: number;
            no_repeat_ngram_size?: number;
        };
    };
}

type VoiceTranscribeJobWord = {
    word: string;
    start?: number | null;
    end?: number | null;
    score?: number | null;
};

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 20 * 60 * 1000;

export type VoiceTranscribeRemoteStatus = VoiceTranscribeJobResponse["status"];

function createAudioBlob(audioBuffer: Buffer, contentType: string) {
    return new Blob([new Uint8Array(audioBuffer)], {
        type: contentType,
    });
}

function normalizeVoiceTranscribeError(message: string) {
    if (message.includes("`np.NaN` was removed")) {
        return "Voice-transcribe failed on the remote host because it is running with an incompatible NumPy 2.x build. Redeploy the service with numpy<2.0.";
    }

    return message;
}

function normalizeSubmitResponse(payload: VoiceTranscribeJobResponse) {
    if (!payload.id) {
        throw new Error("Voice-transcribe submit succeeded without a job id");
    }

    return {
        jobId: payload.id,
        status: payload.status,
    };
}

function joinTranscriptSegments(
    segments: Array<{
        text: string;
        speaker_label: string;
    }>,
) {
    const turns: Array<{ speaker: string; text: string }> = [];

    for (const segment of segments) {
        const speaker = segment.speaker_label;
        const text = segment.text.trim();
        if (!text) {
            continue;
        }

        const last = turns.at(-1);
        if (last && last.speaker === speaker) {
            last.text += ` ${text}`;
            continue;
        }

        turns.push({ speaker, text });
    }

    return turns.map((turn) => `${turn.speaker}: ${turn.text}`).join("\n\n");
}

function normalizeWord(word: VoiceTranscribeJobWord): VoiceTranscribeWord {
    return {
        word: word.word,
        start:
            typeof word.start === "number" && Number.isFinite(word.start)
                ? word.start
                : null,
        end:
            typeof word.end === "number" && Number.isFinite(word.end)
                ? word.end
                : null,
        score:
            typeof word.score === "number" && Number.isFinite(word.score)
                ? word.score
                : null,
    };
}

function normalizeVoiceTranscribePayload(
    job: VoiceTranscribeJobResponse,
): VoiceTranscribePayload {
    const result = job.result;
    const segments = result?.segments ?? [];

    return {
        id: result?.id ?? job.id,
        status: job.status,
        filename: job.filename ?? null,
        createdAt: result?.created_at ?? job.created_at ?? null,
        language: result?.language ?? null,
        segments: segments.map((segment) => ({
            id: segment.id,
            start:
                typeof segment.start === "number" &&
                Number.isFinite(segment.start)
                    ? segment.start
                    : null,
            end:
                typeof segment.end === "number" && Number.isFinite(segment.end)
                    ? segment.end
                    : null,
            text: segment.text ?? "",
            speakerLabel: segment.speaker_label,
            speakerId: segment.speaker_id ?? null,
            speakerName: segment.speaker_name ?? null,
            similarity:
                typeof segment.similarity === "number" &&
                Number.isFinite(segment.similarity)
                    ? segment.similarity
                    : null,
            hasOverlap:
                typeof segment.has_overlap === "boolean"
                    ? segment.has_overlap
                    : null,
            words: segment.words?.map(normalizeWord) ?? null,
        })),
        speakerMap: Object.fromEntries(
            Object.entries(result?.speaker_map ?? {}).map(([label, match]) => [
                label,
                {
                    matchedId: match.matched_id ?? null,
                    matchedName: match.matched_name ?? null,
                    similarity:
                        typeof match.similarity === "number" &&
                        Number.isFinite(match.similarity)
                            ? match.similarity
                            : null,
                    embeddingKey: match.embedding_key ?? null,
                },
            ]),
        ),
        uniqueSpeakers: result?.unique_speakers ?? [],
        params: result?.params
            ? {
                  language: result.params.language ?? null,
                  denoiseModel: result.params.denoise_model ?? null,
                  snrThreshold:
                      typeof result.params.snr_threshold === "number" &&
                      Number.isFinite(result.params.snr_threshold)
                          ? result.params.snr_threshold
                          : null,
                  voiceprintThreshold:
                      typeof result.params.voiceprint_threshold === "number" &&
                      Number.isFinite(result.params.voiceprint_threshold)
                          ? result.params.voiceprint_threshold
                          : null,
                  minSpeakers:
                      typeof result.params.min_speakers === "number" &&
                      Number.isFinite(result.params.min_speakers)
                          ? result.params.min_speakers
                          : 0,
                  maxSpeakers:
                      typeof result.params.max_speakers === "number" &&
                      Number.isFinite(result.params.max_speakers)
                          ? result.params.max_speakers
                          : 0,
                  noRepeatNgramSize:
                      typeof result.params.no_repeat_ngram_size === "number" &&
                      Number.isFinite(result.params.no_repeat_ngram_size)
                          ? result.params.no_repeat_ngram_size
                          : 0,
              }
            : null,
    };
}

function normalizeCompletedJob(job: VoiceTranscribeJobResponse) {
    if (job.status !== "completed" || !job.result) {
        throw new Error("Voice-transcribe job is not completed");
    }

    const segments = job.result.segments ?? [];
    const providerPayload = normalizeVoiceTranscribePayload(job);
    return {
        text: joinTranscriptSegments(segments),
        detectedLanguage: job.result.language ?? null,
        providerJobId: job.result.id ?? job.id,
        speakerSegments: segments.map((segment) => ({
            speaker: segment.speaker_label,
            startMs:
                typeof segment.start === "number"
                    ? Math.round(segment.start * 1000)
                    : null,
            endMs:
                typeof segment.end === "number"
                    ? Math.round(segment.end * 1000)
                    : null,
            text: segment.text ?? null,
        })),
        providerPayload,
    } satisfies TranscriptionResult;
}

function buildAuthHeaders(apiKey: string | null | undefined): HeadersInit {
    const trimmed = apiKey?.trim();
    if (!trimmed) {
        return {};
    }
    return {
        Authorization: `Bearer ${trimmed}`,
        "X-API-Key": trimmed,
    };
}

export async function submitVoiceTranscribeJob(params: {
    baseURL: string;
    audioBuffer: Buffer;
    filename: string;
    options: TranscriptionOptions;
    apiKey?: string | null;
}) {
    const { baseURL, audioBuffer, filename, options, apiKey } = params;
    const format = detectAudioFormat(audioBuffer);
    const normalizedMinSpeakers =
        typeof options.minSpeakers === "number" &&
        Number.isFinite(options.minSpeakers) &&
        options.minSpeakers > 0
            ? options.minSpeakers
            : undefined;
    const normalizedMaxSpeakers =
        typeof options.maxSpeakers === "number" &&
        Number.isFinite(options.maxSpeakers) &&
        options.maxSpeakers > 0
            ? options.maxSpeakers
            : undefined;
    const formData = new FormData();
    formData.append(
        "file",
        createAudioBlob(audioBuffer, format.contentType),
        filename.replace(/\.[^.]+$/, "") + format.extension,
    );
    const language = options.language?.trim();
    if (language) {
        formData.append("language", language);
    }

    if (normalizedMinSpeakers !== undefined) {
        formData.append("min_speakers", String(normalizedMinSpeakers));
    }

    if (normalizedMaxSpeakers !== undefined) {
        formData.append("max_speakers", String(normalizedMaxSpeakers));
    }

    if (
        normalizedMinSpeakers === undefined &&
        normalizedMaxSpeakers === undefined &&
        options.diarizationSpeakers &&
        options.diarizationSpeakers > 0
    ) {
        const count = String(options.diarizationSpeakers);
        formData.append("min_speakers", count);
        formData.append("max_speakers", count);
    }

    if (options.denoiseModel?.trim()) {
        formData.append("denoise_model", options.denoiseModel.trim());
    }

    if (
        typeof options.snrThreshold === "number" &&
        Number.isFinite(options.snrThreshold)
    ) {
        formData.append("snr_threshold", String(options.snrThreshold));
    }

    if (
        typeof options.noRepeatNgramSize === "number" &&
        Number.isFinite(options.noRepeatNgramSize) &&
        options.noRepeatNgramSize >= 3
    ) {
        formData.append(
            "no_repeat_ngram_size",
            String(options.noRepeatNgramSize),
        );
    }

    const submitResponse = await fetch(
        `${baseURL.replace(/\/$/, "")}/api/transcribe`,
        {
            method: "POST",
            body: formData,
            headers: buildAuthHeaders(apiKey),
        },
    );

    if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        throw new Error(
            `Voice-transcribe submit failed (${submitResponse.status}): ${errorText || submitResponse.statusText}`,
        );
    }

    return normalizeSubmitResponse(
        (await submitResponse.json()) as VoiceTranscribeJobResponse,
    );
}

export async function pollVoiceTranscribeJob(params: {
    baseURL: string;
    jobId: string;
    apiKey?: string | null;
}) {
    const { baseURL, jobId, apiKey } = params;
    const jobResponse = await fetch(
        `${baseURL.replace(/\/$/, "")}/api/jobs/${jobId}`,
        {
            cache: "no-store",
            headers: buildAuthHeaders(apiKey),
        },
    );

    if (!jobResponse.ok) {
        const errorText = await jobResponse.text();
        throw new Error(
            `Voice-transcribe job polling failed (${jobResponse.status}): ${errorText || jobResponse.statusText}`,
        );
    }

    return (await jobResponse.json()) as VoiceTranscribeJobResponse;
}

export function getVoiceTranscribeResult(job: VoiceTranscribeJobResponse) {
    return normalizeCompletedJob(job);
}

export function normalizeVoiceTranscribeJobError(
    job: VoiceTranscribeJobResponse,
) {
    return normalizeVoiceTranscribeError(
        job.error || "Voice-transcribe job failed without details",
    );
}

export class VoiceTranscribeProvider implements TranscriptionProvider {
    private readonly baseURL: string;
    private readonly apiKey: string | null;

    constructor(baseURL: string, apiKey?: string | null) {
        this.baseURL = baseURL.replace(/\/$/, "");
        this.apiKey = apiKey?.trim() || null;
    }

    async transcribe(
        audioBuffer: Buffer,
        filename: string,
        options: TranscriptionOptions,
    ): Promise<TranscriptionResult> {
        const submitted = await submitVoiceTranscribeJob({
            baseURL: this.baseURL,
            audioBuffer,
            filename,
            options,
            apiKey: this.apiKey,
        });
        const jobId = submitted.jobId;
        const startedAt = Date.now();

        while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
            await new Promise((resolve) =>
                setTimeout(resolve, POLL_INTERVAL_MS),
            );

            const job = await pollVoiceTranscribeJob({
                baseURL: this.baseURL,
                jobId,
                apiKey: this.apiKey,
            });
            if (job.status === "failed") {
                throw new Error(normalizeVoiceTranscribeJobError(job));
            }

            if (job.status !== "completed" || !job.result) {
                continue;
            }

            return getVoiceTranscribeResult(job);
        }

        throw new Error("Voice-transcribe job polling timed out");
    }
}
