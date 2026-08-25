import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CapturedProps = Record<string, unknown>;

const harness = vi.hoisted(() => {
    const captures = {
        buttons: [] as CapturedProps[],
        dialogContents: [] as CapturedProps[],
        dialogs: [] as CapturedProps[],
        inputs: [] as CapturedProps[],
        selects: [] as CapturedProps[],
        sliders: [] as CapturedProps[],
        switches: [] as CapturedProps[],
        toggleGroups: [] as CapturedProps[],
    };

    return {
        captures,
        dataSources: {
            disconnectSourceSettings: vi.fn(),
            isLoading: false,
            loadError: null as string | null,
            orderedSources: [] as unknown[],
            reconnectSourceSettings: vi.fn(),
            refreshSources: vi.fn(),
            saveSourceSettings: vi.fn(),
            savingProvider: null as string | null,
            secretDrafts: {},
            sourceActionProviders: {},
            testSourceSettings: vi.fn(),
            updateField: vi.fn(),
            updateSource: vi.fn(),
        },
        display: {
            ensureDisplaySettingsLoaded: vi.fn(),
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            loadError: null as string | null,
            settings: {
                dateTimeFormat: "relative",
                displayDensity: "comfy",
                itemsPerPage: 50,
                recordingListSortOrder: "newest",
                theme: "dark",
                uiLanguage: "zh-CN",
            },
            updateDisplaySettings: vi.fn(),
        },
        playback: {
            ensurePlaybackSettingsLoaded: vi.fn(),
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            loadError: null as string | null,
            settings: {
                autoPlayNext: false,
                defaultPlaybackSpeed: 1,
                defaultVolume: 80,
            },
            updatePlaybackSettings: vi.fn(),
        },
        sync: {
            ensureSyncSettingsLoaded: vi.fn(),
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            loadError: null as string | null,
            settings: {
                autoSyncEnabled: true,
                syncIntervalSeconds: 300,
            },
            updateSyncSettings: vi.fn(),
        },
        titleGeneration: {
            ensureTitleGenerationSettingsLoaded: vi.fn(),
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            loadError: null as string | null,
            settings: {
                autoGenerateTitle: true,
                titleGenerationApiKeySet: false,
                titleGenerationBaseUrl: null,
                titleGenerationModel: null,
                titleGenerationPrompt: null,
            },
            updateTitleGenerationSettings: vi.fn(),
        },
        transcription: {
            ensureTranscriptionSettingsLoaded: vi.fn(),
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            loadError: null as string | null,
            settings: {
                autoTranscribe: true,
                defaultTranscriptionLanguage: null,
                defaultTranscriptionProvider: null,
            },
            updateTranscriptionSettings: vi.fn(),
        },
        voscript: {
            ensureVoScriptSettingsLoaded: vi.fn(),
            hasLoaded: true,
            isLoading: false,
            isSaving: false,
            loadError: null as string | null,
            settings: {
                privateTranscriptionApiKeySet: true,
                privateTranscriptionBaseUrl: "https://service.example.test",
                privateTranscriptionDenoiseModel: "none",
                privateTranscriptionMaxInflightJobs: 1,
                privateTranscriptionMaxSpeakers: 0,
                privateTranscriptionMinSpeakers: 0,
                privateTranscriptionNoRepeatNgramSize: 0,
                privateTranscriptionSnrThreshold: null,
            },
            updateVoScriptSettings: vi.fn(),
        },
    };
});

vi.mock("@/components/ui/button", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/components/ui/button")>();
    const ReactModule = await import("react");

    return {
        ...actual,
        Button(props: React.ComponentProps<typeof actual.Button>) {
            harness.captures.buttons.push(props as CapturedProps);
            return ReactModule.createElement(actual.Button, props);
        },
    };
});

vi.mock("@/components/ui/input", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/components/ui/input")>();
    const ReactModule = await import("react");

    return {
        ...actual,
        Input(props: React.ComponentProps<typeof actual.Input>) {
            harness.captures.inputs.push(props as CapturedProps);
            return ReactModule.createElement(actual.Input, props);
        },
    };
});

vi.mock("@/components/ui/select", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/components/ui/select")>();
    const ReactModule = await import("react");

    return {
        ...actual,
        Select(props: React.ComponentProps<typeof actual.Select>) {
            harness.captures.selects.push(props as CapturedProps);
            return ReactModule.createElement(actual.Select, props);
        },
    };
});

vi.mock("@/components/ui/slider", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/components/ui/slider")>();
    const ReactModule = await import("react");

    return {
        ...actual,
        Slider(props: React.ComponentProps<typeof actual.Slider>) {
            harness.captures.sliders.push(props as CapturedProps);
            return ReactModule.createElement(actual.Slider, props);
        },
    };
});

vi.mock("@/components/ui/switch", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/components/ui/switch")>();
    const ReactModule = await import("react");

    return {
        ...actual,
        Switch(props: React.ComponentProps<typeof actual.Switch>) {
            harness.captures.switches.push(props as CapturedProps);
            return ReactModule.createElement(actual.Switch, props);
        },
    };
});

vi.mock("@/components/ui/toggle-group", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/components/ui/toggle-group")>();
    const ReactModule = await import("react");

    return {
        ...actual,
        ToggleGroup(props: React.ComponentProps<typeof actual.ToggleGroup>) {
            harness.captures.toggleGroups.push(
                props as unknown as CapturedProps,
            );
            return ReactModule.createElement(actual.ToggleGroup, props);
        },
    };
});

vi.mock("@/components/ui/dialog", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/components/ui/dialog")>();
    const ReactModule = await import("react");

    return {
        ...actual,
        Dialog(props: React.ComponentProps<typeof actual.Dialog>) {
            harness.captures.dialogs.push(props as CapturedProps);
            return ReactModule.createElement("div", null, props.children);
        },
        DialogClose({
            children,
        }: React.ComponentProps<typeof actual.DialogClose>) {
            return ReactModule.createElement(
                ReactModule.Fragment,
                null,
                children,
            );
        },
        DialogContent(
            props: React.ComponentProps<typeof actual.DialogContent>,
        ) {
            harness.captures.dialogContents.push(props as CapturedProps);
            const {
                children,
                onEscapeKeyDown: _onEscapeKeyDown,
                onInteractOutside: _onInteractOutside,
                onOpenAutoFocus: _onOpenAutoFocus,
                overlayProps: _overlayProps,
                portalWrapperProps: _portalWrapperProps,
                showCloseButton: _showCloseButton,
                ...domProps
            } = props;
            return ReactModule.createElement("section", domProps, children);
        },
        DialogDescription({
            children,
            ...props
        }: React.ComponentProps<typeof actual.DialogDescription>) {
            return ReactModule.createElement("p", props, children);
        },
        DialogTitle({
            children,
            ...props
        }: React.ComponentProps<typeof actual.DialogTitle>) {
            return ReactModule.createElement("h2", props, children);
        },
        DialogTrigger({
            children,
        }: React.ComponentProps<typeof actual.DialogTrigger>) {
            return ReactModule.createElement(
                ReactModule.Fragment,
                null,
                children,
            );
        },
    };
});

vi.mock("@/features/settings/display-settings-store", () => ({
    useDisplaySettingsStore: () => harness.display,
}));

vi.mock("@/features/settings/playback-settings-store", () => ({
    usePlaybackSettingsStore: () => harness.playback,
}));

vi.mock("@/features/settings/sync-settings-store", () => ({
    useSyncSettingsStore: () => harness.sync,
}));

vi.mock("@/features/settings/title-generation-settings-store", () => ({
    useTitleGenerationSettingsStore: () => harness.titleGeneration,
}));

vi.mock("@/features/settings/transcription-settings-store", () => ({
    useTranscriptionSettingsStore: () => harness.transcription,
}));

vi.mock("@/features/settings/voscript-settings-store", () => ({
    useVoScriptSettingsStore: () => harness.voscript,
}));

vi.mock("@/features/data-sources/use-data-sources-settings", () => ({
    useDataSourcesSettings: () => harness.dataSources,
}));

import { LanguageProvider } from "@/components/language-provider";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { DataSourcesSection } from "@/features/settings/components/sections/data-sources-section";
import { SpeakerProfilesPanel } from "@/features/settings/components/sections/speaker-profiles-panel";
import { VoScriptSection } from "@/features/settings/components/sections/voscript-section";
import { SettingFieldControl } from "@/features/settings/components/setting-field-control";
import { SettingsContent } from "@/features/settings/components/settings-content";
import {
    normalizeSettingsSection,
    SettingsDialog,
} from "@/features/settings/components/settings-dialog";
import {
    SettingsListSkeleton,
    SettingsSectionSkeleton,
} from "@/features/settings/components/settings-skeletons";
import { DATA_SOURCE_CATALOG } from "@/lib/data-sources/catalog";
import {
    type DataSourceDisplayState,
    getProviderFormFields,
} from "@/lib/data-sources/presentation";
import {
    disconnectDataSource,
    getDataSources,
    reconnectDataSource,
    saveDataSource,
    testDataSource,
} from "@/services/data-sources";
import { updateVoScriptSettings } from "@/services/voscript-settings";

function resetCaptures() {
    for (const values of Object.values(harness.captures)) {
        values.length = 0;
    }
}

function makeSource(
    overrides: Partial<DataSourceDisplayState> = {},
): DataSourceDisplayState {
    const source: DataSourceDisplayState = {
        authMode: "cookie",
        authModes: ["cookie", "bearer"],
        baseUrl: null,
        capabilities: DATA_SOURCE_CATALOG.ticnote.capabilities,
        config: {},
        connected: true,
        connectionStatus: "ready",
        displayName: "TicNote",
        enabled: true,
        lastSync: null,
        lastSyncError: null,
        lastSyncFinishedAt: null,
        lastSyncStartedAt: null,
        provider: "ticnote",
        runtimeStatus: "active",
        secretsConfigured: {},
        syncStatus: "idle",
        ...overrides,
    };
    source.secretsConfigured = Object.fromEntries(
        getProviderFormFields(source, {}, "zh-CN", "settings")
            .filter((field) => field.target === "secret")
            .map((field) => [field.key, true]),
    );
    return source;
}

function render(
    element: React.ReactElement,
    language: "zh-CN" | "en" = "zh-CN",
) {
    const TestLanguageProvider = LanguageProvider as React.ComponentType<{
        children?: React.ReactNode;
        language?: "zh-CN" | "en";
    }>;

    return renderToStaticMarkup(
        React.createElement(
            TestLanguageProvider,
            { language },
            React.createElement(ConfirmDialogProvider, null, element),
        ),
    );
}

function renderSettings(
    activeSection:
        | "appearance"
        | "data-sources"
        | "misc"
        | "title-generation"
        | "transcription"
        | "voscript",
) {
    return render(React.createElement(SettingsContent, { activeSection }));
}

function expectLabeledHeadingSection(
    html: string,
    headingId: string,
    headingText: string,
) {
    const labelIndex = html.indexOf(`aria-labelledby="${headingId}"`);
    const sectionStart = html.lastIndexOf("<section", labelIndex);
    const sectionEnd = html.indexOf("</section>", labelIndex);
    const headingIndex = html.indexOf(
        `<h4 id="${headingId}">${headingText}</h4>`,
        labelIndex,
    );

    expect(labelIndex).toBeGreaterThanOrEqual(0);
    expect(sectionStart).toBeGreaterThanOrEqual(0);
    expect(sectionEnd).toBeGreaterThan(labelIndex);
    expect(headingIndex).toBeGreaterThan(labelIndex);
    expect(headingIndex).toBeLessThan(sectionEnd);
}

function nodeText(node: React.ReactNode): string {
    return React.Children.toArray(node)
        .map((child) => {
            if (typeof child === "string" || typeof child === "number") {
                return String(child);
            }
            if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
                return nodeText(child.props.children);
            }
            return "";
        })
        .join("");
}

function capturedLabel(props: CapturedProps) {
    return typeof props["aria-label"] === "string"
        ? props["aria-label"]
        : nodeText(props.children as React.ReactNode);
}

function findCaptured(
    items: CapturedProps[],
    predicate: (props: CapturedProps) => boolean,
) {
    const match = items.find(predicate);
    expect(match).toBeDefined();
    return match as CapturedProps;
}

function findById(items: CapturedProps[], id: string) {
    return findCaptured(items, (props) => props.id === id);
}

function invoke(
    props: CapturedProps,
    name: string,
    ...args: unknown[]
): unknown {
    const handler = props[name];
    expect(handler).toBeTypeOf("function");
    return (handler as (...handlerArgs: unknown[]) => unknown)(...args);
}

async function flushAsyncWork() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

function resetMockFunction(mock: ReturnType<typeof vi.fn>) {
    mock.mockReset();
    mock.mockResolvedValue(undefined);
}

beforeEach(() => {
    resetCaptures();

    harness.display.hasLoaded = true;
    harness.display.isLoading = false;
    harness.display.isSaving = false;
    harness.display.loadError = null;
    harness.display.settings = {
        dateTimeFormat: "relative",
        displayDensity: "comfy",
        itemsPerPage: 50,
        recordingListSortOrder: "newest",
        theme: "dark",
        uiLanguage: "zh-CN",
    };

    harness.titleGeneration.hasLoaded = true;
    harness.titleGeneration.isLoading = false;
    harness.titleGeneration.isSaving = false;
    harness.titleGeneration.loadError = null;
    harness.titleGeneration.settings = {
        autoGenerateTitle: true,
        titleGenerationApiKeySet: false,
        titleGenerationBaseUrl: null,
        titleGenerationModel: null,
        titleGenerationPrompt: null,
    };

    harness.transcription.hasLoaded = true;
    harness.transcription.isLoading = false;
    harness.transcription.isSaving = false;
    harness.transcription.loadError = null;
    harness.transcription.settings = {
        autoTranscribe: true,
        defaultTranscriptionLanguage: null,
        defaultTranscriptionProvider: null,
    };

    harness.sync.hasLoaded = true;
    harness.sync.isLoading = false;
    harness.sync.isSaving = false;
    harness.sync.loadError = null;
    harness.sync.settings = {
        autoSyncEnabled: true,
        syncIntervalSeconds: 300,
    };

    harness.playback.hasLoaded = true;
    harness.playback.isLoading = false;
    harness.playback.isSaving = false;
    harness.playback.loadError = null;
    harness.playback.settings = {
        autoPlayNext: false,
        defaultPlaybackSpeed: 1,
        defaultVolume: 80,
    };

    harness.voscript.hasLoaded = true;
    harness.voscript.isLoading = false;
    harness.voscript.isSaving = false;
    harness.voscript.loadError = null;
    harness.voscript.settings = {
        privateTranscriptionApiKeySet: true,
        privateTranscriptionBaseUrl: "https://service.example.test",
        privateTranscriptionDenoiseModel: "none",
        privateTranscriptionMaxInflightJobs: 1,
        privateTranscriptionMaxSpeakers: 0,
        privateTranscriptionMinSpeakers: 0,
        privateTranscriptionNoRepeatNgramSize: 0,
        privateTranscriptionSnrThreshold: null,
    };

    harness.dataSources.isLoading = false;
    harness.dataSources.loadError = null;
    harness.dataSources.orderedSources = [makeSource()];
    harness.dataSources.savingProvider = null;
    harness.dataSources.secretDrafts = {};
    harness.dataSources.sourceActionProviders = {};

    for (const mock of [
        harness.display.ensureDisplaySettingsLoaded,
        harness.display.updateDisplaySettings,
        harness.playback.ensurePlaybackSettingsLoaded,
        harness.playback.updatePlaybackSettings,
        harness.sync.ensureSyncSettingsLoaded,
        harness.sync.updateSyncSettings,
        harness.titleGeneration.ensureTitleGenerationSettingsLoaded,
        harness.titleGeneration.updateTitleGenerationSettings,
        harness.transcription.ensureTranscriptionSettingsLoaded,
        harness.transcription.updateTranscriptionSettings,
        harness.voscript.ensureVoScriptSettingsLoaded,
        harness.voscript.updateVoScriptSettings,
        harness.dataSources.disconnectSourceSettings,
        harness.dataSources.reconnectSourceSettings,
        harness.dataSources.refreshSources,
        harness.dataSources.saveSourceSettings,
        harness.dataSources.testSourceSettings,
        harness.dataSources.updateField,
        harness.dataSources.updateSource,
    ]) {
        resetMockFunction(mock);
    }
    harness.dataSources.saveSourceSettings.mockResolvedValue(true);
    harness.dataSources.testSourceSettings.mockResolvedValue({ ok: true });
    harness.dataSources.reconnectSourceSettings.mockResolvedValue(true);
    harness.dataSources.disconnectSourceSettings.mockResolvedValue(true);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("settings replacement runtime regressions", () => {
    it("keeps the settings dialog semantic, scrollable, and guarded by busy state", () => {
        harness.transcription.isSaving = true;
        const onOpenChange = vi.fn();
        const html = render(
            React.createElement(SettingsDialog, {
                onOpenChange,
                open: true,
            }),
        );

        const settingsDialog = findCaptured(
            harness.captures.dialogs,
            (props) => props.open === true,
        );
        const settingsDialogContent = findCaptured(
            harness.captures.dialogContents,
            (props) => props["aria-label"] === "设置",
        );
        expect(settingsDialogContent).toMatchObject({
            "aria-label": "设置",
            showCloseButton: false,
        });
        expect(html).toContain('aria-label="转录设置"');
        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('disabled=""');
        invoke(settingsDialog, "onOpenChange", false);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("normalizes dialog sections and renders no retired product hooks", () => {
        expect(normalizeSettingsSection("appearance")).toBe("appearance");
        expect(normalizeSettingsSection("data-sources")).toBe("data-sources");
        expect(normalizeSettingsSection("unknown")).toBeNull();
        expect(normalizeSettingsSection(null)).toBeNull();

        const html = render(
            React.createElement(SettingsDialog, {
                onOpenChange: vi.fn(),
                open: true,
            }),
        );
        expect(html).not.toContain("data-sot");
    });

    it("keeps settings selects on the shared runtime control contract", () => {
        const html = renderSettings("appearance");
        const languageSelect = findById(
            harness.captures.selects,
            "display-ui-language",
        );
        const orderSelect = findById(
            harness.captures.selects,
            "display-recording-list-sort-order",
        );

        expect(languageSelect).toMatchObject({
            disabled: false,
            value: "zh-CN",
        });
        expect(orderSelect).toMatchObject({
            disabled: false,
            value: "newest",
        });
        expect(html).toContain('data-slot="select-trigger"');

        invoke(languageSelect, "onValueChange", "en");
        invoke(orderSelect, "onValueChange", "oldest");
        expect(harness.display.updateDisplaySettings).toHaveBeenCalledWith({
            uiLanguage: "en",
        });
        expect(harness.display.updateDisplaySettings).toHaveBeenCalledWith({
            recordingListSortOrder: "oldest",
        });
    });

    it("renders every settings panel and card group through real SSR landmarks and headings", () => {
        const panels = [
            ["appearance", "显示设置"],
            ["title-generation", "AI 重命名服务"],
            ["transcription", "转录设置"],
            ["misc", "杂项"],
            ["voscript", "VoScript 服务"],
            ["data-sources", "数据源列表"],
        ] as const;

        for (const [section, label] of panels) {
            resetCaptures();
            const html = renderSettings(section);
            expect(html).toContain(`aria-label="${label}"`);
            expect(html).not.toContain("data-sot");
        }

        const cardGroups = [
            [
                "appearance",
                [
                    ["display-theme-appearance-heading", "主题与外观"],
                    ["display-list-date-heading", "列表与日期"],
                ],
            ],
            [
                "title-generation",
                [["title-generation-service-heading", "标题生成服务"]],
            ],
            [
                "transcription",
                [["shared-transcription-behavior-heading", "公共转录行为"]],
            ],
            [
                "misc",
                [
                    ["misc-sync-settings-heading", "同步设置"],
                    ["misc-playback-settings-heading", "播放设置"],
                ],
            ],
            [
                "voscript",
                [
                    ["voscript-service-connection-heading", "服务连接"],
                    ["voscript-runtime-parameters-heading", "转录运行参数"],
                ],
            ],
        ] as const;

        for (const [section, groups] of cardGroups) {
            const html = renderSettings(section);
            for (const [headingId, headingText] of groups) {
                expectLabeledHeadingSection(html, headingId, headingText);
            }
        }
    });

    it("renders all three setting field variants with their distinct SSR geometry", () => {
        const field = {
            description: "控制说明",
            id: "runtime-choice",
            kind: "text" as const,
            label: "运行选项",
            value: "one",
        };
        const defaultHtml = render(
            React.createElement(SettingFieldControl, {
                field,
                fieldId: "runtime-choice-default",
                onValueChange: vi.fn(),
            }),
        );
        const settingsHtml = render(
            React.createElement(SettingFieldControl, {
                field,
                fieldId: "runtime-choice-settings",
                onValueChange: vi.fn(),
                variant: "settings",
            }),
        );
        const sourceDetailHtml = render(
            React.createElement(SettingFieldControl, {
                field: {
                    ...field,
                    id: "runtime-choice-source",
                },
                fieldId: "runtime-choice-source",
                onValueChange: vi.fn(),
                variant: "sourceProviderDetail",
            }),
        );

        expect(defaultHtml).toContain('data-slot="field-group"');
        expect(defaultHtml).toContain('data-orientation="horizontal"');
        expect(defaultHtml).toContain("gap-[18px] py-2");
        expect(defaultHtml).not.toContain("min-w-60 max-w-full");
        expect(defaultHtml).not.toContain("w-full max-w-[15rem]");

        expect(settingsHtml).toContain('data-slot="field-group"');
        expect(settingsHtml).toContain('data-orientation="responsive"');
        expect(settingsHtml).toContain("@md/field-group:gap-4");
        expect(settingsHtml).toContain("min-w-0 gap-1");
        expect(settingsHtml).toContain(
            "flex min-w-0 flex-wrap items-center justify-end gap-2",
        );
        expect(settingsHtml).toContain("min-w-60 max-w-full");

        expect(sourceDetailHtml).not.toContain('data-slot="field-group"');
        expect(sourceDetailHtml).toContain('data-orientation="horizontal"');
        expect(sourceDetailHtml).toContain(
            "border-b border-border py-3 last:border-b-0",
        );
        expect(sourceDetailHtml).not.toContain("@md/field-group:gap-4");
        expect(sourceDetailHtml).toContain("w-full max-w-[15rem]");

        resetCaptures();
        const miscHtml = renderSettings("misc");
        const skeletonHtml = render(
            React.createElement(SettingsSectionSkeleton, {
                cards: 1,
                fieldsPerCard: 1,
            }),
        );

        expect(miscHtml).toContain('data-slot="slider"');
        expect(harness.captures.sliders).toHaveLength(1);
        expect(skeletonHtml).toContain('aria-busy="true"');
        expect(skeletonHtml).toContain('data-slot="skeleton"');
    });

    it("uses the monitor glyph for the local deployment header badge", () => {
        const html = render(
            React.createElement(SettingsDialog, {
                onOpenChange: vi.fn(),
                open: true,
            }),
        );

        expect(html).toContain("lucide-monitor");
        expect(html).toContain("本地部署");
        expect(html).toContain("单租户");
        expect(html).toContain("self-hosted");
        expect(html).not.toContain("example.com");
    });

    it("keeps all six settings sections in both the desktop rail and compact selector", () => {
        const html = render(
            React.createElement(SettingsDialog, {
                onOpenChange: vi.fn(),
                open: true,
            }),
        );

        for (const label of [
            "转录设置",
            "AI 重命名服务",
            "VoScript 服务",
            "数据源",
            "显示设置",
            "杂项",
        ]) {
            expect(html).toContain(label);
        }
        expect(html).toContain('aria-current="page"');
        const compactSectionSelect = findById(
            harness.captures.selects,
            "settings-section-select",
        );
        expect(compactSectionSelect).toMatchObject({
            "aria-label": "设置",
            disabled: false,
            value: "transcription",
        });
        expect(compactSectionSelect.options).toHaveLength(6);
        expect(compactSectionSelect.onValueChange).toBeTypeOf("function");
        expect(html).toContain('data-slot="select-trigger"');
    });

    it("keeps dialog close and navigation controls accessible at runtime", () => {
        render(
            React.createElement(SettingsDialog, {
                onOpenChange: vi.fn(),
                open: true,
            }),
        );
        const closeButton = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "关闭设置",
        );
        const currentNav = findCaptured(
            harness.captures.buttons,
            (props) => props["aria-current"] === "page",
        );

        expect(closeButton).toMatchObject({
            disabled: false,
            type: "button",
        });
        expect(currentNav).toMatchObject({
            disabled: false,
            tabIndex: 0,
            type: "button",
        });
        expect(currentNav.onKeyDown).toBeTypeOf("function");
    });

    it("keeps the data-source list and detail panes present together", () => {
        harness.dataSources.orderedSources = [
            makeSource(),
            makeSource({
                displayName: "Plaud",
                provider: "plaud",
            }),
        ];
        const html = render(React.createElement(DataSourcesSection));

        expect(html).toContain("<aside");
        expect(html).toContain('aria-label="数据源列表"');
        expect(html).toContain('id="data-source-provider-detail"');
        expect(html).toContain('data-panel="source-provider-detail"');
        const compactProviderSelect = findById(
            harness.captures.selects,
            "data-source-provider-select",
        );
        expect(compactProviderSelect).toMatchObject({
            "aria-label": "选择数据源",
            disabled: false,
        });
        expect(compactProviderSelect.options).toHaveLength(2);
        expect(html).toContain("TicNote");
    });

    it("keeps data sources wired to rows, detail actions, and distinct requests", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(Response.json({ sources: [makeSource()] }))
            .mockResolvedValueOnce(Response.json({ success: true }))
            .mockResolvedValueOnce(Response.json({ success: true }))
            .mockResolvedValueOnce(Response.json({ success: true }))
            .mockResolvedValueOnce(Response.json({ success: true }));
        vi.stubGlobal("fetch", fetchMock);
        const payload = {
            authMode: "cookie" as const,
            config: {},
            enabled: true,
            provider: "ticnote" as const,
            secrets: {},
        };

        await expect(getDataSources()).resolves.toMatchObject({
            sources: [{ provider: "ticnote" }],
        });
        await saveDataSource(payload);
        await testDataSource(payload);
        await reconnectDataSource(payload);
        await disconnectDataSource({ provider: "ticnote" });

        expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/data-sources", {
            cache: "no-store",
        });
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "/api/data-sources",
            expect.objectContaining({ method: "PUT" }),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            "/api/data-sources/test",
            expect.objectContaining({ method: "POST" }),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            4,
            "/api/data-sources/reconnect",
            expect.objectContaining({ method: "POST" }),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            5,
            "/api/data-sources/disconnect",
            expect.objectContaining({ method: "POST" }),
        );
    });

    it("keeps data-source load retry on an alert button handler", () => {
        harness.dataSources.loadError = "暂时无法读取来源";
        const html = render(React.createElement(DataSourcesSection));
        const retry = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "重试",
        );

        expect(html).toContain('role="alert"');
        expect(html).toContain("暂时无法读取来源");
        invoke(retry, "onClick");
        expect(harness.dataSources.refreshSources).toHaveBeenCalledOnce();
    });

    it("keeps provider enable state connected to switch handlers", () => {
        render(React.createElement(DataSourcesSection));
        const automaticUpdates = findById(
            harness.captures.switches,
            "ticnote-automatic-updates",
        );
        const enableSync = findById(
            harness.captures.switches,
            "ticnote-enabled",
        );

        expect(automaticUpdates).toMatchObject({
            checked: true,
            disabled: false,
        });
        expect(enableSync).toMatchObject({
            checked: true,
            disabled: false,
        });
        invoke(enableSync, "onCheckedChange", false);
        expect(harness.dataSources.updateSource).toHaveBeenCalledWith(
            "ticnote",
            expect.any(Function),
        );
        const updater = harness.dataSources.updateSource.mock.calls[0]?.[1] as (
            source: DataSourceDisplayState,
        ) => DataSourceDisplayState;
        expect(updater(makeSource()).enabled).toBe(false);
    });

    it("links provider tiles to a labeled, busy-aware detail region", () => {
        const html = render(React.createElement(DataSourcesSection));

        expect(html).toMatch(
            /<button(?=[^>]*aria-controls="data-source-provider-detail")(?=[^>]*aria-pressed="false")/,
        );
        expect(html).toMatch(
            /<section(?=[^>]*id="data-source-provider-detail")(?=[^>]*aria-labelledby="data-source-ticnote-title")(?=[^>]*aria-busy="false")/,
        );
        expect(html).toContain('id="data-source-ticnote-title"');
    });

    it("projects provider save state through disabled controls and live status", () => {
        harness.dataSources.savingProvider = "ticnote";
        const html = render(React.createElement(DataSourcesSection));
        const saveButton = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "保存中",
        );
        const testButton = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "测试连接",
        );

        expect(saveButton).toMatchObject({
            "aria-busy": true,
            disabled: true,
        });
        expect(testButton.disabled).toBe(true);
        expect(html).toContain('role="status"');
        expect(html).toContain("保存中");
    });

    it("renders standard primitive slots without a settings-only framework contract", () => {
        const sourceHtml = render(React.createElement(DataSourcesSection));
        const appearanceHtml = renderSettings("appearance");

        for (const slot of [
            "button",
            "card",
            "field",
            "badge",
            "select-trigger",
            "toggle-group",
        ]) {
            expect(`${sourceHtml}${appearanceHtml}`).toContain(
                `data-slot="${slot}"`,
            );
        }
        expect(`${sourceHtml}${appearanceHtml}`).not.toContain("data-sot");
    });

    it("keeps data-source P0 rows explicit and wired to real action handlers", async () => {
        vi.stubGlobal("window", {
            setTimeout: vi.fn(),
        });
        const html = render(React.createElement(DataSourcesSection));
        for (const label of [
            "自动更新",
            "启用同步",
            "测试连接",
            "保存",
            "重新连接",
            "断开连接",
        ]) {
            expect(html).toContain(label);
        }

        const testButton = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "测试连接",
        );
        const saveButton = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "保存",
        );
        const reconnectButton = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "重新连接",
        );
        const disconnectButton = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "断开连接",
        );

        invoke(testButton, "onClick");
        invoke(saveButton, "onClick");
        invoke(reconnectButton, "onClick");
        invoke(disconnectButton, "onClick");
        await vi.waitFor(() => {
            expect(harness.dataSources.testSourceSettings).toHaveBeenCalledWith(
                expect.objectContaining({ provider: "ticnote" }),
            );
        });
        expect(harness.dataSources.saveSourceSettings).toHaveBeenCalledWith(
            expect.objectContaining({ provider: "ticnote" }),
        );
        expect(
            harness.dataSources.reconnectSourceSettings,
        ).toHaveBeenCalledWith(
            expect.objectContaining({ provider: "ticnote" }),
        );
        expect(
            harness.dataSources.disconnectSourceSettings,
        ).toHaveBeenCalledWith(
            expect.objectContaining({ provider: "ticnote" }),
        );
    });

    it("renders only user-facing source copy and masks sensitive field values", () => {
        const onValueChange = vi.fn();
        const html = render(
            React.createElement(SettingFieldControl, {
                field: {
                    id: "connection-credential",
                    kind: "textarea",
                    label: "连接凭据",
                    sensitive: true,
                    value: "not-rendered-in-plain-text",
                },
                fieldId: "connection-credential",
                onValueChange,
                variant: "settings",
            }),
        );

        expect(html).toContain("连接凭据");
        expect(html).toContain('type="password"');
        expect(html).not.toContain("<textarea");
        const input = findById(
            harness.captures.inputs,
            "connection-credential",
        );
        invoke(input, "onChange", {
            currentTarget: { value: "replacement" },
        });
        expect(onValueChange).toHaveBeenCalledWith(
            expect.objectContaining({ id: "connection-credential" }),
            "replacement",
        );
    });

    it("keeps non-source panels connected to their store save boundaries", async () => {
        const titleHtml = renderSettings("title-generation");
        const titleSave = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "保存",
        );
        invoke(titleSave, "onClick");
        await flushAsyncWork();
        expect(
            harness.titleGeneration.updateTitleGenerationSettings,
        ).toHaveBeenCalledWith(
            expect.objectContaining({ autoGenerateTitle: true }),
        );
        expect(titleHtml).toContain('id="title-generation-save-status"');

        resetCaptures();
        renderSettings("transcription");
        const autoTranscribe = findById(
            harness.captures.switches,
            "transcription-auto-transcribe",
        );
        invoke(autoTranscribe, "onCheckedChange", false);
        expect(
            harness.transcription.updateTranscriptionSettings,
        ).toHaveBeenCalledWith({ autoTranscribe: false });

        resetCaptures();
        const miscHtml = renderSettings("misc");
        invoke(
            findById(harness.captures.switches, "sync-auto-enabled"),
            "onCheckedChange",
            false,
        );
        invoke(
            findById(harness.captures.selects, "playback-speed"),
            "onValueChange",
            "1.5",
        );
        invoke(
            findById(harness.captures.sliders, "playback-volume"),
            "onValueChange",
            [45],
        );
        expect(harness.sync.updateSyncSettings).toHaveBeenCalledWith({
            autoSyncEnabled: false,
        });
        expect(harness.playback.updatePlaybackSettings).toHaveBeenCalledWith({
            defaultPlaybackSpeed: 1.5,
        });
        expect(harness.playback.updatePlaybackSettings).toHaveBeenCalledWith({
            defaultVolume: 45,
        });
        expect(miscHtml).toContain("同步设置");
        expect(miscHtml).toContain("播放设置");
    });

    it("blocks invalid VoScript no-repeat n-gram values before persistence", () => {
        harness.voscript.settings = {
            ...harness.voscript.settings,
            privateTranscriptionNoRepeatNgramSize: 2,
        };
        const html = render(React.createElement(VoScriptSection));
        const save = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "保存转录运行参数",
        );

        expect(html).toContain('aria-invalid="true"');
        expect(html).toContain("只支持 0 或");
        invoke(save, "onClick");
        expect(harness.voscript.updateVoScriptSettings).not.toHaveBeenCalled();
    });

    it("blocks invalid VoScript speaker bounds before persistence", () => {
        harness.voscript.settings = {
            ...harness.voscript.settings,
            privateTranscriptionMaxSpeakers: 2,
            privateTranscriptionMinSpeakers: 4,
        };
        const html = render(React.createElement(VoScriptSection));
        const save = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "保存转录运行参数",
        );

        expect(html).toContain("最多说话人数必须");
        expect(html).toContain('aria-invalid="true"');
        invoke(save, "onClick");
        expect(harness.voscript.updateVoScriptSettings).not.toHaveBeenCalled();
    });

    it("keeps setting labels, descriptions, and controls associated at runtime", () => {
        const html = render(
            React.createElement(SettingFieldControl, {
                field: {
                    description: "用于验证可访问关联",
                    id: "associated-field",
                    kind: "text",
                    label: "关联字段",
                    value: "value",
                },
                fieldId: "associated-field",
                onValueChange: vi.fn(),
                variant: "settings",
            }),
        );

        expect(html).toContain('for="associated-field"');
        expect(html).toContain('id="associated-field"');
        expect(html).toContain("用于验证可访问关联");
        expect(html).toContain('data-slot="field-control"');
    });

    it("keeps appearance segmented controls interactive without changing saved values", () => {
        renderSettings("appearance");
        const theme = findCaptured(
            harness.captures.toggleGroups,
            (props) => props["aria-label"] === "主题",
        );
        const density = findCaptured(
            harness.captures.toggleGroups,
            (props) => props["aria-label"] === "信息密度",
        );
        const dateTime = findCaptured(
            harness.captures.toggleGroups,
            (props) => props["aria-label"] === "时间显示",
        );

        expect(theme.value).toBe("dark");
        expect(density.value).toBe("comfy");
        expect(dateTime.value).toBe("relative");
        invoke(theme, "onValueChange", "light");
        invoke(density, "onValueChange", "compact");
        invoke(dateTime, "onValueChange", "absolute");
        expect(harness.display.updateDisplaySettings).toHaveBeenCalledWith({
            theme: "light",
        });
        expect(harness.display.updateDisplaySettings).toHaveBeenCalledWith({
            displayDensity: "compact",
        });
        expect(harness.display.updateDisplaySettings).toHaveBeenCalledWith({
            dateTimeFormat: "absolute",
        });
    });

    it("projects appearance state, busy controls, and ARIA from the display store", () => {
        harness.display.isSaving = true;
        const html = renderSettings("appearance");

        expect(html).toContain('aria-label="显示设置"');
        expect(html).toContain('aria-busy="true"');
        for (const control of [
            ...harness.captures.selects,
            ...harness.captures.toggleGroups,
            ...harness.captures.inputs,
        ]) {
            expect(control.disabled).toBe(true);
        }
        expect(
            harness.captures.toggleGroups.every(
                (props) => props["aria-disabled"] === "true",
            ),
        ).toBe(true);
    });

    it("keeps VoScript max inflight zero as an unlimited save payload", async () => {
        harness.voscript.settings = {
            ...harness.voscript.settings,
            privateTranscriptionMaxInflightJobs: 0,
        };
        render(React.createElement(VoScriptSection));
        const save = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "保存转录运行参数",
        );
        invoke(save, "onClick");
        await flushAsyncWork();
        expect(harness.voscript.updateVoScriptSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                privateTranscriptionMaxInflightJobs: 0,
            }),
        );

        const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
        vi.stubGlobal("fetch", fetchMock);
        await updateVoScriptSettings({
            privateTranscriptionMaxInflightJobs: 0,
        });
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/settings/voscript",
            expect.objectContaining({
                body: JSON.stringify({
                    privateTranscriptionMaxInflightJobs: 0,
                }),
                method: "PUT",
            }),
        );
    });

    it("keeps section load failures on alerts with live retry handlers", () => {
        harness.display.hasLoaded = false;
        harness.display.isLoading = false;
        harness.display.loadError = "显示设置加载失败";
        let html = renderSettings("appearance");
        let retry = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "重试",
        );
        expect(html).toContain('role="alert"');
        expect(html).toContain("显示设置加载失败");
        invoke(retry, "onClick");
        expect(
            harness.display.ensureDisplaySettingsLoaded,
        ).toHaveBeenCalledOnce();

        resetCaptures();
        harness.voscript.hasLoaded = false;
        harness.voscript.isLoading = false;
        harness.voscript.loadError = "VoScript 设置加载失败";
        html = render(React.createElement(VoScriptSection));
        retry = findCaptured(
            harness.captures.buttons,
            (props) => capturedLabel(props) === "重试",
        );
        expect(html).toContain('aria-live="assertive"');
        expect(html).toContain("VoScript 设置加载失败");
        invoke(retry, "onClick");
        expect(
            harness.voscript.ensureVoScriptSettingsLoaded,
        ).toHaveBeenCalledOnce();
    });

    it("keeps speaker profile and voiceprint management live through request handlers", async () => {
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            return Promise.resolve(
                url === "/api/voiceprints"
                    ? Response.json({
                          available: true,
                          voiceprints: [],
                      })
                    : Response.json({ profiles: [] }),
            );
        });
        vi.stubGlobal("fetch", fetchMock);
        const html = render(React.createElement(SpeakerProfilesPanel));
        const refreshButtons = harness.captures.buttons.filter(
            (props) => capturedLabel(props) === "刷新",
        );

        expect(html).toContain('aria-label="说话人设置"');
        expect(html).toContain("已保存的说话人");
        expect(html).toContain("声纹库");
        expect(refreshButtons).toHaveLength(2);
        for (const button of refreshButtons) {
            invoke(button, "onClick");
        }
        await flushAsyncWork();
        expect(fetchMock).toHaveBeenCalledWith("/api/speakers/profiles", {
            cache: "no-store",
        });
        expect(fetchMock).toHaveBeenCalledWith("/api/voiceprints", {
            cache: "no-store",
        });
    });

    it("keeps settings skeletons semantic and stable for loading states", () => {
        const html = render(
            React.createElement(
                "div",
                null,
                React.createElement(SettingsSectionSkeleton, {
                    cards: 2,
                    fieldsPerCard: 2,
                }),
                React.createElement(SettingsListSkeleton, { rows: 3 }),
            ),
        );

        expect(html).toContain('aria-busy="true"');
        expect(html).toContain('aria-label="正在加载设置"');
        expect(html).toContain('aria-live="polite"');
        expect(html.match(/data-slot="field"/g)).toHaveLength(7);
        expect(html).toContain('data-slot="skeleton"');
        expect(html).not.toContain("data-sot");
    });
});
