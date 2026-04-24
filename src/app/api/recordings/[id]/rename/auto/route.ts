import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    autoRenameRecording,
    RecordingRenameError,
} from "@/server/modules/recordings";

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
        const result = await autoRenameRecording(session.user.id, id);

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof RecordingRenameError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error auto-renaming recording:", error);
        return NextResponse.json(
            { error: "Failed to auto-rename recording" },
            { status: 500 },
        );
    }
}
