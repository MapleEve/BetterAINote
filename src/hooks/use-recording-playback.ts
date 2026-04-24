"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePlaybackSettingsStore } from "@/features/settings/playback-settings-store";
import {
    isEditableBrowserEventTarget,
    subscribeToBrowserWindowEvent,
    syncBrowserAudioElementSource,
} from "@/lib/platform/browser-shell";
import {
    PLAYBACK_SPEED_OPTIONS,
    type PlaybackSpeed,
} from "@/services/playback-settings";

interface UseRecordingPlaybackOptions {
    audioUrl: string | null | undefined;
    onEnded?: () => void;
}

export function useRecordingPlayback({
    audioUrl,
    onEnded,
}: UseRecordingPlaybackOptions) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(75);
    const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1.0);
    const [autoPlayNext, setAutoPlayNext] = useState(false);
    const { hasLoaded, settings } = usePlaybackSettingsStore();
    const audioRef = useRef<HTMLAudioElement>(null);
    const isSeekingRef = useRef(false);
    const audioSrc = audioUrl ?? "";

    useEffect(() => {
        if (!hasLoaded) {
            return;
        }

        setVolume(settings.defaultVolume);
        setPlaybackSpeed(settings.defaultPlaybackSpeed);
        setAutoPlayNext(settings.autoPlayNext);
    }, [
        hasLoaded,
        settings.autoPlayNext,
        settings.defaultPlaybackSpeed,
        settings.defaultVolume,
    ]);

    useEffect(() => {
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);

        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        audio.currentTime = 0;
        audio.pause();
        syncBrowserAudioElementSource(audio, audioSrc);
    }, [audioSrc]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        audio.volume = volume / 100;
    }, [volume]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        audio.playbackRate = playbackSpeed;
    }, [playbackSpeed]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        const updateTime = () => {
            if (!isSeekingRef.current) {
                setCurrentTime(audio.currentTime);
            }
        };
        const updateDuration = () => {
            if (audio.duration && !Number.isNaN(audio.duration)) {
                setDuration(audio.duration);
            }
        };
        const handlePlaybackEnded = () => {
            setIsPlaying(false);
            if (autoPlayNext && onEnded) {
                onEnded();
            }
        };
        const handleSeeked = () => {
            isSeekingRef.current = false;
            setCurrentTime(audio.currentTime);
        };

        syncBrowserAudioElementSource(audio, audioSrc);
        audio.addEventListener("timeupdate", updateTime);
        audio.addEventListener("loadedmetadata", updateDuration);
        audio.addEventListener("durationchange", updateDuration);
        audio.addEventListener("ended", handlePlaybackEnded);
        audio.addEventListener("seeked", handleSeeked);

        if (audio.duration && !Number.isNaN(audio.duration)) {
            setDuration(audio.duration);
        }

        return () => {
            audio.removeEventListener("timeupdate", updateTime);
            audio.removeEventListener("loadedmetadata", updateDuration);
            audio.removeEventListener("durationchange", updateDuration);
            audio.removeEventListener("ended", handlePlaybackEnded);
            audio.removeEventListener("seeked", handleSeeked);
        };
    }, [audioSrc, autoPlayNext, onEnded]);

    const togglePlayPause = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !audioSrc) {
            return;
        }

        if (isPlaying) {
            audio.pause();
        } else {
            audio.playbackRate = playbackSpeed;
            audio.play().catch((error) => {
                console.error("Error playing audio:", error);
                toast.error("Failed to play audio");
            });
        }
        setIsPlaying(!isPlaying);
    }, [audioSrc, isPlaying, playbackSpeed]);

    const seekToSliderValue = useCallback((value: number[]) => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        const percentage = value[0];
        const audioDuration = audio.duration;

        if (!audioDuration || Number.isNaN(audioDuration)) {
            audio.load();
            return;
        }

        const nextTime = (percentage / 100) * audioDuration;
        isSeekingRef.current = true;
        audio.currentTime = nextTime;
        setCurrentTime(nextTime);
    }, []);

    const cyclePlaybackSpeed = useCallback(() => {
        const currentIndex = PLAYBACK_SPEED_OPTIONS.indexOf(playbackSpeed);
        const nextIndex = (currentIndex + 1) % PLAYBACK_SPEED_OPTIONS.length;
        const nextSpeed = PLAYBACK_SPEED_OPTIONS[nextIndex] ?? 1.0;

        setPlaybackSpeed(nextSpeed);

        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        audio.playbackRate = nextSpeed;
    }, [playbackSpeed]);

    useEffect(() => {
        const removeKeydownListener = subscribeToBrowserWindowEvent(
            "keydown",
            (event) => {
                if (isEditableBrowserEventTarget(event.target)) {
                    return;
                }

                switch (event.key) {
                    case " ": {
                        event.preventDefault();
                        togglePlayPause();
                        break;
                    }
                    case "ArrowLeft": {
                        event.preventDefault();
                        const audio = audioRef.current;
                        if (audio && duration > 0) {
                            const nextTime = Math.max(0, currentTime - 5);
                            audio.currentTime = nextTime;
                            setCurrentTime(nextTime);
                        }
                        break;
                    }
                    case "ArrowRight": {
                        event.preventDefault();
                        const audio = audioRef.current;
                        if (audio && duration > 0) {
                            const nextTime = Math.min(
                                duration,
                                currentTime + 5,
                            );
                            audio.currentTime = nextTime;
                            setCurrentTime(nextTime);
                        }
                        break;
                    }
                    case "ArrowUp": {
                        event.preventDefault();
                        setVolume((previous) => Math.min(100, previous + 5));
                        break;
                    }
                    case "ArrowDown": {
                        event.preventDefault();
                        setVolume((previous) => Math.max(0, previous - 5));
                        break;
                    }
                }
            },
        );

        return removeKeydownListener;
    }, [currentTime, duration, togglePlayPause]);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const playbackSpeedLabel = `${playbackSpeed}x`.replace(".0x", "x");

    return {
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
    };
}
