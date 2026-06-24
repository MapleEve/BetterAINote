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

const ROUTE_LOADING_SURFACE_CLASS_VALUE =
    "min-h-0 gap-0 overflow-hidden rounded-[16px] border-[var(--line-hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] backdrop-blur-none dark:border-[var(--glass-border)]";
const ROUTE_LOADING_SURFACE_CLASS_TOKENS =
    ROUTE_LOADING_SURFACE_CLASS_VALUE.split(" ");
const SOT_PLAYER_NO_AUDIO_CLASS_INITIALIZERS = [
    {
        constName: "SOT_PLAYER_NO_AUDIO_ALERT_CLASS",
        expected:
            "mb-3 flex w-full items-center gap-2.5 rounded-[10px] border border-[var(--system-banner-offline-border)] bg-[var(--system-banner-offline-bg)] px-3 py-2.5 text-[12.5px] leading-normal text-[var(--fg-primary)] [&[hidden]]:hidden",
    },
    {
        constName: "SOT_PLAYER_NO_AUDIO_ICON_CLASS",
        expected:
            "inline-grid size-[26px] flex-none place-items-center rounded-[50%] bg-[color-mix(in_srgb,var(--signal-warning)_18%,transparent)] text-[var(--signal-warning)] [&_svg]:size-[14px]",
    },
    {
        constName: "SOT_PLAYER_NO_AUDIO_TEXT_CLASS",
        expected: "flex min-w-0 flex-col gap-px",
    },
    {
        constName: "SOT_PLAYER_NO_AUDIO_TITLE_CLASS",
        expected:
            "min-h-0 overflow-visible font-sans text-[12.5px] font-semibold leading-normal tracking-normal text-[var(--fg-primary)] [display:block] [-webkit-box-orient:unset] [-webkit-line-clamp:unset]",
    },
    {
        constName: "SOT_PLAYER_NO_AUDIO_DESCRIPTION_CLASS",
        expected:
            "block font-sans text-[11.5px] font-medium leading-[1.5] text-[var(--fg-tertiary)] [&_p]:leading-[1.5]",
    },
] as const;
const SOT_PLAYER_SOURCE_CLASS_INITIALIZERS = [
    {
        constName: "SOT_PLAYER_SOURCE_BADGE_CLASS",
        expected:
            "h-[22px] flex-none justify-normal gap-[6px] rounded-[6px] border-[var(--line-hairline)] bg-[var(--bg-elevated)] py-0 pl-[3px] pr-[8px] [font:600_11.5px_var(--font-sans)] text-[var(--fg-secondary)] shadow-[var(--shadow-xs)] dark:border-[var(--glass-border)] dark:bg-[rgb(255_255_255_/_0.04)] dark:text-[var(--fg-primary)]",
    },
    {
        constName: "SOT_PLAYER_SOURCE_ICON_CLASS",
        expected:
            "inline-flex size-[16px] flex-none shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-[var(--line-hairline)] bg-white data-[sot-source-icon=letter]:bg-[var(--bg-recessed)] data-[sot-source-icon=letter]:[font:700_9px_var(--font-sans)] data-[sot-source-icon=letter]:text-[var(--fg-secondary)] [&[data-sot-cover=true]_img]:object-cover",
    },
    {
        constName: "SOT_PLAYER_SOURCE_ICON_IMAGE_CLASS",
        expected: "block size-[16px] max-w-none object-contain",
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
        "span",
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

    expect(noAudioAlert).toMatch(
        /className=\{\s*cn\(\s*SOT_PLAYER_NO_AUDIO_ALERT_CLASS,\s*className\s*\)\s*\}/,
    );
    expect(noAudioAlert).toContain("data-sot-part={part}");
    expect(noAudioAlert).toContain(
        'data-sot-state={playbackDisabled ? "visible" : "hidden"}',
    );
    expect(noAudioAlert).toContain("hidden={!playbackDisabled}");
    expect(noAudioAlert).toContain('role="status"');
    expectClassNameConstReference(
        noAudioIcon,
        "SOT_PLAYER_NO_AUDIO_ICON_CLASS",
    );
    expect(noAudioIcon).toContain("data-sot-part={iconPart}");
    expectClassNameConstReference(
        noAudioText,
        "SOT_PLAYER_NO_AUDIO_TEXT_CLASS",
    );
    expect(noAudioText).toContain("data-player-no-audio-text");
    expect(noAudioText).toContain("data-sot-part={textPart}");
    expectClassNameConstReference(
        noAudioTitle,
        "SOT_PLAYER_NO_AUDIO_TITLE_CLASS",
    );
    expectClassNameConstReference(
        noAudioDescription,
        "SOT_PLAYER_NO_AUDIO_DESCRIPTION_CLASS",
    );
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
        "img",
    );

    expectClassNameConstReference(sourceBadge, "SOT_PLAYER_SOURCE_BADGE_CLASS");
    expect(sourceBadge).toContain('variant="ghost"');
    expect(sourceBadge).toContain('data-sot-control="player-source-tag"');
    expectClassNameConstReference(sourceIcon, "SOT_PLAYER_SOURCE_ICON_CLASS");
    expect(sourceIcon).toContain('data-sot-part="source-icon"');
    expect(sourceIcon).toContain(
        'data-sot-source-icon={hasImage ? "image" : "letter"}',
    );
    expectClassNameConstReference(
        sourceIconImage,
        "SOT_PLAYER_SOURCE_ICON_IMAGE_CLASS",
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
        expectExactStringConstInitializers(
            sotPlayerPrimitives,
            SOT_PLAYER_NO_AUDIO_CLASS_INITIALIZERS,
        );
        expectSotPlayerNoAudioPrimitiveBindings(sotPlayerPrimitives);
        expect(sotPlayerPrimitives).toContain("<SotPlayerNoAudioIcon");
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

    it("keeps player status styling in the feature wrapper instead of Badge variants", () => {
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
        for (const playerStatusToken of [
            "h-[20px]",
            "min-w-[65.171875px]",
            "justify-normal",
            "gap-[5px]",
            "tracking-[0.005em]",
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
            expect(sotPlayerPrimitives).toContain(playerStatusToken);
        }
        expect(badgePrimitive).not.toContain("playerTagChip:");
        expect(badgePrimitive).not.toContain("playerTagOverflow:");
        expect(buttonPrimitive).not.toContain("playerTagAdd:");
        expect(buttonPrimitive).not.toContain("playerTagChip:");
        expect(buttonPrimitive).not.toContain("playerTagOverflow:");
        expect(sotPlayerPrimitives).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expectExactStringConstInitializers(
            sotPlayerPrimitives,
            SOT_PLAYER_SOURCE_CLASS_INITIALIZERS,
        );
        expectSotPlayerSourcePrimitiveBindings(sotPlayerPrimitives);
        expect(sourceBadge).toContain('variant="ghost"');
        expect(sourceBadge).toContain(
            "className={SOT_PLAYER_SOURCE_BADGE_CLASS}",
        );
        expect(sourceBadge).toContain('data-sot-control="player-source-tag"');
        expect(sotPlayerPrimitives).not.toContain(
            legacyPlayerSourceVariantUsage,
        );
        expect(sotPlayerPrimitives).toContain("SOT_PLAYER_STATUS_BADGE_CLASS");
        expect(statusBadge).toContain('variant="ghost"');
        expect(statusBadge).toContain(
            "className={cn(SOT_PLAYER_STATUS_BADGE_CLASS, className)}",
        );
        expect(statusBadge).toContain('data-sot-control="player-status"');
        expect(statusBadge).toContain("data-sot-tone={tone}");
        expect(sotPlayerPrimitives).toContain("className?: string;");
        expect(sotPlayerPrimitives).toContain(
            '<span data-sot-part="status-dot" />',
        );
        expect(sotPlayerPrimitives).toContain(
            '<span data-sot-part="status-label">{label}</span>',
        );
        expect(
            collectCssRuleBlocks(globals, '[data-sot-control="player-status"]'),
        ).toEqual([]);
        for (const tagClassConstant of [
            "SOT_PLAYER_TAG_BADGE_CLASS",
            "SOT_PLAYER_TAG_OVERFLOW_BADGE_CLASS",
            "SOT_PLAYER_TAG_ADD_BUTTON_CLASS",
            "SOT_PLAYER_TAG_CHIP_BUTTON_CLASS",
            "SOT_PLAYER_TAG_OVERFLOW_BUTTON_CLASS",
        ]) {
            expect(sotPlayerPrimitives).toContain(tagClassConstant);
        }
        for (const tagClassToken of [
            "data-[sot-tag-color=blue]:[--tag-c:var(--tag-blue)]",
            "data-[sot-state=open]:border-[var(--line-strong)]",
            "border-dashed border-[var(--line-hairline)]",
            "hover:border-[var(--line-strong)]",
        ]) {
            expect(sotPlayerPrimitives).toContain(tagClassToken);
        }
        for (const sotPlayerTagChipToken of [
            "--sot-player-tag-chip-bg",
            "--sot-player-tag-chip-border",
            "--sot-player-tag-chip-fg",
            "--sot-player-tag-chip-blue-bg",
            "--sot-player-tag-chip-blue-border",
            "--sot-player-tag-chip-blue-fg",
        ]) {
            expect(globals).toContain(sotPlayerTagChipToken);
            expect(sotPlayerPrimitives).toContain(sotPlayerTagChipToken);
        }
        expect(globals).not.toContain("dashboard-recording-tag-chip");
        expect(badgePrimitive).not.toContain("dashboard-recording-tag-chip");
        expect(sotPlayerPrimitives).not.toContain(
            "dashboard-recording-tag-chip",
        );
        expect(tagChipPrimitive).toContain('variant="ghost"');
        expect(tagChipPrimitive).toContain('size="xs"');
        expect(tagChipPrimitive).toContain(
            "className={SOT_PLAYER_TAG_ADD_BUTTON_CLASS}",
        );
        expect(tagChipPrimitive).toContain(
            "className={SOT_PLAYER_TAG_BADGE_CLASS}",
        );
        expect(tagChipPrimitive).toContain(
            "className={SOT_PLAYER_TAG_CHIP_BUTTON_CLASS}",
        );
        expect(tagChipPrimitive).toContain(
            "className={SOT_PLAYER_TAG_OVERFLOW_BUTTON_CLASS}",
        );
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
        expect(sotPlayerPrimitives).toContain(
            'type SotPlayerButtonProps = Omit<ButtonProps, "variant" | "size">',
        );
        for (const wrapperExport of [
            "export function SotPlayerControlButton",
            "export function SotPlayerPrimaryButton",
            "export function SotPlayerSpeedButton",
        ]) {
            expect(sotPlayerPrimitives).toContain(wrapperExport);
        }
        for (const playerButtonClassToken of [
            "SOT_PLAYER_CONTROL_BUTTON_CLASS",
            "SOT_PLAYER_CONTROL_BUTTON_SIZE_CLASS",
            "SOT_PLAYER_CONTROL_BUTTON_SM_SIZE_CLASS",
            "SOT_PLAYER_PRIMARY_BUTTON_CLASS",
            "SOT_PLAYER_PRIMARY_BUTTON_SIZE_CLASS",
            "SOT_PLAYER_SPEED_BUTTON_CLASS",
            "SOT_PLAYER_SPEED_BUTTON_SIZE_CLASS",
            "size-[36px]",
            "size-[30px]",
            "size-[44px]",
            "min-w-[50px]",
            "tabular-nums",
            "data-player-control-icon",
        ]) {
            expect(sotPlayerPrimitives).toContain(playerButtonClassToken);
        }
        expect(buttonSource).not.toContain("dashboard-player-volume-icon");
        expect(buttonSource).not.toContain("recording-player-volume-icon");
        expect(source).not.toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(source).toContain("<SotPlayerControlButton");
        expect(source).toContain("<SotPlayerPrimaryButton");
        expect(source).toContain("<SotPlayerSpeedButton");
        expect(source).toContain(
            'import { Popover, PopoverTrigger } from "@/components/ui/popover";',
        );
        expect(source).toContain("<Popover");
        expect(source).toContain("<PopoverTrigger asChild>");
        expect(source).toContain("<SotPlayerVolumePopoverContent");
        const backControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-back"',
            "SotPlayerControlButton",
        );
        const playControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-play"',
            "SotPlayerPrimaryButton",
        );
        const forwardControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-forward"',
            "SotPlayerControlButton",
        );
        const speedControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-speed"',
            "SotPlayerSpeedButton",
        );
        const volumeControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-volume"',
            "SotPlayerControlButton",
        );
        const volumeMuteControl = extractOpeningElement(
            source,
            'data-sot-control="recording-player-volume-mute"',
            "SotPlayerControlButton",
        );

        for (const control of [backControl, forwardControl]) {
            expect(control).toContain("<SotPlayerControlButton");
            expect(control).not.toContain("controlSize=");
            expect(control).not.toContain("variant=");
            expect(control).not.toContain("size=");
            expect(control).not.toContain("className=");
        }
        expect(playControl).toContain("<SotPlayerPrimaryButton");
        expect(playControl).not.toContain("variant=");
        expect(playControl).not.toContain("size=");
        expect(playControl).not.toContain("className=");
        expect(speedControl).toContain("<SotPlayerSpeedButton");
        expect(speedControl).not.toContain("variant=");
        expect(speedControl).not.toContain("size=");
        expect(speedControl).not.toContain("className=");
        for (const control of [volumeControl, volumeMuteControl]) {
            expect(control).toContain("<SotPlayerControlButton");
            expect(control).toContain('controlSize="sm"');
            expect(control).not.toContain("variant=");
            expect(control).not.toContain("size=");
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
        expect(popoverSource).toContain(
            'type PopoverContentVariant = "default";',
        );
        expect(popoverSource).toContain("POPOVER_CONTENT_VARIANT_CLASS");
        expect(popoverSource).toContain("data-variant={variant}");
        for (const primitiveResidue of [
            "playerVolume",
            "recording-player",
            "dashboard-player",
        ]) {
            expect(popoverSource).not.toContain(primitiveResidue);
        }
        for (const wrapperExport of [
            "export function SotPlayerSeekSlider",
            "export function SotPlayerVolumeSlider",
            "export function SotPlayerVolumePopoverContent",
        ]) {
            expect(sotPlayerPrimitives).toContain(wrapperExport);
        }
        for (const wrapperClassToken of [
            "SOT_PLAYER_SEEK_SLIDER_CLASS",
            "h-[14px] min-w-0 flex-1 cursor-pointer",
            "[&_[data-slot=slider-track]]:bg-[var(--graphite-200)]",
            "[&_[data-slot=slider-track]]:rounded-[999px]",
            "[&_[data-slot=slider-track]]:[box-shadow:inset_0_1px_1px_rgb(0_0_0_/_0.04)]",
            "bg-[image:linear-gradient(90deg,var(--steel-500),var(--accent))]",
            "shadow-[0_1px_4px_rgb(0_0_0_/_0.15),0_0_0_1px_var(--line-hairline)]",
            "SOT_PLAYER_VOLUME_SLIDER_CLASS",
            "h-[18px] min-w-[110px] flex-1",
            "SOT_PLAYER_VOLUME_POPOVER_CONTENT_CLASS",
            "w-[200px] min-w-[200px] gap-0 overflow-visible px-2.5 py-2",
        ]) {
            expect(sotPlayerPrimitives).toContain(wrapperClassToken);
        }
        expect(sotPlayerPrimitives).toContain(
            "className={cn(SOT_PLAYER_SEEK_SLIDER_CLASS, className)}",
        );
        expect(sotPlayerPrimitives).toContain(
            "className: cn(SOT_PLAYER_SEEK_RANGE_CLASS, rangeClassName)",
        );
        expect(sotPlayerPrimitives).toContain(
            "className: cn(SOT_PLAYER_SEEK_THUMB_CLASS, thumbClassName)",
        );
        expect(sotPlayerPrimitives).toContain(
            "className={cn(SOT_PLAYER_VOLUME_SLIDER_CLASS, className)}",
        );
        expect(sotPlayerPrimitives).toContain(
            "className={cn(SOT_PLAYER_VOLUME_POPOVER_CONTENT_CLASS, className)}",
        );
        expect(sliderSource).not.toContain("track-fill");
        expect(sliderSource).not.toContain("track-thumb");
        expect(source).toContain('"data-sot-control": "recording-player-seek"');
        expect(source).not.toContain("recordingSeekSliderRootStyle");
        expect(source).not.toContain("sotPlayerSeekRangeStyle");
        expect(source).not.toContain("sotPlayerSeekThumbStyle");
        const seekSliderSource = extractSelfClosingElement(
            source,
            '"data-sot-control": "recording-player-seek"',
            "SotPlayerSeekSlider",
        );
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
        expect(source).toContain("<SotPlayerSeekSlider");
        expect(source).toContain("<SotPlayerVolumeSlider");
        expect(source).toContain("<SotPlayerVolumePopoverContent");
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
            "SotPlayerVolumePopoverContent",
        );
        expect(volumePopoverSource).not.toContain(
            `variant="${"player"}Volume"`,
        );
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
            "SotPlayerVolumeSlider",
        );
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
        expect(source).not.toContain(
            'import { Button } from "@/components/ui/button";',
        );
        const speedControlIndex = source.indexOf(
            'data-sot-control="recording-player-speed"',
        );
        expect(speedControlIndex).toBeGreaterThanOrEqual(0);
        expect(speedControl).toContain("<SotPlayerSpeedButton");
        expect(speedControl).toContain(
            'data-sot-control="recording-player-speed"',
        );
        expect(source).toContain("togglePlayPause");
        expect(source).toContain("seekToSliderValue");
        expect(source).toContain("setVolume");
        expect(source).not.toContain('from "@/components/ui/slider"');
        expect(
            source.match(/<SotPlayer(?:Seek|Volume)Slider\b/g)?.length ?? 0,
        ).toBeGreaterThanOrEqual(2);
        expect(source).toContain(
            'import { Popover, PopoverTrigger } from "@/components/ui/popover";',
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
        const routeLoadingSurfaceClassName = extractBoundedSlice(
            recordingLoading,
            "const routeLoadingSurfaceClassName =",
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
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                /(^|\n|,)\s*\.(?:player|player-meta|player-controls|player-meta-warn|no-audio-[a-z-]+|skel-detail|time)(?![\w-])/.test(
                    text,
                ),
            );

        expect(legacySelectorLines).toEqual([]);
        expect(globals).toContain(
            '[data-sot-part="recording-player-no-audio"][hidden]',
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
        expect(globals).not.toContain(
            '[data-sot-panel="recording-detail-loading"]',
        );
        expect(recordingLoading).toContain(
            'data-sot-panel="recording-detail-loading"',
        );
        expect(recordingLoading).toContain("<Card");
        expect(routeLoadingSurfaceClassName).toContain(
            `"${ROUTE_LOADING_SURFACE_CLASS_VALUE}"`,
        );
        for (const token of ROUTE_LOADING_SURFACE_CLASS_TOKENS) {
            expect(routeLoadingSurfaceClassName).toContain(token);
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
            "routeLoadingSurfaceClassName,",
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
