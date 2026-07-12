import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const TRANSCRIPTION_SETTINGS_ENDPOINT = "/api/settings/transcription";

type TranscriptionSettingsReadback = {
    autoTranscribe: boolean;
    defaultTranscriptionLanguage: string | null;
};

function transcriptionSection(page: Page) {
    return page.locator(
        '[data-sot-surface="settings-section"][data-sot-section="transcription"]',
    );
}

function isTranscriptionSettingsReadback(
    payload: unknown,
): payload is TranscriptionSettingsReadback {
    if (typeof payload !== "object" || payload === null) {
        return false;
    }

    const settings = payload as Record<string, unknown>;
    return (
        typeof settings.autoTranscribe === "boolean" &&
        (typeof settings.defaultTranscriptionLanguage === "string" ||
            settings.defaultTranscriptionLanguage === null)
    );
}

async function readTranscriptionSettings(page: Page) {
    const response = await page.request.get(TRANSCRIPTION_SETTINGS_ENDPOINT);
    expect(response.ok()).toBe(true);

    const payload: unknown = await response.json();
    if (!isTranscriptionSettingsReadback(payload)) {
        throw new Error("Transcription settings API returned an invalid payload.");
    }

    return payload;
}

async function expectAutoTranscribe(page: Page, autoTranscribe: boolean) {
    const control = transcriptionSection(page).locator(
        '#transcription-auto-transcribe[data-sot-control="transcription-auto-transcribe"]',
    );

    await expect(control).toHaveAttribute(
        "aria-checked",
        autoTranscribe ? "true" : "false",
    );
    await expect(control).toHaveAttribute(
        "data-sot-state",
        autoTranscribe ? "checked" : "unchecked",
    );
}

test("transcription auto-transcribe persists through real API readback and reload", async ({
    page,
}) => {
    await ensureSignedIn(page);

    const originalSettings = await readTranscriptionSettings(page);
    const savedAutoTranscribe = !originalSettings.autoTranscribe;
    let primaryFlowError: unknown;
    let releaseSave: (() => void) | undefined;
    let markSaveStarted: (() => void) | undefined;
    const saveStarted = new Promise<void>((resolve) => {
        markSaveStarted = resolve;
    });

    await page.route("**/api/settings/transcription", async (route) => {
        if (route.request().method() === "PUT") {
            const payload = route.request().postDataJSON();
            if (
                typeof payload === "object" &&
                payload !== null &&
                (payload as Record<string, unknown>).autoTranscribe ===
                    savedAutoTranscribe
            ) {
                markSaveStarted?.();
                await new Promise<void>((resolve) => {
                    releaseSave = resolve;
                });
            }
        }

        await route.continue();
    });

    try {
        await page.goto("/settings#transcription", {
            waitUntil: "domcontentloaded",
        });

        const section = transcriptionSection(page);
        const toggle = section.locator(
            '#transcription-auto-transcribe[data-sot-control="transcription-auto-transcribe"]',
        );

        await expect(section).toHaveAttribute("data-sot-state", "ready");
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expect(toggle).toBeVisible();
        await expectAutoTranscribe(page, originalSettings.autoTranscribe);

        const saveResponse = page.waitForResponse((response) => {
            if (
                new URL(response.url()).pathname !==
                    TRANSCRIPTION_SETTINGS_ENDPOINT ||
                response.request().method() !== "PUT" ||
                !response.ok()
            ) {
                return false;
            }

            const payload = response.request().postDataJSON();
            return (
                typeof payload === "object" &&
                payload !== null &&
                (payload as Record<string, unknown>).autoTranscribe ===
                    savedAutoTranscribe
            );
        });

        await toggle.click();
        await saveStarted;
        await expect(section).toHaveAttribute("data-sot-state", "busy");
        await expect(section).toHaveAttribute("aria-busy", "true");
        await expect(toggle).toBeDisabled();

        releaseSave?.();
        const response = await saveResponse;
        expect(await response.json()).toEqual({ success: true });
        expect(response.request().postDataJSON()).toEqual({
            autoTranscribe: savedAutoTranscribe,
        });

        await expect(section).toHaveAttribute("data-sot-state", "ready");
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expectAutoTranscribe(page, savedAutoTranscribe);

        const readback = await readTranscriptionSettings(page);
        expect(readback.autoTranscribe).toBe(savedAutoTranscribe);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(transcriptionSection(page)).toHaveAttribute(
            "data-sot-state",
            "ready",
        );
        await expect(transcriptionSection(page)).toHaveAttribute(
            "aria-busy",
            "false",
        );
        await expectAutoTranscribe(page, savedAutoTranscribe);
    } catch (error) {
        primaryFlowError = error;
        throw error;
    } finally {
        releaseSave?.();
        await page.unroute("**/api/settings/transcription");

        try {
            const restoreResponse = await page.request.put(
                TRANSCRIPTION_SETTINGS_ENDPOINT,
                {
                    data: {
                        autoTranscribe: originalSettings.autoTranscribe,
                    },
                },
            );
            expect(restoreResponse.ok()).toBe(true);
            expect(
                (await readTranscriptionSettings(page)).autoTranscribe,
            ).toBe(originalSettings.autoTranscribe);
        } catch (cleanupError) {
            if (primaryFlowError) {
                throw new AggregateError(
                    [primaryFlowError, cleanupError],
                    "Transcription settings test and cleanup both failed.",
                );
            }

            throw cleanupError;
        }
    }
});
