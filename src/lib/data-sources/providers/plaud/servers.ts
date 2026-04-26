import type { UiLanguage } from "@/lib/i18n";

export const PLAUD_SERVERS = {
    global: {
        label: "Global (api.plaud.ai)",
        apiBase: "https://api.plaud.ai",
    },
    eu: {
        label: "EU – Frankfurt (api-euc1.plaud.ai)",
        apiBase: "https://api-euc1.plaud.ai",
    },
    apse1: {
        label: "Asia Pacific – Singapore (api-apse1.plaud.ai)",
        apiBase: "https://api-apse1.plaud.ai",
    },
    china: {
        label: "China Mainland (api.plaud.cn)",
        apiBase: "https://api.plaud.cn",
    },
    custom: {
        label: "Custom",
        apiBase: "",
    },
} as const;

export type PlaudServerKey = keyof typeof PLAUD_SERVERS;
export const DEFAULT_SERVER_KEY: PlaudServerKey = "global";

const ZH_SERVER_COPY: Record<PlaudServerKey, { label: string }> = {
    global: {
        label: "全球其它地区",
    },
    eu: {
        label: "欧洲",
    },
    apse1: {
        label: "亚洲",
    },
    china: {
        label: "中国大陆",
    },
    custom: {
        label: "自定义",
    },
};

export function getPlaudServerLabel(
    serverKey: PlaudServerKey,
    language: UiLanguage,
): string {
    if (language === "zh-CN") {
        return ZH_SERVER_COPY[serverKey].label;
    }

    return PLAUD_SERVERS[serverKey].label;
}

export function isValidPlaudApiUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return (
            parsed.protocol === "https:" &&
            (parsed.hostname === "plaud.ai" ||
                parsed.hostname.endsWith(".plaud.ai") ||
                parsed.hostname === "plaud.cn" ||
                parsed.hostname.endsWith(".plaud.cn"))
        );
    } catch {
        return false;
    }
}

export function resolveApiBase(
    serverKey: string,
    customApiBase?: string,
): string | null {
    if (serverKey === "custom") {
        if (!customApiBase || !isValidPlaudApiUrl(customApiBase)) return null;
        return customApiBase.replace(/\/+$/, "");
    }

    if (!Object.hasOwn(PLAUD_SERVERS, serverKey)) return null;

    return PLAUD_SERVERS[serverKey as Exclude<PlaudServerKey, "custom">]
        .apiBase;
}

export function serverKeyFromApiBase(apiBase: string): PlaudServerKey {
    const entry = (
        Object.entries(PLAUD_SERVERS) as [
            PlaudServerKey,
            (typeof PLAUD_SERVERS)[PlaudServerKey],
        ][]
    ).find(([key, server]) => key !== "custom" && server.apiBase === apiBase);

    return entry?.[0] ?? "custom";
}
