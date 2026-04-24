import { listTranscriptionCredentials } from "@/lib/api-credentials/default-transcription";
import {
    hasStoredPrivateTranscriptionCredential,
    PRIVATE_TRANSCRIPTION_CREDENTIAL_PROVIDER,
    syncStoredPrivateTranscriptionBaseUrl,
    upsertStoredPrivateTranscriptionCredential,
} from "@/lib/api-credentials/private-transcription";
import { decrypt } from "@/lib/encryption";
import { inferProviderType } from "@/lib/transcription/providers/factory";

export const STORED_VOSCRIPT_PROVIDER =
    PRIVATE_TRANSCRIPTION_CREDENTIAL_PROVIDER;

type VoiceTranscribeCredential = Awaited<
    ReturnType<typeof listTranscriptionCredentials>
>[number];

function credentialPriority(credential: {
    provider: string;
    isDefaultTranscription?: boolean | null;
}) {
    if (credential.provider === STORED_VOSCRIPT_PROVIDER) {
        return 2;
    }

    if (credential.isDefaultTranscription) {
        return 1;
    }

    return 0;
}

export function isVoiceTranscribeCredential(credential: {
    provider: string;
    baseUrl?: string | null;
}) {
    return (
        inferProviderType(credential.provider, credential.baseUrl) ===
        "voice-transcribe"
    );
}

export function findVoiceTranscribeCredential<
    T extends {
        provider: string;
        baseUrl?: string | null;
        isDefaultTranscription?: boolean | null;
    },
>(credentials: T[], configuredBaseUrl: string | null) {
    const candidates = credentials.filter(isVoiceTranscribeCredential);
    const matchingCandidates = configuredBaseUrl
        ? candidates.filter(
              (credential) => credential.baseUrl?.trim() === configuredBaseUrl,
          )
        : candidates;

    return (
        [...matchingCandidates].sort(
            (left, right) =>
                credentialPriority(right) - credentialPriority(left),
        )[0] ?? null
    );
}

export async function getVoiceTranscribeCredentials(userId: string) {
    const credentials = await listTranscriptionCredentials(userId);

    return credentials.filter(isVoiceTranscribeCredential);
}

export function getDecryptedVoiceTranscribeApiKey(
    credential: Pick<VoiceTranscribeCredential, "apiKey"> | null,
) {
    return credential?.apiKey ? decrypt(credential.apiKey) : null;
}

export async function hasStoredVoScriptApiKey(userId: string) {
    return hasStoredPrivateTranscriptionCredential(userId);
}

export async function upsertStoredVoScriptApiKey(params: {
    userId: string;
    apiKey: string | null;
    baseUrl: string | null;
}) {
    return upsertStoredPrivateTranscriptionCredential(params);
}

export async function syncStoredVoScriptBaseUrl(
    userId: string,
    baseUrl: string | null,
) {
    return syncStoredPrivateTranscriptionBaseUrl(userId, baseUrl);
}
