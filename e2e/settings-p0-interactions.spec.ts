import { expect, type Locator, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const SETTINGS_SECTIONS = {
    "title-generation": {
        heading: "AI 重命名服务",
        navigation: "AI 重命名服务",
    },
    transcription: {
        heading: "转录设置",
        navigation: "转录设置",
    },
    misc: {
        heading: "杂项",
        navigation: "杂项",
    },
    voscript: {
        heading: "VoScript 服务",
        navigation: "VoScript 服务",
    },
} as const;

type SettingsSection = keyof typeof SETTINGS_SECTIONS;

const SAVE_BUTTON_NAME = /^(保存|保存中|已保存)$/;

async function putSettingsWithRetry(
    page: Page,
    path: string,
    data: Record<string, unknown>,
) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const response = await page.request.put(path, { data });
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

async function resetDisplayToChinese(page: Page) {
    await putSettingsWithRetry(page, "/api/settings/display", {
        dateTimeFormat: "relative",
        displayDensity: "comfy",
        itemsPerPage: 50,
        recordingListSortOrder: "newest",
        theme: "dark",
        uiLanguage: "zh-CN",
    });
}

async function resetTitleGeneration(page: Page) {
    await putSettingsWithRetry(page, "/api/settings/title-generation", {
        autoGenerateTitle: true,
        titleGenerationApiKey: null,
        titleGenerationBaseUrl: null,
        titleGenerationModel: null,
        titleGenerationPrompt: null,
    });
}

async function resetTranscription(page: Page) {
    await putSettingsWithRetry(page, "/api/settings/transcription", {
        autoTranscribe: true,
        defaultTranscriptionLanguage: null,
    });
}

async function resetSync(page: Page) {
    await putSettingsWithRetry(page, "/api/settings/sync", {
        autoSyncEnabled: true,
        syncIntervalSeconds: 300,
    });
}

async function resetPlayback(page: Page) {
    await putSettingsWithRetry(page, "/api/settings/playback", {
        autoPlayNext: true,
        defaultPlaybackSpeed: 1,
        defaultVolume: 75,
    });
}

async function resetVoScript(page: Page) {
    await putSettingsWithRetry(page, "/api/settings/voscript", {
        privateTranscriptionApiKey: null,
        privateTranscriptionBaseUrl: null,
        privateTranscriptionDenoiseModel: "none",
        privateTranscriptionMaxInflightJobs: 1,
        privateTranscriptionMaxSpeakers: 0,
        privateTranscriptionMinSpeakers: 0,
        privateTranscriptionNoRepeatNgramSize: 0,
        privateTranscriptionSnrThreshold: null,
    });
}

async function resetCoreSettings(page: Page) {
    await resetDisplayToChinese(page);
    await resetTitleGeneration(page);
    await resetTranscription(page);
    await resetSync(page);
    await resetVoScript(page);
}

function settingsDialog(page: Page) {
    return page.getByRole("dialog", { name: "设置", exact: true });
}

function settingsHeading(page: Page, section: SettingsSection) {
    return settingsDialog(page).getByRole("heading", {
        name: SETTINGS_SECTIONS[section].heading,
        exact: true,
        level: 3,
    });
}

function settingsPanel(page: Page, section: SettingsSection) {
    return settingsHeading(page, section).locator("..");
}

function settingsGroup(panel: Locator, title: string) {
    return panel
        .getByRole("heading", { name: title, exact: true, level: 4 })
        .locator("xpath=ancestor::section[1]");
}

function saveButton(scope: Locator) {
    return scope.getByRole("button", { name: SAVE_BUTTON_NAME });
}

function control(scope: Locator, id: string) {
    return scope.locator("#" + id);
}

function actionRow(input: Locator) {
    return input.locator(
        'xpath=ancestor::div[.//button[@type="button"]][1]',
    );
}

async function expectSwitchState(locator: Locator, checked: boolean) {
    await expect(locator).toBeVisible();
    await expect(locator).toHaveAttribute("role", "switch");
    await expect(locator).toHaveAttribute("aria-checked", String(checked));
}

async function chooseSelectOption(
    page: Page,
    trigger: Locator,
    optionName: string,
) {
    await expect(trigger).toHaveAttribute("role", "combobox");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    const option = listbox.getByRole("option", {
        name: optionName,
        exact: true,
    });
    await expect(option).toBeVisible();
    await option.click();
}

async function expectSelectTrigger(
    trigger: Locator,
    {
        label,
        text,
    }: {
        label: string;
        text?: string;
    },
) {
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("role", "combobox");
    await expect(trigger).toHaveAttribute("aria-label", label);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    if (text) {
        await expect(trigger).toContainText(text);
    }
}

async function expectSectionReady(page: Page, section: SettingsSection) {
    const dialog = settingsDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-busy", "false");
    await expect(
        dialog.getByRole("button", {
            name: SETTINGS_SECTIONS[section].navigation,
            exact: true,
        }),
    ).toHaveAttribute("aria-current", "page");
    await expect(settingsHeading(page, section)).toBeVisible();
}

async function expectSectionBusy(page: Page, section: SettingsSection) {
    const dialog = settingsDialog(page);
    await expect(dialog).toHaveAttribute("aria-busy", "true");
    await expect(
        dialog.getByRole("button", {
            name: SETTINGS_SECTIONS[section].navigation,
            exact: true,
        }),
    ).toBeDisabled();
}

async function expectVisibleSectionLoading(dialog: Locator) {
    const loadingSection = dialog.locator('[aria-busy="true"]');
    await expect(loadingSection).toHaveCount(1);
    await expect(loadingSection).toBeVisible();

    const loadingStatus = loadingSection.getByRole("status", {
        name: "正在加载设置",
        exact: true,
    });
    await expect(loadingStatus).toBeVisible();
    await expect(loadingStatus).toHaveAttribute("aria-live", "polite");
    await expect(loadingStatus.locator('[data-slot="spinner"]')).toBeVisible();
}

async function dismissByBackdrop(dialog: Locator) {
    const backdrop = dialog.locator("xpath=preceding-sibling::*[1]");
    await expect(backdrop).toBeVisible();
    await backdrop.click({ position: { x: 8, y: 8 } });
}

test("title generation settings save model provider fields", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetCoreSettings(page);

    const titleGenerationPuts: Record<string, unknown>[] = [];
    let releaseTitleGenerationSave: (() => void) | null = null;
    let markTitleGenerationSaveStarted: (() => void) | null = null;
    const titleGenerationSaveStarted = new Promise<void>((resolve) => {
        markTitleGenerationSaveStarted = resolve;
    });

    await page.route("**/api/settings/title-generation", async (route) => {
        if (route.request().method() === "PUT") {
            const payload = route.request().postDataJSON();
            titleGenerationPuts.push(payload);
            if (payload?.titleGenerationModel === "e2e-title-model") {
                markTitleGenerationSaveStarted?.();
                await new Promise<void>((release) => {
                    releaseTitleGenerationSave = release;
                });
            }
        }
        await route.continue();
    });

    await page.goto("/settings#title-generation", {
        waitUntil: "domcontentloaded",
    });
    await expectSectionReady(page, "title-generation");

    const section = settingsPanel(page, "title-generation");
    const titleGenerationGroup = settingsGroup(section, "标题生成服务");
    const save = saveButton(titleGenerationGroup);
    const enabledSwitch = control(section, "title-generation-enabled");
    const baseUrlInput = control(section, "title-generation-base-url");
    const modelInput = control(section, "title-generation-model");
    const apiKeyInput = control(section, "title-generation-api-key");

    await expect(
        section.getByText("基于逐字稿自动重命名", { exact: true }),
    ).toBeVisible();
    await expect(
        section.getByText("重命名服务地址", { exact: true }),
    ).toBeVisible();
    await expectSwitchState(enabledSwitch, true);
    await expect(baseUrlInput).toBeEnabled();
    await expect(baseUrlInput).toHaveAttribute(
        "placeholder",
        "https://api.openai.com/v1",
    );
    await expect(modelInput).toBeEnabled();
    await expect(modelInput).toHaveAttribute("placeholder", "gpt-4.1-mini");
    await expect(apiKeyInput).toBeEnabled();
    await expect(save).toBeEnabled();
    await expect(save).toHaveAttribute("aria-busy", "false");
    await expect(save).toHaveAccessibleName("保存");

    await enabledSwitch.click();
    await expectSwitchState(enabledSwitch, false);
    await baseUrlInput.fill("https://example.com/v1");
    await modelInput.fill("e2e-title-model");
    await apiKeyInput.fill("e2e-title-value");

    const saveResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/title-generation") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.titleGenerationModel ===
                "e2e-title-model",
    );
    await Promise.all([titleGenerationSaveStarted, save.click()]);
    await expectSectionBusy(page, "title-generation");
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute("aria-busy", "true");
    await expect(save).toHaveAccessibleName("保存中");

    releaseTitleGenerationSave?.();
    await saveResponse;
    expect(titleGenerationPuts.at(-1)).toMatchObject({
        autoGenerateTitle: false,
        titleGenerationApiKey: "e2e-title-value",
        titleGenerationBaseUrl: "https://example.com/v1",
        titleGenerationModel: "e2e-title-model",
    });
    await expectSectionReady(page, "title-generation");
    await expect(save).toBeEnabled();
    await expect(save).toHaveAccessibleName("已保存");
    await expect(apiKeyInput).toHaveValue("");
    await expect(
        titleGenerationGroup.getByText("已存储", { exact: true }),
    ).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectSectionReady(page, "title-generation");
    const reloadedSection = settingsPanel(page, "title-generation");
    await expect(
        control(reloadedSection, "title-generation-model"),
    ).toHaveValue("e2e-title-model");
    await expect(
        settingsGroup(reloadedSection, "标题生成服务").getByText("已存储", {
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        control(reloadedSection, "title-generation-api-key"),
    ).toHaveAttribute("placeholder", /输入新 key 可替换/);
});

test("title generation settings show real backend save error", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetCoreSettings(page);

    const invalidBaseUrl = "https://example.com/v1?bad=1";
    const restoredBaseUrl = "https://example.com/v1";

    try {
        await page.goto("/settings#title-generation", {
            waitUntil: "domcontentloaded",
        });
        await expectSectionReady(page, "title-generation");

        const section = settingsPanel(page, "title-generation");
        const save = saveButton(settingsGroup(section, "标题生成服务"));
        const baseUrlInput = control(section, "title-generation-base-url");

        await expect(save).toBeEnabled();
        await expect(save).toHaveAttribute("aria-busy", "false");
        await baseUrlInput.fill(invalidBaseUrl);

        const rejectedSaveResponsePromise = page.waitForResponse((response) => {
            if (
                !response.url().includes("/api/settings/title-generation") ||
                response.request().method() !== "PUT"
            ) {
                return false;
            }

            const payload = response.request().postDataJSON();
            return payload?.titleGenerationBaseUrl === invalidBaseUrl;
        });

        await save.click();

        const rejectedSaveResponse = await rejectedSaveResponsePromise;
        expect(rejectedSaveResponse.status()).toBe(400);
        const rejectedSaveBody = (await rejectedSaveResponse.json()) as {
            error?: unknown;
        };
        expect(rejectedSaveBody).toEqual({
            error: "titleGenerationBaseUrl must not include query parameters or fragments",
        });
        if (typeof rejectedSaveBody.error !== "string") {
            throw new Error("Expected title generation save error response");
        }

        const saveError = rejectedSaveBody.error;
        await expect(settingsDialog(page)).toHaveAttribute("aria-busy", "false");
        await expect(save).toBeEnabled();
        await expect(save).toHaveAttribute("aria-busy", "false");
        await expect(section.getByText(saveError, { exact: true })).toBeVisible();

        await baseUrlInput.fill(restoredBaseUrl);

        const restoredSaveResponsePromise = page.waitForResponse((response) => {
            if (
                !response.url().includes("/api/settings/title-generation") ||
                response.request().method() !== "PUT"
            ) {
                return false;
            }

            const payload = response.request().postDataJSON();
            return payload?.titleGenerationBaseUrl === restoredBaseUrl;
        });

        await save.click();

        const restoredSaveResponse = await restoredSaveResponsePromise;
        expect(restoredSaveResponse.status()).toBe(200);
        await expect(save).toHaveAccessibleName("已保存");
    } finally {
        await resetTitleGeneration(page);
    }
});

test("title generation settings load failure exposes retry-only state", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetCoreSettings(page);

    let releaseInitialLoad: (() => void) | null = null;
    const initialLoadBlocked = new Promise<void>((resolve) => {
        releaseInitialLoad = resolve;
    });
    let failedInitialLoad = false;
    await page.route("**/*", async (route) => {
        const requestUrl = new URL(route.request().url());
        if (
            requestUrl.pathname !== "/api/settings/title-generation" ||
            route.request().method() !== "GET" ||
            failedInitialLoad
        ) {
            await route.continue();
            return;
        }

        failedInitialLoad = true;
        await initialLoadBlocked;
        await route.fulfill({
            contentType: "application/json",
            status: 503,
            body: JSON.stringify({ error: "Title generation unavailable" }),
        });
    });

    await page.goto("/settings#title-generation", {
        waitUntil: "domcontentloaded",
    });

    const dialog = settingsDialog(page);
    await expectSectionBusy(page, "title-generation");
    await expectVisibleSectionLoading(dialog);
    await expect(settingsHeading(page, "title-generation")).toHaveCount(0);
    await expect(control(dialog, "title-generation-enabled")).toHaveCount(0);
    await expect(control(dialog, "title-generation-model")).toHaveCount(0);
    await expect(
        dialog.getByRole("button", { name: SAVE_BUTTON_NAME }),
    ).toHaveCount(0);

    releaseInitialLoad?.();
    const loadError = dialog
        .getByRole("alert")
        .filter({ hasText: "Title generation unavailable" });
    await expect(loadError).toBeVisible();
    await expect(loadError).toContainText("加载失败");
    await expect(loadError).toContainText("Title generation unavailable");
    await expect(control(dialog, "title-generation-enabled")).toHaveCount(0);
    await expect(control(dialog, "title-generation-model")).toHaveCount(0);
    const retry = loadError.getByRole("button", {
        name: "重试",
        exact: true,
    });
    await expect(retry).toBeEnabled();

    const retryResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/title-generation") &&
            response.request().method() === "GET" &&
            response.ok(),
    );
    await retry.click();
    await retryResponse;

    await expectSectionReady(page, "title-generation");
    const section = settingsPanel(page, "title-generation");
    await expectSwitchState(control(section, "title-generation-enabled"), true);
    await expect(control(section, "title-generation-model")).toBeVisible();
});

test("transcription settings load failure exposes retry-only state", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetCoreSettings(page);

    let releaseInitialLoad: (() => void) | null = null;
    const initialLoadBlocked = new Promise<void>((resolve) => {
        releaseInitialLoad = resolve;
    });
    let failedInitialLoad = false;
    await page.route("**/*", async (route) => {
        const requestUrl = new URL(route.request().url());
        if (
            requestUrl.pathname !== "/api/settings/transcription" ||
            route.request().method() !== "GET" ||
            failedInitialLoad
        ) {
            await route.continue();
            return;
        }

        failedInitialLoad = true;
        await initialLoadBlocked;
        await route.fulfill({
            contentType: "application/json",
            status: 503,
            body: JSON.stringify({
                error: "Transcription settings unavailable",
            }),
        });
    });

    await page.goto("/settings#transcription", {
        waitUntil: "domcontentloaded",
    });

    const dialog = settingsDialog(page);
    await expectSectionBusy(page, "transcription");
    await expectVisibleSectionLoading(dialog);
    await expect(settingsHeading(page, "transcription")).toHaveCount(0);
    await expect(
        control(dialog, "transcription-auto-transcribe"),
    ).toHaveCount(0);
    await expect(control(dialog, "transcription-language")).toHaveCount(0);
    await expect(
        dialog.getByRole("button", { name: SAVE_BUTTON_NAME }),
    ).toHaveCount(0);

    releaseInitialLoad?.();
    const loadError = dialog
        .getByRole("alert")
        .filter({ hasText: "Transcription settings unavailable" });
    await expect(loadError).toBeVisible();
    await expect(loadError).toContainText("加载失败");
    await expect(loadError).toContainText("Transcription settings unavailable");
    await expect(
        control(dialog, "transcription-auto-transcribe"),
    ).toHaveCount(0);
    await expect(control(dialog, "transcription-language")).toHaveCount(0);
    const retry = loadError.getByRole("button", {
        name: "重试",
        exact: true,
    });
    await expect(retry).toBeEnabled();

    const retryResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/transcription") &&
            response.request().method() === "GET" &&
            response.ok(),
    );
    await retry.click();
    await retryResponse;

    await expectSectionReady(page, "transcription");
    const section = settingsPanel(page, "transcription");
    await expectSwitchState(
        control(section, "transcription-auto-transcribe"),
        true,
    );
    await expectSelectTrigger(control(section, "transcription-language"), {
        label: "默认转录语言",
        text: "自动检测",
    });
});

test("transcription settings save auto-transcribe and language changes", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetCoreSettings(page);

    const transcriptionPayloads: Record<string, unknown>[] = [];
    let releaseTranscriptionSave: (() => void) | null = null;
    let markTranscriptionSaveStarted: (() => void) | null = null;
    const transcriptionSaveStarted = new Promise<void>((resolve) => {
        markTranscriptionSaveStarted = resolve;
    });
    await page.route("**/api/settings/transcription", async (route) => {
        if (route.request().method() === "PUT") {
            const payload = route.request().postDataJSON();
            transcriptionPayloads.push(payload);
            if (payload?.autoTranscribe === false) {
                markTranscriptionSaveStarted?.();
                await new Promise<void>((release) => {
                    releaseTranscriptionSave = release;
                });
            }
        }
        await route.continue();
    });

    await page.goto("/settings#transcription", {
        waitUntil: "domcontentloaded",
    });
    await expectSectionReady(page, "transcription");

    const section = settingsPanel(page, "transcription");
    await expect(
        section.getByRole("button", { name: SAVE_BUTTON_NAME }),
    ).toHaveCount(0);
    const autoTranscribeSwitch = control(
        section,
        "transcription-auto-transcribe",
    );
    await expect(
        section.getByText("自动转录新录音", { exact: true }),
    ).toBeVisible();
    await expectSwitchState(autoTranscribeSwitch, true);

    const autoTranscribeOffResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/transcription") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.autoTranscribe === false,
    );
    await autoTranscribeSwitch.click();
    await transcriptionSaveStarted;
    await expectSectionBusy(page, "transcription");
    await expect(autoTranscribeSwitch).toBeDisabled();
    releaseTranscriptionSave?.();
    await autoTranscribeOffResponse;

    expect(transcriptionPayloads.at(-1)).toEqual({
        autoTranscribe: false,
    });
    await expectSectionReady(page, "transcription");
    await expect(autoTranscribeSwitch).toBeEnabled();
    await expectSwitchState(autoTranscribeSwitch, false);

    const languageSelect = page.getByRole("combobox", {
        name: "默认转录语言",
        exact: true,
    });
    await expectSelectTrigger(languageSelect, {
        label: "默认转录语言",
        text: "自动检测",
    });
    const languageResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/transcription") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.defaultTranscriptionLanguage ===
                "zh",
    );
    await Promise.all([
        languageResponse,
        chooseSelectOption(page, languageSelect, "中文"),
    ]);

    expect(transcriptionPayloads.at(-1)).toEqual({
        defaultTranscriptionLanguage: "zh",
    });
    await expectSectionReady(page, "transcription");
    await expect(
        section.getByRole("button", { name: SAVE_BUTTON_NAME }),
    ).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectSectionReady(page, "transcription");
    const reloadedSection = settingsPanel(page, "transcription");
    await expectSwitchState(
        control(reloadedSection, "transcription-auto-transcribe"),
        false,
    );
    await expectSelectTrigger(
        page.getByRole("combobox", {
            name: "默认转录语言",
            exact: true,
        }),
        {
            label: "默认转录语言",
            text: "中文",
        },
    );
});

test("misc settings load failure exposes retry-only state", async ({ page }) => {
    await ensureSignedIn(page);

    let releaseInitialSyncLoad: (() => void) | null = null;
    const initialSyncLoadBlocked = new Promise<void>((resolve) => {
        releaseInitialSyncLoad = resolve;
    });
    let failedInitialSyncLoad = false;
    await page.route("**/*", async (route) => {
        const requestUrl = new URL(route.request().url());
        if (
            requestUrl.pathname !== "/api/settings/sync" ||
            route.request().method() !== "GET" ||
            failedInitialSyncLoad
        ) {
            await route.continue();
            return;
        }

        failedInitialSyncLoad = true;
        await initialSyncLoadBlocked;
        await route.fulfill({
            contentType: "application/json",
            status: 503,
            body: JSON.stringify({ error: "Sync settings unavailable" }),
        });
    });

    await resetCoreSettings(page);
    await resetPlayback(page);
    await page.goto("/settings#misc", { waitUntil: "domcontentloaded" });

    const dialog = settingsDialog(page);
    await expectSectionBusy(page, "misc");
    await expectVisibleSectionLoading(dialog);
    await expect(settingsHeading(page, "misc")).toHaveCount(0);
    await expect(control(dialog, "sync-auto-enabled")).toHaveCount(0);
    await expect(control(dialog, "sync-interval-seconds")).toHaveCount(0);
    await expect(control(dialog, "playback-speed")).toHaveCount(0);
    await expect(control(dialog, "playback-volume")).toHaveCount(0);
    await expect(control(dialog, "playback-auto-next")).toHaveCount(0);

    releaseInitialSyncLoad?.();
    const loadError = dialog
        .getByRole("alert")
        .filter({ hasText: "Sync settings unavailable" });
    await expect(loadError).toBeVisible();
    await expect(loadError).toContainText("加载失败");
    await expect(loadError).toContainText("Sync settings unavailable");
    await expect(control(dialog, "sync-auto-enabled")).toHaveCount(0);
    await expect(control(dialog, "sync-interval-seconds")).toHaveCount(0);
    await expect(control(dialog, "playback-speed")).toHaveCount(0);
    await expect(control(dialog, "playback-volume")).toHaveCount(0);
    await expect(control(dialog, "playback-auto-next")).toHaveCount(0);
    const retry = loadError.getByRole("button", {
        name: "重试",
        exact: true,
    });
    await expect(retry).toBeEnabled();

    const retryResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/sync") &&
            response.request().method() === "GET" &&
            response.ok(),
    );
    await retry.click();
    await retryResponse;

    await expectSectionReady(page, "misc");
    const section = settingsPanel(page, "misc");
    const autoSyncSwitch = control(section, "sync-auto-enabled");
    const syncIntervalInput = control(section, "sync-interval-seconds");
    const playbackSpeed = page.getByRole("combobox", {
        name: "默认速度",
        exact: true,
    });
    const playbackVolume = control(section, "playback-volume").getByRole(
        "slider",
    );
    const playbackAutoNext = control(section, "playback-auto-next");

    await expectSwitchState(autoSyncSwitch, true);
    await expect(syncIntervalInput).toBeEnabled();
    await expect(syncIntervalInput).toHaveValue("300");
    await expectSelectTrigger(playbackSpeed, {
        label: "默认速度",
    });
    await expect(playbackVolume).toBeVisible();
    await expect(playbackVolume).toHaveAttribute("aria-valuemin", "0");
    await expect(playbackVolume).toHaveAttribute("aria-valuemax", "100");
    await expectSwitchState(playbackAutoNext, true);
    await expect(
        section.getByRole("button", { name: SAVE_BUTTON_NAME }),
    ).toHaveCount(0);
});

test("VoScript speaker profiles restore backend actions and accessible states", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetCoreSettings(page);

    type SpeakerProfileFixture = {
        assignmentCount: number;
        createdAt: string;
        displayName: string;
        id: string;
        updatedAt: string;
        voiceprintRef: string | null;
    };
    type VoiceprintFixture = {
        createdAt: string | null;
        displayName: string;
        id: string;
        updatedAt: string | null;
    };

    const now = "2026-06-01T00:00:00.000Z";
    let profiles: SpeakerProfileFixture[] = [];
    let voiceprints: VoiceprintFixture[] = [
        {
            createdAt: now,
            displayName: "Remote Voiceprint Alpha",
            id: "vp-alpha",
            updatedAt: now,
        },
    ];
    let voiceprintMode: "disabled" | "empty" | "ready" = "disabled";
    let failVoiceprintLoads = false;
    let failProfileLoads = true;
    let initialProfileLoadRelease: (() => void) | null = null;
    let profilePatchRelease: (() => void) | null = null;
    let voiceprintPatchRelease: (() => void) | null = null;
    let profileDeleteAttempts = 0;
    let voiceprintDeleteAttempts = 0;
    const initialProfileLoadBlocked = new Promise<void>((resolve) => {
        initialProfileLoadRelease = resolve;
    });
    const profilePatchBlocked = new Promise<void>((resolve) => {
        profilePatchRelease = resolve;
    });
    const voiceprintPatchBlocked = new Promise<void>((resolve) => {
        voiceprintPatchRelease = resolve;
    });

    await page.route("**/api/speakers/profiles**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();

        if (url.pathname === "/api/speakers/profiles" && method === "GET") {
            if (failProfileLoads) {
                await initialProfileLoadBlocked;
                await route.fulfill({
                    contentType: "application/json",
                    status: 503,
                    body: JSON.stringify({
                        error: "说话人档案服务暂不可用",
                    }),
                });
                return;
            }

            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ profiles }),
            });
            return;
        }

        if (url.pathname === "/api/speakers/profiles" && method === "POST") {
            const payload = request.postDataJSON();
            profiles = [
                {
                    assignmentCount: 0,
                    createdAt: now,
                    displayName: String(payload.displayName),
                    id: "speaker-alpha",
                    updatedAt: now,
                    voiceprintRef: null,
                },
            ];
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ profile: profiles[0] }),
            });
            return;
        }

        const profileId = url.pathname.split("/").pop();
        if (profileId && method === "PATCH") {
            const payload = request.postDataJSON();
            if (payload.displayName === "E2E Speaker Renamed") {
                await profilePatchBlocked;
            }
            profiles = profiles.map((profile) =>
                profile.id === profileId
                    ? {
                          ...profile,
                          displayName: String(payload.displayName),
                          updatedAt: "2026-06-01T00:01:00.000Z",
                      }
                    : profile,
            );
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    profile: profiles.find((profile) => profile.id === profileId),
                }),
            });
            return;
        }

        if (profileId && method === "DELETE") {
            profileDeleteAttempts += 1;
            profiles = profiles.filter((profile) => profile.id !== profileId);
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ success: true }),
            });
            return;
        }

        await route.continue();
    });

    await page.route("**/api/voiceprints**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();

        if (url.pathname === "/api/voiceprints" && method === "GET") {
            if (failVoiceprintLoads) {
                await route.fulfill({
                    contentType: "application/json",
                    status: 503,
                    body: JSON.stringify({
                        error: "声纹服务暂不可用",
                    }),
                });
                return;
            }

            const body =
                voiceprintMode === "disabled"
                    ? {
                          available: false,
                          reason: "请先在 VoScript 保存可用的服务连接。",
                          voiceprints: [],
                      }
                    : voiceprintMode === "empty"
                      ? { available: true, reason: null, voiceprints: [] }
                      : { available: true, reason: null, voiceprints };
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(body),
            });
            return;
        }

        const voiceprintId = url.pathname.split("/").pop();
        if (voiceprintId && method === "PATCH") {
            const payload = request.postDataJSON();
            if (payload.displayName === "Remote Voiceprint Renamed") {
                await voiceprintPatchBlocked;
            }
            voiceprints = voiceprints.map((voiceprint) =>
                voiceprint.id === voiceprintId
                    ? {
                          ...voiceprint,
                          displayName: String(payload.displayName),
                          updatedAt: "2026-06-01T00:02:00.000Z",
                      }
                    : voiceprint,
            );
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    voiceprint: voiceprints.find(
                        (voiceprint) => voiceprint.id === voiceprintId,
                    ),
                }),
            });
            return;
        }

        if (voiceprintId && method === "DELETE") {
            voiceprintDeleteAttempts += 1;
            voiceprints = voiceprints.filter(
                (voiceprint) => voiceprint.id !== voiceprintId,
            );
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ success: true }),
            });
            return;
        }

        await route.continue();
    });

    await page.goto("/settings#voscript", {
        waitUntil: "domcontentloaded",
    });
    await expectSectionReady(page, "voscript");

    const section = settingsPanel(page, "voscript");
    const refreshButtons = section.getByRole("button", {
        name: "刷新",
        exact: true,
    });
    await expect(refreshButtons).toHaveCount(2);
    const profilesRefresh = refreshButtons.first();
    const voiceprintsRefresh = refreshButtons.last();

    await expect(
        section.getByText("已保存的说话人", { exact: true }),
    ).toBeVisible();
    await expect(profilesRefresh).toBeDisabled();
    await expect(profilesRefresh).toHaveAttribute("aria-busy", "true");
    await expect(
        section
            .getByRole("alert")
            .filter({ hasText: "请先在 VoScript 保存可用的服务连接。" }),
    ).toBeVisible();

    initialProfileLoadRelease?.();
    const profileLoadError = section
        .getByRole("alert")
        .filter({ hasText: "说话人档案服务暂不可用" });
    await expect(profileLoadError).toBeVisible();
    await expect(profilesRefresh).toBeEnabled();
    await expect(profilesRefresh).toHaveAttribute("aria-busy", "false");

    failProfileLoads = false;
    const profilesRetry = profileLoadError.getByRole("button", {
        name: "重试",
        exact: true,
    });
    await profilesRetry.click();
    await expect(
        section.getByText("还没有已保存的说话人", { exact: true }),
    ).toBeVisible();

    const createName = section.getByLabel("说话人名称", { exact: true });
    const createButton = section.getByRole("button", {
        name: "添加说话人",
        exact: true,
    });
    await createName.fill("E2E Speaker Alpha");
    await expect(createButton).toBeEnabled();
    await expect(createButton).toHaveAttribute("aria-busy", "false");
    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().endsWith("/api/speakers/profiles") &&
                response.request().method() === "POST" &&
                response.ok(),
        ),
        createButton.click(),
    ]);

    let speakerNameInput = section.getByLabel(
        "说话人名称：E2E Speaker Alpha",
        { exact: true },
    );
    await expect(speakerNameInput).toBeEnabled();
    await speakerNameInput.fill("E2E Speaker Renamed");
    speakerNameInput = section.getByLabel("说话人名称：E2E Speaker Renamed", {
        exact: true,
    });
    const speakerRow = actionRow(speakerNameInput);
    const speakerSaveButton = speakerRow.getByRole("button", {
        name: "保存",
        exact: true,
    });
    const speakerDeleteButton = speakerRow.getByRole("button", {
        name: "删除",
        exact: true,
    });
    await expect(speakerSaveButton).toBeEnabled();
    await expect(speakerDeleteButton).toBeEnabled();
    await speakerSaveButton.click();
    await expect(speakerNameInput).toBeDisabled();
    await expect(speakerSaveButton).toBeDisabled();
    await expect(speakerSaveButton).toHaveAttribute("aria-busy", "true");
    profilePatchRelease?.();
    await expect(speakerNameInput).toHaveValue("E2E Speaker Renamed");
    await expect(speakerNameInput).toBeEnabled();
    await expect(speakerSaveButton).toBeEnabled();

    await speakerDeleteButton.click();
    const speakerCancelDialog = page.getByRole("dialog", {
        name: "确认操作",
        exact: true,
    });
    const speakerCancelButton = speakerCancelDialog.getByRole("button", {
        name: "取消",
        exact: true,
    });
    await expect(speakerCancelButton).toBeFocused();
    await speakerCancelButton.click();
    await expect(speakerCancelDialog).not.toBeVisible();
    await expect(speakerDeleteButton).toBeFocused();
    expect(profileDeleteAttempts).toBe(0);
    await expect(speakerNameInput).toHaveCount(1);

    await speakerDeleteButton.click();
    const speakerEscapeDialog = page.getByRole("dialog", {
        name: "确认操作",
        exact: true,
    });
    await expect(speakerEscapeDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(speakerEscapeDialog).not.toBeVisible();
    await expect(speakerDeleteButton).toBeFocused();
    expect(profileDeleteAttempts).toBe(0);
    await expect(speakerNameInput).toHaveCount(1);

    await speakerDeleteButton.click();
    const speakerBackdropDialog = page.getByRole("dialog", {
        name: "确认操作",
        exact: true,
    });
    await expect(speakerBackdropDialog).toBeVisible();
    await dismissByBackdrop(speakerBackdropDialog);
    await expect(speakerBackdropDialog).not.toBeVisible();
    await expect(speakerDeleteButton).toBeFocused();
    expect(profileDeleteAttempts).toBe(0);
    await expect(speakerNameInput).toHaveCount(1);

    await speakerDeleteButton.click();
    await page
        .getByRole("dialog", { name: "确认操作", exact: true })
        .getByRole("button", { name: "确认", exact: true })
        .click();
    expect(profileDeleteAttempts).toBe(1);
    await expect(speakerNameInput).toHaveCount(0);
    await expect(
        section.getByText("还没有已保存的说话人", { exact: true }),
    ).toBeVisible();

    voiceprintMode = "empty";
    await expect(voiceprintsRefresh).toBeEnabled();
    await expect(voiceprintsRefresh).toHaveAttribute("aria-busy", "false");
    await voiceprintsRefresh.click();
    await expect(
        section.getByText("没有找到远端声纹", { exact: true }),
    ).toBeVisible();

    failVoiceprintLoads = true;
    await voiceprintsRefresh.click();
    const voiceprintLoadError = section
        .getByRole("alert")
        .filter({ hasText: "声纹服务暂不可用" });
    await expect(voiceprintLoadError).toBeVisible();

    voiceprintMode = "ready";
    failVoiceprintLoads = false;
    await voiceprintLoadError
        .getByRole("button", { name: "重试", exact: true })
        .click();
    let voiceprintNameInput = section.getByLabel(
        "声纹名称：Remote Voiceprint Alpha",
        { exact: true },
    );
    await expect(voiceprintNameInput).toBeEnabled();
    await voiceprintNameInput.fill("Remote Voiceprint Renamed");
    voiceprintNameInput = section.getByLabel(
        "声纹名称：Remote Voiceprint Renamed",
        { exact: true },
    );
    const voiceprintRow = actionRow(voiceprintNameInput);
    const voiceprintRenameButton = voiceprintRow.getByRole("button", {
        name: "重命名声纹 Remote Voiceprint Renamed",
        exact: true,
    });
    await expect(voiceprintRenameButton).toBeEnabled();
    await voiceprintRenameButton.click();
    await expect(voiceprintNameInput).toBeDisabled();
    await expect(voiceprintRenameButton).toBeDisabled();
    await expect(voiceprintRenameButton).toHaveAttribute("aria-busy", "true");
    voiceprintPatchRelease?.();
    await expect(voiceprintNameInput).toHaveValue("Remote Voiceprint Renamed");
    await expect(voiceprintNameInput).toBeEnabled();
    await expect(voiceprintRenameButton).toBeEnabled();

    const voiceprintDeleteButton = voiceprintRow.getByRole("button", {
        name: "删除声纹 Remote Voiceprint Renamed",
        exact: true,
    });
    await voiceprintDeleteButton.click();
    const voiceprintEscapeDialog = page.getByRole("dialog", {
        name: "确认操作",
        exact: true,
    });
    await expect(voiceprintEscapeDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(voiceprintEscapeDialog).not.toBeVisible();
    await expect(voiceprintDeleteButton).toBeFocused();
    expect(voiceprintDeleteAttempts).toBe(0);
    await expect(voiceprintNameInput).toHaveCount(1);

    await voiceprintDeleteButton.click();
    const voiceprintBackdropDialog = page.getByRole("dialog", {
        name: "确认操作",
        exact: true,
    });
    await expect(voiceprintBackdropDialog).toBeVisible();
    await dismissByBackdrop(voiceprintBackdropDialog);
    await expect(voiceprintBackdropDialog).not.toBeVisible();
    await expect(voiceprintDeleteButton).toBeFocused();
    expect(voiceprintDeleteAttempts).toBe(0);
    await expect(voiceprintNameInput).toHaveCount(1);

    await voiceprintDeleteButton.click();
    await page
        .getByRole("dialog", { name: "确认操作", exact: true })
        .getByRole("button", { name: "确认", exact: true })
        .click();
    expect(voiceprintDeleteAttempts).toBe(1);
    await expect(voiceprintNameInput).toHaveCount(0);
    await expect(
        section.getByText("没有找到远端声纹", { exact: true }),
    ).toBeVisible();
});

test("sync settings save toggles and normalize short intervals", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetCoreSettings(page);

    const syncPayloads: Record<string, unknown>[] = [];
    let releaseFirstSyncSave: (() => void) | null = null;
    let markFirstSyncSaveStarted: (() => void) | null = null;
    const firstSyncSaveStarted = new Promise<void>((resolve) => {
        markFirstSyncSaveStarted = resolve;
    });
    await page.route("**/api/settings/sync", async (route) => {
        if (route.request().method() === "PUT") {
            const payload = route.request().postDataJSON();
            syncPayloads.push(payload);
            if (payload?.autoSyncEnabled === false) {
                markFirstSyncSaveStarted?.();
                await new Promise<void>((release) => {
                    releaseFirstSyncSave = release;
                });
            }
        }
        await route.continue();
    });

    await page.goto("/settings#misc", { waitUntil: "domcontentloaded" });
    await expectSectionReady(page, "misc");

    const section = settingsPanel(page, "misc");
    await expect(
        section.getByRole("heading", { name: "同步设置", exact: true }),
    ).toBeVisible();
    await expect(
        section.getByRole("button", { name: SAVE_BUTTON_NAME }),
    ).toHaveCount(0);
    const autoSyncSwitch = control(section, "sync-auto-enabled");
    const syncIntervalInput = control(section, "sync-interval-seconds");
    await expectSwitchState(autoSyncSwitch, true);
    await expect(syncIntervalInput).toBeEnabled();
    await expect(syncIntervalInput).toHaveValue("300");

    const autoSyncOffResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/sync") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.autoSyncEnabled === false,
    );
    await autoSyncSwitch.click();
    await firstSyncSaveStarted;
    await expectSectionBusy(page, "misc");
    await expect(autoSyncSwitch).toBeDisabled();
    await expect(syncIntervalInput).toBeDisabled();
    releaseFirstSyncSave?.();
    await autoSyncOffResponse;
    expect(syncPayloads.at(-1)).toEqual({
        autoSyncEnabled: false,
    });
    await expectSectionReady(page, "misc");
    await expectSwitchState(autoSyncSwitch, false);
    await expect(syncIntervalInput).toHaveValue("300");

    const autoSyncOnResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/sync") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.autoSyncEnabled === true,
    );
    await autoSyncSwitch.click();
    await autoSyncOnResponse;
    expect(syncPayloads.at(-1)).toEqual({
        autoSyncEnabled: true,
    });
    await expectSwitchState(autoSyncSwitch, true);

    const normalizedIntervalResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/sync") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.syncIntervalSeconds === 60,
    );
    await syncIntervalInput.fill("12");
    await syncIntervalInput.blur();
    await normalizedIntervalResponse;
    expect(syncPayloads.at(-1)).toEqual({
        syncIntervalSeconds: 60,
    });
    await expectSectionReady(page, "misc");
    await expect(syncIntervalInput).toHaveValue("60");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectSectionReady(page, "misc");
    const reloadedSection = settingsPanel(page, "misc");
    await expectSwitchState(control(reloadedSection, "sync-auto-enabled"), true);
    await expect(
        control(reloadedSection, "sync-interval-seconds"),
    ).toHaveValue("60");
});

test("VoScript settings save current controls without testing connection", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetCoreSettings(page);

    await page.route("**/api/speakers/profiles", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ profiles: [] }),
        });
    });
    await page.route("**/api/voiceprints", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                available: true,
                reason: null,
                voiceprints: [],
            }),
        });
    });

    const voscriptPuts: Record<string, unknown>[] = [];
    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "PUT") {
            voscriptPuts.push(route.request().postDataJSON());
        }
        await route.continue();
    });

    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });
    await expectSectionReady(page, "voscript");

    const section = settingsPanel(page, "voscript");
    const connectionGroup = settingsGroup(section, "服务连接");
    const parametersGroup = settingsGroup(section, "转录运行参数");
    const connectionSaveButton = saveButton(connectionGroup);
    const paramsSaveButton = saveButton(parametersGroup);
    const baseUrlInput = control(section, "voscript-base-url");
    const apiKeyInput = control(section, "voscript-api-key");
    const minSpeakersInput = control(section, "voscript-min-speakers");
    const maxSpeakersInput = control(section, "voscript-max-speakers");
    const noRepeatNgramInput = control(section, "voscript-no-repeat-ngram");
    const snrThresholdInput = control(section, "voscript-snr-threshold");
    const maxInflightJobsInput = control(section, "voscript-max-inflight-jobs");
    const denoiseModelSelect = page.getByRole("combobox", {
        name: "降噪模型",
        exact: true,
    });

    for (const readyControl of [
        baseUrlInput,
        apiKeyInput,
        minSpeakersInput,
        maxSpeakersInput,
        noRepeatNgramInput,
        snrThresholdInput,
        maxInflightJobsInput,
    ]) {
        await expect(readyControl).toBeVisible();
        await expect(readyControl).toBeEnabled();
    }
    await expectSelectTrigger(denoiseModelSelect, {
        label: "降噪模型",
        text: "不降噪",
    });
    await expect(
        section.getByRole("heading", { name: "VoScript 服务", exact: true }),
    ).toBeVisible();

    await baseUrlInput.fill("https://voscript.example.com");
    await apiKeyInput.fill("e2e-vs-value");
    await minSpeakersInput.fill("3");
    await maxSpeakersInput.fill("4");
    await noRepeatNgramInput.fill("4");
    await snrThresholdInput.fill("12.5");
    await maxInflightJobsInput.fill("2");
    await chooseSelectOption(page, denoiseModelSelect, "DeepFilterNet");

    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/voscript") &&
                response.request().method() === "PUT" &&
                response.ok() &&
                response.request().postDataJSON()
                    ?.privateTranscriptionBaseUrl ===
                    "https://voscript.example.com",
        ),
        connectionSaveButton.click(),
    ]);

    expect(voscriptPuts.at(-1)).toEqual({
        privateTranscriptionApiKey: "e2e-vs-value",
        privateTranscriptionBaseUrl: "https://voscript.example.com",
    });
    await expect(connectionSaveButton).toHaveAccessibleName("已保存");
    await expect(apiKeyInput).toHaveValue("");
    await expect(
        connectionGroup.getByText("已存储", { exact: true }),
    ).toBeVisible();
    await expect(minSpeakersInput).toHaveValue("3");
    await expect(maxSpeakersInput).toHaveValue("4");
    await expect(noRepeatNgramInput).toHaveValue("4");
    await expect(snrThresholdInput).toHaveValue("12.5");
    await expect(maxInflightJobsInput).toHaveValue("2");

    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/voscript") &&
                response.request().method() === "PUT" &&
                response.ok() &&
                response.request().postDataJSON()
                    ?.privateTranscriptionNoRepeatNgramSize === 4,
        ),
        paramsSaveButton.click(),
    ]);

    expect(voscriptPuts.at(-1)).toEqual({
        privateTranscriptionDenoiseModel: "deepfilternet",
        privateTranscriptionMaxInflightJobs: 2,
        privateTranscriptionMaxSpeakers: 4,
        privateTranscriptionMinSpeakers: 3,
        privateTranscriptionNoRepeatNgramSize: 4,
        privateTranscriptionSnrThreshold: 12.5,
    });
    await expect(paramsSaveButton).toHaveAccessibleName("已保存");
    await expect(apiKeyInput).toHaveValue("");
    await expect(
        connectionGroup.getByText("已存储", { exact: true }),
    ).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectSectionReady(page, "voscript");
    const reloadedSection = settingsPanel(page, "voscript");
    const reloadedConnectionGroup = settingsGroup(
        reloadedSection,
        "服务连接",
    );
    await expect(control(reloadedSection, "voscript-api-key")).toHaveValue("");
    await expect(
        reloadedConnectionGroup.getByText("已存储", { exact: true }),
    ).toBeVisible();
    await expect(
        control(reloadedSection, "voscript-min-speakers"),
    ).toHaveValue("3");
    await expect(
        control(reloadedSection, "voscript-max-speakers"),
    ).toHaveValue("4");
    await expect(
        control(reloadedSection, "voscript-no-repeat-ngram"),
    ).toHaveValue("4");
});
