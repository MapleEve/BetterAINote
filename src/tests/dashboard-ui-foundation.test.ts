import { existsSync, readFileSync } from "node:fs";
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
    "relative flex flex-row items-center gap-2.5 px-1 pt-1 pb-0 data-[rename-mode=saving]:py-0";
const EXPECTED_DASHBOARD_DETAIL_HEADER_TITLE_CLASS_NAME =
    "m-0 min-w-0 flex-1 truncate font-display text-[22px] font-semibold leading-normal tracking-[-0.014em] text-foreground";
const EXPECTED_DASHBOARD_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME =
    "h-8 min-w-0 flex-1 px-3 py-1 text-base md:text-sm";
const EXPECTED_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME = "ml-1 shrink-0";
const EXPECTED_DASHBOARD_TRANSCRIPT_LANGUAGE_BADGE_CLASS_NAME = "gap-1.5";
const EXPECTED_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME =
    "ml-auto inline-flex max-w-full flex-[0_1_auto] flex-wrap items-center gap-2";
const EXPECTED_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME =
    "min-h-0 flex-1 gap-0 rounded-2xl";
const EXPECTED_DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME =
    "border-b border-border px-3 pt-3 pb-2.5";
const EXPECTED_DASHBOARD_SIDEBAR_FOOTER_CLASS_NAME =
    "border-t border-border pt-2.5";
const EXPECTED_DASHBOARD_MAIN_CLASS_NAME =
    "flex h-screen min-w-0 flex-col max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const EXPECTED_DASHBOARD_WORKSPACE_CLASS_NAME =
    "grid flex-1 min-h-0 grid-cols-[380px_1fr] gap-4 px-5 pt-4 pb-5 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border max-[860px]:grid-cols-[380px_0px]";
const EXPECTED_DASHBOARD_RECORDING_LIST_CARD_CLASS_NAME =
    "min-h-0 gap-0 rounded-2xl max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const EXPECTED_DETAIL_PANEL_CLASS_NAME =
    "flex min-h-0 min-w-0 flex-col gap-4 max-[860px]:hidden";
const DASHBOARD_TOPBAR_REQUIRED_CLASS_TOKENS = [
    "relative",
    "z-[60]",
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
    "supports-[backdrop-filter]:bg-background/60",
    "supports-[backdrop-filter]:backdrop-blur-[28px]",
    "supports-[backdrop-filter]:backdrop-saturate-[160%]",
    "max-[860px]:min-w-0",
    "max-[860px]:max-w-full",
    "max-[860px]:box-border",
] as const;
const DASHBOARD_TOPBAR_OWNER_CLASS_INITIALIZERS = [
    {
        property: "topbar",
        expected:
            "relative z-[60] flex h-14 flex-none flex-row items-center gap-3.5 border-b border-border bg-background/80 px-5 py-3 supports-[backdrop-filter]:bg-background/60 supports-[backdrop-filter]:backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-[160%] max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border",
    },
    {
        property: "crumbs",
        expected:
            "flex items-center gap-2 text-sm font-medium text-muted-foreground",
    },
    {
        property: "crumb",
        expected: "text-muted-foreground",
    },
    {
        property: "separator",
        expected: "text-muted-foreground/60 max-[860px]:hidden",
    },
    {
        property: "current",
        expected: "font-semibold text-foreground max-[860px]:hidden",
    },
] as const;
const DASHBOARD_SIDEBAR_OWNER_CLASS_TOKENS = [
    "relative",
    "flex",
    "flex-col",
    "rounded-none",
    "border-r",
    "border-sidebar-border",
    "bg-sidebar",
    "px-3",
    "pt-4",
    "pb-3",
    "text-sidebar-foreground",
] as const;
const DASHBOARD_SIDEBAR_VISUAL_GLOBAL_SELECTORS = [
    '[data-panel="dashboard-sidebar"]',
    '[data-theme="dark"] [data-panel="dashboard-sidebar"]',
    '.dark [data-panel="dashboard-sidebar"]',
] as const;
const DASHBOARD_SIDEBAR_OWNER_FORBIDDEN_CLASS_PATTERN =
    /\bspace-[xy]-|\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;
const DASHBOARD_SIDEBAR_VISUAL_GLOBAL_DECLARATION_RE =
    /^\s*(?:-webkit-backdrop-filter|backdrop-filter|background|border(?:-(?:color|radius|right|style|width))?|box-shadow|display|flex-direction|padding|position)\s*:/m;
const REMOVED_SOURCE_REPORT_DOT_HOOKS = [
    ["SourceReport", "StatusDot"].join(""),
    ["DashboardSourceReport", "StatusDot"].join(""),
    ["sourceReportStatus", "DotBase"].join(""),
    ["data-source-report-status", "dot"].join("-"),
] as const;
const SOURCE_REPORT_STATUS_BADGE_FORBIDDEN_OWNER_SNIPPETS = [
    "h-[22px] justify-normal gap-[5px] overflow-visible px-[8px] py-0",
    "h-[22px]",
    "gap-[5px]",
    "px-[8px]",
    ...REMOVED_SOURCE_REPORT_DOT_HOOKS,
    '"inline-block size-[5px] rounded-[50%] bg-current"',
    "data-part={part}",
    ['part = "source-report-status', 'dot"'].join("-"),
    ['part="dashboard-source-report-status', 'dot"'].join("-"),
] as const;
const SOURCE_REPORT_STATUS_VARIANT_SNIPPETS = [
    "const SOURCE_REPORT_STATUS_VARIANT = {",
    'err: "destructive"',
    'neu: "secondary"',
    'ok: "default"',
    'warn: "outline"',
    'React.ComponentProps<typeof Badge>["variant"]',
    "variant={SOURCE_REPORT_STATUS_VARIANT[tone]}",
] as const;
const SOURCE_REPORT_STATUS_BADGE_FORBIDDEN_STYLING_SNIPPETS = [
    ...SOURCE_REPORT_STATUS_BADGE_FORBIDDEN_OWNER_SNIPPETS,
    "sourceReportStatusBadgeStyles",
    "color-mix(",
    "oklch(",
    "--signal-success",
    "--signal-danger",
    "--signal-warning",
] as const;
const SOURCE_REPORT_EMPTY_ALERT_COMPOSITION_CHECKS = [
    {
        pattern: /<Alert\b[\s\S]*?data-source-report-missing-notice[\s\S]*?>/,
        snippets: [
            'variant="warningSoft"',
            'density="compact"',
            'layout="inline"',
        ],
    },
    {
        pattern: /<Alert\b[\s\S]*?data-source-report-empty[\s\S]*?>/,
        snippets: [
            'variant={tone === "danger" ? "statusError" : "default"}',
            'density="spacious"',
            'layout="centered"',
        ],
    },
    {
        pattern: /<Empty\b[\s\S]*?data-source-report-empty[\s\S]*?>/,
        snippets: ['variant="subtle"'],
    },
    {
        pattern: /<EmptyMedia\b[\s\S]*?data-source-report-empty-icon[\s\S]*?>/,
        snippets: ['variant={tone === "danger" ? "dangerIcon" : "subtleIcon"}'],
    },
    {
        pattern: /<EmptyTitle\b[\s\S]*?data-source-report-empty-title[\s\S]*?>/,
        snippets: ['variant="compact"'],
    },
    {
        pattern:
            /<EmptyDescription\b[\s\S]*?data-source-report-empty-description[\s\S]*?>/,
        snippets: ['variant="compact"'],
    },
] as const;
const SOURCE_REPORT_EMPTY_ALERT_FORBIDDEN_OWNER_SNIPPETS = [
    "const sourceReportMissingNoticeBase =",
    "sourceReportMissingNoticeDescriptionText",
    "const sourceReportErrorAlertBase =",
    "const sourceReportEmptySurfaceStyles = cva(",
    "sourceReportEmptySurfaceStyles({ tone })",
    "variant={null}",
    "const sourceReportEmptyIconStyles = cva(",
    "sourceReportEmptyIconStyles({ tone })",
    "sourceReportEmptyTitleText",
    "sourceReportEmptyDescriptionText",
    "border border-dashed border-[var(--line-hairline)] bg-[var(--bg-recessed)]",
    "border border-[var(--line-hairline)] bg-[var(--bg-recessed)] text-[var(--fg-tertiary)]",
    "border-[var(--alert-destructive-icon-soft-border)] bg-[var(--alert-destructive-icon-soft-bg)] text-[var(--signal-danger)]",
    "block max-w-[360px] font-sans text-[12px] font-medium leading-[1.5] tracking-normal text-muted-foreground",
] as const;
const EXPECTED_DASHBOARD_RECORDING_PLAYER_CARD_CLASS_NAME =
    "block min-h-[114px] gap-0 overflow-visible rounded-2xl px-[18px] py-4 shadow-none";
const EXPECTED_DASHBOARD_RECORDING_PLAYER_META_CLASS_NAME =
    "mb-3 flex flex-row flex-wrap items-center gap-2.5 p-0";
const EXPECTED_DASHBOARD_RECORDING_PLAYER_DATE_CLASS_NAME =
    "translate-y-px font-mono text-[11.5px] font-medium tracking-[0.02em] text-muted-foreground";
const DASHBOARD_RECORDING_PLAYER_CONTROLS_CLASS_INITIALIZERS = [
    {
        constName: "DASHBOARD_PLAYER_TIME_CLASS_NAME",
        expected: "min-w-11 text-center tabular-nums text-muted-foreground",
    },
    {
        constName: "DASHBOARD_PLAYER_DURATION_CLASS_NAME",
        expected: "min-w-11 text-center tabular-nums text-muted-foreground",
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
    'data-control="dashboard-player-play"',
    "dashboard-player-current-time",
    "dashboard-player-duration",
    'data-control="dashboard-player-speed"',
    '[data-surface="dashboard-recording-player"][data-no-audio="true"]',
    '[data-part="dashboard-recording-player-meta"]',
] as const;
const REMOVED_DASHBOARD_NAV_FAVORITE_GLOBAL_SELECTORS = [
    '[data-list="dashboard-nav"]',
    '[data-part="dashboard-nav-section-label"]',
    '[data-control="dashboard-favorite"] svg',
    '[data-part="dashboard-favorite-count"]',
    '[data-theme="dark"] [data-part="dashboard-favorite-count"]',
    '[data-control="dashboard-favorite"][data-state="selected"] svg',
    '[data-control="dashboard-favorite"][data-state="selected"]\n    [data-part="dashboard-favorite-count"]',
    '[data-theme="dark"]\n    [data-control="dashboard-favorite"][data-state="selected"]\n    [data-part="dashboard-favorite-count"]',
] as const;
const REMOVED_DASHBOARD_SYNC_GLOBAL_SELECTORS = [
    '[data-panel="dashboard-sync"]',
    '[data-panel="dashboard-sync"] [data-part="dashboard-sync-indicator"]',
    '[data-part="dashboard-sync-text"]',
    '[data-part="dashboard-sync-title"]',
    '[data-part="dashboard-sync-subtitle"]',
    '[data-panel="dashboard-sync"][data-state="queued"]',
    '[data-panel="dashboard-sync"][data-state="running"]',
    '[data-panel="dashboard-sync"][data-state="error"]',
] as const;
const DASHBOARD_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS = [
    '[data-panel="dashboard-topbar"]',
    '[data-theme="dark"] [data-panel="dashboard-topbar"]',
    '[data-part="dashboard-crumbs"]',
    '[data-part="dashboard-crumb"]',
    '[data-part="dashboard-crumb-separator"]',
    '[data-part="dashboard-crumb-current"]',
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

function expectAlertEmptyPrimitiveCleanup(
    alertPrimitive: string,
    emptyPrimitive: string,
) {
    const combinedPrimitiveSource = `${alertPrimitive}\n${emptyPrimitive}`;

    expect(combinedPrimitiveSource).not.toMatch(
        /\b(?:bg|text|border|ring|fill|stroke)-\[var\(/,
    );
    for (const residual of [
        "dark:",
        "[stroke-linecap:",
        "[stroke-linejoin:",
        "size-[14px]",
        "size-[32px]",
        "rounded-[var(--radius",
    ]) {
        expect(combinedPrimitiveSource).not.toContain(residual);
    }
}

function staticJsxClassName(className: string) {
    return `className="${className}"`;
}

function expectSourceReportEmptyAlertComposition(source: string) {
    expect(source).toContain("<EmptyHeader>");

    for (const {
        pattern,
        snippets,
    } of SOURCE_REPORT_EMPTY_ALERT_COMPOSITION_CHECKS) {
        const openingElement = source.match(pattern)?.[0] ?? "";
        expect(openingElement).not.toBe("");
        for (const snippet of snippets) {
            expect(openingElement).toContain(snippet);
        }
    }
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

function expectPlayerNoAudioPrimitiveBindings(source: string) {
    const noAudioAlert = extractOpeningElement(
        source,
        "data-state={playbackDisabled",
        "Alert",
    );
    const noAudioIcon = extractOpeningElement(
        source,
        "data-part={iconPart}",
        "VolumeX",
    );
    const noAudioText = extractOpeningElement(
        source,
        "data-player-no-audio-text",
        "span",
    );
    const noAudioTitle = extractOpeningElement(
        source,
        "data-part={titlePart}",
        "AlertTitle",
    );
    const noAudioDescription = extractOpeningElement(
        source,
        "data-part={descriptionPart}",
        "AlertDescription",
    );

    expect(noAudioAlert).toContain('variant="default"');
    expect(noAudioAlert).toContain('density="comfortable"');
    expect(noAudioAlert).toContain('layout="inline"');
    expect(noAudioAlert).toContain('className={cn("mb-3", className)}');
    expect(noAudioAlert).toContain("data-part={part}");
    expect(noAudioAlert).toContain(
        'data-state={playbackDisabled ? "visible" : "hidden"}',
    );
    expect(noAudioAlert).toContain("hidden={!playbackDisabled}");
    expect(noAudioAlert).toContain('role="status"');
    expect(noAudioIcon).toContain("data-part={iconPart}");
    expectClassNameConstReference(noAudioText, "PLAYER_NO_AUDIO_TEXT_CLASS");
    expect(noAudioText).toContain("data-player-no-audio-text");
    expect(noAudioText).toContain("data-part={textPart}");
    expect(noAudioTitle).not.toContain("className=");
    expect(noAudioDescription).toContain('density="comfortable"');
}

function expectPlayerSourcePrimitiveBindings(source: string) {
    const sourceBadge = extractOpeningElement(
        source,
        'data-control="player-source-tag"',
        "Badge",
    );
    const sourceIcon = extractOpeningElement(
        source,
        'data-part="source-icon"',
        "span",
    );
    const sourceIconImage = extractOpeningElement(
        source,
        "src={badge.icon}",
        "Image",
    );

    expectClassNameConstReference(sourceBadge, "PLAYER_SOURCE_BADGE_CLASS");
    expect(sourceBadge).toContain('variant="outline"');
    expect(sourceBadge).toContain('data-control="player-source-tag"');
    expectClassNameConstReference(sourceIcon, "PLAYER_SOURCE_ICON_CLASS");
    expect(sourceIcon).toContain('data-part="source-icon"');
    expect(sourceIcon).toContain(
        'data-source-icon={hasImage ? "image" : "letter"}',
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
    "p-0",
    "text-muted-foreground",
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
    "z-50",
    "border border-border",
    "bg-popover",
    "text-popover-foreground",
    "shadow-md",
    "option:",
    "border border-transparent",
    "bg-transparent",
    "text-muted-foreground",
    "hover:bg-accent hover:text-accent-foreground",
    "data-[state=selected]:bg-secondary",
    "data-[state=selected]:text-secondary-foreground",
    "optionLabel:",
    "optionCount:",
] as const;

const DASHBOARD_TAIL_RESIDUE_FORBIDDEN_SNIPPETS = [
    "z-[var(--z-drawer-scrim)]",
    "z-[var(--z-drawer)]",
    "z-[var(--z-popover-inline)]",
    "backdrop-blur-none",
    "shadow-lg",
] as const;

const DASHBOARD_RECORDING_TAG_FILTER_MIGRATED_GLOBAL_SELECTORS = [
    '[data-panel="recording-list-tag-filter"]',
    '[data-part="recording-list-tag-filter-label"]',
    '[data-part="recording-list-tag-filter-count"]',
    '[data-list="recording-list-tag-filter-list"]',
    '[data-theme="dark"] [data-list="recording-list-tag-filter-list"]',
    '[data-part="recording-list-tag-filter-option-label"]',
    '[data-part="recording-list-tag-filter-option-count"]',
] as const;

const DASHBOARD_SOURCE_FILTER_FEATURE_OWNER_CLASS_SNIPPETS = [
    "group/source-provider",
    "data-[state=connected-active]:text-foreground",
    "data-[state=sync-error]:text-foreground",
    "data-[state=disabled]:opacity-50",
    "mark:",
    "inline-flex size-[18px]",
    "rounded-sm",
    "data-[state=no-results]:opacity-60",
    "data-[state=disabled]:grayscale",
    "markImage:",
    "object-contain",
    "markImageCover:",
    "object-cover",
    "markLetter:",
    "size-1.5",
    "data-[tone=err]:bg-destructive",
    "data-[tone=syncing]:animate-[bpulse_1.2s_ease-in-out_infinite]",
    "min-w-[22px]",
    "font-mono text-xs",
    "data-[tone=active]:text-foreground",
    "data-[tone=empty]:line-through",
    "data-[tone=err]:text-destructive",
    "ml-1.5",
    "h-6",
    "rounded-full",
    "data-[action=retry]:hidden",
    "data-[action=retry]:text-destructive",
    "data-[action=connect]:text-primary",
    "group-hover/source-provider:data-[action=retry]:inline-flex",
    "group-focus-within/source-provider:data-[action=retry]:inline-flex",
    "group-data-[sidebar-collapsed=true]/dashboard-workstation:hidden",
    "size-4",
    "cursor-pointer",
    "clearAll:",
    "h-6",
    "px-2",
    "sourceFilterStackClassNames",
    "root:",
    "gap-x-2 gap-y-1.5",
    "border-b border-border",
    "text-muted-foreground",
    "text-xs",
    "from:",
    "flex-[0_1_auto]",
    "truncate",
    "strong:",
    "whitespace-nowrap font-semibold text-foreground",
    "separator:",
    "w-2.5",
    "select-none",
    "chip:",
    "h-6",
    "gap-1.5",
    "max-w-full",
    "label:",
    "info:",
    "infoStrong:",
    "mx-0.5 font-semibold text-foreground",
    "libraryRoot:",
    "mt-1.5 flex items-center",
    "libraryLabel:",
    "truncate",
] as const;

const DASHBOARD_SOURCE_FILTER_MIGRATED_GLOBAL_SELECTORS = [
    '[data-panel="dashboard-source-filter-stack"]',
    '[data-theme="dark"] [data-panel="dashboard-source-filter-stack"]',
    '[data-part="source-filter-from"] b',
    '[data-part="source-filter-separator"]',
    '[data-part="source-filter-chip"]',
    "[data-stack-label]",
    '[data-part="source-filter-info"]',
    '[data-panel="dashboard-library-search-filter"]',
    '[data-part="library-search-filter-label"]',
    '[data-part="library-search-filter-chip"]',
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
    '[data-part="dashboard-copy-label"]',
    '[data-part="dashboard-copy-icon"]',
    '[data-part="dashboard-transcript-actions"]',
    '[data-control="copy-local-transcript"][hidden]',
    '[data-control="copy-source-transcript"][hidden]',
    '[data-control="copy-source-report"][hidden]',
] as const;

const OLD_UI_RE =
    /uikit-|glass-surface|glass-control|<SourceFilterStackStrip[\s/>]|\.\/components\/source-filter-stack-strip/;

const DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_CLASS_SNIPPETS = [
    {
        propertyName: "dashboardTopbarActions",
        snippets: ["ml-auto flex items-center gap-2"],
    },
    {
        propertyName: "dashboardActivityAnchor",
        snippets: ["relative inline-flex size-[32px]"],
    },
    {
        propertyName: "dashboardActivityTrigger",
        snippets: ["relative"],
    },
    {
        propertyName: "dashboardActivityBadge",
        snippets: [
            "pointer-events-none",
            "absolute",
            "right-0.5",
            "top-0.5",
            "min-w-4",
        ],
    },
    {
        propertyName: "dashboardActivityPanel",
        snippets: ["absolute right-0 top-[calc(100%+8px)]", "w-[380px]"],
    },
    {
        propertyName: "dashboardActivityCount",
        snippets: ["p-0", "font-mono text-xs"],
    },
    {
        propertyName: "dashboardActivityClose",
        snippets: ["size-6"],
    },
    {
        propertyName: "dashboardActivitySync",
        snippets: [
            "h-7",
            "px-2.5",
            "data-[action-state=error]:text-destructive",
            "disabled:cursor-not-allowed",
        ],
    },
    {
        propertyName: "dashboardActivityAction",
        snippets: [
            "h-7",
            "px-2.5",
            "data-[action-state=error]:text-destructive",
            "disabled:cursor-not-allowed",
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
        snippets: ["flex items-center gap-2.5", "bg-muted"],
    },
    {
        propertyName: "dashboardActivityStatusIndicator",
        snippets: [
            "bg-primary",
            "data-[state=error]:bg-destructive",
            "data-[state=running]:animate-[bpulse_1.4s_ease-in-out_infinite]",
            "data-[state=syncing]:animate-[bpulse_1.4s_ease-in-out_infinite]",
        ],
    },
    {
        propertyName: "dashboardActivityItems",
        snippets: ["max-h-[340px]", "overflow-y-auto", "empty:hidden"],
    },
    {
        propertyName: "dashboardActivityItem",
        snippets: ["grid grid-cols-[26px_1fr_auto]", "[&+&]:border-t"],
    },
    {
        propertyName: "dashboardActivityItemIcon",
        snippets: [
            "data-[kind=queued]:bg-muted",
            "data-[kind=queued]:text-muted-foreground",
            "data-[kind=partial-failed]:bg-secondary",
            "data-[kind=partial-failed]:text-secondary-foreground",
        ],
    },
    {
        propertyName: "dashboardActivityItemTitle",
        snippets: ["text-sm", "font-semibold", "text-foreground"],
    },
    {
        propertyName: "dashboardActivityItemMeta",
        snippets: ["font-mono", "text-xs", "text-muted-foreground"],
    },
    {
        propertyName: "dashboardActivityDismiss",
        snippets: ["size-6", "p-0"],
    },
    {
        propertyName: "dashboardActivityEmpty",
        snippets: ["p-7 md:p-7", "[&[hidden]]:hidden"],
    },
] as const;

const LIBRARY_SEARCH_FEATURE_OWNER_SOURCE_SNIPPETS = [
    "aria-expanded={open}",
    'aria-haspopup="dialog"',
    "aria-controls={open ? LIBRARY_SEARCH_DIALOG_ID : undefined}",
    'role="combobox"',
    'role="listbox"',
    'role="option"',
    "placeholder={t(",
    '"librarySearch.shortPlaceholder"',
    "bg-popover",
    "border-border",
    "bg-muted",
    "text-muted-foreground",
    "text-foreground",
    "bg-primary/10",
    "text-primary",
    'variant="destructive"',
] as const;

const DASHBOARD_SEARCH_CONTAINER_SOURCE_SNIPPETS = [
    'from "@/features/dashboard/components/library-search";',
    "<LibrarySearch",
    "open={searchOpen}",
    "query={query}",
    "onApplyFilter={applyLibrarySearchFilter}",
    "onOpenChange={handleLibrarySearchOpenChange}",
    "onOpenRecording={selectRecording}",
    "onQueryChange={setQuery}",
] as const;

const DASHBOARD_ACTIVITY_FEATURE_OWNER_SOURCE_SNIPPETS = [
    "aria-expanded={activityOpen}",
    'data-state={activityOpen ? "open" : "idle"}',
] as const;

const DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE =
    /className=["']btn(?:\s+(?:ghost|primary|glass))?\b|track-fill|track-thumb|sk _is|_is-/;

const DASHBOARD_DETAIL_PANE_SOT_HOOKS = [
    'data-panel="dashboard-transcript-pane"',
    'data-tab-pane="transcript"',
    'surface="dashboard"',
    'data-tab-pane="speakers"',
    'data-part="dashboard-transcript-actions"',
    'part="dashboard-copy-label"',
    'data-part="dashboard-transcript-avatar"',
    'data-list="dashboard-speaker-rows"',
    'data-item="dashboard-speaker-row"',
    'data-part="dashboard-speaker-avatar"',
    'data-part="dashboard-speaker-row-meta"',
    'data-part="dashboard-speaker-name"',
    'data-part="dashboard-speaker-sub"',
    'data-part="dashboard-speaker-bar"',
    '"dashboard-speaker-bar-fill"',
];

const DASHBOARD_TRANSCRIPT_TURN_EMPTY_SOT_HOOKS = [
    'data-item="dashboard-transcript-turn"',
    'data-state="loading"',
    'data-state="ready"',
    'data-part="dashboard-transcript-speaker-time"',
    'data-format="mono"',
    'data-panel="dashboard-transcript-empty"',
    'data-part="dashboard-transcript-empty-icon"',
    'data-part="dashboard-transcript-empty-message"',
    'data-part="dashboard-transcript-empty-sub"',
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

const DASHBOARD_SPEAKER_PANE_OWNER_CLASS_TOKENS = [
    'head: "flex items-center gap-2.5 px-4 pt-3 pb-2"',
    "headTitle:",
    '"flex-1 text-sm font-medium text-muted-foreground"',
    'rows: "m-0 flex list-none flex-col gap-1 px-2 pb-3.5"',
    "grid-cols-[auto_minmax(0,1fr)_minmax(72px,120px)_auto]",
    "hover:bg-accent",
    'rowMeta: "flex min-w-0 flex-col gap-0.5"',
    'name: "truncate text-sm font-medium text-foreground"',
    'sub: "w-fit justify-center font-mono tabular-nums"',
    'avatar: "size-7 flex-none p-0 tabular-nums"',
    'bar: "h-1 bg-muted"',
    'barFill: "bg-primary"',
    'empty: "border-0 py-4 md:py-4"',
] as const;

const DASHBOARD_SPEAKER_PANE_FORBIDDEN_RECONSTRUCTION_TOKENS = [
    "DASHBOARD_SPEAKER_SHARE_CLASS_NAMES",
    "getDashboardSpeakerShareClassName",
    "grid-cols-[28px_1fr_120px_auto]",
    "hover:bg-[var(--bg-recessed)]",
    "text-[var(--fg-",
    "bg-[var(--",
    "border-[var(--",
    "dark:",
    "[font:",
] as const;

const DASHBOARD_SPEAKER_SHARE_VALUE_TOKENS = [
    "DASHBOARD_SPEAKER_SHARE_VALUES",
    "24, 36, 48, 60, 72, 84, 96, 100",
    "getDashboardSpeakerShareValue",
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
    "gap-1.5 overflow-visible rounded-lg shadow-none";
const SOURCE_REPORT_METRIC_CARD_CLASS_TOKENS =
    EXPECTED_SOURCE_REPORT_METRIC_CARD_CLASS_NAME.split(" ");
const EXPECTED_SOURCE_REPORT_METRIC_HEADER_CLASS_NAME =
    "px-[12px] pt-[10px] pb-0";
const SOURCE_REPORT_METRIC_HEADER_CLASS_TOKENS =
    EXPECTED_SOURCE_REPORT_METRIC_HEADER_CLASS_NAME.split(" ");
const EXPECTED_SOURCE_REPORT_METRIC_CONTENT_CLASS_NAME =
    "min-w-0 px-[12px] pb-[10px]";
const SOURCE_REPORT_METRIC_CONTENT_CLASS_TOKENS =
    EXPECTED_SOURCE_REPORT_METRIC_CONTENT_CLASS_NAME.split(" ");
const SOURCE_REPORT_STYLE_OWNER_SNIPPETS = [
    "export type SourceReportTone =",
    "export type SourceReportCardSkeletonSize =",
    "export type SourceReportSegmentSkeletonSize =",
    "export type SourceReportMetaSurface =",
    "export type SourceReportMetaSpacing =",
    "export type SourceReportSubState =",
    "export type SourceReportSurfaceTone =",
    "export function sourceReportMetaSpacingForState",
    "surface: SourceReportMetaSurface",
    "subState?: SourceReportSubState",
    'return "roomy"',
] as const;

const SOURCE_REPORT_PRIMITIVE_OWNER_SNIPPETS = [
    "const sourceReportCardSkeletonClasses =",
    "const sourceReportSegmentSkeletonClasses =",
    "const sourceReportPaneBase =",
    "const sourceReportCopyButtonVariant = {",
    'idle: "ghost"',
    'ok: "secondary"',
    'err: "destructive"',
    "function sourceReportCopyButtonVariantForState(",
    "variant={sourceReportCopyButtonVariantForState(",
    'feedbackState ?? "idle"',
    'type SourceReportActionIntent = "ghost" | "outline" | "primary"',
    "const sourceReportActionButtonVariant = {",
    'ghost: "ghost"',
    'outline: "outline"',
    'primary: "default"',
    "function sourceReportButtonVariantForIntent(",
    "variant={sourceReportButtonVariantForIntent(intent)}",
    'className={cn(intent === "primary" && "min-w-[46px]")}',
    `const sourceReportPaneBase = "flex flex-col gap-3.5"`,
    "const sourceReportStateBase =",
    "const sourceReportMetricCardBase =",
    "text-foreground",
    "font-medium text-muted-foreground",
    "const sourceReportSegmentSpeakerText =",
    "font-semibold text-muted-foreground",
    "mt-[15px] grid grid-cols-2 gap-x-[14px] gap-y-[6px]",
    "sourceReportMetaSpacingClasses",
    'loose: "mb-[15px]"',
    'roomy: "mb-[22px]"',
    "min-w-[46px]",
    "const sourceReportSectionTitleText =",
    "m-0 font-semibold text-foreground",
    "const sourceReportSegmentBodyText =",
    "m-0 font-medium text-foreground [text-wrap:pretty]",
    "const sourceReportSummaryLineText =",
    "m-0 whitespace-pre-wrap font-medium text-foreground [text-wrap:pretty]",
    "const SOURCE_REPORT_STATUS_VARIANT = {",
    'err: "destructive"',
    'neu: "secondary"',
    'ok: "default"',
    'warn: "outline"',
    "grid grid-cols-[80px_1fr] items-baseline gap-2 border-b border-dashed border-border py-1.5",
    "flex flex-col gap-2 border-t border-border pt-2",
] as const;
const SOURCE_REPORT_PRIMITIVE_FORBIDDEN_SHADCN_RESIDUALS = [
    "[[data-theme=dark]_&]",
    "[.dark_&]",
    "dark:",
    "text-[var(",
    "bg-[var(",
    "border-[var(",
    "![font-size:",
    "![line-height:",
    "![letter-spacing:",
    "!tracking-normal",
    "!text-foreground",
] as const;
const SOURCE_REPORT_BUTTON_LOCAL_CVA_FORBIDDEN_SNIPPETS = [
    "sourceReportActionButtonStyles",
    "sourceReportCopyButtonStyles",
    "min-w-[46px] border border-[var(--button-primary-border)]",
    'ghost: "border border-transparent bg-transparent text-[var(--fg-secondary)] shadow-none hover:bg-[var(--bg-recessed)] hover:text-[var(--fg-primary)]"',
    "h-[26px] gap-[6px]",
    "border-[color-mix(in_srgb,var(--signal-success)_36%,transparent)]",
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
    "const sourceReportCardSkeletonClasses =",
    "const sourceReportSegmentSkeletonClasses =",
    'count: "inline-block h-[18px] w-[48px] align-middle rounded-[6px]"',
    'status: "inline-block h-[18px] w-[80px] align-middle rounded-[6px]"',
    'source: "inline-block h-[18px] w-[120px] align-middle rounded-[6px]"',
    '"line-long":',
    '"mt-[6px] inline-block h-[13px] w-[92%] align-middle rounded-[4px]"',
    '"line-medium":',
    '"mt-[6px] inline-block h-[13px] w-[76%] align-middle rounded-[4px]"',
    '"line-wide":',
    '"mt-[6px] inline-block h-[13px] w-[88%] align-middle rounded-[4px]"',
    '"line-short":',
    '"mt-[6px] inline-block h-[13px] w-[60%] align-middle rounded-[4px]"',
    "speaker:",
    "ml-[5px] inline-block h-[12px] w-[54px] align-middle rounded-[4px]",
    'time: "inline-block h-[12px] w-[96px] align-middle rounded-[4px]"',
] as const;

const DASHBOARD_SOURCE_REPORT_LOADED_SOT_HOOKS = [
    "data-source-report-segment-time",
    'data-format="mono"',
    'valueFormat="mono"',
];

const DASHBOARD_SOURCE_REPORT_META_VALUE_HELPER_HOOKS = [
    "data-source-report-meta-value",
    "data-format={valueFormat}",
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
    'data-panel="dashboard-retranscription"',
    'data-part="dashboard-retranscription-disabled-hint"',
    'data-part="dashboard-retranscription-icon"',
    'data-part="dashboard-retranscription-spinner"',
    'data-part="dashboard-retranscription-icon-warn"',
    'data-part="dashboard-retranscription-icon-ok"',
    'data-part="dashboard-retranscription-body"',
    'data-part="dashboard-retranscription-title"',
    'data-part="dashboard-retranscription-sub"',
    'data-part="dashboard-retranscription-actions"',
    'data-part="dashboard-retranscription-refresh-marker"',
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
    '[data-panel="dashboard-retranscription"]',
    '[data-part="dashboard-retranscription-icon"]',
    '[data-part="dashboard-retranscription-icon"] svg',
    '[data-part="dashboard-retranscription-body"]',
    '[data-part="dashboard-retranscription-title"]',
    '[data-part="dashboard-retranscription-sub"]',
    '[data-part="dashboard-retranscription-actions"]',
    '[data-part="dashboard-retranscription-disabled-hint"]',
    '[data-part="dashboard-retranscription-refresh-marker"]',
] as const;

const DASHBOARD_RETRANSCRIPTION_REMOVED_GLOBAL_DISPLAY_SELECTORS = [
    '[data-panel="dashboard-retranscription"]',
    '[data-panel="dashboard-retranscription"][hidden]',
    '[data-panel="dashboard-retranscription"][data-retx-state="idle"]',
    '[data-part="dashboard-retranscription-icon"]',
    '[data-part="dashboard-retranscription-icon-warn"]',
    '[data-part="dashboard-retranscription-icon-ok"]',
    '[data-part="dashboard-retranscription-body"]',
    '[data-part="dashboard-retranscription-actions"]',
    '[data-part="dashboard-retranscription-refresh-marker"]',
    '[data-part="dashboard-retranscription-refresh-marker"][hidden]',
    '[data-part="dashboard-retranscription-disabled-hint"][hidden]',
    "[data-retx-retry]",
    "[data-retx-dismiss]",
] as const;

const DASHBOARD_RETRANSCRIPTION_GLOBAL_REPAINT_DECLARATION_RE =
    /^\s*(?:align-items|justify-content|gap|padding(?:-[\w-]+)?|border(?:-(?:bottom|color|radius|style|width))?|background(?:-clip)?|box-shadow|color|font(?:-[\w-]+)?|width|height|border-radius|flex(?:-(?:basis|direction|grow|shrink|wrap))?|min-width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

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
    'data-control="recording-list-tag-filter-trigger"',
    'data-part="recording-list-tag-filter-label"',
    'data-part="recording-list-tag-filter-count"',
    'data-part="recording-list-tag-filter-caret"',
    'data-list="recording-list-tag-filter-list"',
    'data-part="recording-list-tag-filter-option-label"',
    'data-part="recording-list-tag-filter-option-count"',
    'data-list="dashboard-recording-list-scroll"',
    'data-part="dashboard-recording-list-group"',
    'data-part="dashboard-recording-list-group-heading"',
    'data-part="dashboard-recording-list-group-label"',
    'data-part="dashboard-recording-list-group-count"',
    'data-part="dashboard-recording-list-group-divider"',
    'data-part="recording-list-state-icon"',
    'data-part="recording-list-state-title"',
    'data-part="recording-list-state-description"',
    'data-control="recording-list-open-data-sources"',
    'data-control="recording-list-clear-filters"',
    'data-control="recording-list-clear-timeline"',
    'data-control="recording-list-clear-tag"',
    'data-part="recording-list-page-divider"',
    'data-part="recording-list-page-nav"',
    'data-part="recording-list-page-number"',
];

const DASHBOARD_RECORDING_LIST_RESIDUAL_MIGRATED_GLOBAL_SELECTORS = [
    '[data-part="dashboard-recording-list-header"]',
    '[data-theme="dark"] [data-part="dashboard-recording-list-header"]',
    '[data-part="dashboard-recording-list-titlebar"]',
    '[data-part="dashboard-recording-list-title"]',
    '[data-part="dashboard-recording-list-count"]',
    '[data-list="dashboard-recording-list-scroll"]',
    '[data-list="dashboard-recording-list-scroll"]::-webkit-scrollbar',
    '[data-list="dashboard-recording-list-scroll"]::-webkit-scrollbar-track',
    '[data-list="dashboard-recording-list-scroll"]::-webkit-scrollbar-thumb',
    '[data-list="dashboard-recording-list-scroll"]::-webkit-scrollbar-thumb:hover',
    '[data-part="dashboard-transcript-body"]',
    '[data-part="dashboard-transcript-body"]::-webkit-scrollbar',
    '[data-part="dashboard-transcript-body"]::-webkit-scrollbar-track',
    '[data-part="dashboard-transcript-body"]::-webkit-scrollbar-thumb',
    '[data-part="dashboard-transcript-body"]::-webkit-scrollbar-thumb:hover',
    '[data-panel="dashboard-recording-list-mode"]',
    '[data-part="dashboard-recording-list-mode-label"]',
    '[data-part="dashboard-recording-list-mode-count"]',
    '[data-part="dashboard-recording-list-mode-segmented"]',
    '[data-part="recording-list-state"]',
    '[data-panel="recording-list-pagination"]',
    '[data-part="recording-list-state-icon"]',
    '[data-part="recording-list-state-icon"] svg',
    '[data-part="recording-list-state-title"]',
    '[data-part="recording-list-state-description"]',
    '[data-part="recording-list-page-divider"]',
    '[data-part="recording-list-page-status"]',
    '[data-part="recording-list-page-nav"]',
    '[data-part="recording-list-page-number"]',
] as const;

const DASHBOARD_RECORDING_LIST_RESIDUAL_OWNER_CLASS_REFS = [
    "DASHBOARD_SIDEBAR_FOOTER_CLASS_NAME",
    "DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME",
    "dashboardRecordingListTitlebarStyles.root",
    "dashboardRecordingListTitlebarStyles.title",
    "dashboardRecordingListTitlebarStyles.count",
    "dashboardRecordingListScrollClassName",
    "dashboardRecordingListModeStyles.root",
    "dashboardRecordingListModeStyles.label",
    "dashboardRecordingListModeStyles.count",
    "dashboardRecordingListModeStyles.segmented",
    "dashboardRecordingListStateStyles.root",
    "dashboardRecordingListStateStyles.content",
    "dashboardRecordingListPaginationStyles.root",
    "dashboardRecordingListPaginationStyles.divider",
    "dashboardRecordingListPaginationStyles.status",
    "dashboardRecordingListPaginationStyles.nav",
    "dashboardRecordingListPaginationStyles.number",
] as const;

const DASHBOARD_WORKSPACE_MIGRATED_GLOBAL_SELECTORS = [
    '[data-panel="dashboard-workspace"]',
    '[data-panel="workstation-workspace"]',
] as const;
const MOBILE_OWNER_LAYOUT_MIGRATED_GLOBAL_SELECTORS = [
    '[data-shell="dashboard-workstation"]',
    '[data-shell="recording-workstation"]',
    '[data-panel="dashboard-main"]',
    '[data-surface="dashboard-recording-list"]',
    '[data-panel="recording-detail-list"]',
    '[data-panel="recording-workstation-detail"]',
    '[data-panel="workstation-sidebar"]',
] as const;

const DASHBOARD_SIDEBAR_FOOTER_MIGRATED_GLOBAL_SELECTORS = [
    '[data-part="dashboard-sidebar-footer"]',
] as const;

const DASHBOARD_RECORDING_LIST_HEADER_FORBIDDEN_CLASS_PATTERN =
    /\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;

const DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_SELECTORS = [
    '[data-surface="dashboard-recording-list"][data-slot="card"]',
    '[data-part="dashboard-recording-list-content"][data-slot="card-content"]',
    '[data-control="source-filter-clear"][data-slot="button"]',
    '[data-part="source-filter-action"]',
    '[data-part="source-filter-action"]:focus-visible',
    '[data-part="source-filter-action"][disabled]',
    '[data-control="source-filter-clear-all"][data-slot="button"]',
    '[data-control="library-search-filter-clear"][data-slot="button"]',
    '[data-control="recording-list-tag-filter-trigger"][data-slot="button"]',
    '[data-control="recording-list-tag-filter"][data-slot="button"]',
    '[data-panel="recording-list-pagination"] [data-slot="button"]',
] as const;

const DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_RE =
    /\[data-surface="dashboard-recording-list"\]\[data-slot="card"\]|\[data-part="dashboard-recording-list-content"\]\[data-slot="card-content"\]|\[data-part="source-filter-action"\]|\[data-control="(?:source-filter-clear|source-filter-clear-all|library-search-filter-clear|recording-list-tag-filter-trigger|recording-list-tag-filter)"\]\[data-slot="button"\]|\[data-panel="recording-list-pagination"\][\s\S]{0,80}\[data-slot="button"\]/;

const DASHBOARD_RECORDING_ROW_MIGRATED_GLOBAL_SELECTORS = [
    '[data-list="dashboard-recording-rows"]',
    '[data-part="dashboard-recording-list-group"]',
    '[data-part="dashboard-recording-list-group-heading"]',
    '[data-part="dashboard-recording-list-group-label"]',
    '[data-part="dashboard-recording-list-group-count"]',
    '[data-part="dashboard-recording-list-group-divider"]',
    '[data-control="dashboard-recording-row"]',
    '[data-control="dashboard-recording-row"]:focus-visible',
    '[data-control="dashboard-recording-row"].is-hover-demo',
    '[data-control="dashboard-recording-row"].is-focus-demo',
    '[data-part="dashboard-recording-row-body"]',
    '[data-part="dashboard-recording-row-title"]',
    '[data-part="dashboard-recording-row-meta"]',
    '[data-part="dashboard-recording-row-secondary"]',
    '[data-part="dashboard-recording-row-actions"]',
] as const;

const DASHBOARD_RECORDING_ROW_META_MIGRATED_GLOBAL_SELECTOR_FRAGMENTS = [
    '[data-part="dashboard-recording-duration"]',
    '[data-part="dashboard-recording-timestamp"]',
    '[data-part="dashboard-recording-timestamp-absolute"]',
    '[data-part="dashboard-recording-timestamp-relative"]',
    'body[data-time-style="abs"]',
    '[data-part="dashboard-recording-source-mark"]',
    '[data-part="dashboard-recording-source-mark"] img',
    '[data-part="dashboard-recording-source-mark"][data-provider-cover="true"]',
    '[data-part="dashboard-recording-source-mark"][data-variant="letter"]',
    '[data-theme="dark"] [data-part="dashboard-recording-source-mark"]',
    '[data-theme="dark"] [data-part="dashboard-recording-source-mark"] img',
    '[data-theme="dark"]\n    [data-part="dashboard-recording-source-mark"][data-variant="letter"]',
] as const;

const DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_SELECTORS = [
    '[data-panel="dashboard-transcript-shell"][data-slot="card"]',
    '[data-part="dashboard-transcript-header"][data-slot="card-header"]',
    '[data-part="dashboard-transcript-language"][data-slot="badge"]',
    '[data-part="dashboard-transcript-body"][data-slot="card-content"]',
    '[data-control="copy-local-transcript"][data-slot="button"]',
    '[data-control="copy-source-transcript"][data-slot="button"]',
    '[data-control="copy-source-report"][data-slot="button"]',
    '[data-control="refresh-source-report"][data-slot="button"]',
    '[data-control="retranscribe-recording"][data-slot="button"]',
    '[data-control="retry-retranscription"][data-slot="button"]',
    '[data-control="dismiss-retranscription-failed"][data-slot="button"]',
    '[data-control="dismiss-retranscription-complete"][data-slot="button"]',
] as const;

const DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|line-height|padding|transition|width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

const ROUTE_LOADING_SURFACE_CLASS_TOKENS =
    "min-h-0 gap-0 overflow-hidden rounded-2xl border-border bg-card shadow-sm".split(
        " ",
    );
const ROUTE_FALLBACK_CHROME_SHELL_CLASS_VALUE =
    "flex h-screen min-h-screen bg-background text-foreground transition-all duration-300 ease-out";
const DASHBOARD_ROUTE_LOADING_DETAIL_CLASS_VALUE =
    "flex min-h-0 min-w-0 flex-col gap-4";
const DASHBOARD_LOADING_REMOVED_GLOBAL_SELECTORS = [
    '[data-shell="dashboard-loading"]',
    '[data-panel="dashboard-loading-list"]',
    '[data-panel="dashboard-loading-detail"]',
] as const;
const ROUTE_CHROME_REMOVED_GLOBAL_SELECTORS = [
    '[data-panel="route-sidebar"]',
    '[data-part="route-brand"]',
    '[data-part="route-brand"] img',
    '[data-part="route-brand-name"]',
    '[data-part="route-brand-subtitle"]',
    '[data-panel="route-main"]',
    '[data-panel="route-topbar"]',
    '[data-part="route-crumbs"]',
    '[data-part="route-crumb-current"]',
    '[data-panel="route-workspace"]',
] as const;
const ROUTE_CHROME_FORBIDDEN_FRAMEWORK_RE =
    /var\(--glass|var\(--graphite|color-mix\(|backdrop-filter/;
const GLOBALS_FRAMEWORK_MARKETING_RE =
    /Graphite Glass|SOT web kit|Liquid Glass|Apple-graphite|radial-gradient/;
const REMOVED_DASHBOARD_BRAND_GLOBAL_SELECTORS = [
    '[data-part="dashboard-brand"]',
    '[data-part="dashboard-brand"] img',
    '[data-part="dashboard-brand-name"]',
    '[data-part="dashboard-brand-subtitle"]',
] as const;
const REMOVED_WORKSTATION_BRAND_GLOBAL_SELECTORS = [
    '[data-part="workstation-brand"]',
    '[data-part="workstation-brand"] img',
    '[data-part="workstation-brand-name"]',
    '[data-part="workstation-brand-subtitle"]',
] as const;
const DASHBOARD_BRAND_OWNER_CLASS_INITIALIZERS = [
    {
        property: "wrapper",
        expected: "flex items-center gap-2 px-2 pt-1 pb-4",
    },
    {
        property: "image",
        expected: "size-9 rounded-md",
    },
    {
        property: "name",
        expected: "text-sm font-semibold text-sidebar-foreground",
    },
    {
        property: "subtitle",
        expected: "mt-px text-xs font-medium text-muted-foreground",
    },
] as const;

describe("dashboard SOT foundation", () => {
    it("keeps broad descendant variants out of the dashboard workstation", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        expect(workstation).not.toMatch(/\[&(?:_|>)/);
    });

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
            'data-part="dashboard-brand"',
            'data-part="dashboard-brand-name"',
            'data-part="dashboard-brand-subtitle"',
        ]) {
            expect(workstation).toContain(dataSotPart);
        }
    });

    it("keeps dashboard route loading skeleton on the shadcn primitive contract", () => {
        const loading = readSource("app/(app)/dashboard/loading.tsx");
        const routeChrome = readSource("app/(app)/route-chrome.tsx");
        const cardPrimitive = readSource("components/ui/card.tsx");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const globals = readSource("app/globals.css");
        const routeChromeModule = readSource(
            "app/(app)/route-chrome.module.css",
        );
        const routeFallbackSurfaceClassName = extractBoundedSlice(
            routeChrome,
            "const routeFallbackSurfaceClassName =",
            ";",
        );
        const routeFallbackShellClassName = extractBoundedSlice(
            routeChrome,
            "const routeFallbackShellClassName =",
            ";",
        );
        const dashboardRouteLoadingListClassName = extractBoundedSlice(
            loading,
            "const dashboardRouteLoadingListClassName =",
            ";",
        );
        const routeFallbackDetailLoadingSkeleton = extractBoundedSlice(
            routeChrome,
            "function RouteFallbackDetailLoadingSkeleton",
            "\nexport {",
        );
        const dashboardLoadingShellOpening = extractOpeningElement(
            loading,
            'aria-label="正在加载仪表盘"',
            "section",
        );
        const dashboardLoadingListCard = extractElementSlice(
            loading,
            "className={dashboardRouteLoadingListClassName}",
            "Card",
        );
        const dashboardLoadingListCardOpening = extractOpeningElement(
            loading,
            "className={dashboardRouteLoadingListClassName}",
            "Card",
        );
        const routeFallbackDetailLoadingCard = extractElementSlice(
            routeFallbackDetailLoadingSkeleton,
            "routeFallbackSurfaceClassName,",
            "Card",
        );
        const routeFallbackDetailLoadingCardOpening = extractOpeningElement(
            routeFallbackDetailLoadingSkeleton,
            "routeFallbackSurfaceClassName,",
            "Card",
        );
        const routeFallbackDetailLoadingSkeletonOpenings =
            routeFallbackDetailLoadingSkeleton.match(/<Skeleton[\s\S]*?\/>/g) ??
            [];
        const dashboardLoadingDetailCard = extractElementSlice(
            loading,
            '"flex min-h-0 min-w-0 flex-col gap-4 flex-1",',
            "Card",
        );
        const dashboardDetailLoadingSkeleton = extractBoundedSlice(
            loading,
            "function DashboardDetailLoadingSkeleton",
            "\n}",
        );
        const dashboardDetailLoadingSkeletonOpenings =
            dashboardDetailLoadingSkeleton.match(/<Skeleton[\s\S]*?\/>/g) ?? [];

        expect(loading).toContain(
            'import { Card } from "@/components/ui/card";',
        );
        expect(loading).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(loading).toContain("aria-busy={true}");
        expect(loading).toContain("<Card");
        for (const token of ROUTE_LOADING_SURFACE_CLASS_TOKENS) {
            expect(routeFallbackSurfaceClassName).toContain(token);
        }
        expect(routeFallbackShellClassName).toContain(
            `"${ROUTE_FALLBACK_CHROME_SHELL_CLASS_VALUE}"`,
        );
        expect(dashboardRouteLoadingListClassName).toContain(
            "routeFallbackSurfaceClassName",
        );
        expect(routeChrome).toContain(
            "function RouteFallbackDetailLoadingSkeleton",
        );
        expect(dashboardLoadingShellOpening).toContain("aria-busy={true}");
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
        expect(routeFallbackDetailLoadingCardOpening).toContain(
            "className={cn(",
        );
        expect(routeFallbackDetailLoadingCardOpening).toContain(
            "routeFallbackSurfaceClassName,",
        );
        expect(routeFallbackDetailLoadingCardOpening).toContain(
            `"${DASHBOARD_ROUTE_LOADING_DETAIL_CLASS_VALUE}"`,
        );
        expect(dashboardLoadingDetailCard).toContain("hasNoPadding");
        expect(loading).not.toContain('variant="routeLoadingSurface"');
        expect(cardPrimitive).not.toContain("routeLoadingSurface");
        for (const loadingSkeletonClassName of [
            "recordingListLoadingDayLabelClassName",
            "recordingListLoadingTitleClassName",
            "recordingListLoadingTitle80ClassName",
            "recordingListLoadingMetaTimeClassName",
            "recordingListLoadingMetaTagClassName",
            "recordingListLoadingMetaPillClassName",
            "recordingListLoadingTagClassName",
        ]) {
            expect(skeletonPrimitive).not.toContain(loadingSkeletonClassName);
            expect(loading).toContain(`const ${loadingSkeletonClassName} =`);
            expect(loading).not.toContain(`size="${loadingSkeletonClassName}"`);
        }
        expect(
            routeFallbackDetailLoadingSkeletonOpenings.map(
                (opening) => opening.match(/className="([^"]+)"/)?.[1],
            ),
        ).toEqual([
            "size-8 rounded-full",
            "h-2 w-20 rounded",
            "h-2 w-20 rounded",
            "h-2 w-3/5 rounded",
            "h-2 w-20 rounded",
            "h-2 w-11/12 rounded",
        ]);
        expect(
            dashboardDetailLoadingSkeletonOpenings.map(
                (opening) => opening.match(/className="([^"]+)"/)?.[1],
            ),
        ).toEqual([
            "size-8 rounded-full",
            "h-2 w-20 rounded",
            "h-2 w-20 rounded",
            "h-2 w-3/5 rounded",
            "h-2 w-20 rounded",
            "h-2 w-11/12 rounded",
        ]);
        for (const skeletonOpening of routeFallbackDetailLoadingSkeletonOpenings) {
            expect(skeletonOpening).toContain('variant="default"');
            expect(skeletonOpening).toContain('size="default"');
            expect(skeletonOpening).toContain('className="');
        }
        expect(routeFallbackDetailLoadingSkeleton).not.toMatch(
            /data-sot|\bsot\b|style=|var\(--/i,
        );
        expect(loading).toContain("<Skeleton");
        expect(routeChrome).toContain("<Skeleton");
        expect(loading).toContain('aria-hidden="true"');
        expect(routeChrome).toContain('aria-hidden="true"');
        expect(loading).not.toContain(
            "const recordingListLoadingSkeletonClassNames",
        );
        expect(loading).toContain('variant="default"');
        expect(routeChrome).toContain('variant="default"');
        expect(loading).toContain('size="default"');
        expect(routeChrome).toContain('size="default"');
        expect(loading).toContain("className={");
        expect(loading).toContain('aria-label="正在加载仪表盘"');
        expect(loading).toContain('aria-label="应用导航"');
        expect(loading).toContain('aria-label="当前页面"');
        for (const routeElement of ["<aside", "<main", "<header"]) {
            expect(routeChrome).toContain(routeElement);
        }
        expect(routeChrome).not.toContain('data-panel="route-');
        expect(loading).not.toContain('data-panel="dashboard-loading');
        expect(loading).not.toContain('from "../route-chrome";');
        expect(loading).not.toContain("RouteFallbackChrome");
        expect(loading).not.toContain("RouteFallbackDetailLoadingSkeleton");
        expect(loading).toContain("routeFallbackSurfaceClassName");
        expect(loading).not.toContain("routeChromeStyles");
        expect(loading).not.toContain("route-chrome.module.css");
        expect(routeChromeModule.trim()).toBe("");
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
            '[data-panel="recording-route-loading-detail"]',
            '[data-panel="recording-list-loading"]',
            '[data-panel="recording-detail-loading"]',
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
        expect(workstation).not.toContain(['className="', "!"].join(""));
        expect(workstation).not.toContain(["!", "[right:1px]"].join(""));
        expect(workstation).toContain('className="right-px"');
        expect(workstation).not.toContain(["SOT", "DASHBOARD", ""].join("_"));
        const detailHeader = extractOpeningElement(
            workstation,
            'data-panel="dashboard-detail-header"',
            "CardHeader",
        );
        const detailHeaderTitle = extractOpeningElement(
            workstation,
            'data-part="detail-header-title"',
            "CardTitle",
        );
        const detailHeaderTitleInput = extractOpeningElement(
            workstation,
            'data-part="detail-header-title-input"',
            "Input",
        );
        const detailHeaderLocalBadge = extractOpeningElement(
            workstation,
            'data-part="detail-header-local-badge"',
            "Badge",
        );
        const detailHeaderStatusBadge = extractOpeningElement(
            workstation,
            'data-part="detail-header-title-status"',
            "Badge",
        );
        expect(detailHeader).toContain(
            `className="${EXPECTED_DASHBOARD_DETAIL_HEADER_CLASS_NAME}"`,
        );
        expect(detailHeaderTitle).toContain(
            `className="${EXPECTED_DASHBOARD_DETAIL_HEADER_TITLE_CLASS_NAME}"`,
        );
        expect(detailHeaderTitleInput).toContain(
            `className="${EXPECTED_DASHBOARD_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME}"`,
        );
        expect(detailHeaderLocalBadge).toContain(
            `className="${EXPECTED_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME}"`,
        );
        expect(detailHeaderStatusBadge).toContain(
            `className="${EXPECTED_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME}"`,
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
            'headerIconButton: "text-muted-foreground"',
        );
        expect(workstation).toContain('headerActionButton: "min-w-[103px]"');
        const dashboardButtonClassNames = extractBoundedSlice(
            workstation,
            "const dashboardButtonClassNames = {",
            "} as const;",
        );
        for (const rebuiltHeaderActionToken of [
            "border border-transparent bg-transparent",
            "border border-border bg-card",
            "shadow-xs",
            "gap-[7px]",
            "rounded-[9px]",
            "has-[>svg]:px-3",
        ]) {
            expect(dashboardButtonClassNames).not.toContain(
                rebuiltHeaderActionToken,
            );
        }
        expect(workstation).not.toContain(
            "[&_svg:not([class*='size-'])]:size-4",
        );
        const moreActionsMenu = extractOpeningElement(
            workstation,
            'data-menu="recording-more-actions"',
            "DropdownMenuContent",
        );
        const renameMenuItem = extractOpeningElement(
            workstation,
            'data-menu-item="rename"',
            "DropdownMenuItem",
        );
        const localDeleteMenuItem = extractOpeningElement(
            workstation,
            'data-menu-item="delete-local"',
            "DropdownMenuItem",
        );
        const deleteSeparator = extractOpeningElement(
            workstation,
            'data-menu-separator="delete"',
            "DropdownMenuSeparator",
        );
        expect(moreActionsMenu).toContain('variant="glass"');
        expect(moreActionsMenu).not.toContain("className=");
        expect(renameMenuItem).toContain('density="compact"');
        expect(renameMenuItem).not.toContain("className=");
        expect(localDeleteMenuItem).toContain('density="compact"');
        expect(localDeleteMenuItem).toContain('variant="destructive"');
        expect(localDeleteMenuItem).not.toContain("className=");
        expect(deleteSeparator).toContain('density="compact"');
        expect(deleteSeparator).not.toContain("className=");
        for (const selector of [
            'data-control="rename-recording-title"',
            'data-control="recording-more-actions"',
            'data-control="ai-rename"',
        ]) {
            expect(globals).not.toContain(selector);
        }
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-panel="dashboard-detail-header"]',
            ).filter(
                ({ prelude }) =>
                    !prelude.includes(
                        '[data-panel="dashboard-detail"][data-empty="true"]',
                    ),
            ),
        ).toEqual([]);
        expect(globals).not.toContain('[data-part="detail-header-title"]');

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
        const playerPrimitives = readSource(
            "features/recordings/components/player-primitives.tsx",
        );
        const globals = readSource("app/globals.css");
        const playerSurfaceIndex = workstation.indexOf(
            'data-surface="dashboard-recording-player"',
        );
        const playerStart = workstation.lastIndexOf(
            "<Card",
            playerSurfaceIndex,
        );
        const transcriptShellIndex = workstation.indexOf(
            'data-panel="dashboard-transcript-shell"',
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
            "PlayerStatusBadge",
        );
        const statusVariantBlock = extractBoundedSlice(
            playerPrimitives,
            "const PLAYER_STATUS_VARIANT",
            "export function PlayerStatusBadge",
        );
        const playerStatusPrimitiveBadge = extractOpeningElement(
            playerPrimitives,
            'data-control="player-status"',
            "Badge",
        );
        const noAudioAlert = extractOpeningElement(
            player,
            'part="dashboard-recording-player-no-audio"',
            "PlayerNoAudioAlert",
        );
        const playerMetaHeader = extractOpeningElement(
            player,
            'data-part="dashboard-recording-player-meta"',
            "CardHeader",
        );
        const playerControlsCallsite = extractSelfClosingElement(
            player,
            "<DashboardRecordingPlayerControls",
            "DashboardRecordingPlayerControls",
        );
        const volumeMuteControl = extractOpeningElement(
            playerControls,
            'data-control="dashboard-player-volume-mute"',
            "Button",
        );
        const playerVolumeControl = extractOpeningElement(
            playerControls,
            'data-control="dashboard-player-volume"',
            "Button",
        );
        const playerBackControl = extractOpeningElement(
            playerControls,
            'data-control="dashboard-player-back"',
            "Button",
        );
        const playerPlayControl = extractOpeningElement(
            playerControls,
            'data-control="dashboard-player-play"',
            "Button",
        );
        const playerForwardControl = extractOpeningElement(
            playerControls,
            'data-control="dashboard-player-forward"',
            "Button",
        );
        const playerDate = extractOpeningElement(
            player,
            'data-part="dashboard-recording-player-date"',
            "span",
        );
        const playerCurrentTime = extractOpeningElement(
            playerControls,
            'data-part="dashboard-player-current-time"',
            "span",
        );
        const playerDuration = extractOpeningElement(
            playerControls,
            'data-part="dashboard-player-duration"',
            "span",
        );
        const playerSeekShell = extractOpeningElement(
            playerControls,
            'data-part="dashboard-player-seek-shell"',
            "span",
        );
        const playerSeekSlider = extractSelfClosingElement(
            playerControls,
            'data-control="dashboard-player-seek"',
            "Slider",
        );
        const playerSpeed = extractOpeningElement(
            playerControls,
            'data-control="dashboard-player-speed"',
            "Button",
        );
        const playerVolumeAnchor = extractOpeningElement(
            playerControls,
            'data-part="dashboard-player-volume-anchor"',
            "div",
        );
        const playerVolumeValue = extractOpeningElement(
            playerControls,
            'data-part="dashboard-player-volume-value"',
            "span",
        );
        const playerCardOpening = extractOpeningElement(
            player,
            'data-surface="dashboard-recording-player"',
            "Card",
        );
        const playerCardBlock = extractElementSlice(
            player,
            'data-surface="dashboard-recording-player"',
            "Card",
        );
        const hiddenAudio = extractElementSlice(
            playerCardBlock,
            "<audio",
            "audio",
        );

        expect(player).toContain("<Card");
        expect(playerCardOpening).toContain("hasNoPadding");
        expect(playerCardOpening).toContain(
            `className="${EXPECTED_DASHBOARD_RECORDING_PLAYER_CARD_CLASS_NAME}"`,
        );
        expect(playerCardOpening).toContain(
            'data-surface="dashboard-recording-player"',
        );
        expect(playerCardOpening).toContain("data-no-audio={");
        expect(playerCardOpening).toContain("data-playing={");
        expect(playerCardOpening).toContain("data-state={");
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
            playerControls,
            DASHBOARD_RECORDING_PLAYER_CONTROLS_CLASS_INITIALIZERS,
        );
        expect(playerMetaHeader).toContain(
            `className="${EXPECTED_DASHBOARD_RECORDING_PLAYER_META_CLASS_NAME}"`,
        );
        expect(playerDate).toContain(
            `className="${EXPECTED_DASHBOARD_RECORDING_PLAYER_DATE_CLASS_NAME}"`,
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
            'data-part="dashboard-player-control-icon"',
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
            'className="min-w-11 text-center tabular-nums text-muted-foreground"',
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
        expect(playerSpeed).toContain("data-state={playerControlState}");
        expect(workstation).toContain(
            'import { DashboardRecordingPlayerControls } from "@/features/dashboard/components/dashboard-recording-player-controls";',
        );
        for (const [prop, value] of [
            ["currentTime", "currentTime"],
            ["duration", "playerDurationValue"],
            ["isPlaying", "isPlaying"],
            ["onCyclePlaybackSpeed", "cyclePlaybackSpeed"],
            ["onSeekBySeconds", "seekDashboardPlayerBySeconds"],
            ["onSeekToPercent", "seekDashboardPlayerToPercent"],
            ["onTogglePlayPause", "togglePlayPause"],
            ["onVolumeChange", "setVolume"],
            ["onVolumeOpenChange", "setVolumeOpen"],
            ["playbackDisabled", "playbackDisabled"],
            ["playbackSpeedLabel", "playbackSpeedLabel"],
            ["progress", "progress"],
            ["volume", "volume"],
            ["volumePopoverOpen", "volumePopoverOpen"],
        ]) {
            expect(playerControlsCallsite).toMatch(
                new RegExp(`${prop}=\\{\\s*${value}\\s*\\}`),
            );
        }
        for (const workstationDirectControlToken of [
            "<PlayerControlButton",
            "<PlayerPrimaryButton",
            "<PlayerSpeedButton",
            "<PlayerSeekSlider",
            "<PlayerVolumeSlider",
            'data-control="dashboard-player-back"',
            'data-control="dashboard-player-play"',
            'data-control="dashboard-player-forward"',
            'data-control="dashboard-player-seek"',
            'data-control="dashboard-player-speed"',
            'data-control="dashboard-player-volume"',
            'data-control="dashboard-player-volume-mute"',
            'data-control="dashboard-player-volume-slider"',
            'data-part="dashboard-player-control-icon"',
            'data-part="dashboard-player-current-time"',
            'data-part="dashboard-player-duration"',
            'data-part="dashboard-player-seek-shell"',
            'data-part="dashboard-player-volume-anchor"',
            'data-part="dashboard-player-volume-value"',
        ]) {
            expect(workstation).not.toContain(workstationDirectControlToken);
        }
        expect(player).toContain("<PlayerNoAudioAlert");
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
        expect(playerPrimitives).toContain("PlayerNoAudioAlert");
        expectPlayerNoAudioPrimitiveBindings(playerPrimitives);
        expect(playerPrimitives).not.toContain("<PlayerNoAudioIcon");
        expect(player).not.toContain(
            '<PlayerNoAudioIcon className="size-3.5" />',
        );
        expect(player).toContain(
            'textPart="dashboard-recording-player-no-audio-text"',
        );
        expect(player).toContain("<CardHeader");
        expect(player).toContain(
            `className="${EXPECTED_DASHBOARD_RECORDING_PLAYER_META_CLASS_NAME}"`,
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
            "type PlayerButtonProps",
            "PlayerControlButton",
            "PlayerPrimaryButton",
            "PlayerSpeedButton",
        ]) {
            expect(playerPrimitives).not.toContain(
                removedPlayerButtonPrimitiveToken,
            );
        }
        expect(button).not.toContain("dashboard-player-volume-icon");
        expect(button).not.toContain("recording-player-volume-icon");
        expect(playerControls).toContain("<Button");
        expect(playerControls).not.toContain("<PlayerControlButton");
        expect(playerControls).not.toContain("<PlayerPrimaryButton");
        expect(playerControls).not.toContain("<PlayerSpeedButton");
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
        expect(badge).not.toContain("[&_[data-part=status-dot]]");
        expect(badge).not.toContain("[&_[data-part=status-label]]");
        expect(playerPrimitives).toContain("const PLAYER_STATUS_VARIANT");
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
        expect(playerPrimitives).not.toContain("PLAYER_STATUS_TONE_CLASS");
        expect(playerStatusPrimitiveBadge).toContain(
            "variant={PLAYER_STATUS_VARIANT[tone]}",
        );
        expect(playerStatusPrimitiveBadge).toContain("className={className}");
        expect(playerStatusPrimitiveBadge).toContain(
            'data-control="player-status"',
        );
        expect(playerStatusPrimitiveBadge).toContain("data-tone={tone}");
        expect(playerPrimitives).not.toContain(
            '"size-1.5 rounded-full bg-current"',
        );
        expect(playerPrimitives).not.toContain("animate-[bpulse");
        expect(playerPrimitives).not.toContain("--source-provider-status");
        expect(badge).not.toContain("playerTagChip:");
        expect(badge).not.toContain("playerTagOverflow:");
        expect(player).toContain("<PlayerStatusBadge");
        expect(statusBadge).toMatch(
            /label=\{\s*selectedPlayerStatus\.label\s*\}/,
        );
        expect(statusBadge).toMatch(
            /tone=\{\s*selectedPlayerStatus\.tone\s*\}/,
        );
        expect(statusBadge).toContain('className="ml-auto"');
        expect(playerPrimitives).not.toContain("SOT_PLAYER_STATUS_BADGE_CLASS");
        expect(playerPrimitives).toContain("className?: string;");
        expect(playerPrimitives).not.toContain("[&_[data-part=status-dot]]");
        expect(playerPrimitives).not.toContain('data-part="status-dot"');
        expect(playerPrimitives).toContain('data-part="status-label"');
        expectPlayerSourcePrimitiveBindings(playerPrimitives);
        for (const playerTagClassConstant of [
            "PLAYER_TAG_COLOR_CLASS",
            "PLAYER_TAG_CHIP_CLASS",
            "PLAYER_TAG_OVERFLOW_CLASS",
        ]) {
            expect(playerPrimitives).toContain(playerTagClassConstant);
        }
        for (const removedPlayerTagClassConstant of [
            "SOT_PLAYER_TAG_BADGE_CLASS",
            "SOT_PLAYER_TAG_OVERFLOW_BADGE_CLASS",
            "SOT_PLAYER_TAG_ADD_BUTTON_CLASS",
            "SOT_PLAYER_TAG_CHIP_BUTTON_CLASS",
            "SOT_PLAYER_TAG_OVERFLOW_BUTTON_CLASS",
            "SOT_PLAYER_TAG_CHIP_VARIABLES_CLASS",
            "SOT_PLAYER_TAG_COLOR_TOKEN",
        ]) {
            expect(playerPrimitives).not.toContain(
                removedPlayerTagClassConstant,
            );
        }
        for (const playerTagChipToken of [
            "--sot-player-tag-chip-bg",
            "--sot-player-tag-chip-border",
            "--sot-player-tag-chip-fg",
            "--sot-player-tag-chip-blue-bg",
            "--sot-player-tag-chip-blue-border",
            "--sot-player-tag-chip-blue-fg",
        ]) {
            expect(globals).not.toContain(playerTagChipToken);
            expect(playerPrimitives).not.toContain(playerTagChipToken);
        }
        expect(playerPrimitives).not.toContain("playerTagChipStyle");
        expect(playerPrimitives).not.toContain(
            'background: "var(--sot-player-tag-chip-bg)"',
        );
        expect(playerPrimitives).not.toContain(
            'borderColor: "var(--sot-player-tag-chip-border)"',
        );
        expect(playerPrimitives).not.toContain(
            'color: "var(--sot-player-tag-chip-fg)"',
        );
        expect(globals).not.toContain("dashboard-recording-tag-chip");
        expect(badge).not.toContain("dashboard-recording-tag-chip");
        expect(playerPrimitives).not.toContain("dashboard-recording-tag-chip");
        expect(playerControls).toContain(
            'data-panel="dashboard-recording-player-controls"',
        );
        expect(playerControls).toContain(
            'data-control="dashboard-player-seek"',
        );
        expect(playerControls).toContain("<Slider");
        expect(playerControls).toContain('"flex-none"');
        expect(playerSeekSlider).toContain(
            'aria-disabled={disabled ? "true" : undefined}',
        );
        expect(playerSeekSlider).toContain(
            "aria-valuenow={Math.round(progress)}",
        );
        expect(playerSeekSlider).toContain("data-state={controlState}");
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
        expect(playerControls).not.toContain("playerSeekRangeStyle");
        expect(playerControls).not.toContain("playerSeekThumbStyle");
        expect(playerControls).not.toContain("className: SOT_PLAYER");
        expect(playerControls).not.toContain("style: player");
        expect(playerControls).not.toContain(
            "style: dashboardSeekSliderRootStyle",
        );
        expect(playerControls).toContain(
            'data-control="dashboard-player-volume"',
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
            "PlayerSeekSlider",
            "PlayerVolumeSlider",
            "PlayerVolumePopoverContent",
        ]) {
            expect(playerPrimitives).not.toContain(wrapperToken);
        }

        for (const removedGlobalSelector of REMOVED_DASHBOARD_PLAYER_GLOBAL_SELECTOR_FRAGMENTS) {
            expect(globals).not.toContain(removedGlobalSelector);
            expect(alert).not.toContain(removedGlobalSelector);
            expect(badge).not.toContain(removedGlobalSelector);
            expect(button).not.toContain(removedGlobalSelector);
            expect(card).not.toContain(removedGlobalSelector);
            expect(playerPrimitives).not.toContain(removedGlobalSelector);
        }
        expect(globals).not.toContain(
            '[data-surface="dashboard-recording-player"][data-slot="card"]',
        );
        expect(globals).not.toMatch(
            /\[data-surface="dashboard-recording-player"\]\s+\[data-part="dashboard-recording-player-meta"\]\[data-slot="card-header"\]/,
        );
        expect(globals).not.toMatch(
            /\[data-surface="dashboard-recording-player"\]\s+\[data-panel="dashboard-recording-player-controls"\]\[data-slot="card-content"\]/,
        );
        expect(globals).not.toContain(
            '[data-control="player-status"][data-slot="badge"]',
        );
        expect(
            collectCssRuleBlocks(globals, '[data-control="player-status"]'),
        ).toEqual([]);
        for (const selector of [
            '[data-part="dashboard-recording-player-no-audio"][data-slot="alert"]',
            '[data-part="dashboard-recording-player-no-audio-title"][data-slot="alert-title"]',
            '[data-part="dashboard-recording-player-no-audio-description"][data-slot="alert-description"]',
            '[data-panel="dashboard-player-volume-popover"][data-slot="popover-content"]',
            '[data-control="player-source-tag"][data-slot="badge"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
        for (const [surface, selector] of [
            [
                '[data-surface="dashboard-recording-player"]',
                '[data-panel="dashboard-player-volume-popover"]',
            ],
            [
                '[data-surface="dashboard-recording-player"]',
                '[data-panel="dashboard-player-volume-popover"][hidden]',
            ],
            [
                '[data-surface="dashboard-recording-player"]',
                '[data-panel="dashboard-player-volume-popover"][data-open="true"]',
            ],
            [
                '[data-surface="dashboard-recording-player"]',
                '[data-part="dashboard-player-volume-row"]',
            ],
            [
                '[data-surface="dashboard-recording-player"]',
                '[data-part="dashboard-player-volume-icon"]',
            ],
            [
                '[data-surface="dashboard-recording-player"]',
                '[data-part="dashboard-player-volume-value"]',
            ],
        ] as const) {
            expect(
                collectCssRuleBlocks(globals, selector).filter(({ prelude }) =>
                    prelude.includes(surface),
                ),
            ).toEqual([]);
        }
        for (const selector of [
            '[data-part="dashboard-player-seek-shell"]',
            '[data-part="dashboard-player-volume-anchor"]',
        ]) {
            expect(playerControls).toContain(selector.replace(/\[|\]/g, ""));
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(playerControls).not.toContain(
            'data-part="dashboard-player-seek-thumb"',
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
                        prelude.includes(`[data-control="${control}"]`),
                    ),
            ),
        );
        expect(dashboardPlayerSliderPrimitiveBlocks).toEqual([]);
    });

    it("renders the dashboard from the SOT workstation shell instead of compatibility components", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const librarySearch = readSource(
            "features/dashboard/components/library-search.tsx",
        );
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
            expect(workstation).not.toContain(copyStateClass);
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
        expect(workstation).toContain("<LibrarySearch");
        expect(workstation).toContain(
            'from "@/features/dashboard/components/library-search";',
        );

        expect(workstation).toContain('data-surface="dashboard-workstation"');
        expect(workstation).toContain(
            'data-state={hydrated ? "ready" : "loading"}',
        );
        expect(workstation).toContain('data-shell="dashboard-workstation"');
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
        expect(workstation).toContain('data-panel="dashboard-sidebar"');
        expect(workstation).toContain('data-list="dashboard-nav"');
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
        ).toContain("tracking-wide");
        expect(
            extractObjectStringProperty(
                dashboardNavClassNames,
                "favoriteCount",
            ),
        ).toContain("min-w-6");
        expect(
            extractObjectStringProperty(
                dashboardNavClassNames,
                "favoriteCount",
            ),
        ).not.toContain("dark:data-[state=selected]");
        const dashboardNav = extractOpeningElement(
            workstation,
            'data-list="dashboard-nav"',
            "nav",
        );
        expect(dashboardNav).toContain(
            "className={dashboardNavClassNames.root}",
        );
        expect(workstation).toContain('data-panel="dashboard-main"');
        const dashboardMain = extractOpeningElement(
            workstation,
            'data-panel="dashboard-main"',
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
            '[data-panel="dashboard-main"]',
        );
        expect(dashboardMainGlobalBlocks).toEqual([]);
        expect(globals).not.toContain(
            '[data-panel="dashboard-main"] {\n    display: flex;\n    flex-direction: column;\n    min-width: 0;\n    height: 100vh;\n}',
        );
        for (const selector of MOBILE_OWNER_LAYOUT_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(workstation).toContain('data-panel="dashboard-topbar"');
        const dashboardTopbar = extractOpeningElement(
            workstation,
            'data-panel="dashboard-topbar"',
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
            'data-panel="dashboard-workspace"',
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
            '[data-panel="dashboard-workspace"]\n        > [data-panel="dashboard-detail"]',
        );
        const dashboardSidebar = extractOpeningElement(
            workstation,
            'data-panel="dashboard-sidebar"',
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
            '[data-theme="dark"] [data-panel="dashboard-sidebar"],\n.dark [data-panel="dashboard-sidebar"]',
        );
        const dashboardSidebarGlobalBlocks = collectCssRuleBlocks(
            globals,
            '[data-panel="dashboard-sidebar"]',
        );
        expect(dashboardSidebarGlobalBlocks).toEqual([]);
        expect(globals).not.toContain(
            '[data-control="dashboard-sync"][disabled]',
        );
        expect(button).toContain("disabled:pointer-events-none");
        expect(workstation).toContain("disabled={syncButtonBusy}");
        expect(globals).not.toContain('[data-panel="settings-scroll-body"]');
        expect(globals).not.toContain("[data-detail-empty]");
        expect(workstation).toContain('data-panel="dashboard-workspace"');
        const dashboardDetailPanel = extractOpeningElement(
            workstation,
            'data-panel="dashboard-detail"',
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
            'data-control="dashboard-drawer-trigger"',
        );
        expect(workstation).toContain('id="drawer-scrim"');
        expect(workstation).toContain('id="drawer-trigger"');
        expect(workstation).not.toContain("data-drawer-open=");
        expect(workstation).not.toContain(
            'data-surface="dashboard-source-rail"',
        );
        expect(librarySearch).toContain('aria-haspopup="dialog"');
        expect(workstation).toContain('data-control="dashboard-activity"');
        const dashboardSearchSlice = librarySearch;
        for (const featureHook of [
            "aria-expanded={open}",
            "aria-controls={open ? LIBRARY_SEARCH_DIALOG_ID : undefined}",
            'role="dialog"',
            'aria-autocomplete="list"',
            'role="combobox"',
            'aria-label={t("librarySearch.clearSearch")}',
            'aria-label={t("librarySearch.scopeLegend")}',
            'role="listbox"',
            'role="option"',
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
            'data-part="dashboard-activity-anchor"',
            'data-control="dashboard-settings"',
        );
        for (const featureHook of [
            'data-control="dashboard-activity"',
            'data-panel="dashboard-activity"',
            'data-part="dashboard-activity-count"',
            'data-control="dashboard-activity-close"',
            'data-control="dashboard-activity-sync"',
            'data-control="dashboard-activity-action"',
            'data-control="dashboard-activity-dismiss"',
            'data-list="dashboard-activity-items"',
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
        for (const snippet of LIBRARY_SEARCH_FEATURE_OWNER_SOURCE_SNIPPETS) {
            expect(librarySearch).toContain(snippet);
        }
        for (const snippet of DASHBOARD_SEARCH_CONTAINER_SOURCE_SNIPPETS) {
            expect(workstation).toContain(snippet);
        }
        const searchOpenChangeCallback = extractBoundedSlice(
            workstation,
            "function handleLibrarySearchOpenChange(open: boolean) {",
            "function applyLibrarySearchFilter(filter: LibrarySearchFilter) {",
        );
        expect(searchOpenChangeCallback).toContain("if (open) {");
        for (const closeCompetingOverlay of [
            "setActivityOpen(false);",
            "setMoreOpen(false);",
            "setTagOpen(false);",
            "setAiOpen(false);",
        ]) {
            expect(searchOpenChangeCallback).toContain(closeCompetingOverlay);
        }
        expect(searchOpenChangeCallback).toContain("setSearchOpen(open);");
        const searchFilterCallback = extractBoundedSlice(
            workstation,
            "function applyLibrarySearchFilter(filter: LibrarySearchFilter) {",
            "async function runActivityAction(item: ActivityItem) {",
        );
        expect(searchFilterCallback).toContain(
            "setLibrarySearchFilter(filter);",
        );
        expect(searchFilterCallback).toContain('setFavorite("all");');
        expect(searchFilterCallback).toContain(
            'applyListMode("timeline", { fromFavorite: true });',
        );
        for (const snippet of DASHBOARD_ACTIVITY_FEATURE_OWNER_SOURCE_SNIPPETS) {
            expect(workstation).toContain(snippet);
        }
        expect(workstation).not.toContain("const SEARCH_SCOPES");
        expect(workstation).not.toContain("const searchPanelState");
        expect(workstation).not.toContain('data-panel="library-search"');
        expect(librarySearch).toContain(
            `fetch(\`/api/search?\${params.toString()}\`)`,
        );
        expect(librarySearch).toContain("}, 180);");
        expect(librarySearch).toContain("setSearchRetry((value) => value + 1)");
        expect(librarySearch).toContain("searchIndexing?.active");
        expect(librarySearch).toContain("handleLibrarySearchKeyDown");
        expect(librarySearch).toContain("searchInputRef.current?.focus({");
        expect(librarySearch).toContain("searchTriggerRef.current?.focus({");
        const dashboardFavoriteButton = extractBoundedSlice(
            workstation,
            'data-control="dashboard-favorite"',
            'data-part="dashboard-favorite-label"',
        );
        const dashboardFavoriteButtonOpening = extractOpeningElement(
            workstation,
            'data-control="dashboard-favorite"',
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
        expect(workstation).not.toContain("const DASHBOARD_ICON_CLASS_NAME =");
        expect(workstation).not.toContain("DASHBOARD_TINY_ICON_CLASS_NAME");
        expect(workstation).not.toContain("DASHBOARD_MICRO_ICON_CLASS_NAME");
        expect(workstation).not.toContain(
            "DASHBOARD_RECORDING_LIST_STATE_ICON_CLASS_NAME",
        );
        expect(workstation).not.toContain(
            "DASHBOARD_ACTIVITY_ITEM_ICON_CLASS_NAME",
        );
        expect(dashboardNavButtonClassName).toContain(
            "data-[state=selected]:text-sidebar-accent-foreground",
        );
        const dashboardFavoriteCount = extractOpeningElement(
            workstation,
            'data-part="dashboard-favorite-count"',
            "Badge",
        );
        expect(dashboardFavoriteCount).toContain(
            "dashboardNavClassNames.favoriteCount",
        );
        expect(dashboardFavoriteCount).toContain(
            "data-state={\n                                        favorite === item.value",
        );
        const dashboardNavSectionLabel = extractOpeningElement(
            workstation,
            'data-part="dashboard-nav-section-label"',
            "div",
        );
        expect(dashboardNavSectionLabel).toContain(
            "dashboardNavClassNames.sectionLabel",
        );
        expect(dashboardFavoriteButton).not.toContain("className={DASHBOARD");
        const dashboardActivityDismissButton = extractBoundedSlice(
            workstation,
            'data-control="dashboard-activity-dismiss"',
            "</Button>",
        );
        expect(dashboardActivityDismissButton).toContain(
            'data-icon="inline-start"',
        );
        expect(dashboardActivityDismissButton).not.toContain(
            "DASHBOARD_MICRO_ICON_CLASS_NAME",
        );
        const dashboardActivityStatusSub = extractOpeningElement(
            workstation,
            'data-part="dashboard-activity-status-sub"',
            "div",
        );
        expect(dashboardActivityStatusSub).toContain('data-format="mono"');
        expect(dashboardActivityStatusSub).toContain(
            "dashboardSearchActivityClassNames.dashboardActivityStatusSub",
        );
        expect(
            extractObjectStringProperty(
                dashboardSearchActivityClassNames,
                "dashboardActivityStatusSub",
            ),
        ).toContain("font-mono text-xs");
        expect(globals).not.toContain(
            '[data-part="dashboard-activity-status-sub"]',
        );
        const dashboardSettingsDialog = extractSelfClosingElement(
            workstation,
            'data-control="dashboard-settings"',
            "SettingsDialog",
        );
        const dashboardSettingsTrigger = extractElementSlice(
            dashboardSettingsDialog,
            'data-control="dashboard-settings"',
            "Button",
        );
        const openSettings = extractBoundedSlice(
            workstation,
            "function openSettings(section: CanonicalSettingsSection) {",
            "\n    function applyListMode(",
        );

        expect(dashboardSettingsDialog).toMatch(
            /<SettingsDialog\s+open=\{settingsOpen\}\s+user=\{user\}\s+onOpenChange=\{setSettingsOpen\}\s+trigger=\{\s*<Button/,
        );
        expect(dashboardSettingsTrigger).toMatch(
            /<Button\s+ref=\{settingsTriggerRef\}\s+type="button"\s+variant="default"\s+size="icon"\s+className=\{\s*dashboardButtonClassNames\.settingsAvatar\s*\}\s+aria-label="打开设置"\s+data-control="dashboard-settings"\s+data-part="dashboard-user-avatar"\s+data-state=\{\s*settingsOpen\s*\?\s*"open"\s*:\s*"idle"\s*\}\s+onClick=\{\(\)\s*=>\s*openSettings\("data-sources"\)\}/,
        );
        expect(button).toContain('const Comp = asChild ? Slot : "button";');
        const canonicalSettingsRouteUpdate = [
            'window.history.replaceState(null, "", `/dashboard#',
            "$",
            "{section}`);",
        ].join("");
        expect(openSettings).toContain(canonicalSettingsRouteUpdate);
        expect(openSettings.indexOf(canonicalSettingsRouteUpdate)).toBeLessThan(
            openSettings.indexOf("setSettingsOpen(true);"),
        );
        for (const manuallyManagedDialogProp of [
            "asChild",
            "aria-controls",
            "aria-expanded",
            "aria-haspopup",
            "<button",
        ]) {
            expect(dashboardSettingsTrigger).not.toContain(
                manuallyManagedDialogProp,
            );
        }
        expect(globals).not.toContain(
            '[data-control="dashboard-settings"][data-part="dashboard-user-avatar"]',
        );
        for (const primitiveSelector of [
            '[data-control="sidebar-collapse"][data-slot="button"]',
            '[data-control="dashboard-favorite"][data-slot="button"]',
            '[data-control="dashboard-source-provider"][data-slot="button"]',
            '[data-control="dashboard-sync"][data-slot="button"]',
            '[data-control="dashboard-settings"][data-slot="button"]',
        ]) {
            expect(globals).not.toContain(primitiveSelector);
        }
        expect(workstation).not.toMatch(
            /className\s*=\s*(?:["'](?:mono|avatar)["']|\{["'](?:mono|avatar)["']\})/,
        );
        expect(workstation).toContain("selectedRecording ? (");
        expect(workstation).toContain("<DashboardDetailEmptyState />");
        expect(workstation).toContain('data-panel="dashboard-retranscription"');
        expect(workstation).toContain("data-retx-state={dashboardRetxState}");
        expect(workstation).toContain(
            'import { Spinner } from "@/components/ui/spinner";',
        );
        expect(workstation).toContain("<Spinner");
        expect(workstation).toContain('size="xs"');
        expect(workstation).not.toContain(
            '<span data-part="dashboard-retranscription-spinner" />',
        );
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-part="dashboard-retranscription-spinner"]',
            ),
        ).toEqual([]);
        const dashboardRetranscriptionDisabledHint = extractOpeningElement(
            workstation,
            'data-part="dashboard-retranscription-disabled-hint"',
            "Badge",
        );
        expect(dashboardRetranscriptionDisabledHint).toMatch(
            /hidden=\{\s*detailTab !==\s*"transcript"\s*\|\|\s*dashboardRetxState !==\s*"unavailable"\s*\}/,
        );
        const dashboardRetranscriptionBanner = extractOpeningElement(
            workstation,
            'data-panel="dashboard-retranscription"',
            "Alert",
        );
        expect(dashboardRetranscriptionBanner).toContain(
            "data-retx-state={dashboardRetxState}",
        );
        expect(dashboardRetranscriptionBanner).toMatch(
            /hidden=\{\s*dashboardRetxState ===\s*"idle"\s*\|\|\s*dashboardRetxState ===\s*"unavailable"\s*\}/,
        );
        expect(workstation).toContain(
            'data-part="dashboard-retranscription-icon"',
        );
        expect(workstation).toContain(
            'data-part="dashboard-retranscription-body"',
        );
        const dashboardRetranscriptionRefreshMarker = extractOpeningElement(
            workstation,
            'data-part="dashboard-retranscription-refresh-marker"',
            "Badge",
        );
        expect(dashboardRetranscriptionRefreshMarker).toMatch(
            /hidden=\{\s*dashboardRetxState !==\s*"completed"\s*\}/,
        );
        expect(workstation).toContain('dashboardRetxState === "failed" ? (');
        expect(workstation).toMatch(
            /dashboardRetxState ===\s*"completed"\s*&&/,
        );
        expect(workstation).toContain('data-retx-retry=""');
        expect(workstation).toContain('data-retx-dismiss=""');
        expect(globals).not.toMatch(
            DASHBOARD_RETRANSCRIPTION_GLOBAL_TOKEN_DEFINITION_RE,
        );
        expect(workstation).not.toContain(
            "const dashboardRetranscriptionClassNames",
        );
        expect(workstation).not.toContain(
            "dashboardRetranscriptionThemeClassName",
        );
        for (const usage of DASHBOARD_RETRANSCRIPTION_OWNER_CLASS_USAGES) {
            expect(workstation).not.toContain(usage);
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
            'data-control="dashboard-player-play"',
        );
        expect(workstation).toContain('part="dashboard-copy-label"');
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
        const playerPrimitives = readSource(
            "features/recordings/components/player-primitives.tsx",
        );
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const cardPrimitive = readSource("components/ui/card.tsx");
        const globals = readSource("app/globals.css");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const emptyPrimitive = readSource("components/ui/empty.tsx");
        const sourceReportPrimitives = readSource(
            "features/source-report/primitives.tsx",
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
            'data-part="dashboard-recording-list-header"',
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
            'data-surface="dashboard-recording-list"',
        );
        expectClassNameConstReference(
            recordingListCard,
            "DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME",
        );
        expect(recordingListCard).toContain(
            'data-part="dashboard-recording-list-content"',
        );
        const recordingListHeader = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-list-header"',
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
            '[data-panel="dashboard-detail"],\n[data-panel="recording-workstation-detail"],\n[data-panel="recording-workstation-detail-body"]',
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
            'data-part="dashboard-sidebar-footer"',
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
        expect(workstation).toContain('data-list="dashboard-sources"');
        expect(workstation).not.toContain("sourceProviderThemeClassName");
        expect(workstation).not.toMatch(
            /--source-provider-(?:status|primary)-/,
        );
        expect(workstation).toContain(
            'className={cn(\n                "group/dashboard-workstation"',
        );
        expect(workstation).toContain("dashboardSourceErrorClassName");
        expect(workstation).toContain('data-control="dashboard-source-clear"');
        expect(workstation).toContain(
            'data-control="dashboard-source-provider"',
        );
        expect(workstation).toContain('data-part="source-provider-label"');
        expect(workstation).toContain('data-part="source-provider-status"');
        const dashboardSourceClearButton = extractOpeningElement(
            workstation,
            'data-control="dashboard-source-clear"',
            "Button",
        );
        const sourceProviderRows = extractBoundedSlice(
            workstation,
            "{sourceRows.map((item) => {",
            'data-panel="dashboard-sync"',
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
            'data-part="source-provider-status"',
            "Badge",
        );
        const sourceProviderCountBadge = extractOpeningElement(
            sourceProviderRows,
            'data-part="source-provider-count"',
            "Badge",
        );
        const sourceProviderRowButton = extractOpeningElement(
            sourceProviderRows,
            'data-control="dashboard-source-provider"',
            "Button",
        );
        const sourceProviderActionButton = extractOpeningElement(
            sourceProviderRows,
            'data-part="source-provider-action"',
            "Button",
        );
        const sourceProviderImageMark = extractOpeningElement(
            sourceProviderRows,
            'data-variant="image"',
            "span",
        );
        const sourceProviderLetterMark = extractOpeningElement(
            sourceProviderRows,
            'data-variant="letter"',
            "span",
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
        expect(sourceProviderImageMark).toContain(
            "className={\n                                                dashboardSourceClassNames.mark",
        );
        expect(sourceProviderImageMark).toContain(
            "data-state={sourceRowState}",
        );
        expect(sourceProviderLetterMark).toContain(
            "dashboardSourceClassNames.markLetter",
        );
        expect(sourceProviderLetterMark).toContain(
            "data-state={sourceRowState}",
        );
        expect(sourceProviderRows).toContain(
            "dashboardSourceClassNames.markImage",
        );
        expect(sourceProviderRows).toContain(
            "dashboardSourceClassNames.markImageCover",
        );
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
            "data-tone={sourceStatusTone}",
        );
        expect(sourceProviderCountBadge).toContain(
            "data-tone={sourceCountTone}",
        );
        for (const migratedSourceProviderSelector of [
            '[data-control="dashboard-source-provider"][data-state="sync-error"]',
            '[data-part="source-provider-mark"]',
            '[data-part="source-provider-status"]',
            '[data-part="source-provider-count"]',
        ]) {
            expect(
                collectCssRuleBlocks(globals, migratedSourceProviderSelector),
            ).toEqual([]);
        }
        expect(workstation).toContain("sourceRowDisabled(");
        expect(workstation).toContain("sourceActionKind(");
        expect(workstation).toContain("disabled={disabledSourceRow}");
        expect(workstation).toContain('data-part="source-provider-action"');
        expect(workstation).toMatch(
            /data-action=\{\s*actionKind === "retry"\s*\? "retry-sync"\s*:\s*actionKind\s*\}/,
        );
        expect(sourceProviderRows).toContain("aria-label={actionAriaLabel}");
        expect(sourceProviderRows).toContain("event.stopPropagation();");
        expect(sourceProviderRows).toContain("event.preventDefault();");
        expect(sourceProviderRows).toContain("void runManualSync();");
        expect(globals).not.toContain("source-provider-action");
        expect(workstation).not.toContain('className="src-action is-busy"');
        expect(workstation).toContain("data-status={item.status}");
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
            'data-panel="dashboard-drawer-scrim"',
            "div",
        );
        expect(drawerTriggerClassNames).not.toContain("source-filter-active");
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
        expect(drawerActiveDotClassNames).toContain("bg-primary");
        expect(drawerActiveDotClassNames).toContain(
            "group-data-[source-filter-active=true]/dashboard-workstation:inline-block",
        );
        expect(drawerClassNames).not.toContain("menuIcon");
        expect(drawerScrim).toContain(
            "className={dashboardDrawerClassNames.scrim}",
        );
        expect(workstation).toContain(
            'data-panel="dashboard-source-filter-stack"',
        );
        const sourceFilterStack = extractBoundedSlice(
            workstation,
            'data-panel="dashboard-source-filter-stack"',
            "</output>",
        );
        const sourceFilterStackOutput = extractOpeningElement(
            workstation,
            'data-panel="dashboard-source-filter-stack"',
            "output",
        );
        const sourceFilterFrom = extractOpeningElement(
            sourceFilterStack,
            'data-part="source-filter-from"',
            "span",
        );
        const sourceFilterSeparator = extractOpeningElement(
            sourceFilterStack,
            'data-part="source-filter-separator"',
            "span",
        );
        const sourceFilterChip = extractOpeningElement(
            sourceFilterStack,
            'data-part="source-filter-chip"',
            "Badge",
        );
        const sourceFilterInfo = extractOpeningElement(
            sourceFilterStack,
            'data-part="source-filter-info"',
            "span",
        );
        const sourceFilterClearButton = extractOpeningElement(
            sourceFilterStack,
            'data-control="source-filter-clear"',
            "Button",
        );
        const sourceFilterClearAllButton = extractOpeningElement(
            sourceFilterStack,
            'data-control="source-filter-clear-all"',
            "Button",
        );
        expect(workstation).toMatch(
            /<output\s+aria-live="polite"[\s\S]*data-panel="dashboard-source-filter-stack"[\s\S]*data-state=\{sourceFilterStackState\}/,
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
        expect(sourceFilterChip).toContain('variant="secondary"');
        expect(sourceFilterInfo).toMatch(
            /className=\{\s*sourceFilterStackClassNames\.info\s*\}/,
        );
        expect(sourceFilterStack).toContain(
            "className={\n                                                    sourceFilterStackClassNames.strong",
        );
        expect(sourceFilterStack).toContain(
            "sourceFilterStackClassNames.infoStrong",
        );
        const sourceFilterStackClassSource = extractBoundedSlice(
            workstation,
            "const sourceFilterStackClassNames = {",
            "} as const;",
        );
        const sourceFilterStackChipClass = extractObjectStringProperty(
            sourceFilterStackClassSource,
            "chip",
        );
        expect(sourceFilterStackClassSource).not.toContain(
            "overflow-hidden text-ellipsis whitespace-nowrap",
        );
        expect(sourceFilterStackClassSource).not.toContain("dark:");
        for (const rebuiltChipToken of [
            "rounded-full",
            "border border-border",
            "bg-card",
            "text-foreground",
        ]) {
            expect(sourceFilterStackChipClass).not.toContain(rebuiltChipToken);
        }
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
        expect(workstation).toContain('data-control="source-filter-widen"');
        expect(workstation).toMatch(
            /<Button[\s\S]*data-control="dashboard-source-clear"[\s\S]*onClick=\{\(\) => setSource\("all"\)\}/,
        );
        expect(workstation).toMatch(
            /<Button[\s\S]*data-control="source-filter-clear"[\s\S]*onClick=\{\(\) => setSource\("all"\)\}/,
        );
        expect(sourceFilterClearButton).toMatch(
            /className=\{\s*sourceFilterClassNames\.clear\s*\}/,
        );
        const librarySearchFilterClearButton = extractOpeningElement(
            workstation,
            'data-control="library-search-filter-clear"',
            "Button",
        );
        const librarySearchFilterClearElement = extractElementSlice(
            workstation,
            'data-control="library-search-filter-clear"',
            "Button",
        );
        const librarySearchFilterOutput = extractOpeningElement(
            workstation,
            'data-panel="dashboard-library-search-filter"',
            "output",
        );
        const librarySearchFilterLabel = extractOpeningElement(
            workstation,
            'data-part="library-search-filter-label"',
            "span",
        );
        const librarySearchFilterChip = extractOpeningElement(
            workstation,
            'data-part="library-search-filter-chip"',
            "Badge",
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
        expect(librarySearchFilterChip).toContain('variant="secondary"');
        expect(librarySearchFilterClearButton).toContain('variant="ghost"');
        expect(librarySearchFilterClearButton).toContain('size="icon-xs"');
        expect(librarySearchFilterClearButton).toContain('type="button"');
        expect(librarySearchFilterClearButton).not.toContain(
            "recordingListChipClear",
        );
        expect(librarySearchFilterClearButton).toMatch(
            /className=\{\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?\s*\}/,
        );
        expect(librarySearchFilterClearButton).toContain(
            'data-control="library-search-filter-clear"',
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
                `data-control="${control}"`,
                "Button",
            );
            expect(sourceFilterActionButton).toMatch(
                /className=\{\s*sourceFilterClassNames\.action\s*\}/,
            );
            expect(workstation).toMatch(
                new RegExp(
                    `<Button[\\s\\S]*data-control="${control}"[\\s\\S]*data-part="source-filter-action"`,
                ),
            );
        }
        expect(workstation).toContain('data-action="retry"');
        expect(workstation).toContain('data-action="widen"');
        expect(workstation).toContain('data-action="open-settings"');
        expect(globals).not.toContain('[data-action="source-filter-action"]');
        expect(
            collectCssRuleBlocks(globals, '[data-part="source-filter-action"]'),
        ).toEqual([]);
        for (const selector of DASHBOARD_SOURCE_FILTER_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(workstation).toMatch(
            /<Button[\s\S]*data-control="source-filter-clear-all"[\s\S]*onClick=\{\(\) => setSource\("all"\)\}/,
        );
        expect(sourceFilterClearAllButton).toMatch(
            /className=\{\s*sourceFilterClassNames\.clearAll\s*\}/,
        );
        expect(workstation).toContain("<ToggleGroup");
        expect(workstation).toContain("<ToggleGroupItem");
        expect(workstation).toContain(
            'data-panel="dashboard-recording-time-filter"',
        );
        expect(workstation).toContain(
            'data-control="dashboard-recording-time-filter"',
        );
        expect(workstation).toContain(
            'data-part="dashboard-recording-time-filter-count"',
        );
        expect(workstation).toContain(
            "const dashboardRecordingTimeFilterStyles = {",
        );
        expect(workstation).toContain(
            "function dashboardRecordingTimeFilterCountClassName(active: boolean)",
        );
        const recordingTimeFilter = extractOpeningElement(
            workstation,
            'data-panel="dashboard-recording-time-filter"',
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
            'data-control="dashboard-recording-time-filter"',
            "ToggleGroupItem",
        );
        expect(recordingTimeFilterItem).toContain("aria-pressed={active}");
        expect(recordingTimeFilterItem).toContain("data-tf={item.value}");
        expect(recordingTimeFilterItem).toContain("data-filter={item.value}");
        expect(recordingTimeFilterItem).toContain(
            "dashboardRecordingTimeFilterStyles.item",
        );
        expect(recordingTimeFilterItem).toContain(
            'data-state={\n                                                    active ? "selected" : "idle"',
        );
        const recordingTimeFilterCount = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-time-filter-count"',
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
            "data-part=dashboard-recording-time-filter-count",
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
            '[data-panel="dashboard-recording-time-filter"][hidden]',
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
        for (const residue of DASHBOARD_TAIL_RESIDUE_FORBIDDEN_SNIPPETS) {
            expect(workstation).not.toContain(residue);
        }
        expect(workstation).toMatch(
            /<div\s+className=\{\s*dashboardRecordingTagFilterStyles\.root\s*\}[\s\S]*data-list-filter-row="tags"[\s\S]*data-panel="recording-list-tag-filter"[\s\S]*hidden=\{listMode !== "tags"\}[\s\S]*ref=\{tagFilterRef\}/,
        );
        expect(workstation).toMatch(
            /<div\s+className=\{\s*dashboardRecordingTagFilterStyles\.list\s*\}[\s\S]*role="listbox"[\s\S]*data-tag-filter-list=""[\s\S]*data-list="recording-list-tag-filter-list"/,
        );
        expect(workstation).toMatch(
            /<Button\s+variant="outline"\s+size="sm"\s+className=\{\s*dashboardRecordingTagFilterStyles\.trigger\s*\}[\s\S]*type="button"[\s\S]*aria-haspopup="listbox"[\s\S]*aria-expanded=\{\s*tagFilterOpen\s*\}[\s\S]*data-tag-filter-trigger=""[\s\S]*data-control="recording-list-tag-filter-trigger"[\s\S]*onClick=\{\(\) =>\s*setTagFilterOpen\(\(open\) => !open\)\s*\}/,
        );
        for (const [slot, hook] of [
            ["label", 'data-part="recording-list-tag-filter-label"'],
            ["count", 'data-part="recording-list-tag-filter-count"'],
            ["caret", 'data-part="recording-list-tag-filter-caret"'],
            [
                "optionLabel",
                'data-part="recording-list-tag-filter-option-label"',
            ],
            [
                "optionCount",
                'data-part="recording-list-tag-filter-option-count"',
            ],
        ] as const) {
            expect(workstation).toMatch(
                new RegExp(
                    `className=\\{\\s*dashboardRecordingTagFilterStyles\\.${slot}\\s*\\}[\\s\\S]*${hook}`,
                ),
            );
        }
        expect(workstation).toMatch(
            /<Button\s+variant="ghost"\s+size="sm"\s+className=\{\s*dashboardRecordingTagFilterStyles\.option\s*\}[\s\S]*type="button"[\s\S]*role="option"[\s\S]*data-tag-value=\{\s*option\.value\s*\}[\s\S]*aria-selected=\{\s*active\s*\}[\s\S]*data-control="recording-list-tag-filter"[\s\S]*data-state=\{\s*active\s*\?\s*"selected"\s*:\s*"idle"\s*\}[\s\S]*onClick=\{\(\) => \{[\s\S]*setSelectedTagFilter\(\s*option\.value,?\s*\);[\s\S]*setTagFilterOpen\(false\);[\s\S]*\}\}/,
        );
        for (const migratedSelector of DASHBOARD_RECORDING_TAG_FILTER_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, migratedSelector)).toEqual([]);
        }
        expect(globals).not.toContain(
            '[data-panel="recording-list-tag-filter"][hidden]',
        );
        const recordingListTagFilterBlock = extractBoundedSlice(
            workstation,
            'data-panel="recording-list-tag-filter"',
            'data-list="dashboard-recording-list-scroll"',
        );
        expect(recordingListTagFilterBlock).not.toMatch(
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
        const dashboardRecordingListStateStyles = extractBoundedSlice(
            workstation,
            "const dashboardRecordingListStateStyles = {",
            "} as const;",
        );
        const dashboardRecordingListEmptyState = extractElementSlice(
            workstation,
            'data-part="recording-list-state"',
            "Empty",
        );
        const dashboardRecordingListEmptyOpening = extractOpeningElement(
            workstation,
            'data-part="recording-list-state"',
            "Empty",
        );
        const dashboardRecordingListEmptyMedia = extractOpeningElement(
            dashboardRecordingListEmptyState,
            'data-part="recording-list-state-icon"',
            "EmptyMedia",
        );
        const dashboardRecordingListEmptyTitle = extractOpeningElement(
            dashboardRecordingListEmptyState,
            'data-part="recording-list-state-title"',
            "EmptyTitle",
        );
        const dashboardRecordingListEmptyDescription = extractOpeningElement(
            dashboardRecordingListEmptyState,
            'data-part="recording-list-state-description"',
            "EmptyDescription",
        );
        for (const migratedSelector of DASHBOARD_RECORDING_LIST_RESIDUAL_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, migratedSelector)).toEqual([]);
        }
        for (const ownerClassRef of DASHBOARD_RECORDING_LIST_RESIDUAL_OWNER_CLASS_REFS) {
            expect(workstation).toContain(ownerClassRef);
        }
        expect(dashboardRecordingListStateStyles).toContain('root: "m-2"');
        expect(dashboardRecordingListStateStyles).toContain('content: "mt-2"');
        for (const removedStateStyleSlot of [
            "icon:",
            "title:",
            "description:",
            "border-dashed",
            "bg-muted",
            "text-muted-foreground",
        ]) {
            expect(dashboardRecordingListStateStyles).not.toContain(
                removedStateStyleSlot,
            );
        }
        expect(dashboardRecordingListEmptyOpening).toContain(
            'variant="compact"',
        );
        expect(dashboardRecordingListEmptyOpening).toContain(
            "data-list-state-block={listState}",
        );
        expect(dashboardRecordingListEmptyOpening).toContain(
            "data-state={listState}",
        );
        expectClassNameConstReference(
            dashboardRecordingListEmptyOpening,
            "dashboardRecordingListStateStyles.root",
        );
        expect(dashboardRecordingListEmptyState).toContain("<EmptyHeader>");
        expect(dashboardRecordingListEmptyState).toContain("<EmptyContent");
        expect(dashboardRecordingListEmptyState).toContain("<FileText />");
        expect(dashboardRecordingListEmptyState).toMatch(
            /<EmptyContent\s+className=\{\s*dashboardRecordingListStateStyles\.content\s*\}/,
        );
        expect(dashboardRecordingListEmptyMedia).toContain(
            'variant="subtleIcon"',
        );
        expect(dashboardRecordingListEmptyTitle).toContain('variant="compact"');
        expect(dashboardRecordingListEmptyDescription).toContain(
            'variant="compact"',
        );
        for (const removedRawStateClassRef of [
            "dashboardRecordingListStateStyles.icon",
            "dashboardRecordingListStateStyles.title",
            "dashboardRecordingListStateStyles.description",
        ]) {
            expect(dashboardRecordingListEmptyState).not.toContain(
                removedRawStateClassRef,
            );
        }
        expect(workstation).not.toContain("listStatePrimary:");
        expect(workstation).not.toContain("listStateAction:");
        expect(workstation).not.toContain(
            "dashboardButtonClassNames.listStatePrimary",
        );
        expect(workstation).not.toContain(
            "dashboardButtonClassNames.listStateAction",
        );
        for (const { control, variant } of [
            {
                control: "recording-list-open-data-sources",
                variant: "default",
            },
            {
                control: "recording-list-clear-filters",
                variant: "ghost",
            },
            {
                control: "recording-list-clear-timeline",
                variant: "ghost",
            },
            {
                control: "recording-list-clear-tag",
                variant: "ghost",
            },
        ] as const) {
            const buttonOpening = extractOpeningElement(
                dashboardRecordingListEmptyState,
                `data-control="${control}"`,
                "Button",
            );
            expect(buttonOpening).toContain(`variant="${variant}"`);
            expect(buttonOpening).toContain('size="sm"');
            expect(buttonOpening).not.toContain("className=");
        }
        for (const ownerClassToken of [
            "flex items-center gap-2.5",
            "m-0 font-sans text-[13px] font-semibold text-foreground",
            "ml-auto font-mono text-[11.5px] font-medium text-muted-foreground",
            "[scrollbar-width:thin]",
            "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/55",
            "flex-1 overflow-y-auto p-1",
            "relative mt-1.5 mb-[14px] h-px",
        ]) {
            expect(dashboardRecordingListResidualClassSource).toContain(
                ownerClassToken,
            );
        }
        expect(workstation).toMatch(
            /className=\{\s*dashboardRecordingListScrollClassName\s*\}[\s\S]*data-list="dashboard-recording-list-scroll"/,
        );
        expect(workstation).toMatch(
            /className=\{\s*dashboardRecordingListTitlebarStyles\.root\s*\}[\s\S]*data-part="dashboard-recording-list-titlebar"/,
        );
        expect(workstation).toMatch(
            /className=\{\s*dashboardRecordingListTitlebarStyles\.title\s*\}[\s\S]*data-part="dashboard-recording-list-title"/,
        );
        expect(workstation).toMatch(
            /className=\{\s*dashboardRecordingListTitlebarStyles\.count\s*\}[\s\S]*data-part="dashboard-recording-list-count"/,
        );
        expect(workstation).not.toContain("dashboardScrollbarClassName");
        expect(workstation).toContain("tagFilterValue(tag.id)");
        expect(workstation).toContain('"untagged"');
        expect(workstation).toContain("displayTag?: RecordingTag");
        expect(workstation).toContain("displayTag: tag");
        expect(workstation).toContain("entry.displayTag ??");
        expect(workstation).toContain("<PlayerTagChip");
        expect(playerPrimitives).toContain("data-recording-tag-chip");
        const dashboardRecordingTagChip = extractOpeningElement(
            workstation,
            "<PlayerTagChip",
            "PlayerTagChip",
        );
        expect(dashboardRecordingTagChip).toMatch(/tag=\{\s*primaryTag\s*\}/);
        expect(dashboardRecordingTagChip).not.toContain("variant=");
        expect(dashboardRecordingTagChip).not.toContain("className=");
        expect(playerPrimitives).toContain("RecordingTagIconGlyph");
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
        expect(workstation).toContain(
            "function DashboardRecordingListSkeleton()",
        );
        expect(workstation).toContain("<Skeleton");
        expect(workstation).toContain('data-panel="recording-list-loading"');
        expect(workstation).toContain('data-part="skeleton-row"');
        expect(workstation).toContain('data-part="skeleton-title"');
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
            'data-part="dashboard-recording-row-body"',
        );
        expect(workstation).toContain(
            'data-part="dashboard-recording-row-title"',
        );
        expect(workstation).toContain(
            'data-part="dashboard-recording-row-meta"',
        );
        expect(workstation).toContain(
            'data-part="dashboard-recording-duration"',
        );
        expect(workstation).toContain(
            'data-part="dashboard-recording-row-actions"',
        );
        expect(workstation).toContain('data-panel="dashboard-detail-empty"');
        expect(workstation).toContain(
            'data-part="dashboard-detail-empty-title"',
        );
        expect(workstation).not.toContain('className="detail-empty"');
        expect(workstation).not.toContain('className="detail-empty-ico"');
        expect(workstation).not.toContain('className="detail-empty-title"');
        expect(workstation).not.toContain('className="detail-empty-sub"');
        expect(workstation).toContain("aria-current={");
        expect(workstation).not.toContain("data-selected=");
        expect(workstation).toContain('listState === "loading"');
        expect(workstation).toContain("<DashboardRecordingListSkeleton />");
        expect(workstation).toContain("function getRecordingListStatus(");
        expect(workstation).toContain('data-list="dashboard-recording-rows"');
        const dashboardRecordingRows = extractOpeningElement(
            workstation,
            'data-list="dashboard-recording-rows"',
            "div",
        );
        const dashboardRecordingListGroup = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-list-group"',
            "div",
        );
        const dashboardRecordingListGroupSeparator = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-list-group-separator"',
            "Separator",
        );
        const dashboardRecordingListHeading = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-list-group-heading"',
            "div",
        );
        const dashboardRecordingListLabel = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-list-group-label"',
            "span",
        );
        const dashboardRecordingListCount = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-list-group-count"',
            "span",
        );
        const dashboardRecordingListDivider = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-list-group-divider"',
            "Separator",
        );
        const dashboardRecordingRowBody = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-row-body"',
            "div",
        );
        const dashboardRecordingRowTitle = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-row-title"',
            "div",
        );
        const dashboardRecordingRowMeta = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-row-meta"',
            "div",
        );
        const dashboardRecordingRowSecondary = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-row-secondary"',
            "div",
        );
        const dashboardRecordingRowActions = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-row-actions"',
            "div",
        );
        const dashboardRecordingRowButton = extractOpeningElement(
            workstation,
            'data-control="dashboard-recording-row"',
            "Button",
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
            "[&.is-hover-demo]:",
            "[&.is-focus-demo]:",
        ]) {
            expect(dashboardRecordingRowStyleHelper).toContain(rowStateToken);
        }
        for (const forcedOrThemeOverrideToken of [
            "!border",
            "!bg",
            "!shadow",
            "!ring",
            "!outline",
            "focus:!",
            "focus-visible:!",
            "dark:",
            "overflow-hidden text-ellipsis whitespace-nowrap",
        ]) {
            expect(dashboardRecordingRowStyleHelper).not.toContain(
                forcedOrThemeOverrideToken,
            );
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
        expect(dashboardRecordingRowButton).toMatch(
            /variant=\{\s*active\s*\?\s*"secondary"\s*:\s*"ghost"\s*\}/,
        );
        expect(dashboardRecordingRowButton).toMatch(
            /className=\{\s*dashboardRecordingRowStyles\.row\s*\}/,
        );
        expect(dashboardRecordingRowButton).toContain(
            'data-control="dashboard-recording-row"',
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
        ]).not.toContain('[data-part="dashboard-recording-source-mark"]');
        for (const migratedSelectorFragment of DASHBOARD_RECORDING_ROW_META_MIGRATED_GLOBAL_SELECTOR_FRAGMENTS) {
            expect(globals).not.toContain(migratedSelectorFragment);
        }
        for (const migratedSelector of [
            '[data-part="dashboard-recording-duration"]',
            '[data-part="dashboard-recording-timestamp"]',
            '[data-part="dashboard-recording-timestamp-absolute"]',
            '[data-part="dashboard-recording-timestamp-relative"]',
            '[data-part="dashboard-recording-source-mark"]',
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
            "opacity-80",
            "object-cover",
            "opacity-70",
            "text-muted-foreground",
        ]) {
            expect(dashboardRecordingRowStyleHelper).toContain(
                rowMetaOwnershipToken,
            );
        }
        expect(workstation).not.toContain(
            "function DashboardRecordingStatusBadge",
        );
        expect(workstation).not.toContain(
            "SOT_DASHBOARD_RECORDING_STATUS_BADGE_CLASS",
        );
        expect(workstation).not.toContain(
            "function SotDashboardRecordingStatusBadge",
        );
        const dashboardRecordingStatusBadge = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-status"',
            "Badge",
        );
        expect(dashboardRecordingStatusBadge).toContain(
            "dashboardRecordingStatusBadgeVariants",
        );
        expect(dashboardRecordingStatusBadge).toContain(
            'data-part="dashboard-recording-status"',
        );
        expect(dashboardRecordingStatusBadge).toContain("data-tone={");
        expect(workstation).not.toContain(
            'data-part="dashboard-recording-status-dot"',
        );
        expect(workstation).toContain(
            'data-part="dashboard-recording-status-label"',
        );
        expect(workstation).not.toContain("<DashboardRecordingStatusBadge");
        expect(workstation).toContain('data-part="dashboard-recording-status"');
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
            "const dashboardRecordingStatusBadgeVariants = {",
            'err: "destructive"',
            'info: "secondary"',
            'neu: "outline"',
            'ok: "secondary"',
            'warn: "secondary"',
        ]) {
            expect(workstation).toContain(dashboardStatusToken);
        }
        for (const retiredDashboardStatusToken of [
            "const dashboardRecordingStatusBadgeToneClassNames = {",
            "const dashboardRecordingStatusDotClassName =",
            '"size-[5px] rounded-full bg-current"',
            "const dashboardRecordingStatusDotToneClassNames = {",
        ]) {
            expect(workstation).not.toContain(retiredDashboardStatusToken);
        }
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-part="dashboard-recording-status"]',
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
                                    data-panel="recording-list-tag-filter"`,
        );
        expect(workstation).toContain('aria-label="列表模式"');
        expect(workstation).toContain("<SegmentedTabs");
        const listModeSegmentedTabs = extractOpeningElement(
            workstation,
            'data-part="dashboard-recording-list-mode-segmented"',
            "SegmentedTabs",
        );
        expect(listModeSegmentedTabs).toContain('variant="segmented"');
        expect(listModeSegmentedTabs).toContain('size="segmentedSm"');
        expect(listModeSegmentedTabs).toContain(
            'data-control="segmented-tabs"',
        );
        expect(listModeSegmentedTabs).toContain('data-size="sm"');
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
        expect(detailSegmentedTabs).toContain('data-control="segmented-tabs"');
        expect(detailSegmentedTabs).toContain('data-size="sm"');
        expect(detailSegmentedTabs).toContain('className="shrink-0"');
        expect(workstation).toContain('hidden={detailTab !== "transcript"}');
        expect(workstation).toContain(
            'const dashboardTabPaneHiddenClassName = "[&[hidden]]:hidden";',
        );
        const transcriptPane = extractOpeningElement(
            workstation,
            'data-panel="dashboard-transcript-pane"',
            "div",
        );
        expect(transcriptPane).toMatch(
            /className=\{\s*dashboardTabPaneHiddenClassName\s*\}/,
        );
        const sourceReportHiddenPane = extractOpeningElement(
            sourceReportPrimitives,
            "data-testid={testId}",
            "div",
        );
        expect(sourceReportHiddenPane).toContain("className={commonClassName}");
        expect(sourceReportHiddenPane).toContain("data-state={state}");
        expect(sourceReportHiddenPane).toContain("hidden={hidden}");
        const sourceReportHiddenPaneCall = extractOpeningElement(
            workstation,
            'surface="dashboard"',
            "SourceReportPane",
        );
        expect(sourceReportHiddenPaneCall).toContain(
            "dashboardTabPaneHiddenClassName",
        );
        expect(sourceReportHiddenPaneCall).toContain(
            "state={sourceReportVisualState}",
        );
        const speakersPane = extractOpeningElement(
            workstation,
            'data-panel="dashboard-speakers-pane"',
            "div",
        );
        expect(speakersPane).toMatch(
            /className=\{\s*dashboardTabPaneHiddenClassName\s*\}/,
        );
        const dashboardTranscriptShell = extractOpeningElement(
            workstation,
            'data-panel="dashboard-transcript-shell"',
            "Card",
        );
        const dashboardTranscriptHeader = extractOpeningElement(
            workstation,
            'data-part="dashboard-transcript-header"',
            "CardHeader",
        );
        expect(dashboardTranscriptShell).toContain(
            `className="${EXPECTED_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME}"`,
        );
        expect(dashboardTranscriptHeader).toContain(
            'className="flex flex-row flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3.5 py-3"',
        );
        const dashboardTranscriptBody = extractOpeningElement(
            workstation,
            'data-part="dashboard-transcript-body"',
            "CardContent",
        );
        expect(dashboardTranscriptBody).toContain(
            'className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5"',
        );
        expect(workstation).not.toContain(
            "dashboardRetranscriptionThemeClassName",
        );
        for (const hook of DASHBOARD_DETAIL_PANE_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        const dashboardSpeakersMerge = extractOpeningElement(
            workstation,
            'data-control="dashboard-speakers-merge"',
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
            'data-part="dashboard-transcript-speaker-row"',
            "div",
        );
        const dashboardTranscriptReadyTurn = extractOpeningElement(
            workstation,
            'data-state="ready"',
            "div",
        );
        const dashboardTranscriptReadySlice = extractBoundedSlice(
            workstation,
            "turns.map((turn, index) => {",
            ") : (",
        );
        const dashboardTranscriptAvatar = extractOpeningElement(
            workstation,
            'data-part="dashboard-transcript-avatar"',
            "span",
        );
        const dashboardTranscriptSpeakerName = extractOpeningElement(
            workstation,
            'data-part="dashboard-transcript-speaker-name"',
            "span",
        );
        const dashboardTranscriptSpeakerTime = extractOpeningElement(
            workstation,
            'data-part="dashboard-transcript-speaker-time"',
            "span",
        );
        const dashboardTranscriptEmpty = extractElementSlice(
            workstation,
            'data-panel="dashboard-transcript-empty"',
            "Empty",
        );
        const dashboardTranscriptEmptyOpening = extractOpeningElement(
            workstation,
            'data-panel="dashboard-transcript-empty"',
            "Empty",
        );
        const dashboardTranscriptEmptyIcon = extractOpeningElement(
            workstation,
            'data-part="dashboard-transcript-empty-icon"',
            "EmptyMedia",
        );
        const dashboardTranscriptEmptyTitle = extractOpeningElement(
            workstation,
            'data-part="dashboard-transcript-empty-message"',
            "EmptyTitle",
        );
        const dashboardTranscriptEmptyDescription = extractOpeningElement(
            workstation,
            'data-part="dashboard-transcript-empty-sub"',
            "EmptyDescription",
        );
        const dashboardSpeakersHead = extractOpeningElement(
            workstation,
            'data-part="dashboard-speakers-head"',
            "div",
        );
        const dashboardSpeakersHeadTitle = extractOpeningElement(
            workstation,
            'data-part="dashboard-speakers-head-title"',
            "div",
        );
        const dashboardSpeakerRows = extractOpeningElement(
            workstation,
            'data-list="dashboard-speaker-rows"',
            "ul",
        );
        const dashboardSpeakerRow = extractOpeningElement(
            workstation,
            'data-item="dashboard-speaker-row"',
            "li",
        );
        const dashboardSpeakerAvatar = extractOpeningElement(
            workstation,
            'data-part="dashboard-speaker-avatar"',
            "Badge",
        );
        const dashboardSpeakerRowMeta = extractOpeningElement(
            workstation,
            'data-part="dashboard-speaker-row-meta"',
            "div",
        );
        const dashboardSpeakerName = extractOpeningElement(
            workstation,
            'data-part="dashboard-speaker-name"',
            "div",
        );
        const dashboardSpeakerSub = extractOpeningElement(
            workstation,
            'data-part="dashboard-speaker-sub"',
            "Badge",
        );
        const dashboardSpeakerBar = extractOpeningElement(
            workstation,
            'data-part="dashboard-speaker-bar"',
            "Progress",
        );
        const dashboardSpeakerEmpty = extractElementSlice(
            workstation,
            'data-state="empty"',
            "li",
        );

        expect(workstation).not.toContain(
            "const dashboardTranscriptClassNames",
        );
        for (const token of DASHBOARD_SPEAKER_PANE_OWNER_CLASS_TOKENS) {
            expect(dashboardSpeakerPaneClassNames).toContain(token);
        }
        for (const token of DASHBOARD_SPEAKER_PANE_FORBIDDEN_RECONSTRUCTION_TOKENS) {
            expect(dashboardSpeakerPaneClassNames).not.toContain(token);
        }
        expect(workstation).not.toContain(
            "DASHBOARD_SPEAKER_SHARE_CLASS_NAMES",
        );
        expect(workstation).not.toContain("getDashboardSpeakerShareClassName");
        for (const token of DASHBOARD_SPEAKER_SHARE_VALUE_TOKENS) {
            expect(workstation).toContain(token);
        }
        expect(dashboardTranscriptLoadingTurn).toContain(
            'className="border-b border-dashed py-3 last:border-b-0"',
        );
        expect(dashboardTranscriptLoadingSpeakerRow).toContain(
            'className="mb-2 flex items-center gap-2"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'className="border-b border-dashed py-3 last:border-b-0"',
        );
        expect(dashboardTranscriptAvatar).toContain(
            'className="inline-flex size-7 flex-none items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"',
        );
        expect(dashboardTranscriptAvatar).toContain("data-tone=");
        expect(dashboardTranscriptSpeakerName).toContain(
            'className="text-sm font-medium text-foreground"',
        );
        expect(dashboardTranscriptSpeakerTime).toContain(
            'className="ml-1 font-mono text-xs text-muted-foreground"',
        );
        expect(dashboardTranscriptSpeakerTime).toContain('data-format="mono"');
        expect(dashboardTranscriptReadySlice).toContain(
            'className="m-0 text-sm/relaxed text-foreground"',
        );
        expect(dashboardTranscriptEmptyOpening).toContain("<Empty");
        expect(dashboardTranscriptEmpty).toContain("<EmptyHeader");
        expect(dashboardTranscriptEmptyIcon).toContain('variant="icon"');
        expect(dashboardTranscriptEmptyTitle).toContain('variant="compact"');
        expect(dashboardTranscriptEmptyDescription).toContain(
            'variant="compact"',
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
        expect(dashboardSpeakerAvatar).toContain('variant="secondary"');
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
        expect(dashboardSpeakerSub).toContain('variant="outline"');
        expectClassNameConstReference(
            dashboardSpeakerBar,
            "dashboardSpeakerPaneClassNames.bar",
        );
        expect(dashboardSpeakerBar).toMatch(/value=\{\s*shareValue\s*\}/);
        expect(dashboardSpeakerBar).toContain("max={100}");
        expect(dashboardSpeakerBar).toContain("indicatorClassName={");
        expect(dashboardSpeakerBar).toContain(
            "dashboardSpeakerPaneClassNames.barFill",
        );
        expect(dashboardSpeakerBar).toContain('"data-part":');
        expect(dashboardSpeakerBar).toContain('"dashboard-speaker-bar-fill"');
        expect(dashboardSpeakerEmpty).toContain("<Empty");
        expect(dashboardSpeakerEmpty).toContain('variant="compact"');
        expect(dashboardSpeakerEmpty).toContain("<EmptyHeader");
        expect(dashboardSpeakerEmpty).toContain("<EmptyMedia");
        expect(dashboardSpeakerEmpty).toContain("<EmptyTitle");
        expect(dashboardSpeakerEmpty).toContain("<EmptyDescription");
        expect(workstation).not.toContain(
            ["--dashboard", "speaker-share"].join("-"),
        );
        const transcriptLanguageBadge = extractOpeningElement(
            workstation,
            'data-part="dashboard-transcript-language"',
            "Badge",
        );
        expect(transcriptLanguageBadge).toContain('variant="outline"');
        expect(transcriptLanguageBadge).toContain(
            `className="${EXPECTED_DASHBOARD_TRANSCRIPT_LANGUAGE_BADGE_CLASS_NAME}"`,
        );
        expect(badgePrimitive).not.toContain(
            DASHBOARD_OWNER_LOCAL_FORBIDDEN_VARIANT_PROPS[6],
        );
        const dashboardTranscriptActions = extractOpeningElement(
            workstation,
            'data-part="dashboard-transcript-actions"',
            "div",
        );
        expect(dashboardTranscriptActions).toContain(
            `className="${EXPECTED_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME}"`,
        );
        const dashboardLocalCopyButton = extractElementSlice(
            workstation,
            'data-control="copy-local-transcript"',
            "Button",
        );
        expect(dashboardLocalCopyButton).toContain("<DashboardCopyIcon");
        expect(dashboardLocalCopyButton).toContain("<DashboardCopyLabel>");
        expect(dashboardLocalCopyButton).not.toContain("SourceReportCopyIcon");
        expect(dashboardLocalCopyButton).not.toContain("SourceReportCopyLabel");
        const dashboardCopyIcon = extractBoundedSlice(
            workstation,
            "function DashboardCopyIcon",
            "function DashboardCopyLabel",
        );
        expect(dashboardCopyIcon).toContain('data-part="dashboard-copy-icon"');
        expect(dashboardCopyIcon).not.toContain("dashboardLocalCopyClassNames");
        expect(dashboardCopyIcon).toContain('state === "ok" ? Check');
        expect(dashboardCopyIcon).toContain('state === "err" ? X : Copy');
        const dashboardCopyLabel = extractBoundedSlice(
            workstation,
            "function DashboardCopyLabel",
            "function getRetxStateFromActiveJob",
        );
        expect(dashboardCopyLabel).toContain(
            'data-part="dashboard-copy-label"',
        );
        expect(dashboardCopyLabel).not.toContain(
            "dashboardLocalCopyClassNames",
        );
        const sourceReportCopyButton = extractBoundedSlice(
            sourceReportPrimitives,
            "export function SourceReportCopyButton",
            "export function SourceReportActionButton",
        );
        expect(
            existsSync(path.join(ROOT, "features/source-report/styles.ts")),
        ).toBe(false);
        for (const moduleName of [
            "alert",
            "badge",
            "button",
            "card",
            "empty",
            "separator",
            "skeleton",
        ]) {
            expect(sourceReportPrimitives).toContain(
                `@/components/ui/${moduleName}`,
            );
        }
        expect(sourceReportPrimitives).toContain(
            'testId="dashboard-source-report-state"',
        );
        expect(sourceReportPrimitives).toContain(
            'testId = "recording-source-report-state"',
        );
        expect(sourceReportPrimitives).toContain("data-testid={testId}");
        expect(sourceReportPrimitives).toContain("data-state={state}");
        expect(sourceReportPrimitives).toContain("data-substate={subState}");
        expect(sourceReportPrimitives).toContain(
            "data-testid={`source-report-metric-${metric}`}",
        );
        expect(sourceReportPrimitives).toContain(
            "data-testid={`source-report-section-${section}`}",
        );
        expect(sourceReportPrimitives).toContain(
            'data-testid="source-report-segments"',
        );
        expect(sourceReportPrimitives).toContain(
            'data-testid="source-report-meta"',
        );
        expect(sourceReportCopyButton).toContain(
            "data-testid={`source-report-copy-${copy}`}",
        );
        expect(sourceReportCopyButton).toContain(
            "data-state={feedbackState ?? copyState}",
        );
        expect(sourceReportCopyButton).toContain("data-tab-scope={tabScope}");
        expect(sourceReportCopyButton).toContain('size="xs"');
        expect(sourceReportPrimitives).not.toMatch(
            /SotSourceReport|data-source-report|sourceReportSotStyles|SourceReportStyleVariables/,
        );

        expect(workstation).toContain("<DashboardSourceReportState");
        expect(workstation).toContain(
            '<DashboardSourceReportState state="loading">',
        );
        expect(workstation).toContain(
            '<DashboardSourceReportState state="error">',
        );
        expect(workstation).toMatch(/subState=\{\s*sourceReportSubState\s*\}/);
        expect(workstation).toContain("<SourceReportMetricCards>");
        expect(workstation).toContain("<SourceReportSection");
        expect(workstation).toContain("<SourceReportSegments");
        expect(workstation).toContain("<SourceReportMetaList");
        expect(workstation).toContain("<SourceReportMissingNotice");
        expect(workstation).toContain('testId="source-report-open-source"');
        expect(workstation).toContain('testId="source-report-repull"');
        expect(workstation).not.toContain("SotSourceReport");
        expect(workstation).not.toContain("@/features/source-report/styles");

        for (const [copyKind, copyState, copyDisabled] of [
            [
                "source-transcript",
                "sourceTranscriptCopyState",
                "sourceTranscriptCopyDisabled",
            ],
            [
                "source-report",
                "sourceReportCopyState",
                "sourceReportCopyDisabled",
            ],
        ] as const) {
            const dashboardCopy = extractOpeningElement(
                workstation,
                `copy="${copyKind}"`,
                "SourceReportCopyButton",
            );
            expect(dashboardCopy).toContain(`copy="${copyKind}"`);
            expect(dashboardCopy).toMatch(
                new RegExp(`copyState=\\{\\s*${copyState}\\s*\\}`),
            );
            expect(dashboardCopy).toMatch(
                new RegExp(`disabled=\\{\\s*${copyDisabled}\\s*\\}`),
            );
        }
        const dashboardSourceReportPane = extractOpeningElement(
            workstation,
            'surface="dashboard"',
            "SourceReportPane",
        );
        expect(dashboardSourceReportPane).toMatch(
            /className=\{\s*dashboardTabPaneHiddenClassName\s*\}/,
        );
        expect(dashboardSourceReportPane).toContain(
            "state={sourceReportVisualState}",
        );
        expect(dashboardSourceReportPane).toContain(
            'hidden={detailTab !== "source"}',
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
        expect(workstation).toContain('topbar: "relative z-[60] flex h-14');
        expect(workstation).toContain(
            "const runManualSync = useCallback(async () =>",
        );
        expect(workstation).toContain("if (syncButtonBusy) return;");
        expect(workstation).toContain("await manualSync()");
        expect(workstation).toContain(
            "await Promise.all([refreshStatus(), loadDataSources()])",
        );
        expect(workstation).toContain("refreshBrowserRoute(router)");
        expect(workstation).not.toContain("dashboardSyncClassNames");
        expect(workstation).toContain('data-panel="dashboard-sync"');
        expect(workstation).toContain('data-part="dashboard-sync-indicator"');
        const dashboardSyncPanel = extractElementSlice(
            workstation,
            'data-panel="dashboard-sync"',
            "div",
        );
        const dashboardSyncIndicator = extractOpeningElement(
            workstation,
            'data-part="dashboard-sync-indicator"',
            "span",
        );
        const dashboardSyncText = extractOpeningElement(
            workstation,
            'data-part="dashboard-sync-text"',
            "div",
        );
        const dashboardSyncTitle = extractOpeningElement(
            workstation,
            'data-part="dashboard-sync-title"',
            "div",
        );
        const dashboardSyncSubtitle = extractOpeningElement(
            workstation,
            'data-part="dashboard-sync-subtitle"',
            "div",
        );
        expect(dashboardSyncPanel).toContain("group/dashboard-sync");
        expect(dashboardSyncPanel).toContain("border-sidebar-border");
        expect(dashboardSyncPanel).toContain("bg-sidebar-accent");
        expect(dashboardSyncPanel).toContain("text-sidebar-accent-foreground");
        expect(dashboardSyncIndicator).toContain("bg-primary");
        expect(dashboardSyncIndicator).toContain("bg-destructive");
        expect(dashboardSyncIndicator).toContain(
            "bpulse_1.4s_ease-in-out_infinite",
        );
        expect(dashboardSyncText).toContain(
            "dashboardSidebarCollapseClassNames.hidden",
        );
        expect(dashboardSyncTitle).toContain("text-sidebar-foreground");
        expect(dashboardSyncSubtitle).toContain("text-muted-foreground");
        expect(dashboardSyncPanel).not.toContain("var(--signal-success)");
        expect(dashboardSyncPanel).not.toContain("var(--signal-danger)");
        expect(dashboardSyncPanel).not.toContain("var(--signal-info)");
        expect(dashboardSyncPanel).not.toContain("var(--fg-tertiary)");
        expect(workstation).toContain('data-control="dashboard-sync"');
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
        expect(workstation).toContain('data-control="dashboard-activity-sync"');
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
        const darkGlobalTokens = extractCssBlock(
            globals,
            '.dark,\n[data-theme="dark"]',
        );
        expect(globals).toContain("--graphite-950: rgb(11 16 22);");
        expect(globals).toContain(
            "--graphite-950: oklch(0.11 0.01 258); /* obsidian */",
        );
        expect(darkGlobalTokens).toMatch(
            /--bg-canvas:\s*rgb\(17 19 20\);\s*--bg-canvas:\s*oklch\(0\.185 0\.004 229\);/,
        );
        expect(darkGlobalTokens).not.toContain("--bg-canvas: rgb(11 16 22);");

        expect(segmentedTabs).not.toContain('data-control="segmented-tabs"');
        expect(segmentedTabs).not.toContain("data-size={size}");
        expect(segmentedTabs).toContain("data-tabs={items.length}");
        expect(segmentedTabs).toContain("data-active={activeIndex}");
        expect(segmentedTabs).toContain("getItemProps");
        expect(segmentedTabs).not.toContain('data-control="segmented-tab"');
        expect(segmentedTabs).not.toContain("data-state={");
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
            'data-part="liquid-tabs-indicator"',
        );
        expect(segmentedTabs).not.toContain('data-control="liquid-tabs"');
        expect(segmentedTabs).not.toContain('data-control="liquid-tab"');
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
        expect(banner).not.toContain("const systemBannerAlertStateClassNames");
        expect(banner).not.toContain("const systemBannerIconStateClassNames");
        expect(banner).not.toContain("const systemBannerButtonClassNames");
        expect(banner).toContain("const systemBannerProgressClassNames");
        expect(banner).toContain('} from "lucide-react";');
        for (const systemBannerIcon of [
            "Download",
            "LockKeyhole",
            "Package",
            "Search",
            "ShieldX",
            "Upload",
            "WifiOff",
            "X",
        ]) {
            expect(banner).toContain(systemBannerIcon);
        }
        expect(banner).not.toContain("[--system-banner");
        expect(banner).not.toContain("border-[var(--system-banner-border)]");
        expect(banner).not.toContain("bg-[var(--system-banner-bg)]");
        expect(banner).not.toContain("SVGProps");
        expect(banner).not.toContain("<svg");
        expect(banner).not.toContain("a11y-ignore");
        expect(banner).not.toContain(
            "biome-ignore lint/a11y/noSvgWithoutTitle",
        );
        expect(banner).toContain(
            "variant={systemBannerAlertVariantByState[banner.state]}",
        );
        expect(banner).toContain('density="comfortable"');
        expect(banner).toContain('layout="inline"');
        for (const localVisualRebuildToken of [
            "systemBannerAlertStateClassNames[banner.state]",
            "systemBannerIconStateClassNames[banner.state]",
            'offline: "border-border bg-secondary text-secondary-foreground"',
            '"update-available": "border-primary/30 bg-primary/10"',
            '"permission-denied": "bg-destructive/10 text-destructive"',
            "bg-primary/10 data-[state=indeterminate]:bg-primary/10",
            "bg-primary transition-transform",
            "[&_svg]:size",
            "[&_svg]:stroke",
            "stroke-linecap",
            "stroke-linejoin",
            "dark:",
        ]) {
            expect(banner).not.toContain(localVisualRebuildToken);
        }
        expect(banner).not.toContain(
            "bg-[image:var(--system-banner-progress-indeterminate-bg)]",
        );
        expect(banner).not.toContain("bg-transparent");
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
        expect(banner).not.toContain('data-panel="system-banner"');
        expect(banner).toContain('aria-live={a11y["aria-live"]}');
        expect(banner).toContain("role={a11y.role}");
        expect(banner).toContain("<SystemBannerIcon");
        expect(banner).toContain("systemBannerAlertClassNames.body");
        expect(banner).toContain("systemBannerAlertClassNames.actions");
        expect(banner).toContain("systemBannerProgressClassNames.root");
        expect(banner).toContain(
            "systemBannerProgressClassNames.indeterminateIndicator",
        );
        expect(banner).toContain("<Progress");
        expect(banner).not.toContain('variant="systemBanner"');
        expect(banner).toContain("value={progress ?? 0}");
        expect(banner).toContain('aria-hidden="true"');
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
        expect(banner).toContain("getBannerA11y(banner.state)");
        expect(banner).toContain('banner.state === "import-progress"');
        expect(banner).toContain('banner.state === "export-progress"');
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
        expect(banner).toContain("className={className}");
        for (const buttonOwnerClass of [
            "systemBannerButtonClassNames",
            "border border-transparent",
            "shadow-none",
            "hover:bg-muted",
            "hover:text-foreground",
            "h-[26px]",
            "gap-[7px]",
            "px-[10px]",
            "py-[7.5px]",
            "has-[>svg]:px-[10px]",
            "[&_svg:not([class*='size-'])]:size-4",
            "[&_svg]:stroke-[1.8]",
        ]) {
            expect(banner).not.toContain(buttonOwnerClass);
        }
        expect(banner).toMatch(
            /<SystemBannerButton[\s\S]*aria-label=\{dismissLabel\}[\s\S]*<X\s+data-icon="inline-start"\s+aria-hidden="true"\s*\/>/,
        );
        expect(banner).not.toContain("btn ghost btn-sm");
        expect(banner).toContain("<SystemBannerIcon");
        expect(banner).toContain("visibleBanners.length === 0");
        expect(banner).toContain('banner.state === "update-available"');
        expect(banner).toContain("window.location.reload()");
        expect(banner).not.toContain("CloseIcon");
        expect(banner).not.toContain("data-system-banner");
        expect(banner).not.toMatch(OLD_UI_RE);
        expect(alertPrimitive).not.toContain('"systemBanner"');
        expect(alertPrimitive).not.toContain("data-[kind=offline]");
        expect(alertPrimitive).not.toContain(
            "[&_[data-part=system-banner-icon]]",
        );
        expect(alertPrimitive).not.toContain(
            "[&_[data-part=system-banner-body]]",
        );
        expect(alertPrimitive).not.toContain(
            "[&_[data-part=system-banner-actions]]",
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
            ["transform: `translateX(-$", "{100 - progressPercent}%)`"].join(
                "",
            ),
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
