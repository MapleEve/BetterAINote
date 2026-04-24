import type { UiLanguage } from "@/lib/i18n";
import type { DateTimeFormat } from "@/types/common";

const DISPLAY_SETTINGS_ENDPOINT = "/api/settings/display";
const UI_LANGUAGES = ["zh-CN", "en"] as const;
const DATE_TIME_FORMATS = ["relative", "absolute", "iso"] as const;
const RECORDING_LIST_SORT_ORDERS = ["newest", "oldest", "name"] as const;
const THEMES = ["system", "light", "dark"] as const;
const DEFAULT_DISPLAY_SETTINGS = {
    uiLanguage: "zh-CN" as const,
    dateTimeFormat: "relative" as const,
    recordingListSortOrder: "newest" as const,
    itemsPerPage: 50,
    theme: "system" as const,
};

export type RecordingListSortOrder =
    (typeof RECORDING_LIST_SORT_ORDERS)[number];
export type ThemeMode = (typeof THEMES)[number];

export interface DisplaySettings {
    uiLanguage: UiLanguage;
    dateTimeFormat: DateTimeFormat;
    recordingListSortOrder: RecordingListSortOrder;
    itemsPerPage: number;
    theme: ThemeMode;
}

export type DisplaySettingsUpdate = Partial<DisplaySettings>;

function isEnumValue<const T extends readonly string[]>(
    value: unknown,
    allowedValues: T,
): value is T[number] {
    return (
        typeof value === "string" &&
        (allowedValues as readonly string[]).includes(value)
    );
}

function parseItemsPerPage(value: unknown) {
    return typeof value === "number" &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= 10 &&
        value <= 100
        ? value
        : DEFAULT_DISPLAY_SETTINGS.itemsPerPage;
}

function normalizeDisplaySettingsResponse(payload: unknown): DisplaySettings {
    const data =
        typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>)
            : {};

    return {
        uiLanguage: isEnumValue(data.uiLanguage, UI_LANGUAGES)
            ? data.uiLanguage
            : DEFAULT_DISPLAY_SETTINGS.uiLanguage,
        dateTimeFormat: isEnumValue(data.dateTimeFormat, DATE_TIME_FORMATS)
            ? data.dateTimeFormat
            : DEFAULT_DISPLAY_SETTINGS.dateTimeFormat,
        recordingListSortOrder: isEnumValue(
            data.recordingListSortOrder,
            RECORDING_LIST_SORT_ORDERS,
        )
            ? data.recordingListSortOrder
            : DEFAULT_DISPLAY_SETTINGS.recordingListSortOrder,
        itemsPerPage: parseItemsPerPage(data.itemsPerPage),
        theme: isEnumValue(data.theme, THEMES)
            ? data.theme
            : DEFAULT_DISPLAY_SETTINGS.theme,
    };
}

async function createResponseError(
    response: Response,
    fallbackMessage: string,
) {
    try {
        const data = (await response.json()) as { error?: string };
        return new Error(data.error || fallbackMessage);
    } catch {
        return new Error(fallbackMessage);
    }
}

export function getDefaultDisplaySettings(): DisplaySettings {
    return { ...DEFAULT_DISPLAY_SETTINGS };
}

export async function fetchDisplaySettings() {
    const response = await fetch(DISPLAY_SETTINGS_ENDPOINT, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to fetch display settings",
        );
    }

    return normalizeDisplaySettingsResponse(await response.json());
}

export async function updateDisplaySettings(
    updates: DisplaySettingsUpdate,
): Promise<void> {
    if (Object.keys(updates).length === 0) {
        return;
    }

    const response = await fetch(DISPLAY_SETTINGS_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to update display settings",
        );
    }
}
