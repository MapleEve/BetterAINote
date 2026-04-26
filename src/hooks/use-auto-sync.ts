"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    readBrowserStorage,
    startBrowserInterval,
    stopBrowserInterval,
    writeBrowserStorage,
} from "@/lib/platform/browser-shell";

interface UseAutoSyncOptions {
    onSuccess?: (result: { queued: boolean; newRecordings?: number }) => void;
    onError?: (error: string) => void;
}

interface SyncStatus {
    isManualSyncing: boolean;
    autoSyncEnabled: boolean;
    lastSyncTime: Date | null;
    nextSyncTime: Date | null;
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
}

const STORAGE_KEY = "betterainote_last_sync";
const STATUS_REFRESH_MS = 30000;

export function useAutoSync(options: UseAutoSyncOptions = {}) {
    const { onSuccess, onError } = options;
    const [status, setStatus] = useState<SyncStatus>({
        isManualSyncing: false,
        autoSyncEnabled: true,
        lastSyncTime: null,
        nextSyncTime: null,
        lastSyncResult: null,
        workerStatus: null,
    });

    const isSyncingRef = useRef(false);
    const lastSyncTimeRef = useRef<number>(0);
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
    }, [onSuccess, onError]);

    const refreshStatus = useCallback(async () => {
        try {
            const response = await fetch("/api/data-sources/sync", {
                method: "GET",
                cache: "no-store",
            });

            if (!response.ok) {
                return;
            }

            const result = await response.json();
            const lastSyncTime = result.lastSyncTime
                ? new Date(result.lastSyncTime)
                : null;
            const nextSyncTime = result.nextSyncTime
                ? new Date(result.nextSyncTime)
                : null;
            const workerStatus = result.workerStatus
                ? {
                      healthy: !!result.workerStatus.healthy,
                      isRunning: !!result.workerStatus.isRunning,
                      lastHeartbeatAt: result.workerStatus.lastHeartbeatAt
                          ? new Date(result.workerStatus.lastHeartbeatAt)
                          : null,
                      lastStartedAt: result.workerStatus.lastStartedAt
                          ? new Date(result.workerStatus.lastStartedAt)
                          : null,
                      lastFinishedAt: result.workerStatus.lastFinishedAt
                          ? new Date(result.workerStatus.lastFinishedAt)
                          : null,
                      nextRunAt: result.workerStatus.nextRunAt
                          ? new Date(result.workerStatus.nextRunAt)
                          : null,
                      manualTriggerRequestedAt: result.workerStatus
                          .manualTriggerRequestedAt
                          ? new Date(
                                result.workerStatus.manualTriggerRequestedAt,
                            )
                          : null,
                      lastError: result.workerStatus.lastError ?? null,
                      lastSummary: result.workerStatus.lastSummary ?? null,
                  }
                : null;

            if (lastSyncTime) {
                lastSyncTimeRef.current = lastSyncTime.getTime();
                writeBrowserStorage(STORAGE_KEY, lastSyncTime.toISOString());
            }

            setStatus((prev) => ({
                ...prev,
                autoSyncEnabled: result.autoSyncEnabled ?? true,
                lastSyncTime,
                nextSyncTime,
                lastSyncResult:
                    workerStatus?.lastError === null &&
                    workerStatus?.lastSummary?.errorCount === 0
                        ? null
                        : prev.lastSyncResult,
                workerStatus,
            }));
        } catch {
            // best-effort only
        }
    }, []);

    const performSync = useCallback(async () => {
        if (isSyncingRef.current) {
            return;
        }

        isSyncingRef.current = true;
        setStatus((prev) => ({ ...prev, isManualSyncing: true }));

        try {
            const response = await fetch("/api/data-sources/sync", {
                method: "POST",
            });

            if (response.ok) {
                const result = await response.json();

                if (result.success === false) {
                    const errorMessage =
                        result.error ||
                        "Failed to sync recordings from your connected sources";

                    setStatus((prev) => ({
                        ...prev,
                        lastSyncResult: {
                            success: false,
                            error: errorMessage,
                        },
                    }));

                    await refreshStatus();
                    onErrorRef.current?.(errorMessage);
                    return;
                }

                setStatus((prev) => ({
                    ...prev,
                    lastSyncResult: {
                        success: true,
                        queued: !!result.queued,
                        newRecordings: result.newRecordings || 0,
                    },
                }));

                await refreshStatus();
                onSuccessRef.current?.({
                    queued: !!result.queued,
                    newRecordings: result.newRecordings || 0,
                });
            } else {
                const error = await response.json();
                const errorMessage = error.error || "Sync failed";

                setStatus((prev) => ({
                    ...prev,
                    lastSyncResult: {
                        success: false,
                        error: errorMessage,
                    },
                }));

                onErrorRef.current?.(errorMessage);
            }
        } catch {
            const errorMessage =
                "Failed to sync recordings from your connected sources";
            setStatus((prev) => ({
                ...prev,
                lastSyncResult: {
                    success: false,
                    error: errorMessage,
                },
            }));

            onErrorRef.current?.(errorMessage);
        } finally {
            isSyncingRef.current = false;
            setStatus((prev) => ({
                ...prev,
                isManualSyncing: false,
            }));
        }
    }, [refreshStatus]);

    useEffect(() => {
        const stored = readBrowserStorage(STORAGE_KEY);
        if (stored) {
            const lastSync = new Date(stored);
            setStatus((prev) => ({ ...prev, lastSyncTime: lastSync }));
            lastSyncTimeRef.current = lastSync.getTime();
        }

        refreshStatus();

        const interval = startBrowserInterval(() => {
            void refreshStatus();
        }, STATUS_REFRESH_MS);

        return () => {
            stopBrowserInterval(interval);
        };
    }, [refreshStatus]);

    const manualSync = useCallback(() => {
        return performSync();
    }, [performSync]);

    return {
        ...status,
        isAutoSyncing:
            status.isManualSyncing ||
            (status.workerStatus?.healthy === true &&
                (status.workerStatus.isRunning === true ||
                    status.workerStatus.manualTriggerRequestedAt != null)),
        manualSync,
        refreshStatus,
    };
}
