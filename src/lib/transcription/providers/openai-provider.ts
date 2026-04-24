import { OpenAI, toFile } from "openai";
import type {
    TranscriptionDiarized,
    TranscriptionVerbose,
} from "openai/resources/audio/transcriptions";
import { detectAudioFormat } from "@/lib/audio/detect-format";
import type {
    TranscriptionOptions,
    TranscriptionProvider,
    TranscriptionResult,
} from "./types";

export class OpenAITranscriptionProvider implements TranscriptionProvider {
    private readonly openai: OpenAI;

    constructor(apiKey: string, baseURL?: string) {
        this.openai = new OpenAI({ apiKey, baseURL });
    }

    async transcribe(
        audioBuffer: Buffer,
        filename: string,
        options: TranscriptionOptions,
    ): Promise<TranscriptionResult> {
        const format = detectAudioFormat(audioBuffer);

        const baseName = filename.replace(/\.[^.]+$/, "");
        // Use OpenAI's toFile() for reliable cross-runtime serialization (Bun, Node, Edge)
        const audioFile = await toFile(
            audioBuffer,
            `${baseName}${format.extension}`,
            { type: format.contentType },
        );

        const { model, language } = options;

        const isDiarize =
            options.responseFormat === "diarized_json" ||
            model.includes("diarize") ||
            model.includes("diarized");
        // Whisper models support verbose_json; non-Whisper models
        // (chat-based audio, etc.) should use plain json.
        const isWhisperModel =
            model.includes("whisper") || model.includes("chirp");

        const responseFormat = options.responseFormat
            ? (options.responseFormat as
                  | "diarized_json"
                  | "json"
                  | "verbose_json")
            : isDiarize
              ? ("diarized_json" as const)
              : isWhisperModel
                ? ("verbose_json" as const)
                : ("json" as const);

        const transcription = await this.openai.audio.transcriptions.create({
            file: audioFile,
            model,
            response_format: responseFormat,
            ...(language ? { language } : {}),
        });

        return this.parseResponse(transcription, responseFormat, isDiarize);
    }

    private parseResponse(
        transcription: unknown,
        responseFormat: string,
        isDiarize: boolean,
    ): TranscriptionResult {
        if (isDiarize) {
            const diarized = transcription as TranscriptionDiarized;
            const text = (diarized.segments ?? [])
                .map((seg) => `${seg.speaker}: ${seg.text}`)
                .join("\n");
            return {
                text,
                detectedLanguage: null,
                speakerSegments: (diarized.segments ?? []).map((seg) => ({
                    speaker: seg.speaker,
                    startMs:
                        typeof seg.start === "number"
                            ? Math.round(seg.start * 1000)
                            : null,
                    endMs:
                        typeof seg.end === "number"
                            ? Math.round(seg.end * 1000)
                            : null,
                    text: seg.text ?? null,
                })),
            };
        }

        if (responseFormat === "verbose_json") {
            const verbose = transcription as TranscriptionVerbose;
            return {
                text: verbose.text,
                detectedLanguage: verbose.language ?? null,
            };
        }

        const text =
            typeof transcription === "string"
                ? transcription
                : ((transcription as { text?: string }).text ?? "");
        return { text, detectedLanguage: null };
    }
}
