import { getSyncSettingsResponse } from "@/lib/settings/defaults";
import {
    normalizeSyncIntervalMilliseconds,
    normalizeSyncIntervalSecondsToMilliseconds,
} from "@/lib/settings/sync-settings";
import { normalizeBooleanSetting } from "@/lib/settings/value-normalization";

async function loadUserSettingsOps() {
    return import("@/lib/settings/user-settings");
}

export async function getSyncSettingsStateForUser(userId: string) {
    const { getUserSettingsRow } = await loadUserSettingsOps();
    const settings = await getUserSettingsRow(userId);
    return getSyncSettingsResponse(settings);
}

export async function saveSyncSettingsForUser(
    userId: string,
    body: Record<string, unknown>,
) {
    const { upsertUserSettings } = await loadUserSettingsOps();
    const updates: Record<string, unknown> = {};

    if (body.autoSyncEnabled !== undefined) {
        updates.autoSyncEnabled = normalizeBooleanSetting(
            "autoSyncEnabled",
            body.autoSyncEnabled,
        );
    }

    if (body.syncIntervalSeconds !== undefined) {
        updates.syncInterval = normalizeSyncIntervalSecondsToMilliseconds(
            body.syncIntervalSeconds,
        );
    } else if (body.syncInterval !== undefined) {
        updates.syncInterval = normalizeSyncIntervalMilliseconds(
            body.syncInterval,
        );
    }

    await upsertUserSettings(userId, updates);
}
