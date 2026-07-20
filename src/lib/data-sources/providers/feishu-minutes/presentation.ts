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
                label: zh ? "站点区域" : "Site region",
                value: String(state.config.spaceName ?? "cn"),
                description: zh
                    ? "选择飞书妙记所在区域；不确定就填 cn。"
                    : "Choose the Feishu Minutes site region. Use cn if unsure.",
                placeholder: "cn",
            }),
            buildTextareaField({
                id: "source-web-cookie",
                target: "secret",
                key: "webCookie",
                label: zh ? "网页登录信息" : "Web sign-in details",
                value: secretDraft.webCookie ?? "",
                rows: 3,
                className: "font-mono text-sm",
                description: zh
                    ? "粘贴飞书妙记当前网页登录状态对应的登录信息。"
                    : "Paste the sign-in details from your current Feishu Minutes web session.",
                placeholder: state.secretsConfigured.webCookie
                    ? "••••••••••••••••"
                    : zh
                      ? "粘贴登录信息"
                      : "Paste sign-in details",
            }),
            buildTextareaField({
                id: "source-web-token",
                target: "secret",
                key: "webToken",
                label: zh
                    ? "补充校验信息（可选）"
                    : "Additional verification (optional)",
                value: secretDraft.webToken ?? "",
                rows: 2,
                className: "font-mono text-sm",
                description: zh
                    ? "只有连接测试提示需要额外校验信息时才填写；没有就留空。"
                    : "Fill this only if the connection test asks for additional verification; otherwise leave it blank.",
                placeholder: zh ? "可选" : "Optional",
            }),
        ];
    }

    return [
        buildTextField({
            id: "source-app-id",
            key: "appId",
            label: zh ? "开放平台应用 ID" : "Open platform app ID",
            value: String(state.config.appId ?? ""),
            description: zh
                ? "填写飞书开放平台应用的应用 ID。"
                : "Enter the app ID from your Feishu Open Platform app.",
            placeholder: zh ? "应用 ID" : "App ID",
        }),
        buildTextareaField({
            id: "source-secret",
            target: "secret",
            key: "userAccessToken",
            label: zh ? "开放平台授权信息" : "Open platform authorization",
            value: secretDraft.userAccessToken ?? "",
            rows: 3,
            className: "font-mono text-sm",
            description: zh
                ? "粘贴飞书开放平台授权结果中的访问凭证。"
                : "Paste the access credential from your Feishu Open Platform authorization result.",
            placeholder: state.secretsConfigured.userAccessToken
                ? "••••••••••••••••"
                : zh
                  ? "粘贴授权信息"
                  : "Paste authorization details",
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
