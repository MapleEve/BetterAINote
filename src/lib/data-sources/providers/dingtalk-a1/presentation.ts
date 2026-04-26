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
            label: "dt-meeting-agent-token",
            value: secretDraft[DINGTALK_DEVICE_CREDENTIAL_KEY] ?? "",
            rows: 3,
            className: "font-mono text-sm",
            description: zh
                ? "复制钉钉闪记 getConversationList 请求头 dt-meeting-agent-token 的值。"
                : "Copy the dt-meeting-agent-token header value from the DingTalk A1 getConversationList request.",
            placeholder: state.secretsConfigured[DINGTALK_DEVICE_CREDENTIAL_KEY]
                ? "••••••••••••••••"
                : zh
                  ? "dt-meeting-agent-token"
                  : "dt-meeting-agent-token",
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
