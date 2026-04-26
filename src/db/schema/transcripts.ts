import {
    index,
    integer,
    sqliteTable,
    text,
    unique,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import type { VoiceTranscribePayload } from "@/lib/transcription/providers/types";
import { jsonText, timestampMs } from "./common";

export const transcriptions = sqliteTable(
    "transcriptions",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => nanoid()),
        recordingId: text("recording_id").notNull(),
        userId: text("user_id").notNull(),
        text: text("text").notNull(),
        detectedLanguage: text("detected_language"),
        transcriptionType: text("transcription_type")
            .notNull()
            .default("server"),
        provider: text("provider").notNull(),
        model: text("model").notNull(),
        providerJobId: text("provider_job_id"),
        speakerMap: jsonText<Record<string, string>>("speaker_map"),
        providerPayload: jsonText<VoiceTranscribePayload>("provider_payload"),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
    },
    (table) => ({
        recordingIdIdx: index("transcriptions_recording_id_idx").on(
            table.recordingId,
        ),
        userIdIdx: index("transcriptions_user_id_idx").on(table.userId),
    }),
);

export const sourceArtifacts = sqliteTable(
    "source_artifacts",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => nanoid()),
        recordingId: text("recording_id").notNull(),
        userId: text("user_id").notNull(),
        provider: text("provider").notNull(),
        artifactType: text("artifact_type").notNull(),
        title: text("title"),
        textContent: text("text_content"),
        markdownContent: text("markdown_content"),
        payload: jsonText<Record<string, unknown>>("payload"),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        recordingIdIdx: index("source_artifacts_recording_id_idx").on(
            table.recordingId,
        ),
        userIdIdx: index("source_artifacts_user_id_idx").on(table.userId),
        artifactUnique: unique().on(
            table.recordingId,
            table.provider,
            table.artifactType,
        ),
    }),
);

export const transcriptSegments = sqliteTable(
    "transcript_segments",
    {
        localId: integer("local_id").primaryKey({ autoIncrement: true }),
        id: text("id")
            .notNull()
            .$defaultFn(() => nanoid()),
        recordingId: text("recording_id").notNull(),
        userId: text("user_id").notNull(),
        transcriptionId: text("transcription_id"),
        sourceArtifactId: text("source_artifact_id"),
        transcriptOrigin: text("transcript_origin").notNull(),
        providerSegmentId: text("provider_segment_id"),
        speakerProfileId: text("speaker_profile_id"),
        rawSpeakerLabel: text("raw_speaker_label"),
        startMs: integer("start_ms"),
        endMs: integer("end_ms"),
        sortSeqMs: integer("sort_seq_ms").notNull(),
        text: text("text").notNull(),
        contentHash: text("content_hash").notNull(),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        idUnique: unique().on(table.id),
        userRecordingSortIdx: index(
            "transcript_segments_user_recording_sort_idx",
        ).on(table.userId, table.recordingId, table.sortSeqMs),
        transcriptionIdx: index("transcript_segments_transcription_idx").on(
            table.transcriptionId,
        ),
        sourceArtifactIdx: index("transcript_segments_source_artifact_idx").on(
            table.sourceArtifactId,
        ),
        speakerProfileIdx: index("transcript_segments_speaker_profile_idx").on(
            table.speakerProfileId,
        ),
        contentHashIdx: index("transcript_segments_content_hash_idx").on(
            table.contentHash,
        ),
    }),
);

export const sourceArtifactSegments = sqliteTable(
    "source_artifact_segments",
    {
        localId: integer("local_id").primaryKey({ autoIncrement: true }),
        id: text("id")
            .notNull()
            .$defaultFn(() => nanoid()),
        sourceArtifactId: text("source_artifact_id").notNull(),
        recordingId: text("recording_id").notNull(),
        userId: text("user_id").notNull(),
        segmentType: text("segment_type").notNull().default("body"),
        heading: text("heading"),
        sortOrder: integer("sort_order").notNull(),
        text: text("text").notNull(),
        contentHash: text("content_hash").notNull(),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        idUnique: unique().on(table.id),
        artifactOrderUnique: unique().on(
            table.sourceArtifactId,
            table.sortOrder,
        ),
        userRecordingIdx: index("source_artifact_segments_recording_idx").on(
            table.userId,
            table.recordingId,
        ),
        artifactIdx: index("source_artifact_segments_artifact_idx").on(
            table.sourceArtifactId,
        ),
        contentHashIdx: index("source_artifact_segments_content_hash_idx").on(
            table.contentHash,
        ),
    }),
);

export const transcriptsSchema = {
    transcriptions,
    sourceArtifacts,
    transcriptSegments,
    sourceArtifactSegments,
};
