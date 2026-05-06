import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, searchDb } from "@/db";
import {
    searchChunks,
    searchDocuments,
    searchName2Id,
} from "@/db/schema/search";
import { buildFtsIndexText } from "@/lib/search/tokenization";
import type { SearchDocumentDraft } from "@/server/modules/recordings/search-read-model";
import { chunkSearchText, hashSearchContent } from "./segmenter";

const FTS_DELETE_BATCH_SIZE = 200;

type FtsUpsertRow = {
    rowid: number;
    title: string | null | undefined;
    body: string;
    speaker: string | null | undefined;
    tags: string | null | undefined;
    source: string | null | undefined;
    entityType: string;
    entityId: string;
    recordingId: string | null;
};

type StoredSearchChunk = {
    rowid: number;
    entityType: SearchDocumentDraft["entityType"];
    entityId: string;
    recordingId: string | null;
    title: string | null;
    body: string;
    speaker: string | null;
    tags: string | null;
    source: string | null;
};

export const SEARCH_CONTENT_FTS_CREATE_SQL = `
    CREATE VIRTUAL TABLE search_content_fts USING fts5(
        title,
        body,
        speaker,
        tags,
        source,
        entity_type UNINDEXED,
        entity_id UNINDEXED,
        recording_id UNINDEXED
    )
`;

export function isContentlessSearchContentFtsSchema(
    createSql: string | null | undefined,
) {
    return /\bcontent\s*=\s*(['"]){2}/i.test(createSql ?? "");
}

export function buildFtsPayloadForChunk(
    input: SearchDocumentDraft,
    chunkText: string,
): Omit<FtsUpsertRow, "rowid" | "entityType" | "entityId" | "recordingId"> {
    if (input.entityType === "recording") {
        return {
            title: input.title ?? null,
            body: chunkText,
            speaker: null,
            tags: null,
            source: null,
        };
    }

    if (input.entityType === "transcript") {
        return {
            title: null,
            body: chunkText,
            speaker: null,
            tags: null,
            source: null,
        };
    }

    if (input.entityType === "speaker") {
        return {
            title: input.title ?? input.speaker ?? null,
            body: chunkText,
            speaker: input.speaker ?? input.title ?? null,
            tags: null,
            source: null,
        };
    }

    return {
        title: input.title ?? null,
        body: chunkText,
        speaker: null,
        tags: input.tags?.join(" ") ?? null,
        source: null,
    };
}

export function buildFtsPayloadForStoredChunk(
    row: StoredSearchChunk,
): FtsUpsertRow {
    const payload = buildFtsPayloadForChunk(
        {
            userId: "",
            entityType: row.entityType,
            entityId: row.entityId,
            recordingId: row.recordingId,
            title: row.title,
            body: row.body,
            speaker: row.speaker,
            tags: row.tags ? [row.tags] : null,
            source: row.source,
        },
        row.body,
    );

    return {
        rowid: row.rowid,
        ...payload,
        entityType: row.entityType,
        entityId: row.entityId,
        recordingId: row.recordingId,
    };
}

function normalizeName(value: string) {
    return value.trim().toLocaleLowerCase();
}

async function upsertSearchName(params: {
    userId: string;
    namespace: string;
    name: string | null | undefined;
}) {
    const name = params.name?.trim();
    if (!name) {
        return null;
    }

    const normalizedName = normalizeName(name);

    await db
        .insert(searchName2Id)
        .values({
            userId: params.userId,
            namespace: params.namespace,
            name,
            normalizedName,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [
                searchName2Id.userId,
                searchName2Id.namespace,
                searchName2Id.normalizedName,
            ],
            set: {
                name,
                updatedAt: new Date(),
            },
        });

    const [row] = await db
        .select({ id: searchName2Id.id })
        .from(searchName2Id)
        .where(
            and(
                eq(searchName2Id.userId, params.userId),
                eq(searchName2Id.namespace, params.namespace),
                eq(searchName2Id.normalizedName, normalizedName),
            ),
        )
        .limit(1);

    return row?.id ?? null;
}

export async function deleteFtsRowsByChunkRowids(chunkRowids: number[]) {
    if (chunkRowids.length === 0) {
        return;
    }

    await ensureWritableSearchContentFtsTable();

    for (
        let index = 0;
        index < chunkRowids.length;
        index += FTS_DELETE_BATCH_SIZE
    ) {
        const batch = chunkRowids.slice(index, index + FTS_DELETE_BATCH_SIZE);
        const rowids = batch.map((rowid) => sql`${rowid}`);
        await searchDb.run(sql`
            DELETE FROM search_content_fts
            WHERE rowid IN (${sql.join(rowids, sql`, `)})
        `);
    }
}

async function insertFtsRow(row: FtsUpsertRow) {
    await searchDb.run(sql`
        INSERT INTO search_content_fts(
            rowid,
            title,
            body,
            speaker,
            tags,
            source,
            entity_type,
            entity_id,
            recording_id
        )
        VALUES (
            ${row.rowid},
            ${buildFtsIndexText(row.title)},
            ${buildFtsIndexText(row.body)},
            ${buildFtsIndexText(row.speaker)},
            ${buildFtsIndexText(row.tags)},
            ${buildFtsIndexText(row.source)},
            ${row.entityType},
            ${row.entityId},
            ${row.recordingId}
        )
    `);
}

async function loadStoredSearchChunksForFts() {
    return (await searchDb.all(sql`
        SELECT
            c.rowid AS rowid,
            c.entity_type AS entityType,
            c.entity_id AS entityId,
            c.recording_id AS recordingId,
            d.title AS title,
            c.body AS body,
            speaker_name.name AS speaker,
            tag_name.name AS tags,
            source_name.name AS source
        FROM search_chunks c
        INNER JOIN search_documents d
            ON d.rowid = c.document_rowid
        LEFT JOIN search_name2id speaker_name
            ON speaker_name.id = d.speaker_name_id
        LEFT JOIN search_name2id tag_name
            ON tag_name.id = d.tag_name_id
        LEFT JOIN search_name2id source_name
            ON source_name.id = d.source_name_id
        ORDER BY c.rowid ASC
    `)) as StoredSearchChunk[];
}

async function ensureWritableSearchContentFtsTable() {
    const [schemaRow] = (await searchDb.all(sql`
        SELECT sql
        FROM sqlite_master
        WHERE type = 'table'
            AND name = 'search_content_fts'
        LIMIT 1
    `)) as Array<{ sql: string | null }>;

    if (schemaRow?.sql && !isContentlessSearchContentFtsSchema(schemaRow.sql)) {
        return;
    }

    const storedChunks = await loadStoredSearchChunksForFts();

    await searchDb.run(sql.raw("DROP TABLE IF EXISTS search_content_fts"));
    await searchDb.run(sql.raw(SEARCH_CONTENT_FTS_CREATE_SQL));

    for (const chunk of storedChunks) {
        await insertFtsRow(buildFtsPayloadForStoredChunk(chunk));
    }
}

async function deleteChunksForDocument(documentRowid: number) {
    const oldChunks = await db
        .select({ rowid: searchChunks.rowid })
        .from(searchChunks)
        .where(eq(searchChunks.documentRowid, documentRowid));

    await deleteFtsRowsByChunkRowids(oldChunks.map((chunk) => chunk.rowid));
    await db
        .delete(searchChunks)
        .where(eq(searchChunks.documentRowid, documentRowid));
}

export async function upsertSearchDocument(input: SearchDocumentDraft) {
    const [existingDocument] = await db
        .select({ rowid: searchDocuments.rowid })
        .from(searchDocuments)
        .where(
            and(
                eq(searchDocuments.userId, input.userId),
                eq(searchDocuments.entityType, input.entityType),
                eq(searchDocuments.entityId, input.entityId),
            ),
        )
        .limit(1);

    if (existingDocument) {
        await deleteChunksForDocument(existingDocument.rowid);
    }

    const [recordingNameId, speakerNameId, tagNameId, sourceNameId] =
        await Promise.all([
            upsertSearchName({
                userId: input.userId,
                namespace: "recording",
                name: input.title,
            }),
            upsertSearchName({
                userId: input.userId,
                namespace: "speaker",
                name: input.speaker,
            }),
            upsertSearchName({
                userId: input.userId,
                namespace: "tag",
                name: input.tags?.join(" "),
            }),
            upsertSearchName({
                userId: input.userId,
                namespace: "source",
                name: input.source,
            }),
        ]);

    const contentHash = hashSearchContent(
        [
            input.title ?? "",
            input.body,
            input.speaker ?? "",
            ...(input.tags ?? []),
            input.source ?? "",
        ].join("\n"),
    );

    await db
        .insert(searchDocuments)
        .values({
            userId: input.userId,
            entityType: input.entityType,
            entityId: input.entityId,
            recordingId: input.recordingId ?? null,
            transcriptOrigin: input.transcriptOrigin ?? null,
            recordingNameId,
            speakerNameId,
            tagNameId,
            sourceNameId,
            sourceProvider: input.sourceProvider ?? null,
            title: input.title ?? null,
            startMs: input.startMs ?? null,
            endMs: input.endMs ?? null,
            sortSeqMs: input.sortSeqMs ?? 0,
            contentHash,
            indexedAt: new Date(),
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [
                searchDocuments.userId,
                searchDocuments.entityType,
                searchDocuments.entityId,
            ],
            set: {
                recordingId: input.recordingId ?? null,
                transcriptOrigin: input.transcriptOrigin ?? null,
                recordingNameId,
                speakerNameId,
                tagNameId,
                sourceNameId,
                sourceProvider: input.sourceProvider ?? null,
                title: input.title ?? null,
                startMs: input.startMs ?? null,
                endMs: input.endMs ?? null,
                sortSeqMs: input.sortSeqMs ?? 0,
                contentHash,
                indexedAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            },
        });

    const [document] = await db
        .select({ rowid: searchDocuments.rowid })
        .from(searchDocuments)
        .where(
            and(
                eq(searchDocuments.userId, input.userId),
                eq(searchDocuments.entityType, input.entityType),
                eq(searchDocuments.entityId, input.entityId),
            ),
        )
        .limit(1);

    if (!document) {
        throw new Error("Failed to upsert search document");
    }

    const chunks = chunkSearchText(input.body);
    for (const chunk of chunks) {
        const [insertedChunk] = await db
            .insert(searchChunks)
            .values({
                documentRowid: document.rowid,
                userId: input.userId,
                entityType: input.entityType,
                entityId: input.entityId,
                recordingId: input.recordingId ?? null,
                segmentId:
                    input.entityType === "transcript" ? input.entityId : null,
                chunkIndex: chunk.index,
                speakerNameId,
                startMs: input.startMs ?? null,
                endMs: input.endMs ?? null,
                sortSeqMs: input.sortSeqMs ?? 0,
                body: chunk.text,
                bodyHash: hashSearchContent(chunk.text),
            })
            .returning({ rowid: searchChunks.rowid });

        const ftsPayload = buildFtsPayloadForChunk(input, chunk.text);
        await insertFtsRow({
            rowid: insertedChunk.rowid,
            ...ftsPayload,
            entityType: input.entityType,
            entityId: input.entityId,
            recordingId: input.recordingId ?? null,
        });
    }
}

export async function deleteSearchDocumentsForEntity(params: {
    userId: string;
    entityType: SearchDocumentDraft["entityType"];
    entityId: string;
}) {
    const rows = await db
        .select({ rowid: searchDocuments.rowid })
        .from(searchDocuments)
        .where(
            params.entityType === "recording"
                ? and(
                      eq(searchDocuments.userId, params.userId),
                      or(
                          and(
                              eq(searchDocuments.entityType, params.entityType),
                              eq(searchDocuments.entityId, params.entityId),
                          ),
                          eq(searchDocuments.recordingId, params.entityId),
                      ),
                  )
                : and(
                      eq(searchDocuments.userId, params.userId),
                      eq(searchDocuments.entityType, params.entityType),
                      eq(searchDocuments.entityId, params.entityId),
                  ),
        );

    for (const row of rows) {
        await deleteChunksForDocument(row.rowid);
    }

    if (rows.length > 0) {
        await db.delete(searchDocuments).where(
            inArray(
                searchDocuments.rowid,
                rows.map((row) => row.rowid),
            ),
        );
    }

    return rows.length;
}
