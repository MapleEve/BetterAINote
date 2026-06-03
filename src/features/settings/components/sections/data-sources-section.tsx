"use client";

import {
    AlertCircle,
    CheckCircle2,
    Cloud,
    Database,
    ExternalLink,
    Info,
    type LucideIcon,
    MessageSquare,
    Mic2,
    PauseCircle,
    Radio,
    RotateCw,
    XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { DataSourceFieldControl } from "@/features/data-sources/data-source-field-control";
import { useDataSourcesSettings } from "@/features/data-sources/use-data-sources-settings";
import { useSettingsSectionBusy } from "@/features/settings/components/settings-busy-context";
import {
    isSourceProvider,
    type SourceProvider,
} from "@/lib/data-sources/catalog";
import {
    type DataSourceDisplayState,
    type DataSourceFormField,
    getDataSourceHelpDocUrl,
    getProviderFormFields,
    getProviderServiceAddressDisplay,
    getSourceAuthModeDisplayLabel,
    getSourceProviderLabel,
    getSourceProviderMaturityHint,
    getSourceProviderMaturityLabel,
    groupDataSourceProvidersByStage,
    providerUsesCustomServerSelector,
} from "@/lib/data-sources/presentation";
import { formatDateTime } from "@/lib/format-date";
import {
    readBrowserStorage,
    writeBrowserStorage,
} from "@/lib/platform/browser-shell";
import { cn } from "@/lib/utils";

const SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY =
    "settings-data-source-provider";

function hasSavedSetup(source: DataSourceDisplayState) {
    return (
        source.connected ||
        Object.values(source.secretsConfigured).some(Boolean)
    );
}

function isAdvancedOptionalField(field: DataSourceFormField) {
    return field.id === "source-org-id";
}

type ProviderTone = "success" | "info" | "warning" | "danger" | "neutral";

type ProviderActionState =
    | "idle"
    | "testing"
    | "test-success"
    | "test-error"
    | "saving"
    | "saved"
    | "save-error";

interface ProviderActionMessage {
    description: string;
    state: ProviderActionState;
    title: string;
}

type ProviderDisplayStatus =
    | "needs-setup"
    | "configured"
    | "connected"
    | "paused"
    | "expired"
    | "planned"
    | ProviderActionState;

interface ProviderStatusDisplay {
    description: string;
    label: string;
    state: ProviderDisplayStatus;
    tone: ProviderTone;
}

const providerStatusClasses: Record<ProviderTone, string> = {
    success:
        "border-emerald-400/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
    info: "border-sky-400/30 bg-sky-500/15 text-sky-700 dark:text-sky-200",
    warning:
        "border-amber-400/35 bg-amber-500/15 text-amber-700 dark:text-amber-200",
    danger: "border-destructive/35 bg-destructive/15 text-destructive dark:text-red-200",
    neutral: "border-border/70 bg-background/45 text-muted-foreground",
};

const providerBannerClasses: Record<ProviderTone, string> = {
    success:
        "border-emerald-400/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
    info: "border-sky-400/25 bg-sky-500/10 text-sky-700 dark:text-sky-200",
    warning:
        "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
    danger: "border-destructive/30 bg-destructive/10 text-destructive dark:text-red-200",
    neutral: "border-border/70 bg-muted/25 text-muted-foreground",
};

const PROVIDER_ICONS: Record<SourceProvider, LucideIcon> = {
    "dingtalk-a1": Radio,
    ticnote: Mic2,
    plaud: Cloud,
    "feishu-minutes": MessageSquare,
    iflyrec: Database,
};
const PROVIDER_ASSET_CLASSES: Partial<Record<SourceProvider, string>> = {
    "dingtalk-a1": "bg-[url('/assets/sources/dingtalk.svg')]",
    ticnote: "bg-[url('/assets/sources/ticnote.png')]",
    plaud: "bg-[url('/assets/sources/plaud.png')]",
    "feishu-minutes": "bg-[url('/assets/sources/feishu.jpeg')]",
};

function getProviderStatusDisplay(
    source: DataSourceDisplayState,
    isZh: boolean,
    actionState: ProviderActionState = "idle",
): ProviderStatusDisplay {
    if (actionState === "saving") {
        return {
            label: isZh ? "保存中" : "Saving",
            description: isZh
                ? "正在保存当前来源的连接信息。"
                : "Saving this source connection.",
            state: "saving",
            tone: "info",
        };
    }

    if (actionState === "testing") {
        return {
            label: isZh ? "测试中" : "Testing",
            description: isZh
                ? "正在检查当前表单中的连接信息。"
                : "Checking the connection details in this form.",
            state: "testing",
            tone: "info",
        };
    }

    if (actionState === "save-error" || actionState === "test-error") {
        return {
            label: isZh ? "需要处理" : "Needs action",
            description: isZh
                ? "当前连接信息还没有通过检查。"
                : "The current connection details need attention.",
            state: actionState,
            tone: "danger",
        };
    }

    if (actionState === "saved" || actionState === "test-success") {
        return {
            label: isZh ? "连接信息正常" : "Connection ready",
            description: isZh
                ? "当前连接信息已通过本地检查。"
                : "The current connection details passed local checks.",
            state: actionState,
            tone: "success",
        };
    }

    if (source.connectionStatus === "expired") {
        return {
            label: isZh ? "需要重新登录" : "Re-auth required",
            description: isZh
                ? "上游登录状态已过期，请更新登录信息后保存。"
                : "The upstream sign-in has expired. Update the sign-in details, then save.",
            state: "expired",
            tone: "warning",
        };
    }

    if (source.runtimeStatus === "planned") {
        return {
            label: isZh ? "即将支持" : "Planned",
            description: isZh
                ? "该来源还在准备中，当前不能启用、测试或保存。"
                : "This source is still being prepared and cannot be enabled, tested, or saved yet.",
            state: "planned",
            tone: "neutral",
        };
    }

    if (hasSavedSetup(source) && !source.enabled) {
        return {
            label: isZh ? "同步已暂停" : "Import paused",
            description: isZh
                ? "连接信息已保留，但 BetterAINote 暂不读取新录音。"
                : "Connection details are kept, but new recordings are not imported.",
            state: "paused",
            tone: "warning",
        };
    }

    if (source.connected && source.enabled) {
        return {
            label: isZh ? "已连接" : "Connected",
            description: isZh
                ? "该来源已保存连接信息，可用于导入录音。"
                : "This source has saved connection details and can import recordings.",
            state: "connected",
            tone: "success",
        };
    }

    if (hasSavedSetup(source)) {
        return {
            label: isZh ? "已配置" : "Configured",
            description: isZh
                ? "已保存部分连接信息，保存后可继续用于导入。"
                : "Some connection details are saved and can continue after saving.",
            state: "configured",
            tone: "info",
        };
    }

    return {
        label: isZh ? "待设置" : "Not configured",
        description: isZh
            ? "补齐登录信息后即可保存。"
            : "Add sign-in details, then save.",
        state: "needs-setup",
        tone: "neutral",
    };
}

function getActionTone(state: ProviderActionState): ProviderTone {
    switch (state) {
        case "testing":
        case "saving":
            return "info";
        case "test-success":
        case "saved":
            return "success";
        case "test-error":
        case "save-error":
            return "danger";
        default:
            return "neutral";
    }
}

function getProviderActionMessage(
    status: ProviderStatusDisplay,
    source: DataSourceDisplayState,
    message: ProviderActionMessage | null,
    isZh: boolean,
) {
    if (message) {
        return {
            description: message.description,
            title: message.title,
            tone: getActionTone(message.state),
        };
    }

    if (source.connectionStatus === "expired") {
        return {
            description: status.description,
            title: isZh ? "登录已过期" : "Sign-in expired",
            tone: "warning" as const,
        };
    }

    if (source.runtimeStatus === "planned") {
        return {
            description: status.description,
            title: status.label,
            tone: "neutral" as const,
        };
    }

    if (!source.enabled && hasSavedSetup(source)) {
        return {
            description: status.description,
            title: status.label,
            tone: status.tone,
        };
    }

    if (!hasSavedSetup(source)) {
        return {
            description: status.description,
            title: isZh ? "尚未连接" : "Not connected",
            tone: "info" as const,
        };
    }

    return null;
}

function getMissingConnectionFields(
    source: DataSourceDisplayState,
    fields: DataSourceFormField[],
) {
    return fields.filter((field) => {
        if (isAdvancedOptionalField(field)) {
            return false;
        }

        if (field.kind === "switch" || field.kind === "select") {
            return false;
        }

        if (field.target === "secret") {
            return (
                !source.secretsConfigured[field.key] &&
                !String(field.value ?? "").trim()
            );
        }

        return !String(field.value ?? "").trim();
    });
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
    actionState?: ProviderActionState;
    disabled?: boolean;
    isSelected: boolean;
    isZh: boolean;
    language: "zh-CN" | "en";
    onSelect: () => void;
    source: DataSourceDisplayState;
}

function ProviderCard({
    actionState = "idle",
    disabled = false,
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
    const expired = source.connectionStatus === "expired";
    const status = getProviderStatusDisplay(source, isZh, actionState);
    const ProviderIcon = PROVIDER_ICONS[source.provider];
    const providerAssetClass = PROVIDER_ASSET_CLASSES[source.provider];
    const displayName = getSourceProviderLabel(source.provider, language);

    return (
        <button
            type="button"
            onClick={disabled ? undefined : onSelect}
            aria-pressed={isSelected}
            disabled={disabled}
            data-provider={source.provider}
            data-provider-selected={isSelected ? "true" : "false"}
            data-provider-state={status.label}
            data-provider-status={status.state}
            data-provider-tone={status.tone}
            className={cn(
                "grid w-full grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-all duration-200 hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-55 sm:grid-cols-[2rem_minmax(0,1fr)_auto]",
                saved && !expired && "border-emerald-400/20 bg-emerald-500/10",
                saved &&
                    !expired &&
                    isSelected &&
                    "border-emerald-300/45 bg-emerald-500/15 shadow-xs",
                expired && "border-amber-400/25 bg-amber-500/10",
                expired &&
                    isSelected &&
                    "border-amber-300/45 bg-amber-500/15 shadow-xs",
                !saved &&
                    isSelected &&
                    "border-primary/45 bg-primary/10 shadow-xs",
            )}
        >
            <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/35 text-xs font-semibold text-foreground"
                data-testid="data-source-provider-initial"
            >
                {providerAssetClass ? (
                    <span
                        className={cn(
                            "size-5 rounded-[0.32rem] bg-cover bg-center",
                            providerAssetClass,
                        )}
                    />
                ) : (
                    <ProviderIcon className="size-4" />
                )}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-semibold">
                    {displayName}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                    {maturity ?? (isZh ? "录音来源" : "Recording source")}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground/85">
                    {maturityHint ??
                        (isZh
                            ? "配置鉴权后即可作为录音来源使用。"
                            : "Configure credentials to use this as a recording source.")}
                </span>
                {source.lastSync ? (
                    <span className="text-[0.68rem] text-muted-foreground">
                        {isZh ? "上次导入" : "Last import"} ·{" "}
                        {formatDateTime(source.lastSync, "absolute", language)}
                    </span>
                ) : null}
            </span>
            <span
                className={cn(
                    "col-start-2 inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-full border px-2 text-[0.68rem] font-semibold sm:col-start-auto",
                    providerStatusClasses[status.tone],
                )}
            >
                <span className="size-1.5 rounded-full bg-current" />
                {status.label}
            </span>
        </button>
    );
}

interface ProviderDetailProps {
    actionMessage: ProviderActionMessage | null;
    isZh: boolean;
    language: "zh-CN" | "en";
    onSave: (source: DataSourceDisplayState) => Promise<void>;
    onTest: (source: DataSourceDisplayState) => Promise<void>;
    savingProvider: SourceProvider | null;
    secretDrafts: ReturnType<typeof useDataSourcesSettings>["secretDrafts"];
    source: DataSourceDisplayState;
    updateField: ReturnType<typeof useDataSourcesSettings>["updateField"];
    updateSource: ReturnType<typeof useDataSourcesSettings>["updateSource"];
}

function ProviderStateBanner({
    description,
    title,
    tone,
}: {
    description: string;
    title: string;
    tone: ProviderTone;
}) {
    const Icon =
        tone === "success"
            ? CheckCircle2
            : tone === "warning"
              ? AlertCircle
              : tone === "danger"
                ? XCircle
                : tone === "info"
                  ? Info
                  : PauseCircle;

    return (
        <div
            className={cn(
                "grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-3 rounded-xl border px-4 py-3 text-sm",
                providerBannerClasses[tone],
            )}
            data-provider-banner-tone={tone}
            data-testid="data-source-provider-state-banner"
        >
            <span className="flex size-7 items-center justify-center rounded-lg border border-current/20 bg-background/35">
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
                <span className="block font-semibold text-foreground">
                    {title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                    {description}
                </span>
            </span>
        </div>
    );
}

function ProviderDetail({
    actionMessage,
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
    const actionState: ProviderActionState = isSaving
        ? "saving"
        : (actionMessage?.state ?? "idle");
    const isProviderActionBusy =
        actionState === "testing" || actionState === "saving";
    const isProviderInteractionDisabled =
        source.runtimeStatus === "planned" || isProviderActionBusy;
    const status = getProviderStatusDisplay(source, isZh, actionState);
    const displayName = getSourceProviderLabel(source.provider, language);
    const helpUrl = getDataSourceHelpDocUrl(source.provider);
    const serviceAddress = getProviderServiceAddressDisplay(source, language);
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
    const missingFields = getMissingConnectionFields(source, primaryFields);
    const banner = getProviderActionMessage(
        status,
        source,
        actionMessage,
        isZh,
    );
    const footerHint = isZh
        ? "底部操作只影响当前来源；保存后会用于导入、更新和标题回写。"
        : "Actions below only affect this source. Saved settings are used for import, updates, and title write-back.";
    const authModeControl =
        source.authModes.length > 1 ? (
            <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">
                    {isZh ? "登录方式" : "Sign-in method"}
                </legend>
                <div
                    className="grid gap-2 sm:grid-cols-2"
                    data-auth-mode-picker=""
                >
                    {source.authModes.map((mode) => {
                        const active = source.authMode === mode;

                        return (
                            <button
                                key={mode}
                                type="button"
                                aria-pressed={active}
                                data-active={active ? "true" : "false"}
                                data-auth-mode={mode}
                                disabled={isProviderInteractionDisabled}
                                onClick={() =>
                                    updateSource(
                                        source.provider,
                                        (current) => ({
                                            ...current,
                                            authMode: mode,
                                        }),
                                    )
                                }
                                className="rounded-xl border border-border/70 bg-background/35 px-3 py-3 text-left transition-colors hover:bg-muted/45 disabled:cursor-not-allowed disabled:opacity-55 data-[active=true]:border-primary/35 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                            >
                                <span className="block text-sm font-semibold">
                                    {getSourceAuthModeDisplayLabel(
                                        mode,
                                        language,
                                    )}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                    {mode === "web-reverse"
                                        ? isZh
                                            ? "网页登录会话，适合从网页导入来源内容。"
                                            : "Web session credentials for source-side imports."
                                        : isZh
                                          ? "开放平台或服务端凭据，适合稳定导入。"
                                          : "Open-platform or server credentials for stable imports."}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </fieldset>
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
                data-provider-detail={source.provider}
                data-provider-action-state={actionState}
                data-provider-interaction-disabled={
                    isProviderInteractionDisabled ? "true" : "false"
                }
                data-provider-status={status.state}
                data-provider-tone={status.tone}
                className={cn(
                    "gap-5 border-border/75",
                    hasSavedSetup(source) &&
                        "border-emerald-300/25 bg-emerald-500/10",
                )}
            >
                <CardHeader>
                    <CardTitle className="text-xl">{displayName}</CardTitle>
                    <CardDescription>
                        {isZh
                            ? "按下方提示补充登录信息，保存后启用该来源。"
                            : "Add the sign-in details below, then save to enable this source."}
                    </CardDescription>
                    <CardAction className="flex items-center gap-3">
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                                providerStatusClasses[status.tone],
                            )}
                        >
                            {actionState === "testing" ||
                            actionState === "saving" ? (
                                <RotateCw className="size-3 animate-spin" />
                            ) : (
                                <span className="size-1.5 rounded-full bg-current" />
                            )}
                            {status.label}
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
                                disabled={isProviderInteractionDisabled}
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
                    {banner ? <ProviderStateBanner {...banner} /> : null}

                    {authModeControl}

                    {!providerUsesCustomServerSelector(source.provider) ? (
                        <div className="flex flex-col gap-2">
                            <Label htmlFor={`${source.provider}-base-url`}>
                                {serviceAddress.label}
                            </Label>
                            <Input
                                id={`${source.provider}-base-url`}
                                value={serviceAddress.value}
                                readOnly={serviceAddress.readOnly}
                                disabled={isProviderInteractionDisabled}
                                onChange={(event) =>
                                    serviceAddress.readOnly
                                        ? undefined
                                        : updateSource(
                                              source.provider,
                                              (current) => ({
                                                  ...current,
                                                  baseUrl: event.target.value,
                                              }),
                                          )
                                }
                            />
                            {serviceAddress.description ? (
                                <p className="text-xs text-muted-foreground">
                                    {serviceAddress.description}
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="flex flex-col gap-4">
                        {primaryFields.map((field) => (
                            <DataSourceFieldControl
                                key={field.id}
                                field={field}
                                fieldId={`${source.provider}-${field.id}`}
                                disabled={isProviderInteractionDisabled}
                                onValueChange={(nextField, value) =>
                                    updateField(source, nextField, value)
                                }
                                variant="settings"
                            />
                        ))}
                    </div>

                    {missingFields.length > 0 ? (
                        <div className="rounded-xl border border-dashed border-border/75 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                            {isZh
                                ? `还有 ${missingFields.length} 项登录信息待填写。`
                                : `${missingFields.length} sign-in field${missingFields.length === 1 ? "" : "s"} still need attention.`}
                        </div>
                    ) : null}

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
                                    disabled={isProviderInteractionDisabled}
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
                            onClick={() => void onTest(source)}
                            data-testid="data-source-test-connection"
                            disabled={isProviderInteractionDisabled}
                            aria-busy={actionState === "testing"}
                        >
                            <RotateCw data-icon="inline-start" />
                            {actionState === "testing"
                                ? isZh
                                    ? "测试中..."
                                    : "Testing..."
                                : actionState === "test-success"
                                  ? isZh
                                      ? "连接正常"
                                      : "Ready"
                                  : isZh
                                    ? "测试连接"
                                    : "Test"}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void onSave(source)}
                            data-testid="data-source-save"
                            disabled={isProviderInteractionDisabled}
                            aria-busy={isSaving}
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
        loadError,
        orderedSources,
        refreshSources,
        savingProvider,
        secretDrafts,
        saveSourceSettings,
        testSourceSettings,
        updateField,
        updateSource,
    } = useDataSourcesSettings(language);
    const [selectedProvider, setSelectedProvider] =
        useState<SourceProvider | null>(null);
    const [providerActionMessages, setProviderActionMessages] = useState<
        Partial<Record<SourceProvider, ProviderActionMessage>>
    >({});
    const providerDetailScrollRef = useRef<HTMLElement | null>(null);

    const selectedSource =
        orderedSources.find((source) => source.provider === selectedProvider) ??
        orderedSources[0] ??
        null;
    const groupedSources = useMemo(
        () => groupDataSourceProvidersByStage(orderedSources, language),
        [language, orderedSources],
    );
    const providerActionIsBusy = Object.values(providerActionMessages).some(
        (message) =>
            message?.state === "testing" || message?.state === "saving",
    );
    const isDataSourcesBusy = Boolean(savingProvider || providerActionIsBusy);
    const connectedCount = orderedSources.filter(hasSavedSetup).length;
    const enabledCount = orderedSources.filter(
        (source) => source.enabled,
    ).length;
    useSettingsSectionBusy("data-sources", isDataSourcesBusy);

    useEffect(() => {
        if (orderedSources.length === 0) {
            if (selectedProvider) {
                setSelectedProvider(null);
            }
            return;
        }

        const preferredProvider = readBrowserStorage(
            SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY,
        );
        if (
            isSourceProvider(preferredProvider) &&
            orderedSources.some(
                (source) => source.provider === preferredProvider,
            )
        ) {
            if (selectedProvider !== preferredProvider) {
                setSelectedProvider(preferredProvider);
            }
            writeBrowserStorage(SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY, "");
            return;
        }

        if (
            !selectedProvider ||
            !orderedSources.some(
                (source) => source.provider === selectedProvider,
            )
        ) {
            setSelectedProvider(orderedSources[0].provider);
        }
    }, [orderedSources, selectedProvider]);

    useEffect(() => {
        if (!selectedProvider) return;
        providerDetailScrollRef.current?.scrollTo({ top: 0, left: 0 });
    }, [selectedProvider]);

    const setProviderActionMessage = (
        provider: SourceProvider,
        message: ProviderActionMessage | null,
    ) => {
        setProviderActionMessages((current) => {
            if (!message) {
                const { [provider]: _removed, ...rest } = current;
                return rest;
            }

            return {
                ...current,
                [provider]: message,
            };
        });
    };

    const scheduleProviderActionMessageReset = (provider: SourceProvider) => {
        window.setTimeout(() => setProviderActionMessage(provider, null), 2600);
    };

    const handleSaveSource = async (source: DataSourceDisplayState) => {
        if (isDataSourcesBusy) {
            return;
        }

        if (source.runtimeStatus === "planned") {
            setProviderActionMessage(source.provider, {
                description: isZh
                    ? "该来源还在准备中，当前不能保存配置。"
                    : "This source is still being prepared and cannot be saved yet.",
                state: "save-error",
                title: isZh ? "暂不可保存" : "Save unavailable",
            });
            scheduleProviderActionMessageReset(source.provider);
            return;
        }

        setProviderActionMessage(source.provider, {
            description: isZh
                ? "正在保存当前来源的连接信息。"
                : "Saving this source connection.",
            state: "saving",
            title: isZh ? "保存中" : "Saving",
        });

        const saved = await saveSourceSettings(source);
        setProviderActionMessage(source.provider, {
            description: saved
                ? isZh
                    ? "连接信息已保存，稍后导入会使用最新设置。"
                    : "Connection details are saved and will be used for future imports."
                : isZh
                  ? "保存失败，请检查连接信息后重试。"
                  : "Save failed. Check the connection details and try again.",
            state: saved ? "saved" : "save-error",
            title: saved
                ? isZh
                    ? "已保存"
                    : "Saved"
                : isZh
                  ? "保存失败"
                  : "Save failed",
        });
        scheduleProviderActionMessageReset(source.provider);
    };

    const handleTestSource = async (source: DataSourceDisplayState) => {
        if (isDataSourcesBusy) {
            return;
        }

        if (source.runtimeStatus === "planned") {
            setProviderActionMessage(source.provider, {
                description: isZh
                    ? "该来源还在准备中，当前不能测试连接。"
                    : "This source is still being prepared and cannot be tested yet.",
                state: "test-error",
                title: isZh ? "暂不可测试" : "Test unavailable",
            });
            scheduleProviderActionMessageReset(source.provider);
            return;
        }

        const fields = getProviderFormFields(
            source,
            secretDrafts,
            language,
            "settings",
        ).filter((field) => !isAdvancedOptionalField(field));
        const missingFields = getMissingConnectionFields(source, fields);
        const hasMissingBaseUrl =
            !providerUsesCustomServerSelector(source.provider) &&
            !String(source.baseUrl ?? "").trim();

        if (missingFields.length > 0 || hasMissingBaseUrl) {
            setProviderActionMessage(source.provider, {
                description: isZh
                    ? "请先补齐登录信息，再保存或测试连接。"
                    : "Add the required sign-in details before saving or testing.",
                state: "test-error",
                title: isZh ? "信息不完整" : "Missing details",
            });
            scheduleProviderActionMessageReset(source.provider);
            return;
        }

        setProviderActionMessage(source.provider, {
            description: isZh
                ? "正在使用当前表单信息测试连接，不会保存配置。"
                : "Testing the current form details without saving them.",
            state: "testing",
            title: isZh ? "测试中" : "Testing",
        });

        const result = await testSourceSettings(source);
        setProviderActionMessage(source.provider, {
            description: result.ok
                ? isZh
                    ? "连接测试通过。测试不会保存当前连接信息。"
                    : "Connection test passed. Testing does not save these settings."
                : (result.message ??
                  (isZh
                      ? "连接测试失败，请检查登录信息后重试。"
                      : "Connection test failed. Check the sign-in details and try again.")),
            state: result.ok ? "test-success" : "test-error",
            title: result.ok
                ? isZh
                    ? "连接测试通过"
                    : "Connection test passed"
                : isZh
                  ? "连接测试失败"
                  : "Connection test failed",
        });
        scheduleProviderActionMessageReset(source.provider);
    };

    if (isLoading) {
        return <DataSourcesSectionSkeleton isZh={isZh} />;
    }

    const loadState = loadError ? "error" : "ready";

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
                                disabled={isDataSourcesBusy}
                                source={source}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );

    return (
        <div
            className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:h-full lg:p-5"
            data-ds-selected-provider={selectedSource?.provider ?? "none"}
            data-ds-load-state={loadState}
            data-settings-section="data-sources"
        >
            <div className="flex shrink-0 flex-col gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Database className="size-5" />
                    {isZh ? "数据源" : "Data Sources"}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {isZh
                        ? "连接录音来源，管理导入所需的登录信息和更新状态。"
                        : "Connect recording sources and manage the sign-in details and update state used for imports."}
                </p>
            </div>

            <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/75 bg-background/20 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside
                    className="flex min-h-[16rem] flex-col gap-3 border-border/70 border-b bg-muted/20 p-3 lg:min-h-0 lg:border-r lg:border-b-0"
                    data-settings-inner-scroll=""
                    data-ds-scroll=""
                >
                    <div className="flex shrink-0 items-center justify-between gap-3 px-1">
                        <div>
                            <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                                {isZh ? "来源" : "Sources"} ·{" "}
                                {orderedSources.length}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {isZh
                                    ? "选择来源进入详情。"
                                    : "Choose a source to edit details."}
                            </p>
                        </div>
                        <span className="rounded-lg border border-border/60 bg-background/35 px-2 py-1 text-xs font-medium text-muted-foreground">
                            {selectedSource
                                ? getSourceProviderLabel(
                                      selectedSource.provider,
                                      language,
                                  )
                                : isZh
                                  ? "未选择"
                                  : "No source"}
                        </span>
                    </div>

                    {loadError ? (
                        <div
                            className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-3 text-sm text-destructive"
                            data-testid="data-sources-load-error"
                        >
                            <div className="flex flex-col gap-2">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                    <span>{loadError}</span>
                                </div>
                                <Button
                                    className="self-start"
                                    onClick={() => void refreshSources()}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    <RotateCw className="size-4" />
                                    {isZh ? "重试" : "Retry"}
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    <div
                        className="min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1"
                        data-settings-inner-scroll=""
                        data-ds-provider-list-scroll=""
                    >
                        {orderedSources.map((source) => {
                            const message =
                                providerActionMessages[source.provider];
                            const actionState =
                                savingProvider === source.provider
                                    ? "saving"
                                    : (message?.state ?? "idle");

                            return (
                                <ProviderCard
                                    actionState={actionState}
                                    key={source.provider}
                                    isSelected={
                                        source.provider === selectedProvider
                                    }
                                    isZh={isZh}
                                    language={language}
                                    onSelect={() =>
                                        setSelectedProvider(source.provider)
                                    }
                                    disabled={isDataSourcesBusy}
                                    source={source}
                                />
                            );
                        })}
                    </div>
                </aside>

                <section
                    ref={providerDetailScrollRef}
                    className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5"
                    data-settings-inner-scroll=""
                    data-ds-scroll=""
                >
                    {selectedSource ? (
                        <ProviderDetail
                            actionMessage={
                                providerActionMessages[
                                    selectedSource.provider
                                ] ?? null
                            }
                            isZh={isZh}
                            language={language}
                            onSave={handleSaveSource}
                            onTest={handleTestSource}
                            savingProvider={savingProvider}
                            secretDrafts={secretDrafts}
                            source={selectedSource}
                            updateField={updateField}
                            updateSource={updateSource}
                        />
                    ) : (
                        renderProviderOverview()
                    )}
                </section>
            </div>
        </div>
    );
}
