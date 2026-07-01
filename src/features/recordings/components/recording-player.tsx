"use client";

import {
    FastForward,
    Pause,
    Play,
    Rewind,
    Volume2,
    VolumeX,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useRecordingPlayback } from "@/hooks/use-recording-playback";
import type { RecordingTag } from "@/lib/recording-tags";
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";
import {
    formatSotPlayerDate,
    formatSotPlayerTime,
    SotPlayerNoAudioAlert,
    SotPlayerSourceTag,
    SotPlayerStatusBadge,
    SotPlayerTagChip,
    sotPlayerVolumeLevel,
} from "./sot-player-primitives";

interface RecordingPlayerProps {
    recording: Recording;
    tags?: RecordingTag[];
    isTagManagerOpen?: boolean;
    onToggleTagManager?: () => void;
    tagManagerPanel?: ReactNode;
    onEnded?: () => void;
}

const sotPlayerFontVariables: CSSProperties & { "--font-mono": string } = {
    "--font-mono":
        'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
};

const RECORDING_PLAYER_META_CLASS_NAME = "flex flex-wrap items-center gap-2.5";

const RECORDING_PLAYER_DATE_CLASS_NAME =
    "[font:500_11.5px_var(--font-mono)] tracking-[0.02em] text-[var(--fg-tertiary)]";

const RECORDING_PLAYER_TAG_MANAGER_SLOT_CLASS_NAME = "mb-3";

const RECORDING_PLAYER_CONTROLS_CLASS_NAME =
    "flex min-w-0 items-center gap-3 overflow-visible";

const RECORDING_PLAYER_TIME_CLASS_NAME =
    "min-w-11 text-center [font:500_12px_var(--font-mono)] tracking-[0.03em] text-[var(--fg-tertiary)]";

const RECORDING_PLAYER_DISABLED_CLASS_NAME =
    "pointer-events-none opacity-[0.42] data-[disabled]:opacity-[0.42]";

const RECORDING_PLAYER_SPEED_CLASS_NAME =
    "max-[640px]:w-[50.75px] max-[640px]:min-w-[50.75px] max-[640px]:basis-[50.75px] max-[640px]:grow-0 max-[640px]:shrink-0";

const RECORDING_PLAYER_VOLUME_ANCHOR_CLASS_NAME = "relative inline-flex";

export function RecordingPlayer({
    recording,
    tags = [],
    isTagManagerOpen = false,
    onToggleTagManager,
    tagManagerPanel,
    onEnded,
}: RecordingPlayerProps) {
    const { language } = useLanguage();
    const [volumeOpen, setVolumeOpen] = useState(false);
    const {
        audioRef,
        audioSrc,
        currentTime,
        cyclePlaybackSpeed,
        duration,
        isPlaying,
        playbackSpeedLabel,
        progress,
        seekToSliderValue,
        setVolume,
        togglePlayPause,
        volume,
    } = useRecordingPlayback({
        audioUrl: recording.audioUrl,
        onEnded,
    });

    const playbackDisabled = !recording.hasAudio || !audioSrc;
    const volumeMuted = volume === 0;
    const volumePopoverOpen = volumeOpen && !playbackDisabled;
    const controlsState = playbackDisabled
        ? "disabled"
        : volumeMuted
          ? "muted"
          : isPlaying
            ? "playing"
            : "ready";
    const controlState = playbackDisabled ? "disabled" : "ready";
    const primaryTag = tags[0];
    const playerProgressPct = Math.max(0, Math.min(100, Math.round(progress)));
    const playerDurationValue = duration > 0 ? duration : recording.duration;

    useEffect(() => {
        if (playbackDisabled) {
            setVolumeOpen(false);
        }
    }, [playbackDisabled]);

    const seekBySeconds = (seconds: number) => {
        const audio = audioRef.current;
        if (!audio || playbackDisabled || !duration || Number.isNaN(duration)) {
            return;
        }

        const nextTime = Math.min(
            duration,
            Math.max(0, audio.currentTime + seconds),
        );
        audio.currentTime = nextTime;
        seekToSliderValue([(nextTime / duration) * 100]);
    };

    const seekToPercent = (percent: number) => {
        if (playbackDisabled || !duration || Number.isNaN(duration)) {
            return;
        }
        seekToSliderValue([Math.min(100, Math.max(0, percent))]);
    };

    return (
        <Card
            hasNoPadding
            data-no-audio={playbackDisabled ? "true" : undefined}
            data-playing={isPlaying ? "true" : undefined}
            data-sot-state={playbackDisabled ? "disabled" : "ready"}
            data-sot-surface="recording-player"
            style={sotPlayerFontVariables}
        >
            <SotPlayerNoAudioAlert
                part="recording-player-no-audio"
                iconPart="recording-player-no-audio-icon"
                textPart="recording-player-no-audio-text"
                titlePart="recording-player-no-audio-title"
                descriptionPart="recording-player-no-audio-description"
                playbackDisabled={playbackDisabled}
            />

            <CardHeader
                className={RECORDING_PLAYER_META_CLASS_NAME}
                data-sot-part="recording-player-meta"
            >
                <span
                    className={RECORDING_PLAYER_DATE_CLASS_NAME}
                    data-sot-part="recording-player-date"
                    suppressHydrationWarning
                >
                    {formatSotPlayerDate(recording.startTime)}
                </span>
                <SotPlayerSourceTag provider={recording.sourceProvider} />
                <SotPlayerTagChip
                    count={tags.length}
                    onClick={onToggleTagManager}
                    tag={primaryTag ?? null}
                    trigger={Boolean(onToggleTagManager)}
                />
                <SotPlayerStatusBadge />
            </CardHeader>

            {isTagManagerOpen && tagManagerPanel ? (
                <div
                    className={RECORDING_PLAYER_TAG_MANAGER_SLOT_CLASS_NAME}
                    data-sot-panel="recording-player-tag-manager-slot"
                >
                    {tagManagerPanel}
                </div>
            ) : null}

            <CardContent
                className={RECORDING_PLAYER_CONTROLS_CLASS_NAME}
                aria-disabled={playbackDisabled ? "true" : undefined}
                data-sot-panel="recording-player-controls"
                data-sot-state={controlsState}
            >
                <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={
                        language === "zh-CN" ? "后退 5 秒" : "Back 5 seconds"
                    }
                    data-sot-control="recording-player-back"
                    data-sot-state={controlState}
                    disabled={playbackDisabled}
                    onClick={() => seekBySeconds(-5)}
                >
                    <Rewind
                        data-icon="inline-start"
                        data-sot-part="recording-player-control-icon"
                    />
                </Button>

                <Button
                    variant="default"
                    size="icon-lg"
                    type="button"
                    onClick={togglePlayPause}
                    data-sot-control="recording-player-play"
                    data-sot-state={
                        playbackDisabled
                            ? "disabled"
                            : isPlaying
                              ? "playing"
                              : "paused"
                    }
                    data-playing={isPlaying ? "true" : "false"}
                    disabled={playbackDisabled}
                    aria-label={
                        isPlaying
                            ? language === "zh-CN"
                                ? "暂停"
                                : "Pause"
                            : language === "zh-CN"
                              ? "播放"
                              : "Play"
                    }
                >
                    {isPlaying ? (
                        <Pause
                            data-icon="inline-start"
                            data-sot-part="recording-player-control-icon"
                        />
                    ) : (
                        <Play
                            data-icon="inline-start"
                            data-sot-part="recording-player-control-icon"
                        />
                    )}
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={
                        language === "zh-CN" ? "前进 5 秒" : "Forward 5 seconds"
                    }
                    data-sot-control="recording-player-forward"
                    data-sot-state={controlState}
                    disabled={playbackDisabled}
                    onClick={() => seekBySeconds(5)}
                >
                    <FastForward
                        data-icon="inline-start"
                        data-sot-part="recording-player-control-icon"
                    />
                </Button>

                <span
                    className={cn(
                        RECORDING_PLAYER_TIME_CLASS_NAME,
                        playbackDisabled &&
                            RECORDING_PLAYER_DISABLED_CLASS_NAME,
                    )}
                    data-sot-part="recording-player-current-time"
                >
                    {formatSotPlayerTime(currentTime)}
                </span>

                <Slider
                    className={
                        playbackDisabled
                            ? cn(
                                  "min-w-0 flex-1",
                                  RECORDING_PLAYER_DISABLED_CLASS_NAME,
                              )
                            : "min-w-0 flex-1"
                    }
                    disabled={playbackDisabled}
                    data-pct={playerProgressPct}
                    data-sot-control="recording-player-seek"
                    data-sot-state={controlState}
                    max={100}
                    min={0}
                    onValueChange={seekToSliderValue}
                    onValueCommit={seekToSliderValue}
                    rangeProps={{
                        "data-pct": playerProgressPct,
                    }}
                    aria-disabled={playbackDisabled ? "true" : undefined}
                    aria-label={
                        language === "zh-CN" ? "播放进度" : "Playback progress"
                    }
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={Math.round(progress)}
                    onClick={(event) => {
                        const rect =
                            event.currentTarget.getBoundingClientRect();
                        if (rect.width <= 0) {
                            return;
                        }
                        seekToPercent(
                            ((event.clientX - rect.left) / rect.width) * 100,
                        );
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowLeft") {
                            seekToPercent(progress - 5);
                        }
                        if (event.key === "ArrowRight") {
                            seekToPercent(progress + 5);
                        }
                        if (event.key === "Home") {
                            seekToPercent(0);
                        }
                        if (event.key === "End") {
                            seekToPercent(100);
                        }
                    }}
                    tabIndex={playbackDisabled ? -1 : 0}
                    step={1}
                    thumbProps={{
                        "data-pct": playerProgressPct,
                    }}
                    value={[progress]}
                />

                <span
                    className={cn(
                        RECORDING_PLAYER_TIME_CLASS_NAME,
                        playbackDisabled &&
                            RECORDING_PLAYER_DISABLED_CLASS_NAME,
                    )}
                    data-sot-part="recording-player-duration"
                >
                    {formatSotPlayerTime(playerDurationValue)}
                </span>

                <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={cyclePlaybackSpeed}
                    title="Click to cycle playback speed"
                    className={RECORDING_PLAYER_SPEED_CLASS_NAME}
                    data-sot-control="recording-player-speed"
                    data-sot-state={controlState}
                    disabled={playbackDisabled}
                    aria-label={
                        language === "zh-CN"
                            ? "切换播放倍速"
                            : "Cycle playback speed"
                    }
                >
                    {playbackSpeedLabel}
                </Button>

                <Popover
                    open={volumePopoverOpen}
                    onOpenChange={(open) => setVolumeOpen(open)}
                >
                    <div
                        className={RECORDING_PLAYER_VOLUME_ANCHOR_CLASS_NAME}
                        data-sot-part="recording-player-volume-anchor"
                    >
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                type="button"
                                aria-label={
                                    language === "zh-CN"
                                        ? `音量 ${volume}`
                                        : `Volume ${volume}`
                                }
                                aria-expanded={volumePopoverOpen}
                                title={
                                    language === "zh-CN"
                                        ? `音量 ${volume}`
                                        : `Volume ${volume}`
                                }
                                data-level={sotPlayerVolumeLevel(volume)}
                                data-sot-control="recording-player-volume"
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
                                {volumeMuted ? (
                                    <VolumeX
                                        data-icon="inline-start"
                                        data-sot-part="recording-player-control-icon"
                                    />
                                ) : (
                                    <Volume2
                                        data-icon="inline-start"
                                        data-sot-part="recording-player-control-icon"
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
                            data-sot-panel="recording-player-volume-popover"
                            data-sot-state={
                                volumePopoverOpen ? "open" : "closed"
                            }
                            aria-label={
                                language === "zh-CN" ? "音量" : "Volume"
                            }
                        >
                            <div
                                className="flex items-center gap-2"
                                data-sot-part="recording-player-volume-row"
                            >
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    type="button"
                                    aria-label={
                                        language === "zh-CN"
                                            ? "静音切换"
                                            : "Toggle mute"
                                    }
                                    data-sot-control="recording-player-volume-mute"
                                    data-sot-state={
                                        volumeMuted ? "muted" : "audible"
                                    }
                                    disabled={playbackDisabled}
                                    onClick={() =>
                                        setVolume(volumeMuted ? 70 : 0)
                                    }
                                >
                                    {volumeMuted ? (
                                        <VolumeX
                                            data-icon="inline-start"
                                            data-sot-part="recording-player-volume-icon"
                                        />
                                    ) : (
                                        <Volume2
                                            data-icon="inline-start"
                                            data-sot-part="recording-player-volume-icon"
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
                                    data-sot-control="recording-player-volume-slider"
                                    data-sot-state={controlState}
                                    aria-label={
                                        language === "zh-CN" ? "音量" : "Volume"
                                    }
                                    onValueChange={(nextValue) =>
                                        setVolume(nextValue[0] ?? volume)
                                    }
                                />
                                <span
                                    className="min-w-11 text-center font-mono text-xs font-medium tracking-[0.03em] tabular-nums"
                                    data-sot-part="recording-player-volume-value"
                                >
                                    {volume}
                                </span>
                            </div>
                        </PopoverContent>
                    </div>
                </Popover>
            </CardContent>

            <audio
                ref={audioRef}
                src={audioSrc || undefined}
                preload="metadata"
                hidden
            >
                <track kind="captions" />
            </audio>
        </Card>
    );
}
