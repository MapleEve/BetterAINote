import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";
import { auth } from "@/lib/auth";
import { createUserStorageProvider } from "@/lib/storage/factory";
import { getRecordingDetailReadModel } from "@/server/modules/recordings";

export async function GET(
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

        const { id } = await params;
        const detail = await getRecordingDetailReadModel(session.user.id, id);
        const recording = detail?.recording;

        if (!recording) {
            return NextResponse.json(
                { error: "Recording not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({
            recording,
            transcription: detail.transcription,
            enhancement: null,
        });
    } catch (error) {
        console.error("Error fetching recording:", error);
        return NextResponse.json(
            { error: "Failed to fetch recording" },
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

        const { id } = await params;

        const [recording] = await db
            .select()
            .from(recordings)
            .where(
                and(
                    eq(recordings.id, id),
                    eq(recordings.userId, session.user.id),
                ),
            )
            .limit(1);

        if (!recording) {
            return NextResponse.json(
                { error: "Recording not found" },
                { status: 404 },
            );
        }

        // Delete stored audio file
        try {
            const storage = await createUserStorageProvider(session.user.id);
            await storage.deleteFile(recording.storagePath);
        } catch (storageError) {
            console.error("Failed to delete audio file:", storageError);
        }

        // Cascade deletes handle transcriptions and speaker review assets
        await db.delete(recordings).where(eq(recordings.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting recording:", error);
        return NextResponse.json(
            { error: "Failed to delete recording" },
            { status: 500 },
        );
    }
}
