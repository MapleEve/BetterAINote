import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { recordingSpeakers, speakerProfiles } from "@/db/schema/voiceprints";
import { auth } from "@/lib/auth";
import { createSpeakerProfile } from "@/lib/speakers";

function noStoreJson(body: unknown, init?: ResponseInit) {
    return NextResponse.json(body, {
        ...init,
        headers: {
            "Cache-Control": "private, no-store",
            ...(init?.headers ?? {}),
        },
    });
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

export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return noStoreJson({ error: "Unauthorized" }, { status: 401 });
        }

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
                .where(eq(speakerProfiles.userId, session.user.id)),
            db
                .select({
                    matchedProfileId: recordingSpeakers.matchedProfileId,
                })
                .from(recordingSpeakers)
                .where(eq(recordingSpeakers.userId, session.user.id)),
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

        return noStoreJson({
            profiles: profiles
                .map((profile) =>
                    serializeSpeakerProfile(
                        profile,
                        assignmentCounts[profile.id] ?? 0,
                    ),
                )
                .sort((left, right) =>
                    left.displayName.localeCompare(right.displayName),
                ),
        });
    } catch (error) {
        console.error("Error fetching speaker profiles:", error);
        return noStoreJson(
            { error: "Failed to fetch speaker profiles" },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
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

        const body = await request.json();
        const displayName =
            typeof body.displayName === "string" ? body.displayName.trim() : "";
        const voiceprintRef =
            typeof body.voiceprintRef === "string"
                ? body.voiceprintRef.trim()
                : null;

        if (!displayName) {
            return NextResponse.json(
                { error: "displayName is required" },
                { status: 400 },
            );
        }

        const profile = await createSpeakerProfile(
            session.user.id,
            displayName,
            voiceprintRef,
        );

        return NextResponse.json({
            profile: serializeSpeakerProfile(profile, 0),
        });
    } catch (error) {
        console.error("Error creating speaker profile:", error);
        return NextResponse.json(
            { error: "Failed to create speaker profile" },
            { status: 500 },
        );
    }
}
