import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";
import { canRecordingRenameLocally } from "@/lib/data-sources/catalog";
import {
    SourceTitleWritebackError,
    writeRecordingTitleToSourceOrThrow,
} from "@/lib/data-sources/source-title-writeback";

export type RenameableRecording = typeof recordings.$inferSelect;

export class RecordingRenameError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "RecordingRenameError";
        this.status = status;
    }
}

export async function findOwnedRecordingForRename(
    userId: string,
    recordingId: string,
) {
    const [recording] = await db
        .select()
        .from(recordings)
        .where(
            and(eq(recordings.id, recordingId), eq(recordings.userId, userId)),
        )
        .limit(1);

    return recording ?? null;
}

export function sanitizeRecordingFilename(filename: unknown) {
    if (typeof filename !== "string") {
        throw new RecordingRenameError("Filename is required", 400);
    }

    const trimmed = filename.trim();

    if (trimmed.length === 0) {
        throw new RecordingRenameError("Filename is required", 400);
    }

    return trimmed.substring(0, 255);
}

export function assertRecordingCanRenameLocally(
    recording: Pick<RenameableRecording, "sourceProvider">,
) {
    if (!canRecordingRenameLocally(recording.sourceProvider)) {
        throw new RecordingRenameError(
            "This source does not support local renaming in BetterAINote",
            400,
        );
    }
}

export async function applyRecordingRename(params: {
    userId: string;
    recording: Pick<
        RenameableRecording,
        "id" | "sourceProvider" | "sourceRecordingId"
    >;
    title: string;
}) {
    try {
        await writeRecordingTitleToSourceOrThrow({
            userId: params.userId,
            recording: params.recording,
            title: params.title,
        });
    } catch (error) {
        if (error instanceof SourceTitleWritebackError) {
            throw new RecordingRenameError(error.message, error.status);
        }

        throw error;
    }

    await db
        .update(recordings)
        .set({ filename: params.title, updatedAt: new Date() })
        .where(eq(recordings.id, params.recording.id));
}
