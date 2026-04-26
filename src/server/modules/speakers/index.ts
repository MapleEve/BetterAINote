import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recordingSpeakers, speakerProfiles } from "@/db/schema/voiceprints";
import { createSpeakerProfile } from "@/lib/speakers";

export class SpeakerProfileError extends Error {
    constructor(
        message: string,
        public readonly status = 400,
    ) {
        super(message);
        this.name = "SpeakerProfileError";
    }
}

function serializeSpeakerProfile(
    profile: {
        id: string;
        displayName: string;
        voiceprintRef: string | null;
        createdAt: Date;
        updatedAt: Date;
    },
    assignmentCount = 0,
) {
    return {
        id: profile.id,
        displayName: profile.displayName,
        voiceprintRef: profile.voiceprintRef,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
        assignmentCount,
    };
}

export async function listSpeakerProfiles(userId: string) {
    const [profiles, assignments] = await Promise.all([
        db
            .select({
                id: speakerProfiles.id,
                displayName: speakerProfiles.displayName,
                voiceprintRef: speakerProfiles.voiceprintRef,
                createdAt: speakerProfiles.createdAt,
                updatedAt: speakerProfiles.updatedAt,
            })
            .from(speakerProfiles)
            .where(eq(speakerProfiles.userId, userId)),
        db
            .select({
                matchedProfileId: recordingSpeakers.matchedProfileId,
            })
            .from(recordingSpeakers)
            .where(eq(recordingSpeakers.userId, userId)),
    ]);

    const assignmentCounts = assignments.reduce<Record<string, number>>(
        (counts, assignment) => {
            if (!assignment.matchedProfileId) {
                return counts;
            }

            counts[assignment.matchedProfileId] =
                (counts[assignment.matchedProfileId] ?? 0) + 1;
            return counts;
        },
        {},
    );

    return profiles
        .map((profile) =>
            serializeSpeakerProfile(profile, assignmentCounts[profile.id] ?? 0),
        )
        .sort((left, right) =>
            left.displayName.localeCompare(right.displayName),
        );
}

export async function createSpeakerProfileForUser(
    userId: string,
    input: {
        displayName?: unknown;
        voiceprintRef?: unknown;
    },
) {
    const displayName =
        typeof input.displayName === "string" ? input.displayName.trim() : "";
    const voiceprintRef =
        typeof input.voiceprintRef === "string"
            ? input.voiceprintRef.trim()
            : null;

    if (!displayName) {
        throw new SpeakerProfileError("displayName is required", 400);
    }

    const profile = await createSpeakerProfile(
        userId,
        displayName,
        voiceprintRef,
    );

    return serializeSpeakerProfile(profile, 0);
}

export async function updateSpeakerProfileForUser(
    userId: string,
    profileId: string,
    input: {
        displayName?: unknown;
        voiceprintRef?: unknown;
    },
) {
    const displayName =
        typeof input.displayName === "string" ? input.displayName.trim() : "";
    const voiceprintRef =
        typeof input.voiceprintRef === "string"
            ? input.voiceprintRef.trim()
            : null;

    const [profile] = await db
        .update(speakerProfiles)
        .set({
            ...(displayName ? { displayName } : {}),
            voiceprintRef: voiceprintRef || null,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(speakerProfiles.id, profileId),
                eq(speakerProfiles.userId, userId),
            ),
        )
        .returning();

    if (!profile) {
        throw new SpeakerProfileError("Speaker profile not found", 404);
    }

    return serializeSpeakerProfile(profile, 0);
}

export async function deleteSpeakerProfileForUser(
    userId: string,
    profileId: string,
) {
    const [profile] = await db
        .delete(speakerProfiles)
        .where(
            and(
                eq(speakerProfiles.id, profileId),
                eq(speakerProfiles.userId, userId),
            ),
        )
        .returning({ id: speakerProfiles.id });

    if (!profile) {
        throw new SpeakerProfileError("Speaker profile not found", 404);
    }

    return { success: true };
}
