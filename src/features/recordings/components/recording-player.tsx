"use client";

import { Pause, Play, Tag, Volume2 } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/components/language-provider";
import { MetalButton } from "@/components/metal-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useRecordingPlayback } from "@/hooks/use-recording-playback";
import { formatDateTime } from "@/lib/format-date";
import type { RecordingTag } from "@/lib/recording-tags";
import { cn } from "@/lib/utils";
import type { Recording } from "@/types/recording";
import { RecordingTagChip } from "./recording-tag-visuals";

interface RecordingPlayerProps {
    recording: Recording;
    tags?: RecordingTag[];
    isTagManagerOpen?: boolean;
    onToggleTagManager?: () => void;
    tagManagerPanel?: ReactNode;
    onEnded?: () => void;
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

    const formatTime = (seconds: number) => {
        if (!seconds || Number.isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <Card
            className={cn(
                "overflow-visible",
                isTagManagerOpen && "relative z-[80]",
            )}
        >
            <CardContent className="relative p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <span
                        className="inline-flex h-7 items-center rounded-xl border border-border/45 bg-background/20 px-2.5 font-mono text-[11px] font-medium tracking-wide text-muted-foreground/75 tabular-nums backdrop-blur-xl"
                        suppressHydrationWarning
                    >
                        {formatDateTime(
                            recording.startTime,
                            "absolute",
                            language,
                        )}
                    </span>
                    {onToggleTagManager ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onToggleTagManager}
                            aria-expanded={isTagManagerOpen}
                            className={cn(
                                "h-7 max-w-[14rem] rounded-xl border-border/55 bg-background/20 px-2.5 text-xs shadow-none backdrop-blur-xl transition-[background-color,border-color] duration-300 ease-[var(--ease-sine)] hover:bg-background/35",
                                isTagManagerOpen &&
                                    "border-primary/35 bg-primary/12 text-foreground",
                            )}
                        >
                            <Tag className="h-3.5 w-3.5" />
                            {tags.length > 0 ? (
                                <RecordingTagChip
                                    tag={tags[0]}
                                    className="max-w-24 border-0 bg-transparent px-0 py-0"
                                />
                            ) : (
                                <span>
                                    {language === "zh-CN" ? "标签" : "Tags"}
                                </span>
                            )}
                            {tags.length > 1 ? (
                                <span className="rounded-full border border-border/60 px-1.5 text-[10px] text-muted-foreground">
                                    +{tags.length - 1}
                                </span>
                            ) : null}
                        </Button>
                    ) : null}
                </div>

                {isTagManagerOpen && tagManagerPanel ? (
                    <div className="animate-in fade-in-0 zoom-in-95 absolute top-12 right-5 z-[1000] max-h-[min(28rem,calc(100vh-12rem))] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border/65 bg-popover/95 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-2xl duration-200">
                        {tagManagerPanel}
                    </div>
                ) : null}

                {!recording.hasAudio && (
                    <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
                        {language === "zh-CN"
                            ? "这个数据源当前只同步来源逐字稿或报告，没有可供本地播放或私有转录的音频文件。"
                            : "This source currently syncs source transcripts or reports only. No local audio is available for playback or private transcription."}
                    </div>
                )}

                <div className="grid items-center gap-4 rounded-2xl border border-border/40 bg-background/14 px-4 py-4 backdrop-blur-xl md:grid-cols-[4rem_minmax(0,1fr)_12.5rem]">
                    <Button
                        onClick={togglePlayPause}
                        size="lg"
                        className="h-12 w-12 rounded-full shadow-none"
                        disabled={!recording.hasAudio}
                    >
                        {isPlaying ? (
                            <Pause className="h-5 w-5" />
                        ) : (
                            <Play className="h-5 w-5" />
                        )}
                    </Button>

                    <div className="min-w-0 space-y-3">
                        <div className="flex justify-between font-mono text-[11px] font-medium text-muted-foreground/75 tabular-nums">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                        <Slider
                            value={[progress]}
                            onValueChange={seekToSliderValue}
                            onValueCommit={seekToSliderValue}
                            max={100}
                            step={0.1}
                            className="w-full"
                            disabled={!duration || duration === 0}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <MetalButton
                            onClick={cyclePlaybackSpeed}
                            variant="default"
                            size="sm"
                            className="h-8 w-12 rounded-xl px-2 font-mono text-[11px] shadow-none"
                            title="Click to cycle playback speed"
                        >
                            {playbackSpeedLabel}
                        </MetalButton>

                        <div className="flex w-28 items-center gap-2">
                            <Volume2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/75" />
                            <Slider
                                value={[volume]}
                                onValueChange={(value) =>
                                    setVolume(value[0] ?? 75)
                                }
                                max={100}
                                className="flex-1"
                            />
                        </div>
                    </div>
                </div>

                <audio
                    ref={audioRef}
                    src={audioSrc || undefined}
                    preload="metadata"
                    className="hidden"
                >
                    <track kind="captions" />
                </audio>
            </CardContent>
        </Card>
    );
}
