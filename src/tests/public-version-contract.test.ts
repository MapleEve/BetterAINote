import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function readProjectFile(relativePath: string) {
    return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readPackageVersion() {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
        version?: string;
    };

    return packageJson.version;
}

describe("public preview version contract", () => {
    it("keeps public release-boundary docs aligned with package.json", () => {
        const version = readPackageVersion();

        expect(version).toMatch(/^\d+\.\d+\.\d+-preview$/);

        const releaseBoundaryFiles = [
            ".github/pull_request_template.md",
            "docs/API.md",
            "docs/DEPLOYMENT.md",
            "docs/DEVELOPMENT.md",
            "SECURITY.md",
        ];

        const missingCurrentVersion = releaseBoundaryFiles.filter(
            (relativePath) =>
                !readProjectFile(relativePath).includes(version ?? ""),
        );

        expect(missingCurrentVersion).toEqual([]);
    });

    it("keeps Simplified Chinese as the default project documentation entrypoint", () => {
        expect(readProjectFile("README.md")).toContain("<b>简体中文</b>");
        expect(readProjectFile("README.en.md")).toContain(
            '<a href="README.md">简体中文</a> · <b>English</b>',
        );

        const publicDocs = [
            "README.md",
            "README.en.md",
            "README.ja.md",
            "README.ko.md",
            "CONTRIBUTING.md",
            "docs/DEVELOPMENT.md",
        ];
        const forbiddenDefaults = [
            "README 以英文为主入口",
            "English-first entry",
            "English as the main README",
            "English-first README",
        ];

        const offenders = publicDocs.filter((relativePath) =>
            forbiddenDefaults.some((phrase) =>
                readProjectFile(relativePath).includes(phrase),
            ),
        );

        expect(offenders).toEqual([]);
    });
});
