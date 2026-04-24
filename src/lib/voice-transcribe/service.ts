import { PRIVATE_TRANSCRIPTION_CREDENTIAL_PROVIDER } from "@/lib/api-credentials/private-transcription";
import {
    getConfiguredPrivateTranscriptionBaseUrl,
    getTranscriptionRuntimeSettingsForUser,
} from "@/server/modules/settings";
import { VoiceTranscribeClient } from "./client";
import {
    findVoiceTranscribeCredential,
    getDecryptedVoiceTranscribeApiKey,
    getVoiceTranscribeCredentials,
} from "./credentials";
import type { VoiceTranscribeAccess } from "./types";

export async function getVoiceTranscribeAccessForUser(
    userId: string,
): Promise<VoiceTranscribeAccess & { client: VoiceTranscribeClient | null }> {
    const [settings, credentials] = await Promise.all([
        getTranscriptionRuntimeSettingsForUser(userId),
        getVoiceTranscribeCredentials(userId),
    ]);

    const configuredBaseUrl =
        getConfiguredPrivateTranscriptionBaseUrl(settings);
    if (configuredBaseUrl) {
        const matchedCredential = findVoiceTranscribeCredential(
            credentials,
            configuredBaseUrl,
        );

        const connection = {
            providerId:
                matchedCredential?.id ??
                PRIVATE_TRANSCRIPTION_CREDENTIAL_PROVIDER,
            providerName:
                matchedCredential?.provider ??
                PRIVATE_TRANSCRIPTION_CREDENTIAL_PROVIDER,
            baseUrl: configuredBaseUrl,
            apiKey: getDecryptedVoiceTranscribeApiKey(matchedCredential),
        };

        return {
            connection,
            client: new VoiceTranscribeClient(connection),
            reason: null,
        };
    }

    if (credentials.length === 0) {
        return {
            connection: null,
            client: null,
            reason: "Configure a private transcription service URL to browse remote voiceprints.",
        };
    }

    const preferred = findVoiceTranscribeCredential(credentials, null);
    if (!preferred) {
        return {
            connection: null,
            client: null,
            reason: "Configure a private transcription service URL to browse remote voiceprints.",
        };
    }

    const baseUrl = preferred.baseUrl?.trim();
    if (!baseUrl) {
        return {
            connection: null,
            client: null,
            reason: "The configured voice-transcribe provider is missing a base URL.",
        };
    }

    const connection = {
        providerId: preferred.id,
        providerName: preferred.provider,
        baseUrl,
        apiKey: getDecryptedVoiceTranscribeApiKey(preferred),
    };

    return {
        connection,
        client: new VoiceTranscribeClient(connection),
        reason: null,
    };
}
