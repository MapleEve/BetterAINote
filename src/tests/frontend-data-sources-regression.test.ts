import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/language-provider";
import {
    TranscriptionPanel,
    type TranscriptionPanelTab,
} from "@/features/dashboard/components/transcription-panel";
import {
    DashboardSourceReportState,
    SourceReportCopyButton,
    SourceReportPane,
    SourceReportSection,
} from "@/features/source-report/primitives";

type SegmentedTabsCapture = {
    items: Array<{
        disabled?: boolean;
        label: string;
        tabKey?: string;
        value: string;
    }>;
    onValueChange: (value: string) => void;
    value: string;
};

const segmentedTabsCapture = vi.hoisted(() => ({
    props: null as SegmentedTabsCapture | null,
}));

vi.mock("@/components/ui/segmented-tabs", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@/components/ui/segmented-tabs")>();
    const ReactModule = await import("react");

    return {
        ...actual,
        SegmentedTabs(
            props: React.ComponentProps<typeof actual.SegmentedTabs>,
        ) {
            segmentedTabsCapture.props = props as SegmentedTabsCapture;
            return ReactModule.createElement(actual.SegmentedTabs, props);
        },
    };
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const next = path.join(dir, entry);
        const stats = statSync(next);

        if (stats.isDirectory()) {
            if (entry === "app") {
                return walk(next).filter(
                    (file) =>
                        !file.includes(`${path.sep}api${path.sep}`) &&
                        !file.endsWith(`${path.sep}route.ts`),
                );
            }

            if (entry === "tests") {
                return [];
            }

            return walk(next);
        }

        if (!/\.(ts|tsx)$/.test(entry)) {
            return [];
        }

        return [next];
    });
}

function renderDashboardSourceTab(
    activeTab: TranscriptionPanelTab,
    onActiveTabChange: (tab: TranscriptionPanelTab) => void,
) {
    segmentedTabsCapture.props = null;
    const sourceActions = React.createElement(
        React.Fragment,
        null,
        React.createElement(
            SourceReportCopyButton,
            {
                "aria-busy": false,
                "aria-disabled": "false",
                copy: "source-transcript",
                copyState: "ready",
                disabled: false,
                hidden: activeTab !== "source",
                onClick: vi.fn(),
                type: "button",
            } as unknown as React.ComponentProps<typeof SourceReportCopyButton>,
            "复制来源转写",
        ),
        React.createElement(
            SourceReportCopyButton,
            {
                "aria-busy": false,
                "aria-disabled": "false",
                copy: "source-report",
                copyState: "ready",
                disabled: false,
                hidden: activeTab !== "source",
                onClick: vi.fn(),
                type: "button",
            } as unknown as React.ComponentProps<typeof SourceReportCopyButton>,
            "复制来源报告",
        ),
    );
    const sourceReportSection = React.createElement(
        SourceReportSection,
        {
            description: "来自 TicNote · 1 段",
            section: "transcript",
            title: "来源转写",
        } as React.ComponentProps<typeof SourceReportSection>,
        React.createElement("p", null, "来源逐字稿"),
    );
    const sourceReportState = React.createElement(
        DashboardSourceReportState,
        {
            state: "loaded",
        } as React.ComponentProps<typeof DashboardSourceReportState>,
        sourceReportSection,
    );
    const sourcePane = React.createElement(
        SourceReportPane,
        {
            state: "loaded",
            surface: "dashboard",
            variant: "embedded",
        } as React.ComponentProps<typeof SourceReportPane>,
        sourceReportState,
    );

    const panel = React.createElement(TranscriptionPanel, {
        activeTab,
        isTranscriptLoading: false,
        localCopyFeedback: null,
        localCopyState: "ready",
        onActiveTabChange,
        onCopyLocal: vi.fn(),
        onRetryTranscript: vi.fn(),
        recording: {
            audioUrl: "/api/recordings/recording-1/audio",
            id: "recording-1",
        },
        retranscription: {
            description: "可以重新运行私有转写",
            onDismiss: vi.fn(),
            onRequest: vi.fn(),
            onRetry: vi.fn(),
            state: "idle",
            title: "重新转写",
        },
        sourceActions,
        sourcePane,
        speakerMerge: {
            onMerge: vi.fn(),
            onRetry: vi.fn(),
            state: "idle",
        },
        speakers: [],
        transcriptError: null,
        transcriptLanguage: "zh-CN",
        turns: [
            {
                id: "turn-1",
                speakerName: "Maple",
                startMs: 0,
                text: "本地逐字稿",
            },
        ],
    });

    return renderToStaticMarkup(
        React.createElement(
            LanguageProvider,
            {
                language: "zh-CN",
            } as React.ComponentProps<typeof LanguageProvider>,
            panel,
        ),
    );
}

describe("frontend data-source routing regression", () => {
    it("does not reference legacy /api/plaud routes outside backend handlers", () => {
        const files = walk(ROOT);
        const offenders = files.filter((file) =>
            readFileSync(file, "utf8").includes("/api/plaud/"),
        );

        expect(offenders).toEqual([]);
    });

    it("keeps settings connection tests on the unified no-persist endpoint", () => {
        const service = readFileSync(
            path.join(ROOT, "services/data-sources.ts"),
            "utf8",
        );
        const hook = readFileSync(
            path.join(
                ROOT,
                "features/data-sources/use-data-sources-settings.ts",
            ),
            "utf8",
        );
        const settingsContent = readFileSync(
            path.join(
                ROOT,
                "features/settings/components/settings-content.tsx",
            ),
            "utf8",
        );
        const dataSourcesSection = readFileSync(
            path.join(
                ROOT,
                "features/settings/components/sections/data-sources-section.tsx",
            ),
            "utf8",
        );

        expect(service).toContain("DATA_SOURCES_TEST_API_PATH");
        expect(service).toContain('"/api/data-sources/test"');
        expect(service).toContain('method: "POST"');
        expect(hook).toContain("testDataSource(");
        expect(hook).toContain("testSourceSettings");
        expect(hook).not.toContain("@/server");
        expect(hook).not.toContain("@/db");
        expect(settingsContent).toContain("<DataSourcesSection");
        expect(dataSourcesSection).toContain("testSourceSettings(source)");
        expect(dataSourcesSection).toMatch(
            /aria-busy=\{actionState === "testing"\}[\s\S]*?handleTestSource\(selectedSource\)/,
        );
        expect(settingsContent).not.toContain(
            "Connection details look complete",
        );
    });

    it("keeps onboarding on the unified data-sources flow", () => {
        const onboardingForm = readFileSync(
            path.join(
                ROOT,
                "features/onboarding/components/onboarding-form.tsx",
            ),
            "utf8",
        );
        const onboardingPage = readFileSync(
            path.join(ROOT, "app/(app)/onboarding/page.tsx"),
            "utf8",
        );
        const onboardingModule = readFileSync(
            path.join(ROOT, "server/modules/onboarding/index.ts"),
            "utf8",
        );

        expect(onboardingForm).toContain("/api/data-sources");
        expect(onboardingForm).not.toContain("/api/plaud/connect");
        expect(onboardingModule).toContain("sourceConnections");
        expect(onboardingModule).toContain("hasCompletedOnboarding");
        expect(onboardingPage).not.toContain("plaudConnections");
        expect(onboardingModule).not.toContain("plaudConnections");
    });

    it("keeps onboarding and settings free of Plaud-only main-flow branches", () => {
        const onboardingForm = readFileSync(
            path.join(
                ROOT,
                "features/onboarding/components/onboarding-form.tsx",
            ),
            "utf8",
        );
        const settingsContent = readFileSync(
            path.join(
                ROOT,
                "features/settings/components/settings-content.tsx",
            ),
            "utf8",
        );

        expect(onboardingForm).not.toContain('provider === "plaud"');
        expect(onboardingForm).not.toContain('targetProvider === "plaud"');
        expect(onboardingForm).not.toContain("handlePlaudSave");
        expect(settingsContent).not.toContain("handlePlaudSave");
        expect(settingsContent).not.toContain('source.provider !== "plaud"');
    });

    it("keeps settings IA on the three-layer data source structure with canonical SOT sections", () => {
        const settingsTypes = readFileSync(
            path.join(ROOT, "types/settings.ts"),
            "utf8",
        );
        const settingsDialog = readFileSync(
            path.join(ROOT, "features/settings/components/settings-dialog.tsx"),
            "utf8",
        );
        const settingsContent = readFileSync(
            path.join(
                ROOT,
                "features/settings/components/settings-content.tsx",
            ),
            "utf8",
        );
        const dataSourcesSection = readFileSync(
            path.join(
                ROOT,
                "features/settings/components/sections/data-sources-section.tsx",
            ),
            "utf8",
        );
        const workstation = readFileSync(
            path.join(ROOT, "features/dashboard/workstation.tsx"),
            "utf8",
        );
        expect(settingsTypes).toContain('"appearance"');
        expect(settingsTypes).toContain('"misc"');
        expect(settingsDialog).toContain("normalizeSettingsSection");
        expect(settingsDialog).not.toContain("legacySectionAliases");
        expect(settingsDialog).not.toContain('display: "appearance"');
        expect(settingsDialog).not.toContain('sync: "misc"');
        expect(settingsDialog).not.toContain('playback: "misc"');
        expect(settingsDialog).toContain(
            "export function normalizeSettingsSection",
        );
        expect(settingsDialog).toContain("settingsDialog.sections.appearance");
        expect(settingsDialog).toContain("settingsDialog.sections.misc");
        expect(settingsContent).toContain('case "appearance"');
        expect(settingsContent).toContain('case "misc"');
        expect(settingsContent).not.toContain('case "display"');
        expect(settingsContent).not.toContain('case "sync"');
        expect(settingsContent).not.toContain('case "playback"');
        expect(settingsContent).toContain(
            "<MiscSettingsPanel scrollRef={scrollRef} />",
        );
        expect(settingsContent).toContain(
            "<DataSourcesSection scrollRef={scrollRef} />",
        );
        expect(settingsContent).not.toContain("DataSourcesSettingsPanel");
        expect(settingsContent).not.toContain("testSourceSettings");
        expect(dataSourcesSection).toContain(
            "const [selectedProvider, setSelectedProvider]",
        );
        expect(dataSourcesSection).toContain("testSourceSettings(source)");
        expect(dataSourcesSection).toContain(
            "aria-labelledby={providerDetailTitleId}",
        );
        expect(settingsContent).not.toContain(
            "getSupportedSourceCapabilityDisplayItems",
        );
        expect(settingsContent).not.toContain("renderCapabilityMatrix");
        expect(workstation).toContain("window.history.replaceState");
        expect(workstation).toContain("openSettings");
        expect(workstation).toContain("setSettingsOpen(true)");
        expect(workstation).toContain("useBrowserRouteController");
        expect(workstation).toContain("refreshBrowserRoute(router)");
        expect(workstation).toContain("await manualSync()");
        expect(workstation).toContain("await Promise.all([");
    });

    it("keeps provider tiles linked to the labeled detail region", () => {
        const dataSourcesSection = readFileSync(
            path.join(
                ROOT,
                "features/settings/components/sections/data-sources-section.tsx",
            ),
            "utf8",
        );

        expect(dataSourcesSection).toContain(
            'const SOURCE_PROVIDER_DETAIL_ID = "data-source-provider-detail"',
        );
        expect(dataSourcesSection).toContain(
            "aria-controls={SOURCE_PROVIDER_DETAIL_ID}",
        );
        expect(dataSourcesSection).toContain("aria-pressed={isSelected}");
        expect(dataSourcesSection).toContain("id={SOURCE_PROVIDER_DETAIL_ID}");
        expect(dataSourcesSection).toContain(
            "aria-labelledby={providerDetailTitleId}",
        );
        expect(dataSourcesSection).toContain("<h3 id={providerDetailTitleId}>");
        expect(dataSourcesSection).toContain(
            "aria-busy={isSourceActionStateBusy(actionState)}",
        );
        expect(dataSourcesSection).toContain('role="status"');
        expect(dataSourcesSection).toContain('aria-live="polite"');
        expect(dataSourcesSection).toContain("disabled={interactionDisabled}");
        expect(dataSourcesSection).not.toContain("data-sot-");
        expect(dataSourcesSection).toContain(
            "max-[639px]:[&_[data-slot=field]]:flex-col",
        );
        expect(dataSourcesSection).toContain(
            "max-[639px]:[&_[data-slot=field-control]]:w-full",
        );
        for (const forbiddenBusinessVisualSystem of [
            /\b[A-Za-z_$][A-Za-z0-9_$]*ClassNames\b/,
            /\b[A-Z][A-Z0-9_]*_CLASS_NAME\b/,
            /\b[A-Za-z_$][A-Za-z0-9_$]*Styles\b/,
            /\b(?:SourceActionButton|SourceActionStatusBadge|ProviderStateBanner)\b/,
            /\bSOURCE_ACTION_BUTTON_PRIMITIVE_VARIANT_BY_TONE\b/,
        ]) {
            expect(dataSourcesSection).not.toMatch(
                forbiddenBusinessVisualSystem,
            );
        }
    });

    it("keeps automatic updates labeled and bound to the selected provider", () => {
        const dataSourcesSection = readFileSync(
            path.join(
                ROOT,
                "features/settings/components/sections/data-sources-section.tsx",
            ),
            "utf8",
        );
        const automaticUpdatesSwitch =
            dataSourcesSection.match(
                /<Switch\s+id=\{automaticUpdatesFieldId\}[\s\S]*?\/>/,
            )?.[0] ?? "";

        expect(dataSourcesSection).toMatch(
            /const automaticUpdatesFieldId = selectedSource[\s\S]*?selectedSource\.provider\}-automatic-updates/,
        );
        expect(dataSourcesSection).toContain(
            "const automaticUpdatesDescriptionId = automaticUpdatesFieldId",
        );
        expect(dataSourcesSection).toMatch(
            /<FieldLabel\s+htmlFor=\{automaticUpdatesFieldId\}[\s\S]*?Automatic updates/,
        );
        expect(dataSourcesSection).toContain(
            "id={automaticUpdatesDescriptionId}",
        );
        expect(automaticUpdatesSwitch).toMatch(
            /aria-describedby=\{\s*automaticUpdatesDescriptionId\s*\}/,
        );
        expect(automaticUpdatesSwitch).toContain(
            "checked={selectedSource.enabled}",
        );
        expect(automaticUpdatesSwitch).toContain(
            "disabled={interactionDisabled}",
        );
        expect(automaticUpdatesSwitch).toMatch(
            /onCheckedChange=\{\(checked\) =>\s*updateSource\(\s*selectedSource\.provider,\s*\(current\) => \(\{\s*\.\.\.current,\s*enabled: checked,/,
        );
    });

    it("hides sensitive provider secret replacement inputs in settings", () => {
        const fieldControl = readFileSync(
            path.join(
                ROOT,
                "features/data-sources/data-source-field-control.tsx",
            ),
            "utf8",
        );
        const settingFieldControl = readFileSync(
            path.join(
                ROOT,
                "features/settings/components/setting-field-control.tsx",
            ),
            "utf8",
        );
        const textareaPrimitive = readFileSync(
            path.join(ROOT, "components/ui/textarea.tsx"),
            "utf8",
        );

        expect(textareaPrimitive).toContain("export function Textarea");
        expect(textareaPrimitive).toContain('React.ComponentProps<"textarea">');
        expect(textareaPrimitive).toContain('data-slot="textarea"');
        expect(textareaPrimitive).not.toContain("data-sot-privacy-boundary");
        expect(fieldControl).toContain("isSensitiveProviderField");
        expect(fieldControl).toMatch(
            /type=\{\s*renderedField\.sensitive\s*\?\s*"password"\s*:\s*"text"/,
        );
        expect(fieldControl).toContain(
            'field.kind === "textarea" && !renderedField.sensitive',
        );
        expect(fieldControl).toContain('field.target === "secret"');
        expect(fieldControl).toContain("header");
        expect(fieldControl).toContain("payload");
        expect(fieldControl).toContain("password");
        expect(fieldControl).toContain("sensitive: sensitiveTextField");
        expect(fieldControl).toContain("onPaste={");
        expect(fieldControl).toContain('event.clipboardData.getData("text")');
        expect(fieldControl).toContain("masked: readOnlyMaskedDisplay");
        expect(fieldControl).not.toContain('"mask"');
        expect(settingFieldControl).toContain("masked?: boolean");
        expect(settingFieldControl).toContain(
            "sensitiveTextareaPasswordFallback?: boolean",
        );
        expect(settingFieldControl).toContain(
            'field.kind === "textarea" && !field.sensitive',
        );
        expect(settingFieldControl).toContain("<FieldLabel htmlFor={fieldId}>");
        expect(settingFieldControl).toMatch(
            /type=\{\s*field\.sensitive\s*\?\s*"password"/,
        );
        expect(settingFieldControl).toContain("disabled={disabled}");
        expect(settingFieldControl).toContain("readOnly={field.readOnly}");
        expect(settingFieldControl).toContain(
            'field.masked && "tracking-widest"',
        );
        expect(settingFieldControl).not.toContain("data-sot-mask");
        expect(settingFieldControl).not.toContain("data-sot-privacy-boundary");
        expect(settingFieldControl).toContain("onPaste");
        expect(settingFieldControl).toContain("clipboardData.getData");
        expect(settingFieldControl).toContain('"text"');
        expect(settingFieldControl).toContain("preventDefault");
    });

    it("renders and switches to the source-detail tab through accessible controls", () => {
        const onActiveTabChange = vi.fn();
        const transcriptHtml = renderDashboardSourceTab(
            "transcript",
            onActiveTabChange,
        );
        const inactiveSourceTab =
            transcriptHtml.match(
                /<button(?=[^>]*role="tab")(?=[^>]*id="dashboard-transcription-tab-source")[^>]*>/,
            )?.[0] ?? "";
        const hiddenSourcePane =
            transcriptHtml.match(
                /<section(?=[^>]*id="dashboard-transcription-pane-source")[^>]*>/,
            )?.[0] ?? "";

        expect(inactiveSourceTab).toContain(
            'aria-controls="dashboard-transcription-pane-source"',
        );
        expect(inactiveSourceTab).toContain('aria-selected="false"');
        expect(inactiveSourceTab).toContain('data-tab-key="source-report"');
        expect(inactiveSourceTab).toContain('data-state="idle"');
        expect(hiddenSourcePane).toContain('role="tabpanel"');
        expect(hiddenSourcePane).toContain(
            'aria-labelledby="dashboard-transcription-tab-source"',
        );
        expect(hiddenSourcePane).toContain(' hidden=""');
        expect(transcriptHtml).toMatch(
            /<button(?=[^>]*data-testid="source-report-copy-source-transcript")(?=[^>]*hidden)[^>]*>/,
        );
        expect(segmentedTabsCapture.props).toMatchObject({
            value: "transcript",
        });
        expect(segmentedTabsCapture.props?.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    label: "来源详情",
                    tabKey: "source-report",
                    value: "source",
                }),
            ]),
        );

        segmentedTabsCapture.props?.onValueChange("source");
        expect(onActiveTabChange).toHaveBeenCalledOnce();
        expect(onActiveTabChange).toHaveBeenCalledWith("source");

        const sourceHtml = renderDashboardSourceTab(
            "source",
            onActiveTabChange,
        );
        const activeSourceTab =
            sourceHtml.match(
                /<button(?=[^>]*role="tab")(?=[^>]*id="dashboard-transcription-tab-source")[^>]*>/,
            )?.[0] ?? "";
        const visibleSourcePane =
            sourceHtml.match(
                /<section(?=[^>]*id="dashboard-transcription-pane-source")[^>]*>/,
            )?.[0] ?? "";
        const sourceTranscriptCopy =
            sourceHtml.match(
                /<button(?=[^>]*data-testid="source-report-copy-source-transcript")[^>]*>/,
            )?.[0] ?? "";

        expect(activeSourceTab).toContain('aria-selected="true"');
        expect(activeSourceTab).toContain('data-state="active"');
        expect(visibleSourcePane).not.toContain(' hidden=""');
        expect(sourceHtml).toContain('data-testid="dashboard-source-report"');
        expect(sourceHtml).toContain(
            'data-testid="dashboard-source-report-state"',
        );
        expect(sourceHtml).toContain('data-state="loaded"');
        expect(sourceHtml).toContain("来源转写");
        expect(sourceHtml).toContain("来自 TicNote · 1 段");
        expect(sourceTranscriptCopy).toContain('aria-busy="false"');
        expect(sourceTranscriptCopy).toContain('aria-disabled="false"');
        expect(sourceTranscriptCopy).toContain('data-state="ready"');
        expect(sourceTranscriptCopy).not.toContain(' hidden=""');
        expect(sourceTranscriptCopy).not.toMatch(/\sdisabled(?:=""|(?=[\s>]))/);
        expect(segmentedTabsCapture.props).toMatchObject({ value: "source" });
    });

    it("keeps recording-facing shared panels free of inline Plaud-only source branches", () => {
        const recordingWorkstation = readFileSync(
            path.join(ROOT, "features/recordings/workstation.tsx"),
            "utf8",
        );
        const transcriptionSection = readFileSync(
            path.join(
                ROOT,
                "features/recordings/components/transcription-section.tsx",
            ),
            "utf8",
        );
        const dashboardWorkstation = readFileSync(
            path.join(ROOT, "features/dashboard/workstation.tsx"),
            "utf8",
        );
        const sourceReportPrimitives = readFileSync(
            path.join(ROOT, "features/source-report/primitives.tsx"),
            "utf8",
        );
        const sourceReportPanel = readFileSync(
            path.join(
                ROOT,
                "features/recordings/components/source-report-panel.tsx",
            ),
            "utf8",
        );
        const sourceReportPrimitiveForbiddenShadcnResiduals = [
            "[[data-theme=dark]_&]",
            "[.dark_&]",
            "dark:",
            "text-[var(",
            "bg-[var(",
            "border-[var(",
            "![font-size:",
            "![line-height:",
            "![letter-spacing:",
            "!tracking-normal",
            "!text-foreground",
        ] as const;

        expect(recordingWorkstation).not.toContain(
            'sourceProvider === "plaud"',
        );
        expect(recordingWorkstation).not.toContain("dashboard.renameAndSync");
        expect(recordingWorkstation).not.toContain(
            "canTranscribe={recording.hasAudio}",
        );
        expect(transcriptionSection).not.toContain(
            "disabled={isTranscribing || !canTranscribe}",
        );
        expect(dashboardWorkstation).not.toContain(
            'sourceProvider === "plaud"',
        );
        expect(sourceReportPrimitives).not.toContain(
            'sourceProvider === "plaud"',
        );
        for (const residual of sourceReportPrimitiveForbiddenShadcnResiduals) {
            expect(sourceReportPrimitives).not.toContain(residual);
        }
        expect(dashboardWorkstation).not.toContain("SotSourceReport");
        expect(
            existsSync(path.join(ROOT, "features/source-report/styles.ts")),
        ).toBe(false);
        expect(sourceReportPrimitives).not.toContain(
            "sourceReportCopyButtonStyles",
        );
        expect(sourceReportPrimitives).not.toContain(
            "sourceReportActionButtonStyles",
        );

        expect(sourceReportPanel).not.toContain('sourceProvider === "plaud"');
        expect(sourceReportPanel).not.toContain(
            ['t("sourceReport.detail', 'Payload")'].join(""),
        );
        expect(sourceReportPanel).not.toContain("JSON.stringify(data.detail");
        expect(sourceReportPanel).toContain('section="metadata"');
        expect(sourceReportPanel).toContain('title="来源信息"');
        expect(sourceReportPanel).toContain("formatTranscriptTimeRange");
        expect(sourceReportPanel).toContain("sourceReportDisplaySegments");
        expect(sourceReportPanel).toContain("segment.startMs");
        expect(sourceReportPanel).toContain("segment.endMs");
    });

    it("removes legacy recording route shells in favor of neutral endpoints", () => {
        expect(
            existsSync(
                path.join(
                    ROOT,
                    "app/api/recordings/[id]/transcribe-plaud/route.ts",
                ),
            ),
        ).toBe(false);
        expect(
            existsSync(
                path.join(
                    ROOT,
                    "app/api/recordings/[id]/plaud/report/route.ts",
                ),
            ),
        ).toBe(false);
        expect(
            existsSync(path.join(ROOT, "app/api/recordings/[id]/enhance")),
        ).toBe(false);
        expect(
            existsSync(
                path.join(ROOT, "app/api/recordings/[id]/export-obsidian"),
            ),
        ).toBe(false);
        expect(
            existsSync(path.join(ROOT, "app/api/recordings/[id]/summary")),
        ).toBe(false);
        expect(existsSync(path.join(ROOT, "app/api/recordings/upload"))).toBe(
            false,
        );
        expect(
            existsSync(path.join(ROOT, "app/api/recording-tags/route.ts")),
        ).toBe(true);
        expect(
            existsSync(
                path.join(ROOT, "app/api/recordings/[id]/tags/route.ts"),
            ),
        ).toBe(true);
        expect(
            existsSync(
                path.join(ROOT, "app/api/recordings/[id]/transcribe/route.ts"),
            ),
        ).toBe(true);
        expect(
            existsSync(
                path.join(
                    ROOT,
                    "app/api/recordings/[id]/source-report/route.ts",
                ),
            ),
        ).toBe(true);
    });
});
