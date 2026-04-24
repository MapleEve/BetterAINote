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
    normalizeBearerSecretInput,
} from "@/lib/data-sources/presentation-shared";
import { SOURCE_PROVIDER_MANIFESTS } from "@/lib/data-sources/providers/manifest";
import type { UiLanguage } from "@/lib/i18n";

const TICNOTE_REGION_ENDPOINTS = {
    cn: {
        baseUrl: "https://voice-api.ticnote.cn",
    },
    intl: {
        baseUrl: "https://prd-backend-api.ticnote.com/api",
    },
} as const;

type TicNoteRegion = keyof typeof TICNOTE_REGION_ENDPOINTS;

function isTicNoteRegion(value: unknown): value is TicNoteRegion {
    return value === "cn" || value === "intl";
}

function getTicNoteRegion(
    value: unknown,
    baseUrl?: string | null,
): TicNoteRegion {
    const normalizedBaseUrl = baseUrl?.replace(/\/$/, "") ?? null;

    if (isTicNoteRegion(value)) {
        return value;
    }

    if (normalizedBaseUrl === TICNOTE_REGION_ENDPOINTS.intl.baseUrl) {
        return "intl";
    }

    return "cn";
}

function getTicNoteRegionOptions(language: UiLanguage) {
    const zh = isZh(language);

    return [
        {
            value: "cn",
            label: zh ? "中国版" : "China",
        },
        {
            value: "intl",
            label: zh ? "国际版" : "International",
        },
    ] satisfies DataSourceFieldOption[];
}

function getTicNoteBaseUrl(region: TicNoteRegion) {
    return TICNOTE_REGION_ENDPOINTS[region].baseUrl;
}

function buildTicNoteFields(
    state: DataSourceUiState,
    secretDraft: Record<string, string>,
    language: UiLanguage,
    context: "settings" | "onboarding",
): DataSourceFormField[] {
    const zh = isZh(language);
    const region = getTicNoteRegion(state.config.region, state.baseUrl);
    const fields: DataSourceFormField[] = [
        buildSelectField({
            id: "source-region",
            key: "region",
            label: zh ? "站点版本" : "Site edition",
            value: region,
            description: zh
                ? "选择你的 TicNote 账号所在站点。"
                : "Choose the TicNote site for your account.",
            options: getTicNoteRegionOptions(language),
        }),
        buildTextField({
            id: "source-org-id",
            key: "orgId",
            label: zh ? "组织 ID（可选，高级）" : "Org ID (optional, advanced)",
            value: String(state.config.orgId ?? ""),
            description: zh
                ? "通常留空；多团队账号连接失败时再填写。"
                : "Usually leave blank. Fill this only if a multi-team account cannot connect.",
            placeholder: zh ? "通常留空" : "Usually leave blank",
        }),
        buildTextField({
            id: "source-timezone",
            key: "timezone",
            label: zh ? "时区" : "Timezone",
            value: String(state.config.timezone ?? "Asia/Shanghai"),
            placeholder: "Asia/Shanghai",
        }),
        buildSelectField({
            id: "source-language",
            key: "language",
            label: zh ? "语言标记" : "Language tag",
            value: String(state.config.language ?? "zh"),
            description: zh
                ? "选择录音内容的主要语言。"
                : "Choose the main language for recordings.",
            options: [
                { value: "zh", label: zh ? "中文" : "Chinese" },
                { value: "en", label: "English" },
                { value: "ja", label: "Japanese" },
            ],
        }),
        buildTextareaField({
            id: "source-secret",
            target: "secret",
            key: "bearerToken",
            label: zh ? "TicNote 登录令牌" : "TicNote sign-in token",
            value: secretDraft.bearerToken ?? "",
            rows: 3,
            spellCheck: false,
            className: "font-mono text-sm",
            description: zh
                ? "可直接粘贴整段登录信息。"
                : "Paste the full sign-in details directly.",
            placeholder: state.secretsConfigured.bearerToken
                ? zh
                    ? "已保存。重新粘贴即可替换。"
                    : "Already saved. Paste again to replace."
                : zh
                  ? "粘贴 TicNote 登录信息"
                  : "Paste your TicNote sign-in details",
        }),
    ];

    if (context === "settings") {
        const titleSyncField = buildSourceTitleSyncField(state, language);
        if (titleSyncField) {
            fields.push(titleSyncField);
        }
    }

    return fields;
}

export const ticnotePresentationDefinition: ProviderPresentationDefinition = {
    secretKeys: ["bearerToken"],
    usesCustomServerSelector: true,
    getFields: buildTicNoteFields,
    normalizePayload: ({ state, secretDraft, payload }) => {
        const region = getTicNoteRegion(state.config.region, state.baseUrl);

        return {
            ...payload,
            authMode: SOURCE_PROVIDER_MANIFESTS.ticnote.defaults.authMode,
            baseUrl: getTicNoteBaseUrl(region),
            config: {
                region,
                orgId:
                    typeof state.config.orgId === "string"
                        ? state.config.orgId
                        : "",
                timezone:
                    typeof state.config.timezone === "string"
                        ? state.config.timezone
                        : "Asia/Shanghai",
                language:
                    typeof state.config.language === "string"
                        ? state.config.language
                        : "zh",
                syncTitleToSource: getSourceTitleSyncValue(state),
            },
            secrets: {
                bearerToken: normalizeBearerSecretInput(
                    secretDraft.bearerToken,
                ),
            },
        };
    },
};
