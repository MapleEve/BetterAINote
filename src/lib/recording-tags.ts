export const RECORDING_TAG_COLORS = [
    "gray",
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
] as const;

export const RECORDING_TAG_ICONS = [
    "tag",
    "briefcase",
    "star",
    "bookmark",
    "flag",
    "pin",
    "users",
    "mic",
    "calendar",
    "folder",
    "sparkles",
    "check",
] as const;

export type RecordingTagColor = (typeof RECORDING_TAG_COLORS)[number];
export type RecordingTagIcon = (typeof RECORDING_TAG_ICONS)[number];

export type RecordingTag = {
    id: string;
    name: string;
    color: RecordingTagColor;
    icon: RecordingTagIcon;
};

export const MAX_RECORDING_TAG_NAME_LENGTH = 12;

export function isRecordingTagColor(
    value: unknown,
): value is RecordingTagColor {
    return (
        typeof value === "string" &&
        RECORDING_TAG_COLORS.includes(value as RecordingTagColor)
    );
}

export function isRecordingTagIcon(value: unknown): value is RecordingTagIcon {
    return (
        typeof value === "string" &&
        RECORDING_TAG_ICONS.includes(value as RecordingTagIcon)
    );
}

export function normalizeRecordingTagName(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export function isValidRecordingTagName(name: string) {
    return (
        name.length > 0 &&
        Array.from(name).length <= MAX_RECORDING_TAG_NAME_LENGTH
    );
}
