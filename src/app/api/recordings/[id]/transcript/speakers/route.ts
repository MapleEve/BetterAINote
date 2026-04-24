import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecordingSpeakerTranscriptReadResponse } from "@/server/modules/recordings";

function noStoreJson(body: unknown, init?: ResponseInit) {
    return NextResponse.json(body, {
        ...init,
        headers: {
            "Cache-Control": "private, no-store",
            ...(init?.headers ?? {}),
        },
    });
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return noStoreJson({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const result = await getRecordingSpeakerTranscriptReadResponse(
            session.user.id,
            id,
        );
        return noStoreJson(result.body, { status: result.status });
    } catch (error) {
        console.error("Error fetching speaker transcript:", error);
        return noStoreJson(
            { error: "Failed to fetch speaker transcript" },
            { status: 500 },
        );
    }
}
