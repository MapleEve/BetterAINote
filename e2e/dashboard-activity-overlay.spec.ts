import { expect, test, type Page } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

function unhealthyWorkerStatus() {
    const now = new Date();

    return {
        autoSyncEnabled: true,
        lastSyncTime: now.toISOString(),
        nextSyncTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        workerStatus: {
            healthy: false,
            isRunning: false,
            lastHeartbeatAt: new Date(
                now.getTime() - 2 * 60 * 1000,
            ).toISOString(),
            lastStartedAt: null,
            lastFinishedAt: null,
            nextRunAt: null,
            manualTriggerRequestedAt: null,
            lastError: "本地更新服务未响应。",
            lastSummary: null,
        },
    };
}

async function mockSyncEndpoint(page: Page, releasePost: Promise<void>) {
    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() === "POST") {
            await releasePost;
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    success: true,
                    queued: true,
                    newRecordings: 0,
                }),
            });
            return;
        }

        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(unhealthyWorkerStatus()),
            });
            return;
        }

        await route.continue();
    });
}

test("activity overlay retries and dismisses source notifications", async ({
    page,
}) => {
    let releasePost = () => {};
    const pendingPost = new Promise<void>((resolve) => {
        releasePost = resolve;
    });
    await mockSyncEndpoint(page, pendingPost);

    await ensureSignedIn(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    const trigger = page.getByTestId("dashboard-activity-trigger");
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-label", /1 项待处理/);

    await trigger.click();
    const panel = page.getByTestId("dashboard-activity-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS("z-index", "220");

    const item = panel.locator('[data-activity-id="worker-unavailable"]');
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute("data-action-state", "idle");

    const action = item.getByTestId("dashboard-activity-action");
    const syncPostRequest = page.waitForRequest(
        (request) =>
            request.url().includes("/api/data-sources/sync") &&
            request.method() === "POST",
    );
    await action.click();
    await syncPostRequest;
    await expect(item).toHaveAttribute("data-action-state", "busy");
    await expect(action).toHaveAttribute("aria-busy", "true");

    releasePost();

    await expect(item).toHaveAttribute("data-action-state", "done");
    await expect(action).toContainText("已加入更新");

    await item.getByTestId("dashboard-activity-dismiss").click();
    await expect(item).toBeHidden();

    let remainingDismissActions = await panel
        .getByTestId("dashboard-activity-dismiss")
        .count();
    while (remainingDismissActions > 0) {
        await panel.getByTestId("dashboard-activity-dismiss").first().click();
        remainingDismissActions = await panel
            .getByTestId("dashboard-activity-dismiss")
            .count();
    }

    await expect(page.getByTestId("dashboard-activity-empty")).toBeVisible();
    await expect(panel).toContainText("全部已处理");
    await expect(panel).toContainText("没有新的动态");
});
