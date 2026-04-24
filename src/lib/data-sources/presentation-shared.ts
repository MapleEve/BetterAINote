import type { UiLanguage } from "@/lib/i18n";
import { sourceProviderSupportsCapability } from "./catalog";
import type {
    DataSourceFormField,
    DataSourceUiState,
} from "./presentation-definition-types";
import { SOURCE_PROVIDER_MANIFESTS } from "./providers/manifest";

export function isZh(language: UiLanguage) {
    return language === "zh-CN";
}

export function cloneProviderDefaultConfig(
    provider: keyof typeof SOURCE_PROVIDER_MANIFESTS,
) {
    return {
        ...SOURCE_PROVIDER_MANIFESTS[provider].defaults.config,
    };
}

export function buildDraftSecrets(secretKeys: readonly string[]) {
    return Object.fromEntries(secretKeys.map((key) => [key, ""])) as Record<
        string,
        string
    >;
}

export function getSourceTitleSyncValue(state: DataSourceUiState) {
    const configValue = state.config.syncTitleToSource;
    return typeof configValue === "boolean" ? configValue : false;
}

export function buildSourceTitleSyncField(
    state: DataSourceUiState,
    language: UiLanguage,
): DataSourceFormField | null {
    if (
        !sourceProviderSupportsCapability(
            state.provider,
            "upstreamTitleWriteback",
        )
    ) {
        return null;
    }

    const zh = isZh(language);

    return {
        id: "source-sync-title",
        target: "config",
        key: "syncTitleToSource",
        kind: "switch",
        label: zh
            ? "将改名回写到数据源"
            : "Sync renamed titles back to the source",
        value: getSourceTitleSyncValue(state),
        description: zh
            ? "本地 AI 重命名成功后，把标题一并回写到对应数据源。"
            : "After a local AI rename succeeds, also write the title back to the connected source.",
    };
}

export function normalizeBearerSecretInput(value: string | undefined) {
    if (!value) {
        return "";
    }

    return value
        .replace(/^bearer[\s:]+/i, "")
        .replace(/\s+/g, "")
        .trim();
}
