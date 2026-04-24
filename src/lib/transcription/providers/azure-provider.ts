import { OpenAI, toFile } from "openai";
import type { TranscriptionVerbose } from "openai/resources/audio/transcriptions";
import { detectAudioFormat } from "@/lib/audio/detect-format";
import type {
    TranscriptionOptions,
    TranscriptionProvider,
    TranscriptionResult,
} from "./types";

export class AzureTranscriptionProvider implements TranscriptionProvider {
    private readonly openai: OpenAI;

    constructor(apiKey: string, baseURL: string) {
        this.openai = new OpenAI({ apiKey, baseURL });
    }

    async transcribe(
        audioBuffer: Buffer,
        filename: string,
        options: TranscriptionOptions,
    ): Promise<TranscriptionResult> {
        const format = detectAudioFormat(audioBuffer);

        const baseName = filename.replace(/\.[^.]+$/, "");
        const audioFile = await toFile(
            audioBuffer,
            `${baseName}${format.extension}`,
            { type: format.contentType },
        );

        const { model, language } = options;

        const transcription = await this.openai.audio.transcriptions.create({
            file: audioFile,
            model,
            response_format: "verbose_json",
            ...(language ? { language } : {}),
        });

        const verbose = transcription as TranscriptionVerbose;
        return {
            text: verbose.text,
            detectedLanguage: verbose.language ?? null,
        };
    }
}
