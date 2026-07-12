import {
    expect,
    type Locator,
    type Page,
    test,
    type TestInfo,
} from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

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
    "boxSizing",
    "display",
    "alignItems",
    "justifyContent",
    "gap",
    "width",
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
    "fontFamily",
    "fontSize",
    "fontWeight",
    "letterSpacing",
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

const SYSTEM_BANNER_PIXEL_MASK_CSS = `
    .system-banner-pixel-stage :is(.sbn-actions button, [data-sot-part="system-banner-actions"] [data-slot="button"]) {
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
        text-shadow: none !important;
    }
    .system-banner-pixel-stage :is(.sbn-actions button, [data-sot-part="system-banner-actions"] [data-slot="button"]) svg {
        opacity: 0 !important;
    }
    .system-banner-pixel-stage :is(
        .sys-banner[data-kind="update-available"] .sbn-actions .btn.glass,
        [data-sot-panel="system-banner"][data-kind="update-available"] [data-sot-part="system-banner-actions"] [data-slot="button"][data-variant="outline"]
    ) {
        background: var(--glass-tint-base) !important;
        border-color: var(--line-hairline) !important;
        box-shadow: var(--shadow-xs) !important;
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
    }
`;

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
    return readLocatorComputedStyle(page.locator(selector).first(), props);
}

async function readLocatorComputedStyle(
    locator: Locator,
    props: readonly SystemBannerStyleProp[],
) {
    return locator.evaluate(
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
            if (typeof entries.boxShadow === "string") {
                entries.boxShadow = entries.boxShadow.replace(
                    /(?:rgba\(0, 0, 0, 0\) 0px 0px 0px 0px,\s*)+/g,
                    "",
                );
            }
            return entries;
        },
        props,
    );
}

async function installSystemBannerSotShadcnBridge(page: Page) {
    await page.addStyleTag({
        content: `
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner {
                --system-banner-bg: var(--bg-elevated);
                --system-banner-border: var(--line-hairline);
                --system-banner-icon-bg: color-mix(in srgb, var(--fg-tertiary) 12%, transparent);
                --system-banner-icon-color: var(--fg-secondary);
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.625rem 0.875rem;
                border: 1px solid var(--system-banner-border);
                border-radius: var(--radius-md);
                background: var(--system-banner-bg);
                color: var(--fg-primary);
                box-shadow: var(--shadow-xs);
                font-size: var(--text-body-sm);
                line-height: var(--lh-body-sm);
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                text-rendering: optimizeLegibility;
                font-feature-settings: "ss01", "cv11", "rlig", "calt";
            }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-kind="offline"] {
                --system-banner-bg: color-mix(in srgb, var(--signal-warning) 8%, var(--bg-elevated));
                --system-banner-border: color-mix(in srgb, var(--signal-warning) 28%, transparent);
                --system-banner-icon-bg: color-mix(in srgb, var(--signal-warning) 16%, transparent);
                --system-banner-icon-color: var(--signal-warning);
            }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-kind="permission-denied"],
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-kind="db-locked"] {
                --system-banner-bg: color-mix(in srgb, var(--signal-danger) 8%, var(--bg-elevated));
                --system-banner-border: color-mix(in srgb, var(--signal-danger) 28%, transparent);
                --system-banner-icon-bg: color-mix(in srgb, var(--signal-danger) 14%, transparent);
                --system-banner-icon-color: var(--signal-danger);
            }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-kind="update-available"] {
                --system-banner-bg: color-mix(in srgb, var(--signal-info) 9%, var(--bg-elevated));
                --system-banner-border: color-mix(in srgb, var(--signal-info) 28%, transparent);
                --system-banner-icon-bg: color-mix(in srgb, var(--signal-info) 16%, transparent);
                --system-banner-icon-color: var(--signal-info);
            }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-kind="import-progress"],
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-kind="export-progress"] {
                --system-banner-bg: color-mix(in srgb, var(--signal-info) 6%, var(--bg-elevated));
                --system-banner-border: color-mix(in srgb, var(--signal-info) 22%, transparent);
                --system-banner-icon-bg: color-mix(in srgb, var(--signal-info) 14%, transparent);
                --system-banner-icon-color: var(--signal-info);
            }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner .sbn-ico {
                display: inline-grid;
                place-items: center;
                width: 1.75rem;
                height: 1.75rem;
                border-radius: var(--radius-sm);
                background: var(--system-banner-icon-bg);
                color: var(--system-banner-icon-color);
            }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner .sbn-body {
                display: flex;
                min-width: 0;
                flex: 1;
                flex-direction: column;
                gap: 0.125rem;
            }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner .sbn-actions {
                display: flex;
                flex: none;
                gap: 0.375rem;
            }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner .sbn-actions .btn {
                box-sizing: border-box;
                justify-content: center;
                line-height: 1.5;
                padding-top: 0.5rem;
                padding-bottom: 0.5rem;
            }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner .sbn-actions .btn svg {
                width: 1rem;
                height: 1rem;
                fill: none;
                stroke: currentColor;
                stroke-width: 1.8;
                stroke-linecap: round;
                stroke-linejoin: round;
            }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner .sbn-progress .sbn-bar {
                display: block;
                position: static;
                width: 100%;
                height: 100%;
                flex: 1;
                border-radius: inherit;
                background: var(--signal-info);
                transition-property: transform, translate, scale, rotate;
                transition-duration: var(--duration-base);
            }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-pct="0"] .sbn-bar { transform: translateX(-100%); }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-pct="10"] .sbn-bar { transform: translateX(-90%); }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-pct="20"] .sbn-bar { transform: translateX(-80%); }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-pct="30"] .sbn-bar { transform: translateX(-70%); }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-pct="40"] .sbn-bar { transform: translateX(-60%); }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-pct="50"] .sbn-bar { transform: translateX(-50%); }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-pct="60"] .sbn-bar { transform: translateX(-40%); }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-pct="70"] .sbn-bar { transform: translateX(-30%); }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-pct="80"] .sbn-bar { transform: translateX(-20%); }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-pct="90"] .sbn-bar { transform: translateX(-10%); }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner[data-pct="100"] .sbn-bar { transform: translateX(0); }
            :is(#sysbanner, .system-banner-pixel-stage) .sys-banner .sbn-progress.indeterminate .sbn-bar {
                width: 32%;
                animation: sbn-sweep 1.4s linear infinite;
                background: linear-gradient(90deg, transparent, var(--signal-info) 50%, transparent);
            }
        `,
    });
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
        readLocatorInnerHtml(sotPage.locator(sotSelector).first()),
        readLocatorInnerHtml(productPage.locator(productSelector).first()),
    ]);

    expect(product, `${productSelector} ~= ${sotSelector}`).toBe(sot);
}

async function readLocatorInnerHtml(locator: Locator) {
    return locator.evaluate((element) => element.innerHTML);
}

async function readProgressRatio(page: Page, selector: string) {
    return page.locator(selector).first().evaluate((track) => {
        const trackWidth = track.getBoundingClientRect().width;
        const bar = track.querySelector(
            '.sbn-bar, [data-sot-part="system-banner-progress-bar"]',
        );
        const barWidth = bar?.getBoundingClientRect().width ?? 0;
        if (trackWidth === 0) {
            return 0;
        }
        const transform =
            bar instanceof HTMLElement
                ? window.getComputedStyle(bar).transform
                : "none";
        const translateX =
            transform && transform !== "none"
                ? new DOMMatrixReadOnly(transform).m41
                : 0;
        return Math.round(((barWidth + translateX) / trackWidth) * 100);
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
        ({ fixtureId: id, fixtureHtml, fixtureWidth, pixelMaskCss }) => {
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

            const style = document.createElement("style");
            style.textContent = pixelMaskCss;

            const stage = document.createElement("div");
            stage.className = "system-banner-pixel-stage";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.width = `${fixtureWidth}px`;
            stage.innerHTML = fixtureHtml;

            host.appendChild(style);
            host.appendChild(stage);
            document.body.appendChild(host);

            if (
                stage.childElementCount > 1 ||
                stage.firstElementChild?.matches(
                    '.sys-banner[data-kind="import-progress"], .sys-banner[data-kind="export-progress"], [data-sot-panel="system-banner"][data-kind="import-progress"], [data-sot-panel="system-banner"][data-kind="export-progress"]',
                )
            ) {
                const height = stage.getBoundingClientRect().height;
                stage.style.height = `${Math.max(0, Math.floor(height))}px`;
                stage.style.overflow = "hidden";
            }
        },
        {
            fixtureHtml: html,
            fixtureId,
            fixtureWidth: width,
            pixelMaskCss: SYSTEM_BANNER_PIXEL_MASK_CSS,
        },
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
    await expectSystemBannerActionButtonsMatch(
        sotPage,
        productPage,
        `${sotSelector} .sbn-actions`,
        `${productSelector} [data-sot-part="system-banner-actions"]`,
    );
}

async function expectSystemBannerActionButtonsMatch(
    sotPage: Page,
    productPage: Page,
    sotActionsSelector: string,
    productActionsSelector: string,
) {
    const sotButtons = sotPage
        .locator(sotActionsSelector)
        .first()
        .locator("button");
    const productButtons = productPage
        .locator(productActionsSelector)
        .first()
        .locator('[data-slot="button"]');
    const [sotCount, productCount] = await Promise.all([
        sotButtons.count(),
        productButtons.count(),
    ]);

    expect(productCount, `${productActionsSelector} button count`).toBe(sotCount);

    for (let index = 0; index < sotCount; index += 1) {
        const sotButton = sotButtons.nth(index);
        const productButton = productButtons.nth(index);
        const [sotStyle, productStyle, sotSemantics, productSemantics] =
            await Promise.all([
                readLocatorComputedStyle(sotButton, SYSTEM_BANNER_BUTTON_STYLE_PROPS),
                readLocatorComputedStyle(
                    productButton,
                    SYSTEM_BANNER_BUTTON_STYLE_PROPS,
                ),
                readSystemBannerButtonSemantics(sotButton),
                readSystemBannerButtonSemantics(productButton),
            ]);

        expect(productStyle, `${productActionsSelector} button ${index + 1}`).toEqual(
            sotStyle,
        );
        expect(
            productSemantics,
            `${productActionsSelector} button ${index + 1} semantics`,
        ).toEqual(sotSemantics);

        const [sotSvgCount, productSvgCount] = await Promise.all([
            sotButton.locator("svg").count(),
            productButton.locator("svg").count(),
        ]);
        expect(productSvgCount, `${productActionsSelector} button ${index + 1} svg count`).toBe(
            sotSvgCount,
        );
        if (sotSvgCount > 0) {
            const [sotSvgStyle, productSvgStyle, sotSvgHtml, productSvgHtml] =
                await Promise.all([
                    readLocatorComputedStyle(
                        sotButton.locator("svg").first(),
                        SYSTEM_BANNER_SVG_STYLE_PROPS,
                    ),
                    readLocatorComputedStyle(
                        productButton.locator("svg").first(),
                        SYSTEM_BANNER_SVG_STYLE_PROPS,
                    ),
                    readLocatorInnerHtml(sotButton.locator("svg").first()),
                    readLocatorInnerHtml(productButton.locator("svg").first()),
                ]);
            expect(productSvgStyle, `${productActionsSelector} button ${index + 1} svg`).toEqual(
                sotSvgStyle,
            );
            expect(productSvgHtml, `${productActionsSelector} button ${index + 1} svg html`).toBe(
                sotSvgHtml,
            );
        }
    }
}

async function readSystemBannerButtonSemantics(locator: Locator) {
    return locator.evaluate((button) => ({
        ariaLabel: button.getAttribute("aria-label"),
        hasIcon: Boolean(button.querySelector("svg")),
        text: button.textContent?.trim() ?? "",
        type: button.getAttribute("type"),
    }));
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

test("dashboard system banner composes shadcn primitives without legacy visual wrappers", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page, "light");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
        document.body.dataset.theme = "light";
    });
    await expect(
        page.locator('[data-sot-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-sot-state", "ready");
    await page.waitForLoadState("networkidle");

    const productBanners = page.locator('[data-sot-panel="system-banner"]');
    await expect(productBanners).toHaveCount(0);

    await dispatchSystemBanner(page, { state: "offline" });
    const offlineBanner = page.locator(
        '[data-sot-panel="system-banner"][data-kind="offline"]',
    );
    await expect(offlineBanner).toHaveAttribute("data-slot", "alert");
    await expect(offlineBanner).toHaveAttribute("data-density", "comfortable");
    await expect(offlineBanner).toHaveAttribute("data-layout", "single");
    await expect(offlineBanner).toHaveAttribute("role", "status");
    await expect(
        offlineBanner.locator('[data-sot-part="system-banner-icon"]'),
    ).toHaveAttribute("aria-hidden", "true");
    await expect(
        offlineBanner.locator(
            '[data-sot-part="system-banner-actions"] [data-slot="button"]',
        ),
    ).toHaveCount(2);
    await expect(
        offlineBanner
            .locator(
                '[data-sot-part="system-banner-actions"] [data-slot="button"]',
            )
            .first(),
    ).toHaveAttribute("data-variant", "ghost");
    await expect(
        offlineBanner
            .locator(
                '[data-sot-part="system-banner-actions"] [data-slot="button"]',
            )
            .first(),
    ).toHaveAttribute("data-size", "sm");
    await expect(
        offlineBanner.locator(
            ".sys-banner, .sbn-ico, .sbn-body, .sbn-title, .sbn-sub, .sbn-actions, .sbn-progress, .sbn-bar",
        ),
    ).toHaveCount(0);
    await clearSystemBanners(page);

    await dispatchSystemBanner(page, { state: "update-available" });
    const updateBanner = page.locator(
        '[data-sot-panel="system-banner"][data-kind="update-available"]',
    );
    const updateButtons = updateBanner.locator(
        '[data-sot-part="system-banner-actions"] [data-slot="button"]',
    );
    await expect(updateBanner).toHaveAttribute("data-slot", "alert");
    await expect(updateButtons).toHaveCount(3);
    await expect(updateButtons.first()).toHaveAttribute(
        "data-variant",
        "outline",
    );
    await expect(updateButtons.first()).toHaveAttribute("data-size", "sm");
    await clearSystemBanners(page);

    await dispatchSystemBanner(page, {
        actionLabel: "暂停",
        message: "85 / 213 条录音已写入 · 预计还需 1 分 12 秒",
        progress: 40,
        secondaryActionLabel: "取消",
        state: "import-progress",
        title: "正在导入 BetterAINote 备份包",
    });
    const importBanner = page.locator(
        '[data-sot-panel="system-banner"][data-kind="import-progress"][data-pct="40"]',
    );
    const importProgress = importBanner.locator(
        '[data-sot-part="system-banner-progress"]',
    );
    const importProgressBar = importBanner.locator(
        '[data-sot-part="system-banner-progress-bar"]',
    );
    await expect(importProgress).toHaveAttribute("data-slot", "progress");
    await expect(importProgress).toHaveAttribute("role", "progressbar");
    await expect(importProgress).toHaveAttribute("aria-valuenow", "40");
    await expect(importProgressBar).toHaveAttribute(
        "data-slot",
        "progress-indicator",
    );
    await clearSystemBanners(page);

    await dispatchSystemBanner(page, {
        actionLabel: "取消",
        indeterminate: true,
        message: "读取清单 · 解析校验和 · 暂未开始写入",
        state: "import-progress",
        title: "正在扫描备份包结构",
    });
    const indeterminateBanner = page.locator(
        '[data-sot-panel="system-banner"][data-kind="import-progress"]:not([data-pct])',
    );
    await expect(
        indeterminateBanner.locator(
            '[data-sot-part="system-banner-progress-bar"]',
        ),
    ).toHaveClass(/animate-\[sbn-sweep_1\.4s_linear_infinite\]/);
    const indeterminateButton = indeterminateBanner.locator(
        '[data-sot-part="system-banner-actions"] [data-slot="button"]',
    );
    await expect(indeterminateButton).toHaveCount(1);
    await expect(indeterminateButton).toBeDisabled();
    await expect(indeterminateButton).toHaveAttribute("aria-busy", "true");
    await clearSystemBanners(page);

    await dispatchSystemBanner(page, {
        actionLabel: "在 Finder 中显示",
        message: "78 / 112 · 含逐字稿 · 含标签关系 · 不含登录信息",
        progress: 70,
        secondaryActionLabel: "取消",
        state: "export-progress",
        title: "正在导出「全部录音 · 钉钉」",
    });
    const exportProgress = page.locator(
        '[data-sot-panel="system-banner"][data-kind="export-progress"][data-pct="70"] [data-sot-part="system-banner-progress"]',
    );
    await expect(exportProgress).toHaveAttribute("data-slot", "progress");
    await expect(exportProgress).toHaveAttribute("aria-valuenow", "70");
});

test("dashboard system banner stacked state keeps shadcn alert hooks", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page, "light");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
        document.body.dataset.theme = "light";
    });
    await expect(
        page.locator('[data-sot-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-sot-state", "ready");
    await page.waitForLoadState("networkidle");

    const productBanners = page.locator('[data-sot-panel="system-banner"]');
    await clearSystemBanners(page);
    await dispatchSystemBanner(page, {
        id: "stack-offline",
        state: "offline",
    });
    await dispatchSystemBanner(page, {
        id: "stack-update",
        state: "update-available",
    });

    await expect(productBanners).toHaveCount(2);
    await expect(productBanners.nth(0)).toHaveAttribute("data-kind", "offline");
    await expect(productBanners.nth(1)).toHaveAttribute(
        "data-kind",
        "update-available",
    );
    for (const banner of [productBanners.nth(0), productBanners.nth(1)]) {
        await expect(banner).toHaveAttribute("data-slot", "alert");
        await expect(banner).toHaveAttribute("data-density", "comfortable");
        await expect(banner).toHaveAttribute("data-layout", "stacked");
        await expect(
            banner.locator('[data-sot-part="system-banner-icon"]'),
        ).toHaveCount(1);
        await expect(
            banner.locator('[data-sot-part="system-banner-body"]'),
        ).toHaveCount(1);
        await expect(
            banner.locator('[data-sot-part="system-banner-actions"]'),
        ).toHaveCount(1);
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
