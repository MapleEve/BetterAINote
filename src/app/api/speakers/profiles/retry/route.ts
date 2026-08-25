import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    retrySpeakerProfileSearchFollowupForUser,
    SpeakerProfileCommittedWriteFollowupError,
    SpeakerProfileError,
} from "@/server/modules/speakers";

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

        const result = await retrySpeakerProfileSearchFollowupForUser(
            session.user.id,
            await request.json(),
        );

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof SpeakerProfileCommittedWriteFollowupError) {
            return NextResponse.json(
                {
                    error: error.message,
                    code: error.code,
                    ...(error.retry ? { retry: error.retry } : {}),
                },
                { status: error.status },
            );
        }

        if (error instanceof SpeakerProfileError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error retrying speaker profile search indexing:", error);
        return NextResponse.json(
            { error: "Failed to retry speaker profile search indexing" },
            { status: 500 },
        );
    }
}
