import type { InferSelectModel } from "drizzle-orm";
import type { recordings, transcriptionJobs } from "@/db/schema/library";
import type {
    transcriptions,
    transcriptSegments,
} from "@/db/schema/transcripts";
import {
    isRecordingTagColor,
    isRecordingTagIcon,
    type RecordingTag,
} from "@/lib/recording-tags";
import { sanitizeTranscriptionJobLastError } from "@/lib/transcription/public-errors";
import {
    applySpeakerMap,
    buildDisplaySegments,
    buildTranscriptMetrics,
    mergeSpeakerMaps,
} from "@/lib/transcription/voice-transcribe-metadata";
import type { Recording } from "@/types/recording";

type RecordingRow = InferSelectModel<typeof recordings>;
type TranscriptionRow = InferSelectModel<typeof transcriptions>;
type TranscriptSegmentRow = InferSelectModel<typeof transcriptSegments>;
type TranscriptionJobRow = InferSelectModel<typeof transcriptionJobs>;

export type RecordingListRow = Pick<
    RecordingRow,
    | "id"
    | "filename"
    | "duration"
    | "startTime"
    | "filesize"
    | "providerDeviceId"
    | "upstreamDeleted"
    | "sourceProvider"
    | "sourceRecordingId"
    | "storagePath"
>;

export type RecordingTranscriptionRow = Pick<
    TranscriptionRow,
    | "recordingId"
    | "text"
    | "detectedLanguage"
    | "transcriptionType"
    | "provider"
    | "model"
    | "createdAt"
    | "speakerMap"
    | "providerPayload"
>;

export type DashboardTranscriptionRow = Pick<
    TranscriptionRow,
    "recordingId" | "detectedLanguage" | "transcriptionType"
> & {
    hasTranscript: string | null;
};

export type RecordingTranscriptionJobRow = Pick<
    TranscriptionJobRow,
    "recordingId" | "status" | "remoteStatus" | "lastError" | "updatedAt"
>;

export type RecordingTranscriptSegmentRow = Pick<
    TranscriptSegmentRow,
    | "recordingId"
    | "rawSpeakerLabel"
    | "startMs"
    | "endMs"
    | "sortSeqMs"
    | "text"
>;

export type RecordingTagRow = {
    recordingId: string;
    tagId: string;
    tagName: string;
    tagColor: string;
    tagIcon: string;
};

export type DashboardTranscriptSegment = {
    text: string;
    speakerLabel?: string;
    displaySpeaker?: string;
    startMs?: number | null;
    endMs?: number | null;
};

export type DashboardTranscriptionData = {
    hasTranscript: boolean;
    text?: string;
    language?: string;
    speakerMap?: Record<string, string>;
    segments?: DashboardTranscriptSegment[];
};

export type DashboardTranscriptionJobData = {
    status: string;
    remoteStatus?: string | null;
    lastError?: string | null;
};

export type RecordingDetailTranscriptionData = {
    text: string;
    detectedLanguage?: string;
    transcriptionType?: string;
    speakerMap?: Record<string, string> | null;
    segments?: DashboardTranscriptSegment[];
};

export type RecordingDetailTranscriptionJobData = DashboardTranscriptionJobData;

export function serializeRecording(recording: RecordingListRow): Recording {
    const hasAudio = Boolean(recording.storagePath?.trim());

    return {
        id: recording.id,
        filename: recording.filename,
        duration: recording.duration,
        startTime: recording.startTime.toISOString(),
        filesize: recording.filesize,
        providerDeviceId: recording.providerDeviceId,
        upstreamDeleted: recording.upstreamDeleted,
        sourceProvider: recording.sourceProvider,
        sourceRecordingId: recording.sourceRecordingId,
        hasAudio,
        audioUrl: hasAudio ? `/api/recordings/${recording.id}/audio` : null,
        tags: [],
    };
}

export function buildRecordingTagMap(rows: RecordingTagRow[]) {
    const tagsByRecordingId = new Map<string, RecordingTag[]>();

    for (const row of rows) {
        const tags = tagsByRecordingId.get(row.recordingId) ?? [];
        tags.push({
            id: row.tagId,
            name: row.tagName,
            color: isRecordingTagColor(row.tagColor) ? row.tagColor : "purple",
            icon: isRecordingTagIcon(row.tagIcon) ? row.tagIcon : "grid",
        });
        tagsByRecordingId.set(row.recordingId, tags);
    }

    return tagsByRecordingId;
}

export function serializeRecordingWithTags(
    recording: RecordingListRow,
    tags: RecordingTag[] | undefined,
) {
    return {
        ...serializeRecording(recording),
        tags: tags ?? [],
    };
}

function groupTranscriptSegmentsByRecordingId(
    rows: RecordingTranscriptSegmentRow[],
) {
    const rowsByRecordingId = new Map<
        string,
        RecordingTranscriptSegmentRow[]
    >();

    for (const row of rows) {
        const rowsForRecording = rowsByRecordingId.get(row.recordingId) ?? [];
        rowsForRecording.push(row);
        rowsByRecordingId.set(row.recordingId, rowsForRecording);
    }

    return rowsByRecordingId;
}

function secondsToMs(value: unknown) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }

    return Math.max(0, Math.round(value * 1000));
}

export function buildSerializedTranscriptSegments(
    rows: RecordingTranscriptSegmentRow[],
    speakerMap: Record<string, string> | null | undefined,
): DashboardTranscriptSegment[] {
    return [...rows]
        .sort((left, right) => left.sortSeqMs - right.sortSeqMs)
        .flatMap((row) => {
            const text = row.text.trim();
            if (!text) {
                return [];
            }

            const speakerLabel = row.rawSpeakerLabel?.trim() || undefined;
            const displaySpeaker =
                (speakerLabel && speakerMap?.[speakerLabel]?.trim()) ||
                speakerLabel;

            return [
                {
                    text,
                    speakerLabel,
                    displaySpeaker,
                    startMs: row.startMs,
                    endMs: row.endMs,
                },
            ];
        });
}

function buildProviderPayloadSegments(
    transcription: RecordingTranscriptionRow,
    speakerMap: Record<string, string> | null | undefined,
): DashboardTranscriptSegment[] {
    return (
        buildDisplaySegments(transcription.providerPayload, speakerMap) ?? []
    ).flatMap((segment) => {
        const text = segment.text?.trim();
        if (!text) {
            return [];
        }

        return [
            {
                text,
                speakerLabel: segment.speakerLabel,
                displaySpeaker: segment.displaySpeaker,
                startMs: secondsToMs(segment.start),
                endMs: secondsToMs(segment.end),
            },
        ];
    });
}

function buildTranscriptSegments(
    transcription: RecordingTranscriptionRow,
    segmentRows: RecordingTranscriptSegmentRow[] | undefined,
    speakerMap: Record<string, string> | null | undefined,
) {
    const storedSegments = buildSerializedTranscriptSegments(
        segmentRows ?? [],
        speakerMap,
    );
    if (storedSegments.length > 0) {
        return storedSegments;
    }

    const providerSegments = buildProviderPayloadSegments(
        transcription,
        speakerMap,
    );
    return providerSegments.length > 0 ? providerSegments : undefined;
}

export function buildDashboardTranscriptionMap(
    rows: Array<DashboardTranscriptionRow | RecordingTranscriptionRow>,
    segmentRows: RecordingTranscriptSegmentRow[] = [],
) {
    const segmentsByRecordingId =
        groupTranscriptSegmentsByRecordingId(segmentRows);

    return new Map<string, DashboardTranscriptionData>(
        rows.map((row) => {
            const fullRow =
                "text" in row ? (row as RecordingTranscriptionRow) : null;
            const metadataRow = fullRow
                ? null
                : (row as DashboardTranscriptionRow);
            const speakerMap = fullRow
                ? mergeSpeakerMaps(fullRow.speakerMap, fullRow.providerPayload)
                : null;

            return [
                row.recordingId,
                {
                    hasTranscript: fullRow
                        ? Boolean(fullRow.text?.trim())
                        : Boolean(metadataRow?.hasTranscript),
                    text: fullRow?.text || undefined,
                    language: row.detectedLanguage || undefined,
                    speakerMap: speakerMap ?? undefined,
                    segments: fullRow
                        ? buildTranscriptSegments(
                              fullRow,
                              segmentsByRecordingId.get(row.recordingId),
                              speakerMap,
                          )
                        : undefined,
                },
            ];
        }),
    );
}

export function buildDashboardTranscriptionJobMap(
    rows: RecordingTranscriptionJobRow[],
) {
    return new Map<string, DashboardTranscriptionJobData>(
        rows.map((row) => [
            row.recordingId,
            {
                status: row.status,
                remoteStatus: row.remoteStatus,
                lastError: row.lastError,
            },
        ]),
    );
}

export function serializeRecordingDetailTranscription(
    transcription: RecordingTranscriptionRow | null,
    segmentRows: RecordingTranscriptSegmentRow[] = [],
): RecordingDetailTranscriptionData | undefined {
    if (!transcription) {
        return undefined;
    }

    const speakerMap = mergeSpeakerMaps(
        transcription.speakerMap,
        transcription.providerPayload,
    );

    return {
        text: transcription.text,
        detectedLanguage: transcription.detectedLanguage || undefined,
        transcriptionType: transcription.transcriptionType || undefined,
        speakerMap: speakerMap ?? undefined,
        segments: buildTranscriptSegments(
            transcription,
            segmentRows,
            speakerMap,
        ),
    };
}

export function serializeRecordingDetailTranscriptionJob(
    transcriptionJob: RecordingTranscriptionJobRow | null,
): RecordingDetailTranscriptionJobData | undefined {
    if (!transcriptionJob) {
        return undefined;
    }

    return {
        status: transcriptionJob.status,
        remoteStatus: transcriptionJob.remoteStatus,
        lastError: sanitizeTranscriptionJobLastError(
            transcriptionJob.lastError,
            transcriptionJob.status,
        ),
    };
}

export function serializeQueriedRecording(
    recording: RecordingListRow,
    transcription: RecordingTranscriptionRow | undefined,
    transcriptionJob: RecordingTranscriptionJobRow | undefined,
    includeTranscript: boolean,
    tags?: RecordingTag[],
) {
    const serializedRecording = serializeRecordingWithTags(recording, tags);
    const speakerMap =
        includeTranscript && transcription
            ? mergeSpeakerMaps(
                  transcription.speakerMap,
                  transcription.providerPayload,
              )
            : null;
    const metrics =
        includeTranscript && transcription
            ? buildTranscriptMetrics(transcription.text, speakerMap)
            : null;

    return {
        ...serializedRecording,
        rawTranscriptUrl: `/api/recordings/${recording.id}/transcript/raw`,
        speakerTranscriptUrl: `/api/recordings/${recording.id}/transcript/speakers`,
        transcriptionJob: transcriptionJob
            ? {
                  status: transcriptionJob.status,
                  remoteStatus: transcriptionJob.remoteStatus,
                  lastError: sanitizeTranscriptionJobLastError(
                      transcriptionJob.lastError,
                      transcriptionJob.status,
                  ),
                  updatedAt: transcriptionJob.updatedAt.toISOString(),
              }
            : null,
        transcript:
            !includeTranscript || !transcription
                ? null
                : {
                      rawText: transcription.text,
                      displayText: applySpeakerMap(
                          transcription.text,
                          speakerMap,
                      ),
                      detectedLanguage: transcription.detectedLanguage,
                      transcriptionType: transcription.transcriptionType,
                      provider: transcription.provider,
                      model: transcription.model,
                      createdAt: transcription.createdAt.toISOString(),
                      ...metrics,
                      speakerMap,
                  },
    };
}
