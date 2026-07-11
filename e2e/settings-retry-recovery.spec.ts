import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const TITLE_GENERATION_ENDPOINT = "/api/settings/title-generation";
const TITLE_GENERATION_ROUTE = `**${TITLE_GENERATION_ENDPOINT}`;
const FORCED_FAILURE_MESSAGE = "E2E title generation settings request failed once";

type TitleGenerationSettingsReadback = {
    autoGenerateTitle: boolean;
    titleGenerationApiKeySet: boolean;
    titleGenerationBaseUrl: string | null;
    titleGenerationModel: string | null;
    titleGenerationPrompt: string | null;
};

function titleGenerationSection(page: Page) {
    return page.locator(
        '[data-sot-surface="settings-section"][data-sot-section="title-generation"]',
    );
}

function isTitleGenerationSettingsReadback(
    payload: unknown,
): payload is TitleGenerationSettingsReadback {
    if (typeof payload !== "object" || payload === null) {
        return false;
    }

    const settings = payload as Record<string, unknown>;
    return (
        typeof settings.autoGenerateTitle === "boolean" &&
        typeof settings.titleGenerationApiKeySet === "boolean" &&
        (typeof settings.titleGenerationBaseUrl === "string" ||
            settings.titleGenerationBaseUrl === null) &&
        (typeof settings.titleGenerationModel === "string" ||
            settings.titleGenerationModel === null) &&
        (typeof settings.titleGenerationPrompt === "string" ||
            settings.titleGenerationPrompt === null)
    );
}

async function readTitleGenerationSettings(page: Page) {
    const response = await page.request.get(TITLE_GENERATION_ENDPOINT);
    expect(response.ok()).toBe(true);

    const payload: unknown = await response.json();
    if (!isTitleGenerationSettingsReadback(payload)) {
        throw new Error("Title generation settings API returned an invalid payload.");
    }

    return payload;
}

test("title generation settings recovers from one failed request on the real backend", async ({
    page,
}) => {
    let releaseInitialRequest: (() => void) | null = null;
    const initialRequestBlocked = new Promise<void>((resolve) => {
        releaseInitialRequest = resolve;
    });
    let forcedFailureCount = 0;
    let realRouteGetCount = 0;
    let routeInstalled = false;

    try {
        await ensureSignedIn(page);
        const backendBeforeFailure = await readTitleGenerationSettings(page);

        await page.route(TITLE_GENERATION_ROUTE, async (route) => {
            if (route.request().method() !== "GET") {
                await route.continue();
                return;
            }

            if (forcedFailureCount === 0) {
                forcedFailureCount += 1;
                await initialRequestBlocked;
                await route.fulfill({
                    body: JSON.stringify({ error: FORCED_FAILURE_MESSAGE }),
                    contentType: "application/json",
                    status: 503,
                });
                return;
            }

            // The retry must leave the fixture and reach the product API.
            realRouteGetCount += 1;
            await route.continue();
        });
        routeInstalled = true;

        await page.goto("/settings#title-generation", {
            waitUntil: "domcontentloaded",
        });

        const section = titleGenerationSection(page);
        const skeleton = page.locator(
            '[data-sot-panel="settings-section-skeleton"][data-sot-section="title-generation"]',
        );
        await expect(section).toBeVisible();
        await expect(section).toHaveAttribute("data-sot-state", "loading");
        await expect(section).toHaveAttribute("aria-busy", "true");
        await expect(skeleton).toBeVisible();
        await expect(skeleton).toHaveAttribute("data-sot-state", "loading");

        releaseInitialRequest?.();

        const errorPanel = section.locator(
            '[data-sot-panel="settings-section-load-error"][data-sot-section="title-generation"]',
        );
        const retry = section.locator(
            '[data-sot-control="settings-section-load-retry"][data-sot-section="title-generation"]',
        );
        await expect(section).toHaveAttribute("data-sot-state", "error");
        await expect(errorPanel).toBeVisible();
        await expect(errorPanel).toHaveAttribute("data-sot-tone", "err");
        await expect(errorPanel).toContainText(FORCED_FAILURE_MESSAGE);
        await expect(retry).toBeVisible();
        await expect(retry).toBeEnabled();
        await expect(
            section.locator('[data-sot-control="title-generation-model"]'),
        ).toHaveCount(0);

        const retryResponsePromise = page.waitForResponse(
            (response) => {
                const url = new URL(response.url());
                return (
                    url.pathname === TITLE_GENERATION_ENDPOINT &&
                    response.request().method() === "GET" &&
                    response.ok()
                );
            },
        );
        await retry.click();
        const retryResponse = await retryResponsePromise;
        const retryPayload: unknown = await retryResponse.json();
        if (!isTitleGenerationSettingsReadback(retryPayload)) {
            throw new Error("Retry did not return title generation settings.");
        }

        const backendAfterRetry = await readTitleGenerationSettings(page);
        expect(forcedFailureCount).toBe(1);
        expect(realRouteGetCount).toBe(1);
        expect(retryPayload).toEqual(backendBeforeFailure);
        expect(backendAfterRetry).toEqual(retryPayload);

        await expect(section).toHaveAttribute("data-sot-state", "ready");
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expect(errorPanel).toHaveCount(0);
        await expect(
            section.locator('[data-sot-control="title-generation-enabled"]'),
        ).toHaveAttribute(
            "aria-checked",
            backendAfterRetry.autoGenerateTitle ? "true" : "false",
        );
        await expect(
            section.locator('[data-sot-control="title-generation-base-url"]'),
        ).toHaveValue(backendAfterRetry.titleGenerationBaseUrl ?? "");
        await expect(
            section.locator('[data-sot-control="title-generation-model"]'),
        ).toHaveValue(backendAfterRetry.titleGenerationModel ?? "");
    } finally {
        releaseInitialRequest?.();
        if (routeInstalled) {
            await page.unroute(TITLE_GENERATION_ROUTE);
        }
    }
});
