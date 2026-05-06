import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function readProjectFile(filePath: string) {
    return readFileSync(path.join(ROOT, filePath), "utf8");
}

describe("CI service integrations", () => {
    it("generates coverage and uploads it to Codecov from the test workflow", () => {
        const packageJson = JSON.parse(readProjectFile("package.json")) as {
            scripts?: Record<string, string>;
        };
        const ciWorkflow = readProjectFile(".github/workflows/ci.yml");

        expect(packageJson.scripts?.["test:coverage"]).toBe(
            "vitest run --coverage --reporter=default --reporter=junit --outputFile.junit=junit.xml",
        );
        expect(ciWorkflow).toContain("bun run test:coverage");
        expect(ciWorkflow).toContain("codecov/codecov-action@v5");
        expect(ciWorkflow).toContain("coverage/lcov.info");
        expect(ciWorkflow).toContain("junit.xml");
        expect(ciWorkflow).toContain("report_type: test_results");

        const codecovConfig = readProjectFile("codecov.yml");
        expect(codecovConfig).toContain("target: 70%");
        expect(codecovConfig).toContain("target: 60%");
        expect(codecovConfig).toContain('"src/tests/**"');
    });

    it("keeps FOSSA as a secret-backed workflow instead of hardcoding tokens", () => {
        const fossaWorkflowPath = ".github/workflows/fossa.yml";

        expect(existsSync(path.join(ROOT, fossaWorkflowPath))).toBe(true);

        const fossaWorkflow = readProjectFile(fossaWorkflowPath);
        expect(fossaWorkflow).toContain("fossas/fossa-action@v1.9.0");
        expect(fossaWorkflow).toContain("secrets.FOSSA_API_KEY");
        expect(fossaWorkflow).toContain("pinned-cli-version: v3.17.1");
        expect(fossaWorkflow).toContain(
            'fossa test --diff "$FOSSA_BASE_REVISION"',
        );
        expect(fossaWorkflow).toContain(
            "Revision for locator .* was not found",
        );
        expect(fossaWorkflow).not.toContain("api-key: abcdef");
    });

    it("documents the required repository secrets without exposing values", () => {
        const settings = readProjectFile("docs/GITHUB_PROJECT_SETTINGS.md");

        expect(settings).toContain("FOSSA_API_KEY");
        expect(settings).toContain("CODECOV_TOKEN");
        expect(settings).not.toContain("FOSSA_API_KEY=");
        expect(settings).not.toContain("CODECOV_TOKEN=");
    });
});
