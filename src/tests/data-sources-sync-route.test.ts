import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: vi.fn(),
        },
    },
}));

vi.mock("@/lib/env", () => ({
    env: {
        SYNC_WORKER_TICK_MS: 60000,
    },
}));

vi.mock("@/lib/sync/worker-state", () => ({
    getSyncWorkerStateForUser: vi.fn(),
    upsertSyncWorkerStateForUsers: vi.fn(),
}));

vi.mock("@/lib/sync/sync-recordings", () => ({
    syncRecordingsForUser: vi.fn(),
    getUserSyncSchedules: vi.fn(),
}));

vi.mock("@/lib/data-sources", () => ({
    getEnabledSourceConnectionsForUser: vi.fn(),
    sourceConnectionSupportsWorkerSync: vi.fn(
        (connection: { provider: string; authMode?: string | null }) =>
            !(
                connection.provider === "feishu-minutes" &&
                connection.authMode === "web-reverse"
            ),
    ),
}));

import { GET, POST } from "@/app/api/data-sources/sync/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { getEnabledSourceConnectionsForUser } from "@/lib/data-sources";
import {
    getUserSyncSchedules,
    syncRecordingsForUser,
} from "@/lib/sync/sync-recordings";
import {
    getSyncWorkerStateForUser,
    upsertSyncWorkerStateForUsers,
} from "@/lib/sync/worker-state";

function makeRequest(method: "GET" | "POST") {
    return new Request("http://localhost/api/data-sources/sync", {
        method,
    });
}

describe("Data sources sync route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
    });

    it("reports worker-driven sync state", async () => {
        (getUserSyncSchedules as Mock).mockResolvedValue([
            {
                userId: "user-1",
                lastSync: new Date("2026-04-18T09:00:00.000Z"),
                syncInterval: 300000,
                autoSyncEnabled: true,
                manualTriggerRequestedAt: null,
            },
        ]);
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            syncInterval: 300000,
                            autoSyncEnabled: true,
                        },
                    ]),
                }),
            }),
        });

        (getSyncWorkerStateForUser as Mock).mockResolvedValue({
            isRunning: false,
            lastHeartbeatAt: new Date(),
            lastStartedAt: new Date("2026-04-18T09:01:00.000Z"),
            lastFinishedAt: new Date("2026-04-18T09:02:00.000Z"),
            nextRunAt: new Date("2026-04-18T09:05:00.000Z"),
            manualTriggerRequestedAt: null,
            lastError: null,
            lastSummary: {
                newRecordings: 1,
                updatedRecordings: 0,
                removedRecordings: 0,
                errorCount: 0,
            },
        });

        const response = await GET(makeRequest("GET"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            configured: true,
            workerDriven: true,
            autoSyncEnabled: true,
            workerStatus: {
                healthy: true,
                isRunning: false,
            },
        });
    });

    it("does not report stale worker state as actively syncing", async () => {
        (getUserSyncSchedules as Mock).mockResolvedValue([
            {
                userId: "user-1",
                lastSync: new Date("2026-04-18T09:00:00.000Z"),
                syncInterval: 300000,
                autoSyncEnabled: true,
                manualTriggerRequestedAt: null,
            },
        ]);
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            syncInterval: 300000,
                            autoSyncEnabled: true,
                        },
                    ]),
                }),
            }),
        });

        (getSyncWorkerStateForUser as Mock).mockResolvedValue({
            isRunning: true,
            lastHeartbeatAt: new Date("2026-04-18T08:00:00.000Z"),
            lastStartedAt: new Date("2026-04-18T08:00:00.000Z"),
            lastFinishedAt: null,
            nextRunAt: new Date("2026-04-18T09:05:00.000Z"),
            manualTriggerRequestedAt: new Date("2026-04-18T08:01:00.000Z"),
            lastError: null,
            lastSummary: null,
        });

        const response = await GET(makeRequest("GET"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            workerStatus: {
                healthy: false,
                isRunning: false,
                manualTriggerRequestedAt: null,
            },
        });
    });

    it("runs a manual sync immediately and returns the result", async () => {
        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            { provider: "plaud" },
        ]);
        (syncRecordingsForUser as Mock).mockResolvedValue({
            newRecordings: 2,
            updatedRecordings: 1,
            removedRecordings: 0,
            pendingTranscriptionIds: ["rec-1", "rec-2"],
            errors: [],
        });

        const response = await POST(makeRequest("POST"));

        expect(response.status).toBe(200);
        expect(upsertSyncWorkerStateForUsers).toHaveBeenCalledTimes(2);
        expect(syncRecordingsForUser).toHaveBeenCalledWith("user-1", {
            awaitTranscriptionQueue: true,
        });
        await expect(response.json()).resolves.toEqual({
            success: true,
            queued: false,
            newRecordings: 2,
            updatedRecordings: 1,
            removedRecordings: 0,
            pendingTranscriptionIds: ["rec-1", "rec-2"],
            errors: [],
            error: null,
        });
    });

    it("redacts provider errors from manual sync responses and public status", async () => {
        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            { provider: "ticnote" },
        ]);
        (syncRecordingsForUser as Mock).mockResolvedValue({
            newRecordings: 0,
            updatedRecordings: 0,
            removedRecordings: 0,
            pendingTranscriptionIds: [],
            errors: [
                "[ticnote] Sync failed: HTTP 403 session expired token=secret-token cookie=session org id org_123 recording id rec-raw",
            ],
        });

        const response = await POST(makeRequest("POST"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            errors: ["导入失败，请稍后重试"],
            error: "导入失败，请稍后重试",
        });

        (getUserSyncSchedules as Mock).mockResolvedValue([
            {
                userId: "user-1",
                lastSync: new Date("2026-04-18T09:00:00.000Z"),
                syncInterval: 300000,
                autoSyncEnabled: true,
                manualTriggerRequestedAt: null,
            },
        ]);
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            syncInterval: 300000,
                            autoSyncEnabled: true,
                        },
                    ]),
                }),
            }),
        });
        (getSyncWorkerStateForUser as Mock).mockResolvedValue({
            isRunning: false,
            lastHeartbeatAt: new Date(),
            lastStartedAt: null,
            lastFinishedAt: null,
            nextRunAt: null,
            manualTriggerRequestedAt: null,
            lastError:
                "HTTP 403 session expired token=secret-token cookie=session org id org_123 recording id rec-raw",
            lastSummary: {
                newRecordings: 0,
                updatedRecordings: 0,
                removedRecordings: 0,
                errorCount: 1,
            },
        });

        const statusResponse = await GET(makeRequest("GET"));

        expect(statusResponse.status).toBe(200);
        await expect(statusResponse.json()).resolves.toMatchObject({
            workerStatus: {
                lastError: "导入失败，请稍后重试",
            },
        });
    });

    it("rejects manual sync when only Feishu Minutes browser sign-in is configured", async () => {
        (getEnabledSourceConnectionsForUser as Mock).mockResolvedValue([
            {
                provider: "feishu-minutes",
                authMode: "web-reverse",
            },
        ]);

        const response = await POST(makeRequest("POST"));

        expect(response.status).toBe(400);
        expect(syncRecordingsForUser).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            error: "No sync-capable data source configured",
        });
    });
});
