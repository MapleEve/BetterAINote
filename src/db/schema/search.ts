import {
    index,
    integer,
    sqliteTable,
    text,
    unique,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import { timestampMs } from "./common";

export const searchName2Id = sqliteTable(
    "search_name2id",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        userId: text("user_id").notNull(),
        namespace: text("namespace").notNull(),
        name: text("name").notNull(),
        normalizedName: text("normalized_name").notNull(),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        userNamespaceNameUnique: unique().on(
            table.userId,
            table.namespace,
            table.normalizedName,
        ),
        namespaceIdx: index("search_name2id_namespace_idx").on(
            table.userId,
            table.namespace,
        ),
    }),
);

export const searchDocuments = sqliteTable(
    "search_documents",
    {
        rowid: integer("rowid").primaryKey({ autoIncrement: true }),
        id: text("id")
            .notNull()
            .$defaultFn(() => nanoid()),
        userId: text("user_id").notNull(),
        entityType: text("entity_type").notNull(),
        entityId: text("entity_id").notNull(),
        recordingId: text("recording_id"),
        transcriptOrigin: text("transcript_origin"),
        recordingNameId: integer("recording_name_id"),
        speakerNameId: integer("speaker_name_id"),
        tagNameId: integer("tag_name_id"),
        sourceNameId: integer("source_name_id"),
        sourceProvider: text("source_provider"),
        title: text("title"),
        startMs: integer("start_ms"),
        endMs: integer("end_ms"),
        sortSeqMs: integer("sort_seq_ms").notNull().default(0),
        contentHash: text("content_hash").notNull(),
        indexVersion: integer("index_version").notNull().default(1),
        deletedAt: timestampMs("deleted_at"),
        indexedAt: timestampMs("indexed_at").notNull().defaultNow(),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        idUnique: unique().on(table.id),
        entityUnique: unique().on(
            table.userId,
            table.entityType,
            table.entityId,
        ),
        userTypeSortIdx: index("search_documents_user_type_sort_idx").on(
            table.userId,
            table.entityType,
            table.sortSeqMs,
        ),
        recordingIdx: index("search_documents_recording_idx").on(
            table.userId,
            table.recordingId,
        ),
        contentHashIdx: index("search_documents_content_hash_idx").on(
            table.contentHash,
        ),
    }),
);

export const searchChunks = sqliteTable(
    "search_chunks",
    {
        rowid: integer("rowid").primaryKey({ autoIncrement: true }),
        documentRowid: integer("document_rowid").notNull(),
        userId: text("user_id").notNull(),
        entityType: text("entity_type").notNull(),
        entityId: text("entity_id").notNull(),
        recordingId: text("recording_id"),
        segmentId: text("segment_id"),
        chunkIndex: integer("chunk_index").notNull(),
        speakerNameId: integer("speaker_name_id"),
        startMs: integer("start_ms"),
        endMs: integer("end_ms"),
        sortSeqMs: integer("sort_seq_ms").notNull().default(0),
        body: text("body").notNull(),
        bodyHash: text("body_hash").notNull(),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        documentChunkUnique: unique().on(table.documentRowid, table.chunkIndex),
        userTypeSortIdx: index("search_chunks_user_type_sort_idx").on(
            table.userId,
            table.entityType,
            table.sortSeqMs,
        ),
        recordingIdx: index("search_chunks_recording_idx").on(
            table.userId,
            table.recordingId,
        ),
        bodyHashIdx: index("search_chunks_body_hash_idx").on(table.bodyHash),
    }),
);

export const searchContentFts = sqliteTable("search_content_fts", {
    rowid: integer("rowid").primaryKey(),
    title: text("title"),
    body: text("body"),
    speaker: text("speaker"),
    tags: text("tags"),
    source: text("source"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    recordingId: text("recording_id"),
});

export const searchIndexRanges = sqliteTable(
    "search_index_ranges",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => nanoid()),
        userId: text("user_id").notNull(),
        entityType: text("entity_type").notNull(),
        lowWatermark: text("low_watermark"),
        highWatermark: text("high_watermark"),
        indexVersion: integer("index_version").notNull().default(1),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        userTypeUnique: unique().on(table.userId, table.entityType),
    }),
);

export const searchTombstones = sqliteTable(
    "search_tombstones",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => nanoid()),
        userId: text("user_id").notNull(),
        entityType: text("entity_type").notNull(),
        entityId: text("entity_id").notNull(),
        deletedAt: timestampMs("deleted_at").notNull().defaultNow(),
    },
    (table) => ({
        entityUnique: unique().on(
            table.userId,
            table.entityType,
            table.entityId,
        ),
        deletedAtIdx: index("search_tombstones_deleted_at_idx").on(
            table.deletedAt,
        ),
    }),
);

export const searchIndexJobs = sqliteTable(
    "search_index_jobs",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => nanoid()),
        userId: text("user_id").notNull(),
        entityType: text("entity_type").notNull(),
        entityId: text("entity_id").notNull(),
        action: text("action").notNull(),
        status: text("status").notNull().default("pending"),
        attempts: integer("attempts").notNull().default(0),
        lastError: text("last_error"),
        scheduledAt: timestampMs("scheduled_at").notNull().defaultNow(),
        startedAt: timestampMs("started_at"),
        completedAt: timestampMs("completed_at"),
        createdAt: timestampMs("created_at").notNull().defaultNow(),
        updatedAt: timestampMs("updated_at").notNull().defaultNow(),
    },
    (table) => ({
        pendingIdx: index("search_index_jobs_pending_idx").on(
            table.status,
            table.scheduledAt,
        ),
        entityIdx: index("search_index_jobs_entity_idx").on(
            table.userId,
            table.entityType,
            table.entityId,
        ),
    }),
);

export const searchSchema = {
    searchName2Id,
    searchDocuments,
    searchChunks,
    searchContentFts,
    searchIndexRanges,
    searchTombstones,
    searchIndexJobs,
};
