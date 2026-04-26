import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listRecordingsForUser } from "@/server/modules/recordings";

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

        const userRecordings = await listRecordingsForUser(session.user.id);

        return NextResponse.json({ recordings: userRecordings });
    } catch (error) {
        console.error("Error fetching recordings:", error);
        return NextResponse.json(
            { error: "Failed to fetch recordings" },
            { status: 500 },
        );
    }
}
