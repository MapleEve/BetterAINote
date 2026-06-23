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

function extractOpeningElement(source: string, marker: string, tagName: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf(`<${tagName}`, markerIndex);
    const end = source.indexOf(">", markerIndex);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(markerIndex);
    return source.slice(start, end + 1);
}

function extractBoundedSlice(
    source: string,
    startMarker: string,
    endMarker: string,
) {
    const start = source.indexOf(startMarker);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf(endMarker, start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
}

function extractSelfClosingElement(
    source: string,
    marker: string,
    tagName: string,
) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf(`<${tagName}`, markerIndex);
    const end = source.indexOf("/>", markerIndex);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(markerIndex);
    return source.slice(start, end + 2);
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
        const alertPrimitive = readFileSync(
            path.join(process.cwd(), "src/components/ui/alert.tsx"),
            "utf8",
        );
        const noAudioAlert = extractOpeningElement(
            source,
            'data-sot-part="recording-player-no-audio"',
            "Alert",
        );
        const noAudioTitle = extractOpeningElement(
            source,
            'data-sot-part="recording-player-no-audio-title"',
            "AlertTitle",
        );
        const noAudioDescription = extractOpeningElement(
            source,
            'data-sot-part="recording-player-no-audio-description"',
            "AlertDescription",
        );

        expect(alertPrimitive).toContain("playerNoAudio:");
        expect(alertPrimitive).toContain('| "playerNoAudio"');
        expect(source).toContain('data-sot-part="recording-player-no-audio"');
        expect(source).toContain("<Alert");
        expect(noAudioAlert).toContain('variant="playerNoAudio"');
        expect(noAudioAlert).toContain('density="playerNoAudio"');
        expect(noAudioAlert).toContain('layout="playerNoAudio"');
        expect(noAudioAlert).not.toContain("className=");
        expect(alertPrimitive).toContain("data-player-no-audio-text");
        expect(alertPrimitive).not.toContain(
            "dashboard-recording-player-no-audio-text",
        );
        expect(alertPrimitive).not.toContain("recording-player-no-audio-text");
        expect(source).toContain("<SotPlayerNoAudioIcon");
        expect(source).not.toContain(
            'className="col-start-1 row-span-2 place-self-center"',
        );
        expect(source).not.toContain(
            '<SotPlayerNoAudioIcon className="size-3.5" />',
        );
        expect(source).toContain("<AlertTitle");
        expect(noAudioTitle).toContain('density="playerNoAudio"');
        expect(source).toContain("<AlertDescription");
        expect(noAudioDescription).toContain('density="playerNoAudio"');
        expect(source).toContain('role="status"');
        expect(source).toContain(
            "这条录音没有本地音频，无法播放或运行私有重转写。",
        );
        expect(source).not.toContain(
            'className="mb-3 grid-cols-[26px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-px px-3 py-2.5"',
        );
        expect(source).not.toContain("border-white/10");
        expect(source).not.toContain("bg-white/5");
        expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
    });

    it("keeps player badge styling on Badge variants instead of feature constants", () => {
        const badgePrimitive = readFileSync(
            path.join(process.cwd(), "src/components/ui/badge.tsx"),
            "utf8",
        );
        const buttonPrimitive = readFileSync(
            path.join(process.cwd(), "src/components/ui/button.tsx"),
            "utf8",
        );
        const sotPlayerPrimitives = readFileSync(
            path.join(
                process.cwd(),
                "src/features/recordings/components/sot-player-primitives.tsx",
            ),
            "utf8",
        );
        const globals = readFileSync(
            path.join(process.cwd(), "src/app/globals.css"),
            "utf8",
        );
        const sourceBadge = extractOpeningElement(
            sotPlayerPrimitives,
            'data-sot-control="player-source-tag"',
            "Badge",
        );
        const statusBadge = extractOpeningElement(
            sotPlayerPrimitives,
            'data-sot-control="player-status"',
            "Badge",
        );
        const tagChipPrimitive = extractBoundedSlice(
            sotPlayerPrimitives,
            "export function SotPlayerTagChip",
            "export type SotPlayerStatusTone",
        );

        expect(badgePrimitive).toContain("playerSource:");
        expect(badgePrimitive).toContain("playerStatus:");
        for (const playerStatusToken of [
            "data-[sot-tone=ok]:border-[var(--source-provider-status-success-border)]",
            "data-[sot-tone=ok]:bg-[var(--source-provider-status-success-bg)]",
            "data-[sot-tone=ok]:text-[var(--signal-success)]",
            "data-[sot-tone=warn]:border-[var(--source-provider-status-warning-border)]",
            "data-[sot-tone=warn]:bg-[var(--source-provider-status-warning-bg)]",
            "data-[sot-tone=warn]:text-[var(--signal-warning-strong)]",
            "data-[sot-tone=err]:border-[var(--source-provider-status-danger-border)]",
            "data-[sot-tone=err]:bg-[var(--source-provider-status-danger-bg)]",
            "data-[sot-tone=err]:text-[var(--signal-danger)]",
            "data-[sot-tone=info]:border-[var(--source-provider-status-info-border)]",
            "data-[sot-tone=info]:bg-[var(--source-provider-status-info-bg)]",
            "data-[sot-tone=info]:text-[var(--signal-info)]",
            "data-[sot-tone=neu]:border-[var(--line-hairline)]",
            "data-[sot-tone=neu]:bg-[var(--bg-recessed)]",
            "data-[sot-tone=neu]:text-[var(--fg-secondary)]",
            "[&_[data-sot-part=status-dot]]:size-[5px]",
            "[&_[data-sot-part=status-dot]]:rounded-full",
            "[&_[data-sot-part=status-dot]]:bg-current",
            "data-[sot-tone=warn]:[&_[data-sot-part=status-dot]]:animate-[bpulse_1.4s_ease-in-out_infinite]",
            "[&_[data-sot-part=status-label]]:ml-[4px]",
        ]) {
            expect(badgePrimitive).toContain(playerStatusToken);
        }
        expect(badgePrimitive).toContain("playerTagChip:");
        expect(badgePrimitive).toContain("playerTagOverflow:");
        expect(buttonPrimitive).toContain("playerTagAdd:");
        expect(buttonPrimitive).toContain("playerTagChip:");
        expect(buttonPrimitive).toContain("playerTagOverflow:");
        expect(sotPlayerPrimitives).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(sourceBadge).toContain('variant="playerSource"');
        expect(sourceBadge).toContain(
            'data-sot-control="player-source-tag"',
        );
        expect(sourceBadge).not.toContain("className=");
        expect(statusBadge).toContain('variant="playerStatus"');
        expect(statusBadge).toContain('data-sot-control="player-status"');
        expect(statusBadge).not.toContain("className=");
        expect(
            collectCssRuleBlocks(globals, '[data-sot-control="player-status"]'),
        ).toEqual([]);
        expect(sotPlayerPrimitives).not.toContain(
            "SOT_PLAYER_SOURCE_BADGE_CLASS",
        );
        expect(sotPlayerPrimitives).not.toContain(
            "SOT_PLAYER_STATUS_BADGE_CLASS",
        );
        expect(tagChipPrimitive).toContain('variant="playerTagAdd"');
        expect(tagChipPrimitive).toContain('size="playerTagAdd"');
        expect(tagChipPrimitive).toContain('variant="playerTagChip"');
        expect(tagChipPrimitive).toContain('size="playerTagChip"');
        expect(tagChipPrimitive).toContain('variant="playerTagOverflow"');
        expect(tagChipPrimitive).toContain('size="playerTagOverflow"');
        expect(tagChipPrimitive).not.toContain('variant="outline"');
        expect(tagChipPrimitive).not.toContain('size="xs"');
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
        const popoverSource = readFileSync(
            path.join(process.cwd(), "src/components/ui/popover.tsx"),
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
        expect(buttonSource).toContain("playerControl:");
        expect(buttonSource).toContain("playerPrimary:");
        expect(buttonSource).toContain("playerSpeed:");
        expect(buttonSource).toContain("playerControlSm:");
        expect(buttonSource).toContain("playerControlLg:");
        expect(buttonSource).toContain("tabular-nums");
        expect(buttonSource).toContain("data-player-control-icon");
        expect(buttonSource).not.toContain("dashboard-player-volume-icon");
        expect(buttonSource).not.toContain("recording-player-volume-icon");
        expect(source).toContain("<Button");
        expect(source).toContain(
            'import {\n    Popover,\n    PopoverContent,\n    PopoverTrigger,\n} from "@/components/ui/popover";',
        );
        expect(source).toContain("<Popover");
        expect(source).toContain("<PopoverTrigger asChild>");
        expect(source).toContain("<PopoverContent");
        const backControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-back"',
            "Button",
        );
        const playControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-play"',
            "Button",
        );
        const forwardControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-forward"',
            "Button",
        );
        const speedControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-speed"',
            "Button",
        );
        const volumeControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-volume"',
            "Button",
        );
        const volumeMuteControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-volume-mute"',
            "Button",
        );

        for (const control of [backControl, forwardControl]) {
            expect(control).toContain('variant="playerControl"');
            expect(control).toContain('size="playerControl"');
            expect(control).not.toContain("className=");
        }
        expect(playControl).toContain('variant="playerPrimary"');
        expect(playControl).toContain('size="playerControlLg"');
        expect(playControl).not.toContain("className=");
        expect(speedControl).toContain('variant="playerSpeed"');
        expect(speedControl).toContain('size="playerSpeed"');
        expect(speedControl).not.toContain("className=");
        for (const control of [volumeControl, volumeMuteControl]) {
            expect(control).toContain('variant="playerControl"');
            expect(control).toContain('size="playerControlSm"');
            expect(control).not.toContain("className=");
        }
        expect(source).toContain("data-player-control-icon");
        for (const legacyControlToken of [
            'variant="outline"',
            'variant="default"',
            'variant="ghost"',
            'size="icon"',
            'size="icon-sm"',
            'size="icon-lg"',
            'size="sm"',
            'size="icon-xs"',
            'className="size-11 shrink rounded-full shadow-sm"',
            'className="shrink rounded-full"',
        ]) {
            expect(source).not.toContain(legacyControlToken);
        }
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
        expect(sliderSource).toContain(
            'type SliderVariant = "default" | "playerSeek" | "playerVolume";',
        );
        expect(sliderSource).toContain("SLIDER_ROOT_VARIANT_CLASS");
        expect(sliderSource).toContain("SLIDER_TRACK_VARIANT_CLASS");
        expect(sliderSource).toContain("SLIDER_RANGE_VARIANT_CLASS");
        expect(sliderSource).toContain("SLIDER_THUMB_VARIANT_CLASS");
        expect(sliderSource).toContain("data-variant={variant}");
        expect(sliderSource).toContain("playerSeek:");
        expect(sliderSource).toContain(
            "h-[14px] min-w-0 flex-1 cursor-pointer",
        );
        expect(sliderSource).toContain("bg-[rgb(224_227_230)]");
        expect(sliderSource).toContain(
            "bg-[image:linear-gradient(90deg,var(--steel-500),var(--accent))]",
        );
        expect(sliderSource).toContain(
            "shadow-[0_1px_4px_rgb(0_0_0_/_0.15),0_0_0_1px_var(--line-hairline)]",
        );
        expect(sliderSource).toContain("playerVolume:");
        expect(sliderSource).toContain(
            'playerVolume: "h-[18px] min-w-[110px] flex-1"',
        );
        expect(popoverSource).toContain(
            'type PopoverContentVariant = "default" | "playerVolume";',
        );
        expect(popoverSource).toContain("POPOVER_CONTENT_VARIANT_CLASS");
        expect(popoverSource).toContain(
            'playerVolume: "w-[200px] min-w-[200px] gap-0 overflow-visible px-2.5 py-2"',
        );
        expect(popoverSource).toContain("data-variant={variant}");
        expect(sliderSource).not.toContain("track-fill");
        expect(sliderSource).not.toContain("track-thumb");
        expect(source).toContain('"data-sot-control": "recording-player-seek"');
        expect(source).not.toContain("SOT_PLAYER_SEEK_SLIDER_CLASS");
        expect(source).not.toContain("SOT_PLAYER_SEEK_RANGE_CLASS");
        expect(source).not.toContain("SOT_PLAYER_SEEK_THUMB_CLASS");
        expect(source).not.toContain("SOT_PLAYER_VOLUME_SLIDER_CLASS");
        expect(source).not.toContain("recordingSeekSliderRootStyle");
        expect(source).not.toContain("sotPlayerSeekRangeStyle");
        expect(source).not.toContain("sotPlayerSeekThumbStyle");
        const seekSliderSource = extractSelfClosingElement(
            source,
            '"data-sot-control": "recording-player-seek"',
            "Slider",
        );
        expect(seekSliderSource).toContain('variant="playerSeek"');
        expect(seekSliderSource).toContain("rootProps={{");
        expect(seekSliderSource).toContain("rangeProps={{");
        expect(seekSliderSource).toContain("thumbProps={{");
        expect(seekSliderSource).toContain('"data-pct": playerProgressPct');
        expect(seekSliderSource).toContain(
            '"aria-disabled": playbackDisabled ? "true" : undefined',
        );
        expect(seekSliderSource).toContain('"aria-valuemax": 100');
        expect(seekSliderSource).toContain('"aria-valuemin": 0');
        expect(seekSliderSource).toContain(
            '"aria-valuenow": Math.round(progress)',
        );
        expect(seekSliderSource).toContain('"data-sot-state": controlState');
        expect(seekSliderSource).toContain("onClick: (event) =>");
        expect(seekSliderSource).toContain("seekToPercent(");
        expect(seekSliderSource).toContain("onKeyDown: (event) =>");
        expect(seekSliderSource).toContain('event.key === "ArrowLeft"');
        expect(seekSliderSource).toContain('event.key === "ArrowRight"');
        expect(seekSliderSource).toContain('event.key === "Home"');
        expect(seekSliderSource).toContain('event.key === "End"');
        expect(seekSliderSource).toContain('role: "slider"');
        expect(seekSliderSource).toContain(
            "tabIndex: playbackDisabled ? -1 : 0",
        );
        expect(seekSliderSource).not.toContain("className=");
        expect(seekSliderSource).not.toContain("className:");
        expect(seekSliderSource).not.toContain("style:");
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
        const volumePopoverSource = extractOpeningElement(
            source,
            'data-sot-panel="recording-player-volume-popover"',
            "PopoverContent",
        );
        expect(volumePopoverSource).toContain('variant="playerVolume"');
        expect(volumePopoverSource).not.toContain("className=");
        expect(source).not.toContain(
            'className="w-[200px] min-w-[200px] gap-0 overflow-visible px-2.5 py-2"',
        );
        expect(source).toContain('side="top"');
        expect(source).toContain('align="end"');
        expect(source).toContain(
            'data-sot-control="recording-player-volume-slider"',
        );
        const volumeSliderSource = extractSelfClosingElement(
            source,
            'data-sot-control="recording-player-volume-slider"',
            "Slider",
        );
        expect(volumeSliderSource).toContain('variant="playerVolume"');
        expect(volumeSliderSource).toContain("data-sot-state={controlState}");
        expect(volumeSliderSource).toContain("aria-label={");
        expect(volumeSliderSource).toContain("onValueChange={(nextValue) =>");
        expect(volumeSliderSource).not.toContain("className=");
        expect(volumeSliderSource).not.toContain(
            "SOT_PLAYER_VOLUME_SLIDER_CLASS",
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
        expect(speedControl).toContain("<Button");
        expect(speedControl).toContain(
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
        expect(source).not.toContain("hidden={!volumePopoverOpen}");
        expect(source).not.toContain(
            'aria-hidden={volumePopoverOpen ? undefined : "true"}',
        );
        expect(source).not.toContain('role="dialog"');
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
        const recordingLoading = readFileSync(
            path.join(
                process.cwd(),
                "src/app/(app)/recordings/[id]/loading.tsx",
            ),
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
            '[data-sot-part="recording-player-no-audio"][hidden]',
        ]) {
            expect(globals).toContain(selector);
        }
        expect(globals).not.toContain(
            '[data-sot-panel="recording-detail-loading"]',
        );
        expect(recordingLoading).toContain(
            'data-sot-panel="recording-detail-loading"',
        );
        expect(recordingLoading).toContain('variant="routeLoadingSurface"');
        expect(recordingLoading).toContain(
            "const recordingDetailLoadingSkeletonClassNames",
        );
        expect(recordingLoading).toContain(
            "recordingDetailLoadingAvatar:",
        );
        expect(recordingLoading).toContain("recordingDetailLoadingBar:");
        expect(recordingLoading).toContain(
            "recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingAvatar",
        );
        expect(recordingLoading).toContain(
            "recordingDetailLoadingSkeletonClassNames.recordingDetailLoadingBar",
        );
        expect(recordingLoading).toContain('variant="default"');
        expect(recordingLoading).toContain('size="default"');
        expect(recordingLoading).not.toContain(
            'size="recordingDetailLoadingAvatar"',
        );
        expect(recordingLoading).not.toContain(
            'size="recordingDetailLoadingBar"',
        );
        for (const [surface, selector] of [
            [
                '[data-sot-surface="dashboard-recording-player"]',
                '[data-sot-panel="dashboard-player-volume-popover"]',
            ],
            [
                '[data-sot-surface="dashboard-recording-player"]',
                '[data-sot-panel="dashboard-player-volume-popover"][hidden]',
            ],
            [
                '[data-sot-surface="dashboard-recording-player"]',
                '[data-sot-panel="dashboard-player-volume-popover"][data-open="true"]',
            ],
            [
                '[data-sot-surface="dashboard-recording-player"]',
                '[data-sot-part="dashboard-player-volume-row"]',
            ],
            [
                '[data-sot-surface="dashboard-recording-player"]',
                '[data-sot-part="dashboard-player-volume-icon"]',
            ],
            [
                '[data-sot-surface="dashboard-recording-player"]',
                '[data-sot-part="dashboard-player-volume-value"]',
            ],
            [
                '[data-sot-surface="recording-player"]',
                '[data-sot-panel="recording-player-volume-popover"]',
            ],
            [
                '[data-sot-surface="recording-player"]',
                '[data-sot-panel="recording-player-volume-popover"][hidden]',
            ],
            [
                '[data-sot-surface="recording-player"]',
                '[data-sot-panel="recording-player-volume-popover"][data-open="true"]',
            ],
            [
                '[data-sot-surface="recording-player"]',
                '[data-sot-part="recording-player-volume-row"]',
            ],
            [
                '[data-sot-surface="recording-player"]',
                '[data-sot-part="recording-player-volume-icon"]',
            ],
            [
                '[data-sot-surface="recording-player"]',
                '[data-sot-part="recording-player-volume-value"]',
            ],
        ] as const) {
            expect(
                collectCssRuleBlocks(globals, selector).filter(({ prelude }) =>
                    prelude.includes(surface),
                ),
            ).toEqual([]);
        }
        for (const selector of [
            '[data-sot-part="dashboard-recording-player-no-audio"][data-slot="alert"]',
            '[data-sot-part="dashboard-recording-player-no-audio-title"][data-slot="alert-title"]',
            '[data-sot-part="dashboard-recording-player-no-audio-description"][data-slot="alert-description"]',
            '[data-sot-panel="dashboard-player-volume-popover"][data-slot="popover-content"]',
            '[data-sot-part="recording-player-no-audio"][data-slot="alert"]',
            '[data-sot-part="recording-player-no-audio-title"][data-slot="alert-title"]',
            '[data-sot-part="recording-player-no-audio-description"][data-slot="alert-description"]',
            '[data-sot-panel="recording-player-volume-popover"][data-slot="popover-content"]',
            '[data-sot-control="player-source-tag"][data-slot="badge"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
    });
});
