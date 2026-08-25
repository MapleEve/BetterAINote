import {
    expect,
    type Page,
    type Request,
    type Response,
    test,
} from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const DISPLAY_SETTINGS_ENDPOINT = "/api/settings/display";
const THEME_NETWORK_LATENCY_MS = 3_000;
const THEMES = ["system", "light", "dark"] as const;
type Theme = (typeof THEMES)[number];

function isTheme(value: unknown): value is Theme {
    return (
        typeof value === "string" &&
        (THEMES as readonly string[]).includes(value)
    );
}

function isDisplaySettingsRequest(request: Request, method: "GET" | "PUT") {
    return (
        request.url().endsWith(DISPLAY_SETTINGS_ENDPOINT) &&
        request.method() === method
    );
}

function isThemePutRequest(request: Request, theme: Theme) {
    return (
        isDisplaySettingsRequest(request, "PUT") &&
        request.postDataJSON()?.theme === theme
    );
}

async function readPersistedTheme(page: Page): Promise<Theme> {
    const response = await page.request.get(DISPLAY_SETTINGS_ENDPOINT);
    expect(response.ok()).toBe(true);

    const payload: unknown = await response.json();
    const theme =
        typeof payload === "object" && payload !== null
            ? (payload as { theme?: unknown }).theme
            : undefined;

    if (!isTheme(theme)) {
        throw new Error("Display settings API returned an unsupported theme.");
    }

    return theme;
}

async function writePersistedTheme(page: Page, theme: Theme) {
    const response = await page.request.put(DISPLAY_SETTINGS_ENDPOINT, {
        data: { theme },
    });

    expect(response.ok()).toBe(true);
    expect(await readPersistedTheme(page)).toBe(theme);
}

async function setNetworkLatency(page: Page, latency: number) {
    const session = await page.context().newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.emulateNetworkConditions", {
        downloadThroughput: -1,
        latency,
        offline: false,
        uploadThroughput: -1,
    });
    return session;
}

async function verifyPersistedThemeToggle(page: Page, targetTheme: Theme) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const signedInDisplayGet = page.waitForResponse(
        (response) =>
            isDisplaySettingsRequest(response.request(), "GET") &&
            response.ok(),
    );
    await ensureSignedIn(page);
    await signedInDisplayGet;

    const originalTheme = await readPersistedTheme(page);
    const initialTheme: Theme = targetTheme === "dark" ? "light" : "dark";
    const events: string[] = [];
    let initialGetCompleted = false;
    let networkSession: Awaited<ReturnType<typeof setNetworkLatency>> | null =
        null;

    const onRequest = (request: Request) => {
        if (isDisplaySettingsRequest(request, "GET")) {
            events.push("GET request");
        }
        if (isThemePutRequest(request, targetTheme)) {
            events.push("PUT request");
        }
    };
    const onResponse = (response: Response) => {
        if (isDisplaySettingsRequest(response.request(), "GET")) {
            initialGetCompleted = true;
            events.push("GET response");
        }
        if (isThemePutRequest(response.request(), targetTheme)) {
            events.push("PUT response");
        }
    };

    let primaryError: unknown;
    page.on("request", onRequest);
    page.on("response", onResponse);

    try {
        await writePersistedTheme(page, initialTheme);
        networkSession = await setNetworkLatency(
            page,
            THEME_NETWORK_LATENCY_MS,
        );

        const initialGetRequest = page.waitForRequest((request) =>
            isDisplaySettingsRequest(request, "GET"),
        );
        const initialGetResponse = page.waitForResponse(
            (response) =>
                isDisplaySettingsRequest(response.request(), "GET") &&
                response.ok(),
        );
        const themePutResponse = page.waitForResponse(
            (response) =>
                isThemePutRequest(response.request(), targetTheme) &&
                response.ok(),
        );

        await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
        await initialGetRequest;

        const themeToggle = page.locator('[data-control="app-theme-toggle"]');
        await expect(themeToggle).toBeEnabled({ timeout: 1_000 });
        expect(initialGetCompleted).toBe(false);

        events.push("theme click");
        await themeToggle.click();
        expect(initialGetCompleted).toBe(false);

        await initialGetResponse;
        await themePutResponse;
        expect(events).toEqual([
            "GET request",
            "theme click",
            "GET response",
            "PUT request",
            "PUT response",
        ]);
        await expect(themeToggle).toHaveAttribute("data-state", targetTheme);
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            targetTheme,
        );
        expect(await readPersistedTheme(page)).toBe(targetTheme);

        await networkSession.send("Network.emulateNetworkConditions", {
            downloadThroughput: -1,
            latency: 0,
            offline: false,
            uploadThroughput: -1,
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(themeToggle).toHaveAttribute("data-state", targetTheme);
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            targetTheme,
        );
        expect(await readPersistedTheme(page)).toBe(targetTheme);
    } catch (error) {
        primaryError = error;
    }

    page.off("request", onRequest);
    page.off("response", onResponse);

    const cleanupErrors: unknown[] = [];
    if (networkSession) {
        try {
            await networkSession.send("Network.emulateNetworkConditions", {
                downloadThroughput: -1,
                latency: 0,
                offline: false,
                uploadThroughput: -1,
            });
            await networkSession.detach();
        } catch (error) {
            cleanupErrors.push(error);
        }
    }

    try {
        await writePersistedTheme(page, originalTheme);
    } catch (error) {
        cleanupErrors.push(error);
    }

    if (primaryError || cleanupErrors.length > 0) {
        throw new AggregateError(
            [primaryError, ...cleanupErrors].filter(Boolean),
            `Theme ${targetTheme} scenario or persisted-setting cleanup failed.`,
        );
    }
}

test("app route shell supports desktop navigation and a persisted collapsed sidebar", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ensureSignedIn(page);
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });

    const shell = page.locator('[data-control="app-route-shell"]');
    const collapse = page.locator('[data-control="app-sidebar-collapse"]');

    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute("data-hydrated", "true");
    await expect(
        page.getByRole("navigation", { name: "主导航" }),
    ).toBeVisible();
    await collapse.click();
    await expect(shell).toHaveAttribute("data-state", "collapsed");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(shell).toHaveAttribute("data-state", "collapsed");

    await page.getByRole("link", { exact: true, name: "录音库" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
});

for (const targetTheme of ["light", "dark"] as const) {
    test(`app route shell persists ${targetTheme} after a click during the initial real GET`, async ({
        page,
    }) => {
        await verifyPersistedThemeToggle(page, targetTheme);
    });
}

test("app route shell mobile Sheet traps focus and restores its trigger on Escape", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureSignedIn(page);
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });

    const trigger = page.locator(
        '[data-control="app-mobile-navigation-trigger"]',
    );
    const sheet = page.locator('[data-control="app-mobile-navigation-sheet"]');

    await expect(
        page.locator('[data-control="app-route-shell"]'),
    ).toHaveAttribute("data-hydrated", "true");
    await trigger.focus();
    await trigger.press("Enter");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("data-state", "open");
    await expect(sheet.locator(":focus")).toHaveCount(1);
    await expect(sheet.getByRole("link", { name: "设置" })).toBeVisible();

    const focusable = sheet.locator(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const focusableCount = await focusable.count();
    expect(focusableCount).toBeGreaterThan(1);
    for (let index = 0; index <= focusableCount; index += 1) {
        await page.keyboard.press("Tab");
        await expect(sheet.locator(":focus")).toHaveCount(1);
    }
    await page.keyboard.press("Shift+Tab");
    await expect(sheet.locator(":focus")).toHaveCount(1);

    const [sheetBox, settingsLinkBox, titleBox] = await Promise.all([
        sheet.boundingBox(),
        sheet.getByRole("link", { name: "设置" }).boundingBox(),
        page.locator('[data-control="app-route-title"]').boundingBox(),
    ]);

    expect(sheetBox).not.toBeNull();
    expect(settingsLinkBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(settingsLinkBox?.x).toBeGreaterThanOrEqual(sheetBox?.x ?? 0);
    expect(
        (settingsLinkBox?.x ?? 0) + (settingsLinkBox?.width ?? 0),
    ).toBeLessThanOrEqual((sheetBox?.x ?? 0) + (sheetBox?.width ?? 0));
    expect((titleBox?.x ?? 0) + (titleBox?.width ?? 0)).toBeLessThanOrEqual(
        390,
    );

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
});

test("app route shell uses the mobile navigation layout through the tablet breakpoint", async ({
    page,
}) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await ensureSignedIn(page);
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });

    const trigger = page.locator(
        '[data-control="app-mobile-navigation-trigger"]',
    );
    const collapse = page.locator('[data-control="app-sidebar-collapse"]');
    const title = page.locator('[data-control="app-route-title"]');

    await expect(
        page.locator('[data-control="app-route-shell"]'),
    ).toHaveAttribute("data-hydrated", "true");
    await expect(trigger).toBeVisible();
    await expect(collapse).toBeHidden();

    const titleBox = await title.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(titleBox?.x).toBeLessThan(120);

    await trigger.click();
    const sheet = page.locator('[data-control="app-mobile-navigation-sheet"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(":focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
});
