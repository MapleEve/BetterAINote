import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    deleteSpeakerProfileForUser,
    SpeakerProfileError,
    updateSpeakerProfileForUser,
} from "@/server/modules/speakers";

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
        const profile = await updateSpeakerProfileForUser(
            session.user.id,
            id,
            await request.json(),
        );

        return NextResponse.json({ profile });
    } catch (error) {
        if (error instanceof SpeakerProfileError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

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
        const result = await deleteSpeakerProfileForUser(session.user.id, id);

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof SpeakerProfileError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error deleting speaker profile:", error);
        return NextResponse.json(
            { error: "Failed to delete speaker profile" },
            { status: 500 },
        );
    }
}
