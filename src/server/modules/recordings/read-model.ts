import {
    and,
    asc,
    count,
    countDistinct,
    desc,
    eq,
    gte,
    inArray,
    like,
    lt,
    lte,
    or,
    type SQL,
    sql,
} from "drizzle-orm";
import { db, type LibraryReadDb, withLibraryReadSnapshot } from "@/db";
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

export type RecordingListSort = "newest" | "oldest" | "name";
export type RecordingTimelineFilter =
    | "all"
    | "today"
    | "yesterday"
    | "last7"
    | "earlier";

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
    timeline?: RecordingTimelineFilter;
    sort?: RecordingListSort;
};

export type RecordingListFacets = {
    timeline: Record<RecordingTimelineFilter, number>;
    tags: {
        all: number;
        untagged: number;
        items: Array<{
            id: string;
            name: string;
            color: string;
            icon: string;
            count: number;
        }>;
    };
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

type RecordingFacetDimension = "timeline" | "tags";
type RecordingCandidateSets = {
    queryTranscriptIds?: string[];
    transcriptFilterIds?: string[];
};
type RecordingTimelineBoundaries = ReturnType<typeof getTimelineBoundaries>;

function getTimelineBoundaries() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const last7Start = new Date(today);
    last7Start.setDate(last7Start.getDate() - 7);

    return { last7Start, today, yesterday };
}

function getTimelineClause(
    timeline: RecordingTimelineFilter | undefined,
    { last7Start, today, yesterday }: RecordingTimelineBoundaries,
) {
    if (!timeline || timeline === "all") {
        return null;
    }

    if (timeline === "today") {
        return gte(recordings.startTime, today);
    }
    if (timeline === "yesterday") {
        return and(
            gte(recordings.startTime, yesterday),
            lt(recordings.startTime, today),
        );
    }
    if (timeline === "last7") {
        return and(
            gte(recordings.startTime, last7Start),
            lt(recordings.startTime, yesterday),
        );
    }

    return lt(recordings.startTime, last7Start);
}

function idsFromJson(column: typeof recordings.id, ids: string[]) {
    if (ids.length === 0) {
        return sql`0 = 1`;
    }

    // One JSON parameter avoids SQLite's host-parameter limit even for a large
    // tenant-scoped transcript candidate set from the transcripts shard.
    return sql`${column} in (select value from json_each(${JSON.stringify(ids)}))`;
}

function hasAnyTagClause(userId: string) {
    return sql`exists (
        select 1 from ${recordingTagAssignments}
        where ${recordingTagAssignments.userId} = ${userId}
          and ${recordingTagAssignments.recordingId} = ${recordings.id}
    )`;
}

function buildRecordingClauses(
    userId: string,
    filters: RecordingListFilters = {},
    candidates: RecordingCandidateSets = {},
    timelineBoundaries: RecordingTimelineBoundaries = getTimelineBoundaries(),
    omitDimension?: RecordingFacetDimension,
) {
    const clauses: SQL[] = [
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
        const queryClauses = [
            like(recordings.filename, pattern),
            like(recordings.sourceProvider, pattern),
            sql`exists (
                select 1
                from ${recordingTagAssignments}
                inner join ${recordingTags}
                    on ${recordingTags.id} = ${recordingTagAssignments.tagId}
                   and ${recordingTags.userId} = ${userId}
                where ${recordingTagAssignments.userId} = ${userId}
                  and ${recordingTagAssignments.recordingId} = ${recordings.id}
                  and ${recordingTags.name} like ${pattern}
            )`,
        ];
        if (candidates.queryTranscriptIds?.length) {
            queryClauses.push(
                idsFromJson(recordings.id, candidates.queryTranscriptIds),
            );
        }
        const queryClause = or(...queryClauses);
        if (queryClause) {
            clauses.push(queryClause);
        }
    }

    if (filters.favorite === "transcribed" || filters.speaker?.trim()) {
        clauses.push(
            idsFromJson(recordings.id, candidates.transcriptFilterIds ?? []),
        );
    }

    const hasAnyTag = hasAnyTagClause(userId);
    if (filters.favorite === "tags" && omitDimension !== "tags") {
        clauses.push(hasAnyTag);
    }

    if (omitDimension !== "tags") {
        if (filters.untagged) {
            clauses.push(sql`not (${hasAnyTag})`);
        } else if (filters.tagId?.trim()) {
            clauses.push(
                sql`exists (
                    select 1 from ${recordingTagAssignments}
                    where ${recordingTagAssignments.userId} = ${userId}
                      and ${recordingTagAssignments.recordingId} = ${recordings.id}
                      and ${recordingTagAssignments.tagId} = ${filters.tagId.trim()}
                )`,
            );
        } else if (filters.tagName?.trim()) {
            clauses.push(sql`exists (
                select 1
                from ${recordingTagAssignments}
                inner join ${recordingTags}
                    on ${recordingTags.id} = ${recordingTagAssignments.tagId}
                   and ${recordingTags.userId} = ${userId}
                where ${recordingTagAssignments.userId} = ${userId}
                  and ${recordingTagAssignments.recordingId} = ${recordings.id}
                  and ${recordingTags.name} = ${filters.tagName.trim()}
            )`);
        }
    }

    if (omitDimension !== "timeline") {
        const timelineClause = getTimelineClause(
            filters.timeline,
            timelineBoundaries,
        );
        if (timelineClause) {
            clauses.push(timelineClause);
        }
    }

    return clauses;
}

function getRecordingOrder(sort: RecordingListSort = "newest") {
    if (sort === "oldest") {
        return [asc(recordings.startTime), asc(recordings.id)] as const;
    }
    if (sort === "name") {
        return [
            sql`${recordings.filename} collate nocase asc`,
            asc(recordings.id),
        ] as const;
    }

    return [desc(recordings.startTime), asc(recordings.id)] as const;
}

async function listRecordingRowsForUser(
    database: LibraryReadDb,
    userId: string,
    filters: RecordingListFilters = {},
    candidates: RecordingCandidateSets = {},
    timelineBoundaries: RecordingTimelineBoundaries = getTimelineBoundaries(),
) {
    const pageSize = filters.pageSize ?? filters.limit ?? 50;
    const requestedPage = filters.page ?? 1;
    const clauses = buildRecordingClauses(
        userId,
        filters,
        candidates,
        timelineBoundaries,
    );
    const where = and(...clauses);
    const [{ total }] = await database
        .select({ total: count() })
        .from(recordings)
        .where(where);
    const pagination = resolveRecordingPagination(
        Number(total),
        pageSize,
        requestedPage,
    );

    const recordingRows = await database
        .select(recordingListSelection)
        .from(recordings)
        .where(where)
        .orderBy(...getRecordingOrder(filters.sort))
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize);

    return {
        pagination,
        recordingRows,
    };
}

async function resolveRecordingCandidateSets(
    userId: string,
    filters: RecordingListFilters,
): Promise<RecordingCandidateSets> {
    const queryText = filters.query?.trim();
    const speaker = filters.speaker?.trim();
    const [queryRows, filterRows] = await Promise.all([
        queryText
            ? db
                  .select({ recordingId: transcriptions.recordingId })
                  .from(transcriptions)
                  .where(
                      and(
                          eq(transcriptions.userId, userId),
                          like(transcriptions.text, `%${queryText}%`),
                      ),
                  )
            : Promise.resolve([]),
        filters.favorite === "transcribed" || speaker
            ? db
                  .select({ recordingId: transcriptions.recordingId })
                  .from(transcriptions)
                  .where(
                      and(
                          eq(transcriptions.userId, userId),
                          ...(speaker
                              ? [
                                    like(
                                        transcriptions.speakerMap,
                                        `%${speaker}%`,
                                    ),
                                ]
                              : []),
                      ),
                  )
            : Promise.resolve([]),
    ]);

    return {
        queryTranscriptIds: queryRows.map((row) => row.recordingId),
        transcriptFilterIds: filterRows.map((row) => row.recordingId),
    };
}

async function getRecordingListFacets(
    database: LibraryReadDb,
    userId: string,
    filters: RecordingListFilters,
    candidates: RecordingCandidateSets,
    timelineBoundaries: RecordingTimelineBoundaries,
): Promise<RecordingListFacets> {
    const timelineClauses = buildRecordingClauses(
        userId,
        filters,
        candidates,
        timelineBoundaries,
        "timeline",
    );
    const tagClauses = buildRecordingClauses(
        userId,
        filters,
        candidates,
        timelineBoundaries,
        "tags",
    );
    const { last7Start, today, yesterday } = timelineBoundaries;
    const [timelineRow] = await database
        .select({
            all: count(),
            today: sql<number>`sum(case when ${recordings.startTime} >= ${today} then 1 else 0 end)`,
            yesterday: sql<number>`sum(case when ${recordings.startTime} >= ${yesterday} and ${recordings.startTime} < ${today} then 1 else 0 end)`,
            last7: sql<number>`sum(case when ${recordings.startTime} >= ${last7Start} and ${recordings.startTime} < ${yesterday} then 1 else 0 end)`,
            earlier: sql<number>`sum(case when ${recordings.startTime} < ${last7Start} then 1 else 0 end)`,
        })
        .from(recordings)
        .where(and(...timelineClauses));
    const tagTotals = await database
        .select({
            all: countDistinct(recordings.id),
            untagged: sql<number>`count(distinct case when ${recordingTagAssignments.id} is null then ${recordings.id} end)`,
        })
        .from(recordings)
        .leftJoin(
            recordingTagAssignments,
            and(
                eq(recordingTagAssignments.userId, userId),
                eq(recordingTagAssignments.recordingId, recordings.id),
            ),
        )
        .where(and(...tagClauses));
    const tagRows = await database
        .select({
            id: recordingTags.id,
            name: recordingTags.name,
            color: recordingTags.color,
            icon: recordingTags.icon,
            count: countDistinct(recordings.id),
        })
        .from(recordings)
        .innerJoin(
            recordingTagAssignments,
            and(
                eq(recordingTagAssignments.userId, userId),
                eq(recordingTagAssignments.recordingId, recordings.id),
            ),
        )
        .innerJoin(
            recordingTags,
            and(
                eq(recordingTags.userId, userId),
                eq(recordingTags.id, recordingTagAssignments.tagId),
            ),
        )
        .where(and(...tagClauses))
        .groupBy(
            recordingTags.id,
            recordingTags.name,
            recordingTags.color,
            recordingTags.icon,
        )
        .orderBy(asc(recordingTags.name), asc(recordingTags.id));
    const [tagTotalRow] = tagTotals;

    return {
        timeline: {
            all: Number(timelineRow?.all ?? 0),
            today: Number(timelineRow?.today ?? 0),
            yesterday: Number(timelineRow?.yesterday ?? 0),
            last7: Number(timelineRow?.last7 ?? 0),
            earlier: Number(timelineRow?.earlier ?? 0),
        },
        tags: {
            all: Number(tagTotalRow?.all ?? 0),
            untagged: Number(tagTotalRow?.untagged ?? 0),
            items: tagRows.map((row) => ({
                id: row.id,
                name: row.name,
                color: row.color,
                icon: row.icon,
                count: Number(row.count),
            })),
        },
    };
}

async function listRecordingTranscriptionsForUser(
    userId: string,
    recordingIds: string[],
    options: { includeTranscript?: boolean } = {},
) {
    if (recordingIds.length === 0) {
        return [] as Array<
            RecordingTranscriptionRow | DashboardTranscriptionRow
        >;
    }

    return options.includeTranscript === false
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
}

async function listRecordingJobsFromLibrary(
    database: LibraryReadDb,
    userId: string,
    recordingIds: string[],
) {
    if (recordingIds.length === 0) {
        return [] as RecordingTranscriptionJobRow[];
    }

    return database
        .select(transcriptionJobSelection)
        .from(transcriptionJobs)
        .where(
            and(
                eq(transcriptionJobs.userId, userId),
                inArray(transcriptionJobs.recordingId, recordingIds),
            ),
        );
}

async function listRecordingTagsFromLibrary(
    database: LibraryReadDb,
    userId: string,
    recordingIds: string[],
) {
    if (recordingIds.length === 0) {
        return [];
    }

    return database
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

export async function getRecordingTagsForUser(
    userId: string,
    recordingId: string,
) {
    const tagRows = await withLibraryReadSnapshot((database) =>
        listRecordingTagsFromLibrary(database, userId, [recordingId]),
    );
    return buildRecordingTagMap(tagRows).get(recordingId) ?? [];
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
    const timelineBoundaries = getTimelineBoundaries();
    const candidates = await resolveRecordingCandidateSets(userId, filters);
    const snapshot = await withLibraryReadSnapshot(async (database) => {
        const { pagination, recordingRows } = await listRecordingRowsForUser(
            database,
            userId,
            filters,
            candidates,
            timelineBoundaries,
        );
        const recordingIds = recordingRows.map((recording) => recording.id);
        const transcriptionJobRows = await listRecordingJobsFromLibrary(
            database,
            userId,
            recordingIds,
        );
        const recordingTagRows = await listRecordingTagsFromLibrary(
            database,
            userId,
            recordingIds,
        );

        return {
            pagination,
            recordingRows,
            recordingTagRows,
            transcriptionJobRows,
        };
    });
    const recordingIds = snapshot.recordingRows.map(
        (recording) => recording.id,
    );
    const transcriptionRows = await listRecordingTranscriptionsForUser(
        userId,
        recordingIds,
        { includeTranscript: false },
    );
    const tagsByRecordingId = buildRecordingTagMap(snapshot.recordingTagRows);

    return {
        pagination: snapshot.pagination,
        recordings: snapshot.recordingRows.map((recording) =>
            serializeRecordingWithTags(
                recording,
                tagsByRecordingId.get(recording.id),
            ),
        ),
        transcriptions: buildDashboardTranscriptionMap(transcriptionRows),
        transcriptionJobs: buildDashboardTranscriptionJobMap(
            snapshot.transcriptionJobRows,
        ),
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

    const tags = await getRecordingTagsForUser(userId, recordingId);

    return {
        recording: serializeRecordingWithTags(detail.recording, tags),
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

async function queryRecordingsForUserUnchecked(
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
        sort,
        includeTranscript,
    }: RecordingListFilters & { includeTranscript: boolean },
) {
    const normalizedFilters = {
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
        sort,
    } satisfies RecordingListFilters;
    const candidates = await resolveRecordingCandidateSets(
        userId,
        normalizedFilters,
    );
    const timelineBoundaries = getTimelineBoundaries();
    const snapshot = await withLibraryReadSnapshot(async (database) => {
        const { pagination, recordingRows } = await listRecordingRowsForUser(
            database,
            userId,
            normalizedFilters,
            candidates,
            timelineBoundaries,
        );
        const facets = await getRecordingListFacets(
            database,
            userId,
            normalizedFilters,
            candidates,
            timelineBoundaries,
        );
        const recordingIds = recordingRows.map((recording) => recording.id);
        const transcriptionJobRows = await listRecordingJobsFromLibrary(
            database,
            userId,
            recordingIds,
        );
        const recordingTagRows = await listRecordingTagsFromLibrary(
            database,
            userId,
            recordingIds,
        );

        return {
            facets,
            pagination,
            recordingRows,
            recordingTagRows,
            transcriptionJobRows,
        };
    });
    // The library shard above is atomic on one owned SQLite snapshot. The
    // transcripts shard is a separate source of truth, so candidate and
    // transcription reads intentionally remain outside that atomic boundary.
    const recordingIds = snapshot.recordingRows.map(
        (recording) => recording.id,
    );
    const transcriptionRows = await listRecordingTranscriptionsForUser(
        userId,
        recordingIds,
        { includeTranscript },
    );
    const tagsByRecordingId = buildRecordingTagMap(snapshot.recordingTagRows);
    const fullTranscriptionRows = includeTranscript
        ? (transcriptionRows as RecordingTranscriptionRow[])
        : [];
    const transcriptionsByRecordingId = new Map(
        fullTranscriptionRows.map((row) => [row.recordingId, row]),
    );
    const jobsByRecordingId = new Map(
        snapshot.transcriptionJobRows.map((row) => [row.recordingId, row]),
    );

    return {
        facets: snapshot.facets,
        pagination: snapshot.pagination,
        recordings: snapshot.recordingRows.map((recording) =>
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

export async function queryRecordingsForUser(
    userId: string,
    filters: RecordingListFilters & { includeTranscript: boolean },
) {
    try {
        return await queryRecordingsForUserUnchecked(userId, filters);
    } catch (cause) {
        throw new Error("Failed to query recordings", { cause });
    }
}
