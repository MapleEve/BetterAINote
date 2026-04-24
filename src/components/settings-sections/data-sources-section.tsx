"use client";

import { Database, ExternalLink, Link2, RotateCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DataSourceFieldControl } from "@/features/data-sources/data-source-field-control";
import { useDataSourcesSettings } from "@/features/data-sources/use-data-sources-settings";
import type { SourceProvider } from "@/lib/data-sources/catalog";
import {
    type DataSourceDisplayState,
    type DataSourceFormField,
    getDataSourceHelpDocUrl,
    getProviderFormFields,
    getSourceAuthModeDisplayLabel,
    getSourceProviderMaturityHint,
    getSourceProviderMaturityLabel,
    groupDataSourceProvidersByStage,
    providerUsesCustomServerSelector,
} from "@/lib/data-sources/presentation";
import { cn } from "@/lib/utils";

function hasSavedSetup(source: DataSourceDisplayState) {
    return (
        source.connected ||
        Object.values(source.secretsConfigured).some(Boolean)
    );
}

function getProviderStatusLabel(source: DataSourceDisplayState, isZh: boolean) {
    if (hasSavedSetup(source) && source.enabled) {
        return isZh ? "已启用" : "Enabled";
    }

    if (hasSavedSetup(source)) {
        return isZh ? "已配置" : "Configured";
    }

    return isZh ? "待配置" : "Not configured";
}

function isAdvancedOptionalField(field: DataSourceFormField) {
    return field.id === "source-org-id";
}

interface ProviderCardProps {
    isSelected: boolean;
    isZh: boolean;
    language: "zh-CN" | "en";
    onSelect: () => void;
    source: DataSourceDisplayState;
}

function ProviderCard({
    isSelected,
    isZh,
    language,
    onSelect,
    source,
}: ProviderCardProps) {
    const maturity = getSourceProviderMaturityLabel(source.provider, language);
    const maturityHint = getSourceProviderMaturityHint(
        source.provider,
        language,
    );

    return (
        <Card
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect();
                }
            }}
            className={cn(
                "cursor-pointer gap-4 transition-all duration-200 hover:border-primary/45",
                isSelected && "border-primary/60 bg-accent/40",
            )}
        >
            <CardHeader className="gap-2">
                <CardTitle className="text-base">
                    {source.displayName}
                </CardTitle>
                <CardDescription>
                    {maturity ?? (isZh ? "录音来源" : "Recording source")}
                </CardDescription>
                <CardAction>
                    <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {getProviderStatusLabel(source, isZh)}
                    </span>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <p className="line-clamp-3 text-sm text-muted-foreground">
                    {maturityHint ??
                        (isZh
                            ? "配置鉴权后即可作为录音来源使用。"
                            : "Configure credentials to use this as a recording source.")}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {source.lastSync ? (
                        <span className="rounded-full border px-2.5 py-1">
                            {isZh ? "上次导入" : "Last import"} ·{" "}
                            {new Date(source.lastSync).toLocaleString(language)}
                        </span>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}

interface ProviderDetailProps {
    isZh: boolean;
    language: "zh-CN" | "en";
    onSelectOverview: () => void;
    onSave: (source: DataSourceDisplayState) => void;
    onTest: (source: DataSourceDisplayState) => void;
    savingProvider: SourceProvider | null;
    secretDrafts: ReturnType<typeof useDataSourcesSettings>["secretDrafts"];
    source: DataSourceDisplayState;
    updateField: ReturnType<typeof useDataSourcesSettings>["updateField"];
    updateSource: ReturnType<typeof useDataSourcesSettings>["updateSource"];
}

function ProviderDetail({
    isZh,
    language,
    onSelectOverview,
    onSave,
    onTest,
    savingProvider,
    secretDrafts,
    source,
    updateField,
    updateSource,
}: ProviderDetailProps) {
    const isSaving = savingProvider === source.provider;
    const helpUrl = getDataSourceHelpDocUrl(source.provider);
    const providerFields = getProviderFormFields(
        source,
        secretDrafts,
        language,
        "settings",
    );
    const primaryFields = providerFields.filter(
        (field) => !isAdvancedOptionalField(field),
    );
    const advancedFields = providerFields.filter(isAdvancedOptionalField);

    return (
        <div className="flex flex-col gap-4">
            <Button
                type="button"
                variant="ghost"
                className="self-start"
                onClick={onSelectOverview}
            >
                {isZh ? "返回来源列表" : "Back to sources"}
            </Button>

            <Card className="gap-5">
                <CardHeader>
                    <CardTitle className="text-xl">
                        {source.displayName}
                    </CardTitle>
                    <CardDescription>
                        {isZh
                            ? "填写连接信息后保存，必要时先测试连接。"
                            : "Enter connection details, then save or test the connection."}
                    </CardDescription>
                    <CardAction>
                        <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {getProviderStatusLabel(source, isZh)}
                        </span>
                    </CardAction>
                </CardHeader>

                <CardContent className="flex flex-col gap-5">
                    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-muted/35 px-4 py-3">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor={`${source.provider}-enabled`}>
                                {isZh ? "启用来源" : "Enable source"}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                {isZh
                                    ? "开启后会使用已保存的连接信息。"
                                    : "When enabled, saved connection details will be used."}
                            </p>
                        </div>
                        <Switch
                            id={`${source.provider}-enabled`}
                            checked={source.enabled}
                            onCheckedChange={(checked) =>
                                updateSource(source.provider, (current) => ({
                                    ...current,
                                    enabled: checked,
                                }))
                            }
                        />
                    </div>

                    {source.authModes.length > 1 ? (
                        <div className="flex flex-col gap-2">
                            <Label htmlFor={`${source.provider}-auth`}>
                                {isZh ? "登录方式" : "Sign-in method"}
                            </Label>
                            <Select
                                value={source.authMode}
                                onValueChange={(value) =>
                                    updateSource(
                                        source.provider,
                                        (current) => ({
                                            ...current,
                                            authMode: value,
                                        }),
                                    )
                                }
                            >
                                <SelectTrigger
                                    id={`${source.provider}-auth`}
                                    className="w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {source.authModes.map((mode) => (
                                            <SelectItem key={mode} value={mode}>
                                                {getSourceAuthModeDisplayLabel(
                                                    mode,
                                                    language,
                                                )}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1 rounded-2xl border bg-muted/20 px-4 py-3">
                            <Label>
                                {isZh ? "登录方式" : "Sign-in method"}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                {getSourceAuthModeDisplayLabel(
                                    source.authMode,
                                    language,
                                )}
                            </p>
                        </div>
                    )}

                    {!providerUsesCustomServerSelector(source.provider) ? (
                        <div className="flex flex-col gap-2">
                            <Label htmlFor={`${source.provider}-base-url`}>
                                {isZh ? "服务地址" : "Service URL"}
                            </Label>
                            <Input
                                id={`${source.provider}-base-url`}
                                value={source.baseUrl ?? ""}
                                onChange={(event) =>
                                    updateSource(
                                        source.provider,
                                        (current) => ({
                                            ...current,
                                            baseUrl: event.target.value,
                                        }),
                                    )
                                }
                            />
                        </div>
                    ) : null}

                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <h3 className="font-medium">
                                {isZh ? "连接信息" : "Connection details"}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {isZh
                                    ? "已保存的密钥不会回显；留空表示继续使用原值。"
                                    : "Saved secrets are hidden. Leave blank to keep the current value."}
                            </p>
                        </div>
                        {primaryFields.map((field) => (
                            <DataSourceFieldControl
                                key={field.id}
                                field={field}
                                fieldId={`${source.provider}-${field.id}`}
                                onValueChange={(nextField, value) =>
                                    updateField(source, nextField, value)
                                }
                                variant="settings"
                            />
                        ))}
                    </div>

                    {advancedFields.length > 0 ? (
                        <div className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-4">
                            <div className="flex flex-col gap-1">
                                <h3 className="font-medium">
                                    {isZh
                                        ? "高级选项（可选）"
                                        : "Advanced options (optional)"}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {isZh
                                        ? "通常留空；多团队账号连接失败时再填写。"
                                        : "Usually leave blank. Fill this only if a multi-team account cannot connect."}
                                </p>
                            </div>
                            {advancedFields.map((field) => (
                                <DataSourceFieldControl
                                    key={field.id}
                                    field={field}
                                    fieldId={`${source.provider}-${field.id}`}
                                    onValueChange={(nextField, value) =>
                                        updateField(source, nextField, value)
                                    }
                                    variant="settings"
                                />
                            ))}
                        </div>
                    ) : null}
                </CardContent>

                <CardFooter className="flex flex-col items-stretch justify-between gap-3 border-t sm:flex-row sm:items-center">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                            <Link2 data-icon="inline-start" />
                            {isZh
                                ? "连接失败时，请检查凭据后重试。"
                                : "If connection fails, check the credentials and try again."}
                        </span>
                        {helpUrl ? (
                            <a
                                href={helpUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
                            >
                                {isZh ? "帮助文档" : "Help"}
                                <ExternalLink data-icon="inline-end" />
                            </a>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onTest(source)}
                            disabled={isSaving}
                        >
                            <RotateCw data-icon="inline-start" />
                            {isSaving
                                ? isZh
                                    ? "测试中..."
                                    : "Testing..."
                                : isZh
                                  ? "测试连接"
                                  : "Test"}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => onSave(source)}
                            disabled={isSaving}
                        >
                            {isSaving
                                ? isZh
                                    ? "保存中..."
                                    : "Saving..."
                                : isZh
                                  ? "保存"
                                  : "Save"}
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

export function DataSourcesSection() {
    const { language } = useLanguage();
    const isZh = language === "zh-CN";
    const {
        isLoading,
        orderedSources,
        savingProvider,
        secretDrafts,
        saveSourceSettings,
        updateField,
        updateSource,
    } = useDataSourcesSettings(language);
    const [selectedProvider, setSelectedProvider] =
        useState<SourceProvider | null>(null);

    const selectedSource = orderedSources.find(
        (source) => source.provider === selectedProvider,
    );
    const groupedSources = useMemo(
        () => groupDataSourceProvidersByStage(orderedSources, language),
        [language, orderedSources],
    );
    const connectedCount = orderedSources.filter(hasSavedSetup).length;
    const enabledCount = orderedSources.filter(
        (source) => source.enabled,
    ).length;

    useEffect(() => {
        if (
            selectedProvider &&
            !orderedSources.some(
                (source) => source.provider === selectedProvider,
            )
        ) {
            setSelectedProvider(null);
        }
    }, [orderedSources, selectedProvider]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    const renderProviderOverview = () => (
        <div className="flex flex-col gap-5">
            <Card className="gap-4">
                <CardHeader>
                    <CardTitle className="text-xl">
                        {isZh ? "录音来源" : "Recording sources"}
                    </CardTitle>
                    <CardDescription>
                        {isZh
                            ? "查看连接状态，选择一个来源进行设置。"
                            : "Review connection status, then choose a source to edit."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border bg-muted/25 px-4 py-3">
                        <p className="text-2xl font-semibold">
                            {orderedSources.length}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {isZh ? "可连接来源" : "Available sources"}
                        </p>
                    </div>
                    <div className="rounded-2xl border bg-muted/25 px-4 py-3">
                        <p className="text-2xl font-semibold">
                            {connectedCount}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {isZh ? "已保存配置" : "Configured"}
                        </p>
                    </div>
                    <div className="rounded-2xl border bg-muted/25 px-4 py-3">
                        <p className="text-2xl font-semibold">{enabledCount}</p>
                        <p className="text-sm text-muted-foreground">
                            {isZh ? "当前启用" : "Enabled now"}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {groupedSources.map((group) => (
                <section key={group.stage} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <h3 className="font-semibold">{group.title}</h3>
                        <p className="text-sm text-muted-foreground">
                            {group.description}
                        </p>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                        {group.sources.map((source) => (
                            <ProviderCard
                                key={source.provider}
                                isSelected={
                                    source.provider === selectedProvider
                                }
                                isZh={isZh}
                                language={language}
                                onSelect={() =>
                                    setSelectedProvider(source.provider)
                                }
                                source={source}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Database />
                    {isZh ? "数据源" : "Data Sources"}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {isZh
                        ? "连接录音来源，管理导入所需的登录信息。"
                        : "Connect recording sources and manage sign-in details."}
                </p>
            </div>

            <div className="grid min-h-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
                <Card className="gap-3 self-start py-4">
                    <CardHeader className="px-4">
                        <CardTitle className="text-sm">
                            {isZh ? "来源列表" : "Sources"}
                        </CardTitle>
                        <CardDescription>
                            {isZh
                                ? "选择一个来源进入详情。"
                                : "Choose a source to edit details."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 px-4">
                        <Button
                            type="button"
                            variant={selectedProvider ? "ghost" : "secondary"}
                            className="justify-start"
                            onClick={() => setSelectedProvider(null)}
                        >
                            {isZh ? "全部来源" : "All sources"}
                        </Button>
                        {orderedSources.map((source) => (
                            <Button
                                key={source.provider}
                                type="button"
                                variant={
                                    selectedProvider === source.provider
                                        ? "secondary"
                                        : "ghost"
                                }
                                className="h-auto justify-start py-3"
                                onClick={() =>
                                    setSelectedProvider(source.provider)
                                }
                            >
                                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                                    <span className="truncate">
                                        {source.displayName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {getProviderStatusLabel(source, isZh)}
                                    </span>
                                </span>
                            </Button>
                        ))}
                    </CardContent>
                </Card>

                {selectedSource ? (
                    <ProviderDetail
                        isZh={isZh}
                        language={language}
                        onSelectOverview={() => setSelectedProvider(null)}
                        onSave={(source) => void saveSourceSettings(source)}
                        onTest={(source) => void saveSourceSettings(source)}
                        savingProvider={savingProvider}
                        secretDrafts={secretDrafts}
                        source={selectedSource}
                        updateField={updateField}
                        updateSource={updateSource}
                    />
                ) : (
                    renderProviderOverview()
                )}
            </div>
        </div>
    );
}
