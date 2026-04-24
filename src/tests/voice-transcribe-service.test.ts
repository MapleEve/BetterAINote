import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
    },
}));

vi.mock("@/lib/encryption", () => ({
    decrypt: vi.fn((value: string) => `decrypted:${value}`),
}));

import { db } from "@/db";
import { getVoiceTranscribeAccessForUser } from "@/lib/voice-transcribe/service";

function mockWhereLimitSelect(value: unknown) {
    return {
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(value),
            }),
        }),
    };
}

function mockWhereSelect(value: unknown) {
    return {
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(value),
        }),
    };
}

describe("voice-transcribe service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses the stored VoScript credential for the configured service URL", async () => {
        (db.select as Mock)
            .mockReturnValueOnce(
                mockWhereLimitSelect([
                    {
                        privateTranscriptionBaseUrl:
                            "http://transcribe.internal:8780",
                    },
                ]),
            )
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        id: "cred-1",
                        provider: "private-transcription",
                        apiKey: "encrypted:secret",
                        baseUrl: "http://transcribe.internal:8780",
                        defaultModel: null,
                        isDefaultTranscription: false,
                    },
                ]),
            );

        const result = await getVoiceTranscribeAccessForUser("user-1");

        expect(result.reason).toBeNull();
        expect(result.connection).toMatchObject({
            providerId: "cred-1",
            providerName: "private-transcription",
            baseUrl: "http://transcribe.internal:8780",
            apiKey: "decrypted:encrypted:secret",
        });
        expect(result.client).not.toBeNull();
    });

    it("falls back to the default voice-transcribe provider when no VoScript URL is configured", async () => {
        (db.select as Mock)
            .mockReturnValueOnce(mockWhereLimitSelect([]))
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        id: "cred-2",
                        provider: "voice-transcribe",
                        apiKey: "encrypted:provider-secret",
                        baseUrl: "http://remote.internal:9000",
                        defaultModel: null,
                        isDefaultTranscription: true,
                    },
                ]),
            );

        const result = await getVoiceTranscribeAccessForUser("user-1");

        expect(result.reason).toBeNull();
        expect(result.connection).toMatchObject({
            providerId: "cred-2",
            providerName: "voice-transcribe",
            baseUrl: "http://remote.internal:9000",
            apiKey: "decrypted:encrypted:provider-secret",
        });
        expect(result.client).not.toBeNull();
    });
});
