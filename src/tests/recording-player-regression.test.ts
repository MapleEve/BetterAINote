import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|CardContent|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

describe("dashboard recording player regressions", () => {
    it("does not pass an empty audio source to the hidden audio element", () => {
        const source = readFileSync(
            path.join(
                process.cwd(),
                "src/features/recordings/components/recording-player.tsx",
            ),
            "utf8",
        );

        expect(source).not.toContain("src={audioSrc}");
        expect(source).toContain("src={audioSrc || undefined}");
        expect(source).toContain("playbackDisabled");
        expect(source).toContain('data-sot-surface="recording-player"');
        expect(source).toContain("data-sot-state=");
        expect(source).toContain("disabled={playbackDisabled}");
        expect(source).toContain("useRecordingPlayback({");
        expect(source).toContain("audioUrl: recording.audioUrl");
    });

    it("keeps the no-audio warning on the player state surface", () => {
        const source = readFileSync(
            path.join(
                process.cwd(),
                "src/features/recordings/components/recording-player.tsx",
            ),
            "utf8",
        );

        expect(source).toContain('className="no-audio-banner"');
        expect(source).toContain('role="status"');
        expect(source).toContain(
            "这条录音没有本地音频，无法播放或运行私有重转写。",
        );
        expect(source).not.toContain("border-white/10");
        expect(source).not.toContain("bg-white/5");
        expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
    });

    it("keeps SOT player controls without dropping tag or speed behavior", () => {
        const source = readFileSync(
            path.join(
                process.cwd(),
                "src/features/recordings/components/recording-player.tsx",
            ),
            "utf8",
        );
        const sliderSource = readFileSync(
            path.join(process.cwd(), "src/components/ui/slider.tsx"),
            "utf8",
        );
        const buttonSource = readFileSync(
            path.join(process.cwd(), "src/components/ui/button.tsx"),
            "utf8",
        );

        expect(source).toContain('className="player"');
        expect(source).not.toContain("data-has-no-padding");
        expect(source).not.toContain("recording-player-shell");
        expect(source).toContain(
            'data-sot-state={playbackDisabled ? "disabled" : "ready"}',
        );
        expect(buttonSource).toContain('data-slot="button"');
        expect(buttonSource).toContain("buttonVariants");
        expect(source).toContain("<Button");
        expect(source).toContain('variant="default"');
        expect(source).toContain('variant="ghost"');
        expect(source).toContain('size="icon"');
        expect(source).toContain('size="icon-sm"');
        expect(source).toContain('data-sot-control="recording-player-back"');
        expect(source).toContain('data-sot-control="recording-player-play"');
        expect(source).toContain('data-sot-control="recording-player-forward"');
        expect(sliderSource).toContain(
            'import * as SliderPrimitive from "@radix-ui/react-slider";',
        );
        expect(sliderSource).toContain(
            "React.ComponentProps<typeof SliderPrimitive.Root>",
        );
        expect(sliderSource).toContain("<SliderPrimitive.Root");
        expect(sliderSource).toContain("<SliderPrimitive.Track");
        expect(sliderSource).toContain("<SliderPrimitive.Range");
        expect(sliderSource).toContain("<SliderPrimitive.Thumb");
        expect(sliderSource).toContain('data-slot="slider"');
        expect(sliderSource).toContain('data-slot="slider-track"');
        expect(sliderSource).toContain('data-slot="slider-range"');
        expect(sliderSource).toContain('data-slot="slider-thumb"');
        expect(sliderSource).not.toContain("track-fill");
        expect(sliderSource).not.toContain("track-thumb");
        expect(source).toContain('"data-sot-control": "recording-player-seek"');
        expect(source).toContain('className="vol-pop"');
        expect(source).toContain('className="vol-num mono"');
        expect(source).toContain('data-sot-control="recording-player-volume"');
        expect(source).toContain(
            'data-sot-part="recording-player-current-time"',
        );
        expect(source).toContain('data-sot-part="recording-player-duration"');
        expect(source).toContain("isTagManagerOpen");
        expect(source).toContain("tagManagerPanel");
        expect(source).toContain("<SotPlayerTagChip");
        expect(source).toContain("onClick={onToggleTagManager}");
        expect(source).toContain("count={tags.length}");
        expect(source).toContain('title="Click to cycle playback speed"');
        expect(source).toContain('"切换播放倍速"');
        expect(source).toContain('"Cycle playback speed"');
        expect(source).toContain("cyclePlaybackSpeed");
        expect(source).toContain("playbackSpeedLabel");
        expect(source).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        const speedControlIndex = source.indexOf(
            'data-sot-control="recording-player-speed"',
        );
        expect(speedControlIndex).toBeGreaterThanOrEqual(0);
        const speedControlSource = source.slice(
            Math.max(0, speedControlIndex - 420),
            speedControlIndex + 260,
        );
        expect(speedControlSource).toContain("<Button");
        expect(speedControlSource).toContain('variant="ghost"');
        expect(speedControlSource).toContain('size="sm"');
        expect(speedControlSource).toContain("min-w-12");
        expect(speedControlSource).toContain("font-mono");
        expect(speedControlSource).toContain("tabular-nums");
        expect(speedControlSource).toContain(
            'data-sot-control="recording-player-speed"',
        );
        expect(source).toContain("togglePlayPause");
        expect(source).toContain("seekToSliderValue");
        expect(source).toContain("setVolume");
        expect(source).toContain('from "@/components/ui/slider"');
        expect(source.match(/<Slider\b/g)?.length ?? 0).toBeGreaterThanOrEqual(
            2,
        );
        expect(source).not.toContain(
            '<input\n                                className="vol-range"',
        );
        expect(source).toContain('"播放"');
        expect(source).toContain('"Play"');
        expect(source).toContain('"播放进度"');
        expect(source).toContain('"Playback progress"');
        expect(source).toContain('"音量"');
        expect(source).toContain('"Volume"');
        expect(source).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
    });
});
