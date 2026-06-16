import { expect, type Locator, type Page, test } from "@playwright/test";
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

async function expectSotSwitchState(locator: Locator, checked: boolean) {
    await expect(locator).toHaveAttribute("role", "switch");
    await expect(locator).toHaveAttribute(
        "aria-checked",
        checked ? "true" : "false",
    );
    await expect(locator).toHaveClass(/\btoggle\b/);
    if (checked) {
        await expect(locator).toHaveClass(/\bon\b/);
    } else {
        await expect(locator).not.toHaveClass(/\bon\b/);
    }
}

function settingsShell(page: Page) {
    return page.locator('[data-sot-surface="settings-shell"]');
}

function settingsSection(page: Page, section: string) {
    return page.locator(
        `[data-sot-surface="settings-section"][data-sot-section="${section}"]`,
    );
}

function sectionSaveButton(section: Locator, saveId?: string) {
    if (saveId) {
        return section.locator(
            `[data-save-id="${saveId}"] [data-sot-control="settings-save"]`,
        );
    }

    return section.locator('[data-sot-control="settings-save"]');
}

function speakerProfilesPanel(page: Page) {
    return page.locator('[data-sot-panel="speaker-profiles"]');
}

function speakerProfilesLocal(page: Page) {
    return page.locator('[data-sot-panel="speaker-profiles-local"]');
}

function speakerVoiceprints(page: Page) {
    return page.locator('[data-sot-panel="speaker-voiceprints"]');
}

async function expectSectionReady(page: Page, sectionName: string) {
    const section = settingsSection(page, sectionName);
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(section).toHaveAttribute("aria-busy", "false");
}

test("title generation settings save model provider fields through the SOT section", async ({
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

    const section = settingsSection(page, "title-generation");
    const saveButton = sectionSaveButton(section);
    await expect(settingsShell(page)).toHaveAttribute(
        "data-sot-section",
        "title-generation",
    );
    await expectSectionReady(page, "title-generation");
    await expect(
        section.getByRole("heading", {
            name: "AI 重命名服务",
            exact: true,
        }),
    ).toBeVisible();
    await expectSotSwitchState(
        section.locator("#title-generation-enabled"),
        true,
    );
    await expect(saveButton).toHaveAttribute("data-sot-state", "idle");

    await section.locator("#title-generation-enabled").click();
    await expectSotSwitchState(
        section.locator("#title-generation-enabled"),
        false,
    );
    await section.locator("#title-generation-base-url").fill("https://example.com/v1");
    await section.locator("#title-generation-model").fill("e2e-title-model");
    await section.locator("#title-generation-api-key").fill("e2e-title-value");

    const saveResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/title-generation") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.titleGenerationModel ===
                "e2e-title-model",
    );
    await Promise.all([titleGenerationSaveStarted, saveButton.click()]);
    await expect(section).toHaveAttribute("data-sot-state", "busy");
    await expect(saveButton).toHaveAttribute("data-sot-state", "saving");
    await expect(saveButton).toHaveAttribute("aria-busy", "true");
    await expect(saveButton).toContainText("保存中");

    releaseTitleGenerationSave?.();
    await saveResponse;
    expect(titleGenerationPuts.at(-1)).toMatchObject({
        autoGenerateTitle: false,
        titleGenerationApiKey: "e2e-title-value",
        titleGenerationBaseUrl: "https://example.com/v1",
        titleGenerationModel: "e2e-title-model",
    });
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(saveButton).toHaveAttribute("data-sot-state", "saved");
    await expect(section.locator("#title-generation-api-key")).toHaveValue("");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(settingsSection(page, "title-generation")).toHaveAttribute(
        "data-sot-state",
        "ready",
    );
    await expect(page.locator("#title-generation-model")).toHaveValue(
        "e2e-title-model",
    );
    await expect(page.locator("#title-generation-api-key")).toHaveAttribute(
        "placeholder",
        /输入新 key 可替换/,
    );
});

test("title generation settings load failure exposes retry-only SOT state", async ({
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

    const section = settingsSection(page, "title-generation");
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute("data-sot-state", "loading");
    const skeleton = page.locator(
        '[data-sot-panel="settings-section-skeleton"][data-sot-section="title-generation"]',
    );
    await expect(skeleton).toBeVisible();
    await expect(skeleton).toHaveAttribute("data-sot-state", "loading");
    await expect(
        skeleton.locator('[data-sot-part="settings-skeleton-row"]'),
    ).toHaveCount(4);
    await expect(
        skeleton.locator('[data-sot-panel="settings-card-skeleton"]'),
    ).toHaveCount(2);
    await expect(
        skeleton.locator('[data-sot-panel="settings-card-skeleton"]').first(),
    ).toHaveAttribute("data-sot-state", "loading");

    releaseInitialLoad?.();
    await expect(section).toHaveAttribute("data-sot-state", "error");
    const loadError = section.locator(
        '[data-sot-panel="settings-section-load-error"][data-sot-section="title-generation"]',
    );
    await expect(loadError).toBeVisible();
    await expect(section.getByText("加载失败")).toBeVisible();
    await expect(section.getByText("Title generation unavailable")).toBeVisible();
    await expect(section.locator("#title-generation-enabled")).toHaveCount(0);
    await expect(section.locator("#title-generation-model")).toHaveCount(0);
    await expect(sectionSaveButton(section)).toHaveCount(0);
    const retry = section.locator(
        '[data-sot-control="settings-section-load-retry"][data-sot-section="title-generation"]',
    );
    await expect(retry).toBeVisible();

    const retryResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/title-generation") &&
            response.request().method() === "GET" &&
            response.ok(),
    );
    await retry.click();
    await retryResponse;

    await expectSectionReady(page, "title-generation");
    await expectSotSwitchState(
        section.locator("#title-generation-enabled"),
        true,
    );
    await expect(section.locator("#title-generation-model")).toBeVisible();
});

test("transcription settings save auto-transcribe and language changes through SOT controls", async ({
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

    const section = settingsSection(page, "transcription");
    await expectSectionReady(page, "transcription");
    await expect(sectionSaveButton(section)).toHaveCount(0);
    await expect(section.locator("[data-save-actions]")).toHaveCount(0);
    await expect(section.locator("[data-save-action]")).toHaveCount(0);
    const autoTranscribeSwitch = section.locator(
        "#transcription-auto-transcribe",
    );
    await expect(autoTranscribeSwitch).toHaveAttribute("aria-checked", "true");
    await expect(autoTranscribeSwitch).not.toHaveAttribute("data-state", /.*/);
    await expect(autoTranscribeSwitch).toHaveClass(/(^|\s)on(\s|$)/);

    const autoTranscribeOffResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/transcription") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.autoTranscribe === false,
    );
    await autoTranscribeSwitch.click();
    await transcriptionSaveStarted;
    await expect(section).toHaveAttribute("data-sot-state", "busy");
    await expect(autoTranscribeSwitch).toBeDisabled();
    releaseTranscriptionSave?.();
    await autoTranscribeOffResponse;

    expect(transcriptionPayloads.at(-1)).toEqual({
        autoTranscribe: false,
    });
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(autoTranscribeSwitch).toHaveAttribute("aria-checked", "false");
    await expect(autoTranscribeSwitch).not.toHaveClass(/(^|\s)on(\s|$)/);

    const languageResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/transcription") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.defaultTranscriptionLanguage ===
                "zh",
    );
    await section.locator("#transcription-language").selectOption("zh");
    await languageResponse;

    expect(transcriptionPayloads.at(-1)).toEqual({
        defaultTranscriptionLanguage: "zh",
    });
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(sectionSaveButton(section)).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    const reloadedAutoTranscribeSwitch = page.locator(
        "#transcription-auto-transcribe",
    );
    await expect(reloadedAutoTranscribeSwitch).toHaveAttribute(
        "aria-checked",
        "false",
    );
    await expect(reloadedAutoTranscribeSwitch).not.toHaveClass(
        /(^|\s)on(\s|$)/,
    );
    await expect(page.locator("#transcription-language")).toHaveValue("zh");
});

test("VoScript speaker profiles restore SOT states and backend actions", async ({
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

    const panel = speakerProfilesPanel(page);
    const local = speakerProfilesLocal(page);
    const voiceprintsPanel = speakerVoiceprints(page);
    const profilesRefresh = local.locator(
        '[data-sot-control="speaker-profiles-refresh"]',
    );
    const voiceprintsRefresh = voiceprintsPanel.locator(
        '[data-sot-control="speaker-voiceprints-refresh"]',
    );
    await expect(panel).toBeVisible();
    await expect(profilesRefresh).toHaveAttribute("data-sot-state", "loading");
    await expect(local).toHaveAttribute("data-sot-state", "loading");
    await expect(
        local.locator('[data-sot-panel="settings-list-skeleton"]'),
    ).toBeVisible();

    initialProfileLoadRelease?.();
    await expect(local).toHaveAttribute("data-sot-state", "error");
    await expect(
        local.locator('[data-sot-panel="speaker-profiles-notice"]'),
    ).toHaveAttribute("data-sot-state", "error");
    await expect(local.getByText("说话人档案服务暂不可用")).toBeVisible();
    await expect(voiceprintsPanel).toHaveAttribute("data-sot-state", "disabled");

    failProfileLoads = false;
    await local
        .locator('[data-sot-control="speaker-profiles-retry"]')
        .click();
    await expect(local).toHaveAttribute("data-sot-state", "empty");
    await expect(
        local.locator('[data-sot-panel="speaker-profiles-notice"]'),
    ).toHaveAttribute("data-sot-state", "empty");

    const createName = local.locator(
        '[data-sot-control="speaker-profile-new-name"]',
    );
    const createButton = local.locator(
        '[data-sot-control="speaker-profile-create"]',
    );
    await createName.fill("E2E Speaker Alpha");
    await expect(createButton).toHaveAttribute("data-sot-state", "idle");
    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().endsWith("/api/speakers/profiles") &&
                response.request().method() === "POST" &&
                response.ok(),
        ),
        createButton.click(),
    ]);

    const speakerRow = local.locator(
        '[data-sot-speaker-profile-row][data-sot-speaker-profile-id="speaker-alpha"]',
    );
    await expect(local).toHaveAttribute("data-sot-state", "ready");
    await expect(speakerRow).toHaveAttribute("data-sot-state", "ready");
    const speakerNameInput = speakerRow.locator(
        '[data-sot-control="speaker-profile-name"]',
    );
    await speakerNameInput.fill("E2E Speaker Renamed");
    await speakerRow.locator('[data-sot-control="speaker-profile-save"]').click();
    await expect(speakerRow).toHaveAttribute("data-sot-state", "saving");
    profilePatchRelease?.();
    await expect(speakerNameInput).toHaveValue("E2E Speaker Renamed");
    await expect(speakerRow).toHaveAttribute("data-sot-state", "ready");

    const speakerDeleteButton = speakerRow.locator(
        '[data-sot-control="speaker-profile-delete"]',
    );
    await speakerDeleteButton.click();
    const speakerCancelDialog = page.getByRole("dialog", {
        name: "确认操作",
        exact: true,
    });
    await expect(
        speakerCancelDialog.getByRole("button", { name: "取消", exact: true }),
    ).toBeFocused();
    await speakerCancelDialog
        .getByRole("button", { name: "取消", exact: true })
        .click();
    await expect(speakerCancelDialog).not.toBeVisible();
    await expect(speakerDeleteButton).toBeFocused();
    expect(profileDeleteAttempts).toBe(0);
    await expect(speakerRow).toHaveCount(1);

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
    await expect(speakerRow).toHaveCount(1);

    await speakerDeleteButton.click();
    const speakerBackdropDialog = page.getByRole("dialog", {
        name: "确认操作",
        exact: true,
    });
    await expect(speakerBackdropDialog).toBeVisible();
    await page
        .locator('[data-sot-panel="confirm-dialog"]')
        .click({ position: { x: 8, y: 8 } });
    await expect(speakerBackdropDialog).not.toBeVisible();
    await expect(speakerDeleteButton).toBeFocused();
    expect(profileDeleteAttempts).toBe(0);
    await expect(speakerRow).toHaveCount(1);

    await speakerDeleteButton.click();
    await page
        .getByRole("dialog", { name: "确认操作", exact: true })
        .getByRole("button", { name: "确认", exact: true })
        .click();
    expect(profileDeleteAttempts).toBe(1);
    await expect(speakerRow).toHaveCount(0);
    await expect(local).toHaveAttribute("data-sot-state", "empty");

    voiceprintMode = "empty";
    await expect(voiceprintsRefresh).toHaveAttribute("data-sot-state", "idle");
    await voiceprintsRefresh.click();
    await expect(voiceprintsPanel).toHaveAttribute("data-sot-state", "empty");
    await expect(
        voiceprintsPanel.locator('[data-sot-panel="speaker-voiceprints-notice"]'),
    ).toHaveAttribute("data-sot-state", "empty");

    failVoiceprintLoads = true;
    await voiceprintsRefresh.click();
    await expect(voiceprintsPanel).toHaveAttribute("data-sot-state", "error");
    await expect(
        voiceprintsPanel.locator('[data-sot-panel="speaker-voiceprints-notice"]'),
    ).toHaveAttribute("data-sot-state", "error");
    await expect(voiceprintsPanel.getByText("声纹服务暂不可用")).toBeVisible();

    voiceprintMode = "ready";
    failVoiceprintLoads = false;
    await voiceprintsPanel
        .locator('[data-sot-control="speaker-voiceprints-retry"]')
        .click();
    await expect(voiceprintsPanel).toHaveAttribute("data-sot-state", "ready");
    const voiceprintRow = voiceprintsPanel.locator(
        '[data-sot-voiceprint-row][data-sot-voiceprint-id="vp-alpha"]',
    );
    await expect(voiceprintRow).toHaveAttribute("data-sot-state", "ready");
    const voiceprintNameInput = voiceprintRow.locator(
        '[data-sot-control="speaker-voiceprint-name"]',
    );
    await voiceprintNameInput.fill("Remote Voiceprint Renamed");
    await voiceprintRow
        .locator('[data-sot-control="speaker-voiceprint-rename"]')
        .click();
    await expect(voiceprintRow).toHaveAttribute("data-sot-state", "saving");
    voiceprintPatchRelease?.();
    await expect(voiceprintNameInput).toHaveValue("Remote Voiceprint Renamed");
    await expect(voiceprintRow).toHaveAttribute("data-sot-state", "ready");

    const voiceprintDeleteButton = voiceprintRow.locator(
        '[data-sot-control="speaker-voiceprint-delete"]',
    );
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
    await expect(voiceprintRow).toHaveCount(1);

    await voiceprintDeleteButton.click();
    const voiceprintBackdropDialog = page.getByRole("dialog", {
        name: "确认操作",
        exact: true,
    });
    await expect(voiceprintBackdropDialog).toBeVisible();
    await page
        .locator('[data-sot-panel="confirm-dialog"]')
        .click({ position: { x: 8, y: 8 } });
    await expect(voiceprintBackdropDialog).not.toBeVisible();
    await expect(voiceprintDeleteButton).toBeFocused();
    expect(voiceprintDeleteAttempts).toBe(0);
    await expect(voiceprintRow).toHaveCount(1);

    await voiceprintDeleteButton.click();
    await page
        .getByRole("dialog", { name: "确认操作", exact: true })
        .getByRole("button", { name: "确认", exact: true })
        .click();
    expect(voiceprintDeleteAttempts).toBe(1);
    await expect(voiceprintRow).toHaveCount(0);
    await expect(voiceprintsPanel).toHaveAttribute("data-sot-state", "empty");
});

test("sync settings save toggles and normalize short intervals through the SOT section", async ({
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

    const section = settingsSection(page, "misc");
    await expect(settingsShell(page)).toHaveAttribute("data-sot-section", "misc");
    await expectSectionReady(page, "misc");
    await expect(sectionSaveButton(section)).toHaveCount(0);
    await expect(
        section.getByRole("heading", { name: "同步设置" }),
    ).toBeVisible();
    const autoSyncSwitch = section.locator(
        '[data-sot-control="sync-auto-enabled"]',
    );
    const syncIntervalInput = section.locator(
        '[data-sot-control="sync-interval-seconds"]',
    );
    await expect(autoSyncSwitch).toHaveAttribute(
        "data-sot-state",
        "checked",
    );
    await expect(syncIntervalInput).toHaveValue("300");
    await expect(syncIntervalInput).toHaveAttribute("data-sot-state", "ready");

    const autoSyncOffResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/sync") &&
            response.request().method() === "PUT" &&
            response.ok() &&
            response.request().postDataJSON()?.autoSyncEnabled === false,
    );
    await Promise.all([firstSyncSaveStarted, autoSyncSwitch.click()]);
    await expect(section).toHaveAttribute("data-sot-state", "busy");
    await expect(autoSyncSwitch).toBeDisabled();
    releaseFirstSyncSave?.();
    await autoSyncOffResponse;
    expect(syncPayloads.at(-1)).toEqual({
        autoSyncEnabled: false,
    });
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(autoSyncSwitch).toHaveAttribute(
        "data-sot-state",
        "unchecked",
    );
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
    await expect(autoSyncSwitch).toHaveAttribute("data-sot-state", "checked");

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
    await expect(section).toHaveAttribute("data-sot-state", "ready");
    await expect(syncIntervalInput).toHaveValue("60");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
        page.locator('[data-sot-control="sync-auto-enabled"]'),
    ).toHaveAttribute(
        "data-sot-state",
        "checked",
    );
    await expect(
        page.locator('[data-sot-control="sync-interval-seconds"]'),
    ).toHaveValue("60");
});

test("VoScript settings save current SOT controls without testing connection", async ({
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

    const section = settingsSection(page, "voscript");
    const saveButton = sectionSaveButton(section, "voscript-params");
    await expectSectionReady(page, "voscript");
    await expect(
        section.getByRole("heading", {
            name: "VoScript 服务",
            exact: true,
        }),
    ).toBeVisible();

    await section.locator("#voscript-base-url").fill("https://voscript.example.com");
    await section.locator("#voscript-api-key").fill("e2e-vs-value");
    await section.locator("#voscript-min-speakers").fill("3");
    await section.locator("#voscript-max-speakers").fill("4");
    await section.locator("#voscript-no-repeat-ngram").fill("4");
    await section.locator("#voscript-snr-threshold").fill("12.5");
    await section.locator("#voscript-max-inflight-jobs").fill("2");
    await section
        .getByRole("combobox", { name: "降噪模型" })
        .selectOption("deepfilternet");

    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/voscript") &&
                response.request().method() === "PUT" &&
                response.ok() &&
                response.request().postDataJSON()
                    ?.privateTranscriptionNoRepeatNgramSize === 4,
        ),
        saveButton.click(),
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
    await expect(saveButton).toHaveAttribute("data-sot-state", "saved");
    await expect(section.locator("#voscript-api-key")).toHaveValue("");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#voscript-api-key")).toHaveValue("");
    await expect(page.locator("#voscript-min-speakers")).toHaveValue("3");
    await expect(page.locator("#voscript-max-speakers")).toHaveValue("4");
    await expect(page.locator("#voscript-no-repeat-ngram")).toHaveValue("4");
});
