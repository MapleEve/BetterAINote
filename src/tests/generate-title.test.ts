import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const { createCompletionMock, openAIConfigMock } = vi.hoisted(() => {
    const createCompletionMock = vi.fn();
    const openAIConfigMock = vi.fn();

    return {
        createCompletionMock,
        openAIConfigMock,
    };
});

vi.mock("@/db", () => ({
    db: {
        select: vi.fn(),
    },
}));

vi.mock("openai", () => ({
    OpenAI: class MockOpenAI {
        chat = {
            completions: {
                create: createCompletionMock,
            },
        };

        constructor(config: unknown) {
            openAIConfigMock(config);
        }
    },
}));

vi.mock("@/lib/encryption", () => ({
    decrypt: vi.fn((value: string) => `decrypted:${value}`),
}));

import { db } from "@/db";
import { generateTitleFromTranscription } from "@/lib/ai/generate-title";

describe("generateTitleFromTranscription", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses the dedicated title provider config and sanitizes the returned title", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                titleGenerationPrompt: null,
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                titleGenerationBaseUrl:
                                    "https://llm.internal/v1",
                                titleGenerationModel: "gpt-4.1-mini",
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
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

        createCompletionMock.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: '"2026-04-18 1000 Sync: Launch/Checklist?"',
                    },
                },
            ],
        });

        await expect(
            generateTitleFromTranscription(
                "user-1",
                "Discuss launch checklist",
                {
                    recordingDate: "2026-04-18",
                    recordingTime: "1000",
                    currentFilename: "Old Name",
                },
            ),
        ).resolves.toBe("2026-04-18 1000 Sync Launch Checklist");

        expect(openAIConfigMock).toHaveBeenCalledWith({
            apiKey: "decrypted:encrypted:key-1",
            baseURL: "https://llm.internal/v1",
        });
        expect(createCompletionMock).toHaveBeenCalledWith(
            expect.objectContaining({
                model: "gpt-4.1-mini",
            }),
        );
    });

    it("returns null when no dedicated provider is configured", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                titleGenerationPrompt: null,
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                titleGenerationBaseUrl: null,
                                titleGenerationModel: null,
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            });

        await expect(
            generateTitleFromTranscription("user-1", "Release prep items"),
        ).resolves.toBeNull();
        expect(openAIConfigMock).not.toHaveBeenCalled();
    });

    it("returns null when no usable model config exists", async () => {
        (db.select as Mock)
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                titleGenerationPrompt: null,
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([
                            {
                                titleGenerationBaseUrl: null,
                                titleGenerationModel: null,
                            },
                        ]),
                    }),
                }),
            })
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            });

        await expect(
            generateTitleFromTranscription("user-1", "Anything"),
        ).resolves.toBeNull();
        expect(openAIConfigMock).not.toHaveBeenCalled();
    });
});
