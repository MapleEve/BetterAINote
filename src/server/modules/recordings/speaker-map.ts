import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings } from "@/db/schema/library";
import { transcriptions } from "@/db/schema/transcripts";
import { findOwnedRecording } from "./ownership";

export class RecordingSpeakerMapError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = "RecordingSpeakerMapError";
    }
}

function validateSpeakerMap(
    speakerMap: unknown,
): asserts speakerMap is Record<string, string> {
    if (
        !speakerMap ||
        typeof speakerMap !== "object" ||
        Array.isArray(speakerMap)
    ) {
        throw new RecordingSpeakerMapError("speakerMap must be an object", 400);
    }

    for (const [key, value] of Object.entries(speakerMap)) {
        if (typeof key !== "string" || typeof value !== "string") {
            throw new RecordingSpeakerMapError(
                "All speaker map keys and values must be strings",
                400,
            );
        }

        if (value.length > 100) {
            throw new RecordingSpeakerMapError(
                "Speaker names must be 100 characters or fewer",
                400,
            );
        }
    }
}

async function assertOwnedRecording(userId: string, recordingId: string) {
    const recording = await findOwnedRecording(userId, recordingId, {
        id: recordings.id,
    });

    if (!recording) {
        throw new RecordingSpeakerMapError("Recording not found", 404);
    }
}

export async function getRecordingSpeakerMap(
    userId: string,
    recordingId: string,
) {
    await assertOwnedRecording(userId, recordingId);

    const [transcription] = await db
        .select({ speakerMap: transcriptions.speakerMap })
        .from(transcriptions)
        .where(
            and(
                eq(transcriptions.recordingId, recordingId),
                eq(transcriptions.userId, userId),
            ),
        )
        .limit(1);

    return {
        speakerMap: transcription?.speakerMap ?? null,
    };
}

export async function updateRecordingSpeakerMap(
    userId: string,
    recordingId: string,
    speakerMap: unknown,
) {
    validateSpeakerMap(speakerMap);
    await assertOwnedRecording(userId, recordingId);

    const [transcription] = await db
        .select({ id: transcriptions.id })
        .from(transcriptions)
        .where(
            and(
                eq(transcriptions.recordingId, recordingId),
                eq(transcriptions.userId, userId),
            ),
        )
        .limit(1);

    if (!transcription) {
        throw new RecordingSpeakerMapError(
            "No transcription found for this recording",
            404,
        );
    }

    await db
        .update(transcriptions)
        .set({ speakerMap })
        .where(eq(transcriptions.id, transcription.id));

    return {
        success: true as const,
        speakerMap,
    };
}
