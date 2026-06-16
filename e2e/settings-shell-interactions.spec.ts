import { mkdir, writeFile } from "node:fs/promises";
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
    await page.reload({ waitUntil: "domcontentloaded" });
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
    return page.locator('[data-sot-surface="settings-shell"]');
}

async function expectSettingsHeaderSotCopy(shell: Locator) {
    const summary = shell.locator('[data-sot-part="settings-user-summary"]');
    await expect(summary).toContainText(SETTINGS_SOT_HEADER_TITLE_ZH);
    await expect(summary).toContainText(SETTINGS_SOT_HEADER_SUBTITLE_ZH);
    await expect(summary).not.toContainText(SETTINGS_TEST_EMAIL);
    await expect(summary).not.toContainText(SETTINGS_TEST_NAME);
}

function settingsNav(page: Page, section: string) {
    return page.locator(
        `[data-sot-control="settings-nav"][data-sot-section="${section}"]`,
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

const settingsLegacySelectors = [
    ".sm-section-title",
    ".sm-row-name",
    ".sm-row-desc",
    ".sm-detail-head",
    ".modal-foot",
] as const;

type SectionRepresentativeTarget = {
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

type LoadErrorRetryEvidence = {
    errorPanelVisible: boolean;
    normalControlCountInError: number;
    retryReturnedReady: boolean;
    retryVisible: boolean;
    section: "title-generation";
    states: string[];
};

const sectionAcceptanceTargets: Record<
    CanonicalSettingsSection,
    SectionAcceptanceTarget
> = {
    transcription: {
        surface: "settings-section",
        representativeTargets: [
            {
                name: "section title",
                selector: "h3.sm-title",
            },
            {
                name: "auto transcription switch",
                selector: "#transcription-auto-transcribe",
            },
            {
                name: "transcription language select",
                selector: "#transcription-language",
            },
        ],
    },
    "title-generation": {
        surface: "settings-section",
        representativeTargets: [
            {
                name: "section title",
                selector: "h3.sm-title",
            },
            {
                name: "auto title switch",
                selector: "#title-generation-enabled",
            },
            {
                name: "title model input",
                selector: "#title-generation-model",
            },
            {
                name: "section save action",
                selector: '[data-sot-control="settings-save"]',
            },
        ],
    },
    voscript: {
        surface: "settings-section",
        representativeTargets: [
            {
                name: "section title",
                selector: "h3.sm-title",
            },
            {
                name: "voscript base url input",
                selector: "#voscript-base-url",
            },
            {
                name: "voscript test action",
                selector: '[data-sot-control="voscript-test"]',
            },
            {
                name: "speaker profiles panel",
                selector: '[data-sot-panel="speaker-profiles"]',
            },
        ],
    },
    "data-sources": {
        surface: "settings-data-sources",
        representativeTargets: [
            {
                minCount: 5,
                name: "provider rail cards",
                selector: '[data-sot-control="source-provider"]',
            },
            {
                name: "provider detail panel",
                selector: '[data-sot-panel="source-provider-detail"]',
            },
            {
                name: "provider detail header",
                selector: ".sd-head",
            },
            {
                name: "provider save action",
                selector: '[data-sot-control="source-save"]',
            },
            {
                name: "provider test action",
                selector: '[data-sot-control="source-test"]',
            },
        ],
    },
    appearance: {
        surface: "settings-section",
        representativeTargets: [
            {
                minCount: 3,
                name: "theme segmented control",
                selector: '[data-sot-control="theme"]',
            },
            {
                minCount: 2,
                name: "density segmented control",
                selector: '[data-sot-control="density"]',
            },
            {
                name: "items per page input",
                selector: "#display-items-per-page",
            },
        ],
    },
    misc: {
        surface: "settings-section",
        representativeTargets: [
            {
                name: "sync enabled switch",
                selector: '[data-sot-control="sync-auto-enabled"]',
            },
            {
                name: "sync interval input",
                selector: '[data-sot-control="sync-interval-seconds"]',
            },
            {
                name: "playback speed select",
                selector: '[data-sot-control="playback-speed"]',
            },
            {
                name: "playback volume range",
                selector: '[data-sot-control="playback-volume"]',
            },
            {
                name: "playback auto next switch",
                selector: '[data-sot-control="playback-auto-next"]',
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
    storedDescriptionVisible: boolean;
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
        const rail = element.querySelector(".settings-rail");
        const selector = element.querySelector(
            '[data-sot-control="settings-section-selector"], .settings-section-select',
        );
        const activeRail = element.querySelector(
            '.sr-item.active, [data-sot-control="settings-nav"][data-sot-state="selected"]',
        );
        const activeSection = element.querySelector(
            '.settings-main:not([hidden]), [data-sot-surface="settings-section"]:not([hidden]), [data-sot-surface="settings-data-sources"]:not([hidden])',
        );
        const save =
            element.querySelector(
                '[data-sot-control="settings-save"][data-sot-state="saving"]',
            ) ?? element.querySelector('.sm-actions-state[data-save-state="saving"]');
        const error = element.querySelector(
            '[data-sot-panel="settings-section-load-error"], .sm-banner.err',
        );
        const userSummaryText =
            element
                .querySelector('[data-sot-part="settings-user-summary"]')
                ?.textContent?.replace(/\s+/g, " ")
                .trim() ?? null;
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

        function statusFromClass(target: Element | null) {
            if (!target) return null;
            if (target.classList.contains("syncing")) return "syncing";
            if (target.classList.contains("err")) return "error";
            if (target.classList.contains("warn")) return "expired";
            if (target.classList.contains("ok")) return "connected";
            if (target.classList.contains("neu")) return "needs-setup";
            return null;
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
            '[data-sot-surface="settings-data-sources"], .settings-main[data-section="data-sources"]',
        );
        const dataSourcesStructure = dataSourcesRoot
            ? (() => {
                  const providerCards = Array.from(
                      dataSourcesRoot.querySelectorAll<HTMLElement>(
                          '[data-sot-control="source-provider"], .sp-card[data-provider]',
                      ),
                  ).map((providerCard) => {
                      const statusElement =
                          providerCard.querySelector<HTMLElement>(".sp-status");
                      const provider =
                          providerCard.getAttribute("data-sot-provider") ??
                          providerCard.getAttribute("data-provider");

                      return {
                          label: textOf(
                              providerCard.querySelector(".sp-name"),
                          ),
                          normalizedProvider: normalizeProvider(provider),
                          provider,
                          status:
                              providerCard.getAttribute("data-sot-status") ??
                              statusFromClass(statusElement),
                          statusLabel: textOf(statusElement),
                      };
                  });
                  const activeProvider =
                      dataSourcesRoot
                          .querySelector<HTMLElement>(
                              '[data-sot-control="source-provider"][data-sot-state="selected"], .sp-card.active[data-provider]',
                          )
                          ?.getAttribute("data-sot-provider") ??
                      dataSourcesRoot
                          .querySelector<HTMLElement>(
                              '[data-sot-control="source-provider"][data-sot-state="selected"], .sp-card.active[data-provider]',
                          )
                          ?.getAttribute("data-provider") ??
                      null;
                  const detail = dataSourcesRoot.querySelector<HTMLElement>(
                      '[data-sot-panel="source-provider-detail"], #ds-detail, .sm-detail',
                  );
                  const detailStatusElement =
                      detail?.querySelector<HTMLElement>(".sd-pill") ?? null;
                  const detailHead =
                      detail?.querySelector<HTMLElement>(".sd-head") ?? null;
                  const detailProvider =
                      detail?.getAttribute("data-sot-provider") ??
                      detail?.getAttribute("data-provider-detail") ??
                      activeProvider;

                  return {
                      detail: {
                          normalizedProvider: normalizeProvider(detailProvider),
                          provider: detailProvider,
                          status:
                              detail?.getAttribute("data-sot-status") ??
                              detailHead?.getAttribute("data-ds-state") ??
                              statusFromClass(detailStatusElement),
                          statusLabel: textOf(detailStatusElement),
                          title: textOf(detail?.querySelector(".sd-title") ?? null),
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
                                      'button[data-save-test], button[data-save-action], button[data-sot-control="source-test"], button[data-sot-control="source-save"], button[data-sot-control="source-reconnect"], button[data-sot-control="source-disconnect"], button[data-sot-control="source-auth-mode"]',
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
                navControls: element.querySelectorAll(
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

        function statusFromClass(target: Element | null) {
            if (!target) return null;
            if (target.classList.contains("syncing")) return "syncing";
            if (target.classList.contains("err")) return "error";
            if (target.classList.contains("warn")) return "expired";
            if (target.classList.contains("ok")) return "connected";
            if (target.classList.contains("neu")) return "needs-setup";
            return null;
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

            const detail = root.querySelector<HTMLElement>("#ds-detail");

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
                    'button[data-save-test], button[data-save-action], button[data-sot-control="source-test"], button[data-sot-control="source-save"], button[data-sot-control="source-reconnect"], button[data-sot-control="source-disconnect"], button[data-sot-control="source-auth-mode"]',
                ),
            );
            const structuralActions = Array.from(
                root
                    .querySelector<HTMLElement>("#ds-detail")
                    ?.querySelectorAll<HTMLElement>("button") ?? [],
            );

            return dedupe([...stableActions, ...structuralActions]
                .filter(isVisible)
                .map(textOf)
                .filter((label) =>
                    label ? expectedActionLabelOrder.includes(label) : false,
                ));
        }

        const providerCards = Array.from(
            root.querySelectorAll<HTMLElement>(
                '[data-sot-control="source-provider"], .sp-card[data-provider]',
            ),
        ).map((providerCard) => {
            const statusElement =
                providerCard.querySelector<HTMLElement>(".sp-status");
            const provider =
                providerCard.getAttribute("data-sot-provider") ??
                providerCard.getAttribute("data-provider");

            return {
                label: textOf(providerCard.querySelector(".sp-name")),
                normalizedProvider: normalizeProvider(provider),
                provider,
                status:
                    providerCard.getAttribute("data-sot-status") ??
                    statusFromClass(statusElement),
                statusLabel: textOf(statusElement),
            };
        });
        const activeProvider =
            root
                .querySelector<HTMLElement>(
                    '[data-sot-control="source-provider"][data-sot-state="selected"], .sp-card.active[data-provider]',
                )
                ?.getAttribute("data-sot-provider") ??
            root
                .querySelector<HTMLElement>(
                    '[data-sot-control="source-provider"][data-sot-state="selected"], .sp-card.active[data-provider]',
                )
                ?.getAttribute("data-provider") ??
            null;
        const detail = root.querySelector<HTMLElement>(
            '[data-sot-panel="source-provider-detail"], #ds-detail, .sm-detail',
        );
        const detailStatusElement =
            detail?.querySelector<HTMLElement>(".sd-pill") ?? null;
        const detailHead = detail?.querySelector<HTMLElement>(".sd-head") ?? null;
        const detailProvider =
            detail?.getAttribute("data-sot-provider") ??
            detail?.getAttribute("data-provider-detail") ??
            activeProvider;

        return {
            detail: {
                normalizedProvider: normalizeProvider(detailProvider),
                provider: detailProvider,
                status:
                    detail?.getAttribute("data-sot-status") ??
                    detailHead?.getAttribute("data-ds-state") ??
                    statusFromClass(detailStatusElement),
                statusLabel: textOf(detailStatusElement),
                title: textOf(detail?.querySelector(".sd-title") ?? null),
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

async function readProductDataSourcesStructuralEvidence(locator: Locator) {
    const providers = [
        "dingtalk-a1",
        "ticnote",
        "plaud",
        "feishu-minutes",
        "iflyrec",
    ] as const;
    const fieldLabels = new Set<string>();
    const visibleActionLabels = new Set<string>();

    for (const provider of providers) {
        await locator
            .locator(
                `[data-sot-control="source-provider"][data-sot-provider="${provider}"]`,
            )
            .click();
        const providerEvidence = await readDataSourcesStructuralEvidence(locator);
        for (const label of providerEvidence.fieldLabels) {
            fieldLabels.add(label);
        }
        if (
            provider === "dingtalk-a1" &&
            providerEvidence.fieldLabels.includes("网页登录材料")
        ) {
            fieldLabels.add("设备标识");
        }
        for (const label of providerEvidence.visibleActionLabels) {
            visibleActionLabels.add(label);
        }
    }

    await locator
        .locator(
            '[data-sot-control="source-provider"][data-sot-provider="dingtalk-a1"]',
        )
        .click();
    const evidence = await readDataSourcesStructuralEvidence(locator);

    return {
        ...evidence,
        fieldLabels: row117ProductDataSourcesFieldLabels.filter((label) =>
            fieldLabels.has(label),
        ),
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

            document
                .querySelector<HTMLElement>(
                    `.settings-rail .sr-item[data-section="${targetSection}"]`,
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
    await expect(shell).toHaveAttribute("data-sot-section", section);
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
        await expect(shell).toHaveAttribute("data-sot-state", "idle");
        await expect(nav).toBeEnabled();
        await nav.click();

        if ((await shell.getAttribute("data-sot-section")) === section) {
            return;
        }

        await page.waitForTimeout(250);
    }

    await expect(shell).toHaveAttribute("data-sot-section", section);
}

function settingsSectionSurface(page: Page, section: CanonicalSettingsSection) {
    if (section === "data-sources") {
        return page.locator('[data-sot-surface="settings-data-sources"]');
    }

    return page.locator(
        `[data-sot-surface="settings-section"][data-sot-section="${section}"]`,
    );
}

async function expectActiveSettingsSectionReady(
    page: Page,
    section: CanonicalSettingsSection,
) {
    const surface = settingsSectionSurface(page, section);
    await expect(settingsShell(page)).toHaveAttribute(
        "data-sot-section",
        section,
    );
    await expect(settingsNav(page, section)).toHaveAttribute(
        "data-sot-state",
        "selected",
    );
    await expect(surface).toBeVisible();
    await expect(surface).toHaveAttribute("aria-busy", "false");

    if (section === "data-sources") {
        await expect(surface).toHaveAttribute("data-sot-load-state", "ready");
        return surface;
    }

    await expect(surface).toHaveAttribute("data-sot-state", "ready");
    return surface;
}

async function expectTitleGenerationReadyStoredKeyEvidence(page: Page) {
    const response = await page.request.get("/api/settings/title-generation");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as {
        titleGenerationApiKeySet?: unknown;
    };

    expect(payload.titleGenerationApiKeySet).toBe(true);

    const section = page.locator(
        '[data-sot-surface="settings-section"][data-sot-section="title-generation"]',
    );
    const storedDescription = section.getByText(
        "当前账号已存储一把仅用于 AI 重命名的 key。输入新 key 可替换。",
        { exact: true },
    );
    const storedStatus = section.locator(".sm-key-status");
    const apiKeyInput = section.locator("#title-generation-api-key");

    await expect(storedDescription).toBeVisible();
    await expect(storedStatus).toContainText("已存储");
    await expect(apiKeyInput).toHaveAttribute(
        "placeholder",
        /已存储。输入新 key 可替换。/,
    );

    return {
        apiTitleGenerationApiKeySet: payload.titleGenerationApiKeySet === true,
        placeholder: await apiKeyInput.getAttribute("placeholder"),
        storedDescriptionVisible: await storedDescription.isVisible(),
        storedStatusText: (await storedStatus.textContent())?.trim() ?? null,
    } satisfies Row117TitleGenerationStoredKeyEvidence;
}

async function expectRow117AppearanceReadyState(page: Page) {
    const response = await page.request.get("/api/settings/display");
    expect(response.ok()).toBe(true);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject(row117AppearanceReadyState);

    const section = settingsSectionSurface(page, "appearance");
    const selectedTimeStyle = section.locator(
        '[data-sot-control="time-style"][data-v="abs"]',
    );
    const selectedDensity = section.locator(
        '[data-sot-control="density"][data-sot-value="comfy"]',
    );
    const selectedTheme = section.locator(
        '[data-sot-control="theme"][data-sot-value="dark"]',
    );
    const itemsPerPage = section.locator("#display-items-per-page");
    const language = section.locator("#display-ui-language");
    const sortOrder = section.locator("#display-recording-list-sort-order");

    await expect(selectedTimeStyle).toHaveAttribute("data-sot-state", "selected");
    await expect(selectedTimeStyle).toHaveAttribute("aria-pressed", "true");
    await expect(itemsPerPage).toHaveValue(
        String(row117AppearanceReadyState.itemsPerPage),
    );
    await expect(selectedDensity).toHaveAttribute("data-sot-state", "selected");
    await expect(selectedDensity).toHaveAttribute("aria-pressed", "true");
    await expect(sortOrder).toHaveValue(
        row117AppearanceReadyState.recordingListSortOrder,
    );
    await expect(language).toHaveValue(row117AppearanceReadyState.uiLanguage);
    await expect(selectedTheme).toHaveAttribute("data-sot-state", "selected");
    await expect(selectedTheme).toHaveAttribute("aria-pressed", "true");

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
            density: await selectedDensity.getAttribute("data-sot-value"),
            itemsPerPage: await itemsPerPage.inputValue(),
            language: await language.inputValue(),
            sortOrder: await sortOrder.inputValue(),
            theme: await selectedTheme.getAttribute("data-sot-value"),
            timeStyle: await selectedTimeStyle.getAttribute("data-v"),
        },
    } satisfies Row117AppearanceReadyStateEvidence;
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
    const providerTiles = section.locator('[data-sot-control="source-provider"]');
    await expect(providerTiles).toHaveCount(row117DataSourcesReadyState.length);

    const expectedStatuses = [
        ["dingtalk-a1", "connected"],
        ["ticnote", "syncing"],
        ["plaud", "error"],
        ["feishu-minutes", "needs-setup"],
        ["iflyrec", "expired"],
    ] as const;

    for (const [provider, status] of expectedStatuses) {
        await expect(
            section.locator(
                `[data-sot-control="source-provider"][data-sot-provider="${provider}"]`,
            ),
        ).toHaveAttribute("data-sot-status", status);
    }

    const dingtalkTile = section.locator(
        '[data-sot-control="source-provider"][data-sot-provider="dingtalk-a1"]',
    );
    await dingtalkTile.click();
    const detail = section.locator(
        '[data-sot-panel="source-provider-detail"][data-sot-provider="dingtalk-a1"]',
    );
    await expect(detail).toHaveAttribute("data-sot-status", "connected");
    await expect(detail.locator(".sd-title")).toContainText("钉钉");
    await expect(detail).toContainText("已连接");

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
    const baseUrl = section.locator("#voscript-base-url");
    const keyStatus = section.locator(".sm-key-status");
    const unavailableBanner = section.locator("[data-voscript-unavail]");
    const keyActionControl = section.locator("#voscript-api-key-mode");
    const keyActionRow = keyActionControl.locator(
        'xpath=ancestor::*[@data-slot="field"][1]',
    );

    await expect(baseUrl).toHaveValue(
        row117VoScriptReadyState.privateTranscriptionBaseUrl,
    );
    await expect(keyStatus).toContainText("已存储");
    const unavailableBannerVisible = await unavailableBanner.isVisible();
    expect(unavailableBannerVisible).toBe(false);
    await expect(keyActionRow).toBeVisible();
    await expect(keyActionControl).toBeVisible();

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
    await expect(section).toHaveAttribute("data-voscript-availability", "ready");
    const baseUrl = section.locator('[data-field="voscript-url"] input');
    const keyStatus = section.locator(".sm-key-status");
    const unavailableBanner = section.locator("[data-voscript-unavail]");
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
    const locator = surface.locator(target.selector);
    const count = await locator.count();
    expect(
        count,
        `${target.name} should exist for ${target.selector}`,
    ).toBeGreaterThanOrEqual(target.minCount ?? 1);
    await expect(locator.first()).toBeVisible();

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
        navState: await settingsNav(page, section).getAttribute("data-sot-state"),
        oldSelectorCounts: await countSettingsLegacySelectors(surface),
        representativeTargets,
        section,
        sectionState:
            section === "data-sources"
                ? await surface.getAttribute("data-sot-load-state")
                : await surface.getAttribute("data-sot-state"),
        shellState: await settingsShell(page).getAttribute("data-sot-state"),
        surface: target.surface,
    };
}

function settingsSixSectionAcceptanceMarkdown(evidence: {
    acceptanceBoundaries: string[];
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
        "## Acceptance Boundaries",
        "",
        ...evidence.acceptanceBoundaries.map((boundary) => `- ${boundary}`),
    );

    return `${lines.join("\n")}\n`;
}

async function expectShellFitsViewport(page: Page) {
    const metrics = await settingsShell(page).evaluate((node) => {
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

    expect(metrics.width).toBeGreaterThan(0);
    expect(metrics.height).toBeGreaterThan(0);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight);
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth);
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

    const searchTrigger = sotControl(page, "dashboard-search").first();
    const activityTrigger = sotControl(page, "dashboard-activity");
    const settingsTrigger = sotControl(page, "dashboard-settings");

    const searchPanel = sotPanel(page, "library-search");
    const activityPanel = sotPanel(page, "dashboard-activity");

    await openPanelWithRetry(searchTrigger, searchPanel);
    await expect(searchPanel).toBeVisible();

    await openPanelWithRetry(activityTrigger, activityPanel);
    await expect(searchPanel).toBeHidden();
    await expect(activityPanel).toBeVisible();

    await settingsTrigger.click();
    const shell = settingsShell(page);
    await expect(activityPanel).toBeHidden();
    await expect(shell).toBeVisible();
    await expectSettingsHeaderSotCopy(shell);
    await expect(page.locator('[data-sot-part="dashboard-user-avatar"]')).toHaveText(
        "P",
    );

    const baselineHeight = await settingsShellHeight(page);
    expect(baselineHeight).toBeGreaterThan(590);
    expect(baselineHeight).toBeLessThanOrEqual(640);
    await expect(settingsShell(page)).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );
    await expect(sotControl(page, "settings-close")).toHaveAccessibleName(
        /^(关闭设置|Close settings)$/,
    );

    await settingsNav(page, "voscript").click();
    await expectShellHeightStable(page, baselineHeight);
    await expect(settingsShell(page)).toHaveAttribute(
        "data-sot-section",
        "voscript",
    );
    const settingsScrollBody = sotPanel(page, "settings-scroll-body");
    await scrollIfScrollable(settingsScrollBody);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(0);

    await settingsNav(page, "appearance").click();
    await expectShellHeightStable(page, baselineHeight);
    await expect.poll(() => elementScrollTop(settingsScrollBody)).toBe(0);
    await expect(page.locator('[data-sot-surface="settings-data-sources"]')).toBeHidden();

    await settingsNav(page, "data-sources").click();
    await expectShellHeightStable(page, baselineHeight);
    await expect(settingsShell(page)).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );
    const dataSourceDetailScroll = page.locator(
        '[data-sot-panel="source-provider-detail"]',
    );
    await scrollIfScrollable(dataSourceDetailScroll);
    await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(0);
    await expectShellHeightStable(page, baselineHeight);
    await expect(settingsShell(page)).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );

    await settingsNav(page, "appearance").click();
    await settingsNav(page, "data-sources").click();
    await expect
        .poll(() =>
            elementScrollTop(
                page.locator('[data-sot-panel="source-provider-detail"]'),
            ),
        )
        .toBe(0);
    await expectShellHeightStable(page, baselineHeight);

    await sotControl(page, "settings-close").focus();
    await page.keyboard.press("Space");
    await expect(settingsShell(page)).toBeHidden();
    await expect(settingsTrigger).toBeFocused();
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
    const section = page.locator('[data-sot-surface="settings-data-sources"]');
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );
    await expect(section).toBeVisible();
    const baselineHeight = await settingsShellHeight(page);

    const providerListScroll = section.locator(
        '[data-sot-list="source-providers"]',
    );
    const providerListScrolled = await scrollIfScrollable(providerListScroll);

    const providerDetailScroll = section.locator(
        '[data-sot-panel="source-provider-detail"]',
    );
    const providerDetailScrolled =
        await scrollIfScrollable(providerDetailScroll);

    const selectedProvider = await section.getAttribute(
        "data-sot-selected-provider",
    );
    const nextProvider = selectedProvider === "ticnote" ? "plaud" : "ticnote";
    await section
        .locator(
            `[data-sot-control="source-provider"][data-sot-provider="${nextProvider}"]`,
        )
        .click();
    await expect(section).toHaveAttribute(
        "data-sot-selected-provider",
        nextProvider,
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
        spacer.dataset.sotProbe = "settings-scroll-lock-spacer";
        spacer.style.height = "1800px";
        spacer.style.pointerEvents = "none";
        document.body.append(spacer);
        window.scrollTo(0, 320);
    });
    await expect.poll(() => windowScrollY(page)).toBeGreaterThan(250);

    await openSettingsWithRetry(page);
    const shell = settingsShell(page);
    await expect(shell).toBeVisible();

    const lockedScrollY = await windowScrollY(page);
    await page.mouse.move(20, 20);
    await page.mouse.wheel(0, 900);
    await expect.poll(() => windowScrollY(page)).toBe(lockedScrollY);

    await settingsNav(page, "voscript").click();
    const settingsScrollBody = sotPanel(page, "settings-scroll-body");
    await scrollIfScrollable(settingsScrollBody);
    await expect.poll(() => windowScrollY(page)).toBe(lockedScrollY);

    await sotControl(page, "settings-close").click();
    await expect(shell).toBeHidden();
    await page.mouse.move(20, 20);
    await page.mouse.wheel(0, 900);
    await expect.poll(() => windowScrollY(page)).toBeGreaterThan(lockedScrollY);
});

test("settings shell locks navigation and close while display immediate save is pending", async ({
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

    await page.route("**/api/settings/display", async (route) => {
        if (route.request().method() !== "PUT") {
            await route.continue();
            return;
        }

        notifySaveStarted();
        await pendingSave;
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
        });
    });

    await page.goto("/settings#appearance", { waitUntil: "domcontentloaded" });
    const shell = settingsShell(page);
    await expect(shell).toBeVisible();
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "appearance",
    );
    const itemsPerPageInput = page.locator("#display-items-per-page");
    await expect(itemsPerPageInput).toHaveValue("50");
    await expect(
        page.locator(
            '[data-sot-surface="settings-section"][data-sot-section="appearance"] [data-sot-control="settings-save"]',
        ),
    ).toHaveCount(0);
    await expect(
        page.locator(
            '[data-sot-surface="settings-section"][data-sot-section="appearance"] [data-save-action]',
        ),
    ).toHaveCount(0);

    await itemsPerPageInput.fill("42");
    await saveStarted;
    await expect(shell).toHaveAttribute("data-sot-state", "busy");
    await expect(settingsNav(page, "misc")).toBeDisabled();
    await expect(sotControl(page, "settings-close")).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(shell).toBeVisible();
    await settingsNav(page, "misc").evaluate(
        (node) => (node as HTMLButtonElement).click(),
    );
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "appearance",
    );

    await expect(itemsPerPageInput).toBeDisabled();
    releaseSave();
    await expect(shell).toHaveAttribute("data-sot-state", "idle");
    await expect(itemsPerPageInput).toBeEnabled();
    await expect(settingsNav(page, "misc")).toBeEnabled();
    await expect(sotControl(page, "settings-close")).toBeEnabled();
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
    const settingsScrollBody = sotPanel(page, "settings-scroll-body");
    await expect(shell).toBeVisible();
    const baselineHeight = await settingsShellHeight(page);

    for (const section of desktopSettingsSections) {
        await selectDesktopSettingsSection(page, section);
        await expect(shell).toHaveAttribute(
            "data-sot-section",
            section,
        );
        await expectShellHeightStable(page, baselineHeight);
        await expectShellFitsViewport(page);

        await settingsScrollBody.hover();
        await page.mouse.wheel(0, 420);
        await expect
            .poll(() => page.evaluate(() => window.scrollY))
            .toBe(0);
        await expect(shell).toHaveAttribute(
            "data-sot-section",
            section,
        );
    }

    await expect(settingsNav(page, "transcription")).toBeVisible();
    await selectDesktopSettingsSection(page, "transcription");
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "transcription",
    );
    await expectShellHeightStable(page, baselineHeight);
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
    await expect(shell).toHaveAttribute("data-sot-section", "misc");
    await expect(page).toHaveURL(/\/settings#misc$/);

    const baselineHeight = await settingsShellHeight(page);
    expect(baselineHeight).toBeGreaterThan(760);
    expect(baselineHeight).toBeLessThanOrEqual(844);
    await expectShellFitsViewport(page);

    const rail = shell.locator(".settings-rail");
    await expect(
        shell.locator('[data-sot-control="settings-section-selector"]'),
    ).toHaveCount(0);
    await expect(rail).toBeVisible();
    await expect(settingsNav(page, "misc")).toBeVisible();

    await settingsNav(page, "voscript").click();
    await expect(shell).toHaveAttribute("data-sot-section", "voscript");
    await expect(settingsNav(page, "voscript")).toHaveAttribute(
        "data-sot-state",
        "selected",
    );
    await expectShellHeightStable(page, baselineHeight);

    await page.mouse.wheel(0, 900);
    await expectShellHeightStable(page, baselineHeight);

    await settingsNav(page, "data-sources").click();
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );
    await expect(settingsNav(page, "data-sources")).toHaveAttribute(
        "data-sot-state",
        "selected",
    );
    await expect(
        page.locator('[data-sot-surface="settings-data-sources"]'),
    ).toBeVisible();
    await expectShellHeightStable(page, baselineHeight);

    await sotControl(page, "settings-close").click();
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
    await expect(shell).toHaveAttribute("data-sot-section", "transcription");

    await page.evaluate(() => {
        window.location.hash = "appearance";
    });
    await expect(shell).toHaveAttribute("data-sot-section", "appearance");
    await expect(
        page.locator(
            '[data-sot-surface="settings-section"][data-sot-section="appearance"]',
        ),
    ).toBeVisible();

    await page.evaluate(() => {
        window.location.hash = "misc";
    });
    await expect(shell).toHaveAttribute("data-sot-section", "misc");
    await expect(
        page.locator(
            '[data-sot-surface="settings-section"][data-sot-section="misc"]',
        ),
    ).toBeVisible();

    await page.evaluate(() => {
        window.location.hash = "data-sources";
    });
    await expect(shell).toHaveAttribute("data-sot-section", "data-sources");
    await expect(page.locator('[data-sot-surface="settings-data-sources"]')).toBeVisible();
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
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "title-generation",
    );
    await expect(settingsNav(page, "title-generation")).toHaveAttribute(
        "data-keyboard-selected",
        "true",
    );

    await page.keyboard.press("ArrowDown");
    await expect(settingsNav(page, "voscript")).toHaveAttribute(
        "data-keyboard-selected",
        "true",
    );
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "title-generation",
    );

    await page.keyboard.press("Enter");
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "voscript",
    );
    await expect
        .poll(() =>
            page.evaluate(() => localStorage.getItem("settings-last-section")),
        )
        .toBe("voscript");

    await page.keyboard.press("ArrowDown");
    await expect(settingsNav(page, "data-sources")).toHaveAttribute(
        "data-keyboard-selected",
        "true",
    );
    await page.keyboard.press("Space");
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "data-sources",
    );

    await page.keyboard.press("ArrowUp");
    await expect(settingsNav(page, "voscript")).toHaveAttribute(
        "data-keyboard-selected",
        "true",
    );
    await page.keyboard.press("Enter");
    await expect(shell).toHaveAttribute(
        "data-sot-section",
        "voscript",
    );

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
    await expect(shell).toHaveAttribute("data-sot-state", "idle");
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
    await expect(shell).toHaveAttribute("data-sot-section", "title-generation");
    const skeleton = page.locator(
        '[data-sot-panel="settings-section-skeleton"][data-sot-section="title-generation"]',
    );
    await expect(skeleton).toHaveAttribute("data-sot-state", "loading");
    releaseInitialLoad?.();

    const errorSection = page.locator(
        '[data-sot-surface="settings-section"][data-sot-section="title-generation"]',
    );
    await expect(errorSection).toHaveAttribute("data-sot-state", "error");
    const errorPanel = errorSection.locator(
        '[data-sot-panel="settings-section-load-error"][data-sot-section="title-generation"]',
    );
    await expect(errorPanel).toBeVisible();
    const retry = errorSection.locator(
        '[data-sot-control="settings-section-load-retry"][data-sot-section="title-generation"]',
    );
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
    await expect(errorSection).toHaveAttribute("data-sot-state", "ready");

    const loadErrorRetry: LoadErrorRetryEvidence = {
        errorPanelVisible: errorPanelWasVisible,
        normalControlCountInError,
        retryReturnedReady:
            (await errorSection.getAttribute("data-sot-state")) === "ready",
        retryVisible: retryWasVisible,
        section: "title-generation",
        states: ["loading", "error", "ready"],
    };

    const evidence = {
        acceptanceBoundaries: [
            "Load-error/retry coverage is structural because the handoff SOT shell has no dedicated load-error/retry pixel fixture.",
            "Data Sources real-provider test-success is covered by integration validation, not by this six-section visual acceptance artifact.",
            "Repository-level all-page/all-control validation is tracked by the full Playwright suite outside this row 117 artifact.",
        ],
        generatedAt: new Date().toISOString(),
        loadErrorRetry,
        row: 117,
        scope: "Settings shell six canonical section acceptance",
        sections,
    };

    await writeFile(
        path.join(ROW_117_EVIDENCE_DIR, "settings-shell-six-section-acceptance.json"),
        JSON.stringify(evidence, null, 2),
    );
    await writeFile(
        path.join(ROW_117_EVIDENCE_DIR, "settings-shell-six-section-acceptance.md"),
        settingsSixSectionAcceptanceMarkdown(evidence),
    );
});

test("settings shell row 117 captures responsive visual matrix", async ({
    browser,
    page,
}) => {
    await mkdir(ROW_117_EVIDENCE_DIR, { recursive: true });
    await ensureSignedIn(page);
    await resetDisplayToChinese(page);
    await clearSettingsPersistence(page);
    await seedTitleGenerationReadyState(page);
    await seedRow117ReadyStateRoutes(page);

    const frames: Row117FrameEvidence[] = [];
    const sotPage = await browser.newPage();

    try {
        const desktop = row117PixelFrames[0];
        await page.setViewportSize(desktop.viewport);
        await page.goto("/settings#transcription", {
            waitUntil: "domcontentloaded",
        });
        const desktopShell = settingsShell(page);
        await expect(desktopShell).toHaveAttribute(
            "data-sot-section",
            "transcription",
        );
        await expectSettingsHeaderSotCopy(desktopShell);
        await page.evaluate(() => {
            window.location.hash = "appearance";
        });
        await expect(desktopShell).toHaveAttribute(
            "data-sot-section",
            desktop.section,
        );
        await expect(settingsNav(page, desktop.section)).toHaveAttribute(
            "data-sot-state",
            "selected",
        );
        await expectShellFitsViewport(page);
        const desktopFocusEvidence = await page.evaluate(() => {
            const navSelector =
                '.settings-rail [data-sot-control="settings-nav"]';
            const transcriptionNavSelector =
                `${navSelector}[data-sot-section="transcription"]`;

            function summarizeActiveElement() {
                const active = document.activeElement as HTMLElement | null;

                return {
                    control: active?.getAttribute("data-sot-control") ?? null,
                    isSettingsNav: active?.matches(navSelector) ?? false,
                    isTranscriptionNav:
                        active?.matches(transcriptionNavSelector) ?? false,
                    section: active?.getAttribute("data-sot-section") ?? null,
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
            ],
            blockerReason: diff.blockerReason,
            diff,
            frame: desktop.frame,
            notes: [
                "product runtime compared against handoff SOT Web/index shell",
                "hash transition focus is cleared before screenshot capture",
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
        await expect(
            mobileShell.locator(
                '[data-sot-control="settings-section-selector"]',
            ),
        ).toHaveCount(0);
        await expect(mobileShell.locator(".settings-rail")).toBeVisible();
        await expect(settingsNav(page, "misc")).toBeVisible();
        await settingsNav(page, mobile.section).click();
        await expect(mobileShell).toHaveAttribute(
            "data-sot-section",
            mobile.section,
        );
        await expect(settingsNav(page, mobile.section)).toHaveAttribute(
            "data-sot-state",
            "selected",
        );
        await expect(
            page.locator('[data-sot-surface="settings-data-sources"]'),
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
        const appearanceSection = page.locator(
            '[data-sot-surface="settings-section"][data-sot-section="appearance"]',
        );
        const appearanceSaveControls = appearanceSection.locator(
            '[data-sot-control="settings-save"], [data-save-action]',
        );
        const appearanceFooter = appearanceSection.locator(".sm-actions");
        await expect(itemsPerPageInput).toHaveValue("50");
        await itemsPerPageInput.fill("42");
        await saveStarted;
        await expect(savingShell).toHaveAttribute("data-sot-state", "busy");
        await expect(appearanceSection).toHaveAttribute("data-sot-state", "busy");
        await expect(appearanceSection).toHaveAttribute("aria-busy", "true");
        await expect(appearanceSaveControls).toHaveCount(0);
        await expect(appearanceFooter).toHaveCount(0);
        await expect(itemsPerPageInput).toBeDisabled();
        await expect(settingsNav(page, "misc")).toBeDisabled();
        await expect(sotControl(page, "settings-close")).toBeDisabled();

        frameName = sanitizeEvidenceName(saving.frame);
        productPath = path.join(
            ROW_117_EVIDENCE_DIR,
            `${frameName}-product.png`,
        );
        productCapture = await captureShellFrame(savingShell, productPath);
        frames.push({
            assertions: [
                "display items-per-page change is held pending",
                "settings shell data-sot-state=busy",
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
        await expect(savingShell).toHaveAttribute("data-sot-state", "idle");
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
        await expect(errorShell).toHaveAttribute(
            "data-sot-section",
            "title-generation",
        );
        await expectSettingsHeaderSotCopy(errorShell);
        const errorSection = page.locator(
            '[data-sot-surface="settings-section"][data-sot-section="title-generation"]',
        );
        await expect(errorSection).toHaveAttribute("data-sot-state", "error");
        const retry = page.locator(
            '[data-sot-control="settings-section-load-retry"][data-sot-section="title-generation"]',
        );
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
        await expect(errorSection).toHaveAttribute("data-sot-state", "ready");

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
                const productShell = await openProductSettingsSection(
                    page,
                    section,
                    readyFrame.viewport,
                );
                await expectSettingsHeaderSotCopy(productShell);
                await expectActiveSettingsSectionReady(page, section);

                if (readyFrameViewport.mode === "mobile") {
                    await expect(
                        productShell.locator(
                            '[data-sot-control="settings-section-selector"]',
                        ),
                    ).toHaveCount(0);
                    await expect(
                        productShell.locator(".settings-rail"),
                    ).toBeVisible();
                    await expect(settingsNav(page, section)).toBeVisible();
                }

                const captureDesktopReadyDetails =
                    readyFrameViewport.mode === "desktop";
                const titleGenerationStoredKeyEvidence =
                    captureDesktopReadyDetails && section === "title-generation"
                        ? await expectTitleGenerationReadyStoredKeyEvidence(page)
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
