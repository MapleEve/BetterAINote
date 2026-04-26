import { and, eq } from "drizzle-orm";
import { db, searchDb } from "@/db";
import {
    recordings,
    recordingTagAssignments,
    recordingTags,
} from "@/db/schema/library";
import {
    searchChunks,
    searchContentFts,
    searchDocuments,
    searchIndexJobs,
    searchName2Id,
} from "@/db/schema/search";
import { transcriptSegments } from "@/db/schema/transcripts";
import { recordingSpeakers, speakerProfiles } from "@/db/schema/voiceprints";
import { chunkSearchText, hashSearchContent } from "./segmenter";

type SearchEntityType = "recording" | "transcript" | "speaker" | "tag";

type SearchDocumentInput = {
    userId: string;
    entityType: SearchEntityType;
    entityId: string;
    recordingId?: string | null;
    title?: string | null;
    body: string;
    speaker?: string | null;
    tags?: string[] | null;
    source?: string | null;
    transcriptOrigin?: string | null;
    sourceProvider?: string | null;
    startMs?: number | null;
    endMs?: number | null;
    sortSeqMs?: number | null;
};

function normalizeName(value: string) {
    return value.trim().toLocaleLowerCase();
}

async function upsertSearchName(params: {
    userId: string;
    namespace: string;
    name: string | null | undefined;
}) {
    const name = params.name?.trim();
    if (!name) {
        return null;
    }

    const normalizedName = normalizeName(name);

    await db
        .insert(searchName2Id)
        .values({
            userId: params.userId,
            namespace: params.namespace,
            name,
            normalizedName,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [
                searchName2Id.userId,
                searchName2Id.namespace,
                searchName2Id.normalizedName,
            ],
            set: {
                name,
                updatedAt: new Date(),
            },
        });

    const [row] = await db
        .select({ id: searchName2Id.id })
        .from(searchName2Id)
        .where(
            and(
                eq(searchName2Id.userId, params.userId),
                eq(searchName2Id.namespace, params.namespace),
                eq(searchName2Id.normalizedName, normalizedName),
            ),
        )
        .limit(1);

    return row?.id ?? null;
}

async function deleteAllFtsRows() {
    await searchDb.run(
        "INSERT INTO search_content_fts(search_content_fts) VALUES('delete-all')",
    );
}

async function replaceSearchDocument(input: SearchDocumentInput) {
    const [existingDocument] = await db
        .select({ rowid: searchDocuments.rowid })
        .from(searchDocuments)
        .where(
            and(
                eq(searchDocuments.userId, input.userId),
                eq(searchDocuments.entityType, input.entityType),
                eq(searchDocuments.entityId, input.entityId),
            ),
        )
        .limit(1);

    if (existingDocument) {
        const oldChunks = await db
            .select({ rowid: searchChunks.rowid })
            .from(searchChunks)
            .where(eq(searchChunks.documentRowid, existingDocument.rowid));
        if (oldChunks.length > 0) {
            await deleteAllFtsRows();
        }
        await db
            .delete(searchChunks)
            .where(eq(searchChunks.documentRowid, existingDocument.rowid));
    }

    const [recordingNameId, speakerNameId, tagNameId, sourceNameId] =
        await Promise.all([
            upsertSearchName({
                userId: input.userId,
                namespace: "recording",
                name: input.title,
            }),
            upsertSearchName({
                userId: input.userId,
                namespace: "speaker",
                name: input.speaker,
            }),
            upsertSearchName({
                userId: input.userId,
                namespace: "tag",
                name: input.tags?.join(" "),
            }),
            upsertSearchName({
                userId: input.userId,
                namespace: "source",
                name: input.source,
            }),
        ]);

    const contentHash = hashSearchContent(
        [
            input.title ?? "",
            input.body,
            input.speaker ?? "",
            ...(input.tags ?? []),
            input.source ?? "",
        ].join("\n"),
    );

    await db
        .insert(searchDocuments)
        .values({
            userId: input.userId,
            entityType: input.entityType,
            entityId: input.entityId,
            recordingId: input.recordingId ?? null,
            transcriptOrigin: input.transcriptOrigin ?? null,
            recordingNameId,
            speakerNameId,
            tagNameId,
            sourceNameId,
            sourceProvider: input.sourceProvider ?? null,
            title: input.title ?? null,
            startMs: input.startMs ?? null,
            endMs: input.endMs ?? null,
            sortSeqMs: input.sortSeqMs ?? 0,
            contentHash,
            indexedAt: new Date(),
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [
                searchDocuments.userId,
                searchDocuments.entityType,
                searchDocuments.entityId,
            ],
            set: {
                recordingId: input.recordingId ?? null,
                transcriptOrigin: input.transcriptOrigin ?? null,
                recordingNameId,
                speakerNameId,
                tagNameId,
                sourceNameId,
                sourceProvider: input.sourceProvider ?? null,
                title: input.title ?? null,
                startMs: input.startMs ?? null,
                endMs: input.endMs ?? null,
                sortSeqMs: input.sortSeqMs ?? 0,
                contentHash,
                indexedAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            },
        });

    const [document] = await db
        .select({ rowid: searchDocuments.rowid })
        .from(searchDocuments)
        .where(
            and(
                eq(searchDocuments.userId, input.userId),
                eq(searchDocuments.entityType, input.entityType),
                eq(searchDocuments.entityId, input.entityId),
            ),
        )
        .limit(1);

    if (!document) {
        throw new Error("Failed to upsert search document");
    }

    const chunks = chunkSearchText(input.body);
    for (const chunk of chunks) {
        const [insertedChunk] = await db
            .insert(searchChunks)
            .values({
                documentRowid: document.rowid,
                userId: input.userId,
                entityType: input.entityType,
                entityId: input.entityId,
                recordingId: input.recordingId ?? null,
                segmentId:
                    input.entityType === "transcript" ? input.entityId : null,
                chunkIndex: chunk.index,
                speakerNameId,
                startMs: input.startMs ?? null,
                endMs: input.endMs ?? null,
                sortSeqMs: input.sortSeqMs ?? 0,
                body: chunk.text,
                bodyHash: hashSearchContent(chunk.text),
            })
            .returning({ rowid: searchChunks.rowid });

        await db.insert(searchContentFts).values({
            rowid: insertedChunk.rowid,
            title: input.title ?? null,
            body: chunk.text,
            speaker: input.speaker ?? null,
            tags: input.tags?.join(" ") ?? null,
            source: input.source ?? null,
            entityType: input.entityType,
            entityId: input.entityId,
            recordingId: input.recordingId ?? null,
        });
    }
}

async function clearSearchIndexForUser(userId: string) {
    const chunkRows = await db
        .select({ rowid: searchChunks.rowid })
        .from(searchChunks)
        .where(eq(searchChunks.userId, userId));
    if (chunkRows.length > 0) {
        await deleteAllFtsRows();
    }
    await db.delete(searchChunks).where(eq(searchChunks.userId, userId));
    await db.delete(searchDocuments).where(eq(searchDocuments.userId, userId));
    await db.delete(searchName2Id).where(eq(searchName2Id.userId, userId));
    await db.delete(searchIndexJobs).where(eq(searchIndexJobs.userId, userId));
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
        await replaceSearchDocument({
            userId,
            entityType: "recording",
            entityId: recording.id,
            recordingId: recording.id,
            title: recording.filename,
            body: [
                recording.filename,
                recording.sourceProvider ?? "",
                recording.sourceRecordingId ?? "",
                ...(tagsByRecordingId.get(recording.id) ?? []),
                ...(speakerNamesByRecordingId.get(recording.id) ?? []),
            ].join("\n"),
            tags: tagsByRecordingId.get(recording.id),
            source: recording.sourceProvider,
            sourceProvider: recording.sourceProvider,
            sortSeqMs: recording.startTime.getTime(),
        });
    }

    for (const segment of transcriptRows) {
        const recording = recordingById.get(segment.recordingId);
        await replaceSearchDocument({
            userId,
            entityType: "transcript",
            entityId: segment.id,
            recordingId: segment.recordingId,
            title: recording?.filename ?? null,
            body: segment.text,
            speaker: segment.rawSpeakerLabel,
            tags: tagsByRecordingId.get(segment.recordingId),
            source: recording?.sourceProvider ?? null,
            sourceProvider: recording?.sourceProvider ?? null,
            transcriptOrigin: segment.transcriptOrigin,
            startMs: segment.startMs,
            endMs: segment.endMs,
            sortSeqMs: segment.sortSeqMs,
        });
    }

    for (const speaker of speakerRows) {
        await replaceSearchDocument({
            userId,
            entityType: "speaker",
            entityId: speaker.id,
            title: speaker.displayName,
            body: speaker.displayName,
            speaker: speaker.displayName,
        });
    }

    for (const tag of tagRows) {
        await replaceSearchDocument({
            userId,
            entityType: "tag",
            entityId: tag.id,
            title: tag.name,
            body: tag.name,
            tags: [tag.name],
        });
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
