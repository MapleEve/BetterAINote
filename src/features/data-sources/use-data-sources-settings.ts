"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { SourceProvider } from "@/lib/data-sources/catalog";
import {
    buildDataSourceDisplaySection,
    buildDataSourceSavePayload,
    type DataSourceDisplayState,
    type DataSourceFormField,
    type SecretDraftState,
} from "@/lib/data-sources/presentation";
import type { UiLanguage } from "@/lib/i18n";
import { getDataSources, saveDataSource } from "@/services/data-sources";

function updateFormFieldValue(
    source: DataSourceDisplayState,
    field: DataSourceFormField,
    value: string | boolean,
) {
    if (field.target === "config") {
        return {
            ...source,
            config: {
                ...source.config,
                [field.key]: value,
            },
        };
    }

    return {
        ...source,
        [field.key]: value,
    } as DataSourceDisplayState;
}

function getSettingsSaveErrorMessage(language: UiLanguage) {
    return language === "zh-CN"
        ? "连接失败，请检查凭据后重试"
        : "Connection failed. Check the credentials and try again.";
}

export function useDataSourcesSettings(language: UiLanguage) {
    const isZh = language === "zh-CN";
    const [sources, setSources] = useState<DataSourceDisplayState[]>([]);
    const [secretDrafts, setSecretDrafts] = useState<SecretDraftState>({});
    const [isLoading, setIsLoading] = useState(true);
    const [savingProvider, setSavingProvider] = useState<SourceProvider | null>(
        null,
    );

    const orderedSources = useMemo(() => {
        const displaySection = buildDataSourceDisplaySection(sources);
        return [...displaySection.connected, ...displaySection.available];
    }, [sources]);

    const refreshSources = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getDataSources();
            setSources(data.sources);
        } catch (error) {
            console.error("Failed to load data sources:", error);
            toast.error(
                isZh ? "加载数据源设置失败" : "Failed to load data sources",
            );
        } finally {
            setIsLoading(false);
        }
    }, [isZh]);

    useEffect(() => {
        void refreshSources();
    }, [refreshSources]);

    const updateSource = useCallback(
        (
            provider: SourceProvider,
            updater: (source: DataSourceDisplayState) => DataSourceDisplayState,
        ) => {
            setSources((current) =>
                current.map((source) =>
                    source.provider === provider ? updater(source) : source,
                ),
            );
        },
        [],
    );

    const updateSecretDraft = useCallback(
        (provider: SourceProvider, key: string, value: string) => {
            setSecretDrafts((current) => ({
                ...current,
                [provider]: {
                    ...(current[provider] ?? {}),
                    [key]: value,
                },
            }));
        },
        [],
    );

    const updateField = useCallback(
        (
            source: DataSourceDisplayState,
            field: DataSourceFormField,
            value: string | boolean,
        ) => {
            if (field.target === "secret") {
                updateSecretDraft(source.provider, field.key, String(value));
                return;
            }

            updateSource(source.provider, (current) =>
                updateFormFieldValue(current, field, value),
            );
        },
        [updateSecretDraft, updateSource],
    );

    const saveSourceSettings = useCallback(
        async (source: DataSourceDisplayState) => {
            setSavingProvider(source.provider);
            try {
                await saveDataSource(
                    buildDataSourceSavePayload(source, secretDrafts),
                    {
                        fallbackMessage: isZh
                            ? "保存数据源设置失败"
                            : "Failed to save data source settings",
                    },
                );
                setSecretDrafts((current) => ({
                    ...current,
                    [source.provider]: {},
                }));
                await refreshSources();
                toast.success(
                    isZh
                        ? `${source.displayName} 设置已保存`
                        : `${source.displayName} settings saved`,
                );
            } catch (error) {
                console.error("Failed to save data source settings:", error);
                toast.error(getSettingsSaveErrorMessage(language));
            } finally {
                setSavingProvider(null);
            }
        },
        [isZh, language, refreshSources, secretDrafts],
    );

    return {
        isLoading,
        orderedSources,
        savingProvider,
        secretDrafts,
        saveSourceSettings,
        sources,
        updateField,
        updateSource,
    };
}
