import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";
import { transcriptions } from "@/db/schema/transcripts";
import { auth } from "@/lib/auth";
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
import { findOwnedRecording } from "@/server/modules/recordings";

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

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { id } = await params;
        const recording = await findOwnedRecording(session.user.id, id, {
            id: recordings.id,
            storagePath: recordings.storagePath,
            sourceProvider: recordings.sourceProvider,
        });
        if (!recording) {
            return NextResponse.json(
                { error: "Recording not found" },
                { status: 404 },
            );
        }

        const hasAudio = Boolean(recording.storagePath?.trim());
        if (
            !canRecordingUsePrivateTranscribe({
                sourceProvider: recording.sourceProvider,
                hasAudio,
            })
        ) {
            return NextResponse.json(
                {
                    error: getPrivateTranscriptionUnsupportedError(
                        recording.sourceProvider,
                        hasAudio,
                    ),
                },
                { status: 400 },
            );
        }

        const [savedTranscription, job] = await Promise.all([
            getSavedTranscription(id),
            getTranscriptionJobForRecording(session.user.id, id),
        ]);

        return NextResponse.json({
            transcript: savedTranscription
                ? {
                      text: savedTranscription.text,
                      detectedLanguage:
                          savedTranscription.detectedLanguage ?? null,
                      transcriptionType:
                          savedTranscription.transcriptionType ?? null,
                      provider: savedTranscription.provider,
                      model: savedTranscription.model,
                      speakerMap: savedTranscription.speakerMap ?? null,
                      createdAt: savedTranscription.createdAt.toISOString(),
                  }
                : null,
            job: serializeTranscriptionJob(job),
        });
    } catch (error) {
        console.error("Error fetching transcription state:", error);
        return NextResponse.json(
            { error: "Failed to fetch transcription state" },
            { status: 500 },
        );
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { id } = await params;
        const recording = await findOwnedRecording(session.user.id, id, {
            id: recordings.id,
            storagePath: recordings.storagePath,
            sourceProvider: recordings.sourceProvider,
        });
        if (!recording) {
            return NextResponse.json(
                { error: "Recording not found" },
                { status: 404 },
            );
        }

        const hasAudio = Boolean(recording.storagePath?.trim());
        if (
            !canRecordingUsePrivateTranscribe({
                sourceProvider: recording.sourceProvider,
                hasAudio,
            })
        ) {
            return NextResponse.json(
                {
                    error: getPrivateTranscriptionUnsupportedError(
                        recording.sourceProvider,
                        hasAudio,
                    ),
                },
                { status: 400 },
            );
        }

        let force = false;
        try {
            const body = await request.json();
            force = body?.force === true;
        } catch {
            // Ignore invalid or missing JSON bodies.
        }

        const [savedTranscription, canTranscribe] = await Promise.all([
            getSavedTranscription(id),
            hasTranscriptionCapability(session.user.id),
        ]);

        if (!canTranscribe) {
            return NextResponse.json(
                { error: "No transcription API configured" },
                { status: 400 },
            );
        }

        if (savedTranscription && !force) {
            return NextResponse.json({
                queued: false,
                transcript: {
                    text: savedTranscription.text,
                    detectedLanguage: savedTranscription.detectedLanguage,
                    transcriptionType: savedTranscription.transcriptionType,
                    provider: savedTranscription.provider,
                    model: savedTranscription.model,
                    speakerMap: savedTranscription.speakerMap ?? null,
                    createdAt: savedTranscription.createdAt.toISOString(),
                },
                job: serializeTranscriptionJob(
                    await getTranscriptionJobForRecording(session.user.id, id),
                ),
            });
        }

        await enqueueTranscriptionJobs(session.user.id, [id], { force });
        const job = await getTranscriptionJobForRecording(session.user.id, id);

        return NextResponse.json(
            {
                queued: true,
                job: serializeTranscriptionJob(job),
            },
            { status: 202 },
        );
    } catch (error) {
        console.error("Error queueing transcription:", error);
        return NextResponse.json(
            { error: "Failed to queue transcription job" },
            { status: 500 },
        );
    }
}
