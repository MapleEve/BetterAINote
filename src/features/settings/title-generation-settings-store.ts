"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
    fetchTitleGenerationSettings,
    getDefaultTitleGenerationSettings,
    updateTitleGenerationSettings as persistTitleGenerationSettings,
    type TitleGenerationSettings,
    type TitleGenerationSettingsUpdate,
} from "@/services/title-generation-settings";

type Listener = () => void;

interface TitleGenerationSettingsStoreState {
    settings: TitleGenerationSettings;
    hasLoaded: boolean;
    isLoading: boolean;
    isSaving: boolean;
}

const listeners = new Set<Listener>();

function createInitialState(): TitleGenerationSettingsStoreState {
    return {
        settings: getDefaultTitleGenerationSettings(),
        hasLoaded: false,
        isLoading: true,
        isSaving: false,
    };
}

let storeState = createInitialState();
let loadPromise: Promise<TitleGenerationSettings> | null = null;
let pendingSaveCount = 0;

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

function setStoreState(
    nextState:
        | TitleGenerationSettingsStoreState
        | ((
              currentState: TitleGenerationSettingsStoreState,
          ) => TitleGenerationSettingsStoreState),
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

function hasOwnUpdate<Key extends keyof TitleGenerationSettingsUpdate>(
    updates: TitleGenerationSettingsUpdate,
    key: Key,
) {
    return Object.hasOwn(updates, key);
}

function buildOptimisticSettings(
    previousSettings: TitleGenerationSettings,
    updates: TitleGenerationSettingsUpdate,
): TitleGenerationSettings {
    const nextSettings = {
        ...previousSettings,
    };

    if (hasOwnUpdate(updates, "autoGenerateTitle")) {
        nextSettings.autoGenerateTitle = updates.autoGenerateTitle ?? true;
    }

    if (hasOwnUpdate(updates, "titleGenerationBaseUrl")) {
        nextSettings.titleGenerationBaseUrl =
            updates.titleGenerationBaseUrl ?? null;
    }

    if (hasOwnUpdate(updates, "titleGenerationModel")) {
        nextSettings.titleGenerationModel =
            updates.titleGenerationModel ?? null;
    }

    if (hasOwnUpdate(updates, "titleGenerationPrompt")) {
        nextSettings.titleGenerationPrompt =
            updates.titleGenerationPrompt ?? null;
    }

    if (hasOwnUpdate(updates, "titleGenerationApiKey")) {
        const apiKey = updates.titleGenerationApiKey;

        nextSettings.titleGenerationApiKeySet =
            apiKey === null
                ? false
                : typeof apiKey === "string"
                  ? apiKey.trim().length > 0
                  : previousSettings.titleGenerationApiKeySet;
    }

    return nextSettings;
}

function rollbackOptimisticSettings(
    currentSettings: TitleGenerationSettings,
    previousSettings: TitleGenerationSettings,
    optimisticSettings: TitleGenerationSettings,
    updates: TitleGenerationSettingsUpdate,
) {
    const nextSettings = { ...currentSettings };

    if (
        hasOwnUpdate(updates, "autoGenerateTitle") &&
        currentSettings.autoGenerateTitle ===
            optimisticSettings.autoGenerateTitle
    ) {
        nextSettings.autoGenerateTitle = previousSettings.autoGenerateTitle;
    }

    if (
        hasOwnUpdate(updates, "titleGenerationBaseUrl") &&
        currentSettings.titleGenerationBaseUrl ===
            optimisticSettings.titleGenerationBaseUrl
    ) {
        nextSettings.titleGenerationBaseUrl =
            previousSettings.titleGenerationBaseUrl;
    }

    if (
        hasOwnUpdate(updates, "titleGenerationModel") &&
        currentSettings.titleGenerationModel ===
            optimisticSettings.titleGenerationModel
    ) {
        nextSettings.titleGenerationModel =
            previousSettings.titleGenerationModel;
    }

    if (
        hasOwnUpdate(updates, "titleGenerationPrompt") &&
        currentSettings.titleGenerationPrompt ===
            optimisticSettings.titleGenerationPrompt
    ) {
        nextSettings.titleGenerationPrompt =
            previousSettings.titleGenerationPrompt;
    }

    if (
        hasOwnUpdate(updates, "titleGenerationApiKey") &&
        currentSettings.titleGenerationApiKeySet ===
            optimisticSettings.titleGenerationApiKeySet
    ) {
        nextSettings.titleGenerationApiKeySet =
            previousSettings.titleGenerationApiKeySet;
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

export function getTitleGenerationSettingsStoreSnapshot() {
    return storeState;
}

export function ensureTitleGenerationSettingsLoaded() {
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

    loadPromise = fetchTitleGenerationSettings()
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

export async function saveTitleGenerationSettings(
    updates: TitleGenerationSettingsUpdate,
) {
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
        await persistTitleGenerationSettings(updates);
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

export function useTitleGenerationSettingsStore() {
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    useEffect(() => {
        if (!storeState.hasLoaded) {
            void ensureTitleGenerationSettingsLoaded().catch(() => {});
        }
    }, []);

    return {
        ...snapshot,
        ensureTitleGenerationSettingsLoaded,
        updateTitleGenerationSettings: saveTitleGenerationSettings,
    };
}

export function __resetTitleGenerationSettingsStoreForTests() {
    listeners.clear();
    loadPromise = null;
    pendingSaveCount = 0;
    storeState = createInitialState();
}
