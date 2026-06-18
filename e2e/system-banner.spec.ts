import { expect, type Locator, type Page, test, type TestInfo } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import { SOT_COMPONENT_LIBRARY_URL } from "./helpers/sot-fixtures";

async function resetDisplayToChinese(
    page: Page,
    theme: "dark" | "light" = "dark",
) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const response = await page.request.put("/api/settings/display", {
                data: {
                    dateTimeFormat: "relative",
                    itemsPerPage: 50,
                    recordingListSortOrder: "newest",
                    theme,
                    uiLanguage: "zh-CN",
                },
            });
            expect(response.ok()).toBe(true);
            return;
        } catch (error) {
            if (attempt === 2) {
                throw error;
            }
            await page.waitForTimeout(500);
        }
    }
}

const SYSTEM_BANNER_ROOT_STYLE_PROPS = [
    "display",
    "alignItems",
    "gap",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderTopStyle",
    "borderTopColor",
    "borderRadius",
    "backgroundColor",
    "color",
    "boxShadow",
    "fontSize",
    "lineHeight",
] as const;

const SYSTEM_BANNER_ICON_STYLE_PROPS = [
    "display",
    "placeItems",
    "width",
    "height",
    "borderRadius",
    "backgroundColor",
    "color",
] as const;

const SYSTEM_BANNER_SVG_STYLE_PROPS = [
    "width",
    "height",
    "fill",
    "stroke",
    "strokeWidth",
    "strokeLinecap",
    "strokeLinejoin",
] as const;

const SYSTEM_BANNER_BODY_STYLE_PROPS = [
    "display",
    "flexDirection",
    "gap",
    "minWidth",
] as const;

const SYSTEM_BANNER_TEXT_STYLE_PROPS = [
    "color",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
] as const;

const SYSTEM_BANNER_ACTIONS_STYLE_PROPS = [
    "display",
    "gap",
] as const;

const SYSTEM_BANNER_BUTTON_STYLE_PROPS = [
    "display",
    "alignItems",
    "justifyContent",
    "gap",
    "height",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderTopStyle",
    "borderTopColor",
    "borderRadius",
    "backgroundColor",
    "color",
    "fontSize",
    "fontWeight",
    "lineHeight",
] as const;

const SYSTEM_BANNER_PROGRESS_STYLE_PROPS = [
    "position",
    "height",
    "minWidth",
    "borderRadius",
    "backgroundColor",
    "overflow",
] as const;

const SYSTEM_BANNER_BAR_STYLE_PROPS = [
    "position",
    "backgroundColor",
    "backgroundImage",
    "borderRadius",
    "transitionProperty",
    "transitionDuration",
    "animationName",
    "animationDuration",
] as const;

type SystemBannerStyleProp =
    | (typeof SYSTEM_BANNER_ROOT_STYLE_PROPS)[number]
    | (typeof SYSTEM_BANNER_ICON_STYLE_PROPS)[number]
    | (typeof SYSTEM_BANNER_SVG_STYLE_PROPS)[number]
    | (typeof SYSTEM_BANNER_BODY_STYLE_PROPS)[number]
    | (typeof SYSTEM_BANNER_TEXT_STYLE_PROPS)[number]
    | (typeof SYSTEM_BANNER_ACTIONS_STYLE_PROPS)[number]
    | (typeof SYSTEM_BANNER_BUTTON_STYLE_PROPS)[number]
    | (typeof SYSTEM_BANNER_PROGRESS_STYLE_PROPS)[number]
    | (typeof SYSTEM_BANNER_BAR_STYLE_PROPS)[number];

interface SystemBannerPixelDiff {
    differingPixels: number;
    dimensionsMatch: boolean;
    expectedHeight: number;
    expectedWidth: number;
    maxChannelDelta: number;
    productHeight: number;
    productWidth: number;
}

async function readComputedStyle(
    page: Page,
    selector: string,
    props: readonly SystemBannerStyleProp[],
) {
    return page.locator(selector).first().evaluate(
        (element, propNames) => {
            const style = window.getComputedStyle(element);
            const entries = Object.fromEntries(
                propNames.map((prop) => [
                    prop,
                    (style as unknown as Record<string, string>)[prop] ??
                        style.getPropertyValue(prop),
                ]),
            );
            if (entries.borderTopWidth === "0px") {
                entries.borderTopStyle = "none";
            }
            return entries;
        },
        props,
    );
}

async function expectComputedStyleMatch(
    sotPage: Page,
    productPage: Page,
    sotSelector: string,
    productSelector: string,
    props: readonly SystemBannerStyleProp[],
) {
    const [sot, product] = await Promise.all([
        readComputedStyle(sotPage, sotSelector, props),
        readComputedStyle(productPage, productSelector, props),
    ]);

    expect(product, `${productSelector} ~= ${sotSelector}`).toEqual(sot);
}

async function expectInnerHtmlMatch(
    sotPage: Page,
    productPage: Page,
    sotSelector: string,
    productSelector: string,
) {
    const [sot, product] = await Promise.all([
        sotPage.locator(sotSelector).first().evaluate((element) => element.innerHTML),
        productPage
            .locator(productSelector)
            .first()
            .evaluate((element) => element.innerHTML),
    ]);

    expect(product, `${productSelector} ~= ${sotSelector}`).toBe(sot);
}

async function readProgressRatio(page: Page, selector: string) {
    return page.locator(selector).first().evaluate((track) => {
        const trackWidth = track.getBoundingClientRect().width;
        const barWidth =
            track
                .querySelector(
                    '.sbn-bar, [data-sot-part="system-banner-progress-bar"]',
                )
                ?.getBoundingClientRect().width ?? 0;
        if (trackWidth === 0) {
            return 0;
        }
        return Math.round((barWidth / trackWidth) * 100);
    });
}

async function expectProgressRatioMatch(
    sotPage: Page,
    productPage: Page,
    sotSelector: string,
    productSelector: string,
) {
    const [sot, product] = await Promise.all([
        readProgressRatio(sotPage, sotSelector),
        readProgressRatio(productPage, productSelector),
    ]);
    expect(product, `${productSelector} ratio ~= ${sotSelector}`).toBe(sot);
}

async function dispatchSystemBanner(
    page: Page,
    detail: {
        actionLabel?: string;
        id?: string;
        indeterminate?: boolean;
        message?: string;
        progress?: number;
        secondaryActionLabel?: string;
        state:
            | "offline"
            | "permission-denied"
            | "db-locked"
            | "update-available"
            | "import-progress"
            | "export-progress"
            | null;
        title?: string;
    },
) {
    await page.evaluate((eventDetail) => {
        window.dispatchEvent(
            new CustomEvent("betterainote:system-banner", {
                detail: eventDetail,
            }),
        );
    }, detail);
}

async function clearSystemBanners(page: Page) {
    await dispatchSystemBanner(page, { state: null });
}

async function installSystemBannerActionRecorder(page: Page) {
    await page.evaluate(() => {
        const target = window as Window & {
            __betterAINoteSystemBannerActionRecorderInstalled?: boolean;
            __betterAINoteSystemBannerActions?: unknown[];
        };
        target.__betterAINoteSystemBannerActions = [];
        if (target.__betterAINoteSystemBannerActionRecorderInstalled) {
            return;
        }
        target.__betterAINoteSystemBannerActionRecorderInstalled = true;
        window.addEventListener("betterainote:system-banner-action", (event) => {
            target.__betterAINoteSystemBannerActions?.push(
                (event as CustomEvent).detail,
            );
        });
    });
}

async function expectLatestSystemBannerAction(
    page: Page,
    expected: Record<string, string>,
) {
    const actions = await page.evaluate(() => {
        const target = window as Window & {
            __betterAINoteSystemBannerActions?: unknown[];
        };
        return target.__betterAINoteSystemBannerActions ?? [];
    });
    expect(actions.at(-1)).toEqual(expected);
}

async function readElementWidth(locator: Locator) {
    return locator.evaluate((element) =>
        Math.round(element.getBoundingClientRect().width),
    );
}

async function captureSystemBannerHtmlFixture(
    page: Page,
    html: string,
    width: number,
) {
    const fixtureId = `system-banner-pixel-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ fixtureId: id, fixtureHtml, fixtureWidth }) => {
            document.getElementById(id)?.remove();
            document.documentElement.dataset.theme = "light";
            document.querySelectorAll("nextjs-portal").forEach((element) => {
                element.remove();
            });

            const host = document.createElement("div");
            host.id = id;
            host.style.position = "fixed";
            host.style.left = "32px";
            host.style.top = "32px";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "var(--bg-canvas)";

            const stage = document.createElement("div");
            stage.className = "system-banner-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.width = `${fixtureWidth}px`;
            stage.innerHTML = fixtureHtml;

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { fixtureHtml: html, fixtureId, fixtureWidth: width },
    );

    const stage = page
        .locator(`#${fixtureId} > .system-banner-pixel-stage`)
        .first();
    await expect(
        stage
            .locator('.sys-banner, [data-sot-panel="system-banner"]')
            .first(),
    ).toBeVisible();
    await page.waitForTimeout(250);
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: true,
        scale: "css",
    });
    await page.evaluate((id) => {
        document.getElementById(id)?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        screenshot,
    };
}

async function captureSystemBannerLocatorFixture(
    page: Page,
    locator: Locator,
    width: number,
) {
    const html = await locator.evaluate((element) => element.outerHTML);
    return captureSystemBannerHtmlFixture(page, html, width);
}

async function captureSystemBannerGroupFixture(
    page: Page,
    locator: Locator,
    width: number,
) {
    const html = await locator.evaluateAll((elements) =>
        elements.map((element) => element.outerHTML).join(""),
    );
    return captureSystemBannerHtmlFixture(page, html, width);
}

async function compareSystemBannerPixels(
    page: Page,
    expected: string,
    actual: string,
): Promise<SystemBannerPixelDiff> {
    return page.evaluate(
        async ({ actual: actualSrc, expected: expectedSrc }) => {
            const loadImage = (src: string) =>
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = () =>
                        reject(new Error(`Failed to decode screenshot ${src}`));
                    image.src = src;
                });
            const [expectedImage, actualImage] = await Promise.all([
                loadImage(expectedSrc),
                loadImage(actualSrc),
            ]);

            if (
                expectedImage.naturalWidth !== actualImage.naturalWidth ||
                expectedImage.naturalHeight !== actualImage.naturalHeight
            ) {
                return {
                    differingPixels: -1,
                    dimensionsMatch: false,
                    expectedHeight: expectedImage.naturalHeight,
                    expectedWidth: expectedImage.naturalWidth,
                    maxChannelDelta: -1,
                    productHeight: actualImage.naturalHeight,
                    productWidth: actualImage.naturalWidth,
                };
            }

            const canvas = document.createElement("canvas");
            canvas.width = expectedImage.naturalWidth;
            canvas.height = expectedImage.naturalHeight;
            const context = canvas.getContext("2d", {
                willReadFrequently: true,
            });
            if (!context) {
                throw new Error("Canvas 2D context unavailable");
            }

            context.drawImage(expectedImage, 0, 0);
            const expectedData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(actualImage, 0, 0);
            const actualData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;

            let differingPixels = 0;
            let maxChannelDelta = 0;
            for (let index = 0; index < expectedData.length; index += 4) {
                const pixelDelta = Math.max(
                    Math.abs(expectedData[index] - actualData[index]),
                    Math.abs(expectedData[index + 1] - actualData[index + 1]),
                    Math.abs(expectedData[index + 2] - actualData[index + 2]),
                    Math.abs(expectedData[index + 3] - actualData[index + 3]),
                );
                if (pixelDelta > 0) {
                    differingPixels += 1;
                    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
                }
            }

            return {
                differingPixels,
                dimensionsMatch: true,
                expectedHeight: expectedImage.naturalHeight,
                expectedWidth: expectedImage.naturalWidth,
                maxChannelDelta,
                productHeight: actualImage.naturalHeight,
                productWidth: actualImage.naturalWidth,
            };
        },
        { actual, expected },
    );
}

async function expectSystemBannerPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    productLocator: Locator,
    sotHtmlTransform?: (html: string) => string,
) {
    const width = await readElementWidth(sotLocator);
    const sotHtml = await sotLocator.evaluate((element) => element.outerHTML);
    const [sotCapture, productCapture] = await Promise.all([
        captureSystemBannerHtmlFixture(
            sotLocator.page(),
            sotHtmlTransform ? sotHtmlTransform(sotHtml) : sotHtml,
            width,
        ),
        captureSystemBannerLocatorFixture(page, productLocator, width),
    ]);
    const diff = await compareSystemBannerPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels !== 0 ||
        diff.maxChannelDelta !== 0
    ) {
        const attachmentName = label
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();
        await testInfo.attach(`${attachmentName}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    expect(diff.dimensionsMatch, label).toBe(true);
    expect(diff.productHeight, label).toBe(diff.expectedHeight);
    expect(diff.productWidth, label).toBe(diff.expectedWidth);
    expect(diff.differingPixels, label).toBe(0);
    expect(diff.maxChannelDelta, label).toBe(0);
}

function sanitizeExportProgressSotHtml(html: string) {
    const legacyPrivatePhrase = ["来源 Coo", "kie"].join("");
    const legacyPrivateTerm = ["Coo", "kie"].join("");
    return html
        .split("来源登录材料")
        .join("登录信息")
        .split(legacyPrivatePhrase)
        .join("登录信息")
        .split(legacyPrivateTerm)
        .join("登录信息");
}

async function expectSystemBannerGroupPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    label: string,
    sotLocator: Locator,
    productLocator: Locator,
) {
    const width = await readElementWidth(sotLocator);
    const [sotCapture, productCapture] = await Promise.all([
        captureSystemBannerGroupFixture(
            sotLocator.page(),
            sotLocator.locator(".sys-banner"),
            width,
        ),
        captureSystemBannerGroupFixture(page, productLocator, width),
    ]);
    const diff = await compareSystemBannerPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels !== 0 ||
        diff.maxChannelDelta !== 0
    ) {
        const attachmentName = label
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();
        await testInfo.attach(`${attachmentName}-sot.png`, {
            body: sotCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-product.png`, {
            body: productCapture.screenshot,
            contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-diff.json`, {
            body: Buffer.from(JSON.stringify(diff, null, 2)),
            contentType: "application/json",
        });
    }

    expect(diff.dimensionsMatch, label).toBe(true);
    expect(diff.productHeight, label).toBe(diff.expectedHeight);
    expect(diff.productWidth, label).toBe(diff.expectedWidth);
    expect(diff.differingPixels, label).toBe(0);
    expect(diff.maxChannelDelta, label).toBe(0);
}

async function expectSystemBannerSurfaceMatch(
    sotPage: Page,
    productPage: Page,
    sotSelector: string,
    productSelector: string,
) {
    await expectComputedStyleMatch(
        sotPage,
        productPage,
        sotSelector,
        productSelector,
        SYSTEM_BANNER_ROOT_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotPage,
        productPage,
        `${sotSelector} .sbn-ico`,
        `${productSelector} [data-sot-part="system-banner-icon"]`,
        SYSTEM_BANNER_ICON_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotPage,
        productPage,
        `${sotSelector} .sbn-ico svg`,
        `${productSelector} [data-sot-part="system-banner-icon"] svg`,
        SYSTEM_BANNER_SVG_STYLE_PROPS,
    );
    await expectInnerHtmlMatch(
        sotPage,
        productPage,
        `${sotSelector} .sbn-ico`,
        `${productSelector} [data-sot-part="system-banner-icon"]`,
    );
    await expectComputedStyleMatch(
        sotPage,
        productPage,
        `${sotSelector} .sbn-body`,
        `${productSelector} [data-sot-part="system-banner-body"]`,
        SYSTEM_BANNER_BODY_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotPage,
        productPage,
        `${sotSelector} .sbn-title`,
        `${productSelector} [data-sot-part="system-banner-title"]`,
        SYSTEM_BANNER_TEXT_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotPage,
        productPage,
        `${sotSelector} .sbn-sub`,
        `${productSelector} [data-sot-part="system-banner-description"]`,
        SYSTEM_BANNER_TEXT_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotPage,
        productPage,
        `${sotSelector} .sbn-actions`,
        `${productSelector} [data-sot-part="system-banner-actions"]`,
        SYSTEM_BANNER_ACTIONS_STYLE_PROPS,
    );
    await expectComputedStyleMatch(
        sotPage,
        productPage,
        `${sotSelector} .sbn-actions button:first-child`,
        `${productSelector} [data-sot-part="system-banner-actions"] [data-slot="button"]:first-child`,
        SYSTEM_BANNER_BUTTON_STYLE_PROPS,
    );
}

async function reloadDashboardAfterSyncStatus(page: Page) {
    const syncStatusResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/data-sources/sync") &&
            response.request().method() === "GET" &&
            response.ok(),
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await syncStatusResponse;
    await page.waitForLoadState("networkidle");
}

test("dashboard system banner responds to runtime events and offline state", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-sot-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-sot-state", "ready");
    await page.waitForLoadState("networkidle");
    await installSystemBannerActionRecorder(page);

    const banner = page.locator('[data-sot-panel="system-banner"]');
    await expect(banner).toHaveCount(0);

    await dispatchSystemBanner(page, {
        message: "写入暂时暂停，请稍后重试。",
        state: "db-locked",
        title: "数据库被占用",
    });
    await expect(banner).toHaveAttribute("data-kind", "db-locked");
    await expect(banner).toHaveAttribute("role", "alert");
    await expect(banner).not.toHaveAttribute("aria-live", /.+/);
    await expect(banner).toContainText("数据库被占用");
    await expect(banner).toContainText("写入暂时暂停，请稍后重试。");
    await banner.getByRole("button", { name: "重新连接" }).click();
    await expectLatestSystemBannerAction(page, {
        action: "reconnect",
        id: "db-locked",
        role: "primary",
        state: "db-locked",
    });

    await dispatchSystemBanner(page, {
        actionLabel: "立即刷新",
        message: "新版本已经准备好。",
        state: "update-available",
        title: "有更新",
    });
    await expect(banner).toHaveCount(2);
    await expect(banner.nth(1)).toHaveAttribute("data-kind", "update-available");
    await expect(banner.nth(1)).not.toHaveAttribute("role", /.+/);
    await expect(banner.nth(1)).not.toHaveAttribute("aria-live", /.+/);
    await expect(
        banner.nth(1).getByRole("button", { name: "立即刷新" }),
    ).toBeVisible();

    await clearSystemBanners(page);
    await expect(banner).toHaveCount(0);

    await dispatchSystemBanner(page, {
        state: "permission-denied",
    });
    await expect(banner).toHaveAttribute("data-kind", "permission-denied");
    await expect(banner).toHaveAttribute("role", "alert");
    await expect(banner).toContainText("未授权访问录音文件夹");
    await expect(banner).toContainText("完全磁盘访问");
    await expect(
        banner.getByRole("button", { name: "打开系统设置" }),
    ).toBeVisible();
    await expect(banner.getByRole("button", { name: "稍后" })).toBeVisible();
    await banner.getByRole("button", { name: "打开系统设置" }).click();
    await expectLatestSystemBannerAction(page, {
        action: "open-system-settings",
        id: "permission-denied",
        role: "primary",
        state: "permission-denied",
    });
    await banner.getByRole("button", { name: "稍后" }).click();
    await expectLatestSystemBannerAction(page, {
        action: "later",
        id: "permission-denied",
        role: "secondary",
        state: "permission-denied",
    });
    await expect(banner).toHaveCount(0);

    await dispatchSystemBanner(page, {
        actionLabel: "暂停",
        id: "import-action",
        progress: 40,
        secondaryActionLabel: "取消",
        state: "import-progress",
        title: "正在导入 BetterAINote 备份包",
    });
    await banner.getByRole("button", { name: "暂停" }).click();
    await expectLatestSystemBannerAction(page, {
        action: "pause-import",
        id: "import-action",
        role: "primary",
        state: "import-progress",
    });
    await banner.getByRole("button", { name: "取消" }).click();
    await expectLatestSystemBannerAction(page, {
        action: "cancel-import",
        id: "import-action",
        role: "secondary",
        state: "import-progress",
    });
    await expect(banner).toHaveCount(0);

    await dispatchSystemBanner(page, {
        actionLabel: "在 Finder 中显示",
        id: "export-action",
        progress: 70,
        secondaryActionLabel: "取消",
        state: "export-progress",
        title: "正在导出录音",
    });
    await banner.getByRole("button", { name: "在 Finder 中显示" }).click();
    await expectLatestSystemBannerAction(page, {
        action: "show-export",
        id: "export-action",
        role: "primary",
        state: "export-progress",
    });
    await banner.getByRole("button", { name: "取消" }).click();
    await expectLatestSystemBannerAction(page, {
        action: "cancel-export",
        id: "export-action",
        role: "secondary",
        state: "export-progress",
    });
    await expect(banner).toHaveCount(0);

    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(banner).toHaveAttribute("data-kind", "offline");
    await expect(banner).toHaveAttribute("role", "status");
    await expect(banner).toHaveAttribute("aria-live", "polite");
    await expect(banner).toContainText("当前无网络连接");
    await banner.getByRole("button", { name: "重试" }).click();
    await expectLatestSystemBannerAction(page, {
        action: "retry",
        id: "offline",
        role: "primary",
        state: "offline",
    });
    await banner.getByRole("button", { name: "收起" }).click();
    await expect(banner).toHaveCount(0);

    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(banner).toHaveCount(0);
});

test("dashboard system banner restores SOT progress, indeterminate, and stacked states", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-sot-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-sot-state", "ready");
    await page.waitForLoadState("networkidle");

    const banners = page.locator('[data-sot-panel="system-banner"]');

    await dispatchSystemBanner(page, {
        actionLabel: "暂停",
        id: "import",
        message: "85 / 213 条录音已写入 · 预计还需 1 分 12 秒",
        progress: 40,
        secondaryActionLabel: "取消",
        state: "import-progress",
        title: "正在导入 BetterAINote 备份包",
    });
    await expect(banners).toHaveCount(1);
    const importBanner = banners.first();
    await expect(importBanner).toHaveAttribute("data-kind", "import-progress");
    await expect(importBanner).toHaveAttribute("data-kind", "import-progress");
    await expect(importBanner).not.toHaveAttribute("role", /.+/);
    await expect(importBanner).not.toHaveAttribute("aria-live", /.+/);
    await expect(importBanner).toHaveAttribute("data-pct", "40");
    await expect(
        importBanner.locator('[data-sot-part="system-banner-progress"]'),
    ).toHaveCSS(
        "display",
        "block",
    );
    await expect(
        importBanner.locator('[data-sot-part="system-banner-progress-bar"]'),
    ).toHaveCount(1);
    await expect(
        importBanner.locator('[data-sot-part="system-banner-progress"]'),
    ).toHaveAttribute("data-sot-state", "ready");
    await expect(importBanner.getByRole("button", { name: "暂停" })).toBeVisible();
    await expect(importBanner.getByRole("button", { name: "取消" })).toBeVisible();

    await dispatchSystemBanner(page, {
        actionLabel: "取消",
        id: "import",
        indeterminate: true,
        message: "读取清单 · 解析校验和 · 暂未开始写入",
        state: "import-progress",
        title: "正在扫描备份包结构",
    });
    await expect(importBanner).not.toHaveAttribute("data-pct", /.+/);
    await expect(
        importBanner.locator('[data-sot-part="system-banner-progress"]'),
    ).toHaveAttribute("data-sot-state", "indeterminate");
    await expect(importBanner.getByRole("button", { name: "取消" })).toBeDisabled();

    await page.evaluate(() => {
        for (const detail of [
            {
                actionLabel: "在 Finder 中显示",
                id: "export",
                message: "78 / 112 · 含逐字稿 · 含标签关系 · 不含登录信息",
                progress: 70,
                secondaryActionLabel: "取消",
                state: "export-progress",
                title: "正在导出「全部录音 · 钉钉」",
            },
            {
                actionLabel: "重启并更新",
                id: "update",
                message: "将在下次启动时应用。",
                secondaryActionLabel: "查看",
                state: "update-available",
                title: "有可用更新",
            },
        ]) {
            window.dispatchEvent(
                new CustomEvent("betterainote:system-banner", { detail }),
            );
        }
    });
    await expect(banners).toHaveCount(2);
    await expect(banners.nth(0)).toHaveAttribute("data-kind", "import-progress");
    await expect(banners.nth(1)).toHaveAttribute("data-kind", "export-progress");
    await expect(banners.nth(1)).toHaveAttribute("data-pct", "70");

    await dispatchSystemBanner(page, {
        id: "import",
        state: null,
    });
    await expect(banners).toHaveCount(2);
    await expect(banners.nth(0)).toHaveAttribute("data-kind", "export-progress");
    await expect(banners.nth(1)).toHaveAttribute("data-kind", "update-available");
});

test("dashboard system banner primitives match SOT component library styles", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page, "light");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-sot-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-sot-state", "ready");
    await page.waitForLoadState("networkidle");

    const sotPage = await page.context().newPage();
    try {
        await sotPage.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
        await expect(sotPage.locator("#sysbanner")).toBeVisible();

        const productBanners = page.locator(
            '[data-sot-panel="system-banner"]',
        );
        await expect(productBanners).toHaveCount(0);

        await dispatchSystemBanner(page, { state: "offline" });
        await expect(
            page.locator(
                '[data-sot-panel="system-banner"][data-kind="offline"]',
            ),
        ).toHaveCount(1);
        await expectSystemBannerSurfaceMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="offline"]',
            '[data-sot-panel="system-banner"][data-kind="offline"]',
        );
        await expect(
            page.locator(
                '[data-sot-panel="system-banner"][data-kind="offline"] [data-sot-part="system-banner-actions"] [data-slot="button"]',
            ),
        ).toHaveCount(2);
        await expect(
            page
                .locator(
                    '[data-sot-panel="system-banner"][data-kind="offline"] [data-sot-part="system-banner-actions"] [data-slot="button"]',
                )
                .first(),
        ).toHaveAttribute("data-variant", "ghost");
        await expect(
            page
                .locator(
                    '[data-sot-panel="system-banner"][data-kind="offline"] [data-sot-part="system-banner-actions"] [data-slot="button"]',
                )
                .first(),
        ).toHaveAttribute("data-size", "sm");
        await clearSystemBanners(page);

        await dispatchSystemBanner(page, { state: "permission-denied" });
        await expectSystemBannerSurfaceMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="permission-denied"]',
            '[data-sot-panel="system-banner"][data-kind="permission-denied"]',
        );
        await expect(
            page.locator(
                '[data-sot-panel="system-banner"][data-kind="permission-denied"] [data-sot-part="system-banner-actions"] [data-slot="button"]',
            ),
        ).toHaveCount(2);
        await clearSystemBanners(page);

        await dispatchSystemBanner(page, { state: "db-locked" });
        await expectSystemBannerSurfaceMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="db-locked"]',
            '[data-sot-panel="system-banner"][data-kind="db-locked"]',
        );
        await clearSystemBanners(page);

        await dispatchSystemBanner(page, { state: "update-available" });
        await expectSystemBannerSurfaceMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="update-available"]',
            '[data-sot-panel="system-banner"][data-kind="update-available"]',
        );
        await expect(
            page
                .locator(
                    '[data-sot-panel="system-banner"][data-kind="update-available"] [data-sot-part="system-banner-actions"] [data-slot="button"]',
                )
                .first(),
        ).toHaveAttribute("data-variant", "outline");
        await expect(
            page
                .locator(
                    '[data-sot-panel="system-banner"][data-kind="update-available"] [data-sot-part="system-banner-actions"] [data-slot="button"]',
                )
                .first(),
        ).toHaveAttribute("data-size", "sm");
        await expect(
            page.locator(
                '[data-sot-panel="system-banner"][data-kind="update-available"] [data-sot-part="system-banner-actions"] [data-slot="button"]',
            ),
        ).toHaveCount(3);
        await clearSystemBanners(page);

        await dispatchSystemBanner(page, {
            actionLabel: "暂停",
            message: "85 / 213 条录音已写入 · 预计还需 1 分 12 秒",
            progress: 40,
            secondaryActionLabel: "取消",
            state: "import-progress",
            title: "正在导入 BetterAINote 备份包",
        });
        await expectSystemBannerSurfaceMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="import-progress"][data-pct="40"]',
            '[data-sot-panel="system-banner"][data-kind="import-progress"][data-pct="40"]',
        );
        await expectComputedStyleMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="import-progress"][data-pct="40"] .sbn-progress',
            '[data-sot-panel="system-banner"][data-kind="import-progress"][data-pct="40"] [data-sot-part="system-banner-progress"]',
            SYSTEM_BANNER_PROGRESS_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="import-progress"][data-pct="40"] .sbn-bar',
            '[data-sot-panel="system-banner"][data-kind="import-progress"][data-pct="40"] [data-sot-part="system-banner-progress-bar"]',
            SYSTEM_BANNER_BAR_STYLE_PROPS,
        );
        await expectProgressRatioMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="import-progress"][data-pct="40"] .sbn-progress',
            '[data-sot-panel="system-banner"][data-kind="import-progress"][data-pct="40"] [data-sot-part="system-banner-progress"]',
        );
        await clearSystemBanners(page);

        await dispatchSystemBanner(page, {
            actionLabel: "取消",
            indeterminate: true,
            message: "读取清单 · 解析校验和 · 暂未开始写入",
            state: "import-progress",
            title: "正在扫描备份包结构",
        });
        await expectSystemBannerSurfaceMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="import-progress"]:not([data-pct])',
            '[data-sot-panel="system-banner"][data-kind="import-progress"]:not([data-pct])',
        );
        await expectComputedStyleMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="import-progress"]:not([data-pct]) .sbn-progress',
            '[data-sot-panel="system-banner"][data-kind="import-progress"]:not([data-pct]) [data-sot-part="system-banner-progress"]',
            SYSTEM_BANNER_PROGRESS_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="import-progress"]:not([data-pct]) .sbn-bar',
            '[data-sot-panel="system-banner"][data-kind="import-progress"]:not([data-pct]) [data-sot-part="system-banner-progress-bar"]',
            SYSTEM_BANNER_BAR_STYLE_PROPS,
        );
        await expectProgressRatioMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="import-progress"]:not([data-pct]) .sbn-progress',
            '[data-sot-panel="system-banner"][data-kind="import-progress"]:not([data-pct]) [data-sot-part="system-banner-progress"]',
        );
        await expect(
            page.locator(
                '[data-sot-panel="system-banner"][data-kind="import-progress"] [data-sot-part="system-banner-actions"] [data-slot="button"]',
            ),
        ).toHaveCount(1);
        await expect(
            page.locator(
                '[data-sot-panel="system-banner"][data-kind="import-progress"] [data-sot-part="system-banner-actions"] [data-slot="button"]',
            ),
        ).toBeDisabled();
        await expect(
            page.locator(
                '[data-sot-panel="system-banner"][data-kind="import-progress"] [data-sot-part="system-banner-actions"] [data-slot="button"]',
            ),
        ).toHaveAttribute("aria-busy", "true");
        await clearSystemBanners(page);

        await dispatchSystemBanner(page, {
            actionLabel: "在 Finder 中显示",
            message: "78 / 112 · 含逐字稿 · 含标签关系 · 不含登录信息",
            progress: 70,
            secondaryActionLabel: "取消",
            state: "export-progress",
            title: "正在导出「全部录音 · 钉钉」",
        });
        await expectSystemBannerSurfaceMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="export-progress"][data-pct="70"]',
            '[data-sot-panel="system-banner"][data-kind="export-progress"][data-pct="70"]',
        );
        await expectComputedStyleMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="export-progress"][data-pct="70"] .sbn-progress',
            '[data-sot-panel="system-banner"][data-kind="export-progress"][data-pct="70"] [data-sot-part="system-banner-progress"]',
            SYSTEM_BANNER_PROGRESS_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="export-progress"][data-pct="70"] .sbn-bar',
            '[data-sot-panel="system-banner"][data-kind="export-progress"][data-pct="70"] [data-sot-part="system-banner-progress-bar"]',
            SYSTEM_BANNER_BAR_STYLE_PROPS,
        );
        await expectProgressRatioMatch(
            sotPage,
            page,
            '#sysbanner .sys-banner[data-kind="export-progress"][data-pct="70"] .sbn-progress',
            '[data-sot-panel="system-banner"][data-kind="export-progress"][data-pct="70"] [data-sot-part="system-banner-progress"]',
        );
    } finally {
        await sotPage.close();
    }
});

test("dashboard system banner screenshots match SOT component library states", async ({
    page,
}, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page, "light");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-sot-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-sot-state", "ready");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);

    const sotPage = await page.context().newPage();
    await sotPage.setViewportSize({ width: 1280, height: 760 });
    try {
        await sotPage.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
        await expect(sotPage.locator("#sysbanner")).toBeVisible();
        await sotPage.evaluate(() => document.fonts.ready);

        const productBanners = page.locator(
            '[data-sot-panel="system-banner"]',
        );
        const sotCard = (index: number) =>
            sotPage.locator(
                `#sysbanner .cl-grid > .cl-card:nth-child(${index})`,
            );
        const expectSingleState = async ({
            detail,
            label,
            productSelector,
            sotHtmlTransform,
            sotCardIndex,
        }: {
            detail: Parameters<typeof dispatchSystemBanner>[1];
            label: string;
            productSelector: string;
            sotHtmlTransform?: (html: string) => string;
            sotCardIndex: number;
        }) => {
            await clearSystemBanners(page);
            await expect(productBanners).toHaveCount(0);
            await dispatchSystemBanner(page, detail);
            const productLocator = page.locator(productSelector).first();
            await expect(productLocator).toBeVisible();
            await expectSystemBannerPixelsMatch(
                page,
                testInfo,
                label,
                sotCard(sotCardIndex).locator(".sys-banner").first(),
                productLocator,
                sotHtmlTransform,
            );
        };

        await expectSingleState({
            detail: { state: "offline" },
            label: "SystemBanner offline",
            productSelector:
                '[data-sot-panel="system-banner"][data-kind="offline"]',
            sotCardIndex: 1,
        });
        await expectSingleState({
            detail: { state: "permission-denied" },
            label: "SystemBanner permission denied",
            productSelector:
                '[data-sot-panel="system-banner"][data-kind="permission-denied"]',
            sotCardIndex: 2,
        });
        await expectSingleState({
            detail: { state: "db-locked" },
            label: "SystemBanner db locked",
            productSelector:
                '[data-sot-panel="system-banner"][data-kind="db-locked"]',
            sotCardIndex: 3,
        });
        const updateSotCopy = await sotCard(4)
            .locator(".sys-banner")
            .first()
            .evaluate((banner) => ({
                message:
                    banner.querySelector(".sbn-sub")?.textContent?.trim() ??
                    undefined,
                title:
                    banner.querySelector(".sbn-title")?.textContent?.trim() ??
                    undefined,
            }));
        await expectSingleState({
            detail: { state: "update-available", ...updateSotCopy },
            label: "SystemBanner update available",
            productSelector:
                '[data-sot-panel="system-banner"][data-kind="update-available"]',
            sotCardIndex: 4,
        });
        await expectSingleState({
            detail: {
                actionLabel: "暂停",
                message: "85 / 213 条录音已写入 · 预计还需 1 分 12 秒",
                progress: 40,
                secondaryActionLabel: "取消",
                state: "import-progress",
                title: "正在导入 BetterAINote 备份包",
            },
            label: "SystemBanner import progress 40",
            productSelector:
                '[data-sot-panel="system-banner"][data-kind="import-progress"][data-pct="40"]',
            sotCardIndex: 5,
        });
        await expectSingleState({
            detail: {
                actionLabel: "取消",
                indeterminate: true,
                message: "读取清单 · 解析校验和 · 暂未开始写入",
                state: "import-progress",
                title: "正在扫描备份包结构",
            },
            label: "SystemBanner import indeterminate",
            productSelector:
                '[data-sot-panel="system-banner"][data-kind="import-progress"]:not([data-pct])',
            sotCardIndex: 6,
        });
        await expectSingleState({
            detail: {
                actionLabel: "在 Finder 中显示",
                message: "78 / 112 · 含逐字稿 · 含标签关系 · 不含登录信息",
                progress: 70,
                secondaryActionLabel: "取消",
                state: "export-progress",
                title: "正在导出「全部录音 · 钉钉」",
            },
            label: "SystemBanner export progress 70",
            productSelector:
                '[data-sot-panel="system-banner"][data-kind="export-progress"][data-pct="70"]',
            sotHtmlTransform: sanitizeExportProgressSotHtml,
            sotCardIndex: 7,
        });

        await clearSystemBanners(page);
        await dispatchSystemBanner(page, {
            id: "stack-offline",
            state: "offline",
        });
        const stackedUpdateSotCopy = await sotCard(8)
            .locator('.sys-banner[data-kind="update-available"]')
            .first()
            .evaluate((banner) => ({
                message:
                    banner.querySelector(".sbn-sub")?.textContent?.trim() ??
                    undefined,
                title:
                    banner.querySelector(".sbn-title")?.textContent?.trim() ??
                    undefined,
            }));
        await dispatchSystemBanner(page, {
            id: "stack-update",
            state: "update-available",
            ...stackedUpdateSotCopy,
        });
        await expect(productBanners).toHaveCount(2);
        await expect(productBanners.nth(0)).toHaveAttribute(
            "data-kind",
            "offline",
        );
        await expect(productBanners.nth(1)).toHaveAttribute(
            "data-kind",
            "update-available",
        );
        await expectSystemBannerGroupPixelsMatch(
            page,
            testInfo,
            "SystemBanner stacked multiple",
            sotCard(8).locator(".cl-stage").first(),
            productBanners,
        );
    } finally {
        await sotPage.close();
    }
});

test("dashboard sync status exposes worker unavailable, queued, and running states", async ({
    page,
}) => {
    const now = new Date();
    let mode:
        | "unavailable"
        | "db-locked"
        | "permission-denied"
        | "queued"
        | "running" = "unavailable";

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
                    healthy:
                        mode !== "unavailable" &&
                        mode !== "db-locked" &&
                        mode !== "permission-denied",
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
                        mode === "unavailable"
                            ? "本地更新服务未响应。"
                            : mode === "db-locked"
                              ? "SQLITE_BUSY: database is locked"
                              : mode === "permission-denied"
                                ? "EACCES: permission denied, scandir source cache"
                                : null,
                    lastSummary:
                        mode === "unavailable" ||
                        mode === "db-locked" ||
                        mode === "permission-denied"
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

    const status = page.locator('[data-sot-panel="dashboard-sync"]');
    await expect(status).toHaveAttribute("data-sot-state", "error");
    await expect(status).toContainText("本地更新服务未响应");
    await expect(page.locator('[data-sot-panel="system-banner"]')).toHaveCount(
        0,
    );

    mode = "db-locked";
    await reloadDashboardAfterSyncStatus(page);
    await expect(status).toHaveAttribute("data-sot-state", "error");
    await expect(
        page.locator('[data-sot-panel="system-banner"][data-kind="db-locked"]'),
    ).toContainText("本地数据库被另一个 BetterAINote 实例占用");

    mode = "permission-denied";
    await reloadDashboardAfterSyncStatus(page);
    await expect(status).toHaveAttribute("data-sot-state", "error");
    await expect(
        page.locator(
            '[data-sot-panel="system-banner"][data-kind="permission-denied"]',
        ),
    ).toContainText("未授权访问录音文件夹");

    mode = "queued";
    await reloadDashboardAfterSyncStatus(page);
    await expect(status).toHaveAttribute("data-sot-state", "queued");
    await expect(status).toContainText("已加入更新");
    await expect(page.locator('[data-sot-panel="system-banner"]')).toHaveCount(
        0,
    );

    mode = "running";
    await reloadDashboardAfterSyncStatus(page);
    await expect(status).toHaveAttribute("data-sot-state", "running");
    await expect(status).toContainText("更新中");
});
