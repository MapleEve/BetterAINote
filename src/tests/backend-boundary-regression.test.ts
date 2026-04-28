import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
    return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("backend boundary regression", () => {
    it.each([
        "src/lib/settings/user-settings.ts",
        "src/lib/api-credentials/store.ts",
        "src/lib/registration.ts",
    ])("%s stays a compatibility facade instead of a database module", (file) => {
        const source = readProjectFile(file);

        expect(source).not.toMatch(/from\s+["']@\/db/);
        expect(source).not.toMatch(/from\s+["']drizzle-orm/);
        expect(source).not.toMatch(/from\s+["']@\/db\/schema/);
        expect(source).toContain("@/server/modules/");
    });
});
