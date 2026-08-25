import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

function settingsDialog(page: Parameters<typeof ensureSignedIn>[0]) {
    return page.getByRole("dialog", { name: /^(设置|Settings)$/ });
}

test("Settings dialog removes closed content from focus and accessibility paths and restores its trigger focus", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ensureSignedIn(page);

    await expect(
        page.locator(
            '[data-shell="dashboard-workstation"][data-hydrated="true"]',
        ),
    ).toBeVisible();

    const trigger = page.locator('[data-control="dashboard-settings"]');
    const dialog = settingsDialog(page);

    await expect(trigger).toBeVisible();
    await expect(dialog).toHaveCount(0);

    await trigger.focus();
    await page.keyboard.press("Tab");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await trigger.click();
    await expect(trigger).toHaveAttribute("data-state", "open");
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByRole("button", { name: /^(数据源|Data Sources)$/ }),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog
        .getByRole("button", { name: /^(关闭设置|Close settings)$/ })
        .click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
});
