import { createServer, type ServerResponse } from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { ensureSignedIn } from "./helpers/auth";

const VOSCRIPT_SETTINGS_ENDPOINT = "/api/settings/voscript";
const VOSCRIPT_TEST_ENDPOINT = "/api/settings/voscript/test";
const LOCAL_FIXTURE_API_KEY = "e2e-local-voscript-connection-key";

type VoScriptSettings = {
    privateTranscriptionBaseUrl: string | null;
};

type FixtureRequest = {
    apiKey: string;
    authorization: string;
    method: string;
    pathname: string;
    response: ServerResponse;
};

type LocalVoScriptFixture = {
    baseUrl: string;
    close: () => Promise<void>;
    reply: (request: FixtureRequest, status: number, body: unknown) => void;
    waitForRequest: () => Promise<FixtureRequest>;
};

async function startLocalVoScriptFixture(): Promise<LocalVoScriptFixture> {
    const queuedRequests: FixtureRequest[] = [];
    const requestWaiters: Array<(request: FixtureRequest) => void> = [];
    const openResponses = new Set<ServerResponse>();
    const server = createServer((request, response) => {
        openResponses.add(response);
        response.once("close", () => openResponses.delete(response));

        const requestUrl = new URL(
            request.url ?? "/",
            "http://127.0.0.1",
        );
        const fixtureRequest: FixtureRequest = {
            apiKey: String(request.headers["x-api-key"] ?? ""),
            authorization: request.headers.authorization ?? "",
            method: request.method ?? "GET",
            pathname: requestUrl.pathname,
            response,
        };
        const waiter = requestWaiters.shift();

        if (waiter) {
            waiter(fixtureRequest);
            return;
        }

        queuedRequests.push(fixtureRequest);
    });

    await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
            server.off("listening", onListening);
            reject(error);
        };
        const onListening = () => {
            server.off("error", onError);
            resolve();
        };

        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(0, "127.0.0.1");
    });

    const address = server.address();
    if (!address || typeof address === "string") {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
        throw new Error("Unable to start the local VoScript fixture");
    }

    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        async close() {
            for (const response of openResponses) {
                if (!response.writableEnded) {
                    response.destroy();
                }
            }

            await new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            });
        },
        reply(request, status, body) {
            request.response.writeHead(status, {
                "content-type": "application/json",
            });
            request.response.end(JSON.stringify(body));
        },
        async waitForRequest() {
            const request = queuedRequests.shift();
            if (request) {
                return request;
            }

            return await new Promise<FixtureRequest>((resolve) => {
                requestWaiters.push(resolve);
            });
        },
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

function testConnectionButton(page: Page) {
    return voscriptSection(page).getByRole("button", {
        name: /^(测试 VoScript 连接|正在测试 VoScript 连接|VoScript 连接正常|Test VoScript connection|Testing VoScript connection|VoScript connection ready)$/,
    });
}

function waitForTestRequest(page: Page) {
    return page.waitForRequest(
        (request) =>
            request.url().endsWith(VOSCRIPT_TEST_ENDPOINT) &&
            request.method() === "POST",
    );
}

function waitForTestResponse(page: Page) {
    return page.waitForResponse(
        (response) =>
            response.url().endsWith(VOSCRIPT_TEST_ENDPOINT) &&
            response.request().method() === "POST",
    );
}

test("VoScript Test connection uses a local app API fixture and restores settings", async ({
    page,
}) => {
    const fixture = await startLocalVoScriptFixture();
    let baselineSettings: VoScriptSettings | null = null;

    try {
        await page.setViewportSize({ width: 1180, height: 680 });
        await ensureSignedIn(page);
        baselineSettings = await getVoScriptSettings(page);

        await page.goto("/settings#voscript", {
            waitUntil: "domcontentloaded",
        });

        const section = voscriptSection(page);
        const baseUrlInput = section.locator("#voscript-base-url");
        const apiKeyInput = section.locator("#voscript-api-key");
        const button = testConnectionButton(page);
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expect(button).toBeEnabled();

        await baseUrlInput.fill(fixture.baseUrl);
        await apiKeyInput.fill(LOCAL_FIXTURE_API_KEY);

        const successAppRequest = waitForTestRequest(page);
        const successAppResponse = waitForTestResponse(page);
        await button.click();

        const successFixtureRequest = await fixture.waitForRequest();
        await expect(section).toHaveAttribute("aria-busy", "true");
        await expect(button).toBeDisabled();
        await expect(button).toHaveAttribute("aria-busy", "true");
        await expect(button).toHaveAccessibleName(
            /^(正在测试 VoScript 连接|Testing VoScript connection)$/,
        );
        expect(successFixtureRequest).toMatchObject({
            apiKey: LOCAL_FIXTURE_API_KEY,
            authorization: `Bearer ${LOCAL_FIXTURE_API_KEY}`,
            method: "GET",
            pathname: "/api/voiceprints",
        });

        fixture.reply(successFixtureRequest, 200, { voiceprints: [] });

        const [successRequest, successResponse] = await Promise.all([
            successAppRequest,
            successAppResponse,
        ]);
        expect(successRequest.postDataJSON()).toEqual({
            privateTranscriptionApiKey: LOCAL_FIXTURE_API_KEY,
            privateTranscriptionBaseUrl: fixture.baseUrl,
        });
        expect(successResponse.status()).toBe(200);
        await expect(successResponse.json()).resolves.toEqual({
            available: true,
            providerName: "voice-transcribe",
            success: true,
            voiceprintCount: 0,
        });
        await expect(section).toHaveAttribute("aria-busy", "false");
        await expect(button).toHaveAttribute("aria-busy", "false");
        await expect(button).toHaveAccessibleName(
            /^(VoScript 连接正常|VoScript connection ready)$/,
        );
        await expect(button).toContainText(/Ready|连接正常/);

        const failureAppResponse = waitForTestResponse(page);
        await button.click();

        const failureFixtureRequest = await fixture.waitForRequest();
        await expect(button).toBeDisabled();
        await expect(button).toHaveAccessibleName(
            /^(正在测试 VoScript 连接|Testing VoScript connection)$/,
        );
        expect(failureFixtureRequest).toMatchObject({
            method: "GET",
            pathname: "/api/voiceprints",
        });
        fixture.reply(failureFixtureRequest, 503, {
            error: "local fixture unavailable",
        });

        const failureResponse = await failureAppResponse;
        expect(failureResponse.status()).toBe(502);
        await expect(failureResponse.json()).resolves.toEqual(
            expect.objectContaining({ error: expect.any(String) }),
        );
        await expect(button).toHaveAttribute("aria-busy", "false");
        await expect(button).toHaveAccessibleName(
            /^(测试 VoScript 连接|Test VoScript connection)$/,
        );
        const failureBanner = section.getByRole("alert").filter({
            hasText: /^(VoScript 当前不可用|VoScript is unavailable)/,
        });
        await expect(failureBanner).toBeVisible();
    } finally {
        if (baselineSettings) {
            await page.reload({ waitUntil: "domcontentloaded" });
            await expect(voscriptSection(page)).toHaveAttribute(
                "aria-busy",
                "false",
            );
            await expect(
                voscriptSection(page).locator("#voscript-base-url"),
            ).toHaveValue(baselineSettings.privateTranscriptionBaseUrl ?? "");
            expect(await getVoScriptSettings(page)).toEqual(baselineSettings);
        }

        await fixture.close();
    }
});
