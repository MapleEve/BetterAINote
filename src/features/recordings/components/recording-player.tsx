"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type { Recording } from "@/types/recording";
import {
    formatSotPlayerDate,
    formatSotPlayerTime,
    SotPlayerBackIcon,
    SotPlayerForwardIcon,
    SotPlayerNoAudioIcon,
    SotPlayerPauseIcon,
    SotPlayerPlayIcon,
    SotPlayerSourceTag,
    SotPlayerStatusBadge,
    SotPlayerTagChip,
    SotPlayerVolumeIcon,
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

type SotPlayerSliderTrackStyle = CSSProperties & {
    "--sot-player-track": string;
};

const SOT_PLAYER_SEEK_SLIDER_CLASS =
    "h-3.5 min-w-0 flex-1 cursor-pointer data-[disabled]:cursor-default [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-[var(--sot-player-track)] [&_[data-slot=slider-track]]:shadow-[inset_0_1px_1px_rgb(0_0_0_/_0.04)]";
const SOT_PLAYER_SEEK_RANGE_CLASS = "bg-transparent";
const SOT_PLAYER_SEEK_THUMB_CLASS =
    "size-3.5 border-0 bg-white p-0 shadow-none";
const SOT_PLAYER_VOLUME_SLIDER_CLASS = "h-[18px] min-w-[110px] flex-1";
const recordingSeekSliderRootStyle: SotPlayerSliderTrackStyle = {
    "--sot-player-track": "rgb(224 227 230)",
};
const sotPlayerSeekRangeStyle: CSSProperties = {
    background: "linear-gradient(90deg, var(--steel-500), var(--accent))",
};
const sotPlayerSeekThumbStyle: CSSProperties = {
    boxShadow: "0 1px 4px rgb(0 0 0 / 0.15), 0 0 0 1px var(--line-hairline)",
};

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
            <Alert
                className="mb-3 grid-cols-[26px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-px px-3 py-2.5"
                data-sot-part="recording-player-no-audio"
                data-sot-state={playbackDisabled ? "visible" : "hidden"}
                hidden={!playbackDisabled}
                role="status"
            >
                <SotPlayerNoAudioIcon
                    className="col-start-1 row-span-2 place-self-center"
                    data-icon="inline-start"
                    data-sot-part="recording-player-no-audio-icon"
                />
                <AlertTitle data-sot-part="recording-player-no-audio-title">
                    来源仅同步转写与报告
                </AlertTitle>
                <AlertDescription data-sot-part="recording-player-no-audio-description">
                    这条录音没有本地音频，无法播放或运行私有重转写。
                </AlertDescription>
            </Alert>

            <CardHeader data-sot-part="recording-player-meta">
                <span
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
                <div data-sot-panel="recording-player-tag-manager-slot">
                    {tagManagerPanel}
                </div>
            ) : null}

            <CardContent
                aria-disabled={playbackDisabled ? "true" : undefined}
                data-sot-panel="recording-player-controls"
                data-sot-state={controlsState}
            >
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink rounded-full"
                    type="button"
                    aria-label={
                        language === "zh-CN" ? "后退 5 秒" : "Back 5 seconds"
                    }
                    data-sot-control="recording-player-back"
                    data-sot-state={controlState}
                    disabled={playbackDisabled}
                    onClick={() => seekBySeconds(-5)}
                >
                    <span
                        data-icon="inline-start"
                        data-sot-part="recording-player-control-icon"
                    >
                        <SotPlayerBackIcon />
                    </span>
                </Button>

                <Button
                    variant="primary"
                    size="icon-lg"
                    className="size-11 shrink rounded-full shadow-sm"
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
                    <span
                        data-icon="inline-start"
                        data-sot-part="recording-player-control-icon"
                    >
                        {isPlaying ? (
                            <SotPlayerPauseIcon />
                        ) : (
                            <SotPlayerPlayIcon />
                        )}
                    </span>
                </Button>

                <Button
                    variant="outline"
                    size="icon"
                    className="shrink rounded-full"
                    type="button"
                    aria-label={
                        language === "zh-CN" ? "前进 5 秒" : "Forward 5 seconds"
                    }
                    data-sot-control="recording-player-forward"
                    data-sot-state={controlState}
                    disabled={playbackDisabled}
                    onClick={() => seekBySeconds(5)}
                >
                    <span
                        data-icon="inline-start"
                        data-sot-part="recording-player-control-icon"
                    >
                        <SotPlayerForwardIcon />
                    </span>
                </Button>

                <span data-sot-part="recording-player-current-time">
                    {formatSotPlayerTime(currentTime)}
                </span>

                <Slider
                    className={SOT_PLAYER_SEEK_SLIDER_CLASS}
                    disabled={playbackDisabled}
                    max={100}
                    min={0}
                    onValueChange={seekToSliderValue}
                    onValueCommit={seekToSliderValue}
                    rangeProps={{
                        className: SOT_PLAYER_SEEK_RANGE_CLASS,
                        "data-pct": playerProgressPct,
                        style: sotPlayerSeekRangeStyle,
                    }}
                    rootProps={{
                        "aria-disabled": playbackDisabled ? "true" : undefined,
                        "aria-label":
                            language === "zh-CN"
                                ? "播放进度"
                                : "Playback progress",
                        "aria-valuemax": 100,
                        "aria-valuemin": 0,
                        "aria-valuenow": Math.round(progress),
                        "data-pct": playerProgressPct,
                        "data-sot-control": "recording-player-seek",
                        "data-sot-state": controlState,
                        style: recordingSeekSliderRootStyle,
                        onClick: (event) => {
                            const rect =
                                event.currentTarget.getBoundingClientRect();
                            if (rect.width <= 0) {
                                return;
                            }
                            seekToPercent(
                                ((event.clientX - rect.left) / rect.width) *
                                    100,
                            );
                        },
                        onKeyDown: (event) => {
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
                        },
                        role: "slider",
                        tabIndex: playbackDisabled ? -1 : 0,
                    }}
                    step={1}
                    thumbProps={{
                        className: SOT_PLAYER_SEEK_THUMB_CLASS,
                        "data-pct": playerProgressPct,
                        style: sotPlayerSeekThumbStyle,
                    }}
                    value={[progress]}
                />

                <span data-sot-part="recording-player-duration">
                    {formatSotPlayerTime(playerDurationValue)}
                </span>

                <Button
                    type="button"
                    onClick={cyclePlaybackSpeed}
                    variant="ghost"
                    size="sm"
                    className="min-w-12 justify-center font-mono tabular-nums"
                    title="Click to cycle playback speed"
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
                    <div data-sot-part="recording-player-volume-anchor">
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon-sm"
                                className="shrink rounded-full"
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
                                <span
                                    data-icon="inline-start"
                                    data-sot-part="recording-player-control-icon"
                                >
                                    <SotPlayerVolumeIcon volume={volume} />
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="end"
                            side="top"
                            sideOffset={8}
                            className="w-[200px] min-w-[200px] gap-0 overflow-visible px-2.5 py-2"
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
                                    size="icon-xs"
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
                                    <span
                                        className="inline-flex [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-[1.8]"
                                        data-icon="inline-start"
                                        data-sot-part="recording-player-volume-icon"
                                    >
                                        <SotPlayerVolumeIcon volume={volume} />
                                    </span>
                                </Button>
                                <Slider
                                    className={SOT_PLAYER_VOLUME_SLIDER_CLASS}
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={[volume]}
                                    disabled={playbackDisabled}
                                    data-sot-control="recording-player-volume-slider"
                                    data-sot-state={controlState}
                                    aria-label={
                                        language === "zh-CN"
                                            ? "音量"
                                            : "Volume"
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
