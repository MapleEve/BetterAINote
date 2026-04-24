"use client";

import { Pause, Play, Volume2 } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { MetalButton } from "@/components/metal-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useRecordingPlayback } from "@/hooks/use-recording-playback";
import type { Recording } from "@/types/recording";

interface RecordingPlayerProps {
    recording: Recording;
    onEnded?: () => void;
}

export function RecordingPlayer({ recording, onEnded }: RecordingPlayerProps) {
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
        <Card>
            <CardContent className="pt-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                    {new Date(recording.startTime).toLocaleString()}
                </p>
                {!recording.hasAudio && (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
                        {language === "zh-CN"
                            ? "这个数据源当前只同步来源逐字稿或报告，没有可供本地播放或私有转录的音频文件。"
                            : "This source currently syncs source transcripts or reports only. No local audio is available for playback or private transcription."}
                    </div>
                )}
                <div className="flex items-center gap-4">
                    <Button
                        onClick={togglePlayPause}
                        size="lg"
                        className="w-12 h-12 rounded-full"
                        disabled={!recording.hasAudio}
                    >
                        {isPlaying ? (
                            <Pause className="w-5 h-5" />
                        ) : (
                            <Play className="w-5 h-5" />
                        )}
                    </Button>

                    <div className="flex-1 space-y-2">
                        <Slider
                            value={[progress]}
                            onValueChange={seekToSliderValue}
                            onValueCommit={seekToSliderValue}
                            max={100}
                            step={0.1}
                            className="w-full"
                            disabled={!duration || duration === 0}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <MetalButton
                            onClick={cyclePlaybackSpeed}
                            variant="default"
                            size="sm"
                            className="w-12 h-8 font-mono text-xs px-2"
                            title="Click to cycle playback speed"
                        >
                            {playbackSpeedLabel}
                        </MetalButton>

                        <div className="flex items-center gap-2 w-32">
                            <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
                    src={audioSrc}
                    preload="metadata"
                    className="hidden"
                >
                    <track kind="captions" />
                </audio>
            </CardContent>
        </Card>
    );
}
