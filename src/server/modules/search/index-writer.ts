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

        await insertFtsRow({
            rowid: insertedChunk.rowid,
            title: input.title,
            body: chunk.text,
            speaker: input.speaker,
            tags: input.tags?.join(" "),
            source: input.source,
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
