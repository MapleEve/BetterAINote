import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
    useLanguage: () => ({ language: "zh-CN" }),
}));

vi.mock("@/features/data-sources/use-onboarding-data-source", () => ({
    useOnboardingDataSource: () => ({
        connectedProvider: null,
        connectedProviders: [],
        connectedSourceLabel: null,
        connectSource: vi.fn().mockResolvedValue(true),
        currentDraft: {
            authMode: "token",
            baseUrl: "https://example.invalid",
        },
        currentProviderCatalog: { authModes: ["token"] },
        isSaving: false,
        provider: "plaud",
        providerFields: [],
        providerOptions: [
            { label: "Plaud", provider: "plaud" },
            { label: "TicNote", provider: "ticnote" },
        ],
        selectProvider: vi.fn(),
        setAuthMode: vi.fn(),
        setBaseUrl: vi.fn(),
        sourceLabel: "Plaud",
        updateField: vi.fn(),
        usesCustomServerSelector: true,
    }),
}));

vi.mock("@/lib/platform/browser-router", () => ({
    navigateAndRefreshBrowserRoute: vi.fn(),
    useBrowserRouteController: () => ({}),
}));

let OnboardingForm: typeof import("@/features/onboarding/components/onboarding-form").OnboardingForm;

beforeAll(async () => {
    ({ OnboardingForm } = await import(
        "@/features/onboarding/components/onboarding-form"
    ));
});

describe("onboarding runtime render", () => {
    it("server-renders the semantic source step and loading state", () => {
        const html = renderToStaticMarkup(React.createElement(OnboardingForm));

        expect(html).toContain("<main");
        expect(html).toContain('aria-labelledby="onboarding-title"');
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('aria-label="上手步骤"');
        expect(html).toContain('aria-current="step"');
        expect(html).toContain("第 1 步 · 连接来源");
        expect(html).toContain("正在读取现有配置");
        expect(html).toContain("<fieldset");
        expect(html).toContain('aria-label="来源选项"');
        expect(html).toContain('aria-pressed="true"');
        expect(html).toContain("连接中...");
    });

    it("server-renders native semantic controls without test-only SOT DOM", () => {
        const html = renderToStaticMarkup(React.createElement(OnboardingForm));

        expect(html).toContain('type="button"');
        expect(html).toContain('tabindex="-1"');
        expect(html).not.toContain(["data", "sot"].join("-"));
    });
});

describe("onboarding forbidden implementation delta", () => {
    it("does not reintroduce private visual maps, wrappers, or test attributes", () => {
        const source = readFileSync(
            new URL(
                "../features/onboarding/components/onboarding-form.tsx",
                import.meta.url,
            ),
            "utf8",
        );

        for (const forbidden of [
            ["onboardingCard", "Class", "Names"].join(""),
            "DEFAULT_SOURCE_SWATCH_CLASS_NAMES",
            ["Class", "Names"].join(""),
            "CLASS_NAME",
            "Styles",
            ["data", "sot"].join("-"),
            "style=",
            "PROVIDER_ICONS",
            "PROVIDER_ASSETS",
            "OnboardingFieldRow",
            "MatrixRow",
            "WizardActions",
        ]) {
            expect(source).not.toContain(forbidden);
        }
    });
});
