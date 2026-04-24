import type { InferSelectModel } from "drizzle-orm";
import type { recordings, transcriptionJobs } from "@/db/schema/library";
import type { transcriptions } from "@/db/schema/transcripts";
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

export type RecordingTranscriptionJobRow = Pick<
    TranscriptionJobRow,
    "recordingId" | "status" | "remoteStatus" | "lastError" | "updatedAt"
>;

export type DashboardTranscriptionData = {
    text: string;
    language?: string;
    speakerMap?: Record<string, string>;
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
    };
}

export function buildDashboardTranscriptionMap(
    rows: RecordingTranscriptionRow[],
) {
    return new Map<string, DashboardTranscriptionData>(
        rows.map((row) => [
            row.recordingId,
            {
                text: row.text,
                language: row.detectedLanguage || undefined,
                speakerMap: row.speakerMap ?? undefined,
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
) {
    const serializedRecording = serializeRecording(recording);
    const speakerMap = transcription
        ? mergeSpeakerMaps(
              transcription.speakerMap,
              transcription.providerPayload,
          )
        : null;
    const metrics = transcription
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
