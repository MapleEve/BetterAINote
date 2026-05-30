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
    });
});
