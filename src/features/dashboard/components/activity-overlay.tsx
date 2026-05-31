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
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format-date";
import type { UiLanguage } from "@/lib/i18n";
import { isActiveTranscriptionJob } from "@/lib/transcription/job-display";
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";

type ActivityTone = "loading" | "error" | "warn" | "success" | "info";
type ActivityAction = "sync" | "recording";
type ActivityActionState = "idle" | "busy" | "done" | "failed";
type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

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

function formatRelative(date: Date | null, language: UiLanguage) {
    if (!date) {
        return null;
    }

    try {
        return formatDateTime(date, "relative", language);
    } catch {
        return null;
    }
}

function getRemoteStatusText(job: ActivityTranscriptionJob, t: Translate) {
    switch (job.remoteStatus) {
        case "queued":
            return t("activityOverlay.remoteStatus.queued");
        case "converting":
            return t("activityOverlay.remoteStatus.converting");
        case "denoising":
            return t("activityOverlay.remoteStatus.denoising");
        case "transcribing":
            return t("activityOverlay.remoteStatus.transcribing");
        case "identifying":
            return t("activityOverlay.remoteStatus.identifying");
        default:
            return job.status === "pending"
                ? t("activityOverlay.remoteStatus.pending")
                : t("activityOverlay.remoteStatus.processing");
    }
}

function getStatusCopy({
    autoSyncEnabled,
    isAutoSyncing,
    lastSyncTime,
    nextSyncTime,
    lastSyncResult,
    workerStatus,
    language,
    t,
}: {
    autoSyncEnabled: boolean;
    isAutoSyncing: boolean;
    lastSyncTime: Date | null;
    nextSyncTime: Date | null;
    lastSyncResult: ActivitySyncResult;
    workerStatus: ActivityWorkerStatus;
    language: UiLanguage;
    t: Translate;
}) {
    if (isAutoSyncing || workerStatus?.isRunning) {
        return {
            state: "loading" as const,
            line: t("activityOverlay.status.updatingSources"),
            sub: t("activityOverlay.status.checkingSources"),
        };
    }

    if (lastSyncResult?.success === false) {
        return {
            state: "error" as const,
            line: t("activityOverlay.status.lastUpdateFailed"),
            sub: lastSyncResult.error ?? t("activityOverlay.status.retryLater"),
        };
    }

    if (workerStatus && !workerStatus.healthy) {
        return {
            state: "error" as const,
            line: t("activityOverlay.status.autoUpdateUnavailable"),
            sub:
                workerStatus.lastError ??
                t("activityOverlay.status.workerNotResponding"),
        };
    }

    if (!autoSyncEnabled) {
        return {
            state: "idle" as const,
            line: t("activityOverlay.status.autoUpdatePaused"),
            sub: t("activityOverlay.status.manualCheckAvailable"),
        };
    }

    const lastText = formatRelative(lastSyncTime, language);
    const nextText = formatRelative(nextSyncTime, language);

    return {
        state: "idle" as const,
        line: lastText
            ? t("activityOverlay.status.lastUpdatedAt", { time: lastText })
            : t("activityOverlay.status.waitingForAutoUpdate"),
        sub: nextText
            ? t("activityOverlay.status.nextUpdateAt", { time: nextText })
            : t("activityOverlay.status.sourceUpdatesScheduled"),
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

function getActionLabel(
    item: ActivityItem,
    state: ActivityActionState,
    t: Translate,
) {
    if (item.action === "recording") {
        return item.actionLabel ?? t("activityOverlay.actions.view");
    }

    if (state === "busy") {
        return t("activityOverlay.actions.updating");
    }
    if (state === "done") {
        return t("activityOverlay.actions.queued");
    }
    if (state === "failed") {
        return t("activityOverlay.actions.retryUpdate");
    }

    return item.actionLabel ?? t("activityOverlay.actions.retryUpdate");
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
    const { language, t } = useLanguage();
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
                title: t("activityOverlay.items.sourceUpdatingTitle"),
                body: t("activityOverlay.items.sourceUpdatingBody"),
                action: "sync",
                actionLabel: t("activityOverlay.actions.viewProgress"),
                actionable: true,
            });
        } else if (workerStatus?.manualTriggerRequestedAt) {
            items.push({
                id: "source-update-queued",
                tone: "loading",
                title: t("activityOverlay.items.updateQueuedTitle"),
                body: t("activityOverlay.items.updateQueuedBody"),
                meta: formatRelative(
                    workerStatus.manualTriggerRequestedAt,
                    language,
                ),
                actionable: true,
            });
        }

        if (lastSyncResult?.success === false) {
            items.push({
                id: "source-update-error",
                tone: "error",
                title: t("activityOverlay.items.sourceUpdateFailedTitle"),
                body:
                    lastSyncResult.error ??
                    t("activityOverlay.items.sourceUpdateFailedBody"),
                action: "sync",
                actionLabel: t("activityOverlay.actions.retryUpdate"),
                actionable: true,
            });
        } else if (workerStatus && !workerStatus.healthy) {
            items.push({
                id: "worker-unavailable",
                tone: "error",
                title: t("activityOverlay.status.autoUpdateUnavailable"),
                body:
                    workerStatus.lastError ??
                    t("activityOverlay.status.workerNotResponding"),
                meta: formatRelative(workerStatus.lastHeartbeatAt, language),
                action: "sync",
                actionLabel: t("activityOverlay.actions.recheck"),
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
                title: t("activityOverlay.items.sourceUpdateCompleteTitle"),
                body: t("activityOverlay.items.importedRecordings", {
                    count: lastSyncResult.newRecordings ?? 0,
                }),
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
                title: t("activityOverlay.items.lastUpdateCompleteTitle"),
                body: t("activityOverlay.items.syncSummary", {
                    new: summary.newRecordings,
                    updated: summary.updatedRecordings,
                    removed: summary.removedRecordings,
                }),
                meta: formatRelative(workerStatus.lastFinishedAt, language),
                action: summary.errorCount > 0 ? "sync" : undefined,
                actionLabel:
                    summary.errorCount > 0
                        ? t("activityOverlay.actions.recheck")
                        : undefined,
                actionable: summary.errorCount > 0,
            });
        }

        for (const [recordingId, job] of transcriptionJobs) {
            const recordingName =
                recordingNames.get(recordingId) ??
                t("activityOverlay.items.untitledRecording");

            if (isActiveTranscriptionJob(job)) {
                items.push({
                    id: `transcription-active-${recordingId}`,
                    tone: "loading",
                    title: recordingName,
                    body: t("activityOverlay.items.transcriptionActive", {
                        status: getRemoteStatusText(job, t),
                    }),
                    action: "recording",
                    actionLabel: t("activityOverlay.actions.view"),
                    recordingId,
                    actionable: true,
                });
                continue;
            }

            if (job.status === "failed") {
                items.push({
                    id: `transcription-failed-${recordingId}`,
                    tone: "warn",
                    title: t("activityOverlay.items.transcriptionFailedTitle", {
                        name: recordingName,
                    }),
                    body:
                        job.lastError ??
                        t("activityOverlay.items.transcriptionFailedBody"),
                    action: "recording",
                    actionLabel: t("activityOverlay.actions.view"),
                    recordingId,
                    actionable: true,
                });
            }
        }

        return items;
    }, [
        isAutoSyncing,
        language,
        lastSyncResult,
        recordingNames,
        t,
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
        language,
        lastSyncTime,
        lastSyncResult,
        nextSyncTime,
        t,
        workerStatus,
    });

    const statusActionState = actionStates[STATUS_SYNC_ACTION_ID] ?? "idle";
    const displayedStatusCopy = useMemo(() => {
        if (statusActionState === "busy") {
            return {
                state: "loading" as const,
                line: t("activityOverlay.status.updatingSources"),
                sub: t("activityOverlay.status.checkingSources"),
            };
        }
        if (statusActionState === "done") {
            return {
                state: "idle" as const,
                line: t("activityOverlay.actions.queued"),
                sub: t("activityOverlay.status.continuesInBackground"),
            };
        }
        if (statusActionState === "failed") {
            return {
                state: "error" as const,
                line: t("activityOverlay.status.updateRequestFailed"),
                sub: t("activityOverlay.status.retryLaterShort"),
            };
        }

        return statusCopy;
    }, [statusActionState, statusCopy, t]);

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
            ? t("activityOverlay.actions.updatingShort")
            : statusActionState === "done"
              ? t("activityOverlay.actions.done")
              : statusActionState === "failed"
                ? t("activityOverlay.actions.retry")
                : t("activityOverlay.actions.update");

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
                        ? t("activityOverlay.itemAria", {
                              title: item.title,
                              action:
                                  item.actionLabel ??
                                  t("activityOverlay.actions.view"),
                          })
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
                            {getActionLabel(item, actionState, t)}
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("activityOverlay.dismissItem", {
                            title: item.title,
                        })}
                        className="h-7 w-7 shrink-0 rounded-lg"
                        data-activity-dismiss=""
                        data-testid="dashboard-activity-dismiss"
                        onClick={(event) => {
                            event.stopPropagation();
                            dismissItem(item.id);
                        }}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
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
                        ? t("activityOverlay.openWithPending", {
                              count: actionableCount,
                          })
                        : t("activityOverlay.open")
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
                    aria-label={t("activityOverlay.title")}
                    data-state={panelState}
                    data-testid="dashboard-activity-panel"
                    className="absolute top-11 right-0 z-[220] flex max-h-[min(calc(100svh-6rem),32.5rem)] w-[min(calc(100vw-1.5rem),24rem)] flex-col overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-2xl"
                >
                    <header className="flex items-center gap-3 border-border/70 border-b px-3.5 py-3">
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate font-semibold text-sm">
                                {t("activityOverlay.title")}
                            </h2>
                            <p className="truncate text-muted-foreground text-xs">
                                {actionableCount > 0
                                    ? t("activityOverlay.pendingCount", {
                                          count: actionableCount,
                                      })
                                    : visibleActivityItems.length > 0
                                      ? t("activityOverlay.recentCount", {
                                            count: visibleActivityItems.length,
                                        })
                                      : t("activityOverlay.allHandled")}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 shrink-0 rounded-lg"
                            aria-label={t("activityOverlay.close")}
                            onClick={() => closeAndReturnFocus()}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
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
                            <p className="font-medium text-sm">
                                {t("activityOverlay.emptyTitle")}
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                                {t("activityOverlay.emptyBody")}
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
