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
        expect(codecovConfig).toContain("target: 80%");
        expect(codecovConfig).toContain("target: 70%");
        expect(codecovConfig).toContain("threshold: 0%");
        expect(codecovConfig).toContain(
            '"src/server/modules/search/segmenter.ts"',
        );
        expect(codecovConfig).toContain('"src/tests/**"');

        const vitestConfig = readProjectFile("vitest.config.ts");
        expect(vitestConfig).toContain('"src/lib/data-sources/**/*.{ts,tsx}"');
        expect(vitestConfig).toContain(
            '"src/server/modules/search/segmenter.ts"',
        );
        expect(vitestConfig).toContain('"src/features/settings/**/*.{ts,tsx}"');
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

    it("keeps Claude Code CI secret-backed and project scoped", () => {
        const claudeWorkflow = readProjectFile(".github/workflows/claude.yml");
        const claudeReviewWorkflow = readProjectFile(
            ".github/workflows/claude-code-review.yml",
        );

        for (const workflow of [claudeWorkflow, claudeReviewWorkflow]) {
            expect(workflow).toContain("anthropics/claude-code-action@v1");
            expect(workflow).toContain("secrets.ANTHROPIC_API_KEY");
            expect(workflow).toContain("secrets.ANTHROPIC_BASE_URL");
            expect(workflow).toContain("secrets.GH_TOKEN");
            expect(workflow).toContain("claude-sonnet-4-6");
            expect(workflow).toContain("BetterAINote");
            expect(workflow).toContain("bun run format-and-lint");
            expect(workflow).not.toContain("anthropic_api_key: sk-");
            expect(workflow).not.toContain("ANTHROPIC_API_KEY=");
            expect(workflow).not.toContain("GH_TOKEN=");
        }
    });

    it("documents the required repository secrets without exposing values", () => {
        const settings = readProjectFile("docs/GITHUB_PROJECT_SETTINGS.md");

        expect(settings).toContain("FOSSA_API_KEY");
        expect(settings).toContain("CODECOV_TOKEN");
        expect(settings).toContain("ANTHROPIC_API_KEY");
        expect(settings).toContain("ANTHROPIC_BASE_URL");
        expect(settings).toContain("GH_TOKEN");
        expect(settings).not.toContain("FOSSA_API_KEY=");
        expect(settings).not.toContain("CODECOV_TOKEN=");
        expect(settings).not.toContain("ANTHROPIC_API_KEY=");
        expect(settings).not.toContain("ANTHROPIC_BASE_URL=");
        expect(settings).not.toContain("GH_TOKEN=");
    });

    it("keeps the FOSSA scan surface free of unused browser transcription dependencies", () => {
        const packageJson = JSON.parse(readProjectFile("package.json")) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };

        expect(packageJson.dependencies).not.toHaveProperty(
            "@xenova/transformers",
        );
        expect(packageJson.dependencies).not.toHaveProperty("@google/genai");
        expect(packageJson.dependencies).not.toHaveProperty(
            "@radix-ui/react-progress",
        );
        expect(packageJson.dependencies).not.toHaveProperty("react-hook-form");
        expect(packageJson.dependencies).not.toHaveProperty("vitest");
        expect(packageJson.devDependencies).toHaveProperty("vitest", "4.1.5");
        expect(
            existsSync(path.join(ROOT, "src/lib/transcription/worker.ts")),
        ).toBe(false);
        expect(
            existsSync(
                path.join(
                    ROOT,
                    "src/lib/transcription/providers/google-speech-provider.ts",
                ),
            ),
        ).toBe(false);
    });

    it("pins FOSSA security transitive dependency floors until direct packages catch up", () => {
        const packageJson = JSON.parse(readProjectFile("package.json")) as {
            overrides?: Record<string, string>;
        };

        expect(packageJson.overrides).toMatchObject({
            defu: "6.1.5",
            picomatch: "4.0.4",
            postcss: "8.5.10",
            rollup: "4.59.0",
            vite: "7.3.2",
        });
    });
});
