export const RECORDING_TAG_COLORS = [
    "purple",
    "blue",
    "red",
    "orange",
    "green",
    "slate",
] as const;

export const RECORDING_TAG_ICONS = [
    "grid",
    "user",
    "heart",
    "clock",
    "tag",
    "star",
    "dialog",
    "flag",
    "book",
    "bulb",
    "file",
    "mic",
] as const;

export type RecordingTagColor = (typeof RECORDING_TAG_COLORS)[number];
export type RecordingTagIcon = (typeof RECORDING_TAG_ICONS)[number];

export type RecordingTag = {
    id: string;
    name: string;
    color: RecordingTagColor;
    icon: RecordingTagIcon;
    recordingCount?: number;
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
