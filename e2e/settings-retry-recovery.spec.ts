import { expect, type Locator, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const TITLE_GENERATION_ENDPOINT = "/api/settings/title-generation";
const TITLE_GENERATION_ROUTE = `**${TITLE_GENERATION_ENDPOINT}`;
const FORCED_FAILURE_MESSAGE =
    "E2E title generation settings request failed once";

type TitleGenerationSettingsReadback = {
    autoGenerateTitle: boolean;
    titleGenerationApiKeySet: boolean;
    titleGenerationBaseUrl: string | null;
    titleGenerationModel: string | null;
    titleGenerationPrompt: string | null;
};

function settingsDialog(page: Page) {
    return page.getByRole("dialog", { name: /^(设置|Settings)$/ });
}

function settingRow(dialog: Locator, label: RegExp) {
    return dialog
        .getByText(label, { exact: true })
        .locator("xpath=ancestor::*[.//input or .//*[@role='switch']][1]");
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
        throw new Error(
            "Title generation settings API returned an invalid payload.",
        );
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
    let retryRequested = false;
    let initialFailureGetCount = 0;
    let postRetryGetCount = 0;
    let postRetryRealGetCount = 0;
    let routeInstalled = false;

    try {
        await ensureSignedIn(page);
        const backendBeforeFailure = await readTitleGenerationSettings(page);

        await page.route(TITLE_GENERATION_ROUTE, async (route) => {
            if (route.request().method() !== "GET") {
                await route.continue();
                return;
            }

            const requestPhase = retryRequested
                ? "retry"
                : "initial-failure";
            if (requestPhase === "initial-failure") {
                initialFailureGetCount += 1;
                await initialRequestBlocked;
                await route.fulfill({
                    body: JSON.stringify({ error: FORCED_FAILURE_MESSAGE }),
                    contentType: "application/json",
                    status: 503,
                });
                return;
            }

            postRetryGetCount += 1;
            if (postRetryGetCount === 1) {
                // Exactly one post-click retry must reach the product API.
                postRetryRealGetCount += 1;
                await route.continue();
                return;
            }

            await route.fulfill({
                body: JSON.stringify({
                    error: "Unexpected extra title generation settings retry",
                }),
                contentType: "application/json",
                status: 503,
            });
        });
        routeInstalled = true;

        await page.goto("/settings#title-generation", {
            waitUntil: "domcontentloaded",
        });

        const dialog = settingsDialog(page);
        await expect(dialog).toBeVisible();
        const loadingStatus = page.getByRole("status", {
            name: /^(正在加载设置|Loading settings)$/,
            exact: true,
        });
        const loadingSection = loadingStatus.locator("..");
        await expect(loadingSection).toHaveAttribute("aria-busy", "true");
        await expect(loadingSection).toBeVisible();
        await expect(loadingStatus).toBeVisible();
        await expect(loadingStatus).toHaveAttribute("aria-live", "polite");
        await expect(
            loadingStatus.getByText(/^(正在加载设置|Loading settings)$/, {
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            loadingStatus.locator('[aria-hidden="true"]'),
        ).toBeVisible();

        releaseInitialRequest?.();

        const errorPanel = dialog
            .getByRole("alert")
            .filter({ hasText: /^(加载失败|Load failed)/ });
        const section = errorPanel.locator("xpath=ancestor::*[@aria-busy][1]");
        const retry = errorPanel.getByRole("button", {
            exact: true,
            name: /^(重试|Retry)$/,
        });
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expect(errorPanel).toBeVisible();
        await expect(errorPanel).toContainText(FORCED_FAILURE_MESSAGE);
        await expect(retry).toBeVisible();
        await expect(retry).toBeEnabled();
        await expect(
            dialog.getByText(/^(重命名模型|Rename model)$/, { exact: true }),
        ).toHaveCount(0);

        const retryResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
                url.pathname === TITLE_GENERATION_ENDPOINT &&
                response.request().method() === "GET" &&
                response.ok()
            );
        });
        retryRequested = true;
        await retry.click();
        const retryResponse = await retryResponsePromise;
        const retryPayload: unknown = await retryResponse.json();
        if (!isTitleGenerationSettingsReadback(retryPayload)) {
            throw new Error("Retry did not return title generation settings.");
        }

        const backendAfterRetry = await readTitleGenerationSettings(page);
        const phaseCounters = {
            initialFailureGetCount,
            postRetryGetCount,
            postRetryRealGetCount,
        };
        console.info(
            `[settings-retry-recovery] phase-counters ${JSON.stringify(phaseCounters)}`,
        );
        expect(initialFailureGetCount).toBeGreaterThanOrEqual(1);
        expect(postRetryGetCount).toBe(1);
        expect(postRetryRealGetCount).toBe(1);
        expect(retryPayload).toEqual(backendBeforeFailure);
        expect(backendAfterRetry).toEqual(retryPayload);

        const readyHeading = dialog.getByRole("heading", {
            level: 3,
            name: /^(AI 重命名服务|AI Rename Service)$/,
        });
        const readySection = readyHeading.locator(
            "xpath=ancestor::*[@aria-busy][1]",
        );
        await expect(readyHeading).toBeVisible();
        await expect(readySection).toHaveAttribute("aria-busy", "false");
        await expect(errorPanel).toHaveCount(0);
        const enabled = settingRow(
            dialog,
            /^(基于逐字稿自动重命名|Automatically rename from transcripts)$/,
        ).getByRole("switch");
        const baseUrl = settingRow(
            dialog,
            /^(重命名服务地址|Rename service URL)$/,
        ).getByRole("textbox");
        const model = settingRow(
            dialog,
            /^(重命名模型|Rename model)$/,
        ).getByRole("textbox");
        await expect(enabled).toHaveAttribute(
            "aria-checked",
            backendAfterRetry.autoGenerateTitle ? "true" : "false",
        );
        await expect(baseUrl).toHaveValue(
            backendAfterRetry.titleGenerationBaseUrl ?? "",
        );
        await expect(model).toHaveValue(
            backendAfterRetry.titleGenerationModel ?? "",
        );
    } finally {
        releaseInitialRequest?.();
        if (routeInstalled) {
            await page.unroute(TITLE_GENERATION_ROUTE);
        }
    }
});
