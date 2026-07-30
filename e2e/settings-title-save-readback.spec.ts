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
    return page.getByRole("region", {
        name: /^(AI 重命名服务|AI Rename Service)$/,
    });
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
    const control = titleGenerationSection(page).getByRole("switch", {
        name: /^(基于逐字稿自动重命名|Automatically rename from transcripts)$/,
    });

    await expect(control).toHaveAttribute(
        "aria-checked",
        autoGenerateTitle ? "true" : "false",
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
        const toggle = section.getByRole("switch", {
            name: /^(基于逐字稿自动重命名|Automatically rename from transcripts)$/,
        });
        const saveButton = section.getByRole("button", {
            name: /^(保存|保存中|已保存|Save|Saving|Saved)$/,
        });

        await expect(section).toHaveAttribute("aria-busy", "false");
        await expectAutoGenerateTitle(page, originalSettings.autoGenerateTitle);
        await expect(saveButton).toHaveAccessibleName(/^(保存|Save)$/);

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
        await expect(saveButton).toHaveAccessibleName(/^(已保存|Saved)$/);
        await expect(saveButton).toHaveAccessibleName(/^(保存|Save)$/, {
            timeout: 4_000,
        });

        const readback = await readTitleGenerationSettings(page);
        expect(readback.autoGenerateTitle).toBe(savedAutoGenerateTitle);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expectAutoGenerateTitle(page, savedAutoGenerateTitle);
        await expect(saveButton).toHaveAccessibleName(/^(保存|Save)$/);
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
