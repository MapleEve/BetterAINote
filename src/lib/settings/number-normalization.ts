import { SettingsValidationError } from "@/lib/settings/validation";

function isNonNegativeInteger(value: unknown) {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= 0
    );
}

function isFiniteNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown) {
    return isFiniteNumber(value) && Number.isInteger(value);
}

export function normalizeNonNegativeInteger(field: string, value: unknown) {
    if (!isNonNegativeInteger(value)) {
        throw new SettingsValidationError(
            `${field} must be a non-negative integer`,
        );
    }

    return Number(value);
}

export function normalizeFiniteNumber(field: string, value: unknown) {
    if (!isFiniteNumber(value)) {
        throw new SettingsValidationError(`${field} must be a number`);
    }

    return Number(value);
}

export function normalizePositiveNumber(field: string, value: unknown) {
    const normalized = normalizeFiniteNumber(field, value);
    if (normalized <= 0) {
        throw new SettingsValidationError(`${field} must be a positive number`);
    }

    return normalized;
}

export function normalizeFlooredNumberInRange(
    field: string,
    value: unknown,
    minimum: number,
    maximum: number,
) {
    const normalized = normalizeFiniteNumber(field, value);
    if (normalized < minimum || normalized > maximum) {
        throw new SettingsValidationError(
            `${field} must be a number between ${minimum} and ${maximum}`,
        );
    }

    return Math.floor(normalized);
}

export function normalizeIntegerInRange(
    field: string,
    value: unknown,
    minimum: number,
    maximum: number,
) {
    if (
        !isInteger(value) ||
        Number(value) < minimum ||
        Number(value) > maximum
    ) {
        throw new SettingsValidationError(
            `${field} must be an integer between ${minimum} and ${maximum}`,
        );
    }

    return Number(value);
}

export function normalizeNullableIntegerMinimum(
    field: string,
    value: unknown,
    minimum: number,
) {
    if (value === null) {
        return null;
    }

    if (!isInteger(value) || Number(value) < minimum) {
        throw new SettingsValidationError(
            `${field} must be an integer greater than or equal to ${minimum}, or null`,
        );
    }

    return Number(value);
}
