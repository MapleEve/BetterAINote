import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    createSpeakerProfileForUser,
    listSpeakerProfiles,
    SpeakerProfileError,
} from "@/server/modules/speakers";

function noStoreJson(body: unknown, init?: ResponseInit) {
    return NextResponse.json(body, {
        ...init,
        headers: {
            "Cache-Control": "private, no-store",
            ...(init?.headers ?? {}),
        },
    });
}

export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return noStoreJson({ error: "Unauthorized" }, { status: 401 });
        }

        return noStoreJson({
            profiles: await listSpeakerProfiles(session.user.id),
        });
    } catch (error) {
        console.error("Error fetching speaker profiles:", error);
        return noStoreJson(
            { error: "Failed to fetch speaker profiles" },
            { status: 500 },
        );
    }
}

export async function POST(request: Request) {
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

        const profile = await createSpeakerProfileForUser(
            session.user.id,
            await request.json(),
        );

        return NextResponse.json({ profile });
    } catch (error) {
        if (error instanceof SpeakerProfileError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("Error creating speaker profile:", error);
        return NextResponse.json(
            { error: "Failed to create speaker profile" },
            { status: 500 },
        );
    }
}
