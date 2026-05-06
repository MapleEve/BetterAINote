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
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/tests/**",
                "**/*.d.ts",
                "**/.next/**",
                "**/node_modules/**",
                "e2e/**",
                "tmp/**",
            ],
        },
    },
});
