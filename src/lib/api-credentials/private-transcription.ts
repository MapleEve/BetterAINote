import {
    type ApiCredentialRecord,
    deleteApiCredentialById,
    getUserApiCredentialByProvider,
    insertApiCredential,
    updateApiCredentialById,
} from "@/lib/api-credentials/store";

export const PRIVATE_TRANSCRIPTION_CREDENTIAL_PROVIDER =
    "private-transcription";

export type PrivateTranscriptionCredential = Pick<
    ApiCredentialRecord,
    | "id"
    | "provider"
    | "apiKey"
    | "baseUrl"
    | "defaultModel"
    | "isDefaultTranscription"
>;

export async function getStoredPrivateTranscriptionCredential(userId: string) {
    return (await getUserApiCredentialByProvider(
        userId,
        PRIVATE_TRANSCRIPTION_CREDENTIAL_PROVIDER,
    )) as PrivateTranscriptionCredential | null;
}

export async function hasStoredPrivateTranscriptionCredential(userId: string) {
    const credential = await getStoredPrivateTranscriptionCredential(userId);
    return credential !== null;
}

export async function upsertStoredPrivateTranscriptionCredential(params: {
    userId: string;
    apiKey: string | null;
    baseUrl: string | null;
}) {
    const existing = await getStoredPrivateTranscriptionCredential(
        params.userId,
    );

    if (params.apiKey === null) {
        if (!existing) {
            return;
        }

        await deleteApiCredentialById(existing.id);
        return;
    }

    if (existing) {
        await updateApiCredentialById(existing.id, {
            apiKey: params.apiKey,
            baseUrl: params.baseUrl,
        });
        return;
    }

    await insertApiCredential({
        userId: params.userId,
        provider: PRIVATE_TRANSCRIPTION_CREDENTIAL_PROVIDER,
        apiKey: params.apiKey,
        baseUrl: params.baseUrl,
        defaultModel: null,
        isDefaultTranscription: false,
    });
}

export async function syncStoredPrivateTranscriptionBaseUrl(
    userId: string,
    baseUrl: string | null,
) {
    const existing = await getStoredPrivateTranscriptionCredential(userId);
    if (!existing) {
        return;
    }

    await updateApiCredentialById(existing.id, {
        baseUrl,
    });
}
