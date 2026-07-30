import { describe, expect, it } from "vitest";
import { resolveSyncActivityState } from "@/hooks/use-auto-sync";

const finishedWorker = {
    healthy: true,
    isRunning: false,
    lastHeartbeatAt: new Date("2026-07-31T00:00:00.000Z"),
    lastStartedAt: new Date("2026-07-31T00:00:00.000Z"),
    lastFinishedAt: new Date("2026-07-31T00:00:01.000Z"),
    nextRunAt: new Date("2026-07-31T00:05:00.000Z"),
    manualTriggerRequestedAt: null,
    lastError: null,
    lastErrorReason: null,
    lastSummary: {
        newRecordings: 0,
        updatedRecordings: 0,
        removedRecordings: 0,
        errorCount: 0,
    },
};

describe("auto-sync runtime state reconciliation", () => {
    it("maps the persisted worker lifecycle without leaving a stale queued state", () => {
        expect(
            resolveSyncActivityState({
                isManualSyncing: false,
                workerStatus: finishedWorker,
            }),
        ).toBe("idle");

        expect(
            resolveSyncActivityState({
                isManualSyncing: false,
                workerStatus: {
                    ...finishedWorker,
                    lastFinishedAt: null,
                    manualTriggerRequestedAt: new Date(
                        "2026-07-31T00:00:02.000Z",
                    ),
                },
            }),
        ).toBe("queued");

        expect(
            resolveSyncActivityState({
                isManualSyncing: false,
                workerStatus: {
                    ...finishedWorker,
                    isRunning: true,
                    lastFinishedAt: null,
                },
            }),
        ).toBe("running");

        expect(
            resolveSyncActivityState({
                isManualSyncing: false,
                workerStatus: finishedWorker,
            }),
        ).toBe("idle");
    });

    it("does not revive stale or unhealthy queued work", () => {
        expect(
            resolveSyncActivityState({
                isManualSyncing: false,
                workerStatus: {
                    ...finishedWorker,
                    healthy: false,
                    manualTriggerRequestedAt: new Date(
                        "2026-07-31T00:00:02.000Z",
                    ),
                },
            }),
        ).toBe("idle");

        expect(
            resolveSyncActivityState({
                isManualSyncing: true,
                workerStatus: null,
            }),
        ).toBe("running");
    });
});
