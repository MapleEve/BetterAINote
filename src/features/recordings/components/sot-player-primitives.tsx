"use client";

import { Plus, VolumeX } from "lucide-react";
import Image from "next/image";
import type * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecordingTag } from "@/lib/recording-tags";
import { cn } from "@/lib/utils";
import { RecordingTagIconGlyph } from "./recording-tag-visuals";

const SOT_SOURCE_BADGES = {
    "dingtalk-a1": {
        label: "钉钉",
        icon: "/assets/sources/dingtalk.svg",
        cover: false,
        letter: "钉",
    },
    ticnote: {
        label: "TicNote",
        icon: "/assets/sources/ticnote.png",
        cover: false,
        letter: "T",
    },
    plaud: {
        label: "Plaud",
        icon: "/assets/sources/plaud.png",
        cover: true,
        letter: "P",
    },
    "feishu-minutes": {
        label: "飞书妙记",
        icon: "/assets/sources/feishu.jpeg",
        cover: true,
        letter: "飞",
    },
    iflyrec: {
        label: "讯飞听见",
        icon: null,
        cover: false,
        letter: "讯",
    },
} as const;

function pad2(value: number) {
    return String(value).padStart(2, "0");
}

function sourceFallbackLetter(provider: string, label: string) {
    const candidate = Array.from(label.trim())[0] ?? Array.from(provider)[0];
    return candidate?.toUpperCase() ?? "S";
}

export function formatSotPlayerDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} · ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatSotPlayerTime(value: number) {
    const seconds =
        value > 10_000 ? Math.floor(value / 1000) : Math.floor(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${pad2(secs)}`;
}

export function formatSotPlaybackSpeed(value: number) {
    return `${Number.isInteger(value) ? value.toFixed(1) : value}×`;
}

const PLAYER_SOURCE_BADGE_CLASS = "gap-1.5 pl-1";

const PLAYER_SOURCE_ICON_CLASS =
    "inline-flex size-4 flex-none shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-background data-[sot-source-icon=letter]:bg-muted data-[sot-source-icon=letter]:text-[9px] data-[sot-source-icon=letter]:font-bold data-[sot-source-icon=letter]:text-muted-foreground [&[data-sot-cover=true]_img]:object-cover";

const PLAYER_SOURCE_ICON_IMAGE_CLASS = "block size-4 max-w-none object-contain";

const PLAYER_TAG_COLOR_CLASS: Record<RecordingTag["color"], string> = {
    blue: "text-chart-1",
    green: "text-chart-3",
    orange: "text-chart-4",
    purple: "text-chart-5",
    red: "text-destructive",
    slate: "text-muted-foreground",
};

const PLAYER_TAG_CHIP_CLASS = "max-w-[160px] justify-start gap-1.5";
const PLAYER_TAG_OVERFLOW_CLASS = "border-dashed";

export function SotPlayerSourceTag({
    label,
    provider,
}: {
    label?: string;
    provider: string;
}) {
    const badge =
        SOT_SOURCE_BADGES[provider as keyof typeof SOT_SOURCE_BADGES] ?? null;
    const sourceLabel = label ?? badge?.label ?? provider;
    const hasImage = Boolean(badge?.icon);

    return (
        <Badge
            variant="outline"
            className={PLAYER_SOURCE_BADGE_CLASS}
            data-sot-control="player-source-tag"
            data-sot-provider={provider}
        >
            <span
                className={PLAYER_SOURCE_ICON_CLASS}
                data-sot-cover={badge?.cover ? "true" : "false"}
                data-sot-part="source-icon"
                data-sot-source-icon={hasImage ? "image" : "letter"}
                aria-hidden="true"
            >
                {badge?.icon ? (
                    <Image
                        className={PLAYER_SOURCE_ICON_IMAGE_CLASS}
                        src={badge.icon}
                        alt=""
                        width={16}
                        height={16}
                    />
                ) : (
                    (badge?.letter ??
                    sourceFallbackLetter(provider, sourceLabel))
                )}
            </span>
            {sourceLabel}
        </Badge>
    );
}

export function SotPlayerTagChip({
    count = 1,
    onClick,
    state = "idle",
    tag,
    trigger = false,
}: {
    count?: number;
    onClick?: () => void;
    state?: "idle" | "open";
    tag: RecordingTag | null;
    trigger?: boolean;
}) {
    if (!tag) {
        if (!trigger) {
            return null;
        }

        return (
            <Button
                variant="outline"
                size="xs"
                className="border-dashed"
                aria-expanded={trigger ? state === "open" : undefined}
                data-recording-tag-add=""
                data-sot-control={trigger ? "recording-tag-manager" : undefined}
                data-sot-part="recording-tag-add"
                data-sot-state={trigger ? state : undefined}
                onClick={onClick}
                type="button"
            >
                <Plus data-icon="inline-start" aria-hidden="true" />
                <span>标签</span>
            </Button>
        );
    }

    if (!onClick) {
        return (
            <>
                <Badge
                    variant="secondary"
                    className={cn(
                        PLAYER_TAG_CHIP_CLASS,
                        PLAYER_TAG_COLOR_CLASS[tag.color],
                    )}
                    data-recording-tag-chip=""
                    data-tag-id={tag.id}
                    data-sot-tag-color={tag.color}
                    data-sot-tag-icon={tag.icon}
                    data-sot-part="recording-tag-chip"
                    data-sot-control={
                        trigger ? "recording-tag-manager" : undefined
                    }
                    data-sot-state={trigger ? state : undefined}
                >
                    <RecordingTagIconGlyph icon={tag.icon} />
                    {tag.name}
                </Badge>
                {count > 1 ? (
                    <Badge
                        variant="outline"
                        className={PLAYER_TAG_OVERFLOW_CLASS}
                        data-recording-tag-overflow=""
                        data-sot-part="recording-tag-overflow"
                    >
                        +{count - 1}
                    </Badge>
                ) : null}
            </>
        );
    }

    return (
        <>
            <Button
                variant="secondary"
                size="xs"
                className={cn(
                    PLAYER_TAG_CHIP_CLASS,
                    PLAYER_TAG_COLOR_CLASS[tag.color],
                    state === "open" && "ring-1 ring-ring",
                )}
                type="button"
                data-tag-id={tag.id}
                data-recording-tag-chip=""
                data-sot-tag-color={tag.color}
                data-sot-tag-icon={tag.icon}
                data-sot-part="recording-tag-chip"
                data-sot-control={trigger ? "recording-tag-manager" : undefined}
                data-sot-state={trigger ? state : undefined}
                onClick={onClick}
                aria-expanded={trigger ? state === "open" : undefined}
            >
                <span data-icon="inline-start">
                    <RecordingTagIconGlyph icon={tag.icon} />
                </span>
                {tag.name}
            </Button>
            {count > 1 ? (
                <Button
                    variant="outline"
                    size="xs"
                    className={PLAYER_TAG_OVERFLOW_CLASS}
                    type="button"
                    data-recording-tag-overflow=""
                    data-sot-part="recording-tag-overflow"
                    onClick={onClick}
                    aria-expanded={trigger ? state === "open" : undefined}
                >
                    +{count - 1}
                </Button>
            ) : null}
        </>
    );
}

export type SotPlayerStatusTone = "ok" | "warn" | "err" | "info" | "neu";

const PLAYER_STATUS_VARIANT: Record<
    SotPlayerStatusTone,
    React.ComponentProps<typeof Badge>["variant"]
> = {
    err: "destructive",
    info: "secondary",
    neu: "outline",
    ok: "secondary",
    warn: "secondary",
};

export function SotPlayerStatusBadge({
    className,
    label = "已更新",
    tone = "ok",
}: {
    className?: string;
    label?: string;
    tone?: SotPlayerStatusTone;
}) {
    return (
        <Badge
            variant={PLAYER_STATUS_VARIANT[tone]}
            className={className}
            data-sot-control="player-status"
            data-sot-tone={tone}
        >
            <span data-sot-part="status-label">{label}</span>
        </Badge>
    );
}

export function sotPlayerVolumeLevel(volume: number) {
    return volume === 0
        ? "mute"
        : volume < 35
          ? "low"
          : volume < 70
            ? "mid"
            : "high";
}

const PLAYER_NO_AUDIO_TEXT_CLASS = "flex min-w-0 flex-col gap-px";

type SotPlayerNoAudioAlertProps = Omit<
    React.ComponentProps<typeof Alert>,
    "children" | "density" | "layout" | "style" | "variant"
> & {
    descriptionPart: string;
    iconPart: string;
    part: string;
    playbackDisabled: boolean;
    textPart: string;
    titlePart: string;
};

export function SotPlayerNoAudioAlert({
    className,
    descriptionPart,
    iconPart,
    part,
    playbackDisabled,
    textPart,
    titlePart,
    ...props
}: SotPlayerNoAudioAlertProps) {
    return (
        <Alert
            {...props}
            variant="default"
            density="comfortable"
            layout="inline"
            className={cn("mb-3", className)}
            data-sot-part={part}
            data-sot-state={playbackDisabled ? "visible" : "hidden"}
            hidden={!playbackDisabled}
            role="status"
        >
            <VolumeX data-icon="inline-start" data-sot-part={iconPart} />
            <span
                className={PLAYER_NO_AUDIO_TEXT_CLASS}
                data-player-no-audio-text=""
                data-sot-part={textPart}
            >
                <AlertTitle data-sot-part={titlePart}>
                    来源仅同步转写与报告
                </AlertTitle>
                <AlertDescription
                    density="comfortable"
                    data-sot-part={descriptionPart}
                >
                    这条录音没有本地音频，无法播放或运行私有重转写。
                </AlertDescription>
            </span>
        </Alert>
    );
}
