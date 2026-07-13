import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const playerSource = () =>
    readFileSync(
        path.join(
            process.cwd(),
            "src/features/recordings/components/recording-player.tsx",
        ),
        "utf8",
    );

describe("recording player semantic regression", () => {
    it("does not provide an empty audio source and exposes disabled playback through native controls", () => {
        const source = playerSource();

        expect(source).toContain("src={audioSrc || undefined}");
        expect(source).not.toContain("src={audioSrc}");
        expect(source).toContain(
            "const playbackDisabled = !recording.hasAudio || !audioSrc",
        );
        expect(source).toContain("disabled={playbackDisabled}");
        expect(source).toContain(
            'aria-disabled={playbackDisabled ? "true" : undefined}',
        );
        expect(source).toContain("tabIndex={playbackDisabled ? -1 : 0}");
        expect(source).toContain("hidden={!playbackDisabled}");
        expect(source).toContain('role="status"');
    });

    it("uses shadcn controls and Radix-backed range and popover primitives", () => {
        const source = playerSource();
        const sliderSource = readFileSync(
            path.join(process.cwd(), "src/components/ui/slider.tsx"),
            "utf8",
        );
        const popoverSource = readFileSync(
            path.join(process.cwd(), "src/components/ui/popover.tsx"),
            "utf8",
        );

        for (const primitive of [
            "<Card",
            "<CardHeader",
            "<CardContent",
            "<Alert",
            "<Badge",
            "<Button",
            "<Slider",
            "<Popover",
            "<PopoverTrigger asChild>",
            "<PopoverContent",
        ]) {
            expect(source).toContain(primitive);
        }
        expect(sliderSource).toContain(
            'import * as SliderPrimitive from "@radix-ui/react-slider";',
        );
        expect(sliderSource).toContain("<SliderPrimitive.Root");
        expect(popoverSource).toContain(
            'import * as PopoverPrimitive from "@radix-ui/react-popover";',
        );
        expect(popoverSource).toContain("<PopoverPrimitive.Content");
    });

    it("keeps playback, seek, speed, and volume actions connected to the playback hook", () => {
        const source = playerSource();

        expect(source).toContain("useRecordingPlayback({");
        expect(source).toContain("audioUrl: recording.audioUrl");
        expect(source).toContain("onClick={() => seekBySeconds(-5)}");
        expect(source).toContain("onClick={togglePlayPause}");
        expect(source).toContain("onClick={() => seekBySeconds(5)}");
        expect(source).toContain("onValueChange={seekToSliderValue}");
        expect(source).toContain("onValueCommit={seekToSliderValue}");
        expect(source).toContain("onClick={cyclePlaybackSpeed}");
        expect(source).toContain("setVolume(volumeMuted ? 70 : 0)");
        expect(source).toContain("setVolume(nextValue[0] ?? volume)");
        for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
            expect(source).toContain(`event.key === "${key}"`);
        }
    });

    it("keeps player styling local to semantic utility classes", () => {
        const source = playerSource();
        const globals = readFileSync(
            path.join(process.cwd(), "src/app/globals.css"),
            "utf8",
        );

        for (const className of [
            "RECORDING_PLAYER_META_CLASS_NAME",
            "RECORDING_PLAYER_CONTROLS_CLASS_NAME",
            "RECORDING_PLAYER_DISABLED_CLASS_NAME",
            "RECORDING_PLAYER_SPEED_CLASS_NAME",
        ]) {
            expect(source).toContain(className);
        }
        expect(source).not.toContain("recording-player-shell");
        expect(globals).not.toMatch(
            /(^|\n|,)\s*\.(?:player|player-meta|player-controls|player-meta-warn)(?![\w-])/,
        );
    });

    it("preserves source, status, tag, and overflow behavior in the player header", () => {
        const source = playerSource();

        expect(source).toContain("PLAYER_SOURCE_BADGES");
        expect(source).toContain(
            '<img\n                                        alt=""',
        );
        expect(source).not.toContain('import Image from "next/image"');
        expect(source).toContain("sourceFallbackLetter");
        expect(source).toContain("recording.sourceProvider");
        expect(source).toContain('recording.sourceProvider === "dingtalk-a1"');
        expect(source).toContain("const primaryTag = tags[0]");
        expect(source).toContain("!primaryTag && onToggleTagManager");
        expect(source).toContain("primaryTag ?");
        expect(source).toContain("tags.length > 1");
        expect(source).toContain("onToggleTagManager");
        expect(source).toContain("aria-expanded={isTagManagerOpen}");
        expect(source).toContain('data-control="player-status"');
        expect(source).toContain('data-tone="ok"');
        expect(source).toContain('<Plus aria-hidden="true" />');
    });

    it("keeps the seek thumb aligned with the SOT white surface without replacing Radix focus behavior", () => {
        const source = playerSource();

        expect(source).toContain("RECORDING_PLAYER_SEEK_THUMB_CLASS_NAME");
        expect(source).toContain(
            '"size-[14px] border-0 bg-white shadow-[0_1px_4px_rgb(0_0_0_/_0.15),0_0_0_1px_var(--line-hairline)]"',
        );
        expect(source).toContain(
            "className: RECORDING_PLAYER_SEEK_THUMB_CLASS_NAME",
        );
        expect(source).toContain("onKeyDown={(event) => {");
        expect(source).toContain("tabIndex={playbackDisabled ? -1 : 0}");
    });

    it("positions the serialized Radix thumb through its direct wrapper in visual bridges", () => {
        const e2eSource = readFileSync(
            path.join(
                process.cwd(),
                "e2e/recording-detail-workstation.spec.ts",
            ),
            "utf8",
        );
        const sharedCaptureStart = e2eSource.indexOf(
            "async function captureSotHtmlFixture(",
        );
        const sharedCaptureEnd = e2eSource.indexOf(
            "\nasync function",
            sharedCaptureStart + 1,
        );
        const sharedCaptureSource = e2eSource.slice(
            sharedCaptureStart,
            sharedCaptureEnd,
        );

        expect(sharedCaptureStart).toBeGreaterThanOrEqual(0);
        expect(sharedCaptureEnd).toBeGreaterThan(sharedCaptureStart);
        expect(sharedCaptureSource).toContain(
            "const wrapper = thumb.parentElement",
        );
        expect(sharedCaptureSource).toContain(
            'wrapper.style.setProperty("left", `${pct}%`, "important")',
        );
        expect(sharedCaptureSource).toContain('"translateX(-50%)"');
        expect(sharedCaptureSource).toContain(
            'if (!thumb.hasAttribute("data-orientation")) {',
        );
        expect(e2eSource).toContain(
            '.replace(/\\sdata-(?!(?:orientation|pct)=)[a-z-]+="[^"]*"/g, "")',
        );
        expect(sharedCaptureSource).not.toContain(
            'thumb.style.setProperty("left", left, "important")',
        );
        expect(sharedCaptureSource).not.toContain("translate(-50%, -50%)");
    });

    it("keeps the no-audio alert dimensions and text hierarchy compatible with the SOT", () => {
        const source = playerSource();

        expect(source).toContain("RECORDING_PLAYER_NO_AUDIO_ALERT_CLASS_NAME");
        expect(source).toContain(
            '"mb-3 h-[57px] box-border gap-[10px] rounded-[10px]',
        );
        expect(source).toContain("RECORDING_PLAYER_NO_AUDIO_ICON_CLASS_NAME");
        expect(source).toContain(
            '"inline-grid size-[26px] shrink-0 place-items-center',
        );
        expect(source).toMatch(
            /<VolumeX\s+aria-hidden="true"\s+size=\{14\}\s*\/>/,
        );
        expect(source).toContain("RECORDING_PLAYER_NO_AUDIO_TITLE_CLASS_NAME");
        expect(source).toContain('"min-h-0 line-clamp-none text-[12.5px]');
        expect(source).toContain(
            "RECORDING_PLAYER_NO_AUDIO_DESCRIPTION_CLASS_NAME",
        );
        expect(source).toContain('"text-[11.5px] leading-[17.25px]');
        expect(source).toContain(
            'className="no-audio-text flex min-w-0 flex-col gap-px"',
        );
        expect(source).toContain('data-part="recording-player-no-audio-text"');
        expect(source).toContain(
            '<div\n                    className="no-audio-text',
        );
    });
});
