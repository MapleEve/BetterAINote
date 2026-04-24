import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

test("playback settings update speed and autoplay, then persist after reload", async ({
    page,
}) => {
    await ensureSignedIn(page);

    await page.goto("/settings#playback", { waitUntil: "domcontentloaded" });

    const playbackSpeedTrigger = page.locator("#playback-speed");
    const autoPlaySwitch = page.locator("#auto-play-next");
    const playbackHeading = page.getByRole("heading", {
        name: /^(播放设置|Playback Settings)$/,
    });

    await expect(playbackHeading).toBeVisible();
    await expect(playbackSpeedTrigger).toContainText("1x");
    await expect(autoPlaySwitch).toHaveAttribute("data-state", "unchecked");
    await expect(page).toHaveURL(/\/settings#playback$/);

    let firstRequestBody: Record<string, unknown> | null = null;
    let releasePendingUpdate = () => {};
    let notifyUpdateStarted = () => {};
    const updateStarted = new Promise<void>((resolve) => {
        notifyUpdateStarted = resolve;
    });
    const pendingUpdate = new Promise<void>((resolve) => {
        releasePendingUpdate = resolve;
    });
    let delayNextPlaybackPut = true;

    await page.route("**/api/settings/playback", async (route) => {
        if (
            route.request().method() !== "PUT" ||
            !delayNextPlaybackPut
        ) {
            await route.continue();
            return;
        }

        delayNextPlaybackPut = false;
        firstRequestBody = route.request().postDataJSON();
        notifyUpdateStarted();
        await pendingUpdate;
        await route.continue();
    });

    await playbackSpeedTrigger.click();
    await page.getByRole("option", { name: "1.5x", exact: true }).click();

    await updateStarted;
    expect(firstRequestBody).toEqual({ defaultPlaybackSpeed: 1.5 });
    await expect(playbackSpeedTrigger).toContainText("1.5x");

    releasePendingUpdate();

    await page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/playback") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.defaultPlaybackSpeed === 1.5,
    );

    const autoPlayRequestPromise = page.waitForRequest(
        (request) =>
            request.url().includes("/api/settings/playback") &&
            request.method() === "PUT" &&
            request.postDataJSON()?.autoPlayNext === true,
    );
    const autoPlayResponsePromise = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/playback") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.autoPlayNext === true,
    );

    await autoPlaySwitch.click();

    const autoPlayRequest = await autoPlayRequestPromise;
    expect(autoPlayRequest.postDataJSON()).toEqual({ autoPlayNext: true });
    await autoPlayResponsePromise;
    await expect(autoPlaySwitch).toHaveAttribute("data-state", "checked");

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(playbackHeading).toBeVisible();
    await expect(playbackSpeedTrigger).toContainText("1.5x");
    await expect(autoPlaySwitch).toHaveAttribute("data-state", "checked");
});
