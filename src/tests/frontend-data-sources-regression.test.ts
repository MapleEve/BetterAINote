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

    it("keeps onboarding on the unified data-sources flow", () => {
        const onboardingForm = readFileSync(
            path.join(ROOT, "components/onboarding/onboarding-form.tsx"),
            "utf8",
        );
        const onboardingPage = readFileSync(
            path.join(ROOT, "app/(app)/onboarding/page.tsx"),
            "utf8",
        );

        expect(onboardingForm).toContain("/api/data-sources");
        expect(onboardingForm).not.toContain("/api/plaud/connect");
        expect(onboardingPage).toContain("sourceConnections");
        expect(onboardingPage).not.toContain("plaudConnections");
    });

    it("keeps onboarding and settings free of Plaud-only main-flow branches", () => {
        const onboardingForm = readFileSync(
            path.join(ROOT, "components/onboarding/onboarding-form.tsx"),
            "utf8",
        );
        const dataSourcesSection = readFileSync(
            path.join(
                ROOT,
                "components/settings-sections/data-sources-section.tsx",
            ),
            "utf8",
        );

        expect(onboardingForm).not.toContain('provider === "plaud"');
        expect(onboardingForm).not.toContain('targetProvider === "plaud"');
        expect(onboardingForm).not.toContain("handlePlaudSave");
        expect(dataSourcesSection).not.toContain("handlePlaudSave");
        expect(dataSourcesSection).not.toContain('source.provider !== "plaud"');
    });

    it("keeps settings IA on the three-layer data source structure with legacy section aliases", () => {
        const settingsTypes = readFileSync(
            path.join(ROOT, "types/settings.ts"),
            "utf8",
        );
        const settingsDialog = readFileSync(
            path.join(ROOT, "components/settings-dialog.tsx"),
            "utf8",
        );
        const settingsContent = readFileSync(
            path.join(ROOT, "components/settings-content.tsx"),
            "utf8",
        );
        const workstation = readFileSync(
            path.join(ROOT, "components/dashboard/workstation.tsx"),
            "utf8",
        );
        const dataSourcesSection = readFileSync(
            path.join(
                ROOT,
                "components/settings-sections/data-sources-section.tsx",
            ),
            "utf8",
        );

        expect(settingsTypes).toContain('"appearance"');
        expect(settingsTypes).toContain('"misc"');
        expect(settingsDialog).toContain("normalizeSettingsSection");
        expect(settingsDialog).toContain('display: "appearance"');
        expect(settingsDialog).toContain('sync: "misc"');
        expect(settingsDialog).toContain('playback: "misc"');
        expect(settingsDialog).toContain(
            "export function normalizeSettingsSection",
        );
        expect(settingsDialog).toContain("settingsDialog.sections.appearance");
        expect(settingsDialog).toContain("settingsDialog.sections.misc");
        expect(settingsContent).toContain('case "appearance"');
        expect(settingsContent).toContain('case "display"');
        expect(settingsContent).toContain('case "misc"');
        expect(settingsContent).toContain('case "sync"');
        expect(settingsContent).toContain('case "playback"');
        expect(settingsContent).toContain("<MiscSection />");
        expect(dataSourcesSection).toContain("selectedProvider");
        expect(dataSourcesSection).toContain("renderProviderOverview");
        expect(dataSourcesSection).not.toContain(
            "getSupportedSourceCapabilityDisplayItems",
        );
        expect(dataSourcesSection).not.toContain("renderCapabilityMatrix");
        expect(workstation).toContain("readBrowserHash");
        expect(workstation).toContain("normalizeSettingsSection");
        expect(workstation).toContain("hashchange");
        expect(workstation).toContain("setSettingsOpen(true)");
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
            path.join(ROOT, "components/settings/setting-field-control.tsx"),
            "utf8",
        );

        expect(fieldControl).toContain("isSensitiveTextField");
        expect(fieldControl).toContain('field.target === "secret"');
        expect(fieldControl).toContain("password");
        expect(fieldControl).toContain("sensitive: sensitiveTextField");
        expect(settingFieldControl).toContain("onPaste");
        expect(settingFieldControl).toContain('clipboardData.getData("text")');
        expect(settingFieldControl).toContain("preventDefault");
    });

    it("keeps recording-facing shared panels free of inline Plaud-only source branches", () => {
        const recordingWorkstation = readFileSync(
            path.join(ROOT, "components/recordings/recording-workstation.tsx"),
            "utf8",
        );
        const transcriptionSection = readFileSync(
            path.join(ROOT, "components/recordings/transcription-section.tsx"),
            "utf8",
        );
        const transcriptionPanel = readFileSync(
            path.join(ROOT, "components/dashboard/transcription-panel.tsx"),
            "utf8",
        );
        const sourceReportPanel = readFileSync(
            path.join(ROOT, "components/recordings/source-report-panel.tsx"),
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
        expect(transcriptionPanel).not.toContain('sourceProvider === "plaud"');
        expect(transcriptionPanel).toContain('id: "source"');
        expect(transcriptionPanel).toContain("<SourceReportPanel");
        expect(transcriptionPanel).toContain('variant="embedded"');
        expect(sourceReportPanel).not.toContain('sourceProvider === "plaud"');
        expect(sourceReportPanel).not.toContain(
            ['t("sourceReport.detail', 'Payload")'].join(""),
        );
        expect(sourceReportPanel).not.toContain("JSON.stringify(data.detail");
        expect(sourceReportPanel).toContain('t("sourceReport.sourceDetails")');
        expect(sourceReportPanel).toContain("formatTranscriptTimeRange");
        expect(sourceReportPanel).toContain("data.transcript.segments");
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
