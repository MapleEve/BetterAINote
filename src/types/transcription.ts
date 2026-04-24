/**
 * Transcription types
 */

export interface TranscriptionResult {
    text: string;
    detectedLanguage: string;
}

export type TranscriptionModel =
    | "whisper-tiny"
    | "whisper-base"
    | "whisper-small";
