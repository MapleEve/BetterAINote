import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

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
        itemsPerPage: 50,
        recordingListSortOrder: "newest",
        theme: "system",
        uiLanguage: "zh-CN",
    });
}

async function resetTitleGeneration(page: Page) {
    await putSettingsWithRetry(page, "/api/settings/title-generation", {
        autoGenerateTitle: true,
        titleGenerationApiKey: null,
        titleGenerationBaseUrl: null,
        titleGenerationModel: null,
    });
}

async function resetTranscription(page: Page) {
    await putSettingsWithRetry(page, "/api/settings/transcription", {
        autoTranscribe: false,
        defaultTranscriptionLanguage: null,
    });
}

async function resetSync(page: Page) {
    await putSettingsWithRetry(page, "/api/settings/sync", {
        autoSyncEnabled: true,
        syncIntervalSeconds: 300,
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

test("title generation settings validate, save, and clear sensitive input", async ({
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

    const shell = page.locator("[data-settings-shell]");
    await expect(shell).toHaveAttribute(
        "data-settings-active-section",
        "title-generation",
    );
    await expect(
        page.locator('[data-settings-section="title-generation"]'),
    ).toBeVisible();
    const section = page.locator('[data-settings-section="title-generation"]');
    await expect(section).toHaveAttribute(
        "data-title-generation-service-state",
        "needs-setup",
    );
    await expect(section).toHaveAttribute(
        "data-title-generation-save-state",
        "ready",
    );
    await expect(page.getByTestId("title-generation-config-state")).toHaveAttribute(
        "data-state",
        "needs-setup",
    );

    const autoToggle = page.getByTestId("title-generation-auto-toggle");
    await expect(autoToggle).toHaveAttribute("data-state", "checked");

    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/title-generation") &&
                response.request().method() === "PUT" &&
                response.ok() &&
                response.request().postDataJSON()?.autoGenerateTitle === false,
        ),
        autoToggle.click(),
    ]);
    await expect(autoToggle).toHaveAttribute("data-state", "unchecked");

    const requestCountBeforeInvalidSave = titleGenerationPuts.length;
    await page.getByTestId("title-generation-save").click();
    await expect(page.getByText("必须填写重命名模型")).toBeVisible();
    await page.waitForTimeout(250);
    expect(titleGenerationPuts).toHaveLength(requestCountBeforeInvalidSave);

    await page
        .locator("#title-generation-base-url")
        .fill("https://example.com/v1");
    await page.locator("#title-generation-model").fill("e2e-title-model");
    await page.locator("#title-generation-api-key").fill("e2e-title-value");

    const titleGenerationSaveResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/title-generation") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.titleGenerationModel ===
                "e2e-title-model",
    );
    await page.getByTestId("title-generation-save").click();
    await titleGenerationSaveStarted;
    await expect(section).toHaveAttribute(
        "data-title-generation-save-state",
        "saving",
    );
    await expect(page.getByTestId("title-generation-save")).toHaveAttribute(
        "aria-busy",
        "true",
    );
    await expect(page.getByTestId("title-generation-config-state")).toContainText(
        "保存中",
    );
    releaseTitleGenerationSave?.();
    await titleGenerationSaveResponse;

    expect(titleGenerationPuts.at(-1)).toMatchObject({
        titleGenerationApiKey: "e2e-title-value",
        titleGenerationBaseUrl: "https://example.com/v1",
        titleGenerationModel: "e2e-title-model",
    });
    await expect(section).toHaveAttribute(
        "data-title-generation-service-state",
        "configured",
    );
    await expect(section).toHaveAttribute(
        "data-title-generation-save-state",
        "ready",
    );
    await expect(page.locator("#title-generation-api-key")).toHaveValue("");
    await expect(page.getByText("AI 重命名设置已保存")).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#title-generation-model")).toHaveValue(
        "e2e-title-model",
    );
    await expect(page.locator("#title-generation-api-key")).toHaveAttribute(
        "placeholder",
        /已存储/,
    );
    await expect(page.getByTestId("title-generation-config-state")).toHaveAttribute(
        "data-state",
        "configured",
    );
});

test("title generation settings load failure shows retry-only state", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetCoreSettings(page);

    let failedInitialLoad = false;
    await page.route("**/api/settings/title-generation", async (route) => {
        if (route.request().method() !== "GET" || failedInitialLoad) {
            await route.continue();
            return;
        }

        failedInitialLoad = true;
        await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Title generation unavailable" }),
        });
    });

    await page.goto("/settings#title-generation", {
        waitUntil: "domcontentloaded",
    });

    const section = page.locator('[data-settings-section="title-generation"]');
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("data-settings-load-state", "error");
    await expect(page.getByTestId("title-generation-load-error")).toContainText(
        "Title generation unavailable",
    );
    await expect(page.getByTestId("title-generation-auto-toggle")).toHaveCount(
        0,
    );
    await expect(page.locator("#title-generation-model")).toHaveCount(0);
    await expect(page.getByTestId("title-generation-save")).toHaveCount(0);

    const retryResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/title-generation") &&
            response.request().method() === "GET" &&
            response.ok(),
    );
    await page.getByTestId("title-generation-load-retry").click();
    await retryResponse;

    await expect(section).toHaveAttribute(
        "data-title-generation-service-state",
        "needs-setup",
    );
    await expect(page.getByTestId("title-generation-auto-toggle")).toHaveAttribute(
        "data-state",
        "checked",
    );
    await expect(page.locator("#title-generation-model")).toBeVisible();
});

test("transcription settings persist auto-transcribe and language changes", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetCoreSettings(page);
    let releaseTranscriptionSave: (() => void) | null = null;
    let markTranscriptionSaveStarted: (() => void) | null = null;
    const transcriptionSaveStarted = new Promise<void>((resolve) => {
        markTranscriptionSaveStarted = resolve;
    });
    await page.route("**/api/settings/transcription", async (route) => {
        if (route.request().method() === "PUT") {
            const payload = route.request().postDataJSON();
            if (payload?.autoTranscribe === true) {
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

    const section = page.locator('[data-settings-section="transcription"]');
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute(
        "data-transcription-save-state",
        "ready",
    );
    await expect(page.getByTestId("transcription-save-state")).toHaveAttribute(
        "data-state",
        "ready",
    );

    const autoToggle = page.getByTestId("transcription-auto-toggle");
    await expect(autoToggle).toHaveAttribute("data-state", "unchecked");

    const autoSaveResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/transcription") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.autoTranscribe === true,
    );
    await autoToggle.click();
    await transcriptionSaveStarted;
    await expect(section).toHaveAttribute(
        "data-transcription-save-state",
        "saving",
    );
    await expect(page.getByTestId("transcription-save-state")).toContainText(
        "保存中",
    );
    releaseTranscriptionSave?.();
    await autoSaveResponse;
    await expect(autoToggle).toHaveAttribute("data-state", "checked");
    await expect(section).toHaveAttribute(
        "data-transcription-save-state",
        "ready",
    );

    await page.getByTestId("transcription-language").click();
    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/transcription") &&
                response.request().method() === "PUT" &&
                response.ok() &&
                response.request().postDataJSON()
                    ?.defaultTranscriptionLanguage === "zh",
        ),
        page.getByRole("option", { name: "中文", exact: true }).click(),
    ]);
    await expect(page.getByTestId("transcription-language")).toContainText(
        "中文",
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("transcription-auto-toggle")).toHaveAttribute(
        "data-state",
        "checked",
    );
    await expect(page.getByTestId("transcription-language")).toContainText(
        "中文",
    );
});

test("sync settings persist toggles and normalize short intervals", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await resetCoreSettings(page);

    await page.goto("/settings#sync", { waitUntil: "domcontentloaded" });

    const shell = page.locator("[data-settings-shell]");
    await expect(shell).toHaveAttribute("data-settings-active-section", "misc");
    await expect(page.locator('[data-settings-section="sync"]')).toBeVisible();

    const autoToggle = page.getByTestId("sync-auto-toggle");
    const intervalInput = page.getByTestId("sync-interval");
    const section = page.locator('[data-settings-section="sync"]');
    await expect(autoToggle).toHaveAttribute("data-state", "checked");
    await expect(intervalInput).toHaveValue("300");

    let releaseSyncSave = () => {};
    let notifySyncSaveStarted = () => {};
    const syncSaveStarted = new Promise<void>((resolve) => {
        notifySyncSaveStarted = resolve;
    });
    const pendingSyncSave = new Promise<void>((resolve) => {
        releaseSyncSave = resolve;
    });
    let delayNextSyncPut = true;

    await page.route("**/api/settings/sync", async (route) => {
        if (
            route.request().method() !== "PUT" ||
            !delayNextSyncPut ||
            route.request().postDataJSON()?.autoSyncEnabled !== false
        ) {
            await route.continue();
            return;
        }

        delayNextSyncPut = false;
        notifySyncSaveStarted();
        await pendingSyncSave;
        await route.continue();
    });

    const autoSyncOffResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/sync") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.autoSyncEnabled === false,
    );
    await autoToggle.click();
    await syncSaveStarted;
    await expect(section).toHaveAttribute("data-sync-save-state", "saving");
    await expect(page.getByTestId("sync-save-state")).toContainText("保存中");
    await expect(autoToggle).toBeDisabled();
    releaseSyncSave();
    await autoSyncOffResponse;
    await expect(section).toHaveAttribute("data-sync-save-state", "ready");
    await expect(autoToggle).toHaveAttribute("data-state", "unchecked");
    await expect(intervalInput).toHaveCount(0);

    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/sync") &&
                response.request().method() === "PUT" &&
                response.ok() &&
                response.request().postDataJSON()?.autoSyncEnabled === true,
        ),
        autoToggle.click(),
    ]);
    await expect(page.getByTestId("sync-interval")).toBeVisible();

    const normalizedIntervalResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/sync") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.syncIntervalSeconds === 60,
    );
    await page.getByTestId("sync-interval").fill("12");
    await page.getByText("同步设置").click();
    await normalizedIntervalResponse;
    await expect(page.getByTestId("sync-interval")).toHaveValue("60");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("sync-auto-toggle")).toHaveAttribute(
        "data-state",
        "checked",
    );
    await expect(page.getByTestId("sync-interval")).toHaveValue("60");
});

test("VoScript settings validate local parameters and save without testing connection", async ({
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

    const section = page.locator('[data-settings-section="voscript"]');
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute(
        "data-voscript-availability",
        "unavailable",
    );

    await page
        .locator("#private-transcription-base-url")
        .fill("https://voscript.example.com");
    await page.locator("#private-transcription-api-key").fill("e2e-vs-value");
    await page.locator("#private-transcription-min-speakers").fill("3");
    await page.locator("#private-transcription-max-speakers").fill("2");

    const requestCountBeforeSpeakerError = voscriptPuts.length;
    await page.getByTestId("voscript-save").click();
    await expect(page.getByTestId("voscript-save-message")).toContainText(
        "最大说话人数",
    );
    await page.waitForTimeout(250);
    expect(voscriptPuts).toHaveLength(requestCountBeforeSpeakerError);

    await page.locator("#private-transcription-max-speakers").fill("4");
    await page.locator("#private-transcription-no-repeat-ngram-size").fill("2");

    const requestCountBeforeNgramError = voscriptPuts.length;
    await page.getByTestId("voscript-save").click();
    await expect(page.getByTestId("voscript-save-message")).toContainText(
        "重复抑制长度",
    );
    await page.waitForTimeout(250);
    expect(voscriptPuts).toHaveLength(requestCountBeforeNgramError);

    await page.locator("#private-transcription-no-repeat-ngram-size").fill("4");
    await page.locator("#private-transcription-snr-threshold").fill("12.5");
    await page.locator("#private-transcription-max-inflight-jobs").fill("1.5");

    const requestCountBeforeInflightError = voscriptPuts.length;
    await page.getByTestId("voscript-save").click();
    await expect(page.getByTestId("voscript-save-message")).toContainText(
        "本地调度活跃任务上限",
    );
    await page.waitForTimeout(250);
    expect(voscriptPuts).toHaveLength(requestCountBeforeInflightError);

    await page.locator("#private-transcription-max-inflight-jobs").fill("2");
    await page.locator("#private-transcription-denoise-model").click();
    await page.getByRole("option", { name: "DeepFilterNet" }).click();

    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/voscript") &&
                response.request().method() === "PUT" &&
                response.ok() &&
                response.request().postDataJSON()
                    ?.privateTranscriptionNoRepeatNgramSize === 4,
        ),
        page.getByTestId("voscript-save").click(),
    ]);

    expect(voscriptPuts.at(-1)).toMatchObject({
        privateTranscriptionApiKey: "e2e-vs-value",
        privateTranscriptionBaseUrl: "https://voscript.example.com",
        privateTranscriptionDenoiseModel: "deepfilternet",
        privateTranscriptionMaxInflightJobs: 2,
        privateTranscriptionMaxSpeakers: 4,
        privateTranscriptionMinSpeakers: 3,
        privateTranscriptionNoRepeatNgramSize: 4,
        privateTranscriptionSnrThreshold: 12.5,
    });
    await expect(page.locator("#private-transcription-api-key")).toHaveValue("");
    await expect(page.getByTestId("voscript-save-message")).toContainText(
        "VoScript 服务配置已保存",
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#private-transcription-api-key")).toHaveAttribute(
        "placeholder",
        /已存储/,
    );
    await expect(page.locator("#private-transcription-min-speakers")).toHaveValue(
        "3",
    );
    await expect(page.locator("#private-transcription-max-speakers")).toHaveValue(
        "4",
    );
    await expect(
        page.locator("#private-transcription-no-repeat-ngram-size"),
    ).toHaveValue("4");
});
