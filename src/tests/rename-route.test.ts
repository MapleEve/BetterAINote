import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: vi.fn(),
        },
    },
}));

vi.mock("@/lib/data-sources/source-title-writeback", () => ({
    writeRecordingTitleToSourceOrThrow: vi.fn(),
    SourceTitleWritebackError: class SourceTitleWritebackError extends Error {
        status: number;

        constructor(message: string, status = 409) {
            super(message);
            this.name = "SourceTitleWritebackError";
            this.status = status;
        }
    },
}));

import { PATCH } from "@/app/api/recordings/[id]/rename/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
    SourceTitleWritebackError,
    writeRecordingTitleToSourceOrThrow,
} from "@/lib/data-sources/source-title-writeback";

function makeRequest(filename: string) {
    return new Request("http://localhost/api/recordings/rec-1/rename", {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename }),
    });
}

function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("manual rename route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
    });

    it("updates the local filename and syncs the renamed title to Plaud when upstream write-back is supported", async () => {
        const where = vi.fn().mockResolvedValue(undefined);
        const set = vi.fn().mockReturnValue({ where });

        (db.select as Mock).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: "rec-1",
                            userId: "user-1",
                            filename: "Old name",
                            sourceProvider: "plaud",
                            sourceRecordingId: "plaud-rec-1",
                        },
                    ]),
                }),
            }),
        });
        (db.update as Mock).mockReturnValue({ set });
        (writeRecordingTitleToSourceOrThrow as Mock).mockResolvedValue(true);

        const response = await PATCH(
            makeRequest("  New better title  "),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(200);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                filename: "New better title",
            }),
        );
        expect(writeRecordingTitleToSourceOrThrow).toHaveBeenCalledWith({
            userId: "user-1",
            recording: expect.objectContaining({
                id: "rec-1",
                sourceProvider: "plaud",
                sourceRecordingId: "plaud-rec-1",
            }),
            title: "New better title",
        });
        await expect(response.json()).resolves.toMatchObject({
            recording: {
                id: "rec-1",
                filename: "New better title",
                sourceProvider: "plaud",
            },
        });
    });

    it("updates the local filename and lets the shared write-back helper no-op for providers without upstream support", async () => {
        const where = vi.fn().mockResolvedValue(undefined);
        const set = vi.fn().mockReturnValue({ where });

        (db.select as Mock).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: "rec-1",
                            userId: "user-1",
                            filename: "Old name",
                            sourceProvider: "ticnote",
                            sourceRecordingId: "source-rec-1",
                        },
                    ]),
                }),
            }),
        });
        (db.update as Mock).mockReturnValue({ set });
        (writeRecordingTitleToSourceOrThrow as Mock).mockResolvedValue(false);

        const response = await PATCH(
            makeRequest("  New better title  "),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(200);
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                filename: "New better title",
            }),
        );
        expect(writeRecordingTitleToSourceOrThrow).toHaveBeenCalledWith({
            userId: "user-1",
            recording: expect.objectContaining({
                id: "rec-1",
                sourceProvider: "ticnote",
                sourceRecordingId: "source-rec-1",
            }),
            title: "New better title",
        });
    });

    it("rejects local rename for sources without local rename capability", async () => {
        (db.select as Mock).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: "rec-1",
                            userId: "user-1",
                            filename: "Old name",
                            sourceProvider: "iflyrec",
                            sourceRecordingId: "iflyrec-1",
                        },
                    ]),
                }),
            }),
        });

        const response = await PATCH(
            makeRequest("  New better title  "),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(400);
        expect(db.update).not.toHaveBeenCalled();
        expect(writeRecordingTitleToSourceOrThrow).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            error: "This source does not support local renaming in BetterAINote",
        });
    });

    it("returns a clear error when upstream title write-back is blocked", async () => {
        (db.select as Mock).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: "rec-1",
                            userId: "user-1",
                            filename: "Old name",
                            sourceProvider: "plaud",
                            sourceRecordingId: "plaud-rec-1",
                        },
                    ]),
                }),
            }),
        });
        (writeRecordingTitleToSourceOrThrow as Mock).mockRejectedValue(
            new SourceTitleWritebackError(
                "This source connection is missing the credentials required for upstream title write-back",
            ),
        );

        const response = await PATCH(
            makeRequest("  New better title  "),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(409);
        expect(db.update).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            error: "This source connection is missing the credentials required for upstream title write-back",
        });
    });
});
