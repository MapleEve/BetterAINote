import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const DASHBOARD_SIDEBAR_COLLAPSED_STORAGE_KEY = "dashboard-sidebar-collapsed";

test("dashboard desktop sidebar collapse persists through local storage reloads", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ensureSignedIn(page);

    await page.evaluate((storageKey) => {
        window.localStorage.removeItem(storageKey);
    }, DASHBOARD_SIDEBAR_COLLAPSED_STORAGE_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });

    const workstation = page.locator(
        '[data-sot-surface="dashboard-workstation"]',
    );
    const sidebarCollapse = page.locator(
        '[data-sot-control="sidebar-collapse"]',
    );

    await expect(workstation).toHaveAttribute("data-sot-state", "ready");
    await expect(workstation).toHaveAttribute(
        "data-sidebar-collapsed",
        "false",
    );
    await expect(sidebarCollapse).toHaveAttribute("data-sot-state", "expanded");

    await sidebarCollapse.click();
    await expect(workstation).toHaveAttribute(
        "data-sidebar-collapsed",
        "true",
    );
    await expect(sidebarCollapse).toHaveAttribute("data-sot-state", "collapsed");
    await expect
        .poll(() =>
            page.evaluate((storageKey) => {
                return window.localStorage.getItem(storageKey);
            }, DASHBOARD_SIDEBAR_COLLAPSED_STORAGE_KEY),
        )
        .toBe("true");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(workstation).toHaveAttribute("data-sot-state", "ready");
    await expect(workstation).toHaveAttribute(
        "data-sidebar-collapsed",
        "true",
    );
    await expect(sidebarCollapse).toHaveAttribute("data-sot-state", "collapsed");

    await sidebarCollapse.click();
    await expect(workstation).toHaveAttribute(
        "data-sidebar-collapsed",
        "false",
    );
    await expect(sidebarCollapse).toHaveAttribute("data-sot-state", "expanded");
    await expect
        .poll(() =>
            page.evaluate((storageKey) => {
                return window.localStorage.getItem(storageKey);
            }, DASHBOARD_SIDEBAR_COLLAPSED_STORAGE_KEY),
        )
        .toBe("false");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(workstation).toHaveAttribute("data-sot-state", "ready");
    await expect(workstation).toHaveAttribute(
        "data-sidebar-collapsed",
        "false",
    );
    await expect(sidebarCollapse).toHaveAttribute("data-sot-state", "expanded");
});
