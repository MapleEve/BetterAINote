/**
 * Settings types
 */

export type CanonicalSettingsSection =
    | "transcription"
    | "title-generation"
    | "voscript"
    | "data-sources"
    | "appearance"
    | "misc";

export type LegacySettingsSection = "sync" | "playback" | "display";

export type SettingsSection = CanonicalSettingsSection | LegacySettingsSection;
