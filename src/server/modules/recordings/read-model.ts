import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { recordings, transcriptionJobs } from "@/db/schema/library";
import { transcriptions } from "@/db/schema/transcripts";
import {
    buildDashboardTranscriptionJobMap,
    buildDashboardTranscriptionMap,
    type RecordingTranscriptionJobRow,
    type RecordingTranscriptionRow,
    serializeQueriedRecording,
    serializeRecording,
    serializeRecordingDetailTranscription,
    serializeRecordingDetailTranscriptionJob,
} from "./serialize";

type RecordingDetailRow = typeof recordings.$inferSelect;
type RecordingDetailTranscriptionRow = typeof transcriptions.$inferSelect;

type RecordingListFilters = {
    from?: Date | null;
    to?: Date | null;
    limit?: number;
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

const transcriptionJobSelection = {
    recordingId: transcriptionJobs.recordingId,
    status: transcriptionJobs.status,
    remoteStatus: transcriptionJobs.remoteStatus,
    lastError: transcriptionJobs.lastError,
    updatedAt: transcriptionJobs.updatedAt,
};

async function listRecordingRowsForUser(
    userId: string,
    filters: RecordingListFilters = {},
) {
    const clauses = [
        eq(recordings.userId, userId),
        eq(recordings.upstreamTrashed, false),
    ];

    if (filters.from) {
        clauses.push(gte(recordings.startTime, filters.from));
    }

    if (filters.to) {
        clauses.push(lte(recordings.startTime, filters.to));
    }

    const query = db
        .select(recordingListSelection)
        .from(recordings)
        .where(and(...clauses))
        .orderBy(desc(recordings.startTime));

    if (typeof filters.limit === "number") {
        return query.limit(filters.limit);
    }

    return query;
}

async function listRecordingRelationsForUser(
    userId: string,
    recordingIds: string[],
) {
    if (recordingIds.length === 0) {
        return {
            transcriptionRows: [] as RecordingTranscriptionRow[],
            transcriptionJobRows: [] as RecordingTranscriptionJobRow[],
        };
    }

    const [transcriptionRows, transcriptionJobRows] = await Promise.all([
        db
            .select(transcriptionSelection)
            .from(transcriptions)
            .where(
                and(
                    eq(transcriptions.userId, userId),
                    inArray(transcriptions.recordingId, recordingIds),
                ),
            ),
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

export async function getDashboardRecordingsPageData(userId: string) {
    const recordingRows = await listRecordingRowsForUser(userId);
    const recordingIds = recordingRows.map((recording) => recording.id);
    const { transcriptionRows, transcriptionJobRows } =
        await listRecordingRelationsForUser(userId, recordingIds);

    return {
        recordings: recordingRows.map(serializeRecording),
        transcriptions: buildDashboardTranscriptionMap(transcriptionRows),
        transcriptionJobs:
            buildDashboardTranscriptionJobMap(transcriptionJobRows),
    };
}

export async function getRecordingDetailReadModel(
    userId: string,
    recordingId: string,
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

    return {
        recording: recording as RecordingDetailRow,
        transcription:
            (transcription as RecordingDetailTranscriptionRow | undefined) ??
            null,
        transcriptionJob: transcriptionJob ?? null,
    };
}

export async function getRecordingDetailPageData(
    userId: string,
    recordingId: string,
) {
    const detail = await getRecordingDetailReadModel(userId, recordingId);

    if (!detail) {
        return null;
    }

    return {
        recording: serializeRecording(detail.recording),
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
        includeTranscript,
    }: RecordingListFilters & { includeTranscript: boolean },
) {
    const recordingRows = await listRecordingRowsForUser(userId, {
        from,
        to,
        limit,
    });
    const recordingIds = recordingRows.map((recording) => recording.id);
    const { transcriptionRows, transcriptionJobRows } =
        await listRecordingRelationsForUser(userId, recordingIds);
    const transcriptionsByRecordingId = new Map(
        transcriptionRows.map((row) => [row.recordingId, row]),
    );
    const jobsByRecordingId = new Map(
        transcriptionJobRows.map((row) => [row.recordingId, row]),
    );

    return recordingRows.map((recording) =>
        serializeQueriedRecording(
            recording,
            transcriptionsByRecordingId.get(recording.id),
            jobsByRecordingId.get(recording.id),
            includeTranscript,
        ),
    );
}
