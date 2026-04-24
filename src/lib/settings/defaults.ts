import type { userSettings } from "@/db/schema/core";
import { getTitleGenerationProviderSettingsResponse } from "@/lib/ai/title-generation-config";

type UserSettingsRow = typeof userSettings.$inferSelect | null;

export const MIN_SYNC_INTERVAL_SECONDS = 60;

export const DEFAULT_DISPLAY_SETTINGS = {
    uiLanguage: "zh-CN" as const,
    dateTimeFormat: "relative" as const,
    recordingListSortOrder: "newest" as const,
    itemsPerPage: 50,
    theme: "system" as const,
};

export const DEFAULT_PLAYBACK_SETTINGS = {
    defaultPlaybackSpeed: 1.0,
    defaultVolume: 75,
    autoPlayNext: false,
};

export const DEFAULT_SYNC_SETTINGS = {
    autoSyncEnabled: true,
    syncInterval: 300000,
    syncIntervalSeconds: 300,
};

export const DEFAULT_TRANSCRIPTION_SETTINGS = {
    autoTranscribe: false,
    defaultTranscriptionLanguage: null as string | null,
};

export const DEFAULT_TITLE_GENERATION_SETTINGS = {
    autoGenerateTitle: true,
    titleGenerationBaseUrl: null as string | null,
    titleGenerationModel: null as string | null,
    titleGenerationApiKeySet: false,
    titleGenerationPrompt: null,
};

export const DEFAULT_VOSCRIPT_SETTINGS = {
    privateTranscriptionBaseUrl: null as string | null,
    privateTranscriptionApiKeySet: false,
    privateTranscriptionMinSpeakers: 0,
    privateTranscriptionMaxSpeakers: 0,
    privateTranscriptionDenoiseModel: "none" as const,
    privateTranscriptionSnrThreshold: null as number | null,
    privateTranscriptionNoRepeatNgramSize: 0,
    privateTranscriptionMaxInflightJobs: 1,
};

function normalizePositiveSetting(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : undefined;
}

function resolveVoScriptSpeakerSettings(settings: UserSettingsRow) {
    const minSpeakers = normalizePositiveSetting(
        settings?.privateTranscriptionMinSpeakers,
    );
    const maxSpeakers = normalizePositiveSetting(
        settings?.privateTranscriptionMaxSpeakers,
    );

    if (minSpeakers !== undefined || maxSpeakers !== undefined) {
        return {
            privateTranscriptionMinSpeakers:
                minSpeakers ??
                DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionMinSpeakers,
            privateTranscriptionMaxSpeakers:
                maxSpeakers ??
                DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionMaxSpeakers,
        };
    }

    const legacySpeakerCount =
        settings?.speakerDiarization === true
            ? normalizePositiveSetting(settings.diarizationSpeakers)
            : undefined;

    if (legacySpeakerCount !== undefined) {
        return {
            privateTranscriptionMinSpeakers: legacySpeakerCount,
            privateTranscriptionMaxSpeakers: legacySpeakerCount,
        };
    }

    return {
        privateTranscriptionMinSpeakers:
            DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionMinSpeakers,
        privateTranscriptionMaxSpeakers:
            DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionMaxSpeakers,
    };
}

export function getDisplaySettingsResponse(settings: UserSettingsRow) {
    return {
        uiLanguage: settings?.uiLanguage ?? DEFAULT_DISPLAY_SETTINGS.uiLanguage,
        dateTimeFormat:
            settings?.dateTimeFormat ?? DEFAULT_DISPLAY_SETTINGS.dateTimeFormat,
        recordingListSortOrder:
            settings?.recordingListSortOrder ??
            DEFAULT_DISPLAY_SETTINGS.recordingListSortOrder,
        itemsPerPage:
            settings?.itemsPerPage ?? DEFAULT_DISPLAY_SETTINGS.itemsPerPage,
        theme: settings?.theme ?? DEFAULT_DISPLAY_SETTINGS.theme,
    };
}

export function getPlaybackSettingsResponse(settings: UserSettingsRow) {
    return {
        defaultPlaybackSpeed:
            settings?.defaultPlaybackSpeed ??
            DEFAULT_PLAYBACK_SETTINGS.defaultPlaybackSpeed,
        defaultVolume:
            settings?.defaultVolume ?? DEFAULT_PLAYBACK_SETTINGS.defaultVolume,
        autoPlayNext:
            settings?.autoPlayNext ?? DEFAULT_PLAYBACK_SETTINGS.autoPlayNext,
    };
}

export function getSyncSettingsResponse(settings: UserSettingsRow) {
    const syncInterval =
        settings?.syncInterval ?? DEFAULT_SYNC_SETTINGS.syncInterval;

    return {
        autoSyncEnabled:
            settings?.autoSyncEnabled ?? DEFAULT_SYNC_SETTINGS.autoSyncEnabled,
        syncInterval,
        syncIntervalSeconds: Math.max(
            MIN_SYNC_INTERVAL_SECONDS,
            Math.floor(syncInterval / 1000),
        ),
    };
}

export function getTranscriptionSettingsResponse(settings: UserSettingsRow) {
    return {
        autoTranscribe:
            settings?.autoTranscribe ??
            DEFAULT_TRANSCRIPTION_SETTINGS.autoTranscribe,
        defaultTranscriptionLanguage:
            settings?.defaultTranscriptionLanguage ??
            DEFAULT_TRANSCRIPTION_SETTINGS.defaultTranscriptionLanguage,
    };
}

export function getTitleGenerationSettingsResponse(
    settings: UserSettingsRow,
    titleGenerationApiKeySet = false,
) {
    return {
        autoGenerateTitle:
            settings?.autoGenerateTitle ??
            DEFAULT_TITLE_GENERATION_SETTINGS.autoGenerateTitle,
        ...getTitleGenerationProviderSettingsResponse(
            settings,
            titleGenerationApiKeySet,
        ),
        titleGenerationPrompt:
            settings?.titleGenerationPrompt ??
            DEFAULT_TITLE_GENERATION_SETTINGS.titleGenerationPrompt,
    };
}

export function getVoScriptSettingsResponse(
    settings: UserSettingsRow,
    privateTranscriptionApiKeySet = false,
) {
    const speakerSettings = resolveVoScriptSpeakerSettings(settings);

    return {
        privateTranscriptionBaseUrl:
            settings?.privateTranscriptionBaseUrl ??
            DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionBaseUrl,
        privateTranscriptionApiKeySet,
        privateTranscriptionMinSpeakers:
            speakerSettings.privateTranscriptionMinSpeakers,
        privateTranscriptionMaxSpeakers:
            speakerSettings.privateTranscriptionMaxSpeakers,
        privateTranscriptionDenoiseModel:
            settings?.privateTranscriptionDenoiseModel ??
            DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionDenoiseModel,
        privateTranscriptionSnrThreshold:
            settings?.privateTranscriptionSnrThreshold ??
            DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionSnrThreshold,
        privateTranscriptionNoRepeatNgramSize:
            settings?.privateTranscriptionNoRepeatNgramSize ??
            DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionNoRepeatNgramSize,
        privateTranscriptionMaxInflightJobs:
            settings?.privateTranscriptionMaxInflightJobs ??
            DEFAULT_VOSCRIPT_SETTINGS.privateTranscriptionMaxInflightJobs,
    };
}
