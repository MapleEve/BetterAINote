import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

        expect(service).toContain("DATA_SOURCES_TEST_API_PATH");
        expect(service).toContain('"/api/data-sources/test"');
        expect(service).toContain('method: "POST"');
        expect(hook).toContain("testDataSource(");
        expect(hook).toContain("testSourceSettings");
        expect(hook).not.toContain("@/server");
        expect(hook).not.toContain("@/db");
        expect(settingsContent).toContain("testSourceSettings(source)");
        expect(settingsContent).toContain('data-sot-control="source-test"');
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
            "<DataSourcesSettingsPanel scrollRef={scrollRef} />",
        );
        expect(settingsContent).toContain("selectedProvider");
        expect(settingsContent).toContain("DataSourcesSettingsPanel");
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

        expect(fieldControl).toContain("isSensitiveProviderField");
        expect(fieldControl).toContain("shouldRenderTextareaAsPasswordInput");
        expect(fieldControl).toContain('field.target === "secret"');
        expect(fieldControl).toContain("header");
        expect(fieldControl).toContain("payload");
        expect(fieldControl).toContain("password");
        expect(fieldControl).toContain("sensitive: sensitiveTextField");
        expect(fieldControl).toContain("sensitiveTextareaPasswordFallback");
        expect(fieldControl).toContain("sensitive-textarea-password-input");
        expect(fieldControl).toContain("masked: readOnlyMaskedDisplay");
        expect(fieldControl).toContain("data-sot-mask={");
        expect(fieldControl).not.toContain('"mask"');
        expect(settingFieldControl).toContain("masked?: boolean");
        expect(settingFieldControl).toContain(
            "sensitiveTextareaPasswordFallback?: boolean",
        );
        expect(settingFieldControl).toContain("data-sot-mask={field.masked");
        expect(settingFieldControl).toContain("data-sot-privacy-boundary={");
        expect(settingFieldControl).toContain("onPaste");
        expect(settingFieldControl).toContain("clipboardData.getData");
        expect(settingFieldControl).toContain('"text"');
        expect(settingFieldControl).toContain("preventDefault");
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
        expect(dashboardWorkstation).toContain('value: "source"');
        expect(dashboardWorkstation).toContain('label: "来源详情"');
        expect(dashboardWorkstation).toContain('tabKey: "source-report"');
        expect(dashboardWorkstation).toContain('detailTab === "source"');
        expect(dashboardWorkstation).toContain(
            "SourceReportPane as SotSourceReportPane",
        );
        expect(dashboardWorkstation).toContain(
            "SourceReportCopyButton as SotSourceReportCopyButton",
        );
        expect(dashboardWorkstation).toContain("<SotSourceReportPane");
        expect(dashboardWorkstation).toContain("<SotSourceReportCopyButton");
        expect(dashboardWorkstation).toContain('surface="dashboard"');
        expect(dashboardWorkstation).toContain(
            'hidden={detailTab !== "source"}',
        );
        expect(dashboardWorkstation).toContain(
            "selectedRecording.sourceProvider",
        );
        expect(dashboardWorkstation).toContain("formatAbsoluteDate(");
        expect(dashboardWorkstation).toContain('copy="source-transcript"');
        expect(dashboardWorkstation).toContain('copy="source-report"');

        const dashboardSourceReportPaneStart = sourceReportPrimitives.indexOf(
            'if (surface === "dashboard")',
        );
        const recordingSourceReportPaneStart = sourceReportPrimitives.indexOf(
            'data-sot-panel="recording-source-report"',
            dashboardSourceReportPaneStart,
        );
        expect(dashboardSourceReportPaneStart).toBeGreaterThanOrEqual(0);
        expect(recordingSourceReportPaneStart).toBeGreaterThan(
            dashboardSourceReportPaneStart,
        );
        const dashboardSourceReportPane = sourceReportPrimitives.slice(
            dashboardSourceReportPaneStart,
            recordingSourceReportPaneStart,
        );

        expect(dashboardSourceReportPane).toContain(
            "data-sot-source-report-pane",
        );
        expect(dashboardSourceReportPane).toContain(
            'data-sot-panel="dashboard-source-report"',
        );
        expect(dashboardSourceReportPane).toContain(
            'data-sot-tab-pane="source-report"',
        );
        expect(dashboardSourceReportPane).toContain("data-sot-state={state}");
        expect(dashboardSourceReportPane).toContain(
            'data-tab-pane="source-report"',
        );
        expect(dashboardSourceReportPane).toContain("hidden={hidden}");

        const sourceReportCopyButtonStart = sourceReportPrimitives.indexOf(
            "export function SourceReportCopyButton",
        );
        const sourceReportCopyButtonEnd = sourceReportPrimitives.indexOf(
            "const sourceReportActionButtonStyles",
            sourceReportCopyButtonStart,
        );
        expect(sourceReportCopyButtonStart).toBeGreaterThanOrEqual(0);
        expect(sourceReportCopyButtonEnd).toBeGreaterThan(
            sourceReportCopyButtonStart,
        );
        const sourceReportCopyButton = sourceReportPrimitives.slice(
            sourceReportCopyButtonStart,
            sourceReportCopyButtonEnd,
        );

        expect(sourceReportCopyButton).toContain("data-sot-control={");
        expect(sourceReportCopyButton).toContain('? "copy-source-report"');
        expect(sourceReportCopyButton).toContain(': "copy-source-transcript"');
        expect(sourceReportCopyButton).toContain("data-sot-state={copyState}");
        expect(sourceReportCopyButton).toContain("data-tab-scope={tabScope}");

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
