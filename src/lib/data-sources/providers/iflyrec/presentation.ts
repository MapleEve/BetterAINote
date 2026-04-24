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

function buildIflyrecFields(
    state: DataSourceUiState,
    secretDraft: Record<string, string>,
    language: import("@/lib/i18n").UiLanguage,
): DataSourceFormField[] {
    const zh = isZh(language);

    return [
        buildTextField({
            id: "source-biz-id",
            key: "bizId",
            label: zh ? "账号类型" : "Account type",
            value: String(state.config.bizId ?? "tjzs"),
            description: zh
                ? "不确定时保留默认值 tjzs。"
                : "Keep the default value tjzs if unsure.",
            placeholder: "tjzs",
        }),
        buildTextareaField({
            id: "source-secret",
            target: "secret",
            key: "sessionId",
            label: zh ? "登录会话信息" : "Sign-in session details",
            value: secretDraft.sessionId ?? "",
            rows: 3,
            className: "font-mono text-sm",
            description: zh
                ? "从讯飞录音网页登录后复制的会话信息。"
                : "Paste the sign-in info from iFLYTEK web after logging in.",
            placeholder: state.secretsConfigured.sessionId
                ? zh
                    ? "已保存，如需替换请重新粘贴"
                    : "Already saved. Paste again to replace."
                : zh
                  ? "粘贴登录信息"
                  : "Paste sign-in info",
        }),
    ];
}

export const iflyrecPresentationDefinition: ProviderPresentationDefinition = {
    secretKeys: ["sessionId"],
    getFields: buildIflyrecFields,
};
