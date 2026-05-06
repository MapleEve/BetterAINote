import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function extractConstObject(source: string, constName: string) {
    const start = source.indexOf(`const ${constName} = {`);
    expect(start).toBeGreaterThanOrEqual(0);
    if (start < 0) return "";

    const end = source.indexOf("};", start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
}

describe("preview dashboard performance boundary", () => {
    it("keeps dashboard SSR transcription relation lightweight", () => {
        const source = readFileSync(
            path.join(
                process.cwd(),
                "src/server/modules/recordings/read-model.ts",
            ),
            "utf8",
        );

        const dashboardSelection = extractConstObject(
            source,
            "dashboardTranscriptionSelection",
        );

        expect(dashboardSelection).toContain("hasTranscript");
        expect(dashboardSelection).not.toContain("text:");
        expect(dashboardSelection).not.toContain("providerPayload");
        expect(source).toMatch(
            /listRecordingRelationsForUser\(\s*userId,\s*recordingIds,\s*\{\s*includeTranscript:\s*false,\s*\}\s*\)/,
        );
    });

    it("keeps runtime SQLite path derivation out of Turbopack broad file tracing", () => {
        const pathsSource = readFileSync(
            path.join(process.cwd(), "src/db/paths.ts"),
            "utf8",
        );
        const wordArtifactsSource = readFileSync(
            path.join(process.cwd(), "src/lib/transcription/word-artifacts.ts"),
            "utf8",
        );

        expect(pathsSource).toMatch(
            /path\.join\(\s*\/\* turbopackIgnore: true \*\//,
        );
        expect(pathsSource).toMatch(
            /path\.resolve\(\s*\/\* turbopackIgnore: true \*\//,
        );
        expect(wordArtifactsSource).toContain(
            "path.resolve(/* turbopackIgnore: true */ wordsPath)",
        );
    });
});
