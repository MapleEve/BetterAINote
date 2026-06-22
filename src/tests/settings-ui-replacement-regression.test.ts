import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function expectOnlyAllowedGlobalSlotSelectors(globals: string) {
    const slotSelectors = globals
        .split("\n")
        .filter((line) => line.includes('[data-slot="'))
        .filter(
            (line) =>
                !line.includes(
                    '[data-slot="toggle-group-item"][data-variant="swatch"]',
                ),
        );

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

function readCssBlocks(source: string, marker: string) {
    const blocks: string[] = [];
    let searchIndex = 0;

    while (searchIndex < source.length) {
        const markerIndex = source.indexOf(marker, searchIndex);

        if (markerIndex < 0) {
            break;
        }

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
                blocks.push(source.slice(openBraceIndex + 1, index));
                searchIndex = index + 1;
                break;
            }
        }
    }

    expect(blocks.length).toBeGreaterThan(0);
    return blocks;
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

const OLD_UI_RE =
    /uikit-|glass-surface|glass-control|CardContent|from "@\/components\/ui\/card"|bg-muted/;

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

const FORBIDDEN_CONFIRM_BUTTON_PRIMITIVE_REPAINT_DECLARATION =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|letter-spacing|line-height|padding|transition)\s*:|\b(?:color-mix|oklch|linear-gradient)\(/m;

const FORBIDDEN_SETTINGS_DATA_SOURCE_PRIMITIVE_REPAINT_DECLARATION =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|letter-spacing|line-height|padding|transition|width)\s*:|\b(?:color-mix|oklch|linear-gradient)\(/m;

const SETTINGS_DATA_SOURCE_PRIMITIVE_REPAINT_TARGETS = [
    {
        label: "provider detail fields",
        preludeIncludes: ['[data-sot-panel="source-provider-detail"]'],
        selectorFragment: '[data-slot="field"]',
    },
    {
        label: "provider detail field descriptions",
        preludeIncludes: ['[data-sot-panel="source-provider-detail"]'],
        selectorFragment: '[data-slot="field-description"]',
    },
    {
        label: "provider detail inputs",
        preludeIncludes: ['[data-sot-panel="source-provider-detail"]'],
        selectorFragment: '[data-slot="input"]',
    },
    {
        label: "settings fields",
        preludeIncludes: ['[data-sot-panel="settings-scroll-body"]'],
        selectorFragment: '[data-slot="field"]',
    },
    {
        label: "settings inputs",
        preludeIncludes: ['[data-sot-panel="settings-scroll-body"]'],
        selectorFragment: '[data-slot="input"]',
    },
    {
        label: "settings save buttons",
        preludeIncludes: ['[data-sot-panel="settings-save-actions"]'],
        selectorFragment: '[data-slot="button"]',
    },
    {
        label: "source action buttons",
        preludeIncludes: ['[data-sot-panel="source-actions"]'],
        selectorFragment: '[data-slot="button"]',
    },
    {
        label: "provider meta card header",
        preludeIncludes: ['[data-sot-part="provider-meta"]'],
        selectorFragment: '[data-slot="card-header"]',
    },
    {
        label: "settings badges",
        preludeIncludes: ['[data-sot-panel="settings-scroll-body"]'],
        selectorFragment: '[data-slot="badge"]',
    },
] as const;

const SETTINGS_MAIN_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-panel="settings-scroll-body"],',
    '[data-sot-panel="settings-scroll-body"][data-sot-layout="three-pane"]',
    '[data-sot-panel="settings-scroll-body"][hidden]',
    '[data-sot-panel="settings-scroll-body"]\n    [data-sot-panel="settings-save-actions"]',
    '[data-sot-panel="settings-scroll-body"] [data-sot-panel="source-actions"]',
    '[data-sot-panel="settings-scroll-body"] [data-sot-part="settings-save-status"]',
    '[data-sot-panel="settings-scroll-body"] [data-sot-part="source-action-status"]',
    '[data-sot-panel="settings-scroll-body"]\n    [data-sot-panel="settings-save-actions"][data-sot-state="idle"]',
    '[data-sot-panel="settings-scroll-body"]\n    [data-sot-panel="source-actions"][data-sot-state="idle"]',
    '[data-sot-panel="settings-scroll-body"]\n    [data-sot-panel="settings-save-actions"][data-sot-state="saving"]',
    '[data-sot-panel="settings-scroll-body"]\n    [data-sot-panel="source-actions"][data-sot-state="saving"]',
    '[data-sot-panel="settings-scroll-body"][data-sot-availability="unavailable"]',
    '[data-sot-panel="settings-save-actions"] {\n    align-items: center;',
    '[data-sot-panel="source-actions"] {\n    align-items: center;',
] as const;

const LEGACY_MODAL_SHELL_CSS_SELECTOR_RE =
    /(^|[,\s>{])\.(?:scrim|modal|modal-head|modal-icon|modal-title|modal-desc|modal-body|modal-foot)(?![\w-])/m;

const MODAL_SHELL_DATA_SOT_CSS_SELECTORS = [
    '[data-sot-overlay="settings-shell"]',
    '[data-sot-overlay="confirm-dialog"]',
    '[data-sot-panel="confirm-dialog"]',
    '[data-sot-overlay="settings-shell"][data-state="open"]',
    '[data-sot-overlay="confirm-dialog"][data-state="closed"]',
    '[data-sot-surface="settings-shell"],',
    '[data-sot-content="confirm-dialog"]',
    '[data-sot-surface="settings-shell"][data-state="closed"]',
    '[data-sot-content="confirm-dialog"][data-state="closed"]',
    '[data-sot-part="dialog-icon"]',
    '[data-sot-part="confirm-head"]',
    '[data-sot-part="confirm-body"]',
    '[data-sot-part="confirm-foot"]',
] as const;

const DIALOG_SLOT_GLOBAL_SELECTORS = [
    '[data-slot="dialog-header"]',
    '[data-slot="dialog-title"]',
    '[data-slot="dialog-description"]',
    '[data-slot="dialog-footer"]',
] as const;

function readProductCss(source: string) {
    const componentLibraryIndex = source.indexOf(
        "BetterAINote · Component Library",
    );
    expect(componentLibraryIndex).toBeGreaterThan(0);
    return source.slice(0, componentLibraryIndex);
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

function collectScopedPrimitiveRepaintBlocks(
    source: string,
    target: (typeof SETTINGS_DATA_SOURCE_PRIMITIVE_REPAINT_TARGETS)[number],
) {
    return collectCssRuleBlocks(source, target.selectorFragment).filter(
        ({ prelude, declarations }) =>
            target.preludeIncludes.every((fragment) =>
                prelude.includes(fragment),
            ) &&
            FORBIDDEN_SETTINGS_DATA_SOURCE_PRIMITIVE_REPAINT_DECLARATION.test(
                declarations,
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
            'variant="settingsClose"',
            "Button",
        );
        const [settingsNavButton] = collectElementSlices(
            dialog,
            'variant="settingsNav"',
            "Button",
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
        expect(dialog).toContain('className="shrink-0"');
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
        expect(buttonPrimitive).toContain("settingsClose:");
        expect(buttonPrimitive).toContain("settingsNav:");
        expect(settingsCloseButton).toContain(
            'data-sot-control="settings-close"',
        );
        expect(settingsCloseButton).toContain('variant="settingsClose"');
        expect(settingsCloseButton).toContain('size="settingsClose"');
        expect(settingsNavButton).toContain('data-sot-control="settings-nav"');
        expect(settingsNavButton).toContain('variant="settingsNav"');
        expect(settingsNavButton).toContain('size="settingsNav"');
        for (const settingsControlButton of [
            settingsCloseButton,
            settingsNavButton,
        ]) {
            expect(settingsControlButton).not.toContain('variant="ghost"');
            expect(settingsControlButton).not.toContain('size="icon-sm"');
            expect(settingsControlButton).not.toContain('size="sm"');
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
        expect(globals).toContain("z-index: var(--z-modal)");
        expect(globals).not.toContain(".ui-select-content");
        expect(globals).not.toContain("z-index: 650");
        expect(globals).not.toContain(
            '.scrim[data-open="false"] > [data-sot-surface="settings-shell"]',
        );
        expect(globals).toContain(
            '[data-sot-surface="settings-shell"][data-state="closed"]',
        );
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
        for (const selector of MODAL_SHELL_DATA_SOT_CSS_SELECTORS) {
            expect(productCss).toContain(selector);
        }
        expect(
            readCssBlock(productCss, '[data-sot-panel="confirm-dialog"]'),
        ).toContain("z-index: calc(var(--z-modal) + 2);");
        for (const selector of DIALOG_SLOT_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
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
        expect(globals).toContain(".cl-stage-canvas > .scrim");
        expect(globals).toContain(".cl-stage-scrim > .scrim");
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
        expect(sharedSelect).not.toContain("<select");
        expect(sharedSelect).not.toContain("<option");
    });

    it("keeps settings main product CSS on data-sot selectors only", () => {
        const globals = readSource("app/globals.css");

        for (const [pattern, label] of LEGACY_SETTINGS_SHELL_CSS_SELECTORS) {
            expect(globals, `globals should not use ${label}`).not.toMatch(
                pattern,
            );
        }
        for (const selector of SETTINGS_MAIN_DATA_SOT_CSS_SELECTORS) {
            expect(globals).toContain(selector);
        }
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
        const baseBodyCss = readCssBlock(
            globals,
            '[data-sot-panel="settings-body"] {\n    display: grid;',
        );
        const baseRailCss = readCssBlock(
            globals,
            '[data-sot-panel="settings-rail"]',
        );
        const mobileSettingsCss = readCssBlock(
            globals,
            "@media (max-width: 720px)",
        );
        const baseUserCss = readCssBlock(
            globals,
            '[data-sot-part="settings-user-summary"]',
        );
        const baseUserTextCss = readCssBlock(
            globals,
            '[data-sot-part="settings-user-summary"] > div',
        );
        const mobileHeaderCss = readCssBlock(
            mobileSettingsCss,
            '[data-sot-panel="settings-header"]',
        );
        const mobileTextCss = readCssBlock(
            mobileSettingsCss,
            '[data-sot-part="settings-user-name"],\n    [data-sot-part="settings-user-subtitle"]',
        );

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

        expect(baseBodyCss).toContain("grid-template-columns: 200px 1fr;");
        expect(baseRailCss).toContain("display: flex;");
        expect(mobileHeaderCss).toContain("flex-wrap: wrap;");
        expect(mobileHeaderCss).toContain("align-items: flex-start;");
        expect(baseUserCss).toContain("min-width: 0;");
        expect(baseUserTextCss).toContain("min-width: 0;");
        expect(mobileTextCss).toContain("overflow: hidden;");
        expect(mobileTextCss).toContain("text-overflow: ellipsis;");
        expect(mobileTextCss).toContain("white-space: nowrap;");

        expect(mobileSettingsCss).not.toContain(".settings-section-select");
        expect(mobileSettingsCss).not.toMatch(
            /\[data-sot-panel="settings-body"\]\s*{[\s\S]*?grid-template-columns:\s*1fr;[\s\S]*?}/,
        );
        expect(mobileSettingsCss).not.toMatch(
            /\[data-sot-panel="settings-rail"\]\s*{[\s\S]*?display:\s*none;[\s\S]*?}/,
        );
    });

    it("keeps the data-source three-pane shell from stacking on mobile", () => {
        const globals = readSource("app/globals.css");
        const mobileBlocks = readCssBlocks(
            globals,
            "@media (max-width: 720px)",
        );

        for (const mobileBlock of mobileBlocks) {
            expect(mobileBlock).not.toMatch(
                /\.settings-main\.three-pane\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
            );
            expect(mobileBlock).not.toMatch(
                /\.settings-main\.three-pane\s*{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/,
            );
            expect(mobileBlock).not.toMatch(
                /\[data-sot-panel="settings-scroll-body"\]\[data-sot-layout="three-pane"\]\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
            );
            expect(mobileBlock).not.toMatch(
                /\[data-sot-panel="settings-scroll-body"\]\[data-sot-layout="three-pane"\]\s*{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/,
            );
        }
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
        expect(globals).toContain(
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
            /<div data-sot-part="source-providers-title">[\s\S]*?<\/div>/,
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
        expect(sourceAuthModeControl).toContain(
            'layout="settingsSourceAuthMode"',
        );
        expect(sourceAuthModeControl).toContain(
            'variant="settingsSourceAuthModeOption"',
        );
        expect(sourceAuthModeControl).toContain(
            'size="settingsSourceAuthModeOption"',
        );
        expect(sourceAuthModeControl).toContain(
            'spacing="settingsSourceAuthMode"',
        );
        expect(sourceAuthModeControl).toContain(
            'variant="sourceAuthModeBadge"',
        );
        expect(sourceAuthModeControl).not.toContain('variant="outline"');
        expect(sourceAuthModeControl).not.toContain('variant="secondary"');
        expect(sourceAuthModeControl).not.toContain('size="lg"');
        expect(sourceAuthModeControl).not.toContain("spacing={2}");
        expect(sourceAuthModeControl).not.toContain(
            'className="mb-4 grid w-full grid-cols-2 items-stretch"',
        );
        expect(sourceAuthModeControl).not.toContain(
            'className="h-auto flex-col items-start justify-start whitespace-normal px-3.5 py-3 text-left"',
        );
        expect(content).toContain("data-sot-auth-mode={mode}");
        expect(content).toContain('data-sot-part="source-auth-mode-title"');
        expect(content).toContain(
            'data-sot-part="source-auth-mode-description"',
        );
        expect(content).toContain('data-sot-badge="source-auth-mode"');
        expect(content).toContain("data-sot-tone={");
        expect(content).toContain('tone: "recommended"');
        expect(content).toContain('tone: "personal"');
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
        expect(content).toContain("data-sot-section-group");
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
        expect(settingFieldControl).toContain("<FieldDescription>");
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
        const sourceLoadErrorOpening = sourceLoadError?.match(
            /<Alert\s[^>]*>/,
        )?.[0];
        const retryButton = sourceLoadError?.match(
            /<Button[\s\S]*?<\/Button>/,
        )?.[0];

        expect(sourceLoadError).toContain('data-sot-panel="source-load-error"');
        expect(sourceLoadErrorOpening).toContain('variant="settingsLoadError"');
        expect(sourceLoadErrorOpening).toContain('density="settingsBanner"');
        expect(sourceLoadErrorOpening).toContain('layout="settingsBannerAction"');
        expect(sourceLoadErrorOpening).not.toContain('variant="destructive"');
        expect(sourceLoadErrorOpening).not.toContain(
            "getSettingsBannerClassName",
        );
        expect(sourceLoadErrorOpening).not.toContain("grid-cols-[auto_1fr");
        expect(sourceLoadErrorOpening).not.toContain(
            "border-destructive/30 bg-destructive/10",
        );
        expect(sourceLoadError).toContain("<AlertTitle");
        expect(sourceLoadError).toContain("<AlertDescription");
        expect(retryButton).toContain('data-sot-control="source-load-retry"');
        expect(retryButton).toContain('variant="settingsSourceRetry"');
        expect(retryButton).toContain('size="settingsSourceRetry"');
        expect(retryButton).not.toContain('variant="default"');
        expect(retryButton).not.toContain('size="sm"');
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
                /<div[\s\S]*?data-sot-part="source-provider-header"[\s\S]*?>/,
            )?.[0] ?? "";

        expect(content).not.toMatch(
            /data-provider=|data-selected=|data-dimmed=|data-provider-detail=|data-ds-state=/,
        );
        expect(providerTile).toContain('data-sot-control="source-provider"');
        expect(providerTile).toContain('variant="sourceProviderTile"');
        expect(providerTile).toContain('size="sourceProviderTile"');
        expect(providerTile).toContain("aria-pressed={isSelected}");
        expect(providerTile).toContain("data-sot-provider={source.provider}");
        expect(providerTile).toContain(
            'data-sot-state={isSelected ? "selected" : "idle"}',
        );
        expect(providerTile).toContain("data-sot-status={status.state}");
        expect(providerTile).toContain(
            'data-sot-dimmed={isDimmed ? "true" : "false"}',
        );
        expect(providerTile).toContain('variant="sourceProviderStatus"');
        expect(providerTile).toContain("data-sot-tone={status.tone}");
        expect(detailRoot).toContain('data-sot-panel="source-provider-detail"');
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

    it("keeps provider Button and Badge primitive skin in shadcn variants", () => {
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
        const providerTileButton =
            providerTile.match(
                /<Button[\s\S]*?data-sot-control="source-provider"[\s\S]*?>/,
            )?.[0] ?? "";
        const sourceActionArea =
            content.match(
                /<footer[\s\S]*?data-sot-panel="source-actions"[\s\S]*?data-sot-part="source-disconnect-row"[\s\S]*?<\/Field>/,
            )?.[0] ?? "";

        expect(content).not.toContain("getProviderTileVariant");
        expect(content).not.toContain("getProviderStatusBadgeVariant");
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
        expect(providerStateBanner).toContain('density="settingsBanner"');
        expect(providerStateBanner).toContain('layout="settingsBanner"');
        expect(providerStateBanner).toContain('"settingsBannerError"');
        expect(providerStateBanner).toContain('"settingsBanner"');
        expect(providerStateBanner).not.toContain("getSettingsBannerClassName");
        expect(providerStateBanner).not.toContain('variant="destructive"');
        expect(providerStateBanner).not.toContain("grid-cols-[auto_1fr");
        expect(providerStateBanner).not.toContain(
            "border-destructive/30 bg-destructive/10",
        );
        expect(providerTile).toContain('variant="sourceProviderTile"');
        expect(providerTile).toContain('size="sourceProviderTile"');
        expect(providerTileButton).not.toContain("className=");
        expect(providerTile).not.toContain(
            'className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-[var(--line-hairline)] bg-white"',
        );
        expect(providerTile).not.toContain(
            'className="flex min-w-0 flex-col gap-[2px]"',
        );
        expect(providerTile).not.toContain('className="truncate font-sans');
        expect(providerTile).not.toContain('className="truncate font-mono');
        expect(providerTile).not.toMatch(/![a-z\[]/);
        expect(providerTile).toContain('variant="sourceProviderStatus"');
        expect(providerTile).toContain('"justify-self-end"');
        expect(providerTile).not.toContain('"animate-pulse"');
        expect(providerTile).not.toContain(
            '"size-[4px] rounded-full bg-current"',
        );
        expect(button).toContain(
            "[&_[data-sot-part=source-provider-mark]]:size-7",
        );
        expect(button).toContain(
            "[&_[data-sot-part=source-provider-mark]]:rounded-[7px]",
        );
        expect(button).toContain(
            "[&_[data-sot-part=source-provider-mark]]:bg-white",
        );
        expect(button).toContain(
            "[&_[data-sot-part=source-provider-meta]]:flex",
        );
        expect(button).toContain("[&_[data-sot-provider-name]]:truncate");
        expect(button).toContain(
            "[&_[data-sot-provider-name]]:text-[13px]",
        );
        expect(button).toContain("[&_[data-sot-provider-hint]]:truncate");
        expect(button).toContain(
            "[&_[data-sot-provider-hint]]:text-[11.5px]",
        );
        expect(sourceActionArea).toContain('variant="sourceProviderAction"');
        expect(sourceActionArea).toContain(
            'variant="sourceProviderActionPrimary"',
        );
        expect(sourceActionArea).toContain(
            'variant="sourceProviderActionDanger"',
        );
        expect(sourceActionArea).toContain('size="sourceProviderAction"');
        expect(sourceActionArea).not.toContain("SOURCE_PROVIDER_");
        expect(sourceActionArea).not.toMatch(/![a-z\[]/);
        expect(button).toContain("sourceProviderTile:");
        expect(button).toContain("sourceProviderAction:");
        expect(button).toContain("sourceProviderActionPrimary:");
        expect(button).toContain("sourceProviderActionDanger:");
        expect(button).toContain("data-[state=selected]");
        expect(button).toContain("data-[sot-dimmed=true]");
        expect(button).toContain("data-[sot-state=error]:text-destructive");
        expect(button).toContain("data-[sot-state=success]:text-primary");
        expect(toggleGroup).toContain("settingsSourceAuthMode:");
        expect(toggleGroup).toContain("settingsSourceAuthModeOption:");
        expect(badge).toContain("sourceProviderStatus:");
        expect(badge).toContain("sourceProviderDetailStatus:");
        expect(badge).toContain("sourceAuthModeBadge:");
        expect(badge).toContain("sourceActionStatus:");
        expect(badge).toContain("data-[sot-tone=ok]");
        expect(badge).toContain("data-[sot-tone=warn]");
        expect(badge).toContain("data-[sot-tone=err]");
        expect(badge).toContain("data-[sot-tone=neu]");
        expect(badge).toContain("data-[sot-tone=recommended]");
        expect(badge).toContain("data-[sot-tone=personal]");
        expect(badge).toContain(
            "[&_[data-sot-part=source-action-status-indicator]]",
        );
        expect(badge).toContain("[&_[data-sot-provider-status-dot]]:size-[4px]");
        expect(badge).toContain(
            "[&_[data-sot-provider-status-dot]]:rounded-full",
        );
        expect(badge).toContain(
            "data-[sot-tone=syncing]:[&_[data-sot-provider-status-dot]]:animate-pulse",
        );
        expect(content).not.toContain("getSourceActionStatusBadgeClassName");
        expect(content).not.toContain("getSourceActionStatusDotClassName");
        expect(badge).toContain(
            "group-data-[sot-dimmed=true]/source-provider",
        );

        for (const selector of [
            '[data-sot-provider-card][data-slot="button"]',
            '[data-sot-provider-status][data-slot="badge"]',
        ]) {
            expect(collectCssRuleBlocks(globals, selector)).toEqual([]);
        }

        expect(globals).not.toContain(
            '[data-sot-provider-status][data-slot="badge"][data-sot-tone=',
        );
        expect(globals).not.toContain(
            '[data-sot-provider-card][data-slot="button"][data-state="selected"]',
        );
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
        const badgePrimitive = readSource("components/ui/badge.tsx");
        const toggleGroupPrimitive = readSource(
            "components/ui/toggle-group.tsx",
        );
        const alertPrimitive = readSource("components/ui/alert.tsx");
        const switchPrimitive = readSource("components/ui/switch.tsx");
        const globals = readSource("app/globals.css");
        const onboardingProviderFieldSlice = onboardingForm.match(
            /\{providerFields\.map\(\(field\) => \([\s\S]*?<DataSourceFieldControl[\s\S]*?\/>\s*\)\)\}/,
        )?.[0];

        expect(content).not.toContain("SOURCE_PROVIDER_DETAIL_");
        expect(content).not.toContain("SETTINGS_FIELD_CLASS");
        expect(content).not.toContain("SETTINGS_FIELD_CONTENT_CLASS");
        expect(content).not.toContain("SETTINGS_CONTROL_CLASS");
        expect(content).not.toContain('"!grid !grid-cols-[1fr_auto]');
        expect(content).not.toContain('fieldOrientation="horizontal"');
        expect(content).not.toContain("thumbClassName={");
        expect(content).not.toContain("getSettingsBannerClassName");
        expect(content).not.toContain("getSettingsSaveStatusBadgeClassName");
        expect(content).not.toContain("getSettingsSaveStatusDotClassName");
        for (const settingsAlertPrimitiveToken of [
            "settingsBanner:",
            "settingsBannerError:",
            "settingsLoadError:",
            "settingsVoScriptWarning:",
            "settingsBannerAction:",
        ]) {
            expect(alertPrimitive).toContain(settingsAlertPrimitiveToken);
        }
        expect(content).not.toMatch(/SOURCE_PROVIDER_DETAIL_[A-Z_]+/);
        expect(content).not.toMatch(
            /fieldClassName=\{\s*SOURCE_PROVIDER_DETAIL_FIELD_CLASS\s*\}/,
        );
        expect(content).not.toContain("inputClassName={");
        expect(content).toContain('variant="sourceProviderDetail"');
        expect(content).toContain("<FieldControl");
        expect(content).toContain('controlSize="sourceProviderDetail"');
        expect(content).toContain('size="sourceProviderDetail"');
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
        expect(settingFieldControl).toContain("variant={fieldControlVariant}");
        expect(settingFieldControl).toContain('"settingsRow"');
        expect(settingFieldControl).toContain('"settingsContent"');
        expect(settingFieldControl).toContain('"settingsControl"');
        expect(settingFieldControl).toContain("variant={controlVariant}");
        expect(settingFieldControl).toContain("controlSize={controlSize}");
        expect(settingFieldControl).toContain("size={controlSize}");
        expect(settingFieldControl).toContain(
            'field.masked && "tracking-[0.15em]"',
        );
        expect(settingFieldControl).toContain("className={inputClassName}");
        expect(settingFieldControl).not.toContain(
            '"border-b border-border py-3 last:border-b-0"',
        );
        expect(settingFieldControl).not.toContain("fieldContentClassName");
        expect(settingFieldControl).not.toContain("fieldControlClassName");
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
        expect(onboardingProviderFieldSlice).not.toContain('variant="settings"');
        expect(fieldPrimitive).toContain(
            `type FieldVariant =
    | "default"
    | "authAction"
    | "onboardingSourceField"
    | "settingsRow"
    | "speakerSettingsRow"
    | "sourceProviderDetail";`,
        );
        expect(fieldPrimitive).toContain(
            `type FieldContentVariant =
    | "default"
    | "settingsContent"
    | "onboardingSourceField"
    | "sourceProviderDetail";`,
        );
        expect(fieldPrimitive).toContain(
            `type FieldControlVariant =
    | "default"
    | "settingsControl"
    | "onboardingSourceField"
    | "sourceProviderDetail";`,
        );
        expect(fieldPrimitive).toContain("settingsRowFieldClassName");
        expect(fieldPrimitive).toContain("settingsContent:");
        expect(fieldPrimitive).toContain("settingsControl:");
        expect(fieldPrimitive).toContain("sourceProviderDetailFieldClassName");
        expect(fieldPrimitive).toContain("grid grid-cols-[1fr_auto]");
        expect(fieldPrimitive).toContain("function FieldControl");
        expect(fieldPrimitive).toContain("data-variant={variant}");
        expect(buttonPrimitive).toContain("settingsSave:");
        expect(buttonPrimitive).toContain("settingsTestAction:");
        expect(buttonPrimitive).toContain("settingsSourceRetry:");
        expect(buttonPrimitive).toContain("settingsSectionRetry:");
        expect(badgePrimitive).toContain("settingsSaveStatus:");
        expect(badgePrimitive).toContain(
            "[&_[data-sot-part=settings-save-status-indicator]]",
        );
        expect(toggleGroupPrimitive).toContain("settingsSegment");
        expect(toggleGroupPrimitive).toContain("settingsSegmentOption:");
        expect(toggleGroupPrimitive).toContain("settingsSegmentSpacing");
        expect(inputPrimitive).toContain("sourceProviderDetail:");
        expect(inputPrimitive).toContain(
            "h-[30px] w-[240px] min-w-[240px] max-w-[240px]",
        );
        expect(inputPrimitive).toContain("font-mono");
        expect(inputPrimitive).toContain("text-[12px]");
        expect(inputPrimitive).toContain("bg-[var(--bg-recessed)]");
        expect(switchPrimitive).toContain(
            'type SwitchVariant = "default" | "sourceProviderDetail"',
        );
        expect(switchPrimitive).toContain(
            'type SwitchSize = "sm" | "default" | "sourceProviderDetail"',
        );
        expect(switchPrimitive).toContain("h-[20px] w-[36px]");
        expect(switchPrimitive).toContain("size-[16px]");
        expect(switchPrimitive).toContain(
            "data-[state=checked]:translate-x-[18px]",
        );
        expect(switchPrimitive).toContain(
            "data-[state=unchecked]:translate-x-[2px]",
        );
        expect(globals).not.toContain(
            '[data-sot-panel="source-provider-detail"] [data-slot="field"]',
        );
        expect(globals).not.toContain(
            '[data-sot-panel="source-provider-detail"] [data-slot="field-description"]',
        );
        expect(globals).not.toContain(
            '[data-sot-panel="source-provider-detail"]\n    [data-slot="input"][data-sot-mask="true"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="provider-meta"][data-slot="card-header"]',
        );
        expect(globals).not.toContain(
            '[data-sot-panel="settings-save-actions"] [data-slot="button"]',
        );
        expect(globals).not.toContain(
            '[data-sot-panel="source-actions"] [data-slot="button"]',
        );
        expectOnlyAllowedGlobalSlotSelectors(globals);

        for (const target of SETTINGS_DATA_SOURCE_PRIMITIVE_REPAINT_TARGETS) {
            expect(
                collectScopedPrimitiveRepaintBlocks(globals, target),
                `${target.label} should not repaint shadcn primitives from globals.css`,
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

        for (const bannedTerm of [
            "HAR",
            "Cookie",
            "payload",
            "Bearer",
            "user_access_token",
            "X-Session-Id",
        ]) {
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
                /<Field[\s\S]*?data-sot-part="source-reconnect-row"[\s\S]*?<\/Field>/,
            )?.[0] ?? "";
        const disconnectRow =
            dataSourcesPanel.match(
                /<Field[\s\S]*?data-sot-part="source-disconnect-row"[\s\S]*?<\/Field>/,
            )?.[0] ?? "";

        expect(reconnectRow).toContain('orientation="horizontal"');
        expect(reconnectRow).toContain("<FieldContent");
        expect(reconnectRow).toContain("<FieldTitle>");
        expect(reconnectRow).toContain("<FieldDescription>");
        expect(reconnectRow).toContain('"重新连接"');
        expect(reconnectRow).toContain('data-sot-control="source-reconnect"');
        expect(reconnectRow).toMatch(
            /handleReconnectSource\(\s*selectedSource,\s*\)/,
        );
        expect(reconnectRow).toContain(
            'aria-busy={actionState === "reconnecting"}',
        );
        expect(disconnectRow).toContain('orientation="horizontal"');
        expect(disconnectRow).toContain("<FieldContent");
        expect(disconnectRow).toContain("<FieldTitle>");
        expect(disconnectRow).toContain("<FieldDescription>");
        expect(disconnectRow).toContain('"断开连接"');
        expect(disconnectRow).toContain('data-sot-control="source-disconnect"');
        expect(disconnectRow).toMatch(
            /handleDisconnectSource\(\s*selectedSource,\s*\)/,
        );
        expect(disconnectRow).toContain(
            'aria-busy={actionState === "disconnecting"}',
        );

        const actionFooter =
            dataSourcesPanel.match(
                /<footer[\s\S]*?data-sot-panel="source-actions"[\s\S]*?<\/footer>/,
            )?.[0] ?? "";
        const actionOrder = [
            ...actionFooter.matchAll(
                /data-sot-control="(source-test|source-save|source-reconnect|source-disconnect)"/g,
            ),
        ].map((match) => match[1]);

        expect(actionFooter).toContain('data-sot-panel="source-actions"');
        expect(actionFooter).toContain(
            "data-sot-provider={selectedSource.provider}",
        );
        expect(actionFooter).toContain("data-sot-state={sourceSaveState}");
        expect(actionFooter).toContain('data-sot-part="source-action-status"');
        const sourceActionStatus = collectElementSlices(
            actionFooter,
            'data-sot-part="source-action-status"',
            "Badge",
        )[0];
        expect(sourceActionStatus).toContain('variant="sourceActionStatus"');
        expect(sourceActionStatus).not.toContain('variant="secondary"');
        expect(sourceActionStatus).not.toContain("className=");
        expect(sourceActionStatus).toContain(
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
        const actionStateBaseCss = readCssBlock(
            globals,
            '[data-sot-panel="settings-save-actions"] {\n    align-items: center;',
        );
        const sourceActionBaseCss = readCssBlock(
            globals,
            '[data-sot-panel="source-actions"] {\n    align-items: center;',
        );
        expect(actionStateBaseCss).toContain("flex-direction: row-reverse;");
        expect(sourceActionBaseCss).toContain("flex-direction: row-reverse;");
        expect(globals).toContain(
            '[data-sot-panel="settings-save-actions"][data-sot-state="saving"]',
        );
        expect(globals).toContain('[data-sot-part="settings-save-status"]');
        expect(globals).toContain(
            '[data-sot-panel="source-actions"][data-sot-state="saving"]',
        );
        expect(globals).toContain('[data-sot-part="source-action-status"]');
        expect(globals).not.toContain('data-sot-actions="source-actions"');
        expect([...actionOrder].reverse()).toEqual([
            "source-save",
            "source-test",
        ]);
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
        expect(content).toContain("<h3 data-sot-title>{title}</h3>");
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
        expect(settingsRow).toContain('variant="settingsRow"');
        expect(settingsRow).toContain('variant="settingsContent"');
        expect(settingsRow).toContain('variant="settingsControl"');
        expect(settingsRow).not.toContain("SETTINGS_FIELD_CLASS");
        expect(settingsRow).not.toContain("SETTINGS_FIELD_CONTENT_CLASS");
        expect(settingsRow).not.toContain("SETTINGS_CONTROL_CLASS");
        expect(content).toContain('data-sot-state="invalid"');
        expect(content).toContain(
            'data-invalid={fieldState === "invalid" ? "true" : undefined}',
        );
        expect(content).not.toContain("sm-section-title");
        expect(content).not.toContain("sm-row-name");
        expect(content).toContain("function SaveActions");
        expect(saveStatus).toContain('data-sot-part="settings-save-status"');
        expect(saveStatus).toContain('variant="settingsSaveStatus"');
        expect(saveStatus).toContain("data-sot-state={saveState}");
        expect(saveStatus).not.toContain('variant="ghost"');
        expect(saveStatus).not.toContain("getSettingsSaveStatusBadgeClassName");
        expect(saveStatus).not.toContain("getSettingsSaveStatusDotClassName");
        expect(content).toContain('data-sot-panel="settings-save-actions"');
        expect(content).toContain("data-sot-save-id={saveId ?? section}");
        expect(content).toContain("data-sot-section={section}");
        expect(content).toContain("data-sot-state={saveState}");
        expect(content).toContain('aria-busy={saveState === "saving"}');
        expect(content).toContain('data-sot-action="save"');
        expect(content).toContain('data-sot-control="settings-save"');
        expect(saveActions).toContain('variant="settingsSave"');
        expect(saveActions).toContain('size="settingsSave"');
        expect(saveActions).not.toContain('variant="default"');
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
        expect(voscriptTestAction).toContain('variant="settingsTestAction"');
        expect(voscriptTestAction).toContain('size="settingsTestAction"');
        expect(voscriptTestAction).not.toContain('variant="ghost"');
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
        expect(voscriptUnavailableBanner).toContain(
            'variant="settingsVoScriptWarning"',
        );
        expect(voscriptUnavailableBanner).toContain('density="settingsBanner"');
        expect(voscriptUnavailableBanner).toContain('layout="settingsBanner"');
        expect(voscriptUnavailableBanner).not.toContain(
            "getSettingsBannerClassName",
        );
        expect(voscriptUnavailableBanner).not.toContain('variant="destructive"');
        expect(voscriptUnavailableBanner).not.toContain("grid-cols-[auto_1fr");
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
            /const save = async[\s\S]*?const testConnection = async/,
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
            /const save = async[\s\S]*?const testConnection = async/,
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
            /if \(resolvedSpeakerBoundsMessage\)[\s\S]*?return;[\s\S]*?const updates: VoScriptSettingsUpdate[\s\S]*?await updateVoScriptSettings\(updates\)/,
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
        expect(segmentControl).toContain('layout="settingsSegment"');
        expect(segmentControl).toContain('variant="settingsSegmentOption"');
        expect(segmentControl).toContain('size="settingsSegmentOption"');
        expect(segmentControl).toContain(
            'spacing="settingsSegmentSpacing"',
        );
        expect(segmentControl).not.toContain('variant="outline"');
        expect(segmentControl).not.toContain('size="sm"');
        expect(segmentControl).not.toContain("spacing={1}");
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
            'variant="settingsLoadError"',
        );
        expect(sectionLoadErrorBanner ?? "").toContain(
            'density="settingsBanner"',
        );
        expect(sectionLoadErrorBanner ?? "").toContain(
            'layout="settingsBannerAction"',
        );
        expect(sectionLoadErrorBanner ?? "").not.toContain(
            "getSettingsBannerClassName",
        );
        expect(sectionLoadErrorBanner ?? "").not.toContain(
            'variant="destructive"',
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
        expect(sectionLoadRetryButton).toContain(
            'variant="settingsSectionRetry"',
        );
        expect(sectionLoadRetryButton).toContain(
            'size="settingsSectionRetry"',
        );
        expect(sectionLoadRetryButton).toContain("onClick={onRetry}");
        expect(sectionLoadRetryButton).toContain(
            "data-sot-section={section}",
        );
        expect(sectionLoadRetryButton).not.toContain('variant="default"');
        expect(sectionLoadRetryButton).not.toContain('size="sm"');
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
        const speakerButtons =
            speakers.match(/<Button\b[\s\S]*?<\/Button>/g) ?? [];
        const findButtonByControl = (control: string) =>
            speakerButtons.find((button) =>
                button.includes(`data-sot-control="${control}"`),
            ) ?? "";
        const expectNeutralButtonVariant = (control: string) => {
            const button = findButtonByControl(control);

            expect(button).toContain(`data-sot-control="${control}"`);
            expect(button).toContain('variant="speakerSettingsAction"');
            expect(button).toContain('size="speakerSettingsAction"');
            expect(button).not.toContain('variant="secondary"');
            expect(button).not.toContain('variant="destructive"');
            expect(button).not.toContain('size="sm"');
            expect(button).not.toContain('className="btn"');
            expect(button).not.toContain('className="btn danger"');
        };
        const expectDangerButtonVariant = (control: string) => {
            const button = findButtonByControl(control);

            expect(button).toContain(`data-sot-control="${control}"`);
            expect(button).toContain('variant="speakerSettingsDangerAction"');
            expect(button).toContain('size="speakerSettingsAction"');
            expect(button).not.toContain('variant="secondary"');
            expect(button).not.toContain('variant="destructive"');
            expect(button).not.toContain('size="sm"');
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
        expect(speakers).toContain("<Avatar");
        expect(speakers).toContain("<AvatarFallback");
        expect(avatarFallbacks).toHaveLength(2);
        for (const fallback of avatarFallbacks) {
            expect(fallback).toContain('variant="speakerSettings"');
            expect(fallback).not.toContain("className=");
            expect(fallback).not.toContain("speakerAvatarFallbackClassName");
        }
        expect(speakers).not.toContain("speakerAvatarFallbackClassName");
        expect(speakers).not.toContain("bg-accent text-primary");
        expect(speakers).not.toContain("text-[11px] font-bold");
        expect(avatarPrimitive).toContain("speakerSettings:");
        expect(avatarPrimitive).toContain("bg-accent");
        expect(avatarPrimitive).toContain("text-primary");
        expect(avatarPrimitive).toContain("text-[11px]");
        expect(avatarPrimitive).toContain("font-bold");
        expect(speakers).toContain("<Button");
        expect(speakers).toContain("<Badge");
        expect(speakers).toContain('variant="speakerState"');
        expect(speakers).not.toContain('variant="outline"');
        expect(speakers).toContain('data-sot-badge="speaker-state"');
        expect(speakers).toContain("data-sot-tone={tone}");
        expect(badgePrimitive).toContain("speakerState:");
        expect(speakers).toContain("<Field");
        expect(speakers).toContain('variant="speakerSettingsRow"');
        expect(speakers).not.toContain(
            'className="border-b border-border py-3"',
        );
        expect(fieldPrimitive).toContain('"speakerSettingsRow"');
        expect(fieldPrimitive).toContain("speakerSettingsRowFieldClassName");
        expect(speakers).toContain("<FieldContent");
        expect(speakers).toContain("<FieldTitle>");
        expect(speakers).toContain("<FieldLabel");
        expect(speakers).toContain("<FieldDescription>");
        expect(speakers).not.toContain('variant="secondary"');
        expect(speakers).not.toContain('variant="destructive"');
        expect(speakers).not.toContain('size="sm"');
        expect(buttonPrimitive).toContain("speakerSettingsAction:");
        expect(buttonPrimitive).toContain("speakerSettingsDangerAction:");
        expect(speakers).toContain('"settingsBanner"');
        expect(speakers).toContain('"settingsBannerError"');
        expect(speakers).toContain('density="settingsBanner"');
        expect(speakers).toContain(
            'layout={action ? "settingsBannerAction" : "settingsBanner"}',
        );
        expect(alertPrimitive).toContain("settingsBanner:");
        expect(alertPrimitive).toContain("settingsBannerError:");
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
        expect(speakers).toContain('data-sot-panel="speaker-voiceprints"');
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
        expect(globals).toContain('[data-sot-panel="speaker-profiles"]');
        expect(globals).toContain('[data-sot-list="speaker-profile-rows"]');
        expect(globals).toContain('[data-sot-item="speaker-profile-row"]');
        expect(globals).toContain('[data-sot-badge="speaker-state"]');
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
            expectNeutralButtonVariant(control);
        }
        for (const control of [
            "speaker-profile-delete",
            "speaker-voiceprint-delete",
        ]) {
            expectDangerButtonVariant(control);
        }
        expect(speakers).not.toMatch(OLD_UI_RE);
    });

    it("keeps settings skeletons on SOT loading primitives", () => {
        const skeletons = readSource(
            "features/settings/components/settings-skeletons.tsx",
        );
        const skeletonPrimitive = readSource("components/ui/skeleton.tsx");

        expect(skeletons).toContain('data-sot-panel="settings-card-skeleton"');
        expect(skeletons).toContain(
            'data-sot-panel="settings-section-skeleton"',
        );
        expect(skeletons).toContain('data-sot-panel="settings-list-skeleton"');
        expect(skeletons).toContain('data-sot-part="settings-skeleton-row"');
        expect(skeletons).toContain('data-sot-panel="settings-empty-hint"');
        expect(skeletons).toContain('data-sot-part="settings-empty-title"');
        expect(skeletons).toContain(
            'data-sot-part="settings-empty-description"',
        );
        expect(skeletons).toContain(
            'data-sot-part="settings-skeleton-sync-dot"',
        );
        expect(skeletons).toContain(
            'import { Field, FieldContent } from "@/components/ui/field";',
        );
        expect(skeletons).toContain(
            'import { Skeleton } from "@/components/ui/skeleton";',
        );
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
