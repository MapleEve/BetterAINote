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

    await expect(page.locator("[data-speaker-profile-row]")).toBeVisible();
    await expect(page.locator("[data-vs-profile-row]")).toBeVisible();
    const profileBox = await page
        .locator("[data-speaker-profile-row]")
        .first()
        .boundingBox();
    expect(profileBox?.width ?? 0).toBeGreaterThan(520);
    expect(profileBox?.height ?? 0).toBeLessThan(180);

    await page.locator("#private-transcription-api-key").fill("typed-e2e-key");
    await page.getByTestId("voscript-test-connection").click();
    await connectionTestStarted;
    await expect(section).toHaveAttribute(
        "data-voscript-test-state",
        "testing",
    );

    releaseConnectionTest();
    await expect(section).toHaveAttribute(
        "data-voscript-test-state",
        "success",
    );
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
