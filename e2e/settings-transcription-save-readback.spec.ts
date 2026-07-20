import { createCipheriv, randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const TRANSCRIPTION_SETTINGS_ENDPOINT = "/api/settings/transcription";
const DEFAULT_TRANSCRIPTION_PROVIDER = "dingtalk-a1";
const E2E_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

type TranscriptionSettingsReadback = {
    autoTranscribe: boolean;
    defaultTranscriptionLanguage: string | null;
    defaultTranscriptionProvider:
        | "dingtalk-a1"
        | "ticnote"
        | "feishu-minutes"
        | null;
};

function transcriptionSection(page: Page) {
    return page
        .getByRole("heading", {
            name: /^(Transcription Settings|转录设置)$/,
        })
        .locator("..");
}

function getE2EDatabaseUrl() {
    const e2eRoot = path.resolve(
        process.env.PLAYWRIGHT_E2E_ROOT ?? path.join(process.cwd(), "tmp/e2e"),
    );
    const databasePath = path.resolve(
        process.env.DATABASE_PATH ??
            path.join(e2eRoot, "data", "betterainote-e2e.db"),
    );
    const dataDirectory = path.join(e2eRoot, "data");
    const relativeDatabasePath = path.relative(dataDirectory, databasePath);

    if (
        relativeDatabasePath.length === 0 ||
        relativeDatabasePath === ".." ||
        relativeDatabasePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeDatabasePath)
    ) {
        throw new Error(`Refusing to seed a non-E2E database: ${databasePath}`);
    }

    return pathToFileURL(databasePath).href;
}

function encryptE2EFixtureSecret(plaintext: string) {
    const iv = randomBytes(16);
    const cipher = createCipheriv(
        "aes-256-gcm",
        Buffer.from(E2E_ENCRYPTION_KEY, "hex"),
        iv,
    );
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);

    return [
        iv.toString("hex"),
        cipher.getAuthTag().toString("hex"),
        ciphertext.toString("hex"),
    ].join(":");
}

async function seedDefaultTranscriptionProviderConnection() {
    const client = createClient({ url: getE2EDatabaseUrl() });
    const now = Date.now();

    try {
        const userResult = await client.execute({
            sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
            args: ["playwright-admin@example.com"],
        });
        const userId = userResult.rows[0]?.id;
        if (typeof userId !== "string") {
            throw new Error("Playwright E2E user was not created.");
        }

        await client.batch(
            [
                {
                    sql: "DELETE FROM source_connections WHERE user_id = ? AND provider = ?",
                    args: [userId, DEFAULT_TRANSCRIPTION_PROVIDER],
                },
                {
                    sql: `INSERT INTO source_connections (
                            id, user_id, provider, enabled, auth_mode, base_url,
                            config, secret_config, last_sync, sync_status,
                            last_sync_error, last_sync_started_at,
                            last_sync_finished_at, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        `e2e-default-transcription-provider-${now}`,
                        userId,
                        DEFAULT_TRANSCRIPTION_PROVIDER,
                        1,
                        "device-signin",
                        "https://meeting-ai-tingji.dingtalk.com",
                        "{}",
                        encryptE2EFixtureSecret(
                            JSON.stringify({
                                deviceCredential:
                                    "e2e-default-transcription-provider-fixture",
                            }),
                        ),
                        null,
                        "idle",
                        null,
                        null,
                        null,
                        now,
                        now,
                    ],
                },
            ],
            "write",
        );
    } finally {
        await client.close();
    }
}

async function clearDefaultTranscriptionProviderConnection() {
    const client = createClient({ url: getE2EDatabaseUrl() });

    try {
        await client.execute({
            sql: `DELETE FROM source_connections
                  WHERE user_id = (SELECT id FROM users WHERE email = ? LIMIT 1)
                    AND provider = ?`,
            args: ["playwright-admin@example.com", DEFAULT_TRANSCRIPTION_PROVIDER],
        });
    } finally {
        await client.close();
    }
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
            settings.defaultTranscriptionLanguage === null) &&
        (settings.defaultTranscriptionProvider === "dingtalk-a1" ||
            settings.defaultTranscriptionProvider === "ticnote" ||
            settings.defaultTranscriptionProvider === "feishu-minutes" ||
            settings.defaultTranscriptionProvider === null)
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
    const control = transcriptionSection(page).getByRole("switch");

    await expect(control).toHaveAttribute(
        "aria-checked",
        autoTranscribe ? "true" : "false",
    );
    await expect(control).toHaveAttribute(
        "data-state",
        autoTranscribe ? "checked" : "unchecked",
    );
}

test("transcription auto-transcribe persists through real API readback and reload", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await seedDefaultTranscriptionProviderConnection();

    const originalSettings = await readTranscriptionSettings(page);
    const savedAutoTranscribe = !originalSettings.autoTranscribe;
    const savedDefaultTranscriptionProvider = DEFAULT_TRANSCRIPTION_PROVIDER;
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
        const toggle = section.getByRole("switch");

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
        await expect(section).toHaveAttribute("aria-busy", "true");
        await expect(toggle).toBeDisabled();

        releaseSave?.();
        const response = await saveResponse;
        expect(await response.json()).toEqual({ success: true });
        expect(response.request().postDataJSON()).toEqual({
            autoTranscribe: savedAutoTranscribe,
        });

        await expect(section).toHaveAttribute("aria-busy", "false");
        await expectAutoTranscribe(page, savedAutoTranscribe);

        const readback = await readTranscriptionSettings(page);
        expect(readback.autoTranscribe).toBe(savedAutoTranscribe);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(transcriptionSection(page)).toHaveAttribute(
            "aria-busy",
            "false",
        );
        await expectAutoTranscribe(page, savedAutoTranscribe);

        const providerSaveResponse = await page.request.put(
            TRANSCRIPTION_SETTINGS_ENDPOINT,
            {
                data: {
                    defaultTranscriptionProvider:
                        savedDefaultTranscriptionProvider,
                },
            },
        );
        expect(providerSaveResponse.ok()).toBe(true);
        expect(await providerSaveResponse.json()).toEqual({ success: true });
        expect(
            (await readTranscriptionSettings(page))
                .defaultTranscriptionProvider,
        ).toBe(savedDefaultTranscriptionProvider);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(transcriptionSection(page)).toHaveAttribute(
            "aria-busy",
            "false",
        );
        await expectAutoTranscribe(page, savedAutoTranscribe);
        expect(
            (await readTranscriptionSettings(page))
                .defaultTranscriptionProvider,
        ).toBe(savedDefaultTranscriptionProvider);

        const providerClearResponse = await page.request.put(
            TRANSCRIPTION_SETTINGS_ENDPOINT,
            {
                data: { defaultTranscriptionProvider: null },
            },
        );
        expect(providerClearResponse.ok()).toBe(true);
        expect(await providerClearResponse.json()).toEqual({ success: true });
        expect(
            (await readTranscriptionSettings(page))
                .defaultTranscriptionProvider,
        ).toBeNull();
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
                        defaultTranscriptionLanguage:
                            originalSettings.defaultTranscriptionLanguage,
                        defaultTranscriptionProvider:
                            originalSettings.defaultTranscriptionProvider,
                    },
                },
            );
            expect(restoreResponse.ok()).toBe(true);
            expect(
                (await readTranscriptionSettings(page)).autoTranscribe,
            ).toBe(originalSettings.autoTranscribe);
            expect(
                (await readTranscriptionSettings(page))
                    .defaultTranscriptionProvider,
            ).toBe(originalSettings.defaultTranscriptionProvider);
        } catch (cleanupError) {
            if (primaryFlowError) {
                throw new AggregateError(
                    [primaryFlowError, cleanupError],
                    "Transcription settings test and cleanup both failed.",
                );
            }

            throw cleanupError;
        } finally {
            await clearDefaultTranscriptionProviderConnection();
        }
    }
});
