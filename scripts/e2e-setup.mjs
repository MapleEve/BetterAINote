import {
    cpSync,
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required for E2E setup`);
    }

    return value;
}

const cwd = process.cwd();
const markerName = ".betterainote-e2e-root";
const markerContents = "BetterAINote E2E disposable root v1\n";

function resolveCanonicalPath(targetPath) {
    const resolvedPath = path.resolve(targetPath);
    const missingSegments = [];
    let existingAncestor = resolvedPath;

    while (!existsSync(existingAncestor)) {
        const parent = path.dirname(existingAncestor);
        if (parent === existingAncestor) {
            throw new Error(`Unable to resolve E2E path: ${resolvedPath}`);
        }

        missingSegments.unshift(path.basename(existingAncestor));
        existingAncestor = parent;
    }

    return path.join(
        realpathSync.native(existingAncestor),
        ...missingSegments,
    );
}

function isDescendantPath(targetPath, parentPath) {
    const relativePath = path.relative(parentPath, targetPath);
    return (
        relativePath !== "" &&
        relativePath !== ".." &&
        !relativePath.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relativePath)
    );
}

function isSameOrAncestorPath(targetPath, childPath) {
    return targetPath === childPath || isDescendantPath(childPath, targetPath);
}

function resolveDisposableE2eRoot(configuredRoot) {
    const resolvedRoot = resolveCanonicalPath(configuredRoot);
    const worktreeRoot = resolveCanonicalPath(cwd);
    const allowedParents = [
        resolveCanonicalPath(path.join(cwd, "tmp")),
        resolveCanonicalPath(os.tmpdir()),
        ...(process.platform === "darwin"
            ? [resolveCanonicalPath("/private/tmp")]
            : []),
    ];

    if (
        resolvedRoot === path.parse(resolvedRoot).root ||
        isSameOrAncestorPath(resolvedRoot, worktreeRoot)
    ) {
        throw new Error(
            `Refusing unsafe PLAYWRIGHT_E2E_ROOT: ${resolvedRoot}`,
        );
    }

    if (
        !allowedParents.some((allowedParent) =>
            isDescendantPath(resolvedRoot, allowedParent),
        )
    ) {
        throw new Error(
            `PLAYWRIGHT_E2E_ROOT must be below an allowed temporary directory: ${resolvedRoot}`,
        );
    }

    return resolvedRoot;
}

function prepareDisposableE2eRoot(targetRoot) {
    const markerPath = path.join(targetRoot, markerName);

    if (existsSync(targetRoot)) {
        const rootStats = lstatSync(targetRoot);
        if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
            throw new Error(
                `PLAYWRIGHT_E2E_ROOT must be a real directory: ${targetRoot}`,
            );
        }

        if (!existsSync(markerPath)) {
            throw new Error(
                `Refusing to delete unmarked E2E root: ${targetRoot}`,
            );
        }

        const markerStats = lstatSync(markerPath);
        if (
            !markerStats.isFile() ||
            markerStats.isSymbolicLink() ||
            readFileSync(markerPath, "utf8") !== markerContents
        ) {
            throw new Error(`Invalid E2E root marker: ${markerPath}`);
        }
    } else {
        mkdirSync(targetRoot, { recursive: true });
        writeFileSync(markerPath, markerContents, {
            encoding: "utf8",
            flag: "wx",
            mode: 0o600,
        });
    }

    for (const entry of readdirSync(targetRoot)) {
        if (entry === markerName) {
            continue;
        }

        rmSync(path.join(targetRoot, entry), {
            force: true,
            recursive: true,
        });
    }
}

const e2eRoot = resolveDisposableE2eRoot(
    requireEnv("PLAYWRIGHT_E2E_ROOT"),
);
const appDir = requireEnv("PLAYWRIGHT_E2E_APP_DIR");
const dataDir = requireEnv("PLAYWRIGHT_E2E_DATA_DIR");
const storageDir = requireEnv("PLAYWRIGHT_E2E_STORAGE_DIR");
const databasePath = requireEnv("DATABASE_PATH");

prepareDisposableE2eRoot(e2eRoot);
mkdirSync(dataDir, { recursive: true });
mkdirSync(storageDir, { recursive: true });
mkdirSync(appDir, { recursive: true });

function prepareIsolatedAppDir() {
    const entriesToCopy = [
        ".env.test.local",
        ".env.local",
        ".env.development.local",
        "components.json",
        "loader.ts",
        "next-env.d.ts",
        "next.config.ts",
        "package.json",
        "bun.lock",
        "postcss.config.mjs",
        "public",
        "src",
        "tsconfig.json",
    ];

    for (const entry of entriesToCopy) {
        const sourcePath = path.resolve(cwd, entry);
        if (!existsSync(sourcePath)) {
            continue;
        }

        const targetPath = path.resolve(appDir, entry);
        cpSync(sourcePath, targetPath, {
            dereference: true,
            recursive: true,
        });
    }

    symlinkSync(resolveInstalledNodeModulesDir(), path.resolve(appDir, "node_modules"), "dir");
}

function isInstalledNodeModulesDir(candidate) {
    return (
        existsSync(candidate) &&
        existsSync(path.join(candidate, "next", "package.json"))
    );
}

function resolveInstalledNodeModulesDir() {
    const configuredDir = process.env.PLAYWRIGHT_E2E_NODE_MODULES_DIR;
    const candidates = configuredDir
        ? [path.resolve(configuredDir)]
        : [path.join(cwd, "node_modules")];

    if (!configuredDir) {
        const worktreeResult = spawnSync(
            "git",
            ["worktree", "list", "--porcelain"],
            { cwd, encoding: "utf8" },
        );
        if (worktreeResult.status === 0) {
            for (const line of worktreeResult.stdout.split("\n")) {
                if (line.startsWith("worktree ")) {
                    candidates.push(path.join(line.slice("worktree ".length), "node_modules"));
                }
            }
        }
    }

    for (const candidate of candidates) {
        if (isInstalledNodeModulesDir(candidate)) {
            return realpathSync.native(candidate);
        }
    }

    throw new Error(
        "Unable to locate installed node_modules for isolated E2E app; " +
            "set PLAYWRIGHT_E2E_NODE_MODULES_DIR to a compatible installation.",
    );
}

const installedNodeModulesDir = resolveInstalledNodeModulesDir();
const dependencyRequire = createRequire(
    path.join(installedNodeModulesDir, "package.json"),
);
const { createClient } = dependencyRequire("@libsql/client");
const { drizzle } = dependencyRequire("drizzle-orm/libsql");
const { migrate } = dependencyRequire("drizzle-orm/libsql/migrator");

function resolveDatabaseUrl(targetPath) {
    return pathToFileURL(path.resolve(targetPath)).href;
}

function deriveSiblingDatabasePath(targetPath, suffix) {
    const parsed = path.parse(targetPath);
    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-${suffix}${parsed.ext || ".db"}`,
    );
}

async function migrateDatabase(targetPath, migrationsFolder) {
    mkdirSync(path.dirname(targetPath), { recursive: true });

    const client = createClient({ url: resolveDatabaseUrl(targetPath) });
    try {
        await migrate(drizzle(client), { migrationsFolder });
    } finally {
        await client.close();
    }
}

const layout = {
    core: databasePath,
    library: deriveSiblingDatabasePath(databasePath, "library"),
    transcripts: deriveSiblingDatabasePath(databasePath, "transcripts"),
    voiceprints: deriveSiblingDatabasePath(databasePath, "voiceprints"),
    search: deriveSiblingDatabasePath(databasePath, "search"),
};

prepareIsolatedAppDir();

await migrateDatabase(layout.core, path.resolve(cwd, "src/db/migrations/core"));
await migrateDatabase(
    layout.library,
    path.resolve(cwd, "src/db/migrations/library"),
);
await migrateDatabase(
    layout.transcripts,
    path.resolve(cwd, "src/db/migrations/transcripts"),
);
await migrateDatabase(
    layout.voiceprints,
    path.resolve(cwd, "src/db/migrations/voiceprints"),
);
await migrateDatabase(
    layout.search,
    path.resolve(cwd, "src/db/migrations/search"),
);
