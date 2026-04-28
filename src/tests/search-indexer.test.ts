import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const { insertValuesMock } = vi.hoisted(() => ({
    insertValuesMock: vi.fn(),
}));

vi.mock("@/db", () => ({
    db: {
        insert: vi.fn(() => ({
            values: insertValuesMock,
        })),
    },
}));

import { db } from "@/db";
import { enqueueSearchIndexJob } from "@/server/modules/search/indexer";

describe("search indexer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("retries transient SQLite busy errors when queueing search jobs", async () => {
        vi.useFakeTimers();
        insertValuesMock
            .mockRejectedValueOnce(
                Object.assign(new Error("SQLITE_BUSY: database is locked"), {
                    code: "SQLITE_BUSY",
                }),
            )
            .mockResolvedValueOnce(undefined);

        const pending = enqueueSearchIndexJob({
            userId: "user-1",
            entityType: "transcript",
            entityId: "artifact-1",
        });
        await vi.runAllTimersAsync();
        await pending;

        expect(db.insert as Mock).toHaveBeenCalledTimes(2);
        expect(insertValuesMock).toHaveBeenCalledTimes(2);
    });

    it("retries nested SQLite busy errors from libsql causes", async () => {
        vi.useFakeTimers();
        insertValuesMock
            .mockRejectedValueOnce(
                Object.assign(new Error("Failed query"), {
                    cause: Object.assign(
                        new Error("SQLITE_BUSY: database is locked"),
                        {
                            code: "SQLITE_BUSY",
                        },
                    ),
                }),
            )
            .mockResolvedValueOnce(undefined);

        const pending = enqueueSearchIndexJob({
            userId: "user-1",
            entityType: "transcript",
            entityId: "artifact-1",
        });
        await vi.runAllTimersAsync();
        await pending;

        expect(db.insert as Mock).toHaveBeenCalledTimes(2);
        expect(insertValuesMock).toHaveBeenCalledTimes(2);
    });
});
