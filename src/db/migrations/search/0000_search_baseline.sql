CREATE TABLE `search_name2id` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`namespace` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_name2id_user_id_namespace_normalized_name_unique` ON `search_name2id` (`user_id`, `namespace`, `normalized_name`);
--> statement-breakpoint
CREATE INDEX `search_name2id_namespace_idx` ON `search_name2id` (`user_id`, `namespace`);
--> statement-breakpoint
CREATE TABLE `search_documents` (
	`rowid` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL CHECK (`entity_type` IN ('recording','transcript','speaker','tag')),
	`entity_id` text NOT NULL,
	`recording_id` text,
	`transcript_origin` text,
	`recording_name_id` integer,
	`speaker_name_id` integer,
	`tag_name_id` integer,
	`source_name_id` integer,
	`source_provider` text,
	`title` text,
	`start_ms` integer,
	`end_ms` integer,
	`sort_seq_ms` integer DEFAULT 0 NOT NULL,
	`content_hash` text NOT NULL,
	`index_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` integer,
	`indexed_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_documents_id_unique` ON `search_documents` (`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_documents_user_id_entity_type_entity_id_unique` ON `search_documents` (`user_id`, `entity_type`, `entity_id`);
--> statement-breakpoint
CREATE INDEX `search_documents_user_type_sort_idx` ON `search_documents` (`user_id`, `entity_type`, `sort_seq_ms`);
--> statement-breakpoint
CREATE INDEX `search_documents_recording_idx` ON `search_documents` (`user_id`, `recording_id`);
--> statement-breakpoint
CREATE INDEX `search_documents_content_hash_idx` ON `search_documents` (`content_hash`);
--> statement-breakpoint
CREATE TABLE `search_chunks` (
	`rowid` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_rowid` integer NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL CHECK (`entity_type` IN ('recording','transcript','speaker','tag')),
	`entity_id` text NOT NULL,
	`recording_id` text,
	`segment_id` text,
	`chunk_index` integer NOT NULL,
	`speaker_name_id` integer,
	`start_ms` integer,
	`end_ms` integer,
	`sort_seq_ms` integer DEFAULT 0 NOT NULL,
	`body` text NOT NULL,
	`body_hash` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_chunks_document_rowid_chunk_index_unique` ON `search_chunks` (`document_rowid`, `chunk_index`);
--> statement-breakpoint
CREATE INDEX `search_chunks_user_type_sort_idx` ON `search_chunks` (`user_id`, `entity_type`, `sort_seq_ms`);
--> statement-breakpoint
CREATE INDEX `search_chunks_recording_idx` ON `search_chunks` (`user_id`, `recording_id`);
--> statement-breakpoint
CREATE INDEX `search_chunks_body_hash_idx` ON `search_chunks` (`body_hash`);
--> statement-breakpoint
CREATE VIRTUAL TABLE `search_content_fts` USING fts5(
	`title`,
	`body`,
	`speaker`,
	`tags`,
	`source`,
	`entity_type` UNINDEXED,
	`entity_id` UNINDEXED,
	`recording_id` UNINDEXED,
	content=''
);
--> statement-breakpoint
CREATE TABLE `search_index_ranges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL CHECK (`entity_type` IN ('recording','transcript','speaker','tag')),
	`low_watermark` text,
	`high_watermark` text,
	`index_version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_index_ranges_user_id_entity_type_unique` ON `search_index_ranges` (`user_id`, `entity_type`);
--> statement-breakpoint
CREATE TABLE `search_tombstones` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL CHECK (`entity_type` IN ('recording','transcript','speaker','tag')),
	`entity_id` text NOT NULL,
	`deleted_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_tombstones_user_id_entity_type_entity_id_unique` ON `search_tombstones` (`user_id`, `entity_type`, `entity_id`);
--> statement-breakpoint
CREATE INDEX `search_tombstones_deleted_at_idx` ON `search_tombstones` (`deleted_at`);
--> statement-breakpoint
CREATE TABLE `search_index_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL CHECK (`entity_type` IN ('recording','transcript','speaker','tag')),
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`scheduled_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `search_index_jobs_pending_idx` ON `search_index_jobs` (`status`, `scheduled_at`);
--> statement-breakpoint
CREATE INDEX `search_index_jobs_entity_idx` ON `search_index_jobs` (`user_id`, `entity_type`, `entity_id`);
