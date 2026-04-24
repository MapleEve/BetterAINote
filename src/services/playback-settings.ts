const PLAYBACK_SETTINGS_ENDPOINT = "/api/settings/playback";

export const PLAYBACK_SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEED_OPTIONS)[number];

export interface PlaybackSettings {
    defaultPlaybackSpeed: PlaybackSpeed;
    defaultVolume: number;
    autoPlayNext: boolean;
}

export type PlaybackSettingsUpdate = Partial<PlaybackSettings>;

// Keep playback defaults client-safe so this service never pulls server-only
// settings helpers into app-client bundles.
const DEFAULT_PLAYBACK_SETTINGS = {
    defaultPlaybackSpeed: 1.0,
    defaultVolume: 75,
    autoPlayNext: false,
} as const satisfies PlaybackSettings;

function parsePlaybackSpeed(value: unknown): PlaybackSpeed {
    return typeof value === "number" &&
        PLAYBACK_SPEED_OPTIONS.includes(value as PlaybackSpeed)
        ? (value as PlaybackSpeed)
        : (DEFAULT_PLAYBACK_SETTINGS.defaultPlaybackSpeed as PlaybackSpeed);
}

function parseDefaultVolume(value: unknown) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.min(100, Math.floor(value)))
        : DEFAULT_PLAYBACK_SETTINGS.defaultVolume;
}

function normalizePlaybackSettingsResponse(payload: unknown): PlaybackSettings {
    const data =
        typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>)
            : {};

    return {
        defaultPlaybackSpeed: parsePlaybackSpeed(data.defaultPlaybackSpeed),
        defaultVolume: parseDefaultVolume(data.defaultVolume),
        autoPlayNext:
            typeof data.autoPlayNext === "boolean"
                ? data.autoPlayNext
                : DEFAULT_PLAYBACK_SETTINGS.autoPlayNext,
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

export function getDefaultPlaybackSettings(): PlaybackSettings {
    return { ...DEFAULT_PLAYBACK_SETTINGS };
}

export async function fetchPlaybackSettings() {
    const response = await fetch(PLAYBACK_SETTINGS_ENDPOINT, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to fetch playback settings",
        );
    }

    return normalizePlaybackSettingsResponse(await response.json());
}

export async function updatePlaybackSettings(
    updates: PlaybackSettingsUpdate,
): Promise<void> {
    if (Object.keys(updates).length === 0) {
        return;
    }

    const response = await fetch(PLAYBACK_SETTINGS_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to update playback settings",
        );
    }
}
