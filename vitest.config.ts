import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(__dirname, "./src"),
        },
    },
    test: {
        environment: "node",
        include: ["src/tests/**/*.{test,spec}.ts"],
        exclude: [
            "**/.next/**",
            "**/node_modules/**",
            "e2e/**",
            "**/e2e/**",
            "tmp/e2e/**",
            "**/tmp/e2e/**",
            "tmp/worktree-archive/**",
            "**/tmp/worktree-archive/**",
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            reportsDirectory: "coverage",
            include: [
                "src/features/settings/**/*.{ts,tsx}",
                "src/lib/data-sources/**/*.{ts,tsx}",
                "src/lib/search/**/*.{ts,tsx}",
                "src/lib/settings/**/*.{ts,tsx}",
                "src/server/modules/data-sources/**/*.ts",
                "src/server/modules/search/search-repository.ts",
                "src/server/modules/search/segmenter.ts",
                "src/server/modules/settings/**/*.ts",
                "src/services/**/*.ts",
            ],
            exclude: [
                "src/tests/**",
                "src/features/settings/components/**",
                "**/*.d.ts",
                "**/.next/**",
                "**/node_modules/**",
                "e2e/**",
                "tmp/**",
            ],
        },
    },
});
