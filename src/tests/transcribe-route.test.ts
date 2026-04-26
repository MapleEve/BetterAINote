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

vi.mock("@/lib/transcription/jobs", () => ({
    enqueueTranscriptionJobs: vi.fn(),
    getTranscriptionJobForRecording: vi.fn(),
    hasTranscriptionCapability: vi.fn(),
    serializeTranscriptionJob: vi.fn((job: unknown) => job),
}));

vi.mock("@/server/modules/recordings/ownership", () => ({
    findOwnedRecording: vi.fn(),
}));

import { GET, POST } from "@/app/api/recordings/[id]/transcribe/route";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
    enqueueTranscriptionJobs,
    getTranscriptionJobForRecording,
    hasTranscriptionCapability,
} from "@/lib/transcription/jobs";
import { findOwnedRecording } from "@/server/modules/recordings/ownership";

function makeRequest(
    methodOrBody: string | Record<string, unknown> = "POST",
    body?: Record<string, unknown>,
) {
    const method = typeof methodOrBody === "string" ? methodOrBody : "POST";
    const requestBody = typeof methodOrBody === "string" ? body : methodOrBody;

    return new Request("http://localhost/api/recordings/rec-1/transcribe", {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "GET" ? undefined : JSON.stringify(requestBody ?? {}),
    });
}

function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("Transcribe route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
        (findOwnedRecording as Mock).mockResolvedValue({
            id: "rec-1",
            storagePath: "user-1/recordings/rec-1.mp3",
            sourceProvider: "plaud",
        });
    });

    it("returns the current transcription state for an owned recording", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            text: "Speaker 1: Hello",
                            detectedLanguage: "en",
                            transcriptionType: "private",
                            provider: "voice-transcribe",
                            model: "vt-1",
                            speakerMap: { "Speaker 1": "Alex" },
                            createdAt: new Date("2026-04-18T10:05:00.000Z"),
                        },
                    ]),
                }),
            }),
        });
        (getTranscriptionJobForRecording as Mock).mockResolvedValue({
            id: "job-1",
            status: "succeeded",
        });

        const response = await GET(makeRequest("GET"), makeParams("rec-1"));

        expect(response.status).toBe(200);
        expect(findOwnedRecording).toHaveBeenCalledWith("user-1", "rec-1", {
            id: expect.anything(),
            storagePath: expect.anything(),
            sourceProvider: expect.anything(),
        });
        await expect(response.json()).resolves.toMatchObject({
            transcript: {
                text: "Speaker 1: Hello",
                detectedLanguage: "en",
                transcriptionType: "private",
                provider: "voice-transcribe",
                model: "vt-1",
                speakerMap: { "Speaker 1": "Alex" },
                createdAt: "2026-04-18T10:05:00.000Z",
            },
            job: {
                id: "job-1",
                status: "succeeded",
            },
        });
    });

    it("returns 404 from GET when the recording does not belong to the user", async () => {
        (findOwnedRecording as Mock).mockResolvedValueOnce(null);

        const response = await GET(makeRequest("GET"), makeParams("rec-1"));

        expect(response.status).toBe(404);
        expect(db.select).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            error: "Recording not found",
        });
    });

    it("rejects GET for sources that do not support local private transcription", async () => {
        (findOwnedRecording as Mock).mockResolvedValueOnce({
            id: "rec-1",
            storagePath: "user-1/iflyrec/rec-1.mp3",
            sourceProvider: "iflyrec",
        });

        const response = await GET(makeRequest("GET"), makeParams("rec-1"));

        expect(response.status).toBe(400);
        expect(db.select).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            error: "This source does not support local private transcription in BetterAINote",
        });
    });

    it("returns an existing transcript without queueing a new job", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            text: "Speaker 1: Hello",
                            detectedLanguage: "en",
                            transcriptionType: "private",
                            provider: "voice-transcribe",
                            model: "vt-1",
                            speakerMap: { "Speaker 1": "Alex" },
                            createdAt: new Date("2026-04-18T10:05:00.000Z"),
                        },
                    ]),
                }),
            }),
        });

        (hasTranscriptionCapability as Mock).mockResolvedValue(true);
        (getTranscriptionJobForRecording as Mock).mockResolvedValue({
            id: "job-1",
            status: "succeeded",
        });

        const response = await POST(makeRequest(), makeParams("rec-1"));

        expect(response.status).toBe(200);
        expect(enqueueTranscriptionJobs).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            queued: false,
            job: {
                id: "job-1",
                status: "succeeded",
            },
        });
    });

    it("returns 404 when the recording does not belong to the user", async () => {
        (findOwnedRecording as Mock).mockResolvedValueOnce(null);

        const response = await POST(makeRequest(), makeParams("rec-1"));

        expect(response.status).toBe(404);
        expect(enqueueTranscriptionJobs).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            error: "Recording not found",
        });
    });

    it("queues a transcription job instead of transcribing inline", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                }),
            }),
        });

        (hasTranscriptionCapability as Mock).mockResolvedValue(true);
        (enqueueTranscriptionJobs as Mock).mockResolvedValue({ queued: 1 });
        (getTranscriptionJobForRecording as Mock).mockResolvedValue({
            id: "job-2",
            status: "pending",
            force: true,
        });

        const response = await POST(
            makeRequest({ force: true }),
            makeParams("rec-1"),
        );

        expect(response.status).toBe(202);
        expect(enqueueTranscriptionJobs).toHaveBeenCalledWith(
            "user-1",
            ["rec-1"],
            { force: true },
        );
        await expect(response.json()).resolves.toMatchObject({
            queued: true,
            job: {
                id: "job-2",
                status: "pending",
                force: true,
            },
        });
    });

    it("rejects sources that do not support local private transcription", async () => {
        (findOwnedRecording as Mock).mockResolvedValueOnce({
            id: "rec-1",
            storagePath: "user-1/iflyrec/rec-1.mp3",
            sourceProvider: "iflyrec",
        });

        const response = await POST(makeRequest(), makeParams("rec-1"));

        expect(response.status).toBe(400);
        expect(enqueueTranscriptionJobs).not.toHaveBeenCalled();
        await expect(response.json()).resolves.toMatchObject({
            error: "This source does not support local private transcription in BetterAINote",
        });
    });
});
