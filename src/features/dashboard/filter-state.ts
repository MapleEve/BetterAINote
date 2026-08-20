export const DASHBOARD_FILTER_STATE_STORAGE_KEY =
    "dashboard-recording-filter-state";

export type DashboardFavoriteFilter = "all" | "transcribed" | "tags";
export type DashboardListMode = "timeline" | "tags";
export type DashboardTagFilter = "all" | "untagged" | `tag:${string}`;

export type DashboardFilterState = {
    favorite: DashboardFavoriteFilter;
    listMode: DashboardListMode;
    selectedTagFilter: DashboardTagFilter;
};

export const DEFAULT_DASHBOARD_FILTER_STATE: DashboardFilterState = {
    favorite: "all",
    listMode: "timeline",
    selectedTagFilter: "all",
};

export type DashboardFilterAction =
    | { type: "favorite"; value: DashboardFavoriteFilter }
    | { type: "list-mode"; value: DashboardListMode }
    | { type: "tag-filter"; value: DashboardTagFilter }
    | { available: readonly DashboardTagFilter[]; type: "reconcile-tags" };

function parseFavorite(value: unknown): DashboardFavoriteFilter | null {
    return value === "all" || value === "transcribed" || value === "tags"
        ? value
        : null;
}

function parseListMode(value: unknown): DashboardListMode | null {
    return value === "timeline" || value === "tags" ? value : null;
}

function parseTagFilter(value: unknown): DashboardTagFilter | null {
    if (value === "all" || value === "untagged") {
        return value;
    }
    if (
        typeof value === "string" &&
        value.startsWith("tag:") &&
        value.length > 4
    ) {
        return value as DashboardTagFilter;
    }
    return null;
}

function parseStoredState(value: string | null): DashboardFilterState | null {
    if (!value) {
        return null;
    }

    try {
        const parsed = JSON.parse(value) as Partial<DashboardFilterState>;
        const favorite = parseFavorite(parsed.favorite);
        const listMode = parseListMode(parsed.listMode);
        const selectedTagFilter = parseTagFilter(parsed.selectedTagFilter);
        if (!favorite || !listMode || !selectedTagFilter) {
            return null;
        }
        return { favorite, listMode, selectedTagFilter };
    } catch {
        return null;
    }
}

function readUrlOverrides(search: string) {
    const params = new URLSearchParams(search);
    const favorite = parseFavorite(params.get("favorite"));
    const listMode = parseListMode(params.get("mode"));
    const tagId = params.get("tagId")?.trim();
    const tagFilter = params.has("tagId")
        ? tagId
            ? (`tag:${tagId}` as DashboardTagFilter)
            : null
        : params.get("untagged") === "1"
          ? "untagged"
          : parseTagFilter(params.get("tag"));

    return { favorite, listMode, tagFilter };
}

export function restoreDashboardFilterState({
    search = "",
    storedValue,
}: {
    search?: string;
    storedValue: string | null;
}): DashboardFilterState {
    const stored = parseStoredState(storedValue);
    const restored = stored ?? DEFAULT_DASHBOARD_FILTER_STATE;
    const overrides = readUrlOverrides(search);

    return {
        favorite: overrides.favorite ?? restored.favorite,
        listMode: overrides.listMode ?? restored.listMode,
        selectedTagFilter: overrides.tagFilter ?? restored.selectedTagFilter,
    };
}

export function serializeDashboardFilterState(state: DashboardFilterState) {
    return JSON.stringify(state);
}

export function reduceDashboardFilterState(
    state: DashboardFilterState,
    action: DashboardFilterAction,
): DashboardFilterState {
    switch (action.type) {
        case "favorite":
            return {
                ...state,
                favorite: action.value,
                selectedTagFilter:
                    action.value === "all" ? "all" : state.selectedTagFilter,
            };
        case "list-mode":
            return { ...state, listMode: action.value };
        case "tag-filter":
            return { ...state, selectedTagFilter: action.value };
        case "reconcile-tags":
            if (state.selectedTagFilter === "untagged") {
                return state;
            }
            return action.available.includes(state.selectedTagFilter)
                ? state
                : { ...state, selectedTagFilter: "all" };
    }
}

export function dashboardFilterStateUrl(
    currentUrl: string,
    state: DashboardFilterState,
) {
    const url = new URL(currentUrl, "http://localhost");
    for (const key of ["favorite", "mode", "tag", "tagId", "untagged"]) {
        url.searchParams.delete(key);
    }

    if (state.favorite !== "all") {
        url.searchParams.set("favorite", state.favorite);
    }
    if (state.listMode !== "timeline") {
        url.searchParams.set("mode", state.listMode);
    }
    if (state.selectedTagFilter === "untagged") {
        url.searchParams.set("untagged", "1");
    } else if (state.selectedTagFilter.startsWith("tag:")) {
        url.searchParams.set("tagId", state.selectedTagFilter.slice(4));
    }

    return `${url.pathname}${url.search}${url.hash}`;
}
