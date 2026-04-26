"use client";

import { Database, ExternalLink, RotateCw } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatDateTime } from "@/lib/format-date";
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

const SOURCE_LIST_SKELETON_ITEMS = [
    "all",
    "primary",
    "secondary",
    "third",
    "fourth",
] as const;
const SOURCE_STAT_SKELETON_ITEMS = [
    "available",
    "configured",
    "enabled",
] as const;
const SOURCE_GROUP_SKELETON_ITEMS = [
    { id: "enabled", cardIds: ["plaud", "ticnote", "feishu", "dingtalk"] },
    { id: "more", cardIds: ["iflyrec", "reserved"] },
] as const;
const SOURCE_DETAIL_FIELD_SKELETON_ITEMS = [
    { id: "auth", tall: false },
    { id: "site", tall: false },
    { id: "token", tall: true },
    { id: "writeback", tall: false },
] as const;

function DataSourceListSkeleton() {
    return (
        <Card className="gap-3 self-start py-4">
            <CardHeader className="px-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-36" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                {SOURCE_LIST_SKELETON_ITEMS.map((item) => (
                    <div
                        key={`source-list-skeleton-${item}`}
                        className="flex flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-3"
                    >
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function ProviderOverviewSkeleton() {
    return (
        <div className="flex flex-col gap-5">
            <Card className="gap-4">
                <CardHeader>
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-4 w-64 max-w-full" />
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                    {SOURCE_STAT_SKELETON_ITEMS.map((item) => (
                        <div
                            key={`source-stat-skeleton-${item}`}
                            className="rounded-2xl border bg-muted/25 px-4 py-3"
                        >
                            <Skeleton className="h-7 w-10" />
                            <Skeleton className="mt-2 h-4 w-24" />
                        </div>
                    ))}
                </CardContent>
            </Card>

            {SOURCE_GROUP_SKELETON_ITEMS.map((section) => (
                <section
                    key={`source-group-skeleton-${section.id}`}
                    className="flex flex-col gap-3"
                >
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-4 w-72 max-w-full" />
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                        {section.cardIds.map((cardId) => (
                            <Card
                                key={`source-card-skeleton-${section.id}-${cardId}`}
                                className="gap-4"
                            >
                                <CardHeader className="gap-2">
                                    <Skeleton className="h-5 w-28" />
                                    <Skeleton className="h-4 w-20" />
                                    <CardAction>
                                        <Skeleton className="h-6 w-16 rounded-full" />
                                    </CardAction>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-4/5" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function ProviderDetailSkeleton() {
    return (
        <Card className="gap-5">
            <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-64 max-w-full" />
                <CardAction className="flex items-center gap-3">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-12 rounded-full" />
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                {SOURCE_DETAIL_FIELD_SKELETON_ITEMS.map((item) => (
                    <div
                        key={`source-detail-field-skeleton-${item.id}`}
                        className="flex flex-col gap-2"
                    >
                        <Skeleton className="h-4 w-24" />
                        <Skeleton
                            className={cn(
                                "w-full rounded-xl",
                                item.tall ? "h-24" : "h-10",
                            )}
                        />
                    </div>
                ))}
            </CardContent>
            <CardFooter className="flex flex-col items-stretch justify-between gap-4 border-t bg-background/10 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-col gap-2">
                    <Skeleton className="h-3 w-72 max-w-full" />
                    <Skeleton className="h-3 w-28" />
                </div>
                <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-10 w-24 rounded-xl" />
                    <Skeleton className="h-10 w-20 rounded-xl" />
                </div>
            </CardFooter>
        </Card>
    );
}

function DataSourcesSectionSkeleton({ isZh }: { isZh: boolean }) {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <div className="flex flex-col gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Database />
                    {isZh ? "数据源" : "Data Sources"}
                </h2>
                <Skeleton className="h-4 w-72 max-w-full" />
            </div>

            <div className="grid min-h-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
                <DataSourceListSkeleton />
                <div className="flex flex-col gap-5">
                    <ProviderOverviewSkeleton />
                    <ProviderDetailSkeleton />
                </div>
            </div>
        </div>
    );
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
    const saved = hasSavedSetup(source);

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
                saved && "border-emerald-400/25 bg-emerald-500/10",
                saved &&
                    isSelected &&
                    "border-emerald-300/45 bg-emerald-500/15",
                !saved && isSelected && "border-primary/60 bg-accent/40",
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
                    <span
                        className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground",
                            saved &&
                                "border-emerald-300/30 bg-emerald-500/15 text-emerald-100",
                        )}
                    >
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
                            {formatDateTime(
                                source.lastSync,
                                "absolute",
                                language,
                            )}
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
    const footerHint = isZh
        ? "底部操作只影响当前来源；保存后会用于同步、导入和标题回写。"
        : "Actions below only affect this source. Saved settings are used for sync, import, and title write-back.";
    const authModeControl =
        source.authModes.length > 1 ? (
            <div className="flex flex-col gap-2">
                <Label htmlFor={`${source.provider}-auth`}>
                    {isZh ? "登录方式" : "Sign-in method"}
                </Label>
                <Select
                    value={source.authMode}
                    onValueChange={(value) =>
                        updateSource(source.provider, (current) => ({
                            ...current,
                            authMode: value,
                        }))
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
            <div className="flex flex-col gap-1">
                <Label>{isZh ? "登录方式" : "Sign-in method"}</Label>
                <p className="text-sm text-muted-foreground">
                    {getSourceAuthModeDisplayLabel(source.authMode, language)}
                </p>
            </div>
        );

    return (
        <div className="flex flex-col gap-4">
            <Card
                className={cn(
                    "gap-5",
                    hasSavedSetup(source) &&
                        "border-emerald-300/25 bg-emerald-500/10",
                )}
            >
                <CardHeader>
                    <CardTitle className="text-xl">
                        {source.displayName}
                    </CardTitle>
                    <CardDescription>
                        {isZh
                            ? "填写登录信息，保存后启用该来源。"
                            : "Enter sign-in details, then save to enable this source."}
                    </CardDescription>
                    <CardAction className="flex items-center gap-3">
                        <span
                            className={cn(
                                "rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground",
                                hasSavedSetup(source) &&
                                    "border-emerald-300/30 bg-emerald-500/15 text-emerald-100",
                            )}
                        >
                            {getProviderStatusLabel(source, isZh)}
                        </span>
                        <div className="flex items-center gap-2">
                            <Label
                                htmlFor={`${source.provider}-enabled`}
                                className="text-xs text-muted-foreground"
                            >
                                {isZh ? "启用" : "Enable"}
                            </Label>
                            <Switch
                                id={`${source.provider}-enabled`}
                                checked={source.enabled}
                                onCheckedChange={(checked) =>
                                    updateSource(
                                        source.provider,
                                        (current) => ({
                                            ...current,
                                            enabled: checked,
                                        }),
                                    )
                                }
                            />
                        </div>
                    </CardAction>
                </CardHeader>

                <CardContent className="flex flex-col gap-5">
                    {authModeControl}

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

                <CardFooter className="flex flex-col items-stretch justify-between gap-4 border-t bg-background/10 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                        <span>{footerHint}</span>
                        {helpUrl ? (
                            <a
                                href={helpUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
                            >
                                {isZh ? "查看配置说明" : "Read setup guide"}
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
        return <DataSourcesSectionSkeleton isZh={isZh} />;
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
                                className={cn(
                                    "h-auto justify-start py-3",
                                    hasSavedSetup(source) &&
                                        "border border-emerald-300/20 bg-emerald-500/10 hover:bg-emerald-500/15",
                                    selectedProvider === source.provider &&
                                        hasSavedSetup(source) &&
                                        "border-emerald-300/35 bg-emerald-500/15",
                                )}
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
