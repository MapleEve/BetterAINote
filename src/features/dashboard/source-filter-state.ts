export const DASHBOARD_SOURCE_FILTER_STORAGE_KEY =
    "dashboard-source-filter-provider";

const DASHBOARD_SOURCE_PROVIDERS = [
    "dingtalk-a1",
    "ticnote",
    "plaud",
    "feishu-minutes",
    "iflyrec",
] as const;

export type DashboardSourceFilter =
    | "all"
    | (typeof DASHBOARD_SOURCE_PROVIDERS)[number];

function isDashboardSourceProvider(
    value: string | null,
): value is Exclude<DashboardSourceFilter, "all"> {
    return (
        value !== null &&
        DASHBOARD_SOURCE_PROVIDERS.some((provider) => provider === value)
    );
}

export function parseDashboardSourceFilter(
    value: string | null,
): DashboardSourceFilter {
    if (value === "all" || isDashboardSourceProvider(value)) {
        return value;
    }

    return "all";
}

export function toggleDashboardSourceFilter(
    current: DashboardSourceFilter,
    requested: Exclude<DashboardSourceFilter, "all">,
): DashboardSourceFilter {
    return current === requested ? "all" : requested;
}

export function resolveConnectedSourceStatus({
    active,
    currentResultCount,
    hasNarrowingFilter,
    providerCount,
    settled,
}: {
    active: boolean;
    currentResultCount: number;
    hasNarrowingFilter: boolean;
    providerCount: number;
    settled: boolean;
}): "connected" | "connected-empty" | "no-results" {
    if (
        active &&
        settled &&
        currentResultCount === 0 &&
        (providerCount > 0 || hasNarrowingFilter)
    ) {
        return "no-results";
    }

    return providerCount > 0 ? "connected" : "connected-empty";
}
