import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DASHBOARD_OWNER_LOCAL_FORBIDDEN_VARIANT_PROPS = [
    'variant="detailHeader"',
    'variant="detailHeaderTitle"',
    'variant="detailHeaderLocal"',
    'variant="detailHeaderStatus"',
    'variant="recordingTagChip"',
    'variant="sourceReportStatus"',
    'variant="dashboardTranscriptLanguage"',
] as const;
const BADGE_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS = [
    "detailHeaderLocal",
    "detailHeaderStatus",
    "pill",
    "checkDot",
    "recordingTagChip",
    "sourceProviderStatus",
    "sourceProviderDetailStatus",
    "settingsSaveStatus",
    "sourceReportStatus",
    "speakerReviewVoiceprint",
    "transcriptionMeta",
    "dashboardTranscriptLanguage",
    "data-[sot-",
    "source-provider-status",
    "source-report-status",
    "dashboard-recording-tag-chip",
] as const;
const CARD_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS = [
    "onboarding",
    "detailHeader",
    "recordingTagManager",
    "speakerReview",
    "popover",
    "popoverNote",
    "elevated",
] as const;
const EXPECTED_DASHBOARD_DETAIL_HEADER_CLASS_NAME =
    "relative flex flex-row items-center gap-2.5 px-1 pt-1 pb-0 data-[sot-state=saving]:py-0";
const EXPECTED_DASHBOARD_DETAIL_HEADER_TITLE_CLASS_NAME =
    "m-0 min-w-0 flex-1 truncate font-display text-[22px] font-semibold leading-normal tracking-[-0.014em] text-foreground";
const EXPECTED_DASHBOARD_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME =
    "h-8 min-w-0 flex-1 px-3 py-1 text-base md:text-sm";
const EXPECTED_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME = "ml-1 shrink-0";
const EXPECTED_DASHBOARD_TRANSCRIPT_LANGUAGE_BADGE_CLASS_NAME = "gap-1.5";
const EXPECTED_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME =
    "ml-auto inline-flex max-w-full flex-[0_1_auto] flex-wrap items-center gap-2";
const EXPECTED_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME =
    "flex min-h-0 flex-1 flex-col gap-0 rounded-[16px] border border-border bg-card shadow-sm backdrop-blur-none";
const EXPECTED_DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME =
    "border-b border-border px-3 pt-3 pb-2.5";
const EXPECTED_DASHBOARD_SIDEBAR_FOOTER_CLASS_NAME =
    "border-t border-border pt-2.5";
const EXPECTED_DASHBOARD_MAIN_CLASS_NAME =
    "flex h-screen min-w-0 flex-col max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const EXPECTED_DASHBOARD_WORKSPACE_CLASS_NAME =
    "grid flex-1 min-h-0 grid-cols-[380px_1fr] gap-4 px-5 pt-4 pb-5 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border max-[860px]:grid-cols-[380px_0px] max-[860px]:[&>[data-sot-panel=dashboard-detail]]:hidden";
const EXPECTED_DASHBOARD_RECORDING_LIST_CARD_CLASS_NAME =
    "min-h-0 gap-0 rounded-2xl max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const EXPECTED_DETAIL_PANEL_CLASS_NAME = "flex min-h-0 min-w-0 flex-col gap-4";
const DASHBOARD_TOPBAR_REQUIRED_CLASS_TOKENS = [
    "relative",
    "z-[var(--z-topbar)]",
    "flex",
    "h-14",
    "flex-none",
    "flex-row",
    "items-center",
    "gap-3.5",
    "border-b",
    "border-border",
    "bg-background/80",
    "px-5",
    "py-3",
    "shadow-none",
    "backdrop-blur-[20px]",
    "backdrop-saturate-[140%]",
    "supports-[backdrop-filter]:bg-background/60",
    "max-[860px]:min-w-0",
    "max-[860px]:max-w-full",
    "max-[860px]:box-border",
] as const;
const DASHBOARD_TOPBAR_OWNER_CLASS_INITIALIZERS = [
    {
        property: "topbar",
        expected:
            "relative z-[var(--z-topbar)] flex h-14 flex-none flex-row items-center gap-3.5 border-b border-border bg-background/80 px-5 py-3 shadow-none backdrop-blur-[20px] backdrop-saturate-[140%] supports-[backdrop-filter]:bg-background/60 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border",
    },
    {
        property: "crumbs",
        expected:
            "flex items-center gap-2 font-sans text-[13px] font-medium text-[var(--fg-tertiary)]",
    },
    {
        property: "crumb",
        expected: "text-[var(--fg-tertiary)]",
    },
    {
        property: "separator",
        expected: "text-[var(--fg-tertiary)] opacity-60 max-[860px]:hidden",
    },
    {
        property: "current",
        expected: "font-semibold text-[var(--fg-primary)] max-[860px]:hidden",
    },
] as const;
const DASHBOARD_SIDEBAR_OWNER_CLASS_TOKENS = [
    "relative",
    "flex",
    "flex-col",
    "rounded-none",
    "border",
    "border-[var(--glass-border)]",
    "border-r-[var(--line-hairline)]",
    "bg-[var(--glass-tint-strong)]",
    "px-3",
    "pt-4",
    "pb-3",
    "shadow-[var(--glass-shadow-cast),var(--shadow-inset)]",
    "backdrop-blur-[var(--glass-blur)]",
    "backdrop-saturate-[var(--glass-saturate)]",
] as const;
const DASHBOARD_SIDEBAR_VISUAL_GLOBAL_SELECTORS = [
    '[data-sot-panel="dashboard-sidebar"]',
    '[data-theme="dark"] [data-sot-panel="dashboard-sidebar"]',
    '.dark [data-sot-panel="dashboard-sidebar"]',
] as const;
const DASHBOARD_SIDEBAR_OWNER_FORBIDDEN_CLASS_PATTERN =
    /\bspace-[xy]-|\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;
const DASHBOARD_SIDEBAR_VISUAL_GLOBAL_DECLARATION_RE =
    /^\s*(?:-webkit-backdrop-filter|backdrop-filter|background|border(?:-(?:color|radius|right|style|width))?|box-shadow|display|flex-direction|padding|position)\s*:/m;
const EXPECTED_SOURCE_REPORT_STATUS_BADGE_CLASS_NAME =
    "inline-flex h-[22px] min-w-[65px] justify-normal items-center gap-[9px] overflow-visible rounded-full border px-[8px] py-0 ![font:600_11px_var(--font-sans)] leading-[normal] shadow-none data-[sot-tone=err]:border-destructive/30 data-[sot-tone=err]:bg-destructive/10 data-[sot-tone=err]:text-destructive data-[sot-tone=neu]:border-border data-[sot-tone=neu]:bg-muted data-[sot-tone=neu]:text-muted-foreground data-[sot-tone=ok]:border-primary/30 data-[sot-tone=ok]:bg-primary/10 data-[sot-tone=ok]:text-primary data-[sot-tone=warn]:border-border data-[sot-tone=warn]:bg-secondary data-[sot-tone=warn]:text-secondary-foreground [&_[data-sot-part=dashboard-source-report-status-dot]]:mr-0 [&_[data-sot-part=dashboard-source-report-status-dot]]:inline-block [&_[data-sot-part=dashboard-source-report-status-dot]]:size-[5px] [&_[data-sot-part=dashboard-source-report-status-dot]]:rounded-full [&_[data-sot-part=dashboard-source-report-status-dot]]:bg-current [&_[data-sot-part=source-report-status-dot]]:mr-0 [&_[data-sot-part=source-report-status-dot]]:inline-block [&_[data-sot-part=source-report-status-dot]]:size-[5px] [&_[data-sot-part=source-report-status-dot]]:rounded-full [&_[data-sot-part=source-report-status-dot]]:bg-current";
const EXPECTED_DASHBOARD_RECORDING_PLAYER_CARD_CLASS_NAME =
    "block min-h-[114px] gap-0 overflow-visible rounded-[16px] border border-border bg-card px-[18px] py-[16px] shadow-none backdrop-blur-none";
const DASHBOARD_RECORDING_PLAYER_WORKSTATION_CLASS_INITIALIZERS = [
    {
        constName: "SOT_DASHBOARD_RECORDING_PLAYER_CARD_CLASS_NAME",
        expected: EXPECTED_DASHBOARD_RECORDING_PLAYER_CARD_CLASS_NAME,
    },
    {
        constName: "SOT_DASHBOARD_RECORDING_PLAYER_META_CLASS_NAME",
        expected:
            "mb-[12px] flex flex-row flex-wrap items-center gap-[10px] p-0",
    },
    {
        constName: "SOT_DASHBOARD_RECORDING_PLAYER_DATE_CLASS_NAME",
        expected:
            "font-mono text-[11.5px] font-medium tracking-[0.02em] text-muted-foreground",
    },
] as const;
const DASHBOARD_RECORDING_PLAYER_CONTROLS_CLASS_INITIALIZERS = [
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
const REMOVED_DASHBOARD_PLAYER_GLOBAL_SELECTOR_FRAGMENTS = [
    "dashboard-recording-player",
    "dashboard-player-control-icon",
    'data-sot-control="dashboard-player-play"',
    "dashboard-player-current-time",
    "dashboard-player-duration",
    'data-sot-control="dashboard-player-speed"',
    '[data-sot-surface="dashboard-recording-player"][data-no-audio="true"]',
    '[data-sot-part="dashboard-recording-player-meta"]',
] as const;
const REMOVED_DASHBOARD_NAV_FAVORITE_GLOBAL_SELECTORS = [
    '[data-sot-list="dashboard-nav"]',
    '[data-sot-part="dashboard-nav-section-label"]',
    '[data-sot-control="dashboard-favorite"] svg',
    '[data-sot-part="dashboard-favorite-count"]',
    '[data-theme="dark"] [data-sot-part="dashboard-favorite-count"]',
    '[data-sot-control="dashboard-favorite"][data-sot-state="selected"] svg',
    '[data-sot-control="dashboard-favorite"][data-sot-state="selected"]\n    [data-sot-part="dashboard-favorite-count"]',
    '[data-theme="dark"]\n    [data-sot-control="dashboard-favorite"][data-sot-state="selected"]\n    [data-sot-part="dashboard-favorite-count"]',
] as const;
const REMOVED_DASHBOARD_SYNC_GLOBAL_SELECTORS = [
    '[data-sot-panel="dashboard-sync"]',
    '[data-sot-panel="dashboard-sync"] [data-sot-part="dashboard-sync-indicator"]',
    '[data-sot-part="dashboard-sync-text"]',
    '[data-sot-part="dashboard-sync-title"]',
    '[data-sot-part="dashboard-sync-subtitle"]',
    '[data-sot-panel="dashboard-sync"][data-sot-state="queued"]',
    '[data-sot-panel="dashboard-sync"][data-sot-state="running"]',
    '[data-sot-panel="dashboard-sync"][data-sot-state="error"]',
] as const;
const DASHBOARD_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-panel="dashboard-topbar"]',
    '[data-theme="dark"] [data-sot-panel="dashboard-topbar"]',
    '[data-sot-part="dashboard-crumbs"]',
    '[data-sot-part="dashboard-crumb"]',
    '[data-sot-part="dashboard-crumb-separator"]',
    '[data-sot-part="dashboard-crumb-current"]',
] as const;
const DASHBOARD_SYNC_VISUAL_GLOBAL_DECLARATION_RE =
    /\b(?:display|align-items|gap|padding|border-radius|background|border|width|height|box-shadow|animation|font|color|margin-top|flex|min-width)\s*:/;
const OWNER_MAIN_FORBIDDEN_RAW_COLOR_RE =
    /\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;
const OWNER_WORKSPACE_FORBIDDEN_CLASS_RE =
    /\bspace-[xy]-|\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function staticJsxClassName(className: string) {
    return `className="${className}"`;
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

function extractDashboardSearchActivityClassNames(source: string) {
    const marker = "const dashboardSearchActivityClassNames = {";
    const start = source.indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf("} as const;", start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + "} as const;".length);
}

function extractObjectStringProperty(source: string, propertyName: string) {
    const marker = `${propertyName}:`;
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const valueStart = source.indexOf('"', markerIndex);
    expect(valueStart).toBeGreaterThan(markerIndex);

    for (let index = valueStart + 1; index < source.length; index += 1) {
        if (source[index] === '"' && source[index - 1] !== "\\") {
            return source.slice(markerIndex, index + 1);
        }
    }

    throw new Error(`Unclosed string property: ${propertyName}`);
}

function findBalancedBlockEnd(source: string, openBraceIndex: number) {
    let depth = 0;
    let quote: '"' | "'" | "`" | null = null;

    for (let index = openBraceIndex; index < source.length; index += 1) {
        const character = source[index];
        const previous = source[index - 1];

        if (quote) {
            if (character === quote && previous !== "\\") {
                quote = null;
            }
            continue;
        }

        if (character === '"' || character === "'" || character === "`") {
            quote = character;
            continue;
        }

        if (character === "{") {
            depth += 1;
            continue;
        }

        if (character === "}") {
            depth -= 1;
            if (depth === 0) {
                return index + 1;
            }
        }
    }

    throw new Error("Unclosed class helper block");
}

function collectFeatureOwnerClassSource(source: string) {
    const slices: string[] = [];
    const declarationRe =
        /\b(?:const\s+\w*(?:ClassName|ClassNames|Classes|Styles|CLASS_NAME|CLASS_NAMES|CLASSES|STYLES)\s*=|function\s+\w*ClassName\s*\()/g;

    for (
        let match = declarationRe.exec(source);
        match;
        match = declarationRe.exec(source)
    ) {
        if (match[0].startsWith("function")) {
            const openBraceIndex = source.indexOf("{", match.index);
            expect(openBraceIndex).toBeGreaterThan(match.index);
            slices.push(
                source.slice(
                    match.index,
                    findBalancedBlockEnd(source, openBraceIndex),
                ),
            );
            continue;
        }

        const end = source.indexOf(";", match.index);
        expect(end).toBeGreaterThan(match.index);
        slices.push(source.slice(match.index, end + 1));
    }

    return slices.join("\n");
}

function expectPrimitiveToExcludeBusinessTokens(
    source: string,
    tokens: readonly string[],
) {
    for (const token of tokens) {
        const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        expect(source).not.toMatch(
            new RegExp(`(^|[^A-Za-z0-9_])${escapedToken}([^A-Za-z0-9_]|$)`),
        );
    }
}

function expectSourceToExcludeForbiddenSubstrings(
    source: string,
    tokens: readonly string[],
) {
    for (const token of tokens) {
        expect(source).not.toContain(token);
    }
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

function expectSourceReportMetricCallsites(
    source: string,
    cardComponentName: string,
    expectations: readonly {
        metric: string;
        snippets: readonly string[];
        value?: string;
    }[],
) {
    const metricCardCallsites =
        source.match(new RegExp(`<${cardComponentName}(?=\\s|>)`, "g")) ?? [];
    const expectedMetricCallsiteProps = [
        'metric="source"',
        'metric="transcript-status"',
        'metric="summary-status"',
        'metric="segment-count"',
    ];
    expect(metricCardCallsites).toHaveLength(4);
    expect(expectations.map(({ metric }) => `metric="${metric}"`)).toEqual(
        expectedMetricCallsiteProps,
    );

    for (const expectation of expectations) {
        const metricCard = extractElementSlice(
            source,
            `metric="${expectation.metric}"`,
            cardComponentName,
        );

        expect(metricCard).toContain(`<${cardComponentName}`);
        expect(metricCard).toContain(`metric="${expectation.metric}"`);
        if (expectation.value) {
            expect(metricCard).toContain(`value="${expectation.value}"`);
        }
        for (const snippet of expectation.snippets) {
            expect(metricCard).toContain(snippet);
        }
    }
}

function extractFeatureClassHelperSource(
    source: string,
    openingElement: string,
) {
    const match = openingElement.match(
        /className=\{\s*([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?\s*\}/,
    );
    expect(match).not.toBeNull();
    const helperName = match?.[1] ?? "";
    const propertyName = match?.[2];

    if (propertyName) {
        const helperBlock = extractBoundedSlice(
            source,
            `const ${helperName} = {`,
            "} as const;",
        );
        return extractObjectStringProperty(helperBlock, propertyName);
    }

    const marker = `const ${helperName} =`;
    const start = source.indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf(";", start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + 1);
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

function expectCnClassNameReferences(
    openingElement: string,
    snippets: readonly string[],
) {
    expect(openingElement).toMatch(/className=\{\s*cn\(/);
    for (const snippet of snippets) {
        expect(openingElement).toContain(snippet);
    }
    expect(openingElement).not.toContain('className="');
}

function expectExactCnClassNameConstReferences(
    openingElement: string,
    constNames: readonly string[],
) {
    const classNameMatch = /className=\{\s*cn\(([\s\S]*?)\)\s*\}/.exec(
        openingElement,
    );
    expect(classNameMatch).not.toBeNull();
    const actualConstNames = (classNameMatch?.[1] ?? "")
        .split(",")
        .map((className) => className.trim())
        .filter(Boolean);
    expect(actualConstNames).toEqual(constNames);
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

function collectExactCssRuleBlocks(source: string, selector: string) {
    return collectCssRuleBlocks(source, selector).filter(({ prelude }) =>
        prelude
            .split(",")
            .map((selectorPart) => selectorPart.trim())
            .includes(selector),
    );
}

const DASHBOARD_SHELL_SOURCE_BUTTON_CONSTANTS = [
    "NAV",
    "SOURCE",
    "SYNC",
    "SOURCE_ACTION",
    "DRAWER_TRIGGER",
    "SIDEBAR_COLLAPSE",
    "SETTINGS_AVATAR",
].map((buttonName) => `DASHBOARD_${buttonName}_BUTTON_CLASS`);

const DASHBOARD_RECORDING_LIST_BUTTON_VARIANTS = [
    "recordingListStatePrimary",
    "recordingListStateAction",
    "recordingListPagination",
] as const;

const DASHBOARD_RECORDING_LIST_BUTTON_SIZES = [
    "recordingListStateAction",
    "recordingListPagination",
] as const;

const DASHBOARD_RECORDING_LIST_BUTTON_PRIMITIVE_FORBIDDEN_TOKENS = [
    "recordingListChipClear",
    "recordingListTagFilterTrigger",
    "recordingListTagFilterOption",
] as const;

const RECORDING_LIST_CHIP_CLEAR_FEATURE_OWNER_CLASS_SNIPPETS = [
    "size-4",
    "rounded-full",
    "border border-transparent",
    "bg-transparent",
    "p-0",
    "text-muted-foreground",
    "shadow-none",
    "hover:bg-accent",
    "hover:text-accent-foreground",
] as const;

const DASHBOARD_SOURCE_FILTER_BUTTON_PRIMITIVE_FORBIDDEN_TOKENS = [
    "dashboardSource",
    "dashboardSourceClear",
    "dashboardSourceAction",
    "sourceFilterClear",
    "sourceFilterAction",
    "sourceFilterClearAll",
] as const;

const DASHBOARD_SOURCE_FILTER_BADGE_PRIMITIVE_FORBIDDEN_TOKENS = [
    "dashboardSourceStatus",
    "dashboardSourceCount",
] as const;

const DASHBOARD_RECORDING_TAG_FILTER_FEATURE_OWNER_CLASS_SNIPPETS = [
    "root:",
    "relative mt-2.5",
    "trigger:",
    "w-full justify-start",
    "text-foreground",
    "label:",
    "min-w-0 flex-1 truncate",
    "count:",
    "font-mono text-[11px] font-medium text-muted-foreground",
    "caret:",
    "shrink-0 text-muted-foreground",
    "list:",
    "top-[calc(100%+6px)]",
    "z-[var(--z-popover-inline)]",
    "border border-border",
    "bg-popover",
    "text-popover-foreground",
    "shadow-lg",
    "option:",
    "border border-transparent",
    "bg-transparent",
    "text-muted-foreground",
    "hover:bg-accent hover:text-accent-foreground",
    "data-[sot-state=selected]:bg-secondary",
    "data-[sot-state=selected]:text-secondary-foreground",
    "optionLabel:",
    "optionCount:",
] as const;

const DASHBOARD_RECORDING_TAG_FILTER_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-panel="recording-list-tag-filter"]',
    '[data-sot-part="recording-list-tag-filter-label"]',
    '[data-sot-part="recording-list-tag-filter-count"]',
    '[data-sot-list="recording-list-tag-filter-list"]',
    '[data-theme="dark"] [data-sot-list="recording-list-tag-filter-list"]',
    '[data-sot-part="recording-list-tag-filter-option-label"]',
    '[data-sot-part="recording-list-tag-filter-option-count"]',
] as const;

const DASHBOARD_SOURCE_FILTER_FEATURE_OWNER_CLASS_SNIPPETS = [
    "group/source-provider",
    "data-[sot-state=connected-active]:border-border",
    "data-[sot-state=connected-active]:bg-card",
    "data-[sot-state=sync-error]:text-foreground",
    "data-[sot-state=disabled]:opacity-[0.55]",
    "[&_[data-sot-part=source-provider-mark]]:size-[18px]",
    "[&_[data-sot-part=source-provider-mark]]:rounded-[4px]",
    "[&_[data-sot-part=source-provider-mark]]:border-border",
    "[&_[data-sot-part=source-provider-mark]_img]:object-contain",
    "[&_[data-sot-part=source-provider-mark][data-sot-provider-cover=true]_img]:object-cover",
    "data-[sot-state=no-results]:[&_[data-sot-part=source-provider-mark]]:opacity-[0.65]",
    "data-[sot-state=disabled]:[&_[data-sot-part=source-provider-mark]]:grayscale-[0.7]",
    "size-1.5",
    "data-[sot-tone=err]:bg-destructive",
    "data-[sot-tone=syncing]:animate-[bpulse_1.2s_ease-in-out_infinite]",
    "min-w-[22px]",
    "font-mono text-[11px]",
    "data-[sot-tone=active]:bg-card",
    "data-[sot-tone=empty]:line-through",
    "data-[sot-tone=err]:text-destructive",
    "ml-[6px]",
    "h-[22px]",
    "rounded-full",
    "data-[sot-action=retry]:hidden",
    "data-[sot-action=retry]:border-destructive/30",
    "data-[sot-action=retry]:bg-destructive/10",
    "data-[sot-action=connect]:border-primary/30",
    "data-[sot-action=connect]:bg-primary/10",
    "group-hover/source-provider:data-[sot-action=retry]:inline-flex",
    "group-focus-within/source-provider:data-[sot-action=retry]:inline-flex",
    "group-data-[sidebar-collapsed=true]/dashboard-workstation:hidden",
    "size-4",
    "hover:bg-accent",
    "hover:text-accent-foreground",
    "cursor-pointer",
    "border border-border",
    "bg-card",
    "focus-visible:outline-ring",
    "focus-visible:ring-0",
    "disabled:cursor-not-allowed",
    "data-[sot-action=retry]:hover:bg-destructive/10",
    "data-[sot-action=widen]:bg-primary/10",
    "data-[sot-action=open-settings]:bg-primary/10",
    "font-sans",
    "clearAll:",
    "h-6",
    "rounded-md",
    "px-2",
    "sourceFilterStackClassNames",
    "root:",
    "gap-x-2 gap-y-1.5",
    "border-b border-border",
    "bg-muted",
    "text-muted-foreground",
    "from:",
    "flex-[0_1_auto]",
    "[&_b]:font-bold",
    "separator:",
    "w-2.5",
    "select-none",
    "chip:",
    "h-[22px]",
    "gap-1.5",
    "border border-border",
    "bg-card",
    "label:",
    "whitespace-nowrap",
    "info:",
    "[&_b]:mx-0.5",
    "libraryRoot:",
    "mt-1.5 flex items-center",
    "libraryLabel:",
    "truncate",
] as const;

const DASHBOARD_SOURCE_FILTER_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-panel="dashboard-source-filter-stack"]',
    '[data-theme="dark"] [data-sot-panel="dashboard-source-filter-stack"]',
    '[data-sot-part="source-filter-from"] b',
    '[data-sot-part="source-filter-separator"]',
    '[data-sot-part="source-filter-chip"]',
    "[data-stack-label]",
    '[data-sot-part="source-filter-info"]',
    '[data-sot-panel="dashboard-library-search-filter"]',
    '[data-sot-part="library-search-filter-label"]',
    '[data-sot-part="library-search-filter-chip"]',
] as const;

const DASHBOARD_TRANSCRIPT_COPY_CONTROLS = [
    "copy-source-transcript",
    "copy-source-report",
] as const;

const DASHBOARD_TRANSCRIPT_COMPACT_ACTION_CONTROLS = [
    "refresh-source-report",
] as const;

const DASHBOARD_TRANSCRIPT_GENERIC_COPY_CONTROLS = [
    "copy-local-transcript",
] as const;

const DASHBOARD_TRANSCRIPT_GENERIC_COMPACT_ACTION_CONTROLS = [
    "retranscribe-recording",
    "retry-retranscription",
] as const;

const DASHBOARD_TRANSCRIPT_RETRANSCRIPTION_DISMISS_CONTROLS = [
    "dismiss-retranscription-failed",
    "dismiss-retranscription-complete",
] as const;

const DASHBOARD_COPY_ACTION_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-part="dashboard-copy-label"]',
    '[data-sot-part="dashboard-copy-icon"]',
    '[data-sot-part="dashboard-transcript-actions"]',
    '[data-sot-control="copy-local-transcript"][hidden]',
    '[data-sot-control="copy-source-transcript"][hidden]',
    '[data-sot-control="copy-source-report"][hidden]',
] as const;

const OLD_UI_RE =
    /uikit-|glass-surface|glass-control|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_CLASS_SNIPPETS = [
    {
        propertyName: "dashboardTopbarActions",
        snippets: ["ml-auto flex items-center gap-2"],
    },
    {
        propertyName: "librarySearchAnchor",
        snippets: ["relative inline-flex size-[32px]"],
    },
    {
        propertyName: "dashboardActivityAnchor",
        snippets: ["relative inline-flex size-[32px]"],
    },
    {
        propertyName: "dashboardSearchTrigger",
        snippets: [
            "data-[sot-state=open]:border-border",
            "data-[sot-state=open]:bg-accent",
            "data-[sot-state=open]:text-accent-foreground",
        ],
    },
    {
        propertyName: "dashboardActivityTrigger",
        snippets: [
            "data-[sot-state=open]:border-border",
            "[&_[data-sot-part=dashboard-activity-badge]]:absolute",
            "[&_[data-sot-part=dashboard-activity-badge]]:right-0.5",
            "[&_[data-sot-part=dashboard-activity-badge]]:top-0.5",
            "[&_[data-sot-part=dashboard-activity-badge]]:min-w-4",
            "[&_[data-sot-part=dashboard-activity-badge]]:bg-destructive",
            "[&_[data-sot-part=dashboard-activity-badge]]:text-destructive-foreground",
            "[&_[data-sot-part=dashboard-activity-badge]]:ring-card",
        ],
    },
    {
        propertyName: "librarySearchPanel",
        snippets: [
            "absolute right-0 top-[calc(100%+8px)]",
            "z-[var(--z-dropdown)]",
            "w-[460px]",
            "data-[open=true]:pointer-events-auto",
            "border-border",
            "bg-popover",
            "text-popover-foreground",
            "shadow-lg",
            "max-[640px]:fixed",
        ],
    },
    {
        propertyName: "dashboardActivityPanel",
        snippets: [
            "border-border",
            "bg-popover",
            "text-popover-foreground",
            "shadow-lg",
        ],
    },
    {
        propertyName: "librarySearchInputRow",
        snippets: [
            "h-[49px] min-h-[49px]",
            "gap-[8px]",
            "px-[12px] py-[8px]",
            "bg-transparent",
            "focus-within:ring-0",
        ],
    },
    {
        propertyName: "librarySearchInput",
        snippets: [
            "h-[32px]",
            "px-[4px] py-0",
            "[font:500_13.5px/1.35_var(--font-sans)]",
            "text-foreground",
            "placeholder:text-muted-foreground",
        ],
    },
    {
        propertyName: "librarySearchScope",
        snippets: [
            "min-h-[39px]",
            "gap-[6px]",
            "px-[12px] py-[8px]",
            "border-b border-border",
            "bg-muted",
        ],
    },
    {
        propertyName: "librarySearchScopeItem",
        snippets: [
            "gap-[4px]",
            "border-transparent bg-transparent",
            "px-[10px]",
            "[font:500_11.5px/1_var(--font-sans)]",
            "text-muted-foreground shadow-none",
            "hover:bg-card hover:text-foreground",
            "data-[state=on]:border-primary/30",
            "data-[state=on]:bg-primary/10",
            "data-[state=on]:text-primary",
        ],
    },
    {
        propertyName: "librarySearchError",
        snippets: [
            "flex w-full flex-col items-center gap-2",
            "px-4 py-4",
            "text-destructive",
            "*:data-[slot=alert-description]:text-destructive",
        ],
    },
    {
        propertyName: "librarySearchErrorTitle",
        snippets: ["line-clamp-none min-h-0", "tracking-normal"],
    },
    {
        propertyName: "librarySearchResult",
        snippets: [
            "h-auto",
            "w-full",
            "flex-col items-start",
            "border-0 bg-transparent",
            "px-[10px] py-[8px]",
            "text-foreground",
            "hover:bg-muted",
            "focus-visible:bg-muted",
            "focus-visible:outline-none",
            "focus-visible:ring-2",
            "focus-visible:ring-ring/50",
        ],
    },
    {
        propertyName: "librarySearchResultTitle",
        snippets: ["[font:600_13px/1.4_var(--font-sans)]", "text-foreground"],
    },
    {
        propertyName: "librarySearchResultMeta",
        snippets: [
            "font-mono",
            "text-[11.5px]",
            "text-muted-foreground",
        ],
    },
    {
        propertyName: "librarySearchTag",
        snippets: [
            "h-[22px] w-fit justify-normal gap-[5px]",
            "rounded-[6px]",
            "border-primary/20",
            "bg-primary/10",
            "text-primary",
            "shadow-xs",
        ],
    },
    {
        propertyName: "dashboardActivityCount",
        snippets: ["border-0 bg-transparent p-0", "font-mono text-[11px]"],
    },
    {
        propertyName: "librarySearchClear",
        snippets: ["size-6", "hover:bg-transparent"],
    },
    {
        propertyName: "librarySearchRetry",
        snippets: ["hover:bg-accent hover:text-accent-foreground"],
    },
    {
        propertyName: "librarySearchScroll",
        snippets: ["min-h-0 flex-1 overflow-y-auto", "pb-[8px]"],
    },
    {
        propertyName: "librarySearchStateSkeleton",
        snippets: [
            "bg-primary/10",
            "after:bg-primary/50",
            "after:animate-[sbn-sweep_1.4s_linear_infinite]",
        ],
    },
    {
        propertyName: "librarySearchStateCopy",
        snippets: [
            "[font:500_12.5px/1.55_var(--font-sans)]",
            "[&_span]:font-semibold",
        ],
    },
    {
        propertyName: "librarySearchResultGroup",
        snippets: [
            "px-[4px] py-[6px]",
            "[&+&]:border-t",
            "[&+&]:border-border",
        ],
    },
    {
        propertyName: "librarySearchGroupLabel",
        snippets: [
            "px-[6px] py-[4px]",
            "[font:600_10.5px/1_var(--font-mono)]",
            "tracking-[0.08em]",
        ],
    },
    {
        propertyName: "librarySearchHighlight",
        snippets: ["bg-primary/10", "px-[2px]", "text-primary"],
    },
    {
        propertyName: "dashboardActivityClose",
        snippets: [
            "size-[26px]",
            "hover:bg-accent hover:text-accent-foreground",
        ],
    },
    {
        propertyName: "dashboardActivitySync",
        snippets: [
            "data-[action-state=error]:text-destructive",
            "disabled:cursor-not-allowed",
        ],
    },
    {
        propertyName: "dashboardActivityAction",
        snippets: [
            "data-[action-state=error]:text-destructive",
            "disabled:cursor-not-allowed",
        ],
    },
    {
        propertyName: "dashboardActivityPanel",
        snippets: [
            "absolute right-0 top-[calc(100%+8px)]",
            "w-[380px]",
            "data-[open=true]:pointer-events-auto",
            "max-[640px]:fixed",
        ],
    },
    {
        propertyName: "dashboardActivityHeader",
        snippets: ["flex items-center gap-2.5", "px-3.5 py-3"],
    },
    {
        propertyName: "dashboardActivityHeading",
        snippets: ["flex flex-1 flex-col gap-0.5"],
    },
    {
        propertyName: "dashboardActivityStatus",
        snippets: [
            "flex items-center gap-2.5",
            "bg-muted",
            "data-[state=running]:[&_[data-sot-part=dashboard-activity-status-indicator]]:animate-[bpulse_1.4s_ease-in-out_infinite]",
            "data-[state=running]:[&_[data-sot-part=dashboard-activity-status-indicator]]:bg-primary",
        ],
    },
    {
        propertyName: "dashboardActivityItems",
        snippets: ["max-h-[340px]", "overflow-y-auto", "empty:hidden"],
    },
    {
        propertyName: "dashboardActivityItem",
        snippets: [
            "grid grid-cols-[26px_1fr_auto]",
            "data-[kind=queued]:[&_[data-sot-part=dashboard-activity-item-icon]]:bg-muted",
            "data-[kind=queued]:[&_[data-sot-part=dashboard-activity-item-icon]]:text-muted-foreground",
            "data-[kind=partial-failed]:[&_[data-sot-part=dashboard-activity-item-icon]]:bg-secondary",
            "data-[kind=partial-failed]:[&_[data-sot-part=dashboard-activity-item-icon]]:text-secondary-foreground",
        ],
    },
    {
        propertyName: "dashboardActivityItemTitle",
        snippets: [
            "[font:600_12.5px/1.35_var(--font-sans)]",
            "text-foreground",
        ],
    },
    {
        propertyName: "dashboardActivityItemMeta",
        snippets: ["[font:500_11px/1.4_var(--font-mono)]", "tracking-[0.02em]"],
    },
    {
        propertyName: "dashboardActivityDismiss",
        snippets: [
            "size-[22px]",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-2",
            "focus-visible:outline-ring",
            "has-[>svg]:p-0",
        ],
    },
    {
        propertyName: "dashboardActivityEmpty",
        snippets: ["p-7 md:p-7", "[&[hidden]]:hidden"],
    },
] as const;

const DASHBOARD_SEARCH_ACTIVITY_SOT_BODY_FORBIDDEN_CLASS_SNIPPETS = [
    {
        propertyName: "librarySearchResultGroup",
        snippets: ["pt-1.5 pb-2 pl-[5px] pr-1"],
    },
    {
        propertyName: "librarySearchGroupLabel",
        snippets: ["pt-[5px] pb-[3px]"],
    },
    {
        propertyName: "librarySearchResult",
        snippets: [
            "min-h-[52px]",
            "pt-[9.5px]",
            "pb-[6.5px]",
            "data-[active=true]:bg-",
            "data-[sot-state=active]:bg-",
        ],
    },
] as const;

const DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_SOURCE_SNIPPETS = [
    "aria-expanded={searchOpen}",
    "aria-expanded={activityOpen}",
    'data-sot-state={searchOpen ? "open" : "idle"}',
    'data-sot-state={activityOpen ? "open" : "idle"}',
    "placeholder={t(",
    '"librarySearch.shortPlaceholder"',
] as const;

const DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE =
    /className=["']btn(?:\s+(?:ghost|primary|glass))?\b|track-fill|track-thumb|sk _is|_is-/;

const DASHBOARD_DETAIL_PANE_SOT_HOOKS = [
    'data-sot-panel="dashboard-transcript-pane"',
    'data-sot-tab-pane="transcript"',
    'data-sot-tab-pane="source-report"',
    'data-sot-tab-pane="speakers"',
    'data-sot-part="dashboard-transcript-actions"',
    'data-sot-part="dashboard-copy-label"',
    'data-sot-part="dashboard-transcript-avatar"',
    'data-sot-list="dashboard-speaker-rows"',
    'data-sot-item="dashboard-speaker-row"',
    'data-sot-part="dashboard-speaker-avatar"',
    'data-sot-part="dashboard-speaker-row-meta"',
    'data-sot-part="dashboard-speaker-name"',
    'data-sot-part="dashboard-speaker-sub"',
    'data-sot-part="dashboard-speaker-bar"',
    'data-sot-part="dashboard-speaker-bar-fill"',
];

const DASHBOARD_TRANSCRIPT_TURN_EMPTY_SOT_HOOKS = [
    'data-sot-item="dashboard-transcript-turn"',
    'data-sot-state="loading"',
    'data-sot-state="ready"',
    'data-sot-part="dashboard-transcript-speaker-time"',
    'data-sot-format="mono"',
    'data-sot-panel="dashboard-transcript-empty"',
    'data-sot-part="dashboard-transcript-empty-icon"',
    'data-sot-part="dashboard-transcript-empty-message"',
    'data-sot-part="dashboard-transcript-empty-sub"',
];

const DASHBOARD_TRANSCRIPT_SKELETON_SHARED_TOKENS = [
    "dashboardTranscript:",
    "dashboardTranscriptAvatar",
    "dashboardTranscriptLine60",
    "dashboardTranscriptLine70",
    "dashboardTranscriptLine78",
    "dashboardTranscriptLine82",
    "dashboardTranscriptLine88",
    "dashboardTranscriptLine92",
    "dashboardTranscriptLine94",
    "dashboardTranscriptLine96",
    "dashboardTranscriptSpeaker120",
    "dashboardTranscriptSpeaker130",
    "dashboardTranscriptSpeaker140",
    "dashboardTranscriptTime",
] as const;

const DASHBOARD_TRANSCRIPT_SKELETON_LOCAL_COMPOSITION_TOKENS = [
    "const dashboardTranscriptSkeletonClassNames",
    'avatar: "size-6 flex-none rounded-full"',
    '"speaker-120": "h-[13px] w-[120px] flex-none"',
] as const;

const DASHBOARD_TRANSCRIPT_OWNER_CLASS_TOKENS = [
    'turn: "border-b border-dashed border-[var(--line-hairline)]',
    'speakerRow: "mb-1.5 flex items-center gap-2.5"',
    "avatar:",
    "data-[sot-tone=info]:bg-[var(--accent-soft)]",
    "data-[sot-tone=success]:bg-[var(--button-copy-success-bg)]",
    'speakerName: "[font:600_12.5px_var(--font-sans)] text-[var(--fg-primary)]"',
    "speakerTime:",
    '"ml-1 font-mono text-[11px] font-medium text-[var(--fg-tertiary)]"',
    "paragraph:",
    "[text-wrap:pretty]",
    'emptyHeader: "block max-w-none"',
    "emptyIcon:",
    "[&_svg]:size-[22px]",
] as const;

const DASHBOARD_SPEAKER_PANE_OWNER_CLASS_TOKENS = [
    'head: "flex items-center gap-2.5 px-4 pt-3 pb-2"',
    "headTitle:",
    '"flex-1 font-sans text-[12.5px] font-semibold text-[var(--fg-secondary)]"',
    'rows: "m-0 flex list-none flex-col gap-0.5 px-2 pb-3.5"',
    "grid-cols-[28px_1fr_120px_auto]",
    "hover:bg-[var(--bg-recessed)]",
    'rowMeta: "flex min-w-0 flex-col gap-0.5"',
    'name: "truncate font-sans text-[13px] font-semibold text-[var(--fg-primary)]"',
    'sub: "font-mono text-[11.5px] font-medium text-[var(--fg-tertiary)]"',
    'bar: "block h-1 w-full overflow-hidden rounded-full bg-[var(--bg-recessed)]"',
    "[width:var(--dashboard-speaker-share,0%)]",
] as const;

const SOURCE_REPORT_SKELETON_SHARED_TOKENS = [
    "sourceReportCard:",
    "sourceReportSegment:",
    "sourceReportCardCount",
    "sourceReportCardSource",
    "sourceReportCardStatus",
    "sourceReportSegmentLineLong",
    "sourceReportSegmentLineMedium",
    "sourceReportSegmentLineShort",
    "sourceReportSegmentLineWide",
    "sourceReportSegmentSpeaker",
    "sourceReportSegmentTime",
] as const;

const EXPECTED_SOURCE_REPORT_METRIC_CARD_CLASS_NAME =
    "gap-[6px] !overflow-visible rounded-[10px] border border-border bg-muted px-[12px] py-[10px] shadow-none backdrop-blur-none";
const SOURCE_REPORT_METRIC_CARD_CLASS_TOKENS =
    EXPECTED_SOURCE_REPORT_METRIC_CARD_CLASS_NAME.split(" ");
const SOURCE_REPORT_STYLE_OWNER_SNIPPETS = [
    "export const SOURCE_REPORT_SKELETON_CLASS_NAME =",
    '"bg-accent"',
    "export type SourceReportTone =",
    "export type SourceReportCardSkeletonSize =",
    "export type SourceReportSegmentSkeletonSize =",
    "export const SOURCE_REPORT_CARD_SKELETON_CLASS_NAMES =",
    "export const SOURCE_REPORT_SEGMENT_SKELETON_CLASS_NAMES =",
    "export const SOURCE_REPORT_PANE_CLASS_NAME =",
    '"flex flex-col gap-3.5"',
    "export const SOURCE_REPORT_STATE_CLASS_NAME =",
    "[&[hidden]]:hidden",
    "export const SOURCE_REPORT_METRIC_CARD_CLASS_NAME =",
    "border border-border bg-muted",
    "text-muted-foreground",
    "text-foreground",
    "export const SOURCE_REPORT_MISSING_NOTICE_CLASS_NAME =",
    "export const SOURCE_REPORT_TRANSCRIPT_MISSING_NOTICE_CLASS_NAME =",
    "export const SOURCE_REPORT_SUMMARY_MISSING_NOTICE_CLASS_NAME =",
    "export const SOURCE_REPORT_ACTION_BUTTON_CLASS_NAME =",
    "export const SOURCE_REPORT_PRIMARY_ACTION_BUTTON_CLASS_NAME =",
    "export const SOURCE_REPORT_GHOST_ACTION_BUTTON_CLASS_NAME =",
    "export const SOURCE_REPORT_COPY_BUTTON_VARIANT =",
    "export const SOURCE_REPORT_COPY_BUTTON_SIZE =",
    "export const SOURCE_REPORT_COPY_BUTTON_CLASS_NAME =",
    "hover:bg-accent hover:text-accent-foreground",
    "export const SOURCE_REPORT_ERROR_ALERT_CLASS_NAME =",
    "export const SOURCE_REPORT_STATUS_BADGE_CLASS_NAME =",
    "data-[sot-tone=err]:border-destructive/30 data-[sot-tone=err]:bg-destructive/10 data-[sot-tone=err]:text-destructive",
    "data-[sot-tone=neu]:border-border data-[sot-tone=neu]:bg-muted data-[sot-tone=neu]:text-muted-foreground",
    "data-[sot-tone=ok]:border-primary/30 data-[sot-tone=ok]:bg-primary/10 data-[sot-tone=ok]:text-primary",
    "data-[sot-tone=warn]:border-border data-[sot-tone=warn]:bg-secondary data-[sot-tone=warn]:text-secondary-foreground",
] as const;

const DASHBOARD_SOURCE_REPORT_LOADING_METRIC_CARDS = [
    {
        metric: "source",
        value: "skeleton",
        snippets: ['<SotSourceReportCardSkeleton size="source" />'],
    },
    {
        metric: "transcript-status",
        value: "skeleton",
        snippets: ['<SotSourceReportCardSkeleton size="status" />'],
    },
    {
        metric: "summary-status",
        value: "skeleton",
        snippets: ['<SotSourceReportCardSkeleton size="status" />'],
    },
    {
        metric: "segment-count",
        value: "skeleton",
        snippets: ['<SotSourceReportCardSkeleton size="count" />'],
    },
] as const;

const DASHBOARD_SOURCE_REPORT_LOADED_METRIC_CARDS = [
    {
        metric: "source",
        value: "source",
        snippets: ["sourceReportProviderName"],
    },
    {
        metric: "transcript-status",
        snippets: [
            "<SotSourceReportStatusBadge",
            "sourceTranscriptStatusLabel",
        ],
    },
    {
        metric: "summary-status",
        snippets: ["<SotSourceReportStatusBadge", "sourceSummaryStatusLabel"],
    },
    {
        metric: "segment-count",
        value: "number",
        snippets: ["sourceReportSegmentCount"],
    },
] as const;

const SOURCE_REPORT_SKELETON_OWNER_TOKENS = [
    "SOURCE_REPORT_SKELETON_CLASS_NAME",
    "SOURCE_REPORT_CARD_SKELETON_CLASS_NAMES",
    "SOURCE_REPORT_SEGMENT_SKELETON_CLASS_NAMES",
    `count: \`\${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[18px] w-[48px] align-middle rounded-[6px]\``,
    `status: \`\${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[18px] w-[80px] align-middle rounded-[6px]\``,
    `source: \`\${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[18px] w-[120px] align-middle rounded-[6px]\``,
    `"line-long": \`\${SOURCE_REPORT_SKELETON_CLASS_NAME} mt-1.5 inline-block h-[13px] w-[92%] align-middle rounded-[4px]\``,
    `"line-wide": \`\${SOURCE_REPORT_SKELETON_CLASS_NAME} mt-[7px] inline-block h-[13px] w-[88%] align-middle rounded-[4px]\``,
    `speaker: \`\${SOURCE_REPORT_SKELETON_CLASS_NAME} ml-[5px] inline-block h-[12px] w-[54px] align-middle rounded-[4px]\``,
    `time: \`\${SOURCE_REPORT_SKELETON_CLASS_NAME} inline-block h-[12px] w-[96px] align-middle rounded-[4px]\``,
] as const;

const DASHBOARD_SOURCE_REPORT_LOADED_SOT_HOOKS = [
    'data-sot-part="dashboard-source-report-status-dot"',
    "data-sot-source-report-segment-time",
    'data-sot-format="mono"',
    'valueFormat="mono"',
];

const DASHBOARD_SOURCE_REPORT_META_VALUE_HELPER_HOOKS = [
    "data-sot-source-report-meta-value",
    "data-sot-format={valueFormat}",
];

const DASHBOARD_SOURCE_REPORT_LOADED_LEGACY_CLASS_NAMES = [
    'className="dot"',
    'className="mono"',
];

const DASHBOARD_DETAIL_PANE_LEGACY_CLASS_NAMES = [
    'className="t-actions"',
    'className="copy-label"',
    'className="t-pane"',
    'className="avatar-sm"',
    'className="sp-rows"',
    'className="sp-row"',
    'className="sp-row-meta"',
    'className="sp-row-name"',
    'className="sp-row-sub"',
    'className="sp-bar"',
];

const DASHBOARD_TRANSCRIPT_TURN_EMPTY_LEGACY_CLASS_NAMES = [
    'className="turn skel-turn"',
    'className="turn"',
    'className="ts mono"',
    'className="empty-state"',
    'className="empty-ico"',
    'className="empty-msg"',
    'className="empty-sub"',
];

const DASHBOARD_RETRANSCRIPTION_SOT_HOOKS = [
    'data-sot-panel="dashboard-retranscription"',
    'data-sot-part="dashboard-retranscription-disabled-hint"',
    'data-sot-part="dashboard-retranscription-icon"',
    'data-sot-part="dashboard-retranscription-spinner"',
    'data-sot-part="dashboard-retranscription-icon-warn"',
    'data-sot-part="dashboard-retranscription-icon-ok"',
    'data-sot-part="dashboard-retranscription-body"',
    'data-sot-part="dashboard-retranscription-title"',
    'data-sot-part="dashboard-retranscription-sub"',
    'data-sot-part="dashboard-retranscription-actions"',
    'data-sot-part="dashboard-retranscription-refresh-marker"',
];

const DASHBOARD_RETRANSCRIPTION_LEGACY_CLASS_NAMES = [
    "retx-disabled-hint",
    "retx-banner",
    "retx-banner-ico",
    "retx-spinner",
    "retx-banner-body",
    "retx-banner-title",
    "retx-banner-sub",
    "retx-banner-actions",
    "retx-refresh-marker",
    "retx-ico-warn",
    "retx-ico-ok",
];

const DASHBOARD_RETRANSCRIPTION_OWNER_CLASS_SNIPPETS = [
    "disabledHint:",
    "banner:",
    "icon:",
    "body:",
    "title:",
    "sub:",
    "actions:",
    "refreshMarker:",
    "group/retx flex items-center gap-[10px]",
    "border-b border-border bg-muted",
    "data-[retx-state=idle]:hidden",
    "data-[retx-state=queued]:border-primary/30",
    "data-[retx-state=queued]:bg-primary/10",
    "data-[retx-state=running]:border-primary/30",
    "data-[retx-state=running]:bg-primary/10",
    "data-[retx-state=failed]:border-destructive/30",
    "data-[retx-state=failed]:bg-destructive/10",
    "data-[retx-state=completed]:border-primary/30",
    "data-[retx-state=completed]:bg-primary/10",
    "[&[hidden]]:hidden",
    "inline-flex size-[28px] flex-none",
    "border border-border bg-card text-muted-foreground",
    'body: "flex min-w-0 flex-1 flex-col gap-[2px]"',
    'actions: "flex flex-none items-center gap-[6px]"',
    "inline-flex items-center gap-[4px]",
    "group-data-[retx-state=running]/retx:text-primary",
    "group-data-[retx-state=running]/retx:border-primary/30",
    "group-data-[retx-state=failed]/retx:text-destructive",
    "group-data-[retx-state=failed]/retx:border-destructive/30",
    "group-data-[retx-state=completed]/retx:text-primary",
    "group-data-[retx-state=completed]/retx:border-primary/30",
    "[font:600_12.5px_var(--font-sans)] text-foreground",
    "[font:500_11.5px_var(--font-sans)] text-muted-foreground",
    "bg-primary/10",
    "text-primary",
] as const;

const DASHBOARD_RETRANSCRIPTION_THEME_CLASS_SNIPPETS = [
    "text-foreground",
] as const;

const DASHBOARD_RETRANSCRIPTION_GLOBAL_TOKEN_DEFINITION_RE =
    /--dashboard-retx-[\w-]+:/;

const DASHBOARD_RETRANSCRIPTION_OWNER_CLASS_USAGES = [
    "dashboardRetranscriptionClassNames.disabledHint",
    "dashboardRetranscriptionClassNames.banner",
    "dashboardRetranscriptionClassNames.icon",
    "dashboardRetranscriptionClassNames.body",
    "dashboardRetranscriptionClassNames.title",
    "dashboardRetranscriptionClassNames.sub",
    "dashboardRetranscriptionClassNames.actions",
    "dashboardRetranscriptionClassNames.refreshMarker",
] as const;

const DASHBOARD_RETRANSCRIPTION_REPAINT_CSS_SELECTORS = [
    '[data-sot-panel="dashboard-retranscription"]',
    '[data-sot-part="dashboard-retranscription-icon"]',
    '[data-sot-part="dashboard-retranscription-icon"] svg',
    '[data-sot-part="dashboard-retranscription-body"]',
    '[data-sot-part="dashboard-retranscription-title"]',
    '[data-sot-part="dashboard-retranscription-sub"]',
    '[data-sot-part="dashboard-retranscription-actions"]',
    '[data-sot-part="dashboard-retranscription-disabled-hint"]',
    '[data-sot-part="dashboard-retranscription-refresh-marker"]',
] as const;

const DASHBOARD_RETRANSCRIPTION_REMOVED_GLOBAL_DISPLAY_SELECTORS = [
    '[data-sot-panel="dashboard-retranscription"]',
    '[data-sot-panel="dashboard-retranscription"][hidden]',
    '[data-sot-panel="dashboard-retranscription"][data-retx-state="idle"]',
    '[data-sot-part="dashboard-retranscription-icon"]',
    '[data-sot-part="dashboard-retranscription-icon-warn"]',
    '[data-sot-part="dashboard-retranscription-icon-ok"]',
    '[data-sot-part="dashboard-retranscription-body"]',
    '[data-sot-part="dashboard-retranscription-actions"]',
    '[data-sot-part="dashboard-retranscription-refresh-marker"]',
    '[data-sot-part="dashboard-retranscription-refresh-marker"][hidden]',
    '[data-sot-part="dashboard-retranscription-disabled-hint"][hidden]',
    "[data-retx-retry]",
    "[data-retx-dismiss]",
] as const;

const DASHBOARD_RETRANSCRIPTION_GLOBAL_REPAINT_DECLARATION_RE =
    /^\s*(?:align-items|justify-content|gap|padding(?:-[\w-]+)?|border(?:-(?:bottom|color|radius|style|width))?|background(?:-clip)?|box-shadow|color|font(?:-[\w-]+)?|width|height|border-radius|flex(?:-(?:basis|direction|grow|shrink|wrap))?|min-width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

const DASHBOARD_RETRANSCRIPTION_OWNER_DIRECT_COLOR_RE =
    /#[\da-f]{3,8}\b|\b(?:color-mix|oklch|rgba?)\(/i;

const DASHBOARD_RECORDING_LIST_BATCH_LEGACY_CLASS_NAMES = [
    "tag-filter",
    "tag-filter-trigger",
    "tag-filter-label",
    "tag-filter-count",
    "tag-filter-caret",
    "tag-filter-list",
    "tag-filter-option",
    "tag-filter-option-label",
    "tag-filter-option-count",
    "list-scroll",
    "ls-group",
    "day",
    "d",
    "c",
    "line",
    "list-state-block",
    "list-state-block list-state-pagination",
    "lsb-ico",
    "lsb-t",
    "lsb-h",
    "lsb-page-divider",
    "lsb-page-nav",
    "lsb-page-num mono",
];

const DASHBOARD_RECORDING_LIST_BATCH_SOT_HOOKS = [
    'data-sot-control="recording-list-tag-filter-trigger"',
    'data-sot-part="recording-list-tag-filter-label"',
    'data-sot-part="recording-list-tag-filter-count"',
    'data-sot-part="recording-list-tag-filter-caret"',
    'data-sot-list="recording-list-tag-filter-list"',
    'data-sot-part="recording-list-tag-filter-option-label"',
    'data-sot-part="recording-list-tag-filter-option-count"',
    'data-sot-list="dashboard-recording-list-scroll"',
    'data-sot-part="dashboard-recording-list-group"',
    'data-sot-part="dashboard-recording-list-group-heading"',
    'data-sot-part="dashboard-recording-list-group-label"',
    'data-sot-part="dashboard-recording-list-group-count"',
    'data-sot-part="dashboard-recording-list-group-divider"',
    'data-sot-part="recording-list-state-icon"',
    'data-sot-part="recording-list-state-title"',
    'data-sot-part="recording-list-state-description"',
    'data-sot-part="recording-list-page-divider"',
    'data-sot-part="recording-list-page-nav"',
    'data-sot-part="recording-list-page-number"',
];

const DASHBOARD_RECORDING_LIST_RESIDUAL_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-part="dashboard-recording-list-header"]',
    '[data-theme="dark"] [data-sot-part="dashboard-recording-list-header"]',
    '[data-sot-part="dashboard-recording-list-titlebar"]',
    '[data-sot-part="dashboard-recording-list-title"]',
    '[data-sot-part="dashboard-recording-list-count"]',
    '[data-sot-list="dashboard-recording-list-scroll"]',
    '[data-sot-list="dashboard-recording-list-scroll"]::-webkit-scrollbar',
    '[data-sot-list="dashboard-recording-list-scroll"]::-webkit-scrollbar-track',
    '[data-sot-list="dashboard-recording-list-scroll"]::-webkit-scrollbar-thumb',
    '[data-sot-list="dashboard-recording-list-scroll"]::-webkit-scrollbar-thumb:hover',
    '[data-sot-part="dashboard-transcript-body"]',
    '[data-sot-part="dashboard-transcript-body"]::-webkit-scrollbar',
    '[data-sot-part="dashboard-transcript-body"]::-webkit-scrollbar-track',
    '[data-sot-part="dashboard-transcript-body"]::-webkit-scrollbar-thumb',
    '[data-sot-part="dashboard-transcript-body"]::-webkit-scrollbar-thumb:hover',
    '[data-sot-panel="dashboard-recording-list-mode"]',
    '[data-sot-part="dashboard-recording-list-mode-label"]',
    '[data-sot-part="dashboard-recording-list-mode-count"]',
    '[data-sot-part="dashboard-recording-list-mode-segmented"]',
    '[data-sot-part="recording-list-state"]',
    '[data-sot-panel="recording-list-pagination"]',
    '[data-sot-part="recording-list-state-icon"]',
    '[data-sot-part="recording-list-state-icon"] svg',
    '[data-sot-part="recording-list-state-title"]',
    '[data-sot-part="recording-list-state-description"]',
    '[data-sot-part="recording-list-page-divider"]',
    '[data-sot-part="recording-list-page-status"]',
    '[data-sot-part="recording-list-page-nav"]',
    '[data-sot-part="recording-list-page-number"]',
] as const;

const DASHBOARD_RECORDING_LIST_RESIDUAL_OWNER_CLASS_REFS = [
    "DASHBOARD_SIDEBAR_FOOTER_CLASS_NAME",
    "DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME",
    "dashboardRecordingListTitlebarStyles.root",
    "dashboardRecordingListTitlebarStyles.title",
    "dashboardRecordingListTitlebarStyles.count",
    "dashboardScrollbarClassName",
    "dashboardRecordingListScrollClassName",
    "dashboardRecordingListModeStyles.root",
    "dashboardRecordingListModeStyles.label",
    "dashboardRecordingListModeStyles.count",
    "dashboardRecordingListModeStyles.segmented",
    "dashboardRecordingListStateStyles.root",
    "dashboardRecordingListStateStyles.icon",
    "dashboardRecordingListStateStyles.title",
    "dashboardRecordingListStateStyles.description",
    "dashboardRecordingListPaginationStyles.root",
    "dashboardRecordingListPaginationStyles.divider",
    "dashboardRecordingListPaginationStyles.status",
    "dashboardRecordingListPaginationStyles.nav",
    "dashboardRecordingListPaginationStyles.number",
] as const;

const DASHBOARD_WORKSPACE_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-panel="dashboard-workspace"]',
    '[data-sot-panel="workstation-workspace"]',
] as const;
const MOBILE_OWNER_LAYOUT_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-shell="dashboard-workstation"]',
    '[data-sot-shell="recording-workstation"]',
    '[data-sot-panel="dashboard-main"]',
    '[data-sot-surface="dashboard-recording-list"]',
    '[data-sot-panel="recording-detail-list"]',
    '[data-sot-panel="recording-workstation-detail"]',
    '[data-sot-panel="workstation-sidebar"]',
] as const;

const DASHBOARD_SIDEBAR_FOOTER_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-part="dashboard-sidebar-footer"]',
] as const;

const DASHBOARD_RECORDING_LIST_HEADER_FORBIDDEN_CLASS_PATTERN =
    /\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;

const DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_SELECTORS = [
    '[data-sot-surface="dashboard-recording-list"][data-slot="card"]',
    '[data-sot-part="dashboard-recording-list-content"][data-slot="card-content"]',
    '[data-sot-control="source-filter-clear"][data-slot="button"]',
    '[data-sot-part="source-filter-action"]',
    '[data-sot-part="source-filter-action"]:focus-visible',
    '[data-sot-part="source-filter-action"][disabled]',
    '[data-sot-control="source-filter-clear-all"][data-slot="button"]',
    '[data-sot-control="library-search-filter-clear"][data-slot="button"]',
    '[data-sot-control="recording-list-tag-filter-trigger"][data-slot="button"]',
    '[data-sot-control="recording-list-tag-filter"][data-slot="button"]',
    '[data-sot-panel="recording-list-pagination"] [data-slot="button"]',
] as const;

const DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_RE =
    /\[data-sot-surface="dashboard-recording-list"\]\[data-slot="card"\]|\[data-sot-part="dashboard-recording-list-content"\]\[data-slot="card-content"\]|\[data-sot-part="source-filter-action"\]|\[data-sot-control="(?:source-filter-clear|source-filter-clear-all|library-search-filter-clear|recording-list-tag-filter-trigger|recording-list-tag-filter)"\]\[data-slot="button"\]|\[data-sot-panel="recording-list-pagination"\][\s\S]{0,80}\[data-slot="button"\]/;

const DASHBOARD_RECORDING_ROW_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-list="dashboard-recording-rows"]',
    '[data-sot-part="dashboard-recording-list-group"]',
    '[data-sot-part="dashboard-recording-list-group-heading"]',
    '[data-sot-part="dashboard-recording-list-group-label"]',
    '[data-sot-part="dashboard-recording-list-group-count"]',
    '[data-sot-part="dashboard-recording-list-group-divider"]',
    '[data-sot-control="dashboard-recording-row"]',
    '[data-sot-control="dashboard-recording-row"]:focus-visible',
    '[data-sot-control="dashboard-recording-row"].is-hover-demo',
    '[data-sot-control="dashboard-recording-row"].is-focus-demo',
    '[data-sot-part="dashboard-recording-row-body"]',
    '[data-sot-part="dashboard-recording-row-title"]',
    '[data-sot-part="dashboard-recording-row-meta"]',
    '[data-sot-part="dashboard-recording-row-secondary"]',
    '[data-sot-part="dashboard-recording-row-actions"]',
] as const;

const DASHBOARD_RECORDING_ROW_META_MIGRATED_GLOBAL_SELECTOR_FRAGMENTS = [
    '[data-sot-part="dashboard-recording-duration"]',
    '[data-sot-part="dashboard-recording-timestamp"]',
    '[data-sot-part="dashboard-recording-timestamp-absolute"]',
    '[data-sot-part="dashboard-recording-timestamp-relative"]',
    'body[data-time-style="abs"]',
    '[data-sot-part="dashboard-recording-source-mark"]',
    '[data-sot-part="dashboard-recording-source-mark"] img',
    '[data-sot-part="dashboard-recording-source-mark"][data-sot-provider-cover="true"]',
    '[data-sot-part="dashboard-recording-source-mark"][data-sot-variant="letter"]',
    '[data-theme="dark"] [data-sot-part="dashboard-recording-source-mark"]',
    '[data-theme="dark"] [data-sot-part="dashboard-recording-source-mark"] img',
    '[data-theme="dark"]\n    [data-sot-part="dashboard-recording-source-mark"][data-sot-variant="letter"]',
] as const;

const DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_SELECTORS = [
    '[data-sot-panel="dashboard-transcript-shell"][data-slot="card"]',
    '[data-sot-part="dashboard-transcript-header"][data-slot="card-header"]',
    '[data-sot-part="dashboard-transcript-language"][data-slot="badge"]',
    '[data-sot-part="dashboard-transcript-body"][data-slot="card-content"]',
    '[data-sot-control="copy-local-transcript"][data-slot="button"]',
    '[data-sot-control="copy-source-transcript"][data-slot="button"]',
    '[data-sot-control="copy-source-report"][data-slot="button"]',
    '[data-sot-control="refresh-source-report"][data-slot="button"]',
    '[data-sot-control="retranscribe-recording"][data-slot="button"]',
    '[data-sot-control="retry-retranscription"][data-slot="button"]',
    '[data-sot-control="dismiss-retranscription-failed"][data-slot="button"]',
    '[data-sot-control="dismiss-retranscription-complete"][data-slot="button"]',
] as const;

const DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|line-height|padding|transition|width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

const ROUTE_LOADING_SURFACE_CLASS_VALUE =
    "min-h-0 gap-0 overflow-hidden rounded-[16px] border-[var(--line-hairline)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)] backdrop-blur-none dark:border-[var(--glass-border)]";
const ROUTE_LOADING_SURFACE_CLASS_TOKENS =
    ROUTE_LOADING_SURFACE_CLASS_VALUE.split(" ");
const DASHBOARD_ROUTE_LOADING_SHELL_CLASS_VALUE =
    "grid h-screen min-h-[720px] grid-cols-[264px_1fr] transition-[grid-template-columns] duration-[320ms] ease-[var(--ease-out)]";
const DASHBOARD_ROUTE_LOADING_DETAIL_CLASS_VALUE =
    "flex min-h-0 min-w-0 flex-col gap-4";
const DASHBOARD_LOADING_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-shell="dashboard-loading"]',
    '[data-sot-panel="dashboard-loading-list"]',
    '[data-sot-panel="dashboard-loading-detail"]',
] as const;
const ROUTE_CHROME_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-panel="route-sidebar"]',
    '[data-sot-part="route-brand"]',
    '[data-sot-part="route-brand"] img',
    '[data-sot-part="route-brand-name"]',
    '[data-sot-part="route-brand-subtitle"]',
    '[data-sot-panel="route-main"]',
    '[data-sot-panel="route-topbar"]',
    '[data-sot-part="route-crumbs"]',
    '[data-sot-part="route-crumb-current"]',
    '[data-sot-panel="route-workspace"]',
] as const;
const ROUTE_CHROME_MODULE_CLASSES = [
    ".sidebar",
    ".brand",
    ".brandName",
    ".brandSubtitle",
    ".main",
    ".topbar",
    ".crumbs",
    ".crumbCurrent",
    ".workspace",
] as const;
const ROUTE_CHROME_FORBIDDEN_FRAMEWORK_RE =
    /var\(--glass|var\(--graphite|color-mix\(|backdrop-filter/;
const GLOBALS_FRAMEWORK_MARKETING_RE =
    /Graphite Glass|SOT web kit|Liquid Glass|Apple-graphite|radial-gradient/;
const REMOVED_DASHBOARD_BRAND_GLOBAL_SELECTORS = [
    '[data-sot-part="dashboard-brand"]',
    '[data-sot-part="dashboard-brand"] img',
    '[data-sot-part="dashboard-brand-name"]',
    '[data-sot-part="dashboard-brand-subtitle"]',
] as const;
const REMOVED_WORKSTATION_BRAND_GLOBAL_SELECTORS = [
    '[data-sot-part="workstation-brand"]',
    '[data-sot-part="workstation-brand"] img',
    '[data-sot-part="workstation-brand-name"]',
    '[data-sot-part="workstation-brand-subtitle"]',
] as const;
const DASHBOARD_BRAND_OWNER_CLASS_INITIALIZERS = [
    {
        property: "wrapper",
        expected: "flex items-center gap-[10px] px-2 pt-1 pb-4",
    },
    {
        property: "image",
        expected: "size-9 rounded-[9px]",
    },
    {
        property: "name",
        expected:
            "[font:600_15px_var(--font-sans)] tracking-[-0.012em] text-[var(--fg-primary)]",
    },
    {
        property: "subtitle",
        expected:
            "mt-px [font:500_11px_var(--font-sans)] text-[var(--fg-tertiary)]",
    },
] as const;

describe("dashboard SOT foundation", () => {
    it("keeps dashboard brand visuals owner-local while workstation brand globals stay removed", () => {
        const globals = readSource("app/globals.css");
        const workstation = readSource("features/dashboard/workstation.tsx");
        const dashboardBrandClassNames = extractBoundedSlice(
            workstation,
            "const dashboardBrandClassNames = {",
            "} as const;",
        );

        for (const selector of REMOVED_DASHBOARD_BRAND_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of REMOVED_WORKSTATION_BRAND_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const {
            expected,
            property,
        } of DASHBOARD_BRAND_OWNER_CLASS_INITIALIZERS) {
            const propertyInitializer = extractObjectStringProperty(
                dashboardBrandClassNames,
                property,
            );
            expect(propertyInitializer).toContain(`${property}:`);
            expect(propertyInitializer).toContain(`"${expected}"`);
            if (property !== "wrapper") {
                expect(workstation).toContain(
                    `className={dashboardBrandClassNames.${property}}`,
                );
            }
        }
        expect(workstation).toContain(
            "className={cn(\n                        dashboardBrandClassNames.wrapper,\n                        dashboardSidebarCollapseClassNames.brand,",
        );
        for (const dataSotPart of [
            'data-sot-part="dashboard-brand"',
            'data-sot-part="dashboard-brand-name"',
            'data-sot-part="dashboard-brand-subtitle"',
        ]) {
            expect(workstation).toContain(dataSotPart);
        }
    });

    it("keeps dashboard route loading skeleton on the shadcn primitive contract", () => {
        const loading = readSource("app/(app)/dashboard/loading.tsx");
        const cardPrimitive = readSource("components/ui/card.tsx");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const globals = readSource("app/globals.css");
        const routeChromeModule = readSource(
            "app/(app)/route-chrome.module.css",
        );
        const routeLoadingSurfaceClassName = extractBoundedSlice(
            loading,
            "const routeLoadingSurfaceClassName =",
            ";",
        );
        const dashboardRouteLoadingShellClassName = extractBoundedSlice(
            loading,
            "const dashboardRouteLoadingShellClassName =",
            ";",
        );
        const dashboardRouteLoadingListClassName = extractBoundedSlice(
            loading,
            "const dashboardRouteLoadingListClassName =",
            ";",
        );
        const dashboardRouteLoadingDetailClassName = extractBoundedSlice(
            loading,
            "const dashboardRouteLoadingDetailClassName =",
            ";",
        );
        const dashboardLoadingShellOpening = extractOpeningElement(
            loading,
            'data-sot-shell="dashboard-loading"',
            "div",
        );
        const dashboardLoadingListCard = extractElementSlice(
            loading,
            'data-sot-panel="dashboard-loading-list"',
            "Card",
        );
        const dashboardLoadingListCardOpening = extractOpeningElement(
            loading,
            'data-sot-panel="dashboard-loading-list"',
            "Card",
        );
        const dashboardLoadingDetailCard = extractElementSlice(
            loading,
            'data-sot-panel="dashboard-loading-detail"',
            "Card",
        );
        const dashboardLoadingDetailCardOpening = extractOpeningElement(
            loading,
            'data-sot-panel="dashboard-loading-detail"',
            "Card",
        );

        expect(loading).toContain(
            'import { Card } from "@/components/ui/card";',
        );
        expect(loading).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(loading).toContain('aria-busy="true"');
        expect(loading).toContain("<Card");
        expect(routeLoadingSurfaceClassName).toContain(
            `"${ROUTE_LOADING_SURFACE_CLASS_VALUE}"`,
        );
        for (const token of ROUTE_LOADING_SURFACE_CLASS_TOKENS) {
            expect(routeLoadingSurfaceClassName).toContain(token);
        }
        expect(dashboardRouteLoadingShellClassName).toContain(
            `"${DASHBOARD_ROUTE_LOADING_SHELL_CLASS_VALUE}"`,
        );
        expect(dashboardRouteLoadingListClassName).toContain(
            "routeLoadingSurfaceClassName",
        );
        expect(dashboardRouteLoadingDetailClassName).toContain(
            "routeLoadingSurfaceClassName",
        );
        expect(dashboardRouteLoadingDetailClassName).toContain(
            `"${DASHBOARD_ROUTE_LOADING_DETAIL_CLASS_VALUE}"`,
        );
        expect(dashboardLoadingShellOpening).toContain(
            "className={dashboardRouteLoadingShellClassName}",
        );
        for (const [label, card] of [
            ["dashboard-loading-list", dashboardLoadingListCard],
            ["dashboard-loading-detail", dashboardLoadingDetailCard],
        ] as const) {
            expect(card, label).toContain('variant="default"');
            expect(card, label).toContain("hasNoPadding");
            expect(card, label).not.toContain('variant="routeLoadingSurface"');
        }
        expect(dashboardLoadingListCardOpening).toContain(
            "className={dashboardRouteLoadingListClassName}",
        );
        expect(dashboardLoadingDetailCardOpening).toContain(
            "className={dashboardRouteLoadingDetailClassName}",
        );
        expect(loading).not.toContain('variant="routeLoadingSurface"');
        expect(cardPrimitive).not.toContain("routeLoadingSurface");
        for (const loadingSkeletonSize of [
            "recordingListLoadingDayLabel",
            "recordingListLoadingTitle",
            "recordingListLoadingTitle80",
            "recordingListLoadingMetaTime",
            "recordingListLoadingMetaTag",
            "recordingListLoadingMetaPill",
            "recordingListLoadingTag",
            "recordingDetailLoadingAvatar",
            "recordingDetailLoadingBar",
            "recordingDetailLoadingBar60",
            "recordingDetailLoadingBar90",
        ]) {
            expect(skeletonPrimitive).not.toContain(loadingSkeletonSize);
            expect(loading).toContain(`${loadingSkeletonSize}:`);
            expect(loading).not.toContain(`size="${loadingSkeletonSize}"`);
        }
        expect(loading).toContain("<Skeleton");
        expect(loading).toContain('aria-hidden="true"');
        expect(loading).toContain(
            "const recordingListLoadingSkeletonClassNames",
        );
        expect(loading).toContain(
            "const recordingDetailLoadingSkeletonClassNames",
        );
        expect(loading).toContain('variant="default"');
        expect(loading).toContain('size="default"');
        expect(loading).toContain("className={");
        expect(loading).toContain('data-sot-shell="dashboard-loading"');
        expect(loading).toContain('data-sot-panel="route-sidebar"');
        expect(loading).toContain('data-sot-panel="route-main"');
        expect(loading).toContain('data-sot-panel="route-topbar"');
        expect(loading).toContain('data-sot-panel="route-workspace"');
        expect(loading).toContain('data-sot-part="route-brand"');
        expect(loading).toContain('data-sot-part="route-brand-name"');
        expect(loading).toContain('data-sot-part="route-brand-subtitle"');
        expect(loading).toContain('data-sot-part="route-crumbs"');
        expect(loading).toContain('data-sot-part="route-crumb-current"');
        expect(loading).toContain('data-sot-panel="dashboard-loading-list"');
        expect(loading).toContain('data-sot-panel="dashboard-loading-detail"');
        expect(loading).toContain('data-sot-panel="recording-list-loading"');
        expect(loading).toContain('data-sot-panel="recording-detail-loading"');
        expect(loading).toContain(
            'import routeChromeStyles from "../route-chrome.module.css";',
        );
        expect(loading).toContain("className={routeChromeStyles.sidebar}");
        expect(loading).toContain("className={routeChromeStyles.brand}");
        expect(loading).toContain("className={routeChromeStyles.brandName}");
        expect(loading).toContain(
            "className={routeChromeStyles.brandSubtitle}",
        );
        expect(loading).toContain("className={routeChromeStyles.main}");
        expect(loading).toContain("className={routeChromeStyles.topbar}");
        expect(loading).toContain("className={routeChromeStyles.crumbs}");
        expect(loading).toContain("className={routeChromeStyles.crumbCurrent}");
        expect(loading).toContain("className={routeChromeStyles.workspace}");
        for (const routeChromeClass of ROUTE_CHROME_MODULE_CLASSES) {
            expect(routeChromeModule).toContain(routeChromeClass);
        }
        expect(routeChromeModule).toContain(
            "grid-template-columns: 380px 1fr;",
        );
        expect(routeChromeModule.match(/^\.sidebar \{/gm) ?? []).toHaveLength(
            1,
        );
        expect(routeChromeModule).not.toMatch(
            ROUTE_CHROME_FORBIDDEN_FRAMEWORK_RE,
        );
        for (const routeChromeSelector of ROUTE_CHROME_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, routeChromeSelector)).toEqual(
                [],
            );
        }
        for (const dashboardLoadingSelector of DASHBOARD_LOADING_REMOVED_GLOBAL_SELECTORS) {
            expect(
                collectCssRuleBlocks(globals, dashboardLoadingSelector),
            ).toEqual([]);
        }
        for (const removedLoadingSelector of [
            '[data-sot-panel="recording-route-loading-detail"]',
            '[data-sot-panel="recording-list-loading"]',
            '[data-sot-panel="recording-detail-loading"]',
        ]) {
            expect(globals).not.toContain(removedLoadingSelector);
        }
        expect(loading).not.toContain('className="app"');
        expect(loading).not.toContain('className="sidebar glass glass-strong"');
        expect(loading).not.toContain('className="main"');
        expect(loading).not.toContain('className="topbar"');
        expect(loading).not.toContain('className="workspace"');
        expect(loading).not.toContain('className="brand"');
        expect(loading).not.toContain('className="brand-text"');
        expect(loading).not.toContain('className="brand-name"');
        expect(loading).not.toContain('className="brand-sub"');
        expect(loading).not.toContain('className="crumbs"');
        expect(loading).not.toContain('className="crumb-current"');
        expect(loading).not.toContain('className="panel"');
        expect(loading).not.toContain('className="detail panel"');
        expect(loading).not.toContain('className="skel-list"');
        expect(loading).not.toContain('className="skel-detail"');
        expect(loading).not.toContain('className="sk sk-title"');
        expect(loading).not.toContain('className="sk sk-bar"');
    });

    it("keeps shadcn foundation primitives real without reintroducing dashboard compatibility surfaces", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const badge = readSource("components/ui/badge.tsx");
        const button = readSource("components/ui/button.tsx");
        const card = readSource("components/ui/card.tsx");
        const globals = readSource("app/globals.css");
        const breadcrumb = readSource("components/ui/breadcrumb.tsx");
        const sidebar = readSource("components/ui/sidebar.tsx");

        for (const primitiveSource of [card, breadcrumb, sidebar]) {
            expect(primitiveSource.trim()).not.toBe("export {};");
        }

        for (const primitive of [
            "Card",
            "CardHeader",
            "CardTitle",
            "CardDescription",
            "CardAction",
            "CardContent",
            "CardFooter",
        ]) {
            expect(card).toMatch(new RegExp(`function ${primitive}\\(`));
            expect(card).toContain(`    ${primitive},`);
        }
        for (const slot of [
            "card",
            "card-header",
            "card-title",
            "card-description",
            "card-action",
            "card-content",
            "card-footer",
        ]) {
            expect(card).toContain(`data-slot="${slot}"`);
        }
        expect(card).toContain("bg-card text-card-foreground");
        expectSourceToExcludeForbiddenSubstrings(
            card,
            CARD_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS,
        );
        expectSourceToExcludeForbiddenSubstrings(
            badge,
            BADGE_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS,
        );
        for (const forbiddenVariantProp of DASHBOARD_OWNER_LOCAL_FORBIDDEN_VARIANT_PROPS) {
            expect(workstation).not.toContain(forbiddenVariantProp);
        }
        expectExactStringConstInitializer(
            workstation,
            "SOT_DASHBOARD_DETAIL_HEADER_CLASS_NAME",
            EXPECTED_DASHBOARD_DETAIL_HEADER_CLASS_NAME,
        );
        expectExactStringConstInitializer(
            workstation,
            "SOT_DASHBOARD_DETAIL_HEADER_TITLE_CLASS_NAME",
            EXPECTED_DASHBOARD_DETAIL_HEADER_TITLE_CLASS_NAME,
        );
        expectExactStringConstInitializer(
            workstation,
            "SOT_DASHBOARD_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME",
            EXPECTED_DASHBOARD_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME,
        );
        expectExactStringConstInitializer(
            workstation,
            "SOT_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME",
            EXPECTED_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME,
        );
        const detailHeader = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-detail-header"',
            "CardHeader",
        );
        const detailHeaderTitle = extractOpeningElement(
            workstation,
            'data-sot-part="detail-header-title"',
            "CardTitle",
        );
        const detailHeaderTitleInput = extractOpeningElement(
            workstation,
            'data-sot-part="detail-header-title-input"',
            "Input",
        );
        const detailHeaderLocalBadge = extractOpeningElement(
            workstation,
            'data-sot-part="detail-header-local-badge"',
            "Badge",
        );
        const detailHeaderStatusBadge = extractOpeningElement(
            workstation,
            'data-sot-part="detail-header-title-status"',
            "Badge",
        );
        expectClassNameConstReference(
            detailHeader,
            "SOT_DASHBOARD_DETAIL_HEADER_CLASS_NAME",
        );
        expectClassNameConstReference(
            detailHeaderTitle,
            "SOT_DASHBOARD_DETAIL_HEADER_TITLE_CLASS_NAME",
        );
        expectClassNameConstReference(
            detailHeaderTitleInput,
            "SOT_DASHBOARD_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME",
        );
        expectClassNameConstReference(
            detailHeaderLocalBadge,
            "SOT_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME",
        );
        expectClassNameConstReference(
            detailHeaderStatusBadge,
            "SOT_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME",
        );
        expect(detailHeader).not.toContain("variant=");
        expect(detailHeaderTitle).not.toContain("variant=");
        expect(detailHeaderTitleInput).not.toContain("variant=");
        expect(detailHeaderTitleInput).not.toContain("controlSize=");
        expect(detailHeaderLocalBadge).toContain('variant="outline"');
        expect(detailHeaderStatusBadge).toContain('variant="ghost"');
        expect(button).not.toContain("detailHeaderIconAction:");
        expect(button).not.toContain("detailHeaderAction:");
        expect(workstation).toContain("headerIconButton:");
        expect(workstation).toContain("headerActionButton:");
        expect(workstation).toContain(
            "size-[32px] border border-transparent bg-transparent p-0 text-muted-foreground shadow-none",
        );
        expect(workstation).toContain(
            "border border-border bg-card px-3 font-sans text-[12.5px] font-semibold",
        );
        expect(workstation).toContain("shadow-xs");
        expect(workstation).toContain("h-8 min-w-[103px] gap-[7px] rounded-[9px]");
        expect(workstation).toContain("has-[>svg]:px-3");
        expect(workstation).not.toContain("[&_svg:not([class*='size-'])]:size-4");
        for (const selector of [
            'data-sot-control="rename-recording-title"',
            'data-sot-control="recording-more-actions"',
            'data-sot-control="ai-rename"',
        ]) {
            expect(globals).not.toContain(selector);
        }
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-panel="dashboard-detail-header"]',
            ).filter(
                ({ prelude }) =>
                    !prelude.includes(
                        '[data-sot-panel="dashboard-detail"][data-empty="true"]',
                    ),
            ),
        ).toEqual([]);
        expect(globals).not.toContain('[data-sot-part="detail-header-title"]');

        for (const primitive of [
            "Breadcrumb",
            "BreadcrumbList",
            "BreadcrumbItem",
            "BreadcrumbLink",
            "BreadcrumbPage",
            "BreadcrumbSeparator",
            "BreadcrumbEllipsis",
        ]) {
            expect(breadcrumb).toMatch(new RegExp(`function ${primitive}\\(`));
            expect(breadcrumb).toContain(`    ${primitive},`);
        }
        for (const slot of [
            "breadcrumb",
            "breadcrumb-list",
            "breadcrumb-item",
            "breadcrumb-link",
            "breadcrumb-page",
            "breadcrumb-separator",
            "breadcrumb-ellipsis",
        ]) {
            expect(breadcrumb).toContain(`data-slot="${slot}"`);
        }
        expect(breadcrumb).toContain('aria-label="breadcrumb"');
        expect(breadcrumb).toContain('aria-current="page"');

        for (const primitive of [
            "Sidebar",
            "SidebarProvider",
            "SidebarContent",
            "SidebarGroup",
            "SidebarMenu",
            "SidebarMenuButton",
            "SidebarMenuItem",
            "SidebarTrigger",
            "useSidebar",
        ]) {
            expect(sidebar).toContain(`    ${primitive},`);
        }
        for (const slot of [
            "sidebar-wrapper",
            "sidebar",
            "sidebar-content",
            "sidebar-group",
            "sidebar-menu",
            "sidebar-menu-button",
            "sidebar-trigger",
        ]) {
            expect(sidebar).toContain(`data-slot="${slot}"`);
        }
        for (const contract of [
            'data-sidebar="sidebar"',
            'data-sidebar="content"',
            'data-sidebar="group"',
            'data-sidebar="menu"',
            'data-sidebar="menu-button"',
            'data-sidebar="trigger"',
            "data-state={state}",
            'data-collapsible={collapsed ? collapsible : ""}',
        ]) {
            expect(sidebar).toContain(contract);
        }
        expect(sidebar).toContain("const SidebarContext = React.createContext");
        expect(sidebar).toContain("--sidebar-width");

        expect(workstation).toContain("@/components/ui/card");
        expect(workstation).not.toContain("@/components/ui/breadcrumb");
        expect(workstation).not.toContain("@/components/ui/sidebar");
    });

    it("keeps the dashboard recording player composed through shadcn slots instead of CSS primitive repaints", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const dashboardRecordingPlayerControls = readSource(
            "features/dashboard/components/dashboard-recording-player-controls.tsx",
        );
        const alert = readSource("components/ui/alert.tsx");
        const badge = readSource("components/ui/badge.tsx");
        const button = readSource("components/ui/button.tsx");
        const card = readSource("components/ui/card.tsx");
        const sotPlayerPrimitives = readSource(
            "features/recordings/components/sot-player-primitives.tsx",
        );
        const globals = readSource("app/globals.css");
        const playerSurfaceIndex = workstation.indexOf(
            'data-sot-surface="dashboard-recording-player"',
        );
        const playerStart = workstation.lastIndexOf(
            "<Card",
            playerSurfaceIndex,
        );
        const transcriptShellIndex = workstation.indexOf(
            'data-sot-panel="dashboard-transcript-shell"',
            playerSurfaceIndex,
        );
        expect(playerSurfaceIndex).toBeGreaterThanOrEqual(0);
        expect(playerStart).toBeGreaterThanOrEqual(0);
        expect(transcriptShellIndex).toBeGreaterThan(playerSurfaceIndex);
        const player = workstation.slice(playerStart, transcriptShellIndex);
        const playerControls = dashboardRecordingPlayerControls;
        const statusBadge = extractOpeningElement(
            player,
            "selectedPlayerStatus.label",
            "SotPlayerStatusBadge",
        );
        const noAudioAlert = extractOpeningElement(
            player,
            'part="dashboard-recording-player-no-audio"',
            "SotPlayerNoAudioAlert",
        );
        const playerMetaHeader = extractOpeningElement(
            player,
            'data-sot-part="dashboard-recording-player-meta"',
            "CardHeader",
        );
        const playerControlsCallsite = extractSelfClosingElement(
            player,
            "<DashboardRecordingPlayerControls",
            "DashboardRecordingPlayerControls",
        );
        const volumeMuteControl = extractOpeningElement(
            playerControls,
            'data-sot-control="dashboard-player-volume-mute"',
            "Button",
        );
        const playerVolumeControl = extractOpeningElement(
            playerControls,
            'data-sot-control="dashboard-player-volume"',
            "Button",
        );
        const playerBackControl = extractOpeningElement(
            playerControls,
            'data-sot-control="dashboard-player-back"',
            "Button",
        );
        const playerPlayControl = extractOpeningElement(
            playerControls,
            'data-sot-control="dashboard-player-play"',
            "Button",
        );
        const playerForwardControl = extractOpeningElement(
            playerControls,
            'data-sot-control="dashboard-player-forward"',
            "Button",
        );
        const playerDate = extractOpeningElement(
            player,
            'data-sot-part="dashboard-recording-player-date"',
            "span",
        );
        const playerCurrentTime = extractOpeningElement(
            playerControls,
            'data-sot-part="dashboard-player-current-time"',
            "span",
        );
        const playerDuration = extractOpeningElement(
            playerControls,
            'data-sot-part="dashboard-player-duration"',
            "span",
        );
        const playerSeekShell = extractOpeningElement(
            playerControls,
            'data-sot-part="dashboard-player-seek-shell"',
            "span",
        );
        const playerSeekSlider = extractSelfClosingElement(
            playerControls,
            'data-sot-control="dashboard-player-seek"',
            "Slider",
        );
        const playerSpeed = extractOpeningElement(
            playerControls,
            'data-sot-control="dashboard-player-speed"',
            "Button",
        );
        const playerVolumeAnchor = extractOpeningElement(
            playerControls,
            'data-sot-part="dashboard-player-volume-anchor"',
            "div",
        );
        const playerVolumeValue = extractOpeningElement(
            playerControls,
            'data-sot-part="dashboard-player-volume-value"',
            "span",
        );
        const playerCardOpening = extractOpeningElement(
            player,
            'data-sot-surface="dashboard-recording-player"',
            "Card",
        );
        const playerCardBlock = extractElementSlice(
            player,
            'data-sot-surface="dashboard-recording-player"',
            "Card",
        );
        const hiddenAudio = extractElementSlice(
            playerCardBlock,
            "<audio",
            "audio",
        );

        expect(player).toContain("<Card");
        expect(playerCardOpening).toContain("hasNoPadding");
        expect(playerCardOpening).toMatch(
            /className=\{\s*SOT_DASHBOARD_RECORDING_PLAYER_CARD_CLASS_NAME\s*\}/,
        );
        expect(playerCardOpening).toContain(
            'data-sot-surface="dashboard-recording-player"',
        );
        expect(playerCardOpening).toContain("data-no-audio={");
        expect(playerCardOpening).toContain("data-playing={");
        expect(playerCardOpening).toContain("data-sot-state={");
        expect(playerCardBlock).not.toContain(
            'variant="dashboardRecordingPlayer"',
        );
        expect(playerCardBlock).toContain("{audioSrc ? (");
        expect(hiddenAudio).toContain("<audio ref={audioRef} src={audioSrc}>");
        expect(hiddenAudio).toContain('<track kind="captions" />');
        expect(hiddenAudio).not.toContain("controls");
        expect(card).not.toContain("dashboardRecordingPlayer");
        expect(card).toContain("data-variant={variant}");
        expect(card).toContain("cardVariants[variant]");
        expectExactStringConstInitializers(
            workstation,
            DASHBOARD_RECORDING_PLAYER_WORKSTATION_CLASS_INITIALIZERS,
        );
        expectExactStringConstInitializers(
            playerControls,
            DASHBOARD_RECORDING_PLAYER_CONTROLS_CLASS_INITIALIZERS,
        );
        expectClassNameConstReference(
            playerMetaHeader,
            "SOT_DASHBOARD_RECORDING_PLAYER_META_CLASS_NAME",
        );
        expectClassNameConstReference(
            playerDate,
            "SOT_DASHBOARD_RECORDING_PLAYER_DATE_CLASS_NAME",
        );
        expect(playerBackControl).toContain('variant="ghost"');
        expect(playerBackControl).toContain('size="icon"');
        expect(playerBackControl).toContain(
            "className={DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME}",
        );
        expect(playerPlayControl).toContain('variant="default"');
        expect(playerPlayControl).toContain('size="icon-lg"');
        expect(playerPlayControl).toContain(
            "className={DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME}",
        );
        expect(playerForwardControl).toContain('variant="ghost"');
        expect(playerForwardControl).toContain('size="icon"');
        expect(playerForwardControl).toContain(
            "className={DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME}",
        );
        expect(playerControls).toContain('data-icon="inline-start"');
        expect(playerControls).toContain(
            'data-sot-part="dashboard-player-control-icon"',
        );
        expectCnClassNameReferences(playerCurrentTime, [
            "DASHBOARD_PLAYER_TIME_CLASS_NAME",
            "playbackDisabled &&",
            "DASHBOARD_PLAYER_DISABLED_CLASS_NAME",
        ]);
        expect(playerSeekShell).toContain(
            'className="relative block min-w-[168px] grow-0 shrink-0 basis-[168px]"',
        );
        expectCnClassNameReferences(playerSeekSlider, [
            '"flex-none"',
            "disabled &&",
            "DASHBOARD_PLAYER_DISABLED_CLASS_NAME",
        ]);
        expectCnClassNameReferences(playerDuration, [
            "DASHBOARD_PLAYER_DURATION_CLASS_NAME",
            "playbackDisabled &&",
            "DASHBOARD_PLAYER_DISABLED_CLASS_NAME",
        ]);
        expectCnClassNameReferences(playerSpeed, [
            "DASHBOARD_PLAYER_SPEED_CLASS_NAME",
            "DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME",
        ]);
        expectClassNameConstReference(
            playerVolumeControl,
            "DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME",
        );
        expect(playerVolumeAnchor).toContain(
            'className="relative inline-flex"',
        );
        expect(playerVolumeValue).toContain(
            'className="min-w-11 text-center font-mono text-xs font-medium tracking-[0.03em] tabular-nums"',
        );
        expect(playerCurrentTime).toContain("playbackDisabled &&");
        expect(playerCurrentTime).toContain(
            "DASHBOARD_PLAYER_DISABLED_CLASS_NAME",
        );
        expect(playerDuration).toContain("playbackDisabled &&");
        expect(playerDuration).toContain(
            "DASHBOARD_PLAYER_DISABLED_CLASS_NAME",
        );
        expect(playerSpeed).toContain(
            "DASHBOARD_PLAYER_DISABLED_BUTTON_CLASS_NAME",
        );
        expect(playerSpeed).toContain("data-sot-state={playerControlState}");
        expect(workstation).toContain(
            'import { DashboardRecordingPlayerControls } from "@/features/dashboard/components/dashboard-recording-player-controls";',
        );
        for (const propRef of [
            "currentTime={currentTime}",
            "duration={playerDurationValue}",
            "isPlaying={isPlaying}",
            "onCyclePlaybackSpeed={cyclePlaybackSpeed}",
            "onSeekBySeconds={seekDashboardPlayerBySeconds}",
            "onSeekToPercent={seekDashboardPlayerToPercent}",
            "onTogglePlayPause={togglePlayPause}",
            "onVolumeChange={setVolume}",
            "onVolumeOpenChange={setVolumeOpen}",
            "playbackDisabled={playbackDisabled}",
            "playbackSpeedLabel={playbackSpeedLabel}",
            "progress={progress}",
            "volume={volume}",
            "volumePopoverOpen={volumePopoverOpen}",
        ]) {
            expect(playerControlsCallsite).toContain(propRef);
        }
        for (const workstationDirectControlToken of [
            "<SotPlayerControlButton",
            "<SotPlayerPrimaryButton",
            "<SotPlayerSpeedButton",
            "<SotPlayerSeekSlider",
            "<SotPlayerVolumeSlider",
            'data-sot-control="dashboard-player-back"',
            'data-sot-control="dashboard-player-play"',
            'data-sot-control="dashboard-player-forward"',
            'data-sot-control="dashboard-player-seek"',
            'data-sot-control="dashboard-player-speed"',
            'data-sot-control="dashboard-player-volume"',
            'data-sot-control="dashboard-player-volume-mute"',
            'data-sot-control="dashboard-player-volume-slider"',
            'data-sot-part="dashboard-player-control-icon"',
            'data-sot-part="dashboard-player-current-time"',
            'data-sot-part="dashboard-player-duration"',
            'data-sot-part="dashboard-player-seek-shell"',
            'data-sot-part="dashboard-player-volume-anchor"',
            'data-sot-part="dashboard-player-volume-value"',
        ]) {
            expect(workstation).not.toContain(workstationDirectControlToken);
        }
        expect(player).toContain("<SotPlayerNoAudioAlert");
        expect(alert).not.toContain("playerNoAudio");
        expect(alert).not.toContain("data-player-no-audio-text");
        expect(noAudioAlert).toContain(
            'part="dashboard-recording-player-no-audio"',
        );
        expect(noAudioAlert).toContain(
            'iconPart="dashboard-recording-player-no-audio-icon"',
        );
        expect(noAudioAlert).toContain(
            'textPart="dashboard-recording-player-no-audio-text"',
        );
        expect(noAudioAlert).toContain(
            'titlePart="dashboard-recording-player-no-audio-title"',
        );
        expect(noAudioAlert).toContain(
            'descriptionPart="dashboard-recording-player-no-audio-description"',
        );
        expect(noAudioAlert).toContain("playbackDisabled={playbackDisabled}");
        expect(noAudioAlert).not.toContain("variant=");
        expect(noAudioAlert).not.toContain("density=");
        expect(noAudioAlert).not.toContain("layout=");
        expect(noAudioAlert).not.toContain("className=");
        expect(sotPlayerPrimitives).toContain("SotPlayerNoAudioAlert");
        expectSotPlayerNoAudioPrimitiveBindings(sotPlayerPrimitives);
        expect(sotPlayerPrimitives).not.toContain("<SotPlayerNoAudioIcon");
        expect(player).not.toContain(
            '<SotPlayerNoAudioIcon className="size-3.5" />',
        );
        expect(player).toContain(
            'textPart="dashboard-recording-player-no-audio-text"',
        );
        expect(player).toContain("<CardHeader");
        expect(player).toContain(
            "SOT_DASHBOARD_RECORDING_PLAYER_META_CLASS_NAME",
        );
        expect(player).not.toContain(
            'className="mb-[12px] flex flex-row flex-wrap items-center gap-[10px] p-0"',
        );
        expect(playerControls).toContain("<CardContent");
        expect(playerControls).toContain(
            'className="flex min-w-0 items-center gap-[12px] overflow-visible p-0"',
        );
        expect(button).not.toContain("playerControl:");
        expect(button).not.toContain("playerPrimary:");
        expect(button).not.toContain("playerSpeed:");
        expect(button).not.toContain("playerControlSm:");
        expect(button).not.toContain("playerControlLg:");
        for (const removedPlayerButtonPrimitiveToken of [
            "SOT_PLAYER_CONTROL_BUTTON_CLASS",
            "SOT_PLAYER_CONTROL_BUTTON_SIZE_CLASS",
            "SOT_PLAYER_CONTROL_BUTTON_SM_SIZE_CLASS",
            "SOT_PLAYER_PRIMARY_BUTTON_CLASS",
            "SOT_PLAYER_PRIMARY_BUTTON_SIZE_CLASS",
            "SOT_PLAYER_SPEED_BUTTON_CLASS",
            "SOT_PLAYER_SPEED_BUTTON_SIZE_CLASS",
            "type SotPlayerButtonProps",
            "SotPlayerControlButton",
            "SotPlayerPrimaryButton",
            "SotPlayerSpeedButton",
        ]) {
            expect(sotPlayerPrimitives).not.toContain(
                removedPlayerButtonPrimitiveToken,
            );
        }
        expect(button).not.toContain("dashboard-player-volume-icon");
        expect(button).not.toContain("recording-player-volume-icon");
        expect(playerControls).toContain("<Button");
        expect(playerControls).not.toContain("<SotPlayerControlButton");
        expect(playerControls).not.toContain("<SotPlayerPrimaryButton");
        expect(playerControls).not.toContain("<SotPlayerSpeedButton");
        expect(playerControls).not.toContain('controlSize="sm"');
        for (const removedPlayerProp of [
            `variant="${"playerControl"}"`,
            `size="${"playerControl"}"`,
            `variant="${"playerPrimary"}"`,
            `size="${"playerControlLg"}"`,
            `variant="${"playerSpeed"}"`,
            `size="${"playerSpeed"}"`,
            `size="${"playerControlSm"}"`,
        ]) {
            expect(playerControls).not.toContain(removedPlayerProp);
        }
        expect(volumeMuteControl).toContain('variant="ghost"');
        expect(volumeMuteControl).toContain('size="icon-sm"');
        expect(volumeMuteControl).not.toContain("className=");
        expect(playerControls).not.toContain("data-player-control-icon");
        expect(playerControls).not.toContain("SOT_PLAYER_BUTTON_CLASS");
        expect(playerControls).not.toContain("SOT_PLAYER_PRIMARY_BUTTON_CLASS");
        expect(playerControls).not.toContain("SOT_PLAYER_BUTTON_SM_CLASS");
        expect(playerControls).not.toContain("SOT_PLAYER_SPEED_BUTTON_CLASS");
        expect(playerControls).toContain('variant="ghost"');
        expect(playerControls).toContain('variant="default"');
        expect(playerControls).toContain('size="icon-sm"');
        expect(playerControls).not.toContain('size="icon-xs"');
        expect(playerControls).toContain('size="sm"');
        expect(playerControls).not.toContain('variant="player"');
        expect(playerControls).not.toContain('variant="player-primary"');
        expect(playerControls).not.toContain('size="player"');
        expect(playerControls).not.toContain('size="player-lg"');
        expect(playerControls).not.toContain('size="player-sm"');
        expect(badge).not.toContain("playerSource:");
        expect(badge).not.toContain(`${"player"}Status:`);
        expect(badge).not.toContain("min-w-[65.171875px]");
        expect(badge).not.toContain("[&_[data-sot-part=status-dot]]");
        expect(badge).not.toContain("[&_[data-sot-part=status-label]]");
        expect(sotPlayerPrimitives).toContain("const PLAYER_STATUS_VARIANT");
        expect(sotPlayerPrimitives).toContain(
            'React.ComponentProps<typeof Badge>["variant"]',
        );
        expect(sotPlayerPrimitives).toContain("const PLAYER_STATUS_TONE_CLASS");
        expect(sotPlayerPrimitives).toContain(
            'className={cn("gap-1.5", PLAYER_STATUS_TONE_CLASS[tone], className)}',
        );
        expect(sotPlayerPrimitives).toContain(
            "variant={PLAYER_STATUS_VARIANT[tone]}",
        );
        expect(sotPlayerPrimitives).toContain(
            '"size-1.5 rounded-full bg-current"',
        );
        expect(sotPlayerPrimitives).toMatch(
            /tone === "warn" &&\s*"animate-\[bpulse_1\.4s_ease-in-out_infinite\]"/,
        );
        expect(sotPlayerPrimitives).not.toContain("--source-provider-status");
        expect(badge).not.toContain("playerTagChip:");
        expect(badge).not.toContain("playerTagOverflow:");
        expect(player).toContain("<SotPlayerStatusBadge");
        expect(statusBadge).toContain("label={selectedPlayerStatus.label}");
        expect(statusBadge).toMatch(
            /tone=\{\s*selectedPlayerStatus\.tone\s*\}/,
        );
        expect(statusBadge).toContain('className="ml-auto"');
        expect(sotPlayerPrimitives).not.toContain(
            "SOT_PLAYER_STATUS_BADGE_CLASS",
        );
        expect(sotPlayerPrimitives).toContain(
            "variant={PLAYER_STATUS_VARIANT[tone]}",
        );
        expect(sotPlayerPrimitives).toContain(
            'data-sot-control="player-status"',
        );
        expect(sotPlayerPrimitives).toContain("data-sot-tone={tone}");
        expect(sotPlayerPrimitives).toContain('data-sot-part="status-dot"');
        expect(sotPlayerPrimitives).toContain('data-sot-part="status-label"');
        expectSotPlayerSourcePrimitiveBindings(sotPlayerPrimitives);
        for (const sotPlayerTagClassConstant of [
            "PLAYER_TAG_COLOR_CLASS",
            "PLAYER_TAG_CHIP_CLASS",
            "PLAYER_TAG_OVERFLOW_CLASS",
        ]) {
            expect(sotPlayerPrimitives).toContain(sotPlayerTagClassConstant);
        }
        for (const removedSotPlayerTagClassConstant of [
            "SOT_PLAYER_TAG_BADGE_CLASS",
            "SOT_PLAYER_TAG_OVERFLOW_BADGE_CLASS",
            "SOT_PLAYER_TAG_ADD_BUTTON_CLASS",
            "SOT_PLAYER_TAG_CHIP_BUTTON_CLASS",
            "SOT_PLAYER_TAG_OVERFLOW_BUTTON_CLASS",
            "SOT_PLAYER_TAG_CHIP_VARIABLES_CLASS",
            "SOT_PLAYER_TAG_COLOR_TOKEN",
        ]) {
            expect(sotPlayerPrimitives).not.toContain(
                removedSotPlayerTagClassConstant,
            );
        }
        for (const sotPlayerTagChipToken of [
            "--sot-player-tag-chip-bg",
            "--sot-player-tag-chip-border",
            "--sot-player-tag-chip-fg",
            "--sot-player-tag-chip-blue-bg",
            "--sot-player-tag-chip-blue-border",
            "--sot-player-tag-chip-blue-fg",
        ]) {
            expect(globals).not.toContain(sotPlayerTagChipToken);
            expect(sotPlayerPrimitives).not.toContain(sotPlayerTagChipToken);
        }
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
        expect(badge).not.toContain("dashboard-recording-tag-chip");
        expect(sotPlayerPrimitives).not.toContain(
            "dashboard-recording-tag-chip",
        );
        expect(playerControls).toContain(
            'data-sot-panel="dashboard-recording-player-controls"',
        );
        expect(playerControls).toContain(
            'data-sot-control="dashboard-player-seek"',
        );
        expect(playerControls).toContain("<Slider");
        expect(playerControls).toContain('"flex-none"');
        expect(playerSeekSlider).toContain(
            'aria-disabled={disabled ? "true" : undefined}',
        );
        expect(playerSeekSlider).toContain(
            "aria-valuenow={Math.round(progress)}",
        );
        expect(playerSeekSlider).toContain("data-sot-state={controlState}");
        expect(playerSeekSlider).toContain("onClick={(event) =>");
        expect(playerSeekSlider).toContain("onKeyDown={(event) =>");
        expect(playerSeekSlider).toContain('event.key === "ArrowLeft"');
        expect(playerSeekSlider).toContain('event.key === "ArrowRight"');
        expect(playerSeekSlider).toContain('event.key === "Home"');
        expect(playerSeekSlider).toContain('event.key === "End"');
        expect(playerSeekSlider).not.toContain("rootProps={{");
        expect(playerSeekSlider).toContain("tabIndex={disabled ? -1 : 0}");
        expect(playerControls).toContain(
            "DASHBOARD_PLAYER_DISABLED_CLASS_NAME",
        );
        expect(playerControls).not.toContain("SOT_PLAYER_SEEK_SLIDER_CLASS");
        expect(playerControls).not.toContain("SOT_PLAYER_SEEK_RANGE_CLASS");
        expect(playerControls).not.toContain("SOT_PLAYER_SEEK_THUMB_CLASS");
        expect(playerControls).not.toContain("dashboardSeekSliderRootStyle");
        expect(playerControls).not.toContain("sotPlayerSeekRangeStyle");
        expect(playerControls).not.toContain("sotPlayerSeekThumbStyle");
        expect(playerControls).not.toContain("className: SOT_PLAYER");
        expect(playerControls).not.toContain("style: sotPlayer");
        expect(playerControls).not.toContain(
            "style: dashboardSeekSliderRootStyle",
        );
        expect(playerControls).toContain(
            'data-sot-control="dashboard-player-volume"',
        );
        expect(playerControls).toContain("<Popover");
        expect(playerControls).toContain("<PopoverTrigger asChild>");
        expect(playerControls).toContain("<PopoverContent");
        expect(playerControls).toContain("<Slider");
        expect(playerControls).not.toContain(`variant="${"player"}Seek"`);
        expect(playerControls).not.toContain(`variant="${"player"}Volume"`);
        expect(playerControls).not.toContain(
            'className="w-[200px] min-w-[200px] gap-0 overflow-visible px-2.5 py-2"',
        );
        expect(playerControls).not.toContain("SOT_PLAYER_VOLUME_SLIDER_CLASS");
        expect(playerControls).toContain('side="top"');
        expect(playerControls).toContain('align="end"');
        for (const wrapperToken of [
            "SOT_PLAYER_SEEK_SLIDER_CLASS",
            "SOT_PLAYER_SEEK_RANGE_CLASS",
            "SOT_PLAYER_SEEK_THUMB_CLASS",
            "SOT_PLAYER_VOLUME_SLIDER_CLASS",
            "SOT_PLAYER_VOLUME_POPOVER_CONTENT_CLASS",
            "SotPlayerSeekSlider",
            "SotPlayerVolumeSlider",
            "SotPlayerVolumePopoverContent",
        ]) {
            expect(sotPlayerPrimitives).not.toContain(wrapperToken);
        }

        for (const removedGlobalSelector of REMOVED_DASHBOARD_PLAYER_GLOBAL_SELECTOR_FRAGMENTS) {
            expect(globals).not.toContain(removedGlobalSelector);
            expect(alert).not.toContain(removedGlobalSelector);
            expect(badge).not.toContain(removedGlobalSelector);
            expect(button).not.toContain(removedGlobalSelector);
            expect(card).not.toContain(removedGlobalSelector);
            expect(sotPlayerPrimitives).not.toContain(removedGlobalSelector);
        }
        expect(globals).not.toContain(
            '[data-sot-surface="dashboard-recording-player"][data-slot="card"]',
        );
        expect(globals).not.toMatch(
            /\[data-sot-surface="dashboard-recording-player"\]\s+\[data-sot-part="dashboard-recording-player-meta"\]\[data-slot="card-header"\]/,
        );
        expect(globals).not.toMatch(
            /\[data-sot-surface="dashboard-recording-player"\]\s+\[data-sot-panel="dashboard-recording-player-controls"\]\[data-slot="card-content"\]/,
        );
        expect(globals).not.toContain(
            '[data-sot-control="player-status"][data-slot="badge"]',
        );
        expect(
            collectCssRuleBlocks(globals, '[data-sot-control="player-status"]'),
        ).toEqual([]);
        for (const selector of [
            '[data-sot-part="dashboard-recording-player-no-audio"][data-slot="alert"]',
            '[data-sot-part="dashboard-recording-player-no-audio-title"][data-slot="alert-title"]',
            '[data-sot-part="dashboard-recording-player-no-audio-description"][data-slot="alert-description"]',
            '[data-sot-panel="dashboard-player-volume-popover"][data-slot="popover-content"]',
            '[data-sot-control="player-source-tag"][data-slot="badge"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
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
        ] as const) {
            expect(
                collectCssRuleBlocks(globals, selector).filter(({ prelude }) =>
                    prelude.includes(surface),
                ),
            ).toEqual([]);
        }
        for (const selector of [
            '[data-sot-part="dashboard-player-seek-shell"]',
            '[data-sot-part="dashboard-player-volume-anchor"]',
        ]) {
            expect(playerControls).toContain(selector.replace(/\[|\]/g, ""));
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(playerControls).not.toContain(
            'data-sot-part="dashboard-player-seek-thumb"',
        );
        const dashboardPlayerSliderPrimitiveBlocks = [
            "dashboard-player-seek",
            "dashboard-player-volume-slider",
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
        expect(dashboardPlayerSliderPrimitiveBlocks).toEqual([]);
    });

    it("renders the dashboard from the SOT workstation shell instead of compatibility components", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const dashboardRecordingPlayerControls = readSource(
            "features/dashboard/components/dashboard-recording-player-controls.tsx",
        );
        const button = readSource("components/ui/button.tsx");
        const globals = readSource("app/globals.css");
        const buttonVariantBlock = extractBoundedSlice(
            button,
            "variant: {",
            "size: {",
        );
        const buttonSizeBlock = extractBoundedSlice(
            button,
            "size: {",
            "defaultVariants:",
        );

        for (const variant of [
            "dashboardNav",
            "dashboardSync",
            "dashboardCopy",
            "dashboardCompactAction",
            "dashboardSpeakersMerge",
            "dashboardDrawerTrigger",
            "dashboardSidebarCollapse",
            "dashboardSettingsAvatar",
        ]) {
            expect(buttonVariantBlock).not.toContain(`${variant}:`);
        }
        for (const size of [
            "dashboardNav",
            "dashboardSync",
            "dashboardCopy",
            "dashboardCompactAction",
            "dashboardSpeakersMerge",
            "dashboardDrawerTrigger",
            "dashboardSidebarCollapse",
            "dashboardSettingsAvatar",
        ]) {
            expect(buttonSizeBlock).not.toContain(`${size}:`);
        }
        for (const copyStateClass of [
            "data-[copy-state=ok]:border-primary/30",
            "data-[copy-state=ok]:bg-primary/10",
            "data-[copy-state=ok]:text-primary",
            "data-[copy-state=err]:border-destructive/30",
            "data-[copy-state=err]:text-destructive",
            "data-[copy-state=err]:hover:bg-transparent",
        ]) {
            expect(buttonVariantBlock).not.toContain(copyStateClass);
            expect(workstation).toContain(copyStateClass);
        }
        for (const removedConstant of DASHBOARD_SHELL_SOURCE_BUTTON_CONSTANTS) {
            expect(workstation).not.toContain(removedConstant);
        }
        for (const variant of DASHBOARD_RECORDING_LIST_BUTTON_VARIANTS) {
            expect(buttonVariantBlock).not.toContain(`${variant}:`);
        }
        for (const size of DASHBOARD_RECORDING_LIST_BUTTON_SIZES) {
            expect(buttonSizeBlock).not.toContain(`${size}:`);
        }
        expectPrimitiveToExcludeBusinessTokens(
            button,
            DASHBOARD_RECORDING_LIST_BUTTON_PRIMITIVE_FORBIDDEN_TOKENS,
        );
        for (const variant of [
            "playerTagAdd",
            "playerTagChip",
            "playerTagOverflow",
        ]) {
            expect(buttonVariantBlock).not.toContain(`${variant}:`);
            expect(buttonSizeBlock).not.toContain(`${variant}:`);
        }

        for (const removed of [
            "ActivityOverlay",
            "LibrarySearch",
            "RecordingList",
            "SourceFilterStackStrip",
            "SourceProviderRows",
            "SyncStatus",
            "TranscriptionPanel",
        ]) {
            expect(workstation).not.toMatch(new RegExp(`<${removed}[\\s/>]`));
            expect(workstation).not.toContain(
                `./components/${removed
                    .replace(
                        /[A-Z]/g,
                        (match, index) =>
                            `${index ? "-" : ""}${match.toLowerCase()}`,
                    )
                    .replace("source-provider-rows", "source-provider-rows")}`,
            );
        }

        expect(workstation).toContain(
            'data-sot-surface="dashboard-workstation"',
        );
        expect(workstation).toContain(
            'data-sot-state={hydrated ? "ready" : "loading"}',
        );
        expect(workstation).toContain('data-sot-shell="dashboard-workstation"');
        expect(workstation).toContain(
            'data-drawer-state={drawerOpen ? "open" : "closed"}',
        );
        expect(workstation).toContain(
            'data-sidebar-collapsed={\n                dashboardSidebarCollapsed ? "true" : "false"\n            }',
        );
        expect(workstation).toContain(
            'data-source-filter-active={source === "all" ? "false" : "true"}',
        );
        expect(workstation).toContain(
            'data-source-filter-provider={source === "all" ? undefined : source}',
        );
        expect(workstation).toContain(
            "data-source-filter-state={sourceFilterStackState}",
        );
        expect(workstation).toContain(
            "data-source-status={selectedSourceRow?.status ?? undefined}",
        );
        expect(workstation).toContain('data-time-style="rel"');
        expect(workstation).toContain('data-sot-panel="dashboard-sidebar"');
        expect(workstation).toContain('data-sot-list="dashboard-nav"');
        for (const selector of REMOVED_DASHBOARD_NAV_FAVORITE_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        const dashboardNavClassNames = extractBoundedSlice(
            workstation,
            "const dashboardNavClassNames = {",
            "} as const;",
        );
        expect(
            extractObjectStringProperty(dashboardNavClassNames, "root"),
        ).toBe('root: "flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3"');
        expect(
            extractObjectStringProperty(dashboardNavClassNames, "sectionLabel"),
        ).toContain("tracking-[0.08em]");
        expect(
            extractObjectStringProperty(
                dashboardNavClassNames,
                "favoriteCount",
            ),
        ).toContain("data-[sot-state=selected]:bg-[var(--bg-elevated)]");
        expect(
            extractObjectStringProperty(
                dashboardNavClassNames,
                "favoriteCount",
            ),
        ).not.toContain("dark:data-[sot-state=selected]");
        const dashboardNav = extractOpeningElement(
            workstation,
            'data-sot-list="dashboard-nav"',
            "nav",
        );
        expect(dashboardNav).toContain(
            "className={dashboardNavClassNames.root}",
        );
        expect(workstation).toContain('data-sot-panel="dashboard-main"');
        const dashboardMain = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-main"',
            "main",
        );
        const dashboardMainClassName = expectExactStringConstInitializer(
            workstation,
            "DASHBOARD_MAIN_CLASS_NAME",
            EXPECTED_DASHBOARD_MAIN_CLASS_NAME,
        );
        expect(dashboardMain).toContain(
            "className={DASHBOARD_MAIN_CLASS_NAME}",
        );
        expect(dashboardMainClassName).not.toMatch(
            OWNER_MAIN_FORBIDDEN_RAW_COLOR_RE,
        );
        const dashboardMainGlobalBlocks = collectCssRuleBlocks(
            globals,
            '[data-sot-panel="dashboard-main"]',
        );
        expect(dashboardMainGlobalBlocks).toEqual([]);
        expect(globals).not.toContain(
            '[data-sot-panel="dashboard-main"] {\n    display: flex;\n    flex-direction: column;\n    min-width: 0;\n    height: 100vh;\n}',
        );
        for (const selector of MOBILE_OWNER_LAYOUT_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(workstation).toContain('data-sot-panel="dashboard-topbar"');
        const dashboardTopbar = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-topbar"',
            "header",
        );
        const dashboardTopbarClassNames = extractBoundedSlice(
            workstation,
            "const dashboardTopbarClassNames = {",
            "} as const;",
        );
        for (const {
            expected,
            property,
        } of DASHBOARD_TOPBAR_OWNER_CLASS_INITIALIZERS) {
            expect(dashboardTopbarClassNames).toContain(`${property}:`);
            expect(dashboardTopbarClassNames).toContain(`"${expected}"`);
            expect(workstation).toContain(
                `className={dashboardTopbarClassNames.${property}}`,
            );
        }
        for (const classToken of DASHBOARD_TOPBAR_REQUIRED_CLASS_TOKENS) {
            expect(dashboardTopbarClassNames).toContain(classToken);
        }
        expect(dashboardTopbarClassNames).not.toMatch(
            OWNER_MAIN_FORBIDDEN_RAW_COLOR_RE,
        );
        expect(dashboardTopbar).toContain(
            "className={dashboardTopbarClassNames.topbar}",
        );
        expect(globals).toContain("--z-topbar: 200;");
        for (const selector of DASHBOARD_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        const dashboardWorkspace = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-workspace"',
            "div",
        );
        const dashboardWorkspaceClassName = expectExactStringConstInitializer(
            workstation,
            "DASHBOARD_WORKSPACE_CLASS_NAME",
            EXPECTED_DASHBOARD_WORKSPACE_CLASS_NAME,
        );
        expect(dashboardWorkspace).toContain(
            "className={DASHBOARD_WORKSPACE_CLASS_NAME}",
        );
        expect(dashboardWorkspaceClassName).not.toMatch(
            OWNER_WORKSPACE_FORBIDDEN_CLASS_RE,
        );
        for (const selector of DASHBOARD_WORKSPACE_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).not.toContain(
            '[data-sot-panel="dashboard-workspace"]\n        > [data-sot-panel="dashboard-detail"]',
        );
        const dashboardSidebar = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-sidebar"',
            "aside",
        );
        const dashboardSidebarClassNames = extractBoundedSlice(
            workstation,
            "const dashboardSidebarCollapseClassNames = {",
            "} as const;",
        );
        const dashboardSidebarClass = extractObjectStringProperty(
            dashboardSidebarClassNames,
            "sidebar",
        );
        expect(dashboardSidebar).toContain(
            "className={dashboardSidebarCollapseClassNames.sidebar}",
        );
        for (const ownerClassToken of DASHBOARD_SIDEBAR_OWNER_CLASS_TOKENS) {
            expect(dashboardSidebarClass).toContain(ownerClassToken);
        }
        expect(dashboardSidebarClass).not.toMatch(
            DASHBOARD_SIDEBAR_OWNER_FORBIDDEN_CLASS_PATTERN,
        );
        for (const selector of DASHBOARD_SIDEBAR_VISUAL_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).not.toContain(
            '[data-theme="dark"] [data-sot-panel="dashboard-sidebar"],\n.dark [data-sot-panel="dashboard-sidebar"]',
        );
        const dashboardSidebarGlobalBlocks = collectCssRuleBlocks(
            globals,
            '[data-sot-panel="dashboard-sidebar"]',
        );
        expect(dashboardSidebarGlobalBlocks).toHaveLength(1);
        expect(dashboardSidebarGlobalBlocks[0]?.prelude).toContain(
            '[data-sot-panel="dashboard-sync"]',
        );
        expect(dashboardSidebarGlobalBlocks[0]?.declarations).toContain(
            "pointer-events: none;",
        );
        expect(dashboardSidebarGlobalBlocks[0]?.declarations).not.toMatch(
            DASHBOARD_SIDEBAR_VISUAL_GLOBAL_DECLARATION_RE,
        );
        expect(globals).toContain(
            '[data-sot-control="dashboard-sync"][disabled] {\n    pointer-events: none;',
        );
        expect(globals).toContain(
            '[data-sot-panel="settings-scroll-body"][hidden] {\n    display: none;\n}',
        );
        expect(globals).toContain(
            '[data-sot-panel="dashboard-detail"][data-empty="true"] [data-detail-empty] {\n    display: flex;',
        );
        expect(workstation).toContain('data-sot-panel="dashboard-workspace"');
        const dashboardDetailPanel = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-detail"',
            "section",
        );
        const dashboardDetailPanelClassName = expectExactStringConstInitializer(
            workstation,
            "DASHBOARD_DETAIL_PANEL_CLASS_NAME",
            EXPECTED_DETAIL_PANEL_CLASS_NAME,
        );
        expectClassNameConstReference(
            dashboardDetailPanel,
            "DASHBOARD_DETAIL_PANEL_CLASS_NAME",
        );
        expect(dashboardDetailPanelClassName).not.toMatch(
            OWNER_WORKSPACE_FORBIDDEN_CLASS_RE,
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-drawer-trigger"',
        );
        expect(workstation).toContain('id="drawer-scrim"');
        expect(workstation).toContain('id="drawer-trigger"');
        expect(workstation).not.toContain("data-drawer-open=");
        expect(workstation).not.toContain(
            'data-sot-surface="dashboard-source-rail"',
        );
        expect(workstation).toContain('data-sot-control="dashboard-search"');
        expect(workstation).toContain('data-sot-control="dashboard-activity"');
        const dashboardSearchSlice = extractBoundedSlice(
            workstation,
            'data-sot-part="library-search-anchor"',
            'data-sot-part="dashboard-activity-anchor"',
        );
        for (const featureHook of [
            'data-sot-control="dashboard-search"',
            'data-sot-panel="library-search"',
            'data-sot-control="library-search-input"',
            'data-sot-control="library-search-clear"',
            'data-sot-part="library-search-scope"',
            'data-sot-control="library-search-retry"',
            'data-sot-control="library-search-result"',
            'data-sot-part="library-search-tag-chip"',
        ]) {
            expect(dashboardSearchSlice).toContain(featureHook);
        }
        for (const compositionToken of [
            "<Button",
            "<Card",
            "<CardContent",
            "<InputGroup",
            "<InputGroupInput",
            "<InputGroupButton",
            "<ToggleGroup",
            "<ToggleGroupItem",
            "<Alert",
            "<Badge",
        ]) {
            expect(dashboardSearchSlice).toContain(compositionToken);
        }
        const dashboardActivitySlice = extractBoundedSlice(
            workstation,
            'data-sot-part="dashboard-activity-anchor"',
            '<Button\n                            asChild\n                            variant="ghost"',
        );
        for (const featureHook of [
            'data-sot-control="dashboard-activity"',
            'data-sot-panel="dashboard-activity"',
            'data-sot-part="dashboard-activity-count"',
            'data-sot-control="dashboard-activity-close"',
            'data-sot-control="dashboard-activity-sync"',
            'data-sot-control="dashboard-activity-action"',
            'data-sot-control="dashboard-activity-dismiss"',
            'data-sot-list="dashboard-activity-items"',
        ]) {
            expect(dashboardActivitySlice).toContain(featureHook);
        }
        for (const compositionToken of [
            "<Button",
            "<Card",
            "<CardHeader",
            "<CardTitle",
            "<CardContent",
            "<CardAction",
            "<Badge",
        ]) {
            expect(dashboardActivitySlice).toContain(compositionToken);
        }
        const dashboardSearchActivityClassNames =
            extractDashboardSearchActivityClassNames(workstation);
        for (const {
            propertyName,
            snippets,
        } of DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_CLASS_SNIPPETS) {
            const property = extractObjectStringProperty(
                dashboardSearchActivityClassNames,
                propertyName,
            );

            for (const snippet of snippets) {
                expect(property).toContain(snippet);
            }
        }
        for (const {
            propertyName,
            snippets,
        } of DASHBOARD_SEARCH_ACTIVITY_SOT_BODY_FORBIDDEN_CLASS_SNIPPETS) {
            const property = extractObjectStringProperty(
                dashboardSearchActivityClassNames,
                propertyName,
            );

            for (const snippet of snippets) {
                expect(property).not.toContain(snippet);
            }
        }
        for (const snippet of DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_SOURCE_SNIPPETS) {
            expect(workstation).toContain(snippet);
        }
        const dashboardFavoriteButton = extractBoundedSlice(
            workstation,
            'data-sot-control="dashboard-favorite"',
            'data-sot-part="dashboard-favorite-label"',
        );
        const dashboardFavoriteButtonOpening = extractOpeningElement(
            workstation,
            'data-sot-control="dashboard-favorite"',
            "Button",
        );
        expect(dashboardFavoriteButtonOpening).toContain('variant="ghost"');
        expect(dashboardFavoriteButtonOpening).toContain('size="default"');
        expectCnClassNameReferences(dashboardFavoriteButtonOpening, [
            "dashboardButtonClassNames.nav",
            "dashboardSidebarCollapseClassNames.favorite",
        ]);
        const dashboardButtonClassNames = extractBoundedSlice(
            workstation,
            "const dashboardButtonClassNames = {",
            "} as const;",
        );
        const dashboardNavButtonClassName = extractObjectStringProperty(
            dashboardButtonClassNames,
            "nav",
        );
        expect(workstation).toContain("const DASHBOARD_ICON_CLASS_NAME =");
        expect(workstation).toContain(
            "size-4 flex-none fill-none stroke-current stroke-[1.8]",
        );
        expect(workstation).toContain("className={DASHBOARD_ICON_CLASS_NAME}");
        expect(dashboardNavButtonClassName).toContain(
            "data-[sot-state=selected]:text-foreground",
        );
        const dashboardFavoriteCount = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-favorite-count"',
            "span",
        );
        expect(dashboardFavoriteCount).toContain(
            "dashboardNavClassNames.favoriteCount",
        );
        expect(dashboardFavoriteCount).toContain(
            "data-sot-state={\n                                        favorite === item.value",
        );
        const dashboardNavSectionLabel = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-nav-section-label"',
            "div",
        );
        expect(dashboardNavSectionLabel).toContain(
            "dashboardNavClassNames.sectionLabel",
        );
        expect(dashboardFavoriteButton).toContain(
            "className={DASHBOARD_ICON_CLASS_NAME}",
        );
        const dashboardActivityDismissButton = extractBoundedSlice(
            workstation,
            'data-sot-control="dashboard-activity-dismiss"',
            "</Button>",
        );
        expect(dashboardActivityDismissButton).toMatch(
            /className=\{\s*DASHBOARD_MICRO_ICON_CLASS_NAME\s*\}/,
        );
        const dashboardActivityStatusSub = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-activity-status-sub"',
            "div",
        );
        expect(dashboardActivityStatusSub).toContain('data-sot-format="mono"');
        expect(dashboardActivityStatusSub).toContain(
            "dashboardSearchActivityClassNames.dashboardActivityStatusSub",
        );
        expect(
            extractObjectStringProperty(
                dashboardSearchActivityClassNames,
                "dashboardActivityStatusSub",
            ),
        ).toContain("[font:500_11px_var(--font-mono)]");
        expect(globals).not.toContain(
            '[data-sot-part="dashboard-activity-status-sub"]',
        );
        expect(workstation).toContain('data-sot-control="dashboard-settings"');
        expect(workstation).toContain('data-sot-part="dashboard-user-avatar"');
        expect(workstation).toMatch(
            /<Button\s+asChild\s+variant="ghost"\s+size="icon"\s+className=\{dashboardButtonClassNames\.settingsAvatar\}[\s\S]*>\s*<button[\s\S]*data-sot-control="dashboard-settings"[\s\S]*data-sot-part="dashboard-user-avatar"/,
        );
        expect(globals).not.toContain(
            '[data-sot-control="dashboard-settings"][data-sot-part="dashboard-user-avatar"]',
        );
        for (const primitiveSelector of [
            '[data-sot-control="sidebar-collapse"][data-slot="button"]',
            '[data-sot-control="dashboard-favorite"][data-slot="button"]',
            '[data-sot-control="dashboard-source-provider"][data-slot="button"]',
            '[data-sot-control="dashboard-sync"][data-slot="button"]',
            '[data-sot-control="dashboard-settings"][data-slot="button"]',
        ]) {
            expect(globals).not.toContain(primitiveSelector);
        }
        expect(workstation).not.toMatch(
            /className\s*=\s*(?:["'](?:mono|avatar)["']|\{["'](?:mono|avatar)["']\})/,
        );
        expect(workstation).toContain(
            'data-empty={selectedRecording ? "false" : "true"}',
        );
        expect(workstation).toContain(
            'data-sot-panel="dashboard-retranscription"',
        );
        expect(workstation).toContain("data-retx-state={dashboardRetxState}");
        expect(workstation).toContain(
            'import { Spinner } from "@/components/ui/spinner";',
        );
        expect(workstation).toContain("<Spinner");
        expect(workstation).toContain('size="xs"');
        expect(workstation).not.toContain(
            '<span data-sot-part="dashboard-retranscription-spinner" />',
        );
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-part="dashboard-retranscription-spinner"]',
            ),
        ).toEqual([]);
        const dashboardRetranscriptionClassNames = extractBoundedSlice(
            workstation,
            "const dashboardRetranscriptionClassNames = {",
            "} as const;",
        );
        const dashboardRetranscriptionThemeClassName = extractBoundedSlice(
            workstation,
            "const dashboardRetranscriptionThemeClassName =",
            ";",
        );
        for (const snippet of DASHBOARD_RETRANSCRIPTION_OWNER_CLASS_SNIPPETS) {
            expect(dashboardRetranscriptionClassNames).toContain(snippet);
        }
        for (const snippet of DASHBOARD_RETRANSCRIPTION_THEME_CLASS_SNIPPETS) {
            expect(dashboardRetranscriptionThemeClassName).toContain(snippet);
        }
        const dashboardRetranscriptionDisabledHint = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-retranscription-disabled-hint"',
            "span",
        );
        expectClassNameConstReference(
            dashboardRetranscriptionDisabledHint,
            "dashboardRetranscriptionClassNames.disabledHint",
        );
        expect(dashboardRetranscriptionDisabledHint).toMatch(
            /hidden=\{\s*detailTab !== "transcript"\s*\|\|\s*dashboardRetxState !== "unavailable"\s*\}/,
        );
        const dashboardRetranscriptionBanner = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-retranscription"',
            "div",
        );
        expectClassNameConstReference(
            dashboardRetranscriptionBanner,
            "dashboardRetranscriptionClassNames.banner",
        );
        expect(dashboardRetranscriptionBanner).toContain(
            "data-retx-state={dashboardRetxState}",
        );
        expect(dashboardRetranscriptionBanner).toMatch(
            /hidden=\{\s*dashboardRetxState === "idle"\s*\|\|\s*dashboardRetxState === "unavailable"\s*\}/,
        );
        expectClassNameConstReference(
            extractOpeningElement(
                workstation,
                'data-sot-part="dashboard-retranscription-icon"',
                "span",
            ),
            "dashboardRetranscriptionClassNames.icon",
        );
        expectClassNameConstReference(
            extractOpeningElement(
                workstation,
                'data-sot-part="dashboard-retranscription-body"',
                "div",
            ),
            "dashboardRetranscriptionClassNames.body",
        );
        const dashboardRetranscriptionRefreshMarker = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-retranscription-refresh-marker"',
            "p",
        );
        expectClassNameConstReference(
            dashboardRetranscriptionRefreshMarker,
            "dashboardRetranscriptionClassNames.refreshMarker",
        );
        expect(dashboardRetranscriptionRefreshMarker).toContain(
            'hidden={dashboardRetxState !== "completed"}',
        );
        expect(workstation).toContain('dashboardRetxState === "failed" ? (');
        expect(workstation).toContain('dashboardRetxState === "completed" &&');
        expect(workstation).toContain('data-retx-retry=""');
        expect(workstation).toContain('data-retx-dismiss=""');
        expect(globals).not.toMatch(
            DASHBOARD_RETRANSCRIPTION_GLOBAL_TOKEN_DEFINITION_RE,
        );
        expect(dashboardRetranscriptionClassNames).not.toMatch(
            DASHBOARD_RETRANSCRIPTION_OWNER_DIRECT_COLOR_RE,
        );
        for (const usage of DASHBOARD_RETRANSCRIPTION_OWNER_CLASS_USAGES) {
            expect(workstation).toContain(usage);
        }
        const retxGlobalRepaintBlocks =
            DASHBOARD_RETRANSCRIPTION_REPAINT_CSS_SELECTORS.flatMap(
                (selector) =>
                    collectCssRuleBlocks(globals, selector).filter(
                        ({ declarations }) =>
                            DASHBOARD_RETRANSCRIPTION_GLOBAL_REPAINT_DECLARATION_RE.test(
                                declarations,
                            ),
                    ),
            );
        expect(retxGlobalRepaintBlocks).toEqual([]);
        for (const removedGlobalDisplaySelector of DASHBOARD_RETRANSCRIPTION_REMOVED_GLOBAL_DISPLAY_SELECTORS) {
            expect(
                collectCssRuleBlocks(globals, removedGlobalDisplaySelector),
            ).toEqual([]);
        }
        for (const hook of DASHBOARD_RETRANSCRIPTION_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const className of DASHBOARD_RETRANSCRIPTION_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toMatch(
                new RegExp(`className=\\{?["']${className}["']\\}?`),
            );
        }
        expect(workstation).toContain('aria-label="详情标签"');
        expect(dashboardRecordingPlayerControls).toContain(
            'aria-label={isPlaying ? "暂停" : "播放"}',
        );
        expect(dashboardRecordingPlayerControls).toContain(
            'data-sot-control="dashboard-player-play"',
        );
        expect(workstation).toContain('data-sot-part="dashboard-copy-label"');
        expect(workstation).not.toContain('className="copy-label"');
        expect(workstation).not.toContain('className="play rounded-full"');
        expect(workstation).toContain("<SettingsDialog");
        expect(workstation).not.toMatch(OLD_UI_RE);
        expect(workstation).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps source rows, stacked filters, list modes, and detail tabs wired in the workstation", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const dashboardRecordingPlayerControls = readSource(
            "features/dashboard/components/dashboard-recording-player-controls.tsx",
        );
        const badgePrimitive = readSource("components/ui/badge.tsx");
        const sotPlayerPrimitives = readSource(
            "features/recordings/components/sot-player-primitives.tsx",
        );
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const cardPrimitive = readSource("components/ui/card.tsx");
        const globals = readSource("app/globals.css");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const sourceReportStyles = readSource(
            "features/source-report/styles.ts",
        );
        const toggleGroupPrimitive = readSource(
            "components/ui/toggle-group.tsx",
        );

        for (const provider of [
            "dingtalk-a1",
            "ticnote",
            "plaud",
            "feishu-minutes",
            "iflyrec",
        ]) {
            expect(workstation).toContain(provider);
        }

        expect(workstation).not.toContain('className="panel list-panel"');
        const recordingListCard = extractBoundedSlice(
            workstation,
            "<Card\n                        hasNoPadding",
            'data-sot-part="dashboard-recording-list-header"',
        );
        const recordingListCardClassName = expectExactStringConstInitializer(
            workstation,
            "DASHBOARD_RECORDING_LIST_CARD_CLASS_NAME",
            EXPECTED_DASHBOARD_RECORDING_LIST_CARD_CLASS_NAME,
        );
        expect(recordingListCard).toContain(
            "className={DASHBOARD_RECORDING_LIST_CARD_CLASS_NAME}",
        );
        expect(recordingListCardClassName).not.toMatch(
            OWNER_WORKSPACE_FORBIDDEN_CLASS_RE,
        );
        expect(recordingListCard).toContain(
            'data-sot-surface="dashboard-recording-list"',
        );
        expectClassNameConstReference(
            recordingListCard,
            "DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME",
        );
        expect(recordingListCard).toContain(
            'data-sot-part="dashboard-recording-list-content"',
        );
        const recordingListHeader = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-header"',
            "div",
        );
        const recordingListHeaderClass = expectExactStringConstInitializer(
            workstation,
            "DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME",
            EXPECTED_DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME,
        );
        expectClassNameConstReference(
            recordingListHeader,
            "DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME",
        );
        expect(recordingListHeaderClass).not.toMatch(
            DASHBOARD_RECORDING_LIST_HEADER_FORBIDDEN_CLASS_PATTERN,
        );
        for (const selector of DASHBOARD_WORKSPACE_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).not.toContain(
            '[data-sot-panel="dashboard-detail"],\n[data-sot-panel="recording-workstation-detail"],\n[data-sot-panel="recording-workstation-detail-body"]',
        );
        expect(workstation).toContain(
            "const DASHBOARD_DETAIL_PANEL_CLASS_NAME =",
        );
        for (const selector of DASHBOARD_SIDEBAR_FOOTER_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        const dashboardSidebarFooter = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-sidebar-footer"',
            "div",
        );
        const dashboardSidebarFooterClass = expectExactStringConstInitializer(
            workstation,
            "DASHBOARD_SIDEBAR_FOOTER_CLASS_NAME",
            EXPECTED_DASHBOARD_SIDEBAR_FOOTER_CLASS_NAME,
        );
        expectClassNameConstReference(
            dashboardSidebarFooter,
            "DASHBOARD_SIDEBAR_FOOTER_CLASS_NAME",
        );
        expect(dashboardSidebarFooterClass).not.toMatch(
            DASHBOARD_RECORDING_LIST_HEADER_FORBIDDEN_CLASS_PATTERN,
        );
        expect(globals).not.toMatch(
            DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_RE,
        );
        for (const selector of DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(workstation).toContain('data-sot-list="dashboard-sources"');
        expect(workstation).not.toContain("sourceProviderThemeClassName");
        expect(workstation).not.toMatch(/--source-provider-(?:status|primary)-/);
        expect(workstation).toContain(
            'className={cn(\n                "group/dashboard-workstation"',
        );
        expect(workstation).toContain("dashboardSourceErrorClassName");
        expect(workstation).toContain(
            'data-sot-control="dashboard-source-clear"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-source-provider"',
        );
        expect(workstation).toContain('data-sot-part="source-provider-label"');
        expect(workstation).toContain('data-sot-part="source-provider-status"');
        const dashboardSourceClearButton = extractOpeningElement(
            workstation,
            'data-sot-control="dashboard-source-clear"',
            "Button",
        );
        const sourceProviderRows = extractBoundedSlice(
            workstation,
            "{sourceRows.map((item) => {",
            'data-sot-panel="dashboard-sync"',
        );
        const featureOwnerClassSource =
            collectFeatureOwnerClassSource(workstation);
        const sourceProviderToneHelpers = extractBoundedSlice(
            workstation,
            "function sourceProviderStatusTone",
            "const syncButtonState",
        );
        const sourceProviderStatusBadge = extractOpeningElement(
            sourceProviderRows,
            'data-sot-part="source-provider-status"',
            "Badge",
        );
        const sourceProviderCountBadge = extractOpeningElement(
            sourceProviderRows,
            'data-sot-part="source-provider-count"',
            "Badge",
        );
        const sourceProviderRowButton = extractOpeningElement(
            sourceProviderRows,
            'data-sot-control="dashboard-source-provider"',
            "Button",
        );
        const sourceProviderActionButton = extractOpeningElement(
            sourceProviderRows,
            'data-sot-part="source-provider-action"',
            "Button",
        );
        expectPrimitiveToExcludeBusinessTokens(
            buttonPrimitive,
            DASHBOARD_SOURCE_FILTER_BUTTON_PRIMITIVE_FORBIDDEN_TOKENS,
        );
        expectPrimitiveToExcludeBusinessTokens(
            badgePrimitive,
            DASHBOARD_SOURCE_FILTER_BADGE_PRIMITIVE_FORBIDDEN_TOKENS,
        );
        for (const snippet of DASHBOARD_SOURCE_FILTER_FEATURE_OWNER_CLASS_SNIPPETS) {
            expect(featureOwnerClassSource).toContain(snippet);
        }
        expect(dashboardSourceClearButton).toMatch(
            /className=\{\s*dashboardSourceClassNames\.clear\s*\}/,
        );
        expect(sourceProviderRowButton).toMatch(
            /className=\{\s*dashboardSourceButtonClassName\(\s*sourceRowCollapsed,?\s*\)\s*\}/,
        );
        expect(sourceProviderStatusBadge).toMatch(
            /className=\{cn\(\s*dashboardSourceClassNames\.status\b/,
        );
        expect(sourceProviderActionButton).toMatch(
            /className=\{\s*dashboardSourceClassNames\.action\s*\}/,
        );
        expect(sourceProviderCountBadge).toMatch(
            /className=\{cn\(\s*dashboardSourceClassNames\.count\b/,
        );
        expect(sourceProviderRows).toContain("sourceProviderStatusTone(");
        expect(sourceProviderRows).toContain("sourceProviderCountTone(");
        for (const mappingSnippet of [
            'case "connected-active":',
            'case "connected-idle":',
            'return "ok";',
            'case "syncing":',
            'return "syncing";',
            'case "sync-error":',
            'return "err";',
            'case "disabled":',
            'return "disabled";',
            'return "active";',
            'return "empty";',
            'return "neutral";',
        ]) {
            expect(sourceProviderToneHelpers).toContain(mappingSnippet);
        }
        expect(sourceProviderRows).toContain("sourceRowCollapsed");
        expect(featureOwnerClassSource).toContain(
            '"justify-center gap-0 px-0 py-2"',
        );
        expect(sourceProviderRows).toContain('"absolute bottom-1 right-1"');
        expect(sourceProviderStatusBadge).toContain(
            "data-sot-tone={sourceStatusTone}",
        );
        expect(sourceProviderCountBadge).toContain(
            "data-sot-tone={sourceCountTone}",
        );
        for (const migratedSourceProviderSelector of [
            '[data-sot-control="dashboard-source-provider"][data-sot-state="sync-error"]',
            '[data-sot-part="source-provider-mark"]',
            '[data-sot-part="source-provider-status"]',
            '[data-sot-part="source-provider-count"]',
        ]) {
            expect(
                collectCssRuleBlocks(globals, migratedSourceProviderSelector),
            ).toEqual([]);
        }
        expect(workstation).toContain("sourceRowDisabled(");
        expect(workstation).toContain("sourceActionKind(");
        expect(workstation).toContain("disabled={disabledSourceRow}");
        expect(workstation).toContain('data-sot-part="source-provider-action"');
        expect(workstation).toContain("data-sot-action={actionKind}");
        expect(workstation).toContain('? "retry-sync"');
        expect(sourceProviderRows).toContain("aria-label={actionAriaLabel}");
        expect(sourceProviderRows).toContain("event.stopPropagation();");
        expect(sourceProviderRows).toContain("event.preventDefault();");
        expect(sourceProviderRows).toContain("void runManualSync();");
        expect(globals).not.toContain("source-provider-action");
        expect(workstation).not.toContain('className="src-action is-busy"');
        expect(workstation).toContain("data-sot-status={item.status}");
        expect(workstation).toContain("sourceNeedsSettings(");
        expect(workstation).toContain('openSettings("data-sources")');
        expect(workstation).toContain("const sourceFilterStackState =");
        expect(workstation).not.toMatch(
            /document\.body\.dataset\.(?:drawer|sourceFilter|sourceStatus|timeStyle|sidebar|collapsed)\b/,
        );
        expect(workstation).toContain(
            'data-drawer-state={drawerOpen ? "open" : "closed"}',
        );
        expect(workstation).toContain(
            'data-source-filter-active={source === "all" ? "false" : "true"}',
        );
        expect(workstation).toContain(
            'data-source-filter-provider={source === "all" ? undefined : source}',
        );
        expect(workstation).toContain(
            "data-source-filter-state={sourceFilterStackState}",
        );
        expect(workstation).toContain(
            "data-source-status={selectedSourceRow?.status ?? undefined}",
        );
        expect(workstation).toContain('data-time-style="rel"');
        const drawerTriggerClassNames = extractObjectStringProperty(
            extractBoundedSlice(
                workstation,
                "const dashboardButtonClassNames = {",
                "} as const;",
            ),
            "drawerTrigger",
        );
        const sidebarClassNames = extractObjectStringProperty(
            extractBoundedSlice(
                workstation,
                "const dashboardSidebarCollapseClassNames = {",
                "} as const;",
            ),
            "sidebar",
        );
        const drawerClassNames = extractBoundedSlice(
            workstation,
            "const dashboardDrawerClassNames = {",
            "} as const;",
        );
        const drawerScrimClassNames = extractObjectStringProperty(
            drawerClassNames,
            "scrim",
        );
        const drawerActiveDotClassNames = extractObjectStringProperty(
            drawerClassNames,
            "activeDot",
        );
        const drawerScrim = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-drawer-scrim"',
            "div",
        );
        expect(drawerTriggerClassNames).toContain(
            "group-data-[source-filter-active=true]/dashboard-workstation:[&_[data-sot-part=dashboard-drawer-active-dot]]:inline-block",
        );
        expect(sidebarClassNames).toContain("max-[860px]:hidden");
        expect(sidebarClassNames).toContain(
            "max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:flex",
        );
        expect(drawerScrimClassNames).toContain(
            "max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:pointer-events-auto",
        );
        expect(drawerActiveDotClassNames).toContain(
            "absolute top-1.5 right-1.5 hidden",
        );
        expect(drawerScrim).toContain(
            "className={dashboardDrawerClassNames.scrim}",
        );
        expect(workstation).toContain(
            'data-sot-panel="dashboard-source-filter-stack"',
        );
        const sourceFilterStack = extractBoundedSlice(
            workstation,
            'data-sot-panel="dashboard-source-filter-stack"',
            "</output>",
        );
        const sourceFilterStackOutput = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-source-filter-stack"',
            "output",
        );
        const sourceFilterFrom = extractOpeningElement(
            sourceFilterStack,
            'data-sot-part="source-filter-from"',
            "span",
        );
        const sourceFilterSeparator = extractOpeningElement(
            sourceFilterStack,
            'data-sot-part="source-filter-separator"',
            "span",
        );
        const sourceFilterChip = extractOpeningElement(
            sourceFilterStack,
            'data-sot-part="source-filter-chip"',
            "span",
        );
        const sourceFilterInfo = extractOpeningElement(
            sourceFilterStack,
            'data-sot-part="source-filter-info"',
            "span",
        );
        const sourceFilterClearButton = extractOpeningElement(
            sourceFilterStack,
            'data-sot-control="source-filter-clear"',
            "Button",
        );
        const sourceFilterClearAllButton = extractOpeningElement(
            sourceFilterStack,
            'data-sot-control="source-filter-clear-all"',
            "Button",
        );
        expect(workstation).toMatch(
            /<output\s+aria-live="polite"[\s\S]*data-sot-panel="dashboard-source-filter-stack"[\s\S]*data-state=\{sourceFilterStackState\}/,
        );
        expect(sourceFilterStackOutput).toMatch(
            /className=\{\s*sourceFilterStackClassNames\.root\s*\}/,
        );
        expect(sourceFilterFrom).toMatch(
            /className=\{\s*sourceFilterStackClassNames\.from\s*\}/,
        );
        expect(sourceFilterSeparator).toMatch(
            /className=\{\s*sourceFilterStackClassNames\.separator\s*\}/,
        );
        expect(sourceFilterChip).toMatch(
            /className=\{\s*sourceFilterStackClassNames\.chip\s*\}/,
        );
        expect(sourceFilterInfo).toMatch(
            /className=\{\s*sourceFilterStackClassNames\.info\s*\}/,
        );
        for (const removedListHeaderClass of [
            'className="list-header"',
            'className="lh-titlebar"',
            'className="lh-title"',
            'className="lh-count"',
            'className="stack-strip"',
            'className="xref-strip"',
            'className="list-mode-bar"',
            'className="list-mode-seg"',
        ]) {
            expect(workstation).not.toContain(removedListHeaderClass);
        }
        expect(workstation).toContain('data-sot-control="source-filter-widen"');
        expect(workstation).toMatch(
            /<Button[\s\S]*data-sot-control="dashboard-source-clear"[\s\S]*onClick=\{\(\) => setSource\("all"\)\}/,
        );
        expect(workstation).toMatch(
            /<Button[\s\S]*data-sot-control="source-filter-clear"[\s\S]*onClick=\{\(\) => setSource\("all"\)\}/,
        );
        expect(sourceFilterClearButton).toMatch(
            /className=\{\s*sourceFilterClassNames\.clear\s*\}/,
        );
        const librarySearchFilterClearButton = extractOpeningElement(
            workstation,
            'data-sot-control="library-search-filter-clear"',
            "Button",
        );
        const librarySearchFilterClearElement = extractElementSlice(
            workstation,
            'data-sot-control="library-search-filter-clear"',
            "Button",
        );
        const librarySearchFilterOutput = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-library-search-filter"',
            "output",
        );
        const librarySearchFilterLabel = extractOpeningElement(
            workstation,
            'data-sot-part="library-search-filter-label"',
            "span",
        );
        const librarySearchFilterChip = extractOpeningElement(
            workstation,
            'data-sot-part="library-search-filter-chip"',
            "span",
        );
        const librarySearchFilterClearClassHelper =
            extractFeatureClassHelperSource(
                workstation,
                librarySearchFilterClearButton,
            );
        expect(librarySearchFilterOutput).toMatch(
            /className=\{\s*sourceFilterStackClassNames\.libraryRoot\s*\}/,
        );
        expect(librarySearchFilterLabel).toMatch(
            /className=\{\s*sourceFilterStackClassNames\.libraryLabel\s*\}/,
        );
        expect(librarySearchFilterChip).toMatch(
            /className=\{\s*sourceFilterStackClassNames\.chip\s*\}/,
        );
        expect(librarySearchFilterClearButton).toContain('variant="ghost"');
        expect(librarySearchFilterClearButton).toContain('size="icon"');
        expect(librarySearchFilterClearButton).toContain('type="button"');
        expect(librarySearchFilterClearButton).not.toContain(
            "recordingListChipClear",
        );
        expect(librarySearchFilterClearButton).toMatch(
            /className=\{\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?\s*\}/,
        );
        expect(librarySearchFilterClearButton).toContain(
            'data-sot-control="library-search-filter-clear"',
        );
        expect(librarySearchFilterClearButton).toMatch(
            /aria-label=\{t\([\s\S]*"dashboardChrome\.clear"[\s\S]*\)\}/,
        );
        expect(librarySearchFilterClearElement).toMatch(
            /onClick=\{\(\) =>\s*setLibrarySearchFilter\(null\)\s*\}/,
        );
        expect(librarySearchFilterClearElement).toMatch(
            /<X\s+data-icon="inline-start"\s*\/>/,
        );
        for (const snippet of RECORDING_LIST_CHIP_CLEAR_FEATURE_OWNER_CLASS_SNIPPETS) {
            expect(librarySearchFilterClearClassHelper).toContain(snippet);
        }
        for (const control of [
            "source-filter-retry-sync",
            "source-filter-widen",
            "source-filter-open-settings",
        ]) {
            const sourceFilterActionButton = extractOpeningElement(
                sourceFilterStack,
                `data-sot-control="${control}"`,
                "Button",
            );
            expect(sourceFilterActionButton).toMatch(
                /className=\{\s*sourceFilterClassNames\.action\s*\}/,
            );
            expect(workstation).toMatch(
                new RegExp(
                    `<Button[\\s\\S]*data-sot-control="${control}"[\\s\\S]*data-sot-part="source-filter-action"`,
                ),
            );
        }
        expect(workstation).toContain('data-sot-action="retry"');
        expect(workstation).toContain('data-sot-action="widen"');
        expect(workstation).toContain('data-sot-action="open-settings"');
        expect(globals).not.toContain(
            '[data-sot-action="source-filter-action"]',
        );
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-part="source-filter-action"]',
            ),
        ).toEqual([]);
        for (const selector of DASHBOARD_SOURCE_FILTER_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(workstation).toMatch(
            /<Button[\s\S]*data-sot-control="source-filter-clear-all"[\s\S]*onClick=\{\(\) => setSource\("all"\)\}/,
        );
        expect(sourceFilterClearAllButton).toMatch(
            /className=\{\s*sourceFilterClassNames\.clearAll\s*\}/,
        );
        expect(workstation).toContain("<ToggleGroup");
        expect(workstation).toContain("<ToggleGroupItem");
        expect(workstation).toContain(
            'data-sot-panel="dashboard-recording-time-filter"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-recording-time-filter"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-time-filter-count"',
        );
        expect(workstation).toContain(
            "const dashboardRecordingTimeFilterStyles = {",
        );
        expect(workstation).toContain(
            "function dashboardRecordingTimeFilterCountClassName(active: boolean)",
        );
        const recordingTimeFilter = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-recording-time-filter"',
            "ToggleGroup",
        );
        expect(recordingTimeFilter).toContain("value={timelineFilter}");
        expect(recordingTimeFilter).toContain("spacing={1}");
        expect(recordingTimeFilter).toContain('variant="outline"');
        expect(recordingTimeFilter).toContain('size="sm"');
        expect(recordingTimeFilter).toContain(
            "dashboardRecordingTimeFilterStyles.root",
        );
        const recordingTimeFilterStyles = extractBoundedSlice(
            workstation,
            "const dashboardRecordingTimeFilterStyles = {",
            "} as const;",
        );
        expect(recordingTimeFilterStyles).toContain(
            'root: "mt-2.5 flex-wrap [&[hidden]]:hidden"',
        );
        expect(recordingTimeFilter).toContain(
            'hidden={listMode !== "timeline"}',
        );
        expect(recordingTimeFilter).toContain(
            'listMode !== "timeline"\n                                            ? true',
        );
        expect(workstation).toContain("setTimelineFilter(");
        expect(recordingTimeFilter).not.toContain("layout=");
        expect(recordingTimeFilter).not.toContain(
            'dashboardRecordingTimeFilter"',
        );
        const recordingTimeFilterItem = extractOpeningElement(
            workstation,
            'data-sot-control="dashboard-recording-time-filter"',
            "ToggleGroupItem",
        );
        expect(recordingTimeFilterItem).toContain("aria-pressed={active}");
        expect(recordingTimeFilterItem).toContain("data-tf={item.value}");
        expect(recordingTimeFilterItem).toContain(
            "data-sot-filter={item.value}",
        );
        expect(recordingTimeFilterItem).toContain(
            "dashboardRecordingTimeFilterStyles.item",
        );
        expect(recordingTimeFilterItem).toContain(
            'data-sot-state={\n                                                    active ? "selected" : "idle"',
        );
        const recordingTimeFilterCount = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-time-filter-count"',
            "span",
        );
        expect(recordingTimeFilterCount).toContain(
            "dashboardRecordingTimeFilterCountClassName(",
        );
        expect(workstation).toContain("{timelineCounts[item.value]}");
        expect(workstation).toContain(
            "dashboardRecordingTimeFilterStyles.countSelected",
        );
        expect(toggleGroupPrimitive).not.toContain(
            "dashboardRecordingTimeFilter",
        );
        expect(toggleGroupPrimitive).not.toContain(
            "data-sot-part=dashboard-recording-time-filter-count",
        );
        expect(toggleGroupPrimitive).not.toContain(
            "dashboard-recording-time-filter-count",
        );
        expect(globals).not.toContain(
            "--dashboard-recording-time-filter-count-bg",
        );
        expect(globals).not.toContain(
            "--dashboard-recording-time-filter-count-selected-bg",
        );
        expect(globals).not.toContain(
            '[data-sot-panel="dashboard-recording-time-filter"][hidden]',
        );
        expect(workstation).toContain("data-tag-filter-trigger");
        expect(workstation).toContain("data-tag-filter-list");
        const tagFilterStyles = extractBoundedSlice(
            workstation,
            "const dashboardRecordingTagFilterStyles = {",
            "} as const;",
        );
        for (const snippet of DASHBOARD_RECORDING_TAG_FILTER_FEATURE_OWNER_CLASS_SNIPPETS) {
            expect(tagFilterStyles).toContain(snippet);
        }
        expect(workstation).toMatch(
            /<div\s+className=\{\s*dashboardRecordingTagFilterStyles\.root\s*\}[\s\S]*data-list-filter-row="tags"[\s\S]*data-sot-panel="recording-list-tag-filter"[\s\S]*hidden=\{listMode !== "tags"\}[\s\S]*ref=\{tagFilterRef\}/,
        );
        expect(workstation).toMatch(
            /<div\s+className=\{\s*dashboardRecordingTagFilterStyles\.list\s*\}[\s\S]*role="listbox"[\s\S]*data-tag-filter-list=""[\s\S]*data-sot-list="recording-list-tag-filter-list"/,
        );
        expect(workstation).toMatch(
            /<Button\s+variant="outline"\s+size="sm"\s+className=\{\s*dashboardRecordingTagFilterStyles\.trigger\s*\}[\s\S]*type="button"[\s\S]*aria-haspopup="listbox"[\s\S]*aria-expanded=\{\s*tagFilterOpen\s*\}[\s\S]*data-tag-filter-trigger=""[\s\S]*data-sot-control="recording-list-tag-filter-trigger"[\s\S]*onClick=\{\(\) =>\s*setTagFilterOpen\(\(open\) => !open\)\s*\}/,
        );
        for (const [slot, hook] of [
            ["label", 'data-sot-part="recording-list-tag-filter-label"'],
            ["count", 'data-sot-part="recording-list-tag-filter-count"'],
            ["caret", 'data-sot-part="recording-list-tag-filter-caret"'],
            [
                "optionLabel",
                'data-sot-part="recording-list-tag-filter-option-label"',
            ],
            [
                "optionCount",
                'data-sot-part="recording-list-tag-filter-option-count"',
            ],
        ] as const) {
            expect(workstation).toMatch(
                new RegExp(
                    `className=\\{\\s*dashboardRecordingTagFilterStyles\\.${slot}\\s*\\}[\\s\\S]*${hook}`,
                ),
            );
        }
        expect(workstation).toMatch(
            /<Button\s+variant="ghost"\s+size="sm"\s+className=\{\s*dashboardRecordingTagFilterStyles\.option\s*\}[\s\S]*type="button"[\s\S]*role="option"[\s\S]*data-tag-value=\{\s*option\.value\s*\}[\s\S]*aria-selected=\{\s*active\s*\}[\s\S]*data-sot-control="recording-list-tag-filter"[\s\S]*data-sot-state=\{\s*active\s*\?\s*"selected"\s*:\s*"idle"\s*\}[\s\S]*onClick=\{\(\) => \{[\s\S]*setSelectedTagFilter\(\s*option\.value,?\s*\);[\s\S]*setTagFilterOpen\(false\);[\s\S]*\}\}/,
        );
        for (const migratedSelector of DASHBOARD_RECORDING_TAG_FILTER_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, migratedSelector)).toEqual([]);
        }
        expect(globals).not.toContain(
            '[data-sot-panel="recording-list-tag-filter"][hidden]',
        );
        expect(workstation).not.toMatch(
            /variant=\{\s*active\s*\?\s*"secondary"\s*:\s*"ghost"\s*\}/,
        );
        for (const hook of DASHBOARD_RECORDING_LIST_BATCH_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const legacyClassName of DASHBOARD_RECORDING_LIST_BATCH_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toContain(
                staticJsxClassName(legacyClassName),
            );
        }
        const dashboardRecordingListResidualClassSource = extractBoundedSlice(
            workstation,
            "const dashboardRecordingListTitlebarStyles = {",
            "const dashboardSearchActivityClassNames = {",
        );
        for (const migratedSelector of DASHBOARD_RECORDING_LIST_RESIDUAL_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, migratedSelector)).toEqual([]);
        }
        for (const ownerClassRef of DASHBOARD_RECORDING_LIST_RESIDUAL_OWNER_CLASS_REFS) {
            expect(workstation).toContain(ownerClassRef);
        }
        for (const ownerClassToken of [
            "flex items-center gap-2.5",
            "m-0 font-sans text-[13px] font-semibold text-foreground",
            "ml-auto font-mono text-[11.5px] font-medium text-muted-foreground",
            "[scrollbar-width:thin]",
            "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/55",
            "flex-1 overflow-y-auto p-1",
            "m-2 flex flex-col items-center gap-1.5",
            "relative mt-1.5 mb-[14px] h-px",
        ]) {
            expect(dashboardRecordingListResidualClassSource).toContain(
                ownerClassToken,
            );
        }
        expect(workstation).toMatch(
            /className=\{\s*dashboardRecordingListScrollClassName\s*\}[\s\S]*data-sot-list="dashboard-recording-list-scroll"/,
        );
        expect(workstation).toMatch(
            /className=\{\s*dashboardRecordingListTitlebarStyles\.root\s*\}[\s\S]*data-sot-part="dashboard-recording-list-titlebar"/,
        );
        expect(workstation).toMatch(
            /className=\{\s*dashboardRecordingListTitlebarStyles\.title\s*\}[\s\S]*data-sot-part="dashboard-recording-list-title"/,
        );
        expect(workstation).toMatch(
            /className=\{\s*dashboardRecordingListTitlebarStyles\.count\s*\}[\s\S]*data-sot-part="dashboard-recording-list-count"/,
        );
        expect(workstation).toMatch(
            /dashboardScrollbarClassName[\s\S]*data-sot-part="dashboard-transcript-body"/,
        );
        expect(workstation).toContain("tagFilterValue(tag.id)");
        expect(workstation).toContain('"untagged"');
        expect(workstation).toContain("displayTag?: RecordingTag");
        expect(workstation).toContain("displayTag: tag");
        expect(workstation).toContain("entry.displayTag ??");
        expect(workstation).toContain("<SotPlayerTagChip");
        expect(sotPlayerPrimitives).toContain("data-recording-tag-chip");
        const dashboardRecordingTagChip = extractOpeningElement(
            workstation,
            "<SotPlayerTagChip",
            "SotPlayerTagChip",
        );
        expect(dashboardRecordingTagChip).toMatch(/tag=\{\s*primaryTag\s*\}/);
        expect(dashboardRecordingTagChip).not.toContain("variant=");
        expect(dashboardRecordingTagChip).not.toContain("className=");
        expect(sotPlayerPrimitives).toContain("RecordingTagIconGlyph");
        expect(badgePrimitive).not.toContain(
            DASHBOARD_OWNER_LOCAL_FORBIDDEN_VARIANT_PROPS[4],
        );
        expect(globals).not.toContain(
            '[data-recording-tag-chip][data-variant="recordingTagChip"]',
        );
        expect(globals).not.toContain(
            '[data-recording-tag-chip][data-variant="outline"]',
        );
        expect(workstation).not.toContain("<RecordingTagIconGlyph");
        expect(workstation).toContain("data-rec={");
        expect(workstation).not.toContain("function tagClass(");
        expect(workstation).toContain("function SotRecordingListSkeleton()");
        expect(workstation).toContain("<Skeleton");
        expect(workstation).toContain(
            'data-sot-panel="recording-list-loading"',
        );
        expect(workstation).toContain('data-sot-part="skeleton-row"');
        expect(workstation).toContain('data-sot-part="skeleton-title"');
        expect(workstation).not.toContain('className="skel-list"');
        expect(workstation).not.toContain('className="day skel-day"');
        expect(workstation).not.toContain('className="row skel-row"');
        expect(workstation).not.toContain('className="sk sk-title"');
        expect(workstation).not.toContain(staticJsxClassName("filter-row"));
        expect(workstation).not.toContain('"chip-f"');
        expect(workstation).not.toContain('"chip-f active"');
        expect(workstation).not.toContain('className="chip-c"');
        expect(workstation).not.toContain('className="row"');
        expect(workstation).not.toContain('className="real-list"');
        expect(workstation).not.toContain('"row active"');
        expect(workstation).not.toContain('className="body"');
        expect(workstation).not.toContain('className="title"');
        expect(workstation).not.toContain('className="meta"');
        expect(workstation).not.toContain('className="dur"');
        expect(workstation).not.toContain('className="right"');
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-body"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-title"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-meta"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-duration"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-actions"',
        );
        expect(workstation).toContain(
            'data-sot-panel="dashboard-detail-empty"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-detail-empty-title"',
        );
        expect(workstation).not.toContain('className="detail-empty"');
        expect(workstation).not.toContain('className="detail-empty-ico"');
        expect(workstation).not.toContain('className="detail-empty-title"');
        expect(workstation).not.toContain('className="detail-empty-sub"');
        expect(workstation).toContain("aria-current={");
        expect(workstation).not.toContain("data-selected=");
        expect(workstation).toContain('listState === "loading"');
        expect(workstation).toContain("<SotRecordingListSkeleton />");
        expect(workstation).toContain("function getRecordingListStatus(");
        expect(workstation).toContain(
            'data-sot-list="dashboard-recording-rows"',
        );
        const dashboardRecordingRows = extractOpeningElement(
            workstation,
            'data-sot-list="dashboard-recording-rows"',
            "div",
        );
        const dashboardRecordingListGroup = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group"',
            "div",
        );
        const dashboardRecordingListGroupSeparator = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group-separator"',
            "Separator",
        );
        const dashboardRecordingListHeading = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group-heading"',
            "div",
        );
        const dashboardRecordingListLabel = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group-label"',
            "span",
        );
        const dashboardRecordingListCount = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group-count"',
            "span",
        );
        const dashboardRecordingListDivider = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-group-divider"',
            "Separator",
        );
        const dashboardRecordingRowBody = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-body"',
            "div",
        );
        const dashboardRecordingRowTitle = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-title"',
            "div",
        );
        const dashboardRecordingRowMeta = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-meta"',
            "div",
        );
        const dashboardRecordingRowSecondary = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-secondary"',
            "div",
        );
        const dashboardRecordingRowActions = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-actions"',
            "div",
        );

        const dashboardRecordingRowStyleHelper = extractBoundedSlice(
            workstation,
            "const dashboardRecordingRowStyles = {",
            "function tagFilterValue",
        );
        for (const rowStyleSlot of [
            "rows:",
            "group:",
            "groupSeparator:",
            "groupHeading:",
            "groupLabel:",
            "groupCount:",
            "groupDivider:",
            "row:",
            "body:",
            "title:",
            "meta:",
            "sourceMark:",
            "sourceMarkImage:",
            "sourceMarkImageCover:",
            "sourceMarkLetter:",
            "duration:",
            "secondary:",
            "timestamp:",
            "timestampAbsolute:",
            "timestampRelative:",
            "actions:",
        ]) {
            expect(dashboardRecordingRowStyleHelper).toContain(rowStyleSlot);
        }
        for (const rowStateToken of [
            "data-[sot-state=selected]:",
            "[&.is-hover-demo]:",
            "[&.is-focus-demo]:",
        ]) {
            expect(dashboardRecordingRowStyleHelper).toContain(rowStateToken);
        }
        expect(dashboardRecordingRows).toContain(
            "dashboardRecordingRowStyles.rows",
        );
        expect(dashboardRecordingListGroup).toContain(
            "dashboardRecordingRowStyles.group",
        );
        expect(dashboardRecordingRowStyleHelper).not.toContain(
            "border-t border-border",
        );
        expect(dashboardRecordingListGroup).not.toContain("border-t");
        expect(dashboardRecordingListGroup).not.toContain("border-border");
        expect(workstation).toContain("groupIndex > 0 ? (");
        expect(dashboardRecordingListGroupSeparator).toContain(
            "dashboardRecordingRowStyles.groupSeparator",
        );
        expect(dashboardRecordingListHeading).toContain(
            "dashboardRecordingRowStyles.groupHeading",
        );
        expect(dashboardRecordingListLabel).toContain(
            "dashboardRecordingRowStyles.groupLabel",
        );
        expect(dashboardRecordingListCount).toContain(
            "dashboardRecordingRowStyles.groupCount",
        );
        expect(dashboardRecordingListDivider).toContain(
            "dashboardRecordingRowStyles.groupDivider",
        );
        expect(dashboardRecordingRowBody).toContain(
            "dashboardRecordingRowStyles.body",
        );
        expect(dashboardRecordingRowTitle).toContain(
            "dashboardRecordingRowStyles.title",
        );
        expect(dashboardRecordingRowMeta).toContain(
            "dashboardRecordingRowStyles.meta",
        );
        expect(workstation).toContain("dashboardRecordingRowStyles.sourceMark");
        expect(workstation).toContain(
            "dashboardRecordingRowStyles.sourceMarkImage",
        );
        expect(workstation).toContain(
            "dashboardRecordingRowStyles.sourceMarkImageCover",
        );
        expect(workstation).toContain(
            "dashboardRecordingRowStyles.sourceMarkLetter",
        );
        expect(workstation).toContain("dashboardRecordingRowStyles.duration");
        expect(dashboardRecordingRowSecondary).toContain(
            "dashboardRecordingRowStyles.secondary",
        );
        expect(workstation).toContain("dashboardRecordingRowStyles.timestamp");
        expect(workstation).toContain(
            "dashboardRecordingRowStyles.timestampAbsolute",
        );
        expect(workstation).toContain(
            "dashboardRecordingRowStyles.timestampRelative",
        );
        expect(dashboardRecordingRowActions).toContain(
            "dashboardRecordingRowStyles.actions",
        );
        expect(workstation).toMatch(
            /<Button\s+variant="ghost"\s+size="default"[\s\S]*className=\{\s*dashboardRecordingRowStyles\.row\s*\}[\s\S]*data-sot-control="dashboard-recording-row"/,
        );
        for (const rowPrimitiveLeak of [
            "dashboardRecordingRow",
            "dashboard-recording-row",
            "dashboard-recording-list-group",
            "is-hover-demo",
            "is-focus-demo",
        ]) {
            expect(buttonPrimitive).not.toContain(rowPrimitiveLeak);
        }
        for (const sourceMarkPrimitiveLeak of [
            "dashboardRecordingSourceMark",
            "dashboard-recording-source-mark",
            "dashboardRecordingRowStyles",
            "sourceMarkImageCover",
        ]) {
            expect(buttonPrimitive).not.toContain(sourceMarkPrimitiveLeak);
            expect(badgePrimitive).not.toContain(sourceMarkPrimitiveLeak);
        }
        for (const migratedSelector of DASHBOARD_RECORDING_ROW_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, migratedSelector)).toEqual([]);
        }
        expect([
            ...DASHBOARD_RECORDING_ROW_MIGRATED_GLOBAL_SELECTORS,
        ]).not.toContain('[data-sot-part="dashboard-recording-source-mark"]');
        for (const migratedSelectorFragment of DASHBOARD_RECORDING_ROW_META_MIGRATED_GLOBAL_SELECTOR_FRAGMENTS) {
            expect(globals).not.toContain(migratedSelectorFragment);
        }
        for (const migratedSelector of [
            '[data-sot-part="dashboard-recording-duration"]',
            '[data-sot-part="dashboard-recording-timestamp"]',
            '[data-sot-part="dashboard-recording-timestamp-absolute"]',
            '[data-sot-part="dashboard-recording-timestamp-relative"]',
            '[data-sot-part="dashboard-recording-source-mark"]',
        ]) {
            expect(collectCssRuleBlocks(globals, migratedSelector)).toEqual([]);
        }
        for (const rowMetaOwnershipToken of [
            "font-mono",
            "text-[11.5px]",
            "tracking-[0.02em]",
            "tracking-[0.015em]",
            "group-data-[time-style=abs]/dashboard-workstation:inline",
            "group-data-[time-style=abs]/dashboard-workstation:hidden",
            "grayscale",
            "contrast-[0.85]",
            "object-cover",
            "opacity-60",
            "border border-border",
            "bg-muted",
            "text-muted-foreground",
        ]) {
            expect(dashboardRecordingRowStyleHelper).toContain(
                rowMetaOwnershipToken,
            );
        }
        expect(workstation).toContain(
            "const SOT_DASHBOARD_RECORDING_STATUS_BADGE_CLASS =",
        );
        expect(workstation).toContain(
            "function SotDashboardRecordingStatusBadge",
        );
        const dashboardRecordingStatusBadge = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-status"',
            "Badge",
        );
        expect(dashboardRecordingStatusBadge).toContain('variant="ghost"');
        expect(dashboardRecordingStatusBadge).toContain(
            "SOT_DASHBOARD_RECORDING_STATUS_BADGE_CLASS",
        );
        expect(dashboardRecordingStatusBadge).toContain("className");
        expect(dashboardRecordingStatusBadge).toContain(
            'data-sot-part="dashboard-recording-status"',
        );
        expect(dashboardRecordingStatusBadge).toContain("data-sot-tone={tone}");
        expect(workstation).toMatch(
            /<span data-sot-part="dashboard-recording-status-dot" \/>/,
        );
        expect(workstation).toMatch(
            /<SotDashboardRecordingStatusBadge[\s\S]*label=\{\s*rowStatus\.label\s*\}[\s\S]*tone=\{\s*rowStatus\.tone\s*\}/,
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-status"',
        );
        expect(workstation).not.toContain(
            'variant="dashboardRecording' + 'Status"',
        );
        expect(badgePrimitive).not.toContain("dashboardRecording" + "Status:");
        expect(badgePrimitive).not.toContain(
            'variant="dashboardRecording' + 'Status"',
        );
        expect(badgePrimitive).not.toContain("dashboard-recording-status");
        expect(badgePrimitive).not.toContain("dashboard-recording-status-dot");
        for (const dashboardStatusToken of [
            "data-[sot-tone=ok]:border-[var(--button-copy-success-border)]",
            "data-[sot-tone=ok]:bg-[var(--button-copy-success-bg)]",
            "data-[sot-tone=ok]:text-[var(--signal-success)]",
            "data-[sot-tone=warn]:border-[var(--system-banner-offline-border)]",
            "data-[sot-tone=warn]:bg-[var(--system-banner-offline-icon-bg)]",
            "data-[sot-tone=warn]:text-[var(--signal-warning-strong)]",
            "data-[sot-tone=err]:border-[var(--alert-destructive-soft-border)]",
            "data-[sot-tone=err]:bg-[var(--alert-destructive-soft-bg)]",
            "data-[sot-tone=err]:text-[var(--signal-danger)]",
            "data-[sot-tone=info]:border-[var(--system-banner-progress-border)]",
            "data-[sot-tone=info]:bg-[var(--system-banner-progress-icon-bg)]",
            "data-[sot-tone=info]:text-[var(--signal-info)]",
            "data-[sot-tone=neu]:border-[var(--line-hairline)]",
            "data-[sot-tone=neu]:bg-[var(--bg-recessed)]",
            "data-[sot-tone=neu]:text-[var(--fg-secondary)]",
            "data-[sot-tone=neu]:[&_[data-sot-part=dashboard-recording-status-dot]]:bg-[var(--fg-tertiary)]",
            "[&_[data-sot-part=dashboard-recording-status-dot]]:size-[5px]",
            "[&_[data-sot-part=dashboard-recording-status-dot]]:rounded-full",
            "[&_[data-sot-part=dashboard-recording-status-dot]]:bg-current",
            "data-[sot-tone=warn]:[&_[data-sot-part=dashboard-recording-status-dot]]:animate-[bpulse_1.4s_ease-in-out_infinite]",
        ]) {
            expect(workstation).toContain(dashboardStatusToken);
        }
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-part="dashboard-recording-status"]',
            ),
        ).toEqual([]);
        expect(workstation).toContain('tone: "err"');
        expect(workstation).toContain('tone: "warn"');
        expect(workstation).toContain('tone: "ok"');
        expect(workstation).toContain('tone: "info"');
        expect(workstation).toContain('tone: "neu"');
        expect(workstation).not.toContain('className: "b err"');
        expect(workstation).not.toContain("dotClassName");
        expect(workstation).toContain("recordingList.status.failed");
        expect(workstation).toContain("recordingList.status.pending");
        expect(workstation).not.toContain(
            `${staticJsxClassName("filter-row")}
                                    data-sot-panel="recording-list-tag-filter"`,
        );
        expect(workstation).toContain('aria-label="列表模式"');
        expect(workstation).toContain("<SegmentedTabs");
        const listModeSegmentedTabs = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-list-mode-segmented"',
            "SegmentedTabs",
        );
        expect(listModeSegmentedTabs).toContain('variant="segmented"');
        expect(listModeSegmentedTabs).toContain('size="segmentedSm"');
        expect(listModeSegmentedTabs).toContain(
            'data-sot-control="segmented-tabs"',
        );
        expect(listModeSegmentedTabs).toContain('data-sot-size="sm"');
        expect(workstation).toContain('value: "timeline"');
        expect(workstation).toContain("recordingList.timeTab");
        expect(workstation).toContain('value: "tags"');
        expect(workstation).toContain("recordingList.tagsTab");
        expect(workstation).toContain('value: "source"');
        expect(workstation).toContain('label: "来源详情"');
        expect(workstation).toContain('tabKey: "source-report"');
        expect(workstation).toContain('value: "transcript"');
        expect(workstation).toContain('label: "转写"');
        expect(workstation).toContain('value: "speakers"');
        expect(workstation).toContain('label: "说话人"');
        const detailSegmentedTabs = extractOpeningElement(
            workstation,
            'aria-label="详情标签"',
            "SegmentedTabs",
        );
        expect(detailSegmentedTabs).toContain('variant="segmented"');
        expect(detailSegmentedTabs).toContain('size="segmentedSm"');
        expect(detailSegmentedTabs).toContain(
            'data-sot-control="segmented-tabs"',
        );
        expect(detailSegmentedTabs).toContain('data-sot-size="sm"');
        expect(workstation).toContain('hidden={detailTab !== "transcript"}');
        expect(workstation).toContain(
            'const dashboardTabPaneHiddenClassName = "[&[hidden]]:hidden";',
        );
        const transcriptPane = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-transcript-pane"',
            "div",
        );
        expect(transcriptPane).toContain(
            "className={dashboardTabPaneHiddenClassName}",
        );
        const sourceReportHiddenPane = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-source-report"',
            "div",
        );
        expect(sourceReportHiddenPane).toContain("className={cn(");
        expect(sourceReportHiddenPane).toContain(
            "SOURCE_REPORT_PANE_CLASS_NAME",
        );
        expect(sourceReportHiddenPane).toContain(
            "dashboardTabPaneHiddenClassName",
        );
        const speakersPane = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-speakers-pane"',
            "div",
        );
        expect(speakersPane).toContain(
            "className={dashboardTabPaneHiddenClassName}",
        );
        expect(workstation).toContain(
            "SOT_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME",
        );
        expect(workstation).toContain(
            "SOT_DASHBOARD_TRANSCRIPT_HEADER_CLASS_NAME",
        );
        expect(workstation).toMatch(
            /className=\{\s*SOT_DASHBOARD_TRANSCRIPT_HEADER_CLASS_NAME\s*\}/,
        );
        const dashboardTranscriptBody = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-body"',
            "CardContent",
        );
        expectCnClassNameReferences(dashboardTranscriptBody, [
            "SOT_DASHBOARD_TRANSCRIPT_BODY_BASE_CLASS_NAME",
            "dashboardRetranscriptionThemeClassName",
        ]);
        expect(workstation).toContain(
            "const dashboardRetranscriptionThemeClassName =",
        );
        for (const hook of DASHBOARD_DETAIL_PANE_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        const dashboardSpeakersMerge = extractOpeningElement(
            workstation,
            'data-sot-control="dashboard-speakers-merge"',
            "Button",
        );
        expect(buttonPrimitive).not.toContain("dashboardSpeakersMerge:");
        expect(dashboardSpeakersMerge).toContain('variant="ghost"');
        expect(dashboardSpeakersMerge).toContain('size="sm"');
        expectClassNameConstReference(
            dashboardSpeakersMerge,
            "dashboardButtonClassNames.speakersMerge",
        );
        expect(dashboardSpeakersMerge).not.toContain(
            'variant="dashboardSpeakersMerge"',
        );
        expect(dashboardSpeakersMerge).not.toContain(
            'size="dashboardSpeakersMerge"',
        );
        for (const hook of DASHBOARD_TRANSCRIPT_TURN_EMPTY_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        const dashboardTranscriptClassNames = extractBoundedSlice(
            workstation,
            "const dashboardTranscriptClassNames = {",
            "} as const;",
        );
        const dashboardSpeakerPaneClassNames = extractBoundedSlice(
            workstation,
            "const dashboardSpeakerPaneClassNames = {",
            "} as const;",
        );
        const dashboardTranscriptLoadingTurn = extractOpeningElement(
            workstation,
            "key={`transcript-skeleton:",
            "div",
        );
        const dashboardTranscriptLoadingSpeakerRow = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-speaker-row"',
            "div",
        );
        const dashboardTranscriptReadyTurn = extractOpeningElement(
            workstation,
            'data-sot-state="ready"',
            "div",
        );
        const dashboardTranscriptReadySlice = extractBoundedSlice(
            workstation,
            "turns.map((turn, index) => {",
            ") : (",
        );
        const dashboardTranscriptAvatar = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-avatar"',
            "span",
        );
        const dashboardTranscriptSpeakerName = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-speaker-name"',
            "span",
        );
        const dashboardTranscriptSpeakerTime = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-speaker-time"',
            "span",
        );
        const dashboardTranscriptEmpty = extractElementSlice(
            workstation,
            'data-sot-panel="dashboard-transcript-empty"',
            "Empty",
        );
        const dashboardTranscriptEmptyOpening = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-transcript-empty"',
            "Empty",
        );
        const dashboardTranscriptEmptyIcon = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-empty-icon"',
            "EmptyMedia",
        );
        const dashboardTranscriptEmptyTitle = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-empty-message"',
            "EmptyTitle",
        );
        const dashboardTranscriptEmptyDescription = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-empty-sub"',
            "EmptyDescription",
        );
        const dashboardSpeakersHead = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-speakers-head"',
            "div",
        );
        const dashboardSpeakersHeadTitle = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-speakers-head-title"',
            "div",
        );
        const dashboardSpeakerRows = extractOpeningElement(
            workstation,
            'data-sot-list="dashboard-speaker-rows"',
            "ul",
        );
        const dashboardSpeakerRow = extractOpeningElement(
            workstation,
            'data-sot-item="dashboard-speaker-row"',
            "li",
        );
        const dashboardSpeakerAvatar = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-speaker-avatar"',
            "span",
        );
        const dashboardSpeakerRowMeta = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-speaker-row-meta"',
            "div",
        );
        const dashboardSpeakerName = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-speaker-name"',
            "div",
        );
        const dashboardSpeakerSub = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-speaker-sub"',
            "div",
        );
        const dashboardSpeakerBar = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-speaker-bar"',
            "span",
        );
        const dashboardSpeakerBarFill = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-speaker-bar-fill"',
            "span",
        );

        for (const token of DASHBOARD_TRANSCRIPT_OWNER_CLASS_TOKENS) {
            expect(dashboardTranscriptClassNames).toContain(token);
        }
        for (const token of DASHBOARD_SPEAKER_PANE_OWNER_CLASS_TOKENS) {
            expect(dashboardSpeakerPaneClassNames).toContain(token);
        }
        expectClassNameConstReference(
            dashboardTranscriptLoadingTurn,
            "dashboardTranscriptClassNames.turn",
        );
        expectClassNameConstReference(
            dashboardTranscriptLoadingSpeakerRow,
            "dashboardTranscriptClassNames.speakerRow",
        );
        expectClassNameConstReference(
            dashboardTranscriptReadyTurn,
            "dashboardTranscriptClassNames.turn",
        );
        expectClassNameConstReference(
            dashboardTranscriptAvatar,
            "dashboardTranscriptClassNames.avatar",
        );
        expect(dashboardTranscriptAvatar).toContain("data-sot-tone=");
        expectClassNameConstReference(
            dashboardTranscriptSpeakerName,
            "dashboardTranscriptClassNames.speakerName",
        );
        expectClassNameConstReference(
            dashboardTranscriptSpeakerTime,
            "dashboardTranscriptClassNames.speakerTime",
        );
        expect(dashboardTranscriptSpeakerTime).toContain(
            'data-sot-format="mono"',
        );
        expect(dashboardTranscriptReadySlice).toContain(
            "dashboardTranscriptClassNames.paragraph",
        );
        expectClassNameConstReference(
            dashboardTranscriptEmptyOpening,
            "dashboardTranscriptClassNames.empty",
        );
        expect(dashboardTranscriptEmpty).toContain("<EmptyHeader");
        expect(dashboardTranscriptEmpty).toContain(
            "dashboardTranscriptClassNames.emptyHeader",
        );
        expectClassNameConstReference(
            dashboardTranscriptEmptyIcon,
            "dashboardTranscriptClassNames.emptyIcon",
        );
        expectClassNameConstReference(
            dashboardTranscriptEmptyTitle,
            "dashboardTranscriptClassNames.emptyMessage",
        );
        expectClassNameConstReference(
            dashboardTranscriptEmptyDescription,
            "dashboardTranscriptClassNames.emptySub",
        );
        expectClassNameConstReference(
            dashboardSpeakersHead,
            "dashboardSpeakerPaneClassNames.head",
        );
        expectClassNameConstReference(
            dashboardSpeakersHeadTitle,
            "dashboardSpeakerPaneClassNames.headTitle",
        );
        expectClassNameConstReference(
            dashboardSpeakerRows,
            "dashboardSpeakerPaneClassNames.rows",
        );
        expectClassNameConstReference(
            dashboardSpeakerRow,
            "dashboardSpeakerPaneClassNames.row",
        );
        expectClassNameConstReference(
            dashboardSpeakerAvatar,
            "dashboardSpeakerPaneClassNames.avatar",
        );
        expectClassNameConstReference(
            dashboardSpeakerRowMeta,
            "dashboardSpeakerPaneClassNames.rowMeta",
        );
        expectClassNameConstReference(
            dashboardSpeakerName,
            "dashboardSpeakerPaneClassNames.name",
        );
        expectClassNameConstReference(
            dashboardSpeakerSub,
            "dashboardSpeakerPaneClassNames.sub",
        );
        expectClassNameConstReference(
            dashboardSpeakerBar,
            "dashboardSpeakerPaneClassNames.bar",
        );
        expectClassNameConstReference(
            dashboardSpeakerBarFill,
            "dashboardSpeakerPaneClassNames.barFill",
        );
        expect(dashboardSpeakerBar).toContain(
            `"--dashboard-speaker-share": \`\${speakerBarPct}%\``,
        );
        const transcriptLanguageBadge = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-language"',
            "Badge",
        );
        expectExactStringConstInitializer(
            workstation,
            "SOT_DASHBOARD_TRANSCRIPT_LANGUAGE_BADGE_CLASS_NAME",
            EXPECTED_DASHBOARD_TRANSCRIPT_LANGUAGE_BADGE_CLASS_NAME,
        );
        expect(transcriptLanguageBadge).toContain('variant="outline"');
        expectClassNameConstReference(
            transcriptLanguageBadge,
            "SOT_DASHBOARD_TRANSCRIPT_LANGUAGE_BADGE_CLASS_NAME",
        );
        expect(badgePrimitive).not.toContain(
            DASHBOARD_OWNER_LOCAL_FORBIDDEN_VARIANT_PROPS[6],
        );
        expectExactStringConstInitializer(
            workstation,
            "SOT_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME",
            EXPECTED_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME,
        );
        expectExactStringConstInitializer(
            workstation,
            "SOT_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME",
            EXPECTED_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME,
        );
        const dashboardTranscriptShell = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-transcript-shell"',
            "Card",
        );
        expectClassNameConstReference(
            dashboardTranscriptShell,
            "SOT_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME",
        );
        const dashboardTranscriptActions = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-actions"',
            "div",
        );
        expectClassNameConstReference(
            dashboardTranscriptActions,
            "SOT_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME",
        );
        const dashboardCopyIcon = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-copy-icon"',
            "Icon",
        );
        expectClassNameConstReference(
            dashboardCopyIcon,
            "SOURCE_REPORT_COPY_ICON_CLASS_NAME",
        );
        const dashboardCopyLabel = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-copy-label"',
            "span",
        );
        expectClassNameConstReference(
            dashboardCopyLabel,
            "SOURCE_REPORT_COPY_LABEL_CLASS_NAME",
        );
        const dashboardButtonClassNames = extractBoundedSlice(
            workstation,
            "const dashboardButtonClassNames = {",
            "} as const;",
        );
        expect(dashboardButtonClassNames).toMatch(
            /copy:\s*"[^"]*\[&\[hidden\]\]:hidden[^"]*"/,
        );
        expect(sourceReportStyles).toMatch(
            /export const SOURCE_REPORT_COPY_BUTTON_CLASS_NAME\s*=\s*"[^"]*\[&\[hidden\]\]:hidden[^"]*";/,
        );
        expect(workstation).not.toContain(
            "const SOT_SOURCE_REPORT_COPY_BUTTON_CLASS_NAME",
        );
        for (const selector of DASHBOARD_COPY_ACTION_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const legacyClassName of DASHBOARD_DETAIL_PANE_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toContain(legacyClassName);
        }
        for (const legacyClassName of DASHBOARD_TRANSCRIPT_TURN_EMPTY_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toContain(legacyClassName);
        }
        for (const selector of DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_SELECTORS) {
            const repaintBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(({ declarations }) =>
                DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE.test(
                    declarations,
                ),
            );

            expect(repaintBlocks).toEqual([]);
        }
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-panel="dashboard-transcript-shell"]',
            ),
        ).toEqual([]);
        for (const control of DASHBOARD_TRANSCRIPT_GENERIC_COPY_CONTROLS) {
            const buttonOpening = extractOpeningElement(
                workstation,
                `data-sot-control="${control}"`,
                "Button",
            );
            expect(buttonOpening).toContain('variant="ghost"');
            expect(buttonOpening).toContain('size="sm"');
            expectClassNameConstReference(
                buttonOpening,
                "dashboardButtonClassNames.copy",
            );
        }
        for (const control of DASHBOARD_TRANSCRIPT_COPY_CONTROLS) {
            const buttonOpening = extractOpeningElement(
                workstation,
                `data-sot-control="${control}"`,
                "Button",
            );
            expect(buttonOpening).toContain('variant="ghost"');
            expect(buttonOpening).toContain('size="sm"');
            expectClassNameConstReference(
                buttonOpening,
                "SOURCE_REPORT_COPY_BUTTON_CLASS_NAME",
            );
            expect(buttonOpening).not.toContain(
                'variant="sourceReportCopyAction"',
            );
            expect(buttonOpening).not.toContain('variant="secondary"');
            expect(buttonOpening).not.toContain('variant="destructive"');
            expect(buttonOpening).not.toContain('size="control-xs"');
        }
        for (const control of DASHBOARD_TRANSCRIPT_GENERIC_COMPACT_ACTION_CONTROLS) {
            const buttonOpening = extractOpeningElement(
                workstation,
                `data-sot-control="${control}"`,
                "Button",
            );
            expect(buttonOpening).toContain('variant="ghost"');
            expect(buttonOpening).toContain('size="sm"');
            expectClassNameConstReference(
                buttonOpening,
                "dashboardButtonClassNames.compactAction",
            );
        }
        for (const control of DASHBOARD_TRANSCRIPT_RETRANSCRIPTION_DISMISS_CONTROLS) {
            const buttonOpening = extractOpeningElement(
                workstation,
                `data-sot-control="${control}"`,
                "Button",
            );
            expect(buttonOpening).toContain('variant="ghost"');
            expect(buttonOpening).toContain('size="sm"');
            expectExactCnClassNameConstReferences(buttonOpening, [
                "dashboardButtonClassNames.compactAction",
                "dashboardRetranscriptionClassNames.closeButton",
            ]);
        }
        for (const control of DASHBOARD_TRANSCRIPT_COMPACT_ACTION_CONTROLS) {
            const buttonOpening = extractOpeningElement(
                workstation,
                `data-sot-control="${control}"`,
                "Button",
            );
            expect(buttonOpening).toContain('variant="outline"');
            expect(buttonOpening).toContain('size="xs"');
            expectClassNameConstReference(
                buttonOpening,
                "SOURCE_REPORT_ACTION_BUTTON_CLASS_NAME",
            );
            expect(buttonOpening).not.toContain('variant="sourceReportAction"');
            expect(buttonOpening).not.toContain('variant="ghost"');
            expect(buttonOpening).not.toContain('variant="default"');
            expect(buttonOpening).not.toContain('size="sourceReportAction"');
        }
        for (const removed of [
            "SOT_COPY_BUTTON_BASE_CLASS",
            "SOT_COPY_SUCCESS_BUTTON_CLASS",
            "SOT_COPY_DANGER_BUTTON_CLASS",
            "SOT_COMPACT_GHOST_BUTTON_CLASS",
            "getSotCopyButtonClass",
        ]) {
            expect(workstation).not.toContain(removed);
        }
        const sourceReportLoaded = extractBoundedSlice(
            workstation,
            'state="loaded"\n                                            subState={sourceReportSubState}',
            "data-sot-source-report-actions",
        );
        for (const hook of DASHBOARD_SOURCE_REPORT_LOADED_SOT_HOOKS) {
            expect(sourceReportLoaded).toContain(hook);
        }
        expectExactStringConstInitializer(
            sourceReportStyles,
            "SOURCE_REPORT_STATUS_BADGE_CLASS_NAME",
            EXPECTED_SOURCE_REPORT_STATUS_BADGE_CLASS_NAME,
        );
        expect(workstation).not.toContain(
            "SOT_DASHBOARD_SOURCE_REPORT_STATUS_CLASS_NAME",
        );
        const sourceReportStatusBadge = extractOpeningElement(
            workstation,
            'data-sot-badge="source-report-status"',
            "Badge",
        );
        expect(sourceReportStatusBadge).toContain('variant="ghost"');
        expectClassNameConstReference(
            sourceReportStatusBadge,
            "SOURCE_REPORT_STATUS_BADGE_CLASS_NAME",
        );
        const sourceReportLoadedStatusBadge = extractOpeningElement(
            sourceReportLoaded,
            'data-sot-tone="warn"',
            "Badge",
        );
        expect(sourceReportLoadedStatusBadge).toContain('variant="ghost"');
        expectClassNameConstReference(
            sourceReportLoadedStatusBadge,
            "SOURCE_REPORT_STATUS_BADGE_CLASS_NAME",
        );
        expect(sourceReportLoaded).not.toContain(
            DASHBOARD_OWNER_LOCAL_FORBIDDEN_VARIANT_PROPS[5],
        );
        expect(badgePrimitive).not.toContain(
            DASHBOARD_OWNER_LOCAL_FORBIDDEN_VARIANT_PROPS[5],
        );
        for (const genericToken of [
            'variant="outline"',
            'variant="default"',
            'size="sm"',
        ]) {
            expect(sourceReportLoaded).not.toContain(genericToken);
        }
        const sourceReportOpenAction = extractOpeningElement(
            workstation,
            'data-sot-control="open-source-record"',
            "Button",
        );
        const sourceReportRepullAction = extractOpeningElement(
            workstation,
            'data-sot-control="repull-source"',
            "Button",
        );
        expect(sourceReportOpenAction).toContain('variant="ghost"');
        expect(sourceReportOpenAction).toContain('size="xs"');
        expectClassNameConstReference(
            sourceReportOpenAction,
            "SOURCE_REPORT_GHOST_ACTION_BUTTON_CLASS_NAME",
        );
        expect(sourceReportRepullAction).toContain('variant="ghost"');
        expect(sourceReportRepullAction).toContain('size="xs"');
        expectClassNameConstReference(
            sourceReportRepullAction,
            "SOURCE_REPORT_GHOST_ACTION_BUTTON_CLASS_NAME",
        );
        for (const action of [
            sourceReportOpenAction,
            sourceReportRepullAction,
        ]) {
            expect(action).not.toContain('variant="sourceReport');
            expect(action).not.toContain('size="sourceReport');
            expect(action).not.toContain('size="sm"');
        }
        for (const hook of DASHBOARD_SOURCE_REPORT_META_VALUE_HELPER_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const legacyClassName of DASHBOARD_SOURCE_REPORT_LOADED_LEGACY_CLASS_NAMES) {
            expect(sourceReportLoaded).not.toContain(legacyClassName);
        }
        expect(workstation).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(workstation).not.toContain("type ButtonProps");
        expect(workstation).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(workstation).toContain("<Button");
        expect(workstation).toContain("<Skeleton");
        expect(workstation).not.toContain(
            'import { Slider } from "@/components/ui/slider";',
        );
        expect(dashboardRecordingPlayerControls).toContain(
            'import { Slider } from "@/components/ui/slider";',
        );
        expect(dashboardRecordingPlayerControls).toContain("<Slider");
        expect(dashboardRecordingPlayerControls).not.toContain(
            "<SotPlayerSeekSlider",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "<SotPlayerVolumeSlider",
        );
        const sourceReportLoading = extractBoundedSlice(
            workstation,
            'sourceReportState === "loading" ? (',
            'sourceReportState === "error" ? (',
        );
        expectSourceReportMetricCallsites(
            sourceReportLoading,
            "SotSourceReportMetricCard",
            DASHBOARD_SOURCE_REPORT_LOADING_METRIC_CARDS,
        );
        expectPrimitiveToExcludeBusinessTokens(cardPrimitive, [
            "sourceReportMetric",
        ]);
        expect(workstation).not.toContain(
            "const SOT_SOURCE_REPORT_METRIC_CARD_CLASS_NAME =",
        );
        expect(sourceReportStyles).toContain(
            "export const SOURCE_REPORT_METRIC_CARD_CLASS_NAME =",
        );
        for (const snippet of SOURCE_REPORT_STYLE_OWNER_SNIPPETS) {
            expect(sourceReportStyles).toContain(snippet);
        }
        expect(sourceReportStyles).not.toMatch(
            /SOURCE_REPORT_STYLE_VARIABLES|SourceReportStyleVariables|--source-report-|color-mix\(|linear-gradient\(/,
        );
        expect(globals).not.toMatch(/--source-report-[a-z-]+/);
        for (const sourceReportStateSelector of [
            '[data-sot-source-report-state][data-state="loaded"][data-sub-state="transcript-missing"]',
            '[data-sot-source-report-state][data-state="loaded"][data-sub-state="summary-missing"]',
            '[data-sot-source-report-state][data-state="loaded"][data-sub-state="both-missing"]',
        ]) {
            expect(globals).not.toContain(sourceReportStateSelector);
        }
        expect(workstation).toContain("@/features/source-report/styles");
        expect(workstation).toContain("SotSourceReportMissingNotice");
        expect(workstation).toContain("data-sot-source-report-missing-notice");
        expect(workstation).toContain(
            "SOURCE_REPORT_TRANSCRIPT_MISSING_NOTICE_CLASS_NAME",
        );
        expect(workstation).toContain(
            "SOURCE_REPORT_SUMMARY_MISSING_NOTICE_CLASS_NAME",
        );
        expect(sourceReportStyles).toContain(
            "SOURCE_REPORT_SKELETON_CLASS_NAME",
        );
        expect(workstation).toContain(
            "SOURCE_REPORT_CARD_SKELETON_CLASS_NAMES",
        );
        expect(workstation).toContain(
            "SOURCE_REPORT_SEGMENT_SKELETON_CLASS_NAMES",
        );
        expect(workstation).not.toContain("SOURCE_REPORT_STYLE_VARIABLES");
        const sourceReportPane = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-source-report"',
            "div",
        );
        expectCnClassNameReferences(sourceReportPane, [
            "SOURCE_REPORT_PANE_CLASS_NAME",
            "dashboardTabPaneHiddenClassName",
        ]);
        expect(sourceReportPane).not.toContain("style=");
        const sourceReportState = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-source-report-state"',
            "div",
        );
        expectClassNameConstReference(
            sourceReportState,
            "SOURCE_REPORT_STATE_CLASS_NAME",
        );
        expect(sourceReportState).not.toContain("style=");
        const sourceReportMetricCard = extractOpeningElement(
            workstation,
            'data-sot-card="source-report-metric"',
            "Card",
        );
        const sourceReportMetricCardBlock = extractElementSlice(
            workstation,
            'data-sot-card="source-report-metric"',
            "Card",
        );
        expect(sourceReportMetricCard).toContain("hasNoPadding");
        expect(sourceReportMetricCard).toContain(
            "className={SOURCE_REPORT_METRIC_CARD_CLASS_NAME}",
        );
        expect(sourceReportMetricCard).toContain(
            'data-sot-card="source-report-metric"',
        );
        expect(sourceReportMetricCard).toContain("data-sot-metric={metric}");
        expect(sourceReportMetricCardBlock).not.toContain(
            'variant="sourceReportMetric"',
        );
        const sourceReportMetricCardClassName =
            expectExactStringConstInitializer(
                sourceReportStyles,
                "SOURCE_REPORT_METRIC_CARD_CLASS_NAME",
                EXPECTED_SOURCE_REPORT_METRIC_CARD_CLASS_NAME,
            );
        for (const token of SOURCE_REPORT_METRIC_CARD_CLASS_TOKENS) {
            expect(sourceReportMetricCardClassName).toContain(token);
        }
        expectSourceReportMetricCallsites(
            sourceReportLoaded,
            "SotSourceReportMetricCard",
            DASHBOARD_SOURCE_REPORT_LOADED_METRIC_CARDS,
        );
        for (const token of DASHBOARD_TRANSCRIPT_SKELETON_SHARED_TOKENS) {
            expect(skeletonPrimitive).not.toContain(token);
        }
        for (const token of SOURCE_REPORT_SKELETON_SHARED_TOKENS) {
            expect(skeletonPrimitive).not.toContain(token);
        }
        expect(workstation).not.toContain('variant="sourceReportMetric"');
        expect(workstation).toContain("function DashboardTranscriptSkeleton");
        for (const token of DASHBOARD_TRANSCRIPT_SKELETON_LOCAL_COMPOSITION_TOKENS) {
            expect(workstation).toContain(token);
        }
        const dashboardTranscriptSkeleton = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-skeleton"',
            "Skeleton",
        );
        expect(dashboardTranscriptSkeleton).toContain('variant="default"');
        expect(dashboardTranscriptSkeleton).toContain('size="default"');
        expect(dashboardTranscriptSkeleton).toContain(
            "className={dashboardTranscriptSkeletonClassNames[size]}",
        );
        expect(dashboardTranscriptSkeleton).toContain(
            'data-sot-part="dashboard-transcript-skeleton"',
        );
        expect(dashboardTranscriptSkeleton).toContain("data-sot-size={size}");
        expect(workstation).not.toContain('variant="dashboardTranscript"');
        for (const token of SOURCE_REPORT_SKELETON_OWNER_TOKENS) {
            expect(sourceReportStyles).toContain(token);
        }
        expect(workstation).not.toContain(
            "const sotSourceReportCardSkeletonClassNames",
        );
        expect(workstation).not.toContain(
            "const sotSourceReportSegmentSkeletonClassNames",
        );
        const dashboardSourceReportCardSkeleton = extractOpeningElement(
            workstation,
            'data-sot-part="source-report-card-skeleton"',
            "Skeleton",
        );
        expect(dashboardSourceReportCardSkeleton).toContain(
            'variant="default"',
        );
        expect(dashboardSourceReportCardSkeleton).toContain('size="default"');
        expect(dashboardSourceReportCardSkeleton).toContain(
            "className={SOURCE_REPORT_CARD_SKELETON_CLASS_NAMES[size]}",
        );
        expect(dashboardSourceReportCardSkeleton).toContain(
            'data-sot-part="source-report-card-skeleton"',
        );
        expect(dashboardSourceReportCardSkeleton).toContain(
            "data-sot-size={size}",
        );
        const dashboardSourceReportSegmentSkeleton = extractOpeningElement(
            workstation,
            'data-sot-part="source-report-segment-skeleton"',
            "Skeleton",
        );
        expect(dashboardSourceReportSegmentSkeleton).toContain(
            'variant="default"',
        );
        expect(dashboardSourceReportSegmentSkeleton).toContain(
            'size="default"',
        );
        expect(dashboardSourceReportSegmentSkeleton).toContain(
            "className={SOURCE_REPORT_SEGMENT_SKELETON_CLASS_NAMES[size]}",
        );
        expect(dashboardSourceReportSegmentSkeleton).toContain(
            'data-sot-part="source-report-segment-skeleton"',
        );
        expect(dashboardSourceReportSegmentSkeleton).toContain(
            "data-sot-size={size}",
        );
        expect(workstation).not.toContain('variant="sourceReportCard"');
        expect(workstation).not.toContain('variant="sourceReportSegment"');
        expect(workstation).not.toContain("sourceReportCardSkeletonSize");
        expect(workstation).not.toContain("sourceReportSegmentSkeletonSize");
        expect(workstation).not.toMatch(/\bSOURCE_REPORT_METRIC_CARD_CLASS\b/);
        expect(workstation).not.toMatch(
            /\bSOURCE_REPORT_STATUS_BADGE_CLASS\s*=/,
        );
        expect(workstation).not.toContain(
            "SOURCE_REPORT_STATUS_BADGE_TONE_CLASS",
        );
        expect(workstation).not.toContain("dashboardTranscriptSkeletonSize");
        expect(workstation).not.toContain("dashboardTranscriptAvatar");
        expect(workstation).not.toContain(
            "className={SOURCE_REPORT_METRIC_CARD_CLASS}",
        );
        expect(workstation).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps PR20 manual sync refresh and SOT sync states on real controls", () => {
        const globals = readSource("app/globals.css");
        const workstation = readSource("features/dashboard/workstation.tsx");

        for (const selector of REMOVED_DASHBOARD_SYNC_GLOBAL_SELECTORS) {
            expect(
                collectCssRuleBlocks(globals, selector).filter((block) =>
                    DASHBOARD_SYNC_VISUAL_GLOBAL_DECLARATION_RE.test(
                        block.declarations,
                    ),
                ),
            ).toEqual([]);
        }
        expect(workstation).toContain("useBrowserRouteController");
        expect(workstation).toContain("async function runManualSync()");
        expect(workstation).toContain("if (syncButtonBusy) return;");
        expect(workstation).toContain("await manualSync()");
        expect(workstation).toContain(
            "await Promise.all([refreshStatus(), loadDataSources()])",
        );
        expect(workstation).toContain("refreshBrowserRoute(router)");
        expect(workstation).toContain("const dashboardSyncClassNames = {");
        expect(workstation).toContain('data-sot-panel="dashboard-sync"');
        expect(workstation).toContain(
            'data-sot-part="dashboard-sync-indicator"',
        );
        expect(workstation).toContain("dashboardSyncClassNames.panel");
        expect(workstation).toContain("dashboardSyncClassNames.indicator");
        expect(workstation).toContain("dashboardSyncClassNames.text");
        expect(workstation).toContain("dashboardSyncClassNames.title");
        expect(workstation).toContain("dashboardSyncClassNames.subtitle");
        expect(workstation).toContain("var(--signal-success)");
        expect(workstation).toContain("var(--signal-danger)");
        expect(workstation).toContain("var(--signal-info)");
        expect(workstation).toContain("var(--fg-tertiary)");
        expect(workstation).toContain("bpulse_1.4s_ease-in-out_infinite");
        expect(workstation).toContain('data-sot-control="dashboard-sync"');
        expect(workstation).toContain('variant="ghost"');
        expect(workstation).toContain('size="icon-sm"');
        expect(workstation).toContain("dashboardButtonClassNames.sync");
        expect(workstation).toContain("data-sync-state={syncButtonState}");
        expect(workstation).toContain("aria-busy={syncButtonBusy}");
        expect(workstation).toContain("disabled={syncButtonBusy}");
        expect(workstation).toContain("onClick={() => void runManualSync()}");
        expect(workstation).not.toContain(
            "dashboardSidebarCollapseClassNames.syncPanel",
        );
        expect(workstation).not.toContain('className="sync-dot"');
        expect(workstation).toContain(
            'data-sot-control="dashboard-activity-sync"',
        );
    });

    it("keeps SOT global tokens and system banner state semantics available", () => {
        const globals = readSource("app/globals.css");
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const progressPrimitive = readSource("components/ui/progress.tsx");
        const segmentedTabs = readSource("components/ui/segmented-tabs.tsx");
        const toggleGroupPrimitive = readSource(
            "components/ui/toggle-group.tsx",
        );
        const banner = readSource(
            "features/dashboard/components/system-banner.tsx",
        );

        for (const token of [
            "BetterAINote global design tokens",
            "--bg-canvas:",
            "--bg-elevated:",
            "--fg-primary:",
            "--z-modal:",
            "@supports not (color: oklch(",
        ]) {
            expect(globals).toContain(token);
        }
        expect(globals).not.toMatch(GLOBALS_FRAMEWORK_MARKETING_RE);
        expect(globals).toContain("--background: var(--bg-canvas);");
        expect(globals).toContain("--foreground: var(--fg-primary);");
        expect(globals).toContain("--color-background: var(--background);");
        expect(globals).toContain("--color-foreground: var(--foreground);");
        expect(globals).not.toContain("--color-background: var(--bg-canvas);");
        expect(globals).not.toContain("--color-foreground: var(--fg-primary);");

        expect(segmentedTabs).not.toContain(
            'data-sot-control="segmented-tabs"',
        );
        expect(segmentedTabs).not.toContain("data-sot-size={size}");
        expect(segmentedTabs).toContain("data-tabs={items.length}");
        expect(segmentedTabs).toContain("data-active={activeIndex}");
        expect(segmentedTabs).toContain("getItemProps");
        expect(segmentedTabs).not.toContain('data-sot-control="segmented-tab"');
        expect(segmentedTabs).not.toContain("data-sot-state={");
        expect(segmentedTabs).toContain(
            'import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";',
        );
        expect(segmentedTabs).toContain("<ToggleGroup");
        expect(segmentedTabs).toContain("<ToggleGroupItem");
        expect(segmentedTabs).toContain('variant = "segmented"');
        expect(segmentedTabs).toContain('size = "segmentedSm"');
        expect(segmentedTabs).toContain("variant={variant}");
        expect(segmentedTabs).toContain("size={size}");
        expect(segmentedTabs).not.toContain('variant="outline"');
        expect(toggleGroupPrimitive).toContain("segmented:");
        expect(toggleGroupPrimitive).toContain("segmentedSm:");
        expect(toggleGroupPrimitive).toContain(
            "const toggleGroupSpacingClassNames",
        );
        expect(toggleGroupPrimitive).toContain('1.6: "gap-[0.4rem]"');
        expect(toggleGroupPrimitive).not.toContain("data-spacing-value");
        expect(toggleGroupPrimitive).not.toContain("style={{ gap:");
        expect(segmentedTabs).toContain("spacing={1}");
        expect(segmentedTabs).toContain('type="single"');
        expect(segmentedTabs).toContain("value={value}");
        expect(segmentedTabs).toContain("if (!nextValue) return;");
        expect(segmentedTabs).toContain("onValueChange(nextValue as T)");
        expect(segmentedTabs).toContain(
            "data-tab-key={item.tabKey ?? item.value}",
        );
        expect(segmentedTabs).toContain(
            "aria-disabled={item.disabled || undefined}",
        );
        expect(segmentedTabs).toContain("aria-selected={active}");
        expect(segmentedTabs).toContain("disabled={item.disabled}");
        expect(segmentedTabs).not.toContain("<button");
        expect(segmentedTabs).not.toContain('data-slot="segmented-tabs"');
        expect(segmentedTabs).not.toContain(
            'data-slot="toggle-group-indicator"',
        );
        expect(segmentedTabs).not.toContain(
            'data-sot-part="liquid-tabs-indicator"',
        );
        expect(segmentedTabs).not.toContain('data-sot-control="liquid-tabs"');
        expect(segmentedTabs).not.toContain('data-sot-control="liquid-tab"');
        expect(segmentedTabs).not.toContain("data-idx");
        expect(segmentedTabs).not.toContain('className={cn("liquid-tabs"');
        expect(segmentedTabs).not.toContain('className="liquid-tabs"');
        expect(segmentedTabs).not.toContain('className="lt-ind"');
        expect(segmentedTabs).not.toContain('className={cn("lt-tab"');
        expect(segmentedTabs).not.toContain('className="lt-tab"');

        expect(banner).toContain(
            'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
        );
        expect(banner).toContain(
            'import { Progress } from "@/components/ui/progress";',
        );
        expect(banner).toContain("const systemBannerAlertVariantByState");
        expect(banner).toContain("const systemBannerAlertClassNames");
        expect(banner).toContain("const systemBannerAlertStateClassNames");
        expect(banner).toContain("const systemBannerIconStateClassNames");
        expect(banner).toContain("const systemBannerButtonClassNames");
        expect(banner).toContain("const systemBannerProgressClassNames");
        expect(banner).not.toContain("[--system-banner");
        expect(banner).not.toContain("border-[var(--system-banner-border)]");
        expect(banner).not.toContain("bg-[var(--system-banner-bg)]");
        expect(banner).toContain(
            'offline: "border-border bg-secondary text-secondary-foreground"',
        );
        expect(banner).toContain(
            '"permission-denied": "destructiveSoftNeutral"',
        );
        expect(banner).toContain(
            '"update-available": "border-primary/30 bg-primary/10"',
        );
        expect(banner).toContain(
            '"permission-denied": "bg-destructive/10 text-destructive"',
        );
        expect(banner).toContain(
            "variant={systemBannerAlertVariantByState[banner.state]}",
        );
        expect(banner).toContain(
            "systemBannerAlertStateClassNames[banner.state]",
        );
        expect(banner).toContain(
            "systemBannerIconStateClassNames[banner.state]",
        );
        expect(banner).toContain(
            "bg-primary/10 data-[sot-state=indeterminate]:bg-primary/10",
        );
        expect(banner).toContain("bg-primary transition-transform");
        expect(banner).not.toContain(
            "bg-[image:var(--system-banner-progress-indeterminate-bg)]",
        );
        expect(banner).toContain("bg-transparent");
        expect(banner).not.toContain("CSSProperties");
        expect(banner).not.toContain("systemBannerAlertStyle");
        expect(banner).not.toContain("style={systemBannerAlertStyle}");
        expect(banner).not.toContain("backgroundColor");
        expect(banner).toContain("function SystemBannerAlert");
        expect(banner).toContain("function SystemBannerButton");
        expect(banner).toContain("function SystemBannerProgress");
        expect(banner).toMatch(/<Alert\s/);
        expect(banner).not.toContain('variant="systemBanner"');
        expect(banner).not.toContain('density="systemBanner"');
        expect(banner).not.toContain('layout="systemBanner"');
        expect(banner).toContain("<AlertTitle");
        expect(banner).not.toContain('density="systemBanner"');
        expect(banner).toContain("<AlertDescription");
        expect(banner).toContain("</Alert>");
        expect(banner).not.toMatch(/<section[\s>]/);
        expect(banner).toContain('data-sot-panel="system-banner"');
        expect(banner).not.toContain('data-slot="system-banner"');
        expect(banner).toContain('data-sot-part="system-banner-icon"');
        expect(banner).toContain('data-sot-part="system-banner-body"');
        expect(banner).toContain('data-sot-part="system-banner-title"');
        expect(banner).toContain('data-sot-part="system-banner-description"');
        expect(banner).toContain('"system-banner-progress"');
        expect(banner).toContain('"system-banner-progress-bar"');
        expect(banner).toContain('data-sot-part="system-banner-actions"');
        expect(banner).toContain('data-sot-format={hasProgress ? "mono"');
        expect(banner).toContain("<Progress");
        expect(banner).not.toContain('variant="systemBanner"');
        expect(banner).toContain("value={progress ?? 0}");
        expect(banner).not.toMatch(
            /<div[\s\S]*data-sot-part="system-banner-progress"/,
        );
        expect(banner).not.toContain(
            '<span data-sot-part="system-banner-progress-bar" />',
        );
        expect(banner).not.toContain('className={cn("sys-banner", className)}');
        expect(banner).not.toContain('className="sys-banner"');
        expect(banner).not.toContain(
            'className={cn("flex items-center gap-3 px-3.5 py-2.5", className)}',
        );
        expect(banner).not.toContain('"sbn-progress"');
        expect(banner).not.toContain('"sbn-bar"');
        expect(banner).toContain("animate-[sbn-sweep_1.4s_linear_infinite]");
        expect(banner).not.toContain('className="mono"');
        expect(banner).toContain("getBannerA11y(banner.state)");
        expect(banner).toContain("data-kind={banner.state}");
        expect(banner).toContain("data-pct={progress ?? undefined}");
        expect(banner).toContain(
            'import { Button, type ButtonProps } from "@/components/ui/button";',
        );
        expect(banner).toContain("<Button");
        expect(banner).not.toContain('size="systemBannerAction"');
        expect(banner).not.toContain('size="systemBannerDismissAction"');
        expect(banner).not.toContain('variant="systemBannerAction"');
        expect(banner).not.toContain('variant="systemBannerDismissAction"');
        expect(banner).not.toContain("variant={primaryActionVariant}");
        expect(banner).toContain('"primary"');
        expect(banner).toContain('size="sm"');
        expect(banner).not.toContain('size="icon-sm"');
        expect(banner).toContain(
            'variant={tone === "primary" ? "outline" : "ghost"}',
        );
        expect(banner).toContain("systemBannerButtonClassNames.actionSize");
        expect(banner).toContain("systemBannerButtonClassNames.dismissSize");
        expect(banner).toMatch(
            /data-sot-control="system-banner-dismiss-action"[\s\S]*<CloseIcon\s+data-icon="inline-start"\s+aria-hidden="true"\s*\/>/,
        );
        expect(banner).not.toContain("btn ghost btn-sm");
        expect(banner).toContain("<SystemBannerIcon");
        expect(banner).toContain("visibleBanners.length === 0");
        expect(banner).toContain('banner.state === "update-available"');
        expect(banner).toContain("window.location.reload()");
        expect(banner).not.toContain("lucide-react");
        expect(banner).not.toContain("data-system-banner");
        expect(banner).not.toMatch(OLD_UI_RE);
        expect(alertPrimitive).not.toContain('"systemBanner"');
        expect(alertPrimitive).not.toContain("data-[kind=offline]");
        expect(alertPrimitive).not.toContain(
            "[&_[data-sot-part=system-banner-icon]]",
        );
        expect(alertPrimitive).not.toContain(
            "[&_[data-sot-part=system-banner-body]]",
        );
        expect(alertPrimitive).not.toContain(
            "[&_[data-sot-part=system-banner-actions]]",
        );
        expect(buttonPrimitive).not.toContain("systemBannerAction");
        expect(buttonPrimitive).not.toContain("systemBannerPrimaryAction");
        expect(buttonPrimitive).not.toContain("systemBannerDismissAction");
        for (const localProgressContract of [
            'data-slot="progress"',
            'role="progressbar"',
            "aria-valuemax={maxValue}",
            "aria-valuemin={0}",
            "aria-valuenow={progressValue ?? undefined}",
            "aria-valuetext={valueLabel}",
            'data-slot="progress-indicator"',
            "indicatorClassName",
            "indicatorProps",
            "transform: `translateX(-${100 - progressPercent}%)`",
        ]) {
            expect(progressPrimitive).toContain(localProgressContract);
        }
        expect(progressPrimitive).not.toContain("radix-ui");
        expect(progressPrimitive).not.toContain("variant?: ProgressVariant");
        expect(progressPrimitive).not.toContain('"systemBanner"');
        expect(progressPrimitive).not.toContain('"system-banner-progress"');
        expect(progressPrimitive).not.toContain('"system-banner-progress-bar"');
        expect(progressPrimitive).not.toContain("sbn-sweep");
    });
});
