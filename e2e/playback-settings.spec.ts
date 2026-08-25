import { expect, type Locator, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    chooseShadcnSelectOption,
    expectShadcnSelectTrigger,
} from "./helpers/shadcn-select";

function settingsShell(page: Page) {
    return page.getByRole("dialog", { name: /^(设置|Settings)$/ });
}

function settingsSection(page: Page) {
    return page.getByRole("region", { name: /^(杂项|Misc)$/ });
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

async function expectShadcnSliderValue(slider: Locator, value: number) {
    await expect(slider).toHaveAttribute("data-slot", "slider");
    await expect(slider.getByRole("slider")).toHaveAttribute(
        "aria-valuenow",
        String(value),
    );
}

async function setShadcnSliderValue(page: Page, slider: Locator, value: number) {
    await slider.scrollIntoViewIfNeeded();

    const box = await slider.boundingBox();
    if (!box) {
        throw new Error("Unable to locate shadcn slider bounds");
    }

    await page.mouse.click(
        box.x + (box.width * value) / 100,
        box.y + box.height / 2,
    );
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
    const section = settingsSection(page);
    const syncSwitch = section.locator("#sync-auto-enabled");
    const syncIntervalInput = section.locator("#sync-interval-seconds");
    const playbackSpeedSelect = section.locator("#playback-speed");
    const autoPlaySwitch = section.locator("#playback-auto-next");
    const volumeSlider = section.locator("#playback-volume");
    const miscHeading = section.getByRole("heading", {
        name: /^(杂项|Misc)$/,
        exact: true,
    });
    const playbackTitle = section.getByRole("heading", {
        name: /^(播放设置|Playback Settings)$/,
        exact: true,
    });

    await expect(shell).toBeVisible();
    await expect(section).toHaveAttribute("aria-busy", "false");
    await expect(miscHeading).toBeVisible();
    await expect(playbackTitle).toBeVisible();
    await expect(section.locator("[data-save-actions]")).toHaveCount(0);
    await expect(section.locator("[data-save-action]")).toHaveCount(0);
    await expect(
        section.getByRole("button", { name: /^(保存|Save)$/ }),
    ).toHaveCount(0);
    await expect(syncSwitch).toHaveAttribute("aria-checked", "true");
    await expect(syncIntervalInput).toHaveValue("300");
    await expectShadcnSelectTrigger(playbackSpeedSelect, {
        label: "默认速度",
        text: "1x",
    });
    await expectShadcnSliderValue(volumeSlider, 75);
    await expect(autoPlaySwitch).toHaveAttribute("aria-checked", "false");
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
    await expect(syncSwitch).toHaveAttribute("aria-checked", "false");

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
    await chooseShadcnSelectOption(page, playbackSpeedSelect, "1.5x");
    await speedResponse;
    await expectShadcnSelectTrigger(playbackSpeedSelect, {
        label: "默认速度",
        text: "1.5x",
    });

    const volumeResponse = waitForSettingsPut(
        page,
        "/api/settings/playback",
        (payload) =>
            payload.defaultVolume === 42 &&
            Object.keys(payload).length === 1,
    );
    await setShadcnSliderValue(page, volumeSlider, 42);
    await volumeResponse;
    await expectShadcnSliderValue(volumeSlider, 42);

    const autoNextResponse = waitForSettingsPut(
        page,
        "/api/settings/playback",
        (payload) =>
            payload.autoPlayNext === true &&
            Object.keys(payload).length === 1,
    );
    await autoPlaySwitch.click();
    await autoNextResponse;
    await expect(autoPlaySwitch).toHaveAttribute("aria-checked", "true");
    await expect(section).toHaveAttribute("aria-busy", "false");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(settingsShell(page)).toBeVisible();
    await expect(miscHeading).toBeVisible();
    await expect(playbackTitle).toBeVisible();
    await expect(syncSwitch).toHaveAttribute("aria-checked", "false");
    await expect(syncIntervalInput).toHaveValue("120");
    await expectShadcnSelectTrigger(playbackSpeedSelect, {
        label: "默认速度",
        text: "1.5x",
    });
    await expectShadcnSliderValue(volumeSlider, 42);
    await expect(autoPlaySwitch).toHaveAttribute("aria-checked", "true");
    await expect(section.locator("[data-save-actions]")).toHaveCount(0);
    await expect(section.locator("[data-save-action]")).toHaveCount(0);
});
