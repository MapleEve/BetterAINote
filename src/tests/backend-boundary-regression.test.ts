import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
    return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function collectTypeScriptFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return collectTypeScriptFiles(fullPath);
        }

        return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
    });
}

describe("backend boundary regression", () => {
    it.each([
        "src/lib/sync/sync-recordings.ts",
        "src/lib/sync/worker-state.ts",
        "src/lib/sync/worker.ts",
        "src/lib/transcription/jobs.ts",
        "src/lib/transcription/transcribe-recording.ts",
        "src/lib/speakers.ts",
        "src/lib/ai/generate-title.ts",
        "src/lib/settings/user-settings.ts",
        "src/lib/api-credentials/store.ts",
        "src/lib/api-credentials/default-transcription.ts",
        "src/lib/api-credentials/private-transcription.ts",
        "src/lib/api-credentials/title-generation.ts",
        "src/lib/voice-transcribe/credentials.ts",
        "src/lib/voice-transcribe/service.ts",
        "src/lib/transcription/word-artifacts.ts",
        "src/lib/registration.ts",
    ])("%s stays a compatibility facade instead of a database module", (file) => {
        const source = readProjectFile(file);

        expect(source).not.toMatch(/from\s+["']@\/db/);
        expect(source).not.toMatch(/from\s+["']drizzle-orm/);
        expect(source).not.toMatch(/from\s+["']@\/db\/schema/);
        expect(source).toContain("@/server/modules/");
    });

    it("keeps every src/lib re-export to server modules declarative", () => {
        const offenders = collectTypeScriptFiles(
            path.join(process.cwd(), "src/lib"),
        )
            .map((filePath) => ({
                filePath,
                source: readFileSync(filePath, "utf8"),
            }))
            .filter(({ source }) => source.includes("@/server/modules/"))
            .filter(({ source }) =>
                /\b(async|function|const|let|class|return|await|if|for|while|switch|try|catch)\b/.test(
                    source,
                ),
            )
            .map(({ filePath }) => path.relative(process.cwd(), filePath));

        expect(offenders).toEqual([]);
    });
});
