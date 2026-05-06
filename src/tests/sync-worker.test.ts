import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getUserSyncSchedules: vi.fn(),
    syncDueUsers: vi.fn(),
    processDueTranscriptionJobs: vi.fn(),
    processPendingSearchIndexJobs: vi.fn(),
    upsertSyncWorkerStateForUsers: vi.fn(),
}));

vi.mock("@/lib/sync/sync-recordings", () => ({
    getUserSyncSchedules: mocks.getUserSyncSchedules,
    hasSyncResultProgress: vi.fn(() => false),
    isUserDueForSync: vi.fn(() => true),
    syncDueUsers: mocks.syncDueUsers,
}));

vi.mock("@/lib/transcription/jobs", () => ({
    processDueTranscriptionJobs: mocks.processDueTranscriptionJobs,
    TRANSCRIPTION_JOB_POLL_MS: 5000,
}));

vi.mock("@/server/modules/search", () => ({
    processPendingSearchIndexJobs: mocks.processPendingSearchIndexJobs,
}));

vi.mock("@/lib/sync/worker-state", () => ({
    upsertSyncWorkerStateForUsers: mocks.upsertSyncWorkerStateForUsers,
}));

import { syncWorker } from "@/lib/sync/worker";

describe("sync worker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getUserSyncSchedules.mockResolvedValue([
            {
                userId: "user-1",
                lastSync: null,
                syncInterval: 300000,
                autoSyncEnabled: true,
                manualTriggerRequestedAt: null,
                isRunning: true,
            },
        ]);
        mocks.syncDueUsers.mockResolvedValue({
            checkedUsers: 0,
            syncedUsers: 0,
            skippedUsers: 0,
            errors: [],
            results: [],
        });
        mocks.processDueTranscriptionJobs.mockResolvedValue({
            processed: 0,
            succeeded: 0,
            failed: 0,
        });
        mocks.processPendingSearchIndexJobs.mockResolvedValue({
            processed: 0,
            succeeded: 0,
            failed: 0,
        });
        mocks.upsertSyncWorkerStateForUsers.mockResolvedValue(undefined);
    });

    it("does not process search jobs while an external provider sync is running", async () => {
        await syncWorker.trigger();

        expect(mocks.syncDueUsers).toHaveBeenCalledWith(expect.any(Date), []);
        expect(mocks.processDueTranscriptionJobs).not.toHaveBeenCalled();
        expect(mocks.processPendingSearchIndexJobs).not.toHaveBeenCalled();
    });

    it("runs transcription jobs on a separate worker tick", async () => {
        vi.useFakeTimers();

        try {
            syncWorker.start();
            await vi.waitFor(() => {
                expect(mocks.processDueTranscriptionJobs).toHaveBeenCalled();
            });
        } finally {
            syncWorker.stop();
            vi.useRealTimers();
        }
    });
});
