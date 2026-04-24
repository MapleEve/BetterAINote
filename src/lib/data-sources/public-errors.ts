export const PUBLIC_DATA_SOURCE_CONNECTION_ERROR =
    "连接失败，请检查登录信息后重试";

export const PUBLIC_DATA_SOURCE_IMPORT_ERROR = "导入失败，请稍后重试";

export function getPublicDataSourceErrorMessage(
    error: unknown,
    fallback = PUBLIC_DATA_SOURCE_IMPORT_ERROR,
) {
    const errorCode =
        typeof error === "object" && error !== null && "code" in error
            ? (error as { code?: unknown }).code
            : null;

    if (errorCode && errorCode !== "invalid-connection") {
        return error instanceof Error ? error.message : fallback;
    }

    if (
        error instanceof Error &&
        /请选择|请填写|No data source|No sync-capable/i.test(error.message)
    ) {
        return error.message;
    }

    return fallback;
}

export function sanitizePublicDataSourceError(error: string | null) {
    return error ? PUBLIC_DATA_SOURCE_IMPORT_ERROR : null;
}

export function sanitizePublicDataSourceErrors(errors: string[]) {
    return errors.length > 0 ? [PUBLIC_DATA_SOURCE_IMPORT_ERROR] : [];
}
