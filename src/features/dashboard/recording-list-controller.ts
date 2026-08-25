import type { RecordingListSortOrder } from "@/services/display-settings";
import type { Recording } from "@/types/recording";

export type RecordingListTimelineFilter =
    | "all"
    | "today"
    | "yesterday"
    | "last7"
    | "earlier";

export type RecordingListTagFacet = {
    color: string;
    count: number;
    id: string;
    icon: string;
    name: string;
};

export type RecordingListFacets = {
    timeline: Record<RecordingListTimelineFilter, number>;
    tags: {
        all: number;
        items: RecordingListTagFacet[];
        untagged: number;
    };
};

export type RecordingListQueryInput = {
    anchorRecordingId?: string | null;
    favorite: "all" | "transcribed" | "tags";
    includeTranscript?: boolean;
    libraryFilter?: { label: string; type: "speaker" | "tag" } | null;
    listMode: "timeline" | "tags";
    page: number;
    pageSize: number;
    query: string;
    selectedTagFilter: "all" | "untagged" | `tag:${string}`;
    sort: RecordingListSortOrder;
    source: string;
    timeline: RecordingListTimelineFilter;
};

const EMPTY_TIMELINE_COUNTS: Record<RecordingListTimelineFilter, number> = {
    all: 0,
    today: 0,
    yesterday: 0,
    last7: 0,
    earlier: 0,
};

function finiteCount(value: unknown) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : null;
}

function recordValue(value: unknown) {
    return typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)
        : null;
}

function timelineCounts(value: unknown) {
    const counts = { ...EMPTY_TIMELINE_COUNTS };
    const record = recordValue(value);
    if (record) {
        for (const key of Object.keys(
            counts,
        ) as RecordingListTimelineFilter[]) {
            const count = finiteCount(record[key]);
            if (count !== null) counts[key] = count;
        }
        return counts;
    }

    return counts;
}

/** Keeps the locked API response shape isolated from the workstation. */
export function adaptRecordingListFacets(
    value: unknown,
): RecordingListFacets | null {
    const raw = recordValue(value);
    if (!raw) return null;

    const rawTags = recordValue(raw.tags);
    const tags = Array.isArray(rawTags?.items)
        ? rawTags.items.flatMap((candidate) => {
              const row = recordValue(candidate);
              if (!row) return [];
              const id =
                  typeof row.id === "string"
                      ? row.id
                      : typeof row.value === "string"
                        ? row.value
                        : null;
              const name =
                  typeof row.name === "string"
                      ? row.name
                      : typeof row.label === "string"
                        ? row.label
                        : null;
              const count = finiteCount(row.count ?? row.total);
              const color = typeof row.color === "string" ? row.color : null;
              const icon = typeof row.icon === "string" ? row.icon : null;
              return id && name && color && icon && count !== null
                  ? [{ color, count, icon, id, name }]
                  : [];
          })
        : [];

    return {
        timeline: timelineCounts(raw.timeline),
        tags: {
            all: finiteCount(rawTags?.all) ?? 0,
            items: tags,
            untagged: finiteCount(rawTags?.untagged) ?? 0,
        },
    };
}

export function buildRecordingListQueryParams(input: RecordingListQueryInput) {
    const params = new URLSearchParams({
        includeTranscript: input.includeTranscript === false ? "0" : "1",
        page: String(Math.max(1, input.page)),
        pageSize: String(Math.max(1, input.pageSize)),
        sort: input.sort,
    });

    if (input.anchorRecordingId?.trim()) {
        params.set("anchorRecordingId", input.anchorRecordingId.trim());
    }

    if (input.source !== "all") params.set("source", input.source);
    if (input.query.trim()) params.set("query", input.query.trim());
    if (input.favorite !== "all") params.set("favorite", input.favorite);
    if (input.libraryFilter?.type === "tag") {
        params.set("tagName", input.libraryFilter.label);
    }
    if (input.libraryFilter?.type === "speaker") {
        params.set("speaker", input.libraryFilter.label);
    }
    if (input.listMode === "tags") {
        if (input.selectedTagFilter === "untagged") {
            params.set("untagged", "1");
        } else if (input.selectedTagFilter.startsWith("tag:")) {
            params.set("tagId", input.selectedTagFilter.slice(4));
        }
    }
    if (input.listMode === "timeline" && input.timeline !== "all") {
        params.set("timeline", input.timeline);
    }

    return params;
}

export function getRecordingTimelineFilter(
    value: string,
    now = new Date(),
): Exclude<RecordingListTimelineFilter, "all"> {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "earlier";
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.floor(
        (today.getTime() - start.getTime()) / 86_400_000,
    );
    if (dayDiff <= 0) return "today";
    if (dayDiff === 1) return "yesterday";
    if (dayDiff <= 7) return "last7";
    return "earlier";
}

function sqliteNoCaseKey(value: string) {
    return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/** Mirrors the API's total-order contract; production pages preserve API order. */
export function sortRecordings(
    items: readonly Recording[],
    sort: RecordingListSortOrder,
    _locale: string,
) {
    return [...items].sort((left, right) => {
        if (sort === "name") {
            const leftName = sqliteNoCaseKey(left.filename);
            const rightName = sqliteNoCaseKey(right.filename);
            return (
                (leftName < rightName ? -1 : leftName > rightName ? 1 : 0) ||
                left.id.localeCompare(right.id)
            );
        }
        const delta =
            new Date(left.startTime).getTime() -
            new Date(right.startTime).getTime();
        return (
            (sort === "oldest" ? delta : -delta) ||
            left.id.localeCompare(right.id)
        );
    });
}

export function reconcileRecordingSelection({
    currentId,
    requestedId,
    recordingIds,
}: {
    currentId: string | null;
    requestedId: string | null;
    recordingIds: readonly string[];
}) {
    if (requestedId && recordingIds.includes(requestedId)) return requestedId;
    if (currentId && recordingIds.includes(currentId)) return currentId;
    return recordingIds[0] ?? null;
}
