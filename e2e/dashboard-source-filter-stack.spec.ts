import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
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
    SOT_FIXTURE_PROJECT_ROOT,
    SOT_SOURCE_ASSET_DIR,
    SOT_WORKSTATION_URL,
} from "./helpers/sot-fixtures";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const E2E_STORAGE_DIR = process.env.PLAYWRIGHT_E2E_STORAGE_DIR
    ? path.resolve(process.cwd(), process.env.PLAYWRIGHT_E2E_STORAGE_DIR)
    : path.resolve(process.cwd(), "tmp/e2e/storage");
const STACK_RECORDING_PREFIX = "e2e-source-stack-";
const STACK_AUDIO_DIR = "e2e-source-stack-audio";
const STACK_AUDIO_PREFIX = `${STACK_AUDIO_DIR}/`;

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
}

function deriveSiblingDatabasePath(databasePath: string, suffix: string) {
    const parsed = path.parse(databasePath);
    return path.resolve(
        parsed.dir || ".",
        `${parsed.name || "betterainote"}-${suffix}${parsed.ext || ".db"}`,
    );
}

function assertE2EDatabasePath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ??
            path.join(process.cwd(), "tmp/e2e"),
    );
    const resolvedPath = path.resolve(filePath);

    if (
        resolvedPath !== e2eRoot &&
        !resolvedPath.startsWith(`${e2eRoot}${path.sep}`)
    ) {
        throw new Error(
            `Refusing to touch non-E2E database path: ${resolvedPath}`,
        );
    }
}

function assertE2EStoragePath(filePath: string) {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ??
            path.join(process.cwd(), "tmp/e2e"),
    );
    const resolvedPath = path.resolve(filePath);

    if (
        resolvedPath !== e2eRoot &&
        !resolvedPath.startsWith(`${e2eRoot}${path.sep}`)
    ) {
        throw new Error(
            `Refusing to touch non-E2E storage path: ${resolvedPath}`,
        );
    }
}

function databaseUrl(filePath: string) {
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();
const LIBRARY_DB = deriveSiblingDatabasePath(CORE_DB, "library");
const TRANSCRIPTS_DB = deriveSiblingDatabasePath(CORE_DB, "transcripts");
const SOT_ASSET_DIR = path.join(SOT_FIXTURE_PROJECT_ROOT, "assets");
const APP_SHELL_THEME_MATRIX_DIR = path.resolve(
    process.cwd(),
    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/app-shell-theme-matrix-20260611",
);
const APP_SHELL_THEME_MATRIX_JSON = path.join(
    APP_SHELL_THEME_MATRIX_DIR,
    "app-shell-theme-matrix.json",
);

const SOURCE_ROW_SOT_STATES = [
    "connected-active",
    "connected-idle",
    "syncing",
    "sync-error",
    "needs-setup",
    "no-results",
    "expired",
    "disabled",
    "hover-demo",
    "focus-demo",
] as const;

type SourceRowSotState = (typeof SOURCE_ROW_SOT_STATES)[number];
type SourceIconDataUrls = Record<string, string>;
type SotAssetDataUrls = Record<string, string>;
type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = Exclude<ThemeMode, "system">;

const SOURCE_ROW_SELECTORS: Record<SourceRowSotState, string> = {
    "connected-active": '#srcrow .nav-item.nav-source[data-state="connected-active"]',
    "connected-idle": '#srcrow .nav-item.nav-source[data-state="connected-idle"]',
    syncing: '#srcrow .nav-item.nav-source[data-state="syncing"]',
    "sync-error": '#srcrow .nav-item.nav-source[data-state="sync-error"]',
    "needs-setup": '#srcrow .nav-item.nav-source[data-state="needs-setup"]',
    "no-results": '#srcrow .nav-item.nav-source[data-state="no-results"]',
    expired: '#srcrow .nav-item.nav-source[data-state="expired"]',
    disabled: '#srcrow .nav-item.nav-source[data-state="disabled"]',
    "hover-demo": "#srcrow .nav-item.nav-source.is-hover-demo",
    "focus-demo": "#srcrow .nav-item.nav-source.is-focus-demo",
};

type SourceRowPixelDiff = {
    bounds: {
        maxX: number;
        maxY: number;
        minX: number;
        minY: number;
    } | null;
    differingPixels: number;
    dimensionsMatch: boolean;
    expectedHeight: number;
    expectedWidth: number;
    maxChannelDelta: number;
    productHeight: number;
    productWidth: number;
};

type SourceRowPixelFrame = {
    bodyDataset?: {
        drawer?: "closed" | "open";
        sidebar?: "collapsed" | "expanded";
    };
    name: string;
    sidebar: {
        padding: string;
        width: number;
    };
    stage: {
        height: number;
        width: number;
    };
    viewport: {
        height: number;
        width: number;
    };
};

const SOURCE_ROW_PIXEL_FRAMES = [
    {
        name: "expanded",
        sidebar: { padding: "8px", width: 220 },
        stage: { height: 76, width: 260 },
        viewport: { height: 760, width: 1280 },
    },
    {
        bodyDataset: { sidebar: "collapsed" },
        name: "desktop-collapsed",
        sidebar: { padding: "16px 6px 12px", width: 56 },
        stage: { height: 88, width: 88 },
        viewport: { height: 900, width: 1366 },
    },
    {
        bodyDataset: { drawer: "open" },
        name: "mobile-drawer",
        sidebar: { padding: "16px 12px 12px", width: 264 },
        stage: { height: 92, width: 300 },
        viewport: { height: 844, width: 390 },
    },
] as const satisfies readonly SourceRowPixelFrame[];

type DrawerPixelFrame = {
    bodyDataset: {
        drawer: "closed" | "open";
        sourceFilter: "" | "dingtalk";
    };
    name: string;
    target: "trigger" | "sidebar";
    viewport: {
        height: number;
        width: number;
    };
};

const DRAWER_PIXEL_FRAMES = [
    {
        bodyDataset: { drawer: "closed", sourceFilter: "" },
        name: "mobile-trigger-idle",
        target: "trigger",
        viewport: { height: 844, width: 390 },
    },
    {
        bodyDataset: { drawer: "closed", sourceFilter: "dingtalk" },
        name: "mobile-trigger-filtered",
        target: "trigger",
        viewport: { height: 844, width: 390 },
    },
    {
        bodyDataset: { drawer: "open", sourceFilter: "dingtalk" },
        name: "mobile-sidebar-open",
        target: "sidebar",
        viewport: { height: 844, width: 390 },
    },
    {
        bodyDataset: { drawer: "closed", sourceFilter: "" },
        name: "tablet-trigger-idle",
        target: "trigger",
        viewport: { height: 900, width: 820 },
    },
    {
        bodyDataset: { drawer: "closed", sourceFilter: "dingtalk" },
        name: "tablet-trigger-filtered",
        target: "trigger",
        viewport: { height: 900, width: 820 },
    },
    {
        bodyDataset: { drawer: "open", sourceFilter: "dingtalk" },
        name: "tablet-sidebar-open",
        target: "sidebar",
        viewport: { height: 900, width: 820 },
    },
] as const satisfies readonly DrawerPixelFrame[];

type ResponsiveAppPixelFrame = {
    bodyDataset: {
        drawer: "closed" | "open";
        sidebar: "collapsed" | "expanded";
        sourceFilter: "" | "dingtalk";
    };
    name: string;
    viewport: {
        height: number;
        width: number;
    };
};

const RESPONSIVE_APP_PIXEL_FRAMES = [
    {
        bodyDataset: {
            drawer: "closed",
            sidebar: "expanded",
            sourceFilter: "dingtalk",
        },
        name: "desktop-expanded",
        viewport: { height: 900, width: 1366 },
    },
    {
        bodyDataset: {
            drawer: "closed",
            sidebar: "collapsed",
            sourceFilter: "dingtalk",
        },
        name: "desktop-collapsed",
        viewport: { height: 900, width: 1366 },
    },
    {
        bodyDataset: {
            drawer: "open",
            sidebar: "expanded",
            sourceFilter: "dingtalk",
        },
        name: "tablet-overlay",
        viewport: { height: 900, width: 820 },
    },
    {
        bodyDataset: {
            drawer: "open",
            sidebar: "expanded",
            sourceFilter: "dingtalk",
        },
        name: "mobile-drawer",
        viewport: { height: 844, width: 390 },
    },
] as const satisfies readonly ResponsiveAppPixelFrame[];

const DRAWER_TRIGGER_STYLE_PROPS = [
    "display",
    "position",
    "width",
    "height",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderTopStyle",
    "backgroundColor",
    "cursor",
] as const;
const DRAWER_DOT_STYLE_PROPS = [
    "display",
    "position",
    "top",
    "right",
] as const;
const DRAWER_SCRIM_STYLE_PROPS = [
    "display",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "zIndex",
    "pointerEvents",
] as const;
const DRAWER_SIDEBAR_STYLE_PROPS = [
    "display",
    "position",
    "top",
    "bottom",
    "left",
    "zIndex",
] as const;

type DrawerStyleProp =
    | (typeof DRAWER_TRIGGER_STYLE_PROPS)[number]
    | (typeof DRAWER_DOT_STYLE_PROPS)[number]
    | (typeof DRAWER_SCRIM_STYLE_PROPS)[number]
    | (typeof DRAWER_SIDEBAR_STYLE_PROPS)[number];

type ResponsiveAppPixelEvidence = {
    diff: SourceRowPixelDiff;
    frame: string;
    pixelSemantics: string;
    productMetrics: Record<string, unknown>;
    result: "PASS";
    resolvedTheme: ResolvedTheme;
    sotMetrics: Record<string, unknown>;
    viewport: {
        height: number;
        width: number;
    };
};

type AppShellThemeAxisEvidence = {
    canonicalSotVisualParity: boolean;
    expectedResolvedTheme: ResolvedTheme;
    frames: ResponsiveAppPixelEvidence[];
    name: AppShellThemeAxis["name"];
    pixelSemantics: string;
    rationale: string;
    runtime: Record<string, unknown>;
    settingsTheme: ThemeMode;
    systemColorScheme: ResolvedTheme | null;
};

type AppShellThemeAxis = {
    canonicalSotVisualParity: boolean;
    expectedResolvedTheme: ResolvedTheme;
    name: "dark" | "light" | "system-resolved";
    pixelSemantics: string;
    rationale: string;
    settingsTheme: ThemeMode;
    systemColorScheme?: ResolvedTheme;
};

const APP_SHELL_THEME_AXES = [
    {
        canonicalSotVisualParity: true,
        expectedResolvedTheme: "dark",
        name: "dark",
        pixelSemantics: "canonical-dark-sot-css-pixel-parity",
        rationale:
            "SOT Web/index initializes Tweaks.theme to dark and applies data-theme=dark, so dark is the canonical app-shell visual target.",
        settingsTheme: "dark",
        systemColorScheme: "dark",
    },
    {
        canonicalSotVisualParity: false,
        expectedResolvedTheme: "light",
        name: "light",
        pixelSemantics:
            "sot-css-light-branch-product-theme-resolution-pixel-parity",
        rationale:
            "SOT CSS has a default light token branch, but the Web/index startup canonical visual is dark; this axis proves product light theme resolution and CSS parity without claiming canonical SOT visual parity.",
        settingsTheme: "light",
        systemColorScheme: "dark",
    },
    {
        canonicalSotVisualParity: true,
        expectedResolvedTheme: "dark",
        name: "system-resolved",
        pixelSemantics:
            "system-setting-resolved-dark-canonical-sot-css-pixel-parity",
        rationale:
            "Product display settings store theme=system, Playwright emulates a dark OS preference, next-themes resolves html[data-theme] to dark, and the resolved dark frame is compared to the canonical dark SOT target.",
        settingsTheme: "system",
        systemColorScheme: "dark",
    },
] as const satisfies readonly AppShellThemeAxis[];

async function readComputedStyle(
    page: Page,
    selector: string,
    props: readonly DrawerStyleProp[],
) {
    return page.locator(selector).first().evaluate(
        (element, propNames) => {
            const style = window.getComputedStyle(element);
            return Object.fromEntries(
                propNames.map((prop) => [
                    prop,
                    (style as unknown as Record<string, string>)[prop] ??
                        style.getPropertyValue(prop),
                ]),
            );
        },
        props,
    );
}

async function expectComputedStyleMatch(
    sotPage: Page,
    productPage: Page,
    sotSelector: string,
    productSelector: string,
    props: readonly DrawerStyleProp[],
) {
    const [sot, product] = await Promise.all([
        readComputedStyle(sotPage, sotSelector, props),
        readComputedStyle(productPage, productSelector, props),
    ]);

    expect(product, `${productSelector} ~= ${sotSelector}`).toEqual(sot);
}

async function readElementSignature(page: Page, selector: string) {
    return page.locator(selector).first().evaluate((element) => ({
        ariaHidden: element.getAttribute("aria-hidden"),
        ariaLabel: element.getAttribute("aria-label"),
        className: element.getAttribute("class"),
        id: element.getAttribute("id"),
        innerHtml: element.innerHTML.replace(/\s+/g, " ").trim(),
        tagName: element.tagName.toLowerCase(),
        type: element.getAttribute("type"),
    }));
}

async function expectElementSignatureMatch(
    sotPage: Page,
    productPage: Page,
    selector: string,
) {
    const [sot, product] = await Promise.all([
        readElementSignature(sotPage, selector),
        readElementSignature(productPage, selector),
    ]);

    expect(product, `${selector} DOM signature`).toEqual(sot);
}

async function openSotComponentLibrary(page: Page) {
    await page.goto(SOT_COMPONENT_LIBRARY_URL, { waitUntil: "load" });
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
        document.body.dataset.theme = "light";
    });
}

async function readSotSourceRowHtml(
    page: Page,
): Promise<Record<SourceRowSotState, string>> {
    const entries = await Promise.all(
        SOURCE_ROW_SOT_STATES.map(async (state) => [
            state,
            await page
                .locator(SOURCE_ROW_SELECTORS[state])
                .first()
                .evaluate((element) => element.outerHTML),
        ]),
    );

    return Object.fromEntries(entries) as Record<SourceRowSotState, string>;
}

async function readSotSourceIconDataUrls(): Promise<SourceIconDataUrls> {
    const files = [
        { file: "dingtalk.svg", mime: "image/svg+xml" },
        { file: "feishu.jpeg", mime: "image/jpeg" },
        { file: "plaud.png", mime: "image/png" },
        { file: "ticnote.png", mime: "image/png" },
    ] as const;
    const entries = await Promise.all(
        files.map(async ({ file, mime }) => {
            const data = await readFile(path.join(SOT_SOURCE_ASSET_DIR, file));
            const dataUrl = `data:${mime};base64,${data.toString("base64")}`;
            return [
                [`../../assets/sources/${file}`, dataUrl],
                [`/assets/sources/${file}`, dataUrl],
            ] as const;
        }),
    );

    return Object.fromEntries(entries.flat()) as SourceIconDataUrls;
}

async function readSotDrawerAssetDataUrls(): Promise<SotAssetDataUrls> {
    const sourceIconDataUrls = await readSotSourceIconDataUrls();
    const logo = await readFile(path.join(SOT_ASSET_DIR, "logo-mark-steel.svg"));

    return {
        ...sourceIconDataUrls,
        "../../assets/logo-mark-steel.svg": `data:image/svg+xml;base64,${logo.toString("base64")}`,
        "/assets/logo-mark-steel.svg": `data:image/svg+xml;base64,${logo.toString("base64")}`,
    };
}

async function readSotDrawerFixtureHtml(page: Page) {
    const [sidebarHtml, triggerHtml] = await Promise.all([
        page.locator(".sidebar").first().evaluate((element) => element.outerHTML),
        page
            .locator("#drawer-trigger")
            .first()
            .evaluate((element) => element.outerHTML),
    ]);

    return { sidebarHtml, triggerHtml };
}

async function readSotResponsiveAppHtml(page: Page) {
    return page.locator(".app").first().evaluate((element) => {
        const clone = element.cloneNode(true) as HTMLElement;
        clone.setAttribute("data-sot-surface", "dashboard-workstation");
        return clone.outerHTML;
    });
}

async function waitForFixtureImages(page: Page, fixtureId: string) {
    await page.locator(`#${fixtureId} img`).evaluateAll(
        (images) =>
            Promise.all(
                images.map(
                    (image) =>
                        new Promise<void>((resolve, reject) => {
                            if (!(image instanceof HTMLImageElement)) {
                                resolve();
                                return;
                            }
                            if (image.complete) {
                                if (image.naturalWidth > 0) {
                                    resolve();
                                    return;
                                }
                                reject(
                                    new Error(
                                        `Failed to load source icon ${image.getAttribute("src") ?? ""}`,
                                    ),
                                );
                                return;
                            }
                            const timeout = window.setTimeout(() => {
                                reject(
                                    new Error(
                                        `Timed out loading source icon ${image.getAttribute("src") ?? ""}`,
                                    ),
                                );
                            }, 3_000);
                            image.addEventListener("load", () => {
                                window.clearTimeout(timeout);
                                resolve();
                            }, {
                                once: true,
                            });
                            image.addEventListener(
                                "error",
                                () => {
                                    window.clearTimeout(timeout);
                                    reject(
                                        new Error(
                                            `Failed to load source icon ${image.getAttribute("src") ?? ""}`,
                                        ),
                                    );
                                },
                                { once: true },
                            );
                        }),
                ),
            ),
    );
}

async function captureSourceRowFixture(
    page: Page,
    rowHtml: string,
    sourceIconDataUrls: SourceIconDataUrls,
    frame: SourceRowPixelFrame = SOURCE_ROW_PIXEL_FRAMES[0],
) {
    const fixtureId = `sot-source-row-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.setViewportSize(frame.viewport);
    await page.mouse.move(0, 0);
    await page.evaluate(
        ({
            fixtureFrame,
            fixtureId: id,
            rowHtml: html,
            sourceIconDataUrls: iconDataUrls,
        }) => {
            document.getElementById(id)?.remove();
            const previousDrawer = document.body.dataset.drawer;
            const previousSidebar = document.body.dataset.sidebar;
            if (fixtureFrame.bodyDataset?.drawer) {
                document.body.dataset.drawer = fixtureFrame.bodyDataset.drawer;
            } else {
                delete document.body.dataset.drawer;
            }
            if (fixtureFrame.bodyDataset?.sidebar) {
                document.body.dataset.sidebar = fixtureFrame.bodyDataset.sidebar;
            } else {
                delete document.body.dataset.sidebar;
            }

            const host = document.createElement("div");
            host.id = id;
            host.dataset.previousDrawer = previousDrawer ?? "";
            host.dataset.previousSidebar = previousSidebar ?? "";
            host.dataset.previousDrawerPresent = String(previousDrawer !== undefined);
            host.dataset.previousSidebarPresent = String(
                previousSidebar !== undefined,
            );
            host.style.position = "fixed";
            host.style.left = "0";
            host.style.top = "0";
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.background = "transparent";

            const stage = document.createElement("div");
            stage.className = "source-row-pixel-stage";
            stage.style.width = `${fixtureFrame.stage.width}px`;
            stage.style.height = `${fixtureFrame.stage.height}px`;
            stage.style.padding = "16px";
            stage.style.boxSizing = "border-box";
            stage.style.background = "var(--bg-canvas)";
            stage.style.overflow = "hidden";

            const sidebar = document.createElement("aside");
            sidebar.className = "sidebar";
            sidebar.style.position = "relative";
            sidebar.style.width = `${fixtureFrame.sidebar.width}px`;
            sidebar.style.height = "auto";
            sidebar.style.minHeight = "0";
            sidebar.style.padding = fixtureFrame.sidebar.padding;
            sidebar.style.margin = "0";
            sidebar.style.overflow = "visible";
            sidebar.style.display = "block";
            sidebar.style.transform = "none";
            sidebar.innerHTML = html;

            for (const image of sidebar.querySelectorAll("img")) {
                const src = image.getAttribute("src");
                if (src && iconDataUrls[src]) {
                    image.setAttribute("src", iconDataUrls[src]);
                }
            }

            stage.appendChild(sidebar);
            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { fixtureFrame: frame, fixtureId, rowHtml, sourceIconDataUrls },
    );

    await waitForFixtureImages(page, fixtureId);
    const row = page.locator(`#${fixtureId} .nav-item.nav-source`).first();
    await expect(row).toBeVisible();
    await page.waitForTimeout(250);
    const metrics = await row.evaluate((element) => {
        const readStyle = (node: Element | null) => {
            if (!node) return null;
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return {
                alignItems: style.alignItems,
                backgroundColor: style.backgroundColor,
                borderColor: style.borderColor,
                boxShadow: style.boxShadow,
                color: style.color,
                display: style.display,
                flex: style.flex,
                flexDirection: style.flexDirection,
                font: style.font,
                gap: style.gap,
                height: Math.round(rect.height * 1000) / 1000,
                imageRendering: style.imageRendering,
                lineHeight: style.lineHeight,
                marginLeft: style.marginLeft,
                maxHeight: style.maxHeight,
                maxWidth: style.maxWidth,
                opacity: style.opacity,
                objectFit: style.objectFit,
                padding: style.padding,
                verticalAlign: style.verticalAlign,
                whiteSpace: style.whiteSpace,
                width: Math.round(rect.width * 1000) / 1000,
            };
        };

        return {
            action: readStyle(element.querySelector(".src-action")),
            actionSvg: readStyle(element.querySelector(".src-action svg")),
            count: readStyle(element.querySelector(".count")),
            icon: readStyle(element.querySelector(".src-ico")),
            iconImage: readStyle(element.querySelector(".src-ico img")),
            row: readStyle(element),
            status: readStyle(element.querySelector(".src-status")),
        };
    });
    const screenshotTarget = page
        .locator(`#${fixtureId} > .source-row-pixel-stage`)
        .first();
    await expect(screenshotTarget).toBeVisible();
    const screenshot = await screenshotTarget.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        const host = document.getElementById(id);
        if (host?.dataset.previousDrawerPresent === "true") {
            document.body.dataset.drawer = host.dataset.previousDrawer ?? "";
        } else {
            delete document.body.dataset.drawer;
        }
        if (host?.dataset.previousSidebarPresent === "true") {
            document.body.dataset.sidebar = host.dataset.previousSidebar ?? "";
        } else {
            delete document.body.dataset.sidebar;
        }
        host?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        metrics,
        screenshot,
    };
}

async function captureResponsiveAppFixture(
    page: Page,
    appHtml: string,
    assetDataUrls: SotAssetDataUrls,
    frame: ResponsiveAppPixelFrame,
    theme: ResolvedTheme = "dark",
) {
    const fixtureId = `sot-responsive-app-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.setViewportSize(frame.viewport);
    await page.mouse.move(0, 0);
    await page.evaluate(
        ({
            appHtml: html,
            assets,
            fixtureFrame,
            fixtureId: id,
            fixtureTheme,
        }) => {
            document.getElementById(id)?.remove();
            const previousHtmlTheme = document.documentElement.dataset.theme;
            const previousBodyTheme = document.body.dataset.theme;
            const previousDrawer = document.body.dataset.drawer;
            const previousSidebar = document.body.dataset.sidebar;
            const previousSourceFilter = document.body.dataset.sourceFilter;
            const previousSourceStatus = document.body.dataset.sourceStatus;
            const previousTimeStyle = document.body.dataset.timeStyle;

            document.documentElement.dataset.theme = fixtureTheme;
            document.body.dataset.theme = fixtureTheme;
            document.body.dataset.drawer = fixtureFrame.bodyDataset.drawer;
            document.body.dataset.sidebar = fixtureFrame.bodyDataset.sidebar;
            document.body.dataset.timeStyle = "abs";
            if (fixtureFrame.bodyDataset.sourceFilter) {
                document.body.dataset.sourceFilter =
                    fixtureFrame.bodyDataset.sourceFilter;
                document.body.dataset.sourceStatus = "connected";
            } else {
                delete document.body.dataset.sourceFilter;
                delete document.body.dataset.sourceStatus;
            }

            const devOverlayStyle = document.createElement("style");
            devOverlayStyle.dataset.responsiveAppFixture = id;
            devOverlayStyle.textContent = `
                nextjs-portal,
                [data-nextjs-toast],
                [data-nextjs-dialog-overlay],
                [data-nextjs-dialog],
                [data-nextjs-errors],
                .__nextjs-dev-overlay {
                    display: none !important;
                    visibility: hidden !important;
                }
            `;
            document.head.appendChild(devOverlayStyle);

            const host = document.createElement("div");
            host.id = id;
            host.dataset.previousHtmlTheme = previousHtmlTheme ?? "";
            host.dataset.previousHtmlThemePresent = String(
                previousHtmlTheme !== undefined,
            );
            host.dataset.previousBodyTheme = previousBodyTheme ?? "";
            host.dataset.previousBodyThemePresent = String(
                previousBodyTheme !== undefined,
            );
            host.dataset.previousDrawer = previousDrawer ?? "";
            host.dataset.previousDrawerPresent = String(
                previousDrawer !== undefined,
            );
            host.dataset.previousSidebar = previousSidebar ?? "";
            host.dataset.previousSidebarPresent = String(
                previousSidebar !== undefined,
            );
            host.dataset.previousSourceFilter = previousSourceFilter ?? "";
            host.dataset.previousSourceFilterPresent = String(
                previousSourceFilter !== undefined,
            );
            host.dataset.previousSourceStatus = previousSourceStatus ?? "";
            host.dataset.previousSourceStatusPresent = String(
                previousSourceStatus !== undefined,
            );
            host.dataset.previousTimeStyle = previousTimeStyle ?? "";
            host.dataset.previousTimeStylePresent = String(
                previousTimeStyle !== undefined,
            );
            host.style.position = "fixed";
            host.style.inset = "0";
            host.style.width = `${fixtureFrame.viewport.width}px`;
            host.style.height = `${fixtureFrame.viewport.height}px`;
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.overflow = "hidden";
            host.style.background = "var(--bg-canvas)";

            const stage = document.createElement("div");
            stage.className = "responsive-app-pixel-stage";
            stage.style.position = "relative";
            stage.style.width = "100%";
            stage.style.height = "100%";
            stage.style.overflow = "hidden";
            stage.style.background = "var(--bg-canvas)";
            stage.innerHTML = html;

            for (const image of stage.querySelectorAll("img")) {
                const src = image.getAttribute("src");
                if (src && assets[src]) {
                    image.setAttribute("src", assets[src]);
                }
            }

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            appHtml,
            assets: assetDataUrls,
            fixtureFrame: frame,
            fixtureId,
            fixtureTheme: theme,
        },
    );

    await waitForFixtureImages(page, fixtureId);
    const stage = page
        .locator(`#${fixtureId} > .responsive-app-pixel-stage`)
        .first();
    await expect(stage).toBeVisible();
    await page.waitForTimeout(250);
    const metrics = await stage.evaluate((element) => {
        const read = (selector: string) => {
            const node = element.querySelector<HTMLElement>(selector);
            if (!node) return null;
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return {
                display: style.display,
                gridTemplateColumns: style.gridTemplateColumns,
                height: Math.round(rect.height * 1000) / 1000,
                left: Math.round(rect.left * 1000) / 1000,
                position: style.position,
                right: Math.round(rect.right * 1000) / 1000,
                top: Math.round(rect.top * 1000) / 1000,
                width: Math.round(rect.width * 1000) / 1000,
                zIndex: style.zIndex,
            };
        };

        return {
            app: read(".app"),
            detail: read(".detail"),
            drawerScrim: read(".drawer-scrim"),
            drawerTrigger: read(".mobile-drawer-trigger"),
            main: read(".main"),
            sidebar: read(".sidebar"),
            stackStrip: read(".stack-strip"),
            workspace: read(".workspace"),
        };
    });
    const screenshot = await stage.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        const host = document.getElementById(id);
        if (!host) return;

        if (host.dataset.previousHtmlThemePresent === "true") {
            document.documentElement.dataset.theme =
                host.dataset.previousHtmlTheme ?? "";
        } else {
            delete document.documentElement.dataset.theme;
        }
        if (host.dataset.previousBodyThemePresent === "true") {
            document.body.dataset.theme = host.dataset.previousBodyTheme ?? "";
        } else {
            delete document.body.dataset.theme;
        }
        if (host.dataset.previousDrawerPresent === "true") {
            document.body.dataset.drawer = host.dataset.previousDrawer ?? "";
        } else {
            delete document.body.dataset.drawer;
        }
        if (host.dataset.previousSidebarPresent === "true") {
            document.body.dataset.sidebar = host.dataset.previousSidebar ?? "";
        } else {
            delete document.body.dataset.sidebar;
        }
        if (host.dataset.previousSourceFilterPresent === "true") {
            document.body.dataset.sourceFilter =
                host.dataset.previousSourceFilter ?? "";
        } else {
            delete document.body.dataset.sourceFilter;
        }
        if (host.dataset.previousSourceStatusPresent === "true") {
            document.body.dataset.sourceStatus =
                host.dataset.previousSourceStatus ?? "";
        } else {
            delete document.body.dataset.sourceStatus;
        }
        if (host.dataset.previousTimeStylePresent === "true") {
            document.body.dataset.timeStyle =
                host.dataset.previousTimeStyle ?? "";
        } else {
            delete document.body.dataset.timeStyle;
        }
        document
            .querySelector(`style[data-responsive-app-fixture="${id}"]`)
            ?.remove();
        host.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        metrics,
        screenshot,
    };
}

async function compareSourceRowPixels(
    page: Page,
    expected: string,
    actual: string,
): Promise<SourceRowPixelDiff> {
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
                    bounds: null,
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
            let minX = Number.POSITIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            let maxX = -1;
            let maxY = -1;
            for (let index = 0; index < expectedData.length; index += 4) {
                const pixelDelta = Math.max(
                    Math.abs(expectedData[index] - actualData[index]),
                    Math.abs(expectedData[index + 1] - actualData[index + 1]),
                    Math.abs(expectedData[index + 2] - actualData[index + 2]),
                    Math.abs(expectedData[index + 3] - actualData[index + 3]),
                );
                if (pixelDelta > 0) {
                    const pixelIndex = index / 4;
                    const x = pixelIndex % canvas.width;
                    const y = Math.floor(pixelIndex / canvas.width);
                    differingPixels += 1;
                    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }

            return {
                bounds:
                    differingPixels > 0
                        ? { maxX, maxY, minX, minY }
                        : null,
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

async function expectSourceRowPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    state: SourceRowSotState,
    rowHtml: string,
    sourceIconDataUrls: SourceIconDataUrls,
) {
    const originalProductViewport = page.viewportSize();
    const originalSotViewport = sotPage.viewportSize();

    try {
        for (const frame of SOURCE_ROW_PIXEL_FRAMES) {
            const [sotCapture, productCapture] = await Promise.all([
                captureSourceRowFixture(
                    sotPage,
                    rowHtml,
                    sourceIconDataUrls,
                    frame,
                ),
                captureSourceRowFixture(
                    page,
                    rowHtml,
                    sourceIconDataUrls,
                    frame,
                ),
            ]);
            const diff = await compareSourceRowPixels(
                page,
                sotCapture.dataUrl,
                productCapture.dataUrl,
            );

            if (
                !diff.dimensionsMatch ||
                diff.differingPixels > 0 ||
                diff.maxChannelDelta > 0
            ) {
                const name = `source-row-${state}-${frame.name}`
                    .replace(/[^a-z0-9]+/gi, "-")
                    .replace(/^-|-$/g, "")
                    .toLowerCase();
                await testInfo.attach(`${name}-sot.png`, {
                    body: sotCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${name}-product.png`, {
                    body: productCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${name}-diff.json`, {
                    body: Buffer.from(JSON.stringify(diff, null, 2)),
                    contentType: "application/json",
                });
                await testInfo.attach(`${name}-metrics.json`, {
                    body: Buffer.from(
                        JSON.stringify(
                            {
                                product: productCapture.metrics,
                                sot: sotCapture.metrics,
                            },
                            null,
                            2,
                        ),
                    ),
                    contentType: "application/json",
                });
                const debugDir = path.resolve(
                    process.cwd(),
                    "tmp/sot-pixel-debug",
                );
                await mkdir(debugDir, { recursive: true });
                await Promise.all([
                    writeFile(
                        path.join(debugDir, `${name}-sot.png`),
                        sotCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${name}-product.png`),
                        productCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${name}-diff.json`),
                        JSON.stringify(diff, null, 2),
                    ),
                    writeFile(
                        path.join(debugDir, `${name}-metrics.json`),
                        JSON.stringify(
                            {
                                product: productCapture.metrics,
                                sot: sotCapture.metrics,
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            const diffLabel = `${state} ${frame.name} ${JSON.stringify(diff)}`;
            expect(diff.dimensionsMatch, diffLabel).toBe(true);
            expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
            expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
            expect(diff.differingPixels, diffLabel).toBe(0);
            expect(diff.maxChannelDelta, diffLabel).toBe(0);
        }
    } finally {
        if (originalProductViewport) {
            await page.setViewportSize(originalProductViewport);
        }
        if (originalSotViewport) {
            await sotPage.setViewportSize(originalSotViewport);
        }
    }
}

async function captureDrawerFixture(
    page: Page,
    drawerHtml: { sidebarHtml: string; triggerHtml: string },
    assetDataUrls: SotAssetDataUrls,
    frame: DrawerPixelFrame,
) {
    const fixtureId = `sot-drawer-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.setViewportSize(frame.viewport);
    await page.mouse.move(0, 0);
    await page.evaluate(
        ({ assets, fixtureFrame, fixtureId: id, sidebarHtml, triggerHtml }) => {
            document.getElementById(id)?.remove();
            const previousDrawer = document.body.dataset.drawer;
            const previousSourceFilter = document.body.dataset.sourceFilter;
            document.body.dataset.drawer = fixtureFrame.bodyDataset.drawer;
            if (fixtureFrame.bodyDataset.sourceFilter) {
                document.body.dataset.sourceFilter =
                    fixtureFrame.bodyDataset.sourceFilter;
            } else {
                delete document.body.dataset.sourceFilter;
            }

            const host = document.createElement("div");
            host.id = id;
            host.dataset.previousDrawer = previousDrawer ?? "";
            host.dataset.previousDrawerPresent = String(
                previousDrawer !== undefined,
            );
            host.dataset.previousSourceFilter = previousSourceFilter ?? "";
            host.dataset.previousSourceFilterPresent = String(
                previousSourceFilter !== undefined,
            );
            host.style.position = "fixed";
            host.style.inset = "0 auto auto 0";
            host.style.width = `${fixtureFrame.viewport.width}px`;
            host.style.height = `${fixtureFrame.viewport.height}px`;
            host.style.zIndex = "2147483647";
            host.style.pointerEvents = "none";
            host.style.overflow = "hidden";
            host.style.background = "var(--bg-canvas)";

            const stage = document.createElement("div");
            stage.className = "drawer-pixel-stage";
            stage.style.position = "relative";
            stage.style.width = "100%";
            stage.style.height = "100%";
            stage.style.overflow = "hidden";
            stage.style.background = "var(--bg-canvas)";
            stage.innerHTML = [
                '<div class="app">',
                sidebarHtml,
                '<div class="drawer-scrim" id="drawer-scrim" aria-hidden="true"></div>',
                '<main class="main"><header class="topbar">',
                triggerHtml,
                '<div class="crumbs"><span class="crumb">全部录音</span></div>',
                "</header></main>",
                "</div>",
            ].join("");

            for (const image of stage.querySelectorAll("img")) {
                const src = image.getAttribute("src");
                if (src && assets[src]) {
                    image.setAttribute("src", assets[src]);
                }
            }

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        {
            assets: assetDataUrls,
            fixtureFrame: frame,
            fixtureId,
            sidebarHtml: drawerHtml.sidebarHtml,
            triggerHtml: drawerHtml.triggerHtml,
        },
    );

    await waitForFixtureImages(page, fixtureId);
    const targetSelector =
        frame.target === "trigger" ? "#drawer-trigger" : ".sidebar";
    const target = page.locator(`#${fixtureId} ${targetSelector}`).first();
    await expect(target).toBeVisible();
    await page.waitForTimeout(250);
    const metrics = await target.evaluate((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
            backgroundColor: style.backgroundColor,
            borderRadius: style.borderRadius,
            boxShadow: style.boxShadow,
            color: style.color,
            display: style.display,
            height: Math.round(rect.height * 1000) / 1000,
            left: Math.round(rect.left * 1000) / 1000,
            opacity: style.opacity,
            padding: style.padding,
            position: style.position,
            top: Math.round(rect.top * 1000) / 1000,
            width: Math.round(rect.width * 1000) / 1000,
            zIndex: style.zIndex,
        };
    });
    const screenshot = await target.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await page.evaluate((id) => {
        const host = document.getElementById(id);
        if (host?.dataset.previousDrawerPresent === "true") {
            document.body.dataset.drawer = host.dataset.previousDrawer ?? "";
        } else {
            delete document.body.dataset.drawer;
        }
        if (host?.dataset.previousSourceFilterPresent === "true") {
            document.body.dataset.sourceFilter =
                host.dataset.previousSourceFilter ?? "";
        } else {
            delete document.body.dataset.sourceFilter;
        }
        host?.remove();
    }, fixtureId);

    return {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        metrics,
        screenshot,
    };
}

async function expectDrawerResponsivePixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
) {
    const originalProductViewport = page.viewportSize();
    const originalSotViewport = sotPage.viewportSize();

    try {
        const drawerHtml = await readSotDrawerFixtureHtml(sotPage);
        const assetDataUrls = await readSotDrawerAssetDataUrls();

        for (const frame of DRAWER_PIXEL_FRAMES) {
            const [sotCapture, productCapture] = await Promise.all([
                captureDrawerFixture(sotPage, drawerHtml, assetDataUrls, frame),
                captureDrawerFixture(page, drawerHtml, assetDataUrls, frame),
            ]);
            const diff = await compareSourceRowPixels(
                page,
                sotCapture.dataUrl,
                productCapture.dataUrl,
            );

            if (
                !diff.dimensionsMatch ||
                diff.differingPixels > 0 ||
                diff.maxChannelDelta > 0
            ) {
                const name = `drawer-${frame.name}`
                    .replace(/[^a-z0-9]+/gi, "-")
                    .replace(/^-|-$/g, "")
                    .toLowerCase();
                await testInfo.attach(`${name}-sot.png`, {
                    body: sotCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${name}-product.png`, {
                    body: productCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${name}-diff.json`, {
                    body: Buffer.from(JSON.stringify(diff, null, 2)),
                    contentType: "application/json",
                });
                await testInfo.attach(`${name}-metrics.json`, {
                    body: Buffer.from(
                        JSON.stringify(
                            {
                                product: productCapture.metrics,
                                sot: sotCapture.metrics,
                            },
                            null,
                            2,
                        ),
                    ),
                    contentType: "application/json",
                });
                const debugDir = path.resolve(
                    process.cwd(),
                    "tmp/sot-pixel-debug",
                );
                await mkdir(debugDir, { recursive: true });
                await Promise.all([
                    writeFile(
                        path.join(debugDir, `${name}-sot.png`),
                        sotCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${name}-product.png`),
                        productCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${name}-diff.json`),
                        JSON.stringify(diff, null, 2),
                    ),
                    writeFile(
                        path.join(debugDir, `${name}-metrics.json`),
                        JSON.stringify(
                            {
                                product: productCapture.metrics,
                                sot: sotCapture.metrics,
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            const diffLabel = `${frame.name} ${JSON.stringify(diff)}`;
            expect(diff.dimensionsMatch, diffLabel).toBe(true);
            expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
            expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
            expect(diff.differingPixels, diffLabel).toBe(0);
            expect(diff.maxChannelDelta, diffLabel).toBe(0);
        }
    } finally {
        if (originalProductViewport) {
            await page.setViewportSize(originalProductViewport);
        }
        if (originalSotViewport) {
            await sotPage.setViewportSize(originalSotViewport);
        }
    }
}

async function expectResponsiveAppPixelMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    options: {
        attachPrefix?: string;
        pixelSemantics?: string;
        theme?: ResolvedTheme;
    } = {},
) {
    const originalProductViewport = page.viewportSize();
    const originalSotViewport = sotPage.viewportSize();
    const pixelSemantics =
        options.pixelSemantics ?? "canonical-dark-sot-css-pixel-parity";
    const theme = options.theme ?? "dark";
    const evidence: ResponsiveAppPixelEvidence[] = [];

    try {
        const [appHtml, assetDataUrls] = await Promise.all([
            readSotResponsiveAppHtml(sotPage),
            readSotDrawerAssetDataUrls(),
        ]);

        for (const frame of RESPONSIVE_APP_PIXEL_FRAMES) {
            const [sotCapture, productCapture] = await Promise.all([
                captureResponsiveAppFixture(
                    sotPage,
                    appHtml,
                    assetDataUrls,
                    frame,
                    theme,
                ),
                captureResponsiveAppFixture(
                    page,
                    appHtml,
                    assetDataUrls,
                    frame,
                    theme,
                ),
            ]);
            const diff = await compareSourceRowPixels(
                page,
                sotCapture.dataUrl,
                productCapture.dataUrl,
            );

            const exceedsSubpixelTolerance =
                diff.differingPixels > 512 || diff.maxChannelDelta > 1;
            if (!diff.dimensionsMatch || exceedsSubpixelTolerance) {
                const name = `${options.attachPrefix ?? "responsive-app"}-${frame.name}`
                    .replace(/[^a-z0-9]+/gi, "-")
                    .replace(/^-|-$/g, "")
                    .toLowerCase();
                await testInfo.attach(`${name}-sot.png`, {
                    body: sotCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${name}-product.png`, {
                    body: productCapture.screenshot,
                    contentType: "image/png",
                });
                await testInfo.attach(`${name}-diff.json`, {
                    body: Buffer.from(JSON.stringify(diff, null, 2)),
                    contentType: "application/json",
                });
                await testInfo.attach(`${name}-metrics.json`, {
                    body: Buffer.from(
                        JSON.stringify(
                            {
                                product: productCapture.metrics,
                                sot: sotCapture.metrics,
                            },
                            null,
                            2,
                        ),
                    ),
                    contentType: "application/json",
                });
                const debugDir = path.resolve(
                    process.cwd(),
                    "tmp/sot-pixel-debug",
                );
                await mkdir(debugDir, { recursive: true });
                await Promise.all([
                    writeFile(
                        path.join(debugDir, `${name}-sot.png`),
                        sotCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${name}-product.png`),
                        productCapture.screenshot,
                    ),
                    writeFile(
                        path.join(debugDir, `${name}-diff.json`),
                        JSON.stringify(diff, null, 2),
                    ),
                    writeFile(
                        path.join(debugDir, `${name}-metrics.json`),
                        JSON.stringify(
                            {
                                product: productCapture.metrics,
                                sot: sotCapture.metrics,
                            },
                            null,
                            2,
                        ),
                    ),
                ]);
            }

            const diffLabel = `${theme} ${frame.name} ${JSON.stringify(diff)}`;
            expect(diff.dimensionsMatch, diffLabel).toBe(true);
            expect(diff.productHeight, diffLabel).toBe(diff.expectedHeight);
            expect(diff.productWidth, diffLabel).toBe(diff.expectedWidth);
            expect(diff.differingPixels, diffLabel).toBeLessThanOrEqual(512);
            expect(diff.maxChannelDelta, diffLabel).toBeLessThanOrEqual(1);

            evidence.push({
                diff,
                frame: frame.name,
                pixelSemantics,
                productMetrics: productCapture.metrics,
                result: "PASS",
                resolvedTheme: theme,
                sotMetrics: sotCapture.metrics,
                viewport: frame.viewport,
            });
        }
    } finally {
        if (originalProductViewport) {
            await page.setViewportSize(originalProductViewport);
        }
        if (originalSotViewport) {
            await sotPage.setViewportSize(originalSotViewport);
        }
    }

    return evidence;
}

async function readAppShellRuntimeThemeEvidence(
    page: Page,
    expectedResolvedTheme: ResolvedTheme,
) {
    await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        expectedResolvedTheme,
    );

    return page.evaluate(() => {
        const readElement = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) return null;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return {
                backgroundColor: style.backgroundColor,
                color: style.color,
                display: style.display,
                gridTemplateColumns: style.gridTemplateColumns,
                height: Math.round(rect.height * 1000) / 1000,
                left: Math.round(rect.left * 1000) / 1000,
                position: style.position,
                top: Math.round(rect.top * 1000) / 1000,
                width: Math.round(rect.width * 1000) / 1000,
                zIndex: style.zIndex,
            };
        };
        const root = document.documentElement;
        const rootStyle = window.getComputedStyle(root);
        const bodyStyle = window.getComputedStyle(document.body);

        return {
            bodyBackgroundColor: bodyStyle.backgroundColor,
            bodyColor: bodyStyle.color,
            bodyDataTheme: document.body.dataset.theme ?? null,
            cssVariables: {
                bgCanvas: rootStyle.getPropertyValue("--bg-canvas").trim(),
                bgElevated: rootStyle
                    .getPropertyValue("--bg-elevated")
                    .trim(),
                fgPrimary: rootStyle.getPropertyValue("--fg-primary").trim(),
                lineHairline: rootStyle
                    .getPropertyValue("--line-hairline")
                    .trim(),
            },
            elements: {
                app: readElement(".app"),
                detail: readElement(".detail"),
                main: readElement(".main"),
                sidebar: readElement(".sidebar"),
                workspace: readElement(".workspace"),
            },
            htmlDataTheme: root.dataset.theme ?? null,
            localStorageTheme: window.localStorage.getItem("theme"),
            prefersDark: window.matchMedia("(prefers-color-scheme: dark)")
                .matches,
            prefersLight: window.matchMedia("(prefers-color-scheme: light)")
                .matches,
        };
    });
}

async function writeAppShellThemeMatrixEvidence(
    axes: AppShellThemeAxisEvidence[],
) {
    await mkdir(APP_SHELL_THEME_MATRIX_DIR, { recursive: true });
    await writeFile(
        APP_SHELL_THEME_MATRIX_JSON,
        `${JSON.stringify(
            {
                commandResults: [
                    {
                        command:
                            'PLAYWRIGHT_USE_SYSTEM_CHROME=1 bunx playwright test e2e/dashboard-source-filter-stack.spec.ts --grep "dashboard app shell theme frames match SOT web index pixels" --timeout=240000 --trace=off',
                        status: "PASS",
                        summary:
                            "Focused Playwright matrix wrote this JSON after all dark/light/system-resolved axes passed.",
                    },
                ],
                generatedAt: new Date().toISOString(),
                nonClaims: [
                    "Row 94 remains PARTIAL.",
                    "Light is not claimed as canonical SOT Web/index visual parity because Web/index initializes Tweaks.theme to dark.",
                    "The light axis is product theme-resolution plus SOT CSS light-branch pixel parity evidence.",
                    "This does not close broader app-shell runtime states or all-page/all-control acceptance.",
                ],
                residualGaps: [
                    "No separate canonical light SOT Web/index startup target was found.",
                    "System-resolved evidence covers theme=system under an emulated dark OS preference; system-resolved-light canonical parity is not claimed.",
                    "Runtime states beyond the covered desktop expanded/collapsed, tablet overlay, and mobile drawer frames remain pending.",
                    "Broader all-page/all-control acceptance remains pending.",
                ],
                scope: {
                    matrixRow: 94,
                    status: "PARTIAL",
                    surface: "App shell",
                },
                sotThemeBoundary: {
                    canonicalStartupTheme: "dark",
                    evidence:
                        "ui_kits/web/index.html TWEAKS.theme is dark and applyTweaks writes html/body data-theme from that value.",
                    lightBranch:
                        "colors_and_type.css defines light tokens in :root and dark overrides under .dark/[data-theme=dark]; light branch is available for CSS parity evidence but is not the Web/index startup canonical visual.",
                },
                themeAxes: axes,
            },
            null,
            2,
        )}\n`,
    );
}

function createSineWaveWavBuffer() {
    const sampleRate = 8000;
    const durationSeconds = 1;
    const sampleCount = sampleRate * durationSeconds;
    const bytesPerSample = 2;
    const dataSize = sampleCount * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
    buffer.writeUInt16LE(bytesPerSample, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    for (let index = 0; index < sampleCount; index += 1) {
        const sample = Math.sin((index / sampleRate) * 440 * Math.PI * 2);
        buffer.writeInt16LE(Math.round(sample * 12_000), 44 + index * 2);
    }

    return buffer;
}

async function writeStackAudioFixture(audioKey: string) {
    const audioPath = path.join(E2E_STORAGE_DIR, audioKey);
    assertE2EStoragePath(audioPath);
    await mkdir(path.dirname(audioPath), { recursive: true });
    await writeFile(audioPath, createSineWaveWavBuffer());
}

async function removeStackAudioFixtures() {
    const audioDirectory = path.join(E2E_STORAGE_DIR, STACK_AUDIO_DIR);
    assertE2EStoragePath(audioDirectory);
    await rm(audioDirectory, { recursive: true, force: true });
}

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await client.execute({
            sql: "SELECT id FROM `users` WHERE email = ? LIMIT 1",
            args: ["playwright-admin@example.com"],
        });
        const id = result.rows[0]?.id;
        if (typeof id !== "string") {
            throw new Error("Playwright user not found");
        }
        return id;
    } finally {
        await client.close();
    }
}

async function cleanupStackSeeds(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const transcripts = createClient({ url: databaseUrl(TRANSCRIPTS_DB) });

    try {
        await transcripts.execute({
            sql: "DELETE FROM source_artifact_segments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcript_segments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM source_artifacts WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await transcripts.execute({
            sql: "DELETE FROM transcriptions WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM transcription_jobs WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM recording_tag_assignments WHERE user_id = ? AND recording_id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
        await library.execute({
            sql: "DELETE FROM recordings WHERE user_id = ? AND id LIKE ?",
            args: [userId, `${STACK_RECORDING_PREFIX}%`],
        });
    } finally {
        await library.close();
        await transcripts.close();
    }
}

async function seedStackRecording(
    userId: string,
    options: { provider?: string } = {},
) {
    const provider = options.provider ?? "iflyrec";
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now();
    const recordingId = `${STACK_RECORDING_PREFIX}${provider}`;

    try {
        await cleanupStackSeeds(userId);
        await library.execute({
            sql: `
                INSERT OR REPLACE INTO recordings (
                    id, user_id, source_provider, source_recording_id, source_version,
                    source_metadata, provider_device_id, filename, duration, start_time,
                    end_time, filesize, file_md5, storage_type, storage_path,
                    downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                recordingId,
                userId,
                provider,
                `${recordingId}-source`,
                "1",
                "{}",
                `${STACK_RECORDING_PREFIX}device`,
                `E2E source filter stack ${provider}`,
                90_000,
                now - 90_000,
                now,
                2048,
                recordingId,
                "local",
                "",
                now,
                0,
                0,
                now,
                now,
            ],
        });
    } finally {
        await library.close();
    }
}

async function seedAutoNextStackRecordings(userId: string) {
    const library = createClient({ url: databaseUrl(LIBRARY_DB) });
    const now = Date.now() + 7 * 86_400_000;
    const recordings = [
        {
            id: `${STACK_RECORDING_PREFIX}autonext-ticnote-newer`,
            filename: "E2E auto next TicNote newer",
            provider: "ticnote",
            startTime: now,
        },
        {
            id: `${STACK_RECORDING_PREFIX}autonext-plaud-middle`,
            filename: "E2E auto next Plaud middle",
            provider: "plaud",
            startTime: now - 60_000,
        },
        {
            id: `${STACK_RECORDING_PREFIX}autonext-ticnote-older`,
            filename: "E2E auto next TicNote older",
            provider: "ticnote",
            startTime: now - 120_000,
        },
    ];

    try {
        await cleanupStackSeeds(userId);
        await removeStackAudioFixtures();
        for (const recording of recordings) {
            const audioKey = `${STACK_AUDIO_PREFIX}${recording.id}.wav`;
            await writeStackAudioFixture(audioKey);
            await library.execute({
                sql: `
                    INSERT OR REPLACE INTO recordings (
                        id, user_id, source_provider, source_recording_id, source_version,
                        source_metadata, provider_device_id, filename, duration, start_time,
                        end_time, filesize, file_md5, storage_type, storage_path,
                        downloaded_at, upstream_trashed, upstream_deleted, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    recording.id,
                    userId,
                    recording.provider,
                    `${recording.id}-source`,
                    "1",
                    "{}",
                    `${STACK_RECORDING_PREFIX}autonext-device`,
                    recording.filename,
                    60_000,
                    recording.startTime,
                    recording.startTime + 60_000,
                    2048,
                    recording.id,
                    "local",
                    audioKey,
                    now,
                    0,
                    0,
                    now,
                    now,
                ],
            });
        }
    } finally {
        await library.close();
    }
}

function healthyWorkerStatus() {
    const now = new Date();

    return {
        autoSyncEnabled: true,
        lastSyncTime: now.toISOString(),
        nextSyncTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        workerStatus: {
            healthy: true,
            isRunning: false,
            lastHeartbeatAt: now.toISOString(),
            lastStartedAt: null,
            lastFinishedAt: now.toISOString(),
            nextRunAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
            manualTriggerRequestedAt: null,
            lastError: null,
            lastSummary: {
                newRecordings: 0,
                updatedRecordings: 0,
                removedRecordings: 0,
                errorCount: 0,
            },
        },
    };
}

function unhealthyWorkerStatus() {
    const now = new Date();
    const healthyStatus = healthyWorkerStatus();

    return {
        ...healthyStatus,
        workerStatus: {
            ...healthyStatus.workerStatus,
            healthy: false,
            lastHeartbeatAt: new Date(
                now.getTime() - 2 * 60 * 1000,
            ).toISOString(),
            lastFinishedAt: null,
            lastError: "E2E source sync failed.",
            lastSummary: {
                newRecordings: 0,
                updatedRecordings: 0,
                removedRecordings: 0,
                errorCount: 1,
            },
        },
    };
}

function runningWorkerStatus() {
    const now = new Date();
    const healthyStatus = healthyWorkerStatus();

    return {
        ...healthyStatus,
        workerStatus: {
            ...healthyStatus.workerStatus,
            isRunning: true,
            lastStartedAt: now.toISOString(),
            lastFinishedAt: null,
        },
    };
}

async function mockSyncEndpoint(
    page: Page,
    options: { initialStatus?: "healthy" | "unhealthy" | "running" } = {},
) {
    let status = options.initialStatus ?? "healthy";

    await page.route("**/api/data-sources/sync", async (route) => {
        if (route.request().method() === "POST") {
            status = "healthy";
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    success: true,
                    queued: false,
                    newRecordings: 0,
                }),
            });
            return;
        }

        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(
                    status === "unhealthy"
                        ? unhealthyWorkerStatus()
                        : status === "running"
                          ? runningWorkerStatus()
                        : healthyWorkerStatus(),
                ),
            });
            return;
        }

        await route.continue();
    });
}

type MockDataSourceOverride = {
    connected?: boolean;
    connectionStatus?: string;
    enabled?: boolean;
    runtimeStatus?: string;
    secretsConfigured?: Record<string, boolean>;
};

async function mockConnectedDataSources(
    page: Page,
    providers: string[],
    overrides: Record<string, MockDataSourceOverride> = {},
) {
    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        const capabilities = {
            audioDownload: false,
            localRename: true,
            officialSummary: true,
            officialTranscript: true,
            privateTranscribe: false,
            upstreamTitleWriteback: false,
            workerSync: true,
        };
        const connectedProviders = new Set(providers);

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                sources: [
                    "plaud",
                    "ticnote",
                    "feishu-minutes",
                    "dingtalk-a1",
                    "iflyrec",
                ].map((provider) => {
                    const override = overrides[provider] ?? {};
                    const connected =
                        override.connected ?? connectedProviders.has(provider);
                    return {
                        authMode:
                            provider === "iflyrec"
                                ? "session-header"
                                : "bearer",
                        authModes:
                            provider === "iflyrec"
                                ? ["session-header"]
                                : ["bearer"],
                        baseUrl: "https://example.invalid",
                        capabilities,
                        config: {},
                        connected,
                        connectionStatus:
                            override.connectionStatus ?? "ready",
                        displayName:
                            provider === "iflyrec" ? "讯飞听见" : provider,
                        enabled: override.enabled ?? connected,
                        lastSync: null,
                        provider,
                        runtimeStatus: override.runtimeStatus ?? "active",
                        secretsConfigured:
                            override.secretsConfigured ??
                            (connected
                                ? provider === "iflyrec"
                                    ? { sessionId: true }
                                    : { bearerToken: true }
                                : {}),
                    };
                }),
            }),
        });
    });
}

async function openDashboard(
    page: Parameters<typeof ensureSignedIn>[0],
    options: {
        connectIflyrec?: boolean;
        theme?: ThemeMode;
        uiLanguage?: "zh-CN" | "en";
    } = {},
) {
    if (options.connectIflyrec) {
        await mockConnectedDataSources(page, ["iflyrec"]);
    } else {
        await mockConnectedDataSources(page, []);
    }

    await ensureSignedIn(page);

    const expectedLanguage = options.uiLanguage ?? "zh-CN";
    const resetDisplay = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: options.theme ?? "dark",
            uiLanguage: expectedLanguage,
        },
    });
    expect(resetDisplay.ok()).toBe(true);
    const displayState = await page.request.get("/api/settings/display");
    expect(displayState.ok()).toBe(true);
    await expect.poll(async () => {
        const response = await page.request.get("/api/settings/display");
        const body = (await response.json()) as { uiLanguage?: string };
        return body.uiLanguage;
    }).toBe(expectedLanguage);

    const displayLoaded = page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/settings/display") &&
                response.request().method() === "GET" &&
                response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
    const dataSourcesLoaded = page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources") && response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
    const tagsLoaded = page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/recording-tags") && response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
    await page.goto("about:blank");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await displayLoaded;
    await expect(dashboardWorkstation(page)).toHaveAttribute(
        "data-sot-state",
        "ready",
    );
    await dataSourcesLoaded;
    await tagsLoaded;
}

async function reloadDashboardWithTheme(
    page: Page,
    options: {
        theme: ThemeMode;
        uiLanguage?: "zh-CN" | "en";
    },
) {
    const expectedLanguage = options.uiLanguage ?? "zh-CN";
    const resetDisplay = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: options.theme,
            uiLanguage: expectedLanguage,
        },
    });
    expect(resetDisplay.ok()).toBe(true);
    await expect.poll(async () => {
        const response = await page.request.get("/api/settings/display");
        const body = (await response.json()) as { uiLanguage?: string };
        return body.uiLanguage;
    }).toBe(expectedLanguage);

    const displayLoaded = page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/settings/display") &&
                response.request().method() === "GET" &&
                response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
    await page.goto("about:blank");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await displayLoaded;
    await expect(dashboardWorkstation(page)).toHaveAttribute(
        "data-sot-state",
        "ready",
    );
}

async function activeElementIsInsideSourceDrawer(page: Page) {
    return page.locator(".sidebar").evaluate((node) => {
        return node.contains(document.activeElement);
    });
}

async function expectBodyDrawerState(page: Page, state: "closed" | "open") {
    await expect(page.locator("body")).toHaveAttribute("data-drawer", state);
}

async function readResponsiveMetrics(page: Page) {
    return page.evaluate(() => {
        const read = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) return null;
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return {
                display: style.display,
                gridTemplateColumns: style.gridTemplateColumns,
                height: Math.round(rect.height),
                left: Math.round(rect.left),
                position: style.position,
                right: Math.round(rect.right),
                visibility: style.visibility,
                width: Math.round(rect.width),
                zIndex: style.zIndex,
            };
        };
        const root = document.documentElement;
        const body = document.body;
        return {
            bodyDrawer: body.dataset.drawer ?? null,
            detail: read(".detail"),
            drawerTrigger: read(".mobile-drawer-trigger"),
            overflow:
                Math.max(root.scrollWidth, body.scrollWidth) -
                root.clientWidth,
            scrim: read(".drawer-scrim"),
            sourceRail: read(".sidebar"),
            viewportWidth: window.innerWidth,
            workspace: read(".workspace"),
        };
    });
}

async function expectResponsiveFrame(
    page: Page,
    mode: "desktop" | "tablet-closed" | "mobile-closed" | "mobile-open",
) {
    const metrics = await readResponsiveMetrics(page);
    const workspaceColumns =
        metrics.workspace?.gridTemplateColumns.split(" ").filter(Boolean) ?? [];
    expect(metrics.overflow, `${mode} horizontal overflow`).toBeLessThanOrEqual(
        2,
    );

    if (mode === "desktop") {
        expect(metrics.drawerTrigger?.display).toBe("none");
        expect(metrics.sourceRail?.display).not.toBe("none");
        expect(metrics.detail?.display).not.toBe("none");
        expect(workspaceColumns.length).toBeGreaterThanOrEqual(2);
        return;
    }

    expect(metrics.drawerTrigger?.display).not.toBe("none");
    expect(metrics.detail?.display).toBe("none");
    expect(workspaceColumns).toEqual(["380px", "0px"]);

    if (mode === "mobile-open") {
        expect(metrics.bodyDrawer).toBe("open");
        expect(metrics.scrim?.zIndex).toBe("300");
        expect(metrics.sourceRail?.display).toBe("flex");
        expect(metrics.sourceRail?.position).toBe("fixed");
        expect(metrics.sourceRail?.zIndex).toBe("310");
        expect(metrics.sourceRail?.left).toBeGreaterThanOrEqual(0);
        expect(metrics.sourceRail?.right).toBeLessThanOrEqual(
            metrics.viewportWidth,
        );
        return;
    }

    expect(metrics.bodyDrawer).toBe("closed");
    expect(metrics.sourceRail?.display).toBe("none");
}

function dashboardWorkstation(page: Page) {
    return page.locator('[data-sot-surface="dashboard-workstation"]');
}

function sourceProvider(page: Page, provider: string) {
    return page.locator(
        `[data-sot-control="dashboard-source-provider"][data-sot-provider="${provider}"]`,
    );
}

function favoriteControl(page: Page, favorite: string) {
    return page.locator(
        `[data-sot-control="dashboard-favorite"][data-sot-filter="${favorite}"]`,
    );
}

function sourceFilterStack(page: Page) {
    return page.locator('[data-sot-panel="dashboard-source-filter-stack"]');
}

function sourceFilterAction(page: Page, control: string) {
    return page.locator(`[data-sot-control="${control}"]`);
}

function sourceList(page: Page) {
    return page.locator('[data-sot-list="dashboard-sources"]');
}

function recordingRow(page: Page, id: string) {
    return page.locator(`[data-sot-recording-id="${id}"]`);
}

function selectedRecordingTitle(page: Page, title: string | RegExp) {
    return page.getByRole("heading", { name: title });
}

async function expectFavoriteButtonSurface(
    page: Page,
    favorite: "all" | "transcribed" | "tags",
    options: { active?: boolean } = {},
) {
    const favoriteButton = favoriteControl(page, favorite);
    await expect(favoriteButton).toBeVisible();
    if (options.active) {
        await expect(favoriteButton).toHaveAttribute("data-sot-state", "selected");
        await expect(favoriteButton).toHaveAttribute("aria-pressed", "true");
    }

    const countBadge = favoriteButton.locator(
        '[data-sot-part="dashboard-favorite-count"]',
    );
    await expect(countBadge).toBeVisible();
}

async function expectSourceFilterStackActionSurface(action: Locator) {
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute("data-sot-control", /.+/);
}

test("dashboard SourceRow states match SOT source row pixels under sidebar scope", async ({
    page,
}, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 760 });

    const sotPage = await page.context().newPage();
    try {
        await openSotComponentLibrary(sotPage);
        const sotRows = await readSotSourceRowHtml(sotPage);
        const sourceIconDataUrls = await readSotSourceIconDataUrls();

        await openDashboard(page, {
            connectIflyrec: true,
            theme: "light",
            uiLanguage: "zh-CN",
        });

        const runtimeRows = sourceList(page).locator(
            '[data-sot-control="dashboard-source-provider"]',
        );
        await expect(runtimeRows).toHaveCount(5);
        const runtimeSignatures = await runtimeRows.evaluateAll((rows) =>
            rows.map((row) => {
                const sourceAction = row.querySelector(
                    '[data-sot-part="source-provider-action"]',
                );
                const sourceCount = row.querySelector(
                    '[data-sot-part="source-provider-count"]',
                );
                const sourceStatus = row.querySelector(
                    '[data-sot-part="source-provider-status"]',
                );
                return {
                    action: sourceAction?.getAttribute("data-sot-action") ?? null,
                    actionState: row.getAttribute("data-sot-action-state"),
                    className: row.getAttribute("class") ?? "",
                    hasCountOrAction: Boolean(sourceAction) !== Boolean(sourceCount),
                    hasStatus: Boolean(sourceStatus),
                    provider: row.getAttribute("data-sot-provider"),
                    state: row.getAttribute("data-state"),
                    status: row.getAttribute("data-sot-status"),
                    sotControl: row.getAttribute("data-sot-control"),
                    sotState: row.getAttribute("data-sot-state"),
                };
            }),
        );
        for (const signature of runtimeSignatures) {
            expect(signature.sotControl).toBe("dashboard-source-provider");
            expect(signature.provider).toBeTruthy();
            expect(signature.state).toBe(signature.sotState);
            expect(signature.status).toBeTruthy();
            expect(signature.hasStatus).toBe(true);
            expect(signature.hasCountOrAction).toBe(true);
            expect(signature.className).not.toContain("nav-item");
            if (signature.action) {
                expect(signature.actionState).toBe(signature.action);
            }
        }

        for (const state of SOURCE_ROW_SOT_STATES) {
            await expectSourceRowPixelMatch(
                page,
                testInfo,
                sotPage,
                state,
                sotRows[state],
                sourceIconDataUrls,
            );
        }
    } finally {
        await sotPage.close();
    }
});

test("dashboard source filter stack exposes clear and setup actions", async ({
    page,
}) => {
    await openDashboard(page, { connectIflyrec: true });

    await expectFavoriteButtonSurface(page, "all", { active: true });

    const iflyrecRow = sourceProvider(page, "iflyrec");
    await expect(iflyrecRow).toBeVisible();
    await expect(iflyrecRow).toHaveAttribute(
        "data-sot-status",
        /needs-setup|planned|paused|expired|connected-empty|no-results|connected|sync-error/,
    );
    const iflyrecInitial = iflyrecRow.locator(
        '[data-sot-part="source-provider-mark"]',
    );
    await expect(iflyrecInitial).toBeVisible();
    const iflyrecBadge = iflyrecRow.locator(
        '[data-sot-part="source-provider-action"], [data-sot-part="source-provider-count"]',
    ).first();
    await expect(iflyrecBadge).toBeVisible();
    await iflyrecRow.click();
    await expect(iflyrecRow).toHaveAttribute("aria-pressed", "true");
    await expect(iflyrecRow).toHaveAttribute("data-active", "true");
    await expect(iflyrecRow).toHaveAttribute(
        "data-sot-state",
        "connected-active",
    );
    await expect(iflyrecRow).toHaveAttribute("data-state", "connected-active");
    await expect(iflyrecRow).toHaveAttribute("data-slot", "button");
    await expect(iflyrecBadge).toBeVisible();

    const stack = sourceFilterStack(page);
    await expect(stack).toBeVisible();
    await expect(stack).toHaveAttribute(
        "data-sot-status",
        /needs-setup|planned|paused|expired|connected-empty|no-results|connected|sync-error/,
    );
    await expect(stack).toHaveAttribute("data-sot-provider", "iflyrec");
    await expect(stack).toContainText("讯飞听见");
    const providerChip = stack.locator('[data-sot-part="source-filter-chip"]');
    await expect(providerChip).toBeVisible();

    const clearSource = sourceFilterAction(page, "source-filter-clear");
    await expect(clearSource).toBeVisible();
    await clearSource.click();
    await expect(stack).toBeHidden();

    await iflyrecRow.click();
    await expect(stack).toBeVisible();

    const settingsAction = sourceFilterAction(
        page,
        "source-filter-open-settings",
    );
    if (await settingsAction.isVisible()) {
        await expectSourceFilterStackActionSurface(settingsAction);
        await settingsAction.click();
        await expect(page.locator('[data-sot-surface="settings-shell"]')).toBeVisible();
        await expect(page.locator('[data-sot-surface="settings-shell"]')).toHaveAttribute(
            "data-sot-section",
            "data-sources",
        );
    }
});

test("dashboard source filter stack follows English display language", async ({
    page,
}) => {
    await openDashboard(page, { connectIflyrec: true, uiLanguage: "en" });

    const sourceRows = sourceList(page);
    await expect(sourceRows).toBeVisible();
    await expect(sourceRows).toHaveAttribute("data-sot-state", "ready");

    const iflyrecRow = sourceProvider(page, "iflyrec");
    await expect(iflyrecRow).toBeVisible();
    await iflyrecRow.click();

    const stack = sourceFilterStack(page);
    await expect(stack).toBeVisible();
    await expect(stack).toContainText("Filter");
    await expect(stack).toContainText("All recordings");
    await expect(stack).toContainText("Showing");
    await expect(
        stack.getByRole("button", { name: "Clear source filter" }),
    ).toBeVisible();
    const clearAll = sourceFilterAction(page, "source-filter-clear-all");
    await expect(clearAll).toBeVisible();
    await expect(clearAll).toHaveAccessibleName("Clear all");
    await expect(sourceRows.getByRole("button", { name: "Clear" })).toBeVisible();
});

test("dashboard source setup rows open Data Sources settings", async ({ page }) => {
    await openDashboard(page);

    const iflyrecRow = sourceProvider(page, "iflyrec");
    await expect(iflyrecRow).toBeVisible();
    await iflyrecRow.click();
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toBeVisible();
    await expect(page.locator('[data-sot-surface="settings-shell"]')).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );
    await expect(
        page.locator(
            '[data-sot-panel="source-provider-detail"][data-sot-provider="iflyrec"]',
        ),
    ).toBeVisible();
});

test("dashboard source rows reflect expired, paused, and syncing backend states", async ({
    page,
}) => {
    await mockSyncEndpoint(page, { initialStatus: "running" });
    await mockConnectedDataSources(
        page,
        ["ticnote", "plaud", "iflyrec"],
        {
            ticnote: { connectionStatus: "expired" },
            plaud: { enabled: false },
        },
    );
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedStackRecording(userId, { provider: "iflyrec" });
        const resetDisplay = await page.request.put("/api/settings/display", {
            data: {
                dateTimeFormat: "relative",
                itemsPerPage: 50,
                recordingListSortOrder: "newest",
                theme: "dark",
                uiLanguage: "zh-CN",
            },
        });
        expect(resetDisplay.ok()).toBe(true);

        const dataSourcesLoaded = page
            .waitForResponse(
                (response) =>
                    response.url().includes("/api/data-sources") &&
                    response.ok(),
                { timeout: 15_000 },
            )
            .catch(() => null);
        await reloadDashboardWithTheme(page, {
            theme: "dark",
            uiLanguage: "zh-CN",
        });
        await expect(dashboardWorkstation(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        await dataSourcesLoaded;

        const expiredRow = sourceProvider(page, "ticnote");
        await expect(expiredRow).toHaveAttribute(
            "data-sot-status",
            "expired",
        );
        await expect(expiredRow).toHaveAttribute("data-sot-state", "expired");
        await expect(expiredRow).toHaveAttribute("data-state", "expired");
        await expect(expiredRow).toHaveAttribute(
            "data-sot-action-state",
            "reauth",
        );
        await expect(
            expiredRow.locator('[data-sot-part="source-provider-status"]'),
        ).toBeVisible();
        const expiredAction = expiredRow.locator(
            '[data-sot-part="source-provider-action"]',
        );
        await expect(expiredAction).toBeVisible();
        await expect(expiredAction).toHaveAttribute("data-sot-action", "reauth");

        const pausedRow = sourceProvider(page, "plaud");
        await expect(pausedRow).toHaveAttribute("data-sot-status", "paused");
        await expect(pausedRow).toHaveAttribute("data-sot-state", "disabled");
        await expect(pausedRow).toHaveAttribute("data-state", "disabled");
        await expect(pausedRow).toHaveAttribute(
            "data-sot-action-state",
            "disabled",
        );
        await expect(pausedRow).toBeDisabled();
        await expect(pausedRow).toHaveAttribute("aria-disabled", "true");
        await expect(
            pausedRow.locator('[data-sot-part="source-provider-action"]'),
        ).toHaveCount(0);
        await expect(
            pausedRow.locator('[data-sot-part="source-provider-count"]'),
        ).toHaveText("0");

        const syncingRow = sourceProvider(page, "iflyrec");
        await expect(syncingRow).toHaveAttribute(
            "data-sot-status",
            "syncing",
        );
        await expect(syncingRow).toHaveAttribute("data-sot-state", "syncing");
        await expect(syncingRow).toHaveAttribute("data-state", "syncing");
        await expect(syncingRow).toHaveAttribute(
            "data-sot-action-state",
            "count",
        );
        await expect(
            syncingRow.locator('[data-sot-part="source-provider-action"]'),
        ).toHaveCount(0);
        await expect(
            syncingRow.locator('[data-sot-part="source-provider-status"]'),
        ).toBeVisible();
        await expect(
            syncingRow.locator('[data-sot-part="source-provider-count"]'),
        ).toBeVisible();

        await syncingRow.click();
        await expect(syncingRow).toHaveAttribute("aria-pressed", "true");
        await expect(sourceFilterStack(page)).toBeVisible();
        await expect(sourceFilterStack(page)).toContainText("讯飞听见");
        await expect(sourceFilterStack(page)).toHaveAttribute(
            "data-sot-status",
            "syncing",
        );

        await expiredRow.click();
        await expect(page.locator('[data-sot-surface="settings-shell"]')).toBeVisible();
        await expect(page.locator('[data-sot-surface="settings-shell"]')).toHaveAttribute(
            "data-sot-section",
            "data-sources",
        );
        await expect
            .poll(() =>
                page.evaluate(() =>
                    window.localStorage.getItem(
                        "settings-data-source-provider",
                    ),
                ),
            )
            .toBe("ticnote");
    } finally {
        await cleanupStackSeeds(userId);
    }
});

test("dashboard auto-play next stays inside the active source filter", async ({
    page,
}) => {
    await mockSyncEndpoint(page);
    await mockConnectedDataSources(page, ["ticnote", "plaud"]);
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();

    try {
        await seedAutoNextStackRecordings(userId);
        const playbackResponse = await page.request.put("/api/settings/playback", {
            data: {
                autoPlayNext: true,
                defaultPlaybackSpeed: 1,
                defaultVolume: 75,
            },
        });
        expect(playbackResponse.ok()).toBe(true);

        await reloadDashboardWithTheme(page, {
            theme: "dark",
            uiLanguage: "zh-CN",
        });
        const workstation = dashboardWorkstation(page);
        await expect(workstation).toHaveAttribute(
            "data-playback-settings-loaded",
            "true",
        );
        await expect(workstation).toHaveAttribute(
            "data-playback-auto-next",
            "true",
        );

        const ticnoteRow = sourceProvider(page, "ticnote");
        await expect(ticnoteRow).toBeVisible();
        await expect(ticnoteRow).toHaveAttribute(
            "data-sot-status",
            "connected",
        );
        await ticnoteRow.click();

        const newerItem = recordingRow(
            page,
            "e2e-source-stack-autonext-ticnote-newer",
        );
        await expect(newerItem).toBeVisible();
        await newerItem.click();
        await expect(newerItem).toHaveAttribute("data-sot-state", "selected");
        await expect(
            selectedRecordingTitle(page, "E2E auto next TicNote newer"),
        ).toHaveText(
            "E2E auto next TicNote newer",
        );

        await page.locator("audio").evaluate((node) => {
            node.dispatchEvent(new Event("ended"));
        });

        const olderItem = recordingRow(
            page,
            "e2e-source-stack-autonext-ticnote-older",
        );
        await expect(olderItem).toHaveAttribute("data-sot-state", "selected");
        await expect(
            page.locator(
                '[data-sot-recording-id="e2e-source-stack-autonext-plaud-middle"][data-sot-state="selected"]',
            ),
        ).toHaveCount(0);
        await expect(
            selectedRecordingTitle(page, "E2E auto next TicNote older"),
        ).toHaveText(
            "E2E auto next TicNote older",
        );
    } finally {
        await removeStackAudioFixtures();
        await cleanupStackSeeds(userId);
    }
});

test("dashboard responsive source rail opens as a mobile drawer and collapses on desktop", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDashboard(page, { connectIflyrec: true });

    await expectBodyDrawerState(page, "closed");
    await expectResponsiveFrame(page, "mobile-closed");

    const drawerTrigger = page.locator("#drawer-trigger");
    await drawerTrigger.click();
    await expectBodyDrawerState(page, "open");
    await expectResponsiveFrame(page, "mobile-open");
    await drawerTrigger.dispatchEvent("click");
    await expectBodyDrawerState(page, "open");
    await expect
        .poll(() => activeElementIsInsideSourceDrawer(page))
        .toBe(true);
    for (let index = 0; index < 12; index += 1) {
        await page.keyboard.press("Tab");
        await expect
            .poll(() => activeElementIsInsideSourceDrawer(page))
            .toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    await expect
        .poll(() => activeElementIsInsideSourceDrawer(page))
        .toBe(true);

    await page.mouse.click(374, 760);
    await expectBodyDrawerState(page, "closed");
    await expectResponsiveFrame(page, "mobile-closed");

    await drawerTrigger.click();
    await expectBodyDrawerState(page, "open");
    await expectResponsiveFrame(page, "mobile-open");
    await page.keyboard.press("Escape");
    await expectBodyDrawerState(page, "closed");
    await expectResponsiveFrame(page, "mobile-closed");
    await expect(drawerTrigger).toBeFocused();

    await drawerTrigger.click();
    await expectBodyDrawerState(page, "open");
    await expectResponsiveFrame(page, "mobile-open");
    await expect(page.locator("#drawer-scrim")).toHaveCSS("z-index", "300");
    await expect(page.locator(".sidebar")).toHaveCSS("z-index", "310");
    await page
        .locator("#drawer-scrim")
        .click({ position: { x: 374, y: 760 } });
    await expectBodyDrawerState(page, "closed");
    await expectResponsiveFrame(page, "mobile-closed");
    await page.locator('[data-sot-control="dashboard-search"]').first().click();
    await expect(page.locator('[data-sot-panel="library-search"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-sot-panel="library-search"]')).toBeHidden();

    await drawerTrigger.click();
    await expectBodyDrawerState(page, "open");

    const iflyrecRow = sourceProvider(page, "iflyrec");
    await expect(iflyrecRow).toBeVisible();
    await iflyrecRow.click();
    await expectBodyDrawerState(page, "closed");
    await expectResponsiveFrame(page, "mobile-closed");
    await expect(sourceFilterStack(page)).toBeVisible();

    await page.setViewportSize({ width: 820, height: 900 });
    await expectResponsiveFrame(page, "tablet-closed");

    await page.setViewportSize({ width: 1440, height: 900 });
    await expectResponsiveFrame(page, "desktop");
    const workstation = dashboardWorkstation(page);
    await page.locator('[data-sot-control="sidebar-collapse"]').click();
    await expect(workstation).toHaveAttribute(
        "data-sidebar-collapsed",
        "true",
    );
    await expect(page.locator('[data-sot-list="dashboard-sources"]')).toHaveAttribute(
        "data-compact",
        "true",
    );
    await expectResponsiveFrame(page, "desktop");
});

test("dashboard full responsive app shell frames match SOT web index pixels", async ({
    page,
}, testInfo) => {
    await openDashboard(page, { connectIflyrec: true });

    const sotPage = await page.context().newPage();
    const componentLibraryPage = await page.context().newPage();
    try {
        await Promise.all([
            sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" }),
            componentLibraryPage.goto(SOT_COMPONENT_LIBRARY_URL, {
                waitUntil: "load",
            }),
        ]);

        const responsiveRequirements =
            componentLibraryPage.locator("#responsive");
        await expect(responsiveRequirements).toContainText("Desktop expanded");
        await expect(responsiveRequirements).toContainText("Desktop collapsed");
        await expect(responsiveRequirements).toContainText("Tablet overlay");
        await expect(responsiveRequirements).toContainText("Mobile drawer");

        await expectResponsiveAppPixelMatch(page, testInfo, sotPage);
    } finally {
        await Promise.all([
            sotPage.close(),
            componentLibraryPage.close(),
        ]);
    }
});

test("dashboard app shell theme frames match SOT web index pixels", async ({
    page,
}, testInfo) => {
    const sotPage = await page.context().newPage();
    const themeEvidence: AppShellThemeAxisEvidence[] = [];
    let dashboardOpened = false;

    try {
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });

        for (const axis of APP_SHELL_THEME_AXES) {
            await page.emulateMedia({
                colorScheme: axis.systemColorScheme ?? null,
            });
            if (dashboardOpened) {
                await reloadDashboardWithTheme(page, {
                    theme: axis.settingsTheme,
                });
            } else {
                await openDashboard(page, {
                    connectIflyrec: true,
                    theme: axis.settingsTheme,
                });
                dashboardOpened = true;
            }

            const runtime = await readAppShellRuntimeThemeEvidence(
                page,
                axis.expectedResolvedTheme,
            );
            const frames = await expectResponsiveAppPixelMatch(
                page,
                testInfo,
                sotPage,
                {
                    attachPrefix: `app-shell-theme-${axis.name}`,
                    pixelSemantics: axis.pixelSemantics,
                    theme: axis.expectedResolvedTheme,
                },
            );

            themeEvidence.push({
                canonicalSotVisualParity: axis.canonicalSotVisualParity,
                expectedResolvedTheme: axis.expectedResolvedTheme,
                frames,
                name: axis.name,
                pixelSemantics: axis.pixelSemantics,
                rationale: axis.rationale,
                runtime,
                settingsTheme: axis.settingsTheme,
                systemColorScheme: axis.systemColorScheme ?? null,
            });
        }

        await writeAppShellThemeMatrixEvidence(themeEvidence);
    } finally {
        await page.emulateMedia({ colorScheme: null });
        await sotPage.close();
    }
});

test("dashboard mobile drawer primitives match SOT DOM and computed styles", async ({
    page,
}, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDashboard(page, { connectIflyrec: true });
    await expectBodyDrawerState(page, "closed");

    const sotPage = await page.context().newPage();
    try {
        await sotPage.setViewportSize({ width: 390, height: 844 });
        await sotPage.goto(SOT_WORKSTATION_URL, { waitUntil: "load" });

        await expectElementSignatureMatch(sotPage, page, "#drawer-scrim");
        await expectElementSignatureMatch(sotPage, page, "#drawer-trigger");
        await expect(page.locator(".sidebar")).toHaveClass(
            "sidebar glass glass-strong",
        );
        await expect(page.locator(".sidebar")).not.toHaveAttribute(
            "data-drawer-open",
            /.+/,
        );
        await expect(page.locator(".sidebar")).not.toHaveAttribute(
            "data-sot-state",
            /.+/,
        );
        await expect(page.locator(".sidebar")).not.toHaveAttribute(
            "data-sot-surface",
            /.+/,
        );
        await expect(page.locator("#drawer-trigger")).not.toHaveAttribute(
            "aria-expanded",
            /.+/,
        );
        await expect(page.locator("#drawer-trigger")).not.toHaveAttribute(
            "data-sot-control",
            /.+/,
        );

        await expectComputedStyleMatch(
            sotPage,
            page,
            "#drawer-trigger",
            "#drawer-trigger",
            DRAWER_TRIGGER_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage,
            page,
            "#drawer-scrim",
            "#drawer-scrim",
            DRAWER_SCRIM_STYLE_PROPS,
        );

        await Promise.all([
            sotPage.evaluate(() => {
                document.body.dataset.sourceFilter = "iflyrec";
            }),
            page.evaluate(() => {
                document.body.dataset.sourceFilter = "iflyrec";
            }),
        ]);
        await expectComputedStyleMatch(
            sotPage,
            page,
            "#drawer-trigger .dot-active",
            "#drawer-trigger .dot-active",
            DRAWER_DOT_STYLE_PROPS,
        );

        await Promise.all([
            sotPage.evaluate(() => {
                document.body.dataset.drawer = "open";
            }),
            page.locator("#drawer-trigger").click(),
        ]);
        await expectBodyDrawerState(page, "open");
        await expectComputedStyleMatch(
            sotPage,
            page,
            "#drawer-scrim",
            "#drawer-scrim",
            DRAWER_SCRIM_STYLE_PROPS,
        );
        await expectComputedStyleMatch(
            sotPage,
            page,
            ".sidebar",
            ".sidebar",
            DRAWER_SIDEBAR_STYLE_PROPS,
        );
        await expectDrawerResponsivePixelMatch(page, testInfo, sotPage);
    } finally {
        await sotPage.close();
    }
});

test("dashboard source filter stack retries sync errors and restores active state", async ({
    page,
}) => {
    await mockSyncEndpoint(page, { initialStatus: "unhealthy" });
    await mockConnectedDataSources(page, ["iflyrec"]);
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    try {
        await seedStackRecording(userId);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        const iflyrecRow = sourceProvider(page, "iflyrec");
        await expect(iflyrecRow).toBeVisible();
        await expect(iflyrecRow).toHaveAttribute(
            "data-sot-status",
            "sync-error",
        );
        await iflyrecRow.click();

        const stack = sourceFilterStack(page);
        await expect(stack).toBeVisible();
        await expect(stack).toHaveAttribute("data-sot-state", "sync-error");
        await expect(stack).toContainText(/同步异常|sync issue/i);

        const syncPostRequest = page.waitForRequest(
            (request) =>
                request.url().includes("/api/data-sources/sync") &&
                request.method() === "POST",
        );
        const retrySyncAction = sourceFilterAction(
            page,
            "source-filter-retry-sync",
        );
        await expectSourceFilterStackActionSurface(retrySyncAction);
        await retrySyncAction.click();
        await syncPostRequest;

        await expect(stack).toHaveAttribute("data-sot-state", "active");
        await expect(iflyrecRow).toHaveAttribute(
            "data-sot-status",
            "connected",
        );
    } finally {
        await cleanupStackSeeds(userId);
    }
});

test("dashboard source filter stack widens no-result favorite filters", async ({
    page,
}) => {
    await mockSyncEndpoint(page);
    await mockConnectedDataSources(page, ["iflyrec"]);
    await ensureSignedIn(page);
    const userId = await getPlaywrightUserId();
    try {
        await seedStackRecording(userId);

        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

        const iflyrecRow = sourceProvider(page, "iflyrec");
        await expect(iflyrecRow).toBeVisible();
        await expect(iflyrecRow).toHaveAttribute(
            "data-sot-status",
            "connected",
        );
        await iflyrecRow.click();
        await favoriteControl(page, "transcribed").click();
        await expectFavoriteButtonSurface(page, "transcribed", {
            active: true,
        });

        const stack = sourceFilterStack(page);
        await expect(stack).toBeVisible();
        await expect(stack).toHaveAttribute("data-sot-state", "no-results");
        await expect(stack).toContainText(/在当前筛选下没有匹配项|no matches/i);

        const widenAction = sourceFilterAction(page, "source-filter-widen");
        await expectSourceFilterStackActionSurface(widenAction);
        await widenAction.click();
        await expect(stack).toHaveAttribute("data-sot-state", "active");
        await expect(favoriteControl(page, "all")).toHaveAttribute(
            "data-sot-state",
            "selected",
        );
    } finally {
        await cleanupStackSeeds(userId);
    }
});
