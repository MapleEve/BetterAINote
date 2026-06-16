import type { DataSourceDisplayState } from "@/lib/data-sources/presentation";
import type { DataSourceSavePayload } from "@/lib/data-sources/presentation-definition-types";

export interface DataSourcesResponse {
    sources: DataSourceDisplayState[];
}

export interface DataSourcesSyncResponse {
    success?: boolean;
    queued?: boolean;
    newRecordings?: number;
    updatedRecordings?: number;
    removedRecordings?: number;
    errorCount?: number;
    error?: string;
}

export interface DataSourceMutationResponse {
    success?: boolean;
    error?: string;
}

interface DataSourceErrorResponse {
    error?: string;
}

export const DATA_SOURCES_API_PATH = "/api/data-sources";
export const DATA_SOURCES_TEST_API_PATH = "/api/data-sources/test";
export const DATA_SOURCES_SYNC_API_PATH = "/api/data-sources/sync";
export const DATA_SOURCES_DISCONNECT_API_PATH =
    "/api/data-sources/disconnect";
export const DATA_SOURCES_RECONNECT_API_PATH = "/api/data-sources/reconnect";

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
        | DataSourcesSyncResponse
        | DataSourceMutationResponse
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

export async function testDataSource(
    payload: DataSourceSavePayload,
    options: SaveDataSourceOptions = {},
) {
    const response = await fetch(
        options.endpoint ?? DATA_SOURCES_TEST_API_PATH,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        },
    );
    const data = await readResponseJson(response);

    if (!response.ok) {
        throw new Error(
            getErrorMessage(
                data,
                options.fallbackMessage ??
                    "Failed to test data source connection",
            ),
        );
    }

    return data;
}

export async function disconnectDataSource(
    payload: Pick<DataSourceSavePayload, "provider">,
    options: SaveDataSourceOptions = {},
) {
    const response = await fetch(
        options.endpoint ?? DATA_SOURCES_DISCONNECT_API_PATH,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        },
    );
    const data = await readResponseJson(response);

    if (!response.ok) {
        throw new Error(
            getErrorMessage(
                data,
                options.fallbackMessage ??
                    "Failed to disconnect data source",
            ),
        );
    }

    return data;
}

export async function reconnectDataSource(
    payload: DataSourceSavePayload,
    options: SaveDataSourceOptions = {},
) {
    const response = await fetch(
        options.endpoint ?? DATA_SOURCES_RECONNECT_API_PATH,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        },
    );
    const data = await readResponseJson(response);

    if (!response.ok) {
        throw new Error(
            getErrorMessage(
                data,
                options.fallbackMessage ?? "Failed to reconnect data source",
            ),
        );
    }

    return data;
}

export async function runDataSourcesSync(
    endpoint = DATA_SOURCES_SYNC_API_PATH,
): Promise<DataSourcesSyncResponse> {
    const response = await fetch(endpoint, { method: "POST" });
    const data = await readResponseJson(response);
    const syncFailed =
        data !== null &&
        typeof data === "object" &&
        "success" in data &&
        data.success === false;

    if (!response.ok || syncFailed) {
        throw new Error(
            getErrorMessage(
                data,
                "Failed to sync recordings from your connected sources",
            ),
        );
    }

    return data && typeof data === "object"
        ? (data as DataSourcesSyncResponse)
        : {};
}
