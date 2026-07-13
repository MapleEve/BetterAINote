import { readFileSync } from "node:fs";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type PrimitiveProps = {
    children?: React.ReactNode;
    [key: string]: unknown;
};

type TestElement = React.ReactElement<PrimitiveProps>;
type OnboardingFormComponent = (props: {
    onConnected?: () => void;
}) => React.ReactNode;

const hookHarness = (() => {
    const values: unknown[] = [];
    let cursor = 0;

    return {
        beginRender() {
            cursor = 0;
        },
        reset() {
            values.length = 0;
            cursor = 0;
        },
        useEffect(callback: () => void) {
            callback();
        },
        useState(initialValue: unknown) {
            const index = cursor;
            cursor += 1;

            if (index >= values.length) {
                values[index] = initialValue;
            }

            return [
                values[index],
                (nextValue: unknown) => {
                    values[index] =
                        typeof nextValue === "function"
                            ? (nextValue as (currentValue: unknown) => unknown)(
                                  values[index],
                              )
                            : nextValue;
                },
            ] as const;
        },
    };
})();

const interactions = {
    connectSource: vi.fn(),
    navigate: vi.fn(),
    selectProvider: vi.fn(),
    setAuthMode: vi.fn(),
    setBaseUrl: vi.fn(),
    updateField: vi.fn(),
};
let hookConnectedProviders: string[] = [];
let hookProvider = "dingtalk-a1";

const mockedModules = [
    "react",
    "next/image",
    "@/components/language-provider",
    "@/components/ui/alert",
    "@/components/ui/button",
    "@/components/ui/card",
    "@/components/ui/field",
    "@/components/ui/input",
    "@/components/ui/progress",
    "@/components/ui/select",
    "@/components/ui/toggle-group",
    "@/features/data-sources/data-source-field-control",
    "@/features/data-sources/use-onboarding-data-source",
    "@/lib/platform/browser-router",
] as const;

function Div({ children, ...props }: PrimitiveProps) {
    return React.createElement(
        "div",
        props as React.HTMLAttributes<HTMLDivElement>,
        children,
    );
}

function Paragraph({ children, ...props }: PrimitiveProps) {
    return React.createElement(
        "p",
        props as React.HTMLAttributes<HTMLParagraphElement>,
        children,
    );
}

function Button({ children, ...props }: PrimitiveProps) {
    return React.createElement(
        // biome-ignore lint/a11y/useButtonType: This test primitive supplies the native type prop below.
        "button",
        {
            type: "button",
            ...props,
        } as React.ButtonHTMLAttributes<HTMLButtonElement>,
        children,
    );
}

function Input(props: PrimitiveProps) {
    return React.createElement(
        "input",
        props as React.InputHTMLAttributes<HTMLInputElement>,
    );
}

function Select({ children, ...props }: PrimitiveProps) {
    return React.createElement(
        "select",
        props as React.SelectHTMLAttributes<HTMLSelectElement>,
        children,
    );
}

function Image(props: PrimitiveProps) {
    return React.createElement(
        "img",
        props as React.ImgHTMLAttributes<HTMLImageElement>,
    );
}

function isElement(node: React.ReactNode): node is TestElement {
    return React.isValidElement<PrimitiveProps>(node);
}

function resolveTree(node: React.ReactNode): React.ReactNode {
    if (!isElement(node)) {
        return node;
    }

    const { children, ...props } = node.props;
    if (typeof node.type === "function") {
        const Component = node.type as (
            props: PrimitiveProps,
        ) => React.ReactNode;
        return resolveTree(Component({ ...props, children }));
    }

    return React.cloneElement(
        node,
        undefined,
        React.Children.map(children, resolveTree),
    );
}

function findElement(
    node: React.ReactNode,
    predicate: (element: TestElement) => boolean,
): TestElement {
    if (!isElement(node)) {
        throw new Error("Expected an element tree");
    }

    if (predicate(node)) {
        return node;
    }

    for (const child of React.Children.toArray(node.props.children)) {
        if (isElement(child)) {
            try {
                return findElement(child, predicate);
            } catch (error) {
                if (
                    !(error instanceof Error) ||
                    error.message !== "Not found"
                ) {
                    throw error;
                }
            }
        }
    }

    throw new Error("Not found");
}

function renderForm(Form: OnboardingFormComponent, onConnected?: () => void) {
    hookHarness.beginRender();
    return resolveTree(Form({ onConnected }));
}

function loadForm() {
    return import("@/features/onboarding/components/onboarding-form").then(
        ({ OnboardingForm }) => OnboardingForm as OnboardingFormComponent,
    );
}

beforeEach(() => {
    hookHarness.reset();
    vi.resetModules();
    vi.clearAllMocks();
    hookConnectedProviders = ["ticnote"];
    hookProvider = "dingtalk-a1";
    interactions.connectSource.mockResolvedValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    vi.doMock("react", async () => {
        const actual = await vi.importActual<typeof import("react")>("react");

        return {
            ...actual,
            useEffect: hookHarness.useEffect,
            useState: hookHarness.useState,
        };
    });
    vi.doMock("next/image", () => ({ default: Image }));
    vi.doMock("@/components/language-provider", () => ({
        useLanguage: () => ({ language: "zh-CN" }),
    }));
    vi.doMock("@/components/ui/alert", () => ({
        Alert: Div,
        AlertDescription: Div,
    }));
    vi.doMock("@/components/ui/button", () => ({ Button }));
    vi.doMock("@/components/ui/card", () => ({
        Card: Div,
        CardContent: Div,
        CardDescription: Div,
        CardHeader: Div,
        CardTitle: Div,
    }));
    vi.doMock("@/components/ui/field", () => ({
        Field: Div,
        FieldContent: Div,
        FieldControl: Div,
        FieldDescription: Paragraph,
        FieldLabel: ({ children, ...props }: PrimitiveProps) =>
            React.createElement(
                "label",
                props as React.LabelHTMLAttributes<HTMLLabelElement>,
                children,
            ),
    }));
    vi.doMock("@/components/ui/input", () => ({ Input }));
    vi.doMock("@/components/ui/progress", () => ({ Progress: Div }));
    vi.doMock("@/components/ui/select", () => ({ Select }));
    vi.doMock("@/components/ui/toggle-group", () => ({
        ToggleGroup: Div,
        ToggleGroupItem: Button,
    }));
    vi.doMock("@/features/data-sources/data-source-field-control", () => ({
        DataSourceFieldControl: ({ fieldId }: { fieldId: string }) =>
            React.createElement("input", { id: fieldId }),
    }));
    vi.doMock("@/features/data-sources/use-onboarding-data-source", () => ({
        useOnboardingDataSource: () => ({
            connectedProvider: null,
            connectedProviders: hookConnectedProviders,
            connectedSourceLabel: null,
            connectSource: interactions.connectSource,
            currentDraft: { authMode: "token", baseUrl: "https://example.com" },
            currentProviderCatalog: { authModes: ["token", "oauth"] },
            isSaving: false,
            provider: hookProvider,
            providerFields: [],
            providerOptions: [
                { label: "钉钉 闪记", provider: "dingtalk-a1" },
                { label: "TicNote", provider: "ticnote" },
            ],
            selectProvider: interactions.selectProvider,
            setAuthMode: interactions.setAuthMode,
            setBaseUrl: interactions.setBaseUrl,
            sourceLabel: "钉钉 闪记",
            updateField: interactions.updateField,
            usesCustomServerSelector: false,
        }),
    }));
    vi.doMock("@/lib/platform/browser-router", () => ({
        navigateAndRefreshBrowserRoute: interactions.navigate,
        useBrowserRouteController: () => ({}),
    }));
});

afterEach(() => {
    vi.unstubAllGlobals();
    for (const moduleId of mockedModules) {
        vi.doUnmock(moduleId);
    }
    vi.resetModules();
});

describe("onboarding UI replacement regression", () => {
    it("renders semantic wizard landmarks and accessible state", async () => {
        const Form = await loadForm();
        renderForm(Form);
        const tree = renderForm(Form);

        const main = findElement(tree, (element) => element.type === "main");
        const navigation = findElement(
            tree,
            (element) =>
                element.type === "nav" &&
                element.props["aria-label"] === "上手步骤",
        );
        const progress = findElement(
            tree,
            (element) =>
                element.props["aria-label"] === "配置进度：第 1 步 · 连接来源",
        );
        const currentStep = findElement(
            tree,
            (element) => element.props["aria-current"] === "step",
        );
        const providerSelect = findElement(
            tree,
            (element) =>
                element.type === "select" &&
                element.props.id === "source-provider",
        );

        expect(main.props["aria-labelledby"]).toBe("onboarding-title");
        expect(main.props["aria-busy"]).toBe(false);
        expect(navigation.type).toBe("nav");
        expect(progress.props.value).toBe(25);
        expect(currentStep.props["aria-label"]).toBe("第 1 步 · 连接来源");
        expect(providerSelect.props["aria-label"]).toBe("来源");
    });

    it("runs provider, step, default-source, and completion interactions", async () => {
        const Form = await loadForm();
        const onConnected = vi.fn();
        renderForm(Form, onConnected);
        let tree = renderForm(Form, onConnected);

        const providerSelect = findElement(
            tree,
            (element) =>
                element.type === "select" &&
                element.props.id === "source-provider",
        );
        (providerSelect.props.onValueChange as (value: string) => void)(
            "ticnote",
        );
        expect(interactions.selectProvider).toHaveBeenCalledWith("ticnote");

        const stepActions = findElement(
            tree,
            (element) =>
                element.type === "fieldset" &&
                element.props["aria-label"] === "步骤操作",
        );
        const nextButton = findElement(
            stepActions,
            (element) =>
                element.type === "button" &&
                typeof element.props.onClick === "function",
        );
        (nextButton.props.onClick as () => void)();
        tree = renderForm(Form, onConnected);

        const defaultSourceGroup = findElement(
            tree,
            (element) => element.props["aria-label"] === "默认转写来源",
        );
        (defaultSourceGroup.props.onValueChange as (value: string) => void)(
            "ticnote",
        );
        tree = renderForm(Form, onConnected);

        const selectedDefaultSource = findElement(
            tree,
            (element) => element.props["aria-label"] === "默认转写来源",
        );
        expect(selectedDefaultSource.props.value).toBe("ticnote");

        const finishStep = findElement(
            tree,
            (element) =>
                element.type === "button" &&
                element.props["aria-label"] === "第 4 步 · 完成",
        );
        (finishStep.props.onClick as () => void)();
        tree = renderForm(Form, onConnected);

        const finishActions = findElement(
            tree,
            (element) =>
                element.type === "fieldset" &&
                element.props["aria-label"] === "完成配置操作",
        );
        const finishButton = findElement(
            finishActions,
            (element) =>
                element.type === "button" && "aria-busy" in element.props,
        );
        (finishButton.props.onClick as () => void)();

        await vi.waitFor(() => {
            expect(interactions.connectSource).toHaveBeenCalledTimes(1);
            expect(onConnected).toHaveBeenCalledTimes(1);
        });
        expect(global.fetch).toHaveBeenCalledWith(
            "/api/settings/transcription",
            expect.objectContaining({
                body: JSON.stringify({
                    autoTranscribe: true,
                    defaultTranscriptionLanguage: "zh",
                    defaultTranscriptionProvider: "ticnote",
                }),
                method: "PUT",
            }),
        );
        expect(interactions.navigate).not.toHaveBeenCalled();
    });

    it("keeps real connection state while allowing the current draft as a default", async () => {
        const Form = await loadForm();
        renderForm(Form);
        let tree = renderForm(Form);

        const stepActions = findElement(
            tree,
            (element) =>
                element.type === "fieldset" &&
                element.props["aria-label"] === "步骤操作",
        );
        const nextButton = findElement(
            stepActions,
            (element) =>
                element.type === "button" &&
                typeof element.props.onClick === "function",
        );
        (nextButton.props.onClick as () => void)();
        tree = renderForm(Form);

        const defaultSourceGroup = findElement(
            tree,
            (element) => element.props["aria-label"] === "默认转写来源",
        );
        const draftOption = findElement(
            defaultSourceGroup,
            (element) => element.props.value === "dingtalk-a1",
        );
        const connectedOption = findElement(
            defaultSourceGroup,
            (element) => element.props.value === "ticnote",
        );
        const unavailableOption = findElement(
            defaultSourceGroup,
            (element) => element.props.value === "feishu-minutes",
        );

        expect(draftOption.props.disabled).toBe(false);
        expect(draftOption.props["aria-disabled"]).toBe(false);
        expect(connectedOption.props.disabled).toBe(false);
        expect(connectedOption.props["aria-disabled"]).toBe(false);
        expect(unavailableOption.props.disabled).toBe(true);
        expect(unavailableOption.props["aria-disabled"]).toBe(true);

        (defaultSourceGroup.props.onValueChange as (value: string) => void)(
            "dingtalk-a1",
        );
        tree = renderForm(Form);
        expect(
            findElement(
                tree,
                (element) => element.props["aria-label"] === "默认转写来源",
            ).props.value,
        ).toBe("dingtalk-a1");

        (defaultSourceGroup.props.onValueChange as (value: string) => void)(
            "feishu-minutes",
        );
        tree = renderForm(Form);
        expect(
            findElement(
                tree,
                (element) => element.props["aria-label"] === "默认转写来源",
            ).props.value,
        ).toBe("dingtalk-a1");
    });

    it("keeps the default-source group controlled while selecting and clearing", async () => {
        const Form = await loadForm();
        renderForm(Form);
        let tree = renderForm(Form);

        const stepActions = findElement(
            tree,
            (element) =>
                element.type === "fieldset" &&
                element.props["aria-label"] === "步骤操作",
        );
        const nextButton = findElement(
            stepActions,
            (element) =>
                element.type === "button" &&
                typeof element.props.onClick === "function",
        );
        (nextButton.props.onClick as () => void)();
        tree = renderForm(Form);

        let defaultSourceGroup = findElement(
            tree,
            (element) => element.props["aria-label"] === "默认转写来源",
        );
        expect(defaultSourceGroup.props.value).toBe("");

        (defaultSourceGroup.props.onValueChange as (value: string) => void)(
            "ticnote",
        );
        tree = renderForm(Form);
        defaultSourceGroup = findElement(
            tree,
            (element) => element.props["aria-label"] === "默认转写来源",
        );
        expect(defaultSourceGroup.props.value).toBe("ticnote");

        (defaultSourceGroup.props.onValueChange as (value: string) => void)("");
        tree = renderForm(Form);
        expect(
            findElement(
                tree,
                (element) => element.props["aria-label"] === "默认转写来源",
            ).props.value,
        ).toBe("");
    });

    it("clears the selection and disables every default when no source is connected or drafted", async () => {
        hookConnectedProviders = [];
        hookProvider = "plaud";
        const Form = await loadForm();
        renderForm(Form);
        let tree = renderForm(Form);

        const stepActions = findElement(
            tree,
            (element) =>
                element.type === "fieldset" &&
                element.props["aria-label"] === "步骤操作",
        );
        const nextButton = findElement(
            stepActions,
            (element) =>
                element.type === "button" &&
                typeof element.props.onClick === "function",
        );
        (nextButton.props.onClick as () => void)();
        tree = renderForm(Form);

        const defaultSourceGroup = findElement(
            tree,
            (element) => element.props["aria-label"] === "默认转写来源",
        );
        expect(defaultSourceGroup.props.value).toBe("");
        for (const provider of ["dingtalk-a1", "ticnote", "feishu-minutes"]) {
            const option = findElement(
                defaultSourceGroup,
                (element) => element.props.value === provider,
            );
            expect(option.props.disabled).toBe(true);
            expect(option.props["aria-disabled"]).toBe(true);
        }
    });

    it("recovers speaker controls and associates the rejected save error", async () => {
        const Form = await loadForm();
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValueOnce(new Error("speaker unavailable")),
        );
        renderForm(Form);
        let tree = renderForm(Form);

        const findActionButton = (ariaLabel: string) =>
            findElement(
                tree,
                (element) =>
                    element.type === "fieldset" &&
                    element.props["aria-label"] === ariaLabel,
            );
        const clickNext = (ariaLabel: string) => {
            const actions = findActionButton(ariaLabel);
            const next = findElement(
                actions,
                (element) =>
                    element.type === "button" &&
                    typeof element.props.onClick === "function" &&
                    element.props.variant === "default",
            );
            (next.props.onClick as () => void)();
            tree = renderForm(Form);
        };

        clickNext("步骤操作");
        clickNext("默认转写操作");

        const speakerName = findElement(
            tree,
            (element) =>
                element.type === "input" && element.props.id === "speaker-name",
        );
        (
            speakerName.props.onChange as (event: {
                target: { value: string };
            }) => void
        )({ target: { value: "林梅" } });
        clickNext("步骤操作");

        const finishActions = findActionButton("完成配置操作");
        const finish = findElement(
            finishActions,
            (element) =>
                element.type === "button" &&
                typeof element.props.onClick === "function" &&
                "aria-busy" in element.props,
        );
        (finish.props.onClick as () => void)();

        await vi.waitFor(() => {
            expect(interactions.connectSource).toHaveBeenCalledTimes(1);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
        tree = renderForm(Form);

        const error = findElement(
            tree,
            (element) => element.props.id === "onboarding-finish-error",
        );
        const recoveredFinish = findElement(
            tree,
            (element) =>
                element.type === "button" &&
                element.props["aria-describedby"] === "onboarding-finish-error",
        );

        expect(error.props["aria-live"]).toBe("assertive");
        expect(recoveredFinish.props.disabled).toBe(false);
        expect(recoveredFinish.props["aria-busy"]).toBe(false);
    });

    it("preserves route, save, and mobile provider-state contracts", () => {
        const source = readFileSync(
            new URL(
                "../features/onboarding/components/onboarding-form.tsx",
                import.meta.url,
            ),
            "utf8",
        );

        expect(source).toContain(
            'const ONBOARDING_DATA_SOURCES_ENDPOINT = "/api/data-sources"',
        );
        expect(source).toContain("endpoint: ONBOARDING_DATA_SOURCES_ENDPOINT");
        expect(source).toContain("connectedProviders={connectedProviders}");
        expect(source).toContain(
            "connected: connectedProviders.includes(option.id)",
        );
        expect(source).toContain(
            "currentDraftTranscriptionSource === option.id",
        );
        expect(source).toContain("selectable:");
        expect(source).toContain('value={defaultTranscriptionSource ?? ""}');
        expect(source).toContain("setDefaultTranscriptionSource(null);");
        expect(source).toContain('fetch("/api/settings/transcription",');
        expect(source).toContain("defaultTranscriptionProvider,");
        expect(source).toContain('fetch("/api/speakers/profiles",');
        expect(source).toContain("const handleFinish = async () => {");
        expect(source).toContain(
            "const didConnect = connectedProvider ? true : await connectSource();",
        );
        expect(source).toContain(
            "await saveTranscriptionDefaults(defaultTranscriptionProvider);",
        );
        expect(source).toContain("await saveSpeakerProfile();");
        expect(source).toContain("onConnected();");
        expect(source).toContain(
            'navigateAndRefreshBrowserRoute(router, "/dashboard");',
        );
        expect(source).toContain('id="source-provider"');
        expect(source).toContain("selectProvider(value);");
        expect(source).toContain("disabled={isSaving || isFinishing}");
        expect(source).toContain("aria-busy={isSaving || isFinishing}");
        expect(source).toContain("保存中...");
        expect(source).toContain("ONBOARDING_STEPS");
        expect(source).toContain('"source"');
        expect(source).toContain('"transcription"');
        expect(source).toContain('"speakers"');
        expect(source).toContain('"finish"');
    });
});
