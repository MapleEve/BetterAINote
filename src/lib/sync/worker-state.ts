import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { syncWorkerState } from "@/db/schema/core";

export interface PersistedSyncWorkerSummary {
    newRecordings: number;
    updatedRecordings: number;
    removedRecordings: number;
    errorCount: number;
}

interface SyncWorkerStatePatch {
    lastHeartbeatAt?: Date | null;
    lastStartedAt?: Date | null;
    lastFinishedAt?: Date | null;
    nextRunAt?: Date | null;
    manualTriggerRequestedAt?: Date | null;
    isRunning?: boolean;
    lastError?: string | null;
    lastSummary?: PersistedSyncWorkerSummary | null;
}

function serializeLastSummary(
    summary: PersistedSyncWorkerSummary | null | undefined,
): ReturnType<typeof sql> | null | undefined {
    if (summary === undefined) {
        return undefined;
    }

    if (summary === null) {
        return null;
    }

    return sql`${sql.param(summary, syncWorkerState.lastSummary)}`;
}

function buildInsertValues(
    userId: string,
    patch: SyncWorkerStatePatch,
): typeof syncWorkerState.$inferInsert {
    return {
        userId,
        lastHeartbeatAt: patch.lastHeartbeatAt ?? null,
        lastStartedAt: patch.lastStartedAt ?? null,
        lastFinishedAt: patch.lastFinishedAt ?? null,
        nextRunAt: patch.nextRunAt ?? null,
        manualTriggerRequestedAt: patch.manualTriggerRequestedAt ?? null,
        isRunning: patch.isRunning ?? false,
        lastError: patch.lastError ?? null,
        lastSummary: (serializeLastSummary(patch.lastSummary ?? null) ??
            null) as (typeof syncWorkerState.$inferInsert)["lastSummary"],
        updatedAt: new Date(),
    };
}

function buildUpdateValues(patch: SyncWorkerStatePatch) {
    const values: Record<string, unknown> = {
        updatedAt: new Date(),
    };

    if (patch.lastHeartbeatAt !== undefined) {
        values.lastHeartbeatAt = patch.lastHeartbeatAt;
    }
    if (patch.lastStartedAt !== undefined) {
        values.lastStartedAt = patch.lastStartedAt;
    }
    if (patch.lastFinishedAt !== undefined) {
        values.lastFinishedAt = patch.lastFinishedAt;
    }
    if (patch.nextRunAt !== undefined) {
        values.nextRunAt = patch.nextRunAt;
    }
    if (patch.manualTriggerRequestedAt !== undefined) {
        values.manualTriggerRequestedAt = patch.manualTriggerRequestedAt;
    }
    if (patch.isRunning !== undefined) {
        values.isRunning = patch.isRunning;
    }
    if (patch.lastError !== undefined) {
        values.lastError = patch.lastError;
    }
    if (patch.lastSummary !== undefined) {
        values.lastSummary = serializeLastSummary(patch.lastSummary);
    }

    return values;
}

export async function upsertSyncWorkerStateForUsers(
    userIds: string[],
    patch: SyncWorkerStatePatch,
): Promise<void> {
    if (userIds.length === 0) {
        return;
    }

    await Promise.all(
        [...new Set(userIds)].map((userId) =>
            db
                .insert(syncWorkerState)
                .values(buildInsertValues(userId, patch))
                .onConflictDoUpdate({
                    target: syncWorkerState.userId,
                    set: buildUpdateValues(patch),
                }),
        ),
    );
}

export async function getSyncWorkerStateForUser(userId: string) {
    const [state] = await db
        .select()
        .from(syncWorkerState)
        .where(eq(syncWorkerState.userId, userId))
        .limit(1);

    return state ?? null;
}

export async function requestManualSyncForUser(userId: string): Promise<void> {
    await upsertSyncWorkerStateForUsers([userId], {
        manualTriggerRequestedAt: new Date(),
    });
}
