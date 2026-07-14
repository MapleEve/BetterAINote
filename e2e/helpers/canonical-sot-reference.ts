import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const CANONICAL_SOT_REFERENCE_ROOT_ENV =
    "BETTERAINOTE_CANONICAL_SOT_REFERENCE_ROOT";
const CANONICAL_SOT_WEB_INDEX_SEGMENTS = [
    "project",
    "ui_kits",
    "web",
    "index.html",
] as const;
const EXPECTED_CANONICAL_SOT_REFERENCE_ROOT =
    "/Users/maplec5/Documents/GitHub/BetterAINote/tmp/betterainote-design-evidence/handoff-20260531/betterainote-design-system";
const EXPECTED_CANONICAL_SOT_FILE_COUNT = 182;
const EXPECTED_CANONICAL_SOT_MANIFEST_SHA256 =
    "8bce272cae609e5db96f338f1a60f211c3dc2ec725d1a17d38ed2ba3137d3a16";

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

function matchesVerifiedCanonicalSotManifest(
    snapshot: CanonicalSotReferenceSnapshot,
) {
    return (
        snapshot.fileCount === EXPECTED_CANONICAL_SOT_FILE_COUNT &&
        snapshot.manifestSha256 === EXPECTED_CANONICAL_SOT_MANIFEST_SHA256
    );
}

function unprovenCanonicalSotReference(
    reason: string,
): VerifiedCanonicalSotReferenceResolution {
    return {
        available: false,
        reason: `UNPROVEN: canonical audit skipped because ${reason}.`,
    };
}

export async function resolveVerifiedCanonicalSotReference(): Promise<VerifiedCanonicalSotReferenceResolution> {
    const configuredRoot = process.env[
        CANONICAL_SOT_REFERENCE_ROOT_ENV
    ]?.trim();

    if (!configuredRoot) {
        return unprovenCanonicalSotReference(
            `${CANONICAL_SOT_REFERENCE_ROOT_ENV} is not set`,
        );
    }

    const root = path.resolve(process.cwd(), configuredRoot);
    if (root !== EXPECTED_CANONICAL_SOT_REFERENCE_ROOT) {
        return unprovenCanonicalSotReference(
            `${CANONICAL_SOT_REFERENCE_ROOT_ENV} must resolve to the required canonical handoff root`,
        );
    }

    const webIndexPath = path.join(root, ...CANONICAL_SOT_WEB_INDEX_SEGMENTS);

    if (!isDirectory(root) || !isFile(webIndexPath)) {
        return unprovenCanonicalSotReference(
            `${CANONICAL_SOT_REFERENCE_ROOT_ENV} does not resolve to a readable handoff root`,
        );
    }

    const reference: CanonicalSotReference = {
        root,
        webIndexUrl: pathToFileURL(webIndexPath).href,
    };

    try {
        const snapshot = await snapshotCanonicalSotReference(reference);
        if (!matchesVerifiedCanonicalSotManifest(snapshot)) {
            return unprovenCanonicalSotReference(
                `${CANONICAL_SOT_REFERENCE_ROOT_ENV} does not match the verified 182-file handoff manifest`,
            );
        }

        return {
            available: true,
            reference,
            snapshot,
        };
    } catch {
        return unprovenCanonicalSotReference(
            `${CANONICAL_SOT_REFERENCE_ROOT_ENV} could not be read`,
        );
    }
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
            return `${relativePath}\0${sha256(await readFile(filePath))}\n`;
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
    if (matchesVerifiedCanonicalSotManifest(snapshot)) {
        return;
    }

    throw new Error(
        "Canonical SOT handoff hash mismatch: " +
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
            "Canonical SOT handoff changed during this E2E spec: " +
                `before ${before.fileCount} files / ${before.manifestSha256}, ` +
                `after ${after.fileCount} files / ${after.manifestSha256}`,
        );
    }
}
