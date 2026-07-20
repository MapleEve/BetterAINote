import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const voiceTranscribeMocks = vi.hoisted(() => ({
    constructedConnections: [] as unknown[],
    listVoiceprints: vi.fn(),
}));

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
    },
}));

vi.mock("@/lib/encryption", () => ({
    decrypt: vi.fn((value: string) => `decrypted:${value}`),
}));

vi.mock("@/lib/voice-transcribe/client", () => ({
    VoiceTranscribeClient: vi.fn().mockImplementation(function (
        this: { listVoiceprints: Mock },
        connection,
    ) {
        voiceTranscribeMocks.constructedConnections.push(connection);
        this.listVoiceprints = voiceTranscribeMocks.listVoiceprints;
    }),
}));

import { db } from "@/db";
import { getVoiceTranscribeAccessForUser } from "@/server/modules/voice-transcribe/access";
import { testVoiceTranscribeConnectionForUser } from "@/server/modules/voice-transcribe/connection-test";

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
        voiceTranscribeMocks.constructedConnections = [];
        voiceTranscribeMocks.listVoiceprints.mockReset();
    });

    it("uses the stored VoScript credential for the configured service URL", async () => {
        (db.select as Mock)
            .mockReturnValueOnce(
                mockWhereLimitSelect([
                    {
                        privateTranscriptionBaseUrl:
                            "http://transcribe.example.test:8780",
                    },
                ]),
            )
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        id: "cred-1",
                        provider: "private-transcription",
                        apiKey: "encrypted:secret",
                        baseUrl: "http://transcribe.example.test:8780",
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
            baseUrl: "http://transcribe.example.test:8780",
            apiKey: "decrypted:encrypted:secret",
        });
        expect(result.client).not.toBeNull();
    });

    it("tests a current form connection with a temporary client instead of persisted credentials", async () => {
        voiceTranscribeMocks.listVoiceprints.mockResolvedValue([
            { displayName: "Alex", id: "vp-1" },
            { displayName: "Bo", id: "vp-2" },
        ]);

        const result = await testVoiceTranscribeConnectionForUser({
            apiKey: "vt-test-key",
            baseUrl: "https://voscript.example.test",
            userId: "user-1",
        });

        expect(result).toEqual({
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
        expect(db.select).not.toHaveBeenCalled();
    });

    it("reuses the stored credential client when the saved URL matches and no new key is typed", async () => {
        voiceTranscribeMocks.listVoiceprints.mockResolvedValue([
            { displayName: "Stored", id: "vp-stored" },
        ]);
        (db.select as Mock)
            .mockReturnValueOnce(
                mockWhereLimitSelect([
                    {
                        privateTranscriptionBaseUrl:
                            "https://voscript.example.test",
                    },
                ]),
            )
            .mockReturnValueOnce(
                mockWhereSelect([
                    {
                        id: "cred-1",
                        provider: "private-transcription",
                        apiKey: "encrypted:secret",
                        baseUrl: "https://voscript.example.test",
                        defaultModel: null,
                        isDefaultTranscription: false,
                    },
                ]),
            );

        const result = await testVoiceTranscribeConnectionForUser({
            apiKey: null,
            baseUrl: "https://voscript.example.test",
            userId: "user-1",
        });

        expect(result).toMatchObject({
            success: true,
            voiceprintCount: 1,
        });
        expect(voiceTranscribeMocks.constructedConnections).toEqual([
            {
                apiKey: "decrypted:encrypted:secret",
                baseUrl: "https://voscript.example.test",
                providerId: "cred-1",
                providerName: "private-transcription",
            },
        ]);
        expect(voiceTranscribeMocks.listVoiceprints).toHaveBeenCalledTimes(1);
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
                        baseUrl: "http://remote.example.test:9000",
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
            baseUrl: "http://remote.example.test:9000",
            apiKey: "decrypted:encrypted:provider-secret",
        });
        expect(result.client).not.toBeNull();
    });
});
