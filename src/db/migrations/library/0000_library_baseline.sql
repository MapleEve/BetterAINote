CREATE TABLE `source_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_device_id` text NOT NULL,
	`name` text NOT NULL,
	`model` text NOT NULL,
	`version_number` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_devices_user_provider_device_unique` ON `source_devices` (`user_id`, `provider`, `provider_device_id`);
--> statement-breakpoint
CREATE INDEX `source_devices_user_id_idx` ON `source_devices` (`user_id`);
--> statement-breakpoint
CREATE TABLE `recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_provider` text NOT NULL,
	`source_recording_id` text NOT NULL,
	`source_version` text,
	`source_metadata` text,
	`provider_device_id` text NOT NULL,
	`filename` text NOT NULL,
	`duration` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`filesize` integer DEFAULT 0 NOT NULL,
	`file_md5` text DEFAULT '' NOT NULL,
	`storage_type` text DEFAULT 'local' NOT NULL,
	`storage_path` text DEFAULT '' NOT NULL,
	`downloaded_at` integer,
	`upstream_trashed` integer DEFAULT 0 NOT NULL,
	`upstream_deleted` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recordings_user_id_source_provider_source_recording_id_unique` ON `recordings` (`user_id`, `source_provider`, `source_recording_id`);
--> statement-breakpoint
CREATE INDEX `recordings_user_id_idx` ON `recordings` (`user_id`);
--> statement-breakpoint
CREATE INDEX `recordings_source_provider_source_recording_id_idx` ON `recordings` (`source_provider`, `source_recording_id`);
--> statement-breakpoint
CREATE INDEX `recordings_user_id_start_time_idx` ON `recordings` (`user_id`, `start_time`);
--> statement-breakpoint
CREATE TABLE `recording_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'gray' NOT NULL,
	`icon` text DEFAULT 'tag' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recording_tags_user_id_name_unique` ON `recording_tags` (`user_id`, `name`);
--> statement-breakpoint
CREATE INDEX `recording_tags_user_id_idx` ON `recording_tags` (`user_id`);
--> statement-breakpoint
CREATE TABLE `recording_tag_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recording_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`recording_id`) REFERENCES `recordings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `recording_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recording_tag_assignments_user_id_recording_id_tag_id_unique` ON `recording_tag_assignments` (`user_id`, `recording_id`, `tag_id`);
--> statement-breakpoint
CREATE INDEX `recording_tag_assignments_recording_idx` ON `recording_tag_assignments` (`user_id`, `recording_id`);
--> statement-breakpoint
CREATE INDEX `recording_tag_assignments_tag_idx` ON `recording_tag_assignments` (`user_id`, `tag_id`);
--> statement-breakpoint
CREATE TABLE `transcription_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recording_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`force` integer DEFAULT 0 NOT NULL,
	`provider` text,
	`model` text,
	`provider_job_id` text,
	`remote_status` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`compression_warning` text,
	`last_error` text,
	`requested_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`started_at` integer,
	`submitted_at` integer,
	`last_polled_at` integer,
	`completed_at` integer,
	`next_poll_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`recording_id`) REFERENCES `recordings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transcription_jobs_recording_id_unique` ON `transcription_jobs` (`recording_id`);
--> statement-breakpoint
CREATE INDEX `transcription_jobs_user_id_idx` ON `transcription_jobs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `transcription_jobs_status_idx` ON `transcription_jobs` (`status`);
--> statement-breakpoint
CREATE INDEX `transcription_jobs_requested_at_idx` ON `transcription_jobs` (`requested_at`);
