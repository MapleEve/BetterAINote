const SYNC_SETTINGS_ENDPOINT = "/api/settings/sync";

// Keep sync defaults client-safe so this service never pulls server-only
// settings helpers into app-client bundles.
export const MIN_SYNC_INTERVAL_SECONDS = 60;

const DEFAULT_SYNC_SETTINGS = {
    autoSyncEnabled: true,
    syncIntervalSeconds: 300,
} as const;

export interface SyncSettings {
    autoSyncEnabled: boolean;
    syncIntervalSeconds: number;
}

export type SyncSettingsUpdate = Partial<SyncSettings>;

function parseSyncIntervalSeconds(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? Math.max(MIN_SYNC_INTERVAL_SECONDS, Math.floor(value))
        : null;
}

function normalizeSyncSettingsResponse(payload: unknown): SyncSettings {
    const data =
        typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>)
            : {};

    const syncIntervalSeconds =
        parseSyncIntervalSeconds(data.syncIntervalSeconds) ??
        (typeof data.syncInterval === "number" &&
        Number.isFinite(data.syncInterval)
            ? Math.max(
                  MIN_SYNC_INTERVAL_SECONDS,
                  Math.floor(data.syncInterval / 1000),
              )
            : DEFAULT_SYNC_SETTINGS.syncIntervalSeconds);

    return {
        autoSyncEnabled:
            typeof data.autoSyncEnabled === "boolean"
                ? data.autoSyncEnabled
                : DEFAULT_SYNC_SETTINGS.autoSyncEnabled,
        syncIntervalSeconds,
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

export function getDefaultSyncSettings(): SyncSettings {
    return { ...DEFAULT_SYNC_SETTINGS };
}

export async function fetchSyncSettings() {
    const response = await fetch(SYNC_SETTINGS_ENDPOINT, {
        cache: "no-store",
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to fetch sync settings",
        );
    }

    return normalizeSyncSettingsResponse(await response.json());
}

export async function updateSyncSettings(
    updates: SyncSettingsUpdate,
): Promise<void> {
    if (Object.keys(updates).length === 0) {
        return;
    }

    const response = await fetch(SYNC_SETTINGS_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        throw await createResponseError(
            response,
            "Failed to update sync settings",
        );
    }
}
