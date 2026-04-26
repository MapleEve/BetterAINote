import type {
    DataSourceFieldOption,
    DataSourceFormField,
    DataSourceUiState,
    ProviderPresentationDefinition,
} from "@/lib/data-sources/presentation-definition-types";
import {
    buildSelectField,
    buildTextareaField,
    buildTextField,
} from "@/lib/data-sources/presentation-field-builders";
import {
    buildSourceTitleSyncField,
    getSourceTitleSyncValue,
    isZh,
} from "@/lib/data-sources/presentation-shared";
import { SOURCE_PROVIDER_MANIFESTS } from "@/lib/data-sources/providers/manifest";
import type { UiLanguage } from "@/lib/i18n";
import {
    DEFAULT_SERVER_KEY,
    getPlaudServerLabel,
    PLAUD_SERVERS,
    type PlaudServerKey,
} from "./servers";

function getPlaudServerOptions(language: UiLanguage) {
    return (
        Object.entries(PLAUD_SERVERS) as [
            PlaudServerKey,
            (typeof PLAUD_SERVERS)[PlaudServerKey],
        ][]
    ).map(([key]) => ({
        value: key,
        label: getPlaudServerLabel(key, language),
    })) satisfies DataSourceFieldOption[];
}

function getPlaudFields(
    state: DataSourceUiState,
    secretDraft: Record<string, string>,
    language: UiLanguage,
    context: "settings" | "onboarding",
): DataSourceFormField[] {
    const zh = isZh(language);
    const server = (state.config.server ??
        DEFAULT_SERVER_KEY) as PlaudServerKey;
    const fields: DataSourceFormField[] = [
        buildSelectField({
            id: "source-server",
            key: "server",
            label: zh ? "站点版本" : "Site edition",
            value: server,
            options: getPlaudServerOptions(language),
        }),
        buildTextareaField({
            id: "source-secret",
            target: "secret",
            key: "bearerToken",
            label: zh ? "Plaud 登录令牌" : "Plaud sign-in token",
            value: secretDraft.bearerToken ?? "",
            rows: context === "settings" ? 4 : 4,
            spellCheck: false,
            className: "font-mono text-sm",
            placeholder: state.secretsConfigured.bearerToken
                ? "••••••••••••••••"
                : zh
                  ? "粘贴 Plaud 登录令牌"
                  : "Paste your Plaud sign-in token",
        }),
    ];

    if (server === "custom") {
        fields.splice(
            1,
            0,
            buildTextField({
                id: "source-custom-api-base",
                key: "customApiBase",
                label: zh ? "自定义服务地址" : "Custom service address",
                value: String(state.config.customApiBase ?? ""),
                placeholder: "https://api-xxx.plaud.ai or https://api.plaud.cn",
            }),
        );
    }

    if (context === "settings") {
        const titleSyncField = buildSourceTitleSyncField(state, language);
        if (titleSyncField) {
            fields.push(titleSyncField);
        }
    }

    return fields;
}

export const plaudPresentationDefinition: ProviderPresentationDefinition = {
    secretKeys: ["bearerToken"],
    usesCustomServerSelector: true,
    getFields: getPlaudFields,
    normalizePayload: ({ state, secretDraft, payload }) => ({
        ...payload,
        authMode: SOURCE_PROVIDER_MANIFESTS.plaud.defaults.authMode,
        config: {
            server:
                (state.config.server as PlaudServerKey | undefined) ??
                DEFAULT_SERVER_KEY,
            customApiBase:
                typeof state.config.customApiBase === "string"
                    ? state.config.customApiBase
                    : "",
            syncTitleToSource: getSourceTitleSyncValue(state),
        },
        secrets: {
            bearerToken: secretDraft.bearerToken?.trim() ?? "",
        },
    }),
};
