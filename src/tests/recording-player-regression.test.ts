import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const RECORDING_PLAYER_LEGACY_CLASS_TOKENS = [
    'className="player"',
    'className="player-meta"',
    'className="player-controls"',
    'className="player-controls is-disabled"',
    'className="time mono"',
    'className="no-audio-banner"',
    'className="no-audio-ico"',
    'className="no-audio-text"',
    'className="no-audio-title"',
    'className="no-audio-sub"',
    'className="vol-anchor"',
    'className="vol-pop"',
    'className="vol-row"',
    'className="vol-mute"',
    'className="vol-ico"',
    'className="vol-range-control"',
    'inputClassName="vol-range"',
    'className="vol-num mono"',
];

function extractCssBlock(source: string, marker: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const openBraceIndex = source.indexOf("{", markerIndex);
    expect(openBraceIndex).toBeGreaterThan(markerIndex);

    let depth = 0;
    for (let index = openBraceIndex; index < source.length; index += 1) {
        const character = source[index];
        if (character === "{") {
            depth += 1;
        } else if (character === "}") {
            depth -= 1;
            if (depth === 0) {
                return source.slice(openBraceIndex + 1, index);
            }
        }
    }

    throw new Error(`Unclosed CSS block: ${marker}`);
}

function collectCssRuleBlocks(source: string, selectorFragment: string) {
    const blocks: Array<{ prelude: string; declarations: string }> = [];
    let searchFrom = 0;

    while (searchFrom < source.length) {
        const selectorIndex = source.indexOf(selectorFragment, searchFrom);
        if (selectorIndex < 0) break;

        const openBraceIndex = source.indexOf("{", selectorIndex);
        if (openBraceIndex < 0) break;

        const previousCloseBraceIndex = source.lastIndexOf("}", selectorIndex);
        const previousOpenBraceIndex = source.lastIndexOf("{", selectorIndex);
        const preludeStart =
            previousOpenBraceIndex > previousCloseBraceIndex
                ? previousOpenBraceIndex + 1
                : previousCloseBraceIndex + 1;
        const prelude = source.slice(preludeStart, openBraceIndex);

        if (prelude.includes(selectorFragment)) {
            blocks.push({
                prelude,
                declarations: extractCssBlock(
                    source.slice(selectorIndex),
                    selectorFragment,
                ),
            });
        }

        searchFrom = openBraceIndex + 1;
    }

    return blocks;
}

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

        expect(source).toContain('data-sot-part="recording-player-no-audio"');
        expect(source).toContain("<Alert");
        expect(source).toContain(
            'className="mb-3 grid-cols-[26px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-px px-3 py-2.5"',
        );
        expect(source).toContain("<SotPlayerNoAudioIcon");
        expect(source).toContain(
            'className="col-start-1 row-span-2 place-self-center"',
        );
        expect(source).toContain("<AlertTitle");
        expect(source).toContain("<AlertDescription");
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
        const globals = readFileSync(
            path.join(process.cwd(), "src/app/globals.css"),
            "utf8",
        );

        expect(source).toContain("import { Card, CardContent, CardHeader }");
        expect(source).toContain("<Card");
        expect(source).toContain("hasNoPadding");
        expect(source).toContain("<CardHeader");
        expect(source).toContain("<CardContent");
        expect(source).not.toContain("recording-player-shell");
        expect(source).toContain(
            'data-sot-state={playbackDisabled ? "disabled" : "ready"}',
        );
        expect(buttonSource).toContain('data-slot="button"');
        expect(buttonSource).toContain("buttonVariants");
        expect(source).toContain("<Button");
        expect(source).toContain('variant="primary"');
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
        const recordingSliderPrimitiveBlocks = [
            "recording-player-seek",
            "recording-player-volume-slider",
        ].flatMap((control) =>
            ["slider", "slider-track", "slider-range", "slider-thumb"].flatMap(
                (slot) =>
                    collectCssRuleBlocks(
                        globals,
                        `[data-slot="${slot}"]`,
                    ).filter(({ prelude }) =>
                        prelude.includes(`[data-sot-control="${control}"]`),
                    ),
            ),
        );
        expect(recordingSliderPrimitiveBlocks).toEqual([]);
        expect(source).toContain(
            'data-sot-panel="recording-player-volume-popover"',
        );
        expect(source).toContain(
            'className="absolute right-0 bottom-full mb-2 min-w-[200px] gap-0 overflow-visible px-2.5 py-2"',
        );
        expect(source).toContain(
            'data-sot-control="recording-player-volume-slider"',
        );
        expect(source).toContain(
            'data-sot-part="recording-player-volume-value"',
        );
        expect(source).toContain('data-sot-control="recording-player-volume"');
        expect(source).toContain(
            'data-sot-part="recording-player-current-time"',
        );
        expect(source).toContain('data-sot-part="recording-player-duration"');
        expect(source).toContain("isTagManagerOpen");
        expect(source).toContain("tagManagerPanel");
        expect(source).toContain(
            'data-sot-panel="recording-player-tag-manager-slot"',
        );
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
        for (const legacyClass of RECORDING_PLAYER_LEGACY_CLASS_TOKENS) {
            expect(source).not.toContain(legacyClass);
        }
    });

    it("keeps player product CSS on data-sot selectors without legacy aliases", () => {
        const globals = readFileSync(
            path.join(process.cwd(), "src/app/globals.css"),
            "utf8",
        );
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                /(^|\n|,)\s*\.(?:player|player-meta|player-controls|player-meta-warn|no-audio-[a-z-]+|skel-detail|time)(?![\w-])/.test(
                    text,
                ),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of [
            '[data-sot-part="dashboard-recording-player-no-audio"][hidden]',
            '[data-sot-panel="dashboard-player-volume-popover"]',
            '[data-sot-panel="dashboard-player-volume-popover"][data-open="true"]',
            '[data-sot-part="recording-player-no-audio"][hidden]',
            '[data-sot-panel="recording-player-volume-popover"]',
            '[data-sot-panel="recording-player-volume-popover"][data-open="true"]',
            '[data-sot-panel="recording-detail-loading"]',
        ]) {
            expect(globals).toContain(selector);
        }
        for (const selector of [
            '[data-sot-part="dashboard-recording-player-no-audio"][data-slot="alert"]',
            '[data-sot-part="dashboard-recording-player-no-audio-title"][data-slot="alert-title"]',
            '[data-sot-part="dashboard-recording-player-no-audio-description"][data-slot="alert-description"]',
            '[data-sot-panel="dashboard-player-volume-popover"][data-slot="card"]',
            '[data-sot-part="recording-player-no-audio"][data-slot="alert"]',
            '[data-sot-part="recording-player-no-audio-title"][data-slot="alert-title"]',
            '[data-sot-part="recording-player-no-audio-description"][data-slot="alert-description"]',
            '[data-sot-panel="recording-player-volume-popover"][data-slot="card"]',
            '[data-sot-control="player-source-tag"][data-slot="badge"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
    });
});
