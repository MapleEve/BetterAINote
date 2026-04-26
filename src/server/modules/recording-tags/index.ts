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

export class RecordingTagError extends Error {
    constructor(
        message: string,
        public readonly status = 400,
    ) {
        super(message);
        this.name = "RecordingTagError";
    }
}

function serializeTag(tag: typeof recordingTags.$inferSelect) {
    return {
        id: tag.id,
        name: tag.name,
        color: isRecordingTagColor(tag.color) ? tag.color : "gray",
        icon: isRecordingTagIcon(tag.icon) ? tag.icon : "tag",
    };
}

export async function listRecordingTags(userId: string) {
    const tags = await db
        .select()
        .from(recordingTags)
        .where(eq(recordingTags.userId, userId))
        .orderBy(desc(recordingTags.createdAt));

    return tags.map(serializeTag);
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
    const color = isRecordingTagColor(input.color) ? input.color : "gray";
    const icon = isRecordingTagIcon(input.icon) ? input.icon : "tag";

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

    const tagById = new Map(tags.map((tag) => [tag.id, tag]));
    return tagIds
        .map((tagId) => tagById.get(tagId))
        .filter((tag): tag is typeof recordingTags.$inferSelect => Boolean(tag))
        .map(serializeTag);
}
