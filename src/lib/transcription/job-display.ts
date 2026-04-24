export interface TranscriptionJobLike {
    status?: string | null;
    remoteStatus?: string | null;
}

export type TranscriptionJobDisplayState =
    | "queuedLocal"
    | "queuedRemote"
    | "converting"
    | "denoising"
    | "transcribingAudio"
    | "identifying"
    | "processing";

const ACTIVE_TRANSCRIPTION_JOB_STATUSES = new Set([
    "pending",
    "submitted",
    "processing",
]);

export function isActiveTranscriptionJob(job?: TranscriptionJobLike | null) {
    return ACTIVE_TRANSCRIPTION_JOB_STATUSES.has(job?.status ?? "");
}

export function getTranscriptionJobDisplayState(
    job?: TranscriptionJobLike | null,
): TranscriptionJobDisplayState | null {
    if (!isActiveTranscriptionJob(job)) {
        return null;
    }

    if (job?.status === "pending") {
        return "queuedLocal";
    }

    switch (job?.remoteStatus) {
        case "queued":
            return "queuedRemote";
        case "converting":
            return "converting";
        case "denoising":
            return "denoising";
        case "transcribing":
            return "transcribingAudio";
        case "identifying":
            return "identifying";
        default:
            return "processing";
    }
}
