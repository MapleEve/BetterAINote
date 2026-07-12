import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const THEME_VALUES = ["system", "light", "dark"] as const;
type Theme = (typeof THEME_VALUES)[number];

function isTheme(value: unknown): value is Theme {
    return (
        typeof value === "string" &&
        (THEME_VALUES as readonly string[]).includes(value)
    );
}

function displaySection(page: Page) {
    return page.locator(
        '[data-sot-surface="settings-section"][data-sot-section="appearance"]',
    );
}

function themeSegment(page: Page, theme: Theme) {
    return displaySection(page).locator(
        `[data-sot-control="theme"][data-sot-value="${theme}"]`,
    );
}

async function expectThemeSelected(page: Page, theme: Theme) {
    const segment = themeSegment(page, theme);

    await expect(segment).toHaveAttribute("aria-checked", "true");
    await expect(segment).toHaveAttribute("data-state", "on");
    await expect(segment).toHaveAttribute("data-sot-state", "selected");
}

async function readTheme(page: Page): Promise<Theme> {
    const response = await page.request.get("/api/settings/display");
    expect(response.ok()).toBe(true);

    const payload: unknown = await response.json();
    const theme =
        typeof payload === "object" && payload !== null
            ? (payload as { theme?: unknown }).theme
            : undefined;

    if (!isTheme(theme)) {
        throw new Error("Display settings API returned an unsupported theme value.");
    }

    return theme;
}

test("display preferences UI save survives reload and real API readback", async ({
    page,
}) => {
    await ensureSignedIn(page);

    const originalTheme = await readTheme(page);
    const savedTheme: Theme = originalTheme === "light" ? "dark" : "light";
    let primaryFlowFailed = false;
    let primaryFlowError: unknown;

    try {
        await page.goto("/settings#appearance", { waitUntil: "domcontentloaded" });
        await expect(displaySection(page)).toBeVisible();
        await expect(displaySection(page)).toHaveAttribute("data-sot-state", "ready");
        await expectThemeSelected(page, originalTheme);

        const saveResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/display") &&
                response.request().method() === "PUT" &&
                response.ok() &&
                response.request().postDataJSON()?.theme === savedTheme,
        );

        await themeSegment(page, savedTheme).click();
        await saveResponse;
        await expectThemeSelected(page, savedTheme);
        expect(await readTheme(page)).toBe(savedTheme);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(displaySection(page)).toHaveAttribute("data-sot-state", "ready");
        await expectThemeSelected(page, savedTheme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", savedTheme);
    } catch (error) {
        primaryFlowFailed = true;
        primaryFlowError = error;
        throw error;
    } finally {
        try {
            const restoreResponse = await page.request.put(
                "/api/settings/display",
                {
                    data: { theme: originalTheme },
                },
            );

            expect(restoreResponse.ok()).toBe(true);
            expect(await readTheme(page)).toBe(originalTheme);

            await page.reload({ waitUntil: "domcontentloaded" });
            await expect(displaySection(page)).toHaveAttribute(
                "data-sot-state",
                "ready",
            );
            await expectThemeSelected(page, originalTheme);
            await expect(page.locator("html")).toHaveAttribute(
                "data-theme",
                originalTheme,
            );
        } catch (cleanupError) {
            if (primaryFlowFailed) {
                throw new AggregateError(
                    [primaryFlowError, cleanupError],
                    "Display settings test and cleanup both failed.",
                );
            }

            throw cleanupError;
        }
    }
});
