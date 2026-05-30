import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

test("library search keeps error retry and keyboard focus paths live", async ({
    page,
}) => {
    let searchCalls = 0;
    await page.route("**/api/search?**", async (route) => {
        searchCalls += 1;
        if (searchCalls === 1) {
            await route.fulfill({
                contentType: "application/json",
                status: 503,
                body: JSON.stringify({ error: "Search temporarily unavailable" }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ results: [] }),
        });
    });

    await ensureSignedIn(page);
    const dashboardHydrated = page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/recording-tags") &&
                response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await dashboardHydrated;

    await page.getByTestId("library-search-trigger").click();
    const panel = page.getByTestId("library-search-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS("z-index", "220");

    const input = panel.getByRole("textbox", {
        name: "搜索录音、逐字稿、说话人、标签",
    });
    await input.fill("retry-check");
    await expect(page.getByTestId("library-search-error")).toBeVisible();

    await page.locator("[data-ls-retry]").click();
    await expect(page.getByTestId("library-search-no-results")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page.getByTestId("library-search-trigger")).toBeFocused();
});
