import { spawnSync } from "node:child_process";
import {
    accessSync,
    constants,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    statSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
    assertCanonicalSotReferenceMatchesRecovery,
    CANONICAL_SOT_REFERENCE_PROVENANCE,
    CANONICAL_SOT_REFERENCE_ROOT_ENV,
    CANONICAL_SOT_REPOSITORY_ROOT_ENV,
    resolveVerifiedCanonicalSotReference,
} from "../e2e/helpers/canonical-sot-reference";

const SYSTEM_CHROME_ENV = "PLAYWRIGHT_USE_SYSTEM_CHROME";
const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const CANONICAL_SOT_SPECS = [
    "e2e/dashboard-source-filter-stack.spec.ts",
    "e2e/source-report-backend-matrix.spec.ts",
] as const;
const SMOKE_TEST_TITLE =
    "source report backend-connected matrix drives detail and dashboard readback";

type CanonicalSotGateMode = "final" | "inventory" | "smoke";

type JsonReportTest = {
    annotations?: Array<{ description?: string; type?: string }>;
    expectedStatus?: string;
    results?: Array<{
        annotations?: Array<{ description?: string; type?: string }>;
        status?: string;
    }>;
    status?: string;
};

type JsonReportSpec = {
    tests?: JsonReportTest[];
    title?: string;
};

type JsonReportSuite = {
    specs?: JsonReportSpec[];
    suites?: JsonReportSuite[];
};

type JsonReport = {
    errors?: unknown[];
    suites?: JsonReportSuite[];
};

export type CanonicalSotGateSummary = {
    errors: number;
    failed: number;
    passed: number;
    skipped: number;
    total: number;
    unproven: number;
};

function fail(message: string, exitCode = 2): never {
    console.error(`[canonical-sot-gate] FAIL: ${message}`);
    process.exit(exitCode);
}

export function parseCanonicalSotGateMode(
    arguments_: string[],
): CanonicalSotGateMode {
    if (arguments_.length === 0) {
        return "final";
    }
    if (arguments_.length === 1 && arguments_[0] === "--list") {
        return "inventory";
    }
    if (arguments_.length === 1 && arguments_[0] === "--smoke") {
        return "smoke";
    }

    throw new Error(
        "the runner accepts only the optional --list or --smoke flag",
    );
}

function collectJsonReportSpecs(
    suites: JsonReportSuite[] = [],
): JsonReportSpec[] {
    return suites.flatMap((suite) => [
        ...(suite.specs ?? []),
        ...collectJsonReportSpecs(suite.suites),
    ]);
}

function includesUnproven(value: string | undefined) {
    return value?.toUpperCase().includes("UNPROVEN") ?? false;
}

export function summarizeCanonicalSotJsonReport(
    report: JsonReport,
): CanonicalSotGateSummary {
    const summary: CanonicalSotGateSummary = {
        errors: report.errors?.length ?? 0,
        failed: 0,
        passed: 0,
        skipped: 0,
        total: 0,
        unproven: 0,
    };

    for (const spec of collectJsonReportSpecs(report.suites)) {
        for (const test of spec.tests ?? []) {
            summary.total += 1;
            const annotations = [
                ...(test.annotations ?? []),
                ...(test.results ?? []).flatMap(
                    (result) => result.annotations ?? [],
                ),
            ];
            const unproven =
                includesUnproven(spec.title) ||
                annotations.some((annotation) =>
                    includesUnproven(annotation.description),
                );
            const skipped =
                test.status === "skipped" ||
                test.expectedStatus === "skipped" ||
                (test.results ?? []).some(
                    (result) => result.status === "skipped",
                );
            const failed =
                test.status === "unexpected" ||
                (test.results ?? []).some((result) =>
                    ["failed", "interrupted", "timedOut"].includes(
                        result.status ?? "",
                    ),
                );

            summary.unproven += Number(unproven);
            summary.skipped += Number(skipped);
            summary.failed += Number(failed);
            summary.passed += Number(!unproven && !skipped && !failed);
        }
    }

    return summary;
}

function canExecute(target: string) {
    try {
        accessSync(target, constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function canonicalRealpath(target: string) {
    try {
        return realpathSync(target);
    } catch {
        return path.resolve(target);
    }
}

function pathExecutables(name: string) {
    const executableNames =
        process.platform === "win32" ? [`${name}.exe`, name] : [name];
    return (process.env.PATH ?? "")
        .split(path.delimiter)
        .filter(Boolean)
        .flatMap((directory) =>
            executableNames.map((executableName) =>
                path.join(directory, executableName),
            ),
        );
}

function executableVersion(target: string) {
    const result = spawnSync(target, ["--version"], {
        cwd: REPOSITORY_ROOT,
        encoding: "utf8",
        stdio: "pipe",
    });
    if (result.status !== 0 || result.error) {
        return undefined;
    }
    return `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
}

function resolveHealthyBun() {
    const candidates = [
        process.versions.bun ? process.execPath : undefined,
        process.env.BUN_INSTALL
            ? path.join(process.env.BUN_INSTALL, "bin", "bun")
            : undefined,
        path.join(homedir(), ".bun", "bin", "bun"),
        ...pathExecutables("bun"),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
        const resolved = canonicalRealpath(candidate);
        if (
            resolved.startsWith(
                `${path.sep}opt${path.sep}homebrew${path.sep}`,
            ) ||
            !canExecute(resolved)
        ) {
            continue;
        }
        const version = executableVersion(resolved);
        if (/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(version ?? "")) {
            return { executable: resolved, version };
        }
    }

    fail("a healthy non-wrapper Bun executable could not be resolved");
}

function resolveNode() {
    for (const candidate of pathExecutables("node")) {
        const resolved = canonicalRealpath(candidate);
        if (!canExecute(resolved)) {
            continue;
        }
        const version = executableVersion(resolved);
        if (/^v\d+\.\d+\.\d+(?:[-+].+)?$/.test(version ?? "")) {
            return { executable: resolved, version };
        }
    }

    fail("Node.js could not be resolved from PATH");
}

function resolveSystemChromeVersion() {
    const candidates =
        process.platform === "darwin"
            ? [
                  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                  path.join(
                      homedir(),
                      "Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                  ),
              ]
            : process.platform === "win32"
              ? [
                    process.env.PROGRAMFILES
                        ? path.join(
                              process.env.PROGRAMFILES,
                              "Google/Chrome/Application/chrome.exe",
                          )
                        : "",
                    process.env.LOCALAPPDATA
                        ? path.join(
                              process.env.LOCALAPPDATA,
                              "Google/Chrome/Application/chrome.exe",
                          )
                        : "",
                ]
              : [
                    ...pathExecutables("google-chrome-stable"),
                    ...pathExecutables("google-chrome"),
                ];

    for (const candidate of candidates.filter(Boolean)) {
        if (!canExecute(candidate)) {
            continue;
        }
        const versionOutput = executableVersion(candidate);
        const version = versionOutput?.match(/\d+\.\d+\.\d+\.\d+/)?.[0];
        if (version) {
            return version;
        }
    }

    fail("system Google Chrome version could not be resolved");
}

function runGit(arguments_: string[]) {
    const result = spawnSync("git", arguments_, {
        cwd: REPOSITORY_ROOT,
        encoding: "utf8",
        stdio: "pipe",
    });
    if (result.status !== 0 || result.error) {
        fail("repository identity could not be read");
    }
    return result.stdout.trim();
}

export function isCanonicalSotDependencyEntrypoint(
    nodeModulesRoot: string,
    entrypoint: string,
) {
    const relativePath = path.relative(
        canonicalRealpath(nodeModulesRoot),
        canonicalRealpath(entrypoint),
    );
    return (
        relativePath === "" ||
        (relativePath !== ".." &&
            !relativePath.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relativePath))
    );
}

function resolveDependencyEntrypoint(specifier: string, roots: string[]) {
    for (const root of roots) {
        const nodeModulesRoot = path.join(root, "node_modules");
        try {
            if (!statSync(nodeModulesRoot).isDirectory()) {
                continue;
            }
        } catch {
            continue;
        }

        try {
            const entrypoint = createRequire(
                path.join(root, "package.json"),
            ).resolve(
                specifier,
            );
            if (
                isCanonicalSotDependencyEntrypoint(
                    nodeModulesRoot,
                    entrypoint,
                )
            ) {
                return entrypoint;
            }
        } catch {
            // Continue to the checked-out repository's shared dependency root.
        }
    }
    fail(`required dependency entrypoint is unavailable: ${specifier}`);
}

function resolveRuntimeDependencies() {
    const commonGitDirectory = runGit([
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
    ]);
    const commonRepositoryRoot = path.dirname(commonGitDirectory);
    const roots = Array.from(new Set([REPOSITORY_ROOT, commonRepositoryRoot]));
    const playwrightCli = resolveDependencyEntrypoint(
        "@playwright/test/cli",
        roots,
    );
    const playwrightPackage = resolveDependencyEntrypoint(
        "@playwright/test/package.json",
        roots,
    );
    const nextPackage = resolveDependencyEntrypoint("next/package.json", roots);
    const nextCli = resolveDependencyEntrypoint("next/dist/bin/next", roots);
    const playwrightVersion = (
        JSON.parse(readFileSync(playwrightPackage, "utf8")) as {
            version?: string;
        }
    ).version;
    const nextVersion = (
        JSON.parse(readFileSync(nextPackage, "utf8")) as { version?: string }
    ).version;
    if (!nextVersion || !playwrightVersion) {
        fail("the exact Playwright and Next.js versions could not be read");
    }

    return {
        commonNodeModules: path.join(commonRepositoryRoot, "node_modules"),
        nextCli,
        nextVersion,
        playwrightCli,
        playwrightVersion,
    };
}

function reportHasBlockingOutcome(summary: CanonicalSotGateSummary) {
    return (
        summary.errors > 0 ||
        summary.failed > 0 ||
        summary.skipped > 0 ||
        summary.unproven > 0
    );
}

function buildPlaywrightArguments(mode: CanonicalSotGateMode) {
    const arguments_: string[] = [
        "test",
        ...CANONICAL_SOT_SPECS,
        "--project=system-chrome",
        "--reporter=json",
    ];
    if (mode === "inventory") {
        arguments_.push("--list");
    }
    if (mode === "smoke") {
        arguments_.push("--grep", SMOKE_TEST_TITLE);
    }
    return arguments_;
}

type CanonicalSotPlaywrightChildProcessPlanInput = {
    bunExecutable: string;
    commonNodeModules: string;
    environment: NodeJS.ProcessEnv;
    mode: CanonicalSotGateMode;
    nextCli: string;
    nodeExecutable: string;
    playwrightCli: string;
    repositoryRoot: string;
    reportPath: string;
};

export function buildCanonicalSotPlaywrightChildProcessPlan({
    bunExecutable,
    commonNodeModules,
    environment,
    mode,
    nextCli,
    nodeExecutable,
    playwrightCli,
    repositoryRoot,
    reportPath,
}: CanonicalSotPlaywrightChildProcessPlanInput) {
    const childPath = Array.from(
        new Set([
            path.dirname(bunExecutable),
            path.dirname(nodeExecutable),
            path.join(commonNodeModules, ".bin"),
            ...(environment.PATH ?? "").split(path.delimiter),
        ]),
    )
        .filter(Boolean)
        .join(path.delimiter);
    const childNodePath = Array.from(
        new Set([
            commonNodeModules,
            ...(environment.NODE_PATH ?? "").split(path.delimiter),
        ]),
    )
        .filter(Boolean)
        .join(path.delimiter);

    return {
        arguments: [playwrightCli, ...buildPlaywrightArguments(mode)],
        executable: nodeExecutable,
        options: {
            cwd: REPOSITORY_ROOT,
            encoding: "utf8" as const,
            env: {
                ...environment,
                BETTERAINOTE_E2E_BUN_EXECUTABLE: bunExecutable,
                BETTERAINOTE_E2E_NEXT_CLI: nextCli,
                BETTERAINOTE_E2E_NODE_EXECUTABLE: nodeExecutable,
                [CANONICAL_SOT_REPOSITORY_ROOT_ENV]: repositoryRoot,
                NODE_PATH: childNodePath,
                PATH: childPath,
                PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath,
            },
            maxBuffer: 32 * 1024 * 1024,
            stdio: "pipe" as const,
        },
    };
}

async function main() {
    let mode: CanonicalSotGateMode;
    try {
        mode = parseCanonicalSotGateMode(process.argv.slice(2));
    } catch (error) {
        fail(error instanceof Error ? error.message : "invalid arguments");
    }

    const configuredRoot =
        process.env[CANONICAL_SOT_REFERENCE_ROOT_ENV]?.trim();
    if (!configuredRoot) {
        fail(
            `${CANONICAL_SOT_REFERENCE_ROOT_ENV} must explicitly name the project root`,
        );
    }
    if (!path.isAbsolute(configuredRoot)) {
        fail(
            `${CANONICAL_SOT_REFERENCE_ROOT_ENV} must be an absolute project-root path`,
        );
    }
    if (process.env[SYSTEM_CHROME_ENV] !== "1") {
        fail(
            `${SYSTEM_CHROME_ENV}=1 is required; bundled Chromium is not accepted`,
        );
    }

    process.env[CANONICAL_SOT_REPOSITORY_ROOT_ENV] = REPOSITORY_ROOT;
    const resolution = await resolveVerifiedCanonicalSotReference();
    if (resolution.available === false) {
        fail(resolution.reason);
    }
    assertCanonicalSotReferenceMatchesRecovery(resolution.snapshot);

    const bun = resolveHealthyBun();
    const node = resolveNode();
    const dependencies = resolveRuntimeDependencies();
    const chromeVersion = resolveSystemChromeVersion();
    const gitSha = runGit(["rev-parse", "HEAD"]);
    const gitDirty =
        runGit(["status", "--porcelain", "--untracked-files=no"]).length > 0;

    console.log(
        JSON.stringify({
            browser: {
                channel: "chrome",
                identity: "system Google Chrome",
                version: chromeVersion,
            },
            gate: "canonical-sot",
            git: { dirty: gitDirty, sha: gitSha },
            mode,
            provenance: CANONICAL_SOT_REFERENCE_PROVENANCE,
            runtime: {
                bun: bun.version,
                next: dependencies.nextVersion,
                node: node.version,
                platform: process.platform,
                playwright: dependencies.playwrightVersion,
                playwrightHost: {
                    executable: node.executable,
                    runtime: "node",
                    version: node.version,
                },
            },
            status: "VERIFIED_INPUT",
        }),
    );

    const reportDirectory = mkdtempSync(
        path.join(tmpdir(), "betterainote-canonical-sot-report-"),
    );
    const reportPath = path.join(reportDirectory, "report.json");
    let result: ReturnType<typeof spawnSync> | undefined;
    let report: JsonReport | undefined;
    let reportFailure: string | undefined;

    try {
        const childProcessPlan =
            buildCanonicalSotPlaywrightChildProcessPlan({
                bunExecutable: bun.executable,
                commonNodeModules: dependencies.commonNodeModules,
                environment: process.env,
                mode,
                nextCli: dependencies.nextCli,
                nodeExecutable: node.executable,
                playwrightCli: dependencies.playwrightCli,
                repositoryRoot: REPOSITORY_ROOT,
                reportPath,
            });
        result = spawnSync(
            childProcessPlan.executable,
            childProcessPlan.arguments,
            childProcessPlan.options,
        );
        if (result.error || result.signal) {
            reportFailure =
                "Playwright terminated before producing a machine report";
        } else {
            try {
                report = JSON.parse(
                    readFileSync(reportPath, "utf8"),
                ) as JsonReport;
            } catch {
                reportFailure =
                    "Playwright did not produce a readable machine report";
            }
        }
    } finally {
        rmSync(reportDirectory, { force: true, recursive: true });
    }

    if (reportFailure || !result || !report) {
        fail(reportFailure ?? "Playwright machine reporting failed");
    }

    const summary = summarizeCanonicalSotJsonReport(report);
    if (mode === "inventory") {
        const listed =
            result.status === 0 && summary.errors === 0 && summary.total > 0;
        console.log(
            JSON.stringify({
                gate: "canonical-sot",
                mode: "INVENTORY",
                status: listed ? "LISTED" : "FAIL",
                summary,
            }),
        );
        if (!listed) {
            process.exit(1);
        }
        return;
    }

    const emptyRequiredInventory = summary.total === 0;
    const wrongSmokeInventory = mode === "smoke" && summary.total !== 1;
    const blockingOutcome =
        result.status !== 0 ||
        emptyRequiredInventory ||
        wrongSmokeInventory ||
        reportHasBlockingOutcome(summary);
    const scope = mode === "smoke" ? "SMOKE" : "FINAL";
    console.log(
        JSON.stringify({
            blockers: [
                ...(summary.failed > 0 ? ["FAILED"] : []),
                ...(summary.skipped > 0 ? ["SKIPPED"] : []),
                ...(summary.unproven > 0 ? ["UNPROVEN"] : []),
                ...(summary.errors > 0 ? ["REPORT_ERROR"] : []),
                ...(emptyRequiredInventory ? ["REQUIRED_INVENTORY_EMPTY"] : []),
                ...(wrongSmokeInventory ? ["SMOKE_INVENTORY_MISMATCH"] : []),
                ...(result.status !== 0 && summary.failed === 0
                    ? ["PLAYWRIGHT_EXIT_NONZERO"]
                    : []),
            ],
            gate: "canonical-sot",
            scope,
            status: blockingOutcome ? "FAIL" : "PASS",
            summary,
        }),
    );
    console.log(
        `[canonical-sot-gate] ${scope} ${blockingOutcome ? "FAIL" : "PASS"}`,
    );
    if (blockingOutcome) {
        process.exit(1);
    }
}

const invokedScript = process.argv[1]
    ? pathToFileURL(path.resolve(process.argv[1])).href
    : undefined;
if (invokedScript === import.meta.url) {
    await main();
}
