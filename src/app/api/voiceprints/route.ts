import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { VoiceTranscribeHttpError } from "@/lib/voice-transcribe/client";
import { getPublicVoiceTranscribeErrorMessage } from "@/lib/voice-transcribe/public-errors";
import { getVoiceTranscribeAccessForUser } from "@/lib/voice-transcribe/service";

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

        const access = await getVoiceTranscribeAccessForUser(session.user.id);
        if (!access.client || !access.connection) {
            return NextResponse.json({
                available: false,
                reason: access.reason,
                voiceprints: [],
            });
        }

        const voiceprints = await access.client.listVoiceprints();

        return NextResponse.json({
            available: true,
            providerName: access.connection.providerName,
            reason: null,
            voiceprints,
        });
    } catch (error) {
        if (error instanceof VoiceTranscribeHttpError) {
            console.error("Voiceprint provider request failed:", error);
            return NextResponse.json(
                { error: getPublicVoiceTranscribeErrorMessage(error) },
                { status: 502 },
            );
        }

        console.error("Error fetching voiceprints:", error);
        return NextResponse.json(
            { error: "Failed to fetch remote voiceprints" },
            { status: 500 },
        );
    }
}
