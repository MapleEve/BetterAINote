import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    RecordingRenameError,
    renameRecording,
} from "@/server/modules/recordings";

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
        const { filename } = body;

        const result = await renameRecording(session.user.id, id, filename);

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof RecordingRenameError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error renaming recording:", error);
        return NextResponse.json(
            { error: "Failed to rename recording" },
            { status: 500 },
        );
    }
}
