"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
    type DisplaySettings,
    type DisplaySettingsUpdate,
    fetchDisplaySettings,
    getDefaultDisplaySettings,
    updateDisplaySettings as persistDisplaySettings,
} from "@/services/display-settings";

type Listener = () => void;

interface DisplaySettingsStoreState {
    settings: DisplaySettings;
    hasLoaded: boolean;
    isLoading: boolean;
    isSaving: boolean;
}

const listeners = new Set<Listener>();

function createInitialState(): DisplaySettingsStoreState {
    return {
        settings: getDefaultDisplaySettings(),
        hasLoaded: false,
        isLoading: true,
        isSaving: false,
    };
}

let storeState = createInitialState();
let loadPromise: Promise<DisplaySettings> | null = null;
let pendingSaveCount = 0;

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

function setStoreState(
    nextState:
        | DisplaySettingsStoreState
        | ((
              currentState: DisplaySettingsStoreState,
          ) => DisplaySettingsStoreState),
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
    currentSettings: DisplaySettings,
    previousSettings: DisplaySettings,
    optimisticSettings: DisplaySettings,
    updates: DisplaySettingsUpdate,
) {
    const nextSettings = { ...currentSettings };

    for (const key of Object.keys(updates) as (keyof DisplaySettings)[]) {
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

export function getDisplaySettingsStoreSnapshot() {
    return storeState;
}

export function ensureDisplaySettingsLoaded() {
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

    loadPromise = fetchDisplaySettings()
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

export async function saveDisplaySettings(updates: DisplaySettingsUpdate) {
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
        await persistDisplaySettings(updates);
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

export function useDisplaySettingsStore() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    useEffect(() => {
        if (!storeState.hasLoaded) {
            void ensureDisplaySettingsLoaded().catch(() => {});
        }
    }, []);

    return {
        ...snapshot,
        ensureDisplaySettingsLoaded,
        updateDisplaySettings: saveDisplaySettings,
    };
}

export function __resetDisplaySettingsStoreForTests() {
    listeners.clear();
    loadPromise = null;
    pendingSaveCount = 0;
    storeState = createInitialState();
}
