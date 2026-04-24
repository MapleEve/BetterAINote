import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";
import { transcriptions } from "@/db/schema/transcripts";
import { recordingSpeakers, speakerProfiles } from "@/db/schema/voiceprints";
import {
    applySpeakerProfileToRecording,
    buildSpeakerReviewSnapshot,
    createSpeakerProfile,
} from "@/lib/speakers";
import { VoiceTranscribeHttpError } from "@/lib/voice-transcribe/client";
import { getPublicVoiceTranscribeErrorMessage } from "@/lib/voice-transcribe/public-errors";
import { getVoiceTranscribeAccessForUser } from "@/lib/voice-transcribe/service";
import { findOwnedRecording } from "./ownership";

export class RecordingSpeakersError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = "RecordingSpeakersError";
    }
}

function serializeSpeakerProfile(profile: {
    id: string;
    displayName: string;
    voiceprintRef: string | null;
    hasVoiceprint?: boolean;
}) {
    return {
        id: profile.id,
        displayName: profile.displayName,
        voiceprintRef: profile.voiceprintRef,
        hasVoiceprint:
            typeof profile.hasVoiceprint === "boolean"
                ? profile.hasVoiceprint
                : Boolean(profile.voiceprintRef),
    };
}

async function assertOwnedRecording(userId: string, recordingId: string) {
    const recording = await findOwnedRecording(userId, recordingId, {
        id: recordings.id,
    });

    if (!recording) {
        throw new RecordingSpeakersError("Recording not found", 404);
    }
}

function parseRecordingSpeakerUpdateInput(body: unknown) {
    const payload =
        body && typeof body === "object" && !Array.isArray(body)
            ? (body as Record<string, unknown>)
            : {};

    const rawLabel =
        typeof payload.rawLabel === "string" ? payload.rawLabel.trim() : "";
    const profileId =
        typeof payload.profileId === "string" ? payload.profileId : null;
    const profileName =
        typeof payload.profileName === "string"
            ? payload.profileName.trim()
            : "";
    const voiceprintRef =
        typeof payload.voiceprintRef === "string"
            ? payload.voiceprintRef.trim()
            : null;

    if (!rawLabel) {
        throw new RecordingSpeakersError("rawLabel is required", 400);
    }

    return {
        rawLabel,
        profileId,
        profileName,
        voiceprintRef,
    };
}

async function updateSpeakerProfileVoiceprintRef(input: {
    userId: string;
    profileId: string;
    voiceprintRef: string | null;
}) {
    await db
        .update(speakerProfiles)
        .set({
            voiceprintRef: input.voiceprintRef,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(speakerProfiles.id, input.profileId),
                eq(speakerProfiles.userId, input.userId),
            ),
        );
}

function normalizeVoiceTranscribeError(error: unknown): never {
    if (error instanceof VoiceTranscribeHttpError) {
        console.error("Voiceprint enrollment provider request failed:", error);
        throw new RecordingSpeakersError(
            getPublicVoiceTranscribeErrorMessage(error),
            error.status === 404 ? 404 : 502,
        );
    }

    throw error;
}

export async function getRecordingSpeakersReview(
    userId: string,
    recordingId: string,
) {
    await assertOwnedRecording(userId, recordingId);

    const [speakers, profiles] = await Promise.all([
        db
            .select({
                rawLabel: recordingSpeakers.rawLabel,
                matchedProfileId: recordingSpeakers.matchedProfileId,
                sampleSegments: recordingSpeakers.sampleSegments,
                segmentCount: recordingSpeakers.segmentCount,
                updatedAt: recordingSpeakers.updatedAt,
            })
            .from(recordingSpeakers)
            .where(eq(recordingSpeakers.recordingId, recordingId)),
        db
            .select({
                id: speakerProfiles.id,
                displayName: speakerProfiles.displayName,
                voiceprintRef: speakerProfiles.voiceprintRef,
            })
            .from(speakerProfiles)
            .where(eq(speakerProfiles.userId, userId)),
    ]);

    const snapshot = buildSpeakerReviewSnapshot({
        speakers,
        profiles,
    });

    return {
        recordingId,
        reviewBasis: snapshot.reviewBasis,
        rawTranscriptUrl: `/api/recordings/${recordingId}/transcript/raw`,
        speakerTranscriptUrl: `/api/recordings/${recordingId}/transcript/speakers`,
        speakers: snapshot.speakers,
        profiles: snapshot.profiles.map(serializeSpeakerProfile),
    };
}

export async function updateRecordingSpeakerReview(
    userId: string,
    recordingId: string,
    body: unknown,
) {
    const input = parseRecordingSpeakerUpdateInput(body);
    await assertOwnedRecording(userId, recordingId);

    const [transcription] = await db
        .select({
            provider: transcriptions.provider,
            providerJobId: transcriptions.providerJobId,
        })
        .from(transcriptions)
        .where(eq(transcriptions.recordingId, recordingId))
        .limit(1);

    if (!input.profileId && !input.profileName) {
        await applySpeakerProfileToRecording({
            recordingId,
            rawLabel: input.rawLabel,
            profileId: null,
        });

        return {
            success: true as const,
            rawLabel: input.rawLabel,
            profileId: null,
            voiceprintRef: null,
        };
    }

    let existingProfile:
        | {
              id: string;
              displayName: string;
              voiceprintRef: string | null;
          }
        | undefined;

    if (input.profileId) {
        [existingProfile] = await db
            .select({
                id: speakerProfiles.id,
                displayName: speakerProfiles.displayName,
                voiceprintRef: speakerProfiles.voiceprintRef,
            })
            .from(speakerProfiles)
            .where(
                and(
                    eq(speakerProfiles.id, input.profileId),
                    eq(speakerProfiles.userId, userId),
                ),
            )
            .limit(1);

        if (!existingProfile) {
            throw new RecordingSpeakersError("Speaker profile not found", 404);
        }
    }

    const resolvedDisplayName = (
        existingProfile?.displayName || input.profileName
    ).trim();

    if (!resolvedDisplayName) {
        throw new RecordingSpeakersError("profileName is required", 400);
    }

    let resolvedVoiceprintRef =
        existingProfile?.voiceprintRef || input.voiceprintRef || null;

    const shouldEnrollRemote =
        transcription?.provider === "voice-transcribe" &&
        typeof transcription.providerJobId === "string" &&
        transcription.providerJobId.trim().length > 0;

    if (shouldEnrollRemote) {
        const providerJobId = transcription.providerJobId;

        if (
            typeof providerJobId !== "string" ||
            providerJobId.trim().length < 1
        ) {
            throw new RecordingSpeakersError(
                "Private transcription result is missing a job ID",
                409,
            );
        }

        const access = await getVoiceTranscribeAccessForUser(userId);

        if (!access.client) {
            throw new RecordingSpeakersError(
                access.reason ||
                    "Private transcription service is not configured",
                409,
            );
        }

        try {
            const enrollment = await access.client.enrollVoiceprint({
                transcriptionId: providerJobId,
                speakerLabel: input.rawLabel,
                speakerName: resolvedDisplayName,
                speakerId: resolvedVoiceprintRef,
            });

            resolvedVoiceprintRef = enrollment.speakerId;
        } catch (error) {
            normalizeVoiceTranscribeError(error);
        }
    }

    let resolvedProfileId = input.profileId;

    if (!resolvedProfileId && input.profileName) {
        const profile = await createSpeakerProfile(
            userId,
            input.profileName,
            resolvedVoiceprintRef,
        );
        resolvedProfileId = profile.id;
        resolvedVoiceprintRef = profile.voiceprintRef;
    } else if (
        resolvedProfileId &&
        (existingProfile?.voiceprintRef ?? null) !== resolvedVoiceprintRef
    ) {
        await updateSpeakerProfileVoiceprintRef({
            userId,
            profileId: resolvedProfileId,
            voiceprintRef: resolvedVoiceprintRef,
        });
    }

    await applySpeakerProfileToRecording({
        recordingId,
        rawLabel: input.rawLabel,
        profileId: resolvedProfileId,
    });

    return {
        success: true as const,
        rawLabel: input.rawLabel,
        profileId: resolvedProfileId,
        voiceprintRef: resolvedVoiceprintRef,
    };
}
