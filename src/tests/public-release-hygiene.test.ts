import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("public release hygiene", () => {
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
