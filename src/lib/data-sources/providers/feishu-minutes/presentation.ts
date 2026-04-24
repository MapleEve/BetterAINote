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
                label: zh ? "账号区域" : "Account region",
                value: String(state.config.spaceName ?? "cn"),
                description: zh
                    ? "不确定时保留默认值 cn。"
                    : "Keep the default value cn if unsure.",
                placeholder: "cn",
            }),
            buildTextareaField({
                id: "source-web-cookie",
                target: "secret",
                key: "webCookie",
                label: zh
                    ? "附加登录信息（可选）"
                    : "Additional sign-in details (optional)",
                value: secretDraft.webCookie ?? "",
                rows: 3,
                className: "font-mono text-sm",
                description: zh
                    ? "可直接粘贴网页登录后的信息；没有时留空。"
                    : "Paste the signed-in web session details when available, or leave blank.",
                placeholder: zh
                    ? "已保存。重新粘贴即可替换。"
                    : "Already saved. Paste again to replace.",
            }),
            buildTextareaField({
                id: "source-web-token",
                target: "secret",
                key: "webToken",
                label: zh ? "访问令牌" : "Access token",
                value: secretDraft.webToken ?? "",
                rows: 2,
                className: "font-mono text-sm",
                description: zh
                    ? "没有单独令牌时可留空。"
                    : "Leave blank if you do not have a separate access token.",
                placeholder: zh
                    ? "没有单独令牌时可留空"
                    : "Leave empty when there is no separate access token.",
            }),
        ];
    }

    return [
        buildTextField({
            id: "source-app-id",
            key: "appId",
            label: zh ? "应用编号（可选）" : "App ID (optional)",
            value: String(state.config.appId ?? ""),
            description: zh
                ? "没有应用编号时可留空。"
                : "Leave blank if you do not have an app ID.",
            placeholder: "cli_xxx",
        }),
        buildTextareaField({
            id: "source-secret",
            target: "secret",
            key: "userAccessToken",
            label: zh ? "访问令牌" : "Access token",
            value: secretDraft.userAccessToken ?? "",
            rows: 3,
            className: "font-mono text-sm",
            description: zh
                ? "粘贴飞书妙记访问令牌。"
                : "Paste your Feishu Minutes access token.",
            placeholder: zh
                ? "已保存。重新粘贴即可替换。"
                : "Already saved. Paste again to replace.",
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
