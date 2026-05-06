import { describe, expect, it, vi } from "vitest";
import { createSearchIndexJobProcessor } from "@/server/modules/search/job-processor";

type SearchJobDeps = NonNullable<
    Parameters<typeof createSearchIndexJobProcessor>[0]
>;

function createDeps(
    jobs: Awaited<ReturnType<SearchJobDeps["loadPendingJobs"]>>,
    overrides: Partial<SearchJobDeps> = {},
) {
    const calls: string[] = [];
    const failed: Array<{
        jobId: string;
        attempts: number;
        status: string;
        error: string;
    }> = [];

    const deps: SearchJobDeps = {
        async loadPendingJobs({ limit }) {
            calls.push(`load:${limit}`);
            return jobs;
        },
        async markJobStarted({ jobId }) {
            calls.push(`started:${jobId}`);
        },
        async markJobCompleted({ jobId }) {
            calls.push(`completed:${jobId}`);
        },
        async markJobFailed(input) {
            calls.push(`failed:${input.jobId}:${input.status}`);
            failed.push(input);
        },
        async upsertEntity(input) {
            calls.push(`upsert:${input.entityType}:${input.entityId}`);
        },
        async deleteEntity(input) {
            calls.push(`delete:${input.entityType}:${input.entityId}`);
        },
        async rebuildUser(userId) {
            calls.push(`rebuild:${userId}`);
        },
        ...overrides,
    };

    return { calls, deps, failed };
}

describe("search job processor", () => {
    it("coalesces transcript upserts and processes remaining entity actions", async () => {
        const { calls, deps } = createDeps([
            {
                id: "job-transcript-1",
                userId: "user-1",
                entityType: "transcript",
                entityId: "segment-1",
                action: "upsert",
                attempts: 0,
            },
            {
                id: "job-transcript-2",
                userId: "user-1",
                entityType: "transcript",
                entityId: "segment-2",
                action: "upsert",
                attempts: 1,
            },
            {
                id: "job-recording-delete",
                userId: "user-1",
                entityType: "recording",
                entityId: "recording-1",
                action: "delete",
                attempts: 0,
            },
            {
                id: "job-speaker-upsert",
                userId: "user-1",
                entityType: "speaker",
                entityId: "speaker-1",
                action: "upsert",
                attempts: 0,
            },
            {
                id: "job-tag-rebuild",
                userId: "user-2",
                entityType: "tag",
                entityId: "tag-1",
                action: "rebuild",
                attempts: 0,
            },
        ]);

        const result = await createSearchIndexJobProcessor(deps).processPending(
            {
                limit: 500,
            },
        );

        expect(result).toEqual({ processed: 5, succeeded: 5, failed: 0 });
        expect(calls).toContain("load:200");
        expect(calls).toContain("rebuild:user-1");
        expect(calls).toContain("delete:recording:recording-1");
        expect(calls).toContain("upsert:speaker:speaker-1");
        expect(calls).toContain("rebuild:user-2");
        expect(calls.filter((call) => call === "rebuild:user-1")).toHaveLength(
            1,
        );
        expect(calls).not.toContain("upsert:transcript:segment-1");
    });

    it("marks failed jobs as retryable or terminal based on attempts", async () => {
        const { calls, deps, failed } = createDeps(
            [
                {
                    id: "job-transcript",
                    userId: "user-1",
                    entityType: "transcript",
                    entityId: "segment-1",
                    action: "upsert",
                    attempts: 2,
                },
                {
                    id: "job-recording",
                    userId: "user-2",
                    entityType: "recording",
                    entityId: "recording-1",
                    action: "upsert",
                    attempts: 0,
                },
                {
                    id: "job-delete",
                    userId: "user-3",
                    entityType: "tag",
                    entityId: "tag-1",
                    action: "delete",
                    attempts: 0,
                },
            ],
            {
                rebuildUser: vi.fn(async () => {
                    throw new Error("rebuild failed");
                }),
                upsertEntity: vi.fn(async () => {
                    throw "plain failure";
                }),
            },
        );

        const result = await createSearchIndexJobProcessor(deps).processPending(
            {
                limit: 0,
                maxAttempts: 3,
            },
        );

        expect(result).toEqual({ processed: 3, succeeded: 1, failed: 2 });
        expect(calls).toContain("load:1");
        expect(calls).toContain("delete:tag:tag-1");
        expect(failed).toEqual([
            {
                jobId: "job-transcript",
                attempts: 3,
                status: "failed",
                error: "rebuild failed",
            },
            {
                jobId: "job-recording",
                attempts: 1,
                status: "pending",
                error: "plain failure",
            },
        ]);
    });
});
