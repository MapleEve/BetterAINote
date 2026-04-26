import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard speaker label editor regressions", () => {
    it("keeps transcript review visible when there are no saved speaker mappings", () => {
        const source = readFileSync(
            path.join(
                process.cwd(),
                "src/components/dashboard/speaker-label-editor.tsx",
            ),
            "utf8",
        );

        expect(source).not.toContain(
            "if (speakers.length === 0) {\n        return null;",
        );
        expect(source).toContain("speakerReview.noDetectedSpeakers");
    });
});
