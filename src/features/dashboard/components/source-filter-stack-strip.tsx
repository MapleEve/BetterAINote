"use client";

import {
    AlertCircle,
    Cloud,
    Database,
    type LucideIcon,
    MessageSquare,
    Mic2,
    Radio,
    RefreshCw,
    Search,
    Settings,
    SlidersHorizontal,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate, type UiLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
    SourceProviderRowModel,
    SourceProviderRowStatus,
} from "./source-provider-rows";

interface SourceFilterStackStripProps {
    activeFavoriteLabel: string;
    filteredCount: number;
    language: UiLanguage;
    sourceRow: SourceProviderRowModel | null;
    sourceTotalCount: number;
    totalCount: number;
    onClearAll: () => void;
    onClearSource: () => void;
    onOpenDataSourcesSettings: () => void;
    onRetrySync: () => void;
    onWidenFilters: () => void;
}

const PROVIDER_ICONS: Record<SourceProviderRowModel["provider"], LucideIcon> = {
    "dingtalk-a1": Radio,
    ticnote: Mic2,
    plaud: Cloud,
    "feishu-minutes": MessageSquare,
    iflyrec: Database,
};
const PROVIDER_ASSET_CLASSES: Partial<
    Record<SourceProviderRowModel["provider"], string>
> = {
    "dingtalk-a1": "bg-[url('/assets/sources/dingtalk.svg')]",
    ticnote: "bg-[url('/assets/sources/ticnote.png')]",
    plaud: "bg-[url('/assets/sources/plaud.png')]",
    "feishu-minutes": "bg-[url('/assets/sources/feishu.jpeg')]",
};

function getStripState(
    status: SourceProviderRowStatus,
    filteredCount: number,
    sourceTotalCount: number,
) {
    if (status === "sync-error") {
        return "sync-error";
    }

    if (
        status === "needs-setup" ||
        status === "paused" ||
        status === "expired" ||
        status === "planned"
    ) {
        return "needs-setup";
    }

    if (sourceTotalCount > 0 && filteredCount === 0) {
        return "no-results";
    }

    return "active";
}

export function SourceFilterStackStrip({
    activeFavoriteLabel,
    filteredCount,
    language,
    onClearAll,
    onClearSource,
    onOpenDataSourcesSettings,
    onRetrySync,
    onWidenFilters,
    sourceRow,
    sourceTotalCount,
    totalCount,
}: SourceFilterStackStripProps) {
    if (!sourceRow) {
        return null;
    }

    const t = (key: string, replacements?: Record<string, string | number>) =>
        translate(language, key, replacements);
    const state = getStripState(
        sourceRow.status,
        filteredCount,
        sourceTotalCount,
    );
    const visibleDenominator =
        activeFavoriteLabel === t("dashboardFavorites.allRecordings")
            ? totalCount
            : Math.max(sourceTotalCount, filteredCount);
    const ProviderIcon = PROVIDER_ICONS[sourceRow.provider];
    const providerAssetClass = PROVIDER_ASSET_CLASSES[sourceRow.provider];

    return (
        <div
            aria-live="polite"
            data-state={state}
            data-source-status={sourceRow.status}
            data-testid="dashboard-source-filter-stack"
            className="flex flex-wrap items-center gap-2 border-border/70 border-b bg-background/28 px-3 py-2 text-[0.72rem] text-muted-foreground"
        >
            <span className="inline-flex min-w-0 items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 shrink-0" />
                <span>{t("sourceFilterStack.filter")}</span>
                <span className="truncate font-semibold text-foreground">
                    {activeFavoriteLabel}
                </span>
            </span>
            <span className="text-muted-foreground/55" aria-hidden="true">
                /
            </span>
            <span
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-muted/35 px-2 py-1 font-medium text-foreground shadow-xs"
                data-testid="dashboard-source-filter-provider-chip"
            >
                <span
                    className={cn(
                        "inline-flex size-5 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-[0.66rem] font-semibold",
                        sourceRow.active && "border-primary/30 text-primary",
                    )}
                    aria-hidden="true"
                >
                    {providerAssetClass ? (
                        <span
                            className={cn(
                                "size-3.5 rounded-[0.25rem] bg-cover bg-center",
                                providerAssetClass,
                            )}
                        />
                    ) : (
                        <ProviderIcon className="size-3" />
                    )}
                </span>
                <span className="truncate">{sourceRow.label}</span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onClearSource}
                    aria-label={t("sourceFilterStack.clearSourceFilter")}
                    className="size-5 rounded-full"
                >
                    <X className="size-3" />
                </Button>
            </span>
            <span className="font-mono text-[0.68rem]">
                {t("sourceFilterStack.showing")}{" "}
                <b className="text-foreground">{filteredCount}</b> /{" "}
                {visibleDenominator}
            </span>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="ml-auto h-7 rounded-lg px-2 text-[0.72rem]"
            >
                {t("sourceFilterStack.clearAll")}
            </Button>

            {state === "sync-error" ? (
                <div className="basis-full rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-200">
                    <div className="flex flex-wrap items-center gap-2">
                        <AlertCircle className="size-3.5 shrink-0" />
                        <span className="min-w-0 flex-1">
                            {t("sourceFilterStack.syncErrorMessage", {
                                provider: sourceRow.label,
                            })}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            data-testid="dashboard-source-filter-retry-sync"
                            onClick={onRetrySync}
                            className="h-7 rounded-md border-amber-500/25 bg-muted/35 px-2 text-[0.72rem] hover:bg-muted/45"
                        >
                            <RefreshCw className="size-3" />
                            {t("sourceFilterStack.retrySync")}
                        </Button>
                    </div>
                </div>
            ) : null}

            {state === "no-results" ? (
                <div className="basis-full rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-sky-700 dark:text-sky-200">
                    <div className="flex flex-wrap items-center gap-2">
                        <Search className="size-3.5 shrink-0" />
                        <span className="min-w-0 flex-1">
                            {t("sourceFilterStack.noResultsMessage", {
                                provider: sourceRow.label,
                                count: sourceTotalCount,
                            })}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            data-testid="dashboard-source-filter-widen"
                            onClick={onWidenFilters}
                            className="h-7 rounded-md border-sky-500/25 bg-muted/35 px-2 text-[0.72rem] hover:bg-muted/45"
                        >
                            {t("sourceFilterStack.widenFilter")}
                        </Button>
                    </div>
                </div>
            ) : null}

            {state === "needs-setup" ? (
                <div className="basis-full rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-primary">
                    <div className="flex flex-wrap items-center gap-2">
                        <Settings className="size-3.5 shrink-0" />
                        <span className="min-w-0 flex-1">
                            {sourceRow.status === "paused"
                                ? t("sourceFilterStack.pausedMessage", {
                                      provider: sourceRow.label,
                                  })
                                : sourceRow.status === "expired"
                                  ? t("sourceFilterStack.expiredMessage", {
                                        provider: sourceRow.label,
                                    })
                                  : sourceRow.status === "planned"
                                    ? t("sourceFilterStack.plannedMessage", {
                                          provider: sourceRow.label,
                                      })
                                    : t("sourceFilterStack.needsSetupMessage", {
                                          provider: sourceRow.label,
                                      })}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            data-testid="dashboard-source-filter-open-settings"
                            onClick={() => onOpenDataSourcesSettings()}
                            className="h-7 rounded-md border-primary/25 bg-muted/35 px-2 text-[0.72rem] hover:bg-muted/45"
                        >
                            {t("sourceFilterStack.openSettings")}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
