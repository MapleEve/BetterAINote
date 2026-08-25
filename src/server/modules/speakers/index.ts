import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, voiceprintsDb, withVoiceprintsWriteTransaction } from "@/db";
import {
    recordingSpeakers,
    speakerProfileRetryAuthorizations,
    speakerProfiles,
} from "@/db/schema/voiceprints";
import { env } from "@/lib/env";
import { isTestRuntime } from "@/lib/platform/runtime";
import {
    enqueueSearchDeleteJob,
    enqueueSearchIndexJob,
} from "@/server/modules/search/indexer";

export class SpeakerProfileError extends Error {
    constructor(
        message: string,
        public readonly status = 400,
    ) {
        super(message);
        this.name = "SpeakerProfileError";
    }
}

export type SpeakerProfileMutation = "create" | "update" | "delete";

export type SpeakerProfileRetryDescriptor = {
    mutation: SpeakerProfileMutation;
    profileId: string;
};

type SpeakerProfileRetryAuthorization = {
    v: 2;
    i: string;
    n: string;
    u: string;
    m: SpeakerProfileMutation;
    p: string;
    e: number;
};

type PersistedRetryAuthorization = {
    id: string;
    nonce: string;
    userId: string;
    mutation: SpeakerProfileMutation;
    profileId: string;
    expiresAt: Date;
};

const SPEAKER_PROFILE_RETRY_AUTHORIZATION_TTL_MS = 5 * 60 * 1000;
const TEST_SPEAKER_PROFILE_RETRY_AUTHORIZATION_SECRET =
    "betterainote-test-speaker-profile-retry-authorization-secret";

export class SpeakerProfileCommittedWriteFollowupError extends Error {
    readonly code = "SPEAKER_PROFILE_WRITE_COMMITTED_INDEX_FOLLOWUP_FAILED";
    readonly status = 503;

    constructor(public readonly retry?: SpeakerProfileRetryDescriptor) {
        super("Speaker profile was saved, but search indexing needs retry");
        this.name = "SpeakerProfileCommittedWriteFollowupError";
    }
}

function getSpeakerProfileRetryAuthorizationSecret() {
    if (env.BETTER_AUTH_SECRET) {
        return env.BETTER_AUTH_SECRET;
    }

    if (isTestRuntime()) {
        return TEST_SPEAKER_PROFILE_RETRY_AUTHORIZATION_SECRET;
    }

    throw new Error(
        "BETTER_AUTH_SECRET is required to authorize speaker profile retries",
    );
}

function signSpeakerProfileRetryAuthorization(payload: string) {
    return createHmac("sha256", getSpeakerProfileRetryAuthorizationSecret())
        .update(`speaker-profile-retry.v2.${payload}`)
        .digest("base64url");
}

function createRetryDescriptor(
    authorization: PersistedRetryAuthorization,
): SpeakerProfileRetryDescriptor {
    const payload = Buffer.from(
        JSON.stringify({
            v: 2,
            i: authorization.id,
            n: authorization.nonce,
            u: authorization.userId,
            m: authorization.mutation,
            p: authorization.profileId,
            e: authorization.expiresAt.getTime(),
        } satisfies SpeakerProfileRetryAuthorization),
    ).toString("base64url");

    return {
        mutation: authorization.mutation,
        profileId: `${payload}.${signSpeakerProfileRetryAuthorization(payload)}`,
    };
}

function invalidRetryAuthorization(): never {
    throw new SpeakerProfileError(
        "Invalid speaker profile retry operation",
        400,
    );
}

function parseSpeakerProfileRetryDescriptor(
    userId: string,
    input: unknown,
): SpeakerProfileRetryAuthorization {
    if (!input || typeof input !== "object") {
        return invalidRetryAuthorization();
    }

    const { mutation, profileId } = input as Record<string, unknown>;
    if (
        (mutation !== "create" &&
            mutation !== "update" &&
            mutation !== "delete") ||
        typeof profileId !== "string" ||
        !profileId
    ) {
        return invalidRetryAuthorization();
    }

    const [encodedPayload, signature, ...extraParts] = profileId.split(".");
    if (!encodedPayload || !signature || extraParts.length > 0) {
        return invalidRetryAuthorization();
    }

    const expectedSignature =
        signSpeakerProfileRetryAuthorization(encodedPayload);
    const receivedSignature = Buffer.from(signature, "base64url");
    const expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");
    if (
        receivedSignature.length !== expectedSignatureBuffer.length ||
        !timingSafeEqual(receivedSignature, expectedSignatureBuffer)
    ) {
        return invalidRetryAuthorization();
    }

    let authorization: SpeakerProfileRetryAuthorization;
    try {
        authorization = JSON.parse(
            Buffer.from(encodedPayload, "base64url").toString("utf8"),
        ) as SpeakerProfileRetryAuthorization;
    } catch {
        return invalidRetryAuthorization();
    }

    if (
        authorization.v !== 2 ||
        authorization.i.length === 0 ||
        authorization.n.length === 0 ||
        authorization.u !== userId ||
        authorization.m !== mutation ||
        typeof authorization.p !== "string" ||
        !authorization.p ||
        typeof authorization.e !== "number" ||
        authorization.e <= Date.now()
    ) {
        return invalidRetryAuthorization();
    }

    return authorization;
}

function buildRetryAuthorization(
    userId: string,
    mutation: SpeakerProfileMutation,
    profileId: string,
): PersistedRetryAuthorization {
    return {
        id: nanoid(),
        nonce: randomBytes(32).toString("base64url"),
        userId,
        mutation,
        profileId,
        expiresAt: new Date(
            Date.now() + SPEAKER_PROFILE_RETRY_AUTHORIZATION_TTL_MS,
        ),
    };
}

async function getPendingRetryAuthorization(
    userId: string,
    input: unknown,
): Promise<PersistedRetryAuthorization> {
    const authorization = parseSpeakerProfileRetryDescriptor(userId, input);
    const expiresAt = new Date(authorization.e);
    const [pending] = await voiceprintsDb
        .select({ id: speakerProfileRetryAuthorizations.id })
        .from(speakerProfileRetryAuthorizations)
        .where(
            and(
                eq(speakerProfileRetryAuthorizations.id, authorization.i),
                eq(speakerProfileRetryAuthorizations.userId, authorization.u),
                eq(speakerProfileRetryAuthorizations.mutation, authorization.m),
                eq(
                    speakerProfileRetryAuthorizations.profileId,
                    authorization.p,
                ),
                eq(speakerProfileRetryAuthorizations.nonce, authorization.n),
                eq(speakerProfileRetryAuthorizations.expiresAt, expiresAt),
                isNull(speakerProfileRetryAuthorizations.consumedAt),
            ),
        )
        .limit(1);

    if (!pending) {
        return invalidRetryAuthorization();
    }

    return {
        id: authorization.i,
        nonce: authorization.n,
        userId: authorization.u,
        mutation: authorization.m,
        profileId: authorization.p,
        expiresAt,
    };
}

async function completeRetryAuthorization(
    authorization: PersistedRetryAuthorization,
) {
    const [completed] = await voiceprintsDb
        .update(speakerProfileRetryAuthorizations)
        .set({ consumedAt: new Date(), updatedAt: new Date() })
        .where(
            and(
                eq(speakerProfileRetryAuthorizations.id, authorization.id),
                eq(
                    speakerProfileRetryAuthorizations.nonce,
                    authorization.nonce,
                ),
                isNull(speakerProfileRetryAuthorizations.consumedAt),
            ),
        )
        .returning({ id: speakerProfileRetryAuthorizations.id });

    return Boolean(completed);
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

function retryJobKey(authorizationId: string, suffix: string) {
    return `${authorizationId}:${suffix}`;
}

async function enqueueSpeakerVisibleSearchWrites(
    userId: string,
    profileId: string,
    authorizationId: string,
) {
    await enqueueSearchIndexJob({
        userId,
        entityType: "speaker",
        entityId: profileId,
        idempotencyKey: retryJobKey(authorizationId, "speaker"),
    });

    const assignments = await db
        .select({ recordingId: recordingSpeakers.recordingId })
        .from(recordingSpeakers)
        .where(
            and(
                eq(recordingSpeakers.userId, userId),
                eq(recordingSpeakers.matchedProfileId, profileId),
            ),
        );

    const recordingIds = [
        ...new Set(assignments.map((row) => row.recordingId)),
    ];
    await Promise.all(
        recordingIds.map((recordingId) =>
            enqueueSearchIndexJob({
                userId,
                entityType: "recording",
                entityId: recordingId,
                idempotencyKey: retryJobKey(
                    authorizationId,
                    `recording:${recordingId}`,
                ),
            }),
        ),
    );
}

async function enqueueSpeakerFollowup(
    authorization: PersistedRetryAuthorization,
) {
    if (authorization.mutation === "delete") {
        await enqueueSearchDeleteJob({
            userId: authorization.userId,
            entityType: "speaker",
            entityId: authorization.profileId,
            idempotencyKey: retryJobKey(authorization.id, "delete"),
        });
        return;
    }

    if (authorization.mutation === "create") {
        await enqueueSearchIndexJob({
            userId: authorization.userId,
            entityType: "speaker",
            entityId: authorization.profileId,
            idempotencyKey: retryJobKey(authorization.id, "speaker"),
        });
        return;
    }

    await enqueueSpeakerVisibleSearchWrites(
        authorization.userId,
        authorization.profileId,
        authorization.id,
    );
}

async function enqueueCommittedWriteFollowup(
    authorization: PersistedRetryAuthorization,
) {
    try {
        await enqueueSpeakerFollowup(authorization);
        await completeRetryAuthorization(authorization);
    } catch {
        throw new SpeakerProfileCommittedWriteFollowupError(
            createRetryDescriptor(authorization),
        );
    }
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
            .select({ matchedProfileId: recordingSpeakers.matchedProfileId })
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

    const { authorization, profile } = await withVoiceprintsWriteTransaction(
        async (tx) => {
            const [profile] = await tx
                .insert(speakerProfiles)
                .values({
                    userId,
                    displayName,
                    voiceprintRef,
                })
                .onConflictDoUpdate({
                    target: [
                        speakerProfiles.userId,
                        speakerProfiles.displayName,
                    ],
                    set: {
                        voiceprintRef,
                        updatedAt: new Date(),
                    },
                })
                .returning();

            const authorization = buildRetryAuthorization(
                userId,
                "create",
                profile.id,
            );
            await tx
                .insert(speakerProfileRetryAuthorizations)
                .values(authorization);

            return { authorization, profile };
        },
    );

    await enqueueCommittedWriteFollowup(authorization);

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

    const mutation = await withVoiceprintsWriteTransaction(async (tx) => {
        const [profile] = await tx
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

        const authorization = buildRetryAuthorization(
            userId,
            "update",
            profile.id,
        );
        await tx
            .insert(speakerProfileRetryAuthorizations)
            .values(authorization);
        return { authorization, profile };
    });

    await enqueueCommittedWriteFollowup(mutation.authorization);
    return serializeSpeakerProfile(mutation.profile, 0);
}

export async function deleteSpeakerProfileForUser(
    userId: string,
    profileId: string,
) {
    const mutation = await withVoiceprintsWriteTransaction(async (tx) => {
        const [profile] = await tx
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

        const authorization = buildRetryAuthorization(
            userId,
            "delete",
            profile.id,
        );
        await tx
            .insert(speakerProfileRetryAuthorizations)
            .values(authorization);
        return { authorization, profile };
    });

    await enqueueCommittedWriteFollowup(mutation.authorization);
    return { success: true };
}

export async function retrySpeakerProfileSearchFollowupForUser(
    userId: string,
    input: unknown,
) {
    const authorization = await getPendingRetryAuthorization(userId, input);

    let completed: boolean;
    try {
        await enqueueSpeakerFollowup(authorization);
        completed = await completeRetryAuthorization(authorization);
    } catch {
        throw new SpeakerProfileCommittedWriteFollowupError(
            createRetryDescriptor(authorization),
        );
    }

    if (!completed) {
        return invalidRetryAuthorization();
    }

    return { success: true };
}
