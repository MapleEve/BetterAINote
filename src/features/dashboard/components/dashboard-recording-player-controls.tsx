"use client";

import type { CSSProperties, ReactNode } from "react";
import { CardContent } from "@/components/ui/card";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
    formatSotPlayerTime,
    SotPlayerBackIcon,
    SotPlayerControlButton,
    SotPlayerForwardIcon,
    SotPlayerPauseIcon,
    SotPlayerPlayIcon,
    SotPlayerPrimaryButton,
    SotPlayerSeekSlider,
    SotPlayerSpeedButton,
    SotPlayerVolumeIcon,
    SotPlayerVolumePopoverContent,
    SotPlayerVolumeSlider,
    sotPlayerVolumeLevel,
} from "@/features/recordings/components/sot-player-primitives";
import { cn } from "@/lib/utils";

const DASHBOARD_PLAYER_CONTROL_ICON_CLASS_NAME =
    "inline-flex items-center justify-center [&_svg]:size-4 [&_svg]:fill-current [&_svg]:stroke-current [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]";

const DASHBOARD_PLAYER_CONTROL_ICON_STYLE = {
    flex: "none",
    height: 16,
    lineHeight: 1,
    transformOrigin: "center",
    width: 16,
} satisfies CSSProperties;

const DASHBOARD_PLAYER_PRIMARY_CONTROL_ICON_CLASS_NAME =
    "inline-flex items-center justify-center [&_svg]:size-[18px] [&_svg]:fill-white [&_svg]:stroke-white [&_svg]:stroke-[1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]";

const DASHBOARD_PLAYER_PRIMARY_CONTROL_ICON_STYLE = {
    flex: "none",
    height: 18,
    lineHeight: 1,
    width: 18,
} satisfies CSSProperties;

const DASHBOARD_PLAYER_TIME_CLASS_NAME =
    "min-w-11 text-center font-mono text-xs font-medium tracking-[0.03em] text-[var(--fg-tertiary)]";

const DASHBOARD_PLAYER_DURATION_CLASS_NAME =
    "min-w-11 translate-x-[-0.109375px] text-center font-mono text-xs font-medium tracking-[0.03em] text-[var(--fg-tertiary)]";

const DASHBOARD_PLAYER_DISABLED_CLASS_NAME =
    "pointer-events-none opacity-[0.42] data-[disabled]:opacity-[0.42]";

const DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME =
    "disabled:cursor-not-allowed disabled:opacity-[0.42]";

const DASHBOARD_PLAYER_SPEED_CLASS_NAME =
    "max-[640px]:w-[50.75px] max-[640px]:min-w-[50.75px] max-[640px]:basis-[50.75px] max-[640px]:grow-0 max-[640px]:shrink-0";

type DashboardRecordingPlayerControlsProps = {
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    onCyclePlaybackSpeed: () => void;
    onSeekBySeconds: (seconds: number) => void;
    onSeekToPercent: (percent: number) => void;
    onTogglePlayPause: () => void;
    onVolumeChange: (volume: number) => void;
    onVolumeOpenChange: (open: boolean) => void;
    playbackDisabled: boolean;
    playbackSpeedLabel: string;
    progress: number;
    volume: number;
    volumePopoverOpen: boolean;
};

function DashboardPlayerControlIcon({
    children,
    transform,
}: {
    children: ReactNode;
    transform: string;
}) {
    return (
        <span
            className={DASHBOARD_PLAYER_CONTROL_ICON_CLASS_NAME}
            data-icon="inline-start"
            data-sot-part="dashboard-player-control-icon"
            style={{
                ...DASHBOARD_PLAYER_CONTROL_ICON_STYLE,
                transform,
            }}
        >
            {children}
        </span>
    );
}

function DashboardPlayerPrimaryControlIcon({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <span
            className={DASHBOARD_PLAYER_PRIMARY_CONTROL_ICON_CLASS_NAME}
            data-icon="inline-start"
            data-sot-part="dashboard-player-control-icon"
            style={DASHBOARD_PLAYER_PRIMARY_CONTROL_ICON_STYLE}
        >
            {children}
        </span>
    );
}

function DashboardPlayerSeekSlider({
    disabled,
    onSeekToPercent,
    progress,
    progressPct,
}: {
    disabled: boolean;
    onSeekToPercent: (percent: number) => void;
    progress: number;
    progressPct: number;
}) {
    const controlState = disabled ? "disabled" : "ready";

    return (
        <span
            className="relative block h-[14px] w-[168px] min-w-[168px] grow-0 shrink-0 basis-[168px]"
            data-sot-part="dashboard-player-seek-shell"
            style={{
                marginLeft: "3px",
                marginRight: "3px",
            }}
        >
            <SotPlayerSeekSlider
                className={cn(
                    "flex-none",
                    disabled && DASHBOARD_PLAYER_DISABLED_CLASS_NAME,
                )}
                disabled={disabled}
                data-pct={progressPct}
                data-sot-control="dashboard-player-seek"
                data-sot-state={controlState}
                max={100}
                min={0}
                rangeProps={{
                    "data-pct": progressPct,
                }}
                step={1}
                thumbProps={{
                    "data-pct": progressPct,
                    className: "-ml-[4.1875px]",
                }}
                rootProps={{
                    "aria-disabled": disabled ? "true" : undefined,
                    "aria-label": "播放进度",
                    "aria-valuemax": 100,
                    "aria-valuemin": 0,
                    "aria-valuenow": Math.round(progress),
                    "data-pct": progressPct,
                    "data-sot-control": "dashboard-player-seek",
                    "data-sot-state": controlState,
                    onClick: (event) => {
                        const rect =
                            event.currentTarget.getBoundingClientRect();
                        if (rect.width <= 0) {
                            return;
                        }
                        onSeekToPercent(
                            ((event.clientX - rect.left) / rect.width) * 100,
                        );
                    },
                    onKeyDown: (event) => {
                        if (event.key === "ArrowLeft") {
                            onSeekToPercent(progress - 5);
                        }
                        if (event.key === "ArrowRight") {
                            onSeekToPercent(progress + 5);
                        }
                        if (event.key === "Home") {
                            onSeekToPercent(0);
                        }
                        if (event.key === "End") {
                            onSeekToPercent(100);
                        }
                    },
                    role: "slider",
                    tabIndex: disabled ? -1 : 0,
                }}
                value={[progress]}
                onValueChange={(values) => onSeekToPercent(values[0] ?? 0)}
            />
        </span>
    );
}

function DashboardPlayerVolumeIcon({
    disabled,
    volume,
}: {
    disabled: boolean;
    volume: number;
}) {
    return (
        <DashboardPlayerControlIcon
            transform={
                disabled
                    ? "translate(0.875px, -0.625px)"
                    : "translate(-0.5px, -0.5px) scale(1.0625)"
            }
        >
            <SotPlayerVolumeIcon volume={volume} />
        </DashboardPlayerControlIcon>
    );
}

export function DashboardRecordingPlayerControls({
    currentTime,
    duration,
    isPlaying,
    onCyclePlaybackSpeed,
    onSeekBySeconds,
    onSeekToPercent,
    onTogglePlayPause,
    onVolumeChange,
    onVolumeOpenChange,
    playbackDisabled,
    playbackSpeedLabel,
    progress,
    volume,
    volumePopoverOpen,
}: DashboardRecordingPlayerControlsProps) {
    const volumeMuted = volume === 0;
    const playerControlsState = playbackDisabled
        ? "disabled"
        : volumeMuted
          ? "muted"
          : isPlaying
            ? "playing"
            : "ready";
    const playerControlState = playbackDisabled ? "disabled" : "ready";
    const playerProgressPct = Math.max(0, Math.min(100, Math.round(progress)));

    return (
        <CardContent
            className="flex min-w-0 items-center gap-[12px] overflow-visible p-0"
            aria-disabled={playbackDisabled ? "true" : undefined}
            data-sot-panel="dashboard-recording-player-controls"
            data-sot-state={playerControlsState}
        >
            <SotPlayerControlButton
                type="button"
                aria-label="后退 5 秒"
                className={DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME}
                data-sot-control="dashboard-player-back"
                data-sot-state={playerControlState}
                disabled={playbackDisabled}
                onClick={() => onSeekBySeconds(-5)}
            >
                <DashboardPlayerControlIcon
                    transform={
                        playbackDisabled
                            ? "translate(-0.5px, -0.5px)"
                            : "translate(-0.5px, -0.5px) scale(1.0625)"
                    }
                >
                    <SotPlayerBackIcon />
                </DashboardPlayerControlIcon>
            </SotPlayerControlButton>
            <SotPlayerPrimaryButton
                type="button"
                aria-label={isPlaying ? "暂停" : "播放"}
                className={DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME}
                data-playing={isPlaying ? "true" : "false"}
                data-sot-control="dashboard-player-play"
                data-sot-state={
                    playbackDisabled
                        ? "disabled"
                        : isPlaying
                          ? "playing"
                          : "paused"
                }
                disabled={playbackDisabled}
                onClick={onTogglePlayPause}
            >
                <DashboardPlayerPrimaryControlIcon>
                    {isPlaying ? <SotPlayerPauseIcon /> : <SotPlayerPlayIcon />}
                </DashboardPlayerPrimaryControlIcon>
            </SotPlayerPrimaryButton>
            <SotPlayerControlButton
                type="button"
                aria-label="前进 5 秒"
                className={DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME}
                data-sot-control="dashboard-player-forward"
                data-sot-state={playerControlState}
                disabled={playbackDisabled}
                onClick={() => onSeekBySeconds(5)}
            >
                <DashboardPlayerControlIcon
                    transform={
                        playbackDisabled
                            ? "translate(-0.25px, -0.5px)"
                            : "translate(-0.5px, -0.5px) scale(1.05)"
                    }
                >
                    <SotPlayerForwardIcon />
                </DashboardPlayerControlIcon>
            </SotPlayerControlButton>
            <span
                className={cn(
                    DASHBOARD_PLAYER_TIME_CLASS_NAME,
                    playbackDisabled && DASHBOARD_PLAYER_DISABLED_CLASS_NAME,
                )}
                data-sot-part="dashboard-player-current-time"
                style={{
                    font: "500 12px var(--font-mono)",
                    marginLeft: "1px",
                    marginRight: "-1px",
                    transform: "translateX(0.375px)",
                }}
            >
                {formatSotPlayerTime(currentTime)}
            </span>
            <DashboardPlayerSeekSlider
                disabled={playbackDisabled}
                onSeekToPercent={onSeekToPercent}
                progress={progress}
                progressPct={playerProgressPct}
            />
            <span
                className={cn(
                    DASHBOARD_PLAYER_DURATION_CLASS_NAME,
                    playbackDisabled && DASHBOARD_PLAYER_DISABLED_CLASS_NAME,
                )}
                data-sot-part="dashboard-player-duration"
                style={{
                    font: "500 12px var(--font-mono)",
                    left: "-2px",
                    position: "relative",
                    transform: "translateX(0.1875px)",
                }}
            >
                {formatSotPlayerTime(duration)}
            </span>
            <SotPlayerSpeedButton
                type="button"
                disabled={playbackDisabled}
                aria-label="切换播放倍速"
                className={cn(
                    DASHBOARD_PLAYER_SPEED_CLASS_NAME,
                    DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME,
                )}
                data-sot-control="dashboard-player-speed"
                data-sot-state={playerControlState}
                onClick={onCyclePlaybackSpeed}
            >
                <span
                    style={{
                        display: "inline-block",
                        transform: "translateX(-0.5px)",
                    }}
                >
                    {playbackSpeedLabel}
                </span>
            </SotPlayerSpeedButton>
            <Popover
                open={volumePopoverOpen}
                onOpenChange={(open) => onVolumeOpenChange(open)}
            >
                <div
                    className="relative ml-0 inline-flex"
                    data-sot-part="dashboard-player-volume-anchor"
                    style={{
                        transform: "translateX(-1px)",
                    }}
                >
                    <PopoverTrigger asChild>
                        <SotPlayerControlButton
                            controlSize="sm"
                            type="button"
                            aria-label={`音量 ${volume}`}
                            className={
                                DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME
                            }
                            aria-expanded={volumePopoverOpen}
                            title={`音量 ${volume}`}
                            data-level={sotPlayerVolumeLevel(volume)}
                            data-sot-control="dashboard-player-volume"
                            data-sot-state={
                                playbackDisabled
                                    ? "disabled"
                                    : volumePopoverOpen
                                      ? "open"
                                      : "closed"
                            }
                            data-sot-volume-state={
                                volumeMuted ? "muted" : "audible"
                            }
                            disabled={playbackDisabled}
                        >
                            <DashboardPlayerVolumeIcon
                                disabled={playbackDisabled}
                                volume={volume}
                            />
                        </SotPlayerControlButton>
                    </PopoverTrigger>
                    <SotPlayerVolumePopoverContent
                        align="end"
                        side="top"
                        sideOffset={8}
                        data-open={volumePopoverOpen ? "true" : "false"}
                        data-sot-panel="dashboard-player-volume-popover"
                        data-sot-state={volumePopoverOpen ? "open" : "closed"}
                        aria-label="音量"
                    >
                        <div
                            className="flex items-center gap-2"
                            data-sot-part="dashboard-player-volume-row"
                        >
                            <SotPlayerControlButton
                                controlSize="sm"
                                type="button"
                                aria-label="静音切换"
                                data-sot-control="dashboard-player-volume-mute"
                                data-sot-state={
                                    volumeMuted ? "muted" : "audible"
                                }
                                disabled={playbackDisabled}
                                onClick={() =>
                                    onVolumeChange(volumeMuted ? 70 : 0)
                                }
                            >
                                <span
                                    data-icon="inline-start"
                                    data-player-control-icon=""
                                    data-sot-part="dashboard-player-volume-icon"
                                >
                                    <SotPlayerVolumeIcon volume={volume} />
                                </span>
                            </SotPlayerControlButton>
                            <SotPlayerVolumeSlider
                                min={0}
                                max={100}
                                step={1}
                                value={[volume]}
                                disabled={playbackDisabled}
                                data-sot-control="dashboard-player-volume-slider"
                                data-sot-state={playerControlState}
                                aria-label="音量"
                                onValueChange={(nextValue) =>
                                    onVolumeChange(nextValue[0] ?? volume)
                                }
                            />
                            <span
                                className="min-w-11 text-center font-mono text-xs font-medium tracking-[0.03em] tabular-nums"
                                data-sot-part="dashboard-player-volume-value"
                            >
                                {volume}
                            </span>
                        </div>
                    </SotPlayerVolumePopoverContent>
                </div>
            </Popover>
        </CardContent>
    );
}
