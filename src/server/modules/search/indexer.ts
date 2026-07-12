import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { searchIndexJobs, searchTombstones } from "@/db/schema/search";
import {
    sourceArtifactSegments,
    transcriptSegments,
} from "@/db/schema/transcripts";
import {
    buildSourceArtifactSegmentRows,
    buildTranscriptSegmentRows,
    buildTranscriptSegmentRowsFromSourceArtifact,
} from "./segmenter";

type SearchEntityType = "recording" | "transcript" | "speaker" | "tag";
type SearchIndexAction = "upsert" | "delete" | "rebuild";
export type SearchIndexingProgress = {
    active: boolean;
    pendingJobs: number;
    indexingJobs: number;
    completedJobs: number;
    totalJobs: number;
};
const SQLITE_BUSY_RETRIES = 5;
const SQLITE_BUSY_RETRY_DELAY_MS = 50;

function isSqliteBusyError(error: unknown, seen = new Set<unknown>()): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }
    if (seen.has(error)) {
        return false;
    }
    seen.add(error);

    const record = error as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message : "";

    return (
        record.code === "SQLITE_BUSY" ||
        message.includes("SQLITE_BUSY") ||
        isSqliteBusyError(record.cause, seen)
    );
}

async function waitForRetry(attempt: number) {
    await new Promise((resolve) =>
        setTimeout(resolve, SQLITE_BUSY_RETRY_DELAY_MS * attempt),
    );
}

async function runWithSqliteBusyRetry<T>(operation: () => Promise<T>) {
    let attempt = 0;

    while (true) {
        try {
            return await operation();
        } catch (error) {
            attempt += 1;
            if (!isSqliteBusyError(error) || attempt > SQLITE_BUSY_RETRIES) {
                throw error;
            }
            await waitForRetry(attempt);
        }
    }
}

export async function enqueueSearchIndexJob(params: {
    userId: string;
    entityType: SearchEntityType;
    entityId: string;
    action?: SearchIndexAction;
}) {
    await runWithSqliteBusyRetry(async () =>
        db.insert(searchIndexJobs).values({
            userId: params.userId,
            entityType: params.entityType,
            entityId: params.entityId,
            action: params.action ?? "upsert",
            status: "pending",
            scheduledAt: new Date(),
            updatedAt: new Date(),
        }),
    );
}

export async function enqueueSearchDeleteJob(params: {
    userId: string;
    entityType: SearchEntityType;
    entityId: string;
}) {
    await db
        .insert(searchTombstones)
        .values({
            userId: params.userId,
            entityType: params.entityType,
            entityId: params.entityId,
            deletedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [
                searchTombstones.userId,
                searchTombstones.entityType,
                searchTombstones.entityId,
            ],
            set: {
                deletedAt: new Date(),
            },
        });

    await enqueueSearchIndexJob({
        ...params,
        action: "delete",
    });
}

export async function getSearchIndexingProgress(params: {
    userId: string;
}): Promise<SearchIndexingProgress> {
    const activeJobs = await db
        .select({ status: searchIndexJobs.status })
        .from(searchIndexJobs)
        .where(
            and(
                eq(searchIndexJobs.userId, params.userId),
                inArray(searchIndexJobs.status, ["pending", "indexing"]),
            ),
        );

    const pendingJobs = activeJobs.filter(
        (job) => job.status === "pending",
    ).length;
    const indexingJobs = activeJobs.filter(
        (job) => job.status === "indexing",
    ).length;
    const totalJobs = pendingJobs + indexingJobs;

    return {
        active: totalJobs > 0,
        pendingJobs,
        indexingJobs,
        completedJobs: 0,
        totalJobs,
    };
}

export async function replaceTranscriptSegmentsForTranscription(params: {
    userId: string;
    recordingId: string;
    transcriptionId: string;
    transcriptOrigin: "local";
    text: string;
    providerPayload?: unknown;
}) {
    const rows = buildTranscriptSegmentRows(params);

    await db
        .delete(transcriptSegments)
        .where(eq(transcriptSegments.transcriptionId, params.transcriptionId));

    if (rows.length > 0) {
        await db.insert(transcriptSegments).values(rows);
    }

    await enqueueSearchIndexJob({
        userId: params.userId,
        entityType: "transcript",
        entityId: params.transcriptionId,
    });
}

export async function replaceSourceArtifactSegmentsForArtifact(params: {
    sourceArtifactId: string;
    recordingId: string;
    userId: string;
    provider: string;
    artifactType: string;
    textContent?: string | null;
    markdownContent?: string | null;
    payload?: Record<string, unknown> | null;
}) {
    const artifactRows = buildSourceArtifactSegmentRows(params);
    const transcriptRows =
        params.artifactType === "official-transcript"
            ? buildTranscriptSegmentRowsFromSourceArtifact(params)
            : [];

    await Promise.all([
        db
            .delete(sourceArtifactSegments)
            .where(
                eq(
                    sourceArtifactSegments.sourceArtifactId,
                    params.sourceArtifactId,
                ),
            ),
        db
            .delete(transcriptSegments)
            .where(
                and(
                    eq(
                        transcriptSegments.sourceArtifactId,
                        params.sourceArtifactId,
                    ),
                    eq(transcriptSegments.transcriptOrigin, "source"),
                ),
            ),
    ]);

    if (artifactRows.length > 0) {
        await db.insert(sourceArtifactSegments).values(artifactRows);
    }
    if (transcriptRows.length > 0) {
        await db.insert(transcriptSegments).values(transcriptRows);
    }

    await enqueueSearchIndexJob({
        userId: params.userId,
        entityType:
            params.artifactType === "official-transcript"
                ? "transcript"
                : "recording",
        entityId: params.sourceArtifactId,
    });
}
