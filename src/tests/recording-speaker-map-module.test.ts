import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("@/server/modules/recordings/ownership", () => ({
    findOwnedRecording: vi.fn(),
}));

import { db } from "@/db";
import { findOwnedRecording } from "@/server/modules/recordings/ownership";
import {
    getRecordingSpeakerMap,
    RecordingSpeakerMapError,
    updateRecordingSpeakerMap,
} from "@/server/modules/recordings/speaker-map";

function mockSelectResult(result: unknown[]) {
    (db.select as Mock).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(result),
            }),
        }),
    });
}

describe("recording speaker-map module", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (findOwnedRecording as Mock).mockResolvedValue({ id: "rec-1" });
    });

    describe("getRecordingSpeakerMap", () => {
        it("throws 404 when the recording is not owned by the user", async () => {
            (findOwnedRecording as Mock).mockResolvedValueOnce(null);

            await expect(
                getRecordingSpeakerMap("user-1", "rec-1"),
            ).rejects.toMatchObject({
                message: "Recording not found",
                status: 404,
            });

            expect(db.select).not.toHaveBeenCalled();
        });

        it("returns null when no transcription exists", async () => {
            mockSelectResult([]);

            await expect(
                getRecordingSpeakerMap("user-1", "rec-1"),
            ).resolves.toEqual({
                speakerMap: null,
            });
        });

        it("returns the persisted speaker map", async () => {
            mockSelectResult([{ speakerMap: { "Speaker 1": "Alice" } }]);

            await expect(
                getRecordingSpeakerMap("user-1", "rec-1"),
            ).resolves.toEqual({
                speakerMap: { "Speaker 1": "Alice" },
            });
        });
    });

    describe("updateRecordingSpeakerMap", () => {
        it("rejects null speakerMap", async () => {
            await expect(
                updateRecordingSpeakerMap("user-1", "rec-1", null),
            ).rejects.toEqual(
                expect.objectContaining({
                    message: "speakerMap must be an object",
                    status: 400,
                }),
            );
        });

        it("rejects array speakerMap payloads", async () => {
            await expect(
                updateRecordingSpeakerMap("user-1", "rec-1", ["Alice"]),
            ).rejects.toEqual(
                expect.objectContaining({
                    message: "speakerMap must be an object",
                    status: 400,
                }),
            );
        });

        it("rejects speaker names longer than 100 characters", async () => {
            await expect(
                updateRecordingSpeakerMap("user-1", "rec-1", {
                    "Speaker 1": "A".repeat(101),
                }),
            ).rejects.toEqual(
                expect.objectContaining({
                    message: "Speaker names must be 100 characters or fewer",
                    status: 400,
                }),
            );
        });

        it("throws 404 when the recording is not owned by the user", async () => {
            (findOwnedRecording as Mock).mockResolvedValueOnce(null);

            await expect(
                updateRecordingSpeakerMap("user-1", "rec-1", {
                    "Speaker 1": "Alice",
                }),
            ).rejects.toEqual(
                expect.objectContaining({
                    message: "Recording not found",
                    status: 404,
                }),
            );

            expect(db.select).not.toHaveBeenCalled();
        });

        it("throws 404 when no transcription exists", async () => {
            mockSelectResult([]);

            await expect(
                updateRecordingSpeakerMap("user-1", "rec-1", {
                    "Speaker 1": "Alice",
                }),
            ).rejects.toEqual(
                expect.objectContaining({
                    message: "No transcription found for this recording",
                    status: 404,
                }),
            );
        });

        it("updates the speaker map and returns a stable payload", async () => {
            const speakerMap = {
                "Speaker 1": "Alice",
                "Speaker 2": "Bob",
            };
            const set = vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined),
            });

            mockSelectResult([{ id: "trans-1" }]);
            (db.update as Mock).mockReturnValue({
                set,
            });

            await expect(
                updateRecordingSpeakerMap("user-1", "rec-1", speakerMap),
            ).resolves.toEqual({
                success: true,
                speakerMap,
            });

            expect(set).toHaveBeenCalledWith({ speakerMap });
        });

        it("accepts an empty speaker map to clear names", async () => {
            const set = vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined),
            });

            mockSelectResult([{ id: "trans-1" }]);
            (db.update as Mock).mockReturnValue({
                set,
            });

            await expect(
                updateRecordingSpeakerMap("user-1", "rec-1", {}),
            ).resolves.toEqual({
                success: true,
                speakerMap: {},
            });
        });
    });

    it("keeps the exported error type stable", () => {
        const error = new RecordingSpeakerMapError("boom", 500);

        expect(error).toBeInstanceOf(Error);
        expect(error.status).toBe(500);
        expect(error.name).toBe("RecordingSpeakerMapError");
    });
});
