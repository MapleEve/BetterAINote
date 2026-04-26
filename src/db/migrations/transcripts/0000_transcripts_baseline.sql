CREATE TABLE `transcriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`recording_id` text NOT NULL,
	`user_id` text NOT NULL,
	`text` text NOT NULL,
	`detected_language` text,
	`transcription_type` text DEFAULT 'server' NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`provider_job_id` text,
	`speaker_map` text,
	`provider_payload` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transcriptions_recording_id_idx` ON `transcriptions` (`recording_id`);
--> statement-breakpoint
CREATE INDEX `transcriptions_user_id_idx` ON `transcriptions` (`user_id`);
--> statement-breakpoint
CREATE TABLE `source_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`recording_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`artifact_type` text NOT NULL,
	`title` text,
	`text_content` text,
	`markdown_content` text,
	`payload` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `source_artifacts_recording_id_idx` ON `source_artifacts` (`recording_id`);
--> statement-breakpoint
CREATE INDEX `source_artifacts_user_id_idx` ON `source_artifacts` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_artifacts_recording_id_provider_artifact_type_unique` ON `source_artifacts` (`recording_id`, `provider`, `artifact_type`);
--> statement-breakpoint
CREATE TABLE `transcript_segments` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`recording_id` text NOT NULL,
	`user_id` text NOT NULL,
	`transcription_id` text,
	`source_artifact_id` text,
	`transcript_origin` text NOT NULL,
	`provider_segment_id` text,
	`speaker_profile_id` text,
	`raw_speaker_label` text,
	`start_ms` integer,
	`end_ms` integer,
	`sort_seq_ms` integer NOT NULL,
	`text` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transcript_segments_id_unique` ON `transcript_segments` (`id`);
--> statement-breakpoint
CREATE INDEX `transcript_segments_user_recording_sort_idx` ON `transcript_segments` (`user_id`, `recording_id`, `sort_seq_ms`);
--> statement-breakpoint
CREATE INDEX `transcript_segments_transcription_idx` ON `transcript_segments` (`transcription_id`);
--> statement-breakpoint
CREATE INDEX `transcript_segments_source_artifact_idx` ON `transcript_segments` (`source_artifact_id`);
--> statement-breakpoint
CREATE INDEX `transcript_segments_speaker_profile_idx` ON `transcript_segments` (`speaker_profile_id`);
--> statement-breakpoint
CREATE INDEX `transcript_segments_content_hash_idx` ON `transcript_segments` (`content_hash`);
--> statement-breakpoint
CREATE TABLE `source_artifact_segments` (
	`local_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`source_artifact_id` text NOT NULL,
	`recording_id` text NOT NULL,
	`user_id` text NOT NULL,
	`segment_type` text DEFAULT 'body' NOT NULL,
	`heading` text,
	`sort_order` integer NOT NULL,
	`text` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_artifact_segments_id_unique` ON `source_artifact_segments` (`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_artifact_segments_source_artifact_id_sort_order_unique` ON `source_artifact_segments` (`source_artifact_id`, `sort_order`);
--> statement-breakpoint
CREATE INDEX `source_artifact_segments_recording_idx` ON `source_artifact_segments` (`user_id`, `recording_id`);
--> statement-breakpoint
CREATE INDEX `source_artifact_segments_artifact_idx` ON `source_artifact_segments` (`source_artifact_id`);
--> statement-breakpoint
CREATE INDEX `source_artifact_segments_content_hash_idx` ON `source_artifact_segments` (`content_hash`);
