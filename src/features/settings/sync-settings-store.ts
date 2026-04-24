"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
    fetchSyncSettings,
    getDefaultSyncSettings,
    updateSyncSettings as persistSyncSettings,
    type SyncSettings,
    type SyncSettingsUpdate,
} from "@/services/sync-settings";

type Listener = () => void;

interface SyncSettingsStoreState {
    settings: SyncSettings;
    hasLoaded: boolean;
    isLoading: boolean;
    isSaving: boolean;
}

const listeners = new Set<Listener>();

function createInitialState(): SyncSettingsStoreState {
    return {
        settings: getDefaultSyncSettings(),
        hasLoaded: false,
        isLoading: true,
        isSaving: false,
    };
}

let storeState = createInitialState();
let loadPromise: Promise<SyncSettings> | null = null;
let pendingSaveCount = 0;

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

function setStoreState(
    nextState:
        | SyncSettingsStoreState
        | ((currentState: SyncSettingsStoreState) => SyncSettingsStoreState),
) {
    storeState =
        typeof nextState === "function" ? nextState(storeState) : nextState;
    emitChange();
}

function beginSave() {
    pendingSaveCount += 1;
    if (!storeState.isSaving) {
        setStoreState((currentState) => ({
            ...currentState,
            isSaving: true,
        }));
    }
}

function endSave() {
    pendingSaveCount = Math.max(0, pendingSaveCount - 1);
    if (pendingSaveCount === 0 && storeState.isSaving) {
        setStoreState((currentState) => ({
            ...currentState,
            isSaving: false,
        }));
    }
}

function rollbackOptimisticSettings(
    currentSettings: SyncSettings,
    previousSettings: SyncSettings,
    optimisticSettings: SyncSettings,
    updates: SyncSettingsUpdate,
) {
    const nextSettings = { ...currentSettings };

    for (const key of Object.keys(updates) as (keyof SyncSettings)[]) {
        if (currentSettings[key] === optimisticSettings[key]) {
            nextSettings[key] = previousSettings[key] as never;
        }
    }

    return nextSettings;
}

function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot() {
    return storeState;
}

export function getSyncSettingsStoreSnapshot() {
    return storeState;
}

export function ensureSyncSettingsLoaded() {
    if (storeState.hasLoaded) {
        return Promise.resolve(storeState.settings);
    }

    if (loadPromise) {
        return loadPromise;
    }

    if (!storeState.isLoading) {
        setStoreState((currentState) => ({
            ...currentState,
            isLoading: true,
        }));
    }

    loadPromise = fetchSyncSettings()
        .then((settings) => {
            setStoreState((currentState) => ({
                ...currentState,
                settings,
                hasLoaded: true,
                isLoading: false,
            }));
            return settings;
        })
        .catch((error) => {
            setStoreState((currentState) => ({
                ...currentState,
                isLoading: false,
            }));
            throw error;
        })
        .finally(() => {
            loadPromise = null;
        });

    return loadPromise;
}

export async function saveSyncSettings(updates: SyncSettingsUpdate) {
    if (Object.keys(updates).length === 0) {
        return;
    }

    const previousSettings = storeState.settings;
    const optimisticSettings = {
        ...previousSettings,
        ...updates,
    };

    setStoreState((currentState) => ({
        ...currentState,
        settings: optimisticSettings,
    }));
    beginSave();

    try {
        await persistSyncSettings(updates);
        if (!storeState.hasLoaded) {
            setStoreState((currentState) => ({
                ...currentState,
                hasLoaded: true,
            }));
        }
    } catch (error) {
        setStoreState((currentState) => ({
            ...currentState,
            settings: rollbackOptimisticSettings(
                currentState.settings,
                previousSettings,
                optimisticSettings,
                updates,
            ),
        }));
        throw error;
    } finally {
        endSave();
    }
}

export function useSyncSettingsStore() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    useEffect(() => {
        if (!storeState.hasLoaded) {
            void ensureSyncSettingsLoaded().catch(() => {});
        }
    }, []);

    return {
        ...snapshot,
        ensureSyncSettingsLoaded,
        updateSyncSettings: saveSyncSettings,
    };
}

export function __resetSyncSettingsStoreForTests() {
    listeners.clear();
    loadPromise = null;
    pendingSaveCount = 0;
    storeState = createInitialState();
}
