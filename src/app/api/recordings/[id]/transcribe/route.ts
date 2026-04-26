import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    getRecordingTranscriptionState,
    queueRecordingTranscription,
    RecordingTranscriptionError,
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
        const state = await getRecordingTranscriptionState(session.user.id, id);

        return NextResponse.json(state);
    } catch (error) {
        if (error instanceof RecordingTranscriptionError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

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
        let force = false;
        try {
            const body = await request.json();
            force = body?.force === true;
        } catch {
            // Ignore invalid or missing JSON bodies.
        }

        const result = await queueRecordingTranscription(session.user.id, id, {
            force,
        });

        return NextResponse.json(result.body, { status: result.status });
    } catch (error) {
        if (error instanceof RecordingTranscriptionError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error queueing transcription:", error);
        return NextResponse.json(
            { error: "Failed to queue transcription job" },
            { status: 500 },
        );
    }
}
