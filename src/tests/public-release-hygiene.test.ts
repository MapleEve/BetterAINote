import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const PUBLIC_ROOT = path.join(ROOT, "public");

function collectPublicInstructionFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return collectPublicInstructionFiles(fullPath);
        }

        return entry.isFile() &&
            (entry.name === "AGENTS.md" || entry.name === "CLAUDE.md")
            ? [path.relative(ROOT, fullPath)]
            : [];
    });
}

describe("public release hygiene", () => {
    it("keeps agent instruction files out of the runtime public surface", () => {
        expect(collectPublicInstructionFiles(PUBLIC_ROOT)).toEqual([]);
    });

    it("keeps generated hero source files out of the public git surface", () => {
        const ignored = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
        const trackedRemotionFiles = execFileSync(
            "git",
            ["ls-files", "remotion"],
            { cwd: ROOT, encoding: "utf8" },
        )
            .trim()
            .split("\n")
            .filter(Boolean);
        const packageJson = readFileSync(
            path.join(ROOT, "package.json"),
            "utf8",
        );

        expect(ignored).toContain("/remotion/");
        expect(trackedRemotionFiles).toEqual([]);
        expect(packageJson).not.toContain("docs:hero");
        expect(packageJson).not.toContain("@remotion");
        expect(packageJson).not.toContain('"remotion"');
    });
});
