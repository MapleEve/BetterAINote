import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("public release hygiene", () => {
    it("keeps local-only materials out of the public git surface", () => {
        const gitignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
        const dockerignore = readFileSync(
            path.join(ROOT, ".dockerignore"),
            "utf8",
        );
        const localOnlyPatterns = [
            "/plans/",
            "/plan/",
            "/meeting-notes/",
            "/meetings/",
            "/meeting-records/",
            "/specs/",
            "/spec/",
            "/roadmaps/",
            "/roadmap/",
            "/prd/",
            "/research/",
            "/tasks/",
            "/task/",
            "/计划/",
            "/会议纪要/",
            "/会议记录/",
            "/规格/",
            "/路线图/",
            "/需求/",
            "/研究/",
            "/任务/",
            "/功能切片/",
            "*.local.md",
            "LOCAL-*.md",
        ];

        for (const pattern of localOnlyPatterns) {
            expect(gitignore).toContain(pattern);
            expect(dockerignore).toContain(pattern);
        }

        const trackedLocalOnlyFiles = execFileSync(
            "git",
            [
                "ls-files",
                "LOCAL-*.md",
                "plans",
                "plan",
                "meeting-notes",
                "meetings",
                "meeting-records",
                "specs",
                "spec",
                "roadmaps",
                "roadmap",
                "prd",
                "research",
                "tasks",
                "task",
                "计划",
                "会议纪要",
                "会议记录",
                "规格",
                "路线图",
                "需求",
                "研究",
                "任务",
                "功能切片",
            ],
            { cwd: ROOT, encoding: "utf8" },
        )
            .trim()
            .split("\n")
            .filter(Boolean);

        expect(trackedLocalOnlyFiles).toEqual([]);
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
