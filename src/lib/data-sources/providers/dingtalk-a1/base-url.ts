export const DINGTALK_DEFAULT_BASE_URL =
    "https://meeting-ai-tingji.dingtalk.com";

export function getDingTalkE2ELoopbackBaseUrl(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }

    try {
        const url = new URL(value);
        if (
            url.protocol !== "http:" ||
            url.hostname !== "127.0.0.1" ||
            !url.port ||
            url.username ||
            url.password ||
            url.pathname !== "/" ||
            url.search ||
            url.hash
        ) {
            return null;
        }

        return url.origin;
    } catch {
        return null;
    }
}

export function resolveDingTalkServerBaseUrl(value: unknown) {
    const allowE2ELoopback =
        process.env.NODE_ENV === "development" &&
        process.env.PLAYWRIGHT_E2E_DATA_SOURCES_FALLBACK === "1" &&
        process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";

    return (
        (allowE2ELoopback && getDingTalkE2ELoopbackBaseUrl(value)) ||
        DINGTALK_DEFAULT_BASE_URL
    );
}
