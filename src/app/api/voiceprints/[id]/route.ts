import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { VoiceTranscribeHttpError } from "@/lib/voice-transcribe/client";
import { getPublicVoiceTranscribeErrorMessage } from "@/lib/voice-transcribe/public-errors";
import { getVoiceTranscribeAccessForUser } from "@/lib/voice-transcribe/service";

function mapVoiceTranscribeError(error: VoiceTranscribeHttpError) {
    const status =
        error.status === 404
            ? 404
            : error.status === 400 || error.status === 422
              ? 400
              : 502;

    console.error("Voiceprint provider request failed:", error);
    return NextResponse.json(
        { error: getPublicVoiceTranscribeErrorMessage(error) },
        { status },
    );
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

        const access = await getVoiceTranscribeAccessForUser(session.user.id);
        if (!access.client) {
            return NextResponse.json(
                {
                    error:
                        access.reason || "Voice-transcribe is not configured",
                },
                { status: 409 },
            );
        }

        const { id } = await params;
        const body = await request.json();
        const displayName =
            typeof body.displayName === "string" ? body.displayName.trim() : "";

        if (!displayName) {
            return NextResponse.json(
                { error: "displayName is required" },
                { status: 400 },
            );
        }

        const voiceprint = await access.client.renameVoiceprint(
            id,
            displayName,
        );

        return NextResponse.json({ voiceprint });
    } catch (error) {
        if (error instanceof VoiceTranscribeHttpError) {
            return mapVoiceTranscribeError(error);
        }

        console.error("Error renaming voiceprint:", error);
        return NextResponse.json(
            { error: "Failed to rename remote voiceprint" },
            { status: 500 },
        );
    }
}

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

        const access = await getVoiceTranscribeAccessForUser(session.user.id);
        if (!access.client) {
            return NextResponse.json(
                {
                    error:
                        access.reason || "Voice-transcribe is not configured",
                },
                { status: 409 },
            );
        }

        const { id } = await params;
        await access.client.deleteVoiceprint(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof VoiceTranscribeHttpError) {
            return mapVoiceTranscribeError(error);
        }

        console.error("Error deleting voiceprint:", error);
        return NextResponse.json(
            { error: "Failed to delete remote voiceprint" },
            { status: 500 },
        );
    }
}
