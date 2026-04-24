import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: vi.fn(),
        },
    },
}));

vi.mock("@/server/modules/recordings", () => ({
    getRecordingSpeakersReview: vi.fn(),
    updateRecordingSpeakerReview: vi.fn(),
    RecordingSpeakersError: class RecordingSpeakersError extends Error {
        status: number;

        constructor(message: string, status: number) {
            super(message);
            this.name = "RecordingSpeakersError";
            this.status = status;
        }
    },
}));

import { GET, PATCH } from "@/app/api/recordings/[id]/speakers/route";
import { auth } from "@/lib/auth";
import {
    getRecordingSpeakersReview,
    RecordingSpeakersError,
    updateRecordingSpeakerReview,
} from "@/server/modules/recordings";

vi.spyOn(console, "error").mockImplementation(() => undefined);

function makeRequest(method = "GET", body?: unknown) {
    return new Request("http://localhost/api/recordings/rec-1/speakers", {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
}

function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("Recording speakers route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
    });

    it("returns 401 when unauthenticated", async () => {
        (auth.api.getSession as unknown as Mock).mockResolvedValue(null);

        const response = await GET(makeRequest("GET"), makeParams("rec-1"));

        expect(response.status).toBe(401);
    });

    it("returns the module payload with no-store headers", async () => {
        (getRecordingSpeakersReview as Mock).mockResolvedValue({
            recordingId: "rec-1",
            reviewBasis: "private-transcript",
            rawTranscriptUrl: "/api/recordings/rec-1/transcript/raw",
            speakerTranscriptUrl: "/api/recordings/rec-1/transcript/speakers",
            speakers: [],
            profiles: [],
        });

        const response = await GET(makeRequest("GET"), makeParams("rec-1"));

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        expect(getRecordingSpeakersReview).toHaveBeenCalledWith(
            "user-1",
            "rec-1",
        );
        await expect(response.json()).resolves.toEqual({
            recordingId: "rec-1",
            reviewBasis: "private-transcript",
            rawTranscriptUrl: "/api/recordings/rec-1/transcript/raw",
            speakerTranscriptUrl: "/api/recordings/rec-1/transcript/speakers",
            speakers: [],
            profiles: [],
        });
    });

    it("maps module errors to stable GET responses", async () => {
        (getRecordingSpeakersReview as Mock).mockRejectedValue(
            new RecordingSpeakersError("Recording not found", 404),
        );

        const response = await GET(makeRequest("GET"), makeParams("rec-1"));

        expect(response.status).toBe(404);
        const json = await response.json();
        expect(json.error).toBe("Recording not found");
    });

    it("clears a matched profile when PATCH receives neither profileId nor profileName", async () => {
        (updateRecordingSpeakerReview as Mock).mockResolvedValue({
            success: true,
            rawLabel: "SPEAKER_01",
            profileId: null,
            voiceprintRef: null,
        });

        const response = await PATCH(
            makeRequest("PATCH", { rawLabel: "SPEAKER_01" }),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(200);
        expect(updateRecordingSpeakerReview).toHaveBeenCalledWith(
            "user-1",
            "rec-1",
            { rawLabel: "SPEAKER_01" },
        );
        await expect(response.json()).resolves.toEqual({
            success: true,
            rawLabel: "SPEAKER_01",
            profileId: null,
            voiceprintRef: null,
        });
    });

    it("returns 400 when PATCH receives an empty JSON body", async () => {
        const response = await PATCH(makeRequest("PATCH"), makeParams("rec-1"));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "Request body must be valid JSON",
        });
        expect(updateRecordingSpeakerReview).not.toHaveBeenCalled();
    });

    it("creates a new speaker profile and enrolls the remote voiceprint", async () => {
        (updateRecordingSpeakerReview as Mock).mockResolvedValue({
            success: true,
            rawLabel: "SPEAKER_01",
            profileId: "profile-2",
            voiceprintRef: "vp-2",
        });

        const response = await PATCH(
            makeRequest("PATCH", {
                rawLabel: "SPEAKER_01",
                profileName: "Taylor",
            }),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(200);
        expect(updateRecordingSpeakerReview).toHaveBeenCalledWith(
            "user-1",
            "rec-1",
            {
                rawLabel: "SPEAKER_01",
                profileName: "Taylor",
            },
        );
        await expect(response.json()).resolves.toEqual({
            success: true,
            rawLabel: "SPEAKER_01",
            profileId: "profile-2",
            voiceprintRef: "vp-2",
        });
    });

    it("maps module errors to stable PATCH responses", async () => {
        (updateRecordingSpeakerReview as Mock).mockRejectedValue(
            new RecordingSpeakersError("rawLabel is required", 400),
        );

        const response = await PATCH(
            makeRequest("PATCH", { rawLabel: " " }),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: "rawLabel is required",
        });
    });
});
