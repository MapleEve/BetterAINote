import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(process.cwd(), "src");
const SPEAKER_REVIEW_MERGE_POPOVER_PLACEMENT =
    "w-80 min-w-72 gap-0 overflow-hidden p-0";
const RECORDING_WORKSTATION_MAIN_REQUIRED_CLASS_TOKENS = [
    "flex",
    "h-screen",
    "min-w-0",
    "flex-col",
    "max-[860px]:min-w-0",
    "max-[860px]:max-w-full",
    "max-[860px]:box-border",
] as const;
const SOURCE_PROVIDER_STATUS_BADGE_OWNER_OVERRIDE_PATTERNS = [
    /(?:^|[\s"':])!?(?:size|(?:min-|max-)?[hw])-\[[^\]\s]+\](?=$|[\s"';])/,
    /(?:^|[\s"':])!?(?:size|(?:min-|max-)?[hw])-(?:\d+(?:\.\d+)?|px|auto|full|fit|min|max|screen|dvw|svw|lvw|dvh|svh|lvh)(?=$|[\s"';])/,
    /(?:^|[\s"':])!?p[trblxy]?-\[[^\]\s]+\](?=$|[\s"';])/,
    /(?:^|[\s"':])!?p[trblxy]?-(?:\d+(?:\.\d+)?|px)(?=$|[\s"';])/,
    /(?:^|[\s"':])!?text-\[[^\]\s]+\](?:\/[^\s"';]+)?(?=$|[\s"';])/,
    /(?:^|[\s"':])!?text-(?:xs|sm|base|lg|xl|[2-9]xl)(?:\/[^\s"';]+)?(?=$|[\s"';])/,
    /(?:^|[\s"':])!?leading-(?:\[[^\]\s]+\]|none|tight|snug|normal|relaxed|loose|\d+(?:\.\d+)?)(?=$|[\s"';])/,
    /(?:^|[\s"':])!?font-(?:\[[^\]\s]+\]|sans|serif|mono|thin|extralight|light|normal|medium|semibold|bold|extrabold|black)(?=$|[\s"';])/,
    /(?:^|[\s"':])!?\[(?:min-|max-)?(?:height|width|inline-size|block-size):[^\]\s]+\](?=$|[\s"';])/,
    /(?:^|[\s"':])!?\[padding(?:-(?:block|inline|top|right|bottom|left))?:[^\]\s]+\](?=$|[\s"';])/,
    /(?:^|[\s"':])!?\[(?:font-size|font-weight|line-height|letter-spacing):[^\]\s]+\](?=$|[\s"';])/,
] as const;
const DASHBOARD_MAIN_REQUIRED_CLASS_TOKENS = [
    "flex",
    "h-screen",
    "min-w-0",
    "flex-col",
    "max-[860px]:min-w-0",
    "max-[860px]:max-w-full",
    "max-[860px]:box-border",
] as const;
const EXPECTED_DASHBOARD_WORKSPACE_CLASS_NAME =
    "grid flex-1 min-h-0 grid-cols-[380px_1fr] gap-4 px-5 pt-4 pb-5 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border max-[860px]:grid-cols-[380px_0px] max-[860px]:[&>[data-sot-panel=dashboard-detail]]:hidden";
const EXPECTED_DASHBOARD_RECORDING_LIST_CARD_CLASS_NAME =
    "min-h-0 gap-0 rounded-2xl max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const EXPECTED_DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME =
    "flex min-h-0 flex-col p-0";
const EXPECTED_DASHBOARD_DETAIL_EMPTY_STATE_CLASS_NAME =
    "min-h-[280px] p-9 md:p-9";
const EXPECTED_DASHBOARD_DRAWER_SCRIM_CLASS_NAME =
    "pointer-events-none fixed inset-0 z-[300] hidden max-[860px]:block max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:pointer-events-auto";
const EXPECTED_DASHBOARD_DRAWER_ACTIVE_DOT_CLASS_NAME =
    "absolute top-1.5 right-1.5 hidden size-1.5 rounded-full bg-primary";
const EXPECTED_RECORDING_WORKSTATION_WORKSPACE_CLASS_NAME =
    "grid flex-1 min-h-0 grid-cols-[380px_1fr] gap-4 px-5 pt-4 pb-5 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border max-[860px]:grid-cols-[minmax(0,1fr)]";
const EXPECTED_DETAIL_PANEL_CLASS_NAME = "flex min-h-0 min-w-0 flex-col gap-4";
const EXPECTED_RECORDING_WORKSTATION_DETAIL_PANEL_CLASS_NAME =
    "flex min-h-0 min-w-0 flex-col gap-4 max-[860px]:max-w-full max-[860px]:box-border";
const EXPECTED_RECORDING_DETAIL_LIST_CARD_CLASS_NAME =
    "min-h-0 gap-0 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border";
const OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN =
    /\bspace-[xy]-|\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;
const REMOVED_SOURCE_REPORT_DOT_HOOKS = [
    ["SourceReport", "StatusDot"].join(""),
    ["DashboardSourceReport", "StatusDot"].join(""),
    ["sourceReportStatus", "DotBase"].join(""),
    ["data-sot-source-report-status", "dot"].join("-"),
] as const;
const SOURCE_REPORT_STATUS_DOT_STYLING_FORBIDDEN_SNIPPETS = [
    ...REMOVED_SOURCE_REPORT_DOT_HOOKS,
    '"inline-block size-[5px] rounded-[50%] bg-current"',
    ['part = "source-report-status', 'dot"'].join("-"),
    ['part="dashboard-source-report-status', 'dot"'].join("-"),
] as const;
const SOURCE_REPORT_STATUS_BADGE_FORBIDDEN_OWNER_SNIPPETS = [
    "h-[22px] justify-normal gap-[5px] overflow-visible px-[8px] py-0",
    "h-[22px]",
    "gap-[5px]",
    "px-[8px]",
    ...SOURCE_REPORT_STATUS_DOT_STYLING_FORBIDDEN_SNIPPETS,
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
        pattern:
            /<Alert\b[\s\S]*?data-sot-source-report-missing-notice[\s\S]*?>/,
        snippets: [
            'variant="warningSoft"',
            'density="compact"',
            'layout="inline"',
        ],
    },
    {
        pattern: /<Alert\b[\s\S]*?data-sot-source-report-empty[\s\S]*?>/,
        snippets: [
            'variant={tone === "danger" ? "statusError" : "default"}',
            'density="spacious"',
            'layout="centered"',
        ],
    },
    {
        pattern: /<Empty\b[\s\S]*?data-sot-source-report-empty[\s\S]*?>/,
        snippets: ['variant="subtle"'],
    },
    {
        pattern:
            /<EmptyMedia\b[\s\S]*?data-sot-source-report-empty-icon[\s\S]*?>/,
        snippets: ['variant={tone === "danger" ? "dangerIcon" : "subtleIcon"}'],
    },
    {
        pattern:
            /<EmptyTitle\b[\s\S]*?data-sot-source-report-empty-title[\s\S]*?>/,
        snippets: ['variant="compact"'],
    },
    {
        pattern:
            /<EmptyDescription\b[\s\S]*?data-sot-source-report-empty-description[\s\S]*?>/,
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
    "border-[var(--alert-destructive-icon-soft-border)] bg-[var(--alert-destructive-icon-soft-bg)] text-[var(--signal-danger)]",
    "block max-w-[360px] font-sans text-[12px] font-medium leading-[1.5] tracking-normal text-muted-foreground",
] as const;
const DASHBOARD_TOPBAR_REQUIRED_CLASS_TOKENS = [
    "relative",
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
    "max-[860px]:min-w-0",
    "max-[860px]:max-w-full",
    "max-[860px]:box-border",
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
    '[data-sot-panel="dashboard-sidebar"]',
    '[data-theme="dark"] [data-sot-panel="dashboard-sidebar"]',
    '.dark [data-sot-panel="dashboard-sidebar"]',
] as const;
const RECORDING_WORKSTATION_TOPBAR_REQUIRED_CLASS_TOKENS = [
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
    "supports-[backdrop-filter]:bg-background/60",
    "max-[860px]:min-w-0",
    "max-[860px]:max-w-full",
    "max-[860px]:box-border",
] as const;
const RECORDING_WORKSTATION_TOPBAR_FORBIDDEN_CLASS_PATTERN =
    /\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;
const DASHBOARD_MAIN_FORBIDDEN_CLASS_PATTERN =
    /\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;
const DASHBOARD_TOPBAR_FORBIDDEN_CLASS_PATTERN =
    DASHBOARD_MAIN_FORBIDDEN_CLASS_PATTERN;
const DASHBOARD_SIDEBAR_FORBIDDEN_CLASS_PATTERN =
    /\bspace-[xy]-|\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/;
const DASHBOARD_SIDEBAR_VISUAL_GLOBAL_DECLARATION_RE =
    /^\s*(?:-webkit-backdrop-filter|backdrop-filter|background|border(?:-(?:color|radius|right|style|width))?|box-shadow|display|flex-direction|padding|position)\s*:/m;
const WORKSTATION_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-panel="workstation-topbar"]',
    '[data-theme="dark"] [data-sot-panel="workstation-topbar"]',
    '[data-sot-part="workstation-crumbs"]',
    '[data-sot-part="workstation-crumb"]',
    '[data-sot-part="workstation-crumb-separator"]',
    '[data-sot-part="workstation-crumb-current"]',
] as const;
const DASHBOARD_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-panel="dashboard-topbar"]',
    '[data-theme="dark"] [data-sot-panel="dashboard-topbar"]',
    '[data-sot-part="dashboard-crumbs"]',
    '[data-sot-part="dashboard-crumb"]',
    '[data-sot-part="dashboard-crumb-separator"]',
    '[data-sot-part="dashboard-crumb-current"]',
] as const;
const SPEAKER_REVIEW_RESIDUAL_GLOBAL_SELECTORS = [
    '[data-sot-list="speaker-review-meta"] > span',
    '[data-sot-part="speaker-review-section-description"]',
    '[data-sot-part="speaker-review-segment-title"]',
    '[data-sot-part="speaker-review-segment-text"]',
    '[data-sot-part="speaker-review-row-name"]',
    '[data-sot-part="speaker-review-section-title"]',
    '[data-sot-part="speaker-review-row-sub"]',
    '[data-sot-part="speaker-review-row-sub"][data-sot-tone="danger"]',
] as const;
const SPEAKER_REVIEW_RESIDUAL_OWNER_CLASS_TOKENS = [
    {
        constName: "SPEAKER_REVIEW_META_ITEM_CLASS_NAME",
        tokens: [
            "min-w-0",
            "truncate",
            "text-xs",
            "font-medium",
            "leading-normal",
            "text-muted-foreground",
        ],
    },
    {
        constName: "SPEAKER_REVIEW_SECTION_DESCRIPTION_CLASS_NAME",
        tokens: [
            "m-0",
            "text-xs",
            "font-medium",
            "leading-normal",
            "text-muted-foreground",
            "max-[860px]:whitespace-normal",
            "max-[860px]:break-words",
        ],
    },
    {
        constName: "SPEAKER_REVIEW_SEGMENT_TITLE_CLASS_NAME",
        tokens: [
            "m-0",
            "text-xs",
            "font-semibold",
            "leading-normal",
            "text-muted-foreground",
        ],
    },
    {
        constName: "SPEAKER_REVIEW_SEGMENT_TEXT_CLASS_NAME",
        tokens: [
            "m-0",
            "text-sm",
            "font-medium",
            "leading-relaxed",
            "text-pretty",
            "text-foreground",
            "max-[860px]:whitespace-normal",
            "max-[860px]:break-words",
        ],
    },
    {
        constName: "SPEAKER_REVIEW_ROW_NAME_CLASS_NAME",
        tokens: [
            "m-0",
            "text-sm",
            "font-semibold",
            "leading-snug",
            "text-foreground",
        ],
    },
    {
        constName: "SPEAKER_REVIEW_SECTION_TITLE_CLASS_NAME",
        tokens: [
            "m-0",
            "text-sm",
            "font-semibold",
            "leading-snug",
            "text-foreground",
        ],
    },
    {
        constName: "SPEAKER_REVIEW_ROW_SUB_CLASS_NAME",
        tokens: [
            "m-0",
            "font-mono",
            "text-xs",
            "font-medium",
            "leading-snug",
            "tracking-wide",
            "text-muted-foreground",
            "data-[sot-tone=danger]:text-destructive",
            "max-[860px]:whitespace-normal",
            "max-[860px]:break-words",
        ],
    },
] as const;
const ONBOARDING_DEFAULT_SOURCE_ROOT_REPAINT_SELECTORS = [
    '[data-sot-control="onboarding-default-source"]',
    '[data-sot-control="onboarding-default-source"][data-sot-state="selected"]',
    '[data-sot-control="onboarding-default-source"][data-sot-state="disabled"]',
] as const;

const REMOVED_ONBOARDING_MATRIX_GLOBAL_SELECTORS = [
    '[data-sot-control="matrix-row"]',
    '[data-sot-part="matrix-label"]',
    '[data-sot-part="matrix-value"]',
] as const;

const REMOVED_ONBOARDING_ARBITRARY_LAYOUT_CLASSES = [
    "min-h-[100svh]",
    "px-[32px]",
    "pb-[80px]",
    "pt-[28px]",
    "p-[18px]",
    "[box-sizing:border-box]",
    "[min-height:375px]",
    "[width:min(420px,100%)]",
    "grid-cols-[36px_1fr_auto_auto]",
    "has-[>svg]:px-3.5",
    "mb-[18px]",
    "gap-[8px]",
    "min-h-[30px]",
    "grid-cols-[80px_1fr]",
    "py-[6px]",
    "text-[12px]",
    "[overflow-wrap:normal]",
    "[word-break:keep-all]",
    "[&>*]:w-full",
    "mb-[14px]",
    "gap-[6px]",
    "shadow-none",
] as const;
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
const DASHBOARD_SYNC_VISUAL_GLOBAL_DECLARATION_RE =
    /\b(?:display|align-items|gap|padding|border-radius|background|border|width|height|box-shadow|animation|font|color|margin-top|flex|min-width)\s*:/;
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
const RECORDING_WORKSTATION_BRAND_OWNER_CLASS_INITIALIZERS = [
    {
        property: "wrapper",
        expected: "flex items-center gap-2.5 px-2 pt-1 pb-4",
    },
    {
        property: "image",
        expected: "size-9 rounded-md",
    },
    {
        property: "name",
        expected: "text-sm font-semibold text-foreground",
    },
    {
        property: "subtitle",
        expected: "mt-px text-xs font-medium text-muted-foreground",
    },
] as const;

const REMOVED_AUTH_ONBOARDING_CARD_GLOBAL_SELECTORS = [
    "[data-sot-frame]",
    '[data-sot-frame="auth"]',
    '[data-sot-frame="onboarding"]',
    '[data-sot-layout="auth-workstation"]',
    '[data-sot-layout="onboarding-workstation"]',
    '[data-sot-panel="onboarding-steps"]',
    '[data-sot-control="onboarding-step"]',
    '[data-sot-part="auth-form-message"]',
    '[data-sot-part="onboarding-error"]',
    '[data-sot-part="auth-logo-mark"]',
    '[data-sot-part="auth-heading"]',
    '[data-sot-part="auth-description"]',
    '[data-sot-part="auth-local-choice"]',
    '[data-sot-part="onboarding-step-title"]',
    '[data-sot-part="onboarding-step-description"]',
    '[data-sot-part="onboarding-step-body"]',
    '[data-sot-list="onboarding-default-sources"]',
    '[data-sot-part="onboarding-default-source-swatch"]',
    '[data-sot-part="onboarding-actions"]',
    '[data-sot-list="provider-cards"]',
    '[data-sot-list="speaker-profiles"]',
    '[data-sot-list="finish-summary"]',
    '[data-sot-part="provider-icon"]',
    '[data-sot-part="provider-meta"]',
    '[data-sot-part="provider-name"]',
    '[data-sot-part="provider-hint"]',
    '[data-sot-card]:not([data-sot-card="source-report-metric"])',
    '[data-sot-card]:not([data-sot-card="source-report-metric"])\n    + [data-sot-card]:not([data-sot-card="source-report-metric"])',
    '[data-sot-part="card-heading"]',
    '[data-sot-part="card-heading"] + [data-sot-part="card-sub"]',
    '[data-sot-card="auth"]',
    '[data-sot-card="onboarding"]',
] as const;

const SPEAKER_PROFILE_PRIMITIVE_BUSINESS_TOKENS = [
    "speakerSettings",
    "speakerState",
    "speakerSettingsRow",
    "speakerSettingsRowFieldClassName",
    "speakerSettingsAction",
    "speakerSettingsDangerAction",
    "speakerAvatarFallbackClassName",
] as const;

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

function extractNamedImportBlock(source: string, modulePath: string) {
    const escapedModulePath = modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(
        `import\\s*\\{[\\s\\S]*?\\}\\s*from\\s*"${escapedModulePath}";`,
    ).exec(source);

    expect(match).not.toBeNull();
    return match?.[0] ?? "";
}

function expectNamedImportSymbols(
    source: string,
    modulePath: string,
    symbols: readonly string[],
) {
    const importBlock = extractNamedImportBlock(source, modulePath);

    for (const symbol of symbols) {
        const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        expect(importBlock).toMatch(new RegExp(`\\b${escapedSymbol}\\b`));
    }
}

function findStringConstInitializerContaining(
    source: string,
    snippets: readonly string[],
) {
    const initializer =
        [...source.matchAll(/const\s+[A-Za-z0-9_]+\s*=\s*"[^"]*";/g)]
            .map((match) => match[0])
            .find((candidate) =>
                snippets.every((snippet) => candidate.includes(snippet)),
            ) ?? "";

    expect(initializer).not.toBe("");
    return initializer;
}

const ROUTE_LOADING_SURFACE_CLASS_VALUE =
    "min-h-0 gap-0 overflow-hidden rounded-2xl border-border bg-card shadow-sm backdrop-blur-none";
const ROUTE_LOADING_SURFACE_CLASS_TOKENS =
    ROUTE_LOADING_SURFACE_CLASS_VALUE.split(" ");
const ROUTE_FALLBACK_CHROME_SHELL_CLASS_VALUE =
    "flex h-screen min-h-screen bg-background text-foreground transition-all duration-300 ease-out";
const DASHBOARD_ROUTE_LOADING_DETAIL_CLASS_VALUE =
    "flex min-h-0 min-w-0 flex-col gap-4";
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
const RECORDING_PLAYER_CLASS_INITIALIZERS = [
    {
        constName: "RECORDING_PLAYER_META_CLASS_NAME",
        expected: "flex flex-wrap items-center gap-2.5",
    },
    {
        constName: "RECORDING_PLAYER_DATE_CLASS_NAME",
        expected: "tabular-nums text-muted-foreground",
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
        expected: "min-w-11 text-center tabular-nums text-muted-foreground",
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

const COMPONENT_LIBRARY_SHOWCASE_GLOBAL_PATTERNS = [
    /\.cl-/,
    /cl-pop-host/,
    /\bstack-strip\b/,
    /\bstack-banner\.cl-show\b/,
    /\bcl-stage-[\w-]+\b/,
    /@keyframes\s+cl-shimmer\b/,
] as const;

function expectNoComponentLibraryShowcaseGlobals(globals: string) {
    for (const pattern of COMPONENT_LIBRARY_SHOWCASE_GLOBAL_PATTERNS) {
        expect(globals).not.toMatch(pattern);
    }
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function staticJsxClassName(className: string) {
    return `className="${className}"`;
}

const SEARCH_ACTIVITY_PRIMITIVE_FILES = [
    "components/ui/button.tsx",
    "components/ui/badge.tsx",
    "components/ui/card.tsx",
    "components/ui/input-group.tsx",
    "components/ui/toggle-group.tsx",
    "components/ui/alert.tsx",
] as const;

const SEARCH_ACTIVITY_BUSINESS_TOKEN_RE =
    /\b(?:dashboardSearch|librarySearch|dashboardActivity)[A-Za-z0-9_]*/g;

const LIBRARY_SEARCH_CLASS_PROPERTY_BY_OLD_OWNER_PROPERTY = {
    dashboardSearchTrigger: "trigger",
    librarySearchAnchor: "anchor",
    librarySearchClear: "clear",
    librarySearchError: "error",
    librarySearchErrorTitle: "errorTitle",
    librarySearchGroupLabel: "groupLabel",
    librarySearchHighlight: "highlight",
    librarySearchInput: "input",
    librarySearchInputRow: "inputRow",
    librarySearchPanel: "panel",
    librarySearchResult: "result",
    librarySearchResultGroup: "resultGroup",
    librarySearchResultMeta: "resultMeta",
    librarySearchResultTitle: "resultTitle",
    librarySearchRetry: "retry",
    librarySearchScope: "scope",
    librarySearchScopeItem: "scopeItem",
    librarySearchScroll: "scroll",
    librarySearchStateCopy: "stateCopy",
    librarySearchStateSkeleton: "stateSkeleton",
    librarySearchTag: "tag",
} as const;

function extractSearchActivityOwnerClassProperty({
    activityClassNames,
    librarySearchClassNames,
    propertyName,
}: {
    activityClassNames: string;
    librarySearchClassNames: string;
    propertyName: string;
}) {
    const librarySearchPropertyName =
        LIBRARY_SEARCH_CLASS_PROPERTY_BY_OLD_OWNER_PROPERTY[
            propertyName as keyof typeof LIBRARY_SEARCH_CLASS_PROPERTY_BY_OLD_OWNER_PROPERTY
        ];

    return extractObjectStringProperty(
        librarySearchPropertyName
            ? librarySearchClassNames
            : activityClassNames,
        librarySearchPropertyName ?? propertyName,
    );
}

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
        snippets: ["relative"],
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
        propertyName: "librarySearchPanel",
        snippets: [
            "absolute right-0 top-[calc(100%+8px)]",
            "w-[460px]",
            "max-[640px]:fixed",
        ],
    },
    {
        propertyName: "dashboardActivityPanel",
        snippets: ["absolute right-0 top-[calc(100%+8px)]", "w-[380px]"],
    },
    {
        propertyName: "librarySearchInputRow",
        snippets: ["h-[49px] min-h-[49px]", "gap-[8px]", "px-[12px] py-[8px]"],
    },
    {
        propertyName: "librarySearchInput",
        snippets: ["h-8", "px-1 py-0", "text-sm"],
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
        snippets: ["h-6", "rounded-full", "px-2.5", "text-xs"],
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
            "px-2.5 py-2",
            "whitespace-normal",
        ],
    },
    {
        propertyName: "librarySearchResultTitle",
        snippets: ["text-sm", "font-semibold", "text-foreground"],
    },
    {
        propertyName: "librarySearchResultMeta",
        snippets: ["font-mono", "text-xs", "text-muted-foreground"],
    },
    {
        propertyName: "librarySearchTag",
        snippets: ["h-6", "w-fit", "justify-normal", "px-2"],
    },
    {
        propertyName: "dashboardActivityCount",
        snippets: ["p-0", "font-mono text-xs"],
    },
    {
        propertyName: "librarySearchClear",
        snippets: ["size-6"],
    },
    {
        propertyName: "librarySearchRetry",
        snippets: ["h-6", "px-2", "text-xs"],
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
        snippets: ["text-sm", "[&_span]:font-semibold"],
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
        snippets: ["px-1.5 py-1", "font-mono", "tracking-wide"],
    },
    {
        propertyName: "librarySearchHighlight",
        snippets: ["bg-primary/10", "px-[2px]", "text-primary"],
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

const LIBRARY_SEARCH_FEATURE_OWNER_SOURCE_SNIPPETS = [
    "aria-expanded={open}",
    'data-sot-state={open ? "open" : "idle"}',
    "placeholder={t(",
    '"librarySearch.shortPlaceholder"',
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
    'data-sot-state={activityOpen ? "open" : "idle"}',
] as const;

function collectSearchActivityPrimitiveBusinessTokens() {
    return SEARCH_ACTIVITY_PRIMITIVE_FILES.flatMap((file) =>
        (readSource(file).match(SEARCH_ACTIVITY_BUSINESS_TOKEN_RE) ?? [])
            .sort()
            .map((token) => `${file}:${token}`),
    );
}

function hasExactBusinessToken(source: string, token: string) {
    return new RegExp(`\\b${escapeRegExp(token)}(?![A-Za-z0-9_])`).test(source);
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

function collectAiRenamePrimitiveBusinessTokens() {
    return AI_RENAME_PREVIEW_SHARED_PRIMITIVE_FILES.flatMap((file) => {
        const source = readSource(file);
        return AI_RENAME_PREVIEW_BUSINESS_TOKENS.filter((token) =>
            hasExactBusinessToken(source, token),
        ).map((token) => `${file}:${token}`);
    });
}

function extractCardSlice(source: string, marker: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf("<Card", markerIndex);
    const end = source.indexOf("</Card>", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + "</Card>".length);
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

function extractLibrarySearchClassNames(source: string) {
    const marker = "const librarySearchClassNames = {";
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

function extractElementSlice(source: string, marker: string, tagName: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    const start = source.lastIndexOf(`<${tagName}`, markerIndex);
    const end = source.indexOf(`</${tagName}>`, markerIndex);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + tagName.length + 3);
}

function expectSourceProviderStatusBadgeClassIsLayoutOnly(
    statusBadgeClass: string,
) {
    expect(statusBadgeClass).toMatch(
        /const SOURCE_PROVIDER_STATUS_BADGE_CLASS\s*=\s*"justify-self-end";/,
    );

    for (const pattern of SOURCE_PROVIDER_STATUS_BADGE_OWNER_OVERRIDE_PATTERNS) {
        expect(statusBadgeClass).not.toMatch(pattern);
    }
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

function extractOpeningElement(
    source: string,
    marker: string,
    tagName: string,
) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);
    return extractOpeningElementAt(source, markerIndex, tagName);
}

function extractOpeningElementAt(
    source: string,
    markerIndex: number,
    tagName: string,
) {
    const start = source.lastIndexOf(`<${tagName}`, markerIndex);
    const end = source.indexOf(">", markerIndex);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(markerIndex);
    return source.slice(start, end + 1);
}

function expectAiRenameGenericPrimitiveCall(
    source: string,
    marker: string,
    tagName: "Alert" | "Badge" | "Button" | "PopoverContent",
) {
    const openingElement = collectOpeningElements(source, tagName).find(
        (candidate) => candidate.includes(marker),
    );

    expect(openingElement).toBeDefined();
    expect(openingElement).toContain("className=");
    expect(openingElement ?? "").not.toMatch(
        /\b(?:variant|size|density|layout)="aiRenamePreview[A-Za-z0-9_]*"/,
    );
    return openingElement ?? "";
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

function collectOpeningElements(source: string, tagName: string) {
    const openings: string[] = [];
    let searchFrom = 0;

    while (searchFrom < source.length) {
        const start = source.indexOf(`<${tagName}`, searchFrom);
        if (start < 0) break;

        let braceDepth = 0;
        let quote: '"' | "'" | "`" | null = null;
        let end = -1;

        for (
            let index = start + tagName.length + 1;
            index < source.length;
            index += 1
        ) {
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
                braceDepth += 1;
                continue;
            }

            if (character === "}") {
                braceDepth = Math.max(0, braceDepth - 1);
                continue;
            }

            if (character === ">" && braceDepth === 0) {
                end = index;
                break;
            }
        }

        expect(end).toBeGreaterThan(start);
        openings.push(source.slice(start, end + 1));
        searchFrom = end + 1;
    }

    return openings;
}

function collectSourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectSourceFiles(entryPath);
        return /\.(css|ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    });
}

function readProductCss(source: string) {
    return source;
}

function stripCssComments(source: string) {
    return source.replace(/\/\*[\s\S]*?\*\//g, "");
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

function collectProviderDetailActionGlobalBusinessBlocks(source: string) {
    return PROVIDER_DETAIL_ACTION_GLOBAL_SELECTOR_FRAGMENTS.flatMap(
        (selectorFragment) =>
            collectCssRuleBlocks(source, selectorFragment).filter(
                ({ declarations }) =>
                    PROVIDER_DETAIL_ACTION_GLOBAL_DECLARATION_RE.test(
                        declarations,
                    ),
            ),
    );
}

function extractCssBlockRange(source: string, marker: string) {
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
                return {
                    startLine: source.slice(0, markerIndex).split("\n").length,
                    endLine: source.slice(0, index).split("\n").length,
                };
            }
        }
    }

    throw new Error(`Unclosed CSS block: ${marker}`);
}

function cssLineProperty(lines: string[], index: number) {
    for (let cursor = index; cursor >= 0; cursor -= 1) {
        const line = lines[cursor];
        const declaration = line.match(/^\s*([\w-]+|--[\w-]+)\s*:/);
        if (declaration) return declaration[1];
        if (/^\s*[.#:@[]?[\w-]/.test(line) && line.includes("{")) break;
    }
    return null;
}

function isLineInside(
    line: number,
    range: { startLine: number; endLine: number },
) {
    return line >= range.startLine && line <= range.endLine;
}

function expectTokenOklchFallbackOrder(
    source: string,
    marker: string,
    allowedTokenFallbackExceptions = new Set<string>(),
) {
    const block = extractCssBlock(source, marker);
    const lines = block.split("\n");
    const missingFallbacks: string[] = [];

    for (const [index, line] of lines.entries()) {
        const match = line.match(/^\s*(--[\w-]+):\s*(oklch\(|color-mix\()/);
        if (!match) continue;
        if (allowedTokenFallbackExceptions.has(match[1])) continue;

        const fallback = lines[index - 1]?.trim() ?? "";
        const hasSameTokenFallback = fallback.startsWith(`${match[1]}:`);
        const hasRgbFallback =
            /\brgba?\(/.test(fallback) || /\brgb\(/.test(fallback);

        if (!hasSameTokenFallback || !hasRgbFallback) {
            missingFallbacks.push(
                `${marker} ${match[1]} lacks immediate rgb/rgba fallback`,
            );
        }
    }

    expect(missingFallbacks).toEqual([]);
}

type ColorDeclarationFinding = {
    line: number;
    property: string | null;
    text: string;
};

const MODERN_COLOR_RE = /\b(oklch|color-mix)\(/;

const CSS_SUPPORTED_PATH_COLOR_PROPERTIES = new Set([
    "background",
    "border",
    "border-bottom",
    "border-bottom-color",
    "border-color",
    "box-shadow",
    "color",
    "outline",
    "scrollbar-color",
    "text-decoration-color",
]);

const LEGACY_MODAL_SHELL_PRODUCT_CSS_SELECTOR_RE =
    /(^|[,\s>{])\.(?:scrim|modal|modal-head|modal-icon|modal-title|modal-desc|modal-body|modal-foot)(?![\w-])/m;

const LEGACY_MONO_PRODUCT_CSS_SELECTOR_RE = /(^|[,\s>{])\.mono(?![\w-])/m;

const LEGACY_DESIGN_TWEAKS_PRODUCT_CSS_SELECTOR_RE =
    /#tweaks-(?:panel|close)|--(?:ds-only-accent|todo-marker-bg|z-tweaks)\b|(^|[,\s>{])\.(?:design-todo|ds-only-(?:badge|mark|note)|ds-trigger-chip|tw-[\w-]+|src-item|src-hint(?:-email)?|cl-tweaks-mock|cl-tm-[\w-]+)(?![\w-])/m;

const UNAPPROVED_PRODUCT_CSS_CLASS_SELECTOR_RE =
    /(^|[,\s>{(:])\.(?!dark(?:[\s,:[>{]|$))[A-Za-z][\w-]*(?![\w-])/m;

const REMOVED_SETTINGS_SHELL_GLOBAL_SELECTORS = [
    '[data-sot-overlay="settings-shell"]',
    '[data-sot-overlay="settings-shell"][data-state="open"]',
    '[data-sot-overlay="settings-shell"][data-state="closed"]',
    '[data-sot-surface="settings-shell"]',
    '[data-sot-surface="settings-shell"][data-state="closed"]',
] as const;

const REMOVED_DEAD_SOT_GLOBAL_SELECTORS = [
    '[data-sot-part="dialog-icon"]',
    '[data-sot-panel="source-provider-detail"] [data-sot-part="field-empty"]',
    '[data-sot-part="source-filter-icon"]',
] as const;

const REMOVED_SETTINGS_NAV_GLOBAL_REPAINT_SELECTORS = [
    '[data-sot-control="settings-nav"]',
    '[data-sot-control="settings-nav"]:hover',
    '[data-sot-control="settings-nav"][data-state="active"]',
    '[data-theme="dark"] [data-sot-control="settings-nav"][data-state="active"]',
    '[data-sot-control="settings-nav"] svg',
    '[data-sot-control="settings-nav"]:focus-visible',
    '[data-sot-panel="settings-rail"] [data-sot-control="settings-nav"]',
    '[data-sot-panel="settings-rail"] [data-sot-control="settings-nav"] svg',
] as const;

const REMOVED_SETTINGS_DEAD_TENANT_GLOBAL_SELECTORS = [
    '[data-tenant="single"]',
    "[data-tenant-single]",
    "[data-tenant-multi]",
    '[data-sot-control="settings-nav"][data-sot-section="account"]',
] as const;

const DIALOG_SLOT_GLOBAL_SELECTORS = [
    '[data-slot="dialog-header"]',
    '[data-slot="dialog-title"]',
    '[data-slot="dialog-description"]',
    '[data-slot="dialog-footer"]',
] as const;

const DELETE_CONFIRM_MODAL_EXTRAS_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /(^|[,\s>{])\.(?:del-modal-icon|del-modal-name)(?![\w-])/m;

const MIGRATED_CONFIRM_DIALOG_GLOBAL_SELECTORS = [
    '[data-sot-overlay="confirm-dialog"]',
    '[data-sot-panel="confirm-dialog"]',
    '[data-sot-content="confirm-dialog"]',
    '[data-sot-part="confirm-head"]',
    '[data-sot-part="confirm-body"]',
    '[data-sot-part="confirm-extra"]',
    '[data-sot-part="confirm-foot"]',
    '[data-sot-item="confirm-dialog-detail"]',
    '[data-sot-part="confirm-warning"]',
] as const;

const CONFIRM_DIALOG_PRIMITIVE_RESIDUAL_SNIPPETS = [
    "bg-[var(",
    "border-[var(",
    "text-[var(",
    "shadow-[var(",
    "!border",
    "!bg",
    "!text",
    "![box-shadow:none]",
    "!shadow",
    "CONFIRM_DIALOG_PANEL_CLASS",
    "CONFIRM_DIALOG_OVERLAY_CLASS",
    "CONFIRM_DIALOG_FOOTER_CLASS",
    "CONFIRM_DIALOG_ACTION_BUTTON_CLASS",
    "CONFIRM_DIALOG_CANCEL_BUTTON_CLASS",
    "CONFIRM_DIALOG_DESTRUCTIVE_BUTTON_CLASS",
] as const;

const CONFIRM_DIALOG_BUTTON_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|letter-spacing|line-height|padding|transition)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

const DASHBOARD_RECORDING_LIST_REPLACED_LEGACY_CLASSES = [
    "day-label",
    "rec-row",
    "rec-thumb",
    "rec-body",
    "rec-title",
    "rec-meta",
    "tag",
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
    "list-state-pagination",
    "lsb-ico",
    "lsb-t",
    "lsb-h",
    "lsb-page-divider",
    "lsb-page-nav",
    "lsb-page-num",
];

const DASHBOARD_RECORDING_LIST_REPLACEMENT_HOOKS = [
    'data-sot-surface="dashboard-recording-list"',
    'data-sot-part="dashboard-recording-list-content"',
    'data-sot-part="dashboard-recording-list-header"',
    'data-sot-part="dashboard-recording-list-titlebar"',
    'data-sot-part="dashboard-recording-list-title"',
    'data-sot-part="dashboard-recording-list-count"',
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
    'data-sot-control="dashboard-recording-row"',
    'data-sot-part="dashboard-recording-source-mark"',
    'data-sot-part="dashboard-recording-row-body"',
    'data-sot-part="dashboard-recording-row-title"',
    'data-sot-part="dashboard-recording-row-meta"',
    'data-sot-part="recording-list-state-icon"',
    'data-sot-part="recording-list-state-title"',
    'data-sot-part="recording-list-state-description"',
    'data-sot-part="recording-list-page-divider"',
    'data-sot-part="recording-list-page-nav"',
    'data-sot-part="recording-list-page-number"',
];

const DASHBOARD_RECORDING_LIST_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:day-label|rec-row|rec-thumb|rec-body|rec-title|rec-meta|tag|sidebar-footer|card|card-h|card-sub|frame|list-state-block|lsb-ico|lsb-t|lsb-h|lsb-page-divider|lsb-page-nav|lsb-page-num)(?![\w-])/;

const EXPECTED_DASHBOARD_RECORDING_LIST_HEADER_CLASS_NAME =
    "border-b border-border px-3 pt-3 pb-2.5";
const EXPECTED_DASHBOARD_SIDEBAR_FOOTER_CLASS_NAME =
    "border-t border-border pt-2.5";

const MOBILE_OWNER_LAYOUT_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-shell="dashboard-workstation"]',
    '[data-sot-shell="recording-workstation"]',
    '[data-sot-panel="dashboard-main"]',
    '[data-sot-surface="dashboard-recording-list"]',
    '[data-sot-panel="recording-detail-list"]',
    '[data-sot-panel="recording-workstation-detail"]',
    '[data-sot-panel="workstation-sidebar"]',
] as const;

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
    '[data-sot-panel="dashboard-workspace"]',
    '[data-sot-panel="workstation-workspace"]',
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
    '[data-sot-panel="recording-list-pagination"] [data-slot="button"]:disabled',
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

const LIBRARY_SEARCH_LEGACY_PRODUCT_CSS_CLASSES = [
    "ls-anchor",
    "ls-panel",
    "ls-trigger",
    "ls-input",
    "ls-input-row",
    "ls-clear",
    "ls-scope",
    "ls-chip",
    "ls-body",
    "ls-section",
    "ls-section-label",
    "ls-result",
    "ls-group",
    "ls-group-label",
    "ls-item",
    "ls-item-title",
    "ls-item-meta",
    "ls-hint",
    "ls-empty",
    "ls-loading",
    "ls-state",
    "ls-error",
    "ls-tail",
    "inline-progress",
    "ls-state-indexing",
];

const LIBRARY_SEARCH_LEGACY_PRODUCT_CSS_SELECTOR_RE = new RegExp(
    `\\.(${LIBRARY_SEARCH_LEGACY_PRODUCT_CSS_CLASSES.join("|")})(?![\\w-])`,
);

const MIGRATED_LIBRARY_SEARCH_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-part="library-search-anchor"]',
    '[data-sot-panel="library-search"]',
    '[data-sot-panel="library-search"][data-open="true"]',
    '[data-sot-panel="library-search"] kbd',
    '[data-sot-region="library-search-scroll"]',
    '[data-sot-part="library-search-indexing"]',
    '[data-sot-part="library-search-loading"]',
    '[data-sot-part="library-search-empty"]',
    '[data-sot-part="library-search-state-skeleton"]',
    '[data-sot-part="library-search-state-copy"]',
    '[data-sot-list="library-search-results"]',
    '[data-sot-group="library-search-results"]',
    '[data-sot-part="library-search-group-label"]',
    '[data-sot-control="library-search-result"] mark',
];

const MIGRATED_DASHBOARD_ACTIVITY_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-part="dashboard-topbar-actions"]',
    '[data-sot-part="dashboard-activity-anchor"]',
    '[data-sot-control="dashboard-activity"]',
    '[data-sot-part="dashboard-activity-badge"]',
    '[data-sot-panel="dashboard-activity"]',
    '[data-sot-panel="dashboard-activity"][data-open="true"]',
    '[data-sot-part="dashboard-activity-header"]',
    '[data-sot-part="dashboard-activity-heading"]',
    '[data-sot-part="dashboard-activity-title"]',
    '[data-sot-part="dashboard-activity-content"]',
    '[data-sot-part="dashboard-activity-status"]',
    '[data-sot-part="dashboard-activity-status-indicator"]',
    '[data-sot-part="dashboard-activity-status-copy"]',
    '[data-sot-part="dashboard-activity-status-line"]',
    '[data-sot-part="dashboard-activity-status-sub"]',
    '[data-sot-list="dashboard-activity-items"]',
    '[data-sot-item="dashboard-activity-item"]',
    '[data-sot-part="dashboard-activity-item-icon"]',
    '[data-sot-part="dashboard-activity-item-copy"]',
    '[data-sot-part="dashboard-activity-item-actions"]',
    '[data-sot-control="dashboard-activity-dismiss"]:focus-visible',
    '[data-sot-part="dashboard-activity-empty"][hidden]',
    '[data-sot-part="dashboard-activity-item-title"]',
    '[data-sot-part="dashboard-activity-item-body"]',
    '[data-sot-part="dashboard-activity-item-meta"]',
] as const;

const LIBRARY_SEARCH_PRIMITIVE_REPAINT_CSS_SELECTORS = [
    '[data-sot-control="dashboard-search"][data-slot="button"]',
    '[data-sot-control="dashboard-search"][data-slot="button"] svg',
    '[data-sot-part="library-search-input-row"] [data-slot="input-group-addon"]',
    '[data-sot-control="library-search-input"][data-slot="input-group-control"]',
    '[data-sot-control="library-search-clear"]',
    '[data-sot-control="library-search-scope"]',
    '[data-sot-part="library-search-error"] [data-slot="alert-title"]',
    '[data-sot-part="library-search-error"] [data-slot="button"]',
    '[data-sot-control="library-search-result"] {',
    '[data-sot-control="library-search-result"]:hover',
    '[data-sot-control="library-search-result"]:focus-visible',
    '[data-sot-part="library-search-tag-chip"] {',
];

const DASHBOARD_TOPBAR_SOURCE_STATUS_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:src-dot|dot-success|dot-warning|dot-info|dot-muted|dot|search|avatar)(?![\w-])/;

const TOPBAR_LEGACY_PRODUCT_CSS_SELECTOR_RE = /(^|[,\s>])\.topbar(?![\w-])/m;

const DASHBOARD_DETAIL_HEADER_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:detail|rec-head|rec-h2|rec-h2-status|rec-h2-local|rec-h2-input|rh-edit|rh-norm|real-detail|ai-rename-anchor)(?![\w-])/;

const DASHBOARD_SOURCE_PROVIDER_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-control="dashboard-source-provider"]',
    '[data-sot-part="source-provider-mark"]',
    '[data-sot-part="source-provider-status"]',
    '[data-sot-part="source-provider-count"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="syncing"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="sync-error"]',
];

const DASHBOARD_SHELL_NAV_PRIMITIVE_REPAINT_SELECTORS = [
    '[data-sot-control="sidebar-collapse"][data-slot="button"]',
    '[data-sot-control="dashboard-favorite"][data-slot="button"]',
    '[data-sot-control="dashboard-source-provider"][data-slot="button"]',
    '[data-sot-control="dashboard-sync"][data-slot="button"]',
    '[data-sot-control="dashboard-settings"][data-slot="button"]',
    '[data-sot-control="dashboard-settings"][data-sot-part="dashboard-user-avatar"]',
] as const;

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

const AUTH_CARD_PRIMITIVE_FORBIDDEN_TOKENS = [
    "authSurface",
    "authHeader",
    "authHeaderTitle",
    "authHeaderDescription",
    "authFrame",
    "authFrameTitle",
    "authFrameDescription",
] as const;

const AUTH_BUTTON_PRIMITIVE_FORBIDDEN_TOKENS = [
    "authSubmit",
    "authInlineLink",
] as const;

const AUTH_INPUT_PRIMITIVE_FORBIDDEN_TOKENS = ["authEmail"] as const;

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

const EXPECTED_DASHBOARD_TRANSCRIPT_LANGUAGE_BADGE_CLASS_NAME = "gap-1.5";
const EXPECTED_DASHBOARD_DETAIL_HEADER_ACTION_ANCHOR_CLASS_NAME =
    "relative inline-flex items-center gap-1.5";
const EXPECTED_DASHBOARD_TRANSCRIPT_HEADER_CLASS_NAME =
    "flex flex-row flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3.5 py-3";
const EXPECTED_DASHBOARD_TRANSCRIPT_SEGMENTED_TABS_CLASS_NAME = "shrink-0";
const EXPECTED_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME =
    "ml-auto inline-flex max-w-full flex-[0_1_auto] flex-wrap items-center gap-2";
const EXPECTED_DASHBOARD_TRANSCRIPT_BODY_BASE_CLASS_NAME =
    "min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-5";
const EXPECTED_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME =
    "min-h-0 flex-1 gap-0 rounded-2xl";

const CARD_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS = [
    "onboarding",
    "detailHeader",
    "recordingTagManager",
    "speakerReview",
    "popover",
    "popoverNote",
    "elevated",
] as const;

const AUTH_LOGIN_REPAINT_FORBIDDEN_SNIPPETS = [
    "headerTitle:",
    "headerDescription:",
    "frameTitle:",
    "frameDescription:",
    "emailInput:",
    "submitButton:",
    "inlineLink:",
    "min-h-[389px]",
    "rounded-[14px]",
    "border-[var(--line-hairline)]",
    "bg-[var(--bg-elevated)]",
    "text-[var(--fg-primary)]",
    "[font:600_18px_var(--font-display)]",
    "[font:500_13px_var(--font-sans)]",
    "text-[var(--button-primary-fg)]",
    "focus-visible:!border-ring",
    "focus-visible:ring-[3px]",
    "h-auto min-h-0 rounded-none p-0",
] as const;

const AUTH_LOGIN_PRIMITIVE_REPAINT_FORBIDDEN_PATTERNS = [
    /(?:^|[\s"'`])!?h-\[[^\]]+\]/,
    /(?:^|[\s"'`])!?min-h-\[[^\]]+\]/,
    /(?:^|[\s"'`])!?w-\[[^\]]+\]/,
    /(?:^|[\s"'`])!?rounded-\[[^\]]+\]/,
    /(?:^|[\s"'`])!?p[trblxy]?-\[[^\]]+\]/,
    /(?:^|[\s"'`])!?text-\[var\([^\]]+\)\]/,
    /(?:^|[\s"'`])!?(?:bg|border|shadow)-\[var\([^\]]+\)\]/,
    /\[(?:font|display|align-items|border-radius|height|width|margin-bottom):[^\]]+\]/,
    /focus-visible:!/,
] as const;

const AUTH_LOGIN_COPY_STRINGS = [
    "发送中...",
    "发送登录链接",
    "启动中...",
    "仅本地使用",
    "登录链接发送失败",
    "登录链接已发送",
    "本地工作空间启动失败",
    "已进入本地工作空间",
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
    "max-h-[260px]",
    "border border-border",
    "bg-popover",
    "text-popover-foreground",
    "shadow-md",
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
    "data-[sot-state=connected-active]:text-foreground",
    "data-[sot-state=sync-error]:text-foreground",
    "data-[sot-state=disabled]:opacity-50",
    "[&_[data-sot-part=source-provider-mark]]:size-[18px]",
    "[&_[data-sot-part=source-provider-mark]]:rounded-sm",
    "[&_[data-sot-part=source-provider-mark]_img]:object-contain",
    "[&_[data-sot-part=source-provider-mark][data-sot-provider-cover=true]_img]:object-cover",
    "data-[sot-state=no-results]:[&_[data-sot-part=source-provider-mark]]:opacity-60",
    "data-[sot-state=disabled]:[&_[data-sot-part=source-provider-mark]]:grayscale",
    "size-1.5",
    "data-[sot-tone=err]:bg-destructive",
    "data-[sot-tone=syncing]:animate-[bpulse_1.2s_ease-in-out_infinite]",
    "min-w-[22px]",
    "font-mono text-xs",
    "data-[sot-tone=active]:text-foreground",
    "data-[sot-tone=empty]:line-through",
    "data-[sot-tone=err]:text-destructive",
    "ml-1.5",
    "h-6",
    "rounded-full",
    "data-[sot-action=retry]:hidden",
    "data-[sot-action=retry]:text-destructive",
    "data-[sot-action=connect]:text-primary",
    "group-hover/source-provider:data-[sot-action=retry]:inline-flex",
    "group-focus-within/source-provider:data-[sot-action=retry]:inline-flex",
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
    "from:",
    "flex-[0_1_auto]",
    "[&_b]:font-semibold",
    "separator:",
    "w-2.5",
    "select-none",
    "chip:",
    "h-6",
    "gap-1.5",
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

const DASHBOARD_SOURCE_PROVIDER_DIRECT_STATE_SELECTORS = [
    '[data-sot-control="dashboard-source-provider"][data-sot-state="connected-active"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="connected-idle"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="syncing"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="expired"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="sync-error"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="no-results"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="needs-setup"]',
    '[data-sot-control="dashboard-source-provider"][data-sot-state="disabled"]',
] as const;

const AUTH_ONBOARDING_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:field-help|auth-sot-canvas|onboarding-sot-canvas|auth-mark|auth-title|auth-sub|auth-local-row|auth-local-link|onboarding-progress|onboarding-progress-segment|onboarding-actions)(?![\w-])/;

const LIQUID_TABS_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:liquid-tabs|lt-ind|lt-tab)(?![\w-])/;

const RETIRED_LIQUID_TABS_CSS_SELECTORS = [
    '[data-sot-control="liquid-tabs"][data-slot="segmented-tabs"]',
    '[data-sot-control="liquid-tabs"][data-slot="segmented-tabs"][data-sot-size="sm"]',
    '[data-sot-part="liquid-tabs-indicator"]',
    '[data-sot-control="liquid-tab"]',
    '[data-sot-control="liquid-tab"][data-sot-state="active"]',
    '[data-sot-control="liquid-tabs"]',
    '[data-sot-control="liquid-tabs"][data-tabs="3"]',
    '[data-sot-control="liquid-tabs"][data-idx="2"]',
];

const SYSTEM_BANNER_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:sys-banner|sbn-(?:ico|body|title|sub|actions|progress|bar))(?![\w-])/;

const RETIRED_SYSTEM_BANNER_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-icon"]',
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-body"]',
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-title"]',
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-description"]',
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-actions"]',
    '[data-sot-panel="system-banner"] [data-sot-control^="system-banner-"]',
    '[data-sot-panel="system-banner"][data-kind="offline"]',
    '[data-sot-panel="system-banner"][data-kind="permission-denied"]',
    '[data-sot-panel="system-banner"][data-kind="db-locked"]',
    '[data-sot-panel="system-banner"][data-kind="update-available"]',
    '[data-sot-panel="system-banner"][data-kind="import-progress"]',
    '[data-sot-panel="system-banner"][data-kind="export-progress"]',
    '[data-sot-panel="system-banner"] [data-sot-part="system-banner-progress"]',
    '[data-sot-panel="system-banner"][data-pct="0"]',
    '[data-sot-panel="system-banner"][data-pct="10"]',
    '[data-sot-panel="system-banner"][data-pct="20"]',
    '[data-sot-panel="system-banner"][data-pct="30"]',
    '[data-sot-panel="system-banner"][data-pct="40"]',
    '[data-sot-panel="system-banner"][data-pct="50"]',
    '[data-sot-panel="system-banner"][data-pct="60"]',
    '[data-sot-panel="system-banner"][data-pct="70"]',
    '[data-sot-panel="system-banner"][data-pct="80"]',
    '[data-sot-panel="system-banner"][data-pct="90"]',
    '[data-sot-panel="system-banner"][data-pct="100"]',
];

const SYSTEM_BANNER_ALERT_PRIMITIVE_RETIRED_TOKENS = [
    "systemBanner",
    "data-[kind=offline]",
    "data-[kind=permission-denied]",
    "data-[kind=db-locked]",
    "data-[kind=update-available]",
    "data-[kind=import-progress]",
    "data-[kind=export-progress]",
    "[&_[data-sot-part=system-banner-icon]]",
    "[&_[data-sot-part=system-banner-body]]",
    "[&_[data-sot-part=system-banner-actions]]",
];

const SYSTEM_BANNER_BUTTON_PRIMITIVE_RETIRED_TOKENS = [
    "systemBannerAction",
    "systemBannerPrimaryAction",
    "systemBannerDismissAction",
    "systemBannerAction:",
    "systemBannerDismissAction:",
];

const SYSTEM_BANNER_PROGRESS_PRIMITIVE_RETIRED_TOKENS = [
    "type ProgressVariant",
    "progressRootClassNames",
    "progressIndicatorClassNames",
    "systemBanner",
    '"system-banner-progress"',
    '"system-banner-progress-bar"',
    "sbn-sweep",
];

const SYSTEM_BANNER_FEATURE_LOCAL_TOKENS = [
    '} from "lucide-react";',
    "const systemBannerAlertVariantByState",
    "const systemBannerAlertClassNames",
    "const systemBannerProgressClassNames",
    "function SystemBannerAlert",
    "function SystemBannerButton",
    "function SystemBannerProgress",
    'density="comfortable"',
    'layout="inline"',
    "systemBannerProgressClassNames.indeterminateIndicator",
    'data-sot-panel="system-banner"',
    'data-sot-part="system-banner-progress"',
    '"data-sot-part": "system-banner-progress-bar"',
    "animate-[sbn-sweep_1.4s_linear_infinite]",
];

const SYSTEM_BANNER_FEATURE_LOCAL_VISUAL_REBUILD_TOKENS = [
    "const systemBannerAlertStateClassNames",
    "const systemBannerIconStateClassNames",
    "systemBannerAlertClassNames.root",
    "systemBannerAlertStateClassNames[banner.state]",
    "systemBannerIconStateClassNames[banner.state]",
    'offline: "border-border bg-secondary text-secondary-foreground"',
    '"update-available": "border-primary/30 bg-primary/10"',
    '"permission-denied": "bg-destructive/10 text-destructive"',
    "bg-primary/10 data-[sot-state=indeterminate]:bg-primary/10",
    "bg-primary transition-transform",
    "[&_svg]:size",
    "[&_svg]:stroke",
    "stroke-linecap",
    "stroke-linejoin",
    "dark:",
] as const;

const MORE_ACTIONS_MENU_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:more-anchor|more-head|more-action(?:-[\w-]+)?|more-menu(?:-(?:item(?:-shortcut)?|sep|label|hint))?)(?![\w-])/;

const MORE_ACTIONS_MENU_RETIRED_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-menu="recording-more-actions"]',
    '[data-sot-menu="recording-more-actions"][data-open="true"]',
    '[data-sot-menu="recording-more-actions"][data-state="open"]',
    '[data-sot-menu="recording-more-actions"] svg',
    "[data-sot-menu-item]",
    "[data-sot-menu-item]:hover",
    "[data-sot-menu-item]:focus-visible",
    "[data-sot-menu-item]:active",
    "[data-sot-menu-item] svg",
    '[data-sot-menu-item][data-sot-tone="danger"]',
    '[data-sot-menu-item][data-sot-tone="success"]',
    "[data-sot-menu-item] [data-sot-menu-hint]",
    "[data-sot-menu-separator]",
    "[data-sot-menu-label]",
];

const MORE_ACTIONS_MENU_PRIMITIVE_FORBIDDEN_PATTERNS = [
    /\b(?:text|bg|border|shadow)-\[var\([^\]]+\)\]/,
    /\[&_svg\]:\[(?:height|width):[^\]]+\]/,
    /\[&_svg\]:stroke-\[/,
    /\[stroke-line(?:cap|join):/,
    /<(?:CheckIcon|ChevronRightIcon|CircleIcon)\b(?=[^>]*\bclassName=["'][^"']*(?:size-|[wh]-|stroke-|\[(?:height|width|stroke)))/,
] as const;

const MORE_ACTIONS_MENU_COMPOSITION_TOKENS = [
    'variant="glass"',
    'density="compact"',
    'variant="destructive"',
    "<DropdownMenuShortcut",
    'variant="hint"',
];

const SOT_SCROLLBAR_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:tx-body|shortcuts-list)(?![\w-])/;

const SOT_SCROLLBAR_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-list="dashboard-recording-list-scroll"]',
    '[data-sot-part="dashboard-transcript-body"]',
    '[data-sot-list="dashboard-recording-list-scroll"]::-webkit-scrollbar',
    '[data-sot-part="dashboard-transcript-body"]::-webkit-scrollbar',
    '[data-sot-list="dashboard-recording-list-scroll"]::-webkit-scrollbar-thumb:hover',
];

const TAB_PANE_HIDDEN_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /(^|\n|,)\s*\.t-pane\[hidden\]/;

const TAB_PANE_HIDDEN_MIGRATED_GLOBAL_SELECTORS = [
    "[data-sot-tab-pane][hidden]",
] as const;

const DASHBOARD_TIME_FILTER_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:filter-row|chip|chip-f|chip-c)(?![\w-])/;

const DASHBOARD_TIME_FILTER_MIGRATED_GLOBAL_SELECTORS = [
    '[data-sot-panel="dashboard-recording-time-filter"][hidden]',
] as const;

const DASHBOARD_TIME_FILTER_RETIRED_GLOBAL_SELECTORS = [
    "--dashboard-recording-time-filter-count-bg",
    "--dashboard-recording-time-filter-count-selected-bg",
    '[data-sot-part="dashboard-recording-time-filter-count"]',
    '[data-sot-control="dashboard-recording-time-filter"][data-sot-state="selected"]',
    '[data-sot-control="dashboard-recording-time-filter"].is-hover-demo',
    '[data-sot-control="dashboard-recording-time-filter"].is-focus-demo',
] as const;

const DASHBOARD_TIME_FILTER_PRIMITIVE_REPAINT_CSS_SELECTORS = [
    '[data-sot-panel="dashboard-recording-time-filter"][data-slot="toggle-group"]',
    '[data-sot-control="dashboard-recording-time-filter"][data-slot="toggle-group-item"]',
    '[data-sot-control="dashboard-recording-time-filter"][data-slot="toggle-group-item"]:hover',
    '[data-sot-control="dashboard-recording-time-filter"][data-slot="toggle-group-item"][data-sot-state="selected"]',
    '[data-sot-control="dashboard-recording-time-filter"]:focus-visible',
    '[data-sot-control="dashboard-recording-time-filter"][disabled]',
] as const;

const COPY_ICON_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:copy-ico|copy-ico-default|copy-ico-ok)(?![\w-])/;

const COPY_ICON_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-part="dashboard-copy-icon"]',
    '[data-sot-control="copy-local-transcript"][hidden]',
    '[data-sot-control="copy-source-transcript"][hidden]',
    '[data-sot-control="copy-source-report"][hidden]',
];

const COPY_BUTTON_GLOBAL_APPEARANCE_PROPERTIES = [
    "background",
    "border-color",
    "color",
    "cursor",
    "opacity",
];

const DASHBOARD_TRANSCRIPT_ACTIONS_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.lang-pill(?![\w-])/;

const DASHBOARD_TRANSCRIPT_ACTIONS_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-part="dashboard-transcript-actions"]',
    '[data-sot-part="dashboard-copy-label"]',
    '[data-sot-part="dashboard-copy-icon"]',
];

const DASHBOARD_TRANSCRIPT_ACTIONS_DATA_SOT_HOOKS = [
    'data-sot-part="dashboard-transcript-actions"',
    'data-sot-part="dashboard-transcript-language"',
    'part="dashboard-copy-label"',
    'part="dashboard-copy-icon"',
];

const DETAIL_EMPTY_LEGACY_PRODUCT_CSS_SELECTOR_RE =
    /\.(?:detail-empty(?:-(?:ico|title|sub))?)(?![\w-])/;

const DETAIL_EMPTY_DATA_SOT_CSS_SELECTORS = [
    "[data-detail-empty]",
    '[data-sot-panel="dashboard-detail"][data-empty="true"] [data-detail-empty]',
];

const DASHBOARD_EMPTY_PRIMITIVE_CSS_SELECTORS = [
    '[data-sot-panel="dashboard-detail-empty"]',
    '[data-sot-part="dashboard-detail-empty-icon"]',
    '[data-sot-part="dashboard-detail-empty-icon"] svg',
    '[data-sot-part="dashboard-detail-empty-title"]',
    '[data-sot-part="dashboard-detail-empty-description"]',
    '[data-sot-part="dashboard-activity-empty"]',
    '[data-sot-part="dashboard-activity-empty-icon"]',
    '[data-sot-part="dashboard-activity-empty-icon"] svg',
    '[data-sot-part="dashboard-activity-empty-title"]',
    '[data-sot-part="dashboard-activity-empty-body"]',
];

const DASHBOARD_TRANSCRIPT_EMPTY_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-panel="dashboard-transcript-empty"]',
    '[data-sot-panel="dashboard-transcript-empty"] > :first-child',
    '[data-sot-part="dashboard-transcript-empty-icon"]',
    '[data-sot-part="dashboard-transcript-empty-icon"] svg',
    '[data-sot-part="dashboard-transcript-empty-message"]',
    '[data-sot-part="dashboard-transcript-empty-sub"]',
];

function splitVarArguments(content: string) {
    let depth = 0;
    for (let index = 0; index < content.length; index += 1) {
        const character = content[index];
        if (character === "(") depth += 1;
        if (character === ")") depth -= 1;
        if (character === "," && depth === 0) {
            return [
                content.slice(0, index).trim(),
                content.slice(index + 1).trim(),
            ];
        }
    }
    return [content.trim()];
}

function collectVarFallbackArguments(line: string) {
    const fallbacks: string[] = [];
    let searchFrom = 0;

    while (searchFrom < line.length) {
        const varIndex = line.indexOf("var(", searchFrom);
        if (varIndex < 0) break;

        let depth = 1;
        let cursor = varIndex + "var(".length;
        for (; cursor < line.length; cursor += 1) {
            const character = line[cursor];
            if (character === "(") depth += 1;
            if (character === ")") {
                depth -= 1;
                if (depth === 0) break;
            }
        }

        if (depth !== 0) break;

        const [, fallback] = splitVarArguments(
            line.slice(varIndex + "var(".length, cursor),
        );
        if (fallback) fallbacks.push(fallback);
        searchFrom = cursor + 1;
    }

    return fallbacks;
}

function isSafeColorFallbackArgument(argument: string) {
    return /^(#[\da-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|transparent|white|black)$/i.test(
        argument.trim(),
    );
}

function collectGlobalColorFallbackFindings(source: string) {
    const lines = source.split("\n");
    const rootRange = extractCssBlockRange(source, ":root");
    const darkRange = extractCssBlockRange(
        source,
        '.dark,\n[data-theme="dark"]',
    );
    const fallbackOnlyRange = extractCssBlockRange(
        source,
        "@supports not (color: oklch(",
    );
    const tokenModernColorDeclarations: ColorDeclarationFinding[] = [];
    const fallbackOnlyModernColorDeclarations: ColorDeclarationFinding[] = [];
    const nonTokenSupportedPathDeclarations: ColorDeclarationFinding[] = [];
    const unexpectedSupportedPathDeclarations: ColorDeclarationFinding[] = [];
    const unsafeVarFallbackArguments: Array<
        ColorDeclarationFinding & { fallback: string }
    > = [];

    for (const [index, line] of lines.entries()) {
        if (!MODERN_COLOR_RE.test(line)) continue;

        const lineNumber = index + 1;
        if (/^\s*@supports\s+not\s+\(color:\s*oklch\(/.test(line)) {
            continue;
        }

        const property = cssLineProperty(lines, index);
        const finding = { line: lineNumber, property, text: line.trim() };
        const isTokenDeclaration =
            property?.startsWith("--") &&
            (isLineInside(lineNumber, rootRange) ||
                isLineInside(lineNumber, darkRange));

        if (isTokenDeclaration) {
            tokenModernColorDeclarations.push(finding);
        } else if (isLineInside(lineNumber, fallbackOnlyRange)) {
            fallbackOnlyModernColorDeclarations.push(finding);
        } else {
            nonTokenSupportedPathDeclarations.push(finding);
            if (
                !property ||
                !CSS_SUPPORTED_PATH_COLOR_PROPERTIES.has(property)
            ) {
                unexpectedSupportedPathDeclarations.push(finding);
            }
        }

        for (const fallback of collectVarFallbackArguments(line)) {
            if (
                MODERN_COLOR_RE.test(fallback) ||
                !isSafeColorFallbackArgument(fallback)
            ) {
                unsafeVarFallbackArguments.push({ ...finding, fallback });
            }
        }
    }

    return {
        tokenModernColorDeclarations,
        fallbackOnlyModernColorDeclarations,
        nonTokenSupportedPathDeclarations,
        unexpectedSupportedPathDeclarations,
        unsafeVarFallbackArguments,
    };
}

function listSourceFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...listSourceFiles(fullPath));
        } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
            files.push(fullPath);
        }
    }
    return files;
}

function isOwnerLocalModernColorLine(relativePath: string, line: string) {
    if (relativePath === "features/settings/components/settings-content.tsx") {
        return (
            line.includes("source-provider") || line.includes("data-[sot-tone=")
        );
    }

    if (
        relativePath ===
        "features/recordings/components/ai-rename-preview-card.tsx"
    ) {
        return (
            line.includes("var(--bg-elevated)") ||
            line.includes("var(--accent)") ||
            line.includes("var(--signal-warning)") ||
            line.includes("var(--fg-tertiary)")
        );
    }

    if (
        relativePath ===
        "features/settings/components/sections/speaker-profiles-panel.tsx"
    ) {
        return line.includes("data-[sot-tone=");
    }

    if (relativePath === "features/dashboard/workstation.tsx") {
        return (
            line.includes("source-provider") ||
            line.includes("--dashboard-retx-") ||
            line.includes("--dashboard-recording-status-") ||
            line.includes("--dashboard-recording-tag-") ||
            line.includes("--dashboard-recording-row-selected-border") ||
            line.includes("sbn-sweep") ||
            line.includes("data-sot-part=dashboard-activity") ||
            line.includes("scrollbar-color") ||
            line.includes("::-webkit-scrollbar")
        );
    }

    if (
        relativePath ===
        "features/recordings/components/recording-tag-manager.tsx"
    ) {
        return false;
    }

    if (
        relativePath === "features/source-report/styles.ts" ||
        relativePath === "features/source-report/primitives.tsx"
    ) {
        return true;
    }

    return false;
}

function collectInlineModernColorFindings() {
    const tagVisualsPath =
        "features/recordings/components/recording-tag-visuals.tsx";
    const catalogSwatches: string[] = [];
    const unexpectedModernColorLines: Array<{
        file: string;
        line: number;
        text: string;
    }> = [];
    const unexpectedTagSwatchCalls: Array<{ line: number; text: string }> = [];

    for (const filePath of listSourceFiles(ROOT)) {
        const relativePath = path
            .relative(ROOT, filePath)
            .split(path.sep)
            .join("/");
        if (relativePath.startsWith("tests/")) continue;

        const lines = readFileSync(filePath, "utf8").split("\n");
        for (const [index, line] of lines.entries()) {
            if (!MODERN_COLOR_RE.test(line)) continue;

            if (isOwnerLocalModernColorLine(relativePath, line)) {
                continue;
            }

            const catalogMatch = line.match(
                /^\s*(red|orange|green|blue|purple|slate): tagSwatchStyle\("oklch\([^)]+\)"\),$/,
            );
            if (relativePath === tagVisualsPath && catalogMatch) {
                catalogSwatches.push(catalogMatch[1]);
            } else {
                unexpectedModernColorLines.push({
                    file: `src/${relativePath}`,
                    line: index + 1,
                    text: line.trim(),
                });
            }
        }
    }

    const tagVisualLines = readSource(tagVisualsPath).split("\n");
    for (const [index, line] of tagVisualLines.entries()) {
        if (!line.includes("tagSwatchStyle(")) continue;
        if (/^\s*function tagSwatchStyle\(/.test(line)) continue;
        const semanticTokenCall = line.match(
            /^\s*(red|orange|green|blue|purple|slate): tagSwatchStyle\("(red|orange|green|blue|purple|slate)"\),$/,
        );
        if (semanticTokenCall?.[1] === semanticTokenCall?.[2]) continue;
        if (
            !/^\s*(red|orange|green|blue|purple|slate): tagSwatchStyle\("oklch\([^)]+\)"\),$/.test(
                line,
            )
        ) {
            unexpectedTagSwatchCalls.push({
                line: index + 1,
                text: line.trim(),
            });
        }
    }

    return {
        catalogSwatches,
        unexpectedModernColorLines,
        unexpectedTagSwatchCalls,
    };
}

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|<SourceFilterStackStrip[\s/>]|\.\/components\/source-filter-stack-strip/;

const SOURCE_REPORT_LEGACY_SURFACE_RE =
    /uikit-|glass-surface|glass-control|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE =
    /className=["']btn(?:\s+(?:ghost|primary|glass))?\b|track-fill|track-thumb|sk _is|_is-/;

const DASHBOARD_DETAIL_PANE_SOT_HOOKS = [
    'data-sot-panel="dashboard-transcript-pane"',
    'data-sot-tab-pane="transcript"',
    'surface="dashboard"',
    'data-sot-tab-pane="speakers"',
    'data-sot-part="dashboard-transcript-actions"',
    'part="dashboard-copy-label"',
    'data-sot-part="dashboard-transcript-avatar"',
    'data-sot-list="dashboard-speaker-rows"',
    'data-sot-item="dashboard-speaker-row"',
    'data-sot-part="dashboard-speaker-avatar"',
    'data-sot-part="dashboard-speaker-row-meta"',
    'data-sot-part="dashboard-speaker-name"',
    'data-sot-part="dashboard-speaker-sub"',
    'data-sot-part="dashboard-speaker-bar"',
    '"dashboard-speaker-bar-fill"',
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

const DASHBOARD_SOURCE_REPORT_LOADED_SOT_HOOKS = [
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

const SOURCE_REPORT_SKELETON_LEGACY_CSS_SELECTOR_RE =
    /\.(?:sr-seg-time-skeleton|sr-seg-speaker-skeleton|sr-seg-line-skeleton|sr-seg-line-skeleton-long|sr-seg-line-skeleton-medium|sr-seg-line-skeleton-wide|sr-seg-line-skeleton-short)(?![\w-])/;

const SOURCE_REPORT_SKELETON_PRIMITIVE_SELECTORS = [
    '[data-sot-part="source-report-card-skeleton"]',
    '[data-sot-part="source-report-card-skeleton"][data-sot-size="source"]',
    '[data-sot-part="source-report-card-skeleton"][data-sot-size="status"]',
    '[data-sot-part="source-report-card-skeleton"][data-sot-size="count"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="time"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="speaker"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size^="line-"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="line-long"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="line-medium"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="line-wide"]',
    '[data-sot-part="source-report-segment-skeleton"][data-sot-size="line-short"]',
];

const SOURCE_REPORT_SKELETON_GLOBAL_CSS_SELECTOR_FRAGMENTS = [
    '[data-sot-part="source-report-card-skeleton"]',
    '[data-sot-part="source-report-segment-skeleton"]',
    '[data-sot-part="source-report-card-value"][data-sot-value="skeleton"]',
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
    "gap-1.5 overflow-visible rounded-lg shadow-none backdrop-blur-none";
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
const SOURCE_REPORT_GEOMETRY_FORBIDDEN_SNIPPETS = [
    "my-[15px]",
    "min-h-[30px]",
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

const RECORDING_SOURCE_REPORT_LOADING_METRIC_CARDS = [
    {
        metric: "source",
        value: "skeleton",
        snippets: ['<SourceReportCardSkeleton size="source" />'],
    },
    {
        metric: "transcript-status",
        value: "skeleton",
        snippets: ['<SourceReportCardSkeleton size="status" />'],
    },
    {
        metric: "summary-status",
        value: "skeleton",
        snippets: ['<SourceReportCardSkeleton size="status" />'],
    },
    {
        metric: "segment-count",
        value: "skeleton",
        snippets: ['<SourceReportCardSkeleton size="count" />'],
    },
] as const;

const RECORDING_SOURCE_REPORT_LOADED_METRIC_CARDS = [
    {
        metric: "source",
        value: "source",
        snippets: ["sourceProviderLabel"],
    },
    {
        metric: "transcript-status",
        snippets: ["<SourceReportStatusBadge", "sourceTranscriptStatusLabel"],
    },
    {
        metric: "summary-status",
        snippets: ["<SourceReportStatusBadge", "sourceSummaryStatusLabel"],
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

const SOURCE_REPORT_EMPTY_LEGACY_CSS_SELECTOR_RE =
    /\.(?:sr-empty(?:-(?:ico|title|sub|actions))?)(?![\w-])/;

const SOURCE_REPORT_EMPTY_DATA_SOT_CSS_SELECTORS = [
    "[data-sot-source-report-empty-actions]",
    "[data-sot-source-report-empty]",
    '[data-sot-source-report-empty][data-sot-tone="err"]',
    "[data-sot-source-report-empty-icon]",
    '[data-sot-source-report-empty][data-sot-tone="err"]\n    [data-sot-source-report-empty-icon]',
    "[data-sot-source-report-empty-icon] svg",
    "[data-sot-source-report-empty-title]",
    "[data-sot-source-report-empty-description]",
];

const SOURCE_REPORT_METRIC_LEGACY_CSS_SELECTOR_RE =
    /\.(?:sr-card|sr-card-label|sr-card-value|sr-card-source|sr-card-source-fallback|sr-card-num|sr-pill)(?![\w-])/;

const SOURCE_REPORT_METRIC_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-list="source-report-cards"]',
    '[data-sot-part="source-report-card-label"]',
    '[data-sot-part="source-report-card-value"]',
    '[data-sot-part="source-report-card-value"][data-sot-value="source"]',
    '[data-sot-part="source-report-card-source-fallback"]',
    '[data-sot-part="source-report-card-value"][data-sot-value="number"]',
];

const SOURCE_REPORT_METRIC_GENERIC_CARD_SELECTORS = [
    "[data-sot-card]",
    "[data-sot-card] + [data-sot-card]",
];

const SOURCE_REPORT_METRIC_REMOVED_CARD_SELECTORS = [
    '[data-sot-card="source-report-metric"]',
    '[data-sot-card="source-report-metric"][data-sot-metric]',
    '[data-theme="dark"] [data-sot-card="source-report-metric"][data-sot-metric]',
];

const SOURCE_REPORT_METRIC_GLOBAL_REPAINT_SELECTOR_FRAGMENTS = [
    '[data-sot-badge="source-report-status"]',
];

const SOURCE_REPORT_METRIC_REMOVED_PRIMITIVE_SELECTORS = [
    '[data-sot-badge="source-report-status"][data-sot-tone]',
    '[data-sot-badge="source-report-status"][data-sot-tone="ok"]',
    '[data-sot-badge="source-report-status"][data-sot-tone="warn"]',
    '[data-sot-badge="source-report-status"][data-sot-tone="err"]',
];

const SOURCE_REPORT_SECTION_LEGACY_CSS_SELECTOR_RE =
    /\.(?:sr-pane|list-empty|sr-state|sr-cards|sr-section(?:-(?:head|sub))?|sr-summary-body|sr-segments|sr-seg(?:-(?:ts|speaker|text))?|sr-meta(?:-row)?|sr-actions)(?![\w-])/;

const SOURCE_REPORT_SECTION_DATA_SOT_CSS_SELECTORS = [
    "[data-sot-source-report-pane]",
    "[data-sot-source-report-state]",
    "[data-sot-source-report-state][hidden]",
    "[data-sot-source-report-section]",
    "[data-sot-source-report-section-header]",
    "[data-sot-source-report-section-title]",
    "[data-sot-source-report-description]",
    "[data-sot-source-report-summary-body]",
    "[data-sot-source-report-segments]",
    "[data-sot-source-report-segment]",
    "[data-sot-source-report-segment-time]",
    "[data-sot-source-report-segment-speaker]",
    "[data-sot-source-report-segment-text]",
    "[data-sot-source-report-meta]",
    "[data-sot-source-report-meta-row]",
    "[data-sot-source-report-actions]",
    "[data-sot-source-report-missing-notice]",
];

const SOURCE_REPORT_CARD_PRIMITIVE_SELECTORS = [
    '[data-sot-source-report-pane][data-slot="card"]',
    '[data-sot-source-report-header][data-slot="card-header"]',
    '[data-sot-source-report-title][data-slot="card-title"]',
    '[data-sot-source-report-header-actions][data-slot="card-action"]',
];

const SOURCE_REPORT_CARD_PRIMITIVE_REPAINT_DECLARATION_RE =
    /\b(?:background|border(?:-color|-radius)?|box-shadow|color|fill|font|letter-spacing|margin|padding|stroke)\s*:/;

const RECORDING_PLAYER_CARD_PRIMITIVE_SELECTORS = [
    '[data-sot-surface="recording-player"][data-slot="card"]',
    '[data-sot-part="recording-player-meta"][data-slot="card-header"]',
    '[data-sot-panel="recording-player-controls"][data-slot="card-content"]',
];

const PLAYER_ALERT_CARD_BADGE_PRIMITIVE_REPAINT_SELECTORS = [
    '[data-sot-part="dashboard-recording-player-no-audio"][data-slot="alert"]',
    '[data-sot-part="dashboard-recording-player-no-audio-title"][data-slot="alert-title"]',
    '[data-sot-part="dashboard-recording-player-no-audio-description"][data-slot="alert-description"]',
    '[data-sot-part="recording-player-no-audio"][data-slot="alert"]',
    '[data-sot-part="recording-player-no-audio-title"][data-slot="alert-title"]',
    '[data-sot-part="recording-player-no-audio-description"][data-slot="alert-description"]',
    '[data-sot-panel="dashboard-player-volume-popover"][data-slot="popover-content"]',
    '[data-sot-panel="recording-player-volume-popover"][data-slot="popover-content"]',
    '[data-sot-control="player-source-tag"][data-slot="badge"]',
] as const;

const PLAYER_PORTAL_VOLUME_SCOPED_SELECTORS = [
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
] as const;

const PLAYER_SLIDER_CONTROL_HOOKS = [
    "dashboard-player-seek",
    "dashboard-player-volume-slider",
    "recording-player-seek",
    "recording-player-volume-slider",
] as const;

const PLAYER_SLIDER_PRIMITIVE_SLOTS = [
    "slider",
    "slider-track",
    "slider-range",
    "slider-thumb",
] as const;

const RECORDING_PLAYER_BUTTON_CONTROL_HOOKS = [
    "recording-player-back",
    "recording-player-forward",
    "recording-player-play",
    "recording-player-speed",
    "recording-player-volume",
    "recording-player-volume-mute",
] as const;

const RECORDING_PLAYER_BUTTON_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-[\w-]+)?|border(?:-[\w-]+)?|box-shadow|color|font(?:-[\w-]+)?|padding(?:-[\w-]+)?)\s*:|\b(?:linear-gradient|oklch)\(/m;

const SOURCE_AUTH_MODE_LEGACY_CSS_SELECTOR_RE =
    /\.(?:path-picker|path-card|pc-t|pc-h|pc-badge)(?![\w-])/;

const SOURCE_AUTH_MODE_DATA_SOT_ORIGIN_HOOKS = [
    'data-sot-list="source-auth-modes"',
    'data-sot-control="source-auth-mode"',
    "data-sot-auth-mode={mode}",
    "data-sot-state={",
    'data-sot-part="source-auth-mode-title"',
    'data-sot-part="source-auth-mode-description"',
    'data-sot-badge="source-auth-mode"',
    "data-sot-tone={",
    'tone: "recommended"',
    'tone: "personal"',
    "value={selectedSource.authMode}",
    "authMode: mode",
    "{modeBadge.label}",
] as const;

const SOURCE_AUTH_MODE_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-list="source-auth-modes"]',
    '[data-sot-control="source-auth-mode"][data-sot-auth-mode]',
    '[data-theme="dark"] [data-sot-control="source-auth-mode"][data-sot-auth-mode]',
    '[data-sot-control="source-auth-mode"][data-sot-state="selected"]',
    '[data-sot-part="source-auth-mode-title"]',
    '[data-sot-part="source-auth-mode-description"]',
] as const;

const PROVIDER_DETAIL_ACTION_GLOBAL_SELECTOR_FRAGMENTS = [
    '[data-sot-panel="source-actions"]',
    '[data-sot-part="source-action-status"]',
    '[data-sot-control="source-test"]',
    '[data-sot-control="source-save"]',
] as const;

const PROVIDER_DETAIL_ACTION_GLOBAL_DECLARATION_RE =
    /^\s*(?:display|align-items|justify-content|gap|margin(?:-[\w-]+)?|flex(?:-[\w-]+)?|pointer-events|position|z-index|inset|padding(?:-[\w-]+)?|width|height)\s*:/m;

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

const DASHBOARD_RETRANSCRIPTION_GLOBAL_REPAINT_DECLARATION_RE =
    /^\s*(?:align-items|justify-content|gap|padding(?:-[\w-]+)?|border(?:-(?:bottom|color|radius|style|width))?|background(?:-clip)?|box-shadow|color|font(?:-[\w-]+)?|width|height|border-radius|flex(?:-(?:basis|direction|grow|shrink|wrap))?|min-width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

const DASHBOARD_TRANSCRIPT_SOURCE_REPORT_RETX_ACTIVITY_LEGACY_CSS_SELECTOR_RE =
    /(^|[^\w-])\.(?:activity-pixel-stage|notif-panel|notif-empty|turn|transcript|transcript-head|transcript-body|speaker|speaker-name|sr-pane|list-empty|empty-state|empty-ico|empty-msg|empty-sub|retx-banner|retx-banner-ico|retx-spinner|retx-disabled-hint|retx-refresh-marker|retx-banner-body|retx-banner-title|retx-banner-sub|retx-banner-actions|retx-ico-warn|retx-ico-ok|t-actions)(?![\w-])/;

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

const DASHBOARD_TRANSCRIPT_SPEAKER_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-item="dashboard-transcript-turn"]',
    '[data-theme="dark"] [data-sot-item="dashboard-transcript-turn"]',
    '[data-sot-item="dashboard-transcript-turn"]:last-child',
    '[data-sot-part="dashboard-transcript-speaker-row"]',
    '[data-sot-part="dashboard-transcript-avatar"]',
    '[data-sot-part="dashboard-transcript-avatar"][data-sot-tone="steel"]',
    '[data-sot-part="dashboard-transcript-avatar"][data-sot-tone="info"]',
    '[data-sot-part="dashboard-transcript-avatar"][data-sot-tone="success"]',
    '[data-sot-part="dashboard-transcript-speaker-name"]',
    '[data-sot-part="dashboard-transcript-speaker-time"][data-sot-format="mono"]',
    '[data-sot-item="dashboard-transcript-turn"] p',
    '[data-sot-part="dashboard-speakers-head"]',
    '[data-sot-part="dashboard-speakers-head-title"]',
    '[data-sot-list="dashboard-speaker-rows"]',
    '[data-sot-item="dashboard-speaker-row"]',
    '[data-sot-item="dashboard-speaker-row"]:hover',
    '[data-theme="dark"] [data-sot-item="dashboard-speaker-row"]:hover',
    '[data-sot-part="dashboard-speaker-avatar"]',
    '[data-sot-part="dashboard-speaker-row-meta"]',
    '[data-sot-part="dashboard-speaker-name"]',
    '[data-sot-part="dashboard-speaker-sub"]',
    '[data-sot-part="dashboard-speaker-bar"]',
    '[data-sot-part="dashboard-speaker-bar-fill"]',
] as const;

const RECORDING_LOADING_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-panel="recording-route-loading-detail"]',
    '[data-sot-panel="recording-list-loading"]',
    '[data-sot-panel="recording-detail-loading"]',
] as const;
const DASHBOARD_LOADING_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-shell="dashboard-loading"]',
    '[data-sot-panel="dashboard-loading-list"]',
    '[data-sot-panel="dashboard-loading-detail"]',
] as const;
const RECORDING_ROUTE_FALLBACK_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-shell="recording-route-loading"]',
    '[data-sot-shell="recording-route-empty"]',
    '[data-sot-shell="recording-route-error"]',
    '[data-sot-panel="recording-route-empty-detail"]',
    '[data-sot-panel="recording-route-empty"]',
    '[data-sot-part="recording-route-empty-icon"]',
    '[data-sot-part="recording-route-empty-title"]',
    '[data-sot-part="recording-route-empty-description"]',
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
const ROUTE_CHROME_FORBIDDEN_FRAMEWORK_RE =
    /var\(--glass|var\(--graphite|color-mix\(|backdrop-filter/;
const GLOBALS_FRAMEWORK_MARKETING_RE =
    /Graphite Glass|SOT web kit|Liquid Glass|Apple-graphite|radial-gradient/;

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

const DASHBOARD_TRANSCRIPT_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|line-height|padding|transition|width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

const RECORDING_TRANSCRIPTION_PRIMITIVE_SELECTORS = [
    '[data-sot-panel="recording-transcription"][data-slot="card"]',
    '[data-sot-part="recording-transcription-header"][data-slot="card-header"]',
    '[data-sot-part="recording-transcription-title"][data-slot="card-title"]',
    '[data-sot-part="recording-transcription-description"][data-slot="card-description"]',
    '[data-sot-part="recording-transcription-unavailable"][data-slot="field-description"]',
    '[data-sot-part="recording-transcription-body"][data-slot="card-content"]',
    '[data-sot-banner="transcription-job"][data-slot="alert"]',
    '[data-sot-banner-title][data-slot="alert-title"]',
    '[data-sot-meta="language"][data-slot="badge"]',
    '[data-sot-meta="source"][data-slot="badge"]',
    '[data-sot-meta="words"][data-slot="badge"]',
    '[data-sot-meta="characters"][data-slot="badge"]',
    '[data-sot-part="recording-transcription-empty"][data-slot="empty"]',
    '[data-sot-part="recording-transcription-empty-title"][data-slot="empty-title"]',
    '[data-sot-part="recording-transcription-empty-description"][data-slot="empty-description"]',
    '[data-sot-control="copy-local-transcript"][data-slot="button"]',
    '[data-sot-control="retranscribe-local"][data-slot="button"]',
    '[data-sot-control="start-local-transcription"][data-slot="button"]',
] as const;

const RECORDING_TRANSCRIPTION_EMPTY_REPAINT_SELECTORS = [
    '[data-sot-part="recording-transcription-empty"]',
    '[data-sot-part="recording-transcription-empty-icon"]',
    '[data-sot-part="recording-transcription-empty-title"]',
    '[data-sot-part="recording-transcription-empty-description"]',
] as const;

const RECORDING_TRANSCRIPTION_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|line-height|padding|transition|width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;

const RECORDING_DETAIL_CARD_PRIMITIVE_SELECTORS = [
    '[data-sot-panel="recording-detail-list"][data-slot="card"]',
    '[data-sot-panel="recording-detail-metadata"][data-slot="card"]',
    '[data-sot-panel="recording-source-record"][data-slot="card"]',
    '[data-sot-panel="recording-transcription-skeleton"][data-slot="card"]',
    '[data-sot-panel="recording-transcription-speaker-review-skeleton"][data-slot="card"]',
    '[data-sot-part="recording-detail-list-header"][data-slot="card-header"]',
    '[data-sot-part="recording-detail-metadata-header"]',
    '[data-sot-part="recording-source-record-header"]',
    '[data-sot-part="recording-transcription-skeleton-header"][data-slot="card-header"]',
    '[data-sot-part="recording-detail-list-title"][data-slot="card-title"]',
    '[data-sot-part="recording-detail-metadata-title"][data-slot="card-title"]',
    '[data-sot-part="recording-source-record-title"][data-slot="card-title"]',
    '[data-sot-part="recording-detail-list-content"][data-slot="card-content"]',
    '[data-sot-part="recording-detail-metadata-body"]',
    '[data-sot-part="recording-source-record-body"]',
    '[data-sot-part="recording-transcription-skeleton-body"][data-slot="card-content"]',
    '[data-sot-list="recording-transcription-speaker-cards"][data-slot="card-content"]',
] as const;

const RECORDING_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|line-height|padding|transition|width)\s*:|\b(?:color-mix|linear-gradient|oklch)\(/m;
const RECORDING_DETAIL_CARD_OWNER_FORBIDDEN_CLASS_PATTERN =
    /(?:^|\s)!\S+|\bdark:|\b(?:text|bg|border|shadow|ring|fill|stroke)-\[var\(|\[(?:font|font-size|line-height|letter-spacing):[^\]]+\]|(?:^|\s)(?:text-(?:xs|sm|base|lg|xl|[2-9]xl)|font-(?:sans|serif|mono|thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|leading-(?:none|tight|snug|normal|relaxed|loose|\[[^\]]+\]|\d+(?:\.\d+)?)|tracking-(?:normal|tight|wide|wider|widest|\[[^\]]+\]))(?=$|\s)/;

const RECORDING_DETAIL_NAV_BACK_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-list="recording-detail-nav"]',
    '[data-sot-part="recording-detail-nav-label"]',
    '[data-sot-control="recording-detail-back"] svg',
    '[data-sot-control="recording-detail-back"] > span',
] as const;

const RECORDING_DETAIL_ROW_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-list="recording-detail-list-rows"]',
    '[data-sot-item="recording-detail-list-row"]',
    '[data-sot-item="recording-detail-list-row"]:hover',
    '[data-sot-item="recording-detail-list-row"][data-sot-state="selected"]',
    '[data-sot-part="recording-detail-list-row-body"]',
    '[data-sot-part="recording-detail-list-row-title"]',
    '[data-sot-part="recording-detail-list-row-meta"]',
    '[data-sot-part="recording-detail-list-row-duration"]',
] as const;

const RECORDING_WORKSTATION_NAV_OWNER_CLASS_INITIALIZERS = [
    {
        property: "list",
        expected: "flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3",
    },
    {
        property: "label",
        expected:
            "px-2.5 pb-1.5 pt-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
    },
] as const;
const RECORDING_WORKSTATION_TOPBAR_OWNER_CLASS_INITIALIZERS = [
    {
        property: "topbar",
        expected:
            "relative z-[var(--z-topbar)] flex h-14 flex-none flex-row items-center gap-3.5 border-b border-border bg-background/80 px-5 py-3 shadow-none supports-[backdrop-filter]:bg-background/60 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border",
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
        expected: "text-muted-foreground/60",
    },
    {
        property: "current",
        expected: "font-semibold text-foreground",
    },
] as const;
const DASHBOARD_TOPBAR_OWNER_CLASS_INITIALIZERS = [
    {
        property: "topbar",
        expected:
            "relative flex h-14 flex-none flex-row items-center gap-3.5 border-b border-border bg-background/80 px-5 py-3 supports-[backdrop-filter]:bg-background/60 max-[860px]:min-w-0 max-[860px]:max-w-full max-[860px]:box-border",
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

const RECORDING_SOURCE_RECORD_LAYOUT_REMOVED_GLOBAL_SELECTORS = [
    '[data-sot-part="recording-source-record-shell"]',
    '[data-sot-part="recording-source-record-actions"]',
    '[data-sot-part="recording-source-record-tabs"]',
    '[data-sot-part="recording-source-record-hint"]',
    '[data-sot-part="recording-source-record-pane"]',
] as const;
const RECORDING_DETAIL_LIST_OWNER_CLASS_INITIALIZERS = [
    {
        constName: "RECORDING_DETAIL_LIST_HEADER_CLASS_NAME",
        expected: "gap-0 border-b px-3 py-3",
        marker: 'data-sot-part="recording-detail-list-header"',
        tagName: "CardHeader",
    },
    {
        constName: "RECORDING_DETAIL_LIST_TITLE_CLASS_NAME",
        expected: "text-sm",
        marker: 'data-sot-part="recording-detail-list-title"',
        tagName: "CardTitle",
    },
    {
        constName: "RECORDING_DETAIL_LIST_CONTENT_CLASS_NAME",
        expected: "flex min-h-0 flex-col px-0",
        marker: 'data-sot-part="recording-detail-list-content"',
        tagName: "CardContent",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROWS_CLASS_NAME",
        expected: "flex flex-col gap-0.5 p-1",
        marker: 'data-sot-list="recording-detail-list-rows"',
        tagName: "div",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROW_CLASS_NAME",
        expected:
            "grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-border bg-secondary px-3 py-2 text-left transition-colors",
        marker: 'data-sot-item="recording-detail-list-row"',
        tagName: "div",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROW_BODY_CLASS_NAME",
        expected: "flex min-w-0 flex-col gap-1",
        marker: 'data-sot-part="recording-detail-list-row-body"',
        tagName: "div",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROW_TITLE_CLASS_NAME",
        expected: "truncate text-sm font-semibold text-foreground",
        marker: 'data-sot-part="recording-detail-list-row-title"',
        tagName: "div",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROW_META_CLASS_NAME",
        expected: "flex flex-wrap items-center gap-2",
        marker: 'data-sot-part="recording-detail-list-row-meta"',
        tagName: "div",
    },
    {
        constName: "RECORDING_DETAIL_LIST_ROW_DURATION_CLASS_NAME",
        expected: "font-mono text-xs font-medium text-muted-foreground",
        marker: 'data-sot-part="recording-detail-list-row-duration"',
        tagName: "span",
    },
] as const;
const RECORDING_DETAIL_METADATA_OWNER_CLASS_INITIALIZERS = [
    {
        constName: "RECORDING_DETAIL_METADATA_CARD_CLASS_NAME",
        expected: "min-h-0 gap-0",
        marker: 'data-sot-panel="recording-detail-metadata"',
        tagName: "Card",
    },
    {
        constName: "RECORDING_DETAIL_METADATA_HEADER_CLASS_NAME",
        expected: "flex items-center gap-3 border-b px-4 py-3",
        marker: 'data-sot-part="recording-detail-metadata-header"',
        tagName: "CardHeader",
    },
    {
        constName: "RECORDING_DETAIL_METADATA_TITLE_CLASS_NAME",
        expected: "min-w-0 flex-1 truncate",
        marker: 'data-sot-part="recording-detail-metadata-title"',
        tagName: "CardTitle",
    },
    {
        constName: "RECORDING_DETAIL_METADATA_BODY_CLASS_NAME",
        expected:
            "flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 pt-4 pb-6",
        marker: 'data-sot-part="recording-detail-metadata-body"',
        tagName: "CardContent",
    },
] as const;
const RECORDING_SOURCE_RECORD_OWNER_CLASS_INITIALIZERS = [
    {
        constName: "RECORDING_SOURCE_RECORD_SHELL_CLASS_NAME",
        expected: "flex min-h-0 flex-col gap-4",
        marker: 'data-sot-part="recording-source-record-shell"',
        tagName: "section",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_CARD_CLASS_NAME",
        expected: "min-h-0 gap-0",
        marker: 'data-sot-panel="recording-source-record"',
        tagName: "Card",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_HEADER_CLASS_NAME",
        expected: "flex items-center gap-3 border-b px-4 py-3",
        marker: 'data-sot-part="recording-source-record-header"',
        tagName: "CardHeader",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_TITLE_CLASS_NAME",
        expected: "min-w-0 flex-1 truncate",
        marker: 'data-sot-part="recording-source-record-title"',
        tagName: "CardTitle",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_ACTIONS_CLASS_NAME",
        expected:
            "ml-auto flex max-w-full grow-0 shrink basis-auto flex-wrap items-center gap-2",
        marker: 'data-sot-part="recording-source-record-actions"',
        tagName: "div",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_BODY_CLASS_NAME",
        expected:
            "flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 pt-4 pb-6",
        marker: 'data-sot-part="recording-source-record-body"',
        tagName: "CardContent",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_TABS_CLASS_NAME",
        expected: "flex min-w-0",
        marker: 'data-sot-part="recording-source-record-tabs"',
        tagName: "div",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_HINT_CLASS_NAME",
        expected: "m-0",
        marker: 'data-sot-part="recording-source-record-hint"',
        tagName: "FieldDescription",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_PANE_CLASS_NAME",
        expected: "min-h-0",
        marker: 'data-sot-part="recording-source-record-pane"',
        tagName: "div",
    },
    {
        constName: "RECORDING_SOURCE_RECORD_EMPTY_CLASS_NAME",
        expected: "min-h-[280px] flex-1",
        marker: 'data-sot-panel="recording-source-record-empty"',
        tagName: "Empty",
    },
] as const;

const AI_RENAME_PREVIEW_FUNCTIONAL_CSS_SELECTORS = [
    '[data-sot-panel="ai-rename-preview"]',
    '[data-sot-panel="ai-rename-preview"][data-open="true"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="state"][hidden]',
] as const;

const AI_RENAME_PREVIEW_VISUAL_REPAINT_CSS_SELECTORS = [
    '[data-sot-panel="ai-rename-preview"][data-slot="popover-content"]',
    '[data-theme="dark"] [data-sot-panel="ai-rename-preview"][data-slot="popover-content"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="head"]',
    '[data-theme="dark"] [data-sot-panel="ai-rename-preview"] [data-sot-part="head"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="head-copy"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="eyebrow"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="subtitle"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-control="ai-rename-close"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-control="ai-rename-close"] svg',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="body"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="message"]',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-part="state"][data-sot-state="error"]',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-part="state"][data-sot-state="error"]\n    [data-sot-part="state-description"]',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-part="state"][data-sot-state="error"]\n    [data-sot-part="message"]',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-part="state"][data-sot-state="unavailable"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="error-icon"]',
    '[data-sot-panel="ai-rename-preview"][data-sot-state="unavailable"]\n    [data-sot-part="error-icon"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="error-icon"] svg',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="label"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="title"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="hint"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="review-row"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="review-line"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="review-tag"]',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-part="review-tag"][data-sot-review-field="new"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="review-old"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="review-new"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="actions"]',
    '[data-theme="dark"] [data-sot-panel="ai-rename-preview"] [data-sot-part="actions"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-part="actions-spacer"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-control^="ai-rename-"]',
    '[data-sot-panel="ai-rename-preview"] [data-sot-control^="ai-rename-"] svg',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-control^="ai-rename-"]:disabled',
    '[data-sot-panel="ai-rename-preview"]\n    [data-sot-control^="ai-rename-"][aria-disabled="true"]',
] as const;

const AI_RENAME_PREVIEW_SHARED_PRIMITIVE_FILES = [
    "components/ui/alert.tsx",
    "components/ui/badge.tsx",
    "components/ui/button.tsx",
    "components/ui/card.tsx",
] as const;

const AI_RENAME_PREVIEW_BUSINESS_TOKENS = [
    "aiRenamePreview",
    "aiRenamePreviewClose",
    "aiRenamePreviewAction",
    "aiRenamePreviewPrimaryAction",
    "aiRenamePreviewOldTag",
    "aiRenamePreviewNewTag",
    "aiRenamePreviewError",
    "aiRenamePreviewUnavailable",
] as const;

const AI_RENAME_PREVIEW_FEATURE_OWNER_CLASS_SNIPPETS = [
    {
        label: "panel",
        snippets: [
            "w-[min(360px,calc(100vw-32px))]",
            "gap-0",
            "p-0",
            "data-[open=true]:pointer-events-auto",
            "[&_[data-sot-part=state][hidden]]:!hidden",
        ],
    },
    {
        label: "header",
        snippets: [
            "min-h-14",
            "grid-cols-[1fr_auto]",
            "border-b px-3.5 py-3",
            "[&_[data-slot=card-head-copy]]:min-w-0",
        ],
    },
    {
        label: "body",
        snippets: [
            "px-3.5 py-3",
            'loadingContent: "min-h-20"',
            "text-sm font-semibold leading-relaxed",
        ],
    },
    {
        label: "state",
        snippets: [
            "font-mono text-xs font-semibold leading-none",
            "m-0 break-words text-sm font-medium leading-relaxed",
            "m-0 max-w-full break-words text-xs font-medium leading-relaxed",
        ],
    },
    {
        label: "review",
        snippets: [
            "my-1.5 flex flex-col gap-1.5",
            "rounded-lg border bg-muted",
            "text-muted-foreground line-through",
            "text-foreground",
        ],
    },
    {
        label: "actions",
        snippets: [
            "min-h-12 gap-1.5 border-t px-3.5 py-2",
            'variant="default"',
        ],
    },
    {
        label: "alert",
        snippets: [
            'density="spacious"',
            'layout="centered"',
            'density="comfortable"',
        ],
    },
    {
        label: "badge",
        snippets: ["min-w-14", "justify-start"],
    },
    {
        label: "button",
        snippets: [
            'size="icon-xs"',
            'size="xs"',
            'data-icon="inline-start"',
            'action: "shrink-0"',
        ],
    },
] as const;

describe("full UI replacement regression coverage", () => {
    it("keeps dashboard and recording workstation brand globals migrated to owner-local classes", () => {
        const globals = readSource("app/globals.css");
        const workstation = readSource("features/dashboard/workstation.tsx");
        const detailWorkstation = readSource(
            "features/recordings/workstation.tsx",
        );
        const dashboardBrandClassNames = extractBoundedSlice(
            workstation,
            "const dashboardBrandClassNames = {",
            "} as const;",
        );
        const recordingWorkstationBrandClassNames = extractBoundedSlice(
            detailWorkstation,
            "const recordingWorkstationBrandClassNames = {",
            "} as const;",
        );
        const recordingWorkstationNavClassNames = extractBoundedSlice(
            detailWorkstation,
            "const recordingWorkstationNavClassNames = {",
            "} as const;",
        );
        const recordingWorkstationTopbarClassNames = extractBoundedSlice(
            detailWorkstation,
            "const recordingWorkstationTopbarClassNames = {",
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
        for (const selector of RECORDING_DETAIL_NAV_BACK_REMOVED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
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
        expect(workstation).toContain('data-sot-part="dashboard-brand"');
        expect(workstation).toContain('data-sot-part="dashboard-brand-name"');
        expect(workstation).toContain(
            'data-sot-part="dashboard-brand-subtitle"',
        );
        for (const {
            expected,
            property,
        } of RECORDING_WORKSTATION_BRAND_OWNER_CLASS_INITIALIZERS) {
            const propertyInitializer = extractObjectStringProperty(
                recordingWorkstationBrandClassNames,
                property,
            );
            expect(propertyInitializer).toContain(`${property}:`);
            expect(propertyInitializer).toContain(`"${expected}"`);
            expect(detailWorkstation).toMatch(
                new RegExp(
                    `className=\\{\\s*recordingWorkstationBrandClassNames\\.${property}\\s*\\}`,
                ),
            );
        }
        expect(detailWorkstation).toContain(
            'data-sot-part="workstation-brand"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-part="workstation-brand-name"',
        );
        expect(detailWorkstation).toContain(
            'data-sot-part="workstation-brand-subtitle"',
        );
        for (const {
            expected,
            property,
        } of RECORDING_WORKSTATION_NAV_OWNER_CLASS_INITIALIZERS) {
            expect(
                extractObjectStringProperty(
                    recordingWorkstationNavClassNames,
                    property,
                ),
            ).toBe(`${property}: "${expected}"`);
            expect(detailWorkstation).toContain(
                `className={recordingWorkstationNavClassNames.${property}}`,
            );
        }
        for (const {
            expected,
            property,
        } of RECORDING_WORKSTATION_TOPBAR_OWNER_CLASS_INITIALIZERS) {
            expect(recordingWorkstationTopbarClassNames).toContain(
                `${property}:`,
            );
            expect(recordingWorkstationTopbarClassNames).toContain(
                `"${expected}"`,
            );
            expect(detailWorkstation).toMatch(
                new RegExp(
                    `className=\\{\\s*recordingWorkstationTopbarClassNames\\.${property}\\s*\\}`,
                ),
            );
        }
        for (const classToken of RECORDING_WORKSTATION_TOPBAR_REQUIRED_CLASS_TOKENS) {
            expect(recordingWorkstationTopbarClassNames).toContain(classToken);
        }
        expect(recordingWorkstationTopbarClassNames).not.toMatch(
            RECORDING_WORKSTATION_TOPBAR_FORBIDDEN_CLASS_PATTERN,
        );
    });

    it("keeps semantic global primitives and a Radix settings shell without global SOT visual overrides", () => {
        const globals = readSource("app/globals.css");
        const panel = readSource("components/panel.tsx");
        const breadcrumb = readSource("components/ui/breadcrumb.tsx");
        const badge = readSource("components/ui/badge.tsx");
        const card = readSource("components/ui/card.tsx");
        const button = readSource("components/ui/button.tsx");
        const dialog = readSource("components/ui/dialog.tsx");
        const input = readSource("components/ui/input.tsx");
        const label = readSource("components/ui/label.tsx");
        const popover = readSource("components/ui/popover.tsx");
        const select = readSource("components/ui/select.tsx");
        const sidebar = readSource("components/ui/sidebar.tsx");
        const slider = readSource("components/ui/slider.tsx");
        const switchPrimitive = readSource("components/ui/switch.tsx");
        const textarea = readSource("components/ui/textarea.tsx");
        const toggleGroup = readSource("components/ui/toggle-group.tsx");
        const toaster = readSource("components/ui/sonner.tsx");
        const confirmDialog = readSource("components/ui/confirm-dialog.tsx");
        const layout = readSource("app/layout.tsx");
        const tagManager = readSource(
            "features/recordings/components/recording-tag-manager.tsx",
        );

        expect(globals).toContain("BetterAINote global design tokens");
        expect(globals).toContain("--graphite-100: rgb(");
        expect(globals).toContain("--graphite-100: oklch(");
        expect(globals).toContain("--steel-500: rgb(");
        expect(globals).toContain("--steel-500: oklch(");
        expect(globals).toContain("--bg-canvas:");
        expect(globals).toContain("--bg-elevated:");
        expect(globals).toContain("--fg-primary:");
        for (const token of [
            "--button-primary-bg:",
            "--button-primary-hover-bg:",
            "--button-primary-border:",
            "--button-primary-fg:",
            "--button-primary-shadow:",
            "--button-destructive-bg:",
            "--button-destructive-hover-bg:",
            "--button-destructive-border:",
            "--button-destructive-fg:",
            "--button-destructive-shadow:",
            "--modal-scrim-bg:",
        ]) {
            expect(globals).toContain(token);
        }
        expect(globals).not.toContain("--confirm-dialog-warning-bg:");
        expect(globals).not.toContain("--confirm-dialog-warning-border:");
        expect(globals).toContain(
            "color-mix(in srgb, var(--accent) 92%, white 18%)",
        );
        expect(globals).toContain("oklch(0.62 0.18 25)");
        expect(globals).toContain("@supports not (color: oklch(");
        expect(globals).not.toMatch(/(^|[{\s,])\.panel(?![\w-])/m);
        expect(globals).not.toMatch(/(^|\n|,)\s*\.storage-bar\b/);
        const globalSlotSelectors = globals
            .split("\n")
            .filter((line) => line.includes('[data-slot="'));
        expect(globalSlotSelectors).toEqual([]);
        for (const overlayPrimitive of [dialog, popover, select]) {
            expect(overlayPrimitive).not.toMatch(
                /(?:^|\s)z-(?:50|\[calc\(var\(--z-modal\)[^\]]*\])(?:\s|")/,
            );
        }
        expect(globals).not.toContain(
            '[data-slot="toggle-group-item"][data-variant="swatch"]',
        );
        for (const shadcnPrimitive of [
            button,
            badge,
            input,
            switchPrimitive,
            textarea,
        ]) {
            expect(shadcnPrimitive).not.toContain("dark:");
            expect(shadcnPrimitive).not.toMatch(
                /\[_svg:not\(\[class\*=['"]size-/,
            );
        }
        expect(globals).not.toContain("--toggle-swatch-");
        expect(globals).not.toContain("--swatch-selection-dot-bg");
        expect(globals).not.toContain(".toggle-group-swatch");
        expect(globals).not.toMatch(/\.toggle-group-swatch-tone-/);
        expect(toggleGroup).not.toContain("[--toggle-swatch");
        expect(toggleGroup).not.toMatch(
            /--tag-(blue|green|amber|violet|rose|slate)/,
        );
        expect(toggleGroup).not.toContain("toggle-group-swatch");
        expect(toggleGroup).not.toContain("ToggleGroupSwatchDot");
        expect(toggleGroup).not.toContain("swatch:");
        expect(toggleGroup).not.toContain("tone:");
        expect(toggleGroup).not.toContain("data-tone=");
        expect(tagManager).toContain("RECORDING_TAG_SWATCH_ITEM_CLASS_NAME");
        expect(tagManager).toMatch(
            /recordingTagTextColorClassName\s*\[\s*tag\.color\s*\]/,
        );
        expect(tagManager).toContain("recordingTagSwatchColorClassName[item]");
        expect(tagManager).not.toContain(
            "RECORDING_TAG_COLOR_TOKEN_CLASS_NAME",
        );
        expect(tagManager).not.toContain("--recording-tag-accent");
        expect(tagManager).not.toContain(
            "recordingTagManagerSwatchToneClassNames",
        );
        expect(tagManager).toContain("tagm-swatch grid size-[18px]");
        expect(tagManager).toContain("place-items-center");
        expect(tagManager).toContain("rounded-full");
        expect(tagManager).toContain("text-foreground");
        expect(tagManager).toContain("data-[state=on]:border-foreground");
        expect(tagManager).not.toContain(
            [
                "data-[state=on]:shadow",
                "[inset_0_0_0_2px_var(--background)]",
            ].join("-"),
        );
        expect(tagManager).not.toContain("bg-[var(--recording-tag-accent)]");
        expect(tagManager).toContain("data-sot-tag-color={item}");
        expect(tagManager).toContain("data-sot-tag-color={tag.color}");
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-slot="toggle-group-item"][data-variant="swatch"]',
            ),
        ).toEqual([]);
        expect(collectCssRuleBlocks(globals, ".toggle-group-swatch")).toEqual(
            [],
        );
        expectTokenOklchFallbackOrder(
            globals,
            ":root",
            new Set(["--skeleton-shimmer-edge", "--skeleton-shimmer-peak"]),
        );
        expectTokenOklchFallbackOrder(globals, '.dark,\n[data-theme="dark"]');
        expect(globals).not.toMatch(/--sot-[A-Za-z0-9-]+\s*:/);
        expect(
            extractCssBlock(globals, "@supports not (color: oklch("),
        ).not.toMatch(/\b(oklch|color-mix)\(/);
        for (const token of [
            "BetterAINote global design tokens",
            "--bg-canvas:",
            "--bg-elevated:",
            "--fg-primary:",
            "--skeleton-shimmer-edge:",
            "--skeleton-shimmer-peak:",
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
        const productCss = readProductCss(globals);
        const settingsDialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const settingsContent = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const dataSources = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const settingsOpenFocus = extractBoundedSlice(
            settingsDialog,
            "const handleOpenAutoFocus =",
            "const handleNavKeyDown =",
        );
        expect(productCss).not.toMatch(LEGACY_MONO_PRODUCT_CSS_SELECTOR_RE);
        expect(productCss).not.toMatch(
            LEGACY_DESIGN_TWEAKS_PRODUCT_CSS_SELECTOR_RE,
        );
        expect(stripCssComments(productCss)).not.toMatch(
            UNAPPROVED_PRODUCT_CSS_CLASS_SELECTOR_RE,
        );
        expect(productCss).not.toContain(
            '[data-sot-part="dashboard-transcript-speaker-time"][data-sot-format="mono"]',
        );
        expect(globals).not.toContain("[data-sot-shell] *:focus");
        expect(globals).not.toContain('[data-slot="button"]:focus-visible');
        expect(globals).toContain("button:not([data-slot])");
        expect(globals).not.toContain(
            ':where([data-slot="button"], [data-slot="popover-trigger"])',
        );
        expect(globals).not.toContain(
            '[data-sot-control="dashboard-recording-row"]:focus-visible',
        );
        expect(productCss).not.toMatch(
            LEGACY_MODAL_SHELL_PRODUCT_CSS_SELECTOR_RE,
        );
        for (const selector of REMOVED_SETTINGS_SHELL_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(productCss, selector)).toEqual([]);
        }
        expect(settingsDialog).not.toContain("overlayProps");
        expect(settingsDialog).not.toContain("const SETTINGS_OVERLAY_CLASS =");
        expect(settingsDialog).not.toContain(
            "className: SETTINGS_OVERLAY_CLASS",
        );
        expect(settingsDialog).not.toContain("overlayClassName");
        expect(settingsDialog).not.toContain("bg-[var(--modal-scrim-bg)]");
        expect(settingsDialog).not.toContain("backdrop-blur");
        expect(settingsDialog).toContain(
            "<DialogTrigger asChild>{props.trigger}</DialogTrigger>",
        );
        expect(settingsDialog).toContain(
            "onOpenAutoFocus={handleOpenAutoFocus}",
        );
        for (const primitive of [
            "Root",
            "Trigger",
            "Content",
            "Title",
            "Description",
            "Close",
        ]) {
            expect(dialog).toContain(`DialogPrimitive.${primitive}`);
        }
        expect(settingsOpenFocus).toMatch(
            /event\.preventDefault\(\);\s*const initialSection = resolveInitialSettingsSection\(\);\s*shouldFocusNavOnOpenRef\.current = true;\s*applyActiveSettingsSection\(initialSection\);/,
        );
        expect(settingsOpenFocus).toContain(
            "navButtonRefs.current[\n                getSettingsSectionIndex(initialSection)\n            ]?.focus({ preventScroll: true });",
        );
        for (const handManagedLifecycle of [
            "returnFocusRef",
            "startBrowserTimeout",
            "stopBrowserTimeout",
            "onCloseAutoFocus",
            'addBrowserWindowEventListener("keydown"',
            "documentElement.style.overflow",
            "body.style.overflow",
            "setTimeout(",
            "key={activeSection}",
        ]) {
            expect(settingsDialog).not.toContain(handManagedLifecycle);
        }
        const settingsShellSurfaceClass = findStringConstInitializerContaining(
            settingsDialog,
            [
                "const SETTINGS_SHELL_SURFACE_CLASS =",
                "box-border",
                "flex",
                "h-[min(94svh,980px)]",
                "max-h-[calc(100svh_-_1rem)]",
                "w-[920px]",
                "max-w-[calc(100vw_-_40px)]",
                "sm:max-w-[min(920px,calc(100vw_-_40px))]",
                "flex-col",
                "gap-0",
                "overflow-hidden",
                "bg-card",
                "p-0",
            ],
        );
        expect(settingsShellSurfaceClass).not.toContain("rounded-[");
        expect(settingsShellSurfaceClass).not.toMatch(/(?:^|\s)z-/);
        expect(settingsShellSurfaceClass).not.toContain("data-[state=closed]");
        expect(settingsShellSurfaceClass).not.toContain("!");
        expect(settingsShellSurfaceClass).not.toContain("var(--");
        expect(settingsShellSurfaceClass).not.toContain("shadow-");
        expect(settingsShellSurfaceClass).not.toContain("[box-shadow");
        findStringConstInitializerContaining(settingsDialog, [
            "const SETTINGS_HEADER_CLASS =",
            "flex-none",
            "items-center",
            "max-[720px]:flex-wrap",
            "max-[720px]:items-start",
            "max-[720px]:gap-3",
        ]);
        findStringConstInitializerContaining(settingsDialog, [
            "const SETTINGS_BODY_CLASS =",
            "grid",
            "min-h-0",
            "flex-1",
            "grid-cols-[200px_minmax(0,1fr)]",
        ]);
        findStringConstInitializerContaining(settingsDialog, [
            "const SETTINGS_RAIL_CLASS =",
            "flex",
            "min-h-0",
            "flex-col",
            "overflow-x-hidden",
            "overflow-y-auto",
            "[overscroll-behavior:contain]",
        ]);
        findStringConstInitializerContaining(settingsContent, [
            "const SETTINGS_SCROLL_BODY_CLASS =",
            "min-h-0",
            "overflow-y-auto",
            "px-[26px]",
            "py-[22px]",
            "[overscroll-behavior:contain]",
        ]);
        expectExactStringConstInitializer(
            dataSources,
            "SETTINGS_THREE_PANE_SCROLL_BODY_CLASS",
            "grid min-h-0 grid-cols-[280px_1fr] overflow-hidden p-0",
        );
        const dataSourcesThreePane = extractOpeningElement(
            dataSources,
            "aria-busy={isLoading}",
            "div",
        );
        expect(dataSourcesThreePane).toContain(
            "SETTINGS_THREE_PANE_SCROLL_BODY_CLASS",
        );
        expect(dataSourcesThreePane).not.toContain('className="');
        expect(settingsContent).not.toContain(
            "SETTINGS_THREE_PANE_SCROLL_BODY_CLASS",
        );
        expect(settingsContent).not.toContain(
            "grid min-h-0 grid-cols-[280px_1fr] overflow-hidden p-0",
        );
        findStringConstInitializerContaining(settingsContent, [
            "const SETTINGS_SECTION_GROUP_CLASS =",
            "relative",
            "mb-[22px]",
        ]);
        for (const selector of [
            '[data-sot-panel="settings-header"]',
            '[data-sot-panel="settings-body"]',
            '[data-sot-panel="settings-rail"]',
            '[data-sot-panel="settings-scroll-body"]',
            '[data-sot-panel="settings-scroll-body"][data-sot-layout="three-pane"]',
            "[data-sot-section-group]",
            '[data-sot-part="settings-user-summary"] > div',
            '[data-sot-part="settings-user-name"]',
            '[data-sot-part="settings-user-subtitle"]',
        ]) {
            expect(collectExactCssRuleBlocks(productCss, selector)).toEqual([]);
        }
        for (const selector of REMOVED_DEAD_SOT_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of DIALOG_SLOT_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(productCss).not.toMatch(
            DELETE_CONFIRM_MODAL_EXTRAS_LEGACY_PRODUCT_CSS_SELECTOR_RE,
        );
        for (const selector of MIGRATED_CONFIRM_DIALOG_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(productCss, selector)).toEqual([]);
        }
        const confirmFooterButtonRules = collectCssRuleBlocks(
            productCss,
            '[data-sot-part="confirm-foot"]',
        ).filter(({ prelude }) =>
            /\bbutton\b|\[data-slot="button"\]/.test(prelude),
        );
        expect(confirmFooterButtonRules).toEqual([]);
        const destructiveButtonRules = collectCssRuleBlocks(
            productCss,
            '[data-slot="button"][data-variant="destructive"]',
        );
        for (const block of destructiveButtonRules) {
            expect(block.declarations).not.toMatch(
                CONFIRM_DIALOG_BUTTON_PRIMITIVE_REPAINT_DECLARATION_RE,
            );
        }
        for (const snippet of CONFIRM_DIALOG_PRIMITIVE_RESIDUAL_SNIPPETS) {
            expect(confirmDialog).not.toContain(snippet);
        }
        expectExactStringConstInitializer(
            confirmDialog,
            "CONFIRM_DIALOG_CONTENT_CLASS",
            "sm:max-w-[460px]",
        );
        expect(confirmDialog).not.toContain("color(srgb");
        expect(confirmDialog).not.toContain("CONFIRM_DIALOG_CONTENT_STYLE");
        expect(confirmDialog).not.toContain("CONFIRM_DIALOG_FOOTER_STYLE");
        expectExactStringConstInitializer(
            confirmDialog,
            "CONFIRM_DIALOG_BODY_CLASS",
            "flex flex-col gap-3",
        );
        expectExactStringConstInitializer(
            confirmDialog,
            "CONFIRM_DIALOG_EXTRA_CLASS",
            "flex flex-col gap-3",
        );
        expectExactStringConstInitializer(
            confirmDialog,
            "CONFIRM_DIALOG_DETAILS_LIST_CLASS",
            "flex list-disc flex-col gap-1 pl-5",
        );
        expect(confirmDialog).toMatch(
            /<li[\s\S]*\{\.\.\.detailItemSlotProps\}[\s\S]*className=\{[\s\S]*detailItemSlotProps\?\.className[\s\S]*\}/,
        );
        expect(confirmDialog).toMatch(
            /<p[\s\S]*\{\.\.\.warningSlotProps\}[\s\S]*className=\{warningSlotProps\?\.className\}/,
        );
        expect(confirmDialog).not.toContain("oklch(");

        expect(card.trim()).not.toBe("export {};");
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
        expectPrimitiveToExcludeBusinessTokens(
            card,
            AUTH_CARD_PRIMITIVE_FORBIDDEN_TOKENS,
        );
        expect(panel).toContain('data-slot="card"');
        expect(panel).toContain("bg-card text-card-foreground");
        expect(panel).toContain("data-variant={variant}");
        expect(panel).not.toContain('cn("panel"');
        expect(panel).not.toContain('className="panel"');

        expect(breadcrumb.trim()).not.toBe("export {};");
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

        expect(sidebar.trim()).not.toBe("export {};");
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
        expect(button).toContain(
            'import { Slot } from "@radix-ui/react-slot";',
        );
        expect(button).toContain(
            'import { cva, type VariantProps } from "class-variance-authority";',
        );
        expect(button).toContain("const buttonVariants = cva(");
        expect(button).toContain("VariantProps<typeof buttonVariants>");
        expect(button).toContain("asChild?: boolean;");
        expect(button).toContain('const Comp = asChild ? Slot : "button";');
        expect(button).toContain('data-slot="button"');
        expect(button).toContain("data-variant={variant}");
        expect(button).toContain("data-size={size}");
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
        const workstation = readSource("features/dashboard/workstation.tsx");
        for (const focusClass of [
            "outline-none",
            "focus-visible:border-ring",
            "focus-visible:ring-[3px]",
            "focus-visible:ring-ring/50",
        ]) {
            expect(button).toContain(focusClass);
        }
        for (const variant of [
            "default",
            "destructive",
            "outline",
            "secondary",
            "ghost",
            "link",
        ]) {
            expect(button).toContain(`${variant}:`);
        }
        for (const businessVariant of [
            "actionPrimary:",
            "actionDestructive:",
            "quietOutline:",
            "ghostNeutral:",
            "accentIcon:",
            "ghostIcon:",
            "ghostIconCompact:",
            "chipRemove:",
            "pill:",
        ]) {
            expect(buttonVariantBlock).not.toContain(businessVariant);
        }
        for (const businessSize of [
            '"control-sm":',
            '"control-xs":',
            '"pill-sm":',
            '"icon-2xs":',
            '"icon-chip":',
        ]) {
            expect(buttonSizeBlock).not.toContain(businessSize);
        }
        for (const variant of DASHBOARD_RECORDING_LIST_BUTTON_VARIANTS) {
            expect(buttonVariantBlock).not.toContain(`${variant}:`);
        }
        expect(button).not.toContain("settingsClose:");
        expect(button).not.toContain("settingsNav:");
        expect(button).not.toContain("sourceProviderTile:");
        expect(button).not.toContain("rail:");
        expect(button).not.toContain("sr-item");
        expect(button).not.toContain("buttonStateClassName");
        expect(button).not.toContain('variant === "rail"');
        expect(button).not.toContain("oklch(");
        expect(button).not.toContain("data-sot");
        expect(button).not.toMatch(/\bsourceProvider\b/);
        expect(button).not.toMatch(/\bsettings\b/i);
        expect(buttonSizeBlock).not.toContain("settingsClose:");
        expect(buttonSizeBlock).not.toContain("settingsNav:");
        expect(buttonSizeBlock).not.toContain("navigationItem:");
        expect(buttonSizeBlock).not.toContain("surfaceItem:");
        for (const size of DASHBOARD_RECORDING_LIST_BUTTON_SIZES) {
            expect(buttonSizeBlock).not.toContain(`${size}:`);
        }
        expectPrimitiveToExcludeBusinessTokens(
            button,
            DASHBOARD_RECORDING_LIST_BUTTON_PRIMITIVE_FORBIDDEN_TOKENS,
        );
        expect(button).toContain(
            'default:\n                    "bg-primary text-primary-foreground hover:bg-primary/90"',
        );
        expect(button).toContain(
            'destructive:\n                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20"',
        );
        for (const actionButtonClass of [
            "border-[var(--button-primary-border)]",
            "bg-[image:var(--button-primary-bg)]",
            "text-[var(--button-primary-fg)]",
            "shadow-[var(--button-primary-shadow)]",
            "hover:bg-[image:var(--button-primary-hover-bg)]",
            "border-[var(--button-destructive-border)]",
            "bg-[image:var(--button-destructive-bg)]",
            "text-[var(--button-destructive-fg)]",
            "shadow-[var(--button-destructive-shadow)]",
            "hover:bg-[image:var(--button-destructive-hover-bg)]",
        ]) {
            expect(button).not.toContain(actionButtonClass);
            expect(tagManager).not.toContain(actionButtonClass);
        }
        for (const recordingTagButtonToken of [
            "recordingTagErrorRetry",
            "recordingTagToggle",
            "recordingTagInlineCreate",
            "recordingTagCancel",
            "recordingTagCreate",
            "recordingTagDelete",
            "recordingTagChipRemove",
            "recordingTagPanelClose",
            "recordingTagAction",
        ]) {
            expect(button).not.toContain(recordingTagButtonToken);
        }
        expect(button).not.toContain("text-[var(--accent)]");
        expect(tagManager).not.toContain("recordingTagManagerButtonClassNames");
        for (const tagManagerButtonContract of [
            'variant="default"',
            'variant="destructive"',
            'variant="ghost"',
            'size="xs"',
            'size="icon-xs"',
            'size="icon-compact"',
            "text-muted-foreground",
            "hover:bg-muted",
            "hover:text-foreground",
        ]) {
            expect(tagManager).toContain(tagManagerButtonContract);
        }
        expect(tagManager).toContain("text-primary-foreground");
        expect(tagManager).toContain("text-primary");
        for (const removedAuthOnboardingButtonToken of [
            "accent:",
            "accentLink:",
            "onboardingProviderCard:",
            "onboardingDefaultSource:",
            "onboardingSecondaryAction:",
            "onboardingPrimaryAction:",
        ]) {
            expect(buttonVariantBlock).not.toContain(
                removedAuthOnboardingButtonToken,
            );
        }
        for (const removedAuthOnboardingButtonSize of [
            "onboardingProviderCard:",
            "onboardingDefaultSource:",
            "onboardingAction:",
            '"form-submit":',
            '"inline-link":',
        ]) {
            expect(buttonSizeBlock).not.toContain(
                removedAuthOnboardingButtonSize,
            );
        }
        expectPrimitiveToExcludeBusinessTokens(
            button,
            AUTH_BUTTON_PRIMITIVE_FORBIDDEN_TOKENS,
        );
        for (const removedPlayerButtonToken of [
            "playerControl:",
            "playerPrimary:",
            "playerSpeed:",
            "playerControlSm:",
            "playerControlLg:",
            "data-player-control-icon",
        ]) {
            expect(button).not.toContain(removedPlayerButtonToken);
        }
        for (const dashboardSize of [
            "dashboardNav",
            "dashboardSync",
            "dashboardCopy",
            "dashboardCompactAction",
            "dashboardDrawerTrigger",
            "detailHeaderIconAction",
            "detailHeaderAction",
            "dashboardSidebarCollapse",
            "dashboardSettingsAvatar",
        ]) {
            expect(buttonVariantBlock).not.toContain(`${dashboardSize}:`);
            expect(buttonSizeBlock).not.toContain(`${dashboardSize}:`);
        }
        for (const transcriptionVariant of [
            "transcriptionAction",
            "transcriptionPrimaryAction",
            "transcriptionDangerAction",
        ]) {
            expect(buttonVariantBlock).not.toContain(
                `${transcriptionVariant}:`,
            );
        }
        expect(buttonSizeBlock).not.toContain("transcriptionAction:");
        for (const recordingRouteButtonVariant of [
            "recordingRoutePrimaryAction",
            "recordingRouteGhostAction",
        ]) {
            expect(buttonVariantBlock).not.toContain(
                `${recordingRouteButtonVariant}:`,
            );
        }
        expect(buttonSizeBlock).not.toContain("recordingRouteAction:");
        for (const dashboardTranscriptActionClass of [
            "data-[copy-state=ok]:border-primary/30",
            "data-[copy-state=ok]:bg-primary/10",
            "data-[copy-state=ok]:text-primary",
            "data-[copy-state=err]:border-destructive/30",
            "data-[copy-state=err]:text-destructive",
            "data-[copy-state=err]:hover:bg-transparent",
        ]) {
            expect(button).not.toContain(dashboardTranscriptActionClass);
            expect(workstation).not.toContain(dashboardTranscriptActionClass);
        }
        expect(button).toContain(
            "hover:bg-accent hover:text-accent-foreground",
        );
        expect(button).not.toContain("size-[36px] rounded-[50%]");
        expect(button).not.toContain("size-[30px] rounded-[50%]");
        expect(button).not.toContain("size-[44px] rounded-[50%]");
        expect(button).not.toContain("min-w-[50px] justify-center");
        expect(button).not.toContain("chipRemove:");
        expect(button).not.toContain("[&_svg]:invisible");
        expect(tagManager).toContain(
            'data-sot-control="recording-tag-delete-open"',
        );
        expect(tagManager).toContain('size="icon-xs"');
        expect(tagManager).toContain(
            "x shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
        );
        expect(tagManager).toContain(
            "tagm-close shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground",
        );
        expect(tagManager).not.toContain("size-[var(--icon-chip-size)]");
        expect(tagManager).not.toContain("size-[var(--icon-compact-size)]");
        expect(tagManager).not.toContain("[&_svg]:invisible");
        expect(tagManager).toContain('className="invisible"');
        expect(button).not.toContain("accentSelf");
        expect(button).not.toContain('"icon-chip-hidden-glyph":');
        for (const size of [
            "primary:",
            "danger:",
            "player:",
            '"player-primary":',
            '"player-speed-compact":',
            '"compact-ghost":',
            "copy:",
            '"copy-success":',
            '"copy-danger":',
            '"player-sm":',
            '"player-lg":',
            '"player-speed":',
            "compact:",
        ]) {
            expect(button).not.toContain(size);
        }
        expect(button).not.toContain("glass:");
        expect(button).toContain(
            "export { Button, IconButton, buttonVariants };",
        );
        expect(button).not.toContain("type ButtonVariant =");
        expect(button).not.toContain("type ButtonSize =");
        expect(button).not.toContain("React.cloneElement");
        expect(dialog).toContain(
            'import * as DialogPrimitive from "@radix-ui/react-dialog";',
        );
        for (const primitive of [
            "Root",
            "Trigger",
            "Portal",
            "Close",
            "Overlay",
            "Content",
            "Title",
            "Description",
        ]) {
            expect(dialog).toContain(`DialogPrimitive.${primitive}`);
        }
        expect(dialog).toContain("showCloseButton");
        expect(dialog).toContain("<XIcon />");
        for (const primitive of [
            "DialogHeader",
            "DialogFooter",
            "DialogTitle",
            "DialogDescription",
        ]) {
            expect(dialog).toMatch(new RegExp(`function ${primitive}\\(`));
        }
        for (const slot of [
            "dialog-trigger",
            "dialog-close",
            "dialog-portal",
            "dialog-overlay",
            "dialog-content",
            "dialog-header",
            "dialog-footer",
            "dialog-title",
            "dialog-description",
        ]) {
            expect(dialog).toContain(`data-slot="${slot}"`);
        }
        expect(dialog).toContain("function DialogPortal(");
        expect(dialog).toContain("bg-[var(--modal-scrim-bg)]");
        expect(dialog).not.toContain("bg-black");
        expect(dialog).not.toContain("DialogContext");
        expect(slider).toContain("bg-background");
        expect(slider).not.toContain("bg-white");
        expect(popover).toContain(
            'import * as PopoverPrimitive from "@radix-ui/react-popover";',
        );
        for (const primitive of [
            "Root",
            "Trigger",
            "Anchor",
            "Portal",
            "Close",
            "Content",
            "Arrow",
        ]) {
            expect(popover).toContain(`PopoverPrimitive.${primitive}`);
        }
        for (const primitive of [
            "Popover",
            "PopoverTrigger",
            "PopoverContent",
            "PopoverAnchor",
            "PopoverPortal",
            "PopoverClose",
            "PopoverArrow",
        ]) {
            expect(popover).toMatch(new RegExp(`function ${primitive}\\(`));
            expect(popover).toContain(`    ${primitive},`);
        }
        for (const slot of [
            "popover",
            "popover-trigger",
            "popover-anchor",
            "popover-portal",
            "popover-close",
            "popover-content",
            "popover-arrow",
        ]) {
            expect(popover).toContain(`data-slot="${slot}"`);
        }
        expect(popover).toContain("bg-popover");
        expect(popover).toContain("text-popover-foreground");
        expect(label).toContain(
            'import * as LabelPrimitive from "@radix-ui/react-label";',
        );
        expect(label).toContain(
            "React.ComponentProps<typeof LabelPrimitive.Root>",
        );
        expect(label).toContain("<LabelPrimitive.Root");
        expect(label).toContain('data-slot="label"');
        expect(label).not.toContain('className={cn("field-name"');
        expect(input).toContain('React.ComponentProps<"input">');
        expect(input).toContain(
            'import { cva, type VariantProps } from "class-variance-authority";',
        );
        expect(input).toContain("const inputVariants = cva(");
        expect(input).toContain("VariantProps<typeof inputVariants>");
        expect(input).toContain('data-slot="input"');
        expect(input).toContain("data-variant={variant}");
        expect(input).toContain("data-size={controlSize}");
        expect(input).toContain("controlSize:");
        expect(input).not.toContain("detailHeaderTitle");
        expect(input).not.toContain("accent:");
        expect(input).not.toContain("compact:");
        expect(input).not.toContain("onboardingSourceField:");
        expect(input).not.toContain("onboardingSourceUrl:");
        expectPrimitiveToExcludeBusinessTokens(
            input,
            AUTH_INPUT_PRIMITIVE_FORBIDDEN_TOKENS,
        );
        expect(input).not.toContain(
            '"h-8 min-w-0 flex-1 px-3 py-1 text-base md:text-sm"',
        );
        for (const className of [
            "border-input",
            "focus-visible:ring-ring/50",
            "aria-invalid:border-destructive",
        ]) {
            expect(input).toContain(className);
        }
        expect(input).not.toContain("field-input");
        expect(textarea).toContain('React.ComponentProps<"textarea">');
        expect(textarea).toContain("export function Textarea");
        expect(textarea).toContain("<textarea");
        expect(textarea).toContain('data-slot="textarea"');
        expect(textarea).not.toContain("data-sot-privacy-boundary");
        for (const className of [
            "border-input",
            "focus-visible:ring-ring/50",
            "aria-invalid:border-destructive",
        ]) {
            expect(textarea).toContain(className);
        }
        expect(textarea).not.toContain("field-input");
        expect(select).toContain(
            'import * as SelectPrimitive from "@radix-ui/react-select";',
        );
        for (const primitive of [
            "Root",
            "Trigger",
            "Portal",
            "Content",
            "Value",
            "Group",
            "Item",
        ]) {
            expect(select).toContain(`SelectPrimitive.${primitive}`);
        }
        for (const primitive of [
            "SelectTrigger",
            "SelectContent",
            "SelectItem",
            "SelectValue",
            "SelectGroup",
        ]) {
            expect(select).toContain(`    ${primitive},`);
        }
        for (const slot of [
            "select",
            "select-trigger",
            "select-content",
            "select-item",
            "select-value",
            "select-group",
        ]) {
            expect(select).toContain(`data-slot="${slot}"`);
        }
        expect(select).not.toContain("<select");
        expect(select).not.toContain("<option");
        expect(select).not.toContain('className={cn("select"');
        expect(switchPrimitive).toContain(
            'import * as SwitchPrimitive from "@radix-ui/react-switch";',
        );
        expect(switchPrimitive).toContain(
            "React.ComponentProps<typeof SwitchPrimitive.Root>",
        );
        expect(switchPrimitive).toContain("<SwitchPrimitive.Root");
        expect(switchPrimitive).toContain("<SwitchPrimitive.Thumb");
        expect(switchPrimitive).toContain('data-slot="switch"');
        expect(switchPrimitive).toContain('data-slot="switch-thumb"');
        expect(switchPrimitive).toContain("data-[state=checked]:bg-primary");
        expect(switchPrimitive).toContain("data-[state=unchecked]:bg-input");
        expect(switchPrimitive).not.toContain('className={cn("toggle"');
        expect(switchPrimitive).not.toContain('className="t-knob"');
        expect(toggleGroup).toContain(
            'import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";',
        );
        expect(toggleGroup).toContain(
            'import { cva, type VariantProps } from "class-variance-authority";',
        );
        expect(toggleGroup).toContain("const toggleGroupItemVariants = cva(");
        expect(toggleGroup).toContain(
            "React.ComponentProps<typeof ToggleGroupPrimitive.Root>",
        );
        expect(toggleGroup).toContain(
            "React.ComponentProps<\n    typeof ToggleGroupPrimitive.Item\n>",
        );
        expect(toggleGroup).toContain('data-slot="toggle-group"');
        expect(toggleGroup).toContain('data-slot="toggle-group-item"');
        expect(toggleGroup).toContain("data-variant={variant}");
        expect(toggleGroup).toContain("data-size={size}");
        expect(toggleGroup).not.toContain("data-tone=");
        for (const recordingTagToggleToken of [
            "recordingTagColorPicker",
            "recordingTagQuickColorPicker",
            "recordingTagIconPicker",
            "recordingTagIconOption",
        ]) {
            expect(toggleGroup).not.toContain(recordingTagToggleToken);
        }
        expect(toggleGroup).not.toContain("onboardingSourceAuthMode:");
        expect(toggleGroup).not.toContain("onboardingSourceAuthModeOption:");
        expect(toggleGroup).not.toContain("settingsSourceAuthMode:");
        expect(toggleGroup).not.toContain("settingsSourceAuthModeOption:");
        expect(toggleGroup).not.toContain("swatch:");
        expect(toggleGroup).not.toContain("tone:");
        expect(toggleGroup).not.toContain("toggle-group-swatch");
        expect(toggleGroup).not.toContain("ToggleGroupSwatchDot");
        expect(toggleGroup).not.toContain("[--toggle-swatch");
        expect(toggleGroup).not.toMatch(
            /--tag-(blue|green|amber|violet|rose|slate)/,
        );
        expect(toaster).toContain(
            'import { Toaster as Sonner, type ToasterProps } from "sonner";',
        );
        expect(toaster).toContain("<Sonner");
        expect(toaster).toContain('theme={theme as ToasterProps["theme"]}');
        expect(toaster).toContain('"--normal-bg": "var(--popover)"');
        expect(toaster).toContain(
            '"--normal-text": "var(--popover-foreground)"',
        );
        expect(toaster).toContain('"--normal-border": "var(--border)"');
        expect(toaster).not.toContain("useSonner");
        expect(toaster).not.toContain("toast-stack");
        expect(toaster).not.toContain("toast toast-ok");
        expect(toaster).not.toContain("toast toast-err");
        expect(toaster).not.toContain("toast-ico");
        expect(toaster).not.toContain("DEFAULT_TOAST_DURATION_MS");
        expect(confirmDialog).toContain("ConfirmDialogContext");
        expect(confirmDialog).toContain("ConfirmDialogProvider");
        expect(confirmDialog).toContain("ConfirmDialogSlotProps");
        expect(confirmDialog).toContain("useConfirmDialog");
        expect(confirmDialog).toMatch(/<Dialog(?:\s|>)/);
        for (const primitive of [
            "DialogContent",
            "DialogHeader",
            "DialogTitle",
            "DialogDescription",
            "DialogFooter",
            "Button",
        ]) {
            expect(confirmDialog).toContain(`<${primitive}`);
        }
        expect(confirmDialog).toContain("portalWrapperProps");
        expect(confirmDialog).toContain("slotProps?: ConfirmDialogSlotProps");
        expect(confirmDialog).toContain("contentSlotProps");
        expect(confirmDialog).not.toContain(
            '"data-sot-panel": "confirm-dialog"',
        );
        expect(confirmDialog).not.toContain(
            'data-sot-content="confirm-dialog"',
        );
        expect(confirmDialog).not.toContain('data-sot-part="confirm-head"');
        expect(confirmDialog).not.toContain('data-sot-part="confirm-body"');
        expect(confirmDialog).not.toContain('data-sot-part="confirm-foot"');
        expect(layout).toContain("confirmDialogSotSlotProps");
        expect(layout).toContain('"data-sot-panel": "confirm-dialog"');
        expect(layout).toContain('"data-sot-content": "confirm-dialog"');
        expect(layout).toContain('"data-sot-part": "confirm-head"');
        expect(layout).toContain('"data-sot-part": "confirm-body"');
        expect(layout).toContain('"data-sot-part": "confirm-foot"');
        expect(confirmDialog).toMatch(
            /<DialogHeader[\s\S]*\{\.\.\.headerSlotProps\}[\s\S]*className=\{cn\(\s*"gap-2 text-left"/,
        );
        expect(confirmDialog).toMatch(
            /<DialogTitle[\s\S]*\{\.\.\.titleSlotProps\}[\s\S]*className=\{titleSlotProps\?\.className\}/,
        );
        expect(confirmDialog).toMatch(
            /<DialogDescription[\s\S]*\{\.\.\.descriptionSlotProps\}[\s\S]*className=\{descriptionSlotProps\?\.className\}/,
        );
        expect(confirmDialog).toMatch(
            /<DialogFooter[\s\S]*\{\.\.\.footerSlotProps\}[\s\S]*"gap-2 sm:justify-end"/,
        );
        expect(confirmDialog).not.toContain("dark:[background:");
        expect(confirmDialog).toContain(
            'confirmVariant?: "default" | "destructive"',
        );
        expect(confirmDialog).toContain(
            'state?.confirmVariant ?? "destructive"',
        );
        expect(confirmDialog).toContain('variant="outline"');
        expect(confirmDialog).toContain("variant={confirmButtonVariant}");
        expect(confirmDialog).toContain('size="sm"');
        expect(confirmDialog).toContain("detailsListSlotProps");
        expect(layout).toContain('"data-sot-list": "confirm-dialog-details"');
        expect(confirmDialog).toContain("state.details.map");
        expect(confirmDialog).toContain("state.warning");
        expect(confirmDialog).not.toContain('className="scrim"');
        expect(confirmDialog).not.toContain('className="confirm-dialog"');
        expect(confirmDialog).not.toContain('role="dialog"');
        expect(confirmDialog).not.toContain('aria-modal="true"');
        expect(confirmDialog).not.toContain('<h3 id="confirm-title">');
        expect(confirmDialog).not.toContain('className="btn danger btn-sm"');
        expect(confirmDialog).not.toContain('className="btn ghost btn-sm"');
        expect(confirmDialog).not.toMatch(
            /document\.(?:add|remove)EventListener\(\s*["']keydown["']/,
        );
        expect(confirmDialog).not.toContain("ConfirmVariant");
        expect(confirmDialog).not.toContain("btn primary btn-sm");
        expect(confirmDialog).not.toContain("<dialog");
        expect(globals).not.toContain(".confirm-head h2");
        expect(globals).not.toContain("--z-confirm-modal");
        expect(globals).not.toContain("Hardware Design System");
        expect(globals).not.toContain("warm beige");
    });

    it("keeps standalone recording route fallback actions on route Button variants", () => {
        const notFound = readSource("app/(app)/recordings/[id]/not-found.tsx");
        const error = readSource("app/(app)/recordings/[id]/error.tsx");
        const routeChrome = readSource("app/(app)/route-chrome.tsx");
        const routeFallbackEmptyClassNames = extractBoundedSlice(
            routeChrome,
            "const routeFallbackEmptyDetailClassName =",
            "type RouteFallbackChromeProps",
        );
        const routeFallbackSurfaceClassName = extractBoundedSlice(
            routeChrome,
            "const routeFallbackSurfaceClassName =",
            ";",
        );

        const notFoundPrimaryAction = extractBoundedSlice(
            notFound,
            'variant="default"',
            "</Button>",
        );
        expect(notFoundPrimaryAction).toContain('size="default"');

        const errorPrimaryAction = extractBoundedSlice(
            error,
            'variant="default"',
            "</Button>",
        );
        const errorGhostAction = extractBoundedSlice(
            error,
            'variant="ghost"',
            "</Button>",
        );
        expect(errorPrimaryAction).toContain('size="default"');
        expect(errorGhostAction).toContain('size="default"');
        expect(error).toContain("onClick={reset}");
        for (const source of [notFound, error]) {
            expect(source).toContain('from "../../route-chrome";');
            expect(source).toContain("<RouteFallbackChrome");
            expect(source).toContain('workspaceVariant="single"');
            expect(source).toContain("<RouteFallbackEmptyState");
            expect(source).not.toContain(
                'variant="recordingRoutePrimaryAction"',
            );
            expect(source).not.toContain('variant="recordingRouteGhostAction"');
            expect(source).not.toContain('size="recordingRouteAction"');
            expect(source).not.toContain("recordingRouteFallbackClassNames");
            expect(source).not.toContain("routeChromeStyles");
            expect(source).not.toContain("route-chrome.module.css");
            expect(source).not.toContain('data-detail-empty=""');
        }
        expect(notFound).toContain('dataSotShell="recording-route-empty"');
        expect(notFound).toContain('current="录音不存在或已删除"');
        expect(error).toContain('dataSotShell="recording-route-error"');
        expect(error).toContain('current="录音详情加载失败"');
        expect(routeChrome).toContain('from "@/components/ui/empty";');
        expect(routeChrome).toContain(
            'import { Card } from "@/components/ui/card";',
        );
        expect(routeChrome).toContain("function RouteFallbackEmptyState");
        expect(routeChrome).toContain(
            'data-sot-panel="recording-route-empty-detail"',
        );
        expect(routeChrome).toContain('data-sot-panel="recording-route-empty"');
        expect(routeChrome).toContain("<Card");
        expect(routeChrome).toContain("<Empty");
        expect(routeFallbackEmptyClassNames).toContain(
            "routeFallbackSurfaceClassName",
        );
        expect(routeFallbackSurfaceClassName).toContain("bg-card");
        expect(routeFallbackSurfaceClassName).toContain("border-border");
        for (const semanticToken of [
            "border-border",
            "bg-muted",
            "text-muted-foreground",
            "text-foreground",
        ]) {
            expect(routeFallbackEmptyClassNames).toContain(semanticToken);
        }
        expect(routeFallbackEmptyClassNames).not.toMatch(
            /var\(--|dark:|bg-\[var|border-\[var|text-\[var/,
        );
    });

    it("keeps recording route loading skeleton sizing route-local and off the Skeleton primitive", () => {
        const dashboardLoading = readSource("app/(app)/dashboard/loading.tsx");
        const recordingLoading = readSource(
            "app/(app)/recordings/[id]/loading.tsx",
        );
        const cardPrimitive = readSource("components/ui/card.tsx");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const globals = readSource("app/globals.css");
        const routeChrome = readSource("app/(app)/route-chrome.tsx");
        const routeChromeModule = readSource(
            "app/(app)/route-chrome.module.css",
        );
        const recordingListLoadingClassNameTokens = [
            "recordingListLoadingDayLabelClassName",
            "recordingListLoadingTitleClassName",
            "recordingListLoadingTitle80ClassName",
            "recordingListLoadingMetaTimeClassName",
            "recordingListLoadingMetaTagClassName",
            "recordingListLoadingMetaPillClassName",
            "recordingListLoadingTagClassName",
        ];
        const recordingDetailLoadingSizeTokens = [
            "recordingDetailLoadingAvatar",
            "recordingDetailLoadingBar",
            "recordingDetailLoadingBar60",
            "recordingDetailLoadingBar90",
        ];
        const routeLoadingSizeTokens = [
            ...recordingListLoadingClassNameTokens,
            ...recordingDetailLoadingSizeTokens,
        ];
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
            dashboardLoading,
            "const dashboardRouteLoadingListClassName =",
            ";",
        );
        const recordingDetailLoadingSkeletonClassNames = extractBoundedSlice(
            routeChrome,
            "const recordingDetailLoadingSkeletonClassNames =",
            "} as const;",
        );
        const dashboardLoadingShellOpening = extractOpeningElement(
            dashboardLoading,
            'dataSotShell="dashboard-loading"',
            "RouteFallbackChrome",
        );
        const dashboardLoadingListCard = extractCardSlice(
            dashboardLoading,
            'data-sot-panel="dashboard-loading-list"',
        );
        const dashboardLoadingListCardOpening = extractOpeningElement(
            dashboardLoading,
            'data-sot-panel="dashboard-loading-list"',
            "Card",
        );
        const routeFallbackDetailLoadingCard = extractCardSlice(
            routeChrome,
            "data-sot-panel={dataSotPanel}",
        );
        const routeFallbackDetailLoadingCardOpening = extractOpeningElement(
            routeChrome,
            "data-sot-panel={dataSotPanel}",
            "Card",
        );
        const dashboardLoadingDetailFallback = extractSelfClosingElement(
            dashboardLoading,
            'data-sot-panel="dashboard-loading-detail"',
            "RouteFallbackDetailLoadingSkeleton",
        );
        const recordingRouteLoadingDetailFallback = extractSelfClosingElement(
            recordingLoading,
            'data-sot-panel="recording-route-loading-detail"',
            "RouteFallbackDetailLoadingSkeleton",
        );

        expect(routeFallbackSurfaceClassName).toContain(
            `"${ROUTE_LOADING_SURFACE_CLASS_VALUE}"`,
        );
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
        expect(recordingDetailLoadingSkeletonClassNames).toContain(
            "recordingDetailLoadingAvatar:",
        );
        expect(recordingDetailLoadingSkeletonClassNames).toContain(
            "recordingDetailLoadingBar:",
        );
        expect(dashboardLoadingShellOpening).toContain(
            'dataSotShell="dashboard-loading"',
        );
        expect(recordingLoading).toContain(
            'dataSotShell="recording-route-loading"',
        );
        expect(recordingLoading).toContain('workspaceVariant="single"');
        for (const [label, card] of [
            ["dashboard-loading-list", dashboardLoadingListCard],
            ["dashboard-loading-detail", routeFallbackDetailLoadingCard],
            ["recording-route-loading-detail", routeFallbackDetailLoadingCard],
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
        expect(dashboardLoadingDetailFallback).toContain(
            'data-sot-panel="dashboard-loading-detail"',
        );
        expect(recordingRouteLoadingDetailFallback).toContain(
            'data-sot-panel="recording-route-loading-detail"',
        );

        for (const loading of [dashboardLoading, recordingLoading]) {
            expect(loading).not.toContain('variant="routeLoadingSurface"');
            expect(loading).toContain("<RouteFallbackDetailLoadingSkeleton");
            for (const sizeToken of recordingDetailLoadingSizeTokens) {
                expect(loading).not.toContain(`size="${sizeToken}"`);
                expect(loading).not.toContain(`${sizeToken}:`);
            }
        }
        expect(dashboardLoading).toContain(
            'import { Card } from "@/components/ui/card";',
        );
        expect(dashboardLoading).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(recordingLoading).not.toContain(
            'import { Card } from "@/components/ui/card";',
        );
        expect(recordingLoading).not.toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(routeChrome).toContain('aria-hidden="true"');
        expect(routeChrome).toContain("<Skeleton");
        expect(routeChrome).toContain(
            'data-sot-panel="recording-detail-loading"',
        );
        expect(routeChrome).toContain('data-sot-part="detail-player-meta"');
        expect(routeChrome).toContain('data-sot-part="detail-player-controls"');
        expect(routeChrome).toContain('data-sot-part="detail-transcript-head"');
        expect(routeChrome).toContain('data-sot-part="detail-transcript"');
        expect(routeChrome).toContain(
            "const recordingDetailLoadingSkeletonClassNames",
        );
        for (const sizeToken of recordingDetailLoadingSizeTokens) {
            expect(routeChrome).toContain(`${sizeToken}:`);
            expect(routeChrome).toContain(
                `recordingDetailLoadingSkeletonClassNames.${sizeToken}`,
            );
            expect(routeChrome).not.toContain(`size="${sizeToken}"`);
        }
        const routeChromeSkeletonOpenings = collectOpeningElements(
            routeChrome,
            "Skeleton",
        );
        expect(routeChromeSkeletonOpenings.length).toBeGreaterThan(0);
        for (const skeletonOpening of routeChromeSkeletonOpenings) {
            expect(skeletonOpening).toContain('variant="default"');
            expect(skeletonOpening).toContain('size="default"');
            expect(skeletonOpening).toContain("className={");
        }
        expect(dashboardLoading).toContain(
            'data-sot-panel="recording-list-loading"',
        );
        expect(dashboardLoading).not.toContain(
            "const recordingListLoadingSkeletonClassNames",
        );
        for (const classNameToken of recordingListLoadingClassNameTokens) {
            expect(dashboardLoading).toContain(`const ${classNameToken} =`);
            expect(
                (dashboardLoading.match(new RegExp(classNameToken, "g")) ?? [])
                    .length,
            ).toBeGreaterThanOrEqual(2);
            expect(dashboardLoading).not.toContain(`size="${classNameToken}"`);
        }
        expect(recordingLoading).toContain(
            'data-sot-panel="recording-route-loading-detail"',
        );
        expect(cardPrimitive).not.toContain("routeLoadingSurface");
        for (const sizeToken of routeLoadingSizeTokens) {
            expect(skeletonPrimitive).not.toContain(sizeToken);
        }
        expect(dashboardLoading).toContain('from "../route-chrome";');
        for (const routeSource of [dashboardLoading, recordingLoading]) {
            expect(routeSource).toContain("RouteFallbackChrome");
            expect(routeSource).toContain("RouteFallbackDetailLoadingSkeleton");
            expect(routeSource).not.toContain("routeChromeStyles");
            expect(routeSource).not.toContain("route-chrome.module.css");
        }
        expect(dashboardLoading).toContain("routeFallbackSurfaceClassName");
        expect(recordingLoading).not.toContain("routeFallbackSurfaceClassName");
        expect(routeChrome).toContain('data-sot-panel="route-workspace"');
        expect(routeChrome).toContain('data-sot-panel="route-sidebar"');
        expect(routeChrome).toContain('data-sot-panel="route-main"');
        expect(routeChrome).toContain('data-sot-panel="route-topbar"');
        expect(routeChromeModule.trim()).toBe("");
        expect(routeChromeModule).not.toMatch(
            ROUTE_CHROME_FORBIDDEN_FRAMEWORK_RE,
        );
        for (const selector of ROUTE_CHROME_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of RECORDING_LOADING_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_LOADING_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of RECORDING_ROUTE_FALLBACK_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
    });

    it("classifies non-token modern CSS colors without fallback-only leakage", () => {
        const globals = readSource("app/globals.css");
        const findings = collectGlobalColorFallbackFindings(globals);

        expect(findings.tokenModernColorDeclarations.length).toBeGreaterThan(0);
        expect(findings.nonTokenSupportedPathDeclarations).toEqual([]);
        expect(findings.fallbackOnlyModernColorDeclarations).toEqual([]);
        expect(findings.unexpectedSupportedPathDeclarations).toEqual([]);
        expect(findings.unsafeVarFallbackArguments).toEqual([]);
    });

    it("keeps component-library showcase chrome out of runtime globals", () => {
        const globals = readSource("app/globals.css");

        expectNoComponentLibraryShowcaseGlobals(globals);
    });

    it("keeps recording tag manager legacy selectors out of product CSS", () => {
        const globals = readSource("app/globals.css");
        const recordingTagVisuals = readSource(
            "features/recordings/components/recording-tag-visuals.tsx",
        );
        const legacyTagManagerSelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                /^\s*\.(?:tagm-|tag-chip-)|,\s*\.(?:tagm-|tag-chip-)|^\s*\.tg-pick|,\s*\.tg-pick/.test(
                    text,
                ),
            );

        expect(legacyTagManagerSelectorLines).toEqual([]);
        expect(recordingTagVisuals).not.toContain(
            "recordingTagSotColorClassName",
        );
        expect(recordingTagVisuals).not.toMatch(
            /\bc-(?:rose|amber|emerald|blue|violet|slate)\b/,
        );
        expect(recordingTagVisuals).not.toContain('"tg-ico"');
    });

    it("keeps dashboard transcript, source report, retx, and activity legacy selectors out of product CSS", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .filter((line) =>
                DASHBOARD_TRANSCRIPT_SOURCE_REPORT_RETX_ACTIVITY_LEGACY_CSS_SELECTOR_RE.test(
                    line,
                ),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DASHBOARD_RETRANSCRIPTION_REMOVED_GLOBAL_DISPLAY_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_TRANSCRIPT_SPEAKER_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_TRANSCRIPT_EMPTY_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-part="dashboard-retranscription-spinner"]',
            ),
        ).toEqual([]);
        expect(
            collectExactCssRuleBlocks(globals, "[data-sot-source-report-pane]"),
        ).toEqual([]);
        for (const selector of RECORDING_LOADING_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
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
    });

    it("keeps dashboard recording-list replacement hooks out of legacy JSX className selectors", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");

        for (const hook of DASHBOARD_RECORDING_LIST_REPLACEMENT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const className of DASHBOARD_RECORDING_LIST_REPLACED_LEGACY_CLASSES) {
            expect(workstation).not.toMatch(
                new RegExp(`className=\\{?["']${className}["']\\}?`),
            );
        }
        expect(workstation).toContain("<Button");
        expect(workstation).toContain("data-tag-filter-trigger");
        expect(workstation).toContain("data-tag-filter-list");
        expect(workstation).toContain("data-page-prev");
        expect(workstation).toContain("data-page-next");
        expect(workstation).toContain("data-list-state-block");
    });

    it("keeps dashboard sidebar footer and list residuals owner-local", () => {
        const globals = readSource("app/globals.css");
        const workstation = readSource("features/dashboard/workstation.tsx");
        const featureOwnerClassSource =
            collectFeatureOwnerClassSource(workstation);
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_RECORDING_LIST_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(
                    text,
                ),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of MOBILE_OWNER_LAYOUT_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_WORKSPACE_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_SIDEBAR_FOOTER_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_RECORDING_LIST_RESIDUAL_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const ownerClassRef of DASHBOARD_RECORDING_LIST_RESIDUAL_OWNER_CLASS_REFS) {
            expect(workstation).toContain(ownerClassRef);
        }
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
        for (const ownerClassToken of [
            "flex items-center gap-2.5",
            "m-0 font-sans text-[13px] font-semibold text-foreground",
            "ml-auto font-mono text-[11.5px] font-medium text-muted-foreground",
            "[scrollbar-width:thin]",
            "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/55",
            "flex-1 overflow-y-auto p-1",
            'root: "m-2"',
            'content: "mt-2"',
            "relative mt-1.5 mb-[14px] h-px",
        ]) {
            expect(featureOwnerClassSource).toContain(ownerClassToken);
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
        expect(globals).not.toMatch(
            DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_RE,
        );
        for (const selector of DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
    });

    it("keeps dashboard global state on the runtime root without body bridges", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const globals = readSource("app/globals.css");
        const productCss = readProductCss(globals);
        const bodyDatasetKeys = [
            ...new Set(
                [
                    ...workstation.matchAll(
                        /document\.body\.dataset\.([A-Za-z0-9_]+)/g,
                    ),
                ]
                    .map(([, key]) => key)
                    .sort(),
            ),
        ];
        const sidebarBridgeBlocks = collectCssRuleBlocks(
            productCss,
            '[data-sidebar="collapsed"]',
        ).filter(({ prelude }) =>
            /dashboard-(?:workstation|sidebar|brand|sync)|sidebar-collapse/.test(
                prelude,
            ),
        );
        const bodyDrawerBridgeBlocks = collectCssRuleBlocks(
            productCss,
            'body[data-drawer="open"]',
        );
        const bodySourceFilterBridgeBlocks = collectCssRuleBlocks(
            productCss,
            "body[data-source-filter]",
        );

        expect(workstation).toContain(
            'data-sidebar-collapsed={\n                dashboardSidebarCollapsed ? "true" : "false"\n            }',
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
        expect(bodyDatasetKeys).toEqual([]);
        expect(workstation).not.toMatch(
            /document\.body\.dataset\.(?:drawer|sourceFilter|sourceStatus|timeStyle|sidebar|collapsed)\b/,
        );
        expect(productCss).not.toContain(
            '[data-sot-shell="dashboard-workstation"][data-sidebar-collapsed="true"]',
        );
        expect(productCss).not.toContain(
            '[data-sot-shell="dashboard-workstation"][data-sidebar-collapsed="true"]\n    [data-sot-panel="dashboard-sidebar"]',
        );
        expect(productCss).not.toContain('[data-sidebar="collapsed"]');
        expect(productCss).not.toContain("body[data-source-filter]");
        expect(productCss).not.toContain('body[data-drawer="open"]');
        expect(productCss).not.toContain("Migrated from index.html");
        expect(sidebarBridgeBlocks).toEqual([]);
        expect(bodyDrawerBridgeBlocks).toEqual([]);
        expect(bodySourceFilterBridgeBlocks).toEqual([]);
        for (const selector of DASHBOARD_SIDEBAR_VISUAL_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(productCss, selector)).toEqual([]);
        }
        expect(productCss).not.toContain(
            '[data-theme="dark"] [data-sot-panel="dashboard-sidebar"],\n.dark [data-sot-panel="dashboard-sidebar"]',
        );
        const dashboardSidebarGlobalBlocks = collectCssRuleBlocks(
            productCss,
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
        expect(productCss).not.toContain(
            '[data-sot-panel="dashboard-sidebar"],\n[data-sot-panel="workstation-sidebar"]',
        );
        expect(productCss).not.toContain(
            '[data-sot-panel="workstation-sidebar"] {\n    background:',
        );
        expect(productCss).not.toContain(
            '[data-theme="dark"] [data-sot-panel="workstation-sidebar"]',
        );
        expect(productCss).not.toContain(
            '.dark [data-sot-panel="workstation-sidebar"]',
        );
        expect(productCss).not.toContain(
            '[data-sot-panel="workstation-sidebar"]',
        );
        expect(
            collectCssRuleBlocks(
                productCss,
                '[data-sot-panel="workstation-sidebar"]',
            ),
        ).toEqual([]);
        expect(productCss).not.toContain(
            '[data-sot-panel="dashboard-sidebar"],\n    [data-sot-panel="workstation-sidebar"] {\n        display: none;',
        );
        const sidebarCollapseClassNames = extractBoundedSlice(
            workstation,
            "const dashboardSidebarCollapseClassNames = {",
            "} as const;",
        );
        for (const ownerClassSnippet of [
            "group-data-[sidebar-collapsed=true]/dashboard-workstation:px-1.5",
            "group-data-[sidebar-collapsed=true]/dashboard-workstation:hidden",
            "group-data-[sidebar-collapsed=true]/dashboard-workstation:justify-center",
            "group-data-[sidebar-collapsed=true]/dashboard-workstation:gap-0",
            "max-[860px]:hidden",
            "max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:flex",
            "max-[860px]:group-data-[drawer-state=open]/dashboard-workstation:max-w-[min(320px,calc(100vw-32px))]",
        ]) {
            expect(sidebarCollapseClassNames).toContain(ownerClassSnippet);
        }
        for (const ownerClassSnippet of DASHBOARD_SIDEBAR_OWNER_CLASS_TOKENS) {
            expect(sidebarCollapseClassNames).toContain(ownerClassSnippet);
        }
        expect(sidebarCollapseClassNames).not.toMatch(
            DASHBOARD_SIDEBAR_FORBIDDEN_CLASS_PATTERN,
        );
        const drawerTriggerClassNames = extractObjectStringProperty(
            extractBoundedSlice(
                workstation,
                "const dashboardButtonClassNames = {",
                "} as const;",
            ),
            "drawerTrigger",
        );
        const sidebarCollapseButtonClassNames = extractObjectStringProperty(
            extractBoundedSlice(
                workstation,
                "const dashboardButtonClassNames = {",
                "} as const;",
            ),
            "sidebarCollapse",
        );
        const drawerScrim = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-drawer-scrim"',
            "div",
        );
        const drawerActiveDot = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-drawer-active-dot"',
            "span",
        );
        const drawerTrigger = extractElementSlice(
            workstation,
            'data-sot-control="dashboard-drawer-trigger"',
            "Button",
        );
        const dashboardDrawerClassNames = extractBoundedSlice(
            workstation,
            "const dashboardDrawerClassNames = {",
            "} as const;",
        );
        expect(drawerTriggerClassNames).toContain("relative hidden");
        expect(drawerTriggerClassNames).toContain("max-[860px]:inline-flex");
        expect(drawerTriggerClassNames).toContain(
            "group-data-[source-filter-active=true]/dashboard-workstation:[&_[data-sot-part=dashboard-drawer-active-dot]]:inline-block",
        );
        expect(sidebarCollapseButtonClassNames).toContain("max-[860px]:hidden");
        expect(
            extractObjectStringProperty(dashboardDrawerClassNames, "scrim"),
        ).toContain(`"${EXPECTED_DASHBOARD_DRAWER_SCRIM_CLASS_NAME}"`);
        expect(
            extractObjectStringProperty(dashboardDrawerClassNames, "scrim"),
        ).not.toContain("z-[var(--z-drawer-scrim)]");
        expect(dashboardDrawerClassNames).not.toContain("menuIcon");
        expect(
            extractObjectStringProperty(dashboardDrawerClassNames, "activeDot"),
        ).toContain(`"${EXPECTED_DASHBOARD_DRAWER_ACTIVE_DOT_CLASS_NAME}"`);
        expectClassNameConstReference(
            drawerScrim,
            "dashboardDrawerClassNames.scrim",
        );
        expect(drawerTrigger).toContain("<Menu");
        expect(drawerTrigger).toContain('data-icon="inline-start"');
        expect(drawerTrigger).not.toContain(
            "dashboardDrawerClassNames.menuIcon",
        );
        expectClassNameConstReference(
            drawerActiveDot,
            "dashboardDrawerClassNames.activeDot",
        );
        expect(workstation).toContain(
            "dashboardSidebarCollapseClassNames.sidebar",
        );
        expect(workstation).toContain(
            "dashboardSidebarCollapseClassNames.hidden",
        );
        expect(workstation).toContain(
            "dashboardSidebarCollapseClassNames.brand",
        );
        expect(workstation).toContain(
            "dashboardSidebarCollapseClassNames.favorite",
        );
        expect(workstation).not.toContain("dashboardSyncClassNames");
        expect(productCss).not.toContain(
            'Desktop sidebar-collapsed — bridge body[data-sidebar="collapsed"]',
        );
    });

    it("keeps library search product CSS feature-owned and out of globals", () => {
        const globals = readSource("app/globals.css");
        const productCss = readProductCss(globals);
        const legacySelectorLines = productCss
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                LIBRARY_SEARCH_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        expect(productCss).toContain("@keyframes sbn-sweep");
        for (const selector of MIGRATED_LIBRARY_SEARCH_DATA_SOT_CSS_SELECTORS) {
            expect(productCss).not.toContain(selector);
        }
        for (const selector of LIBRARY_SEARCH_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(productCss).not.toContain(selector);
        }
    });

    it("keeps dashboard topbar owner-local while source-provider atoms are primitive-owned", () => {
        const globals = readSource("app/globals.css");
        const productCss = readProductCss(globals);
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_TOPBAR_SOURCE_STATUS_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(
                    text,
                ),
            );

        expect(legacySelectorLines).toEqual([]);
        expect(productCss).not.toMatch(TOPBAR_LEGACY_PRODUCT_CSS_SELECTOR_RE);
        for (const selector of DASHBOARD_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS) {
            expect(productCss).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_SOURCE_PROVIDER_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
    });

    it("does not keep the retired liquid tabs CSS framework", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                LIQUID_TABS_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of RETIRED_LIQUID_TABS_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(globals).not.toContain('[data-tabs="');
        expect(globals).not.toContain('[data-idx="');
    });

    it("keeps system banner shared primitives free of feature business tokens", () => {
        const globals = readSource("app/globals.css");
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const progressPrimitive = readSource("components/ui/progress.tsx");
        const banner = readSource(
            "features/dashboard/components/system-banner.tsx",
        );
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                SYSTEM_BANNER_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of RETIRED_SYSTEM_BANNER_DATA_SOT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(globals).toContain(
            '[data-sot-panel="system-banner"] + [data-sot-panel="system-banner"]',
        );
        expect(globals).toContain("@keyframes sbn-sweep");
        expect(
            collectCssRuleBlocks(globals, '[data-sot-panel="system-banner"]')
                .map(({ prelude }) => prelude.trim())
                .filter(
                    (prelude) => prelude === '[data-sot-panel="system-banner"]',
                ),
        ).toEqual([]);
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-panel="system-banner"]',
            ).filter(({ prelude }) => prelude.includes('[data-slot="button"]')),
        ).toEqual([]);
        expect(globals).not.toContain(
            '[data-sot-panel="system-banner"] [data-slot="button"]',
        );
        for (const token of SYSTEM_BANNER_ALERT_PRIMITIVE_RETIRED_TOKENS) {
            expect(alertPrimitive).not.toContain(token);
        }
        for (const token of SYSTEM_BANNER_BUTTON_PRIMITIVE_RETIRED_TOKENS) {
            expect(buttonPrimitive).not.toContain(token);
        }
        for (const token of SYSTEM_BANNER_PROGRESS_PRIMITIVE_RETIRED_TOKENS) {
            expect(progressPrimitive).not.toContain(token);
        }
        for (const token of SYSTEM_BANNER_FEATURE_LOCAL_TOKENS) {
            expect(banner).toContain(token);
        }
        for (const token of SYSTEM_BANNER_FEATURE_LOCAL_VISUAL_REBUILD_TOKENS) {
            expect(banner).not.toContain(token);
        }
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
    });

    it("composes system banners with shadcn Alert, Button, and Progress primitives", () => {
        const banner = readSource(
            "features/dashboard/components/system-banner.tsx",
        );

        expect(banner).toContain(
            'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
        );
        expect(banner).toContain(
            'import { Button, type ButtonProps } from "@/components/ui/button";',
        );
        expect(banner).toContain(
            'import { Progress } from "@/components/ui/progress";',
        );
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
        expect(banner).toContain("function SystemBannerAlert");
        expect(banner).toContain("function SystemBannerButton");
        expect(banner).toContain("function SystemBannerProgress");
        expect(banner).not.toContain("[--system-banner");
        expect(banner).not.toContain("border-[var(--system-banner-border)]");
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
        for (const token of SYSTEM_BANNER_FEATURE_LOCAL_VISUAL_REBUILD_TOKENS) {
            expect(banner).not.toContain(token);
        }
        expect(banner).toMatch(/<Alert[\s\S]*data-sot-panel="system-banner"/);
        expect(banner).not.toContain('variant="systemBanner"');
        expect(banner).not.toContain('density="systemBanner"');
        expect(banner).not.toContain('layout="systemBanner"');
        expect(banner).toContain("<AlertTitle");
        expect(banner).toContain("<AlertDescription");
        expect(banner).toContain("</Alert>");
        expect(banner).toContain("<Button");
        expect(banner).toContain("<Progress");
        expect(banner).toContain("value={progress ?? 0}");
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
        expect(banner).not.toMatch(
            /<div[\s\S]*data-sot-part="system-banner-progress"/,
        );
        expect(banner).not.toContain(
            '<span data-sot-part="system-banner-progress-bar" />',
        );
        expect(banner).not.toContain(
            'className={cn("flex items-center gap-3 px-3.5 py-2.5", className)}',
        );
        expect(banner).not.toContain("systemBannerButtonVariants");
        expect(banner).not.toMatch(/<section[\s>]/);
        expect(banner).not.toContain('data-slot="system-banner"');
        expect(banner).toMatch(
            /<X\s+data-icon="inline-start"\s+aria-hidden="true"\s*\/>/,
        );
        expect(banner).not.toContain("CloseIcon");
    });

    it("keeps more actions menu styling owned by DropdownMenu primitives", () => {
        const globals = readSource("app/globals.css");
        const dropdownMenu = readSource("components/ui/dropdown-menu.tsx");
        const dashboardWorkstation = readSource(
            "features/dashboard/workstation.tsx",
        );
        const recordingDetailWorkstation = readSource(
            "features/recordings/workstation.tsx",
        );
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                MORE_ACTIONS_MENU_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of MORE_ACTIONS_MENU_RETIRED_DATA_SOT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const primitivePattern of MORE_ACTIONS_MENU_PRIMITIVE_FORBIDDEN_PATTERNS) {
            expect(dropdownMenu).not.toMatch(primitivePattern);
        }
        expect(dropdownMenu).toContain(
            "data-[variant=destructive]:[&_svg:not([class*='text-'])]:text-destructive",
        );
        expect(dropdownMenu).not.toContain("text-destructive!");
        for (const compositionToken of MORE_ACTIONS_MENU_COMPOSITION_TOKENS) {
            expect(dashboardWorkstation).toContain(compositionToken);
            expect(recordingDetailWorkstation).toContain(compositionToken);
        }
    });

    it("keeps shared scrollbars owner-local on dashboard scroll surfaces", () => {
        const globals = readSource("app/globals.css");
        const workstation = readSource("features/dashboard/workstation.tsx");
        const settingsDialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                SOT_SCROLLBAR_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of SOT_SCROLLBAR_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(workstation).not.toContain(
            "const dashboardScrollbarClassName =",
        );
        expect(workstation).toContain("[scrollbar-width:thin]");
        expect(workstation).toContain("dashboardRecordingListScrollClassName");
        expect(workstation).toContain(
            'data-sot-list="dashboard-recording-list-scroll"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-transcript-body"',
        );
        expect(workstation).not.toContain("dashboardScrollbarClassName,");
        expect(globals).not.toContain(
            '[data-sot-panel="settings-body"]::-webkit-scrollbar',
        );
        expect(globals).not.toContain(
            '[data-sot-panel="settings-body"]::-webkit-scrollbar-thumb:hover',
        );
        expect(settingsDialog).toContain("const SETTINGS_RAIL_CLASS =");
        expect(settingsDialog).toContain("overflow-y-auto");
        expect(settingsDialog).toContain("[overscroll-behavior:contain]");
    });

    it("keeps tab pane hidden handling owned by dashboard panes", () => {
        const globals = readSource("app/globals.css");
        const workstation = readSource("features/dashboard/workstation.tsx");
        const sourceReportPrimitives = readSource(
            "features/source-report/primitives.tsx",
        );
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                TAB_PANE_HIDDEN_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of TAB_PANE_HIDDEN_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
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
        const sourceReportPane = extractOpeningElement(
            sourceReportPrimitives,
            "data-testid={testId}",
            "div",
        );
        expect(sourceReportPane).toContain("className={commonClassName}");
        expect(sourceReportPane).toContain("data-state={state}");
        expect(sourceReportPane).toContain("hidden={hidden}");
        const sourceReportPaneCall = extractOpeningElement(
            workstation,
            'surface="dashboard"',
            "SourceReportPane",
        );
        expect(sourceReportPaneCall).toContain(
            "dashboardTabPaneHiddenClassName",
        );
        expect(sourceReportPaneCall).toContain(
            "state={sourceReportVisualState}",
        );
        const speakersPane = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-speakers-pane"',
            "div",
        );
        expect(speakersPane).toContain(
            "className={dashboardTabPaneHiddenClassName}",
        );
    });

    it("keeps dashboard time filter presentation and hidden state owner-local", () => {
        const globals = readSource("app/globals.css");
        const workstation = readSource("features/dashboard/workstation.tsx");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_TIME_FILTER_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DASHBOARD_TIME_FILTER_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of DASHBOARD_TIME_FILTER_RETIRED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of DASHBOARD_TIME_FILTER_PRIMITIVE_REPAINT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(workstation).toContain(
            "const dashboardRecordingTimeFilterStyles = {",
        );
        const recordingTimeFilterStyles = extractBoundedSlice(
            workstation,
            "const dashboardRecordingTimeFilterStyles = {",
            "} as const;",
        );
        expect(recordingTimeFilterStyles).toContain(
            'root: "mt-2.5 flex-wrap [&[hidden]]:hidden"',
        );
        expect(workstation).toContain(
            "function dashboardRecordingTimeFilterCountClassName(active: boolean)",
        );
        expect(workstation).toContain('hidden={listMode !== "timeline"}');
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-time-filter-count"',
        );
    });

    it("keeps copy icon product CSS scoped to data-sot hooks", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                COPY_ICON_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of COPY_ICON_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }

        const globalCopyButtonAppearanceRules = collectCssRuleBlocks(
            stripCssComments(globals),
            '[data-slot="button"][data-copy]',
        ).filter(({ declarations }) =>
            COPY_BUTTON_GLOBAL_APPEARANCE_PROPERTIES.some((property) =>
                new RegExp(`(^|;)\\s*${property}\\s*:`, "m").test(declarations),
            ),
        );

        expect(globalCopyButtonAppearanceRules).toEqual([]);
    });

    it("keeps dashboard transcript actions off lang-pill CSS selectors", () => {
        const globals = readSource("app/globals.css");
        const workstation = readSource("features/dashboard/workstation.tsx");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_TRANSCRIPT_ACTIONS_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(
                    text,
                ),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DASHBOARD_TRANSCRIPT_ACTIONS_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const hook of DASHBOARD_TRANSCRIPT_ACTIONS_DATA_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        expect(workstation).not.toContain('className="lang-pill"');
    });

    it("keeps detail empty product CSS on data-sot selectors", () => {
        const globals = readSource("app/globals.css");
        const legacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DETAIL_EMPTY_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(legacySelectorLines).toEqual([]);
        for (const selector of DETAIL_EMPTY_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
    });

    it("uses shadcn Empty for dashboard empty states without product repaint CSS", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const globals = readSource("app/globals.css");

        expect(workstation).toContain('from "@/components/ui/empty";');
        for (const primitive of [
            "Empty,",
            "EmptyDescription,",
            "EmptyHeader,",
            "EmptyMedia,",
            "EmptyTitle,",
        ]) {
            expect(workstation).toContain(primitive);
        }

        const detailEmpty = extractElementSlice(
            workstation,
            'data-sot-panel="dashboard-detail-empty"',
            "Empty",
        );
        const activityEmpty = extractElementSlice(
            workstation,
            'data-sot-part="dashboard-activity-empty"',
            "Empty",
        );
        const transcriptEmpty = extractElementSlice(
            workstation,
            'data-sot-panel="dashboard-transcript-empty"',
            "Empty",
        );

        expect(detailEmpty).toContain("<Empty");
        expect(detailEmpty).toContain('data-detail-empty=""');
        expect(detailEmpty).toContain(
            'data-sot-panel="dashboard-detail-empty"',
        );
        const detailEmptyClassName = expectExactStringConstInitializer(
            workstation,
            "DASHBOARD_DETAIL_EMPTY_STATE_CLASS_NAME",
            EXPECTED_DASHBOARD_DETAIL_EMPTY_STATE_CLASS_NAME,
        );
        const detailEmptyOpening = extractOpeningElement(
            detailEmpty,
            'data-sot-panel="dashboard-detail-empty"',
            "Empty",
        );
        expectClassNameConstReference(
            detailEmptyOpening,
            "DASHBOARD_DETAIL_EMPTY_STATE_CLASS_NAME",
        );
        expect(detailEmptyClassName).not.toMatch(
            OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
        );
        expect(detailEmpty).toContain("<EmptyHeader>");
        expect(detailEmpty).toContain("<EmptyMedia");
        expect(detailEmpty).toContain('variant="icon"');
        expect(detailEmpty).toContain(
            'data-sot-part="dashboard-detail-empty-icon"',
        );
        expect(detailEmpty).toContain("<SotDetailEmptyIcon />");
        expect(detailEmpty).toContain(
            '<EmptyTitle data-sot-part="dashboard-detail-empty-title">',
        );
        expect(detailEmpty).toContain(
            '<EmptyDescription data-sot-part="dashboard-detail-empty-description">',
        );
        expect(detailEmpty).not.toContain("<div");
        expect(detailEmpty).not.toContain("<p");

        expect(activityEmpty).toContain("<Empty");
        expect(activityEmpty).toContain(
            'data-sot-part="dashboard-activity-empty"',
        );
        expect(activityEmpty).toContain(
            "dashboardSearchActivityClassNames.dashboardActivityEmpty",
        );
        expect(activityEmpty).toContain("<EmptyHeader>");
        expect(activityEmpty).toContain("<EmptyMedia");
        expect(activityEmpty).toContain('variant="icon"');
        expect(activityEmpty).toContain(
            'data-sot-part="dashboard-activity-empty-icon"',
        );
        expect(activityEmpty).toContain("<CheckCircle />");
        expect(activityEmpty).toContain(
            '<EmptyTitle data-sot-part="dashboard-activity-empty-title">',
        );
        expect(activityEmpty).toContain(
            '<EmptyDescription data-sot-part="dashboard-activity-empty-body">',
        );
        expect(activityEmpty).not.toContain("<div");
        expect(activityEmpty).not.toContain("<p");

        expect(transcriptEmpty).toContain("<Empty");
        expect(transcriptEmpty).toContain(
            'data-sot-panel="dashboard-transcript-empty"',
        );
        expect(transcriptEmpty).toContain('variant="compact"');
        expect(transcriptEmpty).toContain("<EmptyHeader");
        expect(transcriptEmpty).toContain("<EmptyMedia");
        expect(transcriptEmpty).toContain('variant="icon"');
        expect(transcriptEmpty).toContain(
            'data-sot-part="dashboard-transcript-empty-icon"',
        );
        expect(transcriptEmpty).toContain("<SotTranscriptEmptyIcon />");
        expect(transcriptEmpty).toContain(
            'data-sot-part="dashboard-transcript-empty-message"',
        );
        expect(transcriptEmpty).toContain('variant="compact"');
        expect(transcriptEmpty).toContain(
            'data-sot-part="dashboard-transcript-empty-sub"',
        );
        expect(transcriptEmpty).not.toContain("dashboardTranscriptClassNames");
        expect(transcriptEmpty).not.toContain("<div");
        expect(transcriptEmpty).not.toContain("<p");

        for (const selector of DASHBOARD_EMPTY_PRIMITIVE_CSS_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_TRANSCRIPT_EMPTY_REMOVED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).toContain("[data-detail-empty]");
        expect(globals).toContain("[data-detail-empty][hidden]");
        expect(globals).not.toContain(
            '[data-sot-part="dashboard-activity-empty"][hidden]',
        );
        expect(globals).toContain(
            '[data-sot-panel="dashboard-detail"][data-empty="true"] [data-detail-empty]',
        );
    });

    it("keeps AI rename preview legacy selectors out of product CSS", () => {
        const globals = readSource("app/globals.css");
        const legacyAiRenameSelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                /^\s*\.ai-rename-panel|,\s*\.ai-rename-panel|^\s*\.airp-|,\s*\.airp-/.test(
                    text,
                ),
            );

        expect(legacyAiRenameSelectorLines).toEqual([]);

        for (const selector of AI_RENAME_PREVIEW_FUNCTIONAL_CSS_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }

        for (const selector of AI_RENAME_PREVIEW_VISUAL_REPAINT_CSS_SELECTORS) {
            const retainedBlocks = collectCssRuleBlocks(globals, selector);

            expect(retainedBlocks).toEqual([]);
        }
    });

    it("keeps AI rename legacy tokens out of product source", () => {
        const productRoots = ["app", "components", "features", "lib"];
        const findings = productRoots.flatMap((root) =>
            collectSourceFiles(path.join(ROOT, root)).flatMap((filePath) => {
                const source = readFileSync(filePath, "utf8");
                const relativePath = path.relative(ROOT, filePath);
                return source
                    .split("\n")
                    .map((text, index) => ({
                        line: index + 1,
                        path: relativePath,
                        text,
                    }))
                    .filter(({ text }) =>
                        /\.ai-rename-panel|\.airp-|airp-|data-airp-|\bAI_RENAME_[A-Z0-9_]+_CLASS\b|--ai-rename-[\w-]+/.test(
                            text,
                        ),
                    );
            }),
        );

        expect(findings).toEqual([]);
    });

    it("keeps inline OKLCH tag swatches removed from the SOT catalog", () => {
        const findings = collectInlineModernColorFindings();

        expect(findings.catalogSwatches).toEqual([]);
        expect(findings.unexpectedModernColorLines).toEqual([]);
        expect(findings.unexpectedTagSwatchCalls).toEqual([]);
    });

    it("keeps auth and onboarding on the SOT card/frame structure", () => {
        const login = readSource("features/auth/components/login-form.tsx");
        const register = readSource(
            "features/auth/components/register-form.tsx",
        );
        const onboarding = readSource(
            "features/onboarding/components/onboarding-form.tsx",
        );
        const globals = readSource("app/globals.css");
        const fieldPrimitive = readSource("components/ui/field.tsx");

        expect(login).toContain('data-sot-layout="auth-workstation"');
        expect(login).toMatch(
            /import\s*\{[\s\S]*Card,[\s\S]*CardContent,[\s\S]*CardDescription,[\s\S]*CardHeader,[\s\S]*CardTitle[\s\S]*\}\s*from "@\/components\/ui\/card";/,
        );
        expect(login).toContain("<Card");
        expect(login).toContain('data-sot-card="auth"');
        expect(login).toContain("data-sot-surface={surfaceName}");
        expect(login).toContain("data-sot-state={surfaceState}");
        expect(login).toContain('data-sot-frame="auth"');
        expect(login).toContain('data-sot-part="card-heading"');
        expect(login).toContain('data-sot-part="auth-logo-mark"');
        expect(login).toContain('data-sot-part="auth-heading"');
        expect(login).toContain('data-sot-part="auth-description"');
        expect(login).toContain('data-sot-part="auth-form-message"');
        expect(login).toContain('data-sot-part="auth-local-choice"');
        expect(login).not.toContain('className="auth-sot-canvas"');
        expect(login).not.toContain('className="card"');
        expect(login).not.toContain('className="frame"');
        for (const legacyAuthClassName of [
            "auth-mark",
            "auth-title",
            "auth-sub",
            "field-help",
            "auth-local-link",
        ]) {
            expect(login).not.toContain(legacyAuthClassName);
        }
        expect(login).toContain(
            'import { Input } from "@/components/ui/input";',
        );
        expect(login).toContain("<Input");
        expectNamedImportSymbols(login, "@/components/ui/field", [
            "Field",
            "FieldDescription",
            "FieldError",
            "FieldGroup",
            "FieldLabel",
        ]);
        expect(login).toContain("<FieldGroup");
        expect(login).toContain("<Field");
        expect(login).toContain("<FieldLabel");
        expect(login).toContain("<FieldError");
        expect(login).toContain("<FieldDescription");
        expect(login).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(login).toContain("<Button");
        expect(login).toContain(
            'import { Spinner } from "@/components/ui/spinner";',
        );
        expect(login).toContain('data-sot-control="send-login-link"');
        expect(login).toContain('data-sot-control="auth-email"');
        expect(login).toContain('data-sot-control="local-only"');
        for (const snippet of AUTH_LOGIN_REPAINT_FORBIDDEN_SNIPPETS) {
            expect(login).not.toContain(snippet);
        }
        expectPrimitiveToExcludeBusinessTokens(login, [
            ...AUTH_CARD_PRIMITIVE_FORBIDDEN_TOKENS,
            ...AUTH_BUTTON_PRIMITIVE_FORBIDDEN_TOKENS,
            ...AUTH_INPUT_PRIMITIVE_FORBIDDEN_TOKENS,
        ]);
        const authLayout = extractOpeningElement(
            login,
            'data-sot-layout="auth-workstation"',
            "main",
        );
        const authCard = extractOpeningElement(
            login,
            'data-sot-card="auth"',
            "Card",
        );
        const authHeader = extractOpeningElement(
            login,
            "<CardHeader",
            "CardHeader",
        );
        const authHeaderTitle = extractOpeningElement(
            login,
            'data-sot-part="card-heading"',
            "CardTitle",
        );
        const authHeaderDescription = extractOpeningElement(
            login,
            'data-sot-part="card-sub"',
            "CardDescription",
        );
        const authFrame = extractOpeningElement(
            login,
            'data-sot-frame="auth"',
            "CardContent",
        );
        const authLogoMark = extractOpeningElement(
            login,
            'data-sot-part="auth-logo-mark"',
            "Image",
        );
        const authFrameTitle = extractOpeningElement(
            login,
            'data-sot-part="auth-heading"',
            "CardTitle",
        );
        const authFrameDescription = extractOpeningElement(
            login,
            'data-sot-part="auth-description"',
            "CardDescription",
        );
        const authFieldGroup = extractOpeningElement(
            login,
            "<FieldGroup",
            "FieldGroup",
        );
        const authEmailField = extractOpeningElement(
            login,
            "data-invalid={invalid",
            "Field",
        );
        const authActionField = extractOpeningElement(
            login,
            'data-sot-control="send-login-link"',
            "Field",
        );
        const authEmailInput = extractOpeningElement(
            login,
            'data-sot-control="auth-email"',
            "Input",
        );
        const authSubmitButton = extractOpeningElement(
            login,
            'data-sot-control="send-login-link"',
            "Button",
        );
        const authLocalButton = extractOpeningElement(
            login,
            'data-sot-control="local-only"',
            "Button",
        );
        const authLocalChoice = extractOpeningElement(
            login,
            'data-sot-part="auth-local-choice"',
            "FieldDescription",
        );
        const authErrorMessage = extractOpeningElement(
            login,
            'data-sot-part="auth-form-message"',
            "FieldError",
        );
        const authSuccessMessage = extractOpeningElement(
            login,
            'role="status"',
            "FieldDescription",
        );
        for (const [label, openingElement] of [
            ["layout", authLayout],
            ["surface", authCard],
            ["header", authHeader],
            ["header title", authHeaderTitle],
            ["header description", authHeaderDescription],
            ["frame", authFrame],
            ["logo mark", authLogoMark],
            ["frame title", authFrameTitle],
            ["frame description", authFrameDescription],
            ["content", authFieldGroup],
            ["field", authEmailField],
            ["error message", authErrorMessage],
            ["success message", authSuccessMessage],
            ["action field", authActionField],
            ["email", authEmailInput],
            ["submit", authSubmitButton],
            ["footer", authLocalChoice],
            ["inline link", authLocalButton],
        ] as const) {
            expectPrimitiveToExcludeBusinessTokens(openingElement, [
                ...AUTH_CARD_PRIMITIVE_FORBIDDEN_TOKENS,
                ...AUTH_BUTTON_PRIMITIVE_FORBIDDEN_TOKENS,
                ...AUTH_INPUT_PRIMITIVE_FORBIDDEN_TOKENS,
            ]);
            for (const pattern of AUTH_LOGIN_PRIMITIVE_REPAINT_FORBIDDEN_PATTERNS) {
                expect(
                    openingElement,
                    `${label} should not repaint shadcn primitives`,
                ).not.toMatch(pattern);
            }
        }
        expect(authCard).toContain('data-sot-card="auth"');
        expect(authCard).toContain("data-sot-state={surfaceState}");
        expect(authCard).not.toContain("hasNoPadding");
        expect(authFrame).toContain('data-sot-frame="auth"');
        expect(authEmailInput).toContain('data-sot-control="auth-email"');
        expect(authEmailInput).toContain("data-sot-state={");
        expect(authSubmitButton).toContain(
            'data-sot-control="send-login-link"',
        );
        expect(authLocalButton).toContain('data-sot-control="local-only"');
        const authSubmitLoadingBranch = extractBoundedSlice(
            login,
            "{isLoading ? (",
            "发送登录链接",
        );
        expect(authSubmitLoadingBranch).toContain(
            '<Spinner\n                                                data-icon="inline-start"\n                                                aria-hidden="true"\n                                            />',
        );
        expect(authSubmitLoadingBranch).toContain("发送中...");
        const authLocalLoadingBranch = extractBoundedSlice(
            login,
            "{isLocalLoading ? (",
            "仅本地使用",
        );
        expect(authLocalLoadingBranch).toContain(
            '<Spinner\n                                                    data-icon="inline-start"\n                                                    aria-hidden="true"\n                                                />',
        );
        expect(authLocalLoadingBranch).toContain("启动中...");
        expect(authEmailInput).not.toContain('variant="accent"');
        expect(authEmailInput).not.toContain('controlSize="compact"');
        expect(authSubmitButton).toContain('variant="default"');
        expect(authSubmitButton).not.toContain('variant="accent"');
        expect(authSubmitButton).not.toContain('size="form-submit"');
        expect(authLocalButton).toContain('variant="link"');
        expect(authLocalButton).not.toContain('variant="accentLink"');
        expect(authLocalButton).not.toContain('size="inline-link"');
        expect(login).toContain("aria-invalid={invalid}");
        expect(login).toContain("aria-busy={isLoading}");
        expect(login).toContain("aria-busy={isLocalLoading}");
        expect(login).toContain("disabled={!isMounted || isLoading}");
        expect(login).toContain("disabled={!isMounted || isLocalLoading}");
        expect(login).toContain("data-sot-state={formState.kind}");
        expect(login).toContain("data-auth-form-state");
        expect(login).toContain("<FieldError");
        expect(fieldPrimitive).toContain('role="alert"');
        expect(login).toContain('role="status"');
        const magicLinkCall = extractBoundedSlice(
            login,
            "await signIn.magicLink({",
            "});",
        );
        expect(magicLinkCall).toContain('callbackURL: "/dashboard"');
        expect(magicLinkCall).toContain('newUserCallbackURL: "/onboarding"');
        expect(magicLinkCall).toContain('errorCallbackURL: "/login"');
        const localUseHandler = extractBoundedSlice(
            login,
            "async function handleLocalUse()",
            "const surfaceState",
        );
        expect(localUseHandler).toContain("signIn.anonymous()");
        expect(localUseHandler).toMatch(
            /navigate(?:AndRefresh)?BrowserRoute\(router, "\/dashboard"\)/,
        );
        for (const copyString of AUTH_LOGIN_COPY_STRINGS) {
            expect(login).toContain(copyString);
        }
        expect(login).not.toContain('"inp"');
        expect(login).not.toContain('className="btn primary"');
        expect(login).not.toContain('"btn primary"');
        expect(login).not.toContain('className="app"');
        expect(login).not.toContain('className="panel"');
        expect(login).not.toContain('className="modal-foot"');
        for (const selector of REMOVED_AUTH_ONBOARDING_CARD_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const removedAuthPrimitiveRepaintSelector of [
            '[data-sot-control="auth-email"][data-slot="input"]',
            '[data-sot-control="send-login-link"][data-slot="button"]',
            '[data-sot-control="local-only"][data-slot="button"]',
        ]) {
            expect(globals).not.toContain(removedAuthPrimitiveRepaintSelector);
        }
        const authOnboardingLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                AUTH_ONBOARDING_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(text),
            );

        expect(authOnboardingLegacySelectorLines).toEqual([]);
        expect(register).toContain("<LoginForm");
        expect(register).toContain('intent="setup"');
        for (const source of [login, register]) {
            expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
        }

        expect(onboarding).toContain(
            'data-sot-layout="onboarding-workstation"',
        );
        expect(onboarding).toContain('data-sot-surface="onboarding"');
        expect(onboarding).toContain("<Card");
        expect(onboarding).toContain('data-sot-card="onboarding"');
        expect(onboarding).toContain('data-sot-frame="onboarding"');
        expect(onboarding).toContain('data-sot-part="card-heading"');
        expect(onboarding).toContain("const onboardingCardClassNames = {");
        expect(onboarding).toContain("layout:");
        expect(onboarding).toContain("surface:");
        expect(onboarding).toContain("frame:");
        expect(onboarding).toContain("speakerDraft:");
        expect(onboarding).toContain("header:");
        expect(onboarding).toContain("steps:");
        expect(onboarding).toContain("step:");
        expect(onboarding).toContain("stepHeader:");
        expect(onboarding).toContain("providerMeta:");
        expect(onboarding).toContain("heading:");
        expect(onboarding).toContain("sub:");
        expect(onboarding).toContain("stepTitle:");
        expect(onboarding).toContain("stepDescription:");
        expect(onboarding).toContain("errorMessage:");
        expect(onboarding).toContain("stepBody:");
        expect(onboarding).toContain("defaultSources:");
        expect(onboarding).toContain("defaultSource:");
        expect(onboarding).toContain("actions:");
        expect(onboarding).toContain("providerCard:");
        expect(onboarding).toContain("providerList:");
        expect(onboarding).toContain("summaryList:");
        expect(onboarding).toContain("matrixRow:");
        expect(onboarding).toContain("matrixLabel:");
        expect(onboarding).toContain("matrixValue:");
        expect(onboarding).toContain("providerIcon:");
        expect(onboarding).toContain("providerName:");
        expect(onboarding).toContain("providerHint:");
        expect(onboarding).toContain("sourceAuthModeGroup:");
        expect(onboarding).toContain("sourceAuthModeOption:");
        expect(onboarding).not.toContain("secondaryAction:");
        expect(onboarding).not.toContain("primaryAction:");
        expect(onboarding).toContain(
            "const DEFAULT_SOURCE_SWATCH_CLASS_NAMES = {",
        );
        expect(onboarding).toContain(
            'accent: "size-5 flex-none rounded bg-primary"',
        );
        expect(onboarding).toContain(
            'empty: "size-5 flex-none rounded bg-muted"',
        );
        for (const removedClass of REMOVED_ONBOARDING_ARBITRARY_LAYOUT_CLASSES) {
            expect(onboarding).not.toContain(removedClass);
        }
        expect(onboarding).toContain('data-sot-part="onboarding-card-header"');
        expect(onboarding).toContain(
            "className={onboardingCardClassNames.header}",
        );
        expect(onboarding).toContain(
            "className={onboardingCardClassNames.heading}",
        );
        expect(onboarding).toContain(
            "className={onboardingCardClassNames.sub}",
        );
        expect(onboarding).not.toContain('className="onboarding-sot-canvas"');
        expect(onboarding).not.toContain('className="card"');
        expect(onboarding).not.toContain('className="frame"');
        expect(onboarding).toContain('data-sot-panel="onboarding-steps"');
        expect(onboarding).toContain("data-sot-progress={visibleStep}");
        expect(onboarding).toContain('data-sot-panel="onboarding-current"');
        expect(onboarding).toContain('data-sot-control="onboarding-step"');
        expect(onboarding).toContain("data-sot-step={step.id}");
        expect(onboarding).toContain("data-sot-state={status}");
        expect(onboarding).toContain('data-sot-part="onboarding-step-header"');
        expect(onboarding).toContain('data-sot-part="onboarding-step-title"');
        expect(onboarding).toContain(
            'data-sot-part="onboarding-step-description"',
        );
        expect(onboarding).toContain('data-sot-part="onboarding-step-body"');
        expect(onboarding).toContain(
            "className={onboardingCardClassNames.stepTitle}",
        );
        expect(onboarding).toContain(
            "className={onboardingCardClassNames.stepDescription}",
        );
        expect(onboarding).toMatch(
            /<CardContent(?=[^>]*\bclassName=\{onboardingCardClassNames\.stepBody\})(?=[^>]*\bdata-sot-part="onboarding-step-body")[^>]*>/,
        );
        expect(onboarding).toContain('data-sot-part="onboarding-error"');
        expect(onboarding).toContain('data-sot-part="onboarding-actions"');
        expect(onboarding).toContain('data-sot-control="onboarding-skip"');
        expect(onboarding).toContain('data-sot-control="provider-card"');
        expect(onboarding).toContain('data-sot-list="provider-cards"');
        expect(onboarding).toContain(
            'data-sot-panel="onboarding-default-source-step"',
        );
        expect(onboarding).toContain(
            'data-sot-list="onboarding-default-sources"',
        );
        expect(onboarding).toContain(
            'data-sot-control="onboarding-default-source"',
        );
        expect(onboarding).toContain(
            'data-sot-part="onboarding-default-source-swatch"',
        );
        const defaultSourceMarkerIndex = onboarding.indexOf(
            'data-sot-list="onboarding-default-sources"',
        );
        expect(defaultSourceMarkerIndex).toBeGreaterThanOrEqual(0);
        const defaultSourceStartIndex = onboarding.lastIndexOf(
            "<ToggleGroup",
            defaultSourceMarkerIndex,
        );
        const defaultSourceEndIndex = onboarding.indexOf(
            "</ToggleGroup>",
            defaultSourceMarkerIndex,
        );
        expect(defaultSourceStartIndex).toBeGreaterThanOrEqual(0);
        expect(defaultSourceEndIndex).toBeGreaterThan(defaultSourceMarkerIndex);
        const defaultSourceControl = onboarding.slice(
            defaultSourceStartIndex,
            defaultSourceEndIndex + "</ToggleGroup>".length,
        );
        expect(defaultSourceControl).toContain("<ToggleGroup");
        expect(defaultSourceControl).toContain("<ToggleGroupItem");
        expect(defaultSourceControl).toContain('type="single"');
        expect(defaultSourceControl).toContain('orientation="vertical"');
        expect(defaultSourceControl).toContain('role="group"');
        expect(defaultSourceControl).toContain('variant="outline"');
        expect(defaultSourceControl).toContain("spacing={2}");
        expect(defaultSourceControl).toContain(
            "value={defaultTranscriptionSource}",
        );
        expect(defaultSourceControl).toContain(
            "setDefaultTranscriptionSource(selectedOption.id)",
        );
        expect(defaultSourceControl).toContain("aria-pressed={isActive}");
        expect(defaultSourceControl).toContain("data-sot-state={");
        expect(defaultSourceControl).not.toContain('role="button"');
        expect(defaultSourceControl).not.toContain('type="button"');
        expect(defaultSourceControl).not.toContain("<button");
        expect(defaultSourceControl).not.toContain("data-sot-swatch");
        expect(onboarding).toContain(
            "disabled={isSaving || !option.connected}",
        );
        expect(onboarding).not.toContain("style={{");
        expect(onboarding).not.toContain("tabIndex=");
        expect(onboarding).toContain(
            'data-sot-control="speaker-profile-draft"',
        );
        expect(onboarding).toMatch(
            /data-sot-control="speaker-profile-draft"[\s\S]*<CardHeader(?=[^>]*\bclassName=\{onboardingCardClassNames\.providerMeta\})(?=[^>]*\bdata-sot-part="provider-meta")[^>]*>[\s\S]*<CardTitle(?=[^>]*\bclassName=\{onboardingCardClassNames\.providerName\})(?=[^>]*\bdata-sot-part="provider-name")[^>]*>[\s\S]*<CardDescription(?=[^>]*\bclassName=\{onboardingCardClassNames\.providerHint\})(?=[^>]*\bdata-sot-part="provider-hint")[^>]*>/,
        );
        expect(onboarding).toContain('data-sot-list="speaker-profiles"');
        expect(onboarding).toContain('data-sot-list="finish-summary"');
        expect(onboarding).toContain('data-sot-part="provider-icon"');
        expect(onboarding).toContain('data-sot-part="provider-meta"');
        expect(onboarding).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(onboarding).toContain(
            "className={onboardingCardClassNames.sourceAuthModeGroup}",
        );
        expect(onboarding).toContain(
            "className={\n                                        onboardingCardClassNames.sourceAuthModeOption\n                                    }",
        );
        expect(onboarding).toContain("spacing={2}");
        expect(onboarding).toContain('variant="outline"');
        expect(onboarding).not.toContain('layout="onboardingSourceAuthMode"');
        expect(onboarding).not.toContain(
            'variant="onboardingSourceAuthModeOption"',
        );
        expect(onboarding).not.toContain(
            'size="onboardingSourceAuthModeOption"',
        );
        expect(onboarding).not.toContain('spacing="onboardingSourceAuthMode"');
        expect(onboarding).toContain('data-sot-control="source-base-url"');
        expect(onboarding).not.toContain('variant="onboardingSourceUrl"');
        expect(onboarding).not.toContain('controlSize="onboardingSourceUrl"');
        expect(onboarding).toContain('variant="onboarding"');
        expect(onboarding).toContain(
            "className={onboardingCardClassNames.surface}",
        );
        expect(onboarding).toContain("onboardingCardClassNames.providerCard");
        expect(onboarding).not.toContain(
            "className={onboardingCardClassNames.secondaryAction}",
        );
        expect(onboarding).not.toContain(
            "className={onboardingCardClassNames.primaryAction}",
        );
        expect(onboarding).not.toContain('variant="onboardingProviderCard"');
        expect(onboarding).not.toContain('size="onboardingProviderCard"');
        expect(onboarding).not.toContain('variant="onboardingDefaultSource"');
        expect(onboarding).not.toContain('size="onboardingDefaultSource"');
        expect(onboarding).not.toContain('variant="onboardingSecondaryAction"');
        expect(onboarding).not.toContain('variant="onboardingPrimaryAction"');
        expect(onboarding).not.toContain('size="onboardingAction"');
        expect(onboarding).not.toContain('variant="accent"');
        expect(onboarding).not.toContain('variant="quietOutline"');
        expect(onboarding).not.toContain('size="control-xs"');
        expect(onboarding).not.toContain(
            'variant={isActive ? "secondary" : "outline"}',
        );
        const onboardingSkipButton = extractOpeningElement(
            onboarding,
            'data-sot-control="onboarding-skip"',
            "Button",
        );
        const defaultSourceNextButton = extractOpeningElement(
            onboarding,
            'data-sot-control="onboarding-next"',
            "Button",
        );
        expect(onboardingSkipButton).toContain('type="button"');
        expect(onboardingSkipButton).toContain('variant="outline"');
        expect(onboardingSkipButton).toContain('size="xs"');
        expect(onboardingSkipButton).not.toContain("className=");
        expect(defaultSourceNextButton).toContain('type="button"');
        expect(defaultSourceNextButton).toContain('variant="default"');
        expect(defaultSourceNextButton).toContain('size="xs"');
        expect(defaultSourceNextButton).not.toContain("className=");
        for (const removedOnboardingPrimitiveRepaintClass of [
            "!h-[26px]",
            "!gap-[6px]",
            "!rounded-[8px]",
            "!border",
            "!bg-[var(--accent)]",
            "!px-[10px]",
            "!text-[11px]",
            "!font-semibold",
            "!leading-[normal]",
            "!text-[var(--fg-secondary)]",
            "!text-white",
            "!shadow-none",
        ]) {
            for (const actionButtonOpening of [
                onboardingSkipButton,
                defaultSourceNextButton,
            ]) {
                expect(actionButtonOpening).not.toContain(
                    removedOnboardingPrimitiveRepaintClass,
                );
            }
        }
        const providerCardsMarkerIndex = onboarding.indexOf(
            'data-sot-list="provider-cards"',
        );
        expect(providerCardsMarkerIndex).toBeGreaterThanOrEqual(0);
        const providerCardsStartIndex = onboarding.lastIndexOf(
            "<ToggleGroup",
            providerCardsMarkerIndex,
        );
        const providerCardsEndIndex = onboarding.indexOf(
            "</ToggleGroup>",
            providerCardsMarkerIndex,
        );
        expect(providerCardsStartIndex).toBeGreaterThanOrEqual(0);
        expect(providerCardsEndIndex).toBeGreaterThan(providerCardsMarkerIndex);
        const providerCardsControl = onboarding.slice(
            providerCardsStartIndex,
            providerCardsEndIndex + "</ToggleGroup>".length,
        );
        const providerCardItem = extractOpeningElement(
            onboarding,
            'data-sot-control="provider-card"',
            "ToggleGroupItem",
        );
        expect(providerCardsControl).toContain("<ToggleGroup");
        expect(providerCardsControl).toContain("<ToggleGroupItem");
        expect(providerCardsControl).toContain('type="single"');
        expect(providerCardsControl).toContain('orientation="vertical"');
        expect(providerCardsControl).toContain('variant="outline"');
        expect(providerCardsControl).toContain("disabled={isSaving}");
        expect(providerCardsControl).toContain("value={provider}");
        expect(providerCardsControl).toContain("selectProvider(value)");
        expect(providerCardItem).toContain("className={cn(");
        expect(providerCardItem).toContain(
            "onboardingCardClassNames.providerCard",
        );
        expect(providerCardItem).toContain('isActive && "border-transparent"');
        expect(providerCardItem).toContain("value={item.provider}");
        expect(onboarding).not.toContain(
            '"grid h-auto w-full grid-cols-[36px_1fr_auto_auto] items-center justify-start gap-3 px-3.5 py-3 text-left"',
        );
        expect(onboarding).not.toContain(
            'className="grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 border-primary/50 bg-primary/10 p-3.5"',
        );
        expect(onboarding).toContain(
            "className={onboardingCardClassNames.speakerDraft}",
        );
        for (const removedOnboardingCardVariant of [
            'variant="onboardingSurface"',
            'variant="onboardingSpeakerDraft"',
            'variant="onboardingHeader"',
            'variant="onboardingStepHeader"',
            'variant="onboardingProviderMeta"',
            'variant="onboardingHeading"',
            'variant="onboardingStepTitle"',
            'variant="onboardingProviderName"',
            'variant="onboardingSub"',
            'variant="onboardingStepDescription"',
            'variant="onboardingProviderHint"',
            'variant="onboardingStepBody"',
        ]) {
            expect(onboarding).not.toContain(removedOnboardingCardVariant);
        }
        expect(onboarding).toContain("CardContent,");
        expect(onboarding).toContain("CardDescription,");
        expect(onboarding).toContain("CardHeader,");
        expect(onboarding).toContain("CardTitle,");
        expect(onboarding).toContain(
            'import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";',
        );
        expect(onboarding).toContain("<ToggleGroup");
        expect(onboarding).toContain("<ToggleGroupItem");
        expect(onboarding).toContain('type="single"');
        expect(onboarding).toContain("value={currentDraft.authMode}");
        expect(onboarding).toContain("setAuthMode(mode)");
        expect(onboarding).toContain('data-sot-list="source-auth-modes"');
        expect(onboarding).toContain('data-sot-control="source-auth-mode"');
        expect(onboarding).toContain("data-sot-auth-mode={mode}");
        expect(onboarding).toContain(
            'data-sot-state={\n                                        active ? "selected" : "idle"\n                                    }',
        );
        expect(onboarding).toContain('data-sot-part="source-auth-mode-title"');
        expect(onboarding).toContain(
            'data-sot-part="source-auth-mode-description"',
        );
        const sourceAuthModeControl =
            onboarding.match(
                /currentProviderCatalog\.authModes\.length > 1[\s\S]*?<MatrixRow/,
            )?.[0] ?? "";
        expect(sourceAuthModeControl).toContain("<ToggleGroup");
        expect(sourceAuthModeControl).toContain("<ToggleGroupItem");
        expect(sourceAuthModeControl).toContain('variant="outline"');
        expect(sourceAuthModeControl).not.toContain('size="lg"');
        expect(sourceAuthModeControl).toContain("spacing={2}");
        expect(sourceAuthModeControl).not.toContain(
            'className="grid w-full grid-cols-2 items-stretch"',
        );
        const onboardingDataSourceFieldControl =
            onboarding.match(
                /\{providerFields\.map\(\(field\) => \([\s\S]*?\)\)\}/,
            )?.[0] ?? "";
        expect(onboardingDataSourceFieldControl).toContain(
            "<DataSourceFieldControl",
        );
        expect(onboardingDataSourceFieldControl).toContain(
            'variant="onboarding"',
        );
        expect(onboardingDataSourceFieldControl).not.toContain(
            'variant="settings"',
        );
        expect(onboarding).toContain('data-sot-control="save-enter"');
        expect(onboarding).not.toContain("src-item");
        expect(onboarding).not.toContain("sp-ico");
        expect(onboarding).not.toContain("src-meta");
        expect(onboarding).not.toContain('className="app"');
        expect(onboarding).not.toContain('className="panel"');
        expect(onboarding).not.toContain('className="onboarding-progress"');
        expect(onboarding).not.toContain('className="onboarding-step-head"');
        expect(onboarding).not.toContain('className="onboarding-step-title"');
        expect(onboarding).not.toContain('className="onboarding-step-sub"');
        expect(onboarding).not.toContain('className="onboarding-step-body"');
        expect(onboarding).not.toContain('className="gap-0 p-0"');
        expect(onboarding).not.toContain('className="src-list"');
        expect(onboarding).not.toContain(
            'className="onboarding-progress-segment"',
        );
        expect(onboarding).not.toMatch(
            /className="onboarding-default-source-(step|list|row|swatch)"/,
        );
        expect(onboarding).not.toContain('className="field-help err"');
        expect(onboarding).not.toContain('className="onboarding-actions"');
        expect(onboarding).not.toContain('className="sr-meta-row"');
        expect(onboarding).not.toContain('className="sm"');
        expect(onboarding).not.toContain("onKeyDown={(event) =>");
        for (const selector of REMOVED_AUTH_ONBOARDING_CARD_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of REMOVED_ONBOARDING_MATRIX_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(globals).not.toContain(
            '[data-sot-card="onboarding"] > [data-slot="card-header"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="onboarding-step-header"][data-slot="card-header"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="onboarding-step-body"][data-slot="card-content"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="provider-meta"][data-slot="card-header"]',
        );
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-part="onboarding-actions"] [data-slot="button"]',
            ),
        ).toEqual([]);
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-control="provider-card"][data-slot="button"]',
            ),
        ).toEqual([]);
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-control="speaker-profile-draft"][data-slot="card"]',
            ),
        ).toEqual([]);
        for (const selector of ONBOARDING_DEFAULT_SOURCE_ROOT_REPAINT_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).not.toMatch(
            /\.onboarding-default-source-(list|row|swatch)\b/,
        );
        expect(onboarding).not.toMatch(OLD_UI_CONTRACT_RE);
    });

    it("keeps dashboard source, search, activity, list, and settings SOT entries", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const librarySearch = readSource(
            "features/dashboard/components/library-search.tsx",
        );
        const dashboardRecordingPlayerControls = readSource(
            "features/dashboard/components/dashboard-recording-player-controls.tsx",
        );
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const emptyPrimitive = readSource("components/ui/empty.tsx");
        const button = readSource("components/ui/button.tsx");
        const sourceReportPanel = readSource(
            "features/recordings/components/source-report-panel.tsx",
        );
        const sourceReportPrimitives = readSource(
            "features/source-report/primitives.tsx",
        );
        const sourceReportBadgePrimitive = readSource(
            "components/ui/badge.tsx",
        );
        const sotPlayerPrimitives = readSource(
            "features/recordings/components/sot-player-primitives.tsx",
        );
        const sourceReportButtonPrimitive = readSource(
            "components/ui/button.tsx",
        );
        const sourceReportCardPrimitive = readSource("components/ui/card.tsx");
        const sourceReportSkeletonPrimitive = readSource(
            "components/ui/skeleton.tsx",
        );
        const toggleGroupPrimitive = readSource(
            "components/ui/toggle-group.tsx",
        );
        const globals = readSource("app/globals.css");
        const productCss = readProductCss(globals);
        expect(workstation).toContain(
            'data-sot-surface="dashboard-workstation"',
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
        const dashboardMain = extractElementSlice(
            workstation,
            'data-sot-panel="dashboard-main"',
            "main",
        );
        const dashboardMainClassName = extractBoundedSlice(
            workstation,
            "const DASHBOARD_MAIN_CLASS_NAME =",
            ";",
        );
        for (const classToken of DASHBOARD_MAIN_REQUIRED_CLASS_TOKENS) {
            expect(dashboardMainClassName).toContain(classToken);
        }
        expect(dashboardMainClassName).not.toMatch(
            DASHBOARD_MAIN_FORBIDDEN_CLASS_PATTERN,
        );
        expect(dashboardMain).toContain(
            "className={DASHBOARD_MAIN_CLASS_NAME}",
        );
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
            DASHBOARD_TOPBAR_FORBIDDEN_CLASS_PATTERN,
        );
        expect(dashboardTopbar).toContain(
            "className={dashboardTopbarClassNames.topbar}",
        );
        expect(workstation).toContain('data-sot-panel="dashboard-workspace"');
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
            OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
        );
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
            OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-drawer-trigger"',
        );
        expect(workstation).toMatch(
            /<Button\s+variant="ghost"\s+size="icon-sm"\s+className=\{dashboardButtonClassNames\.drawerTrigger\}[\s\S]*data-sot-control="dashboard-drawer-trigger"[\s\S]*<Menu[\s\S]*data-icon="inline-start"/,
        );
        expect(workstation).not.toMatch(
            /<button[\s\S]{0,240}data-sot-control="dashboard-drawer-trigger"/,
        );
        expect(workstation).toContain('id="drawer-scrim"');
        expect(workstation).toContain('id="drawer-trigger"');
        expect(workstation).not.toContain("data-drawer-open=");
        expect(workstation).not.toContain(
            'data-sot-surface="dashboard-source-rail"',
        );
        expect(workstation).toContain('data-sot-list="dashboard-sources"');
        expect(workstation).toContain(
            'data-sot-control="dashboard-source-clear"',
        );
        expect(workstation).toContain(
            'data-sot-control="dashboard-source-provider"',
        );
        expect(workstation).not.toContain("sourceProviderThemeClassName");
        expect(workstation).not.toMatch(/--source-provider-status-[a-z-]+:/);
        expect(workstation).not.toMatch(/--source-provider-primary-[a-z-]+:/);
        expect(globals).not.toMatch(/--source-provider-status-[a-z-]+/);
        expect(button).not.toMatch(/--source-provider-status-[a-z-]+/);
        expect(workstation).toContain(
            'className={cn(\n                "group/dashboard-workstation"',
        );
        expect(workstation).toContain("dashboardSourceErrorClassName");
        for (const removedConstant of DASHBOARD_SHELL_SOURCE_BUTTON_CONSTANTS) {
            expect(workstation).not.toContain(removedConstant);
        }
        expect(workstation).toContain("dashboardButtonClassNames.nav");
        expect(workstation).toContain("dashboardButtonClassNames.sync");
        expect(workstation).toContain(
            "dashboardButtonClassNames.sidebarCollapse",
        );
        expect(workstation).toContain(
            "dashboardButtonClassNames.settingsAvatar",
        );
        expect(button).not.toContain("dashboardSpeakersMerge:");
        const dashboardFavoriteNavButton = extractElementSlice(
            workstation,
            'data-sot-control="dashboard-favorite"',
            "Button",
        );
        expect(dashboardFavoriteNavButton).toContain('variant="ghost"');
        expect(dashboardFavoriteNavButton).toContain('size="default"');
        expect(dashboardFavoriteNavButton).toMatch(/className=\{\s*cn\(/);
        expect(dashboardFavoriteNavButton).toContain(
            "dashboardButtonClassNames.nav",
        );
        expect(dashboardFavoriteNavButton).toContain(
            "dashboardSidebarCollapseClassNames.favorite",
        );
        const dashboardNavButtonClassNames = extractObjectStringProperty(
            extractBoundedSlice(
                workstation,
                "const dashboardButtonClassNames = {",
                "} as const;",
            ),
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
        expect(dashboardFavoriteNavButton).not.toContain(
            "className={DASHBOARD",
        );
        expect(dashboardNavButtonClassNames).toContain(
            "data-[sot-state=selected]:text-sidebar-accent-foreground",
        );
        const dashboardFavoriteCount = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-favorite-count"',
            "Badge",
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
        const dashboardSourceClearButton = extractOpeningElement(
            workstation,
            'data-sot-control="dashboard-source-clear"',
            "Button",
        );
        expect(workstation).toMatch(
            /<Button[\s\S]*data-sot-control="dashboard-source-clear"[\s\S]*onClick=\{\(\) => setSource\("all"\)\}/,
        );
        const dashboardSyncButton = extractElementSlice(
            workstation,
            'data-sot-control="dashboard-sync"',
            "Button",
        );
        for (const selector of REMOVED_DASHBOARD_SYNC_GLOBAL_SELECTORS) {
            expect(
                collectCssRuleBlocks(globals, selector).filter((block) =>
                    DASHBOARD_SYNC_VISUAL_GLOBAL_DECLARATION_RE.test(
                        block.declarations,
                    ),
                ),
            ).toEqual([]);
        }
        expect(workstation).not.toContain("dashboardSyncClassNames");
        expect(workstation).toContain("if (syncButtonBusy) return;");
        expect(workstation).toContain("data-sync-state={syncButtonState}");
        expect(workstation).toContain("aria-busy={syncButtonBusy}");
        expect(workstation).toContain("disabled={syncButtonBusy}");
        expect(workstation).toContain("onClick={() => void runManualSync()}");
        const dashboardSyncPanel = extractElementSlice(
            workstation,
            'data-sot-panel="dashboard-sync"',
            "div",
        );
        const dashboardSyncIndicator = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-sync-indicator"',
            "span",
        );
        const dashboardSyncText = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-sync-text"',
            "div",
        );
        const dashboardSyncTitle = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-sync-title"',
            "div",
        );
        const dashboardSyncSubtitle = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-sync-subtitle"',
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
        expect(workstation).not.toContain(
            "dashboardSidebarCollapseClassNames.syncPanel",
        );
        expect(dashboardSyncButton).toContain('variant="ghost"');
        expect(dashboardSyncButton).toContain('size="icon-sm"');
        expect(dashboardSyncButton).toMatch(/className=\{\s*cn\(/);
        expect(dashboardSyncButton).toContain("dashboardButtonClassNames.sync");
        expect(dashboardSyncButton).toContain(
            "dashboardSidebarCollapseClassNames.hidden",
        );
        expect(workstation).toMatch(
            /<Button\s+variant="outline"\s+size="icon"\s+className=\{dashboardButtonClassNames\.sidebarCollapse\}[\s\S]*data-sot-control="sidebar-collapse"/,
        );
        expect(workstation).toContain(
            'data-sot-panel="dashboard-source-filter-stack"',
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
        const sourceProviderRows = extractBoundedSlice(
            workstation,
            "{sourceRows.map((item) => {",
            'data-sot-panel="dashboard-sync"',
        );
        const sourceFilterStackStart = workstation.indexOf(
            'data-sot-panel="dashboard-source-filter-stack"',
        );
        const sourceFilterStackEnd = workstation.indexOf(
            "</output>",
            sourceFilterStackStart,
        );
        expect(sourceFilterStackStart).toBeGreaterThanOrEqual(0);
        expect(sourceFilterStackEnd).toBeGreaterThan(sourceFilterStackStart);
        const sourceFilterStack = workstation.slice(
            sourceFilterStackStart,
            sourceFilterStackEnd,
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
        const legacySourceRowClassNamePattern =
            /className=(?:"[^"]*\b(?:nav-source|is-active-filter|is-connected-idle|is-syncing|is-sync-error|is-no-results|is-needs-setup|is-not-connected|is-expired|is-disabled|src-ico|src-status|src-action)\b[^"]*"|\{[^}]*\b(?:nav-source|is-active-filter|is-connected-idle|is-syncing|is-sync-error|is-no-results|is-needs-setup|is-not-connected|is-expired|is-disabled|src-ico|src-status|src-action)\b[^}]*\})/;
        const legacySourceFilterActionClassNamePattern =
            /className=(?:"[^"]*\b(?:src-action|is-retry|is-connect|is-reauth)\b[^"]*"|\{[^}]*\b(?:src-action|is-retry|is-connect|is-reauth)\b[^}]*\})/;
        const legacySourceAttributePattern =
            /\bdata-(?:connected|provider|source|source-status|source-action-state)=/;

        expect(sourceProviderRows).not.toContain('className="nav-item"');
        expect(sourceProviderRows).toContain(
            'data-sot-control="dashboard-source-provider"',
        );
        expect(sourceProviderRows).toContain(
            'data-sot-part="source-provider-mark"',
        );
        expect(sourceProviderRows).toContain('data-sot-variant="image"');
        expect(sourceProviderRows).toContain('data-sot-variant="letter"');
        expect(sourceProviderRows).toContain("data-sot-provider-cover={");
        expect(sourceProviderRows).toContain(
            'data-sot-part="source-provider-status"',
        );
        expect(sourceProviderRows).toContain(
            'data-sot-part="source-provider-label"',
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
        const featureOwnerClassSource =
            collectFeatureOwnerClassSource(workstation);
        const sourceProviderToneHelpers = extractBoundedSlice(
            workstation,
            "function sourceProviderStatusTone",
            "const syncButtonState",
        );
        expectPrimitiveToExcludeBusinessTokens(
            button,
            DASHBOARD_SOURCE_FILTER_BUTTON_PRIMITIVE_FORBIDDEN_TOKENS,
        );
        expectPrimitiveToExcludeBusinessTokens(
            sourceReportBadgePrimitive,
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
        expect(sourceProviderRows).toContain(
            'data-sot-part="source-provider-action"',
        );
        expect(sourceProviderRows).toMatch(
            /<Button[\s\S]*data-sot-part="source-provider-action"/,
        );
        expect(sourceProviderRows).not.toContain(
            "SOT defines source row action as span[role=button]",
        );
        expect(sourceProviderRows).toContain("data-sot-action={actionKind}");
        expect(sourceProviderRows).toContain("data-state={sourceRowState}");
        expect(sourceProviderRows).toContain("aria-label={actionAriaLabel}");
        expect(sourceProviderRows).toContain("event.stopPropagation();");
        expect(sourceProviderRows).toContain("event.preventDefault();");
        expect(sourceProviderRows).toContain("void runManualSync();");
        expect(sourceProviderRows).not.toMatch(legacySourceRowClassNamePattern);
        expect(sourceProviderRows).not.toMatch(legacySourceAttributePattern);
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
        expect(workstation).toMatch(
            /<output\s+aria-live="polite"[\s\S]*data-sot-panel="dashboard-source-filter-stack"[\s\S]*data-state=\{sourceFilterStackState\}/,
        );
        expect(sourceFilterStack).toContain(
            "data-state={sourceFilterStackState}",
        );
        expect(sourceFilterStack).toContain(
            'data-sot-part="source-filter-action"',
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
        expect(sourceFilterStack).toContain('data-sot-action="retry"');
        expect(sourceFilterStack).toContain('data-sot-action="widen"');
        expect(sourceFilterStack).toContain('data-sot-action="open-settings"');
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
        expect(sourceFilterStack).toMatch(
            /<Button[\s\S]*data-sot-control="source-filter-clear"[\s\S]*onClick=\{\(\) => setSource\("all"\)\}/,
        );
        expect(sourceFilterClearButton).toMatch(
            /className=\{\s*sourceFilterClassNames\.clear\s*\}/,
        );
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
            expect(sourceFilterStack).toMatch(
                new RegExp(
                    `<Button[\\s\\S]*data-sot-control="${control}"[\\s\\S]*data-sot-part="source-filter-action"`,
                ),
            );
        }
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
        expect(sourceFilterStack).toMatch(
            /<Button[\s\S]*data-sot-control="source-filter-clear-all"[\s\S]*onClick=\{\(\) => setSource\("all"\)\}/,
        );
        expect(sourceFilterClearAllButton).toMatch(
            /className=\{\s*sourceFilterClassNames\.clearAll\s*\}/,
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
        expect(librarySearchFilterClearButton).toContain('size="icon-xs"');
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
        expect(sourceFilterStack).not.toMatch(
            legacySourceFilterActionClassNamePattern,
        );
        expect(sourceFilterStack).not.toMatch(legacySourceAttributePattern);
        for (const selector of DASHBOARD_SHELL_NAV_PRIMITIVE_REPAINT_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of DASHBOARD_SOURCE_PROVIDER_DIRECT_STATE_SELECTORS) {
            const directStateBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(({ prelude }) => !prelude.includes("[data-sot-part="));

            expect(directStateBlocks).toEqual([]);
        }
        for (const selector of DASHBOARD_SOURCE_PROVIDER_MIGRATED_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).not.toContain("source-provider-action");
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-part="source-filter-action"]',
            ),
        ).toEqual([]);
        expect(librarySearch).toContain('data-sot-control="dashboard-search"');
        expect(librarySearch).toContain('data-sot-panel="library-search"');
        expect(librarySearch).toContain(
            'data-sot-list="library-search-results"',
        );
        expect(librarySearch).toContain("groupedSearchResults.map");
        expect(librarySearch).toContain("group.results.map");
        expect(collectSearchActivityPrimitiveBusinessTokens()).toEqual([]);
        const dashboardSearchSlice = librarySearch;
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
        const dashboardSearchActivityClassNames =
            extractDashboardSearchActivityClassNames(workstation);
        const librarySearchClassNames =
            extractLibrarySearchClassNames(librarySearch);
        expect(workstation).toContain('data-sot-control="dashboard-activity"');
        expect(workstation).toContain('data-sot-panel="dashboard-activity"');
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
        ).toContain("font-mono text-xs");
        expect(globals).not.toContain(
            '[data-sot-part="dashboard-activity-status-sub"]',
        );
        expect(workstation).toContain("visibleActivityItems.map");
        const dashboardActivitySlice = extractBoundedSlice(
            workstation,
            'data-sot-part="dashboard-activity-anchor"',
            'data-sot-control="dashboard-settings"',
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
        for (const {
            propertyName,
            snippets,
        } of DASHBOARD_SEARCH_ACTIVITY_FEATURE_OWNER_CLASS_SNIPPETS) {
            const property = extractSearchActivityOwnerClassProperty({
                activityClassNames: dashboardSearchActivityClassNames,
                librarySearchClassNames,
                propertyName,
            });

            for (const snippet of snippets) {
                expect(property).toContain(snippet);
            }
        }
        for (const {
            propertyName,
            snippets,
        } of DASHBOARD_SEARCH_ACTIVITY_SOT_BODY_FORBIDDEN_CLASS_SNIPPETS) {
            const property = extractSearchActivityOwnerClassProperty({
                activityClassNames: dashboardSearchActivityClassNames,
                librarySearchClassNames,
                propertyName,
            });

            for (const snippet of snippets) {
                expect(property).not.toContain(snippet);
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
        expect(workstation).not.toContain('data-sot-panel="library-search"');
        expect(librarySearch).toContain(
            `fetch(\`/api/search?\${params.toString()}\`)`,
        );
        expect(librarySearch).toContain("}, 180);");
        expect(librarySearch).toContain("setSearchRetry((value) => value + 1)");
        expect(librarySearch).toContain("searchIndexing?.active");
        expect(librarySearch).toContain("handleLibrarySearchKeyDown");
        expect(librarySearch).toContain("searchInputRef.current?.focus({");
        expect(librarySearch).toContain("searchTriggerRef.current?.focus({");
        for (const selector of MIGRATED_LIBRARY_SEARCH_DATA_SOT_CSS_SELECTORS) {
            expect(productCss).not.toContain(selector);
        }
        for (const selector of MIGRATED_DASHBOARD_ACTIVITY_DATA_SOT_CSS_SELECTORS) {
            expect(productCss).not.toContain(selector);
        }
        const dashboardSettingsDialog = extractSelfClosingElement(
            workstation,
            'data-sot-control="dashboard-settings"',
            "SettingsDialog",
        );
        const dashboardSettingsTrigger = extractElementSlice(
            dashboardSettingsDialog,
            'data-sot-control="dashboard-settings"',
            "Button",
        );

        expect(dashboardSettingsDialog).toMatch(
            /<SettingsDialog\s+open=\{settingsOpen\}\s+user=\{user\}\s+onOpenChange=\{setSettingsOpen\}\s+trigger=\{\s*<Button/,
        );
        expect(dashboardSettingsTrigger).toMatch(
            /<Button\s+ref=\{settingsTriggerRef\}\s+type="button"\s+variant="default"\s+size="icon"\s+className=\{\s*dashboardButtonClassNames\.settingsAvatar\s*\}\s+aria-label="打开设置"\s+data-sot-control="dashboard-settings"\s+data-sot-part="dashboard-user-avatar"\s+data-sot-state=\{\s*settingsOpen\s*\?\s*"open"\s*:\s*"idle"\s*\}\s+onClick=\{\(\)\s*=>\s*openSettings\("data-sources"\)\}/,
        );
        expect(button).toContain('const Comp = asChild ? Slot : "button";');
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
            '[data-sot-control="dashboard-settings"][data-sot-part="dashboard-user-avatar"]',
        );
        expect(workstation).not.toMatch(
            /className\s*=\s*(?:["'](?:mono|avatar)["']|\{["'](?:mono|avatar)["']\})/,
        );
        expect(workstation).not.toContain('className="panel list-panel"');
        expect(workstation).not.toContain('className="real-list"');
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
            OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
        );
        const recordingListContent = extractOpeningElement(
            recordingListCard,
            'data-sot-part="dashboard-recording-list-content"',
            "CardContent",
        );
        const recordingListContentClassName = expectExactStringConstInitializer(
            workstation,
            "DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME",
            EXPECTED_DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME,
        );
        expect(recordingListCard).toContain(
            'data-sot-surface="dashboard-recording-list"',
        );
        expectClassNameConstReference(
            recordingListContent,
            "DASHBOARD_RECORDING_LIST_CONTENT_CLASS_NAME",
        );
        expect(recordingListContentClassName).not.toMatch(
            OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
        );
        expect(recordingListCard).toContain(
            'data-sot-part="dashboard-recording-list-content"',
        );
        expect(globals).not.toMatch(
            DASHBOARD_RECORDING_LIST_PRIMITIVE_REPAINT_CSS_RE,
        );
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
        for (const rowSemanticToken of [
            "grid h-auto w-full",
            "grid-cols-[minmax(0,1fr)_auto]",
            "rounded-lg",
            "px-3 py-2.5",
            "[&.is-hover-demo]:bg-accent",
            "[&.is-hover-demo]:text-accent-foreground",
            "[&.is-focus-demo]:ring-[3px]",
            "[&.is-focus-demo]:ring-ring/50",
        ]) {
            expect(dashboardRecordingRowStyleHelper).toContain(
                rowSemanticToken,
            );
        }
        expect(dashboardRecordingRowStyleHelper).not.toContain(
            "[&_[data-recording-tag-chip]]",
        );
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
            'data-sot-part="dashboard-recording-status"',
            "Badge",
        );
        expect(dashboardRecordingStatusBadge).toContain(
            "dashboardRecordingStatusBadgeVariants",
        );
        expect(dashboardRecordingStatusBadge).toContain(
            'data-sot-part="dashboard-recording-status"',
        );
        expect(dashboardRecordingStatusBadge).toContain("data-sot-tone={");
        expect(workstation).not.toContain(
            'data-sot-part="dashboard-recording-status-dot"',
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-status-label"',
        );
        expect(workstation).not.toContain("<DashboardRecordingStatusBadge");
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-status"',
        );
        expect(workstation).not.toContain(
            'variant="dashboardRecording' + 'Status"',
        );
        expect(sourceReportBadgePrimitive).not.toContain(
            "dashboardRecording" + "Status:",
        );
        expect(sourceReportBadgePrimitive).not.toContain(
            'variant="dashboardRecording' + 'Status"',
        );
        expect(sourceReportBadgePrimitive).not.toContain(
            "dashboard-recording-status",
        );
        expect(sourceReportBadgePrimitive).not.toContain(
            "dashboard-recording-status-dot",
        );
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
            "const dashboardRecordingStatusDotToneClassNames = {",
            '"size-[5px] rounded-full bg-current"',
        ]) {
            expect(workstation).not.toContain(retiredDashboardStatusToken);
        }
        expect(dashboardRecordingStatusBadge).not.toContain("--system-banner-");
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-part="dashboard-recording-status"]',
            ),
        ).toEqual([]);
        expect(workstation).not.toContain("rowStatus.className");
        expect(workstation).not.toContain("rowStatus.dotClassName");
        expect(workstation).not.toContain("data-selected=");
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
            "opacity-80",
            "object-cover",
            "opacity-70",
            "text-muted-foreground",
        ]) {
            expect(dashboardRecordingRowStyleHelper).toContain(
                rowMetaOwnershipToken,
            );
        }
        const recordingRowIndex = workstation.indexOf(
            'data-sot-control="dashboard-recording-row"',
        );
        const recordingRowMetaIndex = workstation.indexOf(
            'data-sot-part="dashboard-recording-row-meta"',
            recordingRowIndex,
        );
        const recordingRowDurationIndex = workstation.indexOf(
            'data-sot-part="dashboard-recording-duration"',
            recordingRowMetaIndex,
        );
        const recordingRowSourceMark = workstation.slice(
            recordingRowMetaIndex,
            recordingRowDurationIndex,
        );
        const legacySourceMiniClassNamePattern =
            /className=(?:"[^"]*\bsrc-mini\b[^"]*"|\{[^}]*\bsrc-mini\b[^}]*\})/;

        expect(recordingRowIndex).toBeGreaterThanOrEqual(0);
        expect(recordingRowMetaIndex).toBeGreaterThanOrEqual(0);
        expect(recordingRowDurationIndex).toBeGreaterThan(
            recordingRowMetaIndex,
        );
        expect(recordingRowSourceMark).toContain(
            'data-sot-part="dashboard-recording-source-mark"',
        );
        expect(recordingRowSourceMark).toContain(
            "dashboardRecordingRowStyles.sourceMark",
        );
        expect(recordingRowSourceMark).toContain(
            "dashboardRecordingRowStyles.sourceMarkImage",
        );
        expect(recordingRowSourceMark).toContain(
            "dashboardRecordingRowStyles.sourceMarkImageCover",
        );
        expect(recordingRowSourceMark).toContain(
            "dashboardRecordingRowStyles.sourceMarkLetter",
        );
        expect(recordingRowSourceMark).toContain(
            "dashboardRecordingRowStyles.duration",
        );
        expect(
            recordingRowSourceMark.match(
                /dashboardRecordingRowStyles\.sourceMark\b/g,
            ) ?? [],
        ).toHaveLength(2);
        expect(recordingRowSourceMark).toContain('data-sot-variant="image"');
        expect(recordingRowSourceMark).toContain('data-sot-variant="letter"');
        expect(recordingRowSourceMark).toContain("data-sot-provider-cover={");
        expect(recordingRowSourceMark).not.toMatch(
            legacySourceMiniClassNamePattern,
        );
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
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-body"',
        );
        const dashboardRecordingRowBody = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-body"',
            "div",
        );
        expect(dashboardRecordingRowBody).toContain(
            "dashboardRecordingRowStyles.body",
        );
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-title"',
        );
        const dashboardRecordingRowTitle = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-title"',
            "div",
        );
        expect(dashboardRecordingRowTitle).toContain(
            "dashboardRecordingRowStyles.title",
        );
        const dashboardRecordingRowMeta = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-meta"',
            "div",
        );
        expect(dashboardRecordingRowMeta).toContain(
            "dashboardRecordingRowStyles.meta",
        );
        const dashboardRecordingRowSecondary = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-secondary"',
            "div",
        );
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
        expect(workstation).toContain(
            'data-sot-part="dashboard-recording-row-actions"',
        );
        const dashboardRecordingRowActions = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-recording-row-actions"',
            "div",
        );
        expect(dashboardRecordingRowActions).toContain(
            "dashboardRecordingRowStyles.actions",
        );
        const dashboardRecordingTagChip = extractOpeningElement(
            workstation,
            "<SotPlayerTagChip",
            "SotPlayerTagChip",
        );
        expect(dashboardRecordingTagChip).toMatch(/tag=\{\s*primaryTag\s*\}/);
        expect(dashboardRecordingTagChip).not.toContain("variant=");
        expect(dashboardRecordingTagChip).not.toContain("className=");
        expect(sotPlayerPrimitives).toContain("data-recording-tag-chip");
        expectSourceToExcludeForbiddenSubstrings(
            sourceReportBadgePrimitive,
            BADGE_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS,
        );
        expect(globals).not.toContain(
            '[data-recording-tag-chip][data-variant="recordingTagChip"]',
        );
        expect(globals).not.toContain(
            '[data-recording-tag-chip][data-variant="outline"]',
        );
        expect(workstation).not.toContain(
            "DASHBOARD_RECORDING_ROW_BUTTON_CLASS",
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
            expect(button).not.toContain(rowPrimitiveLeak);
        }
        for (const sourceMarkPrimitiveLeak of [
            "dashboardRecordingSourceMark",
            "dashboard-recording-source-mark",
            "dashboardRecordingRowStyles",
            "sourceMarkImageCover",
        ]) {
            expect(button).not.toContain(sourceMarkPrimitiveLeak);
            expect(sourceReportBadgePrimitive).not.toContain(
                sourceMarkPrimitiveLeak,
            );
        }
        expect(workstation).not.toMatch(
            /<button[\s\S]{0,260}data-sot-control="dashboard-recording-row"/,
        );
        const tagFilterStyles = extractBoundedSlice(
            workstation,
            "const dashboardRecordingTagFilterStyles = {",
            "} as const;",
        );
        for (const snippet of DASHBOARD_RECORDING_TAG_FILTER_FEATURE_OWNER_CLASS_SNIPPETS) {
            expect(tagFilterStyles).toContain(snippet);
        }
        expect(tagFilterStyles).not.toContain("z-[var(--z-popover-inline)]");
        expect(tagFilterStyles).not.toContain("shadow-lg");
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
        expect(workstation).toMatch(
            /variant=\{\s*active\s*\?\s*"secondary"\s*:\s*"ghost"\s*\}[\s\S]*data-sot-control="dashboard-recording-row"/,
        );
        const recordingListEmptyState = extractElementSlice(
            workstation,
            'data-sot-part="recording-list-state"',
            "Empty",
        );
        const recordingListEmptyOpening = extractOpeningElement(
            workstation,
            'data-sot-part="recording-list-state"',
            "Empty",
        );
        const recordingListEmptyMedia = extractOpeningElement(
            recordingListEmptyState,
            'data-sot-part="recording-list-state-icon"',
            "EmptyMedia",
        );
        const recordingListEmptyTitle = extractOpeningElement(
            recordingListEmptyState,
            'data-sot-part="recording-list-state-title"',
            "EmptyTitle",
        );
        const recordingListEmptyDescription = extractOpeningElement(
            recordingListEmptyState,
            'data-sot-part="recording-list-state-description"',
            "EmptyDescription",
        );
        expect(recordingListEmptyOpening).toContain('variant="compact"');
        expect(recordingListEmptyOpening).toContain(
            "data-list-state-block={listState}",
        );
        expect(recordingListEmptyOpening).toContain(
            "data-sot-state={listState}",
        );
        expectClassNameConstReference(
            recordingListEmptyOpening,
            "dashboardRecordingListStateStyles.root",
        );
        expect(recordingListEmptyState).toContain("<EmptyHeader>");
        expect(recordingListEmptyState).toContain("<EmptyContent");
        expect(recordingListEmptyState).toContain("<FileText />");
        expect(recordingListEmptyState).toMatch(
            /<EmptyContent\s+className=\{\s*dashboardRecordingListStateStyles\.content\s*\}/,
        );
        expect(recordingListEmptyMedia).toContain('variant="subtleIcon"');
        expect(recordingListEmptyTitle).toContain('variant="compact"');
        expect(recordingListEmptyDescription).toContain('variant="compact"');
        for (const removedStateClassRef of [
            "dashboardRecordingListStateStyles.icon",
            "dashboardRecordingListStateStyles.title",
            "dashboardRecordingListStateStyles.description",
            "dashboardButtonClassNames.listStatePrimary",
            "dashboardButtonClassNames.listStateAction",
        ]) {
            expect(recordingListEmptyState).not.toContain(removedStateClassRef);
        }
        expect(workstation).not.toContain("listStatePrimary:");
        expect(workstation).not.toContain("listStateAction:");
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
            const listStateButton = extractOpeningElement(
                recordingListEmptyState,
                `data-sot-control="${control}"`,
                "Button",
            );
            expect(listStateButton).toContain(`variant="${variant}"`);
            expect(listStateButton).toContain('size="sm"');
            expect(listStateButton).not.toContain("className=");
        }
        for (const control of [
            "recording-list-prev-page",
            "recording-list-next-page",
            "recording-list-load-more",
        ]) {
            expect(workstation).toMatch(
                new RegExp(
                    `<Button\\s+variant="ghost"\\s+size="sm"\\s+className=\\{\\s*dashboardButtonClassNames\\.listPagination\\s*\\}[\\s\\S]*data-sot-control="${control}"`,
                ),
            );
        }
        expect(workstation).toContain("aria-current={");
        expect(workstation).not.toContain(staticJsxClassName("filter-row"));
        expect(workstation).not.toContain('"chip-f"');
        expect(workstation).not.toContain('"chip-f active"');
        expect(workstation).not.toContain('className="chip-c"');
        expect(workstation).not.toContain('className="row"');
        expect(workstation).not.toContain('"row active"');
        expect(workstation).not.toContain('className="body"');
        expect(workstation).not.toContain('className="title"');
        expect(workstation).not.toContain('className="meta"');
        expect(workstation).not.toContain('className="dur"');
        expect(workstation).not.toContain('className="right"');
        for (const migratedSelectorFragment of DASHBOARD_RECORDING_ROW_META_MIGRATED_GLOBAL_SELECTOR_FRAGMENTS.filter(
            (selector) => selector.includes("dashboard-recording-source-mark"),
        )) {
            expect(globals).not.toContain(migratedSelectorFragment);
        }
        expect(workstation).toContain("<Button");
        expect(librarySearch).toContain('data-sot-control="dashboard-search"');
        expect(librarySearch).toContain("librarySearchClassNames.trigger");
        expect(workstation).toContain('data-sot-control="dashboard-activity"');
        expect(workstation).toContain(
            "dashboardSearchActivityClassNames.dashboardActivityTrigger",
        );
        expect(dashboardRecordingPlayerControls).toContain("<Button");
        expect(dashboardRecordingPlayerControls).toContain("<Slider");
        expect(dashboardRecordingPlayerControls).toContain("<PopoverContent");
        expect(dashboardRecordingPlayerControls).not.toContain(
            "<SotPlayerControlButton",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "<SotPlayerPrimaryButton",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "<SotPlayerSpeedButton",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "<SotPlayerSeekSlider",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "<SotPlayerVolumeSlider",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "<SotPlayerVolumePopoverContent",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            'controlSize="sm"',
        );
        expect(dashboardRecordingPlayerControls).toContain('variant="ghost"');
        expect(dashboardRecordingPlayerControls).toContain('variant="default"');
        expect(dashboardRecordingPlayerControls).toContain('size="icon"');
        expect(dashboardRecordingPlayerControls).toContain('size="icon-lg"');
        expect(dashboardRecordingPlayerControls).toContain('size="icon-sm"');
        expect(dashboardRecordingPlayerControls).toContain('size="sm"');
        for (const removedPlayerProp of [
            `variant="${"playerControl"}"`,
            `size="${"playerControl"}"`,
            `variant="${"playerPrimary"}"`,
            `size="${"playerControlLg"}"`,
            `variant="${"playerSpeed"}"`,
            `size="${"playerSpeed"}"`,
            `size="${"playerControlSm"}"`,
        ]) {
            expect(dashboardRecordingPlayerControls).not.toContain(
                removedPlayerProp,
            );
        }
        expect(dashboardRecordingPlayerControls).not.toContain(
            "SOT_PLAYER_BUTTON_CLASS",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "SOT_PLAYER_PRIMARY_BUTTON_CLASS",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "SOT_PLAYER_BUTTON_SM_CLASS",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "SOT_PLAYER_SPEED_BUTTON_CLASS",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "SOT_PLAYER_SEEK_SLIDER_CLASS",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "SOT_PLAYER_SEEK_RANGE_CLASS",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "SOT_PLAYER_SEEK_THUMB_CLASS",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "SOT_PLAYER_VOLUME_SLIDER_CLASS",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "dashboardSeekSliderRootStyle",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "sotPlayerSeekRangeStyle",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "sotPlayerSeekThumbStyle",
        );
        expect(dashboardRecordingPlayerControls).not.toContain(
            "SotPlayerSliderTrackStyle",
        );
        const transcriptLanguageBadge = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-language"',
            "Badge",
        );
        expect(transcriptLanguageBadge).toContain('variant="outline"');
        expect(transcriptLanguageBadge).toContain(
            `className="${EXPECTED_DASHBOARD_TRANSCRIPT_LANGUAGE_BADGE_CLASS_NAME}"`,
        );
        expectSourceToExcludeForbiddenSubstrings(
            sourceReportBadgePrimitive,
            BADGE_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS,
        );
        const dashboardTranscriptActions = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-transcript-actions"',
            "div",
        );
        expect(dashboardTranscriptActions).toContain(
            `className="${EXPECTED_DASHBOARD_TRANSCRIPT_ACTIONS_CLASS_NAME}"`,
        );
        const dashboardLocalCopyButton = extractElementSlice(
            workstation,
            'data-sot-control="copy-local-transcript"',
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
        expect(dashboardCopyIcon).toContain(
            'data-sot-part="dashboard-copy-icon"',
        );
        expect(dashboardCopyIcon).not.toContain("dashboardLocalCopyClassNames");
        expect(dashboardCopyIcon).toContain('state === "ok" ? Check');
        expect(dashboardCopyIcon).toContain('state === "err" ? X : Copy');
        const dashboardCopyLabel = extractBoundedSlice(
            workstation,
            "function DashboardCopyLabel",
            "function getRetxStateFromActiveJob",
        );
        expect(dashboardCopyLabel).toContain(
            'data-sot-part="dashboard-copy-label"',
        );
        expect(dashboardCopyLabel).not.toContain(
            "dashboardLocalCopyClassNames",
        );
        const sourceReportCopyButton = extractBoundedSlice(
            sourceReportPrimitives,
            "export function SourceReportCopyButton",
            "export function SourceReportActionButton",
        );
        const sourceReportPane = extractBoundedSlice(
            sourceReportPrimitives,
            "export function SourceReportPane",
            "export function SourceReportDescription",
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
        expect(sourceReportPanel).toContain("SourceReportAvailabilitySnapshot");
        expect(sourceReportPanel).toContain("onAvailabilityChange?.({");
        expect(sourceReportPanel).toContain("transcriptAvailable,");
        expect(sourceReportPanel).toContain("reportAvailable,");
        expect(sourceReportPanel).toContain(
            "const sourceTranscriptCopyState =",
        );
        expect(sourceReportPanel).toContain("const sourceReportCopyState =");
        expect(sourceReportPanel).toContain(
            'copyingKey === "source-transcript" || !transcriptAvailable;',
        );
        expect(sourceReportPanel).toContain(
            'copyingKey === "source-report" || !reportAvailable;',
        );
        expect(sourceReportPanel).toContain(
            "<SourceReportPane className={className} state={sourceReportState}>",
        );
        expect(sourceReportPanel).not.toContain(
            "@/features/source-report/styles",
        );
        expect(sourceReportPanel).not.toContain("JSON.stringify(data.detail");

        expect(sourceReportPane).toContain('surface === "dashboard"');
        expect(sourceReportPane).toContain('"dashboard-source-report"');
        expect(sourceReportPane).toContain('"recording-source-report"');
        expect(sourceReportPane).toContain("data-testid={testId}");
        expect(sourceReportPane).toContain("data-state={state}");
        expect(sourceReportPane).toContain('aria-busy={state === "loading"}');
        expect(sourceReportPane).toContain("hidden={hidden}");
        expect(sourceReportCopyButton).toContain(
            "data-testid={`source-report-copy-${copy}`}",
        );
        expect(sourceReportCopyButton).toContain(
            "data-state={feedbackState ?? copyState}",
        );
        expect(sourceReportCopyButton).toContain("data-tab-scope={tabScope}");
        expect(sourceReportCopyButton).toContain("variant={variant}");
        expect(sourceReportCopyButton).toContain('size="xs"');
        expect(sourceReportPrimitives).toContain(
            'testId="dashboard-source-report-state"',
        );
        expect(sourceReportPrimitives).toContain("data-substate={subState}");
        expect(sourceReportPrimitives).toContain(
            "data-testid={`source-report-missing-${state}`}",
        );
        expect(sourceReportPrimitives).toContain(
            'data-testid="source-report-empty-surface"',
        );
        expect(sourceReportPrimitives).toContain(
            "data-testid={`source-report-metric-${metric}`}",
        );
        expect(sourceReportPrimitives).toContain(
            "data-testid={`source-report-section-${section}`}",
        );
        expect(sourceReportPrimitives).not.toMatch(
            /SotSourceReport|data-sot-source-report|sourceReportSotStyles|SourceReportStyleVariables/,
        );

        const dashboardSourceReportPane = extractOpeningElement(
            workstation,
            'surface="dashboard"',
            "SourceReportPane",
        );
        expect(dashboardSourceReportPane).toContain(
            "className={dashboardTabPaneHiddenClassName}",
        );
        expect(dashboardSourceReportPane).toContain(
            "state={sourceReportVisualState}",
        );
        expect(dashboardSourceReportPane).toContain(
            'hidden={detailTab !== "source"}',
        );
        expect(workstation).toContain("<DashboardSourceReportState");
        expect(workstation).toContain(
            '<DashboardSourceReportState state="loading">',
        );
        expect(workstation).toContain(
            '<DashboardSourceReportState state="error">',
        );
        expect(workstation).toContain("subState={sourceReportSubState}");
        expect(workstation).toContain("<SourceReportMetricCards>");
        expect(workstation).toContain("<SourceReportSection");
        expect(workstation).toContain("<SourceReportSegments");
        expect(workstation).toContain("<SourceReportMetaList");
        expect(workstation).toContain('testId="source-report-open-source"');
        expect(workstation).toContain('testId="source-report-repull"');
        expect(workstation).not.toContain("SotSourceReport");

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
            expect(dashboardCopy).toContain(`copyState={${copyState}}`);
            expect(dashboardCopy).toContain(`disabled={${copyDisabled}}`);
        }
        expect(workstation).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps dashboard detail actions, AI rename, and retx states inline in SOT", () => {
        const workstation = readSource("features/dashboard/workstation.tsx");
        const dashboardRecordingPlayerControls = readSource(
            "features/dashboard/components/dashboard-recording-player-controls.tsx",
        );
        const aiRenamePreview = readSource(
            "features/recordings/components/ai-rename-preview-card.tsx",
        );
        const sourceReportPrimitives = readSource(
            "features/source-report/primitives.tsx",
        );
        const badge = readSource("components/ui/badge.tsx");
        const button = readSource("components/ui/button.tsx");
        const card = readSource("components/ui/card.tsx");
        const input = readSource("components/ui/input.tsx");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const globals = readSource("app/globals.css");
        const dashboardTranscriptShell = extractCardSlice(
            workstation,
            'data-sot-panel="dashboard-transcript-shell"',
        );
        const dashboardTranscriptLoadingTurn = extractBoundedSlice(
            workstation,
            "key={`transcript-skeleton:",
            ") : turns.length ? (",
        );
        const dashboardTranscriptReadyTurn = extractBoundedSlice(
            workstation,
            "turns.map((turn, index) => {",
            ") : (",
        );
        const headerPanelIndex = workstation.indexOf(
            'data-sot-panel="dashboard-detail-header"',
        );
        const headerStart = workstation.lastIndexOf(
            "<CardHeader",
            headerPanelIndex,
        );
        const headerEnd = workstation.indexOf("</CardHeader>", headerStart);
        const dashboardDetailHeader = workstation.slice(
            headerStart,
            headerEnd + "</CardHeader>".length,
        );
        const legacyHeaderClassNamePattern =
            /className=(?:"[^"]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^"]*"|\{[^}]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^}]*\})/;

        expect(headerPanelIndex).toBeGreaterThanOrEqual(0);
        expect(workstation).not.toContain("text-white");
        expect(headerStart).toBeGreaterThanOrEqual(0);
        expect(headerEnd).toBeGreaterThan(headerStart);
        expect(workstation).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(workstation).toContain(
            'import { Input } from "@/components/ui/input";',
        );
        expect(badge).toContain('data-slot="badge"');
        expectSourceToExcludeForbiddenSubstrings(
            badge,
            BADGE_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS,
        );
        expect(button).toContain('data-slot="button"');
        expect(button).toContain("data-variant={variant}");
        expect(button).toContain("data-size={size}");
        expect(card).toContain('data-slot="card-header"');
        expectSourceToExcludeForbiddenSubstrings(
            card,
            CARD_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS,
        );
        expect(input).toContain('data-slot="input"');
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
        expect(input).not.toContain("detailHeaderTitle");
        expect(input).not.toContain(
            '"h-8 min-w-0 flex-1 px-3 py-1 text-base md:text-sm"',
        );
        expect(dashboardDetailHeader).toContain("<CardHeader");
        expect(dashboardDetailHeader).toContain("<CardTitle");
        expect(dashboardDetailHeader).toContain("<Badge");
        expect(dashboardDetailHeader).toContain("<Button");
        expect(dashboardDetailHeader).toContain("<Input");
        expect(dashboardDetailHeader).toContain(
            'data-sot-panel="dashboard-detail-header"',
        );
        expect(dashboardDetailHeader).toContain("data-rename-mode");
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-title"',
        );
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-title-input"',
        );
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-title-status"',
        );
        expect(dashboardDetailHeader).toContain(
            'data-sot-part="detail-header-action"',
        );
        expect(dashboardDetailHeader).toContain("data-rh-title");
        expect(dashboardDetailHeader).toContain("data-rh-input");
        expect(dashboardDetailHeader).toContain("data-rh-status");
        expect(dashboardDetailHeader).toContain("data-rh-edit-start");
        expect(dashboardDetailHeader).toContain("data-rh-edit-save");
        expect(dashboardDetailHeader).toContain("data-rh-edit-cancel");
        expect(dashboardDetailHeader).toContain("data-rh-ai-anchor");
        expect(dashboardDetailHeader).toContain("data-rh-ai-trigger");
        expect(dashboardDetailHeader).toContain('data-sot-control="ai-rename"');
        for (const retiredDashboardDetailHeaderClassLock of [
            "SOT_DASHBOARD_DETAIL_HEADER_CLASS_NAME",
            "SOT_DASHBOARD_DETAIL_HEADER_TITLE_CLASS_NAME",
            "SOT_DASHBOARD_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME",
            "SOT_DASHBOARD_DETAIL_HEADER_BADGE_CLASS_NAME",
            "SOT_DASHBOARD_DETAIL_HEADER_ACTION_ANCHOR_CLASS_NAME",
        ]) {
            expect(workstation).not.toContain(
                retiredDashboardDetailHeaderClassLock,
            );
            expect(dashboardDetailHeader).not.toContain(
                retiredDashboardDetailHeaderClassLock,
            );
        }
        expect(dashboardDetailHeader).toContain(
            'className="relative flex flex-row items-center gap-2.5 px-1 pt-1 pb-0 data-[rename-mode=saving]:py-0"',
        );
        expect(dashboardDetailHeader).toContain(
            'className="m-0 min-w-0 flex-1 truncate font-display text-[22px] font-semibold leading-normal tracking-[-0.014em] text-foreground"',
        );
        expect(dashboardDetailHeader).toContain(
            'className="h-8 min-w-0 flex-1 px-3 py-1 text-base md:text-sm"',
        );
        expect(dashboardDetailHeader).toContain('className="ml-1 shrink-0"');
        for (const removedDashboardDetailCardBadgeVariant of [
            'variant="detailHeader"',
            'variant="detailHeaderTitle"',
            'variant="detailHeaderLocal"',
            'variant="detailHeaderStatus"',
            'controlSize="detailHeaderTitle"',
        ]) {
            expect(dashboardDetailHeader).not.toContain(
                removedDashboardDetailCardBadgeVariant,
            );
        }
        expect(dashboardDetailHeader).toContain('variant="ghost"');
        expect(dashboardDetailHeader).toContain('size="icon-sm"');
        expect(dashboardDetailHeader).toContain('variant="outline"');
        expect(dashboardDetailHeader).toContain('size="sm"');
        expect(dashboardDetailHeader).toContain(
            "dashboardButtonClassNames.headerIconButton",
        );
        expect(dashboardDetailHeader).toContain(
            "dashboardButtonClassNames.headerActionButton",
        );
        expect(dashboardDetailHeader).not.toContain(
            'variant="detailHeaderIconAction"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'size="detailHeaderIconAction"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'variant="detailHeaderAction"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'size="detailHeaderAction"',
        );
        expect(workstation).toContain(
            "const dashboardDetailHeaderState = renaming",
        );
        expect(workstation).toContain(
            "const dashboardDetailHeaderMode = editingTitle",
        );
        expect(dashboardDetailHeader).not.toContain(
            '"relative flex flex-row items-center gap-2.5 px-1 pt-1 pb-0"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'className="min-w-0 flex-1 truncate"',
        );
        expect(dashboardDetailHeader).not.toContain(
            'className="h-8 min-w-0 flex-1"',
        );
        expect(
            dashboardDetailHeader.match(
                /className="relative inline-flex items-center gap-1\.5"/g,
            ) ?? [],
        ).toHaveLength(2);
        expect(
            EXPECTED_DASHBOARD_DETAIL_HEADER_ACTION_ANCHOR_CLASS_NAME,
        ).not.toMatch(OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN);
        expect(dashboardDetailHeader).toContain(
            'dashboardDetailHeaderState === "normal"',
        );
        expect(dashboardDetailHeader).toContain(
            'dashboardDetailHeaderState === "editing"',
        );
        expect(dashboardDetailHeader).toContain(
            'dashboardDetailHeaderState === "saving"',
        );
        expect(dashboardDetailHeader).toContain('data-sot-state="saving"');
        expect(dashboardDetailHeader).toContain("localDeleteAvailable ? (");
        expect(dashboardDetailHeader).not.toMatch(legacyHeaderClassNamePattern);
        expect(globals).not.toMatch(
            /\[data-sot-panel="dashboard-detail-header"\]\s*\[data-slot="button"\]/,
        );
        expect(globals).not.toMatch(
            /:is\(\s*\[data-sot-panel="dashboard-detail-header"\],\s*\[data-sot-panel="recording-detail-header"\]\s*\)\s*\[data-slot="button"\]/,
        );
        expect(globals).not.toMatch(
            /\[data-sot-part="detail-header-title-input"\]\[data-slot="input"\]\s*{[^}]*\b(?:height|padding|border-radius|background|border|font|color|box-shadow)\s*:/,
        );
        for (const selector of [
            'data-sot-control="rename-recording-title"',
            'data-sot-control="recording-more-actions"',
            'data-sot-control="ai-rename"',
        ]) {
            expect(globals).not.toContain(selector);
        }
        const dashboardDetailHeaderLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                DASHBOARD_DETAIL_HEADER_LEGACY_PRODUCT_CSS_SELECTOR_RE.test(
                    text,
                ),
            );

        expect(dashboardDetailHeaderLegacySelectorLines).toEqual([]);
        for (const selector of [
            '[data-sot-panel="recording-detail-header"]',
            '[data-sot-part="detail-header-title-input"][data-slot="input"]',
            '[data-sot-part="detail-header-title-status"]',
            '[data-sot-part="detail-header-local-badge"]',
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
        expect(globals).not.toContain(
            '[data-sot-part="detail-header-action-anchor"]',
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
        const dashboardRetranscriptionDisabledHint = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-retranscription-disabled-hint"',
            "Badge",
        );
        expect(dashboardRetranscriptionDisabledHint).toContain(
            'variant="outline"',
        );
        expect(dashboardRetranscriptionDisabledHint).toContain(
            'className="[&[hidden]]:hidden"',
        );
        expect(dashboardRetranscriptionDisabledHint).toMatch(
            /hidden=\{\s*detailTab !== "transcript"\s*\|\|\s*dashboardRetxState !== "unavailable"\s*\}/,
        );
        const dashboardRetranscriptionBanner = extractOpeningElement(
            workstation,
            'data-sot-panel="dashboard-retranscription"',
            "Alert",
        );
        expect(dashboardRetranscriptionBanner).toContain("<Alert");
        expect(dashboardRetranscriptionBanner).toContain(
            'density="comfortable"',
        );
        expect(dashboardRetranscriptionBanner).toContain('layout="inline"');
        expect(dashboardRetranscriptionBanner).toContain(
            'className="rounded-none border-x-0 border-t-0 [&[hidden]]:hidden"',
        );
        expect(dashboardRetranscriptionBanner).toContain(
            "data-retx-state={dashboardRetxState}",
        );
        expect(dashboardRetranscriptionBanner).toMatch(
            /hidden=\{\s*dashboardRetxState === "idle"\s*\|\|\s*dashboardRetxState === "unavailable"\s*\}/,
        );
        const dashboardRetranscriptionIcon = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-retranscription-icon"',
            "span",
        );
        expect(dashboardRetranscriptionIcon).not.toContain("className=");
        expect(
            extractOpeningElement(
                workstation,
                'data-sot-part="dashboard-retranscription-body"',
                "div",
            ),
        ).not.toContain("className=");
        expect(
            extractOpeningElement(
                workstation,
                'data-sot-part="dashboard-retranscription-title"',
                "AlertTitle",
            ),
        ).toContain("<AlertTitle");
        expect(
            extractOpeningElement(
                workstation,
                'data-sot-part="dashboard-retranscription-sub"',
                "AlertDescription",
            ),
        ).toContain('density="comfortable"');
        const dashboardRetranscriptionRefreshMarker = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-retranscription-refresh-marker"',
            "Badge",
        );
        expect(dashboardRetranscriptionRefreshMarker).toContain(
            'variant="secondary"',
        );
        expect(dashboardRetranscriptionRefreshMarker).toContain(
            'className="[&[hidden]]:hidden"',
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
        expect(dashboardTranscriptShell).toContain("<Card");
        expect(dashboardTranscriptShell).toContain("hasNoPadding");
        expect(dashboardTranscriptShell).toContain(
            `className="${EXPECTED_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME}"`,
        );
        expect(dashboardTranscriptShell).not.toContain("backdrop-blur-none");
        expect(dashboardTranscriptShell).toContain(
            'data-sot-panel="dashboard-transcript-shell"',
        );
        expect(dashboardTranscriptShell).toContain("<CardHeader");
        const dashboardTranscriptHeader = extractOpeningElement(
            dashboardTranscriptShell,
            'data-sot-part="dashboard-transcript-header"',
            "CardHeader",
        );
        const dashboardTranscriptSegmentedTabs = extractOpeningElement(
            dashboardTranscriptShell,
            'data-sot-control="segmented-tabs"',
            "SegmentedTabs",
        );
        expect(dashboardTranscriptHeader).toContain(
            `className="${EXPECTED_DASHBOARD_TRANSCRIPT_HEADER_CLASS_NAME}"`,
        );
        expect(dashboardTranscriptSegmentedTabs).toContain(
            `className="${EXPECTED_DASHBOARD_TRANSCRIPT_SEGMENTED_TABS_CLASS_NAME}"`,
        );
        for (const className of [
            EXPECTED_DASHBOARD_TRANSCRIPT_SHELL_CARD_CLASS_NAME,
            EXPECTED_DASHBOARD_TRANSCRIPT_HEADER_CLASS_NAME,
            EXPECTED_DASHBOARD_TRANSCRIPT_SEGMENTED_TABS_CLASS_NAME,
            EXPECTED_DASHBOARD_TRANSCRIPT_BODY_BASE_CLASS_NAME,
        ]) {
            expect(className).not.toMatch(
                OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
            );
        }
        expect(dashboardTranscriptShell).toContain("<CardContent");
        const dashboardTranscriptBody = extractOpeningElement(
            dashboardTranscriptShell,
            'data-sot-part="dashboard-transcript-body"',
            "CardContent",
        );
        expect(dashboardTranscriptBody).toContain(
            `className="${EXPECTED_DASHBOARD_TRANSCRIPT_BODY_BASE_CLASS_NAME}"`,
        );
        expect(dashboardTranscriptBody).not.toContain(
            "dashboardScrollbarClassName",
        );
        expect(dashboardTranscriptShell).not.toContain(
            "dashboardRetranscriptionThemeClassName",
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-header"',
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-actions"',
        );
        expect(dashboardTranscriptShell).toContain(
            'data-sot-part="dashboard-transcript-body"',
        );
        for (const hook of DASHBOARD_DETAIL_PANE_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        const dashboardSpeakersMerge = extractOpeningElement(
            workstation,
            'data-sot-control="dashboard-speakers-merge"',
            "Button",
        );
        expect(dashboardSpeakersMerge).toContain('variant="ghost"');
        expect(dashboardSpeakersMerge).toContain('size="sm"');
        expect(dashboardSpeakersMerge).toContain(
            "dashboardButtonClassNames.speakersMerge",
        );
        expect(dashboardSpeakersMerge).not.toContain(
            'variant="dashboardSpeakersMerge"',
        );
        expect(dashboardSpeakersMerge).not.toContain(
            'size="dashboardSpeakersMerge"',
        );
        const dashboardSpeakerPaneClassNames = extractBoundedSlice(
            workstation,
            "const dashboardSpeakerPaneClassNames = {",
            "} as const;",
        );
        const dashboardSpeakerAvatar = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-speaker-avatar"',
            "Badge",
        );
        const dashboardSpeakerSub = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-speaker-sub"',
            "Badge",
        );
        const dashboardSpeakerBar = extractOpeningElement(
            workstation,
            'data-sot-part="dashboard-speaker-bar"',
            "Progress",
        );
        const dashboardSpeakerEmpty = extractElementSlice(
            workstation,
            'data-sot-state="empty"',
            "li",
        );
        expect(dashboardSpeakerPaneClassNames).toContain(
            'headTitle: "flex-1 text-sm font-medium text-muted-foreground"',
        );
        expect(dashboardSpeakerPaneClassNames).toContain("hover:bg-accent");
        expect(dashboardSpeakerPaneClassNames).toContain('bar: "h-1 bg-muted"');
        expect(dashboardSpeakerPaneClassNames).toContain(
            'barFill: "bg-primary"',
        );
        for (const forbiddenSpeakerPaneToken of [
            "DASHBOARD_SPEAKER_SHARE_CLASS_NAMES",
            "getDashboardSpeakerShareClassName",
            "grid-cols-[28px_1fr_120px_auto]",
            "hover:bg-[var(--bg-recessed)]",
            "text-[var(--fg-",
            "bg-[var(--",
            "border-[var(--",
            "dark:",
            "[font:",
        ]) {
            expect(dashboardSpeakerPaneClassNames).not.toContain(
                forbiddenSpeakerPaneToken,
            );
        }
        expect(workstation).not.toContain(
            "DASHBOARD_SPEAKER_SHARE_CLASS_NAMES",
        );
        expect(workstation).not.toContain("getDashboardSpeakerShareClassName");
        expect(workstation).toContain("DASHBOARD_SPEAKER_SHARE_VALUES");
        expect(workstation).toContain("getDashboardSpeakerShareValue");
        expect(dashboardSpeakerAvatar).toContain('variant="secondary"');
        expect(dashboardSpeakerAvatar).toContain(
            "dashboardSpeakerPaneClassNames.avatar",
        );
        expect(dashboardSpeakerSub).toContain('variant="outline"');
        expect(dashboardSpeakerSub).toContain(
            "dashboardSpeakerPaneClassNames.sub",
        );
        expect(dashboardSpeakerBar).toContain("value={shareValue}");
        expect(dashboardSpeakerBar).toContain(
            "dashboardSpeakerPaneClassNames.bar",
        );
        expect(dashboardSpeakerBar).toContain(
            "dashboardSpeakerPaneClassNames.barFill",
        );
        expect(dashboardSpeakerBar).toContain('"dashboard-speaker-bar-fill"');
        expect(dashboardSpeakerEmpty).toContain("<Empty");
        expect(dashboardSpeakerEmpty).toContain('variant="compact"');
        expect(dashboardSpeakerEmpty).toContain("<EmptyMedia");
        expect(dashboardSpeakerEmpty).toContain("<EmptyTitle");
        expect(dashboardSpeakerEmpty).toContain("<EmptyDescription");
        for (const hook of DASHBOARD_TRANSCRIPT_TURN_EMPTY_SOT_HOOKS) {
            expect(workstation).toContain(hook);
        }
        for (const legacyClassName of DASHBOARD_DETAIL_PANE_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toContain(legacyClassName);
        }
        for (const legacyClassName of DASHBOARD_TRANSCRIPT_TURN_EMPTY_LEGACY_CLASS_NAMES) {
            expect(workstation).not.toContain(legacyClassName);
        }
        for (const legacyClass of [
            'className="transcript"',
            'className="transcript-head"',
            'className="transcript-body"',
        ]) {
            expect(dashboardTranscriptShell).not.toContain(legacyClass);
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
        expect(dashboardTranscriptLoadingTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-row"',
        );
        expect(dashboardTranscriptLoadingTurn).toContain(
            'data-sot-state="loading"',
        );
        for (const token of DASHBOARD_TRANSCRIPT_SKELETON_LOCAL_COMPOSITION_TOKENS) {
            expect(workstation).toContain(token);
        }
        expect(workstation).toContain("function DashboardTranscriptSkeleton");
        expect(dashboardTranscriptLoadingTurn).toContain(
            "<DashboardTranscriptSkeleton",
        );
        expect(dashboardTranscriptLoadingTurn).not.toContain("<Skeleton");
        for (const token of DASHBOARD_TRANSCRIPT_SKELETON_SHARED_TOKENS) {
            expect(skeletonPrimitive).not.toContain(token);
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
        expect(workstation).not.toContain("dashboardTranscriptSkeletonSize");
        expect(workstation).not.toContain("dashboardTranscriptAvatar");
        expect(globals).not.toContain(
            '[data-sot-part="dashboard-transcript-skeleton"][data-slot="skeleton"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="dashboard-transcript-skeleton"][data-sot-size="avatar"]',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-row"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-state="ready"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-name"',
        );
        expect(dashboardTranscriptReadyTurn).toContain(
            'data-sot-part="dashboard-transcript-speaker-time"',
        );
        for (const localTurnSlice of [
            dashboardTranscriptLoadingTurn,
            dashboardTranscriptReadyTurn,
        ]) {
            expect(localTurnSlice).not.toContain('className="speaker"');
            expect(localTurnSlice).not.toContain('className="speaker-name"');
        }
        expect(workstation).toContain('aria-label="详情标签"');
        expect(dashboardRecordingPlayerControls).toContain(
            'aria-label={isPlaying ? "暂停" : "播放"}',
        );
        expect(workstation).toContain("previewAutoRename");
        expect(workstation).toContain("applyAiRename");
        expect(workstation).toContain("<AiRenamePreview");
        expect(workstation).toContain("state={aiState}");
        expect(workstation).toContain('title="AI 标题预览"');
        expect(collectAiRenamePrimitiveBusinessTokens()).toEqual([]);
        expect(aiRenamePreview).toContain('data-sot-panel="ai-rename-preview"');
        expect(aiRenamePreview).toContain('data-open="true"');
        expect(aiRenamePreview).toContain("data-sot-state={state}");
        expect(aiRenamePreview).toContain("aria-labelledby={titleId}");
        expect(aiRenamePreview).toContain(
            "aria-describedby={subtitle ? descriptionId : undefined}",
        );
        expect(aiRenamePreview).not.toContain('role="dialog"');
        expect(aiRenamePreview).not.toContain("aria-label={title}");
        expect(aiRenamePreview).toContain('from "@/components/ui/alert";');
        expect(aiRenamePreview).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(aiRenamePreview).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(aiRenamePreview).toContain('from "@/components/ui/card";');
        expect(aiRenamePreview).toContain('from "@/components/ui/popover";');
        expect(aiRenamePreview).toContain('from "@/components/ui/separator";');
        expect(aiRenamePreview).toContain("<Popover");
        expect(aiRenamePreview).toContain("<PopoverAnchor");
        expect(aiRenamePreview).toContain("<PopoverContent");
        expect(aiRenamePreview).toContain("<CardHeader");
        expect(aiRenamePreview).toContain("<CardContent");
        expect(aiRenamePreview).toContain("<CardFooter");
        expect(aiRenamePreview).toContain("<Separator");
        expect(aiRenamePreview).toContain("<Alert");
        expect(aiRenamePreview).toContain("<Badge");
        expect(aiRenamePreview).toContain("<Button");
        expect(aiRenamePreview).toContain(
            'import { Spinner } from "@/components/ui/spinner";',
        );
        expect(aiRenamePreview).toMatch(
            /const\s+aiRenamePreview[A-Za-z0-9_]*ClassNames\s*=\s*{/,
        );
        for (const {
            snippets,
        } of AI_RENAME_PREVIEW_FEATURE_OWNER_CLASS_SNIPPETS) {
            for (const snippet of snippets) {
                expect(aiRenamePreview).toContain(snippet);
            }
        }
        expectAiRenameGenericPrimitiveCall(
            aiRenamePreview,
            'data-sot-panel="ai-rename-preview"',
            "PopoverContent",
        );
        for (const primitiveCall of [
            {
                marker: 'data-sot-control="ai-rename-close"',
                tagName: "Button" as const,
            },
            {
                marker: 'data-sot-control="ai-rename-regenerate"',
                tagName: "Button" as const,
            },
            {
                marker: 'data-sot-control="ai-rename-cancel"',
                tagName: "Button" as const,
            },
            {
                marker: 'data-sot-control="ai-rename-apply"',
                tagName: "Button" as const,
            },
            {
                marker: 'data-sot-review-field="old"',
                tagName: "Badge" as const,
            },
            {
                marker: 'data-sot-review-field="new"',
                tagName: "Badge" as const,
            },
            {
                marker: 'data-sot-part="state-description"',
                tagName: "Alert" as const,
            },
        ]) {
            expectAiRenameGenericPrimitiveCall(
                aiRenamePreview,
                primitiveCall.marker,
                primitiveCall.tagName,
            );
        }
        for (const dataSotToken of [
            'data-sot-part="head"',
            'data-sot-part="body"',
            'data-sot-part="state"',
            'data-sot-part="review-row"',
            'data-sot-part="review-line"',
            'data-sot-part="review-tag"',
            'data-sot-part="review-old"',
            'data-sot-part="review-new"',
            'data-sot-part="actions"',
            'data-sot-control="ai-rename-close"',
            'data-sot-control="ai-rename-regenerate"',
            'data-sot-control="ai-rename-cancel"',
            'data-sot-control="ai-rename-apply"',
        ]) {
            expect(aiRenamePreview).toContain(dataSotToken);
        }
        expect(aiRenamePreview).toContain('data-slot="card-review-value"');
        expect(aiRenamePreview).toContain('data-review-tone="old"');
        expect(aiRenamePreview).toContain('data-review-tone="new"');
        expect(aiRenamePreview).toContain('data-sot-part="error-icon"');
        expect(aiRenamePreview).toContain("onClick={onCancel}");
        expect(aiRenamePreview).toContain("onClick={onRegenerate}");
        expect(aiRenamePreview).toContain("onClick={onApply}");
        expect(aiRenamePreview).toContain("aria-busy={isRegenerating}");
        expect(aiRenamePreview).toContain("aria-busy={isApplying}");
        expect(aiRenamePreview).toContain("disabled={isApplying}");
        expect(aiRenamePreview).toContain("disabled={isBusy || !canAct}");
        for (const retiredAiRenameToken of [
            'className="grid-cols-[1fr_auto] items-start gap-x-2 gap-y-1 border-b border-border px-4 py-3"',
            'className="flex min-h-20 flex-col px-4 py-4"',
            'className="mx-auto mb-1 size-4 animate-spin rounded-full border-2 border-border border-t-current"',
            'className="flex min-w-0 items-baseline gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-2"',
            'className="flex items-center gap-1.5 px-4 py-3"',
            "animate-spin rounded-full border-2 border-border border-t-current",
        ]) {
            expect(aiRenamePreview).not.toContain(retiredAiRenameToken);
        }
        expect(aiRenamePreview).not.toContain("!bg-");
        expect(aiRenamePreview).not.toContain("!text-");
        expect(aiRenamePreview).not.toContain("!font-");
        expect(aiRenamePreview).not.toContain("!size-");
        expect(aiRenamePreview).not.toContain("![box-shadow:");
        expect(aiRenamePreview).not.toMatch(/\bAI_RENAME_[A-Z0-9_]+_CLASS\b/);
        expect(aiRenamePreview).not.toMatch(/--ai-rename-[\w-]+/);
        expect(aiRenamePreview).not.toContain("--system-banner-");
        expect(aiRenamePreview).not.toMatch(
            /(^|[\s"'`])ai-rename-panel($|[\s"'`])/,
        );
        expect(aiRenamePreview).not.toMatch(
            /(^|[\s"'`])airp-[a-z0-9-]+($|[\s"'`])/i,
        );
        expect(aiRenamePreview).not.toContain("data-airp-");
        expect(aiRenamePreview).not.toContain("mergeAiRenameClassName");
        expect(workstation).toContain("onApply={applyAiRename}");
        expect(workstation).toContain("onRegenerate={previewAutoRename}");
        expect(workstation).toContain('aria-label="更多操作"');
        expect(workstation).toContain('from "@/components/ui/dropdown-menu"');
        expect(workstation).toContain("<DropdownMenu");
        expect(workstation).toContain("open={moreOpen}");
        expect(workstation).toContain("onOpenChange={(open) =>");
        expect(workstation).toContain("<DropdownMenuTrigger asChild>");
        expect(workstation).toContain("<DropdownMenuContent");
        expect(workstation).toContain('data-sot-menu="recording-more-actions"');
        expect(workstation).toContain('data-sot-menu-item="rename"');
        expect(workstation).toContain('data-sot-menu-item="ai-rename"');
        expect(workstation).toContain('data-sot-menu-item="retranscribe"');
        expect(workstation).toContain('data-sot-menu-item="delete-local"');
        expect(workstation).toContain('data-sot-tone="danger"');
        expect(workstation).toContain("<DropdownMenuSeparator");
        expect(workstation).toContain('data-sot-menu-separator="delete"');
        expect(workstation).toContain("data-sot-menu-hint");
        for (const compositionToken of MORE_ACTIONS_MENU_COMPOSITION_TOKENS) {
            expect(workstation).toContain(compositionToken);
        }
        expect(workstation).not.toContain('className="more-menu"');
        expect(workstation).not.toContain('className="more-menu-item"');
        expect(workstation).not.toContain('className="more-menu-sep"');
        expect(workstation).not.toContain('className="more-menu-hint"');
        expect(workstation).toContain("AI 重命名");
        expect(workstation).toContain("重新转写");
        expect(workstation).toContain("重新转写这条录音？");
        expect(workstation).toContain("确认重新转写");
        expect(workstation).toContain("逐字稿将重新生成 · 估计 1 ~ 3 分钟");
        expect(workstation).toContain("来源持有正本");
        expect(workstation).toContain("永久删除");
        expect(workstation).toContain("删除后转写、标签与 AI 标题都会一并清除");
        expect(sourceReportPrimitives).toContain(
            "data-testid={`source-report-copy-${copy}`}",
        );
        expect(sourceReportPrimitives).toContain(
            "data-state={feedbackState ?? copyState}",
        );
        expect(workstation).toContain('copy="source-transcript"');
        expect(workstation).toContain('copy="source-report"');
        expect(workstation).toContain('testId="source-report-open-source"');
        expect(workstation).toContain('testId="source-report-repull"');
        expect(workstation).not.toContain('className="more-action"');
        expect(workstation).not.toContain("more-action-l");
        expect(workstation).not.toContain("more-action-meta");
        expect(workstation).toContain("void deleteRecording()");
        expect(workstation).not.toMatch(
            DASHBOARD_WORKSTATION_LEGACY_CONTROL_RE,
        );
    });

    it("keeps settings and recording detail surfaces on SOT state contracts", () => {
        const settings = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const voscriptSection = readSource(
            "features/settings/components/sections/voscript-section.tsx",
        );
        const dataSources = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const settingFieldControl = readSource(
            "features/settings/components/setting-field-control.tsx",
        );
        const settingsDialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const detail = readSource("features/recordings/workstation.tsx");
        const player = readSource(
            "features/recordings/components/recording-player.tsx",
        );
        const sotPlayerPrimitives = readSource(
            "features/recordings/components/sot-player-primitives.tsx",
        );
        const recordingTagVisuals = readSource(
            "features/recordings/components/recording-tag-visuals.tsx",
        );
        const tagManager = readSource(
            "features/recordings/components/recording-tag-manager.tsx",
        );
        const sourceReport = readSource(
            "features/recordings/components/source-report-panel.tsx",
        );
        const sourceReportPrimitives = readSource(
            "features/source-report/primitives.tsx",
        );
        const transcriptionSection = readSource(
            "features/recordings/components/transcription-section.tsx",
        );
        const transcriptionSkeletons = readSource(
            "features/recordings/components/transcription-skeletons.tsx",
        );
        const speakerReview = readSource(
            "features/recordings/components/speaker-label-editor.tsx",
        );
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const avatarPrimitive = readSource("components/ui/avatar.tsx");
        const button = readSource("components/ui/button.tsx");
        const cardPrimitive = readSource("components/ui/card.tsx");
        const badge = readSource("components/ui/badge.tsx");
        const emptyPrimitive = readSource("components/ui/empty.tsx");
        const fieldPrimitive = readSource("components/ui/field.tsx");
        const inputPrimitive = readSource("components/ui/input.tsx");
        const inputGroupPrimitive = readSource("components/ui/input-group.tsx");
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const switchPrimitive = readSource("components/ui/switch.tsx");
        const toggleGroupPrimitive = readSource(
            "components/ui/toggle-group.tsx",
        );
        const globals = readSource("app/globals.css");
        const settingsCloseButton = extractElementSlice(
            settingsDialog,
            'aria-label={t("settingsDialog.close")}',
            "Button",
        );
        const settingsNavButton = extractElementSlice(
            settingsDialog,
            "aria-current={",
            "Button",
        );
        const settingsNavButtonClass =
            settingsDialog.match(
                /const SETTINGS_NAV_BUTTON_CLASS\s*=\s*"[^"]*";/,
            )?.[0] ?? "";
        const settingsSectionTitleClass =
            settings.match(
                /const SETTINGS_SECTION_TITLE_CLASS\s*=\s*"[^"]*";/,
            )?.[0] ?? "";

        expect(settings).toContain(
            'import { DataSourcesSection } from "./sections/data-sources-section";',
        );
        expect(settings).toContain('case "data-sources"');
        expect(settings).toContain(
            "return <DataSourcesSection scrollRef={scrollRef} />;",
        );
        expect(settings).not.toContain("function DataSourcesSettingsPanel");
        expect(settings).not.toContain("useDataSourcesSettings");
        expect(settings).not.toContain(
            'data-sot-surface="settings-data-sources"',
        );
        expect(dataSources).toContain("export function DataSourcesSection");
        expect(dataSources).toContain("useDataSourcesSettings(language)");
        expect(dataSources).toContain("aria-busy={isLoading}");
        expect(dataSources).toContain(
            "aria-controls={SOURCE_PROVIDER_DETAIL_ID}",
        );
        expect(dataSources).toContain("aria-pressed={isSelected}");
        expect(dataSources).toContain(
            "aria-labelledby={providerDetailTitleId}",
        );
        expect(dataSources).toContain(
            "aria-busy={isSourceActionStateBusy(actionState)}",
        );
        expect(dataSources).not.toContain("data-sot-");
        expect(dataSources).not.toContain("data-slot=");
        expect(settings).toContain(
            'import { VoScriptSection } from "./sections/voscript-section";',
        );
        expect(settings).toContain('case "voscript"');
        expect(settings).toContain(
            "return <VoScriptSection scrollRef={scrollRef} />;",
        );
        expect(voscriptSection).toContain("export function VoScriptSection");
        for (const inlinedVoScriptToken of [
            "function VoScriptSettingsPanel",
            "function VoScriptSpeakerRows",
            "useVoScriptSettingsStore",
            "testVoScriptConnection",
            'data-sot-control="voscript-test"',
            'data-sot-banner="voscript-unavailable"',
            "<SpeakerProfilesPanel />",
        ]) {
            expect(settings).not.toContain(inlinedVoScriptToken);
        }
        expect(settingsSectionTitleClass).toContain(
            "SETTINGS_SECTION_TITLE_CLASS",
        );
        for (const semanticClassToken of [
            "mb-[18px]",
            "text-lg",
            "font-semibold",
            "text-foreground",
        ]) {
            expect(settingsSectionTitleClass).toContain(semanticClassToken);
        }
        for (const removedOwnerClassToken of [
            "[margin:0_0_18px]",
            "font-display",
            "text-[18px]",
            "leading-[normal]",
            "tracking-[-0.012em]",
            "text-[var(--fg-primary)]",
        ]) {
            expect(settingsSectionTitleClass).not.toContain(
                removedOwnerClassToken,
            );
        }
        expect(settings).toMatch(
            /<h3\s+className=\{SETTINGS_SECTION_TITLE_CLASS\}\s+data-sot-title>\s*\{title\}\s*<\/h3>/,
        );
        expect(settings).not.toContain("<h3 data-sot-title>{title}</h3>");
        for (const selector of [
            "[data-sot-title]",
            "[data-sot-section-divider]",
            '[data-theme="dark"] [data-sot-section-divider]',
        ]) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(settingsCloseButton).toContain('variant="ghost"');
        expect(settingsCloseButton).toContain("SETTINGS_CLOSE_BUTTON_CLASS");
        expect(settingsCloseButton).toContain(
            'aria-label={t("settingsDialog.close")}',
        );
        expect(settingsCloseButton).toContain("disabled={isSettingsBusy}");
        expect(settingsCloseButton).toMatch(
            /className=\{\s*[A-Za-z0-9_]+\s*\}/,
        );
        expect(settingsCloseButton).toMatch(
            /<X\s+data-icon="inline-start"\s+aria-hidden="true"\s*\/>/,
        );
        expect(settingsCloseButton).not.toContain('variant="settingsClose"');
        expect(settingsCloseButton).not.toContain('size="settingsClose"');
        expect(settingsNavButton).toMatch(
            /variant=\{\s*isActive\s*\?\s*"outline"\s*:\s*"ghost"\s*\}/,
        );
        expect(settingsNavButton).toContain("aria-current={");
        expect(settingsNavButton).toContain("tabIndex={");
        expect(settingsNavButton).toContain("disabled={isSettingsBusy}");
        expect(settingsNavButton).not.toContain('variant="navigationItem"');
        expect(settingsNavButton).not.toContain('size="navigationItem"');
        expect(settingsDialog).toContain("const SETTINGS_NAV_BUTTON_CLASS =");
        expect(settingsNavButton).toContain("SETTINGS_NAV_BUTTON_CLASS");
        expect(settingsNavButton).toContain('data-icon="inline-start"');
        expect(settingsNavButton).toContain('className="min-w-0 truncate"');
        expect(settingsNavButton).not.toContain('variant="settingsNav"');
        expect(settingsNavButton).not.toContain('size="settingsNav"');
        expect(settingsNavButtonClass).toContain("w-full");
        expect(settingsNavButtonClass).toContain("min-w-0");
        expect(settingsNavButtonClass).toContain("justify-start");
        for (const removedNavButtonOverride of [
            "[box-shadow",
            "shadow-none",
            "data-[state=active]",
            "data-[state=inactive]",
            "bg-transparent",
            "border-transparent",
            "font-sans",
            "text-[13px]",
            "leading-[normal]",
            "tracking-normal",
            "[&_svg",
            "stroke-[",
            "var(--",
            "hover:",
            "rounded-[",
            "font-",
            "text-[",
            "tracking-",
            "leading-[",
        ]) {
            expect(settingsNavButton).not.toContain(removedNavButtonOverride);
            expect(settingsNavButtonClass).not.toContain(
                removedNavButtonOverride,
            );
        }
        const settingsAvatarClass = findStringConstInitializerContaining(
            settingsDialog,
            [
                "const SETTINGS_USER_AVATAR_CLASS =",
                "grid",
                "size-9",
                "place-items-center",
                "text-muted-foreground",
            ],
        );
        expect(settingsAvatarClass).not.toContain("[&_svg");
        expect(settingsAvatarClass).not.toContain("svg:not");
        expect(settingsAvatarClass).not.toContain("size-4");
        expect(button).not.toContain("settingsNav:");
        expect(button).not.toContain("settingsClose:");
        for (const forbiddenButtonPrimitiveSkin of [
            "navigationItem:",
            "surfaceItem:",
            "h-8 w-full min-w-0",
            "text-[13.125px]",
            "gap-[5.625px]",
            "px-[9.375px]",
            "data-[state=active]:bg-[var(--bg-recessed)]",
            "[box-shadow:none]",
            "data-[state=active]:[box-shadow:none]",
            "data-[state=active]:text-[var(--fg-primary)]",
            "data-[state=selected]:bg-[var(--bg-elevated)]",
            "data-[state=selected]:shadow-xs",
            "data-[muted=true]:border-transparent",
            "data-[muted=true]:bg-transparent",
            "data-[muted=true]:opacity-[0.55]",
            "data-[muted=true]:[box-shadow:none]",
        ]) {
            expect(button).not.toContain(forbiddenButtonPrimitiveSkin);
        }
        expect(button).not.toContain("rail:");
        expect(button).not.toContain("sr-item");
        expect(button).not.toContain("buttonStateClassName");
        expect(button).not.toContain('variant === "rail"');
        expect(button).not.toContain("oklch(");
        expect(button).not.toContain("data-sot");
        expect(button).not.toMatch(/\bsourceProvider\b/);
        expect(button).not.toMatch(/\bsettings\b/i);
        expect(avatarPrimitive).not.toMatch(/-space-[xy]-/);
        expect(avatarPrimitive).toContain("[&>*+*]:-ml-2");
        for (const selector of REMOVED_SETTINGS_NAV_GLOBAL_REPAINT_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of REMOVED_SETTINGS_DEAD_TENANT_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const settingsControlButton of [
            settingsCloseButton,
            settingsNavButton,
        ]) {
            expect(settingsControlButton).not.toContain('variant="settings');
            expect(settingsControlButton).not.toContain('size="settings');
        }
        const detailBackButton = extractElementSlice(
            detail,
            'data-sot-control="recording-detail-back"',
            "Button",
        );
        const settingsProviderDetail =
            dataSources.match(
                /<section[\s\S]*?id=\{SOURCE_PROVIDER_DETAIL_ID\}[\s\S]*?<\/section>/,
            )?.[0] ?? "";
        const sourceProviderDetailPanelClass =
            dataSources.match(
                /const SOURCE_PROVIDER_DETAIL_PANEL_CLASS\s*=\s*"[^"]*";/,
            )?.[0] ?? "";
        const providerFieldsIndex =
            settingsProviderDetail.indexOf("<FieldGroup");
        const firstProviderDividerIndex = settingsProviderDetail.indexOf(
            "SOURCE_PROVIDER_SECTION_DIVIDER_CLASS",
            providerFieldsIndex,
        );
        const autoUpdateIndex = settingsProviderDetail.indexOf(
            "automaticUpdatesFieldId",
        );
        const enableSyncIndex = settingsProviderDetail.search(
            /htmlFor=\{`\$\{selectedSource\.provider\}-enabled`\}/,
        );
        const actionClusterDividerIndex = settingsProviderDetail.indexOf(
            "SOURCE_PROVIDER_ACTION_CLUSTER_DIVIDER_CLASS",
            enableSyncIndex,
        );
        const sourceActionsIndex = settingsProviderDetail.indexOf("<footer");
        const sourceProviderFieldsListClass =
            dataSources.match(
                /const SOURCE_PROVIDER_FIELDS_LIST_CLASS\s*=\s*"([^"]*)";/,
            )?.[1] ?? "";
        const sourceProviderFieldsWrapper =
            settingsProviderDetail.match(
                /<FieldGroup\s+className=\{SOURCE_PROVIDER_FIELDS_LIST_CLASS\}\s+unstyled/,
            )?.[0] ?? "";
        const providerDetailDividers = [
            ...settingsProviderDetail.matchAll(
                /<Separator[\s\S]*?SOURCE_PROVIDER_[A-Z_]+_DIVIDER_CLASS[\s\S]*?\/>/g,
            ),
        ].map((match) => match[0]);
        expect(sourceProviderFieldsListClass.split(/\s+/)).toEqual(
            expect.arrayContaining(["flex", "flex-col", "gap-0"]),
        );
        expect(sourceProviderFieldsWrapper).toContain("<FieldGroup");
        expect(sourceProviderFieldsWrapper).toContain(
            "className={SOURCE_PROVIDER_FIELDS_LIST_CLASS}",
        );
        expect(sourceProviderFieldsWrapper).toContain("unstyled");
        expectNamedImportSymbols(dataSources, "@/components/ui/field", [
            "Field",
            "FieldContent",
            "FieldControl",
            "FieldDescription",
            "FieldGroup",
            "FieldLabel",
            "FieldTitle",
        ]);
        expectNamedImportSymbols(settings, "@/components/ui/field", [
            "FieldError",
        ]);
        expect(settingsProviderDetail).toContain(
            "SOURCE_PROVIDER_DETAIL_FIELD_CLASS",
        );
        expect(settingsProviderDetail).toContain(
            'variant="sourceProviderDetail"',
        );
        expect(settingsProviderDetail).toContain(
            "aria-labelledby={providerDetailTitleId}",
        );
        expect(settingsProviderDetail).toContain(
            "aria-busy={isSourceActionStateBusy(actionState)}",
        );
        expect(settingsProviderDetail).toContain(
            "SOURCE_PROVIDER_DETAIL_PANEL_CLASS",
        );
        expect(sourceProviderDetailPanelClass).toContain("px-[26px]");
        expect(sourceProviderDetailPanelClass).toContain("py-[22px]");
        expect(sourceProviderDetailPanelClass).not.toContain("p-6");
        expect(dataSources).toContain(
            "const SOURCE_PROVIDER_SECTION_DIVIDER_CLASS =",
        );
        expect(dataSources).toContain(
            "const SOURCE_PROVIDER_ACTION_CLUSTER_DIVIDER_CLASS =\n    SOURCE_PROVIDER_SECTION_DIVIDER_CLASS;",
        );
        expect(
            providerDetailDividers.some((divider) =>
                divider.includes("SOURCE_PROVIDER_SECTION_DIVIDER_CLASS"),
            ),
        ).toBe(true);
        expect(
            providerDetailDividers.some((divider) =>
                divider.includes(
                    "SOURCE_PROVIDER_ACTION_CLUSTER_DIVIDER_CLASS",
                ),
            ),
        ).toBe(true);
        expect(globals).not.toContain(
            '[data-sot-panel="source-provider-detail"] [data-sot-section-divider]',
        );
        expect(providerFieldsIndex).toBeGreaterThanOrEqual(0);
        expect(firstProviderDividerIndex).toBeGreaterThan(providerFieldsIndex);
        expect(autoUpdateIndex).toBeGreaterThan(firstProviderDividerIndex);
        expect(enableSyncIndex).toBeGreaterThan(autoUpdateIndex);
        expect(actionClusterDividerIndex).toBeGreaterThan(enableSyncIndex);
        expect(sourceActionsIndex).toBeGreaterThan(actionClusterDividerIndex);
        expect(detail).toContain('data-sot-shell="recording-workstation"');
        expect(detail).toContain('data-sot-panel="workstation-sidebar"');
        const workstationSidebarAside = extractElementSlice(
            detail,
            'data-sot-panel="workstation-sidebar"',
            "aside",
        );
        const recordingWorkstationSidebarClassName = extractBoundedSlice(
            detail,
            "const RECORDING_WORKSTATION_SIDEBAR_CLASS_NAME =",
            ";",
        );
        for (const classToken of [
            "relative",
            "flex",
            "flex-col",
            "border-r",
            "border-border",
            "bg-card",
            "px-3",
            "pt-4",
            "pb-3",
            "text-card-foreground",
            "max-[860px]:hidden",
        ]) {
            expect(recordingWorkstationSidebarClassName).toContain(classToken);
        }
        expect(recordingWorkstationSidebarClassName).not.toMatch(
            /\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(|#[0-9A-Fa-f]{3,8}\b|\bdark:|(?:^|\s)(?:bg|border|text|shadow|ring|fill|stroke|from|via|to)-(?:white|black|transparent|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/,
        );
        expect(workstationSidebarAside).toContain(
            "className={RECORDING_WORKSTATION_SIDEBAR_CLASS_NAME}",
        );
        expect(detail).toContain('data-sot-panel="workstation-main"');
        const workstationMain = extractElementSlice(
            detail,
            'data-sot-panel="workstation-main"',
            "main",
        );
        const recordingWorkstationMainClassName = extractBoundedSlice(
            detail,
            "const RECORDING_WORKSTATION_MAIN_CLASS_NAME =",
            ";",
        );
        for (const classToken of RECORDING_WORKSTATION_MAIN_REQUIRED_CLASS_TOKENS) {
            expect(recordingWorkstationMainClassName).toContain(classToken);
        }
        expect(workstationMain).toContain(
            "className={RECORDING_WORKSTATION_MAIN_CLASS_NAME}",
        );
        expect(globals).not.toContain('[data-sot-panel="workstation-main"]');
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-panel="workstation-main"]',
            ),
        ).toEqual([]);
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
        expect(detail).toContain('data-sot-panel="workstation-topbar"');
        expect(detail).toContain('data-sot-panel="workstation-workspace"');
        expect(globals).toContain("--z-topbar: 200;");
        for (const selector of DASHBOARD_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of WORKSTATION_TOPBAR_CRUMB_REMOVED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        const workstationWorkspace = extractOpeningElement(
            detail,
            'data-sot-panel="workstation-workspace"',
            "div",
        );
        const recordingWorkstationWorkspaceClassName =
            expectExactStringConstInitializer(
                detail,
                "RECORDING_WORKSTATION_WORKSPACE_CLASS_NAME",
                EXPECTED_RECORDING_WORKSTATION_WORKSPACE_CLASS_NAME,
            );
        expect(workstationWorkspace).toContain(
            "className={RECORDING_WORKSTATION_WORKSPACE_CLASS_NAME}",
        );
        expect(recordingWorkstationWorkspaceClassName).not.toMatch(
            OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
        );
        for (const selector of DASHBOARD_WORKSPACE_MIGRATED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).not.toContain(
            '[data-sot-panel="dashboard-workspace"]\n        > [data-sot-panel="dashboard-detail"]',
        );
        expect(globals).not.toContain(
            '[data-sot-panel="dashboard-detail"],\n[data-sot-panel="recording-workstation-detail"],\n[data-sot-panel="recording-workstation-detail-body"]',
        );
        const recordingDetailPanel = extractOpeningElement(
            detail,
            'data-sot-panel="recording-workstation-detail"',
            "section",
        );
        const recordingDetailBodyPanel = extractOpeningElement(
            detail,
            'data-sot-panel="recording-workstation-detail-body"',
            "section",
        );
        for (const { expected, openingElement, constName } of [
            {
                expected:
                    EXPECTED_RECORDING_WORKSTATION_DETAIL_PANEL_CLASS_NAME,
                openingElement: recordingDetailPanel,
                constName: "RECORDING_WORKSTATION_DETAIL_PANEL_CLASS_NAME",
            },
            {
                expected: EXPECTED_DETAIL_PANEL_CLASS_NAME,
                openingElement: recordingDetailBodyPanel,
                constName: "RECORDING_WORKSTATION_DETAIL_BODY_CLASS_NAME",
            },
        ]) {
            const ownerClassName = expectExactStringConstInitializer(
                detail,
                constName,
                expected,
            );
            expectClassNameConstReference(openingElement, constName);
            expect(ownerClassName).not.toMatch(
                OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
            );
        }
        expect(globals).toContain(
            '[data-sot-control="dashboard-sync"][disabled] {\n    pointer-events: none;',
        );
        expect(detail).toContain(
            'data-sot-panel="recording-workstation-detail"',
        );
        expect(detail).toContain('data-sot-control="recording-detail-back"');
        expect(button).not.toContain("recordingDetailBack:");
        expect(detailBackButton).toContain('variant="secondary"');
        expect(detailBackButton).toContain('size="default"');
        expect(detailBackButton).toContain(
            "recordingWorkstationButtonClassNames.detailBack",
        );
        expect(detailBackButton).not.toContain('variant="recordingDetailBack"');
        expect(detailBackButton).not.toContain('size="recordingDetailBack"');
        expect(detailBackButton).toContain(
            'navigateBrowserRoute(router, "/dashboard")',
        );
        expect(detailBackButton).toContain('data-sot-state="selected"');
        expect(detailBackButton).toContain("<ArrowLeft");
        expect(detailBackButton).toContain('data-icon="inline-start"');
        expect(detailBackButton).toContain('{t("recording.backToDashboard")}');
        expect(detailBackButton).not.toContain('variant="recordingDetailBack"');
        expect(detail).toContain("[&_span]:truncate");
        expect(detail).not.toContain("[&_svg]:stroke-[");
        expect(detail).not.toContain("[&_svg]:opacity-[");
        expect(detail).not.toContain("[&_svg]:[stroke-linecap");
        expect(detail).not.toContain("[&_svg]:[stroke-linejoin");
        expect(detail).not.toContain("data-[sot-state=selected]:bg-[");
        expect(detail).not.toContain("data-[sot-state=selected]:border-[");
        expect(detail).not.toContain("data-[sot-state=selected]:text-[");
        expect(detail).not.toContain(
            'className="flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3"',
        );
        expect(detail).not.toContain(
            'className="px-2.5 pb-1.5 pt-3.5 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-tertiary)]"',
        );
        expect(detail).not.toContain('className="app"');
        expect(detail).not.toContain('className="sidebar glass glass-strong"');
        expect(detail).not.toContain('className="workspace"');
        expect(detail).not.toContain('className="detail"');
        const settingsProviderTileButton = extractOpeningElement(
            dataSources,
            "aria-controls={SOURCE_PROVIDER_DETAIL_ID}",
            "Button",
        );
        const settingsProviderStatusBadge = extractElementSlice(
            dataSources,
            "className={SOURCE_PROVIDER_STATUS_BADGE_CLASS}",
            "Badge",
        );
        const settingsProviderDetailStatusBadge =
            dataSources.match(
                /<Badge[\s\S]*?className=\{SOURCE_DETAIL_STATUS_BADGE_CLASS\}[\s\S]*?>/,
            )?.[0] ?? "";
        const settingsProviderStatusBadgeClass =
            dataSources.match(
                /const SOURCE_PROVIDER_STATUS_BADGE_CLASS[\s\S]*?;/,
            )?.[0] ?? "";
        const settingsProviderTileClass =
            dataSources.match(
                /const SOURCE_PROVIDER_TILE_BUTTON_CLASS[\s\S]*?;/,
            )?.[0] ?? "";
        const settingsStatusBadgeConstants = [
            ...dataSources.matchAll(
                /const\s+[A-Z0-9_]*STATUS[A-Z0-9_]*BADGE_CLASS\s*=[\s\S]*?;/g,
            ),
        ]
            .map((match) => match[0])
            .join("\n");
        expect(settingsProviderTileButton).toMatch(
            /variant=\{\s*isSelected\s*\?\s*"secondary"\s*:\s*"ghost"\s*\}/,
        );
        expect(settingsProviderTileButton).not.toContain(
            'variant="surfaceItem"',
        );
        expect(settingsProviderTileButton).not.toContain('size="surfaceItem"');
        expect(settingsProviderTileButton).toContain(
            "SOURCE_PROVIDER_TILE_BUTTON_CLASS",
        );
        expect(settingsProviderTileButton).not.toContain("isDimmed &&");
        expect(settingsProviderTileButton).not.toContain("opacity-");
        expect(settingsProviderTileButton).not.toContain("data-muted=");
        expect(settingsProviderTileButton).toContain(
            "aria-pressed={isSelected}",
        );
        expect(settingsProviderTileButton).toContain("disabled={disabled}");
        expect(dataSources).toContain("SOURCE_PROVIDER_TILE_BUTTON_CLASS");
        expect(dataSources).not.toContain('variant="sourceProviderTile"');
        expect(dataSources).not.toContain('size="sourceProviderTile"');
        for (const removedProviderTileSkinToken of [
            "border-[var(",
            "text-[var(",
            "[box-shadow",
            "hover:bg-[",
            "hover:text-[",
            "data-[muted=true]",
            "data-[state=selected]",
            "shadow-xs",
        ]) {
            expect(settingsProviderTileClass).not.toContain(
                removedProviderTileSkinToken,
            );
        }
        expect(dataSources).not.toContain("data-sot-");
        expect(dataSources).not.toContain("sp-card");
        expect(dataSources).not.toContain("sp-ico");
        expect(dataSources).not.toContain("sp-meta");
        expect(dataSources).not.toContain("sp-status");
        expect(settingsProviderStatusBadge).toContain(
            "variant={getProviderStatusBadgeVariant(status.tone)}",
        );
        expect(settingsProviderStatusBadge).not.toContain('size="statusPill"');
        expect(settingsProviderStatusBadge).toContain(
            "className={SOURCE_PROVIDER_STATUS_BADGE_CLASS}",
        );
        expect(settingsProviderStatusBadge).toContain('role="status"');
        expect(settingsProviderStatusBadge).toContain(
            "aria-label={`${displayName}:",
        );
        expect(settingsProviderDetailStatusBadge).toContain(
            "variant={getProviderStatusBadgeVariant",
        );
        expect(settingsProviderDetailStatusBadge).toContain(
            "className={SOURCE_DETAIL_STATUS_BADGE_CLASS}",
        );
        expect(settingsProviderDetailStatusBadge).not.toContain(
            'size="statusPill"',
        );
        expect(dataSources).not.toContain("SOURCE_STATUS_BADGE_CLASS");
        expectSourceProviderStatusBadgeClassIsLayoutOnly(
            settingsProviderStatusBadgeClass,
        );
        for (const featureStatusPillToken of [
            "h-[18px]",
            "gap-[4px]",
            "rounded-[999px]",
            "px-[7px]",
            "py-0",
            "text-[10.5px]",
            "font-semibold",
            "border-solid",
        ]) {
            expect(settingsStatusBadgeConstants).not.toContain(
                featureStatusPillToken,
            );
            if (featureStatusPillToken === "py-0") {
                expect(badge).not.toMatch(/(?:^|[\s"'])py-0(?:[\s"'])/);
            } else {
                expect(badge).not.toContain(featureStatusPillToken);
            }
        }
        expect(dataSources).toContain('tone: "personal"');
        expect(dataSources).toContain("<ToggleGroup");
        expect(dataSources).toContain("<ToggleGroupItem");
        expect(dataSources).toContain("<Badge");
        const settingsSourceAuthModeControl = extractElementSlice(
            dataSources,
            'type="single"',
            "ToggleGroup",
        );
        expect(settingsSourceAuthModeControl).toContain('variant="outline"');
        expect(settingsSourceAuthModeControl).toContain("spacing={2}");
        expect(settingsSourceAuthModeControl).toContain("className=");
        expect(settingsSourceAuthModeControl).not.toContain(
            'layout="settingsSourceAuthMode"',
        );
        expect(settingsSourceAuthModeControl).not.toContain(
            'variant="settingsSourceAuthModeOption"',
        );
        expect(settingsSourceAuthModeControl).not.toContain(
            'size="settingsSourceAuthModeOption"',
        );
        expect(settingsSourceAuthModeControl).not.toContain(
            'spacing="settingsSourceAuthMode"',
        );
        expect(settingsSourceAuthModeControl).not.toContain(
            'variant="sourceAuthModeBadge"',
        );
        expect(settingsSourceAuthModeControl).not.toContain(
            'variant="secondary"',
        );
        expect(settingsSourceAuthModeControl).not.toContain('size="lg"');
        expect(settingsSourceAuthModeControl).not.toContain(
            'className="mb-4 grid w-full grid-cols-2 items-stretch"',
        );
        expect(settingsSourceAuthModeControl).not.toContain(
            'className="h-auto flex-col items-start justify-start whitespace-normal px-3.5 py-3 text-left"',
        );
        expect(settingsSourceAuthModeControl).toContain(
            "disabled={interactionDisabled}",
        );
        expect(settingsSourceAuthModeControl).toContain(
            "value={selectedSource.authMode}",
        );
        expect(dataSources).toMatch(
            /getSourceAuthModeDisplayLabel\(\s*mode,\s*language,\s*\)/,
        );
        const sourceAuthModeBadge = extractElementSlice(
            dataSources,
            "{modeBadge.label}",
            "Badge",
        );
        expect(sourceAuthModeBadge).toContain("<Badge");
        expect(sourceAuthModeBadge).toContain("modeBadge.tone");
        expect(sourceAuthModeBadge).toContain("{modeBadge.label}");
        expect(sourceAuthModeBadge).not.toContain(
            'variant="sourceAuthModeBadge"',
        );
        const settingsSourceActionStatusInvocation = extractElementSlice(
            dataSources,
            "state={actionMessage.state}",
            "SourceActionStatusBadge",
        );
        const sourceActionButtonWrapper =
            dataSources.match(
                /function SourceActionButton[\s\S]*?function SourceActionStatusBadge/,
            )?.[0] ?? "";
        const sourceActionStatusWrapper =
            dataSources.match(
                /function SourceActionStatusBadge[\s\S]*?function hasSavedSetup/,
            )?.[0] ?? "";
        expect(settingsSourceActionStatusInvocation).toContain(
            "<SourceActionStatusBadge",
        );
        expect(settingsSourceActionStatusInvocation).toContain(
            "state={actionMessage.state}",
        );
        expect(settingsSourceActionStatusInvocation).not.toContain(
            "sourceSaveState",
        );
        expect(settingsSourceActionStatusInvocation).not.toContain(
            "sourceActionStatus",
        );
        expect(settingsSourceActionStatusInvocation).not.toContain(
            'variant="secondary"',
        );
        expect(settingsSourceActionStatusInvocation).not.toContain(
            "className=",
        );
        expect(settingsSourceActionStatusInvocation).not.toContain(
            "showIndicator",
        );
        expect(sourceActionButtonWrapper).toContain("<Button");
        expect(sourceActionButtonWrapper).toContain(
            "variant={SOURCE_ACTION_BUTTON_PRIMITIVE_VARIANT_BY_TONE[tone]}",
        );
        expect(sourceActionButtonWrapper).toContain('size="xs"');
        expect(sourceActionButtonWrapper).toContain("className={className}");
        expect(sourceActionButtonWrapper).not.toContain("className={cn(");
        expect(sourceActionButtonWrapper).not.toMatch(
            /\bsize=["'{][^"'}]*sourceProviderAction/i,
        );
        expect(sourceActionStatusWrapper).toContain("<Badge");
        expect(sourceActionStatusWrapper).toContain(
            "variant={getSourceActionStatusBadgeVariant(state)}",
        );
        expect(sourceActionStatusWrapper).not.toContain('variant="ghost"');
        expect(sourceActionStatusWrapper).toContain(
            "<SourceActionStatusIndicator state={state} />",
        );
        expect(sourceActionStatusWrapper).not.toContain(
            "SOURCE_ACTION_STATUS_INDICATOR_CLASS",
        );
        expect(sourceActionStatusWrapper).not.toContain("animate-pulse");
        expect(sourceActionStatusWrapper).toContain("className={cn(");
        expect(sourceActionStatusWrapper).not.toContain("showIndicator");
        expect(sourceActionStatusWrapper).toContain(
            'role={state.endsWith("error") ? "alert" : "status"}',
        );
        expect(sourceActionStatusWrapper).toContain(
            'aria-live={state.endsWith("error") ? "assertive" : "polite"}',
        );
        expect(dataSources).toContain("function SourceActionStatusIndicator");
        expect(dataSources).not.toContain("data-sot-");
        const settingsRow =
            settings.match(
                /function SettingsRow[\s\S]*?function SelectControl/,
            )?.[0] ?? "";
        const settingsSegmentControl =
            settings.match(
                /function SegmentControl[\s\S]*?function SaveActions/,
            )?.[0] ?? "";
        const settingsSegmentItems =
            settingsSegmentControl.match(/<ToggleGroupItem\b[^>]*>/g) ?? [];
        const settingsSaveStatus =
            settings.match(
                /function SaveStatus[\s\S]*?function SectionShell/,
            )?.[0] ?? "";
        const settingsSaveActions =
            settings.match(
                /function SaveActions[\s\S]*?function useResettingSaveState/,
            )?.[0] ?? "";
        const settingsSaveAction = extractElementSlice(
            settingsSaveActions,
            'aria-describedby={saveState === "idle" ? undefined : statusId}',
            "Button",
        );
        const settingsVoScriptTestAction = extractElementSlice(
            voscriptSection,
            "void testConnection()",
            "Button",
        );
        const settingsSourceActions =
            dataSources.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "";
        const settingsSourceActionStatusInFooter = extractElementSlice(
            settingsSourceActions,
            "state={actionMessage.state}",
            "SourceActionStatusBadge",
        );
        const settingsSourceTestAction = extractElementSlice(
            settingsSourceActions,
            "void handleTestSource(selectedSource)",
            "SourceActionButton",
        );
        const settingsSourceSaveAction = extractElementSlice(
            settingsSourceActions,
            "void handleSaveSource(selectedSource)",
            "SourceActionButton",
        );
        const providerDetailInputOwnerClass =
            settingFieldControl.match(
                /const SOURCE_PROVIDER_DETAIL_INPUT_CLASS\s*=\s*"[^"]*";/,
            )?.[0] ?? "";
        const providerDetailFieldOwnerClass =
            settingFieldControl.match(
                /const SOURCE_PROVIDER_DETAIL_FIELD_CLASS\s*=\s*"([^"]*)";/,
            )?.[1] ?? "";
        const providerDetailFieldOwnerClassTokens =
            providerDetailFieldOwnerClass.split(/\s+/);
        const providerDetailInputOwnerClassName =
            providerDetailInputOwnerClass.match(/const\s+([A-Z0-9_]+)/)?.[1] ??
            "";
        const sourceProviderControlClassNameBlock =
            settingFieldControl.match(
                /const sourceProviderControlClassName[\s\S]*?;/,
            )?.[0] ?? "";
        const settingInputClassNameBlock =
            settingFieldControl.match(
                /const inputClassName = cn\([\s\S]*?\n\s*\);/,
            )?.[0] ?? "";
        expect(settingsRow).toContain("className={SETTINGS_FIELD_ROW_CLASS}");
        expect(settingsRow).toContain(
            "className={SETTINGS_FIELD_CONTENT_CLASS}",
        );
        expect(settingsRow).toContain(
            "className={SETTINGS_FIELD_CONTROL_CLASS}",
        );
        expect(settingsRow).not.toContain('variant="settingsRow"');
        expect(settingFieldControl).toContain("SETTINGS_FIELD_ROW_CLASS");
        expect(settingFieldControl).toContain("SETTINGS_FIELD_CONTENT_CLASS");
        expect(settingFieldControl).toContain("SETTINGS_FIELD_CONTROL_CLASS");
        expect(settingFieldControl).toContain("isSourceProviderDetailVariant");
        expect(settingFieldControl).not.toContain(
            "isSourceProviderCredentialField",
        );
        expect(settingFieldControl).not.toMatch(/export const .*_CLASS/);
        expect(settingFieldControl).not.toContain("fieldLabelClassName");
        expect(settingFieldControl).not.toContain("fieldDescriptionClassName");
        expect(providerDetailFieldOwnerClassTokens).toContain("py-3");
        expect(providerDetailFieldOwnerClassTokens).not.toContain("py-2");
        expect(providerDetailInputOwnerClassName).toBe(
            "SOURCE_PROVIDER_DETAIL_INPUT_CLASS",
        );
        for (const providerDetailInputOwnerToken of [
            "w-full",
            "max-w-[15rem]",
        ]) {
            expect(providerDetailInputOwnerClass).toContain(
                providerDetailInputOwnerToken,
            );
        }
        for (const retiredProviderDetailInputOwnerToken of [
            "h-[30px]",
            "w-[240px]",
            "min-w-[240px]",
            "max-w-[240px]",
            "rounded-[7px]",
            "bg-background",
            "font-mono",
            "shadow-none",
            "text-[12px]",
            "leading-[normal]",
            "w-60",
            "max-w-full",
        ]) {
            expect(providerDetailInputOwnerClass).not.toContain(
                retiredProviderDetailInputOwnerToken,
            );
        }
        expect(providerDetailInputOwnerClass).not.toMatch(
            /(?:^|[\s"'])w-60(?:[\s"';]|$)/,
        );
        for (const inputPrimitiveToken of [
            "h-9 px-3 py-1 text-base md:text-sm",
            "rounded-md border-input",
            "focus-visible:border-ring",
            "focus-visible:ring-[3px]",
            "aria-invalid:border-destructive",
        ]) {
            expect(inputPrimitive).toContain(inputPrimitiveToken);
        }
        expect(providerDetailInputOwnerClass).not.toContain(
            "focus-visible:ring-0",
        );
        expect(providerDetailInputOwnerClass).not.toContain(
            "aria-invalid:ring-0",
        );
        expect(providerDetailInputOwnerClass).not.toContain(
            "bg-[var(--bg-recessed)]",
        );
        expect(sourceProviderControlClassNameBlock).toContain(
            "isSourceProviderDetailVariant",
        );
        expect(sourceProviderControlClassNameBlock).toContain(
            "SOURCE_PROVIDER_DETAIL_INPUT_CLASS",
        );
        expect(sourceProviderControlClassNameBlock).toContain("undefined");
        expect(settingInputClassNameBlock).toContain(
            "sourceProviderControlClassName",
        );
        expect(settingInputClassNameBlock).toContain("field.masked &&");
        expect(settingInputClassNameBlock).toContain("field.className");
        expect(settingFieldControl).not.toContain(
            "[&_[data-slot=switch-thumb]]",
        );
        expect(settingFieldControl).not.toContain("focus-visible:ring-0");
        expect(settingFieldControl).not.toContain("aria-invalid:ring-0");
        expect(settingFieldControl).toMatch(/<Switch\s+id=\{fieldId\}/);
        expect(settingFieldControl).not.toContain(
            "sourceProviderSwitchClassName",
        );
        expect(dataSources).not.toContain(
            "SOURCE_PROVIDER_DETAIL_SWITCH_CLASS",
        );
        expect(dataSources).not.toContain("settingsDetail");
        expect(dataSources).toContain("automaticUpdatesFieldId");
        expect(dataSources).toContain("checked={selectedSource.enabled}");
        expect(dataSources).toContain("disabled={interactionDisabled}");
        expect(switchPrimitive).toContain('type SwitchVariant = "default"');
        expect(switchPrimitive).not.toContain('| "detail"');
        expect(switchPrimitive).not.toContain("detail:");
        expect(switchPrimitive).toContain('type SwitchSize = "sm" | "default"');
        for (const inputPrimitiveBusinessToken of [
            "sourceProviderDetail",
            "SOURCE_PROVIDER_DETAIL",
            "source-provider-detail",
            "settingsDetail",
        ]) {
            expect(inputPrimitive).not.toContain(inputPrimitiveBusinessToken);
            expect(globals).not.toContain(inputPrimitiveBusinessToken);
        }
        expect(inputPrimitive).not.toMatch(/\bsettings\b/i);
        expect(inputPrimitive).not.toMatch(/\bsourceProvider\b/);
        expect(inputPrimitive).not.toContain("data-sot");
        for (const providerDetailPrimitiveSource of [
            fieldPrimitive,
            inputPrimitive,
            switchPrimitive,
        ]) {
            expect(providerDetailPrimitiveSource).not.toContain(
                "SOURCE_PROVIDER_DETAIL_INPUT_CLASS",
            );
            expect(providerDetailPrimitiveSource).not.toContain(
                "w-full max-w-[15rem]",
            );
            expect(providerDetailPrimitiveSource).not.toContain(
                "max-w-[15rem]",
            );
        }
        expect(switchPrimitive).not.toContain("sourceProviderDetail");
        expect(switchPrimitive).not.toContain("settingsDetail");
        expect(switchPrimitive).not.toMatch(/\bsettings\b/i);
        expect(switchPrimitive).not.toMatch(/\bsourceProvider\b/);
        expect(switchPrimitive).not.toContain("data-sot");
        expect(globals).not.toContain("sourceProviderSwitchClassName");
        expect(globals).not.toContain("SOURCE_PROVIDER_DETAIL_SWITCH_CLASS");
        expect(settingsSourceActions).toContain("<footer");
        expect(settingsSourceActions).toContain("actionMessage?.title ? (");
        expect(settingsSourceActions).toContain("{actionMessage.title}");
        expect(settingsSourceActionStatusInFooter).toContain(
            "state={actionMessage.state}",
        );
        expect(sourceActionStatusWrapper).toContain(
            'role={state.endsWith("error") ? "alert" : "status"}',
        );
        expect(sourceActionStatusWrapper).toContain(
            'aria-live={state.endsWith("error") ? "assertive" : "polite"}',
        );
        expect(settingsSourceTestAction).toContain(
            'aria-busy={actionState === "testing"}',
        );
        expect(settingsSourceTestAction).toContain(
            "void handleTestSource(selectedSource)",
        );
        expect(settingsSourceSaveAction).toContain(
            'aria-busy={actionState === "saving"}',
        );
        expect(settingsSourceSaveAction).toContain(
            "void handleSaveSource(selectedSource)",
        );
        expect(
            collectProviderDetailActionGlobalBusinessBlocks(globals),
        ).toEqual([]);
        expect(settingsSegmentControl).toContain(
            "className={SETTINGS_SEGMENT_GROUP_CLASS}",
        );
        expect(settingsSegmentControl).toContain('variant="outline"');
        expect(settingsSegmentControl).toContain('size="sm"');
        expect(settingsSegmentControl).toContain("spacing={1}");
        expect(settings).not.toContain("SETTINGS_SEGMENT_OPTION_CLASS");
        expect(settingsSegmentItems).toHaveLength(1);
        for (const segmentItem of settingsSegmentItems) {
            expect(segmentItem).toContain("data-sot-control={control}");
            expect(segmentItem).toContain(
                "data-sot-display-value={option.sotValue ?? option.value}",
            );
            expect(segmentItem).toContain(
                'data-sot-state={active ? "selected" : "idle"}',
            );
            expect(segmentItem).toContain("data-sot-value={option.value}");
            expect(segmentItem).toContain("value={option.value}");
            expect(segmentItem).not.toContain("className=");
            expect(segmentItem).not.toMatch(/\bvariant=/);
            expect(segmentItem).not.toMatch(/\bsize=/);
            expect(segmentItem).not.toContain("settingsSegment");
        }
        expect(settingsSegmentControl).not.toContain(
            'layout="settingsSegment"',
        );
        expect(settingsSegmentControl).not.toContain(
            'variant="settingsSegmentOption"',
        );
        expect(settingsSaveStatus).toContain("variant={statusVariant}");
        expect(settingsSaveStatus).not.toContain('variant="ghost"');
        expect(settingsSaveStatus).toContain(
            'const isIdle = saveState === "idle";',
        );
        expect(settingsSaveStatus).toContain(
            'const statusClassName = cn("gap-1.5", isIdle && "hidden");',
        );
        expect(settingsSaveStatus).toMatch(
            /const statusRole = isIdle\s+\? undefined\s+: saveState === "error"\s+\? "alert"\s+: "status";/,
        );
        expect(settingsSaveStatus).toMatch(
            /const statusLive = isIdle\s+\? undefined\s+: saveState === "error"\s+\? "assertive"\s+: "polite";/,
        );
        expect(settingsSaveStatus).toContain("id={statusId}");
        expect(settingsSaveStatus).toContain("role={statusRole}");
        expect(settingsSaveStatus).toContain("aria-live={statusLive}");
        expect(settingsSaveStatus).toContain(
            'aria-atomic={isIdle ? undefined : "true"}',
        );
        expect(settings).not.toContain("SETTINGS_SAVE_STATUS_BADGE_CLASS");
        expect(settings).toContain("const statusVariant: BadgeVariant =");
        expect(settings).toContain("const statusClassName = cn(");
        expect(settings).toContain('isIdle && "hidden"');
        expect(settings).not.toContain("const indicatorClassName = cn(");
        expect(settingsSaveStatus).toContain("<Spinner");
        expect(settingsSaveStatus).toContain("<CheckCircle2");
        expect(settingsSaveStatus).toContain("<XCircle");
        expect(settingsSaveStatus).not.toContain("data-sot-");
        expect(settingsSaveStatus).not.toContain("animate-pulse");
        expect(settingsSaveStatus).not.toContain("rounded-full bg-current");
        expect(settingsSaveStatus).not.toContain(
            'variant="settingsSaveStatus"',
        );
        expect(settingsSaveAction).toContain('variant="default"');
        expect(settingsSaveAction).toContain(
            'aria-busy={saveState === "saving"}',
        );
        expect(settingsSaveAction).toContain(
            'aria-describedby={saveState === "idle" ? undefined : statusId}',
        );
        expect(settingsSaveAction).not.toContain('variant="settingsSave"');
        expect(settingsSaveAction).not.toContain('size="settingsSave"');
        expect(settingsVoScriptTestAction).toContain('variant="ghost"');
        expect(settingsVoScriptTestAction).toContain(
            "onClick={() => void testConnection()}",
        );
        expect(settingsVoScriptTestAction).toContain(
            "aria-busy={isTestingConnection}",
        );
        expect(settingsVoScriptTestAction).not.toContain(
            'variant="settingsTestAction"',
        );
        expect(settingsVoScriptTestAction).not.toContain(
            'size="settingsTestAction"',
        );
        expect(badge).toContain('data-slot="badge"');
        expect(badge).toContain("data-variant={variant}");
        expect(badge).not.toContain("statusPill:");
        expect(badge).not.toContain("h-[18px]");
        expect(badge).not.toContain("gap-[4px]");
        expect(badge).not.toContain("rounded-[999px]");
        expect(badge).not.toContain("border border-solid");
        expect(badge).not.toContain("px-[7px]");
        expect(badge).not.toMatch(/(?:^|[\s"'])py-0(?:[\s"'])/);
        expect(badge).not.toContain("text-[10.5px]");
        expect(badge).not.toContain("font-semibold");
        expectSourceToExcludeForbiddenSubstrings(
            badge,
            BADGE_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS,
        );
        expect(badge).not.toContain("sourceAuthModeBadge");
        expect(badge).not.toContain("sourceActionStatus:");
        expect(button).not.toMatch(/\bsourceProviderAction\b/);
        expect(badge).not.toContain("data-[sot-tone=recommended]");
        expect(badge).not.toContain("data-[sot-tone=personal]");
        expect(badge).not.toContain("source:");
        expect(badge).not.toContain("playerSource:");
        expect(badge).not.toContain(`${"player"}Status:`);
        expect(badge).not.toContain("min-w-[65.171875px]");
        expect(badge).not.toContain("[&_[data-sot-part=status-dot]]");
        expect(badge).not.toContain("[&_[data-sot-part=status-label]]");
        expect(sotPlayerPrimitives).toContain("const PLAYER_STATUS_VARIANT");
        expect(sotPlayerPrimitives).toContain(
            'React.ComponentProps<typeof Badge>["variant"]',
        );
        expect(sotPlayerPrimitives).toContain(
            "variant={PLAYER_STATUS_VARIANT[tone]}",
        );
        expect(sotPlayerPrimitives).toContain("className={className}");
        expect(sotPlayerPrimitives).not.toContain("PLAYER_STATUS_TONE_CLASS");
        expect(sotPlayerPrimitives).not.toContain(
            '"size-1.5 rounded-full bg-current"',
        );
        expect(sotPlayerPrimitives).not.toContain("animate-[bpulse");
        expect(sotPlayerPrimitives).not.toContain("--source-provider-status");
        expect(badge).not.toContain("playerTagChip:");
        expect(badge).not.toContain("playerTagOverflow:");
        expect(badge).not.toContain('"player-status":');
        expectSourceToExcludeForbiddenSubstrings(
            badge,
            BADGE_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS,
        );
        expect(alertPrimitive).toContain("statusError:");
        expect(alertPrimitive).not.toContain("speakerReviewError:");
        for (const settingsAlertPrimitiveToken of [
            "settingsBanner:",
            "settingsBannerError:",
            "settingsLoadError:",
            "settingsVoScriptWarning:",
            "settingsBannerAction:",
        ]) {
            expect(alertPrimitive).not.toContain(settingsAlertPrimitiveToken);
        }
        expect(fieldPrimitive).not.toContain("settingsRow");
        expect(fieldPrimitive).not.toContain("settingsContent");
        expect(fieldPrimitive).not.toContain("settingsControl");
        expect(fieldPrimitive).not.toContain("settingsDetail");
        expect(fieldPrimitive).not.toMatch(/\bsettings\b/i);
        expect(fieldPrimitive).not.toMatch(/\bsourceProvider\b/);
        expect(fieldPrimitive).not.toContain("data-sot");
        expect(fieldPrimitive).toContain('type FieldVariant = "default";');
        expect(fieldPrimitive).not.toContain('| "detail"');
        expect(fieldPrimitive).not.toContain("detail:");
        expect(button).not.toContain("settingsSave:");
        expect(button).not.toContain("settingsTestAction:");
        expect(button).not.toContain("settingsSourceRetry:");
        expect(button).not.toContain("settingsSectionRetry:");
        expect(toggleGroupPrimitive).not.toContain("settingsSegment");
        expect(toggleGroupPrimitive).not.toContain("settingsSegmentOption:");
        expect(toggleGroupPrimitive).not.toContain("settingsSegmentSpacing");
        const settingsSourceStateAlert = extractOpeningElement(
            dataSources,
            'role={tone === "err" ? "alert" : "status"}',
            "Alert",
        );
        const settingsSourceLoadErrorAlert = extractOpeningElement(
            dataSources,
            'role="alert"',
            "Alert",
        );
        const settingsSectionLoadErrorAlert = extractOpeningElement(
            settings,
            'data-sot-banner="settings-section-load-error"',
            "Alert",
        );
        const settingsSourceLoadRetry = extractElementSlice(
            dataSources,
            "onClick={() => void refreshSources()}",
            "Button",
        );
        const settingsSectionLoadRetry = extractElementSlice(
            settings,
            'data-sot-control="settings-section-load-retry"',
            "Button",
        );
        const settingsVoScriptUnavailableAlert = extractOpeningElement(
            voscriptSection,
            'id="voscript-connection-status"',
            "Alert",
        );
        expect(settingsSourceStateAlert).toContain(
            "SETTINGS_BANNER_BASE_CLASS",
        );
        expect(settingsSourceStateAlert).toContain(
            'variant={tone === "err" ? "destructiveSoft" : "default"}',
        );
        expect(settingsSourceStateAlert).toContain('density="comfortable"');
        expect(settingsSourceStateAlert).toContain(
            'role={tone === "err" ? "alert" : "status"}',
        );
        expect(settingsSourceStateAlert).toContain(
            'aria-live={tone === "err" ? "assertive" : "polite"}',
        );
        expect(settingsSourceStateAlert).not.toContain("data-sot-");
        expect(settingsSourceStateAlert).not.toContain(
            "SETTINGS_BANNER_LAYOUT_CLASS",
        );
        expect(settingsSourceStateAlert).not.toContain(
            "SETTINGS_BANNER_ERROR_CLASS",
        );
        expect(settingsSourceStateAlert).not.toContain(
            "SETTINGS_BANNER_TONE_CLASS",
        );
        expect(dataSources).toContain("aria-busy={isLoading}");
        expect(settingsSourceLoadErrorAlert).toContain(
            "SETTINGS_BANNER_BASE_CLASS",
        );
        expect(settingsSourceLoadErrorAlert).toContain(
            'variant="destructiveSoft"',
        );
        expect(settingsSourceLoadErrorAlert).toContain('density="comfortable"');
        expect(settingsSourceLoadErrorAlert).toContain('role="alert"');
        expect(settingsSourceLoadErrorAlert).not.toContain("data-sot-");
        expect(settingsSourceLoadErrorAlert).not.toContain(
            "SETTINGS_BANNER_ACTION_LAYOUT_CLASS",
        );
        expect(settingsSourceLoadErrorAlert).not.toContain(
            "SETTINGS_BANNER_ERROR_CLASS",
        );
        expect(settingsSourceLoadErrorAlert).not.toContain(
            'variant="settingsLoadError"',
        );
        for (const settingsLoadErrorAlert of [settingsSectionLoadErrorAlert]) {
            expect(settingsLoadErrorAlert).toContain(
                "SETTINGS_BANNER_BASE_CLASS",
            );
            expect(settingsLoadErrorAlert).toContain(
                'variant="destructiveSoft"',
            );
            expect(settingsLoadErrorAlert).toContain('density="comfortable"');
            expect(settingsLoadErrorAlert).toContain('data-sot-tone="err"');
            expect(settingsLoadErrorAlert).not.toContain(
                "SETTINGS_BANNER_ACTION_LAYOUT_CLASS",
            );
            expect(settingsLoadErrorAlert).not.toContain(
                "SETTINGS_BANNER_ERROR_CLASS",
            );
            expect(settingsLoadErrorAlert).not.toContain(
                'variant="settingsLoadError"',
            );
        }
        expect(settingsSourceLoadRetry).toContain('variant="default"');
        expect(settingsSourceLoadRetry).toContain('type="button"');
        expect(settingsSourceLoadRetry).toContain(
            "onClick={() => void refreshSources()}",
        );
        expect(settingsSourceLoadRetry).not.toContain("data-sot-");
        expect(settingsSectionLoadRetry).toContain('variant="default"');
        expect(settingsSectionLoadRetry).toContain("onClick={onRetry}");
        expect(settingsSectionLoadRetry).toContain(
            "data-sot-section={section}",
        );
        expect(settingsVoScriptUnavailableAlert).toContain(
            'density="comfortable"',
        );
        expect(settingsVoScriptUnavailableAlert).toContain(
            'id="voscript-connection-status"',
        );
        expect(settingsVoScriptUnavailableAlert).toContain(
            'role={\n                        connectionTestState === "test-error"\n                            ? "alert"\n                            : "status"\n                    }',
        );
        expect(settingsVoScriptUnavailableAlert).toContain(
            'aria-live={\n                        connectionTestState === "test-error"\n                            ? "assertive"\n                            : "polite"\n                    }',
        );
        expect(settingsVoScriptUnavailableAlert).toContain(
            "SETTINGS_BANNER_BASE_CLASS",
        );
        expect(settingsVoScriptUnavailableAlert).toContain(
            'connectionTestState === "test-error"',
        );
        expect(settingsVoScriptUnavailableAlert).not.toContain(
            "SETTINGS_BANNER_WARNING_CLASS",
        );
        expect(settingsVoScriptUnavailableAlert).not.toContain(
            'variant="settingsVoScriptWarning"',
        );
        expect(settingsVoScriptUnavailableAlert).not.toContain("data-sot-");
        for (const settingsBannerAlert of [
            settingsSourceStateAlert,
            settingsSourceLoadErrorAlert,
            settingsSectionLoadErrorAlert,
            settingsVoScriptUnavailableAlert,
        ]) {
            expect(settingsBannerAlert).not.toContain(
                'density="settingsBanner"',
            );
            expect(settingsBannerAlert).not.toContain('variant="destructive"');
            expect(settingsBannerAlert).not.toContain(
                "border-destructive/30 bg-destructive/10",
            );
        }
        for (const speakerReviewButtonVariant of [
            "speakerReviewAction",
            "speakerReviewPrimaryAction",
            "speakerReviewGhostAction",
            "speakerReviewDangerAction",
            "speakerReviewSuggestion",
            "speakerReviewIconAction",
        ]) {
            expect(button).not.toContain(`${speakerReviewButtonVariant}:`);
        }
        expect(button).not.toContain("speakerReviewIcon:");
        expectSourceToExcludeForbiddenSubstrings(
            cardPrimitive,
            CARD_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS,
        );
        for (const speakerReviewCardOwnerToken of [
            "SPEAKER_REVIEW_CARD_CLASS_NAMES",
            "SPEAKER_REVIEW_CARD_HEADER_CLASS_NAMES",
            "SPEAKER_REVIEW_CARD_TITLE_CLASS_NAMES",
            "SPEAKER_REVIEW_CARD_CONTENT_CLASS_NAMES",
            "SPEAKER_REVIEW_CARD_DESCRIPTION_CLASS_NAME",
            "SPEAKER_REVIEW_CARD_ACTION_CLASS_NAME",
            "SPEAKER_REVIEW_VOICEPRINT_BADGE_VARIANTS",
            "SPEAKER_REVIEW_ACTION_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_PRIMARY_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_DANGER_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_SUGGESTION_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_ICON_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_MODE_ITEM_CLASS_NAME",
            "SPEAKER_REVIEW_ERROR_ALERT_CLASS_NAME",
            "SPEAKER_REVIEW_ERROR_TITLE_CLASS_NAME",
            "SPEAKER_REVIEW_ERROR_DESCRIPTION_CLASS_NAME",
            "SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME",
            "SPEAKER_REVIEW_MAPPING_CLEAR_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_META_ITEM_CLASS_NAME",
            "SPEAKER_REVIEW_SECTION_DESCRIPTION_CLASS_NAME",
            "SPEAKER_REVIEW_SEGMENT_TITLE_CLASS_NAME",
            "SPEAKER_REVIEW_SEGMENT_TEXT_CLASS_NAME",
            "SPEAKER_REVIEW_ROW_NAME_CLASS_NAME",
            "SPEAKER_REVIEW_SECTION_TITLE_CLASS_NAME",
            "SPEAKER_REVIEW_ROW_SUB_CLASS_NAME",
            "SpeakerReviewCard",
            "SpeakerReviewCardHeader",
            "SpeakerReviewCardTitle",
            "SpeakerReviewCardDescription",
            "SpeakerReviewCardAction",
            "SpeakerReviewCardContent",
            "SpeakerReviewVoiceprintBadge",
        ]) {
            expect(speakerReview).toContain(speakerReviewCardOwnerToken);
        }
        expect(toggleGroupPrimitive).not.toContain("speakerReviewMode");
        expect(toggleGroupPrimitive).not.toContain("speakerReviewModeItem");
        expect(inputGroupPrimitive).not.toContain("speakerReviewMappingClear");
        for (const speakerReviewEmptyVariant of [
            "speakerReviewMerge",
            "speakerReviewDetected",
            "speakerReviewInline",
            "speakerReviewState",
            "speakerReviewMergeIcon",
        ]) {
            expect(emptyPrimitive).not.toContain(speakerReviewEmptyVariant);
        }
        const speakerReviewVoiceprintBadgeVariants = extractBoundedSlice(
            speakerReview,
            "const SPEAKER_REVIEW_VOICEPRINT_BADGE_VARIANTS =",
            ";",
        );
        expect(speakerReviewVoiceprintBadgeVariants).toContain(
            'missing: "secondary"',
        );
        expect(speakerReviewVoiceprintBadgeVariants).toContain(
            'ready: "outline"',
        );
        expect(speakerReviewVoiceprintBadgeVariants).toContain(
            'selected: "default"',
        );
        expect(speakerReviewVoiceprintBadgeVariants).not.toContain(
            "--source-provider-status-",
        );
        expect(speakerReview).not.toContain(
            "SPEAKER_REVIEW_VOICEPRINT_BADGE_CLASS_NAME",
        );
        expect(speakerReview).not.toContain("data-[sot-tone=missing]");
        expect(speakerReview).not.toContain("data-[sot-tone=ready]");
        expect(speakerReview).not.toContain("data-[sot-tone=selected]");
        expect(speakerReview).not.toContain("[&>svg]:size-[11px]");
        expect(speakerReview).not.toContain("[&>svg]:stroke-2");
        for (const selector of SPEAKER_REVIEW_RESIDUAL_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const {
            constName,
            tokens,
        } of SPEAKER_REVIEW_RESIDUAL_OWNER_CLASS_TOKENS) {
            const ownerClass = extractBoundedSlice(
                speakerReview,
                `const ${constName} =`,
                ";",
            );
            for (const token of tokens) {
                expect(ownerClass).toContain(token);
            }
        }
        const providerGlobalStyleSelectors = [
            "[data-sot-provider-card]",
            "[data-sot-provider-status]",
        ];
        const sourceProviderBusinessGlobalStyleTargets = [
            {
                label: "provider detail panel",
                selectorFragment: '[data-sot-panel="source-provider-detail"]',
            },
            {
                label: "provider fields list",
                selectorFragment: '[data-sot-panel="source-provider-fields"]',
            },
            {
                label: "source action footer",
                selectorFragment: '[data-sot-panel="source-actions"]',
            },
            {
                label: "source action status",
                selectorFragment: '[data-sot-part="source-action-status"]',
            },
            {
                label: "source test action",
                selectorFragment: '[data-sot-control="source-test"]',
            },
            {
                label: "source save action",
                selectorFragment: '[data-sot-control="source-save"]',
            },
        ];
        for (const selector of providerGlobalStyleSelectors) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const target of sourceProviderBusinessGlobalStyleTargets) {
            expect(
                collectCssRuleBlocks(globals, target.selectorFragment),
                `${target.label} should keep source-provider styles in feature classes`,
            ).toEqual([]);
        }
        expect(dataSources).not.toContain("path-card");
        expect(dataSources).not.toContain("pc-badge");
        expect(dataSources).toContain("void handleTestSource(selectedSource)");
        expect(dataSources).toContain("void handleSaveSource(selectedSource)");
        const sourceAuthModeLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                SOURCE_AUTH_MODE_LEGACY_CSS_SELECTOR_RE.test(text),
            );

        expect(sourceAuthModeLegacySelectorLines).toEqual([]);
        for (const selector of SOURCE_AUTH_MODE_REMOVED_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }

        expect(speakerReview).toContain('data-sot-panel="speaker-review"');
        expect(speakerReview).toContain("data-sot-state=");
        expect(speakerReview).toContain("<CardHeader");
        expect(speakerReview).toContain("<ToggleGroup");
        expect(speakerReview).toContain("<Badge");
        expect(speakerReview).toContain("<Alert");
        expect(speakerReview).toContain('from "@/components/ui/input-group";');
        expect(speakerReview).toContain('from "@/components/ui/empty";');
        expect(speakerReview).toContain('from "@/components/ui/field";');
        for (const primitive of [
            "InputGroup,",
            "InputGroupAddon,",
            "InputGroupButton,",
            "InputGroupInput,",
            "Empty,",
            "EmptyDescription,",
            "EmptyHeader,",
            "EmptyMedia,",
            "EmptyTitle,",
            "<Field",
            "<FieldContent>",
            "<FieldLabel",
        ]) {
            expect(speakerReview).toContain(primitive);
        }
        expect(speakerReview).toContain('data-sot-list="speaker-review-rows"');
        expect(speakerReview).toContain('data-sot-item="speaker-review-row"');
        expect(speakerReview).toContain('data-sot-list="speaker-review-meta"');
        expect(speakerReview).toContain(
            'data-sot-part="speaker-review-transcript-section"',
        );
        expect(speakerReview).toContain(
            'data-sot-list="speaker-review-sample-segments"',
        );
        expect(speakerReview).toContain(
            'data-sot-item="speaker-review-sample-segment"',
        );
        expect(speakerReview).toContain("<section");
        expect(speakerReview).toContain(
            "data-sot-speaker-label={speaker.rawLabel}",
        );
        const speakerReviewModeToggle = extractElementSlice(
            speakerReview,
            'data-sot-control="speaker-review-mode"',
            "ToggleGroup",
        );
        expect(speakerReviewModeToggle).toContain('variant="default"');
        expect(speakerReviewModeToggle).toContain('size="sm"');
        expect(speakerReviewModeToggle).toContain('className="flex-nowrap"');
        expect(speakerReviewModeToggle).toContain("spacing={1}");
        expect(speakerReviewModeToggle).not.toContain(
            'variant="speakerReviewMode"',
        );
        expect(speakerReviewModeToggle).not.toContain(
            'size="speakerReviewModeItem"',
        );
        expect(speakerReviewModeToggle).not.toContain(
            'layout="speakerReviewMode"',
        );
        expect(speakerReviewModeToggle).not.toContain(
            'spacing="speakerReviewMode"',
        );
        const speakerReviewModeOptions = collectOpeningElements(
            speakerReview,
            "ToggleGroupItem",
        ).filter((opening) =>
            opening.includes('data-sot-control="speaker-review-mode-option"'),
        );
        expect(speakerReviewModeOptions).toHaveLength(2);
        for (const opening of speakerReviewModeOptions) {
            expectClassNameConstReference(
                opening,
                "SPEAKER_REVIEW_MODE_ITEM_CLASS_NAME",
            );
        }
        const speakerReviewMappingInputIndex = speakerReview.indexOf(
            'data-sot-control="speaker-review-mapping-input"',
        );
        expect(speakerReviewMappingInputIndex).toBeGreaterThan(-1);
        const speakerReviewMappingInput = speakerReview.slice(
            speakerReviewMappingInputIndex - 520,
            speakerReviewMappingInputIndex + 7_000,
        );
        expect(speakerReviewMappingInput).toContain("<InputGroup");
        expect(speakerReviewMappingInput).toContain("<InputGroupInput");
        expect(speakerReviewMappingInput).toContain("<InputGroupAddon");
        expect(speakerReviewMappingInput).toContain("<InputGroupButton");
        expect(speakerReviewMappingInput).toContain(
            'data-sot-control="speaker-review-mapping-clear"',
        );
        const speakerReviewMappingClear = collectOpeningElements(
            speakerReview,
            "InputGroupButton",
        ).find((opening) =>
            opening.includes('data-sot-control="speaker-review-mapping-clear"'),
        );
        expect(speakerReviewMappingClear).toBeDefined();
        expect(speakerReviewMappingClear).toContain('size="icon-xs"');
        expect(speakerReviewMappingClear).toContain('variant="ghost"');
        expectClassNameConstReference(
            speakerReviewMappingClear ?? "",
            "SPEAKER_REVIEW_MAPPING_CLEAR_BUTTON_CLASS_NAME",
        );
        expect(speakerReviewMappingClear).toContain(
            'data-sot-control="speaker-review-mapping-clear"',
        );
        expect(speakerReviewMappingClear).not.toContain(
            'size="speakerReviewMappingClear"',
        );
        expect(speakerReviewMappingClear).not.toContain(
            'variant="speakerReviewMappingClear"',
        );
        expect(speakerReviewMappingInput).toContain("aria-busy={");
        expect(speakerReviewMappingInput).toContain("onFocus={() =>");
        expect(speakerReviewMappingInput).toContain("onBlur={() =>");
        expect(speakerReviewMappingInput).toContain("onChange={(event) =>");
        const speakerReviewInlineRenameInput = speakerReview.slice(
            speakerReview.indexOf(
                'data-sot-control="speaker-review-inline-name"',
            ) - 1_200,
            speakerReview.indexOf(
                'data-sot-control="speaker-review-inline-name"',
            ) + 3_200,
        );
        expect(speakerReviewInlineRenameInput).toContain("<Field");
        expect(speakerReviewInlineRenameInput).toContain("<FieldContent>");
        expect(speakerReviewInlineRenameInput).toContain("<Input");
        expect(speakerReviewInlineRenameInput).toContain("data-spk-input");
        expect(speakerReviewInlineRenameInput).toContain("autoFocus");
        expect(speakerReviewInlineRenameInput).toContain("aria-busy={");
        const speakerReviewMergeEmpty = extractElementSlice(
            speakerReview,
            'data-sot-part="speaker-review-merge-empty"',
            "Empty",
        );
        expect(speakerReviewMergeEmpty).toMatch(
            /<Empty\s+variant="compact"[\s\S]*?data-sot-part="speaker-review-merge-empty"/,
        );
        expect(speakerReviewMergeEmpty).toContain(
            '<EmptyHeader variant="popover">',
        );
        expect(speakerReviewMergeEmpty).toContain("<EmptyMedia");
        expect(speakerReviewMergeEmpty).toContain('variant="subtleIcon"');
        expect(speakerReviewMergeEmpty).toContain("<Check />");
        expect(speakerReviewMergeEmpty).toMatch(
            /<EmptyTitle\b[^>]*\bvariant="compact"[^>]*\bdata-sot-part="speaker-review-merge-empty-title"[^>]*>/,
        );
        expect(speakerReviewMergeEmpty).toMatch(
            /<EmptyDescription\b[^>]*\bvariant="compact"[^>]*\bdata-sot-part="speaker-review-merge-empty-description"[^>]*>/,
        );
        const speakerReviewNoSamplesEmpty = extractElementSlice(
            speakerReview,
            'data-sot-state="no-samples"',
            "Empty",
        );
        expect(speakerReviewNoSamplesEmpty).toContain(
            'data-sot-part="speaker-review-empty"',
        );
        expect(speakerReviewNoSamplesEmpty).toContain('variant="default"');
        expect(speakerReviewNoSamplesEmpty).toContain(
            "SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME",
        );
        expect(speakerReviewNoSamplesEmpty).toContain(
            '<EmptyHeader variant="default">',
        );
        expect(speakerReviewNoSamplesEmpty).toContain(
            '<EmptyTitle variant="default">',
        );
        for (const state of [
            "no-detected-speakers",
            "no-saved-speakers",
            "no-matching-speakers",
        ]) {
            const emptyState = extractElementSlice(
                speakerReview,
                `data-sot-state="${state}"`,
                "Empty",
            );
            expect(emptyState).toContain('variant="default"');
            if (state !== "no-detected-speakers") {
                expect(emptyState).toContain(
                    "SPEAKER_REVIEW_INLINE_EMPTY_CLASS_NAME",
                );
            }
            expect(emptyState).toContain('<EmptyHeader variant="default">');
            expect(emptyState).toContain('<EmptyTitle variant="default">');
        }
        for (const selector of [
            '[data-sot-control="speaker-review-inline-name"][data-slot="input"]',
            '[data-sot-control="speaker-review-mapping-input"][data-slot="input"]',
            '[data-sot-panel="speaker-review"] [data-slot="card"]',
            '[data-sot-control="speaker-review-mode"]',
            '[data-sot-control="speaker-review-mode-option"]',
            '[data-sot-panel="speaker-review-merge"][data-slot="popover-content"]',
            '[data-sot-part="speaker-review-merge-empty"]',
            '[data-sot-part="speaker-review-merge-empty-icon"]',
            '[data-sot-part="speaker-review-merge-empty-title"]',
            '[data-sot-part="speaker-review-merge-empty-description"]',
            '[data-sot-control="speaker-review-suggestion"]',
            '[data-sot-part="speaker-review-empty"]',
            '[data-sot-part="speaker-review-voiceprint-pill"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
        expect(speakerReview).toContain(
            'data-sot-control="speaker-review-suggestion"',
        );
        const speakerReviewButtonOpenings = collectOpeningElements(
            speakerReview,
            "Button",
        ).filter(
            (opening) =>
                opening.includes("speaker-review") ||
                opening.includes("data-sot-confirm-action") ||
                opening.includes("data-spk-merge-close"),
        );
        expect(speakerReviewButtonOpenings.length).toBeGreaterThan(0);
        for (const opening of speakerReviewButtonOpenings) {
            expect(opening).not.toContain('variant="speakerReview');
            expect(opening).not.toContain('size="speakerReview');
        }
        const speakerReviewMergeClose = extractElementSlice(
            speakerReview,
            "data-spk-merge-close",
            "Button",
        );
        expect(speakerReviewMergeClose).toContain('size="icon-sm"');
        expect(speakerReviewMergeClose).toMatch(
            /<X\s+data-icon="inline-start"\s+aria-hidden="true"\s+focusable="false"\s*\/>/,
        );
        expect(speakerReviewMergeClose).not.toContain("size-[17px]");
        expect(speakerReviewMergeClose).not.toContain("translate-x");
        expect(speakerReviewMergeClose).not.toContain("translate-y");
        expect(speakerReview).toContain('variant="outline"');
        expect(speakerReview).toContain('variant="default"');
        expect(speakerReview).toContain('variant="ghost"');
        expect(speakerReview).toContain('variant="destructive"');
        expect(speakerReview).toContain('size="sm"');
        for (const speakerReviewButtonOwnerToken of [
            "SPEAKER_REVIEW_ACTION_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_PRIMARY_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_GHOST_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_DANGER_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_SUGGESTION_BUTTON_CLASS_NAME",
            "SPEAKER_REVIEW_ICON_BUTTON_CLASS_NAME",
        ]) {
            expect(speakerReview).toContain(speakerReviewButtonOwnerToken);
        }
        expect(speakerReview).not.toContain(
            'variant="speakerReviewSuggestion"',
        );
        expect(speakerReview).not.toContain('size="speakerReviewSuggestion"');
        expect(speakerReview).not.toContain(
            'variant="speakerReviewPrimaryAction"',
        );
        expect(speakerReview).not.toContain(
            'variant="speakerReviewGhostAction"',
        );
        expect(speakerReview).not.toContain(
            'variant="speakerReviewDangerAction"',
        );
        expect(speakerReview).not.toContain('size="speakerReviewAction"');
        const speakerReviewCardOpenings = collectOpeningElements(
            speakerReview,
            "Card",
        ).filter((opening) => /speaker-review|speaker-unlink/.test(opening));
        for (const opening of speakerReviewCardOpenings) {
            expect(opening).not.toContain('variant="elevated"');
            expect(opening).not.toContain('variant="popover"');
        }
        expect(speakerReview).toContain("<SpeakerReviewCard");
        expect(speakerReview).toContain('surface="transcript"');
        expect(speakerReview).toContain('surface="row"');
        expect(speakerReview).toContain('surface="mergePopover"');
        expect(speakerReview).toContain(
            '<SpeakerReviewCardContent surface="mergePopover">',
        );
        expect(speakerReview).toContain(SPEAKER_REVIEW_MERGE_POPOVER_PLACEMENT);
        expectSourceToExcludeForbiddenSubstrings(
            cardPrimitive,
            CARD_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS,
        );
        expect(speakerReview).not.toContain(
            `className="${SPEAKER_REVIEW_MERGE_POPOVER_PLACEMENT}"`,
        );
        expect(speakerReview).toContain('from "@/components/ui/popover";');
        expect(speakerReview).toContain("<Popover");
        expect(speakerReview).toContain("onOpenChange={setIsMergePopoverOpen}");
        expect(speakerReview).toContain("<PopoverTrigger asChild>");
        expect(speakerReview).toContain("<PopoverContent");
        expect(speakerReview).toContain(
            'data-sot-panel="speaker-review-merge"',
        );
        expect(speakerReview).toContain('aria-label="合并相似说话人"');
        expect(speakerReview).not.toContain('role="dialog"');
        expect(speakerReview).toContain('surface="confirm"');
        for (const opening of collectOpeningElements(
            speakerReview,
            "Alert",
        ).filter((element) =>
            element.includes('data-sot-part="speaker-review-state"'),
        )) {
            expect(opening).toContain('variant="statusError"');
            expectClassNameConstReference(
                opening,
                "SPEAKER_REVIEW_ERROR_ALERT_CLASS_NAME",
            );
            expect(opening).not.toContain('variant="speakerReviewError"');
            expect(opening).not.toContain('density="speakerReviewError"');
            expect(opening).not.toContain('layout="speakerReviewError"');
            expect(opening).not.toContain('variant="destructive"');
        }
        const speakerReviewBadgeOpenings = collectOpeningElements(
            speakerReview,
            "SpeakerReviewVoiceprintBadge",
        ).filter((opening) =>
            opening.includes('data-sot-part="speaker-review-voiceprint-pill"'),
        );
        expect(speakerReviewBadgeOpenings.length).toBeGreaterThan(0);
        for (const opening of speakerReviewBadgeOpenings) {
            expect(opening).not.toContain('variant="speakerReviewVoiceprint"');
            expect(opening).not.toContain('variant="outline"');
        }
        const speakerReviewVoiceprintBadgeHelper = extractBoundedSlice(
            speakerReview,
            "function SpeakerReviewVoiceprintBadge(",
            "function formatSegmentWindow",
        );
        expect(speakerReviewVoiceprintBadgeHelper).toContain(
            "variant={SPEAKER_REVIEW_VOICEPRINT_BADGE_VARIANTS[tone]}",
        );
        expect(speakerReviewVoiceprintBadgeHelper).toContain(
            "data-sot-tone={tone}",
        );
        expect(speakerReviewVoiceprintBadgeHelper).not.toContain("className=");
        expect(speakerReview).not.toContain("hidden={!isMergePopoverOpen}");
        expect(speakerReview).toContain(
            "data-open={String(isMergePopoverOpen)}",
        );
        expect(speakerReview).not.toContain(
            'className="grid items-center gap-[10px] overflow-visible p-[10px_12px]"',
        );
        expect(speakerReview).not.toContain(
            'className="grid h-auto min-h-8 w-full grid-cols-[minmax(0,1fr)_auto] justify-stretch px-2 py-1.5 text-left"',
        );
        expect(speakerReview).not.toContain(
            'className="h-auto min-h-8 w-full justify-start px-2 py-1.5"',
        );
        for (const retiredSpeakerReviewSliceToken of [
            'variant="speakerReviewMode"',
            'size="speakerReviewModeItem"',
            'layout="speakerReviewMode"',
            'spacing="speakerReviewMode"',
            'size="speakerReviewMappingClear"',
            'variant="speakerReviewMappingClear"',
            'variant="speakerReviewMerge"',
            'variant="speakerReviewMergeIcon"',
            'variant="speakerReviewInline"',
            'variant="speakerReviewState"',
        ]) {
            expect(speakerReview).not.toContain(retiredSpeakerReviewSliceToken);
        }
        expect(speakerReview).not.toContain('className="sp-head"');
        expect(speakerReview).not.toContain(
            'className="sp-rows sp-rows-review"',
        );
        expect(speakerReview).not.toContain('className="sp-row"');
        expect(speakerReview).not.toContain('className="sp-row-meta"');
        expect(speakerReview).not.toContain('className="sp-edit-actions"');
        expect(speakerReview).not.toContain('className="sp-suggest-row"');
        expect(speakerReview).not.toContain('className="sr-meta"');
        expect(speakerReview).not.toContain('className="sr-section"');
        expect(speakerReview).not.toContain('className="sr-section-head"');
        expect(speakerReview).not.toContain('className="sr-section-sub"');
        expect(speakerReview).not.toContain('className="sr-segments"');
        expect(speakerReview).not.toContain('className="sr-seg"');
        expect(speakerReview).not.toContain('className="sr-seg-speaker"');
        expect(speakerReview).not.toContain('className="sr-seg-text"');
        expect(transcriptionSection).toContain(
            'data-sot-panel="recording-transcription"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-banner="transcription-job"',
        );
        expect(transcriptionSection).toContain('from "@/components/ui/card";');
        expect(transcriptionSection).toContain("<Card");
        expect(transcriptionSection).toContain("<CardHeader");
        expect(transcriptionSection).toContain("<CardContent");
        expect(transcriptionSection).toContain("<Alert");
        expect(transcriptionSection).toContain("<AlertTitle");
        expect(transcriptionSection).toContain("<Button");
        expect(transcriptionSection).toContain(
            'import { Spinner } from "@/components/ui/spinner";',
        );
        expect(transcriptionSection).toContain(
            'import { Separator } from "@/components/ui/separator";',
        );
        expect(transcriptionSection).toContain("<Spinner");
        expect(transcriptionSection).toContain("<Separator");
        expect(transcriptionSection).toContain(
            'data-sot-section="recording-transcription-output"',
        );
        expect(transcriptionSection).toContain(
            "const recordingTranscriptionClassNames = {",
        );
        const recordingTranscriptionClassNamesBlock = extractBoundedSlice(
            transcriptionSection,
            "const recordingTranscriptionClassNames = {",
            "} as const;",
        );
        for (const ownerClassSnippet of [
            'card: "min-h-0 flex-1 gap-0"',
            'header: "flex flex-row items-center gap-3 px-3.5 py-3"',
            'heading: "flex min-w-0 items-center gap-3"',
            'icon: "size-4 flex-none text-muted-foreground"',
            'headerCopy: "flex min-w-0 flex-col gap-[3px]"',
            'body: "min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6"',
            'speakerReviewSection: "flex flex-col gap-2"',
            'sectionHead: "flex items-start justify-between gap-3 max-[860px]:flex-col"',
            'sectionTitle: "m-0 font-sans text-[12.5px] font-semibold text-foreground"',
            'sectionDescription:\n        "mt-0.5 mb-0 font-sans text-[11.5px] font-medium leading-[1.45] text-muted-foreground max-[860px]:[overflow-wrap:anywhere]"',
            'actions:\n        "inline-flex min-w-0 flex-wrap items-center justify-end gap-2 max-[860px]:justify-start"',
            'turn: "pt-[10px]"',
            'metaList: "mb-1.5 flex flex-wrap items-center gap-2.5 pt-2"',
        ]) {
            expect(recordingTranscriptionClassNamesBlock).toContain(
                ownerClassSnippet,
            );
        }
        for (const forbiddenLocalPanelResidual of [
            "[scrollbar-color:",
            "[scrollbar-width:",
            "[&::-webkit-scrollbar",
            "border-t border-border",
            "border-b border-dashed",
            "[&>svg]:size-",
            "data-[sot-tone=attribute]:",
            "data-[sot-tone=measure]:",
        ]) {
            expect(recordingTranscriptionClassNamesBlock).not.toContain(
                forbiddenLocalPanelResidual,
            );
            expect(transcriptionSection).not.toContain(
                forbiddenLocalPanelResidual,
            );
        }
        expect(transcriptionSection).not.toContain("dark:");
        expect(transcriptionSection).not.toMatch(
            /(?:text|border|bg)-\[var\(--(?:fg|line|glass)-/,
        );
        expect(recordingTranscriptionClassNamesBlock).not.toMatch(
            /\b(?:rgb|rgba|color-mix|oklch)\(/,
        );
        expect(recordingTranscriptionClassNamesBlock).not.toMatch(
            /#[0-9a-fA-F]{3,8}\b/,
        );
        expect(recordingTranscriptionClassNamesBlock).toContain(
            'outputSection: "flex flex-col gap-2"',
        );
        expect(recordingTranscriptionClassNamesBlock).toContain(
            'outputText:\n        "m-0 font-sans text-[14.5px] leading-[1.65] text-foreground [text-wrap:pretty] max-[860px]:[overflow-wrap:anywhere]"',
        );
        const transcriptionOutputOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-section="recording-transcription-output"',
            "section",
        );
        const transcriptionCardOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-panel="recording-transcription"',
            "Card",
        );
        const transcriptionHeaderOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-part="recording-transcription-header"',
            "CardHeader",
        );
        const transcriptionHeadingOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-part="recording-transcription-heading"',
            "div",
        );
        const transcriptionIconOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-part="recording-transcription-icon"',
            "FileText",
        );
        const transcriptionHeaderCopyOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-part="recording-transcription-header-copy"',
            "div",
        );
        const transcriptionBodyOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-part="recording-transcription-body"',
            "CardContent",
        );
        const transcriptionSectionHeadOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-part="recording-transcription-section-head"',
            "header",
        );
        const transcriptionSectionTitleOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-part="recording-transcription-section-title"',
            "h3",
        );
        const transcriptionSectionDescriptionOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-part="recording-transcription-section-description"',
            "p",
        );
        const transcriptionActionsOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-part="recording-transcription-actions"',
            "div",
        );
        const transcriptionTurnOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-part="recording-transcription-turn"',
            "div",
        );
        const transcriptionMetaOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-list="recording-transcription-meta"',
            "div",
        );
        const transcriptionSpeakerReviewOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-section="recording-transcription-speaker-review"',
            "section",
        );
        const transcriptionTextOpening = extractOpeningElement(
            transcriptionSection,
            'data-sot-part="recording-transcription-text"',
            "p",
        );
        expectClassNameConstReference(
            transcriptionCardOpening,
            "recordingTranscriptionClassNames.card",
        );
        expectClassNameConstReference(
            transcriptionHeaderOpening,
            "recordingTranscriptionClassNames.header",
        );
        expectClassNameConstReference(
            transcriptionHeadingOpening,
            "recordingTranscriptionClassNames.heading",
        );
        expectClassNameConstReference(
            transcriptionIconOpening,
            "recordingTranscriptionClassNames.icon",
        );
        expectClassNameConstReference(
            transcriptionHeaderCopyOpening,
            "recordingTranscriptionClassNames.headerCopy",
        );
        expectClassNameConstReference(
            transcriptionBodyOpening,
            "recordingTranscriptionClassNames.body",
        );
        expectClassNameConstReference(
            transcriptionSectionHeadOpening,
            "recordingTranscriptionClassNames.sectionHead",
        );
        expectClassNameConstReference(
            transcriptionSectionTitleOpening,
            "recordingTranscriptionClassNames.sectionTitle",
        );
        expectClassNameConstReference(
            transcriptionSectionDescriptionOpening,
            "recordingTranscriptionClassNames.sectionDescription",
        );
        expectClassNameConstReference(
            transcriptionActionsOpening,
            "recordingTranscriptionClassNames.actions",
        );
        expectClassNameConstReference(
            transcriptionTurnOpening,
            "recordingTranscriptionClassNames.turn",
        );
        expectClassNameConstReference(
            transcriptionMetaOpening,
            "recordingTranscriptionClassNames.metaList",
        );
        expectClassNameConstReference(
            transcriptionSpeakerReviewOpening,
            "recordingTranscriptionClassNames.speakerReviewSection",
        );
        expectClassNameConstReference(
            transcriptionOutputOpening,
            "recordingTranscriptionClassNames.outputSection",
        );
        expectClassNameConstReference(
            transcriptionTextOpening,
            "recordingTranscriptionClassNames.outputText",
        );
        expect(transcriptionSection).toContain(
            'data-sot-section="recording-transcription-speaker-review"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-part="recording-transcription-empty"',
        );
        expect(transcriptionSection).toContain('from "@/components/ui/empty";');
        for (const primitive of [
            "Empty,",
            "EmptyContent,",
            "EmptyDescription,",
            "EmptyHeader,",
            "EmptyMedia,",
            "EmptyTitle,",
        ]) {
            expect(transcriptionSection).toContain(primitive);
        }
        const transcriptionEmpty = extractElementSlice(
            transcriptionSection,
            'data-sot-part="recording-transcription-empty"',
            "Empty",
        );
        expect(transcriptionEmpty).toContain("<Empty");
        expect(transcriptionEmpty).toContain(
            'data-sot-part="recording-transcription-empty"',
        );
        expect(transcriptionEmpty).toContain('data-sot-state="empty"');
        expect(transcriptionEmpty).toContain('className="mt-4"');
        expect(transcriptionEmpty).toContain("<EmptyHeader>");
        expect(transcriptionEmpty).toContain("<EmptyMedia");
        expect(transcriptionEmpty).toContain('variant="icon"');
        expect(transcriptionEmpty).toContain("<FileText");
        expect(transcriptionEmpty).toContain(
            'data-sot-part="recording-transcription-empty-icon"',
        );
        expect(transcriptionEmpty).toContain(
            '<EmptyTitle data-sot-part="recording-transcription-empty-title">',
        );
        expect(transcriptionEmpty).toContain(
            '<EmptyDescription data-sot-part="recording-transcription-empty-description">',
        );
        expect(transcriptionEmpty).toContain("<EmptyContent>");
        expect(transcriptionEmpty).toContain("<Button");
        expect(transcriptionEmpty).toContain(
            'data-sot-control="start-local-transcription"',
        );
        expect(transcriptionEmpty).toContain("handleTranscribe(false)");
        expect(transcriptionEmpty).toContain("transcribeUnavailableReason ??");
        expect(transcriptionEmpty).not.toContain("<section");
        expect(transcriptionEmpty).not.toContain("<h3");
        expect(transcriptionEmpty).not.toContain("<p");
        expect(transcriptionSection).toContain(
            'data-sot-control="copy-local-transcript"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-control="retranscribe-local"',
        );
        expect(transcriptionSection).toContain(
            'data-sot-control="start-local-transcription"',
        );
        const transcriptionJobProcessingAlert = extractOpeningElement(
            transcriptionSection,
            'data-sot-state="processing"',
            "Alert",
        );
        expect(transcriptionJobProcessingAlert).toContain(
            'data-sot-banner="transcription-job"',
        );
        expect(transcriptionJobProcessingAlert).toContain(
            'data-sot-tone="info"',
        );
        const transcriptionJobProcessingBanner = extractElementSlice(
            transcriptionSection,
            'data-sot-state="processing"',
            "Alert",
        );
        expect(transcriptionJobProcessingBanner).toContain("<Spinner");
        expect(transcriptionJobProcessingBanner).toContain(
            "data-sot-banner-icon",
        );
        expect(transcriptionJobProcessingBanner).toContain(
            "data-sot-banner-spinner",
        );
        expect(transcriptionJobProcessingBanner).toContain(
            'aria-hidden="true"',
        );
        expect(transcriptionJobProcessingBanner).toContain(
            "data-sot-banner-title",
        );
        expect(transcriptionJobProcessingBanner).toContain(
            "data-sot-banner-body",
        );
        expect(transcriptionJobProcessingBanner).not.toContain("<RefreshCw");
        expect(transcriptionJobProcessingBanner).not.toContain(
            'className="animate-spin"',
        );
        expect(alertPrimitive).toContain("[&>[data-slot=spinner]]:size-4");
        expect(alertPrimitive).toContain(
            "has-[>[data-slot=spinner]]:grid-cols-[1rem_1fr]",
        );
        const transcriptionJobErrorAlert = extractOpeningElement(
            transcriptionSection,
            'data-sot-state="error"',
            "Alert",
        );
        expect(transcriptionJobErrorAlert).toContain('variant="statusError"');
        expect(transcriptionJobErrorAlert).not.toContain(
            'variant="destructive"',
        );
        const transcriptionActionExpectations = [
            {
                control: 'data-sot-control="copy-local-transcript"',
                variant: 'variant="outline"',
            },
            {
                control: 'data-sot-control="retranscribe-local"',
                variant: 'variant="destructive"',
            },
            {
                control: 'data-sot-control="start-local-transcription"',
                variant: 'variant="default"',
            },
        ];
        for (const { control, variant } of transcriptionActionExpectations) {
            const actionOpening = extractOpeningElement(
                transcriptionSection,
                control,
                "Button",
            );
            expect(actionOpening).toContain(variant);
            expect(actionOpening).toContain('size="sm"');
            for (const removedActionToken of [
                'variant="transcriptionAction"',
                'variant="transcriptionDangerAction"',
                'variant="transcriptionPrimaryAction"',
                'size="transcriptionAction"',
                "recordingTranscriptionButtonClassNames.action",
                "recordingTranscriptionButtonClassNames.danger",
                "recordingTranscriptionButtonClassNames.primary",
            ]) {
                expect(actionOpening).not.toContain(removedActionToken);
            }
        }
        for (const { meta, tone } of [
            { meta: "language", tone: "attribute" },
            { meta: "source", tone: "attribute" },
            { meta: "words", tone: "measure" },
            { meta: "characters", tone: "measure" },
        ]) {
            const metaOpening = extractOpeningElement(
                transcriptionSection,
                `data-sot-meta="${meta}"`,
                "RecordingTranscriptionMetaBadge",
            );
            expect(metaOpening).toContain(`data-sot-tone="${tone}"`);
            expect(metaOpening).not.toContain('variant="transcriptionMeta"');
            expect(metaOpening).not.toContain('variant="secondary"');
        }
        expect(transcriptionSection).toContain(
            "const RECORDING_TRANSCRIPTION_META_BADGE_VARIANT = {",
        );
        expect(transcriptionSection).toContain(
            "variant={RECORDING_TRANSCRIPTION_META_BADGE_VARIANT[tone]}",
        );
        expect(transcriptionSection).not.toContain(
            "RECORDING_TRANSCRIPTION_META_BADGE_CLASS_NAME",
        );
        expect(transcriptionSection).toContain('variant="outline"');
        const transcriptionJobLegacySelectorLines = globals
            .split("\n")
            .map((text, index) => ({ line: index + 1, text }))
            .filter(({ text }) =>
                /(^|\n|,)\s*\.tx-(?:banner|banner-ico|banner-text|banner-title|banner-detail|spin|row-chip|row-chip-ico)\b/.test(
                    text,
                ),
            );

        expect(transcriptionJobLegacySelectorLines).toEqual([]);
        for (const selector of RECORDING_TRANSCRIPTION_PRIMITIVE_SELECTORS) {
            const repaintBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(({ declarations }) =>
                RECORDING_TRANSCRIPTION_PRIMITIVE_REPAINT_DECLARATION_RE.test(
                    declarations,
                ),
            );

            expect(repaintBlocks).toEqual([]);
        }
        for (const selector of RECORDING_TRANSCRIPTION_EMPTY_REPAINT_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of [
            '[data-sot-part="recording-transcription-heading"]',
            '[data-sot-part="recording-transcription-icon"]',
            '[data-sot-part="recording-transcription-header-copy"]',
            '[data-sot-part="recording-transcription-body"]',
            '[data-sot-section="recording-transcription-speaker-review"]',
            '[data-sot-part="recording-transcription-section-head"]',
            '[data-sot-part="recording-transcription-section-title"]',
            '[data-sot-part="recording-transcription-section-description"]',
            '[data-sot-part="recording-transcription-actions"]',
            '[data-sot-part="recording-transcription-turn"]',
            '[data-sot-list="recording-transcription-meta"]',
            '[data-sot-section="recording-transcription-output"]',
            '[data-theme="dark"] [data-sot-section="recording-transcription-output"]',
            '[data-sot-part="recording-transcription-text"]',
        ]) {
            expect(globals).not.toContain(selector);
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of [
            "[data-sot-banner]",
            "[data-sot-banner-icon]",
            "[data-sot-banner-title]",
            "[data-sot-banner-spinner]",
            "[data-sot-banner-body]",
        ]) {
            const unscopedBannerRepaintBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(
                ({ prelude, declarations }) =>
                    !prelude.includes(
                        ':not([data-sot-banner="transcription-job"])',
                    ) &&
                    !prelude.includes('[data-sot-banner="source-state"]') &&
                    RECORDING_TRANSCRIPTION_PRIMITIVE_REPAINT_DECLARATION_RE.test(
                        declarations,
                    ),
            );

            expect(unscopedBannerRepaintBlocks).toEqual([]);
        }
        expect(transcriptionSection).toContain("<Badge");
        for (const legacyClass of [
            'className="transcript t-pane"',
            'className="transcript-head"',
            'className="transcript-body"',
            'className="sr-section"',
            'className="sr-section-head"',
            'className="sr-section-sub"',
            'className="empty-hint"',
            'className="eh-t"',
            'className="eh-h"',
            'className="turn"',
            'className="speaker"',
            'className="ts"',
        ]) {
            expect(transcriptionSection).not.toContain(legacyClass);
        }
        expect(transcriptionSkeletons).toContain(
            'from "@/components/ui/card";',
        );
        expect(transcriptionSkeletons).toContain(
            'from "@/components/ui/skeleton";',
        );
        expect(transcriptionSkeletons).toContain(
            'data-sot-panel="recording-transcription-skeleton"',
        );
        expect(transcriptionSkeletons).toContain(
            'data-sot-panel="recording-transcription-speaker-review-skeleton"',
        );
        expect(transcriptionSkeletons).toContain(
            'data-sot-panel="recording-transcription-review-skeleton"',
        );
        expect(transcriptionSkeletons).toContain(
            'data-sot-part="recording-transcription-skeleton-line"',
        );
        expect(transcriptionSkeletons).toContain('variant="default"');
        expect(transcriptionSkeletons).toContain('size="default"');
        expect(transcriptionSkeletons).toContain(
            "className={transcriptionSkeletonClassNames[size]}",
        );
        expect(transcriptionSkeletons).toContain(
            "const transcriptionSkeletonClassNames",
        );
        expect(transcriptionSkeletons).toContain('action: "h-[26px] w-[72px]"');
        expect(transcriptionSkeletons).toContain(
            'description: "h-[13px] w-full max-w-[220px]"',
        );
        expect(transcriptionSkeletons).toContain(
            '"line-long": "h-[13px] w-[92%]"',
        );
        for (const removedRecordingTranscriptionPrimitiveToken of [
            "recordingTranscription:",
            "recordingTranscriptionAction",
            "recordingTranscriptionDescription",
            "recordingTranscriptionFieldControl",
            "recordingTranscriptionFieldLabel",
            "recordingTranscriptionLineLong",
            "recordingTranscriptionLineMedium",
            "recordingTranscriptionLineShort",
            "recordingTranscriptionSpeaker",
            "recordingTranscriptionStatus",
            "recordingTranscriptionTime",
            "recordingTranscriptionTitle",
        ]) {
            expect(skeletonPrimitive).not.toContain(
                removedRecordingTranscriptionPrimitiveToken,
            );
        }
        expect(skeletonPrimitive).toContain(
            '"animate-pulse rounded-md bg-accent"',
        );
        expect(transcriptionSkeletons).not.toContain("type SkeletonLineSize");
        expect(transcriptionSkeletons).not.toContain(
            "const skeletonLineClassNames",
        );
        expect(transcriptionSkeletons).not.toContain(
            "className={skeletonLineClassNames[size]}",
        );
        expect(transcriptionSkeletons).not.toContain(
            "sanitizeSkeletonClassName",
        );
        expect(transcriptionSkeletons).not.toContain(
            "LEGACY_SKELETON_CLASS_NAMES",
        );
        expect(transcriptionSkeletons).not.toContain("mergeSkeletonClassName");
        for (const legacyClass of [
            'className="transcript t-pane"',
            'className="transcript-head"',
            'className="transcript-body"',
            'className="sr-section"',
            'className="sr-segments"',
            'className="sp-row"',
            'className="sp-row-meta"',
            'className="sp-rows"',
            'className="turn"',
            'className="speaker"',
        ]) {
            expect(transcriptionSkeletons).not.toContain(legacyClass);
        }
        expect(skeletonPrimitive).toContain(
            '"animate-pulse rounded-md bg-accent"',
        );
        expect(skeletonPrimitive).not.toContain("data-sot");
        expect(globals).not.toContain('[data-slot="skeleton"]');
        expect(globals).not.toContain("skshimmer");
        const listPanelIndex = detail.indexOf(
            'data-sot-panel="recording-detail-list"',
        );
        const listPanelStart = detail.lastIndexOf("<Card", listPanelIndex);
        const listPanelEnd = detail.indexOf("</Card>", listPanelStart);
        const listPanel = detail.slice(
            listPanelStart,
            listPanelEnd + "</Card>".length,
        );
        const detailHeaderPanelIndex = detail.indexOf(
            'data-sot-panel="recording-detail-header"',
        );
        const detailHeaderStart = detail.lastIndexOf(
            "<RecordingDetailCardHeader",
            detailHeaderPanelIndex,
        );
        const detailHeaderEnd = detail.indexOf(
            "</RecordingDetailCardHeader>",
            detailHeaderStart,
        );
        const detailHeader = detail.slice(
            detailHeaderStart,
            detailHeaderEnd + "</RecordingDetailCardHeader>".length,
        );
        const legacyDetailHeaderClassNamePattern =
            /className=(?:"[^"]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^"]*"|\{[^}]*\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status|rh-norm|rh-edit|ai-rename-anchor|more-anchor)\b[^}]*\})/;

        expect(detail).toContain('data-sot-surface="recording-workstation"');
        expect(listPanelIndex).toBeGreaterThanOrEqual(0);
        expect(listPanelStart).toBeGreaterThanOrEqual(0);
        expect(listPanelEnd).toBeGreaterThan(listPanelStart);
        expect(listPanel).toContain("<Card");
        expect(listPanel).toContain("hasNoPadding");
        expect(listPanel).toContain("<CardHeader");
        expect(listPanel).toContain("<CardTitle");
        expect(listPanel).toContain("<CardContent");
        expect(listPanel).toContain('data-sot-panel="recording-detail-list"');
        const recordingDetailListCardClassName =
            expectExactStringConstInitializer(
                detail,
                "RECORDING_DETAIL_LIST_CARD_CLASS_NAME",
                EXPECTED_RECORDING_DETAIL_LIST_CARD_CLASS_NAME,
            );
        expect(listPanel).toContain(
            "className={RECORDING_DETAIL_LIST_CARD_CLASS_NAME}",
        );
        expect(recordingDetailListCardClassName).not.toMatch(
            OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-header"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-title"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-content"',
        );
        expect(listPanel).toContain(
            'data-sot-list="recording-detail-list-rows"',
        );
        expect(listPanel).toContain(
            'data-sot-item="recording-detail-list-row"',
        );
        expect(listPanel).toContain('data-sot-state="selected"');
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-body"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-title"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-meta"',
        );
        expect(listPanel).toContain(
            'data-sot-part="recording-detail-list-row-duration"',
        );
        for (const {
            constName,
            expected,
            marker,
            tagName,
        } of RECORDING_DETAIL_LIST_OWNER_CLASS_INITIALIZERS) {
            const ownerClassName = expectExactStringConstInitializer(
                detail,
                constName,
                expected,
            );
            const openingElement = extractOpeningElement(
                detail,
                marker,
                tagName,
            );

            expect(openingElement).toContain(marker);
            expectClassNameConstReference(openingElement, constName);
            expect(ownerClassName).not.toMatch(
                OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
            );
            expect(ownerClassName).not.toMatch(
                /(?:text|bg|border)-\[var\(|duration-\[|ease-\[|gap-\[|rounded-\[|py-\[|text-\[|tracking-\[/,
            );
        }
        expect(listPanel).toContain("<SotPlayerSourceTag");
        expect(listPanel).toContain("<SotPlayerStatusBadge");
        for (const legacyClass of [
            'className="panel"',
            'className="list-header"',
            'className="lh-titlebar"',
            'className="lh-title"',
            'className="real-list"',
            'className="row active"',
            'className="body"',
            'className="title"',
            'className="meta"',
            'className="dur mono"',
        ]) {
            expect(listPanel).not.toContain(legacyClass);
        }
        expect(detailHeaderPanelIndex).toBeGreaterThanOrEqual(0);
        expect(detailHeaderStart).toBeGreaterThanOrEqual(0);
        expect(detailHeaderEnd).toBeGreaterThan(detailHeaderStart);
        expect(detail).toContain('data-sot-panel="recording-detail-header"');
        expect(detail).toContain("function RecordingDetailCardHeader");
        expect(detail).toContain("function RecordingDetailCardTitle");
        expect(detail).toContain("RECORDING_DETAIL_HEADER_CLASS_NAME");
        expect(detail).toContain("RECORDING_DETAIL_HEADER_TITLE_CLASS_NAME");
        expect(detail).toContain(
            "RECORDING_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME",
        );
        const detailHeaderClassName = expectExactStringConstInitializer(
            detail,
            "RECORDING_DETAIL_HEADER_CLASS_NAME",
            "flex flex-row items-center gap-2.5 px-1 pt-1 pb-0 data-[sot-state=saving]:pb-px",
        );
        const detailHeaderTitleClassName = expectExactStringConstInitializer(
            detail,
            "RECORDING_DETAIL_HEADER_TITLE_CLASS_NAME",
            "min-w-0 flex-1 truncate text-xl text-foreground",
        );
        const detailHeaderTitleInputClassName =
            expectExactStringConstInitializer(
                detail,
                "RECORDING_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME",
                "h-8 min-w-0 flex-1",
            );
        const detailHeaderLocalBadgeClassName =
            expectExactStringConstInitializer(
                detail,
                "RECORDING_DETAIL_HEADER_LOCAL_BADGE_CLASS_NAME",
                "ml-1 shrink-0",
            );
        const detailHeaderStatusBadgeClassName =
            expectExactStringConstInitializer(
                detail,
                "RECORDING_DETAIL_HEADER_STATUS_BADGE_CLASS_NAME",
                "ml-1 shrink-0",
            );
        for (const headerClassName of [
            detailHeaderClassName,
            detailHeaderTitleClassName,
            detailHeaderTitleInputClassName,
            detailHeaderLocalBadgeClassName,
            detailHeaderStatusBadgeClassName,
        ]) {
            expect(headerClassName).not.toMatch(
                /\b(?:rec-head|rec-h2|rec-h2-local|rec-h2-input|rec-h2-status)\b/,
            );
            expect(headerClassName).not.toMatch(
                /!\b(?:border|bg)|\[font:|text-\[var\(--|bg-\[var\(--|border-\[var\(--|tracking-\[/,
            );
        }
        const recordingHeaderButtonClassNames = extractBoundedSlice(
            detail,
            "const recordingWorkstationButtonClassNames = {",
            "} as const;",
        );
        expect(recordingHeaderButtonClassNames).toContain(
            'headerIconButton: "text-muted-foreground"',
        );
        expect(recordingHeaderButtonClassNames).toContain(
            'headerActionButton: "min-w-[103px]"',
        );
        const recordingHeaderButtonResidualPattern =
            /header(?:Icon|Action)Button:[\s\S]*?(?:\[_svg|stroke-\[|stroke-line(?:cap|join)|\[_svg:not|!border|!bg|\[var\(--(?:fg|bg|line|glass|shadow)|font-sans|text-\[|rounded-\[|gap-\[|px-\[|backdrop-)/;
        expect(recordingHeaderButtonClassNames).not.toMatch(
            recordingHeaderButtonResidualPattern,
        );
        expect(detail).toContain(
            "RECORDING_DETAIL_HEADER_LOCAL_BADGE_CLASS_NAME",
        );
        expect(detail).toContain(
            "RECORDING_DETAIL_HEADER_STATUS_BADGE_CLASS_NAME",
        );
        expect(detailHeader).toContain("<RecordingDetailCardHeader");
        expect(detailHeader).toContain("<RecordingDetailCardTitle");
        expect(detailHeader).toContain("<Badge");
        expect(detailHeader).toContain('data-sot-part="detail-header-title"');
        expect(detailHeader).toContain(
            'data-sot-part="detail-header-title-input"',
        );
        expect(detailHeader).toContain(
            'data-sot-part="detail-header-title-status"',
        );
        expect(detailHeader).toContain('data-sot-part="detail-header-action"');
        expect(detailHeader).toContain("data-rh-edit-start");
        expect(detailHeader).toContain("data-rh-edit-save");
        expect(detailHeader).toContain("data-rh-edit-cancel");
        expect(detailHeader).toContain("<Button");
        expect(detailHeader).toContain("<Input");
        for (const removedRecordingDetailCardBadgeVariant of [
            'variant="detailHeader"',
            'variant="detailHeaderTitle"',
            'variant="detailHeaderLocal"',
            'variant="detailHeaderStatus"',
            'controlSize="detailHeaderTitle"',
        ]) {
            expect(detailHeader).not.toContain(
                removedRecordingDetailCardBadgeVariant,
            );
        }
        expect(detailHeader).toContain('variant="secondary"');
        expect(detailHeader).toContain('variant="outline"');
        expect(detailHeader).toContain('variant="ghost"');
        expect(detailHeader).toContain('size="icon-sm"');
        expect(detailHeader).toContain('size="sm"');
        expect(detailHeader).toContain(
            "recordingWorkstationButtonClassNames.headerIconButton",
        );
        expect(detailHeader).toContain(
            "recordingWorkstationButtonClassNames.headerActionButton",
        );
        expect(detail).not.toContain("dark:data-[sot-state=selected]:border");
        expect(detail).not.toContain("dark:data-[sot-state=selected]:bg-[rgb(");
        expect(detail).not.toContain(
            "dark:data-[sot-state=selected]:shadow-none",
        );
        expect(detail).not.toContain("dark:hover:bg-accent/50");
        expect(detailHeader).not.toContain('variant="detailHeaderIconAction"');
        expect(detailHeader).not.toContain('size="detailHeaderIconAction"');
        expect(detailHeader).not.toContain('variant="detailHeaderAction"');
        expect(detailHeader).not.toContain('size="detailHeaderAction"');
        expect(detailHeader).toContain(
            "RECORDING_DETAIL_HEADER_TITLE_INPUT_CLASS_NAME",
        );
        expect(detail).toContain(
            "const recordingDetailHeaderState = isSavingRename",
        );
        expect(detailHeader).not.toContain(
            '"relative flex flex-row items-center gap-2.5 px-1 pt-1 pb-0"',
        );
        expect(detailHeader).not.toContain(
            'className="min-w-0 flex-1 truncate"',
        );
        expect(detailHeader).not.toContain('className="h-8 min-w-0 flex-1"');
        expect(detailHeader).not.toContain('className="ml-1 shrink-0"');
        expect(detailHeader).toContain(
            'recordingDetailHeaderState === "normal"',
        );
        expect(detailHeader).toContain(
            'recordingDetailHeaderState === "editing"',
        );
        expect(detailHeader).toContain(
            'recordingDetailHeaderState === "saving"',
        );
        expect(detailHeader).toContain('data-sot-state="saving"');
        expect(detailHeader).toContain("localDeleteAvailable ? (");
        expect(detailHeader).not.toMatch(legacyDetailHeaderClassNamePattern);
        expect(globals).not.toContain(
            '[data-sot-panel="recording-detail-header"]',
        );
        for (const selector of [
            '[data-sot-part="detail-header-title-input"][data-slot="input"]',
            '[data-sot-part="detail-header-title-status"]',
            '[data-sot-part="detail-header-local-badge"]',
        ]) {
            expect(globals).not.toContain(selector);
        }
        const metadataPanelIndex = detail.indexOf(
            'data-sot-panel="recording-detail-metadata"',
        );
        const metadataStart = detail.lastIndexOf("<Card", metadataPanelIndex);
        const metadataEnd = detail.indexOf("</Card>", metadataStart);
        const metadataPanel = detail.slice(
            metadataStart,
            metadataEnd + "</Card>".length,
        );
        const sourceRecordPanelIndex = detail.indexOf(
            'data-sot-panel="recording-source-record"',
        );
        const sourceRecordStart = detail.lastIndexOf(
            "<Card",
            sourceRecordPanelIndex,
        );
        const sourceRecordEnd = detail.indexOf("</Card>", sourceRecordStart);
        const sourceRecordPanel = detail.slice(
            sourceRecordStart,
            sourceRecordEnd + "</Card>".length,
        );

        expect(detail).toContain(
            'import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";',
        );
        expect(metadataPanelIndex).toBeGreaterThanOrEqual(0);
        expect(metadataStart).toBeGreaterThanOrEqual(0);
        expect(metadataEnd).toBeGreaterThan(metadataStart);
        expect(metadataPanel).toContain("<Card");
        expect(metadataPanel).toContain("<CardHeader");
        expect(metadataPanel).toContain("<CardTitle");
        expect(metadataPanel).toContain("<CardContent");
        expect(metadataPanel).toContain(
            'data-sot-panel="recording-detail-metadata"',
        );
        expect(metadataPanel).toContain(
            'data-sot-part="recording-detail-metadata-header"',
        );
        expect(metadataPanel).toContain(
            'data-sot-part="recording-detail-metadata-title"',
        );
        expect(metadataPanel).toContain(
            'data-sot-part="recording-detail-metadata-body"',
        );
        for (const {
            constName,
            expected,
            marker,
            tagName,
        } of RECORDING_DETAIL_METADATA_OWNER_CLASS_INITIALIZERS) {
            const ownerClassName = expectExactStringConstInitializer(
                detail,
                constName,
                expected,
            );
            const openingElement = extractOpeningElement(
                detail,
                marker,
                tagName,
            );

            expect(openingElement).toContain(marker);
            expectClassNameConstReference(openingElement, constName);
            expect(ownerClassName).not.toMatch(
                OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
            );
            expect(ownerClassName).not.toMatch(
                RECORDING_DETAIL_CARD_OWNER_FORBIDDEN_CLASS_PATTERN,
            );
        }
        expect(metadataPanel.match(/<Field\b/g)).toHaveLength(5);
        expect(metadataPanel.match(/<FieldContent\b/g)).toHaveLength(5);
        expect(metadataPanel.match(/<FieldTitle\b/g)).toHaveLength(5);
        expect(metadataPanel.match(/<FieldDescription\b/g)).toHaveLength(5);
        expect(sourceRecordPanelIndex).toBeGreaterThanOrEqual(0);
        expect(sourceRecordStart).toBeGreaterThanOrEqual(0);
        expect(sourceRecordEnd).toBeGreaterThan(sourceRecordStart);
        expect(sourceRecordPanel).toContain("<Card");
        expect(sourceRecordPanel).toContain("<CardHeader");
        expect(sourceRecordPanel).toContain("<CardTitle");
        expect(sourceRecordPanel).toContain("<CardContent");
        expect(sourceRecordPanel).toContain(
            'data-sot-panel="recording-source-record"',
        );
        for (const {
            constName,
            expected,
            marker,
            tagName,
        } of RECORDING_SOURCE_RECORD_OWNER_CLASS_INITIALIZERS) {
            const ownerClassName = expectExactStringConstInitializer(
                detail,
                constName,
                expected,
            );
            const openingElement = extractOpeningElement(
                detail,
                marker,
                tagName,
            );

            expect(openingElement).toContain(marker);
            expectClassNameConstReference(openingElement, constName);
            expect(ownerClassName).not.toMatch(
                OWNER_WORKSPACE_FORBIDDEN_CLASS_PATTERN,
            );
            expect(ownerClassName).not.toMatch(
                RECORDING_DETAIL_CARD_OWNER_FORBIDDEN_CLASS_PATTERN,
            );
        }
        expect(sourceRecordPanel.match(/<Field\b/g)).toHaveLength(2);
        expect(sourceRecordPanel.match(/<FieldContent\b/g)).toHaveLength(2);
        expect(sourceRecordPanel.match(/<FieldTitle\b/g)).toHaveLength(2);
        expect(sourceRecordPanel.match(/<FieldDescription\b/g)).toHaveLength(3);
        for (const part of [
            "recording-source-record-header",
            "recording-source-record-title",
            "recording-source-record-actions",
            "recording-source-record-body",
            "recording-source-record-tabs",
            "recording-source-record-hint",
        ]) {
            expect(sourceRecordPanel).toContain(`data-sot-part="${part}"`);
        }
        expect(button).not.toContain("sourceRecordCopyAction:");
        expect(button).not.toContain('variant="sourceRecordCopyAction"');
        expect(button).not.toContain('size="sourceRecordCopyAction"');
        expect(sourceRecordPanel).toContain("handleCopyLocalTranscript");
        expect(sourceRecordPanel).toContain("handleCopyRawTranscript");
        expect(sourceRecordPanel).toContain("!localTranscriptCopyText.trim()");
        expect(sourceRecordPanel).toContain("!transcription?.text?.trim()");
        expect(sourceRecordPanel).toMatch(
            /disabled=\{\s*copyingAction === "local"\s*\|\|\s*!localTranscriptCopyText\.trim\(\)\s*\}/,
        );
        expect(sourceRecordPanel).toMatch(
            /disabled=\{\s*copyingAction ===\s*"raw-transcript"\s*\|\|\s*!transcription\?\.text\?\.trim\(\)\s*\}/,
        );
        expect(sourceRecordPanel).toContain('t("common.copying")');
        expect(sourceRecordPanel).toMatch(
            /t\(\s*"transcription\.copyTranscript",?\s*\)/,
        );
        expect(sourceRecordPanel).toMatch(
            /t\(\s*"speakerReview\.copyRawTranscript",?\s*\)/,
        );
        expect(sourceRecordPanel).toMatch(
            /aria-busy=\{\s*copyingAction ===\s*"local"\s*\}/,
        );
        expect(sourceRecordPanel).toMatch(
            /aria-busy=\{\s*copyingAction ===\s*"raw-transcript"\s*\}/,
        );
        for (const marker of [
            "handleCopyLocalTranscript",
            "handleCopyRawTranscript",
        ]) {
            const markerIndex = sourceRecordPanel.indexOf(marker);
            expect(markerIndex).toBeGreaterThanOrEqual(0);
            const copyButtonSource = sourceRecordPanel.slice(
                Math.max(0, markerIndex - 520),
                markerIndex + 1200,
            );

            expect(copyButtonSource).toContain("<Button");
            expect(copyButtonSource).toContain('variant="outline"');
            expect(copyButtonSource).toContain('size="sm"');
            expect(copyButtonSource).not.toContain(
                'variant="sourceRecordCopyAction"',
            );
            expect(copyButtonSource).not.toContain(
                'size="sourceRecordCopyAction"',
            );
            expect(copyButtonSource).toContain(
                '<Copy data-icon="inline-start" />',
            );
        }
        expect(detail).toContain(
            'data-sot-panel="recording-source-record-empty"',
        );
        expect(detail).toContain('from "@/components/ui/empty";');
        for (const primitive of [
            "Empty,",
            "EmptyContent,",
            "EmptyDescription,",
            "EmptyHeader,",
            "EmptyMedia,",
            "EmptyTitle,",
        ]) {
            expect(detail).toContain(primitive);
        }
        const sourceRecordEmpty = extractElementSlice(
            detail,
            'data-sot-panel="recording-source-record-empty"',
            "Empty",
        );
        expect(sourceRecordEmpty).toContain("<Empty");
        expect(sourceRecordEmpty).toContain(
            'data-sot-panel="recording-source-record-empty"',
        );
        expect(sourceRecordEmpty).toContain("<EmptyHeader>");
        expect(sourceRecordEmpty).toContain("<EmptyMedia");
        expect(sourceRecordEmpty).toContain('variant="icon"');
        expect(sourceRecordEmpty).toContain("<FileText />");
        expect(sourceRecordEmpty).toContain(
            '<EmptyTitle data-sot-part="recording-source-record-empty-title">',
        );
        expect(sourceRecordEmpty).toContain(
            '<EmptyDescription data-sot-part="recording-source-record-empty-description">',
        );
        expect(sourceRecordEmpty).toContain(
            '<EmptyContent data-sot-part="recording-source-record-empty-content">',
        );
        expect(sourceRecordEmpty).not.toContain("<div");
        expect(globals).not.toContain(
            '[data-sot-panel="recording-source-record-empty"]',
        );
        for (const legacyClass of [
            'className="panel"',
            'className="transcript"',
            'className="transcript-head"',
            'className="rec-h2"',
            'className="transcript-body"',
            'className="detail-empty"',
        ]) {
            expect(metadataPanel).not.toContain(legacyClass);
            expect(sourceRecordPanel).not.toContain(legacyClass);
        }
        expect(detail).not.toContain('className="detail-empty"');
        for (const selector of RECORDING_DETAIL_CARD_PRIMITIVE_SELECTORS) {
            const repaintBlocks = collectCssRuleBlocks(
                globals,
                selector,
            ).filter(({ declarations }) =>
                RECORDING_DETAIL_PRIMITIVE_REPAINT_DECLARATION_RE.test(
                    declarations,
                ),
            );

            expect(repaintBlocks).toEqual([]);
        }
        for (const selector of RECORDING_DETAIL_NAV_BACK_REMOVED_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of RECORDING_DETAIL_ROW_REMOVED_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of RECORDING_SOURCE_RECORD_LAYOUT_REMOVED_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(detail).toContain("data-rename-mode=");
        expect(detail).toContain('localDeleteAvailable ? "true" : "false"');
        expect(detail).toContain("data-more-anchor");
        expect(detail).toContain("data-more-trigger");
        expect(detail).toContain('from "@/components/ui/dropdown-menu"');
        expect(detail).toContain("<DropdownMenu");
        expect(detail).toContain("open={moreOpen}");
        expect(detail).toContain("<DropdownMenuTrigger asChild>");
        expect(detail).toContain("<DropdownMenuContent");
        expect(detail).toContain("data-more-menu");
        expect(detail).toContain('data-sot-menu="recording-more-actions"');
        expect(detail).toContain('data-sot-menu-item="rename"');
        expect(detail).toContain('data-sot-menu-item="ai-rename"');
        expect(detail).toContain('data-sot-menu-item="retranscribe"');
        expect(detail).toContain('data-sot-menu-item="delete-local"');
        expect(detail).toContain('data-sot-tone="danger"');
        expect(detail).toContain("<DropdownMenuSeparator");
        expect(detail).toContain('data-sot-menu-separator="delete"');
        expect(detail).toContain("data-sot-menu-hint");
        for (const compositionToken of MORE_ACTIONS_MENU_COMPOSITION_TOKENS) {
            expect(detail).toContain(compositionToken);
        }
        expect(detail).not.toContain('className="more-menu"');
        expect(detail).not.toContain('className="more-menu-item"');
        expect(detail).not.toContain('className="more-menu-sep"');
        expect(detail).not.toContain('className="more-menu-hint"');
        expect(detail).toContain("handleMoreRetranscribe");
        expect(detail).toContain("SotPlayerSourceTag");
        expect(detail).toContain("SotPlayerStatusBadge");
        expect(detail).toContain("<SotPlayerSourceTag");
        expect(detail).toContain("<SotPlayerStatusBadge");
        expect(detail).not.toContain('className="src-tag"');
        expect(detail).not.toContain('className="b ok"');
        const playerNoAudioAlert = extractOpeningElement(
            player,
            'part="recording-player-no-audio"',
            "SotPlayerNoAudioAlert",
        );
        const playerBackControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-back"',
            "Button",
        );
        const playerPlayControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-play"',
            "Button",
        );
        const playerForwardControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-forward"',
            "Button",
        );
        const playerSpeedControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-speed"',
            "Button",
        );
        const playerVolumeControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-volume"',
            "Button",
        );
        const playerVolumeMuteControl = extractOpeningElement(
            player,
            'data-sot-control="recording-player-volume-mute"',
            "Button",
        );
        expect(player).toContain('data-sot-surface="recording-player"');
        expect(player).toContain("data-sot-state=");
        expect(player).toContain("aria-label={");
        expect(player).toContain('title="Click to cycle playback speed"');
        expect(player).not.toContain(
            'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
        );
        expect(player).toContain(
            'import { Card, CardContent, CardHeader } from "@/components/ui/card";',
        );
        expect(player).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(player).toContain("<SotPlayerNoAudioAlert");
        expect(player).not.toContain("<Alert");
        expect(player).not.toContain("<AlertTitle");
        expect(player).not.toContain("<AlertDescription");
        expect(player).toContain("<Card");
        expect(player).toContain("hasNoPadding");
        expect(player).toContain("<CardHeader");
        expect(player).toContain("<CardContent");
        expect(player).toContain("<Button");
        expect(player).toContain("<Slider");
        expect(player).toContain("<PopoverContent");
        expect(player).not.toContain("<SotPlayerControlButton");
        expect(player).not.toContain("<SotPlayerPrimaryButton");
        expect(player).not.toContain("<SotPlayerSpeedButton");
        for (const control of [playerBackControl, playerForwardControl]) {
            expect(control).toContain("<Button");
            expect(control).toContain('variant="ghost"');
            expect(control).toContain('size="icon"');
        }
        expect(playerPlayControl).toContain("<Button");
        expect(playerPlayControl).toContain('variant="default"');
        expect(playerPlayControl).toContain('size="icon-lg"');
        expect(playerSpeedControl).toContain("<Button");
        expect(playerSpeedControl).toContain('variant="ghost"');
        expect(playerSpeedControl).toContain('size="sm"');
        expect(playerSpeedControl).toContain(
            "className={RECORDING_PLAYER_SPEED_CLASS_NAME}",
        );
        for (const control of [playerVolumeControl, playerVolumeMuteControl]) {
            expect(control).toContain("<Button");
            expect(control).toContain('variant="ghost"');
            expect(control).toContain('size="icon-sm"');
        }
        for (const legacyControlToken of [
            'variant="outline"',
            'size="icon-xs"',
            'className="size-11 shrink rounded-full shadow-sm"',
            'className="shrink rounded-full"',
        ]) {
            expect(player).not.toContain(legacyControlToken);
        }
        expect(playerNoAudioAlert).toContain(
            'part="recording-player-no-audio"',
        );
        expect(playerNoAudioAlert).toContain(
            'iconPart="recording-player-no-audio-icon"',
        );
        expect(playerNoAudioAlert).toContain(
            'textPart="recording-player-no-audio-text"',
        );
        expect(playerNoAudioAlert).toContain(
            'titlePart="recording-player-no-audio-title"',
        );
        expect(playerNoAudioAlert).toContain(
            'descriptionPart="recording-player-no-audio-description"',
        );
        expect(playerNoAudioAlert).toContain(
            "playbackDisabled={playbackDisabled}",
        );
        expect(alertPrimitive).not.toContain("playerNoAudio");
        expect(playerNoAudioAlert).not.toContain("variant=");
        expect(playerNoAudioAlert).not.toContain("density=");
        expect(playerNoAudioAlert).not.toContain("layout=");
        expect(playerNoAudioAlert).not.toContain("className=");
        expect(alertPrimitive).not.toContain("data-player-no-audio-text");
        expect(sotPlayerPrimitives).toContain("SotPlayerNoAudioAlert");
        expectExactStringConstInitializers(
            player,
            RECORDING_PLAYER_CLASS_INITIALIZERS,
        );
        expectSotPlayerNoAudioPrimitiveBindings(sotPlayerPrimitives);
        expect(sotPlayerPrimitives).not.toContain("<SotPlayerNoAudioIcon");
        expect(player).not.toContain(
            '<SotPlayerNoAudioIcon className="size-3.5" />',
        );
        expect(player).toContain('data-sot-part="recording-player-meta"');
        expect(player).toContain('data-sot-panel="recording-player-controls"');
        expect(player).toContain(
            "className={RECORDING_PLAYER_META_CLASS_NAME}",
        );
        expect(player).toContain(
            "className={RECORDING_PLAYER_CONTROLS_CLASS_NAME}",
        );
        expect(player).toContain(
            "className={RECORDING_PLAYER_VOLUME_ANCHOR_CLASS_NAME}",
        );
        expect(player).toMatch(
            /playbackDisabled &&\s*RECORDING_PLAYER_DISABLED_CLASS_NAME/,
        );
        expect(player).toContain(
            'data-sot-panel="recording-player-volume-popover"',
        );
        expect(button).not.toContain("data-player-control-icon");
        expect(sotPlayerPrimitives).not.toContain("data-player-control-icon");
        expect(button).not.toContain("dashboard-player-volume-icon");
        expect(button).not.toContain("recording-player-volume-icon");
        expect(player).not.toContain("data-player-control-icon");
        expect(player).not.toContain("<SotPlayerVolumePopoverContent");
        expect(player).not.toContain("<SotPlayerVolumeSlider");
        expect(player).not.toContain(
            'className="w-[200px] min-w-[200px] gap-0 overflow-visible px-2.5 py-2"',
        );
        expect(player).toContain("<Popover");
        expect(player).toContain("<PopoverTrigger asChild>");
        expect(player).toContain('side="top"');
        expect(player).toContain('align="end"');
        expect(player).toContain(
            'data-sot-control="recording-player-volume-slider"',
        );
        expect(player).toContain("<Slider");
        expect(player).not.toContain(`variant="${"player"}Seek"`);
        expect(player).not.toContain(`variant="${"player"}Volume"`);
        for (const hook of RECORDING_PLAYER_BUTTON_CONTROL_HOOKS) {
            expect(player).toContain(`data-sot-control="${hook}"`);
        }
        for (const selector of RECORDING_PLAYER_CARD_PRIMITIVE_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of PLAYER_ALERT_CARD_BADGE_PRIMITIVE_REPAINT_SELECTORS) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(
            collectCssRuleBlocks(globals, '[data-sot-control="player-status"]'),
        ).toEqual([]);
        for (const [
            surface,
            selector,
        ] of PLAYER_PORTAL_VOLUME_SCOPED_SELECTORS) {
            expect(
                collectCssRuleBlocks(globals, selector).filter(({ prelude }) =>
                    prelude.includes(surface),
                ),
            ).toEqual([]);
        }
        for (const hook of RECORDING_PLAYER_BUTTON_CONTROL_HOOKS) {
            const directBlocks = collectCssRuleBlocks(
                globals,
                `[data-sot-control="${hook}"]`,
            );
            const primitiveBlocks = collectCssRuleBlocks(
                globals,
                `[data-sot-control="${hook}"][data-slot="button"]`,
            );

            for (const block of [...directBlocks, ...primitiveBlocks]) {
                expect(block.declarations).not.toMatch(
                    RECORDING_PLAYER_BUTTON_PRIMITIVE_REPAINT_DECLARATION_RE,
                );
            }
        }
        expect(globals).not.toContain('[data-sot-surface="recording-player"]');
        expect(globals).not.toContain(
            '[data-sot-panel="recording-player-controls"]',
        );
        expect(globals).not.toContain("recording-player-control-icon");
        expect(globals).not.toContain("recording-player-current-time");
        expect(globals).not.toContain("recording-player-duration");
        expect(globals).not.toContain("recording-player-volume-anchor");
        for (const legacyClass of [
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
        ]) {
            expect(player).not.toContain(legacyClass);
        }
        expect(tagManager).toContain('data-sot-panel="recording-tag-manager"');
        expect(tagManager).toContain('data-sot-control="recording-tag-toggle"');
        expect(tagManager).toContain('data-sot-part="head"');
        expect(tagManager).toContain('data-sot-part="body"');
        expect(tagManager).toContain('data-sot-part="footer"');
        expect(tagManager).toContain('data-sot-part="picker"');
        expect(tagManager).toContain('data-sot-part="selected-chip"');
        expect(tagManager).toContain('data-sot-part="tag-option"');
        expect(tagManager).toContain('data-sot-part="color-swatch"');
        expect(tagManager).toContain('data-sot-part="icon-option"');
        expect(tagManager).toContain('data-sot-part="toggle-note"');
        const tagManagerToggleNote = extractElementSlice(
            tagManager,
            'data-sot-part="toggle-note"',
            "RecordingTagManagerToggleNote",
        );
        expect(tagManagerToggleNote).toContain(
            "<RecordingTagManagerToggleNote",
        );
        expect(tagManagerToggleNote).not.toContain(
            'variant="recordingTagToggleNote"',
        );
        expect(tagManagerToggleNote).toContain('data-sot-part="toggle-note"');
        expect(tagManagerToggleNote).not.toContain('className="sr-only"');
        for (const anchor of [
            'data-open="true"',
            'data-state={visibleError ? "error" : undefined}',
            "data-sot-state={panelState}",
            "data-sot-toggle-state={",
            'data-sot-create-state={isCreating ? "saving" : "idle"}',
            'data-sot-control="recording-tag-manager-close"',
            'data-sot-control="recording-tag-error-retry"',
            'data-sot-control="recording-tag-delete-open"',
            'data-sot-control="recording-tag-delete-confirm"',
            'data-sot-control="recording-tag-create-cancel"',
            'data-sot-part="create-field"',
            'data-sot-part="picker-frame"',
            'data-sot-part="tag-loading-icon"',
            'data-sot-part="tag-check"',
            'data-sot-state={saving ? "saving" : selected ? "selected" : "idle"}',
            'data-sot-state={color === item ? "selected" : "idle"}',
            'data-sot-state={icon === item ? "selected" : "idle"}',
            'data-sot-state={\n                        deletingTagId === deleteTarget.id ? "saving" : "ready"',
            "SOT_TAG_MANAGER_ERROR_TEXT",
            "renderErrorAlert",
            "setDeleteTarget(catalogTag)",
        ]) {
            expect(tagManager).toContain(anchor);
        }
        expect(tagManager).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(tagManager).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(tagManager).toContain('from "@/components/ui/alert";');
        expect(tagManager).toContain('from "@/components/ui/card";');
        expect(tagManager).toContain('from "@/components/ui/empty";');
        expect(tagManager).toContain('from "@/components/ui/field";');
        expect(tagManager).toContain('from "@/components/ui/input-group";');
        expect(tagManager).toContain('from "@/components/ui/spinner";');
        expect(tagManager).toContain('from "@/components/ui/toggle-group";');
        expect(tagManager).toContain("<Card");
        expect(tagManager).toContain("<CardDescription");
        expect(tagManager).toContain("<CardHeader");
        expect(tagManager).toContain("<CardContent");
        expect(tagManager).toContain("<CardFooter");
        expect(tagManager).toContain("<Alert");
        expect(tagManager).toContain("<Empty");
        expect(tagManager).toContain("<EmptyHeader");
        expect(tagManager).toContain("<EmptyTitle");
        expect(tagManager).toContain("<EmptyDescription");
        expect(tagManager).toContain("<Badge");
        expect(tagManager).toContain("<Button");
        expect(tagManager).toContain("<Field");
        expect(tagManager).toContain("<FieldGroup");
        expect(tagManager).toContain("<FieldSet");
        expect(tagManager).toContain("<FieldLegend");
        expect(tagManager).toContain("<InputGroup");
        expect(tagManager).toContain("<InputGroupInput");
        expect(tagManager).toContain("<InputGroupButton");
        expect(tagManager).toContain("<ToggleGroup");
        expect(tagManager).toContain("<ToggleGroupItem");
        const tagManagerColorPicker = extractElementSlice(
            tagManager,
            'data-sot-part="color-swatches"',
            "ToggleGroup",
        );
        const tagManagerIconPicker = extractElementSlice(
            tagManager,
            'data-sot-part="icon-grid"',
            "ToggleGroup",
        );
        expect(tagManagerColorPicker).toContain('variant="default"');
        expect(tagManagerColorPicker).toContain('size="sm"');
        expect(tagManagerColorPicker).toContain("className={");
        expect(tagManagerColorPicker).toContain(
            '"tagm-swatches flex-wrap rounded-none"',
        );
        expect(tagManagerColorPicker).toContain(
            'picker === "quick" ? "gap-1" : "gap-2"',
        );
        expect(tagManagerColorPicker).toContain(
            'spacing={picker === "quick" ? 1 : 2}',
        );
        expect(tagManagerColorPicker).not.toContain(
            'variant="recordingTagColorPicker"',
        );
        expect(tagManagerColorPicker).not.toContain(
            'size="recordingTagColorPicker"',
        );
        expect(tagManagerColorPicker).not.toContain(
            'layout="recordingTagColorPicker"',
        );
        expect(tagManagerColorPicker).toContain(
            "RECORDING_TAG_SWATCH_ITEM_CLASS_NAME",
        );
        expect(tagManagerColorPicker).toContain(
            "recordingTagSwatchColorClassName[item]",
        );
        expect(tagManagerColorPicker).toContain("data-sot-tag-color={item}");
        expect(tagManagerColorPicker).not.toContain('variant="swatch"');
        expect(tagManagerColorPicker).not.toContain('size="swatch"');
        expect(tagManagerColorPicker).not.toContain('variant="outline"');
        const tagManagerColorPickerFrame = extractBoundedSlice(
            tagManager,
            "const renderColorPicker = () => (",
            "const renderIconPicker = () => (",
        );
        expect(tagManagerColorPickerFrame).toContain("<FieldSet");
        expect(tagManagerColorPickerFrame).toContain("<FieldLegend");
        expect(tagManagerColorPickerFrame).toContain('variant="label"');
        expect(tagManagerColorPickerFrame).not.toContain('role="group"');
        expect(tagManagerColorPickerFrame).not.toContain("aria-labelledby=");
        expect(tagManagerColorPickerFrame).toContain(
            'data-sot-part="picker-frame"',
        );
        expect(tagManagerColorPickerFrame).toContain('data-sot-picker="color"');
        expect(tagManagerColorPickerFrame).toContain(
            "id={tagColorPickerLabelId}",
        );
        expect(tagManagerColorPickerFrame).toContain(
            "className={RECORDING_TAG_MANAGER_PICKER_LABEL_CLASS_NAME}",
        );
        expect(tagManagerColorPickerFrame).toContain(
            'data-sot-part="picker-label"',
        );
        expect(tagManagerColorPickerFrame).not.toContain("<fieldset");
        expect(tagManagerColorPickerFrame).not.toContain("<legend");
        expect(tagManagerIconPicker).toContain('variant="default"');
        expect(tagManagerIconPicker).toContain('size="sm"');
        expect(tagManagerIconPicker).toContain('layout="iconGrid"');
        expect(tagManagerIconPicker).toContain(
            'className="tagm-icon-grid rounded-none"',
        );
        expect(tagManagerIconPicker).toContain("spacing={1.5}");
        expect(tagManagerIconPicker).toContain('variant="outline"');
        expect(tagManagerIconPicker).toContain('size="sm"');
        expect(tagManagerIconPicker).toContain(
            "RECORDING_TAG_MANAGER_ICON_OPTION_CLASS_NAME",
        );
        expect(tagManagerIconPicker).not.toContain('size="iconPicker"');
        expect(tagManagerIconPicker).not.toContain(
            'variant="recordingTagIconPicker"',
        );
        expect(tagManagerIconPicker).not.toContain(
            'size="recordingTagIconPicker"',
        );
        expect(tagManagerIconPicker).not.toContain(
            'layout="recordingTagIconPicker"',
        );
        expect(tagManagerIconPicker).not.toContain(
            'spacing="recordingTagIconPicker"',
        );
        const tagManagerIconPickerFrame = extractBoundedSlice(
            tagManager,
            "const renderIconPicker = () => (",
            "let panelContent: ReactNode;",
        );
        expect(tagManagerIconPickerFrame).toContain("<FieldSet");
        expect(tagManagerIconPickerFrame).toContain("<FieldLegend");
        expect(tagManagerIconPickerFrame).toContain('variant="label"');
        expect(tagManagerIconPickerFrame).not.toContain('role="group"');
        expect(tagManagerIconPickerFrame).not.toContain("aria-labelledby=");
        expect(tagManagerIconPickerFrame).toContain(
            'data-sot-part="picker-frame"',
        );
        expect(tagManagerIconPickerFrame).toContain('data-sot-picker="icon"');
        expect(tagManagerIconPickerFrame).toContain(
            "id={tagIconPickerLabelId}",
        );
        expect(tagManagerIconPickerFrame).toContain(
            "className={RECORDING_TAG_MANAGER_PICKER_LABEL_CLASS_NAME}",
        );
        expect(tagManagerIconPickerFrame).toContain(
            'data-sot-part="picker-label"',
        );
        expect(tagManagerIconPickerFrame).not.toContain("<fieldset");
        expect(tagManagerIconPickerFrame).not.toContain("<legend");
        expect(tagManagerIconPicker).not.toContain(
            'variant="recordingTagIconOption"',
        );
        expect(tagManagerIconPicker).not.toContain(
            'size="recordingTagIconOption"',
        );
        for (const primitiveImport of [
            "Field,",
            "FieldGroup,",
            "FieldLabel",
            "FieldLegend,",
            "FieldSet,",
            "InputGroup,",
            "Popover",
            "PopoverAnchor",
            "PopoverContent",
            "ToggleGroup,",
            "Badge",
            "Button",
            "CardDescription,",
            "Alert,",
            "Empty,",
            "Spinner",
        ]) {
            expect(tagManager).toContain(primitiveImport);
        }
        expect(tagManager).toContain('data-sot-control="recording-tag-create"');
        for (const ownerWrapper of [
            "RecordingTagManagerPopoverContent",
            "RecordingTagManagerHeader",
            "RecordingTagManagerTitle",
            "RecordingTagManagerContent",
            "RecordingTagManagerFooter",
            "RecordingTagManagerToggleNote",
            "RecordingTagManagerBadge",
        ]) {
            expect(tagManager).toContain(ownerWrapper);
        }
        for (const removedOwnerMap of [
            "recordingTagManagerButtonClassNames",
            "recordingTagManagerCardClassNames",
            "recordingTagManagerContentClassNames",
            "recordingTagManagerBadgeClassNames",
            "recordingTagManagerFieldClassNames",
            "recordingTagManagerToggleGroupClassNames",
            "recordingTagManagerSotColorClassName",
            "recordingTagManagerSwatchToneClassNames",
            ["recordingTagManager", "ClassName("].join(""),
        ]) {
            expect(tagManager).not.toContain(removedOwnerMap);
        }
        expect(recordingTagVisuals).not.toContain(
            ["recordingTagVisual", "ClassName("].join(""),
        );
        expect(tagManager).toContain('"create"');
        expect(tagManager).toContain('"delete"');
        expect(tagManager).toContain('"default"');
        expect(tagManager).toContain('"empty"');
        expect(tagManager).toContain('"saving"');
        expect(tagManager).toContain('"tight"');
        expect(tagManager).toContain('"compact"');
        expect(tagManager).toContain("contentVariant={contentVariant}");
        expect(tagManager).not.toContain('variant="recordingTagToggleNote"');
        for (const recordingTagBusinessProp of [
            'variant="recordingTagErrorRetry"',
            'variant="recordingTagToggle"',
            'variant="recordingTagInlineCreate"',
            'variant="recordingTagCancel"',
            'variant="recordingTagCreate"',
            'variant="recordingTagDelete"',
            'variant="recordingTagPanelClose"',
            'variant="recordingTagPickerFrame"',
            'variant="recordingTagPickerLabel"',
            'variant="recordingTagSection"',
            'variant="recordingTagSectionLabel"',
            'variant="recordingTagError"',
            'size="recordingTag',
            'density="recordingTag',
            'layout="recordingTag',
            'spacing="recordingTag',
        ]) {
            expect(tagManager).not.toContain(recordingTagBusinessProp);
        }
        expect(tagManager).not.toContain(
            "RECORDING_TAG_INLINE_CREATE_BUTTON_CLASS_NAME",
        );
        expect(tagManager).not.toContain(
            "RECORDING_TAG_CHIP_REMOVE_BUTTON_VARIANT",
        );
        for (const retiredButtonProp of [
            'variant="ghostNeutral"',
            'variant="pill"',
            'variant="accentIcon"',
            'variant="actionPrimary"',
            'variant="actionDestructive"',
            'variant="chipRemove"',
            'variant="ghostIconCompact"',
            'size="control-sm"',
            'size="pill-sm"',
            'size="icon-chip"',
            'size="icon-2xs"',
        ]) {
            expect(tagManager).not.toContain(retiredButtonProp);
        }
        expect(tagManager).toContain('variant="ghost"');
        expect(tagManager).toContain('variant="default"');
        expect(tagManager).toContain('variant="destructive"');
        expect(tagManager).not.toContain('variant="pickerFrame"');
        expect(tagManager).not.toContain('variant="picker"');
        expect(tagManager).toContain('className="tagm-sec gap-2"');
        expect(tagManager).toContain('className="tagm-sec-label mb-0"');
        expect(tagManager).toMatch(
            /<FieldSet[\s\S]*className="tagm-sec gap-2"[\s\S]*data-sot-part="section"[\s\S]*<FieldLegend[\s\S]*variant="label"[\s\S]*className="tagm-sec-label mb-0"/,
        );
        expect(tagManager).toContain('appearance="pill"');
        expect(tagManager).not.toContain('variant="swatch"');
        expect(tagManager).toContain('variant="statusError"');
        expect(tagManager).toContain('variant="destructiveSoftNeutral"');
        expect(tagManager).toContain('density="compact"');
        expect(tagManager).toContain('density="comfortable"');
        expect(tagManager).toContain('layout="inline"');
        expect(tagManager).not.toContain('size="colorPicker"');
        expect(tagManager).not.toContain('size="iconPicker"');
        expect(tagManager).toContain('size="sm"');
        expect(tagManager).not.toContain('size="icon"');
        expect(tagManager).toContain('size="icon-xs"');
        expect(tagManager).toContain('size="icon-compact"');
        expect(tagManager).not.toContain('size="swatch"');
        expect(tagManager).toContain("RECORDING_TAG_SWATCH_ITEM_CLASS_NAME");
        expect(tagManager).toMatch(
            /recordingTagTextColorClassName\s*\[\s*tag\.color\s*\]/,
        );
        expect(tagManager).toContain("recordingTagSwatchColorClassName[item]");
        expect(tagManager).not.toContain(
            "RECORDING_TAG_COLOR_TOKEN_CLASS_NAME",
        );
        expect(tagManager).toContain(
            "tagm-sel-chip justify-normal gap-1 rounded-full border-border pr-1",
        );
        expect(tagManager).toContain(
            'variant={appearance === "pill" ? "secondary" : "default"}',
        );
        expect(tagManager).not.toContain("text-[var(--recording-tag-accent)]");
        expect(tagManager).not.toContain("--recording-tag-accent");
        expect(tagManager).not.toContain("--badge-pill-height");
        expect(tagManager).not.toContain("--badge-check-bg");
        expect(globals).not.toContain("--badge-pill-height");
        expect(globals).not.toContain("--badge-check-bg");
        expect(tagManager).toContain("size-[18px]");
        expect(tagManager).toContain("p-0");
        expect(tagManager).toContain("hover:scale-110");
        expect(tagManager).toContain("data-[state=on]:border-foreground");
        expect(tagManager).not.toContain(
            [
                "data-[state=on]:shadow",
                "[inset_0_0_0_2px_var(--background)]",
            ].join("-"),
        );
        expect(tagManager).toContain('size="icon-compact"');
        expect(tagManager).toContain('placement="inlineStart"');
        expect(tagManager).toContain('"relative whitespace-nowrap"');
        expect(tagManager).toMatch(
            /\(saving \|\| !interactive\) &&\s*"pointer-events-none disabled:opacity-100"/,
        );
        expect(tagManager).toContain('saving && "before:hidden"');
        expect(tagManager).toContain(
            "disabled={saving || !interactive || busy}",
        );
        expect(tagManager).toContain(
            'aria-disabled={saving || !interactive || busy ? "true" : undefined}',
        );
        expect(tagManager).toContain("<Spinner");
        expect(tagManager).toContain('appearance="checkDot"');
        expect(tagManager).toContain('data-icon="inline-start"');
        expect(tagManager).toContain('data-icon="inline-end"');
        expect(tagManager).not.toContain(["!", "size-2.5"].join(""));
        expect(tagManager).not.toContain("stroke-[3]");
        expect(tagManager).not.toContain("[stroke-linecap:butt]");
        expect(tagManager).not.toContain("[stroke-linejoin:miter]");
        expect(tagManager).not.toContain("<LoaderCircle");
        expect(tagManager).not.toContain('className="animate-spin"');
        expect(tagManager).not.toContain("recordingTagSwatchStyle");
        expect(tagManager).not.toContain("--recording-tag-swatch-color");
        expect(tagManager).not.toContain("--toggle-swatch-color");
        expect(tagManager).not.toContain("bg-white");
        expect(tagManager).toContain("shadow-[var(--card-popover-shadow)]");
        expect(tagManager).not.toMatch(
            /\bshadow-\[(?!var\(--card-popover-shadow\)\])[^\]]+\]/,
        );
        expect(
            tagManager.match(
                /\b(?:bg|text|border|ring|fill|stroke)-\[var\([^\]]+\)\]/g,
            ),
        ).toEqual([
            "border-[var(--card-popover-border)]",
            "bg-[var(--card-popover-bg)]",
            "border-[var(--card-popover-divider)]",
            "bg-[var(--card-popover-footer-bg)]",
            "border-[var(--line-hairline)]",
            "bg-[var(--bg-recessed)]",
            "text-[var(--fg-secondary)]",
            "bg-[var(--bg-elevated)]",
            "text-[var(--fg-primary)]",
        ]);
        expect(recordingTagVisuals).not.toMatch(/\bshadow-\[[^\]]+\]/);
        expect(recordingTagVisuals).not.toMatch(
            /\b(?:bg|text|border|ring|fill|stroke)-\[var\([^\]]+\)\]/,
        );
        expect(tagManager).not.toMatch(/!(?:size|p-|text-|bg-)/);
        expect(recordingTagVisuals).not.toMatch(/!(?:size|p-|text-|bg-)/);
        expectSourceToExcludeForbiddenSubstrings(
            cardPrimitive,
            CARD_PRIMITIVE_FORBIDDEN_BUSINESS_TOKENS,
        );
        expect(tagManager).toContain(
            "max-h-[460px] w-[320px] max-w-[calc(100vw-2rem)] gap-0",
        );
        expect(tagManager).toContain(
            "RECORDING_TAG_MANAGER_TOGGLE_NOTE_CLASS_NAME",
        );
        expect(emptyPrimitive).not.toContain("recordingTagEmptyState:");
        expect(inputGroupPrimitive).not.toContain("recordingTagCreateRow:");
        expect(inputGroupPrimitive).not.toContain("recordingTagNameInput:");
        expect(fieldPrimitive).not.toContain("recordingTagPickerFrame:");
        expect(fieldPrimitive).not.toContain("recordingTagPickerLabel:");
        expect(fieldPrimitive).not.toContain("recordingTagSectionLabel:");
        for (const removedFieldPickerApi of [
            "pickerFrame",
            "colorPicker",
            "iconPicker",
            "sectionLabel",
            '"picker"',
        ]) {
            expect(fieldPrimitive).not.toContain(removedFieldPickerApi);
        }
        for (const removedToggleGroupPickerApi of ["iconPicker"]) {
            expect(toggleGroupPrimitive).not.toContain(
                removedToggleGroupPickerApi,
            );
        }
        for (const featureOwnedFieldClassName of [
            "RECORDING_TAG_MANAGER_PICKER_FRAME_CLASS_NAME",
            "RECORDING_TAG_MANAGER_PICKER_LABEL_CLASS_NAME",
        ]) {
            expect(tagManager).toContain(featureOwnedFieldClassName);
        }
        expect(tagManager).toContain("tagm-picker flex flex-col gap-2.5");
        expect(tagManager).toContain("tagm-picker-label");
        expect(tagManager).toContain(
            "RECORDING_TAG_MANAGER_ICON_OPTION_CLASS_NAME",
        );
        expect(alertPrimitive).not.toContain("recordingTagError:");
        expect(alertPrimitive).not.toContain("recordingTagDeleteConfirm:");
        expect(tagManager).not.toContain(
            'className="max-h-[460px] w-[320px] max-w-[calc(100vw-2rem)] gap-0 max-md:max-w-none"',
        );
        expect(tagManager).toMatch(
            /<InputGroup[\s\S]*variant="compact"[\s\S]*data-sot-part="create-row"/,
        );
        expect(tagManager).toMatch(
            /<InputGroupInput[\s\S]*variant="compact"[\s\S]*data-sot-control="recording-tag-name"/,
        );
        for (const retiredRecordingTagShellToken of [
            'variant="popoverCompact"',
            '"popoverCreate"',
            '"popoverDelete"',
            '"popoverDefault"',
            '"popoverEmpty"',
            '"popoverSaving"',
            '"popoverTight"',
            '"popoverCompact"',
            'variant="popoverNote"',
            'variant="recordingTagPickerFrame"',
            'variant="recordingTagPickerLabel"',
            'variant="recordingTagSection"',
            'variant="recordingTagSectionLabel"',
            'variant="recordingTagDeleteConfirm"',
            'density="recordingTag',
            'layout="recordingTag',
            'size="recordingTag',
        ]) {
            expect(tagManager).not.toContain(retiredRecordingTagShellToken);
        }
        const tagManagerInlineCreateButton = extractElementSlice(
            tagManager,
            'aria-label="添加"',
            "InputGroupButton",
        );
        expect(tagManagerInlineCreateButton).toContain('variant="default"');
        expect(tagManagerInlineCreateButton).toContain('size="icon-compact"');
        expect(tagManagerInlineCreateButton).toContain('"tagm-add-btn"');
        expect(tagManagerInlineCreateButton).toContain(
            'data-sot-control="recording-tag-create"',
        );
        expect(tagManagerInlineCreateButton).toContain("disabled={!canCreate}");
        expect(tagManager).toContain('size="sm"');
        expect(tagManager).toContain('data-sot-control="recording-tag-create"');
        expect(tagManager).toContain('"min-w-0 max-w-full"');
        expect(tagManager).toContain('className="gap-[14px]"');
        expect(tagManager).toContain('className="tagm-create gap-2"');
        expect(tagManager).toContain("disabled={!canCreate}");
        expect(tagManager).toContain("onClick={() => void handleCreateTag()}");
        for (const shadcnRegression of [
            "accentSelf",
            "icon-chip-hidden-glyph",
            "aria-disabled={!canCreate}",
            "mr-[6px] align-[-2px]",
            "flex min-h-[59px] flex-col gap-2.5 rounded-md border bg-muted/40 p-3",
            "flex min-h-[103px] flex-col gap-2.5 rounded-md border bg-muted/40 p-3",
            "mb-2 flex items-center gap-1.5 font-mono text-[10.5px] leading-none font-semibold uppercase tracking-[0.08em] text-muted-foreground",
            "[display:grid] grid-cols-6",
            'className="m-0 contents min-w-0 border-0 p-0"',
            "[&>[data-slot=field-legend]]:mb-4",
        ]) {
            expect(tagManager).not.toContain(shadcnRegression);
        }
        expect(tagManager).not.toContain("mergeTagManagerClassName");
        expect(tagManager).not.toContain("transcript t-pane");
        expect(tagManager).not.toContain("className?: string");
        expect(tagManager).not.toContain("cl-note");

        const tagManagerEmpty = extractElementSlice(
            tagManager,
            'data-sot-panel="recording-tag-empty"',
            "Empty",
        );
        expect(tagManagerEmpty).toContain("<Empty");
        expect(tagManagerEmpty).toContain(
            'data-sot-panel="recording-tag-empty"',
        );
        expect(tagManagerEmpty).toContain('data-sot-part="empty"');
        expect(tagManagerEmpty).toContain('data-sot-state="empty"');
        expect(tagManagerEmpty).toContain('variant="popover"');
        expect(tagManagerEmpty).toContain('<EmptyHeader variant="popover">');
        expect(tagManagerEmpty).toContain(
            '<EmptyTitle\n                                variant="popover"\n                                data-sot-part="empty-message"',
        );
        expect(tagManagerEmpty).toContain("还没有任何标签");
        expect(tagManagerEmpty).toContain(
            '<EmptyDescription\n                                variant="popover"\n                                data-sot-part="empty-description"',
        );
        expect(tagManagerEmpty).toContain("在下方为这条录音创建第一个标签。");
        expect(tagManagerEmpty).not.toContain(
            '<div data-sot-part="empty-message">',
        );
        expect(tagManagerEmpty).not.toContain(
            '<div data-sot-part="empty-description">',
        );

        const removedTagManagerPrimitiveSelectors = [
            '[data-sot-control="recording-tag-icon"][data-slot="toggle-group-item"]',
            '[data-sot-control="recording-tag-icon"][data-sot-state="selected"]',
            '[data-sot-panel="recording-tag-error"][data-slot="alert"]',
            '[data-sot-panel="recording-tag-delete-confirm"][data-slot="alert"]',
            '[data-sot-panel="recording-tag-empty"] [data-sot-part="empty-message"]',
            '[data-sot-panel="recording-tag-empty"] [data-sot-part="empty-description"]',
            '[data-sot-control="recording-tag-error-retry"][data-slot="button"]',
            '[data-sot-part="footer"]\n    [data-slot="button"]',
            '[data-sot-panel="recording-tag-manager"][data-slot="popover-content"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="head"][data-slot="card-header"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="body"][data-slot="card-content"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="create"][data-slot="field-group"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="picker"][data-slot="field-set"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="picker-label"][data-slot="field-legend"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="picker-frame"][data-slot="field-set"]',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="selected-chip"][data-slot="badge"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="tag-loading-icon"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="tag-check"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="tag-check"] svg',
            '[data-sot-panel="recording-tag-manager"]\n    [data-sot-part="create-row"][data-slot="input-group"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="create-meta"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="picker-frame"]',
            '[data-sot-panel="recording-tag-manager"] [data-sot-part="toggle-note"]',
            '[data-theme="dark"] [data-sot-panel="recording-tag-manager"]',
        ];

        for (const selector of removedTagManagerPrimitiveSelectors) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }

        const tagManagerPrimitiveButtonBlocks = collectCssRuleBlocks(
            globals,
            '[data-sot-panel="recording-tag-manager"]',
        ).filter(({ prelude }) => prelude.includes('[data-slot="button"]'));
        expect(tagManagerPrimitiveButtonBlocks).toEqual([]);

        const tagManagerRepaintSelectors = [
            '[data-sot-panel="recording-tag-manager"][data-slot="popover-content"]',
            '[data-sot-part="selected-chip"][data-slot="badge"]',
            '[data-sot-control="recording-tag-manager-close"][data-slot="button"]',
            '[data-sot-control="recording-tag-delete-open"][data-slot="button"]',
            '[data-sot-control="recording-tag-toggle"][data-slot="button"]',
            '[data-sot-control="recording-tag-create"][data-slot="button"]',
            '[data-sot-control="recording-tag-error-retry"][data-slot="button"]',
            '[data-sot-part="footer"]\n    [data-slot="button"]',
            '[data-sot-part="create-row"]\n    [data-slot="input-group-control"]',
        ];
        const forbiddenPrimitiveRepaintDeclaration =
            /^\s*(?:-webkit-backdrop-filter|backdrop-filter|background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|outline|padding|transition|width)\s*:|\b(?:linear-gradient|oklch)\(/m;

        for (const selector of tagManagerRepaintSelectors) {
            const blocks = collectCssRuleBlocks(globals, selector);
            for (const block of blocks) {
                expect(block.declarations).not.toMatch(
                    forbiddenPrimitiveRepaintDeclaration,
                );
            }
        }
        const tagManagerGlobalPanelBlocks = collectCssRuleBlocks(
            globals,
            '[data-sot-panel="recording-tag-manager"]',
        );
        const tagManagerPanelClass = extractBoundedSlice(
            tagManager,
            "const RECORDING_TAG_MANAGER_PANEL_CLASS_NAME =",
            ";",
        );
        const tagManagerContentClassName = extractBoundedSlice(
            tagManager,
            "const RECORDING_TAG_MANAGER_CONTENT_CLASS_NAME =",
            ";",
        );

        expect(tagManagerGlobalPanelBlocks).toEqual([]);
        expect(globals).not.toContain(["--z", "context-menu"].join("-"));
        for (const ownerPanelSnippet of [
            "tagm-panel max-h-[460px]",
            "max-h-[460px] w-[320px] max-w-[calc(100vw-2rem)]",
            "max-md:w-[calc(100vw-24px)] max-md:max-w-none",
        ]) {
            expect(tagManagerPanelClass).toContain(ownerPanelSnippet);
        }
        expect(tagManagerPanelClass).not.toContain("fixed");
        expect(tagManagerPanelClass).not.toContain("z-[var(--z-dropdown)]");
        expect(tagManagerPanelClass).not.toContain("pointer-events-auto");
        expect(tagManagerContentClassName).toContain("overflow-auto");
        expect(tagManager).toContain('"tagm-body"');

        expect(sourceReport).toContain("SAFE_SOURCE_DETAIL_KEYS");
        expect(
            existsSync(path.join(ROOT, "features/source-report/styles.ts")),
        ).toBe(false);

        const sourceReportPane = extractBoundedSlice(
            sourceReportPrimitives,
            "export function SourceReportPane",
            "export function SourceReportDescription",
        );
        const sourceReportState = extractBoundedSlice(
            sourceReportPrimitives,
            "export function SourceReportState",
            "export function DashboardSourceReportState",
        );
        const sourceReportCopyButton = extractBoundedSlice(
            sourceReportPrimitives,
            "export function SourceReportCopyButton",
            "export function SourceReportActionButton",
        );
        const sourceReportActionButton = extractBoundedSlice(
            sourceReportPrimitives,
            "export function SourceReportActionButton",
            "export function SourceReportActionRow",
        );

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

        expect(sourceReportPane).toContain('surface === "dashboard"');
        expect(sourceReportPane).toContain('"dashboard-source-report"');
        expect(sourceReportPane).toContain('"recording-source-report"');
        expect(sourceReportPane).toContain("data-testid={testId}");
        expect(sourceReportPane).toContain("data-state={state}");
        expect(sourceReportPane).toContain('aria-busy={state === "loading"}');
        expect(sourceReportPane).toContain("hidden={hidden}");
        expect(sourceReportState).toContain(
            'testId = "recording-source-report-state"',
        );
        expect(sourceReportState).toContain("data-testid={testId}");
        expect(sourceReportState).toContain("data-state={state}");
        expect(sourceReportState).toContain("data-substate={subState}");
        expect(sourceReportPrimitives).toContain(
            'testId="dashboard-source-report-state"',
        );
        expect(sourceReportCopyButton).toContain(
            "data-testid={`source-report-copy-${copy}`}",
        );
        expect(sourceReportCopyButton).toContain(
            "data-state={feedbackState ?? copyState}",
        );
        expect(sourceReportCopyButton).toContain("data-tab-scope={tabScope}");
        expect(sourceReportCopyButton).toContain("variant={variant}");
        expect(sourceReportCopyButton).toContain('size="xs"');
        expect(sourceReportActionButton).toContain("data-testid={testId}");
        expect(sourceReportActionButton).toContain("data-state={state}");
        expect(sourceReportActionButton).toContain("variant={variant}");
        expect(sourceReportActionButton).toContain('size="xs"');
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
        expect(sourceReportPrimitives).toContain(
            "data-testid={`source-report-missing-${state}`}",
        );
        expect(sourceReportPrimitives).toContain(
            'data-testid="source-report-empty-surface"',
        );
        expect(sourceReportPrimitives).not.toMatch(
            /SotSourceReport|data-sot-source-report|sourceReportSotStyles|SourceReportStyleVariables/,
        );

        expect(sourceReport).toContain(
            "<SourceReportPane className={className} state={sourceReportState}>",
        );
        expect(sourceReport).toContain('<SourceReportState state="loading">');
        expect(sourceReport).toContain('<SourceReportState state="empty">');
        expect(sourceReport).toContain("subState={sourceReportSubState}");
        expect(sourceReport).toContain("<SourceReportMissingNotice");
        expect(sourceReport).toContain('testId="source-report-refresh"');
        expect(sourceReport).toContain('testId="source-report-open-source"');
        expect(sourceReport).toContain('testId="source-report-repull"');
        expect(sourceReport).not.toContain("@/features/source-report/styles");
        expect(sourceReport).not.toContain("JSON.stringify(data.detail");
        expect(sourceReport).not.toContain("data-sot-missing-copy");

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
            const copyButton = extractOpeningElement(
                sourceReport,
                `copy="${copyKind}"`,
                "SourceReportCopyButton",
            );
            expect(copyButton).toContain(`copy="${copyKind}"`);
            expect(copyButton).toContain(`copyState={${copyState}}`);
            expect(copyButton).toContain(`disabled={${copyDisabled}}`);
        }
        expect(detail).toContain("<SourceReportPanel");
        expect(detail).toContain("onAvailabilityChange=");
        expect(detail).not.toContain("SotSourceReport");
        const sotPlayerTagChip = extractBoundedSlice(
            sotPlayerPrimitives,
            "export function SotPlayerTagChip",
            "export type SotPlayerStatusTone",
        );
        expect(sotPlayerPrimitives).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(sotPlayerPrimitives).toContain(
            'import { cn } from "@/lib/utils";',
        );
        expect(sotPlayerPrimitives).toContain("data-recording-tag-chip");
        expect(sotPlayerPrimitives).toContain("data-recording-tag-add");
        expect(button).not.toContain("playerTagAdd:");
        expect(button).not.toContain("playerTagChip:");
        expect(button).not.toContain("playerTagOverflow:");
        expect(badge).not.toContain("playerTagChip:");
        expect(badge).not.toContain("playerTagOverflow:");
        for (const sotPlayerTagClassConstant of [
            "PLAYER_TAG_COLOR_CLASS",
            "PLAYER_TAG_CHIP_CLASS",
            "PLAYER_TAG_OVERFLOW_CLASS",
        ]) {
            expect(sotPlayerPrimitives).toContain(sotPlayerTagClassConstant);
        }
        for (const sotPlayerTagClassToken of [
            'blue: "text-chart-1"',
            'green: "text-chart-3"',
            'red: "text-destructive"',
            "border-dashed",
            "ring-1 ring-ring",
        ]) {
            expect(sotPlayerPrimitives).toContain(sotPlayerTagClassToken);
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
        }
        for (const sotPlayerTagChipToken of [
            "--sot-player-tag-chip-bg",
            "--sot-player-tag-chip-border",
            "--sot-player-tag-chip-fg",
        ]) {
            expect(sotPlayerPrimitives).not.toContain(sotPlayerTagChipToken);
        }
        expect(sotPlayerPrimitives).not.toContain(
            "SOT_PLAYER_TAG_CHIP_VARIABLES_CLASS",
        );
        expect(sotPlayerPrimitives).not.toContain("SOT_PLAYER_TAG_COLOR_TOKEN");
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
        expect(sotPlayerTagChip).toContain('variant="outline"');
        expect(sotPlayerTagChip).toContain('variant="secondary"');
        expect(sotPlayerTagChip).toContain('size="xs"');
        expect(sotPlayerTagChip).toContain('className="border-dashed"');
        expect(sotPlayerTagChip).toContain("PLAYER_TAG_CHIP_CLASS");
        expect(sotPlayerTagChip).toContain("PLAYER_TAG_COLOR_CLASS[tag.color]");
        expect(sotPlayerTagChip).toContain("PLAYER_TAG_OVERFLOW_CLASS");
        expect(sotPlayerPrimitives).toMatch(
            /<Plus\s+data-icon="inline-start"\s+aria-hidden="true"\s*\/>/,
        );
        expect(sotPlayerPrimitives).toMatch(
            /<Button[\s\S]*data-recording-tag-chip[\s\S]*<span\s+data-icon="inline-start">\s*<RecordingTagIconGlyph\s+icon=\{tag\.icon\}\s*\/>\s*<\/span>/,
        );
        expect(sotPlayerPrimitives).toContain(
            'data-sot-part="recording-tag-overflow"',
        );
        expect(sotPlayerPrimitives).not.toContain("tag-chip-action");
        expect(sotPlayerPrimitives).not.toContain("tag-chip-trigger");
        expect(sotPlayerPrimitives).not.toContain("tag-chip-inline");
        expect(sotPlayerPrimitives).not.toContain("utag-add");
        expect(sotPlayerPrimitives).not.toContain("utag-plus");
        expect(sotPlayerPrimitives).not.toContain("data-tagm-trigger");
        expect(sotPlayerPrimitives).not.toContain("recordingTagColorClassName");
        expect(recordingTagVisuals).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(recordingTagVisuals).toContain("<Badge");
        expect(recordingTagVisuals).toContain("data-recording-tag-chip");
        const sharedRecordingTagChip = extractOpeningElement(
            recordingTagVisuals,
            "data-recording-tag-chip",
            "Badge",
        );
        expect(sharedRecordingTagChip).not.toContain(
            'variant="recordingTagChip"',
        );
        expect(sharedRecordingTagChip).toContain("className={cn(");
        expect(sharedRecordingTagChip).toContain("recordingTagChipClassName,");
        expect(recordingTagVisuals).toContain('data-icon="inline-start"');
        expect(recordingTagVisuals).not.toContain("[&>svg]:size-[11px]");
        expect(recordingTagVisuals).not.toContain("[&>svg]:stroke-2");
        expect(recordingTagVisuals).toContain(
            "recordingTagTextColorClassName[tag.color]",
        );
        expect(recordingTagVisuals).toContain(
            "recordingTagIconComponentFor(tag.icon)",
        );
        expect(recordingTagVisuals).toContain(
            '<RecordingTagIconGlyph data-icon="inline-start" icon={Icon} />',
        );
        expect(recordingTagVisuals).not.toContain(
            "satisfies Record<RecordingTagIcon, LucideIcon>",
        );
        expect(recordingTagVisuals).not.toContain(
            "recordingTagIconComponents[",
        );
        expect(recordingTagVisuals).not.toContain(
            "recordingTagManagerIconComponents[",
        );
        for (const recordingTagChipToken of [
            "--sot-player-tag-chip-bg",
            "--sot-player-tag-chip-border",
            "--sot-player-tag-chip-fg",
        ]) {
            expect(recordingTagVisuals).not.toContain(recordingTagChipToken);
        }
        expect(recordingTagVisuals).not.toContain(
            "recordingTagChipVariablesClassName",
        );
        expect(recordingTagVisuals).not.toContain("recordingTagIconPaths");
        expect(recordingTagVisuals).not.toContain(
            ["recordingTagVisual", "ClassName("].join(""),
        );
        expect(recordingTagVisuals).not.toContain("<svg");
        expect(sharedRecordingTagChip).toContain(
            "data-sot-tag-color={tag.color}",
        );
        expect(sharedRecordingTagChip).toContain(
            "data-sot-tag-icon={tag.icon}",
        );
        expect(sharedRecordingTagChip).not.toContain('variant="outline"');
        expect(recordingTagVisuals).not.toContain("utag c-");
        expect(recordingTagVisuals).not.toContain("mergeUserTagClassName");
        expect(sotPlayerPrimitives).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(sotPlayerPrimitives).toContain(
            'data-sot-control="player-source-tag"',
        );
        expect(sotPlayerPrimitives).toContain(
            'data-sot-control="player-status"',
        );
        expect(sotPlayerPrimitives).toContain("<Badge");
        const sharedPlayerStatusBadge = extractOpeningElement(
            sotPlayerPrimitives,
            'data-sot-control="player-status"',
            "Badge",
        );
        const sharedPlayerSourceBadge = extractOpeningElement(
            sotPlayerPrimitives,
            'data-sot-control="player-source-tag"',
            "Badge",
        );
        const legacyPlayerSourceVariantUsage = `variant="${"player"}Source"`;

        expectSotPlayerSourcePrimitiveBindings(sotPlayerPrimitives);
        expect(sotPlayerPrimitives).not.toContain(
            "SOT_PLAYER_STATUS_BADGE_CLASS",
        );
        expect(sotPlayerPrimitives).toContain("const PLAYER_STATUS_VARIANT");
        expect(sotPlayerPrimitives).toContain(
            'React.ComponentProps<typeof Badge>["variant"]',
        );
        expect(sotPlayerPrimitives).not.toContain("PLAYER_STATUS_TONE_CLASS");
        expect(sotPlayerPrimitives).not.toContain(
            legacyPlayerSourceVariantUsage,
        );
        expect(sharedPlayerSourceBadge).toContain('variant="outline"');
        expect(sharedPlayerSourceBadge).toContain(
            "className={PLAYER_SOURCE_BADGE_CLASS}",
        );
        expect(sharedPlayerStatusBadge).toContain(
            "variant={PLAYER_STATUS_VARIANT[tone]}",
        );
        expect(sharedPlayerStatusBadge).toContain("className={className}");
        expect(sharedPlayerStatusBadge).toContain(
            'data-sot-control="player-status"',
        );
        expect(sharedPlayerStatusBadge).toContain("data-sot-tone={tone}");
        expect(sotPlayerPrimitives).toContain("className?: string;");
        expect(sotPlayerPrimitives).not.toContain('data-sot-part="status-dot"');
        expect(sotPlayerPrimitives).not.toContain(
            '"size-1.5 rounded-full bg-current"',
        );
        expect(sotPlayerPrimitives).not.toContain("animate-[bpulse");
        expect(sotPlayerPrimitives).toContain(
            '<span data-sot-part="status-label">{label}</span>',
        );
        expect(sotPlayerPrimitives).not.toContain(
            `variant="${"player"}Status"`,
        );
        expect(sotPlayerPrimitives).not.toContain('variant="source"');
        expect(sotPlayerPrimitives).not.toContain('variant="player-status"');
        expect(sotPlayerPrimitives).toContain(
            "const PLAYER_SOURCE_ICON_CLASS =",
        );
        expect(sotPlayerPrimitives).toContain("inline-flex size-4");
        expect(
            collectCssRuleBlocks(
                globals,
                '[data-sot-control="player-source-tag"][data-slot="badge"]',
            ),
        ).toEqual([]);
        expect(sotPlayerPrimitives).not.toContain("status-badge-ready");
        expect(sotPlayerPrimitives).not.toContain("_is-");
        const speakerProfiles = readSource(
            "features/settings/components/sections/speaker-profiles-panel.tsx",
        );
        const speakerProfileButtons =
            speakerProfiles.match(/<Button\b[\s\S]*?<\/Button>/g) ?? [];
        const findSpeakerProfileButton = (control: string) =>
            speakerProfileButtons.find((button) =>
                button.includes(`data-sot-control="${control}"`),
            ) ?? "";
        const speakerAvatarFallbacks =
            speakerProfiles.match(/<AvatarFallback\b[^>]*>/g) ?? [];
        const speakerStateBadges =
            speakerProfiles.match(/<Badge\b[^>]*>/g) ?? [];
        const speakerRowFields =
            speakerProfiles.match(
                /<Field(?!Content|Control|Description|Label|Title)\b[^>]*>/g,
            ) ?? [];
        const speakerProfilesPanelOpening = extractOpeningElement(
            speakerProfiles,
            'data-sot-panel="speaker-profiles"',
            "div",
        );
        const speakerProfilesLocalOpening = extractOpeningElement(
            speakerProfiles,
            'data-sot-panel="speaker-profiles-local"',
            "div",
        );
        const speakerVoiceprintsOpening = extractOpeningElement(
            speakerProfiles,
            'data-sot-panel="speaker-voiceprints"',
            "div",
        );
        const speakerStateBadgeOpenings = speakerStateBadges.filter(
            (stateBadge) =>
                stateBadge.includes('data-sot-badge="speaker-state"'),
        );
        const speakerStatePill =
            speakerProfiles.match(
                /function StatePill[\s\S]*?function PanelNotice/,
            )?.[0] ?? "";
        const speakerPanelNotice =
            speakerProfiles.match(
                /function PanelNotice[\s\S]*?export function SpeakerProfilesPanel/,
            )?.[0] ?? "";
        const speakerRowItemClass =
            speakerProfiles.match(
                /const speakerRowItemClassName\s*=\s*"[^"]*";/,
            )?.[0] ?? "";
        const speakerProfilesPanelClass = findStringConstInitializerContaining(
            speakerProfiles,
            ["speakerProfilesPanelClassName", "relative flex flex-col gap-2"],
        );
        const speakerProfileNameField = extractElementSlice(
            speakerProfiles,
            'data-sot-part="speaker-profile-row-meta"',
            "Field",
        );
        const speakerVoiceprintNameField = extractElementSlice(
            speakerProfiles,
            'data-sot-part="speaker-voiceprint-row-meta"',
            "Field",
        );
        const speakerProfileEmptyState = extractElementSlice(
            speakerProfiles,
            'data-sot-part="speaker-profiles-empty"',
            "Empty",
        );
        const speakerVoiceprintsEmptyState = extractElementSlice(
            speakerProfiles,
            'data-sot-part="speaker-voiceprints-empty"',
            "Empty",
        );
        const expectSpeakerFeatureOwnedSnippets = (
            label: string,
            snippets: readonly string[],
        ) => {
            for (const snippet of snippets) {
                expect(
                    speakerProfiles,
                    `${label} should keep ${snippet} in the speaker profiles feature owner`,
                ).toContain(snippet);
            }
        };
        expect(speakerProfiles).toContain(
            'import { Avatar, AvatarFallback } from "@/components/ui/avatar";',
        );
        expect(speakerProfiles).toMatch(
            /import\s*\{[\s\S]*Field,[\s\S]*FieldContent,[\s\S]*FieldControl,[\s\S]*FieldDescription,[\s\S]*FieldLabel,[\s\S]*FieldTitle[\s\S]*\}\s*from "@\/components\/ui\/field";/,
        );
        expect(speakerProfiles).not.toContain('from "@/components/ui/label";');
        expect(speakerProfiles).toContain('from "@/components/ui/empty";');
        for (const primitiveSource of [
            avatarPrimitive,
            badge,
            button,
            fieldPrimitive,
            emptyPrimitive,
        ]) {
            expectPrimitiveToExcludeBusinessTokens(
                primitiveSource,
                SPEAKER_PROFILE_PRIMITIVE_BUSINESS_TOKENS,
            );
        }
        expect(speakerProfiles).toContain("<Avatar");
        expect(speakerProfiles).toContain("<AvatarFallback");
        expect(speakerAvatarFallbacks).toHaveLength(2);
        expectSpeakerFeatureOwnedSnippets("speaker avatar fallback", [
            "bg-accent",
            "text-[11px]",
            "font-bold",
            "text-primary",
        ]);
        for (const fallback of speakerAvatarFallbacks) {
            expect(fallback).toContain("className=");
            expect(fallback).not.toContain('variant="speakerSettings"');
        }
        expect(speakerProfiles).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(speakerProfiles).toContain("<Badge");
        expect(speakerProfiles).toContain('data-sot-badge="speaker-state"');
        expect(speakerProfiles).toContain("data-sot-tone={tone}");
        expect(speakerStatePill).toContain("<Badge");
        expect(speakerStatePill).toMatch(
            /variant=\{(?:badgeVariant|speakerStateBadgeVariantByTone\[tone\])\}/,
        );
        expect(speakerStatePill).not.toContain("className=");
        expect(speakerStateBadgeOpenings).toHaveLength(1);
        for (const stateBadge of speakerStateBadgeOpenings) {
            expect(stateBadge).toMatch(
                /variant=\{(?:badgeVariant|speakerStateBadgeVariantByTone\[tone\])\}/,
            );
            expect(stateBadge).not.toContain("className=");
            expect(stateBadge).not.toContain('variant="speakerState"');
        }
        expectSpeakerFeatureOwnedSnippets("speaker settings rows", [
            "border-b border-border py-3",
        ]);
        expectSpeakerFeatureOwnedSnippets("speaker section groups", [
            "speakerProfilesPanelClassName",
            "relative flex flex-col gap-2",
            "speakerSectionGroupClassName",
            "relative mb-[22px]",
        ]);
        expect(speakerProfilesPanelClass).not.toMatch(/!mb-3\.5/);
        expectSpeakerFeatureOwnedSnippets("speaker row layout", [
            "speakerRowsListClassName",
            "m-0 flex list-none flex-col gap-1.5 p-0",
            "speakerRowItemClassName",
            "grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto_auto]",
            "speakerRowMetaClassName",
            "flex min-w-0 flex-col gap-0.5",
            "speakerRowSubClassName",
            "flex min-w-0 flex-wrap items-center gap-1.5",
        ]);
        expect(speakerRowItemClass).toContain(
            "grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto_auto]",
        );
        for (const forbiddenSpeakerLocalSkin of [
            "speakerStateBadgeClassName",
            "speakerSettingsBanner",
            "data-[sot-tone=",
            "var(--card-elevated",
            "var(--bg-elevated",
            "var(--bg-recessed",
            "alert-destructive-soft",
            "signal-info",
            "signal-danger",
            "border-[var(--card-elevated-border)]",
            "bg-[var(--bg-elevated)]",
            "hover:bg-[var(--bg-recessed)]",
            "text-[var(--fg-tertiary)]",
        ]) {
            expect(speakerProfiles).not.toContain(forbiddenSpeakerLocalSkin);
        }
        expect(speakerProfilesPanelOpening).toContain(
            "className={speakerProfilesPanelClassName}",
        );
        expect(speakerProfilesPanelOpening).toContain("data-sot-section-group");
        expect(speakerProfilesLocalOpening).toContain(
            "className={speakerSectionGroupClassName}",
        );
        expect(speakerProfilesLocalOpening).toContain("data-sot-section-group");
        expect(speakerVoiceprintsOpening).toContain(
            "className={speakerSectionGroupClassName}",
        );
        expect(speakerVoiceprintsOpening).toContain("data-sot-section-group");
        expect(
            speakerProfiles.match(
                /className=\{speakerSectionGroupClassName\}/g,
            ) ?? [],
        ).toHaveLength(2);
        expect(speakerRowFields.length).toBeGreaterThanOrEqual(3);
        for (const field of speakerRowFields) {
            expect(field).toContain("className=");
            expect(field).not.toContain('variant="speakerSettingsRow"');
        }
        expect(speakerProfiles).toContain("<FieldControl");
        for (const [field, control, disabledState] of [
            [
                speakerProfileNameField,
                "speaker-profile-name",
                "isProfileSaving",
            ],
            [
                speakerVoiceprintNameField,
                "speaker-voiceprint-name",
                "isVoiceprintSaving",
            ],
        ] as const) {
            expect(field).toContain("<Field");
            expect(field).toContain("<FieldLabel");
            expect(field).toContain("<FieldControl");
            expect(field).toContain("<Input");
            expect(field).toContain("<FieldDescription");
            expect(field).toContain(`data-sot-control="${control}"`);
            expect(field).toMatch(
                new RegExp(
                    `data-disabled=\\{\\s*${disabledState}\\s*\\?\\s*"true"\\s*:\\s*undefined\\s*\\}`,
                ),
            );
            expect(field).toContain(`disabled={${disabledState}}`);
            expect(field).not.toContain("<Label");
        }
        expect(speakerPanelNotice).toContain("<Alert");
        expect(speakerPanelNotice).toContain('density="comfortable"');
        expect(speakerPanelNotice).toContain('layout="default"');
        expect(speakerPanelNotice).toContain(
            'variant={tone === "danger" ? "destructiveSoft" : "default"}',
        );
        for (const speakerEmptyState of [
            speakerProfileEmptyState,
            speakerVoiceprintsEmptyState,
        ]) {
            expect(speakerEmptyState).toContain("<Empty");
            expect(speakerEmptyState).toContain('data-sot-state="empty"');
            expect(speakerEmptyState).toContain("<EmptyHeader>");
            expect(speakerEmptyState).toContain("<EmptyTitle");
            expect(speakerEmptyState).toContain("<EmptyDescription");
        }
        expect(speakerProfileEmptyState).toContain(
            'data-sot-panel="speaker-profiles-notice"',
        );
        expect(speakerProfileEmptyState).toContain(
            'data-sot-part="speaker-profiles-empty"',
        );
        expect(speakerProfileEmptyState).toContain(
            'data-sot-part="speaker-profiles-empty-title"',
        );
        expect(speakerProfileEmptyState).toContain(
            'data-sot-part="speaker-profiles-empty-description"',
        );
        expect(speakerVoiceprintsEmptyState).toContain(
            'data-sot-panel="speaker-voiceprints-notice"',
        );
        expect(speakerVoiceprintsEmptyState).toContain(
            'data-sot-part="speaker-voiceprints-empty"',
        );
        expect(speakerVoiceprintsEmptyState).toContain(
            'data-sot-part="speaker-voiceprints-empty-title"',
        );
        expect(speakerVoiceprintsEmptyState).toContain(
            'data-sot-part="speaker-voiceprints-empty-description"',
        );
        expect(speakerProfiles).not.toContain(
            '<PanelNotice panel="speaker-profiles-notice" state="empty"',
        );
        expect(speakerProfiles).not.toContain(
            'panel="speaker-voiceprints-notice"\n                        state="empty"',
        );
        expect(speakerProfiles).toContain('panel="speaker-profiles-notice"');
        expect(speakerProfiles).toContain('panel="speaker-voiceprints-notice"');
        expect(speakerProfiles).toContain('state="error"');
        expect(speakerProfiles).toContain('state="disabled"');
        expect(speakerProfiles).not.toContain('density="settingsBanner"');
        expect(speakerProfiles).not.toContain('"settingsBannerError"');
        expect(alertPrimitive).not.toContain("settingsBanner:");
        expect(alertPrimitive).not.toContain("settingsBannerError:");
        for (const control of [
            "speaker-profiles-refresh",
            "speaker-profile-create",
            "speaker-profiles-retry",
            "speaker-profile-save",
            "speaker-voiceprints-refresh",
            "speaker-voiceprints-retry",
            "speaker-voiceprint-rename",
        ]) {
            const opening = findSpeakerProfileButton(control);

            expect(opening).toContain(`data-sot-control="${control}"`);
            expect(opening).toContain('variant="outline"');
            expect(opening).toContain('size="sm"');
            expect(opening).not.toContain('variant="speakerSettingsAction"');
            expect(opening).not.toContain(
                'variant="speakerSettingsDangerAction"',
            );
            expect(opening).not.toContain('size="speakerSettingsAction"');
        }
        for (const control of [
            "speaker-profile-delete",
            "speaker-voiceprint-delete",
        ]) {
            const opening = findSpeakerProfileButton(control);

            expect(opening).toContain(`data-sot-control="${control}"`);
            expect(opening).toContain('variant="destructive"');
            expect(opening).toContain('size="sm"');
            expect(opening).not.toContain('variant="speakerSettingsAction"');
            expect(opening).not.toContain(
                'variant="speakerSettingsDangerAction"',
            );
            expect(opening).not.toContain('size="speakerSettingsAction"');
        }
        expect(speakerProfiles).not.toContain("sot-speaker-pill");
        expect(globals).not.toContain(
            '[data-sot-part="speaker-profile-avatar"] [data-slot="avatar-fallback"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="speaker-voiceprint-avatar"] [data-slot="avatar-fallback"]',
        );
        expect(
            collectExactCssRuleBlocks(globals, "[data-sot-section-group]"),
        ).toEqual([]);
        for (const source of [player, tagManager, sourceReport]) {
            expect(source).not.toMatch(/\bbtn\s+ghost\s+btn-sm\b/);
            expect(source).not.toMatch(/\bbtn\s+primary\s+btn-sm\b/);
            expect(source).not.toMatch(/\bbtn\s+danger\s+btn-sm\b/);
            expect(source).not.toContain('className="field-input"');
        }
        for (const source of [
            settings,
            detail,
            player,
            tagManager,
            speakerReview,
        ]) {
            expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
        }
    });
});
