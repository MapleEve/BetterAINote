import {
    mkdir,
    mkdtemp,
    readFile,
    realpath,
    rm,
    writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
    CANONICAL_SOT_REFERENCE_PROVENANCE,
    CANONICAL_SOT_REFERENCE_ROOT_ENV,
    CANONICAL_SOT_REPOSITORY_ROOT_ENV,
    resolveVerifiedCanonicalSotReference,
    resolveVerifiedSotReference,
    snapshotCanonicalSotReference,
} from "../../e2e/helpers/canonical-sot-reference";
import {
    buildCanonicalSotPlaywrightChildProcessPlan,
    isCanonicalSotDependencyEntrypoint,
    parseCanonicalSotGateMode,
    summarizeCanonicalSotJsonReport,
} from "../../scripts/run-canonical-sot-gate";

const temporaryRoots: string[] = [];

async function createSyntheticProject(parent?: string) {
    const container =
        parent ?? (await mkdtemp(path.join(os.tmpdir(), "betterainote-sot-")));
    if (!parent) {
        temporaryRoots.push(container);
    }

    const projectRoot = parent ? path.join(parent, "project") : container;
    const webRoot = path.join(projectRoot, "ui_kits/web");
    await mkdir(webRoot, { recursive: true });
    await Promise.all([
        writeFile(path.join(projectRoot, "README.md"), "project provenance\n"),
        writeFile(path.join(webRoot, "README.md"), "web kit provenance\n"),
        writeFile(path.join(webRoot, "index.html"), "<!doctype html>\n"),
        writeFile(path.join(webRoot, "kit.css"), ":root {}\n"),
    ]);

    return projectRoot;
}

async function withConfiguredRoot<T>(
    configuredRoot: string,
    callback: () => Promise<T>,
) {
    const previous = process.env[CANONICAL_SOT_REFERENCE_ROOT_ENV];
    const previousRepositoryRoot =
        process.env[CANONICAL_SOT_REPOSITORY_ROOT_ENV];
    process.env[CANONICAL_SOT_REFERENCE_ROOT_ENV] = configuredRoot;
    process.env[CANONICAL_SOT_REPOSITORY_ROOT_ENV] = process.cwd();

    try {
        return await callback();
    } finally {
        if (previous === undefined) {
            delete process.env[CANONICAL_SOT_REFERENCE_ROOT_ENV];
        } else {
            process.env[CANONICAL_SOT_REFERENCE_ROOT_ENV] = previous;
        }
        if (previousRepositoryRoot === undefined) {
            delete process.env[CANONICAL_SOT_REPOSITORY_ROOT_ENV];
        } else {
            process.env[CANONICAL_SOT_REPOSITORY_ROOT_ENV] =
                previousRepositoryRoot;
        }
    }
}

afterEach(async () => {
    await Promise.all(
        temporaryRoots
            .splice(0)
            .map((temporaryRoot) =>
                rm(temporaryRoot, { force: true, recursive: true }),
            ),
    );
});

describe("canonical SOT project-root contract", () => {
    it("pins the deterministic project manifest and required provenance files", () => {
        expect(CANONICAL_SOT_REFERENCE_PROVENANCE).toEqual({
            id: "claude-design-handoff-20260715-094949-project",
            handoff: {
                bundleFileCount: 182,
                manifestSidecarRelativePath: "../../manifest.sha256",
                manifestSidecarSha256:
                    "ce2ace3745e94538deb145268da21cf0015faec90460aa0a2605508360fa82c7",
                projectRealpathSuffix: [
                    "tmp",
                    "betterainote-design-evidence",
                    "handoff-20260715-094949",
                    "betterainote-design-system",
                    "project",
                ],
            },
            manifestAlgorithm:
                "sha256 of sorted '<file-sha256>  <project-relative-posix-path>\\n' entries",
            requiredFiles: [
                "README.md",
                "ui_kits/web/README.md",
                "ui_kits/web/index.html",
                "ui_kits/web/kit.css",
            ],
            rootKind: "project",
            snapshot: {
                fileCount: 181,
                manifestSha256:
                    "f2875d4af4784b4944d19a51c918b612942f6f9cf374cca119fb9c1416d9508b",
            },
        });
    });

    it("rejects an arbitrary copied project root before accepting its file manifest", async () => {
        const projectRoot = await createSyntheticProject();

        await withConfiguredRoot(await realpath(projectRoot), async () => {
            await expect(
                resolveVerifiedCanonicalSotReference(),
            ).resolves.toEqual({
                available: false,
                reason: "UNPROVEN: canonical audit skipped because BETTERAINOTE_CANONICAL_SOT_REFERENCE_ROOT does not name the approved 20260715 handoff project realpath.",
            });
        });
    });

    it("rejects the approved handoff parent and top-level directories", async () => {
        const container = await mkdtemp(
            path.join(os.tmpdir(), "betterainote-sot-layout-"),
        );
        temporaryRoots.push(container);
        const handoffRoot = path.join(
            container,
            "tmp/betterainote-design-evidence/handoff-20260715-094949",
        );
        const bundleRoot = path.join(handoffRoot, "betterainote-design-system");
        await createSyntheticProject(bundleRoot);

        await withConfiguredRoot(bundleRoot, async () => {
            await expect(
                resolveVerifiedCanonicalSotReference(),
            ).resolves.toEqual({
                available: false,
                reason: "UNPROVEN: canonical audit skipped because BETTERAINOTE_CANONICAL_SOT_REFERENCE_ROOT names the approved 20260715 handoff bundle root; provide its project directory.",
            });
        });
        await withConfiguredRoot(handoffRoot, async () => {
            await expect(
                resolveVerifiedCanonicalSotReference(),
            ).resolves.toEqual({
                available: false,
                reason: "UNPROVEN: canonical audit skipped because BETTERAINOTE_CANONICAL_SOT_REFERENCE_ROOT does not name the approved 20260715 handoff project realpath.",
            });
        });
    });

    it("rejects a lookalike 20260715 layout outside the repository-owned approved realpath", async () => {
        const container = await mkdtemp(
            path.join(os.tmpdir(), "betterainote-sot-lookalike-"),
        );
        temporaryRoots.push(container);
        const handoffRoot = path.join(
            container,
            "tmp/betterainote-design-evidence/handoff-20260715-094949",
        );
        const projectRoot = await createSyntheticProject(
            path.join(handoffRoot, "betterainote-design-system"),
        );
        await mkdir(handoffRoot, { recursive: true });
        await writeFile(
            path.join(handoffRoot, "manifest.sha256"),
            "lookalike\n",
        );

        await withConfiguredRoot(await realpath(projectRoot), async () => {
            await expect(
                resolveVerifiedCanonicalSotReference(),
            ).resolves.toEqual({
                available: false,
                reason: "UNPROVEN: canonical audit skipped because BETTERAINOTE_CANONICAL_SOT_REFERENCE_ROOT does not name the approved 20260715 handoff project realpath.",
            });
        });
    });

    it("resolves index.html directly below the configured project root", async () => {
        const projectRoot = await createSyntheticProject();
        const snapshot = await snapshotCanonicalSotReference({
            root: projectRoot,
            webIndexUrl: pathToFileURL(
                path.join(projectRoot, "ui_kits/web/index.html"),
            ).href,
        });

        await withConfiguredRoot(projectRoot, async () => {
            await expect(
                resolveVerifiedSotReference({
                    requiredRelativePaths: [
                        "README.md",
                        "ui_kits/web/README.md",
                        "ui_kits/web/index.html",
                        "ui_kits/web/kit.css",
                    ],
                    rootEnvironmentVariable: CANONICAL_SOT_REFERENCE_ROOT_ENV,
                    snapshot,
                    subject: "synthetic project",
                    webIndexRelativePath: "ui_kits/web/index.html",
                }),
            ).resolves.toEqual({
                available: true,
                reference: {
                    root: projectRoot,
                    webIndexUrl: pathToFileURL(
                        path.join(projectRoot, "ui_kits/web/index.html"),
                    ).href,
                },
                snapshot,
            });
        });
    });

    it("rejects the parent when only its child is the matching project root", async () => {
        const parentRoot = await mkdtemp(
            path.join(os.tmpdir(), "betterainote-sot-parent-"),
        );
        temporaryRoots.push(parentRoot);
        const projectRoot = await createSyntheticProject(parentRoot);
        const snapshot = await snapshotCanonicalSotReference({
            root: projectRoot,
            webIndexUrl: pathToFileURL(
                path.join(projectRoot, "ui_kits/web/index.html"),
            ).href,
        });

        await withConfiguredRoot(parentRoot, async () => {
            await expect(
                resolveVerifiedSotReference({
                    requiredRelativePaths: [
                        "README.md",
                        "ui_kits/web/README.md",
                        "ui_kits/web/index.html",
                        "ui_kits/web/kit.css",
                    ],
                    rootEnvironmentVariable: CANONICAL_SOT_REFERENCE_ROOT_ENV,
                    snapshot,
                    subject: "synthetic project",
                    webIndexRelativePath: "ui_kits/web/index.html",
                }),
            ).resolves.toEqual({
                available: false,
                reason: "UNPROVEN: canonical audit skipped because BETTERAINOTE_CANONICAL_SOT_REFERENCE_ROOT does not resolve to a readable synthetic project root.",
            });
        });
    });
});

describe("canonical SOT gate runner contract", () => {
    it("keeps the shared Playwright helper free of mixed CommonJS and import.meta syntax", async () => {
        const helperSource = await readFile(
            path.join(process.cwd(), "e2e/helpers/canonical-sot-reference.ts"),
            "utf8",
        );

        expect(helperSource).not.toContain("import.meta");
        expect(helperSource).toContain(CANONICAL_SOT_REPOSITORY_ROOT_ENV);
    });

    it("rejects Bun cache entrypoints outside a checked-out node_modules tree", () => {
        expect(
            isCanonicalSotDependencyEntrypoint(
                "/workspace/node_modules",
                "/workspace/node_modules/.pnpm/@playwright+test@1.59.1/node_modules/@playwright/test/cli.js",
            ),
        ).toBe(true);
        expect(
            isCanonicalSotDependencyEntrypoint(
                "/workspace/node_modules",
                "/outside/bun-cache/@playwright/test@1.62.1@@@1/cli.js",
            ),
        ).toBe(false);
    });

    it("hosts the Playwright CLI in Node while retaining the Bun E2E runtime contract", () => {
        const bunExecutable = "/runtime/bun/bin/bun";
        const nodeExecutable = "/runtime/node/bin/node";
        const plan = buildCanonicalSotPlaywrightChildProcessPlan({
            bunExecutable,
            commonNodeModules: "/workspace/node_modules",
            environment: {
                NODE_ENV: "test",
                NODE_PATH: "/existing/node_modules",
                PATH: "/existing/bin",
            },
            mode: "final",
            nextCli: "/workspace/node_modules/next/dist/bin/next",
            nodeExecutable,
            playwrightCli: "/workspace/node_modules/@playwright/test/cli.js",
            repositoryRoot: "/workspace",
            reportPath: "/tmp/canonical-sot-report.json",
        });

        expect(plan.executable).toBe(nodeExecutable);
        expect(plan.executable).not.toBe(bunExecutable);
        expect(plan.arguments).toEqual([
            "/workspace/node_modules/@playwright/test/cli.js",
            "test",
            "e2e/dashboard-source-filter-stack.spec.ts",
            "e2e/source-report-backend-matrix.spec.ts",
            "--project=system-chrome",
            "--reporter=json",
        ]);
        expect(plan.options.env).toMatchObject({
            BETTERAINOTE_E2E_BUN_EXECUTABLE: bunExecutable,
            BETTERAINOTE_E2E_NEXT_CLI:
                "/workspace/node_modules/next/dist/bin/next",
            BETTERAINOTE_E2E_NODE_EXECUTABLE: nodeExecutable,
            BETTERAINOTE_CANONICAL_SOT_REPOSITORY_ROOT: "/workspace",
            NODE_PATH: [
                "/workspace/node_modules",
                "/existing/node_modules",
            ].join(path.delimiter),
            PATH: [
                "/runtime/bun/bin",
                "/runtime/node/bin",
                "/workspace/node_modules/.bin",
                "/existing/bin",
            ].join(path.delimiter),
            PLAYWRIGHT_JSON_OUTPUT_FILE: "/tmp/canonical-sot-report.json",
        });
    });

    it("keeps inventory, smoke, and final scopes distinct", () => {
        expect(parseCanonicalSotGateMode([])).toBe("final");
        expect(parseCanonicalSotGateMode(["--list"])).toBe("inventory");
        expect(parseCanonicalSotGateMode(["--smoke"])).toBe("smoke");
        expect(() => parseCanonicalSotGateMode(["--list", "--smoke"])).toThrow(
            /accepts only/,
        );
    });

    it("counts every skip, failure, report error, and UNPROVEN result as machine-readable evidence", () => {
        expect(
            summarizeCanonicalSotJsonReport({
                errors: [{}],
                suites: [
                    {
                        specs: [
                            {
                                tests: [
                                    {
                                        expectedStatus: "passed",
                                        results: [{ status: "passed" }],
                                        status: "expected",
                                    },
                                ],
                                title: "passing required check",
                            },
                            {
                                tests: [
                                    {
                                        annotations: [
                                            {
                                                description:
                                                    "UNPROVEN evidence gap",
                                                type: "skip",
                                            },
                                        ],
                                        expectedStatus: "skipped",
                                        results: [{ status: "skipped" }],
                                        status: "skipped",
                                    },
                                ],
                                title: "UNPROVEN required check",
                            },
                            {
                                tests: [
                                    {
                                        expectedStatus: "passed",
                                        results: [{ status: "failed" }],
                                        status: "unexpected",
                                    },
                                ],
                                title: "failed required check",
                            },
                        ],
                    },
                ],
            }),
        ).toEqual({
            errors: 1,
            failed: 1,
            passed: 1,
            skipped: 1,
            total: 3,
            unproven: 1,
        });
    });
});
