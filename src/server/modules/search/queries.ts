import { sql } from "drizzle-orm";
import type { SearchEntityType } from "./search-repository";

export type SearchRowsQueryInput = {
    userId: string;
    matchQuery: string;
    entityTypes: SearchEntityType[];
    limit: number;
};

export function buildSearchRowsQuery(input: SearchRowsQueryInput) {
    const entityTypeSql = input.entityTypes.map(
        (entityType) => sql`${entityType}`,
    );

    return sql`
        SELECT
            d.rowid AS documentRowid,
            c.rowid AS chunkRowid,
            d.entity_type AS entityType,
            d.entity_id AS entityId,
            d.recording_id AS recordingId,
            d.title AS title,
            c.body AS body,
            f.speaker AS speaker,
            f.tags AS tags,
            f.source AS source,
            c.start_ms AS startMs,
            c.end_ms AS endMs,
            c.sort_seq_ms AS sortSeqMs,
            bm25(search_content_fts) AS rank
        FROM search_content_fts f
        JOIN search_chunks c ON c.rowid = f.rowid
        JOIN search_documents d ON d.rowid = c.document_rowid
        WHERE d.user_id = ${input.userId}
            AND d.deleted_at IS NULL
            AND d.entity_type IN (${sql.join(entityTypeSql, sql`, `)})
            AND search_content_fts MATCH ${input.matchQuery}
        ORDER BY rank ASC, d.sort_seq_ms DESC, c.chunk_index ASC
        LIMIT ${input.limit}
    `;
}
