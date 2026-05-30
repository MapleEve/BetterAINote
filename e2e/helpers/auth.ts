import { expect, type Locator, type Page } from "@playwright/test";

const PLAYWRIGHT_ACCOUNT = {
    email: "playwright-admin@example.com",
    name: "Playwright Admin",
    password: "PlaywrightPassword123!",
};

async function login(page: Page) {
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");

    await fillControlledInput(emailInput, PLAYWRIGHT_ACCOUNT.email);
    await fillControlledInput(
        passwordInput,
        PLAYWRIGHT_ACCOUNT.password,
    );
    await ensureControlledInputValue(emailInput, PLAYWRIGHT_ACCOUNT.email);
    await ensureControlledInputValue(passwordInput, PLAYWRIGHT_ACCOUNT.password);
    await Promise.all([
        page.waitForURL("**/dashboard", { waitUntil: "commit" }),
        page.getByRole("button", { name: "登录" }).click(),
    ]);
}

export async function ensureSignedIn(page: Page) {
    const authPageHydration = waitForAuthPageHydration(page);
    await page.goto("/register", { waitUntil: "domcontentloaded" });
    await authPageHydration;

    if (page.url().includes("/login")) {
        await login(page);
        return;
    }

    const nameInput = page.locator("#name");
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");

    await fillControlledInput(nameInput, PLAYWRIGHT_ACCOUNT.name);
    await fillControlledInput(emailInput, PLAYWRIGHT_ACCOUNT.email);
    await fillControlledInput(
        passwordInput,
        PLAYWRIGHT_ACCOUNT.password,
    );
    await ensureControlledInputValue(nameInput, PLAYWRIGHT_ACCOUNT.name);
    await ensureControlledInputValue(emailInput, PLAYWRIGHT_ACCOUNT.email);
    await ensureControlledInputValue(passwordInput, PLAYWRIGHT_ACCOUNT.password);
    await Promise.all([
        page.waitForURL("**/dashboard", { waitUntil: "commit" }),
        page.getByRole("button", { name: "创建账号" }).click(),
    ]);
}

async function fillControlledInput(
    locator: Locator,
    value: string,
) {
    await expect(locator).toBeEditable();
    await locator.fill(value);
    await expect(locator).toHaveValue(value);
}

async function ensureControlledInputValue(locator: Locator, value: string) {
    await expect(locator).toBeEditable();
    if ((await locator.inputValue()) !== value) {
        await locator.fill(value);
    }
    await expect(locator).toHaveValue(value);
}

async function waitForAuthPageHydration(page: Page) {
    await page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/settings/display") &&
                response.request().method() === "GET",
            { timeout: 15_000 },
        )
        .catch(() => null);
}
