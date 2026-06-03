import type {
    DataSourceFormField,
    DataSourceUiState,
    ProviderPresentationDefinition,
} from "@/lib/data-sources/presentation-definition-types";
import { buildTextareaField } from "@/lib/data-sources/presentation-field-builders";
import { isZh } from "@/lib/data-sources/presentation-shared";
import { DINGTALK_DEVICE_CREDENTIAL_KEY } from "./constants";

function buildDingTalkFields(
    state: DataSourceUiState,
    secretDraft: Record<string, string>,
    language: import("@/lib/i18n").UiLanguage,
): DataSourceFormField[] {
    const zh = isZh(language);

    return [
        buildTextareaField({
            id: "source-secret",
            target: "secret",
            key: DINGTALK_DEVICE_CREDENTIAL_KEY,
            label: zh ? "钉钉登录凭证" : "DingTalk sign-in credential",
            value: secretDraft[DINGTALK_DEVICE_CREDENTIAL_KEY] ?? "",
            rows: 3,
            className: "font-mono text-sm",
            description: zh
                ? "粘贴钉钉闪记当前账号的访问凭证。"
                : "Paste the access credential for your current DingTalk A1 account.",
            placeholder: state.secretsConfigured[DINGTALK_DEVICE_CREDENTIAL_KEY]
                ? "••••••••••••••••"
                : zh
                  ? "粘贴登录凭证"
                  : "Paste sign-in credential",
        }),
    ];
}

export const dingtalkA1PresentationDefinition: ProviderPresentationDefinition =
    {
        secretKeys: [DINGTALK_DEVICE_CREDENTIAL_KEY],
        getFields: buildDingTalkFields,
        normalizePayload: ({ state, secretDraft, payload }) => ({
            ...payload,
            authMode:
                state.authMode as import("@/lib/data-sources/catalog").SourceAuthMode,
            baseUrl: "https://meeting-ai-tingji.dingtalk.com",
            secrets: {
                [DINGTALK_DEVICE_CREDENTIAL_KEY]:
                    secretDraft[DINGTALK_DEVICE_CREDENTIAL_KEY]?.trim() ?? "",
            },
        }),
    };
