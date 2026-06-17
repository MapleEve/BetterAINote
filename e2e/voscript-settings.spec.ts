import { expect, type Locator, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const VOSCRIPT_KEY_KEEP = "__keep_voscript_key__";
const VOSCRIPT_KEY_CLEAR = "__clear_voscript_key__";

type VoScriptSettingsPayload = {
    privateTranscriptionApiKeySet: boolean;
    privateTranscriptionBaseUrl: string | null;
    privateTranscriptionDenoiseModel: "none" | "deepfilternet" | "noisereduce";
    privateTranscriptionMaxInflightJobs: number;
    privateTranscriptionMaxSpeakers: number;
    privateTranscriptionMinSpeakers: number;
    privateTranscriptionNoRepeatNgramSize: number;
    privateTranscriptionSnrThreshold: number | null;
};

function voscriptSettings(
    overrides: Partial<VoScriptSettingsPayload> = {},
): VoScriptSettingsPayload {
    return {
        privateTranscriptionApiKeySet: true,
        privateTranscriptionBaseUrl: "https://voscript.e2e.example",
        privateTranscriptionDenoiseModel: "none",
        privateTranscriptionMaxInflightJobs: 1,
        privateTranscriptionMaxSpeakers: 0,
        privateTranscriptionMinSpeakers: 0,
        privateTranscriptionNoRepeatNgramSize: 0,
        privateTranscriptionSnrThreshold: null,
        ...overrides,
    };
}

async function resetDisplayToChinese(page: Page) {
    const resetResponse = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            displayDensity: "comfy",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "dark",
            uiLanguage: "zh-CN",
        },
    });
    expect(resetResponse.ok()).toBe(true);
}

function settingsShell(page: Page) {
    return page.locator('[data-sot-surface="settings-shell"]');
}

function settingsSection(page: Page, section: "transcription" | "voscript") {
    return page.locator(
        `[data-sot-surface="settings-section"][data-sot-section="${section}"]`,
    );
}

function sectionSaveButton(section: Locator, saveId?: string) {
    if (saveId) {
        return section.locator(
            `[data-sot-panel="settings-save-actions"][data-sot-save-id="${saveId}"] [data-sot-control="settings-save"]`,
        );
    }

    return section.locator('[data-sot-control="settings-save"]');
}

async function expectSectionReady(
    page: Page,
    sectionName: "transcription" | "voscript",
) {
    const shell = settingsShell(page);
    const section = settingsSection(page, sectionName);

    await expect(shell).toHaveAttribute("data-sot-section", sectionName);
    await expect(shell).toHaveAttribute("data-sot-state", "idle");
    await expect(shell).toHaveAttribute("aria-busy", "false");
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(section).toHaveAttribute("aria-busy", "false");
}

test("VoScript settings shows settings load failure and retries", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let settingsGets = 0;

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        settingsGets += 1;
        if (settingsGets === 1) {
            await route.fulfill({
                contentType: "application/json",
                status: 503,
                body: JSON.stringify({
                    error: "VoScript settings temporarily unavailable",
                }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(voscriptSettings()),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    const section = settingsSection(page, "voscript");
    await expect(section).toHaveAttribute("data-sot-state", "error");
    await expect(section.getByText("加载失败")).toBeVisible();
    await expect(
        section.getByText("VoScript settings temporarily unavailable"),
    ).toBeVisible();
    await expect(sectionSaveButton(section)).toHaveCount(0);

    await section.getByRole("button", { name: "重试" }).click();
    await expectSectionReady(page, "voscript");
    await expect(
        section.getByRole("heading", { name: "VoScript 服务" }),
    ).toBeVisible();
    await expect(
        sectionSaveButton(section, "voscript-connection"),
    ).toBeEnabled();
    await expect(sectionSaveButton(section, "voscript-params")).toBeEnabled();
    expect(settingsGets).toBe(2);
});

test("VoScript settings saves current SOT controls and keeps the shell scroll-stable", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let settingsSavePayload: Record<string, unknown> | null = null;
    let releaseSettingsSave = () => {};
    let notifySettingsSaveStarted = () => {};
    const settingsSaveStarted = new Promise<void>((resolve) => {
        notifySettingsSaveStarted = resolve;
    });
    const pendingSettingsSave = new Promise<void>((resolve) => {
        releaseSettingsSave = resolve;
    });

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(voscriptSettings()),
            });
            return;
        }

        settingsSavePayload = route.request().postDataJSON();
        notifySettingsSaveStarted();
        await pendingSettingsSave;
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    await expectSectionReady(page, "voscript");
    const section = settingsSection(page, "voscript");
    const saveButton = sectionSaveButton(section, "voscript-params");

    await section.locator("#voscript-base-url").fill(
        "https://voscript-updated.e2e.example",
    );
    await section.locator("#voscript-api-key").fill("typed-e2e-key");
    await section.locator("#voscript-min-speakers").fill("1");
    await section.locator("#voscript-max-speakers").fill("3");
    await section.locator("#voscript-no-repeat-ngram").fill("4");
    await section.locator("#voscript-snr-threshold").fill("12.5");
    await section.locator("#voscript-max-inflight-jobs").fill("2");
    await section
        .getByRole("combobox", { name: "降噪模型" })
        .selectOption("deepfilternet");

    const saveResponse = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/settings/voscript") &&
            response.request().method() === "PUT" &&
            response.ok(),
    );
    await Promise.all([settingsSaveStarted, saveButton.click()]);
    await expect(settingsShell(page)).toHaveAttribute("data-sot-state", "busy");
    await expect(section).toHaveAttribute("data-sot-state", "busy");
    await expect(section).toHaveAttribute("aria-busy", "true");
    await expect(saveButton).toBeDisabled();
    await expect(saveButton).toHaveAttribute("aria-busy", "true");
    await expect(saveButton).toHaveAttribute("data-sot-state", "saving");
    await expect(saveButton).toContainText("保存中");

    releaseSettingsSave();
    await saveResponse;
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(saveButton).toHaveAttribute("data-sot-state", "saved");
    await expect(saveButton).toContainText("已保存");
    await expect(section.locator("#voscript-api-key")).toHaveValue("");
    expect(settingsSavePayload).toMatchObject({
        privateTranscriptionApiKey: "typed-e2e-key",
        privateTranscriptionBaseUrl: "https://voscript-updated.e2e.example",
        privateTranscriptionDenoiseModel: "deepfilternet",
        privateTranscriptionMaxInflightJobs: 2,
        privateTranscriptionMaxSpeakers: 3,
        privateTranscriptionMinSpeakers: 1,
        privateTranscriptionNoRepeatNgramSize: 4,
        privateTranscriptionSnrThreshold: 12.5,
    });

    await section.hover();
    await page.mouse.wheel(0, 1200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(settingsShell(page)).toHaveAttribute(
        "data-sot-section",
        "voscript",
    );
});

test("VoScript settings blocks invalid no-repeat n-gram inline before saving", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let settingsPutCount = 0;

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(voscriptSettings()),
            });
            return;
        }

        settingsPutCount += 1;
        await route.fulfill({
            contentType: "application/json",
            status: 500,
            body: JSON.stringify({ error: "Unexpected VoScript PUT" }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    await expectSectionReady(page, "voscript");
    const section = settingsSection(page, "voscript");
    const ngramField = section.locator(
        '[data-slot="field"][data-sot-field="no-repeat-ngram"]',
    );
    const ngramInput = section.locator("#voscript-no-repeat-ngram");
    const paramsSave = section.locator(
        '[data-sot-panel="settings-save-actions"][data-sot-save-id="voscript-params"]',
    );
    const saveButton = sectionSaveButton(section, "voscript-params");

    await ngramInput.fill("1");

    await expect(ngramField).toHaveAttribute("data-sot-state", "invalid");
    await expect(ngramField).toHaveAttribute("data-invalid", "true");
    await expect(ngramInput).toHaveAttribute("aria-invalid", "true");
    await expect(
        ngramField.locator('[data-sot-part="settings-field-message"]'),
    ).toHaveText("只支持 0 或 ≥ 3");

    await saveButton.click();

    await expect(ngramInput).toHaveValue("1");
    await expect(saveButton).toHaveAttribute("data-sot-state", "error");
    await expect(
        ngramField.locator('[data-sot-part="settings-field-message"]'),
    ).toBeVisible();
    await expect(paramsSave).toContainText("只支持 0 或 ≥ 3");
    await expect.poll(() => settingsPutCount).toBe(0);

    await ngramInput.fill("2");
    await expect(ngramInput).toHaveValue("2");
    await saveButton.click();
    await expect(ngramInput).toHaveValue("2");
    await expect.poll(() => settingsPutCount).toBe(0);
});

test("VoScript settings blocks negative speaker bounds inline before saving", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let settingsPutCount = 0;

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(
                    voscriptSettings({
                        privateTranscriptionMaxSpeakers: 4,
                        privateTranscriptionMinSpeakers: 1,
                    }),
                ),
            });
            return;
        }

        settingsPutCount += 1;
        await route.fulfill({
            contentType: "application/json",
            status: 500,
            body: JSON.stringify({ error: "Unexpected VoScript PUT" }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    await expectSectionReady(page, "voscript");
    const section = settingsSection(page, "voscript");
    const minSpeakerField = section.locator(
        '[data-slot="field"][data-sot-field="min-speakers"]',
    );
    const maxSpeakerField = section.locator(
        '[data-slot="field"][data-sot-field="max-speakers"]',
    );
    const minSpeakerInput = section.locator("#voscript-min-speakers");
    const maxSpeakerInput = section.locator("#voscript-max-speakers");
    const paramsSave = section.locator(
        '[data-sot-panel="settings-save-actions"][data-sot-save-id="voscript-params"]',
    );
    const saveButton = sectionSaveButton(section, "voscript-params");

    await minSpeakerInput.fill("-1");
    await expect(minSpeakerField).toHaveAttribute("data-sot-state", "invalid");
    await expect(minSpeakerField).toHaveAttribute("data-invalid", "true");
    await expect(minSpeakerInput).toHaveAttribute("aria-invalid", "true");
    await expect(
        minSpeakerField.locator('[data-sot-part="settings-field-message"]'),
    ).toHaveText("不能为负数");

    await saveButton.click();

    await expect(minSpeakerInput).toHaveValue("-1");
    await expect(saveButton).toHaveAttribute("data-sot-state", "error");
    await expect(paramsSave).toContainText("不能为负数");
    await expect.poll(() => settingsPutCount).toBe(0);

    await minSpeakerInput.fill("1");
    await maxSpeakerInput.fill("-2");
    await expect(maxSpeakerField).toHaveAttribute("data-sot-state", "invalid");
    await expect(maxSpeakerField).toHaveAttribute("data-invalid", "true");
    await expect(maxSpeakerInput).toHaveAttribute("aria-invalid", "true");
    await expect(
        maxSpeakerField.locator('[data-sot-part="settings-field-message"]'),
    ).toHaveText("不能为负数");

    await saveButton.click();

    await expect(maxSpeakerInput).toHaveValue("-2");
    await expect(saveButton).toHaveAttribute("data-sot-state", "error");
    await expect(paramsSave).toContainText("不能为负数");
    await expect.poll(() => settingsPutCount).toBe(0);
});

test("VoScript settings blocks max speaker bounds below min before saving", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let settingsPutCount = 0;

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(
                    voscriptSettings({
                        privateTranscriptionMaxSpeakers: 4,
                        privateTranscriptionMinSpeakers: 1,
                    }),
                ),
            });
            return;
        }

        settingsPutCount += 1;
        await route.fulfill({
            contentType: "application/json",
            status: 500,
            body: JSON.stringify({ error: "Unexpected VoScript PUT" }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    await expectSectionReady(page, "voscript");
    const section = settingsSection(page, "voscript");
    const maxSpeakerField = section.locator(
        '[data-slot="field"][data-sot-field="max-speakers"]',
    );
    const minSpeakerInput = section.locator("#voscript-min-speakers");
    const maxSpeakerInput = section.locator("#voscript-max-speakers");
    const paramsSave = section.locator(
        '[data-sot-panel="settings-save-actions"][data-sot-save-id="voscript-params"]',
    );
    const saveButton = sectionSaveButton(section, "voscript-params");

    await minSpeakerInput.fill("5");
    await maxSpeakerInput.fill("3");

    await expect(maxSpeakerField).toHaveAttribute("data-sot-state", "invalid");
    await expect(maxSpeakerField).toHaveAttribute("data-invalid", "true");
    await expect(maxSpeakerInput).toHaveAttribute("aria-invalid", "true");
    await expect(
        maxSpeakerField.locator('[data-sot-part="settings-field-message"]'),
    ).toHaveText("最多说话人数必须 ≥ 最少说话人数");

    await saveButton.click();

    await expect(minSpeakerInput).toHaveValue("5");
    await expect(maxSpeakerInput).toHaveValue("3");
    await expect(saveButton).toHaveAttribute("data-sot-state", "error");
    await expect(paramsSave).toContainText(
        "最多说话人数必须 ≥ 最少说话人数",
    );
    await expect.poll(() => settingsPutCount).toBe(0);
});

test("VoScript settings tests the service connection without persisting settings", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    const testPayloads: Record<string, unknown>[] = [];
    let settingsPutCount = 0;
    let testAttempts = 0;
    let releaseConnectionTest = () => {};
    let notifyConnectionTestStarted = () => {};
    const connectionTestStarted = new Promise<void>((resolve) => {
        notifyConnectionTestStarted = resolve;
    });
    const pendingConnectionTest = new Promise<void>((resolve) => {
        releaseConnectionTest = resolve;
    });

    await page.route("**/api/settings/voscript/test", async (route) => {
        testAttempts += 1;
        testPayloads.push(route.request().postDataJSON());

        if (testAttempts === 1) {
            notifyConnectionTestStarted();
            await pendingConnectionTest;
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    available: true,
                    providerName: "voice-transcribe",
                    success: true,
                    voiceprintCount: 2,
                }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            status: 502,
            body: JSON.stringify({ error: "VoScript upstream unreachable" }),
        });
    });

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(voscriptSettings()),
            });
            return;
        }

        settingsPutCount += 1;
        await route.continue();
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    await expectSectionReady(page, "voscript");
    const section = settingsSection(page, "voscript");
    const testButton = section.locator('[data-sot-control="voscript-test"]');
    const connectionSaveButton = sectionSaveButton(
        section,
        "voscript-connection",
    );

    await expect(section.locator("[data-voscript-unavail]")).toHaveCount(0);
    await section.locator("#voscript-base-url").fill(
        "https://voscript-test.e2e.example",
    );
    await section.locator("#voscript-api-key").fill("typed-test-key");

    await testButton.click();
    await connectionTestStarted;
    await expect(settingsShell(page)).toHaveAttribute("data-sot-state", "busy");
    await expect(section).toHaveAttribute("data-sot-state", "busy");
    await expect(testButton).toHaveAttribute("data-sot-state", "testing");
    await expect(testButton).toHaveAttribute("aria-busy", "true");
    await expect(connectionSaveButton).toHaveAttribute("data-sot-state", "idle");

    const successResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/voscript/test") &&
            response.request().method() === "POST" &&
            response.ok(),
    );
    releaseConnectionTest();
    await successResponse;

    expect(testPayloads[0]).toMatchObject({
        privateTranscriptionApiKey: "typed-test-key",
        privateTranscriptionBaseUrl: "https://voscript-test.e2e.example",
    });
    expect(settingsPutCount).toBe(0);
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(testButton).toHaveAttribute("data-sot-state", "test-success");
    await expect(testButton).toContainText("连接正常");
    await expect(connectionSaveButton).toHaveAttribute("data-sot-state", "idle");

    await section.locator("#voscript-base-url").fill(
        "https://voscript-failing.e2e.example",
    );
    const failedResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/voscript/test") &&
            response.request().method() === "POST" &&
            response.status() === 502,
    );
    await testButton.click();
    await failedResponse;

    expect(testPayloads[1]).toMatchObject({
        privateTranscriptionApiKey: "typed-test-key",
        privateTranscriptionBaseUrl: "https://voscript-failing.e2e.example",
    });
    expect(settingsPutCount).toBe(0);
    await expect(testButton).toHaveAttribute("data-sot-state", "test-error");
    await expect(section.locator("[data-voscript-unavail]")).toBeVisible();
    await expect(
        section.getByText("VoScript upstream unreachable", { exact: true }),
    ).toBeVisible();
    await expect(connectionSaveButton).toHaveAttribute("data-sot-state", "idle");
});

test("VoScript settings clears a stored API key through the SOT key action", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let savePayload: Record<string, unknown> | null = null;

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(voscriptSettings()),
            });
            return;
        }

        savePayload = route.request().postDataJSON();
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    await expectSectionReady(page, "voscript");
    const section = settingsSection(page, "voscript");
    const apiKeyInput = section.locator("#voscript-api-key");
    const keyMode = section.getByRole("combobox", { name: "密钥操作" });
    const savedKeyDescription = section.getByText(
        "当前账号已保存一把 VoScript key。输入新 key 可替换。",
    );
    const emptyKeyDescription = section.getByText(
        "输入私有 VoScript 服务的 API key。",
    );

    await expect(savedKeyDescription).toBeVisible();
    await expect(keyMode).toHaveValue(VOSCRIPT_KEY_KEEP);
    await keyMode.selectOption(VOSCRIPT_KEY_CLEAR);
    await expect(apiKeyInput).toBeDisabled();

    const saveButton = sectionSaveButton(section, "voscript-connection");
    await saveButton.click();
    await expect(saveButton).toHaveAttribute(
        "data-sot-state",
        "saved",
    );
    expect(savePayload).toMatchObject({
        privateTranscriptionApiKey: null,
        privateTranscriptionBaseUrl: "https://voscript.e2e.example",
    });
    await expect(keyMode).toHaveCount(0);
    await expect(apiKeyInput).toBeEnabled();
    await expect(apiKeyInput).toHaveValue("");
    await expect(savedKeyDescription).toHaveCount(0);
    await expect(section.getByText("已存储", { exact: true })).toHaveCount(0);
    await expect(emptyKeyDescription).toBeVisible();
});

test("VoScript settings surfaces backend save errors and recovers on retry", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    const settingsSavePayloads: Record<string, unknown>[] = [];
    let saveAttempts = 0;

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(
                    voscriptSettings({
                        privateTranscriptionApiKeySet: false,
                        privateTranscriptionBaseUrl: null,
                    }),
                ),
            });
            return;
        }

        saveAttempts += 1;
        settingsSavePayloads.push(route.request().postDataJSON());
        if (saveAttempts === 1) {
            await route.fulfill({
                contentType: "application/json",
                status: 400,
                body: JSON.stringify({ error: "E2E VoScript save rejected" }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    await expectSectionReady(page, "voscript");
    const section = settingsSection(page, "voscript");
    const saveButton = sectionSaveButton(section, "voscript-connection");

    await section.locator("#voscript-base-url").fill(
        "https://bad-voscript.e2e.example",
    );
    await saveButton.click();
    await expect(saveButton).toHaveAttribute("data-sot-state", "error");
    await expect(section.getByText("E2E VoScript save rejected")).toBeVisible();
    expect(settingsSavePayloads).toHaveLength(1);

    await section.locator("#voscript-base-url").fill(
        "https://voscript-recovered.e2e.example",
    );
    await saveButton.click();
    await expect(saveButton).toHaveAttribute("data-sot-state", "saved");
    expect(settingsSavePayloads).toHaveLength(2);
    expect(settingsSavePayloads.at(-1)).toMatchObject({
        privateTranscriptionBaseUrl: "https://voscript-recovered.e2e.example",
    });
});

test("VoScript settings saves an empty service URL as nullable backend state", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let savePayload: Record<string, unknown> | null = null;

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(voscriptSettings()),
            });
            return;
        }

        savePayload = route.request().postDataJSON();
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    await expectSectionReady(page, "voscript");
    const section = settingsSection(page, "voscript");
    await section.locator("#voscript-base-url").fill("");
    await section.locator("#voscript-snr-threshold").fill("");

    const saveButton = sectionSaveButton(section, "voscript-connection");
    await saveButton.click();
    await expect(saveButton).toHaveAttribute(
        "data-sot-state",
        "saved",
    );
    expect(savePayload).toMatchObject({
        privateTranscriptionBaseUrl: null,
        privateTranscriptionSnrThreshold: null,
    });
    expect(savePayload).not.toHaveProperty("privateTranscriptionApiKey");
});

test("VoScript settings save speaker bounds through SOT controls", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    const speakerPayloads: Record<string, unknown>[] = [];

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(
                    voscriptSettings({ privateTranscriptionMaxSpeakers: 2 }),
                ),
            });
            return;
        }

        speakerPayloads.push(route.request().postDataJSON());
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    await expectSectionReady(page, "voscript");
    const section = settingsSection(page, "voscript");
    await expect(
        section.getByRole("heading", { name: "VoScript 服务" }),
    ).toBeVisible();
    await section.locator("#voscript-min-speakers").fill("2");
    await section.locator("#voscript-max-speakers").fill("5");

    const saveButton = sectionSaveButton(section, "voscript-params");
    await saveButton.click();
    await expect(saveButton).toHaveAttribute(
        "data-sot-state",
        "saved",
    );
    expect(speakerPayloads).toEqual([
        {
            privateTranscriptionBaseUrl: "https://voscript.e2e.example",
            privateTranscriptionDenoiseModel: "none",
            privateTranscriptionMaxInflightJobs: 1,
            privateTranscriptionMaxSpeakers: 5,
            privateTranscriptionMinSpeakers: 2,
            privateTranscriptionNoRepeatNgramSize: 0,
            privateTranscriptionSnrThreshold: null,
        },
    ]);
});

test("VoScript speaker bounds recover when VoScript settings load fails first", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let voscriptGets = 0;

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        voscriptGets += 1;
        if (voscriptGets === 1) {
            await route.fulfill({
                contentType: "application/json",
                status: 502,
                body: JSON.stringify({ error: "VoScript speaker bounds down" }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(
                voscriptSettings({
                    privateTranscriptionMaxSpeakers: 4,
                    privateTranscriptionMinSpeakers: 1,
                }),
            ),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    const section = settingsSection(page, "voscript");
    await expect(section).toHaveAttribute("data-sot-state", "error");
    await expect(section.getByText("VoScript speaker bounds down")).toBeVisible();

    await section.getByRole("button", { name: "重试" }).click();
    await expectSectionReady(page, "voscript");
    await expect(section.locator("#voscript-min-speakers")).toHaveValue("1");
    await expect(section.locator("#voscript-max-speakers")).toHaveValue("4");
    expect(voscriptGets).toBe(2);
});

test("VoScript settings loads remote voiceprint state from the SOT settings surface", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let voiceprintCalls = 0;
    let voscriptSavePayload: Record<string, unknown> | null = null;

    await page.route("**/api/voiceprints**", async (route) => {
        voiceprintCalls += 1;
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                available: true,
                reason: null,
                voiceprints: [
                    {
                        createdAt: "2026-05-01T00:00:00.000Z",
                        displayName: "Remote Voiceprint Should Stay Remote",
                        id: "vp-not-loaded-001",
                        updatedAt: "2026-05-02T00:00:00.000Z",
                    },
                ],
            }),
        });
    });
    await page.route("**/api/speakers/profiles**", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ profiles: [] }),
        });
    });
    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(voscriptSettings()),
            });
            return;
        }

        voscriptSavePayload = route.request().postDataJSON();
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    await expectSectionReady(page, "voscript");
    const section = settingsSection(page, "voscript");
    await expect(section.getByText("声纹库", { exact: true })).toBeVisible();
    await expect(
        section.locator('[data-sot-control="speaker-voiceprint-name"]'),
    ).toHaveValue("Remote Voiceprint Should Stay Remote");
    await expect(
        page.getByRole("dialog", { name: "确认操作", exact: true }),
    ).toHaveCount(0);

    await section.locator("#voscript-base-url").fill(
        "https://voscript-without-voiceprints.e2e.example",
    );
    const saveButton = sectionSaveButton(section, "voscript-connection");
    await saveButton.click();
    await expect(saveButton).toHaveAttribute(
        "data-sot-state",
        "saved",
    );
    expect(voscriptSavePayload).toMatchObject({
        privateTranscriptionBaseUrl:
            "https://voscript-without-voiceprints.e2e.example",
    });
    expect(voiceprintCalls).toBeGreaterThan(0);
});
