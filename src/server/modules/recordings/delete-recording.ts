import { eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";
import { createUserStorageProvider } from "@/lib/storage/factory";
import { findOwnedRecording } from "./ownership";

export class RecordingDeleteError extends Error {
    constructor(
        message: string,
        public readonly status = 404,
    ) {
        super(message);
        this.name = "RecordingDeleteError";
    }
}

export async function deleteRecordingForUser(
    userId: string,
    recordingId: string,
) {
    const recording = await findOwnedRecording(userId, recordingId, {
        id: recordings.id,
        storagePath: recordings.storagePath,
    });

    if (!recording) {
        throw new RecordingDeleteError("Recording not found", 404);
    }

    if (recording.storagePath.trim()) {
        try {
            const storage = await createUserStorageProvider(userId);
            await storage.deleteFile(recording.storagePath);
        } catch (storageError) {
            console.error("Failed to delete audio file:", storageError);
        }
    }

    await db.delete(recordings).where(eq(recordings.id, recordingId));

    return { success: true };
}
