import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const voiceTranscribeMocks = vi.hoisted(() => ({
    constructedConnections: [] as unknown[],
    listVoiceprints: vi.fn(),
}));

vi.mock("@/lib/settings/user-settings", () => ({
    getAuthenticatedUserId: vi.fn(),
}));

vi.mock("@/server/modules/voice-transcribe/access", () => ({
    getVoiceTranscribeAccessForUser: vi.fn(),
}));

vi.mock("@/lib/voice-transcribe/client", () => ({
    VoiceTranscribeClient: vi.fn().mockImplementation(function (
        this: { listVoiceprints: Mock },
        connection,
    ) {
        voiceTranscribeMocks.constructedConnections.push(connection);
        this.listVoiceprints = voiceTranscribeMocks.listVoiceprints;
    }),
    VoiceTranscribeHttpError: class VoiceTranscribeHttpError extends Error {
        status: number;

        constructor(message: string, status: number) {
            super(message);
            this.name = "VoiceTranscribeHttpError";
            this.status = status;
        }
    },
}));

import { POST } from "@/app/api/settings/voscript/test/route";
import { getAuthenticatedUserId } from "@/lib/settings/user-settings";
import {
    VoiceTranscribeClient,
    VoiceTranscribeHttpError,
} from "@/lib/voice-transcribe/client";
import { getVoiceTranscribeAccessForUser } from "@/server/modules/voice-transcribe/access";

function makePostRequest(body: Record<string, unknown>) {
    return new Request("http://localhost/api/settings/voscript/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("VoScript connection test route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        voiceTranscribeMocks.constructedConnections = [];
        voiceTranscribeMocks.listVoiceprints.mockReset();
        (getAuthenticatedUserId as Mock).mockResolvedValue("user-1");
        (getVoiceTranscribeAccessForUser as Mock).mockResolvedValue({
            client: null,
            connection: null,
            reason: "not configured",
        });
    });

    it("requires authentication", async () => {
        (getAuthenticatedUserId as Mock).mockResolvedValue(null);

        const response = await POST(
            makePostRequest({
                privateTranscriptionBaseUrl: "https://voscript.example.test",
            }),
        );

        expect(response.status).toBe(401);
        expect(VoiceTranscribeClient).not.toHaveBeenCalled();
    });

    it("rejects missing or invalid service URLs without testing upstream", async () => {
        const missing = await POST(
            makePostRequest({ privateTranscriptionBaseUrl: "" }),
        );
        const invalid = await POST(
            makePostRequest({
                privateTranscriptionBaseUrl:
                    "https://voscript.example.test?token=secret",
            }),
        );

        expect(missing.status).toBe(400);
        await expect(missing.json()).resolves.toEqual({
            error: "privateTranscriptionBaseUrl is required",
        });
        expect(invalid.status).toBe(400);
        await expect(invalid.json()).resolves.toEqual({
            error: "privateTranscriptionBaseUrl must not include query parameters or fragments",
        });
        expect(VoiceTranscribeClient).not.toHaveBeenCalled();
    });

    it("tests the current form connection without persisting it", async () => {
        voiceTranscribeMocks.listVoiceprints.mockResolvedValue([
            { displayName: "Alex", id: "vp-1" },
            { displayName: "Bo", id: "vp-2" },
        ]);

        const response = await POST(
            makePostRequest({
                privateTranscriptionApiKey: " vt-test-key ",
                privateTranscriptionBaseUrl: " https://voscript.example.test/ ",
            }),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            available: true,
            providerName: "voice-transcribe",
            success: true,
            voiceprintCount: 2,
        });
        expect(voiceTranscribeMocks.constructedConnections).toEqual([
            {
                apiKey: "vt-test-key",
                baseUrl: "https://voscript.example.test",
                providerId: "voscript-test",
                providerName: "voice-transcribe",
            },
        ]);
        expect(getVoiceTranscribeAccessForUser).not.toHaveBeenCalled();
    });

    it("reuses the stored credential client when the saved URL matches and no new key is typed", async () => {
        const storedClient = {
            listVoiceprints: vi
                .fn()
                .mockResolvedValue([
                    { displayName: "Stored", id: "vp-stored" },
                ]),
        };
        (getVoiceTranscribeAccessForUser as Mock).mockResolvedValue({
            client: storedClient,
            connection: {
                baseUrl: "https://voscript.example.test",
                providerName: "voice-transcribe",
            },
            reason: null,
        });

        const response = await POST(
            makePostRequest({
                privateTranscriptionBaseUrl: "https://voscript.example.test",
            }),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            voiceprintCount: 1,
        });
        expect(storedClient.listVoiceprints).toHaveBeenCalledTimes(1);
        expect(VoiceTranscribeClient).not.toHaveBeenCalled();
    });

    it("maps upstream failures to stable public errors", async () => {
        voiceTranscribeMocks.listVoiceprints.mockRejectedValue(
            new VoiceTranscribeHttpError(
                "upstream failed token=secret cookie=session",
                500,
            ),
        );

        const response = await POST(
            makePostRequest({
                privateTranscriptionBaseUrl: "https://voscript.example.test",
            }),
        );

        expect(response.status).toBe(502);
        await expect(response.json()).resolves.toEqual({
            error: "声纹服务暂时不可用，请稍后重试",
        });
    });
});
