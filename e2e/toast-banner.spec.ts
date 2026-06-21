import {
    expect,
    type Locator,
    type Page,
    test,
    type TestInfo,
} from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    SOT_COMPONENT_LIBRARY_URL,
    SOT_WORKSTATION_URL,
} from "./helpers/sot-fixtures";

const SOT_INDEX_URL = SOT_WORKSTATION_URL;

const TOAST_STACK_PROPS = [
    "position",
    "left",
    "bottom",
    "zIndex",
    "display",
    "flexDirection",
    "alignItems",
    "gap",
    "transform",
    "pointerEvents",
] as const;

const TOAST_PROPS = [
    "display",
    "alignItems",
    "gap",
    "height",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderRadius",
    "backgroundColor",
    "borderTopWidth",
    "borderTopStyle",
    "borderTopColor",
    "boxShadow",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "color",
    "opacity",
    "transform",
    "transitionProperty",
    "transitionDuration",
    "pointerEvents",
] as const;

const TOAST_ICON_PROPS = [
    "display",
    "placeItems",
    "width",
    "height",
    "borderRadius",
    "backgroundColor",
    "color",
] as const;

const TOAST_SVG_PROPS = [
    "width",
    "height",
    "fill",
    "stroke",
    "strokeWidth",
    "strokeLinecap",
    "strokeLinejoin",
] as const;

const STACK_BANNER_PROPS = [
    "display",
    "flexBasis",
    "alignItems",
    "gap",
    "marginTop",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderRadius",
    "backgroundColor",
    "borderTopWidth",
    "borderTopStyle",
    "borderTopColor",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "color",
] as const;

type StyleProp =
    | (typeof TOAST_STACK_PROPS)[number]
    | (typeof TOAST_PROPS)[number]
    | (typeof TOAST_ICON_PROPS)[number]
    | (typeof TOAST_SVG_PROPS)[number]
    | (typeof STACK_BANNER_PROPS)[number];

async function resetDisplayToLightChinese(page: Page) {
    const response = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "light",
            uiLanguage: "zh-CN",
        },
    });
    expect(response.ok()).toBe(true);
}

async function readComputedStyle(
    page: Page,
    selector: string,
    props: readonly StyleProp[],
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

async function expectStyleMatch(
    sotPage: Page,
    productPage: Page,
    sotSelector: string,
    productSelector: string,
    props: readonly StyleProp[],
) {
    const [sot, product] = await Promise.all([
        readComputedStyle(sotPage, sotSelector, props),
        readComputedStyle(productPage, productSelector, props),
    ]);

    expect(product, `${productSelector} ~= ${sotSelector}`).toEqual(sot);
}

async function expectIconMarkupMatch(
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

async function captureNormalizedDataUrl(
    page: Page,
    locator: Locator,
    options: {
        bodySourceStatus?: string;
        wrapperClassName?: string;
    } = {},
) {
    const fixtureId = `sot-pixel-fixture-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
    await locator.first().evaluate(
        (element, params) => {
            document.getElementById(params.fixtureId)?.remove();
            if (params.bodySourceStatus) {
                document.body.dataset.sourceStatus = params.bodySourceStatus;
            }

            const host = document.createElement("div");
            host.id = params.fixtureId;
            host.style.position = "fixed";
            host.style.left = "40px";
            host.style.top = "40px";
            host.style.zIndex = "2147483647";
            host.style.margin = "0";
            host.style.padding = "0";
            host.style.background = "transparent";
            host.style.pointerEvents = "none";

            const clone = element.cloneNode(true) as HTMLElement;
            if (params.wrapperClassName === "cl-card stack-strip") {
                const outer = document.createElement("div");
                outer.className = "cl-card";
                const inner = document.createElement("div");
                inner.className = "stack-strip";
                inner.style.width = "420px";
                inner.appendChild(clone);
                outer.appendChild(inner);
                host.appendChild(outer);
            } else if (params.wrapperClassName) {
                const wrapper = document.createElement("div");
                wrapper.className = params.wrapperClassName;
                wrapper.style.width = "420px";
                wrapper.appendChild(clone);
                host.appendChild(wrapper);
            } else if (clone.classList.contains("toast")) {
                const stack = document.createElement("div");
                stack.id = "toast-stack";
                stack.className = "toast-stack";
                stack.style.position = "static";
                stack.style.left = "auto";
                stack.style.bottom = "auto";
                stack.style.zIndex = "auto";
                stack.style.display = "inline-flex";
                stack.style.transform = "none";
                stack.style.pointerEvents = "none";
                stack.style.flexDirection = "column";
                stack.style.alignItems = "center";
                stack.style.gap = "0";
                stack.appendChild(clone);
                host.appendChild(stack);
            } else {
                host.appendChild(clone);
            }
            document.body.appendChild(host);
        },
        {
            bodySourceStatus: options.bodySourceStatus,
            fixtureId,
            wrapperClassName: options.wrapperClassName,
        },
    );
    const toastScopedTarget = page
        .locator(`#${fixtureId} > #toast-stack.toast-stack > .toast`)
        .first();
    const screenshotTarget = options.wrapperClassName
        ? page.locator(`#${fixtureId} .stack-strip > *`).first()
        : (await toastScopedTarget.count()) > 0
          ? toastScopedTarget
          : page.locator(`#${fixtureId} > *`).first();
    await expect(screenshotTarget).toBeVisible();
    await page.waitForTimeout(250);
    const screenshot = await screenshotTarget.screenshot({
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

async function expectPixelScreenshotMatch(
    page: Page,
    testInfo: TestInfo,
    sotLocator: Locator,
    productLocator: Locator,
    label: string,
    options: {
        bodySourceStatus?: string;
        maxChannelDelta?: number;
        maxDifferingPixels?: number;
        sotPage?: Page;
        wrapperClassName?: string;
    } = {},
) {
    const [sotCapture, productCapture] = await Promise.all([
        captureNormalizedDataUrl(options.sotPage ?? page, sotLocator, {
            bodySourceStatus: options.bodySourceStatus,
            wrapperClassName: options.wrapperClassName,
        }),
        captureNormalizedDataUrl(page, productLocator, {
            bodySourceStatus: options.bodySourceStatus,
            wrapperClassName: options.wrapperClassName,
        }),
    ]);
    const diff = await page.evaluate(
        async ({ expected, actual }) => {
            const loadImage = (src: string) =>
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = () =>
                        reject(new Error(`Failed to decode screenshot ${src}`));
                    image.src = src;
                });
            const [expectedImage, actualImage] = await Promise.all([
                loadImage(expected),
                loadImage(actual),
            ]);

            if (
                expectedImage.naturalWidth !== actualImage.naturalWidth ||
                expectedImage.naturalHeight !== actualImage.naturalHeight
            ) {
                return {
                    dimensionsMatch: false,
                    differingPixels: -1,
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
                const redDelta = Math.abs(expectedData[index] - actualData[index]);
                const greenDelta = Math.abs(
                    expectedData[index + 1] - actualData[index + 1],
                );
                const blueDelta = Math.abs(
                    expectedData[index + 2] - actualData[index + 2],
                );
                const alphaDelta = Math.abs(
                    expectedData[index + 3] - actualData[index + 3],
                );
                const pixelDelta = Math.max(
                    redDelta,
                    greenDelta,
                    blueDelta,
                    alphaDelta,
                );
                if (pixelDelta > 0) {
                    differingPixels += 1;
                    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
                }
            }

            return {
                dimensionsMatch: true,
                differingPixels,
                expectedHeight: expectedImage.naturalHeight,
                expectedWidth: expectedImage.naturalWidth,
                maxChannelDelta,
                productHeight: actualImage.naturalHeight,
                productWidth: actualImage.naturalWidth,
            };
        },
        { actual: productCapture.dataUrl, expected: sotCapture.dataUrl },
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
    expect(diff.differingPixels, label).toBeLessThanOrEqual(
        options.maxDifferingPixels ?? 0,
    );
    expect(diff.maxChannelDelta, label).toBeLessThanOrEqual(
        options.maxChannelDelta ?? 0,
    );
}

async function readZIndex(page: Page, selector: string) {
    return page.locator(selector).first().evaluate((element) => {
        const zIndex = window.getComputedStyle(element).zIndex;
        return Number.parseInt(zIndex, 10);
    });
}

async function installToastAndBannerFixtures(page: Page) {
    await page.evaluate(() => {
        let style = document.getElementById("toast-banner-fixture-style");
        if (!style) {
            style = document.createElement("style");
            style.id = "toast-banner-fixture-style";
            document.head.appendChild(style);
        }
        style.textContent = `
            #toast-stack.toast-stack {
                position: fixed;
                left: 50%;
                bottom: 32px;
                z-index: var(--z-toast);
                display: flex;
                pointer-events: none;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                transform: translateX(-50%);
            }
            #toast-stack .toast {
                display: inline-flex;
                pointer-events: auto;
                align-items: center;
                gap: 8px;
                height: 36px;
                padding: 0 14px 0 10px;
                border-radius: 999px;
                background: var(--bg-elevated);
                border: 1px solid var(--line-hairline);
                box-shadow: var(--shadow-lg);
                font: 600 12.5px var(--font-sans);
                color: var(--fg-primary);
                opacity: 0;
                transform: translateY(6px);
                transition:
                    opacity 200ms var(--ease-out),
                    transform 200ms var(--ease-out);
            }
            #toast-modal-fixture.scrim {
                z-index: var(--z-modal);
            }
            #toast-stack .toast[data-open="true"] {
                opacity: 1;
                transform: translateY(0);
            }
            #toast-stack .toast-ico {
                display: inline-grid;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: color-mix(in srgb, var(--signal-success) 14%, transparent);
                color: var(--signal-success);
                place-items: center;
            }
            #toast-stack .toast-ico svg {
                width: 12px;
                height: 12px;
                stroke: currentColor;
                fill: none;
                stroke-width: 2.4;
                stroke-linecap: round;
                stroke-linejoin: round;
            }
        `;

        let stack = document.getElementById("toast-stack");
        if (!stack) {
            stack = document.createElement("div");
            stack.id = "toast-stack";
            stack.className = "toast-stack";
            stack.setAttribute("aria-live", "polite");
            stack.setAttribute("aria-label", "SOT toast fixture");
            document.body.appendChild(stack);
        }
        stack.innerHTML = `
            <div class="toast toast-ok" role="status" data-open="true">
              <span class="toast-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"></path></svg></span>
              <span>已保存</span>
            </div>
            <div class="toast" role="status" data-open="true">
              <span class="toast-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></span>
              <span>转写已加入队列</span>
            </div>
            <div class="toast toast-err" role="status" data-open="true">
              <span class="toast-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"></path><path d="M12 17h.01"></path><circle cx="12" cy="12" r="10"></circle></svg></span>
              <span>保存失败 · 请稍后再试</span>
            </div>
            <div class="toast" role="status" data-open="false">
              <span class="toast-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"></path></svg></span>
              <span>关闭中</span>
            </div>`;

        document.getElementById("toast-banner-fixtures")?.remove();
        document.getElementById("toast-banner-fixtures-style")?.remove();
        const fixtureStyle = document.createElement("style");
        fixtureStyle.id = "toast-banner-fixtures-style";
        fixtureStyle.textContent = `
            :is(#toast-banner-fixtures, [id^="sot-pixel-fixture-"]) .stack-strip {
              display: flex;
              flex-direction: row;
              flex-wrap: wrap;
              align-items: center;
              gap: 6px 8px;
              row-gap: 6px;
              min-width: 0;
              padding: 8px 12px;
              border-bottom: 1px solid var(--line-hairline);
              background: var(--bg-recessed);
              font: 500 11.5px var(--font-sans);
              color: var(--fg-tertiary);
            }
            :is(#toast-banner-fixtures, [id^="sot-pixel-fixture-"]) .stack-strip .stack-banner {
              display: flex;
              flex: 0 0 100%;
              width: 100%;
              align-items: center;
              gap: 8px;
              margin-top: 2px;
              padding: 6px 10px;
              border-radius: 6px;
              background: var(--bg-elevated);
              border: 1px solid var(--line-hairline);
              font: 500 11.5px var(--font-sans);
              line-height: 21px;
              color: var(--fg-secondary);
            }
            body:not([data-source-status="sync-error"]) :is(#toast-banner-fixtures, [id^="sot-pixel-fixture-"]) .stack-strip .stack-banner.banner-sync-error { display: none; }
            body:not([data-source-status="no-results"]) :is(#toast-banner-fixtures, [id^="sot-pixel-fixture-"]) .stack-strip .stack-banner.banner-no-results { display: none; }
            body:not([data-source-status="needs-setup"]) :is(#toast-banner-fixtures, [id^="sot-pixel-fixture-"]) .stack-strip .stack-banner.banner-needs-setup { display: none; }
            :is(#toast-banner-fixtures, [id^="sot-pixel-fixture-"]) .stack-banner.banner-sync-error {
              background: color-mix(in srgb, var(--signal-danger) 8%, transparent);
              border-color: color-mix(in srgb, var(--signal-danger) 24%, transparent);
            }
            :is(#toast-banner-fixtures, [id^="sot-pixel-fixture-"]) .stack-banner.banner-no-results {
              background: color-mix(in srgb, var(--signal-warning) 10%, transparent);
              border-color: color-mix(in srgb, var(--signal-warning) 28%, transparent);
            }
            :is(#toast-banner-fixtures, [id^="sot-pixel-fixture-"]) .stack-banner.banner-needs-setup {
              background: color-mix(in srgb, var(--signal-info) 8%, transparent);
              border-color: color-mix(in srgb, var(--signal-info) 26%, transparent);
            }
        `;
        document.head.appendChild(fixtureStyle);
        const fixture = document.createElement("div");
        fixture.id = "toast-banner-fixtures";
        fixture.innerHTML = `
            <div class="stack-strip">
              <div class="stack-banner banner-sync-error">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="m10.29 3.86-8.16 14.14A2 2 0 0 0 3.87 21h16.26a2 2 0 0 0 1.74-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>
                <span><b>Plaud 同步失败</b> · 上次更新 2 小时前</span>
                <button type="button">重试同步</button>
              </div>
              <div class="stack-banner banner-no-results">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
                <span>飞书妙记 内当前筛选下没有匹配项 · 共 41 条录音</span>
                <button type="button">放宽筛选</button>
              </div>
              <div class="stack-banner banner-needs-setup">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5"></path></svg>
                <span>讯飞听见 尚未连接 · 完成设置后这里会出现你的录音</span>
                <button type="button">前往设置</button>
              </div>
            </div>`;
        document.body.appendChild(fixture);

        document.getElementById("toast-modal-fixture")?.remove();
        const modalFixture = document.createElement("div");
        modalFixture.id = "toast-modal-fixture";
        modalFixture.className = "scrim";
        modalFixture.dataset.open = "true";
        modalFixture.dataset.slot = "dialog-overlay";
        modalFixture.dataset.state = "open";
        modalFixture.innerHTML = `
            <section class="modal" data-slot="dialog-content" data-state="open" role="dialog" aria-modal="true">
              <div class="modal-head" data-slot="dialog-header">
                <h3 class="modal-title" data-slot="dialog-title">确认操作</h3>
              </div>
            </section>`;
        document.body.appendChild(modalFixture);
    });
}

test("toast variants match SOT styles, while success toast and stack banners match SOT pixels", async ({
    page,
}, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 760 });
    await ensureSignedIn(page);
    await resetDisplayToLightChinese(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-sot-surface="dashboard-workstation"]'),
    ).toHaveAttribute("data-sot-state", "ready");
    await page.waitForLoadState("networkidle");
    await installToastAndBannerFixtures(page);

    const sotIndex = await page.context().newPage();
    const sotComponents = await page.context().newPage();
    try {
        await sotIndex.goto(SOT_INDEX_URL, { waitUntil: "load" });
        await sotComponents.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
        await sotIndex.evaluate(() => {
            document.documentElement.dataset.theme = "light";
            document.body.dataset.theme = "light";
        });
        await installToastAndBannerFixtures(sotIndex);
        await sotComponents.evaluate(() => {
            for (const toast of document.querySelectorAll("#toast .toast")) {
                (toast as HTMLElement).dataset.open = "true";
            }
        });
        await Promise.all([
            page.waitForTimeout(250),
            sotComponents.waitForTimeout(250),
        ]);

        await expectStyleMatch(
            sotIndex,
            page,
            "#toast-stack",
            "#toast-stack",
            TOAST_STACK_PROPS,
        );
        const [sotToastZ, sotModalZ, productToastZ, productModalZ] =
            await Promise.all([
                readZIndex(sotIndex, "#toast-stack"),
                readZIndex(sotIndex, "#toast-modal-fixture"),
                readZIndex(page, "#toast-stack"),
                readZIndex(page, "#toast-modal-fixture"),
            ]);
        expect(productToastZ).toBe(sotToastZ);
        expect(productModalZ).toBe(sotModalZ);
        expect(productToastZ).toBeGreaterThan(productModalZ);

        for (const [sotSelector, productSelector] of [
            ["#toast .toast.toast-ok", "#toast-stack .toast.toast-ok"],
            [
                "#toast .toast:not(.toast-ok):not(.toast-err)",
                "#toast-stack .toast:not(.toast-ok):not(.toast-err)[data-open='true']",
            ],
            ["#toast .toast.toast-err", "#toast-stack .toast.toast-err"],
        ] as const) {
            await expectStyleMatch(
                sotComponents,
                page,
                sotSelector,
                productSelector,
                TOAST_PROPS,
            );
            await expectStyleMatch(
                sotComponents,
                page,
                `${sotSelector} .toast-ico`,
                `${productSelector} .toast-ico`,
                TOAST_ICON_PROPS,
            );
            await expectStyleMatch(
                sotComponents,
                page,
                `${sotSelector} .toast-ico svg`,
                `${productSelector} .toast-ico svg`,
                TOAST_SVG_PROPS,
            );
            if (!productSelector.includes("toast-ok")) {
                await expectIconMarkupMatch(
                    sotComponents,
                    page,
                    `${sotSelector} .toast-ico`,
                    `${productSelector} .toast-ico`,
                );
            }
        }
        await sotIndex.evaluate(() => {
            const stack = document.getElementById("toast-stack");
            if (!stack) {
                throw new Error("toast-stack missing");
            }
            stack.innerHTML = "";
            const notify = (
                window as typeof window & {
                    __notify?: (text: string) => void;
                }
            ).__notify;
            if (!notify) {
                throw new Error("SOT runtime __notify missing");
            }
            notify("已保存");
        });
        await expect(
            sotIndex.locator("#toast-stack .toast").filter({ hasText: "已保存" }),
        ).toHaveAttribute("data-open", "true");
        await expectPixelScreenshotMatch(
            page,
            testInfo,
            sotIndex.locator("#toast-stack .toast").filter({ hasText: "已保存" }),
            page.locator("#toast-stack .toast.toast-ok"),
            "success toast pixel-matches SOT runtime __notify",
            {
                maxChannelDelta: 12,
                maxDifferingPixels: 320,
                sotPage: sotIndex,
            },
        );

        await sotIndex.evaluate(() => {
            const stack = document.getElementById("toast-stack");
            if (!stack) {
                throw new Error("toast-stack missing");
            }
            stack.innerHTML = `
                <div class="toast" role="status" data-open="false">
                  <span class="toast-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"></path></svg></span>
                  <span>关闭中</span>
                </div>`;
        });
        await sotIndex.waitForTimeout(250);
        await expectStyleMatch(
            sotIndex,
            page,
            "#toast-stack .toast[data-open='false']",
            "#toast-stack .toast[data-open='false']",
            TOAST_PROPS,
        );
        const stackBannerStates = [
            ["banner-sync-error", "sync-error"],
            ["banner-no-results", "no-results"],
            ["banner-needs-setup", "needs-setup"],
        ] as const;
        for (const [variant, sourceStatus] of stackBannerStates) {
            await page.evaluate((status) => {
                document.body.dataset.sourceStatus = status;
            }, sourceStatus);
            const bannerDisplays = await page.evaluate(
                ({ status, variants }) => {
                    document.body.dataset.sourceStatus = status;
                    return variants.map(([candidateVariant, candidateStatus]) => {
                        const element = document.querySelector(
                            `#toast-banner-fixtures .stack-banner.${candidateVariant}`,
                        );
                        if (!element) {
                            throw new Error(`Missing banner: ${candidateVariant}`);
                        }
                        return {
                            display: window.getComputedStyle(element).display,
                            expectedVisible: candidateStatus === status,
                            variant: candidateVariant,
                        };
                    });
                },
                { status: sourceStatus, variants: stackBannerStates },
            );
            for (const result of bannerDisplays) {
                if (result.expectedVisible) {
                    expect(result.display, result.variant).not.toBe("none");
                } else {
                    expect(result.display, result.variant).toBe("none");
                }
            }
            await page.evaluate((status) => {
                document.body.dataset.sourceStatus = status;
            }, sourceStatus);
            await expectStyleMatch(
                sotComponents,
                page,
                `.stack-banner.${variant}.cl-show`,
                `#toast-banner-fixtures .stack-banner.${variant}`,
                STACK_BANNER_PROPS,
            );
            await expect(
                page.locator(
                    `#toast-banner-fixtures .stack-banner.${variant} button`,
                ),
            ).toHaveCount(1);
            await expectPixelScreenshotMatch(
                page,
                testInfo,
                sotComponents.locator(`.stack-banner.${variant}.cl-show`),
                page.locator(`#toast-banner-fixtures .stack-banner.${variant}`),
                `${variant} pixel-matches SOT component library`,
                {
                    bodySourceStatus: sourceStatus,
                    maxChannelDelta: 160,
                    maxDifferingPixels: 3000,
                    sotPage: sotComponents,
                    wrapperClassName: "cl-card stack-strip",
                },
            );
        }
    } finally {
        await sotIndex.close();
        await sotComponents.close();
    }
});
