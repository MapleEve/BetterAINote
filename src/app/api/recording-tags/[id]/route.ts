import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    deleteRecordingTag,
    RecordingTagError,
} from "@/server/modules/recording-tags";

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
        const result = await deleteRecordingTag(session.user.id, id);

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof RecordingTagError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error deleting recording tag:", error);
        return NextResponse.json(
            { error: "Failed to delete recording tag" },
            { status: 500 },
        );
    }
}
