import { SettingsValidationError } from "@/lib/settings/validation";

export function normalizeBooleanSetting(field: string, value: unknown) {
    if (typeof value !== "boolean") {
        throw new SettingsValidationError(`${field} must be a boolean`);
    }

    return value;
}

export function normalizeStringOrNullSetting(field: string, value: unknown) {
    if (value !== null && typeof value !== "string") {
        throw new SettingsValidationError(`${field} must be a string or null`);
    }

    return value;
}

export function normalizeEnumSetting<const T extends readonly string[]>(
    field: string,
    value: unknown,
    allowedValues: T,
) {
    if (
        typeof value !== "string" ||
        !allowedValues.includes(value as T[number])
    ) {
        throw new SettingsValidationError(
            `${field} must be one of ${allowedValues.join(", ")}`,
        );
    }

    return value as T[number];
}
