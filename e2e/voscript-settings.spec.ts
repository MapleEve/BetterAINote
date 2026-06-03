import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

async function resetDisplayToChinese(page: Page) {
    const resetResponse = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "system",
            uiLanguage: "zh-CN",
        },
    });
    expect(resetResponse.ok()).toBe(true);
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
            body: JSON.stringify({
                privateTranscriptionApiKeySet: true,
                privateTranscriptionBaseUrl: "https://voscript.e2e.example",
                privateTranscriptionDenoiseModel: "none",
                privateTranscriptionMaxInflightJobs: 1,
                privateTranscriptionMaxSpeakers: 0,
                privateTranscriptionMinSpeakers: 0,
                privateTranscriptionNoRepeatNgramSize: 0,
                privateTranscriptionSnrThreshold: null,
            }),
        });
    });

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

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    const section = page.locator('[data-settings-section="voscript"]');
    await expect(section).toHaveAttribute("data-voscript-load-state", "error");
    await expect(page.getByTestId("voscript-load-error")).toContainText(
        "VoScript settings temporarily unavailable",
    );
    await expect(page.getByTestId("voscript-save")).toHaveCount(0);

    await page.getByTestId("voscript-load-retry").click();
    await expect(section).toHaveAttribute("data-voscript-load-state", "ready");
    await expect(section).toHaveAttribute(
        "data-voscript-availability",
        "configured",
    );
    await expect(page.getByTestId("voscript-save")).toBeEnabled();
    expect(settingsGets).toBe(2);
});

test("VoScript settings tests the current connection and keeps speaker rows scroll-stable", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let connectionTestPayload: Record<string, unknown> | null = null;
    let settingsSavePayload: Record<string, unknown> | null = null;
    let releaseConnectionTest = () => {};
    let notifyConnectionTestStarted = () => {};
    const connectionTestStarted = new Promise<void>((resolve) => {
        notifyConnectionTestStarted = resolve;
    });
    const pendingConnectionTest = new Promise<void>((resolve) => {
        releaseConnectionTest = resolve;
    });

    await page.route("**/api/settings/voscript/test", async (route) => {
        connectionTestPayload = route.request().postDataJSON();
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
    });

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    privateTranscriptionApiKeySet: true,
                    privateTranscriptionBaseUrl:
                        "https://voscript.e2e.example",
                    privateTranscriptionDenoiseModel: "none",
                    privateTranscriptionMaxInflightJobs: 1,
                    privateTranscriptionMaxSpeakers: 0,
                    privateTranscriptionMinSpeakers: 0,
                    privateTranscriptionNoRepeatNgramSize: 0,
                    privateTranscriptionSnrThreshold: null,
                }),
            });
            return;
        }

        settingsSavePayload = route.request().postDataJSON();
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await page.route("**/api/speakers/profiles", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                profiles: [
                    {
                        assignmentCount: 3,
                        createdAt: "2026-05-01T00:00:00.000Z",
                        displayName:
                            "跨区域产品评审主持人 Alexandra Chen-Li 负责超长姓名换行稳定性",
                        id: "profile-long",
                        updatedAt: "2026-05-03T00:00:00.000Z",
                        voiceprintRef: null,
                    },
                ],
            }),
        });
    });

    await page.route("**/api/voiceprints", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                available: true,
                reason: null,
                voiceprints: [
                    {
                        createdAt: "2026-05-01T00:00:00.000Z",
                        displayName:
                            "Remote Voiceprint With Very Long Latin Name For Layout Acceptance",
                        id: "vp-long-001",
                        updatedAt: "2026-05-02T00:00:00.000Z",
                    },
                ],
            }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    const shell = page.locator("[data-settings-shell]");
    const section = page.locator('[data-settings-section="voscript"]');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute(
        "data-settings-active-section",
        "voscript",
    );
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute(
        "data-voscript-availability",
        "configured",
    );
    await expect(section).toHaveAttribute("data-voscript-test-state", "idle");
    await expect(section).toHaveAttribute(
        "data-voscript-interaction-disabled",
        "false",
    );

    const baseUrlInput = page.locator("#private-transcription-base-url");
    const apiKeyInput = page.locator("#private-transcription-api-key");
    await baseUrlInput.fill("https://voscript-updated.e2e.example");
    await expect(section).toHaveAttribute("data-voscript-availability", "draft");
    await expect(page.getByText("服务地址有未保存修改")).toBeVisible();
    await baseUrlInput.fill("https://voscript.e2e.example");
    await expect(section).toHaveAttribute(
        "data-voscript-availability",
        "configured",
    );

    await expect(page.locator("[data-speaker-profile-row]")).toBeVisible();
    await expect(page.locator("[data-vs-profile-row]")).toBeVisible();
    const profileBox = await page
        .locator("[data-speaker-profile-row]")
        .first()
        .boundingBox();
    expect(profileBox?.width ?? 0).toBeGreaterThan(520);
    expect(profileBox?.height ?? 0).toBeLessThan(180);

    await apiKeyInput.fill("typed-e2e-key");
    await page.getByTestId("voscript-test-connection").click();
    await connectionTestStarted;
    await expect(section).toHaveAttribute(
        "data-voscript-test-state",
        "testing",
    );
    await expect(section).toHaveAttribute(
        "data-voscript-interaction-disabled",
        "true",
    );
    await expect(baseUrlInput).toBeDisabled();
    await expect(apiKeyInput).toBeDisabled();
    await expect(page.getByTestId("voscript-test-connection")).toBeDisabled();
    await expect(page.getByTestId("voscript-save")).toBeDisabled();

    releaseConnectionTest();
    await expect(section).toHaveAttribute(
        "data-voscript-test-state",
        "success",
    );
    await expect(section).toHaveAttribute(
        "data-voscript-interaction-disabled",
        "false",
    );
    await expect(baseUrlInput).toBeEnabled();
    await expect(apiKeyInput).toBeEnabled();
    await expect(page.getByTestId("voscript-test-connection")).toBeEnabled();
    await expect(page.getByTestId("voscript-save")).toBeEnabled();
    await expect(page.getByTestId("voscript-connection-message")).toContainText(
        "连接测试通过",
    );
    expect(connectionTestPayload).toMatchObject({
        privateTranscriptionApiKey: "typed-e2e-key",
        privateTranscriptionBaseUrl: "https://voscript.e2e.example",
    });
    expect(settingsSavePayload).toBeNull();

    await section.hover();
    await page.mouse.wheel(0, 1200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(shell).toHaveAttribute(
        "data-settings-active-section",
        "voscript",
    );
});

test("VoScript settings clears stored API key when service URL is cleared", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let settings: Record<string, unknown> = {
        privateTranscriptionApiKeySet: true,
        privateTranscriptionBaseUrl: "https://voscript.e2e.example",
        privateTranscriptionDenoiseModel: "none",
        privateTranscriptionMaxInflightJobs: 1,
        privateTranscriptionMaxSpeakers: 0,
        privateTranscriptionMinSpeakers: 0,
        privateTranscriptionNoRepeatNgramSize: 0,
        privateTranscriptionSnrThreshold: null,
    };
    let savePayload: Record<string, unknown> | null = null;

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify(settings),
            });
            return;
        }

        savePayload = route.request().postDataJSON();
        settings = {
            ...settings,
            privateTranscriptionApiKeySet:
                savePayload?.privateTranscriptionApiKey === null
                    ? false
                    : settings.privateTranscriptionApiKeySet,
            privateTranscriptionBaseUrl:
                typeof savePayload?.privateTranscriptionBaseUrl === "string"
                    ? savePayload.privateTranscriptionBaseUrl
                    : null,
        };
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

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

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    const section = page.locator('[data-settings-section="voscript"]');
    await expect(section).toHaveAttribute(
        "data-voscript-availability",
        "configured",
    );
    await expect(page.locator("#private-transcription-api-key")).toHaveAttribute(
        "placeholder",
        /已存储/,
    );

    await page.locator("#private-transcription-base-url").fill("");
    await expect(
        page.getByText("保存后将清空 VoScript 连接和已保存的 API Key。"),
    ).toBeVisible();
    await page.getByTestId("voscript-save").click();

    await expect(page.getByTestId("voscript-save-message")).toContainText(
        "VoScript 服务地址已清空",
    );
    expect(savePayload).toMatchObject({
        privateTranscriptionApiKey: null,
        privateTranscriptionBaseUrl: null,
    });
    await expect(page.locator("#private-transcription-api-key")).toHaveAttribute(
        "placeholder",
        "vt_...",
    );
});

test("VoScript settings validates connection, save, and unavailable states", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let connectionTestCalls = 0;
    const settingsSavePayloads: Record<string, unknown>[] = [];
    let releaseSettingsSave = () => {};
    let notifySettingsSaveStarted = () => {};
    const settingsSaveStarted = new Promise<void>((resolve) => {
        notifySettingsSaveStarted = resolve;
    });
    const pendingSettingsSave = new Promise<void>((resolve) => {
        releaseSettingsSave = resolve;
    });

    await page.route("**/api/settings/voscript/test", async (route) => {
        connectionTestCalls += 1;
        await route.fulfill({
            contentType: "application/json",
            status: 502,
            body: JSON.stringify({ error: "VoScript test rejected" }),
        });
    });

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() === "GET") {
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    privateTranscriptionApiKeySet: false,
                    privateTranscriptionBaseUrl: null,
                    privateTranscriptionDenoiseModel: "none",
                    privateTranscriptionMaxInflightJobs: 1,
                    privateTranscriptionMaxSpeakers: 0,
                    privateTranscriptionMinSpeakers: 0,
                    privateTranscriptionNoRepeatNgramSize: 0,
                    privateTranscriptionSnrThreshold: null,
                }),
            });
            return;
        }

        settingsSavePayloads.push(route.request().postDataJSON());
        notifySettingsSaveStarted();
        await pendingSettingsSave;
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

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
                available: false,
                reason: "请先保存可用的 VoScript 服务连接。",
                voiceprints: [],
            }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    const section = page.locator('[data-settings-section="voscript"]');
    const baseUrlInput = page.locator("#private-transcription-base-url");
    const maxInflightInput = page.locator(
        "#private-transcription-max-inflight-jobs",
    );
    const repeatInput = page.locator(
        "#private-transcription-no-repeat-ngram-size",
    );
    const snrInput = page.locator("#private-transcription-snr-threshold");
    const saveButton = page.getByTestId("voscript-save");

    await expect(section).toHaveAttribute(
        "data-voscript-availability",
        "unavailable",
    );
    await expect(maxInflightInput).toBeDisabled();
    await expect(page.locator("[data-vs-state]")).toHaveAttribute(
        "data-vs-state",
        "disabled",
    );
    await expect(page.locator("[data-vs-state]")).toContainText(
        "请先保存可用的 VoScript 服务连接。",
    );

    await page.getByTestId("voscript-test-connection").click();
    await expect(section).toHaveAttribute("data-voscript-test-state", "error");
    await expect(page.getByTestId("voscript-connection-message")).toContainText(
        "请先填写 VoScript 服务地址",
    );
    expect(connectionTestCalls).toBe(0);

    await baseUrlInput.fill("https://bad-voscript.e2e.example");
    await expect(section).toHaveAttribute(
        "data-voscript-availability",
        "draft",
    );
    await expect(
        section.locator("[data-voscript-service-state]"),
    ).toHaveAttribute("data-voscript-service-state", "draft");
    await expect(page.getByText("服务地址待保存")).toBeVisible();
    await expect(maxInflightInput).toBeEnabled();
    await page.getByTestId("voscript-test-connection").click();
    await expect(section).toHaveAttribute("data-voscript-test-state", "error");
    await expect(page.getByTestId("voscript-connection-message")).toContainText(
        "VoScript test rejected",
    );
    expect(connectionTestCalls).toBe(1);

    await maxInflightInput.fill("-1");
    await saveButton.click();
    await expect(section).toHaveAttribute("data-voscript-save-state", "error");
    await expect(page.getByTestId("voscript-save-message")).toContainText(
        "本地调度活跃任务上限必须是非负整数",
    );
    expect(settingsSavePayloads).toEqual([]);

    await maxInflightInput.fill("2");
    await repeatInput.fill("2");
    await saveButton.click();
    await expect(section).toHaveAttribute("data-voscript-save-state", "error");
    await expect(page.getByTestId("voscript-save-message")).toContainText(
        "重复抑制长度必须为 0，或大于等于 3 的整数",
    );
    expect(settingsSavePayloads).toEqual([]);

    await repeatInput.fill("3");
    await snrInput.fill("");
    await baseUrlInput.fill("");
    await expect(section).toHaveAttribute(
        "data-voscript-availability",
        "unavailable",
    );
    await expect(maxInflightInput).toBeDisabled();
    await Promise.all([settingsSaveStarted, saveButton.click()]);
    await expect(section).toHaveAttribute("data-voscript-save-state", "saving");
    await expect(saveButton).toHaveAttribute("aria-busy", "true");

    releaseSettingsSave();
    await expect(section).toHaveAttribute("data-voscript-save-state", "saved");
    await expect(page.getByTestId("voscript-save-message")).toContainText(
        "VoScript 服务地址已清空",
    );
    expect(settingsSavePayloads.at(-1)).toMatchObject({
        privateTranscriptionBaseUrl: null,
        privateTranscriptionMaxInflightJobs: 2,
        privateTranscriptionSnrThreshold: null,
    });
});

test("VoScript remote voiceprint delete confirmation stays above the settings shell", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let deleteCalls = 0;
    let remoteVoiceprints = [
        {
            createdAt: "2026-05-01T00:00:00.000Z",
            displayName: "Remote Voiceprint Pending Delete",
            id: "vp-delete-001",
            updatedAt: "2026-05-02T00:00:00.000Z",
        },
    ];

    await page.route("**/api/settings/voscript", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                privateTranscriptionApiKeySet: true,
                privateTranscriptionBaseUrl: "https://voscript.e2e.example",
                privateTranscriptionDenoiseModel: "none",
                privateTranscriptionMaxInflightJobs: 1,
                privateTranscriptionMaxSpeakers: 0,
                privateTranscriptionMinSpeakers: 0,
                privateTranscriptionNoRepeatNgramSize: 0,
                privateTranscriptionSnrThreshold: null,
            }),
        });
    });

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
                voiceprints: remoteVoiceprints,
            }),
        });
    });

    await page.route("**/api/voiceprints/vp-delete-001", async (route) => {
        if (route.request().method() !== "DELETE") {
            await route.continue();
            return;
        }

        deleteCalls += 1;
        remoteVoiceprints = [];
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    const shell = page.locator("[data-settings-shell]");
    const row = page.locator("[data-vs-profile-row]");
    await expect(shell).toHaveCSS("z-index", "600");
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "删除" }).click();

    const confirmDialog = page.getByRole("dialog", {
        name: "确认操作",
        exact: true,
    });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toHaveCSS("z-index", "710");
    await expect(page.locator('[data-slot="dialog-overlay"]').last()).toHaveCSS(
        "z-index",
        "700",
    );

    await confirmDialog.getByRole("button", { name: "取消" }).click();
    await expect(confirmDialog).not.toBeVisible();
    expect(deleteCalls).toBe(0);
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "删除" }).click();
    await page
        .getByRole("dialog", { name: "确认操作", exact: true })
        .getByRole("button", { name: "确认" })
        .click();

    await expect.poll(() => deleteCalls).toBe(1);
    await expect(page.locator("[data-vs-state]")).toHaveAttribute(
        "data-vs-state",
        "empty",
    );
    await expect(row).toHaveCount(0);
});

test("VoScript speaker profiles create, edit, delete, and rename remote voiceprints", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    const profilePosts: Record<string, unknown>[] = [];
    const profilePatches: Record<string, unknown>[] = [];
    let profileDeletes = 0;
    const voiceprintPatches: Record<string, unknown>[] = [];
    let releaseProfileCreate = () => {};
    let notifyProfileCreateStarted = () => {};
    const profileCreateStarted = new Promise<void>((resolve) => {
        notifyProfileCreateStarted = resolve;
    });
    const pendingProfileCreate = new Promise<void>((resolve) => {
        releaseProfileCreate = resolve;
    });
    let releaseProfilePatch = () => {};
    let notifyProfilePatchStarted = () => {};
    const profilePatchStarted = new Promise<void>((resolve) => {
        notifyProfilePatchStarted = resolve;
    });
    const pendingProfilePatch = new Promise<void>((resolve) => {
        releaseProfilePatch = resolve;
    });
    let releaseVoiceprintPatch = () => {};
    let notifyVoiceprintPatchStarted = () => {};
    const voiceprintPatchStarted = new Promise<void>((resolve) => {
        notifyVoiceprintPatchStarted = resolve;
    });
    const pendingVoiceprintPatch = new Promise<void>((resolve) => {
        releaseVoiceprintPatch = resolve;
    });

    let localProfiles = [
        {
            assignmentCount: 1,
            createdAt: "2026-05-01T00:00:00.000Z",
            displayName: "Speaker Pending Edit",
            id: "profile-edit-001",
            updatedAt: "2026-05-02T00:00:00.000Z",
            voiceprintRef: null,
        },
    ];
    let remoteVoiceprints = [
        {
            createdAt: "2026-05-01T00:00:00.000Z",
            displayName: "Voiceprint Pending Rename",
            id: "vp-rename-001",
            updatedAt: "2026-05-02T00:00:00.000Z",
        },
    ];

    await page.route("**/api/settings/voscript", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                privateTranscriptionApiKeySet: true,
                privateTranscriptionBaseUrl: "https://voscript.e2e.example",
                privateTranscriptionDenoiseModel: "none",
                privateTranscriptionMaxInflightJobs: 1,
                privateTranscriptionMaxSpeakers: 0,
                privateTranscriptionMinSpeakers: 0,
                privateTranscriptionNoRepeatNgramSize: 0,
                privateTranscriptionSnrThreshold: null,
            }),
        });
    });

    await page.route("**/api/speakers/profiles", async (route) => {
        if (route.request().method() === "POST") {
            const payload = route.request().postDataJSON();
            profilePosts.push(payload);
            notifyProfileCreateStarted();
            await pendingProfileCreate;
            localProfiles = [
                ...localProfiles,
                {
                    assignmentCount: 0,
                    createdAt: "2026-05-03T00:00:00.000Z",
                    displayName: String(payload.displayName),
                    id: "profile-created-001",
                    updatedAt: "2026-05-03T00:00:00.000Z",
                    voiceprintRef: null,
                },
            ];
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ profile: localProfiles.at(-1) }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ profiles: localProfiles }),
        });
    });

    await page.route(/\/api\/speakers\/profiles\/[^/]+$/, async (route) => {
        const profileId = route.request().url().split("/").pop() ?? "";
        if (route.request().method() === "PATCH") {
            const payload = route.request().postDataJSON();
            profilePatches.push(payload);
            notifyProfilePatchStarted();
            await pendingProfilePatch;
            localProfiles = localProfiles.map((profile) =>
                profile.id === profileId
                    ? {
                          ...profile,
                          displayName: String(payload.displayName),
                          updatedAt: "2026-05-04T00:00:00.000Z",
                      }
                    : profile,
            );
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({
                    profile: localProfiles.find(
                        (profile) => profile.id === profileId,
                    ),
                }),
            });
            return;
        }

        if (route.request().method() === "DELETE") {
            profileDeletes += 1;
            localProfiles = localProfiles.filter(
                (profile) => profile.id !== profileId,
            );
            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ success: true }),
            });
            return;
        }

        await route.continue();
    });

    await page.route("**/api/voiceprints", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                available: true,
                reason: null,
                voiceprints: remoteVoiceprints,
            }),
        });
    });

    await page.route("**/api/voiceprints/vp-rename-001", async (route) => {
        if (route.request().method() !== "PATCH") {
            await route.continue();
            return;
        }

        const payload = route.request().postDataJSON();
        voiceprintPatches.push(payload);
        notifyVoiceprintPatchStarted();
        await pendingVoiceprintPatch;
        remoteVoiceprints = remoteVoiceprints.map((voiceprint) => ({
            ...voiceprint,
            displayName: String(payload.displayName),
            updatedAt: "2026-05-04T00:00:00.000Z",
        }));
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ voiceprint: remoteVoiceprints[0] }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    const shell = page.locator("[data-settings-shell]");
    await expect(shell).toHaveAttribute(
        "data-settings-active-section",
        "voscript",
    );
    await expect(page.locator("[data-profiles-state]")).toHaveAttribute(
        "data-profiles-state",
        "ready",
    );
    await expect(page.locator("[data-vs-state]")).toHaveAttribute(
        "data-vs-state",
        "ready",
    );
    const speakerProfilesPanel = page.locator("[data-speaker-profiles-panel]");
    await expect(speakerProfilesPanel).toBeVisible();
    await expect(speakerProfilesPanel).toHaveClass(/glass-surface/);

    await page.getByTestId("speaker-profile-new-name").fill("Casey QA");
    const createResponse = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/speakers/profiles") &&
            response.request().method() === "POST" &&
            response.ok(),
    );
    await page.getByTestId("speaker-profile-create").click();
    await profileCreateStarted;
    await expect(page.getByTestId("speaker-profile-new-name")).toBeDisabled();
    await expect(page.getByTestId("speaker-profile-create")).toBeDisabled();
    await expect(page.getByTestId("speaker-profile-create")).toHaveAttribute(
        "aria-busy",
        "true",
    );
    releaseProfileCreate();
    await createResponse;
    expect(profilePosts).toEqual([{ displayName: "Casey QA" }]);
    await expect(
        page.locator('[data-speaker-profile-id="profile-created-001"]'),
    ).toBeVisible();
    await expect(page.getByTestId("speaker-profile-new-name")).toBeEnabled();
    await expect(page.getByTestId("speaker-profile-new-name")).toHaveValue("");

    const editedProfileRow = page.locator(
        '[data-speaker-profile-id="profile-edit-001"]',
    );
    const editedProfileInitial = editedProfileRow.getByTestId(
        "speaker-profile-initial",
    );
    await expect(editedProfileInitial).toBeVisible();
    await expect(editedProfileInitial).toHaveClass(/bg-muted\/35/);
    await expect(editedProfileInitial).not.toHaveClass(/bg-background\/60/);
    await editedProfileRow
        .getByTestId("speaker-profile-name")
        .fill("Speaker Renamed");
    const profilePatchResponse = page.waitForResponse(
        (response) =>
            response
                .url()
                .endsWith("/api/speakers/profiles/profile-edit-001") &&
            response.request().method() === "PATCH" &&
            response.ok(),
    );
    await editedProfileRow.getByTestId("speaker-profile-save").click();
    await profilePatchStarted;
    await expect(editedProfileRow).toHaveAttribute(
        "data-speaker-profile-busy",
        "true",
    );
    await expect(editedProfileRow.getByTestId("speaker-profile-name")).toBeDisabled();
    await expect(editedProfileRow.getByTestId("speaker-profile-save")).toBeDisabled();
    await expect(editedProfileRow.getByTestId("speaker-profile-save")).toHaveAttribute(
        "aria-busy",
        "true",
    );
    await expect(
        editedProfileRow.getByTestId("speaker-profile-delete"),
    ).toBeDisabled();
    releaseProfilePatch();
    await profilePatchResponse;
    expect(profilePatches.at(-1)).toEqual({ displayName: "Speaker Renamed" });
    await expect(editedProfileRow).toHaveAttribute(
        "data-speaker-profile-busy",
        "false",
    );
    await expect(editedProfileRow.getByTestId("speaker-profile-name")).toBeEnabled();
    await expect(editedProfileRow.getByTestId("speaker-profile-name")).toHaveValue(
        "Speaker Renamed",
    );

    await editedProfileRow.getByTestId("speaker-profile-delete").click();
    const confirmDialog = page.getByRole("dialog", {
        name: "确认操作",
        exact: true,
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "取消" }).click();
    await expect(confirmDialog).not.toBeVisible();
    expect(profileDeletes).toBe(0);
    await expect(editedProfileRow).toBeVisible();

    await editedProfileRow.getByTestId("speaker-profile-delete").click();
    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().endsWith(
                    "/api/speakers/profiles/profile-edit-001",
                ) &&
                response.request().method() === "DELETE" &&
                response.ok(),
        ),
        page
            .getByRole("dialog", { name: "确认操作", exact: true })
            .getByRole("button", { name: "确认" })
            .click(),
    ]);
    expect(profileDeletes).toBe(1);
    await expect(editedProfileRow).toHaveCount(0);

    const voiceprintRow = page.locator('[data-vs-profile-id="vp-rename-001"]');
    const voiceprintInitial = voiceprintRow.getByTestId("voiceprint-initial");
    await expect(voiceprintInitial).toBeVisible();
    await expect(voiceprintInitial).toHaveClass(/bg-muted\/35/);
    await expect(voiceprintInitial).not.toHaveClass(/bg-background\/60/);
    await voiceprintRow
        .getByTestId("voiceprint-name")
        .fill("Voiceprint Renamed");
    const voiceprintPatchResponse = page.waitForResponse(
        (response) =>
            response.url().endsWith("/api/voiceprints/vp-rename-001") &&
            response.request().method() === "PATCH" &&
            response.ok(),
    );
    await voiceprintRow.getByTestId("voiceprint-rename").click();
    await voiceprintPatchStarted;
    await expect(voiceprintRow).toHaveAttribute(
        "data-vs-profile-busy",
        "true",
    );
    await expect(voiceprintRow.getByTestId("voiceprint-name")).toBeDisabled();
    await expect(voiceprintRow.getByTestId("voiceprint-rename")).toBeDisabled();
    await expect(voiceprintRow.getByTestId("voiceprint-rename")).toHaveAttribute(
        "aria-busy",
        "true",
    );
    await expect(voiceprintRow.getByTestId("voiceprint-delete")).toBeDisabled();
    releaseVoiceprintPatch();
    await voiceprintPatchResponse;
    expect(voiceprintPatches.at(-1)).toEqual({
        displayName: "Voiceprint Renamed",
    });
    await expect(voiceprintRow).toHaveAttribute(
        "data-vs-profile-busy",
        "false",
    );
    await expect(voiceprintRow.getByTestId("voiceprint-name")).toBeEnabled();
    await expect(voiceprintRow.getByTestId("voiceprint-name")).toHaveValue(
        "Voiceprint Renamed",
    );

    await page.mouse.wheel(0, 1200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("VoScript speaker profile panels recover from load errors", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });

    let profileGets = 0;
    let voiceprintGets = 0;

    await page.route("**/api/settings/voscript", async (route) => {
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                privateTranscriptionApiKeySet: true,
                privateTranscriptionBaseUrl: "https://voscript.e2e.example",
                privateTranscriptionDenoiseModel: "none",
                privateTranscriptionMaxInflightJobs: 1,
                privateTranscriptionMaxSpeakers: 0,
                privateTranscriptionMinSpeakers: 0,
                privateTranscriptionNoRepeatNgramSize: 0,
                privateTranscriptionSnrThreshold: null,
            }),
        });
    });

    await page.route("**/api/speakers/profiles", async (route) => {
        profileGets += 1;
        if (profileGets === 1) {
            await route.fulfill({
                contentType: "application/json",
                status: 500,
                body: JSON.stringify({ error: "Profiles temporarily down" }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                profiles: [
                    {
                        assignmentCount: 0,
                        createdAt: "2026-05-01T00:00:00.000Z",
                        displayName: "Recovered Speaker",
                        id: "profile-recovered-001",
                        updatedAt: "2026-05-01T00:00:00.000Z",
                        voiceprintRef: null,
                    },
                ],
            }),
        });
    });

    await page.route("**/api/voiceprints", async (route) => {
        voiceprintGets += 1;
        if (voiceprintGets === 1) {
            await route.fulfill({
                contentType: "application/json",
                status: 502,
                body: JSON.stringify({ error: "Voiceprints temporarily down" }),
            });
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                available: true,
                reason: null,
                voiceprints: [
                    {
                        createdAt: "2026-05-01T00:00:00.000Z",
                        displayName: "Recovered Voiceprint",
                        id: "vp-recovered-001",
                        updatedAt: "2026-05-01T00:00:00.000Z",
                    },
                ],
            }),
        });
    });

    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#voscript", { waitUntil: "domcontentloaded" });

    await expect(page.locator("[data-profiles-state]")).toHaveAttribute(
        "data-profiles-state",
        "error",
    );
    await expect(page.locator("[data-vs-state]")).toHaveAttribute(
        "data-vs-state",
        "error",
    );

    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().endsWith("/api/speakers/profiles") &&
                response.request().method() === "GET" &&
                response.ok(),
        ),
        page.getByTestId("speaker-profiles-refresh").click(),
    ]);
    await expect(page.locator("[data-profiles-state]")).toHaveAttribute(
        "data-profiles-state",
        "ready",
    );
    await expect(
        page.locator('[data-speaker-profile-id="profile-recovered-001"]'),
    ).toBeVisible();

    await Promise.all([
        page.waitForResponse(
            (response) =>
                response.url().endsWith("/api/voiceprints") &&
                response.request().method() === "GET" &&
                response.ok(),
        ),
        page.getByTestId("voiceprints-refresh").click(),
    ]);
    await expect(page.locator("[data-vs-state]")).toHaveAttribute(
        "data-vs-state",
        "ready",
    );
    await expect(
        page.locator('[data-vs-profile-id="vp-recovered-001"]'),
    ).toBeVisible();
});
