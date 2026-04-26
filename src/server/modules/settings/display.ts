import { getDisplaySettingsResponse } from "@/lib/settings/defaults";
import { normalizeIntegerInRange } from "@/lib/settings/number-normalization";
import { normalizeEnumSetting } from "@/lib/settings/value-normalization";

const UI_LANGUAGES = ["zh-CN", "en"] as const;
const DATE_TIME_FORMATS = ["relative", "absolute"] as const;
const RECORDING_LIST_SORT_ORDERS = ["newest", "oldest", "name"] as const;
const THEMES = ["system", "light", "dark"] as const;

async function loadUserSettingsOps() {
    return import("@/lib/settings/user-settings");
}

export async function getDisplaySettingsStateForUser(userId: string) {
    const { getUserSettingsRow } = await loadUserSettingsOps();
    const settings = await getUserSettingsRow(userId);
    return getDisplaySettingsResponse(settings);
}

export async function saveDisplaySettingsForUser(
    userId: string,
    body: Record<string, unknown>,
) {
    const { upsertUserSettings } = await loadUserSettingsOps();
    const updates: Record<string, unknown> = {};

    if (body.uiLanguage !== undefined) {
        updates.uiLanguage = normalizeEnumSetting(
            "uiLanguage",
            body.uiLanguage,
            UI_LANGUAGES,
        );
    }

    if (body.dateTimeFormat !== undefined) {
        updates.dateTimeFormat =
            body.dateTimeFormat === "iso"
                ? "absolute"
                : normalizeEnumSetting(
                      "dateTimeFormat",
                      body.dateTimeFormat,
                      DATE_TIME_FORMATS,
                  );
    }

    if (body.recordingListSortOrder !== undefined) {
        updates.recordingListSortOrder = normalizeEnumSetting(
            "recordingListSortOrder",
            body.recordingListSortOrder,
            RECORDING_LIST_SORT_ORDERS,
        );
    }

    if (body.itemsPerPage !== undefined) {
        updates.itemsPerPage = normalizeIntegerInRange(
            "itemsPerPage",
            body.itemsPerPage,
            10,
            100,
        );
    }

    if (body.theme !== undefined) {
        updates.theme = normalizeEnumSetting("theme", body.theme, THEMES);
    }

    await upsertUserSettings(userId, updates);
}
