import type {
    TranscriptionOptions,
    TranscriptionProvider,
    TranscriptionResult,
} from "./types";
import { uploadAudioForTranscription } from "./upload";

export class LiteLLMTranscriptionProvider implements TranscriptionProvider {
    constructor(
        private readonly apiKey: string,
        private readonly baseURL: string,
    ) {}

    async transcribe(
        audioBuffer: Buffer,
        filename: string,
        options: TranscriptionOptions,
    ): Promise<TranscriptionResult> {
        return uploadAudioForTranscription(audioBuffer, filename, {
            apiKey: this.apiKey,
            baseURL: this.baseURL,
            model: options.model,
            language: options.language,
            responseFormat: options.responseFormat,
        });
    }
}
