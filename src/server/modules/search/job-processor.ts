import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
    recordings,
    recordingTagAssignments,
    recordingTags,
} from "@/db/schema/library";
import { searchIndexJobs } from "@/db/schema/search";
import { recordingSpeakers, speakerProfiles } from "@/db/schema/voiceprints";
import {
    buildRecordingSearchDocument,
    buildSpeakerSearchDocument,
    buildTagSearchDocument,
    type SearchEntityType,
} from "@/server/modules/recordings/search-read-model";
import {
    deleteSearchDocumentsForEntity,
    upsertSearchDocument,
} from "./index-writer";
import { rebuildSearchIndexForUser } from "./rebuild";

type SearchIndexAction = "upsert" | "delete" | "rebuild";
type SearchIndexJobStatus = "pending" | "indexing" | "completed" | "failed";

type PendingSearchIndexJob = {
    id: string;
    userId: string;
    entityType: SearchEntityType;
    entityId: string;
    action: SearchIndexAction;
    attempts: number;
};

type SearchIndexEntityRef = {
    userId: string;
    entityType: SearchEntityType;
    entityId: string;
};

type SearchIndexJobProcessorDeps = {
    loadPendingJobs(input: { limit: number }): Promise<PendingSearchIndexJob[]>;
    markJobStarted(input: { jobId: string }): Promise<void>;
    markJobCompleted(input: { jobId: string }): Promise<void>;
    markJobFailed(input: {
        jobId: string;
        attempts: number;
        status: Exclude<SearchIndexJobStatus, "indexing" | "completed">;
        error: string;
    }): Promise<void>;
    upsertEntity(input: SearchIndexEntityRef): Promise<void>;
    deleteEntity(input: SearchIndexEntityRef): Promise<void>;
    rebuildUser(userId: string): Promise<unknown>;
};

function normalizeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

async function loadRecordingTags(userId: string, recordingId: string) {
    const assignments = await db
        .select({ tagId: recordingTagAssignments.tagId })
        .from(recordingTagAssignments)
        .where(
            and(
                eq(recordingTagAssignments.userId, userId),
                eq(recordingTagAssignments.recordingId, recordingId),
            ),
        );
    const tagIds = assignments.map((assignment) => assignment.tagId);
    if (tagIds.length === 0) {
        return [];
    }

    const tags = await db
        .select()
        .from(recordingTags)
        .where(
            and(
                eq(recordingTags.userId, userId),
                inArray(recordingTags.id, tagIds),
            ),
        );
    const tagById = new Map(tags.map((tag) => [tag.id, tag.name]));
    return tagIds.flatMap((tagId) => {
        const tag = tagById.get(tagId);
        return tag ? [tag] : [];
    });
}

async function loadRecordingSpeakers(userId: string, recordingId: string) {
    const rows = await db
        .select({
            displayName: speakerProfiles.displayName,
            rawSpeakerLabel: recordingSpeakers.rawLabel,
        })
        .from(recordingSpeakers)
        .leftJoin(
            speakerProfiles,
            eq(speakerProfiles.id, recordingSpeakers.matchedProfileId),
        )
        .where(
            and(
                eq(recordingSpeakers.userId, userId),
                eq(recordingSpeakers.recordingId, recordingId),
            ),
        );

    return rows.flatMap((row) => {
        const name = row.displayName?.trim() || row.rawSpeakerLabel?.trim();
        return name ? [name] : [];
    });
}

async function upsertRecordingSearchEntity(input: SearchIndexEntityRef) {
    const [recording] = await db
        .select()
        .from(recordings)
        .where(
            and(
                eq(recordings.userId, input.userId),
                eq(recordings.id, input.entityId),
            ),
        )
        .limit(1);

    if (!recording) {
        await deleteSearchDocumentsForEntity(input);
        return;
    }

    const [tags, speakers] = await Promise.all([
        loadRecordingTags(input.userId, input.entityId),
        loadRecordingSpeakers(input.userId, input.entityId),
    ]);

    await upsertSearchDocument(
        buildRecordingSearchDocument(recording, { tags, speakers }),
    );
}

async function upsertSpeakerSearchEntity(input: SearchIndexEntityRef) {
    const [speaker] = await db
        .select()
        .from(speakerProfiles)
        .where(
            and(
                eq(speakerProfiles.userId, input.userId),
                eq(speakerProfiles.id, input.entityId),
            ),
        )
        .limit(1);

    if (!speaker) {
        await deleteSearchDocumentsForEntity(input);
        return;
    }

    await upsertSearchDocument(buildSpeakerSearchDocument(speaker));
}

async function upsertTagSearchEntity(input: SearchIndexEntityRef) {
    const [tag] = await db
        .select()
        .from(recordingTags)
        .where(
            and(
                eq(recordingTags.userId, input.userId),
                eq(recordingTags.id, input.entityId),
            ),
        )
        .limit(1);

    if (!tag) {
        await deleteSearchDocumentsForEntity(input);
        return;
    }

    await upsertSearchDocument(buildTagSearchDocument(tag));
}

async function upsertSearchEntity(input: SearchIndexEntityRef) {
    if (input.entityType === "recording") {
        await upsertRecordingSearchEntity(input);
        return;
    }
    if (input.entityType === "speaker") {
        await upsertSpeakerSearchEntity(input);
        return;
    }
    if (input.entityType === "tag") {
        await upsertTagSearchEntity(input);
        return;
    }

    await rebuildSearchIndexForUser(input.userId);
}

const defaultDeps: SearchIndexJobProcessorDeps = {
    async loadPendingJobs({ limit }) {
        return (await db
            .select({
                id: searchIndexJobs.id,
                userId: searchIndexJobs.userId,
                entityType: searchIndexJobs.entityType,
                entityId: searchIndexJobs.entityId,
                action: searchIndexJobs.action,
                attempts: searchIndexJobs.attempts,
            })
            .from(searchIndexJobs)
            .where(
                and(
                    eq(searchIndexJobs.status, "pending"),
                    lte(searchIndexJobs.scheduledAt, new Date()),
                ),
            )
            .orderBy(asc(searchIndexJobs.scheduledAt))
            .limit(limit)) as PendingSearchIndexJob[];
    },
    async markJobStarted({ jobId }) {
        await db
            .update(searchIndexJobs)
            .set({
                status: "indexing",
                startedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(searchIndexJobs.id, jobId));
    },
    async markJobCompleted({ jobId }) {
        await db
            .update(searchIndexJobs)
            .set({
                status: "completed",
                completedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(searchIndexJobs.id, jobId));
    },
    async markJobFailed({ jobId, attempts, status, error }) {
        await db
            .update(searchIndexJobs)
            .set({
                attempts,
                status,
                lastError: error.slice(0, 1000),
                scheduledAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(searchIndexJobs.id, jobId));
    },
    upsertEntity: upsertSearchEntity,
    async deleteEntity(input) {
        await deleteSearchDocumentsForEntity(input);
    },
    rebuildUser: rebuildSearchIndexForUser,
};

function shouldCoalesceAsTranscriptRebuild(job: PendingSearchIndexJob) {
    return job.entityType === "transcript" && job.action === "upsert";
}

async function failJob(
    deps: SearchIndexJobProcessorDeps,
    job: PendingSearchIndexJob,
    error: unknown,
    maxAttempts: number,
) {
    const attempts = job.attempts + 1;
    await deps.markJobFailed({
        jobId: job.id,
        attempts,
        status: attempts >= maxAttempts ? "failed" : "pending",
        error: normalizeError(error),
    });
}

async function processTranscriptRebuildGroups(params: {
    deps: SearchIndexJobProcessorDeps;
    jobs: PendingSearchIndexJob[];
    maxAttempts: number;
    handledJobIds: Set<string>;
}) {
    const jobsByUser = new Map<string, PendingSearchIndexJob[]>();

    for (const job of params.jobs) {
        if (!shouldCoalesceAsTranscriptRebuild(job)) {
            continue;
        }

        const jobsForUser = jobsByUser.get(job.userId) ?? [];
        jobsForUser.push(job);
        jobsByUser.set(job.userId, jobsForUser);
    }

    let succeeded = 0;
    let failed = 0;

    for (const [userId, jobsForUser] of jobsByUser) {
        for (const job of jobsForUser) {
            params.handledJobIds.add(job.id);
            await params.deps.markJobStarted({ jobId: job.id });
        }

        try {
            await params.deps.rebuildUser(userId);
            for (const job of jobsForUser) {
                await params.deps.markJobCompleted({ jobId: job.id });
            }
            succeeded += jobsForUser.length;
        } catch (error) {
            for (const job of jobsForUser) {
                await failJob(params.deps, job, error, params.maxAttempts);
            }
            failed += jobsForUser.length;
        }
    }

    return { succeeded, failed };
}

export function createSearchIndexJobProcessor(
    deps: SearchIndexJobProcessorDeps = defaultDeps,
) {
    return {
        async processPending(
            options: { limit?: number; maxAttempts?: number } = {},
        ) {
            const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
            const maxAttempts = Math.max(options.maxAttempts ?? 3, 1);
            const jobs = await deps.loadPendingJobs({ limit });
            let succeeded = 0;
            let failed = 0;
            const handledJobIds = new Set<string>();

            const transcriptRebuildResult =
                await processTranscriptRebuildGroups({
                    deps,
                    jobs,
                    maxAttempts,
                    handledJobIds,
                });
            succeeded += transcriptRebuildResult.succeeded;
            failed += transcriptRebuildResult.failed;

            for (const job of jobs) {
                if (handledJobIds.has(job.id)) {
                    continue;
                }

                await deps.markJobStarted({ jobId: job.id });
                try {
                    const entityRef = {
                        userId: job.userId,
                        entityType: job.entityType,
                        entityId: job.entityId,
                    };
                    if (job.action === "delete") {
                        await deps.deleteEntity(entityRef);
                    } else if (job.action === "rebuild") {
                        await deps.rebuildUser(job.userId);
                    } else {
                        await deps.upsertEntity(entityRef);
                    }
                    await deps.markJobCompleted({ jobId: job.id });
                    succeeded += 1;
                } catch (error) {
                    await failJob(deps, job, error, maxAttempts);
                    failed += 1;
                }
            }

            return {
                processed: jobs.length,
                succeeded,
                failed,
            };
        },
    };
}

export async function processPendingSearchIndexJobs(options?: {
    limit?: number;
    maxAttempts?: number;
}) {
    return createSearchIndexJobProcessor().processPending(options);
}
