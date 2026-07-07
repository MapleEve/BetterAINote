import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EXPECTED_ONBOARDING_CARD_CLASS_INITIALIZERS = [
    {
        property: "layout",
        expected:
            "grid min-h-svh place-items-center bg-background px-8 pb-20 pt-7 text-foreground",
    },
    {
        property: "surface",
        expected:
            "block min-h-96 w-full max-w-md box-border gap-0 overflow-visible rounded-xl border border-border bg-card p-5 shadow-sm backdrop-blur-none",
    },
    {
        property: "frame",
        expected:
            "overflow-hidden rounded-xl border border-border bg-background p-5",
    },
    {
        property: "speakerDraft",
        expected:
            "flex flex-row items-center gap-3 border-primary/50 bg-primary/10 p-3.5",
    },
    {
        property: "providerCard",
        expected:
            "flex h-auto w-full flex-row items-center justify-start gap-3 rounded-md px-3.5 py-3 text-left whitespace-normal",
    },
    {
        property: "providerList",
        expected: "mb-5 flex w-full flex-col items-stretch gap-2",
    },
    {
        property: "summaryList",
        expected: "mb-5 flex flex-col gap-2",
    },
    {
        property: "matrixRow",
        expected:
            "flex min-h-8 items-baseline gap-2 border-b border-dashed border-border py-1.5",
    },
    {
        property: "matrixLabel",
        expected:
            "m-0 w-20 flex-none text-xs font-semibold text-muted-foreground",
    },
    {
        property: "matrixValue",
        expected:
            "m-0 min-w-0 flex-1 break-words text-xs font-medium text-foreground",
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
        property: "sourceField",
        expected: "flex-col gap-2",
    },
    {
        property: "sourceFieldContent",
        expected: "min-w-0 gap-1",
    },
    {
        property: "sourceFieldDescription",
        expected: "max-w-full text-xs leading-normal text-muted-foreground",
    },
    {
        property: "sourceFieldControl",
        expected: "min-w-0 flex-1",
    },
    {
        property: "sourceProviderFields",
        expected: "flex flex-col gap-0",
    },
    {
        property: "header",
        expected: "grid auto-rows-min gap-0 p-0",
    },
    {
        property: "steps",
        expected: "mb-3.5 flex gap-1.5",
    },
    {
        property: "step",
        expected:
            "h-1 flex-1 rounded-sm bg-muted p-0 hover:bg-muted disabled:cursor-not-allowed",
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
        expected: "mb-1 text-sm font-semibold text-foreground",
    },
    {
        property: "sub",
        expected: "mb-3.5 text-xs leading-normal text-muted-foreground",
    },
    {
        property: "stepBody",
        expected: "flex flex-col gap-3 p-0",
    },
    {
        property: "stepTitle",
        expected: "text-sm font-semibold text-foreground",
    },
    {
        property: "stepDescription",
        expected: "mb-3.5 text-xs text-muted-foreground",
    },
    {
        property: "errorMessage",
        expected: "text-xs text-muted-foreground",
    },
    {
        property: "defaultSources",
        expected: "flex w-full flex-col items-stretch gap-1.5",
    },
    {
        property: "defaultSource",
        expected:
            "h-auto w-full justify-start whitespace-normal px-3 py-2 text-left",
    },
    {
        property: "actions",
        expected: "mt-3.5 flex justify-end gap-2",
    },
    {
        property: "providerIcon",
        expected:
            "inline-flex size-9 flex-none items-center justify-center overflow-hidden rounded-md border border-border bg-card text-foreground",
    },
    {
        property: "providerName",
        expected: "text-sm font-semibold text-foreground",
    },
    {
        property: "providerHint",
        expected: "mt-0.5 text-xs font-medium text-muted-foreground",
    },
] as const;

const REMOVED_ONBOARDING_SHADCN_BLOCKER_PATTERNS = [
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
    "[border:1px_solid_var(--line-hairline)]",
    "[background:var(--bg-canvas)]",
    "[font:600_11px_var(--font-sans)]",
    "[font:500_12px_var(--font-sans)]",
    "[font:12px/1.5_var(--font-sans)]",
    "[font:600_14px_var(--font-display)]",
    "[font:12px_var(--font-sans)]",
    "[font:600_14px_var(--font-sans)]",
    "[font:500_12px_var(--font-sans)]",
    "[color:var(--fg-tertiary)]",
    "[color:var(--fg-primary)]",
    "!flex-col",
    "!items-stretch",
    "!gap-2",
    "!w-full",
    "!justify-stretch",
    "[&[data-sot-cover=true]_img]",
    "[&_svg]:size-[18px]",
    "[&_svg]:stroke-[1.8]",
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
    /uikit-|glass-surface|glass-control|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const SOT_STATE_STYLE_SELECTOR_PREFIX = ["data-", "[sot-state"].join("");

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
            'import { Alert, AlertDescription } from "@/components/ui/alert";',
        );
        expect(source).toContain('import { cn } from "@/lib/utils";');
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
        expect(dataSourceFieldControl).not.toContain("onboardingSourceField");
        expect(source).toContain("const onboardingCardClassNames = {");
        for (const initializer of EXPECTED_ONBOARDING_CARD_CLASS_INITIALIZERS) {
            expect(source).toContain(`${initializer.property}:`);
            expect(source).toContain(`"${initializer.expected}"`);
        }
        for (const blocker of REMOVED_ONBOARDING_SHADCN_BLOCKER_PATTERNS) {
            expect(source).not.toContain(blocker);
        }
        expect(source).toContain(
            'className={cn(\n                                            "block size-full",',
        );
        expect(source).toContain(
            '? "object-cover"\n                                                : "object-contain"',
        );
        expect(source).toContain("const DEFAULT_SOURCE_SWATCH_CLASS_NAMES = {");
        expect(source).toContain(
            'accent: "size-5 flex-none rounded bg-primary"',
        );
        expect(source).toContain('empty: "size-5 flex-none rounded bg-muted"');
        expect(source).not.toContain("border-[var(--accent)]");
        expect(source).not.toContain("bg-[color-mix(");
        expect(source).not.toContain("bg-[#1296db]");
        expect(source).not.toContain(SOT_STATE_STYLE_SELECTOR_PREFIX);
        expect(source).not.toContain(
            `${SOT_STATE_STYLE_SELECTOR_PREFIX}=selected]:border-[var(--accent)]`,
        );
        expect(source).not.toContain(
            `${SOT_STATE_STYLE_SELECTOR_PREFIX}=selected]:bg-[color-mix(`,
        );
        expect(source).not.toContain(
            `${SOT_STATE_STYLE_SELECTOR_PREFIX}=disabled]:opacity`,
        );
        expect(source).not.toContain("data-sot-swatch={option.swatch}");
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
        expect(source).toContain("onboardingCardClassNames.providerCard");
        expect(source).not.toContain("secondaryAction:");
        expect(source).not.toContain("primaryAction:");
        expect(source).not.toContain(
            "className={onboardingCardClassNames.secondaryAction}",
        );
        expect(source).not.toContain(
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
        const onboardingStepButton = extractOpeningElement(
            source,
            'data-sot-control="onboarding-step"',
            "Button",
        );
        expect(onboardingStepButton).toContain('variant="ghost"');
        expect(onboardingStepButton).toContain('size="xs"');
        expect(onboardingStepButton).toContain("className={cn(");
        expect(onboardingStepButton).not.toContain('data-slot="button"');
        expect(source).not.toMatch(
            /<button[\s\S]*data-sot-control="onboarding-step"/,
        );
        const onboardingErrorAlert = extractOpeningElement(
            source,
            'data-sot-part="onboarding-error"',
            "Alert",
        );
        expect(onboardingErrorAlert).toContain('density="compact"');
        expect(onboardingErrorAlert).toContain('variant="statusError"');
        expect(onboardingErrorAlert).toContain('data-sot-state="error"');
        expect(onboardingErrorAlert).toContain('role="alert"');
        expect(source).toContain("<AlertDescription");
        expect(source).not.toMatch(
            /<div\b[^>]*data-sot-part="onboarding-error"/,
        );
        const onboardingSkipButton = extractOpeningElement(
            source,
            'data-sot-control="onboarding-skip"',
            "Button",
        );
        const defaultSourceNextButton = extractOpeningElement(
            source,
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
        const providerCardsMarkerIndex = source.indexOf(
            'data-sot-list="provider-cards"',
        );
        expect(providerCardsMarkerIndex).toBeGreaterThanOrEqual(0);
        const providerCardsStartIndex = source.lastIndexOf(
            "<ToggleGroup",
            providerCardsMarkerIndex,
        );
        const providerCardsEndIndex = source.indexOf(
            "</ToggleGroup>",
            providerCardsMarkerIndex,
        );
        expect(providerCardsStartIndex).toBeGreaterThanOrEqual(0);
        expect(providerCardsEndIndex).toBeGreaterThan(providerCardsMarkerIndex);
        const providerCardsGroup = source.slice(
            providerCardsStartIndex,
            providerCardsEndIndex + "</ToggleGroup>".length,
        );
        expect(providerCardsGroup).toContain('aria-label="来源"');
        expect(providerCardsGroup).toContain(
            "className={onboardingCardClassNames.providerList}",
        );
        expect(providerCardsGroup).toContain('data-sot-list="provider-cards"');
        expect(providerCardsGroup).toContain("disabled={isSaving}");
        expect(providerCardsGroup).toContain("onValueChange={(value) => {");
        expect(providerCardsGroup).toContain("selectProvider(value);");
        expect(providerCardsGroup).toContain('orientation="vertical"');
        expect(providerCardsGroup).toContain("spacing={2}");
        expect(providerCardsGroup).toContain('type="single"');
        expect(providerCardsGroup).toContain("value={provider}");
        expect(providerCardsGroup).toContain('variant="outline"');
        const providerCardItem = extractOpeningElement(
            source,
            'data-sot-control="provider-card"',
            "ToggleGroupItem",
        );
        expect(providerCardItem).toContain("className={cn(");
        expect(providerCardItem).toContain(
            "onboardingCardClassNames.providerCard",
        );
        expect(providerCardItem).toContain('isActive && "border-transparent"');
        expect(providerCardItem).toContain("disabled={isSaving}");
        expect(providerCardItem).toContain("key={item.provider}");
        expect(providerCardItem).toContain('data-sot-control="provider-card"');
        expect(providerCardItem).toContain("data-sot-provider={item.provider}");
        expect(providerCardItem).toContain(
            'data-sot-state={isActive ? "selected" : "idle"}',
        );
        expect(providerCardItem).toContain("value={item.provider}");
        expect(providerCardItem).not.toContain("variant=");
        expect(source).toContain("className={cn(");
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
        expect(source).toContain("className={onboardingCardClassNames.header}");
        expect(source).toContain(
            "className={onboardingCardClassNames.heading}",
        );
        expect(source).toContain("className={onboardingCardClassNames.sub}");
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
        const defaultSourceMarkerIndex = source.indexOf(
            'data-sot-list="onboarding-default-sources"',
        );
        expect(defaultSourceMarkerIndex).toBeGreaterThanOrEqual(0);
        const defaultSourceStartIndex = source.lastIndexOf(
            "<ToggleGroup",
            defaultSourceMarkerIndex,
        );
        const defaultSourceEndIndex = source.indexOf(
            "</ToggleGroup>",
            defaultSourceMarkerIndex,
        );
        expect(defaultSourceStartIndex).toBeGreaterThanOrEqual(0);
        expect(defaultSourceEndIndex).toBeGreaterThan(defaultSourceMarkerIndex);
        const defaultSourceControl = source.slice(
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
        expect(defaultSourceControl).toContain("aria-label={option.label}");
        expect(defaultSourceControl).toContain("aria-pressed={isActive}");
        expect(defaultSourceControl).toContain("data-sot-state={");
        expect(defaultSourceControl).toContain(
            "disabled={isSaving || !option.connected}",
        );
        expect(defaultSourceControl).toContain("value={option.id}");
        expect(defaultSourceControl).not.toContain('role="button"');
        expect(defaultSourceControl).not.toContain('type="button"');
        expect(defaultSourceControl).not.toContain("<button");
        expect(defaultSourceControl).not.toContain("data-sot-swatch");
        expect(source).toContain("disabled={isSaving || !option.connected}");
        expect(source).not.toContain("style={{");
        expect(source).not.toContain("tabIndex=");
        expect(source).not.toContain("onKeyDown={(event) =>");
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
        for (const selector of REMOVED_ONBOARDING_MATRIX_GLOBAL_SELECTORS) {
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
            collectCssRuleBlocks(
                globals,
                '[data-sot-part="onboarding-actions"]',
            ),
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
        expect(source).not.toMatch(
            /\bbg-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:[/-]\d+)?\b/,
        );
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
        expect(readOnlyMatrixRow).toContain(
            "className={onboardingCardClassNames.matrixRow}",
        );
        expect(readOnlyMatrixRow).toContain('data-sot-part="matrix-label"');
        expect(readOnlyMatrixRow).toContain(
            "className={onboardingCardClassNames.matrixLabel}",
        );
        expect(readOnlyMatrixRow).toContain('data-sot-part="matrix-value"');
        expect(readOnlyMatrixRow).toContain(
            "className={onboardingCardClassNames.matrixValue}",
        );
        expect(readOnlyMatrixRow).toContain("{label}");
        expect(readOnlyMatrixRow).toContain("{value}");
        expect(readOnlyMatrixRow).not.toContain('className="sr-meta-row"');
        expect(readOnlyMatrixRow).not.toMatch(/\bbg-(background|card|muted)\b/);
        expect(readOnlyMatrixRow).not.toMatch(OLD_UI_CONTRACT_RE);
    });
});
