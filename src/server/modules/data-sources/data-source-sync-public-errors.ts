import { ErrorCode } from "@/lib/errors";

export const DATA_SOURCE_SYNC_PUBLIC_REASON = {
    DATABASE_LOCKED: "database-locked",
    PERMISSION_DENIED: "permission-denied",
    RUNTIME_UNAVAILABLE: "runtime-unavailable",
    GENERIC: "generic",
} as const;

export type DataSourceSyncPublicReason =
    (typeof DATA_SOURCE_SYNC_PUBLIC_REASON)[keyof typeof DATA_SOURCE_SYNC_PUBLIC_REASON];

interface DataSourceSyncPublicErrorResponse {
    body: {
        code: ErrorCode.DATA_SOURCE_SYNC_ERROR;
        error: DataSourceSyncPublicReason;
        reason: DataSourceSyncPublicReason;
    };
    status: 500;
}

function collectErrorValues(
    error: unknown,
    seen = new Set<unknown>(),
): string[] {
    if (typeof error === "string") {
        return [error];
    }

    if (!error || typeof error !== "object" || seen.has(error)) {
        return [];
    }

    seen.add(error);
    const record = error as {
        cause?: unknown;
        code?: unknown;
        message?: unknown;
    };
    const values = [record.code, record.message].filter(
        (value): value is string => typeof value === "string",
    );

    return [...values, ...collectErrorValues(record.cause, seen)];
}

export function getDataSourceSyncPublicReason(
    error: unknown,
): DataSourceSyncPublicReason {
    const values = collectErrorValues(error).map((value) =>
        value.toLowerCase(),
    );

    if (
        values.some(
            (value) =>
                value.includes("sqlite_busy") ||
                /database (?:is )?locked/.test(value),
        )
    ) {
        return DATA_SOURCE_SYNC_PUBLIC_REASON.DATABASE_LOCKED;
    }

    if (
        values.some(
            (value) =>
                value.includes("eacces") ||
                value.includes("eperm") ||
                value.includes("permission denied"),
        )
    ) {
        return DATA_SOURCE_SYNC_PUBLIC_REASON.PERMISSION_DENIED;
    }

    if (
        values.some(
            (value) =>
                value.includes("runtime unavailable") ||
                value.includes("worker unavailable") ||
                value.includes("worker not responding") ||
                value.includes("runtime not available"),
        )
    ) {
        return DATA_SOURCE_SYNC_PUBLIC_REASON.RUNTIME_UNAVAILABLE;
    }

    return DATA_SOURCE_SYNC_PUBLIC_REASON.GENERIC;
}

export function createDataSourceSyncPublicErrorResponse(
    error: unknown,
): DataSourceSyncPublicErrorResponse {
    const reason = getDataSourceSyncPublicReason(error);

    return {
        body: {
            code: ErrorCode.DATA_SOURCE_SYNC_ERROR,
            // Existing dashboard sync state carries only `error`; keep it stable and safe.
            error: reason,
            reason,
        },
        status: 500,
    };
}
