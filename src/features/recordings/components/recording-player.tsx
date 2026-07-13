"use client";

import {
    Pause,
    Play,
    Plus,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { playerVolumeLevel } from "./player-primitives";
import { RecordingTagIconGlyph } from "./recording-tag-visuals";

interface RecordingPlayerProps {
    recording: Recording;
    tags?: RecordingTag[];
    isTagManagerOpen?: boolean;
    onToggleTagManager?: () => void;
    tagManagerPanel?: ReactNode;
    onEnded?: () => void;
}

const RECORDING_PLAYER_META_CLASS_NAME = "flex flex-wrap items-center gap-2.5";

const RECORDING_PLAYER_DATE_CLASS_NAME = "tabular-nums text-muted-foreground";

const RECORDING_PLAYER_TAG_MANAGER_SLOT_CLASS_NAME = "mb-3";

const RECORDING_PLAYER_CONTROLS_CLASS_NAME =
    "flex min-w-0 items-center gap-3 overflow-visible";

const RECORDING_PLAYER_TIME_CLASS_NAME =
    "min-w-11 text-center tabular-nums text-muted-foreground";

const RECORDING_PLAYER_DISABLED_CLASS_NAME =
    "pointer-events-none opacity-[0.42]";

const RECORDING_PLAYER_SPEED_CLASS_NAME =
    "max-[640px]:w-[50.75px] max-[640px]:min-w-[50.75px] max-[640px]:basis-[50.75px] max-[640px]:grow-0 max-[640px]:shrink-0";

const RECORDING_PLAYER_VOLUME_ANCHOR_CLASS_NAME = "relative inline-flex";

const RECORDING_PLAYER_SEEK_THUMB_CLASS_NAME =
    "size-[14px] border-0 bg-white shadow-[0_1px_4px_rgb(0_0_0_/_0.15),0_0_0_1px_var(--line-hairline)]";

const RECORDING_PLAYER_SEEK_THUMB_WRAPPER_STYLE =
    '[data-orientation="horizontal"][data-pct] > span:last-child { top: 50%; } @media (max-width: 640px) { [title="Click to cycle playback speed"] { flex: 0 0 50.75px; width: 50.75px; min-width: 50.75px; } }';

const RECORDING_PLAYER_NO_AUDIO_ALERT_CLASS_NAME =
    "mb-3 h-[57px] box-border gap-[10px] rounded-[10px] border-[color-mix(in_srgb,var(--signal-warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--signal-warning)_8%,var(--bg-elevated))] px-3 py-2.5 text-[var(--fg-primary)]";

const RECORDING_PLAYER_NO_AUDIO_ICON_CLASS_NAME =
    "inline-grid size-[26px] shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--signal-warning)_18%,transparent)] text-[var(--signal-warning)]";

const RECORDING_PLAYER_NO_AUDIO_TITLE_CLASS_NAME =
    "min-h-0 line-clamp-none text-[12.5px] leading-normal font-semibold tracking-normal text-[var(--fg-primary)]";

const RECORDING_PLAYER_NO_AUDIO_DESCRIPTION_CLASS_NAME =
    "text-[11.5px] leading-[17.25px] font-medium text-muted-foreground";

const PLAYER_SOURCE_BADGES = {
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

function pad2(value: number) {
    return String(value).padStart(2, "0");
}

function formatPlayerDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} · ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatPlayerTime(value: number) {
    const seconds =
        value > 10_000 ? Math.floor(value / 1000) : Math.floor(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${pad2(secs)}`;
}

function sourceFallbackLetter(provider: string, label: string) {
    const candidate = Array.from(label.trim())[0] ?? Array.from(provider)[0];
    return candidate?.toUpperCase() ?? "S";
}

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
    const playerDurationValue = duration > 0 ? duration : recording.duration;
    const playerProgressPct = Math.max(0, Math.min(100, Math.round(progress)));

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
            data-state={playbackDisabled ? "disabled" : "ready"}
            data-surface="recording-player"
        >
            <style>{RECORDING_PLAYER_SEEK_THUMB_WRAPPER_STYLE}</style>
            <Alert
                variant="default"
                density="comfortable"
                layout="inline"
                className={RECORDING_PLAYER_NO_AUDIO_ALERT_CLASS_NAME}
                data-part="recording-player-no-audio"
                data-state={playbackDisabled ? "visible" : "hidden"}
                hidden={!playbackDisabled}
                role="status"
            >
                <span
                    className={RECORDING_PLAYER_NO_AUDIO_ICON_CLASS_NAME}
                    data-part="recording-player-no-audio-icon"
                >
                    <VolumeX aria-hidden="true" size={14} />
                </span>
                <div
                    className="no-audio-text flex min-w-0 flex-col gap-px"
                    data-part="recording-player-no-audio-text"
                >
                    <AlertTitle
                        className={RECORDING_PLAYER_NO_AUDIO_TITLE_CLASS_NAME}
                        data-part="recording-player-no-audio-title"
                    >
                        来源仅同步转写与报告
                    </AlertTitle>
                    <AlertDescription
                        density="comfortable"
                        className={
                            RECORDING_PLAYER_NO_AUDIO_DESCRIPTION_CLASS_NAME
                        }
                        data-part="recording-player-no-audio-description"
                    >
                        这条录音没有本地音频，无法播放或运行私有重转写。
                    </AlertDescription>
                </div>
            </Alert>

            <CardHeader
                className={RECORDING_PLAYER_META_CLASS_NAME}
                data-part="recording-player-meta"
            >
                <span
                    className={RECORDING_PLAYER_DATE_CLASS_NAME}
                    data-part="recording-player-date"
                    suppressHydrationWarning
                >
                    {formatPlayerDate(recording.startTime)}
                </span>
                {(() => {
                    const sourceBadge =
                        PLAYER_SOURCE_BADGES[
                            recording.sourceProvider as keyof typeof PLAYER_SOURCE_BADGES
                        ];
                    const sourceLabel =
                        sourceBadge?.label ?? recording.sourceProvider;

                    return (
                        <Badge
                            variant={
                                recording.sourceProvider === "dingtalk-a1"
                                    ? "secondary"
                                    : "outline"
                            }
                            className="gap-1.5 pl-1"
                            data-control="player-source-tag"
                            data-provider={recording.sourceProvider}
                        >
                            <span
                                className="inline-flex size-4 flex-none shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-background text-[9px] font-bold text-muted-foreground"
                                data-cover={
                                    sourceBadge?.cover ? "true" : "false"
                                }
                                data-part="source-icon"
                                data-source-icon={
                                    sourceBadge?.icon ? "image" : "letter"
                                }
                                aria-hidden="true"
                            >
                                {sourceBadge?.icon ? (
                                    <img
                                        alt=""
                                        className={cn(
                                            "block size-4 max-w-none object-contain",
                                            sourceBadge.cover && "object-cover",
                                        )}
                                        height={16}
                                        loading="eager"
                                        src={sourceBadge.icon}
                                        width={16}
                                    />
                                ) : (
                                    (sourceBadge?.letter ??
                                    sourceFallbackLetter(
                                        recording.sourceProvider,
                                        sourceLabel,
                                    ))
                                )}
                            </span>
                            {sourceLabel}
                        </Badge>
                    );
                })()}
                {!primaryTag && onToggleTagManager ? (
                    <Button
                        variant="outline"
                        size="xs"
                        className="border-dashed"
                        aria-expanded={isTagManagerOpen}
                        data-control="recording-tag-manager"
                        data-part="recording-tag-add"
                        data-state={isTagManagerOpen ? "open" : "idle"}
                        onClick={onToggleTagManager}
                        type="button"
                    >
                        <Plus aria-hidden="true" />
                        <span>标签</span>
                    </Button>
                ) : primaryTag ? (
                    <>
                        {onToggleTagManager ? (
                            <Button
                                variant="secondary"
                                size="xs"
                                className={cn(
                                    PLAYER_TAG_CHIP_CLASS,
                                    PLAYER_TAG_COLOR_CLASS[primaryTag.color],
                                    isTagManagerOpen && "ring-1 ring-ring",
                                )}
                                type="button"
                                data-control="recording-tag-manager"
                                data-part="recording-tag-chip"
                                data-state={isTagManagerOpen ? "open" : "idle"}
                                data-tag-color={primaryTag.color}
                                data-tag-id={primaryTag.id}
                                onClick={onToggleTagManager}
                                aria-expanded={isTagManagerOpen}
                            >
                                <RecordingTagIconGlyph icon={primaryTag.icon} />
                                {primaryTag.name}
                            </Button>
                        ) : (
                            <Badge
                                variant="secondary"
                                className={cn(
                                    PLAYER_TAG_CHIP_CLASS,
                                    PLAYER_TAG_COLOR_CLASS[primaryTag.color],
                                )}
                                data-part="recording-tag-chip"
                                data-tag-color={primaryTag.color}
                                data-tag-id={primaryTag.id}
                            >
                                <RecordingTagIconGlyph icon={primaryTag.icon} />
                                {primaryTag.name}
                            </Badge>
                        )}
                        {tags.length > 1 ? (
                            onToggleTagManager ? (
                                <Button
                                    variant="outline"
                                    size="xs"
                                    className={PLAYER_TAG_OVERFLOW_CLASS}
                                    type="button"
                                    data-part="recording-tag-overflow"
                                    onClick={onToggleTagManager}
                                    aria-expanded={isTagManagerOpen}
                                >
                                    +{tags.length - 1}
                                </Button>
                            ) : (
                                <Badge
                                    variant="outline"
                                    className={PLAYER_TAG_OVERFLOW_CLASS}
                                    data-part="recording-tag-overflow"
                                >
                                    +{tags.length - 1}
                                </Badge>
                            )
                        ) : null}
                    </>
                ) : null}
                <Badge
                    variant="secondary"
                    data-control="player-status"
                    data-tone="ok"
                >
                    <span
                        className="size-[5px] shrink-0 rounded-full bg-current"
                        data-part="status-dot"
                        aria-hidden="true"
                    />
                    <span data-part="status-label">已更新</span>
                </Badge>
            </CardHeader>

            {isTagManagerOpen && tagManagerPanel ? (
                <div
                    className={RECORDING_PLAYER_TAG_MANAGER_SLOT_CLASS_NAME}
                    data-panel="recording-player-tag-manager-slot"
                >
                    {tagManagerPanel}
                </div>
            ) : null}

            <CardContent
                className={RECORDING_PLAYER_CONTROLS_CLASS_NAME}
                aria-disabled={playbackDisabled ? "true" : undefined}
                data-panel="recording-player-controls"
                data-state={controlsState}
            >
                <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={
                        language === "zh-CN" ? "后退 5 秒" : "Back 5 seconds"
                    }
                    data-control="recording-player-back"
                    data-state={controlState}
                    disabled={playbackDisabled}
                    onClick={() => seekBySeconds(-5)}
                >
                    <SkipBack
                        data-icon="inline-start"
                        data-part="recording-player-control-icon"
                        aria-hidden="true"
                    />
                </Button>

                <Button
                    variant="default"
                    size="icon-lg"
                    type="button"
                    onClick={togglePlayPause}
                    data-control="recording-player-play"
                    data-playing={isPlaying ? "true" : "false"}
                    data-state={
                        playbackDisabled
                            ? "disabled"
                            : isPlaying
                              ? "playing"
                              : "paused"
                    }
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
                            data-part="recording-player-control-icon"
                            aria-hidden="true"
                        />
                    ) : (
                        <Play
                            data-icon="inline-start"
                            data-part="recording-player-control-icon"
                            aria-hidden="true"
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
                    data-control="recording-player-forward"
                    data-state={controlState}
                    disabled={playbackDisabled}
                    onClick={() => seekBySeconds(5)}
                >
                    <SkipForward
                        data-icon="inline-start"
                        data-part="recording-player-control-icon"
                        aria-hidden="true"
                    />
                </Button>

                <span
                    className={cn(
                        RECORDING_PLAYER_TIME_CLASS_NAME,
                        playbackDisabled &&
                            RECORDING_PLAYER_DISABLED_CLASS_NAME,
                    )}
                    data-part="recording-player-current-time"
                >
                    {formatPlayerTime(currentTime)}
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
                    data-control="recording-player-seek"
                    data-pct={playerProgressPct}
                    data-state={controlState}
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
                        className: RECORDING_PLAYER_SEEK_THUMB_CLASS_NAME,
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
                    data-part="recording-player-duration"
                >
                    {formatPlayerTime(playerDurationValue)}
                </span>

                <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={cyclePlaybackSpeed}
                    title="Click to cycle playback speed"
                    className={RECORDING_PLAYER_SPEED_CLASS_NAME}
                    data-control="recording-player-speed"
                    data-state={controlState}
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
                        data-part="recording-player-volume-anchor"
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
                                data-control="recording-player-volume"
                                data-level={playerVolumeLevel(volume)}
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
                                        data-part="recording-player-control-icon"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Volume2
                                        data-icon="inline-start"
                                        data-part="recording-player-control-icon"
                                        aria-hidden="true"
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
                            data-panel="recording-player-volume-popover"
                            data-state={volumePopoverOpen ? "open" : "closed"}
                            aria-label={
                                language === "zh-CN" ? "音量" : "Volume"
                            }
                        >
                            <div
                                className="flex items-center gap-2"
                                data-part="recording-player-volume-row"
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
                                    data-control="recording-player-volume-mute"
                                    data-state={
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
                                            data-part="recording-player-volume-icon"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <Volume2
                                            data-icon="inline-start"
                                            data-part="recording-player-volume-icon"
                                            aria-hidden="true"
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
                                    data-control="recording-player-volume-slider"
                                    data-state={controlState}
                                    aria-label={
                                        language === "zh-CN" ? "音量" : "Volume"
                                    }
                                    onValueChange={(nextValue) =>
                                        setVolume(nextValue[0] ?? volume)
                                    }
                                />
                                <span
                                    className="min-w-11 text-center tabular-nums text-muted-foreground"
                                    data-part="recording-player-volume-value"
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
