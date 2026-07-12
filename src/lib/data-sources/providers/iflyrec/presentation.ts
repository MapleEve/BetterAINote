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
            label: zh ? "站点标识" : "Site identifier",
            value: String(state.config.bizId ?? "tjzs"),
            description: zh
                ? "用于匹配讯飞听见站点；不确定就保留默认值。"
                : "Used to match the iFLYTEK site. Keep the default if unsure.",
            placeholder: zh ? "默认站点" : "Default site",
        }),
        buildTextareaField({
            id: "source-secret",
            target: "secret",
            key: "sessionId",
            label: zh ? "登录凭证" : "Sign-in credential",
            value: secretDraft.sessionId ?? "",
            rows: 3,
            className: "font-mono text-sm",
            description: zh
                ? "粘贴讯飞听见当前账号的访问凭证。"
                : "Paste the access credential for your current iFLYTEK account.",
            placeholder: state.secretsConfigured.sessionId
                ? zh
                    ? "已保存，如需替换请重新粘贴"
                    : "Already saved. Paste again to replace."
                : zh
                  ? "粘贴登录凭证"
                  : "Paste sign-in credential",
        }),
    ];
}

export const iflyrecPresentationDefinition: ProviderPresentationDefinition = {
    secretKeys: ["sessionId"],
    getFields: buildIflyrecFields,
};
