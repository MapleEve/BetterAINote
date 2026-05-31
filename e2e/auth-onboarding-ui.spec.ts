import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const E2E_DATA_DIR = path.resolve(process.cwd(), "tmp/e2e/data");
const PLAYWRIGHT_EMAIL = "playwright-admin@example.com";

function resolveDatabasePath() {
    return process.env.DATABASE_PATH
        ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
        : path.join(E2E_DATA_DIR, "betterainote-e2e.db");
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

function databaseUrl(filePath: string) {
    assertE2EDatabasePath(filePath);
    return pathToFileURL(filePath).href;
}

const CORE_DB = resolveDatabasePath();

async function getPlaywrightUserId() {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        const result = await client.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: [PLAYWRIGHT_EMAIL],
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

async function resetOnboardingConnections(userId: string) {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
        await client.execute({
            sql: "DELETE FROM source_connections WHERE user_id = ?",
            args: [userId],
        });
    } finally {
        await client.close();
    }
}

test("auth login keeps graphite shell, disabled controls, and error feedback stable", async ({
    page,
}) => {
    const authPageHydration = waitForAuthPageHydration(page);
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await authPageHydration;

    const form = page.locator('[data-auth-surface="login"]');
    await expect(form).toBeVisible();
    await expect(page.locator(".dashboard-workstation")).toBeVisible();
    await expect(page.locator("#email")).toBeEditable();
    await expect(page.locator("#password")).toBeEditable();

    await page.locator("#email").fill("wrong@example.com");
    await page.locator("#password").fill("WrongPassword123!");
    await expect(page.locator("#email")).toHaveValue("wrong@example.com");
    await expect(page.locator("#password")).toHaveValue("WrongPassword123!");
    await page.getByRole("button", { name: "登录" }).click();

    await expect(form.locator('[data-auth-form-state="error"]')).toBeVisible();
    await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#password")).toHaveAttribute(
        "aria-invalid",
        "true",
    );
    await expect(page.getByRole("button", { name: "登录" })).toHaveAttribute(
        "aria-busy",
        "false",
    );
});

test("onboarding keeps mobile provider selects above the shell and scroll-stable", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await ensureSignedIn(page);
    await resetOnboardingConnections(await getPlaywrightUserId());

    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });

    const wizard = page.getByTestId("onboarding-wizard");
    await expect(wizard).toBeVisible();
    await expect(wizard).toHaveAttribute("data-onboarding-state", "source");
    await expect(page.getByTestId("onboarding-provider-select")).toBeVisible();

    const wizardHeight = await wizard.evaluate(
        (node) => node.getBoundingClientRect().height,
    );
    await page.locator("#source-provider").click();
    const providerSelect = page.locator('[data-slot="select-content"]');
    await expect(providerSelect).toBeVisible();
    const providerZIndex = await providerSelect.evaluate((node) =>
        Number.parseInt(window.getComputedStyle(node).zIndex, 10),
    );
    expect(providerZIndex).toBeGreaterThanOrEqual(650);

    await providerSelect.hover();
    await page.mouse.wheel(0, 600);
    await expect
        .poll(() =>
            wizard.evaluate(
                (node, baseline) =>
                    Math.abs(node.getBoundingClientRect().height - baseline),
                wizardHeight,
            ),
        )
        .toBeLessThan(2);

    await page.getByRole("option", { name: "飞书妙记" }).click();
    await page.getByRole("button", { name: "下一步" }).click();
    await expect(wizard).toHaveAttribute("data-onboarding-state", "auth");

    await page.locator("#source-auth-mode").click();
    const authModeSelect = page.locator('[data-slot="select-content"]');
    await expect(authModeSelect).toBeVisible();
    const authModeZIndex = await authModeSelect.evaluate((node) =>
        Number.parseInt(window.getComputedStyle(node).zIndex, 10),
    );
    expect(authModeZIndex).toBeGreaterThanOrEqual(650);

    await page.keyboard.press("Escape");
    await expect(authModeSelect).toBeHidden();
    await expect(wizard).toHaveAttribute("data-onboarding-state", "auth");
});

test("onboarding saves Plaud Authorization before opening the workspace", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetOnboardingConnections(await getPlaywrightUserId());

    let releaseDataSourceSave: (() => void) | null = null;
    let captureDataSourceSave: (payload: Record<string, unknown>) => void;
    const dataSourceSaveRequest = new Promise<Record<string, unknown>>(
        (resolve) => {
            captureDataSourceSave = resolve;
        },
    );
    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() !== "PUT") {
            await route.continue();
            return;
        }

        captureDataSourceSave(route.request().postDataJSON());
        await new Promise<void>((release) => {
            releaseDataSourceSave = release;
        });
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });

    const wizard = page.getByTestId("onboarding-wizard");
    await expect(wizard).toBeVisible();
    await expect(wizard).toHaveAttribute("data-onboarding-provider", "plaud");
    await expect(wizard).toHaveAttribute("data-onboarding-state", "source");

    await page.getByRole("button", { name: "下一步" }).click();
    await expect(wizard).toHaveAttribute("data-onboarding-state", "auth");

    const authorizationInput = page.locator("#source-secret");
    await expect(authorizationInput).toBeEditable();
    await authorizationInput.fill("Bearer playwright-onboarding-token");
    await expect(authorizationInput).toHaveValue(
        "Bearer playwright-onboarding-token",
    );

    await page.getByRole("button", { name: "下一步" }).click();
    await expect(wizard).toHaveAttribute("data-onboarding-state", "privacy");

    await page.getByRole("button", { name: "下一步" }).click();
    await expect(wizard).toHaveAttribute("data-onboarding-state", "finish");

    const saveButton = page.getByTestId("onboarding-save-enter");
    await saveButton.click();

    const savePayload = await dataSourceSaveRequest;
    await expect(wizard).toHaveAttribute("data-onboarding-state", "saving");
    await expect(saveButton).toHaveAttribute("aria-busy", "true");
    await expect(saveButton).toContainText("保存中");
    expect(savePayload).toMatchObject({
        provider: "plaud",
        enabled: true,
        secrets: {
            bearerToken: "Bearer playwright-onboarding-token",
        },
    });

    releaseDataSourceSave?.();

    await expect(wizard).toHaveAttribute("data-onboarding-state", "connected");
    await expect(page.getByTestId("onboarding-enter-workspace")).toBeVisible();

    await Promise.all([
        page.waitForURL("**/dashboard", { waitUntil: "commit" }),
        page.getByTestId("onboarding-enter-workspace").click(),
    ]);
});

async function waitForAuthPageHydration(page: Page) {
    await page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/settings/display") &&
                response.request().method() === "GET",
            { timeout: 15_000 },
        )
        .catch(() => null);
}
