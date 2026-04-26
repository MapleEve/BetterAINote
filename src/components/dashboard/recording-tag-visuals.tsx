"use client";

import {
    Bookmark,
    Briefcase,
    CalendarDays,
    CheckCircle2,
    Flag,
    Folder,
    Mic2,
    Pin,
    Sparkles,
    Star,
    Tag,
    UsersRound,
} from "lucide-react";
import type { RecordingTag, RecordingTagIcon } from "@/lib/recording-tags";
import { cn } from "@/lib/utils";

export const recordingTagColorClassName: Record<RecordingTag["color"], string> =
    {
        gray: "border-zinc-400/45 bg-zinc-500/12 text-foreground",
        red: "border-red-400/45 bg-red-500/12 text-foreground",
        orange: "border-orange-400/45 bg-orange-500/12 text-foreground",
        yellow: "border-yellow-400/45 bg-yellow-500/12 text-foreground",
        green: "border-emerald-400/45 bg-emerald-500/12 text-foreground",
        blue: "border-sky-400/45 bg-sky-500/12 text-foreground",
        purple: "border-violet-400/45 bg-violet-500/12 text-foreground",
    };

export const recordingTagDotClassName: Record<RecordingTag["color"], string> = {
    gray: "bg-zinc-400",
    red: "bg-red-400",
    orange: "bg-orange-400",
    yellow: "bg-yellow-400",
    green: "bg-emerald-400",
    blue: "bg-sky-400",
    purple: "bg-violet-400",
};

export const recordingTagIconMap = {
    tag: Tag,
    briefcase: Briefcase,
    star: Star,
    bookmark: Bookmark,
    flag: Flag,
    pin: Pin,
    users: UsersRound,
    mic: Mic2,
    calendar: CalendarDays,
    folder: Folder,
    sparkles: Sparkles,
    check: CheckCircle2,
} satisfies Record<RecordingTagIcon, typeof Tag>;

export function RecordingTagIconGlyph({
    icon,
    className,
}: {
    icon: RecordingTagIcon;
    className?: string;
}) {
    const Icon = recordingTagIconMap[icon] ?? Tag;

    return <Icon className={className} />;
}

export function RecordingTagChip({
    tag,
    className,
}: {
    tag: RecordingTag;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "inline-flex max-w-28 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                recordingTagColorClassName[tag.color],
                className,
            )}
        >
            <RecordingTagIconGlyph
                icon={tag.icon}
                className="h-2.5 w-2.5 shrink-0"
            />
            <span className="truncate">{tag.name}</span>
        </span>
    );
}
