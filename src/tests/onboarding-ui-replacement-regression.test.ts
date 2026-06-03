import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("onboarding UI replacement regression", () => {
    it("keeps onboarding as a four-step wizard surface", () => {
        const source = readSource(
            "features/onboarding/components/onboarding-form.tsx",
        );

        expect(source).toContain('data-testid="onboarding-wizard"');
        expect(source).toContain('data-testid="onboarding-stepper"');
        expect(source).toContain('data-onboarding-step="source"');
        expect(source).toContain('data-onboarding-step="auth"');
        expect(source).toContain('data-onboarding-step="privacy"');
        expect(source).toContain('data-onboarding-step="finish"');
        expect(source).toContain("数据源选择");
        expect(source).toContain("认证与服务地址");
        expect(source).toContain("权限与私有化");
        expect(source).toContain("保存进入工作台");
        expect(source).not.toContain("bg-background/24");
        expect(source).toContain(
            "glass-surface-subtle min-h-[30rem] rounded-3xl p-4 sm:p-6",
        );
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
        expect(source).toContain("lg:hidden");
        expect(source).toContain("data-onboarding-state");
        expect(source).toContain('data-testid="onboarding-state-matrix"');
        expect(source).toContain('data-testid="onboarding-save-enter"');
        expect(source).toContain("aria-busy={isSaving}");
        expect(source).toContain("disabled={isSaving}");
        expect(source).toContain("保存中...");
        expect(source).toContain('<SelectContent className="z-[650]">');
        expect(source).toContain('selectContentClassName="z-[650]"');
        expect(source).not.toContain("z-[200]");

        const readOnlyMatrixRow = source.slice(
            source.indexOf("function ReadOnlyMatrixRow"),
            source.indexOf("function WizardActions"),
        );

        expect(readOnlyMatrixRow).toContain("data-state={state}");
        expect(readOnlyMatrixRow).toContain("{label}");
        expect(readOnlyMatrixRow).toContain("{value}");
        expect(readOnlyMatrixRow).toContain("glass-surface-subtle");
        expect(readOnlyMatrixRow).not.toContain("bg-background/45");
    });
});
