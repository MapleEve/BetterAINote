"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    DATA_SOURCE_CATALOG,
    DATA_SOURCE_PROVIDERS,
    type SourceProvider,
} from "@/lib/data-sources/catalog";
import {
    buildDataSourceSavePayload,
    createDefaultSourceDrafts,
    type DataSourceDraftState,
    type DataSourceFormField,
    getProviderFormFields,
    getSourceProviderLabel,
    providerUsesCustomServerSelector,
} from "@/lib/data-sources/presentation";
import type { DataSourceUiState } from "@/lib/data-sources/presentation-definition-types";
import type { UiLanguage } from "@/lib/i18n";
import { saveDataSource } from "@/services/data-sources";

interface UseOnboardingDataSourceOptions {
    endpoint: string;
    language: UiLanguage;
}

export const INITIAL_ONBOARDING_SOURCE_PROVIDER: SourceProvider = "plaud";

function getEmptySecretPresence(
    draft: DataSourceDraftState[SourceProvider],
): Record<string, boolean> {
    return Object.fromEntries(
        Object.keys(draft.secrets).map((key) => [key, false]),
    ) as Record<string, boolean>;
}

function buildOnboardingSourceState(
    provider: SourceProvider,
    draft: DataSourceDraftState[SourceProvider],
): DataSourceUiState {
    return {
        provider,
        enabled: true,
        authMode: draft.authMode,
        baseUrl: draft.baseUrl,
        config: draft.config,
        secretsConfigured: getEmptySecretPresence(draft),
    };
}

function updateDraftFieldValue(
    draft: DataSourceDraftState[SourceProvider],
    field: DataSourceFormField,
    value: string | boolean,
): DataSourceDraftState[SourceProvider] {
    if (field.target === "root") {
        return {
            ...draft,
            [field.key]: value,
        };
    }

    if (field.target === "config") {
        return {
            ...draft,
            config: {
                ...draft.config,
                [field.key]: value,
            },
        };
    }

    return {
        ...draft,
        secrets: {
            ...draft.secrets,
            [field.key]: String(value),
        },
    };
}

export function useOnboardingDataSource({
    endpoint,
    language,
}: UseOnboardingDataSourceOptions) {
    const isZh = language === "zh-CN";
    const [provider, setProvider] = useState<SourceProvider>(
        INITIAL_ONBOARDING_SOURCE_PROVIDER,
    );
    const [drafts, setDrafts] = useState<DataSourceDraftState>(
        createDefaultSourceDrafts(),
    );
    const [isSaving, setIsSaving] = useState(false);
    const [connectedProvider, setConnectedProvider] =
        useState<SourceProvider | null>(null);

    const currentDraft = drafts[provider];
    const currentProviderCatalog = DATA_SOURCE_CATALOG[provider];
    const currentState = useMemo(
        () => buildOnboardingSourceState(provider, currentDraft),
        [currentDraft, provider],
    );

    const sourceLabel = useMemo(
        () => getSourceProviderLabel(provider, language),
        [language, provider],
    );
    const providerOptions = useMemo(
        () =>
            DATA_SOURCE_PROVIDERS.map((item) => ({
                provider: item,
                label: getSourceProviderLabel(item, language),
            })),
        [language],
    );
    const connectedSourceLabel = useMemo(
        () =>
            connectedProvider
                ? getSourceProviderLabel(connectedProvider, language)
                : null,
        [connectedProvider, language],
    );

    const providerFields = useMemo(
        () =>
            getProviderFormFields(
                currentState,
                { [provider]: currentDraft.secrets },
                language,
                "onboarding",
            ),
        [currentDraft.secrets, currentState, language, provider],
    );

    const updateDraft = useCallback(
        (
            nextProvider: SourceProvider,
            updater: (
                draft: DataSourceDraftState[SourceProvider],
            ) => DataSourceDraftState[SourceProvider],
        ) => {
            setDrafts((current) => ({
                ...current,
                [nextProvider]: updater(current[nextProvider]),
            }));
        },
        [],
    );

    const setAuthMode = useCallback(
        (authMode: string) => {
            updateDraft(provider, (draft) => ({
                ...draft,
                authMode,
            }));
        },
        [provider, updateDraft],
    );

    const setBaseUrl = useCallback(
        (baseUrl: string) => {
            updateDraft(provider, (draft) => ({
                ...draft,
                baseUrl,
            }));
        },
        [provider, updateDraft],
    );

    const selectProvider = useCallback((nextProvider: string) => {
        setProvider(nextProvider as SourceProvider);
    }, []);

    const updateField = useCallback(
        (field: DataSourceFormField, value: string | boolean) => {
            updateDraft(provider, (draft) =>
                updateDraftFieldValue(draft, field, value),
            );
        },
        [provider, updateDraft],
    );

    const connectSource = useCallback(async () => {
        const missingSecret = providerFields.find(
            (field) => field.target === "secret" && !String(field.value).trim(),
        );

        if (missingSecret) {
            toast.error(
                isZh
                    ? `请填写${missingSecret.label}`
                    : `Please enter ${missingSecret.label}`,
            );
            return false;
        }

        const payload = buildDataSourceSavePayload(
            currentState,
            {
                [provider]: currentDraft.secrets,
            },
            language,
        );

        setIsSaving(true);
        try {
            await saveDataSource(payload, {
                endpoint,
                fallbackMessage: isZh
                    ? "保存数据源失败"
                    : "Failed to save data source",
            });

            setConnectedProvider(provider);
            toast.success(
                isZh
                    ? `${getSourceProviderLabel(provider, language)} 已连接`
                    : `${getSourceProviderLabel(provider, language)} connected`,
            );
            return true;
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : isZh
                      ? "保存数据源失败"
                      : "Failed to save data source",
            );
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [
        currentDraft.secrets,
        currentState,
        endpoint,
        isZh,
        language,
        provider,
        providerFields,
    ]);

    return {
        connectedProvider,
        connectedSourceLabel,
        connectSource,
        currentDraft,
        currentProviderCatalog,
        isSaving,
        provider,
        providerFields,
        providerOptions,
        setAuthMode,
        setBaseUrl,
        selectProvider,
        sourceLabel,
        updateField,
        usesCustomServerSelector: providerUsesCustomServerSelector(provider),
    };
}
