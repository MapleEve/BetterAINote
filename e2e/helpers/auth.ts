import type { Page } from "@playwright/test";

const PLAYWRIGHT_ACCOUNT = {
    email: "playwright-admin@example.com",
    name: "Playwright Admin",
    password: "PlaywrightPassword123!",
};

async function login(page: Page) {
    await page.getByLabel("邮箱").fill(PLAYWRIGHT_ACCOUNT.email);
    await page.getByLabel("密码").fill(PLAYWRIGHT_ACCOUNT.password);
    await page.getByRole("button", { name: "登录" }).click();
    await page.waitForURL("**/dashboard", { waitUntil: "commit" });
}

export async function ensureSignedIn(page: Page) {
    await page.goto("/register", { waitUntil: "domcontentloaded" });

    if (page.url().includes("/login")) {
        await login(page);
        return;
    }

    await page.getByLabel("名称").fill(PLAYWRIGHT_ACCOUNT.name);
    await page.getByLabel("邮箱").fill(PLAYWRIGHT_ACCOUNT.email);
    await page.getByLabel("密码").fill(PLAYWRIGHT_ACCOUNT.password);
    await page.getByRole("button", { name: "创建账号" }).click();

    await page.waitForURL("**/dashboard", { waitUntil: "commit" });
}
