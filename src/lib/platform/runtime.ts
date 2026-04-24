const DEFAULT_RUNTIME_ORIGIN = "http://localhost:3001";

export function hasBrowserWindow() {
    return typeof window !== "undefined";
}

export function isServerRuntime() {
    return !hasBrowserWindow();
}

export function isBuildRuntime() {
    return process.env.NEXT_PHASE === "phase-production-build";
}

export function isDevelopmentRuntime() {
    return process.env.NODE_ENV === "development";
}

export function isTestRuntime() {
    return Boolean(process.env.VITEST) || process.env.NODE_ENV === "test";
}

export function getRuntimeOrigin(fallback = DEFAULT_RUNTIME_ORIGIN): string {
    return hasBrowserWindow() ? window.location.origin : fallback;
}

export function absoluteUrl(path: string) {
    if (hasBrowserWindow()) {
        return `${getRuntimeOrigin()}${path}`;
    }

    const appUrl = process.env.APP_URL;

    if (!appUrl && !isBuildRuntime() && !isTestRuntime()) {
        throw new Error(
            "APP_URL must be set in non-build runtime (dev/prod server)",
        );
    }

    return `${appUrl}${path}`;
}

export function assertServerRuntime(accessedValue: string) {
    if (!isServerRuntime()) {
        throw new Error(
            `${accessedValue} cannot be accessed on the client side. ` +
                "This module should only be imported in server-side code (API routes, server components, etc.).",
        );
    }
}
