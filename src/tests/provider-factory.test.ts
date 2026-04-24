import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/encryption", () => ({
    decrypt: vi.fn().mockReturnValue("decrypted-key"),
}));

import {
    createTranscriptionProvider,
    inferProviderType,
} from "@/lib/transcription/providers/factory";

describe("createTranscriptionProvider", () => {
    it("creates an OpenAI provider without base URL", () => {
        const provider = createTranscriptionProvider("openai", "api-key");
        expect(provider).toBeDefined();
        expect(typeof provider.transcribe).toBe("function");
    });

    it("creates a LiteLLM provider with base URL", () => {
        const provider = createTranscriptionProvider(
            "litellm",
            "api-key",
            "http://litellm.local/v1",
        );
        expect(provider).toBeDefined();
        expect(typeof provider.transcribe).toBe("function");
    });

    it("throws when creating LiteLLM provider without base URL", () => {
        expect(() => createTranscriptionProvider("litellm", "api-key")).toThrow(
            "LiteLLM provider requires a base URL",
        );
    });

    it("creates an Azure provider with base URL", () => {
        const provider = createTranscriptionProvider(
            "azure",
            "api-key",
            "https://my-resource.openai.azure.com",
        );
        expect(provider).toBeDefined();
        expect(typeof provider.transcribe).toBe("function");
    });

    it("throws when creating Azure provider without base URL", () => {
        expect(() => createTranscriptionProvider("azure", "api-key")).toThrow(
            "Azure provider requires a base URL",
        );
    });

    it("creates a local provider with base URL", () => {
        const provider = createTranscriptionProvider(
            "local",
            "api-key",
            "http://localhost:8300/v1",
        );
        expect(provider).toBeDefined();
        expect(typeof provider.transcribe).toBe("function");
    });

    it("creates a Google Speech provider", () => {
        process.env.GOOGLE_PROJECT_ID = "test-project";
        try {
            const provider = createTranscriptionProvider("google", "api-key");
            expect(provider).toBeDefined();
            expect(typeof provider.transcribe).toBe("function");
        } finally {
            delete process.env.GOOGLE_PROJECT_ID;
        }
    });

    it("creates a voice-transcribe provider with base URL", () => {
        const provider = createTranscriptionProvider(
            "voice-transcribe",
            "",
            "http://transcribe.internal:8780",
        );
        expect(provider).toBeDefined();
        expect(typeof provider.transcribe).toBe("function");
    });

    it("falls back to OpenAI for unknown provider types", () => {
        // The default case returns OpenAI provider
        const provider = createTranscriptionProvider(
            "openai",
            "api-key",
            undefined,
        );
        expect(provider).toBeDefined();
    });
});

describe("inferProviderType", () => {
    it("infers azure from provider name", () => {
        expect(inferProviderType("azure")).toBe("azure");
        expect(inferProviderType("Azure OpenAI")).toBe("azure");
    });

    it("infers google from provider name", () => {
        expect(inferProviderType("google speech")).toBe("google");
        expect(inferProviderType("Google")).toBe("google");
    });

    it("infers litellm from provider name", () => {
        expect(inferProviderType("litellm")).toBe("litellm");
        expect(inferProviderType("LiteLLM Proxy")).toBe("litellm");
    });

    it("infers local from non-openai base URL", () => {
        expect(inferProviderType("openai", "http://localhost:8300/v1")).toBe(
            "local",
        );
    });

    it("infers voice-transcribe from provider name", () => {
        expect(inferProviderType("voice-transcribe")).toBe("voice-transcribe");
        expect(inferProviderType("private-transcription")).toBe(
            "voice-transcribe",
        );
    });

    it("infers openai as default", () => {
        expect(inferProviderType("openai")).toBe("openai");
        expect(inferProviderType("openai", "https://api.openai.com/v1")).toBe(
            "openai",
        );
    });
});
