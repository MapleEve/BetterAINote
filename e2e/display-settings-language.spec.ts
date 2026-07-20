import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn, putJsonWithRetry } from "./helpers/auth";
import {
    chooseShadcnSelectOption,
    expectShadcnSelectTrigger,
} from "./helpers/shadcn-select";

type DisplaySettings = {
    dateTimeFormat: "absolute" | "relative";
    displayDensity: "comfy" | "compact";
    itemsPerPage: number;
    recordingListSortOrder: "name" | "newest" | "oldest";
    theme: "dark" | "light" | "system";
    uiLanguage: "en" | "zh-CN";
};

const DISPLAY_SETTINGS_ENDPOINT = "/api/settings/display";
const DISPLAY_SECTION_TITLE = /^(显示设置|Display Settings)$/;
const DISPLAY_CONTROL_LABELS = {
    density: /^(信息密度|Information density)$/,
    theme: /^(主题|Theme)$/,
    "time-style": /^(时间显示|Time display)$/,
} as const;
const DISPLAY_SEGMENT_LABELS = {
    absolute: /^14:00$/,
    compact: /^(紧凑|Compact)$/,
    comfy: /^(宽松|Comfy)$/,
    dark: /^(深色|Dark)$/,
    light: /^(浅色|Light)$/,
    relative: /^(2 小时前|2 hours ago)$/,
} as const;
const TEST_BASELINE: DisplaySettings = {
    dateTimeFormat: "relative",
    displayDensity: "comfy",
    itemsPerPage: 50,
    recordingListSortOrder: "newest",
    theme: "light",
    uiLanguage: "zh-CN",
};

async function getDisplaySettings(page: Page): Promise<DisplaySettings> {
    const response = await page.request.get(DISPLAY_SETTINGS_ENDPOINT);
    expect(response.ok()).toBe(true);
    return (await response.json()) as DisplaySettings;
}

async function putDisplaySettings(
    page: Page,
    settings: DisplaySettings,
): Promise<void> {
    const response = await putJsonWithRetry(
        page,
        DISPLAY_SETTINGS_ENDPOINT,
        settings,
    );
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ success: true });
}

function settingsShell(page: Page) {
    return page.locator('[data-slot="dialog-content"]');
}

function displaySection(page: Page) {
    return settingsShell(page)
        .getByRole("heading", { name: DISPLAY_SECTION_TITLE })
        .locator("..");
}

function displaySegment(
    page: Page,
    control: keyof typeof DISPLAY_CONTROL_LABELS,
    value: keyof typeof DISPLAY_SEGMENT_LABELS,
) {
    return displaySection(page)
        .getByRole("radiogroup", { name: DISPLAY_CONTROL_LABELS[control] })
        .getByRole("radio", { name: DISPLAY_SEGMENT_LABELS[value] });
}

async function expectDisplaySegmentSelected(
    page: Page,
    control: keyof typeof DISPLAY_CONTROL_LABELS,
    value: keyof typeof DISPLAY_SEGMENT_LABELS,
) {
    const segment = displaySegment(page, control, value);
    await expect(segment).toHaveAttribute("role", "radio");
    await expect(segment).toHaveAttribute("aria-checked", "true");
    await expect(segment).toHaveAttribute("data-state", "on");
}

async function startBusyToReadyObservation(page: Page) {
    await displaySection(page).evaluate((section) => {
        const observationKey = "__displaySettingsBusyToReady";
        let sawBusy = section.getAttribute("aria-busy") === "true";
        const transition = new Promise<boolean>((resolve, reject) => {
            let timeout: number;
            const observer = new MutationObserver(() => {
                const isBusy = section.getAttribute("aria-busy") === "true";
                if (isBusy) {
                    sawBusy = true;
                    return;
                }

                if (sawBusy) {
                    window.clearTimeout(timeout);
                    observer.disconnect();
                    resolve(true);
                }
            });

            timeout = window.setTimeout(() => {
                observer.disconnect();
                reject(
                    new Error(
                        "Display settings did not transition from busy to ready",
                    ),
                );
            }, 10_000);
            observer.observe(section, {
                attributeFilter: ["aria-busy"],
                attributes: true,
            });
        });

        Reflect.set(window, observationKey, transition);
    });
}

async function waitForBusyToReadyObservation(page: Page) {
    return page.evaluate(async () => {
        const transition = Reflect.get(
            window,
            "__displaySettingsBusyToReady",
        ) as Promise<boolean> | undefined;
        if (!transition) {
            throw new Error("Display settings state observation was not started");
        }
        return transition;
    });
}

async function persistSegment(
    page: Page,
    control: string,
    value: string,
    payload: Record<string, unknown>,
) {
    const requestPromise = page.waitForRequest(
        (request) =>
            request.url().endsWith(DISPLAY_SETTINGS_ENDPOINT) &&
            request.method() === "PUT" &&
            Object.entries(payload).every(
                ([key, expected]) => request.postDataJSON()?.[key] === expected,
            ),
    );
    const responsePromise = page.waitForResponse(
        (response) =>
            response.url().endsWith(DISPLAY_SETTINGS_ENDPOINT) &&
            response.request().method() === "PUT" &&
            Object.entries(payload).every(
                ([key, expected]) =>
                    response.request().postDataJSON()?.[key] === expected,
            ),
    );

    await startBusyToReadyObservation(page);
    await displaySegment(page, control, value).click();

    const [request, response, transitioned] = await Promise.all([
        requestPromise,
        responsePromise,
        waitForBusyToReadyObservation(page),
    ]);
    expect(request.postDataJSON()).toEqual(payload);
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ success: true });
    expect(transitioned).toBe(true);
    await expectDisplaySegmentSelected(page, control, value);
}

test("appearance settings persist through the real API and survive reload", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });
    await ensureSignedIn(page);

    const originalSettings = await getDisplaySettings(page);

    try {
        await putDisplaySettings(page, TEST_BASELINE);
        expect(await getDisplaySettings(page)).toEqual(TEST_BASELINE);

        const initialSettingsGet = page.waitForResponse(
            (response) =>
                response.url().endsWith(DISPLAY_SETTINGS_ENDPOINT) &&
                response.request().method() === "GET" &&
                response.ok(),
        );
        await page.goto("/settings#appearance", {
            waitUntil: "domcontentloaded",
        });
        expect(await (await initialSettingsGet).json()).toEqual(TEST_BASELINE);

        const section = displaySection(page);
        await expect(settingsShell(page)).toHaveAttribute(
            "data-slot",
            "dialog-content",
        );
        await expect(settingsShell(page)).toHaveAttribute("aria-busy", "false");
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expectDisplaySegmentSelected(page, "theme", "light");
        await expectDisplaySegmentSelected(page, "density", "comfy");
        await expectDisplaySegmentSelected(page, "time-style", "relative");
        await expectShadcnSelectTrigger(
            section.getByRole("combobox", { name: "界面语言" }),
            { label: "界面语言", text: "简体中文" },
        );

        await persistSegment(page, "theme", "dark", { theme: "dark" });
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "dark",
        );
        expect(await getDisplaySettings(page)).toMatchObject({ theme: "dark" });

        await persistSegment(page, "density", "compact", {
            displayDensity: "compact",
        });
        expect(await getDisplaySettings(page)).toMatchObject({
            displayDensity: "compact",
        });

        await persistSegment(page, "time-style", "absolute", {
            dateTimeFormat: "absolute",
        });
        expect(await getDisplaySettings(page)).toMatchObject({
            dateTimeFormat: "absolute",
        });

        const languageRequest = page.waitForRequest(
            (request) =>
                request.url().endsWith(DISPLAY_SETTINGS_ENDPOINT) &&
                request.method() === "PUT" &&
                request.postDataJSON()?.uiLanguage === "en",
        );
        const languageResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith(DISPLAY_SETTINGS_ENDPOINT) &&
                response.request().method() === "PUT" &&
                response.request().postDataJSON()?.uiLanguage === "en",
        );
        await startBusyToReadyObservation(page);
        await chooseShadcnSelectOption(
            page,
            section.getByRole("combobox", { name: "界面语言" }),
            "English",
        );
        const [request, response, transitioned] = await Promise.all([
            languageRequest,
            languageResponse,
            waitForBusyToReadyObservation(page),
        ]);
        expect(request.postDataJSON()).toEqual({ uiLanguage: "en" });
        expect(response.ok()).toBe(true);
        expect(await response.json()).toEqual({ success: true });
        expect(transitioned).toBe(true);
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expectShadcnSelectTrigger(
            section.getByRole("combobox", { name: "Interface language" }),
            { label: "Interface language", text: "English" },
        );
        expect(await getDisplaySettings(page)).toEqual({
            ...TEST_BASELINE,
            dateTimeFormat: "absolute",
            displayDensity: "compact",
            theme: "dark",
            uiLanguage: "en",
        });

        const reloadSettingsGet = page.waitForResponse(
            (response) =>
                response.url().endsWith(DISPLAY_SETTINGS_ENDPOINT) &&
                response.request().method() === "GET" &&
                response.ok(),
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await reloadSettingsGet;
        await expect(displaySection(page)).toHaveAttribute("aria-busy", "false");
        await expectDisplaySegmentSelected(page, "theme", "dark");
        await expectDisplaySegmentSelected(page, "density", "compact");
        await expectDisplaySegmentSelected(page, "time-style", "absolute");
        await expectShadcnSelectTrigger(
            displaySection(page).getByRole("combobox", {
                name: "Interface language",
            }),
            { label: "Interface language", text: "English" },
        );
    } finally {
        await putDisplaySettings(page, originalSettings);
        expect(await getDisplaySettings(page)).toEqual(originalSettings);
    }
});
