"use client";

import {
    AlertCircle,
    Bell,
    CheckCircle2,
    Clock,
    FileText,
    RefreshCw,
    X,
} from "lucide-react";
import type {
    KeyboardEvent as ReactKeyboardEvent,
    MouseEvent as ReactMouseEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatRelativeDistance } from "@/lib/format-date";
import { isActiveTranscriptionJob } from "@/lib/transcription/job-display";
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";

type ActivityTone = "loading" | "error" | "warn" | "success" | "info";
type ActivityAction = "sync" | "recording";
type ActivityActionState = "idle" | "busy" | "done" | "failed";

const STATUS_SYNC_ACTION_ID = "source-status-sync";
const ACTION_DONE_VISIBLE_MS = 1600;
const ACTION_FALLBACK_DONE_MS = 1800;
const ACTIVITY_ID_DELIMITER = "\u001f";

type ActivitySyncResult = {
    success: boolean;
    queued?: boolean;
    newRecordings?: number;
    error?: string;
} | null;

type ActivityWorkerStatus = {
    healthy: boolean;
    isRunning: boolean;
    lastHeartbeatAt: Date | null;
    lastStartedAt: Date | null;
    lastFinishedAt: Date | null;
    nextRunAt: Date | null;
    manualTriggerRequestedAt: Date | null;
    lastError: string | null;
    lastSummary: {
        newRecordings: number;
        updatedRecordings: number;
        removedRecordings: number;
        errorCount: number;
    } | null;
} | null;

type ActivityTranscriptionJob = {
    status: string;
    remoteStatus?: string | null;
    lastError?: string | null;
};

type ActivityItem = {
    id: string;
    tone: ActivityTone;
    title: string;
    body: string;
    meta?: string | null;
    action?: ActivityAction;
    actionLabel?: string;
    recordingId?: string;
    actionable: boolean;
};

interface ActivityOverlayProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    autoSyncEnabled: boolean;
    isAutoSyncing: boolean;
    lastSyncTime: Date | null;
    nextSyncTime: Date | null;
    lastSyncResult: ActivitySyncResult;
    workerStatus: ActivityWorkerStatus;
    recordings: Pick<Recording, "id" | "filename">[];
    transcriptionJobs: Map<string, ActivityTranscriptionJob>;
    onSyncNow: () => Promise<void> | void;
    onOpenRecording: (recordingId: string) => void;
}

function formatAgo(date: Date | null) {
    if (!date) {
        return null;
    }

    try {
        return `${formatRelativeDistance(date, "zh-CN")}前`;
    } catch {
        return null;
    }
}

function formatFuture(date: Date | null) {
    if (!date) {
        return null;
    }

    try {
        return `${formatRelativeDistance(date, "zh-CN")}后`;
    } catch {
        return null;
    }
}

function getRemoteStatusText(job: ActivityTranscriptionJob) {
    switch (job.remoteStatus) {
        case "queued":
            return "远端队列中";
        case "converting":
            return "正在转换音频";
        case "denoising":
            return "正在降噪";
        case "transcribing":
            return "正在转写音频";
        case "identifying":
            return "正在识别说话人";
        default:
            return job.status === "pending" ? "本地队列中" : "正在处理";
    }
}

function getStatusCopy({
    autoSyncEnabled,
    isAutoSyncing,
    lastSyncTime,
    nextSyncTime,
    lastSyncResult,
    workerStatus,
}: {
    autoSyncEnabled: boolean;
    isAutoSyncing: boolean;
    lastSyncTime: Date | null;
    nextSyncTime: Date | null;
    lastSyncResult: ActivitySyncResult;
    workerStatus: ActivityWorkerStatus;
}) {
    if (isAutoSyncing || workerStatus?.isRunning) {
        return {
            state: "loading" as const,
            line: "正在更新来源",
            sub: "正在检查已连接来源的新录音",
        };
    }

    if (lastSyncResult?.success === false) {
        return {
            state: "error" as const,
            line: "上次更新失败",
            sub: lastSyncResult.error ?? "稍后可重新尝试更新。",
        };
    }

    if (workerStatus && !workerStatus.healthy) {
        return {
            state: "error" as const,
            line: "自动更新暂时不可用",
            sub: workerStatus.lastError ?? "本地更新服务未响应。",
        };
    }

    if (!autoSyncEnabled) {
        return {
            state: "idle" as const,
            line: "自动更新已暂停",
            sub: "你仍可以手动检查新录音。",
        };
    }

    const lastText = formatAgo(lastSyncTime);
    const nextText = formatFuture(nextSyncTime);

    return {
        state: "idle" as const,
        line: lastText ? `上次更新于 ${lastText}` : "等待自动更新",
        sub: nextText ? `下次约 ${nextText}` : "来源更新会按计划继续运行。",
    };
}

function ActivityIcon({ tone }: { tone: ActivityTone }) {
    if (tone === "loading") {
        return <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    }
    if (tone === "error" || tone === "warn") {
        return <AlertCircle className="h-3.5 w-3.5" />;
    }
    if (tone === "success") {
        return <CheckCircle2 className="h-3.5 w-3.5" />;
    }
    return <Clock className="h-3.5 w-3.5" />;
}

function getActionLabel(item: ActivityItem, state: ActivityActionState) {
    if (item.action === "recording") {
        return item.actionLabel ?? "查看";
    }

    if (state === "busy") {
        return "正在更新...";
    }
    if (state === "done") {
        return "已加入更新";
    }
    if (state === "failed") {
        return "重试更新";
    }

    return item.actionLabel ?? "重试更新";
}

function isNestedInteractiveTarget(
    target: EventTarget | null,
    currentTarget: HTMLElement,
) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    const nestedInteractive = target.closest("button,a,input,select,textarea");

    return (
        nestedInteractive !== null && currentTarget.contains(nestedInteractive)
    );
}

export function ActivityOverlay({
    open,
    onOpenChange,
    autoSyncEnabled,
    isAutoSyncing,
    lastSyncTime,
    nextSyncTime,
    lastSyncResult,
    workerStatus,
    recordings,
    transcriptionJobs,
    onSyncNow,
    onOpenRecording,
}: ActivityOverlayProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const syncBaselineRef = useRef<Record<string, ActivitySyncResult>>({});
    const actionTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(
        new Set(),
    );
    const [dismissedItemIds, setDismissedItemIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [actionStates, setActionStates] = useState<
        Record<string, ActivityActionState>
    >({});
    const [isInteractive, setIsInteractive] = useState(false);

    useEffect(() => {
        setIsInteractive(true);
    }, []);

    const closeAndReturnFocus = useCallback(
        (options: { returnFocus?: boolean } = {}) => {
            onOpenChange(false);
            if (options.returnFocus === false) {
                return;
            }
            window.setTimeout(() => {
                triggerRef.current?.focus({ preventScroll: true });
            }, 0);
        },
        [onOpenChange],
    );

    const clearActionState = useCallback((actionId: string) => {
        setActionStates((previous) => {
            if (!(actionId in previous)) {
                return previous;
            }

            const next = { ...previous };
            delete next[actionId];
            return next;
        });
    }, []);

    const scheduleTimer = useCallback((callback: () => void, delay: number) => {
        const timer = setTimeout(() => {
            actionTimersRef.current.delete(timer);
            callback();
        }, delay);
        actionTimersRef.current.add(timer);
    }, []);

    const resolveSyncAction = useCallback(
        (actionId: string, nextState: Exclude<ActivityActionState, "idle">) => {
            setActionStates((previous) => {
                if (previous[actionId] !== "busy") {
                    return previous;
                }

                return {
                    ...previous,
                    [actionId]: nextState,
                };
            });

            if (nextState !== "done") {
                return;
            }

            scheduleTimer(() => {
                if (actionId !== STATUS_SYNC_ACTION_ID) {
                    setDismissedItemIds((previous) => {
                        const next = new Set(previous);
                        next.add(actionId);
                        return next;
                    });
                }
                clearActionState(actionId);
            }, ACTION_DONE_VISIBLE_MS);
        },
        [clearActionState, scheduleTimer],
    );

    useEffect(() => {
        if (!open) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) {
                return;
            }
            if (!rootRef.current?.contains(target)) {
                closeAndReturnFocus({ returnFocus: false });
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeAndReturnFocus();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [closeAndReturnFocus, open]);

    useEffect(
        () => () => {
            for (const timer of actionTimersRef.current) {
                clearTimeout(timer);
            }
            actionTimersRef.current.clear();
        },
        [],
    );

    const recordingNames = useMemo(
        () =>
            new Map(
                recordings.map((recording) => [
                    recording.id,
                    recording.filename,
                ]),
            ),
        [recordings],
    );

    const activityItems = useMemo<ActivityItem[]>(() => {
        const items: ActivityItem[] = [];

        if (isAutoSyncing || workerStatus?.isRunning) {
            items.push({
                id: "source-update-running",
                tone: "loading",
                title: "正在更新来源",
                body: "正在检查已连接来源的新录音。",
                action: "sync",
                actionLabel: "查看进度",
                actionable: true,
            });
        } else if (workerStatus?.manualTriggerRequestedAt) {
            items.push({
                id: "source-update-queued",
                tone: "loading",
                title: "更新请求已加入队列",
                body: "本地服务会尽快开始检查来源。",
                meta: formatAgo(workerStatus.manualTriggerRequestedAt),
                actionable: true,
            });
        }

        if (lastSyncResult?.success === false) {
            items.push({
                id: "source-update-error",
                tone: "error",
                title: "来源更新失败",
                body: lastSyncResult.error ?? "可以稍后重新尝试。",
                action: "sync",
                actionLabel: "重试更新",
                actionable: true,
            });
        } else if (workerStatus && !workerStatus.healthy) {
            items.push({
                id: "worker-unavailable",
                tone: "error",
                title: "自动更新暂时不可用",
                body: workerStatus.lastError ?? "本地更新服务未响应。",
                meta: formatAgo(workerStatus.lastHeartbeatAt),
                action: "sync",
                actionLabel: "重新检查",
                actionable: true,
            });
        }

        if (
            lastSyncResult?.success &&
            (lastSyncResult.newRecordings ?? 0) > 0
        ) {
            items.push({
                id: "source-update-success",
                tone: "success",
                title: "来源更新完成",
                body: `已导入 ${lastSyncResult.newRecordings ?? 0} 条新录音。`,
                actionable: false,
            });
        } else if (
            workerStatus?.lastSummary &&
            (workerStatus.lastSummary.newRecordings > 0 ||
                workerStatus.lastSummary.updatedRecordings > 0 ||
                workerStatus.lastSummary.removedRecordings > 0)
        ) {
            const summary = workerStatus.lastSummary;
            items.push({
                id: "source-update-summary",
                tone: summary.errorCount > 0 ? "warn" : "success",
                title: "最近一次更新完成",
                body: `新增 ${summary.newRecordings}，更新 ${summary.updatedRecordings}，移除 ${summary.removedRecordings}。`,
                meta: formatAgo(workerStatus.lastFinishedAt),
                action: summary.errorCount > 0 ? "sync" : undefined,
                actionLabel: summary.errorCount > 0 ? "重新检查" : undefined,
                actionable: summary.errorCount > 0,
            });
        }

        for (const [recordingId, job] of transcriptionJobs) {
            const recordingName =
                recordingNames.get(recordingId) ?? "未命名录音";

            if (isActiveTranscriptionJob(job)) {
                items.push({
                    id: `transcription-active-${recordingId}`,
                    tone: "loading",
                    title: recordingName,
                    body: `转写${getRemoteStatusText(job)}。`,
                    action: "recording",
                    actionLabel: "查看",
                    recordingId,
                    actionable: true,
                });
                continue;
            }

            if (job.status === "failed") {
                items.push({
                    id: `transcription-failed-${recordingId}`,
                    tone: "warn",
                    title: `${recordingName} · 转写失败`,
                    body: job.lastError ?? "可重新加入转写队列。",
                    action: "recording",
                    actionLabel: "查看",
                    recordingId,
                    actionable: true,
                });
            }
        }

        return items;
    }, [
        isAutoSyncing,
        lastSyncResult,
        recordingNames,
        transcriptionJobs,
        workerStatus,
    ]);

    const activeItemIdsKey = useMemo(
        () =>
            [...activityItems.map((item) => item.id), STATUS_SYNC_ACTION_ID]
                .sort()
                .join(ACTIVITY_ID_DELIMITER),
        [activityItems],
    );

    useEffect(() => {
        const activeIds = new Set(
            activeItemIdsKey
                .split(ACTIVITY_ID_DELIMITER)
                .filter((itemId) => itemId.length > 0),
        );

        setDismissedItemIds((previous) => {
            const next = new Set(
                [...previous].filter((itemId) => activeIds.has(itemId)),
            );
            return next.size === previous.size ? previous : next;
        });

        setActionStates((previous) => {
            const next = Object.fromEntries(
                Object.entries(previous).filter(([itemId]) =>
                    activeIds.has(itemId),
                ),
            ) as Record<string, ActivityActionState>;
            const nextKeys = Object.keys(next);

            return nextKeys.length === Object.keys(previous).length &&
                nextKeys.every((itemId) => itemId in previous)
                ? previous
                : next;
        });
    }, [activeItemIdsKey]);

    const statusCopy = getStatusCopy({
        autoSyncEnabled,
        isAutoSyncing,
        lastSyncTime,
        lastSyncResult,
        nextSyncTime,
        workerStatus,
    });

    const statusActionState = actionStates[STATUS_SYNC_ACTION_ID] ?? "idle";
    const displayedStatusCopy = useMemo(() => {
        if (statusActionState === "busy") {
            return {
                state: "loading" as const,
                line: "正在更新来源",
                sub: "正在检查已连接来源的新录音",
            };
        }
        if (statusActionState === "done") {
            return {
                state: "idle" as const,
                line: "已加入更新",
                sub: "来源更新会在后台继续。",
            };
        }
        if (statusActionState === "failed") {
            return {
                state: "error" as const,
                line: "更新请求失败",
                sub: "请稍后重试。",
            };
        }

        return statusCopy;
    }, [statusActionState, statusCopy]);

    const visibleActivityItems = useMemo(
        () => activityItems.filter((item) => !dismissedItemIds.has(item.id)),
        [activityItems, dismissedItemIds],
    );

    const actionableCount = visibleActivityItems.filter(
        (item) =>
            item.actionable && (actionStates[item.id] ?? "idle") !== "done",
    ).length;
    const hasLoading =
        statusActionState === "busy" ||
        visibleActivityItems.some(
            (item) =>
                item.tone === "loading" ||
                (actionStates[item.id] ?? "idle") === "busy",
        );
    const hasError = activityItems.some(
        (item) =>
            !dismissedItemIds.has(item.id) &&
            (item.tone === "error" ||
                item.tone === "warn" ||
                (actionStates[item.id] ?? "idle") === "failed"),
    );
    const panelState = hasLoading
        ? "loading"
        : hasError
          ? "error"
          : visibleActivityItems.length > 0
            ? "list"
            : "empty";

    const runSyncAction = useCallback(
        async (actionId: string) => {
            syncBaselineRef.current[actionId] = lastSyncResult;
            setActionStates((previous) => ({
                ...previous,
                [actionId]: "busy",
            }));

            try {
                await onSyncNow();
                scheduleTimer(() => {
                    resolveSyncAction(actionId, "done");
                }, ACTION_FALLBACK_DONE_MS);
            } catch {
                resolveSyncAction(actionId, "failed");
            }
        },
        [lastSyncResult, onSyncNow, resolveSyncAction, scheduleTimer],
    );

    useEffect(() => {
        if (isAutoSyncing) {
            return;
        }

        for (const [actionId, actionState] of Object.entries(actionStates)) {
            if (
                actionState !== "busy" ||
                syncBaselineRef.current[actionId] === lastSyncResult
            ) {
                continue;
            }

            resolveSyncAction(
                actionId,
                lastSyncResult?.success === false ? "failed" : "done",
            );
        }
    }, [actionStates, isAutoSyncing, lastSyncResult, resolveSyncAction]);

    const handleAction = useCallback(
        (item: ActivityItem) => {
            if (item.action === "sync") {
                void runSyncAction(item.id);
                return;
            }

            if (item.action === "recording" && item.recordingId) {
                onOpenRecording(item.recordingId);
                closeAndReturnFocus();
            }
        },
        [closeAndReturnFocus, onOpenRecording, runSyncAction],
    );

    const handleRecordingItemClick = useCallback(
        (item: ActivityItem, event: ReactMouseEvent<HTMLLIElement>) => {
            if (
                item.action !== "recording" ||
                isNestedInteractiveTarget(event.target, event.currentTarget)
            ) {
                return;
            }

            handleAction(item);
        },
        [handleAction],
    );

    const handleRecordingItemKeyDown = useCallback(
        (item: ActivityItem, event: ReactKeyboardEvent<HTMLLIElement>) => {
            if (
                item.action !== "recording" ||
                event.currentTarget !== event.target ||
                (event.key !== "Enter" && event.key !== " ")
            ) {
                return;
            }

            event.preventDefault();
            handleAction(item);
        },
        [handleAction],
    );

    const dismissItem = useCallback((itemId: string) => {
        setDismissedItemIds((previous) => {
            const next = new Set(previous);
            next.add(itemId);
            return next;
        });
    }, []);

    const handleStatusSync = () => {
        void runSyncAction(STATUS_SYNC_ACTION_ID);
    };

    const statusButtonLabel =
        statusActionState === "busy"
            ? "更新中"
            : statusActionState === "done"
              ? "已完成"
              : statusActionState === "failed"
                ? "重试"
                : "更新";

    const renderActivityItem = (item: ActivityItem) => {
        const actionState = actionStates[item.id] ?? "idle";
        const actionIsBusy = actionState === "busy";
        const actionIsDone = actionState === "done";
        const isRecordingAction = item.action === "recording";

        return (
            <li
                key={item.id}
                aria-label={
                    isRecordingAction
                        ? `${item.title}，${item.actionLabel ?? "查看"}`
                        : undefined
                }
                data-action-state={actionState}
                data-activity-id={item.id}
                data-activity-action={item.action ?? "none"}
                data-clickable={isRecordingAction ? "true" : "false"}
                data-tone={item.tone}
                data-testid={
                    item.tone === "loading"
                        ? "dashboard-activity-loading"
                        : item.tone === "error" || item.tone === "warn"
                          ? "dashboard-activity-error"
                          : "dashboard-activity-item"
                }
                role={isRecordingAction ? "button" : undefined}
                tabIndex={isRecordingAction ? 0 : undefined}
                className={cn(
                    "grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-2 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-muted/50",
                    isRecordingAction &&
                        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                onClick={(event) => handleRecordingItemClick(item, event)}
                onKeyDown={(event) => handleRecordingItemKeyDown(item, event)}
            >
                <span
                    className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-lg border",
                        item.tone === "loading" &&
                            "border-primary/25 bg-primary/10 text-primary",
                        item.tone === "error" &&
                            "border-destructive/25 bg-destructive/10 text-destructive",
                        item.tone === "warn" &&
                            "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        item.tone === "success" &&
                            "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
                        item.tone === "info" &&
                            "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
                    )}
                >
                    <ActivityIcon tone={item.tone} />
                </span>
                <div className="min-w-0">
                    <p className="truncate font-medium text-sm">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-muted-foreground text-xs leading-5">
                        {item.body}
                    </p>
                    {item.meta ? (
                        <p className="mt-1 text-muted-foreground text-[0.68rem]">
                            {item.meta}
                        </p>
                    ) : null}
                </div>
                <div className="flex items-start gap-1">
                    {item.action ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-busy={actionIsBusy}
                            data-action-state={actionState}
                            data-activity-action-button=""
                            data-testid="dashboard-activity-action"
                            disabled={actionIsBusy || actionIsDone}
                            className="h-7 rounded-lg px-2 text-xs"
                            onClick={(event) => {
                                event.stopPropagation();
                                handleAction(item);
                            }}
                        >
                            {item.action === "recording" ? (
                                <FileText className="mr-1 h-3 w-3" />
                            ) : null}
                            {getActionLabel(item, actionState)}
                        </Button>
                    ) : null}
                    <button
                        type="button"
                        aria-label={`忽略 ${item.title}`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        data-activity-dismiss=""
                        data-testid="dashboard-activity-dismiss"
                        onClick={(event) => {
                            event.stopPropagation();
                            dismissItem(item.id);
                        }}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </li>
        );
    };

    return (
        <div
            ref={rootRef}
            className="relative shrink-0"
            data-testid="dashboard-activity-overlay"
        >
            <Button
                ref={triggerRef}
                type="button"
                variant="outline"
                size="icon"
                aria-controls="dashboard-activity-panel"
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={
                    actionableCount > 0
                        ? `打开最近动态，${actionableCount} 项待处理`
                        : "打开最近动态"
                }
                className="relative h-9 w-9 rounded-xl border-border/70 bg-background/45"
                data-testid="dashboard-activity-trigger"
                disabled={!isInteractive}
                onClick={() => {
                    if (open) {
                        closeAndReturnFocus();
                        return;
                    }
                    onOpenChange(true);
                }}
            >
                <Bell className="h-4 w-4" />
                {actionableCount > 0 ? (
                    <span
                        className="-top-1 -right-1 absolute inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-semibold text-[0.625rem] text-destructive-foreground leading-none shadow-sm"
                        aria-hidden="true"
                    >
                        {actionableCount > 9 ? "9+" : actionableCount}
                    </span>
                ) : null}
            </Button>

            {open ? (
                <section
                    id="dashboard-activity-panel"
                    role="dialog"
                    aria-label="最近动态"
                    data-state={panelState}
                    data-testid="dashboard-activity-panel"
                    className="absolute top-11 right-0 z-[220] flex max-h-[min(calc(100svh-6rem),32.5rem)] w-[min(calc(100vw-1.5rem),24rem)] flex-col overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-2xl"
                >
                    <header className="flex items-center gap-3 border-border/70 border-b px-3.5 py-3">
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate font-semibold text-sm">
                                最近动态
                            </h2>
                            <p className="truncate text-muted-foreground text-xs">
                                {actionableCount > 0
                                    ? `${actionableCount} 项待处理`
                                    : visibleActivityItems.length > 0
                                      ? `最近有 ${visibleActivityItems.length} 项动态`
                                      : "全部已处理"}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="关闭最近动态"
                            onClick={() => closeAndReturnFocus()}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </header>

                    <div
                        className="flex items-center gap-2 border-border/70 border-b bg-muted/35 px-3.5 py-2.5"
                        data-action-state={statusActionState}
                        data-state={displayedStatusCopy.state}
                        data-testid="dashboard-activity-status"
                    >
                        <span
                            className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                displayedStatusCopy.state === "loading"
                                    ? "animate-pulse bg-primary"
                                    : displayedStatusCopy.state === "error"
                                      ? "bg-destructive"
                                      : "bg-emerald-500",
                            )}
                            aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-xs">
                                {displayedStatusCopy.line}
                            </p>
                            <p className="truncate text-muted-foreground text-[0.68rem]">
                                {displayedStatusCopy.sub}
                            </p>
                        </div>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-busy={statusActionState === "busy"}
                            data-action-state={statusActionState}
                            data-testid="dashboard-activity-sync-action"
                            disabled={statusActionState === "busy"}
                            className="h-7 shrink-0 rounded-lg px-2 text-xs"
                            onClick={handleStatusSync}
                        >
                            {statusButtonLabel}
                        </Button>
                    </div>

                    {panelState === "empty" ? (
                        <div
                            className="flex flex-col items-center justify-center px-5 py-10 text-center"
                            data-testid="dashboard-activity-empty"
                        >
                            <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-500" />
                            <p className="font-medium text-sm">没有新的动态</p>
                            <p className="mt-1 text-muted-foreground text-xs">
                                全部已处理，来源更新与转写任务都在正常运行。
                            </p>
                        </div>
                    ) : (
                        <ul
                            className="min-h-0 flex-1 overflow-y-auto p-1.5"
                            data-testid="dashboard-activity-list"
                        >
                            {visibleActivityItems.map(renderActivityItem)}
                        </ul>
                    )}
                </section>
            ) : null}
        </div>
    );
}
