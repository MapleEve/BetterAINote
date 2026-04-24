import { MIN_SYNC_INTERVAL_SECONDS } from "@/lib/settings/defaults";
import { normalizeFiniteNumber } from "@/lib/settings/number-normalization";

export function normalizeSyncIntervalSecondsToMilliseconds(value: unknown) {
    return Math.max(
        MIN_SYNC_INTERVAL_SECONDS * 1000,
        Math.floor(normalizeFiniteNumber("syncIntervalSeconds", value)) * 1000,
    );
}

export function normalizeSyncIntervalMilliseconds(value: unknown) {
    return Math.max(
        MIN_SYNC_INTERVAL_SECONDS * 1000,
        Math.floor(normalizeFiniteNumber("syncInterval", value)),
    );
}
