import { expect, type Locator, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";
import {
    chooseShadcnSelectOption,
    expectShadcnSelectTrigger,
} from "./helpers/shadcn-select";

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
    return page.getByRole("dialog", { name: /^(设置|Settings)$/ });
}

function settingsSection(page: Page, section: "transcription" | "voscript") {
    return page.getByRole("region", {
        name:
            section === "voscript"
                ? /^(VoScript 服务|VoScript Service)$/
                : /^(转录设置|Transcription Settings)$/,
    });
}

function sectionSaveButton(section: Locator, saveId?: string) {
    if (saveId) {
        return sectionSavePanel(section, saveId).getByRole("button", {
            name:
                saveId === "voscript-connection"
                    ? /^(保存服务连接|服务连接保存中|服务连接已保存|Save service connection|Saving service connection|service connection saved)$/i
                    : /^(保存转录运行参数|转录运行参数保存中|转录运行参数已保存|Save transcription runtime parameters|Saving transcription runtime parameters|transcription runtime parameters saved)$/i,
        });
    }

    return section.getByRole("button", {
        name: /^(保存|保存中|已保存|Save|Saving|Saved)$/,
    });
}

function sectionSavePanel(section: Locator, saveId: string) {
    return section.getByRole("group", {
        name:
            saveId === "voscript-connection"
                ? /^(服务连接操作|Service Connection actions)$/i
                : /^(转录运行参数操作|Transcription Runtime Parameters actions)$/i,
    });
}

function sectionControl(section: Locator, control: string) {
    return section.locator(`#${control}`);
}

function fieldFor(input: Locator) {
    return input.locator('xpath=ancestor::*[@data-slot="field"][1]');
}

function testConnectionButton(section: Locator) {
    return section.getByRole("button", {
        name: /^(测试 VoScript 连接|正在测试 VoScript 连接|VoScript 连接正常|Test VoScript connection|Testing VoScript connection|VoScript connection ready)$/,
    });
}

async function expectSaveButtonState(
    button: Locator,
    state: "idle" | "saving" | "saved",
) {
    const labels = {
        idle: /^(保存|保存服务连接|保存转录运行参数|Save|Save service connection|Save transcription runtime parameters)$/i,
        saved: /^(已保存|服务连接已保存|转录运行参数已保存|Saved|service connection saved|transcription runtime parameters saved)$/i,
        saving: /^(保存中|服务连接保存中|转录运行参数保存中|Saving|Saving service connection|Saving transcription runtime parameters)$/i,
    };
    await expect(button).toHaveAccessibleName(labels[state]);
}

async function expectVoScriptControlsDisabled(section: Locator) {
    for (const control of [
        "voscript-base-url",
        "voscript-api-key",
        "voscript-min-speakers",
        "voscript-max-speakers",
        "voscript-snr-threshold",
        "voscript-no-repeat-ngram",
        "voscript-max-inflight-jobs",
    ]) {
        const input = sectionControl(section, control);
        await expect(input).toBeDisabled();
    }

    const denoiseCombobox = section.getByRole("combobox", {
        name: "降噪模型",
    });
    await expect(denoiseCombobox).toBeDisabled();

    const keyModeCombobox = section.getByRole("combobox", {
        name: "密钥操作",
    });
    if ((await keyModeCombobox.count()) > 0) {
        await expect(keyModeCombobox).toBeDisabled();
    }
}

async function expectSectionReady(
    page: Page,
    sectionName: "transcription" | "voscript",
) {
    const shell = settingsShell(page);
    const section = settingsSection(page, sectionName);

    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute("aria-busy", "false");
    await expect(section).toBeVisible();
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
    await expect(section).toHaveAttribute("aria-busy", "false");
    await expect(section.getByText("加载失败")).toBeVisible();
    await expect(
        section.getByText("VoScript settings temporarily unavailable"),
    ).toBeVisible();
    await expect(sectionSaveButton(section)).toHaveCount(0);
    const retryButton = section.getByRole("button", {
        name: /^(重试|Retry)$/,
    });
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();

    await retryButton.click();
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

test("VoScript settings saves runtime params without connection payload", async ({
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
    await chooseShadcnSelectOption(
        page,
        section.getByRole("combobox", { name: "降噪模型" }),
        "DeepFilterNet",
    );

    const saveResponse = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/settings/voscript") &&
            response.request().method() === "PUT" &&
            response.ok(),
    );
    await Promise.all([settingsSaveStarted, saveButton.click()]);
    await expect(settingsShell(page)).toHaveAttribute("aria-busy", "true");
    await expect(section).toHaveAttribute("aria-busy", "true");
    await expect(saveButton).toBeDisabled();
    await expect(saveButton).toHaveAttribute("aria-busy", "true");
    await expectSaveButtonState(saveButton, "saving");
    await expect(saveButton).toContainText("保存中");

    releaseSettingsSave();
    await saveResponse;
    await expect(section).toHaveAttribute("aria-busy", "false");
    await expectSaveButtonState(saveButton, "saved");
    await expect(saveButton).toContainText("已保存");
    await expect(section.locator("#voscript-base-url")).toHaveValue(
        "https://voscript-updated.e2e.example",
    );
    await expect(section.locator("#voscript-api-key")).toHaveValue(
        "typed-e2e-key",
    );
    expect(settingsSavePayload).toEqual({
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
    await expect(settingsShell(page)).toBeVisible();
    await expect(page).toHaveURL(/\/settings#voscript$/);
});

test("VoScript connection save ignores invalid runtime params", async ({
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
    const connectionSaveButton = sectionSaveButton(
        section,
        "voscript-connection",
    );
    const paramsSaveButton = sectionSaveButton(section, "voscript-params");

    await section.locator("#voscript-base-url").fill(
        "https://voscript-connection-only.e2e.example",
    );
    await section.locator("#voscript-api-key").fill("connection-only-key");
    await section.locator("#voscript-no-repeat-ngram").fill("1");

    await connectionSaveButton.click();

    await expectSaveButtonState(connectionSaveButton, "saved");
    await expectSaveButtonState(paramsSaveButton, "idle");
    await expect(section.locator("#voscript-no-repeat-ngram")).toHaveValue("1");
    await expect(section.locator("#voscript-api-key")).toHaveValue("");
    expect(savePayload).toEqual({
        privateTranscriptionBaseUrl:
            "https://voscript-connection-only.e2e.example",
        privateTranscriptionApiKey: "connection-only-key",
    });
});

test("VoScript runtime params save does not submit pending API key", async ({
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
    const saveButton = sectionSaveButton(section, "voscript-params");

    await section.locator("#voscript-api-key").fill("pending-runtime-key");
    await section.locator("#voscript-min-speakers").fill("2");
    await section.locator("#voscript-max-speakers").fill("5");

    await saveButton.click();

    await expectSaveButtonState(saveButton, "saved");
    await expect(section.locator("#voscript-api-key")).toHaveValue(
        "pending-runtime-key",
    );
    expect(savePayload).toEqual({
        privateTranscriptionDenoiseModel: "none",
        privateTranscriptionMaxInflightJobs: 1,
        privateTranscriptionMaxSpeakers: 5,
        privateTranscriptionMinSpeakers: 2,
        privateTranscriptionNoRepeatNgramSize: 0,
        privateTranscriptionSnrThreshold: null,
    });
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
    const ngramInput = section.locator("#voscript-no-repeat-ngram");
    const ngramField = fieldFor(ngramInput);
    const paramsSave = sectionSavePanel(section, "voscript-params");
    const saveButton = sectionSaveButton(section, "voscript-params");

    await ngramInput.fill("1");

    await expect(ngramField).toHaveAttribute("data-invalid", "true");
    await expect(ngramInput).toHaveAttribute("aria-invalid", "true");
    await expect(
        ngramField.locator('[data-slot="field-error"]'),
    ).toHaveText("只支持 0 或 ≥ 3");

    await saveButton.click();

    await expect(ngramInput).toHaveValue("1");
    await expect(
        ngramField.locator('[data-slot="field-error"]'),
    ).toBeVisible();
    await expect(paramsSave.getByRole("alert")).toContainText(
        "只支持 0 或 ≥ 3",
    );
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
    const minSpeakerInput = section.locator("#voscript-min-speakers");
    const maxSpeakerInput = section.locator("#voscript-max-speakers");
    const minSpeakerField = fieldFor(minSpeakerInput);
    const maxSpeakerField = fieldFor(maxSpeakerInput);
    const paramsSave = sectionSavePanel(section, "voscript-params");
    const saveButton = sectionSaveButton(section, "voscript-params");

    await minSpeakerInput.fill("-1");
    await expect(minSpeakerField).toHaveAttribute("data-invalid", "true");
    await expect(minSpeakerInput).toHaveAttribute("aria-invalid", "true");
    await expect(
        minSpeakerField.locator('[data-slot="field-error"]'),
    ).toHaveText("不能为负数");

    await saveButton.click();

    await expect(minSpeakerInput).toHaveValue("-1");
    await expect(paramsSave.getByRole("alert")).toContainText("不能为负数");
    await expect.poll(() => settingsPutCount).toBe(0);

    await minSpeakerInput.fill("1");
    await maxSpeakerInput.fill("-2");
    await expect(maxSpeakerField).toHaveAttribute("data-invalid", "true");
    await expect(maxSpeakerInput).toHaveAttribute("aria-invalid", "true");
    await expect(
        maxSpeakerField.locator('[data-slot="field-error"]'),
    ).toHaveText("不能为负数");

    await saveButton.click();

    await expect(maxSpeakerInput).toHaveValue("-2");
    await expect(paramsSave.getByRole("alert")).toContainText("不能为负数");
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
    const minSpeakerInput = section.locator("#voscript-min-speakers");
    const maxSpeakerInput = section.locator("#voscript-max-speakers");
    const maxSpeakerField = fieldFor(maxSpeakerInput);
    const paramsSave = sectionSavePanel(section, "voscript-params");
    const saveButton = sectionSaveButton(section, "voscript-params");

    await minSpeakerInput.fill("5");
    await maxSpeakerInput.fill("3");

    await expect(maxSpeakerField).toHaveAttribute("data-invalid", "true");
    await expect(maxSpeakerInput).toHaveAttribute("aria-invalid", "true");
    await expect(
        maxSpeakerField.locator('[data-slot="field-error"]'),
    ).toHaveText("最多说话人数必须 ≥ 最少说话人数");

    await saveButton.click();

    await expect(minSpeakerInput).toHaveValue("5");
    await expect(maxSpeakerInput).toHaveValue("3");
    await expect(paramsSave.getByRole("alert")).toContainText(
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
    const testButton = testConnectionButton(section);
    const connectionSaveButton = sectionSaveButton(
        section,
        "voscript-connection",
    );
    const paramsSaveButton = sectionSaveButton(section, "voscript-params");
    const connectionSavePanel = sectionSavePanel(
        section,
        "voscript-connection",
    );
    const paramsSavePanel = sectionSavePanel(section, "voscript-params");

    await expect(
        section.getByRole("alert").filter({
            hasText: /^(VoScript 当前不可用|VoScript is unavailable)/,
        }),
    ).toHaveCount(0);
    await section.locator("#voscript-base-url").fill(
        "https://voscript-test.e2e.example",
    );
    await section.locator("#voscript-api-key").fill("typed-test-key");

    await testButton.click();
    await connectionTestStarted;
    await expect(settingsShell(page)).toHaveAttribute("aria-busy", "true");
    await expect(section).toHaveAttribute("aria-busy", "true");
    await expect(testButton).toHaveAccessibleName(
        /^(正在测试 VoScript 连接|Testing VoScript connection)$/,
    );
    await expect(testButton).toHaveAttribute("aria-busy", "true");
    await expect(testButton).toBeDisabled();
    await expectVoScriptControlsDisabled(section);
    await expect(connectionSavePanel.getByRole("alert")).toHaveCount(0);
    await expectSaveButtonState(connectionSaveButton, "idle");
    await expect(connectionSaveButton).toBeDisabled();
    await expect(paramsSavePanel.getByRole("alert")).toHaveCount(0);
    await expectSaveButtonState(paramsSaveButton, "idle");
    await expect(paramsSaveButton).toBeDisabled();

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
    await expect(section).toHaveAttribute("aria-busy", "false");
    await expect(testButton).toHaveAccessibleName(
        /^(VoScript 连接正常|VoScript connection ready)$/,
    );
    await expect(testButton).toContainText("连接正常");
    await expectSaveButtonState(connectionSaveButton, "idle");
    await expectSaveButtonState(paramsSaveButton, "idle");

    await section.locator("#voscript-base-url").fill(
        "https://voscript-failing.e2e.example",
    );
    await expect(testButton).toHaveAccessibleName(
        /^(测试 VoScript 连接|Test VoScript connection)$/,
    );
    await expect(testButton).toBeEnabled();
    await expect(testButton).toContainText("测试连接");
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
    await expect(testButton).toHaveAccessibleName(
        /^(测试 VoScript 连接|Test VoScript connection)$/,
    );
    await expect(
        section.getByRole("alert").filter({
            hasText: /^(VoScript 当前不可用|VoScript is unavailable)/,
        }),
    ).toBeVisible();
    await expect(
        section.getByText("VoScript upstream unreachable", { exact: true }),
    ).toBeVisible();
    await expectSaveButtonState(connectionSaveButton, "idle");
    await expectSaveButtonState(paramsSaveButton, "idle");
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
    await expectShadcnSelectTrigger(keyMode, {
        label: "密钥操作",
        text: "保留或替换",
    });
    await chooseShadcnSelectOption(page, keyMode, "清除已保存密钥");
    await expect(apiKeyInput).toBeDisabled();

    const saveButton = sectionSaveButton(section, "voscript-connection");
    await saveButton.click();
    await expectSaveButtonState(saveButton, "saved");
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
    const savePanel = sectionSavePanel(section, "voscript-connection");
    const saveButton = sectionSaveButton(section, "voscript-connection");
    const paramsSavePanel = sectionSavePanel(section, "voscript-params");
    const paramsSaveButton = sectionSaveButton(section, "voscript-params");
    const baseUrlInput = section.locator("#voscript-base-url");
    const unavailableBanner = section.locator(
        "#voscript-connection-status",
    );

    await baseUrlInput.fill("https://bad-voscript.e2e.example");
    await saveButton.click();
    await expect(savePanel.getByRole("alert")).toContainText(
        "E2E VoScript save rejected",
    );
    await expect(baseUrlInput).toHaveValue("https://bad-voscript.e2e.example");
    await expect(baseUrlInput).toBeEnabled();
    await expect(unavailableBanner).toBeVisible();
    await expect(paramsSavePanel.getByRole("alert")).toHaveCount(0);
    await expectSaveButtonState(paramsSaveButton, "idle");
    await expect(paramsSaveButton).toBeEnabled();
    expect(settingsSavePayloads).toHaveLength(1);

    await baseUrlInput.fill("https://voscript-recovered.e2e.example");
    await saveButton.click();
    await expectSaveButtonState(saveButton, "saved");
    await expect(baseUrlInput).toHaveValue(
        "https://voscript-recovered.e2e.example",
    );
    expect(settingsSavePayloads).toHaveLength(2);
    expect(settingsSavePayloads.at(-1)).toMatchObject({
        privateTranscriptionBaseUrl: "https://voscript-recovered.e2e.example",
    });
});

test("VoScript runtime params surfaces backend save errors and retries without connection payload", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    const settingsSavePayloads: Record<string, unknown>[] = [];
    let saveAttempts = 0;

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(voscriptSettings()),
            });
            return;
        }

        saveAttempts += 1;
        settingsSavePayloads.push(route.request().postDataJSON());
        if (saveAttempts === 1) {
            await route.fulfill({
                contentType: "application/json",
                status: 400,
                body: JSON.stringify({ error: "E2E VoScript params rejected" }),
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
    const connectionSavePanel = sectionSavePanel(
        section,
        "voscript-connection",
    );
    const connectionSaveButton = sectionSaveButton(
        section,
        "voscript-connection",
    );
    const paramsSavePanel = sectionSavePanel(section, "voscript-params");
    const paramsSaveButton = sectionSaveButton(section, "voscript-params");
    const denoiseCombobox = section.getByRole("combobox", {
        name: "降噪模型",
    });
    const minSpeakersInput = section.locator("#voscript-min-speakers");
    const maxSpeakersInput = section.locator("#voscript-max-speakers");
    const noRepeatInput = section.locator("#voscript-no-repeat-ngram");
    const snrInput = section.locator("#voscript-snr-threshold");
    const maxInflightInput = section.locator("#voscript-max-inflight-jobs");

    await minSpeakersInput.fill("2");
    await maxSpeakersInput.fill("4");
    await noRepeatInput.fill("4");
    await snrInput.fill("10.5");
    await maxInflightInput.fill("3");
    await chooseShadcnSelectOption(page, denoiseCombobox, "noisereduce");

    await paramsSaveButton.click();

    await expect(paramsSavePanel.getByRole("alert")).toContainText(
        "E2E VoScript params rejected",
    );
    await expect(minSpeakersInput).toHaveValue("2");
    await expect(maxSpeakersInput).toHaveValue("4");
    await expect(noRepeatInput).toHaveValue("4");
    await expect(snrInput).toHaveValue("10.5");
    await expect(maxInflightInput).toHaveValue("3");
    await expect(denoiseCombobox).toContainText("noisereduce");
    await expect(paramsSaveButton).toBeEnabled();
    await expect(connectionSavePanel.getByRole("alert")).toHaveCount(0);
    await expectSaveButtonState(connectionSaveButton, "idle");
    await expect(connectionSaveButton).toBeEnabled();
    expect(settingsSavePayloads).toHaveLength(1);
    expect(settingsSavePayloads[0]).toEqual({
        privateTranscriptionDenoiseModel: "noisereduce",
        privateTranscriptionMaxInflightJobs: 3,
        privateTranscriptionMaxSpeakers: 4,
        privateTranscriptionMinSpeakers: 2,
        privateTranscriptionNoRepeatNgramSize: 4,
        privateTranscriptionSnrThreshold: 10.5,
    });

    await paramsSaveButton.click();

    await expectSaveButtonState(paramsSaveButton, "saved");
    expect(settingsSavePayloads).toHaveLength(2);
    expect(settingsSavePayloads.at(-1)).toEqual({
        privateTranscriptionDenoiseModel: "noisereduce",
        privateTranscriptionMaxInflightJobs: 3,
        privateTranscriptionMaxSpeakers: 4,
        privateTranscriptionMinSpeakers: 2,
        privateTranscriptionNoRepeatNgramSize: 4,
        privateTranscriptionSnrThreshold: 10.5,
    });
    for (const payload of settingsSavePayloads) {
        expect(payload).not.toHaveProperty("privateTranscriptionBaseUrl");
        expect(payload).not.toHaveProperty("privateTranscriptionApiKey");
    }
});

test("VoScript settings saves connection lane without runtime params payload", async ({
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
    await section.locator("#voscript-min-speakers").fill("3");
    await section.locator("#voscript-max-speakers").fill("4");
    await section.locator("#voscript-no-repeat-ngram").fill("4");
    await section.locator("#voscript-max-inflight-jobs").fill("2");

    const saveButton = sectionSaveButton(section, "voscript-connection");
    await saveButton.click();
    await expectSaveButtonState(saveButton, "saved");
    expect(savePayload).toEqual({
        privateTranscriptionBaseUrl: null,
    });
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
    await expectSaveButtonState(saveButton, "saved");
    expect(speakerPayloads).toEqual([
        {
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
    await expect(section).toHaveAttribute("aria-busy", "false");
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
        section.getByRole("textbox", {
            name: /^(声纹名称：|Voiceprint name: )/,
        }),
    ).toHaveValue("Remote Voiceprint Should Stay Remote");
    await expect(
        page.getByRole("dialog", { name: "确认操作", exact: true }),
    ).toHaveCount(0);

    await section.locator("#voscript-base-url").fill(
        "https://voscript-without-voiceprints.e2e.example",
    );
    const saveButton = sectionSaveButton(section, "voscript-connection");
    await saveButton.click();
    await expectSaveButtonState(saveButton, "saved");
    expect(voscriptSavePayload).toMatchObject({
        privateTranscriptionBaseUrl:
            "https://voscript-without-voiceprints.e2e.example",
    });
    expect(voiceprintCalls).toBeGreaterThan(0);
});
