"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
    fetchPlaybackSettings,
    getDefaultPlaybackSettings,
    type PlaybackSettings,
    type PlaybackSettingsUpdate,
    updatePlaybackSettings as persistPlaybackSettings,
} from "@/services/playback-settings";

type Listener = () => void;

interface PlaybackSettingsStoreState {
    settings: PlaybackSettings;
    hasLoaded: boolean;
    isLoading: boolean;
    isSaving: boolean;
}

const listeners = new Set<Listener>();

function createInitialState(): PlaybackSettingsStoreState {
    return {
        settings: getDefaultPlaybackSettings(),
        hasLoaded: false,
        isLoading: true,
        isSaving: false,
    };
}

let storeState = createInitialState();
let loadPromise: Promise<PlaybackSettings> | null = null;
let pendingSaveCount = 0;

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

function setStoreState(
    nextState:
        | PlaybackSettingsStoreState
        | ((
              currentState: PlaybackSettingsStoreState,
          ) => PlaybackSettingsStoreState),
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
    currentSettings: PlaybackSettings,
    previousSettings: PlaybackSettings,
    optimisticSettings: PlaybackSettings,
    updates: PlaybackSettingsUpdate,
) {
    const nextSettings = { ...currentSettings };

    for (const key of Object.keys(updates) as (keyof PlaybackSettings)[]) {
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

export function getPlaybackSettingsStoreSnapshot() {
    return storeState;
}

export function ensurePlaybackSettingsLoaded() {
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

    loadPromise = fetchPlaybackSettings()
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

export async function savePlaybackSettings(updates: PlaybackSettingsUpdate) {
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
        await persistPlaybackSettings(updates);
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

export function usePlaybackSettingsStore() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    useEffect(() => {
        if (!storeState.hasLoaded) {
            void ensurePlaybackSettingsLoaded().catch(() => {});
        }
    }, []);

    return {
        ...snapshot,
        ensurePlaybackSettingsLoaded,
        updatePlaybackSettings: savePlaybackSettings,
    };
}

export function __resetPlaybackSettingsStoreForTests() {
    listeners.clear();
    loadPromise = null;
    pendingSaveCount = 0;
    storeState = createInitialState();
}
