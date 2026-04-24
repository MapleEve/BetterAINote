import type {
    TranscriptionDiarized,
    TranscriptionVerbose,
} from "openai/resources/audio/transcriptions";

export type ResponseFormat = "diarized_json" | "json" | "verbose_json";

export function getResponseFormat(_model: string): ResponseFormat {
    return "json";
}

export function parseTranscriptionResponse(
    transcription: unknown,
    _responseFormat: ResponseFormat,
): { text: string; detectedLanguage: string | null } {
    if (typeof transcription === "string") {
        return { text: transcription, detectedLanguage: null };
    }

    const verbose = transcription as TranscriptionVerbose;
    if (typeof verbose?.text === "string") {
        return {
            text: verbose.text,
            detectedLanguage: verbose.language ?? null,
        };
    }

    const diarized = transcription as TranscriptionDiarized;
    if (Array.isArray(diarized?.segments)) {
        return {
            text: diarized.segments
                .map((segment) => `${segment.speaker}: ${segment.text}`)
                .join("\n"),
            detectedLanguage: null,
        };
    }

    return { text: "", detectedLanguage: null };
}
