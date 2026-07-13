"use client";

import {
    BookOpen,
    Clock3,
    FileText,
    Flag,
    Grid2X2,
    Heart,
    Lightbulb,
    type LucideIcon,
    type LucideProps,
    MessageSquare,
    Mic,
    Star,
    Tag,
    User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RecordingTag, RecordingTagIcon } from "@/lib/recording-tags";
import { cn } from "@/lib/utils";

export const recordingTagColorLabel: Record<RecordingTag["color"], string> = {
    red: "玫",
    orange: "琥",
    green: "翠",
    blue: "蓝",
    purple: "紫",
    slate: "石",
};

export const recordingTagTextColorClassName: Record<
    RecordingTag["color"],
    string
> = {
    blue: "text-chart-1",
    green: "text-chart-3",
    orange: "text-chart-4",
    purple: "text-chart-5",
    red: "text-destructive",
    slate: "text-muted-foreground",
};

export const recordingTagSwatchColorClassName: Record<
    RecordingTag["color"],
    string
> = {
    blue: "[background-color:var(--tag-blue)]! data-[state=on]:[background-color:var(--tag-blue)]!",
    green: "[background-color:var(--tag-green)]! data-[state=on]:[background-color:var(--tag-green)]!",
    orange: "[background-color:var(--tag-amber)]! data-[state=on]:[background-color:var(--tag-amber)]!",
    purple: "[background-color:var(--tag-violet)]! data-[state=on]:[background-color:var(--tag-violet)]!",
    red: "[background-color:var(--tag-rose)]! data-[state=on]:[background-color:var(--tag-rose)]!",
    slate: "[background-color:var(--tag-slate)]! data-[state=on]:[background-color:var(--tag-slate)]!",
};

type RecordingTagIconOption = {
    icon: LucideIcon;
    value: RecordingTagIcon;
};

function defineRecordingTagIconOptions<
    const Options extends readonly RecordingTagIconOption[],
>(
    options: Options &
        (Exclude<RecordingTagIcon, Options[number]["value"]> extends never
            ? unknown
            : [
                  "Missing recording tag icons",
                  Exclude<RecordingTagIcon, Options[number]["value"]>,
              ]),
) {
    return options;
}

const recordingTagIconOptions = defineRecordingTagIconOptions([
    { value: "grid", icon: Grid2X2 },
    { value: "user", icon: User },
    { value: "heart", icon: Heart },
    { value: "clock", icon: Clock3 },
    { value: "tag", icon: Tag },
    { value: "star", icon: Star },
    { value: "dialog", icon: MessageSquare },
    { value: "flag", icon: Flag },
    { value: "book", icon: BookOpen },
    { value: "bulb", icon: Lightbulb },
    { value: "file", icon: FileText },
    { value: "mic", icon: Mic },
]);

function recordingTagIconOptionFor(
    icon: RecordingTagIcon,
): RecordingTagIconOption {
    return (
        recordingTagIconOptions.find((option) => option.value === icon) ??
        recordingTagIconOptions.find((option) => option.value === "tag")!
    );
}

export function recordingTagIconComponentFor(icon: RecordingTagIcon) {
    return recordingTagIconOptionFor(icon).icon;
}

const recordingTagChipClassName =
    "h-[22px] w-fit justify-normal gap-[5px] rounded-[6px] border-border bg-muted py-0 pl-[7px] pr-[9px] [font:600_11.5px_var(--font-sans)] shadow-xs transition-none";

export function RecordingTagIconGlyph({
    icon,
    ...props
}: {
    icon: LucideIcon | RecordingTagIcon;
} & LucideProps) {
    const Icon =
        typeof icon === "string" ? recordingTagIconComponentFor(icon) : icon;

    return <Icon aria-hidden="true" focusable="false" {...props} />;
}

export function RecordingTagChip({ tag }: { tag: RecordingTag }) {
    const Icon = recordingTagIconComponentFor(tag.icon);

    return (
        <Badge
            className={cn(
                recordingTagChipClassName,
                recordingTagTextColorClassName[tag.color],
            )}
            data-recording-tag-chip=""
        >
            <RecordingTagIconGlyph data-icon="inline-start" icon={Icon} />
            <span>{tag.name}</span>
        </Badge>
    );
}
