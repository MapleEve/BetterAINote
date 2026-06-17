import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const OLD_UI_CONTRACT_RE =
    /uikit-|glass-surface|glass-control|bg-muted|text-muted-foreground|CardContent|<LibrarySearch[\s/>]|<SourceFilterStackStrip[\s/>]|\.\/components\/library-search|\.\/components\/source-filter-stack-strip/;

describe("onboarding UI replacement regression", () => {
    it("keeps onboarding as a four-step SOT workstation surface", () => {
        const source = readSource(
            "features/onboarding/components/onboarding-form.tsx",
        );

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
            'import { Card } from "@/components/ui/card";',
        );
        expect(source).toContain('data-sot-control="provider-card"');
        expect(source).toContain('data-sot-control="speaker-profile-draft"');
        expect(source).toContain('data-sot-part="provider-icon"');
        expect(source).toContain('data-sot-part="provider-meta"');
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
