import { searchDb } from "@/db";
import { buildFtsMatchQuery } from "@/lib/search/tokenization";
import { buildSearchRowsQuery } from "./queries";

export const SEARCH_ENTITY_TYPES = [
    "recording",
    "transcript",
    "speaker",
    "tag",
] as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];
const SEARCH_ENTITY_TYPE_SET = new Set<string>(SEARCH_ENTITY_TYPES);

export type SearchResult = {
    entityType: SearchEntityType;
    entityId: string;
    recordingId: string | null;
    title: string | null;
    body: string;
    speaker: string | null;
    tags: string[];
    source: string | null;
    startMs: number | null;
    endMs: number | null;
    sortSeqMs: number;
    rank: number;
};

export type SearchLibraryParams = {
    userId: string;
    query: string;
    entityTypes?: SearchEntityType[];
    limit?: number;
};

export type SearchStorageRow = {
    documentRowid: number;
    chunkRowid: number;
    entityType: string;
    entityId: string;
    recordingId: string | null;
    title: string | null;
    body: string;
    speaker: string | null;
    tags: string | null;
    source: string | null;
    startMs: number | null;
    endMs: number | null;
    sortSeqMs: number;
    rank: number;
};

export type SearchStorageInput = {
    userId: string;
    matchQuery: string;
    entityTypes: SearchEntityType[];
    limit: number;
};

export type SearchStorage = {
    search(input: SearchStorageInput): Promise<SearchStorageRow[]>;
};

function clampLimit(value: number | undefined) {
    if (!Number.isFinite(value)) {
        return 50;
    }

    return Math.min(Math.max(Math.floor(value ?? 50), 1), 100);
}

function splitTags(value: string | null) {
    return (value ?? "")
        .split(/\s+/)
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function normalizeEntityTypes(entityTypes: SearchLibraryParams["entityTypes"]) {
    const values = entityTypes?.length ? entityTypes : SEARCH_ENTITY_TYPES;
    return [...new Set(values)].filter((value): value is SearchEntityType =>
        SEARCH_ENTITY_TYPE_SET.has(value),
    );
}

function mapSearchRow(row: SearchStorageRow): SearchResult {
    return {
        entityType: row.entityType as SearchEntityType,
        entityId: row.entityId,
        recordingId: row.recordingId,
        title: row.title,
        body: row.body,
        speaker: row.speaker,
        tags: splitTags(row.tags),
        source: row.source,
        startMs: row.startMs,
        endMs: row.endMs,
        sortSeqMs: row.sortSeqMs,
        rank: row.rank,
    };
}

const defaultSearchStorage: SearchStorage = {
    async search(input) {
        const rows = await searchDb.all(buildSearchRowsQuery(input));

        return rows as SearchStorageRow[];
    },
};

export function createSearchRepository(
    storage: SearchStorage = defaultSearchStorage,
) {
    return {
        async search(params: SearchLibraryParams) {
            const matchQuery = buildFtsMatchQuery(params.query);
            if (!matchQuery) {
                return [];
            }
            const entityTypes = normalizeEntityTypes(params.entityTypes);
            if (entityTypes.length === 0) {
                return [];
            }

            const rows = await storage.search({
                userId: params.userId,
                matchQuery,
                entityTypes,
                limit: clampLimit(params.limit),
            });

            return rows.map(mapSearchRow);
        },
    };
}

export async function searchLibrary(params: SearchLibraryParams) {
    return createSearchRepository().search(params);
}
