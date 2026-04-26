import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    RecordingTagError,
    updateRecordingTagAssignments,
} from "@/server/modules/recording-tags";

export async function PUT(
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
        const orderedTags = await updateRecordingTagAssignments(
            session.user.id,
            id,
            await request.json(),
        );

        return NextResponse.json({ tags: orderedTags });
    } catch (error) {
        if (error instanceof RecordingTagError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error updating recording tags:", error);
        return NextResponse.json(
            { error: "Failed to update recording tags" },
            { status: 500 },
        );
    }
}
