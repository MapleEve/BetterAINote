import {
    type ApiCredentialRecord,
    deleteApiCredentialById,
    getUserApiCredentialByProvider,
    insertApiCredential,
    updateApiCredentialById,
} from "@/lib/api-credentials/store";

export const TITLE_GENERATION_CREDENTIAL_PROVIDER = "title-generation";

export type TitleGenerationCredential = Pick<
    ApiCredentialRecord,
    "id" | "apiKey"
>;

export async function getStoredTitleGenerationCredential(userId: string) {
    return (await getUserApiCredentialByProvider(
        userId,
        TITLE_GENERATION_CREDENTIAL_PROVIDER,
    )) as TitleGenerationCredential | null;
}

export async function hasStoredTitleGenerationCredential(userId: string) {
    const credential = await getStoredTitleGenerationCredential(userId);
    return credential !== null;
}

export async function upsertStoredTitleGenerationCredential(params: {
    userId: string;
    apiKey: string | null;
}) {
    const existing = await getStoredTitleGenerationCredential(params.userId);

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
            baseUrl: null,
            defaultModel: null,
        });
        return;
    }

    await insertApiCredential({
        userId: params.userId,
        provider: TITLE_GENERATION_CREDENTIAL_PROVIDER,
        apiKey: params.apiKey,
        baseUrl: null,
        defaultModel: null,
        isDefaultTranscription: false,
    });
}
