import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_REPORT_ROOT = path.join(ROOT, "features/source-report");

function read(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function boundedSlice(source: string, start: string, end: string) {
    const startIndex = source.indexOf(start);
    const endIndex = source.indexOf(end, startIndex);

    expect(startIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBeGreaterThan(startIndex);

    return source.slice(startIndex, endIndex + end.length);
}

describe("source report framework integration", () => {
    const primitives = read("features/source-report/primitives.tsx");
    const recordingPanel = read(
        "features/recordings/components/source-report-panel.tsx",
    );
    const dashboard = read("features/dashboard/workstation.tsx");
    const recordingWorkstation = read("features/recordings/workstation.tsx");
    const dashboardComposition = boundedSlice(
        dashboard,
        "<SourceReportPane",
        "</SourceReportPane>",
    );
    const ownedProductionComposition = [
        primitives,
        recordingPanel,
        dashboardComposition,
    ].join("\n");

    it("uses the shared shadcn composition without a private style registry", () => {
        expect(existsSync(path.join(SOURCE_REPORT_ROOT, "styles.ts"))).toBe(
            false,
        );

        for (const moduleName of [
            "alert",
            "badge",
            "button",
            "card",
            "empty",
            "separator",
            "skeleton",
        ]) {
            expect(primitives).toContain(`@/components/ui/${moduleName}`);
        }

        for (const primitive of [
            "<Alert",
            "<Badge",
            "<Button",
            "<Card",
            "<Empty",
            "<Separator",
            "<Skeleton",
        ]) {
            expect(primitives).toContain(primitive);
        }

        expect(ownedProductionComposition).not.toMatch(
            /sourceReportSotStyles|SourceReportStyleVariables|SOURCE_REPORT_STYLE/,
        );
        expect(ownedProductionComposition).not.toMatch(
            /#[\da-f]{3,8}|rgb\(|hsl\(|oklch\(|color-mix\(/i,
        );
        expect(ownedProductionComposition).not.toMatch(/\[[^\]]*px\]/);
        expect(ownedProductionComposition).not.toContain("<svg");
        expect(ownedProductionComposition).not.toContain("data-sot");
    });

    it("mounts the same source report composition in dashboard and detail", () => {
        for (const component of [
            "SourceReportMetricCards",
            "SourceReportMetricCard",
            "SourceReportSection",
            "SourceReportSegments",
            "SourceReportMetaList",
            "SourceReportActionButton",
        ]) {
            expect(recordingPanel).toContain(`<${component}`);
            expect(dashboardComposition).toContain(`<${component}`);
        }

        expect(recordingPanel).toContain("<SourceReportPane");
        expect(dashboardComposition).toContain('surface="dashboard"');
        expect(dashboardComposition).toContain("<DashboardSourceReportState");
        expect(recordingWorkstation).toContain("<SourceReportPanel");
        expect(recordingPanel).toMatch(
            /`\/api\/recordings\/\$\{recordingId\}\/source-report`/,
        );
        expect(dashboard).toMatch(
            /`\/api\/recordings\/\$\{selectedRecordingId\}\/source-report`/,
        );
    });

    it("keeps every exported source report primitive connected to live composition", () => {
        const consumers = `${recordingPanel}\n${dashboardComposition}`;
        const exportedComponents = Array.from(
            primitives.matchAll(/export function (SourceReport\w+)/g),
            (match) => match[1],
        );

        expect(exportedComponents.length).toBeGreaterThan(10);
        for (const component of exportedComponents) {
            expect(
                consumers,
                `${component} must have a live consumer`,
            ).toContain(component);
        }
    });
});
