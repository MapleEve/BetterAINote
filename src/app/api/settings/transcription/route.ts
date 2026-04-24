import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/settings/user-settings";
import { SettingsValidationError } from "@/lib/settings/validation";
import {
    getTranscriptionSettingsStateForUser,
    saveTranscriptionSettingsForUser,
} from "@/server/modules/settings";

export async function GET(request: Request) {
    try {
        const userId = await getAuthenticatedUserId(request);
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const settings = await getTranscriptionSettingsStateForUser(userId);
        return NextResponse.json(settings);
    } catch (error) {
        console.error("Error fetching transcription settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch transcription settings" },
            { status: 500 },
        );
    }
}

export async function PUT(request: Request) {
    try {
        const userId = await getAuthenticatedUserId(request);
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const body = (await request.json()) as Record<string, unknown>;
        await saveTranscriptionSettingsForUser(userId, body);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof SettingsValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        console.error("Error updating transcription settings:", error);
        return NextResponse.json(
            { error: "Failed to update transcription settings" },
            { status: 500 },
        );
    }
}
