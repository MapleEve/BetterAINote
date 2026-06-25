import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_ONBOARDING_CARD_CLASS_INITIALIZERS = [
    {
        property: "layout",
        expected:
            "grid min-h-[100svh] place-items-center bg-[var(--bg-canvas)] px-[32px] pb-[80px] pt-[28px] text-[var(--fg-primary)]",
    },
    {
        property: "surface",
        expected:
            "!block !gap-0 !overflow-visible !rounded-[14px] !border !border-[var(--line-hairline)] !bg-[var(--bg-elevated)] !p-[18px] !shadow-[var(--shadow-xs)] !backdrop-blur-none [box-sizing:border-box] [min-height:375px] [width:min(420px,100%)]",
    },
    {
        property: "frame",
        expected:
            "[overflow:hidden] [border-radius:12px] [border:1px_solid_var(--line-hairline)] [background:var(--bg-canvas)] [padding:18px]",
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
        property: "providerList",
        expected: "mb-[18px] flex flex-col gap-[8px]",
    },
    {
        property: "summaryList",
        expected: "mb-[18px] flex flex-col gap-[8px]",
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
            "[display:inline-flex] [align-items:center] [height:26px] [gap:6px] [border-radius:8px] [border:1px_solid_var(--line-hairline)] [background:transparent] [padding:0_10px] [font:600_11px_var(--font-sans)] [line-height:normal] [color:var(--fg-secondary)] shadow-none hover:[background:transparent] hover:[color:var(--fg-secondary)] disabled:cursor-not-allowed has-[>svg]:px-[10px]",
    },
    {
        property: "primaryAction",
        expected:
            "[display:inline-flex] [align-items:center] [height:26px] [gap:6px] [border-radius:8px] [border:1px_solid_transparent] [background:var(--accent)] [padding:0_10px] [font:600_11px_var(--font-sans)] [line-height:normal] [color:white] shadow-none hover:[background:var(--accent)] focus-visible:border-primary focus-visible:ring-0 disabled:cursor-not-allowed has-[>svg]:px-[10px]",
    },
    {
        property: "header",
        expected: "grid auto-rows-min gap-0 p-0",
    },
    {
        property: "steps",
        expected: "mb-[14px] flex gap-[6px]",
    },
    {
        property: "step",
        expected:
            "[appearance:none] flex-1 [height:4px] [padding:0] [border:0] [border-radius:2px] [background:var(--bg-recessed)] [cursor:pointer] data-[sot-state=active]:[background:var(--accent)] data-[sot-state=complete]:[background:var(--accent)] disabled:cursor-not-allowed",
    },
    {
        property: "stepHeader",
        expected: "grid auto-rows-min gap-0 p-0",
    },
    {
        property: "providerMeta",
        expected: "grid min-w-0 auto-rows-min gap-0 p-0",
    },
    {
        property: "heading",
        expected:
            "[font:600_13px_var(--font-sans)] [color:var(--fg-primary)] [margin:0_0_4px]",
    },
    {
        property: "sub",
        expected:
            "[font:12px/1.5_var(--font-sans)] [color:var(--fg-tertiary)] [margin:0_0_14px]",
    },
    {
        property: "stepBody",
        expected: "[display:flex] [flex-direction:column] [gap:12px] p-0",
    },
    {
        property: "stepTitle",
        expected: "[font:600_14px_var(--font-display)] [color:var(--fg-primary)]",
    },
    {
        property: "stepDescription",
        expected:
            "[font:12px_var(--font-sans)] [color:var(--fg-tertiary)] [margin-bottom:14px]",
    },
    {
        property: "errorMessage",
        expected:
            "[font:12px_var(--font-sans)] [color:var(--fg-tertiary)] data-[sot-state=error]:[color:var(--signal-danger)]",
    },
    {
        property: "defaultSources",
        expected: "[display:flex] [flex-direction:column] [gap:6px]",
    },
    {
        property: "defaultSource",
        expected:
            "[appearance:none] [display:flex] [align-items:center] [gap:8px] [padding:8px] [border-radius:8px] [border:1px_solid_var(--line-hairline)] [background:transparent] [color:var(--fg-primary)] [cursor:pointer] [text-align:left] data-[sot-state=selected]:[border-color:var(--accent)] data-[sot-state=selected]:[background:color-mix(in_oklab,var(--accent)_6%,transparent)] data-[sot-state=disabled]:[cursor:not-allowed] data-[sot-state=disabled]:opacity-[0.55]",
    },
    {
        property: "defaultSourceSwatch",
        expected:
            "[width:20px] [height:20px] [flex:0_0_20px] [border-radius:4px] [background:transparent] data-[sot-swatch=accent]:[background:#1296db]",
    },
    {
        property: "actions",
        expected:
            "[display:flex] [gap:8px] [justify-content:flex-end] [margin-top:14px]",
    },
    {
        property: "providerIcon",
        expected:
            "[display:inline-flex] [width:36px] [height:36px] flex-none [align-items:center] [justify-content:center] [overflow:hidden] [border-radius:8px] [border:1px_solid_var(--line-hairline)] [background:#fff] [&_img]:[display:block] [&_img]:[width:100%] [&_img]:[height:100%] [&_img]:[object-fit:contain] [&_svg]:[width:18px] [&_svg]:[height:18px] [&_svg]:[fill:none] [&_svg]:[stroke:currentColor] [&_svg]:[stroke-width:1.8] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round] [&[data-sot-cover=true]_img]:[object-fit:cover]",
    },
    {
        property: "providerName",
        expected: "[font:600_14px_var(--font-sans)] [color:var(--fg-primary)]",
    },
    {
        property: "providerHint",
        expected:
            "[font:500_12px_var(--font-sans)] [color:var(--fg-tertiary)] [margin-top:2px]",
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

const ONBOARDING_DEFAULT_SOURCE_ROOT_REPAINT_SELECTORS = [
    '[data-sot-control="onboarding-default-source"]',
    '[data-sot-control="onboarding-default-source"][data-sot-state="selected"]',
    '[data-sot-control="onboarding-default-source"][data-sot-state="disabled"]',
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
        expect(onboardingSkipButton).toContain(
            "className={onboardingCardClassNames.secondaryAction}",
        );
        expect(defaultSourceNextButton).toContain('type="button"');
        expect(defaultSourceNextButton).toContain(
            "className={onboardingCardClassNames.primaryAction}",
        );
        expect(source).toContain(
            "className={onboardingCardClassNames.primaryAction}",
        );
        const onboardingActionClassInitializers =
            EXPECTED_ONBOARDING_CARD_CLASS_INITIALIZERS.filter(
                ({ property }) =>
                    property === "secondaryAction" ||
                    property === "primaryAction",
            ).map(({ expected }) => expected);
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
            for (const actionClassInitializer of onboardingActionClassInitializers) {
                expect(actionClassInitializer).not.toContain(
                    removedPrimitiveRepaintClass,
                );
            }
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
        expect(source).toContain(
            "className={onboardingCardClassNames.header}",
        );
        expect(source).toContain(
            "className={onboardingCardClassNames.heading}",
        );
        expect(source).toContain(
            "className={onboardingCardClassNames.sub}",
        );
        expect(source).toContain('data-sot-part="onboarding-step-header"');
        expect(source).toContain(
            "className={onboardingCardClassNames.stepTitle}",
        );
        expect(source).toContain(
            "className={onboardingCardClassNames.stepDescription}",
        );
        expect(source).toMatch(
            /<CardContent(?=[^>]*\bclassName=\{onboardingCardClassNames\.stepBody\})(?=[^>]*\bdata-sot-part="onboarding-step-body")[^>]*>/,
        );
        expect(source).toMatch(
            /data-sot-control="speaker-profile-draft"[\s\S]*<CardHeader(?=[^>]*\bclassName=\{onboardingCardClassNames\.providerMeta\})(?=[^>]*\bdata-sot-part="provider-meta")[^>]*>[\s\S]*<CardTitle(?=[^>]*\bclassName=\{onboardingCardClassNames\.providerName\})(?=[^>]*\bdata-sot-part="provider-name")[^>]*>[\s\S]*<CardDescription(?=[^>]*\bclassName=\{onboardingCardClassNames\.providerHint\})(?=[^>]*\bdata-sot-part="provider-hint")[^>]*>/,
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
        expect(source).not.toContain("style={{");
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
        for (const selector of REMOVED_AUTH_ONBOARDING_CARD_GLOBAL_SELECTORS) {
            expect(globals).not.toContain(selector);
        }
        for (const selector of ONBOARDING_DEFAULT_SOURCE_ROOT_REPAINT_SELECTORS) {
            expect(collectExactCssRuleBlocks(globals, selector)).toEqual([]);
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
        expect(
            collectCssRuleBlocks(globals, '[data-sot-part="onboarding-actions"]'),
        ).toEqual([]);
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
