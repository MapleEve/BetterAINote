import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    providerWrite: vi.fn(),
}));

vi.mock("@/lib/data-sources/providers", () => ({
    getSourceProviderDefinition: vi.fn(() => ({
        defaults: {
            authMode: "bearer",
            config: {},
        },
        prepareConnectionWrite: mocks.providerWrite,
    })),
}));

import { prepareSourceConnectionWrite } from "@/server/modules/data-sources/settings";

type PrepareParams = Parameters<typeof prepareSourceConnectionWrite>[0];
type ExistingConnection = NonNullable<PrepareParams["existing"]>;

const environmentKeys = [
    "DATABASE_PATH",
    "NODE_ENV",
    "PLAYWRIGHT_E2E_DATA_SOURCES_FALLBACK",
    "PLAYWRIGHT_E2E_ROOT",
] as const;
const originalEnvironment = new Map(
    environmentKeys.map((key) => [key, process.env[key]]),
);
const e2eRoot = path.resolve("/tmp/betterainote-playwright-fallback-test");
const e2eDatabasePath = path.join(e2eRoot, "data", "betterainote-e2e.db");
const providerResult = {
    enabled: false,
    authMode: "bearer" as const,
    baseUrl: null,
    config: { providerPath: true },
    secretConfig: "provider-secret",
};

function setEnvironment(
    key: (typeof environmentKeys)[number],
    value: string | undefined,
) {
    const environment = process.env as Record<string, string | undefined>;
    if (value === undefined) {
        delete environment[key];
    } else {
        environment[key] = value;
    }
}

function restoreEnvironment() {
    for (const key of environmentKeys) {
        const value = originalEnvironment.get(key);
        setEnvironment(key, value);
    }
}

function enablePlaywrightFallback() {
    setEnvironment("DATABASE_PATH", e2eDatabasePath);
    setEnvironment("NODE_ENV", "development");
    setEnvironment("PLAYWRIGHT_E2E_DATA_SOURCES_FALLBACK", "1");
    setEnvironment("PLAYWRIGHT_E2E_ROOT", e2eRoot);
}

function makeExisting(
    overrides: Partial<ExistingConnection> = {},
): ExistingConnection {
    return {
        userId: "user-e2e",
        provider: "plaud",
        enabled: true,
        authMode: "bearer",
        baseUrl: "https://example.invalid",
        config: { existingValue: "preserved" },
        secretConfig: "encrypted-existing-secret",
        ...overrides,
    };
}

function makeParams(overrides: Partial<PrepareParams> = {}): PrepareParams {
    return {
        userId: "user-e2e",
        provider: "plaud",
        existing: makeExisting(),
        body: {
            provider: "plaud",
        },
        ...overrides,
    };
}

async function expectProviderPath(params: PrepareParams) {
    await expect(prepareSourceConnectionWrite(params)).resolves.toEqual(
        providerResult,
    );
    expect(mocks.providerWrite).toHaveBeenCalledOnce();
}

describe("Playwright data sources preparation fallback", () => {
    beforeEach(() => {
        restoreEnvironment();
        vi.clearAllMocks();
        mocks.providerWrite.mockResolvedValue(providerResult);
    });

    afterEach(() => {
        restoreEnvironment();
    });

    it("uses the provider hook when the fallback flag is absent", async () => {
        setEnvironment("DATABASE_PATH", e2eDatabasePath);
        setEnvironment("NODE_ENV", "development");
        setEnvironment("PLAYWRIGHT_E2E_ROOT", e2eRoot);

        await expectProviderPath(makeParams());
    });

    it("uses the provider hook outside development", async () => {
        enablePlaywrightFallback();
        setEnvironment("NODE_ENV", "production");

        await expectProviderPath(makeParams());
    });

    it("uses the provider hook when the database is outside E2E data", async () => {
        enablePlaywrightFallback();
        setEnvironment("DATABASE_PATH", path.join(e2eRoot, "outside.db"));

        await expectProviderPath(makeParams());
    });

    it("uses the provider hook without an existing connection", async () => {
        enablePlaywrightFallback();

        await expectProviderPath(makeParams({ existing: null }));
    });

    it("returns a safe existing-connection write for valid E2E input", async () => {
        enablePlaywrightFallback();

        const prepared = await prepareSourceConnectionWrite(
            makeParams({
                body: {
                    provider: "plaud",
                    enabled: false,
                    authMode: "cookie",
                    baseUrl: null,
                    config: { replacementValue: "accepted" },
                    secrets: { bearerToken: "raw-body-secret" },
                },
            }),
        );

        expect(prepared).toEqual({
            enabled: false,
            authMode: "cookie",
            baseUrl: null,
            config: {
                existingValue: "preserved",
                replacementValue: "accepted",
            },
            secretConfig: "encrypted-existing-secret",
        });
        expect(prepared).not.toHaveProperty("sourceDevices");
        expect(mocks.providerWrite).not.toHaveBeenCalled();
    });

    it.each([
        ["a mismatched provider", { provider: "ticnote" }],
        ["a non-boolean enabled value", { enabled: "true" }],
        ["an unknown auth mode", { authMode: "unknown" }],
        ["a non-string base URL", { baseUrl: 42 }],
        ["a non-plain config", { config: [] }],
    ])("uses the provider hook for %s", async (_label, invalidBody) => {
        enablePlaywrightFallback();

        await expectProviderPath(
            makeParams({
                body: {
                    provider: "plaud",
                    ...invalidBody,
                },
            }),
        );
    });
});
