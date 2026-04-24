import { getPlaybackSettingsResponse } from "@/lib/settings/defaults";
import {
    normalizeFlooredNumberInRange,
    normalizePositiveNumber,
} from "@/lib/settings/number-normalization";
import { normalizeBooleanSetting } from "@/lib/settings/value-normalization";

async function loadUserSettingsOps() {
    return import("@/lib/settings/user-settings");
}

export async function getPlaybackSettingsStateForUser(userId: string) {
    const { getUserSettingsRow } = await loadUserSettingsOps();
    const settings = await getUserSettingsRow(userId);
    return getPlaybackSettingsResponse(settings);
}

export async function savePlaybackSettingsForUser(
    userId: string,
    body: Record<string, unknown>,
) {
    const { upsertUserSettings } = await loadUserSettingsOps();
    const updates: Record<string, unknown> = {};

    if (body.defaultPlaybackSpeed !== undefined) {
        updates.defaultPlaybackSpeed = normalizePositiveNumber(
            "defaultPlaybackSpeed",
            body.defaultPlaybackSpeed,
        );
    }

    if (body.defaultVolume !== undefined) {
        updates.defaultVolume = normalizeFlooredNumberInRange(
            "defaultVolume",
            body.defaultVolume,
            0,
            100,
        );
    }

    if (body.autoPlayNext !== undefined) {
        updates.autoPlayNext = normalizeBooleanSetting(
            "autoPlayNext",
            body.autoPlayNext,
        );
    }

    await upsertUserSettings(userId, updates);
}
