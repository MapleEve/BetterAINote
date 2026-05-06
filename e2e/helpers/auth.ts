import { expect, type Locator, type Page } from "@playwright/test";

const PLAYWRIGHT_ACCOUNT = {
    email: "playwright-admin@example.com",
    name: "Playwright Admin",
    password: "PlaywrightPassword123!",
};

async function login(page: Page) {
    await fillControlledInput(page.locator("#email"), PLAYWRIGHT_ACCOUNT.email);
    await fillControlledInput(
        page.locator("#password"),
        PLAYWRIGHT_ACCOUNT.password,
    );
    await page.getByRole("button", { name: "登录" }).click();
    await page.waitForURL("**/dashboard", { waitUntil: "commit" });
}

export async function ensureSignedIn(page: Page) {
    await page.goto("/register", { waitUntil: "domcontentloaded" });

    if (page.url().includes("/login")) {
        await login(page);
        return;
    }

    await fillControlledInput(page.locator("#name"), PLAYWRIGHT_ACCOUNT.name);
    await fillControlledInput(page.locator("#email"), PLAYWRIGHT_ACCOUNT.email);
    await fillControlledInput(
        page.locator("#password"),
        PLAYWRIGHT_ACCOUNT.password,
    );
    await page.getByRole("button", { name: "创建账号" }).click();

    await page.waitForURL("**/dashboard", { waitUntil: "commit" });
}

async function fillControlledInput(
    locator: Locator,
    value: string,
) {
    await expect(locator).toBeEditable();
    await locator.click();
    await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await locator.press("Backspace");
    await locator.pressSequentially(value);
    await expect(locator).toHaveValue(value);
}
