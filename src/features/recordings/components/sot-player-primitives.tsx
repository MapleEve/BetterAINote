"use client";

import { Plus } from "lucide-react";
import type * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import { PopoverContent } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
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

type SotPlayerSliderProps = Omit<
    React.ComponentProps<typeof Slider>,
    "variant"
>;

type SotPlayerVolumePopoverContentProps = Omit<
    React.ComponentProps<typeof PopoverContent>,
    "variant"
>;

type SotPlayerButtonProps = Omit<ButtonProps, "variant" | "size">;

type SotPlayerControlButtonProps = SotPlayerButtonProps & {
    controlSize?: "default" | "sm";
};

const SOT_PLAYER_CONTROL_BUTTON_CLASS =
    "border border-[var(--line-hairline)] bg-[var(--bg-elevated)] text-[var(--fg-secondary)] [box-shadow:var(--shadow-xs)] hover:bg-white hover:text-[var(--fg-primary)] active:scale-[0.96] dark:hover:bg-[rgb(255_255_255_/_0.08)] [&_[data-player-control-icon]_svg]:fill-none [&_[data-player-control-icon]_svg]:stroke-current [&_[data-player-control-icon]_svg]:stroke-[1.8]";

const SOT_PLAYER_CONTROL_BUTTON_SIZE_CLASS =
    "size-[36px] rounded-[50%] px-[6px] py-px text-[13.3333px] font-normal";

const SOT_PLAYER_CONTROL_BUTTON_SM_SIZE_CLASS =
    "size-[30px] rounded-[50%] px-[6px] py-px text-[13.3333px] font-normal";

const SOT_PLAYER_PRIMARY_BUTTON_CLASS =
    "border border-[color-mix(in_srgb,var(--accent)_60%,black_8%)] [background:linear-gradient(180deg,color-mix(in_srgb,var(--accent)_92%,white_18%),var(--accent))] text-white [box-shadow:0_6px_16px_color-mix(in_srgb,var(--accent)_28%,transparent),inset_0_1px_0_rgb(255_255_255_/_0.25)] hover:text-white active:scale-[0.96]";

const SOT_PLAYER_PRIMARY_BUTTON_SIZE_CLASS =
    "size-[44px] rounded-[50%] px-[6px] py-px text-[13.3333px] font-normal";

const SOT_PLAYER_SPEED_BUTTON_CLASS =
    "border border-transparent bg-transparent [font:600_12.5px_var(--font-mono)] leading-[normal] tracking-normal [font-kerning:auto] [font-feature-settings:normal] tabular-nums text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)] active:translate-y-[0.5px]";

const SOT_PLAYER_SPEED_BUTTON_SIZE_CLASS =
    "h-[32px] min-w-[50px] justify-center rounded-[9px] px-[12px]";

export function SotPlayerControlButton({
    className,
    controlSize = "default",
    ...props
}: SotPlayerControlButtonProps) {
    return (
        <Button
            {...props}
            variant="ghost"
            size="icon"
            className={cn(
                SOT_PLAYER_CONTROL_BUTTON_CLASS,
                controlSize === "sm"
                    ? SOT_PLAYER_CONTROL_BUTTON_SM_SIZE_CLASS
                    : SOT_PLAYER_CONTROL_BUTTON_SIZE_CLASS,
                className,
            )}
        />
    );
}

export function SotPlayerPrimaryButton({
    className,
    ...props
}: SotPlayerButtonProps) {
    return (
        <Button
            {...props}
            variant="ghost"
            size="icon"
            className={cn(
                SOT_PLAYER_PRIMARY_BUTTON_CLASS,
                SOT_PLAYER_PRIMARY_BUTTON_SIZE_CLASS,
                className,
            )}
        />
    );
}

export function SotPlayerSpeedButton({
    className,
    ...props
}: SotPlayerButtonProps) {
    return (
        <Button
            {...props}
            variant="ghost"
            size="sm"
            className={cn(
                SOT_PLAYER_SPEED_BUTTON_CLASS,
                SOT_PLAYER_SPEED_BUTTON_SIZE_CLASS,
                className,
            )}
        />
    );
}

const SOT_PLAYER_SEEK_SLIDER_CLASS =
    "h-[14px] min-w-0 flex-1 cursor-pointer data-[disabled]:cursor-default [&_[data-slot=slider-track]]:bg-[var(--graphite-200)] [&_[data-slot=slider-track]]:rounded-[999px] [&_[data-slot=slider-track]]:[box-shadow:inset_0_1px_1px_rgb(0_0_0_/_0.04)] [&_[data-slot=slider-track][data-orientation=horizontal]]:h-[6px]";

const SOT_PLAYER_SEEK_RANGE_CLASS =
    "bg-[image:linear-gradient(90deg,var(--steel-500),var(--accent))]";

const SOT_PLAYER_SEEK_THUMB_CLASS =
    "size-[14px] border-0 bg-white p-0 shadow-[0_1px_4px_rgb(0_0_0_/_0.15),0_0_0_1px_var(--line-hairline)]";

const SOT_PLAYER_VOLUME_SLIDER_CLASS = "h-[18px] min-w-[110px] flex-1";

const SOT_PLAYER_VOLUME_POPOVER_CONTENT_CLASS =
    "w-[200px] min-w-[200px] gap-0 overflow-visible px-2.5 py-2";

export function SotPlayerSeekSlider({
    className,
    rangeProps,
    thumbProps,
    ...props
}: SotPlayerSliderProps) {
    const { className: rangeClassName, ...rangePrimitiveProps } =
        rangeProps ?? {};
    const { className: thumbClassName, ...thumbPrimitiveProps } =
        thumbProps ?? {};

    return (
        <Slider
            {...props}
            className={cn(SOT_PLAYER_SEEK_SLIDER_CLASS, className)}
            rangeProps={{
                ...rangePrimitiveProps,
                className: cn(SOT_PLAYER_SEEK_RANGE_CLASS, rangeClassName),
            }}
            thumbProps={{
                ...thumbPrimitiveProps,
                className: cn(SOT_PLAYER_SEEK_THUMB_CLASS, thumbClassName),
            }}
        />
    );
}

export function SotPlayerVolumeSlider({
    className,
    ...props
}: SotPlayerSliderProps) {
    return (
        <Slider
            {...props}
            className={cn(SOT_PLAYER_VOLUME_SLIDER_CLASS, className)}
        />
    );
}

export function SotPlayerVolumePopoverContent({
    className,
    ...props
}: SotPlayerVolumePopoverContentProps) {
    return (
        <PopoverContent
            {...props}
            className={cn(SOT_PLAYER_VOLUME_POPOVER_CONTENT_CLASS, className)}
        />
    );
}

const SOT_PLAYER_SOURCE_BADGE_CLASS =
    "h-[22px] flex-none justify-normal gap-[6px] rounded-[6px] border-[var(--line-hairline)] bg-[var(--bg-elevated)] py-0 pl-[3px] pr-[8px] [font:600_11.5px_var(--font-sans)] text-[var(--fg-secondary)] shadow-[var(--shadow-xs)] dark:border-[var(--glass-border)] dark:bg-[rgb(255_255_255_/_0.04)] dark:text-[var(--fg-primary)]";

const SOT_PLAYER_SOURCE_ICON_CLASS =
    "inline-flex size-[16px] flex-none shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-[var(--line-hairline)] bg-white data-[sot-source-icon=letter]:bg-[var(--bg-recessed)] data-[sot-source-icon=letter]:[font:700_9px_var(--font-sans)] data-[sot-source-icon=letter]:text-[var(--fg-secondary)] [&[data-sot-cover=true]_img]:object-cover";

const SOT_PLAYER_SOURCE_ICON_IMAGE_CLASS =
    "block size-[16px] max-w-none object-contain";

const SOT_PLAYER_TAG_CHIP_VARIABLES_CLASS =
    "[--sot-player-tag-chip-bg:color-mix(in_srgb,var(--tag-c)_12%,var(--bg-elevated))] [--sot-player-tag-chip-border:color-mix(in_srgb,var(--tag-c)_32%,transparent)] [--sot-player-tag-chip-fg:color-mix(in_srgb,var(--tag-c)_72%,var(--fg-primary))] dark:[--sot-player-tag-chip-bg:color-mix(in_srgb,var(--tag-c)_18%,transparent)] dark:[--sot-player-tag-chip-border:color-mix(in_srgb,var(--tag-c)_36%,transparent)] dark:[--sot-player-tag-chip-fg:color-mix(in_srgb,var(--tag-c)_30%,var(--fg-primary))]";

const SOT_PLAYER_TAG_BADGE_CLASS =
    `${SOT_PLAYER_TAG_CHIP_VARIABLES_CLASS} h-[22px] w-fit justify-normal gap-[5px] rounded-[6px] border-[var(--sot-player-tag-chip-border)] bg-[var(--sot-player-tag-chip-bg)] py-0 pl-[7px] pr-[9px] [font:600_11.5px_var(--font-sans)] text-[var(--sot-player-tag-chip-fg)] shadow-[var(--shadow-xs)] transition-none data-[sot-state=open]:border-[var(--line-strong)] data-[sot-state=open]:bg-[var(--bg-recessed)] data-[sot-tag-color=blue]:[--tag-c:var(--tag-blue)] data-[sot-tag-color=green]:[--tag-c:var(--tag-green)] data-[sot-tag-color=orange]:[--tag-c:var(--tag-amber)] data-[sot-tag-color=purple]:[--tag-c:var(--tag-violet)] data-[sot-tag-color=red]:[--tag-c:var(--tag-rose)] data-[sot-tag-color=slate]:[--tag-c:var(--tag-slate)] [--tag-c:var(--graphite-500)] [&>svg]:size-[11px] [&>svg]:fill-none [&>svg]:stroke-2 [&>svg]:stroke-current [&>svg]:[stroke-linecap:round] [&>svg]:[stroke-linejoin:round]`;

const SOT_PLAYER_TAG_OVERFLOW_BADGE_CLASS =
    "h-[22px] justify-normal gap-[4px] rounded-[6px] border-dashed border-[var(--line-hairline)] bg-[var(--bg-recessed)] px-[8px] py-0 text-[11px] font-semibold text-[var(--fg-tertiary)] shadow-none [a&]:hover:border-[var(--line-strong)] [a&]:hover:bg-transparent [a&]:hover:text-[var(--fg-primary)]";

const SOT_PLAYER_TAG_ADD_BUTTON_CLASS =
    "border border-dashed border-[var(--line-hairline)] bg-transparent text-[var(--fg-tertiary)] shadow-none hover:border-[var(--line-strong)] hover:bg-transparent hover:text-[var(--fg-primary)] [&_svg]:stroke-current h-[22px] gap-[5px] rounded-[6px] px-[8px] text-[11px] font-semibold leading-normal has-[>svg]:px-[8px] [&_svg:not([class*='size-'])]:size-3";

const SOT_PLAYER_TAG_CHIP_BUTTON_CLASS =
    `${SOT_PLAYER_TAG_CHIP_VARIABLES_CLASS} justify-normal border border-[var(--sot-player-tag-chip-border)] bg-[var(--sot-player-tag-chip-bg)] text-[var(--sot-player-tag-chip-fg)] shadow-[var(--shadow-xs)] transition-none hover:bg-[var(--sot-player-tag-chip-bg)] hover:text-[var(--sot-player-tag-chip-fg)] data-[sot-state=open]:border-[var(--line-strong)] data-[sot-state=open]:bg-[var(--bg-recessed)] data-[sot-tag-color=blue]:[--tag-c:var(--tag-blue)] data-[sot-tag-color=green]:[--tag-c:var(--tag-green)] data-[sot-tag-color=orange]:[--tag-c:var(--tag-amber)] data-[sot-tag-color=purple]:[--tag-c:var(--tag-violet)] data-[sot-tag-color=red]:[--tag-c:var(--tag-rose)] data-[sot-tag-color=slate]:[--tag-c:var(--tag-slate)] [--tag-c:var(--graphite-500)] h-[22px] w-fit gap-[5px] rounded-[6px] py-0 pl-[7px] pr-[9px] [font:600_11.5px_var(--font-sans)] [&_[data-icon=inline-start]]:inline-flex [&_[data-icon=inline-start]]:size-[11px] [&_[data-icon=inline-start]]:flex-none [&_[data-icon=inline-start]]:items-center [&_[data-icon=inline-start]]:justify-center [&_svg:not([class*='size-'])]:size-[11px] [&_svg]:fill-none [&_svg]:stroke-2 [&_svg]:stroke-current [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]`;

const SOT_PLAYER_TAG_OVERFLOW_BUTTON_CLASS =
    "border border-dashed border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-tertiary)] shadow-none hover:border-[var(--line-strong)] hover:bg-transparent hover:text-[var(--fg-primary)] h-[22px] gap-[4px] rounded-[6px] px-[8px] text-[11px] font-semibold leading-normal";

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
            variant="ghost"
            className={SOT_PLAYER_SOURCE_BADGE_CLASS}
            data-sot-control="player-source-tag"
            data-sot-provider={provider}
        >
            <span
                className={SOT_PLAYER_SOURCE_ICON_CLASS}
                data-sot-cover={badge?.cover ? "true" : "false"}
                data-sot-part="source-icon"
                data-sot-source-icon={hasImage ? "image" : "letter"}
                aria-hidden="true"
            >
                {badge?.icon ? (
                    <img
                        className={SOT_PLAYER_SOURCE_ICON_IMAGE_CLASS}
                        src={badge.icon}
                        alt=""
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
                variant="ghost"
                size="xs"
                className={SOT_PLAYER_TAG_ADD_BUTTON_CLASS}
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
                    variant="ghost"
                    className={SOT_PLAYER_TAG_BADGE_CLASS}
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
                        variant="ghost"
                        className={SOT_PLAYER_TAG_OVERFLOW_BADGE_CLASS}
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
                variant="ghost"
                size="xs"
                className={SOT_PLAYER_TAG_CHIP_BUTTON_CLASS}
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
                    variant="ghost"
                    size="xs"
                    className={SOT_PLAYER_TAG_OVERFLOW_BUTTON_CLASS}
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

const SOT_PLAYER_STATUS_BADGE_CLASS =
    "[--sot-player-status-ok-bg:color-mix(in_srgb,var(--signal-success)_14%,transparent)] [--sot-player-status-ok-border:color-mix(in_srgb,var(--signal-success)_30%,transparent)] [--sot-player-status-info-bg:color-mix(in_srgb,var(--signal-info)_14%,transparent)] [--sot-player-status-info-border:color-mix(in_srgb,var(--signal-info)_30%,transparent)] [--sot-player-status-warn-bg:color-mix(in_srgb,var(--signal-warning)_18%,transparent)] [--sot-player-status-warn-border:color-mix(in_srgb,var(--signal-warning)_32%,transparent)] [--sot-player-status-err-bg:color-mix(in_srgb,var(--signal-danger)_14%,transparent)] [--sot-player-status-err-border:color-mix(in_srgb,var(--signal-danger)_30%,transparent)] h-[20px] min-w-[65.171875px] justify-normal gap-[5px] overflow-visible rounded-full border px-[8px] py-0 [font:600_11px_var(--font-sans)] tracking-[0.005em] shadow-none data-[sot-tone=ok]:border-[var(--sot-player-status-ok-border)] data-[sot-tone=ok]:bg-[var(--sot-player-status-ok-bg)] data-[sot-tone=ok]:text-[var(--signal-success)] data-[sot-tone=warn]:border-[var(--sot-player-status-warn-border)] data-[sot-tone=warn]:bg-[var(--sot-player-status-warn-bg)] data-[sot-tone=warn]:text-[var(--signal-warning-strong)] data-[sot-tone=err]:border-[var(--sot-player-status-err-border)] data-[sot-tone=err]:bg-[var(--sot-player-status-err-bg)] data-[sot-tone=err]:text-[var(--signal-danger)] data-[sot-tone=info]:border-[var(--sot-player-status-info-border)] data-[sot-tone=info]:bg-[var(--sot-player-status-info-bg)] data-[sot-tone=info]:text-[var(--signal-info)] data-[sot-tone=neu]:border-[var(--line-hairline)] data-[sot-tone=neu]:bg-[var(--bg-recessed)] data-[sot-tone=neu]:text-[var(--fg-secondary)] [&_[data-sot-part=status-dot]]:size-[5px] [&_[data-sot-part=status-dot]]:rounded-full [&_[data-sot-part=status-dot]]:bg-current data-[sot-tone=warn]:[&_[data-sot-part=status-dot]]:animate-[bpulse_1.4s_ease-in-out_infinite] [&_[data-sot-part=status-label]]:ml-[4px]";

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
            variant="ghost"
            className={cn(SOT_PLAYER_STATUS_BADGE_CLASS, className)}
            data-sot-control="player-status"
            data-sot-tone={tone}
        >
            <span data-sot-part="status-dot" />
            <span data-sot-part="status-label">{label}</span>
        </Badge>
    );
}

export function SotPlayerBackIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M19 20 9 12l10-8z" />
            <path d="M5 19V5" />
        </svg>
    );
}

export function SotPlayerForwardIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d="m5 4 10 8-10 8z" />
            <path d="M19 5v14" />
        </svg>
    );
}

export function SotPlayerPlayIcon() {
    return (
        <svg
            className="block size-[18px]"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
    );
}

export function SotPlayerPauseIcon() {
    return (
        <svg
            className="block size-[18px]"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
        </svg>
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

export function SotPlayerVolumeIcon({
    className,
    volume,
}: {
    className?: string;
    volume: number;
}) {
    const level = sotPlayerVolumeLevel(volume);

    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {level === "mute" ? (
                <>
                    <line x1="22" y1="9" x2="16" y2="15" />
                    <line x1="16" y1="9" x2="22" y2="15" />
                </>
            ) : null}
            {level === "low" || level === "mid" || level === "high" ? (
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            ) : null}
            {level === "high" ? (
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            ) : null}
        </svg>
    );
}

export function SotPlayerNoAudioIcon({
    className,
    ...props
}: React.ComponentProps<"svg"> = {}) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            className={cn("size-4", className)}
            {...props}
        >
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
    );
}

const SOT_PLAYER_NO_AUDIO_ALERT_CLASS =
    "mb-3 flex w-full items-center gap-2.5 rounded-[10px] border border-[var(--system-banner-offline-border)] bg-[var(--system-banner-offline-bg)] px-3 py-2.5 text-[12.5px] leading-normal text-[var(--fg-primary)] [&[hidden]]:hidden";

const SOT_PLAYER_NO_AUDIO_ICON_CLASS =
    "inline-grid size-[26px] flex-none place-items-center rounded-[50%] bg-[color-mix(in_srgb,var(--signal-warning)_18%,transparent)] text-[var(--signal-warning)] [&_svg]:size-[14px]";

const SOT_PLAYER_NO_AUDIO_TEXT_CLASS = "flex min-w-0 flex-col gap-px";

const SOT_PLAYER_NO_AUDIO_TITLE_CLASS =
    "min-h-0 overflow-visible font-sans text-[12.5px] font-semibold leading-normal tracking-normal text-[var(--fg-primary)] [display:block] [-webkit-box-orient:unset] [-webkit-line-clamp:unset]";

const SOT_PLAYER_NO_AUDIO_DESCRIPTION_CLASS =
    "block font-sans text-[11.5px] font-medium leading-[1.5] text-[var(--fg-tertiary)] [&_p]:leading-[1.5]";

type SotPlayerNoAudioAlertProps = Omit<
    React.ComponentProps<typeof Alert>,
    "children" | "density" | "layout" | "variant"
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
    style,
    textPart,
    titlePart,
    ...props
}: SotPlayerNoAudioAlertProps) {
    return (
        <Alert
            {...props}
            className={cn(SOT_PLAYER_NO_AUDIO_ALERT_CLASS, className)}
            data-sot-part={part}
            data-sot-state={playbackDisabled ? "visible" : "hidden"}
            hidden={!playbackDisabled}
            role="status"
            style={{
                alignItems: "center",
                background: "var(--system-banner-offline-bg)",
                border: "1px solid var(--system-banner-offline-border)",
                boxSizing: "border-box",
                display: playbackDisabled ? "flex" : "none",
                gap: "10px",
                height: "57px",
                marginBottom: "13px",
                padding: "10px 12px",
                ...style,
            }}
        >
            <span
                className={SOT_PLAYER_NO_AUDIO_ICON_CLASS}
                data-icon="inline-start"
                data-sot-part={iconPart}
            >
                <SotPlayerNoAudioIcon />
            </span>
            <span
                className={SOT_PLAYER_NO_AUDIO_TEXT_CLASS}
                data-player-no-audio-text=""
                data-sot-part={textPart}
            >
                <AlertTitle
                    className={SOT_PLAYER_NO_AUDIO_TITLE_CLASS}
                    data-sot-part={titlePart}
                    style={{
                        color: "var(--fg-primary)",
                        display: "block",
                        font: "600 12.5px var(--font-sans)",
                        letterSpacing: "normal",
                        minHeight: 0,
                    }}
                >
                    来源仅同步转写与报告
                </AlertTitle>
                <AlertDescription
                    className={SOT_PLAYER_NO_AUDIO_DESCRIPTION_CLASS}
                    data-sot-part={descriptionPart}
                    style={{
                        color: "var(--fg-tertiary)",
                        display: "block",
                        font: "500 11.5px/1.5 var(--font-sans)",
                    }}
                >
                    这条录音没有本地音频，无法播放或运行私有重转写。
                </AlertDescription>
            </span>
        </Alert>
    );
}
