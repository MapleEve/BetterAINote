"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
    fetchVoScriptSettings,
    getDefaultVoScriptSettings,
    updateVoScriptSettings as persistVoScriptSettings,
    type VoScriptSettings,
    type VoScriptSettingsUpdate,
} from "@/services/voscript-settings";

type Listener = () => void;

interface VoScriptSettingsStoreState {
    settings: VoScriptSettings;
    hasLoaded: boolean;
    isLoading: boolean;
    isSaving: boolean;
}

const listeners = new Set<Listener>();

function createInitialState(): VoScriptSettingsStoreState {
    return {
        settings: getDefaultVoScriptSettings(),
        hasLoaded: false,
        isLoading: true,
        isSaving: false,
    };
}

let storeState = createInitialState();
let loadPromise: Promise<VoScriptSettings> | null = null;
let pendingSaveCount = 0;

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

function setStoreState(
    nextState:
        | VoScriptSettingsStoreState
        | ((
              currentState: VoScriptSettingsStoreState,
          ) => VoScriptSettingsStoreState),
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

function hasOwnUpdate<Key extends keyof VoScriptSettingsUpdate>(
    updates: VoScriptSettingsUpdate,
    key: Key,
) {
    return Object.hasOwn(updates, key);
}

function buildOptimisticSettings(
    previousSettings: VoScriptSettings,
    updates: VoScriptSettingsUpdate,
): VoScriptSettings {
    const nextSettings = {
        ...previousSettings,
    };

    if (hasOwnUpdate(updates, "privateTranscriptionBaseUrl")) {
        nextSettings.privateTranscriptionBaseUrl =
            updates.privateTranscriptionBaseUrl ?? null;
    }

    if (hasOwnUpdate(updates, "privateTranscriptionApiKey")) {
        const apiKey = updates.privateTranscriptionApiKey;

        nextSettings.privateTranscriptionApiKeySet =
            apiKey === null
                ? false
                : typeof apiKey === "string"
                  ? apiKey.trim().length > 0
                  : previousSettings.privateTranscriptionApiKeySet;
    }

    if (hasOwnUpdate(updates, "privateTranscriptionMinSpeakers")) {
        nextSettings.privateTranscriptionMinSpeakers =
            updates.privateTranscriptionMinSpeakers ?? 0;
    }

    if (hasOwnUpdate(updates, "privateTranscriptionMaxSpeakers")) {
        nextSettings.privateTranscriptionMaxSpeakers =
            updates.privateTranscriptionMaxSpeakers ?? 0;
    }

    if (hasOwnUpdate(updates, "privateTranscriptionDenoiseModel")) {
        nextSettings.privateTranscriptionDenoiseModel =
            updates.privateTranscriptionDenoiseModel ?? "none";
    }

    if (hasOwnUpdate(updates, "privateTranscriptionSnrThreshold")) {
        nextSettings.privateTranscriptionSnrThreshold =
            updates.privateTranscriptionSnrThreshold ?? null;
    }

    if (hasOwnUpdate(updates, "privateTranscriptionNoRepeatNgramSize")) {
        nextSettings.privateTranscriptionNoRepeatNgramSize =
            updates.privateTranscriptionNoRepeatNgramSize ?? 0;
    }

    if (hasOwnUpdate(updates, "privateTranscriptionMaxInflightJobs")) {
        nextSettings.privateTranscriptionMaxInflightJobs =
            updates.privateTranscriptionMaxInflightJobs ?? 1;
    }

    return nextSettings;
}

function rollbackOptimisticSettings(
    currentSettings: VoScriptSettings,
    previousSettings: VoScriptSettings,
    optimisticSettings: VoScriptSettings,
    updates: VoScriptSettingsUpdate,
) {
    const nextSettings = { ...currentSettings };

    if (
        hasOwnUpdate(updates, "privateTranscriptionBaseUrl") &&
        currentSettings.privateTranscriptionBaseUrl ===
            optimisticSettings.privateTranscriptionBaseUrl
    ) {
        nextSettings.privateTranscriptionBaseUrl =
            previousSettings.privateTranscriptionBaseUrl;
    }

    if (
        hasOwnUpdate(updates, "privateTranscriptionApiKey") &&
        currentSettings.privateTranscriptionApiKeySet ===
            optimisticSettings.privateTranscriptionApiKeySet
    ) {
        nextSettings.privateTranscriptionApiKeySet =
            previousSettings.privateTranscriptionApiKeySet;
    }

    if (
        hasOwnUpdate(updates, "privateTranscriptionMinSpeakers") &&
        currentSettings.privateTranscriptionMinSpeakers ===
            optimisticSettings.privateTranscriptionMinSpeakers
    ) {
        nextSettings.privateTranscriptionMinSpeakers =
            previousSettings.privateTranscriptionMinSpeakers;
    }

    if (
        hasOwnUpdate(updates, "privateTranscriptionMaxSpeakers") &&
        currentSettings.privateTranscriptionMaxSpeakers ===
            optimisticSettings.privateTranscriptionMaxSpeakers
    ) {
        nextSettings.privateTranscriptionMaxSpeakers =
            previousSettings.privateTranscriptionMaxSpeakers;
    }

    if (
        hasOwnUpdate(updates, "privateTranscriptionDenoiseModel") &&
        currentSettings.privateTranscriptionDenoiseModel ===
            optimisticSettings.privateTranscriptionDenoiseModel
    ) {
        nextSettings.privateTranscriptionDenoiseModel =
            previousSettings.privateTranscriptionDenoiseModel;
    }

    if (
        hasOwnUpdate(updates, "privateTranscriptionSnrThreshold") &&
        currentSettings.privateTranscriptionSnrThreshold ===
            optimisticSettings.privateTranscriptionSnrThreshold
    ) {
        nextSettings.privateTranscriptionSnrThreshold =
            previousSettings.privateTranscriptionSnrThreshold;
    }

    if (
        hasOwnUpdate(updates, "privateTranscriptionNoRepeatNgramSize") &&
        currentSettings.privateTranscriptionNoRepeatNgramSize ===
            optimisticSettings.privateTranscriptionNoRepeatNgramSize
    ) {
        nextSettings.privateTranscriptionNoRepeatNgramSize =
            previousSettings.privateTranscriptionNoRepeatNgramSize;
    }

    if (
        hasOwnUpdate(updates, "privateTranscriptionMaxInflightJobs") &&
        currentSettings.privateTranscriptionMaxInflightJobs ===
            optimisticSettings.privateTranscriptionMaxInflightJobs
    ) {
        nextSettings.privateTranscriptionMaxInflightJobs =
            previousSettings.privateTranscriptionMaxInflightJobs;
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

export function getVoScriptSettingsStoreSnapshot() {
    return storeState;
}

export function ensureVoScriptSettingsLoaded() {
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

    loadPromise = fetchVoScriptSettings()
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

export async function saveVoScriptSettings(updates: VoScriptSettingsUpdate) {
    if (Object.keys(updates).length === 0) {
        return;
    }

    const previousSettings = storeState.settings;
    const optimisticSettings = buildOptimisticSettings(
        previousSettings,
        updates,
    );

    setStoreState((currentState) => ({
        ...currentState,
        settings: optimisticSettings,
    }));
    beginSave();

    try {
        await persistVoScriptSettings(updates);
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

export function useVoScriptSettingsStore() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    useEffect(() => {
        if (!storeState.hasLoaded) {
            void ensureVoScriptSettingsLoaded().catch(() => {});
        }
    }, []);

    return {
        ...snapshot,
        ensureVoScriptSettingsLoaded,
        updateVoScriptSettings: saveVoScriptSettings,
    };
}

export function __resetVoScriptSettingsStoreForTests() {
    listeners.clear();
    loadPromise = null;
    pendingSaveCount = 0;
    storeState = createInitialState();
}
