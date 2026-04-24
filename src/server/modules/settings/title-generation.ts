import {
    hasStoredTitleGenerationCredential,
    upsertStoredTitleGenerationCredential,
} from "@/lib/api-credentials/title-generation";
import { getTitleGenerationSettingsResponse } from "@/lib/settings/defaults";
import {
    buildTitleGenerationApiKeyUpdate,
    buildTitleGenerationSettingsUpdates,
} from "@/lib/settings/title-generation-settings";

async function loadUserSettingsOps() {
    return import("@/lib/settings/user-settings");
}

export async function getTitleGenerationSettingsStateForUser(userId: string) {
    const { getUserSettingsRow } = await loadUserSettingsOps();
    const [settings, titleGenerationApiKeySet] = await Promise.all([
        getUserSettingsRow(userId),
        hasStoredTitleGenerationCredential(userId),
    ]);

    return getTitleGenerationSettingsResponse(
        settings,
        titleGenerationApiKeySet,
    );
}

export async function saveTitleGenerationSettingsForUser(
    userId: string,
    body: Record<string, unknown>,
) {
    const { upsertUserSettings } = await loadUserSettingsOps();
    const updates = buildTitleGenerationSettingsUpdates(body);
    const apiKeyUpdate = buildTitleGenerationApiKeyUpdate(body);

    await upsertUserSettings(userId, updates);
    if (apiKeyUpdate !== undefined) {
        await upsertStoredTitleGenerationCredential({
            userId,
            apiKey: apiKeyUpdate,
        });
    }
}
