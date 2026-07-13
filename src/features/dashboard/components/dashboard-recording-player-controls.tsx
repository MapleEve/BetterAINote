"use client";
import {
    FastForward,
    Pause,
    Play,
    Rewind,
    Volume2,
    VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
    formatPlayerTime,
    playerVolumeLevel,
} from "@/features/recordings/components/player-primitives";
import { cn } from "@/lib/utils";

const DASHBOARD_PLAYER_TIME_CLASS_NAME =
    "min-w-11 text-center tabular-nums text-muted-foreground";

const DASHBOARD_PLAYER_DURATION_CLASS_NAME =
    "min-w-11 text-center tabular-nums text-muted-foreground";

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
            className="relative block min-w-[168px] grow-0 shrink-0 basis-[168px]"
            data-part="dashboard-player-seek-shell"
        >
            <Slider
                className={cn(
                    "flex-none",
                    disabled && DASHBOARD_PLAYER_DISABLED_CLASS_NAME,
                )}
                disabled={disabled}
                data-pct={progressPct}
                data-control="dashboard-player-seek"
                data-state={controlState}
                max={100}
                min={0}
                rangeProps={{
                    "data-pct": progressPct,
                }}
                step={1}
                thumbProps={{
                    "data-pct": progressPct,
                }}
                aria-disabled={disabled ? "true" : undefined}
                aria-label="播放进度"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(progress)}
                onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    if (rect.width <= 0) {
                        return;
                    }
                    onSeekToPercent(
                        ((event.clientX - rect.left) / rect.width) * 100,
                    );
                }}
                onKeyDown={(event) => {
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
                }}
                tabIndex={disabled ? -1 : 0}
                value={[progress]}
                onValueChange={(values) => onSeekToPercent(values[0] ?? 0)}
            />
        </span>
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
            data-panel="dashboard-recording-player-controls"
            data-state={playerControlsState}
        >
            <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="后退 5 秒"
                className={DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME}
                data-control="dashboard-player-back"
                data-state={playerControlState}
                disabled={playbackDisabled}
                onClick={() => onSeekBySeconds(-5)}
            >
                <Rewind
                    data-icon="inline-start"
                    data-part="dashboard-player-control-icon"
                />
            </Button>
            <Button
                variant="default"
                size="icon-lg"
                type="button"
                aria-label={isPlaying ? "暂停" : "播放"}
                className={DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME}
                data-playing={isPlaying ? "true" : "false"}
                data-control="dashboard-player-play"
                data-state={
                    playbackDisabled
                        ? "disabled"
                        : isPlaying
                          ? "playing"
                          : "paused"
                }
                disabled={playbackDisabled}
                onClick={onTogglePlayPause}
            >
                {isPlaying ? (
                    <Pause
                        data-icon="inline-start"
                        data-part="dashboard-player-control-icon"
                    />
                ) : (
                    <Play
                        data-icon="inline-start"
                        data-part="dashboard-player-control-icon"
                    />
                )}
            </Button>
            <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="前进 5 秒"
                className={DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME}
                data-control="dashboard-player-forward"
                data-state={playerControlState}
                disabled={playbackDisabled}
                onClick={() => onSeekBySeconds(5)}
            >
                <FastForward
                    data-icon="inline-start"
                    data-part="dashboard-player-control-icon"
                />
            </Button>
            <span
                className={cn(
                    DASHBOARD_PLAYER_TIME_CLASS_NAME,
                    playbackDisabled && DASHBOARD_PLAYER_DISABLED_CLASS_NAME,
                )}
                data-part="dashboard-player-current-time"
            >
                {formatPlayerTime(currentTime)}
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
                data-part="dashboard-player-duration"
            >
                {formatPlayerTime(duration)}
            </span>
            <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={playbackDisabled}
                aria-label="切换播放倍速"
                className={cn(
                    DASHBOARD_PLAYER_SPEED_CLASS_NAME,
                    DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME,
                )}
                data-control="dashboard-player-speed"
                data-state={playerControlState}
                onClick={onCyclePlaybackSpeed}
            >
                {playbackSpeedLabel}
            </Button>
            <Popover
                open={volumePopoverOpen}
                onOpenChange={(open) => onVolumeOpenChange(open)}
            >
                <div
                    className="relative inline-flex"
                    data-part="dashboard-player-volume-anchor"
                >
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            type="button"
                            aria-label={`音量 ${volume}`}
                            className={
                                DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME
                            }
                            aria-expanded={volumePopoverOpen}
                            title={`音量 ${volume}`}
                            data-level={playerVolumeLevel(volume)}
                            data-control="dashboard-player-volume"
                            data-state={
                                playbackDisabled
                                    ? "disabled"
                                    : volumePopoverOpen
                                      ? "open"
                                      : "closed"
                            }
                            data-volume-state={
                                volumeMuted ? "muted" : "audible"
                            }
                            disabled={playbackDisabled}
                        >
                            {volumeMuted ? (
                                <VolumeX
                                    data-icon="inline-start"
                                    data-part="dashboard-player-control-icon"
                                />
                            ) : (
                                <Volume2
                                    data-icon="inline-start"
                                    data-part="dashboard-player-control-icon"
                                />
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        className="w-56"
                        side="top"
                        sideOffset={8}
                        data-open={volumePopoverOpen ? "true" : "false"}
                        data-panel="dashboard-player-volume-popover"
                        data-state={volumePopoverOpen ? "open" : "closed"}
                        aria-label="音量"
                    >
                        <div
                            className="flex items-center gap-2"
                            data-part="dashboard-player-volume-row"
                        >
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                type="button"
                                aria-label="静音切换"
                                data-control="dashboard-player-volume-mute"
                                data-state={volumeMuted ? "muted" : "audible"}
                                disabled={playbackDisabled}
                                onClick={() =>
                                    onVolumeChange(volumeMuted ? 70 : 0)
                                }
                            >
                                {volumeMuted ? (
                                    <VolumeX
                                        data-icon="inline-start"
                                        data-part="dashboard-player-volume-icon"
                                    />
                                ) : (
                                    <Volume2
                                        data-icon="inline-start"
                                        data-part="dashboard-player-volume-icon"
                                    />
                                )}
                            </Button>
                            <Slider
                                className="min-w-[110px] flex-1"
                                min={0}
                                max={100}
                                step={1}
                                value={[volume]}
                                disabled={playbackDisabled}
                                data-control="dashboard-player-volume-slider"
                                data-state={playerControlState}
                                aria-label="音量"
                                onValueChange={(nextValue) =>
                                    onVolumeChange(nextValue[0] ?? volume)
                                }
                            />
                            <span
                                className="min-w-11 text-center tabular-nums text-muted-foreground"
                                data-part="dashboard-player-volume-value"
                            >
                                {volume}
                            </span>
                        </div>
                    </PopoverContent>
                </div>
            </Popover>
        </CardContent>
    );
}
