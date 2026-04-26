import type {
    DataSourceFormField,
    DataSourceUiState,
    ProviderPresentationDefinition,
} from "@/lib/data-sources/presentation-definition-types";
import {
    buildTextareaField,
    buildTextField,
} from "@/lib/data-sources/presentation-field-builders";
import { isZh } from "@/lib/data-sources/presentation-shared";

function buildFeishuFields(
    state: DataSourceUiState,
    secretDraft: Record<string, string>,
    language: import("@/lib/i18n").UiLanguage,
): DataSourceFormField[] {
    const zh = isZh(language);
    const usesWebReverse = state.authMode === "web-reverse";

    if (usesWebReverse) {
        return [
            buildTextField({
                id: "source-space-name",
                key: "spaceName",
                label: "space_name",
                value: String(state.config.spaceName ?? "cn"),
                description: zh
                    ? "复制飞书妙记 list?size=... 请求 URL 里的 space_name；不确定就填 cn。"
                    : "Copy space_name from the Feishu Minutes list?size=... request URL. Use cn if unsure.",
                placeholder: "cn",
            }),
            buildTextareaField({
                id: "source-web-cookie",
                target: "secret",
                key: "webCookie",
                label: "Cookie",
                value: secretDraft.webCookie ?? "",
                rows: 3,
                className: "font-mono text-sm",
                description: zh
                    ? "复制飞书妙记 list?size=... 请求头 Cookie，必须包含 minutes_csrf_token=。"
                    : "Copy the Cookie header from the Feishu Minutes list?size=... request. It must include minutes_csrf_token=.",
                placeholder: state.secretsConfigured.webCookie
                    ? "••••••••••••••••"
                    : zh
                      ? "Cookie: minutes_csrf_token=..."
                      : "Cookie: minutes_csrf_token=...",
            }),
            buildTextareaField({
                id: "source-web-token",
                target: "secret",
                key: "webToken",
                label: zh
                    ? "X-Feishu-Minutes-Token（可选）"
                    : "X-Feishu-Minutes-Token (optional)",
                value: secretDraft.webToken ?? "",
                rows: 2,
                className: "font-mono text-sm",
                description: zh
                    ? "如果同一个请求里有 X-Feishu-Minutes-Token，就把这个请求头的值贴这里；没有就留空。"
                    : "If the same request has X-Feishu-Minutes-Token, paste that header value here. Leave it empty if absent.",
                placeholder: zh
                    ? "X-Feishu-Minutes-Token"
                    : "X-Feishu-Minutes-Token",
            }),
        ];
    }

    return [
        buildTextField({
            id: "source-app-id",
            key: "appId",
            label: "FEISHU_APP_ID / app_id",
            value: String(state.config.appId ?? ""),
            description: zh
                ? "粘贴飞书开放平台应用的 app_id，通常是 cli_ 开头。"
                : "Paste the Feishu open platform app_id, usually starting with cli_.",
            placeholder: "cli_xxx",
        }),
        buildTextareaField({
            id: "source-secret",
            target: "secret",
            key: "userAccessToken",
            label: "user_access_token",
            value: secretDraft.userAccessToken ?? "",
            rows: 3,
            className: "font-mono text-sm",
            description: zh
                ? "粘贴飞书开放平台授权结果里的 user_access_token 字段。"
                : "Paste the user_access_token field from the Feishu open platform authorization result.",
            placeholder: state.secretsConfigured.userAccessToken
                ? "••••••••••••••••"
                : zh
                  ? "user_access_token"
                  : "user_access_token",
        }),
    ];
}

export const feishuMinutesPresentationDefinition: ProviderPresentationDefinition =
    {
        secretKeys: ["userAccessToken", "webCookie", "webToken"],
        getFields: buildFeishuFields,
        normalizePayload: ({ state, secretDraft, payload }) => {
            if (state.authMode === "web-reverse") {
                return {
                    ...payload,
                    authMode: "web-reverse",
                    baseUrl: "https://meetings.feishu.cn",
                    config: {
                        spaceName:
                            typeof state.config.spaceName === "string" &&
                            state.config.spaceName.trim()
                                ? state.config.spaceName.trim()
                                : "cn",
                    },
                    secrets: {
                        webCookie: secretDraft.webCookie?.trim() ?? "",
                        webToken: secretDraft.webToken?.trim() ?? "",
                    } as Record<string, string>,
                };
            }

            return {
                ...payload,
                authMode: "oauth-device-flow",
                baseUrl: "https://open.feishu.cn",
                config: {
                    appId:
                        typeof state.config.appId === "string"
                            ? state.config.appId.trim()
                            : "",
                },
                secrets: {
                    userAccessToken: secretDraft.userAccessToken?.trim() ?? "",
                } as Record<string, string>,
            };
        },
    };
