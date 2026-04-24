import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
    auth: {
        api: {
            getSession: vi.fn(),
        },
    },
}));

vi.mock("@/lib/voice-transcribe/service", () => ({
    getVoiceTranscribeAccessForUser: vi.fn(),
}));

vi.mock("@/lib/voice-transcribe/client", () => ({
    VoiceTranscribeHttpError: class VoiceTranscribeHttpError extends Error {
        status: number;

        constructor(message: string, status: number) {
            super(message);
            this.name = "VoiceTranscribeHttpError";
            this.status = status;
        }
    },
}));

import { DELETE, PATCH } from "@/app/api/voiceprints/[id]/route";
import { GET } from "@/app/api/voiceprints/route";
import { auth } from "@/lib/auth";
import { VoiceTranscribeHttpError } from "@/lib/voice-transcribe/client";
import { getVoiceTranscribeAccessForUser } from "@/lib/voice-transcribe/service";

function makeRequest(method: string, body?: unknown) {
    return new Request("http://localhost/api/voiceprints/vp-1", {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
}

function makeParams(id = "vp-1") {
    return { params: Promise.resolve({ id }) };
}

describe("voiceprints routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth.api.getSession as unknown as Mock).mockResolvedValue({
            user: { id: "user-1" },
        });
    });

    it("redacts upstream list errors from public responses", async () => {
        (getVoiceTranscribeAccessForUser as Mock).mockResolvedValue({
            connection: { providerName: "voice-transcribe" },
            client: {
                listVoiceprints: vi
                    .fn()
                    .mockRejectedValue(
                        new VoiceTranscribeHttpError(
                            "upstream 500 token=secret-token cookie=session recording id rec-raw",
                            500,
                        ),
                    ),
            },
        });

        const response = await GET(makeRequest("GET"));

        expect(response.status).toBe(502);
        await expect(response.json()).resolves.toEqual({
            error: "声纹服务暂时不可用，请稍后重试",
        });
    });

    it("redacts upstream rename errors while preserving stable status mapping", async () => {
        (getVoiceTranscribeAccessForUser as Mock).mockResolvedValue({
            client: {
                renameVoiceprint: vi
                    .fn()
                    .mockRejectedValue(
                        new VoiceTranscribeHttpError(
                            "upstream 404 title=Private Meeting token=secret-token",
                            404,
                        ),
                    ),
            },
        });

        const response = await PATCH(
            makeRequest("PATCH", { displayName: "Alex" }),
            makeParams(),
        );

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "未找到对应的声纹，请刷新后重试",
        });
    });

    it("redacts upstream delete errors from public responses", async () => {
        (getVoiceTranscribeAccessForUser as Mock).mockResolvedValue({
            client: {
                deleteVoiceprint: vi
                    .fn()
                    .mockRejectedValue(
                        new VoiceTranscribeHttpError(
                            "upstream 502 org id org_123 cookie=session",
                            502,
                        ),
                    ),
            },
        });

        const response = await DELETE(makeRequest("DELETE"), makeParams());

        expect(response.status).toBe(502);
        await expect(response.json()).resolves.toEqual({
            error: "声纹服务暂时不可用，请稍后重试",
        });
    });
});
