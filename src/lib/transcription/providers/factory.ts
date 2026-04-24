import { AzureTranscriptionProvider } from "./azure-provider";
import { GoogleSpeechTranscriptionProvider } from "./google-speech-provider";
import { LiteLLMTranscriptionProvider } from "./litellm-provider";
import { OpenAITranscriptionProvider } from "./openai-provider";
import type { ProviderType, TranscriptionProvider } from "./types";
import { VoiceTranscribeProvider } from "./voice-transcribe-provider";

export function createTranscriptionProvider(
    providerType: ProviderType,
    apiKey: string,
    baseURL?: string,
): TranscriptionProvider {
    switch (providerType) {
        case "azure":
            if (!baseURL) throw new Error("Azure provider requires a base URL");
            return new AzureTranscriptionProvider(apiKey, baseURL);
        case "litellm":
            if (!baseURL)
                throw new Error("LiteLLM provider requires a base URL");
            return new LiteLLMTranscriptionProvider(apiKey, baseURL);
        case "local":
            if (!baseURL) throw new Error("Local provider requires a base URL");
            // Use fetch/FormData-based path for local OpenAI-compatible services
            // to keep behavior consistent with LiteLLM and support diarization fallback.
            return new LiteLLMTranscriptionProvider(apiKey, baseURL);
        case "google":
            return new GoogleSpeechTranscriptionProvider(apiKey, baseURL);
        case "voice-transcribe":
            if (!baseURL) {
                throw new Error(
                    "Voice-transcribe provider requires a base URL",
                );
            }
            return new VoiceTranscribeProvider(baseURL, apiKey || null);
        default:
            return new OpenAITranscriptionProvider(apiKey, baseURL);
    }
}

/**
 * Infer provider type from provider name and base URL.
 * Used for backward compatibility with existing api_credentials rows
 * that don't have an explicit provider_type column yet.
 */
export function inferProviderType(
    provider: string,
    baseUrl?: string | null,
): ProviderType {
    const p = provider.toLowerCase();
    if (p.includes("google") || p.includes("gemini")) return "google";
    if (p.includes("voice-transcribe") || p.includes("private-transcription")) {
        return "voice-transcribe";
    }
    if (p.includes("azure")) return "azure";
    if (p.includes("litellm")) return "litellm";
    if (baseUrl && !baseUrl.includes("api.openai.com")) return "local";
    return "openai";
}
