import type { InferSelectModel } from "drizzle-orm";
import type { recordings, transcriptionJobs } from "@/db/schema/library";
import type { transcriptions } from "@/db/schema/transcripts";
import {
    isRecordingTagColor,
    isRecordingTagIcon,
    type RecordingTag,
} from "@/lib/recording-tags";
import { sanitizeTranscriptionJobLastError } from "@/lib/transcription/public-errors";
import {
    applySpeakerMap,
    buildTranscriptMetrics,
    mergeSpeakerMaps,
} from "@/lib/transcription/voice-transcribe-metadata";
import type { Recording } from "@/types/recording";

type RecordingRow = InferSelectModel<typeof recordings>;
type TranscriptionRow = InferSelectModel<typeof transcriptions>;
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

export type RecordingTagRow = {
    recordingId: string;
    tagId: string;
    tagName: string;
    tagColor: string;
    tagIcon: string;
};

export type DashboardTranscriptionData = {
    hasTranscript: boolean;
    text?: string;
    language?: string;
    speakerMap?: Record<string, string>;
    segments?: NonNullable<
        ReturnType<
            typeof import("@/lib/transcription/voice-transcribe-metadata").buildDisplaySegments
        >
    >;
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
            color: isRecordingTagColor(row.tagColor) ? row.tagColor : "gray",
            icon: isRecordingTagIcon(row.tagIcon) ? row.tagIcon : "tag",
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

export function buildDashboardTranscriptionMap(
    rows: DashboardTranscriptionRow[],
) {
    return new Map<string, DashboardTranscriptionData>(
        rows.map((row) => [
            row.recordingId,
            {
                hasTranscript: Boolean(row.hasTranscript),
                language: row.detectedLanguage || undefined,
            },
        ]),
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
): RecordingDetailTranscriptionData | undefined {
    if (!transcription) {
        return undefined;
    }

    return {
        text: transcription.text,
        detectedLanguage: transcription.detectedLanguage || undefined,
        transcriptionType: transcription.transcriptionType || undefined,
        speakerMap: transcription.speakerMap ?? undefined,
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
        lastError: transcriptionJob.lastError,
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
