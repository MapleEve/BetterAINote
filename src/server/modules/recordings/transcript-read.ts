import {
    getPublicTranscriptionFailureMessage,
    sanitizeTranscriptionJobLastError,
} from "@/lib/transcription/public-errors";
import {
    applySpeakerMap,
    buildDisplaySegments,
    buildTranscriptMetrics,
    mergeSpeakerMaps,
} from "@/lib/transcription/voice-transcribe-metadata";
import { getRecordingDetailReadModel } from "./read-model";

type TranscriptReadJob = NonNullable<
    Awaited<ReturnType<typeof getRecordingDetailReadModel>>
>["transcriptionJob"];

type TranscriptReadDetail = NonNullable<
    Awaited<ReturnType<typeof getRecordingDetailReadModel>>
>;

type TranscriptReadResponse = {
    status: number;
    body: Record<string, unknown>;
};

function serializeRecording(detail: TranscriptReadDetail) {
    return {
        id: detail.recording.id,
        filename: detail.recording.filename,
        startTime: detail.recording.startTime.toISOString(),
    };
}

function serializeJob(
    job: TranscriptReadJob,
    options: { includeRemoteStatus: boolean },
) {
    if (!job) {
        return null;
    }

    return {
        status: job.status,
        ...(options.includeRemoteStatus
            ? { remoteStatus: job.remoteStatus }
            : {}),
        lastError: sanitizeTranscriptionJobLastError(job.lastError, job.status),
        updatedAt: job.updatedAt.toISOString(),
    };
}

function buildPendingTranscriptResponse(
    detail: TranscriptReadDetail,
): TranscriptReadResponse {
    return {
        status: 202,
        body: {
            recording: serializeRecording(detail),
            transcript: null,
            speakerMap: null,
            job: serializeJob(detail.transcriptionJob, {
                includeRemoteStatus: true,
            }),
        },
    };
}

function buildMissingTranscriptResponse(
    detail: TranscriptReadDetail,
): TranscriptReadResponse {
    return {
        status: detail.transcriptionJob?.status === "failed" ? 409 : 404,
        body: {
            error: getPublicTranscriptionFailureMessage(
                detail.transcriptionJob?.status,
                detail.transcriptionJob?.lastError,
            ),
            job: serializeJob(detail.transcriptionJob, {
                includeRemoteStatus: true,
            }),
        },
    };
}

function buildSharedTranscriptPayload(detail: TranscriptReadDetail) {
    const transcription = detail.transcription;

    if (!transcription) {
        throw new Error("Expected transcription to exist");
    }

    const speakerMap = mergeSpeakerMaps(
        transcription.speakerMap,
        transcription.providerPayload,
    );
    const metrics = buildTranscriptMetrics(transcription.text, speakerMap);

    return {
        recording: serializeRecording(detail),
        transcription,
        speakerMap,
        metrics,
        job: serializeJob(detail.transcriptionJob, {
            includeRemoteStatus: false,
        }),
    };
}

async function getRecordingTranscriptReadDetail(
    userId: string,
    recordingId: string,
) {
    const detail = await getRecordingDetailReadModel(userId, recordingId);

    if (!detail) {
        return {
            status: 404,
            body: { error: "Recording not found" },
        } satisfies TranscriptReadResponse;
    }

    if (!detail.transcription) {
        if (
            detail.transcriptionJob &&
            ["pending", "submitted", "processing"].includes(
                detail.transcriptionJob.status,
            )
        ) {
            return buildPendingTranscriptResponse(detail);
        }

        return buildMissingTranscriptResponse(detail);
    }

    return detail;
}

export async function getRecordingRawTranscriptReadResponse(
    userId: string,
    recordingId: string,
): Promise<TranscriptReadResponse> {
    const detail = await getRecordingTranscriptReadDetail(userId, recordingId);

    if ("body" in detail) {
        return detail;
    }

    const shared = buildSharedTranscriptPayload(detail);

    return {
        status: 200,
        body: {
            recording: shared.recording,
            transcript: {
                text: shared.transcription.text,
                detectedLanguage: shared.transcription.detectedLanguage,
                transcriptionType: shared.transcription.transcriptionType,
                provider: shared.transcription.provider,
                model: shared.transcription.model,
                createdAt: shared.transcription.createdAt.toISOString(),
                providerPayload: shared.transcription.providerPayload ?? null,
                ...shared.metrics,
            },
            speakerMap: shared.speakerMap,
            job: shared.job,
        },
    };
}

export async function getRecordingSpeakerTranscriptReadResponse(
    userId: string,
    recordingId: string,
): Promise<TranscriptReadResponse> {
    const detail = await getRecordingTranscriptReadDetail(userId, recordingId);

    if ("body" in detail) {
        return detail;
    }

    const shared = buildSharedTranscriptPayload(detail);

    return {
        status: 200,
        body: {
            recording: shared.recording,
            transcript: {
                rawText: shared.transcription.text,
                displayText: applySpeakerMap(
                    shared.transcription.text,
                    shared.speakerMap,
                ),
                detectedLanguage: shared.transcription.detectedLanguage,
                transcriptionType: shared.transcription.transcriptionType,
                provider: shared.transcription.provider,
                model: shared.transcription.model,
                createdAt: shared.transcription.createdAt.toISOString(),
                providerPayload: shared.transcription.providerPayload ?? null,
                segments: buildDisplaySegments(
                    shared.transcription.providerPayload,
                    shared.speakerMap,
                ),
                ...shared.metrics,
            },
            speakerMap: shared.speakerMap,
            job: shared.job,
        },
    };
}
