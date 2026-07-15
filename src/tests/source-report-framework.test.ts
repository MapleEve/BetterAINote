import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    CANONICAL_SOT_REFERENCE_ROOT_ENV,
    resolveVerifiedCanonicalSotReference,
} from "../../e2e/helpers/canonical-sot-reference";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_REPORT_ROOT = path.join(ROOT, "features/source-report");
const RECOVERED_CANONICAL_SOT_REFERENCE_ROOT =
    "/Users/maplec5/Documents/GitHub/BetterAINote/tmp/betterainote-design-evidence/handoff-20260715-094949/betterainote-design-system";
const OLD_CANONICAL_SOT_REFERENCE_ROOT =
    "/Users/maplec5/Documents/GitHub/BetterAINote/tmp/betterainote-design-evidence/handoff-20260531/betterainote-design-system";
const RECOVERED_CANONICAL_SOT_SNAPSHOT = {
    fileCount: 182,
    manifestSha256:
        "ce2ace3745e94538deb145268da21cf0015faec90460aa0a2605508360fa82c7",
};

function read(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

async function withCanonicalSotReferenceRoot<T>(
    configuredRoot: string | undefined,
    callback: () => Promise<T>,
) {
    const previousCanonicalSotReferenceRoot =
        process.env[CANONICAL_SOT_REFERENCE_ROOT_ENV];

    if (configuredRoot === undefined) {
        delete process.env[CANONICAL_SOT_REFERENCE_ROOT_ENV];
    } else {
        process.env[CANONICAL_SOT_REFERENCE_ROOT_ENV] = configuredRoot;
    }

    try {
        return await callback();
    } finally {
        if (previousCanonicalSotReferenceRoot === undefined) {
            delete process.env[CANONICAL_SOT_REFERENCE_ROOT_ENV];
        } else {
            process.env[CANONICAL_SOT_REFERENCE_ROOT_ENV] =
                previousCanonicalSotReferenceRoot;
        }
    }
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
            /#[\da-f]{3,8}|hsl\(|oklch\(/i,
        );
        expect(ownedProductionComposition).not.toContain("style={{");
        expect(ownedProductionComposition).not.toContain("<svg");
        expect(ownedProductionComposition).not.toContain("data-sot");
        expect(recordingPanel).not.toContain(
            "[&_[data-slot=empty-icon]_svg]:stroke-[1.8]",
        );
        expect(recordingPanel.match(/\[&[_>]/g) ?? []).toHaveLength(0);
        expect(recordingPanel).toContain('className="size-4"');
        expect(recordingPanel).toContain("strokeWidth={1.8}");
    });

    it("keeps shared contracts while detail owns explicit child styling", () => {
        for (const component of [
            "SourceReportMetricCards",
            "SourceReportSegments",
            "SourceReportActionButton",
        ]) {
            expect(recordingPanel).toContain(`<${component}`);
        }

        for (const component of [
            "SourceReportMetricCards",
            "SourceReportMetricCard",
            "SourceReportSection",
            "SourceReportSegments",
            "SourceReportMetaList",
            "SourceReportActionButton",
        ]) {
            expect(dashboardComposition).toContain(`<${component}`);
        }

        for (const component of [
            "RecordingSourceReportMetricCard",
            "RecordingSourceReportSection",
            "RecordingSourceReportMetaList",
            "RecordingSourceReportMetaRow",
            "RecordingSourceReportMissingNotice",
        ]) {
            expect(recordingPanel).toContain(`<${component}`);
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
            expect(recordingPanel).toContain(primitive);
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

    it("renders readable source summaries at the recording panel surface", () => {
        const recordingPane = boundedSlice(
            recordingPanel,
            "<SourceReportPane",
            "</SourceReportPane>",
        );

        expect(recordingPanel).toContain(
            "const sourceSummaryText = sourceSummaryDisplayText(sourceReportCopyText);",
        );
        expect(recordingPanel).toContain(
            "const sourceSummaryVisible = Boolean(sourceSummaryText);",
        );
        expect(recordingPane).toMatch(
            /\{sourceSummaryVisible \? \([\s\S]*?section="summary"[\s\S]*?<RecordingSourceReportSummaryBody>[\s\S]*?sourceSummaryText\.split\("\\n"\)\.map[\s\S]*?: null\}/,
        );
    });

    it("returns explicit UNPROVEN evidence when the canonical SOT root is unset", async () => {
        await withCanonicalSotReferenceRoot(undefined, async () => {
            await expect(
                resolveVerifiedCanonicalSotReference(),
            ).resolves.toEqual({
                available: false,
                reason: "UNPROVEN: canonical audit skipped because BETTERAINOTE_CANONICAL_SOT_REFERENCE_ROOT is not set.",
            });
        });
    });

    it("accepts the recovered canonical SOT handoff with its exact manifest", async () => {
        await withCanonicalSotReferenceRoot(
            RECOVERED_CANONICAL_SOT_REFERENCE_ROOT,
            async () => {
                await expect(
                    resolveVerifiedCanonicalSotReference(),
                ).resolves.toMatchObject({
                    available: true,
                    reference: {
                        root: RECOVERED_CANONICAL_SOT_REFERENCE_ROOT,
                    },
                    snapshot: RECOVERED_CANONICAL_SOT_SNAPSHOT,
                });
            },
        );
    });

    it("marks the old canonical SOT handoff as explicit UNPROVEN evidence", async () => {
        await withCanonicalSotReferenceRoot(
            OLD_CANONICAL_SOT_REFERENCE_ROOT,
            async () => {
                await expect(
                    resolveVerifiedCanonicalSotReference(),
                ).resolves.toEqual({
                    available: false,
                    reason: "UNPROVEN: canonical audit skipped because BETTERAINOTE_CANONICAL_SOT_REFERENCE_ROOT does not match the verified 182-file handoff manifest.",
                });
            },
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
