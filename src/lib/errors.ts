/**
 * Standardized error codes for API responses
 * This allows client-side code to handle specific error cases
 */
export enum ErrorCode {
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    SESSION_EXPIRED = "SESSION_EXPIRED",

    INVALID_INPUT = "INVALID_INPUT",
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
    INVALID_FILE_FORMAT = "INVALID_FILE_FORMAT",

    NOT_FOUND = "NOT_FOUND",
    ALREADY_EXISTS = "ALREADY_EXISTS",
    CONFLICT = "CONFLICT",

    DATA_SOURCE_CONNECTION_FAILED = "DATA_SOURCE_CONNECTION_FAILED",
    DATA_SOURCE_INVALID_CREDENTIALS = "DATA_SOURCE_INVALID_CREDENTIALS",
    DATA_SOURCE_API_ERROR = "DATA_SOURCE_API_ERROR",
    DATA_SOURCE_RATE_LIMITED = "DATA_SOURCE_RATE_LIMITED",
    DATA_SOURCE_SYNC_ERROR = "DATA_SOURCE_SYNC_ERROR",

    STORAGE_ERROR = "STORAGE_ERROR",
    STORAGE_QUOTA_EXCEEDED = "STORAGE_QUOTA_EXCEEDED",
    FILE_TOO_LARGE = "FILE_TOO_LARGE",
    PATH_TRAVERSAL_DETECTED = "PATH_TRAVERSAL_DETECTED",

    TRANSCRIPTION_FAILED = "TRANSCRIPTION_FAILED",
    NO_TRANSCRIPTION_PROVIDER = "NO_TRANSCRIPTION_PROVIDER",
    TRANSCRIPTION_API_ERROR = "TRANSCRIPTION_API_ERROR",

    EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED",
    SMTP_NOT_CONFIGURED = "SMTP_NOT_CONFIGURED",
    SMTP_AUTH_FAILED = "SMTP_AUTH_FAILED",
    NOTIFICATION_FAILED = "NOTIFICATION_FAILED",

    DATABASE_ERROR = "DATABASE_ERROR",
    UNIQUE_CONSTRAINT_VIOLATION = "UNIQUE_CONSTRAINT_VIOLATION",

    INTERNAL_ERROR = "INTERNAL_ERROR",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
    RATE_LIMITED = "RATE_LIMITED",
}

/**
 * Application error with error code
 */
export class AppError extends Error {
    constructor(
        public code: ErrorCode,
        message: string,
        public statusCode: number = 500,
        public details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = "AppError";
    }

    toJSON() {
        return {
            error: this.message,
            code: this.code,
            ...(this.details && { details: this.details }),
        };
    }
}

/**
 * Helper to create standardized error responses
 */
export function createErrorResponse(
    error: AppError | Error | unknown,
    defaultCode: ErrorCode = ErrorCode.INTERNAL_ERROR,
) {
    if (error instanceof AppError) {
        return {
            body: error.toJSON(),
            status: error.statusCode,
        };
    }

    if (error instanceof Error) {
        return {
            body: {
                error: error.message,
                code: defaultCode,
            },
            status: 500,
        };
    }

    return {
        body: {
            error: "An unexpected error occurred",
            code: defaultCode,
        },
        status: 500,
    };
}

/**
 * Map common error patterns to AppError
 */
export function mapErrorToAppError(error: unknown): AppError {
    if (error instanceof AppError) {
        return error;
    }

    if (error instanceof Error) {
        if (error.message.includes("path traversal")) {
            return new AppError(
                ErrorCode.PATH_TRAVERSAL_DETECTED,
                "Invalid file path detected",
                400,
            );
        }

        if (
            error.message.includes("unique") ||
            error.message.includes("duplicate")
        ) {
            return new AppError(
                ErrorCode.UNIQUE_CONSTRAINT_VIOLATION,
                "This resource already exists",
                409,
            );
        }

        if (isUpstreamSourceApiError(error.message)) {
            if (error.message.includes("429")) {
                return new AppError(
                    ErrorCode.DATA_SOURCE_RATE_LIMITED,
                    "Too many requests to the upstream source API. Please try again later.",
                    429,
                );
            }
            return new AppError(
                ErrorCode.DATA_SOURCE_API_ERROR,
                "Failed to communicate with the upstream source service. Please try again later.",
                502,
            );
        }

        if (error.message.includes("SMTP")) {
            if (error.message.includes("authentication")) {
                return new AppError(
                    ErrorCode.SMTP_AUTH_FAILED,
                    "Email authentication failed. Please check your SMTP credentials.",
                    500,
                );
            }
            if (error.message.includes("not configured")) {
                return new AppError(
                    ErrorCode.SMTP_NOT_CONFIGURED,
                    "Email service is not configured",
                    500,
                );
            }
            return new AppError(
                ErrorCode.EMAIL_SEND_FAILED,
                "Failed to send email notification. Please check your email settings.",
                500,
            );
        }

        if (error.message.includes("storage")) {
            return new AppError(
                ErrorCode.STORAGE_ERROR,
                "Failed to access storage. Please contact support if this persists.",
                500,
            );
        }

        if (error.message.includes("transcription")) {
            return new AppError(
                ErrorCode.TRANSCRIPTION_FAILED,
                "Failed to transcribe recording. Please try again or check your API configuration.",
                500,
            );
        }
    }

    return new AppError(
        ErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "An unexpected error occurred",
        500,
    );
}

function isUpstreamSourceApiError(message: string) {
    return (
        message.includes("source API error") ||
        message.includes("upstream API error") ||
        /\bAPI (?:request failed|error)\b/.test(message)
    );
}
