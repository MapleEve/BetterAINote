"use client";

import type { CSSProperties, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { RecordingTag, RecordingTagIcon } from "@/lib/recording-tags";

export const recordingTagSotColorLabel: Record<RecordingTag["color"], string> =
    {
        red: "玫",
        orange: "琥",
        green: "翠",
        blue: "蓝",
        purple: "紫",
        slate: "石",
    };

const recordingTagSwatchTokens: Record<RecordingTag["color"], string> = {
    red: "var(--tag-rose)",
    orange: "var(--tag-amber)",
    green: "var(--tag-green)",
    blue: "var(--tag-blue)",
    purple: "var(--tag-violet)",
    slate: "var(--tag-slate)",
};

function tagSwatchStyle(color: RecordingTag["color"]): CSSProperties {
    return { "--tag-sw": recordingTagSwatchTokens[color] } as CSSProperties;
}

export const recordingTagSwatchStyle: Record<
    RecordingTag["color"],
    CSSProperties
> = {
    red: tagSwatchStyle("red"),
    orange: tagSwatchStyle("orange"),
    green: tagSwatchStyle("green"),
    blue: tagSwatchStyle("blue"),
    purple: tagSwatchStyle("purple"),
    slate: tagSwatchStyle("slate"),
};

const recordingTagIconPaths = {
    grid: (
        <>
            <path d="M3 3h7v7H3z" />
            <path d="M14 3h7v7h-7z" />
            <path d="M14 14h7v7h-7z" />
            <path d="M3 14h7v7H3z" />
        </>
    ),
    user: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
        </>
    ),
    heart: (
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    ),
    clock: (
        <>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </>
    ),
    flag: <path d="M4 22V4a2 2 0 0 1 2-2h10l-2 4 2 4H6" />,
    star: (
        <polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5 12 2" />
    ),
    tag: (
        <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    ),
    dialog: (
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    ),
    book: (
        <>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </>
    ),
    bulb: (
        <>
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7c.7.5 1 1.4 1 2.3v1h6v-1c0-.9.3-1.8 1-2.3A7 7 0 0 0 12 2Z" />
        </>
    ),
    file: (
        <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
        </>
    ),
    mic: (
        <>
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 1 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 1 1-14 0v-2" />
        </>
    ),
} satisfies Record<RecordingTagIcon, ReactNode>;

const recordingTagManagerIconPaths: Partial<
    Record<RecordingTagIcon, ReactNode>
> = {
    grid: <path d="M3 3h7v7H3z" />,
    user: <circle cx="9" cy="7" r="4" />,
    heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5" />,
    clock: <circle cx="12" cy="12" r="10" />,
};

const recordingTagChipVariablesClassName =
    "[--sot-player-tag-chip-bg:var(--bg-recessed)] [--sot-player-tag-chip-border:var(--line-hairline)] [--sot-player-tag-chip-fg:var(--fg-primary)] data-[sot-tag-color=blue]:[--sot-player-tag-chip-fg:var(--tag-blue)] data-[sot-tag-color=green]:[--sot-player-tag-chip-fg:var(--tag-green)] data-[sot-tag-color=orange]:[--sot-player-tag-chip-fg:var(--tag-amber)] data-[sot-tag-color=purple]:[--sot-player-tag-chip-fg:var(--tag-violet)] data-[sot-tag-color=red]:[--sot-player-tag-chip-fg:var(--tag-rose)] data-[sot-tag-color=slate]:[--sot-player-tag-chip-fg:var(--tag-slate)]";

const recordingTagChipClassName = `${recordingTagChipVariablesClassName} h-[22px] w-fit justify-normal gap-[5px] rounded-[6px] border-[var(--sot-player-tag-chip-border)] bg-[var(--sot-player-tag-chip-bg)] py-0 pl-[7px] pr-[9px] [font:600_11.5px_var(--font-sans)] text-[var(--sot-player-tag-chip-fg)] shadow-[var(--shadow-xs)] transition-none [&>svg]:size-[11px] [&>svg]:fill-none [&>svg]:stroke-2 [&>svg]:stroke-current [&>svg]:[stroke-linecap:round] [&>svg]:[stroke-linejoin:round]`;

export function RecordingTagIconGlyph({
    icon,
    variant = "full",
}: {
    icon: RecordingTagIcon;
    variant?: "full" | "manager";
}) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {variant === "manager"
                ? (recordingTagManagerIconPaths[icon] ??
                  recordingTagIconPaths[icon] ??
                  recordingTagIconPaths.tag)
                : (recordingTagIconPaths[icon] ?? recordingTagIconPaths.tag)}
        </svg>
    );
}

export function RecordingTagChip({ tag }: { tag: RecordingTag }) {
    return (
        <Badge
            className={recordingTagChipClassName}
            data-recording-tag-chip=""
            data-sot-tag-color={tag.color}
            data-sot-tag-icon={tag.icon}
        >
            <RecordingTagIconGlyph icon={tag.icon} />
            <span>{tag.name}</span>
        </Badge>
    );
}
