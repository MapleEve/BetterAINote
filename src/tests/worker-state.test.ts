import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    insertValues: [] as Array<Record<string, unknown>>,
    updateSets: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/db", () => ({
    db: {
        insert: vi.fn(() => ({
            values: (values: Record<string, unknown>) => {
                mocks.insertValues.push(values);

                return {
                    onConflictDoUpdate: (config: {
                        set: Record<string, unknown>;
                    }) => {
                        mocks.updateSets.push(config.set);
                        return Promise.resolve();
                    },
                };
            },
        })),
    },
}));

import { upsertSyncWorkerStateForUsers } from "@/lib/sync/worker-state";

describe("worker-state", () => {
    beforeEach(() => {
        mocks.insertValues.length = 0;
        mocks.updateSets.length = 0;
    });

    it("serializes lastSummary before writing sync_worker_state", async () => {
        await upsertSyncWorkerStateForUsers(["user-1"], {
            lastSummary: {
                newRecordings: 2,
                updatedRecordings: 1,
                removedRecordings: 0,
                errorCount: 0,
            },
        });

        expect(mocks.insertValues).toHaveLength(1);
        expect(mocks.updateSets).toHaveLength(1);
        expect(
            typeof (mocks.insertValues[0]?.lastSummary as { getSQL?: unknown })
                ?.getSQL,
        ).toBe("function");
        expect(
            typeof (mocks.updateSets[0]?.lastSummary as { getSQL?: unknown })
                ?.getSQL,
        ).toBe("function");
        expect(mocks.insertValues[0]?.lastSummary).not.toEqual({
            newRecordings: 2,
            updatedRecordings: 1,
            removedRecordings: 0,
            errorCount: 0,
        });
        expect(mocks.updateSets[0]?.lastSummary).not.toEqual({
            newRecordings: 2,
            updatedRecordings: 1,
            removedRecordings: 0,
            errorCount: 0,
        });
    });
});
