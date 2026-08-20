"use client";

import { Plus, VolumeX } from "lucide-react";
import Image from "next/image";
import type * as React from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecordingTag } from "@/lib/recording-tags";
import { cn } from "@/lib/utils";
import { RecordingTagIconGlyph } from "./recording-tag-visuals";

const PLAYER_SOURCE_BADGES = {
    "dingtalk-a1": {
        label: "钉钉",
        icon: "/assets/sources/dingtalk.svg",
        imageHeight: 1024,
        imageWidth: 1024,
        cover: false,
        letter: "钉",
    },
    ticnote: {
        label: "TicNote",
        icon: "/assets/sources/ticnote.png",
        imageHeight: 382,
        imageWidth: 354,
        cover: false,
        letter: "T",
    },
    plaud: {
        label: "Plaud",
        icon: "/assets/sources/plaud.png",
        imageHeight: 600,
        imageWidth: 600,
        cover: true,
        letter: "P",
    },
    "feishu-minutes": {
        label: "飞书妙记",
        icon: "/assets/sources/feishu.jpeg",
        imageHeight: 400,
        imageWidth: 400,
        cover: true,
        letter: "飞",
    },
    iflyrec: {
        label: "讯飞听见",
        icon: null,
        imageHeight: 0,
        imageWidth: 0,
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

export function formatPlayerDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} · ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatPlayerTime(value: number) {
    const seconds =
        value > 10_000 ? Math.floor(value / 1000) : Math.floor(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${pad2(secs)}`;
}

export function formatPlaybackSpeed(value: number) {
    return `${Number.isInteger(value) ? value.toFixed(1) : value}×`;
}

const PLAYER_SOURCE_BADGE_CLASS = "gap-1.5 pl-1";

const PLAYER_SOURCE_ICON_CLASS =
    "inline-flex size-4 flex-none shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-background data-[source-icon=letter]:bg-muted data-[source-icon=letter]:text-[9px] data-[source-icon=letter]:font-bold data-[source-icon=letter]:text-muted-foreground [&[data-cover=true]_img]:object-cover";

const PLAYER_SOURCE_ICON_IMAGE_CLASS =
    "block h-4 w-auto max-w-none object-contain";

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

export function PlayerSourceTag({
    label,
    provider,
}: {
    label?: string;
    provider: string;
}) {
    const badge =
        PLAYER_SOURCE_BADGES[provider as keyof typeof PLAYER_SOURCE_BADGES] ??
        null;
    const sourceLabel = label ?? badge?.label ?? provider;
    const hasImage = Boolean(badge?.icon);

    return (
        <Badge
            variant="outline"
            className={PLAYER_SOURCE_BADGE_CLASS}
            data-control="player-source-tag"
            data-provider={provider}
        >
            <span
                className={PLAYER_SOURCE_ICON_CLASS}
                data-cover={badge?.cover ? "true" : "false"}
                data-part="source-icon"
                data-source-icon={hasImage ? "image" : "letter"}
                aria-hidden="true"
            >
                {badge?.icon ? (
                    <Image
                        className={PLAYER_SOURCE_ICON_IMAGE_CLASS}
                        src={badge.icon}
                        alt=""
                        width={badge.imageWidth}
                        height={badge.imageHeight}
                        unoptimized
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

export function PlayerTagChip({
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
    const { t } = useLanguage();

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
                data-control={trigger ? "recording-tag-manager" : undefined}
                data-part="recording-tag-add"
                data-state={trigger ? state : undefined}
                onClick={onClick}
                type="button"
            >
                <Plus data-icon="inline-start" aria-hidden="true" />
                <span>{t("recordingDetail.player.tags")}</span>
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
                    data-tag-color={tag.color}
                    data-tag-icon={tag.icon}
                    data-part="recording-tag-chip"
                    data-control={trigger ? "recording-tag-manager" : undefined}
                    data-state={trigger ? state : undefined}
                >
                    <RecordingTagIconGlyph icon={tag.icon} />
                    {tag.name}
                </Badge>
                {count > 1 ? (
                    <Badge
                        variant="outline"
                        className={PLAYER_TAG_OVERFLOW_CLASS}
                        data-recording-tag-overflow=""
                        data-part="recording-tag-overflow"
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
                data-tag-color={tag.color}
                data-tag-icon={tag.icon}
                data-part="recording-tag-chip"
                data-control={trigger ? "recording-tag-manager" : undefined}
                data-state={trigger ? state : undefined}
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
                    data-part="recording-tag-overflow"
                    onClick={onClick}
                    aria-expanded={trigger ? state === "open" : undefined}
                >
                    +{count - 1}
                </Button>
            ) : null}
        </>
    );
}

export type PlayerStatusTone = "ok" | "warn" | "err" | "info" | "neu";

const PLAYER_STATUS_VARIANT: Record<
    PlayerStatusTone,
    React.ComponentProps<typeof Badge>["variant"]
> = {
    err: "destructive",
    info: "secondary",
    neu: "outline",
    ok: "secondary",
    warn: "secondary",
};

export function PlayerStatusBadge({
    className,
    label,
    tone = "ok",
}: {
    className?: string;
    label?: string;
    tone?: PlayerStatusTone;
}) {
    const { t } = useLanguage();

    return (
        <Badge
            variant={PLAYER_STATUS_VARIANT[tone]}
            className={className}
            data-control="player-status"
            data-tone={tone}
        >
            <span
                className="size-[5px] shrink-0 rounded-full bg-current"
                aria-hidden="true"
            />
            <span data-part="status-label">
                {label ?? t("recordingDetail.player.updated")}
            </span>
        </Badge>
    );
}

export function playerVolumeLevel(volume: number) {
    return volume === 0
        ? "mute"
        : volume < 35
          ? "low"
          : volume < 70
            ? "mid"
            : "high";
}

const PLAYER_NO_AUDIO_TEXT_CLASS = "flex min-w-0 flex-col gap-px";

type PlayerNoAudioAlertProps = Omit<
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

export function PlayerNoAudioAlert({
    className,
    descriptionPart,
    iconPart,
    part,
    playbackDisabled,
    textPart,
    titlePart,
    ...props
}: PlayerNoAudioAlertProps) {
    const { t } = useLanguage();

    return (
        <Alert
            {...props}
            variant="default"
            density="comfortable"
            layout="inline"
            className={cn("mb-3", className)}
            data-part={part}
            data-state={playbackDisabled ? "visible" : "hidden"}
            hidden={!playbackDisabled}
            role="status"
        >
            <VolumeX data-icon="inline-start" data-part={iconPart} />
            <span
                className={PLAYER_NO_AUDIO_TEXT_CLASS}
                data-player-no-audio-text=""
                data-part={textPart}
            >
                <AlertTitle data-part={titlePart}>
                    {t("recordingDetail.player.noAudioTitle")}
                </AlertTitle>
                <AlertDescription
                    density="comfortable"
                    data-part={descriptionPart}
                >
                    {t("recordingDetail.player.noAudioDescription")}
                </AlertDescription>
            </span>
        </Alert>
    );
}
