import { NextResponse } from "next/server";
import { normalizePrivateTranscriptionBaseUrlSetting } from "@/lib/settings/service-url-settings";
import { getAuthenticatedUserId } from "@/lib/settings/user-settings";
import { SettingsValidationError } from "@/lib/settings/validation";
import {
    VoiceTranscribeClient,
    VoiceTranscribeHttpError,
} from "@/lib/voice-transcribe/client";
import { getPublicVoiceTranscribeErrorMessage } from "@/lib/voice-transcribe/public-errors";
import { getVoiceTranscribeAccessForUser } from "@/server/modules/voice-transcribe/access";

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

async function resolveTestClient(params: {
    apiKey: string | null;
    baseUrl: string;
    userId: string;
}) {
    if (!params.apiKey) {
        const access = await getVoiceTranscribeAccessForUser(params.userId);
        if (
            access.client &&
            access.connection?.baseUrl.trim() === params.baseUrl
        ) {
            return access.client;
        }
    }

    return new VoiceTranscribeClient({
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
        providerId: "voscript-test",
        providerName: "voice-transcribe",
    });
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

        const apiKey = normalizeRawApiKey(body.privateTranscriptionApiKey);
        const client = await resolveTestClient({ apiKey, baseUrl, userId });
        const voiceprints = await client.listVoiceprints();

        return NextResponse.json({
            available: true,
            providerName: "voice-transcribe",
            success: true,
            voiceprintCount: voiceprints.length,
        });
    } catch (error) {
        if (error instanceof VoiceTranscribeHttpError) {
            console.error("VoScript connection test failed:", error);
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
