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

vi.mock("@/lib/ai/generate-title", () => ({
    generateTitleFromTranscription: vi.fn(),
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

import { POST } from "@/app/api/recordings/[id]/rename/auto/route";
import { db } from "@/db";
import { generateTitleFromTranscription } from "@/lib/ai/generate-title";
import { auth } from "@/lib/auth";
import {
    SourceTitleWritebackError,
    writeRecordingTitleToSourceOrThrow,
} from "@/lib/data-sources/source-title-writeback";

vi.spyOn(console, "error").mockImplementation(() => undefined);

function makeRequest() {
    return new Request("http://localhost/api/recordings/rec-1/rename/auto", {
        method: "POST",
    });
}

function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("AI rename route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
    });

    it("rejects AI rename when no transcript exists", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                userId: "user-1",
                                filename: "Call",
                                startTime: new Date("2026-04-18T10:00:00.000Z"),
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            });

        const response = await POST(makeRequest(), makeParams("rec-1"));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "No transcript available for AI rename",
        });
    });

    it("updates the filename and syncs the generated title back to the source when upstream write-back is supported", async () => {
        const set = vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
        });

        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                userId: "user-1",
                                filename: "Call",
                                sourceProvider: "plaud",
                                sourceRecordingId: "plaud-rec-1",
                                startTime: new Date("2026-04-18T10:00:00.000Z"),
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                text: "Speaker 1: Discuss launch checklist",
                            },
                        ]),
                    }),
                }),
            });

        (db.update as Mock).mockReturnValue({
            set,
        });
        (generateTitleFromTranscription as Mock).mockResolvedValue(
            "2026-04-18 1000 Sync LaunchChecklist",
        );
        (writeRecordingTitleToSourceOrThrow as Mock).mockResolvedValue(true);

        const response = await POST(makeRequest(), makeParams("rec-1"));

        expect(response.status).toBe(200);
        expect(generateTitleFromTranscription).toHaveBeenCalled();
        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                filename: "2026-04-18 1000 Sync LaunchChecklist",
            }),
        );
        expect(writeRecordingTitleToSourceOrThrow).toHaveBeenCalledWith({
            userId: "user-1",
            recording: expect.objectContaining({
                id: "rec-1",
                sourceProvider: "plaud",
                sourceRecordingId: "plaud-rec-1",
            }),
            title: "2026-04-18 1000 Sync LaunchChecklist",
        });
        await expect(response.json()).resolves.toEqual({
            filename: "2026-04-18 1000 Sync LaunchChecklist",
        });
    });

    it("returns the generated filename and lets the shared write-back helper no-op for providers without upstream support", async () => {
        const set = vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
        });

        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                userId: "user-1",
                                filename: "Call",
                                sourceProvider: "ticnote",
                                sourceRecordingId: "source-rec-1",
                                startTime: new Date("2026-04-18T10:00:00.000Z"),
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                text: "Speaker 1: Discuss launch checklist",
                            },
                        ]),
                    }),
                }),
            });

        (db.update as Mock).mockReturnValue({ set });
        (generateTitleFromTranscription as Mock).mockResolvedValue(
            "2026-04-18 1000 Sync LaunchChecklist",
        );
        (writeRecordingTitleToSourceOrThrow as Mock).mockResolvedValue(false);

        const response = await POST(makeRequest(), makeParams("rec-1"));

        expect(response.status).toBe(200);
        expect(writeRecordingTitleToSourceOrThrow).toHaveBeenCalledWith({
            userId: "user-1",
            recording: expect.objectContaining({
                id: "rec-1",
                sourceProvider: "ticnote",
                sourceRecordingId: "source-rec-1",
            }),
            title: "2026-04-18 1000 Sync LaunchChecklist",
        });
        await expect(response.json()).resolves.toEqual({
            filename: "2026-04-18 1000 Sync LaunchChecklist",
        });
    });

    it("rejects AI rename for sources without local rename capability", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: "rec-1",
                            userId: "user-1",
                            filename: "Call",
                            sourceProvider: "iflyrec",
                            sourceRecordingId: "iflyrec-1",
                            startTime: new Date("2026-04-18T10:00:00.000Z"),
                        },
                    ]),
                }),
            }),
        });

        const response = await POST(makeRequest(), makeParams("rec-1"));

        expect(response.status).toBe(400);
        expect(generateTitleFromTranscription).not.toHaveBeenCalled();
        expect(writeRecordingTitleToSourceOrThrow).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toEqual({
            error: "This source does not support local renaming in BetterAINote",
        });
    });

    it("returns a clear error when upstream title write-back is blocked", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                id: "rec-1",
                                userId: "user-1",
                                filename: "Call",
                                sourceProvider: "plaud",
                                sourceRecordingId: "plaud-rec-1",
                                startTime: new Date("2026-04-18T10:00:00.000Z"),
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                text: "Speaker 1: Discuss launch checklist",
                            },
                        ]),
                    }),
                }),
            });

        (generateTitleFromTranscription as Mock).mockResolvedValue(
            "2026-04-18 1000 Sync LaunchChecklist",
        );
        (writeRecordingTitleToSourceOrThrow as Mock).mockRejectedValue(
            new SourceTitleWritebackError(
                "This recording is not linked to an upstream source entry that can accept title write-back",
            ),
        );

        const response = await POST(makeRequest(), makeParams("rec-1"));

        expect(response.status).toBe(409);
        expect(db.update).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toEqual({
            error: "This recording is not linked to an upstream source entry that can accept title write-back",
        });
    });
});
