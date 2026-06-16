"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
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

const sotTransportButtonStyle: CSSProperties = {
    paddingLeft: 6,
    paddingRight: 6,
};

const sotSeekSliderInputStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    margin: 0,
    opacity: 0,
};

const sotVolumeSliderRootStyle: CSSProperties = {
    display: "contents",
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
        <div
            className="player"
            data-no-audio={playbackDisabled ? "true" : undefined}
            data-playing={isPlaying ? "true" : undefined}
            data-sot-state={playbackDisabled ? "disabled" : "ready"}
            data-sot-surface="recording-player"
            style={sotPlayerFontVariables}
        >
            {/* biome-ignore lint/a11y/useSemanticElements: SOT no-audio banner is a div with role=status. */}
            <div
                className="no-audio-banner"
                data-no-audio-banner=""
                role="status"
            >
                <span className="no-audio-ico" aria-hidden="true">
                    <SotPlayerNoAudioIcon />
                </span>
                <div className="no-audio-text">
                    <div className="no-audio-title">来源仅同步转写与报告</div>
                    <div className="no-audio-sub">
                        这条录音没有本地音频，无法播放或运行私有重转写。
                    </div>
                </div>
            </div>

            <div className="player-meta">
                <span className="ts" suppressHydrationWarning>
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
            </div>

            {isTagManagerOpen && tagManagerPanel ? tagManagerPanel : null}

            <div
                className={
                    playbackDisabled
                        ? "player-controls is-disabled"
                        : "player-controls"
                }
                data-sot-panel="recording-player-controls"
                data-sot-state={controlsState}
            >
                <button
                    className="round-btn"
                    type="button"
                    aria-label={
                        language === "zh-CN" ? "后退 5 秒" : "Back 5 seconds"
                    }
                    data-sot-control="recording-player-back"
                    data-sot-state={controlState}
                    disabled={playbackDisabled}
                    onClick={() => seekBySeconds(-5)}
                    style={sotTransportButtonStyle}
                >
                    <SotPlayerBackIcon />
                </button>

                <button
                    className="round-btn play"
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
                    {isPlaying ? <SotPlayerPauseIcon /> : <SotPlayerPlayIcon />}
                </button>

                <button
                    className="round-btn"
                    type="button"
                    aria-label={
                        language === "zh-CN" ? "前进 5 秒" : "Forward 5 seconds"
                    }
                    data-sot-control="recording-player-forward"
                    data-sot-state={controlState}
                    disabled={playbackDisabled}
                    onClick={() => seekBySeconds(5)}
                    style={sotTransportButtonStyle}
                >
                    <SotPlayerForwardIcon />
                </button>

                <span
                    className="time mono"
                    data-sot-part="recording-player-current-time"
                >
                    {formatSotPlayerTime(currentTime)}
                </span>

                <Slider
                    className={playbackDisabled ? "track is-disabled" : "track"}
                    disabled={playbackDisabled}
                    max={100}
                    min={0}
                    onValueChange={seekToSliderValue}
                    onValueCommit={seekToSliderValue}
                    rangeProps={{ "data-pct": playerProgressPct }}
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
                    style={{
                        ...sotSeekSliderInputStyle,
                        cursor: playbackDisabled ? "default" : "pointer",
                    }}
                    tabIndex={-1}
                    thumbProps={{ "data-pct": playerProgressPct }}
                    value={[progress]}
                    aria-hidden="true"
                />

                <span
                    className="time mono"
                    data-sot-part="recording-player-duration"
                >
                    {formatSotPlayerTime(playerDurationValue)}
                </span>

                <Button
                    type="button"
                    onClick={cyclePlaybackSpeed}
                    variant="ghost"
                    size="sm"
                    className="speed"
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

                <div className="vol-anchor">
                    <button
                        className="round-btn small"
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
                        onClick={() => setVolumeOpen((open) => !open)}
                    >
                        <SotPlayerVolumeIcon volume={volume} />
                    </button>
                    <div
                        className="vol-pop"
                        data-open={volumePopoverOpen ? "true" : "false"}
                        hidden={!volumePopoverOpen}
                        aria-hidden={volumePopoverOpen ? undefined : "true"}
                        role="dialog"
                        aria-label={language === "zh-CN" ? "音量" : "Volume"}
                    >
                        <div className="vol-row">
                            <button
                                className="vol-mute"
                                type="button"
                                aria-label={
                                    language === "zh-CN"
                                        ? "静音切换"
                                        : "Toggle mute"
                                }
                                disabled={playbackDisabled}
                                onClick={() => setVolume(volumeMuted ? 70 : 0)}
                            >
                                <SotPlayerVolumeIcon
                                    className="vol-ico"
                                    volume={volume}
                                />
                            </button>
                            <Slider
                                className="vol-range-control"
                                inputClassName="vol-range"
                                min={0}
                                max={100}
                                step={1}
                                value={[volume]}
                                disabled={playbackDisabled}
                                aria-label={
                                    language === "zh-CN" ? "音量" : "Volume"
                                }
                                onValueChange={(nextValue) =>
                                    setVolume(nextValue[0] ?? volume)
                                }
                                renderTrack={false}
                                rootProps={{ style: sotVolumeSliderRootStyle }}
                            />
                            <span className="vol-num mono">{volume}</span>
                        </div>
                    </div>
                </div>
            </div>

            <audio
                ref={audioRef}
                src={audioSrc || undefined}
                preload="metadata"
                hidden
            >
                <track kind="captions" />
            </audio>
        </div>
    );
}
