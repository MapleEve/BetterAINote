import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { speakerProfiles } from "@/db/schema/voiceprints";
import { auth } from "@/lib/auth";

export async function PATCH(
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
        const body = await request.json();
        const displayName =
            typeof body.displayName === "string" ? body.displayName.trim() : "";
        const voiceprintRef =
            typeof body.voiceprintRef === "string"
                ? body.voiceprintRef.trim()
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
                    eq(speakerProfiles.id, id),
                    eq(speakerProfiles.userId, session.user.id),
                ),
            )
            .returning();

        if (!profile) {
            return NextResponse.json(
                { error: "Speaker profile not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({ profile });
    } catch (error) {
        console.error("Error updating speaker profile:", error);
        return NextResponse.json(
            { error: "Failed to update speaker profile" },
            { status: 500 },
        );
    }
}

export async function DELETE(
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
        const [profile] = await db
            .delete(speakerProfiles)
            .where(
                and(
                    eq(speakerProfiles.id, id),
                    eq(speakerProfiles.userId, session.user.id),
                ),
            )
            .returning({ id: speakerProfiles.id });

        if (!profile) {
            return NextResponse.json(
                { error: "Speaker profile not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting speaker profile:", error);
        return NextResponse.json(
            { error: "Failed to delete speaker profile" },
            { status: 500 },
        );
    }
}
