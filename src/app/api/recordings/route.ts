import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";
import { auth } from "@/lib/auth";

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

        const userRecordings = await db
            .select()
            .from(recordings)
            .where(eq(recordings.userId, session.user.id))
            .orderBy(desc(recordings.startTime));

        return NextResponse.json({ recordings: userRecordings });
    } catch (error) {
        console.error("Error fetching recordings:", error);
        return NextResponse.json(
            { error: "Failed to fetch recordings" },
            { status: 500 },
        );
    }
}
