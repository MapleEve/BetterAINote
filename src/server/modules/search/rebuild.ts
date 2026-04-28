import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
    recordings,
    recordingTagAssignments,
    recordingTags,
} from "@/db/schema/library";
import {
    searchChunks,
    searchDocuments,
    searchName2Id,
} from "@/db/schema/search";
import { transcriptSegments } from "@/db/schema/transcripts";
import { recordingSpeakers, speakerProfiles } from "@/db/schema/voiceprints";
import {
    buildRecordingSearchDocument,
    buildSpeakerSearchDocument,
    buildTagSearchDocument,
    buildTranscriptSearchDocument,
} from "@/server/modules/recordings/search-read-model";
import {
    deleteFtsRowsByChunkRowids,
    upsertSearchDocument,
} from "./index-writer";

async function clearSearchIndexForUser(userId: string) {
    const chunkRows = await db
        .select({ rowid: searchChunks.rowid })
        .from(searchChunks)
        .where(eq(searchChunks.userId, userId));
    if (chunkRows.length > 0) {
        await deleteFtsRowsByChunkRowids(chunkRows.map((chunk) => chunk.rowid));
    }
    await db.delete(searchChunks).where(eq(searchChunks.userId, userId));
    await db.delete(searchDocuments).where(eq(searchDocuments.userId, userId));
    await db.delete(searchName2Id).where(eq(searchName2Id.userId, userId));
}

function buildTagsByRecordingId(
    assignments: Array<typeof recordingTagAssignments.$inferSelect>,
    tags: Array<typeof recordingTags.$inferSelect>,
) {
    const tagById = new Map(tags.map((tag) => [tag.id, tag]));
    const tagsByRecordingId = new Map<string, string[]>();

    for (const assignment of assignments) {
        const tag = tagById.get(assignment.tagId);
        if (!tag) continue;

        const values = tagsByRecordingId.get(assignment.recordingId) ?? [];
        values.push(tag.name);
        tagsByRecordingId.set(assignment.recordingId, values);
    }

    return tagsByRecordingId;
}

function buildSpeakerNamesByRecordingId(
    rows: Array<{
        recordingId: string;
        displayName: string | null;
        rawSpeakerLabel: string | null;
    }>,
) {
    const namesByRecordingId = new Map<string, string[]>();

    for (const row of rows) {
        const name = row.displayName?.trim() || row.rawSpeakerLabel?.trim();
        if (!name) continue;

        const values = namesByRecordingId.get(row.recordingId) ?? [];
        values.push(name);
        namesByRecordingId.set(row.recordingId, values);
    }

    return namesByRecordingId;
}

export async function rebuildSearchIndexForUser(userId: string) {
    await clearSearchIndexForUser(userId);

    const [
        recordingRows,
        tagRows,
        tagAssignmentRows,
        transcriptRows,
        speakerRows,
        recordingSpeakerRows,
    ] = await Promise.all([
        db.select().from(recordings).where(eq(recordings.userId, userId)),
        db.select().from(recordingTags).where(eq(recordingTags.userId, userId)),
        db
            .select()
            .from(recordingTagAssignments)
            .where(eq(recordingTagAssignments.userId, userId)),
        db
            .select()
            .from(transcriptSegments)
            .where(eq(transcriptSegments.userId, userId)),
        db
            .select()
            .from(speakerProfiles)
            .where(eq(speakerProfiles.userId, userId)),
        db
            .select({
                recordingId: recordingSpeakers.recordingId,
                displayName: speakerProfiles.displayName,
                rawSpeakerLabel: recordingSpeakers.rawLabel,
            })
            .from(recordingSpeakers)
            .leftJoin(
                speakerProfiles,
                eq(speakerProfiles.id, recordingSpeakers.matchedProfileId),
            )
            .where(eq(recordingSpeakers.userId, userId)),
    ]);

    const recordingById = new Map(
        recordingRows.map((recording) => [recording.id, recording]),
    );
    const tagsByRecordingId = buildTagsByRecordingId(
        tagAssignmentRows,
        tagRows,
    );
    const speakerNamesByRecordingId =
        buildSpeakerNamesByRecordingId(recordingSpeakerRows);

    for (const recording of recordingRows) {
        await upsertSearchDocument(
            buildRecordingSearchDocument(recording, {
                tags: tagsByRecordingId.get(recording.id),
                speakers: speakerNamesByRecordingId.get(recording.id),
            }),
        );
    }

    for (const segment of transcriptRows) {
        const recording = recordingById.get(segment.recordingId);
        await upsertSearchDocument(
            buildTranscriptSearchDocument(segment, {
                recording,
                tags: tagsByRecordingId.get(segment.recordingId),
            }),
        );
    }

    for (const speaker of speakerRows) {
        await upsertSearchDocument(buildSpeakerSearchDocument(speaker));
    }

    for (const tag of tagRows) {
        await upsertSearchDocument(buildTagSearchDocument(tag));
    }

    return {
        recordings: recordingRows.length,
        transcripts: transcriptRows.length,
        speakers: speakerRows.length,
        tags: tagRows.length,
    };
}

export async function rebuildSearchIndexForAllUsers() {
    const rows = await db
        .select({ userId: recordings.userId })
        .from(recordings);
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const results = [];

    for (const userId of userIds) {
        results.push({ userId, ...(await rebuildSearchIndexForUser(userId)) });
    }

    return results;
}
