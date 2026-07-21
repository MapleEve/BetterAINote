import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    CANONICAL_SOT_REFERENCE_ROOT_ENV,
    resolveVerifiedCanonicalSotReference,
    resolveVerifiedSotReference,
} from "../../e2e/helpers/canonical-sot-reference";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_REPORT_ROOT = path.join(ROOT, "features/source-report");
const CANONICAL_SOT_VERIFIER_FIXTURE_RELATIVE_ROOT =
    "e2e/fixtures/canonical-sot-verifier/root";
const CANONICAL_SOT_VERIFIER_FIXTURE_ROOT = path.join(
    ROOT,
    "..",
    CANONICAL_SOT_VERIFIER_FIXTURE_RELATIVE_ROOT,
);
const CANONICAL_SOT_VERIFIER_FIXTURE_INTEGRITY_PATH = path.join(
    ROOT,
    "../e2e/fixtures/canonical-sot-verifier/integrity.json",
);
const OLD_CANONICAL_SOT_REFERENCE_ROOT = path.join(
    ROOT,
    "../e2e/fixtures/sot-web/handoff-20260531",
);
const CANONICAL_SOT_VERIFIER_FIXTURE_SNAPSHOT = {
    fileCount: 1,
    manifestSha256:
        "c68935faf874d06a3003526cc37d78997c2ed93482863036b4315b6151d10d3b",
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

function listFixtureFiles(directory: string, root = directory): string[] {
    return readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name))
        .flatMap((entry) => {
            const target = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                return listFixtureFiles(target, root);
            }
            return [path.relative(root, target).split(path.sep).join("/")];
        });
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

    it("keeps recording detail on direct shadcn composition", () => {
        for (const component of [
            "SourceReportMetricCards",
            "SourceReportSegments",
            "SourceReportActionButton",
        ]) {
            expect(dashboardComposition).toContain(`<${component}`);
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

        expect(recordingPanel).not.toContain(
            '@/features/source-report/primitives',
        );
        expect(recordingPanel).not.toContain("<SourceReportPane");
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
        expect(recordingPanel).toContain(
            "const sourceSummaryText = sourceSummaryDisplayText(sourceReportCopyText);",
        );
        expect(recordingPanel).toContain(
            "const sourceSummaryVisible = Boolean(sourceSummaryText);",
        );
        expect(recordingPanel).toMatch(
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

    it("verifies the tracked sanitized fixture with the same manifest verifier used for the real handoff", async () => {
        await withCanonicalSotReferenceRoot(
            CANONICAL_SOT_VERIFIER_FIXTURE_RELATIVE_ROOT,
            async () => {
                await expect(
                    resolveVerifiedSotReference({
                        rootEnvironmentVariable:
                            CANONICAL_SOT_REFERENCE_ROOT_ENV,
                        snapshot: CANONICAL_SOT_VERIFIER_FIXTURE_SNAPSHOT,
                        subject: "sanitized verifier fixture",
                    }),
                ).resolves.toMatchObject({
                    available: true,
                    reference: {
                        root: CANONICAL_SOT_VERIFIER_FIXTURE_ROOT,
                    },
                    snapshot: CANONICAL_SOT_VERIFIER_FIXTURE_SNAPSHOT,
                });
            },
        );
    });

    it("returns explicit UNPROVEN evidence when the verifier fixture root is missing", async () => {
        await withCanonicalSotReferenceRoot(
            `${CANONICAL_SOT_VERIFIER_FIXTURE_RELATIVE_ROOT}/missing`,
            async () => {
                await expect(
                    resolveVerifiedSotReference({
                        rootEnvironmentVariable:
                            CANONICAL_SOT_REFERENCE_ROOT_ENV,
                        snapshot: CANONICAL_SOT_VERIFIER_FIXTURE_SNAPSHOT,
                        subject: "sanitized verifier fixture",
                    }),
                ).resolves.toEqual({
                    available: false,
                    reason: "UNPROVEN: canonical audit skipped because BETTERAINOTE_CANONICAL_SOT_REFERENCE_ROOT does not resolve to a readable handoff root.",
                });
            },
        );
    });

    it("keeps the verifier fixture tracked, structure-only, and integrity-pinned", () => {
        const integrity = JSON.parse(
            readFileSync(CANONICAL_SOT_VERIFIER_FIXTURE_INTEGRITY_PATH, "utf8"),
        );
        const fixtureFiles = listFixtureFiles(
            CANONICAL_SOT_VERIFIER_FIXTURE_ROOT,
        );
        const trackedPaths = [
            "e2e/fixtures/canonical-sot-verifier/integrity.json",
            ...fixtureFiles.map(
                (relativePath) =>
                    `e2e/fixtures/canonical-sot-verifier/root/${relativePath}`,
            ),
        ];

        expect(integrity).toEqual({
            fixtureRole: "synthetic canonical SOT verifier structure fixture",
            sourceMaterial: "synthetic; no private handoff content copied",
            prohibitedContent: [
                "recordings",
                "transcripts",
                "tokens",
                "private identifiers",
            ],
            requiredFiles: ["project/ui_kits/web/index.html"],
            snapshot: CANONICAL_SOT_VERIFIER_FIXTURE_SNAPSHOT,
        });
        expect(fixtureFiles).toEqual(integrity.requiredFiles);
        expect(
            readFileSync(
                path.join(
                    CANONICAL_SOT_VERIFIER_FIXTURE_ROOT,
                    "project/ui_kits/web/index.html",
                ),
                "utf8",
            ),
        ).toBe(
            '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Canonical SOT verifier fixture</title></head><body>synthetic structure-only fixture</body></html>\n',
        );

        for (const trackedPath of trackedPaths) {
            expect(() =>
                execFileSync(
                    "git",
                    ["ls-files", "--error-unmatch", trackedPath],
                    {
                        cwd: path.join(ROOT, ".."),
                        stdio: "pipe",
                    },
                ),
            ).not.toThrow();
        }
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

    it("keeps the private primitive registry out of recording detail", () => {
        expect(primitives).toContain("export function SourceReportPane");
        expect(dashboardComposition).toContain("<SourceReportPane");
        expect(recordingPanel).not.toContain("<SourceReportPane");
        expect(recordingPanel).not.toContain("SourceReportActionButton");
    });
});
