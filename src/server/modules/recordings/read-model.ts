import {
    and,
    asc,
    count,
    desc,
    eq,
    gte,
    inArray,
    like,
    lt,
    lte,
    notInArray,
    or,
} from "drizzle-orm";
import { db } from "@/db";
import {
    recordings,
    recordingTagAssignments,
    recordingTags,
    transcriptionJobs,
} from "@/db/schema/library";
import { transcriptions, transcriptSegments } from "@/db/schema/transcripts";
import {
    buildDashboardTranscriptionJobMap,
    buildDashboardTranscriptionMap,
    buildRecordingTagMap,
    type DashboardTranscriptionRow,
    type RecordingTranscriptionJobRow,
    type RecordingTranscriptionRow,
    type RecordingTranscriptSegmentRow,
    serializeQueriedRecording,
    serializeRecordingDetailTranscription,
    serializeRecordingDetailTranscriptionJob,
    serializeRecordingWithTags,
} from "./serialize";

type RecordingDetailRow = typeof recordings.$inferSelect;
type RecordingDetailTranscriptionRow = typeof transcriptions.$inferSelect;

type RecordingListFilters = {
    from?: Date | null;
    to?: Date | null;
    limit?: number;
    page?: number;
    pageSize?: number;
    query?: string | null;
    source?: string | null;
    favorite?: "all" | "transcribed" | "tags";
    tagId?: string | null;
    tagName?: string | null;
    untagged?: boolean;
    speaker?: string | null;
    timeline?: "all" | "today" | "yesterday" | "earlier";
};

export type RecordingListPagination = {
    page: number;
    pageSize: number;
    total: number;
};

export function resolveRecordingPagination(
    total: number,
    pageSize: number,
    requestedPage: number,
): RecordingListPagination {
    const normalizedTotal = Math.max(0, total);
    const normalizedPageSize = Math.min(Math.max(Math.floor(pageSize), 1), 200);
    const totalPages = Math.max(
        1,
        Math.ceil(normalizedTotal / normalizedPageSize),
    );

    return {
        page: Math.min(Math.max(1, Math.floor(requestedPage)), totalPages),
        pageSize: normalizedPageSize,
        total: normalizedTotal,
    };
}

type RecordingDetailReadOptions = {
    includeSegments?: boolean;
};

const recordingListSelection = {
    id: recordings.id,
    filename: recordings.filename,
    duration: recordings.duration,
    startTime: recordings.startTime,
    filesize: recordings.filesize,
    providerDeviceId: recordings.providerDeviceId,
    upstreamDeleted: recordings.upstreamDeleted,
    sourceProvider: recordings.sourceProvider,
    sourceRecordingId: recordings.sourceRecordingId,
    storagePath: recordings.storagePath,
};

const transcriptionSelection = {
    recordingId: transcriptions.recordingId,
    text: transcriptions.text,
    detectedLanguage: transcriptions.detectedLanguage,
    transcriptionType: transcriptions.transcriptionType,
    provider: transcriptions.provider,
    model: transcriptions.model,
    createdAt: transcriptions.createdAt,
    speakerMap: transcriptions.speakerMap,
    providerPayload: transcriptions.providerPayload,
};

const dashboardTranscriptionSelection = {
    recordingId: transcriptions.recordingId,
    hasTranscript: transcriptions.id,
    detectedLanguage: transcriptions.detectedLanguage,
    transcriptionType: transcriptions.transcriptionType,
};

const transcriptionJobSelection = {
    recordingId: transcriptionJobs.recordingId,
    status: transcriptionJobs.status,
    remoteStatus: transcriptionJobs.remoteStatus,
    lastError: transcriptionJobs.lastError,
    updatedAt: transcriptionJobs.updatedAt,
};

const transcriptSegmentSelection = {
    recordingId: transcriptSegments.recordingId,
    rawSpeakerLabel: transcriptSegments.rawSpeakerLabel,
    startMs: transcriptSegments.startMs,
    endMs: transcriptSegments.endMs,
    sortSeqMs: transcriptSegments.sortSeqMs,
    text: transcriptSegments.text,
};

async function listRecordingRowsForUser(
    userId: string,
    filters: RecordingListFilters = {},
) {
    const pageSize = filters.pageSize ?? filters.limit ?? 50;
    const requestedPage = filters.page ?? 1;
    const clauses = [
        eq(recordings.userId, userId),
        eq(recordings.upstreamTrashed, false),
    ];

    if (filters.source?.trim()) {
        clauses.push(eq(recordings.sourceProvider, filters.source.trim()));
    }

    if (filters.from) {
        clauses.push(gte(recordings.startTime, filters.from));
    }

    if (filters.to) {
        clauses.push(lte(recordings.startTime, filters.to));
    }

    if (filters.query?.trim()) {
        const pattern = `%${filters.query.trim()}%`;
        const transcriptRows = await db
            .select({ recordingId: transcriptions.recordingId })
            .from(transcriptions)
            .where(
                and(
                    eq(transcriptions.userId, userId),
                    like(transcriptions.text, pattern),
                ),
            );
        const transcriptIds = transcriptRows.map((row) => row.recordingId);
        const matchingTags = await db
            .select({ id: recordingTags.id })
            .from(recordingTags)
            .where(
                and(
                    eq(recordingTags.userId, userId),
                    like(recordingTags.name, pattern),
                ),
            );
        const matchingTagIds = matchingTags.map((tag) => tag.id);
        const matchingAssignments =
            matchingTagIds.length > 0
                ? await db
                      .select({
                          recordingId: recordingTagAssignments.recordingId,
                      })
                      .from(recordingTagAssignments)
                      .where(
                          and(
                              eq(recordingTagAssignments.userId, userId),
                              inArray(
                                  recordingTagAssignments.tagId,
                                  matchingTagIds,
                              ),
                          ),
                      )
                : [];
        const queryClauses = [
            like(recordings.filename, pattern),
            like(recordings.sourceProvider, pattern),
        ];
        if (transcriptIds.length > 0) {
            queryClauses.push(inArray(recordings.id, transcriptIds));
        }
        const tagRecordingIds = matchingAssignments.map(
            (assignment) => assignment.recordingId,
        );
        if (tagRecordingIds.length > 0) {
            queryClauses.push(inArray(recordings.id, tagRecordingIds));
        }
        const queryClause = or(...queryClauses);
        if (queryClause) {
            clauses.push(queryClause);
        }
    }

    if (filters.favorite === "transcribed" || filters.speaker?.trim()) {
        const transcriptClauses = [eq(transcriptions.userId, userId)];
        if (filters.speaker?.trim()) {
            transcriptClauses.push(
                like(transcriptions.speakerMap, `%${filters.speaker.trim()}%`),
            );
        }
        const transcriptRows = await db
            .select({ recordingId: transcriptions.recordingId })
            .from(transcriptions)
            .where(and(...transcriptClauses));
        const recordingIds = transcriptRows.map((row) => row.recordingId);
        if (recordingIds.length === 0) {
            return {
                pagination: resolveRecordingPagination(
                    0,
                    pageSize,
                    requestedPage,
                ),
                recordingRows: [],
            };
        }
        clauses.push(inArray(recordings.id, recordingIds));
    }

    if (
        filters.favorite === "tags" ||
        filters.tagId?.trim() ||
        filters.tagName?.trim() ||
        filters.untagged
    ) {
        const assignmentClauses = [eq(recordingTagAssignments.userId, userId)];
        if (filters.tagId?.trim()) {
            assignmentClauses.push(
                eq(recordingTagAssignments.tagId, filters.tagId.trim()),
            );
        } else if (filters.tagName?.trim()) {
            const tags = await db
                .select({ id: recordingTags.id })
                .from(recordingTags)
                .where(
                    and(
                        eq(recordingTags.userId, userId),
                        eq(recordingTags.name, filters.tagName.trim()),
                    ),
                );
            const tagIds = tags.map((tag) => tag.id);
            if (tagIds.length === 0) {
                return {
                    pagination: resolveRecordingPagination(
                        0,
                        pageSize,
                        requestedPage,
                    ),
                    recordingRows: [],
                };
            }
            assignmentClauses.push(
                inArray(recordingTagAssignments.tagId, tagIds),
            );
        }
        const assignments = await db
            .select({ recordingId: recordingTagAssignments.recordingId })
            .from(recordingTagAssignments)
            .where(and(...assignmentClauses));
        const recordingIds = assignments.map(
            (assignment) => assignment.recordingId,
        );

        if (filters.untagged) {
            if (recordingIds.length > 0) {
                clauses.push(notInArray(recordings.id, recordingIds));
            }
        } else if (recordingIds.length === 0) {
            return {
                pagination: resolveRecordingPagination(
                    0,
                    pageSize,
                    requestedPage,
                ),
                recordingRows: [],
            };
        } else {
            clauses.push(inArray(recordings.id, recordingIds));
        }
    }

    if (filters.timeline && filters.timeline !== "all") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (filters.timeline === "today") {
            clauses.push(gte(recordings.startTime, today));
        } else if (filters.timeline === "yesterday") {
            const yesterdayClause = and(
                gte(recordings.startTime, yesterday),
                lt(recordings.startTime, today),
            );
            if (yesterdayClause) {
                clauses.push(yesterdayClause);
            }
        } else {
            clauses.push(lt(recordings.startTime, yesterday));
        }
    }

    const where = and(...clauses);
    const [{ total }] = await db
        .select({ total: count() })
        .from(recordings)
        .where(where);
    const pagination = resolveRecordingPagination(
        Number(total),
        pageSize,
        requestedPage,
    );

    const recordingRows = await db
        .select(recordingListSelection)
        .from(recordings)
        .where(where)
        .orderBy(desc(recordings.startTime))
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize);

    return {
        pagination,
        recordingRows,
    };
}

async function listRecordingRelationsForUser(
    userId: string,
    recordingIds: string[],
    options: { includeTranscript?: boolean } = {},
) {
    if (recordingIds.length === 0) {
        return {
            transcriptionRows: [] as Array<
                RecordingTranscriptionRow | DashboardTranscriptionRow
            >,
            transcriptionJobRows: [] as RecordingTranscriptionJobRow[],
        };
    }

    const transcriptionRowsPromise =
        options.includeTranscript === false
            ? db
                  .select(dashboardTranscriptionSelection)
                  .from(transcriptions)
                  .where(
                      and(
                          eq(transcriptions.userId, userId),
                          inArray(transcriptions.recordingId, recordingIds),
                      ),
                  )
            : db
                  .select(transcriptionSelection)
                  .from(transcriptions)
                  .where(
                      and(
                          eq(transcriptions.userId, userId),
                          inArray(transcriptions.recordingId, recordingIds),
                      ),
                  );

    const [transcriptionRows, transcriptionJobRows] = await Promise.all([
        transcriptionRowsPromise,
        db
            .select(transcriptionJobSelection)
            .from(transcriptionJobs)
            .where(
                and(
                    eq(transcriptionJobs.userId, userId),
                    inArray(transcriptionJobs.recordingId, recordingIds),
                ),
            ),
    ]);

    return {
        transcriptionRows,
        transcriptionJobRows,
    };
}

async function listRecordingTagsForUser(
    userId: string,
    recordingIds: string[],
) {
    if (recordingIds.length === 0) {
        return [];
    }

    return db
        .select({
            recordingId: recordingTagAssignments.recordingId,
            tagId: recordingTags.id,
            tagName: recordingTags.name,
            tagColor: recordingTags.color,
            tagIcon: recordingTags.icon,
        })
        .from(recordingTagAssignments)
        .innerJoin(
            recordingTags,
            eq(recordingTags.id, recordingTagAssignments.tagId),
        )
        .where(
            and(
                eq(recordingTagAssignments.userId, userId),
                eq(recordingTags.userId, userId),
                inArray(recordingTagAssignments.recordingId, recordingIds),
            ),
        )
        .orderBy(desc(recordingTags.createdAt), asc(recordingTags.name));
}

async function listTranscriptSegmentsForUser(
    userId: string,
    recordingIds: string[],
) {
    if (recordingIds.length === 0) {
        return [] as RecordingTranscriptSegmentRow[];
    }

    return db
        .select(transcriptSegmentSelection)
        .from(transcriptSegments)
        .where(
            and(
                eq(transcriptSegments.userId, userId),
                inArray(transcriptSegments.recordingId, recordingIds),
            ),
        )
        .orderBy(asc(transcriptSegments.sortSeqMs));
}

export async function getDashboardRecordingsPageData(
    userId: string,
    filters: RecordingListFilters = {},
) {
    const { pagination, recordingRows } = await listRecordingRowsForUser(
        userId,
        filters,
    );
    const recordingIds = recordingRows.map((recording) => recording.id);
    const [{ transcriptionRows, transcriptionJobRows }, recordingTagRows] =
        await Promise.all([
            listRecordingRelationsForUser(userId, recordingIds, {
                includeTranscript: false,
            }),
            listRecordingTagsForUser(userId, recordingIds),
        ]);
    const tagsByRecordingId = buildRecordingTagMap(recordingTagRows);

    return {
        pagination,
        recordings: recordingRows.map((recording) =>
            serializeRecordingWithTags(
                recording,
                tagsByRecordingId.get(recording.id),
            ),
        ),
        transcriptions: buildDashboardTranscriptionMap(transcriptionRows),
        transcriptionJobs:
            buildDashboardTranscriptionJobMap(transcriptionJobRows),
    };
}

export async function getRecordingDetailReadModel(
    userId: string,
    recordingId: string,
    options: RecordingDetailReadOptions = {},
) {
    const [recording] = await db
        .select()
        .from(recordings)
        .where(
            and(eq(recordings.id, recordingId), eq(recordings.userId, userId)),
        )
        .limit(1);

    if (!recording) {
        return null;
    }

    const transcriptionRows = await db
        .select()
        .from(transcriptions)
        .where(
            and(
                eq(transcriptions.recordingId, recordingId),
                eq(transcriptions.userId, userId),
            ),
        )
        .limit(1);
    const transcriptionJobRows = await db
        .select(transcriptionJobSelection)
        .from(transcriptionJobs)
        .where(
            and(
                eq(transcriptionJobs.recordingId, recordingId),
                eq(transcriptionJobs.userId, userId),
            ),
        )
        .limit(1);
    const [transcription] = transcriptionRows;
    const [transcriptionJob] = transcriptionJobRows;
    const transcriptSegmentRows =
        options.includeSegments && transcription
            ? await listTranscriptSegmentsForUser(userId, [recordingId])
            : [];

    return {
        recording: recording as RecordingDetailRow,
        transcription:
            (transcription as RecordingDetailTranscriptionRow | undefined) ??
            null,
        transcriptionJob: transcriptionJob ?? null,
        transcriptSegments: transcriptSegmentRows,
    };
}

export async function getRecordingDetailPageData(
    userId: string,
    recordingId: string,
) {
    const detail = await getRecordingDetailReadModel(userId, recordingId, {
        includeSegments: true,
    });

    if (!detail) {
        return null;
    }

    const tagRows = await listRecordingTagsForUser(userId, [recordingId]);
    const tagsByRecordingId = buildRecordingTagMap(tagRows);

    return {
        recording: serializeRecordingWithTags(
            detail.recording,
            tagsByRecordingId.get(detail.recording.id),
        ),
        transcription: serializeRecordingDetailTranscription(
            detail.transcription
                ? {
                      recordingId: detail.transcription.recordingId,
                      text: detail.transcription.text,
                      detectedLanguage: detail.transcription.detectedLanguage,
                      transcriptionType: detail.transcription.transcriptionType,
                      provider: detail.transcription.provider,
                      model: detail.transcription.model,
                      createdAt: detail.transcription.createdAt,
                      speakerMap: detail.transcription.speakerMap,
                      providerPayload: detail.transcription.providerPayload,
                  }
                : null,
            detail.transcriptSegments,
        ),
        transcriptionJob: serializeRecordingDetailTranscriptionJob(
            detail.transcriptionJob,
        ),
    };
}

export async function queryRecordingsForUser(
    userId: string,
    {
        from = null,
        to = null,
        limit,
        page,
        pageSize,
        query,
        source,
        favorite,
        tagId,
        tagName,
        untagged,
        speaker,
        timeline,
        includeTranscript,
    }: RecordingListFilters & { includeTranscript: boolean },
) {
    const { pagination, recordingRows } = await listRecordingRowsForUser(
        userId,
        {
            from,
            to,
            limit,
            page,
            pageSize,
            query,
            source,
            favorite,
            tagId,
            tagName,
            untagged,
            speaker,
            timeline,
        },
    );
    const recordingIds = recordingRows.map((recording) => recording.id);
    const [{ transcriptionRows, transcriptionJobRows }, recordingTagRows] =
        await Promise.all([
            listRecordingRelationsForUser(userId, recordingIds, {
                includeTranscript,
            }),
            listRecordingTagsForUser(userId, recordingIds),
        ]);
    const tagsByRecordingId = buildRecordingTagMap(recordingTagRows);
    const fullTranscriptionRows = includeTranscript
        ? (transcriptionRows as RecordingTranscriptionRow[])
        : [];
    const transcriptionsByRecordingId = new Map(
        fullTranscriptionRows.map((row) => [row.recordingId, row]),
    );
    const jobsByRecordingId = new Map(
        transcriptionJobRows.map((row) => [row.recordingId, row]),
    );

    return {
        pagination,
        recordings: recordingRows.map((recording) =>
            serializeQueriedRecording(
                recording,
                transcriptionsByRecordingId.get(recording.id),
                jobsByRecordingId.get(recording.id),
                includeTranscript,
                tagsByRecordingId.get(recording.id),
            ),
        ),
    };
}
