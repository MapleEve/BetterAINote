import type { UiLanguage } from "@/lib/i18n";

export const PLAUD_SERVERS = {
    global: {
        label: "Global (api.plaud.ai)",
        description: "Global server — used by most accounts (api.plaud.ai)",
        apiBase: "https://api.plaud.ai",
    },
    eu: {
        label: "EU – Frankfurt (api-euc1.plaud.ai)",
        description:
            "EU server — used by European accounts (api-euc1.plaud.ai)",
        apiBase: "https://api-euc1.plaud.ai",
    },
    apse1: {
        label: "Asia Pacific – Singapore (api-apse1.plaud.ai)",
        description:
            "Asia Pacific server — used by APAC accounts (api-apse1.plaud.ai)",
        apiBase: "https://api-apse1.plaud.ai",
    },
    china: {
        label: "China Mainland (api.plaud.cn)",
        description:
            "China mainland server — used by the China regional web/app (api.plaud.cn)",
        apiBase: "https://api.plaud.cn",
    },
    custom: {
        label: "Custom",
        description:
            "Enter a custom Plaud service address (e.g. https://api-xxx.plaud.ai or https://api.plaud.cn)",
        apiBase: "",
    },
} as const;

export type PlaudServerKey = keyof typeof PLAUD_SERVERS;
export const DEFAULT_SERVER_KEY: PlaudServerKey = "global";

const ZH_SERVER_COPY: Record<
    PlaudServerKey,
    { label: string; description: string }
> = {
    global: {
        label: "全球其它地区",
        description: "全球服务器，适用于大多数国际版账号（api.plaud.ai）",
    },
    eu: {
        label: "欧洲",
        description: "欧洲服务器，适用于欧洲地区账号（api-euc1.plaud.ai）",
    },
    apse1: {
        label: "亚洲",
        description: "亚太服务器，适用于亚太地区账号（api-apse1.plaud.ai）",
    },
    china: {
        label: "中国大陆",
        description:
            "中国大陆服务器，适用于中国区网页端/客户端账号（api.plaud.cn）",
    },
    custom: {
        label: "自定义",
        description:
            "输入自定义 Plaud 服务地址（例如 https://api-xxx.plaud.ai 或 https://api.plaud.cn）",
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

export function getPlaudServerDescription(
    serverKey: PlaudServerKey,
    language: UiLanguage,
): string {
    if (language === "zh-CN") {
        return ZH_SERVER_COPY[serverKey].description;
    }

    return PLAUD_SERVERS[serverKey].description;
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
