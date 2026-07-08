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

export const recordingTagSotColorLabel: Record<RecordingTag["color"], string> =
    {
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
    blue: "bg-chart-1",
    green: "bg-chart-3",
    orange: "bg-chart-4",
    purple: "bg-chart-5",
    red: "bg-destructive",
    slate: "bg-muted-foreground",
};

type RecordingTagIconVariant = "full" | "manager";

type RecordingTagIconOption = {
    icon: LucideIcon;
    managerIcon?: LucideIcon;
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
    { value: "grid", icon: Grid2X2, managerIcon: Grid2X2 },
    { value: "user", icon: User, managerIcon: User },
    { value: "heart", icon: Heart, managerIcon: Heart },
    { value: "clock", icon: Clock3, managerIcon: Clock3 },
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

export function recordingTagIconComponentFor(
    icon: RecordingTagIcon,
    variant: RecordingTagIconVariant = "full",
) {
    const option = recordingTagIconOptionFor(icon);

    return variant === "manager"
        ? (option.managerIcon ?? option.icon)
        : option.icon;
}

const recordingTagChipClassName =
    "h-[22px] w-fit justify-normal gap-[5px] rounded-[6px] border-border bg-muted py-0 pl-[7px] pr-[9px] [font:600_11.5px_var(--font-sans)] shadow-xs transition-none";

export function RecordingTagIconGlyph({
    icon,
    variant = "full",
    ...props
}: {
    icon: LucideIcon | RecordingTagIcon;
    variant?: RecordingTagIconVariant;
} & LucideProps) {
    const Icon =
        typeof icon === "string"
            ? recordingTagIconComponentFor(icon, variant)
            : icon;

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
            data-sot-tag-color={tag.color}
            data-sot-tag-icon={tag.icon}
        >
            <RecordingTagIconGlyph data-icon="inline-start" icon={Icon} />
            <span>{tag.name}</span>
        </Badge>
    );
}
