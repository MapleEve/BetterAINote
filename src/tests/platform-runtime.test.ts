import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_APP_URL = process.env.APP_URL;
const ORIGINAL_NEXT_PHASE = process.env.NEXT_PHASE;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_VITEST = process.env.VITEST;
const mutableEnv = process.env as Record<string, string | undefined>;

function restoreEnv(
    key: "APP_URL" | "NEXT_PHASE" | "NODE_ENV" | "VITEST",
    value: string | undefined,
) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }

    mutableEnv[key] = value;
}

afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv("APP_URL", ORIGINAL_APP_URL);
    restoreEnv("NEXT_PHASE", ORIGINAL_NEXT_PHASE);
    restoreEnv("NODE_ENV", ORIGINAL_NODE_ENV);
    restoreEnv("VITEST", ORIGINAL_VITEST);
});

describe("platform runtime helpers", () => {
    it("detects browser state and builds absolute URLs from browser origin", async () => {
        const runtime = await import("@/lib/platform/runtime");

        expect(runtime.hasBrowserWindow()).toBe(false);

        vi.stubGlobal("window", {
            location: { origin: "https://browser.example" },
        });

        expect(runtime.hasBrowserWindow()).toBe(true);
        expect(runtime.getRuntimeOrigin()).toBe("https://browser.example");
        expect(runtime.absoluteUrl("/recordings")).toBe(
            "https://browser.example/recordings",
        );
    });

    it("builds absolute URLs from APP_URL on the server runtime", async () => {
        mutableEnv.APP_URL = "https://server.example";

        const runtime = await import("@/lib/platform/runtime");

        expect(runtime.absoluteUrl("/settings")).toBe(
            "https://server.example/settings",
        );
    });

    it("exposes build, development, and test runtime flags from env", async () => {
        const runtime = await import("@/lib/platform/runtime");

        mutableEnv.NEXT_PHASE = "phase-production-build";
        mutableEnv.NODE_ENV = "development";
        delete process.env.VITEST;

        expect(runtime.isBuildRuntime()).toBe(true);
        expect(runtime.isDevelopmentRuntime()).toBe(true);
        expect(runtime.isTestRuntime()).toBe(false);

        mutableEnv.NODE_ENV = "test";
        expect(runtime.isTestRuntime()).toBe(true);
    });
});
