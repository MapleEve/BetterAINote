import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const playbackState = vi.hoisted(() => ({
    value: null as Record<string, unknown> | null,
}));

vi.mock("@/components/language-provider", () => ({
    useLanguage: () => ({ language: "zh-CN" }),
}));

vi.mock("@/hooks/use-recording-playback", () => ({
    useRecordingPlayback: () => playbackState.value,
}));

import { Slider } from "@/components/ui/slider";
import { RecordingPlayer } from "@/features/recordings/components/recording-player";

function sliderMarkup(markup: string, label: string) {
    const match = markup.match(
        new RegExp(
            `<span(?=[^>]*role="slider")(?=[^>]*aria-label="${label}")[^>]*>`,
        ),
    );

    expect(match, `missing slider thumb for ${label}`).not.toBeNull();
    return match?.[0] ?? "";
}

describe("slider accessibility regression", () => {
    it("keeps Radix's default thumb focus when no tabIndex is supplied", () => {
        const markup = renderToStaticMarkup(
            React.createElement(Slider, {
                "aria-label": "播放进度",
                value: [42],
            }),
        );

        expect(sliderMarkup(markup, "播放进度")).toContain('tabindex="0"');
    });

    it("forwards an explicit tabIndex and disabled state to the Radix focusable thumb", () => {
        const markup = renderToStaticMarkup(
            React.createElement(Slider, {
                "aria-disabled": "true",
                "aria-label": "播放进度",
                disabled: true,
                tabIndex: -1,
                value: [42],
            }),
        );
        const thumb = sliderMarkup(markup, "播放进度");

        expect(thumb).toContain('aria-disabled="true"');
        expect(thumb).toContain('tabindex="-1"');
    });

    it("keeps a disabled volume thumb out of the tab order with static disabled semantics", () => {
        const markup = renderToStaticMarkup(
            React.createElement(Slider, {
                "aria-label": "音量",
                disabled: true,
                value: [70],
            }),
        );
        const thumb = sliderMarkup(markup, "音量");

        expect(thumb).toContain('aria-disabled="true"');
        expect(thumb).not.toContain("tabindex=");
        expect(markup).toContain('data-disabled=""');
    });

    it("renders the disabled recording-player seek slider with final focus semantics", () => {
        playbackState.value = {
            audioRef: { current: { currentTime: 10 } },
            audioSrc: "",
            currentTime: 10,
            cyclePlaybackSpeed: vi.fn(),
            duration: 120,
            isPlaying: false,
            playbackSpeedLabel: "1.0x",
            progress: 50,
            seekToSliderValue: vi.fn(),
            setVolume: vi.fn(),
            togglePlayPause: vi.fn(),
            volume: 70,
        };

        const markup = renderToStaticMarkup(
            React.createElement(RecordingPlayer, {
                recording: {
                    audioUrl: "/api/recordings/rec-1/audio",
                    duration: 120,
                    filename: "Weekly sync",
                    hasAudio: false,
                    id: "rec-1",
                    sourceProvider: "ticnote",
                    startTime: "2026-05-01T10:00:00.000Z",
                } as never,
            }),
        );

        expect(sliderMarkup(markup, "播放进度")).toContain(
            'aria-disabled="true"',
        );
        expect(sliderMarkup(markup, "播放进度")).toContain('tabindex="-1"');
    });
});
