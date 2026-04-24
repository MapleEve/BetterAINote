export interface TranscriptionSpeakerSegment {
    speaker: string;
    startMs: number | null;
    endMs: number | null;
    text?: string | null;
}

export interface VoiceTranscribeWord {
    word: string;
    start: number | null;
    end: number | null;
    score: number | null;
}

export interface VoiceTranscribeSegment {
    id: number;
    start: number | null;
    end: number | null;
    text: string;
    speakerLabel: string;
    speakerId: string | null;
    speakerName: string | null;
    similarity: number | null;
    hasOverlap: boolean | null;
    words?: VoiceTranscribeWord[] | null;
}

export interface VoiceTranscribeSpeakerMatch {
    matchedId: string | null;
    matchedName: string | null;
    similarity: number | null;
    embeddingKey: string | null;
}

export interface VoiceTranscribeParams {
    language: string | null;
    denoiseModel: string | null;
    snrThreshold: number | null;
    voiceprintThreshold: number | null;
    minSpeakers: number;
    maxSpeakers: number;
    noRepeatNgramSize: number;
}

export interface VoiceTranscribePayload {
    id: string;
    status:
        | "queued"
        | "converting"
        | "denoising"
        | "transcribing"
        | "identifying"
        | "completed"
        | "failed";
    filename: string | null;
    createdAt: string | null;
    language: string | null;
    segments: VoiceTranscribeSegment[];
    speakerMap: Record<string, VoiceTranscribeSpeakerMatch>;
    uniqueSpeakers: string[];
    params: VoiceTranscribeParams | null;
}

export interface TranscriptionResult {
    text: string;
    detectedLanguage: string | null;
    /** Set when audio was downsampled before upload due to file size. */
    compressionWarning?: string;
    providerJobId?: string | null;
    speakerSegments?: TranscriptionSpeakerSegment[];
    providerPayload?: VoiceTranscribePayload | null;
}

export interface TranscriptionOptions {
    language?: string;
    model: string;
    responseFormat?: string;
    diarizationSpeakers?: number;
    minSpeakers?: number;
    maxSpeakers?: number;
    denoiseModel?: string;
    snrThreshold?: number;
    noRepeatNgramSize?: number;
    /** Absolute path to the audio file on disk (for diarization pre-pass) */
    audioPath?: string;
}

export interface TranscriptionProvider {
    transcribe(
        audioBuffer: Buffer,
        filename: string,
        options: TranscriptionOptions,
    ): Promise<TranscriptionResult>;
}

export type ProviderType =
    | "openai"
    | "azure"
    | "litellm"
    | "local"
    | "google"
    | "voice-transcribe";
