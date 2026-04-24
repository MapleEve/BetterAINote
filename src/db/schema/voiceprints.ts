import {
    index,
    integer,
    sqliteTable,
    text,
    unique,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import { jsonText, timestampMs } from "./common";

export const speakerProfiles = sqliteTable(
    "speaker_profiles",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => nanoid()),
        userId: text("user_id").notNull(),
        displayName: text("display_name").notNull(),
        voiceprintRef: text("voiceprint_ref"),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        userIdIdx: index("speaker_profiles_user_id_idx").on(table.userId),
        userDisplayNameUnique: unique().on(table.userId, table.displayName),
    }),
);

export const recordingSpeakers = sqliteTable(
    "recording_speakers",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => nanoid()),
        userId: text("user_id").notNull(),
        recordingId: text("recording_id").notNull(),
        rawLabel: text("raw_label").notNull(),
        matchedProfileId: text("matched_profile_id").references(
            () => speakerProfiles.id,
            { onDelete: "set null" },
        ),
        sampleSegments:
            jsonText<
                Array<{
                    startMs: number | null;
                    endMs: number | null;
                    text?: string | null;
                }>
            >("sample_segments"),
        segmentCount: integer("segment_count").notNull().default(0),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        userIdIdx: index("recording_speakers_user_id_idx").on(table.userId),
        recordingIdIdx: index("recording_speakers_recording_id_idx").on(
            table.recordingId,
        ),
        recordingLabelUnique: unique().on(table.recordingId, table.rawLabel),
    }),
);

export const voiceprintsSchema = {
    speakerProfiles,
    recordingSpeakers,
};
