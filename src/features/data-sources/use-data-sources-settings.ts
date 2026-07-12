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
import {
    disconnectDataSource,
    getDataSources,
    reconnectDataSource,
    saveDataSource,
    testDataSource,
} from "@/services/data-sources";

const SETTINGS_PROVIDER_ORDER: SourceProvider[] = [
    "dingtalk-a1",
    "ticnote",
    "plaud",
    "feishu-minutes",
    "iflyrec",
];

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

function getSettingsSaveErrorMessage(error: unknown, language: UiLanguage) {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return language === "zh-CN"
        ? "保存数据源设置失败"
        : "Failed to save data source settings";
}

function getSettingsTestErrorMessage(error: unknown, language: UiLanguage) {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return language === "zh-CN"
        ? "测试数据源连接失败"
        : "Failed to test data source connection";
}

function getSettingsLoadErrorMessage(error: unknown, language: UiLanguage) {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return language === "zh-CN"
        ? "加载数据源设置失败"
        : "Failed to load data sources";
}

function getSettingsReconnectErrorMessage(
    error: unknown,
    language: UiLanguage,
) {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return language === "zh-CN"
        ? "重新连接失败，请检查登录信息后重试"
        : "Reconnect failed. Check the sign-in details and try again.";
}

function getSettingsDisconnectErrorMessage(
    error: unknown,
    language: UiLanguage,
) {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return language === "zh-CN"
        ? "断开连接失败，请稍后重试"
        : "Disconnect failed. Try again later.";
}

export function useDataSourcesSettings(language: UiLanguage) {
    const isZh = language === "zh-CN";
    const [sources, setSources] = useState<DataSourceDisplayState[]>([]);
    const [secretDrafts, setSecretDrafts] = useState<SecretDraftState>({});
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [savingProvider, setSavingProvider] = useState<SourceProvider | null>(
        null,
    );
    const [sourceActionProviders, setSourceActionProviders] = useState<
        Partial<Record<SourceProvider, "disconnecting" | "reconnecting">>
    >({});

    const setSourceActionProvider = useCallback(
        (
            provider: SourceProvider,
            action: "disconnecting" | "reconnecting" | null,
        ) => {
            setSourceActionProviders((current) => {
                if (!action) {
                    const { [provider]: _removed, ...rest } = current;
                    return rest;
                }

                return { ...current, [provider]: action };
            });
        },
        [],
    );

    const orderedSources = useMemo(() => {
        const displaySection = buildDataSourceDisplaySection(sources);
        return [...displaySection.connected, ...displaySection.available].sort(
            (left, right) =>
                SETTINGS_PROVIDER_ORDER.indexOf(left.provider) -
                SETTINGS_PROVIDER_ORDER.indexOf(right.provider),
        );
    }, [sources]);

    const refreshSources = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await getDataSources();
            setSources(data.sources);
        } catch (error) {
            console.error("Failed to load data sources:", error);
            const message = getSettingsLoadErrorMessage(error, language);
            setLoadError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, [language]);

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
                    buildDataSourceSavePayload(source, secretDrafts, language),
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
                return true;
            } catch (error) {
                console.error("Failed to save data source settings:", error);
                toast.error(getSettingsSaveErrorMessage(error, language));
                return false;
            } finally {
                setSavingProvider(null);
            }
        },
        [isZh, language, refreshSources, secretDrafts],
    );

    const testSourceSettings = useCallback(
        async (source: DataSourceDisplayState) => {
            try {
                await testDataSource(
                    buildDataSourceSavePayload(
                        {
                            ...source,
                            enabled: true,
                        },
                        secretDrafts,
                        language,
                    ),
                    {
                        fallbackMessage: isZh
                            ? "测试数据源连接失败"
                            : "Failed to test data source connection",
                    },
                );
                return { ok: true };
            } catch (error) {
                console.error("Failed to test data source connection:", error);
                return {
                    ok: false,
                    message: getSettingsTestErrorMessage(error, language),
                };
            }
        },
        [isZh, language, secretDrafts],
    );

    const disconnectSourceSettings = useCallback(
        async (source: DataSourceDisplayState) => {
            setSourceActionProvider(source.provider, "disconnecting");
            try {
                await disconnectDataSource(
                    { provider: source.provider },
                    {
                        fallbackMessage: isZh
                            ? "断开连接失败，请稍后重试"
                            : "Disconnect failed. Try again later.",
                    },
                );
                setSecretDrafts((current) => ({
                    ...current,
                    [source.provider]: {},
                }));
                await refreshSources();
                toast.success(
                    isZh
                        ? `${source.displayName} 已断开连接`
                        : `${source.displayName} disconnected`,
                );
                return true;
            } catch (error) {
                console.error("Failed to disconnect data source:", error);
                toast.error(getSettingsDisconnectErrorMessage(error, language));
                return false;
            } finally {
                setSourceActionProvider(source.provider, null);
            }
        },
        [isZh, language, refreshSources, setSourceActionProvider],
    );

    const reconnectSourceSettings = useCallback(
        async (source: DataSourceDisplayState) => {
            setSourceActionProvider(source.provider, "reconnecting");
            try {
                await reconnectDataSource(
                    buildDataSourceSavePayload(
                        {
                            ...source,
                            enabled: true,
                        },
                        secretDrafts,
                        language,
                    ),
                    {
                        fallbackMessage: isZh
                            ? "重新连接失败，请检查登录信息后重试"
                            : "Reconnect failed. Check the sign-in details and try again.",
                    },
                );
                setSecretDrafts((current) => ({
                    ...current,
                    [source.provider]: {},
                }));
                await refreshSources();
                toast.success(
                    isZh
                        ? `${source.displayName} 已重新连接`
                        : `${source.displayName} reconnected`,
                );
                return true;
            } catch (error) {
                console.error("Failed to reconnect data source:", error);
                toast.error(getSettingsReconnectErrorMessage(error, language));
                return false;
            } finally {
                setSourceActionProvider(source.provider, null);
            }
        },
        [isZh, language, refreshSources, secretDrafts, setSourceActionProvider],
    );

    return {
        disconnectSourceSettings,
        isLoading,
        loadError,
        orderedSources,
        refreshSources,
        reconnectSourceSettings,
        savingProvider,
        secretDrafts,
        saveSourceSettings,
        sourceActionProviders,
        sources,
        testSourceSettings,
        updateField,
        updateSource,
    };
}
