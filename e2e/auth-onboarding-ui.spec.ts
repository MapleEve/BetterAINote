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

async function resetAuthUsers() {
    const client = createClient({ url: databaseUrl(CORE_DB) });
    try {
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
    } finally {
        await client.close();
    }
}

async function goToOnboardingState(
    page: Page,
    wizard: ReturnType<Page["getByTestId"]>,
    state: string,
) {
    const nextButton = page.getByRole("button", { name: "下一步" });

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await nextButton.click();
        if (
            await wizard
                .getAttribute("data-onboarding-state", { timeout: 1_000 })
                .then((value) => value === state)
                .catch(() => false)
        ) {
            return;
        }
        await page.waitForTimeout(250);
    }

    await expect(wizard).toHaveAttribute("data-onboarding-state", state);
}

async function openSelectContent(
    page: Page,
    trigger: ReturnType<Page["locator"]>,
) {
    const selectContent = page.locator('[data-slot="select-content"]').last();

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await trigger.click();
        if (
            await selectContent
                .isVisible({ timeout: 1_000 })
                .catch(() => false)
        ) {
            return selectContent;
        }

        await trigger.press("Enter");
        if (
            await selectContent
                .isVisible({ timeout: 1_000 })
                .catch(() => false)
        ) {
            return selectContent;
        }

        await page.waitForTimeout(250);
    }

    await expect(selectContent).toBeVisible();
    return selectContent;
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

test("auth register keeps graphite shell, loading state, and error feedback stable", async ({
    page,
}) => {
    await resetAuthUsers();

    let signUpPayload: Record<string, unknown> | null = null;
    let releaseSignUpResponse: (() => void) | null = null;
    let resolveSignUpRequest: () => void = () => {};
    const signUpRequest = new Promise<void>((resolve) => {
        resolveSignUpRequest = resolve;
    });

    await page.route("**/api/auth/sign-up/email", async (route) => {
        if (route.request().method() !== "POST") {
            await route.continue();
            return;
        }

        signUpPayload = route.request().postDataJSON() as Record<string, unknown>;
        resolveSignUpRequest();
        await new Promise<void>((resolve) => {
            releaseSignUpResponse = resolve;
        });
        await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({ error: "Registration is disabled" }),
        });
    });

    const authPageHydration = waitForAuthPageHydration(page);
    await page.goto("/register", { waitUntil: "domcontentloaded" });
    await authPageHydration;

    const form = page.locator('[data-auth-surface="register"]');
    await expect(form).toBeVisible();
    await expect(page.locator(".dashboard-workstation")).toBeVisible();
    await expect(page.locator("#name")).toBeEditable();
    await expect(page.locator("#email")).toBeEditable();
    await expect(page.locator("#password")).toBeEditable();

    await page.locator("#name").fill("Playwright Register");
    await page.locator("#email").fill("register-ui@example.com");
    await page.locator("#password").fill("RegisterPassword123!");

    const submitButton = form.locator('button[type="submit"]');
    await submitButton.click();
    await signUpRequest;

    expect(signUpPayload).toMatchObject({
        name: "Playwright Register",
        email: "register-ui@example.com",
        password: "RegisterPassword123!",
    });
    await expect(submitButton).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("#name")).toBeDisabled();
    await expect(page.locator("#email")).toBeDisabled();
    await expect(page.locator("#password")).toBeDisabled();

    releaseSignUpResponse?.();

    await expect(form.locator('[data-auth-form-state="error"]')).toBeVisible();
    await expect(form.locator('[data-auth-form-state="error"]')).toContainText(
        /Registration is disabled|创建账号失败/,
    );
    await expect(submitButton).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#password")).toHaveAttribute(
        "aria-invalid",
        "true",
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
    const providerSelect = await openSelectContent(
        page,
        page.locator("#source-provider"),
    );
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
    await goToOnboardingState(page, wizard, "auth");

    const authModeSelect = await openSelectContent(
        page,
        page.locator("#source-auth-mode"),
    );
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

    await goToOnboardingState(page, wizard, "auth");

    const authorizationInput = page.locator("#source-secret");
    await expect(authorizationInput).toBeEditable();
    await authorizationInput.fill("Bearer playwright-onboarding-token");
    await expect(authorizationInput).toHaveValue(
        "Bearer playwright-onboarding-token",
    );

    await goToOnboardingState(page, wizard, "privacy");

    await goToOnboardingState(page, wizard, "finish");

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
