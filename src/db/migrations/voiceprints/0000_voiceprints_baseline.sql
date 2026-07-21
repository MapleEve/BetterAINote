CREATE TABLE `speaker_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`voiceprint_ref` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `speaker_profiles_user_id_idx` ON `speaker_profiles` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `speaker_profiles_user_display_name_unique` ON `speaker_profiles` (`user_id`, `display_name`);
--> statement-breakpoint
CREATE TABLE `speaker_profile_retry_authorizations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mutation` text NOT NULL,
	`profile_id` text NOT NULL,
	`nonce` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `speaker_profile_retry_authorizations_nonce_unique` ON `speaker_profile_retry_authorizations` (`nonce`);
--> statement-breakpoint
CREATE INDEX `speaker_profile_retry_authorizations_user_expiry_idx` ON `speaker_profile_retry_authorizations` (`user_id`, `expires_at`);
--> statement-breakpoint
CREATE TABLE `recording_speakers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recording_id` text NOT NULL,
	`raw_label` text NOT NULL,
	`matched_profile_id` text,
	`sample_segments` text,
	`segment_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`matched_profile_id`) REFERENCES `speaker_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `recording_speakers_user_id_idx` ON `recording_speakers` (`user_id`);
--> statement-breakpoint
CREATE INDEX `recording_speakers_recording_id_idx` ON `recording_speakers` (`recording_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `recording_speakers_recording_label_unique` ON `recording_speakers` (`recording_id`, `raw_label`);
