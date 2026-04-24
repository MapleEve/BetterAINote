import {
    normalizeServiceUrl,
    ServiceUrlValidationError,
} from "@/lib/service-url";

export class SettingsValidationError extends Error {}

export function wrapSettingsValidation<T>(action: () => T): T {
    try {
        return action();
    } catch (error) {
        if (error instanceof ServiceUrlValidationError) {
            throw new SettingsValidationError(error.message);
        }

        throw error;
    }
}

export function normalizeNullableServiceUrlSetting(
    fieldName: string,
    value: unknown,
): string | null {
    if (value === null || value === "") {
        return null;
    }

    if (typeof value !== "string") {
        throw new SettingsValidationError(
            `${fieldName} must be a string or null`,
        );
    }

    return wrapSettingsValidation(() => normalizeServiceUrl(value, fieldName));
}
