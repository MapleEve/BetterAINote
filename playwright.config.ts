import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

function resolveConfiguredBaseUrl() {
    return [process.env.PLAYWRIGHT_BASE_URL, process.env.APP_URL].find(
        (value) => value?.trim(),
    );
}

const configuredBaseUrl = resolveConfiguredBaseUrl();
const baseURL = configuredBaseUrl || "http://127.0.0.1:3201";
const appUrl = new URL(baseURL);
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

const e2eRootDir = path.resolve(__dirname, "tmp/e2e");
const e2eAppDir = path.join(e2eRootDir, "app");
const e2eDataDir = path.join(e2eRootDir, "data");
const e2eStorageDir = path.join(e2eRootDir, "storage");
const e2eDatabasePath = path.join(e2eDataDir, "betterainote-e2e.db");
const e2eWordsDatabasePath = path.join(e2eDataDir, "betterainote-e2e-words.db");
const useIsolatedFallback = !configuredBaseUrl;
const e2eEnv = {
    ...process.env,
    APP_URL: baseURL,
    BETTER_AUTH_SECRET:
        "playwright-better-auth-secret-0123456789abcdef-playwright",
    DATABASE_PATH: e2eDatabasePath,
    ENCRYPTION_KEY:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    HOSTNAME: appUrl.hostname,
    LOCAL_STORAGE_PATH: e2eStorageDir,
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PRIVATE_DEV_DIR: useIsolatedFallback
        ? e2eAppDir
        : process.env.NEXT_PRIVATE_DEV_DIR,
    PLAYWRIGHT_E2E_DATA_DIR: e2eDataDir,
    PLAYWRIGHT_E2E_APP_DIR: e2eAppDir,
    PLAYWRIGHT_E2E_DATABASE_PATH: e2eDatabasePath,
    PLAYWRIGHT_E2E_ROOT: e2eRootDir,
    PLAYWRIGHT_E2E_STORAGE_DIR: e2eStorageDir,
    PORT: appUrl.port || "3101",
    TRANSCRIPT_WORDS_DATABASE_PATH: e2eWordsDatabasePath,
};
const shouldManageWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";

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
    outputDir: "tmp/playwright-results",
    reporter: "list",
    use: {
        ...devices["Desktop Chrome"],
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    webServer: shouldManageWebServer
        ? {
              command: `node scripts/e2e-setup.mjs && pnpm exec next dev --hostname ${appUrl.hostname} --port ${appUrl.port || "3101"}`,
              cwd: __dirname,
              env: e2eEnv,
              reuseExistingServer: true,
              timeout: 180_000,
              url: `${baseURL}/register`,
          }
        : undefined,
});
