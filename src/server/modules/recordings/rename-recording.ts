import {
    applyRecordingRename,
    assertRecordingCanRenameLocally,
    findOwnedRecordingForRename,
    RecordingRenameError,
    sanitizeRecordingFilename,
} from "./rename-shared";

export async function renameRecording(
    userId: string,
    recordingId: string,
    filename: unknown,
) {
    const cleanFilename = sanitizeRecordingFilename(filename);
    const recording = await findOwnedRecordingForRename(userId, recordingId);

    if (!recording) {
        throw new RecordingRenameError("Recording not found", 404);
    }

    assertRecordingCanRenameLocally(recording);

    await applyRecordingRename({
        userId,
        recording,
        title: cleanFilename,
    });

    return {
        recording: {
            ...recording,
            filename: cleanFilename,
        },
    };
}
