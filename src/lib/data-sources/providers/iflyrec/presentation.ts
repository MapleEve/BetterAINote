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
            label: "X-Biz-Id",
            value: String(state.config.bizId ?? "tjzs"),
            description: zh
                ? "复制讯飞听见请求头 X-Biz-Id；不确定就填 tjzs。"
                : "Copy the iFLYTEK request header named X-Biz-Id. Use tjzs if unsure.",
            placeholder: "tjzs",
        }),
        buildTextareaField({
            id: "source-secret",
            target: "secret",
            key: "sessionId",
            label: "X-Session-Id",
            value: secretDraft.sessionId ?? "",
            rows: 3,
            className: "font-mono text-sm",
            description: zh
                ? "复制讯飞听见请求头 X-Session-Id 的值。"
                : "Copy the iFLYTEK request header value named X-Session-Id.",
            placeholder: state.secretsConfigured.sessionId
                ? zh
                    ? "已保存，如需替换请重新粘贴"
                    : "Already saved. Paste again to replace."
                : zh
                  ? "X-Session-Id"
                  : "X-Session-Id",
        }),
    ];
}

export const iflyrecPresentationDefinition: ProviderPresentationDefinition = {
    secretKeys: ["sessionId"],
    getFields: buildIflyrecFields,
};
