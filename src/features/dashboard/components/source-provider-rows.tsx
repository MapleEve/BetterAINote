"use client";

import { CheckCircle2, CircleDashed, Loader2, RefreshCw } from "lucide-react";
import type { SourceProvider } from "@/lib/data-sources/catalog";
import type { UiLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface SourceProviderRowModel {
    provider: SourceProvider;
    label: string;
    count: number;
    active: boolean;
    connected: boolean;
    updating: boolean;
}

interface SourceProviderRowsProps {
    rows: SourceProviderRowModel[];
    activeProvider: SourceProvider | null;
    language: UiLanguage;
    onSelectProvider: (provider: SourceProvider) => void;
    onConnectProvider: (provider: SourceProvider) => void;
    onClearProvider: () => void;
}

const PROVIDER_MARKS: Record<SourceProvider, string> = {
    "dingtalk-a1": "钉",
    ticnote: "T",
    plaud: "P",
    "feishu-minutes": "飞",
    iflyrec: "讯",
};

function getStatusCopy(row: SourceProviderRowModel, language: UiLanguage) {
    const isZh = language === "zh-CN";

    if (row.updating) {
        return isZh ? "更新中" : "Updating";
    }

    if (row.connected) {
        return isZh ? "已连接" : "Connected";
    }

    return isZh ? "待连接" : "Connect";
}

export function SourceProviderRows({
    activeProvider,
    language,
    onClearProvider,
    onConnectProvider,
    onSelectProvider,
    rows,
}: SourceProviderRowsProps) {
    const isZh = language === "zh-CN";

    return (
        <div className="flex flex-col gap-2" data-testid="source-provider-rows">
            <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {isZh ? "来源" : "Sources"}
                </p>
                {activeProvider ? (
                    <button
                        type="button"
                        onClick={onClearProvider}
                        className="rounded-full border border-border/70 bg-background/40 px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                        {isZh ? "清除" : "Clear"}
                    </button>
                ) : null}
            </div>

            <div className="flex flex-col gap-1">
                {rows.map((row) => {
                    const statusCopy = getStatusCopy(row, language);
                    const shouldOpenSettings = !row.connected;

                    return (
                        <button
                            key={row.provider}
                            type="button"
                            data-provider={row.provider}
                            data-active={row.active ? "true" : "false"}
                            data-connected={row.connected ? "true" : "false"}
                            aria-pressed={row.active}
                            aria-label={`${row.label} · ${statusCopy}`}
                            onClick={() =>
                                shouldOpenSettings
                                    ? onConnectProvider(row.provider)
                                    : onSelectProvider(row.provider)
                            }
                            className={cn(
                                "group flex w-full items-center gap-2 rounded-[0.7rem] border border-transparent px-2.5 py-2 text-left text-sm transition-[background-color,border-color,color,box-shadow] duration-200",
                                "hover:border-border/70 hover:bg-background/45 focus-visible:ring-ring/40 focus-visible:ring-[3px] focus-visible:outline-none",
                                row.active
                                    ? "border-border/80 bg-background/70 text-foreground shadow-xs"
                                    : "text-muted-foreground",
                            )}
                        >
                            <span
                                className={cn(
                                    "flex size-7 shrink-0 items-center justify-center rounded-[0.55rem] border border-border/70 bg-background/60 text-[0.72rem] font-semibold text-foreground shadow-xs",
                                    row.active &&
                                        "border-primary/35 bg-primary/10 text-primary",
                                )}
                                aria-hidden="true"
                            >
                                {PROVIDER_MARKS[row.provider]}
                            </span>

                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                    {row.label}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1.5 text-[0.68rem] text-muted-foreground">
                                    {row.updating ? (
                                        <Loader2 className="size-3 animate-spin text-primary" />
                                    ) : row.connected ? (
                                        <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-300" />
                                    ) : (
                                        <CircleDashed className="size-3" />
                                    )}
                                    {statusCopy}
                                </span>
                            </span>

                            <span
                                className={cn(
                                    "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background/50 px-2 text-[0.68rem] font-semibold text-muted-foreground",
                                    row.active &&
                                        "border-primary/30 bg-primary/10 text-primary",
                                    !row.connected &&
                                        "border-border/60 bg-transparent",
                                )}
                            >
                                {row.updating ? (
                                    <RefreshCw className="size-3 animate-spin" />
                                ) : row.connected ? (
                                    row.count
                                ) : isZh ? (
                                    "连接"
                                ) : (
                                    "Connect"
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
