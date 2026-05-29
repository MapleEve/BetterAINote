import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const API_ROOT = path.join(process.cwd(), "src/app/api");
const APP_ROOT = path.join(process.cwd(), "src/app");

function collectRouteFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return collectRouteFiles(fullPath);
        }

        return entry.isFile() && entry.name === "route.ts" ? [fullPath] : [];
    });
}

function collectFiles(
    directory: string,
    predicate: (entry: string) => boolean,
): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return collectFiles(fullPath, predicate);
        }

        return entry.isFile() && predicate(entry.name) ? [fullPath] : [];
    });
}

describe("preview architecture boundary", () => {
    it("keeps API routes as thin HTTP adapters instead of database SOT modules", () => {
        const offenders = collectRouteFiles(API_ROOT)
            .map((filePath) => ({
                filePath,
                source: readFileSync(filePath, "utf8"),
            }))
            .filter(({ source }) =>
                /from\s+["'](?:@\/db|drizzle-orm|@\/db\/schema)/.test(source),
            )
            .map(({ filePath }) => path.relative(process.cwd(), filePath));

        expect(offenders).toEqual([]);
    });

    it("keeps app pages as shell/read-model consumers instead of database query modules", () => {
        const offenders = collectFiles(APP_ROOT, (name) => name === "page.tsx")
            .map((filePath) => ({
                filePath,
                source: readFileSync(filePath, "utf8"),
            }))
            .filter(({ source }) =>
                /from\s+["'](?:@\/db|drizzle-orm|@\/db\/schema)/.test(source),
            )
            .map(({ filePath }) => path.relative(process.cwd(), filePath));

        expect(offenders).toEqual([]);
    });

    it("keeps source provider definitions as adapters instead of database writers", () => {
        const providerFiles = collectFiles(
            path.join(process.cwd(), "src/lib/data-sources/providers"),
            (name) => name.endsWith(".ts"),
        );
        const offenders = providerFiles
            .map((filePath) => ({
                filePath,
                source: readFileSync(filePath, "utf8"),
            }))
            .filter(({ source }) =>
                /from\s+["'](?:@\/db|drizzle-orm|@\/db\/schema)/.test(source),
            )
            .map(({ filePath }) => path.relative(process.cwd(), filePath));

        expect(offenders).toEqual([]);
    });

    it("does not let build-time auth initialization fall back to Better Auth's default secret", () => {
        const source = readFileSync(
            path.join(process.cwd(), "src/lib/auth.ts"),
            "utf8",
        );

        expect(source).toContain("BUILD_ONLY_AUTH_SECRET");
        expect(source).toContain("BUILD_ONLY_AUTH_BASE_URL");
        expect(source).toContain("isBuildRuntime()");
        expect(source).toContain("secret: resolveAuthSecret()");
        expect(source).toContain("baseURL: resolveAuthBaseUrl()");
    });

    it("does not import display-segment builders as type-only value symbols", () => {
        const source = readFileSync(
            path.join(
                process.cwd(),
                "src/server/modules/recordings/serialize.ts",
            ),
            "utf8",
        );

        expect(source).not.toContain("type buildDisplaySegments");
    });

    it("allows the local 127.0.0.1 browser origin for Next dev resources", () => {
        const source = readFileSync(
            path.join(process.cwd(), "next.config.ts"),
            "utf8",
        );

        expect(source).toContain("allowedDevOrigins");
        expect(source).toContain('"127.0.0.1"');
    });

    it("keeps recording and dashboard business UI under feature modules", () => {
        expect(
            existsSync(path.join(process.cwd(), "src/features/dashboard")),
        ).toBe(true);
        expect(
            existsSync(path.join(process.cwd(), "src/features/recordings")),
        ).toBe(true);
        expect(
            existsSync(path.join(process.cwd(), "src/components/dashboard")),
        ).toBe(false);
        expect(
            existsSync(path.join(process.cwd(), "src/components/recordings")),
        ).toBe(false);
    });

    it("keeps settings business UI under the settings feature module", () => {
        expect(
            existsSync(
                path.join(process.cwd(), "src/features/settings/components"),
            ),
        ).toBe(true);

        const legacySettingsSurfaces = [
            "src/components/settings-dialog.tsx",
            "src/components/settings-content.tsx",
            "src/components/settings-sections",
            "src/components/settings/settings-page-content.tsx",
            "src/components/settings/settings-skeletons.tsx",
        ];

        const offenders = legacySettingsSurfaces.filter((relativePath) =>
            existsSync(path.join(process.cwd(), relativePath)),
        );

        expect(offenders).toEqual([]);
    });

    it("keeps domain UI out of the shared components tree", () => {
        const expectedFeatureComponents = [
            "src/features/auth/components",
            "src/features/dashboard/components",
            "src/features/onboarding/components",
            "src/features/settings/components",
        ];
        const legacyComponentSurfaces = [
            "src/components/auth",
            "src/components/onboarding",
            "src/components/sync-status.tsx",
            "src/components/settings/setting-field-control.tsx",
        ];

        expect(
            expectedFeatureComponents.filter(
                (relativePath) =>
                    !existsSync(path.join(process.cwd(), relativePath)),
            ),
        ).toEqual([]);
        expect(
            legacyComponentSurfaces.filter((relativePath) =>
                existsSync(path.join(process.cwd(), relativePath)),
            ),
        ).toEqual([]);
    });
});
