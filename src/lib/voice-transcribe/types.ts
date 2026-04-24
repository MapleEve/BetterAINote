export interface VoiceTranscribeConnection {
    providerId: string;
    providerName: string;
    baseUrl: string;
    apiKey: string | null;
}

export type VoiceTranscribeJobStatus =
    | "queued"
    | "converting"
    | "denoising"
    | "transcribing"
    | "identifying"
    | "completed"
    | "failed";

export interface Voiceprint {
    id: string;
    displayName: string;
    sampleCount?: number | null;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface VoiceTranscribeAccess {
    connection: VoiceTranscribeConnection | null;
    reason: string | null;
}

export interface VoiceprintEnrollmentResult {
    action: string | null;
    speakerId: string;
}

export interface VoiceTranscribeHistoryItem {
    id: string;
    filename: string | null;
    createdAt: string | null;
    segmentCount: number | null;
    speakerCount: number | null;
}

export type VoiceTranscribeExportFormat = "txt" | "srt" | "json";
