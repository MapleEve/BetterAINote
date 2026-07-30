import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn, putJsonWithRetry } from "./helpers/auth";

type VoScriptRuntimeParams = {
    privateTranscriptionDenoiseModel: "none" | "deepfilternet" | "noisereduce";
    privateTranscriptionMaxInflightJobs: number;
    privateTranscriptionMaxSpeakers: number;
    privateTranscriptionMinSpeakers: number;
    privateTranscriptionNoRepeatNgramSize: number;
    privateTranscriptionSnrThreshold: number | null;
};

type VoScriptSettings = VoScriptRuntimeParams & {
    privateTranscriptionApiKeySet: boolean;
    privateTranscriptionBaseUrl: string | null;
};

const VOSCRIPT_SETTINGS_ENDPOINT = "/api/settings/voscript";

function runtimeParams(settings: VoScriptSettings): VoScriptRuntimeParams {
    return {
        privateTranscriptionDenoiseModel:
            settings.privateTranscriptionDenoiseModel,
        privateTranscriptionMaxInflightJobs:
            settings.privateTranscriptionMaxInflightJobs,
        privateTranscriptionMaxSpeakers:
            settings.privateTranscriptionMaxSpeakers,
        privateTranscriptionMinSpeakers:
            settings.privateTranscriptionMinSpeakers,
        privateTranscriptionNoRepeatNgramSize:
            settings.privateTranscriptionNoRepeatNgramSize,
        privateTranscriptionSnrThreshold:
            settings.privateTranscriptionSnrThreshold,
    };
}

function runtimeTarget(
    baseline: VoScriptRuntimeParams,
): VoScriptRuntimeParams {
    const primaryTarget = {
        privateTranscriptionMaxSpeakers: 2,
        privateTranscriptionMinSpeakers: 1,
        privateTranscriptionNoRepeatNgramSize: 3,
    };
    const primaryMatchesBaseline =
        baseline.privateTranscriptionMaxSpeakers ===
            primaryTarget.privateTranscriptionMaxSpeakers &&
        baseline.privateTranscriptionMinSpeakers ===
            primaryTarget.privateTranscriptionMinSpeakers &&
        baseline.privateTranscriptionNoRepeatNgramSize ===
            primaryTarget.privateTranscriptionNoRepeatNgramSize;

    return {
        ...baseline,
        ...(primaryMatchesBaseline
            ? {
                  privateTranscriptionMaxSpeakers: 3,
                  privateTranscriptionMinSpeakers: 2,
                  privateTranscriptionNoRepeatNgramSize: 4,
              }
            : primaryTarget),
    };
}

async function getVoScriptSettings(page: Page): Promise<VoScriptSettings> {
    const response = await page.request.get(VOSCRIPT_SETTINGS_ENDPOINT);
    expect(response.ok()).toBe(true);

    return (await response.json()) as VoScriptSettings;
}

function voscriptSection(page: Page) {
    return page.getByRole("region", {
        name: /^(VoScript 服务|VoScript Service)$/,
    });
}

function paramsSaveButton(page: Page) {
    return voscriptSection(page)
        .getByRole("region", {
            name: /^(转录运行参数|Transcription Runtime Parameters)$/,
        })
        .getByRole("button", {
            name: /^(保存转录运行参数|转录运行参数保存中|转录运行参数已保存|Save transcription runtime parameters|Saving transcription runtime parameters|transcription runtime parameters saved)$/i,
        });
}

async function startBusyToIdleObservation(page: Page) {
    await voscriptSection(page).evaluate((section) => {
        const observationKey = "__voscriptRuntimeSaveTransition";
        let sawBusy = false;
        const transition = new Promise<boolean>((resolve, reject) => {
            let timeout: number;
            const observer = new MutationObserver(() => {
                const isBusy = section.getAttribute("aria-busy") === "true";
                if (isBusy) {
                    sawBusy = true;
                    return;
                }

                if (
                    sawBusy &&
                    section.getAttribute("aria-busy") === "false"
                ) {
                    window.clearTimeout(timeout);
                    observer.disconnect();
                    resolve(true);
                }
            });
            timeout = window.setTimeout(() => {
                observer.disconnect();
                reject(
                    new Error(
                        "VoScript runtime parameter save did not transition busy to idle",
                    ),
                );
            }, 10_000);

            observer.observe(section, {
                attributeFilter: ["aria-busy"],
                attributes: true,
            });
        });

        Reflect.set(window, observationKey, transition);
    });
}

async function waitForBusyToIdleObservation(page: Page) {
    return page.evaluate(async () => {
        const transition = Reflect.get(
            window,
            "__voscriptRuntimeSaveTransition",
        ) as Promise<boolean> | undefined;

        if (!transition) {
            throw new Error("VoScript runtime save observation was not started");
        }

        return transition;
    });
}

test("VoScript runtime params persist through real API readback and reload", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1180, height: 680 });
    await ensureSignedIn(page);

    const baselineSettings = await getVoScriptSettings(page);
    const baselineRuntimeParams = runtimeParams(baselineSettings);
    const targetRuntimeParams = runtimeTarget(baselineRuntimeParams);

    try {
        await page.goto("/settings#voscript", {
            waitUntil: "domcontentloaded",
        });

        const section = voscriptSection(page);
        const saveButton = paramsSaveButton(page);
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expect(saveButton).toBeVisible();
        await expect(saveButton).toBeEnabled();

        await section
            .getByRole("spinbutton", {
                name: /^(最少说话人数|Minimum speakers)$/,
            })
            .fill(String(targetRuntimeParams.privateTranscriptionMinSpeakers));
        await section
            .getByRole("spinbutton", {
                name: /^(最多说话人数|Maximum speakers)$/,
            })
            .fill(String(targetRuntimeParams.privateTranscriptionMaxSpeakers));
        await section
            .getByRole("spinbutton", {
                name: /^(重复抑制 n-gram|No-repeat n-gram)$/,
            })
            .fill(
                String(targetRuntimeParams.privateTranscriptionNoRepeatNgramSize),
            );

        const putRequest = page.waitForRequest(
            (request) =>
                request.url().endsWith(VOSCRIPT_SETTINGS_ENDPOINT) &&
                request.method() === "PUT",
        );
        const putResponse = page.waitForResponse(
            (response) =>
                response.url().endsWith(VOSCRIPT_SETTINGS_ENDPOINT) &&
                response.request().method() === "PUT" &&
                response.ok(),
        );
        await startBusyToIdleObservation(page);
        await saveButton.click();

        const [request, response, transitioned] = await Promise.all([
            putRequest,
            putResponse,
            waitForBusyToIdleObservation(page),
        ]);
        expect(transitioned).toBe(true);
        expect(request.postDataJSON()).toEqual(targetRuntimeParams);
        expect(request.postDataJSON()).not.toHaveProperty(
            "privateTranscriptionApiKey",
        );
        expect(request.postDataJSON()).not.toHaveProperty(
            "privateTranscriptionBaseUrl",
        );
        expect(await response.json()).toEqual({ success: true });
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expect(saveButton).toHaveAccessibleName(
            /^(转录运行参数已保存|transcription runtime parameters saved)$/i,
        );

        const apiReadback = await getVoScriptSettings(page);
        expect(runtimeParams(apiReadback)).toEqual(targetRuntimeParams);
        expect(apiReadback.privateTranscriptionApiKeySet).toBe(
            baselineSettings.privateTranscriptionApiKeySet,
        );
        expect(apiReadback.privateTranscriptionBaseUrl).toBe(
            baselineSettings.privateTranscriptionBaseUrl,
        );

        const reloadSettingsGet = page.waitForResponse(
            (response) =>
                response.url().endsWith(VOSCRIPT_SETTINGS_ENDPOINT) &&
                response.request().method() === "GET" &&
                response.ok(),
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await reloadSettingsGet;
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expect(
            section.getByRole("spinbutton", {
                name: /^(最少说话人数|Minimum speakers)$/,
            }),
        ).toHaveValue(String(targetRuntimeParams.privateTranscriptionMinSpeakers));
        await expect(
            section.getByRole("spinbutton", {
                name: /^(最多说话人数|Maximum speakers)$/,
            }),
        ).toHaveValue(String(targetRuntimeParams.privateTranscriptionMaxSpeakers));
        await expect(
            section.getByRole("spinbutton", {
                name: /^(重复抑制 n-gram|No-repeat n-gram)$/,
            }),
        ).toHaveValue(
            String(targetRuntimeParams.privateTranscriptionNoRepeatNgramSize),
        );
    } finally {
        const restoreResponse = await putJsonWithRetry(
            page,
            VOSCRIPT_SETTINGS_ENDPOINT,
            baselineRuntimeParams,
        );
        expect(restoreResponse.ok()).toBe(true);
        expect(runtimeParams(await getVoScriptSettings(page))).toEqual(
            baselineRuntimeParams,
        );
    }
});
