import { expect, type APIResponse, type Page } from "@playwright/test";

const PLAYWRIGHT_ACCOUNT = {
    email: "playwright-admin@example.com",
    name: "Playwright Admin",
    password: "PlaywrightPassword123!",
};

const E2E_REQUEST_RETRY_DELAYS_MS = [
    250, 500, 1_000, 1_500, 2_500, 5_000, 7_500, 10_000,
];
const AUTH_REQUEST_RETRY_DELAYS_MS = E2E_REQUEST_RETRY_DELAYS_MS;

function resolveRuntimeBaseUrl() {
    const configuredBaseUrl =
        process.env.PLAYWRIGHT_BASE_URL?.trim() || process.env.APP_URL?.trim();
    if (configuredBaseUrl) {
        return new URL(configuredBaseUrl);
    }

    return new URL(
        `http://127.0.0.1:${process.env.PLAYWRIGHT_E2E_PORT?.trim() || "3201"}`,
    );
}

function resolveAuthRequestUrl(requestPath: string) {
    return new URL(requestPath, resolveRuntimeBaseUrl()).toString();
}

function isRetryableRequestError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return /ECONNRESET|ECONNREFUSED|EPIPE|socket hang up|fetch failed/i.test(
        message,
    );
}

async function postAuthSetupRequest(
    page: Page,
    path: string,
    data: Record<string, string>,
): Promise<APIResponse> {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await page.request.post(resolveAuthRequestUrl(path), { data });
        } catch (error) {
            const delayMs = AUTH_REQUEST_RETRY_DELAYS_MS[attempt];
            if (delayMs == null || !isRetryableRequestError(error)) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}

export async function putJsonWithRetry(
    page: Page,
    path: string,
    data: Record<string, unknown>,
): Promise<APIResponse> {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await page.request.put(path, { data });
        } catch (error) {
            const delayMs = E2E_REQUEST_RETRY_DELAYS_MS[attempt];
            if (delayMs == null || !isRetryableRequestError(error)) {
                throw error;
            }
            await page.waitForTimeout(delayMs);
        }
    }
}

export async function waitForLoginPageReady(page: Page) {
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "邮箱" })).toBeEnabled();
    await expect(
        page.getByRole("button", { name: "发送登录链接", exact: true }),
    ).toBeEnabled();
}

export async function waitForWorkspaceReady(page: Page) {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("main")).toBeVisible();
}

export async function ensureSignedIn(page: Page) {
    const signUpResponse = await postAuthSetupRequest(
        page,
        "/api/auth/sign-up/email",
        PLAYWRIGHT_ACCOUNT,
    );

    if (!signUpResponse.ok() && signUpResponse.status() !== 403) {
        throw new Error(
            `Failed to create E2E session: ${signUpResponse.status()}`,
        );
    }

    if (signUpResponse.status() === 403) {
        const signInResponse = await postAuthSetupRequest(
            page,
            "/api/auth/sign-in/email",
            {
                email: PLAYWRIGHT_ACCOUNT.email,
                password: PLAYWRIGHT_ACCOUNT.password,
            },
        );

        if (!signInResponse.ok()) {
            throw new Error(
                `Failed to sign in E2E session: ${signInResponse.status()}`,
            );
        }
    }

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await waitForWorkspaceReady(page);
}
