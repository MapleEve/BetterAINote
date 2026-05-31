import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

async function resetDisplayToChinese(page: Page) {
    const response = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "system",
            uiLanguage: "zh-CN",
        },
    });
    expect(response.ok()).toBe(true);
}

test("dashboard system banner responds to runtime events and offline state", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("dashboard-workstation")).toBeVisible();
    await page.waitForLoadState("networkidle");

    const banner = page.locator("[data-system-banner]");
    await expect(banner).toHaveCount(0);

    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent("betterainote:system-banner", {
                detail: {
                    message: "写入暂时暂停，请稍后重试。",
                    state: "db-locked",
                    title: "数据库被占用",
                },
            }),
        );
    });
    await expect(banner).toHaveAttribute("data-system-banner-state", "db-locked");
    await expect(banner).toContainText("数据库被占用");
    await expect(banner).toContainText("写入暂时暂停，请稍后重试。");

    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent("betterainote:system-banner", {
                detail: {
                    actionLabel: "立即刷新",
                    message: "新版本已经准备好。",
                    state: "update-available",
                    title: "有更新",
                },
            }),
        );
    });
    await expect(banner).toHaveAttribute(
        "data-system-banner-state",
        "update-available",
    );
    await expect(banner.getByRole("button", { name: "立即刷新" })).toBeVisible();

    await page.evaluate(() => {
        window.dispatchEvent(
            new CustomEvent("betterainote:system-banner", {
                detail: { state: null },
            }),
        );
    });
    await expect(banner).toHaveCount(0);

    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(banner).toHaveAttribute("data-system-banner-state", "offline");
    await expect(banner).toContainText("当前离线");

    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(banner).toHaveCount(0);
});

test("dashboard sync status exposes worker unavailable, queued, and running states", async ({
    page,
}) => {
    const now = new Date();
    let mode: "unavailable" | "queued" | "running" = "unavailable";

    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() !== "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ success: true, queued: true }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                autoSyncEnabled: true,
                lastSyncTime: now.toISOString(),
                nextSyncTime: new Date(
                    now.getTime() + 30 * 60 * 1000,
                ).toISOString(),
                workerStatus: {
                    healthy: mode !== "unavailable",
                    isRunning: mode === "running",
                    lastHeartbeatAt: new Date(
                        now.getTime() - 2 * 60 * 1000,
                    ).toISOString(),
                    lastStartedAt:
                        mode === "running" ? now.toISOString() : null,
                    lastFinishedAt:
                        mode === "running" ? null : now.toISOString(),
                    nextRunAt: new Date(
                        now.getTime() + 30 * 60 * 1000,
                    ).toISOString(),
                    manualTriggerRequestedAt:
                        mode === "queued" ? now.toISOString() : null,
                    lastError:
                        mode === "unavailable" ? "本地更新服务未响应。" : null,
                    lastSummary:
                        mode === "unavailable"
                            ? null
                            : {
                                  newRecordings: 0,
                                  updatedRecordings: 0,
                                  removedRecordings: 0,
                                  errorCount: 0,
                              },
                },
            }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const status = page.getByTestId("dashboard-sync-status");
    await expect(status).toHaveAttribute(
        "data-sync-status-state",
        "unavailable",
    );
    await expect(status).toContainText("自动同步暂时不可用");
    await expect(status).toContainText("本地更新服务未响应");

    mode = "queued";
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(status).toHaveAttribute("data-sync-status-state", "queued");
    await expect(status).toContainText("即将开始检查");

    mode = "running";
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(status).toHaveAttribute("data-sync-status-state", "running");
    await expect(status).toContainText("正在检查新录音");
});
