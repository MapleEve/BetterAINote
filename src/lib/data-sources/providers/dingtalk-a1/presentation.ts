import type {
    DataSourceFormField,
    DataSourceUiState,
    ProviderPresentationDefinition,
} from "@/lib/data-sources/presentation-definition-types";
import { buildTextareaField } from "@/lib/data-sources/presentation-field-builders";
import { isZh } from "@/lib/data-sources/presentation-shared";

function buildDingTalkFields(
    state: DataSourceUiState,
    secretDraft: Record<string, string>,
    language: import("@/lib/i18n").UiLanguage,
): DataSourceFormField[] {
    const zh = isZh(language);
    const usesWebSignIn = state.authMode === "cookie";

    return [
        buildTextareaField({
            id: "source-secret",
            target: "secret",
            key: usesWebSignIn ? "cookie" : "agentToken",
            label: usesWebSignIn
                ? zh
                    ? "网页登录信息"
                    : "Web sign-in info"
                : zh
                  ? "钉钉闪记登录信息"
                  : "DingTalk A1 sign-in info",
            value: usesWebSignIn
                ? (secretDraft.cookie ?? "")
                : (secretDraft.agentToken ?? ""),
            rows: 3,
            className: "font-mono text-sm",
            description: usesWebSignIn
                ? zh
                    ? "粘贴钉钉闪记网页登录信息。"
                    : "Paste your DingTalk A1 web sign-in info."
                : zh
                  ? "粘贴钉钉闪记登录信息。"
                  : "Paste your DingTalk A1 sign-in info.",
            placeholder: zh
                ? "已保存。重新粘贴即可替换。"
                : "Already saved. Paste again to replace.",
        }),
    ];
}

export const dingtalkA1PresentationDefinition: ProviderPresentationDefinition =
    {
        secretKeys: ["agentToken", "cookie"],
        getFields: buildDingTalkFields,
        normalizePayload: ({ state, secretDraft, payload }) => ({
            ...payload,
            authMode:
                state.authMode as import("@/lib/data-sources/catalog").SourceAuthMode,
            secrets: {
                [state.authMode === "cookie" ? "cookie" : "agentToken"]:
                    state.authMode === "cookie"
                        ? (secretDraft.cookie?.trim() ?? "")
                        : (secretDraft.agentToken?.trim() ?? ""),
            },
        }),
    };
