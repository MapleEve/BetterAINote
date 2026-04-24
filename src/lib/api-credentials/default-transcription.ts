import {
    type ApiCredentialRecord,
    getDefaultTranscriptionApiCredential,
    listUserApiCredentials,
} from "@/lib/api-credentials/store";
import { TITLE_GENERATION_CREDENTIAL_PROVIDER } from "@/lib/api-credentials/title-generation";

// Title-generation credentials share the table but must not leak into transcription ownership.
export type DefaultTranscriptionCredential = ApiCredentialRecord;
export type TranscriptionCredential = ApiCredentialRecord;

export function isTranscriptionCredential(
    credential: Pick<ApiCredentialRecord, "provider">,
) {
    return credential.provider !== TITLE_GENERATION_CREDENTIAL_PROVIDER;
}

export async function getDefaultTranscriptionCredential(userId: string) {
    return (await getDefaultTranscriptionApiCredential(
        userId,
    )) as DefaultTranscriptionCredential | null;
}

export async function listTranscriptionCredentials(userId: string) {
    const credentials = await listUserApiCredentials(userId);
    return credentials.filter(isTranscriptionCredential);
}

export async function listFallbackTranscriptionCredentials(
    userId: string,
    excludedCredentialId: string,
) {
    const credentials = await listTranscriptionCredentials(userId);
    return credentials.filter(
        (credential) => credential.id !== excludedCredentialId,
    );
}

export async function hasAnyTranscriptionCredential(userId: string) {
    const credentials = await listTranscriptionCredentials(userId);
    return credentials.length > 0;
}
