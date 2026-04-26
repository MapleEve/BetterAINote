import { recordings } from "@/db/schema/library";
import { createUserStorageProvider } from "@/lib/storage/factory";
import { getAudioMimeType } from "@/lib/utils";
import { findOwnedRecording } from "./ownership";

export class RecordingAudioError extends Error {
    constructor(
        message: string,
        public readonly status = 404,
    ) {
        super(message);
        this.name = "RecordingAudioError";
    }
}

export async function getRecordingAudioForUser(
    userId: string,
    recordingId: string,
) {
    const recording = await findOwnedRecording(userId, recordingId, {
        id: recordings.id,
        storagePath: recordings.storagePath,
    });

    if (!recording) {
        throw new RecordingAudioError("Recording not found", 404);
    }

    if (!recording.storagePath?.trim()) {
        throw new RecordingAudioError(
            "No local audio available for this recording",
            404,
        );
    }

    const storage = await createUserStorageProvider(userId);
    const audioBuffer = await storage.downloadFile(recording.storagePath);

    return {
        audioBuffer,
        contentType: getAudioMimeType(recording.storagePath),
    };
}
