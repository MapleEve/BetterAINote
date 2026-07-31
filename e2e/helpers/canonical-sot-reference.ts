import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CANONICAL_SOT_REFERENCE_ROOT_ENV =
    "BETTERAINOTE_CANONICAL_SOT_REFERENCE_ROOT";
export const CANONICAL_SOT_REPOSITORY_ROOT_ENV =
    "BETTERAINOTE_CANONICAL_SOT_REPOSITORY_ROOT";
const LEGACY_HANDOFF_WEB_INDEX_SEGMENTS = [
    "project",
    "ui_kits",
    "web",
    "index.html",
] as const;
const CANONICAL_SOT_WEB_INDEX_RELATIVE_PATH = "ui_kits/web/index.html";
const CANONICAL_SOT_REQUIRED_RELATIVE_PATHS = [
    "README.md",
    "ui_kits/web/README.md",
    CANONICAL_SOT_WEB_INDEX_RELATIVE_PATH,
    "ui_kits/web/kit.css",
] as const;
const EXPECTED_CANONICAL_SOT_FILE_COUNT = 181;
const EXPECTED_CANONICAL_SOT_MANIFEST_SHA256 =
    "f2875d4af4784b4944d19a51c918b612942f6f9cf374cca119fb9c1416d9508b";
const APPROVED_HANDOFF_PROJECT_REALPATH_SUFFIX = [
    "tmp",
    "betterainote-design-evidence",
    "handoff-20260715-094949",
    "betterainote-design-system",
    "project",
] as const;
const APPROVED_HANDOFF_BUNDLE_REALPATH_SUFFIX =
    APPROVED_HANDOFF_PROJECT_REALPATH_SUFFIX.slice(0, -1);
const APPROVED_HANDOFF_MANIFEST_RELATIVE_PATH = "../../manifest.sha256";
const EXPECTED_HANDOFF_BUNDLE_FILE_COUNT = 182;
const EXPECTED_HANDOFF_MANIFEST_SIDECAR_SHA256 =
    "ce2ace3745e94538deb145268da21cf0015faec90460aa0a2605508360fa82c7";
const DEPRECATED_HANDOFF_SNAPSHOT = {
    fileCount: 182,
    manifestSha256:
        "ce2ace3745e94538deb145268da21cf0015faec90460aa0a2605508360fa82c7",
} as const;

export const CANONICAL_SOT_REFERENCE_PROVENANCE = {
    id: "claude-design-handoff-20260715-094949-project",
    handoff: {
        bundleFileCount: EXPECTED_HANDOFF_BUNDLE_FILE_COUNT,
        manifestSidecarRelativePath: APPROVED_HANDOFF_MANIFEST_RELATIVE_PATH,
        manifestSidecarSha256: EXPECTED_HANDOFF_MANIFEST_SIDECAR_SHA256,
        projectRealpathSuffix: APPROVED_HANDOFF_PROJECT_REALPATH_SUFFIX,
    },
    manifestAlgorithm:
        "sha256 of sorted '<file-sha256>  <project-relative-posix-path>\\n' entries",
    requiredFiles: CANONICAL_SOT_REQUIRED_RELATIVE_PATHS,
    rootKind: "project",
    snapshot: {
        fileCount: EXPECTED_CANONICAL_SOT_FILE_COUNT,
        manifestSha256: EXPECTED_CANONICAL_SOT_MANIFEST_SHA256,
    },
} as const;

export type CanonicalSotReference = {
    root: string;
    webIndexUrl: string;
};

export type CanonicalSotReferenceSnapshot = {
    fileCount: number;
    manifestSha256: string;
};

export type VerifiedCanonicalSotReferenceResolution =
    | {
          available: true;
          reference: CanonicalSotReference;
          snapshot: CanonicalSotReferenceSnapshot;
      }
    | {
          available: false;
          reason: string;
      };

export type VerifiedSotReferenceExpectation = {
    requiredRelativePaths?: readonly string[];
    rootEnvironmentVariable: string;
    snapshot: CanonicalSotReferenceSnapshot;
    subject: string;
    webIndexRelativePath?: string;
};

function isDirectory(target: string) {
    try {
        return statSync(target).isDirectory();
    } catch {
        return false;
    }
}

function isFile(target: string) {
    try {
        return statSync(target).isFile();
    } catch {
        return false;
    }
}

function matchesExpectedSotManifest(
    snapshot: CanonicalSotReferenceSnapshot,
    expectedSnapshot: CanonicalSotReferenceSnapshot,
) {
    return (
        snapshot.fileCount === expectedSnapshot.fileCount &&
        snapshot.manifestSha256 === expectedSnapshot.manifestSha256
    );
}

function hasRealpathSuffix(
    target: string,
    expectedSegments: readonly string[],
) {
    const targetSegments = path
        .normalize(target)
        .split(path.sep)
        .filter(Boolean);
    return expectedSegments.every(
        (segment, index) =>
            targetSegments[
                targetSegments.length - expectedSegments.length + index
            ] === segment,
    );
}

async function resolveRealpath(target: string) {
    try {
        return await realpath(target);
    } catch {
        return undefined;
    }
}

async function hasReadOnlyFilesystemContract(targets: readonly string[]) {
    try {
        const stats = await Promise.all(targets.map((target) => stat(target)));
        return stats.every((entry) => (entry.mode & 0o222) === 0);
    } catch {
        return false;
    }
}

async function resolveApprovedHandoffProjectRealpath() {
    const configuredRepositoryRoot =
        process.env[CANONICAL_SOT_REPOSITORY_ROOT_ENV]?.trim();
    if (
        !configuredRepositoryRoot ||
        !path.isAbsolute(configuredRepositoryRoot)
    ) {
        return undefined;
    }
    const repositoryRoot = await resolveRealpath(configuredRepositoryRoot);
    if (!repositoryRoot || repositoryRoot !== configuredRepositoryRoot) {
        return undefined;
    }
    const topLevelResult = spawnSync(
        "git",
        ["rev-parse", "--path-format=absolute", "--show-toplevel"],
        {
            cwd: repositoryRoot,
            encoding: "utf8",
            stdio: "pipe",
        },
    );
    if (
        topLevelResult.status !== 0 ||
        topLevelResult.error ||
        (await resolveRealpath(topLevelResult.stdout.trim())) !== repositoryRoot
    ) {
        return undefined;
    }
    const result = spawnSync(
        "git",
        ["rev-parse", "--path-format=absolute", "--git-common-dir"],
        {
            cwd: repositoryRoot,
            encoding: "utf8",
            stdio: "pipe",
        },
    );
    if (result.status !== 0 || result.error) {
        return undefined;
    }

    const commonRepositoryRoot = path.dirname(result.stdout.trim());
    return resolveRealpath(
        path.join(
            commonRepositoryRoot,
            ...APPROVED_HANDOFF_PROJECT_REALPATH_SUFFIX,
        ),
    );
}

async function verifyApprovedCanonicalHandoffProvenance(root: string) {
    const configuredPath = path.resolve(root);
    const projectRealpath = await resolveRealpath(configuredPath);
    const approvedProjectRealpath =
        await resolveApprovedHandoffProjectRealpath();
    if (
        !projectRealpath ||
        !approvedProjectRealpath ||
        projectRealpath !== configuredPath ||
        projectRealpath !== approvedProjectRealpath ||
        !hasRealpathSuffix(
            projectRealpath,
            APPROVED_HANDOFF_PROJECT_REALPATH_SUFFIX,
        )
    ) {
        return `${CANONICAL_SOT_REFERENCE_ROOT_ENV} does not name the approved 20260715 handoff project realpath`;
    }

    const bundleRoot = path.dirname(projectRealpath);
    const handoffRoot = path.dirname(bundleRoot);
    const manifestPath = path.join(handoffRoot, "manifest.sha256");
    const manifestRealpath = await resolveRealpath(manifestPath);
    if (
        manifestRealpath !== manifestPath ||
        !(await hasReadOnlyFilesystemContract([
            handoffRoot,
            bundleRoot,
            projectRealpath,
            manifestPath,
        ]))
    ) {
        return `${CANONICAL_SOT_REFERENCE_ROOT_ENV} does not have the pinned read-only 20260715 handoff contract`;
    }

    try {
        const manifest = await readFile(manifestPath);
        const manifestLines = manifest.toString("utf8").trimEnd().split("\n");
        if (
            sha256(manifest) !== EXPECTED_HANDOFF_MANIFEST_SIDECAR_SHA256 ||
            manifestLines.length !== EXPECTED_HANDOFF_BUNDLE_FILE_COUNT ||
            !manifestLines.every((line) =>
                /^[a-f0-9]{64} {2}(?:README\.md|project\/.+)$/.test(line),
            )
        ) {
            return `${CANONICAL_SOT_REFERENCE_ROOT_ENV} does not match the pinned 20260715 handoff manifest sidecar`;
        }
    } catch {
        return `${CANONICAL_SOT_REFERENCE_ROOT_ENV} handoff manifest sidecar could not be read`;
    }

    return undefined;
}

function unprovenCanonicalSotReference(
    reason: string,
): VerifiedCanonicalSotReferenceResolution {
    return {
        available: false,
        reason: `UNPROVEN: canonical audit skipped because ${reason}.`,
    };
}

function resolveProjectRelativePath(root: string, relativePath: string) {
    const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));
    if (
        path.posix.isAbsolute(normalized) ||
        normalized === ".." ||
        normalized.startsWith("../")
    ) {
        throw new Error(
            `Canonical SOT required path must stay inside its configured root: ${relativePath}`,
        );
    }

    return path.join(root, ...normalized.split("/"));
}

export async function resolveVerifiedSotReference(
    expectation: VerifiedSotReferenceExpectation,
): Promise<VerifiedCanonicalSotReferenceResolution> {
    const configuredRoot =
        process.env[expectation.rootEnvironmentVariable]?.trim();

    if (!configuredRoot) {
        return unprovenCanonicalSotReference(
            `${expectation.rootEnvironmentVariable} is not set`,
        );
    }

    const root = path.resolve(process.cwd(), configuredRoot);
    const webIndexRelativePath =
        expectation.webIndexRelativePath ??
        LEGACY_HANDOFF_WEB_INDEX_SEGMENTS.join("/");
    const requiredRelativePaths = expectation.requiredRelativePaths ?? [
        webIndexRelativePath,
    ];
    let webIndexPath: string;
    let requiredPaths: string[];

    try {
        webIndexPath = resolveProjectRelativePath(root, webIndexRelativePath);
        requiredPaths = requiredRelativePaths.map((relativePath) =>
            resolveProjectRelativePath(root, relativePath),
        );
    } catch {
        return unprovenCanonicalSotReference(
            `${expectation.rootEnvironmentVariable} contains an invalid required path contract`,
        );
    }

    if (
        !isDirectory(root) ||
        !isFile(webIndexPath) ||
        requiredPaths.some((requiredPath) => !isFile(requiredPath))
    ) {
        const rootSubject = expectation.requiredRelativePaths
            ? expectation.subject
            : "handoff";
        return unprovenCanonicalSotReference(
            `${expectation.rootEnvironmentVariable} does not resolve to a readable ${rootSubject} root`,
        );
    }

    const reference: CanonicalSotReference = {
        root,
        webIndexUrl: pathToFileURL(webIndexPath).href,
    };

    try {
        const snapshot = await snapshotCanonicalSotReference(reference);
        if (!matchesExpectedSotManifest(snapshot, expectation.snapshot)) {
            return unprovenCanonicalSotReference(
                `${expectation.rootEnvironmentVariable} does not match the verified ${expectation.snapshot.fileCount}-file ${expectation.subject} manifest`,
            );
        }

        return {
            available: true,
            reference,
            snapshot,
        };
    } catch {
        return unprovenCanonicalSotReference(
            `${expectation.rootEnvironmentVariable} could not be read`,
        );
    }
}

export async function resolveVerifiedCanonicalSotReference(): Promise<VerifiedCanonicalSotReferenceResolution> {
    const configuredRoot =
        process.env[CANONICAL_SOT_REFERENCE_ROOT_ENV]?.trim();
    if (configuredRoot) {
        const root = path.resolve(process.cwd(), configuredRoot);
        const configuredRealpath = await resolveRealpath(root);
        if (
            configuredRealpath &&
            hasRealpathSuffix(
                configuredRealpath,
                APPROVED_HANDOFF_BUNDLE_REALPATH_SUFFIX,
            )
        ) {
            return unprovenCanonicalSotReference(
                `${CANONICAL_SOT_REFERENCE_ROOT_ENV} names the approved 20260715 handoff bundle root; provide its project directory`,
            );
        }
        const deprecatedWebIndexPath = path.join(
            root,
            ...LEGACY_HANDOFF_WEB_INDEX_SEGMENTS,
        );
        if (isDirectory(root) && isFile(deprecatedWebIndexPath)) {
            const deprecatedReference = {
                root,
                webIndexUrl: pathToFileURL(deprecatedWebIndexPath).href,
            };
            try {
                const deprecatedSnapshot =
                    await snapshotCanonicalSotReference(deprecatedReference);
                if (
                    matchesExpectedSotManifest(
                        deprecatedSnapshot,
                        DEPRECATED_HANDOFF_SNAPSHOT,
                    )
                ) {
                    return unprovenCanonicalSotReference(
                        `${CANONICAL_SOT_REFERENCE_ROOT_ENV} names the deprecated 182-file handoff root; provide its project directory`,
                    );
                }
            } catch {
                return unprovenCanonicalSotReference(
                    `${CANONICAL_SOT_REFERENCE_ROOT_ENV} could not be read`,
                );
            }

            return unprovenCanonicalSotReference(
                `${CANONICAL_SOT_REFERENCE_ROOT_ENV} does not match the verified 182-file handoff manifest`,
            );
        }

        const provenanceFailure =
            await verifyApprovedCanonicalHandoffProvenance(root);
        if (provenanceFailure) {
            return unprovenCanonicalSotReference(provenanceFailure);
        }
    }

    return resolveVerifiedSotReference({
        requiredRelativePaths: CANONICAL_SOT_REQUIRED_RELATIVE_PATHS,
        rootEnvironmentVariable: CANONICAL_SOT_REFERENCE_ROOT_ENV,
        snapshot: CANONICAL_SOT_REFERENCE_PROVENANCE.snapshot,
        subject: "canonical SOT project",
        webIndexRelativePath: CANONICAL_SOT_WEB_INDEX_RELATIVE_PATH,
    });
}

function sha256(value: string | Buffer) {
    return createHash("sha256").update(value).digest("hex");
}

async function collectFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries.sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectFiles(target)));
            continue;
        }
        if (entry.isFile()) {
            files.push(target);
            continue;
        }
        throw new Error(`Unsupported canonical SOT reference entry: ${target}`);
    }

    return files;
}

export async function snapshotCanonicalSotReference(
    reference: CanonicalSotReference,
): Promise<CanonicalSotReferenceSnapshot> {
    const files = await collectFiles(reference.root);
    const manifest = await Promise.all(
        files.map(async (filePath) => {
            const relativePath = path
                .relative(reference.root, filePath)
                .split(path.sep)
                .join("/");
            return `${sha256(await readFile(filePath))}  ${relativePath}\n`;
        }),
    );

    return {
        fileCount: files.length,
        manifestSha256: sha256(manifest.join("")),
    };
}

export function assertCanonicalSotReferenceMatchesRecovery(
    snapshot: CanonicalSotReferenceSnapshot,
) {
    if (
        matchesExpectedSotManifest(snapshot, {
            fileCount: EXPECTED_CANONICAL_SOT_FILE_COUNT,
            manifestSha256: EXPECTED_CANONICAL_SOT_MANIFEST_SHA256,
        })
    ) {
        return;
    }

    throw new Error(
        "Canonical SOT project hash mismatch: " +
            `expected ${EXPECTED_CANONICAL_SOT_FILE_COUNT} files / ` +
            `${EXPECTED_CANONICAL_SOT_MANIFEST_SHA256}, received ` +
            `${snapshot.fileCount} files / ${snapshot.manifestSha256}`,
    );
}

export function assertCanonicalSotReferenceUnchanged(
    before: CanonicalSotReferenceSnapshot,
    after: CanonicalSotReferenceSnapshot,
) {
    if (
        before.fileCount !== after.fileCount ||
        before.manifestSha256 !== after.manifestSha256
    ) {
        throw new Error(
            "Canonical SOT project changed during this E2E spec: " +
                `before ${before.fileCount} files / ${before.manifestSha256}, ` +
                `after ${after.fileCount} files / ${after.manifestSha256}`,
        );
    }
}
