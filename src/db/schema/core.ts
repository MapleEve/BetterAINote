import {
    integer,
    real,
    sqliteTable,
    text,
    unique,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import type { PromptConfiguration } from "@/types/ai";
import { bool, jsonText, timestampMs } from "./common";

export const users = sqliteTable("users", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => nanoid()),
    email: text("email").notNull().unique(),
    emailVerified: bool("email_verified").notNull().default(false),
    name: text("name"),
    createdAt: timestampMs("created_at").notNull().defaultNow(),
    updatedAt: timestampMs("updated_at").notNull().defaultNow(),
});

export const sessions = sqliteTable("sessions", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => nanoid()),
    expiresAt: timestampMs("expires_at").notNull(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestampMs("created_at").notNull().defaultNow(),
    updatedAt: timestampMs("updated_at").notNull().defaultNow(),
});

export const accounts = sqliteTable("accounts", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => nanoid()),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestampMs("expires_at"),
    password: text("password"),
    createdAt: timestampMs("created_at").notNull().defaultNow(),
    updatedAt: timestampMs("updated_at").notNull().defaultNow(),
});

export const verifications = sqliteTable("verifications", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => nanoid()),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestampMs("expires_at").notNull(),
    createdAt: timestampMs("created_at").notNull().defaultNow(),
    updatedAt: timestampMs("updated_at").notNull().defaultNow(),
});

export const apiCredentials = sqliteTable("api_credentials", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => nanoid()),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    apiKey: text("api_key").notNull(),
    baseUrl: text("base_url"),
    defaultModel: text("default_model"),
    isDefaultTranscription: bool("is_default_transcription")
        .notNull()
        .default(false),
    createdAt: timestampMs("created_at").notNull().defaultNow(),
    updatedAt: timestampMs("updated_at").notNull().defaultNow(),
});

export const sourceConnections = sqliteTable(
    "source_connections",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => nanoid()),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        provider: text("provider").notNull(),
        enabled: bool("enabled").notNull().default(false),
        authMode: text("auth_mode"),
        baseUrl: text("base_url"),
        config: jsonText<Record<string, unknown>>("config"),
        secretConfig: text("secret_config"),
        lastSync: timestampMs("last_sync"),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        userProviderUnique: unique().on(table.userId, table.provider),
    }),
);

export const userSettings = sqliteTable("user_settings", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => nanoid()),
    userId: text("user_id")
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: "cascade" }),
    syncInterval: integer("sync_interval").notNull().default(300000),
    autoTranscribe: bool("auto_transcribe").notNull().default(false),
    autoSyncEnabled: bool("auto_sync_enabled").notNull().default(true),
    defaultPlaybackSpeed: real("default_playback_speed").notNull().default(1),
    defaultVolume: integer("default_volume").notNull().default(75),
    autoPlayNext: bool("auto_play_next").notNull().default(false),
    defaultTranscriptionLanguage: text("default_transcription_language"),
    speakerDiarization: bool("speaker_diarization").notNull().default(false),
    diarizationSpeakers: integer("diarization_speakers"),
    privateTranscriptionBaseUrl: text("private_transcription_base_url"),
    privateTranscriptionMinSpeakers: integer(
        "private_transcription_min_speakers",
    )
        .notNull()
        .default(0),
    privateTranscriptionMaxSpeakers: integer(
        "private_transcription_max_speakers",
    )
        .notNull()
        .default(0),
    privateTranscriptionDenoiseModel: text(
        "private_transcription_denoise_model",
    )
        .notNull()
        .default("none"),
    privateTranscriptionSnrThreshold: real(
        "private_transcription_snr_threshold",
    ),
    privateTranscriptionNoRepeatNgramSize: integer(
        "private_transcription_no_repeat_ngram_size",
    )
        .notNull()
        .default(0),
    privateTranscriptionMaxInflightJobs: integer(
        "private_transcription_max_inflight_jobs",
    )
        .notNull()
        .default(1),
    uiLanguage: text("ui_language").notNull().default("zh-CN"),
    dateTimeFormat: text("date_time_format").notNull().default("relative"),
    recordingListSortOrder: text("recording_list_sort_order")
        .notNull()
        .default("newest"),
    itemsPerPage: integer("items_per_page").notNull().default(50),
    theme: text("theme").notNull().default("system"),
    autoGenerateTitle: bool("auto_generate_title").notNull().default(true),
    titleGenerationPrompt: jsonText<PromptConfiguration>(
        "title_generation_prompt",
    ),
    titleGenerationBaseUrl: text("title_generation_base_url"),
    titleGenerationModel: text("title_generation_model"),
    createdAt: timestampMs("created_at").notNull().defaultNow(),
    updatedAt: timestampMs("updated_at").notNull().defaultNow(),
});

export const syncWorkerState = sqliteTable("sync_worker_state", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => nanoid()),
    userId: text("user_id")
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: "cascade" }),
    lastHeartbeatAt: timestampMs("last_heartbeat_at"),
    lastStartedAt: timestampMs("last_started_at"),
    lastFinishedAt: timestampMs("last_finished_at"),
    nextRunAt: timestampMs("next_run_at"),
    manualTriggerRequestedAt: timestampMs("manual_trigger_requested_at"),
    isRunning: bool("is_running").notNull().default(false),
    lastError: text("last_error"),
    lastSummary: jsonText<{
        newRecordings: number;
        updatedRecordings: number;
        removedRecordings: number;
        errorCount: number;
    }>("last_summary"),
    createdAt: timestampMs("created_at").notNull().defaultNow(),
    updatedAt: timestampMs("updated_at").notNull().defaultNow(),
});

export const coreSchema = {
    users,
    sessions,
    accounts,
    verifications,
    apiCredentials,
    sourceConnections,
    userSettings,
    syncWorkerState,
};
