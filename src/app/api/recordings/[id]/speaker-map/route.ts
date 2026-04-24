import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    getRecordingSpeakerMap,
    RecordingSpeakerMapError,
    updateRecordingSpeakerMap,
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
        const result = await getRecordingSpeakerMap(session.user.id, id);
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof RecordingSpeakerMapError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error fetching speaker map:", error);
        return NextResponse.json(
            { error: "Failed to fetch speaker map" },
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
        const body = await request.json();
        const result = await updateRecordingSpeakerMap(
            session.user.id,
            id,
            body.speakerMap,
        );
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof RecordingSpeakerMapError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error updating speaker map:", error);
        return NextResponse.json(
            { error: "Failed to update speaker map" },
            { status: 500 },
        );
    }
}
