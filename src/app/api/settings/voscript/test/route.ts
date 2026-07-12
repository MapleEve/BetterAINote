import { NextResponse } from "next/server";
import { normalizePrivateTranscriptionBaseUrlSetting } from "@/lib/settings/service-url-settings";
import { getAuthenticatedUserId } from "@/lib/settings/user-settings";
import { SettingsValidationError } from "@/lib/settings/validation";
import { VoiceTranscribeHttpError } from "@/lib/voice-transcribe/client";
import { getPublicVoiceTranscribeErrorMessage } from "@/lib/voice-transcribe/public-errors";
import { testVoiceTranscribeConnectionForUser } from "@/server/modules/voice-transcribe/connection-test";

function normalizeRawApiKey(value: unknown) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value !== "string") {
        throw new SettingsValidationError(
            "privateTranscriptionApiKey must be a string or null",
        );
    }

    return value.trim() || null;
}

export async function POST(request: Request) {
    try {
        const userId = await getAuthenticatedUserId(request);
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const body = (await request.json()) as Record<string, unknown>;
        const baseUrl = normalizePrivateTranscriptionBaseUrlSetting(
            body.privateTranscriptionBaseUrl,
        );
        if (!baseUrl) {
            return NextResponse.json(
                { error: "privateTranscriptionBaseUrl is required" },
                { status: 400 },
            );
        }

        return NextResponse.json(
            await testVoiceTranscribeConnectionForUser({
                apiKey: normalizeRawApiKey(body.privateTranscriptionApiKey),
                baseUrl,
                userId,
            }),
        );
    } catch (error) {
        if (error instanceof VoiceTranscribeHttpError) {
            console.error("VoScript connection test failed", {
                name: error.name,
                status: error.status,
            });
            return NextResponse.json(
                { error: getPublicVoiceTranscribeErrorMessage(error) },
                { status: 502 },
            );
        }

        if (error instanceof SettingsValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: "Request body must be valid JSON" },
                { status: 400 },
            );
        }

        console.error("Error testing VoScript connection:", error);
        return NextResponse.json(
            { error: "Failed to test VoScript connection" },
            { status: 500 },
        );
    }
}
