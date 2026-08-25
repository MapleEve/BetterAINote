import { expect, test } from "@playwright/test";

const nextImageWarning = /next\/image|image with src|custom loader/i;

test("login loads its local logo without Next Image warnings", async ({ page }) => {
    const imageWarnings: string[] = [];

    page.on("console", (message) => {
        if (
            (message.type() === "warning" || message.type() === "error") &&
            nextImageWarning.test(message.text())
        ) {
            imageWarnings.push(message.text());
        }
    });

    await page.goto("/login", { waitUntil: "networkidle" });

    await expect(page.getByText("登录 BetterAINote", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "邮箱" })).toBeVisible();
    const logo = page.locator('img[src="/assets/logo-mark-steel.svg"]');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("width", "36");
    await expect(logo).toHaveAttribute("height", "36");
    await expect(imageWarnings).toEqual([]);
});
