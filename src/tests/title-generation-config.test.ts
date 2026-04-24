import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
    },
}));

vi.mock("@/lib/encryption", () => ({
    decrypt: vi.fn((value: string) => `decrypted:${value}`),
    encrypt: vi.fn((value: string) => `encrypted:${value}`),
}));

import { db } from "@/db";
import {
    getDecryptedTitleGenerationProviderConfig,
    getTitleGenerationProviderSettingsResponse,
} from "@/lib/ai/title-generation-config";

describe("title-generation-config", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns a settings-safe response from explicit non-secret fields", () => {
        expect(
            getTitleGenerationProviderSettingsResponse(
                {
                    titleGenerationBaseUrl: " https://llm.internal/v1/ ",
                    titleGenerationModel: " gpt-4.1-mini ",
                },
                true,
            ),
        ).toEqual({
            titleGenerationBaseUrl: "https://llm.internal/v1/",
            titleGenerationModel: "gpt-4.1-mini",
            titleGenerationApiKeySet: true,
        });
    });

    it("decrypts the stored secret from api_credentials while reading explicit fields from user_settings", async () => {
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            titleGenerationBaseUrl: "https://llm.internal/v1",
                            titleGenerationModel: "gpt-4.1-mini",
                        },
                    ]),
                }),
            }),
        });
        (db.select as Mock).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                        {
                            id: "cred-1",
                            apiKey: "encrypted:key-1",
                        },
                    ]),
                }),
            }),
        });

        await expect(
            getDecryptedTitleGenerationProviderConfig("user-1"),
        ).resolves.toEqual({
            baseUrl: "https://llm.internal/v1",
            model: "gpt-4.1-mini",
            apiKey: "decrypted:encrypted:key-1",
        });
    });
});
