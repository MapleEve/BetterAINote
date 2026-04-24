import { env } from "@/lib/env";
import { processDueTranscriptionJobs } from "@/lib/transcription/jobs";
import {
    getUserSyncSchedules,
    isUserDueForSync,
    type SyncUsersResult,
    syncDueUsers,
} from "./sync-recordings";
import { upsertSyncWorkerStateForUsers } from "./worker-state";

export interface SyncWorkerStatus {
    lastRunAt: number | null;
    nextRunAt: number | null;
    polling: boolean;
    lastError: string | null;
    lastSummary: SyncUsersResult | null;
}

class SyncWorker {
    private interval: NodeJS.Timeout | null = null;
    private inFlight = false;
    private queuedTrigger = false;
    private readonly tickMs = Math.max(env.SYNC_WORKER_TICK_MS, 10000);

    private lastRunAt: number | null = null;
    private nextRunAt: number | null = null;
    private lastError: string | null = null;
    private lastSummary: SyncUsersResult | null = null;

    start(): void {
        if (this.interval) return;

        const runAndSchedule = (): void => {
            void this.runOnce().finally(() => {
                this.nextRunAt = Date.now() + this.tickMs;
            });
        };

        runAndSchedule();
        this.interval = setInterval(runAndSchedule, this.tickMs);
        console.info(`[worker] sync worker started (tick=${this.tickMs}ms)`);
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        console.info("[worker] sync worker stopped");
    }

    async trigger(): Promise<void> {
        if (this.inFlight) {
            this.queuedTrigger = true;
            return;
        }

        await this.runOnce();
    }

    status(): SyncWorkerStatus {
        return {
            lastRunAt: this.lastRunAt,
            nextRunAt: this.nextRunAt,
            polling: this.inFlight,
            lastError: this.lastError,
            lastSummary: this.lastSummary,
        };
    }

    private async runOnce(): Promise<void> {
        if (this.inFlight) return;

        this.inFlight = true;
        let allUserIds: string[] = [];
        try {
            const startedAt = new Date();
            const schedules = await getUserSyncSchedules();
            const dueUserIds = schedules
                .filter((schedule) => isUserDueForSync(schedule, startedAt))
                .map((schedule) => schedule.userId);

            allUserIds = schedules.map((schedule) => schedule.userId);

            await upsertSyncWorkerStateForUsers(allUserIds, {
                lastHeartbeatAt: startedAt,
                nextRunAt: null,
                isRunning: true,
            });

            await upsertSyncWorkerStateForUsers(dueUserIds, {
                lastStartedAt: startedAt,
                manualTriggerRequestedAt: null,
            });

            const summary = await syncDueUsers(startedAt, schedules);
            const transcriptionSummary = await processDueTranscriptionJobs();
            this.lastSummary = summary;
            this.lastError = summary.errors[0] ?? null;
            const finishedAt = new Date();
            const nextRunAt = new Date(finishedAt.getTime() + this.tickMs);

            await upsertSyncWorkerStateForUsers(allUserIds, {
                lastHeartbeatAt: finishedAt,
                nextRunAt,
                isRunning: false,
            });

            await Promise.all(
                summary.results.map(({ userId, result }) =>
                    upsertSyncWorkerStateForUsers([userId], {
                        lastHeartbeatAt: finishedAt,
                        lastFinishedAt: finishedAt,
                        nextRunAt,
                        manualTriggerRequestedAt: null,
                        isRunning: false,
                        lastError: result.errors[0] ?? null,
                        lastSummary: {
                            newRecordings: result.newRecordings,
                            updatedRecordings: result.updatedRecordings,
                            removedRecordings: result.removedRecordings,
                            errorCount: result.errors.length,
                        },
                    }),
                ),
            );

            console.info(
                `[worker] sync cycle done checked=${summary.checkedUsers} synced=${summary.syncedUsers} skipped=${summary.skippedUsers} errors=${summary.errors.length} transcriptionJobs=${transcriptionSummary.processed}/${transcriptionSummary.succeeded}/${transcriptionSummary.failed}`,
            );
        } catch (error) {
            this.lastError =
                error instanceof Error ? error.message : String(error);
            console.error("[worker] sync cycle failed:", error);

            const finishedAt = new Date();
            const nextRunAt = new Date(finishedAt.getTime() + this.tickMs);
            await upsertSyncWorkerStateForUsers(allUserIds, {
                lastHeartbeatAt: finishedAt,
                lastFinishedAt: finishedAt,
                nextRunAt,
                isRunning: false,
                lastError: this.lastError,
            });
        } finally {
            this.lastRunAt = Date.now();
            this.nextRunAt = this.lastRunAt + this.tickMs;
            this.inFlight = false;

            if (this.queuedTrigger) {
                this.queuedTrigger = false;
                void this.runOnce();
            }
        }
    }
}

export const syncWorker = new SyncWorker();
