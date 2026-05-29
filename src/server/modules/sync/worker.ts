import { env } from "@/lib/env";
import { processPendingSearchIndexJobs } from "@/server/modules/search";
import {
    processDueTranscriptionJobs,
    TRANSCRIPTION_JOB_POLL_MS,
} from "@/server/modules/transcription/jobs";
import {
    getUserSyncSchedules,
    hasSyncResultProgress,
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
    private transcriptionInterval: NodeJS.Timeout | null = null;
    private inFlight = false;
    private transcriptionInFlight = false;
    private queuedTrigger = false;
    private readonly tickMs = Math.max(env.SYNC_WORKER_TICK_MS, 10000);
    private readonly transcriptionTickMs = TRANSCRIPTION_JOB_POLL_MS;

    private lastRunAt: number | null = null;
    private nextRunAt: number | null = null;
    private lastError: string | null = null;
    private lastSummary: SyncUsersResult | null = null;

    start(): void {
        if (this.interval || this.transcriptionInterval) return;

        const runAndSchedule = (): void => {
            void this.runOnce().finally(() => {
                this.nextRunAt = Date.now() + this.tickMs;
            });
        };

        const runTranscription = (): void => {
            void this.runTranscriptionOnce();
        };

        runAndSchedule();
        runTranscription();
        this.interval = setInterval(runAndSchedule, this.tickMs);
        this.transcriptionInterval = setInterval(
            runTranscription,
            this.transcriptionTickMs,
        );
        console.info(
            `[worker] sync worker started (tick=${this.tickMs}ms, transcriptionTick=${this.transcriptionTickMs}ms)`,
        );
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.transcriptionInterval) {
            clearInterval(this.transcriptionInterval);
            this.transcriptionInterval = null;
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
            const externalSyncRunning = schedules.some(
                (schedule) => schedule.isRunning,
            );
            const runnableSchedules = schedules.filter(
                (schedule) => !schedule.isRunning,
            );
            const dueUserIds = runnableSchedules
                .filter((schedule) => isUserDueForSync(schedule, startedAt))
                .map((schedule) => schedule.userId);

            allUserIds = runnableSchedules.map((schedule) => schedule.userId);

            await upsertSyncWorkerStateForUsers(allUserIds, {
                lastHeartbeatAt: startedAt,
                nextRunAt: null,
                isRunning: true,
            });

            await upsertSyncWorkerStateForUsers(dueUserIds, {
                lastStartedAt: startedAt,
                manualTriggerRequestedAt: null,
            });

            const summary = await syncDueUsers(startedAt, runnableSchedules);
            const searchSummary = externalSyncRunning
                ? { processed: 0, succeeded: 0, failed: 0 }
                : await processPendingSearchIndexJobs();
            const blockingErrors = summary.results.flatMap(
                ({ result, userId }) =>
                    hasSyncResultProgress(result)
                        ? []
                        : result.errors.map((error) => `[${userId}] ${error}`),
            );

            this.lastSummary = summary;
            this.lastError = blockingErrors[0] ?? null;
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
                        lastError: hasSyncResultProgress(result)
                            ? null
                            : (result.errors[0] ?? null),
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
                `[worker] sync cycle done checked=${summary.checkedUsers} synced=${summary.syncedUsers} skipped=${summary.skippedUsers} errors=${summary.errors.length} searchJobs=${searchSummary.processed}/${searchSummary.succeeded}/${searchSummary.failed}`,
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

    private async runTranscriptionOnce(): Promise<void> {
        if (this.transcriptionInFlight) return;

        this.transcriptionInFlight = true;
        try {
            const summary = await processDueTranscriptionJobs();
            if (summary.processed > 0 || summary.failed > 0) {
                console.info(
                    `[worker] transcription cycle done jobs=${summary.processed}/${summary.succeeded}/${summary.failed}`,
                );
            }
        } catch (error) {
            console.error("[worker] transcription cycle failed:", error);
        } finally {
            this.transcriptionInFlight = false;
        }
    }
}

export const syncWorker = new SyncWorker();
