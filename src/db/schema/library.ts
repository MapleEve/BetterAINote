import {
    index,
    integer,
    sqliteTable,
    text,
    unique,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import { bool, jsonText, timestampMs } from "./common";

export const sourceDevices = sqliteTable(
    "source_devices",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => nanoid()),
        userId: text("user_id").notNull(),
        provider: text("provider").notNull(),
        providerDeviceId: text("provider_device_id").notNull(),
        name: text("name").notNull(),
        model: text("model").notNull(),
        versionNumber: integer("version_number"),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        userDeviceUnique: unique().on(
            table.userId,
            table.provider,
            table.providerDeviceId,
        ),
        userIdIdx: index("source_devices_user_id_idx").on(table.userId),
    }),
);

export const recordings = sqliteTable(
    "recordings",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => nanoid()),
        userId: text("user_id").notNull(),
        sourceProvider: text("source_provider").notNull(),
        sourceRecordingId: text("source_recording_id").notNull(),
        sourceVersion: text("source_version"),
        sourceMetadata: jsonText<Record<string, unknown>>("source_metadata"),
        providerDeviceId: text("provider_device_id").notNull(),
        filename: text("filename").notNull(),
        duration: integer("duration").notNull(),
        startTime: timestampMs("start_time").notNull(),
        endTime: timestampMs("end_time").notNull(),
        filesize: integer("filesize").notNull().default(0),
        fileMd5: text("file_md5").notNull().default(""),
        storageType: text("storage_type").notNull().default("local"),
        storagePath: text("storage_path").notNull().default(""),
        downloadedAt: timestampMs("downloaded_at"),
        upstreamTrashed: bool("upstream_trashed").notNull().default(false),
        upstreamDeleted: bool("upstream_deleted").notNull().default(false),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        userSourceRecordingUnique: unique().on(
            table.userId,
            table.sourceProvider,
            table.sourceRecordingId,
        ),
        userIdIdx: index("recordings_user_id_idx").on(table.userId),
        sourceIdx: index(
            "recordings_source_provider_source_recording_id_idx",
        ).on(table.sourceProvider, table.sourceRecordingId),
        userStartTimeIdx: index("recordings_user_id_start_time_idx").on(
            table.userId,
            table.startTime,
        ),
    }),
);

export const transcriptionJobs = sqliteTable(
    "transcription_jobs",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => nanoid()),
        userId: text("user_id").notNull(),
        recordingId: text("recording_id")
            .notNull()
            .unique()
            .references(() => recordings.id, { onDelete: "cascade" }),
        status: text("status").notNull().default("pending"),
        force: bool("force").notNull().default(false),
        provider: text("provider"),
        model: text("model"),
        providerJobId: text("provider_job_id"),
        remoteStatus: text("remote_status"),
        attempts: integer("attempts").notNull().default(0),
        compressionWarning: text("compression_warning"),
        lastError: text("last_error"),
        requestedAt: timestampMs("requested_at").notNull().defaultNow(),
        startedAt: timestampMs("started_at"),
        submittedAt: timestampMs("submitted_at"),
        lastPolledAt: timestampMs("last_polled_at"),
        completedAt: timestampMs("completed_at"),
        nextPollAt: timestampMs("next_poll_at"),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        userIdIdx: index("transcription_jobs_user_id_idx").on(table.userId),
        statusIdx: index("transcription_jobs_status_idx").on(table.status),
        requestedAtIdx: index("transcription_jobs_requested_at_idx").on(
            table.requestedAt,
        ),
    }),
);

export const librarySchema = {
    sourceDevices,
    recordings,
    transcriptionJobs,
};
