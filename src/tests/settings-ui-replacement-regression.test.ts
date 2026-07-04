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

const TARGET_SETTINGS_MIGRATION_PATHS = [
    "features/settings/components/settings-content.tsx",
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

const RETAINED_SETTINGS_MAIN_FUNCTIONAL_DATA_SOT_CSS_SELECTORS = [
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
    it("keeps the settings dialog as a fixed SOT shell with local scrolling and busy guards", () => {
        const dialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const i18n = readSource("lib/i18n.ts");
        const baseDialog = readSource("components/ui/dialog.tsx");
        const buttonPrimitive = readSource("components/ui/button.tsx");
        const globals = readSource("app/globals.css");
        const headerDisplaySetup = dialog.match(
            /const settingsUserName[\s\S]*?const isSettingsBusy/,
        )?.[0];
        const [settingsCloseButton] = collectElementSlices(
            dialog,
            'data-sot-control="settings-close"',
            "Button",
        );
        const [settingsNavButton] = collectElementSlices(
            dialog,
            'data-sot-control="settings-nav"\n',
            "Button",
        );
        const settingsNavButtonClass = findStringConstInitializerContaining(
            dialog,
            [
                "const SETTINGS_NAV_BUTTON_CLASS =",
                "w-full",
                "min-w-0",
                "justify-start",
                "truncate",
                "text-left",
            ],
        );

        expect(dialog).toContain('data-sot-surface="settings-shell"');
        expect(dialog).toContain("data-sot-busy=");
        expect(dialog).toContain("data-sot-section={activeSection}");
        expect(dialog).toContain("data-sot-state=");
        expect(dialog).toContain('data-sot-panel="settings-header"');
        expect(dialog).toContain('data-sot-panel="settings-body"');
        expect(dialog).toContain('data-sot-panel="settings-rail"');
        expect(dialog).toContain("<aside");
        expect(dialog).toContain('data-sot-control="settings-nav"');
        expect(dialog).toContain('data-sot-control="settings-close"');
        expectNoDataSotDrivenTailwindSelectors(dialog);
        expect(dialog).toContain("SETTINGS_NAV_CONTROL_SELECTOR");
        expect(dialog).toContain("SETTINGS_INNER_SCROLL_SELECTOR");
        expect(dialog).toContain("settingsShellRef");
        expect(dialog).toContain("firstNavButtonRef");
        expect(settingsNavButton).toContain("data-settings-nav-control");
        expect(dialog).not.toMatch(
            /closest\(\s*["']\[data-sot-control="settings-nav"\]/,
        );
        expect(dialog).not.toMatch(
            /closest\(\s*["']\[data-sot-surface="settings-shell"\]/,
        );
        expect(dialog).not.toMatch(
            /querySelector(?:All)?(?:<[^>]+>)?\(\s*["']\[data-sot-(?:nav|inner-scroll)/,
        );
        expect(globals).not.toContain(
            '[data-sot-control="settings-close"][data-slot="button"]',
        );
        expect(dialog).toContain('data-sot-part="settings-user-summary"');
        expect(dialog).toContain('data-sot-part="settings-user-avatar"');
        expect(dialog).toContain('data-sot-part="settings-user-name"');
        expect(dialog).toContain('data-sot-part="settings-user-subtitle"');
        expect(dialog).toContain('data-sot-list="settings-nav-group"');
        expect(dialog).toContain('data-sot-part="settings-nav-group-label"');
        expect(dialog).toContain("DialogTitle");
        expect(dialog).toContain("DialogDescription");
        expect(dialog).toContain('className="sr-only"');
        for (const legacyClassName of LEGACY_SETTINGS_SHELL_CLASSNAMES) {
            expect(dialog).not.toContain(legacyClassName);
        }
        expect(buttonPrimitive).not.toContain("settingsClose:");
        expect(buttonPrimitive).not.toContain("settingsNav:");
        for (const selector of REMOVED_SETTINGS_NAV_GLOBAL_REPAINT_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        for (const selector of REMOVED_SETTINGS_DEAD_TENANT_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        expect(settingsCloseButton).toContain(
            'data-sot-control="settings-close"',
        );
        expect(settingsCloseButton).toContain('variant="ghost"');
        expect(settingsCloseButton).toContain("SETTINGS_CLOSE_BUTTON_CLASS");
        expect(settingsCloseButton).toContain('size="icon-sm"');
        expect(settingsCloseButton).toMatch(
            /className=\{\s*[A-Za-z0-9_]+\s*\}/,
        );
        expect(settingsCloseButton).toMatch(
            /<X\s+data-icon="inline-start"\s+aria-hidden="true"\s*\/>/,
        );
        expect(settingsNavButton).toContain('data-sot-control="settings-nav"');
        expect(settingsNavButton).toMatch(
            /variant=\{\s*isActive\s*\?\s*"secondary"\s*:\s*"ghost"\s*\}/,
        );
        expect(settingsNavButton).toContain('size="sm"');
        expect(settingsNavButton).toContain("SETTINGS_NAV_BUTTON_CLASS");
        expect(settingsNavButton).toMatch(/className=\{\s*[A-Za-z0-9_]+\s*\}/);
        expect(settingsNavButton).toContain('data-icon="inline-start"');
        expect(settingsNavButton).toContain('className="min-w-0 truncate"');
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
        ]) {
            expect(settingsNavButtonClass).not.toContain(
                removedNavButtonOverride,
            );
        }
        for (const settingsControlButton of [
            settingsCloseButton,
            settingsNavButton,
        ]) {
            expect(settingsControlButton).not.toContain(
                'variant="settingsClose"',
            );
            expect(settingsControlButton).not.toContain(
                'variant="settingsNav"',
            );
            expect(settingsControlButton).not.toMatch(
                /size="settings(?:Close|Nav)"/,
            );
        }
        expect(dialog).toContain("data-state={");
        expect(dialog).not.toContain('"sr-item active"');
        expect(dialog).not.toContain('"sr-item"');
        expect(dialog).not.toContain(
            'data-sot-control="settings-section-selector"',
        );
        expect(dialog).not.toContain("settings-section-select");
        expect(dialog).not.toContain("@/components/ui/select");
        expect(dialog).toContain("SettingsBusyProvider");
        expect(dialog).toContain("isSettingsBusy");
        expect(dialog).toContain("returnFocusRef");
        expect(dialog).toContain(
            "const keyboardSelectedIndexRef = React.useRef<number>(0);",
        );
        expect(dialog).toContain(
            "keyboardSelectedIndexRef.current = nextIndex;",
        );
        expect(dialog).toContain("const focusSettingsNavItem =");
        expect(dialog).toContain("const activateKeyboardSelectedSection =");
        expect(dialog).toContain("focusSettingsNavItem(selectedItem.id);");
        expect(dialog).toContain("function isSettingsActivationKey(");
        expect(dialog).toContain('event.key === "Space"');
        expect(dialog).toContain('event.code === "Space"');
        expect(dialog).toContain("isSettingsActivationKey(event)");
        expect(dialog).toContain("const handleNavKeyDown =");
        expect(dialog).toContain("const handleNavKeyUp =");
        expect(settingsNavButton).toContain("onKeyDown={handleNavKeyDown}");
        expect(settingsNavButton).toContain("onKeyUp={handleNavKeyUp}");
        expect(settingsNavButton).toContain("data-keyboard-selected={");
        expect(settingsNavButton).toMatch(
            /keyboardSelectedIndex ===\s*itemIndex/,
        );
        expect(settingsNavButton).not.toContain(
            "!isSettingsBusy &&\n                                                    keyboardSelectedIndex",
        );
        expect(settingsNavButton).toMatch(
            /applyActiveSettingsSection\(\s*item\.id,?\s*\)/,
        );
        expect(settingsNavButton).not.toContain("setActiveSection(item.id)");
        expect(dialog).not.toContain(
            "orderedSettingsNav[keyboardSelectedIndex].id",
        );
        expect(dialog).toContain("focus({ preventScroll: true })");
        expect(dialog).toContain("onInteractOutside");
        expect(dialog).toContain("normalizeSettingsSection");
        expect(dialog).toContain('documentElement.style.overflow = "hidden"');
        expect(dialog).toContain('body.style.overflow = "hidden"');
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
        for (const slot of [
            "dialog",
            "dialog-trigger",
            "dialog-portal",
            "dialog-overlay",
            "dialog-content",
            "dialog-title",
            "dialog-description",
            "dialog-close",
        ]) {
            expect(baseDialog).toContain(`data-slot="${slot}"`);
        }
        expect(baseDialog).toContain("showCloseButton");
        expect(baseDialog).not.toContain("DialogContext");
        expect(baseDialog).not.toContain('className="scrim"');
        expect(globals).toContain("--z-modal");
        expect(globals).toContain("--ease-sine");
        expect(globals).toContain("--z-modal");
        expect(baseDialog).toContain("z-50");
        expect(baseDialog).not.toContain("z-[var(--z-modal)]");
        expect(globals).not.toContain(".ui-select-content");
        expect(globals).not.toContain("z-index: 650");
        expect(globals).not.toContain(
            '.scrim[data-open="false"] > [data-sot-surface="settings-shell"]',
        );
        expect(dialog).toContain('"data-sot-overlay": "settings-shell"');
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
                "sm:max-w-[920px]",
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
            "sm:max-w-[920px]",
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
        expect(confirmDialog).toContain(
            'const CONFIRM_DIALOG_PANEL_CLASS = "z-[calc(var(--z-modal)+2)]";',
        );
        expect(confirmDialog).toContain(
            "data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100",
        );
        expect(confirmDialog).toContain(
            "rounded-md border border-[var(--alert-destructive-soft-border)] bg-[var(--alert-destructive-soft-bg)] px-3 py-2 text-[var(--signal-danger)]",
        );
        expect(globals).not.toContain("--confirm-dialog-warning-bg:");
        expect(globals).not.toContain("--confirm-dialog-warning-border:");
        expect(confirmDialog).not.toContain('data-sot-part="confirm-foot"');
        expect(layout).toContain('"data-sot-part": "confirm-foot"');
        expect(confirmDialog).toMatch(
            /<DialogHeader[\s\S]*\{\.\.\.headerSlotProps\}[\s\S]*className=\{cn\(\s*"gap-2 text-left"/,
        );
        expect(confirmDialog).toMatch(
            /<DialogTitle[\s\S]*\{\.\.\.titleSlotProps\}[\s\S]*"m-0 text-base leading-snug font-semibold tracking-normal"/,
        );
        expect(confirmDialog).toMatch(
            /<DialogDescription[\s\S]*\{\.\.\.descriptionSlotProps\}[\s\S]*"m-0 text-sm leading-relaxed text-muted-foreground"/,
        );
        expect(confirmDialog).toMatch(
            /<DialogFooter[\s\S]*\{\.\.\.footerSlotProps\}[\s\S]*"gap-\[8px\] sm:justify-end"/,
        );
        expect(confirmDialog).toContain(
            'confirmVariant?: "default" | "destructive"',
        );
        expect(confirmDialog).toContain("variant={confirmButtonVariant}");
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

        for (const [pattern, label] of LEGACY_SETTINGS_SHELL_CSS_SELECTORS) {
            expect(globals, `globals should not use ${label}`).not.toMatch(
                pattern,
            );
        }
        for (const selector of RETAINED_SETTINGS_MAIN_FUNCTIONAL_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
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
        findStringConstInitializerContaining(content, [
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
            /import\s*\{[\s\S]*Field,[\s\S]*FieldContent,[\s\S]*FieldDescription,[\s\S]*FieldError,[\s\S]*FieldLabel,[\s\S]*FieldTitle[\s\S]*\}\s*from "@\/components\/ui\/field";/,
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
        expect(playbackSettingsRows).toContain(
            'data-sot-control="playback-volume"',
        );
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

    it("uses the SOT monitor glyph for the local deployment header badge", () => {
        const dialog = readSource(
            "features/settings/components/settings-dialog.tsx",
        );
        const localBadge = dialog.match(
            /<span[\s\S]*?data-sot-part="settings-user-avatar"[\s\S]*?<\/span>/,
        )?.[0];

        expect(dialog).toContain("Monitor");
        expect(dialog).not.toContain("function getSettingsUserInitial");
        expect(dialog).not.toContain("settingsUserInitial");
        expect(localBadge).toContain('aria-hidden="true"');
        expect(localBadge).toContain('data-sot-part="settings-user-avatar"');
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

    it("keeps the SOT settings rail visible on mobile without a section selector", () => {
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
        expect(dialog).toContain('data-sot-part="settings-user-summary"');
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
            "sm:max-w-[920px]",
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
            "grid-cols-[200px_1fr]",
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
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );

        findStringConstInitializerContaining(content, [
            "const SETTINGS_THREE_PANE_SCROLL_BODY_CLASS =",
            "grid",
            "min-h-0",
            "grid-cols-[280px_1fr]",
            "overflow-hidden",
            "p-0",
        ]);
        expect(content).not.toContain("max-[720px]:grid-cols");
        expect(content).not.toContain("max-[720px]:grid-rows");
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
            expect(content).toContain(provider);
        }

        expect(content).toContain("function DataSourcesSettingsPanel");
        expect(content).toContain("data-sot-load-state");
        expect(content).toContain('data-sot-surface="settings-data-sources"');
        expect(content).toContain('data-sot-layout="three-pane"');
        expect(content).toContain(
            'import {\n    Empty,\n    EmptyDescription,\n    EmptyHeader,\n    EmptyTitle,\n} from "@/components/ui/empty";',
        );
        expect(content).toContain('data-sot-panel="settings-empty-hint"');
        expect(content).toContain('data-sot-section="data-sources"');
        expect(content).toContain('data-sot-state="loading"');
        expect(content).toContain('data-sot-state="advanced"');
        expect(content).toContain('data-sot-state="empty"');
        expect(content).toContain('data-sot-part="settings-empty-title"');
        expect(content).toContain('data-sot-part="settings-empty-description"');
        const settingsEmptyHints = collectElementSlices(
            content,
            'data-sot-panel="settings-empty-hint"',
            "Empty",
        );
        expect(settingsEmptyHints).toHaveLength(3);
        for (const state of ["loading", "advanced", "empty"]) {
            const emptyHint = settingsEmptyHints.find((slice) =>
                slice.includes(`data-sot-state="${state}"`),
            );
            expect(emptyHint).toBeDefined();
            const emptyHintSlice = emptyHint ?? "";
            expect(emptyHintSlice).toContain("<Empty");
            expect(emptyHintSlice).toContain('className="mt-4 flex-none"');
            expect(emptyHintSlice).toContain(
                'data-sot-panel="settings-empty-hint"',
            );
            expect(emptyHintSlice).toContain('data-sot-section="data-sources"');
            expect(emptyHintSlice).toContain("<EmptyHeader>");
            expect(emptyHintSlice).toContain(
                '<EmptyTitle data-sot-part="settings-empty-title">',
            );
            expect(emptyHintSlice).toContain(
                '<EmptyDescription data-sot-part="settings-empty-description">',
            );
            expect(emptyHintSlice).not.toContain("<div");
        }
        expect(settingsEmptyHints.join("\n")).toContain(
            '{isZh ? "正在读取来源" : "Loading sources"}',
        );
        expect(settingsEmptyHints.join("\n")).toContain(
            '? "请稍候，正在读取已保存的数据源状态。"',
        );
        expect(settingsEmptyHints.join("\n")).toContain('? "高级选项（可选）"');
        expect(settingsEmptyHints.join("\n")).toContain(
            '? "仅在来源要求额外组织信息时填写。"',
        );
        expect(settingsEmptyHints.join("\n")).toContain(
            '{isZh ? "没有可用数据源" : "No data sources"}',
        );
        expect(settingsEmptyHints.join("\n")).toContain(
            '? "请稍后重试，或检查服务端数据源接口。"',
        );
        expect(content).toContain('data-sot-list="source-fields"');
        expect(content).toContain('data-sot-panel="source-provider-fields"');
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
        expect(content).not.toContain('className="settings-main three-pane"');
        expect(content).not.toContain('className="empty-hint"');
        expect(content).not.toContain('className="eh-t"');
        expect(content).not.toContain('className="eh-h"');
        expect(content).not.toContain('className="ds-fields"');
        const providersTitle = content.match(
            /<div[\s\S]*?data-sot-part="source-providers-title"[\s\S]*?<\/div>/,
        )?.[0];
        expect(providersTitle).toContain('{isZh ? "来源" : "Data Sources"}');
        expect(providersTitle).not.toContain('"数据源"');
        expect(content).toContain('data-sot-control="settings-save"');
        expect(content).toContain("data-sot-panel");
        expect(content).toContain("data-sot-provider=");
        expect(content).toContain("data-sot-state");
        expect(content).toContain("data-sot-panel");
        expect(content).toContain("data-sot-status");
        expect(content).toContain("data-sot-action-state");
        expect(content).toContain("data-sot-interaction-disabled");
        expect(content).toContain("ProviderActionMessage");
        expect(content).toContain('"testing"');
        expect(content).toContain('"test-success"');
        expect(content).toContain('"save-error"');
        expect(content).toContain("source.syncStatus");
        expect(content).toContain("source.lastSyncError");
        expect(content).toContain('"syncing"');
        expect(content).toContain('"同步中"');
        expect(content).toContain('"同步失败"');
        expect(content).toContain("来源更新失败，请检查登录信息后重试。");
        expect(content).toContain("connectionStatus");
        expect(content).toContain('"expired"');
        expect(content).toContain("useSettingsSectionBusy");
        expect(content).toContain("isDataSourcesBusy");
        expect(content).toContain('data-sot-list="source-auth-modes"');
        const sourceAuthModeControl = collectElementSlices(
            content,
            'data-sot-list="source-auth-modes"',
            "ToggleGroup",
        )[0];
        expect(content).toContain("<ToggleGroup");
        expect(content).toContain("<ToggleGroupItem");
        expect(content).toContain('type="single"');
        expect(content).toContain("value={selectedSource.authMode}");
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
            'data-sot-control="source-auth-mode"',
        );
        expect(content).toContain("data-sot-auth-mode={mode}");
        expect(content).toContain("data-sot-state={");
        expect(content).toContain('data-sot-part="source-auth-mode-title"');
        expect(content).toContain(
            'data-sot-part="source-auth-mode-description"',
        );
        expect(content).toContain('data-sot-badge="source-auth-mode"');
        expect(content).toMatch(/data-sot-tone=\{\s*modeBadge\.tone\s*\}/);
        expect(content).toContain("{modeBadge.label}");
        expect(content).toContain('tone: "recommended"');
        expect(content).toContain('tone: "personal"');
        expect(content).toMatch(
            /getSourceAuthModeDisplayLabel\(\s*mode,\s*language,\s*\)/,
        );
        const settingsGroup =
            content.match(
                /function SettingsGroup[\s\S]*?function SettingsRow/,
            )?.[0] ?? "";
        const [sourceAuthModeBadge] = collectElementSlices(
            content,
            'data-sot-badge="source-auth-mode"',
            "Badge",
        );
        expect(sourceAuthModeBadge).toContain("<Badge");
        expect(sourceAuthModeBadge).toContain("data-sot-tone=");
        expect(sourceAuthModeBadge).toContain("modeBadge.tone");
        expect(sourceAuthModeBadge).toContain("{modeBadge.label}");
        expect(sourceAuthModeBadge).not.toContain(
            'variant="sourceAuthModeBadge"',
        );
        expect(content).toContain("<Badge");
        expect(content).toContain("authMode: mode");
        expect(content).not.toContain('className="path-picker"');
        expect(content).not.toContain("path-card");
        expect(content).not.toContain("pc-badge");
        expect(content).toContain("SETTINGS_DATA_SOURCE_PROVIDER_STORAGE_KEY");
        expect(content).toContain('data-sot-part="source-provider-mark"');
        expect(content).toContain("getSourceProviderSettingsLabel");
        expect(content).toContain("handleTestSource");
        expect(content).toContain("testSourceSettings(source)");
        expect(content).toContain("handleSaveSource");
        expect(content).toContain("handleReconnectSource");
        expect(content).toContain("handleDisconnectSource");
        expect(content).toContain("reconnectSourceSettings(");
        expect(content).toContain("disconnectSourceSettings(");
        expect(content).toContain("DataSourceFieldControl");
        expect(content).toContain("updateField(");
        expect(content).toContain("secretDrafts");
        expect(content).toContain("Switch");
        expect(content).toContain("onCheckedChange");
        expect(content).toContain("enabled: checked");
        expect(content).toContain('data-sot-part="source-provider-header"');
        expect(content).toContain('data-sot-part="source-provider-title"');
        expect(content).toContain('data-sot-part="source-provider-subtitle"');
        expect(content).toContain('data-sot-surface="settings-data-sources"');
        expect(content).toContain("data-sot-status={status.state}");
        expect(content).toContain("DataSourceFieldControl");
        expect(settingsGroup).toContain("data-sot-section-group");
        expect(settingsGroup).toContain(
            "className={SETTINGS_SECTION_GROUP_CLASS}",
        );
        expect(content).toContain('from "@/components/ui/field";');
        expect(content).toContain("<Field");
        expect(content).toContain("<FieldContent");
        expect(content).toContain("<FieldLabel");
        expect(content).toContain("<FieldTitle>");
        expect(content).toContain("<FieldDescription>");
        expect(settingFieldControl).toContain("readOnly?: boolean");
        expect(settingFieldControl).toContain("readOnly={field.readOnly}");
        expect(settingFieldControl).toContain("masked?: boolean");
        expect(settingFieldControl).toContain("data-sot-mask={field.masked");
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
        expect(dataSourceFieldControl).toContain("<FieldDescription>");
        expect(dataSourceFieldControl).toContain(
            "masked: readOnlyMaskedDisplay",
        );
        expect(dataSourceFieldControl).toContain("data-sot-mask={");
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
        expect(content).toContain('data-sot-panel="settings-save-actions"');
        expect(content).toContain('data-sot-panel="source-actions"');
        expect(content).toContain('data-sot-part="source-action-status"');
        expect(content).toContain('data-sot-control="source-test"');
        expect(content).toContain('data-sot-control="source-save"');
        expect(content).toContain('data-sot-control="source-reconnect"');
        expect(content).toContain('data-sot-control="source-disconnect"');
        expect(content).toContain('"重新连接"');
        expect(content).toContain('"断开连接"');
        expect(content).toContain('data-sot-panel="source-state-banner"');
        expect(content).toContain("getSourceProviderStatusHint");
        expect(content).toContain("getSourceProviderDetailSubtitle");
        expect(content).toContain("shouldShowProviderStateBanner");
        expect(content).not.toContain('className="sm-detail-head"');
        expect(content).not.toContain("className={`sm-detail-icon");
        expect(content).not.toContain('className="sm-detail-title"');
        expect(content).not.toContain('className="sm-detail-sub"');
        expect(content).not.toContain('className="modal-foot"');
        expect(content).not.toContain('className="sm-actions-spacer"');
        expect(content).not.toContain('className="sm-section"');
        expect(content).not.toContain("sm-actions-state");
        expect(content).not.toContain("sd-pill");
        expect(content).not.toMatch(OLD_UI_RE);

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

    it("keeps data-source load retry on a stable SOT control hook", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const sourceLoadError = content.match(
            /<Alert\s[^>]*data-sot-banner="source-load-error"[^>]*>[\s\S]*?<\/Alert>/,
        )?.[0];
        const sourceLoadErrorOpening =
            sourceLoadError?.match(/<Alert\s[^>]*>/)?.[0];
        const retryButton = sourceLoadError?.match(
            /<Button[\s\S]*?<\/Button>/,
        )?.[0];

        expect(sourceLoadError).toContain('data-sot-panel="source-load-error"');
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
        expect(retryButton).toContain('data-sot-control="source-load-retry"');
        expect(retryButton).toContain('variant="default"');
        expect(retryButton).not.toContain('variant="settingsSourceRetry"');
        expect(retryButton).not.toContain('size="settingsSourceRetry"');
        expect(retryButton).toContain("onClick={() => void refreshSources()}");
    });

    it("keeps provider enable sync switch on stable SOT hooks and state contracts", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const enableSwitch = content.match(
            /<Switch[\s\S]*?data-sot-control="source-enable-sync"[\s\S]*?\/>/,
        )?.[0];

        expect(enableSwitch).not.toContain("data-ds-enable");
        expect(enableSwitch).toContain('data-sot-control="source-enable-sync"');
        expect(enableSwitch).toMatch(
            /data-sot-state=\{\s*selectedSource\.enabled\s*\?\s*"checked"\s*:\s*"unchecked"\s*\}/,
        );
        expect(enableSwitch).toMatch(
            /data-sot-enabled=\{\s*selectedSource\.enabled\s*\?\s*"true"\s*:\s*"false"\s*\}/,
        );
        expect(enableSwitch).toMatch(
            /data-sot-disabled=\{\s*interactionDisabled\s*\?\s*"true"\s*:\s*"false"\s*\}/,
        );
        expect(enableSwitch).toContain("checked={selectedSource.enabled}");
        expect(enableSwitch).toContain("disabled={interactionDisabled}");
        expect(enableSwitch).toContain("onCheckedChange={(checked) =>");
    });

    it("keeps provider tile and detail runtime hooks on SOT attributes only", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const providerTile =
            content.match(
                /function DataSourceProviderTile[\s\S]*?function DataSourcesSettingsPanel/,
            )?.[0] ?? "";
        const detailRoot =
            content.match(
                /<section[\s\S]*?data-sot-panel="source-provider-detail"[\s\S]*?>/,
            )?.[0] ?? "";
        const detailHeader =
            content.match(
                /<CardHeader[\s\S]*?data-sot-part="source-provider-header"[\s\S]*?>/,
            )?.[0] ?? "";

        expect(content).not.toMatch(
            /data-provider=|data-selected=|data-dimmed=|data-provider-detail=|data-ds-state=/,
        );
        expect(providerTile).toContain('data-sot-control="source-provider"');
        expect(providerTile).toContain(
            'variant={isSelected ? "secondary" : "ghost"}',
        );
        expect(providerTile).toContain("className={cn(");
        expect(providerTile).toContain("SOURCE_PROVIDER_TILE_BUTTON_CLASS");
        expect(providerTile).not.toContain('variant="sourceProviderTile"');
        expect(providerTile).not.toContain('size="sourceProviderTile"');
        expect(providerTile).toContain("aria-pressed={isSelected}");
        expect(providerTile).toContain("data-sot-provider={source.provider}");
        expect(providerTile).toContain(
            'data-sot-state={isSelected ? "selected" : "idle"}',
        );
        expect(providerTile).toContain("data-sot-status={status.state}");
        expect(providerTile).toContain(
            'data-sot-dimmed={isDimmed ? "true" : "false"}',
        );
        expect(providerTile).toContain("SOURCE_PROVIDER_STATUS_BADGE_CLASS");
        expect(providerTile).toContain("data-sot-tone={status.tone}");
        expect(providerTile).toContain(
            "variant={getProviderStatusBadgeVariant(status.tone)}",
        );
        expect(detailRoot).toContain('data-sot-panel="source-provider-detail"');
        expect(detailRoot).toContain("className=");
        expect(detailRoot).toContain(
            'data-sot-provider={selectedSource?.provider ?? "none"}',
        );
        expect(detailRoot).toContain(
            'data-sot-status={status?.state ?? "empty"}',
        );
        expect(detailHeader).toContain(
            'data-sot-part="source-provider-header"',
        );
        expect(detailHeader).toContain("data-sot-state={status.state}");
    });

    it("keeps provider primitive skins and owns source action composition locally", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
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
                /<Alert\s[^>]*data-sot-banner="source-state"[^>]*>/,
            )?.[0] ?? "";
        const providerStateBannerBlock =
            content.match(
                /function ProviderStateBanner[\s\S]*?function DataSourcesSettingsPanel/,
            )?.[0] ?? "";
        const bannerIconSlotClass =
            content.match(
                /const SETTINGS_BANNER_ICON_SLOT_CLASS[\s\S]*?;/,
            )?.[0] ?? "";
        const providerTileButton =
            providerTile.match(
                /<Button[\s\S]*?data-sot-control="source-provider"[\s\S]*?>/,
            )?.[0] ?? "";
        const sourceActionArea =
            content.match(
                /<footer[\s\S]*?data-sot-panel="source-actions"[\s\S]*?data-sot-part="source-disconnect-row"[\s\S]*?<\/Field>/,
            )?.[0] ?? "";
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
        const sourceTestAction = collectElementSlices(
            sourceActionArea,
            'data-sot-control="source-test"',
            "SourceActionButton",
        )[0];
        const sourceSaveAction = collectElementSlices(
            sourceActionArea,
            'data-sot-control="source-save"',
            "SourceActionButton",
        )[0];
        const sourceReconnectAction = collectElementSlices(
            sourceActionArea,
            'data-sot-control="source-reconnect"',
            "SourceActionButton",
        )[0];
        const sourceDisconnectAction = collectElementSlices(
            sourceActionArea,
            'data-sot-control="source-disconnect"',
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
        expect(providerStateBannerBlock).toContain("<Icon");
        expect(providerStateBanner).not.toContain('density="settingsBanner"');
        expect(providerStateBanner).not.toContain(
            "border-destructive/30 bg-destructive/10",
        );
        expect(providerTile).toContain(
            'variant={isSelected ? "secondary" : "ghost"}',
        );
        expect(providerTile).toContain("SOURCE_PROVIDER_TILE_BUTTON_CLASS");
        expect(providerTile).not.toContain('variant="sourceProviderTile"');
        expect(providerTile).not.toContain('size="sourceProviderTile"');
        expect(providerTileButton).toContain("className=");
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
        expect(providerTile).toContain('"justify-self-end"');
        expect(providerTile).not.toContain(
            '"size-[4px] rounded-full bg-current"',
        );
        expect(providerTile).toContain('data-sot-part="source-provider-mark"');
        expect(providerTile).toContain('data-sot-part="source-provider-meta"');
        expect(providerTile).toContain("data-sot-provider-name");
        expect(providerTile).toContain("data-sot-provider-hint");
        expect(sourceActionArea).toContain("<SourceActionStatusBadge");
        expect(sourceActionArea).toContain("<SourceActionButton");
        expect(sourceTestAction).toContain('tone="neutral"');
        expect(sourceTestAction).toContain('data-sot-action="test"');
        expect(sourceSaveAction).toContain('tone="primary"');
        expect(sourceSaveAction).toContain('data-sot-action="save"');
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
            'data-sot-part="source-action-status-indicator"',
        );
        expect(sourceActionStatusWrapper).toContain("className={cn(");
        expect(sourceActionStatusWrapper).not.toContain("showIndicator");
        expect(button).not.toContain("sourceProviderTile:");
        expect(button).not.toMatch(/\bsourceProviderAction\b/);
        expect(content).not.toContain("data-[state=selected]");
        expect(content).not.toContain("data-[sot-dimmed=true]");
        expect(toggleGroup).not.toContain("settingsSourceAuthMode:");
        expect(toggleGroup).not.toContain("settingsSourceAuthModeOption:");
        expect(badge).not.toContain("sourceAuthModeBadge");
        expect(badge).not.toContain("sourceActionStatus:");
        for (const statusClass of [statusBadgeClass, detailStatusBadgeClass]) {
            expect(statusClass).not.toContain("data-[sot-tone=");
            expect(statusClass).not.toContain("[&_[data-sot");
            expect(statusClass).not.toContain("var(--");
        }
        expect(statusBadgeClass).toContain("justify-self-end");
        expect(detailStatusBadgeClass).toContain("shrink-0");
        expect(providerTile).toContain('"size-1 rounded-full bg-current"');
        expect(providerTile).toContain('status.tone === "syncing"');
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
        const saveStatusClass =
            content.match(
                /const SETTINGS_SAVE_STATUS_BADGE_CLASS[\s\S]*?;/,
            )?.[0] ?? "";
        const saveActionsClass =
            content.match(/const SETTINGS_SAVE_ACTIONS_CLASS[\s\S]*?;/)?.[0] ??
            "";
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
        const keyStatusClass =
            content.match(/const SETTINGS_KEY_STATUS_CLASS[\s\S]*?;/)?.[0] ??
            "";
        const providerDetailInputOwnerClass =
            settingFieldControl.match(
                /const SOURCE_PROVIDER_DETAIL_INPUT_CLASS\s*=\s*"[^"]*";/,
            )?.[0] ?? "";
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
        expect(content).toContain('variant="sourceProviderDetail"');
        expect(content).toContain("<FieldControl");
        expect(content).not.toContain('controlSize="sourceProviderDetail"');
        expect(content).not.toContain('size="sourceProviderDetail"');
        expect(content).toContain('data-sot-panel="source-actions"');
        expect(content).toContain('data-sot-panel="settings-save-actions"');
        expect(content).toContain('data-icon="inline-start"');
        expect(content).toContain('className="animate-spin"');
        for (const source of [
            content,
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
        expect(providerDetailInputOwnerClassName).toBe(
            "SOURCE_PROVIDER_DETAIL_INPUT_CLASS",
        );
        for (const providerDetailInputOwnerToken of [
            "w-full",
            "max-w-[15rem]",
            "font-mono",
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
            "text-[12px]",
            "leading-[normal]",
        ]) {
            expect(providerDetailInputOwnerClass).not.toContain(
                removedProviderDetailInputSkin,
            );
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
            providerDetailInputOwnerClassName,
        );
        expect(sourceProviderControlClassNameBlock).toContain("undefined");
        expect(inputClassNameBlock).toContain("sourceProviderControlClassName");
        expect(inputClassNameBlock).toContain("field.masked &&");
        expect(inputClassNameBlock).toContain("field.className");
        expect(settingFieldControl).toContain(
            'data-sot-mask={field.masked ? "true" : undefined}',
        );
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
        expectPrimitiveToExcludeBusinessTokens(
            fieldPrimitive,
            AUTH_FIELD_PRIMITIVE_FORBIDDEN_TOKENS,
        );
        expect(fieldPrimitive).not.toContain("settingsRow");
        expect(fieldPrimitive).not.toContain("settingsContent");
        expect(fieldPrimitive).not.toContain("settingsControl");
        expect(fieldPrimitive).not.toContain("sourceProviderDetail");
        expect(fieldPrimitive).not.toContain("grid grid-cols-[1fr_auto]");
        expect(fieldPrimitive).toContain("function FieldControl");
        expect(fieldPrimitive).toContain("data-variant={variant}");
        expect(buttonPrimitive).not.toContain("settingsSave:");
        expect(buttonPrimitive).not.toContain("settingsTestAction:");
        expect(buttonPrimitive).not.toContain("settingsSourceRetry:");
        expect(buttonPrimitive).not.toContain("settingsSectionRetry:");
        expect(saveStatusClass).toContain("SETTINGS_SAVE_STATUS_BADGE_CLASS");
        expect(saveStatusClass).not.toContain("data-[sot-state=");
        expect(saveStatusClass).not.toContain("[&_[data-sot-part");
        expect(content).toContain("const statusClassName = cn(");
        expect(content).toContain('saveState === "idle" && "hidden"');
        expect(content).toContain("const indicatorClassName = cn(");
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
        expect(keyStatusClass).toContain("SETTINGS_KEY_STATUS_CLASS");
        expect(keyStatusClass).toContain("inline-flex items-center gap-1");
        expect(keyStatusClass).not.toContain("data-[sot-state=");
        expect(keyStatusClass).toContain("text-muted-foreground");
        expect(keyStatusClass).not.toContain("var(--");
        expect(content).toContain("className={SETTINGS_SHORTCUTS_GRID_CLASS}");
        expect(content).toContain("className={SETTINGS_SHORTCUT_ROW_CLASS}");
        expect(content).toContain("className={SETTINGS_SHORTCUT_KEY_CLASS}");
        expect(content).toContain("className={SETTINGS_KEY_STATUS_CLASS}");
        expect(content).toContain("data-sot-key-status");
        expect(content).toContain('className="text-primary"');
        expect(content).not.toContain('data-state="valid"');
        expect(content).not.toContain('data-state="invalid"');
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
        ]) {
            expect(inputPrimitive).not.toContain(inputPrimitiveBusinessToken);
        }
        expect(switchPrimitive).toContain('type SwitchVariant = "default"');
        expect(switchPrimitive).toContain('type SwitchSize = "sm" | "default"');
        expect(settingFieldControl).not.toContain(
            "[&_[data-slot=switch-thumb]]",
        );
        expect(settingFieldControl).not.toContain("focus-visible:ring-0");
        expect(settingFieldControl).not.toContain("aria-invalid:ring-0");
        expect(settingFieldControl).toMatch(/<Switch\s+id=\{fieldId\}/);
        expect(settingFieldControl).not.toContain(
            "sourceProviderSwitchClassName",
        );
        expect(content).not.toContain("SOURCE_PROVIDER_DETAIL_SWITCH_CLASS");
        expect(content).toContain('data-sot-control="source-auto-update"');
        expect(content).toContain('data-sot-control="source-enable-sync"');
        expect(content).toContain("data-sot-state=");
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
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const dataSourcesPanel =
            content.match(
                /function DataSourcesSettingsPanel[\s\S]*?type SectionSaveState/,
            )?.[0] ?? "";
        const presentation = readSource("lib/data-sources/presentation.ts");

        expect(dataSourcesPanel).toContain("自动更新");
        expect(dataSourcesPanel).toContain("每 15 分钟读取一次新录音");
        expect(dataSourcesPanel).toContain(
            'data-sot-control="source-auto-update"',
        );
        expect(dataSourcesPanel).toContain("标题更新回来源");
        expect(dataSourcesPanel).toContain("关闭后不再从此来源读取任何新录音");
        expect(dataSourcesPanel).toContain('label: "base URL"');
        expect(dataSourcesPanel).toContain('"钉钉 API 域名"');
        expect(dataSourcesPanel).toContain('"https://alidocs.dingtalk.com"');
        expect(content).toContain('"m@example.com · 浏览器授权登录"');
        expect(presentation).toContain('"最近更新 · 12 分钟前 · 112 条录音"');
        expect(presentation).toContain('"正在同步 · 已读取 12 / 48"');
        expect(presentation).toContain('"上次同步失败 · 2 小时前"');
        expect(presentation).toContain('"待设置 · 两种接入方式"');
        expect(presentation).toContain('"登录已过期"');
        expect(dataSourcesPanel).toContain(
            'selectedSource.provider !== "dingtalk-a1"',
        );
        expect(dataSourcesPanel).toContain(
            'data-sot-control="source-enable-sync"',
        );
        expect(dataSourcesPanel).not.toContain("data-ds-enable");
        expect(dataSourcesPanel).toContain('data-sot-panel="source-actions"');
        expect(dataSourcesPanel).toContain(
            "data-sot-provider={selectedSource.provider}",
        );
        expect(dataSourcesPanel).toContain("data-sot-state={sourceSaveState}");
        expect(dataSourcesPanel).toContain(
            'data-sot-part="source-action-status"',
        );
        expect(dataSourcesPanel).toContain('data-sot-control="source-test"');
        expect(dataSourcesPanel).toContain('data-sot-action="test"');
        expect(dataSourcesPanel).toContain('data-sot-control="source-save"');
        expect(dataSourcesPanel).toContain('data-sot-action="save"');
        expect(dataSourcesPanel).not.toContain('data-save-actions=""');
        expect(dataSourcesPanel).not.toMatch(
            /data-save-id=\{`ds-\$\{selectedSource\.provider\}`\}/,
        );
        expect(dataSourcesPanel).not.toContain('data-save-test=""');
        expect(dataSourcesPanel).not.toContain('data-save-action=""');
        expect(dataSourcesPanel).toContain(
            'data-sot-control="source-reconnect"',
        );
        expect(dataSourcesPanel).toContain(
            'data-sot-control="source-disconnect"',
        );
        expect(dataSourcesPanel).toContain('"重新连接"');
        expect(dataSourcesPanel).toContain('"断开连接"');

        for (const bannedTerm of SETTINGS_PUBLIC_RAW_COPY_BLOCKERS) {
            expect(dataSourcesPanel).not.toContain(bannedTerm);
        }

        const authModeIndex = dataSourcesPanel.indexOf(
            'data-sot-list="source-auth-modes"',
        );
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
            'data-sot-control="source-enable-sync"',
        );
        const footerIndex = dataSourcesPanel.indexOf(
            'data-sot-control="source-test"',
        );
        const reconnectRowIndex = dataSourcesPanel.indexOf(
            'data-sot-part="source-reconnect-row"',
        );
        const disconnectRowIndex = dataSourcesPanel.indexOf(
            'data-sot-part="source-disconnect-row"',
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

        const reconnectRow =
            dataSourcesPanel.match(
                /<Field\s+data-sot-part="source-reconnect-row"[\s\S]*?<\/Field>/,
            )?.[0] ?? "";
        const disconnectRow =
            dataSourcesPanel.match(
                /<Field\s+data-sot-part="source-disconnect-row"[\s\S]*?<\/Field>/,
            )?.[0] ?? "";

        expect(reconnectRow).toContain('orientation="horizontal"');
        expect(reconnectRow).toContain("<FieldContent");
        expect(reconnectRow).toContain("<FieldTitle");
        expect(reconnectRow).toContain("<FieldDescription");
        expect(reconnectRow).toContain('"重新连接"');
        expect(reconnectRow).toContain('data-sot-control="source-reconnect"');
        expect(reconnectRow).toMatch(
            /handleReconnectSource\(\s*selectedSource,\s*\)/,
        );
        expect(reconnectRow).toMatch(
            /aria-busy=\{\s*actionState === "reconnecting"\s*\}/,
        );
        expect(disconnectRow).toContain('orientation="horizontal"');
        expect(disconnectRow).toContain("<FieldContent");
        expect(disconnectRow).toContain("<FieldTitle");
        expect(disconnectRow).toContain("<FieldDescription");
        expect(disconnectRow).toContain('"断开连接"');
        expect(disconnectRow).toContain('data-sot-control="source-disconnect"');
        expect(disconnectRow).toMatch(
            /handleDisconnectSource\(\s*selectedSource,\s*\)/,
        );
        expect(disconnectRow).toMatch(
            /aria-busy=\{\s*actionState === "disconnecting"\s*\}/,
        );

        const actionFooter =
            dataSourcesPanel.match(
                /<footer[\s\S]*?data-sot-panel="source-actions"[\s\S]*?<\/footer>/,
            )?.[0] ?? "";
        const providerDetail =
            dataSourcesPanel.match(
                /<section[\s\S]*?data-sot-panel="source-provider-detail"[\s\S]*?<\/section>/,
            )?.[0] ?? "";
        const providerFieldsIndex = providerDetail.indexOf(
            'data-sot-panel="source-provider-fields"',
        );
        const firstProviderDividerIndex = providerDetail.indexOf(
            "data-sot-section-divider",
            providerFieldsIndex,
        );
        const autoUpdateDetailIndex = providerDetail.indexOf(
            'data-sot-part="source-auto-update-row"',
        );
        const enableSyncDetailIndex = providerDetail.indexOf(
            'data-sot-control="source-enable-sync"',
        );
        const actionClusterDividerIndex = providerDetail.indexOf(
            "data-sot-section-divider",
            enableSyncDetailIndex,
        );
        const sourceActionsDetailIndex = providerDetail.indexOf(
            'data-sot-panel="source-actions"',
        );
        const providerDetailDividers = [
            ...providerDetail.matchAll(
                /<Separator[\s\S]*?data-sot-section-divider[\s\S]*?\/>/g,
            ),
        ].map((match) => match[0]);
        const actionOrder = [
            ...actionFooter.matchAll(
                /data-sot-control="(source-test|source-save|source-reconnect|source-disconnect)"/g,
            ),
        ].map((match) => match[1]);
        const statusIndex = actionFooter.indexOf(
            'data-sot-part="source-action-status"',
        );
        const sourceTestIndex = actionFooter.indexOf(
            'data-sot-control="source-test"',
        );
        const sourceSaveIndex = actionFooter.indexOf(
            'data-sot-control="source-save"',
        );

        expect(providerDetail).toContain(
            'data-sot-panel="source-provider-detail"',
        );
        expect(providerDetail).not.toContain("data-sot-section-group");
        expect(content).toContain(
            "const SOURCE_PROVIDER_SECTION_DIVIDER_CLASS =",
        );
        expect(content).toContain(
            "const SOURCE_PROVIDER_ACTION_CLUSTER_DIVIDER_CLASS =",
        );
        expect(content).not.toContain(
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
        expect(providerFieldsIndex).toBeGreaterThanOrEqual(0);
        expect(firstProviderDividerIndex).toBeGreaterThan(providerFieldsIndex);
        expect(autoUpdateDetailIndex).toBeGreaterThan(
            firstProviderDividerIndex,
        );
        expect(enableSyncDetailIndex).toBeGreaterThan(autoUpdateDetailIndex);
        expect(actionClusterDividerIndex).toBeGreaterThan(
            enableSyncDetailIndex,
        );
        expect(sourceActionsDetailIndex).toBeGreaterThan(
            actionClusterDividerIndex,
        );
        expect(actionFooter).toContain('data-sot-panel="source-actions"');
        expect(actionFooter).toContain(
            "data-sot-provider={selectedSource.provider}",
        );
        expect(actionFooter).toContain("data-sot-state={sourceSaveState}");
        expect(actionFooter).toContain("actionMessage?.title ? (");
        expect(actionFooter).toContain("{actionMessage.title}");
        expect(statusIndex).toBeGreaterThanOrEqual(0);
        expect(sourceTestIndex).toBeGreaterThan(statusIndex);
        expect(sourceSaveIndex).toBeGreaterThan(sourceTestIndex);
        const sourceActionStatus = collectElementSlices(
            actionFooter,
            'data-sot-part="source-action-status"',
            "SourceActionStatusBadge",
        )[0];
        expect(sourceActionStatus).toContain("<SourceActionStatusBadge");
        expect(sourceActionStatus).toContain(
            "data-sot-state={actionMessage.state}",
        );
        expect(sourceActionStatus).toContain("state={actionMessage.state}");
        expect(sourceActionStatus).not.toContain(
            "data-sot-state={sourceSaveState}",
        );
        expect(sourceActionStatus).not.toContain("sourceActionStatus");
        expect(sourceActionStatus).not.toContain('variant="secondary"');
        expect(sourceActionStatus).not.toContain("className=");
        expect(sourceActionStatus).not.toContain("showIndicator");
        expect(content).toContain(
            'data-sot-part="source-action-status-indicator"',
        );
        expect(actionFooter).not.toContain("data-save-actions");
        expect(actionFooter).not.toContain("data-save-id");
        expect(actionFooter).not.toContain("data-save-state");
        expect(actionFooter).not.toContain("data-save-status");
        expect(actionFooter).not.toContain("data-save-test");
        expect(actionFooter).not.toContain("data-save-action");
        expect(actionOrder).toEqual(["source-test", "source-save"]);

        const stateBannerBlock =
            dataSourcesPanel.match(
                /\{shouldShowProviderStateBanner[\s\S]*?<ProviderStateBanner[\s\S]*?\/>\s*\)\s*:\s*null\}/,
            )?.[0] ?? "";
        const stateBannerHelper =
            content.match(
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
        expect(content).toContain("SETTINGS_SAVE_ACTIONS_CLASS");
        expect(content).toContain("SETTINGS_SAVE_STATUS_BADGE_CLASS");
        expect(globals).not.toContain('data-sot-actions="source-actions"');
    });

    it("scopes the settings raw copy scan to user-visible data-source copy", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const dataSourcesPanel =
            content.match(
                /function DataSourcesSettingsPanel[\s\S]*?type SectionSaveState/,
            )?.[0] ?? "";

        expect(content).toContain("const safeDescription = isZh");
        expect(content).toContain('["h", "ar"].join("")');
        expect(content).toContain("const SOURCE_WEB_SIGN_IN_AUTH_MODE =");
        expect(content).toMatch(
            /const SOURCE_WEB_SIGN_IN_AUTH_MODE = \["web", "reverse"\]\.join\(\s*"-",\s*\) as SourceAuthMode;/,
        );
        expect(content).not.toMatch(/\bfallback\b/);
        expect(content).not.toContain('["har"].join("")');
        expect(content).not.toContain('"web-reverse"');

        for (const blocker of SETTINGS_PUBLIC_RAW_COPY_BLOCKERS) {
            expect(dataSourcesPanel).not.toContain(blocker);
        }
    });

    it("keeps non-source settings panels connected to stores and save state boundaries", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const displayPanel = content.match(
            /function DisplaySettingsPanel[\s\S]*?function TitleGenerationSettingsPanel/,
        )?.[0];
        const titleGenerationPanel = content.match(
            /function TitleGenerationSettingsPanel[\s\S]*?function VoScriptSettingsPanel/,
        )?.[0];
        const voscriptPanel = content.match(
            /function VoScriptSettingsPanel[\s\S]*?function TranscriptionSettingsPanel/,
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
        const dataSourcesPanel = content.match(
            /function DataSourcesSettingsPanel[\s\S]*?type SectionSaveState/,
        )?.[0];
        const saveStatus = content.match(
            /function SaveStatus[\s\S]*?function SectionShell/,
        )?.[0];
        const saveActions = content.match(
            /function SaveActions[\s\S]*?function useResettingSaveState/,
        )?.[0];
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
            "voscript",
            "transcription",
            "misc",
        ]) {
            expect(content).toContain(`section="${section}"`);
            expect(content).toContain(`case "${section}"`);
        }
        expect(content).not.toContain('case "display"');
        expect(content).not.toContain('case "sync"');
        expect(content).not.toContain('case "playback"');

        expect(content).toContain("function SectionShell");
        expect(content).toContain('data-sot-surface="settings-section"');
        expect(content).toContain('data-sot-panel="settings-scroll-body"');
        expect(content).toContain('data-sot-layout="section"');
        expect(content).toContain("data-sot-section={section}");
        expect(content).toContain("data-sot-state=");
        expect(content).toContain(
            "data-sot-availability={voscriptAvailability}",
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
        expect(content).toMatch(
            /<h3\s+className=\{SETTINGS_SECTION_TITLE_CLASS\}\s+data-sot-title>\s*\{title\}\s*<\/h3>/,
        );
        expect(content).not.toContain("<h3 data-sot-title>{title}</h3>");
        for (const selector of REMOVED_SETTINGS_TITLE_DIVIDER_VISUAL_DATA_SOT_CSS_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(content).toContain("data-sot-section-head");
        expect(content).toContain('from "@/components/ui/field";');
        expect(content).toContain("function SettingsRow");
        expect(content).toContain("<Field");
        expect(content).toContain("<FieldContent");
        expect(content).toContain("<FieldTitle>{label}</FieldTitle>");
        expect(content).toContain(
            "<FieldDescription>{description}</FieldDescription>",
        );
        expect(content).toContain("sotField?: string");
        expect(content).toContain("data-sot-field={sotField}");
        expect(content).toContain('data-sot-state={fieldState ?? "ready"}');
        expect(settingsRow).toContain("{fieldMessage ? (");
        expect(settingsRow).toContain("<FieldError");
        expect(settingsRow).toContain('data-sot-part="settings-field-message"');
        expect(settingsRow).toContain("className={SETTINGS_FIELD_ROW_CLASS}");
        expect(settingsRow).toContain(
            "className={SETTINGS_FIELD_CONTENT_CLASS}",
        );
        expect(settingsRow).toContain(
            "className={SETTINGS_FIELD_CONTROL_CLASS}",
        );
        expect(settingsRow).not.toContain('variant="settingsRow"');
        expect(settingsRow).not.toContain('variant="settingsControl"');
        expect(content).toContain('data-sot-state="invalid"');
        expect(content).toContain(
            'data-invalid={fieldState === "invalid" ? "true" : undefined}',
        );
        expect(content).not.toContain("sm-section-title");
        expect(content).not.toContain("sm-row-name");
        expect(content).toContain("function SaveActions");
        expect(saveStatus).toContain('data-sot-part="settings-save-status"');
        expect(saveStatus).toContain('variant="ghost"');
        expect(saveStatus).toContain("SETTINGS_SAVE_STATUS_BADGE_CLASS");
        expect(saveStatus).toContain("data-sot-state={saveState}");
        expect(content).toContain('data-sot-panel="settings-save-actions"');
        expect(saveActions).toContain(
            "className={SETTINGS_SAVE_ACTIONS_CLASS}",
        );
        expect(content).toContain("data-sot-save-id={saveId ?? section}");
        expect(content).toContain("data-sot-section={section}");
        expect(content).toContain("data-sot-state={saveState}");
        expect(content).toContain('aria-busy={saveState === "saving"}');
        expect(content).toContain('data-sot-action="save"');
        expect(content).toContain('data-sot-control="settings-save"');
        expect(saveActions).toContain('variant="default"');
        expect(saveActions).not.toContain('variant="settingsSave"');
        expect(saveActions).not.toContain('size="settingsSave"');
        for (const directControl of [
            "title-generation-enabled",
            "title-generation-base-url",
            "title-generation-model",
            "title-generation-api-key",
            "transcription-auto-transcribe",
            "voscript-min-speakers",
            "voscript-max-speakers",
            "voscript-base-url",
            "voscript-api-key",
            "voscript-snr-threshold",
            "voscript-no-repeat-ngram",
            "voscript-max-inflight-jobs",
        ]) {
            expect(content).toContain(`data-sot-control="${directControl}"`);
        }
        for (const selectControl of [
            "transcription-language",
            "voscript-api-key-mode",
            "voscript-denoise-model",
        ]) {
            expect(content).toContain(`control="${selectControl}"`);
        }
        expect(titleGenerationPanel).toMatch(
            /draft\.autoGenerateTitle\s*\?\s*"checked"\s*:\s*"unchecked"/,
        );
        expect(transcriptionPanel).toMatch(
            /draft\.autoTranscribe\s*\?\s*"checked"\s*:\s*"unchecked"/,
        );
        expect(titleGenerationPanel).toContain(
            "draft.titleGenerationApiKeySet",
        );
        expect(voscriptPanel).toContain("draft.privateTranscriptionApiKeySet");
        expect(content).toContain('data-sot-state="stored"');
        expect(content).toContain('data-sot-state="invalid"');
        expect(content).toContain("noRepeatNgramInvalid");
        expect(content).toContain("minSpeakersInvalid");
        expect(content).toContain("maxSpeakersInvalid");
        expect(content).toContain('control="density"');
        expect(content).toContain('saveId="voscript-connection"');
        expect(content).toContain('data-sot-action="test"');
        expect(content).toContain('data-sot-control="voscript-test"');
        expect(content).toContain('saveId="voscript-params"');
        const voscriptTestAction = collectElementSlices(
            content,
            'data-sot-control="voscript-test"',
            "Button",
        )[0];
        expect(voscriptTestAction).toContain('variant="ghost"');
        expect(voscriptTestAction).not.toContain(
            'variant="settingsTestAction"',
        );
        expect(voscriptTestAction).not.toContain('size="settingsTestAction"');
        for (const legacySaveHook of [
            "data-save-actions",
            "data-save-id",
            "data-save-state",
            "data-save-status",
            "data-save-action",
            "data-save-test",
        ]) {
            expect(content).not.toContain(legacySaveHook);
        }
        expect(content).toContain('data-sot-banner="voscript-unavailable"');
        expect(content).toContain(
            'data-sot-panel="voscript-unavailable-banner"',
        );
        const voscriptUnavailableBanner =
            voscriptPanel?.match(
                /<Alert\s[^>]*data-sot-banner="voscript-unavailable"[^>]*>/,
            )?.[0] ?? "";
        expect(voscriptUnavailableBanner).toContain('density="comfortable"');
        expect(voscriptUnavailableBanner).toContain("variant={");
        expect(voscriptUnavailableBanner).toContain(
            "className={SETTINGS_BANNER_BASE_CLASS}",
        );
        expect(voscriptUnavailableBanner).not.toContain("className={cn(");
        expect(voscriptUnavailableBanner).toContain(
            'connectionTestState === "test-error"',
        );
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
        expect(globals).toContain('[data-sot-availability="unavailable"]');
        expect(globals).toContain(
            '[data-sot-panel="voscript-unavailable-banner"]',
        );
        for (const legacyVoScriptHook of [
            "data-voscript-availability",
            "data-voscript-unavail",
        ]) {
            expect(content).not.toContain(legacyVoScriptHook);
            expect(globals).not.toContain(legacyVoScriptHook);
        }
        expect(content).toContain('sotField="no-repeat-ngram"');
        expect(content).not.toContain("data-field=");
        expect(content).not.toContain("data-field-state");
        expect(content).not.toContain("data-field-msg");
        expect(content).toContain("isVoScriptNoRepeatNgramInvalid");
        expect(content).toContain("testVoScriptConnection");
        expect(content).toContain("useDisplaySettingsStore");
        expect(content).toContain("useTitleGenerationSettingsStore");
        expect(content).toContain("useVoScriptSettingsStore");
        expect(content).toContain("useTranscriptionSettingsStore");
        expect(content).toContain("useSyncSettingsStore");
        expect(content).toContain("usePlaybackSettingsStore");
        expect(content).toContain("updateDisplaySettings");
        expect(content).toContain("updateTitleGenerationSettings");
        expect(content).toContain("updateVoScriptSettings");
        expect(content).toContain("updateTranscriptionSettings");
        expect(content).toContain("updateSyncSettings");
        expect(content).toContain("updatePlaybackSettings");
        expect(content).toContain("MIN_SYNC_INTERVAL_SECONDS");
        expect(content).toContain("PLAYBACK_SPEED_OPTIONS");
        expect(content).not.toMatch(OLD_UI_RE);

        expect(displayPanel).not.toContain("<SaveActions");
        expect(displayPanel).not.toContain('saveId="appearance"');
        expect(displayPanel).not.toContain("data-save-action");
        expect(displayPanel).not.toContain("sm-actions-state");
        expect(titleGenerationPanel).toContain("<SaveActions");
        expect(titleGenerationPanel).toContain('saveId="title-generation"');
        expect(voscriptPanel).toContain("<SaveActions");
        expect(denoiseOptions).toMatch(/label:\s*"不降噪",\s*value:\s*"none"/);
        expect(denoiseOptions).toMatch(
            /label:\s*"DeepFilterNet",\s*value:\s*"deepfilternet"/,
        );
        expect(denoiseOptions).toMatch(
            /label:\s*"noisereduce",\s*value:\s*"noisereduce"/,
        );
        expect(denoiseOptions).not.toContain('"关闭"');
        expect(denoiseOptions).not.toContain('"Noisereduce"');
        expect(dataSourcesPanel).toContain('data-sot-panel="source-actions"');
        expect(dataSourcesPanel).toContain(
            'data-sot-part="source-action-status"',
        );
        expect(dataSourcesPanel).toContain('data-sot-control="source-test"');
        expect(dataSourcesPanel).toContain('data-sot-control="source-save"');
        expect(dataSourcesPanel).toContain('data-sot-action="test"');
        expect(dataSourcesPanel).toContain('data-sot-action="save"');
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

    it("keeps VoScript no-repeat n-gram validation inline before persistence", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const voscriptPanel = content.match(
            /function VoScriptSettingsPanel[\s\S]*?function TranscriptionSettingsPanel/,
        )?.[0];
        const saveFunction = voscriptPanel?.match(
            /const saveRuntimeParams = async[\s\S]*?const testConnection = async/,
        )?.[0];
        const settingsRow = content.match(
            /function SettingsRow[\s\S]*?function SelectControl/,
        )?.[0];
        const noRepeatRow = voscriptPanel?.match(
            /<SettingsRow[\s\S]*?sotField="no-repeat-ngram"[\s\S]*?<SaveActions/,
        )?.[0];

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
        expect(noRepeatRow).toContain('sotField="no-repeat-ngram"');
        expect(noRepeatRow).toContain(
            'fieldState={noRepeatNgramInvalid ? "invalid" : undefined}',
        );
        expect(noRepeatRow).toContain("aria-invalid={noRepeatNgramInvalid}");
        expect(noRepeatRow).toContain("fieldMessage={");
        expect(noRepeatRow).toContain("noRepeatNgramMessage");
        expect(settingsRow).toContain("data-sot-field={sotField}");
        expect(settingsRow).toContain('data-sot-part="settings-field-message"');
        expect(settingsRow).toContain('data-sot-state="invalid"');
        expect(settingsRow).toContain(
            'data-invalid={fieldState === "invalid" ? "true" : undefined}',
        );
        expect(settingsRow).toContain("{fieldMessage}");
        expect(noRepeatRow).toContain('placeholder={isZh ? "0 或 ≥ 3"');
        expect(saveFunction).toContain("if (noRepeatNgramInvalid)");
        expect(saveFunction).toContain('paramsSave.setSaveState("error")');
        expect(saveFunction).toContain("paramsSave.setSaveError");
        expect(saveFunction).toContain("noRepeatNgramMessage");
        expect(saveFunction).toContain("return;");
        expect(saveFunction).toMatch(
            /if \(noRepeatNgramInvalid\)[\s\S]*?return;[\s\S]*?const updates: VoScriptSettingsUpdate/,
        );
        expect(saveFunction).toContain(
            'await persistVoScriptSettingsLane(paramsSave, "params", updates)',
        );
    });

    it("keeps VoScript speaker bounds validation inline before persistence", () => {
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const voscriptPanel = content.match(
            /function VoScriptSettingsPanel[\s\S]*?function TranscriptionSettingsPanel/,
        )?.[0];
        const speakerRows = content.match(
            /function VoScriptSpeakerRows[\s\S]*?function VoScriptSettingsPanel/,
        )?.[0];
        const saveFunction = voscriptPanel?.match(
            /const saveRuntimeParams = async[\s\S]*?const testConnection = async/,
        )?.[0];
        const settingsRow = content.match(
            /function SettingsRow[\s\S]*?function SelectControl/,
        )?.[0];
        const minSpeakersRow = speakerRows?.match(
            /<SettingsRow[\s\S]*?sotField="min-speakers"[\s\S]*?<\/SettingsRow>/,
        )?.[0];
        const maxSpeakersRow = speakerRows?.match(
            /<SettingsRow[\s\S]*?sotField="max-speakers"[\s\S]*?<\/SettingsRow>/,
        )?.[0];
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
        expect(minSpeakersRow).toContain('sotField="min-speakers"');
        expect(minSpeakersRow).toContain(
            'fieldState={minSpeakersInvalid ? "invalid" : undefined}',
        );
        expect(minSpeakersRow).toContain("fieldMessage={minSpeakersMessage}");
        expect(minSpeakersRow).toContain("aria-invalid={minSpeakersInvalid}");
        expect(maxSpeakersRow).toContain('sotField="max-speakers"');
        expect(maxSpeakersRow).toContain(
            'fieldState={maxSpeakersInvalid ? "invalid" : undefined}',
        );
        expect(maxSpeakersRow).toContain("fieldMessage={maxSpeakersMessage}");
        expect(maxSpeakersRow).toContain("aria-invalid={maxSpeakersInvalid}");
        expect(settingsRow).toContain("data-sot-field={sotField}");
        expect(settingsRow).toContain('data-sot-part="settings-field-message"');
        expect(settingsRow).toContain('data-sot-state="invalid"');
        expect(speakerBoundsGuard).toContain(
            'paramsSave.setSaveState("error")',
        );
        expect(speakerBoundsGuard).toContain(
            "paramsSave.setSaveError(resolvedSpeakerBoundsMessage)",
        );
        expect(saveFunction).toMatch(
            /if \(resolvedSpeakerBoundsMessage\)[\s\S]*?return;[\s\S]*?const updates: VoScriptSettingsUpdate[\s\S]*?await persistVoScriptSettingsLane\(paramsSave, "params", updates\)/,
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
        const segmentOptionClass =
            content.match(
                /const SETTINGS_SEGMENT_OPTION_CLASS[\s\S]*?;/,
            )?.[0] ?? "";
        const themeOptions = content.match(
            /const themeOptions:[\s\S]*?const languageOptions:/,
        )?.[0];
        const dateTimeOptions = content.match(
            /const dateTimeOptions:[\s\S]*?const densityOptions:/,
        )?.[0];
        const densityOptions = content.match(
            /const densityOptions:[\s\S]*?const sortOptions:/,
        )?.[0];

        expect(content).toContain("sotValue?: string");
        expect(content).not.toContain("data-seg=");
        expect(content).not.toContain("data-v=");
        expect(segmentControl).toContain(
            'data-sot-panel="settings-segment-control"',
        );
        expect(segmentControl).toContain("data-sot-control={control}");
        expect(segmentControl).toContain(
            "className={SETTINGS_SEGMENT_GROUP_CLASS}",
        );
        expect(segmentControl).toContain('variant="outline"');
        expect(segmentControl).toContain('size="sm"');
        expect(segmentControl).toContain("spacing={1}");
        expect(segmentControl).toContain(
            "className={SETTINGS_SEGMENT_OPTION_CLASS}",
        );
        expect(segmentOptionClass).toContain("data-[state=on]");
        expect(segmentOptionClass).not.toContain("data-[sot-state=");
        expect(segmentControl).not.toContain('layout="settingsSegment"');
        expect(segmentControl).not.toContain('variant="settingsSegmentOption"');
        expect(segmentControl).not.toContain('size="settingsSegmentOption"');
        expect(segmentControl).not.toContain(
            'spacing="settingsSegmentSpacing"',
        );
        expect(segmentControl).toContain("data-sot-value={option.value}");
        expect(segmentControl).toContain(
            "data-sot-display-value={option.sotValue ?? option.value}",
        );
        expect(segmentControl).toContain("value={option.value}");
        expect(themeOptions).toMatch(
            /label:\s*isZh \? "自动" : "Auto",\s*value:\s*"system",\s*sotValue:\s*"auto"/,
        );
        expect(themeOptions).toContain('value: "light"');
        expect(themeOptions).toContain('value: "dark"');
        expect(dateTimeOptions).toMatch(
            /label:\s*isZh \? "2 小时前" : "2 hours ago",\s*value:\s*"relative",\s*sotValue:\s*"rel"/,
        );
        expect(dateTimeOptions).toMatch(
            /label:\s*"14:00",\s*value:\s*"absolute",\s*sotValue:\s*"abs"/,
        );
        expect(densityOptions).toContain('value: "comfy"');
        expect(densityOptions).toContain('value: "compact"');
        expect(densityOptions).not.toContain("sotValue");
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
        const content = readSource(
            "features/settings/components/settings-content.tsx",
        );
        const maxInflightClamp = content.match(
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
        const sectionLoadRetryButton = content.match(
            /<Button[\s\S]*?data-sot-control="settings-section-load-retry"[\s\S]*?<\/Button>/,
        )?.[0];

        expect(sectionLoadErrorBanner).toBeDefined();
        expect(sectionLoadErrorBanner ?? "").toContain(
            'variant="destructiveSoft"',
        );
        expect(sectionLoadErrorBanner ?? "").toContain('density="comfortable"');
        expect(sectionLoadErrorBanner ?? "").toContain(
            "className={SETTINGS_BANNER_BASE_CLASS}",
        );
        expect(sectionLoadErrorBanner ?? "").not.toContain(
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
        expect(sectionLoadRetryButton).toContain(
            'data-sot-control="settings-section-load-retry"',
        );
        expect(sectionLoadRetryButton).toContain('variant="default"');
        expect(sectionLoadRetryButton).toContain("onClick={onRetry}");
        expect(sectionLoadRetryButton).toContain("data-sot-section={section}");
        expect(sectionLoadRetryButton).not.toContain(
            'variant="settingsSectionRetry"',
        );
        expect(sectionLoadRetryButton).not.toContain(
            'size="settingsSectionRetry"',
        );
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
        const avatarFallbacks =
            speakers.match(/<AvatarFallback\b[^>]*>/g) ?? [];
        const speakerStateBadges = speakers.match(/<Badge\b[^>]*>/g) ?? [];
        const speakerRowFields =
            speakers.match(
                /<Field(?!Content|Description|Label|Title)\b[^>]*>/g,
            ) ?? [];
        const speakerStateBadgeOpenings = speakerStateBadges.filter((badge) =>
            badge.includes('data-sot-badge="speaker-state"'),
        );
        const speakerButtons =
            speakers.match(/<Button\b[\s\S]*?<\/Button>/g) ?? [];
        const findButtonByControl = (control: string) =>
            speakerButtons.find((button) =>
                button.includes(`data-sot-control="${control}"`),
            ) ?? "";
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

            expect(button).toContain(`data-sot-control="${control}"`);
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

            expect(button).toContain(`data-sot-control="${control}"`);
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
        expect(speakers).toMatch(
            /import\s*\{[\s\S]*Field,[\s\S]*FieldContent,[\s\S]*FieldDescription,[\s\S]*FieldLabel,[\s\S]*FieldTitle[\s\S]*\}\s*from "@\/components\/ui\/field";/,
        );
        for (const primitiveSource of [
            avatarPrimitive,
            badgePrimitive,
            buttonPrimitive,
            fieldPrimitive,
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
        expect(speakers).toContain('data-sot-badge="speaker-state"');
        expect(speakers).toContain("data-sot-tone={tone}");
        expectFeatureOwnedSnippets("speaker state badge", [
            "h-5",
            "gap-1",
            "rounded-full",
            "border",
            "text-[10.5px]",
            "font-semibold",
            "data-[sot-tone=success]",
            "data-[sot-tone=warning]",
            "data-[sot-tone=neutral]",
        ]);
        expect(speakerStateBadgeOpenings).toHaveLength(1);
        for (const badge of speakerStateBadgeOpenings) {
            expect(badge).toContain("className=");
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
        expectFeatureOwnedSnippets("speaker profile row visuals", [
            "speakerProfilesPanelClassName",
            "relative flex flex-col gap-2 !mb-3.5",
            "speakerSectionGroupClassName",
            "relative mb-[22px]",
            "speakerRowsListClassName",
            "m-0 flex list-none flex-col gap-1.5 p-0",
            "speakerRowItemClassName",
            "grid min-w-0 grid-cols-[36px_minmax(0,1fr)_auto_auto]",
            "border-[var(--card-elevated-border)]",
            "bg-[var(--bg-elevated)]",
            "hover:bg-[var(--bg-recessed)]",
            "speakerRowMetaClassName",
            "flex min-w-0 flex-col gap-0.5",
            "speakerRowSubClassName",
            "font-mono text-[11.5px] font-medium leading-[1.4] tracking-normal text-[var(--fg-tertiary)]",
        ]);
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
        expect(speakers).toContain("<FieldTitle>");
        expect(speakers).toContain("<FieldLabel");
        expect(speakers).toContain("<FieldDescription>");
        expect(speakers).toContain("speakerSettingsBannerBaseClassName");
        expect(speakers).toContain("speakerSettingsBannerLayoutClassName");
        expect(speakers).toContain(
            "speakerSettingsBannerActionLayoutClassName",
        );
        expect(speakers).toContain("speakerSettingsBannerErrorClassName");
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
        expect(speakers).toContain("data-sot-state={profilesState}");
        expect(speakers).toContain(
            "data-sot-voiceprints-state={voiceprintsState}",
        );
        expect(speakers).toMatch(
            /<div\s+className=\{speakerSectionGroupClassName\}\s+data-sot-panel="speaker-profiles-local"\s+data-sot-section-group\s+data-sot-state=\{profilesState\}/,
        );
        expect(speakers).toContain('data-sot-panel="speaker-voiceprints"');
        expect(speakers).toMatch(
            /<div\s+className=\{speakerSectionGroupClassName\}\s+data-sot-panel="speaker-voiceprints"\s+data-sot-section-group\s+data-sot-state=\{voiceprintsState\}/,
        );
        expect(speakers).toContain("data-sot-speaker-profile-row");
        expect(speakers).toContain("data-sot-voiceprint-row");
        expect(speakers).toContain('data-sot-list="speaker-profile-rows"');
        expect(speakers).toContain('data-sot-item="speaker-profile-row"');
        expect(speakers).toContain('data-sot-part="speaker-profile-avatar"');
        expect(speakers).toContain('data-sot-part="speaker-profile-row-meta"');
        expect(speakers).toContain('data-sot-part="speaker-profile-row-sub"');
        expect(speakers).toContain('data-sot-list="speaker-voiceprint-rows"');
        expect(speakers).toContain('data-sot-item="speaker-voiceprint-row"');
        expect(speakers).toContain('data-sot-part="speaker-voiceprint-avatar"');
        expect(speakers).toContain(
            'data-sot-part="speaker-voiceprint-row-meta"',
        );
        expect(speakers).toContain(
            'data-sot-part="speaker-voiceprint-row-sub"',
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
        expect(
            collectCssRuleBlocks(globals, '[data-sot-badge="speaker-state"]'),
        ).toEqual([]);
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

    it("keeps settings skeletons on SOT loading primitives", () => {
        const skeletons = readSource(
            "features/settings/components/settings-skeletons.tsx",
        );
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");
        const globals = readSource("app/globals.css");

        expect(skeletons).toContain('data-sot-panel="settings-card-skeleton"');
        expect(skeletons).toContain(
            'data-sot-panel="settings-section-skeleton"',
        );
        expect(skeletons).toContain('data-sot-panel="settings-list-skeleton"');
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
        expect(skeletons).toContain('data-sot-part="settings-skeleton-row"');
        expect(skeletons).toContain('data-sot-panel="settings-empty-hint"');
        expect(skeletons).toContain('data-sot-part="settings-empty-title"');
        expect(skeletons).toContain(
            'data-sot-part="settings-empty-description"',
        );
        expect(skeletons).toContain(
            'data-sot-part="settings-skeleton-sync-dot"',
        );
        expect(skeletons).toContain("SKELETON_SYNC_DOT_CLASS");
        expect(skeletons).toContain("size-2 rounded-full");
        expect(skeletons).toContain("bg-primary");
        expect(skeletons).toContain("ring-4 ring-primary/20");
        expect(skeletons).not.toContain("color-mix(");
        expect(skeletons).not.toContain("bg-[var(--signal-success)]");
        expect(globals).not.toContain(
            '[data-sot-part="settings-skeleton-sync-dot"]',
        );
        for (const selector of REMOVED_SETTINGS_SKELETON_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(skeletons).toContain(
            'import { Field, FieldContent } from "@/components/ui/field";',
        );
        expect(skeletons).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
        expect(skeletons).toContain('import { cn } from "@/lib/utils";');
        expect(skeletons).toContain("<Field");
        expect(skeletons).toContain('orientation="horizontal"');
        expect(skeletons).toContain("<FieldContent>");
        expect(skeletons).toContain("makeSkeletonKeys(");
        expect(skeletons).toContain("<Skeleton");
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
    });
});
