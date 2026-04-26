import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    getRecordingSourceReport,
    RecordingSourceReportError,
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
        return noStoreJson(await getRecordingSourceReport(session.user.id, id));
    } catch (error) {
        if (error instanceof RecordingSourceReportError) {
            return noStoreJson(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error loading source report:", error);
        return noStoreJson(
            { error: "Failed to load source report" },
            { status: 500 },
        );
    }
}
