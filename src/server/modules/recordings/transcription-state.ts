import { eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";
import { transcriptions } from "@/db/schema/transcripts";
import {
    canRecordingUsePrivateTranscribe,
    isSourceProvider,
    sourceProviderSupportsCapability,
} from "@/lib/data-sources/catalog";
import {
    enqueueTranscriptionJobs,
    getTranscriptionJobForRecording,
    hasTranscriptionCapability,
    serializeTranscriptionJob,
} from "@/lib/transcription/jobs";
import {
    buildDisplaySegments,
    mergeSpeakerMaps,
} from "@/lib/transcription/voice-transcribe-metadata";
import { findOwnedRecording } from "./ownership";

export class RecordingTranscriptionError extends Error {
    constructor(
        message: string,
        public readonly status = 400,
    ) {
        super(message);
        this.name = "RecordingTranscriptionError";
    }
}

async function getSavedTranscription(recordingId: string) {
    const [savedTranscription] = await db
        .select()
        .from(transcriptions)
        .where(eq(transcriptions.recordingId, recordingId))
        .limit(1);

    return savedTranscription ?? null;
}

function getPrivateTranscriptionUnsupportedError(
    sourceProvider: string | null | undefined,
    hasAudio: boolean,
) {
    if (
        isSourceProvider(sourceProvider) &&
        !sourceProviderSupportsCapability(sourceProvider, "privateTranscribe")
    ) {
        return "This source does not support local private transcription in BetterAINote";
    }

    if (!hasAudio) {
        return "This source does not have downloadable local audio for private transcription";
    }

    return "Private transcription is not available for this recording";
}

function serializeSavedTranscript(
    savedTranscription: Awaited<ReturnType<typeof getSavedTranscription>>,
) {
    if (!savedTranscription) {
        return null;
    }

    const speakerMap = mergeSpeakerMaps(
        savedTranscription.speakerMap,
        savedTranscription.providerPayload,
    );

    return {
        text: savedTranscription.text,
        detectedLanguage: savedTranscription.detectedLanguage ?? null,
        transcriptionType: savedTranscription.transcriptionType ?? null,
        provider: savedTranscription.provider,
        model: savedTranscription.model,
        speakerMap,
        segments: buildDisplaySegments(
            savedTranscription.providerPayload,
            speakerMap,
        ),
        createdAt: savedTranscription.createdAt.toISOString(),
    };
}

async function getTranscribableRecording(userId: string, recordingId: string) {
    const recording = await findOwnedRecording(userId, recordingId, {
        id: recordings.id,
        storagePath: recordings.storagePath,
        sourceProvider: recordings.sourceProvider,
    });

    if (!recording) {
        throw new RecordingTranscriptionError("Recording not found", 404);
    }

    const hasAudio = Boolean(recording.storagePath?.trim());
    if (
        !canRecordingUsePrivateTranscribe({
            sourceProvider: recording.sourceProvider,
            hasAudio,
        })
    ) {
        throw new RecordingTranscriptionError(
            getPrivateTranscriptionUnsupportedError(
                recording.sourceProvider,
                hasAudio,
            ),
            400,
        );
    }

    return recording;
}

export async function getRecordingTranscriptionState(
    userId: string,
    recordingId: string,
) {
    await getTranscribableRecording(userId, recordingId);

    const [savedTranscription, job] = await Promise.all([
        getSavedTranscription(recordingId),
        getTranscriptionJobForRecording(userId, recordingId),
    ]);

    return {
        transcript: serializeSavedTranscript(savedTranscription),
        job: serializeTranscriptionJob(job),
    };
}

export async function queueRecordingTranscription(
    userId: string,
    recordingId: string,
    options: { force?: boolean } = {},
) {
    await getTranscribableRecording(userId, recordingId);

    const force = options.force === true;
    const [savedTranscription, canTranscribe] = await Promise.all([
        getSavedTranscription(recordingId),
        hasTranscriptionCapability(userId),
    ]);

    if (!canTranscribe) {
        throw new RecordingTranscriptionError(
            "No transcription API configured",
            400,
        );
    }

    if (savedTranscription && !force) {
        return {
            status: 200,
            body: {
                queued: false,
                transcript: serializeSavedTranscript(savedTranscription),
                job: serializeTranscriptionJob(
                    await getTranscriptionJobForRecording(userId, recordingId),
                ),
            },
        };
    }

    await enqueueTranscriptionJobs(userId, [recordingId], { force });
    const job = await getTranscriptionJobForRecording(userId, recordingId);

    return {
        status: 202,
        body: {
            queued: true,
            job: serializeTranscriptionJob(job),
        },
    };
}
