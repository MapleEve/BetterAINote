import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ensureSignedIn, putJsonWithRetry } from "./helpers/auth";
import {
    SOT_FIXTURE_WEB_ROOT,
    SOT_WORKSTATION_URL,
} from "./helpers/sot-fixtures";

const ROW_117_EVIDENCE_DIR = path.resolve(
    process.cwd(),
    "tmp/betterainote-design-evidence/run-20260605-sot-1to1/settings-shell-visual-matrix-20260611",
);
const SOT_WEB_INDEX_URL = SOT_WORKSTATION_URL;
const SETTINGS_TEST_EMAIL = "playwright-admin@example.com";
const SETTINGS_TEST_NAME = "Playwright Admin";
const SETTINGS_SOT_HEADER_TITLE_ZH = "本地部署";
const SETTINGS_SOT_HEADER_SUBTITLE_ZH =
    "单租户 · self-hosted · 无登录账号";

function repoRelativeFixturePath(...segments: string[]) {
    return path
        .relative(process.cwd(), path.join(SOT_FIXTURE_WEB_ROOT, ...segments))
        .split(path.sep)
        .join("/");
}

async function resetDisplayToChinese(page: Page) {
    const resetResponse = await page.request.put("/api/settings/display", {
        data: {
            dateTimeFormat: "relative",
            itemsPerPage: 50,
            recordingListSortOrder: "newest",
            theme: "dark",
            uiLanguage: "zh-CN",
        },
    });
    expect(resetResponse.ok()).toBe(true);
}

async function clearSettingsPersistence(page: Page) {
    await page.evaluate(() => {
        localStorage.removeItem("settings-data-source-provider");
        localStorage.removeItem("settings-last-section");
    });
}

async function seedTitleGenerationReadyState(page: Page) {
    const seedResponse = await putJsonWithRetry(
        page,
        "/api/settings/title-generation",
        {
            autoGenerateTitle: true,
            titleGenerationApiKey: "e2e-title-generation-ready-value",
            titleGenerationBaseUrl: "https://api.openai.com/v1",
            titleGenerationModel: "gpt-4.1-mini",
            titleGenerationPrompt: null,
        },
    );
    expect(seedResponse.ok()).toBe(true);

    const settingsResponse = await page.request.get(
        "/api/settings/title-generation",
    );
    expect(settingsResponse.ok()).toBe(true);
    const settings = (await settingsResponse.json()) as {
        titleGenerationApiKeySet?: unknown;
    };
    expect(settings.titleGenerationApiKeySet).toBe(true);
}

async function seedRow117TranscriptionReadyState(page: Page) {
    const seedResponse = await putJsonWithRetry(
        page,
        "/api/settings/transcription",
        {
            autoTranscribe: true,
            defaultTranscriptionLanguage: null,
        },
    );
    expect(seedResponse.ok()).toBe(true);
}

async function putRow117AppearanceReadyState(page: Page) {
    const seedResponse = await putJsonWithRetry(
        page,
        "/api/settings/display",
        { ...row117AppearanceReadyState },
    );
    expect(seedResponse.ok()).toBe(true);

    const settingsResponse = await page.request.get("/api/settings/display");
    expect(settingsResponse.ok()).toBe(true);
    const payload = (await settingsResponse.json()) as Record<string, unknown>;
    expect(payload).toMatchObject(row117AppearanceReadyState);
}

async function seedRow117AppearanceReadyState(page: Page) {
    await putRow117AppearanceReadyState(page);
    await page.goto("about:blank");
    await page.goto("/settings#appearance", { waitUntil: "domcontentloaded" });
    await expectActiveSettingsSectionReady(page, "appearance");
    await expectRow117AppearanceReadyState(page);
}

function sotControl(page: Page, control: string) {
    return page.locator(`[data-sot-control="${control}"]`);
}

function sotPanel(page: Page, panel: string) {
    return page.locator(`[data-sot-panel="${panel}"]`);
}

function settingsShell(page: Page) {
    return page.getByRole("dialog", {
        name: /^(设置|Settings)$/,
    });
}

async function expectSettingsHeaderSotCopy(shell: Locator) {
    const summary = shell.getByRole("banner");
    await expect(summary).toContainText(SETTINGS_SOT_HEADER_TITLE_ZH);
    await expect(summary).toContainText(SETTINGS_SOT_HEADER_SUBTITLE_ZH);
    await expect(summary).not.toContainText(SETTINGS_TEST_EMAIL);
    await expect(summary).not.toContainText(SETTINGS_TEST_NAME);
}

function settingsNav(page: Page, section: string) {
    return settingsShell(page).getByRole("button", {
        exact: true,
        name: settingsSectionLabels[section] ?? section,
    });
}

function activeSettingsContentScrollContainer(
    page: Page,
    section: CanonicalSettingsSection,
) {
    const shell = settingsShell(page);
    const activeNav = settingsNav(page, section).and(
        shell.locator('[aria-current="page"]'),
    );

    return activeNav.locator(
        "xpath=ancestor::nav[1]/following-sibling::*[1]",
    );
}

async function waitForDashboardHydration(page: Page) {
    await page
        .waitForResponse(
            (response) =>
                response.url().includes("/api/recording-tags") &&
                response.ok(),
            { timeout: 15_000 },
        )
        .catch(() => null);
}

async function openPanelWithRetry(
    trigger: Locator,
    panel: Locator,
) {
    await expect(trigger).toBeVisible();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        await trigger.click();
        if (
            await panel
                .isVisible({ timeout: 1_000 })
                .catch(() => false)
        ) {
            return;
        }
        await trigger.page().waitForTimeout(250);
    }
}

async function openSettingsWithRetry(page: Page) {
    const trigger = sotControl(page, "dashboard-settings");
    const shell = settingsShell(page);

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await trigger.evaluate((node) => (node as HTMLElement).click());
        if (
            await shell
                .isVisible({ timeout: 1_000 })
                .catch(() => false)
        ) {
            return;
        }
        await page.waitForTimeout(250);
    }

    await expect(shell).toBeVisible();
}

async function settingsShellHeight(page: Page) {
    return settingsShell(page).evaluate(
        (node) => node.getBoundingClientRect().height,
    );
}

async function settingsShellViewportBox(page: Page) {
    return settingsShell(page).evaluate((node) => {
        const rect = node.getBoundingClientRect();

        return {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            width: rect.width,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
        };
    });
}

async function settingsShellViewportMetrics(page: Page) {
    const metrics = await settingsShellViewportBox(page);

    return {
        height: metrics.height,
        viewportHeight: metrics.viewportHeight,
    };
}

async function expectShellHeightStable(page: Page, baseline: number) {
    const current = await settingsShellHeight(page);
    expect(Math.abs(current - baseline)).toBeLessThan(2);
}

async function elementScrollTop(locator: ReturnType<Page["locator"]>) {
    return locator.evaluate((node) => node.scrollTop);
}

async function windowScrollY(page: Page) {
    return page.evaluate(() => window.scrollY);
}

async function settingsFocusIsContained(page: Page) {
    return settingsShell(page).evaluate((shell) =>
        shell.contains(document.activeElement),
    );
}

async function elementCanScroll(locator: ReturnType<Page["locator"]>) {
    return locator.evaluate((node) => node.scrollHeight > node.clientHeight + 1);
}

async function scrollElementToEnd(locator: ReturnType<Page["locator"]>) {
    await locator.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
    });
}

async function scrollIfScrollable(locator: Locator) {
    if (!(await elementCanScroll(locator))) {
        await expect.poll(() => elementScrollTop(locator)).toBe(0);
        return false;
    }

    await scrollElementToEnd(locator);
    await expect.poll(() => elementScrollTop(locator)).toBeGreaterThan(0);
    return true;
}

const desktopSettingsSections = [
    "transcription",
    "title-generation",
    "voscript",
    "data-sources",
    "appearance",
    "misc",
] as const;

type CanonicalSettingsSection = (typeof desktopSettingsSections)[number];

const settingsSectionLabels: Record<string, RegExp> = {
    appearance: /^(显示设置|Display Settings)$/,
    "data-sources": /^(数据源|Data Sources)$/,
    misc: /^(杂项|Misc)$/,
    "title-generation": /^(AI 重命名服务|AI Rename Service)$/,
    transcription: /^(转录设置|Transcription Settings)$/,
    voscript: /^(VoScript 服务|VoScript Service)$/,
};

const settingsLegacySelectors = [
    ".sm-section-title",
    ".sm-row-name",
    ".sm-row-desc",
    ".sm-detail-head",
    ".modal-foot",
] as const;

type SectionRepresentativeTarget = {
    assertSemantics?: (surface: Locator, locator: Locator) => Promise<void>;
    getLocator: (surface: Locator) => Locator;
    minCount?: number;
    name: string;
    selector: string;
};

type SectionAcceptanceTarget = {
    representativeTargets: SectionRepresentativeTarget[];
    surface: "settings-section" | "settings-data-sources";
};

type RepresentativeTargetEvidence = {
    count: number;
    name: string;
    selector: string;
    tagName: string | null;
};

type SectionAcceptanceEvidence = {
    navigationMode: "direct-hash" | "desktop-rail";
    navState: string | null;
    oldSelectorCounts: Record<string, number>;
    representativeTargets: RepresentativeTargetEvidence[];
    section: CanonicalSettingsSection;
    sectionState: string | null;
    shellState: string | null;
    surface: "settings-section" | "settings-data-sources";
};

function controlIdTarget(id: string) {
    return {
        getLocator: (surface: Locator) => surface.locator(`#${id}`),
        selector: `#${id}`,
    };
}

function headingTarget(name: RegExp) {
    return {
        getLocator: (surface: Locator) =>
            surface.getByRole("heading", { level: 3, name }),
        selector: `heading[level=3][name=${name.source}]`,
    };
}

function buttonTarget(name: RegExp) {
    return {
        getLocator: (surface: Locator) =>
            surface.getByRole("button", { exact: true, name }),
        selector: `button[name=${name.source}]`,
    };
}

function radioGroupOptionsTarget(name: RegExp) {
    return {
        assertSemantics: async (surface: Locator) => {
            const group = surface.getByRole("radiogroup", {
                exact: true,
                name,
            });
            await expect(group).toHaveCount(1);

            const radios = group.getByRole("radio");
            const checkedStates = await radios.evaluateAll((nodes) =>
                nodes.map((node) => node.getAttribute("aria-checked")),
            );
            expect(
                checkedStates.every((state) =>
                    /^(true|false)$/.test(state ?? ""),
                ),
            ).toBe(true);
            await expect(
                group.locator('[role="radio"][aria-checked="true"]'),
            ).toHaveCount(1);
        },
        getLocator: (surface: Locator) =>
            surface
                .getByRole("radiogroup", { exact: true, name })
                .getByRole("radio"),
        selector: `radiogroup[name=${name.source}] radio`,
    };
}

const dataSourceProviderName =
    /^(钉钉 闪记|DingTalk A1 Flash Notes|Plaud 云端|Plaud Cloud|TicNote|飞书妙记|Feishu Minutes|讯飞听见|iFLYTEK iflyrec)$/;

function dataSourceDetailPanelTarget() {
    return {
        assertSemantics: async (surface: Locator, detail: Locator) => {
            const selectedProvider = surface
                .getByRole("complementary")
                .getByRole("button", { pressed: true });
            await expect(selectedProvider).toHaveCount(1);

            const detailHeading = detail.getByRole("heading", { level: 3 });
            await expect(detailHeading).toHaveCount(1);
            const detailName = (await detailHeading.textContent())?.trim();
            expect(detailName).toBeTruthy();
            await expect(selectedProvider).toHaveAccessibleName(
                new RegExp(
                    (detailName ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                ),
            );

            const labelledBy = await detail.getAttribute("aria-labelledby");
            expect(labelledBy).toBeTruthy();
            await expect(detailHeading).toHaveAttribute("id", labelledBy ?? "");
            await expect(detail).toHaveAccessibleName(detailName ?? "");
        },
        getLocator: (surface: Locator) =>
            surface.getByRole("region", {
                exact: true,
                name: dataSourceProviderName,
            }),
        selector: `region[name=${dataSourceProviderName.source}]`,
    };
}

function providerRailTarget() {
    return {
        getLocator: (surface: Locator) =>
            surface.getByRole("complementary").getByRole("button"),
        selector: "complementary button",
    };
}

function speakerProfilesTarget() {
    return {
        getLocator: (surface: Locator) =>
            surface.getByText("已保存的说话人", { exact: true }),
        selector: "text=已保存的说话人",
    };
}

type LoadErrorRetryEvidence = {
    errorPanelVisible: boolean;
    normalControlCountInError: number;
    retryReturnedReady: boolean;
    retryVisible: boolean;
    section: "title-generation";
    states: string[];
};

type Row117DataSourcesCredentialSafeTestSuccessEvidence = {
    busyAndUnlockReadback: string[];
    coverageSource: {
        file: string;
        tests: {
            name: string;
            readback: string[];
        }[];
    };
    credentialPolicy: {
        fakeCredentialOnly: true;
        realCredentialsUsed: false;
        row117EvidenceStoresSecretValues: false;
    };
    nonClaims: string[];
    payloadShapeReadback: {
        authMode: string;
        configKeys: string[];
        provider: string;
        savedByTestSuccess: false;
        secretKeys: string[];
    }[];
    routeMockedSuccess: {
        endpoint: "/api/data-sources/test";
        responseShape: { success: true };
    };
    successStateReadback: string[];
    trackedSourceVerification?: Row117DataSourcesTrackedSourceVerification;
};

type Row117DataSourcesTrackedSourceVerification = {
    blockedSecretLiteralCount: number;
    file: string;
    liveCredentialBackedProviderSuccessClaimed: false;
    tests: {
        contractChecks: string[];
        name: string;
    }[];
};

const row117DataSourcesCredentialSafeTestSuccessEvidence: Row117DataSourcesCredentialSafeTestSuccessEvidence =
    {
        busyAndUnlockReadback: [
            "During the TicNote route-mocked test request, the Data Sources detail exposes data-sot-action-state=testing, source-test data-sot-state=testing, aria-busy=true, shell data-sot-busy=true, provider switching/settings nav/close/inputs disabled.",
            "After the mocked success response resolves, the same flow reads data-sot-action-state=test-success, source-test data-sot-state=success, aria-busy=false, source-save data-sot-state=idle, shell data-sot-busy=false, provider switching/settings nav/close/inputs enabled.",
        ],
        coverageSource: {
            file: "e2e/data-sources-settings.spec.ts",
            tests: [
                {
                    name: "data sources settings tests missing details then saves a provider through the real form",
                    readback: [
                        "Exercises incomplete-detail error, route-mocked /api/data-sources/test success, busy lock/unlock, test payload shape, and savePayload=null before explicit save.",
                        "Separately exercises explicit save after test success so test-success is not conflated with credential persistence.",
                    ],
                },
                {
                    name: "data sources settings masks sensitive fields and preserves pasted sign-in details",
                    readback: [
                        "Asserts credential inputs render as password fields while pasted fake sign-in details are preserved locally.",
                        "Reads back route-mocked TicNote and Feishu test-success payload shapes without saving the test result.",
                    ],
                },
                {
                    name: "data sources settings switches Feishu sign-in methods without saving test payloads",
                    readback: [
                        "Reads back oauth-device-flow and web-reverse payload shapes for Feishu test-success.",
                        "Asserts savePayload remains null across both route-mocked test-success requests.",
                    ],
                },
            ],
        },
        credentialPolicy: {
            fakeCredentialOnly: true,
            realCredentialsUsed: false,
            row117EvidenceStoresSecretValues: false,
        },
        nonClaims: [
            "Credential-backed live-provider Data Sources test-success is not claimed by row 117 six-section acceptance.",
            "This contract only claims route-mocked test-success and credential-safe readback from the tracked Playwright tests listed above.",
        ],
        payloadShapeReadback: [
            {
                authMode: "bearer",
                configKeys: ["region"],
                provider: "ticnote",
                savedByTestSuccess: false,
                secretKeys: ["bearerToken"],
            },
            {
                authMode: "oauth-device-flow",
                configKeys: ["appId"],
                provider: "feishu-minutes",
                savedByTestSuccess: false,
                secretKeys: ["userAccessToken"],
            },
            {
                authMode: "web-reverse",
                configKeys: ["spaceName"],
                provider: "feishu-minutes",
                savedByTestSuccess: false,
                secretKeys: ["webCookie", "webToken"],
            },
        ],
        routeMockedSuccess: {
            endpoint: "/api/data-sources/test",
            responseShape: { success: true },
        },
        successStateReadback: [
            "Provider detail reaches data-sot-action-state=test-success.",
            "Provider rail reaches data-sot-status=test-success where the route-mocked TicNote flow reads provider-level state.",
            "State banner uses data-sot-tone=ok and action status includes the localized success copy.",
            "source-test returns to aria-busy=false and source-save remains idle until explicit save.",
        ],
    };

const row117DataSourcesSecretLiteralsBlockedFromEvidence = [
    "fake-ticnote-token",
    "pasted-data-source-token",
    "minutes_csrf_token=e2e; session=e2e",
    "x-minutes-pasted-token",
    "u-e2e-open-platform-token",
    "x-minutes-e2e-token",
] as const;

function row117DataSourcesContractSourcePath() {
    return path.resolve(process.cwd(), "e2e/data-sources-settings.spec.ts");
}

function extractPlaywrightTestBlock(source: string, testName: string) {
    const startToken = `test(${JSON.stringify(testName)},`;
    const start = source.indexOf(startToken);
    if (start < 0) {
        throw new Error(`Missing Row117 tracked source test: ${testName}`);
    }

    const nextTestStart = source.indexOf("\ntest(", start + startToken.length);
    const block =
        nextTestStart < 0
            ? source.slice(start)
            : source.slice(start, nextTestStart);
    if (!block.includes("\n});")) {
        throw new Error(`Could not extract Row117 tracked source test: ${testName}`);
    }

    return block;
}

function expectSourceContains(
    block: string,
    contractChecks: string[],
    label: string,
    needle: string,
) {
    if (!block.includes(needle)) {
        throw new Error(`Missing Row117 tracked source contract: ${label}`);
    }
    contractChecks.push(label);
}

function expectSourceOccurrences(
    block: string,
    contractChecks: string[],
    label: string,
    needle: string,
    minimumOccurrences: number,
) {
    const occurrences = block.split(needle).length - 1;
    if (occurrences < minimumOccurrences) {
        throw new Error(
            `Missing Row117 tracked source contract: ${label}; found ${occurrences}`,
        );
    }
    contractChecks.push(label);
}

function expectSourceInOrder(
    block: string,
    contractChecks: string[],
    label: string,
    needles: string[],
) {
    let lastIndex = -1;
    for (const needle of needles) {
        const nextIndex = block.indexOf(needle, lastIndex + 1);
        if (nextIndex < 0) {
            throw new Error(`Missing Row117 tracked source contract: ${label}`);
        }
        lastIndex = nextIndex;
    }
    contractChecks.push(label);
}

function verifyMissingDetailsTestBlock(block: string) {
    const contractChecks: string[] = [];
    expectSourceContains(
        block,
        contractChecks,
        "route-mocked data source test endpoint",
        'page.route("**/api/data-sources/test"',
    );
    expectSourceContains(
        block,
        contractChecks,
        "route mock returns success true JSON",
        "JSON.stringify({ success: true })",
    );
    expectSourceContains(
        block,
        contractChecks,
        "testing state readback",
        '"data-sot-action-state",\n        "testing"',
    );
    expectSourceContains(
        block,
        contractChecks,
        "test-success state readback",
        '"data-sot-action-state",\n        "test-success"',
    );
    expectSourceContains(
        block,
        contractChecks,
        "source-test aria-busy true readback",
        'expect(sourceTest).toHaveAttribute("aria-busy", "true")',
    );
    expectSourceOccurrences(
        block,
        contractChecks,
        "source-test aria-busy false readbacks",
        'expect(sourceTest).toHaveAttribute("aria-busy", "false")',
        2,
    );
    for (const state of ["idle", "disabled", "saving"] as const) {
        expectSourceContains(
            block,
            contractChecks,
            `source-save ${state} readback`,
            `expect(sourceSave).toHaveAttribute("data-sot-state", "${state}")`,
        );
    }
    expectSourceContains(
        block,
        contractChecks,
        "test-success leaves save payload null",
        "expect(savePayload).toBeNull();",
    );
    expectSourceContains(
        block,
        contractChecks,
        "TicNote test payload shape readback",
        "expect(testPayload).toMatchObject({",
    );
    for (const needle of [
        'authMode: "bearer"',
        'provider: "ticnote"',
        "secrets: { bearerToken:",
        "expect(testPayload?.config).toMatchObject({",
        'region: "cn"',
    ]) {
        expectSourceContains(
            block,
            contractChecks,
            `TicNote payload contains ${needle}`,
            needle,
        );
    }
    expectSourceInOrder(
        block,
        contractChecks,
        "explicit save payload is separate from test-success",
        [
            "expect(savePayload).toBeNull();",
            "await sourceSave.click();",
            "expect(savePayload).toMatchObject({",
        ],
    );

    return contractChecks;
}

function verifySensitiveFieldsTestBlock(block: string) {
    const contractChecks: string[] = [];
    expectSourceOccurrences(
        block,
        contractChecks,
        "credential inputs remain password inputs",
        'toHaveAttribute("type", "password")',
        3,
    );
    for (const needle of [
        "pasteTextIntoInput(ticnoteSecret",
        "pasteTextIntoInput(\n        webCookieInput",
        "pasteTextIntoInput(webTokenInput",
    ]) {
        expectSourceContains(
            block,
            contractChecks,
            `paste fake credential flow includes ${needle}`,
            needle,
        );
    }
    expectSourceOccurrences(
        block,
        contractChecks,
        "TicNote and Feishu test-success readback",
        '"test-success"',
        2,
    );
    expectSourceOccurrences(
        block,
        contractChecks,
        "payload shape readback after each test-success",
        "expect(testPayloads.at(-1)).toMatchObject({",
        2,
    );
    for (const needle of [
        'provider: "ticnote"',
        "secrets: { bearerToken:",
        'authMode: "web-reverse"',
        'provider: "feishu-minutes"',
        "webCookie:",
        "webToken:",
    ]) {
        expectSourceContains(
            block,
            contractChecks,
            `payload shape includes ${needle}`,
            needle,
        );
    }

    return contractChecks;
}

function verifyFeishuSignInMethodsTestBlock(block: string) {
    const contractChecks: string[] = [];
    expectSourceContains(
        block,
        contractChecks,
        "route-mocked Feishu test-success endpoint",
        'page.route("**/api/data-sources/test"',
    );
    expectSourceContains(
        block,
        contractChecks,
        "route mock returns success true JSON",
        "JSON.stringify({ success: true })",
    );
    expectSourceContains(
        block,
        contractChecks,
        "oauth-device-flow test-success payload readback",
        'authMode: "oauth-device-flow"',
    );
    expectSourceContains(
        block,
        contractChecks,
        "web-reverse test-success payload readback",
        'authMode: "web-reverse"',
    );
    expectSourceOccurrences(
        block,
        contractChecks,
        "save payload remains null for both mocked test-success requests",
        "expect(savePayload).toBeNull();",
        2,
    );
    expectSourceInOrder(
        block,
        contractChecks,
        "oauth-device-flow and web-reverse test-success requests stay unsaved",
        [
            "await detail.locator(\"[data-sot-control=\\\"source-test\\\"]\").click();",
            "expect(testPayloads[0]).toMatchObject({",
            'authMode: "oauth-device-flow"',
            "expect(savePayload).toBeNull();",
            "await webReverseModeButton.click();",
            "await detail.locator(\"[data-sot-control=\\\"source-test\\\"]\").click();",
            "expect(testPayloads[1]).toMatchObject({",
            'authMode: "web-reverse"',
            "expect(savePayload).toBeNull();",
        ],
    );

    return contractChecks;
}

async function verifyRow117DataSourcesTrackedSourceContract(): Promise<Row117DataSourcesTrackedSourceVerification> {
    const source = await readFile(row117DataSourcesContractSourcePath(), "utf8");
    const sourceTests =
        row117DataSourcesCredentialSafeTestSuccessEvidence.coverageSource.tests;
    const [missingDetailsTest, sensitiveFieldsTest, feishuSignInMethodsTest] =
        sourceTests;
    if (!missingDetailsTest || !sensitiveFieldsTest || !feishuSignInMethodsTest) {
        throw new Error("Row117 tracked source test list is incomplete");
    }

    return {
        blockedSecretLiteralCount:
            row117DataSourcesSecretLiteralsBlockedFromEvidence.length,
        file: row117DataSourcesCredentialSafeTestSuccessEvidence.coverageSource.file,
        liveCredentialBackedProviderSuccessClaimed: false,
        tests: [
            {
                contractChecks: verifyMissingDetailsTestBlock(
                    extractPlaywrightTestBlock(source, missingDetailsTest.name),
                ),
                name: missingDetailsTest.name,
            },
            {
                contractChecks: verifySensitiveFieldsTestBlock(
                    extractPlaywrightTestBlock(source, sensitiveFieldsTest.name),
                ),
                name: sensitiveFieldsTest.name,
            },
            {
                contractChecks: verifyFeishuSignInMethodsTestBlock(
                    extractPlaywrightTestBlock(source, feishuSignInMethodsTest.name),
                ),
                name: feishuSignInMethodsTest.name,
            },
        ],
    };
}

const sectionAcceptanceTargets: Record<
    CanonicalSettingsSection,
    SectionAcceptanceTarget
> = {
    transcription: {
        surface: "settings-section",
        representativeTargets: [
            {
                name: "section title",
                ...headingTarget(settingsSectionLabels.transcription),
            },
            {
                name: "auto transcription switch",
                ...controlIdTarget("transcription-auto-transcribe"),
            },
            {
                name: "transcription language select",
                ...controlIdTarget("transcription-language"),
            },
        ],
    },
    "title-generation": {
        surface: "settings-section",
        representativeTargets: [
            {
                name: "section title",
                ...headingTarget(settingsSectionLabels["title-generation"]),
            },
            {
                name: "auto title switch",
                ...controlIdTarget("title-generation-enabled"),
            },
            {
                name: "title model input",
                ...controlIdTarget("title-generation-model"),
            },
            {
                name: "section save action",
                ...buttonTarget(/^(保存|Save)$/),
            },
        ],
    },
    voscript: {
        surface: "settings-section",
        representativeTargets: [
            {
                name: "section title",
                ...headingTarget(settingsSectionLabels.voscript),
            },
            {
                name: "voscript base url input",
                ...controlIdTarget("voscript-base-url"),
            },
            {
                name: "voscript test action",
                ...buttonTarget(/^(测试连接|Test)$/),
            },
            {
                name: "speaker profiles panel",
                ...speakerProfilesTarget(),
            },
        ],
    },
    "data-sources": {
        surface: "settings-data-sources",
        representativeTargets: [
            {
                minCount: 5,
                name: "provider rail cards",
                ...providerRailTarget(),
            },
            {
                name: "provider detail panel",
                ...dataSourceDetailPanelTarget(),
            },
            {
                name: "provider detail header",
                ...headingTarget(/.*/),
            },
            {
                name: "provider save action",
                ...buttonTarget(/^(保存|Save)$/),
            },
            {
                name: "provider test action",
                ...buttonTarget(/^(测试连接|Test)$/),
            },
        ],
    },
    appearance: {
        surface: "settings-section",
        representativeTargets: [
            {
                minCount: 3,
                name: "theme segmented control",
                ...radioGroupOptionsTarget(/^(主题|Theme)$/),
            },
            {
                minCount: 2,
                name: "density segmented control",
                ...radioGroupOptionsTarget(/^(信息密度|Information density)$/),
            },
            {
                name: "time style segmented control",
                ...radioGroupOptionsTarget(/^(时间显示|Time display)$/),
            },
        ],
    },
    misc: {
        surface: "settings-section",
        representativeTargets: [
            {
                name: "sync enabled switch",
                ...controlIdTarget("sync-auto-enabled"),
            },
            {
                name: "sync interval input",
                ...controlIdTarget("sync-interval-seconds"),
            },
            {
                name: "playback speed select",
                ...controlIdTarget("playback-speed"),
            },
            {
                name: "playback volume range",
                ...controlIdTarget("playback-volume"),
            },
            {
                name: "playback auto next switch",
                ...controlIdTarget("playback-auto-next"),
            },
        ],
    },
};

type Row117Viewport = {
    height: number;
    width: number;
};

type Row117PixelDiff = {
    blockerReason: string | null;
    differingPixels: number | null;
    dimensionsMatch: boolean;
    expectedHeight: number;
    expectedWidth: number;
    maxChannelDelta: number | null;
    productHeight: number;
    productWidth: number;
};

type Row117FrameEvidence = {
    assertions: string[];
    blockerReason: string | null;
    diff: Row117PixelDiff | null;
    frame: string;
    notes: string[];
    parityType:
        | "pixel"
        | "structural"
        | "existing-evidence-reference"
        | "blocked";
    productMetrics: Record<string, unknown>;
    productScreenshot: string;
    section: string;
    sotMetrics: Record<string, unknown> | null;
    sotScreenshot: string | null;
    stage: "ready" | "immediate-save-pending" | "load-error-retry";
    viewport: Row117Viewport;
};

type Row117TitleGenerationStoredKeyEvidence = {
    apiTitleGenerationApiKeySet: boolean;
    placeholder: string | null;
    storedKeyInputVisible: boolean;
    storedStatusText: string | null;
};

const row117AppearanceReadyState = {
    dateTimeFormat: "absolute",
    displayDensity: "comfy",
    itemsPerPage: 50,
    recordingListSortOrder: "newest",
    theme: "dark",
    uiLanguage: "zh-CN",
} as const;

const row117DataSourceCapabilities = {
    audioDownload: true,
    localRename: true,
    officialSummary: true,
    officialTranscript: true,
    privateTranscribe: true,
    upstreamTitleWriteback: true,
    workerSync: true,
};

const row117DataSourcesReadyState = [
    {
        authMode: "device-signin",
        authModes: ["device-signin"],
        baseUrl: "https://alidocs.dingtalk.com",
        capabilities: row117DataSourceCapabilities,
        config: { syncTitleToSource: true },
        connected: true,
        connectionStatus: "ready",
        displayName: "钉钉 闪记",
        enabled: true,
        lastSync: new Date("2026-05-31T09:48:00.000Z").toISOString(),
        lastSyncError: null,
        provider: "dingtalk-a1",
        runtimeStatus: "active",
        secretsConfigured: { deviceCredential: true },
        syncStatus: "idle",
    },
    {
        authMode: "bearer",
        authModes: ["bearer"],
        baseUrl: "https://h5.mobvoi.com",
        capabilities: row117DataSourceCapabilities,
        config: { region: "cn", syncTitleToSource: true },
        connected: true,
        connectionStatus: "ready",
        displayName: "TicNote",
        enabled: true,
        lastSync: null,
        lastSyncError: null,
        provider: "ticnote",
        runtimeStatus: "active",
        secretsConfigured: { bearerToken: true },
        syncStatus: "syncing",
    },
    {
        authMode: "bearer",
        authModes: ["bearer"],
        baseUrl: "https://api.plaud.ai",
        capabilities: row117DataSourceCapabilities,
        config: { server: "global", syncTitleToSource: false },
        connected: true,
        connectionStatus: "expired",
        displayName: "Plaud 云端",
        enabled: true,
        lastSync: new Date("2026-05-31T07:55:00.000Z").toISOString(),
        lastSyncError: "Plaud 云端更新失败，请检查登录信息后重试。",
        provider: "plaud",
        runtimeStatus: "active",
        secretsConfigured: { bearerToken: true },
        syncStatus: "error",
    },
    {
        authMode: "oauth-device-flow",
        authModes: ["oauth-device-flow", "web-reverse"],
        baseUrl: "https://open.feishu.cn",
        capabilities: row117DataSourceCapabilities,
        config: {},
        connected: false,
        connectionStatus: "ready",
        displayName: "飞书妙记",
        enabled: false,
        lastSync: null,
        lastSyncError: null,
        provider: "feishu-minutes",
        runtimeStatus: "active",
        secretsConfigured: {},
        syncStatus: "idle",
    },
    {
        authMode: "session-header",
        authModes: ["session-header"],
        baseUrl: "https://www.iflyrec.com",
        capabilities: row117DataSourceCapabilities,
        config: { bizId: "tjzs" },
        connected: true,
        connectionStatus: "expired",
        displayName: "讯飞听见",
        enabled: true,
        lastSync: new Date("2026-05-28T09:55:00.000Z").toISOString(),
        lastSyncError: null,
        provider: "iflyrec",
        runtimeStatus: "active",
        secretsConfigured: { sessionId: true },
        syncStatus: "idle",
    },
] as const;

const row117ProductDataSourceProviders = [
    {
        displayName: "钉钉 闪记",
        provider: "dingtalk-a1",
        status: "connected",
        statusLabel: "已连接",
    },
    {
        displayName: "TicNote",
        provider: "ticnote",
        status: "syncing",
        statusLabel: "同步中",
    },
    {
        displayName: "Plaud 云端",
        provider: "plaud",
        status: "error",
        statusLabel: "同步失败",
    },
    {
        displayName: "飞书妙记",
        provider: "feishu-minutes",
        status: "needs-setup",
        statusLabel: "待设置",
    },
    {
        displayName: "讯飞听见",
        provider: "iflyrec",
        status: "expired",
        statusLabel: "需要重新登录",
    },
] as const;

const row117VoScriptReadyState = {
    privateTranscriptionApiKeySet: true,
    privateTranscriptionBaseUrl: "https://voscript.internal",
    privateTranscriptionDenoiseModel: "none",
    privateTranscriptionMaxInflightJobs: 1,
    privateTranscriptionMaxSpeakers: 0,
    privateTranscriptionMinSpeakers: 0,
    privateTranscriptionNoRepeatNgramSize: 0,
    privateTranscriptionSnrThreshold: null,
} as const;

const row117ProductDataSourcesFieldLabels = [
    "base URL",
    "浏览器授权",
    "网页登录材料",
    "设备标识",
    "自动更新",
    "标题更新回来源",
    "启用同步",
    "重新连接",
    "断开连接",
] as const;

const row117SotDataSourcesFieldLabels = [
    ...row117ProductDataSourcesFieldLabels,
] as const;

const row117DataSourcesVisibleActionLabels = [
    "测试连接",
    "保存",
    "重新连接",
    "断开连接",
] as const;

type Row117AppearanceReadyStateEvidence = {
    api: Record<keyof typeof row117AppearanceReadyState, unknown>;
    dom: {
        density: string | null;
        itemsPerPage: string;
        language: string;
        sortOrder: string;
        theme: string | null;
        timeStyle: string | null;
    };
};

type Row117DataSourcesReadyStateEvidence = {
    detail: {
        normalizedProvider: string | null;
        provider: string | null;
        status: string | null;
        statusLabel: string | null;
        title: string | null;
    };
    fieldLabels: string[];
    normalization: {
        normalized: string;
        raw: string;
        reason: string;
    }[];
    providers: {
        label: string | null;
        normalizedProvider: string | null;
        provider: string | null;
        status: string | null;
        statusLabel: string | null;
    }[];
    visibleActionLabels: string[];
};

type Row117VoScriptReadyStateEvidence = {
    baseUrl: string;
    keyActionText: string | null;
    keyStatusText: string | null;
    unavailableBannerVisible: boolean;
};

type Row117TranscriptionReadyStateEvidence = {
    autoTranscribeState: string | null;
    autoTranscribeChecked: string | null;
    languageState: string | null;
    languageText: string;
};

const row117PixelFrames = [
    {
        frame: "desktop-appearance-hash",
        section: "appearance",
        viewport: { height: 720, width: 1280 },
    },
    {
        frame: "mobile-data-sources-rail",
        section: "data-sources",
        viewport: { height: 844, width: 390 },
    },
    {
        frame: "desktop-appearance-immediate-save-pending",
        section: "appearance",
        viewport: { height: 720, width: 1280 },
    },
] as const;

function pngDataUrl(buffer: Buffer) {
    return `data:image/png;base64,${buffer.toString("base64")}`;
}

function sanitizeEvidenceName(name: string) {
    return name
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
}

async function readShellMetrics(locator: Locator) {
    return locator.evaluate((node) => {
        const element = node as HTMLElement;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const rail =
            element.querySelector<HTMLElement>(
                'nav[aria-label="设置"], nav[aria-label="Settings"]',
            ) ?? element.querySelector('[data-sot-panel="settings-rail"]');
        const selector =
            element.querySelector<HTMLElement>(
                '[role="combobox"][aria-label="设置部分"], [role="combobox"][aria-label="Settings section"]',
            ) ??
            element.querySelector(
                '[data-sot-control="settings-section-selector"], .settings-section-select',
            );
        const activeRail =
            element.querySelector<HTMLElement>(
                'nav[aria-label="设置"] button[aria-current="page"], nav[aria-label="Settings"] button[aria-current="page"]',
            ) ??
            element.querySelector(
                '.sr-item.active, [data-sot-control="settings-nav"][data-sot-state="selected"]',
            );
        const activeSection =
            element.querySelector<HTMLElement>(
                'section[aria-label][aria-busy]:not([hidden])',
            ) ??
            element.querySelector(
                '[data-sot-surface="settings-section"]:not([hidden]), [data-sot-surface="settings-data-sources"]:not([hidden]), .settings-main[data-section]:not([hidden])',
            );
        const save =
            element.querySelector<HTMLElement>('button[aria-busy="true"]') ??
            element.querySelector(
                '[data-sot-control="settings-save"][data-sot-state="saving"]',
            ) ??
            element.querySelector(
                '[data-sot-panel="source-actions"][data-sot-state="saving"]',
            ) ??
            element.querySelector(
                '[data-sot-panel="settings-save-actions"][data-sot-state="saving"]',
            );
        const error =
            element.querySelector<HTMLElement>('[role="alert"]') ??
            element.querySelector(
                '[data-sot-panel="settings-section-load-error"], [data-sot-banner][data-sot-tone="err"]',
            );
        const userSummaryText =
            element.querySelector("header")?.textContent?.replace(/\s+/g, " ").trim() ??
            null;
        const providerNormalization: Record<string, string> = {};
        const expectedActionLabelOrder = [
            "测试连接",
            "保存",
            "重新连接",
            "断开连接",
        ];

        function textOf(target: Element | null) {
            return target?.textContent?.replace(/\s+/g, " ").trim() || null;
        }

        function normalizeProvider(provider: string | null) {
            return provider ? (providerNormalization[provider] ?? provider) : null;
        }

        function isVisible(target: HTMLElement) {
            if (target.hidden) return false;
            const targetStyle = window.getComputedStyle(target);
            if (
                targetStyle.display === "none" ||
                targetStyle.visibility === "hidden"
            ) {
                return false;
            }
            const targetRect = target.getBoundingClientRect();
            return targetRect.width > 0 && targetRect.height > 0;
        }

        function dedupe(values: (string | null)[]) {
            return Array.from(
                new Set(
                    values.filter(
                        (value): value is string => Boolean(value?.trim()),
                    ),
                ),
            );
        }

        function orderByExpected(values: string[], expectedOrder: string[]) {
            const valueSet = new Set(values);
            const ordered = expectedOrder.filter((value) => valueSet.has(value));
            const orderedSet = new Set(ordered);
            return [
                ...ordered,
                ...values.filter((value) => !orderedSet.has(value)),
            ];
        }

        const dataSourcesRoot = element.querySelector<HTMLElement>(
            '[data-sot-surface="settings-data-sources"]',
        );
        const dataSourcesStructure = dataSourcesRoot
            ? (() => {
                  const providerCards = Array.from(
                      dataSourcesRoot.querySelectorAll<HTMLElement>(
                          '[data-sot-control="source-provider"]',
                      ),
                  ).map((providerCard) => {
                      const statusElement =
                          providerCard.querySelector<HTMLElement>(
                              "[data-sot-provider-status]",
                          );
                      const labelElement =
                          providerCard.querySelector<HTMLElement>(
                              "[data-sot-provider-name]",
                          );
                      const provider =
                          providerCard.getAttribute("data-sot-provider");

                      return {
                          label: textOf(labelElement),
                          normalizedProvider: normalizeProvider(provider),
                          provider,
                          status:
                              providerCard.getAttribute("data-sot-status") ??
                              statusElement?.getAttribute("data-sot-status") ??
                              null,
                          statusLabel: textOf(statusElement),
                      };
                  });
                  const activeProvider =
                      dataSourcesRoot
                          .querySelector<HTMLElement>(
                              '[data-sot-control="source-provider"][data-sot-state="selected"]',
                          )
                          ?.getAttribute("data-sot-provider") ??
                      null;
                  const detail = dataSourcesRoot.querySelector<HTMLElement>(
                      '[data-sot-panel="source-provider-detail"]',
                  );
                  const detailStatusElement =
                      detail?.querySelector<HTMLElement>("[data-sot-status]") ??
                      null;
                  const detailHead =
                      detail?.querySelector<HTMLElement>(
                          '[data-sot-part="source-provider-header"]',
                      ) ?? null;
                  const detailProvider =
                      detail?.getAttribute("data-sot-provider") ??
                      activeProvider;

                  return {
                      detail: {
                          normalizedProvider: normalizeProvider(detailProvider),
                          provider: detailProvider,
                          status:
                              detail?.getAttribute("data-sot-status") ??
                              detailHead?.getAttribute("data-sot-state") ??
                              detailStatusElement?.getAttribute(
                                  "data-sot-status",
                              ) ??
                              null,
                          statusLabel: textOf(detailStatusElement),
                          title: textOf(
                              detail?.querySelector(
                                  '[data-sot-part="source-provider-title"]',
                              ) ?? null,
                          ),
                      },
                      fieldLabels: dedupe(
                          Array.from(
                              dataSourcesRoot.querySelectorAll<HTMLElement>(
                                  '[data-slot="field-label"]',
                              ),
                          ).map(textOf),
                      ),
                      normalization: Object.entries(providerNormalization).map(
                          ([raw, normalized]) => ({
                              normalized,
                              raw,
                              reason:
                                  "SOT handoff uses legacy dingtalk provider id; product row117 seed uses dingtalk-a1.",
                          }),
                      ),
                      providers: providerCards,
                      visibleActionLabels: orderByExpected(
                          dedupe(
                              Array.from(
                                  dataSourcesRoot.querySelectorAll<HTMLElement>(
                                      'button[data-sot-control="source-test"], button[data-sot-control="source-save"], button[data-sot-control="source-reconnect"], button[data-sot-control="source-disconnect"], button[data-sot-control="source-auth-mode"]',
                                  ),
                              )
                                  .filter(isVisible)
                                  .map(textOf)
                                  .filter((label) =>
                                      label
                                          ? expectedActionLabelOrder.includes(label)
                                          : false,
                                  ),
                          ),
                          expectedActionLabelOrder,
                      ),
                  };
              })()
            : null;

        return {
            activeRailClass: activeRail?.getAttribute("class") ?? null,
            activeRailText: activeRail?.textContent?.trim() ?? null,
            activeSectionClass: activeSection?.getAttribute("class") ?? null,
            activeSectionDataSection:
                activeSection?.getAttribute("data-sot-section") ??
                activeSection?.getAttribute("data-section") ??
                null,
            backgroundColor: style.backgroundColor,
            borderRadius: style.borderRadius,
            boxShadow: style.boxShadow,
            className: element.getAttribute("class"),
            counts: {
                loadError: error ? 1 : 0,
                navControls:
                    rail?.querySelectorAll("button").length ||
                    element.querySelectorAll(
                        '[data-sot-control="settings-nav"], .sr-item',
                    ).length,
                saveSaving: save ? 1 : 0,
                sectionSelector: selector ? 1 : 0,
                settingsRail: rail ? 1 : 0,
            },
            dataSotSection: element.getAttribute("data-sot-section"),
            dataSotState: element.getAttribute("data-sot-state"),
            dataSourcesStructure,
            height: Math.ceil(rect.height),
            left: Math.round(rect.left),
            overflow: style.overflow,
            railDisplay: rail ? window.getComputedStyle(rail).display : null,
            role: element.getAttribute("role"),
            selectorDisplay: selector
                ? window.getComputedStyle(selector).display
                : null,
            top: Math.round(rect.top),
            userSummaryText,
            width: Math.ceil(rect.width),
        };
    });
}

async function captureShellFrame(
    locator: Locator,
    evidencePath: string,
) {
    await expect(locator).toBeVisible();
    await locator.page().waitForTimeout(150);
    const screenshot = await locator.screenshot({
        animations: "disabled",
        omitBackground: false,
        scale: "css",
    });
    await writeFile(evidencePath, screenshot);
    return {
        metrics: await readShellMetrics(locator),
        screenshot,
    };
}

type Row117ShellCapture = Awaited<ReturnType<typeof captureShellFrame>>;

function expectShadcnDialogBaseShadow(
    productCapture: Row117ShellCapture,
    sotCapture: Row117ShellCapture,
) {
    expect(productCapture.metrics.className).toContain("shadow-lg");
    expect(productCapture.metrics.className).not.toContain("[box-shadow");
    expect(productCapture.metrics.boxShadow).toContain(
        "rgba(0, 0, 0, 0.1) 0px 10px 15px -3px",
    );
    expect(productCapture.metrics.boxShadow).toContain(
        "rgba(0, 0, 0, 0.1) 0px 4px 6px -4px",
    );
    expect(productCapture.metrics.boxShadow).not.toBe(
        sotCapture.metrics.boxShadow,
    );
}

async function readDataSourcesStructuralEvidence(locator: Locator) {
    return locator.evaluate((node) => {
        const root = node as HTMLElement;
        const providerNormalization: Record<string, string> = {};
        const fieldLabelNormalization: Record<string, string> = {
            "DingTalk A1 service address": "base URL",
            "DingTalk sign-in credential": "网页登录材料",
            "Feishu Minutes web address": "base URL",
            "Feishu Open Platform address": "base URL",
            "Service URL": "base URL",
            "Sign-in method": "浏览器授权",
            "Title updates to source": "标题更新回来源",
            "登录方式": "浏览器授权",
            "服务地址": "base URL",
            "将改名回写到数据源": "标题更新回来源",
            "钉钉登录凭证": "网页登录材料",
            "钉钉闪记服务地址": "base URL",
            "飞书妙记网页地址": "base URL",
            "飞书开放平台地址": "base URL",
        };
        const expectedFieldLabelOrder = [
            "base URL",
            "浏览器授权",
            "网页登录材料",
            "设备标识",
            "自动更新",
            "标题更新回来源",
            "启用同步",
            "重新连接",
            "断开连接",
        ];
        const expectedActionLabelOrder = [
            "测试连接",
            "保存",
            "重新连接",
            "断开连接",
        ];

        function textOf(target: Element | null) {
            return target?.textContent?.replace(/\s+/g, " ").trim() || null;
        }

        function normalizeProvider(provider: string | null) {
            return provider ? (providerNormalization[provider] ?? provider) : null;
        }

        function normalizeFieldLabel(label: string | null) {
            return label ? (fieldLabelNormalization[label] ?? label) : null;
        }

        function orderByExpected(values: string[], expectedOrder: string[]) {
            const valueSet = new Set(values);
            const ordered = expectedOrder.filter((value) => valueSet.has(value));
            const orderedSet = new Set(ordered);
            return [
                ...ordered,
                ...values.filter((value) => !orderedSet.has(value)),
            ];
        }

        function isVisible(target: HTMLElement) {
            if (target.hidden) return false;
            const style = window.getComputedStyle(target);
            if (style.display === "none" || style.visibility === "hidden") {
                return false;
            }
            const rect = target.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        }

        function dedupe(values: (string | null)[]) {
            return Array.from(
                new Set(
                    values.filter(
                        (value): value is string => Boolean(value?.trim()),
                    ),
                ),
            );
        }

        function collectFieldLabels() {
            const stableLabels = Array.from(
                root.querySelectorAll<HTMLElement>(
                    '[data-slot="field-label"]',
                ),
            ).map((element) => normalizeFieldLabel(textOf(element)));

            if (stableLabels.length > 0) {
                return stableLabels;
            }

            const detail = root.querySelector<HTMLElement>(
                '[data-sot-panel="source-provider-detail"], #ds-detail, .sm-detail',
            );

            const fixtureLabels = Array.from(
                detail?.querySelectorAll<HTMLElement>(".field-name, .sm-l-t") ??
                    [],
            ).map((element) => normalizeFieldLabel(textOf(element)));

            if (fixtureLabels.length > 0) {
                return fixtureLabels;
            }

            return Array.from(
                detail?.querySelectorAll<HTMLElement>("input, button, select") ??
                    [],
            ).map((control) => {
                const label = control.parentElement?.parentElement
                    ?.firstElementChild?.firstElementChild;

                return normalizeFieldLabel(textOf(label));
            });
        }

        function collectVisibleActionLabels() {
            const stableActions = Array.from(
                root.querySelectorAll<HTMLElement>(
                    'button[data-sot-control="source-test"], button[data-sot-control="source-save"], button[data-sot-control="source-reconnect"], button[data-sot-control="source-disconnect"], button[data-sot-control="source-auth-mode"]',
                ),
            );
            const structuralActions = Array.from(
                root
                    .querySelector<HTMLElement>(
                        '[data-sot-panel="source-provider-detail"], #ds-detail, .sm-detail',
                    )
                    ?.querySelectorAll<HTMLElement>("button") ?? [],
            );

            return dedupe(
                [...stableActions, ...structuralActions]
                    .filter(isVisible)
                    .map(textOf)
                    .filter((label) =>
                        label
                            ? expectedActionLabelOrder.includes(label)
                            : false,
                    ),
            );
        }

        const stableProviderCards = Array.from(
            root.querySelectorAll<HTMLElement>(
                '[data-sot-control="source-provider"]',
            ),
        );
        const providerCards =
            stableProviderCards.length > 0
                ? stableProviderCards.map((providerCard) => {
                      const statusElement =
                          providerCard.querySelector<HTMLElement>(
                              "[data-sot-provider-status]",
                          );
                      const labelElement =
                          providerCard.querySelector<HTMLElement>(
                              "[data-sot-provider-name]",
                          );
                      const provider =
                          providerCard.getAttribute("data-sot-provider");

                      return {
                          label: textOf(labelElement),
                          normalizedProvider: normalizeProvider(provider),
                          provider,
                          status:
                              providerCard.getAttribute("data-sot-status") ??
                              statusElement?.getAttribute(
                                  "data-sot-status",
                              ) ??
                              null,
                          statusLabel: textOf(statusElement),
                      };
                  })
                : Array.from(
                      root.querySelectorAll<HTMLElement>(".sp-card"),
                  ).map((providerCard) => {
                      const statusElement =
                          providerCard.querySelector<HTMLElement>(".sp-status");
                      const labelElement =
                          providerCard.querySelector<HTMLElement>(".sp-name");
                      const provider =
                          providerCard.getAttribute("data-provider");
                      const statusLabel = textOf(statusElement);
                      const statusByLabel: Record<string, string> = {
                          "已连接": "connected",
                          "同步中": "syncing",
                          "同步失败": "error",
                          "待设置": "needs-setup",
                          "需要重新登录": "expired",
                          "同步已暂停": "disabled",
                          "已连接 · 暂无录音": "connected-empty",
                      };

                      return {
                          label: textOf(labelElement),
                          normalizedProvider: normalizeProvider(provider),
                          provider,
                          status: statusLabel
                              ? (statusByLabel[statusLabel] ?? null)
                              : null,
                          statusLabel,
                      };
                  });
        const activeProvider =
            root
                .querySelector<HTMLElement>(
                    '[data-sot-control="source-provider"][data-sot-state="selected"]',
                )
                ?.getAttribute("data-sot-provider") ??
            root
                .querySelector<HTMLElement>(".sp-card.active")
                ?.getAttribute("data-provider") ??
            null;
        const detail = root.querySelector<HTMLElement>(
            '[data-sot-panel="source-provider-detail"], #ds-detail, .sm-detail',
        );
        const detailStatusElement =
            detail?.querySelector<HTMLElement>("[data-sot-status], .sd-pill") ??
            null;
        const detailHead =
            detail?.querySelector<HTMLElement>(
                '[data-sot-part="source-provider-header"], .sd-head',
            ) ?? null;
        const detailProvider =
            detail?.getAttribute("data-sot-provider") ??
            activeProvider;

        return {
            detail: {
                normalizedProvider: normalizeProvider(detailProvider),
                provider: detailProvider,
                status:
                    detail?.getAttribute("data-sot-status") ??
                    detailHead?.getAttribute("data-sot-state") ??
                    detailHead?.getAttribute("data-ds-state") ??
                    detailStatusElement?.getAttribute("data-sot-status") ??
                    null,
                statusLabel: textOf(detailStatusElement),
                title: textOf(
                    detail?.querySelector(
                        '[data-sot-part="source-provider-title"], .sd-title',
                    ) ?? null,
                ),
            },
            fieldLabels: orderByExpected(
                dedupe(collectFieldLabels()).filter((label) =>
                    expectedFieldLabelOrder.includes(label),
                ),
                expectedFieldLabelOrder,
            ),
            normalization: Object.entries(providerNormalization).map(
                ([raw, normalized]) => ({
                    normalized,
                    raw,
                    reason:
                        "SOT handoff uses legacy dingtalk provider id; product row117 seed uses dingtalk-a1.",
                }),
            ),
            providers: providerCards,
            visibleActionLabels: orderByExpected(
                collectVisibleActionLabels(),
                expectedActionLabelOrder,
            ),
        } satisfies Row117DataSourcesReadyStateEvidence;
    });
}

function row117ProductDataSourceTile(
    providerList: Locator,
    provider: (typeof row117ProductDataSourceProviders)[number],
) {
    const escapeRegExp = (value: string) =>
        value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    return providerList.getByRole("button", {
        name: new RegExp(
            `^${escapeRegExp(provider.displayName)}.*${escapeRegExp(
                `${provider.displayName}: ${provider.statusLabel}`,
            )}$`,
        ),
    });
}

async function readProductDataSourcesStructuralEvidence(locator: Locator) {
    const providerList = locator.getByRole("complementary", {
        exact: true,
        name: "数据源列表",
    });
    const fieldLabels = new Set<string>();
    const visibleActionLabels = new Set<string>();
    const providers: Row117DataSourcesReadyStateEvidence["providers"] = [];

    for (const expectedProvider of row117ProductDataSourceProviders) {
        const providerTile = row117ProductDataSourceTile(
            providerList,
            expectedProvider,
        );
        await expect(providerTile).toHaveCount(1);
        await providerTile.click();
        await expect(providerTile).toHaveAttribute("aria-pressed", "true");

        const detail = locator.getByRole("region", {
            exact: true,
            name: expectedProvider.displayName,
        });
        const title = detail.getByRole("heading", {
            exact: true,
            level: 3,
            name: expectedProvider.displayName,
        });
        const status = detail
            .getByRole("status")
            .filter({ hasText: expectedProvider.statusLabel })
            .first();

        await expect(detail).toBeVisible();
        await expect(detail).toHaveAttribute("aria-busy", "false");
        await expect(title).toBeVisible();
        await expect(status).toBeVisible();
        await expect(status).toHaveText(expectedProvider.statusLabel);

        for (const fieldLabel of [
            "base URL",
            "浏览器授权",
            "网页登录材料",
            "设备标识",
        ] as const) {
            const field = detail.getByRole("textbox", {
                exact: true,
                name: fieldLabel,
            });
            if ((await field.count()) > 0) {
                await expect(field).toBeVisible();
                fieldLabels.add(fieldLabel);
            }
        }

        for (const fieldLabel of [
            "自动更新",
            "标题更新回来源",
            "启用同步",
        ] as const) {
            const field = detail.getByRole("switch", {
                exact: true,
                name: fieldLabel,
            });
            if ((await field.count()) > 0) {
                await expect(field).toBeVisible();
                fieldLabels.add(fieldLabel);
            }
        }

        const browserAuthorization = detail.getByRole("radio", {
            name: /^浏览器授权/,
        });
        if ((await browserAuthorization.count()) > 0) {
            await expect(browserAuthorization).toBeVisible();
            fieldLabels.add("浏览器授权");
        }

        for (const actionLabel of row117DataSourcesVisibleActionLabels) {
            const action = detail.getByRole("button", {
                exact: true,
                name: actionLabel,
            });
            if ((await action.count()) > 0) {
                await expect(action).toBeVisible();
                visibleActionLabels.add(actionLabel);
            }
        }

        for (const actionLabel of ["重新连接", "断开连接"] as const) {
            const action = detail.getByRole("button", {
                exact: true,
                name: actionLabel,
            });
            if ((await action.count()) > 0) {
                await expect(action).toBeVisible();
                fieldLabels.add(actionLabel);
            }
        }

        providers.push({
            label: expectedProvider.displayName,
            normalizedProvider: expectedProvider.provider,
            provider: expectedProvider.provider,
            status: expectedProvider.status,
            statusLabel: (await status.textContent())?.trim() ?? null,
        });
    }

    const dingtalkProvider = row117ProductDataSourceProviders[0];
    const dingtalkTile = row117ProductDataSourceTile(
        providerList,
        dingtalkProvider,
    );
    await expect(dingtalkTile).toHaveCount(1);
    await dingtalkTile.click();
    await expect(dingtalkTile).toHaveAttribute("aria-pressed", "true");
    const detail = locator.getByRole("region", {
        exact: true,
        name: dingtalkProvider.displayName,
    });
    const title = detail.getByRole("heading", {
        exact: true,
        level: 3,
        name: dingtalkProvider.displayName,
    });
    const status = detail
        .getByRole("status")
        .filter({ hasText: dingtalkProvider.statusLabel })
        .first();

    await expect(detail).toBeVisible();
    await expect(title).toBeVisible();
    await expect(status).toBeVisible();
    await expect(status).toHaveText(dingtalkProvider.statusLabel);

    return {
        detail: {
            normalizedProvider: dingtalkProvider.provider,
            provider: dingtalkProvider.provider,
            status: dingtalkProvider.status,
            statusLabel: (await status.textContent())?.trim() ?? null,
            title: (await title.textContent())?.trim() ?? null,
        },
        fieldLabels: row117ProductDataSourcesFieldLabels.filter((label) =>
            fieldLabels.has(label),
        ),
        normalization: [],
        providers,
        visibleActionLabels: row117DataSourcesVisibleActionLabels.filter(
            (label) => visibleActionLabels.has(label),
        ),
    } satisfies Row117DataSourcesReadyStateEvidence;
}

async function captureSotSettingsFrameIfAvailable(
    page: Page,
    section: CanonicalSettingsSection,
    viewport: Row117Viewport,
    evidencePath: string,
    options: { saveState?: "saving" } = {},
): Promise<
    | {
          blockerReason: null;
          capture: Row117ShellCapture;
      }
    | {
          blockerReason: string;
          capture: null;
      }
> {
    const shell = await openSotSettingsFrame(page, section, viewport, options);
    const metrics = await readShellMetrics(shell);

    if (metrics.activeSectionDataSection !== section) {
        return {
            blockerReason: `The handoff SOT Web/index shell does not expose an activatable ready-state fixture for ${section}.`,
            capture: null,
        };
    }

    return {
        blockerReason: null,
        capture: await captureShellFrame(shell, evidencePath),
    };
}

async function comparePngPixels(
    page: Page,
    expected: Buffer,
    actual: Buffer,
): Promise<Row117PixelDiff> {
    return page.evaluate(
        async ({ actualDataUrl, expectedDataUrl }) => {
            async function loadImage(src: string) {
                const image = new Image();
                image.decoding = "sync";
                image.src = src;
                await image.decode();
                return image;
            }

            const [expectedImage, actualImage] = await Promise.all([
                loadImage(expectedDataUrl),
                loadImage(actualDataUrl),
            ]);

            if (
                expectedImage.naturalHeight !== actualImage.naturalHeight ||
                expectedImage.naturalWidth !== actualImage.naturalWidth
            ) {
                return {
                    blockerReason: "SOT and product screenshots have different pixel dimensions.",
                    differingPixels: null,
                    dimensionsMatch: false,
                    expectedHeight: expectedImage.naturalHeight,
                    expectedWidth: expectedImage.naturalWidth,
                    maxChannelDelta: null,
                    productHeight: actualImage.naturalHeight,
                    productWidth: actualImage.naturalWidth,
                };
            }

            const canvas = document.createElement("canvas");
            canvas.width = expectedImage.naturalWidth;
            canvas.height = expectedImage.naturalHeight;
            const context = canvas.getContext("2d", {
                willReadFrequently: true,
            });
            if (!context) {
                throw new Error("Canvas 2D context unavailable");
            }

            context.drawImage(expectedImage, 0, 0);
            const expectedData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(actualImage, 0, 0);
            const actualData = context.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            ).data;

            let differingPixels = 0;
            let maxChannelDelta = 0;
            for (let index = 0; index < expectedData.length; index += 4) {
                const pixelDelta = Math.max(
                    Math.abs(expectedData[index] - actualData[index]),
                    Math.abs(expectedData[index + 1] - actualData[index + 1]),
                    Math.abs(expectedData[index + 2] - actualData[index + 2]),
                    Math.abs(expectedData[index + 3] - actualData[index + 3]),
                );
                if (pixelDelta > 0) {
                    differingPixels += 1;
                    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
                }
            }

            return {
                blockerReason: null,
                differingPixels,
                dimensionsMatch: true,
                expectedHeight: expectedImage.naturalHeight,
                expectedWidth: expectedImage.naturalWidth,
                maxChannelDelta,
                productHeight: actualImage.naturalHeight,
                productWidth: actualImage.naturalWidth,
            };
        },
        {
            actualDataUrl: pngDataUrl(actual),
            expectedDataUrl: pngDataUrl(expected),
        },
    );
}

async function openSotSettingsFrame(
    page: Page,
    section: string,
    viewport: Row117Viewport,
) {
    await page.setViewportSize(viewport);
    await page.goto(SOT_WEB_INDEX_URL, { waitUntil: "load" });
    await page.evaluate(
        ({ targetSection }) => {
            document.documentElement.dataset.theme = "dark";
            document.body.dataset.theme = "dark";
            const scrim = document.getElementById("settings-scrim");
            scrim?.setAttribute("data-open", "true");
            scrim?.setAttribute("aria-hidden", "false");
            scrim?.removeAttribute("inert");
            scrim?.removeAttribute("hidden");

            const fixtureRailClass = ["settings", "rail"].join("-");
            document
                .querySelector<HTMLElement>(
                    `.${fixtureRailClass} .sr-item[data-section="${targetSection}"]`,
                )
                ?.click();
        },
        { targetSection: section },
    );
    const shell = page.locator("#settings-scrim > .settings");
    await expect(shell).toBeVisible();
    return shell;
}

async function openProductSettingsSection(
    page: Page,
    section: string,
    viewport: Row117Viewport,
) {
    await page.setViewportSize(viewport);
    await page.goto(`/settings#${section}`, { waitUntil: "domcontentloaded" });
    const shell = settingsShell(page);
    await expect(shell).toBeVisible();
    await expect(settingsNav(page, section)).toHaveAttribute(
        "aria-current",
        "page",
    );
    const sectionSurface = settingsSectionSurface(
        page,
        section as CanonicalSettingsSection,
    );
    await expect(sectionSurface).toBeVisible();
    await expect(sectionSurface).toHaveAttribute("aria-busy", "false");
    await expectShellFitsViewport(page);
    return shell;
}

function row117EvidenceMarkdown(frames: Row117FrameEvidence[]) {
    const lines = [
        "# Settings Shell Visual Matrix Evidence 2026-06-11",
        "",
        "Scope: SOT row 117 Settings shell replacement acceptance. This evidence records responsive/mobile frame coverage plus a focused Settings shell screenshot/pixel matrix against the handoff Web/index target.",
        "",
        "## Frames",
        "",
        "| Frame | Stage | Parity type | Section | Viewport | Diff | Notes |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ];

    for (const frame of frames) {
        const diff = frame.diff
            ? frame.diff.blockerReason ??
              `${frame.diff.differingPixels} differing pixels, max delta ${frame.diff.maxChannelDelta}`
            : frame.blockerReason ?? "not compared";
        lines.push(
            `| ${frame.frame} | ${frame.stage} | ${frame.parityType} | ${frame.section} | ${frame.viewport.width}x${frame.viewport.height} | ${diff} | ${frame.notes.join("; ")} |`,
        );
    }

    lines.push(
        "",
        "## Acceptance Boundaries",
        "",
        "- Product runtime screenshots and SOT handoff screenshots are the row 117 acceptance inputs for Settings shell visual replacement.",
        "- The load-error/retry frame is structural product-runtime evidence because the handoff SOT shell has no dedicated load-error fixture for this exact state.",
        "- The immediate-save-pending frame is structural product-runtime evidence because the handoff SOT shell has no dedicated save-pending fixture and must not be compared with the ready-state SOT fixture.",
        "- Credential-backed real-provider test-success is covered by integration validation, not by this visual replacement matrix.",
    );

    return `${lines.join("\n")}\n`;
}

async function selectDesktopSettingsSection(page: Page, section: string) {
    const shell = settingsShell(page);
    const nav = settingsNav(page, section);

    for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(shell).toHaveAttribute("aria-busy", "false");
        await expect(nav).toBeEnabled();
        await nav.click();

        if ((await nav.getAttribute("aria-current")) === "page") {
            return;
        }

        await page.waitForTimeout(250);
    }

    await expect(nav).toHaveAttribute("aria-current", "page");
}

function settingsSectionSurface(page: Page, section: CanonicalSettingsSection) {
    if (section === "data-sources") {
        return settingsShell(page).getByRole("complementary").locator("..");
    }

    const shell = settingsShell(page);
    const headingSurface = shell
        .getByRole("heading", {
            level: 3,
            name: settingsSectionLabels[section],
        })
        .locator("..");

    return headingSurface.or(
        activeSettingsContentScrollContainer(page, section),
    );
}

async function expectActiveSettingsSectionReady(
    page: Page,
    section: CanonicalSettingsSection,
) {
    const surface = settingsSectionSurface(page, section);
    await expect(settingsNav(page, section)).toHaveAttribute("aria-current", "page");
    await expect(surface).toBeVisible();
    await expect(surface).toHaveAttribute("aria-busy", "false");
    return surface;
}

async function expectTitleGenerationReadyStoredKeyEvidence(page: Page) {
    const response = await page.request.get("/api/settings/title-generation");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as {
        titleGenerationApiKeySet?: unknown;
    };

    expect(payload.titleGenerationApiKeySet).toBe(true);

    const section = settingsSectionSurface(page, "title-generation");
    const storedStatus = section.getByRole("status");
    const apiKeyInput = section.getByLabel("重命名服务 API Key", {
        exact: true,
    });

    await expect(storedStatus).toBeVisible();
    await expect(storedStatus).toHaveText("已存储");
    await expect(apiKeyInput).toBeVisible();
    await expect(apiKeyInput).toBeEnabled();
    await expect(apiKeyInput).toHaveAttribute(
        "placeholder",
        /已存储。输入新 key 可替换。/,
    );

    return {
        apiTitleGenerationApiKeySet: payload.titleGenerationApiKeySet === true,
        placeholder: await apiKeyInput.getAttribute("placeholder"),
        storedKeyInputVisible: await apiKeyInput.isVisible(),
        storedStatusText: (await storedStatus.textContent())?.trim() ?? null,
    } satisfies Row117TitleGenerationStoredKeyEvidence;
}

async function expectRow117AppearanceReadyState(page: Page) {
    const response = await page.request.get("/api/settings/display");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject(row117AppearanceReadyState);

    const section = settingsSectionSurface(page, "appearance");
    const selectedTimeStyle = section
        .getByRole("radiogroup", { exact: true, name: "时间显示" })
        .getByRole("radio", { exact: true, name: "14:00" });
    const selectedDensity = section
        .getByRole("radiogroup", { exact: true, name: "信息密度" })
        .getByRole("radio", { exact: true, name: "宽松" });
    const selectedTheme = section
        .getByRole("radiogroup", { exact: true, name: "主题" })
        .getByRole("radio", { exact: true, name: "深色" });
    const itemsPerPage = section.locator("#display-items-per-page");
    const language = section.locator("#display-ui-language");
    const sortOrder = section.locator("#display-recording-list-sort-order");
    const selectedLanguageLabel = "简体中文";
    const selectedSortOrderLabel = "最新在前";

    await expect(selectedTimeStyle).toBeChecked();
    await expect(itemsPerPage).toHaveValue(
        String(row117AppearanceReadyState.itemsPerPage),
    );
    await expect(selectedDensity).toBeChecked();
    await expect(sortOrder).toContainText(selectedSortOrderLabel);
    await expect(language).toContainText(selectedLanguageLabel);
    await expect(selectedTheme).toBeChecked();

    return {
        api: {
            dateTimeFormat: payload.dateTimeFormat,
            displayDensity: payload.displayDensity,
            itemsPerPage: payload.itemsPerPage,
            recordingListSortOrder: payload.recordingListSortOrder,
            theme: payload.theme,
            uiLanguage: payload.uiLanguage,
        },
        dom: {
            density: (await selectedDensity.textContent())?.trim() ?? null,
            itemsPerPage: await itemsPerPage.inputValue(),
            language: (await language.textContent())?.trim() ?? "",
            sortOrder: (await sortOrder.textContent())?.trim() ?? "",
            theme: (await selectedTheme.textContent())?.trim() ?? null,
            timeStyle: (await selectedTimeStyle.textContent())?.trim() ?? null,
        },
    } satisfies Row117AppearanceReadyStateEvidence;
}

async function expectRow117TranscriptionReadyState(page: Page) {
    const section = settingsSectionSurface(page, "transcription");
    const autoTranscribe = section.locator("#transcription-auto-transcribe");
    const language = section.locator("#transcription-language");

    await expect(autoTranscribe).toHaveAttribute("role", "switch");
    await expect(autoTranscribe).toHaveAttribute("aria-checked", "true");
    await expect(language).toHaveAttribute("role", "combobox");
    await expect(language).toHaveAttribute("aria-expanded", "false");
    await expect(language).toContainText("自动检测");

    return {
        autoTranscribeChecked: await autoTranscribe.getAttribute(
            "aria-checked",
        ),
        autoTranscribeState: await autoTranscribe.getAttribute(
            "aria-checked",
        ),
        languageState: await language.getAttribute("aria-expanded"),
        languageText: (await language.textContent())?.trim() ?? "",
    } satisfies Row117TranscriptionReadyStateEvidence;
}

async function seedRow117ReadyStateRoutes(page: Page) {
    await page.route("**/api/data-sources", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ sources: row117DataSourcesReadyState }),
        });
    });

    await page.route("**/api/settings/voscript", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(row117VoScriptReadyState),
        });
    });

    await page.route("**/api/voiceprints", async (route) => {
        if (route.request().method() !== "GET") {
            await route.continue();
            return;
        }

        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                available: true,
                providerName: "VoScript",
                reason: null,
                voiceprints: [],
            }),
        });
    });
}

async function expectRow117DataSourcesReadyState(page: Page) {
    const section = settingsSectionSurface(page, "data-sources");
    const providerList = section.getByRole("complementary", {
        exact: true,
        name: "数据源列表",
    });
    const providerTiles = providerList.getByRole("button");
    await expect(providerTiles).toHaveCount(row117DataSourcesReadyState.length);

    for (const provider of row117ProductDataSourceProviders) {
        await expect(
            providerList.getByRole("status", {
                exact: true,
                name: `${provider.displayName}: ${provider.statusLabel}`,
            }),
        ).toBeVisible();
    }

    const dingtalkProvider = row117ProductDataSourceProviders[0];
    const dingtalkTile = row117ProductDataSourceTile(
        providerList,
        dingtalkProvider,
    );
    await expect(dingtalkTile).toHaveCount(1);
    await dingtalkTile.click();
    await expect(dingtalkTile).toHaveAttribute("aria-pressed", "true");
    const detail = section.getByRole("region", {
        exact: true,
        name: dingtalkProvider.displayName,
    });
    const detailStatus = detail
        .getByRole("status")
        .filter({ hasText: dingtalkProvider.statusLabel })
        .first();
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute("aria-busy", "false");
    await expect(
        detail.getByRole("heading", {
            exact: true,
            level: 3,
            name: dingtalkProvider.displayName,
        }),
    ).toBeVisible();
    await expect(detailStatus).toBeVisible();
    await expect(detailStatus).toHaveText(dingtalkProvider.statusLabel);

    const evidence = await readProductDataSourcesStructuralEvidence(section);
    expect(evidence.providers.map((provider) => provider.normalizedProvider)).toEqual(
        ["dingtalk-a1", "ticnote", "plaud", "feishu-minutes", "iflyrec"],
    );
    const productProvidersById = new Map(
        evidence.providers.map((provider) => [
            provider.normalizedProvider,
            provider,
        ]),
    );
    expect(productProvidersById.get("ticnote")).toMatchObject({
        status: "syncing",
        statusLabel: "同步中",
    });
    expect(productProvidersById.get("plaud")).toMatchObject({
        status: "error",
        statusLabel: "同步失败",
    });
    expect(evidence.detail.normalizedProvider).toBe("dingtalk-a1");
    expect(evidence.detail.status).toBe("connected");
    expect(evidence.fieldLabels).toEqual([
        ...row117ProductDataSourcesFieldLabels,
    ]);
    expect(evidence.visibleActionLabels).toEqual([
        ...row117DataSourcesVisibleActionLabels,
    ]);

    return evidence;
}

async function expectRow117SotDataSourcesReadyState(page: Page) {
    const section = page.locator(
        '#settings-scrim > .settings .settings-main[data-section="data-sources"]',
    );
    await expect(section).toBeVisible();
    const evidence = await readDataSourcesStructuralEvidence(section);
    expect(evidence.providers).toHaveLength(row117DataSourcesReadyState.length);
    expect(evidence.providers.map((provider) => provider.normalizedProvider)).toEqual(
        ["dingtalk-a1", "ticnote", "plaud", "feishu-minutes", "iflyrec"],
    );
    expect(evidence.detail.normalizedProvider).toBe("dingtalk-a1");
    expect(evidence.fieldLabels).toEqual([...row117SotDataSourcesFieldLabels]);
    expect(evidence.visibleActionLabels).toEqual([
        ...row117DataSourcesVisibleActionLabels,
    ]);

    return evidence;
}

async function expectRow117VoScriptReadyState(page: Page) {
    const section = settingsSectionSurface(page, "voscript");
    const baseUrl = section.getByRole("textbox", {
        exact: true,
        name: "VoScript 服务地址",
    });
    const keyStatus = section
        .getByRole("status")
        .filter({ hasText: "已存储" });
    const unavailableBanner = section.getByRole("status", {
        name: /VoScript 当前不可用/,
    });
    const keyActionControl = section.getByRole("combobox", {
        exact: true,
        name: "密钥操作",
    });
    const keyActionRow = keyActionControl;
    const apiKey = section.getByRole("textbox", {
        exact: true,
        name: "VoScript API Key",
    });

    await expect(baseUrl).toHaveValue(
        row117VoScriptReadyState.privateTranscriptionBaseUrl,
    );
    await expect(baseUrl).toBeEnabled();
    await expect(section).toHaveAttribute("aria-busy", "false");
    await expect(keyStatus).toHaveCount(1);
    await expect(keyStatus).toContainText("已存储");
    await expect(apiKey).toBeEnabled();
    await expect(apiKey).toHaveAttribute(
        "placeholder",
        /已存储。输入新 key 可替换。/,
    );
    await expect(unavailableBanner).toHaveCount(0);
    const unavailableBannerVisible = await unavailableBanner.isVisible();
    await expect(keyActionRow).toBeVisible();
    await expect(keyActionControl).toContainText("保留或替换");

    return {
        baseUrl: await baseUrl.inputValue(),
        keyActionText: (await keyActionRow.textContent())?.trim() ?? null,
        keyStatusText: (await keyStatus.textContent())?.trim() ?? null,
        unavailableBannerVisible,
    } satisfies Row117VoScriptReadyStateEvidence;
}

async function expectRow117SotVoScriptReadyState(page: Page) {
    const section = page.locator(
        '#settings-scrim > .settings .settings-main[data-section="voscript"]',
    );
    await expect(section).toBeVisible();
    const baseUrl = section.locator('[data-field="voscript-url"] input');
    const keyStatus = section.locator(".sm-key-status");
    const unavailableBanner = section.locator(".sm-banner-unavailable");
    const keyActionRow = section.locator('[data-field="voscript-key-action"]');
    const keyActionControl = keyActionRow.locator("select");

    await expect(baseUrl).toHaveValue(
        row117VoScriptReadyState.privateTranscriptionBaseUrl,
    );
    await expect(keyStatus).toContainText("已存储");
    await expect(unavailableBanner).toBeHidden();
    await expect(keyActionRow).toBeVisible();
    await expect(keyActionControl).toBeVisible();

    return {
        baseUrl: await baseUrl.inputValue(),
        keyActionText: (await keyActionRow.textContent())?.trim() ?? null,
        keyStatusText: (await keyStatus.textContent())?.trim() ?? null,
        unavailableBannerVisible: await unavailableBanner.isVisible(),
    } satisfies Row117VoScriptReadyStateEvidence;
}

async function countSettingsLegacySelectors(surface: Locator) {
    const counts: Record<string, number> = {};

    for (const selector of settingsLegacySelectors) {
        const count = await surface.locator(selector).count();
        counts[selector] = count;
        expect(count, `${selector} should not be inside the active Settings section`).toBe(
            0,
        );
    }

    return counts;
}

async function readRepresentativeTargetEvidence(
    surface: Locator,
    target: SectionRepresentativeTarget,
): Promise<RepresentativeTargetEvidence> {
    const locator = target.getLocator(surface);
    const count = await locator.count();
    expect(
        count,
        `${target.name} should exist for ${target.selector}`,
    ).toBeGreaterThanOrEqual(target.minCount ?? 1);
    await expect(locator.first()).toBeVisible();
    await target.assertSemantics?.(surface, locator);

    const tagName = await locator
        .first()
        .evaluate((node) => node.tagName.toLowerCase())
        .catch(() => null);

    return {
        count,
        name: target.name,
        selector: target.selector,
        tagName,
    };
}

async function readSectionAcceptanceEvidence(
    page: Page,
    section: CanonicalSettingsSection,
    navigationMode: SectionAcceptanceEvidence["navigationMode"],
): Promise<SectionAcceptanceEvidence> {
    const target = sectionAcceptanceTargets[section];
    const surface = await expectActiveSettingsSectionReady(page, section);
    const representativeTargets: RepresentativeTargetEvidence[] = [];

    for (const representativeTarget of target.representativeTargets) {
        representativeTargets.push(
            await readRepresentativeTargetEvidence(surface, representativeTarget),
        );
    }

    return {
        navigationMode,
        navState: await settingsNav(page, section).getAttribute("aria-current"),
        oldSelectorCounts: await countSettingsLegacySelectors(surface),
        representativeTargets,
        section,
        sectionState:
            (await surface.getAttribute("aria-busy")) === "true"
                ? "busy"
                : "ready",
        shellState:
            (await settingsShell(page).getAttribute("aria-busy")) === "true"
                ? "busy"
                : "idle",
        surface: target.surface,
    };
}

function settingsSixSectionAcceptanceMarkdown(evidence: {
    acceptanceBoundaries: string[];
    dataSourcesCredentialSafeTestSuccess: Row117DataSourcesCredentialSafeTestSuccessEvidence;
    generatedAt: string;
    loadErrorRetry: LoadErrorRetryEvidence;
    sections: SectionAcceptanceEvidence[];
}) {
    const lines = [
        "# Settings Shell Six-Section Acceptance Evidence",
        "",
        `Generated: ${evidence.generatedAt}`,
        "",
        "Scope: Settings shell six-section SOT acceptance. This records runtime shell/section readiness, navigation, old-selector absence, representative SOT controls, and title-generation load-error/retry structure.",
        "",
        "## Sections",
        "",
        "| Section | Navigation | Surface | Section state | Nav state | Representative targets | Old selector counts |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ];

    for (const sectionEvidence of evidence.sections) {
        const targets = sectionEvidence.representativeTargets
            .map((target) => `${target.name}:${target.count}`)
            .join(", ");
        const oldCounts = Object.entries(sectionEvidence.oldSelectorCounts)
            .map(([selector, count]) => `${selector}:${count}`)
            .join(", ");
        lines.push(
            `| ${sectionEvidence.section} | ${sectionEvidence.navigationMode} | ${sectionEvidence.surface} | ${sectionEvidence.sectionState} | ${sectionEvidence.navState} | ${targets} | ${oldCounts} |`,
        );
    }

    lines.push(
        "",
        "## Load Error / Retry",
        "",
        `- Section: ${evidence.loadErrorRetry.section}`,
        `- States: ${evidence.loadErrorRetry.states.join(" -> ")}`,
        `- Retry visible: ${evidence.loadErrorRetry.retryVisible}`,
        `- Error panel visible: ${evidence.loadErrorRetry.errorPanelVisible}`,
        `- Normal title-generation controls in error: ${evidence.loadErrorRetry.normalControlCountInError}`,
        `- Retry returned ready: ${evidence.loadErrorRetry.retryReturnedReady}`,
        "",
        "## Data Sources Credential-Safe Test Success",
        "",
        `- Coverage source: ${evidence.dataSourcesCredentialSafeTestSuccess.coverageSource.file}`,
        `- Route mock: ${evidence.dataSourcesCredentialSafeTestSuccess.routeMockedSuccess.endpoint} -> success=${evidence.dataSourcesCredentialSafeTestSuccess.routeMockedSuccess.responseShape.success}`,
        `- Fake credential only: ${evidence.dataSourcesCredentialSafeTestSuccess.credentialPolicy.fakeCredentialOnly}`,
        `- Real credentials used: ${evidence.dataSourcesCredentialSafeTestSuccess.credentialPolicy.realCredentialsUsed}`,
        `- Row117 evidence stores secret values: ${evidence.dataSourcesCredentialSafeTestSuccess.credentialPolicy.row117EvidenceStoresSecretValues}`,
        "",
        "### Source Tests",
        "",
        ...evidence.dataSourcesCredentialSafeTestSuccess.coverageSource.tests.map(
            (sourceTest) =>
                `- ${sourceTest.name}: ${sourceTest.readback.join(" ")}`,
        ),
        "",
        "### Tracked Source Verification",
        "",
        `- File: ${evidence.dataSourcesCredentialSafeTestSuccess.trackedSourceVerification?.file ?? "not verified"}`,
        `- Blocked fake secret literals checked: ${evidence.dataSourcesCredentialSafeTestSuccess.trackedSourceVerification?.blockedSecretLiteralCount ?? 0}`,
        `- Live credential-backed provider success claimed: ${evidence.dataSourcesCredentialSafeTestSuccess.trackedSourceVerification?.liveCredentialBackedProviderSuccessClaimed ?? false}`,
        "",
        ...(
            evidence.dataSourcesCredentialSafeTestSuccess
                .trackedSourceVerification?.tests ?? []
        ).map(
            (sourceTest) =>
                `- ${sourceTest.name}: ${sourceTest.contractChecks.join("; ")}`,
        ),
        "",
        "### Success State Readback",
        "",
        ...evidence.dataSourcesCredentialSafeTestSuccess.successStateReadback.map(
            (readback) => `- ${readback}`,
        ),
        "",
        "### Busy / Unlock Readback",
        "",
        ...evidence.dataSourcesCredentialSafeTestSuccess.busyAndUnlockReadback.map(
            (readback) => `- ${readback}`,
        ),
        "",
        "### Payload Shape Readback",
        "",
        "| Provider | Auth mode | Config keys | Secret keys | Saved by test-success |",
        "| --- | --- | --- | --- | --- |",
        ...evidence.dataSourcesCredentialSafeTestSuccess.payloadShapeReadback.map(
            (payload) =>
                `| ${payload.provider} | ${payload.authMode} | ${payload.configKeys.join(", ")} | ${payload.secretKeys.join(", ")} | ${payload.savedByTestSuccess} |`,
        ),
        "",
        "### Non-Claims",
        "",
        ...evidence.dataSourcesCredentialSafeTestSuccess.nonClaims.map(
            (nonClaim) => `- ${nonClaim}`,
        ),
        "",
        "## Acceptance Boundaries",
        "",
        ...evidence.acceptanceBoundaries.map((boundary) => `- ${boundary}`),
    );

    return `${lines.join("\n")}\n`;
}

async function expectShellFitsViewport(page: Page) {
    await expect
        .poll(async () => {
            const metrics = await settingsShellViewportBox(page);
            return (
                metrics.width > 0 &&
                metrics.height > 0 &&
                metrics.top >= 0 &&
                metrics.left >= 0 &&
                metrics.bottom <= metrics.viewportHeight &&
                metrics.right <= metrics.viewportWidth
            );
        })
        .toBe(true);
    const metrics = await settingsShellViewportBox(page);

    expect(metrics.width).toBeGreaterThan(0);
    expect(metrics.height).toBeGreaterThan(0);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth);
}

async function settingsShellLayoutMetrics(
    page: Page,
    section: CanonicalSettingsSection,
) {
    const shell = settingsShell(page);
    const rail = shell.getByRole("navigation", {
        name: /^(设置|Settings)$/,
    });
    const [shellRect, headerRect, bodyRect, railRect, activeRect] =
        await Promise.all([
            shell.boundingBox(),
            shell.getByRole("banner").boundingBox(),
            rail.locator("..").boundingBox(),
            rail.boundingBox(),
            settingsSectionSurface(page, section).boundingBox(),
        ]);

    if (!shellRect || !headerRect || !bodyRect || !railRect || !activeRect) {
        throw new Error("Settings shell layout regions are incomplete.");
    }

    return {
        activeLeft: activeRect.x,
        activeRight: activeRect.x + activeRect.width,
        activeWidth: activeRect.width,
        bodyBottom: bodyRect.y + bodyRect.height,
        bodyLeft: bodyRect.x,
        bodyRight: bodyRect.x + bodyRect.width,
        bodyTop: bodyRect.y,
        headerBottom: headerRect.y + headerRect.height,
        headerLeft: headerRect.x,
        headerRight: headerRect.x + headerRect.width,
        railBottom: railRect.y + railRect.height,
        railLeft: railRect.x,
        railRight: railRect.x + railRect.width,
        railTop: railRect.y,
        shellBottom: shellRect.y + shellRect.height,
        shellLeft: shellRect.x,
        shellRight: shellRect.x + shellRect.width,
        shellTop: shellRect.y,
    };
}

test("settings shell closes sibling overlays, locks height, bounds wheel scroll, and returns focus", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 640 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    const dashboardHydrated = waitForDashboardHydration(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await dashboardHydrated;
    await clearSettingsPersistence(page);

    const searchTrigger = page
        .getByRole("button", { name: /^(搜索|Search)$/ })
        .first();
    const activityTrigger = page.getByRole("button", {
        name: /^(通知|Notifications)$/,
    });
    const settingsTrigger = page.getByRole("button", {
        includeHidden: true,
        name: /^(打开设置|Open settings)$/,
    });

    const searchPanel = page.getByRole("dialog", {
        name: /^(搜索库|Search library)$/,
    });
    const activityPanel = page.getByRole("dialog", {
        name: /^(最近动态|Recent activity)$/,
    });

    await openPanelWithRetry(searchTrigger, searchPanel);
    await expect(searchPanel).toBeVisible();

    await openPanelWithRetry(activityTrigger, activityPanel);
    await expect(searchPanel).toBeHidden();
    await expect(activityPanel).toBeVisible();

    await settingsTrigger.click();
    const shell = settingsShell(page);
    await expect(activityPanel).toBeHidden();
    await expect(shell).toBeVisible();
    await settingsTrigger.focus();
    await expect
        .poll(() => settingsFocusIsContained(page))
        .toBe(true);
    await expectSettingsHeaderSotCopy(shell);
    await expect(settingsTrigger).toHaveText("P");

    await expect
        .poll(async () => {
            const metrics = await settingsShellViewportMetrics(page);
            return metrics.height / metrics.viewportHeight;
        })
        .toBeGreaterThan(0.93);
    const baselineMetrics = await settingsShellViewportMetrics(page);
    const baselineHeight = baselineMetrics.height;
    expect(baselineHeight).toBeGreaterThan(
        baselineMetrics.viewportHeight * 0.93,
    );
    expect(baselineHeight).toBeLessThanOrEqual(
        baselineMetrics.viewportHeight,
    );
    const expectedHeight = Math.min(
        baselineMetrics.viewportHeight * 0.94,
        980,
        baselineMetrics.viewportHeight - 16,
    );
    await expect
        .poll(() => settingsShellHeight(page))
        .toBeCloseTo(expectedHeight, 0);
    const settledBaselineHeight = await settingsShellHeight(page);
    await expectActiveSettingsSectionReady(page, "data-sources");
    const closeButton = shell.getByRole("button", {
        name: /^(关闭设置|Close settings)$/,
    });
    await expect(closeButton).toBeEnabled();

    await settingsNav(page, "voscript").click();
    const voscriptSurface = await expectActiveSettingsSectionReady(
        page,
        "voscript",
    );
    await expectShellHeightStable(page, settledBaselineHeight);
    await scrollIfScrollable(voscriptSurface);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(0);

    await settingsNav(page, "appearance").click();
    const appearanceSurface = await expectActiveSettingsSectionReady(
        page,
        "appearance",
    );
    await expectShellHeightStable(page, settledBaselineHeight);
    await expect.poll(() => elementScrollTop(appearanceSurface)).toBe(0);
    await expect(settingsSectionSurface(page, "data-sources")).toBeHidden();

    await settingsNav(page, "data-sources").click();
    const dataSourcesSurface = await expectActiveSettingsSectionReady(
        page,
        "data-sources",
    );
    await expectShellHeightStable(page, settledBaselineHeight);
    const dataSourceDetailScroll = dataSourcesSurface.getByRole("region", {
        name: dataSourceProviderName,
    });
    await scrollIfScrollable(dataSourceDetailScroll);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(0);
    await expectShellHeightStable(page, settledBaselineHeight);
    await expect(settingsNav(page, "data-sources")).toHaveAttribute(
        "aria-current",
        "page",
    );

    await settingsNav(page, "appearance").click();
    await expectActiveSettingsSectionReady(page, "appearance");
    await settingsNav(page, "data-sources").click();
    const resetDataSourcesSurface = await expectActiveSettingsSectionReady(
        page,
        "data-sources",
    );
    await expect
        .poll(() =>
            elementScrollTop(
                resetDataSourcesSurface.getByRole("region", {
                    name: dataSourceProviderName,
                }),
            ),
        )
        .toBe(0);
    await expectShellHeightStable(page, settledBaselineHeight);

    await closeButton.click();
    await expect(settingsShell(page)).toHaveCount(0);
    await expect(settingsTrigger).toBeFocused();
    await expect(page.locator('[data-aria-hidden="true"]')).toHaveCount(0);

    await settingsTrigger.click();
    await expect(settingsShell(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(settingsShell(page)).toHaveCount(0);
    await expect(settingsTrigger).toBeFocused();

    await settingsTrigger.click();
    await expect(settingsShell(page)).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(settingsShell(page)).toHaveCount(0);
    await expect(settingsTrigger).toBeFocused();
    await expect(page.locator('[data-aria-hidden="true"]')).toHaveCount(0);
});

test("settings data source nested scroll containers reset without freezing", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await putRow117AppearanceReadyState(page);
    await clearSettingsPersistence(page);
    await page.goto("/settings#data-sources", { waitUntil: "domcontentloaded" });

    const shell = settingsShell(page);
    const section = settingsSectionSurface(page, "data-sources");
    await expect(shell).toBeVisible();
    await expectActiveSettingsSectionReady(page, "data-sources");
    const baselineHeight = await settingsShellHeight(page);

    const providerListScroll = section.getByRole("complementary");
    const providerListScrolled = await scrollIfScrollable(providerListScroll);

    const providerDetailScroll = section.getByRole("region", {
        name: dataSourceProviderName,
    });
    const providerDetailScrolled =
        await scrollIfScrollable(providerDetailScroll);

    const providerButtons = providerListScroll.getByRole("button");
    expect(await providerButtons.count()).toBeGreaterThan(1);
    await expect(
        providerListScroll.getByRole("button", { pressed: true }),
    ).toHaveCount(1);
    const nextProvider = providerListScroll
        .getByRole("button", { pressed: false })
        .first();
    await nextProvider.click();
    await expect(nextProvider).toHaveAttribute("aria-pressed", "true");
    await expect(
        providerListScroll.getByRole("button", { pressed: true }),
    ).toHaveCount(1);
    await expect(providerDetailScroll).toHaveAccessibleName(
        dataSourceProviderName,
    );
    if (providerDetailScrolled) {
        await expect.poll(() => elementScrollTop(providerDetailScroll)).toBe(0);
    }
    await expectShellHeightStable(page, baselineHeight);

    await settingsNav(page, "appearance").click();
    await settingsNav(page, "data-sources").click();
    if (providerListScrolled) {
        await expect.poll(() => elementScrollTop(providerListScroll)).toBe(0);
    }
    await expect.poll(() => elementScrollTop(providerDetailScroll)).toBe(0);
    await expectShellHeightStable(page, baselineHeight);
});

test("settings dialog locks a pre-scrolled page while preserving internal scroll", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 640 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    const dashboardHydrated = waitForDashboardHydration(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await dashboardHydrated;
    await clearSettingsPersistence(page);

    await page.evaluate(() => {
        const spacer = document.createElement("div");
        spacer.style.height = "1800px";
        spacer.style.pointerEvents = "none";
        document.body.append(spacer);
        window.scrollTo(0, 320);
    });
    await expect.poll(() => windowScrollY(page)).toBeGreaterThan(250);

    const shell = settingsShell(page);
    const settingsTrigger = page.getByRole("button", {
        name: /^(打开设置|Open settings)$/,
    });
    await openPanelWithRetry(settingsTrigger, shell);
    await expect(shell).toBeVisible();

    const lockedScrollY = await windowScrollY(page);
    await page.mouse.move(20, 20);
    await page.mouse.wheel(0, 900);
    await expect.poll(() => windowScrollY(page)).toBe(lockedScrollY);

    await settingsNav(page, "voscript").click();
    const settingsScrollBody = await expectActiveSettingsSectionReady(
        page,
        "voscript",
    );
    await scrollIfScrollable(settingsScrollBody);
    await expect.poll(() => windowScrollY(page)).toBe(lockedScrollY);

    await shell
        .getByRole("button", { name: /^(关闭设置|Close settings)$/ })
        .click();
    await expect(shell).toBeHidden();
    await page.mouse.move(20, 20);
    await page.mouse.wheel(0, 900);
    await expect.poll(() => windowScrollY(page)).toBeGreaterThan(lockedScrollY);
});

test("settings shell holds a delayed real display PUT through GET readback and reload", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 640 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await clearSettingsPersistence(page);

    let releaseSave = () => {};
    let notifySaveStarted = () => {};
    const saveStarted = new Promise<void>((resolve) => {
        notifySaveStarted = resolve;
    });
    const pendingSave = new Promise<void>((resolve) => {
        releaseSave = resolve;
    });

    const displayRoute = "**/api/settings/display";
    await page.route(displayRoute, async (route) => {
        if (route.request().method() !== "PUT") {
            await route.continue();
            return;
        }

        const payload = route.request().postDataJSON();
        if (payload?.itemsPerPage !== 42) {
            await route.continue();
            return;
        }

        notifySaveStarted();
        await pendingSave;
        const response = await route.fetch();
        await route.fulfill({ response });
    });

    try {
        await page.goto("/settings#appearance", {
            waitUntil: "domcontentloaded",
        });
        const shell = settingsShell(page);
        await expect(shell).toBeVisible();
        const appearanceSurface = await expectActiveSettingsSectionReady(
            page,
            "appearance",
        );
        const itemsPerPageInput = page.locator("#display-items-per-page");
        await expect(itemsPerPageInput).toHaveValue("50");
        await expect(
            appearanceSurface.getByRole("button", {
                name: /^(保存|Save)$/,
            }),
        ).toHaveCount(0);
        await expect(
            appearanceSurface.getByText(
                /^(保存中|Saving|已保存|Saved|保存失败|Save failed)$/,
            ),
        ).toBeHidden();

        const realPutResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/display") &&
                response.request().method() === "PUT" &&
                response.request().postDataJSON()?.itemsPerPage === 42,
        );
        await itemsPerPageInput.fill("42");
        await saveStarted;
        await expect(shell).toHaveAttribute("aria-busy", "true");
        await expect(appearanceSurface).toHaveAttribute("aria-busy", "true");
        await expect(settingsNav(page, "misc")).toBeDisabled();
        await expect(
            shell.getByRole("button", {
                name: /^(关闭设置|Close settings)$/,
            }),
        ).toBeDisabled();
        await expect(
            appearanceSurface.getByText(/^(保存中|Saving)$/),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(shell).toBeVisible();
        await settingsNav(page, "misc").evaluate(
            (node) => (node as HTMLButtonElement).click(),
        );
        await expect(settingsNav(page, "appearance")).toHaveAttribute(
            "aria-current",
            "page",
        );
        await expect(appearanceSurface).toBeVisible();
        await expect(itemsPerPageInput).toBeDisabled();

        releaseSave();
        expect((await realPutResponse).ok()).toBe(true);
        await expect(shell).toHaveAttribute("aria-busy", "false");
        await expect(appearanceSurface).toHaveAttribute("aria-busy", "false");
        await expect(
            appearanceSurface.getByText(/^(已保存|Saved)$/),
        ).toBeVisible();
        await expect(itemsPerPageInput).toBeEnabled();
        await expect(settingsNav(page, "misc")).toBeEnabled();
        await expect(
            shell.getByRole("button", {
                name: /^(关闭设置|Close settings)$/,
            }),
        ).toBeEnabled();

        const readbackResponse = await page.request.get(
            "/api/settings/display",
        );
        expect(readbackResponse.ok()).toBe(true);
        expect(await readbackResponse.json()).toMatchObject({
            itemsPerPage: 42,
        });

        const reloadGetResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/display") &&
                response.request().method() === "GET" &&
                response.ok(),
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await reloadGetResponse;
        await expect(itemsPerPageInput).toHaveValue("42");
        await expectActiveSettingsSectionReady(page, "appearance");
    } finally {
        releaseSave();
        await page.unroute(displayRoute);
        const restoreResponse = await page.request.put(
            "/api/settings/display",
            {
                data: { itemsPerPage: 50 },
            },
        );
        expect(restoreResponse.ok()).toBe(true);
        const restoredReadback = await page.request.get(
            "/api/settings/display",
        );
        expect(restoredReadback.ok()).toBe(true);
        expect(await restoredReadback.json()).toMatchObject({
            itemsPerPage: 50,
        });
    }
});

test("Title Generation saves a semantic form payload while controls stay busy", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await clearSettingsPersistence(page);

    const titleGenerationRoute = "**/api/settings/title-generation";
    let releaseSave = () => {};
    let notifySaveStarted = () => {};
    let capturedPayload: Record<string, unknown> | null = null;
    const saveStarted = new Promise<void>((resolve) => {
        notifySaveStarted = resolve;
    });
    const pendingSave = new Promise<void>((resolve) => {
        releaseSave = resolve;
    });

    await page.route(titleGenerationRoute, async (route) => {
        if (route.request().method() !== "PUT") {
            await route.continue();
            return;
        }

        capturedPayload = route.request().postDataJSON() as Record<
            string,
            unknown
        >;
        notifySaveStarted();
        await pendingSave;
        await route.fulfill({
            body: JSON.stringify({ success: true }),
            contentType: "application/json",
            status: 200,
        });
    });

    try {
        await page.goto("/settings#transcription", {
            waitUntil: "domcontentloaded",
        });
        await expectActiveSettingsSectionReady(page, "transcription");

        const titleGenerationLoad = page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/title-generation") &&
                response.request().method() === "GET" &&
                response.ok(),
        );
        await settingsNav(page, "title-generation").click();
        await titleGenerationLoad;

        const titleSection = await expectActiveSettingsSectionReady(
            page,
            "title-generation",
        );
        const automaticRename = titleSection.getByRole("switch", {
            name: /^(基于逐字稿自动重命名|Automatically rename from transcripts)$/,
        });
        const serviceUrl = titleSection.getByRole("textbox", {
            name: /^(重命名服务地址|Rename service URL)$/,
        });
        const model = titleSection.getByRole("textbox", {
            name: /^(重命名模型|Rename model)$/,
        });
        const apiKey = titleSection.getByLabel(
            /^(重命名服务 API Key|Rename service API key)$/,
        );
        const saveAction = titleSection.getByRole("button", {
            name: /^(保存|Save|保存中|Saving|已保存|Saved)$/,
        });

        const autoRenameWasEnabled =
            (await automaticRename.getAttribute("aria-checked")) === "true";
        await automaticRename.click();
        await expect(automaticRename).toHaveAttribute(
            "aria-checked",
            autoRenameWasEnabled ? "false" : "true",
        );
        await serviceUrl.fill("https://title-generation.example.test/v1");
        await model.fill("e2e-title-generation-model");
        await expect(apiKey).toHaveAttribute("type", "password");
        await apiKey.fill("e2e-title-generation-new-key");

        const saveResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/title-generation") &&
                response.request().method() === "PUT",
        );
        await saveAction.click();
        await saveStarted;

        expect(capturedPayload).toMatchObject({
            autoGenerateTitle: !autoRenameWasEnabled,
            titleGenerationBaseUrl: "https://title-generation.example.test/v1",
            titleGenerationModel: "e2e-title-generation-model",
        });
        expect(
            Object.hasOwn(capturedPayload ?? {}, "titleGenerationApiKey"),
        ).toBe(true);
        expect(typeof capturedPayload?.titleGenerationApiKey).toBe("string");
        expect(
            (capturedPayload?.titleGenerationApiKey as string).length,
        ).toBeGreaterThan(0);

        await expect(titleSection).toHaveAttribute("aria-busy", "true");
        await expect(automaticRename).toBeDisabled();
        await expect(serviceUrl).toBeDisabled();
        await expect(model).toBeDisabled();
        await expect(apiKey).toBeDisabled();
        await expect(settingsNav(page, "voscript")).toBeDisabled();
        await expect(saveAction).toBeDisabled();
        await expect(saveAction).toHaveAttribute("aria-busy", "true");
        await expect(saveAction).toHaveAccessibleName(/^(保存中|Saving)$/);

        releaseSave();
        expect((await saveResponse).ok()).toBe(true);
        await expect(titleSection).toHaveAttribute("aria-busy", "false");
        await expect(automaticRename).toBeEnabled();
        await expect(serviceUrl).toBeEnabled();
        await expect(model).toBeEnabled();
        await expect(apiKey).toBeEnabled();
        await expect(apiKey).toHaveValue("");
        await expect(saveAction).toHaveAccessibleName(/^(已保存|Saved)$/);
        const storedKeyStatus = apiKey
            .locator("xpath=..")
            .getByRole("status")
            .filter({ hasText: /^(已存储|Stored)$/ });
        await expect(storedKeyStatus).toBeVisible();
        await expect(storedKeyStatus).toHaveText(/^(已存储|Stored)$/);
    } finally {
        releaseSave();
        await page.unroute(titleGenerationRoute);
    }
});

test("settings shell keeps every desktop section fixed while wheel scrolling", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 640 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await clearSettingsPersistence(page);
    await page.goto("/settings#transcription", { waitUntil: "domcontentloaded" });

    const shell = settingsShell(page);
    await expect(shell).toBeVisible();
    const baselineHeight = await settingsShellHeight(page);

    for (const section of desktopSettingsSections) {
        await selectDesktopSettingsSection(page, section);
        await expectActiveSettingsSectionReady(page, section);
        const settingsScrollBody = activeSettingsContentScrollContainer(
            page,
            section,
        );
        await expect(settingsScrollBody).toBeVisible();
        await expectShellHeightStable(page, baselineHeight);
        await expectShellFitsViewport(page);

        await settingsScrollBody.hover();
        await page.mouse.wheel(0, 420);
        await expect
            .poll(() => page.evaluate(() => window.scrollY))
            .toBe(0);
        await expect(settingsNav(page, section)).toHaveAttribute(
            "aria-current",
            "page",
        );
    }

    await expect(settingsNav(page, "transcription")).toBeVisible();
    await selectDesktopSettingsSection(page, "transcription");
    await expect(settingsNav(page, "transcription")).toHaveAttribute(
        "aria-current",
        "page",
    );
    await expectActiveSettingsSectionReady(page, "transcription");
    await expectShellHeightStable(page, baselineHeight);
});

test("settings shell keeps six sections coherent in light and dark desktop tablet mobile frames", async ({
    page,
}) => {
    await ensureSignedIn(page);
    await clearSettingsPersistence(page);

    const frames = [
        {
            mode: "desktop",
            viewport: { width: 1280, height: 720 },
        },
        {
            mode: "tablet",
            viewport: { width: 768, height: 900 },
        },
        {
            mode: "mobile",
            viewport: { width: 390, height: 844 },
        },
    ] as const;

    try {
        for (const theme of ["light", "dark"] as const) {
            const themeResponse = await page.request.put(
                "/api/settings/display",
                {
                    data: {
                        dateTimeFormat: "relative",
                        itemsPerPage: 50,
                        recordingListSortOrder: "newest",
                        theme,
                        uiLanguage: "zh-CN",
                    },
                },
            );
            expect(themeResponse.ok()).toBe(true);
            const themeReadback = await page.request.get(
                "/api/settings/display",
            );
            expect(themeReadback.ok()).toBe(true);
            expect(await themeReadback.json()).toMatchObject({ theme });

            for (const frame of frames) {
                await test.step(`${theme} ${frame.mode}`, async () => {
                    await page.setViewportSize(frame.viewport);
                    await page.goto("about:blank");
                    await page.goto("/settings#transcription", {
                        waitUntil: "domcontentloaded",
                    });
                    await expect(page.locator("html")).toHaveAttribute(
                        "data-theme",
                        theme,
                    );

                    const shell = settingsShell(page);
                    await expect(shell).toBeVisible();
                    const expectedHeight = Math.min(
                        frame.viewport.height * 0.94,
                        980,
                        frame.viewport.height - 16,
                    );
                    await expect
                        .poll(() => settingsShellHeight(page))
                        .toBeCloseTo(expectedHeight, 0);
                    await expectShellFitsViewport(page);
                    const baselineHeight = await settingsShellHeight(page);

                    for (const section of desktopSettingsSections) {
                        await selectDesktopSettingsSection(page, section);
                        const activeSurface =
                            await expectActiveSettingsSectionReady(
                                page,
                                section,
                            );
                        await expect(activeSurface).toBeVisible();
                        for (const candidate of desktopSettingsSections) {
                            if (candidate === section) continue;
                            await expect(
                                settingsSectionSurface(page, candidate),
                            ).toBeHidden();
                            await expect(
                                settingsNav(page, candidate),
                            ).not.toHaveAttribute("aria-current", "page");
                        }
                        await expectShellHeightStable(page, baselineHeight);
                        await expectShellFitsViewport(page);

                        const metrics = await settingsShellLayoutMetrics(
                            page,
                            section,
                        );
                        expect(metrics.headerLeft).toBeGreaterThanOrEqual(
                            metrics.shellLeft - 1,
                        );
                        expect(metrics.headerRight).toBeLessThanOrEqual(
                            metrics.shellRight + 1,
                        );
                        expect(metrics.headerBottom).toBeLessThanOrEqual(
                            metrics.bodyTop + 1,
                        );
                        expect(metrics.bodyLeft).toBeGreaterThanOrEqual(
                            metrics.shellLeft - 1,
                        );
                        expect(metrics.bodyRight).toBeLessThanOrEqual(
                            metrics.shellRight + 1,
                        );
                        expect(metrics.bodyBottom).toBeLessThanOrEqual(
                            metrics.shellBottom + 1,
                        );
                        expect(metrics.railTop).toBeGreaterThanOrEqual(
                            metrics.bodyTop - 1,
                        );
                        expect(metrics.railBottom).toBeLessThanOrEqual(
                            metrics.bodyBottom + 1,
                        );
                        expect(metrics.railLeft).toBeGreaterThanOrEqual(
                            metrics.bodyLeft - 1,
                        );
                        expect(metrics.activeLeft).toBeGreaterThanOrEqual(
                            metrics.railRight - 1,
                        );
                        expect(metrics.activeRight).toBeLessThanOrEqual(
                            metrics.bodyRight + 1,
                        );
                        expect(metrics.activeWidth).toBeGreaterThan(0);
                        expect(metrics.shellTop).toBeGreaterThanOrEqual(0);
                    }

                    const screenshot = await shell.screenshot({
                        animations: "disabled",
                    });
                    expect(screenshot.byteLength).toBeGreaterThan(5_000);
                });
            }
        }
    } finally {
        await resetDisplayToChinese(page);
    }
});

test("settings canonical route and mobile rail keep the shell fixed", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings#misc", { waitUntil: "domcontentloaded" });

    const shell = settingsShell(page);
    await expect(shell).toBeVisible();
    await expectActiveSettingsSectionReady(page, "misc");
    await expect(page).toHaveURL(/\/settings#misc$/);

    const baselineHeight = await settingsShellHeight(page);
    expect(baselineHeight).toBeGreaterThan(760);
    expect(baselineHeight).toBeLessThanOrEqual(844);
    await expectShellFitsViewport(page);

    const rail = shell.getByRole("navigation", {
        name: /^(设置|Settings)$/,
    });
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("button")).toHaveCount(
        desktopSettingsSections.length,
    );
    await expect(settingsNav(page, "misc")).toBeVisible();

    await settingsNav(page, "voscript").click();
    await expectActiveSettingsSectionReady(page, "voscript");
    await expect(settingsNav(page, "voscript")).toHaveAttribute(
        "aria-current",
        "page",
    );
    await expectShellHeightStable(page, baselineHeight);

    await page.mouse.wheel(0, 900);
    await expectShellHeightStable(page, baselineHeight);

    await settingsNav(page, "data-sources").click();
    await expectActiveSettingsSectionReady(page, "data-sources");
    await expect(settingsNav(page, "data-sources")).toHaveAttribute(
        "aria-current",
        "page",
    );
    await expect(settingsSectionSurface(page, "data-sources")).toBeVisible();
    await expectShellHeightStable(page, baselineHeight);

    await shell
        .getByRole("button", { name: /^(关闭设置|Close settings)$/ })
        .click();
    await expect(shell).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard$/);
});

test("settings shell follows same-page hash section changes", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await clearSettingsPersistence(page);
    await page.goto("/settings#transcription", {
        waitUntil: "domcontentloaded",
    });

    const shell = settingsShell(page);
    await expectActiveSettingsSectionReady(page, "transcription");

    await page.evaluate(() => {
        window.location.hash = "appearance";
    });
    await expectActiveSettingsSectionReady(page, "appearance");

    await page.evaluate(() => {
        window.location.hash = "misc";
    });
    await expectActiveSettingsSectionReady(page, "misc");

    await page.evaluate(() => {
        window.location.hash = "data-sources";
    });
    await expectActiveSettingsSectionReady(page, "data-sources");
});

test("settings shell restores the last section and supports keyboard section selection", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await clearSettingsPersistence(page);
    await page.evaluate(() => {
        localStorage.setItem("settings-last-section", "title-generation");
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    const shell = settingsShell(page);
    await expect(shell).toBeVisible();
    await expectActiveSettingsSectionReady(
        page,
        "title-generation",
    );
    const titleGenerationNav = settingsNav(page, "title-generation");
    await expect(titleGenerationNav).toHaveAttribute("aria-current", "page");
    await expect(titleGenerationNav).toHaveAttribute("tabindex", "0");
    await expect(titleGenerationNav).toBeFocused();
    await expect(shell).toHaveAttribute("aria-busy", "false");

    await page.keyboard.press("End");
    await expect(settingsNav(page, "misc")).toBeFocused();
    await expect(titleGenerationNav).toHaveAttribute(
        "aria-current",
        "page",
    );
    await expect(settingsSectionSurface(page, "title-generation")).toBeVisible();

    await page.keyboard.press("Home");
    await expect(settingsNav(page, "transcription")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(titleGenerationNav).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(settingsNav(page, "transcription")).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(titleGenerationNav).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(settingsNav(page, "voscript")).toBeFocused();
    await expect(settingsNav(page, "voscript")).toHaveAttribute(
        "tabindex",
        "0",
    );
    await expect(titleGenerationNav).toHaveAttribute(
        "aria-current",
        "page",
    );

    await page.keyboard.press("Enter");
    await expectActiveSettingsSectionReady(page, "voscript");
    await expect(settingsNav(page, "voscript")).toHaveAttribute(
        "aria-current",
        "page",
    );
    await expect
        .poll(() =>
            page.evaluate(() => localStorage.getItem("settings-last-section")),
        )
        .toBe("voscript");
    await expect(shell).toHaveAttribute("aria-busy", "false");

    await page.keyboard.press("ArrowDown");
    await expect(settingsNav(page, "data-sources")).toBeFocused();
    await expect(settingsNav(page, "data-sources")).toHaveAttribute(
        "tabindex",
        "0",
    );
    await expect(settingsNav(page, "voscript")).toHaveAttribute(
        "aria-current",
        "page",
    );
    await page.keyboard.press("Space");
    await expectActiveSettingsSectionReady(page, "data-sources");
    await expect(shell).toHaveAttribute("aria-busy", "false");

    await page.keyboard.press("ArrowUp");
    await expect(settingsNav(page, "voscript")).toBeFocused();
    await expect(settingsNav(page, "voscript")).toHaveAttribute(
        "tabindex",
        "0",
    );
    await expect(settingsNav(page, "data-sources")).toHaveAttribute(
        "aria-current",
        "page",
    );
    await page.keyboard.press("Enter");
    await expectActiveSettingsSectionReady(page, "voscript");
    await expect(shell).toHaveAttribute("aria-busy", "false");

    await page.keyboard.press("Escape");
    await expect(shell).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard$/);
});

test("settings shell six canonical sections meet SOT acceptance evidence", async ({
    page,
}) => {
    await mkdir(ROW_117_EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await clearSettingsPersistence(page);
    await page.goto("/settings#transcription", {
        waitUntil: "domcontentloaded",
    });

    const sections: SectionAcceptanceEvidence[] = [];
    const shell = settingsShell(page);
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute("aria-busy", "false");
    await expectShellFitsViewport(page);

    for (const [index, section] of desktopSettingsSections.entries()) {
        const navigationMode = index === 0 ? "direct-hash" : "desktop-rail";
        if (navigationMode === "desktop-rail") {
            await selectDesktopSettingsSection(page, section);
        }

        sections.push(
            await readSectionAcceptanceEvidence(page, section, navigationMode),
        );
        await expectShellFitsViewport(page);
    }

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
            body: JSON.stringify({ error: "Title generation unavailable" }),
            contentType: "application/json",
            status: 503,
        });
    });

    await page.goto("/settings?six-section-error-evidence=1#title-generation", {
        waitUntil: "domcontentloaded",
    });
    await expect(settingsNav(page, "title-generation")).toHaveAttribute(
        "aria-current",
        "page",
    );
    const loadingStatus = page.getByRole("status", {
        name: "正在加载设置",
        exact: true,
    });
    const loadingSection = loadingStatus.locator("..");
    await expect(loadingSection).toHaveAttribute("aria-busy", "true");
    await expect(loadingSection).toBeVisible();
    await expect(loadingStatus).toBeVisible();
    await expect(loadingStatus).toHaveAttribute("aria-live", "polite");
    releaseInitialLoad?.();

    const errorPanel = settingsShell(page).getByRole("alert");
    const errorSection = errorPanel.locator("..");
    await expect(errorSection).toHaveAttribute("aria-busy", "false");
    await expect(errorPanel).toBeVisible();
    const retry = errorPanel.getByRole("button", {
        exact: true,
        name: /^(重试|Retry)$/,
    });
    await expect(retry).toBeVisible();
    await expect(errorSection.locator("#title-generation-model")).toHaveCount(0);
    const errorPanelWasVisible = await errorPanel.isVisible();
    const retryWasVisible = await retry.isVisible();
    const normalControlCountInError = await errorSection
        .locator("#title-generation-model")
        .count();

    const retryResponse = page.waitForResponse(
        (response) =>
            response.url().includes("/api/settings/title-generation") &&
            response.request().method() === "GET" &&
            response.ok(),
    );
    await retry.click();
    await retryResponse;
    const readySection = settingsSectionSurface(page, "title-generation");
    await expect(readySection).toHaveAttribute("aria-busy", "false");
    await expect(
        readySection.getByRole("heading", {
            level: 3,
            name: settingsSectionLabels["title-generation"],
        }),
    ).toBeVisible();

    const loadErrorRetry: LoadErrorRetryEvidence = {
        errorPanelVisible: errorPanelWasVisible,
        normalControlCountInError,
        retryReturnedReady:
            (await readySection.getAttribute("aria-busy")) === "false",
        retryVisible: retryWasVisible,
        section: "title-generation",
        states: ["loading", "error", "ready"],
    };
    const trackedSourceVerification =
        await verifyRow117DataSourcesTrackedSourceContract();

    const evidence = {
        acceptanceBoundaries: [
            "Load-error/retry coverage is structural because the handoff SOT shell has no dedicated load-error/retry pixel fixture.",
            "Data Sources live provider credential-backed test-success remains a non-claim; row 117 only claims route-mocked credential-safe test-success evidence.",
            "Repository-level all-page/all-control validation is tracked by the full Playwright suite outside this row 117 artifact.",
        ],
        dataSourcesCredentialSafeTestSuccess: {
            ...row117DataSourcesCredentialSafeTestSuccessEvidence,
            trackedSourceVerification,
        },
        generatedAt: new Date().toISOString(),
        loadErrorRetry,
        row: 117,
        scope: "Settings shell six canonical section acceptance",
        sections,
    };

    const evidenceJson = JSON.stringify(evidence, null, 2);
    const evidenceMarkdown = settingsSixSectionAcceptanceMarkdown(evidence);
    expect(
        evidence.dataSourcesCredentialSafeTestSuccess.routeMockedSuccess
            .responseShape.success,
    ).toBe(true);
    expect(
        evidence.dataSourcesCredentialSafeTestSuccess.credentialPolicy
            .realCredentialsUsed,
    ).toBe(false);
    expect(
        evidence.dataSourcesCredentialSafeTestSuccess.credentialPolicy
            .row117EvidenceStoresSecretValues,
    ).toBe(false);
    expect(
        evidence.dataSourcesCredentialSafeTestSuccess.trackedSourceVerification
            .liveCredentialBackedProviderSuccessClaimed,
    ).toBe(false);
    expect(
        evidence.dataSourcesCredentialSafeTestSuccess.payloadShapeReadback.map(
            (payload) => ({
                authMode: payload.authMode,
                provider: payload.provider,
                savedByTestSuccess: payload.savedByTestSuccess,
            }),
        ),
    ).toEqual([
        {
            authMode: "bearer",
            provider: "ticnote",
            savedByTestSuccess: false,
        },
        {
            authMode: "oauth-device-flow",
            provider: "feishu-minutes",
            savedByTestSuccess: false,
        },
        {
            authMode: "web-reverse",
            provider: "feishu-minutes",
            savedByTestSuccess: false,
        },
    ]);
    for (const secretLiteral of row117DataSourcesSecretLiteralsBlockedFromEvidence) {
        expect(evidenceJson).not.toContain(secretLiteral);
        expect(evidenceMarkdown).not.toContain(secretLiteral);
    }

    await writeFile(
        path.join(ROW_117_EVIDENCE_DIR, "settings-shell-six-section-acceptance.json"),
        evidenceJson,
    );
    await writeFile(
        path.join(ROW_117_EVIDENCE_DIR, "settings-shell-six-section-acceptance.md"),
        evidenceMarkdown,
    );
});

test("settings shell row 117 captures responsive visual matrix", async ({
    page,
}) => {
    await mkdir(ROW_117_EVIDENCE_DIR, { recursive: true });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await clearSettingsPersistence(page);
    await seedTitleGenerationReadyState(page);
    await seedRow117TranscriptionReadyState(page);
    await seedRow117ReadyStateRoutes(page);

    const frames: Row117FrameEvidence[] = [];
    const sotPage = await page.context().newPage();

    try {
        const desktop = row117PixelFrames[0];
        await page.setViewportSize(desktop.viewport);
        await page.goto("/settings#transcription", {
            waitUntil: "domcontentloaded",
        });
        const desktopShell = settingsShell(page);
        await expectActiveSettingsSectionReady(page, "transcription");
        await expectSettingsHeaderSotCopy(desktopShell);
        await page.evaluate(() => {
            window.location.hash = "appearance";
        });
        await expectActiveSettingsSectionReady(page, desktop.section);
        await expectShellFitsViewport(page);
        const desktopFocusEvidence = await page.evaluate(() => {
            const navSelector = "nav[aria-label] button";
            const activeNavSelector = `${navSelector}[aria-current="page"]`;

            function summarizeActiveElement() {
                const active = document.activeElement as HTMLElement | null;

                return {
                    control: active?.getAttribute("aria-current") ?? null,
                    isSettingsNav: active?.matches(navSelector) ?? false,
                    isTranscriptionNav:
                        active?.matches(activeNavSelector) ?? false,
                    section: active?.getAttribute("aria-current") ?? null,
                    tagName: active?.tagName.toLowerCase() ?? null,
                };
            }

            const before = summarizeActiveElement();
            (document.activeElement as HTMLElement | null)?.blur();
            const after = summarizeActiveElement();

            return { after, before };
        });
        expect(desktopFocusEvidence.after.isSettingsNav).toBe(false);
        expect(desktopFocusEvidence.after.isTranscriptionNav).toBe(false);

        let frameName = sanitizeEvidenceName(desktop.frame);
        let productPath = path.join(
            ROW_117_EVIDENCE_DIR,
            `${frameName}-product.png`,
        );
        let sotPath = path.join(
            ROW_117_EVIDENCE_DIR,
            `${frameName}-sot.png`,
        );
        let productCapture = await captureShellFrame(desktopShell, productPath);
        let sotShell = await openSotSettingsFrame(
            sotPage,
            desktop.section,
            desktop.viewport,
        );
        let sotCapture = await captureShellFrame(sotShell, sotPath);
        expectShadcnDialogBaseShadow(productCapture, sotCapture);
        let diff = await comparePngPixels(
            page,
            sotCapture.screenshot,
            productCapture.screenshot,
        );
        frames.push({
            assertions: [
                "desktop shell visible and viewport-bound",
                "same-page hash switch activates appearance",
                "desktop rail active state follows selected section",
                "computed shell box-shadow uses the shadcn DialogContent base shadow",
            ],
            blockerReason: diff.blockerReason,
            diff,
            frame: desktop.frame,
            notes: [
                "product runtime compared against handoff SOT Web/index shell",
                "hash transition focus is cleared before screenshot capture",
                "handoff SOT retains the pre-shadcn custom shell shadow and is recorded as reference, not as the product compliance target",
                "product header uses SOT local deployment copy and omits test account email",
            ],
            parityType: "pixel",
            productMetrics: {
                ...productCapture.metrics,
                activeFocusBeforeCapture: desktopFocusEvidence,
            },
            productScreenshot: path.relative(process.cwd(), productPath),
            section: desktop.section,
            sotMetrics: sotCapture.metrics,
            sotScreenshot: path.relative(process.cwd(), sotPath),
            stage: "ready",
            viewport: desktop.viewport,
        });

        const mobile = row117PixelFrames[1];
        const mobileShell = await openProductSettingsSection(
            page,
            "misc",
            mobile.viewport,
        );
        await expectSettingsHeaderSotCopy(mobileShell);
        await expect(settingsNav(page, "misc")).toBeVisible();
        await settingsNav(page, mobile.section).click();
        await expect(settingsNav(page, mobile.section)).toHaveAttribute(
            "aria-current",
            "page",
        );
        await expect(
            settingsSectionSurface(page, mobile.section),
        ).toBeVisible();
        await expectShellFitsViewport(page);

        frameName = sanitizeEvidenceName(mobile.frame);
        productPath = path.join(
            ROW_117_EVIDENCE_DIR,
            `${frameName}-product.png`,
        );
        sotPath = path.join(ROW_117_EVIDENCE_DIR, `${frameName}-sot.png`);
        productCapture = await captureShellFrame(mobileShell, productPath);
        sotShell = await openSotSettingsFrame(
            sotPage,
            mobile.section,
            mobile.viewport,
        );
        sotCapture = await captureShellFrame(sotShell, sotPath);
        diff = await comparePngPixels(
            page,
            sotCapture.screenshot,
            productCapture.screenshot,
        );
        frames.push({
            assertions: [
                "mobile shell visible and viewport-bound",
                "settings rail remains visible on mobile",
                "mobile rail item switches to data-sources without leaving /settings",
                "non-SOT mobile section selector is absent",
            ],
            blockerReason: diff.blockerReason,
            diff,
            frame: mobile.frame,
            notes: [
                "product runtime keeps the handoff SOT mobile rail structure",
                "product header uses SOT local deployment copy and omits test account email",
            ],
            parityType: "pixel",
            productMetrics: productCapture.metrics,
            productScreenshot: path.relative(process.cwd(), productPath),
            section: mobile.section,
            sotMetrics: sotCapture.metrics,
            sotScreenshot: path.relative(process.cwd(), sotPath),
            stage: "ready",
            viewport: mobile.viewport,
        });

        let releaseSave = () => {};
        let notifySaveStarted = () => {};
        const saveStarted = new Promise<void>((resolve) => {
            notifySaveStarted = resolve;
        });
        const pendingSave = new Promise<void>((resolve) => {
            releaseSave = resolve;
        });

        await page.route("**/api/settings/display", async (route) => {
            if (route.request().method() !== "PUT") {
                await route.continue();
                return;
            }

            const payload = route.request().postDataJSON();
            if (payload?.itemsPerPage === 42) {
                notifySaveStarted();
                await pendingSave;
                await route.fulfill({
                    contentType: "application/json",
                    body: JSON.stringify({ success: true }),
                });
                return;
            }

            await route.continue();
        });

        const saving = row117PixelFrames[2];
        const savingShell = await openProductSettingsSection(
            page,
            saving.section,
            saving.viewport,
        );
        await expectSettingsHeaderSotCopy(savingShell);
        const itemsPerPageInput = page.locator("#display-items-per-page");
        const appearanceSection = settingsSectionSurface(page, "appearance");
        const appearanceSaveControls = appearanceSection.getByRole("button", {
            exact: true,
            name: /^(保存|Save)$/,
        });
        await expect(itemsPerPageInput).toHaveValue("50");
        await itemsPerPageInput.fill("42");
        await saveStarted;
        await expect(savingShell).toHaveAttribute("aria-busy", "true");
        await expect(appearanceSection).toHaveAttribute("aria-busy", "true");
        await expect(appearanceSaveControls).toHaveCount(0);
        await expect(itemsPerPageInput).toBeDisabled();
        await expect(settingsNav(page, "misc")).toBeDisabled();
        await expect(
            settingsShell(page).getByRole("button", {
                exact: true,
                name: /^(关闭设置|Close settings)$/,
            }),
        ).toBeDisabled();

        frameName = sanitizeEvidenceName(saving.frame);
        productPath = path.join(
            ROW_117_EVIDENCE_DIR,
            `${frameName}-product.png`,
        );
        productCapture = await captureShellFrame(savingShell, productPath);
        frames.push({
            assertions: [
                "display items-per-page change is held pending",
                "settings shell aria-busy=true",
                "appearance has no footer save action",
                "nav and close controls disabled while saving",
            ],
            blockerReason:
                "No dedicated SOT save-pending shell fixture exists in the handoff Web/index target; comparing the product busy/disabled runtime frame to the ready-state SOT fixture would be false pixel parity.",
            diff: null,
            frame: saving.frame,
            notes: [
                "product immediate save state is driven through /api/settings/display",
                "product-runtime structural evidence only",
                "handoff SOT has no dedicated save-pending fixture for this exact product state",
                "product header uses SOT local deployment copy and omits test account email",
            ],
            parityType: "structural",
            productMetrics: productCapture.metrics,
            productScreenshot: path.relative(process.cwd(), productPath),
            section: saving.section,
            sotMetrics: null,
            sotScreenshot: null,
            stage: "immediate-save-pending",
            viewport: saving.viewport,
        });
        releaseSave();
        await expect(savingShell).toHaveAttribute("aria-busy", "false");
        await expect(appearanceSection).toHaveAttribute("aria-busy", "false");
        await seedRow117AppearanceReadyState(page);

        let failTitleGenerationLoad = true;
        await page.route("**/api/settings/title-generation", async (route) => {
            if (
                route.request().method() === "GET" &&
                failTitleGenerationLoad
            ) {
                failTitleGenerationLoad = false;
                await route.fulfill({
                    contentType: "application/json",
                    status: 503,
                    body: JSON.stringify({
                        error: "Title generation unavailable",
                    }),
                });
                return;
            }

            await route.continue();
        });

        const errorViewport = { height: 720, width: 1280 };
        await page.setViewportSize(errorViewport);
        await page.goto("/settings#title-generation", {
            waitUntil: "domcontentloaded",
        });
        const errorShell = settingsShell(page);
        await expectSettingsHeaderSotCopy(errorShell);
        const errorSection = settingsSectionSurface(page, "title-generation");
        await expect(errorSection).toBeVisible();
        await expect(errorSection).toHaveAttribute("aria-busy", "false");
        const errorPanel = errorShell.getByRole("alert");
        await expect(errorPanel).toBeVisible();
        const retry = errorPanel.getByRole("button", {
            exact: true,
            name: /^(重试|Retry)$/,
        });
        await expect(retry).toBeVisible();

        frameName = "desktop-title-generation-load-error-retry";
        productPath = path.join(
            ROW_117_EVIDENCE_DIR,
            `${frameName}-product.png`,
        );
        productCapture = await captureShellFrame(errorShell, productPath);
        frames.push({
            assertions: [
                "title-generation section enters load error state",
                "load retry control is visible",
                "retry returns section to ready state",
            ],
            blockerReason:
                "No dedicated SOT load-error shell fixture exists in the handoff Web/index target for this exact product state.",
            diff: null,
            frame: frameName,
            notes: [
                "product-runtime structural evidence only",
                "covers load-error/retry shell state as structural runtime evidence",
                "product header uses SOT local deployment copy and omits test account email",
            ],
            parityType: "structural",
            productMetrics: productCapture.metrics,
            productScreenshot: path.relative(process.cwd(), productPath),
            section: "title-generation",
            sotMetrics: null,
            sotScreenshot: null,
            stage: "load-error-retry",
            viewport: errorViewport,
        });

        const retryResponse = page.waitForResponse(
            (response) =>
                response.url().includes("/api/settings/title-generation") &&
                response.request().method() === "GET" &&
                response.ok(),
        );
        await retry.click();
        await retryResponse;
        await expectActiveSettingsSectionReady(page, "title-generation");
        await expect(errorShell.getByRole("alert")).toHaveCount(0);

        const readyFrameViewports = [
            {
                mode: "desktop",
                viewport: { height: 720, width: 1280 },
            },
            {
                mode: "mobile",
                viewport: { height: 844, width: 390 },
            },
        ] as const;

        for (const readyFrameViewport of readyFrameViewports) {
            for (const section of desktopSettingsSections) {
                const readyFrame = {
                    frame: `${readyFrameViewport.mode}-${section}-ready`,
                    section,
                    viewport: readyFrameViewport.viewport,
                };
                if (section === "appearance") {
                    await putRow117AppearanceReadyState(page);
                }
                const productShell = await openProductSettingsSection(
                    page,
                    section,
                    readyFrame.viewport,
                );
                await expectSettingsHeaderSotCopy(productShell);
                await expectActiveSettingsSectionReady(page, section);

                if (readyFrameViewport.mode === "mobile") {
                    const settingsNavigation = productShell.getByRole(
                        "navigation",
                        {
                            name: /^(设置|Settings)$/,
                        },
                    );
                    await expect(
                        settingsNavigation.getByRole("combobox"),
                    ).toHaveCount(0);
                    await expect(settingsNavigation).toBeVisible();
                    await expect(settingsNav(page, section)).toBeVisible();
                }

                const captureDesktopReadyDetails =
                    readyFrameViewport.mode === "desktop";
                const titleGenerationStoredKeyEvidence =
                    captureDesktopReadyDetails && section === "title-generation"
                        ? await expectTitleGenerationReadyStoredKeyEvidence(page)
                        : null;
                const transcriptionReadyStateEvidence =
                    captureDesktopReadyDetails && section === "transcription"
                        ? await expectRow117TranscriptionReadyState(page)
                        : null;
                const appearanceReadyStateEvidence =
                    captureDesktopReadyDetails && section === "appearance"
                        ? await expectRow117AppearanceReadyState(page)
                        : null;
                const dataSourcesReadyStateEvidence =
                    section === "data-sources"
                        ? await expectRow117DataSourcesReadyState(page)
                        : null;
                const voScriptReadyStateEvidence =
                    section === "voscript"
                        ? await expectRow117VoScriptReadyState(page)
                        : null;
                let sotDataSourcesReadyStateEvidence: Row117DataSourcesReadyStateEvidence | null =
                    null;
                let sotVoScriptReadyStateEvidence: Row117VoScriptReadyStateEvidence | null =
                    null;

                frameName = sanitizeEvidenceName(readyFrame.frame);
                productPath = path.join(
                    ROW_117_EVIDENCE_DIR,
                    `${frameName}-product.png`,
                );
                sotPath = path.join(
                    ROW_117_EVIDENCE_DIR,
                    `${frameName}-sot.png`,
                );
                productCapture = await captureShellFrame(
                    productShell,
                    productPath,
                );
                const sotResult = await captureSotSettingsFrameIfAvailable(
                    sotPage,
                    section,
                    readyFrame.viewport,
                    sotPath,
                );
                if (sotResult.capture && section === "data-sources") {
                    sotDataSourcesReadyStateEvidence =
                        await expectRow117SotDataSourcesReadyState(sotPage);
                }
                if (sotResult.capture && section === "voscript") {
                    sotVoScriptReadyStateEvidence =
                        await expectRow117SotVoScriptReadyState(sotPage);
                }
                diff = sotResult.capture
                    ? await comparePngPixels(
                          page,
                          sotResult.capture.screenshot,
                          productCapture.screenshot,
                      )
                    : null;

                frames.push({
                    assertions: [
                        "product section reaches ready state",
                        readyFrameViewport.mode === "mobile"
                            ? "mobile rail remains visible and selector is absent"
                            : "desktop rail active state follows selected section",
                        `settings shell stays inside the ${readyFrameViewport.mode} viewport`,
                        ...(appearanceReadyStateEvidence
                            ? [
                                  "appearance ready state matches SOT runtime seed before capture",
                              ]
                            : []),
                        ...(transcriptionReadyStateEvidence
                            ? [
                                  "transcription ready state exposes row117 SOT controls before capture",
                              ]
                            : []),
                        ...(dataSourcesReadyStateEvidence
                            ? [
                                  "data-sources ready state uses row117 SOT provider seed before capture",
                              ]
                            : []),
                        ...(sotDataSourcesReadyStateEvidence
                            ? [
                                  "handoff SOT data-sources fixture exposes normalized provider/card/detail/action evidence",
                              ]
                            : []),
                        ...(voScriptReadyStateEvidence
                            ? [
                                  "VoScript ready state uses row117 SOT service URL and saved-key seed before capture",
                              ]
                            : []),
                        ...(sotVoScriptReadyStateEvidence
                            ? [
                                  "handoff SOT VoScript ready fixture hides unavailable banner and exposes saved-key action row",
                              ]
                            : []),
                        sotResult.capture
                            ? "handoff SOT ready-state fixture captured"
                            : "handoff SOT ready-state fixture is blocked",
                    ],
                    blockerReason:
                        diff?.blockerReason ?? sotResult.blockerReason,
                    diff,
                    frame: readyFrame.frame,
                    notes: [
                        `canonical Settings section ${readyFrameViewport.mode} ready-state product-vs-SOT frame`,
                        "pixel diff is recorded for audit alongside the product and SOT screenshots",
                        "product header uses SOT local deployment copy and omits test account email",
                    ],
                    parityType: sotResult.capture ? "pixel" : "blocked",
                    productMetrics:
                        titleGenerationStoredKeyEvidence ||
                        transcriptionReadyStateEvidence ||
                        appearanceReadyStateEvidence ||
                        dataSourcesReadyStateEvidence ||
                        voScriptReadyStateEvidence
                            ? {
                                  ...productCapture.metrics,
                                  ...(titleGenerationStoredKeyEvidence
                                      ? {
                                            titleGenerationStoredKey:
                                                titleGenerationStoredKeyEvidence,
                                        }
                                      : {}),
                                  ...(transcriptionReadyStateEvidence
                                      ? {
                                            transcriptionReadyState:
                                                transcriptionReadyStateEvidence,
                                        }
                                      : {}),
                                  ...(appearanceReadyStateEvidence
                                      ? {
                                            appearanceReadyState:
                                                appearanceReadyStateEvidence,
                                        }
                                      : {}),
                                  ...(dataSourcesReadyStateEvidence
                                      ? {
                                            dataSourcesReadyState:
                                                dataSourcesReadyStateEvidence,
                                        }
                                      : {}),
                                  ...(voScriptReadyStateEvidence
                                      ? {
                                            voScriptReadyState:
                                                voScriptReadyStateEvidence,
                                        }
                                      : {}),
                              }
                            : productCapture.metrics,
                    productScreenshot: path.relative(process.cwd(), productPath),
                    section,
                    sotMetrics: sotResult.capture
                        ? {
                              ...sotResult.capture.metrics,
                              ...(sotDataSourcesReadyStateEvidence
                                  ? {
                                        dataSourcesReadyState:
                                            sotDataSourcesReadyStateEvidence,
                                    }
                                  : {}),
                              ...(sotVoScriptReadyStateEvidence
                                  ? {
                                        voScriptReadyState:
                                            sotVoScriptReadyStateEvidence,
                                    }
                                  : {}),
                          }
                        : null,
                    sotScreenshot: sotResult.capture
                        ? path.relative(process.cwd(), sotPath)
                        : null,
                    stage: "ready",
                    viewport: readyFrame.viewport,
                });
            }
        }
    } finally {
        await sotPage.close();
    }

    const evidence = {
        acceptanceBoundaries: [
            "Fixture/self-diff and structural-only frames are kept separate from product-vs-SOT pixel frames.",
            "Appearance immediate-save-pending is structural product-runtime busy/disabled evidence because the handoff SOT shell has no dedicated save-pending fixture.",
            "Credential-backed real-provider test-success is covered by integration validation, not by this visual replacement matrix.",
            "Repository-level all-page/all-control validation is tracked by the full Playwright suite outside this row 117 artifact.",
        ],
        generatedAt: new Date().toISOString(),
        row: 117,
        scope: "Settings shell responsive/mobile frames plus screenshot/pixel matrix",
        sourceTargets: {
            product: [
                "src/features/settings/components/settings-dialog.tsx",
                "src/features/settings/components/settings-content.tsx",
                "src/app/globals.css",
            ],
            sot: [
                repoRelativeFixturePath("index.html"),
                repoRelativeFixturePath("kit.css"),
                repoRelativeFixturePath("component-library.html"),
            ],
        },
        frames,
    };

    const evidenceJson = JSON.stringify(evidence, null, 2);
    const evidenceMarkdown = row117EvidenceMarkdown(frames);
    expect(evidenceJson).toContain(SETTINGS_SOT_HEADER_TITLE_ZH);
    expect(evidenceJson).toContain(SETTINGS_SOT_HEADER_SUBTITLE_ZH);
    expect(evidenceJson).not.toContain(SETTINGS_TEST_EMAIL);
    expect(evidenceJson).not.toContain(SETTINGS_TEST_NAME);
    expect(evidenceMarkdown).not.toContain(SETTINGS_TEST_EMAIL);
    expect(evidenceMarkdown).not.toContain(SETTINGS_TEST_NAME);

    await writeFile(
        path.join(ROW_117_EVIDENCE_DIR, "settings-shell-visual-matrix.json"),
        evidenceJson,
    );
    await writeFile(
        path.join(ROW_117_EVIDENCE_DIR, "evidence.md"),
        evidenceMarkdown,
    );
});
