import { index, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
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

export const transcriptsSchema = {
    transcriptions,
    sourceArtifacts,
};
