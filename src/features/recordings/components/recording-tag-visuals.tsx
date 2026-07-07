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

const recordingTagIconComponents = {
    book: BookOpen,
    bulb: Lightbulb,
    clock: Clock3,
    dialog: MessageSquare,
    file: FileText,
    flag: Flag,
    grid: Grid2X2,
    heart: Heart,
    mic: Mic,
    star: Star,
    tag: Tag,
    user: User,
} satisfies Record<RecordingTagIcon, LucideIcon>;

const recordingTagManagerIconComponents: Partial<
    Record<RecordingTagIcon, LucideIcon>
> = {
    clock: Clock3,
    grid: Grid2X2,
    heart: Heart,
    user: User,
};

const recordingTagChipClassName =
    "h-[22px] w-fit justify-normal gap-[5px] rounded-[6px] border-border bg-muted py-0 pl-[7px] pr-[9px] [font:600_11.5px_var(--font-sans)] shadow-xs transition-none";

export function RecordingTagIconGlyph({
    icon,
    variant = "full",
    ...props
}: {
    icon: RecordingTagIcon;
    variant?: "full" | "manager";
} & LucideProps) {
    const Icon =
        variant === "manager"
            ? (recordingTagManagerIconComponents[icon] ??
              recordingTagIconComponents[icon])
            : recordingTagIconComponents[icon];

    return <Icon aria-hidden="true" focusable="false" {...props} />;
}

export function RecordingTagChip({ tag }: { tag: RecordingTag }) {
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
            <RecordingTagIconGlyph data-icon="inline-start" icon={tag.icon} />
            <span>{tag.name}</span>
        </Badge>
    );
}
