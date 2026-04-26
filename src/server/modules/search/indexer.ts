import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { searchIndexJobs } from "@/db/schema/search";
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

export async function enqueueSearchIndexJob(params: {
    userId: string;
    entityType: SearchEntityType;
    entityId: string;
    action?: SearchIndexAction;
}) {
    await db.insert(searchIndexJobs).values({
        userId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action ?? "upsert",
        status: "pending",
        scheduledAt: new Date(),
        updatedAt: new Date(),
    });
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
