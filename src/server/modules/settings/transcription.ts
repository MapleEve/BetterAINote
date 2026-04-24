import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema/core";
import {
    hasStoredPrivateTranscriptionCredential,
    syncStoredPrivateTranscriptionBaseUrl,
    upsertStoredPrivateTranscriptionCredential,
} from "@/lib/api-credentials/private-transcription";
import {
    getTranscriptionSettingsResponse,
    getVoScriptSettingsResponse,
} from "@/lib/settings/defaults";
import { buildTranscriptionSettingsUpdates } from "@/lib/settings/transcription-settings";
import {
    buildVoScriptApiKeyUpdate,
    buildVoScriptSettingsUpdates,
} from "@/lib/settings/voscript-settings";
import type {
    TranscriptionRuntimeSettings,
    TranscriptionRuntimeSettingsRow,
} from "./shared";

const transcriptionRuntimeSettingsSelection = {
    defaultTranscriptionLanguage: userSettings.defaultTranscriptionLanguage,
    speakerDiarization: userSettings.speakerDiarization,
    diarizationSpeakers: userSettings.diarizationSpeakers,
    privateTranscriptionBaseUrl: userSettings.privateTranscriptionBaseUrl,
    privateTranscriptionMinSpeakers:
        userSettings.privateTranscriptionMinSpeakers,
    privateTranscriptionMaxSpeakers:
        userSettings.privateTranscriptionMaxSpeakers,
    privateTranscriptionDenoiseModel:
        userSettings.privateTranscriptionDenoiseModel,
    privateTranscriptionSnrThreshold:
        userSettings.privateTranscriptionSnrThreshold,
    privateTranscriptionNoRepeatNgramSize:
        userSettings.privateTranscriptionNoRepeatNgramSize,
    privateTranscriptionMaxInflightJobs:
        userSettings.privateTranscriptionMaxInflightJobs,
};

async function loadUserSettingsOps() {
    return import("@/lib/settings/user-settings");
}

export function getConfiguredPrivateTranscriptionBaseUrl(
    settings: Pick<
        TranscriptionRuntimeSettings,
        "privateTranscriptionBaseUrl"
    > | null,
) {
    return settings?.privateTranscriptionBaseUrl?.trim() || null;
}

export async function getTranscriptionRuntimeSettingsForUser(
    userId: string,
): Promise<TranscriptionRuntimeSettings | null> {
    const [settings] = await db
        .select(transcriptionRuntimeSettingsSelection)
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

    return settings ?? null;
}

export async function listTranscriptionRuntimeSettingsForUsers(
    userIds: string[],
): Promise<TranscriptionRuntimeSettingsRow[]> {
    if (userIds.length === 0) {
        return [];
    }

    return db
        .select({
            userId: userSettings.userId,
            ...transcriptionRuntimeSettingsSelection,
        })
        .from(userSettings)
        .where(inArray(userSettings.userId, userIds));
}

export async function getTranscriptionSettingsStateForUser(userId: string) {
    const { getUserSettingsRow } = await loadUserSettingsOps();
    const settings = await getUserSettingsRow(userId);
    return getTranscriptionSettingsResponse(settings);
}

export async function saveTranscriptionSettingsForUser(
    userId: string,
    body: Record<string, unknown>,
) {
    const { upsertUserSettings } = await loadUserSettingsOps();
    const updates = buildTranscriptionSettingsUpdates(body);
    await upsertUserSettings(userId, updates);
}

export async function getVoScriptSettingsStateForUser(userId: string) {
    const { getUserSettingsRow } = await loadUserSettingsOps();
    const [settings, privateTranscriptionApiKeySet] = await Promise.all([
        getUserSettingsRow(userId),
        hasStoredPrivateTranscriptionCredential(userId),
    ]);

    return getVoScriptSettingsResponse(settings, privateTranscriptionApiKeySet);
}

export async function saveVoScriptSettingsForUser(
    userId: string,
    body: Record<string, unknown>,
) {
    const { getUserSettingsRow, upsertUserSettings } =
        await loadUserSettingsOps();
    const existing = await getUserSettingsRow(userId);
    const updates = buildVoScriptSettingsUpdates(body, existing);
    const apiKeyUpdate = buildVoScriptApiKeyUpdate(body);
    const nextBaseUrl =
        updates.privateTranscriptionBaseUrl === undefined
            ? (existing?.privateTranscriptionBaseUrl ?? null)
            : (updates.privateTranscriptionBaseUrl as string | null);

    await upsertUserSettings(userId, updates);
    if (apiKeyUpdate !== undefined) {
        await upsertStoredPrivateTranscriptionCredential({
            userId,
            apiKey: apiKeyUpdate,
            baseUrl: nextBaseUrl,
        });
    } else if (updates.privateTranscriptionBaseUrl !== undefined) {
        await syncStoredPrivateTranscriptionBaseUrl(userId, nextBaseUrl);
    }
}
