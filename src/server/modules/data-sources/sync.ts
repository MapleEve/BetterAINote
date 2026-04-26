import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema/core";
import {
    getEnabledSourceConnectionsForUser,
    sourceConnectionSupportsWorkerSync,
} from "@/lib/data-sources";
import {
    sanitizePublicDataSourceError,
    sanitizePublicDataSourceErrors,
} from "@/lib/data-sources/public-errors";
import { env } from "@/lib/env";
import { AppError, ErrorCode } from "@/lib/errors";
import {
    getUserSyncSchedules,
    syncRecordingsForUser,
} from "@/lib/sync/sync-recordings";
import {
    getSyncWorkerStateForUser,
    upsertSyncWorkerStateForUsers,
} from "@/lib/sync/worker-state";

function computeNextSyncTime(
    autoSyncEnabled: boolean,
    lastSyncTime: Date | null,
    syncInterval: number,
    workerNextRunAt: Date | null,
): Date | null {
    if (!autoSyncEnabled) {
        return null;
    }

    if (!lastSyncTime) {
        return workerNextRunAt;
    }

    const nextEligibleSyncAt = new Date(lastSyncTime.getTime() + syncInterval);

    if (!workerNextRunAt) {
        return nextEligibleSyncAt;
    }

    return nextEligibleSyncAt > workerNextRunAt
        ? nextEligibleSyncAt
        : workerNextRunAt;
}

export async function getDataSourceSyncStatusForUser(userId: string) {
    const schedule = (await getUserSyncSchedules()).find(
        (item) => item.userId === userId,
    );

    const [settings] = await db
        .select({
            syncInterval: userSettings.syncInterval,
            autoSyncEnabled: userSettings.autoSyncEnabled,
        })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

    const syncInterval = settings?.syncInterval ?? 300000;
    const autoSyncEnabled = settings?.autoSyncEnabled ?? true;
    const lastSyncTime = schedule?.lastSync ?? null;
    const workerState = await getSyncWorkerStateForUser(userId);
    const workerLastHeartbeatAt = workerState?.lastHeartbeatAt ?? null;
    const workerNextRunAt = workerState?.nextRunAt ?? null;
    const healthyThresholdMs = Math.max(env.SYNC_WORKER_TICK_MS * 2, 60000);
    const workerHealthy = workerLastHeartbeatAt
        ? Date.now() - workerLastHeartbeatAt.getTime() <= healthyThresholdMs
        : false;
    const workerIsRunning = workerHealthy && (workerState?.isRunning ?? false);
    const manualTriggerRequestedAt = workerHealthy
        ? (workerState?.manualTriggerRequestedAt ?? null)
        : null;
    const nextSyncTime = computeNextSyncTime(
        autoSyncEnabled,
        lastSyncTime,
        syncInterval,
        workerNextRunAt,
    );

    return {
        configured: Boolean(schedule),
        workerDriven: true,
        autoSyncEnabled,
        lastSyncTime: lastSyncTime?.toISOString() ?? null,
        nextSyncTime: nextSyncTime?.toISOString() ?? null,
        workerStatus: {
            healthy: workerHealthy,
            isRunning: workerIsRunning,
            lastHeartbeatAt: workerLastHeartbeatAt?.toISOString() ?? null,
            lastStartedAt: workerState?.lastStartedAt?.toISOString() ?? null,
            lastFinishedAt: workerState?.lastFinishedAt?.toISOString() ?? null,
            nextRunAt: workerNextRunAt?.toISOString() ?? null,
            manualTriggerRequestedAt:
                manualTriggerRequestedAt?.toISOString() ?? null,
            lastError: sanitizePublicDataSourceError(
                workerState?.lastError ?? null,
            ),
            lastSummary: workerState?.lastSummary ?? null,
        },
    };
}

export async function runManualDataSourceSyncForUser(userId: string) {
    const connections = await getEnabledSourceConnectionsForUser(userId);
    const workerSyncConnections = connections.filter(
        sourceConnectionSupportsWorkerSync,
    );

    if (workerSyncConnections.length === 0) {
        throw new AppError(
            ErrorCode.INVALID_INPUT,
            connections.length === 0
                ? "No data source configured"
                : "No sync-capable data source configured",
            400,
        );
    }

    const startedAt = new Date();
    await upsertSyncWorkerStateForUsers([userId], {
        lastHeartbeatAt: startedAt,
        lastStartedAt: startedAt,
        manualTriggerRequestedAt: null,
        isRunning: true,
        lastError: null,
    });

    try {
        const result = await syncRecordingsForUser(userId, {
            awaitTranscriptionQueue: true,
        });
        const finishedAt = new Date();

        await upsertSyncWorkerStateForUsers([userId], {
            lastHeartbeatAt: finishedAt,
            lastFinishedAt: finishedAt,
            manualTriggerRequestedAt: null,
            isRunning: false,
            lastError: result.errors[0] ?? null,
            lastSummary: {
                newRecordings: result.newRecordings,
                updatedRecordings: result.updatedRecordings,
                removedRecordings: result.removedRecordings,
                errorCount: result.errors.length,
            },
        });

        const success = result.errors.length === 0;
        const publicErrors = sanitizePublicDataSourceErrors(result.errors);

        return {
            success,
            queued: false,
            newRecordings: result.newRecordings,
            updatedRecordings: result.updatedRecordings,
            removedRecordings: result.removedRecordings,
            pendingTranscriptionIds: result.pendingTranscriptionIds,
            errors: publicErrors,
            error: publicErrors[0] ?? null,
        };
    } catch (error) {
        await upsertSyncWorkerStateForUsers([userId], {
            lastHeartbeatAt: new Date(),
            lastFinishedAt: new Date(),
            manualTriggerRequestedAt: null,
            isRunning: false,
            lastError: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
