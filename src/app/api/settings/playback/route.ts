import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/settings/user-settings";
import { SettingsValidationError } from "@/lib/settings/validation";
import {
    getPlaybackSettingsStateForUser,
    savePlaybackSettingsForUser,
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

        const settings = await getPlaybackSettingsStateForUser(userId);
        return NextResponse.json(settings);
    } catch (error) {
        console.error("Error fetching playback settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch playback settings" },
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
        await savePlaybackSettingsForUser(userId, body);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof SettingsValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        console.error("Error updating playback settings:", error);
        return NextResponse.json(
            { error: "Failed to update playback settings" },
            { status: 500 },
        );
    }
}
