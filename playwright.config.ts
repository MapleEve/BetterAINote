import { createHash } from "node:crypto";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

function resolveConfiguredBaseUrl() {
    return [process.env.PLAYWRIGHT_BASE_URL, process.env.APP_URL]
        .map((value) => value?.trim())
        .find(Boolean);
}

function resolveE2eRootDir() {
    const configuredRoot = process.env.PLAYWRIGHT_E2E_ROOT?.trim();
    return configuredRoot
        ? path.resolve(configuredRoot)
        : path.resolve(__dirname, "tmp/e2e");
}

function shellQuote(value: string) {
    return `'${value.replaceAll("'", `'"'"'`)}'`;
}

const configuredBaseUrl = resolveConfiguredBaseUrl();
const isolatedPort = process.env.PLAYWRIGHT_E2E_PORT?.trim() || "3201";
const baseURL = configuredBaseUrl || `http://127.0.0.1:${isolatedPort}`;
const appUrl = new URL(baseURL);
const useSystemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "1";
const browserProjectName = useSystemChrome
    ? "system-chrome"
    : "bundled-chromium";
const isLoopbackHost = ["127.0.0.1", "localhost", "::1"].includes(
    appUrl.hostname,
);

if (isLoopbackHost) {
    const noProxyHosts = new Set(
        [
            process.env.NO_PROXY,
            process.env.no_proxy,
            appUrl.hostname,
            "127.0.0.1",
            "localhost",
            "::1",
        ]
            .flatMap((value) => value?.split(",") ?? [])
            .map((value) => value.trim())
            .filter(Boolean),
    );
    const noProxyValue = Array.from(noProxyHosts).join(",");
    process.env.NO_PROXY = noProxyValue;
    process.env.no_proxy = noProxyValue;
}

const e2eRootDir = resolveE2eRootDir();
const e2eAppDir = path.join(e2eRootDir, "app");
const e2eDataDir = path.join(e2eRootDir, "data");
const e2eStorageDir = path.join(e2eRootDir, "storage");
const e2eDatabasePath = path.join(e2eDataDir, "betterainote-e2e.db");
const e2eWordsDatabasePath = path.join(e2eDataDir, "betterainote-e2e-words.db");
const useIsolatedFallback = !configuredBaseUrl;
const shouldManageWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";
const runnerBunExecutable = process.env.BETTERAINOTE_E2E_BUN_EXECUTABLE?.trim();
const runnerNextCli = process.env.BETTERAINOTE_E2E_NEXT_CLI?.trim();
const runnerNodeExecutable =
    process.env.BETTERAINOTE_E2E_NODE_EXECUTABLE?.trim();
const runnerToolCount = [
    runnerBunExecutable,
    runnerNextCli,
    runnerNodeExecutable,
].filter(Boolean).length;

if (runnerToolCount > 0 && runnerToolCount !== 3) {
    throw new Error(
        "Canonical E2E runner tool paths must be provided as one complete contract",
    );
}

const e2eSetupCommand = runnerNodeExecutable
    ? `${shellQuote(runnerNodeExecutable)} scripts/e2e-setup.mjs`
    : "node scripts/e2e-setup.mjs";
const nextDevCommand =
    runnerNodeExecutable && runnerNextCli
        ? `${shellQuote(runnerNodeExecutable)} ${shellQuote(runnerNextCli)}`
        : "bunx next";

if (useIsolatedFallback && shouldManageWebServer) {
    process.env.NODE_ENV ??= "development";
    process.env.PLAYWRIGHT_E2E_DATA_SOURCES_FALLBACK ??= "1";

    if (process.env.NODE_ENV !== "production") {
        process.env.BETTER_AUTH_SECRET ??= createHash("sha256")
            .update(e2eRootDir)
            .digest("hex");
    }
}

const e2eEnv = {
    ...process.env,
    APP_URL: baseURL,
    DATABASE_PATH: e2eDatabasePath,
    ENCRYPTION_KEY:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    HOSTNAME: appUrl.hostname,
    LOCAL_STORAGE_PATH: e2eStorageDir,
    NEXT_TELEMETRY_DISABLED: "1",
    ...(useIsolatedFallback ? { NEXT_PRIVATE_DEV_DIR: e2eAppDir } : {}),
    PLAYWRIGHT_E2E_DATA_DIR: e2eDataDir,
    PLAYWRIGHT_E2E_APP_DIR: e2eAppDir,
    PLAYWRIGHT_E2E_DATABASE_PATH: e2eDatabasePath,
    PLAYWRIGHT_E2E_ROOT: e2eRootDir,
    PLAYWRIGHT_E2E_STORAGE_DIR: e2eStorageDir,
    PORT: appUrl.port || "3101",
    TRANSCRIPT_WORDS_DATABASE_PATH: e2eWordsDatabasePath,
};

if (shouldManageWebServer) {
    Object.assign(process.env, e2eEnv);
}

export default defineConfig({
    testDir: "./e2e",
    testMatch: /.*\.spec\.ts/,
    fullyParallel: false,
    retries: 0,
    workers: 1,
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || "tmp/playwright-results",
    reporter: "list",
    metadata: {
        browserIdentity: useSystemChrome
            ? "system Google Chrome via Playwright channel chrome"
            : "Playwright bundled Chromium",
        browserProject: browserProjectName,
    },
    projects: [{ name: browserProjectName }],
    use: {
        ...devices["Desktop Chrome"],
        baseURL,
        ...(useSystemChrome ? { channel: "chrome" as const } : {}),
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    webServer: shouldManageWebServer
        ? {
              command: `${e2eSetupCommand} && cd ${shellQuote(e2eAppDir)} && ${nextDevCommand} dev --webpack --hostname ${appUrl.hostname} --port ${appUrl.port || "3101"}`,
              cwd: __dirname,
              env: e2eEnv,
              timeout: 180_000,
              url: `${baseURL}/register`,
          }
        : undefined,
});
