import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    createRecordingTag,
    listRecordingTags,
    RecordingTagError,
} from "@/server/modules/recording-tags";

export async function GET(request: Request) {
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

        const tags = await listRecordingTags(session.user.id);

        return NextResponse.json({ tags });
    } catch (error) {
        console.error("Error fetching recording tags:", error);
        return NextResponse.json(
            { error: "Failed to fetch recording tags" },
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

        const tag = await createRecordingTag(
            session.user.id,
            await request.json(),
        );

        return NextResponse.json({ tag });
    } catch (error) {
        if (error instanceof RecordingTagError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error creating recording tag:", error);
        return NextResponse.json(
            { error: "Failed to create recording tag" },
            { status: 500 },
        );
    }
}
