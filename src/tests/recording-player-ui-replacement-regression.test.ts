import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const playbackState = vi.hoisted(() => ({
    value: null as Record<string, unknown> | null,
}));

const reactHarness = vi.hoisted(() => {
    let cursor = 0;
    let slots: unknown[] = [];

    return {
        beginRender() {
            cursor = 0;
        },
        flushEffects() {},
        reset() {
            cursor = 0;
            slots = [];
        },
        useEffect(effect: () => void) {
            effect();
        },
        useState<T>(initialValue: T | (() => T)) {
            const index = cursor++;
            if (index in slots) {
                return [
                    slots[index] as T,
                    (nextValue: T | ((previous: T) => T)) => {
                        const previous = slots[index] as T;
                        slots[index] =
                            typeof nextValue === "function"
                                ? (nextValue as (value: T) => T)(previous)
                                : nextValue;
                    },
                ] as const;
            }
            const value =
                typeof initialValue === "function"
                    ? (initialValue as () => T)()
                    : initialValue;
            slots[index] = value;
            return [
                value,
                (nextValue: T | ((previous: T) => T)) => {
                    const previous = slots[index] as T;
                    slots[index] =
                        typeof nextValue === "function"
                            ? (nextValue as (value: T) => T)(previous)
                            : nextValue;
                },
            ] as const;
        },
    };
});

vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return {
        ...actual,
        useEffect: reactHarness.useEffect,
        useState: reactHarness.useState,
    };
});

vi.mock("@/components/language-provider", () => ({
    useLanguage: () => ({ language: "zh-CN" }),
}));

vi.mock("@/hooks/use-recording-playback", () => ({
    useRecordingPlayback: () => playbackState.value,
}));

import { RecordingPlayer } from "@/features/recordings/components/recording-player";

type Props = Record<string, unknown>;

function findElement(
    node: unknown,
    predicate: (props: Props) => boolean,
): ReactElement<Props> | undefined {
    if (!node || typeof node !== "object") return undefined;
    const element = node as ReactElement<Props>;
    if (element.props && predicate(element.props)) return element;
    const children = element.props?.children;
    const candidates = Array.isArray(children) ? children : [children];
    for (const child of candidates) {
        const match = findElement(child, predicate);
        if (match) return match;
    }
    return undefined;
}

function renderPlayer(props: Parameters<typeof RecordingPlayer>[0]) {
    reactHarness.beginRender();
    const tree = RecordingPlayer(props);
    reactHarness.flushEffects();
    return tree;
}

describe("recording player runtime interaction regression", () => {
    const recording = {
        audioUrl: "/api/recordings/rec-1/audio",
        duration: 120,
        filename: "Weekly sync",
        hasAudio: true,
        id: "rec-1",
        sourceProvider: "ticnote",
        startTime: "2026-05-01T10:00:00.000Z",
    };

    beforeEach(() => {
        reactHarness.reset();
        playbackState.value = {
            audioRef: { current: { currentTime: 10 } },
            audioSrc: recording.audioUrl,
            currentTime: 10,
            cyclePlaybackSpeed: vi.fn(),
            duration: 120,
            isPlaying: false,
            playbackSpeedLabel: "1.0×",
            progress: 50,
            seekToSliderValue: vi.fn(),
            setVolume: vi.fn(),
            togglePlayPause: vi.fn(),
            volume: 70,
        };
    });

    afterEach(() => {
        playbackState.value = null;
        vi.restoreAllMocks();
    });

    it("routes seek, play, speed, volume, and tag events into live callbacks", () => {
        const onToggleTagManager = vi.fn();
        const tree = renderPlayer({
            onToggleTagManager,
            recording: recording as never,
            tags: [
                {
                    color: "blue",
                    icon: "grid",
                    id: "tag-1",
                    name: "Review",
                },
            ],
        });
        const seekToSliderValue = playbackState.value
            ?.seekToSliderValue as ReturnType<typeof vi.fn>;
        const togglePlayPause = playbackState.value
            ?.togglePlayPause as ReturnType<typeof vi.fn>;
        const cyclePlaybackSpeed = playbackState.value
            ?.cyclePlaybackSpeed as ReturnType<typeof vi.fn>;
        const setVolume = playbackState.value?.setVolume as ReturnType<
            typeof vi.fn
        >;

        const back = findElement(
            tree,
            (props) => props["aria-label"] === "后退 5 秒",
        );
        (back?.props.onClick as () => void)();
        expect(seekToSliderValue).toHaveBeenLastCalledWith([100 * (5 / 120)]);

        const play = findElement(
            tree,
            (props) => props["aria-label"] === "播放",
        );
        (play?.props.onClick as () => void)();
        expect(togglePlayPause).toHaveBeenCalledOnce();

        const progress = findElement(
            tree,
            (props) => props["aria-label"] === "播放进度",
        );
        expect(progress?.props.thumbProps).toMatchObject({
            className:
                "size-[14px] border-0 bg-white shadow-[0_1px_4px_rgb(0_0_0_/_0.15),0_0_0_1px_var(--line-hairline)]",
        });
        (progress?.props.onKeyDown as (event: { key: string }) => void)({
            key: "End",
        });
        expect(seekToSliderValue).toHaveBeenLastCalledWith([100]);

        const speed = findElement(
            tree,
            (props) => props["aria-label"] === "切换播放倍速",
        );
        (speed?.props.onClick as () => void)();
        expect(cyclePlaybackSpeed).toHaveBeenCalledOnce();

        const mute = findElement(
            tree,
            (props) => props["aria-label"] === "静音切换",
        );
        (mute?.props.onClick as () => void)();
        expect(setVolume).toHaveBeenLastCalledWith(0);

        const volume = findElement(
            tree,
            (props) =>
                props["aria-label"] === "音量" &&
                typeof props.onValueChange === "function",
        );
        (volume?.props.onValueChange as (nextValue: number[]) => void)([35]);
        expect(setVolume).toHaveBeenLastCalledWith(35);

        const tag = findElement(
            tree,
            (props) =>
                props["aria-expanded"] === false && props.children != null,
        );
        (tag?.props.onClick as () => void)();
        expect(onToggleTagManager).toHaveBeenCalledOnce();
    });

    it("renders native disabled semantics when the recording has no playable audio", () => {
        playbackState.value = {
            ...playbackState.value,
            audioSrc: "",
        };
        const tree = renderPlayer({
            recording: { ...recording, hasAudio: false } as never,
        });

        const play = findElement(
            tree,
            (props) => props["aria-label"] === "播放",
        );
        const progress = findElement(
            tree,
            (props) => props["aria-label"] === "播放进度",
        );
        const status = findElement(tree, (props) => props.role === "status");
        expect(play?.props.disabled).toBe(true);
        expect(progress?.props.disabled).toBe(true);
        expect(progress?.props["aria-disabled"]).toBe("true");
        expect(progress?.props.tabIndex).toBe(-1);
        expect(status?.props.hidden).toBe(false);
    });

    it("keeps the no-audio copy in the SOT-compatible text container", () => {
        playbackState.value = {
            ...playbackState.value,
            audioSrc: "",
        };
        const tree = renderPlayer({
            recording: { ...recording, hasAudio: false } as never,
        });
        const noAudioText = findElement(
            tree,
            (props) => props["data-part"] === "recording-player-no-audio-text",
        );

        expect(noAudioText?.type).toBe("div");
        expect(noAudioText?.props.className).toContain("no-audio-text");

        const noAudioAlert = findElement(
            tree,
            (props) => props["data-part"] === "recording-player-no-audio",
        );
        const noAudioIcon = findElement(
            tree,
            (props) => props["data-part"] === "recording-player-no-audio-icon",
        );
        const noAudioTitle = findElement(
            tree,
            (props) => props["data-part"] === "recording-player-no-audio-title",
        );
        const noAudioDescription = findElement(
            tree,
            (props) =>
                props["data-part"] === "recording-player-no-audio-description",
        );

        expect(noAudioAlert?.props.className).toContain("h-[57px]");
        expect(noAudioAlert?.props.className).toContain("box-border");
        expect(noAudioAlert?.props.role).toBe("status");
        expect(noAudioIcon?.props.className).toContain("size-[26px]");
        const noAudioGlyph = noAudioIcon?.props.children as
            | ReactElement<{ size?: number }>
            | undefined;
        expect(noAudioGlyph?.props.size).toBe(14);
        expect(noAudioTitle?.props.className).toContain("text-[12.5px]");
        expect(noAudioDescription?.props.className).toContain("text-[11.5px]");
        expect(noAudioDescription?.props.className).toContain(
            "leading-[17.25px]",
        );
    });
});
