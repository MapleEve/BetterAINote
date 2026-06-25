import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_ONBOARDING_CARD_CLASS_INITIALIZERS = [
    {
        property: "surface",
        expected:
            "min-h-[375px] gap-0 w-[min(420px,100%)] overflow-visible rounded-[14px] border border-[var(--line-hairline)] bg-[var(--bg-elevated)] p-[18px] shadow-xs backdrop-blur-none",
    },
    {
        property: "speakerDraft",
        expected:
            "grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 border-primary/50 bg-primary/10 p-3.5",
    },
    {
        property: "providerCard",
        expected:
            "grid h-auto w-full grid-cols-[36px_1fr_auto_auto] items-center justify-start gap-3 rounded-md px-3.5 py-3 text-left whitespace-normal data-[sot-state=selected]:border-transparent data-[sot-state=selected]:bg-secondary data-[sot-state=selected]:text-secondary-foreground data-[sot-state=selected]:hover:bg-secondary/80 dark:data-[sot-state=selected]:bg-secondary has-[>svg]:px-3.5",
    },
    {
        property: "sourceAuthModeGroup",
        expected: "grid w-full grid-cols-2 items-stretch",
    },
    {
        property: "sourceAuthModeOption",
        expected:
            "h-auto flex-col items-start justify-start whitespace-normal px-3.5 py-3 text-left",
    },
    {
        property: "secondaryAction",
        expected:
            "h-[26px] gap-[6px] rounded-[8px] border border-[var(--line-hairline)] bg-transparent px-[10px] py-0 text-[11px] font-semibold leading-[normal] text-[var(--fg-secondary)] shadow-none hover:bg-transparent hover:text-[var(--fg-secondary)] has-[>svg]:px-[10px]",
    },
    {
        property: "primaryAction",
        expected:
            "h-[26px] gap-[6px] rounded-[8px] border border-transparent bg-[var(--accent)] px-[10px] py-0 text-[11px] font-semibold leading-[normal] text-white shadow-none hover:bg-[var(--accent)] focus-visible:border-primary focus-visible:ring-0 has-[>svg]:px-[10px]",
    },
    {
        property: "header",
        expected: "grid auto-rows-min gap-0 p-0",
    },
    {
        property: "stepHeader",
        expected: "grid auto-rows-min gap-0 p-0",
    },
    {
        property: "providerMeta",
        expected: "grid auto-rows-min gap-0 p-0",
    },
    {
        property: "heading",
        expected:
            "mb-1 font-sans text-[13px] font-semibold text-[var(--fg-primary)]",
    },
    {
        property: "sub",
        expected:
            "mb-[12px] font-sans text-[12px] leading-[1.5] text-[var(--fg-tertiary)]",
    },
    {
        property: "stepBody",
        expected: "gap-0 p-0",
    },
] as const;

const REMOVED_ONBOARDING_CARD_BUSINESS_VARIANTS = [
    "Surface",
    "SpeakerDraft",
    "Header",
    "StepHeader",
    "ProviderMeta",
    "Heading",
    "Sub",
    "StepBody",
    "StepTitle",
    "ProviderName",
    "StepDescription",
    "ProviderHint",
].map((suffix) => ["onboarding", suffix].join(""));

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
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

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const ONBOARDING_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|letter-spacing|line-height|padding|transition|width)\s*:|\b(?:color-mix|oklch|linear-gradient)\(/m;

const ONBOARDING_DEFAULT_SOURCE_ROOT_REPAINT_SELECTORS = [
    '[data-sot-control="onboarding-default-source"]',
    '[data-sot-control="onboarding-default-source"][data-sot-state="selected"]',
    '[data-sot-control="onboarding-default-source"][data-sot-state="disabled"]',
] as const;

const REMOVED_AUTH_ONBOARDING_CARD_GLOBAL_SELECTORS = [
    '[data-sot-card]:not([data-sot-card="source-report-metric"])',
    '[data-sot-card]:not([data-sot-card="source-report-metric"])\n    + [data-sot-card]:not([data-sot-card="source-report-metric"])',
    '[data-sot-part="card-heading"]',
    '[data-sot-part="card-heading"] + [data-sot-part="card-sub"]',
    '[data-sot-card="auth"]',
    '[data-sot-card="onboarding"]',
] as const;

describe("onboarding UI replacement regression", () => {
    it("keeps onboarding as a four-step SOT workstation surface", () => {
        const source = readSource(
            "features/onboarding/components/onboarding-form.tsx",
        );
        const dataSourceFieldControl = readSource(
            "features/data-sources/data-source-field-control.tsx",
        );
        const fieldPrimitive = readSource("components/ui/field.tsx");
        const inputPrimitive = readSource("components/ui/input.tsx");
        const toggleGroupPrimitive = readSource(
            "components/ui/toggle-group.tsx",
        );
        const globals = readSource("app/globals.css");

        expect(source).toContain('data-sot-layout="onboarding-workstation"');
        expect(source).toContain('data-sot-surface="onboarding"');
        expect(source).toContain('data-sot-panel="onboarding-steps"');
        expect(source).toContain('data-sot-panel="onboarding-current"');
        expect(source).toContain("data-sot-progress={visibleStep}");
        expect(source).toContain('data-sot-control="onboarding-step"');
        expect(source).toContain("data-sot-step={step.id}");
        expect(source).toContain("data-sot-state={status}");
        expect(source).toContain('data-sot-part="onboarding-error"');
        expect(source).toContain('data-sot-part="onboarding-actions"');
        expect(source).toContain('data-sot-control="onboarding-skip"');
        expect(source).toContain('data-sot-part="onboarding-step-header"');
        expect(source).toContain('data-sot-part="onboarding-step-title"');
        expect(source).toContain('data-sot-part="onboarding-step-description"');
        expect(source).toContain('data-sot-part="onboarding-step-body"');
        expect(source).toContain('"source"');
        expect(source).toContain('"transcription"');
        expect(source).toContain('"speakers"');
        expect(source).toContain('"finish"');
        expect(source).toContain("连接来源");
        expect(source).toContain("默认转写");
        expect(source).toContain("说话人档案");
        expect(source).toContain("保存并进入工作台");
        expect(source).toContain(
            'import { Button } from "@/components/ui/button";',
        );
        expect(source).toContain(
            "className={onboardingCardClassNames.sourceAuthModeGroup}",
        );
        expect(source).toContain(
            "className={\n                                        onboardingCardClassNames.sourceAuthModeOption\n                                    }",
        );
        expect(source).toContain('variant="outline"');
        expect(source).toContain("spacing={2}");
        expect(source).toContain('data-sot-control="source-base-url"');
        expect(source).toContain('variant="onboarding"');
        expect(source).not.toContain('layout="onboardingSourceAuthMode"');
        expect(source).not.toContain(
            'variant="onboardingSourceAuthModeOption"',
        );
        expect(source).not.toContain('size="onboardingSourceAuthModeOption"');
        expect(source).not.toContain('spacing="onboardingSourceAuthMode"');
        expect(source).not.toContain('variant="onboardingSourceUrl"');
        expect(source).not.toContain('controlSize="onboardingSourceUrl"');
        expect(toggleGroupPrimitive).not.toContain("onboardingSourceAuthMode");
        expect(toggleGroupPrimitive).not.toContain(
            "onboardingSourceAuthModeOption",
        );
        expect(inputPrimitive).not.toContain("onboardingSourceUrl:");
        expect(inputPrimitive).not.toContain("onboardingSourceField:");
        expect(fieldPrimitive).not.toContain("onboardingSourceField");
        expect(dataSourceFieldControl).toContain(
            'variant?: "default" | "onboarding" | "settings" | "sourceProviderDetail"',
        );
        expect(dataSourceFieldControl).toContain(
            'const isOnboardingVariant = variant === "onboarding"',
        );
        expect(dataSourceFieldControl).toContain(
            "ONBOARDING_SOURCE_FIELD_CLASS_NAME",
        );
        expect(dataSourceFieldControl).toContain(
            "ONBOARDING_SOURCE_FIELD_GROUP_CLASS_NAME",
        );
        expect(dataSourceFieldControl).toContain(
            "ONBOARDING_SOURCE_FIELD_CONTENT_CLASS_NAME",
        );
        expect(dataSourceFieldControl).toContain(
            "ONBOARDING_SOURCE_FIELD_CONTROL_CLASS_NAME",
        );
        expect(dataSourceFieldControl).not.toContain(
            "onboardingSourceField",
        );
        expect(source).toContain("const onboardingCardClassNames = {");
        for (const initializer of EXPECTED_ONBOARDING_CARD_CLASS_INITIALIZERS) {
            expect(source).toContain(`${initializer.property}:`);
            expect(source).toContain(`"${initializer.expected}"`);
        }
        for (const removedVariant of REMOVED_ONBOARDING_CARD_BUSINESS_VARIANTS) {
            expect(source).not.toContain(`variant="${removedVariant}"`);
        }
        const onboardingCard = extractOpeningElement(
            source,
            'data-sot-card="onboarding"',
            "Card",
        );
        expect(onboardingCard).toContain("hasNoPadding");
        expect(onboardingCard).toContain(
            "className={onboardingCardClassNames.surface}",
        );
        expect(onboardingCard).not.toContain("variant=");
        expect(source).toContain('data-sot-card="onboarding"');
        expect(source).toContain(
            "className={onboardingCardClassNames.providerCard}",
        );
        expect(source).toContain(
            "className={onboardingCardClassNames.secondaryAction}",
        );
        expect(source).toContain(
            "className={onboardingCardClassNames.primaryAction}",
        );
        expect(source).not.toContain('variant="onboardingProviderCard"');
        expect(source).not.toContain('size="onboardingProviderCard"');
        expect(source).not.toContain('variant="onboardingDefaultSource"');
        expect(source).not.toContain('size="onboardingDefaultSource"');
        expect(source).not.toContain('variant="onboardingSecondaryAction"');
        expect(source).not.toContain('variant="onboardingPrimaryAction"');
        expect(source).not.toContain('size="onboardingAction"');
        expect(source).not.toContain('variant="accent"');
        expect(source).not.toContain('variant="quietOutline"');
        expect(source).not.toContain('size="control-xs"');
        expect(source).not.toContain(
            'variant={isActive ? "secondary" : "outline"}',
        );
        const onboardingSkipButton = extractOpeningElement(
            source,
            'data-sot-control="onboarding-skip"',
            "button",
        );
        const defaultSourceNextButton = extractOpeningElement(
            source,
            'data-sot-control="onboarding-next"',
            "button",
        );
        expect(onboardingSkipButton).toContain('type="button"');
        expect(onboardingSkipButton).toContain('style={{');
        expect(defaultSourceNextButton).toContain('type="button"');
        expect(defaultSourceNextButton).toContain('style={{');
        expect(source).toContain(
            "className={onboardingCardClassNames.primaryAction}",
        );
        for (const removedPrimitiveRepaintClass of [
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
            expect(source).not.toContain(removedPrimitiveRepaintClass);
        }
        const providerCardButton = extractOpeningElement(
            source,
            'data-sot-control="provider-card"',
            "Button",
        );
        expect(providerCardButton).toContain('variant="outline"');
        expect(providerCardButton).toContain(
            "className={onboardingCardClassNames.providerCard}",
        );
        expect(source).not.toContain("className={cn(");
        expect(source).toContain(
            'import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";',
        );
        expect(source).toContain("<ToggleGroup");
        expect(source).toContain("<ToggleGroupItem");
        expect(source).toContain('type="single"');
        expect(source).toContain("value={currentDraft.authMode}");
        expect(source).toContain("setAuthMode(mode)");
        expect(source).toContain('data-sot-list="source-auth-modes"');
        expect(source).toContain('data-sot-control="source-auth-mode"');
        expect(source).toContain("data-sot-auth-mode={mode}");
        expect(source).toContain('data-sot-part="source-auth-mode-title"');
        expect(source).toContain(
            'data-sot-part="source-auth-mode-description"',
        );
        const sourceAuthModeControl =
            source.match(
                /currentProviderCatalog\.authModes\.length > 1[\s\S]*?<MatrixRow/,
            )?.[0] ?? "";
        expect(sourceAuthModeControl).toContain("<ToggleGroup");
        expect(sourceAuthModeControl).toContain("<ToggleGroupItem");
        expect(sourceAuthModeControl).not.toContain("<Select");
        expect(sourceAuthModeControl).toContain('variant="outline"');
        expect(sourceAuthModeControl).not.toContain('size="lg"');
        expect(sourceAuthModeControl).toContain("spacing={2}");
        expect(sourceAuthModeControl).toContain(
            "className={onboardingCardClassNames.sourceAuthModeGroup}",
        );
        expect(sourceAuthModeControl).toContain(
            "onboardingCardClassNames.sourceAuthModeOption",
        );
        expect(sourceAuthModeControl).not.toContain(
            'className="grid w-full grid-cols-2 items-stretch"',
        );
        const onboardingDataSourceFieldControl =
            source.match(
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
        expect(source).not.toContain(
            'className="grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 border-primary/50 bg-primary/10 p-3.5"',
        );
        expect(source).toContain("CardContent,");
        expect(source).toContain("CardDescription,");
        expect(source).toContain("CardHeader,");
        expect(source).toContain("CardTitle,");
        expect(source).toContain('data-sot-part="onboarding-card-header"');
        expect(source).toContain('font: "600 13px var(--font-sans)"');
        expect(source).toContain('font: "12px/1.5 var(--font-sans)"');
        expect(source).toContain('data-sot-part="onboarding-step-header"');
        expect(source).toContain('font: "600 14px var(--font-display)"');
        expect(source).toContain('font: "12px var(--font-sans)"');
        expect(source).toMatch(
            /<CardContent(?=[^>]*\bclassName=\{onboardingCardClassNames\.stepBody\})(?=[^>]*\bdata-sot-part="onboarding-step-body")[^>]*>/,
        );
        expect(source).toMatch(
            /data-sot-control="speaker-profile-draft"[\s\S]*<CardHeader(?=[^>]*\bclassName=\{onboardingCardClassNames\.providerMeta\})(?=[^>]*\bdata-sot-part="provider-meta")[^>]*>[\s\S]*<CardTitle(?=[^>]*\bdata-sot-part="provider-name")(?![^>]*\b(?:variant|className)=)[^>]*>[\s\S]*<CardDescription(?=[^>]*\bdata-sot-part="provider-hint")(?![^>]*\b(?:variant|className)=)[^>]*>/,
        );
        const speakerDraftCard = extractOpeningElement(
            source,
            'data-sot-control="speaker-profile-draft"',
            "Card",
        );
        expect(speakerDraftCard).toContain("hasNoPadding");
        expect(speakerDraftCard).toContain(
            "className={onboardingCardClassNames.speakerDraft}",
        );
        expect(speakerDraftCard).not.toContain("variant=");
        expect(source).toContain('data-sot-control="provider-card"');
        expect(source).toContain('data-sot-list="provider-cards"');
        expect(source).toContain(
            'data-sot-panel="onboarding-default-source-step"',
        );
        expect(source).toContain('data-sot-list="onboarding-default-sources"');
        expect(source).toContain(
            'data-sot-control="onboarding-default-source"',
        );
        expect(source).toContain(
            'data-sot-part="onboarding-default-source-swatch"',
        );
        expect(source).toContain('role="button"');
        expect(source).toContain("style={{");
        expect(source).toContain("tabIndex=");
        expect(source).toContain("onKeyDown={(event) =>");
        expect(source).toContain('data-sot-control="speaker-profile-draft"');
        expect(source).toContain('data-sot-list="speaker-profiles"');
        expect(source).toContain('data-sot-list="finish-summary"');
        expect(source).toContain('data-sot-part="provider-icon"');
        expect(source).toContain('data-sot-part="provider-meta"');
        expect(source).not.toContain('className="onboarding-step-head"');
        expect(source).not.toContain('className="onboarding-step-title"');
        expect(source).not.toContain('className="onboarding-step-sub"');
        expect(source).not.toContain('className="onboarding-step-body"');
        expect(source).not.toContain('className="gap-0 p-0"');
        expect(source).not.toContain('className="src-list"');
        expect(source).not.toMatch(
            /className="onboarding-default-source-(step|list|row|swatch)"/,
        );
        expect(globals).toContain(
            '[data-sot-list="onboarding-default-sources"]',
        );
        for (const selector of REMOVED_AUTH_ONBOARDING_CARD_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of ONBOARDING_DEFAULT_SOURCE_ROOT_REPAINT_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
        }
        expect(globals).toContain(
            '[data-sot-part="onboarding-default-source-swatch"]',
        );
        expect(globals).toContain('[data-sot-list="provider-cards"]');
        expect(globals).toContain('[data-sot-list="speaker-profiles"]');
        expect(globals).toContain('[data-sot-list="finish-summary"]');
        expect(globals).not.toContain(
            '[data-sot-card="onboarding"] > [data-slot="card-header"]',
        );
        expect(globals).not.toContain(
            '[data-sot-part="onboarding-step-header"][data-slot="card-header"]',
        );
        expect(globals).toContain('[data-sot-part="onboarding-step-title"]');
        expect(globals).toContain(
            '[data-sot-part="onboarding-step-description"]',
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
        for (const selector of ['[data-sot-part="onboarding-actions"]']) {
            for (const block of collectCssRuleBlocks(globals, selector)) {
                expect(block.declarations).not.toMatch(
                    ONBOARDING_PRIMITIVE_REPAINT_DECLARATION_RE,
                );
            }
        }
        expect(globals).not.toMatch(
            /\.onboarding-step-(head|title|sub|body)\b/,
        );
        expect(globals).not.toMatch(
            /\.onboarding-default-source-(list|row|swatch)\b/,
        );
        expect(globals).not.toMatch(/\.src-list\b/);
        expect(source).not.toContain("src-item");
        expect(source).not.toContain("sp-ico");
        expect(source).not.toContain("src-meta");
        expect(source).not.toContain('className="onboarding-progress"');
        expect(source).not.toContain('className="onboarding-progress-segment"');
        expect(source).not.toContain('className="field-help err"');
        expect(source).not.toContain('className="onboarding-actions"');
        expect(source).not.toContain('className="sr-meta-row"');
        expect(source).not.toContain('className="sm"');
        expect(source).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(source).not.toMatch(OLD_UI_CONTRACT_RE);
    });

    it("preserves the unified data-source connection and dashboard routing behavior", () => {
        const source = readSource(
            "features/onboarding/components/onboarding-form.tsx",
        );

        expect(source).toContain("/api/data-sources");
        expect(source).toContain("useOnboardingDataSource");
        expect(source).toContain("connectSource");
        expect(source).toContain("onConnected");
        expect(source).toContain(
            'navigateAndRefreshBrowserRoute(router, "/dashboard")',
        );
        expect(source).not.toContain("/api/plaud/connect");
        expect(source).not.toContain('provider === "plaud"');
        expect(source).not.toContain("handlePlaudSave");
    });

    it("keeps mobile provider selection and exposes stable save states", () => {
        const source = readSource(
            "features/onboarding/components/onboarding-form.tsx",
        );

        expect(source).toContain('id="source-provider"');
        expect(source).toContain("onboardingState");
        expect(source).toContain('data-sot-control="matrix-row"');
        expect(source).toContain('data-sot-control="save-enter"');
        expect(source).toContain("aria-busy={isSaving || isFinishing}");
        expect(source).toContain("disabled={isSaving || isFinishing}");
        expect(source).toContain("保存中...");
        expect(source).not.toContain("z-[200]");

        const readOnlyMatrixRow = source.slice(
            source.indexOf("function MatrixRow"),
            source.indexOf("function WizardActions"),
        );

        expect(readOnlyMatrixRow).toContain("data-sot-state={state}");
        expect(readOnlyMatrixRow).toContain('data-sot-control="matrix-row"');
        expect(readOnlyMatrixRow).toContain('data-sot-part="matrix-label"');
        expect(readOnlyMatrixRow).toContain('data-sot-part="matrix-value"');
        expect(readOnlyMatrixRow).toContain("{label}");
        expect(readOnlyMatrixRow).toContain("{value}");
        expect(readOnlyMatrixRow).not.toContain('className="sr-meta-row"');
        expect(readOnlyMatrixRow).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(readOnlyMatrixRow).not.toMatch(OLD_UI_CONTRACT_RE);
    });
});
