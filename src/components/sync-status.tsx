"use client";

import { AlertCircle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { formatRelativeDistance } from "@/lib/format-date";
import { cn } from "@/lib/utils";

interface SyncStatusProps {
    autoSyncEnabled: boolean;
    lastSyncTime: Date | null;
    nextSyncTime: Date | null;
    isAutoSyncing: boolean;
    lastSyncResult: {
        success: boolean;
        queued?: boolean;
        newRecordings?: number;
        error?: string;
    } | null;
    workerStatus: {
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
    className?: string;
}

export function SyncStatus({
    autoSyncEnabled,
    lastSyncTime,
    nextSyncTime,
    isAutoSyncing,
    lastSyncResult,
    workerStatus,
    className,
}: SyncStatusProps) {
    const { language, t } = useLanguage();

    const getStatusIcon = () => {
        if (isAutoSyncing) {
            return <RefreshCw className="w-3 h-3 text-primary animate-spin" />;
        }

        if (lastSyncResult?.success) {
            return <CheckCircle2 className="w-3 h-3 text-accent-green" />;
        }

        if (lastSyncResult?.success === false) {
            return <AlertCircle className="w-3 h-3 text-destructive" />;
        }

        return <Clock className="w-3 h-3 text-muted-foreground" />;
    };

    const getStatusText = () => {
        if (workerStatus?.isRunning) {
            return t("syncStatus.checkingNow");
        }

        if (workerStatus?.manualTriggerRequestedAt) {
            return t("syncStatus.checkingSoon");
        }

        if (isAutoSyncing) {
            return t("syncStatus.checkingNow");
        }

        if (autoSyncEnabled && workerStatus && !workerStatus.healthy) {
            return t("syncStatus.autoSyncUnavailable");
        }

        if (lastSyncResult?.success === false) {
            return t("syncStatus.syncFailed");
        }

        if (lastSyncTime) {
            try {
                return t("syncStatus.lastCheckedAgo", {
                    time: formatRelativeDistance(lastSyncTime, language),
                });
            } catch {
                return t("syncStatus.checkedRecently");
            }
        }

        if (autoSyncEnabled) {
            return t("syncStatus.waitingForAutoCheck");
        }

        return t("syncStatus.neverChecked");
    };

    const getNextSyncText = () => {
        if (workerStatus?.isRunning || isAutoSyncing) {
            return null;
        }

        try {
            if (!autoSyncEnabled) {
                return t("syncStatus.autoSyncPaused");
            }

            if (!workerStatus?.healthy) {
                if (workerStatus?.lastHeartbeatAt) {
                    return t("syncStatus.autoSyncUnavailableSince", {
                        time: formatRelativeDistance(
                            workerStatus.lastHeartbeatAt,
                            language,
                        ),
                    });
                }

                return t("syncStatus.autoSyncUnavailable");
            }

            if (!nextSyncTime) {
                return t("syncStatus.waitingForSchedule");
            }

            if (workerStatus?.manualTriggerRequestedAt) {
                return t("syncStatus.checkingSoon");
            }

            const now = new Date();
            const diff = nextSyncTime.getTime() - now.getTime();

            if (diff < 60000) {
                return t("syncStatus.nextCheckSoon");
            }

            return t("syncStatus.nextCheckIn", {
                time: formatRelativeDistance(nextSyncTime, language),
            });
        } catch {
            return null;
        }
    };

    const nextSyncText = getNextSyncText();

    return (
        <div
            className={cn(
                "flex items-center gap-2 text-xs text-muted-foreground",
                className,
            )}
        >
            {getStatusIcon()}
            <div className="flex flex-col">
                <span className="font-medium">{getStatusText()}</span>
                {nextSyncText && (
                    <span className="text-[10px] opacity-70">
                        {nextSyncText}
                    </span>
                )}
                {lastSyncResult?.success &&
                    lastSyncResult.newRecordings !== undefined &&
                    lastSyncResult.newRecordings > 0 && (
                        <span className="text-[10px] text-primary">
                            {t("syncStatus.newRecordings", {
                                count: lastSyncResult.newRecordings,
                                suffix:
                                    lastSyncResult.newRecordings !== 1
                                        ? "s"
                                        : "",
                            })}
                        </span>
                    )}
                {lastSyncResult?.error && (
                    <span className="text-[10px] text-destructive">
                        {lastSyncResult.error}
                    </span>
                )}
                {!lastSyncResult?.error && workerStatus?.lastError && (
                    <span className="text-[10px] text-destructive">
                        {workerStatus.lastError}
                    </span>
                )}
            </div>
        </div>
    );
}
