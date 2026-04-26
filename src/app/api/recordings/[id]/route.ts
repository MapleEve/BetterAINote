import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    deleteRecordingForUser,
    getRecordingDetailReadModel,
    RecordingDeleteError,
} from "@/server/modules/recordings";

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
        const detail = await getRecordingDetailReadModel(session.user.id, id);
        const recording = detail?.recording;

        if (!recording) {
            return NextResponse.json(
                { error: "Recording not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({
            recording,
            transcription: detail.transcription,
            enhancement: null,
        });
    } catch (error) {
        console.error("Error fetching recording:", error);
        return NextResponse.json(
            { error: "Failed to fetch recording" },
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
        const result = await deleteRecordingForUser(session.user.id, id);

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof RecordingDeleteError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error deleting recording:", error);
        return NextResponse.json(
            { error: "Failed to delete recording" },
            { status: 500 },
        );
    }
}
