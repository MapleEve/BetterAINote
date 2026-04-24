import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: vi.fn(),
        },
    },
}));

vi.mock("@/server/modules/recordings", () => ({
    getRecordingSpeakerMap: vi.fn(),
    updateRecordingSpeakerMap: vi.fn(),
    RecordingSpeakerMapError: class RecordingSpeakerMapError extends Error {
        status: number;

        constructor(message: string, status: number) {
            super(message);
            this.name = "RecordingSpeakerMapError";
            this.status = status;
        }
    },
}));

import { GET, PATCH } from "@/app/api/recordings/[id]/speaker-map/route";
import { auth } from "@/lib/auth";
import {
    getRecordingSpeakerMap,
    RecordingSpeakerMapError,
    updateRecordingSpeakerMap,
} from "@/server/modules/recordings";

function makeRequest(method: string, body?: unknown): Request {
    return new Request("http://localhost/api/recordings/rec-1/speaker-map", {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
}

function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("speaker map route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
    });

    describe("GET /api/recordings/[id]/speaker-map", () => {
        it("returns 401 when not authenticated", async () => {
            (auth.api.getSession as unknown as Mock).mockResolvedValue(null);

            const response = await GET(makeRequest("GET"), makeParams("rec-1"));

            expect(response.status).toBe(401);
            expect(getRecordingSpeakerMap).not.toHaveBeenCalled();
        });

        it("returns the module payload on success", async () => {
            (getRecordingSpeakerMap as Mock).mockResolvedValue({
                speakerMap: { "Speaker 1": "Alice" },
            });

            const response = await GET(makeRequest("GET"), makeParams("rec-1"));

            expect(response.status).toBe(200);
            expect(getRecordingSpeakerMap).toHaveBeenCalledWith(
                "user-1",
                "rec-1",
            );
            await expect(response.json()).resolves.toEqual({
                speakerMap: { "Speaker 1": "Alice" },
            });
        });

        it("maps module errors to stable HTTP responses", async () => {
            (getRecordingSpeakerMap as Mock).mockRejectedValue(
                new RecordingSpeakerMapError("Recording not found", 404),
            );

            const response = await GET(makeRequest("GET"), makeParams("rec-1"));

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: "Recording not found",
            });
        });
    });

    describe("PATCH /api/recordings/[id]/speaker-map", () => {
        it("returns 401 when not authenticated", async () => {
            (auth.api.getSession as unknown as Mock).mockResolvedValue(null);

            const response = await PATCH(
                makeRequest("PATCH", { speakerMap: {} }),
                makeParams("rec-1"),
            );

            expect(response.status).toBe(401);
            expect(updateRecordingSpeakerMap).not.toHaveBeenCalled();
        });

        it("passes the raw speakerMap payload to the module", async () => {
            const speakerMap = { "Speaker 1": "Alice", "Speaker 2": "Bob" };
            (updateRecordingSpeakerMap as Mock).mockResolvedValue({
                success: true,
                speakerMap,
            });

            const response = await PATCH(
                makeRequest("PATCH", { speakerMap }),
                makeParams("rec-1"),
            );

            expect(response.status).toBe(200);
            expect(updateRecordingSpeakerMap).toHaveBeenCalledWith(
                "user-1",
                "rec-1",
                speakerMap,
            );
            await expect(response.json()).resolves.toEqual({
                success: true,
                speakerMap,
            });
        });

        it("maps validation errors to stable HTTP responses", async () => {
            (updateRecordingSpeakerMap as Mock).mockRejectedValue(
                new RecordingSpeakerMapError(
                    "speakerMap must be an object",
                    400,
                ),
            );

            const response = await PATCH(
                makeRequest("PATCH", { speakerMap: null }),
                makeParams("rec-1"),
            );

            expect(response.status).toBe(400);
            await expect(response.json()).resolves.toEqual({
                error: "speakerMap must be an object",
            });
        });
    });
});
