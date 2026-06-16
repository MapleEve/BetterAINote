import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

function settingsShell(page: Page) {
    return page.locator('[data-sot-surface="settings-shell"]');
}

function settingsSection(page: Page, section: string) {
    return page.locator(
        `[data-sot-surface="settings-section"][data-sot-section="${section}"]`,
    );
}

function waitForSettingsPut(
    page: Page,
    endpoint: string,
    matchesPayload: (payload: Record<string, unknown>) => boolean,
) {
    return page.waitForResponse((response) => {
        if (
            !response.url().includes(endpoint) ||
            response.request().method() !== "PUT" ||
            !response.ok()
        ) {
            return false;
        }

        const payload = response.request().postDataJSON();
        return (
            typeof payload === "object" &&
            payload !== null &&
            matchesPayload(payload as Record<string, unknown>)
        );
    });
}

test("misc settings persist sync and playback controls immediately, then reload", async ({
    page,
}) => {
    await ensureSignedIn(page);

    const resetSyncResponse = await page.request.put("/api/settings/sync", {
        data: {
            autoSyncEnabled: true,
            syncIntervalSeconds: 300,
        },
    });
    expect(resetSyncResponse.ok()).toBe(true);

    const resetResponse = await page.request.put("/api/settings/playback", {
        data: {
            autoPlayNext: false,
            defaultPlaybackSpeed: 1,
            defaultVolume: 75,
        },
    });
    expect(resetResponse.ok()).toBe(true);

    await page.goto("/settings#misc", { waitUntil: "domcontentloaded" });

    const shell = settingsShell(page);
    const section = settingsSection(page, "misc");
    const syncSwitch = section.locator(
        '[data-sot-control="sync-auto-enabled"]',
    );
    const syncIntervalInput = section.locator(
        '[data-sot-control="sync-interval-seconds"]',
    );
    const playbackSpeedSelect = section.locator(
        '[data-sot-control="playback-speed"]',
    );
    const autoPlaySwitch = section.locator(
        '[data-sot-control="playback-auto-next"]',
    );
    const volumeInput = section.locator(
        '[data-sot-control="playback-volume"]',
    );
    const miscHeading = section.getByRole("heading", {
        name: /^(杂项|Misc)$/,
        exact: true,
    });
    const playbackTitle = section.getByRole("heading", {
        name: /^(播放设置|Playback Settings)$/,
        exact: true,
    });

    await expect(shell).toHaveAttribute("data-sot-section", "misc");
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(section).toHaveAttribute("aria-busy", "false");
    await expect(miscHeading).toBeVisible();
    await expect(playbackTitle).toBeVisible();
    await expect(section.locator("[data-save-actions]")).toHaveCount(0);
    await expect(section.locator("[data-save-action]")).toHaveCount(0);
    await expect(
        section.locator('[data-sot-control="settings-save"]'),
    ).toHaveCount(0);
    await expect(syncSwitch).toHaveAttribute("data-sot-state", "checked");
    await expect(syncIntervalInput).toHaveValue("300");
    await expect(playbackSpeedSelect).toHaveValue("1");
    await expect(playbackSpeedSelect).toHaveAttribute(
        "data-sot-state",
        "ready",
    );
    await expect(volumeInput).toHaveValue("75");
    await expect(volumeInput).toHaveAttribute("data-sot-state", "ready");
    await expect(autoPlaySwitch).toHaveAttribute(
        "data-sot-state",
        "unchecked",
    );
    await expect(page).toHaveURL(/\/settings#misc$/);

    const syncToggleResponse = waitForSettingsPut(
        page,
        "/api/settings/sync",
        (payload) =>
            payload.autoSyncEnabled === false &&
            Object.keys(payload).length === 1,
    );
    await syncSwitch.click();
    await syncToggleResponse;
    await expect(syncSwitch).toHaveAttribute("data-sot-state", "unchecked");

    const syncIntervalResponse = waitForSettingsPut(
        page,
        "/api/settings/sync",
        (payload) =>
            payload.syncIntervalSeconds === 120 &&
            Object.keys(payload).length === 1,
    );
    await syncIntervalInput.fill("120");
    await syncIntervalInput.blur();
    await syncIntervalResponse;
    await expect(syncIntervalInput).toHaveValue("120");

    const speedResponse = waitForSettingsPut(
        page,
        "/api/settings/playback",
        (payload) =>
            payload.defaultPlaybackSpeed === 1.5 &&
            Object.keys(payload).length === 1,
    );
    await playbackSpeedSelect.selectOption("1.5");
    await speedResponse;
    await expect(playbackSpeedSelect).toHaveValue("1.5");

    const volumeResponse = waitForSettingsPut(
        page,
        "/api/settings/playback",
        (payload) =>
            payload.defaultVolume === 42 &&
            Object.keys(payload).length === 1,
    );
    await volumeInput.evaluate((node) => {
        const input = node as HTMLInputElement;
        const valueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
        )?.set;
        valueSetter?.call(input, "42");
        input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await volumeResponse;
    await expect(volumeInput).toHaveValue("42");

    const autoNextResponse = waitForSettingsPut(
        page,
        "/api/settings/playback",
        (payload) =>
            payload.autoPlayNext === true &&
            Object.keys(payload).length === 1,
    );
    await autoPlaySwitch.click();
    await autoNextResponse;
    await expect(autoPlaySwitch).toHaveAttribute("data-sot-state", "checked");
    await expect(section).toHaveAttribute("data-sot-state", "ready");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(settingsShell(page)).toHaveAttribute(
        "data-sot-section",
        "misc",
    );
    await expect(miscHeading).toBeVisible();
    await expect(playbackTitle).toBeVisible();
    await expect(syncSwitch).toHaveAttribute("data-sot-state", "unchecked");
    await expect(syncIntervalInput).toHaveValue("120");
    await expect(playbackSpeedSelect).toHaveValue("1.5");
    await expect(volumeInput).toHaveValue("42");
    await expect(autoPlaySwitch).toHaveAttribute("data-sot-state", "checked");
    await expect(section.locator("[data-save-actions]")).toHaveCount(0);
    await expect(section.locator("[data-save-action]")).toHaveCount(0);
});
