import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

test("display settings language switches copy immediately via the shared store", async ({
    page,
}) => {
    await ensureSignedIn(page);

    let resolvePendingUpdate = () => {};
    let notifyUpdateStarted = () => {};
    const updateStarted = new Promise<void>((resolve) => {
        notifyUpdateStarted = resolve;
    });
    const pendingUpdate = new Promise<void>((resolve) => {
        resolvePendingUpdate = resolve;
    });

    await page.route("**/api/settings/display", async (route) => {
        if (route.request().method() !== "PUT") {
            await route.continue();
            return;
        }

        notifyUpdateStarted();
        await pendingUpdate;
        await route.continue();
    });

    await page.goto("/settings#display", { waitUntil: "domcontentloaded" });

    await expect(
        page.getByRole("heading", { name: "显示设置", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#ui-language")).toContainText("中文");
    await expect(page).toHaveURL(/\/settings#display$/);

    await page.locator("#ui-language").click();
    await page.getByRole("option", { name: "英文", exact: true }).click();

    await updateStarted;

    await expect(
        page.getByRole("heading", { name: "Display Settings", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("UI language", { exact: true })).toBeVisible();
    await expect(
        page.getByText(
            "Switch the interface between Chinese and English. Default is Chinese.",
            {
                exact: true,
            },
        ),
    ).toBeVisible();

    resolvePendingUpdate();

    await page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/display") &&
            response.request().method() === "PUT" &&
            response.ok(),
    );
    await expect(page.locator("#ui-language")).toContainText("English");
});
