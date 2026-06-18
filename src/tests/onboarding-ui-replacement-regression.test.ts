import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

const ONBOARDING_PRIMITIVE_REPAINT_DECLARATION_RE =
    /^\s*(?:background(?:-clip)?|border(?:-(?:color|radius|style|width))?|box-shadow|color|font(?:-[\w-]+)?|height|letter-spacing|line-height|padding|transition|width)\s*:|\b(?:color-mix|oklch|linear-gradient)\(/m;

describe("onboarding UI replacement regression", () => {
    it("keeps onboarding as a four-step SOT workstation surface", () => {
        const source = readSource(
            "features/onboarding/components/onboarding-form.tsx",
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
        expect(source).toContain('variant="outline"');
        expect(source).toContain('variant="primary"');
        expect(source).toContain('size="xs"');
        expect(source).toContain('size="lg"');
        expect(source).toContain(
            'variant={isActive ? "secondary" : "outline"}',
        );
        expect(source).toContain(
            '"grid h-auto w-full grid-cols-[36px_1fr_auto_auto] items-center justify-start gap-3 px-3.5 py-3 text-left"',
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
        expect(source).toContain(
            'className="grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 border-primary/50 bg-primary/10 p-3.5"',
        );
        expect(source).toContain(
            'CardContent,',
        );
        expect(source).toContain("CardDescription,");
        expect(source).toContain("CardHeader,");
        expect(source).toContain("CardTitle,");
        expect(source).toMatch(
            /<CardHeader\s+data-sot-part="onboarding-card-header">[\s\S]*<CardTitle\s+data-sot-part="card-heading">[\s\S]*<CardDescription\s+data-sot-part="card-sub">/,
        );
        expect(source).toMatch(
            /<CardHeader\s+data-sot-part="onboarding-step-header">[\s\S]*<CardTitle\s+data-sot-part="onboarding-step-title">[\s\S]*<CardDescription\s+data-sot-part="onboarding-step-description">/,
        );
        expect(source).toContain(
            '<CardContent data-sot-part="onboarding-step-body">',
        );
        expect(source).toMatch(
            /data-sot-control="speaker-profile-draft"[\s\S]*<CardHeader\s+data-sot-part="provider-meta">[\s\S]*<CardTitle\s+data-sot-part="provider-name">[\s\S]*<CardDescription\s+data-sot-part="provider-hint">/,
        );
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
        expect(source).toContain('data-sot-control="speaker-profile-draft"');
        expect(source).toContain('data-sot-list="speaker-profiles"');
        expect(source).toContain('data-sot-list="finish-summary"');
        expect(source).toContain('data-sot-part="provider-icon"');
        expect(source).toContain('data-sot-part="provider-meta"');
        expect(source).not.toContain('className="onboarding-step-head"');
        expect(source).not.toContain('className="onboarding-step-title"');
        expect(source).not.toContain('className="onboarding-step-sub"');
        expect(source).not.toContain('className="onboarding-step-body"');
        expect(source).not.toContain('className="src-list"');
        expect(source).not.toMatch(
            /className="onboarding-default-source-(step|list|row|swatch)"/,
        );
        expect(globals).toContain(
            '[data-sot-list="onboarding-default-sources"]',
        );
        expect(globals).toContain(
            '[data-sot-control="onboarding-default-source"]',
        );
        expect(globals).toContain(
            '[data-sot-part="onboarding-default-source-swatch"]',
        );
        expect(globals).toContain('[data-sot-list="provider-cards"]');
        expect(globals).toContain('[data-sot-list="speaker-profiles"]');
        expect(globals).toContain('[data-sot-list="finish-summary"]');
        expect(globals).toContain(
            '[data-sot-card="onboarding"] > [data-slot="card-header"]',
        );
        expect(globals).toContain(
            '[data-sot-part="onboarding-step-header"][data-slot="card-header"]',
        );
        expect(globals).toContain('[data-sot-part="onboarding-step-title"]');
        expect(globals).toContain(
            '[data-sot-part="onboarding-step-description"]',
        );
        expect(globals).toContain(
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
