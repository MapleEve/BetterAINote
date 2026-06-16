import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
    recordings,
    recordingTagAssignments,
    recordingTags,
} from "@/db/schema/library";
import {
    isRecordingTagColor,
    isRecordingTagIcon,
    isValidRecordingTagName,
    normalizeRecordingTagName,
} from "@/lib/recording-tags";
import {
    enqueueSearchDeleteJob,
    enqueueSearchIndexJob,
} from "@/server/modules/search/indexer";

export class RecordingTagError extends Error {
    constructor(
        message: string,
        public readonly status = 400,
    ) {
        super(message);
        this.name = "RecordingTagError";
    }
}

function serializeTag(
    tag: typeof recordingTags.$inferSelect,
    recordingCount?: number,
) {
    return {
        id: tag.id,
        name: tag.name,
        color: isRecordingTagColor(tag.color) ? tag.color : "purple",
        icon: isRecordingTagIcon(tag.icon) ? tag.icon : "grid",
        ...(typeof recordingCount === "number" ? { recordingCount } : {}),
    };
}

export async function listRecordingTags(userId: string) {
    const [tags, assignments] = await Promise.all([
        db
            .select()
            .from(recordingTags)
            .where(eq(recordingTags.userId, userId))
            .orderBy(desc(recordingTags.createdAt)),
        db
            .select({ tagId: recordingTagAssignments.tagId })
            .from(recordingTagAssignments)
            .where(eq(recordingTagAssignments.userId, userId)),
    ]);

    const recordingCountByTagId = new Map<string, number>();
    for (const assignment of assignments) {
        recordingCountByTagId.set(
            assignment.tagId,
            (recordingCountByTagId.get(assignment.tagId) ?? 0) + 1,
        );
    }

    return tags.map((tag) =>
        serializeTag(tag, recordingCountByTagId.get(tag.id) ?? 0),
    );
}

export async function createRecordingTag(
    userId: string,
    input: {
        name?: unknown;
        color?: unknown;
        icon?: unknown;
    },
) {
    const name = normalizeRecordingTagName(input.name);
    const color = isRecordingTagColor(input.color) ? input.color : "purple";
    const icon = isRecordingTagIcon(input.icon) ? input.icon : "grid";

    if (!isValidRecordingTagName(name)) {
        throw new RecordingTagError("Tag name must be 1-12 characters", 400);
    }

    try {
        const [tag] = await db
            .insert(recordingTags)
            .values({
                userId,
                name,
                color,
                icon,
            })
            .returning();

        await enqueueSearchIndexJob({
            userId,
            entityType: "tag",
            entityId: tag.id,
        });

        return serializeTag(tag);
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("UNIQUE constraint failed")
        ) {
            throw new RecordingTagError("Tag name already exists", 409);
        }

        throw error;
    }
}

export async function deleteRecordingTag(userId: string, tagId: string) {
    const [tag] = await db
        .select({ id: recordingTags.id })
        .from(recordingTags)
        .where(
            and(eq(recordingTags.id, tagId), eq(recordingTags.userId, userId)),
        )
        .limit(1);

    if (!tag) {
        throw new RecordingTagError("Tag not found", 404);
    }

    const assignments = await db
        .select({ recordingId: recordingTagAssignments.recordingId })
        .from(recordingTagAssignments)
        .where(
            and(
                eq(recordingTagAssignments.userId, userId),
                eq(recordingTagAssignments.tagId, tagId),
            ),
        );

    await db
        .delete(recordingTags)
        .where(
            and(eq(recordingTags.id, tagId), eq(recordingTags.userId, userId)),
        );

    await enqueueSearchDeleteJob({
        userId,
        entityType: "tag",
        entityId: tagId,
    });

    for (const recordingId of new Set(
        assignments.map((assignment) => assignment.recordingId),
    )) {
        await enqueueSearchIndexJob({
            userId,
            entityType: "recording",
            entityId: recordingId,
        });
    }

    return { deleted: true, id: tagId };
}

export async function updateRecordingTagAssignments(
    userId: string,
    recordingId: string,
    input: {
        tagIds?: unknown;
    },
) {
    const [recording] = await db
        .select({ id: recordings.id })
        .from(recordings)
        .where(
            and(eq(recordings.id, recordingId), eq(recordings.userId, userId)),
        )
        .limit(1);

    if (!recording) {
        throw new RecordingTagError("Recording not found", 404);
    }

    const rawTagIds = Array.isArray(input.tagIds) ? input.tagIds : [];
    const tagIds: string[] = Array.from(
        new Set(
            rawTagIds.filter(
                (tagId: unknown): tagId is string =>
                    typeof tagId === "string" && tagId.length > 0,
            ),
        ),
    );

    const tags =
        tagIds.length === 0
            ? []
            : await db
                  .select()
                  .from(recordingTags)
                  .where(
                      and(
                          eq(recordingTags.userId, userId),
                          inArray(recordingTags.id, tagIds),
                      ),
                  );

    if (tags.length !== tagIds.length) {
        throw new RecordingTagError("Tag not found", 404);
    }

    await db
        .delete(recordingTagAssignments)
        .where(
            and(
                eq(recordingTagAssignments.userId, userId),
                eq(recordingTagAssignments.recordingId, recordingId),
            ),
        );

    if (tags.length > 0) {
        await db.insert(recordingTagAssignments).values(
            tagIds.map((tagId) => ({
                userId,
                recordingId,
                tagId,
            })),
        );
    }

    await enqueueSearchIndexJob({
        userId,
        entityType: "recording",
        entityId: recordingId,
    });

    const tagById = new Map(tags.map((tag) => [tag.id, tag]));
    return tagIds
        .map((tagId) => tagById.get(tagId))
        .filter((tag): tag is typeof recordingTags.$inferSelect => Boolean(tag))
        .map(serializeTag);
}
