import type { DataSourceDisplayState } from "@/lib/data-sources/presentation";
import type { DataSourceSavePayload } from "@/lib/data-sources/presentation-definition-types";

export interface DataSourcesResponse {
    sources: DataSourceDisplayState[];
}

interface DataSourceErrorResponse {
    error?: string;
}

export const DATA_SOURCES_API_PATH = "/api/data-sources";

interface SaveDataSourceOptions {
    endpoint?: string;
    fallbackMessage?: string;
}

function getErrorMessage(data: unknown, fallbackMessage: string) {
    if (
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string" &&
        data.error.length > 0
    ) {
        return data.error;
    }

    return fallbackMessage;
}

async function readResponseJson(response: Response) {
    return (await response.json().catch(() => null)) as
        | DataSourcesResponse
        | DataSourceErrorResponse
        | null;
}

export async function getDataSources(
    endpoint = DATA_SOURCES_API_PATH,
): Promise<DataSourcesResponse> {
    const response = await fetch(endpoint, {
        cache: "no-store",
    });
    const data = await readResponseJson(response);

    if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to load data sources"));
    }

    if (
        !data ||
        typeof data !== "object" ||
        !("sources" in data) ||
        !Array.isArray(data.sources)
    ) {
        throw new Error("Failed to load data sources");
    }

    return data;
}

export async function saveDataSource(
    payload: DataSourceSavePayload,
    options: SaveDataSourceOptions = {},
) {
    const response = await fetch(options.endpoint ?? DATA_SOURCES_API_PATH, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await readResponseJson(response);

    if (!response.ok) {
        throw new Error(
            getErrorMessage(
                data,
                options.fallbackMessage ??
                    "Failed to save data source settings",
            ),
        );
    }

    return data;
}
