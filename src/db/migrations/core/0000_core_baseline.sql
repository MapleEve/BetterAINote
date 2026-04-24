CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`name` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`user_id` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`expires_at` integer,
	`password` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`api_key` text NOT NULL,
	`base_url` text,
	`default_model` text,
	`is_default_transcription` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `source_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`auth_mode` text,
	`base_url` text,
	`config` text,
	`secret_config` text,
	`last_sync` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_connections_user_id_provider_unique` ON `source_connections` (`user_id`, `provider`);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`sync_interval` integer DEFAULT 300000 NOT NULL,
	`auto_transcribe` integer DEFAULT 0 NOT NULL,
	`auto_sync_enabled` integer DEFAULT 1 NOT NULL,
	`default_playback_speed` real DEFAULT 1 NOT NULL,
	`default_volume` integer DEFAULT 75 NOT NULL,
	`auto_play_next` integer DEFAULT 0 NOT NULL,
	`default_transcription_language` text,
	`speaker_diarization` integer DEFAULT 0 NOT NULL,
	`diarization_speakers` integer,
	`private_transcription_base_url` text,
	`private_transcription_min_speakers` integer DEFAULT 0 NOT NULL,
	`private_transcription_max_speakers` integer DEFAULT 0 NOT NULL,
	`private_transcription_denoise_model` text DEFAULT 'none' NOT NULL,
	`private_transcription_snr_threshold` real,
	`private_transcription_max_inflight_jobs` integer DEFAULT 1 NOT NULL,
	`ui_language` text DEFAULT 'zh-CN' NOT NULL,
	`date_time_format` text DEFAULT 'relative' NOT NULL,
	`recording_list_sort_order` text DEFAULT 'newest' NOT NULL,
	`items_per_page` integer DEFAULT 50 NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`auto_generate_title` integer DEFAULT 1 NOT NULL,
	`title_generation_prompt` text,
	`title_generation_base_url` text,
	`title_generation_model` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_user_id_unique` ON `user_settings` (`user_id`);
--> statement-breakpoint
CREATE TABLE `sync_worker_state` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`last_heartbeat_at` integer,
	`last_started_at` integer,
	`last_finished_at` integer,
	`next_run_at` integer,
	`manual_trigger_requested_at` integer,
	`is_running` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`last_summary` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_worker_state_user_id_unique` ON `sync_worker_state` (`user_id`);
