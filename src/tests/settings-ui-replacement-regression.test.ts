import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

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

function expectOnlyAllowedGlobalSlotSelectors(globals: string) {
    const slotSelectors = globals
        .split("\n")
        .filter((line) => line.includes('[data-slot="'));

    expect(slotSelectors).toEqual([]);
}

function readCssBlock(source: string, marker: string) {
    const markerIndex = source.indexOf(marker);
    expect(markerIndex).toBeGreaterThanOrEqual(0);

    const openBraceIndex = source.indexOf("{", markerIndex);
    expect(openBraceIndex).toBeGreaterThanOrEqual(0);

    let depth = 0;
    for (let index = openBraceIndex; index < source.length; index += 1) {
        const character = source[index];

        if (character === "{") {
            depth += 1;
        }

        if (character === "}") {
            depth -= 1;
        }

        if (depth === 0) {
            return source.slice(openBraceIndex + 1, index);
        }
    }

    throw new Error(`Missing closing brace for ${marker}`);
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
                declarations: readCssBlock(
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

function collectElementSlices(source: string, marker: string, tagName: string) {
    const slices: string[] = [];
    let searchFrom = 0;

    while (searchFrom < source.length) {
        const markerIndex = source.indexOf(marker, searchFrom);
        if (markerIndex < 0) {
            break;
        }

        const startIndex = source.lastIndexOf(`<${tagName}`, markerIndex);
        expect(startIndex).toBeGreaterThanOrEqual(0);

        const endMarker = `</${tagName}>`;
        const endIndex = source.indexOf(endMarker, markerIndex);
        expect(endIndex).toBeGreaterThanOrEqual(0);

        slices.push(source.slice(startIndex, endIndex + endMarker.length));
        searchFrom = endIndex + endMarker.length;
    }

    return slices;
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

function expectNoDataSotDrivenTailwindSelectors(source: string) {
    const selectors =
        source.match(
            /(?:data-\[sot-[^\s"`]+:[^\s"`]+|\[[^\]\s"`]*data-sot[^\]\s"`]*\]:[^\s"`]+)/g,
        ) ?? [];

    expect(selectors).toEqual([]);
}

const OLD_UI_RE = /uikit-|glass-surface|glass-control/;

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

const TARGET_SETTINGS_MIGRATION_PATHS = [
    "features/settings/components/settings-content.tsx",
    "features/settings/components/sections/data-sources-section.tsx",
    "features/settings/components/sections/voscript-section.tsx",
    "features/settings/components/setting-field-control.tsx",
    "features/settings/components/settings-skeletons.tsx",
    "features/data-sources/data-source-field-control.tsx",
    "features/settings/components/sections/speaker-profiles-panel.tsx",
] as const;

const LEGACY_SETTINGS_FIELD_PATTERNS: Array<[RegExp, string]> = [
    [/\bfield-row\b/, "field-row"],
    [/\bfield-name\b/, "field-name"],
    [/\bfield-desc\b/, "field-desc"],
    [/\bsm-row-label\b/, "sm-row-label"],
    [/\bsm-row-ctrl\b/, "sm-row-ctrl"],
    [/\bsm-l-t\b/, "sm-l-t"],
    [/\bsm-l-h\b/, "sm-l-h"],
    [/\bsm-input\b/, "sm-input"],
    [/\bsm-field-msg\b/, "sm-field-msg"],
    [/className=["']seg["']/, 'className="seg"'],
    [/\b_is-[\w-]+/, "_is-*"],
];

const LEGACY_SETTINGS_SHELL_CLASSNAMES = [
    'className="settings"',
    'className="settings-head"',
    'className="settings-body"',
    'className="settings-rail"',
    'className="settings-user settings-user-local"',
    'className="local-badge"',
    'className="su-name"',
    'className="su-mail"',
    'className="sr-group"',
    'className="sr-group-label"',
] as const;

const LEGACY_SETTINGS_SHELL_CSS_SELECTORS = [
    [/\.settings(?![-\w])/, ".settings"],
    [/(^|\n|,)\s*\.settings-head\b/, ".settings-head"],
    [/(^|\n|,)\s*\.settings-body\b/, ".settings-body"],
    [/(^|\n|,)\s*\.settings-rail\b/, ".settings-rail"],
    [/(^|\n|,)\s*\.settings-main(?![\w-])/, ".settings-main"],
    [/(^|\n|,)\s*\.settings-main\.three-pane\b/, ".settings-main.three-pane"],
    [/(^|\n|,)\s*\.settings-main\[hidden\]/, ".settings-main[hidden]"],
    [
        /(^|\n|,)\s*\.settings-main\.three-pane\[hidden\]/,
        ".settings-main.three-pane[hidden]",
    ],
    [/(^|\n|,)\s*\.settings-user\b/, ".settings-user"],
    [/(^|\n|,)\s*\.settings-user-local\b/, ".settings-user-local"],
    [/(^|\n|,)\s*\.local-badge\b/, ".local-badge"],
    [/(^|\n|,)\s*\.su-name\b/, ".su-name"],
    [/(^|\n|,)\s*\.su-mail\b/, ".su-mail"],
    [/(^|\n|,)\s*\.sr-group\b/, ".sr-group"],
    [/(^|\n|,)\s*\.sr-group-label\b/, ".sr-group-label"],
] as const;

const SETTINGS_PUBLIC_RAW_COPY_BLOCKERS = [
    "HAR",
    "Cookie",
    "payload",
    "Bearer",
    "user_access_token",
    "X-Session-Id",
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

const FORBIDDEN_CONFIRM_BUTTON_PRIMITIVE_REPAINT_DECLARATION =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|letter-spacing|line-height|padding|transition)\s*:|\b(?:color-mix|oklch|linear-gradient)\(/m;

const SETTINGS_SOURCE_PROVIDER_GLOBAL_STYLE_TARGETS = [
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
] as const;

const PROVIDER_DETAIL_ACTION_GLOBAL_SELECTOR_FRAGMENTS = [
    '[data-sot-panel="source-actions"]',
    '[data-sot-part="source-action-status"]',
    '[data-sot-control="source-test"]',
    '[data-sot-control="source-save"]',
] as const;

const PROVIDER_DETAIL_ACTION_GLOBAL_DECLARATION_RE =
    /^\s*(?:display|align-items|justify-content|gap|margin(?:-[\w-]+)?|flex(?:-[\w-]+)?|pointer-events|position|z-index|inset|padding(?:-[\w-]+)?|width|height)\s*:/m;

const AUTH_FIELD_PRIMITIVE_FORBIDDEN_TOKENS = [
    "authAction",
    "authCompact",
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

const REMOVED_SETTINGS_MAIN_FUNCTIONAL_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-panel="settings-scroll-body"][hidden]',
    '[data-sot-panel="settings-scroll-body"][data-sot-availability="unavailable"]\n    [data-sot-panel="voscript-unavailable-banner"]',
] as const;

const REMOVED_SETTINGS_MAIN_VISUAL_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-panel="settings-scroll-body"]',
    '[data-sot-panel="settings-scroll-body"][data-sot-layout="three-pane"]',
] as const;

const REMOVED_SETTINGS_DUPLICATE_DISPLAY_GLOBAL_SELECTORS = [
    '[data-sot-part="settings-user-summary"]',
    '[data-sot-part="settings-user-avatar"]',
    '[data-sot-panel="settings-rail"] [data-sot-list="settings-nav-group"]',
    '[data-sot-panel="settings-scroll-body"] [data-sot-banner]',
    '[data-sot-panel="settings-scroll-body"] [data-sot-banner-icon]',
    '[data-sot-panel="settings-scroll-body"] [data-sot-key-status]',
    '[data-sot-panel="settings-scroll-body"] [data-sot-shortcuts]',
    '[data-sot-panel="settings-scroll-body"] [data-sot-shortcuts] > div',
] as const;

const REMOVED_SETTINGS_TITLE_DIVIDER_VISUAL_DATA_SOT_CSS_SELECTORS = [
    "[data-sot-title]",
    "[data-sot-section-divider]",
    '[data-theme="dark"] [data-sot-section-divider]',
] as const;

const REMOVED_SETTINGS_SAVE_ACTION_GLOBAL_SELECTORS = [
    '[data-sot-panel="settings-scroll-body"]\n    [data-sot-panel="settings-save-actions"]',
    '[data-sot-panel="settings-scroll-body"] [data-sot-part="settings-save-status"]',
    '[data-sot-panel="settings-scroll-body"]\n    [data-sot-panel="settings-save-actions"][data-sot-state="idle"]',
    '[data-sot-panel="settings-scroll-body"]\n    [data-sot-panel="settings-save-actions"][data-sot-state="saving"]',
    '[data-sot-panel="settings-save-actions"] {',
    '[data-sot-panel="settings-save-actions"] [data-sot-control="settings-save"]',
    '[data-sot-panel="settings-save-actions"] [data-sot-control="voscript-test"]',
    '[data-sot-panel="settings-save-actions"] [data-sot-part="settings-save-status"]',
] as const;

const REMOVED_SETTINGS_SKELETON_GLOBAL_SELECTORS = [
    '[data-sot-panel="settings-card-skeleton"]',
    '[data-sot-panel="settings-section-skeleton"]',
    '[data-sot-panel="settings-list-skeleton"]',
] as const;

const REMOVED_SETTINGS_SHORTCUTS_KEY_STATUS_VISUAL_SELECTORS = [
    "[data-sot-shortcuts]",
    "[data-sot-shortcuts] > div",
    "[data-sot-shortcuts] kbd",
    "[data-sot-key-status]",
] as const;

const LEGACY_MODAL_SHELL_CSS_SELECTOR_RE =
    /(^|[,\s>{])\.(?:scrim|modal|modal-head|modal-icon|modal-title|modal-desc|modal-body|modal-foot)(?![\w-])/m;

const REMOVED_SETTINGS_SHELL_GLOBAL_SELECTORS = [
    '[data-sot-overlay="settings-shell"]',
    '[data-sot-overlay="settings-shell"][data-state="open"]',
    '[data-sot-overlay="settings-shell"][data-state="closed"]',
    '[data-sot-surface="settings-shell"]',
    '[data-sot-surface="settings-shell"][data-state="closed"]',
] as const;

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

const REMOVED_MODAL_SHELL_DEAD_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-part="dialog-icon"]',
] as const;

const DIALOG_SLOT_GLOBAL_SELECTORS = [
    '[data-slot="dialog-header"]',
    '[data-slot="dialog-title"]',
    '[data-slot="dialog-description"]',
    '[data-slot="dialog-footer"]',
] as const;

function readProductCss(source: string) {
    return source;
}

function expectNoLegacySettingsFieldPatterns(
    sources: Partial<
        Record<(typeof TARGET_SETTINGS_MIGRATION_PATHS)[number], string>
    >,
) {
    for (const filePath of TARGET_SETTINGS_MIGRATION_PATHS) {
        const source = sources[filePath];

        if (!source) {
            continue;
        }

        for (const [pattern, label] of LEGACY_SETTINGS_FIELD_PATTERNS) {
            expect(
                source,
                `${filePath} should not use legacy ${label}`,
            ).not.toMatch(pattern);
        }
    }
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

function collectSourceProviderGlobalStyleBlocks(
    source: string,
    target: (typeof SETTINGS_SOURCE_PROVIDER_GLOBAL_STYLE_TARGETS)[number],
) {
    return collectCssRuleBlocks(source, target.selectorFragment);
}

function collectSourceActionGlobalBusinessBlocks(source: string) {
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

describe("settings SOT interaction regressions", () => {
    it("keeps the settings dialog on Radix semantics with local scrolling and busy guards", () => {
        const dialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const workstation = readSource("features/dashboard/workstation.tsx");
        const i18n = readSource("lib/i18n.ts");
        const baseDialog = readSource("components/ui/dialog.tsx");
        const globals = readSource("app/globals.css");
        for (const legacyClassName of LEGACY_SETTINGS_SHELL_CLASSNAMES) {
            expect(dialog).not.toContain(legacyClassName);
        }
        expectNoDataSotDrivenTailwindSelectors(dialog);
        for (const selector of [
            ...REMOVED_SETTINGS_NAV_GLOBAL_REPAINT_SELECTORS,
            ...REMOVED_SETTINGS_DEAD_TENANT_GLOBAL_SELECTORS,
        ]) {
            expect(globals).not.toContain(selector);
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        const headerDisplaySetup = dialog.match(
            /const settingsUserName[\s\S]*?const isSettingsBusy/,
        )?.[0];
        const [settingsCloseButton] = collectElementSlices(
            dialog,
            'aria-label={t("settingsDialog.close")}',
            "Button",
        );
        const [settingsNavButton] = collectElementSlices(
            dialog,
            "aria-current={",
            "Button",
        );
        const settingsNavButtonClass =
            dialog.match(
                /const SETTINGS_NAV_BUTTON_CLASS\s*=\s*"[^"]*";/,
            )?.[0] ?? "";

        expect(dialog).toContain("<Dialog");
        expect(dialog).toContain("<DialogContent");
        expect(dialog).toContain("<header");
        expect(dialog).toContain("<nav");
        expect(dialog).toContain("<fieldset");
        expect(dialog).toContain("<legend");
        expect(dialog).toContain("DialogTitle");
        expect(dialog).toContain("DialogDescription");
        expect(dialog).toContain('className="sr-only"');
        expect(settingsCloseButton).toContain('variant="ghost"');
        expect(settingsCloseButton).toContain("SETTINGS_CLOSE_BUTTON_CLASS");
        expect(settingsCloseButton).toContain('size="icon-sm"');
        expect(settingsCloseButton).toContain("disabled={isSettingsBusy}");
        expect(settingsCloseButton).toContain('type="button"');
        expect(settingsCloseButton).toMatch(
            /className=\{\s*[A-Za-z0-9_]+\s*\}/,
        );
        expect(settingsCloseButton).toMatch(
            /<X\s+data-icon="inline-start"\s+aria-hidden="true"\s*\/>/,
        );
        expect(settingsNavButton).toMatch(
            /variant=\{\s*isActive\s*\?\s*"outline"\s*:\s*"ghost"\s*\}/,
        );
        expect(dialog).toContain("const SETTINGS_NAV_BUTTON_CLASS =");
        expect(settingsNavButton).toContain("SETTINGS_NAV_BUTTON_CLASS");
        expect(settingsNavButton).toContain('className="min-w-0 truncate"');
        expect(settingsNavButton).toContain("disabled={isSettingsBusy}");
        expect(settingsNavButton).toContain('type="button"');
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
        expect(dialog).toContain("SettingsBusyProvider");
        expect(dialog).toContain("isSettingsBusy");
        expect(dialog).toContain("const navButtonRefs = React.useRef");
        expect(dialog).toContain("const focusSettingsNavIndex =");
        expect(dialog).toContain("normalizeRovingIndex(index)");
        expect(dialog).toContain("const handleNavKeyDown =");
        for (const key of [
            "ArrowDown",
            "ArrowRight",
            "ArrowUp",
            "ArrowLeft",
            "Home",
            "End",
        ]) {
            expect(dialog).toContain(`case "${key}":`);
        }
        expect(settingsNavButton).toContain("handleNavKeyDown(");
        expect(settingsNavButton).toContain("onFocus={() =>");
        expect(settingsNavButton).toContain("tabIndex={");
        expect(settingsNavButton).toContain("aria-current={");
        expect(settingsNavButton).toMatch(/rovingIndex ===\s*itemIndex/);
        expect(settingsNavButton).toMatch(
            /applyActiveSettingsSection\(\s*item\.id,?\s*\)/,
        );
        expect(settingsNavButton).not.toContain("setActiveSection(item.id)");
        expect(dialog).toContain("focus({ preventScroll: true })");
        expect(dialog).toContain("onOpenAutoFocus={handleOpenAutoFocus}");
        expect(dialog).toContain("onInteractOutside");
        expect(dialog).toContain("onEscapeKeyDown");
        expect(dialog).toContain("normalizeSettingsSection");
        expect(dialog).toContain("DialogTrigger");
        expect(dialog).toContain("<DialogTrigger asChild>");
        expect(dialog).toContain("<DialogClose asChild>");
        expect(workstation).toContain("trigger={");
        expect(workstation).toContain("ref={settingsTriggerRef}");
        expect(workstation).not.toContain(
            "returnFocusRef={settingsTriggerRef}",
        );
        expect(dialog).toContain('aria-label={t("settingsDialog.title")}');
        expect(dialog).not.toContain("DialogTitle hidden");
        expect(dialog).not.toContain("DialogDescription hidden");
        expect(dialog).not.toContain("legacySectionAliases");
        expect(dialog).not.toContain('display: "appearance"');
        expect(dialog).not.toContain('sync: "misc"');
        expect(dialog).not.toContain('playback: "misc"');
        expect(dialog).toContain("aria-busy={isSettingsBusy}");
        expect(dialog).toContain("aria-current={");
        expect(dialog).toContain('aria-label={t("settingsDialog.close")}');
        expect(headerDisplaySetup).toContain(
            't("settingsDialog.localDeployment")',
        );
        expect(headerDisplaySetup).toContain(
            't("settingsDialog.singleUserSelfHosted")',
        );
        expect(headerDisplaySetup).not.toContain("props.user");
        expect(dialog).not.toContain("user?.email?.trim()");
        expect(dialog).not.toContain("user?.name?.trim()");
        expect(i18n).toContain('localDeployment: "本地部署"');
        expect(i18n).toContain(
            'singleUserSelfHosted: "单租户 · self-hosted · 无登录账号"',
        );
        expect(dialog).not.toContain('aria-label="Close"');
        expect(dialog).not.toContain("SidebarProvider");
        expect(dialog).not.toContain("<Sidebar");
        expect(dialog).not.toContain("<Breadcrumb");
        expect(dialog).not.toMatch(OLD_UI_RE);

        expect(baseDialog).toContain(
            'import * as DialogPrimitive from "@radix-ui/react-dialog";',
        );
        for (const primitive of [
            "Root",
            "Trigger",
            "Portal",
            "Overlay",
            "Content",
            "Title",
            "Description",
            "Close",
        ]) {
            expect(baseDialog).toContain(`DialogPrimitive.${primitive}`);
        }
        expect(baseDialog).toContain("showCloseButton");
        expect(baseDialog).not.toContain("DialogContext");
        expect(baseDialog).not.toContain('className="scrim"');
        expect(dialog).not.toContain("overlayProps");
        expect(dialog).not.toContain("const SETTINGS_OVERLAY_CLASS =");
        expect(dialog).not.toContain("className: SETTINGS_OVERLAY_CLASS");
        expect(dialog).not.toContain("overlayClassName");
        expect(dialog).not.toContain("bg-[var(--modal-scrim-bg)]");
        expect(dialog).not.toContain("backdrop-blur");
        expect(dialog).not.toContain('"--tw-enter-scale"');
        expect(dialog).not.toContain('"--tw-exit-scale"');
        const settingsShellSurfaceClass = findStringConstInitializerContaining(
            dialog,
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
        expect(settingsShellSurfaceClass).not.toContain("!");
        expect(settingsShellSurfaceClass).not.toContain("var(--");
        expect(settingsShellSurfaceClass).not.toContain("shadow-");
        expect(settingsShellSurfaceClass).not.toContain("[box-shadow");
        findStringConstInitializerContaining(dialog, [
            "const SETTINGS_SHELL_SURFACE_CLASS =",
            "max-w-[calc(100vw_-_40px)]",
            "sm:max-w-[min(920px,calc(100vw_-_40px))]",
        ]);
        for (const [pattern, label] of LEGACY_SETTINGS_SHELL_CSS_SELECTORS) {
            expect(globals, `globals should not use ${label}`).not.toMatch(
                pattern,
            );
        }
    });

    it("keeps modal and scrim product CSS on dialog/data-sot selectors only", () => {
        const globals = readSource("app/globals.css");
        const confirmDialog = readSource("components/ui/confirm-dialog.tsx");
        const layout = readSource("app/layout.tsx");
        const productCss = readProductCss(globals);

        expect(productCss).not.toMatch(LEGACY_MODAL_SHELL_CSS_SELECTOR_RE);
        for (const selector of REMOVED_SETTINGS_SHELL_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(productCss, selector)).toEqual([]);
        }
        for (const selector of REMOVED_MODAL_SHELL_DEAD_DATA_SOT_CSS_SELECTORS) {
            expect(productCss).not.toContain(selector);
        }
        for (const selector of DIALOG_SLOT_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of MIGRATED_CONFIRM_DIALOG_GLOBAL_SELECTORS) {
            expect(collectCssRuleBlocks(productCss, selector)).toEqual([]);
        }
        const confirmFooterButtonRules = collectCssRuleBlocks(
            productCss,
            '[data-sot-part="confirm-foot"]',
        ).filter(({ prelude }) => prelude.includes('[data-slot="button"]'));
        expect(confirmFooterButtonRules).toEqual([]);
        const destructiveButtonRules = collectCssRuleBlocks(
            productCss,
            '[data-slot="button"][data-variant="destructive"]',
        );
        for (const block of destructiveButtonRules) {
            expect(block.declarations).not.toMatch(
                FORBIDDEN_CONFIRM_BUTTON_PRIMITIVE_REPAINT_DECLARATION,
            );
        }
        expect(confirmDialog).toContain("ConfirmDialogSlotProps");
        for (const snippet of CONFIRM_DIALOG_PRIMITIVE_RESIDUAL_SNIPPETS) {
            expect(confirmDialog).not.toContain(snippet);
        }
        expect(confirmDialog).toContain(
            'const CONFIRM_DIALOG_CONTENT_CLASS = "sm:max-w-[460px]";',
        );
        expect(confirmDialog).toContain(
            'const CONFIRM_DIALOG_BODY_CLASS = "flex flex-col gap-3";',
        );
        expect(confirmDialog).toContain("overlayProps={overlaySlotProps}");
        expect(confirmDialog).toContain(
            "portalWrapperProps={portalWrapperSlotProps}",
        );
        expect(globals).not.toContain("--confirm-dialog-warning-bg:");
        expect(globals).not.toContain("--confirm-dialog-warning-border:");
        expect(confirmDialog).not.toContain('data-sot-part="confirm-foot"');
        expect(layout).not.toContain('"data-sot-part": "confirm-foot"');
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
        expect(confirmDialog).toContain(
            'confirmVariant?: "default" | "destructive"',
        );
        expect(confirmDialog).toContain("variant={confirmButtonVariant}");
        expect(confirmDialog).toContain('variant="outline"');
        expect(confirmDialog).toContain('size="sm"');
        expectNoComponentLibraryShowcaseGlobals(globals);
    });

    it("keeps settings selects on the shared Radix shadcn wrapper", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const sharedSelect = readSource("components/ui/select.tsx");
        const selectControl =
            content.match(
                /function SelectControl[\s\S]*?function SegmentControl/,
            )?.[0] ?? "";

        expect(content).toContain(
            'import { Select } from "@/components/ui/select";',
        );
        expect(selectControl).toContain("<Select");
        expect(selectControl).toContain("onValueChange={onChange}");
        expect(selectControl).toContain("options={options.map");
        expect(selectControl).toContain("value={String(value)}");

        expect(sharedSelect).toContain(
            'import * as SelectPrimitive from "@radix-ui/react-select";',
        );
        expect(sharedSelect).toContain("function SelectTrigger");
        expect(sharedSelect).toContain("function SelectContent");
        expect(sharedSelect).toContain("function SelectItem");
        expect(sharedSelect).toContain('data-slot="select-trigger"');
        expect(sharedSelect).toContain('data-slot="select-content"');
        expect(sharedSelect).toContain('data-slot="select-item"');
        expect(sharedSelect).toContain(
            'const EMPTY_OPTION_VALUE = "__select_empty_option_value__";',
        );
        expect(sharedSelect).toContain(
            'return value === "" ? EMPTY_OPTION_VALUE : value;',
        );
        expect(sharedSelect).toContain(
            'return value === EMPTY_OPTION_VALUE ? "" : value;',
        );
        expect(sharedSelect).toContain(
            "const externalValue = fromRadixValue(nextValue);",
        );
        expect(sharedSelect).toContain("onValueChange?.(externalValue);");
        const productDisplayName = ["Better", "AINote"].join("");
        const productPackageName = ["better", "ainote"].join("");
        const previousEmptyValueSentinel = [
            "__",
            productPackageName,
            "_empty_select_value__",
        ].join("");
        expect(sharedSelect).not.toMatch(
            new RegExp(
                [
                    productDisplayName,
                    productPackageName,
                    previousEmptyValueSentinel,
                ].join("|"),
            ),
        );
        expect(sharedSelect).not.toContain("<select");
        expect(sharedSelect).not.toContain("<option");
    });

    it("keeps settings main product CSS on data-sot selectors only", () => {
        const globals = readSource("app/globals.css");
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const dataSources = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );

        for (const [pattern, label] of LEGACY_SETTINGS_SHELL_CSS_SELECTORS) {
            expect(globals, `globals should not use ${label}`).not.toMatch(
                pattern,
            );
        }
        for (const selector of REMOVED_SETTINGS_MAIN_FUNCTIONAL_DATA_SOT_CSS_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of REMOVED_SETTINGS_MAIN_VISUAL_DATA_SOT_CSS_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(
            collectExactCssRuleBlocks(globals, "[data-sot-section-group]"),
        ).toEqual([]);
        for (const selector of REMOVED_SETTINGS_DUPLICATE_DISPLAY_GLOBAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        findStringConstInitializerContaining(content, [
            "const SETTINGS_SCROLL_BODY_CLASS =",
            "min-h-0",
            "overflow-y-auto",
            "px-[26px]",
            "py-[22px]",
            "[overscroll-behavior:contain]",
        ]);
        findStringConstInitializerContaining(dataSources, [
            "const SETTINGS_THREE_PANE_SCROLL_BODY_CLASS =",
            "grid",
            "min-h-0",
            "grid-cols-[280px_1fr]",
            "overflow-hidden",
            "p-0",
        ]);
        findStringConstInitializerContaining(content, [
            "const SETTINGS_SECTION_GROUP_CLASS =",
            "relative",
            "mb-[22px]",
        ]);
        for (const selector of REMOVED_SETTINGS_SAVE_ACTION_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(collectSourceActionGlobalBusinessBlocks(globals)).toEqual([]);
        expectOnlyAllowedGlobalSlotSelectors(globals);
    });

    it("keeps migrated settings fields on shadcn Field, Slider, and Skeleton primitives", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const dataSources = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const voscriptSection = readSource(
            "features/settings/components/sections/voscript-section.tsx",
        );
        const settingFieldControl = readSource(
            "features/settings/components/setting-field-control.tsx",
        );
        const settingsSkeletons = readSource(
            "features/settings/components/settings-skeletons.tsx",
        );
        const dataSourceFieldControl = readSource(
            "features/data-sources/data-source-field-control.tsx",
        );
        const speakerProfilesPanel = readSource(
            "features/settings/components/sections/speaker-profiles-panel.tsx",
        );
        const fieldPrimitive = readSource("components/ui/field.tsx");
        const sliderPrimitive = readSource("components/ui/slider.tsx");
        const playbackSettingsRows =
            content.match(
                /function PlaybackSettingsRows[\s\S]*?function MiscSettingsPanel/,
            )?.[0] ?? "";

        expectNoLegacySettingsFieldPatterns({
            "features/settings/components/settings-content.tsx": content,
            "features/settings/components/sections/data-sources-section.tsx":
                dataSources,
            "features/settings/components/sections/voscript-section.tsx":
                voscriptSection,
            "features/settings/components/setting-field-control.tsx":
                settingFieldControl,
            "features/settings/components/settings-skeletons.tsx":
                settingsSkeletons,
            "features/data-sources/data-source-field-control.tsx":
                dataSourceFieldControl,
            "features/settings/components/sections/speaker-profiles-panel.tsx":
                speakerProfilesPanel,
        });

        expect(content).toMatch(
            /import\s*\{[\s\S]*Field,[\s\S]*FieldContent,[\s\S]*FieldDescription,[\s\S]*FieldError,[\s\S]*FieldTitle[\s\S]*\}\s*from "@\/components\/ui\/field";/,
        );
        expect(dataSources).toMatch(
            /import\s*\{[\s\S]*Field,[\s\S]*FieldContent,[\s\S]*FieldControl,[\s\S]*FieldDescription,[\s\S]*FieldGroup,[\s\S]*FieldLabel,[\s\S]*FieldTitle[\s\S]*\}\s*from "@\/components\/ui\/field";/,
        );
        expect(settingFieldControl).toContain('from "@/components/ui/field";');
        expect(dataSourceFieldControl).toContain(
            'from "@/components/ui/field";',
        );
        expect(settingsSkeletons).toContain(
            'import { Field, FieldContent } from "@/components/ui/field";',
        );
        expect(settingsSkeletons).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );

        for (const slot of [
            "field",
            "field-group",
            "field-content",
            "field-label",
            "field-description",
            "field-error",
        ]) {
            expect(fieldPrimitive).toContain(`data-slot="${slot}"`);
        }

        expect(content).toContain(
            'import { Slider } from "@/components/ui/slider";',
        );
        expect(playbackSettingsRows).toContain("<Slider");
        expect(playbackSettingsRows).toContain('id="playback-volume"');
        expect(playbackSettingsRows).toContain("value={[draft.defaultVolume]}");
        expect(playbackSettingsRows).toContain("onValueChange={(values) =>");
        for (const slot of [
            "slider",
            "slider-track",
            "slider-range",
            "slider-thumb",
        ]) {
            expect(sliderPrimitive).toContain(`data-slot="${slot}"`);
        }
    });

    it("uses the monitor glyph for the local deployment header badge", () => {
        const dialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const localBadge = dialog.match(
            /<span[\s\S]*?aria-hidden="true"[\s\S]*?<\/span>/,
        )?.[0];

        expect(dialog).toContain("Monitor");
        expect(dialog).not.toContain("function getSettingsUserInitial");
        expect(dialog).not.toContain("settingsUserInitial");
        expect(localBadge).toContain('aria-hidden="true"');
        expect(localBadge).toContain("<Monitor");
        const avatarClass = findStringConstInitializerContaining(dialog, [
            "const SETTINGS_USER_AVATAR_CLASS =",
            "grid",
            "size-9",
            "place-items-center",
            "text-muted-foreground",
        ]);
        expect(avatarClass).not.toContain("[&_svg");
        expect(avatarClass).not.toContain("svg:not");
        expect(avatarClass).not.toContain("size-4");
        expect(localBadge).not.toContain("{settingsUserName}");
        expect(localBadge).not.toContain("getSettingsUserInitial");
        expect(localBadge).not.toContain("settingsUserInitial");
        expect(dialog).not.toContain("playwright-admin@example.com");
        expect(dialog).not.toContain("Playwright Admin");
        expect(dialog).not.toContain("test@example.com");
        expect(dialog).not.toContain("Test User");
    });

    it("keeps the settings rail visible on mobile without a section selector", () => {
        const dialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const globals = readSource("app/globals.css");

        expect(dialog).not.toContain(
            'wrapperClassName="settings-section-select"',
        );
        expect(dialog).not.toContain(
            'data-sot-control="settings-section-selector"',
        );
        expect(globals).not.toContain(".settings-section-select");
        expect(dialog).toContain("className={SETTINGS_USER_SUMMARY_CLASS}");
        expect(dialog).toContain("<Monitor");
        expect(dialog).toContain("{settingsUserSubtitle}");

        const shellSurfaceClass = findStringConstInitializerContaining(dialog, [
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
        ]);
        expect(shellSurfaceClass).not.toContain("rounded-[");
        expect(shellSurfaceClass).not.toContain("z-[");
        expect(shellSurfaceClass).not.toContain("data-[state=closed]");
        expect(shellSurfaceClass).not.toContain("!");
        expect(shellSurfaceClass).not.toContain("var(--");
        findStringConstInitializerContaining(dialog, [
            "const SETTINGS_HEADER_CLASS =",
            "flex",
            "flex-none",
            "items-center",
            "max-[720px]:flex-wrap",
            "max-[720px]:items-start",
            "max-[720px]:gap-3",
        ]);
        findStringConstInitializerContaining(dialog, [
            "const SETTINGS_USER_SUMMARY_CLASS =",
            "flex",
            "min-w-0",
            "flex-1",
            "items-center",
            "gap-3",
            "max-[720px]:basis-[calc(100%_-_42px)]",
        ]);
        findStringConstInitializerContaining(dialog, [
            "const SETTINGS_USER_AVATAR_CLASS =",
            "grid",
            "size-9",
            "place-items-center",
        ]);
        findStringConstInitializerContaining(dialog, [
            "const SETTINGS_USER_SUMMARY_TEXT_CLASS =",
            "min-w-0",
        ]);
        findStringConstInitializerContaining(dialog, [
            "const SETTINGS_USER_NAME_CLASS =",
            "m-0",
            "font-sans",
            "text-sm",
            "max-[720px]:truncate",
        ]);
        findStringConstInitializerContaining(dialog, [
            "const SETTINGS_USER_SUBTITLE_CLASS =",
            "font-mono",
            "text-xs",
            "max-[720px]:truncate",
        ]);
        findStringConstInitializerContaining(dialog, [
            "const SETTINGS_BODY_CLASS =",
            "grid",
            "min-h-0",
            "flex-1",
            "grid-cols-[200px_minmax(0,1fr)]",
        ]);
        findStringConstInitializerContaining(dialog, [
            "const SETTINGS_RAIL_CLASS =",
            "flex",
            "min-h-0",
            "flex-col",
            "gap-[2px]",
            "overflow-y-auto",
            "bg-muted/50",
            "[overscroll-behavior:contain]",
        ]);
        findStringConstInitializerContaining(dialog, [
            "const SETTINGS_NAV_GROUP_CLASS =",
            "flex",
            "flex-col",
            "gap-[2px]",
        ]);

        for (const selector of [
            '[data-sot-panel="settings-header"]',
            '[data-sot-panel="settings-body"]',
            '[data-sot-panel="settings-rail"]',
            '[data-sot-part="settings-user-summary"] > div',
            '[data-sot-part="settings-user-name"]',
            '[data-sot-part="settings-user-subtitle"]',
        ]) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
    });

    it("uses the DialogContent base shadow without settings shell overrides", () => {
        const dialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const dialogPrimitive = readSource("components/ui/dialog.tsx");
        const shellSurfaceClass = findStringConstInitializerContaining(dialog, [
            "const SETTINGS_SHELL_SURFACE_CLASS =",
            "box-border",
            "p-0",
        ]);

        expect(dialogPrimitive).toContain("shadow-lg");
        expect(shellSurfaceClass).not.toContain("shadow-");
        expect(shellSurfaceClass).not.toContain("[box-shadow");
        expect(shellSurfaceClass).not.toContain("!");
        expect(dialog).toContain("className={SETTINGS_SHELL_SURFACE_CLASS}");
    });

    it("keeps the data-source three-pane shell from stacking on mobile", () => {
        const globals = readSource("app/globals.css");
        const dataSources = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );

        findStringConstInitializerContaining(dataSources, [
            "const SETTINGS_THREE_PANE_SCROLL_BODY_CLASS =",
            "grid",
            "min-h-0",
            "grid-cols-[280px_1fr]",
            "overflow-hidden",
            "p-0",
        ]);
        expect(dataSources).not.toContain("max-[720px]:grid-cols");
        expect(dataSources).not.toContain("max-[720px]:grid-rows");
        expect(globals).not.toMatch(
            /\.settings-main\.three-pane\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
        );
        expect(globals).not.toMatch(
            /\.settings-main\.three-pane\s*{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/,
        );
        expect(
            collectExactCssRuleBlocks(
                globals,
                '[data-sot-panel="settings-scroll-body"][data-sot-layout="three-pane"]',
            ),
        ).toEqual([]);
    });

    it("keeps data-source settings wired to provider rows, detail states, save, and no-persist test", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const dataSources = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const settingFieldControl = readSource(
            "features/settings/components/setting-field-control.tsx",
        );
        const dataSourceFieldControl = readSource(
            "features/data-sources/data-source-field-control.tsx",
        );
        const inputPrimitive = readSource("components/ui/input.tsx");
        const hook = readSource(
            "features/data-sources/use-data-sources-settings.ts",
        );
        const service = readSource("services/data-sources.ts");
        const providerTypes = readSource("lib/data-sources/types.ts");
        const globals = readSource("app/globals.css");

        for (const provider of [
            "dingtalk-a1",
            "ticnote",
            "plaud",
            "feishu-minutes",
            "iflyrec",
        ]) {
            expect(providerTypes).toContain(provider);
            expect(dataSources).toContain(provider);
        }

        expect(content).toContain(
            'import { DataSourcesSection } from "./sections/data-sources-section";',
        );
        expect(content).toContain('case "data-sources"');
        expect(content).toContain(
            "return <DataSourcesSection scrollRef={scrollRef} />;",
        );
        expect(content).not.toContain("function DataSourcesSettingsPanel");
        expect(content).not.toContain("useDataSourcesSettings");
        expect(content).not.toContain(
            'data-sot-surface="settings-data-sources"',
        );
        expect(dataSources).toContain("export function DataSourcesSection");
        expect(dataSources).toContain(
            'import { useDataSourcesSettings } from "@/features/data-sources/use-data-sources-settings";',
        );
        expect(dataSources).toContain("useDataSourcesSettings(language)");
        expect(dataSources).toContain("aria-busy={isLoading}");
        expect(dataSources).not.toContain("data-sot-");
        expect(dataSources).not.toContain("data-slot=");
        expect(dataSources).toContain(
            'import {\n    Empty,\n    EmptyDescription,\n    EmptyHeader,\n    EmptyTitle,\n} from "@/components/ui/empty";',
        );
        expect(dataSources).toContain("<EmptyHeader>");
        expect(dataSources).toContain("<EmptyTitle>");
        expect(dataSources).toContain("<EmptyDescription");
        expect(dataSources).toContain(
            '{isZh ? "正在读取来源" : "Loading sources"}',
        );
        expect(dataSources).toContain(
            '? "请稍候，正在读取已保存的数据源状态。"',
        );
        expect(dataSources).toContain('? "高级选项（可选）"');
        expect(dataSources).toContain('? "仅在来源要求额外组织信息时填写。"');
        expect(dataSources).toContain(
            '{isZh ? "没有可用数据源" : "No data sources"}',
        );
        expect(dataSources).toContain(
            '? "请稍后重试，或检查服务端数据源接口。"',
        );
        const sourceProviderFieldsListClass =
            dataSources.match(
                /const SOURCE_PROVIDER_FIELDS_LIST_CLASS\s*=\s*"([^"]*)";/,
            )?.[1] ?? "";
        const sourceProviderFieldsWrapper =
            dataSources.match(
                /<FieldGroup\s+className=\{SOURCE_PROVIDER_FIELDS_LIST_CLASS\}\s+unstyled/,
            )?.[0] ?? "";
        expect(sourceProviderFieldsListClass.split(/\s+/)).toEqual(
            expect.arrayContaining(["flex", "flex-col", "gap-0"]),
        );
        expect(sourceProviderFieldsWrapper).toContain("<FieldGroup");
        expect(sourceProviderFieldsWrapper).toContain(
            "className={SOURCE_PROVIDER_FIELDS_LIST_CLASS}",
        );
        expect(sourceProviderFieldsWrapper).toContain("unstyled");
        expect(dataSources).toContain("SOURCE_PROVIDER_DETAIL_FIELD_CLASS");
        expect(dataSources).toContain('variant="sourceProviderDetail"');
        expect(globals).not.toContain(
            '[data-sot-panel="source-provider-detail"] [data-sot-part="field-empty"]',
        );
        expect(globals).not.toMatch(/(^|\n|,)\s*\.field-empty\b/);
        expect(
            collectCssRuleBlocks(globals, "settings-empty-hint"),
        ).toHaveLength(0);
        expect(
            collectCssRuleBlocks(globals, "settings-empty-title"),
        ).toHaveLength(0);
        expect(
            collectCssRuleBlocks(globals, "settings-empty-description"),
        ).toHaveLength(0);
        expect(dataSources).not.toContain(
            'className="settings-main three-pane"',
        );
        expect(dataSources).not.toContain('className="empty-hint"');
        expect(dataSources).not.toContain('className="eh-t"');
        expect(dataSources).not.toContain('className="eh-h"');
        expect(dataSources).not.toContain('className="ds-fields"');
        const providersTitle = dataSources.match(
            /<h2\s+className=\{SOURCE_PROVIDERS_TITLE_CLASS\}>[\s\S]*?<\/h2>/,
        )?.[0];
        expect(providersTitle).toContain('{isZh ? "来源" : "Data Sources"}');
        expect(providersTitle).not.toContain('"数据源"');
        expect(content).toContain("onClick={onSave}");
        expect(content).toContain(
            'aria-describedby={saveState === "idle" ? undefined : statusId}',
        );
        expect(dataSources).not.toContain("data-sot-");
        expect(dataSources).toContain(
            "aria-controls={SOURCE_PROVIDER_DETAIL_ID}",
        );
        expect(dataSources).toContain("aria-pressed={isSelected}");
        expect(dataSources).toContain("disabled={interactionDisabled}");
        expect(dataSources).toContain(
            "aria-busy={isSourceActionStateBusy(actionState)}",
        );
        expect(dataSources).toContain("ProviderActionMessage");
        expect(dataSources).toContain('"testing"');
        expect(dataSources).toContain('"test-success"');
        expect(dataSources).toContain('"save-error"');
        expect(dataSources).toContain("source.syncStatus");
        expect(dataSources).toContain("source.lastSyncError");
        expect(dataSources).toContain('"syncing"');
        expect(dataSources).toContain('"同步中"');
        expect(dataSources).toContain('"同步失败"');
        expect(dataSources).toContain("来源更新失败，请检查登录信息后重试。");
        expect(dataSources).toContain("connectionStatus");
        expect(dataSources).toContain('"expired"');
        expect(dataSources).toContain("useSettingsSectionBusy");
        expect(dataSources).toContain("isDataSourcesBusy");
        const sourceAuthModeControl = collectElementSlices(
            dataSources,
            'type="single"',
            "ToggleGroup",
        )[0];
        expect(dataSources).toContain("<ToggleGroup");
        expect(dataSources).toContain("<ToggleGroupItem");
        expect(dataSources).toContain('type="single"');
        expect(dataSources).toContain("value={selectedSource.authMode}");
        expect(sourceAuthModeControl).toContain('variant="outline"');
        expect(sourceAuthModeControl).toContain("spacing={2}");
        expect(sourceAuthModeControl).toContain("className=");
        expect(sourceAuthModeControl).not.toContain(
            'layout="settingsSourceAuthMode"',
        );
        expect(sourceAuthModeControl).not.toContain(
            'variant="settingsSourceAuthModeOption"',
        );
        expect(sourceAuthModeControl).not.toContain(
            'size="settingsSourceAuthModeOption"',
        );
        expect(sourceAuthModeControl).not.toContain(
            'spacing="settingsSourceAuthMode"',
        );
        expect(sourceAuthModeControl).not.toContain(
            'variant="sourceAuthModeBadge"',
        );
        expect(sourceAuthModeControl).not.toContain('variant="secondary"');
        expect(sourceAuthModeControl).not.toContain('size="lg"');
        expect(sourceAuthModeControl).toContain(
            "disabled={interactionDisabled}",
        );
        expect(sourceAuthModeControl).toContain(
            "value={selectedSource.authMode}",
        );
        expect(dataSources).toContain("{modeBadge.label}");
        expect(dataSources).toContain('tone: "recommended"');
        expect(dataSources).toContain('tone: "personal"');
        expect(dataSources).toMatch(
            /getSourceAuthModeDisplayLabel\(\s*mode,\s*language,\s*\)/,
        );
        const settingsGroup =
            content.match(
                /function SettingsGroup[\s\S]*?function SettingsRow/,
            )?.[0] ?? "";
        const [sourceAuthModeBadge] = collectElementSlices(
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
        expect(dataSources).toContain("<Badge");
        expect(dataSources).toContain("authMode: mode");
        expect(dataSources).not.toContain('className="path-picker"');
        expect(dataSources).not.toContain("path-card");
        expect(dataSources).not.toContain("pc-badge");
        expect(dataSources).toContain(
            "SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY",
        );
        expect(dataSources).toContain("getSourceProviderSettingsLabel");
        expect(dataSources).toContain("handleTestSource");
        expect(dataSources).toContain("testSourceSettings(source)");
        expect(dataSources).toContain("handleSaveSource");
        expect(dataSources).toContain("handleReconnectSource");
        expect(dataSources).toContain("handleDisconnectSource");
        expect(dataSources).toContain("reconnectSourceSettings(");
        expect(dataSources).toContain("disconnectSourceSettings(");
        expect(dataSources).toContain("DataSourceFieldControl");
        expect(dataSources).toContain("updateField(");
        expect(dataSources).toContain("secretDrafts");
        expect(dataSources).toContain("Switch");
        expect(dataSources).toContain("onCheckedChange");
        expect(dataSources).toContain("enabled: checked");
        expect(dataSources).toContain("<CardHeader");
        expect(dataSources).toContain("<CardTitle>");
        expect(dataSources).toContain("<CardDescription>");
        expect(dataSources).toContain("<h3 id={providerDetailTitleId}>");
        expect(settingsGroup).toContain(
            "className={SETTINGS_SECTION_GROUP_CLASS}",
        );
        expect(settingsGroup).toContain("<section");
        expect(settingsGroup).toContain("<header");
        expect(dataSources).toContain('from "@/components/ui/field";');
        expect(dataSources).toContain("<Field");
        expect(dataSources).toContain("<FieldContent");
        expect(dataSources).toContain("<FieldLabel");
        expect(dataSources).toContain("<FieldTitle>");
        expect(dataSources).toContain("<FieldDescription>");
        expect(settingFieldControl).toContain("readOnly?: boolean");
        expect(settingFieldControl).toContain("readOnly={field.readOnly}");
        expect(settingFieldControl).toContain("masked?: boolean");
        expect(settingFieldControl).toContain("<FieldLabel htmlFor={fieldId}>");
        expect(settingFieldControl).toMatch(
            /type=\{\s*field\.sensitive\s*\?\s*"password"/,
        );
        expect(settingFieldControl).toContain("disabled={disabled}");
        expect(settingFieldControl).toContain(
            'field.masked && "tracking-widest"',
        );
        expect(settingFieldControl).not.toContain("data-sot-mask");
        expect(settingFieldControl).not.toContain("data-sot-privacy-boundary");
        expect(settingFieldControl).toContain("<FieldGroup");
        expect(settingFieldControl).toContain("<Field");
        expect(settingFieldControl).toContain("<FieldContent");
        expect(settingFieldControl).toContain("<FieldLabel");
        expect(settingFieldControl).toContain("<FieldDescription");
        expect(dataSourceFieldControl).toContain(
            'from "@/components/ui/field";',
        );
        expect(dataSourceFieldControl).toContain("<Field");
        expect(dataSourceFieldControl).toContain("<FieldContent");
        expect(dataSourceFieldControl).toContain("<FieldLabel");
        expect(dataSourceFieldControl).toContain("<FieldDescription");
        expect(dataSourceFieldControl).toContain(
            "masked: readOnlyMaskedDisplay",
        );
        expect(dataSourceFieldControl).not.toContain("data-sot-mask");
        expect(dataSourceFieldControl).not.toContain('"mask"');
        expect(inputPrimitive).toContain('data-slot="input"');
        for (const className of [
            "border-input",
            "focus-visible:ring-ring/50",
            "aria-invalid:border-destructive",
        ]) {
            expect(inputPrimitive).toContain(className);
        }
        expect(inputPrimitive).not.toContain("field-input");
        expect(content).toContain(
            `const statusId = \`\${saveId ?? section}-save-status\`;`,
        );
        expect(dataSources).toContain("handleTestSource(selectedSource)");
        expect(dataSources).toContain("handleSaveSource(selectedSource)");
        expect(dataSources).toContain("handleReconnectSource(");
        expect(dataSources).toContain("handleDisconnectSource(");
        expect(dataSources).toContain('"重新连接"');
        expect(dataSources).toContain('"断开连接"');
        expect(dataSources).toContain(
            'role={tone === "err" ? "alert" : "status"}',
        );
        expect(dataSources).toContain("getSourceProviderStatusHint");
        expect(dataSources).toContain("getSourceProviderDetailSubtitle");
        expect(dataSources).toContain("shouldShowProviderStateBanner");
        expect(dataSources).not.toContain('className="sm-detail-head"');
        expect(dataSources).not.toContain("className={`sm-detail-icon");
        expect(dataSources).not.toContain('className="sm-detail-title"');
        expect(dataSources).not.toContain('className="sm-detail-sub"');
        expect(dataSources).not.toContain('className="modal-foot"');
        expect(dataSources).not.toContain('className="sm-actions-spacer"');
        expect(dataSources).not.toContain('className="sm-section"');
        expect(dataSources).not.toContain("sm-actions-state");
        expect(dataSources).not.toContain("sd-pill");
        expect(content).not.toMatch(OLD_UI_RE);
        expect(dataSources).not.toMatch(OLD_UI_RE);

        expect(service).toContain("DATA_SOURCES_TEST_API_PATH");
        expect(service).toContain('"/api/data-sources/test"');
        expect(service).toContain("DATA_SOURCES_DISCONNECT_API_PATH");
        expect(service).toContain('"/api/data-sources/disconnect"');
        expect(service).toContain("DATA_SOURCES_RECONNECT_API_PATH");
        expect(service).toContain('"/api/data-sources/reconnect"');
        expect(service).toContain('method: "POST"');
        expect(service).toContain(
            "export async function disconnectDataSource(",
        );
        expect(service).toContain("export async function reconnectDataSource(");
        expect(service).toMatch(
            /export async function disconnectDataSource\([\s\S]*?DATA_SOURCES_DISCONNECT_API_PATH[\s\S]*?method:\s*"POST"/,
        );
        expect(service).toMatch(
            /export async function reconnectDataSource\([\s\S]*?DATA_SOURCES_RECONNECT_API_PATH[\s\S]*?method:\s*"POST"/,
        );
        expect(hook).toContain("testDataSource(");
        expect(hook).toContain("testSourceSettings");
        expect(hook).toContain("saveSourceSettings");
        expect(hook).toContain("disconnectDataSource(");
        expect(hook).toContain("reconnectDataSource(");
        expect(hook).toContain("disconnectSourceSettings");
        expect(hook).toContain("reconnectSourceSettings");
        expect(hook).toMatch(
            /reconnectSourceSettings[\s\S]*?buildDataSourceSavePayload\(\s*\{\s*\.\.\.source,\s*enabled:\s*true,\s*\},\s*secretDrafts,\s*language,\s*\)/,
        );
        expect(hook).toMatch(
            /reconnectSourceSettings[\s\S]*?setSecretDrafts\([\s\S]*?\[source\.provider\]:\s*\{\}/,
        );
        expect(hook).toMatch(
            /reconnectSourceSettings[\s\S]*?await refreshSources\(\)/,
        );
        expect(hook).toMatch(/reconnectSourceSettings[\s\S]*?toast\.success/);
        expect(hook).toMatch(
            /disconnectSourceSettings[\s\S]*?await refreshSources\(\)/,
        );
        expect(hook).toMatch(/disconnectSourceSettings[\s\S]*?toast\.success/);
        expect(hook).not.toContain("@/server");
        expect(hook).not.toContain("@/db");
    });

    it("keeps data-source load retry on semantic alert and button behavior", () => {
        const dataSources = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const sourceLoadError = dataSources.match(
            /<Alert\s+variant="destructiveSoft"[\s\S]*?<\/Alert>/,
        )?.[0];
        const sourceLoadErrorOpening =
            sourceLoadError?.match(/<Alert\s[^>]*>/)?.[0];
        const retryButton = sourceLoadError?.match(
            /<Button[\s\S]*?<\/Button>/,
        )?.[0];

        expect(sourceLoadError).toContain('role="alert"');
        expect(sourceLoadErrorOpening).toContain('variant="destructiveSoft"');
        expect(sourceLoadErrorOpening).toContain('density="comfortable"');
        expect(sourceLoadErrorOpening).toContain(
            "className={SETTINGS_BANNER_BASE_CLASS}",
        );
        expect(sourceLoadErrorOpening).not.toContain("className={cn(");
        expect(sourceLoadErrorOpening).not.toContain(
            "SETTINGS_BANNER_ACTION_LAYOUT_CLASS",
        );
        expect(sourceLoadErrorOpening).not.toContain(
            "SETTINGS_BANNER_ERROR_CLASS",
        );
        expect(sourceLoadErrorOpening).not.toContain(
            'variant="settingsLoadError"',
        );
        expect(sourceLoadErrorOpening).not.toContain(
            'density="settingsBanner"',
        );
        expect(sourceLoadErrorOpening).not.toContain(
            "border-destructive/30 bg-destructive/10",
        );
        expect(sourceLoadError).toContain("<AlertTitle");
        expect(sourceLoadError).toContain("<AlertDescription");
        expect(retryButton).toContain('variant="default"');
        expect(retryButton).not.toContain('variant="settingsSourceRetry"');
        expect(retryButton).not.toContain('size="settingsSourceRetry"');
        expect(retryButton).toContain("onClick={() => void refreshSources()}");
    });

    it("keeps provider enable sync on native switch state", () => {
        const dataSources = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const enableSwitch = dataSources.match(
            /<Switch\s+id=\{`\$\{selectedSource\.provider\}-enabled`\}[\s\S]*?\/>/,
        )?.[0];

        expect(enableSwitch).not.toContain("data-");
        expect(enableSwitch).toContain("checked={selectedSource.enabled}");
        expect(enableSwitch).toContain("disabled={interactionDisabled}");
        expect(enableSwitch).toContain("onCheckedChange={(checked) =>");
    });

    it("links provider tiles to a labeled, busy-aware detail region", () => {
        const dataSources = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const providerTile =
            dataSources.match(
                /function DataSourceProviderTile[\s\S]*?function ProviderStateBanner/,
            )?.[0] ?? "";
        const detailRoot =
            dataSources.match(
                /<section[\s\S]*?id=\{SOURCE_PROVIDER_DETAIL_ID\}[\s\S]*?>/,
            )?.[0] ?? "";
        const detailPanelClass =
            dataSources.match(
                /const SOURCE_PROVIDER_DETAIL_PANEL_CLASS\s*=\s*"[^"]*";/,
            )?.[0] ?? "";
        const providerTileClass =
            dataSources.match(
                /const SOURCE_PROVIDER_TILE_BUTTON_CLASS[\s\S]*?;/,
            )?.[0] ?? "";

        expect(dataSources).not.toMatch(
            /data-provider=|data-selected=|data-dimmed=|data-provider-detail=|data-ds-state=/,
        );
        expect(providerTile).not.toContain("data-sot-");
        expect(providerTile).toMatch(
            /variant=\{\s*isSelected\s*\?\s*"secondary"\s*:\s*"ghost"\s*\}/,
        );
        expect(providerTile).not.toContain('variant="surfaceItem"');
        expect(providerTile).not.toContain('size="surfaceItem"');
        expect(providerTile).not.toContain("data-muted=");
        expect(providerTile).toContain("SOURCE_PROVIDER_TILE_BUTTON_CLASS");
        expect(providerTile).not.toContain('variant="sourceProviderTile"');
        expect(providerTile).not.toContain('size="sourceProviderTile"');
        expect(providerTile).toContain("aria-pressed={isSelected}");
        expect(providerTile).toContain(
            "aria-controls={SOURCE_PROVIDER_DETAIL_ID}",
        );
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
            expect(providerTileClass).not.toContain(
                removedProviderTileSkinToken,
            );
        }
        expect(providerTile).toContain("SOURCE_PROVIDER_STATUS_BADGE_CLASS");
        expect(providerTile).toContain(
            "variant={getProviderStatusBadgeVariant(status.tone)}",
        );
        expect(providerTile).toContain('role="status"');
        expect(providerTile).not.toContain('size="statusPill"');
        expect(detailRoot).toContain("className=");
        expect(detailRoot).toContain("SOURCE_PROVIDER_DETAIL_PANEL_CLASS");
        expect(detailPanelClass).toContain("px-[26px]");
        expect(detailPanelClass).toContain("py-[22px]");
        expect(detailPanelClass).not.toContain("p-6");
        expect(detailRoot).toContain("aria-labelledby={providerDetailTitleId}");
        expect(detailRoot).toContain(
            "aria-busy={isSourceActionStateBusy(actionState)}",
        );
        expect(dataSources).toContain("<h3 id={providerDetailTitleId}>");
    });

    it("keeps provider buttons and badges on shadcn variants without local skins", () => {
        const content = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const button = readSource("components/ui/button.tsx");
        const badge = readSource("components/ui/badge.tsx");
        const toggleGroup = readSource("components/ui/toggle-group.tsx");
        const globals = readSource("app/globals.css");
        const providerTile =
            content.match(
                /function DataSourceProviderTile[\s\S]*?function ProviderStateBanner/,
            )?.[0] ?? "";
        const providerStateBanner =
            content.match(
                /<Alert[\s\S]*?variant=\{tone === "err" \? "destructiveSoft" : "default"\}[\s\S]*?>/,
            )?.[0] ?? "";
        const providerStateBannerBlock =
            content.match(
                /function ProviderStateBanner[\s\S]*?export function DataSourcesSection/,
            )?.[0] ?? "";
        const bannerIconSlotClass =
            content.match(
                /const SETTINGS_BANNER_ICON_SLOT_CLASS[\s\S]*?;/,
            )?.[0] ?? "";
        const providerTileButton =
            providerTile.match(/<Button[\s\S]*?>/)?.[0] ?? "";
        const sourceActionArea = content;
        const sourceActionButtonWrapper =
            content.match(
                /function SourceActionButton[\s\S]*?function SourceActionStatusBadge/,
            )?.[0] ?? "";
        const sourceActionStatusWrapper =
            content.match(
                /function SourceActionStatusBadge[\s\S]*?function hasSavedSetup/,
            )?.[0] ?? "";
        const statusBadgeClass =
            content.match(
                /const SOURCE_PROVIDER_STATUS_BADGE_CLASS[\s\S]*?;/,
            )?.[0] ?? "";
        const detailStatusBadgeClass =
            content.match(
                /const SOURCE_DETAIL_STATUS_BADGE_CLASS[\s\S]*?;/,
            )?.[0] ?? "";
        const settingsStatusBadgeConstants = [
            ...content.matchAll(
                /const\s+[A-Z0-9_]*STATUS[A-Z0-9_]*BADGE_CLASS\s*=[\s\S]*?;/g,
            ),
        ]
            .map((match) => match[0])
            .join("\n");
        const detailStatusBadge =
            content.match(
                /<Badge[\s\S]*?className=\{SOURCE_DETAIL_STATUS_BADGE_CLASS\}[\s\S]*?>/,
            )?.[0] ?? "";
        const sourceTestAction = collectElementSlices(
            sourceActionArea,
            'aria-busy={actionState === "testing"}',
            "SourceActionButton",
        )[0];
        const sourceSaveAction = collectElementSlices(
            sourceActionArea,
            'aria-busy={actionState === "saving"}',
            "SourceActionButton",
        )[0];
        const sourceReconnectAction = collectElementSlices(
            sourceActionArea,
            "handleReconnectSource(",
            "SourceActionButton",
        )[0];
        const sourceDisconnectAction = collectElementSlices(
            sourceActionArea,
            "handleDisconnectSource(",
            "SourceActionButton",
        )[0];

        expect(content).not.toContain("getProviderTileVariant");
        expect(content).toContain("getProviderStatusBadgeVariant");
        expect(content).not.toContain("getProviderStatusBadgeClassName");
        expect(content).not.toContain("getProviderDetailStatusBadgeClassName");
        expect(content).not.toContain("SOURCE_PROVIDER_ACTION_BUTTON_CLASS");
        expect(content).not.toContain(
            "SOURCE_PROVIDER_GHOST_ACTION_BUTTON_CLASS",
        );
        expect(content).not.toContain(
            "SOURCE_PROVIDER_PRIMARY_ACTION_BUTTON_CLASS",
        );
        expect(content).not.toContain(
            "SOURCE_PROVIDER_DANGER_ACTION_BUTTON_CLASS",
        );
        expect(content).not.toContain("SOURCE_PROVIDER_ACTIONS_CLASS");
        expect(providerStateBanner).toContain(
            'variant={tone === "err" ? "destructiveSoft" : "default"}',
        );
        expect(providerStateBanner).toContain('density="comfortable"');
        expect(providerStateBanner).toContain(
            "className={SETTINGS_BANNER_BASE_CLASS}",
        );
        expect(providerStateBanner).not.toContain("className={cn(");
        expect(content).not.toContain("SETTINGS_BANNER_LAYOUT_CLASS");
        expect(content).not.toContain("SETTINGS_BANNER_ERROR_CLASS");
        expect(content).not.toContain("SETTINGS_BANNER_TONE_CLASS");
        expect(bannerIconSlotClass).toBe("");
        expect(providerStateBannerBlock).not.toContain("data-sot-banner-icon");
        expect(providerStateBannerBlock).toContain("<Spinner");
        expect(providerStateBannerBlock).toContain("<Icon");
        expect(providerStateBannerBlock).not.toContain("LoaderCircle");
        expect(providerStateBannerBlock).not.toContain("animate-spin");
        expect(providerStateBanner).not.toContain('density="settingsBanner"');
        expect(providerStateBanner).not.toContain(
            "border-destructive/30 bg-destructive/10",
        );
        expect(providerTile).toMatch(
            /variant=\{\s*isSelected\s*\?\s*"secondary"\s*:\s*"ghost"\s*\}/,
        );
        expect(providerTile).not.toContain('variant="surfaceItem"');
        expect(providerTile).not.toContain('size="surfaceItem"');
        expect(providerTile).not.toContain("data-muted=");
        expect(providerTile).toContain("SOURCE_PROVIDER_TILE_BUTTON_CLASS");
        expect(providerTile).not.toContain('variant="sourceProviderTile"');
        expect(providerTile).not.toContain('size="sourceProviderTile"');
        expect(providerTileButton).toContain(
            "SOURCE_PROVIDER_TILE_BUTTON_CLASS",
        );
        expect(providerTileButton).not.toContain("isDimmed &&");
        expect(providerTileButton).not.toContain("opacity-");
        expect(providerTile).not.toContain(
            'className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-[var(--line-hairline)] bg-white"',
        );
        expect(providerTile).not.toContain(
            'className="flex min-w-0 flex-col gap-[2px]"',
        );
        expect(providerTile).not.toContain('className="truncate font-sans');
        expect(providerTile).not.toContain('className="truncate font-mono');
        expect(providerTile).toContain("SOURCE_PROVIDER_MARK_CLASS");
        expect(providerTile).toContain("SOURCE_PROVIDER_META_CLASS");
        expect(providerTile).toContain("SOURCE_PROVIDER_NAME_CLASS");
        expect(providerTile).toContain("SOURCE_PROVIDER_HINT_CLASS");
        expect(providerTile).toContain("SOURCE_PROVIDER_STATUS_BADGE_CLASS");
        expect(providerTile).toContain(
            "variant={getProviderStatusBadgeVariant(status.tone)}",
        );
        expect(detailStatusBadge).toContain(
            "variant={getProviderStatusBadgeVariant",
        );
        expect(detailStatusBadge).not.toContain('size="statusPill"');
        expect(providerTile).toContain(
            "className={SOURCE_PROVIDER_STATUS_BADGE_CLASS}",
        );
        expect(providerTile).not.toContain(
            '"size-[4px] rounded-full bg-current"',
        );
        expect(providerTile).not.toContain("data-sot-");
        expect(sourceActionArea).toContain("<SourceActionStatusBadge");
        expect(sourceActionArea).toContain("<SourceActionButton");
        expect(sourceTestAction).toContain('tone="neutral"');
        expect(sourceTestAction).toContain(
            'aria-busy={actionState === "testing"}',
        );
        expect(sourceTestAction).toContain("<Spinner");
        expect(sourceTestAction).toContain('data-icon="inline-start"');
        expect(sourceTestAction).not.toContain("<LoaderCircle");
        expect(sourceTestAction).not.toContain('className="animate-spin"');
        expect(sourceSaveAction).toContain('tone="primary"');
        expect(sourceSaveAction).toContain(
            'aria-busy={actionState === "saving"}',
        );
        expect(sourceSaveAction).toContain("<Spinner");
        expect(sourceSaveAction).toContain('data-icon="inline-start"');
        expect(sourceSaveAction).not.toContain("<LoaderCircle");
        expect(sourceSaveAction).not.toContain('className="animate-spin"');
        expect(sourceReconnectAction).toContain('tone="neutral"');
        expect(sourceDisconnectAction).toContain('tone="danger"');
        expect(sourceActionArea).not.toContain("sourceProviderAction");
        expect(sourceActionButtonWrapper).toContain("<Button");
        expect(sourceActionButtonWrapper).toContain("variant={");
        expect(sourceActionButtonWrapper).toContain("className={className}");
        expect(sourceActionButtonWrapper).not.toMatch(
            /\bsize=["'{][^"'}]*sourceProviderAction/i,
        );
        expect(sourceActionStatusWrapper).toContain("<Badge");
        expect(sourceActionStatusWrapper).toContain(
            "variant={getSourceActionStatusBadgeVariant(state)}",
        );
        expect(sourceActionStatusWrapper).toContain(
            "<SourceActionStatusIndicator state={state} />",
        );
        expect(sourceActionStatusWrapper).not.toContain(
            "SOURCE_ACTION_STATUS_INDICATOR_CLASS",
        );
        expect(sourceActionStatusWrapper).not.toContain("animate-pulse");
        expect(sourceActionStatusWrapper).not.toContain("showIndicator");
        expect(content).toContain("function SourceActionStatusIndicator");
        expect(sourceActionStatusWrapper).toContain(
            'role={state.endsWith("error") ? "alert" : "status"}',
        );
        expect(sourceActionStatusWrapper).toContain(
            'aria-live={state.endsWith("error") ? "assertive" : "polite"}',
        );
        expect(content).toContain("<Spinner");
        expect(content).toContain("getSourceActionStatusIcon");
        expect(badge).not.toContain("statusPill:");
        expect(badge).not.toContain("h-[18px]");
        expect(badge).not.toContain("gap-[4px]");
        expect(badge).not.toContain("rounded-[999px]");
        expect(badge).not.toContain("border border-solid");
        expect(badge).not.toContain("px-[7px]");
        expect(badge).not.toMatch(/(?:^|[\s"'])py-0(?:[\s"'])/);
        expect(badge).not.toContain("text-[10.5px]");
        expect(badge).not.toContain("font-semibold");
        expect(button).not.toContain("navigationItem:");
        expect(button).not.toContain("surfaceItem:");
        expect(button).not.toContain(
            "data-[state=selected]:bg-[var(--bg-elevated)]",
        );
        expect(button).not.toContain("data-[state=selected]:shadow-xs");
        expect(button).not.toContain("data-[muted=true]:border-transparent");
        expect(button).not.toContain("data-[muted=true]:bg-transparent");
        expect(button).not.toContain("data-[muted=true]:opacity-[0.55]");
        expect(button).not.toContain("data-[muted=true]:[box-shadow:none]");
        expect(button).not.toContain("rail:");
        expect(button).not.toContain("sr-item");
        expect(button).not.toContain("buttonStateClassName");
        expect(button).not.toContain('variant === "rail"');
        expect(button).not.toContain("oklch(");
        expect(button).not.toContain("data-sot");
        expect(button).not.toMatch(/\bsourceProvider\b/);
        expect(button).not.toMatch(/\bsettings\b/i);
        expect(button).not.toContain("sourceProviderTile:");
        expect(button).not.toMatch(/\bsourceProviderAction\b/);
        expect(toggleGroup).not.toContain("settingsSourceAuthMode:");
        expect(toggleGroup).not.toContain("settingsSourceAuthModeOption:");
        expect(badge).not.toContain("sourceAuthModeBadge");
        expect(badge).not.toContain("sourceActionStatus:");
        expect(badge).not.toContain("sourceProviderStatus");
        expect(badge).not.toContain("sourceProviderDetailStatus");
        expect(badge).not.toContain("source-provider-status");
        for (const statusClass of [statusBadgeClass, detailStatusBadgeClass]) {
            expect(statusClass).not.toContain("data-[sot-tone=");
            expect(statusClass).not.toContain("[&_[data-sot");
            expect(statusClass).not.toContain("var(--");
            expect(statusClass).not.toContain("SOURCE_STATUS_BADGE_CLASS");
        }
        expectSourceProviderStatusBadgeClassIsLayoutOnly(statusBadgeClass);
        expect(content).not.toContain("SOURCE_STATUS_BADGE_CLASS");
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
        expect(detailStatusBadgeClass).toContain("shrink-0");
        expect(providerTile).not.toContain('size="statusPill"');
        expect(providerTile).not.toContain('"size-1 rounded-full bg-current"');
        expect(providerTile).toContain("<ProviderStatusIndicator");
        expect(content).toContain('tone === "syncing"');
        expect(content).not.toContain("data-sot-");
        expect(content).not.toContain("getSourceActionStatusBadgeClassName");
        expect(content).not.toContain("getSourceActionStatusDotClassName");
        expect(statusBadgeClass).not.toContain(
            "group-data-[sot-dimmed=true]/source-provider",
        );

        for (const selector of [
            "[data-sot-provider-card]",
            "[data-sot-provider-status]",
        ]) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }

        expect(globals).not.toContain(
            '[data-sot-provider-status][data-sot-tone="syncing"]',
        );
        expect(globals).not.toContain("@keyframes ds-pulse");
        expect(globals).not.toContain('[data-sot-list="source-auth-modes"]');
        expect(globals).not.toContain(
            '[data-sot-control="source-auth-mode"][data-sot-auth-mode]',
        );
        expect(globals).not.toContain(
            '[data-sot-control="source-auth-mode"][data-sot-state="selected"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="source-auth-mode-title"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="source-auth-mode-description"]',
        );
    });

    it("keeps settings and data-source primitive repaint out of globals", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const voscript = readSource(
            "features/settings/components/sections/voscript-section.tsx",
        );
        const dataSources = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const settingFieldControl = readSource(
            "features/settings/components/setting-field-control.tsx",
        );
        const dataSourceFieldControl = readSource(
            "features/data-sources/data-source-field-control.tsx",
        );
        const onboardingForm = readSource(
            "features/onboarding/components/onboarding-form.tsx",
        );
        const fieldPrimitive = readSource("components/ui/field.tsx");
        const inputPrimitive = readSource("components/ui/input.tsx");
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const toggleGroupPrimitive = readSource(
            "components/ui/toggle-group.tsx",
        );
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const switchPrimitive = readSource("components/ui/switch.tsx");
        const globals = readSource("app/globals.css");
        const onboardingProviderFieldSlice = onboardingForm.match(
            /\{providerFields\.map\(\(field\) => \([\s\S]*?<DataSourceFieldControl[\s\S]*?\/>\s*\)\)\}/,
        )?.[0];
        const saveActionsClass =
            content.match(/const SETTINGS_SAVE_ACTIONS_CLASS[\s\S]*?;/)?.[0] ??
            "";
        const saveStatus =
            content.match(
                /function SaveStatus[\s\S]*?function SectionShell/,
            )?.[0] ?? "";
        const providerStateBannerBlock =
            dataSources.match(
                /function ProviderStateBanner[\s\S]*?export function DataSourcesSection/,
            )?.[0] ?? "";
        const shortcutsGridClass =
            content.match(
                /const SETTINGS_SHORTCUTS_GRID_CLASS[\s\S]*?;/,
            )?.[0] ?? "";
        const shortcutRowClass =
            content.match(/const SETTINGS_SHORTCUT_ROW_CLASS[\s\S]*?;/)?.[0] ??
            "";
        const shortcutKeyClass =
            content.match(/const SETTINGS_SHORTCUT_KEY_CLASS[\s\S]*?;/)?.[0] ??
            "";
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
        const inputClassNameBlock =
            settingFieldControl.match(
                /const inputClassName = cn\([\s\S]*?\n\s*\);/,
            )?.[0] ?? "";
        const sourceProviderControlClassNameBlock =
            settingFieldControl.match(
                /const sourceProviderControlClassName[\s\S]*?;/,
            )?.[0] ?? "";
        const titleGenerationPanel =
            content.match(
                /function TitleGenerationSettingsPanel[\s\S]*?function TranscriptionSettingsPanel/,
            )?.[0] ?? "";
        const titleGenerationStatusBadges = collectElementSlices(
            titleGenerationPanel,
            'role="status"',
            "Badge",
        );
        const voscriptKeyStatusBadges = collectElementSlices(
            voscript,
            'id="voscript-api-key-status"',
            "Badge",
        );

        expect(content).toContain("SETTINGS_FIELD_ROW_CLASS");
        expect(content).toContain("SETTINGS_FIELD_CONTENT_CLASS");
        expect(content).toContain("SETTINGS_FIELD_CONTROL_CLASS");
        expect(content).not.toContain('fieldOrientation="horizontal"');
        expect(content).not.toContain("thumbClassName={");
        for (const settingsAlertPrimitiveToken of [
            "settingsBanner:",
            "settingsBannerError:",
            "settingsLoadError:",
            "settingsVoScriptWarning:",
            "settingsBannerAction:",
        ]) {
            expect(alertPrimitive).not.toContain(settingsAlertPrimitiveToken);
        }
        expect(dataSources).toContain('variant="sourceProviderDetail"');
        expect(dataSources).not.toContain('variant="detail"');
        expect(dataSources).not.toContain("settingsDetail");
        expect(dataSources).toContain("<FieldControl");
        expect(dataSources).not.toContain('controlSize="sourceProviderDetail"');
        expect(dataSources).not.toContain('size="sourceProviderDetail"');
        expect(dataSources).toContain("SOURCE_PROVIDER_DETAIL_FIELD_CLASS");
        expect(dataSources).toContain(
            "SOURCE_PROVIDER_DETAIL_FIELD_CONTENT_CLASS",
        );
        expect(dataSources).toContain(
            "SOURCE_PROVIDER_DETAIL_FIELD_CONTROL_CLASS",
        );
        expect(dataSources).toContain("SOURCE_PROVIDER_DETAIL_INPUT_CLASS");
        expect(dataSources).toContain(
            '<footer className="flex items-center justify-start gap-2">',
        );
        expect(content).toContain(
            "<div className={SETTINGS_SAVE_ACTIONS_CLASS}>",
        );
        expect(content).toContain(
            'import { Spinner } from "@/components/ui/spinner";',
        );
        expect(content).toContain('data-icon="inline-start"');
        expect(providerStateBannerBlock).toContain("<Spinner");
        expect(providerStateBannerBlock).toContain("<Icon");
        expect(providerStateBannerBlock).not.toContain("LoaderCircle");
        expect(providerStateBannerBlock).not.toContain("animate-spin");
        for (const source of [
            content,
            voscript,
            dataSources,
            settingFieldControl,
            dataSourceFieldControl,
            switchPrimitive,
        ]) {
            expect(source).not.toContain("thumbClassName={");
            expect(source).not.toContain("thumbClassName?: string");
        }
        for (const source of [settingFieldControl, dataSourceFieldControl]) {
            expect(source).not.toContain("fieldClassName?: string");
            expect(source).not.toContain("fieldContentClassName?: string");
            expect(source).not.toContain("inputClassName?: string");
            expect(source).not.toContain("switchClassName?: string");
            expect(source).not.toContain("switchThumbClassName?: string");
        }
        expect(settingFieldControl).toContain(
            'variant?: "default" | "settings" | "sourceProviderDetail"',
        );
        expect(settingFieldControl).toContain(
            'const isSourceProviderDetailVariant = variant === "sourceProviderDetail"',
        );
        expect(settingFieldControl).toContain("<FieldControl");
        expect(settingFieldControl).toContain(
            "className={fieldControlClassName}",
        );
        expect(settingFieldControl).not.toMatch(/export const .*_CLASS/);
        expect(settingFieldControl).toContain("SETTINGS_FIELD_ROW_CLASS");
        expect(settingFieldControl).toContain("SETTINGS_FIELD_CONTENT_CLASS");
        expect(settingFieldControl).toContain("SETTINGS_FIELD_CONTROL_CLASS");
        expect(settingFieldControl).toContain("isSourceProviderDetailVariant");
        expect(settingFieldControl).not.toContain(
            "isSourceProviderCredentialField",
        );
        expect(settingFieldControl).not.toContain("fieldLabelClassName");
        expect(settingFieldControl).not.toContain("fieldDescriptionClassName");
        expect(settingFieldControl).not.toContain("variant={controlVariant}");
        expect(settingFieldControl).not.toContain("controlSize={controlSize}");
        expect(settingFieldControl).not.toContain("size={controlSize}");
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
        for (const removedProviderDetailInputSkin of [
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
                removedProviderDetailInputSkin,
            );
        }
        expect(providerDetailInputOwnerClass).not.toMatch(
            /(?:^|[\s"'])w-60(?:[\s"';]|$)/,
        );
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
            providerDetailInputOwnerClassName,
        );
        expect(sourceProviderControlClassNameBlock).toContain("undefined");
        expect(inputClassNameBlock).toContain("sourceProviderControlClassName");
        expect(inputClassNameBlock).toContain("field.masked &&");
        expect(inputClassNameBlock).toContain("field.className");
        expect(settingFieldControl).toContain("<FieldLabel htmlFor={fieldId}>");
        expect(settingFieldControl).toMatch(
            /type=\{\s*field\.sensitive\s*\?\s*"password"/,
        );
        expect(settingFieldControl).toContain("disabled={disabled}");
        expect(settingFieldControl).toContain("readOnly={field.readOnly}");
        expect(settingFieldControl).toContain(
            'field.masked && "tracking-widest"',
        );
        expect(settingFieldControl).not.toContain("data-sot-mask");
        expect(settingFieldControl).not.toContain("data-sot-privacy-boundary");
        expect(settingFieldControl).toContain("className={inputClassName}");
        expect(settingFieldControl).toContain("fieldContentClassName");
        expect(settingFieldControl).toContain("fieldControlClassName");
        expect(dataSourceFieldControl).toContain(
            'variant?: "default" | "onboarding" | "settings" | "sourceProviderDetail"',
        );
        expect(dataSourceFieldControl).toContain('variant = "default"');
        expect(dataSourceFieldControl).toContain(
            'if (variant === "settings" || variant === "sourceProviderDetail")',
        );
        expect(dataSourceFieldControl).toContain("variant={variant}");
        expect(dataSourceFieldControl).toContain("controlInputClassName");
        expect(dataSourceFieldControl).toContain(
            'renderedField.masked && "tracking-[0.15em]"',
        );
        expect(onboardingForm).toContain("<DataSourceFieldControl");
        expect(onboardingProviderFieldSlice).toContain(
            "<DataSourceFieldControl",
        );
        expect(onboardingProviderFieldSlice).toContain('variant="onboarding"');
        expect(onboardingProviderFieldSlice).not.toContain(
            'variant="settings"',
        );
        expect(fieldPrimitive).toContain('type FieldVariant = "default";');
        expect(fieldPrimitive).toContain(
            'type FieldContentVariant = "default";',
        );
        expect(fieldPrimitive).toContain(
            'type FieldControlVariant = "default";',
        );
        expect(fieldPrimitive).not.toContain('| "detail"');
        expect(fieldPrimitive).not.toContain("detail:");
        expectPrimitiveToExcludeBusinessTokens(
            fieldPrimitive,
            AUTH_FIELD_PRIMITIVE_FORBIDDEN_TOKENS,
        );
        expect(fieldPrimitive).not.toContain("settingsRow");
        expect(fieldPrimitive).not.toContain("settingsContent");
        expect(fieldPrimitive).not.toContain("settingsControl");
        expect(fieldPrimitive).not.toContain("settingsDetail");
        expect(fieldPrimitive).not.toMatch(/\bsettings\b/i);
        expect(fieldPrimitive).not.toContain("sourceProviderDetail");
        expect(fieldPrimitive).not.toMatch(/\bsourceProvider\b/);
        expect(fieldPrimitive).not.toContain("data-sot");
        expect(fieldPrimitive).not.toContain("grid grid-cols-[1fr_auto]");
        expect(fieldPrimitive).toContain("function FieldControl");
        expect(fieldPrimitive).toContain("data-variant={variant}");
        expect(buttonPrimitive).not.toContain("settingsSave:");
        expect(buttonPrimitive).not.toContain("settingsTestAction:");
        expect(buttonPrimitive).not.toContain("settingsSourceRetry:");
        expect(buttonPrimitive).not.toContain("settingsSectionRetry:");
        expect(content).not.toContain("SETTINGS_SAVE_STATUS_BADGE_CLASS");
        expect(content).toContain("const statusVariant: BadgeVariant =");
        expect(content).toContain("const statusClassName = cn(");
        expect(saveStatus).toContain('const isIdle = saveState === "idle";');
        expect(saveStatus).toContain(
            'const statusClassName = cn("gap-1.5", isIdle && "hidden");',
        );
        expect(content).not.toContain("const indicatorClassName = cn(");
        expect(saveStatus).toContain("<Spinner");
        expect(saveStatus).toContain("<CheckCircle2");
        expect(saveStatus).toContain("<XCircle");
        expect(saveStatus).toContain("id={statusId}");
        expect(saveStatus).toContain("role={statusRole}");
        expect(saveStatus).toContain("aria-live={statusLive}");
        expect(saveStatus).toContain(
            'aria-atomic={isIdle ? undefined : "true"}',
        );
        expect(saveStatus).not.toContain("animate-pulse");
        expect(saveStatus).not.toContain("rounded-full bg-current");
        expect(saveActionsClass).toContain("SETTINGS_SAVE_ACTIONS_CLASS");
        expect(saveActionsClass).toContain(
            "flex flex-row-reverse items-center gap-2",
        );
        expect(saveActionsClass).not.toContain("data-[sot-state=");
        expect(saveActionsClass).not.toContain("[&_[data-sot-control");
        expect(shortcutsGridClass).toContain("SETTINGS_SHORTCUTS_GRID_CLASS");
        expect(shortcutsGridClass).toContain("grid grid-cols-[1fr_auto]");
        expect(shortcutRowClass).toContain("SETTINGS_SHORTCUT_ROW_CLASS");
        expect(shortcutRowClass).toContain("border-border");
        expect(shortcutRowClass).toContain("text-foreground");
        expect(shortcutRowClass).not.toContain("var(--");
        expect(shortcutKeyClass).toContain("SETTINGS_SHORTCUT_KEY_CLASS");
        expect(shortcutKeyClass).toContain("bg-muted");
        expect(shortcutKeyClass).toContain("text-muted-foreground");
        expect(shortcutKeyClass).not.toContain("var(--");
        expect(content).toContain("className={SETTINGS_SHORTCUTS_GRID_CLASS}");
        expect(content).toContain("className={SETTINGS_SHORTCUT_ROW_CLASS}");
        expect(content).toContain("className={SETTINGS_SHORTCUT_KEY_CLASS}");
        for (const source of [content, voscript]) {
            expect(source).not.toContain("SETTINGS_KEY_STATUS_CLASS");
            expect(source).not.toContain(
                "className={SETTINGS_KEY_STATUS_CLASS}",
            );
            expect(source).not.toContain('className="text-primary"');
            expect(source).not.toContain('data-state="valid"');
            expect(source).not.toContain('data-state="invalid"');
        }
        expect(titleGenerationStatusBadges).toHaveLength(1);
        expect(titleGenerationStatusBadges[0]).toContain("<Badge");
        expect(titleGenerationStatusBadges[0]).toContain('variant="secondary"');
        expect(titleGenerationStatusBadges[0]).toContain('role="status"');
        expect(titleGenerationStatusBadges[0]).toContain("<CheckCircle2");
        expect(titleGenerationStatusBadges[0]).toContain('aria-hidden="true"');
        expect(titleGenerationStatusBadges[0]).toContain(
            'data-icon="inline-start"',
        );
        expect(titleGenerationStatusBadges[0]).toContain(
            '{isZh ? "已存储" : "Stored"}',
        );
        expect(titleGenerationStatusBadges[0]).not.toContain("data-sot-");
        expect(voscriptKeyStatusBadges).toHaveLength(1);
        for (const keyStatusBadge of voscriptKeyStatusBadges) {
            expect(keyStatusBadge).toContain("<Badge");
            expect(keyStatusBadge).toContain('id="voscript-api-key-status"');
            expect(keyStatusBadge).toContain('variant="secondary"');
            expect(keyStatusBadge).toContain('role="status"');
            expect(keyStatusBadge).toContain('aria-live="polite"');
            expect(keyStatusBadge).toContain("<CheckCircle2");
            expect(keyStatusBadge).toContain('aria-hidden="true"');
            expect(keyStatusBadge).toContain('data-icon="inline-start"');
            expect(keyStatusBadge).toContain('{isZh ? "已存储" : "Stored"}');
            expect(keyStatusBadge).not.toContain("data-sot-");
            expect(keyStatusBadge).not.toContain("SETTINGS_KEY_STATUS_CLASS");
            expect(keyStatusBadge).not.toContain('className="text-primary"');
        }
        expect(voscript).toContain('id="voscript-api-key"');
        expect(voscript).toContain('type="password"');
        expect(voscript).toContain("value={apiKeyDraft}");
        expect(voscript).not.toContain(
            "value={draft.privateTranscriptionApiKey}",
        );
        expect(voscript).toContain('"voscript-api-key-status"');
        expect(voscript).not.toContain("data-sot-");
        expect(voscript).not.toContain("data-slot=");
        for (const selector of REMOVED_SETTINGS_SHORTCUTS_KEY_STATUS_VISUAL_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).not.toContain(
            '[data-sot-key-status][data-state="valid"]',
        );
        expect(globals).not.toContain(
            '[data-sot-key-status][data-state="invalid"]',
        );
        expect(toggleGroupPrimitive).not.toContain("settingsSegment");
        expect(toggleGroupPrimitive).not.toContain("settingsSegmentOption:");
        expect(toggleGroupPrimitive).not.toContain("settingsSegmentSpacing");
        for (const inputPrimitiveBusinessToken of [
            "sourceProviderDetail",
            "SOURCE_PROVIDER_DETAIL",
            "source-provider-detail",
            "settingsDetail",
        ]) {
            expect(inputPrimitive).not.toContain(inputPrimitiveBusinessToken);
        }
        expect(inputPrimitive).not.toMatch(/\bsettings\b/i);
        expect(inputPrimitive).not.toMatch(/\bsourceProvider\b/);
        expect(inputPrimitive).not.toContain("data-sot");
        expect(inputPrimitive).not.toContain("detail:");
        expect(inputPrimitive).not.toContain("max-w-[15rem]");
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
        expect(inputPrimitive).not.toContain("font-mono");
        expect(switchPrimitive).toContain('type SwitchVariant = "default"');
        expect(switchPrimitive).toContain('type SwitchSize = "sm" | "default"');
        expect(switchPrimitive).not.toContain('| "detail"');
        expect(switchPrimitive).not.toContain("detail:");
        expect(switchPrimitive).not.toContain("settingsDetail");
        expect(switchPrimitive).not.toMatch(/\bsettings\b/i);
        expect(switchPrimitive).not.toMatch(/\bsourceProvider\b/);
        expect(switchPrimitive).not.toContain("data-sot");
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
        expect(dataSources).toContain("checked={selectedSource.enabled}");
        expect(dataSources).toContain("disabled={interactionDisabled}");
        expect(dataSources).not.toContain("data-sot-");
        expect(inputPrimitive).not.toContain("data-sot-mask");
        expect(inputPrimitive).not.toContain("sourceProviderDetail");
        expect(switchPrimitive).not.toContain("sourceProviderDetail");
        expect(globals).not.toContain("sourceProviderSwitchClassName");
        expect(globals).not.toContain("SOURCE_PROVIDER_DETAIL_SWITCH_CLASS");
        expect(globals).not.toContain("data-sot-mask");
        expectOnlyAllowedGlobalSlotSelectors(globals);

        for (const target of SETTINGS_SOURCE_PROVIDER_GLOBAL_STYLE_TARGETS) {
            expect(
                collectSourceProviderGlobalStyleBlocks(globals, target),
                `${target.label} should keep source-provider styles in feature classes`,
            ).toEqual([]);
        }
    });

    it("keeps data-source P0 detail rows explicit, safe, and wired to real actions", () => {
        const settingsContent = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const dataSourcesPanel = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const presentation = readSource("lib/data-sources/presentation.ts");

        expect(dataSourcesPanel).toContain("自动更新");
        expect(dataSourcesPanel).toContain("每 15 分钟读取一次新录音");
        expect(dataSourcesPanel).not.toContain("data-sot-");
        expect(dataSourcesPanel).not.toContain("data-slot=");
        expect(dataSourcesPanel).toContain("标题更新回来源");
        expect(dataSourcesPanel).toContain("关闭后不再从此来源读取任何新录音");
        expect(dataSourcesPanel).toContain('label: "base URL"');
        expect(dataSourcesPanel).toContain('"钉钉 API 域名"');
        expect(dataSourcesPanel).toContain('"https://alidocs.dingtalk.com"');
        expect(dataSourcesPanel).toContain('"m@example.com · 浏览器授权登录"');
        expect(presentation).toContain('"最近更新 · 12 分钟前 · 112 条录音"');
        expect(presentation).toContain('"正在同步 · 已读取 12 / 48"');
        expect(presentation).toContain('"上次同步失败 · 2 小时前"');
        expect(presentation).toContain('"待设置 · 两种接入方式"');
        expect(presentation).toContain('"登录已过期"');
        expect(dataSourcesPanel).toContain(
            'selectedSource.provider !== "dingtalk-a1"',
        );
        expect(dataSourcesPanel).toContain("checked={selectedSource.enabled}");
        expect(dataSourcesPanel).toContain("disabled={interactionDisabled}");
        expect(dataSourcesPanel).toContain("handleTestSource(selectedSource)");
        expect(dataSourcesPanel).toContain("handleSaveSource(selectedSource)");
        expect(dataSourcesPanel).toContain("handleReconnectSource(");
        expect(dataSourcesPanel).toContain("handleDisconnectSource(");
        expect(dataSourcesPanel).toContain(
            'aria-busy={actionState === "testing"}',
        );
        expect(dataSourcesPanel).toContain(
            'aria-busy={actionState === "saving"}',
        );
        expect(dataSourcesPanel).toContain('"重新连接"');
        expect(dataSourcesPanel).toContain('"断开连接"');

        for (const bannedTerm of SETTINGS_PUBLIC_RAW_COPY_BLOCKERS) {
            expect(dataSourcesPanel).not.toContain(bannedTerm);
        }

        const authModeIndex = dataSourcesPanel.indexOf("<ToggleGroup");
        const serviceAddressIndex = dataSourcesPanel.indexOf(
            "displayedServiceAddress &&",
        );
        const primaryFieldsIndex =
            dataSourcesPanel.indexOf("primaryFields.map");
        const advancedFieldsIndex = dataSourcesPanel.indexOf(
            "advancedFields.length",
        );
        const autoUpdateIndex = dataSourcesPanel.indexOf("自动更新");
        const titleWritebackIndex = dataSourcesPanel.indexOf(
            "titleWritebackFields.map",
        );
        const enableSyncIndex = dataSourcesPanel.indexOf(
            "htmlFor={" + "`$" + "{selectedSource.provider}-enabled`}",
        );
        const footerIndex = dataSourcesPanel.indexOf("<footer");
        const reconnectRowIndex = dataSourcesPanel.indexOf(
            'aria-busy={\n                                            actionState === "reconnecting"',
        );
        const disconnectRowIndex = dataSourcesPanel.indexOf(
            'aria-busy={\n                                            actionState === "disconnecting"',
        );

        expect(authModeIndex).toBeGreaterThanOrEqual(0);
        expect(serviceAddressIndex).toBeGreaterThan(authModeIndex);
        expect(primaryFieldsIndex).toBeGreaterThan(serviceAddressIndex);
        expect(advancedFieldsIndex).toBeGreaterThan(primaryFieldsIndex);
        expect(autoUpdateIndex).toBeGreaterThan(advancedFieldsIndex);
        expect(titleWritebackIndex).toBeGreaterThan(autoUpdateIndex);
        expect(enableSyncIndex).toBeGreaterThan(titleWritebackIndex);
        expect(footerIndex).toBeGreaterThan(enableSyncIndex);
        expect(reconnectRowIndex).toBeGreaterThan(footerIndex);
        expect(disconnectRowIndex).toBeGreaterThan(reconnectRowIndex);

        const actionFooter =
            dataSourcesPanel.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "";
        const providerDetail =
            dataSourcesPanel.match(
                /<section[\s\S]*?id=\{SOURCE_PROVIDER_DETAIL_ID\}[\s\S]*?<\/section>/,
            )?.[0] ?? "";
        const providerDetailDividers = [
            ...providerDetail.matchAll(
                /<Separator[\s\S]*?className=\{[\s\S]*?SOURCE_PROVIDER_[A-Z_]+_DIVIDER_CLASS[\s\S]*?\/>/g,
            ),
        ].map((match) => match[0]);
        expect(providerDetail).toContain(
            "aria-labelledby={providerDetailTitleId}",
        );
        expect(providerDetail).toContain(
            "aria-busy={isSourceActionStateBusy(actionState)}",
        );
        expect(dataSourcesPanel).toContain(
            "const SOURCE_PROVIDER_SECTION_DIVIDER_CLASS =",
        );
        expect(dataSourcesPanel).toContain(
            "const SOURCE_PROVIDER_ACTION_CLUSTER_DIVIDER_CLASS =",
        );
        expect(dataSourcesPanel).not.toContain(
            "const SOURCE_PROVIDER_ACTION_CLUSTER_DIVIDER_CLASS = cn(",
        );
        expect(providerDetail).toContain("<Card");
        expect(providerDetail).toContain("<CardHeader");
        expect(providerDetail).toContain("<CardTitle");
        expect(providerDetail).toContain("<CardDescription");
        expect(providerDetail).toContain("<CardAction");
        expect(providerDetail).toContain("<CardContent");
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
        expect(actionFooter).toContain("actionMessage?.title ? (");
        expect(actionFooter).toContain("{actionMessage.title}");
        const sourceActionStatus = collectElementSlices(
            actionFooter,
            "state={actionMessage.state}",
            "SourceActionStatusBadge",
        )[0];
        expect(sourceActionStatus).toContain("<SourceActionStatusBadge");
        expect(sourceActionStatus).toContain("state={actionMessage.state}");
        expect(sourceActionStatus).not.toContain("sourceActionStatus");
        expect(sourceActionStatus).not.toContain('variant="secondary"');
        expect(sourceActionStatus).not.toContain("className=");
        expect(sourceActionStatus).not.toContain("showIndicator");
        expect(actionFooter).not.toContain("data-save-actions");
        expect(actionFooter).not.toContain("data-save-id");
        expect(actionFooter).not.toContain("data-save-state");
        expect(actionFooter).not.toContain("data-save-status");
        expect(actionFooter).not.toContain("data-save-test");
        expect(actionFooter).not.toContain("data-save-action");

        const stateBannerBlock =
            dataSourcesPanel.match(
                /\{shouldShowProviderStateBanner[\s\S]*?<ProviderStateBanner[\s\S]*?\/>\s*\)\s*:\s*null\}/,
            )?.[0] ?? "";
        const stateBannerHelper =
            dataSourcesPanel.match(
                /function shouldShowProviderStateBanner[\s\S]*?function getMissingConnectionFields/,
            )?.[0] ?? "";

        expect(stateBannerBlock).toContain("actionMessage");
        expect(stateBannerHelper).toContain("status.state");
        expect(stateBannerHelper).toContain('"connected"');
        expect(stateBannerHelper).toContain('"configured"');
        expect(stateBannerHelper).toContain('"needs-setup"');

        const globals = readSource("app/globals.css");
        expect(globals).not.toContain(
            '[data-sot-panel="source-provider-detail"] [data-sot-section-divider]',
        );
        expect(collectSourceActionGlobalBusinessBlocks(globals)).toEqual([]);
        for (const selector of REMOVED_SETTINGS_SAVE_ACTION_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(settingsContent).toContain("SETTINGS_SAVE_ACTIONS_CLASS");
        expect(settingsContent).not.toContain(
            "SETTINGS_SAVE_STATUS_BADGE_CLASS",
        );
        expect(globals).not.toContain('data-sot-actions="source-actions"');
    });

    it("scopes the settings raw copy scan to user-visible data-source copy", () => {
        const dataSourcesPanel = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );

        expect(dataSourcesPanel).toContain("const safeDescription = isZh");
        expect(dataSourcesPanel).toContain('["h", "ar"].join("")');
        expect(dataSourcesPanel).toContain(
            "const SOURCE_WEB_SIGN_IN_AUTH_MODE =",
        );
        expect(dataSourcesPanel).toMatch(
            /const SOURCE_WEB_SIGN_IN_AUTH_MODE = \["web", "reverse"\]\.join\(\s*"-",\s*\) as SourceAuthMode;/,
        );
        expect(dataSourcesPanel).not.toMatch(/\bfallback\b/);
        expect(dataSourcesPanel).not.toContain('["har"].join("")');
        expect(dataSourcesPanel).not.toContain('"web-reverse"');

        for (const blocker of SETTINGS_PUBLIC_RAW_COPY_BLOCKERS) {
            expect(dataSourcesPanel).not.toContain(blocker);
        }
    });

    it("keeps non-source settings panels connected to stores and save state boundaries", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const voscriptPanel = readSource(
            "features/settings/components/sections/voscript-section.tsx",
        );
        const dataSourcesPanel = readSource(
            "features/settings/components/sections/data-sources-section.tsx",
        );
        const displayPanel = content.match(
            /function DisplaySettingsPanel[\s\S]*?function TitleGenerationSettingsPanel/,
        )?.[0];
        const titleGenerationPanel = content.match(
            /function TitleGenerationSettingsPanel[\s\S]*?function TranscriptionSettingsPanel/,
        )?.[0];
        const denoiseOptions = voscriptPanel?.match(
            /const denoiseOptions:[\s\S]*?\];/,
        )?.[0];
        const transcriptionPanel = content.match(
            /function TranscriptionSettingsPanel[\s\S]*?function SyncSettingsRows/,
        )?.[0];
        const miscPanel = content.match(
            /function MiscSettingsPanel[\s\S]*?export function SettingsContent/,
        )?.[0];
        const playbackSettingsRows = content.match(
            /function PlaybackSettingsRows[\s\S]*?function MiscSettingsPanel/,
        )?.[0];
        const saveStatus = content.match(
            /function SaveStatus[\s\S]*?function SectionShell/,
        )?.[0];
        const saveActions = content.match(
            /function SaveActions[\s\S]*?function useResettingSaveState/,
        )?.[0];
        const settingsSaveAction = collectElementSlices(
            saveActions ?? "",
            "onClick={onSave}",
            "Button",
        )[0];
        const sectionTitleClass =
            content.match(
                /const SETTINGS_SECTION_TITLE_CLASS\s*=\s*"[^"]*";/,
            )?.[0] ?? "";
        const settingsRow =
            content.match(
                /function SettingsRow[\s\S]*?function SelectControl/,
            )?.[0] ?? "";
        const globals = readSource("app/globals.css");

        for (const section of [
            "appearance",
            "title-generation",
            "transcription",
            "misc",
        ]) {
            expect(content).toContain(`case "${section}"`);
            expect(content).toContain(`useSettingsSectionBusy("${section}"`);
        }
        expect(content).toContain(
            'import { VoScriptSection } from "./sections/voscript-section";',
        );
        expect(content).toContain('case "voscript"');
        expect(content).toContain(
            "return <VoScriptSection scrollRef={scrollRef} />;",
        );
        expect(voscriptPanel).toContain("export function VoScriptSection");
        expect(voscriptPanel).toContain("<SectionShell");
        expect(voscriptPanel).toContain("busy={busy}");
        expect(voscriptPanel).toContain(
            'title={isZh ? "VoScript 服务" : "VoScript Service"}',
        );
        expect(voscriptPanel).toContain("aria-label={title}");
        expect(voscriptPanel).toContain("aria-busy={busy}");
        expect(voscriptPanel).not.toContain("data-sot-");
        expect(voscriptPanel).not.toContain("data-slot=");
        for (const inlinedVoScriptToken of [
            "function VoScriptSettingsPanel",
            "function VoScriptSpeakerRows",
            "useVoScriptSettingsStore",
            "testVoScriptConnection",
            'data-sot-control="voscript-base-url"',
            'data-sot-panel="voscript-unavailable-banner"',
            "<SpeakerProfilesPanel />",
        ]) {
            expect(content).not.toContain(inlinedVoScriptToken);
        }
        expect(content).not.toContain('case "display"');
        expect(content).not.toContain('case "sync"');
        expect(content).not.toContain('case "playback"');

        expect(content).toContain("function SectionShell");
        expect(content).toContain("aria-busy={busy}");
        expect(voscriptPanel).toContain('id="voscript-connection-status"');
        expect(voscriptPanel).toMatch(
            /connectionTestState === "test-error"[\s\S]*?"alert"[\s\S]*?"status"/,
        );
        expect(voscriptPanel).toMatch(
            /connectionTestState === "test-error"[\s\S]*?"assertive"[\s\S]*?"polite"/,
        );
        expect(content).not.toContain('className="settings-main"');
        expect(sectionTitleClass).toContain("SETTINGS_SECTION_TITLE_CLASS");
        for (const semanticClassToken of [
            "mb-[18px]",
            "text-lg",
            "font-semibold",
            "text-foreground",
        ]) {
            expect(sectionTitleClass).toContain(semanticClassToken);
        }
        for (const removedOwnerClassToken of [
            "[margin:0_0_18px]",
            "font-display",
            "text-[18px]",
            "leading-[normal]",
            "tracking-[-0.012em]",
            "text-[var(--fg-primary)]",
        ]) {
            expect(sectionTitleClass).not.toContain(removedOwnerClassToken);
        }
        expect(content).toContain("className={SETTINGS_SECTION_TITLE_CLASS}");
        expect(content).toContain(
            "<h3 className={SETTINGS_SECTION_TITLE_CLASS}>{title}</h3>",
        );
        for (const selector of REMOVED_SETTINGS_TITLE_DIVIDER_VISUAL_DATA_SOT_CSS_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(content).toContain('from "@/components/ui/field";');
        expect(content).toContain("function SettingsRow");
        expect(content).toContain("<Field");
        expect(content).toContain("<FieldContent");
        expect(content).toContain("<FieldTitle>{label}</FieldTitle>");
        expect(content).toContain(
            "<FieldDescription>{description}</FieldDescription>",
        );
        expect(content).not.toContain("sotField");
        expect(content).not.toContain("data-sot-");
        expect(settingsRow).toContain("{fieldMessage ? <FieldError>");
        expect(settingsRow).toContain("<FieldError");
        expect(settingsRow).toContain("className={SETTINGS_FIELD_ROW_CLASS}");
        expect(settingsRow).toContain(
            "className={SETTINGS_FIELD_CONTENT_CLASS}",
        );
        expect(settingsRow).toContain(
            "className={SETTINGS_FIELD_CONTROL_CLASS}",
        );
        expect(settingsRow).not.toContain('variant="settingsRow"');
        expect(settingsRow).not.toContain('variant="settingsControl"');
        expect(content).toContain(
            'data-invalid={fieldState === "invalid" ? "true" : undefined}',
        );
        expect(content).not.toContain("sm-section-title");
        expect(content).not.toContain("sm-row-name");
        expect(content).toContain("function SaveActions");
        expect(saveStatus).toContain("id={statusId}");
        expect(saveStatus).toContain("variant={statusVariant}");
        expect(saveStatus).not.toContain('variant="ghost"');
        expect(saveStatus).not.toContain("SETTINGS_SAVE_STATUS_BADGE_CLASS");
        expect(saveStatus).toContain("role={statusRole}");
        expect(saveStatus).toContain("aria-live={statusLive}");
        expect(saveStatus).toContain(
            'aria-atomic={isIdle ? undefined : "true"}',
        );
        expect(saveStatus).not.toContain("data-sot-");
        expect(saveActions).toContain(
            "<div className={SETTINGS_SAVE_ACTIONS_CLASS}>",
        );
        expect(saveActions).toContain(
            "className={SETTINGS_SAVE_ACTIONS_CLASS}",
        );
        expect(saveActions).toContain(
            `const statusId = \`\${saveId ?? section}-save-status\`;`,
        );
        expect(saveActions).toContain("statusId={statusId}");
        expect(saveActions).toContain("disabled={disabled}");
        expect(saveActions).toContain('aria-busy={saveState === "saving"}');
        expect(saveActions).toContain(
            'aria-describedby={saveState === "idle" ? undefined : statusId}',
        );
        expect(saveActions).toContain("aria-label={saveButtonLabel}");
        expect(saveActions).toContain("onClick={onSave}");
        expect(saveActions).not.toContain("data-sot-");
        expect(saveActions).toContain('variant="default"');
        expect(saveActions).not.toContain('variant="settingsSave"');
        expect(saveActions).not.toContain('size="settingsSave"');
        expect(settingsSaveAction).toContain("<Spinner");
        expect(settingsSaveAction).toContain('data-icon="inline-start"');
        expect(settingsSaveAction).not.toContain("<LoaderCircle");
        expect(settingsSaveAction).not.toContain('className="animate-spin"');
        expect(content).toContain('id="transcription-auto-transcribe"');
        for (const directControl of [
            "voscript-min-speakers",
            "voscript-max-speakers",
            "voscript-base-url",
            "voscript-api-key",
            "voscript-snr-threshold",
            "voscript-no-repeat-ngram",
            "voscript-max-inflight-jobs",
        ]) {
            expect(voscriptPanel).toContain(`id="${directControl}"`);
        }
        expect(voscriptPanel).toContain(
            "aria-describedby={getFieldDescribedBy(",
        );
        expect(voscriptPanel).toContain("disabled={busy}");
        expect(content).toContain('id="transcription-language"');
        for (const selectControl of [
            "voscript-api-key-mode",
            "voscript-denoise-model",
        ]) {
            expect(voscriptPanel).toContain(`id="${selectControl}"`);
        }
        expect(voscriptPanel).toContain("describedBy={getFieldDescribedBy(");
        expect(titleGenerationPanel).not.toContain("data-sot-");
        expect(titleGenerationPanel).toContain("<Switch");
        expect(titleGenerationPanel).toContain('id="title-generation-enabled"');
        expect(titleGenerationPanel).toContain(
            "aria-label={\n                            isZh",
        );
        expect(titleGenerationPanel).toContain(
            'isZh ? "重命名服务地址" : "Rename service URL"',
        );
        expect(titleGenerationPanel).toContain(
            '? "基于逐字稿自动重命名"\n                                : "Automatically rename from transcripts"',
        );
        expect(titleGenerationPanel).toContain(
            "checked={draft.autoGenerateTitle}",
        );
        expect(titleGenerationPanel).toContain("disabled={busy}");
        expect(titleGenerationPanel).toContain("onCheckedChange={(checked)");
        for (const inputId of [
            "title-generation-base-url",
            "title-generation-model",
            "title-generation-api-key",
        ]) {
            expect(titleGenerationPanel).toContain(`id="${inputId}"`);
        }
        expect(titleGenerationPanel).toContain(
            'aria-label={isZh ? "重命名模型" : "Rename model"}',
        );
        expect(titleGenerationPanel).toContain(': "Rename service API key"');
        expect(titleGenerationPanel).toContain('type="password"');
        expect(titleGenerationPanel).toContain("value={apiKeyDraft}");
        expect(titleGenerationPanel).not.toContain(
            "value={draft.titleGenerationApiKey}",
        );
        expect(titleGenerationPanel).toContain(
            'const [apiKeyDraft, setApiKeyDraft] = useState("")',
        );
        expect(titleGenerationPanel).toContain('setApiKeyDraft("")');
        expect(titleGenerationPanel).toContain(
            '<Badge variant="secondary" role="status">',
        );
        expect(transcriptionPanel).toContain("checked={draft.autoTranscribe}");
        expect(transcriptionPanel).toContain("disabled={busy}");
        expect(titleGenerationPanel).toContain(
            "draft.titleGenerationApiKeySet",
        );
        expect(voscriptPanel).toContain("draft.privateTranscriptionApiKeySet");
        expect(voscriptPanel).toContain('id="voscript-api-key-status"');
        expect(voscriptPanel).toContain('role="status"');
        expect(voscriptPanel).toContain('aria-live="polite"');
        expect(voscriptPanel).toContain("noRepeatNgramInvalid");
        expect(voscriptPanel).toContain("minSpeakersInvalid");
        expect(voscriptPanel).toContain("maxSpeakersInvalid");
        expect(content).toContain('id="display-items-per-page"');
        expect(voscriptPanel).toContain(
            'statusId="voscript-connection-save-status"',
        );
        expect(voscriptPanel).toContain(
            'statusId="voscript-params-save-status"',
        );
        expect(voscriptPanel).toContain("saveTarget={");
        const voscriptTestAction = collectElementSlices(
            voscriptPanel,
            "onClick={() => void testConnection()}",
            "Button",
        )[0];
        expect(voscriptTestAction).toContain('variant="ghost"');
        expect(voscriptTestAction).not.toContain(
            'variant="settingsTestAction"',
        );
        expect(voscriptTestAction).not.toContain('size="settingsTestAction"');
        expect(voscriptTestAction).toContain("<Spinner");
        expect(voscriptTestAction).toContain('data-icon="inline-start"');
        expect(voscriptTestAction).toContain("aria-busy={isTestingConnection}");
        expect(voscriptTestAction).toContain("aria-describedby={");
        expect(voscriptTestAction).toContain("aria-label={");
        expect(voscriptTestAction).toContain("disabled={busy}");
        expect(voscriptTestAction).not.toContain("<LoaderCircle");
        expect(voscriptTestAction).not.toContain('className="animate-spin"');
        for (const legacySaveHook of [
            "data-save-actions",
            "data-save-id",
            "data-save-state",
            "data-save-status",
            "data-save-action",
            "data-save-test",
        ]) {
            expect(content).not.toContain(legacySaveHook);
            expect(voscriptPanel).not.toContain(legacySaveHook);
        }
        const voscriptUnavailableBanner =
            voscriptPanel?.match(
                /<Alert\s+id="voscript-connection-status"[\s\S]*?>/,
            )?.[0] ?? "";
        expect(voscriptUnavailableBanner).toContain(
            'id="voscript-connection-status"',
        );
        expect(voscriptUnavailableBanner).toContain('density="comfortable"');
        expect(voscriptUnavailableBanner).toContain("variant={");
        expect(voscriptUnavailableBanner).toContain(
            "className={SETTINGS_BANNER_BASE_CLASS}",
        );
        expect(voscriptUnavailableBanner).not.toContain("className={cn(");
        expect(voscriptUnavailableBanner).toContain(
            'connectionTestState === "test-error"',
        );
        expect(voscriptUnavailableBanner).toContain("role={");
        expect(voscriptUnavailableBanner).toContain("aria-live={");
        expect(content).not.toContain("SETTINGS_BANNER_WARNING_CLASS");
        expect(voscriptUnavailableBanner).not.toContain(
            'variant="settingsVoScriptWarning"',
        );
        expect(voscriptUnavailableBanner).not.toContain(
            'density="settingsBanner"',
        );
        expect(voscriptUnavailableBanner).not.toContain(
            "border-destructive/30 bg-destructive/10",
        );
        for (const legacyVoScriptHook of [
            "data-voscript-availability",
            "data-voscript-unavail",
        ]) {
            expect(voscriptPanel).not.toContain(legacyVoScriptHook);
            expect(globals).not.toContain(legacyVoScriptHook);
        }
        expect(voscriptPanel).toContain('id="voscript-no-repeat-ngram"');
        expect(content).not.toContain("data-field=");
        expect(content).not.toContain("data-field-state");
        expect(content).not.toContain("data-field-msg");
        expect(voscriptPanel).not.toContain("data-field=");
        expect(voscriptPanel).not.toContain("data-field-state");
        expect(voscriptPanel).not.toContain("data-field-msg");
        expect(voscriptPanel).toContain("isVoScriptNoRepeatNgramInvalid");
        expect(voscriptPanel).toContain("testVoScriptConnection");
        expect(content).toContain("useDisplaySettingsStore");
        expect(content).toContain("useTitleGenerationSettingsStore");
        expect(voscriptPanel).toContain("useVoScriptSettingsStore");
        expect(content).toContain("useTranscriptionSettingsStore");
        expect(content).toContain("useSyncSettingsStore");
        expect(content).toContain("usePlaybackSettingsStore");
        expect(content).toContain("updateDisplaySettings");
        expect(content).toContain("updateTitleGenerationSettings");
        expect(voscriptPanel).toContain("updateVoScriptSettings");
        for (const ownerBehaviorToken of [
            "useState<VoScriptSettings>(settings)",
            'useState<VoScriptConnectionTestState>("idle")',
            "const connectionSave = useResettingSaveState()",
            "const paramsSave = useResettingSaveState()",
            "const pendingSaveLaneRef = useRef<VoScriptSettingsSaveLane | null>(null)",
            'useSettingsSectionBusy("voscript", busy)',
            "const persistVoScriptSettingsLane = async",
            "const saveConnectionSettings = async",
            "const saveRuntimeParams = async",
            "await updateVoScriptSettings(updates)",
            "const testConnection = async",
            "await testVoScriptConnection({",
            "result.available && result.success",
            "result.voiceprintCount > 0",
            "const showUnavailableBanner =",
            "!hasConnectionBaseUrl",
            "!hasConnectionApiKey",
            'connectionTestState === "test-error"',
        ]) {
            expect(voscriptPanel).toContain(ownerBehaviorToken);
        }
        expect(content).toContain("updateTranscriptionSettings");
        expect(content).toContain("updateSyncSettings");
        expect(content).toContain("updatePlaybackSettings");
        expect(content).toContain("MIN_SYNC_INTERVAL_SECONDS");
        expect(content).toContain("PLAYBACK_SPEED_OPTIONS");
        expect(content).not.toMatch(OLD_UI_RE);
        expect(voscriptPanel).not.toMatch(OLD_UI_RE);

        expect(displayPanel).not.toContain("<SaveActions");
        expect(displayPanel).not.toContain('saveId="appearance"');
        expect(displayPanel).not.toContain("data-save-action");
        expect(displayPanel).not.toContain("sm-actions-state");
        expect(titleGenerationPanel).toContain("<SaveActions");
        expect(titleGenerationPanel).toContain('saveId="title-generation"');
        expect(voscriptPanel).toContain("<SaveActions");
        expect(voscriptPanel).toContain(
            'import { SpeakerProfilesPanel } from "@/features/settings/components/sections/speaker-profiles-panel";',
        );
        expect(voscriptPanel).toContain("<SpeakerProfilesPanel />");
        expect(denoiseOptions).toMatch(/label:\s*"不降噪",\s*value:\s*"none"/);
        expect(denoiseOptions).toMatch(
            /label:\s*"DeepFilterNet",\s*value:\s*"deepfilternet"/,
        );
        expect(denoiseOptions).toMatch(
            /label:\s*"noisereduce",\s*value:\s*"noisereduce"/,
        );
        expect(denoiseOptions).not.toContain('"关闭"');
        expect(denoiseOptions).not.toContain('"Noisereduce"');
        expect(dataSourcesPanel).toContain(
            '<footer className="flex items-center justify-start gap-2">',
        );
        expect(dataSourcesPanel).toContain(
            'role={state.endsWith("error") ? "alert" : "status"}',
        );
        expect(dataSourcesPanel).toContain(
            'aria-live={state.endsWith("error") ? "assertive" : "polite"}',
        );
        expect(dataSourcesPanel).toContain('tone="neutral"');
        expect(dataSourcesPanel).toContain('tone="primary"');
        expect(dataSourcesPanel).toContain(
            'aria-busy={actionState === "testing"}',
        );
        expect(dataSourcesPanel).toContain(
            'aria-busy={actionState === "saving"}',
        );
        expect(dataSourcesPanel).toContain("handleTestSource(selectedSource)");
        expect(dataSourcesPanel).toContain("handleSaveSource(selectedSource)");
        expect(dataSourcesPanel).not.toContain("data-sot-");
        expect(dataSourcesPanel).not.toContain("data-ds-enable");
        expect(dataSourcesPanel).not.toContain('data-save-actions=""');
        expect(dataSourcesPanel).not.toMatch(
            /data-save-id=\{`ds-\$\{selectedSource\.provider\}`\}/,
        );
        expect(dataSourcesPanel).not.toContain('data-save-test=""');
        expect(dataSourcesPanel).not.toContain('data-save-action=""');
        expect(dataSourcesPanel).not.toContain("data-save-status");
        expect(miscPanel).not.toContain("<SaveActions");
        expect(miscPanel).not.toContain('saveId="misc"');
        expect(miscPanel).not.toContain("data-save-action");
        expect(miscPanel).not.toContain("sm-actions-state");
        expect(miscPanel).toContain("updateSyncSettings({");
        expect(miscPanel).toContain("autoSyncEnabled: checked");
        expect(miscPanel).toContain("onSyncIntervalBlur");
        expect(miscPanel).toContain("syncIntervalSeconds: normalizedInterval");
        expect(miscPanel).toContain("updatePlaybackSettings({");
        expect(miscPanel).toContain(
            "defaultPlaybackSpeed: defaultPlaybackSpeed",
        );
        expect(miscPanel).toContain("defaultVolume: defaultVolume");
        expect(miscPanel).toContain("autoPlayNext: checked");
        expect(playbackSettingsRows).toContain("当前录音结束后自动播放下一条");
        expect(playbackSettingsRows).not.toContain(
            "当前录音结束后自动播放下一条。",
        );
        expect(transcriptionPanel).toContain(
            "function TranscriptionSettingsPanel",
        );
        expect(transcriptionPanel).toContain("updateTranscriptionSettings({");
        expect(transcriptionPanel).toContain("autoTranscribe: checked");
        expect(transcriptionPanel).toMatch(
            /defaultTranscriptionLanguage:\s*nullableText\(\s*value,?\s*\)/,
        );
        expect(transcriptionPanel).not.toContain("<SaveActions");
        expect(transcriptionPanel).not.toContain("data-save-action");
        expect(transcriptionPanel).not.toContain("saveState");
        expect(transcriptionPanel).not.toContain("sm-actions-state");
    });

    it("keeps VoScript no-repeat n-gram validation in its owner before persistence", () => {
        const voscriptPanel = readSource(
            "features/settings/components/sections/voscript-section.tsx",
        );
        const saveFunction = voscriptPanel?.match(
            /const saveRuntimeParams = async[\s\S]*?const testConnection = async/,
        )?.[0];
        const settingsRow =
            voscriptPanel.match(
                /function SettingsRow[\s\S]*?function SelectControl/,
            )?.[0] ?? "";
        const noRepeatRow =
            collectElementSlices(
                voscriptPanel,
                'id="voscript-no-repeat-ngram"',
                "SettingsRow",
            )[0] ?? "";

        expect(voscriptPanel).toContain(
            "function isVoScriptNoRepeatNgramInvalid",
        );
        expect(voscriptPanel).toContain("const saveRuntimeParams = async");
        expect(voscriptPanel).toContain(
            "draft.privateTranscriptionNoRepeatNgramSize > 0",
        );
        expect(voscriptPanel).toContain(
            "draft.privateTranscriptionNoRepeatNgramSize < 3",
        );
        expect(voscriptPanel).toContain(
            'const noRepeatNgramMessage = "只支持 0 或 ≥ 3"',
        );
        expect(noRepeatRow).toContain('id="voscript-no-repeat-ngram"');
        expect(noRepeatRow).toContain(
            'fieldState={noRepeatNgramInvalid ? "invalid" : undefined}',
        );
        expect(noRepeatRow).toContain("aria-invalid={noRepeatNgramInvalid}");
        expect(noRepeatRow).toContain("fieldMessage={");
        expect(noRepeatRow).toContain("noRepeatNgramMessage");
        expect(noRepeatRow).toContain("aria-describedby={getFieldDescribedBy(");
        expect(noRepeatRow).toContain("disabled={busy}");
        expect(settingsRow).toContain(
            "<FieldLabel htmlFor={id}>{label}</FieldLabel>",
        );
        expect(settingsRow).toMatch(/id=\{`\$\{id\}-description`\}/);
        expect(settingsRow).toMatch(/id=\{`\$\{id\}-error`\}/);
        expect(settingsRow).toContain(
            'data-invalid={fieldState === "invalid" ? "true" : undefined}',
        );
        expect(settingsRow).not.toContain("data-sot-");
        expect(settingsRow).toContain("{fieldMessage}");
        expect(noRepeatRow).toContain('placeholder={isZh ? "0 或 ≥ 3"');
        expect(saveFunction).toContain("if (noRepeatNgramInvalid)");
        expect(saveFunction).toContain('paramsSave.setSaveState("error")');
        expect(saveFunction).toContain("paramsSave.setSaveError");
        expect(saveFunction).toContain("noRepeatNgramMessage");
        expect(saveFunction).toContain("return;");
        expect(saveFunction).toMatch(
            /if \(noRepeatNgramInvalid\)[\s\S]*?return;[\s\S]*?const draftBeforeSave = \{ \.\.\.draft \};[\s\S]*?const updates: VoScriptSettingsUpdate/,
        );
        expect(saveFunction).toMatch(
            /await persistVoScriptSettingsLane\(\s*paramsSave,\s*"params",\s*updates,/,
        );
    });

    it("keeps VoScript speaker bounds validation in its owner before persistence", () => {
        const voscriptPanel = readSource(
            "features/settings/components/sections/voscript-section.tsx",
        );
        const speakerRows = voscriptPanel.match(
            /function VoScriptSpeakerRows[\s\S]*?export function VoScriptSection/,
        )?.[0];
        const saveFunction = voscriptPanel?.match(
            /const saveRuntimeParams = async[\s\S]*?const testConnection = async/,
        )?.[0];
        const settingsRow =
            voscriptPanel.match(
                /function SettingsRow[\s\S]*?function SelectControl/,
            )?.[0] ?? "";
        const minSpeakersRow =
            collectElementSlices(
                speakerRows ?? "",
                'id="voscript-min-speakers"',
                "SettingsRow",
            )[0] ?? "";
        const maxSpeakersRow =
            collectElementSlices(
                speakerRows ?? "",
                'id="voscript-max-speakers"',
                "SettingsRow",
            )[0] ?? "";
        const speakerBoundsGuard = saveFunction?.match(
            /if \(resolvedSpeakerBoundsMessage\)[\s\S]*?return;/,
        )?.[0];

        expect(voscriptPanel).toContain(
            'const speakerBoundsMessage = "不能为负数"',
        );
        expect(voscriptPanel).toContain(
            'const speakerRangeMessage = "最多说话人数必须 ≥ 最少说话人数"',
        );
        expect(voscriptPanel).toContain(
            "draft.privateTranscriptionMinSpeakers < 0",
        );
        expect(voscriptPanel).toContain(
            "draft.privateTranscriptionMaxSpeakers < 0",
        );
        expect(voscriptPanel).toContain(
            "draft.privateTranscriptionMaxSpeakers > 0",
        );
        expect(voscriptPanel).toMatch(
            /draft\.privateTranscriptionMaxSpeakers\s*<\s*draft\.privateTranscriptionMinSpeakers/,
        );
        expect(voscriptPanel).toContain(
            "const minSpeakersInvalid = minSpeakersNegative",
        );
        expect(voscriptPanel).toContain(
            "const maxSpeakersInvalid = maxSpeakersNegative || speakerRangeInvalid",
        );
        expect(voscriptPanel).toContain("const minSpeakersMessage =");
        expect(voscriptPanel).toContain("const maxSpeakersMessage =");
        expect(voscriptPanel).toMatch(
            /const resolvedSpeakerBoundsMessage\s*=\s*minSpeakersMessage\s*\?\?\s*maxSpeakersMessage/,
        );
        expect(minSpeakersRow).toContain('id="voscript-min-speakers"');
        expect(minSpeakersRow).toContain(
            'fieldState={minSpeakersInvalid ? "invalid" : undefined}',
        );
        expect(minSpeakersRow).toContain("fieldMessage={minSpeakersMessage}");
        expect(minSpeakersRow).toContain("aria-invalid={minSpeakersInvalid}");
        expect(minSpeakersRow).toContain(
            "aria-describedby={getFieldDescribedBy(",
        );
        expect(minSpeakersRow).toContain("disabled={busy}");
        expect(maxSpeakersRow).toContain('id="voscript-max-speakers"');
        expect(maxSpeakersRow).toContain(
            'fieldState={maxSpeakersInvalid ? "invalid" : undefined}',
        );
        expect(maxSpeakersRow).toContain("fieldMessage={maxSpeakersMessage}");
        expect(maxSpeakersRow).toContain("aria-invalid={maxSpeakersInvalid}");
        expect(maxSpeakersRow).toContain(
            "aria-describedby={getFieldDescribedBy(",
        );
        expect(maxSpeakersRow).toContain("disabled={busy}");
        expect(settingsRow).toContain(
            "<FieldLabel htmlFor={id}>{label}</FieldLabel>",
        );
        expect(settingsRow).toMatch(/id=\{`\$\{id\}-description`\}/);
        expect(settingsRow).toMatch(/id=\{`\$\{id\}-error`\}/);
        expect(settingsRow).toContain(
            'data-invalid={fieldState === "invalid" ? "true" : undefined}',
        );
        expect(settingsRow).not.toContain("data-sot-");
        expect(speakerBoundsGuard).toContain(
            'paramsSave.setSaveState("error")',
        );
        expect(speakerBoundsGuard).toContain(
            "paramsSave.setSaveError(resolvedSpeakerBoundsMessage)",
        );
        expect(saveFunction).toMatch(
            /if \(resolvedSpeakerBoundsMessage\)[\s\S]*?return;[\s\S]*?const draftBeforeSave = \{ \.\.\.draft \};[\s\S]*?const updates: VoScriptSettingsUpdate[\s\S]*?await persistVoScriptSettingsLane\(\s*paramsSave,\s*"params",\s*updates,/,
        );
    });

    it("removes legacy SettingsRow field hooks from settings content", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );

        expect(content).not.toContain("data-field=");
        expect(content).not.toContain("data-field-state");
        expect(content).not.toContain("data-field-msg");
    });

    it("keeps appearance segmented controls on SOT-facing aliases without changing saved values", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const segmentControl = content.match(
            /function SegmentControl[\s\S]*?function SaveActions/,
        )?.[0];
        const segmentItems =
            segmentControl?.match(/<ToggleGroupItem\b[^>]*>/g) ?? [];
        const themeOptions = content.match(
            /const themeOptions:[\s\S]*?const languageOptions:/,
        )?.[0];
        const dateTimeOptions = content.match(
            /const dateTimeOptions:[\s\S]*?const densityOptions:/,
        )?.[0];
        const densityOptions = content.match(
            /const densityOptions:[\s\S]*?const sortOptions:/,
        )?.[0];

        expect(content).not.toContain("data-seg=");
        expect(content).not.toContain("data-v=");
        expect(segmentControl).toContain(
            'aria-disabled={disabled ? "true" : "false"}',
        );
        expect(segmentControl).toContain("aria-label={label}");
        expect(segmentControl).toContain(
            "className={SETTINGS_SEGMENT_GROUP_CLASS}",
        );
        expect(segmentControl).toContain('variant="outline"');
        expect(segmentControl).toContain('size="sm"');
        expect(segmentControl).toContain("spacing={1}");
        expect(content).not.toContain("SETTINGS_SEGMENT_OPTION_CLASS");
        expect(segmentItems).toHaveLength(1);
        for (const segmentItem of segmentItems) {
            expect(segmentItem).toContain("value={option.value}");
            expect(segmentItem).toContain("disabled={disabled}");
            expect(segmentItem).not.toContain("className=");
            expect(segmentItem).not.toMatch(/\bvariant=/);
            expect(segmentItem).not.toMatch(/\bsize=/);
            expect(segmentItem).not.toContain("settingsSegment");
        }
        expect(segmentControl).toContain("value={option.value}");
        expect(themeOptions).toMatch(
            /label:\s*isZh \? "自动" : "Auto",\s*value:\s*"system"/,
        );
        expect(themeOptions).toContain('value: "light"');
        expect(themeOptions).toContain('value: "dark"');
        expect(dateTimeOptions).toMatch(
            /label:\s*isZh \? "2 小时前" : "2 hours ago",\s*value:\s*"relative"/,
        );
        expect(dateTimeOptions).toMatch(
            /label:\s*"14:00",\s*value:\s*"absolute"/,
        );
        expect(densityOptions).toContain('value: "comfy"');
        expect(densityOptions).toContain('value: "compact"');
        expect(content).toContain('persistDisplaySetting("theme", value)');
        expect(content).toContain(
            'persistDisplaySetting("dateTimeFormat", value)',
        );
        expect(content).toContain(
            'persistDisplaySetting("displayDensity", value)',
        );
        expect(content).toMatch(
            /persistDisplaySetting\(\s*"uiLanguage",\s*value\s+as\s+UiLanguage,?\s*\)/,
        );
        expect(content).toMatch(
            /persistDisplaySetting\(\s*"itemsPerPage",\s*nextItemsPerPage,?\s*\)/,
        );
        expect(content).not.toContain('theme: "auto"');
        expect(content).not.toContain('dateTimeFormat: "rel"');
        expect(content).not.toContain('dateTimeFormat: "abs"');
    });

    it("keeps VoScript max inflight save payload aligned with unlimited zero semantics", () => {
        const voscript = readSource(
            "features/settings/components/sections/voscript-section.tsx",
        );
        const maxInflightClamp = voscript.match(
            /privateTranscriptionMaxInflightJobs:\s*clampInteger\(\s*draft\.privateTranscriptionMaxInflightJobs,\s*(\d+),\s*(\d+),\s*\)/,
        );

        expect(maxInflightClamp?.slice(1)).toEqual(["0", "20"]);
    });

    it("keeps section load failures on shadcn Alert banners", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const sectionLoadErrorBanner = content.match(
            /<Alert\s[^>]*data-sot-banner="settings-section-load-error"[^>]*data-sot-panel="settings-section-load-error"[^>]*data-sot-section=\{section\}[^>]*>/,
        )?.[0];

        expect(sectionLoadErrorBanner).toBeUndefined();
        const semanticSectionLoadErrorBanner = content.match(
            /<Alert\s+variant="destructiveSoft"[\s\S]*?<\/Alert>/,
        )?.[0];
        const semanticSectionLoadRetryButton =
            semanticSectionLoadErrorBanner?.match(
                /<Button[\s\S]*?onClick=\{onRetry\}[\s\S]*?<\/Button>/,
            )?.[0];
        expect(semanticSectionLoadErrorBanner ?? "").toContain(
            'variant="destructiveSoft"',
        );
        expect(semanticSectionLoadErrorBanner ?? "").toContain(
            'density="comfortable"',
        );
        expect(semanticSectionLoadErrorBanner ?? "").toContain(
            "className={SETTINGS_BANNER_BASE_CLASS}",
        );
        expect(semanticSectionLoadErrorBanner ?? "").not.toContain(
            "SETTINGS_BANNER_ACTION_LAYOUT_CLASS",
        );
        expect(sectionLoadErrorBanner ?? "").not.toContain(
            "SETTINGS_BANNER_ERROR_CLASS",
        );
        expect(sectionLoadErrorBanner ?? "").not.toContain(
            'variant="settingsLoadError"',
        );
        expect(sectionLoadErrorBanner ?? "").not.toContain(
            'density="settingsBanner"',
        );
        expect(sectionLoadErrorBanner ?? "").not.toContain(
            "grid-cols-[auto_1fr",
        );
        expect(sectionLoadErrorBanner ?? "").not.toContain(
            "border-destructive/30 bg-destructive/10",
        );
        expect(sectionLoadErrorBanner ?? "").not.toMatch(/\srole=/);
        expect(semanticSectionLoadRetryButton).toContain('variant="default"');
        expect(semanticSectionLoadRetryButton).toContain("onClick={onRetry}");
        expect(content).not.toContain('variant="settingsSectionRetry"');
        expect(content).not.toContain('size="settingsSectionRetry"');
    });

    it("keeps speaker profile and voiceprint management live without old UI surfaces", () => {
        const speakers = readSource(
            "features/settings/components/sections/speaker-profiles-panel.tsx",
        );
        const globals = readSource("app/globals.css");
        const avatarPrimitive = readSource("components/ui/avatar.tsx");
        const badgePrimitive = readSource("components/ui/badge.tsx");
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const fieldPrimitive = readSource("components/ui/field.tsx");
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const emptyPrimitive = readSource("components/ui/empty.tsx");
        const avatarFallbacks =
            speakers.match(/<AvatarFallback\b[^>]*>/g) ?? [];
        const speakerStateBadges = speakers.match(/<Badge\b[^>]*>/g) ?? [];
        const speakerRowFields =
            speakers.match(
                /<Field(?!Content|Control|Description|Label|Title)\b[^>]*>/g,
            ) ?? [];
        const speakerStateBadgeOpenings = speakerStateBadges;
        const statePill =
            speakers.match(
                /function StatePill[\s\S]*?function PanelNotice/,
            )?.[0] ?? "";
        const panelNotice =
            speakers.match(
                /function PanelNotice[\s\S]*?export function SpeakerProfilesPanel/,
            )?.[0] ?? "";
        const speakerRowItemClass =
            speakers.match(
                /const speakerRowItemClassName\s*=\s*"[^"]*";/,
            )?.[0] ?? "";
        const speakerProfilesPanelClass = findStringConstInitializerContaining(
            speakers,
            ["speakerProfilesPanelClassName", "relative flex flex-col gap-2"],
        );
        const speakerProfileNameField =
            collectElementSlices(speakers, "profileNameInputId", "Field")[0] ??
            "";
        const speakerVoiceprintNameField =
            collectElementSlices(
                speakers,
                "voiceprintNameInputId",
                "Field",
            )[0] ?? "";
        const speakerButtons =
            speakers.match(/<Button\b[\s\S]*?<\/Button>/g) ?? [];
        const speakerProfileEmptyState = collectElementSlices(
            speakers,
            'role="status"',
            "Empty",
        ).slice(0, 1);
        const speakerVoiceprintsEmptyState = collectElementSlices(
            speakers,
            'role="status"',
            "Empty",
        ).slice(1);
        const findButtonByControl = (control: string) => {
            const snippets: Record<string, string> = {
                "speaker-profiles-refresh": "refreshProfiles",
                "speaker-profile-create": "handleCreate",
                "speaker-profiles-retry": "refreshProfiles",
                "speaker-profile-save": "handleUpdate(profile)",
                "speaker-voiceprints-refresh": "refreshVoiceprints",
                "speaker-voiceprints-retry": "refreshVoiceprints",
                "speaker-voiceprint-rename":
                    "handleRenameVoiceprint(voiceprint)",
                "speaker-profile-delete": "handleDelete(profile)",
                "speaker-voiceprint-delete":
                    "handleDeleteVoiceprint(voiceprint)",
            };
            return (
                speakerButtons.find((button) =>
                    button.includes(snippets[control] ?? ""),
                ) ?? ""
            );
        };
        const expectFeatureOwnedSnippets = (
            label: string,
            snippets: readonly string[],
        ) => {
            for (const snippet of snippets) {
                expect(
                    speakers,
                    `${label} should keep ${snippet} in the speaker profiles feature owner`,
                ).toContain(snippet);
            }
        };
        const expectNeutralButtonContract = (control: string) => {
            const button = findButtonByControl(control);

            expect(button).toContain('variant="outline"');
            expect(button).toContain('size="sm"');
            expect(button).not.toContain('variant="speakerSettingsAction"');
            expect(button).not.toContain(
                'variant="speakerSettingsDangerAction"',
            );
            expect(button).not.toContain('size="speakerSettingsAction"');
            expect(button).not.toContain('className="btn"');
            expect(button).not.toContain('className="btn danger"');
        };
        const expectDangerButtonContract = (control: string) => {
            const button = findButtonByControl(control);

            expect(button).toContain('variant="destructive"');
            expect(button).toContain('size="sm"');
            expect(button).not.toContain('variant="speakerSettingsAction"');
            expect(button).not.toContain(
                'variant="speakerSettingsDangerAction"',
            );
            expect(button).not.toContain('size="speakerSettingsAction"');
            expect(button).not.toContain('className="btn"');
            expect(button).not.toContain('className="btn danger"');
        };

        expect(speakers).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(speakers).toContain(
            'import { Badge } from "@/components/ui/badge";',
        );
        expect(speakers).toContain(
            'import { Avatar, AvatarFallback } from "@/components/ui/avatar";',
        );
        expect(speakers).toContain('from "@/components/ui/empty";');
        expect(speakers).toMatch(
            /import\s*\{[\s\S]*Field,[\s\S]*FieldContent,[\s\S]*FieldControl,[\s\S]*FieldDescription,[\s\S]*FieldLabel,[\s\S]*FieldTitle[\s\S]*\}\s*from "@\/components\/ui\/field";/,
        );
        expect(speakers).not.toContain('from "@/components/ui/label";');
        for (const primitiveSource of [
            avatarPrimitive,
            badgePrimitive,
            buttonPrimitive,
            fieldPrimitive,
            emptyPrimitive,
        ]) {
            expectPrimitiveToExcludeBusinessTokens(
                primitiveSource,
                SPEAKER_PROFILE_PRIMITIVE_BUSINESS_TOKENS,
            );
        }
        expect(speakers).toContain("<Avatar");
        expect(speakers).toContain("<AvatarFallback");
        expect(avatarFallbacks).toHaveLength(2);
        expectFeatureOwnedSnippets("speaker avatar fallback", [
            "bg-accent",
            "text-[11px]",
            "font-bold",
            "text-primary",
        ]);
        for (const fallback of avatarFallbacks) {
            expect(fallback).toContain("className=");
            expect(fallback).not.toContain('variant="speakerSettings"');
        }
        expect(speakers).toContain("<Button");
        expect(speakers).toContain("<Badge");
        expect(statePill).toContain("<Badge");
        expect(statePill).toMatch(
            /variant=\{(?:badgeVariant|speakerStateBadgeVariantByTone\[tone\])\}/,
        );
        expect(statePill).not.toContain("className=");
        expect(speakerStateBadgeOpenings.length).toBeGreaterThanOrEqual(1);
        for (const badge of speakerStateBadgeOpenings) {
            expect(badge).toMatch(
                /variant=\{(?:badgeVariant|speakerStateBadgeVariantByTone\[tone\])\}/,
            );
            expect(badge).not.toContain("className=");
            expect(badge).not.toContain('variant="speakerState"');
        }
        expect(speakers).toContain("<Field");
        expectFeatureOwnedSnippets("speaker settings rows", [
            "border-b border-border py-3",
        ]);
        expect(speakerRowFields.length).toBeGreaterThanOrEqual(3);
        for (const field of speakerRowFields) {
            expect(field).toContain("className=");
            expect(field).not.toContain('variant="speakerSettingsRow"');
        }
        expectFeatureOwnedSnippets("speaker profile row layout", [
            "speakerProfilesPanelClassName",
            "relative flex flex-col gap-2",
            "speakerSectionGroupClassName",
            "relative mb-[22px]",
            "speakerRowsListClassName",
            "m-0 flex list-none flex-col gap-1.5 p-0",
            "speakerRowItemClassName",
            "grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto_auto]",
            "speakerRowMetaClassName",
            "flex min-w-0 flex-col gap-0.5",
            "speakerRowSubClassName",
            "flex min-w-0 flex-wrap items-center gap-1.5",
        ]);
        expect(speakerProfilesPanelClass).not.toMatch(/!mb-3\.5/);
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
            expect(speakers).not.toContain(forbiddenSpeakerLocalSkin);
        }
        expect(speakers).not.toMatch(
            /\[\[data-theme=dark\]_&\]:border-\[var\(--glass-border-soft\)\]/,
        );
        expect(speakers).toContain("className={speakerProfilesPanelClassName}");
        expect(
            speakers.match(/className=\{speakerSectionGroupClassName\}/g) ?? [],
        ).toHaveLength(2);
        expect(speakers).toContain("className={speakerRowsListClassName}");
        expect(speakers).toContain("className={speakerRowItemClassName}");
        expect(speakers).toContain("className={speakerRowMetaClassName}");
        expect(speakers).toContain("className={speakerRowSubClassName}");
        expect(speakers).toContain("<FieldContent");
        expect(speakers).toContain("<FieldTitle");
        expect(speakers).toContain("<FieldLabel");
        expect(speakers).toContain("<FieldControl");
        expect(speakers).toContain("<FieldDescription>");
        for (const [field, _control, disabledState] of [
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
            expect(field).toMatch(
                new RegExp(
                    `data-disabled=\\{\\s*${disabledState}\\s*\\?\\s*"true"\\s*:\\s*undefined\\s*\\}`,
                ),
            );
            expect(field).toContain(`disabled={${disabledState}}`);
            expect(field).not.toContain("<Label");
        }
        expect(panelNotice).toContain("<Alert");
        expect(panelNotice).toContain('density="comfortable"');
        expect(panelNotice).toContain('layout="default"');
        expect(panelNotice).toContain(
            'variant={tone === "danger" ? "destructiveSoft" : "default"}',
        );
        expect(speakerProfileEmptyState).toHaveLength(1);
        expect(speakerVoiceprintsEmptyState).toHaveLength(1);
        for (const emptyState of [
            speakerProfileEmptyState[0],
            speakerVoiceprintsEmptyState[0],
        ]) {
            expect(emptyState).toContain("<Empty");
            expect(emptyState).toContain('role="status"');
            expect(emptyState).toContain("<EmptyHeader>");
            expect(emptyState).toContain("<EmptyTitle");
            expect(emptyState).toContain("<EmptyDescription");
        }
        expect(speakers).toContain('aria-labelledby="saved-speakers-heading"');
        expect(speakers).toContain('aria-labelledby="voiceprints-heading"');
        expect(speakers).toContain('tone="danger"');
        expect(speakers).not.toContain('density="settingsBanner"');
        expect(speakers).not.toContain('"settingsBannerError"');
        expect(alertPrimitive).not.toContain("settingsBanner:");
        expect(alertPrimitive).not.toContain("settingsBannerError:");
        expectNoLegacySettingsFieldPatterns({
            "features/settings/components/sections/speaker-profiles-panel.tsx":
                speakers,
        });
        expect(speakers).not.toContain('className="btn"');
        expect(speakers).not.toContain('className="btn danger"');
        expect(speakers).toContain(
            'aria-label={isZh ? "说话人设置" : "Speaker settings"}',
        );
        expect(speakers).toContain(
            'aria-label={isZh ? "已保存的说话人" : "Saved speakers"}',
        );
        expect(speakers).toContain(
            'aria-label={isZh ? "远端声纹" : "Remote voiceprints"}',
        );
        for (const oldClassHook of [
            'className="sot-speaker-profiles"',
            'className="sp-rows"',
            'className="sp-row"',
            'className="sot-speaker-avatar"',
            'className="sp-row-meta"',
            'className="sp-row-sub"',
        ]) {
            expect(speakers).not.toContain(oldClassHook);
        }
        expect(speakers).not.toContain("sot-speaker-avatar");
        expect(speakers).not.toContain("sot-speaker-profiles");
        expect(speakers).not.toContain("sot-speaker-pill");
        expect(globals).not.toMatch(/(^|\n|,)\s*\.sot-speaker-/);
        expect(globals).not.toContain(
            '[data-sot-part="speaker-profile-avatar"] [data-slot="avatar-fallback"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="speaker-voiceprint-avatar"] [data-slot="avatar-fallback"]',
        );
        for (const migratedSelector of [
            '[data-sot-panel="speaker-profiles"]',
            "[data-sot-section-group]",
            '[data-sot-list="speaker-profile-rows"]',
            '[data-sot-list="speaker-voiceprint-rows"]',
            '[data-sot-item="speaker-profile-row"]',
            '[data-sot-item="speaker-voiceprint-row"]',
            '[data-sot-part="speaker-profile-row-meta"]',
            '[data-sot-part="speaker-voiceprint-row-meta"]',
            '[data-sot-part="speaker-profile-row-sub"]',
            '[data-sot-part="speaker-voiceprint-row-sub"]',
        ]) {
            expect(collectCssRuleBlocks(globals, migratedSelector)).toEqual([]);
        }
        expect(speakers).not.toContain("data-sot-");
        expect(speakers).not.toContain("data-profiles-state");
        expect(speakers).not.toContain("data-vs-state");
        expect(speakers).not.toMatch(/\bvs-profile/);
        expect(speakers).not.toContain("vs-avatar");
        expect(speakers).toContain('fetch("/api/speakers/profiles"');
        expect(speakers).toContain('fetch("/api/voiceprints"');
        expect(speakers).toContain("refreshProfiles");
        expect(speakers).toContain("refreshVoiceprints");
        expect(speakers).toContain("onClick={() => void refreshProfiles()}");
        expect(speakers).toContain("onClick={() => void refreshVoiceprints()}");
        expect(speakers).toContain("disabled={isProfilesLoading}");
        expect(speakers).toContain("disabled={isVoiceprintsLoading}");
        expect(speakers).toContain("const isCreateSpeakerDisabled =");
        expect(speakers).toContain("disabled={isCreateSpeakerDisabled}");
        expect(speakers).toContain(
            'aria-describedby="new-speaker-create-description"',
        );
        expect(speakers).toContain('id="new-speaker-create-description"');
        expect(speakers).toContain("const profileNameInputId =");
        expect(speakers).toContain("const profileNameDescriptionId =");
        expect(speakers).toContain("htmlFor={profileNameInputId}");
        expect(speakers).toContain("id={profileNameInputId}");
        expect(speakers).toMatch(
            /aria-describedby=\{\s*profileNameDescriptionId\s*\}/,
        );
        expect(speakers).toContain("const voiceprintNameInputId =");
        expect(speakers).toContain("const voiceprintNameDescriptionId =");
        expect(speakers).toContain("htmlFor={voiceprintNameInputId}");
        expect(speakers).toContain("id={voiceprintNameInputId}");
        expect(speakers).toMatch(
            /aria-describedby=\{\s*voiceprintNameDescriptionId\s*\}/,
        );
        expect(speakers).toContain('className="sr-only"');
        expect(speakers).toContain("Rename voiceprint");
        expect(speakers).toContain("Delete voiceprint");
        expect(speakers).not.toMatch(/<Label\s+hidden/);
        expect(speakers).toContain("data-icon-state={");
        expect(speakers).toContain("handleCreate");
        expect(speakers).toContain("handleUpdate");
        expect(speakers).toContain("handleDelete");
        expect(speakers).toContain("handleRenameVoiceprint");
        expect(speakers).toContain("handleDeleteVoiceprint");
        expect(speakers).toContain("useConfirmDialog");
        expect(speakers).toContain("toast.success");
        expect(speakers).toContain("toast.error");
        for (const control of [
            "speaker-profiles-refresh",
            "speaker-profile-create",
            "speaker-profiles-retry",
            "speaker-profile-save",
            "speaker-voiceprints-refresh",
            "speaker-voiceprints-retry",
            "speaker-voiceprint-rename",
        ]) {
            expectNeutralButtonContract(control);
        }
        for (const control of [
            "speaker-profile-delete",
            "speaker-voiceprint-delete",
        ]) {
            expectDangerButtonContract(control);
        }
        expect(speakers).not.toMatch(OLD_UI_RE);
    });

    it("keeps settings skeletons on semantic loading primitives", () => {
        const skeletons = readSource(
            "features/settings/components/settings-skeletons.tsx",
        );
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const globals = readSource("app/globals.css");

        expect(skeletons).not.toContain("data-sot-");
        expect(skeletons).not.toMatch(/\b(?:section|surface)\?: string;/);
        expect(skeletons).toContain("type SettingsSectionSkeletonProps = {");
        expect(skeletons).not.toContain("Partial<");
        expect(skeletons).not.toContain("Record<");
        expect(skeletons).not.toContain('"section" | "surface"');
        expect(skeletons).toContain("SETTINGS_SKELETON_PANEL_CLASS");
        expect(skeletons).toContain(
            '"min-h-0 overflow-y-auto [overscroll-behavior:contain] px-[26px] py-[22px]"',
        );
        expect(skeletons).toContain("SETTINGS_CARD_SKELETON_CLASS");
        expect(skeletons).toContain("SETTINGS_SECTION_SKELETON_CLASS");
        expect(skeletons).toContain("SETTINGS_LIST_SKELETON_CLASS");
        expect(skeletons).toContain(
            "cn(SETTINGS_CARD_SKELETON_CLASS, className)",
        );
        expect(skeletons).toContain(
            "cn(SETTINGS_SECTION_SKELETON_CLASS, className)",
        );
        expect(skeletons).toContain("className={SETTINGS_LIST_SKELETON_CLASS}");
        expect(skeletons).toContain("SKELETON_SYNC_DOT_CLASS");
        expect(skeletons).toContain("size-2 rounded-full");
        expect(skeletons).toContain("bg-primary");
        expect(skeletons).toContain("ring-4 ring-primary/20");
        expect(skeletons).not.toContain("color-mix(");
        expect(skeletons).not.toContain("bg-[var(--signal-success)]");
        expect(skeletons).toContain(
            'import { Field, FieldContent } from "@/components/ui/field";',
        );
        expect(skeletons).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(skeletons).toContain(
            'import { Spinner } from "@/components/ui/spinner";',
        );
        expect(skeletons).toContain(
            'import { useLanguage } from "@/components/language-provider";',
        );
        expect(skeletons).toContain('import { cn } from "@/lib/utils";');
        expect(skeletons).toContain("<Field");
        expect(skeletons).toContain('orientation="horizontal"');
        expect(skeletons).toContain("<FieldContent>");
        expect(skeletons).toContain("makeSkeletonKeys(");
        expect(skeletons).toContain("<Skeleton");
        expect(skeletons).toContain("<Spinner");
        expect(skeletons).toContain('aria-busy="true"');
        expect(skeletons).toContain("<output");
        expect(skeletons).toContain("const { t } = useLanguage();");
        expect(skeletons).toContain(
            'const loadingLabel = t("settingsDialog.loading");',
        );
        expect(skeletons).toContain("aria-label={loadingLabel}");
        expect(skeletons).toContain('aria-live="polite"');
        expect(skeletons).not.toContain('role="status"');
        expect(skeletons).toContain("<span>{loadingLabel}</span>");
        expect(skeletonPrimitive).toContain('React.ComponentProps<"div">');
        expect(skeletons).not.toContain('className="field-row"');
        expect(skeletons).not.toContain('className="field-name"');
        expect(skeletons).not.toContain('className="field-desc"');
        expect(skeletons).not.toContain('"settings-main"');
        expect(skeletons).not.toContain('className="empty-hint"');
        expect(skeletons).not.toContain('className="eh-t"');
        expect(skeletons).not.toContain('className="eh-h"');
        expect(skeletons).not.toContain('className="sync-dot"');
        expect(skeletons).not.toMatch(OLD_UI_RE);
        expect(skeletons).not.toContain("animate-pulse");
        expect(skeletons).not.toMatch(/\bspace-y-/);
        expect(globals).not.toContain(
            '[data-sot-part="settings-skeleton-sync-dot"]',
        );
        for (const selector of REMOVED_SETTINGS_SKELETON_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
    });
});
