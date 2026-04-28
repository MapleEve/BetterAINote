import { describe, expect, it, vi } from "vitest";
import { createSearchIndexJobProcessor } from "@/server/modules/search/job-processor";

describe("search index job processor", () => {
    it("processes pending upsert and delete jobs through injected backends", async () => {
        const jobs = [
            {
                id: "job-1",
                userId: "user-1",
                entityType: "recording",
                entityId: "recording-1",
                action: "upsert",
                attempts: 0,
            },
            {
                id: "job-2",
                userId: "user-1",
                entityType: "recording",
                entityId: "recording-2",
                action: "delete",
                attempts: 0,
            },
        ];
        const deps = {
            loadPendingJobs: vi.fn().mockResolvedValue(jobs),
            markJobStarted: vi.fn(),
            markJobCompleted: vi.fn(),
            markJobFailed: vi.fn(),
            upsertEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn().mockResolvedValue(undefined),
            rebuildUser: vi.fn(),
        };

        const processor = createSearchIndexJobProcessor(deps);
        const result = await processor.processPending({ limit: 10 });

        expect(result).toEqual({ processed: 2, succeeded: 2, failed: 0 });
        expect(deps.upsertEntity).toHaveBeenCalledWith({
            userId: "user-1",
            entityType: "recording",
            entityId: "recording-1",
        });
        expect(deps.deleteEntity).toHaveBeenCalledWith({
            userId: "user-1",
            entityType: "recording",
            entityId: "recording-2",
        });
        expect(deps.markJobCompleted).toHaveBeenCalledTimes(2);
        expect(deps.markJobFailed).not.toHaveBeenCalled();
    });

    it("marks transient indexing failures as retryable before max attempts", async () => {
        const deps = {
            loadPendingJobs: vi.fn().mockResolvedValue([
                {
                    id: "job-1",
                    userId: "user-1",
                    entityType: "recording",
                    entityId: "recording-1",
                    action: "upsert",
                    attempts: 1,
                },
            ]),
            markJobStarted: vi.fn(),
            markJobCompleted: vi.fn(),
            markJobFailed: vi.fn(),
            upsertEntity: vi.fn().mockRejectedValue(new Error("db locked")),
            deleteEntity: vi.fn(),
            rebuildUser: vi.fn(),
        };

        const processor = createSearchIndexJobProcessor(deps);
        const result = await processor.processPending({
            limit: 10,
            maxAttempts: 3,
        });

        expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
        expect(deps.markJobFailed).toHaveBeenCalledWith({
            jobId: "job-1",
            attempts: 2,
            status: "pending",
            error: "db locked",
        });
    });

    it("marks poisoned indexing jobs as failed after max attempts", async () => {
        const deps = {
            loadPendingJobs: vi.fn().mockResolvedValue([
                {
                    id: "job-1",
                    userId: "user-1",
                    entityType: "tag",
                    entityId: "tag-1",
                    action: "upsert",
                    attempts: 2,
                },
            ]),
            markJobStarted: vi.fn(),
            markJobCompleted: vi.fn(),
            markJobFailed: vi.fn(),
            upsertEntity: vi.fn().mockRejectedValue("boom"),
            deleteEntity: vi.fn(),
            rebuildUser: vi.fn(),
        };

        const processor = createSearchIndexJobProcessor(deps);
        await processor.processPending({ limit: 10, maxAttempts: 3 });

        expect(deps.markJobFailed).toHaveBeenCalledWith({
            jobId: "job-1",
            attempts: 3,
            status: "failed",
            error: "boom",
        });
    });

    it("coalesces transcript upsert jobs into one rebuild per user", async () => {
        const jobs = [
            {
                id: "job-1",
                userId: "user-1",
                entityType: "transcript",
                entityId: "segment-1",
                action: "upsert",
                attempts: 0,
            },
            {
                id: "job-2",
                userId: "user-1",
                entityType: "transcript",
                entityId: "segment-2",
                action: "upsert",
                attempts: 0,
            },
            {
                id: "job-3",
                userId: "user-2",
                entityType: "transcript",
                entityId: "segment-3",
                action: "upsert",
                attempts: 0,
            },
            {
                id: "job-4",
                userId: "user-1",
                entityType: "recording",
                entityId: "recording-1",
                action: "upsert",
                attempts: 0,
            },
        ];
        const deps = {
            loadPendingJobs: vi.fn().mockResolvedValue(jobs),
            markJobStarted: vi.fn(),
            markJobCompleted: vi.fn(),
            markJobFailed: vi.fn(),
            upsertEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn().mockResolvedValue(undefined),
            rebuildUser: vi.fn().mockResolvedValue(undefined),
        };

        const processor = createSearchIndexJobProcessor(deps);
        const result = await processor.processPending({ limit: 10 });

        expect(result).toEqual({ processed: 4, succeeded: 4, failed: 0 });
        expect(deps.rebuildUser).toHaveBeenCalledTimes(2);
        expect(deps.rebuildUser).toHaveBeenCalledWith("user-1");
        expect(deps.rebuildUser).toHaveBeenCalledWith("user-2");
        expect(deps.upsertEntity).toHaveBeenCalledTimes(1);
        expect(deps.upsertEntity).toHaveBeenCalledWith({
            userId: "user-1",
            entityType: "recording",
            entityId: "recording-1",
        });
        expect(deps.markJobStarted).toHaveBeenCalledTimes(4);
        expect(deps.markJobCompleted).toHaveBeenCalledTimes(4);
        expect(deps.markJobFailed).not.toHaveBeenCalled();
    });
});
