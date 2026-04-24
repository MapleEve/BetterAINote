import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    getRecordingSpeakersReview,
    RecordingSpeakersError,
    updateRecordingSpeakerReview,
} from "@/server/modules/recordings";

function noStoreJson(body: unknown, init?: ResponseInit) {
    return NextResponse.json(body, {
        ...init,
        headers: {
            "Cache-Control": "private, no-store",
            ...(init?.headers ?? {}),
        },
    });
}

async function parseJsonBody(request: Request) {
    try {
        return await request.json();
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new RecordingSpeakersError(
                "Request body must be valid JSON",
                400,
            );
        }

        throw error;
    }
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
        const result = await getRecordingSpeakersReview(session.user.id, id);
        return noStoreJson(result);
    } catch (error) {
        if (error instanceof RecordingSpeakersError) {
            return noStoreJson(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error fetching recording speakers:", error);
        return noStoreJson(
            { error: "Failed to fetch recording speakers" },
            { status: 500 },
        );
    }
}

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
        const body = await parseJsonBody(request);
        const result = await updateRecordingSpeakerReview(
            session.user.id,
            id,
            body,
        );

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof RecordingSpeakersError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error updating recording speaker:", error);
        return NextResponse.json(
            { error: "Failed to update recording speaker" },
            { status: 500 },
        );
    }
}
