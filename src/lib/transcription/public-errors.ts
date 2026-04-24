export const PUBLIC_TRANSCRIPTION_FAILURE_MESSAGE =
    "Transcription failed. Check server logs for details.";

export function sanitizeTranscriptionJobLastError(
    lastError: string | null,
    status?: string | null,
) {
    if (status === "failed") {
        return PUBLIC_TRANSCRIPTION_FAILURE_MESSAGE;
    }

    if (!lastError) {
        return null;
    }

    return null;
}

export function getPublicTranscriptionFailureMessage(
    status?: string | null,
    _lastError?: string | null,
) {
    if (status === "failed") {
        return PUBLIC_TRANSCRIPTION_FAILURE_MESSAGE;
    }

    return "No transcription found for this recording";
}
