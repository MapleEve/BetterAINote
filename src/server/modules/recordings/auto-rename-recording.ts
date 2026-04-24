import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transcriptions } from "@/db/schema/transcripts";
import { generateTitleFromTranscription } from "@/lib/ai/generate-title";
import {
    applyRecordingRename,
    assertRecordingCanRenameLocally,
    findOwnedRecordingForRename,
    RecordingRenameError,
    type RenameableRecording,
} from "./rename-shared";

function formatTitleGenerationMetadata(
    recording: Pick<RenameableRecording, "startTime" | "filename">,
) {
    const dateFormatter = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const timeFormatter = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    return {
        recordingDate: dateFormatter.format(recording.startTime),
        recordingTime: timeFormatter
            .format(recording.startTime)
            .replace(":", ""),
        currentFilename: recording.filename,
    };
}

export async function autoRenameRecording(userId: string, recordingId: string) {
    const recording = await findOwnedRecordingForRename(userId, recordingId);

    if (!recording) {
        throw new RecordingRenameError("Recording not found", 404);
    }

    assertRecordingCanRenameLocally(recording);

    const [transcription] = await db
        .select({
            text: transcriptions.text,
        })
        .from(transcriptions)
        .where(eq(transcriptions.recordingId, recording.id))
        .limit(1);

    if (!transcription?.text?.trim()) {
        throw new RecordingRenameError(
            "No transcript available for AI rename",
            400,
        );
    }

    const title = await generateTitleFromTranscription(
        userId,
        transcription.text,
        formatTitleGenerationMetadata(recording),
    );

    if (!title) {
        throw new RecordingRenameError("Failed to generate filename", 500);
    }

    await applyRecordingRename({
        userId,
        recording,
        title,
    });

    return {
        filename: title,
    };
}
