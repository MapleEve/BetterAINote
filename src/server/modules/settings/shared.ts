import type { userSettings } from "@/db/schema/core";

export type TranscriptionRuntimeSettings = Pick<
    typeof userSettings.$inferSelect,
    | "defaultTranscriptionLanguage"
    | "speakerDiarization"
    | "diarizationSpeakers"
    | "privateTranscriptionBaseUrl"
    | "privateTranscriptionMinSpeakers"
    | "privateTranscriptionMaxSpeakers"
    | "privateTranscriptionDenoiseModel"
    | "privateTranscriptionSnrThreshold"
    | "privateTranscriptionNoRepeatNgramSize"
    | "privateTranscriptionMaxInflightJobs"
>;

export type TranscriptionRuntimeSettingsRow = TranscriptionRuntimeSettings & {
    userId: string;
};
