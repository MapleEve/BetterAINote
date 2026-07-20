import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type Mock,
    vi,
} from "vitest";

const voiceTranscribeMocks = vi.hoisted(() => ({
    testVoiceTranscribeConnectionForUser: vi.fn(),
}));

vi.mock("@/lib/settings/user-settings", () => ({
    getAuthenticatedUserId: vi.fn(),
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

vi.mock("@/server/modules/voice-transcribe/connection-test", () => ({
    testVoiceTranscribeConnectionForUser:
        voiceTranscribeMocks.testVoiceTranscribeConnectionForUser,
}));

import { POST } from "@/app/api/settings/voscript/test/route";
import { getAuthenticatedUserId } from "@/lib/settings/user-settings";
import { VoiceTranscribeHttpError } from "@/lib/voice-transcribe/client";
import { testVoiceTranscribeConnectionForUser } from "@/server/modules/voice-transcribe/connection-test";

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
        voiceTranscribeMocks.testVoiceTranscribeConnectionForUser.mockReset();
        (getAuthenticatedUserId as Mock).mockResolvedValue("user-1");
        voiceTranscribeMocks.testVoiceTranscribeConnectionForUser.mockResolvedValue(
            {
                available: true,
                providerName: "voice-transcribe",
                success: true,
                voiceprintCount: 0,
            },
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("requires authentication", async () => {
        (getAuthenticatedUserId as Mock).mockResolvedValue(null);

        const response = await POST(
            makePostRequest({
                privateTranscriptionBaseUrl: "https://voscript.example.test",
            }),
        );

        expect(response.status).toBe(401);
        expect(testVoiceTranscribeConnectionForUser).not.toHaveBeenCalled();
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
        expect(testVoiceTranscribeConnectionForUser).not.toHaveBeenCalled();
    });

    it("delegates the sanitized current form connection test without persisting it", async () => {
        voiceTranscribeMocks.testVoiceTranscribeConnectionForUser.mockResolvedValue(
            {
                available: true,
                providerName: "voice-transcribe",
                success: true,
                voiceprintCount: 2,
            },
        );

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
        expect(testVoiceTranscribeConnectionForUser).toHaveBeenCalledWith({
            apiKey: "vt-test-key",
            baseUrl: "https://voscript.example.test",
            userId: "user-1",
        });
    });

    it("maps upstream failures to stable public errors", async () => {
        const consoleError = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        voiceTranscribeMocks.testVoiceTranscribeConnectionForUser.mockRejectedValue(
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
        expect(consoleError).toHaveBeenCalledWith(
            "VoScript connection test failed",
            {
                name: "VoiceTranscribeHttpError",
                status: 500,
            },
        );
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            "token=secret",
        );
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            "cookie=session",
        );
    });
});
