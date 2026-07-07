import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

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

const ROUTE_LOADING_SURFACE_CLASS_TOKENS =
    "min-h-0 gap-0 overflow-hidden rounded-2xl border-border bg-card shadow-sm".split(
        " ",
    );
const RETIRED_DASHBOARD_RECORDING_PLAYER_SOT_CONSTANTS = [
    "SOT_DASHBOARD_RECORDING_PLAYER_CARD_CLASS_NAME",
    "SOT_DASHBOARD_RECORDING_PLAYER_META_CLASS_NAME",
    "SOT_DASHBOARD_RECORDING_PLAYER_DATE_CLASS_NAME",
] as const;
const DASHBOARD_PLAYER_CONTROLS_CLASS_INITIALIZERS = [
    {
        constName: "DASHBOARD_PLAYER_TIME_CLASS_NAME",
        expected:
            "min-w-11 text-center font-mono text-xs font-medium tracking-[0.03em] text-[var(--fg-tertiary)]",
    },
    {
        constName: "DASHBOARD_PLAYER_DURATION_CLASS_NAME",
        expected:
            "min-w-11 text-center font-mono text-xs font-medium tracking-[0.03em] text-[var(--fg-tertiary)]",
    },
    {
        constName: "DASHBOARD_PLAYER_DISABLED_CLASS_NAME",
        expected:
            "pointer-events-none opacity-[0.42] data-[disabled]:opacity-[0.42]",
    },
    {
        constName: "DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME",
        expected: "disabled:cursor-not-allowed disabled:opacity-[0.42]",
    },
    {
        constName: "DASHBOARD_PLAYER_SPEED_CLASS_NAME",
        expected:
            "max-[640px]:w-[50.75px] max-[640px]:min-w-[50.75px] max-[640px]:basis-[50.75px] max-[640px]:grow-0 max-[640px]:shrink-0",
    },
] as const;
const RECORDING_PLAYER_CLASS_INITIALIZERS = [
    {
        constName: "RECORDING_PLAYER_META_CLASS_NAME",
        expected: "flex flex-wrap items-center gap-2.5",
    },
    {
        constName: "RECORDING_PLAYER_DATE_CLASS_NAME",
        expected:
            "[font:500_11.5px_var(--font-mono)] tracking-[0.02em] text-[var(--fg-tertiary)]",
    },
    {
        constName: "RECORDING_PLAYER_TAG_MANAGER_SLOT_CLASS_NAME",
        expected: "mb-3",
    },
    {
        constName: "RECORDING_PLAYER_CONTROLS_CLASS_NAME",
        expected: "flex min-w-0 items-center gap-3 overflow-visible",
    },
    {
        constName: "RECORDING_PLAYER_TIME_CLASS_NAME",
        expected:
            "min-w-11 text-center [font:500_12px_var(--font-mono)] tracking-[0.03em] text-[var(--fg-tertiary)]",
    },
    {
        constName: "RECORDING_PLAYER_DISABLED_CLASS_NAME",
        expected:
            "pointer-events-none opacity-[0.42] data-[disabled]:opacity-[0.42]",
    },
    {
        constName: "RECORDING_PLAYER_SPEED_CLASS_NAME",
        expected:
            "max-[640px]:w-[50.75px] max-[640px]:min-w-[50.75px] max-[640px]:basis-[50.75px] max-[640px]:grow-0 max-[640px]:shrink-0",
    },
    {
        constName: "RECORDING_PLAYER_VOLUME_ANCHOR_CLASS_NAME",
        expected: "relative inline-flex",
    },
] as const;

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

function extractOpeningElement(
    source: string,
    marker: string,
    tagName: string,
) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf(`<${tagName}`, markerIndex);
    const end = source.indexOf(">", markerIndex);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(markerIndex);
    return source.slice(start, end + 1);
}

function extractElementSlice(source: string, marker: string, tagName: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf(`<${tagName}`, markerIndex);
    const end = source.indexOf(`</${tagName}>`, markerIndex);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + tagName.length + 3);
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

function expectExactStringConstInitializer(
    source: string,
    constName: string,
    expected: string,
) {
    const escapedConstName = constName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`\\bconst\\s+${escapedConstName}\\b`).exec(source);

    expect(match).not.toBeNull();
    const declarationStart = match?.index ?? -1;
    const assignmentStart = source.indexOf("=", declarationStart);
    const declarationEnd = source.indexOf(";", assignmentStart);
    expect(assignmentStart).toBeGreaterThan(declarationStart);
    expect(declarationEnd).toBeGreaterThan(assignmentStart);

    const initializerExpression = source
        .slice(assignmentStart + 1, declarationEnd)
        .trim();
    expect(initializerExpression).toBe(`"${expected}"`);
    return expected;
}

function expectExactStringConstInitializers(
    source: string,
    initializers: readonly { constName: string; expected: string }[],
) {
    for (const { constName, expected } of initializers) {
        expectExactStringConstInitializer(source, constName, expected);
    }
}

function expectClassNameConstReference(
    openingElement: string,
    constName: string,
) {
    const escapedConstName = constName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(openingElement).toMatch(
        new RegExp(`className=\\{\\s*${escapedConstName}\\s*\\}`),
    );
    expect(openingElement).not.toContain('className="');
}

function expectSotPlayerNoAudioPrimitiveBindings(source: string) {
    const noAudioAlert = extractOpeningElement(
        source,
        "data-sot-state={playbackDisabled",
        "Alert",
    );
    const noAudioIcon = extractOpeningElement(
        source,
        "data-sot-part={iconPart}",
        "VolumeX",
    );
    const noAudioText = extractOpeningElement(
        source,
        "data-player-no-audio-text",
        "span",
    );
    const noAudioTitle = extractOpeningElement(
        source,
        "data-sot-part={titlePart}",
        "AlertTitle",
    );
    const noAudioDescription = extractOpeningElement(
        source,
        "data-sot-part={descriptionPart}",
        "AlertDescription",
    );

    expect(noAudioAlert).toContain('variant="default"');
    expect(noAudioAlert).toContain('density="comfortable"');
    expect(noAudioAlert).toContain('layout="inline"');
    expect(noAudioAlert).toContain('className={cn("mb-3", className)}');
    expect(noAudioAlert).toContain("data-sot-part={part}");
    expect(noAudioAlert).toContain(
        'data-sot-state={playbackDisabled ? "visible" : "hidden"}',
    );
    expect(noAudioAlert).toContain("hidden={!playbackDisabled}");
    expect(noAudioAlert).toContain('role="status"');
    expect(noAudioAlert).not.toContain("style=");
    expect(source).toContain(
        '"children" | "density" | "layout" | "style" | "variant"',
    );
    expect(source).not.toContain("style={style}");
    expect(noAudioIcon).toContain("data-sot-part={iconPart}");
    expectClassNameConstReference(noAudioText, "PLAYER_NO_AUDIO_TEXT_CLASS");
    expect(noAudioText).toContain("data-player-no-audio-text");
    expect(noAudioText).toContain("data-sot-part={textPart}");
    expect(noAudioTitle).not.toContain("className=");
    expect(noAudioDescription).toContain('density="comfortable"');
}

function expectSotPlayerSourcePrimitiveBindings(source: string) {
    const sourceBadge = extractOpeningElement(
        source,
        'data-sot-control="player-source-tag"',
        "Badge",
    );
    const sourceIcon = extractOpeningElement(
        source,
        'data-sot-part="source-icon"',
        "span",
    );
    const sourceIconImage = extractOpeningElement(
        source,
        "src={badge.icon}",
        "Image",
    );

    expectClassNameConstReference(sourceBadge, "PLAYER_SOURCE_BADGE_CLASS");
    expect(sourceBadge).toContain('variant="outline"');
    expect(sourceBadge).toContain('data-sot-control="player-source-tag"');
    expectClassNameConstReference(sourceIcon, "PLAYER_SOURCE_ICON_CLASS");
    expect(sourceIcon).toContain('data-sot-part="source-icon"');
    expect(sourceIcon).toContain(
        'data-sot-source-icon={hasImage ? "image" : "letter"}',
    );
    expectClassNameConstReference(
        sourceIconImage,
        "PLAYER_SOURCE_ICON_IMAGE_CLASS",
    );
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
        const sotPlayerPrimitives = readFileSync(
            path.join(
                process.cwd(),
                "src/features/recordings/components/sot-player-primitives.tsx",
            ),
            "utf8",
        );
        const noAudioAlert = extractOpeningElement(
            source,
            'part="recording-player-no-audio"',
            "SotPlayerNoAudioAlert",
        );

        expect(alertPrimitive).not.toContain("playerNoAudio");
        expect(alertPrimitive).not.toContain("data-player-no-audio-text");
        expect(source).toContain("<SotPlayerNoAudioAlert");
        expect(noAudioAlert).toContain('part="recording-player-no-audio"');
        expect(noAudioAlert).toContain(
            'iconPart="recording-player-no-audio-icon"',
        );
        expect(noAudioAlert).toContain(
            'textPart="recording-player-no-audio-text"',
        );
        expect(noAudioAlert).toContain(
            'titlePart="recording-player-no-audio-title"',
        );
        expect(noAudioAlert).toContain(
            'descriptionPart="recording-player-no-audio-description"',
        );
        expect(noAudioAlert).toContain("playbackDisabled={playbackDisabled}");
        expect(noAudioAlert).not.toContain("variant=");
        expect(noAudioAlert).not.toContain("density=");
        expect(noAudioAlert).not.toContain("layout=");
        expect(noAudioAlert).not.toContain("className=");
        expect(sotPlayerPrimitives).toContain("SotPlayerNoAudioAlert");
        expectSotPlayerNoAudioPrimitiveBindings(sotPlayerPrimitives);
        expect(sotPlayerPrimitives).toContain("<VolumeX");
        expect(sotPlayerPrimitives).toContain("<AlertTitle");
        expect(sotPlayerPrimitives).toContain("<AlertDescription");
        expect(sotPlayerPrimitives).toContain(
            "这条录音没有本地音频，无法播放或运行私有重转写。",
        );
        expect(source).not.toContain(
            'className="col-start-1 row-span-2 place-self-center"',
        );
        expect(source).not.toContain(
            '<SotPlayerNoAudioIcon className="size-3.5" />',
        );
        expect(source).not.toContain(
            'className="mb-3 grid-cols-[26px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-px px-3 py-2.5"',
        );
        expect(source).not.toContain("border-white/10");
        expect(source).not.toContain("bg-white/5");
        expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
    });

    it("keeps player status and tags on shadcn badges without SOT player style vars", () => {
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
        const statusVariantBlock = extractBoundedSlice(
            sotPlayerPrimitives,
            "const PLAYER_STATUS_VARIANT",
            "export function SotPlayerStatusBadge",
        );
        const tagChipPrimitive = extractBoundedSlice(
            sotPlayerPrimitives,
            "export function SotPlayerTagChip",
            "export type SotPlayerStatusTone",
        );
        const legacyPlayerStatusVariantKey = `${"player"}Status:`;
        const legacyPlayerSourceVariantUsage = `variant="${"player"}Source"`;
        const legacyPlayerTagVariantUsagePrefix = `variant="${"player"}Tag`;
        const legacyPlayerTagSizeUsagePrefix = `size="${"player"}Tag`;

        expect(badgePrimitive).not.toContain("playerSource:");
        expect(badgePrimitive).not.toContain(legacyPlayerStatusVariantKey);
        expect(badgePrimitive).not.toContain("min-w-[65.171875px]");
        expect(badgePrimitive).not.toContain("[&_[data-sot-part=status-dot]]");
        expect(badgePrimitive).not.toContain(
            "[&_[data-sot-part=status-label]]",
        );
        for (const forbiddenSotPlayerToken of [
            "SOT_PLAYER_",
            "--sot-player-",
            "min-w-[65.171875px]",
            "[&_[data-sot-part=status-dot]]",
            "[&_[data-sot-part=status-label]]",
        ]) {
            expect(sotPlayerPrimitives).not.toContain(forbiddenSotPlayerToken);
        }
        expect(badgePrimitive).not.toContain("playerTagChip:");
        expect(badgePrimitive).not.toContain("playerTagOverflow:");
        expect(buttonPrimitive).not.toContain("playerTagAdd:");
        expect(buttonPrimitive).not.toContain("playerTagChip:");
        expect(buttonPrimitive).not.toContain("playerTagOverflow:");
        expect(sotPlayerPrimitives).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expectSotPlayerSourcePrimitiveBindings(sotPlayerPrimitives);
        expect(sourceBadge).toContain('variant="outline"');
        expect(sourceBadge).toContain("className={PLAYER_SOURCE_BADGE_CLASS}");
        expect(sourceBadge).toContain('data-sot-control="player-source-tag"');
        expect(sotPlayerPrimitives).not.toContain(
            legacyPlayerSourceVariantUsage,
        );
        expect(sotPlayerPrimitives).toContain("PLAYER_STATUS_VARIANT");
        expect(statusVariantBlock).toContain(
            'React.ComponentProps<typeof Badge>["variant"]',
        );
        for (const expectedStatusVariant of [
            'err: "destructive"',
            'info: "secondary"',
            'neu: "outline"',
            'ok: "secondary"',
            'warn: "secondary"',
        ]) {
            expect(statusVariantBlock).toContain(expectedStatusVariant);
        }
        expect(sotPlayerPrimitives).not.toContain("PLAYER_STATUS_TONE_CLASS");
        expect(statusBadge).toContain("variant={PLAYER_STATUS_VARIANT[tone]}");
        expect(statusBadge).toContain("className={className}");
        expect(statusBadge).toContain('data-sot-control="player-status"');
        expect(statusBadge).toContain("data-sot-tone={tone}");
        expect(sotPlayerPrimitives).toContain("className?: string;");
        expect(sotPlayerPrimitives).not.toContain('data-sot-part="status-dot"');
        expect(sotPlayerPrimitives).not.toContain(
            '"size-1.5 rounded-full bg-current"',
        );
        expect(sotPlayerPrimitives).not.toContain("animate-[bpulse");
        expect(statusBadge).not.toContain("text-chart-");
        expect(statusBadge).not.toContain("text-destructive");
        expect(statusBadge).not.toContain("text-muted-foreground");
        expect(sotPlayerPrimitives).toContain(
            '<span data-sot-part="status-label">{label}</span>',
        );
        expect(
            collectCssRuleBlocks(globals, '[data-sot-control="player-status"]'),
        ).toEqual([]);
        for (const sotPlayerTagChipToken of [
            "--sot-player-tag-chip-bg",
            "--sot-player-tag-chip-border",
            "--sot-player-tag-chip-fg",
            "--sot-player-tag-chip-blue-bg",
            "--sot-player-tag-chip-blue-border",
            "--sot-player-tag-chip-blue-fg",
            "SOT_PLAYER_TAG",
        ]) {
            expect(globals).not.toContain(sotPlayerTagChipToken);
            expect(sotPlayerPrimitives).not.toContain(sotPlayerTagChipToken);
        }
        expect(sotPlayerPrimitives).toContain("PLAYER_TAG_COLOR_CLASS");
        expect(sotPlayerPrimitives).toContain("PLAYER_TAG_CHIP_CLASS");
        expect(sotPlayerPrimitives).not.toContain("sotPlayerTagChipStyle");
        expect(sotPlayerPrimitives).not.toContain(
            'background: "var(--sot-player-tag-chip-bg)"',
        );
        expect(sotPlayerPrimitives).not.toContain(
            'borderColor: "var(--sot-player-tag-chip-border)"',
        );
        expect(sotPlayerPrimitives).not.toContain(
            'color: "var(--sot-player-tag-chip-fg)"',
        );
        expect(globals).not.toContain("dashboard-recording-tag-chip");
        expect(badgePrimitive).not.toContain("dashboard-recording-tag-chip");
        expect(sotPlayerPrimitives).not.toContain(
            "dashboard-recording-tag-chip",
        );
        expect(tagChipPrimitive).toContain('variant="secondary"');
        expect(tagChipPrimitive).toContain('variant="outline"');
        expect(tagChipPrimitive).toContain('size="xs"');
        expect(tagChipPrimitive).toContain("PLAYER_TAG_COLOR_CLASS[tag.color]");
        expect(tagChipPrimitive).toContain("PLAYER_TAG_OVERFLOW_CLASS");
        expect(tagChipPrimitive).not.toContain(
            legacyPlayerTagVariantUsagePrefix,
        );
        expect(tagChipPrimitive).not.toContain(legacyPlayerTagSizeUsagePrefix);
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
        const sotPlayerPrimitives = readFileSync(
            path.join(
                process.cwd(),
                "src/features/recordings/components/sot-player-primitives.tsx",
            ),
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
        expect(buttonSource).not.toContain("playerControl:");
        expect(buttonSource).not.toContain("playerPrimary:");
        expect(buttonSource).not.toContain("playerSpeed:");
        expect(buttonSource).not.toContain("playerControlSm:");
        expect(buttonSource).not.toContain("playerControlLg:");
        expect(buttonSource).not.toContain("data-player-control-icon");
        for (const removedWrapperToken of [
            "type SotPlayerButtonProps",
            "export function SotPlayerControlButton",
            "export function SotPlayerPrimaryButton",
            "export function SotPlayerSpeedButton",
            "export function SotPlayerSeekSlider",
            "export function SotPlayerVolumeSlider",
            "export function SotPlayerVolumePopoverContent",
            "SOT_PLAYER_CONTROL_BUTTON_CLASS",
            "SOT_PLAYER_PRIMARY_BUTTON_CLASS",
            "SOT_PLAYER_SPEED_BUTTON_CLASS",
            "SOT_PLAYER_SEEK_SLIDER_CLASS",
            "SOT_PLAYER_VOLUME_SLIDER_CLASS",
            "data-player-control-icon",
        ]) {
            expect(sotPlayerPrimitives).not.toContain(removedWrapperToken);
        }
        expect(buttonSource).not.toContain("dashboard-player-volume-icon");
        expect(buttonSource).not.toContain("recording-player-volume-icon");
        expect(source).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(source).toContain("PopoverContent");
        expect(source).toContain(
            'import { Slider } from "@/components/ui/slider";',
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
            expect(control).toContain("<Button");
            expect(control).toContain('variant="ghost"');
            expect(control).toContain('size="icon"');
            expect(control).not.toContain("className=");
        }
        expect(playControl).toContain("<Button");
        expect(playControl).toContain('variant="default"');
        expect(playControl).toContain('size="icon-lg"');
        expect(playControl).not.toContain("className=");
        expect(speedControl).toContain("<Button");
        expect(speedControl).toContain('variant="ghost"');
        expect(speedControl).toContain('size="sm"');
        expect(speedControl).toContain(
            "className={RECORDING_PLAYER_SPEED_CLASS_NAME}",
        );
        for (const control of [volumeControl, volumeMuteControl]) {
            expect(control).toContain("<Button");
            expect(control).toContain('variant="ghost"');
            expect(control).toContain('size="icon-sm"');
            expect(control).not.toContain("className=");
        }
        expect(source).not.toContain("data-player-control-icon");
        for (const legacyControlToken of [
            'className="size-11 shrink rounded-full shadow-sm"',
            'className="shrink rounded-full"',
            "<SotPlayerControlButton",
            "<SotPlayerPrimaryButton",
            "<SotPlayerSpeedButton",
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
        expect(sliderSource).toContain('type SliderVariant = "default";');
        expect(sliderSource).toContain("SLIDER_ROOT_VARIANT_CLASS");
        expect(sliderSource).toContain("SLIDER_TRACK_VARIANT_CLASS");
        expect(sliderSource).toContain("SLIDER_RANGE_VARIANT_CLASS");
        expect(sliderSource).toContain("SLIDER_THUMB_VARIANT_CLASS");
        expect(sliderSource).toContain("data-variant={variant}");
        for (const primitiveResidue of [
            "playerSeek",
            "playerVolume",
            "SOT_PLAYER",
            "recording-player",
            "dashboard-player",
        ]) {
            expect(sliderSource).not.toContain(primitiveResidue);
        }
        const popoverContentClass =
            popoverSource.match(
                /const POPOVER_CONTENT_CLASS\s*=\s*"([^"]*)";/,
            )?.[1] ?? "";
        expect(popoverContentClass).not.toBe("");
        expect(popoverContentClass.split(/\s+/)).toEqual(
            expect.arrayContaining([
                "w-72",
                "p-4",
                "bg-popover",
                "text-popover-foreground",
            ]),
        );
        expect(popoverSource).not.toContain(
            'type PopoverContentVariant = "default";',
        );
        expect(popoverSource).not.toContain("POPOVER_CONTENT_VARIANT_CLASS");
        expect(popoverSource).not.toContain("data-variant={variant}");
        for (const primitiveResidue of [
            "playerVolume",
            "recording-player",
            "dashboard-player",
        ]) {
            expect(popoverSource).not.toContain(primitiveResidue);
        }
        expect(sliderSource).not.toContain("track-fill");
        expect(sliderSource).not.toContain("track-thumb");
        expect(source).toContain('data-sot-control="recording-player-seek"');
        expect(source).not.toContain("recordingSeekSliderRootStyle");
        expect(source).not.toContain("sotPlayerSeekRangeStyle");
        expect(source).not.toContain("sotPlayerSeekThumbStyle");
        const seekSliderSource = extractSelfClosingElement(
            source,
            'data-sot-control="recording-player-seek"',
            "Slider",
        );
        expect(seekSliderSource).toContain("rangeProps={{");
        expect(seekSliderSource).toContain("thumbProps={{");
        expect(seekSliderSource).toContain("data-pct={playerProgressPct}");
        expect(seekSliderSource).toContain(
            'aria-disabled={playbackDisabled ? "true" : undefined}',
        );
        expect(seekSliderSource).toContain("aria-valuemax={100}");
        expect(seekSliderSource).toContain("aria-valuemin={0}");
        expect(seekSliderSource).toContain(
            "aria-valuenow={Math.round(progress)}",
        );
        expect(seekSliderSource).toContain("data-sot-state={controlState}");
        expect(seekSliderSource).toContain("onClick={(event) =>");
        expect(seekSliderSource).toContain("seekToPercent(");
        expect(seekSliderSource).toContain("onKeyDown={(event) =>");
        expect(seekSliderSource).toContain('event.key === "ArrowLeft"');
        expect(seekSliderSource).toContain('event.key === "ArrowRight"');
        expect(seekSliderSource).toContain('event.key === "Home"');
        expect(seekSliderSource).toContain('event.key === "End"');
        expect(seekSliderSource).toContain(
            "tabIndex={playbackDisabled ? -1 : 0}",
        );
        expect(seekSliderSource).toContain(
            "className={\n                        playbackDisabled",
        );
        expect(seekSliderSource).toMatch(
            /cn\(\s*"min-w-0 flex-1",\s*RECORDING_PLAYER_DISABLED_CLASS_NAME,\s*\)/,
        );
        expect(seekSliderSource).not.toContain("className:");
        expect(seekSliderSource).not.toContain("style:");
        expect(source).toContain("<Slider");
        expect(source).toContain("<PopoverContent");
        expect(source).not.toContain("<SotPlayerSeekSlider");
        expect(source).not.toContain("<SotPlayerVolumeSlider");
        expect(source).not.toContain("<SotPlayerVolumePopoverContent");
        expect(source).not.toContain(`variant="${"player"}Seek"`);
        expect(source).not.toContain(`variant="${"player"}Volume"`);
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
        expect(volumePopoverSource).not.toContain(
            `variant="${"player"}Volume"`,
        );
        expect(volumePopoverSource).toContain('className="w-56"');
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
        expect(volumeSliderSource).toContain("data-sot-state={controlState}");
        expect(volumeSliderSource).toContain("aria-label={");
        expect(volumeSliderSource).toContain("onValueChange={(nextValue) =>");
        expect(volumeSliderSource).toContain(
            'className="min-w-[110px] flex-1"',
        );
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
        expect(speedControl).toContain(
            "className={RECORDING_PLAYER_SPEED_CLASS_NAME}",
        );
        expect(source).toContain("togglePlayPause");
        expect(source).toContain("seekToSliderValue");
        expect(source).toContain("setVolume");
        expect(source).toContain('from "@/components/ui/slider"');
        expect(source.match(/<Slider\b/g)?.length ?? 0).toBeGreaterThanOrEqual(
            2,
        );
        expect(source).toContain("PopoverContent");
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
        const recordingPlayer = readFileSync(
            path.join(
                process.cwd(),
                "src/features/recordings/components/recording-player.tsx",
            ),
            "utf8",
        );
        const recordingLoading = readFileSync(
            path.join(
                process.cwd(),
                "src/app/(app)/recordings/[id]/loading.tsx",
            ),
            "utf8",
        );
        const routeChrome = readFileSync(
            path.join(process.cwd(), "src/app/(app)/route-chrome.tsx"),
            "utf8",
        );
        const dashboardWorkstation = readFileSync(
            path.join(process.cwd(), "src/features/dashboard/workstation.tsx"),
            "utf8",
        );
        const dashboardPlayerControls = readFileSync(
            path.join(
                process.cwd(),
                "src/features/dashboard/components/dashboard-recording-player-controls.tsx",
            ),
            "utf8",
        );
        const routeFallbackSurfaceClassName = extractBoundedSlice(
            routeChrome,
            "const routeFallbackSurfaceClassName =",
            ";",
        );
        const recordingRouteLoadingDetailCard = extractElementSlice(
            recordingLoading,
            'data-sot-panel="recording-route-loading-detail"',
            "Card",
        );
        const recordingRouteLoadingDetailCardOpening = extractOpeningElement(
            recordingLoading,
            'data-sot-panel="recording-route-loading-detail"',
            "Card",
        );
        const dashboardRecordingPlayerCard = extractElementSlice(
            dashboardWorkstation,
            'data-sot-surface="dashboard-recording-player"',
            "Card",
        );
        const dashboardRecordingPlayerCardOpening = extractOpeningElement(
            dashboardWorkstation,
            'data-sot-surface="dashboard-recording-player"',
            "Card",
        );
        const dashboardRecordingPlayerMeta = extractOpeningElement(
            dashboardWorkstation,
            'data-sot-part="dashboard-recording-player-meta"',
            "CardHeader",
        );
        const dashboardRecordingPlayerDate = extractOpeningElement(
            dashboardWorkstation,
            'data-sot-part="dashboard-recording-player-date"',
            "span",
        );
        const dashboardRecordingPlayerControls = extractSelfClosingElement(
            dashboardWorkstation,
            "<DashboardRecordingPlayerControls",
            "DashboardRecordingPlayerControls",
        );
        const dashboardPlayerControlsPanel = extractElementSlice(
            dashboardPlayerControls,
            'data-sot-panel="dashboard-recording-player-controls"',
            "CardContent",
        );
        const dashboardPlayerSeekSlider = extractSelfClosingElement(
            dashboardPlayerControls,
            'data-sot-control="dashboard-player-seek"',
            "Slider",
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
        expectExactStringConstInitializers(
            recordingPlayer,
            RECORDING_PLAYER_CLASS_INITIALIZERS,
        );
        for (const retiredConstName of RETIRED_DASHBOARD_RECORDING_PLAYER_SOT_CONSTANTS) {
            expect(dashboardWorkstation).not.toContain(retiredConstName);
        }
        expectExactStringConstInitializers(
            dashboardPlayerControls,
            DASHBOARD_PLAYER_CONTROLS_CLASS_INITIALIZERS,
        );
        expect(globals).not.toContain('[data-sot-surface="recording-player"]');
        expect(globals).not.toContain(
            '[data-sot-part="recording-player-no-audio"][hidden]',
        );
        expect(globals).not.toContain(
            '[data-sot-panel="recording-player-controls"]',
        );
        expect(globals).not.toContain("recording-player-control-icon");
        expect(globals).not.toContain("recording-player-current-time");
        expect(globals).not.toContain("recording-player-duration");
        expect(globals).not.toContain("recording-player-volume-anchor");
        expect(recordingPlayer).toContain(
            "className={RECORDING_PLAYER_META_CLASS_NAME}",
        );
        expect(recordingPlayer).toContain(
            "className={RECORDING_PLAYER_CONTROLS_CLASS_NAME}",
        );
        expect(recordingPlayer).toContain(
            "className={RECORDING_PLAYER_SPEED_CLASS_NAME}",
        );
        expect(recordingPlayer).toContain(
            "className={RECORDING_PLAYER_VOLUME_ANCHOR_CLASS_NAME}",
        );
        expect(recordingPlayer).toMatch(
            /playbackDisabled &&\s*RECORDING_PLAYER_DISABLED_CLASS_NAME/,
        );
        expect(globals).not.toContain("dashboard-recording-player");
        expect(globals).not.toContain("dashboard-player-control-icon");
        expect(globals).not.toContain(
            'data-sot-control="dashboard-player-play"',
        );
        expect(globals).not.toContain("dashboard-player-current-time");
        expect(globals).not.toContain("dashboard-player-duration");
        expect(globals).not.toContain(
            'data-sot-control="dashboard-player-speed"',
        );
        expect(globals).not.toContain(
            '[data-sot-surface="dashboard-recording-player"][data-no-audio="true"]',
        );
        expect(dashboardWorkstation).toContain(
            'import { DashboardRecordingPlayerControls } from "@/features/dashboard/components/dashboard-recording-player-controls";',
        );
        expect(dashboardRecordingPlayerCard).toContain(
            'data-sot-surface="dashboard-recording-player"',
        );
        expect(dashboardRecordingPlayerCard).toContain(
            'part="dashboard-recording-player-no-audio"',
        );
        expect(dashboardRecordingPlayerCard).toContain(
            'iconPart="dashboard-recording-player-no-audio-icon"',
        );
        expect(dashboardRecordingPlayerCard).toContain(
            'textPart="dashboard-recording-player-no-audio-text"',
        );
        expect(dashboardRecordingPlayerCard).toContain(
            'titlePart="dashboard-recording-player-no-audio-title"',
        );
        expect(dashboardRecordingPlayerCard).toContain(
            'descriptionPart="dashboard-recording-player-no-audio-description"',
        );
        expect(dashboardRecordingPlayerCardOpening).toContain("hasNoPadding");
        expect(dashboardRecordingPlayerCardOpening).toContain(
            'className="block min-h-[114px] gap-0 overflow-visible rounded-2xl px-[18px] py-4 shadow-none"',
        );
        expect(dashboardRecordingPlayerCardOpening).toContain(
            'data-no-audio={\n                                playbackDisabled ? "true" : undefined\n                            }',
        );
        expect(dashboardRecordingPlayerCardOpening).toContain(
            'data-playing={isPlaying ? "true" : undefined}',
        );
        expect(dashboardRecordingPlayerCardOpening).toContain(
            'data-sot-state={\n                                playbackDisabled ? "disabled" : "ready"\n                            }',
        );
        expect(dashboardRecordingPlayerMeta).toContain(
            'className="mb-3 flex flex-row flex-wrap items-center gap-2.5 p-0"',
        );
        expect(dashboardRecordingPlayerDate).toContain(
            'className="translate-y-px font-mono text-[11.5px] font-medium tracking-[0.02em] text-muted-foreground"',
        );
        expect(dashboardRecordingPlayerControls).toContain(
            "currentTime={currentTime}",
        );
        expect(dashboardRecordingPlayerControls).toContain(
            "duration={playerDurationValue}",
        );
        expect(dashboardRecordingPlayerControls).toContain(
            "onCyclePlaybackSpeed={cyclePlaybackSpeed}",
        );
        expect(dashboardRecordingPlayerControls).toContain(
            "onSeekBySeconds={seekDashboardPlayerBySeconds}",
        );
        expect(dashboardRecordingPlayerControls).toContain(
            "onSeekToPercent={seekDashboardPlayerToPercent}",
        );
        expect(dashboardRecordingPlayerControls).toContain(
            "onTogglePlayPause={togglePlayPause}",
        );
        expect(dashboardRecordingPlayerControls).toContain(
            "onVolumeChange={setVolume}",
        );
        expect(dashboardRecordingPlayerControls).toContain(
            "onVolumeOpenChange={setVolumeOpen}",
        );
        expect(dashboardRecordingPlayerControls).toContain(
            "playbackDisabled={playbackDisabled}",
        );
        expect(dashboardPlayerControls).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(dashboardPlayerControls).toContain(
            'import { Slider } from "@/components/ui/slider";',
        );
        expect(dashboardPlayerControls).toContain("PopoverContent");
        expect(dashboardPlayerControlsPanel).toContain(
            'data-sot-panel="dashboard-recording-player-controls"',
        );
        expect(dashboardPlayerControlsPanel).toContain(
            "data-sot-state={playerControlsState}",
        );
        for (const dashboardControlToken of [
            'data-sot-control="dashboard-player-back"',
            'data-sot-control="dashboard-player-play"',
            'data-sot-control="dashboard-player-forward"',
            'data-sot-control="dashboard-player-speed"',
            'data-sot-control="dashboard-player-volume"',
            'data-sot-control="dashboard-player-volume-mute"',
            'data-sot-control="dashboard-player-volume-slider"',
        ]) {
            expect(dashboardPlayerControlsPanel).toContain(
                dashboardControlToken,
            );
        }
        for (const dashboardPartToken of [
            'data-sot-part="dashboard-player-control-icon"',
            'data-sot-part="dashboard-player-current-time"',
            'data-sot-part="dashboard-player-duration"',
            'data-sot-part="dashboard-player-volume-anchor"',
            'data-sot-panel="dashboard-player-volume-popover"',
            'data-sot-part="dashboard-player-volume-row"',
            'data-sot-part="dashboard-player-volume-icon"',
            'data-sot-part="dashboard-player-volume-value"',
        ]) {
            expect(dashboardPlayerControlsPanel).toContain(dashboardPartToken);
        }
        expect(dashboardPlayerControlsPanel).toContain(
            "DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME",
        );
        expect(dashboardPlayerControlsPanel).toContain(
            "DASHBOARD_PLAYER_DISABLED_CLASS_NAME",
        );
        expect(dashboardPlayerControlsPanel).toContain(
            "DASHBOARD_PLAYER_TIME_CLASS_NAME",
        );
        expect(dashboardPlayerControlsPanel).toContain(
            "DASHBOARD_PLAYER_DURATION_CLASS_NAME",
        );
        expect(dashboardPlayerControlsPanel).toContain(
            "DASHBOARD_PLAYER_SPEED_CLASS_NAME",
        );
        expect(dashboardPlayerSeekSlider).toContain(
            'data-sot-control="dashboard-player-seek"',
        );
        expect(dashboardPlayerSeekSlider).toContain(
            "data-sot-state={controlState}",
        );
        expect(dashboardPlayerSeekSlider).toContain("rangeProps={{");
        expect(dashboardPlayerSeekSlider).toContain("thumbProps={{");
        expect(dashboardPlayerSeekSlider).toContain("data-pct={progressPct}");
        expect(dashboardPlayerSeekSlider).toContain(
            'aria-disabled={disabled ? "true" : undefined}',
        );
        expect(dashboardPlayerControlsPanel).not.toContain(
            "<SotPlayerControlButton",
        );
        expect(dashboardPlayerControlsPanel).not.toContain(
            "<SotPlayerVolumeSlider",
        );
        expect(globals).not.toContain(
            '[data-sot-panel="recording-detail-loading"]',
        );
        expect(recordingLoading).toContain(
            'data-sot-panel="recording-detail-loading"',
        );
        expect(recordingLoading).toContain("<Card");
        for (const token of ROUTE_LOADING_SURFACE_CLASS_TOKENS) {
            expect(routeFallbackSurfaceClassName).toContain(token);
        }
        expect(recordingRouteLoadingDetailCard).toContain('variant="default"');
        expect(recordingRouteLoadingDetailCard).toContain("hasNoPadding");
        expect(recordingRouteLoadingDetailCard).not.toContain(
            'variant="routeLoadingSurface"',
        );
        expect(recordingRouteLoadingDetailCardOpening).toContain(
            "className={cn(",
        );
        expect(recordingRouteLoadingDetailCardOpening).toContain(
            "routeFallbackSurfaceClassName,",
        );
        expect(recordingRouteLoadingDetailCardOpening).toContain(
            '"flex min-h-0 flex-col gap-4"',
        );
        expect(recordingLoading).toContain('aria-hidden="true"');
        expect(recordingLoading).not.toContain('variant="routeLoadingSurface"');
        expect(recordingLoading).toContain(
            "const recordingDetailLoadingSkeletonClassNames",
        );
        expect(recordingLoading).toContain("recordingDetailLoadingAvatar:");
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
