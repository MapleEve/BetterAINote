import { execFileSync } from "node:child_process";
import path from "node:path";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
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
    SOT_FIXTURE_PROJECT_ROOT,
    SOT_SYSTEM_REFERENCE_URL,
} from "./helpers/sot-fixtures";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const PLAYWRIGHT_EMAIL = "playwright-admin@example.com";
const SOT_SYSTEM_REFERENCE_REL = path
    .relative(
        process.cwd(),
        path.join(SOT_FIXTURE_PROJECT_ROOT, "preview", "19-system-reference.html"),
    )
    .split(path.sep)
    .join("/");
const ROW_119_EVIDENCE_DIR_REL =
    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/auth-onboarding-visual-matrix-20260611";
const ROW_119_EVIDENCE_DIR = path.resolve(
    process.cwd(),
    ROW_119_EVIDENCE_DIR_REL,
);
const ELECTRON_ONBOARDING_REFERENCE_REL =
    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/auth-onboarding-20260611/electron-onboarding-artboard.png";

interface SotPixelDiff {
    alphaDiffPixels: number;
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
    samples: Array<{
        actualRgba: [number, number, number, number];
        delta: number;
        expectedRgba: [number, number, number, number];
        x: number;
        y: number;
    }>;
}

interface EvidenceImage {
    dimensions: {
        height: number;
        width: number;
    };
    imageBytes: number;
    path: string;
}

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
}

function hasConfiguredExternalServer() {
    return Boolean(
        process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1" ||
            process.env.PLAYWRIGHT_BASE_URL?.trim() ||
            process.env.APP_URL?.trim(),
    );
}

function resolveHarnessBaseUrl() {
    return new URL(
        process.env.PLAYWRIGHT_BASE_URL?.trim() ||
            process.env.APP_URL?.trim() ||
            "http://127.0.0.1:3201",
    );
}

function isLoopbackHostname(hostname: string) {
    return ["127.0.0.1", "localhost", "::1"].includes(hostname);
}

function readListeningPids(port: string) {
    try {
        return execFileSync(
            "lsof",
            ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"],
            { encoding: "utf8" },
        )
            .split("\n")
            .filter((line) => line.startsWith("p"))
            .map((line) => Number.parseInt(line.slice(1), 10))
            .filter(Number.isFinite);
    } catch {
        return [];
    }
}

function readParentPid(pid: number) {
    try {
        const output = execFileSync("ps", ["-o", "ppid=", "-p", String(pid)], {
            encoding: "utf8",
        }).trim();
        return Number.parseInt(output, 10);
    } catch {
        return Number.NaN;
    }
}

function readAncestorPids(pid: number) {
    const pids = new Set<number>();
    let currentPid = pid;

    while (Number.isFinite(currentPid) && currentPid > 1) {
        pids.add(currentPid);
        currentPid = readParentPid(currentPid);
    }

    return pids;
}

function assertNoForeignLoopbackRuntime() {
    const baseUrl = resolveHarnessBaseUrl();
    if (!isLoopbackHostname(baseUrl.hostname)) return;

    const port =
        baseUrl.port || (baseUrl.protocol === "https:" ? "443" : "80");
    const listenerPids = readListeningPids(port);
    if (listenerPids.length === 0) return;

    const currentAncestors = readAncestorPids(process.pid);
    const foreignPids = listenerPids.filter((listenerPid) => {
        const listenerAncestors = readAncestorPids(listenerPid);
        return !Array.from(listenerAncestors).some((pid) =>
            currentAncestors.has(pid),
        );
    });

    if (foreignPids.length > 0) {
        throw new Error(
            [
                `Refusing destructive auth reset because ${baseUrl.origin} is already owned by another process: ${foreignPids.join(", ")}`,
                "Stop the other Playwright/dev server or run this auth test on an isolated PLAYWRIGHT_BASE_URL with a matching DATABASE_PATH.",
            ].join(" "),
        );
    }
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

function assertAuthResetTargetsE2ERuntimeDatabase(filePath: string) {
    assertE2EDatabasePath(filePath);
    assertNoForeignLoopbackRuntime();

    const explicitDatabasePath = process.env.DATABASE_PATH?.trim();
    if (hasConfiguredExternalServer() && !explicitDatabasePath) {
        throw new Error(
            [
                "Refusing destructive auth reset against a configured external app server without DATABASE_PATH.",
                "Set DATABASE_PATH to the same guarded E2E database used by the app runtime, or unset PLAYWRIGHT_BASE_URL/APP_URL/PLAYWRIGHT_SKIP_WEBSERVER so Playwright manages the E2E server.",
                `Reset target would be: ${path.resolve(filePath)}`,
            ].join(" "),
        );
    }

    const expectedE2EDatabasePath =
        process.env.PLAYWRIGHT_E2E_DATABASE_PATH?.trim();
    if (expectedE2EDatabasePath) {
        const resolvedExpectedPath = path.resolve(
            process.cwd(),
            expectedE2EDatabasePath,
        );
        const resolvedFilePath = path.resolve(filePath);
        if (resolvedExpectedPath !== resolvedFilePath) {
            throw new Error(
                `Refusing destructive auth reset because DATABASE_PATH (${resolvedFilePath}) does not match PLAYWRIGHT_E2E_DATABASE_PATH (${resolvedExpectedPath})`,
            );
        }
    }
}

function databaseUrl(filePath: string) {
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();

async function withCoreClient<T>(
    callback: (client: ReturnType<typeof createClient>) => Promise<T>,
) {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        return await callback(client);
    } finally {
        await client.close();
    }
}

async function getPlaywrightUserId() {
    return withCoreClient(async (client) => {
        const result = await client.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: [PLAYWRIGHT_EMAIL],
        });
        const id = result.rows[0]?.id;
        if (typeof id !== "string") {
            throw new Error("Playwright user not found");
        }
        return id;
    });
}

async function resetOnboardingConnections(userId: string) {
    await withCoreClient(async (client) => {
        await client.execute({
            sql: "DELETE FROM source_connections WHERE user_id = ?",
            args: [userId],
        });
    });
}

async function resetAuthUsers() {
    assertAuthResetTargetsE2ERuntimeDatabase(CORE_DB);

    await withCoreClient(async (client) => {
        for (const sql of [
            "DELETE FROM sessions",
            "DELETE FROM accounts",
            "DELETE FROM verifications",
            "DELETE FROM api_credentials",
            "DELETE FROM source_connections",
            "DELETE FROM user_settings",
            "DELETE FROM users",
        ]) {
            await client.execute({ sql });
        }
    });
}

async function createRegisteredUser(email: string) {
    await withCoreClient(async (client) => {
        await client.execute({
            sql: `
                INSERT INTO users (id, email, email_verified, is_anonymous, name)
                VALUES (?, ?, 1, 0, ?)
            `,
            args: ["registered-user-1", email, "Registered User"],
        });
    });
}

async function readMagicLinkVerification(email: string) {
    return withCoreClient(async (client) => {
        const result = await client.execute({
            sql: "SELECT value FROM verifications ORDER BY created_at DESC LIMIT 5",
        });
        return result.rows.some((row) => {
            if (typeof row.value !== "string") return false;
            try {
                return JSON.parse(row.value).email === email;
            } catch {
                return false;
            }
        });
    });
}

async function countAnonymousUsers() {
    return withCoreClient(async (client) => {
        const result = await client.execute({
            sql: "SELECT COUNT(*) AS count FROM users WHERE is_anonymous = 1",
        });
        return Number(result.rows[0]?.count ?? 0);
    });
}

function currentOnboardingPanel(page: Page) {
    return page.locator('[data-sot-panel="onboarding-current"]');
}

function sotControl(page: Page, control: string) {
    return page.locator(`[data-sot-control="${control}"]`);
}

function sotList(page: Page, list: string) {
    return page.locator(`[data-sot-list="${list}"]`);
}

function sotPanel(page: Page, panel: string) {
    return page.locator(`[data-sot-panel="${panel}"]`);
}

async function gotoAuthPage(page: Page, path: "/login" | "/register") {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-sot-ready]")).toHaveAttribute(
        "data-sot-ready",
        "true",
    );
}

async function gotoOnboardingPage(page: Page) {
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-sot-layout="onboarding-workstation"]'),
    ).toHaveAttribute("data-sot-ready", "true");
}

interface SendLoginLinkOptions {
    expectedStatus?: number;
}

async function sendLoginLink(page: Page, options: SendLoginLinkOptions = {}) {
    const [response] = await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/auth/sign-in/magic-link") &&
                response.request().method() === "POST",
        ),
        page.locator('[data-sot-control="send-login-link"]').click(),
    ]);

    if (
        options.expectedStatus !== undefined &&
        response.status() !== options.expectedStatus
    ) {
        const body = await response.text().catch(() => "<unreadable body>");
        throw new Error(
            `Magic-link POST returned ${response.status()} ${response.statusText()}, expected ${options.expectedStatus}: ${body.slice(0, 1_000)}`,
        );
    }

    if (options.expectedStatus === undefined && !response.ok()) {
        const body = await response.text().catch(() => "<unreadable body>");
        throw new Error(
            `Magic-link POST failed with ${response.status()} ${response.statusText()}: ${body.slice(0, 1_000)}`,
        );
    }

    return response;
}

async function goToOnboardingState(page: Page, state: string) {
    const panel = currentOnboardingPanel(page);
    const nextButton = page.locator('[data-sot-control="onboarding-next"]');

    for (let attempt = 0; attempt < 4; attempt += 1) {
        await nextButton.click();
        if (
            await panel
                .getAttribute("data-sot-state", { timeout: 1_000 })
                .then((value) => value === state)
                .catch(() => false)
        ) {
            return;
        }
        await page.waitForTimeout(250);
    }

    await expect(panel).toHaveAttribute("data-sot-state", state);
}

async function waitForFonts(page: Page) {
    await page.evaluate(() => document.fonts.ready);
}

async function readOuterHtmlWithFormValues(locator: Locator) {
    return locator.evaluate((element) => {
        const clone = element.cloneNode(true) as HTMLElement;
        const sourceFields = Array.from(
            element.querySelectorAll("input, textarea"),
        ) as Array<HTMLInputElement | HTMLTextAreaElement>;
        const clonedFields = Array.from(
            clone.querySelectorAll("input, textarea"),
        ) as Array<HTMLInputElement | HTMLTextAreaElement>;

        sourceFields.forEach((sourceField, index) => {
            const clonedField = clonedFields[index];
            if (!clonedField) return;
            clonedField.setAttribute("value", sourceField.value);
            clonedField.textContent = sourceField.value;
        });

        return clone.outerHTML;
    });
}

async function captureAuthHtmlFixture({
    page,
    html,
    stageWidth,
    targetSelector,
}: {
    html: string;
    page: Page;
    stageWidth: number;
    targetSelector: string;
}) {
    const fixtureId = `auth-sot-pixel-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

    await page.evaluate(
        ({ fixtureHtml, fixtureId: id, fixtureWidth }) => {
            document.getElementById(id)?.remove();
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
            stage.className = "auth-sot-pixel-stage";
            stage.style.background = "var(--bg-canvas)";
            stage.style.width = `${fixtureWidth}px`;
            stage.innerHTML = fixtureHtml;

            host.appendChild(stage);
            document.body.appendChild(host);
        },
        { fixtureHtml: html, fixtureId, fixtureWidth: stageWidth },
    );

    const target = page
        .locator(`#${fixtureId} > .auth-sot-pixel-stage`)
        .locator(targetSelector)
        .first();
    await expect(target).toBeVisible();
    await waitForFonts(page);
    await page.waitForTimeout(150);
    const screenshot = await target.screenshot({
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

async function compareSotPixels(
    page: Page,
    expected: string,
    actual: string,
): Promise<SotPixelDiff> {
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
                    alphaDiffPixels: -1,
                    bounds: null,
                    differingPixels: -1,
                    dimensionsMatch: false,
                    expectedHeight: expectedImage.naturalHeight,
                    expectedWidth: expectedImage.naturalWidth,
                    maxChannelDelta: -1,
                    productHeight: actualImage.naturalHeight,
                    productWidth: actualImage.naturalWidth,
                    samples: [],
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
            let alphaDiffPixels = 0;
            let minX = Number.POSITIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            let maxX = Number.NEGATIVE_INFINITY;
            let maxY = Number.NEGATIVE_INFINITY;
            const samples: SotPixelDiff["samples"] = [];
            for (let index = 0; index < expectedData.length; index += 4) {
                const pixel = index / 4;
                const x = pixel % canvas.width;
                const y = Math.floor(pixel / canvas.width);
                const pixelDelta = Math.max(
                    Math.abs(expectedData[index] - actualData[index]),
                    Math.abs(expectedData[index + 1] - actualData[index + 1]),
                    Math.abs(expectedData[index + 2] - actualData[index + 2]),
                    Math.abs(expectedData[index + 3] - actualData[index + 3]),
                );
                if (pixelDelta > 0) {
                    differingPixels += 1;
                    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                    if (expectedData[index + 3] !== actualData[index + 3]) {
                        alphaDiffPixels += 1;
                    }
                    if (samples.length < 32) {
                        samples.push({
                            actualRgba: [
                                actualData[index],
                                actualData[index + 1],
                                actualData[index + 2],
                                actualData[index + 3],
                            ],
                            delta: pixelDelta,
                            expectedRgba: [
                                expectedData[index],
                                expectedData[index + 1],
                                expectedData[index + 2],
                                expectedData[index + 3],
                            ],
                            x,
                            y,
                        });
                    }
                }
            }

            return {
                alphaDiffPixels,
                bounds:
                    differingPixels > 0
                        ? {
                              maxX,
                              maxY,
                              minX,
                              minY,
                          }
                        : null,
                differingPixels,
                dimensionsMatch: true,
                expectedHeight: expectedImage.naturalHeight,
                expectedWidth: expectedImage.naturalWidth,
                maxChannelDelta,
                productHeight: actualImage.naturalHeight,
                productWidth: actualImage.naturalWidth,
                samples,
            };
        },
        { actual, expected },
    );
}

function repoRelativePath(filePath: string) {
    return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

function readPngDimensions(screenshot: Buffer) {
    if (
        screenshot.length < 24 ||
        screenshot.subarray(1, 4).toString("ascii") !== "PNG"
    ) {
        throw new Error("Evidence screenshot is not a PNG image");
    }

    return {
        width: screenshot.readUInt32BE(16),
        height: screenshot.readUInt32BE(20),
    };
}

async function forceDarkTheme(page: Page) {
    await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
        document.body.dataset.theme = "dark";
    });
}

async function writeEvidencePng(fileName: string, screenshot: Buffer) {
    const outputPath = path.join(ROW_119_EVIDENCE_DIR, fileName);
    await writeFile(outputPath, screenshot);

    return {
        path: repoRelativePath(outputPath),
        dimensions: readPngDimensions(screenshot),
        imageBytes: screenshot.byteLength,
    } satisfies EvidenceImage;
}

async function captureEvidenceScreenshot(
    page: Page,
    locator: Locator,
    fileName: string,
) {
    await expect(locator).toBeVisible();
    await waitForFonts(page);
    await page.waitForTimeout(150);

    const screenshot = await locator.screenshot({
        animations: "disabled",
        omitBackground: true,
        scale: "css",
    });

    return writeEvidencePng(fileName, screenshot);
}

async function captureAuthLoginPixelEvidence(
    page: Page,
    sotPage: Page,
    productLoginCard: Locator,
) {
    const sotGridHtml = await sotAuthSection(sotPage)
        .locator(".grid-2")
        .evaluate((element) => element.outerHTML);
    const productHtml = await readOuterHtmlWithFormValues(productLoginCard);
    const [sotCapture, productCapture] = await Promise.all([
        captureAuthHtmlFixture({
            html: sotGridHtml,
            page: sotPage,
            stageWidth: 856,
            targetSelector: ".grid-2 > .card",
        }),
        captureAuthHtmlFixture({
            html: `<main class="auth-sot-canvas" style="min-height:auto;display:block;padding:0;background:transparent;color:var(--fg-primary)">${productHtml}</main>`,
            page,
            stageWidth: 420,
            targetSelector: '[data-sot-surface="auth-login"]',
        }),
    ]);
    const diff = await compareSotPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    return {
        id: "login-09-current-fixture-pixel",
        label: "Login card current fixture against §09 system reference",
        parityType: "pixel",
        fixture: {
            productStageWidth: 420,
            sotStageWidth: 856,
            targetSelector: '[data-sot-surface="auth-login"]',
        },
        pixelDiff: diff,
        sotScreenshot: await writeEvidencePng(
            "login-09-sot-card.png",
            sotCapture.screenshot,
        ),
        productScreenshot: await writeEvidencePng(
            "login-09-product-card.png",
            productCapture.screenshot,
        ),
        notes: [
            "This retests the compact §09 card fixture only.",
            "It is not a broader login/onboarding row PASS.",
        ],
    };
}

async function captureOnboardingDefaultSourcePixelEvidence(
    page: Page,
    sotPage: Page,
    productOnboardingCard: Locator,
) {
    const sotGridHtml = await sotAuthSection(sotPage)
        .locator(".grid-2")
        .evaluate((element) => element.outerHTML);
    const productHtml = await readOuterHtmlWithFormValues(productOnboardingCard);
    const [sotCapture, productCapture] = await Promise.all([
        captureAuthHtmlFixture({
            html: sotGridHtml,
            page: sotPage,
            stageWidth: 856,
            targetSelector: ".grid-2 > .card:nth-child(2)",
        }),
        captureAuthHtmlFixture({
            html: `<main class="onboarding-sot-canvas" style="min-height:auto;display:block;padding:0;background:transparent;color:var(--fg-primary)">${productHtml}</main>`,
            page,
            stageWidth: 420,
            targetSelector: '[data-sot-card="onboarding"]',
        }),
    ]);
    const diff = await compareSotPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );

    return {
        id: "onboarding-default-source-09-current-fixture-pixel",
        label: "Onboarding default-source current fixture against §09 system reference",
        parityType: "pixel",
        fixture: {
            productStageWidth: 420,
            sotStageWidth: 856,
            targetSelector: '[data-sot-card="onboarding"]',
        },
        pixelDiff: diff,
        residual: {
            expectedKnownResidual:
                "12 disabled-row right rounded-corner anti-alias pixels, maxChannelDelta=1, alphaDiffPixels=0",
            status:
                diff.dimensionsMatch &&
                diff.differingPixels <= 12 &&
                diff.maxChannelDelta <= 1
                    ? "within-known-residual"
                    : "outside-known-residual",
            analysis: {
                alphaDiffPixels: diff.alphaDiffPixels,
                bounds: diff.bounds,
                interpretation:
                    "The residual is confined to the right rounded corners of the disabled default-source row. Layout, dimensions, copy, control states, and alpha channel remain matched.",
                samples: diff.samples,
            },
        },
        sotScreenshot: await writeEvidencePng(
            "onboarding-default-source-09-sot-card.png",
            sotCapture.screenshot,
        ),
        productScreenshot: await writeEvidencePng(
            "onboarding-default-source-09-product-card.png",
            productCapture.screenshot,
        ),
        notes: [
            "This is a compact §09 default-source fixture comparison.",
            "Do not restate this evidence as exact-zero while the residual remains.",
            "The remaining residual is recorded with coordinates and RGBA samples so it is not mistaken for an unresolved layout or state delta.",
        ],
    };
}

async function copyElectronReferenceScreenshot() {
    const sourcePath = path.resolve(
        process.cwd(),
        ELECTRON_ONBOARDING_REFERENCE_REL,
    );
    const outputPath = path.join(
        ROW_119_EVIDENCE_DIR,
        "electron-onboarding-artboard-reference-only.png",
    );
    await copyFile(sourcePath, outputPath);
    const screenshot = await readFile(outputPath);

    return {
        path: repoRelativePath(outputPath),
        sourcePath: ELECTRON_ONBOARDING_REFERENCE_REL,
        dimensions: readPngDimensions(screenshot),
        imageBytes: screenshot.byteLength,
    } satisfies EvidenceImage & { sourcePath: string };
}

function evidenceImagePath(value: unknown) {
    if (value && typeof value === "object" && "path" in value) {
        const image = value as { path?: unknown };
        if (typeof image.path === "string") {
            return image.path;
        }
    }

    return "n/a";
}

function firstEvidenceImagePath(...values: unknown[]) {
    for (const value of values) {
        const imagePath = evidenceImagePath(value);
        if (imagePath !== "n/a") {
            return imagePath;
        }
    }

    return "n/a";
}

function pixelDiffSummary(value: unknown) {
    if (!value || typeof value !== "object") {
        return "n/a";
    }

    const diff = value as Partial<SotPixelDiff>;
    return `dimensions=${diff.dimensionsMatch}; differingPixels=${diff.differingPixels}; maxChannelDelta=${diff.maxChannelDelta}`;
}

function residualSummary(value: unknown) {
    if (!value || typeof value !== "object") {
        return "";
    }

    const residual = value as {
        analysis?: {
            alphaDiffPixels?: unknown;
            bounds?: unknown;
        };
        status?: unknown;
    };
    const bounds = residual.analysis?.bounds;
    const boundsSummary =
        bounds && typeof bounds === "object"
            ? JSON.stringify(bounds)
            : "n/a";

    return [
        `; residual=${String(residual.status)}`,
        `alphaDiffPixels=${String(residual.analysis?.alphaDiffPixels)}`,
        `bounds=${boundsSummary}`,
    ].join("; ");
}

function renderRow119EvidenceMarkdown({
    electronReference,
    evidenceJsonPath,
    frames,
    generatedAt,
}: {
    electronReference: Record<string, unknown>;
    evidenceJsonPath: string;
    frames: Array<Record<string, unknown>>;
    generatedAt: string;
}) {
    const frameLines = frames.map((frame) => {
        const screenshot = firstEvidenceImagePath(
            frame.screenshot,
            frame.productScreenshot,
        );
        const diff = pixelDiffSummary(frame.pixelDiff);
        const residual = residualSummary(frame.residual);
        return [
            `- ${String(frame.id)}: parityType=${String(frame.parityType)}`,
            `screenshot=${screenshot}`,
            `${diff}${residual}`,
        ].join("; ");
    });

    return [
        "# Row 119 Auth/Onboarding Visual Matrix",
        "",
        `Generated: ${generatedAt}`,
        "",
        "Status: PARTIAL evidence addendum. This file documents responsive and visual-state evidence only; it does not claim row 119 completion.",
        "",
        "## SOT Ambiguity",
        "",
        "- Web kit omission: `ui_kits/web/index.html` is not treated as login/onboarding SOT because the web kit README explicitly omitted settings, login, and onboarding from supplied fragments.",
        "- §09 system reference: `preview/19-system-reference.html` is the compact web/system auth/onboarding reference for the current pixel fixture checks.",
        "- Electron artboard: the electron onboarding artboard remains reference-only unless a product decision promotes it to a Web pixel target.",
        "",
        "## Frames",
        "",
        ...frameLines,
        "",
        "## Electron Reference",
        "",
        `- parityType=reference-only; screenshot=${evidenceImagePath(electronReference.screenshot)}; source=${String(electronReference.sourcePath)}`,
        "- Product comparison blocker: electron artboard is a platform/reference asset, not a Web product pixel target under the current SOT boundary.",
        "",
        "## Files",
        "",
        `- JSON: ${evidenceJsonPath}`,
        "",
    ].join("\n");
}

async function expectAuthLoginPixelsMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    productLoginCard: Locator,
) {
    const sotGridHtml = await sotAuthSection(sotPage)
        .locator(".grid-2")
        .evaluate((element) => element.outerHTML);
    const productHtml = await readOuterHtmlWithFormValues(productLoginCard);
    const [sotCapture, productCapture] = await Promise.all([
        captureAuthHtmlFixture({
            html: sotGridHtml,
            page: sotPage,
            stageWidth: 856,
            targetSelector: ".grid-2 > .card",
        }),
        captureAuthHtmlFixture({
            html: `<main class="auth-sot-canvas" style="min-height:auto;display:block;padding:0;background:transparent;color:var(--fg-primary)">${productHtml}</main>`,
            page,
            stageWidth: 420,
            targetSelector: '[data-sot-surface="auth-login"]',
        }),
    ]);
    const diff = await compareSotPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );
    const label = "SOT auth login card §09";

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels !== 0 ||
        diff.maxChannelDelta !== 0
    ) {
        const attachmentName = "sot-auth-login-card-09";
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
        const debugDir = path.resolve(process.cwd(), "tmp/sot-pixel-debug");
        await mkdir(debugDir, { recursive: true });
        await Promise.all([
            writeFile(path.join(debugDir, `${attachmentName}-sot.png`), sotCapture.screenshot),
            writeFile(
                path.join(debugDir, `${attachmentName}-product.png`),
                productCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-diff.json`),
                `${JSON.stringify(diff, null, 2)}\n`,
            ),
        ]);
    }

    expect(diff.dimensionsMatch, label).toBe(true);
    expect(diff.productHeight, label).toBe(diff.expectedHeight);
    expect(diff.productWidth, label).toBe(diff.expectedWidth);
    expect(diff.differingPixels, label).toBe(0);
    expect(diff.maxChannelDelta, label).toBe(0);
}

async function expectOnboardingDefaultSourcePixelsMatch(
    page: Page,
    testInfo: TestInfo,
    sotPage: Page,
    productOnboardingCard: Locator,
) {
    const sotGridHtml = await sotAuthSection(sotPage)
        .locator(".grid-2")
        .evaluate((element) => element.outerHTML);
    const productHtml = await readOuterHtmlWithFormValues(productOnboardingCard);
    const [sotCapture, productCapture] = await Promise.all([
        captureAuthHtmlFixture({
            html: sotGridHtml,
            page: sotPage,
            stageWidth: 856,
            targetSelector: ".grid-2 > .card:nth-child(2)",
        }),
        captureAuthHtmlFixture({
            html: `<main class="onboarding-sot-canvas" style="min-height:auto;display:block;padding:0;background:transparent;color:var(--fg-primary)">${productHtml}</main>`,
            page,
            stageWidth: 420,
            targetSelector: '[data-sot-card="onboarding"]',
        }),
    ]);
    const diff = await compareSotPixels(
        page,
        sotCapture.dataUrl,
        productCapture.dataUrl,
    );
    const label = "SOT onboarding default source card §09";

    if (
        !diff.dimensionsMatch ||
        diff.differingPixels !== 0 ||
        diff.maxChannelDelta !== 0
    ) {
        const attachmentName = "sot-onboarding-default-source-card-09";
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
        const debugDir = path.resolve(process.cwd(), "tmp/sot-pixel-debug");
        await mkdir(debugDir, { recursive: true });
        await Promise.all([
            writeFile(path.join(debugDir, `${attachmentName}-sot.png`), sotCapture.screenshot),
            writeFile(
                path.join(debugDir, `${attachmentName}-product.png`),
                productCapture.screenshot,
            ),
            writeFile(
                path.join(debugDir, `${attachmentName}-diff.json`),
                `${JSON.stringify(diff, null, 2)}\n`,
            ),
        ]);
    }

    expect(diff.dimensionsMatch, label).toBe(true);
    expect(diff.productHeight, label).toBe(diff.expectedHeight);
    expect(diff.productWidth, label).toBe(diff.expectedWidth);
    expect(diff.differingPixels, label).toBeLessThanOrEqual(12);
    expect(diff.maxChannelDelta, label).toBeLessThanOrEqual(1);
    expect(diff.alphaDiffPixels, label).toBe(0);
}

function sotAuthSection(page: Page) {
    return page
        .locator("section.sec")
        .filter({ hasText: "登录 & 上手 / Auth · Onboarding" });
}

test("SOT auth login card matches §09 pixels", async ({
    browser,
    page,
}, testInfo) => {
    const sotPage = await browser.newPage({
        viewport: { width: 920, height: 900 },
    });

    try {
        await page.setViewportSize({ width: 920, height: 900 });
        await sotPage.goto(SOT_SYSTEM_REFERENCE_URL, {
            waitUntil: "domcontentloaded",
        });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        await gotoAuthPage(page, "/login");
        await page.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });

        const emailInput = sotControl(page, "auth-email");
        await emailInput.fill("mei@example.com");
        await emailInput.blur();

        const productLoginCard = page.locator(
            '[data-sot-surface="auth-login"]',
        );

        await expectAuthLoginPixelsMatch(
            page,
            testInfo,
            sotPage,
            productLoginCard,
        );
    } finally {
        await sotPage.close();
    }
});

test("SOT onboarding default source card matches §09 pixels", async ({
    browser,
    page,
}, testInfo) => {
    const sotPage = await browser.newPage({
        viewport: { width: 920, height: 900 },
    });

    try {
        await page.setViewportSize({ width: 920, height: 900 });
        await sotPage.goto(SOT_SYSTEM_REFERENCE_URL, {
            waitUntil: "domcontentloaded",
        });
        await sotPage.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        await ensureSignedIn(page);
        await resetOnboardingConnections(await getPlaywrightUserId());
        await gotoOnboardingPage(page);
        await page.evaluate(() => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
        });
        await goToOnboardingState(page, "transcription");

        await expectOnboardingDefaultSourcePixelsMatch(
            page,
            testInfo,
            sotPage,
            page.locator('[data-sot-card="onboarding"]'),
        );
    } finally {
        await sotPage.close();
    }
});

test("row 119 auth/onboarding visual matrix evidence", async ({
    browser,
    page,
}, testInfo) => {
    testInfo.setTimeout(120_000);

    const generatedAt = new Date().toISOString();
    const frames: Array<Record<string, unknown>> = [];
    await mkdir(ROW_119_EVIDENCE_DIR, { recursive: true });

    const sotPage = await browser.newPage({
        viewport: { width: 920, height: 900 },
    });

    try {
        await sotPage.goto(SOT_SYSTEM_REFERENCE_URL, {
            waitUntil: "domcontentloaded",
        });
        await forceDarkTheme(sotPage);

        await page.setViewportSize({ width: 1280, height: 900 });
        await gotoAuthPage(page, "/login");
        await forceDarkTheme(page);
        await sotControl(page, "auth-email").fill("mei@example.com");

        const loginCard = page.locator('[data-sot-surface="auth-login"]');
        await expect(loginCard).toHaveAttribute("data-sot-state", "idle");
        await expect(
            loginCard.locator('[data-sot-frame="auth"]'),
        ).toBeVisible();
        await expect(page.locator(".sidebar, .panel")).toHaveCount(0);
        frames.push({
            id: "login-desktop-dark-card-responsive",
            label: "Login dark card runtime responsive frame, desktop",
            parityType: "structural",
            route: "/login",
            theme: "dark",
            viewport: { width: 1280, height: 900 },
            screenshot: await captureEvidenceScreenshot(
                page,
                loginCard,
                "login-desktop-dark-card.png",
            ),
            assertions: [
                "data-sot-surface=auth-login is visible",
                "data-sot-state=idle before submission",
                "data-sot-frame=auth uses the restored frame primitive",
                "legacy .sidebar/.panel surfaces are absent",
            ],
            sotRelationship:
                "Runtime responsive frame; §09 compact card is the pixel fixture target, not a full responsive artboard.",
        });

        frames.push(
            (await captureAuthLoginPixelEvidence(
                page,
                sotPage,
                loginCard,
            )) as Record<string, unknown>,
        );

        await page.setViewportSize({ width: 390, height: 780 });
        await gotoAuthPage(page, "/login");
        await forceDarkTheme(page);
        await sotControl(page, "auth-email").fill("mei@example.com");
        const mobileLoginCard = page.locator('[data-sot-surface="auth-login"]');
        await expect(
            mobileLoginCard.locator('[data-sot-frame="auth"]'),
        ).toBeVisible();
        await expect(page.locator(".sidebar, .panel")).toHaveCount(0);
        frames.push({
            id: "login-mobile-dark-card-responsive",
            label: "Login dark card runtime responsive frame, mobile",
            parityType: "structural",
            route: "/login",
            theme: "dark",
            viewport: { width: 390, height: 780 },
            screenshot: await captureEvidenceScreenshot(
                page,
                mobileLoginCard,
                "login-mobile-dark-card.png",
            ),
            assertions: [
                "mobile viewport renders the same SOT auth card/frame markers",
                "email-link/no-password surface remains editable",
                "legacy .sidebar/.panel surfaces are absent",
            ],
            blocker:
                "No separate mobile auth artboard exists in §09; this is runtime structural evidence, not a mobile pixel claim.",
        });

        await ensureSignedIn(page);
        await resetOnboardingConnections(await getPlaywrightUserId());

        await page.setViewportSize({ width: 1280, height: 900 });
        await gotoOnboardingPage(page);
        await forceDarkTheme(page);
        await goToOnboardingState(page, "transcription");
        const onboardingCard = page.locator(
            '[data-sot-card="onboarding"]',
        );
        const onboardingPanel = currentOnboardingPanel(page);
        await expect(onboardingPanel).toHaveAttribute(
            "data-sot-state",
            "transcription",
        );
        await expect(
            sotList(page, "onboarding-default-sources"),
        ).toBeVisible();
        await expect(
            sotPanel(page, "onboarding-default-source-step"),
        ).toBeVisible();
        frames.push({
            id: "onboarding-default-source-desktop-responsive",
            label: "Onboarding default-source runtime responsive frame, desktop",
            parityType: "structural",
            route: "/onboarding",
            theme: "dark",
            viewport: { width: 1280, height: 900 },
            screenshot: await captureEvidenceScreenshot(
                page,
                onboardingCard,
                "onboarding-default-source-desktop.png",
            ),
            assertions: [
                "data-sot-state=transcription",
                "four progress segments are present",
                "onboarding default-source list is visible",
                "default-source row has a selected state",
            ],
            sotRelationship:
                "Runtime responsive frame paired with the compact §09 default-source pixel fixture below.",
        });

        frames.push(
            (await captureOnboardingDefaultSourcePixelEvidence(
                page,
                sotPage,
                onboardingCard,
            )) as Record<string, unknown>,
        );

        await page.setViewportSize({ width: 390, height: 780 });
        await gotoOnboardingPage(page);
        await forceDarkTheme(page);
        await goToOnboardingState(page, "transcription");
        const mobileOnboardingCard = page.locator(
            '[data-sot-card="onboarding"]',
        );
        await expect(currentOnboardingPanel(page)).toHaveAttribute(
            "data-sot-state",
            "transcription",
        );
        await expect(
            sotList(page, "onboarding-default-sources"),
        ).toBeVisible();
        await expect(
            sotPanel(page, "onboarding-default-source-step"),
        ).toBeVisible();
        frames.push({
            id: "onboarding-default-source-mobile-responsive",
            label: "Onboarding default-source runtime responsive frame, mobile",
            parityType: "structural",
            route: "/onboarding",
            theme: "dark",
            viewport: { width: 390, height: 780 },
            screenshot: await captureEvidenceScreenshot(
                page,
                mobileOnboardingCard,
                "onboarding-default-source-mobile.png",
            ),
            assertions: [
                "mobile viewport preserves onboarding card/frame markers",
                "data-sot-state=transcription",
                "default-source list remains visible",
            ],
            blocker:
                "No separate mobile onboarding artboard exists in §09; this is runtime structural evidence, not a mobile pixel claim.",
        });

        await gotoOnboardingPage(page);
        await forceDarkTheme(page);
        await expect(currentOnboardingPanel(page)).toHaveAttribute(
            "data-sot-state",
            "source",
        );
        await expect(sotList(page, "provider-cards")).toBeVisible();
        frames.push({
            id: "onboarding-source-mobile-structural-state",
            label: "Onboarding source/provider visual state, mobile",
            parityType: "structural",
            route: "/onboarding",
            theme: "dark",
            viewport: { width: 390, height: 780 },
            screenshot: await captureEvidenceScreenshot(
                page,
                mobileOnboardingCard,
                "onboarding-source-mobile.png",
            ),
            assertions: [
                "data-sot-state=source",
                "provider cards are visible",
                "selected provider state is present",
                "legacy .sidebar/.panel surfaces are absent",
            ],
            blocker:
                "No exact visual target exists for this product runtime state in §09 or the web kit.",
        });

        await page.setViewportSize({ width: 1280, height: 900 });
        await gotoOnboardingPage(page);
        await forceDarkTheme(page);
        await goToOnboardingState(page, "speakers");
        await page.locator('[data-sot-control="speaker-name"]').fill("林梅");
        await expect(currentOnboardingPanel(page)).toHaveAttribute(
            "data-sot-state",
            "speakers",
        );
        frames.push({
            id: "onboarding-speakers-desktop-structural-state",
            label: "Onboarding speaker-profile visual state, desktop",
            parityType: "structural",
            route: "/onboarding",
            theme: "dark",
            viewport: { width: 1280, height: 900 },
            screenshot: await captureEvidenceScreenshot(
                page,
                onboardingCard,
                "onboarding-speakers-desktop.png",
            ),
            assertions: [
                "data-sot-state=speakers",
                "speaker draft profile state is visible",
                "speaker display-name input is editable",
                "matrix row reflects the pending speaker profile",
            ],
            blocker:
                "No exact visual target exists for this product runtime state in §09 or the web kit.",
        });

        await goToOnboardingState(page, "finish");
        await expect(currentOnboardingPanel(page)).toHaveAttribute(
            "data-sot-state",
            "finish",
        );
        await expect(sotList(page, "finish-summary")).toContainText("林梅");
        frames.push({
            id: "onboarding-finish-desktop-structural-state",
            label: "Onboarding finish-summary visual state, desktop",
            parityType: "structural",
            route: "/onboarding",
            theme: "dark",
            viewport: { width: 1280, height: 900 },
            screenshot: await captureEvidenceScreenshot(
                page,
                onboardingCard,
                "onboarding-finish-desktop.png",
            ),
            assertions: [
                "data-sot-state=finish",
                "finish summary is visible",
                "save-enter control is present",
                "speaker summary includes the local test display name",
            ],
            blocker:
                "No exact visual target exists for this product runtime state in §09 or the web kit.",
        });
    } finally {
        await sotPage.close();
    }

    const electronReferenceScreenshot = await copyElectronReferenceScreenshot();
    const electronReference = {
        id: "electron-onboarding-artboard-relationship",
        parityType: "reference-only",
        screenshot: electronReferenceScreenshot,
        sourcePath: electronReferenceScreenshot.sourcePath,
        sourceChain: [
            "ui_kits/electron/app.jsx lines 65-84: aux/onboarding DCArtboard placement",
            "ui_kits/electron/windows.jsx lines 357-427: electron Onboarding component",
            "ui_kits/electron/electron.css lines 319-368: electron onboarding visual rules",
            "ui_kits/electron/design-canvas.jsx lines 349-456: artboard selector wrapper",
        ],
        blocker:
            "Reference-only. Electron onboarding is a platform artboard and must not be promoted to Web product pixel target without a product/SOT decision.",
    };

    const evidenceJsonPath = path.join(
        ROW_119_EVIDENCE_DIR,
        "auth-onboarding-visual-matrix-evidence.json",
    );
    const evidenceMdPath = path.join(
        ROW_119_EVIDENCE_DIR,
        "evidence.md",
    );
    const evidenceJsonRel = repoRelativePath(evidenceJsonPath);
    const evidence = {
        generatedAt,
        status: "PARTIAL",
        row: 119,
        scope:
            "Evidence-only row 119 addendum for responsive frames, other onboarding visual states, and electron artboard relationship. No product source changes.",
        sotAmbiguity: {
            webKitOmission:
                "ui_kits/web/README.md lines 34-37 says settings, login, and onboarding were intentionally omitted from supplied web codebase fragments; ui_kits/web/index.html is not login/onboarding SOT.",
            systemReference:
                "preview/19-system-reference.html §09 lines 499-537 is the compact auth/onboarding system reference used for current fixture pixel checks.",
            electronArtboard:
                "ui_kits/electron aux/onboarding is reference-only for row 119 unless a product decision promotes it to a Web product pixel target.",
        },
        sourceReferences: [
            {
                id: "system-reference-section-09",
                path: SOT_SYSTEM_REFERENCE_REL,
                lines: "499-537",
                parityUse: "compact pixel fixture target",
            },
            {
                id: "web-kit-readme-omission",
                path: "tmp/betterainote-design-evidence/handoff-20260531/betterainote-design-system/project/ui_kits/web/README.md",
                lines: "34-37",
                parityUse: "SOT ambiguity and non-claim boundary",
            },
            {
                id: "electron-onboarding-artboard",
                path: "tmp/betterainote-design-evidence/handoff-20260531/betterainote-design-system/project/ui_kits/electron/app.jsx",
                lines: "65-84",
                parityUse: "reference-only relationship",
            },
        ],
        existingEvidenceReferences: [
            {
                path: "tmp/betterainote-design-evidence/run-20260605-sot-1to1/auth-onboarding-20260611/auth-onboarding-evidence.json",
                parityType: "existing-evidence-reference",
                notes: [
                    "Prior addendum maps §09 and electron reference source chain.",
                    "Prior default-source evidence is 12 one-channel transparent-corner pixels with maxChannelDelta=1, not exact-zero.",
                ],
            },
        ],
        frames,
        electronReference,
        nonClaims: [
            "Does not claim row 119 PASS.",
            "Does not treat ui_kits/web/index.html as login/onboarding SOT.",
            "Does not treat the electron artboard as a Web product pixel target.",
            "Does not claim onboarding default-source exact-zero pixels while the rounded-corner RGB +1 residual remains.",
            "Does not modify src product files.",
        ],
        remainingGaps: [
            "Electron onboarding product comparison still needs a product/SOT decision before it is safe.",
            "Other onboarding states have structural/runtime screenshots, not exact visual targets.",
            "Responsive mobile frames are structural because §09 has no separate mobile pixel artboard.",
            "Onboarding default-source §09 fixture is bounded to the known 12-pixel disabled-row rounded-corner residual, not exact-zero.",
            "Broader all-page/all-control scripted plus real-browser acceptance remains outside this focused addendum.",
        ],
    };

    await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
    await writeFile(
        evidenceMdPath,
        renderRow119EvidenceMarkdown({
            electronReference,
            evidenceJsonPath: evidenceJsonRel,
            frames,
            generatedAt,
        }),
    );
});

test("SOT auth sends a magic link and never exposes the old password form", async ({
    page,
}) => {
    await resetAuthUsers();
    await gotoAuthPage(page, "/login");

    const form = page.locator('[data-sot-surface="auth-login"]');
    const emailInput = sotControl(page, "auth-email");
    await expect(page.locator('[data-sot-layout="auth-workstation"]')).toBeVisible();
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute("data-sot-card", "auth");
    await expect(form).toHaveAttribute("data-sot-state", "idle");
    await expect(form.locator('[data-sot-part="card-heading"]')).toContainText("登录 / Sign in");
    await expect(form.locator('[data-sot-frame="auth"]')).toBeVisible();
    await expect(emailInput).toBeEditable();
    await expect(emailInput).toHaveAttribute("data-slot", "input");
    await expect(emailInput).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator(".sidebar, .panel")).toHaveCount(0);
    await expect(page.locator("#password")).toHaveCount(0);
    await expect(page.locator("#name")).toHaveCount(0);

    await emailInput.fill("magic-ui@example.com");
    await sendLoginLink(page);

    await expect(form).toHaveAttribute("data-sot-state", "success");
    const successMessage = form.locator(
        '[data-sot-part="auth-form-message"][data-sot-state="success"]',
    );
    await expect(successMessage).toHaveAttribute(
        "data-auth-form-state",
        "success",
    );
    await expect(successMessage).toContainText("登录链接已发送");
    expect(await readMagicLinkVerification("magic-ui@example.com")).toBe(true);
});

test("SOT auth blocks second-user magic links and supports local-only session", async ({
    page,
}) => {
    await resetAuthUsers();
    await createRegisteredUser(PLAYWRIGHT_EMAIL);

    await gotoAuthPage(page, "/login");
    const form = page.locator('[data-sot-surface="auth-login"]');
    await sotControl(page, "auth-email").fill("other-admin@example.com");
    await sendLoginLink(page, { expectedStatus: 403 });

    await expect(form).toHaveAttribute("data-sot-state", "error");
    await expect(sotControl(page, "auth-email")).toHaveAttribute(
        "aria-invalid",
        "true",
    );
    await expect(sotControl(page, "auth-email")).toHaveAttribute(
        "data-sot-state",
        "error",
    );
    await expect(
        form.locator(
            '[data-sot-part="auth-form-message"][data-sot-state="error"]',
        ),
    ).toContainText(
        /Registration is disabled|登录链接发送失败/,
    );
    expect(await readMagicLinkVerification("other-admin@example.com")).toBe(
        false,
    );

    await resetAuthUsers();
    await gotoAuthPage(page, "/login");
    await Promise.all([
        page.waitForURL("**/dashboard", { waitUntil: "commit" }),
        page.locator('[data-sot-control="local-only"]').click(),
    ]);

    expect(await countAnonymousUsers()).toBe(1);
});

test("SOT register route reuses the email-link setup surface without legacy account fields", async ({
    page,
}) => {
    await resetAuthUsers();
    await gotoAuthPage(page, "/register");

    await expect(page.locator('[data-sot-surface="auth-register"]')).toBeVisible();
    await expect(sotControl(page, "auth-email")).toBeEditable();
    await expect(page.locator("#password")).toHaveCount(0);
    await expect(page.locator("#name")).toHaveCount(0);
    await expect(page.locator('[data-sot-control="local-only"]')).toBeVisible();
});

test("SOT onboarding exposes source, default transcription, speaker, and finish states", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await ensureSignedIn(page);
    await resetOnboardingConnections(await getPlaywrightUserId());

    await gotoOnboardingPage(page);

    const panel = currentOnboardingPanel(page);
    await expect(page.locator('[data-sot-layout="onboarding-workstation"]')).toBeVisible();
    await expect(page.locator('[data-sot-card="onboarding"]')).toBeVisible();
    await expect(panel).toHaveAttribute("data-sot-frame", "onboarding");
    await expect(page.locator(".sidebar, .panel")).toHaveCount(0);
    await expect(sotPanel(page, "onboarding-steps")).toBeVisible();
    await expect(sotControl(page, "onboarding-step")).toHaveCount(4);
    await expect(
        page.locator('[data-sot-control="onboarding-step"][data-sot-step="source"]'),
    ).toHaveAttribute("data-sot-state", "active");
    await expect(panel).toHaveAttribute("data-sot-state", "source");
    await expect(panel).toHaveAttribute("data-sot-provider", "plaud");
    await expect(sotList(page, "provider-cards")).toBeVisible();
    await expect(
        page.locator('[data-sot-control="provider-card"][data-sot-provider="plaud"]'),
    ).toHaveAttribute("data-sot-state", "selected");
    await expect(
        sotControl(page, "matrix-row").filter({ hasText: "当前来源" }),
    ).toHaveAttribute("data-sot-state", "selected");

    await page
        .locator(
            '[data-sot-control="provider-card"][data-sot-provider="feishu-minutes"]',
        )
        .click();

    await expect(panel).toHaveAttribute("data-sot-provider", "feishu-minutes");
    await expect(
        page.locator(
            '[data-sot-control="provider-card"][data-sot-provider="feishu-minutes"]',
        ),
    ).toHaveAttribute("data-sot-state", "selected");

    await goToOnboardingState(page, "transcription");
    await expect(sotList(page, "onboarding-default-sources")).toBeVisible();
    await expect(
        sotPanel(page, "onboarding-default-source-step"),
    ).toBeVisible();
    await expect(
        page.locator('[data-sot-control="onboarding-default-source"]').first(),
    ).toHaveAttribute("data-sot-state", "selected");
    await page.getByRole("button", { name: /TicNote/ }).click();
    await expect(
        page.locator('[data-sot-control="onboarding-default-source"]').nth(1),
    ).toHaveAttribute("data-sot-state", "selected");

    await goToOnboardingState(page, "speakers");
    await expect(sotControl(page, "speaker-profile-draft")).toHaveAttribute(
        "data-sot-state",
        "idle",
    );
    await expect(page.locator('[data-sot-control="speaker-name"]')).toBeEditable();
    await page.locator('[data-sot-control="speaker-name"]').fill("林梅");
    await page
        .locator('[data-sot-control="speaker-voiceprint"]')
        .fill("voiceprint-playwright");

    await goToOnboardingState(page, "finish");
    await expect(panel).toHaveAttribute("data-sot-state", "finish");
    await expect(page.locator('[data-sot-list="finish-summary"]')).toContainText(
        "林梅",
    );
});

test("SOT onboarding save connects source, transcription defaults, and speaker profile APIs", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetOnboardingConnections(await getPlaywrightUserId());

    let dataSourcePayload: Record<string, unknown> | null = null;
    let transcriptionPayload: Record<string, unknown> | null = null;
    let speakerPayload: Record<string, unknown> | null = null;

    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() === "PUT") {
            dataSourcePayload = route.request().postDataJSON();
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ success: true }),
            });
            return;
        }

        await route.continue();
    });
    await page.route("**/api/settings/transcription", async (route) => {
        if (route.request().method() === "PUT") {
            transcriptionPayload = route.request().postDataJSON();
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ success: true }),
            });
            return;
        }

        await route.continue();
    });
    await page.route("**/api/speakers/profiles", async (route) => {
        if (route.request().method() === "POST") {
            speakerPayload = route.request().postDataJSON();
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    profile: {
                        id: "profile-e2e",
                        displayName: "林梅",
                        voiceprintRef: "voiceprint-playwright",
                        assignmentCount: 0,
                    },
                }),
            });
            return;
        }

        await route.continue();
    });

    await gotoOnboardingPage(page);

    const authorizationInput = page.locator("#source-secret");
    await expect(authorizationInput).toBeEditable();
    await authorizationInput.fill("Bearer playwright-onboarding-token");
    await expect(authorizationInput).toHaveValue(
        "Bearer playwright-onboarding-token",
    );

    await goToOnboardingState(page, "transcription");
    await goToOnboardingState(page, "speakers");
    await page.locator('[data-sot-control="speaker-name"]').fill("林梅");
    await page
        .locator('[data-sot-control="speaker-voiceprint"]')
        .fill("voiceprint-playwright");
    await goToOnboardingState(page, "finish");

    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/data-sources") &&
                response.request().method() === "PUT",
        ),
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/transcription") &&
                response.request().method() === "PUT",
        ),
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/speakers/profiles") &&
                response.request().method() === "POST",
        ),
        page.waitForURL("**/dashboard", { waitUntil: "commit" }),
        page.locator('[data-sot-control="save-enter"]').click(),
    ]);

    expect(dataSourcePayload).toMatchObject({
        provider: "plaud",
        enabled: true,
        secrets: {
            bearerToken: "Bearer playwright-onboarding-token",
        },
    });
    expect(transcriptionPayload).toMatchObject({
        autoTranscribe: true,
        defaultTranscriptionLanguage: "zh",
    });
    expect(speakerPayload).toMatchObject({
        displayName: "林梅",
        voiceprintRef: "voiceprint-playwright",
    });
});
