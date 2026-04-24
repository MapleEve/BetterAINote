import path from "node:path";
import { pathToFileURL } from "node:url";

const REMOTE_DATABASE_PROTOCOL = /^(libsql:|https?:)/;

export interface DatabaseLayout {
    core: string;
    library: string;
    transcripts: string;
    voiceprints: string;
}

function ensureLocalDatabasePath(databasePath: string) {
    if (REMOTE_DATABASE_PROTOCOL.test(databasePath)) {
        throw new Error(
            "BetterAINote multi-database mode only supports local SQLite file paths",
        );
    }
}

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    ensureLocalDatabasePath(databasePath);

    if (databasePath.startsWith("file:")) {
        const url = new URL(databasePath);
        const parsed = path.parse(url.pathname);
        return pathToFileURL(
            path.join(
                parsed.dir,
                `${parsed.name || "betterainote"}-${suffix}${parsed.ext || ".db"}`,
            ),
        ).href;
    }

    const parsed = path.parse(databasePath);
    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-${suffix}${parsed.ext || ".db"}`,
    );
}

export function resolveDatabaseUrl(databasePath: string) {
    if (/^(file:|libsql:|https?:)/.test(databasePath)) {
        return databasePath;
    }

    return pathToFileURL(path.resolve(databasePath)).href;
}

export function getDatabaseLayout(databasePath: string): DatabaseLayout {
    return {
        core: databasePath,
        library: deriveSiblingDatabasePath(databasePath, "library"),
        transcripts: deriveSiblingDatabasePath(databasePath, "transcripts"),
        voiceprints: deriveSiblingDatabasePath(databasePath, "voiceprints"),
    };
}
