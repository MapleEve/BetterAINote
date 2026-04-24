export class ServiceUrlValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ServiceUrlValidationError";
    }
}

export function normalizeServiceUrl(
    value: string,
    fieldName: string,
): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new ServiceUrlValidationError(
            `${fieldName} must be a valid absolute URL`,
        );
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ServiceUrlValidationError(
            `${fieldName} must use http or https`,
        );
    }

    if (!parsed.hostname) {
        throw new ServiceUrlValidationError(
            `${fieldName} must include a hostname`,
        );
    }

    if (parsed.username || parsed.password) {
        throw new ServiceUrlValidationError(
            `${fieldName} must not include embedded credentials`,
        );
    }

    if (parsed.search || parsed.hash) {
        throw new ServiceUrlValidationError(
            `${fieldName} must not include query parameters or fragments`,
        );
    }

    return parsed.toString().replace(/\/+$/, "");
}
