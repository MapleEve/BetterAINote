import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const TITLE_GENERATION_ENDPOINT = "/api/settings/title-generation";

type TitleGenerationSettingsReadback = {
    autoGenerateTitle: boolean;
    titleGenerationApiKeySet: boolean;
    titleGenerationBaseUrl: string | null;
    titleGenerationModel: string | null;
    titleGenerationPrompt: string | null;
};

function titleGenerationSection(page: Page) {
    return page.locator(
        '[data-sot-surface="settings-section"][data-sot-section="title-generation"]',
    );
}

function isTitleGenerationSettingsReadback(
    payload: unknown,
): payload is TitleGenerationSettingsReadback {
    if (typeof payload !== "object" || payload === null) {
        return false;
    }

    const settings = payload as Record<string, unknown>;
    return (
        typeof settings.autoGenerateTitle === "boolean" &&
        typeof settings.titleGenerationApiKeySet === "boolean" &&
        (typeof settings.titleGenerationBaseUrl === "string" ||
            settings.titleGenerationBaseUrl === null) &&
        (typeof settings.titleGenerationModel === "string" ||
            settings.titleGenerationModel === null) &&
        (typeof settings.titleGenerationPrompt === "string" ||
            settings.titleGenerationPrompt === null)
    );
}

async function readTitleGenerationSettings(page: Page) {
    const response = await page.request.get(TITLE_GENERATION_ENDPOINT);
    expect(response.ok()).toBe(true);

    const payload: unknown = await response.json();
    if (!isTitleGenerationSettingsReadback(payload)) {
        throw new Error("Title generation settings API returned an invalid payload.");
    }

    return payload;
}

async function expectAutoGenerateTitle(
    page: Page,
    autoGenerateTitle: boolean,
) {
    const control = titleGenerationSection(page).locator(
        '[data-sot-control="title-generation-enabled"]',
    );

    await expect(control).toHaveAttribute(
        "aria-checked",
        autoGenerateTitle ? "true" : "false",
    );
    await expect(control).toHaveAttribute(
        "data-sot-state",
        autoGenerateTitle ? "checked" : "unchecked",
    );
}

test("title generation save persists a visible setting through API readback and reload", async ({
    page,
}) => {
    await ensureSignedIn(page);

    const originalSettings = await readTitleGenerationSettings(page);
    const savedAutoGenerateTitle = !originalSettings.autoGenerateTitle;
    let primaryFlowError: unknown;

    try {
        await page.goto("/settings#title-generation", {
            waitUntil: "domcontentloaded",
        });

        const section = titleGenerationSection(page);
        const toggle = section.locator(
            '[data-sot-control="title-generation-enabled"]',
        );
        const savePanel = section.locator(
            '[data-sot-panel="settings-save-actions"][data-sot-save-id="title-generation"]',
        );
        const saveButton = savePanel.locator(
            '[data-sot-control="settings-save"]',
        );

        await expect(section).toHaveAttribute("data-sot-state", "ready");
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expectAutoGenerateTitle(page, originalSettings.autoGenerateTitle);
        await expect(savePanel).toHaveAttribute("data-sot-state", "idle");
        await expect(saveButton).toHaveAttribute("data-sot-state", "idle");

        await toggle.click();
        await expectAutoGenerateTitle(page, savedAutoGenerateTitle);

        const saveResponse = page.waitForResponse((response) => {
            if (
                new URL(response.url()).pathname !== TITLE_GENERATION_ENDPOINT ||
                response.request().method() !== "PUT" ||
                !response.ok()
            ) {
                return false;
            }

            const payload = response.request().postDataJSON();
            return (
                typeof payload === "object" &&
                payload !== null &&
                (payload as Record<string, unknown>).autoGenerateTitle ===
                    savedAutoGenerateTitle
            );
        });
        await saveButton.click();

        const response = await saveResponse;
        expect(await response.json()).toEqual({ success: true });
        expect(response.request().postDataJSON()).toMatchObject({
            autoGenerateTitle: savedAutoGenerateTitle,
        });
        await expect(savePanel).toHaveAttribute("data-sot-state", "saved");
        await expect(saveButton).toHaveAttribute("data-sot-state", "saved");
        await expect(savePanel).toHaveAttribute("data-sot-state", "idle");
        await expect(saveButton).toHaveAttribute("data-sot-state", "idle");

        const readback = await readTitleGenerationSettings(page);
        expect(readback.autoGenerateTitle).toBe(savedAutoGenerateTitle);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(section).toHaveAttribute("data-sot-state", "ready");
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expectAutoGenerateTitle(page, savedAutoGenerateTitle);
        await expect(savePanel).toHaveAttribute("data-sot-state", "idle");
        await expect(saveButton).toHaveAttribute("data-sot-state", "idle");
    } catch (error) {
        primaryFlowError = error;
        throw error;
    } finally {
        try {
            const restoreResponse = await page.request.put(
                TITLE_GENERATION_ENDPOINT,
                {
                    data: {
                        autoGenerateTitle: originalSettings.autoGenerateTitle,
                    },
                },
            );
            expect(restoreResponse.ok()).toBe(true);
            expect(
                (await readTitleGenerationSettings(page)).autoGenerateTitle,
            ).toBe(originalSettings.autoGenerateTitle);
        } catch (cleanupError) {
            if (primaryFlowError) {
                throw new AggregateError(
                    [primaryFlowError, cleanupError],
                    "Title generation settings test and cleanup both failed.",
                );
            }

            throw cleanupError;
        }
    }
});
