import { expect, type APIResponse, type Page } from "@playwright/test";

const PLAYWRIGHT_ACCOUNT = {
    email: "playwright-admin@example.com",
    name: "Playwright Admin",
    password: "PlaywrightPassword123!",
};

const AUTH_REQUEST_RETRY_DELAYS_MS = [250, 500, 1_000, 1_500];
const E2E_REQUEST_RETRY_DELAYS_MS = [250, 500, 1_000];

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
            return await page.request.post(path, { data });
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
    await expect(page).toHaveURL(/\/dashboard/);
}
