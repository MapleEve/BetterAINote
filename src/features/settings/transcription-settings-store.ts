"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
    fetchTranscriptionSettings,
    getDefaultTranscriptionSettings,
    updateTranscriptionSettings as persistTranscriptionSettings,
    type TranscriptionSettings,
    type TranscriptionSettingsUpdate,
} from "@/services/transcription-settings";

type Listener = () => void;

interface TranscriptionSettingsStoreState {
    settings: TranscriptionSettings;
    hasLoaded: boolean;
    isLoading: boolean;
    isSaving: boolean;
}

const listeners = new Set<Listener>();

function createInitialState(): TranscriptionSettingsStoreState {
    return {
        settings: getDefaultTranscriptionSettings(),
        hasLoaded: false,
        isLoading: true,
        isSaving: false,
    };
}

let storeState = createInitialState();
let loadPromise: Promise<TranscriptionSettings> | null = null;
let pendingSaveCount = 0;

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

function setStoreState(
    nextState:
        | TranscriptionSettingsStoreState
        | ((
              currentState: TranscriptionSettingsStoreState,
          ) => TranscriptionSettingsStoreState),
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
    currentSettings: TranscriptionSettings,
    previousSettings: TranscriptionSettings,
    optimisticSettings: TranscriptionSettings,
    updates: TranscriptionSettingsUpdate,
) {
    const nextSettings = { ...currentSettings };

    for (const key of Object.keys(updates) as (keyof TranscriptionSettings)[]) {
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

export function getTranscriptionSettingsStoreSnapshot() {
    return storeState;
}

export function ensureTranscriptionSettingsLoaded() {
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

    loadPromise = fetchTranscriptionSettings()
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

export async function saveTranscriptionSettings(
    updates: TranscriptionSettingsUpdate,
) {
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
        await persistTranscriptionSettings(updates);
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

export function useTranscriptionSettingsStore() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    useEffect(() => {
        if (!storeState.hasLoaded) {
            void ensureTranscriptionSettingsLoaded().catch(() => {});
        }
    }, []);

    return {
        ...snapshot,
        ensureTranscriptionSettingsLoaded,
        updateTranscriptionSettings: saveTranscriptionSettings,
    };
}

export function __resetTranscriptionSettingsStoreForTests() {
    listeners.clear();
    loadPromise = null;
    pendingSaveCount = 0;
    storeState = createInitialState();
}
